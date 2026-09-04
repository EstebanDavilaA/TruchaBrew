import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { HopItem, UserConfig } from '@truchabrew/shared-types';
import { HopSection } from '../src/components/HopSection';
import { ConfigProvider } from '../src/context/ConfigContext';

vi.mock('../src/context/CatalogContext', () => ({
  useCatalog: () => ({
    catalog: {
      fermentables: [],
      hops: [{ id: 'cat-h-1', name: 'Citra', alphaAcidPct: 12.5, type: 'Pellet' }],
      yeasts: [],
      miscs: [],
    },
    loading: false,
    error: null,
    reload: vi.fn(),
  }),
}));

const HOPSTAND_TEMP_C = 79.0;

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
      return Promise.reject(new Error(`Unexpected global fetch call in HopSection.test.tsx: ${url}`));
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderHopSection(
  hops: HopItem[],
  onUpdate = vi.fn(),
  config: Partial<UserConfig> = {},
  altitudeMeters = 0,
) {
  const testConfig = { ...DEFAULT_TEST_CONFIG, ...config };
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === '/api/config') return Promise.resolve(jsonResponse(testConfig));
      return Promise.reject(new Error(`Unexpected global fetch call in HopSection.test.tsx: ${url}`));
    }),
  );
  render(
    <ConfigProvider>
      <HopSection
        hops={hops}
        wortGravity={1.05}
        batchSizeL={20}
        hopUtilizationPct={87}
        hopstandUtilizationFactor={0.26}
        hopstandTemperatureC={HOPSTAND_TEMP_C}
        altitudeMeters={altitudeMeters}
        totalHopG={hops.reduce((s, h) => s + h.amountG, 0)}
        totalIbu={hops.length > 0 ? 35.0 : 0}
        onUpdate={onUpdate}
      />
    </ConfigProvider>,
  );
  return onUpdate;
}

describe('F-7: whirlpoolTempC comes from the equipment profile, not a hardcoded literal', () => {
  it('adding a hop from catalog and changing use to Whirlpool writes the real hopstandTemperatureC', () => {
    const onUpdate = renderHopSection([]);

    fireEvent.click(screen.getByTestId('hop-open-picker-btn'));
    fireEvent.click(screen.getByTestId('preset-item-cat-h-1'));

    expect(onUpdate).toHaveBeenCalledTimes(1);
    const updated = onUpdate.mock.calls[0][0] as HopItem[];
    const added = updated[updated.length - 1];
    expect(added.name).toBe('Citra');
    expect(added.use).toBe('Boil');

    // Changing use in the table to Whirlpool applies hopstandTemperatureC
    const onUpdateWithHop = renderHopSection([added]);
    const select = screen.getByLabelText('Hop use');
    fireEvent.change(select, { target: { value: 'Whirlpool' } });
    expect(onUpdateWithHop).toHaveBeenCalledTimes(1);
    const modified = onUpdateWithHop.mock.calls[0][0] as HopItem[];
    expect(modified[0].whirlpoolTempC).toBe(HOPSTAND_TEMP_C);
    expect(modified[0].whirlpoolTempC).not.toBe(90);
  });
});

