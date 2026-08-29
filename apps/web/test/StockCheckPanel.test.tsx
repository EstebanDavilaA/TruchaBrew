import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import type { BatchCheckoffState, UserConfig } from '@truchabrew/shared-types';
import { StockCheckPanel } from '../src/components/StockCheckPanel';
import { ApiClientError } from '../src/api/client';
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

/** Same stubConfigFetch pattern already used by EquipmentManager.test.tsx. */
function stubConfigFetch(config: Partial<UserConfig> = {}) {
  const testConfig = { ...DEFAULT_TEST_CONFIG, ...config };
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === '/api/config') return Promise.resolve(jsonResponse(testConfig));
      return Promise.reject(new Error(`Unexpected fetch call in StockCheckPanel.test.tsx: ${url}`));
    }),
  );
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
      return Promise.reject(new Error(`Unexpected fetch call in StockCheckPanel.test.tsx: ${url}`));
    }),
  );
  mockedGetBatchCheckoff.mockReset();
  mockedCheckoffInventoryItem.mockReset();
  mockedReverseInventoryCheckoff.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** The M9_P2 spec §3 shared fixture's exact BatchCheckoffState, all unchecked. */
function fixtureState(overrides: Partial<BatchCheckoffState> = {}): BatchCheckoffState {
  return {
    lines: [
      { category: 'Fermentable', displayName: 'Pale Ale Malt', nameKey: 'pale ale malt', unit: 'kg', requiredAmount: 5.5, matched: true, inventoryItemId: 'inv-1', inventoryUnit: 'kg', onHand: 4.0, unitMismatch: false, shortfall: 1.5, sufficient: false, checkable: true, checked: false, openTransactionId: null, checkedAmount: null, checkedCostPerUnit: null, checkedAt: null },
      { category: 'Fermentable', displayName: 'Munich Malt', nameKey: 'munich malt', unit: 'kg', requiredAmount: 0.5, matched: true, inventoryItemId: 'inv-2', inventoryUnit: 'kg', onHand: 0.0, unitMismatch: false, shortfall: 0.5, sufficient: false, checkable: true, checked: false, openTransactionId: null, checkedAmount: null, checkedCostPerUnit: null, checkedAt: null },
      { category: 'Hop', displayName: 'Citra', nameKey: 'citra', unit: 'g', requiredAmount: 50, matched: true, inventoryItemId: 'inv-3', inventoryUnit: 'g', onHand: 50, unitMismatch: false, shortfall: 0, sufficient: true, checkable: true, checked: false, openTransactionId: null, checkedAmount: null, checkedCostPerUnit: null, checkedAt: null },
      { category: 'Yeast', displayName: 'SafAle US-05', nameKey: 'safale us-05', unit: 'pkg', requiredAmount: 3, matched: true, inventoryItemId: 'inv-4', inventoryUnit: 'pkg', onHand: 2, unitMismatch: false, shortfall: 1, sufficient: false, checkable: true, checked: false, openTransactionId: null, checkedAmount: null, checkedCostPerUnit: null, checkedAt: null },
      { category: 'Misc', displayName: 'Gypsum', nameKey: 'gypsum', unit: 'g', requiredAmount: 4, matched: true, inventoryItemId: 'inv-5', inventoryUnit: 'g', onHand: -0.5, unitMismatch: false, shortfall: 4.5, sufficient: false, checkable: true, checked: false, openTransactionId: null, checkedAmount: null, checkedCostPerUnit: null, checkedAt: null },
      { category: 'Misc', displayName: 'Whirlfloc', nameKey: 'whirlfloc', unit: 'each', requiredAmount: 1, matched: false, inventoryItemId: null, inventoryUnit: null, onHand: null, unitMismatch: false, shortfall: null, sufficient: null, checkable: false, checked: false, openTransactionId: null, checkedAmount: null, checkedCostPerUnit: null, checkedAt: null },
      { category: 'Misc', displayName: 'Lactic Acid', nameKey: 'lactic acid', unit: 'ml', requiredAmount: 2, matched: true, inventoryItemId: 'inv-6', inventoryUnit: 'g', onHand: 100, unitMismatch: true, shortfall: null, sufficient: null, checkable: false, checked: false, openTransactionId: null, checkedAmount: null, checkedCostPerUnit: null, checkedAt: null },
    ],
    requirementCount: 7,
    matchedCount: 6,
    comparableCount: 5,
    unmatchedCount: 1,
    unitMismatchCount: 1,
    shortfallCount: 4,
    hasShortfall: true,
    checkableCount: 5,
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

describe('AC-10: itemized checkoff table renders with the four pinned column headers', () => {
  it('renders Item / Recipe / Stock Status / Action headers and 7 line rows, no NaN/undefined/null text', async () => {
    mockedGetBatchCheckoff.mockResolvedValue(fixtureState());
    renderPanel();

    await waitFor(() => screen.getByTestId('stock-check-table'));
    const table = screen.getByTestId('stock-check-table');
    const headerRow = within(table).getAllByRole('columnheader');
    expect(headerRow.map((h) => h.textContent)).toEqual(['Item', 'Recipe', 'Stock Status', 'Action']);

    expect(screen.getAllByTestId(/^stock-check-line-/)).toHaveLength(7);
    expect(screen.getByTestId('stock-check-line-pale ale malt')).toHaveTextContent('Short 1.50 kg');
    expect(screen.getByTestId('stock-check-line-citra')).toHaveTextContent('In stock');
    expect(screen.getByTestId('stock-check-line-whirlfloc')).toHaveTextContent('Not tracked');
    const lacticAcidLine = screen.getByTestId('stock-check-line-lactic acid');
    expect(lacticAcidLine.textContent).toContain('g');
    expect(lacticAcidLine.textContent).toContain('ml');

    expect(screen.getByTestId('stock-check-header')).toHaveTextContent('4 of 7 ingredients short');
    expect(document.body.textContent).not.toMatch(/NaN|undefined|null/);
  });

  it('under unitSystem: us, every amount renders in lb/oz, no mixed metric units', async () => {
    stubConfigFetch({ unitSystem: 'us' });
    mockedGetBatchCheckoff.mockResolvedValue(fixtureState());
    renderPanel();

    await waitFor(() => screen.getByTestId('stock-check-header'));

    const paleAleMaltLine = screen.getByTestId('stock-check-line-pale ale malt');
    expect(paleAleMaltLine).toHaveTextContent('12.13 lb');
    expect(paleAleMaltLine).toHaveTextContent('8.82 lb');
    expect(paleAleMaltLine).toHaveTextContent('Short 3.31 lb');
    expect(paleAleMaltLine.textContent).not.toMatch(/kg/);

    const gypsumLine = screen.getByTestId('stock-check-line-gypsum');
    expect(gypsumLine).toHaveTextContent('Short 0.16 oz');
    expect(gypsumLine.textContent).not.toMatch(/(?<![a-zA-Z])g(?![a-zA-Z])/);

    expect(document.body.textContent).not.toMatch(/NaN|undefined|null/);
  });
});

describe('AC-10 (facet): exactly one GET on mount, and empty/error states', () => {
  it('issues exactly one GET /api/batches/:batchId/checkoff, re-fetching only when batchId changes', async () => {
    mockedGetBatchCheckoff.mockResolvedValue(fixtureState());
    const { rerender } = render(
      <ConfigProvider>
        <StockCheckPanel batchId="batch-1" />
      </ConfigProvider>,
    );
    await waitFor(() => expect(mockedGetBatchCheckoff).toHaveBeenCalledTimes(1));

    rerender(
      <ConfigProvider>
        <StockCheckPanel batchId="batch-1" />
      </ConfigProvider>,
    );
    expect(mockedGetBatchCheckoff).toHaveBeenCalledTimes(1);

    rerender(
      <ConfigProvider>
        <StockCheckPanel batchId="batch-2" />
      </ConfigProvider>,
    );
    await waitFor(() => expect(mockedGetBatchCheckoff).toHaveBeenCalledTimes(2));
    expect(mockedGetBatchCheckoff).toHaveBeenLastCalledWith('batch-2');
  });

  it('requirementCount === 0 renders the empty-state string, zero line rows, no count header', async () => {
    mockedGetBatchCheckoff.mockResolvedValue(
      fixtureState({ lines: [], requirementCount: 0, matchedCount: 0, comparableCount: 0, unmatchedCount: 0, unitMismatchCount: 0, shortfallCount: 0, hasShortfall: false, checkableCount: 0, checkedCount: 0, allCheckedOff: false }),
    );
    renderPanel();

    await waitFor(() => screen.getByTestId('stock-check-empty'));
    expect(screen.getByText("This batch's recipe has no trackable ingredients.")).toBeInTheDocument();
    expect(screen.queryAllByTestId(/^stock-check-line-/)).toHaveLength(0);
    expect(screen.queryByTestId('stock-check-header')).not.toBeInTheDocument();
  });

  it('a rejected fetch renders the error message and no line list and no count header', async () => {
    mockedGetBatchCheckoff.mockRejectedValue(new ApiClientError('NOT_FOUND', 'Batch not found'));
    renderPanel();

    await waitFor(() => screen.getByTestId('stock-check-error'));
    expect(screen.getByText('Batch not found')).toBeInTheDocument();
    expect(screen.queryAllByTestId(/^stock-check-line-/)).toHaveLength(0);
    expect(screen.queryByTestId('stock-check-header')).not.toBeInTheDocument();
    expect(screen.queryByTestId('stock-check-empty')).not.toBeInTheDocument();
  });
});

describe('AC-10 (facet): Action column follows checkable/checked, not a checkbox', () => {
  it('un-deducted checkable rows show a Deduct button; unmatched/mismatch rows show a disabled indicator', async () => {
    mockedGetBatchCheckoff.mockResolvedValue(fixtureState());
    renderPanel();
    await waitFor(() => screen.getByTestId('stock-check-header'));

    for (const nameKey of ['pale ale malt', 'munich malt', 'citra', 'safale us-05', 'gypsum']) {
      expect(screen.getByTestId(`stock-check-deduct-${nameKey}`)).toBeInTheDocument();
    }
    expect(screen.getByTestId('stock-check-disabled-whirlfloc')).toBeInTheDocument();
    expect(screen.getByTestId('stock-check-disabled-lactic acid')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('editable:false disables all 5 Deduct buttons', async () => {
    mockedGetBatchCheckoff.mockResolvedValue(fixtureState({ editable: false, stage: 'Brewing' }));
    renderPanel();
    await waitFor(() => screen.getByTestId('stock-check-header'));
    for (const nameKey of ['pale ale malt', 'munich malt', 'citra', 'safale us-05', 'gypsum']) {
      expect(screen.getByTestId(`stock-check-deduct-${nameKey}`)).toBeDisabled();
    }
  });
});

describe('AC-11: per-item Deduct button calls checkoffInventoryItem and flips the row to Deducted', () => {
  it('clicking Deduct issues the pinned request and, on resolve, shows the Deducted badge + Undo button', async () => {
    mockedGetBatchCheckoff.mockResolvedValue(fixtureState());
    let resolvePost: (v: BatchCheckoffState) => void = () => {};
    mockedCheckoffInventoryItem.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePost = resolve;
        }),
    );
    renderPanel();
    await waitFor(() => screen.getByTestId('stock-check-header'));

    fireEvent.click(screen.getByTestId('stock-check-deduct-pale ale malt'));

    expect(mockedCheckoffInventoryItem).toHaveBeenCalledTimes(1);
    expect(mockedCheckoffInventoryItem).toHaveBeenCalledWith('batch-1', { inventoryItemId: 'inv-1' });
    const [, body] = mockedCheckoffInventoryItem.mock.calls[0];
    expect(Object.keys(body)).toEqual(['inventoryItemId']);

    resolvePost(
      fixtureState({
        lines: fixtureState().lines.map((l) =>
          l.nameKey === 'pale ale malt' ? { ...l, checked: true, openTransactionId: 'tx-1', checkedAmount: 5.5, checkedCostPerUnit: 3.2, checkedAt: '2026-01-01T00:00:00.000Z' } : l,
        ),
        checkedCount: 1,
      }),
    );
    await waitFor(() => expect(screen.getByTestId('stock-check-checked-badge-pale ale malt')).toBeInTheDocument());
    expect(screen.getByTestId('stock-check-undo-pale ale malt')).toBeInTheDocument();
    expect(screen.queryByTestId('stock-check-deduct-pale ale malt')).not.toBeInTheDocument();
  });
});

describe('AC-12: per-item Undo button calls reverseInventoryCheckoff and restores un-deducted status', () => {
  it('clicking Undo on a deducted row issues the pinned reverse request and flips the row back', async () => {
    mockedGetBatchCheckoff.mockResolvedValue(
      fixtureState({
        lines: fixtureState().lines.map((l) =>
          l.nameKey === 'pale ale malt' ? { ...l, checked: true, openTransactionId: 'tx-1', checkedAmount: 5.5, checkedCostPerUnit: 3.2, checkedAt: '2026-01-01T00:00:00.000Z' } : l,
        ),
        checkedCount: 1,
      }),
    );
    mockedReverseInventoryCheckoff.mockResolvedValue(fixtureState());
    renderPanel();
    await waitFor(() => screen.getByTestId('stock-check-undo-pale ale malt'));

    fireEvent.click(screen.getByTestId('stock-check-undo-pale ale malt'));
    await waitFor(() => expect(mockedReverseInventoryCheckoff).toHaveBeenCalledTimes(1));
    expect(mockedReverseInventoryCheckoff).toHaveBeenCalledWith('batch-1', { inventoryItemId: 'inv-1' });
    const [, body] = mockedReverseInventoryCheckoff.mock.calls[0];
    expect(Object.keys(body)).toEqual(['inventoryItemId']);

    await waitFor(() => expect(screen.getByTestId('stock-check-deduct-pale ale malt')).toBeInTheDocument());
    expect(screen.queryByTestId('stock-check-checked-badge-pale ale malt')).not.toBeInTheDocument();
  });
});

describe('AC-13: Deduct All from Inventory processes remaining checkable un-deducted items sequentially', () => {
  it('issues one checkoffInventoryItem call per checkable un-deducted line, in order', async () => {
    mockedGetBatchCheckoff.mockResolvedValue(fixtureState());
    mockedCheckoffInventoryItem.mockImplementation((_batchId, input) =>
      Promise.resolve(
        fixtureState({
          lines: fixtureState().lines.map((l) => (l.inventoryItemId === input.inventoryItemId ? { ...l, checked: true } : l)),
        }),
      ),
    );
    renderPanel();
    await waitFor(() => screen.getByTestId('stock-check-header'));

    fireEvent.click(screen.getByTestId('stock-check-deduct-all-btn'));

    await waitFor(() => expect(mockedCheckoffInventoryItem).toHaveBeenCalledTimes(5));
    const calledIds = mockedCheckoffInventoryItem.mock.calls.map(([, input]) => input.inventoryItemId);
    expect(calledIds).toEqual(['inv-1', 'inv-2', 'inv-3', 'inv-4', 'inv-5']);
  });

  it('stops at the first failure and surfaces which item failed; already-deducted items stay deducted', async () => {
    mockedGetBatchCheckoff.mockResolvedValue(fixtureState());
    mockedCheckoffInventoryItem
      .mockResolvedValueOnce(fixtureState({ lines: fixtureState().lines.map((l) => (l.nameKey === 'pale ale malt' ? { ...l, checked: true } : l)) }))
      .mockRejectedValueOnce(new ApiClientError('CHECKOFF_NOT_COMPARABLE', 'No stock remaining.'));
    renderPanel();
    await waitFor(() => screen.getByTestId('stock-check-header'));

    fireEvent.click(screen.getByTestId('stock-check-deduct-all-btn'));

    await waitFor(() => screen.getByTestId('stock-check-bulk-error'));
    expect(screen.getByTestId('stock-check-bulk-error')).toHaveTextContent('Munich Malt');
    expect(screen.getByTestId('stock-check-bulk-error')).toHaveTextContent('No stock remaining.');
    expect(mockedCheckoffInventoryItem).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('stock-check-checked-badge-pale ale malt')).toBeInTheDocument();
  });
});

describe('AC-11/AC-12 (facet): a failed toggle leaves no phantom state', () => {
  it('a 409 on Deduct renders inline and leaves the row byte-identical', async () => {
    mockedGetBatchCheckoff.mockResolvedValue(fixtureState());
    mockedCheckoffInventoryItem.mockRejectedValue(new ApiClientError('CHECKOFF_ALREADY_OPEN', 'Already checked off.'));
    renderPanel();
    await waitFor(() => screen.getByTestId('stock-check-header'));

    fireEvent.click(screen.getByTestId('stock-check-deduct-pale ale malt'));

    await waitFor(() => screen.getByTestId('stock-check-toggle-error'));
    expect(screen.getByTestId('stock-check-toggle-error')).toHaveTextContent('Already checked off.');
    expect(screen.getByTestId('stock-check-deduct-pale ale malt')).toBeInTheDocument();
    expect(screen.getByTestId('stock-check-header')).toHaveTextContent('4 of 7 ingredients short');
    expect(screen.getByTestId('stock-check-deduct-pale ale malt')).not.toBeDisabled();
  });
});

describe('AC-45 (regression): lockstep — one response, one render, no local math', () => {
  it('the row and header render exactly the response payload', async () => {
    mockedGetBatchCheckoff.mockResolvedValue(fixtureState());
    mockedCheckoffInventoryItem.mockResolvedValue(
      fixtureState({
        lines: fixtureState().lines.map((l) => (l.nameKey === 'pale ale malt' ? { ...l, checked: true, onHand: -1.5, shortfall: 0, sufficient: true } : l)),
        shortfallCount: 3,
      }),
    );
    renderPanel();
    await waitFor(() => screen.getByTestId('stock-check-header'));

    fireEvent.click(screen.getByTestId('stock-check-deduct-pale ale malt'));
    await waitFor(() => expect(screen.getByTestId('stock-check-header')).toHaveTextContent('3 of 7 ingredients short'));

    const line = screen.getByTestId('stock-check-line-pale ale malt');
    expect(line).toHaveTextContent('On hand: -1.50 kg');
    expect(line).toHaveTextContent('In stock');
    expect(screen.getByTestId('stock-check-checked-badge-pale ale malt')).toBeInTheDocument();
    expect(mockedGetBatchCheckoff).toHaveBeenCalledTimes(1);
  });
});

describe('AC-47 (regression): panel is still Planning-only, and resolves via getBatchCheckoff alone', () => {
  it('the panel resolves cleanly via getBatchCheckoff alone', async () => {
    mockedGetBatchCheckoff.mockResolvedValue(fixtureState());
    renderPanel();
    await waitFor(() => screen.getByTestId('stock-check-header'));
    expect(mockedGetBatchCheckoff).toHaveBeenCalled();
  });
});

describe('M33_P1: StockCheckPanel button components & classes (AC-5..AC-8, AC-10)', () => {
  it('AC-5: "Adjust Batch Recipe" renders via <Button variant="secondary" size="sm">', async () => {
    mockedGetBatchCheckoff.mockResolvedValue(fixtureState());
    const onAdjust = vi.fn();
    render(
      <ConfigProvider>
        <StockCheckPanel batchId="batch-1" onAdjustRecipe={onAdjust} />
      </ConfigProvider>,
    );
    await waitFor(() => screen.getByTestId('stock-check-header'));
    const btn = screen.getByTestId('batch-adjust-recipe-btn');
    expect(btn.tagName).toBe('BUTTON');
    expect(btn).toHaveClass('bg-slate-800', 'hover:bg-slate-700', 'text-slate-200', 'border-slate-700', 'text-xs', 'px-3', 'py-1.5', 'inline-flex', 'items-center', 'justify-center', 'gap-1.5');
    fireEvent.click(btn);
    expect(onAdjust).toHaveBeenCalledTimes(1);
  });

  it('AC-6: "Deduct All from Inventory" renders via <Button variant="primary" size="sm">', async () => {
    mockedGetBatchCheckoff.mockResolvedValue(fixtureState());
    renderPanel();
    await waitFor(() => screen.getByTestId('stock-check-header'));
    const btn = screen.getByTestId('stock-check-deduct-all-btn');
    expect(btn.tagName).toBe('BUTTON');
    expect(btn).toHaveClass('bg-amber-600', 'hover:bg-amber-500', 'text-white', 'text-xs', 'px-3', 'py-1.5', 'inline-flex', 'items-center', 'justify-center', 'gap-1.5');
  });

  it('AC-7 & AC-8: row Deduct and Undo buttons render via Button primitive with size="sm"', async () => {
    mockedGetBatchCheckoff.mockResolvedValue(
      fixtureState({
        lines: fixtureState().lines.map((l) => (l.nameKey === 'pale ale malt' ? { ...l, checked: true } : l)),
      }),
    );
    renderPanel();
    await waitFor(() => screen.getByTestId('stock-check-header'));

    const undoBtn = screen.getByTestId('stock-check-undo-pale ale malt');
    expect(undoBtn.tagName).toBe('BUTTON');
    expect(undoBtn).toHaveClass('bg-slate-800', 'hover:bg-slate-700', 'text-slate-200', 'border-slate-700', 'text-xs', 'px-3', 'py-1.5', 'inline-flex', 'items-center', 'justify-center', 'gap-1.5');

    const deductBtn = screen.getByTestId('stock-check-deduct-citra');
    expect(deductBtn.tagName).toBe('BUTTON');
    expect(deductBtn).toHaveClass('bg-amber-600', 'hover:bg-amber-500', 'text-white', 'text-xs', 'px-3', 'py-1.5', 'inline-flex', 'items-center', 'justify-center', 'gap-1.5');
  });
});

