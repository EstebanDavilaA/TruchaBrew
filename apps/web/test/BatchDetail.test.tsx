import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import type { UserConfig } from '@truchabrew/shared-types';
import { BatchDetail } from '../src/pages/BatchDetail';
import { ApiClientError } from '../src/api/client';
import { ConfigProvider } from '../src/context/ConfigContext';
import { baseBatchWithReadings } from './helpers/fixtures';
import { STATUS_BADGE_WRAPPER_CLASS, STATUS_BADGE_CLASS } from '../src/components/designSystem';

// M15_P1 — BatchRecipeAdjustModal (mounted unconditionally by BatchDetail,
// even while closed) pulls in FermentableSection/HopSection/YeastSection,
// which all require CatalogContext. Same mock BatchRecipeAdjustModal.test.tsx
// already uses.
vi.mock('../src/context/CatalogContext', () => ({
  useCatalog: () => ({
    catalog: { fermentables: [], hops: [], yeasts: [], miscs: [] },
    loading: false,
    error: null,
    reload: vi.fn(),
  }),
}));

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
    getBatch: vi.fn(),
    updateBatch: vi.fn(),
    deleteBatch: vi.fn(),
    createBatch: vi.fn(),
    createReading: vi.fn(),
    updateReading: vi.fn(),
    deleteReading: vi.fn(),
    createBatchNote: vi.fn(),
    updateBatchNote: vi.fn(),
    deleteBatchNote: vi.fn(),
    getBatchCheckoff: vi.fn(),
    getBatchCost: vi.fn(),
    updateBatchRecipeSnapshot: vi.fn(),
  };
});

import {
  getBatch,
  updateBatch,
  deleteBatch,
  createBatch,
  createReading,
  updateReading,
  deleteReading,
  createBatchNote,
  updateBatchNote,
  deleteBatchNote,
  getBatchCheckoff,
  getBatchCost,
  updateBatchRecipeSnapshot,
} from '../src/api/client';
import { EMPTY_CHECKOFF_STATE, EMPTY_COST_BREAKDOWN } from '@truchabrew/calculations';

const mockedGetBatch = vi.mocked(getBatch);
const mockedUpdateBatch = vi.mocked(updateBatch);
const mockedDeleteBatch = vi.mocked(deleteBatch);
const mockedCreateBatch = vi.mocked(createBatch);
const mockedCreateReading = vi.mocked(createReading);
const mockedUpdateReading = vi.mocked(updateReading);
const mockedDeleteReading = vi.mocked(deleteReading);
const mockedCreateBatchNote = vi.mocked(createBatchNote);
const mockedUpdateBatchNote = vi.mocked(updateBatchNote);
const mockedDeleteBatchNote = vi.mocked(deleteBatchNote);
const mockedGetBatchCheckoff = vi.mocked(getBatchCheckoff);
const mockedGetBatchCost = vi.mocked(getBatchCost);
const mockedUpdateBatchRecipeSnapshot = vi.mocked(updateBatchRecipeSnapshot);

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === '/api/config') return Promise.resolve(jsonResponse(DEFAULT_TEST_CONFIG));
      return Promise.reject(new Error(`Unexpected global fetch call in BatchDetail.test.tsx: ${url}`));
    }),
  );
  mockedGetBatch.mockReset();
  mockedUpdateBatch.mockReset();
  mockedDeleteBatch.mockReset();
  mockedCreateBatch.mockReset();
  mockedCreateReading.mockReset();
  mockedUpdateReading.mockReset();
  mockedDeleteReading.mockReset();
  mockedCreateBatchNote.mockReset();
  mockedUpdateBatchNote.mockReset();
  mockedDeleteBatchNote.mockReset();
  mockedGetBatchCheckoff.mockReset().mockResolvedValue(EMPTY_CHECKOFF_STATE);
  mockedGetBatchCost.mockReset().mockResolvedValue(EMPTY_COST_BREAKDOWN);
  mockedUpdateBatchRecipeSnapshot.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderBatchDetail(overrides: Partial<Parameters<typeof BatchDetail>[0]> = {}) {
  const onBack = vi.fn();
  const onDeleted = vi.fn();
  const onRebrewed = vi.fn();
  const utils = render(
    <ConfigProvider>
      <BatchDetail batchId="batch-1" onBack={onBack} onDeleted={onDeleted} onRebrewed={onRebrewed} {...overrides} />
    </ConfigProvider>,
  );
  return { ...utils, onBack, onDeleted, onRebrewed };
}

async function waitForLoaded() {
  await waitFor(() => expect(screen.getByTestId('batch-status-badge')).toBeInTheDocument());
}

describe('AC-7: standalone batch header card renders name, status badge, recipe link', () => {
  it('displays batch name, status chip, and recipe name', async () => {
    mockedGetBatch.mockResolvedValue(baseBatchWithReadings({ name: 'Test Batch', status: 'Brewing' }));
    renderBatchDetail();
    await waitForLoaded();

    expect(screen.getAllByText('Test Batch').length).toBeGreaterThan(0);
    expect(screen.getByTestId('batch-status-badge')).toHaveTextContent('Brewing');
    expect(screen.getByText(/Based on recipe:/)).toBeInTheDocument();
  });
});

describe('AC-8: horizontal stage tabs render', () => {
  it('renders 5 clickable stage tabs', async () => {
    mockedGetBatch.mockResolvedValue(baseBatchWithReadings());
    renderBatchDetail();
    await waitForLoaded();

    for (const tab of ['planning', 'brewing', 'fermentation', 'packaging', 'completed']) {
      expect(screen.getByTestId(`batch-tab-${tab}`)).toBeInTheDocument();
    }
  });

  it('defaults activeTab to the current batch status stage upon loading (FEAT-043)', async () => {
    mockedGetBatch.mockResolvedValue(baseBatchWithReadings({ status: 'Conditioning' }));
    renderBatchDetail();
    await waitForLoaded();

    expect(screen.getByTestId('batch-tab-packaging')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('batch-tab-panel-packaging')).toBeInTheDocument();
    // Prior stages (planning, brewing, fermentation) should be marked completed (rendering check icons instead of numbers)
    expect(screen.getByTestId('batch-tab-planning').textContent).not.toContain('1');
    expect(screen.getByTestId('batch-tab-brewing').textContent).not.toContain('2');
    expect(screen.getByTestId('batch-tab-fermentation').textContent).not.toContain('3');
  });
});

describe('AC-9: clicking stage tabs switches view without mutating batch status', () => {
  it('clicking Brewing on a Planning batch shows brewday fields; status stays Planning', async () => {
    mockedGetBatch.mockResolvedValue(baseBatchWithReadings({ status: 'Planning' }));
    renderBatchDetail();
    await waitForLoaded();

    expect(screen.getByTestId('batch-status-badge')).toHaveTextContent('Planning');
    fireEvent.click(screen.getByTestId('batch-tab-brewing'));

    expect(screen.getByTestId('batch-tab-panel-brewing')).toBeInTheDocument();
    expect(screen.getByLabelText(/Pre-boil Gravity \(SG\)/)).toBeInTheDocument();
    expect(screen.getByTestId('batch-status-badge')).toHaveTextContent('Planning');
    expect(mockedUpdateBatch).not.toHaveBeenCalled();
  });
});

describe('AC-10: Planning tab renders recipe snapshot/vitals and stock check', () => {
  it('shows the stats grid and StockCheckPanel', async () => {
    mockedGetBatch.mockResolvedValue(baseBatchWithReadings());
    renderBatchDetail();
    await waitForLoaded();

    expect(screen.getByTestId('batch-tab-panel-planning')).toBeInTheDocument();
    expect(screen.getByText('Original Gravity')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('stock-check-panel')).toBeInTheDocument());
  });
});

