import type { ReactNode } from 'react';

// Frozen, single value — no width variant. A second width is exactly the
// mechanism that produced BUG-005, so this primitive makes the inconsistent
// case unrepresentable (M5.5_P3 spec, Resolved Ambiguity 2). M5.5_P4/BUG-007
// explicitly supersedes P3's max-w-7xl value with a full-width one; the
// freeze-and-no-variant reasoning is retained, only the value changes.
//
// M13_P1 §3.1 — PageContainer is now the SOLE scroll owner of the app shell
// (`flex-1 overflow-y-auto min-w-0`). `pb-16` moved here from App.tsx's
// per-view wrapper div, which is no longer the scrolling ancestor (it is now
// `overflow-hidden`) — the bottom breathing room it used to reserve has to
// live on the element that actually scrolls.
export const PAGE_CONTAINER_CLASS = 'flex-1 overflow-y-auto min-w-0 w-full px-4 sm:px-6 lg:px-8 py-6 pb-16';

export interface PageContainerProps {
  children: ReactNode;
}

export function PageContainer({ children }: PageContainerProps) {
  return (
    <main data-testid="page-container" className={PAGE_CONTAINER_CLASS}>
      {children}
    </main>
  );
}
