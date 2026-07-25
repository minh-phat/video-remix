import { z } from "zod";

export const createCharacterSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(2000).optional(),
});
export type CreateCharacterDto = z.infer<typeof createCharacterSchema>;

export const updateCharacterSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(2000).optional(),
  voiceId: z.string().max(200).optional(),
});
export type UpdateCharacterDto = z.infer<typeof updateCharacterSchema>;

export const characterReferenceImageSchema = z.object({
  id: z.string(),
  url: z.string(),
  createdAt: z.string(),
});
export type CharacterReferenceImage = z.infer<typeof characterReferenceImageSchema>;

export const characterSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  voiceId: z.string().nullable(),
  refImages: z.array(characterReferenceImageSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Character = z.infer<typeof characterSchema>;

export const presignReferenceImageSchema = z.object({
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
});
export type PresignReferenceImageDto = z.infer<typeof presignReferenceImageSchema>;

export const presignedUploadSchema = z.object({
  uploadUrl: z.string(),
  key: z.string(),
});
export type PresignedUpload = z.infer<typeof presignedUploadSchema>;

export const confirmReferenceImageSchema = z.object({
  key: z.string().min(1),
});
export type ConfirmReferenceImageDto = z.infer<typeof confirmReferenceImageSchema>;
