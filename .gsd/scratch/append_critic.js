import fs from 'node:fs';

const criticPath = '.gsd/archive/CRITIC_REPORT.md';
const existingContent = fs.readFileSync(criticPath, 'utf8');

const newEntry = `
---

## M28_P1 — A Sidebar Organized the Way Brewing Works (2026-08-22)

Source of truth: \`.gsd/active/M28_P1_feature_spec.md\` (15 ACs). Independent critic audit — evaluated against spec contracts, implementation code, Layer 1 test/typecheck/build/lint outputs, and cryptographic pre/post manifest diffs.

### Acceptance Criteria Trace

| ID | Spec says | Implementation does | Match? |
|----|-----------|---------------------|--------|
| AC-1 | \`NAV_SECTIONS\` exported as readonly array with 2 sections: \`'Brew'\` (4 items) and \`'Library'\` (5 items) | \`Sidebar.tsx:35-53\` exports \`NAV_SECTIONS: readonly NavSection[]\` with exact titles and item assignments matching specification | YES |
| AC-2 | \`NAV_ITEMS\` exported as flat array of all 9 items in sequential order matching \`NAV_SECTIONS\` | \`Sidebar.tsx:57\` derives \`NAV_ITEMS = NAV_SECTIONS.flatMap(s => s.items)\`; order is \`['list', 'batches', 'inventory', 'calculators', 'equipment', 'mashProfiles', 'fermentationProfiles', 'waterProfiles', 'settings']\` | YES |
| AC-3 | Expanded sidebar (\`collapsed === false\`) renders section headers (\`Brew\` and \`Library\`) with visible text | \`Sidebar.tsx:128-130\` renders section headers when \`!collapsed\` with \`text-[11px] font-bold uppercase tracking-wider text-slate-400 select-none\`; confirmed via DOM query in tests | YES |
| AC-4 | Expanded sidebar renders all 9 item buttons with icon and label under their section header | \`Sidebar.tsx:132-156\` iterates through each section's items, rendering \`Icon\` and \`<span>{item.label}</span>\` for each | YES |
| AC-5 | Clicking any of the 9 navigation buttons calls \`onNavigate\` with the correct \`NavDestination\` | Each navigation button has \`onClick={() => onNavigate(item.destination)}\`; tested across all 9 items | YES |
| AC-6 | Active view resolution sets \`aria-current="page"\` on exactly one button matching \`activeDestinationFor(view)\` across all 11 views | Evaluated across all 11 views in \`Sidebar.test.tsx\` (\`ALL_VIEWS\`), confirming exactly one button receives \`aria-current="page"\` for the resolved destination | YES |
| AC-7 | Collapsed sidebar (\`collapsed === true\`) removes section header text nodes from DOM | Section header text \`<div>\` is conditionally omitted in collapsed mode (\`queryByText\` returns null) | YES |
| AC-8 | Collapsed sidebar keeps all 9 buttons present, enabled, and clickable with \`aria-label\` and \`title\` | Buttons remain enabled with \`aria-label={item.label}\` and \`title={collapsed ? item.label : undefined}\` | YES |
| AC-9 | Collapsed sidebar renders separator element (\`role="separator"\`) between \`Brew\` and \`Library\` clusters | \`Sidebar.tsx:126\` renders \`<div className="my-1 border-t border-slate-800 mx-2" role="separator" aria-hidden="true" />\` at section index 1 when \`collapsed === true\` | YES |
| AC-10 | Collapse toggle button toggles \`collapsed\` state, updates \`aria-expanded\` and accessible name between "Collapse navigation" and "Expand navigation" | Toggle button functions as controlled component, updates \`aria-expanded\` and accessible label | YES |
| AC-11 | \`MobileNav\` renders category headers (\`Brew\` and \`Library\`) and all 9 items when \`isOpen === true\` | \`MobileNav.tsx:72-101\` iterates \`NAV_SECTIONS\` and renders section headers and all 9 items in drawer | YES |
| AC-12 | Clicking navigation item in \`MobileNav\` calls \`onNavigate(destination)\` and \`onClose()\` | \`handleNavigate\` calls \`onNavigate(destination)\` followed by \`onClose()\`; verified across all 9 items | YES |
| AC-13 | Focus trapping, Escape key dismissal, and backdrop click dismissal operate correctly in \`MobileNav\` | \`useModalA11y\` integration and \`handleBackdropClick\` confirmed functional and tested | YES |
| AC-14 | Scope guardrail: SHA-256 pre/post manifest check confirms only the 4 authorized files modified | Diff between \`manifest_m28p1_pre.txt\` (528 files) and \`manifest_m28p1_post.txt\` (529 files) confirms exactly \`Sidebar.tsx\`, \`MobileNav.tsx\`, \`Sidebar.test.tsx\`, \`MobileNav.test.tsx\`, and framework state changed | YES |
| AC-15 | All four Layer 1 gates (test suite, typecheck, build, lint) pass with 0 errors | \`npm test\` (1,941 passed / 2 skipped across 119 test files), typecheck PASS all 4 workspaces, build PASS (\`dist/\` created in 964ms), lint PASS (0 errors, 4 pre-existing warnings) | YES |

### Test Suite Result

- \`npm test\`: **PASS** — 1,941 passed / 2 skipped across 119 files (api: 438, web: 901, calculations: 602 + 2 skipped).
- \`npm run typecheck\`: **PASS** across all 4 workspaces (\`@truchabrew/shared-types\`, \`@truchabrew/calculations\`, \`@truchabrew/web\`, \`@truchabrew/api\`).
- \`npm run build\`: **PASS** (production client bundle generated in 964ms).
- \`npm run lint\`: **PASS** (0 errors, 4 pre-existing warnings in untouched context/modal files).

### Findings

- **Silent-fallback hunt**: Clean. Section titles are derived strictly from \`NAV_SECTIONS\`. When collapsed, text headers are conditionally omitted from the DOM rather than visually hidden, and the separator carries \`role="separator"\` with \`aria-hidden="true"\`.
- **Mechanism-mislabeling hunt**: Clean. Grouping structure uses pure \`NavSection\` models and flat \`NAV_ITEMS\` projection; no artificial wrappers or hidden mock elements.
- **Design Tokens Compliance**: Section headers use \`text-slate-400\` in adherence to the \`M24_P1\` contrast design token standards.

### Verdict

**PASS** — Implementation matches the approved specification in full across all 15 acceptance criteria.
`;

fs.writeFileSync(criticPath, existingContent.trimEnd() + '\n' + newEntry, 'utf8');
console.log('Appended M28_P1 entry to CRITIC_REPORT.md');
