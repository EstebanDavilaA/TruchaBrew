// M15_P1 spec §2.2 — component tests for in-batch substitutions, live vitals
// recalculation, and the snapshot update (AC-4/AC-5/AC-6).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import type { BatchWithReadings, EquipmentProfile, Recipe, UserConfig } from '@truchabrew/shared-types';
import { BatchRecipeAdjustModal } from '../src/components/BatchRecipeAdjustModal';
import { ApiClientError } from '../src/api/client';
import { ConfigProvider } from '../src/context/ConfigContext';

vi.mock('../src/context/CatalogContext', () => ({
  useCatalog: () => ({
    catalog: { fermentables: [], hops: [], yeasts: [], miscs: [] },
    loading: false,
    error: null,
    reload: vi.fn(),
  }),
}));

vi.mock('../src/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/api/client')>();
  return { ...actual, updateBatchRecipeSnapshot: vi.fn() };
});

import { updateBatchRecipeSnapshot } from '../src/api/client';

const mockedUpdate = vi.mocked(updateBatchRecipeSnapshot);

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

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === '/api/config') return Promise.resolve(jsonResponse(DEFAULT_TEST_CONFIG));
      return Promise.reject(new Error(`Unexpected fetch call in BatchRecipeAdjustModal.test.tsx: ${url}`));
    }),
  );
  mockedUpdate.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const equipment: EquipmentProfile = {
  id: 'eq-1',
  name: 'Test Rig',
  batchSizeL: 20,
  boilTimeMin: 60,
  brewhouseEfficiencyPct: 72,
  mashEfficiencyPct: 75,
  boilOffRateLPerHour: 3,
  trubChillerLossL: 1,
  hopUtilizationPct: 100,
  derivedFromEquipmentId: null,
  mashWaterRatioLPerKg: 3,
  grainAbsorptionLPerKg: 1,
  hopstandUtilizationFactor: 0.2,
  hopstandTemperatureC: 80,
  spargeTemperatureC: 76,
  mashTunHeatCapacityL: 0,
  grainTemperatureC: 20,
  notes: '',
};

function baseRecipe(): Recipe {
  return {
    id: 'recipe-1',
    name: 'Test IPA',
    author: 'Tester',
    styleName: 'IPA',
    equipment,
    fermentables: [{ id: 'f-1', name: 'Pale Malt', type: 'Grain', amountKg: 5, colorSrm: 2, potentialSg: 1.037 }],
    hops: [{ id: 'h-1', name: 'Citra', amountG: 30, alphaAcidPct: 12, use: 'Boil', boilMins: 60, whirlpoolMins: null, whirlpoolTempC: null, type: 'Pellet' }],
    yeasts: [{ id: 'y-1', name: 'US-05', type: 'Ale', form: 'Dry', laboratory: 'Fermentis', attenuationPct: 75, amountPkg: 1 }],
    miscs: [],
    notes: '',
    mashProfile: null,
    fermentationProfile: null,
  };
}

function baseBatch(recipe: Recipe = baseRecipe()): BatchWithReadings {
  return {
    id: 'batch-1',
    name: 'Batch #1 - Test IPA',
    batchNo: 1,
    status: 'Planning',
    recipeId: recipe.id,
    recipeSnapshot: recipe,
    statsSnapshot: null,
    measuredPreBoilGravity: null,
    measuredMashPh: null,
    measuredBoilSizeL: null,
    measuredBoilTimeMin: null,
    measuredOg: null,
    fermentationStartDate: null,
    measuredFg: null,
    measuredBottlingSizeL: null,
    carbonationType: null,
    carbonationVolumesTarget: null,
    carbonationTempC: null,
    tasteNotes: '',
    tasteRating: null,
    bottlingDate: null,
    closingSnapshot: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    readings: [],
    notes: [],
  };
}

function renderModal(props: Partial<Parameters<typeof BatchRecipeAdjustModal>[0]> = {}) {
  const batch = props.batch ?? baseBatch();
  const onClose = props.onClose ?? vi.fn();
  const onSaved = props.onSaved ?? vi.fn();
  return {
    onClose,
    onSaved,
    batch,
    ...render(
      <ConfigProvider>
        <BatchRecipeAdjustModal open={props.open ?? true} batch={batch} onClose={onClose} onSaved={onSaved} />
      </ConfigProvider>,
    ),
  };
}

describe('AC-4: opening the modal and editing recipeSnapshot without mutating the source', () => {
  it('renders when open, hides when closed', async () => {
    const { rerender } = renderModal({ open: false });
    expect(screen.queryByTestId('batch-recipe-adjust-modal')).not.toBeInTheDocument();

    rerender(
      <ConfigProvider>
        <BatchRecipeAdjustModal open={true} batch={baseBatch()} onClose={vi.fn()} onSaved={vi.fn()} />
      </ConfigProvider>,
    );
    await waitFor(() => screen.getByTestId('batch-recipe-adjust-modal'));
  });

  it('editing a fermentable amount does not mutate the original batch.recipeSnapshot object', async () => {
    const batch = baseBatch();
    const originalAmount = batch.recipeSnapshot.fermentables[0].amountKg;
    renderModal({ batch });
    await waitFor(() => screen.getByTestId('batch-recipe-adjust-modal'));

    const amountInput = screen.getByLabelText('Pale Malt amount (kg)') as HTMLInputElement;
    fireEvent.change(amountInput, { target: { value: '7' } });

    expect(batch.recipeSnapshot.fermentables[0].amountKg).toBe(originalAmount);
    expect((screen.getByLabelText('Pale Malt amount (kg)') as HTMLInputElement).value).toBe('7');
  });
});

