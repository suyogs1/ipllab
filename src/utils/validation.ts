/**
 * Runtime validation for debugger events
 */

import { z } from 'zod';

export const BreakpointSchema = z.object({
  line: z.number().min(1),
  enabled: z.boolean().default(true),
  condition: z.string().optional()
});

export const StepEventSchema = z.object({
  type: z.enum(['into', 'over', 'out']),
  count: z.number().min(1).default(1)
});

export const PauseEventSchema = z.object({
  reason: z.enum(['user', 'breakpoint', 'error', 'completion'])
});

export const ResumeEventSchema = z.object({
  mode: z.enum(['run', 'step'])
});

export type Breakpoint = z.infer<typeof BreakpointSchema>;
export type StepEvent = z.infer<typeof StepEventSchema>;
export type PauseEvent = z.infer<typeof PauseEventSchema>;
export type ResumeEvent = z.infer<typeof ResumeEventSchema>;

/**
 * Validate and parse debugger events
 */
export function validateBreakpoint(data: unknown): Breakpoint {
  return BreakpointSchema.parse(data);
}

export function validateStepEvent(data: unknown): StepEvent {
  return StepEventSchema.parse(data);
}

export function validatePauseEvent(data: unknown): PauseEvent {
  return PauseEventSchema.parse(data);
}

export function validateResumeEvent(data: unknown): ResumeEvent {
  return ResumeEventSchema.parse(data);
}