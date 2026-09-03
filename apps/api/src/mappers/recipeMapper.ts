import type { InferSelectModel } from 'drizzle-orm';
import type {
  EquipmentProfile,
  FermentableItem,
  FermentableType,
  HopItem,
  HopUse,
  HopType,
  YeastItem,
  YeastType,
  YeastForm,
  MiscItem,
  MiscType,
  MiscUse,
  MiscUnit,
  MashProfile,
  FermentationProfile,
  StoredRecipe,
  RecipeWriteInput,
} from '@truchabrew/shared-types';
import {
  recipes,
  recipeFermentables,
  recipeHops,
  recipeYeasts,
  recipeMiscs,
} from '../db/schema';

export type RecipeRow = InferSelectModel<typeof recipes>;
export type FermentableRow = InferSelectModel<typeof recipeFermentables>;
export type HopRow = InferSelectModel<typeof recipeHops>;
export type YeastRow = InferSelectModel<typeof recipeYeasts>;
export type MiscRow = InferSelectModel<typeof recipeMiscs>;

function byPosition<T extends { position: number }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.position - b.position);
}

/**
 * Maps DB rows to the domain `StoredRecipe` shape. Sorts each line-item
 * array by `position` — it does not trust input order.
 */
export function toStoredRecipe(
  recipeRow: RecipeRow,
  equipment: EquipmentProfile,
  fermentables: FermentableRow[],
  hops: HopRow[],
  yeasts: YeastRow[],
  miscs: MiscRow[],
  mashProfile: MashProfile | null,
  fermentationProfile: FermentationProfile | null,
): StoredRecipe {
  return {
    id: recipeRow.id,
    name: recipeRow.name,
    author: recipeRow.author,
    styleName: recipeRow.styleName,
    notes: recipeRow.notes,
    equipment,
    mashProfile,
    fermentationProfile,
    waterSourceId: recipeRow.waterSourceId ?? null,
    waterTargetId: recipeRow.waterTargetId ?? null,
    fermentables: byPosition(fermentables).map(
      (f): FermentableItem => ({
        id: f.id,
        name: f.name,
        type: f.type as FermentableType,
        amountKg: f.amountKg,
        colorSrm: f.colorSrm,
        potentialSg: f.potentialSg,
        ...(f.notes !== null && f.notes !== undefined ? { notes: f.notes } : {}),
      }),
    ),
    hops: byPosition(hops).map(
      (h): HopItem => ({
        id: h.id,
        name: h.name,
        amountG: h.amountG,
        alphaAcidPct: h.alphaAcidPct,
        use: h.use as HopUse,
        boilMins: h.boilMins,
        whirlpoolMins: h.whirlpoolMins,
        whirlpoolTempC: h.whirlpoolTempC,
        dryHopDayOffset: h.dryHopDayOffset ?? null,
        dryHopDurationDays: h.dryHopDurationDays ?? null,
        type: h.type as HopType,
        timeMinutes: h.timeMinutes,
      }),
    ),
    yeasts: byPosition(yeasts).map(
      (y): YeastItem => ({
        id: y.id,
        name: y.name,
        type: y.type as YeastType,
        form: y.form as YeastForm,
        laboratory: y.laboratory,
        attenuationPct: y.attenuationPct,
        amountPkg: y.amountPkg,
      }),
    ),
    miscs: byPosition(miscs).map(
      (m): MiscItem => ({
        id: m.id,
        name: m.name,
        type: m.type as MiscType,
        use: m.use as MiscUse,
        timeMinutes: m.timeMinutes,
        amount: m.amount,
        unit: m.unit as MiscUnit,
        ...(m.notes !== null && m.notes !== undefined ? { notes: m.notes } : {}),
      }),
    ),
    createdAt: recipeRow.createdAt,
    updatedAt: recipeRow.updatedAt,
  };
}

export interface LineItemRowSet {
  fermentables: FermentableRow[];
  hops: HopRow[];
  yeasts: YeastRow[];
  miscs: MiscRow[];
}

/**
 * Pure transform from a `RecipeWriteInput` into row shapes for `recipeId`,
 * ready for the repository to write as-is. `idFor` is injected so this stays
 * testable without touching `crypto`; called with the client-supplied id (if
 * any) so the caller's id-reuse policy — reuse an existing row id on update,
 * mint a fresh one otherwise — lives entirely in the injected function, not
 * here. Positions are dense, 0-based, assigned by array index.
 */
export function toLineItemRows(
  recipeId: string,
  input: RecipeWriteInput,
  idFor: (existing?: string) => string,
): LineItemRowSet {
  return {
    fermentables: input.fermentables.map((f, position) => ({
      id: idFor(f.id),
      recipeId,
      position,
      name: f.name,
      type: f.type,
      amountKg: f.amountKg,
      colorSrm: f.colorSrm,
      potentialSg: f.potentialSg,
      notes: f.notes ?? null,
    })),
    hops: input.hops.map((h, position) => ({
      id: idFor(h.id),
      recipeId,
      position,
      name: h.name,
      amountG: h.amountG,
      alphaAcidPct: h.alphaAcidPct,
      use: h.use,
      boilMins: h.boilMins ?? null,
      whirlpoolMins: h.whirlpoolMins ?? null,
      whirlpoolTempC: h.whirlpoolTempC ?? null,
      dryHopDayOffset: h.use === 'DryHop' ? (h.dryHopDayOffset ?? null) : null,
      dryHopDurationDays: h.use === 'DryHop' ? (h.dryHopDurationDays ?? null) : null,
      type: h.type,
      // DryHop-only (M4_P1 spec AC-10(f)) — every other use writes null so no
      // hop ever carries two representations of one timing.
      timeMinutes: h.use === 'DryHop' ? (h.timeMinutes ?? null) : null,
    })),
    yeasts: input.yeasts.map((y, position) => ({
      id: idFor(y.id),
      recipeId,
      position,
      name: y.name,
      type: y.type,
      form: y.form,
      laboratory: y.laboratory,
      attenuationPct: y.attenuationPct,
      amountPkg: y.amountPkg,
    })),
    miscs: input.miscs.map((m, position) => ({
      id: idFor(m.id),
      recipeId,
      position,
      name: m.name,
      type: m.type,
      use: m.use,
      timeMinutes: m.timeMinutes,
      amount: m.amount,
      unit: m.unit,
      notes: m.notes ?? null,
    })),
  };
}
