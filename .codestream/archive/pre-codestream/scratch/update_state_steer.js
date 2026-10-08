import fs from 'node:fs';

const statePath = '.gsd/STATE.json';
const stateRaw = fs.readFileSync(statePath, 'utf8');
const state = JSON.parse(stateRaw);

state.current_state = 4;
state.active_milestone = 28;
state.active_phase = 1;
state.last_action = 'Presenting State 4 Steering Checkpoint for M28_P1';
state.notes.next_action = 'State 4 Steering Checkpoint presented for M28_P1. Awaiting user steering decision.';

state.state_history.push({
  date: new Date().toISOString().split('T')[0],
  state: 4,
  agent: 'antigravity-gemini',
  event: 'M28_P1 verified clean across all 3 layers: Layer 1 (4 gates exit 0, 1941 passed/2 skipped), Layer 2 (critic PASS, 15/15 ACs YES), Layer 3 (regression clean, monotonic 1934->1941). Scope guardrail AC-14 verified by SHA-256 pre/post manifest diff. VERIFICATION_REPORT.md and STEERING_LOG.md updated. Presenting State 4 Steering Checkpoint for M28_P1.'
});

fs.writeFileSync(statePath, JSON.stringify(state, null, 2) + '\n', 'utf8');

// Verification parse
const verifyRaw = fs.readFileSync(statePath, 'utf8');
JSON.parse(verifyRaw);
console.log('Successfully updated and verified STATE.json for State 4');
