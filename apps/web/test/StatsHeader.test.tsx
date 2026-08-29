import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { CalculatedStats, EquipmentProfile, UserConfig } from '@truchabrew/shared-types';
import { StatsHeader } from '../src/components/StatsHeader';

// New file (M7_P1 amendment §1.4) — StatsHeader now requires a `config`
// prop, so it is exercised directly here rather than only indirectly
// through App.test.tsx.

const BASE_EQUIPMENT: EquipmentProfile = {
  id: 'eq-1',
  name: 'Test Kit',
  batchSizeL: 20,
  boilTimeMin: 60,
  brewhouseEfficiencyPct: 75,
  mashEfficiencyPct: 80,
  boilOffRateLPerHour: 3.5,
  trubChillerLossL: 2,
  hopUtilizationPct: 87,
  derivedFromEquipmentId: null,
  mashWaterRatioLPerKg: 3.0,
  grainAbsorptionLPerKg: 0.96,
  hopstandUtilizationFactor: 0.26,
  hopstandTemperatureC: 79.0,
  spargeTemperatureC: 76.0,
  mashTunHeatCapacityL: 0.0,
  grainTemperatureC: 20.0,
  notes: '',
};

const BASE_CONFIG: UserConfig = {
  id: 'default',
  unitSystem: 'metric',
  gravityUnit: 'sg',
  temperatureUnit: 'celsius',
  ibuFormula: 'tinseth',
  abvFormula: 'simple',
};

function baseStats(overrides: Partial<CalculatedStats> = {}): CalculatedStats {
  return {
    og: 1.05,
    fg: 1.012,
    abv: 5.0,
    ibu: 30,
    srm: 6,
    ebc: 11.8,
    buGu: 0.5,
    rbr: 0.4,
    totalGrainKg: 5,
    totalHopG: 30,
    mashWaterL: 15,
    spargeWaterL: 10,
    totalWaterL: 25,
    preBoilVolumeL: 22,
    preBoilGravity: 1.048,
    attenuationPct: 76,
    postBoilVolumeL: 22,
    ...overrides,
  };
}

describe('AC-18: gravity renders through formatGravity per config.gravityUnit', () => {
  it('renders 1.050 / 1.012 in Plato when gravityUnit is "plato", and neither raw SG substring appears', () => {
    render(
      <StatsHeader
        stats={baseStats({ og: 1.05, fg: 1.012 })}
        equipment={BASE_EQUIPMENT}
        config={{ ...BASE_CONFIG, gravityUnit: 'plato' }}
      />,
    );
    expect(screen.getByText('12.4 °P')).toBeInTheDocument();
    expect(screen.getByText('3.1 °P')).toBeInTheDocument();
    expect(screen.queryByText(/1\.050/)).not.toBeInTheDocument();
    expect(screen.queryByText(/1\.012/)).not.toBeInTheDocument();
  });

  it('renders raw SG values and no °P anywhere when gravityUnit is "sg"', () => {
    const { container } = render(
      <StatsHeader stats={baseStats({ og: 1.05, fg: 1.012 })} equipment={BASE_EQUIPMENT} config={{ ...BASE_CONFIG, gravityUnit: 'sg' }} />,
    );
    expect(screen.getByText('1.050')).toBeInTheDocument();
    expect(screen.getByText('1.012')).toBeInTheDocument();
    expect(container.textContent).not.toContain('°P');
  });

  it('the pre-boil gravity sub-line follows the same rule', () => {
    render(
      <StatsHeader
        stats={baseStats({ preBoilGravity: 1.05 })}
        equipment={BASE_EQUIPMENT}
        config={{ ...BASE_CONFIG, gravityUnit: 'plato' }}
      />,
    );
    expect(screen.getByText(/Pre-boil: 12\.4 °P/)).toBeInTheDocument();
  });
});

