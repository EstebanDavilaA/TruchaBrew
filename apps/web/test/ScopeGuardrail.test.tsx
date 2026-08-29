import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import { FormField } from '../src/components/ui/FormField';

// New dedicated suite (M23_P1 spec §3). These are cross-file source sweeps
// for AC-4, AC-21, AC-26, AC-28 — deliberately NOT added to
// accessibilityAndPolish.test.tsx, which the spec's AC-25 scope guardrail
// pins hash-identical (untouched) for this phase.

describe('Milestone 23 Phase 1: nothing in this app is second-class anymore', () => {
  const SRC_DIR = path.resolve(__dirname, '../src');

  describe('AC-4: all eight dialogs render through the shared <Modal> wrapper, which owns role="dialog" + aria-modal="true" (M25_P1 RA-1)', () => {
    // M25_P1 supersedes the M23_P1-era per-file literal role/aria-modal sweep:
    // both attributes now live in Modal.tsx's own dynamic render, not as
    // literal text in each dialog's source, so the invariant is reconciled
    // to check (a) each dialog actually imports/uses the shared wrapper and
    // (b) the wrapper itself still carries the two attributes.
    const dialogFiles = [
      'App.tsx',
      'components/BatchRecipeAdjustModal.tsx',
      'components/ConfirmDialog.tsx',
      'components/PostBrewCalibrationModal.tsx',
      'components/PresetPickerModal.tsx',
      'components/RefractometerFermentationModal.tsx',
      'components/RecipeImportModal.tsx',
      'components/WaterCalculatorModal.tsx',
    ];

    it.each(dialogFiles)('%s imports Modal from the shared wrapper and renders <Modal>', (relPath) => {
      const content = fs.readFileSync(path.resolve(SRC_DIR, relPath), 'utf-8');
      expect(content).toMatch(/import\s*\{\s*Modal\s*\}\s*from\s*['"].*\/Modal['"]/);
      expect(content).toMatch(/<Modal\b/);
    });

    it('Modal.tsx declares role="dialog" as its default and always sets aria-modal="true"', () => {
      const modalContent = fs.readFileSync(path.resolve(SRC_DIR, 'components/Modal.tsx'), 'utf-8');
      expect(modalContent).toContain("role = 'dialog'");
      expect(modalContent).toContain('aria-modal="true"');
    });

    it('ConfirmDialog.tsx explicitly overrides role to "alertdialog" (AC-6)', () => {
      const content = fs.readFileSync(path.resolve(SRC_DIR, 'components/ConfirmDialog.tsx'), 'utf-8');
      expect(content).toContain('role="alertdialog"');
    });
  });

  describe('AC-21: zero window.confirm anywhere in apps/web/src (M27_P1 closed the App.tsx deferral)', () => {
    it('BatchNoteLog.tsx has zero window.confirm occurrences', () => {
      const content = fs.readFileSync(path.resolve(SRC_DIR, 'components/BatchNoteLog.tsx'), 'utf-8');
      expect(content.match(/window\.confirm/g)).toBeNull();
    });

    it('ReadingLog.tsx has zero window.confirm occurrences', () => {
      const content = fs.readFileSync(path.resolve(SRC_DIR, 'components/ReadingLog.tsx'), 'utf-8');
      expect(content.match(/window\.confirm/g)).toBeNull();
    });

    it('test/BatchNoteLog.test.tsx has zero window.confirm occurrences', () => {
      const content = fs.readFileSync(path.resolve(__dirname, 'BatchNoteLog.test.tsx'), 'utf-8');
      expect(content.match(/window\.confirm/g)).toBeNull();
    });

    it('test/ReadingLog.test.tsx has zero window.confirm occurrences', () => {
      const content = fs.readFileSync(path.resolve(__dirname, 'ReadingLog.test.tsx'), 'utf-8');
      expect(content.match(/window\.confirm/g)).toBeNull();
    });

    it('App.tsx has zero window.confirm calls (M27_P1 closes the deferral: the dirty-editor guard is now useBlocker + ConfirmDialog)', () => {
      // M27_P1 (RA-15) ends the deferral this block's title used to name:
      // confirmLeaveEditorIfDirty and its window.confirm() call are gone,
      // replaced by React Router's useBlocker predicate + the app's own
      // ConfirmDialog (RA-13). Matched as an actual invocation
      // (`window.confirm(`), not a bare text sweep of the identifier.
      const content = fs.readFileSync(path.resolve(SRC_DIR, 'App.tsx'), 'utf-8');
      expect(content.match(/window\.confirm\(/g)).toBeNull();
    });
  });

  describe('AC-26: BatchStepper and CarbonationPanel are fully gone (RA-17)', () => {
    it('none of the four files exist on disk', () => {
      expect(fs.existsSync(path.resolve(SRC_DIR, 'components/BatchStepper.tsx'))).toBe(false);
      expect(fs.existsSync(path.resolve(__dirname, 'BatchStepper.test.tsx'))).toBe(false);
      expect(fs.existsSync(path.resolve(SRC_DIR, 'components/CarbonationPanel.tsx'))).toBe(false);
      expect(fs.existsSync(path.resolve(__dirname, 'CarbonationPanel.test.tsx'))).toBe(false);
    });

    it('no remaining reference to BatchStepper, CarbonationPanel, stepStates, or TRANSITION_LABEL anywhere in src/ or test/', () => {
      // This test file itself necessarily contains those identifiers (as
      // string literals, to name what must be absent) — excluded from the
      // sweep of its own file, everything else must be clean.
      const pattern = /BatchStepper|CarbonationPanel|stepStates|TRANSITION_LABEL/;
      const selfPath = path.resolve(__dirname, 'ScopeGuardrail.test.tsx');
      const roots = [SRC_DIR, __dirname];
      const offenders: string[] = [];

      function walk(dir: string) {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            walk(full);
          } else if (/\.(tsx?|jsx?)$/.test(entry.name) && full !== selfPath) {
            const content = fs.readFileSync(full, 'utf-8');
            if (pattern.test(content)) offenders.push(full);
          }
        }
      }
      roots.forEach(walk);

      expect(offenders).toEqual([]);
    });
  });

  describe('AC-28: six untouched dialogs do not regress (RA-2)', () => {
    // M25_P1 reconciliation: aria-labelledby is now emitted dynamically by
    // Modal.tsx from a `titleId` prop, so "no aria-labelledby" is verified by
    // the absence of a `titleId` prop on these three dialogs' <Modal> call,
    // and "still labelled" is verified by the presence of the same prop with
    // its original id string, on the other three.
    it.each(['components/BatchRecipeAdjustModal.tsx', 'components/PresetPickerModal.tsx'])(
      '%s uses <Modal> without an explicit role override or a titleId (no aria-labelledby)',
      (relPath) => {
        const content = fs.readFileSync(path.resolve(SRC_DIR, relPath), 'utf-8');
        expect(content).toMatch(/<Modal\b/);
        expect(content).not.toMatch(/<Modal[^>]*\brole=/s);
        expect(content).not.toMatch(/\btitleId=/);
        expect(content).not.toContain('aria-labelledby');
      },
    );

    it('ConfirmDialog.tsx uses <Modal role="alertdialog"> with no titleId (no aria-labelledby)', () => {
      const content = fs.readFileSync(path.resolve(SRC_DIR, 'components/ConfirmDialog.tsx'), 'utf-8');
      expect(content).toContain('role="alertdialog"');
      expect(content).not.toMatch(/\btitleId=/);
      expect(content).not.toContain('aria-labelledby');
    });

    it('App.tsx still declares its scale-modal titleId="scale-modal-title"', () => {
      const content = fs.readFileSync(path.resolve(SRC_DIR, 'App.tsx'), 'utf-8');
      expect(content).toContain('titleId="scale-modal-title"');
    });

    it('PostBrewCalibrationModal.tsx still declares titleId="calibration-modal-title"', () => {
      const content = fs.readFileSync(path.resolve(SRC_DIR, 'components/PostBrewCalibrationModal.tsx'), 'utf-8');
      expect(content).toContain('titleId="calibration-modal-title"');
    });

    it('RefractometerFermentationModal.tsx still declares titleId="refractometer-modal-title"', () => {
      const content = fs.readFileSync(path.resolve(SRC_DIR, 'components/RefractometerFermentationModal.tsx'), 'utf-8');
      expect(content).toContain('titleId="refractometer-modal-title"');
    });
  });
});

describe('Milestone 31 Phase 4: the label sweep, explanatory-text token adoption, and the milestone adoption assertion', () => {
  const SRC_DIR = path.resolve(__dirname, '../src');
  const MILESTONE_31_FILES = [
    'components/EquipmentForm.tsx',
    'components/FermentationProfileForm.tsx',
    'components/MashProfileForm.tsx',
    'components/WaterProfileForm.tsx',
    'components/InventoryForm.tsx',
    'components/InventoryManager.tsx',
  ];

  describe('AC-13: zero unassociated (no htmlFor) <label> tags remain across the six Milestone 31 files', () => {
    it.each(MILESTONE_31_FILES)('%s has 0 bare <label> tags', (relPath) => {
      const content = fs.readFileSync(path.resolve(SRC_DIR, relPath), 'utf-8');
      const labelOpenTags = content.match(/<label\b[^>]*>/gs) ?? [];
      const bareLabels = labelOpenTags.filter((tag) => !/htmlFor\s*=/.test(tag));
      expect(bareLabels).toEqual([]);
    });
  });

  describe('AC-14 & AC-15: app-wide statically-unnamed control count', () => {
    // Implements the counting methodology verbatim from the spec's
    // "Resolved Ambiguities" section: an <input>, <select> or <textarea>
    // opening tag whose tag text contains neither an aria-label attribute
    // nor a word-guarded id attribute (so data-testid= does not count).
    // components/ui/** is excluded (id is injected at runtime via
    // FormField's cloneElement, so a static read is meaningless there);
    // *.test.tsx is excluded; a control that is the direct child of a
    // <FormField> opening tag is exempt for the same cloneElement reason.
    //
    // The tag boundary must be brace/quote-aware: a naive scan to the
    // first bare `>` truncates early on constructs like
    // `onChange={(e) => ...}` (the `=>` arrow contains a literal `>`),
    // which would misreport controls that do carry aria-label/id.
    function findTagEnd(content: string, start: number): number {
      let i = start;
      let braceDepth = 0;
      let quote: string | null = null;
      while (i < content.length) {
        const ch = content[i];
        if (quote) {
          if (ch === '\\') { i += 2; continue; }
          if (ch === quote) quote = null;
          i++;
          continue;
        }
        if (ch === '"' || ch === "'" || ch === '`') { quote = ch; i++; continue; }
        if (ch === '{') { braceDepth++; i++; continue; }
        if (ch === '}') { braceDepth--; i++; continue; }
        if (ch === '>' && braceDepth === 0) return i + 1;
        i++;
      }
      return content.length;
    }

    function countStaticallyUnnamed(content: string): number {
      const formFieldEnds: number[] = [];
      const ffOpenRe = /<FormField\b/g;
      let fm: RegExpExecArray | null;
      while ((fm = ffOpenRe.exec(content))) {
        formFieldEnds.push(findTagEnd(content, fm.index));
      }

      const ctrlOpenRe = /<(input|select|textarea)\b/gi;
      let count = 0;
      let m: RegExpExecArray | null;
      while ((m = ctrlOpenRe.exec(content))) {
        const start = m.index;
        const end = findTagEnd(content, start);
        const tag = content.slice(start, end);
        const hasAriaLabel = /aria-label\s*=/.test(tag);
        const hasId = /(^|[^\w-])id\s*=/.test(tag);
        if (hasAriaLabel || hasId) continue;

        const isFormFieldChild = formFieldEnds.some(
          (fend) => fend <= start && /^\s*$/.test(content.slice(fend, start)),
        );
        if (isFormFieldChild) continue;

        count++;
      }
      return count;
    }

    function walk(dir: string, out: string[]) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full, out);
        } else if (/\.tsx$/.test(entry.name) && !entry.name.endsWith('.test.tsx')) {
          out.push(full);
        }
      }
    }

    function perFileCounts(): Record<string, number> {
      const files: string[] = [];
      walk(SRC_DIR, files);
      const results: Record<string, number> = {};
      for (const file of files) {
        const rel = path.relative(SRC_DIR, file).replace(/\\/g, '/');
        if (rel.startsWith('components/ui/')) continue;
        const content = fs.readFileSync(file, 'utf-8');
        const count = countStaticallyUnnamed(content);
        if (count > 0) results[rel] = count;
      }
      return results;
    }

    it('AC-14: the app-wide total is <= 21 (amended, re-SPEC_APPROVED ceiling; this phase removes EquipmentForm 1 + InventoryManager 3 = 4 from the corrected 21 baseline)', () => {
      const counts = perFileCounts();
      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      expect(total).toBeLessThanOrEqual(21);
      // The six Milestone 31 files must each contribute 0.
      for (const relPath of MILESTONE_31_FILES) {
        expect(counts[relPath] ?? 0).toBe(0);
      }
    });

    it('AC-15: the remainder is enumerated file-by-file (not implicit)', () => {
      // This breakdown matches the spec's amended AC-15 table (re-SPEC_APPROVED
      // after /diagnose): the original table's naive tag-boundary parser
      // misclassified fully aria-labelled controls in HopSection.tsx,
      // MiscSection.tsx, MashSection.tsx, and YeastSection.tsx as unnamed. The
      // spec's corrected, brace/quote-aware methodology produced a 9-file,
      // 17-total breakdown at M31_P4; M32_P1/P2 have since migrated
      // HopSection.tsx and FermentableSection.tsx onto NumberInput, reducing
      // this to the 7-file, 10-total breakdown asserted below.
      const counts = perFileCounts();
      expect(counts).toEqual({
        'App.tsx': 1,
        'components/PresetPickerModal.tsx': 1,
        'components/ReadingLog.tsx': 1,
        'components/RecipeImportModal.tsx': 3,
        'components/RecipeLibrary.tsx': 2,
        'components/SettingsManager.tsx': 1,
      });
    });
  });

  describe('AC-16: fully-retired label variants stay retired', () => {
    function countLiteral(literal: string): number {
      const files: string[] = [];
      function walk(dir: string) {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) walk(full);
          else if (/\.tsx$/.test(entry.name)) files.push(full);
        }
      }
      walk(SRC_DIR);
      let count = 0;
      for (const file of files) {
        const content = fs.readFileSync(file, 'utf-8');
        const matches = content.match(new RegExp(literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'));
        count += matches ? matches.length : 0;
      }
      return count;
    }

    it('"block text-xs font-semibold text-slate-400 mb-1" occurs exactly 0 times', () => {
      expect(countLiteral('block text-xs font-semibold text-slate-400 mb-1')).toBe(0);
    });

    it('"block text-[11px] text-slate-400 mb-1" occurs exactly 0 times', () => {
      expect(countLiteral('block text-[11px] text-slate-400 mb-1')).toBe(0);
    });
  });

  describe('AC-17: deliberately-deferred label variants are pinned, not swept', () => {
    it('"block text-sm font-medium text-slate-300" occurs exactly 10 times, only in pages/BatchDetail.tsx', () => {
      const content = fs.readFileSync(path.resolve(SRC_DIR, 'pages/BatchDetail.tsx'), 'utf-8');
      const matches = content.match(/block text-sm font-medium text-slate-300/g) ?? [];
      expect(matches.length).toBe(10);

      const others = ['App.tsx', 'components/SplitPackagingPanel.tsx', ...MILESTONE_31_FILES];
      for (const relPath of others) {
        const other = fs.readFileSync(path.resolve(SRC_DIR, relPath), 'utf-8');
        expect(other).not.toContain('block text-sm font-medium text-slate-300');
      }
    });

    it('"block text-xs font-medium text-slate-400 mb-1" occurs exactly 6 times, only in components/SplitPackagingPanel.tsx', () => {
      const content = fs.readFileSync(path.resolve(SRC_DIR, 'components/SplitPackagingPanel.tsx'), 'utf-8');
      const matches = content.match(/block text-xs font-medium text-slate-400 mb-1/g) ?? [];
      expect(matches.length).toBe(6);
    });

    it('"block text-xs font-medium text-slate-300 mb-1" occurs exactly 1 time, only in App.tsx', () => {
      const content = fs.readFileSync(path.resolve(SRC_DIR, 'App.tsx'), 'utf-8');
      const matches = content.match(/block text-xs font-medium text-slate-300 mb-1/g) ?? [];
      expect(matches.length).toBe(1);
    });
  });

  describe('AC-1, AC-2 & AC-18: FormField hint/error/degenerate-id behavior', () => {
    it('AC-1: hint span renders className exactly "text-xs text-slate-400" and the hand-typed literal is gone from source', () => {
      const source = fs.readFileSync(path.resolve(SRC_DIR, 'components/ui/FormField.tsx'), 'utf-8');
      expect(source).toContain('METADATA_TEXT_CLASS');
      expect(source).not.toContain('"text-xs text-slate-400"');

      render(
        <FormField label="L" hint="H">
          <input />
        </FormField>,
      );
      expect(screen.getByText('H')).toHaveClass('text-xs', 'text-slate-400');
      expect(screen.getByText('H').className).toBe('text-xs text-slate-400');
    });

    it('AC-2: error span is untouched ("text-xs text-rose-400"), and hint is suppressed when error is present', () => {
      render(
        <FormField label="L" hint="H" error="E">
          <input />
        </FormField>,
      );
      expect(screen.getByText('E').className).toBe('text-xs text-rose-400');
      expect(screen.queryByText('H')).not.toBeInTheDocument();
    });

    it('AC-18: degenerate FormField input behavior is unregressed', () => {
      const { container: c1 } = render(
        <FormField>
          <input data-testid="no-label-input" />
        </FormField>,
      );
      expect(c1.querySelector('label')).toBeNull();
      expect(screen.getByTestId('no-label-input')).not.toHaveAttribute('id');

      render(
        <FormField label="L" htmlFor="explicit">
          <input data-testid="explicit-id-input" />
        </FormField>,
      );
      expect(screen.getByTestId('explicit-id-input')).toHaveAttribute('id', 'explicit');

      render(
        <FormField label="L2">
          <input data-testid="own-id-input" id="own-id" />
        </FormField>,
      );
      expect(screen.getByTestId('own-id-input')).toHaveAttribute('id', 'own-id');
    });
  });
});
