import type {
  ApiErrorBody,
  ApiErrorCode,
  CatalogResponse,
  EquipmentCreateInput,
  EquipmentUpdateInput,
  EquipmentProfile,
  RecipeSummary,
  RecipeWriteInput,
  RecipeImportResponse,
  StoredRecipe,
  MashProfile,
  MashProfileWriteInput,
  FermentationProfile,
  FermentationProfileWriteInput,
  Batch,
  BatchNote,
  BatchNoteWriteInput,
  BatchWithReadings,
  BatchWriteInput,
  Reading,
  ReadingWriteInput,
  WaterProfile,
  WaterProfileInput,
  InventoryWriteInput,
  InventoryCategory,
  StockEvaluation,
  InventoryStockView,
  BatchCheckoffState,
  BatchCostBreakdown,
  CheckoffWriteInput,
  Recipe,
  DatabaseBackup,
  RestoreRequest,
  RestoreSummary,
} from '@truchabrew/shared-types';

export class ApiClientError extends Error {
  code: ApiErrorCode;

  constructor(code: ApiErrorCode, message: string) {
    super(message);
    this.name = 'ApiClientError';
    this.code = code;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: {
        // Only set Content-Type when a body is actually being sent —
        // Fastify's content-type parser rejects an empty body when the
        // header claims application/json (FST_ERR_CTP_EMPTY_JSON_BODY),
        // which every bodyless call (DELETE, and POST /duplicate) would
        // otherwise hit as a raw 500 despite the route handling it correctly.
        ...(init?.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    throw new ApiClientError('INTERNAL', 'Network error: could not reach the server.');
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : undefined;
  } catch {
    parsed = undefined;
  }

  if (!response.ok) {
    const body = parsed as ApiErrorBody | undefined;
    if (body?.error?.code && body.error.message) {
      throw new ApiClientError(body.error.code, body.error.message);
    }
    throw new ApiClientError('INTERNAL', `Request failed with status ${response.status}.`);
  }

  return parsed as T;
}

export function getCatalog(): Promise<CatalogResponse> {
  return request<CatalogResponse>('/api/catalog');
}

export function listEquipmentProfiles(): Promise<EquipmentProfile[]> {
  return request<EquipmentProfile[]>('/api/equipment-profiles');
}

export function createEquipmentProfile(input: EquipmentCreateInput): Promise<EquipmentProfile> {
  return request<EquipmentProfile>('/api/equipment-profiles', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateEquipmentProfile(id: string, input: EquipmentUpdateInput): Promise<EquipmentProfile> {
  return request<EquipmentProfile>(`/api/equipment-profiles/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export async function deleteEquipmentProfile(id: string): Promise<void> {
  await request<void>(`/api/equipment-profiles/${id}`, { method: 'DELETE' });
}

export interface ListRecipesOptions {
  folder?: string | null;
  tag?: string | null;
}

// NEW in M38_P1 — `options.folder`/`options.tag` are appended alongside `q`
// (AC-7, AC-8, AC-9). `folder: '__unfiled__'` is the RA-1 sentinel for
// folder === null, passed through verbatim as a query value.
export function listRecipes(q?: string, options?: ListRecipesOptions): Promise<RecipeSummary[]> {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (options?.folder) params.set('folder', options.folder);
  if (options?.tag) params.set('tag', options.tag);
  const query = params.toString();
  return request<RecipeSummary[]>(`/api/recipes${query ? `?${query}` : ''}`);
}

export function getRecipe(id: string): Promise<StoredRecipe> {
  return request<StoredRecipe>(`/api/recipes/${id}`);
}

export function createRecipe(input: RecipeWriteInput): Promise<StoredRecipe> {
  return request<StoredRecipe>('/api/recipes', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateRecipe(id: string, input: RecipeWriteInput): Promise<StoredRecipe> {
  return request<StoredRecipe>(`/api/recipes/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export function patchRecipeName(id: string, name: string): Promise<StoredRecipe> {
  return request<StoredRecipe>(`/api/recipes/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  });
}

export function duplicateRecipe(id: string): Promise<StoredRecipe> {
  return request<StoredRecipe>(`/api/recipes/${id}/duplicate`, { method: 'POST' });
}

export async function deleteRecipe(id: string): Promise<void> {
  await request<void>(`/api/recipes/${id}`, { method: 'DELETE' });
}

export function importBrewfatherRecipes(payload: unknown): Promise<RecipeImportResponse> {
  return request<RecipeImportResponse>('/api/recipes/import/brewfather', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function listMashProfiles(): Promise<MashProfile[]> {
  return request<MashProfile[]>('/api/mash-profiles');
}

export function createMashProfile(input: MashProfileWriteInput): Promise<MashProfile> {
  return request<MashProfile>('/api/mash-profiles', { method: 'POST', body: JSON.stringify(input) });
}

export function updateMashProfile(id: string, input: MashProfileWriteInput): Promise<MashProfile> {
  return request<MashProfile>(`/api/mash-profiles/${id}`, { method: 'PUT', body: JSON.stringify(input) });
}

export async function deleteMashProfile(id: string): Promise<void> {
  await request<void>(`/api/mash-profiles/${id}`, { method: 'DELETE' });
}

export function listFermentationProfiles(): Promise<FermentationProfile[]> {
  return request<FermentationProfile[]>('/api/fermentation-profiles');
}

export function createFermentationProfile(input: FermentationProfileWriteInput): Promise<FermentationProfile> {
  return request<FermentationProfile>('/api/fermentation-profiles', { method: 'POST', body: JSON.stringify(input) });
}

export function updateFermentationProfile(id: string, input: FermentationProfileWriteInput): Promise<FermentationProfile> {
  return request<FermentationProfile>(`/api/fermentation-profiles/${id}`, { method: 'PUT', body: JSON.stringify(input) });
}

export async function deleteFermentationProfile(id: string): Promise<void> {
  await request<void>(`/api/fermentation-profiles/${id}`, { method: 'DELETE' });
}

export function listBatches(): Promise<Batch[]> {
  return request<Batch[]>('/api/batches');
}

export function getBatch(id: string): Promise<BatchWithReadings> {
  return request<BatchWithReadings>(`/api/batches/${id}`);
}

/** The "Brew This" control's create call (M4_P1 spec, entry-point Resolved Ambiguity / AC-8). */
export function createBatch(recipeId: string): Promise<Batch> {
  return request<Batch>('/api/batches', {
    method: 'POST',
    body: JSON.stringify({ recipeId }),
  });
}

export function updateBatch(id: string, input: BatchWriteInput): Promise<BatchWithReadings> {
  return request<BatchWithReadings>(`/api/batches/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

// NEW in M13_P1 Amendment 2 (spec §3.5.4) — bodyless-delete convention,
// identical in shape to deleteRecipe/deleteEquipmentProfile/deleteReading/
// deleteBatchNote.
export async function deleteBatch(id: string): Promise<void> {
  await request<void>(`/api/batches/${id}`, { method: 'DELETE' });
}

// NEW in M5_P1 — per-item reading endpoints (spec §4 deviation 5), not a
// full-replace of an array.

export function createReading(batchId: string, input: ReadingWriteInput): Promise<Reading> {
  return request<Reading>(`/api/batches/${batchId}/readings`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateReading(batchId: string, readingId: string, input: ReadingWriteInput): Promise<Reading> {
  return request<Reading>(`/api/batches/${batchId}/readings/${readingId}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export async function deleteReading(batchId: string, readingId: string): Promise<void> {
  await request<void>(`/api/batches/${batchId}/readings/${readingId}`, { method: 'DELETE' });
}

// NEW in M5_P2 — per-item note endpoints, same shape as the reading endpoints above.

export function createBatchNote(batchId: string, input: BatchNoteWriteInput): Promise<BatchNote> {
  return request<BatchNote>(`/api/batches/${batchId}/notes`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateBatchNote(batchId: string, noteId: string, input: BatchNoteWriteInput): Promise<BatchNote> {
  return request<BatchNote>(`/api/batches/${batchId}/notes/${noteId}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export async function deleteBatchNote(batchId: string, noteId: string): Promise<void> {
  await request<void>(`/api/batches/${batchId}/notes/${noteId}`, { method: 'DELETE' });
}

export function listWaterProfiles(): Promise<WaterProfile[]> {
  return request<WaterProfile[]>('/api/water-profiles');
}

export function createWaterProfile(input: WaterProfileInput): Promise<WaterProfile> {
  return request<WaterProfile>('/api/water-profiles', { method: 'POST', body: JSON.stringify(input) });
}

export function updateWaterProfile(id: string, input: WaterProfileInput): Promise<WaterProfile> {
  return request<WaterProfile>(`/api/water-profiles/${id}`, { method: 'PUT', body: JSON.stringify(input) });
}

export async function deleteWaterProfile(id: string): Promise<void> {
  await request<void>(`/api/water-profiles/${id}`, { method: 'DELETE' });
}

// NEW in M9_P1 — inventory CRUD + the batch stock-check read. Query params
// are appended in (category, outOfStock) order, and only when actually
// filtered — an unfiltered call issues a bare '/api/inventory' (AC-33).
export function listInventory(filters: { category?: InventoryCategory; outOfStock?: boolean } = {}): Promise<InventoryStockView[]> {
  const params = new URLSearchParams();
  if (filters.category !== undefined) params.set('category', filters.category);
  if (filters.outOfStock !== undefined) params.set('outOfStock', String(filters.outOfStock));
  const query = params.toString();
  return request<InventoryStockView[]>(`/api/inventory${query ? `?${query}` : ''}`);
}

export function createInventoryItem(input: InventoryWriteInput): Promise<InventoryStockView> {
  return request<InventoryStockView>('/api/inventory', { method: 'POST', body: JSON.stringify(input) });
}

export function updateInventoryItem(id: string, input: InventoryWriteInput): Promise<InventoryStockView> {
  return request<InventoryStockView>(`/api/inventory/${id}`, { method: 'PUT', body: JSON.stringify(input) });
}

export async function deleteInventoryItem(id: string): Promise<void> {
  await request<void>(`/api/inventory/${id}`, { method: 'DELETE' });
}

export function getBatchStockCheck(batchId: string): Promise<StockEvaluation> {
  return request<StockEvaluation>(`/api/batches/${batchId}/stock-check`);
}

// NEW in M9_P2 — checkoff/reverse/cost. See
// .gsd/active/M9_P2_feature_spec.md §1.3.
export function getBatchCheckoff(batchId: string): Promise<BatchCheckoffState> {
  return request<BatchCheckoffState>(`/api/batches/${batchId}/checkoff`);
}

export function checkoffInventoryItem(batchId: string, input: CheckoffWriteInput): Promise<BatchCheckoffState> {
  return request<BatchCheckoffState>(`/api/batches/${batchId}/checkoff`, { method: 'POST', body: JSON.stringify(input) });
}

export function reverseInventoryCheckoff(batchId: string, input: CheckoffWriteInput): Promise<BatchCheckoffState> {
  return request<BatchCheckoffState>(`/api/batches/${batchId}/checkoff/reverse`, { method: 'POST', body: JSON.stringify(input) });
}

export function getBatchCost(batchId: string): Promise<BatchCostBreakdown> {
  return request<BatchCostBreakdown>(`/api/batches/${batchId}/cost`);
}

// NEW in M15_P1 — in-batch recipe adjustment (spec §2.1/§3.2).
// `syncToMasterRecipe` is optional and defaults to false server-side.
export function updateBatchRecipeSnapshot(batchId: string, recipeSnapshot: Recipe, syncToMasterRecipe?: boolean): Promise<BatchWithReadings> {
  return request<BatchWithReadings>(`/api/batches/${batchId}/recipe-snapshot`, {
    method: 'PUT',
    body: JSON.stringify({ recipeSnapshot, syncToMasterRecipe }),
  });
}

// NEW in M36_P1 — full-database JSON backup export (spec §1.3).

export function exportDatabaseBackup(): Promise<DatabaseBackup> {
  return request<DatabaseBackup>('/api/backup/export');
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** `truchabrew_backup_YYYY-MM-DD.json`, UTC-dated — mirrors the server's own filename format (AC-15). */
function backupFilename(now: Date): string {
  return `truchabrew_backup_${now.getUTCFullYear()}-${pad2(now.getUTCMonth() + 1)}-${pad2(now.getUTCDate())}.json`;
}

/**
 * Triggers a browser file download of the full-database backup (RA-3):
 * fetches the payload, wraps it in an ephemeral object URL, and clicks a
 * hidden anchor with a `download` attribute — revoking the URL immediately
 * after the click is dispatched, since the download itself is asynchronous
 * from the browser's perspective but the anchor/URL are no longer needed
 * once the click has fired.
 */
export async function downloadDatabaseBackup(): Promise<void> {
  const backup = await exportDatabaseBackup();
  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = backupFilename(new Date());
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  URL.revokeObjectURL(url);
}

// NEW in M36_P2 — full-database JSON restore (spec §1.3 / RA-2).

export function restoreDatabaseBackup(req: RestoreRequest): Promise<RestoreSummary> {
  return request<RestoreSummary>('/api/backup/restore', {
    method: 'POST',
    body: JSON.stringify(req),
  });
}

