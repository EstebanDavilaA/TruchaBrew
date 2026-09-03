// M8_P1 spec §1.3/AC-23…AC-27, extended by M8_P2 spec §1.3/AC-28…AC-32.
// fs-based static analysis over the calculator surface's own source text —
// renders nothing. This is the mechanically-checkable form of the roadmap's
// verification threshold: "every calculator's output is produced by a
// function that is also reachable from the recipe/batch path, asserted by
// import graph, not convention."
//
// Judgment call, disclosed: AC-23's literal allowlist strings
// ('../PageContainer', '../TopBar', '../../context/ConfigContext') are
// written from a single assumed directory depth, but the AC-23 file set
// spans two different depths (apps/web/src/pages/Calculators.tsx vs.
// apps/web/src/components/calculators/*.tsx), so no single relative string
// is correct for both locations. This test instead resolves every import
// specifier to its target file (or bare package) and asserts membership in
// the *resolved* allowlist below, which is the same set the literal strings
// describe once depth is accounted for. Flagged for critic attention.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import * as calcPackage from '@truchabrew/calculations';

const CALCULATORS_DIR = path.resolve(__dirname, '../src/components/calculators');
const CALCULATORS_PAGE = path.resolve(__dirname, '../src/pages/Calculators.tsx');
const WEB_SRC = path.resolve(__dirname, '../src');
const CALC_PACKAGE_SRC = path.resolve(__dirname, '../../../packages/calculations/src');

function calculatorFiles(): string[] {
  const files = readdirSync(CALCULATORS_DIR)
    .filter((f) => f.endsWith('.tsx'))
    .map((f) => path.join(CALCULATORS_DIR, f));
  return [...files, CALCULATORS_PAGE];
}

interface ImportStatement {
  file: string;
  specifier: string;
  namedImports: string[];
}

function parseImports(file: string, source: string): ImportStatement[] {
  const results: ImportStatement[] = [];
  const importRe = /import\s+([^;]+?)\s+from\s+['"]([^'"]+)['"];?/g;
  let m: RegExpExecArray | null;
  while ((m = importRe.exec(source))) {
    const clause = m[1];
    const specifier = m[2];
    const namedMatch = clause.match(/\{([^}]*)\}/);
    const namedImports = namedMatch
      ? namedMatch[1]
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
          .map((s) => s.replace(/^type\s+/, '').split(/\s+as\s+/)[0].trim())
      : [];
    results.push({ file, specifier, namedImports });
  }
  return results;
}

const BARE_ALLOWLIST = new Set(['react', 'lucide-react', '@truchabrew/calculations', '@truchabrew/shared-types']);

function resolveRelative(fromFile: string, specifier: string): string {
  return path.resolve(path.dirname(fromFile), specifier) + '.tsx';
}

// ---------------------------------------------------------------------------
// AC-32 (M8_P2): TypeScript-AST call-site CONTAINMENT, replacing the
// adjacency-only regex assertions M8_P1's third critic pass disclosed
// (`toMatch(/calculateMashPlan[\s\S]*strikeTemperatureC\(/)` verifies token
// ADJACENCY — it stays green if the real call is deleted but the identifier
// survives in a trailing comment, a string literal, or a relocated
// function). This helper instead parses the file with the TypeScript
// compiler API, locates the named enclosing declaration, and walks ONLY
// that declaration's own AST subtree for a real CallExpression — comments
// and string literals are not part of the AST, so they are structurally
// invisible to it, and a call relocated to a different function is outside
// the walked subtree.
// ---------------------------------------------------------------------------

/** Finds the top-level FunctionDeclaration or VariableStatement (e.g. `export const Foo = () => {...}`) whose declared name matches `name`. */
function findEnclosingDeclaration(sourceFile: ts.SourceFile, name: string): ts.Node | undefined {
  let found: ts.Node | undefined;

  function visit(node: ts.Node): void {
    if (found) return;
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) {
      found = node;
      return;
    }
    if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        if (ts.isIdentifier(decl.name) && decl.name.text === name) {
          found = node;
          return;
        }
      }
    }
    if (found) return;
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return found;
}

/**
 * The set of local identifier names that resolve to `calleeName` inside
 * this file: `calleeName` itself, plus any local alias introduced by
 * `import { calleeName as X } from '...'` (e.g. batchClosing.ts's
 * `primingSugarG as computePrimingSugarG`). A real containment check must
 * follow import aliasing rather than matching only the literal exported
 * name, or a legitimate aliased call site would be invisible to it.
 */
