// Structural STATE.json edit (rule 17): append the Layer 1 completion entry.
import fs from 'node:fs';

const path = '.gsd/STATE.json';
const raw = fs.readFileSync(path, 'utf8');
const state = JSON.parse(raw); // real parse

const entry = {
  date: '2026-08-27',
  state: 3,
  agent: 'claude-code',
  event:
    "Layer 1 execution complete for M34_P4: test (2,204 passed / 2 skipped across 121 files in api, web, calculations), typecheck (4/4 clean), build (clean in 674ms), lint (0 errors, 4 pre-existing warnings). All four heaviest panels + Calculators remainder migrated onto components/ui/ primitives: RecipeLibrary (5 buttons + search), InventoryManager (New Item, search w/ pl-9 leading icon, FEAT-029 segmented category pill strip, Retry, category toggle headers, per-category Add), CalculatorCard description/formula disclosure (RA-6) on all 10 calculators, StrikeWater checkbox normalized, SensoryEvaluationPanel (Save button; textarea stays raw per RA-5; BUTTON_PRIMARY_CLASS import removed), SplitPackagingPanel (Add/Remove/3 Selects/5 NumberInputs). AC-13 rows for SensoryEvaluationPanel & SplitPackagingPanel converted to adoption assertions in uiPrimitives.test.tsx; designTokens.test.ts AC-13 now 2 rows. AMENDMENT 1 (user-directed, FEAT-029): out-of-stock filter redesigned from native checkbox to a Button-composed pill in the category strip with a live count badge (aria-pressed={outOfStockOnly}); tests reconciled (AC-9/AC-10/AC-11 + uiPrimitives sweep); spec amended to record the binding change. Consequence-pin reconcile: FermentableSection.test.tsx app-wide ${INPUT_CLASS} font-mono tabular-nums residue 7->4 (SplitPackagingPanel's 3 inputs retired onto NumberInput, same pattern as M34_P3's RA-9 13->7 reconcile). Scope check clean via SHA-256 pre/post manifest (17 authorized source files + 3 authorized test files + FermentableSection consequence-pin + spec/STATE framework files; 0 created in app, 0 deleted). HALTED for /steer."
};

state.state_history.push(entry);
state.current_state = 3;
state.last_action =
  'State 3 /execute complete for M34_P4 (Layer 1 four gates green, incl. Amendment 1 out-of-stock pill). HALTED — awaiting user invocation of /steer (Layer 2 critic audit + Layer 3 regression run inside /steer per rule 15).';

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
