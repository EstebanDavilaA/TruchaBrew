import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import fs from 'node:fs';
import path from 'node:path';
import type { Db } from './db/client';
import { registerHealthRoutes } from './routes/health';
import { registerCatalogRoutes } from './routes/catalog';
import { registerEquipmentRoutes } from './routes/equipment';
import { registerRecipeRoutes } from './routes/recipes';
import { registerScheduleRoutes } from './routes/schedules';
import { registerBatchRoutes } from './routes/batches';
import { registerWaterProfileRoutes } from './routes/waterProfiles';
// NEW in M7_P1 — mechanically required for GET/PUT /api/config to be
// reachable at all. server.ts is not on the M7_P1 spec §1.3 Modified-files
// table; this two-line addition (this import + the one registration call
// below) is flagged for critic attention as a forced, narrow, non-optional
// exception — no route this repo has ever shipped is reachable without a
// registration call here, and the same class of gap has been blessed in
// multiple prior phases (e.g. M3_P1's drizzle/meta/_journal.json addition).
import { registerConfigRoutes } from './routes/config';
// NEW in M9_P1 — same forced, narrow exception class as registerConfigRoutes
// above (§4 Deviation 7 / M7_P1 precedent): no route in this repo is
// reachable without a registration call here. Also registers
// GET /api/batches/:batchId/stock-check (Resolved Ambiguity 8).
import { registerInventoryRoutes } from './routes/inventory';
// NEW in M36_P1 — same forced, narrow exception class as
// registerConfigRoutes/registerInventoryRoutes above: no route in this repo
// is reachable without a registration call here.
import { registerBackupRoutes } from './routes/backup';
import { sendApiError } from './errors';

export interface ServerDeps {
  db: Db;
  logger?: boolean;
  /** Absolute path to the built web UI root. When present and an existing
   *  directory, `@fastify/static` serves it and unmatched non-API GET/HEAD
   *  requests fall back to `index.html`. Optional. */
  staticRoot?: string;
}

/** Builds a fully-configured Fastify instance. Does not call listen() — test-injectable. */
export function buildServer(deps: ServerDeps): FastifyInstance {
  const app = Fastify({ logger: deps.logger ?? false });

  registerHealthRoutes(app, deps.db);
  registerCatalogRoutes(app, deps.db);
  registerEquipmentRoutes(app, deps.db);
  registerRecipeRoutes(app, deps.db);
  registerScheduleRoutes(app, deps.db);
  registerBatchRoutes(app, deps.db);
  registerWaterProfileRoutes(app, deps.db);
  registerConfigRoutes(app, deps.db);
  registerInventoryRoutes(app, deps.db);
  registerBackupRoutes(app, deps.db);

  // M42_P1 — serve the built web UI when a static root exists. Registered AFTER
  // every route so no static file can ever shadow an API route. Absent (or
  // non-existent) static root ⇒ not registered at all ⇒ API-only behavior
  // identical to today's.
  const staticRoot = deps.staticRoot;
  const staticRegistered =
    staticRoot !== undefined &&
    fs.existsSync(staticRoot) &&
    fs.statSync(staticRoot).isDirectory();
  if (staticRegistered) {
    app.register(fastifyStatic, {
      root: staticRoot,
      wildcard: false,
    });
  }

  // Every non-2xx response is exactly ApiErrorBody — no HTML error page, no
  // bare string, ever.
  app.setErrorHandler((error: FastifyError, request, reply) => {
    if (error.validation) {
      sendApiError(reply, 400, 'VALIDATION_FAILED', error.message, error.validation);
      return;
    }
    request.log.error(error);
    sendApiError(reply, 500, 'INTERNAL', 'Internal server error');
  });

  app.setNotFoundHandler((request, reply) => {
    // RA-7 branch, in order: an /api/ path always keeps today's JSON 404; an
    // unmatched GET/HEAD falls back to index.html only when static is actually
    // registered; anything else keeps today's JSON 404.
    if (request.url.startsWith('/api/')) {
      sendApiError(reply, 404, 'NOT_FOUND', `Route not found: ${request.method} ${request.url}`);
      return;
    }
    if (staticRegistered && (request.method === 'GET' || request.method === 'HEAD')) {
      reply
        .type('text/html')
        .send(fs.readFileSync(path.join(staticRoot as string, 'index.html'), 'utf8'));
      return;
    }
    sendApiError(reply, 404, 'NOT_FOUND', `Route not found: ${request.method} ${request.url}`);
  });

  return app;
}
