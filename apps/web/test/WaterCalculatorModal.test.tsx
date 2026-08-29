import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import type { WaterProfile, FermentableItem, MiscItem } from '@truchabrew/shared-types';
import type { WaterCalculatorModalProps } from '../src/components/WaterCalculatorModal';
import { WaterCalculatorModal } from '../src/components/WaterCalculatorModal';
import * as designSystem from '../src/components/designSystem';

const SRC_PATH = path.resolve(__dirname, '../src/components/WaterCalculatorModal.tsx');
const SOURCE = fs.readFileSync(SRC_PATH, 'utf-8');

const WATER_PROFILES: WaterProfile[] = [
  {
    id: 'wp-source-1',
    name: 'RO Water',
    type: 'source',
    calcium: 0,
    magnesium: 0,
    sodium: 0,
    chloride: 0,
    sulfate: 0,
    bicarbonate: 0,
    ph: null,
    description: null,
  },
  {
    id: 'wp-src-tap',
    name: 'Tap Water',
    type: 'source',
    calcium: 40,
    magnesium: 5,
    sodium: 12,
    chloride: 20,
    sulfate: 30,
    bicarbonate: 120,
    ph: null,
    description: null,
  },
  {
    id: 'wp-target-1',
    name: 'Balanced IPA',
    type: 'target',
    calcium: 100,
    magnesium: 10,
    sodium: 10,
    chloride: 60,
    sulfate: 150,
    bicarbonate: 40,
    ph: null,
    description: null,
  },
];

const FERMENTABLES: FermentableItem[] = [
  { id: 'f-1', name: 'Pale 2-Row', type: 'Grain', amountKg: 5, colorSrm: 3.5, potentialSg: 1.037 },
];

const MISCS: MiscItem[] = [];

function baseProps(): WaterCalculatorModalProps {
  return {
    isOpen: true,
    onClose: vi.fn(),
    waterProfiles: WATER_PROFILES,
    waterSourceId: null,
    waterTargetId: null,
    waterVolumeL: 23,
    fermentables: FERMENTABLES,
    miscs: MISCS,
    onSaveAdjustments: vi.fn(),
  };
}

function fixtureProps(overrides: Partial<WaterCalculatorModalProps> = {}) {
  return {
    ...baseProps(),
    mashWaterL: 13.8,
    spargeWaterL: 9.2,
    waterTargetId: 'wp-target-1',
    ...overrides,
  };
}

describe('AC-1: Dialog semantics survive the rebuild (M23_P1 AC-2/AC-3)', () => {
  it('exposes exactly one dialog with aria-modal and a labelledby pointing at its own title', () => {
    render(<WaterCalculatorModal {...baseProps()} />);

    const dialogs = screen.getAllByRole('dialog');
    expect(dialogs).toHaveLength(1);
    const dialog = dialogs[0];
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleName('Water Chemistry & Acid Adjustments');

    const labelledBy = dialog.getAttribute('aria-labelledby');
    expect(labelledBy).toBeTruthy();
    const titleEl = document.getElementById(labelledBy!);
    expect(titleEl).toBe(screen.getByText('Water Chemistry & Acid Adjustments'));
  });

  it('queryAllByRole("dialog") is empty when isOpen is false', () => {
    render(<WaterCalculatorModal {...baseProps()} isOpen={false} />);
    expect(screen.queryAllByRole('dialog')).toHaveLength(0);
  });
});

describe('AC-2: Palette sweeps survive (M23_P1 AC-5/AC-6, M34_P3 adoption reconcile)', () => {
  // M24_P1 RA-9 moved the token import from local to designSystem; M34_P3
  // migrated the modal's buttons onto <Button> from ./ui. The invariant
  // (amber-600 palette, not amber-500/slate-950) now lives in designSystem's
  // BUTTON_PRIMARY_CLASS, which <Button variant="primary"> applies. Assert
  // the primitive renders the token and the file adopts it. The red-* sweep
  // stays against SOURCE unmodified.
  it('renders <Button variant="primary"> and designSystem.BUTTON_PRIMARY_CLASS carries the amber-600 triplet with zero amber-500/slate-950, and zero red classes remain in source', () => {
    expect(SOURCE).toMatch(/import\s*\{[^}]*\bButton\b[^}]*\}\s*from\s*['"]\.\/ui['"]/);
    expect(SOURCE).toMatch(/<Button[^>]*variant="primary"/);
    expect(designSystem.BUTTON_PRIMARY_CLASS).not.toContain('bg-amber-500 hover:bg-amber-400');
    expect(designSystem.BUTTON_PRIMARY_CLASS).not.toContain('text-slate-950');
    expect(designSystem.BUTTON_PRIMARY_CLASS).toContain('bg-amber-600 hover:bg-amber-500 text-white');
    expect(SOURCE).not.toMatch(/\bbg-red-|\bborder-red-|\btext-red-/);
  });
});

