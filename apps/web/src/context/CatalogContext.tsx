import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { CatalogResponse } from '@truchabrew/shared-types';
import { getCatalog } from '../api/client';

const EMPTY_CATALOG: CatalogResponse = { fermentables: [], hops: [], yeasts: [], miscs: [] };

interface CatalogContextValue {
  catalog: CatalogResponse;
  loading: boolean;
  /** Human-readable message when the catalog failed to load, else null. */
  error: string | null;
  reload: () => void;
}

const CatalogContext = createContext<CatalogContextValue | null>(null);

export const CatalogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [catalog, setCatalog] = useState<CatalogResponse>(EMPTY_CATALOG);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getCatalog()
      .then((data) => {
        setCatalog(data);
        setLoading(false);
      })
      .catch((err: unknown) => {
        // Catalog load failure never blocks the editor: dropdowns render
        // disabled with a note, manual ingredient entry still works, and
        // the recipe still saves (spec §2.4).
        setCatalog(EMPTY_CATALOG);
        setError(err instanceof Error ? err.message : 'Catalog unavailable.');
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return <CatalogContext.Provider value={{ catalog, loading, error, reload: load }}>{children}</CatalogContext.Provider>;
};

export function useCatalog(): CatalogContextValue {
  const ctx = useContext(CatalogContext);
  if (!ctx) throw new Error('useCatalog must be used within a CatalogProvider');
  return ctx;
}
