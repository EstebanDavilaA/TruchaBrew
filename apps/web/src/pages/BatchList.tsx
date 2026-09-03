import { useState, useEffect, useCallback } from 'react';
import type { Batch } from '@truchabrew/shared-types';
import { listBatches, ApiClientError } from '../api/client';
import { TopBar } from '../components/TopBar';
import { PageContainer } from '../components/PageContainer';
import { ListRow, LIST_CONTAINER_CLASS } from '../components/ListRow';
import { Badge } from '../components/ui';
import {
  EMPTY_STATE_CLASS,
  LOADING_STATE_CLASS,
  ERROR_STATE_CLASS,
} from '../components/designSystem';
import { AlertTriangle, RotateCw, Beaker } from 'lucide-react';

interface BatchListProps {
  onViewBatch: (id: string) => void;
  /** Optional callback to open the mobile off-canvas navigation drawer (M26_P1 Amendment 1). */
  onOpenMobileNav?: () => void;
}

export function BatchList({ onViewBatch, onOpenMobileNav }: BatchListProps) {
  const [batches, setBatches] = useState<Batch[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setBatches(null);
    try {
      setBatches(await listBatches());
    } catch (err: unknown) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to load batches.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <TopBar title="Brewing Batches" onOpenMobileNav={onOpenMobileNav} />
      <PageContainer>
        {error ? (
          <div className={`${ERROR_STATE_CLASS} flex items-start gap-3`} data-testid="batch-list-error">
            <AlertTriangle className="w-5 h-5 text-rose-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <div className="font-semibold text-rose-300">Couldn't load your batches</div>
              <div className="text-rose-200/90">{error}</div>
            </div>
            <button
              type="button"
              data-testid="batch-list-retry"
              onClick={() => {
                void load();
              }}
              className="flex items-center gap-1.5 text-xs font-semibold bg-rose-900/60 hover:bg-rose-900 border border-rose-700 rounded px-3 py-1.5 transition-colors cursor-pointer"
            >
              <RotateCw className="w-3.5 h-3.5" /> Retry
            </button>
          </div>
        ) : batches === null ? (
          <div className={LOADING_STATE_CLASS} data-testid="batch-list-loading">
            <Beaker className="w-8 h-8 mx-auto mb-3 text-slate-600 animate-pulse" />
            Loading batches…
          </div>
        ) : batches.length === 0 ? (
          <div className={EMPTY_STATE_CLASS}>
            <h3 className="text-lg font-medium text-slate-100">No batches yet</h3>
            <p className="mt-1 text-sm text-slate-400">
              Start a new batch from any recipe in your library.
            </p>
          </div>
        ) : (
          <div className={LIST_CONTAINER_CLASS}>
            {batches.map((batch) => (
              <ListRow
                key={batch.id}
                testId={`batch-row-${batch.id}`}
                label={`Open "${batch.name}"`}
                onOpen={() => onViewBatch(batch.id)}
                primary={batch.name}
                meta={<span>Recipe: {batch.recipeSnapshot.name}</span>}
                trailing={
                  <Badge variant={batch.status}>
                    {batch.status}
                  </Badge>
                }
              />
            ))}
          </div>
        )}
      </PageContainer>
    </>
  );
}