describe('AC-3: Form-control backgrounds survive (M23_P1 AC-7, RA-19, M34_P3 adoption reconcile)', () => {
  // M24_P1 RA-9: the local INPUT_CLASS/SELECT_CLASS consts were replaced by
  // shared designSystem imports; M34_P3 further migrated the selects onto
  // <Select size="sm"> and the number inputs onto <NumberInput> from ./ui,
  // which apply FORM_SELECT_CLASS / INPUT_CLASS respectively. Reasserted as
  // adoption assertions plus the now-authoritative token values.
  it('renders <Select size="sm"> and <NumberInput>, and designSystem.INPUT_CLASS/FORM_SELECT_CLASS declare bg-slate-800, not bg-slate-950', () => {
    expect(SOURCE).toMatch(/import\s*\{[^}]*\bSelect\b[^}]*\}\s*from\s*['"]\.\/ui['"]/);
    expect(SOURCE).toMatch(/import\s*\{[^}]*\bNumberInput\b[^}]*\}\s*from\s*['"]\.\/ui['"]/);
    expect(SOURCE).toMatch(/<Select[^>]*size="sm"/);
    expect(SOURCE).toMatch(/<NumberInput/);
    expect(designSystem.INPUT_CLASS).toContain('bg-slate-800');
    expect(designSystem.INPUT_CLASS).not.toContain('bg-slate-950');
    expect(designSystem.FORM_SELECT_CLASS).toContain('bg-slate-800');
    expect(designSystem.FORM_SELECT_CLASS).not.toContain('bg-slate-950');
  });

  it('deliberately untouched Section 4 grist card bg-slate-950/60 surface still survives', () => {
    expect(SOURCE).toMatch(/bg-slate-950\/60/);
  });
});

describe('AC-4: Exactly one table (minerals); the acid table is FormField cards, ion table stays deleted (RA-15, Amendment 2)', () => {
  it('renders exactly one table (minerals) and omits finished ions table/bicarbonate', () => {
    const { container } = render(<WaterCalculatorModal {...fixtureProps()} />);
    // Amendment 2 replaced the acid table with FormField-based cards, so only
    // the minerals table remains as a <table>.
    expect(container.querySelectorAll('table')).toHaveLength(1);
    expect(screen.queryByText('Finished Water Ions (ppm)')).toBeNull();
    expect(screen.queryByText('Bicarbonate (HCO₃⁻)')).toBeNull();
  });
});

describe('AC-5: Minerals table column headers, with live volumes', () => {
  it('renders exactly Mineral, Needed, Mash (13.8 L), Sparge (9.2 L), and Total header texts', () => {
    render(<WaterCalculatorModal {...fixtureProps()} />);
    const mineralsContainer = screen.getByTestId('minerals-needed');
    const ths = mineralsContainer.querySelectorAll('th');
    expect(ths).toHaveLength(5);
    expect(ths[0].textContent?.trim()).toBe('Mineral');
    expect(ths[1].textContent?.trim()).toBe('Needed');
    expect(ths[2].textContent?.trim()).toBe('Mash (13.8 L)');
    expect(ths[3].textContent?.trim()).toBe('Sparge (9.2 L)');
    expect(ths[4].textContent?.trim()).toBe('Total');
  });
});

describe('AC-6: Five mineral rows, SALT_NAMES order, zeros included', () => {
  it('renders rows for all five salts in order with needed grams and 0.00 g initial total', () => {
    render(<WaterCalculatorModal {...fixtureProps()} />);

    const expectedSuggested: Record<string, string> = {
      gypsum: '23.41 g',
      'calcium-chloride': '10.87 g',
      'epsom-salt': '8.85 g',
      'table-salt': '0.00 g',
      'baking-soda': '4.82 g',
    };

    const orderedSlugs = [
      'gypsum',
      'calcium-chloride',
      'epsom-salt',
      'table-salt',
      'baking-soda',
    ];

    for (const slug of orderedSlugs) {
      const row = screen.getByTestId(`mineral-needed-${slug}`);
      expect(row).toBeInTheDocument();
      expect(screen.getByTestId(`mineral-needed-suggested-${slug}`)).toHaveTextContent(expectedSuggested[slug]);
      expect(screen.getByTestId(`mineral-needed-amount-${slug}`)).toHaveTextContent('0.00 g');
    }

    const rows = screen.getAllByTestId(/^mineral-needed-[a-z-]+$/);
    const rowIds = rows
      .filter(
        (el) =>
          !el.getAttribute('data-testid')!.includes('amount') &&
          !el.getAttribute('data-testid')!.includes('suggested'),
      )
      .map((el) => el.getAttribute('data-testid'));
    expect(rowIds).toEqual(orderedSlugs.map((slug) => `mineral-needed-${slug}`));
  });
});