function resolveLocalNames(sourceFile: ts.SourceFile, calleeName: string): Set<string> {
  const names = new Set<string>([calleeName]);
  sourceFile.forEachChild((node) => {
    if (ts.isImportDeclaration(node) && node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings)) {
      for (const el of node.importClause.namedBindings.elements) {
        const importedName = (el.propertyName ?? el.name).text;
        if (importedName === calleeName) {
          names.add(el.name.text);
        }
      }
    }
  });
  return names;
}

/**
 * True iff a real CallExpression whose callee resolves to `calleeName`
 * (accounting for import aliasing) exists anywhere in the subtree of the
 * declaration named `enclosingFunctionName` — never merely in a comment, a
 * string/template literal, or a different function in the same file.
 */
function callsWithinSource(source: string, enclosingFunctionName: string, calleeName: string): boolean {
  const sourceFile = ts.createSourceFile('containment-check.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const enclosing = findEnclosingDeclaration(sourceFile, enclosingFunctionName);
  if (!enclosing) return false;

  const localNames = resolveLocalNames(sourceFile, calleeName);
  let found = false;

  function visit(node: ts.Node): void {
    if (found) return;
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && localNames.has(node.expression.text)) {
      found = true;
      return;
    }
    ts.forEachChild(node, visit);
  }

  visit(enclosing);
  return found;
}

function callsWithin(filePath: string, enclosingFunctionName: string, calleeName: string): boolean {
  return callsWithinSource(readFileSync(filePath, 'utf8'), enclosingFunctionName, calleeName);
}

