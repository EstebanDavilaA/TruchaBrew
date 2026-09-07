import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  SERVICE_WORKER_URL,
  shouldRegisterServiceWorker,
  registerServiceWorker,
  type SWRegistrationDeps,
} from '../src/pwa/registerSW';

const WEB_ROOT = path.resolve(__dirname, '..');
const SW_PATH = path.join(WEB_ROOT, 'public', 'sw.js');
const MAIN_TSX_PATH = path.join(WEB_ROOT, 'src', 'main.tsx');

describe('M42_P2 AC-27..29: shouldRegisterServiceWorker — pure decision matrix', () => {
  it('AC-27: true when isProd and serviceWorkerAvailable are both true', () => {
    expect(shouldRegisterServiceWorker({ isProd: true, serviceWorkerAvailable: true })).toBe(true);
  });

  it('AC-28: false in dev (isProd false) even when a service worker container is available', () => {
    expect(shouldRegisterServiceWorker({ isProd: false, serviceWorkerAvailable: true })).toBe(false);
  });

  it('AC-29: false when no service worker container is available, regardless of isProd; false when both are false', () => {
    expect(shouldRegisterServiceWorker({ isProd: true, serviceWorkerAvailable: false })).toBe(false);
    expect(shouldRegisterServiceWorker({ isProd: false, serviceWorkerAvailable: false })).toBe(false);
  });

  it('SERVICE_WORKER_URL is exactly "/sw.js"', () => {
    expect(SERVICE_WORKER_URL).toBe('/sw.js');
  });
});

describe('M42_P2 AC-30..32: registerServiceWorker — stateful register with injected deps', () => {
  it('AC-30: registers exactly SERVICE_WORKER_URL, once, with no scope option, and resolves true on success', async () => {
    const calls: Array<{ url: string; opts: RegistrationOptions | undefined }> = [];
    const fakeRegister: SWRegistrationDeps['serviceWorker'] = {
      register: async (url, opts) => {
        calls.push({ url, opts });
        return { scope: '/' };
      },
    };

    const result = await registerServiceWorker({ isProd: true, serviceWorker: fakeRegister });

    expect(result).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('/sw.js');
    expect(calls[0].url).toBe(SERVICE_WORKER_URL);
    expect(calls[0].opts).toBeUndefined();
  });

  it('AC-31: guards non-prod — resolves false and never calls register()', async () => {
    let called = false;
    const fakeRegister: SWRegistrationDeps['serviceWorker'] = {
      register: async () => {
        called = true;
        return undefined;
      },
    };

    const result = await registerServiceWorker({ isProd: false, serviceWorker: fakeRegister });

    expect(result).toBe(false);
    expect(called).toBe(false);
  });

  it('AC-31: guards absent service worker container — resolves false, does not throw', async () => {
    await expect(registerServiceWorker({ isProd: true, serviceWorker: undefined })).resolves.toBe(false);
  });

  it('AC-32: swallows a register() rejection — resolves false, does not throw', async () => {
    const rejectingDeps: SWRegistrationDeps = {
      isProd: true,
      serviceWorker: { register: () => Promise.reject(new Error('x')) },
    };

    await expect(registerServiceWorker(rejectingDeps)).resolves.toBe(false);
  });
});