describe('AC-7: treat-sparge-water lives in the Sparge <th> and defaults ON', () => {
  it('resolves treat-sparge-water-toggle inside the fourth th, checked by default', () => {
    render(<WaterCalculatorModal {...fixtureProps()} />);
    const toggle = screen.getByTestId('treat-sparge-water-toggle');
    expect(toggle).toHaveAttribute('type', 'checkbox');
    expect(toggle).toBeChecked();

    const mineralsContainer = screen.getByTestId('minerals-needed');
    const ths = mineralsContainer.querySelectorAll('th');
    expect(ths[3].contains(toggle)).toBe(true);
    expect(screen.getByLabelText(/^Sparge \(9\.2 L\)$/)).toBe(toggle);
  });
});

describe('AC-8: Geometry invariance — toggling disables, never unmounts (RA-2)', () => {
  it('preserves row and input counts on toggle-off and disables sparge inputs', () => {
    render(<WaterCalculatorModal {...fixtureProps()} />);
    const mineralsContainer = screen.getByTestId('minerals-needed');

    const rowCountBefore = mineralsContainer.querySelectorAll('tr').length;
    const inputCountBefore = mineralsContainer.querySelectorAll('input[type="number"]').length;

    fireEvent.click(screen.getByTestId('treat-sparge-water-toggle'));

    const rowCountAfter = mineralsContainer.querySelectorAll('tr').length;
    const inputCountAfter = mineralsContainer.querySelectorAll('input[type="number"]').length;

    expect(rowCountAfter).toBe(rowCountBefore);
    expect(inputCountAfter).toBe(inputCountBefore);

    for (const name of ['Gypsum', 'Calcium Chloride', 'Epsom Salt', 'Table Salt', 'Baking Soda']) {
      const spargeInput = screen.getByLabelText(`Sparge ${name}`);
      expect(spargeInput).toBeInTheDocument();
      expect(spargeInput).toBeDisabled();

      const mashInput = screen.getByLabelText(`Mash ${name}`);
      expect(mashInput).toBeInTheDocument();
      expect(mashInput).not.toBeDisabled();
    }
  });
});

describe('AC-9: Disabled styling is declared', () => {
  it('declares disabled opacity and cursor classes in source and on disabled inputs', () => {
    expect(SOURCE).toContain('disabled:opacity-40 disabled:cursor-not-allowed');

    render(<WaterCalculatorModal {...fixtureProps()} />);
    fireEvent.click(screen.getByTestId('treat-sparge-water-toggle'));

    const spargeGypsum = screen.getByLabelText('Sparge Gypsum');
    expect(spargeGypsum.className).toContain('disabled:opacity-40');
    expect(spargeGypsum.className).toContain('disabled:cursor-not-allowed');
  });
});

describe('AC-10: Toggling sparge OFF zeroes spargeSalts; ON restores nothing (RA-3)', () => {
  it('clears sparge inputs on toggle-off and leaves them empty on toggle-on', () => {
    render(<WaterCalculatorModal {...fixtureProps()} />);

    fireEvent.click(screen.getByTestId('water-auto-btn'));
    expect(screen.getByLabelText('Sparge Gypsum')).toHaveValue(9.36);

    fireEvent.click(screen.getByTestId('treat-sparge-water-toggle'));
    fireEvent.click(screen.getByTestId('treat-sparge-water-toggle'));

    for (const name of ['Gypsum', 'Calcium Chloride', 'Epsom Salt', 'Table Salt', 'Baking Soda']) {
      const input = screen.getByLabelText(`Sparge ${name}`);
      expect(input).toHaveValue(null);
      expect(input).not.toBeDisabled();
    }

    expect(screen.getByLabelText('Mash Gypsum')).toHaveValue(14.05);
  });
});

