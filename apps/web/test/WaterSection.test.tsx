import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import type { WaterProfile, MiscItem, FermentableItem } from '@truchabrew/shared-types';
import { WaterSection } from '../src/components/WaterSection';
import { WaterCalculatorModal } from '../src/components/WaterCalculatorModal';

const sourceProfile: WaterProfile = {
  id: 'wp-src-tap',
  name: 'Balanced Tap Water',
  type: 'source',
  calcium: 50,
  magnesium: 10,
  sodium: 20,
  chloride: 30,
  sulfate: 40,
  bicarbonate: 120,
  ph: 7.4,
  description: null,
};

const targetProfile: WaterProfile = {
  id: 'wp-tgt-hoppy',
  name: 'Light & Hoppy Profile',
  type: 'target',
  calcium: 100,
  magnesium: 15,
  sodium: 20,
  chloride: 50,
  sulfate: 200,
  bicarbonate: 50,
  ph: 6.5,
  description: null,
};

const sampleFermentables: FermentableItem[] = [
  { id: 'f-1', name: 'Pale Ale Malt (2-Row)', type: 'Grain', amountKg: 5.0, colorSrm: 3, potentialSg: 1.037 },
  { id: 'f-2', name: 'Caramel / Crystal 40L', type: 'Grain', amountKg: 0.5, colorSrm: 40, potentialSg: 1.034 },
];

describe('M21_P1 AC-1: Compact Recipe Water Summary Row in WaterSection', () => {
  it('renders water-summary-row with volume breakdown, profile chips, finished ions, and [CALC] button', () => {
    render(
      <WaterSection
        waterProfiles={[sourceProfile, targetProfile]}
        waterSourceId="wp-src-tap"
        waterTargetId="wp-tgt-hoppy"
        waterVolumeL={30}
        mashWaterL={18}
        spargeWaterL={12}
        spargeTempC={78}
        totalGrainKg={5.5}
        fermentables={sampleFermentables}
        miscs={[]}
        initialTargetPh={5.3}
        onSourceChange={vi.fn()}
        onTargetChange={vi.fn()}
        onMiscsUpdate={vi.fn()}
      />
    );

    const summaryRow = screen.getByTestId('water-summary-row');
    expect(summaryRow).toBeInTheDocument();

    expect(within(summaryRow).getByText('Water & Mash Volumes')).toBeInTheDocument();
    expect(within(summaryRow).getByText('Balanced Tap Water')).toBeInTheDocument();
    expect(within(summaryRow).getByText('Light & Hoppy Profile')).toBeInTheDocument();

    // Volume Tiles
    expect(within(summaryRow).getByText('Mash Water')).toBeInTheDocument();
    expect(within(summaryRow).getByText('18.0 L')).toBeInTheDocument();
    expect(within(summaryRow).getByText('Sparge Water')).toBeInTheDocument();
    expect(within(summaryRow).getByText('12.0 L')).toBeInTheDocument();
    expect(within(summaryRow).getByText('@78°C')).toBeInTheDocument();
    expect(within(summaryRow).getByText('Total Water')).toBeInTheDocument();
    expect(within(summaryRow).getByText('30.0 L')).toBeInTheDocument();

    // [CALC] Button
    const calcBtn = screen.getByTestId('open-water-calc-modal-btn');
    expect(calcBtn).toBeInTheDocument();
    expect(calcBtn).toHaveTextContent('CALC');
    expect(calcBtn).toHaveTextContent('pH');
  });
});