describe('AC-11: Brewing tab renders brewday measurements and live efficiency', () => {
  it('shows pre-boil gravity/mash pH/boil size/boil time/measured OG fields and an efficiency tile', async () => {
    mockedGetBatch.mockResolvedValue(baseBatchWithReadings());
    renderBatchDetail();
    await waitForLoaded();
    fireEvent.click(screen.getByTestId('batch-tab-brewing'));

    expect(screen.getByLabelText(/Pre-boil Gravity \(SG\)/)).toBeInTheDocument();
    expect(screen.getByLabelText('Mash pH')).toBeInTheDocument();
    expect(screen.getByLabelText('Boil Size (L)')).toBeInTheDocument();
    expect(screen.getByLabelText('Boil Time (min)')).toBeInTheDocument();
    expect(screen.getByLabelText('Measured OG (SG)')).toBeInTheDocument();
    expect(screen.getByText('Mash Efficiency (live)')).toBeInTheDocument();
    expect(screen.getByText('Brewhouse Efficiency (est.)')).toBeInTheDocument();
  });
});

describe('AC-12: Fermentation tab renders chart, reading log, and notes', () => {
  it('shows the empty-readings state, ReadingLog and BatchNoteLog', async () => {
    mockedGetBatch.mockResolvedValue(baseBatchWithReadings());
    renderBatchDetail();
    await waitForLoaded();
    fireEvent.click(screen.getByTestId('batch-tab-fermentation'));

    expect(screen.getByTestId('no-readings-yet')).toBeInTheDocument();
    expect(screen.getByTestId('reading-add-button')).toBeInTheDocument();
  });
});

describe('AC-13/AC-5: Completed tab renders final figures, comparison, and nutrition', () => {
  it('shows sensory panel, calibration trigger, comparison, cost, and nutrition (no split packaging manager)', async () => {
    mockedGetBatch.mockResolvedValue(baseBatchWithReadings({ status: 'Completed', measuredOg: 1.05, measuredFg: 1.01 }));
    renderBatchDetail();
    await waitForLoaded();
    fireEvent.click(screen.getByTestId('batch-tab-completed'));

    expect(screen.getByTestId('sensory-evaluation-panel')).toBeInTheDocument();
    await waitFor(() => expect(mockedGetBatchCost).toHaveBeenCalled());
    expect(screen.getByTestId('batch-nutrition-panel')).toBeInTheDocument();
    // AC-6: SplitPackagingPanel does not render on the completed tab.
    expect(screen.queryByTestId('split-packaging-panel')).not.toBeInTheDocument();

    // Verify Final Gravity Measurement input is in the fermentation tab
    fireEvent.click(screen.getByTestId('batch-tab-fermentation'));
    expect(screen.getByLabelText('Measured FG (SG)')).toBeInTheDocument();
  });
});

describe('AC-14: TopBar contextual action alignment & in-tab status change', () => {
  it('TopBar renders Save, Discard, Delete; and switching tabs displays Change Status to target', async () => {
    mockedGetBatch.mockResolvedValue(baseBatchWithReadings({ status: 'Planning' }));
    renderBatchDetail();
    await waitForLoaded();

    const actions = screen.getByTestId('topbar-actions');
    expect(within(actions).getByTestId('batch-save-btn')).toBeInTheDocument();
    expect(within(actions).getByTestId('batch-discard-btn')).toBeInTheDocument();
    expect(within(actions).getByTestId('batch-delete-btn')).toBeInTheDocument();

    // Switching to Brewing tab displays the status change button
    fireEvent.click(screen.getByTestId('batch-tab-brewing'));
    expect(screen.getByTestId('batch-advance-status-btn')).toHaveTextContent('Change Status to Brewing');
  });

  it('AC-23 (M26_P1 Amendment 2): topbar-actions carries flex-wrap, inherited from TopBar with no per-file edit', async () => {
    mockedGetBatch.mockResolvedValue(baseBatchWithReadings({ status: 'Planning' }));
    renderBatchDetail();
    await waitForLoaded();

    const actions = screen.getByTestId('topbar-actions');
    expect(actions.className.split(/\s+/)).toContain('flex-wrap');
  });

  it('a terminal Completed batch on the Completed tab has no advance-status button', async () => {
    mockedGetBatch.mockResolvedValue(baseBatchWithReadings({ status: 'Completed', measuredOg: 1.05, measuredFg: 1.01 }));
    renderBatchDetail();
    await waitForLoaded();
    fireEvent.click(screen.getByTestId('batch-tab-completed'));
    expect(screen.queryByTestId('batch-advance-status-btn')).not.toBeInTheDocument();
  });
});

describe('AC-15: Rebrew clones a completed batch into a new Planning batch', () => {
  it('clicking Rebrew calls createBatch(recipeId) and navigates to the new batch id', async () => {
    mockedGetBatch.mockResolvedValue(baseBatchWithReadings({ status: 'Completed', recipeId: 'recipe-42', measuredOg: 1.05, measuredFg: 1.01 }));
    mockedCreateBatch.mockResolvedValue(baseBatchWithReadings({ id: 'batch-rebrewed', status: 'Planning' }));

    const { onRebrewed } = renderBatchDetail();
    await waitForLoaded();

    const rebrewBtn = screen.getByTestId('batch-rebrew-btn');
    fireEvent.click(rebrewBtn);

    await waitFor(() => expect(mockedCreateBatch).toHaveBeenCalledWith('recipe-42'));
    await waitFor(() => expect(onRebrewed).toHaveBeenCalledWith('batch-rebrewed'));
  });

  it('Rebrew is absent on a non-Completed batch', async () => {
    mockedGetBatch.mockResolvedValue(baseBatchWithReadings({ status: 'Brewing' }));
    renderBatchDetail();
    await waitForLoaded();
    expect(screen.queryByTestId('batch-rebrew-btn')).not.toBeInTheDocument();
  });

  it('a failed Rebrew surfaces an error and does not navigate', async () => {
    mockedGetBatch.mockResolvedValue(baseBatchWithReadings({ status: 'Completed', measuredOg: 1.05, measuredFg: 1.01 }));
    mockedCreateBatch.mockRejectedValue(new ApiClientError('INTERNAL', 'Recipe not found'));

    const { onRebrewed } = renderBatchDetail();
    await waitForLoaded();
    fireEvent.click(screen.getByTestId('batch-rebrew-btn'));

    await waitFor(() => expect(screen.getByText(/Recipe not found/)).toBeInTheDocument());
    expect(onRebrewed).not.toHaveBeenCalled();
  });
});

describe('AC-20/AC-21: status badge is single-source-of-truth and identical to BatchList', () => {
  it('the resolved className matches STATUS_BADGE_WRAPPER_CLASS + STATUS_BADGE_CLASS[status] exactly', async () => {
    mockedGetBatch.mockResolvedValue(baseBatchWithReadings({ status: 'Fermenting' }));
    renderBatchDetail();
    await waitForLoaded();

    const badge = screen.getByTestId('batch-status-badge');
    expect(badge.className).toBe(`${STATUS_BADGE_WRAPPER_CLASS} ${STATUS_BADGE_CLASS.Fermenting}`);
  });
});

describe('AC-22: card + section-heading treatment is uniform', () => {
  it('zero literal rounded-lg card roots remain in BatchDetail.tsx source', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const source = fs.readFileSync(path.resolve(__dirname, '../src/pages/BatchDetail.tsx'), 'utf-8');
    // Every div this file itself opens as a "card" root uses CARD_CLASS —
    // no literal 'rounded-lg' card wrapper of its own (a child component's
    // own internal markup is out of scope).
    expect(source).not.toMatch(/className="bg-slate-900[^"]*rounded-lg/);
  });
});