describe('AC-11: Total column is live in both toggle states; Needed column is invariant', () => {
  it('updates totals live when AUTO runs and when sparge treatment is toggled, with Needed invariant', () => {
    render(<WaterCalculatorModal {...fixtureProps()} />);

    expect(screen.getByTestId('mineral-needed-suggested-gypsum')).toHaveTextContent('23.41 g');
    expect(screen.getByTestId('mineral-needed-suggested-calcium-chloride')).toHaveTextContent('10.87 g');
    expect(screen.getByTestId('mineral-needed-suggested-epsom-salt')).toHaveTextContent('8.85 g');
    expect(screen.getByTestId('mineral-needed-suggested-table-salt')).toHaveTextContent('0.00 g');
    expect(screen.getByTestId('mineral-needed-suggested-baking-soda')).toHaveTextContent('4.82 g');

    fireEvent.click(screen.getByTestId('water-auto-btn'));

    expect(screen.getByTestId('mineral-needed-amount-gypsum')).toHaveTextContent('23.41 g');
    expect(screen.getByTestId('mineral-needed-amount-calcium-chloride')).toHaveTextContent('10.87 g');
    expect(screen.getByTestId('mineral-needed-amount-epsom-salt')).toHaveTextContent('8.85 g');
    expect(screen.getByTestId('mineral-needed-amount-table-salt')).toHaveTextContent('0.00 g');
    expect(screen.getByTestId('mineral-needed-amount-baking-soda')).toHaveTextContent('4.82 g');

    fireEvent.click(screen.getByTestId('treat-sparge-water-toggle'));
    expect(screen.getByTestId('mineral-needed-amount-gypsum')).toHaveTextContent('14.05 g');
    expect(screen.getByTestId('mineral-needed-suggested-gypsum')).toHaveTextContent('23.41 g');

    fireEvent.click(screen.getByTestId('treat-sparge-water-toggle'));
    fireEvent.click(screen.getByTestId('water-auto-btn'));
    expect(screen.getByTestId('mineral-needed-amount-gypsum')).toHaveTextContent('23.41 g');
  });
});

describe('AC-12: AUTO split, sparge ON', () => {
  it('splits suggested additions between mash and sparge proportionally', () => {
    render(<WaterCalculatorModal {...fixtureProps()} />);

    fireEvent.click(screen.getByTestId('water-auto-btn'));

    expect(screen.getByLabelText('Mash Gypsum')).toHaveValue(14.05);
    expect(screen.getByLabelText('Mash Calcium Chloride')).toHaveValue(6.52);
    expect(screen.getByLabelText('Mash Epsom Salt')).toHaveValue(5.31);
    expect(screen.getByLabelText('Mash Table Salt')).toHaveValue(null);
    expect(screen.getByLabelText('Mash Baking Soda')).toHaveValue(2.89);

    expect(screen.getByLabelText('Sparge Gypsum')).toHaveValue(9.36);
    expect(screen.getByLabelText('Sparge Calcium Chloride')).toHaveValue(4.35);
    expect(screen.getByLabelText('Sparge Epsom Salt')).toHaveValue(3.54);
    expect(screen.getByLabelText('Sparge Table Salt')).toHaveValue(null);
    expect(screen.getByLabelText('Sparge Baking Soda')).toHaveValue(1.93);
  });
});

describe('AC-13: AUTO doses 100% into mash when sparge is OFF', () => {
  it('doses full suggested amounts into mash and keeps sparge empty', () => {
    render(<WaterCalculatorModal {...fixtureProps()} />);

    fireEvent.click(screen.getByTestId('treat-sparge-water-toggle'));
    fireEvent.click(screen.getByTestId('water-auto-btn'));

    expect(screen.getByLabelText('Mash Gypsum')).toHaveValue(23.41);
    expect(screen.getByLabelText('Mash Calcium Chloride')).toHaveValue(10.87);
    expect(screen.getByLabelText('Mash Epsom Salt')).toHaveValue(8.85);
    expect(screen.getByLabelText('Mash Table Salt')).toHaveValue(null);
    expect(screen.getByLabelText('Mash Baking Soda')).toHaveValue(4.82);

    fireEvent.click(screen.getByTestId('treat-sparge-water-toggle'));
    for (const name of ['Gypsum', 'Calcium Chloride', 'Epsom Salt', 'Table Salt', 'Baking Soda']) {
      expect(screen.getByLabelText(`Sparge ${name}`)).toHaveValue(null);
    }
  });
});

describe('AC-14: Dual acid toggles default ON', () => {
  it('renders add-mash-acid-toggle and add-sparge-acid-toggle, both checked by default, 3 checkboxes total', () => {
    const { container } = render(<WaterCalculatorModal {...fixtureProps()} />);

    const mashAcidToggle = screen.getByTestId('add-mash-acid-toggle');
    const spargeAcidToggle = screen.getByTestId('add-sparge-acid-toggle');

    expect(mashAcidToggle).toBeInTheDocument();
    expect(mashAcidToggle).toBeChecked();
    expect(spargeAcidToggle).toBeInTheDocument();
    expect(spargeAcidToggle).toBeChecked();

    const checkboxesInDialog = container.querySelectorAll('input[type="checkbox"]');
    expect(checkboxesInDialog).toHaveLength(3);
  });
});

