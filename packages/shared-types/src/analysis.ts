import { z } from "zod";

export const bboxSchema = z.object({
  ymin: z.number(),
  xmin: z.number(),
  ymax: z.number(),
  xmax: z.number(),
});
export type Bbox = z.infer<typeof bboxSchema>;

export const appearanceSourceSchema = z.enum(["VISION_MATCH", "MANUAL"]);
export type AppearanceSource = z.infer<typeof appearanceSourceSchema>;

export const characterAppearanceSchema = z.object({
  id: z.string(),
  characterId: z.string().nullable(),
  characterName: z.string().nullable(),
  cropUrl: z.string(),
  bbox: bboxSchema,
  confidence: z.number(),
  source: appearanceSourceSchema,
});
export type CharacterAppearanceDto = z.infer<typeof characterAppearanceSchema>;

export const ttsStatusSchema = z.enum(["PENDING", "QUEUED", "DONE", "ERROR"]);
export type TtsStatus = z.infer<typeof ttsStatusSchema>;

export const dialogueLineSchema = z.object({
  id: z.string(),
  characterId: z.string().nullable(),
  order: z.number(),
  rawText: z.string(),
  editedText: z.string(),
  ttsAudioUrl: z.string().nullable(),
  ttsDurationMs: z.number().nullable(),
  ttsStatus: ttsStatusSchema,
  ttsError: z.string().nullable(),
});
export type DialogueLineDto = z.infer<typeof dialogueLineSchema>;

export const pageAnalysisSchema = z.object({
  appearances: z.array(characterAppearanceSchema),
  dialogueLines: z.array(dialogueLineSchema),
});
export type PageAnalysis = z.infer<typeof pageAnalysisSchema>;
