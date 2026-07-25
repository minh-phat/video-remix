import { z } from "zod";

export const projectStatusSchema = z.enum(["DRAFT", "ANALYZING", "READY_FOR_REVIEW", "RENDERING", "DONE"]);
export type ProjectStatus = z.infer<typeof projectStatusSchema>;

export const createProjectSchema = z.object({
  title: z.string().min(1).max(200),
});
export type CreateProjectDto = z.infer<typeof createProjectSchema>;

export const projectSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: projectStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Project = z.infer<typeof projectSchema>;
