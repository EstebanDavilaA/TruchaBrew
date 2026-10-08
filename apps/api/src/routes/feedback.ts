import type { FastifyInstance } from 'fastify';
import type { FeedbackInput, OutboundWebhookPayload } from '@truchabrew/shared-types';
import { sendApiError } from '../errors';

export function buildOutboundPayload(
  input: FeedbackInput,
  timestamp: string,
): OutboundWebhookPayload {
  const ctx = input.context;
  const batchInfo = ctx.batchName
    ? ` • Batch: **${ctx.batchName}** (${ctx.batchStage ?? 'Unknown'})`
    : '';

  const content = [
    '📢 **TruchaBrew Feedback**',
    `> ${input.message.replace(/\n/g, '\n> ')}`,
    '',
    `**Context:** App \`${ctx.appVersion}\` • Route \`${ctx.route}\` • Viewport \`${ctx.viewport.width}x${ctx.viewport.height}\`${batchInfo}`,
  ].join('\n');

  return {
    content,
    text: `TruchaBrew Feedback: ${input.message}`,
    feedback: {
      message: input.message,
      timestamp,
      context: ctx,
    },
  };
}

const feedbackBodySchema = {
  type: 'object',
  required: ['message', 'context'],
  additionalProperties: false,
  properties: {
    message: { type: 'string', minLength: 1, maxLength: 5000 },
    context: {
      type: 'object',
      required: ['appVersion', 'route', 'viewport'],
      additionalProperties: false,
      properties: {
        appVersion: { type: 'string' },
        route: { type: 'string' },
        viewport: {
          type: 'object',
          required: ['width', 'height'],
          additionalProperties: false,
          properties: {
            width: { type: 'number' },
            height: { type: 'number' },
          },
        },
        batchId: { type: 'string' },
        batchName: { type: 'string' },
        batchStage: { type: 'string' },
      },
    },
  },
};

export interface FeedbackRouteOptions {
  timeoutMs?: number;
}

export function registerFeedbackRoutes(
  app: FastifyInstance,
  webhookUrl?: string,
  options?: FeedbackRouteOptions,
): void {
  app.post<{ Body: FeedbackInput }>(
    '/api/feedback',
    { schema: { body: feedbackBodySchema } },
    async (request, reply) => {
      const trimmed = request.body.message.trim();
      if (trimmed.length === 0) {
        sendApiError(reply, 400, 'VALIDATION_FAILED', 'Message cannot be empty');
        return;
      }
      if (trimmed.length > 5000) {
        sendApiError(reply, 400, 'VALIDATION_FAILED', 'Message must NOT have more than 5000 characters');
        return;
      }

      if (!webhookUrl) {
        sendApiError(
          reply,
          503,
          'FEEDBACK_NOT_CONFIGURED' as unknown as import('@truchabrew/shared-types').ApiErrorCode,
          'Feedback webhook destination is not configured on this server',
        );
        return;
      }

      const timestamp = new Date().toISOString();
      const payload = buildOutboundPayload(request.body, timestamp);
      const timeoutMs = options?.timeoutMs ?? 10_000;

      try {
        const signal = AbortSignal.timeout(timeoutMs);
        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          signal,
        });

        if (!response.ok) {
          sendApiError(
            reply,
            502,
            'FEEDBACK_DELIVERY_FAILED' as unknown as import('@truchabrew/shared-types').ApiErrorCode,
            `Outbound webhook responded with status ${response.status}`,
          );
          return;
        }

        reply.status(200).send({
          success: true,
          timestamp,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown network error';
        sendApiError(
          reply,
          502,
          'FEEDBACK_DELIVERY_FAILED' as unknown as import('@truchabrew/shared-types').ApiErrorCode,
          `Outbound webhook delivery failed: ${message}`,
        );
      }
    },
  );
}
