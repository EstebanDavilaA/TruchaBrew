import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import type { UserConfig, DatabaseBackup } from '@truchabrew/shared-types';
import { SettingsManager } from '../src/components/SettingsManager';
import { ConfigProvider, useConfig } from '../src/context/ConfigContext';
import { CARD_CLASS, SETTINGS_ROW_CLASS, LOADING_STATE_CLASS } from '../src/components/designSystem';

// SettingsManager (via ConfigContext, M7_P1 amendment §1.4) calls the global
// `fetch` directly — deliberately not routed through api/client.ts, which is
// not on the M7_P1 spec §1.3/§1.4 Modified-files table. Mocked here at the
// fetch level rather than via vi.mock('../src/api/client', ...) like every
// other manager test in this directory, since there is no client.ts
// function to mock.

const DEFAULT_CONFIG: UserConfig = {
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

// M7_P1 amendment §1.4 — SettingsManager now reads/writes the shared
// ConfigContext (AC-15), so every render is wrapped in a real ConfigProvider
// rather than the component managing its own load state.
function renderSettings() {
  return render(
    <ConfigProvider>
      <SettingsManager />
    </ConfigProvider>,
  );
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AC-9: SettingsManager renders select controls for all five preferences', () => {
  it('renders one select per preference once loaded', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(DEFAULT_CONFIG));
    renderSettings();

    await waitFor(() => expect(screen.getByTestId('settings-select-unitSystem')).toBeInTheDocument());
    expect(screen.getByTestId('settings-select-gravityUnit')).toBeInTheDocument();
    expect(screen.getByTestId('settings-select-temperatureUnit')).toBeInTheDocument();
    expect(screen.getByTestId('settings-select-ibuFormula')).toBeInTheDocument();
    expect(screen.getByTestId('settings-select-abvFormula')).toBeInTheDocument();

    expect(fetch).toHaveBeenCalledWith('/api/config', expect.anything());
  });

  it('each select reflects the loaded config value', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ ...DEFAULT_CONFIG, unitSystem: 'us', gravityUnit: 'plato', ibuFormula: 'rager' }),
    );
    renderSettings();

    await waitFor(() => expect(screen.getByTestId('settings-select-unitSystem')).toBeInTheDocument());
    expect((screen.getByTestId('settings-select-unitSystem') as HTMLSelectElement).value).toBe('us');
    expect((screen.getByTestId('settings-select-gravityUnit') as HTMLSelectElement).value).toBe('plato');
    expect((screen.getByTestId('settings-select-ibuFormula') as HTMLSelectElement).value).toBe('rager');
  });

  it('shows a load error with a retry control when GET /api/config fails', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ error: { code: 'INTERNAL', message: 'boom' } }, 500),
    );
    renderSettings();

    await waitFor(() => expect(screen.getByText(/boom/)).toBeInTheDocument());
    expect(screen.getByText(/Couldn't load your settings/)).toBeInTheDocument();
  });
});