describe('AC-15: Single shared acid type', () => {
  it('renders exactly one acid type select, and source has zero mash/spargeAcidType', () => {
    render(<WaterCalculatorModal {...fixtureProps()} />);

    const acidSelect = screen.getByLabelText('Acid Type') as HTMLSelectElement;
    expect(acidSelect).toBeInTheDocument();
    expect(acidSelect.id).toBe('acidTypeSelect');
    expect(acidSelect.value).toBe('Lactic Acid 88%');

    const options = Array.from(acidSelect.options).map((opt) => opt.value);
    expect(options).toEqual(['Lactic Acid 88%', 'Phosphoric Acid 75%', 'Acidulated Malt']);

    expect(document.getElementById('mashAcidTypeSelect')).toBeNull();
    expect(document.getElementById('spargeAcidTypeSelect')).toBeNull();

    expect(SOURCE).not.toMatch(/mashAcidType/);
    expect(SOURCE).not.toMatch(/spargeAcidType/);
  });
});

describe('AC-16: Acid Adjustments structured FormField cards (Amendment 2)', () => {
  it('renders Acid Type selector, Mash & Sparge acidification cards, and Total Acid Addition', () => {
    render(<WaterCalculatorModal {...fixtureProps()} />);

    // Acid Type selector via FormField + Select
    const acidSelect = screen.getByLabelText('Acid Type');
    expect(acidSelect.id).toBe('acidTypeSelect');

    // Mash & Sparge toggles render within their cards (labels)
    const mashToggle = screen.getByTestId('add-mash-acid-toggle');
    const spargeToggle = screen.getByTestId('add-sparge-acid-toggle');
    expect(mashToggle).toBeChecked();
    expect(spargeToggle).toBeChecked();

    // FormField labels resolve via htmlFor/id
    expect(document.querySelector('label[for="targetMashPhInput"]')).toBeTruthy();
    expect(document.querySelector('label[for="mashAcidDosageInput"]')).toBeTruthy();
    expect(document.querySelector('label[for="targetSpargePhInput"]')).toBeTruthy();
    expect(document.querySelector('label[for="spargeAcidDosageInput"]')).toBeTruthy();

    // Total Acid Addition is a dedicated live indicator
    expect(screen.getByTestId('total-acid-addition')).toBeInTheDocument();
  });
});

describe('AC-17: Acid toggles OFF disable respective controls and zero dosages (RA-2, RA-3, RA-4)', () => {
  it('disables mash/sparge controls and zeroes amounts without resetting target pH', () => {
    render(<WaterCalculatorModal {...fixtureProps()} />);

    fireEvent.change(screen.getByLabelText('Mash Acid Dosage'), { target: { value: '3.5' } });
    fireEvent.change(screen.getByLabelText('Sparge Acid Dosage'), { target: { value: '2.1' } });

    // (a) Toggle mash acid OFF
    fireEvent.click(screen.getByTestId('add-mash-acid-toggle'));

    const mashDosage = screen.getByLabelText('Mash Acid Dosage');
    expect(mashDosage).toBeDisabled();
    expect(mashDosage).toHaveValue(null);

    const mashPh = document.getElementById('targetMashPhInput') as HTMLInputElement;
    expect(mashPh).toBeDisabled();
    expect(mashPh.value).toBe('5.3');

    // Sparge is still enabled
    const spargeDosage = screen.getByLabelText('Sparge Acid Dosage');
    expect(spargeDosage).not.toBeDisabled();
    expect(spargeDosage).toHaveValue(2.1);

    // (b) Toggle sparge acid OFF
    fireEvent.click(screen.getByTestId('add-sparge-acid-toggle'));

    expect(spargeDosage).toBeDisabled();
    expect(spargeDosage).toHaveValue(null);

    const spargePh = document.getElementById('targetSpargePhInput') as HTMLInputElement;
    expect(spargePh).toBeDisabled();
    expect(spargePh.value).toBe('5.5');
  });
});

describe('AC-18: Acid controls carry FormField labels (Amendment 2)', () => {
  it('ensures Dosage and Target pH labels exist via FormField htmlFor/id association', () => {
    render(<WaterCalculatorModal {...fixtureProps()} />);

    const mashDosageLabel = document.querySelector('label[for="mashAcidDosageInput"]');
    const spargeDosageLabel = document.querySelector('label[for="spargeAcidDosageInput"]');
    const mashPhLabel = document.querySelector('label[for="targetMashPhInput"]');
    const spargePhLabel = document.querySelector('label[for="targetSpargePhInput"]');

    expect(mashDosageLabel).toBeTruthy();
    expect(spargeDosageLabel).toBeTruthy();
    expect(mashPhLabel).toBeTruthy();
    expect(spargePhLabel).toBeTruthy();

    expect(mashDosageLabel?.textContent).toBe('Dosage');
    expect(spargeDosageLabel?.textContent).toBe('Dosage');

    // FormField labels use the design-system FORM_LABEL_CLASS typography.
    for (const label of [mashDosageLabel, spargeDosageLabel, mashPhLabel, spargePhLabel]) {
      expect(label?.className).toContain('text-xs');
      expect(label?.className).toContain('font-semibold');
    }
  });
});

