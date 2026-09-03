import { useMemo } from 'react';
import type { CalculatedStats } from '@truchabrew/shared-types';
import {
  BJCP_STYLES,
  evaluateStyleMatch,
  type StyleMatchVerdict,
  type StyleVitalKey,
} from '@truchabrew/calculations';
import { Select } from './ui';
import { statsToStyleVitals } from '../utils/styleTargets';
import { CARD_CLASS, MONO_VALUE_CLASS, METADATA_TEXT_CLASS } from './designSystem';

export interface StyleTargetPanelProps {
  bjcpStyleId: string | null;
  stats: CalculatedStats;
  onStyleChange: (bjcpStyleId: string | null) => void;
}

// Stable canonical order — matches evaluateStyleMatch's own ordering.
const VITAL_KEYS: readonly StyleVitalKey[] = ['og', 'fg', 'abv', 'ibu', 'srm'];

const VITAL_LABELS: Record<StyleVitalKey, string> = {
  og: 'Original Gravity',
  fg: 'Final Gravity',
  abv: 'ABV',
  ibu: 'IBU',
  srm: 'Color (SRM)',
};

// Binding verdict label mapping (RA-P3-5 / §2). `verdict === null` renders no
// verdict element at all.
const VERDICT_LABELS: Record<StyleMatchVerdict, string> = {
  full: 'Full Match',
  partial: 'Partial Match',
  none: 'No Match',
};

const NULL_STYLE_OPTION = { value: '', label: 'No BJCP Style' };

/** Formats a single vital value for display (SG 3dp, ABV %, IBU/SRM integer). */
function formatVital(key: StyleVitalKey, value: number): string {
  if (key === 'og' || key === 'fg') return value.toFixed(3);
  if (key === 'abv') return `${value.toFixed(1)}%`;
  if (key === 'ibu' || key === 'srm') return String(Math.round(value));
  return String(value);
}

const STATE_PILL_CLASS: Record<'in-range' | 'out-of-range' | 'unset', string> = {
  'in-range': 'text-emerald-400',
  'out-of-range': 'text-rose-400',
  unset: 'text-slate-400',
};

const STATE_LABEL: Record<'in-range' | 'out-of-range' | 'unset', string> = {
  'in-range': 'In range',
  'out-of-range': 'Out of range',
  unset: 'Unset',
};

export function StyleTargetPanel({ bjcpStyleId, stats, onStyleChange }: StyleTargetPanelProps) {
  // RA-P3-4: both memos recompute in the same render as any stats or style
  // change — App re-renders on every editor state change and passes fresh
  // props, so editing a gravity/ABV/IBU/color field flips the gauges live.
  const vitals = useMemo(() => statsToStyleVitals(stats), [stats]);
  const match = useMemo(() => evaluateStyleMatch(bjcpStyleId ?? '', vitals), [bjcpStyleId, vitals]);

  // 86 dataset options (dataset order) plus the leading '' -> null option.
  const options = useMemo(
    () => [
      NULL_STYLE_OPTION,
      ...BJCP_STYLES.map((style) => ({ value: style.id, label: `${style.id} — ${style.name}` })),
    ],
    [],
  );

  // Neutral state: no style selected, or the stored id is unknown to the
  // dataset (evaluateStyleMatch returns found:false). Never fabricate a
  // range, a match, or a verdict.
  const neutral = bjcpStyleId === null || bjcpStyleId === '' || match.found === false;

  return (
    <div className={`${CARD_CLASS} space-y-3`} data-testid="style-target-panel">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-200">BJCP Style Target</h3>
          <p className={`${METADATA_TEXT_CLASS} text-xs`}>
            Compare this recipe's live stats against the selected style's guideline ranges.
          </p>
        </div>
        <div className="w-56">
          <Select
            size="sm"
            aria-label="BJCP Style"
            value={bjcpStyleId ?? ''}
            options={options}
            onChange={(e) => onStyleChange(e.target.value === '' ? null : e.target.value)}
          />
        </div>
      </div>

      {neutral ? (
        <div data-testid="style-neutral" className="text-sm text-slate-400 py-1">
          Select a BJCP style to compare your recipe's live stats against its guideline ranges.
        </div>
      ) : (
        <div className="space-y-2" data-testid="style-gauges">
          {VITAL_KEYS.map((key) => {
            const vital = match.vitals[key];
            const inRange = vital.inRange;
            const state: 'in-range' | 'out-of-range' | 'unset' =
              inRange === null ? 'unset' : inRange ? 'in-range' : 'out-of-range';
            const shownValue =
              state === 'unset' ? '—' : vital.value === null ? '—' : formatVital(key, vital.value);
            const rangeText = `${formatVital(key, vital.low)} – ${formatVital(key, vital.high)}`;
            return (
              <div
                key={key}
                data-vital={key}
                data-state={state}
                className="flex items-center justify-between gap-3 py-1.5 border-b border-slate-800 last:border-0"
              >
                <span className="text-sm text-slate-300 w-36 flex-shrink-0">{VITAL_LABELS[key]}</span>
                <span className={`text-sm text-slate-400 ${MONO_VALUE_CLASS}`}>target {rangeText}</span>
                <span className={`font-semibold ${MONO_VALUE_CLASS} ${STATE_PILL_CLASS[state]} w-24 text-right`}>
                  {shownValue}
                </span>
                <span className={`text-xs font-medium w-24 text-right ${STATE_PILL_CLASS[state]}`}>
                  {STATE_LABEL[state]}
                </span>
              </div>
            );
          })}
          {match.verdict !== null && match.presentedCount > 0 && (
            <div
              data-testid="style-verdict"
              className={`pt-2 text-sm font-semibold ${
                match.verdict === 'full' ? 'text-emerald-400' : match.verdict === 'none' ? 'text-rose-400' : 'text-amber-400'
              }`}
            >
              {VERDICT_LABELS[match.verdict]}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
