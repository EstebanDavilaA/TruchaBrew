import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { EquipmentProfile } from '@truchabrew/shared-types';
import { EquipmentForm } from '../src/components/EquipmentForm';

vi.mock('../src/api/client', () => ({
  createEquipmentProfile: vi.fn(),
  updateEquipmentProfile: vi.fn(),
  ApiClientError: class extends Error {},
}));

import { createEquipmentProfile, updateEquipmentProfile } from '../src/api/client';

const mockCreate = vi.mocked(createEquipmentProfile);
const mockUpdate = vi.mocked(updateEquipmentProfile);

const baseProfile: EquipmentProfile = {
  id: 'eq-1',
  name: 'Test Kit',
  batchSizeL: 20,
  boilTimeMin: 60,
  brewhouseEfficiencyPct: 75,
  mashEfficiencyPct: 80,
  boilOffRateLPerHour: 3.5,
  trubChillerLossL: 2.0,
  hopUtilizationPct: 87,
  derivedFromEquipmentId: null,
  mashWaterRatioLPerKg: 3.0,
  grainAbsorptionLPerKg: 0.96,
  hopstandUtilizationFactor: 0.26,
  hopstandTemperatureC: 79.0,
  spargeTemperatureC: 76.0,
  mashTunHeatCapacityL: 0.0,
  grainTemperatureC: 20.0,
  notes: '',
  altitudeMeters: 500,
  calcStrikeWithThermalMass: false,
  mashTunDeadSpaceL: 1.5,
  kettleLossL: 2.0,
  mashTunWeightKg: 10,
  mashTunHeatCapacity: 0.12,
};

