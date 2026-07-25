import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { DEFAULT_NARRATOR_VOICE } from '@video-remix/shared-types';
import { TTS_QUEUE } from '../../queue/queue.module';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { GeminiService } from '../../ai-providers/gemini.service';
import { RealtimeGateway } from '../../realtime/realtime.gateway';

export interface TtsJobData {
  lineId: string;
}

@Processor(TTS_QUEUE)
export class TtsProcessor extends WorkerHost {
  private readonly logger = new Logger(TtsProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly gemini: GeminiService,
    private readonly realtime: RealtimeGateway,
  ) {
    super();
  }

  async process(job: Job<TtsJobData>): Promise<void> {
    const { lineId } = job.data;
    const line = await this.prisma.dialogueLine.findUniqueOrThrow({
      where: { id: lineId },
      include: { character: true, page: { include: { project: true } } },
    });
    const { projectId } = line.page;

    try {
      const voiceName = line.character?.voiceId ?? DEFAULT_NARRATOR_VOICE;
      const { audioBuffer, durationMs } = await this.gemini.synthesizeSpeech(line.editedText, voiceName);

      const audioKey = this.storage.buildKey(
        'users',
        line.page.project.userId,
        'projects',
        projectId,
        'dialogue',
        `${lineId}.wav`,
      );
      await this.storage.putObject(audioKey, audioBuffer, 'audio/wav');

      await this.prisma.dialogueLine.update({
        where: { id: lineId },
        data: { ttsAudioKey: audioKey, ttsDurationMs: durationMs, ttsStatus: 'DONE', ttsError: null },
      });
      this.realtime.emitDialogueTtsStatus(projectId, { lineId, status: 'DONE' });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`TTS failed for line ${lineId}: ${message}`);
      await this.prisma.dialogueLine.update({
        where: { id: lineId },
        data: { ttsStatus: 'ERROR', ttsError: message },
      });
      this.realtime.emitDialogueTtsStatus(projectId, { lineId, status: 'ERROR', errorMessage: message });
      throw err;
    }
  }
}
