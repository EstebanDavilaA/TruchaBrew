import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { InventoryStockView, InventoryCategory } from '@truchabrew/shared-types';
import { isOutOfStock, isNegativeStock, INVENTORY_CATEGORIES } from '@truchabrew/calculations';
import { listInventory, deleteInventoryItem, ApiClientError } from '../api/client';
import { InventoryForm, type InitialPreset } from './InventoryForm';
import { PresetPickerModal } from './PresetPickerModal';
import { TopBar } from './TopBar';
import { PageContainer } from './PageContainer';
import { ListRow, LIST_CONTAINER_CLASS } from './ListRow';
import { Button, Input, Badge } from './ui';
import { Plus, AlertTriangle, RotateCw, Boxes, Wheat, Flower2, FlaskConical, Sparkles, ChevronDown, ChevronRight, Search } from 'lucide-react';

type FormTarget = { mode: 'create'; initialPreset?: InitialPreset } | { mode: 'edit'; item: InventoryStockView } | null;

const CATEGORY_ICON: Record<InventoryCategory, React.ComponentType<{ className?: string }>> = {
  Fermentable: Wheat,
  Hop: Flower2,
  Yeast: FlaskConical,
  Misc: Sparkles,
};

const CATEGORY_PLURAL: Record<InventoryCategory, string> = {
  Fermentable: 'Fermentables',
  Hop: 'Hops',
  Yeast: 'Yeasts',
  Misc: 'Miscs',
};

// Segmented pill strip styling (FEAT-029 / RA-3) — matches the Calculators
// page's pill vocabulary (ACTIVE_PILL/INACTIVE_PILL there) so the toolbar
// reads cohesively with the rest of the app.
const PILL_BASE = 'px-3 py-1.5 rounded-full text-xs font-medium transition-colors';
const PILL_ACTIVE = 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20';
const PILL_INACTIVE = 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800';

/**
 * List-row vitals badge text from `customDetails` (M12_P1 Amendment 1, spec
 * §7.3.3) — e.g. `8.5% AA • Pellet`, `1.037 SG • 3.5 SRM`. `null` when the
 * item has no customDetails or neither of its two vitals is set.
 */
function vitalsBadgeFor(item: InventoryStockView): string | null {
  const details = item.customDetails;
  if (!details) return null;
  switch (details.category) {
    case 'Hop': {
      const parts: string[] = [];
      if (details.alphaAcidPct !== null && details.alphaAcidPct !== undefined) parts.push(`${details.alphaAcidPct}% AA`);
      if (details.hopType) parts.push(details.hopType);
      return parts.length > 0 ? parts.join(' • ') : null;
    }
    case 'Fermentable': {
      const parts: string[] = [];
      if (details.potentialSg !== null && details.potentialSg !== undefined) parts.push(`${details.potentialSg} SG`);
      if (details.colorSrm !== null && details.colorSrm !== undefined) parts.push(`${details.colorSrm} SRM`);
      return parts.length > 0 ? parts.join(' • ') : null;
    }
    case 'Yeast': {
      const parts: string[] = [];
      const labProduct = [details.laboratory, details.productId].filter(Boolean).join(' ');
      if (labProduct) parts.push(labProduct);
      if (details.attenuationPct !== null && details.attenuationPct !== undefined) parts.push(`${details.attenuationPct}% Att`);
      return parts.length > 0 ? parts.join(' • ') : null;
    }
    case 'Misc': {
      const parts: string[] = [];
      if (details.miscType) parts.push(details.miscType);
      if (details.defaultUse) parts.push(details.defaultUse);
      return parts.length > 0 ? parts.join(' • ') : null;
    }
  }
}

interface InventoryManagerProps {
  /** Optional callback to open the mobile off-canvas navigation drawer (M26_P1 Amendment 1). */
  onOpenMobileNav?: () => void;
}