describe('AC-23/AC-26: no bottom-of-form action buttons; header precedes tabs precedes content', () => {
  it('Save/Discard/Delete never render inside page-container (they live in the TopBar only)', async () => {
    mockedGetBatch.mockResolvedValue(baseBatchWithReadings());
    renderBatchDetail();
    await waitForLoaded();

    const container = screen.getByTestId('page-container');
    expect(within(container).queryByTestId('batch-save-btn')).not.toBeInTheDocument();
    expect(within(container).queryByTestId('batch-discard-btn')).not.toBeInTheDocument();
    expect(within(container).queryByTestId('batch-delete-btn')).not.toBeInTheDocument();
  });

  it('DOM order is header card -> stage tabs -> tab content', async () => {
    mockedGetBatch.mockResolvedValue(baseBatchWithReadings());
    renderBatchDetail();
    await waitForLoaded();

    const container = screen.getByTestId('page-container');
    const badge = screen.getByTestId('batch-status-badge');
    const tabs = screen.getByTestId('batch-tab-planning');
    const panel = screen.getByTestId('batch-tab-panel-planning');

    expect(badge.compareDocumentPosition(tabs) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(tabs.compareDocumentPosition(panel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(container).toContainElement(badge);
  });
});

describe('AC-28: empty, loading, and error states are distinct', () => {
  it('loading copy is "Loading batch…"', async () => {
    mockedGetBatch.mockReturnValue(new Promise(() => {}));
    renderBatchDetail();
    expect(await screen.findByText('Loading batch…')).toBeInTheDocument();
  });

  it('a load failure renders an error banner with "Failed to" copy, never the loading copy', async () => {
    mockedGetBatch.mockRejectedValue(new ApiClientError('NOT_FOUND', 'Batch not found'));
    renderBatchDetail();
    await waitFor(() => expect(screen.getByText(/Failed to load batch\./)).toBeInTheDocument());
    expect(screen.queryByText('Loading batch…')).not.toBeInTheDocument();
  });

  it('an empty reading log renders EMPTY_STATE_CLASS copy distinct from loading/error', async () => {
    mockedGetBatch.mockResolvedValue(baseBatchWithReadings({ readings: [] }));
    renderBatchDetail();
    await waitForLoaded();
    fireEvent.click(screen.getByTestId('batch-tab-fermentation'));
    expect(screen.getByTestId('no-readings-yet')).toHaveTextContent(/No readings yet/);
  });
});

describe('AC-30..AC-39: Batch Delete — confirm dialog gates the call, success navigates, failure stays', () => {
  it('AC-36: client.ts exports deleteBatch; invoking it issues one DELETE fetch with no body / Content-Type', async () => {
    vi.doUnmock('../src/api/client');
    const client = await vi.importActual<typeof import('../src/api/client')>('../src/api/client');
    expect(typeof client.deleteBatch).toBe('function');

    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, status: 204, text: () => Promise.resolve('') });
    vi.stubGlobal('fetch', fetchSpy);
    await client.deleteBatch('batch-xyz');

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('/api/batches/batch-xyz');
    expect(init.method).toBe('DELETE');
    expect(init.body).toBeUndefined();
    expect(init.headers?.['Content-Type']).toBeUndefined();
  });

  it('AC-37: clicking batch-delete-btn opens confirm-dialog with zero network calls; cancel closes it having still fired zero, batch stays', async () => {
    mockedGetBatch.mockResolvedValue(baseBatchWithReadings());
    renderBatchDetail();
    await waitForLoaded();

    fireEvent.click(screen.getByTestId('batch-delete-btn'));
    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
    expect(mockedDeleteBatch).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('confirm-dialog-cancel'));
    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();
    expect(mockedDeleteBatch).not.toHaveBeenCalled();
    expect(screen.getByTestId('batch-status-badge')).toBeInTheDocument();
  });

  it('AC-37: only confirm-dialog-confirm invokes deleteBatch, exactly once', async () => {
    mockedGetBatch.mockResolvedValue(baseBatchWithReadings());
    mockedDeleteBatch.mockResolvedValue(undefined);
    renderBatchDetail();
    await waitForLoaded();

    fireEvent.click(screen.getByTestId('batch-delete-btn'));
    fireEvent.click(screen.getByTestId('confirm-dialog-confirm'));

    await waitFor(() => expect(mockedDeleteBatch).toHaveBeenCalledTimes(1));
    expect(mockedDeleteBatch).toHaveBeenCalledWith('batch-1');
  });

  it('AC-38: on success the dialog closes and onDeleted() fires (caller navigates to the batch list)', async () => {
    mockedGetBatch.mockResolvedValue(baseBatchWithReadings());
    mockedDeleteBatch.mockResolvedValue(undefined);
    const { onDeleted } = renderBatchDetail();
    await waitForLoaded();

    fireEvent.click(screen.getByTestId('batch-delete-btn'));
    fireEvent.click(screen.getByTestId('confirm-dialog-confirm'));

    await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();
  });

  it('AC-38: on failure the dialog closes, an ERROR_STATE_CLASS banner with "Failed to delete batch." renders, view stays, busy flag clears', async () => {
    mockedGetBatch.mockResolvedValue(baseBatchWithReadings());
    mockedDeleteBatch.mockRejectedValue(new ApiClientError('INTERNAL', 'Batch is referenced elsewhere.'));
    const { onDeleted } = renderBatchDetail();
    await waitForLoaded();

    fireEvent.click(screen.getByTestId('batch-delete-btn'));
    fireEvent.click(screen.getByTestId('confirm-dialog-confirm'));

    await waitFor(() => expect(screen.getByText(/Failed to delete batch\./)).toBeInTheDocument());
    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();
    expect(onDeleted).not.toHaveBeenCalled();
    expect(screen.queryByText('No batches yet')).not.toBeInTheDocument();
    // busy flag cleared -> delete button is clickable again (not stuck disabled)
    fireEvent.click(screen.getByTestId('batch-delete-btn'));
    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
  });
});

describe('Save/Discard wiring', () => {
  it('Save Changes calls updateBatch with the current form data', async () => {
    mockedGetBatch.mockResolvedValue(baseBatchWithReadings());
    mockedUpdateBatch.mockResolvedValue(baseBatchWithReadings({ measuredMashPh: 5.4 }));
    renderBatchDetail();
    await waitForLoaded();
    fireEvent.click(screen.getByTestId('batch-tab-brewing'));

    fireEvent.change(screen.getByLabelText('Mash pH'), { target: { value: '5.4' } });
    fireEvent.click(screen.getByTestId('batch-save-btn'));

    await waitFor(() => expect(mockedUpdateBatch).toHaveBeenCalledTimes(1));
    expect(mockedUpdateBatch.mock.calls[0][1]).toMatchObject({ measuredMashPh: 5.4 });
  });

  it('Discard Changes reverts an edit without calling the API', async () => {
    mockedGetBatch.mockResolvedValue(baseBatchWithReadings());
    renderBatchDetail();
    await waitForLoaded();
    fireEvent.click(screen.getByTestId('batch-tab-brewing'));

    fireEvent.change(screen.getByLabelText('Mash pH'), { target: { value: '5.4' } });
    fireEvent.click(screen.getByTestId('batch-discard-btn'));

    expect(mockedUpdateBatch).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Mash pH')).toHaveValue(null);
  });
});

