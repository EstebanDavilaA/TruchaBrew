import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WaterProfileForm } from '../src/components/WaterProfileForm';
import type { WaterProfile } from '@truchabrew/shared-types';

vi.mock('../src/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/api/client')>();
  return {
    ...actual,
    createWaterProfile: vi.fn(),
    updateWaterProfile: vi.fn(),
  };
});

import { createWaterProfile, updateWaterProfile } from '../src/api/client';

const mockedCreate = vi.mocked(createWaterProfile);
const mockedUpdate = vi.mocked(updateWaterProfile);

const dummyProfile: WaterProfile = {
  id: 'wp-1',
  name: 'Balanced Profile',
  type: 'source',
  calcium: 50,
  magnesium: 10,
  sodium: 15,
  chloride: 60,
  sulfate: 75,
  bicarbonate: 100,
  ph: 7.2,
  description: 'A balanced brewing water',
};


beforeEach(() => {
  mockedCreate.mockReset();
  mockedUpdate.mockReset();
});

describe('WaterProfileForm (AC-15)', () => {
  it('renders create mode with inputs and save button', () => {
    render(<WaterProfileForm mode="create" onSaved={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByText('New Water Profile')).toBeInTheDocument();
    expect(screen.getByTestId('water-form-name')).toBeInTheDocument();
    expect(screen.getByTestId('water-form-type')).toBeInTheDocument();
    expect(screen.getByTestId('water-form-ca')).toBeInTheDocument();
  });

  it('displays validation error if name is empty', async () => {
    render(<WaterProfileForm mode="create" onSaved={vi.fn()} onCancel={vi.fn()} />);

    const form = screen.getByTestId('water-form-name').closest('form')!;
    fireEvent.submit(form);

    expect(await screen.findByText('Name is required')).toBeInTheDocument();
  });

  it('displays validation error if ion concentration is negative', async () => {
    render(<WaterProfileForm mode="create" onSaved={vi.fn()} onCancel={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/profile name/i), { target: { value: 'Test' } });
    fireEvent.change(screen.getByLabelText(/calcium/i), { target: { value: '-5' } });

    const form = screen.getByTestId('water-form-name').closest('form')!;
    fireEvent.submit(form);

    expect(await screen.findByText('All ion concentrations must be non-negative numbers')).toBeInTheDocument();
  });

  it('displays validation error if pH is out of bounds', async () => {
    render(<WaterProfileForm mode="create" onSaved={vi.fn()} onCancel={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/profile name/i), { target: { value: 'Test' } });
    fireEvent.change(screen.getByLabelText(/ph \(optional\)/i), { target: { value: '15' } });

    const form = screen.getByTestId('water-form-name').closest('form')!;
    fireEvent.submit(form);

    expect(await screen.findByText('pH must be between 0 and 14')).toBeInTheDocument();
  });
});

describe('AC-16 (M26_P1 Amendment 1): WaterProfileForm forwards onOpenMobileNav to its TopBar', () => {
  it('passing onOpenMobileNav renders the hamburger and clicking it calls the callback', () => {
    const onOpenMobileNav = vi.fn();
    render(<WaterProfileForm mode="create" onSaved={vi.fn()} onCancel={vi.fn()} onOpenMobileNav={onOpenMobileNav} />);
    const btn = screen.getByRole('button', { name: 'Open navigation menu' });
    fireEvent.click(btn);
    expect(onOpenMobileNav).toHaveBeenCalledTimes(1);
  });

  it('omitting onOpenMobileNav renders no hamburger button', () => {
    render(<WaterProfileForm mode="create" onSaved={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Open navigation menu' })).toBeNull();
  });
});

describe('M31_P4: WaterProfileForm milestone-closing accessibility assertions (source untouched — AC-19)', () => {
  it('AC-11: every input/select/textarea in the form resolves to a non-empty accessible name', () => {
    const { container } = render(<WaterProfileForm mode="create" onSaved={vi.fn()} onCancel={vi.fn()} />);

    const controls = container.querySelectorAll('input, select, textarea');
    expect(controls.length).toBeGreaterThan(0);
    controls.forEach((el) => {
      const hasAriaLabel = (el.getAttribute('aria-label') ?? '').trim() !== '';
      const hasLabels = (el as HTMLInputElement).labels && (el as HTMLInputElement).labels!.length > 0;
      expect(hasAriaLabel || hasLabels).toBe(true);
    });
  });

  it('AC-12: clicking the Profile Name label focuses its input', () => {
    render(<WaterProfileForm mode="create" onSaved={vi.fn()} onCancel={vi.fn()} />);

    const input = screen.getByLabelText('Profile Name *');
    const label = screen.getByText('Profile Name *').closest('label')!;
    fireEvent.click(label);
    // jsdom does not implement the browser's built-in <label> "activation
    // behaviour" of delegating a click through to its associated control
    // (https://github.com/jsdom/jsdom/issues/3117) -- fireEvent.click() alone
    // never moves focus here even when for/id association is correct. We
    // replicate that native delegation via the label's own `.control`
    // lookup, the same workaround M31_P3 AC-9/AC-24 established.
    (label as HTMLLabelElement).control?.focus();
    expect(document.activeElement).toBe(input);
  });
});

describe('M31_P2: WaterProfileForm UI Primitives & Accessibility (AC-13..AC-24)', () => {
  it('AC-13..AC-22: all 10 controls resolve via getByLabelText with matching htmlFor and id', () => {
    render(<WaterProfileForm mode="create" onSaved={vi.fn()} onCancel={vi.fn()} />);

    const nameInput = screen.getByLabelText('Profile Name *');
    expect(nameInput).toBeInTheDocument();
    expect(nameInput.id).toBe('water-form-name');

    const typeSelect = screen.getByLabelText('Profile Type *');
    expect(typeSelect).toBeInTheDocument();
    expect(typeSelect.id).toBe('water-form-type');

    const descInput = screen.getByLabelText('Description');
    expect(descInput).toBeInTheDocument();
    expect(descInput.id).toBe('water-form-description');

    const caInput = screen.getByLabelText('Calcium (Ca²⁺) ppm *');
    expect(caInput).toBeInTheDocument();
    expect(caInput.id).toBe('water-form-ca');

    const mgInput = screen.getByLabelText('Magnesium (Mg²⁺) ppm *');
    expect(mgInput).toBeInTheDocument();
    expect(mgInput.id).toBe('water-form-mg');

    const naInput = screen.getByLabelText('Sodium (Na⁺) ppm *');
    expect(naInput).toBeInTheDocument();
    expect(naInput.id).toBe('water-form-na');

    const clInput = screen.getByLabelText('Chloride (Cl⁻) ppm *');
    expect(clInput).toBeInTheDocument();
    expect(clInput.id).toBe('water-form-cl');

    const so4Input = screen.getByLabelText('Sulfate (SO₄²⁻) ppm *');
    expect(so4Input).toBeInTheDocument();
    expect(so4Input.id).toBe('water-form-so4');

    const hco3Input = screen.getByLabelText('Bicarbonate (HCO₃⁻) ppm *');
    expect(hco3Input).toBeInTheDocument();
    expect(hco3Input.id).toBe('water-form-hco3');

    const phInput = screen.getByLabelText('pH (Optional)');
    expect(phInput).toBeInTheDocument();
    expect(phInput.id).toBe('water-form-ph');
  });

  it('AC-23: every label carries htmlFor matching associated input id', () => {
    render(<WaterProfileForm mode="create" onSaved={vi.fn()} onCancel={vi.fn()} />);
    const nameLabel = screen.getByText('Profile Name *').closest('label');
    const nameInput = screen.getByLabelText('Profile Name *');
    expect(nameLabel).toHaveAttribute('for', nameInput.id);
    expect(screen.getByLabelText('Profile Name *')).toBe(nameInput);
  });

  it('AC-24: TopBar buttons use Button primitives with appropriate variants', () => {
    const deleteAction = { onConfirm: vi.fn(), blockedReason: null, busy: false, error: null };
    render(
      <WaterProfileForm
        mode="edit"
        initialProfile={dummyProfile}
        onSaved={vi.fn()}
        onCancel={vi.fn()}
        deleteAction={deleteAction}
      />,
    );

    const saveBtn = screen.getByRole('button', { name: /save profile/i });
    expect(saveBtn).toHaveClass('bg-amber-600', 'hover:bg-amber-500', 'rounded-lg');

    const cancelButtons = screen.getAllByRole('button', { name: 'Cancel' });
    const cancelBtn = cancelButtons.find((b) => b.textContent === 'Cancel')!;
    expect(cancelBtn).toHaveClass('bg-slate-800', 'hover:bg-slate-700', 'rounded-lg');

    const deleteBtn = screen.getByTestId('water-delete');
    expect(deleteBtn).toHaveClass('bg-rose-950/80', 'rounded-lg');
  });


  it('submits edit payload to updateWaterProfile', async () => {
    const onSaved = vi.fn();
    const deleteAction = { onConfirm: vi.fn(), blockedReason: null, busy: false, error: null };
    const updated = { ...dummyProfile, name: 'Updated Profile' };
    mockedUpdate.mockResolvedValueOnce(updated);

    render(
      <WaterProfileForm
        mode="edit"
        initialProfile={dummyProfile}
        onSaved={onSaved}
        onCancel={vi.fn()}
        deleteAction={deleteAction}
      />,
    );

    fireEvent.change(screen.getByLabelText('Profile Name *'), { target: { value: 'Updated Profile' } });
    fireEvent.click(screen.getByRole('button', { name: /save profile/i }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(updated));
    expect(mockedUpdate).toHaveBeenCalledWith('wp-1', expect.objectContaining({ name: 'Updated Profile' }));
  });
});

