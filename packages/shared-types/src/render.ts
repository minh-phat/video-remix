import { z } from "zod";

export const renderStatusSchema = z.enum(["QUEUED", "RENDERING", "DONE", "FAILED"]);
export type RenderStatus = z.infer<typeof renderStatusSchema>;

export const videoRenderJobSchema = z.object({
  id: z.string(),
  status: renderStatusSchema,
  progress: z.number(),
  outputUrl: z.string().nullable(),
  errorMessage: z.string().nullable(),
  createdAt: z.string(),
});
export type VideoRenderJob = z.infer<typeof videoRenderJobSchema>;
