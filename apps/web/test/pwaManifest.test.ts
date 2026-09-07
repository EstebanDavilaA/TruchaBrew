import { describe, it, expect, beforeAll } from 'vitest';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

// M42_P2 — manifest, icons, and index.html reconciliation (AC-1..19, AC-26,
// AC-35's build-output assertions).
//
// This file is split into two groups:
//  1. Source-tree assertions (manifest JSON, icon files, index.html) that
//     need no build step and run fast on every `npm test`.
//  2. Build-output assertions (AC-26, AC-35) that need a real `vite build`
//     to prove `public/` is copied to `dist/` verbatim. Following the
//     M42_P1 convention (apps/api/test/productionSmoke.test.ts), a
//     `beforeAll` runs the actual production build command once and the
//     dist-output tests assert against its real output — no faking.

const WEB_ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(WEB_ROOT, 'public');
const DIST_DIR = path.join(WEB_ROOT, 'dist');
const MANIFEST_PATH = path.join(PUBLIC_DIR, 'manifest.webmanifest');
const INDEX_HTML_PATH = path.join(WEB_ROOT, 'index.html');

interface ManifestIcon {
  src: string;
  sizes: string;
  type: string;
  purpose?: string;
}

interface Manifest {
  name: string;
  short_name: string;
  description: string;
  start_url: string;
  scope: string;
  display: string;
  background_color: string;
  theme_color: string;
  icons: ManifestIcon[];
}

function readManifest(): Manifest {
  const raw = fs.readFileSync(MANIFEST_PATH, 'utf-8');
  return JSON.parse(raw) as Manifest;
}

/** Reads a PNG's IHDR width/height (big-endian bytes 16-23), and confirms
 * the 8-byte PNG signature. No image library needed — a PNG's dimensions
 * are always at this fixed offset in the first chunk. */
function readPngDimensions(filePath: string): { validSignature: boolean; width: number; height: number } {
  const buf = fs.readFileSync(filePath);
  const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const validSignature = buf.subarray(0, 8).equals(PNG_SIGNATURE);
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  return { validSignature, width, height };
}

describe('M42_P2 AC-1..12: manifest.webmanifest content (exact values, RA-2)', () => {
  it('AC-1: manifest exists and is parseable JSON', () => {
    expect(fs.existsSync(MANIFEST_PATH)).toBe(true);
    expect(() => readManifest()).not.toThrow();
  });

  it('AC-2: name and short_name are exactly "TruchaBrew"', () => {
    const manifest = readManifest();
    expect(manifest.name).toBe('TruchaBrew');
    expect(manifest.short_name).toBe('TruchaBrew');
  });

  it('AC-3: description matches index.html meta description exactly', () => {
    const manifest = readManifest();
    expect(manifest.description).toBe(
      'TruchaBrew — Advanced Homebrewing Recipe Designer & Brewery Management Suite',
    );

    const html = fs.readFileSync(INDEX_HTML_PATH, 'utf-8');
    const match = /<meta\s+name="description"\s+content="([^"]*)"/.exec(html);
    expect(match).not.toBeNull();
    expect(manifest.description).toBe(match![1]);
  });

  it('AC-4: start_url is "/"', () => {
    expect(readManifest().start_url).toBe('/');
  });

  it('AC-5: scope is "/"', () => {
    expect(readManifest().scope).toBe('/');
  });

  it('AC-6: display is "standalone"', () => {
    expect(readManifest().display).toBe('standalone');
  });

  it('AC-7: background_color is exactly "#020617"', () => {
    expect(readManifest().background_color).toBe('#020617');
  });

  it('AC-8: theme_color is exactly "#0f172a"', () => {
    expect(readManifest().theme_color).toBe('#0f172a');
  });

  it('AC-9: exactly one 192 "any" icon entry', () => {
    const icons = readManifest().icons;
    const matches = icons.filter(
      (i) => i.src === '/icons/icon-192.png' && i.sizes === '192x192' && i.type === 'image/png' && i.purpose === 'any',
    );
    expect(matches).toHaveLength(1);
  });

  it('AC-10: exactly one 512 "any" icon entry', () => {
    const icons = readManifest().icons;
    const matches = icons.filter(
      (i) => i.src === '/icons/icon-512.png' && i.sizes === '512x512' && i.type === 'image/png' && i.purpose === 'any',
    );
    expect(matches).toHaveLength(1);
  });

  it('AC-11: exactly one 512 "maskable" icon entry', () => {
    const icons = readManifest().icons;
    const matches = icons.filter(
      (i) =>
        i.src === '/icons/icon-512.png' && i.sizes === '512x512' && i.type === 'image/png' && i.purpose === 'maskable',
    );
    expect(matches).toHaveLength(1);
  });

  it('AC-12: every manifest icon src resolves to an existing file under apps/web/public/', () => {
    const icons = readManifest().icons;
    expect(icons.length).toBeGreaterThan(0);
    for (const icon of icons) {
      expect(icon.src.startsWith('/')).toBe(true);
      const resolved = path.join(PUBLIC_DIR, icon.src);
      expect(fs.existsSync(resolved), `expected ${icon.src} to resolve to an existing file`).toBe(true);
    }
  });

  it('the manifest parses to exactly the spec-binding object (full equality, no extra/missing fields)', () => {
    expect(readManifest()).toEqual({
      name: 'TruchaBrew',
      short_name: 'TruchaBrew',
      description: 'TruchaBrew — Advanced Homebrewing Recipe Designer & Brewery Management Suite',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      background_color: '#020617',
      theme_color: '#0f172a',
      icons: [
        { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    });
  });
});