/** Self-contained list page (BatchList precedent) — owns its own fetch, filters and CRUD. */
export const InventoryManager: React.FC<InventoryManagerProps> = ({ onOpenMobileNav }) => {
  const [items, setItems] = useState<InventoryStockView[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<InventoryCategory | 'All'>('All');
  const [outOfStockOnly, setOutOfStockOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedSections, setCollapsedSections] = useState<Record<InventoryCategory, boolean>>({
    Fermentable: false,
    Hop: false,
    Yeast: false,
    Misc: false,
  });
  const [presetPickerCategory, setPresetPickerCategory] = useState<InventoryCategory | null>(null);
  const [formTarget, setFormTarget] = useState<FormTarget>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<{ id: string; message: string } | null>(null);

  const load = useCallback(() => {
    listInventory({
      category: categoryFilter === 'All' ? undefined : categoryFilter,
      outOfStock: outOfStockOnly ? true : undefined,
    })
      .then((rows) => {
        setItems(rows);
        setLoadError(null);
      })
      .catch((err: unknown) => {
        setLoadError(err instanceof ApiClientError ? err.message : 'Failed to load inventory.');
      });
  }, [categoryFilter, outOfStockOnly]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (item: InventoryStockView) => {
    setDeletingId(item.id);
    setDeleteError(null);
    try {
      await deleteInventoryItem(item.id);
      setFormTarget(null);
      load();
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : 'Failed to delete inventory item.';
      setDeleteError({ id: item.id, message });
    } finally {
      setDeletingId(null);
    }
  };

  const toggleSection = (category: InventoryCategory) => {
    setCollapsedSections((prev) => ({ ...prev, [category]: !prev[category] }));
  };

  // Global search (AC-10) filters live across all 4 category sections,
  // client-side, on top of whatever the server-side category/out-of-stock
  // filters already returned.
  const visibleItems = useMemo(() => {
    if (items === null) return null;
    const q = searchQuery.trim().toLowerCase();
    if (q === '') return items;
    return items.filter((item) => item.name.toLowerCase().includes(q));
  }, [items, searchQuery]);

  const itemsByCategory = useMemo(() => {
    const groups: Record<InventoryCategory, InventoryStockView[]> = { Fermentable: [], Hop: [], Yeast: [], Misc: [] };
    if (visibleItems === null) return groups;
    for (const item of visibleItems) {
      groups[item.category].push(item);
    }
    return groups;
  }, [visibleItems]);

  // Live out-of-stock count for the toolbar pill (FEAT-029) — scoped to the
  // same search-filtered set the category pill badges read from, so it stays
  // in sync as the user types or switches categories.
  const outOfStockCount = useMemo(() => {
    if (visibleItems === null) return 0;
    return visibleItems.filter((item) => isOutOfStock(item.quantity)).length;
  }, [visibleItems]);

  if (formTarget?.mode === 'create') {
    return (
      <InventoryForm
        key="create"
        mode="create"
        initialPreset={formTarget.initialPreset}
        onSaved={() => {
          setFormTarget(null);
          load();
        }}
        onCancel={() => setFormTarget(null)}
        onOpenMobileNav={onOpenMobileNav}
      />
    );
  }
  if (formTarget?.mode === 'edit') {
    return (
      <InventoryForm
        key={`edit-${formTarget.item.id}`}
        mode="edit"
        initialItem={formTarget.item}
        onSaved={(updated) => {
          setFormTarget(null);
          load();
          void updated;
        }}
        onCancel={() => setFormTarget(null)}
        deleteAction={{
          onConfirm: () => handleDelete(formTarget.item),
          busy: deletingId === formTarget.item.id,
          error: deleteError?.id === formTarget.item.id ? deleteError.message : null,
        }}
        onOpenMobileNav={onOpenMobileNav}
      />
    );
  }

  return (
    <>
      <TopBar title="Inventory" onOpenMobileNav={onOpenMobileNav}>
        <Button
          variant="primary"
          size="sm"
          type="button"
          onClick={() => setFormTarget({ mode: 'create' })}
          data-testid="inventory-new-item"
        >
          <Plus className="w-4 h-4" /> New Item
        </Button>
      </TopBar>
      <PageContainer>
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search inventory..."
              data-testid="inventory-search"
              aria-label="Search inventory"
              className="pl-9"
            />
          </div>

          {/* Segmented category pill strip (FEAT-029 / RA-3) — composed from
              <Button> primitives, no new export. Active pill carries
              aria-pressed; each pill carries a live count badge. */}
          <div
            role="group"
            aria-label="Filter by category"
            data-testid="inventory-filter-category"
            className="flex flex-wrap items-center gap-1.5"
          >
            <Button
              type="button"
              aria-pressed={categoryFilter === 'All'}
              data-testid="inventory-filter-category-All"
              onClick={() => setCategoryFilter('All')}
              className={`${PILL_BASE} ${categoryFilter === 'All' ? PILL_ACTIVE : PILL_INACTIVE}`}
            >
              All
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-950/60 text-slate-300">
                {items === null ? 0 : visibleItems?.length ?? 0}
              </span>
            </Button>
            {INVENTORY_CATEGORIES.map((category) => (
              <Button
                key={category}
                type="button"
                aria-pressed={categoryFilter === category}
                data-testid={`inventory-filter-category-${category}`}
                onClick={() => setCategoryFilter(category)}
                className={`${PILL_BASE} ${categoryFilter === category ? PILL_ACTIVE : PILL_INACTIVE}`}
              >
                {category}
                <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-950/60 text-slate-300">
                  {itemsByCategory[category].length}
                </span>
              </Button>
            ))}

            {/* Out-of-stock toggle pill (FEAT-029) — same Button-composed
                pattern as the category pills, aria-pressed reflects the
                active filter. */}
            <Button
              type="button"
              aria-pressed={outOfStockOnly}
              data-testid="inventory-filter-out-of-stock"
              onClick={() => setOutOfStockOnly((v) => !v)}
              className={`${PILL_BASE} ${outOfStockOnly ? PILL_ACTIVE : PILL_INACTIVE}`}
            >
              Out of stock
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-950/60 text-slate-300">
                {outOfStockCount}
              </span>
            </Button>
          </div>
        </div>

        {loadError && (
          <div className="bg-rose-950/60 border border-rose-800 rounded-lg px-4 py-4 flex items-start gap-3 text-sm text-rose-200 mb-6">
            <AlertTriangle className="w-5 h-5 text-rose-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <div className="font-semibold text-rose-300">Couldn't load your inventory</div>
              <div className="text-rose-200/90">{loadError}</div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              type="button"
              onClick={load}
            >
              <RotateCw className="w-3.5 h-3.5" /> Retry
            </Button>
          </div>
        )}

        {!loadError && visibleItems !== null && visibleItems.length === 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-10 text-center text-slate-400 mb-6">
            <Boxes className="w-8 h-8 mx-auto mb-3 text-slate-600" />
            No inventory items yet. Add what's in your cupboard to start tracking stock.
          </div>
        )}

        {!loadError && visibleItems !== null && (
          <div className="space-y-4">
            {INVENTORY_CATEGORIES.map((category) => {
              const Icon = CATEGORY_ICON[category];
              const categoryItems = itemsByCategory[category];
              const collapsed = collapsedSections[category];

              return (
                <div key={category} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                  <div
                    data-testid={`inventory-category-header-${category}`}
                    className="flex items-center justify-between gap-3 px-5 py-4"
                  >
                    <Button
                      variant="icon"
                      type="button"
                      onClick={() => toggleSection(category)}
                      aria-label={collapsed ? `Expand ${CATEGORY_PLURAL[category]}` : `Collapse ${CATEGORY_PLURAL[category]}`}
                      data-testid={`inventory-category-toggle-${category}`}
                      className="flex-1 min-w-0 justify-start gap-3 rounded-lg px-1 py-1 text-left"
                    >
                      {collapsed ? (
                        <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      )}
                      <Icon className="w-4 h-4 text-amber-400 flex-shrink-0" />
                      <h2 className="text-sm font-bold text-slate-100 truncate">
                        {CATEGORY_PLURAL[category]} <span className="text-slate-400 font-medium">({categoryItems.length})</span>
                      </h2>
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      type="button"
                      onClick={() => setPresetPickerCategory(category)}
                      data-testid={`inventory-add-${category.toLowerCase()}`}
                      className="flex-shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5 text-amber-400" /> Add {category}
                    </Button>
                  </div>

                  {!collapsed && (
                    <div className="px-5 pb-5">
                      {categoryItems.length === 0 ? (
                        <div className="text-sm text-slate-400 text-center py-6 border border-dashed border-slate-800 rounded-lg">
                          No {category.toLowerCase()} items in inventory
                        </div>
                      ) : (
                        <div className={LIST_CONTAINER_CLASS}>
                          {categoryItems.map((item) => {
                            const outOfStock = isOutOfStock(item.quantity);
                            const negative = isNegativeStock(item.quantity);
                            const vitals = vitalsBadgeFor(item);
                            return (
                              <ListRow
                                key={item.id}
                                testId={`inventory-row-${item.id}`}
                                label={`Open "${item.name}"`}
                                onOpen={() => setFormTarget({ mode: 'edit', item })}
                                primary={item.name}
                                meta={
                                  <>
                                    <Badge variant="neutral" size="sm">
                                      {item.category}
                                    </Badge>
                                    <span>•</span>
                                    <span data-testid={`inventory-onhand-${item.id}`}>
                                      {item.quantity} {item.unit}
                                    </span>
                                    {item.deductedQuantity > 0 && (
                                      <span className="text-slate-400" data-testid={`inventory-base-deducted-${item.id}`}>
                                        (base {item.baseQuantity} − {item.deductedQuantity} deducted)
                                      </span>
                                    )}
                                    <span>•</span>
                                    <span>{item.costPerUnit === null ? '—' : item.costPerUnit}</span>
                                    {vitals && (
                                      <>
                                        <span>•</span>
                                        <span data-testid={`inventory-vitals-${item.id}`} className="text-slate-400">
                                          {vitals}
                                        </span>
                                      </>
                                    )}
                                    {outOfStock && (
                                      <Badge
                                        variant="warning"
                                        size="sm"
                                        data-testid={`inventory-flag-out-of-stock-${item.id}`}
                                      >
                                        Out of stock
                                      </Badge>
                                    )}
                                    {negative && (
                                      <Badge
                                        variant="danger"
                                        size="sm"
                                        data-testid={`inventory-flag-negative-stock-${item.id}`}
                                      >
                                        Negative stock
                                      </Badge>
                                    )}
                                  </>
                                }
                              />
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </PageContainer>

      {presetPickerCategory !== null && (
        <PresetPickerModal
          category={presetPickerCategory}
          isOpen={presetPickerCategory !== null}
          onClose={() => setPresetPickerCategory(null)}
          onSelectPreset={(presetName, category, presetDetails) => {
            setPresetPickerCategory(null);
            setFormTarget({ mode: 'create', initialPreset: { category, name: presetName, customDetails: presetDetails } });
          }}
          onSelectCustom={(category) => {
            setPresetPickerCategory(null);
            setFormTarget({ mode: 'create', initialPreset: { category } });
          }}
        />
      )}
    </>
  );
};