describe('AC-19: Total Acid Addition computes live across all toggle states (RA-10, Amendment 2)', () => {
  it('updates acid total live across both toggle states and acid types', () => {
    render(<WaterCalculatorModal {...fixtureProps()} />);
    const totalEl = screen.getByTestId('total-acid-addition');

    fireEvent.change(screen.getByLabelText('Mash Acid Dosage'), { target: { value: '3.5' } });
    fireEvent.change(screen.getByLabelText('Sparge Acid Dosage'), { target: { value: '2.1' } });
    expect(totalEl).toHaveTextContent('5.60 ml');

    // Mash OFF, Sparge ON -> 2.10 ml
    fireEvent.click(screen.getByTestId('add-mash-acid-toggle'));
    expect(totalEl).toHaveTextContent('2.10 ml');

    // Both OFF -> 0.00 ml
    fireEvent.click(screen.getByTestId('add-sparge-acid-toggle'));
    expect(totalEl).toHaveTextContent('0.00 ml');

    // Mash ON, Sparge OFF -> 3.50 ml (after typing)
    fireEvent.click(screen.getByTestId('add-mash-acid-toggle'));
    fireEvent.change(screen.getByLabelText('Mash Acid Dosage'), { target: { value: '3.5' } });
    expect(totalEl).toHaveTextContent('3.50 ml');

    // Acidulated Malt -> g unit
    fireEvent.change(screen.getByLabelText('Acid Type'), { target: { value: 'Acidulated Malt' } });
    expect(totalEl).toHaveTextContent('3.50 g');
  });
});

describe('AC-20: Sparge Auto works for the two liquid acids and is a no-op for Acidulated Malt (RA-8)', () => {
  it('unified header AUTO computes sparge acid for Lactic and Phosphoric, and no-ops for Acidulated Malt against tap water (RA-3)', () => {
    render(<WaterCalculatorModal {...fixtureProps({ waterSourceId: 'wp-src-tap' })} />);

    const autoBtn = screen.getByTestId('water-auto-btn');
    const acidSelect = screen.getByLabelText('Acid Type');

    fireEvent.change(acidSelect, { target: { value: 'Lactic Acid 88%' } });
    fireEvent.click(autoBtn);
    expect(screen.getByLabelText('Sparge Acid Dosage')).toHaveValue(1.3);

    fireEvent.change(acidSelect, { target: { value: 'Phosphoric Acid 75%' } });
    fireEvent.click(autoBtn);
    expect(screen.getByLabelText('Sparge Acid Dosage')).toHaveValue(1.03);

    fireEvent.change(acidSelect, { target: { value: 'Acidulated Malt' } });
    fireEvent.click(autoBtn);
    expect(screen.getByLabelText('Sparge Acid Dosage')).toHaveValue(1.03);
  });

  it('unified header AUTO sets mash dosage to 3.34 on the shared fixture with Lactic Acid selected (RA-3)', () => {
    render(<WaterCalculatorModal {...fixtureProps()} />);
    fireEvent.click(screen.getByTestId('water-auto-btn'));
    expect(screen.getByLabelText('Mash Acid Dosage')).toHaveValue(3.34);
  });
});

describe('AC-21: Hydration derives acidType last-wins, and dosages independently (RA-7)', () => {
  it('hydrates acidType from the last acid misc entry and preserves both dosages', () => {
    const miscsWithAcids: MiscItem[] = [
      { id: 'm-1', name: 'Lactic Acid 88%', type: 'WaterAgent', use: 'Mash', timeMinutes: 0, amount: 2, unit: 'ml' },
      { id: 'm-2', name: 'Phosphoric Acid 75% (Sparge)', type: 'WaterAgent', use: 'Mash', timeMinutes: 0, amount: 1, unit: 'ml' },
    ];

    render(<WaterCalculatorModal {...fixtureProps({ miscs: miscsWithAcids })} />);

    expect(screen.getByLabelText('Acid Type')).toHaveValue('Phosphoric Acid 75%');
    expect(screen.getByLabelText('Mash Acid Dosage')).toHaveValue(2);
    expect(screen.getByLabelText('Sparge Acid Dosage')).toHaveValue(1);
  });
});

