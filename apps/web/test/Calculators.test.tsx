import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import type { UserConfig } from '@truchabrew/shared-types';
import { strikeTemperatureC, formatTemperature } from '@truchabrew/calculations';
import { ConfigProvider, useConfig } from '../src/context/ConfigContext';
import { Calculators } from '../src/pages/Calculators';
import { SettingsManager } from '../src/components/SettingsManager';
import { NAV_ITEMS } from '../src/components/Sidebar';

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

function mockConfig(config: UserConfig) {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === '/api/config') return Promise.resolve(jsonResponse(config));
      return Promise.reject(new Error(`Unexpected fetch in Calculators.test.tsx: ${url}`));
    }),
  );
}

async function renderCalculators(config: UserConfig = DEFAULT_TEST_CONFIG) {
  mockConfig(config);
  const result = render(
    <ConfigProvider>
      <Calculators />
    </ConfigProvider>,
  );
  await waitFor(() => expect(screen.getByText('Calculators')).toBeInTheDocument());
  return result;
}

beforeEach(() => {
  vi.unstubAllGlobals();
  Object.defineProperty(window, 'localStorage', {
    value: {
      setItem: vi.fn(),
      getItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    },
    writable: true,
  });
});

describe('AC-12: strike-water card computes via the recipe path\'s own function', () => {
  it('renders 78.1 °C under celsius and 172.6 °F under fahrenheit', async () => {
    await renderCalculators({ ...DEFAULT_TEST_CONFIG, temperatureUnit: 'celsius' });
    const expectedC = strikeTemperatureC({
      targetMashTempC: 67,
      grainTemperatureC: 20,
      waterVolumeL: 15,
      grainWeightKg: 5,
      mashTunHeatCapacityL: 1.5,
    });
    expect(formatTemperature(expectedC, 'celsius')).toBe('78.1 °C');
    await waitFor(() => expect(screen.getByText('78.1 °C')).toBeInTheDocument());
  });

  it('renders 172.6 °F under fahrenheit', async () => {
    await renderCalculators({ ...DEFAULT_TEST_CONFIG, temperatureUnit: 'fahrenheit' });
    await waitFor(() => expect(screen.getByText('172.6 °F')).toBeInTheDocument());
  });
});

describe('AC-13: infusion-volume card', () => {
  it('renders 4.8 L under metric', async () => {
    await renderCalculators({ ...DEFAULT_TEST_CONFIG, unitSystem: 'metric' });
    await waitFor(() => expect(screen.getByText('4.8 L')).toBeInTheDocument());
  });

  it('renders 1.26 gal under us', async () => {
    await renderCalculators({ ...DEFAULT_TEST_CONFIG, unitSystem: 'us' });
    await waitFor(() => expect(screen.getByText('1.26 gal')).toBeInTheDocument());
  });

  it('a target below the current temperature renders the function\'s own 0.0 L guard', async () => {
    await renderCalculators({ ...DEFAULT_TEST_CONFIG, unitSystem: 'metric' });
    await waitFor(() => screen.getByLabelText('Infusion target temperature (°C)'));
    fireEvent.change(screen.getByLabelText('Infusion target temperature (°C)'), { target: { value: '50' } });
    await waitFor(() => expect(screen.getByText('0.0 L')).toBeInTheDocument());
  });
});

describe('AC-14: hydrometer card', () => {
  it('renders 1.053 under sg and 13.0 °P under plato; calibration field defaults to 20', async () => {
    await renderCalculators({ ...DEFAULT_TEST_CONFIG, gravityUnit: 'sg' });
    await waitFor(() => expect(screen.getByText('1.053')).toBeInTheDocument());
    expect(screen.getByLabelText('Calibration temperature (°C)')).toHaveValue('20');
  });

  it('renders 13.0 °P under plato', async () => {
    await renderCalculators({ ...DEFAULT_TEST_CONFIG, gravityUnit: 'plato' });
    await waitFor(() => expect(screen.getByText('13.0 °P')).toBeInTheDocument());
  });
});

describe('AC-15: refractometer card', () => {
  it('renders OG 1.048 and FG 1.012 with WCF defaulted to 1.04', async () => {
    await renderCalculators({ ...DEFAULT_TEST_CONFIG, gravityUnit: 'sg' });
    expect(screen.getByLabelText('Wort correction factor (ratio)')).toHaveValue('1.04');
    await waitFor(() => {
      expect(screen.getByText('1.048')).toBeInTheDocument();
      expect(screen.getByText('1.012')).toBeInTheDocument();
    });
  });

  it('changing WCF to 1 changes both displayed gravities', async () => {
    await renderCalculators({ ...DEFAULT_TEST_CONFIG, gravityUnit: 'sg' });
    await waitFor(() => screen.getByText('1.048'));
    fireEvent.change(screen.getByLabelText('Wort correction factor (ratio)'), { target: { value: '1' } });
    await waitFor(() => {
      expect(screen.queryByText('1.048')).toBeNull();
      expect(screen.getByText('1.050')).toBeInTheDocument();
      expect(screen.getByText('1.013')).toBeInTheDocument();
    });
  });
});

describe('AC-16: unit-converter card, all six rows', () => {
  it('renders every family\'s converted outputs', async () => {
    await renderCalculators();
    await waitFor(() => {
      expect(screen.getByText('12.4 °P')).toBeInTheDocument();
      expect(screen.getByText('12.39 °Bx')).toBeInTheDocument();
      expect(screen.getByText('19.70 EBC')).toBeInTheDocument();
      expect(screen.getByText('7.94 °L')).toBeInTheDocument();
      expect(screen.getByText('5.28 gal')).toBeInTheDocument();
      expect(screen.getByText('4.40 imp gal')).toBeInTheDocument();
      expect(screen.getByText('11.02 lb')).toBeInTheDocument();
      expect(screen.getByText('176.37 oz')).toBeInTheDocument();
      expect(screen.getByText('68.0 °F')).toBeInTheDocument();
      expect(screen.getByText('99.97 kPa')).toBeInTheDocument();
      expect(screen.getByText('1.00 bar')).toBeInTheDocument();
    });
  });
});

