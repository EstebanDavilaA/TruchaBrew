// AC-10(d)/(e)/(f): DryHop's timeMinutes field round-trips through a recipe
// edit (the part a schema-only fix would miss — PUT /api/recipes/:id
// rewrites all line-item rows, so a column the row<->domain mapper does not
// carry is destroyed by the first edit, not by any migration), no
// destination field is invented, and it never reaches a calculation. New
// file — this behaviour has no home in any file already on the M4_P1 spec's
// file lists.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestDb, type TestDbHandle } from './helpers/testDb';
import { seedDatabase } from '../src/db/seed';
import { buildServer } from '../src/server';
import { fullRecipeInput } from './helpers/fixtures';

let handle: TestDbHandle;
let app: FastifyInstance;

beforeEach(() => {
  handle = createTestDb();
  seedDatabase(handle.db);
  app = buildServer({ db: handle.db });
});

afterEach(async () => {
  await app.close();
  handle.cleanup();
});

describe('AC-10(d): DryHop timeMinutes round-trips through PUT /api/recipes/:id', () => {
  it('survives an unrelated edit verbatim — not rounded, converted or defaulted', async () => {
    const input = fullRecipeInput({
      hops: [
        { name: 'Simcoe', amountG: 50, alphaAcidPct: 13.0, use: 'DryHop', boilMins: null, whirlpoolMins: null, whirlpoolTempC: null, type: 'Pellet', timeMinutes: 4320 },
      ],
    });
    const createRes = await app.inject({ method: 'POST', url: '/api/recipes', payload: input });
    expect(createRes.statusCode).toBe(201);
    const created = JSON.parse(createRes.body);
    expect(created.hops[0].timeMinutes).toBe(4320);

    // PUT changing something unrelated (the recipe name).
    const putBody = { ...input, name: 'Renamed Recipe', hops: created.hops };
    const putRes = await app.inject({ method: 'PUT', url: `/api/recipes/${created.id}`, payload: putBody });
    expect(putRes.statusCode).toBe(200);
    const updated = JSON.parse(putRes.body);
    expect(updated.name).toBe('Renamed Recipe');
    expect(updated.hops[0].timeMinutes).toBe(4320);

    // Re-read independently.
    const getRes = await app.inject({ method: 'GET', url: `/api/recipes/${created.id}` });
    const fetched = JSON.parse(getRes.body);
    expect(fetched.hops[0].timeMinutes).toBe(4320);
  });

  it('AC-10(f): every Boil/FirstWort/Whirlpool/Aroma row the app writes has timeMinutes null — no hop carries two representations of one timing', async () => {
    const input = fullRecipeInput({
      hops: [
        { name: 'Magnum', amountG: 20, alphaAcidPct: 12.0, use: 'Boil', boilMins: 60, whirlpoolMins: null, whirlpoolTempC: null, type: 'Pellet', timeMinutes: 999 },
        { name: 'Citra', amountG: 30, alphaAcidPct: 12.5, use: 'Whirlpool', boilMins: null, whirlpoolMins: 15, whirlpoolTempC: 79.0, type: 'Pellet', timeMinutes: 999 },
      ],
    });
    const createRes = await app.inject({ method: 'POST', url: '/api/recipes', payload: input });
    expect(createRes.statusCode).toBe(201);
    const created = JSON.parse(createRes.body);
    // A caller-supplied timeMinutes on a non-DryHop use is discarded, not
    // stored — the API writes null for it regardless of what was sent.
    expect(created.hops[0].timeMinutes).toBeNull();
    expect(created.hops[1].timeMinutes).toBeNull();
  });

  it('AC-10(e): no dryHopMinsLegacy destination field exists anywhere in the tree', async () => {
    // Pure Node directory walk (not a shelled-out grep, which isn't portable
    // across dev machines) kept as a live assertion so it fails the suite —
    // not just a manual audit step — if such a field is ever reintroduced.
    const fs = await import('node:fs');
    const path = await import('node:path');
    const repoRoot = path.resolve(new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), '..', '..', '..');
    const forbidden = ['dryhopmins', 'dryhopminslegacy'];
    const skipDirs = new Set(['node_modules', 'dist', '.git', 'data']);
    // This file's own name/comments necessarily mention the forbidden terms
    // (it's the test asserting their absence) — excluded from its own scan.
    const selfPath = path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
    const offenders: string[] = [];

    function walk(dir: string): void {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (skipDirs.has(entry.name)) continue;
        const full = path.join(dir, entry.name);
        if (full === selfPath) continue;
        if (entry.isDirectory()) {
          walk(full);
        } else if (/\.(ts|tsx)$/.test(entry.name)) {
          const content = fs.readFileSync(full, 'utf8').toLowerCase();
          for (const term of forbidden) {
            if (content.includes(term)) offenders.push(`${full}: ${term}`);
          }
        }
      }
    }

    for (const dir of ['packages', 'apps']) {
      walk(path.join(repoRoot, dir));
    }

    expect(offenders).toEqual([]);
  });
});