describe('AC-22: Save guards — both acid additions gated on their toggles (RA-6, RA-9)', () => {
  it('(a) mash acid OFF saves only sparge acid', () => {
    const onSaveAdjustments = vi.fn();
    render(<WaterCalculatorModal {...fixtureProps({ onSaveAdjustments })} />);

    fireEvent.change(screen.getByLabelText('Mash Acid Dosage'), { target: { value: '3.5' } });
    fireEvent.change(screen.getByLabelText('Sparge Acid Dosage'), { target: { value: '2.1' } });
    fireEvent.click(screen.getByTestId('add-mash-acid-toggle'));
    fireEvent.click(screen.getByTestId('save-water-adjustments-btn'));

    const payload = onSaveAdjustments.mock.calls[0][0];
    const acidMiscs = payload.miscs.filter((m: MiscItem) => m.name.includes('Acid') || m.name.includes('Malt'));
    expect(acidMiscs).toHaveLength(1);
    expect(acidMiscs[0]).toMatchObject({ name: 'Lactic Acid 88% (Sparge)', amount: 2.1, unit: 'ml' });
  });

  it('(b) sparge acid OFF saves only mash acid', () => {
    const onSaveAdjustments = vi.fn();
    render(<WaterCalculatorModal {...fixtureProps({ onSaveAdjustments })} />);

    fireEvent.change(screen.getByLabelText('Mash Acid Dosage'), { target: { value: '3.5' } });
    fireEvent.change(screen.getByLabelText('Sparge Acid Dosage'), { target: { value: '2.1' } });
    fireEvent.click(screen.getByTestId('add-sparge-acid-toggle'));
    fireEvent.click(screen.getByTestId('save-water-adjustments-btn'));

    const payload = onSaveAdjustments.mock.calls[0][0];
    const acidMiscs = payload.miscs.filter((m: MiscItem) => m.name.includes('Acid') || m.name.includes('Malt'));
    expect(acidMiscs).toHaveLength(1);
    expect(acidMiscs[0]).toMatchObject({ name: 'Lactic Acid 88%', amount: 3.5, unit: 'ml' });
  });

  it('(c) leaving both acid toggles ON saves both mash and sparge acid', () => {
    const onSaveAdjustments = vi.fn();
    render(<WaterCalculatorModal {...fixtureProps({ onSaveAdjustments })} />);

    fireEvent.change(screen.getByLabelText('Mash Acid Dosage'), { target: { value: '3.5' } });
    fireEvent.change(screen.getByLabelText('Sparge Acid Dosage'), { target: { value: '2.1' } });
    fireEvent.click(screen.getByTestId('save-water-adjustments-btn'));

    const payload = onSaveAdjustments.mock.calls[0][0];
    const acidMiscs = payload.miscs.filter((m: MiscItem) => m.name.includes('Acid') || m.name.includes('Malt'));
    expect(acidMiscs).toHaveLength(2);
    expect(acidMiscs.find((m: MiscItem) => m.name === 'Lactic Acid 88%')).toMatchObject({ amount: 3.5, unit: 'ml' });
    expect(acidMiscs.find((m: MiscItem) => m.name === 'Lactic Acid 88% (Sparge)')).toMatchObject({ amount: 2.1, unit: 'ml' });
  });

  it('(d) AUTO then Save with sparge ON saves mash and sparge salts', () => {
    const onSaveAdjustments = vi.fn();
    render(<WaterCalculatorModal {...fixtureProps({ onSaveAdjustments })} />);

    fireEvent.click(screen.getByTestId('water-auto-btn'));
    fireEvent.click(screen.getByTestId('save-water-adjustments-btn'));

    const payload = onSaveAdjustments.mock.calls[0][0];
    const mashGypsum = payload.miscs.find((m: MiscItem) => m.name === 'Gypsum');
    const spargeGypsum = payload.miscs.find((m: MiscItem) => m.name === 'Gypsum (Sparge)');
    expect(mashGypsum?.amount).toBe(14.05);
    expect(spargeGypsum?.amount).toBe(9.36);
  });

  it('(e) Unit pin (RA-9): Acidulated Malt, mash 50, sparge 4 saves g for mash and ml for sparge', () => {
    const onSaveAdjustments = vi.fn();
    render(<WaterCalculatorModal {...fixtureProps({ onSaveAdjustments })} />);

    fireEvent.change(screen.getByLabelText('Acid Type'), { target: { value: 'Acidulated Malt' } });
    fireEvent.change(screen.getByLabelText('Mash Acid Dosage'), { target: { value: '50' } });
    fireEvent.change(screen.getByLabelText('Sparge Acid Dosage'), { target: { value: '4' } });
    fireEvent.click(screen.getByTestId('save-water-adjustments-btn'));

    const payload = onSaveAdjustments.mock.calls[0][0];
    const mashMalt = payload.miscs.find((m: MiscItem) => m.name === 'Acidulated Malt');
    const spargeMalt = payload.miscs.find((m: MiscItem) => m.name === 'Acidulated Malt (Sparge)');
    expect(mashMalt).toMatchObject({ amount: 50, unit: 'g' });
    expect(spargeMalt).toMatchObject({ amount: 4, unit: 'ml' });
  });
});