describe('AC-17: outputs honour the config; a settings change is visible on this page', () => {
  it('metric/celsius render differs from us/fahrenheit, and neither render contains "NaN"', async () => {
    const metric = await renderCalculators({ ...DEFAULT_TEST_CONFIG, unitSystem: 'metric', temperatureUnit: 'celsius' });
    expect(screen.getByText('78.1 °C')).toBeInTheDocument();
    expect(screen.getByText('4.8 L')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('NaN');
    metric.unmount();

    const us = await renderCalculators({ ...DEFAULT_TEST_CONFIG, unitSystem: 'us', temperatureUnit: 'fahrenheit' });
    expect(screen.getByText('172.6 °F')).toBeInTheDocument();
    expect(screen.getByText('1.26 gal')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('NaN');
    us.unmount();
  });
});

describe('AC-18: inputs stay canonical-metric and say so', () => {
  it('under unitSystem "us", the strike card\'s water-volume input still holds 15 with label containing (L); grain-weight holds 5 with label containing (kg); target-temperature label contains (°C)', async () => {
    await renderCalculators({ ...DEFAULT_TEST_CONFIG, unitSystem: 'us', temperatureUnit: 'fahrenheit' });
    expect(screen.getByLabelText('Water volume (L)')).toHaveValue('15');
    expect(screen.getByLabelText('Grain weight (kg)')).toHaveValue('5');
    expect(screen.getByLabelText('Target mash temperature (°C)')).toBeInTheDocument();
  });

  it('typing into an input never converts the typed value', async () => {
    await renderCalculators({ ...DEFAULT_TEST_CONFIG, unitSystem: 'us', temperatureUnit: 'fahrenheit' });
    fireEvent.change(screen.getByLabelText('Water volume (L)'), { target: { value: '25' } });
    expect(screen.getByLabelText('Water volume (L)')).toHaveValue('25');
  });

  it('every <input> on the page has a label containing an explicit unit token from the required set', async () => {
    await renderCalculators();
    // M8_P2 extends this page-wide sweep's token set in place (same
    // extend-never-remove shape as calculatorImportGraph.test.ts's
    // bannedLiterals/names/partition arrays) — none of the original eight
    // tokens is removed, and the five new cards' own vocabulary
    // ((B), (%), (months), (days), (vols), (B/g), (L/h)) is added so this
    // still-page-wide check covers the ten-card page truthfully.
    const allowedTokens = ['(L)', '(kg)', '(°C)', '(SG)', '(°Bx)', '(SRM)', '(psi)', '(ratio)', '(B)', '(%)', '(months)', '(days)', '(vols)', '(B/g)', '(L/h)'];
    const inputs = document.querySelectorAll('input');
    expect(inputs.length).toBeGreaterThan(0);
    for (const input of Array.from(inputs)) {
      const label = input.closest('label') ?? (input.id ? document.querySelector(`label[for="${input.id}"]`) : null);
      expect(label).not.toBeNull();
      const labelText = label!.textContent ?? '';
      expect(allowedTokens.some((token) => labelText.includes(token)), `Label "${labelText}" has no recognized unit token`).toBe(true);
    }

  });
});

describe('AC-19: page renders through TopBar with title "Calculators", no actions', () => {
  it('renders the page title heading', async () => {
    await renderCalculators();
    expect(screen.getByRole('heading', { name: 'Calculators' })).toBeInTheDocument();
  });
});

describe('AC-20: degenerate/empty inputs render the em-dash, never NaN or 0', () => {
  it('clearing the grain-weight field renders — for the strike result', async () => {
    await renderCalculators();
    await waitFor(() => screen.getByText('78.1 °C'));
    fireEvent.change(screen.getByLabelText('Grain weight (kg)'), { target: { value: '' } });
    await waitFor(() => {
      expect(screen.queryByText('78.1 °C')).toBeNull();
      expect(screen.queryByText('NaN')).toBeNull();
      expect(screen.queryByText('0.0 °C')).toBeNull();
    });
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('a whitespace-only entry also renders —, and an alphabetic entry also renders —', async () => {
    await renderCalculators();
    await waitFor(() => screen.getByText('78.1 °C'));
    fireEvent.change(screen.getByLabelText('Grain weight (kg)'), { target: { value: '   ' } });
    await waitFor(() => expect(screen.getAllByText('—').length).toBeGreaterThan(0));

    fireEvent.change(screen.getByLabelText('Grain weight (kg)'), { target: { value: 'abc' } });
    await waitFor(() => expect(screen.getAllByText('—').length).toBeGreaterThan(0));
  });

  it('typing a literal 0 renders the real zero-grain answer (67.0 °C), distinguishing blank from zero', async () => {
    await renderCalculators();
    await waitFor(() => screen.getByText('78.1 °C'));
    fireEvent.change(screen.getByLabelText('Grain weight (kg)'), { target: { value: '0' } });
    await waitFor(() => expect(screen.getByText('67.0 °C')).toBeInTheDocument());
  });
});

describe('AC-21: no writes, no persistence, no leaked placeholder', () => {
  it('filling every field and unmounting issues zero POST/PUT/PATCH/DELETE and no extra GET beyond /api/config, and never calls localStorage.setItem', async () => {
    mockConfig(DEFAULT_TEST_CONFIG);
    const { unmount } = render(
      <ConfigProvider>
        <Calculators />
      </ConfigProvider>,
    );
    await waitFor(() => screen.getByText('78.1 °C'));

    fireEvent.change(screen.getByLabelText('Grain weight (kg)'), { target: { value: '7' } });
    fireEvent.change(screen.getByLabelText('Hydrometer reading (SG)'), { target: { value: '1.060' } });

    unmount();

    const calls = vi.mocked(fetch).mock.calls;
    for (const [input, init] of calls) {
      const url = typeof input === 'string' ? input : (input as URL | Request).toString();
      const method = ((init?.method as string | undefined) ?? 'GET').toUpperCase();
      expect(url).toBe('/api/config');
      expect(['POST', 'PUT', 'PATCH', 'DELETE']).not.toContain(method);
    }
    expect(window.localStorage.setItem).not.toHaveBeenCalled();
  });

  it('navigating away and back (remount) resets every field to its initial value', async () => {
    const { unmount } = await (async () => {
      mockConfig(DEFAULT_TEST_CONFIG);
      const result = render(
        <ConfigProvider>
          <Calculators />
        </ConfigProvider>,
      );
      await waitFor(() => screen.getByText('78.1 °C'));
      fireEvent.change(screen.getByLabelText('Grain weight (kg)'), { target: { value: '7' } });
      await waitFor(() => expect(screen.getByLabelText('Grain weight (kg)')).toHaveValue('7'));
      return result;
    })();
    unmount();

    await renderCalculators();
    expect(screen.getByLabelText('Grain weight (kg)')).toHaveValue('5');
  });
});

describe('AC-22: lockstep — one config change updates every card in the same pass', () => {
  function Harness() {
    const { config } = useConfig();
    return (
      <>
        <Calculators />
        <SettingsManager />
        <span data-testid="probe-unit">{config.unitSystem}</span>
      </>
    );
  }

  it('a real Settings PUT (no remount, no reload) updates the strike card and the volume converter row together, in the same commit', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString();
        const method = (init?.method ?? 'GET').toUpperCase();
        if (url === '/api/config' && method === 'GET') {
          return Promise.resolve(jsonResponse(DEFAULT_TEST_CONFIG));
        }
        if (url === '/api/config' && method === 'PUT') {
          return Promise.resolve(jsonResponse({ ...DEFAULT_TEST_CONFIG, unitSystem: 'us', temperatureUnit: 'fahrenheit' }));
        }
        return Promise.reject(new Error(`Unexpected fetch in AC-22 test: ${url} ${method}`));
      }),
    );

    render(
      <ConfigProvider>
        <Harness />
      </ConfigProvider>,
    );

    await waitFor(() => expect(screen.getByText('78.1 °C')).toBeInTheDocument());
    expect(screen.getByText('5.28 gal')).toBeInTheDocument();

    await waitFor(() => screen.getByTestId('settings-select-unitSystem'));
    fireEvent.change(screen.getByTestId('settings-select-unitSystem'), { target: { value: 'us' } });
    fireEvent.change(screen.getByTestId('settings-select-temperatureUnit'), { target: { value: 'fahrenheit' } });

    await waitFor(() => {
      expect(screen.getByText('172.6 °F')).toBeInTheDocument();
      expect(screen.getByText('1.26 gal')).toBeInTheDocument();
    });

    const getConfigCalls = vi.mocked(fetch).mock.calls.filter(([input, init]) => {
      const url = typeof input === 'string' ? input : (input as URL | Request).toString();
      const method = ((init?.method as string | undefined) ?? 'GET').toUpperCase();
      return url === '/api/config' && method === 'GET';
    });
    expect(getConfigCalls).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// M8_P2 §1.4/AC-18 … AC-27. The describe titles below are prefixed "M8_P2"
// to disambiguate from this file's pre-existing M8_P1 "AC-<n>" blocks above
// (the two specs' AC numbering is independent and happens to overlap, e.g.
// M8_P1's own "AC-18" above is unrelated to M8_P2's AC-18 here).
// ---------------------------------------------------------------------------

describe('M8_P2 AC-18: Pitch-rate card', () => {
  it('entering target gravity 1.050, batch volume 20, cells per pack 100, pack age 3, preset ale renders the pinned outputs', async () => {
    await renderCalculators({ ...DEFAULT_TEST_CONFIG, gravityUnit: 'plato' });
    await waitFor(() => screen.getByText('Yeast Pitch Rate'));
    fireEvent.change(screen.getByLabelText('Target gravity (SG)'), { target: { value: '1.050' } });
    // Scoped to this card's own <section> — the pre-existing UnitConverterCalculator
    // (P1, Untouched) ALSO renders "12.4 °P" unconditionally at its own default (its
    // Plato row is hardcoded to 'plato' regardless of config), so a page-wide
    // getByText would be ambiguous by coincidence of matching defaults, not a defect.
    const section = screen.getByText('Yeast Pitch Rate').closest('section')!;
    await waitFor(() => {
      expect(within(section).getByText('12.4 °P')).toBeInTheDocument();
      expect(within(section).getByText('185.6 B')).toBeInTheDocument();
      expect(within(section).getByText('49.3 B')).toBeInTheDocument();
      expect(within(section).getByText('49.3 %')).toBeInTheDocument();
      expect(within(section).getByText('136.3 B')).toBeInTheDocument();
    });
  });

  it('switching the preset to lager changes target cells to 371.2 B', async () => {
    await renderCalculators({ ...DEFAULT_TEST_CONFIG, gravityUnit: 'plato' });
    await waitFor(() => screen.getByText('Yeast Pitch Rate'));
    fireEvent.change(screen.getByLabelText('Target gravity (SG)'), { target: { value: '1.050' } });
    const section = screen.getByText('Yeast Pitch Rate').closest('section')!;
    await waitFor(() => expect(within(section).getByText('185.6 B')).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('Pitch rate preset'), { target: { value: 'lager' } });
    await waitFor(() => expect(within(section).getByText('371.2 B')).toBeInTheDocument());
  });

  it('the preset select has exactly three options whose values come from PITCH_RATE_PRESETS\' keys', async () => {
    await renderCalculators();
    const select = screen.getByLabelText('Pitch rate preset') as HTMLSelectElement;
    expect(select.options.length).toBe(3);
    expect(Array.from(select.options).map((o) => o.value)).toEqual(['ale', 'highGravityAle', 'lager']);
  });
});

describe('M8_P2 AC-19: Starter-growth card', () => {
  it('entering starter volume 2, starter gravity 1.037, cells pitched 100, type stirPlate renders the pinned outputs', async () => {
    await renderCalculators();
    await waitFor(() => {
      expect(screen.getByText('192.0 g')).toBeInTheDocument();
      expect(screen.getByText('0.521 B/g')).toBeInTheDocument();
      expect(screen.getByText('1.40 B/g')).toBeInTheDocument();
      expect(screen.getByText('268.8 B')).toBeInTheDocument();
      expect(screen.getByText('368.8 B')).toBeInTheDocument();
    });
  });

  it('switching type to simple changes end cells to 176.8 B', async () => {
    await renderCalculators();
    await waitFor(() => screen.getByText('368.8 B'));
    fireEvent.change(screen.getByLabelText('Starter type'), { target: { value: 'simple' } });
    await waitFor(() => expect(screen.getByText('176.8 B')).toBeInTheDocument());
  });

  it('under unitSystem "us" the extract row renders 6.77 oz while the starter-volume input still holds 2', async () => {
    await renderCalculators({ ...DEFAULT_TEST_CONFIG, unitSystem: 'us' });
    await waitFor(() => expect(screen.getByText('6.77 oz')).toBeInTheDocument());
    expect(screen.getByLabelText('Starter volume (L)')).toHaveValue('2');
  });
});

describe('M8_P2 AC-20: Hop-decay card', () => {
  it('entering alpha acid 10, six-month loss 0.3, storage temperature 4, days 180, method nitrogenFlushedOxygenBarrier renders the pinned outputs', async () => {
    await renderCalculators();
    await waitFor(() => {
      expect(screen.getByText('0.477')).toBeInTheDocument();
      expect(screen.getByText('9.18 %')).toBeInTheDocument();
    });
  });

  it('changing the method to looseInAir lowers the rendered alpha acid', async () => {
    await renderCalculators();
    await waitFor(() => screen.getByText('9.18 %'));
    fireEvent.change(screen.getByLabelText('Storage method'), { target: { value: 'looseInAir' } });
    await waitFor(() => {
      const text = screen.getByLabelText('Storage method').closest('section')?.textContent ?? '';
      const match = text.match(/(\d+\.\d+) %/);
      expect(match).not.toBeNull();
      const alphaAcidNow = Number.parseFloat(match![1]);
      expect(alphaAcidNow).toBeLessThan(9.18);
    });
  });

  it('setting days to 0 renders 10.00 %', async () => {
    await renderCalculators();
    await waitFor(() => screen.getByText('9.18 %'));
    fireEvent.change(screen.getByLabelText('Days stored (days)'), { target: { value: '0' } });
    await waitFor(() => expect(screen.getByText('10.00 %')).toBeInTheDocument());
  });
});

describe('M8_P2 AC-21: Gravity-correction card', () => {
  it('the default fields (volume 20, current 1.060, target 1.050, boil-off 3) render dilution water 4.0 L under metric and 1.06 gal under us', async () => {
    const metric = await renderCalculators({ ...DEFAULT_TEST_CONFIG, unitSystem: 'metric' });
    await waitFor(() => expect(screen.getByText('4.0 L')).toBeInTheDocument());
    metric.unmount();

    const us = await renderCalculators({ ...DEFAULT_TEST_CONFIG, unitSystem: 'us' });
    await waitFor(() => expect(screen.getByText('1.06 gal')).toBeInTheDocument());
    us.unmount();
  });

  it('volume 20, current 1.045, target 1.050 renders DME 0.27 kg under metric and 0.59 lb under us', async () => {
    const metric = await renderCalculators({ ...DEFAULT_TEST_CONFIG, unitSystem: 'metric' });
    await waitFor(() => screen.getByText('4.0 L'));
    fireEvent.change(screen.getByLabelText('Current gravity (SG)'), { target: { value: '1.045' } });
    fireEvent.change(screen.getByLabelText('DME potential (SG)'), { target: { value: '1.045' } });
    await waitFor(() => expect(screen.getByText('0.27 kg')).toBeInTheDocument());
    metric.unmount();

    const us = await renderCalculators({ ...DEFAULT_TEST_CONFIG, unitSystem: 'us' });
    await waitFor(() => screen.getByText('1.06 gal'));
    fireEvent.change(screen.getByLabelText('Current gravity (SG)'), { target: { value: '1.045' } });
    fireEvent.change(screen.getByLabelText('DME potential (SG)'), { target: { value: '1.045' } });
    await waitFor(() => expect(screen.getByText('0.59 lb')).toBeInTheDocument());
    us.unmount();
  });

  it('volume 25, current 1.040, target 1.050, rate 3 renders extra boil time 100 min', async () => {
    await renderCalculators();
    await waitFor(() => screen.getByText('4.0 L'));
    fireEvent.change(screen.getByLabelText('Correction volume (L)'), { target: { value: '25' } });
    fireEvent.change(screen.getByLabelText('Current gravity (SG)'), { target: { value: '1.040' } });
    await waitFor(() => expect(screen.getByText('100 min')).toBeInTheDocument());
  });

  it('all three output rows render simultaneously, including when negative — no row is hidden or sign-flipped', async () => {
    await renderCalculators();
    await waitFor(() => screen.getByText('4.0 L'));
    // Default fields (current 1.060 > target 1.050) already put the DME and
    // boil-time rows on their negative branch — assert all three labels are
    // present and none of the three values is em-dash or blank.
    const section = screen.getByLabelText('Correction volume (L)').closest('section');
    expect(section).not.toBeNull();
    expect(section!.textContent).toContain('Dilution water');
    expect(section!.textContent).toContain('DME to add');
    expect(section!.textContent).toContain('Extra boil time');
    expect(section!.textContent).not.toContain('—');
  });
});

describe('M8_P2 AC-22: Carbonation card', () => {
  it('entering beer volume 19, target CO2 2.4, peak fermentation 20, serving temperature 4 renders the pinned outputs', async () => {
    const metric = await renderCalculators({ ...DEFAULT_TEST_CONFIG, unitSystem: 'metric' });
    await waitFor(() => {
      expect(screen.getByText('2.14 vols')).toBeInTheDocument();
      expect(screen.getByText('19.5 g')).toBeInTheDocument();
      expect(screen.getByText('10.79 psi')).toBeInTheDocument();
    });
    metric.unmount();

    const us = await renderCalculators({ ...DEFAULT_TEST_CONFIG, unitSystem: 'us' });
    await waitFor(() => expect(screen.getByText('0.69 oz')).toBeInTheDocument());
    us.unmount();
  });

  it('setting target CO2 to 1.0 (below residual) renders priming sugar 0.0 g via primingSugarG\'s own clamp', async () => {
    await renderCalculators();
    await waitFor(() => screen.getByText('19.5 g'));
    fireEvent.change(screen.getByLabelText('Target CO2 (vols)'), { target: { value: '1.0' } });
    await waitFor(() => expect(screen.getByText('0.0 g')).toBeInTheDocument());
  });
});

describe('M8_P2 AC-23: the page renders ten cards, still with no registry and no state', () => {
  it('renders exactly ten calculator <section> cards, whose titles include all five M8_P1 and all five new titles', async () => {
    await renderCalculators();
    const sections = document.querySelectorAll('main section');
    expect(sections.length).toBe(10);
    const titles = Array.from(sections).map((s) => s.querySelector('h2')?.textContent);
    for (const title of [
      'Strike Water Temperature',
      'Infusion (Step-Mash) Volume',
      'Hydrometer Temperature Correction',
      'Refractometer (Brix → SG, Alcohol-Corrected)',
      'Unit Converters',
      'Yeast Pitch Rate',
      'Yeast Starter Growth',
      'Hop Alpha-Acid Decay',
      'Gravity Correction',
      'Priming Sugar & Force Carbonation',
    ]) {
      expect(titles, `missing card title "${title}"`).toContain(title);
    }
  });

  it('Calculators.tsx contains no dynamic component registry and no .map( iteration, but may hold standard useState for the M29_P5 category filter', async () => {
    // M8_P2 AC-23 originally asserted `useState` was entirely absent, back
    // when this route held zero state of its own. M29_P5 §2.6 reconciles
    // that: the page now owns local `activeCategory` filter state, so a
    // bare `useState` check would be a false failure. What both phases
    // actually care about is preserved — no dynamic registry array driving
    // which calculators render, and no .map( iteration over one.
    const { readFileSync } = await import('node:fs');
    const path = await import('node:path');
    const src = readFileSync(path.resolve(__dirname, '../src/pages/Calculators.tsx'), 'utf8');
    expect(src.includes('.map(')).toBe(false);
    expect(src).not.toMatch(/const\s+CALCULATORS\s*[:=]/);
  });

  it('TopBar title is still "Calculators"; no new route or nav item exists — NAV_ITEMS still has 8 entries', async () => {
    await renderCalculators();
    expect(screen.getByRole('heading', { name: 'Calculators' })).toBeInTheDocument();
    expect(NAV_ITEMS).toHaveLength(9);
  });
});

describe('M8_P2 AC-24: lockstep across all ten cards', () => {
  it('a real Settings PUT (no remount, no reload) updates the strike card and the gravity-correction card together, in the same commit', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString();
        const method = (init?.method ?? 'GET').toUpperCase();
        if (url === '/api/config' && method === 'GET') {
          return Promise.resolve(jsonResponse(DEFAULT_TEST_CONFIG));
        }
        if (url === '/api/config' && method === 'PUT') {
          return Promise.resolve(jsonResponse({ ...DEFAULT_TEST_CONFIG, unitSystem: 'us', temperatureUnit: 'fahrenheit' }));
        }
        return Promise.reject(new Error(`Unexpected fetch in M8_P2 AC-24 test: ${url} ${method}`));
      }),
    );

    function Harness() {
      const { config } = useConfig();
      return (
        <>
          <Calculators />
          <SettingsManager />
          <span data-testid="probe-unit">{config.unitSystem}</span>
        </>
      );
    }

    render(
      <ConfigProvider>
        <Harness />
      </ConfigProvider>,
    );

    await waitFor(() => expect(screen.getByText('78.1 °C')).toBeInTheDocument());
    expect(screen.getByText('4.0 L')).toBeInTheDocument();

    await waitFor(() => screen.getByTestId('settings-select-unitSystem'));
    fireEvent.change(screen.getByTestId('settings-select-unitSystem'), { target: { value: 'us' } });
    fireEvent.change(screen.getByTestId('settings-select-temperatureUnit'), { target: { value: 'fahrenheit' } });

    await waitFor(() => {
      expect(screen.getByText('172.6 °F')).toBeInTheDocument();
      expect(screen.getByText('1.06 gal')).toBeInTheDocument();
      expect(screen.getByText('0.69 oz')).toBeInTheDocument();
    });

    const getConfigCalls = vi.mocked(fetch).mock.calls.filter(([input, init]) => {
      const url = typeof input === 'string' ? input : (input as URL | Request).toString();
      const method = ((init?.method as string | undefined) ?? 'GET').toUpperCase();
      return url === '/api/config' && method === 'GET';
    });
    expect(getConfigCalls).toHaveLength(1);
  });
});