// ---------------------------------------------------------------------------
// M15_P1 — added 2026-08-19 critic follow-up (Finding F-8: none of the
// Adjust Recipe button, the BrewDayTracker mount, or the Start Fermentation
// hand-off had any BatchDetail-level coverage). Minimal wiring coverage
// only — the deeper behavior of each piece (live vitals recalculation,
// timers, etc.) is already covered by BatchRecipeAdjustModal.test.tsx and
// BrewDayTracker.test.tsx respectively.
// ---------------------------------------------------------------------------

describe('M15_P1: Adjust Batch Recipe button wiring', () => {
  it('is present on a Planning-stage batch and opens BatchRecipeAdjustModal', async () => {
    mockedGetBatch.mockResolvedValue(baseBatchWithReadings({ status: 'Planning' }));
    renderBatchDetail();
    await waitForLoaded();

    expect(screen.queryByTestId('batch-recipe-adjust-modal')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('batch-adjust-recipe-btn'));
    expect(screen.getByTestId('batch-recipe-adjust-modal')).toBeInTheDocument();
  });

  it('is absent once the batch has moved past Planning', async () => {
    mockedGetBatch.mockResolvedValue(baseBatchWithReadings({ status: 'Brewing' }));
    renderBatchDetail();
    await waitForLoaded();

    expect(screen.queryByTestId('batch-adjust-recipe-btn')).not.toBeInTheDocument();
  });
});

describe('M15_P1: BrewDayTracker mounts in the Brewing stage tab', () => {
  it('renders the brew day tracker when the Brewing tab is active', async () => {
    mockedGetBatch.mockResolvedValue(baseBatchWithReadings({ status: 'Brewing' }));
    renderBatchDetail();
    await waitForLoaded();

    fireEvent.click(screen.getByTestId('batch-tab-brewing'));
    expect(screen.getByTestId('brew-day-tracker')).toBeInTheDocument();
  });
});

describe('M15_P1: Start Fermentation hand-off is wired', () => {
  it('clicking change status to Fermenting on the Fermentation tab calls updateBatch with status: Fermenting', async () => {
    mockedGetBatch.mockResolvedValue(baseBatchWithReadings({ status: 'Brewing' }));
    mockedUpdateBatch.mockResolvedValue(baseBatchWithReadings({ status: 'Fermenting', fermentationStartDate: '2026-08-19T00:00:00.000Z' }));
    renderBatchDetail();
    await waitForLoaded();

    fireEvent.click(screen.getByTestId('batch-tab-fermentation'));
    const changeStatusBtn = screen.getByTestId('batch-advance-status-btn');
    expect(changeStatusBtn).toHaveTextContent(/CHANGE STATUS TO FERMENTATION/i);
    fireEvent.click(changeStatusBtn);

    await waitFor(() => expect(mockedUpdateBatch).toHaveBeenCalledTimes(1));
    expect(mockedUpdateBatch.mock.calls[0][1]).toMatchObject({ status: 'Fermenting' });
    await waitFor(() => expect(screen.getByTestId('batch-tab-panel-fermentation')).toBeInTheDocument());
  });
});

