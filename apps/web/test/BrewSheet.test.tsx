// M18_P1 spec §2.1 — component tests for BrewSheet (AC-22..AC-25).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import type { Recipe, EquipmentProfile } from '@truchabrew/shared-types';
import { buildBrewSheetModel, calculateRecipeStats } from '@truchabrew/calculations';
import { BrewSheet } from '../src/components/BrewSheet';

afterEach(() => cleanup());

function baseEquipment(overrides: Partial<EquipmentProfile> = {}): EquipmentProfile {
  return {
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
    hopstandTemperatureC: 79,
    spargeTemperatureC: 76,
    mashTunHeatCapacityL: 0,
    grainTemperatureC: 20,
    notes: '',
    ...overrides,
  };
}

function populatedRecipe(): Recipe {
  return {
    id: 'recipe-1',
    name: 'Test IPA',
    author: 'Tester',
    styleName: 'IPA',
    equipment: baseEquipment(),
    fermentables: [{ id: 'f-1', name: 'Pale Malt', type: 'Grain', amountKg: 5, colorSrm: 2, potentialSg: 1.037 }],
    hops: [{ id: 'h-1', name: 'Magnum', amountG: 20, alphaAcidPct: 14, use: 'Boil', boilMins: 60, whirlpoolMins: null, whirlpoolTempC: null, type: 'Pellet' }],
    yeasts: [{ id: 'y-1', name: 'US-05', type: 'Ale', form: 'Dry', laboratory: 'Fermentis', attenuationPct: 75, amountPkg: 1 }],
    miscs: [{ id: 'm-1', name: 'Whirlfloc', type: 'Fining', use: 'Boil', timeMinutes: 10, amount: 1, unit: 'each' }],
    notes: '',
    mashProfile: {
      id: 'mash-1',
      name: 'Single Infusion',
      targetPh: 5.4,
      spargeTempC: null,
      steps: [{ id: 'step-1', name: 'Sacc Rest', type: 'Infusion', stepTempC: 67, stepTimeMin: 60, rampTimeMin: 0, infuseAmountL: null, infuseWaterTempC: 72 }],
    },
    fermentationProfile: {
      id: 'ferm-1',
      name: 'Standard Ale',
      steps: [{ id: 'fs-1', name: 'Primary', type: 'Primary', stepTempC: 18, stepTimeDays: 14, rampDays: 0, pressurePsi: null }],
    },
  };
}

function emptyRecipe(): Recipe {
  return {
    id: 'recipe-2',
    name: 'Empty Recipe',
    author: 'Tester',
    styleName: 'Cider',
    equipment: baseEquipment(),
    fermentables: [],
    hops: [],
    yeasts: [],
    miscs: [],
    notes: '',
    mashProfile: null,
    fermentationProfile: null,
  };
}

describe('AC-22: Brew Sheet toggle', () => {
  it('is absent from the DOM and reads OFF by default; opens on click and closes on a second click', () => {
    const recipe = populatedRecipe();
    const stats = calculateRecipeStats(recipe);
    const model = buildBrewSheetModel({ recipe, stats, batchName: 'Batch #1', carbonationVolumesTarget: 2.4 });
    render(<BrewSheet model={model} />);

    expect(screen.queryByTestId('brew-sheet')).not.toBeInTheDocument();
    expect(screen.getByTestId('brew-sheet-toggle')).toHaveTextContent('View Brew Sheet');
    expect(screen.getByTestId('brew-sheet-toggle')).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(screen.getByTestId('brew-sheet-toggle'));
    expect(screen.getByTestId('brew-sheet')).toBeInTheDocument();
    expect(screen.getByTestId('brew-sheet-toggle')).toHaveTextContent('Hide Brew Sheet');
    expect(screen.getByTestId('brew-sheet-toggle')).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(screen.getByTestId('brew-sheet-toggle'));
    expect(screen.queryByTestId('brew-sheet')).not.toBeInTheDocument();
    expect(screen.getByTestId('brew-sheet-toggle')).toHaveAttribute('aria-expanded', 'false');
  });
});

describe('AC-23: Brew sheet renders every section', () => {
  it('shows all listed fields for a fully-populated recipe', () => {
    const recipe = populatedRecipe();
    const stats = calculateRecipeStats(recipe);
    const model = buildBrewSheetModel({ recipe, stats, batchName: 'Batch #1', carbonationVolumesTarget: 2.4 });
    render(<BrewSheet model={model} />);
    fireEvent.click(screen.getByTestId('brew-sheet-toggle'));

    const sheet = screen.getByTestId('brew-sheet');
    for (const text of [
      'Test IPA',
      'IPA',
      'All Grain',
      'Test Rig',
      model.equipment.brewhouseEfficiencyPct.toString(),
      model.volumes.mashWaterL.toFixed(1),
      model.volumes.spargeWaterL.toFixed(1),
      model.volumes.totalWaterL.toFixed(1),
      model.volumes.preBoilVolumeL.toFixed(1),
      model.volumes.preBoilGravity.toFixed(3),
      model.vitals.og.toFixed(3),
      model.vitals.fg.toFixed(3),
      model.vitals.ibu.toString(),
      model.vitals.buGu.toFixed(2),
      model.vitals.ebc.toFixed(1),
      model.mash.strikeTempC!.toFixed(1),
      'Sacc Rest',
      'Pale Malt',
      'Magnum',
      'Whirlfloc',
      'US-05',
      'Primary',
      '2.4',
    ]) {
      expect(sheet).toHaveTextContent(text);
    }
  });
});