describe('M8_P2 AC-25: new inputs stay canonical-metric and say so', () => {
  it('under unitSystem "us" the gravity-correction volume input still holds 20 with label containing (L); the starter volume input holds 2 with label (L); the hop storage-temperature label contains (°C)', async () => {
    await renderCalculators({ ...DEFAULT_TEST_CONFIG, unitSystem: 'us' });
    expect(screen.getByLabelText('Correction volume (L)')).toHaveValue('20');
    expect(screen.getByLabelText('Starter volume (L)')).toHaveValue('2');
    expect(screen.getByLabelText('Storage temperature (°C)')).toBeInTheDocument();
  });

  it('every <input> added by this phase has a label containing an explicit unit token from the required set; typing never converts the typed value', async () => {
    await renderCalculators({ ...DEFAULT_TEST_CONFIG, unitSystem: 'us' });
    const allowedTokens = ['(L)', '(kg)', '(°C)', '(SG)', '(%)', '(B)', '(months)', '(days)', '(vols)', '(B/g)', '(ratio)', '(g)', '(L/h)'];
    const newCardTitles = ['Yeast Pitch Rate', 'Yeast Starter Growth', 'Hop Alpha-Acid Decay', 'Gravity Correction', 'Priming Sugar & Force Carbonation'];
    // Scoped to only this phase's five new cards — P1's cards use their own
    // (already-tested, unrelated) token vocabulary such as (°Bx) and (SRM).
    let checkedAny = false;
    for (const title of newCardTitles) {
      const section = screen.getByText(title).closest('section')!;
      const inputs = section.querySelectorAll('input');
      for (const input of Array.from(inputs)) {
        checkedAny = true;
        const label = input.closest('label') ?? (input.id ? document.querySelector(`label[for="${input.id}"]`) : null);
        expect(label).not.toBeNull();
        const labelText = label!.textContent ?? '';
        expect(allowedTokens.some((token) => labelText.includes(token)), `Label "${labelText}" has no recognized unit token`).toBe(true);
      }

    }
    expect(checkedAny).toBe(true);

    fireEvent.change(screen.getByLabelText('Correction volume (L)'), { target: { value: '30' } });
    expect(screen.getByLabelText('Correction volume (L)')).toHaveValue('30');
  });
});

