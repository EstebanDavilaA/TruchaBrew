import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import type { MiscItem } from '@truchabrew/shared-types';
import { MiscSection } from '../src/components/MiscSection';

// New dedicated suite (M23_P1 spec §3 — MiscSection had no test file of its
// own before this phase). Covers RA-4/RA-6/AC-8/AC-9/AC-10: every
// interactive control in the table + add-form resolves to a non-empty
// accessible name, per-row names are distinct across rows, and a generic
// role-based sweep catches anything a future control adds without a label.

vi.mock('../src/context/CatalogContext', () => ({
  useCatalog: () => ({
    catalog: {
      fermentables: [],
      hops: [],
      yeasts: [],
      miscs: [{ id: 'cat-m-1', name: 'Whirlfloc', type: 'Fining', defaultUse: 'Boil', defaultUnit: 'each' }],
    },
    loading: false,
    error: null,
    reload: vi.fn(),
  }),
}));

function miscItem(overrides: Partial<MiscItem> = {}): MiscItem {
  return {
    id: 'm-1',
    name: 'Irish Moss',
    type: 'Fining',
    use: 'Boil',
    timeMinutes: 10,
    amount: 1,
    unit: 'tsp',
    ...overrides,
  };
}

const TWO_MISCS: MiscItem[] = [
  miscItem({ id: 'm-1', name: 'Irish Moss' }),
  miscItem({ id: 'm-2', name: 'Gypsum', amount: 5, timeMinutes: 60 }),
];

describe('AC-8: every named control in the §2.2 table resolves', () => {
  it('all table row controls and catalog add button resolve to exactly one element each', () => {
    render(<MiscSection miscs={TWO_MISCS} onUpdate={vi.fn()} />);

    expect(screen.getByLabelText('Remove Irish Moss')).toBeInTheDocument();
    expect(screen.getByLabelText('Use for Gypsum')).toBeInTheDocument();
    expect(screen.getByLabelText('Amount of Irish Moss')).toBeInTheDocument();
    expect(screen.getByLabelText('Time in minutes for Gypsum')).toBeInTheDocument();
    expect(screen.getByTestId('misc-open-picker-btn')).toBeInTheDocument();
  });
});

describe('AC-9: zero unnamed controls, generically', () => {
  it('every button, combobox, and spinbutton has a non-empty accessible name', () => {
    render(<MiscSection miscs={TWO_MISCS} onUpdate={vi.fn()} />);

    const controls = [
      ...screen.getAllByRole('button'),
      ...screen.getAllByRole('combobox'),
      ...screen.getAllByRole('spinbutton'),
    ];

    expect(controls.length).toBeGreaterThan(0);
    for (const control of controls) {
      const name = control.getAttribute('aria-label') ?? control.textContent ?? '';
      expect(name.trim().length).toBeGreaterThan(0);
    }
  });
});

describe('AC-10: per-row accessible names are distinct across rows (RA-6)', () => {
  it('Remove label is unique per row', () => {
    render(<MiscSection miscs={TWO_MISCS} onUpdate={vi.fn()} />);
    expect(screen.getAllByLabelText(/^Remove /)).toHaveLength(2);
  });

  it('all four per-row names differ between the two rows', () => {
    render(<MiscSection miscs={TWO_MISCS} onUpdate={vi.fn()} />);
    const rowOneNames = [
      screen.getByLabelText('Use for Irish Moss'),
      screen.getByLabelText('Time in minutes for Irish Moss'),
      screen.getByLabelText('Amount of Irish Moss'),
      screen.getByLabelText('Remove Irish Moss'),
    ];
    const rowTwoNames = [
      screen.getByLabelText('Use for Gypsum'),
      screen.getByLabelText('Time in minutes for Gypsum'),
      screen.getByLabelText('Amount of Gypsum'),
      screen.getByLabelText('Remove Gypsum'),
    ];
    rowOneNames.forEach((el, i) => expect(el).not.toBe(rowTwoNames[i]));
  });
});

describe('AC-13: title retained alongside aria-label (RA-5)', () => {
  it('every Remove button keeps its title tooltip', () => {
    render(<MiscSection miscs={TWO_MISCS} onUpdate={vi.fn()} />);
    for (const btn of screen.getAllByLabelText(/^Remove /)) {
      expect(btn.getAttribute('title')).toBe('Remove misc');
    }
  });
});

