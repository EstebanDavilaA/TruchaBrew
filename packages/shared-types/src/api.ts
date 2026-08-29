import type { Recipe, EquipmentProfile, FermentableItem, HopItem, YeastItem, FermentableType, HopType, YeastType, YeastForm } from './brewing';
import type { MiscItem, MiscType, MiscUse, MiscUnit } from './misc';
import type { MashStep, FermentationStep } from './schedules';

export interface StoredRecipe extends Recipe {
  createdAt: string;
  updatedAt: string;
}

export interface RecipeSummary {
  id: string;
  name: string;
  author: string;
  styleName: string;
  equipmentId: string;
  equipmentName: string;
  batchSizeL: number;
  fermentableCount: number;
  hopCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface RecipeImportResponse {
  importedCount: number;
  recipes: StoredRecipe[];
}


// A line-item write payload: every domain field except `id`, which is
// optional — present and reused when it already belongs to the parent
// (recipe/profile) being updated, absent (or unrecognised) to mint a fresh
// row. Recipe fermentables/hops/yeasts/miscs and mash/fermentation steps all
// follow this one policy (M2_P1 spec §1.3; M3_P2 spec extends it to steps).
export type LineItemInput<T> = Omit<T, 'id'> & { id?: string };

export interface RecipeWriteInput {
  name: string;
  author: string;
  styleName: string;
  notes: string;
  equipmentId: string;
  fermentables: LineItemInput<FermentableItem>[];
  hops: LineItemInput<HopItem>[];
  yeasts: LineItemInput<YeastItem>[];
  miscs: LineItemInput<MiscItem>[];
  // Required keys, nullable values (M3_P2 spec §1.3) — an omitted key is 400
  // VALIDATION_FAILED, never a silently-defaulted null. This matters for
  // isDirty: an optional key would canonicalise to a different string
  // depending on whether the client bothered to send it.
  mashProfileId: string | null;
  fermentationProfileId: string | null;
  waterSourceId?: string | null;       // NEW in M6 — FK to water_profiles
  waterTargetId?: string | null;       // NEW in M6 — FK to water_profiles
}

export interface EquipmentCreateInput extends Omit<EquipmentProfile, 'id'> {}

// Omits both `id` (path parameter) and `derivedFromEquipmentId` (server-owned
// — provenance is not user-editable through PUT). All 16 remaining fields are
// required — a full replace, never a partial merge (M3_P1 spec, Resolved
// Ambiguities / AC-22).
export interface EquipmentUpdateInput extends Omit<EquipmentProfile, 'id' | 'derivedFromEquipmentId'> {}

// The 409 EQUIPMENT_IN_USE body's `details` payload (M3_P1 spec §1.3).
export interface EquipmentInUseDetails {
  recipeCount: number;
  recipeNames: string[]; // at most 5, updatedAt DESC
}

// The 409 RECIPE_IN_USE body's `details` payload — same shape/precedent as
// EquipmentInUseDetails/ProfileInUseDetails, added for DELETE /api/recipes/:id
// once a recipe has a batch (M4_P1 critic Finding F-5: this FK previously
// 500'd instead of following the established *_IN_USE pattern).
export interface RecipeInUseDetails {
  batchCount: number;
  batchNames: string[]; // at most 5, updatedAt DESC
}

// Steps carry an optional client-supplied id, reused when it already belongs
// to this profile — identical policy to LineItemInput<T> on recipe line
// items (M3_P2 spec §1.3).
export interface MashProfileWriteInput {
  name: string;
  targetPh: number;
  spargeTempC: number | null;
  steps: LineItemInput<MashStep>[];
}

export interface FermentationProfileWriteInput {
  name: string;
  steps: LineItemInput<FermentationStep>[];
}

// The 409 PROFILE_IN_USE body's `details` payload (M3_P2 spec §1.3).
export interface ProfileInUseDetails {
  profileKind: 'mash' | 'fermentation';
  recipeCount: number;
  recipeNames: string[]; // at most 5, updatedAt DESC
}

export interface CatalogFermentable {
  id: string;
  name: string;
  type: FermentableType;
  colorSrm: number;
  potentialSg: number;
}
export interface CatalogHop {
  id: string;
  name: string;
  alphaAcidPct: number;
  type: HopType;
}
export interface CatalogYeast {
  id: string;
  name: string;
  laboratory: string;
  type: YeastType;
  form: YeastForm;
  attenuationPct: number;
}
export interface CatalogMisc {
  id: string;
  name: string;
  type: MiscType;
  defaultUse: MiscUse;
  defaultUnit: MiscUnit;
}
export interface CatalogResponse {
  fermentables: CatalogFermentable[];
  hops: CatalogHop[];
  yeasts: CatalogYeast[];
  miscs: CatalogMisc[];
}

export type ApiErrorCode =
  | 'VALIDATION_FAILED'
  | 'NOT_FOUND'
  | 'EQUIPMENT_NOT_FOUND'
  | 'EQUIPMENT_IN_USE'
  | 'PROFILE_IN_USE'
  | 'RECIPE_IN_USE'
  | 'WATER_PROFILE_IN_USE'
  | 'INTERNAL'
  // NEW in M9_P1 — see packages/shared-types/src/inventory.ts's
  // InventoryDuplicateDetails for this code's `details` payload.
  | 'INVENTORY_DUPLICATE'
  // NEW in M9_P2 — checkoff ledger errors, all 409. See
  // .gsd/active/M9_P2_feature_spec.md §1.1 / §4 Deviation 10.
  | 'CHECKOFF_ALREADY_OPEN'
  | 'CHECKOFF_NOT_OPEN'
  | 'CHECKOFF_NOT_COMPARABLE'
  | 'CHECKOFF_STAGE_INVALID';

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
    details?: unknown;
  };
}

// The 409 WATER_PROFILE_IN_USE body's `details` payload (M6_P1 spec §1.2).
export interface WaterProfileInUseDetails {
  recipeCount: number;
  recipeNames: string[]; // at most 5, updatedAt DESC
}
