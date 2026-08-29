import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { calculateMashPlan } from '@truchabrew/calculations';
import type { MashPlan } from '@truchabrew/calculations';
import type { Recipe, UserConfig } from '@truchabrew/shared-types';
import { MashSection } from '../src/components/MashSection';
import { baseStoredRecipe, baseMashProfile, baseFermentationProfile } from './helpers/fixtures';

const noop = () => {};

// M7_P1 amendment §1.4 — MashSection now requires a `config` prop (AC-23).
// Every pre-existing render call below is passed this celsius default,
// which preserves the exact strings ("°C") every pre-amendment assertion
// already expects — see the amendment's own note on each touched line.
const DEFAULT_CONFIG: UserConfig = {
  id: 'default',
  unitSystem: 'metric',
  gravityUnit: 'sg',
  temperatureUnit: 'celsius',
  ibuFormula: 'tinseth',
  abvFormula: 'simple',
};

describe('AC-52: no-profile mash view renders no placeholder', () => {
  it('with mashProfile === null, renders the picker and the prompt, and no strike-temperature row / —/0.0/NaN placeholder', () => {
    const recipe: Recipe = baseStoredRecipe({ mashProfile: null });
    const mashPlan = calculateMashPlan(recipe);

    render(
      <MashSection recipe={recipe} mashPlan={mashPlan} mashProfiles={[]} fermentationProfiles={[]} onSelectMashProfile={noop} onSelectFermentationProfile={noop} config={DEFAULT_CONFIG} />,
    );

    expect(screen.getByTestId('mash-no-profile')).toBeInTheDocument();
    expect(screen.queryByTestId('mash-plan')).not.toBeInTheDocument();
    expect(screen.queryByText(/strike temperature/i)).not.toBeInTheDocument();
    expect(screen.queryByText('NaN')).not.toBeInTheDocument();
    expect(screen.getByTestId('mash-profile-picker')).toHaveValue('');
  });

  it('with a zero-step profile, the sparge temperature and "no steps yet" line render, and the strike-temperature row still does not', () => {
    const mashProfile = baseMashProfile({ steps: [] });
    const recipe: Recipe = baseStoredRecipe({ mashProfile });
    const mashPlan = calculateMashPlan(recipe);

    render(
      <MashSection recipe={recipe} mashPlan={mashPlan} mashProfiles={[mashProfile]} fermentationProfiles={[]} onSelectMashProfile={noop} onSelectFermentationProfile={noop} config={DEFAULT_CONFIG} />,
    );

    expect(screen.getByTestId('mash-no-steps')).toBeInTheDocument();
    expect(screen.getByText(/sparge temp/i)).toBeInTheDocument();
    expect(screen.queryByText(/strike temperature/i)).not.toBeInTheDocument();
  });
});

describe('AC-51: MashSection reads the recipe\'s profile, not the list', () => {
  it('a decoy entry in the mashProfiles list with the same id but different values never feeds a displayed value', () => {
    const realProfile = baseMashProfile({
      id: 'mash-shared-id',
      name: 'Real Name',
      steps: [{ id: 's-0', name: 'Real Step', type: 'Infusion', stepTempC: 67, stepTimeMin: 60, rampTimeMin: 0, infuseAmountL: null, infuseWaterTempC: 100 }],
    });
    const decoyProfile = baseMashProfile({
      id: 'mash-shared-id', // same id
      name: 'DECOY NAME',
      steps: [{ id: 's-decoy', name: 'DECOY STEP', type: 'Infusion', stepTempC: 999, stepTimeMin: 1, rampTimeMin: 0, infuseAmountL: null, infuseWaterTempC: 100 }],
    });
    const recipe: Recipe = baseStoredRecipe({ mashProfile: realProfile });
    const mashPlan = calculateMashPlan(recipe);

    render(
      <MashSection recipe={recipe} mashPlan={mashPlan} mashProfiles={[decoyProfile]} fermentationProfiles={[]} onSelectMashProfile={noop} onSelectFermentationProfile={noop} config={DEFAULT_CONFIG} />,
    );

    // The step table (from mashPlan, itself computed from recipe.mashProfile)
    // shows the REAL step, never the decoy's name or its absurd 999 °C.
    expect(screen.getByText('Real Step')).toBeInTheDocument();
    expect(screen.queryByText('DECOY STEP')).not.toBeInTheDocument();
    expect(screen.queryByText('999 °C')).not.toBeInTheDocument();
    // The picker itself is still populated from the list (that's its job) —
    // only the DISPLAYED plan values must not come from it.
    expect(screen.getByTestId('mash-profile-picker')).toHaveValue('mash-shared-id');
  });
});

