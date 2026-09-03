import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// AC-41(c) — module-substitution proof that
// apps/api/src/routes/schemas.ts's `batchWriteBodySchema.properties.status.enum`
// is DERIVED from @truchabrew/calculations' BATCH_STATUSES at schemas.ts's own
// evaluation point (module load), not a hand-copied literal. This file exists
// on its own (M5_P1 spec §1.1 / §4 deviation 11) because the proof needs
// vi.resetModules() + vi.doMock() + a fresh dynamic import(), and vitest
// isolates the module registry per file — putting this beside the existing
// route suites would risk perturbing their already-resolved imports.
//
// AC-41(d) is binding on what this file must NOT do: it must not assert that
// mutating BATCH_STATUSES in memory at runtime widens an already-compiled AJV
// route schema. BATCH_STATUSES is `readonly BatchStatus[]`, and Fastify/ajv
// compile a route's JSON Schema once, at route registration — no by-reference
// mutation makes an already-compiled validator live. That is not attempted
// here. The proof below is instead at schemas.ts's own evaluation point
// (module load), via substituting the module it imports from, then re-
// importing it fresh — the actual mechanism by which the enum is derived.
//
// M5_P2 spec §1.5 — NARROW NAMED EXCEPTION, forced: 'Conditioning' is now a
// REAL member of BATCH_STATUSES, so the original synthetic-status
// substitution ('Conditioning') would collide and the length assertions
// (4 substituted / 3 control) are now wrong. The synthetic status is changed
// to 'Archived' — a value that is not a member of BATCH_STATUSES under any
// milestone — and the lengths become 6 (substituted: 5 real + 1 synthetic)
// and 5 (control: the real five-status set). A new describe block below adds
// AC-25's CARBONATION_TYPES derivation proof, following the identical
// substituted/control shape.

describe('AC-41(c): batchWriteBodySchema.status.enum is derived, not hand-copied', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock('@truchabrew/calculations');
    vi.resetModules();
  });

  it('substituted case: widening BATCH_STATUSES widens the freshly re-imported enum', async () => {
    vi.doMock('@truchabrew/calculations', async () => {
      const actual = await vi.importActual<typeof import('@truchabrew/calculations')>(
        '@truchabrew/calculations',
      );
      return {
        ...actual,
        BATCH_STATUSES: [...actual.BATCH_STATUSES, 'Archived'],
      };
    });
    vi.resetModules();

    const { batchWriteBodySchema } = await import('../src/routes/schemas');

    expect(batchWriteBodySchema.properties.status.enum).toContain('Archived');
    expect(batchWriteBodySchema.properties.status.enum).toHaveLength(6);
  });

  it('control case: an unsubstituted fresh import keeps the enum at its real length-5 set', async () => {
    const { batchWriteBodySchema } = await import('../src/routes/schemas');

    expect(batchWriteBodySchema.properties.status.enum).not.toContain('Archived');
    expect(batchWriteBodySchema.properties.status.enum).toHaveLength(5);
  });
});

describe('AC-25: the carbonation enum is derived, not hand-written', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock('@truchabrew/calculations');
    vi.resetModules();
  });

  it('substituted case: widening CARBONATION_TYPES widens the freshly re-imported enum', async () => {
    vi.doMock('@truchabrew/calculations', async () => {
      const actual = await vi.importActual<typeof import('@truchabrew/calculations')>(
        '@truchabrew/calculations',
      );
      return {
        ...actual,
        CARBONATION_TYPES: [...actual.CARBONATION_TYPES, 'BottleConditioned'],
      };
    });
    vi.resetModules();

    const { batchWriteBodySchema } = await import('../src/routes/schemas');

    // enum carries the four/five real members PLUS the literal `null` (the
    // schema's `type: ['string', 'null']` form — see schemas.ts's comment on
    // why `anyOf`-with-null is deliberately not used here).
    expect(batchWriteBodySchema.properties.carbonationType.enum).toContain('BottleConditioned');
    expect(batchWriteBodySchema.properties.carbonationType.enum).toHaveLength(6);
  });

  it('control case: an unsubstituted fresh import keeps the enum at its real length-5 set (4 + null), without BottleConditioned', async () => {
    const { batchWriteBodySchema } = await import('../src/routes/schemas');

    expect(batchWriteBodySchema.properties.carbonationType.enum).not.toContain('BottleConditioned');
    expect(batchWriteBodySchema.properties.carbonationType.enum).toHaveLength(5);
  });
});
