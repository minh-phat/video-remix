import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';

const VISION_MODEL = 'gemini-flash-latest';
const EMBEDDING_MODEL = 'gemini-embedding-2';
const EMBEDDING_DIMENSIONS = 768;
const TTS_MODEL = 'gemini-2.5-flash-preview-tts';
// Fixed output format for Gemini TTS (raw PCM, no container) — see
// https://ai.google.dev/gemini-api/docs/speech-generation
const TTS_SAMPLE_RATE = 24000;
const TTS_BITS_PER_SAMPLE = 16;
const TTS_CHANNELS = 1;

/** Wraps raw PCM audio (as returned by Gemini TTS) in a minimal WAV header so it's directly playable. */
function pcmToWav(pcm: Buffer): Buffer {
  const byteRate = (TTS_SAMPLE_RATE * TTS_CHANNELS * TTS_BITS_PER_SAMPLE) / 8;
  const blockAlign = (TTS_CHANNELS * TTS_BITS_PER_SAMPLE) / 8;
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(TTS_CHANNELS, 22);
  header.writeUInt32LE(TTS_SAMPLE_RATE, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(TTS_BITS_PER_SAMPLE, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

export interface DetectedCharacter {
  label: string;
  matchedKnownName: string | null;
  /** [ymin, xmin, ymax, xmax], normalized 0-1000 (Gemini's bounding box convention). */
  box2d: [number, number, number, number];
  confidence: number;
}

export interface DetectedDialogueLine {
  text: string;
  order: number;
}

export interface PageAnalysisResult {
  characters: DetectedCharacter[];
  dialogue: DetectedDialogueLine[];
}

const PAGE_ANALYSIS_SCHEMA = {
  type: 'object',
  properties: {
    characters: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          label: { type: 'string', description: 'Short descriptive label for this character' },
          matchedKnownName: {
            type: ['string', 'null'],
            description: 'Exact name from the known character list if this character matches one, otherwise null',
          },
          box2d: {
            type: 'array',
            items: { type: 'number' },
            minItems: 4,
            maxItems: 4,
            description: '[ymin, xmin, ymax, xmax] normalized to 0-1000',
          },
          confidence: { type: 'number', description: '0 to 1' },
        },
        required: ['label', 'matchedKnownName', 'box2d', 'confidence'],
      },
    },
    dialogue: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          order: { type: 'number', description: 'Reading order, starting at 0' },
        },
        required: ['text', 'order'],
      },
    },
  },
  required: ['characters', 'dialogue'],
};

@Injectable()
export class GeminiService {
  private readonly client: GoogleGenAI;

  constructor(private readonly config: ConfigService) {
    // Deliberately not getOrThrow: this service is constructed eagerly at app
    // bootstrap, and a missing key here must not crash the whole backend —
    // only calls that actually need Gemini should fail, and only when made.
    this.client = new GoogleGenAI({ apiKey: this.config.get<string>('GEMINI_API_KEY') ?? '' });
  }

  async analyzePage(imageBuffer: Buffer, mimeType: string, knownCharacterNames: string[]): Promise<PageAnalysisResult> {
    const knownNamesText =
      knownCharacterNames.length > 0
        ? `Known characters in this project: ${knownCharacterNames.join(', ')}. If a detected character visually matches one of these, set matchedKnownName to that exact name.`
        : 'No known characters have been added yet, so matchedKnownName should always be null.';

    const prompt = `This is a single page from a comic book/manga. Analyze it and return:
1. "characters": every distinct character that appears on this page, each with a short label, a bounding box, and a confidence score. ${knownNamesText}
2. "dialogue": every piece of dialogue or narration text visible in speech bubbles or caption boxes, transcribed exactly, in top-to-bottom reading order starting at 0.`;

    const response = await this.client.models.generateContent({
      model: VISION_MODEL,
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }, { inlineData: { mimeType, data: imageBuffer.toString('base64') } }],
        },
      ],
      config: {
        responseMimeType: 'application/json',
        responseJsonSchema: PAGE_ANALYSIS_SCHEMA,
      },
    });

    const text = response.text;
    if (!text) throw new Error('Gemini returned an empty response for page analysis');
    return JSON.parse(text) as PageAnalysisResult;
  }

  async embedImage(imageBuffer: Buffer, mimeType: string): Promise<number[]> {
    const response = await this.client.models.embedContent({
      model: EMBEDDING_MODEL,
      contents: [{ parts: [{ inlineData: { mimeType, data: imageBuffer.toString('base64') } }] }],
      config: { outputDimensionality: EMBEDDING_DIMENSIONS },
    });

    const values = response.embeddings?.[0]?.values;
    if (!values) throw new Error('Gemini returned no embedding for image');
    return values;
  }

  async synthesizeSpeech(text: string, voiceName: string, languageCode = 'vi'): Promise<{ audioBuffer: Buffer; durationMs: number }> {
    const response = await this.client.models.generateContent({
      model: TTS_MODEL,
      contents: [{ role: 'user', parts: [{ text }] }],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          languageCode,
          voiceConfig: { prebuiltVoiceConfig: { voiceName } },
        },
      },
    });

    const base64Pcm = response.data;
    if (!base64Pcm) throw new Error('Gemini returned no audio for speech synthesis');

    const pcm = Buffer.from(base64Pcm, 'base64');
    const byteRate = (TTS_SAMPLE_RATE * TTS_CHANNELS * TTS_BITS_PER_SAMPLE) / 8;
    const durationMs = Math.round((pcm.length / byteRate) * 1000);
    return { audioBuffer: pcmToWav(pcm), durationMs };
  }
}
