import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import type { FermentableItem, UserConfig } from '@truchabrew/shared-types';
import { FermentableSection } from '../src/components/FermentableSection';
import { ConfigProvider } from '../src/context/ConfigContext';

// New test file per M7_P2 spec §1.3 — FermentableSection previously had no
// test coverage of its own. This exercises AC-12 (grain-total conversion,
// routed through the EXISTING formatMass per Resolved Ambiguity 8, not a new
// helper) and the AC-10-sibling guardrail that the per-fermentable Amount
// (kg) input column stays unconverted.

vi.mock('../src/context/CatalogContext', () => ({
  useCatalog: () => ({
    catalog: {
      fermentables: [{ id: 'cat-f-1', name: '2-Row Pale', type: 'Grain', colorSrm: 2, potentialSg: 1.037 }],
      hops: [],
      yeasts: [],
      miscs: [],
    },
    loading: false,
    error: null,
    reload: vi.fn(),
  }),
}));

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
      return Promise.reject(new Error(`Unexpected global fetch call in FermentableSection.test.tsx: ${url}`));
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderFermentableSection(
  fermentables: FermentableItem[],
  totalGrainKg: number,
  config: Partial<UserConfig> = {},
  onUpdate = vi.fn(),
) {
  const testConfig = { ...DEFAULT_TEST_CONFIG, ...config };
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === '/api/config') return Promise.resolve(jsonResponse(testConfig));
      return Promise.reject(new Error(`Unexpected global fetch call in FermentableSection.test.tsx: ${url}`));
    }),
  );
  render(
    <ConfigProvider>
      <FermentableSection fermentables={fermentables} totalGrainKg={totalGrainKg} onUpdate={onUpdate} />
    </ConfigProvider>,
  );
  return onUpdate;
}

function baseFermentable(overrides: Partial<FermentableItem> = {}): FermentableItem {
  return {
    id: 'f-1',
    name: 'Maris Otter',
    type: 'Grain',
    amountKg: 2.5,
    colorSrm: 3,
    potentialSg: 1.037,
    ...overrides,
  };
}

