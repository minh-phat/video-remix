import { z } from "zod";

export const pageStatusSchema = z.enum(["UPLOADED", "ANALYZING", "ANALYZED", "ERROR"]);
export type PageStatus = z.infer<typeof pageStatusSchema>;

export const presignPageImageSchema = z.object({
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
});
export type PresignPageImageDto = z.infer<typeof presignPageImageSchema>;

export const confirmPageSchema = z.object({
  key: z.string().min(1),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});
export type ConfirmPageDto = z.infer<typeof confirmPageSchema>;

export const reorderPagesSchema = z.object({
  pageIds: z.array(z.string()).min(1),
});
export type ReorderPagesDto = z.infer<typeof reorderPagesSchema>;

export const comicPageSchema = z.object({
  id: z.string(),
  url: z.string(),
  order: z.number(),
  width: z.number().nullable(),
  height: z.number().nullable(),
  status: pageStatusSchema,
  errorMessage: z.string().nullable(),
  createdAt: z.string(),
});
export type ComicPage = z.infer<typeof comicPageSchema>;