describe('AC-10: selecting a new setting triggers PUT /api/config and updates state', () => {
  it('changing the temperature unit select PUTs the new value and reflects the server response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(DEFAULT_CONFIG));
    renderSettings();

    await waitFor(() => expect(screen.getByTestId('settings-select-temperatureUnit')).toBeInTheDocument());

    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ ...DEFAULT_CONFIG, temperatureUnit: 'fahrenheit' }),
    );

    fireEvent.change(screen.getByTestId('settings-select-temperatureUnit'), { target: { value: 'fahrenheit' } });

    await waitFor(() => {
      const call = vi.mocked(fetch).mock.calls.find(([url]) => url === '/api/config' && vi.mocked(fetch).mock.calls.length > 1);
      expect(call).toBeDefined();
    });

    const putCall = vi.mocked(fetch).mock.calls[1];
    expect(putCall[0]).toBe('/api/config');
    const init = putCall[1] as RequestInit;
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body as string)).toEqual({ temperatureUnit: 'fahrenheit' });

    await waitFor(() =>
      expect((screen.getByTestId('settings-select-temperatureUnit') as HTMLSelectElement).value).toBe('fahrenheit'),
    );
  });

  it('reverts the optimistic update and shows an error if the PUT fails', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(DEFAULT_CONFIG));
    renderSettings();

    await waitFor(() => expect(screen.getByTestId('settings-select-ibuFormula')).toBeInTheDocument());

    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ error: { code: 'VALIDATION_FAILED', message: 'bad enum value' } }, 400),
    );

    fireEvent.change(screen.getByTestId('settings-select-ibuFormula'), { target: { value: 'rager' } });

    await waitFor(() => expect(screen.getByText(/bad enum value/)).toBeInTheDocument());
    // Reverted back to the last known-good value.
    expect((screen.getByTestId('settings-select-ibuFormula') as HTMLSelectElement).value).toBe('tinseth');
  });

  it('changing the IBU strategy select to garetz still triggers a PUT (structural, not a numeric claim)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(DEFAULT_CONFIG));
    renderSettings();

    await waitFor(() => expect(screen.getByTestId('settings-select-ibuFormula')).toBeInTheDocument());

    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ ...DEFAULT_CONFIG, ibuFormula: 'garetz' }));
    fireEvent.change(screen.getByTestId('settings-select-ibuFormula'), { target: { value: 'garetz' } });

    await waitFor(() =>
      expect((screen.getByTestId('settings-select-ibuFormula') as HTMLSelectElement).value).toBe('garetz'),
    );
  });
});

// ---------------------------------------------------------------------------
// M7_P1 amendment (2026-08-13) — AC-15 (shared context), AC-16 (fallback
// never leaks), AC-27 (Garetz label + caveat).
// ---------------------------------------------------------------------------

describe('AC-15: SettingsManager reads/writes the shared ConfigContext', () => {
  it('a sibling probe under the same ConfigProvider observes the change without remount or refetch', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(DEFAULT_CONFIG));

    function Probe() {
      const { config } = useConfig();
      return <div data-testid="probe-gravity-unit">{config.gravityUnit}</div>;
    }

    render(
      <ConfigProvider>
        <SettingsManager />
        <Probe />
      </ConfigProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('settings-select-gravityUnit')).toBeInTheDocument());
    expect(screen.getByTestId('probe-gravity-unit').textContent).toBe('sg');

    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ ...DEFAULT_CONFIG, gravityUnit: 'plato' }));
    fireEvent.change(screen.getByTestId('settings-select-gravityUnit'), { target: { value: 'plato' } });

    await waitFor(() => expect(screen.getByTestId('probe-gravity-unit').textContent).toBe('plato'));
  });
});

describe('AC-16: fallback never leaks into state or into Settings', () => {
  it('(b) with GET rejecting, renders the error panel and NOT the five selects, and no PUT is ever issued', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ error: { code: 'INTERNAL', message: 'down' } }, 500));
    renderSettings();

    await waitFor(() => expect(screen.getByText(/down/)).toBeInTheDocument());
    expect(screen.queryByTestId('settings-select-unitSystem')).not.toBeInTheDocument();
    expect(screen.queryByTestId('settings-select-gravityUnit')).not.toBeInTheDocument();

    const putCalls = vi.mocked(fetch).mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === 'PUT');
    expect(putCalls).toHaveLength(0);
  });

  it('(b) retry re-issues the GET and, on success, renders the five selects', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ error: { code: 'INTERNAL', message: 'down' } }, 500));
    renderSettings();

    await waitFor(() => expect(screen.getByText(/Couldn't load your settings/)).toBeInTheDocument());

    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(DEFAULT_CONFIG));
    fireEvent.click(screen.getByText(/Retry/));

    await waitFor(() => expect(screen.getByTestId('settings-select-unitSystem')).toBeInTheDocument());
  });
});

