// M18_P1 spec §2.1 — component tests for BrewDayTimelineBar (AC-26, AC-27).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import type { Recipe, EquipmentProfile } from '@truchabrew/shared-types';
import { buildBrewDayTimeline, calculateRecipeStats } from '@truchabrew/calculations';
import { BrewDayTimelineBar } from '../src/components/BrewDayTimelineBar';

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

function baseRecipe(): Recipe {
  return {
    id: 'recipe-1',
    name: 'Test IPA',
    author: 'Tester',
    styleName: 'IPA',
    equipment: baseEquipment(),
    fermentables: [{ id: 'f-1', name: 'Pale Malt', type: 'Grain', amountKg: 5, colorSrm: 2, potentialSg: 1.037 }],
    hops: [
      { id: 'h-boil', name: 'Magnum', amountG: 20, alphaAcidPct: 14, use: 'Boil', boilMins: 60, whirlpoolMins: null, whirlpoolTempC: null, type: 'Pellet' },
      { id: 'h-whirl', name: 'Citra', amountG: 40, alphaAcidPct: 12, use: 'Whirlpool', boilMins: null, whirlpoolMins: 20, whirlpoolTempC: 79, type: 'Pellet' },
    ],
    yeasts: [{ id: 'y-1', name: 'US-05', type: 'Ale', form: 'Dry', laboratory: 'Fermentis', attenuationPct: 75, amountPkg: 1 }],
    miscs: [],
    notes: '',
    mashProfile: {
      id: 'mash-1',
      name: 'Single Infusion',
      targetPh: 5.4,
      spargeTempC: null,
      steps: [{ id: 'step-1', name: 'Sacc Rest', type: 'Infusion', stepTempC: 67, stepTimeMin: 60, rampTimeMin: 0, infuseAmountL: null, infuseWaterTempC: 72 }],
    },
    fermentationProfile: null,
  };
}

describe('AC-26: continuous bar replaces the pill row', () => {
  it('renders brew-day-timeline-bar with exactly 4 segment elements whose inline widths match widthFraction; clicking a segment fires onSelectStage', () => {
    const recipe = baseRecipe();
    const stats = calculateRecipeStats(recipe);
    const model = buildBrewDayTimeline({ recipe, stats, strikeTempC: null });
    const onSelectStage = vi.fn();
    render(<BrewDayTimelineBar model={model} activeStageIndex={0} onSelectStage={onSelectStage} />);

    const bar = screen.getByTestId('brew-day-timeline-bar');
    expect(bar).toBeInTheDocument();
    const segmentButtons = bar.querySelectorAll('button');
    expect(segmentButtons.length).toBe(4);

    segmentButtons.forEach((btn, idx) => {
      const width = parseFloat((btn as HTMLElement).style.width);
      expect(width).toBeCloseTo(model.segments[idx].widthFraction * 100, 6);
    });

    fireEvent.click(screen.getByTestId('brew-day-stage-boil'));
    expect(onSelectStage).toHaveBeenCalledWith(2);
  });
});

describe('AC-27: milestone dots render', () => {
  it('renders one dot per milestone, each positioned by its position and carrying accessible label text', () => {
    const recipe = baseRecipe();
    const stats = calculateRecipeStats(recipe);
    const model = buildBrewDayTimeline({ recipe, stats, strikeTempC: null });
    render(<BrewDayTimelineBar model={model} activeStageIndex={0} onSelectStage={vi.fn()} />);

    const dots = screen.getByTestId('brew-day-timeline-milestones').querySelectorAll('span');
    expect(dots.length).toBe(model.milestones.length);

    dots.forEach((dot, idx) => {
      const milestone = model.milestones[idx];
      expect(dot.getAttribute('title')).toBe(milestone.label);
      expect(dot.getAttribute('aria-label')).toBe(milestone.label);
      const left = parseFloat((dot as HTMLElement).style.left);
      expect(left).toBeCloseTo(milestone.position * 100, 6);
    });
  });
});