describe('untouched behavior — "Add Misc" text button remains named by text', () => {
  it('resolves via its visible text, not a new aria-label', () => {
    render(<MiscSection miscs={[]} onUpdate={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Add Misc/ })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// M32_P2 — NumberInput migration (3 raw numeric inputs -> <NumberInput>)
// ---------------------------------------------------------------------------

const SRC_FILE = path.resolve(__dirname, '../src/components/MiscSection.tsx');
const SRC_TEXT = fs.readFileSync(SRC_FILE, 'utf-8');

describe('AC-5 & AC-7: raw <input> is gone, <NumberInput> count is exact', () => {
  it('zero raw <input> elements remain in MiscSection.tsx', () => {
    expect(SRC_TEXT.match(/<input[\s>]/g)).toBeNull();
  });

  it('exactly 2 <NumberInput> elements are present in MiscSection.tsx', () => {
    expect(SRC_TEXT.match(/<NumberInput[\s>]/g)?.length).toBe(2);
  });
});

describe('AC-10 & AC-11: no className on migrated call sites; unused base-token import dropped', () => {
  it('no <NumberInput …> tag contains className', () => {
    const tags = SRC_TEXT.match(/<NumberInput\b[\s\S]*?\/>/g) ?? [];
    expect(tags.length).toBe(2);
    for (const tag of tags) {
      expect(tag).not.toContain('className');
    }
  });

  it('INPUT_COMPACT_CLASS is no longer imported, but CARD_CLASS/SECTION_HEADING_CLASS still are', () => {
    expect(SRC_TEXT).not.toMatch(/import\s*\{[^}]*\bINPUT_COMPACT_CLASS\b[^}]*\}\s*from\s*['"]\.\/designSystem['"]/);
    expect(SRC_TEXT).toMatch(/import\s*\{[^}]*\bCARD_CLASS\b[^}]*\}\s*from\s*['"]\.\/designSystem['"]/);
    expect(SRC_TEXT).toMatch(/import\s*\{[^}]*\bSECTION_HEADING_CLASS\b[^}]*\}\s*from\s*['"]\.\/designSystem['"]/);
  });
});

describe('AC-23: out-of-scope elements are untouched (RA-11, RA-12, RA-13)', () => {
  it('still has exactly 0 <select and 0 <button, 0 addonRight, and 0 scope="col" occurrences', () => {
    expect(SRC_TEXT.match(/<select\b/g)?.length ?? 0).toBe(0);
    expect(SRC_TEXT.match(/<button\b/g)?.length ?? 0).toBe(0);
    expect(SRC_TEXT).not.toContain('addonRight');
    expect(SRC_TEXT).not.toContain('scope="col"');
  });
});

describe('M32_P2 rendered behavior', () => {
  it('AC-8/AC-9/AC-12: M-1 (time) has min=0, NO step attribute at all, and renders w-16 not w-full', () => {
    render(<MiscSection miscs={TWO_MISCS} onUpdate={vi.fn()} />);
    const input = screen.getByLabelText('Time in minutes for Irish Moss');
    expect(input.getAttribute('type')).toBe('number');
    expect(input.getAttribute('min')).toBe('0');
    expect(input.hasAttribute('step')).toBe(false);
    expect(input).toHaveClass('w-16');
    expect(input).not.toHaveClass('w-full');
  });

  it('AC-8/AC-9/AC-12: M-2 (amount) has step=0.1, min=0, and renders w-16 not w-full', () => {
    render(<MiscSection miscs={TWO_MISCS} onUpdate={vi.fn()} />);
    const input = screen.getByLabelText('Amount of Irish Moss');
    expect(input.getAttribute('type')).toBe('number');
    expect(input.getAttribute('step')).toBe('0.1');
    expect(input.getAttribute('min')).toBe('0');
    expect(input).toHaveClass('w-16');
    expect(input).not.toHaveClass('w-full');
  });

  it('AC-8: spinbutton count with two miscs rendered is 4 (2 rows x 2 per-row controls)', () => {
    render(<MiscSection miscs={TWO_MISCS} onUpdate={vi.fn()} />);
    expect(screen.getAllByRole('spinbutton')).toHaveLength(4);
  });

  it('AC-8 (as literally specified): with ONE misc rendered, getAllByRole(\'spinbutton\') has length 2', () => {
    render(<MiscSection miscs={[TWO_MISCS[0]]} onUpdate={vi.fn()} />);
    expect(screen.getAllByRole('spinbutton')).toHaveLength(2);
  });

  it('AC-19: row inputs carry MONO_VALUE_CLASS in full (font-mono tabular-nums tracking-tight)', () => {
    render(<MiscSection miscs={TWO_MISCS} onUpdate={vi.fn()} />);
    const inputs = [
      screen.getByLabelText('Time in minutes for Irish Moss'),
      screen.getByLabelText('Amount of Irish Moss'),
    ];
    for (const el of inputs) {
      expect(el).toHaveClass('font-mono', 'tabular-nums', 'tracking-tight');
    }
  });

  it('AC-14: editing time uses parseInt (not parseFloat) — "12.7" yields 12, not 12.7', () => {
    const onUpdate = vi.fn();
    render(<MiscSection miscs={TWO_MISCS} onUpdate={onUpdate} />);
    const input = screen.getByLabelText('Time in minutes for Irish Moss');

    fireEvent.change(input, { target: { value: '45' } });
    expect(onUpdate).toHaveBeenCalledTimes(1);
    let updated = onUpdate.mock.calls[0][0] as MiscItem[];
    expect(updated.find((m) => m.id === 'm-1')?.timeMinutes).toBe(45);
    expect(updated.find((m) => m.id === 'm-2')).toEqual(TWO_MISCS[1]);

    onUpdate.mockClear();
    fireEvent.change(input, { target: { value: '12.7' } });
    expect(onUpdate).toHaveBeenCalledTimes(1);
    updated = onUpdate.mock.calls[0][0] as MiscItem[];
    expect(updated.find((m) => m.id === 'm-1')?.timeMinutes).toBe(12);

    onUpdate.mockClear();
    fireEvent.change(input, { target: { value: '-5' } });
    expect(onUpdate).toHaveBeenCalledTimes(1);
    updated = onUpdate.mock.calls[0][0] as MiscItem[];
    expect(updated.find((m) => m.id === 'm-1')?.timeMinutes).toBe(0);
  });

  it('AC-14: editing amount uses parseFloat, clamped at 0, siblings unmutated', () => {
    const onUpdate = vi.fn();
    render(<MiscSection miscs={TWO_MISCS} onUpdate={onUpdate} />);
    const input = screen.getByLabelText('Amount of Irish Moss');

    fireEvent.change(input, { target: { value: '2.5' } });
    expect(onUpdate).toHaveBeenCalledTimes(1);
    let updated = onUpdate.mock.calls[0][0] as MiscItem[];
    expect(updated.find((m) => m.id === 'm-1')?.amount).toBe(2.5);
    expect(updated.find((m) => m.id === 'm-2')).toEqual(TWO_MISCS[1]);

    onUpdate.mockClear();
    fireEvent.change(input, { target: { value: '-1' } });
    expect(onUpdate).toHaveBeenCalledTimes(1);
    updated = onUpdate.mock.calls[0][0] as MiscItem[];
    expect(updated.find((m) => m.id === 'm-1')?.amount).toBe(0);
  });

  it('AC-15: add-flow — selecting a catalog misc appends new item with default amount', () => {
    const onUpdate = vi.fn();
    render(<MiscSection miscs={TWO_MISCS} onUpdate={onUpdate} />);

    fireEvent.click(screen.getByTestId('misc-open-picker-btn'));
    fireEvent.click(screen.getByText('Whirlfloc'));

    expect(onUpdate).toHaveBeenCalledTimes(1);
    const updated = onUpdate.mock.calls[0][0] as MiscItem[];
    expect(updated).toHaveLength(3);
    const added = updated[updated.length - 1];
    expect(added.amount).toBe(1);
    expect(added.use).toBe('Boil');
    expect(added.timeMinutes).toBe(15);
    expect(added.unit).toBe('each');
  });

  it('AC-16: degenerate empty-list case renders the colSpan=7 empty row, zero table inputs', () => {
    render(<MiscSection miscs={[]} onUpdate={vi.fn()} />);

    expect(screen.getByText('No misc additions yet. Add finings, spices or water agents below.')).toBeInTheDocument();
    const emptyCell = screen.getByText(/No misc additions yet/).closest('td');
    expect(emptyCell).toHaveAttribute('colspan', '7');

    expect(screen.queryAllByRole('spinbutton')).toHaveLength(0);
    expect(screen.getByTestId('misc-open-picker-btn')).toBeInTheDocument();
  });
});
