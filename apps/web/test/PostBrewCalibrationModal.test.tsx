import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PostBrewCalibrationModal } from '../src/components/PostBrewCalibrationModal';
import type { CalibrationEvaluationResult } from '@truchabrew/calculations';
import type { EquipmentProfile, Recipe } from '@truchabrew/shared-types';

describe('M17_P1 AC-9..AC-11: PostBrewCalibrationModal', () => {
  const dummyEq: EquipmentProfile = {
    id: 'eq-1',
    name: 'Standard 20L',
    batchSizeL: 20,
    boilTimeMin: 60,
    boilOffRateLPerHour: 3.0,
    trubChillerLossL: 2.0,
    mashEfficiencyPct: 75.0,
    brewhouseEfficiencyPct: 70.0,
    mashTunDeadSpaceL: 0,
    grainAbsorptionLPerKg: 0.96,
    mashWaterRatioLPerKg: 3.0,
    spargeTemperatureC: 76,
    grainTemperatureC: 20,
    mashTunHeatCapacityL: 0,
    hopstandTemperatureC: 80,
    hopUtilizationPct: 100,
    hopstandUtilizationFactor: 0.1,
    derivedFromEquipmentId: null,
    notes: '',
  };

  const dummyRecipe: Recipe = {
    id: 'rec-1',
    name: 'IPA',
    author: 'Brewer',
    styleName: 'American IPA',
    equipment: dummyEq,
    fermentables: [],
    hops: [],
    yeasts: [],
    miscs: [],
    mashProfile: { id: 'mp-1', name: 'Single', targetPh: 5.3, spargeTempC: null, steps: [] },
    fermentationProfile: { id: 'fp-1', name: 'Ale', steps: [] },
    notes: '',
  };

  const dummyEvaluation: CalibrationEvaluationResult = {
    canCalibrate: true,
    estimatedBrewhouseEfficiencyPct: 70.0,
    achievedBrewhouseEfficiencyPct: 65.0,
    estimatedMashEfficiencyPct: 75.0,
    achievedMashEfficiencyPct: 72.0,
    currentBoilOffRateLPerHour: 3.0,
    achievedBoilOffRateLPerHour: 3.5,
    currentTrubLossL: 2.0,
    achievedTrubLossL: 1.8,
  };

  it('AC-21 (Amendment 2): comparison table scrolls instead of clipping — inner overflow-x-auto div, outer overflow-hidden + rounded-lg preserved', () => {
    const { container } = render(
      <PostBrewCalibrationModal
        isOpen={true}
        onClose={vi.fn()}
        evaluation={dummyEvaluation}
        equipmentProfile={dummyEq}
        recipe={dummyRecipe}
        onUpdateEquipmentProfile={vi.fn()}
        onUpdateRecipe={vi.fn()}
      />
    );

    const table = container.querySelector('table') as HTMLElement;
    const innerDiv = table.parentElement as HTMLElement;
    expect(innerDiv.tagName).toBe('DIV');
    expect(innerDiv.className.split(/\s+/)).toContain('overflow-x-auto');

    const outerDiv = innerDiv.parentElement as HTMLElement;
    expect(outerDiv.tagName).toBe('DIV');
    const outerTokens = outerDiv.className.split(/\s+/);
    expect(outerTokens).toContain('overflow-hidden');
    expect(outerTokens).toContain('rounded-lg');
  });

  it('renders modal with side-by-side metric comparison table (AC-9)', () => {
    render(
      <PostBrewCalibrationModal
        isOpen={true}
        onClose={vi.fn()}
        evaluation={dummyEvaluation}
        equipmentProfile={dummyEq}
        recipe={dummyRecipe}
        onUpdateEquipmentProfile={vi.fn()}
        onUpdateRecipe={vi.fn()}
      />
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByTestId('achieved-mash-eff')).toHaveTextContent('72.0%');
    expect(screen.getByTestId('achieved-brewhouse-eff')).toHaveTextContent('65.0%');
    expect(screen.getByTestId('achieved-boil-off')).toHaveTextContent('3.50 L/hr');
    expect(screen.getByTestId('achieved-trub-loss')).toHaveTextContent('1.80 L');
  });

  it('calls onUpdateEquipmentProfile with calibrated patch on click (AC-10)', async () => {
    const handleUpdateEq = vi.fn().mockResolvedValue(undefined);
    render(
      <PostBrewCalibrationModal
        isOpen={true}
        onClose={vi.fn()}
        evaluation={dummyEvaluation}
        equipmentProfile={dummyEq}
        recipe={dummyRecipe}
        onUpdateEquipmentProfile={handleUpdateEq}
        onUpdateRecipe={vi.fn()}
      />
    );

    const updateEqBtn = screen.getByTestId('calibrate-equipment-btn');
    fireEvent.click(updateEqBtn);

    expect(handleUpdateEq).toHaveBeenCalledWith('eq-1', {
      brewhouseEfficiencyPct: 65.0,
      mashEfficiencyPct: 72.0,
      boilOffRateLPerHour: 3.5,
      trubChillerLossL: 1.8,
    });
  });

  it('calls onUpdateRecipe with calibrated target efficiency on click (AC-11)', async () => {
    const handleUpdateRecipe = vi.fn().mockResolvedValue(undefined);
    render(
      <PostBrewCalibrationModal
        isOpen={true}
        onClose={vi.fn()}
        evaluation={dummyEvaluation}
        equipmentProfile={dummyEq}
        recipe={dummyRecipe}
        onUpdateEquipmentProfile={vi.fn()}
        onUpdateRecipe={handleUpdateRecipe}
      />
    );

    const updateRecBtn = screen.getByTestId('calibrate-recipe-btn');
    fireEvent.click(updateRecBtn);

    expect(handleUpdateRecipe).toHaveBeenCalledWith('rec-1', {
      equipment: expect.objectContaining({
        brewhouseEfficiencyPct: 65.0,
        mashEfficiencyPct: 72.0,
      }),
    });
  });
});
