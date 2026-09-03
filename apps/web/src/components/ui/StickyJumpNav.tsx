export interface StickyJumpNavItem {
  /** Must exactly equal a SectionCard `id` on the same page. Required. */
  id: string;
  /** Visible label. Required. */
  label: string;
}

export interface StickyJumpNavProps {
  /** Ordered items; empty array ⇒ renders null. */
  items: readonly StickyJumpNavItem[];
  /** Controlled active id. Undefined/''/no-match ⇒ no item highlighted. */
  activeId?: string;
  /** Called with the clicked item's id after a click. Optional. */
  onNavigate?: (id: string) => void;
  /** Passthrough onto the root <nav>. Optional. */
  className?: string;
}

/**
 * Deterministic. Returns the index of the first item whose `id === activeId`,
 * else -1 (including when activeId is undefined/'' or items is empty).
 */
export function resolveActiveIndex(
  items: readonly StickyJumpNavItem[],
  activeId: string | undefined,
): number {
  if (activeId === undefined || activeId === '') return -1;
  return items.findIndex((item) => item.id === activeId);
}

// Module-local structural constants (design-token governance: no new
// designSystem.ts tokens — this sticky bar has a single default placement).
// M39_P2 Amendment 2 / RA-7: the sticky offset is `top-0` (flush under the
// app header), NOT `top-16`. The app shell is `h-screen overflow-hidden`; the
// TopBar is a static flex header ABOVE the sole scroll-owning
// `<main data-testid="page-container">` (`flex-1 overflow-y-auto`), so a
// sticky bar rendered inside that main needs `top-0` to stick flush at the top
// of the content column directly under the header. `top-16` left a 64 px gap
// that made the bar float over sections mid-content. Pages may tune placement
// via className if a variant placement is ever needed.
const STICKY_BAR_CLASS =
  'sticky top-0 z-20 flex flex-wrap items-center gap-2 bg-slate-900/90 backdrop-blur px-4 py-2 border-b border-slate-800';
const NAV_ITEM_CLASS =
  'px-3 py-1.5 rounded-lg text-sm font-medium text-slate-300 hover:text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer';
const NAV_ITEM_ACTIVE_CLASS = 'bg-amber-600/20 text-amber-300';

export function StickyJumpNav({
  items,
  activeId,
  onNavigate,
  className,
}: StickyJumpNavProps) {
  if (items.length === 0) return null;

  const activeIndex = resolveActiveIndex(items, activeId);

  const handleClick = (id: string) => {
    onNavigate?.(id);
    const target = document.getElementById(id);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <nav
      data-testid="jump-nav"
      aria-label="Section navigation"
      className={[STICKY_BAR_CLASS, className].filter(Boolean).join(' ')}
    >
      {items.map((item, index) => {
        const isActive = index === activeIndex;
        return (
          <button
            key={item.id}
            type="button"
            data-testid={`jump-${item.id}`}
            aria-current={isActive ? 'true' : undefined}
            onClick={() => handleClick(item.id)}
            className={
              isActive ? `${NAV_ITEM_CLASS} ${NAV_ITEM_ACTIVE_CLASS}` : NAV_ITEM_CLASS
            }
          >
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}
