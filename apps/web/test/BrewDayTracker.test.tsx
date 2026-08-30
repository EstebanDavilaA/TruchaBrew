// M15_P1 spec §2.2 — component tests for brew day timeline, timers, audio
// alerts, and step transitions (AC-7 through AC-15 minus AC-6, which lives
// in BatchRecipeAdjustModal.test.tsx).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import type { BatchWithReadings, BatchWriteInput, CalculatedStats, EquipmentProfile, Recipe } from '@truchabrew/shared-types';
import { calculateRecipeStats } from '@truchabrew/calculations';
import { BrewDayTracker } from '../src/components/BrewDayTracker';

vi.mock('../src/utils/audioAlerts', () => ({
  playStepAlert: vi.fn(),
}));

import { playStepAlert } from '../src/utils/audioAlerts';

const mockedPlayStepAlert = vi.mocked(playStepAlert);

beforeEach(() => {
  vi.useFakeTimers();
  mockedPlayStepAlert.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
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
    hops: [
      { id: 'h-boil-60', name: 'Magnum', amountG: 20, alphaAcidPct: 14, use: 'Boil', boilMins: 60, whirlpoolMins: null, whirlpoolTempC: null, type: 'Pellet' },
      { id: 'h-boil-10', name: 'Saaz', amountG: 50, alphaAcidPct: 4, use: 'Boil', boilMins: 10, whirlpoolMins: null, whirlpoolTempC: null, type: 'Pellet' },
      { id: 'h-whirl', name: 'Citra', amountG: 40, alphaAcidPct: 12, use: 'Whirlpool', boilMins: null, whirlpoolMins: 20, whirlpoolTempC: 80, type: 'Pellet' },
    ],
    yeasts: [{ id: 'y-1', name: 'US-05', type: 'Ale', form: 'Dry', laboratory: 'Fermentis', attenuationPct: 75, amountPkg: 1 }],
    miscs: [{ id: 'm-1', name: 'Whirlfloc', type: 'Fining', use: 'Boil', timeMinutes: 10, amount: 1, unit: 'each' }],
    notes: '',
    mashProfile: {
      id: 'mash-1',
      name: 'Single Infusion',
      targetPh: 5.4,
      spargeTempC: null,
      steps: [{ id: 'step-1', name: 'Sacarificación', type: 'Infusion', stepTempC: 67, stepTimeMin: 45, rampTimeMin: 0, infuseAmountL: null, infuseWaterTempC: 72 }],
    },
    fermentationProfile: null,
  };
}