describe('AC-12: FermentableSection grain total converts, closing M7_P1\'s mixed-unit residue', () => {
  it('renders 11.02 lb under "us"', async () => {
    renderFermentableSection([baseFermentable()], 5, { unitSystem: 'us' });
    await waitFor(() => expect(screen.getByText(/Total:/).parentElement?.textContent).toContain('11.02 lb'));
  });

  it('renders 11.02 lb under "imperial"', async () => {
    renderFermentableSection([baseFermentable()], 5, { unitSystem: 'imperial' });
    await waitFor(() => expect(screen.getByText(/Total:/).parentElement?.textContent).toContain('11.02 lb'));
  });

  it('renders 5.00 kg under "metric"', async () => {
    renderFermentableSection([baseFermentable()], 5, { unitSystem: 'metric' });
    await waitFor(() => expect(screen.getByText(/Total:/).parentElement?.textContent).toContain('5.00 kg'));
  });

  it('the per-fermentable Amount (kg) input column and header are unchanged, and a 2.5 amount still renders 2.5', async () => {
    renderFermentableSection([baseFermentable({ amountKg: 2.5 })], 2.5, { unitSystem: 'us' });
    await waitFor(() => expect(screen.getByText(/Total:/).parentElement?.textContent).toContain('lb'));

    expect(screen.getByText('Amount (kg)')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2.5')).toBeInTheDocument();
  });

  it('the string produced is identical to what StatsHeader would render for the same totalGrainKg under the same config (both use formatMass)', async () => {
    // FermentableSection routes through the EXISTING formatMass helper
    // (Resolved Ambiguity 8), not a new one — so its output for a given
    // totalGrainKg/config pair must be byte-identical to formatMass's own
    // pinned value, which is the same value StatsHeader's AC-24 test already
    // asserts (formatMass(5, 'us') === '11.02 lb').
    renderFermentableSection([baseFermentable()], 5, { unitSystem: 'us' });
    await waitFor(() => expect(screen.getByText(/Total:/).parentElement?.textContent).toContain('11.02 lb'));
  });
});

// ---------------------------------------------------------------------------
// M32_P2 — NumberInput migration (2 raw numeric inputs -> <NumberInput>)
// ---------------------------------------------------------------------------

const SRC_FILE = path.resolve(__dirname, '../src/components/FermentableSection.tsx');
const SRC_TEXT = fs.readFileSync(SRC_FILE, 'utf-8');
const APP_SRC_DIR = path.resolve(__dirname, '../src');

function walkAppSrc(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkAppSrc(full, out);
    else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

describe('AC-3: width="lg" and width="xl" app-wide consumers (F-2, F-1)', () => {
  // WaterCalculatorModal's 10 salt-dosage inputs use NumberInput width="lg" (2 source instances).
  it('width="lg" appears exactly 2 times across apps/web/src (WaterCalculatorModal)', () => {
    let total = 0;
    for (const file of walkAppSrc(APP_SRC_DIR)) {
      total += (fs.readFileSync(file, 'utf-8').match(/width="lg"/g) ?? []).length;
    }
    expect(total).toBe(2);
  });

  it('width="xl" appears exactly once across apps/web/src (F-1)', () => {
    let total = 0;
    for (const file of walkAppSrc(APP_SRC_DIR)) {
      total += (fs.readFileSync(file, 'utf-8').match(/width="xl"/g) ?? []).length;
    }
    expect(total).toBe(1);
  });
});

describe('AC-4 & AC-6: raw <input> is gone, <NumberInput> count is exact', () => {
  it('zero raw <input> elements remain in FermentableSection.tsx', () => {
    expect(SRC_TEXT.match(/<input[\s>]/g)).toBeNull();
  });

  it('exactly 1 <NumberInput> element is present in FermentableSection.tsx', () => {
    expect(SRC_TEXT.match(/<NumberInput[\s>]/g)?.length).toBe(1);
  });
});

describe('AC-10 & AC-11: no className on migrated call sites; unused base-token import dropped', () => {
  it('no <NumberInput …> tag contains className', () => {
    const tags = SRC_TEXT.match(/<NumberInput\b[\s\S]*?\/>/g) ?? [];
    expect(tags.length).toBe(1);
    for (const tag of tags) {
      expect(tag).not.toContain('className');
    }
  });

  it('no designSystem card/heading token import remains; the section adopts SectionCard', () => {
    expect(SRC_TEXT).not.toMatch(/import\s*\{[^}]*\bINPUT_CLASS\b[^}]*\}\s*from\s*['"]\.\/designSystem['"]/);
    expect(SRC_TEXT).not.toMatch(/import\s*\{[^}]*\bCARD_CLASS\b[^}]*\}\s*from\s*['"]\.\/designSystem['"]/);
    expect(SRC_TEXT).not.toMatch(/import\s*\{[^}]*\bSECTION_HEADING_CLASS\b[^}]*\}\s*from\s*['"]\.\/designSystem['"]/);
    expect(SRC_TEXT).toMatch(/SectionCard/);
  });
});

describe('AC-22: drift strings are purged from FermentableSection.tsx', () => {
  it('0 occurrences each of bg-slate-950, border-slate-700/80, focus:ring-1, focus:outline-none, transition-colors on an input', () => {
    expect(SRC_TEXT).not.toContain('bg-slate-950');
    expect(SRC_TEXT).not.toContain('border-slate-700/80');
    expect(SRC_TEXT).not.toContain('focus:ring-1');
    expect(SRC_TEXT).not.toContain('focus:outline-none');
    const numberInputTags = SRC_TEXT.match(/<NumberInput\b[\s\S]*?\/>/g) ?? [];
    for (const tag of numberInputTags) {
      expect(tag).not.toContain('transition-colors');
    }
  });

  it('app-wide residue counts land exactly where §2.3 pins them (M34_P5 retired all remaining residues to 0)', () => {
    let inputClassCount = 0;
    let compactCount = 0;
    let compactTextRightCount = 0;
    for (const file of walkAppSrc(APP_SRC_DIR)) {
      const content = fs.readFileSync(file, 'utf-8');
      inputClassCount += (content.match(/\$\{INPUT_CLASS\} font-mono tabular-nums/g) ?? []).length;
      compactCount += (content.match(/\$\{INPUT_COMPACT_CLASS\} font-mono tabular-nums(?! text-right)/g) ?? []).length;
      compactTextRightCount += (content.match(/\$\{INPUT_COMPACT_CLASS\} font-mono tabular-nums text-right/g) ?? [])
        .length;
    }
    expect(inputClassCount).toBe(0);
    expect(compactCount).toBe(0);
    expect(compactTextRightCount).toBe(0);
  });

  it('AC-19: migrated row input carries MONO_VALUE_CLASS in full (font-mono tabular-nums tracking-tight)', async () => {
    renderFermentableSection([baseFermentable({ name: 'Pale Malt' })], 2.5);
    await waitFor(() => expect(screen.getByText(/Total:/)).toBeInTheDocument());
    const rowInput = screen.getByLabelText('Pale Malt amount (kg)');
    expect(rowInput).toHaveClass('font-mono', 'tabular-nums', 'tracking-tight');
  });

  it('AC-20: F-1 adopts token styling and sheds the drift', async () => {
    renderFermentableSection([baseFermentable({ name: 'Pale Malt' })], 2.5);
    const rowInput = screen.getByLabelText('Pale Malt amount (kg)');
    expect(rowInput).toHaveClass('bg-slate-800', 'border-slate-700', 'rounded', 'px-2.5', 'py-1', 'text-xs', 'focus:border-amber-500', 'text-right');
    expect(rowInput).not.toHaveClass('bg-slate-950');
    expect(rowInput).not.toHaveClass('rounded-lg');
    expect(rowInput).not.toHaveClass('focus:ring-1');
    expect(rowInput).not.toHaveClass('focus:outline-none');
    expect(rowInput).not.toHaveClass('transition-colors');
    expect(rowInput).not.toHaveClass('h-10');
  });

  it('AC-13: editing the row amount fires onUpdate once with the clamped/parsed value, leaving siblings untouched', async () => {
    const other = baseFermentable({ id: 'f-2', name: '2-Row Pale', amountKg: 4 });
    const target = baseFermentable({ id: 'f-1', name: 'Pale Malt', amountKg: 2.5 });
    const onUpdate = vi.fn();
    renderFermentableSection([target, other], 6.5, {}, onUpdate);
    await waitFor(() => expect(screen.getByText(/Total:/)).toBeInTheDocument());
    const input = screen.getByLabelText('Pale Malt amount (kg)');

    fireEvent.change(input, { target: { value: '3.75' } });
    expect(onUpdate).toHaveBeenCalledTimes(1);
    let updated = onUpdate.mock.calls[0][0] as FermentableItem[];
    expect(updated.find((f) => f.id === 'f-1')?.amountKg).toBe(3.75);
    expect(updated.find((f) => f.id === 'f-2')).toEqual(other);

    onUpdate.mockClear();
    fireEvent.change(input, { target: { value: '-2' } });
    expect(onUpdate).toHaveBeenCalledTimes(1);
    updated = onUpdate.mock.calls[0][0] as FermentableItem[];
    expect(updated.find((f) => f.id === 'f-1')?.amountKg).toBe(0);

    onUpdate.mockClear();
    fireEvent.change(input, { target: { value: 'abc' } });
    expect(onUpdate).toHaveBeenCalledTimes(1);
    updated = onUpdate.mock.calls[0][0] as FermentableItem[];
    expect(updated.find((f) => f.id === 'f-1')?.amountKg).toBe(0);
  });

  it('AC-15: add-flow — selecting a catalog malt appends the new item with default amount', async () => {
    const existing = [baseFermentable({ id: 'f-1', name: 'Maris Otter', amountKg: 3 })];
    const onUpdate = vi.fn();
    renderFermentableSection(existing, 3, {}, onUpdate);
    await waitFor(() => expect(screen.getByText(/Total:/)).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('fermentable-open-picker-btn'));
    fireEvent.click(screen.getByTestId('preset-item-cat-f-1'));

    expect(onUpdate).toHaveBeenCalledTimes(1);
    const updated = onUpdate.mock.calls[0][0] as FermentableItem[];
    expect(updated).toHaveLength(2);
    const added = updated[updated.length - 1];
    expect(added.amountKg).toBe(1.0);
    expect(added.name).toBe('2-Row Pale');
    expect(added.type).toBe('Grain');
    expect(added.colorSrm).toBe(2);
    expect(added.potentialSg).toBe(1.037);
  });

  it('AC-16: degenerate empty-list case renders the colSpan=7 empty row, zero table inputs', async () => {
    renderFermentableSection([], 0);
    await waitFor(() => expect(screen.getByText(/Total:/)).toBeInTheDocument());

    expect(screen.getByText('No fermentables added yet. Add malts below to calculate gravity and color.')).toBeInTheDocument();
    const emptyCell = screen.getByText(/No fermentables added yet/).closest('td');
    expect(emptyCell).toHaveAttribute('colspan', '7');

    expect(screen.queryAllByRole('spinbutton')).toHaveLength(0);
    expect(screen.getByTestId('fermentable-open-picker-btn')).toBeInTheDocument();
  });

  it('AC-17: the per-row accessible name is exact and unique', async () => {
    renderFermentableSection(
      [baseFermentable({ id: 'f-1', name: 'Maris Otter' }), baseFermentable({ id: 'f-2', name: 'Pale Malt' })],
      5,
    );
    await waitFor(() => expect(screen.getByText(/Total:/)).toBeInTheDocument());

    const allAmounts = screen.getAllByLabelText(/amount \(kg\)$/);
    expect(allAmounts).toHaveLength(2);
    expect(new Set(allAmounts).size).toBe(2);
  });
});
