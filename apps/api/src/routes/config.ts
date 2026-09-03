import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import type { UserConfig, UserConfigInput } from '@truchabrew/shared-types';
import type { Db } from '../db/client';
import { userConfig } from '../db/schema';

// ---------------------------------------------------------------------------
// Domain mapping — single 'default' row (M7_P1 spec §1.3, "New Files":
// apps/api/src/routes/config.ts). No separate repository file — a
// single-row config table has no list/CRUD surface to warrant one.
// ---------------------------------------------------------------------------

type UserConfigRow = typeof userConfig.$inferSelect;

function rowToDomain(row: UserConfigRow): UserConfig {
  return {
    id: row.id,
    unitSystem: row.unitSystem as UserConfig['unitSystem'],
    gravityUnit: row.gravityUnit as UserConfig['gravityUnit'],
    temperatureUnit: row.temperatureUnit as UserConfig['temperatureUnit'],
    ibuFormula: row.ibuFormula as UserConfig['ibuFormula'],
    abvFormula: row.abvFormula as UserConfig['abvFormula'],
  };
}

const DEFAULT_CONFIG_ROW = {
  id: 'default',
  unitSystem: 'metric',
  gravityUnit: 'sg',
  temperatureUnit: 'celsius',
  ibuFormula: 'tinseth',
  abvFormula: 'simple',
};

/**
 * Returns the 'default' row, seeding it in place if migration 0010's own
 * INSERT OR IGNORE somehow never ran (e.g. a database opened via
 * openDatabase() without runMigrations() — several test helpers in this
 * repo do exactly that, per M2_P1's fixtures precedent). Idempotent.
 */
function getOrCreateDefaultConfig(db: Db): UserConfigRow {
  const existing = db.select().from(userConfig).where(eq(userConfig.id, 'default')).get();
  if (existing) return existing;

  const now = new Date().toISOString();
  db.insert(userConfig)
    .values({ ...DEFAULT_CONFIG_ROW, createdAt: now, updatedAt: now })
    .onConflictDoNothing({ target: userConfig.id })
    .run();
  return db.select().from(userConfig).where(eq(userConfig.id, 'default')).get()!;
}

// ---------------------------------------------------------------------------
// JSON schema — inline here rather than in routes/schemas.ts (M7_P1 spec
// §1.3's Modified-files table does not list schemas.ts; every enum this
// route validates is local to this new file's own concerns).
// ---------------------------------------------------------------------------

const unitSystemEnum = ['metric', 'us', 'imperial'];
const gravityUnitEnum = ['sg', 'plato'];
const temperatureUnitEnum = ['celsius', 'fahrenheit'];
const ibuFormulaEnum = ['tinseth', 'rager', 'garetz'];
const abvFormulaEnum = ['simple', 'balling'];

const configUpdateBodySchema = {
  type: 'object',
  // All optional (UserConfigInput) — a PUT may update any subset of fields;
  // an empty body is a legal no-op update (AC-7 does not require every
  // field to be present).
  additionalProperties: false,
  properties: {
    unitSystem: { type: 'string', enum: unitSystemEnum },
    gravityUnit: { type: 'string', enum: gravityUnitEnum },
    temperatureUnit: { type: 'string', enum: temperatureUnitEnum },
    ibuFormula: { type: 'string', enum: ibuFormulaEnum },
    abvFormula: { type: 'string', enum: abvFormulaEnum },
  },
};

export function registerConfigRoutes(app: FastifyInstance, db: Db): void {
  // AC-6: GET /api/config — returns default UserConfig object, status 200.
  app.get('/api/config', async () => {
    return rowToDomain(getOrCreateDefaultConfig(db));
  });

  // AC-7/AC-8: PUT /api/config — updates and returns the updated object with
  // status 200; an invalid enum value anywhere in the body is 400 (ajv
  // validation runs before the handler, same mechanism as every other route
  // family in this repo).
  app.put<{ Body: UserConfigInput }>(
    '/api/config',
    { schema: { body: configUpdateBodySchema } },
    async (request) => {
      getOrCreateDefaultConfig(db); // ensure the row exists before updating
      const input = request.body;
      db.update(userConfig)
        .set({
          ...(input.unitSystem !== undefined ? { unitSystem: input.unitSystem } : {}),
          ...(input.gravityUnit !== undefined ? { gravityUnit: input.gravityUnit } : {}),
          ...(input.temperatureUnit !== undefined ? { temperatureUnit: input.temperatureUnit } : {}),
          ...(input.ibuFormula !== undefined ? { ibuFormula: input.ibuFormula } : {}),
          ...(input.abvFormula !== undefined ? { abvFormula: input.abvFormula } : {}),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(userConfig.id, 'default'))
        .run();
      const updated = db.select().from(userConfig).where(eq(userConfig.id, 'default')).get()!;
      return rowToDomain(updated);
    },
  );
}
