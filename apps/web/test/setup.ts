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

// @testing-library/react's own auto-cleanup only registers when `afterEach`
// is a *global* (see its source: `if (typeof afterEach === 'function')`).
// This project's vitest.config.ts does not set `test.globals: true` — every
// test file imports `afterEach` explicitly from 'vitest' instead — so the
// library's auto-detection never fires and previously-rendered DOM leaks
// between tests within the same file. Registered explicitly here instead.
afterEach(() => {
  cleanup();
});