describe('AC-23: calculators import only from the closed allowlist', () => {
  const files = calculatorFiles();
  const allImports = files.flatMap((f) => parseImports(f, readFileSync(f, 'utf8')));

  it('every import specifier resolves to an allowed target', () => {
    const allowedFiles = new Set([
      path.resolve(WEB_SRC, 'context/ConfigContext.tsx'),
      path.resolve(WEB_SRC, 'components/PageContainer.tsx'),
      path.resolve(WEB_SRC, 'components/TopBar.tsx'),
      path.resolve(WEB_SRC, 'components/ui.tsx'),
      path.resolve(WEB_SRC, 'components/designSystem.tsx'),
    ]);


    for (const imp of allImports) {
      if (BARE_ALLOWLIST.has(imp.specifier)) continue;
      if (!imp.specifier.startsWith('.')) {
        throw new Error(`Disallowed non-relative import "${imp.specifier}" in ${imp.file}`);
      }
      const resolved = resolveRelative(imp.file, imp.specifier);
      const isSiblingInCalculators = resolved.startsWith(CALCULATORS_DIR + path.sep);
      const isAllowedNamedFile = allowedFiles.has(resolved);
      expect(
        isSiblingInCalculators || isAllowedNamedFile,
        `Import "${imp.specifier}" in ${path.relative(WEB_SRC, imp.file)} resolves outside the closed allowlist (resolved: ${resolved})`,
      ).toBe(true);
    }
  });

  it('no import escapes to ../../utils, ../../api, ../../hooks, or reaches into packages/ via a relative path', () => {
    for (const imp of allImports) {
      expect(imp.specifier).not.toMatch(/\.\.\/\.\.\/utils/);
      expect(imp.specifier).not.toMatch(/\.\.\/\.\.\/api/);
      expect(imp.specifier).not.toMatch(/\.\.\/\.\.\/hooks/);
      expect(imp.specifier).not.toMatch(/packages\//);
    }
  });

  it('every name imported from @truchabrew/calculations resolves to a defined package-root export', () => {
    const namedFromCalc = allImports.filter((i) => i.specifier === '@truchabrew/calculations').flatMap((i) => i.namedImports);
    expect(namedFromCalc.length).toBeGreaterThan(0);
    for (const name of namedFromCalc) {
      expect((calcPackage as Record<string, unknown>)[name], `"${name}" is not a defined export of @truchabrew/calculations`).toBeDefined();
    }
  });
});

describe('AC-28 (M8_P2): the AC-23 allowlist still holds over the five new components', () => {
  it('the calculator-files list picks up all five new components with no code change to AC-23', () => {
    const files = calculatorFiles().map((f) => path.basename(f));
    for (const name of ['PitchRateCalculator.tsx', 'StarterGrowthCalculator.tsx', 'HopDecayCalculator.tsx', 'GravityCorrectionCalculator.tsx', 'CarbonationCalculator.tsx']) {
      expect(files, `${name} not picked up by calculatorFiles() — AC-23's directory read should require no edit`).toContain(name);
    }
  });
});

describe('AC-24/AC-29: no duplicated formula — banned-literal sweep, extended', () => {
  const files = calculatorFiles();
  const sources = files.map((f) => ({ file: f, source: readFileSync(f, 'utf8') }));

  const bannedLiterals = [
    // M8_P1 (AC-24) — unchanged, none removed.
    '0.41',
    '1.00130346',
    '0.000134722124',
    '258.6',
    '258.2',
    '227.1',
    '182.4601',
    '1262.7794',
    '0.0044993',
    '0.011774',
    '6.894757',
    '1.3546',
    '1.97',
    '0.264172',
    '0.219969',
    '2.20462',
    '28.3495',
    '131.25',
    '1262.45',
    '668.96',
    '1.04',
    // M8_P2 (AC-29) — exactly these 15 added.
    '2.33',
    '0.67',
    '0.62',
    '0.21',
    '3.0378',
    '0.050062',
    '0.00026555',
    '16.6999',
    '0.0101059',
    '0.00116512',
    '0.173354',
    '4.24267',
    '0.0684226',
    '0.75',
    '1.25',
  ];

  it('contains none of the banned coefficient literals', () => {
    for (const { file, source } of sources) {
      for (const literal of bannedLiterals) {
        expect(source.includes(literal), `Banned literal "${literal}" found in ${file}`).toBe(false);
      }
    }
  });

  /**
   * Strips string/template literals and comments so a numeric literal
   * *inside* a quoted string (e.g. useState('67')) is not mistaken for a
   * bare numeric-literal token. className strings are explicitly permitted
   * regardless (AC-24) — stripping all strings, not just className ones, is
   * a superset of that permission and therefore still correct.
   */
  function stripStringsAndComments(source: string): string {
    return source
      .replace(/\/\/.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/`(?:[^`\\]|\\.)*`/g, '``')
      .replace(/"(?:[^"\\]|\\.)*"/g, '""')
      .replace(/'(?:[^'\\]|\\.)*'/g, "''");
  }

  const ALLOWED_NUMERIC_LITERALS = new Set(['0', '1', '2', '3', '100', '1000']);

  it('the only permitted bare numeric literals are 0, 1, 2, 3, 100, 1000 — unchanged and not widened', () => {
    for (const { file, source } of sources) {
      const stripped = stripStringsAndComments(source);
      const tokens = stripped.match(/(?<![\w.])\d+(?:\.\d+)?(?![\w.])/g) ?? [];
      for (const token of tokens) {
        expect(ALLOWED_NUMERIC_LITERALS.has(token), `Disallowed numeric literal "${token}" found in ${file}`).toBe(true);
      }
    }
  });

  it('Math.pow, Math.exp, and the ** operator appear zero times (JSDoc comment delimiters excluded)', () => {
    for (const { file, source } of sources) {
      const stripped = stripStringsAndComments(source);
      expect(source.includes('Math.pow'), `Math.pow found in ${file}`).toBe(false);
      expect(source.includes('Math.exp'), `Math.exp found in ${file}`).toBe(false);
      expect(stripped.includes('**'), `** operator found in ${file}`).toBe(false);
    }
  });
});

describe('AC-25/AC-30: one definition per formula, repo-wide — extended to 26 names', () => {
  const names = [
    // M8_P1's 14 — unchanged, none removed.
    'strikeTemperatureC',
    'infusionVolumeL',
    'brixToSg',
    'sgToBrix',
    'hydrometerCorrectedSg',
    'refractometerFinalGravity',
    'sgToPlato',
    'srmToEbc',
    'srmToLovibond',
    'convertVolume',
    'convertMass',
    'convertHopMass',
    'celsiusToFahrenheit',
    'psiToKpa',
    // M8_P2 (AC-30) — exactly these 12 added (14 + 12 = 26).
    'targetCellsBillions',
    'viabilityAfterMonths',
    'viableCellsBillions',
    'starterExtractGrams',
    'starterGrowthRateBPerG',
    'starterEndCellsBillions',
    'hopDecayRateConstant',
    'hopTemperatureFactor',
    'alphaAcidAfterStorage',
    'dilutionWaterL',
    'dmeToAddKg',
    'additionalBoilMinutes',
  ];

  it('names has exactly 26 entries', () => {
    expect(names).toHaveLength(26);
  });

  function allSourceFiles(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        out.push(...allSourceFiles(full));
      } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
        out.push(full);
      }
    }
    return out;
  }

  const calcFiles = allSourceFiles(CALC_PACKAGE_SRC);
  const webFiles = allSourceFiles(WEB_SRC);
  const allFiles = [...calcFiles, ...webFiles];

  it.each(names)('%s has exactly one "export function" definition, under packages/calculations/src', (name) => {
    const re = new RegExp(`export function ${name}\\b`, 'g');
    const matches: string[] = [];
    for (const file of allFiles) {
      const source = readFileSync(file, 'utf8');
      const count = (source.match(re) ?? []).length;
      for (let i = 0; i < count; i++) matches.push(file);
    }
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatch(/packages[\\/]calculations[\\/]src/);
  });
});

describe('AC-26/AC-31 (amended 2026-08-15): every calculator-backing function is classified, and the classification is a closed, total, disjoint partition — extended to 35 names', () => {
  // Local recursive walker — AC-25's identically-named helper is scoped
  // inside AC-25's own describe callback and is not visible here.
  function allWebSourceFiles(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        out.push(...allWebSourceFiles(full));
      } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
        out.push(full);
      }
    }
    return out;
  }

  // AC-26(a) — P1's original eleven.
  // AC-31(a) (M8_P2) — grown by this phase's twelve new functions (the
  // AC-30 list). Total 23.
  const standaloneOnly = [
    'brixToSg',
    'sgToBrix',
    'hydrometerCorrectedSg',
    'refractometerOriginalGravity',
    'refractometerFinalGravity',
    'psiToKpa',
    'kpaToPsi',
    'psiToBar',
    'barToPsi',
    'srmToLovibond',
    'targetCellsBillions',
    'viabilityAfterMonths',
    'viableCellsBillions',
    'starterExtractGrams',
    'starterGrowthRateBPerG',
    'starterEndCellsBillions',
    'hopDecayRateConstant',
    'hopTemperatureFactor',
    'alphaAcidAfterStorage',
    'dilutionWaterL',
    'dmeToAddKg',
    'additionalBoilMinutes',
  ];

  // AC-26(b) — P1's original seven, positively asserted.
  // AC-31(b) (M8_P2) — grown by five pre-existing functions this phase
  // newly reaches from the calculator surface. Total 12.
  // M11_P1 (BUG-016): srmToEbc moved here as brewingMath.ts delegates to it. Total 13.
  const recipePathCaller = [
    'strikeTemperatureC',
    'infusionVolumeL',
    'convertVolume',
    'convertMass',
    'convertHopMass',
    'sgToPlato',
    'celsiusToFahrenheit',
    'primingSugarG',
    'forceCarbonationPsi',
    'residualCO2Volumes',
    'sgToPointsExact',
    'litersToGallons',
    'srmToEbc',
  ];

  // AC-26(a) excludes only each name's OWN defining module (plus index.ts,
  // which is a pure re-export barrel with no call sites) — not every new
  // module wholesale. A per-name global exclusion of hydrometry.ts +
  // pressure.ts + units.ts + yeast.ts + hops.ts + gravityCorrection.ts
  // would silently blind each family to a planted caller inside a sibling
  // module, since each name's own defining module is the only file that's
  // actually supposed to be exempt (M8_P1's second critic pass rejected the
  // over-broad wholesale-exclusion shape; that fix is preserved unchanged
  // here rather than re-broadened).
  const DEFINING_MODULE: Record<string, string> = {
    brixToSg: 'hydrometry.ts',
    sgToBrix: 'hydrometry.ts',
    hydrometerCorrectedSg: 'hydrometry.ts',
    refractometerOriginalGravity: 'hydrometry.ts',
    refractometerFinalGravity: 'hydrometry.ts',
    psiToKpa: 'pressure.ts',
    kpaToPsi: 'pressure.ts',
    psiToBar: 'pressure.ts',
    barToPsi: 'pressure.ts',
    srmToLovibond: 'units.ts',
    targetCellsBillions: 'yeast.ts',
    viabilityAfterMonths: 'yeast.ts',
    viableCellsBillions: 'yeast.ts',
    starterExtractGrams: 'yeast.ts',
    starterGrowthRateBPerG: 'yeast.ts',
    starterEndCellsBillions: 'yeast.ts',
    hopDecayRateConstant: 'hops.ts',
    hopTemperatureFactor: 'hops.ts',
    alphaAcidAfterStorage: 'hops.ts',
    dilutionWaterL: 'gravityCorrection.ts',
    dmeToAddKg: 'gravityCorrection.ts',
    additionalBoilMinutes: 'gravityCorrection.ts',
  };

  it('the standalone (no recipe/batch-path caller) set is exactly the closed twenty-two-name set the spec names', () => {
    // Verified by absence of each name as a call site outside its OWN
    // defining module and index.ts, and nowhere in apps/web/src outside
    // components/calculators/.
    const allCalcSrcFiles = readdirSync(CALC_PACKAGE_SRC).filter((f) => f.endsWith('.ts'));

    const webFilesOutsideCalculators = allWebSourceFiles(WEB_SRC).filter((f) => !f.startsWith(CALCULATORS_DIR + path.sep));
    const combinedWebSrc = webFilesOutsideCalculators.map((f) => readFileSync(f, 'utf8')).join('\n');

    for (const name of standaloneOnly) {
      const ownModule = DEFINING_MODULE[name];
      const excluded = new Set(['index.ts', ownModule]);
      const calcFilesForName = allCalcSrcFiles.filter((f) => !excluded.has(f)).map((f) => path.join(CALC_PACKAGE_SRC, f));
      const combinedCalcSrc = calcFilesForName.map((f) => readFileSync(f, 'utf8')).join('\n');

      const callRe = new RegExp(`\\b${name}\\s*\\(`, 'g');
      expect(combinedCalcSrc.match(callRe), `"${name}" unexpectedly has a caller outside its own defining module (${ownModule}) and index.ts`).toBeNull();
      expect(combinedWebSrc.match(callRe), `"${name}" unexpectedly has a caller in apps/web/src outside components/calculators/`).toBeNull();
    }
  });

  // AC-32 (M8_P2): both mash.ts assertions now route through the AST
  // containment helper rather than the token-adjacency regex M8_P1's third
  // critic pass disclosed as vacuous (`toMatch(/calculateMashPlan[\s\S]*
  // strikeTemperatureC\(/)` stays green even if the real call site is
  // deleted, so long as the identifier text survives anywhere later in the
  // file — a trailing comment, a string literal, a relocated function).
  // These two `toMatch` assertions are DELETED, not kept alongside.
  it('strikeTemperatureC and infusionVolumeL are called (real containment, not adjacency) inside mash.ts\'s calculateMashPlan', () => {
    const mashPath = path.join(CALC_PACKAGE_SRC, 'mash.ts');
    expect(callsWithin(mashPath, 'calculateMashPlan', 'strikeTemperatureC')).toBe(true);
    expect(callsWithin(mashPath, 'calculateMashPlan', 'infusionVolumeL')).toBe(true);
  });

  // Judgment call, disclosed (carried from the build pass): convertVolume/
  // convertMass/convertHopMass/sgToPlato/celsiusToFahrenheit are not called
  // by NAME inside the recipe-path components — those components call the
  // M7 format* helpers (packages/calculations/src/config.ts), which call
  // the converters internally. This test verifies the actual two-hop
  // reachability chain at BOTH hops (per AC-26(b)/AC-31(b)) via the AST
  // containment helper — AC-32's five config.ts hop-1 regex assertions
  // (`/function formatVolume[\s\S]*?convertVolume\(/` and its four
  // siblings) are DELETED, not kept alongside, and AC-31(b)'s binding text
  // ("every assertion in (b) uses the AST helper, not a regex") extends
  // that replacement to the hop-2 (component-calls-helper) assertions too.
  it('convertVolume, convertMass, convertHopMass, sgToPlato, celsiusToFahrenheit are reachable from the recipe path via their format* helpers, at both hops (AST containment)', () => {
    const configPath = path.join(CALC_PACKAGE_SRC, 'config.ts');
    // Hop 1: format* helper calls the converter, inside config.ts.
    expect(callsWithin(configPath, 'formatVolume', 'convertVolume')).toBe(true);
    expect(callsWithin(configPath, 'formatMass', 'convertMass')).toBe(true);
    expect(callsWithin(configPath, 'formatHopMass', 'convertHopMass')).toBe(true);
    expect(callsWithin(configPath, 'formatGravity', 'sgToPlato')).toBe(true);
    expect(callsWithin(configPath, 'formatTemperature', 'celsiusToFahrenheit')).toBe(true);

    // Hop 2: a recipe-path component (on §1.4's Untouched list) calls that helper.
    const statsHeaderPath = path.join(WEB_SRC, 'components/StatsHeader.tsx');
    expect(callsWithin(statsHeaderPath, 'StatsHeader', 'formatVolume')).toBe(true);
    expect(callsWithin(statsHeaderPath, 'StatsHeader', 'formatMass')).toBe(true);
    expect(callsWithin(statsHeaderPath, 'StatsHeader', 'formatHopMass')).toBe(true);
    expect(callsWithin(statsHeaderPath, 'StatsHeader', 'formatGravity')).toBe(true);

    const mashSectionPath = path.join(WEB_SRC, 'components/MashSection.tsx');
    expect(callsWithin(mashSectionPath, 'MashSection', 'formatTemperature')).toBe(true);
  });

  // AC-31(b) (M8_P2) — the five names this phase newly adds to the
  // recipe-path-caller set, each positively asserted via AST containment,
  // each failing if its single call site is removed.
  it('primingSugarG and forceCarbonationPsi are called inside batchClosing.ts\'s buildClosingSnapshot (AST containment, alias-aware)', () => {
    const batchClosingPath = path.join(CALC_PACKAGE_SRC, 'batchClosing.ts');
    // batchClosing.ts imports `primingSugarG as computePrimingSugarG` — a
    // real containment check must resolve that alias rather than looking
    // only for the literal exported name (see resolveLocalNames above).
    expect(callsWithin(batchClosingPath, 'buildClosingSnapshot', 'primingSugarG')).toBe(true);
    expect(callsWithin(batchClosingPath, 'buildClosingSnapshot', 'forceCarbonationPsi')).toBe(true);
  });

  it('residualCO2Volumes is reachable from the recipe path via primingSugarG, at both hops (AST containment)', () => {
    const carbonationPath = path.join(CALC_PACKAGE_SRC, 'carbonation.ts');
    // Hop 1: primingSugarG calls residualCO2Volumes, inside carbonation.ts.
    expect(callsWithin(carbonationPath, 'primingSugarG', 'residualCO2Volumes')).toBe(true);
    // Hop 2: buildClosingSnapshot calls primingSugarG (aliased), inside batchClosing.ts.
    const batchClosingPath = path.join(CALC_PACKAGE_SRC, 'batchClosing.ts');
    expect(callsWithin(batchClosingPath, 'buildClosingSnapshot', 'primingSugarG')).toBe(true);
  });

  it('sgToPointsExact, litersToGallons, and srmToEbc are called inside brewingMath.ts (AST containment)', () => {
    const brewingMathPath = path.join(CALC_PACKAGE_SRC, 'brewingMath.ts');
    expect(callsWithin(brewingMathPath, 'totalExtractPoints', 'sgToPointsExact')).toBe(true);
    expect(callsWithin(brewingMathPath, 'gravityAtVolume', 'litersToGallons')).toBe(true);
    expect(callsWithin(brewingMathPath, 'calculateRecipeStats', 'srmToEbc')).toBe(true);
  });

  // AC-26(c) / AC-31(c) (M8_P2): closure. The union of (a) and (b) must
  // equal exactly 35 names — AC-30's 26 plus the nine AC-30 does not
  // enumerate — asserted via BOTH decompositions (22+13 and 26+9) so a
  // miscount fails the suite rather than surviving in prose (§4 Deviation
  // 5). The intersection must stay empty — this is what prevents the
  // standalone allowlist from silently absorbing a dropped recipe-path
  // caller: a function cannot leave (b) without an explicit, reviewable
  // edit adding it to (a).
  it('(a) and (b) form a total, disjoint partition over exactly thirty-five names, asserted by two independent decompositions', () => {
    const ac30Names = [
      'strikeTemperatureC',
      'infusionVolumeL',
      'brixToSg',
      'sgToBrix',
      'hydrometerCorrectedSg',
      'refractometerFinalGravity',
      'sgToPlato',
      'srmToEbc',
      'srmToLovibond',
      'convertVolume',
      'convertMass',
      'convertHopMass',
      'celsiusToFahrenheit',
      'psiToKpa',
      'targetCellsBillions',
      'viabilityAfterMonths',
      'viableCellsBillions',
      'starterExtractGrams',
      'starterGrowthRateBPerG',
      'starterEndCellsBillions',
      'hopDecayRateConstant',
      'hopTemperatureFactor',
      'alphaAcidAfterStorage',
      'dilutionWaterL',
      'dmeToAddKg',
      'additionalBoilMinutes',
    ];
    expect(ac30Names).toHaveLength(26);

    const additionalNames = ['refractometerOriginalGravity', 'kpaToPsi', 'psiToBar', 'barToPsi', 'primingSugarG', 'forceCarbonationPsi', 'residualCO2Volumes', 'sgToPointsExact', 'litersToGallons'];
    expect(additionalNames).toHaveLength(9);

    const expectedUniverse = new Set([...ac30Names, ...additionalNames]);
    expect(expectedUniverse.size).toBe(35);

    const standaloneSet = new Set(standaloneOnly);
    const recipePathSet = new Set(recipePathCaller);
    expect(standaloneSet.size).toBe(22);
    expect(recipePathSet.size).toBe(13);
    expect(22 + 13).toBe(35);
    expect(26 + 9).toBe(35);

    const intersection = [...standaloneSet].filter((n) => recipePathSet.has(n));
    expect(intersection).toEqual([]);

    const union = new Set([...standaloneSet, ...recipePathSet]);
    expect(union.size).toBe(35);
    expect(union).toEqual(expectedUniverse);
  });

  // AC-26(d) / AC-31(d): no negation tests. Unchanged from P1 and binding
  // here — every (b) membership above is asserted positively via
  // callsWithin(...) === true, never via the absence of a caller.
});

describe('AC-27: runtime identity — the calculator\'s number is the recipe path\'s number', () => {
  it('calculateMashPlan(recipe).strikeTemperatureC strictly equals the imported strikeTemperatureC called with the same inputs', async () => {
    const { calculateMashPlan, strikeTemperatureC } = calcPackage as typeof import('@truchabrew/calculations');
    const { baseStoredRecipe, baseEquipment, baseMashProfile } = await import('./helpers/fixtures');

    const equipment = baseEquipment({ grainTemperatureC: 20, mashTunHeatCapacityL: 1.2 });
    const mashProfile = baseMashProfile({
      steps: [{ id: 'step-0', name: 'Saccharification Rest', type: 'Infusion', stepTempC: 67, stepTimeMin: 60, rampTimeMin: 0, infuseAmountL: null, infuseWaterTempC: 100 }],
    });
    const recipe = baseStoredRecipe({
      equipment,
      mashProfile,
      fermentables: [{ id: 'f-1', name: 'Pale Malt', type: 'Grain', amountKg: 5, colorSrm: 3.5, potentialSg: 1.038 }],
    });

    const plan = calculateMashPlan(recipe);
    if (!plan.hasMashProfile) throw new Error('expected a mash profile');

    const expected = strikeTemperatureC({
      targetMashTempC: 67,
      grainTemperatureC: equipment.grainTemperatureC,
      waterVolumeL: plan.strikeWaterL,
      grainWeightKg: plan.totalGrainKg,
      mashTunHeatCapacityL: equipment.mashTunHeatCapacityL,
    });

    expect(plan.strikeTemperatureC).toBe(expected);
  });
});

// M8_P2 AC-33 — extends AC-27's runtime-identity pattern to the second
// recipe/batch-path function family (carbonation), closing the milestone's
// verification threshold by execution as well as by static analysis. Not
// charged to any specific file in §1.4's inventory table; placed alongside
// AC-27, the block it explicitly extends, since both compare a recipe/
// batch-path entry point's output against the imported pure functions
// directly (no DOM render involved, exact === throughout, no tolerance).
describe('AC-33 (M8_P2): runtime identity — the carbonation calculator\'s numbers are the batch path\'s numbers', () => {
  it('for volumesCO2Target 2.4, peakFermentationTempC 20, beerVolumeL 19, carbonationTempC 4: buildClosingSnapshot and the three imported functions agree exactly', async () => {
    const { buildClosingSnapshot, residualCO2Volumes, primingSugarG, forceCarbonationPsi } = calcPackage as typeof import('@truchabrew/calculations');
    const { baseStoredRecipe } = await import('./helpers/fixtures');

    const recipeSnapshot = baseStoredRecipe();
    const volumesCO2Target = 2.4;
    const peakFermentationTempC = 20;
    const beerVolumeL = 19;
    const carbonationTempC = 4;

    const baseInput = {
      frozenAt: '2026-01-01T00:00:00.000Z',
      measuredOg: 1.05,
      measuredFg: 1.01,
      measuredPreBoilGravity: null,
      measuredBottlingSizeL: beerVolumeL,
      recipeSnapshot,
      peakFermentationTempC,
    };

    // Sugar-family snapshot exercises primingSugarG — which itself calls
    // residualCO2Volumes internally (AC-31(b)'s two-hop chain).
    const sugarSnapshot = buildClosingSnapshot({
      ...baseInput,
      carbonationType: 'Sugar',
      carbonationVolumesTarget: volumesCO2Target,
      carbonationTempC: null,
    });
    const expectedPrimingSugarG = primingSugarG({ volumesCO2Target, peakFermentationTempC, beerVolumeL });
    expect(sugarSnapshot.primingSugarG).toBe(expectedPrimingSugarG);
    // residualCO2Volumes's own pinned value (independently verified in
    // carbonation.test.ts, Untouched) is unchanged by this phase.
    expect(residualCO2Volumes(peakFermentationTempC)).toBe(2.1427799999999997);

    // Force-family snapshot exercises forceCarbonationPsi.
    const forceSnapshot = buildClosingSnapshot({
      ...baseInput,
      carbonationType: 'KegForce',
      carbonationVolumesTarget: volumesCO2Target,
      carbonationTempC,
    });
    const expectedForceCarbPsi = forceCarbonationPsi({ volumesCO2: volumesCO2Target, tempC: carbonationTempC });
    expect(forceSnapshot.carbonationForcePsi).toBe(expectedForceCarbPsi);

    // AC-15 separately asserts the CarbonationCalculator performs zero
    // arithmetic of its own and calls each of these three functions
    // exactly once — together with the identities above, the values the
    // component renders are these same function outputs, only formatted.
  });
});

describe('AC-32 (M8_P2): callsWithin is real containment, not adjacency — the four mutation properties', () => {
  const fixture = `
    function calculateMashPlan(recipe) {
      // strikeTemperatureC( -- a comment mentioning the name, not a call
      const note = "strikeTemperatureC(";
      return strikeTemperatureC(recipe);
    }
    function strikeTemperatureC(recipe) { return recipe; }
    function unrelatedFunction(recipe) {
      return strikeTemperatureC(recipe);
    }
  `;

  it('(baseline) the real call site inside the enclosing function is found', () => {
    expect(callsWithinSource(fixture, 'calculateMashPlan', 'strikeTemperatureC')).toBe(true);
  });

  it('(i) deleting the real call makes it false', () => {
    const mutated = fixture.replace('return strikeTemperatureC(recipe);', 'return recipe;');
    expect(callsWithinSource(mutated, 'calculateMashPlan', 'strikeTemperatureC')).toBe(false);
  });

  it('(ii) leaving the identifier only in a comment inside the enclosing function makes it false', () => {
    const commentOnly = `
      function calculateMashPlan(recipe) {
        // strikeTemperatureC(recipe) -- deleted, kept here as a note
        return recipe;
      }
      function strikeTemperatureC(recipe) { return recipe; }
    `;
    expect(callsWithinSource(commentOnly, 'calculateMashPlan', 'strikeTemperatureC')).toBe(false);
  });

  it('(iii) leaving the identifier only in a string literal makes it false', () => {
    const stringOnly = `
      function calculateMashPlan(recipe) {
        const note = "strikeTemperatureC(recipe)";
        return recipe;
      }
      function strikeTemperatureC(recipe) { return recipe; }
    `;
    expect(callsWithinSource(stringOnly, 'calculateMashPlan', 'strikeTemperatureC')).toBe(false);
  });

  it('(iv) relocating the call to another function in the same file makes it false', () => {
    const relocated = `
      function calculateMashPlan(recipe) {
        return recipe;
      }
      function strikeTemperatureC(recipe) { return recipe; }
      function unrelatedFunction(recipe) {
        return strikeTemperatureC(recipe);
      }
    `;
    expect(callsWithinSource(relocated, 'calculateMashPlan', 'strikeTemperatureC')).toBe(false);
  });

  it('resolves import aliases: `import { primingSugarG as computePrimingSugarG }` is found by its ORIGINAL name', () => {
    const aliased = `
      import { primingSugarG as computePrimingSugarG } from './carbonation';
      export function buildClosingSnapshot(input) {
        return computePrimingSugarG(input);
      }
    `;
    expect(callsWithinSource(aliased, 'buildClosingSnapshot', 'primingSugarG')).toBe(true);
  });

  it('an unrelated identically-named identifier in a different, unaliased import is NOT conflated', () => {
    // Sanity check: without the alias, the literal name must still be found directly.
    const direct = `
      import { primingSugarG } from './carbonation';
      export function buildClosingSnapshot(input) {
        return primingSugarG(input);
      }
    `;
    expect(callsWithinSource(direct, 'buildClosingSnapshot', 'primingSugarG')).toBe(true);
  });
});