describe('AC-19: ABV honors the configured strategy value and caption', () => {
  it('under "simple" the caption reads Simple', () => {
    render(<StatsHeader stats={baseStats({ abv: 9.2 })} equipment={BASE_EQUIPMENT} config={{ ...BASE_CONFIG, abvFormula: 'simple' }} />);
    expect(screen.getByText('9.2%')).toBeInTheDocument();
    expect(screen.getByText('Simple')).toBeInTheDocument();
    expect(screen.queryByText('Balling Formula')).not.toBeInTheDocument();
  });

  it('under "balling" the caption reads Balling, and the hardcoded "Balling Formula" string is gone', () => {
    render(<StatsHeader stats={baseStats({ abv: 9.0 })} equipment={BASE_EQUIPMENT} config={{ ...BASE_CONFIG, abvFormula: 'balling' }} />);
    expect(screen.getByText('9.0%')).toBeInTheDocument();
    expect(screen.getByText('Balling')).toBeInTheDocument();
    expect(screen.queryByText('Balling Formula')).not.toBeInTheDocument();
  });
});

describe('AC-20: IBU honors the configured strategy caption', () => {
  it('renders the active strategy display name, not a hardcoded "Tinseth"', () => {
    render(<StatsHeader stats={baseStats({ ibu: 42 })} equipment={BASE_EQUIPMENT} config={{ ...BASE_CONFIG, ibuFormula: 'rager' }} />);
    expect(screen.getByText('Rager')).toBeInTheDocument();
  });

  it('renders "Garetz (approximate)" when the active strategy is garetz', () => {
    render(<StatsHeader stats={baseStats()} equipment={BASE_EQUIPMENT} config={{ ...BASE_CONFIG, ibuFormula: 'garetz' }} />);
    expect(screen.getByText('Garetz (approximate)')).toBeInTheDocument();
  });

  it('renders "Tinseth" under the default strategy', () => {
    render(<StatsHeader stats={baseStats()} equipment={BASE_EQUIPMENT} config={{ ...BASE_CONFIG, ibuFormula: 'tinseth' }} />);
    expect(screen.getByText('Tinseth')).toBeInTheDocument();
  });
});

describe('AC-24: grain mass renders through formatMass per config.unitSystem', () => {
  it('renders 11.02 lb under "us"', () => {
    render(<StatsHeader stats={baseStats({ totalGrainKg: 5 })} equipment={BASE_EQUIPMENT} config={{ ...BASE_CONFIG, unitSystem: 'us' }} />);
    expect(screen.getByText(/Total Grain:/).parentElement?.textContent).toContain('11.02 lb');
  });

  it('renders 11.02 lb under "imperial"', () => {
    render(<StatsHeader stats={baseStats({ totalGrainKg: 5 })} equipment={BASE_EQUIPMENT} config={{ ...BASE_CONFIG, unitSystem: 'imperial' }} />);
    expect(screen.getByText(/Total Grain:/).parentElement?.textContent).toContain('11.02 lb');
  });

  it('renders 5.00 kg under "metric"', () => {
    render(<StatsHeader stats={baseStats({ totalGrainKg: 5 })} equipment={BASE_EQUIPMENT} config={{ ...BASE_CONFIG, unitSystem: 'metric' }} />);
    expect(screen.getByText(/Total Grain:/).parentElement?.textContent).toContain('5.00 kg');
  });
});

// ---------------------------------------------------------------------------
// M7_P2 §1.3 — volume + hop-mass figures now route through formatVolume /
// formatHopMass (AC-8, AC-9, AC-16, AC-19).
// ---------------------------------------------------------------------------

