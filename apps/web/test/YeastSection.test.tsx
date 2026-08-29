import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import type { YeastItem } from '../src/types/brewing';
import { YeastSection } from '../src/components/YeastSection';

const SRC_PATH = path.resolve(__dirname, '../src/components/YeastSection.tsx');
const SRC_TEXT = fs.readFileSync(SRC_PATH, 'utf-8');

vi.mock('../src/context/CatalogContext', () => ({
  useCatalog: () => ({
    catalog: {
      fermentables: [],
      hops: [],
      yeasts: [
        {
          id: 'cat-y-1',
          name: 'SafAle US-05',
          laboratory: 'Fermentis',
          type: 'Ale',
          form: 'Dry',
          attenuationPct: 81,
        },
      ],
      miscs: [],
    },
    loading: false,
    error: null,
    reload: vi.fn(),
  }),
}));

const baseYeast: YeastItem = {
  id: 'y-1',
  name: 'SafAle US-05',
  laboratory: 'Fermentis',
  type: 'Ale',
  form: 'Dry',
  attenuationPct: 81,
  amountPkg: 1,
};

describe('M32_P3: YeastSection source-level contracts (AC-3..AC-8, AC-15)', () => {
  it('AC-3: zero raw <input> elements in YeastSection.tsx', () => {
    expect(SRC_TEXT.match(/<input[\s>]/g)).toBeNull();
  });

  it('AC-4: exactly 1 <NumberInput> in YeastSection.tsx', () => {
    expect(SRC_TEXT.match(/<NumberInput[\s>]/g)?.length).toBe(1);
  });

  it('AC-5: Y-1 passes type="number"', () => {
    const tag = SRC_TEXT.match(/<NumberInput\b[\s\S]*?\/>/)?.[0] ?? '';
    expect(tag).toContain('type="number"');
  });

  it('AC-6: min="50" and max="98" are preserved, and step is absent', () => {
    const tag = SRC_TEXT.match(/<NumberInput\b[\s\S]*?\/>/)?.[0] ?? '';
    expect(tag).toContain('min="50"');
    expect(tag).toContain('max="98"');
    expect(tag).not.toContain('step=');
  });

  it('AC-7: no className on the migrated call site', () => {
    const tag = SRC_TEXT.match(/<NumberInput\b[\s\S]*?\/>/)?.[0] ?? '';
    expect(tag).not.toContain('className');
  });

  it('AC-8: INPUT_COMPACT_CLASS is no longer imported, but CARD_CLASS/SECTION_HEADING_CLASS still are', () => {
    expect(SRC_TEXT).not.toMatch(/import\s*\{[^}]*\bINPUT_COMPACT_CLASS\b[^}]*\}\s*from\s*['"]\.\/designSystem['"]/);
    expect(SRC_TEXT).toMatch(/import\s*\{[^}]*\bCARD_CLASS\b[^}]*\}\s*from\s*['"]\.\/designSystem['"]/);
    expect(SRC_TEXT).toMatch(/import\s*\{[^}]*\bSECTION_HEADING_CLASS\b[^}]*\}\s*from\s*['"]\.\/designSystem['"]/);
  });

  it('AC-15: out-of-scope elements are untouched', () => {
    expect(SRC_TEXT.match(/<select\b/g)?.length ?? 0).toBe(0);
    expect(SRC_TEXT.match(/<button\b/g)?.length ?? 0).toBe(0);
    expect(SRC_TEXT).not.toContain('addonRight');
    // M35_P2 RA-7/RA-8 conversion: TableHeaderCell supplies scope="col" by
    // construction, so the literal never appears in migrated source (the old
    // source-text `.match()` count would return undefined). Assert the
    // rendered DOM instead: 6 columnheaders, all scope="col".
    expect(SRC_TEXT.match(/scope="col"/g)).toBeNull();
    render(<YeastSection yeasts={[baseYeast]} onUpdate={vi.fn()} />);
    const headers = screen.getAllByRole('columnheader');
    expect(headers).toHaveLength(6);
    for (const h of headers) {
      expect(h.getAttribute('scope')).toBe('col');
    }
  });
});

