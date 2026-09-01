// Structural STATE.json edit (rule 17): append the Layer 1 completion entry.
import fs from 'node:fs';

const path = '.gsd/STATE.json';
const raw = fs.readFileSync(path, 'utf8');
const state = JSON.parse(raw); // real parse

const entry = {
  date: '2026-08-31',
  state: 3,
  agent: 'claude-code',
  event:
    "Layer 1 execution complete for M37_P1 (Bounded Multi-Ion Least-Squares Solver, 20 ACs). Built packages/calculations/src/waterOptimization.ts (new): bounded NNLS via constrained coordinate descent with ternary-search per-coordinate minimization, asymmetric overshoot penalties (Ca 2.5, Na 3.0, Mg 2.0 per RA-1), and all constants aligned to SALT_CONTRIBUTIONS (RA-2). Exports solveOptimalSalts and optimizeWaterProfile (salts, resultingWater, residualDeltas, sulfateToChlorideRatio, fitScorePct). suggestSaltAdditions refactored to delegate to the solver, signature/shape unchanged (AC-15); exported via index.ts. Circular import between water.ts and waterOptimization.ts handled via lazy getSalts() (read at call time, not module-eval). Test suite: waterOptimization.test.ts (19 tests) covering AC-1..AC-15 incl. 10 world-water fixtures, plus existing water.test.ts green (canonical salt-order pin preserved). BUG-024 RESOLVED: the M23_P2 fixture (RO->Balanced IPA, 23L) now lands SO4=150.6 (was 189.6), SO4:Cl=2.48 (was 3.16 vs intended 2.5), Ca=96.4 no overshoot, fit 82.77%. SPEC-GAP AMENDMENT (RA-3): apps/web/test/WaterCalculatorModal.test.tsx value pins reconciled to the solver's corrected outputs (Gypsum 23.41->23.16 total / 14.05->13.9 mash / 9.36->9.26 sparge; CaCl2 10.87->11.01; Epsom 8.85->0.49; Baking Soda 4.82->3.52; AC-20 acid 3.34->3.31) — the spec authorized changing suggestSaltAdditions but omitted this downstream test from its authorized list; intent is unambiguous (BUG-024), reconcile documented in the spec. Layer 1 gates: test (2,374 passed / 2 skipped across 126 files: 473 api + 1,279 web + 622 calculations, exceeds the 2,355/125 baseline), typecheck (4/4 PASS), build (clean in 1.28s), lint (0 errors, 4 pre-existing warnings, 0 new). Scope check via SHA-256 pre/post manifest: authorized set (waterOptimization.ts + water.test.ts NOT modified but green, water.ts, index.ts, waterOptimization.test.ts new, BUGS.md, STATE.json) + RA-3 reconcile (WaterCalculatorModal.test.tsx) + framework files; 0 created in web/api, 0 deleted. BUGS.md BUG-024 status updated DEFERRED_TO_MILESTONE -> RESOLVED_M37_P1 with resolution note. HALTED for /steer."
};

state.state_history.push(entry);
state.current_state = 3;
state.last_action =
  'State 3 /execute complete for M37_P1 (Layer 1 four gates green; BUG-024 resolved; RA-3 spec-gap reconcile documented). HALTED — awaiting user invocation of /steer (Layer 2 critic audit + Layer 3 regression run inside /steer per rule 15).';

fs.writeFileSync(path, JSON.stringify(state, null, 4) + '\n', 'utf8');

// re-parse to confirm valid JSON (rule 17)
const after = JSON.parse(fs.readFileSync(path, 'utf8'));
console.log(
  'Re-parse OK. entries:',
  after.state_history.length,
  '| last entry state:',
  after.state_history.at(-1).state,
  '| agent:',
  after.state_history.at(-1).agent,
);