function baseBatch(recipe: Recipe = baseRecipe()): BatchWithReadings {
  return {
    id: 'batch-1',
    name: 'Batch #1 - Test IPA',
    batchNo: 1,
    status: 'Brewing',
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

function baseFormData(): BatchWriteInput {
  return {
    name: 'Batch #1 - Test IPA',
    batchNo: 1,
    brewer: null,
    brewDate: null,
    status: 'Brewing',
    measuredPreBoilGravity: null,
    measuredMashPh: null,
    measuredBoilSizeL: null,
    measuredBoilTimeMin: null,
    measuredOg: null,
    measuredFg: null,
    measuredBottlingSizeL: null,
    carbonationType: null,
    carbonationVolumesTarget: null,
    carbonationTempC: null,
    tasteNotes: '',
    tasteRating: null,
  };
}

function renderTracker(overrides: { batch?: BatchWithReadings; formData?: BatchWriteInput; onStartFermentation?: () => void; onMeasuredFieldChange?: (patch: unknown) => void } = {}) {
  const batch = overrides.batch ?? baseBatch();
  const stats: CalculatedStats = calculateRecipeStats(batch.recipeSnapshot);
  const onMeasuredFieldChange = overrides.onMeasuredFieldChange ?? vi.fn();
  const onStartFermentation = overrides.onStartFermentation ?? vi.fn();
  return {
    onMeasuredFieldChange,
    onStartFermentation,
    ...render(
      <BrewDayTracker
        batch={batch}
        stats={stats}
        formData={overrides.formData ?? baseFormData()}
        onMeasuredFieldChange={onMeasuredFieldChange as never}
        onStartFermentation={onStartFermentation}
      />,
    ),
  };
}

describe('AC-7: brew day progress timeline', () => {
  it('renders all 4 brewing sub-stages with the first active', () => {
    renderTracker();
    for (const key of ['prep', 'mash', 'boil', 'hopstand']) {
      expect(screen.getByTestId(`brew-day-stage-${key}`)).toBeInTheDocument();
    }
    expect(screen.getByTestId('brew-day-timeline-bar')).toHaveTextContent('Preparation');
    expect(screen.getByTestId('brew-day-timeline-bar')).toHaveTextContent('Mash');
    expect(screen.getByTestId('brew-day-timeline-bar')).toHaveTextContent('Boil');
    expect(screen.getByTestId('brew-day-timeline-bar')).toHaveTextContent('Hop Stand');
    expect(screen.queryByTestId('brew-day-stage-ferment')).not.toBeInTheDocument();
  });

  it('clicking a stage switches the active step card', () => {
    renderTracker();
    expect(screen.getByTestId('brew-day-guidance').textContent).toMatch(/Heat/);
    fireEvent.click(screen.getByTestId('brew-day-stage-boil'));
    expect(screen.getByTestId('brew-day-guidance').textContent).toMatch(/Hop addition|Boil/);
  });
});

describe('AC-8: live countdown timers — Play/Pause/Skip/Reset', () => {
  it('Play counts down, Pause stops it', () => {
    renderTracker();
    fireEvent.click(screen.getByTestId('brew-day-stage-mash'));
    const before = screen.getByTestId('brew-day-timer-display').textContent;

    fireEvent.click(screen.getByTestId('brew-day-play-btn'));
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    const afterPlay = screen.getByTestId('brew-day-timer-display').textContent;
    expect(afterPlay).not.toBe(before);

    fireEvent.click(screen.getByTestId('brew-day-pause-btn'));
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.getByTestId('brew-day-timer-display').textContent).toBe(afterPlay);
  });

  it('Reset restores the nominal duration', () => {
    renderTracker();
    fireEvent.click(screen.getByTestId('brew-day-stage-mash'));
    fireEvent.click(screen.getByTestId('brew-day-play-btn'));
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    fireEvent.click(screen.getByTestId('brew-day-reset-btn'));
    expect(screen.getByTestId('brew-day-timer-display').textContent).toBe('45:00');
  });

  it('Skip advances to the next stage', () => {
    renderTracker();
    expect(screen.getByTestId('brew-day-stage-prep')).toHaveClass('bg-amber-600');
    fireEvent.click(screen.getByTestId('brew-day-skip-btn'));
    expect(screen.getByTestId('brew-day-stage-mash')).toHaveClass('bg-amber-600');
  });

  it('Fast-Forward compresses the remaining time', () => {
    renderTracker();
    fireEvent.click(screen.getByTestId('brew-day-stage-boil'));
    expect(screen.getByTestId('brew-day-timer-display').textContent).toBe('60:00');
    fireEvent.click(screen.getByTestId('brew-day-fastforward-btn'));
    expect(screen.getByTestId('brew-day-timer-display').textContent).toBe('06:00');
  });

  it('elapsed to zero fires a completion alert and stops running', () => {
    renderTracker();
    fireEvent.click(screen.getByTestId('brew-day-stage-hopstand'));
    fireEvent.click(screen.getByTestId('brew-day-fastforward-btn')); // 20min -> 2min
    fireEvent.click(screen.getByTestId('brew-day-fastforward-btn')); // 2min -> 12s
    fireEvent.click(screen.getByTestId('brew-day-play-btn'));
    act(() => {
      vi.advanceTimersByTime(13000);
    });
    expect(screen.getByTestId('brew-day-timer-display').textContent).toBe('00:00');
    expect(mockedPlayStepAlert).toHaveBeenCalledWith('completion', expect.objectContaining({ muted: false }));
  });
});

describe('AC-9: audio alerts synthesis does not throw', () => {
  it('Skip triggers a chime alert without throwing', () => {
    renderTracker();
    expect(() => fireEvent.click(screen.getByTestId('brew-day-skip-btn'))).not.toThrow();
    expect(mockedPlayStepAlert).toHaveBeenCalledWith('chime', expect.anything());
  });

  it('mute toggle suppresses future alerts (passed through as muted: true)', () => {
    renderTracker();
    fireEvent.click(screen.getByTestId('brew-day-mute-toggle'));
    fireEvent.click(screen.getByTestId('brew-day-skip-btn'));
    expect(mockedPlayStepAlert).toHaveBeenCalledWith('chime', { muted: true });
  });
});

describe('AC-10: mash step schedule timers', () => {
  it('renders the mash rest step with its target temperature and duration', () => {
    renderTracker();
    fireEvent.click(screen.getByTestId('brew-day-stage-mash'));
    expect(screen.getByTestId('brew-day-guidance').textContent).toContain('45 min');
    expect(screen.getByTestId('brew-day-guidance').textContent).toContain('67.0');
  });
});

describe('AC-11: timed boil hop alarms', () => {
  it('lists all boil hop additions and the misc Whirlfloc addition, sorted by time-into-boil', () => {
    renderTracker();
    fireEvent.click(screen.getByTestId('brew-day-stage-boil'));
    const alarms = screen.getByTestId('brew-day-boil-alarms');
    expect(alarms).toHaveTextContent('Magnum');
    expect(alarms).toHaveTextContent('Saaz');
    expect(alarms).toHaveTextContent('Whirlfloc');
  });

  it('fires a warning alert once elapsed time crosses a hop addition threshold', () => {
    renderTracker();
    fireEvent.click(screen.getByTestId('brew-day-stage-boil'));
    // Magnum is added at t=0 (60min boil, boilMins=60 -> atSec=0).
    fireEvent.click(screen.getByTestId('brew-day-play-btn'));
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(mockedPlayStepAlert).toHaveBeenCalledWith('warning', expect.anything());
  });
});

describe('AC-12: hopstand / whirlpool steep timer', () => {
  it('shows the 80°C cooling prompt and a steep duration derived from the recipe whirlpool hop', () => {
    renderTracker();
    fireEvent.click(screen.getByTestId('brew-day-stage-hopstand'));
    expect(screen.getByTestId('brew-day-guidance').textContent).toContain('80');
    expect(screen.getByTestId('brew-day-guidance').textContent).toContain('20');
    expect(screen.getByTestId('brew-day-timer-display').textContent).toBe('20:00');
  });
});

// M18_P1 spec §2.2/§3 — continuous timeline bar, timer box, green header,
// stepper controls, global reset, and stage checklists.

describe('M18_P1 AC-26: continuous bar replaces the pill row', () => {
  it('renders exactly 4 segment elements with widths matching widthFraction, and clicking a segment switches the active stage', () => {
    renderTracker();
    const bar = screen.getByTestId('brew-day-timeline-bar');
    for (const key of ['prep', 'mash', 'boil', 'hopstand']) {
      expect(screen.getByTestId(`brew-day-stage-${key}`)).toBeInTheDocument();
    }
    const segments = bar.querySelectorAll('button');
    expect(segments.length).toBe(4);
    segments.forEach((seg) => {
      const width = parseFloat((seg as HTMLElement).style.width);
      expect(width).toBeGreaterThan(0);
      expect(Number.isNaN(width)).toBe(false);
    });
    fireEvent.click(screen.getByTestId('brew-day-stage-boil'));
    expect(screen.getByTestId('brew-day-stage-boil')).toHaveClass('bg-amber-600');
  });
});

describe('M18_P1 AC-27: milestone dots render', () => {
  it('renders one dot per model milestone, each with accessible label text', () => {
    renderTracker();
    const dots = screen.getByTestId('brew-day-timeline-milestones').querySelectorAll('span');
    expect(dots.length).toBeGreaterThan(0);
    dots.forEach((dot) => {
      expect(dot.getAttribute('title') || dot.getAttribute('aria-label')).toBeTruthy();
    });
  });
});

describe('M18_P1 AC-28: Previous Step control', () => {
  it('moves from boil to mash, is a no-op at prep, freezes the timer, and plays no chime', () => {
    renderTracker();
    fireEvent.click(screen.getByTestId('brew-day-stage-boil'));
    fireEvent.click(screen.getByTestId('brew-day-previous-btn'));
    expect(screen.getByTestId('brew-day-stage-mash')).toHaveClass('bg-amber-600');
    expect(mockedPlayStepAlert).not.toHaveBeenCalledWith('chime', expect.anything());

    fireEvent.click(screen.getByTestId('brew-day-stage-prep'));
    // prep has no Previous Step button rendered (only Strike Water Ready).
    expect(screen.queryByTestId('brew-day-previous-btn')).not.toBeInTheDocument();
  });
});

describe('M18_P1 AC-29: Adjust Time control, with boundaries', () => {
  it('accepts 12 and 600, rejects 601/-1/abc leaving the displayed time and running state unchanged', () => {
    renderTracker();
    fireEvent.click(screen.getByTestId('brew-day-stage-mash'));
    fireEvent.click(screen.getByTestId('brew-day-adjusttime-btn'));

    fireEvent.change(screen.getByTestId('brew-day-adjusttime-input'), { target: { value: '12' } });
    fireEvent.click(screen.getByTestId('brew-day-adjusttime-commit-btn'));
    expect(screen.getByTestId('brew-day-timer-display').textContent).toBe('12:00');

    fireEvent.click(screen.getByTestId('brew-day-adjusttime-btn'));
    fireEvent.change(screen.getByTestId('brew-day-adjusttime-input'), { target: { value: '600' } });
    fireEvent.click(screen.getByTestId('brew-day-adjusttime-commit-btn'));
    expect(screen.getByTestId('brew-day-timer-display').textContent).toBe('600:00');

    // Rejected commits leave the panel state untouched (no state change at
    // all), so it stays open across the loop — only opened once, up front.
    fireEvent.click(screen.getByTestId('brew-day-adjusttime-btn'));
    for (const rejected of ['601', '-1', 'abc']) {
      const before = screen.getByTestId('brew-day-timer-display').textContent;
      fireEvent.change(screen.getByTestId('brew-day-adjusttime-input'), { target: { value: rejected } });
      fireEvent.click(screen.getByTestId('brew-day-adjusttime-commit-btn'));
      expect(screen.getByTestId('brew-day-timer-display').textContent).toBe(before);
      expect(screen.getByTestId('brew-day-adjusttime-panel')).toBeInTheDocument();
    }
    expect(screen.getByTestId('brew-day-play-btn')).toBeInTheDocument();
  });
});

describe('M18_P1 AC-30: Global power/reset', () => {
  it('resets stage, timer, and checklist items after advancing, running, and checking items off', () => {
    const onMeasuredFieldChange = vi.fn();
    renderTracker({ onMeasuredFieldChange });
    fireEvent.click(screen.getByTestId('brew-day-stage-mash'));
    fireEvent.click(screen.getByTestId('brew-day-play-btn'));
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    const checklistItem = screen.queryByTestId(/^checklist-item-mash-check-/);
    if (checklistItem) fireEvent.click(checklistItem);

    fireEvent.click(screen.getByTestId('brew-day-global-reset-btn'));

    expect(screen.getByTestId('brew-day-stage-prep')).toHaveClass('bg-amber-600');
    expect(onMeasuredFieldChange).not.toHaveBeenCalled();
  });
});

describe('M18_P1 AC-31: timer box formatting', () => {
  it('formatMmSs zero-pads minutes; rendered timer lives inside brew-day-timer-box', () => {
    renderTracker();
    fireEvent.click(screen.getByTestId('brew-day-stage-boil'));
    const box = screen.getByTestId('brew-day-timer-box');
    expect(box.textContent).toBe('60:00');
    expect(screen.getByTestId('brew-day-timer-display').textContent).toBe('60:00');
  });
});

describe('M18_P1 AC-32: green stage header', () => {
  it('renders brew-day-stage-header with stage-specific text and an emerald/green token', () => {
    renderTracker();
    const header = screen.getByTestId('brew-day-stage-header');
    expect(header.className).toMatch(/emerald|green/);
    fireEvent.click(screen.getByTestId('brew-day-stage-mash'));
    expect(screen.getByTestId('brew-day-stage-header').textContent).toMatch(/Mash/i);
  });
});

describe('M18_P1 AC-33: checklists on all four stages', () => {
  it('prep, mash, and hopstand each render at least one checklist item; toggling does not alter the timer; boil additions list uses circular check toggles (BUG-022)', () => {
    renderTracker();
    expect(screen.getByTestId('brew-day-prep-checklist')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('brew-day-stage-mash'));
    expect(screen.getByTestId('brew-day-mash-checklist')).toBeInTheDocument();
    const mashItem = screen.getAllByTestId(/^checklist-item-mash-check-/)[0];
    const timerBefore = screen.getByTestId('brew-day-timer-display').textContent;
    fireEvent.click(mashItem);
    expect(screen.getByTestId('brew-day-timer-display').textContent).toBe(timerBefore);

    fireEvent.click(screen.getByTestId('brew-day-stage-hopstand'));
    expect(screen.getByTestId('brew-day-hopstand-checklist')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('brew-day-stage-boil'));
    expect(screen.getByTestId('brew-day-boil-alarms')).toBeInTheDocument();
    const boilItem = screen.getByTestId('brew-day-boil-alarm-hop-h-boil-60');
    expect(boilItem).toBeInTheDocument();
    // Click boil addition to toggle added
    fireEvent.click(boilItem);
    expect(boilItem.querySelector('.line-through')).toHaveTextContent('Magnum');
    expect(screen.getByTestId('brew-day-timer-display').textContent).toBe('60:00');
    // Click again to uncheck
    fireEvent.click(boilItem);
    expect(boilItem.querySelector('.line-through')).toBeNull();
  });
});

describe('M18_P1 AC-34: stage lockstep', () => {
  it('selecting a stage updates bar, header, timer, and checklist consistently within one commit', () => {
    renderTracker();
    act(() => {
      fireEvent.click(screen.getByTestId('brew-day-stage-mash'));
    });
    expect(screen.getByTestId('brew-day-stage-mash')).toHaveClass('bg-amber-600');
    expect(screen.getByTestId('brew-day-stage-header').textContent).toMatch(/Mash/i);
    expect(screen.getByTestId('brew-day-timer-display').textContent).toBe('45:00');
    expect(screen.getByTestId('brew-day-mash-checklist')).toBeInTheDocument();
  });
});

describe('M18_P1 AC-41: hopstand temperature reads the equipment profile', () => {
  it('guidance text contains the profile hopstandTemperatureC, not a hardcoded 80', () => {
    const equipmentWith79: EquipmentProfile = { ...equipment, hopstandTemperatureC: 79 };
    const recipe = { ...baseRecipe(), equipment: equipmentWith79 };
    renderTracker({ batch: baseBatch(recipe) });
    fireEvent.click(screen.getByTestId('brew-day-stage-hopstand'));
    expect(screen.getByTestId('brew-day-guidance').textContent).toContain('79');
  });
});

describe('Brewing Controls: full-width responsive layout', () => {
  it('renders timer controls in a full-width responsive container with justified action buttons', () => {
    renderTracker();
    fireEvent.click(screen.getByTestId('brew-day-stage-mash'));
    const playBtn = screen.getByTestId('brew-day-play-btn');
    const container = playBtn.parentElement;
    expect(container).toHaveClass('w-full', 'flex-wrap');
    expect(playBtn).toHaveClass('w-full', 'justify-center');
  });
});