describe('M21_P1 AC-2..AC-10: WaterCalculatorModal Interactive Features', () => {
  it('AC-2: clicking open-water-calc-modal-btn opens WaterCalculatorModal', () => {
    render(
      <WaterSection
        waterProfiles={[sourceProfile, targetProfile]}
        waterSourceId="wp-src-tap"
        waterTargetId="wp-tgt-hoppy"
        waterVolumeL={30}
        mashWaterL={18}
        spargeWaterL={12}
        fermentables={sampleFermentables}
        miscs={[]}
        onSourceChange={vi.fn()}
        onTargetChange={vi.fn()}
        onMiscsUpdate={vi.fn()}
      />
    );

    expect(screen.queryByTestId('water-calc-modal')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('open-water-calc-modal-btn'));
    expect(screen.getByTestId('water-calc-modal')).toBeInTheDocument();
  });

  it('AC-3 & AC-4: modal header renders live predicted mash pH badge and grist DI baseline breakdown', () => {
    render(
      <WaterCalculatorModal
        isOpen={true}
        onClose={vi.fn()}
        waterProfiles={[sourceProfile, targetProfile]}
        waterSourceId="wp-src-tap"
        waterTargetId="wp-tgt-hoppy"
        waterVolumeL={30}
        mashWaterL={18}
        spargeWaterL={12}
        fermentables={sampleFermentables}
        miscs={[]}
        onSaveAdjustments={vi.fn()}
      />
    );

    const phBadge = screen.getByTestId('modal-predicted-mash-ph');
    expect(phBadge).toBeInTheDocument();
    expect(phBadge.textContent).toMatch(/Mash pH/);

    expect(screen.getByText('Grist Distilled Water pH Baseline')).toBeInTheDocument();
    expect(screen.getByText('Pale Ale Malt (2-Row)')).toBeInTheDocument();
    expect(screen.getByText('Caramel / Crystal 40L')).toBeInTheDocument();
  });

  it('AC-5 & AC-6: dilution slider updates source profile and target profile displays SO4/Cl ratio', () => {
    render(
      <WaterCalculatorModal
        isOpen={true}
        onClose={vi.fn()}
        waterProfiles={[sourceProfile, targetProfile]}
        waterSourceId="wp-src-tap"
        waterTargetId="wp-tgt-hoppy"
        waterVolumeL={30}
        mashWaterL={18}
        spargeWaterL={12}
        fermentables={sampleFermentables}
        miscs={[]}
        onSaveAdjustments={vi.fn()}
      />
    );

    expect(screen.getByLabelText('Source Profile')).toHaveValue('wp-src-tap');
    expect(screen.getByLabelText('Target Profile')).toHaveValue('wp-tgt-hoppy');
    // M37_P2: the SO4:Cl ratio now renders as a badge with the water-calc-so4-cl-ratio testid.
    expect(screen.getByTestId('water-calc-so4-cl-ratio')).toBeInTheDocument();
  });

  it('AC-7 & AC-8: clicking AUTO populates mineral salt additions to match target profile', () => {
    render(
      <WaterCalculatorModal
        isOpen={true}
        onClose={vi.fn()}
        waterProfiles={[sourceProfile, targetProfile]}
        waterSourceId="wp-src-tap"
        waterTargetId="wp-tgt-hoppy"
        waterVolumeL={30}
        mashWaterL={18}
        spargeWaterL={12}
        fermentables={sampleFermentables}
        miscs={[]}
        onSaveAdjustments={vi.fn()}
      />
    );

    const autoBtn = screen.getByTestId('water-calc-auto-dose-btn');
    expect(autoBtn).not.toBeDisabled();
    fireEvent.click(autoBtn);

    const mashGypsum = screen.getByLabelText('Mash Gypsum') as HTMLInputElement;
    expect(parseFloat(mashGypsum.value)).toBeGreaterThan(0);
  });

  it('AC-9 & AC-10: Save Adjustments to Recipe commits salts and acid to miscs with proper use and closes modal', () => {
    const onSaveAdjustments = vi.fn();
    const onClose = vi.fn();

    render(
      <WaterCalculatorModal
        isOpen={true}
        onClose={onClose}
        waterProfiles={[sourceProfile, targetProfile]}
        waterSourceId="wp-src-tap"
        waterTargetId="wp-tgt-hoppy"
        waterVolumeL={30}
        mashWaterL={18}
        spargeWaterL={12}
        fermentables={sampleFermentables}
        miscs={[{ id: 'm-fining-1', name: 'Whirlfloc', type: 'Fining', use: 'Boil', timeMinutes: 10, amount: 1, unit: 'each' }]}
        onSaveAdjustments={onSaveAdjustments}
      />
    );

    // Dose mash salt
    fireEvent.change(screen.getByLabelText('Mash Gypsum'), { target: { value: '4.5' } });
    // Dose sparge salt
    fireEvent.change(screen.getByLabelText('Sparge Calcium Chloride'), { target: { value: '2.0' } });
    // Dose mash acid
    fireEvent.change(screen.getByLabelText('Mash Acid Dosage'), { target: { value: '3.5' } });

    // Click Save
    const saveBtn = screen.getByTestId('water-calc-save-btn');
    fireEvent.click(saveBtn);

    expect(onSaveAdjustments).toHaveBeenCalledTimes(1);
    const result = onSaveAdjustments.mock.calls[0][0];
    expect(result.waterSourceId).toBe('wp-src-tap');
    expect(result.waterTargetId).toBe('wp-tgt-hoppy');

    // Preserved non-water misc
    expect(result.miscs.some((m: MiscItem) => m.name === 'Whirlfloc')).toBe(true);

    // Mash salt
    const mashSalt = result.miscs.find((m: MiscItem) => m.name === 'Gypsum' && m.use === 'Mash');
    expect(mashSalt).toBeDefined();
    expect(mashSalt.amount).toBe(4.5);

    // Sparge salt
    const spargeSalt = result.miscs.find((m: MiscItem) => m.name === 'Calcium Chloride' && m.use === 'Sparge');
    expect(spargeSalt).toBeDefined();
    expect(spargeSalt.amount).toBe(2.0);

    // Mash acid
    const mashAcid = result.miscs.find((m: MiscItem) => m.name === 'Lactic Acid 88%' && m.use === 'Mash');
    expect(mashAcid).toBeDefined();
    expect(mashAcid.amount).toBe(3.5);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('M37_P2 Amendment 1 AC-31: modal-through-section integration — AUTO-Optimize, fit score, SO4:Cl descriptor, all 6 ion tiles, single-source-of-truth SO4:Cl', () => {
    render(
      <WaterSection
        waterProfiles={[sourceProfile, targetProfile]}
        waterSourceId="wp-src-tap"
        waterTargetId="wp-tgt-hoppy"
        waterVolumeL={30}
        mashWaterL={18}
        spargeWaterL={12}
        fermentables={sampleFermentables}
        miscs={[]}
        onSourceChange={vi.fn()}
        onTargetChange={vi.fn()}
        onMiscsUpdate={vi.fn()}
      />
    );

    const descriptors = ['Very Bitter / Dry', 'Crisp / Hop-Forward', 'Balanced', 'Full / Malty / Soft'];

    // Single-source-of-truth check: WaterSection's own inline SO4:Cl readout
    // and the modal's badge must agree on the descriptor for the SAME water
    // (both currently derive from the same shared calculateSulfateToChlorideRatio
    // helper against the section's finishedIons, before any modal-local dosing).
    const summaryRow = screen.getByTestId('water-summary-row');
    const summaryText = summaryRow.textContent ?? '';
    expect(summaryText).toContain('SO₄²⁻:Cl⁻');
    const inlineDescriptor = descriptors.find((d) => summaryText.includes(d));
    expect(inlineDescriptor).toBeDefined();

    fireEvent.click(screen.getByTestId('open-water-calc-modal-btn'));
    expect(screen.getByTestId('water-calc-modal')).toBeInTheDocument();

    const modalRatioBadge = screen.getByTestId('water-calc-so4-cl-ratio');
    expect(modalRatioBadge.textContent).toContain(inlineDescriptor);

    // Run Auto-Optimize so salt amounts become non-zero.
    fireEvent.click(screen.getByTestId('water-calc-auto-dose-btn'));
    const mashGypsum = screen.getByLabelText('Mash Gypsum') as HTMLInputElement;
    expect(parseFloat(mashGypsum.value)).toBeGreaterThan(0);

    // Non-empty fit-score badge.
    const fitBadge = screen.getByTestId('water-calc-fit-score');
    expect(fitBadge).toBeInTheDocument();
    expect(fitBadge.textContent).toMatch(/Fit: \d+\.\d% \((Optimal|Good|Approx)\)/);

    // SO4:Cl badge still carries one of the 4 §1.2 descriptors.
    const postAutoRatioBadge = screen.getByTestId('water-calc-so4-cl-ratio');
    expect(descriptors.some((d) => postAutoRatioBadge.textContent?.includes(d))).toBe(true);

    // All 6 per-ion tiles present.
    for (const ion of ['calcium', 'magnesium', 'sodium', 'chloride', 'sulfate', 'bicarbonate']) {
      expect(screen.getByTestId(`water-calc-ion-${ion}`)).toBeInTheDocument();
    }
  });

  it('Reset button clears all salt and acid inputs back to zero', () => {
    render(
      <WaterCalculatorModal
        isOpen={true}
        onClose={vi.fn()}
        waterProfiles={[sourceProfile, targetProfile]}
        waterSourceId="wp-src-tap"
        waterTargetId="wp-tgt-hoppy"
        waterVolumeL={30}
        mashWaterL={18}
        spargeWaterL={12}
        fermentables={sampleFermentables}
        miscs={[]}
        onSaveAdjustments={vi.fn()}
      />
    );

    fireEvent.change(screen.getByLabelText('Mash Gypsum'), { target: { value: '5.0' } });
    expect((screen.getByLabelText('Mash Gypsum') as HTMLInputElement).value).toBe('5.0');

    fireEvent.click(screen.getByTestId('water-calc-reset-btn'));
    expect((screen.getByLabelText('Mash Gypsum') as HTMLInputElement).value).toBe('');
  });
});

describe('M37_P2 Amendment 4 (BUG-042): recipe mash pH excludes sparge acid (AC-47, AC-48)', () => {
  const baseProps = {
    waterProfiles: [sourceProfile, targetProfile],
    waterSourceId: 'wp-src-tap',
    waterTargetId: 'wp-tgt-hoppy',
    waterVolumeL: 30,
    mashWaterL: 18,
    spargeWaterL: 12,
    fermentables: sampleFermentables,
    onSourceChange: vi.fn(),
    onTargetChange: vi.fn(),
  };

  const waterAgent = (name: string, use: 'Mash' | 'Sparge', amount: number): MiscItem => ({
    id: `m-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${use}-${amount}`,
    name,
    type: 'WaterAgent',
    use,
    timeMinutes: 0,
    amount,
    unit: 'g',
  });

  it('AC-47: sparge acid (use: Sparge) is excluded from the recipe mash pH; mash acid alone drives it', () => {
    const common = [
      waterAgent('Gypsum', 'Mash', 4.5),
      waterAgent('Calcium Chloride', 'Sparge', 2.0),
      waterAgent('Lactic Acid 88%', 'Mash', 3.5),
    ];
    const withSpargeAcid = [...common, waterAgent('Lactic Acid 88%', 'Sparge', 2.1)];

    // With a sparge acid saved (post-Amendment-3 format), the mash pH must be
    // driven only by the mash acid -> 5.35 (was 5.20 pre-fix, sparge summed in).
    const { rerender } = render(<WaterSection {...baseProps} miscs={withSpargeAcid} onMiscsUpdate={vi.fn()} />);
    expect(screen.getByTestId('open-water-calc-modal-btn').textContent).toContain('pH 5.35');

    // Removing the sparge acid must not change the recipe mash pH.
    rerender(<WaterSection {...baseProps} miscs={common} onMiscsUpdate={vi.fn()} />);
    expect(screen.getByTestId('open-water-calc-modal-btn').textContent).toContain('pH 5.35');
  });

  it('AC-48: save from the modal (mash + sparge acid), then recipe liveMashPh equals the modal adjusted mash pH (5.35)', () => {
    const onSaveAdjustments = vi.fn();
    render(
      <WaterCalculatorModal
        isOpen={true}
        onClose={vi.fn()}
        waterProfiles={[sourceProfile, targetProfile]}
        waterSourceId="wp-src-tap"
        waterTargetId="wp-tgt-hoppy"
        waterVolumeL={30}
        mashWaterL={18}
        spargeWaterL={12}
        fermentables={sampleFermentables}
        miscs={[]}
        onSaveAdjustments={onSaveAdjustments}
      />
    );

    fireEvent.change(screen.getByLabelText('Mash Gypsum'), { target: { value: '4.5' } });
    fireEvent.change(screen.getByLabelText('Sparge Calcium Chloride'), { target: { value: '2.0' } });
    fireEvent.change(screen.getByLabelText('Mash Acid Dosage'), { target: { value: '3.5' } });
    fireEvent.change(screen.getByLabelText('Sparge Acid Dosage'), { target: { value: '2.1' } });
    fireEvent.click(screen.getByTestId('water-calc-save-btn'));

    expect(onSaveAdjustments).toHaveBeenCalledTimes(1);
    const saved = onSaveAdjustments.mock.calls[0][0];

    // Sanity: the Amendment-3 save format keeps sparge acid as plain name + use: 'Sparge'.
    const spargeAcid = saved.miscs.find((m: MiscItem) => m.name === 'Lactic Acid 88%' && m.use === 'Sparge');
    expect(spargeAcid).toBeDefined();
    expect(spargeAcid.amount).toBe(2.1);

    // Cross-surface: render the recipe-side summary with the exact saved miscs
    // and assert its liveMashPh equals the modal's adjusted mash pH.
    render(
      <WaterSection
        waterProfiles={[sourceProfile, targetProfile]}
        waterSourceId="wp-src-tap"
        waterTargetId="wp-tgt-hoppy"
        waterVolumeL={30}
        mashWaterL={18}
        spargeWaterL={12}
        fermentables={sampleFermentables}
        miscs={saved.miscs}
        onSourceChange={vi.fn()}
        onTargetChange={vi.fn()}
        onMiscsUpdate={vi.fn()}
      />
    );
    expect(screen.getByTestId('open-water-calc-modal-btn').textContent).toContain('pH 5.35');
  });
});
