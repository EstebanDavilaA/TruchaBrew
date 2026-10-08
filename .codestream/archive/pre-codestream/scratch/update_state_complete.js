import fs from 'node:fs';

const statePath = '.gsd/STATE.json';
const stateRaw = fs.readFileSync(statePath, 'utf8');
const state = JSON.parse(stateRaw);

state.current_state = 4;
state.active_milestone = 28;
state.active_phase = 1;
state.artifacts.active_spec = null;
state.last_action = 'Milestone 28 completed in full (Option D); active spec archived; all 28 roadmap milestones complete';
state.notes.next_action = 'All 28 scheduled roadmap milestones are complete and verification-clean. Backlog items remain in .gsd/ROADMAP.md "Deferred / not scheduled". Ready for user direction.';

state.state_history.push({
  date: new Date().toISOString().split('T')[0],
  state: 4,
  agent: 'antigravity-gemini',
  event: '/steer checkpoint: user selected Option D (Complete Milestone). Milestone 28 (\'A sidebar organized the way brewing works\') completed in full. Active spec archived to .gsd/archive/specs/M28_P1_feature_spec.md and removed from .gsd/active/ (verified: active/ now empty, archive copy present). All 28 scheduled roadmap milestones are now complete and verification-clean.'
});

fs.writeFileSync(statePath, JSON.stringify(state, null, 2) + '\n', 'utf8');

// Verification parse
const verifyRaw = fs.readFileSync(statePath, 'utf8');
JSON.parse(verifyRaw);
console.log('Successfully updated and verified STATE.json for Milestone 28 completion');
