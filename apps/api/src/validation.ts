import type { ValidationTargets } from 'hono';
import { validator } from 'hono/validator';
import { z } from 'zod';
import { errorBody } from './errors';

export const idParamSchema = z.object({ id: z.uuid() });

export function validate<Target extends keyof ValidationTargets, Schema extends z.ZodType>(
  target: Target,
  schema: Schema,
) {
  return validator(target, (value, c) => {
    const result = schema.safeParse(value);
    if (!result.success) {
      const details = result.error.issues.map(({ path, message }) => ({ path, message }));
      return c.json(errorBody('validation_failed', 'Invalid request', details), 400);
    }
    return result.data as z.output<Schema>;
  });
}
