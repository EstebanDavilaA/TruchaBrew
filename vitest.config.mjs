import { defineConfig } from 'vitest/config';

// RA-9: this `include` is load-bearing and deliberately narrow. Vitest's
// default include pattern would otherwise also collect every apps/**
// workspace test file a second time from the repo root (AC-12) — this repo
// has no root-level tests besides the packaging suite below.
export default defineConfig({
  test: {
    include: ['test/packaging.test.mjs'],
  },
});
