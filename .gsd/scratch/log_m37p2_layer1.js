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
    "Layer 1 execution complete for M37_P2 (Target Auto-Tuning UI, Fit Score Visualization & WaterCalculatorModal Integration, 22 ACs). WaterCalculatorModal.tsx integrated with the M37_P1 solver: Auto-Optimize button (data-testid=water-calc-auto-dose-btn) runs optimizeWaterProfile with balance-strategy weights (Balanced/Crisp Hop-Forward/Malty-Full), live fit-score badge (water-calc-fit-score, emerald>=90/amber>=75/slate per RA-2), SO4:Cl ratio badge (water-calc-so4-cl-ratio), per-ion target-match delta badges (water-calc-ion-*, ±5ppm in-range emerald 'Target' else signed delta), Reset (water-calc-reset-btn) and Save to Recipe (water-calc-save-btn). Fit score computed live from finished water so typing a salt input updates it (AC-8). RA-3 spec-gap amendments (documented in spec): (1) waterOptimization.ts gained optional weights override threading through objective/fitScore for the strategy presets (backward-compatible, all 54 M37_P1 solver tests green); (2) WaterSection.test.tsx testid refs reconciled (water-auto-btn->water-calc-auto-dose-btn, etc.) since the spec mandates the new testids and that file pinned the old ones. WaterCalculatorModal.test.tsx: 33 pre-existing tests reconciled to new testids + 14 new M37_P2 AC tests (AC-1..AC-14) added. uiPrimitives.test.tsx unmodified and green (146/146) — all additions use ui primitives. BUGS.md BUG-024 end-to-end verification note appended (AC-17, already RESOLVED_M37_P1). Layer 1 gates: test (2,388 passed / 2 skipped across 126 files: 473 api + 1,293 web + 622 calculations, exceeds the 2,374/126 baseline), typecheck (4/4 PASS), build (clean in 733ms), lint (0 errors, 4 pre-existing warnings, 0 new). Scope check via SHA-256 pre/post manifest: authorized set (WaterCalculatorModal.tsx, WaterCalculatorModal.test.tsx, BUGS.md, STATE.json) + RA-3 amendments (waterOptimization.ts, WaterSection.test.tsx) + spec framework file; 0 created in web/api, 0 deleted. HALTED for /steer."
};

state.state_history.push(entry);
state.current_state = 3;
state.last_action =
  'State 3 /execute complete for M37_P2 (Layer 1 four gates green; WaterCalculatorModal solver integration + fit/ratio/delta visualization delivered; RA-3 spec-gap amendments documented). HALTED — awaiting user invocation of /steer (Layer 2 critic audit + Layer 3 regression run inside /steer per rule 15).';

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
