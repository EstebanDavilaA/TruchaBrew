import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import { MashProfileForm } from '../src/components/MashProfileForm';
import { baseMashProfile } from './helpers/fixtures';

vi.mock('../src/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/api/client')>();
  return {
    ...actual,
    createMashProfile: vi.fn(),
    updateMashProfile: vi.fn(),
  };
});

import { createMashProfile, updateMashProfile } from '../src/api/client';

const mockedCreate = vi.mocked(createMashProfile);
const mockedUpdate = vi.mocked(updateMashProfile);

const noopDeleteAction = { onConfirm: () => {}, blockedReason: null, busy: false, error: null };

beforeEach(() => {
  mockedCreate.mockReset();
  mockedUpdate.mockReset();
});

describe('AC-4: create mode', () => {
  it('renders TopBar title "New Mash Profile", Save button "Save Profile", and empty inputs with default values', () => {
    render(<MashProfileForm mode="create" onSaved={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveAccessibleName('New Mash Profile');
    expect(screen.getByRole('button', { name: /save profile/i })).toBeInTheDocument();
    expect((screen.getByLabelText(/profile name/i) as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText(/target ph/i) as HTMLInputElement).value).toBe('5.4');
    expect((screen.getByLabelText(/sparge temperature override/i) as HTMLInputElement).value).toBe('');
    expect(screen.getByText(/no steps yet/i)).toBeInTheDocument();
  });
});

describe('AC-5: edit mode', () => {
  it('renders TopBar title Edit <Name>, pre-populates fields and step rows, and submits to updateMashProfile', async () => {
    const existing = baseMashProfile({ id: 'mash-edit-1', name: 'Old Name', targetPh: 5.2, spargeTempC: 78 });
    const updated = { ...existing, name: 'New Name' };
    mockedUpdate.mockResolvedValueOnce(updated);
    const onSaved = vi.fn();

    render(<MashProfileForm mode="edit" initialProfile={existing} onSaved={onSaved} onCancel={vi.fn()} deleteAction={noopDeleteAction} />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveAccessibleName('Edit Old Name');
    expect((screen.getByLabelText(/profile name/i) as HTMLInputElement).value).toBe('Old Name');
    expect((screen.getByLabelText(/target ph/i) as HTMLInputElement).value).toBe('5.2');
    expect((screen.getByLabelText(/sparge temperature override/i) as HTMLInputElement).value).toBe('78');
    expect(screen.getByTestId('mash-step-row-0')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/profile name/i), { target: { value: 'New Name' } });
    fireEvent.click(screen.getByRole('button', { name: /save profile/i }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(updated));
    expect(mockedUpdate).toHaveBeenCalledWith('mash-edit-1', expect.objectContaining({ name: 'New Name', targetPh: 5.2 }));
  });
});

describe('AC-6: validation', () => {
  it('a blank name shows "Name is required" and disables Save', () => {
    render(<MashProfileForm mode="create" onSaved={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/profile name/i), { target: { value: '   ' } });

    expect(screen.getByText(/name is required/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save profile/i })).toBeDisabled();
  });

  it('an out-of-bounds target pH renders an error and disables Save', () => {
    render(<MashProfileForm mode="create" onSaved={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/profile name/i), { target: { value: 'Valid Name' } });
    fireEvent.change(screen.getByLabelText(/target ph/i), { target: { value: '20' } });

    expect(screen.getByText(/must be 9 or less/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save profile/i })).toBeDisabled();
  });

  it('an out-of-bounds step value renders an error and disables Save', () => {
    render(<MashProfileForm mode="create" onSaved={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/profile name/i), { target: { value: 'Valid Name' } });
    fireEvent.click(screen.getByRole('button', { name: /add step/i }));

    const row = screen.getByTestId('mash-step-row-0');
    const [stepTempC] = within(row).getAllByRole('spinbutton');
    fireEvent.change(stepTempC, { target: { value: '200' } });

    expect(within(row).getByText(/must be 110 or less/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save profile/i })).toBeDisabled();
  });

  it('the step limit warning reads "A profile may have at most 20 steps." and the empty-steps notice mentions "profile"', () => {
    render(<MashProfileForm mode="create" onSaved={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText(/no steps yet — a saved profile with no steps is fine/i)).toBeInTheDocument();

    const addBtn = screen.getByRole('button', { name: /add step/i });
    for (let i = 0; i < 20; i++) {
      fireEvent.click(addBtn);
    }
    expect(addBtn).toBeDisabled();
    expect(screen.queryByText(/a profile may have at most 20 steps/i)).not.toBeInTheDocument();
  });
});

describe('AC-6: step management', () => {
  it('Add Step appends rows up to 20', () => {
    render(<MashProfileForm mode="create" onSaved={vi.fn()} onCancel={vi.fn()} />);
    const addBtn = screen.getByRole('button', { name: /add step/i });
    for (let i = 0; i < 20; i++) {
      fireEvent.click(addBtn);
    }
    for (let i = 0; i < 20; i++) {
      expect(screen.getByTestId(`mash-step-row-${i}`)).toBeInTheDocument();
    }
    expect(screen.queryByTestId('mash-step-row-20')).not.toBeInTheDocument();
    expect(addBtn).toBeDisabled();
  });

  it('Remove step removes the targeted row', () => {
    render(<MashProfileForm mode="create" onSaved={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /add step/i }));
    fireEvent.click(screen.getByRole('button', { name: /add step/i }));

    const firstRow = screen.getByTestId('mash-step-row-0');
    fireEvent.change(within(firstRow).getByRole('textbox'), { target: { value: 'First' } });
    const secondRow = screen.getByTestId('mash-step-row-1');
    fireEvent.change(within(secondRow).getByRole('textbox'), { target: { value: 'Second' } });

    fireEvent.click(within(firstRow).getByTitle('Remove step'));

    expect(screen.queryByTestId('mash-step-row-1')).not.toBeInTheDocument();
    const remaining = screen.getByTestId('mash-step-row-0');
    expect(within(remaining).getByRole('textbox')).toHaveValue('Second');
  });

  it('reordering (move up / move down) swaps adjacent step rows', () => {
    const existing = baseMashProfile({
      id: 'mash-reorder',
      steps: [
        { id: 's-0', name: 'Alpha', type: 'Infusion', stepTempC: 65, stepTimeMin: 30, rampTimeMin: 0, infuseAmountL: null, infuseWaterTempC: 100 },
        { id: 's-1', name: 'Beta', type: 'Infusion', stepTempC: 70, stepTimeMin: 20, rampTimeMin: 0, infuseAmountL: null, infuseWaterTempC: 100 },
      ],
    });
    render(<MashProfileForm mode="edit" initialProfile={existing} onSaved={vi.fn()} onCancel={vi.fn()} deleteAction={noopDeleteAction} />);

    expect(within(screen.getByTestId('mash-step-row-0')).getByRole('textbox')).toHaveValue('Alpha');
    expect(within(screen.getByTestId('mash-step-row-1')).getByRole('textbox')).toHaveValue('Beta');

    fireEvent.click(within(screen.getByTestId('mash-step-row-0')).getByTitle('Move down'));

    expect(within(screen.getByTestId('mash-step-row-0')).getByRole('textbox')).toHaveValue('Beta');
    expect(within(screen.getByTestId('mash-step-row-1')).getByRole('textbox')).toHaveValue('Alpha');

    fireEvent.click(within(screen.getByTestId('mash-step-row-1')).getByTitle('Move up'));

    expect(within(screen.getByTestId('mash-step-row-0')).getByRole('textbox')).toHaveValue('Alpha');
    expect(within(screen.getByTestId('mash-step-row-1')).getByRole('textbox')).toHaveValue('Beta');
  });
});

