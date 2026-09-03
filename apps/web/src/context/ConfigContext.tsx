import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { UserConfig, UserConfigInput } from '@truchabrew/shared-types';
import { DEFAULT_USER_CONFIG } from '@truchabrew/calculations';

// ---------------------------------------------------------------------------
// M7_P1 amendment §1.4/§2.2.2 — GET/PUT /api/config helpers, MOVED here from
// SettingsManager.tsx (not duplicated). Deliberately NOT routed through
// apps/web/src/api/client.ts, which is on §1.4's Untouched list — this
// mirrors SettingsManager.tsx's pre-amendment self-contained fetch exactly,
// including its ApiErrorBody-shaped failure handling.
// ---------------------------------------------------------------------------

class ConfigApiError extends Error {}

async function requestConfig<T>(init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch('/api/config', {
      ...init,
      headers: {
        ...(init?.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    throw new ConfigApiError('Network error: could not reach the server.');
  }

  const text = await response.text();
  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : undefined;
  } catch {
    parsed = undefined;
  }

  if (!response.ok) {
    const body = parsed as { error?: { message?: string } } | undefined;
    throw new ConfigApiError(body?.error?.message ?? `Request failed with status ${response.status}.`);
  }

  return parsed as T;
}

function getConfig(): Promise<UserConfig> {
  return requestConfig<UserConfig>();
}

function putConfig(input: UserConfigInput): Promise<UserConfig> {
  return requestConfig<UserConfig>({ method: 'PUT', body: JSON.stringify(input) });
}

// ---------------------------------------------------------------------------
// §2.2.2 stateful contract
// ---------------------------------------------------------------------------

export interface ConfigContextValue {
  /** Never null — see the fallback rule below. */
  config: UserConfig;
  status: 'loading' | 'ready' | 'error';
  /** Non-null only when status === 'error'. */
  error: string | null;
  /** Replaces the shared config (used by SettingsManager after a successful PUT). */
  applyConfig: (next: UserConfig) => void;
  reload: () => void;
}

const ConfigContext = createContext<ConfigContextValue | null>(null);

export const ConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Fallback rule (§2.2.2, binding): before the mount-time GET resolves, and
  // if it fails, `config` is DEFAULT_USER_CONFIG — byte-identical to what
  // migration 0010 seeds, so this is a safe RENDER fallback only. It must
  // never be PUT (putConfig is only ever called from SettingsManager's own
  // handleChange, gated on status === 'ready' there) and SettingsManager
  // must never present it as the user's saved settings (branches on
  // `status`, not on `config` alone).
  const [config, setConfig] = useState<UserConfig>(DEFAULT_USER_CONFIG);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setStatus('loading');
    setError(null);
    getConfig()
      .then((data) => {
        setConfig(data);
        setStatus('ready');
      })
      .catch((err: unknown) => {
        // The fallback config is left in place (DEFAULT_USER_CONFIG on first
        // mount, or whatever was last successfully loaded on a later
        // reload() failure) — only `status`/`error` move.
        setError(err instanceof ConfigApiError ? err.message : 'Failed to load settings.');
        setStatus('error');
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const applyConfig = useCallback((next: UserConfig) => {
    setConfig(next);
  }, []);

  return (
    <ConfigContext.Provider value={{ config, status, error, applyConfig, reload: load }}>{children}</ConfigContext.Provider>
  );
};

export function useConfig(): ConfigContextValue {
  const ctx = useContext(ConfigContext);
  if (!ctx) throw new Error('useConfig must be used within a ConfigProvider');
  return ctx;
}

// Re-exported so SettingsManager.tsx's PUT call site doesn't need a second,
// duplicated fetch helper — the whole point of "moved, not duplicated".
export { putConfig, ConfigApiError };
