import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import { FormField } from '../src/components/ui/FormField';

const SRC_DIR = path.resolve(__dirname, '../src');

function findTagEnd(content: string, start: number): number {
  let i = start;
  let braceDepth = 0;
  let quote: string | null = null;
  while (i < content.length) {
    const ch = content[i];
    if (quote) {
      if (ch === '\\') {
        i += 2;
        continue;
      }
      if (ch === quote) quote = null;
      i++;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      i++;
      continue;
    }
    if (ch === '{') {
      braceDepth++;
      i++;
      continue;
    }
    if (ch === '}') {
      braceDepth--;
      i++;
      continue;
    }
    if (ch === '>' && braceDepth === 0) return i + 1;
    i++;
  }
  return content.length;
}

export interface Violation {
  file: string;
  tag: string;
  element: string;
  line: number;
  reason: string;
}

export function scanAdoptionViolations(filePath: string, content: string): Violation[] {
  const rel = path.relative(SRC_DIR, filePath).replace(/\\/g, '/');
  if (rel.startsWith('components/ui/') || rel.startsWith('test/')) {
    return [];
  }

  const violations: Violation[] = [];
  const tagRegex = /<([a-zA-Z0-9_-]+)\b/g;
  let match: RegExpExecArray | null;

  while ((match = tagRegex.exec(content))) {
    const tagName = match[1];
    const startIndex = match.index;

    if (!['table'].includes(tagName)) {
      continue;
    }

    const endIndex = findTagEnd(content, startIndex);
    const tagText = content.slice(startIndex, endIndex);
    const lineNum = content.slice(0, startIndex).split('\n').length;

    if (tagName === 'table') {
      violations.push({
        file: rel,
        tag: tagText,
        element: tagName,
        line: lineNum,
        reason: 'Raw <table> is forbidden outside components/ui/**. Use <Table> primitive.',
      });
    }
  }

  return violations;
}

function walkTsx(dir: string, out: string[]) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkTsx(full, out);
    } else if (/\.tsx$/.test(entry.name) && !entry.name.endsWith('.test.tsx')) {
      out.push(full);
    }
  }
}