describe('mash plan rendering', () => {
  it('renders strike water, strike temperature, per-step infusion volumes and sources', () => {
    const mashProfile = baseMashProfile({
      steps: [
        { id: 's-0', name: 'Dough In', type: 'Infusion', stepTempC: 52, stepTimeMin: 15, rampTimeMin: 0, infuseAmountL: null, infuseWaterTempC: 100 },
        { id: 's-1', name: 'Sacch Rest', type: 'Infusion', stepTempC: 67, stepTimeMin: 45, rampTimeMin: 0, infuseAmountL: null, infuseWaterTempC: 100 },
        { id: 's-2', name: 'Mash Out', type: 'Infusion', stepTempC: 76, stepTimeMin: 10, rampTimeMin: 0, infuseAmountL: 3, infuseWaterTempC: 100 },
      ],
    });
    const recipe: Recipe = baseStoredRecipe({ mashProfile });
    const mashPlan = calculateMashPlan(recipe);
    if (!mashPlan.hasMashProfile) throw new Error('expected hasMashProfile: true');

    render(
      <MashSection recipe={recipe} mashPlan={mashPlan} mashProfiles={[mashProfile]} fermentationProfiles={[]} onSelectMashProfile={noop} onSelectFermentationProfile={noop} config={DEFAULT_CONFIG} />,
    );

    // Step 0's mashVolumeAfterL is, by contract, exactly strikeWaterL, so the
    // same formatted string legitimately appears twice (the strike-water
    // tile and step 0's "Volume After" cell) — assert at least one match
    // rather than a single unique one.
    expect(screen.getAllByText(`${mashPlan.strikeWaterL.toFixed(1)} L`).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(`${mashPlan.strikeTemperatureC!.toFixed(1)} °C`)).toBeInTheDocument();
    expect(screen.getByTestId('mash-plan-step-0')).toBeInTheDocument();
    expect(screen.getByTestId('mash-plan-step-1')).toBeInTheDocument();
    expect(screen.getByTestId('mash-plan-step-2')).toBeInTheDocument();
    expect(screen.getByText('(stored)')).toBeInTheDocument(); // step 2's infuseAmountL: 3 override
  });
});