describe('AC-5: live vitals recalculation', () => {
  it('OG updates immediately when a fermentable amount changes', async () => {
    renderModal();
    await waitFor(() => screen.getByTestId('batch-recipe-adjust-modal'));

    const ogBefore = screen.getByTestId('live-vitals-og').textContent;

    fireEvent.change(screen.getByLabelText('Pale Malt amount (kg)'), { target: { value: '9' } });

    await waitFor(() => expect(screen.getByTestId('live-vitals-og').textContent).not.toBe(ogBefore));
  });

  it('IBU updates immediately when a hop amount changes', async () => {
    renderModal();
    await waitFor(() => screen.getByTestId('batch-recipe-adjust-modal'));

    const ibuBefore = screen.getByTestId('live-vitals-ibu').textContent;
    fireEvent.change(screen.getByLabelText('Citra amount (g)'), { target: { value: '90' } });

    await waitFor(() => expect(screen.getByTestId('live-vitals-ibu').textContent).not.toBe(ibuBefore));
  });
});

describe('AC-6: master recipe sync toggle', () => {
  it('defaults unchecked, and Save calls updateBatchRecipeSnapshot with syncToMasterRecipe: false', async () => {
    mockedUpdate.mockResolvedValue(baseBatch());
    const { onSaved, onClose } = renderModal();
    await waitFor(() => screen.getByTestId('batch-recipe-adjust-modal'));

    expect((screen.getByTestId('batch-recipe-adjust-sync-checkbox') as HTMLInputElement).checked).toBe(false);

    fireEvent.click(screen.getByTestId('batch-recipe-adjust-save-btn'));

    await waitFor(() => expect(mockedUpdate).toHaveBeenCalledTimes(1));
    expect(mockedUpdate.mock.calls[0][0]).toBe('batch-1');
    expect(mockedUpdate.mock.calls[0][2]).toBe(false);
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(onClose).toHaveBeenCalled();
  });

  it('checking the sync checkbox and saving calls updateBatchRecipeSnapshot with syncToMasterRecipe: true', async () => {
    mockedUpdate.mockResolvedValue(baseBatch());
    renderModal();
    await waitFor(() => screen.getByTestId('batch-recipe-adjust-modal'));

    fireEvent.click(screen.getByTestId('batch-recipe-adjust-sync-checkbox'));
    fireEvent.click(screen.getByTestId('batch-recipe-adjust-save-btn'));

    await waitFor(() => expect(mockedUpdate).toHaveBeenCalledTimes(1));
    expect(mockedUpdate.mock.calls[0][2]).toBe(true);
  });

  it('a rejected save surfaces the error and does not close the modal', async () => {
    mockedUpdate.mockRejectedValue(new ApiClientError('VALIDATION_FAILED', 'Something went wrong.'));
    const { onClose } = renderModal();
    await waitFor(() => screen.getByTestId('batch-recipe-adjust-modal'));

    fireEvent.click(screen.getByTestId('batch-recipe-adjust-save-btn'));

    await waitFor(() => screen.getByTestId('batch-recipe-adjust-error'));
    expect(screen.getByTestId('batch-recipe-adjust-error')).toHaveTextContent('Something went wrong.');
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('Cancel / close resets local edits on reopen', () => {
  it('Cancel calls onClose without calling updateBatchRecipeSnapshot', async () => {
    const { onClose } = renderModal();
    await waitFor(() => screen.getByTestId('batch-recipe-adjust-modal'));

    fireEvent.click(screen.getByTestId('batch-recipe-adjust-cancel-btn'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mockedUpdate).not.toHaveBeenCalled();
  });
});

describe('Scale Recipe in BatchRecipeAdjustModal', () => {
  it('opens scale dialog when clicking Scale Recipe button', async () => {
    renderModal();
    await waitFor(() => screen.getByTestId('batch-recipe-adjust-modal'));

    const scaleBtn = screen.getByTestId('batch-recipe-scale-btn');
    expect(scaleBtn).toBeInTheDocument();

    fireEvent.click(scaleBtn);
    expect(screen.getByText('Scale Batch Recipe Volume')).toBeInTheDocument();
    expect(screen.getByTestId('batch-scale-apply-btn')).toBeInTheDocument();
  });

  it('scales fermentable and hop amounts proportionally when applying scale', async () => {
    renderModal();
    await waitFor(() => screen.getByTestId('batch-recipe-adjust-modal'));

    // Initial values: 5kg Pale Malt, 30g Citra on 20L
    expect((screen.getByLabelText('Pale Malt amount (kg)') as HTMLInputElement).value).toBe('5');
    expect((screen.getByLabelText('Citra amount (g)') as HTMLInputElement).value).toBe('30');

    fireEvent.click(screen.getByTestId('batch-recipe-scale-btn'));

    // Scale from 20L to 40L
    const targetInput = screen.getByLabelText('Target batch size in liters');
    fireEvent.change(targetInput, { target: { value: '40' } });
    fireEvent.click(screen.getByTestId('batch-scale-apply-btn'));

    // Modal closes and values double
    expect(screen.queryByText('Scale Batch Recipe Volume')).not.toBeInTheDocument();
    expect((screen.getByLabelText('Pale Malt amount (kg)') as HTMLInputElement).value).toBe('10');
    expect((screen.getByLabelText('Citra amount (g)') as HTMLInputElement).value).toBe('60');
  });
});

