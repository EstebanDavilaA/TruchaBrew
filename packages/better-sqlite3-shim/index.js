import { DatabaseSync } from 'node:sqlite';

/**
 * Implements the subset of the `better-sqlite3` `Database` API that
 * `drizzle-orm/better-sqlite3`'s driver calls, backed by Node's built-in
 * `node:sqlite` instead of a native addon.
 *
 * Why this package exists (not a real driver swap): `better-sqlite3` needs
 * a prebuilt binary for this Node ABI/OS/arch, or a local MSVC toolchain to
 * compile it from source; neither is available here (see M2_P1 spec,
 * "Known execution risks"). drizzle-orm's own `node:sqlite`-backed driver
 * (`drizzle-orm/node-sqlite`) only ships in the 1.0 pre-release line, which
 * carries an incompatible, redesigned relational-query API. Publishing this
 * package as a local workspace member and aliasing the real `better-sqlite3`
 * to it via the root `package.json`'s `overrides` field lets
 * `drizzle-orm/better-sqlite3` — the stable, already-integrated driver —
 * run unmodified against `node:sqlite`. Application code never imports this
 * package directly; only `import Client from 'better-sqlite3'` inside
 * drizzle-orm's driver resolves here.
 */
export default class Database {
  #raw;

  constructor(filePath, _options) {
    this.#raw = new DatabaseSync(filePath ?? ':memory:');
  }

  prepare(sql) {
    return new Statement(this.#raw.prepare(sql));
  }

  exec(sql) {
    this.#raw.exec(sql);
    return this;
  }

  close() {
    this.#raw.close();
    return this;
  }

  pragma(pragmaStatement, options) {
    const stmt = this.#raw.prepare(`PRAGMA ${pragmaStatement}`);
    if (options && options.simple) {
      const row = stmt.get();
      if (!row) return undefined;
      return Object.values(row)[0];
    }
    return stmt.all();
  }

  /**
   * Mirrors better-sqlite3's `Database.prototype.transaction`: wraps `fn`
   * in BEGIN/COMMIT (ROLLBACK on throw), exposing `.deferred` / `.immediate`
   * / `.exclusive` variants — drizzle's better-sqlite3 session picks one of
   * those by name (`nativeTx[config.behavior ?? 'deferred'](tx)`). Nested
   * transactions are handled by drizzle itself via SQL SAVEPOINTs issued
   * through `run()`, so this only needs to support one level.
   */
  transaction(fn) {
    const raw = this.#raw;
    const runWith = (beginMode) => {
      return (...args) => {
        raw.exec(`BEGIN ${beginMode}`);
        try {
          const result = fn(...args);
          raw.exec('COMMIT');
          return result;
        } catch (err) {
          try {
            raw.exec('ROLLBACK');
          } catch {
            // ignore rollback failure — the original error is what matters
          }
          throw err;
        }
      };
    };
    const deferred = runWith('DEFERRED');
    deferred.deferred = deferred;
    deferred.immediate = runWith('IMMEDIATE');
    deferred.exclusive = runWith('EXCLUSIVE');
    return deferred;
  }
}

class Statement {
  #stmt;
  #rawMode = false;

  constructor(stmt) {
    this.#stmt = stmt;
  }

  run(...params) {
    const info = this.#stmt.run(...params);
    return { changes: info.changes, lastInsertRowid: info.lastInsertRowid };
  }

  get(...params) {
    if (this.#rawMode) this.#stmt.setReturnArrays(true);
    const row = this.#stmt.get(...params);
    if (this.#rawMode) this.#stmt.setReturnArrays(false);
    return row;
  }

  all(...params) {
    if (this.#rawMode) this.#stmt.setReturnArrays(true);
    const rows = this.#stmt.all(...params);
    if (this.#rawMode) this.#stmt.setReturnArrays(false);
    return rows;
  }

  raw() {
    this.#rawMode = true;
    return this;
  }
}
