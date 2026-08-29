const fs = require('fs');
const path = '.gsd/STATE.json';
const j = JSON.parse(fs.readFileSync(path, 'utf8'));

// Rule 21: archive M31 and older (indices 0..32), keep M32 (33..55) and M33 (56..80) inline
const archived = j.state_history.slice(0, 33);           // M31 entries
const kept = j.state_history.slice(33);                  // M32 + M33 entries
console.log('Archiving', archived.length, 'M31 entries; keeping', kept.length, 'entries (M32+M33).');

// New closure entry (Rule 18: log before moving on)
const closureEntry = {
  date: '2026-08-26',
  state: 4,
  agent: 'claude-code',
  event: "/steer checkpoint: user selected Option D (Complete Milestone). Milestone 33 (Brew day stops improvising its buttons) completed in full across all 5 phases (M33_P1..M33_P5). M33_P5_feature_spec.md archived to .gsd/archive/specs/ and unlinked from .gsd/active/; manual verification screenshot M33_P5_batch_detail_buttons.png archived to .gsd/archive/manual_verification/M33_P5/. ROADMAP.md Milestone 33 section marked COMPLETE (2026-08-26) with a five-phase delivery summary. Rule-21 state_history archival performed: 33 M31 entries (2026-08-24..25, indices 0-32) archived to STATE_HISTORY.md; M32 and M33 entries (48) kept inline per rule 21 (current milestone M33 plus immediately-prior M32). STEERING_LOG.md M33_P5 Option D decision appended with a provenance note documenting an accidental overwrite of the M33_P4/P5 checkpoint entries (data-loss incident, per user direction not reconstructed). BUG-040/FEAT-005 remain open as multi-milestone umbrella items, not closed by this milestone. Advancing to Milestone 34 (Every dialog and panel is built from the same parts), Phase 1."
};
j.state_history = kept.concat([closureEntry]);

// Advance to Milestone 34 Phase 1
j.active_milestone = 34;
j.active_phase = 1;
j.current_state = 2;
j.last_action = 'Milestone 33 complete. Advancing to /plan for Milestone 34 Phase 1.';
j.artifacts.active_spec = null;

fs.writeFileSync(path, JSON.stringify(j, null, 2) + '\n', 'utf8');
console.log('STATE.json updated.');
console.log('state_history now:', j.state_history.length);
console.log('First kept entry:', j.state_history[0].event.substring(0, 90));
console.log('Last entry:', j.state_history[j.state_history.length - 1].event.substring(0, 90));
