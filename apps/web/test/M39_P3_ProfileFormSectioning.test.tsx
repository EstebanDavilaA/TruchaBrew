import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import type { WaterProfile } from '@truchabrew/shared-types';
import { WaterProfileForm } from '../src/components/WaterProfileForm';
import { MashProfileForm } from '../src/components/MashProfileForm';
import { FermentationProfileForm } from '../src/components/FermentationProfileForm';
import { baseMashProfile, baseFermentationProfile } from './helpers/fixtures';

vi.mock('../src/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/api/client')>();
  return {
    ...actual,
    createWaterProfile: vi.fn(),
    updateWaterProfile: vi.fn(),
    createMashProfile: vi.fn(),
    updateMashProfile: vi.fn(),
    createFermentationProfile: vi.fn(),
    updateFermentationProfile: vi.fn(),
  };
});

import {
  createWaterProfile,
  createMashProfile,
  createFermentationProfile,
} from '../src/api/client';

const mockCreateWater = vi.mocked(createWaterProfile);
const mockCreateMash = vi.mocked(createMashProfile);
const mockCreateFermentation = vi.mocked(createFermentationProfile);

// ---- Binding section taxonomy (spec §0) -------------------------------------
const WATER = {
  'water-profile-information': 'Profile Information',
  'water-ion-concentrations': 'Ion Concentrations & pH',
};
const MASH = {
  'mash-profile-details': 'Profile Details',
  'mash-steps': 'Mash Steps',
};
const FERM = {
  'fermentation-profile-details': 'Profile Details',
  'fermentation-steps': 'Fermentation Steps',
};

// ---- Bound caption copy (spec §1) -------------------------------------------
const CAPTIONS = {
  waterCa: 'Calcium supports yeast health and mash enzyme activity — typical target 40–120 ppm.',
  waterCl: 'Chloride rounds the body and enhances malt sweetness; a higher Cl:SO₄ ratio softens hop bite.',
  waterSo4: 'Sulfate dries the finish and accentuates hop bitterness; a higher SO₄:Cl ratio sharpens hops.',
  waterPh: 'Leave blank to inherit; for a balanced mash aim near pH 5.2–5.6.',
  mashPh: 'Typical mash target 5.2–5.6 at room temperature for clean conversion.',
  mashSparge: "Blank means inherit the equipment profile's sparge temperature.",
  mashInfuse: 'Blank = computed',
  fermPressure: 'Blank = not pressurised',
};

const noopDeleteAction = { onConfirm: () => {}, blockedReason: null, busy: false, error: null };

const waterDummy: WaterProfile = {
  id: 'wp-1', name: 'Balanced', type: 'source', calcium: 50, magnesium: 10, sodium: 15,
  chloride: 60, sulfate: 75, bicarbonate: 100, ph: 7.2, description: 'notes',
};

beforeEach(() => {
  mockCreateWater.mockReset();
  mockCreateMash.mockReset();
  mockCreateFermentation.mockReset();
});

function renderWater() {
  return render(<WaterProfileForm mode="create" onSaved={vi.fn()} onCancel={vi.fn()} />);
}
function renderMash() {
  return render(<MashProfileForm mode="create" onSaved={vi.fn()} onCancel={vi.fn()} />);
}
function renderFerm() {
  return render(<FermentationProfileForm mode="create" onSaved={vi.fn()} onCancel={vi.fn()} />);
}

function assertSectionContract(id: string, title: string) {
  // AC-7: non-collapsible — no {id}-toggle, {id}-title present
  expect(screen.queryByTestId(`${id}-toggle`)).toBeNull();
  const heading = screen.getByTestId(`${id}-title`);
  // AC-8: title is an h2
  expect(heading.tagName).toBe('H2');
  expect(heading).toHaveTextContent(title);
  // AC-9: panel always mounted + root section carries the DOM id
  expect(screen.getByTestId(`${id}-section`)).toBeInTheDocument();
  expect(screen.getByTestId(`${id}-section`).id).toBe(id);
  expect(screen.getByTestId(`${id}-panel`)).toBeInTheDocument();
}

