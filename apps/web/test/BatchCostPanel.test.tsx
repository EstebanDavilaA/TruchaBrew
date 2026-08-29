import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import type { BatchCostBreakdown, UserConfig } from '@truchabrew/shared-types';
import { BatchCostPanel } from '../src/components/BatchCostPanel';
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
  return { ok: status >= 200 && status < 300, status, text: () => Promise.resolve(JSON.stringify(body)) } as Response;
}

vi.mock('../src/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/api/client')>();
  return { ...actual, getBatchCost: vi.fn() };
});

import { getBatchCost } from '../src/api/client';

const mockedGetBatchCost = vi.mocked(getBatchCost);

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === '/api/config') return Promise.resolve(jsonResponse(DEFAULT_TEST_CONFIG));
      return Promise.reject(new Error(`Unexpected fetch call in BatchCostPanel.test.tsx: ${url}`));
    }),
  );
  mockedGetBatchCost.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** AC-14/AC-38's full-checkoff fixture breakdown. */
function fullBreakdown(): BatchCostBreakdown {
  return {
    lines: [
      { transactionId: 'tx-1', category: 'Fermentable', displayName: 'Pale Ale Malt', nameKey: 'pale ale malt', amount: 5.5, unit: 'kg', costPerUnit: 3.2, lineCost: 17.6 },
      { transactionId: 'tx-2', category: 'Fermentable', displayName: 'Munich Malt', nameKey: 'munich malt', amount: 0.5, unit: 'kg', costPerUnit: 4.1, lineCost: 2.05 },
      { transactionId: 'tx-3', category: 'Hop', displayName: 'Citra', nameKey: 'citra', amount: 50, unit: 'g', costPerUnit: 0.09, lineCost: 4.5 },
      { transactionId: 'tx-4', category: 'Yeast', displayName: 'SafAle US-05', nameKey: 'safale us-05', amount: 3, unit: 'pkg', costPerUnit: 4.5, lineCost: 13.5 },
      { transactionId: 'tx-5', category: 'Misc', displayName: 'Gypsum', nameKey: 'gypsum', amount: 4, unit: 'g', costPerUnit: 0.02, lineCost: 0.08 },
    ],
    lineCount: 5,
    costedLineCount: 5,
    uncostedLineCount: 0,
    hasUncostedLines: false,
    totalCost: 37.730000000000004,
  };
}

function render_(batchId = 'batch-1') {
  return render(
    <ConfigProvider>
      <BatchCostPanel batchId={batchId} />
    </ConfigProvider>,
  );
}

describe('AC-48: BatchCostPanel', () => {
  it('renders 5 rows and a total reading 37.73, not the raw float', async () => {
    mockedGetBatchCost.mockResolvedValue(fullBreakdown());
    render_();
    await waitFor(() => screen.getByTestId('batch-cost-total'));
    expect(screen.getAllByTestId(/^batch-cost-line-/)).toHaveLength(5);
    expect(screen.getByTestId('batch-cost-total')).toHaveTextContent('37.73');
    expect(screen.getByTestId('batch-cost-total').textContent).not.toContain('37.730000000000004');
    expect(document.body.textContent).not.toMatch(/NaN|undefined|null/);
  });

  it('an uncosted line renders "Not priced" and a note naming the count', async () => {
    mockedGetBatchCost.mockResolvedValue({
      lines: [
        { transactionId: 'tx-1', category: 'Fermentable', displayName: 'Pale Ale Malt', nameKey: 'pale ale malt', amount: 5.5, unit: 'kg', costPerUnit: 3.2, lineCost: 17.6 },
        { transactionId: 'tx-7', category: 'Fermentable', displayName: 'Flaked Oats', nameKey: 'flaked oats', amount: 0.5, unit: 'kg', costPerUnit: null, lineCost: null },
      ],
      lineCount: 2,
      costedLineCount: 1,
      uncostedLineCount: 1,
      hasUncostedLines: true,
      totalCost: 17.6,
    });
    render_();
    await waitFor(() => screen.getByTestId('batch-cost-total'));
    expect(screen.getByTestId('batch-cost-line-flaked oats')).toHaveTextContent('Not priced');
    expect(screen.getByTestId('batch-cost-uncosted-note')).toHaveTextContent('1');
    expect(document.body.textContent).not.toMatch(/NaN|undefined|null/);
  });

  it('lineCount 0 renders the empty message with zero rows and no total', async () => {
    mockedGetBatchCost.mockResolvedValue({ lines: [], lineCount: 0, costedLineCount: 0, uncostedLineCount: 0, hasUncostedLines: false, totalCost: 0 });
    render_();
    await waitFor(() => screen.getByTestId('batch-cost-empty'));
    expect(screen.getByText('No ingredients were checked off for this batch.')).toBeInTheDocument();
    expect(screen.queryAllByTestId(/^batch-cost-line-/)).toHaveLength(0);
    expect(screen.queryByTestId('batch-cost-total')).not.toBeInTheDocument();
  });

  it('a rejected fetch renders the error message', async () => {
    mockedGetBatchCost.mockRejectedValue(new ApiClientError('NOT_FOUND', 'Batch not found'));
    render_();
    await waitFor(() => screen.getByTestId('batch-cost-error'));
    expect(screen.getByText('Batch not found')).toBeInTheDocument();
  });

  it('issues exactly one GET per mount', async () => {
    mockedGetBatchCost.mockResolvedValue(fullBreakdown());
    render_();
    await waitFor(() => screen.getByTestId('batch-cost-total'));
    expect(mockedGetBatchCost).toHaveBeenCalledTimes(1);
    expect(mockedGetBatchCost).toHaveBeenCalledWith('batch-1');
  });
});
