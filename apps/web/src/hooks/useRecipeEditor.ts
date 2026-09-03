import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  ApiErrorCode,
  EquipmentProfile,
  MashProfile,
  FermentationProfile,
  Recipe,
  RecipeWriteInput,
  StoredRecipe,
  UserConfig,
} from '@truchabrew/shared-types';
import { calculateRecipeStats, calculateMashPlan, type MashPlan } from '@truchabrew/calculations';
import {
  createRecipe as apiCreateRecipe,
  updateRecipe as apiUpdateRecipe,
  getRecipe as apiGetRecipe,
  ApiClientError,
} from '../api/client';

export type SaveState = 'idle' | 'saving' | 'error';

const OMITTED_KEYS = new Set(['createdAt', 'updatedAt']);

/**
 * Deterministic JSON, keys lexicographically sorted at every depth,
 * createdAt/updatedAt omitted at every depth (they are not in
 * `RecipeWriteInput` regardless). Every call site passes `toWriteInput(recipe)`
 * — the recipe's *stored inputs* — never the hydrated `Recipe`/`StoredRecipe`
 * object directly. This is what keeps `isDirty` from reacting to the
 * embedded `equipment` object: `equipmentId` is the stored reference,
 * `recipe.equipment` is read-side hydration (M2 Key Behavior 2), and once
 * equipment is editable (M3), saving a profile while a recipe is open would
 * otherwise mutate `recipe.equipment` and falsely dirty every open recipe
 * that happens to reference it.
 */
function canonicalWorking(value: unknown): string {
  const sort = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(sort);
    if (v !== null && typeof v === 'object') {
      const keys = Object.keys(v as Record<string, unknown>)
        .filter((k) => !OMITTED_KEYS.has(k))
        .sort();
      const out: Record<string, unknown> = {};
      for (const k of keys) out[k] = sort((v as Record<string, unknown>)[k]);
      return out;
    }
    return v;
  };
  return JSON.stringify(sort(value));
}

function toWriteInput(recipe: Recipe): RecipeWriteInput {
  return {
    name: recipe.name,
    author: recipe.author,
    styleName: recipe.styleName,
    // NEW in M38_P1 — always emitted (never omitted), so isDirty reacts the
    // same way it does to every other field: a change is a change whether
    // the recipe was loaded pre- or post-M38_P1 (AC-17).
    folder: recipe.folder ?? null,
    tags: recipe.tags ?? [],
    // NEW in M38_P3 — always emitted (never omitted), so isDirty reacts to a
    // style change exactly like every other field (M38_P1 AC-17 pattern).
    bjcpStyleId: recipe.bjcpStyleId ?? null,
    notes: recipe.notes,
    equipmentId: recipe.equipment.id,
    fermentables: recipe.fermentables,
    hops: recipe.hops,
    yeasts: recipe.yeasts,
    miscs: recipe.miscs,
    mashProfileId: recipe.mashProfile?.id ?? null,
    fermentationProfileId: recipe.fermentationProfile?.id ?? null,
    waterSourceId: recipe.waterSourceId ?? null,
    waterTargetId: recipe.waterTargetId ?? null,
  };
}

export interface UseRecipeEditorResult {
  recipe: Recipe | null;
  storedId: string | null;
  saveState: SaveState;
  saveError: { code: ApiErrorCode; message: string } | null;
  isDirty: boolean;
  stats: ReturnType<typeof calculateRecipeStats>;
  mashPlan: MashPlan;
  startNewRecipe: (defaultEquipment: EquipmentProfile) => void;
  loadRecipe: (id: string) => Promise<void>;
  setRecipe: (updater: Recipe | ((prev: Recipe) => Recipe)) => void;
  save: () => Promise<void>;
  dismissError: () => void;
  closeEditor: () => void;
  /**
   * Substitutes a freshly-saved equipment profile into the working recipe
   * when (and only when) the open recipe references it. Never writes
   * storedId, savedSnapshot, saveState or saveError — the recipe's stored
   * inputs did not change, so the editor's dirty state must not change
   * either. A total no-op when ids don't match or recipe is null.
   */
  applyEquipmentUpdate: (profile: EquipmentProfile) => void;
  /**
   * Substitutes a freshly-saved mash schedule into the working recipe when
   * (and only when) the open recipe references it. Never writes storedId,
   * savedSnapshot, saveState or saveError — the recipe's stored inputs
   * (mash_profile_id) did not change, so isDirty must not change either.
   * Exact structural mirror of applyEquipmentUpdate.
   */
  applyMashProfileUpdate: (profile: MashProfile) => void;
  /** Exact structural mirror of applyMashProfileUpdate, for fermentation schedules. */
  applyFermentationProfileUpdate: (profile: FermentationProfile) => void;
}