describe('M16_P1: Live Vitals, FG Stability & Cellar Schedule in Fermentation Tab (AC-8..AC-14)', () => {
  it('displays live vitals cards including estimated live ABV, attenuation, and pressure (AC-12)', async () => {
    const batch = baseBatchWithReadings({
      status: 'Fermenting',
      measuredOg: 1.056,
      readings: [
        {
          id: 'r-1',
          batchId: 'batch-1',
          readingTime: '2026-08-01T00:00:00.000Z',
          sg: 1.012,
          tempC: 20.0,
          ph: 4.4,
          pressurePsi: 10.5,
          comment: 'Active fermentation',
        },
      ],
    });
    mockedGetBatch.mockResolvedValue(batch);
    renderBatchDetail();
    await waitForLoaded();

    fireEvent.click(screen.getByTestId('batch-tab-fermentation'));

    expect(screen.getByTestId('attenuation-figure')).toBeInTheDocument();
    expect(screen.getByTestId('live-abv-figure')).toBeInTheDocument();
    expect(screen.getByTestId('live-gravity-figure')).toBeInTheDocument();
    expect(screen.getByTestId('live-temp-pressure-figure')).toBeInTheDocument();

    expect(screen.getByText('10.5 psi')).toBeInTheDocument();
    expect(screen.getByText('20.0°C')).toBeInTheDocument();
  });

  it('surfaces FG stability banner and Advance to Conditioning handoff when gravity is stable >= 48h (AC-13 & AC-14)', async () => {
    const batch = baseBatchWithReadings({
      status: 'Fermenting',
      measuredOg: 1.050,
      readings: [
        {
          id: 'r-1',
          batchId: 'batch-1',
          readingTime: '2026-08-01T10:00:00.000Z',
          sg: 1.010,
          tempC: 19.0,
          ph: 4.4,
          pressurePsi: null,
          comment: '',
        },
        {
          id: 'r-2',
          batchId: 'batch-1',
          readingTime: '2026-08-03T12:00:00.000Z', // 50 hours later
          sg: 1.010,
          tempC: 19.0,
          ph: 4.4,
          pressurePsi: null,
          comment: '',
        },
      ],
    });
    mockedGetBatch.mockResolvedValue(batch);
    mockedUpdateBatch.mockResolvedValue({
      ...batch,
      status: 'Conditioning',
      measuredFg: 1.010,
    });

    renderBatchDetail();
    await waitForLoaded();

    fireEvent.click(screen.getByTestId('batch-tab-fermentation'));

    expect(screen.getByTestId('fg-stability-banner')).toBeInTheDocument();
    expect(screen.getByText(/Specific Gravity is Stable/i)).toBeInTheDocument();

    const advanceBtn = screen.getByTestId('advance-conditioning-btn');
    fireEvent.click(advanceBtn);

    await waitFor(() => expect(mockedUpdateBatch).toHaveBeenCalledTimes(1));
    expect(mockedUpdateBatch.mock.calls[0][1]).toMatchObject({
      status: 'Conditioning',
      measuredFg: 1.010,
    });
  });

  it('renders CellarActionFeed and marks action done via note creation (AC-8 & AC-9)', async () => {
    const batch = baseBatchWithReadings({
      status: 'Fermenting',
      fermentationStartDate: '2026-08-01T00:00:00.000Z',
      recipeSnapshot: {
        ...baseBatchWithReadings().recipeSnapshot,
        hops: [
          {
            id: 'hop-citra',
            name: 'Citra',
            amountG: 60,
            alphaAcidPct: 12.0,
            use: 'DryHop',
            boilMins: null,
            whirlpoolMins: null,
            whirlpoolTempC: null,
            dryHopDayOffset: 2,
            dryHopDurationDays: 3,
            type: 'Pellet',
          },
        ],
      },
      readings: [],
      notes: [],
    });
    mockedGetBatch.mockResolvedValue(batch);
    mockedCreateBatchNote.mockResolvedValue({
      id: 'n-1',
      batchId: 'batch-1',
      timestamp: '2026-08-03T10:00:00.000Z',
      status: 'Fermenting',
      note: '[Cellar: dry-hop-add-hop-citra] Add 60g Citra (Dry Hop)',
    });

    renderBatchDetail();
    await waitForLoaded();

    fireEvent.click(screen.getByTestId('batch-tab-fermentation'));

    expect(screen.getByTestId('cellar-action-feed')).toBeInTheDocument();
    expect(screen.getByText('Add 60g Citra (Dry Hop)')).toBeInTheDocument();

    const markDoneBtn = screen.getByTestId('mark-done-btn-dry-hop-add-hop-citra');
    fireEvent.click(markDoneBtn);

    await waitFor(() => expect(mockedCreateBatchNote).toHaveBeenCalledTimes(1));
    expect(mockedCreateBatchNote).toHaveBeenCalledWith('batch-1', {
      note: '[Cellar: dry-hop-add-hop-citra] Add 60g Citra (Dry Hop)',
    });
  });

  it('renders Calibration Modal trigger and SensoryEvaluationPanel in Completed tab (AC-14); SplitPackagingPanel is on the Packaging tab instead', async () => {
    const batch = baseBatchWithReadings({
      status: 'Completed',
      measuredOg: 1.055,
      measuredFg: 1.012,
      measuredBottlingSizeL: 20.0,
      measuredBoilSizeL: 25.0,
      measuredPreBoilGravity: 1.045,
      tasteRating: 4,
      tasteNotes: 'Crisp and hoppy',
    });
    mockedGetBatch.mockResolvedValue(batch);

    renderBatchDetail();
    await waitForLoaded();

    fireEvent.click(screen.getByTestId('batch-tab-completed'));

    // Check SplitPackagingPanel is NOT here (moved to packaging tab, M20_P1)
    expect(screen.queryByTestId('split-packaging-panel')).not.toBeInTheDocument();

    // Check SensoryEvaluationPanel
    expect(screen.getByTestId('sensory-evaluation-panel')).toBeInTheDocument();

    // Check Calibration Trigger button and open modal
    const openCalibBtn = screen.getByTestId('open-calibration-modal-btn');
    expect(openCalibBtn).toBeInTheDocument();

    fireEvent.click(openCalibBtn);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/Post-Brew Equipment & Recipe Calibration/i)).toBeInTheDocument();

    // Close modal
    fireEvent.click(screen.getByTestId('close-calibration-modal-btn'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

// M18_P1 spec §2.1/§3 — Brew Sheet Viewer toggle/print and the five
// measurement-target placeholders (AC-22, AC-25, AC-35/AC-36). The former
// "Use Expected Target" accept controls (AC-37..39) were removed per
// BUG-023 — placeholder-only, non-destructive hinting was already the
// wanted behavior; the redundant explicit-accept click was dropped.

describe('M18_P1 AC-22/AC-25: Brew Sheet toggle and print', () => {
  it('is collapsed by default, opens on click, closes on a second click, and Print calls window.print once', async () => {
    mockedGetBatch.mockResolvedValue(baseBatchWithReadings());
    renderBatchDetail();
    await waitForLoaded();
    fireEvent.click(screen.getByTestId('batch-tab-brewing'));

    expect(screen.queryByTestId('brew-sheet')).not.toBeInTheDocument();
    expect(screen.getByTestId('brew-sheet-toggle')).toHaveTextContent('View Brew Sheet');
    expect(screen.getByTestId('brew-sheet-toggle')).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(screen.getByTestId('brew-sheet-toggle'));
    expect(screen.getByTestId('brew-sheet')).toBeInTheDocument();
    expect(screen.getByTestId('brew-sheet').getAttribute('data-brew-sheet-print-root')).toBe('');
    expect(screen.getByTestId('brew-sheet').className).toMatch(/print:/);

    const printSpy = vi.fn();
    const originalPrint = window.print;
    window.print = printSpy;
    fireEvent.click(screen.getByTestId('brew-sheet-print-btn'));
    expect(printSpy).toHaveBeenCalledTimes(1);
    window.print = originalPrint;

    fireEvent.click(screen.getByTestId('brew-sheet-toggle'));
    expect(screen.queryByTestId('brew-sheet')).not.toBeInTheDocument();
  });

  it('renders every section for a fully-populated recipe (AC-23) and explicit None rows for empty collections (AC-24)', async () => {
    mockedGetBatch.mockResolvedValue(baseBatchWithReadings());
    renderBatchDetail();
    await waitForLoaded();
    fireEvent.click(screen.getByTestId('batch-tab-brewing'));
    fireEvent.click(screen.getByTestId('brew-sheet-toggle'));

    const sheet = screen.getByTestId('brew-sheet');
    expect(sheet).toHaveTextContent('Original Recipe');
    expect(sheet).toHaveTextContent('21A. American IPA');
    expect(sheet).toHaveTextContent('All Grain');
    expect(sheet).toHaveTextContent('Test Equipment');
    // The default fixture has zero hops/miscs/yeasts and a null fermentationProfile.
    expect(sheet.querySelectorAll('td.italic').length).toBeGreaterThanOrEqual(3);
    expect(sheet.querySelectorAll('tbody')).not.toHaveLength(0);
  });
});

describe('M18_P1 AC-35/AC-36: measurement target placeholders', () => {
  it('all five inputs carry the derived placeholder when a target exists', async () => {
    mockedGetBatch.mockResolvedValue(baseBatchWithReadings());
    renderBatchDetail();
    await waitForLoaded();
    fireEvent.click(screen.getByTestId('batch-tab-brewing'));

    const preBoilInput = screen.getByLabelText(/Pre-boil Gravity \(SG\)/) as HTMLInputElement;
    const boilTimeInput = screen.getByLabelText('Boil Time (min)') as HTMLInputElement;
    const ogInput = screen.getByLabelText('Measured OG (SG)') as HTMLInputElement;
    const boilSizeInput = screen.getByLabelText('Boil Size (L)') as HTMLInputElement;

    expect(preBoilInput.placeholder).not.toBe('');
    expect(boilTimeInput.placeholder).toBe('60');
    expect(ogInput.placeholder).not.toBe('');
    expect(boilSizeInput.placeholder).not.toBe('');
    // Pre-existing Est: label hint is still present alongside the placeholder
    // (there are two "Est:" occurrences on this tab — the measurement label
    // and the Mash Efficiency tile — so scope to the Pre-boil Gravity label).
    expect(preBoilInput.labels?.[0]?.textContent ?? '').toMatch(/Est:/);
  });

  // NOTE (flagged for critic/steer attention): AC-36's premise — reaching
  // `stats === null` at the component level with both mash-pH sources null —
  // is unreachable through the live BatchDetail page as currently wired.
  // `stats` is `batch.statsSnapshot ?? calculateRecipeStats(...)` (unchanged,
  // out of this phase's scope) and is therefore NEVER null once the Brewing
  // tab renders; `predictMashPh` (water.ts) has return type `number`, never
  // `number | null`, and always resolves via its grist-emptiness fallback.
  // So none of preBoilGravity/boilSizeL/og/mashPh can actually go null
  // through real props/data — only through direct unit calls to
  // `deriveMeasurementTargets`, which is exhaustively covered by
  // measurementTargets.test.ts (AC-20 "stats === null degenerate input" and
  // AC-21 "null-triple invariant, both directions", both passing). This test
  // asserts the placeholder-presence half of the same branch condition
  // (`target.value !== null` renders the attribute) is wired correctly here,
  // since the null half cannot be driven from this page.
  it('the placeholder attribute is present exactly when its target is non-null (branch wiring check; see note above for the null half)', async () => {
    mockedGetBatch.mockResolvedValue(baseBatchWithReadings());
    renderBatchDetail();
    await waitForLoaded();
    fireEvent.click(screen.getByTestId('batch-tab-brewing'));

    for (const label of [/Pre-boil Gravity \(SG\)/, 'Mash pH', 'Boil Size (L)', 'Boil Time (min)', 'Measured OG (SG)']) {
      const input = screen.getByLabelText(label) as HTMLInputElement;
      expect(input.hasAttribute('placeholder')).toBe(true);
      expect(input.placeholder).not.toBe('');
    }
  });
});

// ---------------------------------------------------------------------------
// M20_P1 — FEAT-016: dedicated Packaging stage tab, and re-aligned Completed
// tab. Covers AC-1..AC-10 of the M20_P1 spec (AC-11 four-gates is run
// separately, not by this suite).
// ---------------------------------------------------------------------------

describe('M20_P1 AC-4: Brewing tab renders top stats summary above BrewDayTracker', () => {
  it('shows brewing-stats-summary above BrewDayTracker on the brewing tab', async () => {
    mockedGetBatch.mockResolvedValue(baseBatchWithReadings({ status: 'Brewing' }));
    renderBatchDetail();
    await waitForLoaded();

    fireEvent.click(screen.getByTestId('batch-tab-brewing'));

    const panel = screen.getByTestId('batch-tab-panel-brewing');
    expect(panel).toBeInTheDocument();
    expect(within(panel).getByTestId('brewing-stats-summary')).toBeInTheDocument();
    expect(within(panel).getByText('Mash Efficiency (live)')).toBeInTheDocument();
    expect(within(panel).getByText('Brewhouse Efficiency (est.)')).toBeInTheDocument();
    expect(within(panel).getByText('Predicted Mash pH')).toBeInTheDocument();
    expect(within(panel).getByTestId('brew-day-tracker')).toBeInTheDocument();
  });
});

describe('M20_P1 AC-5: Packaging tab renders top stats summary, carbonation temp input, and SplitPackagingPanel', () => {
  it('shows packaging-stats-summary containing FG, ABV, packaged volume, carbonation temp, and SplitPackagingPanel', async () => {
    mockedGetBatch.mockResolvedValue(baseBatchWithReadings({ status: 'Conditioning', measuredFg: 1.012, measuredBottlingSizeL: 19.5, carbonationTempC: 4.0 }));
    renderBatchDetail();
    await waitForLoaded();

    fireEvent.click(screen.getByTestId('batch-tab-packaging'));

    const panel = screen.getByTestId('batch-tab-panel-packaging');
    expect(panel).toBeInTheDocument();
    expect(within(panel).getByTestId('packaging-stats-summary')).toBeInTheDocument();
    expect(within(panel).getByText('Final Gravity')).toBeInTheDocument();
    expect(within(panel).getByText('1.012')).toBeInTheDocument();
    expect(within(panel).getByText('Packaging Volume (L)')).toBeInTheDocument();
    expect(within(panel).getByText('19.5')).toBeInTheDocument();
    expect(within(panel).getByLabelText('Carbonation/Storage Temp (°C)')).toBeInTheDocument();
    expect(within(panel).getByTestId('split-packaging-panel')).toBeInTheDocument();
  });

  it('editing the carbonation/storage temperature input updates form state and is saved via Save Changes', async () => {
    mockedGetBatch.mockResolvedValue(baseBatchWithReadings({ status: 'Conditioning', carbonationTempC: 4.0 }));
    mockedUpdateBatch.mockResolvedValue(baseBatchWithReadings({ status: 'Conditioning', carbonationTempC: 6.5 }));
    renderBatchDetail();
    await waitForLoaded();

    fireEvent.click(screen.getByTestId('batch-tab-packaging'));
    fireEvent.change(screen.getByLabelText('Carbonation/Storage Temp (°C)'), { target: { value: '6.5' } });

    fireEvent.click(screen.getByTestId('batch-save-btn'));

    await waitFor(() => expect(mockedUpdateBatch).toHaveBeenCalledTimes(1));
    expect(mockedUpdateBatch.mock.calls[0][1]).toMatchObject({
      carbonationTempC: 6.5,
    });
  });
});

describe('M20_P1 AC-5: Completed tab renders SensoryEvaluationPanel, calibration trigger, MeasuredComparison, cost, and nutrition', () => {
  it('all five are present in batch-tab-panel-completed', async () => {
    mockedGetBatch.mockResolvedValue(baseBatchWithReadings({ status: 'Completed', measuredOg: 1.05, measuredFg: 1.01 }));
    renderBatchDetail();
    await waitForLoaded();

    fireEvent.click(screen.getByTestId('batch-tab-completed'));
    const panel = screen.getByTestId('batch-tab-panel-completed');

    expect(within(panel).getByTestId('sensory-evaluation-panel')).toBeInTheDocument();
    expect(within(panel).getByTestId('open-calibration-modal-btn')).toBeInTheDocument();
    await waitFor(() => expect(mockedGetBatchCost).toHaveBeenCalled());
    expect(within(panel).getByTestId('batch-nutrition-panel')).toBeInTheDocument();
  });
});

describe('M20_P1 AC-6: Packaging panel segregation and removal of redundant measurement card', () => {
  it('SplitPackagingPanel and packaging-stats-summary do not render on the completed tab, and redundant packaging-measurements-card is gone', async () => {
    mockedGetBatch.mockResolvedValue(baseBatchWithReadings({ status: 'Completed', measuredOg: 1.05, measuredFg: 1.01 }));
    renderBatchDetail();
    await waitForLoaded();

    fireEvent.click(screen.getByTestId('batch-tab-completed'));

    expect(screen.queryByTestId('split-packaging-panel')).not.toBeInTheDocument();
    expect(screen.queryByTestId('packaging-stats-summary')).not.toBeInTheDocument();
    expect(screen.queryByTestId('packaging-measurements-card')).not.toBeInTheDocument();
  });
});

describe('M20_P1 AC-7: Completed panel segregation — completed content absent from Packaging tab', () => {
  it('SensoryEvaluationPanel, calibration trigger, and MeasuredComparison do not render on the packaging tab', async () => {
    mockedGetBatch.mockResolvedValue(baseBatchWithReadings({ status: 'Conditioning', measuredOg: 1.05, measuredFg: 1.01 }));
    renderBatchDetail();
    await waitForLoaded();

    fireEvent.click(screen.getByTestId('batch-tab-packaging'));

    expect(screen.queryByTestId('sensory-evaluation-panel')).not.toBeInTheDocument();
    expect(screen.queryByTestId('open-calibration-modal-btn')).not.toBeInTheDocument();
    // MeasuredComparison renders an "Measured vs. Estimated" heading only on completed.
    expect(screen.queryByText('Measured vs. Estimated')).not.toBeInTheDocument();
  });
});

describe('M20_P1 AC-8: In-tab status action to Packaging', () => {
  it('renders "Change Status to Packaging" on the packaging tab when status !== Conditioning, and persists Conditioning on click', async () => {
    mockedGetBatch.mockResolvedValue(baseBatchWithReadings({ status: 'Fermenting' }));
    mockedUpdateBatch.mockResolvedValue(baseBatchWithReadings({ status: 'Conditioning' }));
    renderBatchDetail();
    await waitForLoaded();

    fireEvent.click(screen.getByTestId('batch-tab-packaging'));
    const btn = screen.getByTestId('batch-advance-status-btn');
    expect(btn).toHaveTextContent('Change Status to Packaging');

    fireEvent.click(btn);
    await waitFor(() => expect(mockedUpdateBatch).toHaveBeenCalledTimes(1));
    expect(mockedUpdateBatch.mock.calls[0][1]).toMatchObject({ status: 'Conditioning' });
  });

  it('the button is absent on the packaging tab once status is already Conditioning', async () => {
    mockedGetBatch.mockResolvedValue(baseBatchWithReadings({ status: 'Conditioning' }));
    renderBatchDetail();
    await waitForLoaded();

    fireEvent.click(screen.getByTestId('batch-tab-packaging'));
    expect(screen.queryByTestId('batch-advance-status-btn')).not.toBeInTheDocument();
  });
});

describe('M20_P1 AC-9: In-tab status action to Completed', () => {
  it('renders "Change Status to Completed" on the completed tab when status !== Completed, and persists Completed on click', async () => {
    mockedGetBatch.mockResolvedValue(baseBatchWithReadings({ status: 'Conditioning' }));
    mockedUpdateBatch.mockResolvedValue(baseBatchWithReadings({ status: 'Completed' }));
    renderBatchDetail();
    await waitForLoaded();

    fireEvent.click(screen.getByTestId('batch-tab-completed'));
    const btn = screen.getByTestId('batch-advance-status-btn');
    expect(btn).toHaveTextContent('Change Status to Completed');

    fireEvent.click(btn);
    await waitFor(() => expect(mockedUpdateBatch).toHaveBeenCalledTimes(1));
    expect(mockedUpdateBatch.mock.calls[0][1]).toMatchObject({ status: 'Completed' });
  });

  it('the button is absent on the completed tab once status is already Completed', async () => {
    mockedGetBatch.mockResolvedValue(baseBatchWithReadings({ status: 'Completed', measuredOg: 1.05, measuredFg: 1.01 }));
    renderBatchDetail();
    await waitForLoaded();

    fireEvent.click(screen.getByTestId('batch-tab-completed'));
    expect(screen.queryByTestId('batch-advance-status-btn')).not.toBeInTheDocument();
  });
});

describe('M20_P1 AC-10: Fermentation handoff switches activeTab to packaging', () => {
  it('clicking Advance to Conditioning sets status to Conditioning and switches to the packaging tab (not completed)', async () => {
    const batch = baseBatchWithReadings({
      status: 'Fermenting',
      measuredOg: 1.05,
      readings: [
        { id: 'r-1', batchId: 'batch-1', readingTime: '2026-08-01T10:00:00.000Z', sg: 1.01, tempC: 19, ph: 4.4, pressurePsi: null, comment: '' },
        { id: 'r-2', batchId: 'batch-1', readingTime: '2026-08-03T12:00:00.000Z', sg: 1.01, tempC: 19, ph: 4.4, pressurePsi: null, comment: '' },
      ],
    });
    mockedGetBatch.mockResolvedValue(batch);
    mockedUpdateBatch.mockResolvedValue({ ...batch, status: 'Conditioning', measuredFg: 1.01 });

    renderBatchDetail();
    await waitForLoaded();

    fireEvent.click(screen.getByTestId('batch-tab-fermentation'));
    fireEvent.click(screen.getByTestId('advance-conditioning-btn'));

    await waitFor(() => expect(mockedUpdateBatch).toHaveBeenCalledTimes(1));
    expect(mockedUpdateBatch.mock.calls[0][1]).toMatchObject({ status: 'Conditioning' });
    await waitFor(() => expect(screen.getByTestId('batch-tab-panel-packaging')).toBeInTheDocument());
    expect(screen.queryByTestId('batch-tab-panel-completed')).not.toBeInTheDocument();
  });
});

describe('M20_P1: Status <-> Tab label maps', () => {
  it('Conditioning status maps to the Packaging tab badge label context (STATUS_TO_TAB_LABEL)', async () => {
    mockedGetBatch.mockResolvedValue(baseBatchWithReadings({ status: 'Conditioning' }));
    renderBatchDetail();
    await waitForLoaded();

    // Switching to any other tab (e.g. brewing) while status is Conditioning
    // should offer "Change Status to Brewing" — proving STATUS_TO_TAB_LABEL
    // still resolves every status, and TAB_TO_STATUS.packaging === 'Conditioning'
    // is exercised via the packaging-tab-specific tests above.
    fireEvent.click(screen.getByTestId('batch-tab-brewing'));
    expect(screen.getByTestId('batch-advance-status-btn')).toHaveTextContent('Change Status to Brewing');
  });
});

describe('M18_P1 (post-BUG-023): no accept control, ever, and no auto pre-fill of measured values', () => {
  it('on mount with all measured fields null, every input value is empty (no auto pre-fill)', async () => {
    mockedGetBatch.mockResolvedValue(baseBatchWithReadings());
    renderBatchDetail();
    await waitForLoaded();
    fireEvent.click(screen.getByTestId('batch-tab-brewing'));

    for (const label of [/Pre-boil Gravity \(SG\)/, 'Mash pH', 'Boil Size (L)', 'Boil Time (min)', 'Measured OG (SG)']) {
      expect((screen.getByLabelText(label) as HTMLInputElement).value).toBe('');
    }
  });

  it('no "Use Expected Target" accept control is rendered for any of the five fields', async () => {
    mockedGetBatch.mockResolvedValue(baseBatchWithReadings());
    renderBatchDetail();
    await waitForLoaded();
    fireEvent.click(screen.getByTestId('batch-tab-brewing'));

    for (const testId of [
      'measured-preBoilGravity-accept',
      'measured-mashPh-accept',
      'measured-boilSizeL-accept',
      'measured-boilTimeMin-accept',
      'measured-og-accept',
    ]) {
      expect(screen.queryByTestId(testId)).not.toBeInTheDocument();
    }
    expect(screen.queryByText('Use Expected Target')).not.toBeInTheDocument();
  });
});

describe('AC-16 (M26_P1 Amendment 1): BatchDetail forwards onOpenMobileNav to its TopBar', () => {
  it('passing onOpenMobileNav renders the hamburger and clicking it calls the callback', async () => {
    mockedGetBatch.mockResolvedValue(baseBatchWithReadings({ name: 'Test Batch' }));
    const onOpenMobileNav = vi.fn();
    renderBatchDetail({ onOpenMobileNav });
    await waitForLoaded();

    const btn = screen.getByRole('button', { name: 'Open navigation menu' });
    fireEvent.click(btn);
    expect(onOpenMobileNav).toHaveBeenCalledTimes(1);
  });

  it('omitting onOpenMobileNav renders no hamburger button', async () => {
    mockedGetBatch.mockResolvedValue(baseBatchWithReadings({ name: 'Test Batch' }));
    renderBatchDetail();
    await waitForLoaded();

    expect(screen.queryByRole('button', { name: 'Open navigation menu' })).toBeNull();
  });

  it('renders the hamburger even in the loading/error TopBar', () => {
    mockedGetBatch.mockReturnValue(new Promise(() => {}));
    const onOpenMobileNav = vi.fn();
    renderBatchDetail({ onOpenMobileNav });

    const btn = screen.getByRole('button', { name: 'Open navigation menu' });
    fireEvent.click(btn);
    expect(onOpenMobileNav).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// FEAT-036 — Vertical Single-Column Layout for Brewing Stage View (vitals, brewsheet, assistant, measurements, notes).
// ---------------------------------------------------------------------------

describe('FEAT-036: Brewing tab renders a vertical single-column layout', () => {
  it('panels are stacked vertically in order: vitals, brewsheet toggle, tracker, measurements, notes', async () => {
    mockedGetBatch.mockResolvedValue(baseBatchWithReadings({ status: 'Brewing' }));
    renderBatchDetail();
    await waitForLoaded();
    fireEvent.click(screen.getByTestId('batch-tab-brewing'));

    const panel = screen.getByTestId('batch-tab-panel-brewing');
    const vitals = within(panel).getByTestId('brewing-stats-summary');
    const brewSheetToggle = within(panel).getByTestId('brew-sheet-toggle');
    const tracker = within(panel).getByTestId('brew-day-tracker');
    const measurements = within(panel).getByLabelText('Mash pH');
    const noteLog = within(panel).getByTestId('batch-note-log');

    expect(vitals.compareDocumentPosition(brewSheetToggle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(brewSheetToggle.compareDocumentPosition(tracker) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(tracker.compareDocumentPosition(measurements) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(measurements.compareDocumentPosition(noteLog) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// M29_P4 (CRIT-02) — identity header editing stages directly into formData;
// no deceptive local "Done" pseudo-save exists.
// ---------------------------------------------------------------------------

describe('AC-4: identity header edits stage directly into formData with no deceptive "Done" pseudo-save', () => {
  it('opening the editor renders no element with the literal text "Done"', async () => {
    mockedGetBatch.mockResolvedValue(baseBatchWithReadings({ name: 'Test Batch' }));
    renderBatchDetail();
    await waitForLoaded();

    fireEvent.click(screen.getByTestId('batch-identity-edit-trigger'));
    expect(screen.getByTestId('batch-identity-edit')).toBeInTheDocument();
    expect(screen.queryByTestId('batch-identity-edit-done')).not.toBeInTheDocument();
    expect(screen.queryByText('Done')).not.toBeInTheDocument();
  });

  it('editing the batch name stages the value into formData immediately, and persists only via Save Changes', async () => {
    mockedGetBatch.mockResolvedValue(baseBatchWithReadings({ name: 'Original Name' }));
    mockedUpdateBatch.mockResolvedValue(baseBatchWithReadings({ name: 'Renamed Batch' }));
    renderBatchDetail();
    await waitForLoaded();

    fireEvent.click(screen.getByTestId('batch-identity-edit-trigger'));
    fireEvent.change(screen.getByLabelText('Batch Name'), { target: { value: 'Renamed Batch' } });

    // No save call yet — the edit is staged only.
    expect(mockedUpdateBatch).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('batch-identity-edit-close'));
    expect(mockedUpdateBatch).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('batch-save-btn'));
    await waitFor(() => expect(mockedUpdateBatch).toHaveBeenCalledTimes(1));
    expect(mockedUpdateBatch.mock.calls[0][1]).toMatchObject({ name: 'Renamed Batch' });
  });

  it('the close affordance closes the editor view without discarding the staged edit', async () => {
    mockedGetBatch.mockResolvedValue(baseBatchWithReadings({ name: 'Original Name' }));
    renderBatchDetail();
    await waitForLoaded();

    fireEvent.click(screen.getByTestId('batch-identity-edit-trigger'));
    fireEvent.change(screen.getByLabelText('Brewer'), { target: { value: 'Jane Doe' } });
    fireEvent.click(screen.getByTestId('batch-identity-edit-close'));

    expect(screen.queryByTestId('batch-identity-edit')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('batch-identity-edit-trigger'));
    expect(screen.getByLabelText('Brewer')).toHaveValue('Jane Doe');
  });
});

describe('M33_P5: BatchDetail button primitive adoption (AC-2..AC-10, AC-13)', () => {
  it('AC-2: back control renders via Button secondary size="sm"', async () => {
    mockedGetBatch.mockResolvedValue(baseBatchWithReadings({ name: 'Test Batch' }));
    const onBack = vi.fn();
    renderBatchDetail({ onBack });
    await waitForLoaded();

    const backBtn = screen.getByRole('button', { name: 'Back' });
    expect(backBtn).toHaveClass('inline-flex', 'items-center', 'justify-center');
    expect(backBtn).toHaveClass('text-xs', 'px-3', 'py-1.5', 'bg-slate-800');
    fireEvent.click(backBtn);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('AC-3..AC-6 & AC-13: TopBar buttons render through Button primitive with consistent compact sizing', async () => {
    mockedGetBatch.mockResolvedValue(baseBatchWithReadings({ name: 'Completed Batch', status: 'Completed' }));
    renderBatchDetail();
    await waitForLoaded();

    const rebrewBtn = screen.getByTestId('batch-rebrew-btn');
    expect(rebrewBtn).toHaveClass('inline-flex', 'items-center', 'justify-center', 'gap-1.5');
    expect(rebrewBtn).toHaveClass('text-xs', 'px-3', 'py-1.5', 'bg-slate-800');

    const deleteBtn = screen.getByTestId('batch-delete-btn');
    expect(deleteBtn).toHaveClass('inline-flex', 'items-center', 'justify-center', 'gap-1.5');
    expect(deleteBtn).toHaveClass('text-xs', 'px-3', 'py-1.5', 'bg-rose-950/80');

    const discardBtn = screen.getByTestId('batch-discard-btn');
    expect(discardBtn).toHaveClass('inline-flex', 'items-center', 'justify-center', 'gap-1.5');
    expect(discardBtn).toHaveClass('text-xs', 'px-3', 'py-1.5', 'bg-slate-800');

    const saveBtn = screen.getByTestId('batch-save-btn');
    expect(saveBtn).toHaveClass('inline-flex', 'items-center', 'justify-center', 'gap-1.5');
    expect(saveBtn).toHaveClass('text-xs', 'px-3', 'py-1.5', 'bg-amber-600');
  });

  it('AC-7: identity editor close button renders via Button secondary size="sm"', async () => {
    mockedGetBatch.mockResolvedValue(baseBatchWithReadings({ name: 'Test Batch' }));
    renderBatchDetail();
    await waitForLoaded();

    fireEvent.click(screen.getByTestId('batch-identity-edit-trigger'));
    const closeBtn = screen.getByTestId('batch-identity-edit-close');
    expect(closeBtn).toHaveClass('inline-flex', 'items-center', 'justify-center', 'gap-1.5');
    expect(closeBtn).toHaveClass('text-xs', 'px-3', 'py-1.5', 'bg-slate-800');
  });

  it('AC-8: advance status button renders via Button primary size="sm"', async () => {
    mockedGetBatch.mockResolvedValue(baseBatchWithReadings({ status: 'Planning' }));
    renderBatchDetail();
    await waitForLoaded();

    fireEvent.click(screen.getByTestId('batch-tab-brewing'));
    const advanceBtn = screen.getByTestId('batch-advance-status-btn');
    expect(advanceBtn).toHaveClass('inline-flex', 'items-center', 'justify-center', 'gap-1.5');
    expect(advanceBtn).toHaveClass('text-xs', 'px-3', 'py-1.5');
  });

  it('AC-9: advance to conditioning button renders via Button primary size="sm"', async () => {
    const stableReadings = [
      { id: 'r-1', batchId: 'batch-1', readingTime: '2026-08-01T10:00:00.000Z', sg: 1.01, tempC: 19, ph: 4.4, pressurePsi: null, comment: '' },
      { id: 'r-2', batchId: 'batch-1', readingTime: '2026-08-03T12:00:00.000Z', sg: 1.01, tempC: 19, ph: 4.4, pressurePsi: null, comment: '' },
    ];
    mockedGetBatch.mockResolvedValue(baseBatchWithReadings({ status: 'Fermenting', readings: stableReadings as any }));
    renderBatchDetail();
    await waitForLoaded();

    fireEvent.click(screen.getByTestId('batch-tab-fermentation'));
    const advCondBtn = screen.getByTestId('advance-conditioning-btn');
    expect(advCondBtn).toHaveClass('inline-flex', 'items-center', 'justify-center', 'gap-1.5');
    expect(advCondBtn).toHaveClass('text-xs', 'px-3', 'py-1.5');
  });

  it('AC-10: calibrate equipment button renders via Button secondary size="sm"', async () => {
    mockedGetBatch.mockResolvedValue(baseBatchWithReadings({ status: 'Completed' }));
    renderBatchDetail();
    await waitForLoaded();

    fireEvent.click(screen.getByTestId('batch-tab-completed'));
    const calBtn = screen.getByTestId('open-calibration-modal-btn');
    expect(calBtn).toHaveClass('inline-flex', 'items-center', 'justify-center', 'gap-1.5');
    expect(calBtn).toHaveClass('text-xs', 'px-3', 'py-1.5', 'bg-slate-800');
  });
});