// ---- AC-1..AC-2: Water sectioning --------------------------------------------
describe('WaterProfileForm — AC-1/AC-2: two SectionCards', () => {
  it('renders both root ids with DOM id == data id', () => {
    renderWater();
    for (const id of Object.keys(WATER)) {
      const section = screen.getByTestId(`${id}-section`);
      expect(section.tagName).toBe('SECTION');
      expect(section.id).toBe(id);
    }
  });

  it('renders both titled SectionCards with accessible names', () => {
    renderWater();
    expect(screen.getByTestId('water-profile-information-title')).toHaveTextContent('Profile Information');
    expect(screen.getByTestId('water-ion-concentrations-title')).toHaveTextContent('Ion Concentrations & pH');
  });
});

// ---- AC-3..AC-4: Mash sectioning ---------------------------------------------
describe('MashProfileForm — AC-3/AC-4: two SectionCards', () => {
  it('renders both root ids + titles', () => {
    renderMash();
    assertSectionContract('mash-profile-details', 'Profile Details');
    assertSectionContract('mash-steps', 'Mash Steps');
  });
});

// ---- AC-5..AC-6: Fermentation sectioning -------------------------------------
describe('FermentationProfileForm — AC-5/AC-6: two SectionCards', () => {
  it('renders both root ids + titles', () => {
    renderFerm();
    assertSectionContract('fermentation-profile-details', 'Profile Details');
    assertSectionContract('fermentation-steps', 'Fermentation Steps');
  });
});

// ---- AC-7..AC-9 across all six (Water covered here too for completeness) -----
describe('AC-7/AC-8/AC-9: all six non-collapsible, h2, always-mounted', () => {
  it('Water sections', () => {
    renderWater();
    assertSectionContract('water-profile-information', 'Profile Information');
    assertSectionContract('water-ion-concentrations', 'Ion Concentrations & pH');
  });
  it('Mash sections', () => {
    renderMash();
    assertSectionContract('mash-profile-details', 'Profile Details');
    assertSectionContract('mash-steps', 'Mash Steps');
  });
  it('Fermentation sections', () => {
    renderFerm();
    assertSectionContract('fermentation-profile-details', 'Profile Details');
    assertSectionContract('fermentation-steps', 'Fermentation Steps');
  });
});

// ---- AC-10..AC-12: field testids preserved & functional ----------------------
describe('AC-10..AC-12: field/step testids preserved & functional', () => {
  it('AC-10: Water field testids present and name edit reflects', () => {
    renderWater();
    for (const id of ['water-form-name', 'water-form-type', 'water-form-ca', 'water-form-cl', 'water-form-so4', 'water-form-ph', 'water-form-strategy', 'water-form-apply-strategy']) {
      expect(screen.getByTestId(id)).toBeInTheDocument();
    }
    fireEvent.change(screen.getByTestId('water-form-name'), { target: { value: 'My Water' } });
    expect((screen.getByTestId('water-form-name') as HTMLInputElement).value).toBe('My Water');
  });

  it('AC-11: Mash name/ph/sparge present; Add Step => mash-step-row-0', () => {
    renderMash();
    expect(screen.getByTestId('mash-field-name')).toBeInTheDocument();
    expect(screen.getByTestId('mash-field-ph')).toBeInTheDocument();
    expect(screen.getByTestId('mash-field-sparge')).toBeInTheDocument();
    expect(screen.queryByTestId('mash-step-row-0')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /add step/i }));
    expect(screen.getByTestId('mash-step-row-0')).toBeInTheDocument();
  });

  it('AC-12: Fermentation name by label; Add Step => ferm-step-row-0', () => {
    renderFerm();
    expect(screen.getByLabelText(/profile name/i)).toBeInTheDocument();
    expect(screen.queryByTestId('ferm-step-row-0')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /add step/i }));
    expect(screen.getByTestId('ferm-step-row-0')).toBeInTheDocument();
  });
});