const EMPTY_RECIPE_FOR_STATS: Recipe = {
  id: '',
  name: '',
  author: '',
  styleName: '',
  folder: null,
  tags: [],
  bjcpStyleId: null,
  notes: '',
  equipment: {
    id: '',
    name: '',
    batchSizeL: 0,
    boilTimeMin: 0,
    brewhouseEfficiencyPct: 0,
    mashEfficiencyPct: 0,
    boilOffRateLPerHour: 0,
    trubChillerLossL: 0,
    hopUtilizationPct: 0,
    derivedFromEquipmentId: null,
    mashWaterRatioLPerKg: 0,
    grainAbsorptionLPerKg: 0,
    hopstandUtilizationFactor: 0,
    hopstandTemperatureC: 0,
    spargeTemperatureC: 0,
    mashTunHeatCapacityL: 0,
    grainTemperatureC: 0,
    notes: '',
  },
  fermentables: [],
  hops: [],
  yeasts: [],
  miscs: [],
  mashProfile: null,
  fermentationProfile: null,
  waterSourceId: null,
  waterTargetId: null,
};

/**
 * `config` (§2.2.4, binding): the recipe being edited is a live calculation
 * and follows the active config's ibuFormula/abvFormula — the one call site
 * of the two named in §2.2.4 that always opts in. Omitting `config`
 * (untouched by any test written before this amendment) falls through to
 * calculateRecipeStats's own legacy default (§2.2.3), so this parameter is
 * additive and does not change any pre-amendment caller's behavior.
 */
