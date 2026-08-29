#!/usr/bin/env node
// Runs every workspace's typecheck independently and reports failures from
// ALL of them, not just the first. The previous `&&`-chained npm script
// (`tsc ... && tsc ... && npm run typecheck --workspace=web && ...`) stopped
// dead at the first failing workspace, so a failure in packages/calculations
// silently hid every error in apps/web and apps/api behind it — this is how
// 62+29 real type errors across those two workspaces went undetected across
// three separate "PASS" claims (see .gsd/archive/CRITIC_REPORT_M4_P1.md,
// finding F-11 / M4_P1 spec AC-11(a)).
import { spawnSync } from 'node:child_process';

const checks = [
  { name: 'packages/shared-types', command: 'npx', args: ['tsc', '-p', 'packages/shared-types/tsconfig.json', '--noEmit'] },
  { name: 'packages/calculations', command: 'npx', args: ['tsc', '-p', 'packages/calculations/tsconfig.json', '--noEmit'] },
  { name: '@truchabrew/web', command: 'npm', args: ['run', 'typecheck', '--workspace=@truchabrew/web'] },
  { name: '@truchabrew/api', command: 'npm', args: ['run', 'typecheck', '--workspace=@truchabrew/api'] },
];

let anyFailed = false;
const results = [];

for (const check of checks) {
  const result = spawnSync(check.command, check.args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  const passed = result.status === 0;
  if (!passed) anyFailed = true;
  results.push({ name: check.name, passed, status: result.status });
}

console.log('\n--- typecheck summary ---');
for (const r of results) {
  console.log(`${r.passed ? 'PASS' : 'FAIL'}  ${r.name}${r.passed ? '' : `  (exit ${r.status})`}`);
}

process.exit(anyFailed ? 1 : 0);