describe('M42_P2 AC-33: main.tsx registers the service worker', () => {
  it('imports registerServiceWorker from the PWA module and calls it fire-and-forget', () => {
    const content = fs.readFileSync(MAIN_TSX_PATH, 'utf-8');

    expect(content).toMatch(
      /import\s*\{\s*registerServiceWorker\s*\}\s*from\s*['"]\.\/pwa\/registerSW['"]/,
    );
    expect(content).toMatch(/void\s+registerServiceWorker\(\s*\)\s*;/);
  });
});

// ---------------------------------------------------------------------------
// M42_P2 AC-20..25: sw.js static source contract (RA-4/RA-5).
//
// jsdom cannot execute a real service worker, so the no-stale-data guarantee
// is proven here as a static source contract on the literal file content,
// same static-sweep style as controlTargetSize.test.ts's Tailwind-class
// sweeps: read the file with fs, assert on its text.
// ---------------------------------------------------------------------------

/** Extracts the full text of a balanced-parenthesis call expression starting
 * at `openParenIdx` (the index of the call's opening "("), tracking string
 * literals so a ")" inside a string never miscounts. Returns the full
 * "(...)" substring including both parens. */
function extractBalancedParens(source: string, openParenIdx: number): string {
  let i = openParenIdx;
  let depth = 0;
  let inString: string | null = null;
  for (; i < source.length; i++) {
    const ch = source[i];
    if (inString) {
      if (ch === '\\') {
        i++;
        continue;
      }
      if (ch === inString) inString = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      inString = ch;
      continue;
    }
    if (ch === '(') depth++;
    else if (ch === ')') {
      depth--;
      if (depth === 0) return source.slice(openParenIdx, i + 1);
    }
  }
  throw new Error(`sw.js static contract: unterminated call starting at index ${openParenIdx}`);
}

/** Finds the full `self.addEventListener('eventName', ...)` call (args
 * included) for the given event name, or throws if none exists. */
function extractListenerCall(source: string, eventName: string): string {
  const markerRe = new RegExp(`addEventListener\\(\\s*['"]${eventName}['"]`);
  const markerMatch = markerRe.exec(source);
  if (!markerMatch) {
    throw new Error(`sw.js static contract: no addEventListener('${eventName}', ...) call found`);
  }
  const callKeywordIdx = source.lastIndexOf('addEventListener', markerMatch.index);
  const openParenIdx = source.indexOf('(', callKeywordIdx);
  return extractBalancedParens(source, openParenIdx);
}

describe('M42_P2 AC-20..25: sw.js — network-passthrough static contract', () => {
  it('AC-20: sw.js exists at the public root and is non-empty', () => {
    expect(fs.existsSync(SW_PATH)).toBe(true);
    const stat = fs.statSync(SW_PATH);
    expect(stat.size).toBeGreaterThan(0);
  });

  it('AC-21: install listener calls self.skipWaiting()', () => {
    const source = fs.readFileSync(SW_PATH, 'utf-8');
    const installCall = extractListenerCall(source, 'install');
    expect(installCall).toMatch(/self\.skipWaiting\(\s*\)/);
  });

  it('AC-22: activate listener calls self.clients.claim()', () => {
    const source = fs.readFileSync(SW_PATH, 'utf-8');
    const activateCall = extractListenerCall(source, 'activate');
    expect(activateCall).toMatch(/self\.clients\.claim\(\s*\)/);
  });

  it('AC-23: fetch listener calls event.respondWith(fetch(event.request)) — pure network passthrough', () => {
    const source = fs.readFileSync(SW_PATH, 'utf-8');
    const fetchCall = extractListenerCall(source, 'fetch');
    expect(fetchCall).toMatch(/event\.respondWith\(\s*fetch\(\s*event\.request\s*\)\s*\)/);
  });

  it('AC-24: zero occurrences of any Cache Storage API construct (no-stale guarantee)', () => {
    const source = fs.readFileSync(SW_PATH, 'utf-8');
    const forbidden = ['caches', 'CacheStorage', 'cache.', 'cache.add', 'cache.put', 'cache.match', 'addAll'];
    for (const token of forbidden) {
      expect(source.includes(token), `sw.js must not contain forbidden construct "${token}"`).toBe(false);
    }
  });

  it('AC-25: no waitUntil used for precaching, and every respondWith argument is exactly fetch(event.request)', () => {
    const source = fs.readFileSync(SW_PATH, 'utf-8');

    // This file uses no waitUntil at all — the strictest possible reading
    // of "no waitUntil used for precaching".
    expect(source.includes('waitUntil')).toBe(false);

    const respondWithCalls = source.match(/respondWith\([\s\S]*?\)\)/g) ?? [];
    expect(respondWithCalls.length).toBeGreaterThan(0);
    for (const call of respondWithCalls) {
      expect(call.replace(/\s+/g, '')).toBe('respondWith(fetch(event.request))');
    }
  });

  it('sw.js is a classic script — no import/module syntax', () => {
    const source = fs.readFileSync(SW_PATH, 'utf-8');
    expect(source).not.toMatch(/\bimport\s+.*\bfrom\b/);
    expect(source).not.toMatch(/\bexport\s+(default|const|function|class)\b/);
  });
});
