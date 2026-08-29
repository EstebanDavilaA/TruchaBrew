import React, { useEffect, useRef, useState } from 'react';
import type {
  InventoryItem,
  InventoryStockView,
  InventoryWriteInput,
  InventoryCategory,
  InventoryUnit,
  InventoryCustomDetails,
  HopInventoryDetails,
  FermentableInventoryDetails,
  YeastInventoryDetails,
  MiscInventoryDetails,
} from '@truchabrew/shared-types';
import { INVENTORY_CATEGORIES, CANONICAL_INVENTORY_UNIT, MISC_INVENTORY_UNITS } from '@truchabrew/calculations';
import { createInventoryItem, updateInventoryItem, ApiClientError } from '../api/client';
import { ArrowLeft, Save, Loader2, AlertTriangle, Trash2 } from 'lucide-react';
import { TopBar } from './TopBar';
import { PageContainer } from './PageContainer';
import { ConfirmDialog } from './ConfirmDialog';
import { FormField, Input, Select, NumberInput, Button } from './ui';
import {
  CARD_CLASS,
  INPUT_CLASS,
  METADATA_TEXT_CLASS,
  SUBSECTION_HEADING_CLASS,
} from './designSystem';

const FORM_ID = 'inventory-form';

interface DeleteAction {
  onConfirm: () => void | Promise<void>;
  busy: boolean;
  error: string | null;
}

/**
 * Preset pre-fill context (M12_P1, spec §2, AC-7/AC-9). Passed on `create`
 * when the form is opened from `PresetPickerModal`:
 * - Preset selection: `name` set, category LOCKED to the preset's category.
 * - "+ Add Custom Item" fallback: `name` omitted (blank name), category
 *   still LOCKED to the picker's category context.
 */
export interface InitialPreset {
  category: InventoryCategory;
  name?: string;
  // NEW in M12_P1 Amendment 1 — preset-derived vitals (spec §7.3.1). Absent
  // for the "+ Add Custom Item" fallback (no pre-filled vitals).
  customDetails?: InventoryCustomDetails | null;
}

type InventoryFormProps =
  | { mode: 'create'; initialItem?: undefined; initialPreset?: InitialPreset; onSaved: (item: InventoryItem) => void; onCancel: () => void; onOpenMobileNav?: () => void }
  | {
      mode: 'edit';
      initialItem: InventoryStockView;
      initialPreset?: undefined;
      onSaved: (item: InventoryItem) => void;
      onCancel: () => void;
      deleteAction: DeleteAction;
      onOpenMobileNav?: () => void;
    };

/** The allowed `unit` options for a given category — Misc offers all five; the other three offer exactly their one canonical unit (AC-35). */
function unitOptionsFor(category: InventoryCategory): readonly InventoryUnit[] {
  if (category === 'Misc') return MISC_INVENTORY_UNITS;
  return [CANONICAL_INVENTORY_UNIT[category]];
}

// ---------------------------------------------------------------------------
// M12_P1 Amendment 1 — "Category Details" card (spec §7.3.2). Each numeric/
// text field is tracked as a string (same style as quantity/costPerUnit
// above) and converted at submit time; blank -> null.
// ---------------------------------------------------------------------------

const HOP_TYPE_OPTIONS = ['Pellet', 'Leaf', 'Cryo', 'Extract'] as const;
const GRAIN_TYPE_OPTIONS = ['Grain', 'LiquidExtract', 'DryExtract', 'Sugar', 'Adjunct'] as const;
const YEAST_TYPE_OPTIONS = ['Ale', 'Lager', 'Wheat', 'Wine'] as const;
const YEAST_FORM_OPTIONS = ['Dry', 'Liquid'] as const;
const MISC_TYPE_OPTIONS = ['WaterAgent', 'Fining', 'Spice', 'Flavor', 'Other'] as const;
const DEFAULT_USE_OPTIONS = ['Mash', 'Boil', 'Whirlpool', 'Primary', 'Secondary', 'Bottling'] as const;

function blankToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function blankToNullNumber(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const parsed = parseFloat(trimmed);
  return isNaN(parsed) ? null : parsed;
}

function asString(value: number | string | null | undefined): string {
  return value === null || value === undefined ? '' : String(value);
}

function hopDetailsOf(details: InventoryCustomDetails | null | undefined): HopInventoryDetails | null {
  return details && details.category === 'Hop' ? details : null;
}
function fermentableDetailsOf(details: InventoryCustomDetails | null | undefined): FermentableInventoryDetails | null {
  return details && details.category === 'Fermentable' ? details : null;
}
function yeastDetailsOf(details: InventoryCustomDetails | null | undefined): YeastInventoryDetails | null {
  return details && details.category === 'Yeast' ? details : null;
}
function miscDetailsOf(details: InventoryCustomDetails | null | undefined): MiscInventoryDetails | null {
  return details && details.category === 'Misc' ? details : null;
}

export const InventoryForm: React.FC<InventoryFormProps> = (props) => {
  const isEdit = props.mode === 'edit';
  const initial = props.initialItem;
  const preset = props.mode === 'create' ? props.initialPreset : undefined;
  // Category is locked (Category select disabled) whenever the form was
  // opened with a preset context — either an actual preset selection or the
  // "+ Add Custom Item" fallback, both of which fix the category up front.
  const categoryLocked = preset !== undefined;

  const [category, setCategory] = useState<InventoryCategory>(initial?.category ?? preset?.category ?? 'Fermentable');
  const [name, setName] = useState(initial?.name ?? preset?.name ?? '');
  const [quantity, setQuantity] = useState(initial ? String(initial.baseQuantity) : '0');
  const [unit, setUnit] = useState<InventoryUnit>(initial?.unit ?? unitOptionsFor(initial?.category ?? preset?.category ?? 'Fermentable')[0]);
  const [costPerUnit, setCostPerUnit] = useState(initial?.costPerUnit !== null && initial?.costPerUnit !== undefined ? String(initial.costPerUnit) : '');
  const [purchaseDate, setPurchaseDate] = useState(initial?.purchaseDate ?? '');
  const [expiryDate, setExpiryDate] = useState(initial?.expiryDate ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');

  // NEW in M12_P1 Amendment 1 — "Category Details" card state (spec §7.3.2).
  // Seeded from initial.customDetails (edit mode) or preset.customDetails
  // (create-from-preset, AC-20); blank for plain create and the "+ Add
  // Custom Item" fallback (AC-9/§7.3.1 — no pre-filled vitals).
  const seedDetails = initial?.customDetails ?? preset?.customDetails ?? null;
  const seedHop = hopDetailsOf(seedDetails);
  const seedFermentable = fermentableDetailsOf(seedDetails);
  const seedYeast = yeastDetailsOf(seedDetails);
  const seedMisc = miscDetailsOf(seedDetails);

  const [alphaAcidPct, setAlphaAcidPct] = useState(asString(seedHop?.alphaAcidPct));
  const [hopType, setHopType] = useState(seedHop?.hopType ?? '');
  const [origin, setOrigin] = useState(seedHop?.origin ?? seedFermentable?.origin ?? '');
  const [year, setYear] = useState(asString(seedHop?.year));
  const [potentialSg, setPotentialSg] = useState(asString(seedFermentable?.potentialSg));
  const [colorSrm, setColorSrm] = useState(asString(seedFermentable?.colorSrm));
  const [grainType, setGrainType] = useState(seedFermentable?.grainType ?? '');
  const [supplier, setSupplier] = useState(seedFermentable?.supplier ?? '');
  const [laboratory, setLaboratory] = useState(seedYeast?.laboratory ?? '');
  const [productId, setProductId] = useState(seedYeast?.productId ?? '');
  const [attenuationPct, setAttenuationPct] = useState(asString(seedYeast?.attenuationPct));
  const [yeastType, setYeastType] = useState(seedYeast?.yeastType ?? '');
  const [yeastForm, setYeastForm] = useState(seedYeast?.form ?? '');
  const [miscType, setMiscType] = useState(seedMisc?.miscType ?? '');
  const [defaultUse, setDefaultUse] = useState(seedMisc?.defaultUse ?? '');
  const [lotNumber, setLotNumber] = useState(seedHop?.lotNumber ?? seedFermentable?.lotNumber ?? seedYeast?.lotNumber ?? seedMisc?.lotNumber ?? '');
  const [manufacturingDate, setManufacturingDate] = useState(
    seedHop?.manufacturingDate ?? seedFermentable?.manufacturingDate ?? seedYeast?.manufacturingDate ?? seedMisc?.manufacturingDate ?? '',
  );

  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const deleteAction = isEdit ? props.deleteAction : undefined;
  const prevDeleteBusy = useRef(deleteAction?.busy ?? false);

  useEffect(() => {
    if (prevDeleteBusy.current && !deleteAction?.busy && deleteAction?.error) {
      setConfirmDeleteOpen(false);
    }
    prevDeleteBusy.current = deleteAction?.busy ?? false;
  }, [deleteAction?.busy, deleteAction?.error]);

  // Changing category resets `unit` to that category's first valid option
  // whenever the currently-selected unit is no longer valid for it.
  const handleCategoryChange = (next: InventoryCategory) => {
    setCategory(next);
    const options = unitOptionsFor(next);
    if (!options.includes(unit)) {
      setUnit(options[0]);
    }
  };

  /** Builds the `customDetails` payload for the currently active category (spec §7.3.2). */
  const buildCustomDetails = (): InventoryCustomDetails => {
    switch (category) {
      case 'Hop':
        return {
          category: 'Hop',
          alphaAcidPct: blankToNullNumber(alphaAcidPct),
          hopType: blankToNull(hopType),
          origin: blankToNull(origin),
          year: blankToNullNumber(year),
          lotNumber: blankToNull(lotNumber),
          manufacturingDate: blankToNull(manufacturingDate),
        };
      case 'Fermentable':
        return {
          category: 'Fermentable',
          potentialSg: blankToNullNumber(potentialSg),
          colorSrm: blankToNullNumber(colorSrm),
          grainType: blankToNull(grainType),
          supplier: blankToNull(supplier),
          origin: blankToNull(origin),
          lotNumber: blankToNull(lotNumber),
          manufacturingDate: blankToNull(manufacturingDate),
        };
      case 'Yeast':
        return {
          category: 'Yeast',
          laboratory: blankToNull(laboratory),
          productId: blankToNull(productId),
          attenuationPct: blankToNullNumber(attenuationPct),
          yeastType: blankToNull(yeastType),
          form: blankToNull(yeastForm),
          lotNumber: blankToNull(lotNumber),
          manufacturingDate: blankToNull(manufacturingDate),
        };
      case 'Misc':
        return {
          category: 'Misc',
          miscType: blankToNull(miscType),
          defaultUse: blankToNull(defaultUse),
          lotNumber: blankToNull(lotNumber),
          manufacturingDate: blankToNull(manufacturingDate),
        };
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setSaveError('Name is required');
      return;
    }

    const parsedQuantity = parseFloat(quantity);
    if (isNaN(parsedQuantity)) {
      setSaveError('Quantity must be a number');
      return;
    }

    const parsedCostPerUnit = costPerUnit.trim() === '' ? null : parseFloat(costPerUnit);
    if (parsedCostPerUnit !== null && (isNaN(parsedCostPerUnit) || parsedCostPerUnit < 0)) {
      setSaveError('Cost per unit must be a non-negative number');
      return;
    }

    // Never `costPerUnit`, `quantity`, `purchaseDate` or `expiryDate` beyond
    // the 8 client-writable fields (now 9 with `customDetails`, M12_P1
    // Amendment 1) — id/nameKey/createdAt/updatedAt are absent from
    // InventoryWriteInput by construction (AC-35).
    const payload: InventoryWriteInput = {
      category,
      name: trimmedName,
      quantity: parsedQuantity,
      unit,
      costPerUnit: parsedCostPerUnit,
      purchaseDate: purchaseDate.trim() === '' ? null : purchaseDate,
      expiryDate: expiryDate.trim() === '' ? null : expiryDate,
      notes,
      customDetails: buildCustomDetails(),
    };

    setBusy(true);
    try {
      if (isEdit && initial) {
        const updated = await updateInventoryItem(initial.id, payload);
        props.onSaved(updated);
      } else {
        const created = await createInventoryItem(payload);
        props.onSaved(created);
      }
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : 'Failed to save inventory item.';
      setSaveError(message);
    } finally {
      setBusy(false);
    }
  };

  const titleText = isEdit && initial ? `Edit ${initial.name}` : 'New Inventory Item';
  const unitOptions = unitOptionsFor(category);

  return (
    <>
      <TopBar
        title={titleText}
        onOpenMobileNav={props.onOpenMobileNav}
        leading={
          <Button
            variant="icon"
            onClick={props.onCancel}
            disabled={busy}
            title="Cancel"
            aria-label="Cancel"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
        }
      >
        {deleteAction && (
          <Button
            variant="danger"
            size="sm"
            data-testid="inventory-delete"
            onClick={() => setConfirmDeleteOpen(true)}
            disabled={deleteAction.busy}
            title="Delete"
            className="flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </Button>
        )}
        <Button
          variant="secondary"
          size="sm"
          onClick={props.onCancel}
          disabled={busy}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          form={FORM_ID}
          size="sm"
          disabled={busy}
          className="flex items-center gap-2"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {busy ? 'Saving…' : 'Save Item'}
        </Button>
      </TopBar>
      <PageContainer>
        <form id={FORM_ID} onSubmit={handleSubmit} className="space-y-6">
          {saveError && (
            <div className="bg-rose-950/60 border border-rose-800 rounded-lg p-4 flex items-start gap-3 text-sm text-rose-200">
              <AlertTriangle className="w-5 h-5 text-rose-400 mt-0.5 flex-shrink-0" />
              <div>
                <div className="font-semibold text-rose-300">Couldn't save inventory item</div>
                <div>{saveError}</div>
              </div>
            </div>
          )}

          <div className={`${CARD_CLASS} space-y-4`}>
            <h3 className={SUBSECTION_HEADING_CLASS}>Item Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <FormField label="Category" required>
                  <Select
                    data-testid="inventory-form-category"
                    value={category}
                    onChange={(e) => handleCategoryChange(e.target.value as InventoryCategory)}
                    disabled={categoryLocked}
                  >
                    {INVENTORY_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Select>
                </FormField>
                {categoryLocked && (
                  <p className={`${METADATA_TEXT_CLASS} mt-1`} data-testid="inventory-form-category-locked-note">
                    Category is locked to {category} from the preset picker.
                  </p>
                )}
              </div>

              <FormField label="Item Name" required>
                <Input
                  data-testid="inventory-form-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Pale Ale Malt"
                />
              </FormField>

              <FormField label="Quantity" required>
                <NumberInput
                  data-testid="inventory-form-quantity"
                  step="any"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </FormField>

              <FormField label="Unit" required>
                <Select
                  data-testid="inventory-form-unit"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value as InventoryUnit)}
                >
                  {unitOptions.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </Select>
              </FormField>

              <FormField label="Cost Per Unit">
                <NumberInput
                  data-testid="inventory-form-cost-per-unit"
                  step="any"
                  min="0"
                  value={costPerUnit}
                  onChange={(e) => setCostPerUnit(e.target.value)}
                  placeholder="Optional"
                />
              </FormField>

              <FormField label="Purchase Date">
                <Input
                  data-testid="inventory-form-purchase-date"
                  type="date"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                />
              </FormField>

              <FormField label="Expiry Date">
                <Input
                  data-testid="inventory-form-expiry-date"
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                />
              </FormField>
            </div>

            <FormField label="Notes">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes..."
                rows={2}
                data-testid="inventory-form-notes"
                className={`${INPUT_CLASS} text-xs`}
              />
            </FormField>
          </div>

          <div className={`${CARD_CLASS} space-y-4`}>
            <h3 className={SUBSECTION_HEADING_CLASS}>Category Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {category === 'Hop' && (
                <>
                  <FormField label="Alpha Acid (%)">
                    <NumberInput
                      data-testid="inventory-form-alpha-acid"
                      step="0.1"
                      value={alphaAcidPct}
                      onChange={(e) => setAlphaAcidPct(e.target.value)}
                    />
                  </FormField>
                  <FormField label="Hop Form / Type">
                    <Select
                      data-testid="inventory-form-hop-type"
                      value={hopType}
                      onChange={(e) => setHopType(e.target.value)}
                    >
                      <option value="">—</option>
                      {HOP_TYPE_OPTIONS.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                  <FormField label="Origin / Country">
                    <Input
                      data-testid="inventory-form-origin"
                      value={origin}
                      onChange={(e) => setOrigin(e.target.value)}
                      placeholder="e.g. US, Germany"
                    />
                  </FormField>
                  <FormField label="Crop Year">
                    <NumberInput
                      data-testid="inventory-form-year"
                      value={year}
                      onChange={(e) => setYear(e.target.value)}
                      placeholder="e.g. 2025"
                    />
                  </FormField>
                  <FormField label="Lot # / Batch">
                    <Input
                      data-testid="inventory-form-lot-number"
                      value={lotNumber}
                      onChange={(e) => setLotNumber(e.target.value)}
                    />
                  </FormField>
                  <FormField label="Harvest / Manufacturing Date">
                    <Input
                      data-testid="inventory-form-manufacturing-date"
                      type="date"
                      value={manufacturingDate}
                      onChange={(e) => setManufacturingDate(e.target.value)}
                    />
                  </FormField>
                </>
              )}

              {category === 'Fermentable' && (
                <>
                  <FormField label="Potential (SG)">
                    <NumberInput
                      data-testid="inventory-form-potential-sg"
                      step="0.001"
                      value={potentialSg}
                      onChange={(e) => setPotentialSg(e.target.value)}
                      placeholder="e.g. 1.037"
                    />
                  </FormField>
                  <FormField label="Color (SRM)">
                    <NumberInput
                      data-testid="inventory-form-color-srm"
                      step="0.1"
                      value={colorSrm}
                      onChange={(e) => setColorSrm(e.target.value)}
                      placeholder="e.g. 3.5"
                    />
                  </FormField>
                  <FormField label="Fermentable Type">
                    <Select
                      data-testid="inventory-form-grain-type"
                      value={grainType}
                      onChange={(e) => setGrainType(e.target.value)}
                    >
                      <option value="">—</option>
                      {GRAIN_TYPE_OPTIONS.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                  <FormField label="Supplier / Maltster">
                    <Input
                      data-testid="inventory-form-supplier"
                      value={supplier}
                      onChange={(e) => setSupplier(e.target.value)}
                      placeholder="e.g. BESTMALZ"
                    />
                  </FormField>
                  <FormField label="Origin / Country">
                    <Input
                      data-testid="inventory-form-origin"
                      value={origin}
                      onChange={(e) => setOrigin(e.target.value)}
                    />
                  </FormField>
                  <FormField label="Lot # / Batch">
                    <Input
                      data-testid="inventory-form-lot-number"
                      value={lotNumber}
                      onChange={(e) => setLotNumber(e.target.value)}
                    />
                  </FormField>
                  <FormField label="Manufacturing Date">
                    <Input
                      data-testid="inventory-form-manufacturing-date"
                      type="date"
                      value={manufacturingDate}
                      onChange={(e) => setManufacturingDate(e.target.value)}
                    />
                  </FormField>
                </>
              )}

              {category === 'Yeast' && (
                <>
                  <FormField label="Laboratory / Brand">
                    <Input
                      data-testid="inventory-form-laboratory"
                      value={laboratory}
                      onChange={(e) => setLaboratory(e.target.value)}
                      placeholder="e.g. Fermentis"
                    />
                  </FormField>
                  <FormField label="Product ID / Code">
                    <Input
                      data-testid="inventory-form-product-id"
                      value={productId}
                      onChange={(e) => setProductId(e.target.value)}
                      placeholder="e.g. S-04"
                    />
                  </FormField>
                  <FormField label="Attenuation (%)">
                    <NumberInput
                      data-testid="inventory-form-attenuation"
                      value={attenuationPct}
                      onChange={(e) => setAttenuationPct(e.target.value)}
                      placeholder="e.g. 75"
                    />
                  </FormField>
                  <FormField label="Yeast Type">
                    <Select
                      data-testid="inventory-form-yeast-type"
                      value={yeastType}
                      onChange={(e) => setYeastType(e.target.value)}
                    >
                      <option value="">—</option>
                      {YEAST_TYPE_OPTIONS.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                  <FormField label="Form">
                    <Select
                      data-testid="inventory-form-yeast-form"
                      value={yeastForm}
                      onChange={(e) => setYeastForm(e.target.value)}
                    >
                      <option value="">—</option>
                      {YEAST_FORM_OPTIONS.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                  <FormField label="Lot # / Batch">
                    <Input
                      data-testid="inventory-form-lot-number"
                      value={lotNumber}
                      onChange={(e) => setLotNumber(e.target.value)}
                    />
                  </FormField>
                  <FormField label="Manufacturing Date">
                    <Input
                      data-testid="inventory-form-manufacturing-date"
                      type="date"
                      value={manufacturingDate}
                      onChange={(e) => setManufacturingDate(e.target.value)}
                    />
                  </FormField>
                </>
              )}

              {category === 'Misc' && (
                <>
                  <FormField label="Misc Type">
                    <Select
                      data-testid="inventory-form-misc-type"
                      value={miscType}
                      onChange={(e) => setMiscType(e.target.value)}
                    >
                      <option value="">—</option>
                      {MISC_TYPE_OPTIONS.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                  <FormField label="Default Use">
                    <Select
                      data-testid="inventory-form-default-use"
                      value={defaultUse}
                      onChange={(e) => setDefaultUse(e.target.value)}
                    >
                      <option value="">—</option>
                      {DEFAULT_USE_OPTIONS.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                  <FormField label="Lot # / Batch">
                    <Input
                      data-testid="inventory-form-lot-number"
                      value={lotNumber}
                      onChange={(e) => setLotNumber(e.target.value)}
                    />
                  </FormField>
                  <FormField label="Manufacturing Date">
                    <Input
                      data-testid="inventory-form-manufacturing-date"
                      type="date"
                      value={manufacturingDate}
                      onChange={(e) => setManufacturingDate(e.target.value)}
                    />
                  </FormField>
                </>
              )}
            </div>
          </div>
        </form>
      </PageContainer>

      {isEdit && initial && deleteAction && (
        <ConfirmDialog
          open={confirmDeleteOpen}
          title={`Delete "${initial.name}"?`}
          message="Are you sure you want to delete this inventory item? This action cannot be undone."
          confirmLabel="Delete Item"
          busy={deleteAction.busy}
          onConfirm={() => deleteAction.onConfirm()}
          onCancel={() => setConfirmDeleteOpen(false)}
        />
      )}
    </>
  );
};
