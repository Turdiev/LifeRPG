import { errorResponseSchema, type ErrorCode } from '@life-rpg/shared';

export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode;

  constructor(status: number, code: ErrorCode, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

type Schema<T> = { parse: (data: unknown) => T };
type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

/** Ответ проверяется схемой из shared: расхождение контракта видно сразу, а не в глубине UI. */
export async function apiRequest<T>(method: Method, path: string, schema: Schema<T>, body?: unknown): Promise<T> {
  // Тело шлём только когда оно есть: пустое тело с Content-Type: application/json API отклонит.
  const init: RequestInit =
    body === undefined
      ? { method }
      : { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
  const res = await fetch(`/api/v1${path}`, init);
  const json: unknown = await res.json().catch(() => null);

  if (!res.ok) {
    const parsed = errorResponseSchema.safeParse(json);
    if (parsed.success) throw new ApiError(res.status, parsed.data.error.code, parsed.data.error.message);
    throw new ApiError(res.status, 'internal_error', `HTTP ${res.status}`);
  }
  return schema.parse(json);
}
