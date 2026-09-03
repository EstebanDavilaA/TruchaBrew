import { Beer, Settings, Thermometer, Snowflake, Droplets, Boxes, ChevronsLeft, ChevronsRight, Calculator, Package } from 'lucide-react';

// NEW in M7_P1 — 'settings' added to reach the Settings page (Key Behavior
// 5: "Settings view accessible via sidebar/topbar"). Sidebar.tsx is not on
// the M7_P1 spec §1.3 Modified-files table; this is a forced, narrow
// exception (one NavDestination + one NAV_ITEM + one icon-map entry + one
// activeDestinationFor case) — the sidebar is this app's sole persistent
// navigation surface (established by M5.5_P1), so Key Behavior 5 cannot be
// satisfied from App.tsx alone. Flagged for critic attention.
export type NavDestination =
  | 'list'
  | 'equipment'
  | 'mashProfiles'
  | 'fermentationProfiles'
  | 'waterProfiles'
  | 'batches'
  | 'inventory'
  | 'settings'
  | 'calculators';

export interface NavItem {
  readonly destination: NavDestination;
  readonly label: string;
}

export interface NavSection {
  readonly title: string;
  readonly items: readonly NavItem[];
}

/** Grouped navigation clusters (M28_P1): Brew (operational) and Library (reference/configuration). */
// constant table co-located with Sidebar by design; not a component export.
// oxlint-disable-next-line react/only-export-components
export const NAV_SECTIONS: readonly NavSection[] = [
  {
    title: 'Brew',
    items: [
      { destination: 'list', label: 'Recipes' },
      { destination: 'batches', label: 'Batches' },
      { destination: 'inventory', label: 'Inventory' },
      { destination: 'calculators', label: 'Calculators' },
    ],
  },
  {
    title: 'Library',
    items: [
      { destination: 'equipment', label: 'Equipment Profiles' },
      { destination: 'mashProfiles', label: 'Mash Profiles' },
      { destination: 'fermentationProfiles', label: 'Fermentation Profiles' },
      { destination: 'waterProfiles', label: 'Water Profiles' },
      { destination: 'settings', label: 'Settings' },
    ],
  },
];

/** Flat array of all 9 items in canonical order matching NAV_SECTIONS. */
// constant table co-located with Sidebar by design; not a component export.
// oxlint-disable-next-line react/only-export-components
export const NAV_ITEMS: readonly NavItem[] = NAV_SECTIONS.flatMap((s) => s.items);

// exported for reuse by MobileNav.tsx (M26_P1 RA-5); constant table, not a component.
// oxlint-disable-next-line react/only-export-components
export const NAV_ICONS: Record<NavDestination, typeof Beer> = {
  list: Boxes,
  equipment: Settings,
  mashProfiles: Thermometer,
  fermentationProfiles: Snowflake,
  waterProfiles: Droplets,
  batches: Beer,
  inventory: Package,
  settings: Settings,
  calculators: Calculator,
};

// exported for reuse by routes/paths.ts's `viewForPath` return type (M27_P1 RA-18).
// oxlint-disable-next-line react/only-export-components
export type ActiveView =
  | 'list'
  | 'editor'
  | 'equipment'
  | 'mashProfiles'
  | 'fermentationProfiles'
  | 'waterProfiles'
  | 'batches'
  | 'batchDetail'
  | 'inventory'
  | 'settings'
  | 'calculators';

/** Total mapping from every View to the NavDestination it marks active. */
// exported for reuse by MobileNav.tsx (M26_P1 RA-5); a pure function, not a component.
// oxlint-disable-next-line react/only-export-components
export function activeDestinationFor(view: ActiveView): NavDestination {
  if (view === 'list' || view === 'editor') return 'list';
  if (view === 'batches' || view === 'batchDetail') return 'batches';
  return view;
}

export interface SidebarProps {
  /** The current route. All seven View values are accepted; the mapping to an active NavItem is total. */
  activeView: ActiveView;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  /** Sidebar performs no navigation itself and holds no route state. */
  onNavigate: (destination: NavDestination) => void;
}

export function Sidebar({ activeView, collapsed, onToggleCollapsed, onNavigate }: SidebarProps) {
  const activeDestination = activeDestinationFor(activeView);

  return (
    <nav
      className={`hidden md:flex ${collapsed ? 'w-16' : 'w-60'} h-full flex-shrink-0 bg-slate-900 border-r border-slate-800 flex-col transition-[width] duration-150`}
    >
      <div className={`flex items-center gap-3 h-16 px-4 border-b border-slate-800 flex-shrink-0 ${collapsed ? 'justify-center px-0' : ''}`}>
        <div className="bg-amber-500/10 p-2 rounded-lg border border-amber-500/20 flex-shrink-0">
          <Beer className="w-6 h-6 text-amber-500" />
        </div>
        {!collapsed && <span className="text-lg font-extrabold text-white tracking-wide">TruchaBrew</span>}
      </div>

      <div className="flex-1 overflow-y-auto py-3 flex flex-col gap-1 px-2">
        {NAV_SECTIONS.map((section, sIdx) => (
          <div key={section.title} className="flex flex-col gap-1">
            {collapsed ? (
              sIdx > 0 && <div className="my-1 border-t border-slate-800 mx-2" role="separator" aria-hidden="true" />
            ) : (
              <div className="px-3 pt-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400 select-none">
                {section.title}
              </div>
            )}
            <ul className="flex flex-col gap-1">
              {section.items.map((item) => {
                const Icon = NAV_ICONS[item.destination];
                const isActive = item.destination === activeDestination;
                return (
                  <li key={item.destination}>
                    <button
                      type="button"
                      onClick={() => onNavigate(item.destination)}
                      aria-label={item.label}
                      aria-current={isActive ? 'page' : undefined}
                      title={collapsed ? item.label : undefined}
                      className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors cursor-pointer ${
                        collapsed ? 'justify-center px-0' : ''
                      } ${
                        isActive
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                          : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-transparent'
                      }`}
                    >
                      <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-amber-400' : 'text-amber-500'}`} />
                      {!collapsed && <span>{item.label}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <div className={`border-t border-slate-800 p-2 flex-shrink-0 ${collapsed ? 'flex justify-center' : ''}`}>
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          aria-expanded={!collapsed}
          className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors cursor-pointer ${
            collapsed ? 'justify-center px-0' : 'w-full'
          }`}
        >
          {collapsed ? <ChevronsRight className="w-4 h-4" /> : <ChevronsLeft className="w-4 h-4" />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </nav>
  );
}
