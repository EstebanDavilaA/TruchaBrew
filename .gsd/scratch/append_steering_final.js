import fs from 'node:fs';

const steeringPath = '.gsd/archive/STEERING_LOG.md';
const existingContent = fs.readFileSync(steeringPath, 'utf8');

const newEntry = `
---

## 2026-08-22 — Milestone 28 Phase 1: Steering Decision (Final)

### Decision
- **Option selected:** Option D (Complete Milestone)
- **Notes:** User selected Option D at the M28_P1 steering checkpoint following clean verification (Layer 1: 1,941 passed/2 skipped across 119 files, 4 gates clean; Layer 2: critic PASS across all 15 ACs; Layer 3: clean monotonic regression 1,934 -> 1,941 tests; AC-14 scope guardrail verified). Milestone 28 ("A sidebar organized the way brewing works") is marked COMPLETE in full. Active spec \`M28_P1_feature_spec.md\` archived to \`.gsd/archive/specs/\` and removed from \`.gsd/active/\`. All 28 roadmap milestones are now complete.
`;

fs.writeFileSync(steeringPath, existingContent.trimEnd() + '\n\n' + newEntry, 'utf8');
console.log('Appended final decision to STEERING_LOG.md');
