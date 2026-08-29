import type { BrewDayTimelineModel, BrewDayStageKey } from '@truchabrew/calculations';
import { Check } from 'lucide-react';

const STAGE_LABELS: Record<BrewDayStageKey, string> = {
  prep: 'Preparation',
  mash: 'Mash',
  boil: 'Boil',
  hopstand: 'Hop Stand',
};

const STAGE_SHORT_LABELS: Record<BrewDayStageKey, string> = {
  prep: 'Prep',
  mash: 'Mash',
  boil: 'Boil',
  hopstand: 'Hop Stand',
};

export interface BrewDayTimelineBarProps {
  model: BrewDayTimelineModel;
  activeStageIndex: number;
  onSelectStage: (index: number) => void;
}

/**
 * Two-tier continuous brew-day timeline (Option 1).
 * Upper row: Clickable stage tab buttons with active & completed visual states.
 * Lower track: Proportional segmented progress bar with accurately positioned milestone dots.
 */
export function BrewDayTimelineBar({ model, activeStageIndex, onSelectStage }: BrewDayTimelineBarProps) {
  return (
    <div className="mb-5 space-y-2">
      {/* Upper Tier: Stage Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {model.segments.map((seg, idx) => {
          const isActive = idx === activeStageIndex;
          const isCompleted = idx < activeStageIndex;

          return (
            <button
              key={`tab-${seg.stage}`}
              type="button"
              data-testid={`brew-day-stage-tab-${idx}`}
              onClick={() => onSelectStage(idx)}
              className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs font-semibold cursor-pointer transition-all ${
                isActive
                  ? 'bg-amber-950/40 border-amber-500/80 text-amber-300 shadow-sm ring-1 ring-amber-500/30'
                  : isCompleted
                    ? 'bg-slate-900/90 border-slate-800 text-emerald-400 hover:bg-slate-900'
                    : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:bg-slate-900 hover:text-slate-200'
              }`}
            >
              <span className="flex items-center gap-1.5 truncate">
                <span
                  className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    isActive
                      ? 'bg-amber-500 text-slate-950'
                      : isCompleted
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {isCompleted ? <Check className="w-2.5 h-2.5" /> : idx + 1}
                </span>
                <span className="truncate">{idx + 1}. {STAGE_SHORT_LABELS[seg.stage]}</span>
              </span>

              {isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />
              )}
            </button>
          );
        })}
      </div>

      {/* Lower Tier: Continuous Proportional Progress Track */}
      <div
        data-testid="brew-day-timeline-bar"
        className="relative w-full h-3 rounded-full overflow-hidden flex bg-slate-950 border border-slate-800"
      >
        {model.segments.map((seg, idx) => {
          const isActive = idx === activeStageIndex;
          const isCompleted = idx < activeStageIndex;

          return (
            <button
              key={seg.stage}
              type="button"
              data-testid={`brew-day-stage-${seg.stage}`}
              onClick={() => onSelectStage(idx)}
              style={{ width: `${seg.widthFraction * 100}%` }}
              title={`${idx + 1}. ${STAGE_LABELS[seg.stage]}`}
              aria-label={`${idx + 1}. ${STAGE_LABELS[seg.stage]}`}
              className={`h-full cursor-pointer transition-colors relative border-r border-slate-950/60 last:border-r-0 ${
                isActive
                  ? 'bg-amber-600'
                  : isCompleted
                    ? 'bg-emerald-500/60 hover:bg-emerald-500/80'
                    : 'bg-slate-800/80 hover:bg-slate-700'
              }`}
            >
              <span className="sr-only">{idx + 1}. {STAGE_LABELS[seg.stage]}</span>
            </button>
          );
        })}
        <div className="absolute inset-0 pointer-events-none" data-testid="brew-day-timeline-milestones">
          {model.milestones.map((m) => (
            <span
              key={m.id}
              data-testid={`brew-day-milestone-${m.id}`}
              title={m.label}
              aria-label={m.label}
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-white border border-slate-950 shadow"
              style={{ left: `${Math.min(100, Math.max(0, m.position * 100))}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

