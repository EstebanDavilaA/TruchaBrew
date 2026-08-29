// Structural STATE.json edit (rule 17): append the Layer 1 completion entry.
import fs from 'node:fs';

const path = '.gsd/STATE.json';
const raw = fs.readFileSync(path, 'utf8');
const state = JSON.parse(raw); // real parse

const entry = {
  date: '2026-08-28',
  state: 3,
  agent: 'claude-code',
  event:
    "Layer 1 execution complete for M35_P2 (the remaining 10 tables, 33 ACs). The prior executor session had completed all 12 authorized source-file edits (designSystem.ts +3 tokens via private base, ui/Table.tsx TableCell size/variant axes, ui/index.ts +2 type exports, and all 10 tables across 9 files migrated onto Table/TableHeaderCell/TableCell) and captured the pre/post SHA-256 manifests, but halted on credit usage before finishing the §2.4 test reconciliations and running Layer 1. This session completed the remaining spec-mandated reconciliations: MashSection.test.tsx AC-19/AC-20 (drop tracking-tight from 7 numeric-cell pins), AC-21 (text-slate-100/400 -> text-slate-200 per RA-2/RA-3, font-medium retained as RA-3 safe passthrough), AC-24 title-only; YeastSection.test.tsx AC-15 converted from source-text scope=\"col\" count to a rendered-DOM columnheader assertion (6, all scope=\"col\"). Layer 1 gates: test (2,257 passed / 2 skipped across 121 files: 438 api + 1,217 web + 602 calculations), typecheck (4/4 PASS), build (clean in 766ms), lint (0 errors, 4 pre-existing warnings, 0 new). Scope check: pre/post SHA-256 manifest diff shows exactly the §4 authorized set (12 source + 4 test) plus the 2 §2.4-mandated test reconciliations (MashSection/YeastSection test files) plus .gsd/ framework files; 0 created in app, 0 deleted. AC-28 forbidden-path integrity verified byte-identical for all 16 forbidden paths (BrewSheet, accessibilityAndPolish, ScopeGuardrail, Modal, 5 ui primitives, 6 forbidden test files). AC-27 accessibilityAndPolish.test.tsx byte-identical and green; BrewSheet.test.tsx green (RA-6 defaults leave P1 tables untouched). Post manifest regenerated to include the test reconciliations. HALTED for /steer."
};

state.state_history.push(entry);
state.current_state = 3;
state.last_action =
  'State 3 /execute complete for M35_P2 (Layer 1 four gates green; spec §2.4 test reconciliations finished; scope clean). HALTED — awaiting user invocation of /steer (Layer 2 critic audit + Layer 3 regression run inside /steer per rule 15).';

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
