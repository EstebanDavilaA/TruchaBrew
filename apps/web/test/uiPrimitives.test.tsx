import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { FormField, Input, Select, Button, NumberInput, Table, TableHeaderCell, TableCell, Badge } from '../src/components/ui';
import type { NumberInputWidth as UiNumberInputWidth } from '../src/components/ui';
import type { NumberInputWidth as DirectNumberInputWidth } from '../src/components/ui/NumberInput';
import {
  CalculatorCard,
  NumericField,
  SelectField,
  ResultRow,
} from '../src/components/calculators/CalculatorCard';
import {
  CARD_CLASS,
  SUBPANEL_CLASS,
  MONO_VALUE_CLASS,
  TABLE_CLASS,
  TABLE_HEADER_CELL_CLASS,
  TABLE_CELL_CLASS,
} from '../src/components/designSystem';
import { ConfigProvider } from '../src/context/ConfigContext';
import { Calculators } from '../src/pages/Calculators';
import { BrewSheet } from '../src/components/BrewSheet';
import type { Recipe, EquipmentProfile } from '@truchabrew/shared-types';
import { buildBrewSheetModel, calculateRecipeStats } from '@truchabrew/calculations';

// --- M35_P2: the 10-table migration sweep (below) needs the 9 migrated
// components rendered end-to-end, plus their supporting types/providers. ---
import { FermentableSection } from '../src/components/FermentableSection';
import { HopSection } from '../src/components/HopSection';
import { MiscSection } from '../src/components/MiscSection';
import { YeastSection } from '../src/components/YeastSection';
import { MashSection } from '../src/components/MashSection';
import { ReadingLog } from '../src/components/ReadingLog';
import { StockCheckPanel } from '../src/components/StockCheckPanel';
import { PostBrewCalibrationModal } from '../src/components/PostBrewCalibrationModal';
import { WaterCalculatorModal } from '../src/components/WaterCalculatorModal';
import { calculateMashPlan } from '@truchabrew/calculations';
import type { MashPlan, CalibrationEvaluationResult } from '@truchabrew/calculations';
import type {
  UserConfig,
  HopItem,
  MiscItem,
  WaterProfile,
  Reading,
  BatchCheckoffState,
} from '@truchabrew/shared-types';
import type { FermentableItem, YeastItem } from '../src/types/brewing';

vi.mock('../src/context/CatalogContext', () => ({
  useCatalog: () => ({
    catalog: { fermentables: [], hops: [], yeasts: [], miscs: [] },
    loading: false,
    error: null,
    reload: vi.fn(),
  }),
}));

vi.mock('../src/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/api/client')>();
  return {
    ...actual,
    getBatchCheckoff: vi.fn(),
    checkoffInventoryItem: vi.fn(),
    reverseInventoryCheckoff: vi.fn(),
  };
});

import { getBatchCheckoff as m35p2GetBatchCheckoff } from '../src/api/client';