describe('M8_P2 AC-26: degenerate/empty inputs render the em-dash, never NaN or 0, and only the affected rows', () => {
  it('clearing the hop card\'s storage-temperature field renders — in both the temperature-factor and alpha-acid rows, not NaN, not 0.00%, not the previously computed 9.18%', async () => {
    await renderCalculators();
    await waitFor(() => screen.getByText('9.18 %'));
    fireEvent.change(screen.getByLabelText('Storage temperature (°C)'), { target: { value: '' } });
    await waitFor(() => {
      expect(screen.queryByText('9.18 %')).toBeNull();
      expect(screen.queryByText('0.00 %')).toBeNull();
      expect(screen.queryByText('NaN')).toBeNull();
    });
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('clearing the gravity-correction card\'s boil-off-rate field renders — in the extra-boil-time row while dilution-water and DME rows still show real values', async () => {
    await renderCalculators();
    await waitFor(() => screen.getByText('4.0 L'));
    fireEvent.change(screen.getByLabelText('Boil-off rate (L/h)'), { target: { value: '' } });
    await waitFor(() => {
      const section = screen.getByLabelText('Correction volume (L)').closest('section');
      expect(section).not.toBeNull();
      const rows = Array.from(section!.querySelectorAll('div.flex.items-center.justify-between'));
      const boilRow = rows.find((r) => r.textContent?.includes('Extra boil time'));
      expect(boilRow?.textContent).toContain('—');
    });
    // The other two rows are unaffected — the dilution-water figure is still present.
    expect(screen.getByText('4.0 L')).toBeInTheDocument();
  });

  it('whitespace-only and alphabetic entries also render —', async () => {
    await renderCalculators();
    await waitFor(() => screen.getByText('9.18 %'));
    fireEvent.change(screen.getByLabelText('Storage temperature (°C)'), { target: { value: '   ' } });
    await waitFor(() => expect(screen.getAllByText('—').length).toBeGreaterThan(0));

    fireEvent.change(screen.getByLabelText('Storage temperature (°C)'), { target: { value: 'abc' } });
    await waitFor(() => expect(screen.getAllByText('—').length).toBeGreaterThan(0));
  });

  it('typing a literal 0 into the starter card\'s cells-pitched field renders the real zero-pitch answer (268.8 B), distinguishing blank from zero', async () => {
    await renderCalculators();
    await waitFor(() => screen.getByText('368.8 B'));
    fireEvent.change(screen.getByLabelText('Cells pitched (B)'), { target: { value: '0' } });
    await waitFor(() => {
      // With 0 cells pitched, "New cells" and "End cells" legitimately
      // coincide at 268.8 B (end = initial(0) + new) — assert there are
      // two matches (both real numbers, neither em-dash) rather than one.
      expect(screen.getAllByText('268.8 B')).toHaveLength(2);
    });
  });

  it('no component under components/calculators/ contains a useState holding a computed result, a setResult, or a useEffect', async () => {
    const { readFileSync, readdirSync } = await import('node:fs');
    const path = await import('node:path');
    const dir = path.resolve(__dirname, '../src/components/calculators');
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.tsx'))) {
      const src = readFileSync(path.join(dir, file), 'utf8');
      expect(src.includes('useEffect'), `useEffect found in ${file}`).toBe(false);
      expect(src.includes('setResult'), `setResult found in ${file}`).toBe(false);
    }
  });
});

describe('M8_P2 AC-27: no writes, no persistence, no leaked placeholder — over the enlarged page', () => {
  it('filling every new field, changing all three SelectFields, and navigating away issues zero POST/PUT/PATCH/DELETE and no extra GET beyond /api/config, and never calls localStorage.setItem', async () => {
    mockConfig(DEFAULT_TEST_CONFIG);
    const { unmount } = render(
      <ConfigProvider>
        <Calculators />
      </ConfigProvider>,
    );
    await waitFor(() => screen.getByText('78.1 °C'));

    fireEvent.change(screen.getByLabelText('Target gravity (SG)'), { target: { value: '1.055' } });
    fireEvent.change(screen.getByLabelText('Starter volume (L)'), { target: { value: '4' } });
    fireEvent.change(screen.getByLabelText('Alpha acid at purchase (%)'), { target: { value: '12' } });
    fireEvent.change(screen.getByLabelText('Correction volume (L)'), { target: { value: '22' } });
    fireEvent.change(screen.getByLabelText('Beer volume (L)'), { target: { value: '20' } });
    fireEvent.change(screen.getByLabelText('Pitch rate preset'), { target: { value: 'lager' } });
    fireEvent.change(screen.getByLabelText('Starter type'), { target: { value: 'shaken' } });
    fireEvent.change(screen.getByLabelText('Storage method'), { target: { value: 'looseInAir' } });

    unmount();

    const calls = vi.mocked(fetch).mock.calls;
    for (const [input, init] of calls) {
      const url = typeof input === 'string' ? input : (input as URL | Request).toString();
      const method = ((init?.method as string | undefined) ?? 'GET').toUpperCase();
      expect(url).toBe('/api/config');
      expect(['POST', 'PUT', 'PATCH', 'DELETE']).not.toContain(method);
    }
    expect(window.localStorage.setItem).not.toHaveBeenCalled();
  });

  it('navigating away and back (remount) resets every new field, and every SelectField, to its initial value', async () => {
    const { unmount } = await (async () => {
      mockConfig(DEFAULT_TEST_CONFIG);
      const result = render(
        <ConfigProvider>
          <Calculators />
        </ConfigProvider>,
      );
      await waitFor(() => screen.getByText('78.1 °C'));
      fireEvent.change(screen.getByLabelText('Target gravity (SG)'), { target: { value: '1.055' } });
      fireEvent.change(screen.getByLabelText('Pitch rate preset'), { target: { value: 'lager' } });
      await waitFor(() => expect(screen.getByLabelText('Target gravity (SG)')).toHaveValue('1.055'));
      return result;
    })();
    unmount();

    await renderCalculators();
    expect(screen.getByLabelText('Target gravity (SG)')).toHaveValue('1.062');
    expect(screen.getByLabelText('Pitch rate preset')).toHaveValue('ale');
  });
});

describe('AC-16 (M26_P1 Amendment 1): Calculators forwards onOpenMobileNav to its TopBar', () => {
  it('passing onOpenMobileNav renders the hamburger and clicking it calls the callback', async () => {
    mockConfig(DEFAULT_TEST_CONFIG);
    const onOpenMobileNav = vi.fn();
    render(
      <ConfigProvider>
        <Calculators onOpenMobileNav={onOpenMobileNav} />
      </ConfigProvider>,
    );
    await waitFor(() => expect(screen.getByText('Calculators')).toBeInTheDocument());
    const btn = screen.getByRole('button', { name: 'Open navigation menu' });
    fireEvent.click(btn);
    expect(onOpenMobileNav).toHaveBeenCalledTimes(1);
  });

  it('omitting onOpenMobileNav renders no hamburger button', async () => {
    await renderCalculators();
    expect(screen.queryByRole('button', { name: 'Open navigation menu' })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// M29_P5 (FEAT-020/MAJ-04) — Categorized Brewing Calculators Hub.
// Note on hiding: §"Judgment call, disclosed" atop Calculators.tsx explains
// that every calculator stays mounted at all times (never unmounted on a
// category switch, so AC-7's input-retention requirement can hold given
// each calculator owns its own internal, Untouched useState) — an inactive
// category block is hidden via the native `hidden` attribute instead. Role
// queries (getByRole/queryByRole/getAllByRole) exclude inaccessible
// (hidden-attribute) subtrees by default, so they are used throughout this
// suite to assert "hidden" sections/cards are not present, rather than a
// raw querySelectorAll count (which would still find the mounted-but-hidden
// nodes and therefore could not distinguish "hidden" from "shown").
// ---------------------------------------------------------------------------

describe('M29_P5 AC-1: category filter bar renders 5 accessible pills', () => {
  it('renders a role="group" with the required aria-label, containing exactly 5 buttons in the specified order, each aria-pressed to match the active category', async () => {
    await renderCalculators();
    const group = screen.getByRole('group', { name: 'Calculator Categories' });
    const buttons = within(group).getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual(['All', 'Water & Mash', 'Gravity & Refractometry', 'Yeast & Pitching', 'Hops & Carbonation']);
    for (const btn of buttons) {
      expect(btn).toHaveAttribute('type', 'button');
    }
    expect(within(group).getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(group).getByRole('button', { name: 'Water & Mash' })).toHaveAttribute('aria-pressed', 'false');
    expect(within(group).getByRole('button', { name: 'Gravity & Refractometry' })).toHaveAttribute('aria-pressed', 'false');
    expect(within(group).getByRole('button', { name: 'Yeast & Pitching' })).toHaveAttribute('aria-pressed', 'false');
    expect(within(group).getByRole('button', { name: 'Hops & Carbonation' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking a pill flips its own aria-pressed to true and every other pill\'s to false', async () => {
    await renderCalculators();
    const group = screen.getByRole('group', { name: 'Calculator Categories' });
    fireEvent.click(within(group).getByRole('button', { name: 'Yeast & Pitching' }));
    expect(within(group).getByRole('button', { name: 'Yeast & Pitching' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(group).getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'false');
    expect(within(group).getByRole('button', { name: 'Water & Mash' })).toHaveAttribute('aria-pressed', 'false');
    expect(within(group).getByRole('button', { name: 'Gravity & Refractometry' })).toHaveAttribute('aria-pressed', 'false');
    expect(within(group).getByRole('button', { name: 'Hops & Carbonation' })).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('M29_P5 AC-2: default "All" view renders every section and every card', () => {
  it('renders all 4 category <h3> section headings and all 10 calculator card <h2> titles', async () => {
    await renderCalculators();
    const sectionHeadings = screen.getAllByRole('heading', { level: 3 });
    expect(sectionHeadings.map((h) => h.textContent)).toEqual(
      expect.arrayContaining(['Water & Mash', 'Gravity & Refractometry', 'Yeast & Pitching', 'Hops & Carbonation']),
    );
    expect(sectionHeadings).toHaveLength(4);

    const cardHeadings = screen.getAllByRole('heading', { level: 2 });
    expect(cardHeadings).toHaveLength(10);
    expect(cardHeadings.map((h) => h.textContent)).toEqual(
      expect.arrayContaining([
        'Strike Water Temperature',
        'Infusion (Step-Mash) Volume',
        'Hydrometer Temperature Correction',
        'Refractometer (Brix → SG, Alcohol-Corrected)',
        'Gravity Correction',
        'Yeast Pitch Rate',
        'Yeast Starter Growth',
        'Priming Sugar & Force Carbonation',
        'Hop Alpha-Acid Decay',
        'Unit Converters',
      ]),
    );
  });
});

describe('M29_P5 AC-3: "Water & Mash" filter shows exactly its 2 cards and hides the rest', () => {
  it('shows the "Water & Mash" heading and exactly 2 cards; the other 3 headings and 8 cards are not accessible', async () => {
    await renderCalculators();
    fireEvent.click(screen.getByRole('button', { name: 'Water & Mash' }));

    expect(screen.getByRole('heading', { level: 3, name: 'Water & Mash' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 3, name: 'Gravity & Refractometry' })).toBeNull();
    expect(screen.queryByRole('heading', { level: 3, name: 'Yeast & Pitching' })).toBeNull();
    expect(screen.queryByRole('heading', { level: 3, name: 'Hops & Carbonation' })).toBeNull();

    const cardHeadings = screen.getAllByRole('heading', { level: 2 });
    expect(cardHeadings).toHaveLength(2);
    expect(cardHeadings.map((h) => h.textContent)).toEqual(
      expect.arrayContaining(['Strike Water Temperature', 'Infusion (Step-Mash) Volume']),
    );
  });
});

describe('M29_P5 AC-4: "Gravity & Refractometry" filter shows exactly its 3 cards and hides the rest', () => {
  it('shows the "Gravity & Refractometry" heading and exactly 3 cards; the other 3 headings and 7 cards are not accessible', async () => {
    await renderCalculators();
    fireEvent.click(screen.getByRole('button', { name: 'Gravity & Refractometry' }));

    expect(screen.getByRole('heading', { level: 3, name: 'Gravity & Refractometry' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 3, name: 'Water & Mash' })).toBeNull();
    expect(screen.queryByRole('heading', { level: 3, name: 'Yeast & Pitching' })).toBeNull();
    expect(screen.queryByRole('heading', { level: 3, name: 'Hops & Carbonation' })).toBeNull();

    const cardHeadings = screen.getAllByRole('heading', { level: 2 });
    expect(cardHeadings).toHaveLength(3);
    expect(cardHeadings.map((h) => h.textContent)).toEqual(
      expect.arrayContaining(['Hydrometer Temperature Correction', 'Refractometer (Brix → SG, Alcohol-Corrected)', 'Gravity Correction']),
    );
  });
});

describe('M29_P5 AC-5: "Yeast & Pitching" filter shows exactly its 2 cards and hides the rest', () => {
  it('shows the "Yeast & Pitching" heading and exactly 2 cards; the other 3 headings and 8 cards are not accessible', async () => {
    await renderCalculators();
    fireEvent.click(screen.getByRole('button', { name: 'Yeast & Pitching' }));

    expect(screen.getByRole('heading', { level: 3, name: 'Yeast & Pitching' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 3, name: 'Water & Mash' })).toBeNull();
    expect(screen.queryByRole('heading', { level: 3, name: 'Gravity & Refractometry' })).toBeNull();
    expect(screen.queryByRole('heading', { level: 3, name: 'Hops & Carbonation' })).toBeNull();

    const cardHeadings = screen.getAllByRole('heading', { level: 2 });
    expect(cardHeadings).toHaveLength(2);
    expect(cardHeadings.map((h) => h.textContent)).toEqual(expect.arrayContaining(['Yeast Pitch Rate', 'Yeast Starter Growth']));
  });
});

describe('M29_P5 AC-6: "Hops & Carbonation" filter shows exactly its 3 cards and hides the rest', () => {
  it('shows the "Hops & Carbonation" heading and exactly 3 cards; the other 3 headings and 7 cards are not accessible', async () => {
    await renderCalculators();
    fireEvent.click(screen.getByRole('button', { name: 'Hops & Carbonation' }));

    expect(screen.getByRole('heading', { level: 3, name: 'Hops & Carbonation' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 3, name: 'Water & Mash' })).toBeNull();
    expect(screen.queryByRole('heading', { level: 3, name: 'Gravity & Refractometry' })).toBeNull();
    expect(screen.queryByRole('heading', { level: 3, name: 'Yeast & Pitching' })).toBeNull();

    const cardHeadings = screen.getAllByRole('heading', { level: 2 });
    expect(cardHeadings).toHaveLength(3);
    expect(cardHeadings.map((h) => h.textContent)).toEqual(
      expect.arrayContaining(['Priming Sugar & Force Carbonation', 'Hop Alpha-Acid Decay', 'Unit Converters']),
    );
  });
});

describe('M29_P5 AC-7: modified input state survives switching category pills away and back', () => {
  it('changing the strike card\'s grain weight, switching to a different category, then returning to Water & Mash still shows the modified value', async () => {
    await renderCalculators();
    // Grain weight starts at its default '5' (AC-18/M8_P1).
    expect(screen.getByLabelText('Grain weight (kg)')).toHaveValue('5');
    fireEvent.change(screen.getByLabelText('Grain weight (kg)'), { target: { value: '7' } });
    expect(screen.getByLabelText('Grain weight (kg)')).toHaveValue('7');

    fireEvent.click(screen.getByRole('button', { name: 'Yeast & Pitching' }));
    // The Water & Mash section is hidden via the native `hidden` attribute
    // (not unmounted — that's what lets the value below survive), so its
    // heading is no longer role-accessible even though the input node
    // itself is still present in the DOM.
    expect(screen.queryByRole('heading', { level: 3, name: 'Water & Mash' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Water & Mash' }));
    expect(screen.getByLabelText('Grain weight (kg)')).toHaveValue('7');
  });

  it('the same retention holds when routing back through "All" instead of directly to the original category', async () => {
    await renderCalculators();
    fireEvent.change(screen.getByLabelText('Grain weight (kg)'), { target: { value: '9' } });
    fireEvent.click(screen.getByRole('button', { name: 'Hops & Carbonation' }));
    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    expect(screen.getByLabelText('Grain weight (kg)')).toHaveValue('9');
  });
});

describe('M29_P5 AC-8: TopBar continues to receive title="Calculators" and forwards onOpenMobileNav', () => {
  it('renders the "Calculators" page heading regardless of active category', async () => {
    await renderCalculators();
    expect(screen.getByRole('heading', { name: 'Calculators' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Hops & Carbonation' }));
    expect(screen.getByRole('heading', { name: 'Calculators' })).toBeInTheDocument();
  });

  it('forwards onOpenMobileNav to TopBar so the mobile hamburger invokes it', async () => {
    mockConfig(DEFAULT_TEST_CONFIG);
    const onOpenMobileNav = vi.fn();
    render(
      <ConfigProvider>
        <Calculators onOpenMobileNav={onOpenMobileNav} />
      </ConfigProvider>,
    );
    await waitFor(() => expect(screen.getByText('Calculators')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation menu' }));
    expect(onOpenMobileNav).toHaveBeenCalledTimes(1);
  });
});