describe('EquipmentForm (Physics & Loss Controls — AC-5..AC-9)', () => {
  beforeEach(() => {
    mockCreate.mockReset();
    mockUpdate.mockReset();
  });

  it('AC-5: renders Altitude input and displays live calculated boiling point', () => {
    render(
      <EquipmentForm
        mode="create"
        onSaved={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    const altitudeInput = screen.getByTestId('equipment-field-altitudeMeters');
    expect(altitudeInput).toBeInTheDocument();

    // Change altitude to 1500m (Boiling point ~ 94.975°C -> 95.0°C)
    fireEvent.change(altitudeInput, { target: { value: '1500' } });

    const preview = screen.getByTestId('altitude-physics-preview');
    expect(preview).toHaveTextContent(/Boiling Point:\s*95\.0°C/i);
  });

  it('AC-6: renders Thermal Mass toggle, revealing vessel weight and heat capacity inputs when enabled', () => {
    render(
      <EquipmentForm
        mode="create"
        onSaved={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    const toggle = screen.getByTestId('equipment-field-calcStrikeWithThermalMass');
    expect(toggle).not.toBeChecked();
    expect(screen.queryByTestId('equipment-field-mashTunWeightKg')).not.toBeInTheDocument();

    fireEvent.click(toggle);
    expect(toggle).toBeChecked();
    expect(screen.getByTestId('equipment-field-mashTunWeightKg')).toBeInTheDocument();
    expect(screen.getByTestId('equipment-field-mashTunHeatCapacity')).toBeInTheDocument();
  });

  it('AC-7: live strike temperature updates when thermal mass toggle is toggled', () => {
    render(
      <EquipmentForm
        mode="create"
        onSaved={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    const initialStrikeText = screen.getByTestId('strike-temp-preview-value').textContent;
    const initialTemp = parseFloat(initialStrikeText!);

    // Enable thermal mass with 15kg tun weight
    const toggle = screen.getByTestId('equipment-field-calcStrikeWithThermalMass');
    fireEvent.click(toggle);

    const weightInput = screen.getByTestId('equipment-field-mashTunWeightKg');
    fireEvent.change(weightInput, { target: { value: '15' } });

    const updatedStrikeText = screen.getByTestId('strike-temp-preview-value').textContent;
    const updatedTemp = parseFloat(updatedStrikeText!);
    expect(updatedTemp).toBeGreaterThan(initialTemp);
  });

  it('AC-8: enzyme safety warning banner appears when strike temperature exceeds 78.0°C', () => {
    render(
      <EquipmentForm
        mode="create"
        onSaved={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    // Set grain temperature very low (e.g. -10°C) and heavy vessel thermal mass to drive strike temp > 78°C
    const grainTempInput = screen.getByTestId('equipment-field-grainTemperatureC');
    fireEvent.change(grainTempInput, { target: { value: '-10' } });

    const toggle = screen.getByTestId('equipment-field-calcStrikeWithThermalMass');
    fireEvent.click(toggle);

    const weightInput = screen.getByTestId('equipment-field-mashTunWeightKg');
    fireEvent.change(weightInput, { target: { value: '50' } });

    expect(screen.getByTestId('equipment-strike-enzyme-warning')).toBeInTheDocument();
    expect(screen.getByText(/exceeds 78\.0°C/i)).toBeInTheDocument();
  });

  it('AC-9: renders inputs for mashTunDeadSpaceL and kettleLossL and includes them in payload', async () => {
    mockUpdate.mockResolvedValueOnce({ ...baseProfile, mashTunDeadSpaceL: 2.5, kettleLossL: 1.8 });

    render(
      <EquipmentForm
        mode="edit"
        initialProfile={baseProfile}
        onSaved={vi.fn()}
        onCancel={vi.fn()}
        deleteAction={{
          onConfirm: vi.fn(),
          blockedReason: null,
          busy: false,
          error: null,
        }}
      />
    );

    const deadSpaceInput = screen.getByTestId('equipment-field-mashTunDeadSpaceL');
    const kettleLossInput = screen.getByTestId('equipment-field-kettleLossL');

    expect(deadSpaceInput).toHaveValue(1.5);
    expect(kettleLossInput).toHaveValue(2);

    fireEvent.change(deadSpaceInput, { target: { value: '2.5' } });
    fireEvent.change(kettleLossInput, { target: { value: '1.8' } });

    fireEvent.click(screen.getByRole('button', { name: /Save Profile/ }));

    expect(mockUpdate).toHaveBeenCalledWith(
      'eq-1',
      expect.objectContaining({
        mashTunDeadSpaceL: 2.5,
        kettleLossL: 1.8,
      }),
    );
  });
});

describe('AC-16 (M26_P1 Amendment 1): EquipmentForm forwards onOpenMobileNav to its TopBar', () => {
  it('passing onOpenMobileNav renders the hamburger and clicking it calls the callback (create mode)', () => {
    const onOpenMobileNav = vi.fn();
    render(<EquipmentForm mode="create" onSaved={vi.fn()} onCancel={vi.fn()} onOpenMobileNav={onOpenMobileNav} />);
    const btn = screen.getByRole('button', { name: 'Open navigation menu' });
    fireEvent.click(btn);
    expect(onOpenMobileNav).toHaveBeenCalledTimes(1);
  });

  it('omitting onOpenMobileNav renders no hamburger button (create mode)', () => {
    render(<EquipmentForm mode="create" onSaved={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Open navigation menu' })).toBeNull();
  });

  it('passing onOpenMobileNav renders the hamburger in edit mode too', () => {
    const onOpenMobileNav = vi.fn();
    render(
      <EquipmentForm
        mode="edit"
        initialProfile={baseProfile}
        onSaved={vi.fn()}
        onCancel={vi.fn()}
        deleteAction={{ onConfirm: () => {}, blockedReason: null, busy: false, error: null }}
        onOpenMobileNav={onOpenMobileNav}
      />,
    );
    const btn = screen.getByRole('button', { name: 'Open navigation menu' });
    fireEvent.click(btn);
    expect(onOpenMobileNav).toHaveBeenCalledTimes(1);
  });
});

describe('M31_P4: EquipmentForm milestone-closing accessibility assertions', () => {
  it('AC-3: the thermal-mass checkbox has id="equipment-calc-strike-thermal-mass" with a matching wrapping label htmlFor, and resolves via getByLabelText', () => {
    render(<EquipmentForm mode="create" onSaved={vi.fn()} onCancel={vi.fn()} />);

    const checkbox = screen.getByTestId('equipment-field-calcStrikeWithThermalMass');
    expect(checkbox).toHaveAttribute('id', 'equipment-calc-strike-thermal-mass');
    const wrappingLabel = checkbox.closest('label');
    expect(wrappingLabel).toHaveAttribute('for', 'equipment-calc-strike-thermal-mass');
    expect(screen.getByLabelText(/Calculate Strike with Vessel Thermal Mass/)).toBe(checkbox);
  });

  it('AC-4: toggling the checkbox still flips calcStrikeWithThermalMass and data-testid is unchanged', () => {
    render(<EquipmentForm mode="create" onSaved={vi.fn()} onCancel={vi.fn()} />);

    const checkbox = screen.getByTestId('equipment-field-calcStrikeWithThermalMass');
    expect(checkbox).not.toBeChecked();
    expect(screen.queryByTestId('equipment-field-mashTunWeightKg')).not.toBeInTheDocument();

    fireEvent.click(checkbox);

    expect(checkbox).toBeChecked();
    expect(screen.getByTestId('equipment-field-calcStrikeWithThermalMass')).toBe(checkbox);
    expect(screen.getByTestId('equipment-field-mashTunWeightKg')).toBeInTheDocument();
  });

  it('AC-5: the altitude derivation note adopts METADATA_TEXT_CLASS and text-[11px] is gone', () => {
    const { container } = render(<EquipmentForm mode="create" onSaved={vi.fn()} onCancel={vi.fn()} />);

    const note = screen.getByText(/At higher elevations, water boils below 100°C/i);
    expect(note.className).toContain('text-xs text-slate-400');
    expect(container.innerHTML).not.toContain('text-[11px]');
  });

  it('AC-11: every input/select/textarea in the form resolves to a non-empty accessible name', () => {
    const { container } = render(<EquipmentForm mode="create" onSaved={vi.fn()} onCancel={vi.fn()} />);

    const controls = container.querySelectorAll('input, select, textarea');
    expect(controls.length).toBeGreaterThan(0);
    controls.forEach((el) => {
      const hasAriaLabel = (el.getAttribute('aria-label') ?? '').trim() !== '';
      const hasLabels = (el as HTMLInputElement).labels && (el as HTMLInputElement).labels!.length > 0;
      expect(hasAriaLabel || hasLabels).toBe(true);
    });
  });

  it('AC-12: clicking the thermal-mass checkbox label focuses the checkbox', () => {
    render(<EquipmentForm mode="create" onSaved={vi.fn()} onCancel={vi.fn()} />);

    const checkbox = screen.getByTestId('equipment-field-calcStrikeWithThermalMass');
    const label = checkbox.closest('label')!;
    fireEvent.click(label);
    // jsdom does not implement the browser's built-in <label> "activation
    // behaviour" of delegating a click through to its associated control
    // (https://github.com/jsdom/jsdom/issues/3117) -- fireEvent.click() alone
    // never moves focus here even when for/id association is correct. We
    // replicate that native delegation via the label's own `.control`
    // lookup, the same workaround M31_P3 AC-9/AC-24 established.
    (label as HTMLLabelElement).control?.focus();
    expect(document.activeElement).toBe(checkbox);
  });
});

describe('M31_P1: FormField label association and UI Primitives adoption in EquipmentForm', () => {
  it('AC-6 & AC-7: every control is accessible via getByLabelText', () => {
    render(<EquipmentForm mode="create" onSaved={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByLabelText(/profile name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/batch size/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/boil time/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/brewhouse efficiency/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/mash efficiency/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/boil-off rate/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/trub \/ chiller loss/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/hop utilisation/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/mash water ratio/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/grain absorption/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/hopstand utilisation factor/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/hopstand temperature/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/sparge temperature/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/mash tun heat capacity/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/grain temperature/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/altitude/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/mash tun dead space/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/kettle loss/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/notes/i)).toBeInTheDocument();
  });

  it('AC-8: every label carries htmlFor attribute matching its associated input id', () => {
    render(<EquipmentForm mode="create" onSaved={vi.fn()} onCancel={vi.fn()} />);

    const profileNameInput = screen.getByLabelText(/profile name/i);
    const profileNameLabel = screen.getByText('Profile Name').closest('label');
    expect(profileNameLabel).toHaveAttribute('for', profileNameInput.id);
    expect(screen.getByLabelText('Profile Name')).toBe(profileNameInput);

    const batchSizeInput = screen.getByLabelText(/batch size/i);
    const batchSizeLabel = screen.getByText(/batch size/i).closest('label');
    expect(batchSizeLabel).toHaveAttribute('for', batchSizeInput.id);
    expect(screen.getByLabelText(/batch size/i)).toBe(batchSizeInput);

    const altitudeInput = screen.getByLabelText(/altitude/i);
    const altitudeLabel = screen.getByText('Altitude (m)').closest('label');
    expect(altitudeLabel).toHaveAttribute('for', altitudeInput.id);
    expect(screen.getByLabelText(/altitude/i)).toBe(altitudeInput);

  });

  it('AC-9: action buttons (Cancel, Save, Delete) render with Button primitive styling', () => {
    render(
      <EquipmentForm
        mode="edit"
        initialProfile={baseProfile}
        onSaved={vi.fn()}
        onCancel={vi.fn()}
        deleteAction={{ onConfirm: () => {}, blockedReason: null, busy: false, error: null }}
      />,
    );

    const cancelButtons = screen.getAllByRole('button', { name: 'Cancel' });
    const cancelBtn = cancelButtons.find((b) => b.textContent === 'Cancel')!;
    const saveBtn = screen.getByRole('button', { name: /save profile/i });
    const deleteBtn = screen.getByRole('button', { name: /delete/i });

    expect(cancelBtn).toHaveClass('rounded-lg');
    expect(saveBtn).toHaveClass('bg-amber-600', 'rounded-lg');
    expect(deleteBtn).toHaveClass('bg-rose-950/80', 'rounded-lg');
  });
});


