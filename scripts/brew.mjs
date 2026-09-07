#!/usr/bin/env node
// The one command (RA-3): a fresh unzip to a running server, on Windows,
// macOS and Linux alike, via one npm script. Runs BEFORE `npm install` has
// ever executed, so it may import ONLY node:-prefixed builtins plus the one
// relative module below (RA-5) — a single bare package specifier would fail
// on a fresh unzip with a module-not-found error.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { isSupportedNodeVersion, MINIMUM_NODE_MAJOR, NODE_DOWNLOAD_URL } from './nodeVersion.mjs';

// The package root is one level above this file's directory — the same
// idiom apps/api/src/index.ts already uses.
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Step 1, before anything else: the version gate. No child process is ever
// spawned on this path (AC-8).
if (!isSupportedNodeVersion(process.version)) {
  console.error(
    [
      `TruchaBrew needs Node.js ${MINIMUM_NODE_MAJOR} or newer to run.`,
      `This machine is running ${process.version}.`,
      `Download the latest version from ${NODE_DOWNLOAD_URL}, install it, then run "npm run brew" again.`,
    ].join('\n'),
  );
  process.exit(1);
}

// Every child process below uses this exact shape: `shell: process.platform
// === 'win32'` is the same flag scripts/typecheck-all.mjs already uses —
// without it, spawnSync('npm', ...) fails on Windows because npm is
// npm.cmd.
const SPAWN_OPTIONS = {
  cwd: repoRoot,
  stdio: 'inherit',
  shell: process.platform === 'win32',
};

// Step 2: npm install. Unconditional (RA-7) — this must NOT short-circuit by
// checking whether node_modules/ already exists; that check is wrong after a
// git pull or a partially-failed first install, and npm deciding there is
// nothing to do is a fast no-op anyway.
console.log('\n> npm install');
const install = spawnSync('npm', ['install'], SPAWN_OPTIONS);
if (install.status !== 0) {
  console.error(`\nTruchaBrew setup failed while running "npm install" (exit code ${install.status}).`);
  process.exit(install.status ?? 1);
}

// Step 3: npm run build.
console.log('\n> npm run build');
const build = spawnSync('npm', ['run', 'build'], SPAWN_OPTIONS);
if (build.status !== 0) {
  console.error(`\nTruchaBrew setup failed while running "npm run build" (exit code ${build.status}).`);
  process.exit(build.status ?? 1);
}

// Step 4: npm start — this is the process's remaining lifetime. Ctrl+C
// reaches the child through the inherited stdio/process group and ends
// both. Whatever status it exits with is exactly what this process exits
// with — never swallowed, remapped, or retried.
console.log('\n> npm start');
const start = spawnSync('npm', ['start'], SPAWN_OPTIONS);
process.exit(start.status ?? 1);