// ---- AC-14: sibling cards under same form + space-y-6 ------------------------
describe('AC-14: sibling SectionCards under one form with space-y-6', () => {
  const cases: Array<[string, () => ReturnType<typeof render>, string, string]> = [
    ['water', renderWater, 'water-profile-information', 'water-ion-concentrations'],
    ['mash', renderMash, 'mash-profile-details', 'mash-steps'],
    ['fermentation', renderFerm, 'fermentation-profile-details', 'fermentation-steps'],
  ];
  for (const [label, renderForm, idA, idB] of cases) {
    it(`${label} form`, () => {
      renderForm();
      const a = screen.getByTestId(`${idA}-section`);
      const b = screen.getByTestId(`${idB}-section`);
      const form = a.closest('form')!;
      expect(form).not.toBeNull();
      expect(b.closest('form')).toBe(form);
      expect(a.parentElement).toBe(form);
      expect(b.parentElement).toBe(form);
      expect(form.className).toContain('space-y-6');
    });
  }
});

// ---- AC-15: empty-state + 20-step cap retention ------------------------------
describe('AC-15: empty-state + cap retention', () => {
  it('Mash: empty-state inside steps card; cap at 20 rows, Add disabled at 20', () => {
    renderMash();
    const stepsPanel = screen.getByTestId('mash-steps-panel');
    expect(within(stepsPanel).getByText(/no steps yet/i)).toBeInTheDocument();
    const addBtn = within(stepsPanel).getByRole('button', { name: /add step/i });
    for (let i = 0; i < 20; i++) fireEvent.click(addBtn);
    expect(screen.getByTestId('mash-step-row-19')).toBeInTheDocument();
    expect(screen.queryByTestId('mash-step-row-20')).toBeNull();
    expect(addBtn).toBeDisabled();
  });

  it('Fermentation: empty-state inside steps card; cap at 20 rows, Add disabled at 20', () => {
    renderFerm();
    const stepsPanel = screen.getByTestId('fermentation-steps-panel');
    expect(within(stepsPanel).getByText(/no steps yet/i)).toBeInTheDocument();
    const addBtn = within(stepsPanel).getByRole('button', { name: /add step/i });
    for (let i = 0; i < 20; i++) fireEvent.click(addBtn);
    expect(screen.getByTestId('ferm-step-row-19')).toBeInTheDocument();
    expect(screen.queryByTestId('ferm-step-row-20')).toBeNull();
    expect(addBtn).toBeDisabled();
  });

  it('Mash edit-mode with >20 steps surfaces the cap warning + live badge', () => {
    const existing = baseMashProfile({
      id: 'mash-over',
      steps: Array.from({ length: 21 }, (_, i) => ({
        id: `s-${i}`, name: `Step ${i}`, type: 'Infusion' as const, stepTempC: 67,
        stepTimeMin: 60, rampTimeMin: 0, infuseAmountL: null, infuseWaterTempC: 100,
      })),
    });
    render(
      <MashProfileForm mode="edit" initialProfile={existing} onSaved={vi.fn()} onCancel={vi.fn()} deleteAction={noopDeleteAction} />,
    );
    expect(screen.getByText('A profile may have at most 20 steps.')).toBeInTheDocument();
    expect(screen.getByTestId('mash-steps-title')).toHaveTextContent('21 steps');
    expect(screen.getByTestId('mash-step-row-20')).toBeInTheDocument();
  });
});

// ---- AC-16..AC-20: bound captions exact --------------------------------------
describe('AC-16..AC-20: bound caption copy is verbatim', () => {
  it('AC-16: Water Calcium caption', () => {
    renderWater();
    expect(screen.getByText(CAPTIONS.waterCa)).toBeInTheDocument();
  });
  it('AC-17: Water Chloride caption', () => {
    renderWater();
    expect(screen.getByText(CAPTIONS.waterCl)).toBeInTheDocument();
  });
  it('AC-18: Water Sulfate caption', () => {
    renderWater();
    expect(screen.getByText(CAPTIONS.waterSo4)).toBeInTheDocument();
  });
  it('AC-19: Water pH caption', () => {
    renderWater();
    expect(screen.getByText(CAPTIONS.waterPh)).toBeInTheDocument();
  });
  it('AC-20: Mash Target pH caption', () => {
    renderMash();
    expect(screen.getByText(CAPTIONS.mashPh)).toBeInTheDocument();
  });
});