describe('AC-24: empty collections', () => {
  it('renders without throwing, with an explicit None row in each of the five empty sections', () => {
    const recipe = emptyRecipe();
    const stats = calculateRecipeStats(recipe);
    const model = buildBrewSheetModel({ recipe, stats, batchName: 'Batch #2', carbonationVolumesTarget: null });
    expect(() => render(<BrewSheet model={model} />)).not.toThrow();
    fireEvent.click(screen.getByTestId('brew-sheet-toggle'));

    const sheet = screen.getByTestId('brew-sheet');
    const noneRows = sheet.querySelectorAll('td');
    const noneCount = Array.from(noneRows).filter((td) => td.textContent === 'None').length;
    // mash rests, fermentables, hops, miscs, yeasts, fermentation — 6 empty
    // sections in this fixture (Ambiguity 11's five named sections plus the
    // mash-rests table, which renders the identical explicit-None contract).
    expect(noneCount).toBe(6);
    expect(sheet.querySelectorAll('tbody').length).toBeGreaterThan(0);
  });
});

describe('AC-20 (Amendment 2): every BrewSheet table has an overflow-x-auto scroll container', () => {
  it('all 6 tables have a direct parent div with overflow-x-auto; table className is unchanged', () => {
    const recipe = populatedRecipe();
    const stats = calculateRecipeStats(recipe);
    const model = buildBrewSheetModel({ recipe, stats, batchName: 'Batch #1', carbonationVolumesTarget: 2.4 });
    const { container } = render(<BrewSheet model={model} />);
    fireEvent.click(screen.getByTestId('brew-sheet-toggle'));

    const tables = container.querySelectorAll('table');
    expect(tables.length).toBe(6);
    tables.forEach((table) => {
      const parent = table.parentElement as HTMLElement;
      expect(parent.tagName).toBe('DIV');
      expect(parent.className.split(/\s+/)).toContain('overflow-x-auto');
      expect(table.className).toBe('w-full border-collapse');
    });
  });
});

describe('AC-22 (Amendment 2): BrewSheet stat grid matches its siblings below sm', () => {
  it('the Vitals grid (formerly grid-cols-3 sm:grid-cols-4) is now grid-cols-2 sm:grid-cols-4, matching siblings, with no standalone grid-cols-3', () => {
    const recipe = populatedRecipe();
    const stats = calculateRecipeStats(recipe);
    const model = buildBrewSheetModel({ recipe, stats, batchName: 'Batch #1', carbonationVolumesTarget: 2.4 });
    const { container } = render(<BrewSheet model={model} />);
    fireEvent.click(screen.getByTestId('brew-sheet-toggle'));

    const grids = Array.from(container.querySelectorAll('.grid')) as HTMLElement[];
    expect(grids.length).toBeGreaterThanOrEqual(3);
    for (const grid of grids) {
      const tokens = grid.className.split(/\s+/);
      expect(tokens).toContain('grid-cols-2');
      expect(tokens).toContain('sm:grid-cols-4');
      expect(tokens).not.toContain('grid-cols-3');
    }
  });
});

describe('AC-25: print action', () => {
  it('calls window.print exactly once per click; root carries the print hooks', () => {
    const recipe = populatedRecipe();
    const stats = calculateRecipeStats(recipe);
    const model = buildBrewSheetModel({ recipe, stats, batchName: 'Batch #1', carbonationVolumesTarget: 2.4 });
    render(<BrewSheet model={model} />);
    fireEvent.click(screen.getByTestId('brew-sheet-toggle'));

    const sheet = screen.getByTestId('brew-sheet');
    expect(sheet.getAttribute('data-brew-sheet-print-root')).toBe('');
    expect(sheet.className).toMatch(/print:/);

    const printSpy = vi.fn();
    const original = window.print;
    window.print = printSpy;
    fireEvent.click(screen.getByTestId('brew-sheet-print-btn'));
    fireEvent.click(screen.getByTestId('brew-sheet-print-btn'));
    expect(printSpy).toHaveBeenCalledTimes(2);
    window.print = original;
  });
});
