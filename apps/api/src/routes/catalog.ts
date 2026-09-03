import type { FastifyInstance } from 'fastify';
import type { Db } from '../db/client';
import { getCatalog } from '../repositories/catalogRepository';

export function registerCatalogRoutes(app: FastifyInstance, db: Db): void {
  app.get('/api/catalog', async () => {
    return getCatalog(db);
  });
}
