import { describe, it, expect, afterEach } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { createTestDb, type TestDbHandle } from './helpers/testDb';
import { buildServer } from '../src/server';
import { buildOutboundPayload } from '../src/routes/feedback';
import type { FeedbackInput, OutboundWebhookPayload } from '@truchabrew/shared-types';

let handle: TestDbHandle | undefined;
let mockServer: http.Server | undefined;

afterEach(async () => {
  handle?.cleanup();
  handle = undefined;
  if (mockServer) {
    await new Promise<void>((resolve) => mockServer!.close(() => resolve()));
    mockServer = undefined;
  }
});

function validContext() {
  return {
    appVersion: '0.1.0',
    route: '/batches/b-123',
    viewport: { width: 390, height: 844 },
    batchId: 'b-123',
    batchName: 'Centennial IPA',
    batchStage: 'Brewing',
  };
}

describe('M43_P1 Feedback API', () => {
  it('AC-3: POST /api/feedback validation — empty message returns 400 VALIDATION_FAILED', async () => {
    handle = createTestDb();
    const app = buildServer({ db: handle.db, feedbackWebhookUrl: 'http://localhost:9999' });

    const res = await app.inject({
      method: 'POST',
      url: '/api/feedback',
      payload: {
        message: '',
        context: validContext(),
      },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error.code).toBe('VALIDATION_FAILED');
  });

  it('AC-4: POST /api/feedback validation — whitespace message returns 400 VALIDATION_FAILED', async () => {
    handle = createTestDb();
    const app = buildServer({ db: handle.db, feedbackWebhookUrl: 'http://localhost:9999' });

    const res = await app.inject({
      method: 'POST',
      url: '/api/feedback',
      payload: {
        message: '   \n \t  ',
        context: validContext(),
      },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error.code).toBe('VALIDATION_FAILED');
    expect(body.error.message).toContain('empty');
  });

  it('AC-5: POST /api/feedback validation — message > 5000 chars returns 400', async () => {
    handle = createTestDb();
    const app = buildServer({ db: handle.db, feedbackWebhookUrl: 'http://localhost:9999' });

    const longMessage = 'x'.repeat(5001);
    const res = await app.inject({
      method: 'POST',
      url: '/api/feedback',
      payload: {
        message: longMessage,
        context: validContext(),
      },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error.code).toBe('VALIDATION_FAILED');
  });

  it('AC-6: POST /api/feedback unconfigured returns 503 FEEDBACK_NOT_CONFIGURED', async () => {
    handle = createTestDb();
    const app = buildServer({ db: handle.db }); // no feedbackWebhookUrl

    const res = await app.inject({
      method: 'POST',
      url: '/api/feedback',
      payload: {
        message: 'Everything is great!',
        context: validContext(),
      },
    });

    expect(res.statusCode).toBe(503);
    const body = res.json();
    expect(body.error.code).toBe('FEEDBACK_NOT_CONFIGURED');
    expect(body.error.message).toBe('Feedback webhook destination is not configured on this server');
  });

  it('AC-7: POST /api/feedback outbound forward success returns 200 with success: true and timestamp', async () => {
    handle = createTestDb();
    let receivedPayload: unknown;

    mockServer = http.createServer((req, res) => {
      let data = '';
      req.on('data', (chunk) => {
        data += chunk;
      });
      req.on('end', () => {
        receivedPayload = JSON.parse(data);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      });
    });

    await new Promise<void>((resolve) => mockServer!.listen(0, '127.0.0.1', () => resolve()));
    const port = (mockServer.address() as AddressInfo).port;
    const webhookUrl = `http://127.0.0.1:${port}/webhook`;

    const app = buildServer({ db: handle.db, feedbackWebhookUrl: webhookUrl });

    const input: FeedbackInput = {
      message: 'Temperature sensor read high on step 2',
      context: validContext(),
    };

    const res = await app.inject({
      method: 'POST',
      url: '/api/feedback',
      payload: input,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(typeof body.timestamp).toBe('string');
    expect(new Date(body.timestamp).getTime()).not.toBeNaN();

    expect(receivedPayload).toBeDefined();
    const webhookData = receivedPayload as OutboundWebhookPayload;
    expect(webhookData.feedback.message).toBe(input.message);
    expect(webhookData.feedback.context).toEqual(input.context);
  });

  it('AC-8: Outbound webhook dual format (content, text, feedback)', () => {
    const input: FeedbackInput = {
      message: 'Line 1\nLine 2',
      context: {
        appVersion: '0.1.0',
        route: '/batches/b-999',
        viewport: { width: 375, height: 812 },
        batchId: 'b-999',
        batchName: 'Porter',
        batchStage: 'Fermenting',
      },
    };
    const now = '2026-09-07T18:00:00.000Z';
    const payload = buildOutboundPayload(input, now);

    expect(payload.content).toContain('📢 **TruchaBrew Feedback**');
    expect(payload.content).toContain('> Line 1\n> Line 2');
    expect(payload.content).toContain('App `0.1.0`');
    expect(payload.content).toContain('Route `/batches/b-999`');
    expect(payload.content).toContain('Viewport `375x812`');
    expect(payload.content).toContain('Batch: **Porter** (Fermenting)');

    expect(payload.text).toBe('TruchaBrew Feedback: Line 1\nLine 2');
    expect(payload.feedback).toEqual({
      message: input.message,
      timestamp: now,
      context: input.context,
    });
  });

  it('AC-9: POST /api/feedback delivery failure returns 502 FEEDBACK_DELIVERY_FAILED', async () => {
    handle = createTestDb();

    // 1. Destination responds with HTTP 500
    mockServer = http.createServer((_req, res) => {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal Webhook Error');
    });

    await new Promise<void>((resolve) => mockServer!.listen(0, '127.0.0.1', () => resolve()));
    const port = (mockServer.address() as AddressInfo).port;
    const webhookUrl = `http://127.0.0.1:${port}/fail`;

    const app = buildServer({ db: handle.db, feedbackWebhookUrl: webhookUrl });

    const res500 = await app.inject({
      method: 'POST',
      url: '/api/feedback',
      payload: {
        message: 'Test failure',
        context: validContext(),
      },
    });

    expect(res500.statusCode).toBe(502);
    expect(res500.json().error.code).toBe('FEEDBACK_DELIVERY_FAILED');
    expect(res500.json().error.message).toContain('status 500');

    // 2. Destination connection refused (dead port)
    const deadApp = buildServer({ db: handle.db, feedbackWebhookUrl: 'http://127.0.0.1:59999/dead' });
    const resRefused = await deadApp.inject({
      method: 'POST',
      url: '/api/feedback',
      payload: {
        message: 'Test network refused',
        context: validContext(),
      },
    });

    expect(resRefused.statusCode).toBe(502);
    expect(resRefused.json().error.code).toBe('FEEDBACK_DELIVERY_FAILED');
  });

  it('AC-10: Outbound delivery timeout returns 502 FEEDBACK_DELIVERY_FAILED without hanging server', async () => {
    handle = createTestDb();

    // Mock server that never responds
    mockServer = http.createServer((_req, _res) => {
      // Deliberately do not end or respond
    });

    await new Promise<void>((resolve) => mockServer!.listen(0, '127.0.0.1', () => resolve()));
    const port = (mockServer.address() as AddressInfo).port;
    const webhookUrl = `http://127.0.0.1:${port}/slow`;

    // Inject a 50ms timeout for tests so we do not wait 10 full seconds
    const app = buildServer({
      db: handle.db,
      feedbackWebhookUrl: webhookUrl,
      feedbackOptions: { timeoutMs: 50 },
    });

    const start = Date.now();
    const res = await app.inject({
      method: 'POST',
      url: '/api/feedback',
      payload: {
        message: 'Timeout test',
        context: validContext(),
      },
    });
    const elapsed = Date.now() - start;

    expect(res.statusCode).toBe(502);
    expect(res.json().error.code).toBe('FEEDBACK_DELIVERY_FAILED');
    expect(elapsed).toBeLessThan(1000); // completed fast without hanging
  });

  it('AC-11: Privacy guarantee: no forbidden telemetry', () => {
    const input: FeedbackInput = {
      message: 'Simple message without forbidden leaks',
      context: {
        appVersion: '0.1.0',
        route: '/inventory',
        viewport: { width: 1024, height: 768 },
      },
    };
    const now = new Date().toISOString();
    const payload = buildOutboundPayload(input, now);

    const json = JSON.stringify(payload);
    // Zero IP addresses (apart from normal schema texts), zero local paths, zero recipe bill
    expect(json).not.toContain('/home/');
    expect(json).not.toContain('/run/media/');
    expect(json).not.toContain('.db');
    expect(json).not.toContain('truchabrew.db');
    expect(json).not.toContain('fermentables');
    expect(json).not.toContain('hops');
    expect(json).not.toContain('yeasts');
    expect(json).not.toContain('ip');
    expect(json).not.toContain('clientIp');
  });
});