describe('M11_P2 Hop Schedule Contextual Controls (AC-10..AC-14)', () => {
  const boilHop: HopItem = {
    id: 'h-boil',
    name: 'Citra',
    amountG: 25,
    alphaAcidPct: 12.5,
    use: 'Boil',
    boilMins: 60,
    whirlpoolMins: null,
    whirlpoolTempC: null,
    type: 'Pellet',
  };

  const whirlpoolHop: HopItem = {
    id: 'h-wp',
    name: 'Mosaic',
    amountG: 30,
    alphaAcidPct: 11.8,
    use: 'Whirlpool',
    boilMins: null,
    whirlpoolMins: 20,
    whirlpoolTempC: 80.0,
    type: 'Pellet',
  };

  const dryHop: HopItem = {
    id: 'h-dh',
    name: 'Simcoe',
    amountG: 50,
    alphaAcidPct: 13.0,
    use: 'DryHop',
    boilMins: null,
    whirlpoolMins: null,
    whirlpoolTempC: null,
    dryHopDayOffset: 3,
    dryHopDurationDays: 4,
    type: 'Pellet',
  };

  it('AC-10 & AC-11: Boil hop row edits boilMins; Whirlpool row edits whirlpoolMins & whirlpoolTempC', () => {
    const onUpdate = renderHopSection([boilHop, whirlpoolHop]);

    const boilInput = screen.getByTestId('hop-boil-mins-h-boil');
    expect(boilInput).toHaveValue(60);
    fireEvent.change(boilInput, { target: { value: '45' } });
    expect(onUpdate).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: 'h-boil', boilMins: 45 })]),
    );

    onUpdate.mockClear();
    const wpMinsInput = screen.getByTestId('hop-whirlpool-mins-h-wp');
    const wpTempInput = screen.getByTestId('hop-whirlpool-temp-h-wp');
    expect(wpMinsInput).toHaveValue(20);
    expect(wpTempInput).toHaveValue(80);

    fireEvent.change(wpMinsInput, { target: { value: '15' } });
    expect(onUpdate).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: 'h-wp', whirlpoolMins: 15 })]),
    );

    onUpdate.mockClear();
    fireEvent.change(wpTempInput, { target: { value: '85' } });
    expect(onUpdate).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: 'h-wp', whirlpoolTempC: 85 })]),
    );
  });

  it('AC-12: DryHop row edits dryHopDayOffset and dryHopDurationDays', () => {
    const onUpdate = renderHopSection([dryHop]);

    const offsetInput = screen.getByTestId('hop-dry-offset-h-dh');
    const durationInput = screen.getByTestId('hop-dry-duration-h-dh');
    expect(offsetInput).toHaveValue(3);
    expect(durationInput).toHaveValue(4);

    fireEvent.change(offsetInput, { target: { value: '5' } });
    expect(onUpdate).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: 'h-dh', dryHopDayOffset: 5 })]),
    );

    onUpdate.mockClear();
    fireEvent.change(durationInput, { target: { value: '7' } });
    expect(onUpdate).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: 'h-dh', dryHopDurationDays: 7, timeMinutes: 10080 }),
      ]),
    );
  });

  it('AC-13: Changing hop use switches visible input fields dynamically', () => {
    const onUpdate = renderHopSection([boilHop]);

    const useSelect = screen.getByTestId('hop-use-select-h-boil');
    expect(useSelect).toHaveValue('Boil');

    fireEvent.change(useSelect, { target: { value: 'DryHop' } });
    expect(onUpdate).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'h-boil',
          use: 'DryHop',
          name: 'Citra',
          amountG: 25,
          alphaAcidPct: 12.5,
        }),
      ]),
    );
  });

  it('AC-14: IBU display reflects altitude scaling when altitudeMeters > 0', () => {
    // Render at sea level (altitude = 0)
    const { unmount } = render(
      <ConfigProvider>
        <HopSection
          hops={[boilHop]}
          wortGravity={1.05}
          batchSizeL={20}
          hopUtilizationPct={100}
          hopstandUtilizationFactor={0.26}
          hopstandTemperatureC={79.0}
          altitudeMeters={0}
          totalHopG={25}
          totalIbu={35}
          onUpdate={vi.fn()}
        />
      </ConfigProvider>,
    );

    const seaLevelIbuText = screen.getByTestId('hop-ibu-h-boil').textContent;
    const seaLevelIbu = parseFloat(seaLevelIbuText!);
    unmount();

    // Render at high altitude (altitude = 2000m)
    render(
      <ConfigProvider>
        <HopSection
          hops={[boilHop]}
          wortGravity={1.05}
          batchSizeL={20}
          hopUtilizationPct={100}
          hopstandUtilizationFactor={0.26}
          hopstandTemperatureC={79.0}
          altitudeMeters={2000}
          totalHopG={25}
          totalIbu={35}
          onUpdate={vi.fn()}
        />
      </ConfigProvider>,
    );

    const altitudeIbuText = screen.getByTestId('hop-ibu-h-boil').textContent;
    const altitudeIbu = parseFloat(altitudeIbuText!);
    expect(altitudeIbu).toBeLessThan(seaLevelIbu);
  });
});

