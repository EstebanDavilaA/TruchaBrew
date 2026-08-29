import type { NavDestination, ActiveView } from '../components/Sidebar';

/**
 * Literal path constants for every static (non-parameterized) route (§1.2).
 * Pure module: no React imports beyond types.
 */
export const ROUTE_PATHS = {
  root: '/',
  recipes: '/recipes',
  recipeNew: '/recipes/new',
  batches: '/batches',
  equipment: '/equipment',
  mashProfiles: '/profiles/mash',
  fermentationProfiles: '/profiles/fermentation',
  waterProfiles: '/profiles/water',
  inventory: '/inventory',
  settings: '/settings',
  calculators: '/calculators',
} as const;

const DESTINATION_TO_PATH: Record<NavDestination, string> = {
  list: ROUTE_PATHS.recipes,
  equipment: ROUTE_PATHS.equipment,
  mashProfiles: ROUTE_PATHS.mashProfiles,
  fermentationProfiles: ROUTE_PATHS.fermentationProfiles,
  waterProfiles: ROUTE_PATHS.waterProfiles,
  batches: ROUTE_PATHS.batches,
  inventory: ROUTE_PATHS.inventory,
  settings: ROUTE_PATHS.settings,
  calculators: ROUTE_PATHS.calculators,
};

/** Total over all 9 NavDestination values. Never returns undefined. */
export function pathForDestination(destination: NavDestination): string {
  return DESTINATION_TO_PATH[destination];
}

/** Path builder for a saved recipe's editor screen. */
export function editorPathForRecipe(recipeId: string): string {
  return `/recipes/${recipeId}/edit`;
}

/** Path builder for a batch's detail screen. */
export function batchDetailPath(batchId: string): string {
  return `/batches/${batchId}`;
}

// Matches `/recipes/:id/edit` with a non-empty, single-segment `:id`.
const EDITOR_EDIT_PATH_RE = /^\/recipes\/([^/]+)\/edit$/;
const BATCH_DETAIL_PATH_RE = /^\/batches\/([^/]+)$/;

/** True iff the pathname is `/recipes/new` or `/recipes/:id/edit`. RA-9 term (b). */
export function isEditorPath(pathname: string): boolean {
  if (pathname === ROUTE_PATHS.recipeNew) return true;
  const match = EDITOR_EDIT_PATH_RE.exec(pathname);
  return match !== null && match[1].length > 0;
}

/**
 * Total inverse mapping: pathname -> the ActiveView string that Sidebar and
 * MobileNav already accept. Unknown pathnames return 'list' (RA-7 alignment).
 */
export function viewForPath(pathname: string): ActiveView {
  if (pathname === ROUTE_PATHS.recipes) return 'list';
  if (isEditorPath(pathname)) return 'editor';
  if (pathname === ROUTE_PATHS.batches) return 'batches';
  if (BATCH_DETAIL_PATH_RE.test(pathname)) return 'batchDetail';
  if (pathname === ROUTE_PATHS.equipment) return 'equipment';
  if (pathname === ROUTE_PATHS.mashProfiles) return 'mashProfiles';
  if (pathname === ROUTE_PATHS.fermentationProfiles) return 'fermentationProfiles';
  if (pathname === ROUTE_PATHS.waterProfiles) return 'waterProfiles';
  if (pathname === ROUTE_PATHS.inventory) return 'inventory';
  if (pathname === ROUTE_PATHS.settings) return 'settings';
  if (pathname === ROUTE_PATHS.calculators) return 'calculators';
  return 'list';
}
