import type { FastifyInstance } from 'fastify';
import type { Db } from '../db/client';

export function registerHealthRoutes(app: FastifyInstance, db: Db): void {
  app.get('/api/health', async () => {
    const row = db.$client.pragma('foreign_keys', { simple: true }) as number;
    return { ok: true, foreignKeys: row };
  });
}