describe('AC-10: HopSection summary conversion', () => {
  const hop40g: HopItem = {
    id: 'h-1',
    name: 'Citra',
    amountG: 40,
    alphaAcidPct: 12.5,
    use: 'Boil',
    boilMins: 60,
    whirlpoolMins: null,
    whirlpoolTempC: null,
    type: 'Pellet',
  };

  it('(a) Total Hops summary reads 5.29 oz under US units for 150g total', async () => {
    renderHopSection([{ ...hop40g, amountG: 150 }], vi.fn(), { unitSystem: 'us' });
    await waitFor(() => expect(screen.getByText('5.29 oz')).toBeInTheDocument());
  });

  it('(b) per-hop Amount input stays in grams (not 1.41)', async () => {
    renderHopSection([hop40g], vi.fn(), { unitSystem: 'us' });
    await waitFor(() => expect(screen.getByText('1.41 oz')).toBeInTheDocument());

    expect(screen.getByDisplayValue('40')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('1.41')).not.toBeInTheDocument();
  });
});

describe('M32_P1: source sweeps (AC-10 through AC-15, AC-28)', () => {
  const HOP_SECTION_PATH = path.resolve(__dirname, '../src/components/HopSection.tsx');
  const content = fs.readFileSync(HOP_SECTION_PATH, 'utf-8');
  const numberInputTags = content.match(/<NumberInput[\s\S]*?\/>/g) || [];

  it('AC-10: zero raw <input> elements remain', () => {
    const matches = content.match(/<input[\s>]/g) || [];
    expect(matches.length).toBe(0);
  });

  it('AC-11: exactly 7 <NumberInput> call sites in HopSection.tsx', () => {
    const matches = content.match(/<NumberInput[\s>]/g) || [];
    expect(matches.length).toBe(7);
  });

  it('AC-12 (sweep half): every <NumberInput> call site passes type="number"', () => {
    expect(numberInputTags.length).toBe(7);
    for (const tag of numberInputTags) {
      expect(tag).toContain('type="number"');
    }
  });

  it('AC-13: zero <NumberInput> call sites carry className', () => {
    expect(numberInputTags.length).toBe(7);
    for (const tag of numberInputTags) {
      expect(tag).not.toContain('className');
    }
  });

  it('AC-14: drifted local strings are purged', () => {
    expect(content.match(/bg-slate-950 border border-slate-700\/80/g)).toBeNull();
    expect(content).not.toContain('${INPUT_COMPACT_CLASS} font-mono tabular-nums text-right');
    expect(content.match(/focus:ring-1/g)).toBeNull();
  });

  it('AC-15: INPUT_COMPACT_CLASS is no longer imported or referenced', () => {
    expect(content).not.toMatch(/\bINPUT_COMPACT_CLASS\b/);
  });

  it('AC-28: out-of-scope elements are untouched (0 raw selects, 0 raw buttons, placeholder div, zero addonRight)', () => {
    expect((content.match(/<select\b/g) || []).length).toBe(0);
    expect((content.match(/<button\b/g) || []).length).toBe(0);
    expect(content).toContain('<div className="text-xs text-slate-400 font-mono">—</div>');
    expect(content).not.toMatch(/addonRight/);
  });

  const widthBoilHop: HopItem = {
    id: 'w-boil',
    name: 'Citra',
    amountG: 25,
    alphaAcidPct: 12.5,
    use: 'Boil',
    boilMins: 60,
    whirlpoolMins: null,
    whirlpoolTempC: null,
    type: 'Pellet',
  };

  const widthWhirlpoolHop: HopItem = {
    id: 'w-wp',
    name: 'Mosaic',
    amountG: 30,
    alphaAcidPct: 11.8,
    use: 'Whirlpool',
    boilMins: null,
    whirlpoolMins: 20,
    whirlpoolTempC: 80.0,
    type: 'Pellet',
  };

  const widthDryHop: HopItem = {
    id: 'w-dh',
    name: 'Simcoe',
    amountG: 50,
    alphaAcidPct: 13.0,
    use: 'DryHop',
    boilMins: null,
    whirlpoolMins: null,
    whirlpoolTempC: null,
    dryHopDayOffset: 3,
    dryHopDurationDays: 4,
    type: 'Pellet',
  };

  it('AC-12 (rendered half): Boil minutes input has type="number"', () => {
    renderHopSection([widthBoilHop]);
    expect(screen.getByLabelText('Boil minutes').getAttribute('type')).toBe('number');
  });

  it('AC-16: table-row widths render correctly', () => {
    renderHopSection([widthBoilHop, widthWhirlpoolHop, widthDryHop]);
    expect(screen.getByLabelText('Boil minutes')).toHaveClass('w-20');
    expect(screen.getByLabelText('Whirlpool minutes')).toHaveClass('w-20');
    expect(screen.getByLabelText('Whirlpool temp')).toHaveClass('w-20');
    expect(screen.getByLabelText('Dry hop day offset')).toHaveClass('w-20');
    expect(screen.getByLabelText('Dry hop duration days')).toHaveClass('w-20');
    expect(screen.getByLabelText('Citra amount (g)')).toHaveClass('w-16');
    expect(screen.getByLabelText('Citra alpha acid %')).toHaveClass('w-16');
  });

  it('AC-19: migrated inputs share MONO_VALUE_CLASS typography (font-mono tabular-nums tracking-tight)', () => {
    renderHopSection([widthBoilHop, widthWhirlpoolHop, widthDryHop]);
    const tableInputs = [
      screen.getByLabelText('Boil minutes'),
      screen.getByLabelText('Whirlpool minutes'),
      screen.getByLabelText('Whirlpool temp'),
      screen.getByLabelText('Dry hop day offset'),
      screen.getByLabelText('Dry hop duration days'),
      screen.getByLabelText('Citra amount (g)'),
      screen.getByLabelText('Citra alpha acid %'),
    ];
    for (const el of tableInputs) {
      expect(el).toHaveClass('font-mono', 'tabular-nums', 'tracking-tight');
    }
  });

  it('AC-20: entered value and readback IBU cell share font-mono tabular-nums typography', () => {
    renderHopSection([widthBoilHop]);
    const input = screen.getByLabelText('Boil minutes');
    const readback = screen.getByTestId('hop-ibu-w-boil');
    expect(input).toHaveClass('font-mono', 'tabular-nums', 'tracking-tight');
    expect(readback).toHaveClass('font-mono', 'tabular-nums');
  });

  it('AC-21: editing amount and alpha acid fires onUpdate exactly once with clamped values', () => {
    const onUpdate = renderHopSection([widthBoilHop]);

    const amountInput = screen.getByLabelText('Citra amount (g)');
    fireEvent.change(amountInput, { target: { value: '-10' } });
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: 'w-boil', amountG: 0 })]),
    );

    onUpdate.mockClear();
    const alphaInput = screen.getByLabelText('Citra alpha acid %');
    fireEvent.change(alphaInput, { target: { value: '-5' } });
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: 'w-boil', alphaAcidPct: 0 })]),
    );
  });

  it('AC-22: Add Hop flow appends the selected catalog preset with default settings', () => {
    const onUpdate = renderHopSection([widthBoilHop]);

    fireEvent.click(screen.getByTestId('hop-open-picker-btn'));
    fireEvent.click(screen.getByTestId('preset-item-cat-h-1'));

    expect(onUpdate).toHaveBeenCalledTimes(1);
    const updated = onUpdate.mock.calls[0][0] as HopItem[];
    expect(updated).toHaveLength(2);
    expect(updated[1]).toMatchObject({
      name: 'Citra',
      use: 'Boil',
      boilMins: 60,
      amountG: 25,
      whirlpoolMins: null,
      whirlpoolTempC: null,
      dryHopDayOffset: null,
      dryHopDurationDays: null,
      timeMinutes: 60,
      type: 'Pellet',
    });
  });

  it('AC-23: degenerate empty hop list renders exactly one colSpan=7 row and zero table inputs', () => {
    renderHopSection([]);

    const emptyText = screen.getByText('No hops added yet. Add hop additions below to calculate bittering & aroma.');
    expect(emptyText.closest('td')).toHaveAttribute('colSpan', '7');

    const tbody = emptyText.closest('tbody');
    expect(tbody?.querySelectorAll('input').length).toBe(0);
    expect(screen.getByTestId('hop-open-picker-btn')).toBeInTheDocument();
  });

  it('AC-24: all 5 per-row data-testids resolve to HTMLInputElement', () => {
    renderHopSection([widthBoilHop, widthWhirlpoolHop, widthDryHop]);
    const testids = [
      'hop-boil-mins-w-boil',
      'hop-whirlpool-mins-w-wp',
      'hop-whirlpool-temp-w-wp',
      'hop-dry-offset-w-dh',
      'hop-dry-duration-w-dh',
    ];
    for (const tid of testids) {
      expect(screen.getByTestId(tid)).toBeInstanceOf(HTMLInputElement);
    }
  });
});