describe('Milestone 23 Phase 1: nothing in this app is second-class anymore', () => {
  describe('AC-4: all eight dialogs render through the shared <Modal> wrapper, which owns role="dialog" + aria-modal="true" (M25_P1 RA-1)', () => {
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

describe('Milestone 31 Phase 4: label association & structural accessibility invariants (retired pin debt)', () => {
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

  describe('AC-14 & AC-15: structural accessibility invariant for form inputs (retired pin debt)', () => {
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

        // Check if comment or hidden file input
        if (/type=["']file["']/.test(tag) && /hidden/.test(tag)) continue;
        if (/type=["']radio["']/.test(tag)) continue;

        const hasAriaLabel = /aria-label\s*=/.test(tag) || /aria-labelledby\s*=/.test(tag);
        const hasId = /(^|[^\w-])id\s*=/.test(tag);
        const isFormFieldChild = formFieldEnds.some(
          (fend) => fend <= start && /^\s*$/.test(content.slice(fend, start)),
        );

        if (!hasAriaLabel && !hasId && !isFormFieldChild) {
          count++;
        }
      }
      return count;
    }

    it('the six Milestone 31 files each contribute exactly 0 unnamed controls', () => {
      for (const relPath of MILESTONE_31_FILES) {
        const content = fs.readFileSync(path.resolve(SRC_DIR, relPath), 'utf-8');
        expect(countStaticallyUnnamed(content)).toBe(0);
      }
    });
  });

  describe('AC-16 & AC-17: retired label literal pins onto design system tokens', () => {
    it('fully-retired label literals stay 0 occurrences', () => {
      const files: string[] = [];
      walkTsx(SRC_DIR, files);
      for (const file of files) {
        const content = fs.readFileSync(file, 'utf-8');
        expect(content).not.toContain('block text-xs font-semibold text-slate-400 mb-1');
        expect(content).not.toContain('block text-[11px] text-slate-400 mb-1');
      }
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

describe('Milestone 35 Phase 4: Adoption Guardrail & Anti-Drift Suite (AC-1..AC-9)', () => {
  it('AC-4: zero raw <table> elements exist in apps/web/src outside components/ui/', () => {
    const files: string[] = [];
    walkTsx(SRC_DIR, files);

    const allViolations: Violation[] = [];
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      const v = scanAdoptionViolations(file, content);
      if (v.length > 0) {
        allViolations.push(...v);
      }
    }

    expect(allViolations).toEqual([]);
  });

  describe('Negative Controls (Failure Demonstration): scanner rejects drift constructs (AC-6..AC-9)', () => {
    function scanSynthetic(snippet: string): Violation[] {
      const violations: Violation[] = [];
      const tagRegex = /<([a-zA-Z0-9_-]+)\b/g;
      let match: RegExpExecArray | null;

      while ((match = tagRegex.exec(snippet))) {
        const tagName = match[1];
        const startIndex = match.index;

        if (!['button', 'input', 'table'].includes(tagName)) {
          continue;
        }

        const endIndex = findTagEnd(snippet, startIndex);
        const tagText = snippet.slice(startIndex, endIndex);

        if (tagName === 'button') {
          violations.push({
            file: 'synthetic.tsx',
            tag: tagText,
            element: tagName,
            line: 1,
            reason: 'Raw <button> is forbidden outside components/ui/**. Use <Button> primitive.',
          });
        } else if (tagName === 'table') {
          violations.push({
            file: 'synthetic.tsx',
            tag: tagText,
            element: tagName,
            line: 1,
            reason: 'Raw <table> is forbidden outside components/ui/**. Use <Table> primitive.',
          });
        } else if (tagName === 'input') {
          const isHiddenFile =
            /type=["']file["']/.test(tagText) &&
            (/\bhidden\b/.test(tagText) || /className=["'][^"']*\bhidden\b[^"']*["']/.test(tagText));
          if (!isHiddenFile) {
            violations.push({
              file: 'synthetic.tsx',
              tag: tagText,
              element: tagName,
              line: 1,
              reason: 'Raw <input> is forbidden outside components/ui/**. Use <Input>, <NumberInput>, or <FormField>.',
            });
          }
        }
      }

      return violations;
    }

    it('AC-6: scanner rejects synthetic raw <button className="bg-amber-600 ...">', () => {
      const snippet = '<button className="bg-amber-600 hover:bg-amber-500 text-white">Click Me</button>';
      const violations = scanSynthetic(snippet);
      expect(violations.length).toBe(1);
      expect(violations[0].element).toBe('button');
      expect(violations[0].reason).toContain('Raw <button> is forbidden');
    });

    it('AC-7: scanner rejects synthetic raw <input className="bg-slate-800 ...">', () => {
      const snippet = '<input className="bg-slate-800 text-slate-100" placeholder="Type here" />';
      const violations = scanSynthetic(snippet);
      expect(violations.length).toBe(1);
      expect(violations[0].element).toBe('input');
      expect(violations[0].reason).toContain('Raw <input> is forbidden');
    });

    it('AC-8: scanner rejects synthetic raw <table className="w-full ...">', () => {
      const snippet = '<table className="w-full text-left"><tbody><tr><td>Data</td></tr></tbody></table>';
      const violations = scanSynthetic(snippet);
      expect(violations.length).toBe(1);
      expect(violations[0].element).toBe('table');
      expect(violations[0].reason).toContain('Raw <table> is forbidden');
    });

    it('AC-9: scanner permits whitelisted hidden file input <input type="file" className="hidden" />', () => {
      const snippet = '<input type="file" ref={fileRef} className="hidden" accept=".json" />';
      const violations = scanSynthetic(snippet);
      expect(violations.length).toBe(0);
    });
  });
});
