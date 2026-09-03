import type { FastifyReply } from 'fastify';
import type { ApiErrorCode, ApiErrorBody } from '@truchabrew/shared-types';

export function sendApiError(
  reply: FastifyReply,
  status: number,
  code: ApiErrorCode,
  message: string,
  details?: unknown,
): void {
  const body: ApiErrorBody = { error: { code, message, ...(details !== undefined ? { details } : {}) } };
  reply.status(status).send(body);
}
