import type { KeyboardEvent, ReactNode } from 'react';

// Frozen, single value — the wrapper for a list of ListRow items. Full-width,
// no grid, hairline dividers instead of gaps between rows (M5.5_P4 spec §2.2).
export const LIST_CONTAINER_CLASS = 'w-full border border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-800';

// Frozen, single value — the row root. Dense (py-3, not p-4), no card chrome
// of its own (rounding/shadow/border live on the container), directly
// clickable (M5.5_P4 spec §2.2).
export const LIST_ROW_CLASS =
  'w-full flex items-center justify-between gap-4 py-3 px-4 text-left cursor-pointer bg-slate-900 hover:bg-slate-800/70 transition-colors';

export interface ListRowProps {
  /** Stable test hook, e.g. `equipment-row-<id>`. Rendered as data-testid on the root. */
  testId: string;
  /** Accessible label for the row's open action, e.g. `Open "All-Grain 20L System"`. */
  label: string;
  /** Primary line — the entity name. */
  primary: ReactNode;
  /** Secondary dense metadata line. May be omitted. */
  meta?: ReactNode;
  /** Right-aligned nested controls. Each MUST stopPropagation in its own handler. */
  trailing?: ReactNode;
  /** Fired on click, Enter, or Space on the row root. */
  onOpen: () => void;
}

export function ListRow({ testId, label, primary, meta, trailing, onOpen }: ListRowProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter') {
      onOpen();
    } else if (event.key === ' ') {
      event.preventDefault();
      onOpen();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      data-testid={testId}
      aria-label={label}
      className={LIST_ROW_CLASS}
      onClick={onOpen}
      onKeyDown={handleKeyDown}
    >
      <div className="min-w-0 flex-1">
        <div className="font-bold text-slate-100 truncate">{primary}</div>
        {meta !== undefined && (
          <div className="text-xs text-slate-400 mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">{meta}</div>
        )}
      </div>
      {trailing !== undefined && <div className="flex items-center gap-2 flex-shrink-0">{trailing}</div>}
    </div>
  );
}
