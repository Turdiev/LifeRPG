import { z } from 'zod';

export const errorCodeSchema = z.enum([
  'validation_failed',
  'not_found',
  'branch_locked',
  'has_open_children',
  'invalid_parent',
  'invalid_transition',
  'payload_too_large',
  'internal_error',
]);
export type ErrorCode = z.infer<typeof errorCodeSchema>;

export const errorResponseSchema = z.object({
  error: z.object({
    code: errorCodeSchema,
    message: z.string(),
    details: z.unknown().optional(),
  }),
});
export type ErrorResponse = z.infer<typeof errorResponseSchema>;