describe('AC-27: Garetz is labeled as approximate at the point of selection', () => {
  it('the third IBU-strategy option reads exactly "Garetz (approximate)"', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(DEFAULT_CONFIG));
    renderSettings();

    await waitFor(() => expect(screen.getByTestId('settings-select-ibuFormula')).toBeInTheDocument());
    const select = screen.getByTestId('settings-select-ibuFormula') as HTMLSelectElement;
    const garetzOption = Array.from(select.options).find((o) => o.value === 'garetz');
    expect(garetzOption?.textContent).toBe('Garetz (approximate)');
    expect(Array.from(select.options).some((o) => o.textContent === 'Garetz')).toBe(false);
  });

  it('a visible caveat note renders only when garetz is the selected value, and the persisted enum value is unaffected', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(DEFAULT_CONFIG));
    renderSettings();

    await waitFor(() => expect(screen.getByTestId('settings-select-ibuFormula')).toBeInTheDocument());
    expect(screen.queryByTestId('garetz-approximation-note')).not.toBeInTheDocument();

    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ ...DEFAULT_CONFIG, ibuFormula: 'garetz' }));
    fireEvent.change(screen.getByTestId('settings-select-ibuFormula'), { target: { value: 'garetz' } });

    await waitFor(() => expect(screen.getByTestId('garetz-approximation-note')).toBeInTheDocument());

    const putCall = vi.mocked(fetch).mock.calls[1];
    expect(JSON.parse((putCall[1] as RequestInit).body as string)).toEqual({ ibuFormula: 'garetz' });
  });
});

// ---------------------------------------------------------------------------
// M13_P2 §3.2/§4 — settings layout cohesion (FEAT-004). Two sectioned cards
// replace the 5 previously-disjointed floating cards.
// ---------------------------------------------------------------------------

describe('AC-1: two distinct section cards apply CARD_CLASS', () => {
  it('settings-section-units and settings-section-formulas both render with CARD_CLASS', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(DEFAULT_CONFIG));
    renderSettings();

    await waitFor(() => expect(screen.getByTestId('settings-section-units')).toBeInTheDocument());
    expect(screen.getByTestId('settings-section-units').className).toBe(CARD_CLASS);
    expect(screen.getByTestId('settings-section-formulas').className).toBe(CARD_CLASS);
  });
});

describe('AC-2: settings-section-units groups Unit System / Gravity Display / Temperature', () => {
  it('contains all three selects with their labels and helper captions, nested inside settings-section-units', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(DEFAULT_CONFIG));
    renderSettings();

    await waitFor(() => expect(screen.getByTestId('settings-section-units')).toBeInTheDocument());
    const section = screen.getByTestId('settings-section-units');

    for (const testId of ['settings-select-unitSystem', 'settings-select-gravityUnit', 'settings-select-temperatureUnit']) {
      expect(section.contains(screen.getByTestId(testId))).toBe(true);
    }

    expect(section).toHaveTextContent('Unit System');
    expect(section).toHaveTextContent('Default measurement system for recipes and inventory');
    expect(section).toHaveTextContent('Gravity Display');
    expect(section).toHaveTextContent('Specific Gravity (1.050) vs Degrees Plato (°P)');
    expect(section).toHaveTextContent('Temperature');
    expect(section).toHaveTextContent('Temperature scale used across mash and fermentation');

    // Neither Formulas select leaks into the Units section.
    expect(section.querySelector('[data-testid="settings-select-ibuFormula"]')).toBeNull();
    expect(section.querySelector('[data-testid="settings-select-abvFormula"]')).toBeNull();
  });
});

describe('AC-3: settings-section-formulas groups IBU Formula / ABV Formula', () => {
  it('contains both selects with their labels and helper captions, nested inside settings-section-formulas', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(DEFAULT_CONFIG));
    renderSettings();

    await waitFor(() => expect(screen.getByTestId('settings-section-formulas')).toBeInTheDocument());
    const section = screen.getByTestId('settings-section-formulas');

    for (const testId of ['settings-select-ibuFormula', 'settings-select-abvFormula']) {
      expect(section.contains(screen.getByTestId(testId))).toBe(true);
    }

    expect(section).toHaveTextContent('IBU Formula');
    expect(section).toHaveTextContent('Hop bitterness calculation model');
    expect(section).toHaveTextContent('ABV Formula');
    expect(section).toHaveTextContent('Alcohol by volume estimation formula');

    // Neither Units select leaks into the Formulas section.
    expect(section.querySelector('[data-testid="settings-select-unitSystem"]')).toBeNull();
  });
});