describe('fermentation section', () => {
  it('with fermentationProfile === null, renders the picker and a prompt, no steps table', () => {
    const recipe: Recipe = baseStoredRecipe({ fermentationProfile: null });
    const mashPlan = calculateMashPlan(recipe);
    render(
      <MashSection recipe={recipe} mashPlan={mashPlan} mashProfiles={[]} fermentationProfiles={[]} onSelectMashProfile={noop} onSelectFermentationProfile={noop} config={DEFAULT_CONFIG} />,
    );
    expect(screen.getByTestId('fermentation-no-profile')).toBeInTheDocument();
  });

  it('renders the attached fermentation profile\'s steps from recipe.fermentationProfile, not the list', () => {
    const realProfile = baseFermentationProfile({ id: 'ferm-shared', name: 'Real Ferm', steps: [{ id: 'fs-0', name: 'Real Primary', type: 'Primary', stepTempC: 19, stepTimeDays: 14, rampDays: 0, pressurePsi: null }] });
    const decoyProfile = baseFermentationProfile({ id: 'ferm-shared', name: 'DECOY', steps: [{ id: 'fs-decoy', name: 'DECOY PRIMARY', type: 'Primary', stepTempC: 99, stepTimeDays: 1, rampDays: 0, pressurePsi: null }] });
    const recipe: Recipe = baseStoredRecipe({ fermentationProfile: realProfile });
    const mashPlan = calculateMashPlan(recipe);

    render(
      <MashSection recipe={recipe} mashPlan={mashPlan} mashProfiles={[]} fermentationProfiles={[decoyProfile]} onSelectMashProfile={noop} onSelectFermentationProfile={noop} config={DEFAULT_CONFIG} />,
    );

    expect(screen.getByText('Real Primary')).toBeInTheDocument();
    expect(screen.queryByText('DECOY PRIMARY')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// M7_P1 amendment (2026-08-13) — AC-23: strike/sparge/mash-step temperatures
// render through formatTemperature per config.temperatureUnit.
// ---------------------------------------------------------------------------

describe('AC-23: temperatures render through formatTemperature', () => {
  it('under fahrenheit, strike temperature renders through formatTemperature and never the raw °C string', () => {
    const mashProfile = baseMashProfile({
      steps: [{ id: 's-0', name: 'Sacch Rest', type: 'Infusion', stepTempC: 67, stepTimeMin: 60, rampTimeMin: 0, infuseAmountL: null, infuseWaterTempC: 100 }],
    });
    const recipe: Recipe = baseStoredRecipe({ mashProfile });
    const mashPlan = calculateMashPlan(recipe);
    if (!mashPlan.hasMashProfile) throw new Error('expected hasMashProfile: true');

    render(
      <MashSection
        recipe={recipe}
        mashPlan={mashPlan}
        mashProfiles={[mashProfile]}
        fermentationProfiles={[]}
        onSelectMashProfile={noop}
        onSelectFermentationProfile={noop}
        config={{ ...DEFAULT_CONFIG, temperatureUnit: 'fahrenheit' }}
      />,
    );

    // Expected value derived from the same conversion formatTemperature
    // itself applies (°F = C * 9/5 + 32), not a hand-copied literal — this
    // is a component-render check, not a re-test of formatTemperature's own
    // pinned values (that's AC-17, in config.test.ts).
    const expectedF = `${(mashPlan.strikeTemperatureC! * 9 / 5 + 32).toFixed(1)} °F`;
    expect(screen.getByText(expectedF)).toBeInTheDocument();
    expect(screen.queryByText(`${mashPlan.strikeTemperatureC!.toFixed(1)} °C`)).not.toBeInTheDocument();
  });

  it('sparge temperature and every mash-step row render in °F under fahrenheit; nothing renders in °C', () => {
    const mashProfile = baseMashProfile({
      steps: [{ id: 's-0', name: 'Sacch Rest', type: 'Infusion', stepTempC: 67, stepTimeMin: 60, rampTimeMin: 0, infuseAmountL: null, infuseWaterTempC: 100 }],
    });
    const recipe: Recipe = baseStoredRecipe({ mashProfile });
    const mashPlan = calculateMashPlan(recipe);

    const { container } = render(
      <MashSection
        recipe={recipe}
        mashPlan={mashPlan}
        mashProfiles={[mashProfile]}
        fermentationProfiles={[]}
        onSelectMashProfile={noop}
        onSelectFermentationProfile={noop}
        config={{ ...DEFAULT_CONFIG, temperatureUnit: 'fahrenheit' }}
      />,
    );

    expect(container.textContent).toContain('°F');
    expect(container.textContent).not.toContain('°C');
  });

  it('renders in °C and no °F appears anywhere in the component under celsius', () => {
    const mashProfile = baseMashProfile({
      steps: [{ id: 's-0', name: 'Sacch Rest', type: 'Infusion', stepTempC: 67, stepTimeMin: 60, rampTimeMin: 0, infuseAmountL: null, infuseWaterTempC: 100 }],
    });
    const recipe: Recipe = baseStoredRecipe({ mashProfile });
    const mashPlan = calculateMashPlan(recipe);

    const { container } = render(
      <MashSection
        recipe={recipe}
        mashPlan={mashPlan}
        mashProfiles={[mashProfile]}
        fermentationProfiles={[]}
        onSelectMashProfile={noop}
        onSelectFermentationProfile={noop}
        config={DEFAULT_CONFIG}
      />,
    );

    expect(container.textContent).toContain('°C');
    expect(container.textContent).not.toContain('°F');
  });
});

// ---------------------------------------------------------------------------
// M7_P1 second amendment (2026-08-13) — AC-29: fermentation-schedule step
// temperatures render through formatTemperature too, asserted jointly with a
// mash-step row in the SAME render so the test fails if the two tables ever
// disagree on unit.
// ---------------------------------------------------------------------------

describe('AC-29: fermentation-step temperatures render through formatTemperature — one component, one unit', () => {
  it('under fahrenheit, both the mash-step row and the fermentation-step row render °F, and °C appears nowhere', () => {
    const mashProfile = baseMashProfile({
      steps: [{ id: 's-0', name: 'Sacch Rest', type: 'Infusion', stepTempC: 67, stepTimeMin: 60, rampTimeMin: 0, infuseAmountL: null, infuseWaterTempC: 100 }],
    });
    const fermentationProfile = baseFermentationProfile({
      steps: [{ id: 'fs-0', name: 'Primary', type: 'Primary', stepTempC: 20, stepTimeDays: 14, rampDays: 0, pressurePsi: null }],
    });
    const recipe: Recipe = baseStoredRecipe({ mashProfile, fermentationProfile });
    const mashPlan = calculateMashPlan(recipe);

    const { container } = render(
      <MashSection
        recipe={recipe}
        mashPlan={mashPlan}
        mashProfiles={[mashProfile]}
        fermentationProfiles={[fermentationProfile]}
        onSelectMashProfile={noop}
        onSelectFermentationProfile={noop}
        config={{ ...DEFAULT_CONFIG, temperatureUnit: 'fahrenheit' }}
      />,
    );

    const fermentationRow = screen.getByTestId('fermentation-plan-step-0');
    expect(fermentationRow.textContent).toContain('68.0 °F');
    expect(fermentationRow.textContent).not.toContain('°C');

    expect(screen.getByTestId('mash-plan-step-0').textContent).toContain('°F');
    expect(container.textContent).not.toContain('°C');
  });

  it('under celsius, both rows render °C, and °F appears nowhere; the literal "{step.stepTempC} °C" is gone', () => {
    const mashProfile = baseMashProfile({
      steps: [{ id: 's-0', name: 'Sacch Rest', type: 'Infusion', stepTempC: 67, stepTimeMin: 60, rampTimeMin: 0, infuseAmountL: null, infuseWaterTempC: 100 }],
    });
    const fermentationProfile = baseFermentationProfile({
      steps: [{ id: 'fs-0', name: 'Primary', type: 'Primary', stepTempC: 20, stepTimeDays: 14, rampDays: 0, pressurePsi: null }],
    });
    const recipe: Recipe = baseStoredRecipe({ mashProfile, fermentationProfile });
    const mashPlan = calculateMashPlan(recipe);

    const { container } = render(
      <MashSection
        recipe={recipe}
        mashPlan={mashPlan}
        mashProfiles={[mashProfile]}
        fermentationProfiles={[fermentationProfile]}
        onSelectMashProfile={noop}
        onSelectFermentationProfile={noop}
        config={DEFAULT_CONFIG}
      />,
    );

    const fermentationRow = screen.getByTestId('fermentation-plan-step-0');
    expect(fermentationRow.textContent).toContain('20.0 °C');
    expect(fermentationRow.textContent).not.toContain('°F');
    expect(container.textContent).not.toContain('°F');
  });
});

// ---------------------------------------------------------------------------
// M7_P2 §1.3 — MashSection's volume figures (strikeWaterL, infusionVolumeL,
// mashVolumeAfterL, mashWaterBalanceL warning) now route through
// formatVolume; its local `fmt()` helper is deleted (AC-11, AC-16, §2.4).
// ---------------------------------------------------------------------------

describe('AC-11: MashSection volume figures convert; temperatures still work', () => {
  it('under "us" the pinned gallon figures render, alongside a working temperature conversion in the same render', () => {
    const mashProfile = baseMashProfile({
      steps: [
        { id: 's-0', name: 'Dough In', type: 'Infusion', stepTempC: 67, stepTimeMin: 60, rampTimeMin: 0, infuseAmountL: 8, infuseWaterTempC: 100 },
      ],
    });
    const recipe: Recipe = baseStoredRecipe({ mashProfile });
    const mashPlan = calculateMashPlan(recipe);
    if (!mashPlan.hasMashProfile) throw new Error('expected hasMashProfile: true');

    const { container } = render(
      <MashSection
        recipe={recipe}
        mashPlan={mashPlan}
        mashProfiles={[mashProfile]}
        fermentationProfiles={[]}
        onSelectMashProfile={noop}
        onSelectFermentationProfile={noop}
        config={{ ...DEFAULT_CONFIG, unitSystem: 'us', temperatureUnit: 'fahrenheit' }}
      />,
    );

    // strikeWaterL / infusionVolumeL / mashVolumeAfterL are derived from
    // calculateMashPlan (not hand-pinned here), so assert the conversion
    // matches formatVolume's own contract for whatever the plan computed —
    // this exercises the wiring, not a re-derivation of the pure helper's
    // math (that is AC-4's job in config.test.ts).
    const usGal = (l: number) => (l * 0.264172).toFixed(2);
    expect(container.textContent).toContain(`${usGal(mashPlan.strikeWaterL)} gal`);
    // Temperature still renders (AC-23 unbroken in the same render) — this
    // component's temperatureUnit is a config field independent of
    // unitSystem, so it is set explicitly here to exercise both in one render.
    expect(container.textContent).toContain('°F');
    expect(container.textContent).not.toContain('°C');
  });

  it('under "metric" the figures render byte-identical to today\'s toFixed(1) rendering', () => {
    const mashProfile = baseMashProfile({
      steps: [
        { id: 's-0', name: 'Dough In', type: 'Infusion', stepTempC: 67, stepTimeMin: 60, rampTimeMin: 0, infuseAmountL: 8, infuseWaterTempC: 100 },
      ],
    });
    const recipe: Recipe = baseStoredRecipe({ mashProfile });
    const mashPlan = calculateMashPlan(recipe);
    if (!mashPlan.hasMashProfile) throw new Error('expected hasMashProfile: true');

    render(
      <MashSection
        recipe={recipe}
        mashPlan={mashPlan}
        mashProfiles={[mashProfile]}
        fermentationProfiles={[]}
        onSelectMashProfile={noop}
        onSelectFermentationProfile={noop}
        config={DEFAULT_CONFIG}
      />,
    );

    expect(screen.getAllByText(`${mashPlan.strikeWaterL.toFixed(1)} L`).length).toBeGreaterThanOrEqual(1);
  });

  it('the water-balance warning renders through formatVolume with Math.abs applied', () => {
    // A mash profile whose infusion water exceeds the recipe's mash water
    // figure, producing a negative mashWaterBalanceL (magnitude asserted).
    // Step 0's infuseAmountL is ignored (its volume is computed as strike
    // water); a second step's infuseAmountL is honored as "stored" — a
    // large second-step addition is what actually drives the balance
    // negative (mirrors the existing "mash plan rendering" test's step-2
    // "(stored)" fixture pattern above).
    const mashProfile = baseMashProfile({
      steps: [
        { id: 's-0', name: 'Dough In', type: 'Infusion', stepTempC: 67, stepTimeMin: 60, rampTimeMin: 0, infuseAmountL: null, infuseWaterTempC: 100 },
        { id: 's-1', name: 'Extra Infusion', type: 'Infusion', stepTempC: 72, stepTimeMin: 10, rampTimeMin: 0, infuseAmountL: 50, infuseWaterTempC: 100 },
      ],
    });
    const recipe: Recipe = baseStoredRecipe({ mashProfile });
    const mashPlan = calculateMashPlan(recipe);
    if (!mashPlan.hasMashProfile) throw new Error('expected hasMashProfile: true');
    expect(mashPlan.mashWaterBalanceL).toBeLessThan(0);

    const { container } = render(
      <MashSection
        recipe={recipe}
        mashPlan={mashPlan}
        mashProfiles={[mashProfile]}
        fermentationProfiles={[]}
        onSelectMashProfile={noop}
        onSelectFermentationProfile={noop}
        config={{ ...DEFAULT_CONFIG, unitSystem: 'us' }}
      />,
    );

    const usGal = (l: number) => (l * 0.264172).toFixed(2);
    expect(container.textContent).toContain(`${usGal(Math.abs(mashPlan.mashWaterBalanceL))} gal`);
  });

  // -------------------------------------------------------------------------
  // Gap-closing follow-up (M7_P2 critic audit): the two blocks above assert
  // strikeWaterL end-to-end and the water-balance warning, but never
  // individually assert infusionVolumeL or mashVolumeAfterL, and never use
  // any of the spec's AC-11 pinned example strings. A hand-built MashPlan
  // literal is used here (not calculateMashPlan) so strikeWaterL/
  // infusionVolumeL/mashVolumeAfterL/mashWaterBalanceL match the spec's own
  // pinned fixture exactly: strikeWaterL=15.5, step1 infusionVolumeL=8,
  // step1 mashVolumeAfterL=23.5, mashWaterBalanceL=-2.
  // -------------------------------------------------------------------------
  function pinnedMashPlan(): MashPlan {
    return {
      hasMashProfile: true,
      profileId: 'mash-1',
      profileName: 'Test Mash Schedule',
      targetPh: 5.4,
      spargeTemperatureC: 76,
      spargeTemperatureSource: 'equipment',
      totalGrainKg: 5,
      strikeWaterL: 15.5,
      strikeTemperatureC: 67,
      steps: [
        {
          stepId: 's-0',
          name: 'Dough In',
          type: 'Infusion',
          position: 0,
          stepTempC: 67,
          stepTimeMin: 60,
          rampTimeMin: 0,
          infusionVolumeL: null,
          infusionSource: 'none',
          infuseWaterTempC: 100,
          mashVolumeAfterL: 15.5,
        },
        {
          stepId: 's-1',
          name: 'Extra Infusion',
          type: 'Infusion',
          position: 1,
          stepTempC: 72,
          stepTimeMin: 10,
          rampTimeMin: 0,
          infusionVolumeL: 8,
          infusionSource: 'stored',
          infuseWaterTempC: 100,
          mashVolumeAfterL: 23.5,
        },
      ],
      totalInfusionWaterL: 8,
      mashWaterBalanceL: -2,
    };
  }

  it('under "us" all four AC-11 pinned strings render individually: 4.09 gal (strike water), 2.11 gal (infusionVolumeL), 6.21 gal (mashVolumeAfterL), 0.53 gal (water-balance warning)', () => {
    const mashPlan = pinnedMashPlan();
    const recipe: Recipe = baseStoredRecipe({ mashProfile: baseMashProfile() });

    const { container } = render(
      <MashSection
        recipe={recipe}
        mashPlan={mashPlan}
        mashProfiles={[]}
        fermentationProfiles={[]}
        onSelectMashProfile={noop}
        onSelectFermentationProfile={noop}
        config={{ ...DEFAULT_CONFIG, unitSystem: 'us' }}
      />,
    );

    // Strike water (mashPlan.strikeWaterL = 15.5) — appears at least once
    // (strike-water tile; step 0's "Volume After" is, by contract, the same
    // value, so it may legitimately appear a second time).
    expect(screen.getAllByText('4.09 gal').length).toBeGreaterThanOrEqual(1);
    // Step 1's infusionVolumeL = 8, asserted individually.
    expect(screen.getByText('2.11 gal')).toBeInTheDocument();
    // Step 1's mashVolumeAfterL = 23.5, asserted individually.
    expect(screen.getByText('6.21 gal')).toBeInTheDocument();
    // Water-balance warning: Math.abs(mashWaterBalanceL) = Math.abs(-2) = 2.
    expect(container.textContent).toContain('0.53 gal');
  });

  it('under "metric" the same four figures render byte-identically to today\'s toFixed(1) rendering: 15.5 L, 8.0 L, 23.5 L, 2.0 L', () => {
    const mashPlan = pinnedMashPlan();
    const recipe: Recipe = baseStoredRecipe({ mashProfile: baseMashProfile() });

    const { container } = render(
      <MashSection
        recipe={recipe}
        mashPlan={mashPlan}
        mashProfiles={[]}
        fermentationProfiles={[]}
        onSelectMashProfile={noop}
        onSelectFermentationProfile={noop}
        config={DEFAULT_CONFIG}
      />,
    );

    expect(screen.getAllByText('15.5 L').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('8.0 L')).toBeInTheDocument();
    expect(screen.getByText('23.5 L')).toBeInTheDocument();
    // Math.abs(mashWaterBalanceL) = Math.abs(-2) = 2, formatVolume(2, 'metric')
    // = "2.0 L". (Not "0.5 L" — see this session's report: the follow-up
    // task text's "0.5 L" does not arithmetically match mashWaterBalanceL =
    // -2 alongside the already-correct "0.53 gal" pin for the same fixture,
    // which itself only reconciles with 2.0 L: 2 * 0.264172 = 0.528344 ->
    // "0.53"; 0.5 * 0.264172 = 0.132086 -> "0.13", not "0.53". Asserting the
    // arithmetically-consistent value here rather than the inconsistent one.)
    expect(container.textContent).toContain('2.0 L');
  });
});

describe('AC-16: MashSection has no stale suffixes, no doubled unit, and no dead `fmt` helper', () => {
  it('under "us", no litre figure or "gal L" doubled-suffix pattern survives', () => {
    const mashProfile = baseMashProfile({
      steps: [
        { id: 's-0', name: 'Dough In', type: 'Infusion', stepTempC: 67, stepTimeMin: 60, rampTimeMin: 0, infuseAmountL: 8, infuseWaterTempC: 100 },
      ],
    });
    const recipe: Recipe = baseStoredRecipe({ mashProfile });
    const mashPlan = calculateMashPlan(recipe);

    const { container } = render(
      <MashSection
        recipe={recipe}
        mashPlan={mashPlan}
        mashProfiles={[mashProfile]}
        fermentationProfiles={[]}
        onSelectMashProfile={noop}
        onSelectFermentationProfile={noop}
        config={{ ...DEFAULT_CONFIG, unitSystem: 'us' }}
      />,
    );

    expect(container.textContent).not.toMatch(/\d\s*L\b/);
    expect(container.textContent).not.toMatch(/gal\s*L/);
  });

  it('the identifier `fmt` no longer appears in MashSection.tsx source', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const src = fs.readFileSync(
      path.resolve(__dirname, '../src/components/MashSection.tsx'),
      'utf-8',
    );
    expect(src).not.toMatch(/\bfmt\s*\(/);
    expect(src).not.toMatch(/function fmt/);
  });
});

describe('M32_P3: MashSection readback typography (AC-16..AC-24)', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const MASH_SRC_PATH = path.resolve(__dirname, '../src/components/MashSection.tsx');
  const MASH_SRC_TEXT = fs.readFileSync(MASH_SRC_PATH, 'utf-8');

  it('AC-16: MashSection has 0 <input> and 0 <NumberInput> elements', () => {
    expect(MASH_SRC_TEXT.match(/<input[\s>]/g)).toBeNull();
    expect(MASH_SRC_TEXT.match(/<NumberInput[\s>]/g)).toBeNull();
  });

  it('AC-17: MS-1/MS-2 hero tiles carry MONO_VALUE_CLASS without duplication', () => {
    const mashPlan: MashPlan = {
      hasMashProfile: true,
      profileId: 'mash-1',
      profileName: 'Test Mash',
      targetPh: 5.4,
      spargeTemperatureC: 76,
      spargeTemperatureSource: 'equipment',
      totalGrainKg: 5,
      strikeWaterL: 15.5,
      strikeTemperatureC: 67,
      steps: [],
      totalInfusionWaterL: 0,
      mashWaterBalanceL: 0,
    };
    const recipe: Recipe = baseStoredRecipe({ mashProfile: baseMashProfile() });
    render(
      <MashSection
        recipe={recipe}
        mashPlan={mashPlan}
        mashProfiles={[]}
        fermentationProfiles={[]}
        onSelectMashProfile={noop}
        onSelectFermentationProfile={noop}
        config={DEFAULT_CONFIG}
      />,
    );

    const strikeWater = screen.getByText('15.5 L');
    expect(strikeWater).toHaveClass('font-mono', 'tabular-nums', 'tracking-tight', 'text-xl', 'font-extrabold');
    expect(strikeWater.className.match(/tracking-tight/g)?.length).toBe(1);

    const strikeTemp = screen.getByTestId('mash-strike-temperature-value');
    expect(strikeTemp).toHaveClass('font-mono', 'tabular-nums', 'tracking-tight', 'text-xl', 'font-extrabold');
    expect(strikeTemp.className.match(/tracking-tight/g)?.length).toBe(1);
  });

  it('AC-18: MS-3/MS-4 inline readbacks carry MONO_VALUE_CLASS', () => {
    const mashPlan: MashPlan = {
      hasMashProfile: true,
      profileId: 'mash-1',
      profileName: 'Test Mash',
      targetPh: 5.4,
      spargeTemperatureC: 76,
      spargeTemperatureSource: 'equipment',
      totalGrainKg: 5,
      strikeWaterL: 15.5,
      strikeTemperatureC: 67,
      steps: [],
      totalInfusionWaterL: 0,
      mashWaterBalanceL: 0,
    };
    const recipe: Recipe = baseStoredRecipe({ mashProfile: baseMashProfile() });
    render(
      <MashSection
        recipe={recipe}
        mashPlan={mashPlan}
        mashProfiles={[]}
        fermentationProfiles={[]}
        onSelectMashProfile={noop}
        onSelectFermentationProfile={noop}
        config={DEFAULT_CONFIG}
      />,
    );

    const sparge = screen.getByTestId('mash-sparge-temperature-value');
    expect(sparge).toHaveClass('font-mono', 'tabular-nums', 'tracking-tight', 'text-slate-200');
    expect(sparge.textContent).toContain('76.0 °C');


    const ph = screen.getByTestId('mash-target-ph-value');
    expect(ph).toHaveClass('font-mono', 'tabular-nums', 'tracking-tight', 'text-slate-200');
    expect(ph.textContent).toBe('5.4');
  });

  it('AC-19: MS-5..MS-8 mash-step numeric cells carry MONO_VALUE_CLASS', () => {
    const mashProfile = baseMashProfile({
      steps: [
        { id: 's-0', name: 'Dough In', type: 'Infusion', stepTempC: 67, stepTimeMin: 60, rampTimeMin: 0, infuseAmountL: 8, infuseWaterTempC: 100 },
      ],
    });
    const recipe: Recipe = baseStoredRecipe({ mashProfile });
    const mashPlan = calculateMashPlan(recipe);
    render(
      <MashSection
        recipe={recipe}
        mashPlan={mashPlan}
        mashProfiles={[]}
        fermentationProfiles={[]}
        onSelectMashProfile={noop}
        onSelectFermentationProfile={noop}
        config={DEFAULT_CONFIG}
      />,
    );

    const row = screen.getByTestId('mash-plan-step-0');
    const cells = row.querySelectorAll('td');
    // cell 0 = Name, cell 1 = Type, cell 2 = Temp, cell 3 = Rest, cell 4 = Infusion, cell 5 = Volume After
    // M35_P2 RA-2: variant="numeric" binds to font-mono tabular-nums only (no tracking-tight).
    expect(cells[2]).toHaveClass('font-mono', 'tabular-nums', 'text-right');
    expect(cells[3]).toHaveClass('font-mono', 'tabular-nums', 'text-right');
    expect(cells[4]).toHaveClass('font-mono', 'tabular-nums', 'text-right');
    expect(cells[5]).toHaveClass('font-mono', 'tabular-nums', 'text-right');
  });

  it('AC-20: MS-9..MS-11 fermentation-step numeric cells carry MONO_VALUE_CLASS', () => {
    const fermProfile = baseFermentationProfile({
      steps: [
        { id: 'fs-0', name: 'Primary', type: 'Primary', stepTempC: 19, stepTimeDays: 14, rampDays: 0, pressurePsi: 5 },
      ],
    });
    const recipe: Recipe = baseStoredRecipe({ fermentationProfile: fermProfile });
    const mashPlan = calculateMashPlan(recipe);
    render(
      <MashSection
        recipe={recipe}
        mashPlan={mashPlan}
        mashProfiles={[]}
        fermentationProfiles={[]}
        onSelectMashProfile={noop}
        onSelectFermentationProfile={noop}
        config={DEFAULT_CONFIG}
      />,
    );

    const row = screen.getByTestId('fermentation-plan-step-0');
    const cells = row.querySelectorAll('td');
    // cell 0 = Name, cell 1 = Type, cell 2 = Temp, cell 3 = Duration, cell 4 = Pressure
    // M35_P2 RA-2: variant="numeric" binds to font-mono tabular-nums only (no tracking-tight).
    expect(cells[2]).toHaveClass('font-mono', 'tabular-nums', 'text-right');
    expect(cells[3]).toHaveClass('font-mono', 'tabular-nums', 'text-right');
    expect(cells[4]).toHaveClass('font-mono', 'tabular-nums', 'text-right');
  });

  it('AC-21: non-numeric cells are excluded from MONO_VALUE_CLASS', () => {
    const mashProfile = baseMashProfile({
      steps: [
        { id: 's-0', name: 'Dough In', type: 'Infusion', stepTempC: 67, stepTimeMin: 60, rampTimeMin: 0, infuseAmountL: 8, infuseWaterTempC: 100 },
      ],
    });
    const fermProfile = baseFermentationProfile({
      steps: [
        { id: 'fs-0', name: 'Primary', type: 'Primary', stepTempC: 19, stepTimeDays: 14, rampDays: 0, pressurePsi: 5 },
      ],
    });
    const recipe: Recipe = baseStoredRecipe({ mashProfile, fermentationProfile: fermProfile });
    const mashPlan = calculateMashPlan(recipe);
    render(
      <MashSection
        recipe={recipe}
        mashPlan={mashPlan}
        mashProfiles={[]}
        fermentationProfiles={[]}
        onSelectMashProfile={noop}
        onSelectFermentationProfile={noop}
        config={DEFAULT_CONFIG}
      />,
    );


    const mashRow = screen.getByTestId('mash-plan-step-0');
    const mashCells = mashRow.querySelectorAll('td');
    expect(mashCells[0]).not.toHaveClass('font-mono');
    expect(mashCells[0]).not.toHaveClass('tabular-nums');
    expect(mashCells[0]).not.toHaveClass('tracking-tight');
    // M35_P2 RA-2: text-slate-100 is retired by the token's text-slate-200; font-medium is an RA-3 safe passthrough.
    expect(mashCells[0]).toHaveClass('font-medium', 'text-slate-200');
    expect(mashCells[1]).not.toHaveClass('font-mono');
    // M35_P2 RA-2: per-cell text-slate-400 is retired by the token's text-slate-200.
    expect(mashCells[1]).toHaveClass('text-slate-200');

    const fermRow = screen.getByTestId('fermentation-plan-step-0');
    const fermCells = fermRow.querySelectorAll('td');
    expect(fermCells[0]).not.toHaveClass('font-mono');
    // M35_P2 RA-2: text-slate-100 is retired by the token's text-slate-200; font-medium is an RA-3 safe passthrough.
    expect(fermCells[0]).toHaveClass('font-medium', 'text-slate-200');
    expect(fermCells[1]).not.toHaveClass('font-mono');
    // M35_P2 RA-2: per-cell text-slate-400 is retired by the token's text-slate-200.
    expect(fermCells[1]).toHaveClass('text-slate-200');
  });

  it('AC-22: prose warnings remain byte-identical', () => {
    expect(MASH_SRC_TEXT).toContain('bg-amber-950/50 border border-amber-800 rounded-lg p-2.5 mb-3 flex items-start gap-2 text-xs text-amber-300');
    expect(MASH_SRC_TEXT).toContain('text-[11px] text-amber-400/90 bg-amber-950/30 border border-amber-900 rounded-lg px-3 py-2 flex items-start gap-1.5');
  });

  it('AC-23: MashSection render tree gains no new element', () => {
    expect(MASH_SRC_TEXT.match(/data-testid=/g)?.length).toBe(14);
    expect(MASH_SRC_TEXT).toContain('data-testid="mash-sparge-temperature-value"');
    expect(MASH_SRC_TEXT).toContain('data-testid="mash-target-ph-value"');
  });


  it('AC-24: no literal scope="col" appears in MashSection.tsx (TableHeaderCell supplies it by construction, M35_P2 RA-7/RA-8)', () => {
    expect(MASH_SRC_TEXT.match(/scope="col"/g)).toBeNull();
  });
});

