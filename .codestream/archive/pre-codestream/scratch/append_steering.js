import fs from 'node:fs';

const steeringPath = '.gsd/archive/STEERING_LOG.md';
const existingContent = fs.readFileSync(steeringPath, 'utf8');

const newEntry = `
---

## Milestone 28, Phase 1 — Steering Checkpoint (2026-08-22)

### Summary

Milestone 28 Phase 1 ("A sidebar organized the way brewing works") reorganizes the sidebar navigation from a flat 9-item list into two domain-meaningful clusters: **Brew** (operational items: Recipes, Batches, Inventory, Calculators) and **Library** (shelf configuration: Equipment Profiles, Mash Profiles, Fermentation Profiles, Water Profiles, Settings).

The grouping applies uniformly across all three navigation presentations:
1. **Desktop Expanded Sidebar** (\`Sidebar.tsx\`, \`collapsed === false\`): Category headers rendered with uppercase tracked typography (\`text-slate-400\`).
2. **Desktop Collapsed Sidebar** (\`Sidebar.tsx\`, \`collapsed === true\`): Text headers omitted from the DOM, and a subtle divider (\`<div role="separator" />\`) separating the icon clusters.
3. **Mobile Off-Canvas Drawer** (\`MobileNav.tsx\`): Category headers rendered matching expanded desktop navigation.

Every existing destination remains accessible with unchanged routes, active-view resolution, and keyboard accessibility.

### Verification Reference

- **Executor tests (Layer 1):** 1,941 passed / 2 skipped / 0 failed across 119 test files (api: 438, web: 901, calculations: 602+2 skipped). Typecheck, build, and lint all exit 0.
- **Critic verdict (Layer 2):** PASS — all 15 ACs YES (\`.gsd/archive/CRITIC_REPORT.md\`, 2026-08-22 entry).
- **Regression (Layer 3):** Clean. Monotonic test progression: M27_P1 baseline 1,934 → M28_P1 current 1,941 (+7 net tests). All prior milestone test suites pass unchanged.
- **Scope guardrail (AC-14):** SHA-256 pre/post manifest diff confirmed exactly 4 authorized files modified (\`Sidebar.tsx\`, \`MobileNav.tsx\`, \`Sidebar.test.tsx\`, \`MobileNav.test.tsx\`).

### Decision

- **Option selected:** Pending human steering selection
- **Notes:** Milestone 28 Phase 1 is verification-clean across all three layers. Phase 1 of an estimated 1 — this is the closing phase for Milestone 28 (and the final scheduled milestone in ROADMAP.md).
`;

fs.writeFileSync(steeringPath, existingContent.trimEnd() + '\n\n' + newEntry, 'utf8');
console.log('Appended M28_P1 entry to STEERING_LOG.md');
