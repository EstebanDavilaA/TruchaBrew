import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// M27_P1 — react-router's data router (createBrowserRouter, RA-2) constructs
// a `Request` object on every navigation via Node's native fetch internals
// (createClientSideRequest), passing an AbortSignal from an AbortController
// it creates itself. jsdom's test environment installs its OWN AbortController
// implementation over the global, which Node's native Request rejects (its
// internal webidl brand check for `signal` is tied to Node's own AbortSignal
// class, not jsdom's). Since Request itself is untouched by jsdom (still
// Node's native class), the safe fix is narrower than replacing
// AbortController globally: strip the incompatible `signal` before
// delegating to the real Request constructor. This only affects Request
// objects built for react-router's internal navigation bookkeeping in
// tests — none of this app's routes have loaders/actions that would
// otherwise consume that signal for real cancellation.
const NativeRequest = globalThis.Request;
class TestEnvRequest extends NativeRequest {
  constructor(input: RequestInfo | URL, init?: RequestInit) {
    if (init && 'signal' in init) {
      const { signal: _incompatibleSignal, ...rest } = init;
      super(input, rest);
    } else {
      super(input, init);
    }
  }
}
globalThis.Request = TestEnvRequest as unknown as typeof Request;

// Node 26+ ships its own experimental global `localStorage` accessor (gated
// behind `--localstorage-file`, unset here), and this project's jsdom
// version (25.0.1) no longer implements Storage itself — it defers to the
// host's global, which resolves to Node's disabled implementation
// (undefined) on both `globalThis.localStorage` and `window.localStorage`.
// A minimal in-memory Storage polyfill, defined directly rather than
// derived from either global, restores it for tests.
class MemoryStorage implements Storage {
  #store = new Map<string, string>();
  get length() {
    return this.#store.size;
  }
  clear() {
    this.#store.clear();
  }
  getItem(key: string) {
    return this.#store.has(key) ? this.#store.get(key)! : null;
  }
  key(index: number) {
    return Array.from(this.#store.keys())[index] ?? null;
  }
  removeItem(key: string) {
    this.#store.delete(key);
  }
  setItem(key: string, value: string) {
    this.#store.set(key, String(value));
  }
}
for (const target of [globalThis, window]) {
  Object.defineProperty(target, 'localStorage', {
    value: new MemoryStorage(),
    configurable: true,
    writable: true,
  });
}

// @testing-library/react's own auto-cleanup only registers when `afterEach`
// is a *global* (see its source: `if (typeof afterEach === 'function')`).
// This project's vitest.config.ts does not set `test.globals: true` — every
// test file imports `afterEach` explicitly from 'vitest' instead — so the
// library's auto-detection never fires and previously-rendered DOM leaks
// between tests within the same file. Registered explicitly here instead.
afterEach(() => {
  cleanup();
});
