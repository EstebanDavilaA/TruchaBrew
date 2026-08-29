// Structural STATE.json edit (rule 17): append a state_history entry.
import fs from 'node:fs';

const path = '.gsd/STATE.json';
const raw = fs.readFileSync(path, 'utf8');
const state = JSON.parse(raw); // real parse

const entry = {
  date: '2026-08-27',
  state: 3,
  agent: 'claude-code',
  event:
    "SPEC_APPROVED received for M34_P4 (the four heaviest panels & toolbar cohesion: RecipeLibrary.tsx, InventoryManager.tsx incl. FEAT-029 segmented pill strip, Calculators remainder with tooltips/formula summaries, SensoryEvaluationPanel.tsx, SplitPackagingPanel.tsx; 26 ACs). Pre-edit SHA-256 manifest captured before first edit (606 files). Handed off to executor."
};

state.state_history.push(entry);
state.current_state = 3;
state.last_action = "SPEC_APPROVED for M34_P4 received. State 3 /execute in progress: content migration of the four heaviest panels + Calculators remainder onto components/ui/ primitives.";

fs.writeFileSync(path, JSON.stringify(state, null, 4) + '\n', 'utf8');

// re-parse to confirm valid JSON (rule 17)
const after = JSON.parse(fs.readFileSync(path, 'utf8'));
console.log('Re-parse OK. entries:', after.state_history.length, '| last entry state:', after.state_history.at(-1).state, '| agent:', after.state_history.at(-1).agent);
