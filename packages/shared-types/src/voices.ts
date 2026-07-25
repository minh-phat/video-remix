// Gemini TTS prebuilt voices — see https://ai.google.dev/gemini-api/docs/speech-generation
export const GEMINI_VOICES = [
  { name: "Zephyr", trait: "Bright" },
  { name: "Puck", trait: "Upbeat" },
  { name: "Charon", trait: "Informative" },
  { name: "Kore", trait: "Firm" },
  { name: "Fenrir", trait: "Excitable" },
  { name: "Leda", trait: "Youthful" },
  { name: "Orus", trait: "Firm" },
  { name: "Aoede", trait: "Breezy" },
  { name: "Callirrhoe", trait: "Easy-going" },
  { name: "Autonoe", trait: "Bright" },
  { name: "Enceladus", trait: "Breathy" },
  { name: "Iapetus", trait: "Clear" },
  { name: "Umbriel", trait: "Easy-going" },
  { name: "Algieba", trait: "Smooth" },
  { name: "Despina", trait: "Smooth" },
  { name: "Erinome", trait: "Clear" },
  { name: "Algenib", trait: "Gravelly" },
  { name: "Rasalgethi", trait: "Informative" },
  { name: "Laomedeia", trait: "Upbeat" },
  { name: "Achernar", trait: "Soft" },
  { name: "Alnilam", trait: "Firm" },
  { name: "Schedar", trait: "Even" },
  { name: "Gacrux", trait: "Mature" },
  { name: "Pulcherrima", trait: "Forward" },
  { name: "Achird", trait: "Friendly" },
  { name: "Zubenelgenubi", trait: "Casual" },
  { name: "Vindemiatrix", trait: "Gentle" },
  { name: "Sadachbia", trait: "Lively" },
  { name: "Sadaltager", trait: "Knowledgeable" },
  { name: "Sulafat", trait: "Warm" },
] as const;

export const DEFAULT_NARRATOR_VOICE = "Kore";

export type GeminiVoiceName = (typeof GEMINI_VOICES)[number]["name"];
