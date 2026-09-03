import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import type { CalculatedStats } from '@truchabrew/shared-types';
import { statsToStyleVitals } from '../src/utils/styleTargets';

// A full CalculatedStats — every field populated so the adapter's pass-through
// has concrete inputs. `og`/`fg`/`abv`/`ibu`/`srm` are the five the adapter
// reads; the rest are canonical-metric filler required by the type.
function makeStats(overrides: Partial<Pick<CalculatedStats, 'og' | 'fg' | 'abv' | 'ibu' | 'srm'>> = {}): CalculatedStats {
  return {
    og: 1.06,
    fg: 1.012,
    abv: 6.2,
    ibu: 55,
    srm: 12,
    ebc: 1,
    buGu: 1,
    rbr: 1,
    totalGrainKg: 5,
    totalHopG: 60,
    mashWaterL: 12,
    spargeWaterL: 8,
    totalWaterL: 20,
    preBoilVolumeL: 24,
    preBoilGravity: 1.05,
    attenuationPct: 80,
    postBoilVolumeL: 19,
    ...overrides,
  };
}

describe('statsToStyleVitals (AC-14 / AC-15 / RA-P3-2)', () => {
  it('AC-14: passes the five vitals through unchanged (no conversion)', () => {
    const stats = makeStats({ og: 1.062, fg: 1.014, abv: 6.4, ibu: 48, srm: 9 });
    expect(statsToStyleVitals(stats)).toEqual({ og: 1.062, fg: 1.014, abv: 6.4, ibu: 48, srm: 9 });
  });

  it('AC-14: reflects the exact numeric values given, byte-for-byte', () => {
    const stats = makeStats({ og: 1.085, fg: 1.02, abv: 8.5, ibu: 70, srm: 22 });
    const out = statsToStyleVitals(stats);
    expect(out.og).toBe(1.085);
    expect(out.fg).toBe(1.02);
    expect(out.abv).toBe(8.5);
    expect(out.ibu).toBe(70);
    expect(out.srm).toBe(22);
  });

  it('AC-14: does not mutate its source', () => {
    const stats = makeStats({ og: 1.06, fg: 1.012, abv: 6.2, ibu: 55, srm: 12 });
    const snapshot = { ...stats };
    statsToStyleVitals(stats);
    expect(stats).toEqual(snapshot);
  });

  it('AC-15: styleTargets.ts references/imports no unit-conversion function (RA-P3-2)', () => {
    const srcPath = path.resolve(__dirname, '../src/utils/styleTargets.ts');
    const content = fs.readFileSync(srcPath, 'utf-8');
    // No plato/sg/ebc/srm conversion helper is imported, referenced, or called.
    expect(content).not.toMatch(/platoToSg|sgToPlato|ebcToSrm|srmToEbc/);
  });
});
