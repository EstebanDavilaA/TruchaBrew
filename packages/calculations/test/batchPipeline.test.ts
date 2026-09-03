import { describe, it, expect } from 'vitest';
import type { BatchStatus } from '@truchabrew/shared-types';
import { BATCH_STATUSES, BATCH_STATUS_TRANSITIONS, canTransitionBatchStatus, allowedNextStatuses } from '../src';

describe('AC-1: status inventory is a closed list', () => {
  it('BATCH_STATUSES is exactly [Planning, Brewing, Fermenting, Conditioning, Completed] in that order', () => {
    expect(BATCH_STATUSES).toEqual(['Planning', 'Brewing', 'Fermenting', 'Conditioning', 'Completed']);
  });

  it('BATCH_STATUS_TRANSITIONS has exactly those five keys, and each value contains its own key', () => {
    expect(Object.keys(BATCH_STATUS_TRANSITIONS).sort()).toEqual(
      ['Brewing', 'Completed', 'Conditioning', 'Fermenting', 'Planning'],
    );
    for (const status of BATCH_STATUSES) {
      expect(BATCH_STATUS_TRANSITIONS[status]).toContain(status);
    }
  });
});

describe('AC-2: transition matrix, all 25 ordered pairs', () => {
  const allPairs: [BatchStatus, BatchStatus][] = [];
  for (const from of BATCH_STATUSES) {
    for (const to of BATCH_STATUSES) {
      allPairs.push([from, to]);
    }
  }

  it('all 25 ordered pairs are allowed (Brewfather-style free transitions)', () => {
    expect(allPairs.length).toBe(25);
    for (const [from, to] of allPairs) {
      expect(canTransitionBatchStatus(from, to)).toBe(true);
    }
  });

  it('an unrecognised `from` returns false without throwing', () => {
    expect(() => canTransitionBatchStatus('Archived' as BatchStatus, 'Planning')).not.toThrow();
    expect(canTransitionBatchStatus('Archived' as BatchStatus, 'Planning')).toBe(false);
    expect(canTransitionBatchStatus('' as BatchStatus, 'Planning')).toBe(false);
  });

  it('an unrecognised `to` returns false without throwing', () => {
    expect(() => canTransitionBatchStatus('Planning', 'Archived' as BatchStatus)).not.toThrow();
    expect(canTransitionBatchStatus('Planning', 'Archived' as BatchStatus)).toBe(false);
    expect(canTransitionBatchStatus('Brewing', '' as BatchStatus)).toBe(false);
  });
});

describe('AC-3: allowedNextStatuses exact arrays', () => {
  it('every valid status returns all BATCH_STATUSES', () => {
    for (const status of BATCH_STATUSES) {
      expect(allowedNextStatuses(status)).toEqual(BATCH_STATUSES);
    }
  });
  it('an unrecognised value -> [], never undefined, never a throw', () => {
    expect(() => allowedNextStatuses('Archived' as BatchStatus)).not.toThrow();
    const result = allowedNextStatuses('Archived' as BatchStatus);
    expect(result).toEqual([]);
    expect(result).not.toBeUndefined();
  });
});

describe('AC-16: batchPipeline.ts is a pure module', () => {
  it('imports nothing from apps/, drizzle-orm, fastify or react, and reads no clock/random/network', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const source = fs.readFileSync(path.join(__dirname, '../src/batchPipeline.ts'), 'utf-8');
    expect(source).not.toMatch(/Date\.now|new Date\(\)|Math\.random|randomUUID|fetch\(/);
    expect(source).not.toMatch(/from ['"]apps\//);
    expect(source).not.toMatch(/from ['"]drizzle-orm/);
    expect(source).not.toMatch(/from ['"]fastify/);
    expect(source).not.toMatch(/from ['"]react/);
  });
});