describe('AC-4: setting rows apply SETTINGS_ROW_CLASS inside a divide-y divide-slate-800 container', () => {
  it('every row wrapper in both sections carries SETTINGS_ROW_CLASS, and the row container divides them', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(DEFAULT_CONFIG));
    renderSettings();

    await waitFor(() => expect(screen.getByTestId('settings-section-units')).toBeInTheDocument());

    const units = screen.getByTestId('settings-section-units');
    const unitsDivider = units.querySelector('.divide-y.divide-slate-800');
    expect(unitsDivider).not.toBeNull();
    expect(unitsDivider?.children).toHaveLength(3);
    for (const child of Array.from(unitsDivider?.children ?? [])) {
      expect(child.className).toBe(SETTINGS_ROW_CLASS);
    }

    const formulas = screen.getByTestId('settings-section-formulas');
    const formulasDivider = formulas.querySelector('.divide-y.divide-slate-800');
    expect(formulasDivider).not.toBeNull();
    expect(formulasDivider?.children).toHaveLength(2);
    for (const child of Array.from(formulasDivider?.children ?? [])) {
      expect(child.className).toBe(SETTINGS_ROW_CLASS);
    }
  });
});

describe('AC-5: every <select> in SettingsManager applies Select primitive classes', () => {
  it('all five selects carry the Select md size and FORM_SELECT_CLASS styling', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(DEFAULT_CONFIG));
    renderSettings();

    await waitFor(() => expect(screen.getByTestId('settings-select-unitSystem')).toBeInTheDocument());

    for (const testId of [
      'settings-select-unitSystem',
      'settings-select-gravityUnit',
      'settings-select-temperatureUnit',
      'settings-select-ibuFormula',
      'settings-select-abvFormula',
    ]) {
      const el = screen.getByTestId(testId);
      expect(el).toHaveClass('w-full', 'h-10', 'bg-slate-800', 'border-slate-700', 'text-slate-200');
    }
  });
});

describe('AC-8: loading and error states apply the frozen state-convention classes', () => {
  it('renders LOADING_STATE_CLASS while status === "loading"', () => {
    // Never resolves during this test — leaves ConfigProvider in 'loading'.
    vi.mocked(fetch).mockReturnValueOnce(new Promise(() => {}));
    renderSettings();

    expect(screen.getByText(/Loading settings…/).className).toBe(LOADING_STATE_CLASS);
  });

  it('a save-error banner applies ERROR_STATE_CLASS as its base', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(DEFAULT_CONFIG));
    renderSettings();

    await waitFor(() => expect(screen.getByTestId('settings-select-gravityUnit')).toBeInTheDocument());

    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ error: { code: 'VALIDATION_FAILED', message: 'nope' } }, 400));
    fireEvent.change(screen.getByTestId('settings-select-gravityUnit'), { target: { value: 'plato' } });

    await waitFor(() => expect(screen.getByText(/nope/)).toBeInTheDocument());
    const banner = screen.getByText(/Couldn't save that change/).closest('div');
    expect(banner?.className).toContain('bg-rose-950/60');
    expect(banner?.className).toContain('border-rose-800');
    expect(banner?.className).toContain('text-rose-200');
  });
});

describe('M22_P1 AC-1 & AC-9: SettingsManager Data & Recipe Ingestion', () => {
  it('AC-1: renders Data & Recipe Ingestion section with file upload dropzone', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(DEFAULT_CONFIG));
    renderSettings();

    await waitFor(() => expect(screen.getByTestId('settings-import-section')).toBeInTheDocument());
    expect(screen.getByText('Data & Recipe Ingestion')).toBeInTheDocument();
    expect(screen.getByText(/Click to browse or drag and drop/)).toBeInTheDocument();
    expect(screen.getByTestId('recipe-file-input')).toBeInTheDocument();
  });
});

