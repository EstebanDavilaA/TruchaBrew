import type { BatchStatus } from '@truchabrew/shared-types';

/**
 * Cohesive design system constants (M13_P1 Amendment 1, spec §3.4).
 *
 * These are NOT a new aesthetic — each value is the already-dominant
 * convention found across the existing tree (spec §3.4, D-1), extracted into
 * one frozen, importable source so the app-shell/navigation/batch surface
 * this phase touches renders identically everywhere it appears. Constants
 * and type-only exports ONLY — no React components, no hooks, no side
 * effects (§2.2), following the frozen-constant precedent already set by
 * `PAGE_CONTAINER_CLASS` (PageContainer.tsx) and `LIST_CONTAINER_CLASS` /
 * `LIST_ROW_CLASS` (ListRow.tsx).
 */

// ---------------------------------------------------------------------------
// Surface / container primitives
// ---------------------------------------------------------------------------

export const CARD_CLASS = 'bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg';

/** Vertical rhythm between sibling cards. */
export const CARD_STACK_GAP_CLASS = 'space-y-6';

export const SUBPANEL_CLASS = 'bg-slate-800/80 p-3 rounded-lg border border-slate-700/60';

// ---------------------------------------------------------------------------
// Typography scale (M29_P1)
// ---------------------------------------------------------------------------

export const PAGE_TITLE_CLASS = 'text-xl md:text-2xl font-black text-white tracking-tight';
export const SECTION_HEADING_CLASS = 'text-lg font-semibold text-slate-100 flex items-center gap-2';
export const SUBSECTION_HEADING_CLASS = 'text-base font-bold text-white mb-2';
export const BODY_TEXT_CLASS = 'text-sm text-slate-300';
export const METADATA_TEXT_CLASS = 'text-xs text-slate-400';
export const MONO_VALUE_CLASS = 'font-mono tabular-nums tracking-tight';

// ---------------------------------------------------------------------------
// Control sizing (M40_P1 CONTROL_HEIGHT_CLASS; M40_P3 CONTROL_MIN_HEIGHT_CLASS
// / ICON_CONTROL_SIZE_CLASS)
//
// Declared ahead of the Buttons section (moved up from its original spot in
// "4. Form controls & settings rows" below) so BUTTON_*_CLASS can compose
// CONTROL_MIN_HEIGHT_CLASS / ICON_CONTROL_SIZE_CLASS via template literal —
// a `const` used before its module-evaluation-order declaration would throw
// a TDZ ReferenceError, so these three control-sizing tokens now live
// together as one block, ahead of every consumer. No value changes.
// ---------------------------------------------------------------------------

/** Fixed 44px height for controls whose content never wraps to a second
 * line (single-line inputs/selects). */
export const CONTROL_HEIGHT_CLASS = 'h-11';

/**
 * CONTROL_MIN_HEIGHT_CLASS is a 44px FLOOR, not a fixed height: applied to
 * text buttons, whose label can wrap to two lines at a narrow viewport
 * (e.g. "Advance to Fermentation" at 375px) — a fixed h-11 would clip the
 * second line, so min-h-11 lets the box grow while still guaranteeing
 * >=44px (M40_P3 RA-3).
 *
 * ICON_CONTROL_SIZE_CLASS is a fixed 44x44 square for icon-only controls:
 * a single glyph can never wrap, and both axes must be pinned — a
 * 44-tall/32-wide target still fails WCAG 2.5.5 (M40_P3 RA-2).
 */
export const CONTROL_MIN_HEIGHT_CLASS = 'min-h-11';
export const ICON_CONTROL_SIZE_CLASS = 'h-11 w-11';

// ---------------------------------------------------------------------------
// Buttons (M24_P1 / M29_P1; 44px height floor M40_P3)
// ---------------------------------------------------------------------------

export const BUTTON_PRIMARY_CLASS =
  `${CONTROL_MIN_HEIGHT_CLASS} bg-amber-600 hover:bg-amber-500 text-white font-medium px-4 py-2 rounded-lg transition-colors cursor-pointer disabled:opacity-50`;
export const BUTTON_SECONDARY_CLASS =
  `${CONTROL_MIN_HEIGHT_CLASS} bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium px-4 py-2 rounded-lg border border-slate-700 transition-colors cursor-pointer disabled:opacity-50`;
export const BUTTON_DANGER_CLASS =
  `${CONTROL_MIN_HEIGHT_CLASS} bg-rose-950/80 hover:bg-rose-900 text-rose-200 font-semibold px-3 py-2 rounded-lg border border-rose-800 transition-colors cursor-pointer disabled:opacity-40`;
export const BUTTON_ICON_CLASS =
  `${ICON_CONTROL_SIZE_CLASS} p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-40`;

// ---------------------------------------------------------------------------
// 4. Form controls & settings rows
// ---------------------------------------------------------------------------

export const FORM_LABEL_CLASS = 'block text-xs font-semibold text-slate-400 mb-1';

export const INPUT_CLASS =
  'bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-amber-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500';

export const INPUT_COMPACT_CLASS =
  'bg-slate-800 border border-slate-700 rounded px-2.5 py-1 text-xs text-slate-100 placeholder-slate-500 focus:border-amber-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500';

