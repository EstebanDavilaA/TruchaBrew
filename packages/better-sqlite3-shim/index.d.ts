// Minimal type surface for the subset of the better-sqlite3 API this repo
// actually uses (via drizzle-orm/better-sqlite3, and directly in
// apps/api/src/db/client.ts and routes/health.ts). See index.js for why
// this shim exists.

export interface RunResult {
  changes: number | bigint;
  lastInsertRowid: number | bigint;
}

export interface Statement {
  run(...params: unknown[]): RunResult;
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
  raw(): Statement;
}

export interface PragmaOptions {
  simple?: boolean;
}

export type TransactionFunction<A extends unknown[], R> = ((...args: A) => R) & {
  deferred: (...args: A) => R;
  immediate: (...args: A) => R;
  exclusive: (...args: A) => R;
};

export default class Database {
  constructor(filePath?: string, options?: unknown);
  prepare(sql: string): Statement;
  exec(sql: string): this;
  close(): this;
  pragma(pragmaStatement: string, options?: PragmaOptions): unknown;
  transaction<A extends unknown[], R>(fn: (...args: A) => R): TransactionFunction<A, R>;
}
