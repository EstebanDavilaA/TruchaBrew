// Structural STATE.json edit (rule 17): append a state_history entry.
import fs from 'node:fs';

const path = '.gsd/STATE.json';
const raw = fs.readFileSync(path, 'utf8');
const state = JSON.parse(raw); // real parse

const entry = {
  date: '2026-08-31',
  state: 3,
  agent: 'claude-code',
  event:
    "SPEC_APPROVED received for M37_P1 (Bounded Multi-Ion Least-Squares Solver, 20 ACs). Pre-flight re-verified: STATE.json valid JSON, M37_P1_feature_spec.md valid UTF-8 (no BOM), .gsd/active/ holds exactly one spec matching artifacts.active_spec. Pre-edit SHA-256 manifest captured before first edit (637 files). Handed off to executor."
};

state.state_history.push(entry);
state.current_state = 3;
state.last_action = "SPEC_APPROVED for M37_P1 received. State 3 /execute in progress: bounded multi-ion NNLS solver in @truchabrew/calculations.";

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
