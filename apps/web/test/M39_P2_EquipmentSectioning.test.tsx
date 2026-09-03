import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
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

beforeEach(() => {
  mockCreate.mockReset();
  mockUpdate.mockReset();
});

function renderCreate() {
  return render(<EquipmentForm mode="create" onSaved={vi.fn()} onCancel={vi.fn()} />);
}

function expectSectionHeading(id: string, title: string) {
  const heading = screen.getByTestId(`${id}-title`);
  expect(heading.tagName).toBe('H4');
  expect(heading).toHaveTextContent(title);
}

describe('AC-16..AC-21: EquipmentForm sections become non-collapsible SectionCards', () => {
  it('AC-16: General is an equipment-general SectionCard with Profile Name + 7 core fields', () => {
    renderCreate();

    expect(screen.getByTestId('equipment-general-section')).toBeInTheDocument();
    expectSectionHeading('equipment-general', 'General');

    const general = screen.getByTestId('equipment-general-section');
    expect(within(general).getByTestId('equipment-field-name')).toBeInTheDocument();
    for (const key of [
      'batchSizeL',
      'boilTimeMin',
      'brewhouseEfficiencyPct',
      'mashEfficiencyPct',
      'boilOffRateLPerHour',
      'trubChillerLossL',
      'hopUtilizationPct',
    ]) {
      expect(within(general).getByTestId(`equipment-field-${key}`)).toBeInTheDocument();
    }
  });

  it('AC-17: altitude SectionCard re-emits equipment-altitude-section with its h4 title', () => {
    renderCreate();
    expect(screen.getByTestId('equipment-altitude-section')).toBeInTheDocument();
    expect(document.getElementById('equipment-altitude')).toBe(
      screen.getByTestId('equipment-altitude-section'),
    );
    expectSectionHeading('equipment-altitude', 'Altitude & Atmospheric Physics');
  });

  it('AC-18: thermal-mass SectionCard re-emits its testid and the checkbox still works', () => {
    renderCreate();
    expect(screen.getByTestId('equipment-thermal-mass-section')).toBeInTheDocument();
    expectSectionHeading('equipment-thermal-mass', 'Thermal Mass & Mash Strike Energy Balance');

    const toggle = screen.getByTestId('equipment-field-calcStrikeWithThermalMass');
    expect(toggle).not.toBeChecked();
    expect(screen.queryByTestId('equipment-field-mashTunWeightKg')).not.toBeInTheDocument();

    fireEvent.click(toggle);
    expect(toggle).toBeChecked();
    expect(screen.getByTestId('equipment-field-mashTunWeightKg')).toBeInTheDocument();
    expect(screen.getByTestId('equipment-field-mashTunHeatCapacity')).toBeInTheDocument();
  });

  it('AC-19: losses SectionCard re-emits equipment-losses-section with its h4 title', () => {
    renderCreate();
    expect(screen.getByTestId('equipment-losses-section')).toBeInTheDocument();
    expectSectionHeading('equipment-losses', 'Vessel Losses & Dead Space');
  });

  it('AC-20: hopstand and notes SectionCards render', () => {
    renderCreate();
    expect(screen.getByTestId('equipment-hopstand-section')).toBeInTheDocument();
    expectSectionHeading('equipment-hopstand', 'Hopstand & Whirlpool Parameters');
    expect(screen.getByTestId('equipment-notes-section')).toBeInTheDocument();
    expectSectionHeading('equipment-notes', 'Notes');
  });

  it('AC-21: no equipment card is collapsible — no toggles, content always mounted', () => {
    renderCreate();
    for (const id of [
      'equipment-general',
      'equipment-altitude',
      'equipment-thermal-mass',
      'equipment-losses',
      'equipment-hopstand',
      'equipment-notes',
    ]) {
      expect(screen.queryByTestId(`${id}-toggle`)).not.toBeInTheDocument();
      expect(screen.getByTestId(`${id}-panel`)).toBeInTheDocument();
    }
  });
});

describe('AC-24: equipment CRUD regression', () => {
  it('AC-24: create + save still round-trips through the sectioned form', async () => {
    mockCreate.mockResolvedValue({ ...baseProfile, id: 'eq-new', name: 'New Kit' });
    renderCreate();

    fireEvent.change(screen.getByTestId('equipment-field-name'), {
      target: { value: 'New Kit' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save Profile' }));

    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'New Kit', batchSizeL: 20 }),
    );
  });
});

describe('AC-25..AC-27: brewing-guidance captions via FormField hint', () => {
  it('AC-25: batchSizeL renders its binding hint under the input', () => {
    renderCreate();
    expect(
      screen.getByText('Volume of beer you plan to package; drives the whole water & gravity pipeline.'),
    ).toBeInTheDocument();
  });

  it('AC-26: all 8 binding captions render', () => {
    renderCreate();
    const captions = [
      'Volume of beer you plan to package; drives the whole water & gravity pipeline.',
      'Standard 60 min; longer drives more bitterness and boil-off.',
      'Share of extract you actually get into the fermenter (65–80 typical).',
      'Volume lost to steam per hour (typical 8–12% of pre-boil per 60 min).',
      'Water retained by spent grain after mashing (0.85–1.0 L/kg).',
      'Elevation lowers the boil point and scales hop utilization (see live panel).',
      'Keep near mash-out to avoid tannin extraction (75–78°C).',
      'Volume left behind with trub/hops after chilling.',
    ];
    for (const caption of captions) {
      expect(screen.getByText(caption)).toBeInTheDocument();
    }
  });

  it('AC-27: when a field has an error its hint is suppressed', () => {
    renderCreate();
    const caption = 'Volume of beer you plan to package; drives the whole water & gravity pipeline.';
    expect(screen.getByText(caption)).toBeInTheDocument();

    // batchSizeL is exclusiveMin 0 — setting it to 0 is invalid.
    fireEvent.change(screen.getByTestId('equipment-field-batchSizeL'), {
      target: { value: '0' },
    });

    expect(screen.getByText('Batch Size: Must be greater than 0')).toBeInTheDocument();
    expect(screen.queryByText(caption)).not.toBeInTheDocument();
  });
});
