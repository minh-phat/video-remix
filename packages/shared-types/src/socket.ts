import { z } from "zod";
import { pageStatusSchema } from "./pages.ts";
import { ttsStatusSchema } from "./analysis.ts";
import { renderStatusSchema } from "./render.ts";

export const pageStatusEventSchema = z.object({
  pageId: z.string(),
  status: pageStatusSchema,
  errorMessage: z.string().nullable().optional(),
});
export type PageStatusEvent = z.infer<typeof pageStatusEventSchema>;

export const dialogueTtsStatusEventSchema = z.object({
  lineId: z.string(),
  status: ttsStatusSchema,
  errorMessage: z.string().nullable().optional(),
});
export type DialogueTtsStatusEvent = z.infer<typeof dialogueTtsStatusEventSchema>;

export const renderStatusEventSchema = z.object({
  jobId: z.string(),
  status: renderStatusSchema,
  progress: z.number(),
  errorMessage: z.string().nullable().optional(),
});
export type RenderStatusEvent = z.infer<typeof renderStatusEventSchema>;
