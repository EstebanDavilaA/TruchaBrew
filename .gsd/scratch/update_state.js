import fs from 'node:fs';

const statePath = '.gsd/STATE.json';
const stateRaw = fs.readFileSync(statePath, 'utf8');
const state = JSON.parse(stateRaw);

state.current_state = 3;
state.active_milestone = 28;
state.active_phase = 1;
state.last_action = 'M28_P1 executor completed build; Layer 1 green across all 4 gates; AWAITING /steer';
state.notes.next_action = 'Executor completed M28_P1 build. All 4 Layer 1 gates green (1941 passed, typecheck PASS all workspaces, build clean, oxlint clean 0 errors). Awaiting user to invoke /steer for Layer 2 critic audit and Layer 3 regression pass.';

state.state_history.push({
  date: new Date().toISOString().split('T')[0],
  state: 3,
  agent: 'antigravity-gemini',
  event: 'executor built M28_P1 (grouped navigation into Brew and Library clusters across Sidebar and MobileNav with category headers and collapsed dividers). Layer 1 clean: npm test 1941 passed/2 skipped across 119 test files (api 438, web 901, calculations 602+2skipped), typecheck PASS all 4 workspaces, build succeeded, lint exit 0 (0 errors, 4 pre-existing warnings). Scope guardrail AC-14 verified via SHA-256 pre/post manifest diff: exactly the 4 authorized files modified (Sidebar.tsx, MobileNav.tsx, Sidebar.test.tsx, MobileNav.test.tsx). AWAITING /steer.'
});

fs.writeFileSync(statePath, JSON.stringify(state, null, 2) + '\n', 'utf8');

// Verification parse
const verifyRaw = fs.readFileSync(statePath, 'utf8');
JSON.parse(verifyRaw);
console.log('Successfully updated and verified STATE.json');
