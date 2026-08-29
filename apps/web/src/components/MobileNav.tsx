import { useRef } from 'react';
import { Beer, X } from 'lucide-react';
import { NAV_SECTIONS, NAV_ICONS, activeDestinationFor, type NavDestination } from './Sidebar';
import { useModalA11y } from './Modal';

export interface MobileNavProps {
  /** Whether the mobile off-canvas drawer is open. */
  readonly isOpen: boolean;
  /** Callback fired to close the mobile drawer. */
  readonly onClose: () => void;
  /** Active view to determine the highlighted nav destination. */
  readonly activeView: string;
  /** Callback fired when a navigation item is selected. */
  readonly onNavigate: (destination: NavDestination) => void;
}

/**
 * Off-canvas mobile navigation drawer (M26_P1 / M28_P1). Conditionally mounted only
 * when `isOpen === true` — returns `null` otherwise (RA-2), avoiding
 * duplicate interactive nav elements alongside the desktop <Sidebar> in
 * JSDOM / for screen readers. Reuses `useModalA11y` (RA-3) for focus
 * trapping, Escape dismissal, and focus restoration to the opener.
 * Renders navigation items grouped under Brew and Library section headers (M28_P1).
 */
export function MobileNav({ isOpen, onClose, activeView, onNavigate }: MobileNavProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useModalA11y({ isOpen, onClose, containerRef });

  if (!isOpen) return null;

  const activeDestination = activeDestinationFor(activeView as Parameters<typeof activeDestinationFor>[0]);

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget) return;
    onClose();
  }

  function handleNavigate(destination: NavDestination) {
    onNavigate(destination);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex"
      onClick={handleBackdropClick}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Mobile navigation"
        tabIndex={-1}
        className="w-72 max-w-[85vw] h-full bg-slate-900 border-r border-slate-800 flex flex-col shadow-2xl"
      >
        <div className="flex items-center justify-between gap-3 h-16 px-4 border-b border-slate-800 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="bg-amber-500/10 p-2 rounded-lg border border-amber-500/20 flex-shrink-0">
              <Beer className="w-6 h-6 text-amber-500" />
            </div>
            <span className="text-lg font-extrabold text-white tracking-wide">TruchaBrew</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="text-slate-400 hover:text-white hover:bg-slate-800 p-2 rounded-lg transition-colors cursor-pointer flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-3 flex flex-col gap-1 px-2">
          {NAV_SECTIONS.map((section) => (
            <div key={section.title} className="flex flex-col gap-1">
              <div className="px-3 pt-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400 select-none">
                {section.title}
              </div>
              <ul className="flex flex-col gap-1">
                {section.items.map((item) => {
                  const Icon = NAV_ICONS[item.destination];
                  const isActive = item.destination === activeDestination;
                  return (
                    <li key={item.destination}>
                      <button
                        type="button"
                        onClick={() => handleNavigate(item.destination)}
                        aria-label={item.label}
                        aria-current={isActive ? 'page' : undefined}
                        className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors cursor-pointer ${
                          isActive
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                            : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-transparent'
                        }`}
                      >
                        <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-amber-400' : 'text-amber-500'}`} />
                        <span>{item.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