describe('AC-16 (M26_P1 Amendment 1): SettingsManager forwards onOpenMobileNav to its TopBar', () => {
  it('passing onOpenMobileNav renders the hamburger and clicking it calls the callback', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url === '/api/config') return Promise.resolve(jsonResponse(DEFAULT_CONFIG));
        return Promise.reject(new Error(`Unexpected fetch in SettingsManager.test.tsx: ${url}`));
      }),
    );
    const onOpenMobileNav = vi.fn();
    render(
      <ConfigProvider>
        <SettingsManager onOpenMobileNav={onOpenMobileNav} />
      </ConfigProvider>,
    );
    await screen.findByRole('heading', { level: 1, name: 'Settings' });
    const btn = screen.getByRole('button', { name: 'Open navigation menu' });
    fireEvent.click(btn);
    expect(onOpenMobileNav).toHaveBeenCalledTimes(1);
  });

  it('omitting onOpenMobileNav renders no hamburger button', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url === '/api/config') return Promise.resolve(jsonResponse(DEFAULT_CONFIG));
        return Promise.reject(new Error(`Unexpected fetch in SettingsManager.test.tsx: ${url}`));
      }),
    );
    renderSettings();
    await screen.findByRole('heading', { level: 1, name: 'Settings' });
    expect(screen.queryByRole('button', { name: 'Open navigation menu' })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// M36_P1 — Database Backup & Export card (AC-13 through AC-16).
// ---------------------------------------------------------------------------

describe('M36_P1: Database Backup & Export card', () => {
  const MOCK_BACKUP: DatabaseBackup = {
    schemaVersion: 1,
    exportedAt: '2026-08-30T12:00:00.000Z',
    appVersion: '0.0.0',
    data: {
      recipes: [],
      batches: [],
      equipmentProfiles: [],
      mashProfiles: [],
      fermentationProfiles: [],
      waterProfiles: [],
      inventoryItems: [],
      config: DEFAULT_CONFIG,
    },
  };

  let anchorClickSpy: ReturnType<typeof vi.fn>;
  // `document.createElement`'s overloaded signature does not collapse into a
  // single MockInstance type — this spy is only ever read via `.mock.results`.
  let createElementSpy: any;

  beforeEach(() => {
    // jsdom implements neither URL.createObjectURL/revokeObjectURL nor a
    // real click-driven navigation for blob: URLs — both are stubbed so
    // downloadDatabaseBackup()'s RA-3 mechanism can be exercised without
    // jsdom's "not implemented" navigation warnings.
    URL.createObjectURL = vi.fn(() => 'blob:mock-backup-url');
    URL.revokeObjectURL = vi.fn();

    anchorClickSpy = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    createElementSpy = vi.spyOn(document, 'createElement').mockImplementation(((tagName: string, options?: ElementCreationOptions) => {
      const el = originalCreateElement(tagName, options);
      if (tagName === 'a') {
        (el as HTMLAnchorElement).click = anchorClickSpy;
      }
      return el;
    }) as typeof document.createElement);
  });

  afterEach(() => {
    createElementSpy.mockRestore();
  });

  describe('AC-13: renders the Database Backup & Export card', () => {
    it('applies CARD_CLASS and shows descriptive copy using BODY_TEXT_CLASS', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(DEFAULT_CONFIG));
      renderSettings();

      await waitFor(() => expect(screen.getByTestId('settings-backup-section')).toBeInTheDocument());
      const section = screen.getByTestId('settings-backup-section');
      expect(section.className).toBe(CARD_CLASS);
      expect(screen.getByText('Database Backup & Export')).toBeInTheDocument();

      const copy = Array.from(section.querySelectorAll('p')).find((p) => p.textContent?.includes('Download a complete JSON snapshot'));
      expect(copy).toBeDefined();
      expect(copy?.className).toContain('text-sm');
      expect(copy?.className).toContain('text-slate-300');
    });
  });

  describe('AC-14: export trigger is a Button primitive with the expected testid and shows a loading state', () => {
    it('renders as <Button variant="primary" size="sm"> with data-testid="settings-export-backup-btn"', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(DEFAULT_CONFIG));
      renderSettings();

      await waitFor(() => expect(screen.getByTestId('settings-export-backup-btn')).toBeInTheDocument());
      const btn = screen.getByTestId('settings-export-backup-btn');
      expect(btn.tagName).toBe('BUTTON');
      expect(btn).toHaveAttribute('type', 'button');
      // primary variant
      expect(btn).toHaveClass('bg-amber-600', 'hover:bg-amber-500', 'text-white');
      // sm size
      expect(btn).toHaveClass('text-xs', 'px-3', 'py-1.5');
    });

    it('disables the button and shows a loading label while the export is in flight, then clears it', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(DEFAULT_CONFIG));
      renderSettings();
      await waitFor(() => expect(screen.getByTestId('settings-export-backup-btn')).toBeInTheDocument());

      let resolveExport: (value: Response) => void = () => {};
      vi.mocked(fetch).mockReturnValueOnce(
        new Promise<Response>((resolve) => {
          resolveExport = resolve;
        }),
      );

      fireEvent.click(screen.getByTestId('settings-export-backup-btn'));

      await waitFor(() => expect(screen.getByTestId('settings-export-backup-btn')).toBeDisabled());
      expect(screen.getByText('Exporting…')).toBeInTheDocument();

      resolveExport(jsonResponse(MOCK_BACKUP));

      await waitFor(() => expect(screen.getByTestId('settings-export-backup-btn')).not.toBeDisabled());
      expect(screen.getByText('Export Database Backup')).toBeInTheDocument();
    });
  });

  describe('AC-15: download filename format', () => {
    it('clicking the export button downloads a file named truchabrew_backup_YYYY-MM-DD.json', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(DEFAULT_CONFIG));
      renderSettings();
      await waitFor(() => expect(screen.getByTestId('settings-export-backup-btn')).toBeInTheDocument());

      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(MOCK_BACKUP));

      fireEvent.click(screen.getByTestId('settings-export-backup-btn'));

      await waitFor(() => expect(anchorClickSpy).toHaveBeenCalledTimes(1));

      const anchorResults = createElementSpy.mock.results.filter((r: { value: unknown }) => (r.value as HTMLElement).tagName === 'A');
      const anchor = anchorResults[anchorResults.length - 1]?.value as HTMLAnchorElement;
      expect(anchor.download).toMatch(/^truchabrew_backup_\d{4}-\d{2}-\d{2}\.json$/);
      expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-backup-url');
    });
  });

  describe('AC-16: recoverable error banner on export failure', () => {
    it('shows an error banner (not a crash) when the export API call fails, and the button remains usable', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(DEFAULT_CONFIG));
      renderSettings();
      await waitFor(() => expect(screen.getByTestId('settings-export-backup-btn')).toBeInTheDocument());

      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ error: { code: 'INTERNAL', message: 'export failed' } }, 500));

      fireEvent.click(screen.getByTestId('settings-export-backup-btn'));

      await waitFor(() => expect(screen.getByTestId('settings-backup-export-error')).toBeInTheDocument());
      expect(screen.getByText(/export failed/)).toBeInTheDocument();

      // Recoverable: the rest of the page is intact and the button is
      // enabled again, not a crashed/blank page.
      expect(screen.getByTestId('settings-export-backup-btn')).toBeInTheDocument();
      expect(screen.getByTestId('settings-export-backup-btn')).not.toBeDisabled();
      expect(anchorClickSpy).not.toHaveBeenCalled();
    });

    it('a subsequent successful export clears the error banner', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(DEFAULT_CONFIG));
      renderSettings();
      await waitFor(() => expect(screen.getByTestId('settings-export-backup-btn')).toBeInTheDocument());

      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ error: { code: 'INTERNAL', message: 'export failed' } }, 500));
      fireEvent.click(screen.getByTestId('settings-export-backup-btn'));
      await waitFor(() => expect(screen.getByTestId('settings-backup-export-error')).toBeInTheDocument());

      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(MOCK_BACKUP));
      fireEvent.click(screen.getByTestId('settings-export-backup-btn'));

      await waitFor(() => expect(screen.queryByTestId('settings-backup-export-error')).not.toBeInTheDocument());
    });
  });

  // ---------------------------------------------------------------------------
  // M36_P2 — the restore dropzone (AC-13) and the modal it launches (AC-14).
  // ---------------------------------------------------------------------------

  function dropFile(dropzone: HTMLElement, content: string, name = 'truchabrew_backup_2026-08-30.json') {
    const file = new File([content], name, { type: 'application/json' });
    Object.defineProperty(file, 'text', { value: () => Promise.resolve(content) });
    fireEvent.drop(dropzone, { dataTransfer: { files: [file] } });
  }

  describe('AC-13: renders the restore dropzone', () => {
    it('renders a drag-and-drop zone with data-testid="settings-restore-dropzone" inside the backup section', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(DEFAULT_CONFIG));
      renderSettings();

      await waitFor(() => expect(screen.getByTestId('settings-backup-section')).toBeInTheDocument());
      const section = screen.getByTestId('settings-backup-section');
      const dropzone = screen.getByTestId('settings-restore-dropzone');
      expect(section.contains(dropzone)).toBe(true);
      // The Export card (M36_P1) is undisturbed — its own button is still there too.
      expect(screen.getByTestId('settings-export-backup-btn')).toBeInTheDocument();
    });
  });

  describe('AC-14: dropping a valid backup file opens BackupRestoreModal', () => {
    it('parses a dropped .json file and opens the modal with data-testid="backup-restore-modal"', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(DEFAULT_CONFIG));
      renderSettings();
      await waitFor(() => expect(screen.getByTestId('settings-restore-dropzone')).toBeInTheDocument());

      expect(screen.queryByTestId('backup-restore-modal')).not.toBeInTheDocument();
      dropFile(screen.getByTestId('settings-restore-dropzone'), JSON.stringify(MOCK_BACKUP));

      await waitFor(() => expect(screen.getByTestId('backup-restore-modal')).toBeInTheDocument());
    });

    it('shows a recoverable error, and does not open the modal, for a file that is valid JSON but not a recognized backup', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(DEFAULT_CONFIG));
      renderSettings();
      await waitFor(() => expect(screen.getByTestId('settings-restore-dropzone')).toBeInTheDocument());

      dropFile(screen.getByTestId('settings-restore-dropzone'), JSON.stringify({ hello: 'world' }));

      await waitFor(() => expect(screen.getByTestId('settings-restore-error')).toBeInTheDocument());
      expect(screen.getByText(/not a recognized TruchaBrew database backup/i)).toBeInTheDocument();
      expect(screen.queryByTestId('backup-restore-modal')).not.toBeInTheDocument();
    });

    it('shows a recoverable error for a dropped file that is not valid JSON at all', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(DEFAULT_CONFIG));
      renderSettings();
      await waitFor(() => expect(screen.getByTestId('settings-restore-dropzone')).toBeInTheDocument());

      dropFile(screen.getByTestId('settings-restore-dropzone'), 'not json at all {{{');

      await waitFor(() => expect(screen.getByTestId('settings-restore-error')).toBeInTheDocument());
      expect(screen.getByText(/not valid JSON/i)).toBeInTheDocument();
      expect(screen.queryByTestId('backup-restore-modal')).not.toBeInTheDocument();
    });

    it('selecting a valid backup file via the hidden file input also opens the modal', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(DEFAULT_CONFIG));
      renderSettings();
      await waitFor(() => expect(screen.getByTestId('settings-restore-file-input')).toBeInTheDocument());

      const input = screen.getByTestId('settings-restore-file-input') as HTMLInputElement;
      const file = new File([JSON.stringify(MOCK_BACKUP)], 'backup.json', { type: 'application/json' });
      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => expect(screen.getByTestId('backup-restore-modal')).toBeInTheDocument());
    });
  });
});
