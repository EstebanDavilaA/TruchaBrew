import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { CalculatedStats } from '@truchabrew/shared-types';
import {
  BJCP_STYLES,
  type BJCPStyle,
  type StyleVitalKey,
} from '@truchabrew/calculations';
import { StyleTargetPanel } from '../src/components/StyleTargetPanel';

const VITAL_KEYS: readonly StyleVitalKey[] = ['og', 'fg', 'abv', 'ibu', 'srm'];

// Full CalculatedStats so the adapter has concrete inputs. Default values are
// overwritten per-test to probe live BJCP style boundaries.
function makeStats(overrides: Partial<Pick<CalculatedStats, 'og' | 'fg' | 'abv' | 'ibu' | 'srm'>> = {}): CalculatedStats {
  return {
    og: 1.06,
    fg: 1.012,
    abv: 6.2,
    ibu: 55,
    srm: 12,
    ebc: 1,
    buGu: 1,
    rbr: 1,
    totalGrainKg: 5,
    totalHopG: 60,
    mashWaterL: 12,
    spargeWaterL: 8,
    totalWaterL: 20,
    preBoilVolumeL: 24,
    preBoilGravity: 1.05,
    attenuationPct: 80,
    postBoilVolumeL: 19,
    ...overrides,
  };
}

function midpoints(style: BJCPStyle): { og: number; fg: number; abv: number; ibu: number; srm: number } {
  return {
    og: (style.og.low + style.og.high) / 2,
    fg: (style.fg.low + style.fg.high) / 2,
    abv: (style.abv.low + style.abv.high) / 2,
    ibu: (style.ibu.low + style.ibu.high) / 2,
    srm: (style.srm.low + style.srm.high) / 2,
  };
}

function rowState(container: HTMLElement, key: StyleVitalKey): string | null {
  return container.querySelector(`[data-vital="${key}"]`)?.getAttribute('data-state') ?? null;
}