// ---- AC-21: pre-existing hints preserved byte-identical ----------------------
describe('AC-21: pre-existing hints preserved', () => {
  it('Mash sparge + infuse hints still render', () => {
    renderMash();
    expect(screen.getByText(CAPTIONS.mashSparge)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /add step/i }));
    expect(screen.getByText(CAPTIONS.mashInfuse)).toBeInTheDocument();
  });
  it('Fermentation pressure hint still renders', () => {
    renderFerm();
    fireEvent.click(screen.getByRole('button', { name: /add step/i }));
    expect(screen.getByText(CAPTIONS.fermPressure)).toBeInTheDocument();
  });
});

// ---- AC-22: hint is a metadata-styled span, suppressed on error --------------
describe('AC-22: hint caption semantics', () => {
  it('Mash Target pH hint is a METADATA_TEXT_CLASS span and is suppressed on error', () => {
    renderMash();
    const hintEl = screen.getByText(CAPTIONS.mashPh);
    expect(hintEl.tagName).toBe('SPAN');
    expect(hintEl.className).toContain('text-slate-400');
    // invalid target pH (must be 3..9) shows the error and removes the hint
    fireEvent.change(screen.getByLabelText(/target ph/i), { target: { value: '20' } });
    expect(screen.getByText(/must be 9 or less/i)).toBeInTheDocument();
    expect(screen.queryByText(CAPTIONS.mashPh)).toBeNull();
  });
});

// ---- AC-23: no jump-nav / no scroll-spy --------------------------------------
describe('AC-23: no jump-nav rendered', () => {
  it('none of the three forms render a jump-nav', () => {
    renderWater();
    expect(screen.queryByTestId('jump-nav')).toBeNull();
  });
  it('Mash renders no jump-nav', () => {
    renderMash();
    expect(screen.queryByTestId('jump-nav')).toBeNull();
  });
  it('Fermentation renders no jump-nav', () => {
    renderFerm();
    expect(screen.queryByTestId('jump-nav')).toBeNull();
  });
});

// ---- AC-28: clean heading outline --------------------------------------------
describe('AC-28: clean heading outline per form', () => {
  it('Water: one h1 (TopBar) + two h2; no headings inside section bodies', () => {
    renderWater();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(2);
    for (const id of Object.keys(WATER)) {
      expect(screen.getByTestId(`${id}-panel`).querySelector('h1,h2,h3,h4,h5,h6')).toBeNull();
    }
  });
  it('Mash: one h1 (TopBar) + two h2; no headings inside section bodies', () => {
    renderMash();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(2);
    for (const id of Object.keys(MASH)) {
      expect(screen.getByTestId(`${id}-panel`).querySelector('h1,h2,h3,h4,h5,h6')).toBeNull();
    }
  });
  it('Fermentation: one h1 (TopBar) + two h2; no headings inside section bodies', () => {
    renderFerm();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(2);
    for (const id of Object.keys(FERM)) {
      expect(screen.getByTestId(`${id}-panel`).querySelector('h1,h2,h3,h4,h5,h6')).toBeNull();
    }
  });
});

// ---- Step-count badge (stateful, derived) ------------------------------------
describe('Step-count SectionCard badge', () => {
  it('Mash badge shows "0 steps", then "1 step" after adding a step', () => {
    renderMash();
    expect(screen.getByTestId('mash-steps-title')).toHaveTextContent('0 steps');
    fireEvent.click(screen.getByRole('button', { name: /add step/i }));
    expect(screen.getByTestId('mash-steps-title')).toHaveTextContent('1 step');
  });
  it('Fermentation badge shows "0 steps", then "1 step"', () => {
    renderFerm();
    expect(screen.getByTestId('fermentation-steps-title')).toHaveTextContent('0 steps');
    fireEvent.click(screen.getByRole('button', { name: /add step/i }));
    expect(screen.getByTestId('fermentation-steps-title')).toHaveTextContent('1 step');
  });
});

