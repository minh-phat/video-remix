import { z } from 'zod';

export const healthCheckSchema = z.object({
  status: z.literal('ok'),
  timestamp: z.string(),
});

export type HealthCheck = z.infer<typeof healthCheckSchema>;

export * from './auth.ts';
export * from './projects.ts';
export * from './characters.ts';
export * from './pages.ts';
export * from './socket.ts';
export * from './analysis.ts';
export * from './review.ts';
export * from './voices.ts';
export * from './render.ts';