describe('AC-23: Toggles reset to ON on reopen; handleReset leaves them alone (RA-5)', () => {
  it('resets toggles to ON on modal reopen, and handleReset preserves toggle states', () => {
    const { rerender } = render(<WaterCalculatorModal {...fixtureProps()} />);

    fireEvent.click(screen.getByTestId('treat-sparge-water-toggle'));
    fireEvent.click(screen.getByTestId('add-mash-acid-toggle'));
    fireEvent.click(screen.getByTestId('add-sparge-acid-toggle'));
    expect(screen.getByTestId('treat-sparge-water-toggle')).not.toBeChecked();
    expect(screen.getByTestId('add-mash-acid-toggle')).not.toBeChecked();
    expect(screen.getByTestId('add-sparge-acid-toggle')).not.toBeChecked();

    rerender(<WaterCalculatorModal {...fixtureProps()} isOpen={false} />);
    rerender(<WaterCalculatorModal {...fixtureProps()} isOpen={true} />);

    expect(screen.getByTestId('treat-sparge-water-toggle')).toBeChecked();
    expect(screen.getByTestId('add-mash-acid-toggle')).toBeChecked();
    expect(screen.getByTestId('add-sparge-acid-toggle')).toBeChecked();

    // Reset button leaves toggle state intact
    fireEvent.click(screen.getByTestId('treat-sparge-water-toggle'));
    fireEvent.click(screen.getByTestId('add-mash-acid-toggle'));
    fireEvent.click(screen.getByTestId('water-reset-btn'));

    expect(screen.getByTestId('treat-sparge-water-toggle')).not.toBeChecked();
    expect(screen.getByTestId('add-mash-acid-toggle')).not.toBeChecked();
    expect(screen.getByTestId('add-sparge-acid-toggle')).toBeChecked();
    expect(screen.getByLabelText('Mash Gypsum')).toHaveValue(null);
    expect(screen.getByLabelText('Sparge Gypsum')).toHaveValue(null);
    expect(screen.getByLabelText('Mash Acid Dosage')).toHaveValue(null);
    expect(screen.getByLabelText('Sparge Acid Dosage')).toHaveValue(null);
  });
});

describe('AC-24: Layout guardrails, by absolute count (RA-16)', () => {
  it('has exactly one md:grid-cols-2 and one md:grid-cols-3 with no conditional grid-cols', () => {
    const gridCols2Matches = SOURCE.match(/md:grid-cols-2/g) ?? [];
    const gridCols3Matches = SOURCE.match(/md:grid-cols-3/g) ?? [];

    expect(gridCols2Matches).toHaveLength(1);
    expect(gridCols3Matches).toHaveLength(1);

    const linesWithGridCols = SOURCE.split('\n').filter((l) => l.includes('grid-cols'));
    for (const line of linesWithGridCols) {
      expect(line.includes('?') || line.includes('&&')).toBe(false);
    }
  });
});

describe('AC-25: Mash pH badges track additions and dosages live', () => {
  it('renders initial and adjusted mash pH badges, updating live with acid dosage and toggles', () => {
    render(<WaterCalculatorModal {...fixtureProps()} />);

    const initialBadge = screen.getByTestId('modal-initial-mash-ph');
    const adjustedBadge = screen.getByTestId('modal-predicted-mash-ph');

    expect(initialBadge).toHaveTextContent('Initial Mash pH: 5.60');
    expect(adjustedBadge).toHaveTextContent('Adjusted Mash pH: 5.60');

    fireEvent.change(screen.getByLabelText('Mash Acid Dosage'), { target: { value: '3.5' } });
    expect(initialBadge).toHaveTextContent('Initial Mash pH: 5.60');
    expect(adjustedBadge).toHaveTextContent('Adjusted Mash pH: 5.32');
    expect(adjustedBadge.textContent).toMatch(/\d\.\d\d/);

    // Toggling mash acid off restores pre-acid pH
    fireEvent.click(screen.getByTestId('add-mash-acid-toggle'));
    expect(adjustedBadge).toHaveTextContent('Adjusted Mash pH: 5.60');

    const mineralsCard = screen.getByTestId('minerals-needed');
    const ratioLabel = screen.getByText(/SO₄²⁻ : Cl⁻ Ratio:/);
    expect(mineralsCard.contains(ratioLabel)).toBe(true);
  });
});

describe('M29_P3 AC-12: WaterCalculatorModal design tokens and tabular numbers', () => {
  it('applies SUBPANEL_CLASS and tabular-nums to mineral and acid tables', () => {
    const { container } = render(<WaterCalculatorModal {...fixtureProps()} />);
    const mineralsCard = screen.getByTestId('minerals-needed');
    expect(mineralsCard.className).toContain('rounded-lg');
    expect(container.querySelector('.tabular-nums')).not.toBeNull();
  });
});



