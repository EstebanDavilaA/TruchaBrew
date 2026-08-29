import type { ReactNode } from 'react';
import { Menu } from 'lucide-react';
import { PAGE_TITLE_CLASS } from './designSystem';
import { Button } from './ui';

export interface TopBarProps {
  /**
   * When present, rendered as an <h1> — and on the five routes that pass it, it is the
   * SOLE <h1> of the shell. When ABSENT, TopBar renders NO heading element of any level
   * (see the two-route exception below); the bar itself, its chrome and its `leading`/
   * `children` slots still render.
   */
  title?: string;
  /** Optional lead control (e.g. the editor route's back-to-library arrow). */
  leading?: ReactNode;
  /** Optional search/filter slot, rendered between the lead group and the actions group. */
  search?: ReactNode;
  /** This route's contextual actions, right-aligned. Renders nothing when absent. */
  children?: ReactNode;
  /** Optional callback to open the mobile off-canvas navigation drawer (M26_P1). When
   * provided, a mobile-only (`md:hidden`) hamburger button renders in the leading slot,
   * ahead of `leading`. When omitted, no extra button renders (backward compatible). */
  onOpenMobileNav?: () => void;
}

export function TopBar({ title, leading, search, children, onOpenMobileNav }: TopBarProps) {
  return (
    <header className="bg-slate-900 border-b border-slate-800 flex-shrink-0 sticky top-0 z-30 h-auto md:h-16 shadow-md">
      <div
        data-testid="topbar-row"
        className="min-h-16 md:h-16 px-4 sm:px-6 lg:px-8 py-2 md:py-0 flex flex-wrap md:flex-nowrap items-center justify-between gap-x-4 gap-y-2"
      >
        <div data-testid="topbar-lead" className="flex items-center gap-3 min-w-0">
          {onOpenMobileNav && (
            <Button
              variant="secondary"
              size="sm"
              type="button"
              onClick={onOpenMobileNav}
              aria-label="Open navigation menu"
              className="md:hidden flex-shrink-0"
            >
              <Menu className="w-5 h-5" />
            </Button>
          )}
          {leading}
          {title !== undefined && (
            <h1 className={`${PAGE_TITLE_CLASS} truncate`}>{title}</h1>
          )}
        </div>
        {search && (
          <div data-testid="topbar-search" className="w-full order-last md:order-none md:flex-1 min-w-0 md:max-w-md">
            {search}
          </div>
        )}
        {children && (
          <div data-testid="topbar-actions" className="flex flex-wrap items-center justify-end gap-2 md:gap-3 flex-shrink-0 ml-auto">
            {children}
          </div>
        )}
      </div>
    </header>
  );
}
