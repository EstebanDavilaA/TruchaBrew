import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ClosingSnapshot } from '@truchabrew/shared-types';
import { BatchNutritionPanel } from '../src/components/BatchNutritionPanel';

function closingSnapshot(overrides: Partial<ClosingSnapshot> = {}): ClosingSnapshot {
  return {
    frozenAt: '2026-01-01T00:00:00.000Z',
    originalGravity: 1.05,
    finalGravity: 1.01,
    abv: 5.2,
    apparentAttenuationPct: 80,
    mashEfficiencyPct: 75,
    peakFermentationTempC: 20,
    beerVolumeL: 19,
    beerVolumeSource: 'measured',
    primingSugarG: 100,
    primingSugarEquivGPerL: 5,
    carbonationForcePsi: 12,
    ...overrides,
  };
}

describe('AC-49: BatchNutritionPanel', () => {
  it('closingSnapshot null renders the unavailable message and zero numbers, no request', () => {
    render(<BatchNutritionPanel closingSnapshot={null} />);
    expect(screen.getByTestId('batch-nutrition-unavailable')).toHaveTextContent('No closing snapshot recorded for this batch — nutrition is unavailable.');
    const panel = screen.getByTestId('batch-nutrition-panel');
    expect(/\d/.test(panel.textContent ?? '')).toBe(false);
  });

  it('a real snapshot renders the pinned per-serving and per-100mL figures', () => {
    render(<BatchNutritionPanel closingSnapshot={closingSnapshot({ originalGravity: 1.05, finalGravity: 1.01 })} />);
    expect(screen.getByTestId('batch-nutrition-calories')).toHaveTextContent('164');
    expect(screen.getByTestId('batch-nutrition-carbs')).toHaveTextContent('15.2 g');
    expect(screen.getByTestId('batch-nutrition-alcohol')).toHaveTextContent('14.9 g');
    expect(screen.getByTestId('batch-nutrition-per-100ml')).toHaveTextContent('46 kcal');
    expect(screen.getByTestId('batch-nutrition-per-100ml')).toHaveTextContent('4.3 g carbs');
    expect(document.body.textContent).not.toMatch(/NaN|undefined|null/);
  });

  it('FG > OG renders a negative ABW, not 0.0 and not blank', () => {
    render(<BatchNutritionPanel closingSnapshot={closingSnapshot({ originalGravity: 1.05, finalGravity: 1.06 })} />);
    expect(screen.getByTestId('batch-nutrition-abw')).toHaveTextContent('-1.0');
  });

  it('AC-22 (Amendment 2): the three-figure wrapper collapses to one column below sm', () => {
    render(<BatchNutritionPanel closingSnapshot={closingSnapshot()} />);
    const wrapper = screen.getByTestId('batch-nutrition-calories').closest('.grid') as HTMLElement;
    expect(wrapper).not.toBeNull();
    const tokens = wrapper.className.split(/\s+/);
    expect(tokens).toContain('grid');
    expect(tokens).toContain('grid-cols-1');
    expect(tokens).toContain('sm:grid-cols-3');
    expect(tokens).not.toContain('grid-cols-3');
  });
});