describe('AC-8: StatsHeader volume figures convert end-to-end', () => {
  const equipment: EquipmentProfile = { ...BASE_EQUIPMENT, batchSizeL: 20 };
  const stats = baseStats({ preBoilVolumeL: 23, mashWaterL: 15, spargeWaterL: 10, totalWaterL: 25 });

  it('under "us" renders the pinned gallon figures', () => {
    const { container } = render(<StatsHeader stats={stats} equipment={equipment} config={{ ...BASE_CONFIG, unitSystem: 'us' }} />);
    expect(container.textContent).toContain('5.28 gal');
    expect(container.textContent).toContain('6.08 gal');
    expect(container.textContent).toContain('3.96 gal');
    expect(container.textContent).toContain('2.64 gal');
    expect(container.textContent).toContain('6.60 gal');
  });

  it('under "imperial" renders the pinned imp-gal figures', () => {
    const { container } = render(<StatsHeader stats={stats} equipment={equipment} config={{ ...BASE_CONFIG, unitSystem: 'imperial' }} />);
    expect(container.textContent).toContain('4.40 imp gal');
    expect(container.textContent).toContain('5.50 imp gal');
  });

  it('under "metric" renders the pinned one-decimal litre figures', () => {
    const { container } = render(<StatsHeader stats={stats} equipment={equipment} config={{ ...BASE_CONFIG, unitSystem: 'metric' }} />);
    expect(container.textContent).toContain('20.0 L');
    expect(container.textContent).toContain('23.0 L');
    expect(container.textContent).toContain('15.0 L');
    expect(container.textContent).toContain('10.0 L');
    expect(container.textContent).toContain('25.0 L');
  });

  it('gravity/ABV/IBU/SRM/BU:GU/Total Grain tiles are unaffected by the unit system', () => {
    render(<StatsHeader stats={stats} equipment={equipment} config={{ ...BASE_CONFIG, unitSystem: 'us' }} />);
    expect(screen.getByText('1.050')).toBeInTheDocument();
    expect(screen.getByText('5.0%')).toBeInTheDocument();
  });
});

describe('AC-9: StatsHeader total-hops figure converts', () => {
  it('renders 5.29 oz under "us"', () => {
    const { container } = render(
      <StatsHeader stats={baseStats({ totalHopG: 150 })} equipment={BASE_EQUIPMENT} config={{ ...BASE_CONFIG, unitSystem: 'us' }} />,
    );
    expect(container.textContent).toContain('5.29 oz');
  });

  it('renders 5.29 oz under "imperial"', () => {
    const { container } = render(
      <StatsHeader stats={baseStats({ totalHopG: 150 })} equipment={BASE_EQUIPMENT} config={{ ...BASE_CONFIG, unitSystem: 'imperial' }} />,
    );
    expect(container.textContent).toContain('5.29 oz');
  });

  it('renders 150.0 g under "metric", and the hardcoded " g" suffix is gone from source', () => {
    const { container } = render(
      <StatsHeader stats={baseStats({ totalHopG: 150 })} equipment={BASE_EQUIPMENT} config={{ ...BASE_CONFIG, unitSystem: 'metric' }} />,
    );
    expect(container.textContent).toContain('150.0 g');
  });
});

describe('AC-16: no litre/gram figures survive under a non-metric unit system', () => {
  it('under "us", no `/\\d\\s*L\\b/` or `/\\d\\s*g\\b/` substring remains', () => {
    const { container } = render(
      <StatsHeader
        stats={baseStats({ totalGrainKg: 5, totalHopG: 150 })}
        equipment={BASE_EQUIPMENT}
        config={{ ...BASE_CONFIG, unitSystem: 'us' }}
      />,
    );
    expect(container.textContent).not.toMatch(/\d\s*L\b/);
    expect(container.textContent).not.toMatch(/\d\s*g\b/);
  });

  it('under "metric", no "gal" or " oz" substring appears', () => {
    const { container } = render(<StatsHeader stats={baseStats()} equipment={BASE_EQUIPMENT} config={{ ...BASE_CONFIG, unitSystem: 'metric' }} />);
    expect(container.textContent).not.toContain('gal');
    expect(container.textContent).not.toContain(' oz');
  });
});

describe('AC-19: the batch-size text differs between "us" and "imperial"', () => {
  it('renders distinct strings for the two systems', () => {
    const equipment: EquipmentProfile = { ...BASE_EQUIPMENT, batchSizeL: 20 };
    const { container: usContainer } = render(<StatsHeader stats={baseStats()} equipment={equipment} config={{ ...BASE_CONFIG, unitSystem: 'us' }} />);
    const { container: impContainer } = render(<StatsHeader stats={baseStats()} equipment={equipment} config={{ ...BASE_CONFIG, unitSystem: 'imperial' }} />);
    expect(usContainer.textContent).toContain('5.28 gal');
    expect(impContainer.textContent).toContain('4.40 imp gal');
    expect(usContainer.textContent).not.toContain('4.40 imp gal');
  });
});

