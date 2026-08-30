import { useState } from 'react';
import type { CellarScheduleEvent } from '@truchabrew/calculations';
import {
  CARD_CLASS,
  SECTION_HEADING_CLASS,
  EMPTY_STATE_CLASS,
} from './designSystem';
import { Badge } from './ui';
import {
  CheckCircle2,
  Circle,
  Thermometer,
  Sparkles,
  Gauge,
  FlaskConical,
  Clock,
  Calendar,
} from 'lucide-react';

export interface CellarActionFeedProps {
  events: CellarScheduleEvent[];
  onMarkDone: (event: CellarScheduleEvent) => Promise<void> | void;
  fermentationStartDate: string | null;
  disabled?: boolean;
}

function getEventIcon(type: CellarScheduleEvent['type']) {
  switch (type) {
    case 'dry_hop_add':
    case 'dry_hop_remove':
      return <Sparkles className="w-4 h-4 text-emerald-400" />;
    case 'temperature_step':
      return <Thermometer className="w-4 h-4 text-amber-400" />;
    case 'pressure_target':
      return <Gauge className="w-4 h-4 text-sky-400" />;
    case 'misc_addition':
      return <FlaskConical className="w-4 h-4 text-purple-400" />;
    default:
      return <Clock className="w-4 h-4 text-slate-400" />;
  }
}

export function CellarActionFeed({
  events,
  onMarkDone,
  fermentationStartDate,
  disabled = false,
}: CellarActionFeedProps) {
  const [markingId, setMarkingId] = useState<string | null>(null);

  if (events.length === 0) {
    return (
      <div className={CARD_CLASS} data-testid="cellar-action-feed">
        <h3 className={SECTION_HEADING_CLASS}>Cellar Schedule &amp; Actions</h3>
        <p className="mt-1 text-sm text-slate-400">
          Scheduled dry hops, temperature steps, and cellar actions.
        </p>
        <div className={`${EMPTY_STATE_CLASS} mt-3`}>
          No scheduled cellar actions for this recipe.
        </div>
      </div>
    );
  }

  const completedCount = events.filter((e) => e.isCompleted).length;
  const pendingCount = events.length - completedCount;

  const handleActionClick = async (event: CellarScheduleEvent) => {
    if (event.isCompleted || disabled) return;
    setMarkingId(event.id);
    try {
      await onMarkDone(event);
    } finally {
      setMarkingId(null);
    }
  };

  return (
    <div className={CARD_CLASS} data-testid="cellar-action-feed">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className={SECTION_HEADING_CLASS}>Cellar Schedule &amp; Actions</h3>
          <p className="mt-1 text-sm text-slate-400">
            Proactive timeline for dry-hop additions, temperature ramps, and cellar adjustments.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <Badge variant="neutral">
            {pendingCount} Pending
          </Badge>
          <Badge variant="success">
            {completedCount} Completed
          </Badge>
        </div>
      </div>

      {!fermentationStartDate && (
        <div className="mt-3 p-3 bg-amber-950/40 border border-amber-800/60 rounded-lg text-xs text-amber-300 flex items-center gap-2">
          <Calendar className="w-4 h-4 flex-shrink-0" />
          <span>
            Fermentation has not started yet. Schedule displays relative days from pitch day.
          </span>
        </div>
      )}

      <div className="mt-4 space-y-2.5" data-testid="cellar-action-list">
        {events.map((event) => {
          const isBusy = markingId === event.id;
          const isOverdue =
            !event.isCompleted &&
            event.targetTimestamp !== null &&
            Date.parse(event.targetTimestamp) < Date.now();

          return (
            <div
              key={event.id}
              data-testid={`cellar-event-${event.id}`}
              className={`p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                event.isCompleted
                  ? 'bg-slate-900/40 border-slate-800/60 opacity-75'
                  : isOverdue
                  ? 'bg-rose-950/20 border-rose-900/40'
                  : 'bg-slate-800/50 border-slate-700/60 hover:border-slate-600'
              }`}
            >
              <div className="flex items-start gap-3 min-w-0">
                <div className="p-2 rounded-lg bg-slate-800 border border-slate-700 flex-shrink-0 mt-0.5 sm:mt-0">
                  {getEventIcon(event.type)}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`text-sm font-semibold ${
                        event.isCompleted ? 'text-slate-400 line-through' : 'text-slate-100'
                      }`}
                    >
                      {event.title}
                    </span>
                    <Badge variant="neutral" size="sm">
                      {event.type === 'temperature_step' && event.durationDays && event.durationDays > 0
                        ? `Day ${event.dayOffset}–${event.dayOffset + event.durationDays}`
                        : `Day ${event.dayOffset}`}
                    </Badge>
                    {event.isCompleted && (
                      <Badge variant="success" size="sm">
                        Done
                      </Badge>
                    )}
                    {!event.isCompleted && isOverdue && (
                      <Badge variant="danger" size="sm">
                        {event.type === 'temperature_step' ? 'Concluded / Due' : 'Due'}
                      </Badge>
                    )}
                    {!event.isCompleted && !isOverdue && event.type === 'temperature_step' && event.durationDays && event.durationDays > 0 && (
                      <Badge variant="info" size="sm">
                        In Progress
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{event.description}</p>
                  {event.targetTimestamp && (
                    <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-1">
                      <Clock className="w-3 h-3" />
                      <span>
                        {event.type === 'temperature_step' && event.durationDays && event.durationDays > 0 ? 'Concludes: ' : 'Target: '}
                        {new Date(event.targetTimestamp).toLocaleString()}
                      </span>
                      {event.completedAt && (
                        <span> · Logged: {new Date(event.completedAt).toLocaleTimeString()}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex-shrink-0 self-end sm:self-center">
                {event.isCompleted ? (
                  <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-medium px-3 py-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    Completed
                  </span>
                ) : (
                  <button
                    type="button"
                    data-testid={`mark-done-btn-${event.id}`}
                    disabled={disabled || isBusy}
                    onClick={() => handleActionClick(event)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold bg-slate-800 hover:bg-emerald-600/90 text-slate-200 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed border border-slate-700 hover:border-emerald-500 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                  >
                    {isBusy ? (
                      'Marking…'
                    ) : (
                      <>
                        <Circle className="w-3.5 h-3.5" />
                        {event.type === 'temperature_step' ? 'Complete Step' : 'Mark Done'}
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
