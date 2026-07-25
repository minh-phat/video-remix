import { z } from "zod";

export const updateDialogueLineSchema = z.object({
  editedText: z.string().min(1).max(2000).optional(),
  characterId: z.string().nullable().optional(),
});
export type UpdateDialogueLineDto = z.infer<typeof updateDialogueLineSchema>;

export const createDialogueLineSchema = z.object({
  editedText: z.string().min(1).max(2000),
});
export type CreateDialogueLineDto = z.infer<typeof createDialogueLineSchema>;

export const updateAppearanceSchema = z.object({
  characterId: z.string().nullable(),
});
export type UpdateAppearanceDto = z.infer<typeof updateAppearanceSchema>;

export const saveAppearanceAsCharacterSchema = z.object({
  name: z.string().min(1).max(100),
});
export type SaveAppearanceAsCharacterDto = z.infer<typeof saveAppearanceAsCharacterSchema>;