describe('M32_P3: YeastSection rendered behavior (AC-5, AC-6, AC-9..AC-14)', () => {
  it('AC-5 & AC-6: renders input with type="number", min="50", max="98", without step', () => {
    render(<YeastSection yeasts={[baseYeast]} onUpdate={vi.fn()} />);
    const input = screen.getByLabelText('SafAle US-05 attenuation %');
    expect(input.getAttribute('type')).toBe('number');
    expect(input.getAttribute('min')).toBe('50');
    expect(input.getAttribute('max')).toBe('98');
    expect(input.hasAttribute('step')).toBe(false);
    expect(screen.getAllByRole('spinbutton')).toHaveLength(1);
  });

  it('AC-5: renders two spinbuttons when two yeasts are present', () => {
    const yeast2: YeastItem = { ...baseYeast, id: 'y-2', name: 'Saflager W-34/70' };
    render(<YeastSection yeasts={[baseYeast, yeast2]} onUpdate={vi.fn()} />);
    expect(screen.getAllByRole('spinbutton')).toHaveLength(2);
  });

  it('AC-9: renders w-16, text-right, and compact band classes, without h-10 or rounded-lg', () => {
    render(<YeastSection yeasts={[baseYeast]} onUpdate={vi.fn()} />);
    const input = screen.getByLabelText('SafAle US-05 attenuation %');
    expect(input).toHaveClass('w-16', 'text-right', 'px-2.5', 'py-1', 'text-xs', 'bg-slate-800', 'rounded');
    expect(input).not.toHaveClass('w-full');
    expect(input).not.toHaveClass('h-10');
    expect(input).not.toHaveClass('rounded-lg');
    expect(input).not.toHaveClass('px-3');
    expect(input).not.toHaveClass('text-sm');
  });

  it('AC-10: Y-1 carries MONO_VALUE_CLASS in full (font-mono, tabular-nums, tracking-tight)', () => {
    render(<YeastSection yeasts={[baseYeast]} onUpdate={vi.fn()} />);
    const input = screen.getByLabelText('SafAle US-05 attenuation %');
    expect(input).toHaveClass('font-mono', 'tabular-nums', 'tracking-tight');
  });

  it('AC-11: attenuation editing lockstep with onUpdate', () => {
    const onUpdate = vi.fn();
    render(<YeastSection yeasts={[baseYeast]} onUpdate={onUpdate} />);
    const input = screen.getByLabelText('SafAle US-05 attenuation %');
    fireEvent.change(input, { target: { value: '80' } });
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith([
      {
        id: 'y-1',
        name: 'SafAle US-05',
        laboratory: 'Fermentis',
        type: 'Ale',
        form: 'Dry',
        attenuationPct: 80,
        amountPkg: 1,
      },
    ]);
  });

  it('AC-11: with two yeasts present, editing one does not mutate the sibling row', () => {
    const yeast2: YeastItem = { ...baseYeast, id: 'y-2', name: 'Saflager W-34/70', attenuationPct: 75 };
    const onUpdate = vi.fn();
    render(<YeastSection yeasts={[baseYeast, yeast2]} onUpdate={onUpdate} />);
    const input = screen.getByLabelText('SafAle US-05 attenuation %');
    fireEvent.change(input, { target: { value: '85' } });
    expect(onUpdate).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'y-1', attenuationPct: 85 }),
      expect.objectContaining({ id: 'y-2', attenuationPct: 75 }),
    ]);
  });

  it('AC-12: degenerate parse and clamp behavior preserved verbatim', () => {
    const onUpdate = vi.fn();
    render(<YeastSection yeasts={[baseYeast]} onUpdate={onUpdate} />);
    const input = screen.getByLabelText('SafAle US-05 attenuation %');

    // non-numeric string -> 75 fallback
    fireEvent.change(input, { target: { value: 'abc' } });
    expect(onUpdate).toHaveBeenLastCalledWith([expect.objectContaining({ attenuationPct: 75 })]);

    // '0' -> 75 (falsy-zero quirk)
    fireEvent.change(input, { target: { value: '0' } });
    expect(onUpdate).toHaveBeenLastCalledWith([expect.objectContaining({ attenuationPct: 75 })]);

    // '150' -> 100 clamp
    fireEvent.change(input, { target: { value: '150' } });
    expect(onUpdate).toHaveBeenLastCalledWith([expect.objectContaining({ attenuationPct: 100 })]);

    // '-5' -> 0 clamp
    fireEvent.change(input, { target: { value: '-5' } });
    expect(onUpdate).toHaveBeenLastCalledWith([expect.objectContaining({ attenuationPct: 0 })]);

    // '98' -> 98
    fireEvent.change(input, { target: { value: '98' } });
    expect(onUpdate).toHaveBeenLastCalledWith([expect.objectContaining({ attenuationPct: 98 })]);
  });

  it('AC-13: native min/max are advisory only and handler clamp governs', () => {
    const onUpdate = vi.fn();
    render(<YeastSection yeasts={[baseYeast]} onUpdate={onUpdate} />);
    const input = screen.getByLabelText('SafAle US-05 attenuation %');
    fireEvent.change(input, { target: { value: '20' } });
    expect(onUpdate).toHaveBeenCalledWith([expect.objectContaining({ attenuationPct: 20 })]);
  });

  it('AC-14: degenerate empty yeast list renders single colSpan=6 empty state and zero spinbuttons', () => {
    render(<YeastSection yeasts={[]} onUpdate={vi.fn()} />);
    expect(screen.getByText('No yeast added yet. Select a yeast strain below.')).toBeInTheDocument();
    expect(screen.queryAllByRole('spinbutton')).toHaveLength(0);
    expect(screen.getByTestId('yeast-open-picker-btn')).toBeInTheDocument();
  });
});