describe('StyleTargetPanel', () => {
  const style = BJCP_STYLES[0];

  it('AC-17: the selector lists "No BJCP Style" plus 86 dataset options with "{id} — {name}" labels', () => {
    render(<StyleTargetPanel bjcpStyleId={null} stats={makeStats()} onStyleChange={() => {}} />);
    const select = screen.getByLabelText('BJCP Style') as HTMLSelectElement;
    const options = Array.from(select.options);
    // 86 dataset options + the leading null option.
    expect(options).toHaveLength(BJCP_STYLES.length + 1);
    expect(BJCP_STYLES.length).toBe(86);
    expect(options[0].value).toBe('');
    expect(options[0].text).toBe('No BJCP Style');
    const datasetOptions = options.slice(1);
    datasetOptions.forEach((opt, i) => {
      const s = BJCP_STYLES[i];
      expect(opt.value).toBe(s.id);
      expect(opt.text).toBe(`${s.id} — ${s.name}`);
    });
    expect(select.value).toBe(''); // null renders as the '' null option
  });

  it('AC-18: selecting a style calls onStyleChange(id); the null option calls onStyleChange(null)', () => {
    const onStyleChange = vi.fn();
    render(<StyleTargetPanel bjcpStyleId={null} stats={makeStats()} onStyleChange={onStyleChange} />);
    const select = screen.getByLabelText('BJCP Style') as HTMLSelectElement;

    fireEvent.change(select, { target: { value: style.id } });
    expect(onStyleChange).toHaveBeenCalledWith(style.id);

    fireEvent.change(select, { target: { value: '' } });
    expect(onStyleChange).toHaveBeenLastCalledWith(null);
  });

  it('AC-19: with a found style and a full CalculatedStats, exactly five gauge rows render, each in-range or out-of-range', () => {
    const { container } = render(
      <StyleTargetPanel bjcpStyleId={style.id} stats={makeStats(midpoints(style))} onStyleChange={() => {}} />,
    );
    const rows = container.querySelectorAll('[data-vital]');
    expect(rows).toHaveLength(5);
    for (const key of VITAL_KEYS) {
      const state = rowState(container, key);
      expect(['in-range', 'out-of-range']).toContain(state);
    }
  });

  it('AC-20: a vital exactly at the inclusive lower bound is in range', () => {
    const { container } = render(
      <StyleTargetPanel
        bjcpStyleId={style.id}
        stats={makeStats({ ...midpoints(style), og: style.og.low })}
        onStyleChange={() => {}}
      />,
    );
    expect(rowState(container, 'og')).toBe('in-range');
  });

  it('AC-21: just below the lower bound is out of range; just above is in range (no epsilon)', () => {
    const below = makeStats({ ...midpoints(style), og: style.og.low - 0.001 });
    const { container, rerender } = render(
      <StyleTargetPanel bjcpStyleId={style.id} stats={below} onStyleChange={() => {}} />,
    );
    expect(rowState(container, 'og')).toBe('out-of-range');

    const above = makeStats({ ...midpoints(style), og: style.og.low + 0.001 });
    rerender(<StyleTargetPanel bjcpStyleId={style.id} stats={above} onStyleChange={() => {}} />);
    expect(rowState(container, 'og')).toBe('in-range');
  });

  it('AC-22: at the inclusive upper bound is in range; just above is out of range', () => {
    const at = makeStats({ ...midpoints(style), ibu: style.ibu.high });
    const { container, rerender } = render(
      <StyleTargetPanel bjcpStyleId={style.id} stats={at} onStyleChange={() => {}} />,
    );
    expect(rowState(container, 'ibu')).toBe('in-range');

    const above = makeStats({ ...midpoints(style), ibu: style.ibu.high + 0.001 });
    rerender(<StyleTargetPanel bjcpStyleId={style.id} stats={above} onStyleChange={() => {}} />);
    expect(rowState(container, 'ibu')).toBe('out-of-range');
  });

  it('AC-23: out-of-range rows carry a rose/red visual class, in-range rows an emerald/green one', () => {
    const inRange = makeStats(midpoints(style));
    const { container, rerender } = render(
      <StyleTargetPanel bjcpStyleId={style.id} stats={inRange} onStyleChange={() => {}} />,
    );
    const ogIn = container.querySelector('[data-vital="og"]') as HTMLElement;
    expect(ogIn.querySelector('[class*="text-emerald-400"]')).not.toBeNull();

    const outRange = makeStats({ ...midpoints(style), og: style.og.high + 0.001 });
    rerender(<StyleTargetPanel bjcpStyleId={style.id} stats={outRange} onStyleChange={() => {}} />);
    const ogOut = container.querySelector('[data-vital="og"]') as HTMLElement;
    expect(ogOut.querySelector('[class*="text-rose-400"]')).not.toBeNull();
  });

  it('AC-24: verdict "Full Match" when every vital is within the style', () => {
    render(<StyleTargetPanel bjcpStyleId={style.id} stats={makeStats(midpoints(style))} onStyleChange={() => {}} />);
    expect(screen.getByTestId('style-verdict').textContent).toBe('Full Match');
  });

  it('AC-25: verdict "Partial Match" with at least one in-range and one out-of-range vital', () => {
    const stats = makeStats({ ...midpoints(style), og: style.og.high + 1 });
    render(<StyleTargetPanel bjcpStyleId={style.id} stats={stats} onStyleChange={() => {}} />);
    expect(screen.getByTestId('style-verdict').textContent).toBe('Partial Match');
  });

  it('AC-26: verdict "No Match" when every vital is out of range', () => {
    const stats = makeStats({
      og: style.og.high + 1,
      fg: style.fg.high + 1,
      abv: style.abv.high + 1,
      ibu: style.ibu.high + 1,
      srm: style.srm.high + 1,
    });
    render(<StyleTargetPanel bjcpStyleId={style.id} stats={stats} onStyleChange={() => {}} />);
    expect(screen.getByTestId('style-verdict').textContent).toBe('No Match');
  });

  it('AC-27: neutral state when bjcpStyleId is null — no gauges, no verdict', () => {
    const { container } = render(<StyleTargetPanel bjcpStyleId={null} stats={makeStats()} onStyleChange={() => {}} />);
    expect(screen.getByTestId('style-neutral')).toBeInTheDocument();
    expect(container.querySelectorAll('[data-vital]')).toHaveLength(0);
    expect(screen.queryByTestId('style-verdict')).not.toBeInTheDocument();
  });

  it('AC-28: neutral state for an unknown style id — no fabricated range or verdict', () => {
    const { container } = render(
      <StyleTargetPanel bjcpStyleId="ZZ9" stats={makeStats(midpoints(style))} onStyleChange={() => {}} />,
    );
    expect(screen.getByTestId('style-neutral')).toBeInTheDocument();
    expect(container.querySelectorAll('[data-vital]')).toHaveLength(0);
    expect(screen.queryByTestId('style-verdict')).not.toBeInTheDocument();
  });

  it('AC-29: real-time recompute on a vitals change flips a gauge without changing the style', () => {
    const inRange = makeStats(midpoints(style));
    const { container, rerender } = render(
      <StyleTargetPanel bjcpStyleId={style.id} stats={inRange} onStyleChange={() => {}} />,
    );
    expect(rowState(container, 'og')).toBe('in-range');

    // Keep the same style; only the OG value changes to out of range.
    const edited = makeStats({ ...midpoints(style), og: style.og.high + 0.001 });
    rerender(<StyleTargetPanel bjcpStyleId={style.id} stats={edited} onStyleChange={() => {}} />);
    expect(rowState(container, 'og')).toBe('out-of-range');
  });

  it('AC-30: real-time recompute on a style change flips a gauge with stats fixed', () => {
    const fixed = makeStats(midpoints(style));
    // Find a second dataset style whose OG range does NOT contain the fixed og
    // (so the OG gauge flips when we switch), reading boundaries live from the
    // dataset rather than hardcoding (RA-P3-5).
    const other = BJCP_STYLES.find(
      (s) => s.id !== style.id && !(s.og.low <= fixed.og && fixed.og <= s.og.high),
    );
    expect(other).toBeDefined();
    const { container, rerender } = render(
      <StyleTargetPanel bjcpStyleId={style.id} stats={fixed} onStyleChange={() => {}} />,
    );
    expect(rowState(container, 'og')).toBe('in-range');

    rerender(<StyleTargetPanel bjcpStyleId={other!.id} stats={fixed} onStyleChange={() => {}} />);
    expect(rowState(container, 'og')).toBe('out-of-range');
  });
});