export function useRecipeEditor(config?: Pick<UserConfig, 'abvFormula' | 'ibuFormula'>): UseRecipeEditorResult {
  const [recipe, setRecipeState] = useState<Recipe | null>(null);
  const [storedId, setStoredId] = useState<string | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [saveError, setSaveError] = useState<{ code: ApiErrorCode; message: string } | null>(null);

  // Stats are recomputed on every recipe OR config change, unconditional on
  // saveState — editing during a save error still updates OG/IBU/colour
  // live, and flipping a Settings strategy while the editor is open updates
  // this recipe's numbers without needing a remount (AC-26).
  const stats = useMemo(
    () =>
      calculateRecipeStats(
        recipe ?? EMPTY_RECIPE_FOR_STATS,
        config ? { abvFormula: config.abvFormula, ibuFormula: config.ibuFormula } : undefined,
      ),
    [recipe, config],
  );
  // Memoised on the same key as `stats` so they recompute in the same render
  // — StatsHeader's water tiles and MashSection's strike temperature can
  // never disagree about which equipment profile or grain bill they describe.
  const mashPlan = useMemo(() => calculateMashPlan(recipe ?? EMPTY_RECIPE_FOR_STATS), [recipe]);

  const isDirty = recipe !== null && canonicalWorking(toWriteInput(recipe)) !== savedSnapshot;

  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const startNewRecipe = useCallback((defaultEquipment: EquipmentProfile) => {
    setRecipeState({
      id: '',
      name: 'New Recipe',
      author: '',
      styleName: '',
      folder: null,
      tags: [],
      bjcpStyleId: null,
      notes: '',
      equipment: defaultEquipment,
      fermentables: [],
      hops: [],
      yeasts: [],
      miscs: [],
      mashProfile: null,
      fermentationProfile: null,
      waterSourceId: null,
      waterTargetId: null,
    });
    setStoredId(null);
    setSavedSnapshot(null);
    setSaveState('idle');
    setSaveError(null);
  }, []);

  const loadRecipe = useCallback(async (id: string) => {
    // No default/blank recipe is ever substituted for a failed load — this
    // throws and leaves all editor state untouched; the caller (library
    // view) decides how to surface the error and stays on the library.
    const fetched: StoredRecipe = await apiGetRecipe(id);
    setRecipeState(fetched);
    setStoredId(fetched.id);
    setSavedSnapshot(canonicalWorking(toWriteInput(fetched)));
    setSaveState('idle');
    setSaveError(null);
  }, []);

  const setRecipe = useCallback((updater: Recipe | ((prev: Recipe) => Recipe)) => {
    setRecipeState((prev) => {
      if (prev === null) return prev;
      return typeof updater === 'function' ? (updater as (prev: Recipe) => Recipe)(prev) : updater;
    });
  }, []);

  const save = useCallback(async () => {
    if (recipe === null) return;
    setSaveState('saving');
    // recipe is NOT touched while saving.
    try {
      const input = toWriteInput(recipe);
      const result: StoredRecipe = storedId === null ? await apiCreateRecipe(input) : await apiUpdateRecipe(storedId, input);
      // On success: id-reconciliation — replace the working recipe with the
      // server's response in one step.
      setRecipeState(result);
      setStoredId(result.id);
      setSavedSnapshot(canonicalWorking(toWriteInput(result)));
      setSaveState('idle');
      setSaveError(null);
    } catch (err) {
      // No step of the failure path writes to recipe/storedId/savedSnapshot.
      const apiErr =
        err instanceof ApiClientError
          ? { code: err.code, message: err.message }
          : { code: 'INTERNAL' as ApiErrorCode, message: 'Unexpected error while saving.' };
      setSaveState('error');
      setSaveError(apiErr);
    }
  }, [recipe, storedId]);

  const dismissError = useCallback(() => {
    // Dismissing does NOT clear the dirty flag — only saveState/saveError.
    setSaveState('idle');
    setSaveError(null);
  }, []);

  const closeEditor = useCallback(() => {
    setRecipeState(null);
    setStoredId(null);
    setSavedSnapshot(null);
    setSaveState('idle');
    setSaveError(null);
  }, []);

  // Equipment-only edit: substitutes the new profile into `recipe.equipment`
  // in place. storedId/savedSnapshot/saveState/saveError are never touched —
  // the recipe's stored inputs (equipmentId + line items) did not change, so
  // by the canonicalWorking(toWriteInput(...)) redefinition above, isDirty
  // does not change either. `stats` recomputes in the same render because it
  // is a useMemo keyed on `recipe`, and this replaces the `recipe` reference.
  const applyEquipmentUpdate = useCallback((profile: EquipmentProfile) => {
    setRecipeState((prev) => {
      if (prev === null || prev.equipment.id !== profile.id) return prev;
      return { ...prev, equipment: profile };
    });
  }, []);

  // Mash/fermentation-schedule-only edit: substitutes the new profile into
  // `recipe.mashProfile`/`recipe.fermentationProfile` in place. Total no-op
  // when ids don't match or recipe is null — storedId/savedSnapshot/
  // saveState/saveError are never touched, mirroring applyEquipmentUpdate
  // exactly (§2.5).
  const applyMashProfileUpdate = useCallback((profile: MashProfile) => {
    setRecipeState((prev) => {
      if (prev === null || prev.mashProfile === null || prev.mashProfile.id !== profile.id) return prev;
      return { ...prev, mashProfile: profile };
    });
  }, []);

  const applyFermentationProfileUpdate = useCallback((profile: FermentationProfile) => {
    setRecipeState((prev) => {
      if (prev === null || prev.fermentationProfile === null || prev.fermentationProfile.id !== profile.id) return prev;
      return { ...prev, fermentationProfile: profile };
    });
  }, []);

  return {
    recipe,
    storedId,
    saveState,
    saveError,
    isDirty,
    stats,
    mashPlan,
    startNewRecipe,
    loadRecipe,
    setRecipe,
    save,
    dismissError,
    closeEditor,
    applyEquipmentUpdate,
    applyMashProfileUpdate,
    applyFermentationProfileUpdate,
  };
}
