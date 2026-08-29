import { useRef, type KeyboardEvent } from 'react';
import type { BatchStatus } from '@truchabrew/shared-types';
import { Check } from 'lucide-react';

export type BatchStageTab = 'planning' | 'brewing' | 'fermentation' | 'packaging' | 'completed';

export interface BatchStageTabsProps {
  activeTab: BatchStageTab;
  currentStatus: BatchStatus;
  onSelectTab: (tab: BatchStageTab) => void;
}

const TAB_ORDER: readonly BatchStageTab[] = ['planning', 'brewing', 'fermentation', 'packaging', 'completed'];

const TAB_LABEL: Record<BatchStageTab, string> = {
  planning: 'Planning',
  brewing: 'Brewing',
  fermentation: 'Fermentation',
  packaging: 'Packaging',
  completed: 'Completed',
};

/**
 * M29_P4 (MAJ-03) — horizontal lifecycle stage stepper. Pure view state:
 * switching stages never mutates or implies batch status, issues zero
 * network calls, and never calls a status mutator — carried over unchanged
 * from the prior tab-bar version (M13_P1 Amendment 1). `currentStatus` is
 * accepted per the contract but intentionally never read for styling; a
 * step's "completed" / "active" / "future" visual state is derived purely
 * from its position relative to the currently SELECTED tab (`activeTab`),
 * not from the batch's real persisted status — status identity is rendered
 * via `STATUS_BADGE_CLASS` elsewhere.
 */
export function BatchStageTabs({ activeTab, currentStatus, onSelectTab }: BatchStageTabsProps) {
  void currentStatus;

  const buttonRefs = useRef<Partial<Record<BatchStageTab, HTMLButtonElement | null>>>({});
  const activeIndex = TAB_ORDER.indexOf(activeTab);

  const selectByIndex = (index: number) => {
    const tab = TAB_ORDER[index];
    onSelectTab(tab);
    buttonRefs.current[tab]?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    switch (event.key) {
      case 'ArrowRight':
      case 'Right':
        event.preventDefault();
        selectByIndex((index + 1) % TAB_ORDER.length);
        break;
      case 'ArrowLeft':
      case 'Left':
        event.preventDefault();
        selectByIndex((index - 1 + TAB_ORDER.length) % TAB_ORDER.length);
        break;
      case 'Home':
        event.preventDefault();
        selectByIndex(0);
        break;
      case 'End':
        event.preventDefault();
        selectByIndex(TAB_ORDER.length - 1);
        break;
      default:
        break;
    }
  };

  return (
    <div role="tablist" aria-label="Batch lifecycle stage" className="flex items-center border-b border-slate-800">
      {TAB_ORDER.map((tab, index) => {
        const isActive = tab === activeTab;
        const isCompleted = index < activeIndex;
        const isLast = index === TAB_ORDER.length - 1;

        return (
          <div key={tab} className={`flex items-center ${isLast ? '' : 'flex-1'}`}>
            <button
              type="button"
              role="tab"
              ref={(el) => {
                buttonRefs.current[tab] = el;
              }}
              aria-selected={isActive}
              aria-current={isActive ? 'step' : undefined}
              tabIndex={isActive ? 0 : -1}
              data-testid={`batch-tab-${tab}`}
              onClick={() => onSelectTab(tab)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              className={`flex flex-col items-center gap-1.5 px-2 sm:px-3 py-2.5 text-[11px] sm:text-xs font-semibold rounded-t-lg transition-all cursor-pointer ${
                isActive
                  ? 'text-amber-400'
                  : isCompleted
                    ? 'text-emerald-400 hover:text-emerald-300'
                    : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              <span
                className={`flex items-center justify-center w-7 h-7 rounded-full border-2 text-[11px] font-bold transition-all ${
                  isActive
                    ? 'bg-amber-500/10 border-amber-400 text-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.55)]'
                    : isCompleted
                      ? 'bg-emerald-500/10 border-emerald-500/70 text-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.35)]'
                      : 'bg-slate-800 border-slate-700 text-slate-400'
                }`}
              >
                {isCompleted ? <Check className="w-3.5 h-3.5" /> : index + 1}
              </span>
              <span className="hidden sm:inline whitespace-nowrap">{TAB_LABEL[tab]}</span>
            </button>
            {!isLast && (
              <div
                className={`h-0.5 flex-1 mx-0.5 sm:mx-1 rounded-full transition-colors ${
                  index < activeIndex ? 'bg-emerald-500/60' : 'bg-slate-800'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
