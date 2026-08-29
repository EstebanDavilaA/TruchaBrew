// M15_P1 spec §2.2 — integration tests for Planning mode's 1-click bulk
// inventory deduction and per-item checkoff reversal. Same mocking
// convention as StockCheckPanel.test.tsx (M9_P2): fetch is stubbed for
// /api/config only, api/client's checkoff functions are mocked directly.
//
// PARTIAL RETIREMENT (M19_P1 spec §1.7 / §2.2): the AC-1 and AC-3 tests, and
// two of the four AC-2 tests, drove the panel through the checkbox-based
// interaction model (`stock-check-checkbox-*` testids), which was removed by
// design when StockCheckPanel was rebuilt around per-item Deduct/Undo
// buttons. That coverage is superseded by
// apps/web/test/StockCheckPanel.test.tsx. Only the two AC-2 tests below that
// are NOT subsumed by the new file — the bulk button's in-flight disable
// lifecycle and its absence when editable:false — remain, unchanged.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import type { BatchCheckoffState, UserConfig } from '@truchabrew/shared-types';
import { StockCheckPanel } from '../src/components/StockCheckPanel';
import { ConfigProvider } from '../src/context/ConfigContext';

const DEFAULT_TEST_CONFIG: UserConfig = {
  id: 'default',
  unitSystem: 'metric',
  gravityUnit: 'sg',
  temperatureUnit: 'celsius',
  ibuFormula: 'tinseth',
  abvFormula: 'simple',
};

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(JSON.stringify(body)),
  } as Response;
}

vi.mock('../src/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/api/client')>();
  return {
    ...actual,
    getBatchCheckoff: vi.fn(),
    checkoffInventoryItem: vi.fn(),
    reverseInventoryCheckoff: vi.fn(),
  };
});

import { getBatchCheckoff, checkoffInventoryItem, reverseInventoryCheckoff } from '../src/api/client';

const mockedGetBatchCheckoff = vi.mocked(getBatchCheckoff);
const mockedCheckoffInventoryItem = vi.mocked(checkoffInventoryItem);
const mockedReverseInventoryCheckoff = vi.mocked(reverseInventoryCheckoff);

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === '/api/config') return Promise.resolve(jsonResponse(DEFAULT_TEST_CONFIG));
      return Promise.reject(new Error(`Unexpected fetch call in StockCheckDeduction.test.tsx: ${url}`));
    }),
  );
  mockedGetBatchCheckoff.mockReset();
  mockedCheckoffInventoryItem.mockReset();
  mockedReverseInventoryCheckoff.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function line(overrides: Partial<BatchCheckoffState['lines'][number]>): BatchCheckoffState['lines'][number] {
  return {
    category: 'Fermentable',
    displayName: 'Pale Ale Malt',
    nameKey: 'pale ale malt',
    unit: 'kg',
    requiredAmount: 5.5,
    matched: true,
    inventoryItemId: 'inv-1',
    inventoryUnit: 'kg',
    onHand: 10,
    unitMismatch: false,
    shortfall: 0,
    sufficient: true,
    checkable: true,
    checked: false,
    openTransactionId: null,
    checkedAmount: null,
    checkedCostPerUnit: null,
    checkedAt: null,
    ...overrides,
  };
}

function threeItemState(overrides: Partial<BatchCheckoffState> = {}): BatchCheckoffState {
  return {
    lines: [
      line({ category: 'Fermentable', displayName: 'Pale Ale Malt', nameKey: 'pale ale malt', unit: 'kg', inventoryItemId: 'inv-1' }),
      line({ category: 'Hop', displayName: 'Citra', nameKey: 'citra', unit: 'g', requiredAmount: 50, inventoryItemId: 'inv-2', inventoryUnit: 'g', onHand: 100 }),
      line({ category: 'Yeast', displayName: 'SafAle US-05', nameKey: 'safale us-05', unit: 'pkg', requiredAmount: 1, inventoryItemId: 'inv-3', inventoryUnit: 'pkg', onHand: 3 }),
    ],
    requirementCount: 3,
    matchedCount: 3,
    comparableCount: 3,
    unmatchedCount: 0,
    unitMismatchCount: 0,
    shortfallCount: 0,
    hasShortfall: false,
    checkableCount: 3,
    checkedCount: 0,
    allCheckedOff: false,
    stage: 'Planning',
    editable: true,
    ...overrides,
  };
}

function renderPanel(batchId = 'batch-1') {
  return render(
    <ConfigProvider>
      <StockCheckPanel batchId={batchId} />
    </ConfigProvider>,
  );
}

describe('AC-2: bulk "Deduct All from Inventory"', () => {
  it('the bulk button disables while in flight and re-enables after; disabled entirely once fully checked', async () => {
    mockedGetBatchCheckoff.mockResolvedValue(threeItemState());
    let resolveFirst: (v: BatchCheckoffState) => void = () => {};
    mockedCheckoffInventoryItem.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve;
        }),
    );
    renderPanel();
    await waitFor(() => screen.getByTestId('stock-check-header'));

    const btn = screen.getByTestId('stock-check-deduct-all-btn') as HTMLButtonElement;
    fireEvent.click(btn);
    await waitFor(() => expect(btn.disabled).toBe(true));

    resolveFirst(threeItemState({ checkedCount: 3, allCheckedOff: true, lines: threeItemState().lines.map((l) => ({ ...l, checked: true })) }));

    await waitFor(() => expect(screen.getByTestId('stock-check-deduct-all-btn')).toBeDisabled());
  });

  it('does not render the bulk button when editable is false', async () => {
    mockedGetBatchCheckoff.mockResolvedValue(threeItemState({ editable: false, stage: 'Brewing' }));
    renderPanel();
    await waitFor(() => screen.getByTestId('stock-check-header'));
    expect(screen.queryByTestId('stock-check-deduct-all-btn')).not.toBeInTheDocument();
  });
});