// ---- AC-33: field a11y labels preserved --------------------------------------
describe('AC-33: every control resolves to a non-empty accessible name', () => {
  function assertA11y(container: HTMLElement) {
    const controls = container.querySelectorAll('input, select, textarea');
    expect(controls.length).toBeGreaterThan(0);
    controls.forEach((el) => {
      const hasAriaLabel = (el.getAttribute('aria-label') ?? '').trim() !== '';
      const hasLabels = (el as HTMLInputElement).labels && (el as HTMLInputElement).labels!.length > 0;
      expect(hasAriaLabel || hasLabels).toBe(true);
    });
  }
  it('Water', () => {
    const { container } = renderWater();
    assertA11y(container);
  });
  it('Mash (with a step row)', () => {
    const { container } = renderMash();
    fireEvent.click(screen.getByRole('button', { name: /add step/i }));
    assertA11y(container);
  });
  it('Fermentation (with a step row)', () => {
    const { container } = renderFerm();
    fireEvent.click(screen.getByRole('button', { name: /add step/i }));
    assertA11y(container);
  });
});

// ---- AC-34: no control loss on sectioning ------------------------------------
describe('AC-34: control counts match baseline (no control dropped)', () => {
  it('Water create: 11 controls', () => {
    const { container } = renderWater();
    expect(container.querySelectorAll('input, select, textarea').length).toBe(11);
  });
  it('Mash create: 3 + 7/step (17 with 2 steps)', () => {
    const { container } = renderMash();
    const addBtn = screen.getByRole('button', { name: /add step/i });
    fireEvent.click(addBtn);
    fireEvent.click(addBtn);
    expect(container.querySelectorAll('input, select, textarea').length).toBe(3 + 2 * 7);
  });
  it('Fermentation create: 1 + 6/step (13 with 2 steps)', () => {
    const { container } = renderFerm();
    const addBtn = screen.getByRole('button', { name: /add step/i });
    fireEvent.click(addBtn);
    fireEvent.click(addBtn);
    expect(container.querySelectorAll('input, select, textarea').length).toBe(1 + 2 * 6);
  });
});

// ---- Save round-trip smoke (guards AC-30/31/32 intent end-to-end) -------------
describe('create-save round-trips through the sectioned forms', () => {
  it('Water: saving calls createWaterProfile', async () => {
    mockCreateWater.mockResolvedValueOnce(waterDummy);
    const onSaved = vi.fn();
    render(<WaterProfileForm mode="create" onSaved={onSaved} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByTestId('water-form-name'), { target: { value: 'Balanced' } });
    fireEvent.click(screen.getByRole('button', { name: /save profile/i }));
    await waitFor(() => expect(mockCreateWater).toHaveBeenCalledTimes(1));
    expect(onSaved).toHaveBeenCalledWith(waterDummy);
  });
  it('Mash: saving calls createMashProfile', async () => {
    const existing = baseMashProfile({ id: 'new-mash' });
    mockCreateMash.mockResolvedValueOnce(existing);
    const onSaved = vi.fn();
    render(<MashProfileForm mode="create" onSaved={onSaved} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/profile name/i), { target: { value: 'Mash A' } });
    fireEvent.click(screen.getByRole('button', { name: /save profile/i }));
    await waitFor(() => expect(mockCreateMash).toHaveBeenCalledTimes(1));
    expect(onSaved).toHaveBeenCalledWith(existing);
  });
  it('Fermentation: saving calls createFermentationProfile', async () => {
    const existing = baseFermentationProfile({ id: 'new-ferm' });
    mockCreateFermentation.mockResolvedValueOnce(existing);
    const onSaved = vi.fn();
    render(<FermentationProfileForm mode="create" onSaved={onSaved} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/profile name/i), { target: { value: 'Ferm A' } });
    fireEvent.click(screen.getByRole('button', { name: /save profile/i }));
    await waitFor(() => expect(mockCreateFermentation).toHaveBeenCalledTimes(1));
    expect(onSaved).toHaveBeenCalledWith(existing);
  });
});