describe('M42_P2 AC-13..16: index.html reconciliation (additive only)', () => {
  it('AC-13: index.html links the manifest exactly once', () => {
    const html = fs.readFileSync(INDEX_HTML_PATH, 'utf-8');
    const matches = html.match(/<link\s+rel="manifest"\s+href="\/manifest\.webmanifest"\s*\/>/g) ?? [];
    expect(matches).toHaveLength(1);
  });

  it('AC-14: theme-color meta exists and equals the manifest theme_color', () => {
    const html = fs.readFileSync(INDEX_HTML_PATH, 'utf-8');
    const match = /<meta\s+name="theme-color"\s+content="([^"]*)"\s*\/?>/.exec(html);
    expect(match).not.toBeNull();
    expect(match![1]).toBe(readManifest().theme_color);
    expect(match![1]).toBe('#0f172a');
  });

  it('AC-15: apple-touch-icon link present exactly once', () => {
    const html = fs.readFileSync(INDEX_HTML_PATH, 'utf-8');
    const matches = html.match(/<link\s+rel="apple-touch-icon"\s+href="\/icons\/apple-touch-icon\.png"\s*\/>/g) ?? [];
    expect(matches).toHaveLength(1);
  });

  it('AC-16: original favicon.svg link retained, and no second icon rel is introduced', () => {
    const html = fs.readFileSync(INDEX_HTML_PATH, 'utf-8');
    expect(html).toContain('<link rel="icon" type="image/svg+xml" href="/favicon.svg" />');

    // "no second icon rel" — scan every <link> tag and confirm rel="icon"
    // appears on exactly one of them (the retained favicon.svg link).
    const linkTags = html.match(/<link\b[^>]*>/g) ?? [];
    const iconRelLinks = linkTags.filter((tag) => /\brel="icon"/.test(tag));
    expect(iconRelLinks).toHaveLength(1);
    expect(iconRelLinks[0]).toContain('/favicon.svg');
  });
});

describe('M42_P2 AC-17..19: icon files — PNG signature + exact pixel dimensions', () => {
  it('AC-17: icon-192.png exists, valid PNG signature, exactly 192x192', () => {
    const file = path.join(PUBLIC_DIR, 'icons', 'icon-192.png');
    expect(fs.existsSync(file)).toBe(true);
    const { validSignature, width, height } = readPngDimensions(file);
    expect(validSignature).toBe(true);
    expect(width).toBe(192);
    expect(height).toBe(192);
  });

  it('AC-18: icon-512.png exists, valid PNG signature, exactly 512x512', () => {
    const file = path.join(PUBLIC_DIR, 'icons', 'icon-512.png');
    expect(fs.existsSync(file)).toBe(true);
    const { validSignature, width, height } = readPngDimensions(file);
    expect(validSignature).toBe(true);
    expect(width).toBe(512);
    expect(height).toBe(512);
  });

  it('AC-19: apple-touch-icon.png exists, valid PNG signature, exactly 180x180', () => {
    const file = path.join(PUBLIC_DIR, 'icons', 'apple-touch-icon.png');
    expect(fs.existsSync(file)).toBe(true);
    const { validSignature, width, height } = readPngDimensions(file);
    expect(validSignature).toBe(true);
    expect(width).toBe(180);
    expect(height).toBe(180);
  });
});

describe('M42_P2 AC-26, AC-35 (build-output portion): vite build copies public/ to dist/ verbatim', () => {
  beforeAll(() => {
    // Build the real artifact with the exact production command, same
    // convention as apps/api/test/productionSmoke.test.ts (RA-10 there).
    execSync('npm run build', { cwd: WEB_ROOT, stdio: 'pipe' });
  }, 120_000);

  it('AC-26: dist/sw.js exists after build (copied from public/, origin-root location implies scope "/")', () => {
    const distSw = path.join(DIST_DIR, 'sw.js');
    expect(fs.existsSync(distSw)).toBe(true);
    expect(fs.readFileSync(distSw, 'utf-8')).toBe(fs.readFileSync(path.join(PUBLIC_DIR, 'sw.js'), 'utf-8'));
  });

  it('AC-35: dist/manifest.webmanifest, dist/icons/*.png all exist after build, copied verbatim', () => {
    const distManifest = path.join(DIST_DIR, 'manifest.webmanifest');
    expect(fs.existsSync(distManifest)).toBe(true);
    expect(fs.readFileSync(distManifest, 'utf-8')).toBe(fs.readFileSync(MANIFEST_PATH, 'utf-8'));

    for (const icon of ['icon-192.png', 'icon-512.png', 'apple-touch-icon.png']) {
      const distIcon = path.join(DIST_DIR, 'icons', icon);
      expect(fs.existsSync(distIcon), `expected dist/icons/${icon} to exist`).toBe(true);
      expect(fs.readFileSync(distIcon).equals(fs.readFileSync(path.join(PUBLIC_DIR, 'icons', icon)))).toBe(true);
    }
  });

  it('AC-35: dist/index.html references /manifest.webmanifest', () => {
    const distIndex = path.join(DIST_DIR, 'index.html');
    expect(fs.existsSync(distIndex)).toBe(true);
    const html = fs.readFileSync(distIndex, 'utf-8');
    expect(html).toContain('/manifest.webmanifest');
  });
});