describe('M29_P3 AC-4..AC-9: tabular numerals and font-mono formatting on live metrics', () => {
  it('renders font-mono and tabular-nums on vital metric values', () => {
    const { container } = render(<StatsHeader stats={baseStats()} equipment={BASE_EQUIPMENT} config={BASE_CONFIG} />);
    const ogEl = screen.getByText('1.050');
    expect(ogEl.className).toContain('font-mono');
    expect(ogEl.className).toContain('tabular-nums');

    const fgEl = screen.getByText('1.012');
    expect(fgEl.className).toContain('font-mono');
    expect(fgEl.className).toContain('tabular-nums');

    const abvEl = screen.getByText('5.0%');
    expect(abvEl.className).toContain('font-mono');
    expect(abvEl.className).toContain('tabular-nums');

    const ibuTile = screen.getByText('Bitterness (IBU)').parentElement!;
    expect(ibuTile.textContent).toContain('30 IBU');
    expect(container.querySelector('.tabular-nums')).not.toBeNull();
  });
});

describe('M32_P4: StatsHeader secondary readback typography (AC-6..AC-18)', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const STATS_SRC_PATH = path.resolve(__dirname, '../src/components/StatsHeader.tsx');
  const STATS_SRC_TEXT = fs.readFileSync(STATS_SRC_PATH, 'utf-8');

  it('AC-6..AC-8: top bar readbacks (MSH-1..MSH-3) carry MONO_VALUE_CLASS', () => {
    render(<StatsHeader stats={baseStats()} equipment={BASE_EQUIPMENT} config={BASE_CONFIG} />);
    const batchSizeStrong = screen.getByText('20.0 L');
    expect(batchSizeStrong).toHaveClass('font-mono', 'tabular-nums', 'tracking-tight');

    const preBoilVolStrong = screen.getByText('22.0 L');
    expect(preBoilVolStrong).toHaveClass('font-mono', 'tabular-nums', 'tracking-tight');

    const effStrong = screen.getByText('75%');
    expect(effStrong).toHaveClass('font-mono', 'tabular-nums', 'tracking-tight');
  });

  it('AC-9..AC-12: tile sub-lines (MSH-4..MSH-7) carry MONO_VALUE_CLASS', () => {
    render(<StatsHeader stats={baseStats()} equipment={BASE_EQUIPMENT} config={BASE_CONFIG} />);
    const preBoilEl = screen.getByText(/Pre-boil: 1\.048/);
    expect(preBoilEl).toHaveClass('font-mono', 'tabular-nums', 'tracking-tight');

    const attEl = screen.getByText('Attenuation: 76%');
    expect(attEl).toHaveClass('font-mono', 'tabular-nums', 'tracking-tight');

    const ebcEl = screen.getByText('(11.8 EBC)');
    expect(ebcEl).toHaveClass('font-mono', 'tabular-nums', 'tracking-tight');

    const rbrEl = screen.getByText('RBR: 0.4');
    expect(rbrEl).toHaveClass('font-mono', 'tabular-nums', 'tracking-tight');
  });

  it('AC-13..AC-17: quick specs bar readbacks (MSH-8..MSH-12) carry MONO_VALUE_CLASS', () => {
    render(<StatsHeader stats={baseStats()} equipment={BASE_EQUIPMENT} config={BASE_CONFIG} />);
    const grainStrong = screen.getByText('5.00 kg');
    expect(grainStrong).toHaveClass('font-mono', 'tabular-nums', 'tracking-tight');

    const hopsStrong = screen.getByText('30.0 g');
    expect(hopsStrong).toHaveClass('font-mono', 'tabular-nums', 'tracking-tight');

    const mashWaterStrong = screen.getByText('15.0 L');
    expect(mashWaterStrong).toHaveClass('font-mono', 'tabular-nums', 'tracking-tight');

    const spargeWaterStrong = screen.getByText('10.0 L');
    expect(spargeWaterStrong).toHaveClass('font-mono', 'tabular-nums', 'tracking-tight');

    const totalWaterStrong = screen.getByText('25.0 L');
    expect(totalWaterStrong).toHaveClass('font-mono', 'tabular-nums', 'tracking-tight');
  });

  it('AC-18: zero raw font-mono tabular-nums without tracking-tight in StatsHeader.tsx', () => {
    expect(STATS_SRC_TEXT).not.toMatch(/font-mono tabular-nums(?! tracking-tight)/);
  });
});