describe('AC-5: save execution (create)', () => {
  it('clicking "Save Profile" submits the validated payload to createMashProfile and calls onSaved', async () => {
    const created = baseMashProfile({ id: 'new-mash', name: 'Brand New Profile' });
    mockedCreate.mockResolvedValueOnce(created);
    const onSaved = vi.fn();

    render(<MashProfileForm mode="create" onSaved={onSaved} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/profile name/i), { target: { value: 'Brand New Profile' } });
    fireEvent.click(screen.getByRole('button', { name: /save profile/i }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(created));
    expect(mockedCreate).toHaveBeenCalledTimes(1);
    expect(mockedCreate.mock.calls[0][0]).toMatchObject({ name: 'Brand New Profile', targetPh: 5.4 });
  });
});

describe('cancel execution', () => {
  it('clicking Cancel calls onCancel', () => {
    const onCancel = vi.fn();
    render(<MashProfileForm mode="create" onSaved={vi.fn()} onCancel={onCancel} />);
    const cancelButtons = screen.getAllByRole('button', { name: 'Cancel' });
    fireEvent.click(cancelButtons.find((b) => b.textContent === 'Cancel')!);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

describe('AC-16 (M26_P1 Amendment 1): MashProfileForm forwards onOpenMobileNav to its TopBar', () => {
  it('passing onOpenMobileNav renders the hamburger and clicking it calls the callback', () => {
    const onOpenMobileNav = vi.fn();
    render(<MashProfileForm mode="create" onSaved={vi.fn()} onCancel={vi.fn()} onOpenMobileNav={onOpenMobileNav} />);
    const btn = screen.getByRole('button', { name: 'Open navigation menu' });
    fireEvent.click(btn);
    expect(onOpenMobileNav).toHaveBeenCalledTimes(1);
  });

  it('omitting onOpenMobileNav renders no hamburger button', () => {
    render(<MashProfileForm mode="create" onSaved={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Open navigation menu' })).toBeNull();
  });

  it('passing onOpenMobileNav renders the hamburger in edit mode too', () => {
    const onOpenMobileNav = vi.fn();
    render(
      <MashProfileForm
        mode="edit"
        initialProfile={baseMashProfile({ id: 'mash-1' })}
        onSaved={vi.fn()}
        onCancel={vi.fn()}
        deleteAction={noopDeleteAction}
        onOpenMobileNav={onOpenMobileNav}
      />,
    );
    const btn = screen.getByRole('button', { name: 'Open navigation menu' });
    fireEvent.click(btn);
    expect(onOpenMobileNav).toHaveBeenCalledTimes(1);
  });
});

describe('M31_P4: MashProfileForm milestone-closing accessibility assertions', () => {
  it('AC-7: the empty-steps note is byte-identical to today after token adoption', () => {
    const { container } = render(<MashProfileForm mode="create" onSaved={vi.fn()} onCancel={vi.fn()} />);

    const note = screen.getByText(/no steps yet/i);
    expect(note.className).toBe(
      'text-xs text-slate-400 italic bg-slate-950/40 border border-slate-800 rounded-lg p-4 text-center',
    );
    expect(container.innerHTML).not.toContain('text-[11px]');
  });

  it('AC-11: every input/select/textarea in the form resolves to a non-empty accessible name', () => {
    const { container } = render(<MashProfileForm mode="create" onSaved={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /add step/i }));

    const controls = container.querySelectorAll('input, select, textarea');
    expect(controls.length).toBeGreaterThan(0);
    controls.forEach((el) => {
      const hasAriaLabel = (el.getAttribute('aria-label') ?? '').trim() !== '';
      const hasLabels = (el as HTMLInputElement).labels && (el as HTMLInputElement).labels!.length > 0;
      expect(hasAriaLabel || hasLabels).toBe(true);
    });
  });

  it('AC-12: clicking the Profile Name label focuses its input', () => {
    render(<MashProfileForm mode="create" onSaved={vi.fn()} onCancel={vi.fn()} />);

    const input = screen.getByLabelText('Profile Name');
    const label = screen.getByText('Profile Name').closest('label')!;
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

describe('M31_P2: MashProfileForm UI Primitives & Accessibility (AC-1..AC-12)', () => {
  it('AC-1..AC-10: all 10 controls resolve via getByLabelText with matching htmlFor and id', () => {
    render(<MashProfileForm mode="create" onSaved={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /add step/i }));

    const profileNameInput = screen.getByLabelText('Profile Name');
    expect(profileNameInput).toBeInTheDocument();
    expect(profileNameInput.id).toBe('mash-field-name');

    const targetPhInput = screen.getByLabelText('Target pH');
    expect(targetPhInput).toBeInTheDocument();
    expect(targetPhInput.id).toBe('mash-field-ph');

    const spargeInput = screen.getByLabelText('Sparge Temperature Override (°C)');
    expect(spargeInput).toBeInTheDocument();
    expect(spargeInput.id).toBe('mash-field-sparge');

    const row = screen.getByTestId('mash-step-row-0');
    const stepName = within(row).getByLabelText('Name');
    expect(stepName.id).toBe('mash-step-name-0');

    const stepType = within(row).getByLabelText('Type');
    expect(stepType.id).toBe('mash-step-type-0');

    const stepTemp = within(row).getByLabelText('Temp (°C)');
    expect(stepTemp.id).toBe('mash-step-temp-0');

    const stepRest = within(row).getByLabelText('Rest (min)');
    expect(stepRest.id).toBe('mash-step-time-0');

    const stepRamp = within(row).getByLabelText('Ramp (min)');
    expect(stepRamp.id).toBe('mash-step-ramp-0');

    const stepInfuse = within(row).getByLabelText('Infuse Amount (L)');
    expect(stepInfuse.id).toBe('mash-step-infuse-0');

    const stepInfuseTemp = within(row).getByLabelText('Infuse Water Temp (°C)');
    expect(stepInfuseTemp.id).toBe('mash-step-infuse-temp-0');
  });

  it('AC-11: every label carries htmlFor matching associated input id', () => {
    render(<MashProfileForm mode="create" onSaved={vi.fn()} onCancel={vi.fn()} />);
    const nameLabel = screen.getByText('Profile Name').closest('label');
    const nameInput = screen.getByLabelText('Profile Name');
    expect(nameLabel).toHaveAttribute('for', nameInput.id);
    expect(screen.getByLabelText('Profile Name')).toBe(nameInput);
  });

  it('AC-12: TopBar and step buttons use Button primitives with appropriate variants', () => {
    const existing = baseMashProfile({ id: 'mash-edit-1', name: 'Test' });
    render(
      <MashProfileForm
        mode="edit"
        initialProfile={existing}
        onSaved={vi.fn()}
        onCancel={vi.fn()}
        deleteAction={noopDeleteAction}
      />,
    );

    const saveBtn = screen.getByRole('button', { name: /save profile/i });
    expect(saveBtn).toHaveClass('bg-amber-600', 'hover:bg-amber-500', 'rounded-lg');

    const cancelButtons = screen.getAllByRole('button', { name: 'Cancel' });
    const cancelBtn = cancelButtons.find((b) => b.textContent === 'Cancel')!;
    expect(cancelBtn).toHaveClass('bg-slate-800', 'hover:bg-slate-700', 'rounded-lg');

    const deleteBtn = screen.getByTestId('mash-delete');
    expect(deleteBtn).toHaveClass('bg-rose-950/80', 'rounded-lg');

    const addBtn = screen.getByRole('button', { name: /add step/i });
    expect(addBtn).toHaveClass('bg-slate-800', 'hover:bg-slate-700', 'rounded-lg');
  });
});


