import React, { useEffect, useState, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import type { RecipeSummary } from '@truchabrew/shared-types';
import { listRecipes, duplicateRecipe, importBrewfatherRecipes, ApiClientError } from '../api/client';
import { useConfig } from '../context/ConfigContext';
import { formatVolume } from '@truchabrew/calculations';
import { Search, Plus, Copy, AlertTriangle, RotateCw, Beaker, Upload } from 'lucide-react';
import { TopBar } from './TopBar';
import { PageContainer } from './PageContainer';
import { ListRow, LIST_CONTAINER_CLASS } from './ListRow';
import { Button, Input } from './ui';

interface RecipeLibraryProps {
  onOpen: (id: string) => Promise<void>;
  onOpenError: (message: string) => void;
  onNew: () => void;
  canCreate: boolean;
  notices?: ReactNode;
  /** Optional callback to open the mobile off-canvas navigation drawer (M26_P1 Amendment 1). */
  onOpenMobileNav?: () => void;
}

export const RecipeLibrary: React.FC<RecipeLibraryProps> = ({ onOpen, onOpenError, onNew, canCreate, notices, onOpenMobileNav }) => {
  const { config } = useConfig();
  const [recipes, setRecipes] = useState<RecipeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback((q?: string) => {
    setLoading(true);
    setLoadError(null);
    listRecipes(q)
      .then((data) => {
        setRecipes(data);
        setLoading(false);
      })
      .catch((err: unknown) => {
        // Failed list load shows an error panel, never the "no recipes yet"
        // empty state — an empty-state message on a failed load would be a
        // lie about the user's data.
        setLoadError(err instanceof ApiClientError ? err.message : 'Failed to load recipes.');
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    const handle = setTimeout(() => load(query), 200);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const handleOpen = async (id: string) => {
    try {
      await onOpen(id);
    } catch (err) {
      onOpenError(err instanceof ApiClientError ? err.message : 'Failed to open recipe.');
    }
  };

  const handleDuplicate = async (id: string) => {
    setBusyId(id);
    try {
      await duplicateRecipe(id);
      load(query);
    } finally {
      setBusyId(null);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportStatus(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        let parsed: unknown;
        try {
          parsed = JSON.parse(text);
        } catch {
          throw new Error('Selected file is not valid JSON.');
        }

        const res = await importBrewfatherRecipes(parsed);
        setImportStatus({
          type: 'success',
          message: `Successfully imported ${res.importedCount} recipe${res.importedCount === 1 ? '' : 's'}.`,
        });
        load(query);
      } catch (err: unknown) {
        setImportStatus({
          type: 'error',
          message: err instanceof ApiClientError ? err.message : (err instanceof Error ? err.message : 'Import failed.'),
        });
      } finally {
        setIsImporting(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };
    reader.onerror = () => {
      setImportStatus({ type: 'error', message: 'Failed to read file.' });
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const searchInput = (
    <div className="relative w-full">
      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
      <Input
        size="sm"
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by name or style…"
        className="pl-9"
      />
    </div>
  );

  const importButton = (
    <Button
      variant="secondary"
      size="sm"
      type="button"
      onClick={() => fileInputRef.current?.click()}
      disabled={isImporting}
      aria-label={isImporting ? 'Importing…' : 'Import JSON'}
      title="Import recipes from Brewfather JSON"
    >
      <Upload className="w-4 h-4 text-slate-400" />
      <span className="hidden md:inline">{isImporting ? 'Importing…' : 'Import JSON'}</span>
    </Button>
  );

  const newRecipeButton = (
    <Button
      variant="primary"
      size="sm"
      type="button"
      onClick={onNew}
      disabled={!canCreate}
      title={canCreate ? undefined : 'Create an equipment profile before starting a new recipe.'}
    >
      <Plus className="w-4 h-4" /> New Recipe
    </Button>
  );

  return (
    <>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".json,application/json"
        className="hidden"
        data-testid="brewfather-file-input"
      />
      <TopBar title="Recipe Library" search={searchInput} onOpenMobileNav={onOpenMobileNav}>
        <div className="flex items-center gap-2">
          {importButton}
          {newRecipeButton}
        </div>
      </TopBar>
      <PageContainer>
      {notices}

      {importStatus && (
        <div
          data-testid="import-status-banner"
          className={`rounded-lg px-4 py-3 flex items-center justify-between text-sm mb-4 border ${
            importStatus.type === 'success'
              ? 'bg-emerald-950/60 border-emerald-800 text-emerald-200'
              : 'bg-rose-950/60 border-rose-800 text-rose-200'
          }`}
        >
          <span>{importStatus.message}</span>
          <Button
            variant="secondary"
            size="sm"
            type="button"
            onClick={() => setImportStatus(null)}
            className="ml-4"
          >
            Dismiss
          </Button>
        </div>
      )}

      {loadError && (

        <div className="bg-rose-950/60 border border-rose-800 rounded-lg px-4 py-4 flex items-start gap-3 text-sm text-rose-200 mb-6">
          <AlertTriangle className="w-5 h-5 text-rose-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <div className="font-semibold text-rose-300">Couldn't load your recipes</div>
            <div className="text-rose-200/90">{loadError}</div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            type="button"
            onClick={() => load(query)}
          >
            <RotateCw className="w-3.5 h-3.5" /> Retry
          </Button>
        </div>
      )}

      {!loadError && loading && <div className="text-sm text-slate-400 italic px-2">Loading recipes…</div>}

      {!loadError && !loading && recipes.length === 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-10 text-center text-slate-400">
          <Beaker className="w-8 h-8 mx-auto mb-3 text-slate-600" />
          No recipes yet. Create your first one to get started.
        </div>
      )}

      {!loadError && recipes.length > 0 && (
        <div className={LIST_CONTAINER_CLASS}>
          {recipes.map((r) => (
            <ListRow
              key={r.id}
              testId={`recipe-row-${r.id}`}
              label={`Open "${r.name}"`}
              onOpen={() => handleOpen(r.id)}
              primary={r.name}
              meta={
                <>
                  <span>{r.styleName || 'No style set'}</span>
                  <span>•</span>
                  <span>{r.equipmentName}</span>
                  <span>•</span>
                  <span>{formatVolume(r.batchSizeL, config.unitSystem)}</span>
                  <span>•</span>
                  <span>
                    {r.fermentableCount} malt{r.fermentableCount === 1 ? '' : 's'}
                  </span>
                  <span>•</span>
                  <span>
                    {r.hopCount} hop{r.hopCount === 1 ? '' : 's'}
                  </span>
                </>
              }
              trailing={
                <Button
                  variant="icon"
                  type="button"
                  disabled={busyId === r.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDuplicate(r.id);
                  }}
                  title="Duplicate"
                  aria-label={`Duplicate "${r.name}"`}
                  className="text-slate-400 hover:text-sky-300"
                >
                  <Copy className="w-3.5 h-3.5" />
                </Button>
              }
            />
          ))}
        </div>
      )}
      </PageContainer>
    </>
  );
};
