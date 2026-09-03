import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { buildFermentationChartModel, type FermentationReadingPoint } from '@truchabrew/calculations';
import { FermentationChart } from '../src/components/FermentationChart';

function reading(overrides: Partial<FermentationReadingPoint> = {}): FermentationReadingPoint {
  return {
    id: 'r-1',
    readingTime: '2026-08-01T00:00:00.000Z',
    sg: null,
    tempC: null,
    ...overrides,
  };
}

describe('FermentationChart — a thin renderer over FermentationChartModel', () => {
  it('renders no <svg> for a hasPoints: false model', () => {
    const model = buildFermentationChartModel({ readings: [], fermentationStartDate: null });
    const { container } = render(<FermentationChart model={model} />);
    expect(container.querySelector('svg')).toBeNull();
  });

  it('renders one gravity point and one temperature point for a two-series reading, with both axes and legends present', () => {
    const readings = [
      reading({ id: 'r1', readingTime: '2026-08-01T00:00:00.000Z', sg: 1.06, tempC: 20 }),
      reading({ id: 'r2', readingTime: '2026-08-02T00:00:00.000Z', sg: 1.02, tempC: 19 }),
    ];
    const model = buildFermentationChartModel({ readings, fermentationStartDate: null });
    const { container } = render(<FermentationChart model={model} />);

    expect(container.querySelector('svg[data-testid="fermentation-chart"]')).not.toBeNull();
    expect(container.querySelectorAll('[data-testid^="gravity-point-"]')).toHaveLength(2);
    expect(container.querySelectorAll('[data-testid^="temperature-point-"]')).toHaveLength(2);
    expect(container.querySelector('[data-testid="legend-gravity"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="legend-temperature"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="gravity-line"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="temperature-line"]')).not.toBeNull();
  });

  it('a gravity-only series has no temperature axis, no temperature legend, no temperature points', () => {
    const readings = [reading({ id: 'r1', sg: 1.05 }), reading({ id: 'r2', readingTime: '2026-08-02T00:00:00.000Z', sg: 1.01 })];
    const model = buildFermentationChartModel({ readings, fermentationStartDate: null });
    const { container } = render(<FermentationChart model={model} />);

    expect(container.querySelector('[data-testid="gravity-axis"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="temperature-axis"]')).toBeNull();
    expect(container.querySelector('[data-testid="legend-temperature"]')).toBeNull();
    expect(container.querySelectorAll('[data-testid^="temperature-point-"]')).toHaveLength(0);
  });

  it('a temperature-only series has no gravity axis, no gravity legend, no gravity points', () => {
    const readings = [reading({ id: 'r1', tempC: 18 }), reading({ id: 'r2', readingTime: '2026-08-02T00:00:00.000Z', tempC: 20 })];
    const model = buildFermentationChartModel({ readings, fermentationStartDate: null });
    const { container } = render(<FermentationChart model={model} />);

    expect(container.querySelector('[data-testid="temperature-axis"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="gravity-axis"]')).toBeNull();
    expect(container.querySelector('[data-testid="legend-gravity"]')).toBeNull();
    expect(container.querySelectorAll('[data-testid^="gravity-point-"]')).toHaveLength(0);
  });

  it('renders exactly 5 gravity tick labels formatted to 3 decimal places, matching the model\'s ticks', () => {
    const readings = [reading({ id: 'r1', sg: 1.048 })]; // single reading -> degenerate axis, exact pads
    const model = buildFermentationChartModel({ readings, fermentationStartDate: null });
    if (!model.hasPoints) throw new Error('expected hasPoints true');

    const { container } = render(<FermentationChart model={model} />);
    const axis = container.querySelector('[data-testid="gravity-axis"]')!;
    const tickTexts = Array.from(axis.querySelectorAll('text')).map((t) => t.textContent);
    expect(tickTexts).toEqual(model.gravityAxis!.ticks.map((t) => t.toFixed(3)));
  });

  it('renders exactly 5 temperature tick labels formatted to 1 decimal place with a degree suffix', () => {
    const readings = [reading({ id: 'r1', tempC: 19 })];
    const model = buildFermentationChartModel({ readings, fermentationStartDate: null });
    if (!model.hasPoints) throw new Error('expected hasPoints true');

    const { container } = render(<FermentationChart model={model} />);
    const axis = container.querySelector('[data-testid="temperature-axis"]')!;
    const tickTexts = Array.from(axis.querySelectorAll('text')).map((t) => t.textContent);
    expect(tickTexts).toEqual(model.temperatureAxis!.ticks.map((t) => `${t.toFixed(1)}°`));
  });

  it('a reading with sg === null is not plotted as a gravity point (but is still part of the model\'s points array)', () => {
    const readings = [
      reading({ id: 'r1', readingTime: '2026-08-01T00:00:00.000Z', sg: 1.05 }),
      reading({ id: 'r2', readingTime: '2026-08-02T00:00:00.000Z', sg: null, tempC: 19 }),
    ];
    const model = buildFermentationChartModel({ readings, fermentationStartDate: null });
    if (!model.hasPoints) throw new Error('expected hasPoints true');
    expect(model.points).toHaveLength(2); // model keeps both

    const { container } = render(<FermentationChart model={model} />);
    expect(container.querySelectorAll('[data-testid^="gravity-point-"]')).toHaveLength(1); // renderer only plots the one with sg
  });

  it('renders target temperature line and legend when profile steps are present', () => {
    const readings = [
      reading({ id: 'r1', readingTime: '2026-08-01T00:00:00.000Z', sg: 1.05, tempC: 20 }),
      reading({ id: 'r2', readingTime: '2026-08-05T00:00:00.000Z', sg: 1.01, tempC: 22 }),
    ];
    const profile = {
      id: 'fp-1',
      name: 'Ale Schedule',
      steps: [
        { id: 'st-1', name: 'Primary', type: 'Primary' as const, stepTempC: 20, stepTimeDays: 4, rampDays: 0, pressurePsi: null },
        { id: 'st-2', name: 'Rest', type: 'Secondary' as const, stepTempC: 22, stepTimeDays: 2, rampDays: 0, pressurePsi: null },
      ],
    };
    const model = buildFermentationChartModel({ readings, fermentationStartDate: '2026-08-01T00:00:00.000Z', fermentationProfile: profile });
    const { container } = render(<FermentationChart model={model} />);

    expect(container.querySelector('[data-testid="target-temperature-line"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="legend-target-temperature"]')).not.toBeNull();
  });
});