// Underline (inline metadata) style — matches the recipe-builder title block's
// pre-existing raw inputs (recipe name / style / brewer): transparent, no box,
// a bottom border that appears amber on hover/focus. Used by Input
// variant="underline" (e.g. the recipe editor's Folder / Add-tag fields).
// NOTE: the outline-removal focus utility is deliberately NOT part of this
// token (design governance, M30_P2 AC-14/15 — the literal class string is
// banned from this file); callers that want the underline to suppress the
// default focus ring in favor of the amber bottom border append it inline at
// the usage site, exactly as the pre-existing title inputs do.
export const INPUT_UNDERLINE_CLASS =
  'bg-transparent border-b border-transparent hover:border-slate-700 focus:border-amber-500 text-slate-300 placeholder-slate-500';

export const FORM_SELECT_CLASS =
  'bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:border-amber-500 font-medium disabled:opacity-50 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500';

export const FORM_SELECT_COMPACT_CLASS =
  'bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 focus:border-amber-500 font-medium cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500';

export const SETTINGS_ROW_CLASS =
  'py-3.5 px-4 flex items-center justify-between gap-4';

// ---------------------------------------------------------------------------
// Metric tile (identity + primary numbers)
// ---------------------------------------------------------------------------

/** === SUBPANEL_CLASS (§3.4.1). */
export const METRIC_TILE_CLASS = SUBPANEL_CLASS;
export const METRIC_LABEL_CLASS = 'text-xs text-slate-400 font-medium mb-1';
export const METRIC_VALUE_CLASS = 'text-2xl font-extrabold tracking-tight';

// ---------------------------------------------------------------------------
// State conventions
// ---------------------------------------------------------------------------

export const EMPTY_STATE_CLASS = 'bg-slate-900 border border-slate-800 rounded-xl p-10 text-center text-slate-400';
/** === EMPTY_STATE_CLASS (same shell; copy differs — §3.4.5). */
export const LOADING_STATE_CLASS = EMPTY_STATE_CLASS;
export const ERROR_STATE_CLASS = 'bg-rose-950/60 border border-rose-800 rounded-lg px-4 py-3 text-sm text-rose-200';

// ---------------------------------------------------------------------------
// Status badge — SINGLE source of truth for the whole app (§3.4.1)
// ---------------------------------------------------------------------------

export const STATUS_BADGE_WRAPPER_CLASS = 'px-2.5 py-0.5 rounded-full text-xs font-medium border';

/**
 * Colour-only (no `border` keyword — the wrapper supplies it). Typed
 * `Record<BatchStatus, string>` (not partial, not an index signature) so a
 * future `BatchStatus` member fails typecheck rather than silently falling
 * through (§3.4.1).
 */
export const STATUS_BADGE_CLASS: Record<BatchStatus, string> = {
  Planning: 'bg-amber-900/40 text-amber-300 border-amber-500/30',
  Brewing: 'bg-blue-900/40 text-blue-300 border-blue-500/30',
  Fermenting: 'bg-emerald-900/40 text-emerald-300 border-emerald-500/30',
  Conditioning: 'bg-purple-900/40 text-purple-300 border-purple-500/30',
  Completed: 'bg-slate-700/40 text-slate-300 border-slate-500/30',
};

export type SemanticBadgeVariant =
  | 'neutral'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'amber'
  | 'emerald'
  | 'rose'
  | 'sky'
  | 'slate';

export const SEMANTIC_BADGE_CLASS: Record<SemanticBadgeVariant, string> = {
  neutral: 'bg-slate-800 text-slate-300 border-slate-700',
  slate: 'bg-slate-800 text-slate-300 border-slate-700',
  success: 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60',
  emerald: 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60',
  warning: 'bg-amber-950/60 text-amber-300 border-amber-800/60',
  amber: 'bg-amber-950/60 text-amber-300 border-amber-800/60',
  danger: 'bg-rose-950/60 text-rose-300 border-rose-800/60',
  rose: 'bg-rose-950/60 text-rose-300 border-rose-800/60',
  info: 'bg-sky-950/60 text-sky-300 border-sky-800/60',
  sky: 'bg-sky-950/60 text-sky-300 border-sky-800/60',
};

// ---------------------------------------------------------------------------
// Tables (M35_P1)
// ---------------------------------------------------------------------------

export const TABLE_CLASS = 'w-full border-collapse';

export const TABLE_HEADER_CELL_CLASS =
  'text-left text-[11px] uppercase tracking-wide text-slate-400 font-semibold py-1.5 px-2';

// module-private — NOT exported; invisible to designTokens.test.ts AC-7's
// Object.keys sweep. TABLE_CELL_CLASS below is recomposed from this base but
// its VALUE is unchanged, byte for byte (M35_P2 RA-4).
const TABLE_CELL_BASE_CLASS = 'text-slate-200 py-1.5 px-2 border-t border-slate-800';

export const TABLE_CELL_CLASS = `text-sm ${TABLE_CELL_BASE_CLASS} font-mono tabular-nums`;
export const TABLE_CELL_TEXT_CLASS = `text-sm ${TABLE_CELL_BASE_CLASS}`;
export const TABLE_CELL_SM_CLASS = `text-xs ${TABLE_CELL_BASE_CLASS} font-mono tabular-nums`;
export const TABLE_CELL_SM_TEXT_CLASS = `text-xs ${TABLE_CELL_BASE_CLASS}`;

// ---------------------------------------------------------------------------
// Water Calculator ion tiles (M37_P2 Amendment 1, §1.3)
// ---------------------------------------------------------------------------

/** Inner tile used by the WaterCalculatorModal ion target-match grid. */
export const ION_TILE_CLASS = 'p-2 rounded-lg bg-slate-950/50 border border-slate-800/70';
