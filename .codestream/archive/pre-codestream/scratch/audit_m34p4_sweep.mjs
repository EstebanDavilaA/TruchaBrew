import fs from 'node:fs';

const files = [
  'apps/web/src/components/RecipeLibrary.tsx',
  'apps/web/src/components/InventoryManager.tsx',
  'apps/web/src/components/SensoryEvaluationPanel.tsx',
  'apps/web/src/components/SplitPackagingPanel.tsx',
];

const EXEMPT = /type=["']checkbox["']|type=["']radio["']|type=["']range["']|type=["']file["']/;

for (const f of files) {
  const content = fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
  const buttons = (content.match(/<button\b/g) || []).length;
  const selects = (content.match(/<select\b/g) || []).length;
  const inputs = (content.match(/<input\b[^>]*>/g) || []).filter((el) => !EXEMPT.test(el)).length;
  console.log(`${f} | raw buttons: ${buttons} | raw selects: ${selects} | raw text/number inputs: ${inputs}`);
}

const calcFiles = fs.readdirSync('apps/web/src/components/calculators').filter((f) => f.endsWith('.tsx'));
let calcIssues = 0;
for (const f of calcFiles) {
  const content = fs.readFileSync(`apps/web/src/components/calculators/${f}`, 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
  const buttons = (content.match(/<button\b/g) || []).length;
  const selects = (content.match(/<select\b/g) || []).length;
  const inputs = (content.match(/<input\b[^>]*>/g) || []).filter((el) => !EXEMPT.test(el)).length;
  if (buttons || selects || inputs) {
    calcIssues++;
    console.log(`CALC ${f} | buttons: ${buttons} | selects: ${selects} | inputs: ${inputs}`);
  }
}
console.log(calcIssues === 0 ? 'calculators sweep: all clean' : `calculators sweep: ${calcIssues} files with issues`);

// Legacy-token audit
const legacy = ['INPUT_CLASS', 'FORM_SELECT_CLASS', 'BUTTON_PRIMARY_CLASS', 'BUTTON_SECONDARY_CLASS', '!pl-9'];
for (const f of files) {
  const content = fs.readFileSync(f, 'utf8');
  const hits = legacy.filter((tok) => content.includes(tok));
  if (hits.length) console.log(`${f} still references legacy tokens: ${hits.join(', ')}`);
}
console.log('legacy-token audit complete');

// designSystem / Modal untouched check
const ds = fs.readFileSync('apps/web/src/components/designSystem.ts', 'utf8');
console.log('designSystem.ts exports:', (ds.match(/export const [A-Z_]+/g) || []).length);
