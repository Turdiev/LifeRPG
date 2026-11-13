import { DomainError } from '@life-rpg/domain';
import type { ErrorCode, ErrorResponse } from '@life-rpg/shared';
import type { ErrorHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';

/** Узла нет или он чужой: оба случая — 404, чтобы не раскрывать существование чужих id. */
export class NotFoundError extends Error {
  constructor() {
    super('Not found');
    this.name = 'NotFoundError';
  }
}

export function errorBody(code: ErrorCode, message: string, details?: unknown): ErrorResponse {
  return { error: details === undefined ? { code, message } : { code, message, details } };
}

export const handleError: ErrorHandler = (error, c) => {
  if (error instanceof DomainError) return c.json(errorBody(error.code, error.message), 409);
  if (error instanceof NotFoundError) return c.json(errorBody('not_found', error.message), 404);
  // Hono бросает HTTPException 400 на тело, которое не разбирается как JSON.
  if (error instanceof HTTPException && error.status === 400) {
    return c.json(errorBody('validation_failed', error.message), 400);
  }
  // Так отвечает только csrf(): запрос с чужого сайта. Чужие данные — по-прежнему 404, не 403.
  if (error instanceof HTTPException && error.status === 403) {
    return c.json(errorBody('forbidden', 'Cross-site request rejected'), 403);
  }
  console.error(JSON.stringify({ message: 'unhandled error', error: String(error), stack: error.stack }));
  return c.json(errorBody('internal_error', 'Internal error'), 500);
};
