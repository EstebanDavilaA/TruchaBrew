import path from 'node:path';

// Environment variable names — exported so no call site hand-writes a literal.
export const ENV_DB_PATH = 'TRUCHABREW_DB_PATH';
export const ENV_MIGRATIONS_DIR = 'TRUCHABREW_MIGRATIONS_DIR';
export const ENV_STATIC_ROOT = 'TRUCHABREW_STATIC_ROOT';
export const ENV_PORT = 'PORT';
export const ENV_HOST = 'HOST';

export const DEFAULT_PORT = 5177;
export const DEFAULT_HOST = '0.0.0.0';

export interface RuntimeConfig {
  /** Absolute path to the SQLite database file. */
  dbPath: string;
  /** Absolute path to the drizzle migrations directory. */
  migrationsDir: string;
  /** Absolute path to the built web UI root; may point at a non-existent dir. */
  staticRoot: string;
  port: number;
  host: string;
}

/**
 * Reads an env var from `env`, treating undefined and whitespace-only values
 * as unset (RA-9: a `.env` line like `PORT=` must not produce `NaN`).
 */
function readEnv(env: NodeJS.ProcessEnv, name: string): string | undefined {
  const value = env[name];
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

/**
 * Pure: resolves runtime config from an env bag and a package-root anchor.
 * Performs no filesystem access and never reads `process.env` directly.
 */
export function resolveConfig(env: NodeJS.ProcessEnv, packageRoot: string): RuntimeConfig {
  const dbPath = path.resolve(packageRoot, readEnv(env, ENV_DB_PATH) ?? path.join('data', 'truchabrew.db'));
  const migrationsDir = path.resolve(packageRoot, readEnv(env, ENV_MIGRATIONS_DIR) ?? 'drizzle');
  const staticRoot = path.resolve(
    packageRoot,
    readEnv(env, ENV_STATIC_ROOT) ?? path.join('..', 'web', 'dist'),
  );
  const port = parsePort(readEnv(env, ENV_PORT));
  const host = readEnv(env, ENV_HOST) ?? DEFAULT_HOST;
  return { dbPath, migrationsDir, staticRoot, port, host };
}

function parsePort(raw: string | undefined): number {
  if (raw === undefined) return DEFAULT_PORT;
  const num = Number(raw);
  if (!Number.isInteger(num) || num <= 0) {
    throw new Error(`Invalid PORT: "${raw}" (must be a positive integer)`);
  }
  return num;
}

/**
 * Pure: LAN-reachable URLs for a bind host+port. Returns `http://localhost:<port>`
 * first, then one `http://<ipv4>:<port>` per non-internal IPv4 interface address
 * (deduplicated). When `host` is not `0.0.0.0`/`::`, returns exactly
 * `http://<host>:<port>` and consults no interfaces. Never returns an empty array.
 */
export function describeListenAddresses(
  host: string,
  port: number,
  interfaces: Record<string, Array<{ address: string; family: string; internal: boolean }> | undefined>,
): string[] {
  if (host !== '0.0.0.0' && host !== '::') {
    return [`http://${host}:${port}`];
  }

  const urls: string[] = [`http://localhost:${port}`];
  const seen = new Set<string>();
  for (const key of Object.keys(interfaces)) {
    const addrs = interfaces[key];
    if (!addrs) continue;
    for (const a of addrs) {
      if (a.family === 'IPv4' && !a.internal && !seen.has(a.address)) {
        seen.add(a.address);
        urls.push(`http://${a.address}:${port}`);
      }
    }
  }
  return urls;
}