describe('UI Primitives (M30_P2 & M30_P3 & M30_P4)', () => {
  describe('AC-1: exports FormField, Input, Select, Button, NumberInput', () => {
    it('exports all 5 components as callable functions', () => {
      expect(typeof FormField).toBe('function');
      expect(typeof Input).toBe('function');
      expect(typeof Select).toBe('function');
      expect(typeof Button).toBe('function');
      expect(typeof NumberInput).toBe('function');
    });
  });

  describe('AC-2 & AC-3: FormField component', () => {
    it('renders label with FORM_LABEL_CLASS when label is provided without htmlFor', () => {
      render(
        <FormField label="Batch Volume">
          <input data-testid="test-input" />
        </FormField>,
      );
      const label = screen.getByText('Batch Volume').closest('label');
      expect(label).toBeInTheDocument();
      expect(label).toHaveClass('block', 'text-xs', 'font-semibold', 'text-slate-400', 'mb-1');
    });

    it('renders label with htmlFor and FORM_LABEL_CLASS when htmlFor is provided', () => {
      render(
        <FormField label="Target Temp" htmlFor="target-temp-id">
          <input id="target-temp-id" data-testid="test-input" />
        </FormField>,
      );
      const label = screen.getByText('Target Temp');
      expect(label.tagName).toBe('LABEL');
      expect(label).toHaveAttribute('for', 'target-temp-id');
      expect(label).toHaveClass('block', 'text-xs', 'font-semibold', 'text-slate-400', 'mb-1');
    });

    it('renders required indicator when required is true', () => {
      render(
        <FormField label="Required Field" required>
          <input />
        </FormField>,
      );
      expect(screen.getByText('*')).toBeInTheDocument();
      expect(screen.getByText('*')).toHaveClass('text-amber-500');
    });

    it('renders hint text in slate-400 when provided and no error', () => {
      render(
        <FormField label="Field with hint" hint="Must be between 10 and 100">
          <input />
        </FormField>,
      );
      const hint = screen.getByText('Must be between 10 and 100');
      expect(hint).toBeInTheDocument();
      expect(hint).toHaveClass('text-xs', 'text-slate-400');
    });

    it('renders error text in rose-400 when provided, suppressing hint', () => {
      render(
        <FormField label="Field with error" hint="Hint text" error="Value is required">
          <input />
        </FormField>,
      );
      expect(screen.getByText('Value is required')).toBeInTheDocument();
      expect(screen.getByText('Value is required')).toHaveClass('text-xs', 'text-rose-400');
      expect(screen.queryByText('Hint text')).not.toBeInTheDocument();
    });
  });

  describe('AC-4, AC-5, AC-6: Input component', () => {
    it('renders with INPUT_CLASS and CONTROL_HEIGHT_CLASS (h-10) by default', () => {
      render(<Input data-testid="input-default" placeholder="Enter number" />);
      const el = screen.getByTestId('input-default');
      expect(el).toHaveClass('w-full', 'bg-slate-800', 'border-slate-700', 'rounded-lg', 'h-10');
      expect(el).toHaveClass('focus:border-amber-500', 'focus-visible:outline-2', 'focus-visible:outline-amber-500');
    });

    it('renders size="sm" with INPUT_COMPACT_CLASS without h-10', () => {
      render(<Input size="sm" data-testid="input-sm" />);
      const el = screen.getByTestId('input-sm');
      expect(el).toHaveClass('w-full', 'bg-slate-800', 'border-slate-700', 'rounded', 'px-2.5', 'py-1', 'text-xs');
      expect(el).not.toHaveClass('h-10');
    });

    it('renders mono={true} with font-mono tabular-nums', () => {
      render(<Input mono data-testid="input-mono" />);
      const el = screen.getByTestId('input-mono');
      expect(el).toHaveClass('font-mono', 'tabular-nums');
    });

    it('renders variant="underline" with the inline metadata style (transparent, bottom-border, no box)', () => {
      render(<Input variant="underline" data-testid="input-underline" />);
      const el = screen.getByTestId('input-underline');
      expect(el).toHaveClass(
        'w-full',
        'bg-transparent',
        'border-b',
        'border-transparent',
        'hover:border-slate-700',
        'focus:border-amber-500',
      );
      // focus:outline-none is deliberately NOT in the token (design governance,
      // M30_P2 AC-14/15); callers append it inline via className.
      expect(el).not.toHaveClass('focus:outline-none');
      expect(el).not.toHaveClass('bg-slate-800', 'rounded-lg', 'rounded', 'px-3', 'px-2.5', 'py-2', 'py-1', 'h-10');
    });

    it('variant="underline" appends an inline className (e.g. focus:outline-none) after the token classes', () => {
      render(<Input variant="underline" className="focus:outline-none" data-testid="input-underline-focus" />);
      const el = screen.getByTestId('input-underline-focus');
      expect(el).toHaveClass('focus:outline-none', 'bg-transparent', 'border-b');
    });
  });

  describe('AC-7, AC-8, AC-9, AC-10: Select component', () => {
    const OPTIONS = [
      { value: 'opt1', label: 'Option 1' },
      { value: 'opt2', label: 'Option 2', disabled: true },
    ];

    it('renders with FORM_SELECT_CLASS and CONTROL_HEIGHT_CLASS (h-10) by default with options prop', () => {
      render(<Select options={OPTIONS} data-testid="select-default" defaultValue="opt1" />);
      const el = screen.getByTestId('select-default');
      expect(el).toHaveClass('w-full', 'bg-slate-800', 'border-slate-700', 'rounded-lg', 'h-10', 'cursor-pointer');
      expect(el).toHaveClass('focus:border-amber-500', 'focus-visible:outline-2', 'focus-visible:outline-amber-500');
      expect(screen.getByRole('option', { name: 'Option 1' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Option 2' })).toBeDisabled();
    });

    it('renders size="sm" with FORM_SELECT_COMPACT_CLASS', () => {
      render(<Select size="sm" options={OPTIONS} data-testid="select-sm" />);
      const el = screen.getByTestId('select-sm');
      expect(el).toHaveClass('w-full', 'bg-slate-800', 'border-slate-700', 'rounded', 'px-2', 'py-1', 'text-xs');
      expect(el).not.toHaveClass('h-10');
    });

    it('renders options from JSX children when options prop is not passed', () => {
      render(
        <Select data-testid="select-children">
          <option value="custom1">Custom 1</option>
          <option value="custom2">Custom 2</option>
        </Select>,
      );
      expect(screen.getByRole('option', { name: 'Custom 1' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Custom 2' })).toBeInTheDocument();
    });
  });

  describe('M30_P3 AC-2 to AC-7: Button component', () => {
    it('AC-2: renders variant="primary" by default with BUTTON_PRIMARY_CLASS', () => {
      render(<Button data-testid="btn-primary">Save Recipe</Button>);
      const btn = screen.getByTestId('btn-primary');
      expect(btn).toHaveClass('bg-amber-600', 'hover:bg-amber-500', 'text-white', 'rounded-lg');
      expect(btn.tagName).toBe('BUTTON');
      expect(btn).toHaveAttribute('type', 'button');
    });

    it('AC-3: renders variant="secondary" with BUTTON_SECONDARY_CLASS', () => {
      render(<Button variant="secondary" data-testid="btn-secondary">Cancel</Button>);
      const btn = screen.getByTestId('btn-secondary');
      expect(btn).toHaveClass('bg-slate-800', 'hover:bg-slate-700', 'text-slate-200', 'border', 'border-slate-700');
    });

    it('AC-4: renders variant="danger" with BUTTON_DANGER_CLASS', () => {
      render(<Button variant="danger" data-testid="btn-danger">Delete</Button>);
      const btn = screen.getByTestId('btn-danger');
      expect(btn).toHaveClass('bg-rose-950/80', 'hover:bg-rose-900', 'text-rose-200', 'border-rose-800');
    });

    it('AC-5: renders variant="icon" with BUTTON_ICON_CLASS', () => {
      render(<Button variant="icon" aria-label="Settings" data-testid="btn-icon">⚙</Button>);
      const btn = screen.getByTestId('btn-icon');
      expect(btn).toHaveClass('p-2', 'rounded-lg', 'text-slate-400', 'hover:bg-slate-800');
    });

    it('AC-6: renders size="sm" with compact padding/text for text buttons', () => {
      render(<Button size="sm" data-testid="btn-sm">Compact</Button>);
      const btn = screen.getByTestId('btn-sm');
      expect(btn).toHaveClass('text-xs', 'px-3', 'py-1.5');
    });

    it('AC-7: defaults to type="button", respects disabled, onClick, custom type', () => {
      const onClick = vi.fn();
      render(
        <Button disabled onClick={onClick} type="submit" data-testid="btn-props">
          Submit
        </Button>,
      );
      const btn = screen.getByTestId('btn-props');
      expect(btn).toHaveAttribute('type', 'submit');
      expect(btn).toBeDisabled();
      fireEvent.click(btn);
      expect(onClick).not.toHaveBeenCalled();
    });
  });

  describe('M30_P3 AC-8 to AC-12: NumberInput component', () => {
    it('AC-8: renders with INPUT_CLASS, CONTROL_HEIGHT_CLASS (h-10), and MONO_VALUE_CLASS (tracking-tight)', () => {
      render(<NumberInput data-testid="num-default" defaultValue="1.054" />);
      const input = screen.getByTestId('num-default');
      expect(input).toHaveClass('w-full', 'bg-slate-800', 'border-slate-700', 'rounded-lg', 'h-10');
      expect(input).toHaveClass('font-mono', 'tabular-nums', 'tracking-tight');
      expect(input).toHaveAttribute('type', 'text');
      expect(input).toHaveAttribute('inputmode', 'decimal');
    });

    it('AC-9: renders size="sm" with INPUT_COMPACT_CLASS and MONO_VALUE_CLASS without h-10', () => {
      render(<NumberInput size="sm" data-testid="num-sm" />);
      const input = screen.getByTestId('num-sm');
      expect(input).toHaveClass('w-full', 'bg-slate-800', 'border-slate-700', 'rounded', 'px-2.5', 'py-1', 'text-xs');
      expect(input).toHaveClass('font-mono', 'tabular-nums', 'tracking-tight');
      expect(input).not.toHaveClass('h-10');
    });

    it('AC-10: renders align="right" with text-right', () => {
      render(<NumberInput align="right" data-testid="num-right" />);
      const input = screen.getByTestId('num-right');
      expect(input).toHaveClass('text-right');
    });

    it('AC-11: allows overriding type to "number" with numeric step/min/max attributes', () => {
      render(<NumberInput type="number" step="0.1" min="0" max="100" data-testid="num-typed" />);
      const input = screen.getByTestId('num-typed');
      expect(input).toHaveAttribute('type', 'number');
      expect(input).toHaveAttribute('step', '0.1');
    });

    it('AC-12: renders addonRight trailing unit text', () => {
      render(<NumberInput addonRight="°C" data-testid="num-addon" />);
      const addon = screen.getByText('°C');
      expect(addon).toBeInTheDocument();
      expect(addon).toHaveClass('text-xs', 'text-slate-400');
      const input = screen.getByTestId('num-addon');
      expect(input).toHaveClass('pr-10');
    });
  });

  describe('M30_P3 AC-13, AC-14, AC-15: CalculatorCard refactoring onto tokens', () => {
    it('AC-13: NumericField and SelectField render within <FormField>', () => {
      const onNumChange = vi.fn();
      const onSelectChange = vi.fn();
      const options = [
        { value: 'sg', label: 'Specific Gravity' },
        { value: 'plato', label: 'Plato' },
      ];

      render(
        <div>
          <NumericField label="Mash Temperature (°C)" value="67" onChange={onNumChange} />
          <SelectField label="Gravity Unit" value="sg" options={options} onChange={onSelectChange} />
        </div>,
      );

      expect(screen.getByText('Mash Temperature (°C)')).toBeInTheDocument();
      const input = screen.getByRole('textbox');
      expect(input).toHaveValue('67');
      expect(input).toHaveClass('rounded-lg', 'h-10', 'font-mono', 'tabular-nums', 'tracking-tight');

      fireEvent.change(input, { target: { value: '68' } });
      expect(onNumChange).toHaveBeenCalledWith('68');

      expect(screen.getByText('Gravity Unit')).toBeInTheDocument();
      const select = screen.getByRole('combobox');
      expect(select).toHaveValue('sg');
      expect(select).toHaveClass('rounded-lg', 'h-10');

      fireEvent.change(select, { target: { value: 'plato' } });
      expect(onSelectChange).toHaveBeenCalledWith('plato');
    });

    it('AC-14: CalculatorCard section uses CARD_CLASS token', () => {
      render(
        <CalculatorCard title="Strike Water Calculator">
          <div>Content</div>
        </CalculatorCard>,
      );
      const section = screen.getByText('Strike Water Calculator').closest('section');
      expect(section).toBeInTheDocument();
      expect(section?.className).toBe(CARD_CLASS);
    });

    it('AC-15: ResultRow uses SUBPANEL_CLASS and MONO_VALUE_CLASS', () => {
      render(<ResultRow label="Estimated Pre-Boil Gravity" value="1.048" />);
      expect(screen.getByText('Estimated Pre-Boil Gravity')).toBeInTheDocument();
      const valueEl = screen.getByText('1.048');
      expect(valueEl).toHaveClass('font-mono', 'tabular-nums', 'tracking-tight', 'text-amber-400');
      const container = valueEl.closest('div');
      expect(container).toHaveClass('flex', 'items-center', 'justify-between');
      expect(container?.className).toContain(SUBPANEL_CLASS);
      expect(valueEl.className).toContain(MONO_VALUE_CLASS);
    });
  });

  describe('M30_P4 AC-1 to AC-5: Calculators.tsx Category Buttons', () => {
    it('AC-1 & AC-2: renders 5 category pills using <Button> with type="button"', () => {
      render(
        <ConfigProvider>
          <Calculators />
        </ConfigProvider>,
      );
      const group = screen.getByRole('group', { name: 'Calculator Categories' });
      const buttons = within(group).getAllByRole('button');
      expect(buttons).toHaveLength(5);
      expect(buttons.map((b) => b.textContent)).toEqual([
        'All',
        'Water & Mash',
        'Gravity & Refractometry',
        'Yeast & Pitching',
        'Hops & Carbonation',
      ]);
      for (const btn of buttons) {
        expect(btn).toHaveAttribute('type', 'button');
      }
    });

    it('AC-3 & AC-4: group retains role="group", aria-label, and aria-pressed attributes', () => {
      render(
        <ConfigProvider>
          <Calculators />
        </ConfigProvider>,
      );
      const group = screen.getByRole('group', { name: 'Calculator Categories' });
      expect(group).toBeInTheDocument();
      expect(within(group).getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
      expect(within(group).getByRole('button', { name: 'Water & Mash' })).toHaveAttribute('aria-pressed', 'false');
    });

    it('AC-5: clicking category buttons filters visible calculator cards', () => {
      render(
        <ConfigProvider>
          <Calculators />
        </ConfigProvider>,
      );
      const group = screen.getByRole('group', { name: 'Calculator Categories' });
      fireEvent.click(within(group).getByRole('button', { name: 'Water & Mash' }));
      expect(screen.getByRole('heading', { level: 3, name: 'Water & Mash' })).toBeInTheDocument();
      expect(screen.queryByRole('heading', { level: 3, name: 'Gravity & Refractometry' })).toBeNull();
      expect(within(group).getByRole('button', { name: 'Water & Mash' })).toHaveAttribute('aria-pressed', 'true');
      expect(within(group).getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'false');
    });
  });

  describe('M30_P4 AC-6 to AC-9: Static Adoption Sweeps', () => {
    const CALCULATORS_DIR = path.resolve(__dirname, '../src/components/calculators');
    const CALCULATORS_PAGE = path.resolve(__dirname, '../src/pages/Calculators.tsx');
    const calculatorCardFiles = [
      'StrikeWaterCalculator.tsx',
      'InfusionVolumeCalculator.tsx',
      'HydrometerCalculator.tsx',
      'RefractometerCalculator.tsx',
      'GravityCorrectionCalculator.tsx',
      'PitchRateCalculator.tsx',
      'StarterGrowthCalculator.tsx',
      'HopDecayCalculator.tsx',
      'CarbonationCalculator.tsx',
      'UnitConverterCalculator.tsx',
    ];

    it('AC-6: zero raw <input type="text/number"> elements in components/calculators/', () => {
      for (const file of calculatorCardFiles) {
        const content = fs.readFileSync(path.join(CALCULATORS_DIR, file), 'utf-8');
        const cleanContent = content.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
        const inputs = cleanContent.match(/<input\b[^>]*>/g) || [];
        if (file === 'StrikeWaterCalculator.tsx') {
          for (const inp of inputs) {
            expect(inp).toMatch(/type=["']checkbox["']/);
          }
        } else {
          expect(inputs).toEqual([]);
        }
      }
    });

    it('AC-7: zero raw <select> elements in components/calculators/', () => {
      for (const file of calculatorCardFiles) {
        const content = fs.readFileSync(path.join(CALCULATORS_DIR, file), 'utf-8');
        const cleanContent = content.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
        const selects = cleanContent.match(/<select\b[^>]*>/g) || [];
        expect(selects).toEqual([]);
      }
    });

    it('AC-8: zero raw <button> elements in pages/Calculators.tsx', () => {
      const content = fs.readFileSync(CALCULATORS_PAGE, 'utf-8');
      const cleanContent = content.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
      const buttons = cleanContent.match(/<button\b[^>]*>/g) || [];
      expect(buttons).toEqual([]);
    });


    it('AC-9: all 10 calculator cards import and render CalculatorCard', () => {
      for (const file of calculatorCardFiles) {
        const content = fs.readFileSync(path.join(CALCULATORS_DIR, file), 'utf-8');
        expect(content).toMatch(/import\s+{[^}]*CalculatorCard[^}]*}\s+from\s+['"]\.\/CalculatorCard['"]/);
        expect(content).toMatch(/<CalculatorCard\b/);
      }
    });
  });

  describe('M30_P4 AC-10 to AC-12: Focus, Height, and Typography Parity', () => {
    it('AC-10: NumberInput and Button compose canonical tokens (INPUT_CLASS and BUTTON_*_CLASS) per RA-3', () => {
      render(
        <div>
          <NumberInput data-testid="parity-input" />
          <Button data-testid="parity-button">Test</Button>
        </div>,
      );
      const input = screen.getByTestId('parity-input');
      const button = screen.getByTestId('parity-button');

      expect(input).toHaveClass('focus-visible:outline-2', 'focus-visible:outline-offset-2', 'focus-visible:outline-amber-500');
      expect(button).toHaveClass('bg-amber-600', 'hover:bg-amber-500', 'rounded-lg');
    });


    it('AC-11: Calculator inputs and selects both evaluate to universal h-10 and rounded-lg', () => {
      render(
        <div>
          <NumericField label="Num" value="10" onChange={() => {}} />
          <SelectField label="Sel" value="a" options={[{ value: 'a', label: 'A' }]} onChange={() => {}} />
        </div>,
      );
      const input = screen.getByRole('textbox');
      const select = screen.getByRole('combobox');
      expect(input).toHaveClass('h-10', 'rounded-lg');
      expect(select).toHaveClass('h-10', 'rounded-lg');
    });

    it('AC-12: Calculator inputs and result outputs both apply MONO_VALUE_CLASS', () => {
      render(
        <div>
          <NumericField label="Gravity" value="1.050" onChange={() => {}} />
          <ResultRow label="Output" value="1.045" />
        </div>,
      );
      const input = screen.getByRole('textbox');
      const output = screen.getByText('1.045');
      expect(input).toHaveClass('font-mono', 'tabular-nums', 'tracking-tight');
      expect(output).toHaveClass('font-mono', 'tabular-nums', 'tracking-tight');
    });
  });

  describe('M31_P1: FormField useId Automatic Wiring & Static Sweep', () => {
    it('AC-1: FormField automatically injects useId generated ID into child element and label htmlFor', () => {
      render(
        <FormField label="Batch Size">
          <Input data-testid="auto-id-input" />
        </FormField>,
      );
      const input = screen.getByTestId('auto-id-input');
      const label = screen.getByText('Batch Size').closest('label');

      expect(input.id).toBeTruthy();
      expect(label).toHaveAttribute('for', input.id);
      expect(screen.getByLabelText('Batch Size')).toBe(input);
    });

    it('AC-2: FormField respects explicit htmlFor or id without overriding child explicit ID', () => {
      render(
        <FormField label="Profile Name" htmlFor="custom-profile-id">
          <Input data-testid="explicit-id-input" />
        </FormField>,
      );
      const input = screen.getByTestId('explicit-id-input');
      const label = screen.getByText('Profile Name').closest('label');

      expect(input.id).toBe('custom-profile-id');
      expect(label).toHaveAttribute('for', 'custom-profile-id');
      expect(screen.getByLabelText('Profile Name')).toBe(input);
    });

    it('AC-21: Zero bare <label className="..."> in EquipmentForm.tsx and FermentationProfileForm.tsx', () => {
      const COMPONENTS_DIR = path.resolve(__dirname, '../src/components');
      const files = ['EquipmentForm.tsx', 'FermentationProfileForm.tsx'];

      for (const file of files) {
        const content = fs.readFileSync(path.join(COMPONENTS_DIR, file), 'utf-8');
        const cleanContent = content.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
        // Match <label ...> tags that are not FormField (ignoring checkbox wrapper label in EquipmentForm)
        const rawLabels = cleanContent.match(/<label\b[^>]*>/g) || [];
        // Only checkbox wrapper in EquipmentForm is allowed as raw label
        if (file === 'EquipmentForm.tsx') {
          for (const l of rawLabels) {
            expect(l).toContain('cursor-pointer');
          }
        } else {
          expect(rawLabels).toEqual([]);
        }
      }
    });

    it('M31_P2 AC-25: Zero bare <label className="..."> in MashProfileForm.tsx and WaterProfileForm.tsx', () => {
      const COMPONENTS_DIR = path.resolve(__dirname, '../src/components');
      const files = ['MashProfileForm.tsx', 'WaterProfileForm.tsx'];

      for (const file of files) {
        const content = fs.readFileSync(path.join(COMPONENTS_DIR, file), 'utf-8');
        const cleanContent = content.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
        const rawLabels = cleanContent.match(/<label\b[^>]*>/g) || [];
        expect(rawLabels).toEqual([]);
      }
    });

    it('M31_P3 AC-26: Zero bare <label className="..."> in InventoryForm.tsx', () => {
      const COMPONENTS_DIR = path.resolve(__dirname, '../src/components');
      const content = fs.readFileSync(path.join(COMPONENTS_DIR, 'InventoryForm.tsx'), 'utf-8');
      const cleanContent = content.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
      const rawLabels = cleanContent.match(/<label\b[^>]*>/g) || [];
      expect(rawLabels).toEqual([]);
    });
  });

  describe('M32_P1 AC-1 to AC-7: NumberInput width axis', () => {
    it('AC-1: NumberInputWidth is importable from NumberInput and from components/ui, and a raw class fails typecheck', () => {
      const fromIndex: UiNumberInputWidth = 'xs';
      const fromModule: DirectNumberInputWidth = 'xs';
      expect(fromIndex).toBe('xs');
      expect(fromModule).toBe('xs');
      // @ts-expect-error — a raw Tailwind class is not a member of the closed NumberInputWidth union.
      const invalid: UiNumberInputWidth = 'w-16';
      expect(invalid).toBe('w-16');
    });

    it('AC-2: default width renders w-full and no other width class', () => {
      render(<NumberInput data-testid="w-def" />);
      const el = screen.getByTestId('w-def');
      expect(el).toHaveClass('w-full');
      expect(el).not.toHaveClass('w-12');
      expect(el).not.toHaveClass('w-14');
      expect(el).not.toHaveClass('w-16');
      expect(el).not.toHaveClass('w-20');
      expect(el).not.toHaveClass('w-24');
      expect(el).not.toHaveClass('w-40');
    });

    it('AC-3: width omitted is backward-compatible with existing AC-8 class assertions', () => {
      render(<NumberInput data-testid="w-compat" />);
      const el = screen.getByTestId('w-compat');
      expect(el).toHaveClass(
        'w-full',
        'bg-slate-800',
        'border-slate-700',
        'rounded-lg',
        'h-10',
        'font-mono',
        'tabular-nums',
        'tracking-tight',
      );
      expect(el).toHaveAttribute('type', 'text');
      expect(el).toHaveAttribute('inputmode', 'decimal');
    });

    it.each([
      ['full', 'w-full'],
      ['xs', 'w-12'],
      ['sm', 'w-14'],
      ['md', 'w-16'],
      ['lg', 'w-20'],
      ['xl', 'w-24'],
      ['2xl', 'w-40'],
    ] as const)('AC-4: width="%s" maps to class "%s"', (width, cls) => {
      render(<NumberInput width={width} data-testid={`w-${width}`} />);
      expect(screen.getByTestId(`w-${width}`)).toHaveClass(cls);
    });

    it.each([
      ['xs', 'w-12'],
      ['sm', 'w-14'],
      ['md', 'w-16'],
      ['lg', 'w-20'],
      ['xl', 'w-24'],
      ['2xl', 'w-40'],
    ] as const)('AC-5: width="%s" never also emits w-full', (width, _cls) => {
      render(<NumberInput width={width} data-testid={`excl-${width}`} />);
      expect(screen.getByTestId(`excl-${width}`)).not.toHaveClass('w-full');
    });

    it('AC-6: width composes with size/align/addonRight', () => {
      render(<NumberInput size="sm" align="right" width="xs" addonRight="d" data-testid="w-compose" />);
      const el = screen.getByTestId('w-compose');
      expect(el).toHaveClass('w-12', 'text-right', 'pr-10', 'px-2.5', 'py-1', 'text-xs', 'font-mono', 'tabular-nums', 'tracking-tight');
      expect(el).not.toHaveClass('h-10');
      expect(el).not.toHaveClass('w-full');
    });

    it('AC-7: className still wins last, appended after width', () => {
      render(<NumberInput width="md" className="zz-sentinel" data-testid="w-classname" />);
      const el = screen.getByTestId('w-classname');
      expect(el).toHaveClass('w-16', 'zz-sentinel');
      const classList = el.className.split(' ');
      expect(classList[classList.length - 1]).toBe('zz-sentinel');
    });
  });

  describe('M32_P4: Milestone 32 Closing Adoption & Consistency (AC-19..AC-22)', () => {
    const COMPONENTS_DIR = path.resolve(__dirname, '../src/components');
    const APP_SRC_PATH = path.resolve(__dirname, '../src/App.tsx');

    it('AC-19: Zero raw <input type="number"> in all 5 recipe designer section files', () => {
      const sectionFiles = [
        'HopSection.tsx',
        'FermentableSection.tsx',
        'MiscSection.tsx',
        'YeastSection.tsx',
        'MashSection.tsx',
      ];
      for (const file of sectionFiles) {
        const content = fs.readFileSync(path.join(COMPONENTS_DIR, file), 'utf-8');
        const cleanContent = content.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
        const rawNumberInputs = cleanContent.match(/<input\b[^>]*type=["']number["']/g) || [];
        expect(rawNumberInputs, `Expected 0 raw number inputs in ${file}`).toEqual([]);
      }
    });

    it('AC-20: Zero raw <input type="number"> in App.tsx', () => {
      const content = fs.readFileSync(APP_SRC_PATH, 'utf-8');
      const cleanContent = content.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
      const rawNumberInputs = cleanContent.match(/<input\b[^>]*type=["']number["']/g) || [];
      expect(rawNumberInputs).toEqual([]);
    });

    it('AC-21: Typography Parity — NumberInput and readbacks share MONO_VALUE_CLASS (font-mono tabular-nums tracking-tight)', () => {
      render(<NumberInput data-testid="test-mono-parity" />);
      const input = screen.getByTestId('test-mono-parity');
      expect(input).toHaveClass('font-mono', 'tabular-nums', 'tracking-tight');
      expect(MONO_VALUE_CLASS).toBe('font-mono tabular-nums tracking-tight');
    });

    it('AC-22: Dimension & Geometry Parity across control sizes', () => {
      render(
        <div>
          <NumberInput data-testid="num-std" />
          <NumberInput size="sm" data-testid="num-compact" />
        </div>,
      );
      const std = screen.getByTestId('num-std');
      const compact = screen.getByTestId('num-compact');

      expect(std).toHaveClass('h-10', 'rounded-lg');
      expect(compact).toHaveClass('px-2.5', 'py-1', 'text-xs', 'rounded');
      expect(compact).not.toHaveClass('h-10');
    });
  });

  describe('M33_P1: Button layout, gap-1.5, and StockCheckPanel adoption (AC-2..AC-4, AC-9, AC-10)', () => {
    const COMPONENTS_DIR = path.resolve(__dirname, '../src/components');

    it('AC-2: Button applies inline-flex items-center justify-center gap-1.5 for non-icon variants', () => {
      render(<Button data-testid="btn-layout">Action</Button>);
      const btn = screen.getByTestId('btn-layout');
      expect(btn).toHaveClass('inline-flex', 'items-center', 'justify-center', 'gap-1.5');
    });

    it('AC-3 & AC-10: Button size="sm" applies text-xs px-3 py-1.5', () => {
      render(
        <div>
          <Button size="sm" variant="primary" data-testid="btn-sm-pri">Primary</Button>
          <Button size="sm" variant="secondary" data-testid="btn-sm-sec">Secondary</Button>
        </div>,
      );
      const pri = screen.getByTestId('btn-sm-pri');
      const sec = screen.getByTestId('btn-sm-sec');

      expect(pri).toHaveClass('text-xs', 'px-3', 'py-1.5');
      expect(sec).toHaveClass('text-xs', 'px-3', 'py-1.5');
    });

    it('AC-4: Button variant="icon" does not apply gap-1.5 or text padding', () => {
      render(<Button variant="icon" aria-label="Settings" data-testid="btn-icon-test">⚙</Button>);
      const btn = screen.getByTestId('btn-icon-test');
      expect(btn).toHaveClass('inline-flex', 'items-center', 'justify-center', 'p-2', 'rounded-lg');
      expect(btn).not.toHaveClass('gap-1.5');
      expect(btn).not.toHaveClass('px-3');
    });

    it('AC-9: Zero raw <button> elements in StockCheckPanel.tsx', () => {
      const content = fs.readFileSync(path.join(COMPONENTS_DIR, 'StockCheckPanel.tsx'), 'utf-8');
      const cleanContent = content.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
      const rawButtons = cleanContent.match(/<button\b/g) || [];
      expect(rawButtons).toEqual([]);
    });
  });

  describe('M33_P2: ReadingLog button primitive adoption (AC-10)', () => {
    const COMPONENTS_DIR = path.resolve(__dirname, '../src/components');

    it('AC-10: Zero raw <button> elements in ReadingLog.tsx', () => {
      const content = fs.readFileSync(path.join(COMPONENTS_DIR, 'ReadingLog.tsx'), 'utf-8');
      const cleanContent = content.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
      const rawButtons = cleanContent.match(/<button\b/g) || [];
      expect(rawButtons).toEqual([]);
    });
  });

  describe('M33_P4: BrewDayTracker button primitive adoption (AC-10)', () => {
    const COMPONENTS_DIR = path.resolve(__dirname, '../src/components');

    it('AC-10: All standard action and chrome buttons in BrewDayTracker.tsx use <Button>', () => {
      const content = fs.readFileSync(path.join(COMPONENTS_DIR, 'BrewDayTracker.tsx'), 'utf-8');
      const cleanContent = content.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
      // Match raw buttons, filtering out specialized list items (checklist, mash steps, boil additions per RA-3)
      const rawButtons = (cleanContent.match(/<button\b[^>]*>/g) || []).filter(
        (b) =>
          !b.includes('checklist-item-') &&
          !b.includes('mash-step-') &&
          !b.includes('brew-day-boil-alarm-'),
      );
      expect(rawButtons).toEqual([]);
    });
  });

  describe('M33_P5: BatchDetail button primitive adoption & Milestone 33 Closing Sweep (AC-11, AC-12, AC-13)', () => {
    const COMPONENTS_DIR = path.resolve(__dirname, '../src/components');
    const PAGES_DIR = path.resolve(__dirname, '../src/pages');

    it('AC-11: All action buttons in BatchDetail.tsx use <Button>', () => {
      const content = fs.readFileSync(path.join(PAGES_DIR, 'BatchDetail.tsx'), 'utf-8');
      const cleanContent = content.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
      // Match raw buttons, filtering out the identity header clickable card trigger (RA-3)
      const rawButtons = (cleanContent.match(/<button\b[^>]*>/g) || []).filter(
        (b) => !b.includes('batch-identity-edit-trigger'),
      );
      expect(rawButtons).toEqual([]);
    });

    it('AC-12: Milestone 33 Adoption Sweep — zero raw action buttons across all batch surfaces', () => {
      const files = [
        path.join(COMPONENTS_DIR, 'StockCheckPanel.tsx'),
        path.join(COMPONENTS_DIR, 'ReadingLog.tsx'),
        path.join(COMPONENTS_DIR, 'BatchNoteLog.tsx'),
      ];
      for (const file of files) {
        const content = fs.readFileSync(file, 'utf-8');
        const cleanContent = content.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
        const rawButtons = cleanContent.match(/<button\b/g) || [];
        expect(rawButtons).toEqual([]);
      }
    });

    it('AC-13: Small buttons evaluate to compact text-xs px-3 py-1.5 styling', () => {
      render(
        <div>
          <Button size="sm" variant="primary" data-testid="test-btn-pri">Primary</Button>
          <Button size="sm" variant="secondary" data-testid="test-btn-sec">Secondary</Button>
          <Button size="sm" variant="danger" data-testid="test-btn-dan">Danger</Button>
        </div>,
      );
      expect(screen.getByTestId('test-btn-pri')).toHaveClass('text-xs', 'px-3', 'py-1.5');
      expect(screen.getByTestId('test-btn-sec')).toHaveClass('text-xs', 'px-3', 'py-1.5');
      expect(screen.getByTestId('test-btn-dan')).toHaveClass('text-xs', 'px-3', 'py-1.5');
    });
  });

  describe('M34_P1: Dialog Content Migration (AC-11)', () => {
    const COMPONENTS_DIR = path.resolve(__dirname, '../src/components');

    it('AC-11: zero raw <button> and zero raw <input> elements in ConfirmDialog.tsx', () => {
      const content = fs.readFileSync(path.join(COMPONENTS_DIR, 'ConfirmDialog.tsx'), 'utf-8');
      const cleanContent = content.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
      const rawButtons = cleanContent.match(/<button\b/g) || [];
      const rawInputs = cleanContent.match(/<input\b/g) || [];
      expect(rawButtons).toEqual([]);
      expect(rawInputs).toEqual([]);
    });

    it('AC-11: zero raw <button> and zero raw <input> elements in PresetPickerModal.tsx', () => {
      const content = fs.readFileSync(path.join(COMPONENTS_DIR, 'PresetPickerModal.tsx'), 'utf-8');
      const cleanContent = content.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
      const rawButtons = cleanContent.match(/<button\b/g) || [];
      const rawInputs = cleanContent.match(/<input\b/g) || [];
      expect(rawButtons).toEqual([]);
      expect(rawInputs).toEqual([]);
      expect(content).not.toMatch(/INPUT_CLASS/);
    });

    it('AC-11: zero raw <button> and zero raw <input> elements in RefractometerFermentationModal.tsx', () => {
      const content = fs.readFileSync(path.join(COMPONENTS_DIR, 'RefractometerFermentationModal.tsx'), 'utf-8');
      const cleanContent = content.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
      const rawButtons = cleanContent.match(/<button\b/g) || [];
      const rawInputs = cleanContent.match(/<input\b/g) || [];
      expect(rawButtons).toEqual([]);
      expect(rawInputs).toEqual([]);
      expect(content).not.toMatch(/BUTTON_PRIMARY_CLASS/);
      expect(content).not.toMatch(/BUTTON_SECONDARY_CLASS/);
      expect(content).not.toMatch(/INPUT_CLASS/);
    });
  });

  describe('M34_P2: Import & Calibration Dialog Content Migration (AC-16)', () => {
    const COMPONENTS_DIR = path.resolve(__dirname, '../src/components');
    const SRC_DIR = path.resolve(__dirname, '../src');

    // RA-4: native checkbox/radio inputs are explicitly exempt — ui/ does not
    // abstract them. The sweep targets raw <button>, raw <select>, and raw
    // text/number <input> (excluding type="checkbox"/"radio").
    function rawControls(content: string): { buttons: string[]; selects: string[]; inputs: string[] } {
      const cleanContent = content.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
      const buttons = cleanContent.match(/<button\b/g) || [];
      const selects = cleanContent.match(/<select\b/g) || [];
      const inputs = (cleanContent.match(/<input\b[^>]*>/g) || []).filter(
        (el) => !/type="checkbox"|type='checkbox'|type="radio"|type='radio'/.test(el),
      );
      return { buttons, selects, inputs };
    }

    it('AC-16: zero raw buttons/selects/text-inputs in RecipeImportModal.tsx (checkbox/radio exempt)', () => {
      const content = fs.readFileSync(path.join(COMPONENTS_DIR, 'RecipeImportModal.tsx'), 'utf-8');
      const { buttons, selects, inputs } = rawControls(content);
      expect(buttons).toEqual([]);
      expect(selects).toEqual([]);
      expect(inputs).toEqual([]);
      expect(content).not.toMatch(/BUTTON_PRIMARY_CLASS/);
      expect(content).not.toMatch(/BUTTON_SECONDARY_CLASS/);
      expect(content).not.toMatch(/FORM_SELECT_COMPACT_CLASS/);
    });

    it('AC-16: zero raw buttons in PostBrewCalibrationModal.tsx', () => {
      const content = fs.readFileSync(path.join(COMPONENTS_DIR, 'PostBrewCalibrationModal.tsx'), 'utf-8');
      const { buttons, selects, inputs } = rawControls(content);
      expect(buttons).toEqual([]);
      expect(selects).toEqual([]);
      expect(inputs).toEqual([]);
      expect(content).not.toMatch(/BUTTON_PRIMARY_CLASS/);
      expect(content).not.toMatch(/BUTTON_SECONDARY_CLASS/);
    });

    it('AC-16: zero raw buttons in BatchRecipeAdjustModal.tsx (sync checkbox exempt)', () => {
      const content = fs.readFileSync(path.join(COMPONENTS_DIR, 'BatchRecipeAdjustModal.tsx'), 'utf-8');
      const { buttons, selects, inputs } = rawControls(content);
      expect(buttons).toEqual([]);
      expect(selects).toEqual([]);
      expect(inputs).toEqual([]);
      expect(content).not.toMatch(/BUTTON_PRIMARY_CLASS/);
      expect(content).not.toMatch(/BUTTON_SECONDARY_CLASS/);
    });

    it('AC-16: App.tsx scale modal renders through Button/NumberInput (raw buttons outside the modal remain, per RA-5)', () => {
      const content = fs.readFileSync(path.join(SRC_DIR, 'App.tsx'), 'utf-8');
      // RA-5: scope is the scale modal only — assert the modal's controls use
      // the primitives rather than a whole-file raw-button sweep. Whitespace
      // (incl. CRLF) between the label and </Button> is allowed.
      expect(content).toMatch(/<Button\s+variant="secondary"\s+size="sm"[\s\S]*?>[\s\S]*?Cancel[\s\S]*?<\/Button>/);
      expect(content).toMatch(/<Button\s+variant="primary"\s+size="sm"[\s\S]*?>[\s\S]*?Scale Recipe[\s\S]*?<\/Button>/);
      expect(content).toMatch(/addonRight="Liters"/);
    });
  });

  describe('M34_P3: WaterCalculatorModal Content Migration (AC-18)', () => {
    const COMPONENTS_DIR = path.resolve(__dirname, '../src/components');

    // RA-4: native checkbox inputs are explicitly exempt — ui/ does not
    // abstract them. The sweep targets raw <button>, raw <select>, and raw
    // text/number <input> (excluding type="checkbox"/"radio").
    function rawControlsP3(content: string): { buttons: string[]; selects: string[]; inputs: string[] } {
      const cleanContent = content.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
      const buttons = cleanContent.match(/<button\b/g) || [];
      const selects = cleanContent.match(/<select\b/g) || [];
      const inputs = (cleanContent.match(/<input\b[^>]*>/g) || []).filter(
        (el) => !/type="checkbox"|type='checkbox'|type="radio"|type='radio'/.test(el),
      );
      return { buttons, selects, inputs };
    }

    it('AC-18: zero raw buttons/selects/text-inputs in WaterCalculatorModal.tsx (3 checkboxes exempt)', () => {
      const content = fs.readFileSync(path.join(COMPONENTS_DIR, 'WaterCalculatorModal.tsx'), 'utf-8');
      const { buttons, selects, inputs } = rawControlsP3(content);
      expect(buttons).toEqual([]);
      expect(selects).toEqual([]);
      expect(inputs).toEqual([]);
      expect(content).not.toMatch(/BUTTON_PRIMARY_CLASS/);
      expect(content).not.toMatch(/BUTTON_SECONDARY_CLASS/);
      expect(content).not.toMatch(/INPUT_CLASS/);
      expect(content).not.toMatch(/FORM_SELECT_CLASS/);
    });

    it('AC-18: WaterCalculatorModal renders NumberInput with addonRight unit suffixes and disabled gating preserved', () => {
      const content = fs.readFileSync(path.join(COMPONENTS_DIR, 'WaterCalculatorModal.tsx'), 'utf-8');
      expect(content).toMatch(/<NumberInput[\s\S]*?addonRight="g"/);
      expect(content).toMatch(/<NumberInput[\s\S]*?addonRight=\{acidType === 'Acidulated Malt' \? 'g' : 'ml'\}/);
      expect(content).toMatch(/<NumberInput[\s\S]*?disabled=\{!treatSpargeWater\}/);
      expect(content).toMatch(/<NumberInput[\s\S]*?disabled=\{!addMashAcid\}/);
      expect(content).toMatch(/<NumberInput[\s\S]*?disabled=\{!addSpargeAcid\}/);
    });
  });

  describe('M37_P2 Amendment 1: WaterCalculatorModal static sweeps (AC-22, AC-24)', () => {
    const COMPONENTS_DIR = path.resolve(__dirname, '../src/components');
    const content = fs.readFileSync(path.join(COMPONENTS_DIR, 'WaterCalculatorModal.tsx'), 'utf-8');

    it('AC-22: 0 raw pseudo-badge spans (any accent) and 0 raw ion-tile class literal in the modal', () => {
      expect(content).not.toMatch(/px-2 py-0\.5 rounded bg-/);
      expect(content).not.toContain('p-2 rounded-lg bg-slate-950/50 border border-slate-800/70');
    });

    it('AC-24 [AMENDED]: 0 local weights definitions and 0 strategy symbols — delegates to calculateProfileFitScore/optimizeWaterProfile from @truchabrew/calculations', () => {
      expect(content).not.toMatch(/\bconst DEFAULT_ION_WEIGHTS\b/);
      expect(content).not.toMatch(/\binterface IonWeights\b/);
      expect(content).not.toMatch(/\bSTRATEGY_WEIGHTS\b/);
      expect(content).not.toMatch(/\bBALANCE_STRATEGIES\b/);
      expect(content).not.toMatch(/\bbalanceStrategy\b/);
      expect(content).not.toMatch(/Object\.values\(DEFAULT_ION_WEIGHTS\)/);
      expect(content).toMatch(/import\s*\{[^}]*\bcalculateProfileFitScore\b[^}]*\}\s*from\s*['"]@truchabrew\/calculations['"]/);
      expect(content).toMatch(/import\s*\{[^}]*\boptimizeWaterProfile\b[^}]*\}\s*from\s*['"]@truchabrew\/calculations['"]/);
    });

    it('AC-15/AC-36: 0 <Badge ... className=> occurrences in the modal (no per-call-site override of the primitive)', () => {
      expect(content).not.toMatch(/<Badge\b[^>]*className=/);
    });

    it('AC-36: the modal consumes the Badge xs size (>= 1 call site)', () => {
      expect(content).toMatch(/<Badge[^>]*size="xs"/);
    });
  });

  describe('M34_P4: The Four Heaviest Panels Content Migration (AC-19, AC-11, AC-20)', () => {
    const COMPONENTS_DIR = path.resolve(__dirname, '../src/components');

    // RA-4: native checkbox/radio/range/file inputs are explicitly exempt —
    // ui/ does not abstract them. The sweep targets raw <button>, raw
    // <select>, and raw text/number <input> (excluding type="checkbox"/
    // "radio"/"range"/"file").
    function rawControlsP4(content: string): { buttons: string[]; selects: string[]; inputs: string[] } {
      const cleanContent = content.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
      const buttons = cleanContent.match(/<button\b/g) || [];
      const selects = cleanContent.match(/<select\b/g) || [];
      const inputs = (cleanContent.match(/<input\b[^>]*>/g) || []).filter(
        (el) => !/type="checkbox"|type='checkbox'|type="radio"|type='radio'|type="range"|type='range'|type="file"|type='file'/.test(el),
      );
      return { buttons, selects, inputs };
    }

    it('AC-19: zero raw buttons/selects/text-inputs in RecipeLibrary.tsx (file input exempt, RA-4)', () => {
      const content = fs.readFileSync(path.join(COMPONENTS_DIR, 'RecipeLibrary.tsx'), 'utf-8');
      const { buttons, selects, inputs } = rawControlsP4(content);
      expect(buttons).toEqual([]);
      expect(selects).toEqual([]);
      expect(inputs).toEqual([]);
      expect(content).toMatch(/from '\.\/ui'/);
    });

    it('AC-19: zero raw buttons/selects/text-inputs in InventoryManager.tsx (out-of-stock is a Button pill, FEAT-029)', () => {
      const content = fs.readFileSync(path.join(COMPONENTS_DIR, 'InventoryManager.tsx'), 'utf-8');
      const { buttons, selects, inputs } = rawControlsP4(content);
      expect(buttons).toEqual([]);
      expect(selects).toEqual([]);
      expect(inputs).toEqual([]);
      expect(content).not.toMatch(/FORM_SELECT_CLASS/);
      expect(content).not.toMatch(/INPUT_CLASS/);
      expect(content).not.toContain('!pl-9');
      // FEAT-029 (amended): the out-of-stock filter is a Button-composed pill
      // inside the category strip — no native checkbox, no htmlFor label.
      expect(content).not.toMatch(/type="checkbox"/);
      expect(content).not.toMatch(/inventory-filter-out-of-stock"[\s\S]*?<input/);
      expect(content).toMatch(/aria-pressed=\{outOfStockOnly\}/);
      expect(content).toMatch(/data-testid="inventory-filter-out-of-stock"/);
    });

    it('AC-11: zero raw buttons/selects/text-inputs in SensoryEvaluationPanel.tsx (range sliders exempt, RA-4; textarea exempt, RA-5)', () => {
      const content = fs.readFileSync(path.join(COMPONENTS_DIR, 'SensoryEvaluationPanel.tsx'), 'utf-8');
      const { buttons, selects, inputs } = rawControlsP4(content);
      expect(buttons).toEqual([]);
      expect(selects).toEqual([]);
      expect(inputs).toEqual([]);
      // RA-5: the textarea stays raw with INPUT_CLASS; BUTTON_PRIMARY_CLASS is removed.
      expect(content).not.toMatch(/BUTTON_PRIMARY_CLASS/);
      expect(content).toMatch(/INPUT_CLASS/);
      expect(content).toMatch(/<textarea/);
    });

    it('AC-19: zero raw buttons/selects/text-inputs in SplitPackagingPanel.tsx', () => {
      const content = fs.readFileSync(path.join(COMPONENTS_DIR, 'SplitPackagingPanel.tsx'), 'utf-8');
      const { buttons, selects, inputs } = rawControlsP4(content);
      expect(buttons).toEqual([]);
      expect(selects).toEqual([]);
      expect(inputs).toEqual([]);
      expect(content).not.toMatch(/FORM_SELECT_CLASS/);
      expect(content).not.toMatch(/INPUT_CLASS/);
    });

    it('AC-20: SensoryEvaluationPanel and SplitPackagingPanel adoption assertions (RA-5/AC-13 conversion)', () => {
      const sensory = fs.readFileSync(path.join(COMPONENTS_DIR, 'SensoryEvaluationPanel.tsx'), 'utf-8');
      expect(sensory).toMatch(/import\s*\{[^}]*\bButton\b[^}]*\}\s*from\s*'\.\/ui'/);
      expect(sensory).toMatch(/<Button\s+variant="primary"\s+size="sm"[\s\S]*?data-testid="save-sensory-evaluation-btn"/);

      const split = fs.readFileSync(path.join(COMPONENTS_DIR, 'SplitPackagingPanel.tsx'), 'utf-8');
      expect(split).toMatch(/import\s*\{[^}]*\bButton\b[^}]*\bSelect\b[^}]*\bNumberInput\b[^}]*\}\s*from\s*'\.\/ui'/);
      expect(split).toMatch(/<Button\s+variant="secondary"\s+size="sm"[\s\S]*?data-testid="add-package-btn"/);
      expect(split).toMatch(/<Button\s+variant="icon"[\s\S]*?data-testid=\{`remove-package-btn-\$\{index\}`\}/);
      expect(split).toMatch(/<Select\s+size="sm"[\s\S]*?id=\{`pkg-type-\$\{res\.id\}`\}/);
      expect(split).toMatch(/<NumberInput\s+size="sm"/);
    });

    it('AC-19: zero raw <button>/<select>/text-inputs in components/calculators/ (StrikeWater checkbox exempt, RA-4)', () => {
      const calculatorFiles = [
        'StrikeWaterCalculator.tsx',
        'InfusionVolumeCalculator.tsx',
        'HydrometerCalculator.tsx',
        'RefractometerCalculator.tsx',
        'GravityCorrectionCalculator.tsx',
        'PitchRateCalculator.tsx',
        'StarterGrowthCalculator.tsx',
        'HopDecayCalculator.tsx',
        'CarbonationCalculator.tsx',
        'UnitConverterCalculator.tsx',
      ];
      for (const file of calculatorFiles) {
        const content = fs.readFileSync(path.join(COMPONENTS_DIR, 'calculators', file), 'utf-8');
        const { buttons, selects, inputs } = rawControlsP4(content);
        expect(buttons, `${file} has raw <button>`).toEqual([]);
        expect(selects, `${file} has raw <select>`).toEqual([]);
        expect(inputs, `${file} has raw text/number <input>`).toEqual([]);
      }
    });

    it('AC-12: CalculatorCard renders an accessible disclosure with description/formula (RA-6)', () => {
      render(
        <CalculatorCard title="Test Calc" description="One sentence." formula="A × B = C.">
          <div>Body</div>
        </CalculatorCard>,
      );
      const infoButton = screen.getByRole('button', { name: 'About Test Calc' });
      expect(infoButton).toHaveAttribute('aria-expanded', 'false');

      fireEvent.click(infoButton);
      expect(screen.getByText('One sentence.')).toBeInTheDocument();
      expect(screen.getByText(/Formula:/)).toBeInTheDocument();
      expect(infoButton).toHaveAttribute('aria-expanded', 'true');
    });
  });

  describe('M34_P5: Chrome, Remaining Managers, FEAT-030 Searchable Catalog Pickers, and Final Sweep', () => {
    const COMPONENTS_DIR = path.resolve(__dirname, '../src/components');
    const PAGES_DIR = path.resolve(__dirname, '../src/pages');

    function rawControlsP5(content: string) {
      const clean = content.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
      const buttons = (clean.match(/<button\b[^>]*>/g) || []).filter((b) => !b.includes('data-ignore-raw-button'));
      const selects = (clean.match(/<select\b[^>]*>/g) || []).filter((s) => !s.includes('data-ignore-raw-select'));
      const inputs = (clean.match(/<input\b[^>]*>/g) || []).filter((i) => {
        return !/type=["'](checkbox|radio|file|range)["']/.test(i);
      });
      return { buttons, selects, inputs };
    }

    it('AC-1 to AC-4 (FEAT-030): zero raw buttons, selects, or text/number inputs in Recipe Editor sections', () => {
      const recipeSections = [
        'FermentableSection.tsx',
        'HopSection.tsx',
        'YeastSection.tsx',
        'MiscSection.tsx',
      ];
      for (const file of recipeSections) {
        const content = fs.readFileSync(path.join(COMPONENTS_DIR, file), 'utf-8');
        const { buttons, selects, inputs } = rawControlsP5(content);
        expect(buttons, `${file} has raw <button>`).toEqual([]);
        expect(selects, `${file} has raw <select>`).toEqual([]);
        expect(inputs, `${file} has raw text/number <input>`).toEqual([]);
        expect(content, `${file} imports PresetPickerModal`).toMatch(/import\s*\{[^}]*PresetPickerModal[^}]*\}\s*from\s*['"]\.\/PresetPickerModal['"]/);
      }
    });

    it('AC-5 to AC-8: zero raw buttons, selects, or text/number inputs in the 4 profile managers', () => {
      const managers = [
        'EquipmentManager.tsx',
        'MashProfileManager.tsx',
        'FermentationProfileManager.tsx',
        'WaterProfileManager.tsx',
      ];
      for (const file of managers) {
        const content = fs.readFileSync(path.join(COMPONENTS_DIR, file), 'utf-8');
        const { buttons, selects, inputs } = rawControlsP5(content);
        expect(buttons, `${file} has raw <button>`).toEqual([]);
        expect(selects, `${file} has raw <select>`).toEqual([]);
        expect(inputs, `${file} has raw text/number <input>`).toEqual([]);
        expect(content, `${file} imports Button`).toMatch(/import\s*\{[^}]*Button[^}]*\}\s*from\s*['"]\.\/ui['"]/);
      }
    });

    it('AC-9 to AC-12: zero raw buttons, selects, or text/number inputs in SettingsManager, SaveBar, and TopBar', () => {
      const components = ['SettingsManager.tsx', 'SaveBar.tsx', 'TopBar.tsx'];
      for (const file of components) {
        const content = fs.readFileSync(path.join(COMPONENTS_DIR, file), 'utf-8');
        const { buttons, selects, inputs } = rawControlsP5(content);
        expect(buttons, `${file} has raw <button>`).toEqual([]);
        expect(selects, `${file} has raw <select>`).toEqual([]);
        expect(inputs, `${file} has raw text/number <input>`).toEqual([]);
      }
    });

    it('AC-13 & AC-14: zero raw buttons, selects, or text/number inputs in ReadingLog.tsx and BatchDetail.tsx (textareas exempt)', () => {
      const readingLog = fs.readFileSync(path.join(COMPONENTS_DIR, 'ReadingLog.tsx'), 'utf-8');
      const { buttons: rlB, selects: rlS, inputs: rlI } = rawControlsP5(readingLog);
      expect(rlB).toEqual([]);
      expect(rlS).toEqual([]);
      expect(rlI).toEqual([]);

      const batchDetail = fs.readFileSync(path.join(PAGES_DIR, 'BatchDetail.tsx'), 'utf-8');
      const { buttons: bdB, selects: bdS, inputs: bdI } = rawControlsP5(batchDetail);
      expect(bdB).toEqual([]);
      expect(bdS).toEqual([]);
      expect(bdI).toEqual([]);
    });

    it('AC-15: BODY_TEXT_CLASS is imported and used in SettingsManager.tsx and profile managers', () => {
      const files = [
        path.join(COMPONENTS_DIR, 'SettingsManager.tsx'),
        path.join(COMPONENTS_DIR, 'EquipmentManager.tsx'),
        path.join(COMPONENTS_DIR, 'MashProfileManager.tsx'),
        path.join(COMPONENTS_DIR, 'FermentationProfileManager.tsx'),
        path.join(COMPONENTS_DIR, 'WaterProfileManager.tsx'),
      ];
      for (const file of files) {
        const content = fs.readFileSync(file, 'utf-8');
        expect(content, `${file} imports BODY_TEXT_CLASS`).toMatch(/BODY_TEXT_CLASS/);
      }
    });
  });

  describe('M35_P1: Table, TableHeaderCell, TableCell primitives and BrewSheet adoption', () => {
    const COMPONENTS_DIR = path.resolve(__dirname, '../src/components');
    const UI_DIR = path.resolve(__dirname, '../src/components/ui');
    const TABLE_SRC = fs.readFileSync(path.join(UI_DIR, 'Table.tsx'), 'utf-8');
    const BREW_SHEET_SRC = fs.readFileSync(path.join(COMPONENTS_DIR, 'BrewSheet.tsx'), 'utf-8');

    function baseEquipment(overrides: Partial<EquipmentProfile> = {}): EquipmentProfile {
      return {
        id: 'eq-1',
        name: 'Test Rig',
        batchSizeL: 20,
        boilTimeMin: 60,
        brewhouseEfficiencyPct: 72,
        mashEfficiencyPct: 75,
        boilOffRateLPerHour: 3,
        trubChillerLossL: 1,
        hopUtilizationPct: 100,
        derivedFromEquipmentId: null,
        mashWaterRatioLPerKg: 3,
        grainAbsorptionLPerKg: 1,
        hopstandUtilizationFactor: 0.2,
        hopstandTemperatureC: 79,
        spargeTemperatureC: 76,
        mashTunHeatCapacityL: 0,
        grainTemperatureC: 20,
        notes: '',
        ...overrides,
      };
    }

    function populatedRecipe(): Recipe {
      return {
        id: 'recipe-1',
        name: 'Test IPA',
        author: 'Tester',
        styleName: 'IPA',
        equipment: baseEquipment(),
        fermentables: [{ id: 'f-1', name: 'Pale Malt', type: 'Grain', amountKg: 5, colorSrm: 2, potentialSg: 1.037 }],
        hops: [{ id: 'h-1', name: 'Magnum', amountG: 20, alphaAcidPct: 14, use: 'Boil', boilMins: 60, whirlpoolMins: null, whirlpoolTempC: null, type: 'Pellet' }],
        yeasts: [{ id: 'y-1', name: 'US-05', type: 'Ale', form: 'Dry', laboratory: 'Fermentis', attenuationPct: 75, amountPkg: 1 }],
        miscs: [{ id: 'm-1', name: 'Whirlfloc', type: 'Fining', use: 'Boil', timeMinutes: 10, amount: 1, unit: 'each' }],
        notes: '',
        mashProfile: {
          id: 'mash-1',
          name: 'Single Infusion',
          targetPh: 5.4,
          spargeTempC: null,
          steps: [{ id: 'step-1', name: 'Sacc Rest', type: 'Infusion', stepTempC: 67, stepTimeMin: 60, rampTimeMin: 0, infuseAmountL: null, infuseWaterTempC: 72 }],
        },
        fermentationProfile: {
          id: 'ferm-1',
          name: 'Standard Ale',
          steps: [{ id: 'fs-1', name: 'Primary', type: 'Primary', stepTempC: 18, stepTimeDays: 14, rampDays: 0, pressurePsi: null }],
        },
      };
    }

    function buildModel() {
      const recipe = populatedRecipe();
      const stats = calculateRecipeStats(recipe);
      return buildBrewSheetModel({ recipe, stats, batchName: 'Batch #1', carbonationVolumesTarget: 2.4 });
    }

    describe('AC-1: barrel exports the new symbols alongside the existing five primitives', () => {
      it('components/ui/index.ts exports Table, TableHeaderCell, TableCell as callable functions, plus the existing primitives', () => {
        expect(typeof Table).toBe('function');
        expect(typeof TableHeaderCell).toBe('function');
        expect(typeof TableCell).toBe('function');
        expect(typeof FormField).toBe('function');
        expect(typeof Input).toBe('function');
        expect(typeof Select).toBe('function');
        expect(typeof Button).toBe('function');
        expect(typeof NumberInput).toBe('function');
      });
    });

    describe('AC-2, AC-3, AC-4: Table structure, class merge, and prop pass-through', () => {
      it('AC-2: renders a div.overflow-x-auto wrapping a table with className exactly "w-full border-collapse"', () => {
        const { container } = render(
          <Table>
            <tbody>
              <tr>
                <td>cell</td>
              </tr>
            </tbody>
          </Table>,
        );
        const wrapper = container.firstElementChild as HTMLElement;
        expect(wrapper.tagName).toBe('DIV');
        expect(wrapper.className.split(/\s+/)).toContain('overflow-x-auto');
        const table = wrapper.querySelector('table') as HTMLTableElement;
        expect(table).not.toBeNull();
        expect(table.className).toBe(TABLE_CLASS);
      });

      it('AC-3: className merges token-first, single space, no trailing space', () => {
        const { container } = render(<Table className="mt-2" />);
        const table = container.querySelector('table') as HTMLTableElement;
        expect(table.className).toBe(`${TABLE_CLASS} mt-2`);
      });

      it('AC-4: data-testid and aria-label land on the table, not the wrapper', () => {
        const { container } = render(<Table data-testid="t" aria-label="Hops" />);
        const table = screen.getByTestId('t');
        expect(table.tagName).toBe('TABLE');
        expect(table).toHaveAttribute('aria-label', 'Hops');
        const wrapper = container.firstElementChild as HTMLElement;
        expect(wrapper).not.toHaveAttribute('data-testid');
        expect(wrapper).not.toHaveAttribute('aria-label');
      });
    });

    describe('AC-5, AC-6: TableHeaderCell default scope and override', () => {
      it('AC-5: renders th with exact TABLE_HEADER_CELL_CLASS and scope="col" by default', () => {
        render(
          <table>
            <thead>
              <tr>
                <TableHeaderCell data-testid="th-default">Name</TableHeaderCell>
              </tr>
            </thead>
          </table>,
        );
        const th = screen.getByTestId('th-default');
        expect(th.className).toBe(TABLE_HEADER_CELL_CLASS);
        expect(th).toHaveAttribute('scope', 'col');
      });

      it('AC-6: an explicit scope="row" overrides the default (exactly one scope attribute)', () => {
        render(
          <table>
            <tbody>
              <tr>
                <TableHeaderCell scope="row" data-testid="th-row">
                  Total
                </TableHeaderCell>
              </tr>
            </tbody>
          </table>,
        );
        const th = screen.getByTestId('th-row');
        expect(th.getAttributeNames().filter((n) => n === 'scope')).toHaveLength(1);
        expect(th).toHaveAttribute('scope', 'row');
      });
    });

    describe('AC-7, AC-8: TableCell default and merge + colSpan', () => {
      it('AC-7: renders td with exact TABLE_CELL_CLASS and no scope attribute', () => {
        render(
          <table>
            <tbody>
              <tr>
                <TableCell data-testid="td-default">Value</TableCell>
              </tr>
            </tbody>
          </table>,
        );
        const td = screen.getByTestId('td-default');
        expect(td.className).toBe(TABLE_CELL_CLASS);
        expect(td).not.toHaveAttribute('scope');
      });

      it('AC-8: colSpan and className merge byte-identically to the pre-migration BrewSheet.tsx:17 literal', () => {
        render(
          <table>
            <tbody>
              <tr>
                <TableCell colSpan={5} className="text-slate-400 italic" data-testid="td-empty">
                  None
                </TableCell>
              </tr>
            </tbody>
          </table>,
        );
        const td = screen.getByTestId('td-empty');
        expect(td).toHaveAttribute('colspan', '5');
        expect(td.className).toBe(`${TABLE_CELL_CLASS} text-slate-400 italic`);
      });
    });

    describe('AC-9, AC-10: degenerate inputs', () => {
      it('AC-9: <Table />, <Table>{null}</Table>, <TableCell />, <TableHeaderCell /> render without throwing', () => {
        expect(() => render(<Table />)).not.toThrow();
        const { container } = render(<Table>{null}</Table>);
        const wrapper = container.firstElementChild as HTMLElement;
        expect(wrapper.tagName).toBe('DIV');
        expect(wrapper.querySelector('table')).not.toBeNull();

        expect(() =>
          render(
            <table>
              <tbody>
                <tr>
                  <TableCell data-testid="empty-td" />
                </tr>
              </tbody>
            </table>,
          ),
        ).not.toThrow();
        expect(screen.getByTestId('empty-td').textContent).toBe('');

        expect(() =>
          render(
            <table>
              <thead>
                <tr>
                  <TableHeaderCell data-testid="empty-th" />
                </tr>
              </thead>
            </table>,
          ),
        ).not.toThrow();
        expect(screen.getByTestId('empty-th').textContent).toBe('');
      });

      it('AC-10: className="" and className={undefined} both yield the bare token with no trailing/doubled whitespace', () => {
        const { container: c1 } = render(<Table className="" />);
        const table1 = c1.querySelector('table') as HTMLTableElement;
        expect(table1.className).toBe(TABLE_CLASS);

        const { container: c2 } = render(<Table className={undefined} />);
        const table2 = c2.querySelector('table') as HTMLTableElement;
        expect(table2.className).toBe(TABLE_CLASS);
      });
    });

    describe('AC-11: static checks on Table.tsx', () => {
      it('AC-11: zero local *_CLASS constants; imports the three tokens from ../designSystem; no clsx/tailwind-merge/cva', () => {
        expect(TABLE_SRC).not.toMatch(/const\s+[A-Z_]+_CLASS\s*=/);
        expect(TABLE_SRC).toMatch(/import\s*\{\s*TABLE_CLASS,\s*TABLE_HEADER_CELL_CLASS,\s*TABLE_CELL_CLASS\s*\}\s*from\s*['"]\.\.\/designSystem['"]/);
        expect(TABLE_SRC).not.toMatch(/from ['"]clsx['"]/);
        expect(TABLE_SRC).not.toMatch(/from ['"]tailwind-merge['"]/);
        expect(TABLE_SRC).not.toMatch(/from ['"]cva['"]/);
      });
    });

    describe('AC-12 [M35_P2 SUPERSEDED — the blanket size?:/variant?: prohibition below is replaced by an adoption assertion per RA-14; density?:/wrapperClassName?: prohibitions and the TableProps body pin remain]: static checks on Table.tsx', () => {
      it('no density/wrapperClassName prop; TableProps adds only children (still unproven, still unwanted)', () => {
        expect(TABLE_SRC).not.toMatch(/\bdensity\??:/);
        expect(TABLE_SRC).not.toMatch(/\bwrapperClassName\??:/);
        const tablePropsMatch = TABLE_SRC.match(/export interface TableProps extends TableHTMLAttributes<HTMLTableElement> \{([\s\S]*?)\}/);
        expect(tablePropsMatch).not.toBeNull();
        const body = tablePropsMatch![1].trim();
        expect(body).toMatch(/^children\??:\s*ReactNode;$/);
      });

      it('RA-14: size/variant axes now exist on TableCellProps with the exact declared unions', () => {
        expect(TABLE_SRC).toMatch(/export type TableCellSize = 'sm' \| 'md';/);
        expect(TABLE_SRC).toMatch(/export type TableCellVariant = 'numeric' \| 'text';/);
        expect(TABLE_SRC).toMatch(/size\?:\s*TableCellSize/);
        expect(TABLE_SRC).toMatch(/variant\?:\s*TableCellVariant/);
      });

      it('RA-14: all four size x variant combinations have at least one real consumer among the 9 migrated files', () => {
        const migratedFiles = [
          'FermentableSection.tsx',
          'HopSection.tsx',
          'MiscSection.tsx',
          'YeastSection.tsx',
          'MashSection.tsx',
          'ReadingLog.tsx',
          'StockCheckPanel.tsx',
          'PostBrewCalibrationModal.tsx',
          'WaterCalculatorModal.tsx',
        ];
        const openTags = migratedFiles
          .map((f) => fs.readFileSync(path.join(COMPONENTS_DIR, f), 'utf-8'))
          .join('\n')
          .match(/<TableCell\b[^>]*>/g) || [];
        expect(openTags.length).toBeGreaterThan(0);

        const counts = { 'md:numeric': 0, 'md:text': 0, 'sm:numeric': 0, 'sm:text': 0 };
        for (const tag of openTags) {
          const size = /\bsize="sm"/.test(tag) ? 'sm' : 'md';
          const variant = /\bvariant="text"/.test(tag) ? 'text' : 'numeric';
          counts[`${size}:${variant}` as keyof typeof counts] += 1;
        }
        for (const [combo, count] of Object.entries(counts)) {
          expect(count, `expected at least one <TableCell> consumer for ${combo}`).toBeGreaterThan(0);
        }
      });
    });

    describe('AC-17, AC-18, AC-19: BrewSheet.tsx local constants, raw table elements, and scroll wrappers purged', () => {
      it('AC-17: zero occurrences of the retired TH_CLASS/TD_CLASS/TABLE_CLASS local const declarations', () => {
        expect(BREW_SHEET_SRC).not.toMatch(/const\s+(TH_CLASS|TD_CLASS|TABLE_CLASS)\s*=/);
      });

      it('AC-18: zero <table, <th, <td literals; imports Table/TableHeaderCell/TableCell from ./ui', () => {
        expect(BREW_SHEET_SRC).not.toMatch(/<table\b/);
        expect(BREW_SHEET_SRC).not.toMatch(/<th\b/);
        expect(BREW_SHEET_SRC).not.toMatch(/<td\b/);
        expect(BREW_SHEET_SRC).toMatch(/import\s*\{[^}]*\bTable\b[^}]*\bTableHeaderCell\b[^}]*\bTableCell\b[^}]*\}\s*from\s*['"]\.\/ui['"]/);
      });

      it('AC-19: the literal overflow-x-auto appears zero times in BrewSheet.tsx (ownership moved to Table)', () => {
        expect(BREW_SHEET_SRC.match(/overflow-x-auto/g) ?? []).toEqual([]);
      });
    });

    describe('AC-23: raw buttons migrated onto <Button variant="secondary" size="sm">', () => {
      it('static: zero raw <button elements; BUTTON_SECONDARY_CLASS import removed', () => {
        expect(BREW_SHEET_SRC).not.toMatch(/<button\b/);
        expect(BREW_SHEET_SRC).not.toMatch(/BUTTON_SECONDARY_CLASS/);
      });

      it('integration: brew-sheet-toggle reflects aria-expanded and brew-sheet-print-btn calls window.print once per click', () => {
        const model = buildModel();
        render(<BrewSheet model={model} />);

        const toggle = screen.getByTestId('brew-sheet-toggle');
        expect(toggle).toHaveAttribute('aria-expanded', 'false');
        fireEvent.click(toggle);
        expect(toggle).toHaveAttribute('aria-expanded', 'true');

        const printSpy = vi.fn();
        const original = window.print;
        window.print = printSpy;
        fireEvent.click(screen.getByTestId('brew-sheet-print-btn'));
        expect(printSpy).toHaveBeenCalledTimes(1);
        window.print = original;
      });
    });
  });
});

// ---------------------------------------------------------------------------
// M35_P2: the 10-table migration — TableCell axes, per-file adoption, and
// structural sweeps (spec §3, AC-4 through AC-26). A new top-level describe,
// sibling to the M30_P2..M35_P1 block above, since it needs its own
// CatalogContext/api-client mocks and fetch stubbing rather than inheriting
// the outer block's.
// ---------------------------------------------------------------------------

describe('M35_P2: the 10-table migration — TableCell axes, per-file adoption, and structural sweeps', () => {
  const COMPONENTS_DIR = path.resolve(__dirname, '../src/components');
  const UI_DIR = path.resolve(__dirname, '../src/components/ui');
  const SRC_DIR = path.resolve(__dirname, '../src');
  const TABLE_SRC = fs.readFileSync(path.join(UI_DIR, 'Table.tsx'), 'utf-8');
  const INDEX_SRC = fs.readFileSync(path.join(UI_DIR, 'index.ts'), 'utf-8');

  const MIGRATED_FILES = [
    'FermentableSection.tsx',
    'HopSection.tsx',
    'MiscSection.tsx',
    'YeastSection.tsx',
    'MashSection.tsx',
    'ReadingLog.tsx',
    'StockCheckPanel.tsx',
    'PostBrewCalibrationModal.tsx',
    'WaterCalculatorModal.tsx',
  ];

  const DEFAULT_TEST_CONFIG: UserConfig = {
    id: 'default',
    unitSystem: 'metric',
    gravityUnit: 'sg',
    temperatureUnit: 'celsius',
    ibuFormula: 'tinseth',
    abvFormula: 'simple',
  };

  function jsonResponse(body: unknown, status = 200): Response {
    return {
      ok: status >= 200 && status < 300,
      status,
      text: () => Promise.resolve(JSON.stringify(body)),
    } as Response;
  }

  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url === '/api/config') return Promise.resolve(jsonResponse(DEFAULT_TEST_CONFIG));
        return Promise.reject(new Error(`Unexpected fetch call in M35_P2 uiPrimitives block: ${url}`));
      }),
    );
    vi.mocked(m35p2GetBatchCheckoff).mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('AC-4, AC-5, AC-6: TableCell token-selection axes', () => {
    it('AC-4: all 4 size x variant combinations render the exact matching token', () => {
      render(
        <table>
          <tbody>
            <tr>
              <TableCell data-testid="md-numeric" />
              <TableCell variant="text" data-testid="md-text" />
              <TableCell size="sm" data-testid="sm-numeric" />
              <TableCell size="sm" variant="text" data-testid="sm-text" />
            </tr>
          </tbody>
        </table>,
      );
      expect(screen.getByTestId('md-numeric').className).toBe(TABLE_CELL_CLASS);
      expect(screen.getByTestId('md-text').className).toBe('text-sm text-slate-200 py-1.5 px-2 border-t border-slate-800');
      expect(screen.getByTestId('sm-numeric').className).toBe(
        'text-xs text-slate-200 py-1.5 px-2 border-t border-slate-800 font-mono tabular-nums',
      );
      expect(screen.getByTestId('sm-text').className).toBe('text-xs text-slate-200 py-1.5 px-2 border-t border-slate-800');
    });

    it('AC-5: the default (no props) renders exactly TABLE_CELL_CLASS, proving BrewSheet.tsx is unaffected', () => {
      render(
        <table>
          <tbody>
            <tr>
              <TableCell data-testid="td-default">{'Ø'}</TableCell>
            </tr>
          </tbody>
        </table>,
      );
      expect(screen.getByTestId('td-default').className).toBe(TABLE_CELL_CLASS);
    });

    it('AC-6: merge order is token-first, className-last, single space, no trailing space; empty/undefined className yields the bare token', () => {
      render(
        <table>
          <tbody>
            <tr>
              <TableCell size="sm" variant="text" className="text-right" data-testid="td-merged" />
              <TableCell className="" data-testid="td-empty-classname" />
              <TableCell className={undefined} data-testid="td-undefined-classname" />
            </tr>
          </tbody>
        </table>,
      );
      expect(screen.getByTestId('td-merged').className).toBe(
        'text-xs text-slate-200 py-1.5 px-2 border-t border-slate-800 text-right',
      );
      expect(screen.getByTestId('td-empty-classname').className).toBe(TABLE_CELL_CLASS);
      expect(screen.getByTestId('td-undefined-classname').className).toBe(TABLE_CELL_CLASS);
    });
  });

  describe('AC-7: TableHeaderCell corrected scope contract (RA-7)', () => {
    it('default scope="col"; explicit scope="row" overrides; scope={undefined} still yields scope="col" — exactly one scope attribute in all three cases', () => {
      render(
        <table>
          <thead>
            <tr>
              <TableHeaderCell data-testid="th-default">A</TableHeaderCell>
              <TableHeaderCell scope="row" data-testid="th-row">B</TableHeaderCell>
              <TableHeaderCell scope={undefined} data-testid="th-undefined">C</TableHeaderCell>
            </tr>
          </thead>
        </table>,
      );
      const thDefault = screen.getByTestId('th-default');
      const thRow = screen.getByTestId('th-row');
      const thUndefined = screen.getByTestId('th-undefined');

      expect(thDefault).toHaveAttribute('scope', 'col');
      expect(thDefault.getAttributeNames().filter((n) => n === 'scope')).toHaveLength(1);

      expect(thRow).toHaveAttribute('scope', 'row');
      expect(thRow.getAttributeNames().filter((n) => n === 'scope')).toHaveLength(1);

      expect(thUndefined).toHaveAttribute('scope', 'col');
      expect(thUndefined.getAttributeNames().filter((n) => n === 'scope')).toHaveLength(1);
    });
  });

  describe('AC-8, AC-9, AC-10: static contract on Table.tsx / ui/index.ts', () => {
    it('AC-8: Table and TableHeaderCell gain no new props', () => {
      const tablePropsMatch = TABLE_SRC.match(/export interface TableProps extends TableHTMLAttributes<HTMLTableElement> \{([\s\S]*?)\}/);
      expect(tablePropsMatch).not.toBeNull();
      expect(tablePropsMatch![1].trim()).toMatch(/^children\??:\s*ReactNode;$/);

      const headerPropsMatch = TABLE_SRC.match(/export interface TableHeaderCellProps extends ThHTMLAttributes<HTMLTableCellElement> \{([\s\S]*?)\}/);
      expect(headerPropsMatch).not.toBeNull();
      expect(headerPropsMatch![1].trim()).toMatch(/^children\??:\s*ReactNode;$/);

      expect(TABLE_SRC).not.toMatch(/\bdensity\??:/);
      expect(TABLE_SRC).not.toMatch(/\bwrapperClassName\??:/);
    });

    it('AC-9: zero local *_CLASS constants; all 6 tokens referenced, imported from ../designSystem; no clsx/tailwind-merge/cva', () => {
      expect(TABLE_SRC).not.toMatch(/const\s+[A-Z_]+_CLASS\s*=/);
      for (const token of [
        'TABLE_CLASS',
        'TABLE_HEADER_CELL_CLASS',
        'TABLE_CELL_CLASS',
        'TABLE_CELL_TEXT_CLASS',
        'TABLE_CELL_SM_CLASS',
        'TABLE_CELL_SM_TEXT_CLASS',
      ]) {
        expect(TABLE_SRC).toMatch(new RegExp(`\\b${token}\\b`));
      }
      const importLines = TABLE_SRC.match(/^import .*from ['"]\.\.\/designSystem['"];?$/gm) || [];
      expect(importLines.length).toBeGreaterThan(0);
      expect(TABLE_SRC).not.toMatch(/from ['"]clsx['"]/);
      expect(TABLE_SRC).not.toMatch(/from ['"]tailwind-merge['"]/);
      expect(TABLE_SRC).not.toMatch(/from ['"]cva['"]/);
    });

    it('AC-10: ui/index.ts exports TableCellSize and TableCellVariant as types; the value export line is unchanged', () => {
      expect(INDEX_SRC).toMatch(/export type \{[^}]*\bTableCellSize\b[^}]*\}\s*from\s*['"]\.\/Table['"]/);
      expect(INDEX_SRC).toMatch(/export type \{[^}]*\bTableCellVariant\b[^}]*\}\s*from\s*['"]\.\/Table['"]/);
      expect(INDEX_SRC).toMatch(/export \{ Table, TableHeaderCell, TableCell \} from '\.\/Table';/);
    });
  });

  describe('AC-12 through AC-20: per-file static migration sweep', () => {
    it.each(MIGRATED_FILES)('%s: zero raw <table/<th/<td literals; imports Table, TableHeaderCell, TableCell from ./ui', (file) => {
      const content = fs.readFileSync(path.join(COMPONENTS_DIR, file), 'utf-8');
      expect(content, `${file} has a raw <table`).not.toMatch(/<table[\s>]/);
      expect(content, `${file} has a raw <th`).not.toMatch(/<th[\s>]/);
      expect(content, `${file} has a raw <td`).not.toMatch(/<td[\s>]/);
      expect(content).toMatch(/import\s*\{[^}]*\bTable\b[^}]*\bTableHeaderCell\b[^}]*\bTableCell\b[^}]*\}\s*from\s*['"]\.\/ui['"]/);
    });

    it('AC-16: MONO_VALUE_CLASS no longer appears in any <TableCell> className in MashSection.tsx, but still appears in the file (its non-table span uses)', () => {
      const content = fs.readFileSync(path.join(COMPONENTS_DIR, 'MashSection.tsx'), 'utf-8');
      const tableCellTags = content.match(/<TableCell\b[^>]*>/g) || [];
      expect(tableCellTags.length).toBeGreaterThan(0);
      for (const tag of tableCellTags) {
        expect(tag).not.toMatch(/MONO_VALUE_CLASS/);
      }
      expect(content).toMatch(/MONO_VALUE_CLASS/);
    });

    it('AC-19: StockCheckPanel data-testid="stock-check-table" lands on the <table> element, not a wrapper', () => {
      const content = fs.readFileSync(path.join(COMPONENTS_DIR, 'StockCheckPanel.tsx'), 'utf-8');
      expect(content).toMatch(/<Table\s+data-testid="stock-check-table">/);
    });

    it('AC-20: WaterCalculatorModal colgroup percentages are byte-identical (20/14/27/27/12)', () => {
      const content = fs.readFileSync(path.join(COMPONENTS_DIR, 'WaterCalculatorModal.tsx'), 'utf-8');
      expect(content).toMatch(/<col className="w-\[20%\]" \/>/);
      expect(content).toMatch(/<col className="w-\[14%\]" \/>/);
      expect((content.match(/<col className="w-\[27%\]" \/>/g) || []).length).toBe(2);
      expect(content).toMatch(/<col className="w-\[12%\]" \/>/);
    });
  });

  describe('AC-21: app-wide raw table-element sweep', () => {
    function walk(dir: string): string[] {
      return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) return walk(full);
        if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) return [full];
        return [];
      });
    }

    it('<table appears only in components/ui/Table.tsx; <th/<td appear in no components/ file other than ui/Table.tsx', () => {
      const files = walk(SRC_DIR).filter((f) => f.startsWith(path.join(SRC_DIR, 'components') + path.sep));
      const tableHits = files.filter((f) => /<table[\s>]/.test(fs.readFileSync(f, 'utf-8')));
      expect(tableHits).toEqual([path.join(UI_DIR, 'Table.tsx')]);

      const thTdHits = files.filter((f) => {
        const content = fs.readFileSync(f, 'utf-8');
        return /<th[\s>]/.test(content) || /<td[\s>]/.test(content);
      });
      expect(thTdHits).toEqual([path.join(UI_DIR, 'Table.tsx')]);
    });
  });

  // -- Shared integration fixtures for AC-22/AC-23/AC-25/AC-26 -------------

  function baseEquipmentForFixtures(): EquipmentProfile {
    return {
      id: 'eq-1',
      name: 'Test Rig',
      batchSizeL: 20,
      boilTimeMin: 60,
      brewhouseEfficiencyPct: 72,
      mashEfficiencyPct: 75,
      boilOffRateLPerHour: 3,
      trubChillerLossL: 1,
      hopUtilizationPct: 100,
      derivedFromEquipmentId: null,
      mashWaterRatioLPerKg: 3,
      grainAbsorptionLPerKg: 1,
      hopstandUtilizationFactor: 0.2,
      hopstandTemperatureC: 79,
      spargeTemperatureC: 76,
      mashTunHeatCapacityL: 0,
      grainTemperatureC: 20,
      notes: '',
    };
  }

  function mashSectionRecipe(): Recipe {
    return {
      id: 'recipe-1',
      name: 'Test IPA',
      author: 'Tester',
      styleName: 'IPA',
      equipment: baseEquipmentForFixtures(),
      fermentables: [{ id: 'f-1', name: 'Pale Malt', type: 'Grain', amountKg: 5, colorSrm: 2, potentialSg: 1.037 }],
      hops: [],
      yeasts: [],
      miscs: [],
      notes: '',
      mashProfile: {
        id: 'mash-1',
        name: 'Single Infusion',
        targetPh: 5.4,
        spargeTempC: null,
        steps: [{ id: 'step-1', name: 'Sacc Rest', type: 'Infusion', stepTempC: 67, stepTimeMin: 60, rampTimeMin: 0, infuseAmountL: null, infuseWaterTempC: 72 }],
      },
      fermentationProfile: {
        id: 'ferm-1',
        name: 'Standard Ale',
        steps: [{ id: 'fs-1', name: 'Primary', type: 'Primary', stepTempC: 18, stepTimeDays: 14, rampDays: 0, pressurePsi: null }],
      },
    };
  }

  function renderFermentableSection() {
    return render(
      <ConfigProvider>
        <FermentableSection
          fermentables={[{ id: 'f-1', name: 'Maris Otter', type: 'Grain', amountKg: 5, colorSrm: 3, potentialSg: 1.037 }]}
          totalGrainKg={5}
          onUpdate={vi.fn()}
        />
      </ConfigProvider>,
    );
  }

  function renderHopSection() {
    const hop: HopItem = {
      id: 'h-1',
      name: 'Citra',
      amountG: 20,
      alphaAcidPct: 12,
      use: 'Boil',
      boilMins: 60,
      whirlpoolMins: null,
      whirlpoolTempC: null,
      type: 'Pellet',
    };
    return render(
      <ConfigProvider>
        <HopSection
          hops={[hop]}
          wortGravity={1.05}
          batchSizeL={20}
          hopUtilizationPct={87}
          hopstandUtilizationFactor={0.25}
          hopstandTemperatureC={79}
          totalHopG={20}
          totalIbu={30}
          onUpdate={vi.fn()}
        />
      </ConfigProvider>,
    );
  }

  function renderMiscSection() {
    const misc: MiscItem = { id: 'm-1', name: 'Whirlfloc', type: 'Fining', use: 'Boil', timeMinutes: 10, amount: 1, unit: 'each' };
    return render(<MiscSection miscs={[misc]} onUpdate={vi.fn()} />);
  }

  function renderYeastSection() {
    const yeast: YeastItem = {
      id: 'y-1',
      name: 'US-05',
      laboratory: 'Fermentis',
      type: 'Ale',
      form: 'Dry',
      attenuationPct: 75,
      amountPkg: 1,
    };
    return render(<YeastSection yeasts={[yeast]} onUpdate={vi.fn()} />);
  }

  function renderMashSection() {
    const recipe = mashSectionRecipe();
    const mashPlan: MashPlan = calculateMashPlan(recipe);
    return render(
      <MashSection
        recipe={recipe}
        mashPlan={mashPlan}
        mashProfiles={[recipe.mashProfile!]}
        fermentationProfiles={[recipe.fermentationProfile!]}
        onSelectMashProfile={vi.fn()}
        onSelectFermentationProfile={vi.fn()}
        config={DEFAULT_TEST_CONFIG}
      />,
    );
  }

  function renderReadingLog() {
    const reading: Reading = {
      id: 'r1',
      batchId: 'batch-1',
      readingTime: '2026-08-01T12:00:00.000Z',
      sg: 1.048,
      tempC: 20,
      comment: 'day 1',
      ph: null,
      pressurePsi: null,
    };
    return render(<ReadingLog readings={[reading]} onCreate={vi.fn()} onUpdate={vi.fn()} onDelete={vi.fn()} />);
  }

  function stockCheckFixture(): BatchCheckoffState {
    return {
      lines: [
        {
          category: 'Fermentable',
          displayName: 'Pale Ale Malt',
          nameKey: 'pale-ale-malt',
          unit: 'kg',
          requiredAmount: 5,
          matched: true,
          inventoryItemId: 'inv-1',
          inventoryUnit: 'kg',
          onHand: 4,
          unitMismatch: false,
          shortfall: 1,
          sufficient: false,
          checkable: true,
          checked: false,
          openTransactionId: null,
          checkedAmount: null,
          checkedCostPerUnit: null,
          checkedAt: null,
        },
      ],
      requirementCount: 1,
      matchedCount: 1,
      comparableCount: 1,
      unmatchedCount: 0,
      unitMismatchCount: 0,
      shortfallCount: 1,
      hasShortfall: true,
      checkableCount: 1,
      checkedCount: 0,
      allCheckedOff: false,
      stage: 'Planning',
      editable: true,
    };
  }

  async function renderStockCheckPanel() {
    vi.mocked(m35p2GetBatchCheckoff).mockResolvedValue(stockCheckFixture());
    const result = render(
      <ConfigProvider>
        <StockCheckPanel batchId="batch-1" />
      </ConfigProvider>,
    );
    await waitFor(() => screen.getByTestId('stock-check-table'));
    return result;
  }

  function renderPostBrewCalibrationModal() {
    const dummyEq = baseEquipmentForFixtures();
    const dummyRecipe: Recipe = { ...mashSectionRecipe(), equipment: dummyEq };
    const evaluation: CalibrationEvaluationResult = {
      canCalibrate: true,
      estimatedBrewhouseEfficiencyPct: 70,
      achievedBrewhouseEfficiencyPct: 65,
      estimatedMashEfficiencyPct: 75,
      achievedMashEfficiencyPct: 72,
      currentBoilOffRateLPerHour: 3,
      achievedBoilOffRateLPerHour: 3.5,
      currentTrubLossL: 2,
      achievedTrubLossL: 1.8,
    };
    return render(
      <PostBrewCalibrationModal
        isOpen={true}
        onClose={vi.fn()}
        evaluation={evaluation}
        equipmentProfile={dummyEq}
        recipe={dummyRecipe}
        onUpdateEquipmentProfile={vi.fn()}
        onUpdateRecipe={vi.fn()}
      />,
    );
  }

  function renderWaterCalculatorModal() {
    const waterProfiles: WaterProfile[] = [
      { id: 'wp-1', name: 'RO', type: 'source', calcium: 0, magnesium: 0, sodium: 0, chloride: 0, sulfate: 0, bicarbonate: 0, ph: null, description: null },
    ];
    const fermentables: FermentableItem[] = [{ id: 'f-1', name: 'Pale 2-Row', type: 'Grain', amountKg: 5, colorSrm: 3.5, potentialSg: 1.037 }];
    return render(
      <WaterCalculatorModal
        isOpen={true}
        onClose={vi.fn()}
        waterProfiles={waterProfiles}
        waterSourceId={null}
        waterTargetId={null}
        waterVolumeL={23}
        fermentables={fermentables}
        miscs={[]}
        onSaveAdjustments={vi.fn()}
      />,
    );
  }

  describe('AC-22, AC-23, AC-25, AC-26: rendered structural sweep across all 10 tables (Finding 6 closure)', () => {
    it('per-table columnheader counts match exactly [7,7,7,6,6,5,7,4,4,5]; every columnheader has scope="col"; every table has an overflow-x-auto parent div; the 4 residual margin wrappers land correctly', async () => {
      const r1 = renderFermentableSection();
      const r2 = renderHopSection();
      const r3 = renderMiscSection();
      const r4 = renderYeastSection();
      const r5 = renderMashSection();
      const r7 = renderReadingLog();
      const r8 = await renderStockCheckPanel();
      const r9 = renderPostBrewCalibrationModal();
      const r10 = renderWaterCalculatorModal();

      const mashTables = r5.container.querySelectorAll('table');
      expect(mashTables.length).toBe(2);

      const tables: HTMLTableElement[] = [
        r1.container.querySelector('table') as HTMLTableElement,
        r2.container.querySelector('table') as HTMLTableElement,
        r3.container.querySelector('table') as HTMLTableElement,
        r4.container.querySelector('table') as HTMLTableElement,
        mashTables[0] as HTMLTableElement,
        mashTables[1] as HTMLTableElement,
        r7.container.querySelector('table') as HTMLTableElement,
        r8.container.querySelector('table') as HTMLTableElement,
        r9.container.querySelector('table') as HTMLTableElement,
        r10.container.querySelector('table') as HTMLTableElement,
      ];

      for (const t of tables) {
        expect(t, 'expected every slot to resolve a <table>').not.toBeNull();
      }

      // AC-22 + AC-23
      const expectedCounts = [7, 7, 7, 6, 6, 5, 7, 4, 4, 5];
      const actualCounts: number[] = [];
      let totalHeaders = 0;
      for (const table of tables) {
        const headers = within(table).getAllByRole('columnheader');
        actualCounts.push(headers.length);
        totalHeaders += headers.length;
        for (const h of headers) {
          expect(h).toHaveAttribute('scope', 'col');
        }
      }
      expect(actualCounts).toEqual(expectedCounts);
      expect(totalHeaders).toBe(58);

      // AC-25: every table has a direct-parent div carrying overflow-x-auto;
      // Table's own className never carries a residual margin utility.
      for (const table of tables) {
        const parent = table.parentElement as HTMLElement;
        expect(parent.tagName).toBe('DIV');
        expect(parent.className.split(/\s+/)).toContain('overflow-x-auto');
        expect(table.className).not.toMatch(/\bmb-\d/);
      }

      // AC-26: FermentableSection/HopSection/MiscSection sit inside a mb-4
      // ancestor; MashSection's first (steps) table sits inside mb-3.
      const [fermTable, hopTable, miscTable, , mashStepsTable] = tables;
      const marginAncestor = (t: HTMLTableElement) => t.parentElement!.parentElement as HTMLElement;
      expect(marginAncestor(fermTable).className.split(/\s+/)).toContain('mb-4');
      expect(marginAncestor(hopTable).className.split(/\s+/)).toContain('mb-4');
      expect(marginAncestor(miscTable).className.split(/\s+/)).toContain('mb-4');
      expect(marginAncestor(mashStepsTable).className.split(/\s+/)).toContain('mb-3');
    });
  });

  describe('AC-24: degenerate/empty inputs render only the spec-sanctioned empty state', () => {
    it('FermentableSection: colSpan=7 empty row', () => {
      render(
        <ConfigProvider>
          <FermentableSection fermentables={[]} totalGrainKg={0} onUpdate={vi.fn()} />
        </ConfigProvider>,
      );
      const row = screen.getByText(/No fermentables added yet/);
      expect(row.closest('td')).toHaveAttribute('colSpan', '7');
    });

    it('HopSection: colSpan=7 empty row', () => {
      render(
        <ConfigProvider>
          <HopSection
            hops={[]}
            wortGravity={1.05}
            batchSizeL={20}
            hopUtilizationPct={87}
            hopstandUtilizationFactor={0.25}
            hopstandTemperatureC={79}
            totalHopG={0}
            totalIbu={0}
            onUpdate={vi.fn()}
          />
        </ConfigProvider>,
      );
      const row = screen.getByText(/No hops added yet/);
      expect(row.closest('td')).toHaveAttribute('colSpan', '7');
    });

    it('MiscSection: colSpan=7 empty row', () => {
      render(<MiscSection miscs={[]} onUpdate={vi.fn()} />);
      const row = screen.getByText(/No misc additions yet/);
      expect(row.closest('td')).toHaveAttribute('colSpan', '7');
    });

    it('YeastSection: colSpan=6 empty row', () => {
      render(<YeastSection yeasts={[]} onUpdate={vi.fn()} />);
      const row = screen.getByText(/No yeast added yet/);
      expect(row.closest('td')).toHaveAttribute('colSpan', '6');
    });

    it('MashSection: renders no table at all when there is no mash profile and no fermentation profile', () => {
      const recipe = mashSectionRecipe();
      recipe.mashProfile = null;
      recipe.fermentationProfile = null;
      const mashPlan: MashPlan = calculateMashPlan(recipe);
      const { container } = render(
        <MashSection
          recipe={recipe}
          mashPlan={mashPlan}
          mashProfiles={[]}
          fermentationProfiles={[]}
          onSelectMashProfile={vi.fn()}
          onSelectFermentationProfile={vi.fn()}
          config={DEFAULT_TEST_CONFIG}
        />,
      );
      expect(container.querySelectorAll('table').length).toBe(0);
    });
  });

  describe('M35_P3: Badge UI Primitive & Static Sweeps (AC-1, AC-16)', () => {
    it('AC-1: exports Badge component from ui/index.ts', () => {
      expect(typeof Badge).toBe('function');
    });

    it('AC-16: static sweep — all 10 migrated components import and use Badge', () => {
      const componentsDir = path.resolve(__dirname, '../src/components');
      const pagesDir = path.resolve(__dirname, '../src/pages');

      const filesToCheck = [
        path.join(pagesDir, 'BatchList.tsx'),
        path.join(pagesDir, 'BatchDetail.tsx'),
        path.join(componentsDir, 'CellarActionFeed.tsx'),
        path.join(componentsDir, 'InventoryManager.tsx'),
        path.join(componentsDir, 'WaterProfileManager.tsx'),
        path.join(componentsDir, 'BrewDayTracker.tsx'),
        path.join(componentsDir, 'RecipeImportModal.tsx'),
        path.join(componentsDir, 'SensoryEvaluationPanel.tsx'),
        path.join(componentsDir, 'SplitPackagingPanel.tsx'),
        path.join(componentsDir, 'WaterCalculatorModal.tsx'),
      ];

      for (const filePath of filesToCheck) {
        const content = fs.readFileSync(filePath, 'utf-8');
        expect(content).toMatch(/<Badge\b/);
      }
    });
  });

  describe('M36_P1 AC-17: Database Backup & Export card uses only components/ui/ primitives', () => {
    const COMPONENTS_DIR = path.resolve(__dirname, '../src/components');

    function backupCardSection(content: string): string {
      const start = content.indexOf('data-testid="settings-backup-section"');
      expect(start, 'settings-backup-section not found in SettingsManager.tsx').toBeGreaterThan(-1);
      // The card is the last section in the settings grid (M22_P1/M36_P1
      // ordering) — slicing to the closing `</div>\n          </div>\n        )}`
      // of the ready-state wrapper is brittle, so instead this takes a
      // generous fixed-size window from the testid forward, comfortably
      // larger than the card's own markup, and relies on the whole-file
      // sweep below to catch anything a narrower window might miss.
      return content.slice(start, start + 2000);
    }

    it('renders zero raw <button>, <select>, or text/number <input> elements inside the backup card', () => {
      const content = fs.readFileSync(path.join(COMPONENTS_DIR, 'SettingsManager.tsx'), 'utf-8');
      const cardMarkup = backupCardSection(content);
      const cleanCard = cardMarkup.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
      expect(cleanCard.match(/<button\b/g) || []).toEqual([]);
      expect(cleanCard.match(/<select\b/g) || []).toEqual([]);
      expect(cleanCard.match(/<input\b[^>]*type=["'](?:text|number)["']/g) || []).toEqual([]);
    });

    it('the export trigger is built from the Button primitive with the expected props', () => {
      const content = fs.readFileSync(path.join(COMPONENTS_DIR, 'SettingsManager.tsx'), 'utf-8');
      expect(content).toMatch(/import\s*\{[^}]*\bButton\b[^}]*\}\s*from\s*['"]\.\/ui['"]/);
      expect(content).toMatch(
        /<Button\s+variant="primary"\s+size="sm"[\s\S]*?data-testid="settings-export-backup-btn"/,
      );
    });

    it('zero raw buttons, selects, or text/number inputs across the whole of SettingsManager.tsx (whole-file regression, supersedes the M34_P5 AC-9..12 sweep)', () => {
      const content = fs.readFileSync(path.join(COMPONENTS_DIR, 'SettingsManager.tsx'), 'utf-8');
      const clean = content.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
      const buttons = clean.match(/<button\b/g) || [];
      const selects = clean.match(/<select\b/g) || [];
      const inputs = (clean.match(/<input\b[^>]*>/g) || []).filter((i) => !/type=["'](checkbox|radio|file|range)["']/.test(i));
      expect(buttons).toEqual([]);
      expect(selects).toEqual([]);
      expect(inputs).toEqual([]);
    });
  });

  describe('M35_P4 AC-10: consumers > 0 for all UI primitives', () => {
    it('every export in components/ui/index.ts has at least 1 consumer in apps/web/src outside components/ui/', () => {
      const srcDir = path.resolve(__dirname, '../src');
      function walk(dir: string): string[] {
        return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) return walk(full);
          if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) return [full];
          return [];
        });
      }

      const allSrcFiles = walk(srcDir);
      const allContents = allSrcFiles.map((file) => ({
        file,
        content: fs.readFileSync(file, 'utf-8'),
      }));

      const primitives = [
        'FormField',
        'Input',
        'NumberInput',
        'Select',
        'Button',
        'Table',
        'TableHeaderCell',
        'TableCell',
        'Badge',
      ];

      const unconsumed: string[] = [];

      for (const prim of primitives) {
        let count = 0;
        for (const { file, content } of allContents) {
          if (file.includes('components/ui/')) continue;
          const pattern = new RegExp(`\\b${prim}\\b`);
          if (pattern.test(content)) {
            count++;
          }
        }
        if (count === 0) {
          unconsumed.push(prim);
        }
      }

      expect(unconsumed).toEqual([]);
    });
  });

  describe('M36_P2 AC-19: BackupRestoreModal and the Settings restore dropzone use only components/ui/ primitives', () => {
    const COMPONENTS_DIR = path.resolve(__dirname, '../src/components');

    function rawControlsM36(content: string) {
      const clean = content.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
      const buttons = clean.match(/<button\b[^>]*>/g) || [];
      const selects = clean.match(/<select\b[^>]*>/g) || [];
      // The dropzone's own hidden <input type="file"> is RA-4's established
      // exemption (native file inputs are never abstracted by ui/) — same
      // precedent as the M22_P1 recipe-import dropzone's own file input.
      const inputs = (clean.match(/<input\b[^>]*>/g) || []).filter((el) => !/type=["']file["']/.test(el));
      return { buttons, selects, inputs };
    }

    it('zero raw buttons, selects, or non-file inputs in BackupRestoreModal.tsx', () => {
      const content = fs.readFileSync(path.join(COMPONENTS_DIR, 'BackupRestoreModal.tsx'), 'utf-8');
      const { buttons, selects, inputs } = rawControlsM36(content);
      expect(buttons).toEqual([]);
      expect(selects).toEqual([]);
      expect(inputs).toEqual([]);
      expect(content).toMatch(/import\s*\{[^}]*\bButton\b[^}]*\bBadge\b[^}]*\}\s*from\s*'\.\/ui'/);
    });

    it('SettingsManager.tsx still has zero raw buttons/selects/non-file text-inputs after the M36_P2 restore dropzone addition', () => {
      const content = fs.readFileSync(path.join(COMPONENTS_DIR, 'SettingsManager.tsx'), 'utf-8');
      const { buttons, selects, inputs } = rawControlsM36(content);
      expect(buttons).toEqual([]);
      expect(selects).toEqual([]);
      expect(inputs).toEqual([]);
      expect(content).toMatch(/import\s*\{\s*BackupRestoreModal\s*\}\s*from\s*'\.\/BackupRestoreModal'/);
    });
  });
});

describe('M38_P1 AC-20: Primitive Adherence — folder/tag controls in RecipeLibrary.tsx and App.tsx', () => {
  const COMPONENTS_DIR = path.resolve(__dirname, '../src/components');
  const APP_SRC_PATH = path.resolve(__dirname, '../src/App.tsx');

  function rawControlsM38(content: string) {
    const clean = content.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
    const buttons = clean.match(/<button\b/g) || [];
    const selects = clean.match(/<select\b/g) || [];
    const inputs = (clean.match(/<input\b[^>]*>/g) || []).filter((el) => !/type=["']file["']/.test(el));
    return { buttons, selects, inputs };
  }

  it('RecipeLibrary.tsx has zero raw buttons/selects/non-file inputs after the folder-tab/tag-filter addition (pre-existing AC-19 invariant still holds)', () => {
    const content = fs.readFileSync(path.join(COMPONENTS_DIR, 'RecipeLibrary.tsx'), 'utf-8');
    const { buttons, selects, inputs } = rawControlsM38(content);
    expect(buttons).toEqual([]);
    expect(selects).toEqual([]);
    expect(inputs).toEqual([]);
  });

  it('RecipeLibrary.tsx builds the folder tab strip and tag badges from Button/Badge', () => {
    const content = fs.readFileSync(path.join(COMPONENTS_DIR, 'RecipeLibrary.tsx'), 'utf-8');
    expect(content).toMatch(/import\s*\{[^}]*\bButton\b[^}]*\bInput\b[^}]*\bBadge\b[^}]*\}\s*from\s*'\.\/ui'/);
    expect(content).toMatch(/<Button[\s\S]*?data-testid=\{`folder-tab-/);
    expect(content).toMatch(/<Badge[\s\S]*?variant="neutral"[\s\S]*?size="xs"/);
  });

  it('App.tsx recipe editor header exposes Folder and Add-tag inputs built from the Input primitive, and tag chips from Badge', () => {
    const content = fs.readFileSync(APP_SRC_PATH, 'utf-8');
    expect(content).toMatch(/import\s*\{[^}]*\bInput\b[^}]*\bBadge\b[^}]*\}\s*from\s*'\.\/components\/ui'/);
    expect(content).toMatch(/<Input[\s\S]*?aria-label="Folder"/);
    expect(content).toMatch(/<Input[\s\S]*?aria-label="Add tag"/);
    expect(content).toMatch(/<Badge[\s\S]*?variant="neutral"[\s\S]*?size="xs"/);
  });
});

describe('M38_P3 AC-35: Primitive Adherence — StyleTargetPanel and the folder datalist', () => {
  const COMPONENTS_DIR = path.resolve(__dirname, '../src/components');
  const APP_SRC_PATH = path.resolve(__dirname, '../src/App.tsx');

  it('StyleTargetPanel.tsx itself contains no raw <select>/<input>/<button> (RA-P3-10) — the selector is a ui/Select', () => {
    const content = fs.readFileSync(path.join(COMPONENTS_DIR, 'StyleTargetPanel.tsx'), 'utf-8');
    const clean = content.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
    expect(clean.match(/<button\b/g) || []).toEqual([]);
    expect(clean.match(/<input\b/g) || []).toEqual([]);
    expect(clean.match(/<select\b/g) || []).toEqual([]);
    // The selector is wired through the ui/Select primitive.
    expect(content).toMatch(/import\s*\{[^}]*\bSelect\b[^}]*\}\s*from\s*'\.\/ui'/);
    expect(content).toMatch(/<Select\b/);
  });

  it('App.tsx wires the BJCP selector through StyleTargetPanel and folder suggestions via native <datalist>/<option> only (RA-P3-10)', () => {
    const content = fs.readFileSync(APP_SRC_PATH, 'utf-8');
    expect(content).toMatch(/import\s*\{[^}]*\bStyleTargetPanel\b[^}]*\}\s*from\s*'\.\/components\/StyleTargetPanel'/);
    expect(content).toMatch(/<StyleTargetPanel\b/);
    // Folder suggestions are native <datalist>/<option> suggestion elements —
    // exempt from the "no raw controls" sweep, and not ui primitives.
    expect(content).toMatch(/<datalist id="folder-suggestions"/);
    expect(content).toMatch(/<option value=\{name\} key=\{name\} \/>/);
  });

  it('StatsHeader.tsx is not modified to host the style target (RA-P3-3)', () => {
    const content = fs.readFileSync(path.join(COMPONENTS_DIR, 'StatsHeader.tsx'), 'utf-8');
    // StatsHeader keeps its display-only presentational contract — it receives
    // stats/equipment/config and renders no style selector or gauge.
    expect(content).not.toMatch(/StyleTargetPanel|bjcpStyleId|evaluateStyleMatch/);
  });
});







