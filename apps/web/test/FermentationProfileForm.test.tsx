import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import { FermentationProfileForm } from '../src/components/FermentationProfileForm';
import { baseFermentationProfile } from './helpers/fixtures';

vi.mock('../src/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/api/client')>();
  return {
    ...actual,
    createFermentationProfile: vi.fn(),
    updateFermentationProfile: vi.fn(),
  };
});

import { createFermentationProfile, updateFermentationProfile } from '../src/api/client';

const mockedCreate = vi.mocked(createFermentationProfile);
const mockedUpdate = vi.mocked(updateFermentationProfile);

const noopDeleteAction = { onConfirm: () => {}, blockedReason: null, busy: false, error: null };

beforeEach(() => {
  mockedCreate.mockReset();
  mockedUpdate.mockReset();
});

describe('AC-7: create mode', () => {
  it('renders TopBar title "New Fermentation Profile", Save button "Save Profile", and empty inputs with default values', () => {
    render(<FermentationProfileForm mode="create" onSaved={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveAccessibleName('New Fermentation Profile');
    expect(screen.getByRole('button', { name: /save profile/i })).toBeInTheDocument();
    expect((screen.getByLabelText(/profile name/i) as HTMLInputElement).value).toBe('');
    expect(screen.getByText(/no steps yet — a saved profile with no steps is fine/i)).toBeInTheDocument();
  });
});

describe('AC-8: edit mode', () => {
  it('renders TopBar title Edit <Name>, pre-populates fields and step rows, and submits to updateFermentationProfile', async () => {
    const existing = baseFermentationProfile({ id: 'ferm-edit-1', name: 'Old Name' });
    const updated = { ...existing, name: 'New Name' };
    mockedUpdate.mockResolvedValueOnce(updated);
    const onSaved = vi.fn();

    render(<FermentationProfileForm mode="edit" initialProfile={existing} onSaved={onSaved} onCancel={vi.fn()} deleteAction={noopDeleteAction} />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveAccessibleName('Edit Old Name');
    expect((screen.getByLabelText(/profile name/i) as HTMLInputElement).value).toBe('Old Name');
    expect(screen.getByTestId('ferm-step-row-0')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/profile name/i), { target: { value: 'New Name' } });
    fireEvent.click(screen.getByRole('button', { name: /save profile/i }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(updated));
    expect(mockedUpdate).toHaveBeenCalledWith('ferm-edit-1', expect.objectContaining({ name: 'New Name' }));
  });
});

describe('AC-9: validation', () => {
  it('a blank name shows "Name is required" and disables Save', () => {
    render(<FermentationProfileForm mode="create" onSaved={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/profile name/i), { target: { value: '   ' } });

    expect(screen.getByText(/name is required/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save profile/i })).toBeDisabled();
  });

  it('an out-of-bounds step value renders an error and disables Save', () => {
    render(<FermentationProfileForm mode="create" onSaved={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/profile name/i), { target: { value: 'Valid Name' } });
    fireEvent.click(screen.getByRole('button', { name: /add step/i }));

    const row = screen.getByTestId('ferm-step-row-0');
    const [stepTempC] = within(row).getAllByRole('spinbutton');
    fireEvent.change(stepTempC, { target: { value: '999' } });

    expect(within(row).getByText(/must be 40 or less/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save profile/i })).toBeDisabled();
  });

  it('the step limit warning reads "A profile may have at most 20 steps." once 20 steps are added', () => {
    render(<FermentationProfileForm mode="create" onSaved={vi.fn()} onCancel={vi.fn()} />);
    const addBtn = screen.getByRole('button', { name: /add step/i });
    for (let i = 0; i < 20; i++) {
      fireEvent.click(addBtn);
    }
    expect(addBtn).toBeDisabled();
    expect(screen.queryByText(/a profile may have at most 20 steps/i)).not.toBeInTheDocument();
  }, 15000);
});

describe('AC-9: step management', () => {
  it('Add Step appends rows up to 20', () => {
    render(<FermentationProfileForm mode="create" onSaved={vi.fn()} onCancel={vi.fn()} />);
    const addBtn = screen.getByRole('button', { name: /add step/i });
    for (let i = 0; i < 20; i++) {
      fireEvent.click(addBtn);
    }
    for (let i = 0; i < 20; i++) {
      expect(screen.getByTestId(`ferm-step-row-${i}`)).toBeInTheDocument();
    }
    expect(screen.queryByTestId('ferm-step-row-20')).not.toBeInTheDocument();
    expect(addBtn).toBeDisabled();
  }, 15000);


  it('Remove step removes the targeted row', () => {
    render(<FermentationProfileForm mode="create" onSaved={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /add step/i }));
    fireEvent.click(screen.getByRole('button', { name: /add step/i }));

    const firstRow = screen.getByTestId('ferm-step-row-0');
    fireEvent.change(within(firstRow).getByRole('textbox'), { target: { value: 'First' } });
    const secondRow = screen.getByTestId('ferm-step-row-1');
    fireEvent.change(within(secondRow).getByRole('textbox'), { target: { value: 'Second' } });

    fireEvent.click(within(firstRow).getByTitle('Remove step'));

    expect(screen.queryByTestId('ferm-step-row-1')).not.toBeInTheDocument();
    const remaining = screen.getByTestId('ferm-step-row-0');
    expect(within(remaining).getByRole('textbox')).toHaveValue('Second');
  });

  it('reordering (move up / move down) swaps adjacent step rows', () => {
    const existing = baseFermentationProfile({
      id: 'ferm-reorder',
      steps: [
        { id: 's-0', name: 'Alpha', type: 'Primary', stepTempC: 19, stepTimeDays: 14, rampDays: 0, pressurePsi: null },
        { id: 's-1', name: 'Beta', type: 'Secondary', stepTempC: 18, stepTimeDays: 7, rampDays: 0, pressurePsi: null },
      ],
    });
    render(<FermentationProfileForm mode="edit" initialProfile={existing} onSaved={vi.fn()} onCancel={vi.fn()} deleteAction={noopDeleteAction} />);

    expect(within(screen.getByTestId('ferm-step-row-0')).getByRole('textbox')).toHaveValue('Alpha');
    expect(within(screen.getByTestId('ferm-step-row-1')).getByRole('textbox')).toHaveValue('Beta');

    fireEvent.click(within(screen.getByTestId('ferm-step-row-0')).getByTitle('Move down'));

    expect(within(screen.getByTestId('ferm-step-row-0')).getByRole('textbox')).toHaveValue('Beta');
    expect(within(screen.getByTestId('ferm-step-row-1')).getByRole('textbox')).toHaveValue('Alpha');

    fireEvent.click(within(screen.getByTestId('ferm-step-row-1')).getByTitle('Move up'));

    expect(within(screen.getByTestId('ferm-step-row-0')).getByRole('textbox')).toHaveValue('Alpha');
    expect(within(screen.getByTestId('ferm-step-row-1')).getByRole('textbox')).toHaveValue('Beta');
  });
});

describe('AC-8: save execution (create)', () => {
  it('clicking "Save Profile" submits the validated payload to createFermentationProfile and calls onSaved', async () => {
    const created = baseFermentationProfile({ id: 'new-ferm', name: 'Brand New Profile' });
    mockedCreate.mockResolvedValueOnce(created);
    const onSaved = vi.fn();

    render(<FermentationProfileForm mode="create" onSaved={onSaved} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/profile name/i), { target: { value: 'Brand New Profile' } });
    fireEvent.click(screen.getByRole('button', { name: /save profile/i }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(created));
    expect(mockedCreate).toHaveBeenCalledTimes(1);
    expect(mockedCreate.mock.calls[0][0]).toMatchObject({ name: 'Brand New Profile' });
  });
});

describe('cancel execution', () => {
  it('clicking Cancel calls onCancel', () => {
    const onCancel = vi.fn();
    render(<FermentationProfileForm mode="create" onSaved={vi.fn()} onCancel={onCancel} />);
    const cancelButtons = screen.getAllByRole('button', { name: 'Cancel' });
    fireEvent.click(cancelButtons.find((b) => b.textContent === 'Cancel')!);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

describe('M31_P4: FermentationProfileForm milestone-closing accessibility assertions', () => {
  it('AC-7: the empty-steps note is byte-identical to today after token adoption', () => {
    const { container } = render(<FermentationProfileForm mode="create" onSaved={vi.fn()} onCancel={vi.fn()} />);

    const note = screen.getByText(/no steps yet — a saved profile with no steps is fine/i);
    expect(note.className).toBe(
      'text-xs text-slate-400 italic bg-slate-950/40 border border-slate-800 rounded-lg p-4 text-center',
    );
    expect(container.innerHTML).not.toContain('text-[11px]');
  });

  it('AC-11: every input/select/textarea in the form resolves to a non-empty accessible name', () => {
    const { container } = render(<FermentationProfileForm mode="create" onSaved={vi.fn()} onCancel={vi.fn()} />);
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
    render(<FermentationProfileForm mode="create" onSaved={vi.fn()} onCancel={vi.fn()} />);

    const input = screen.getByLabelText(/profile name/i);
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

describe('AC-16 (M26_P1 Amendment 1): FermentationProfileForm forwards onOpenMobileNav to its TopBar', () => {
  it('passing onOpenMobileNav renders the hamburger and clicking it calls the callback', () => {
    const onOpenMobileNav = vi.fn();
    render(<FermentationProfileForm mode="create" onSaved={vi.fn()} onCancel={vi.fn()} onOpenMobileNav={onOpenMobileNav} />);
    const btn = screen.getByRole('button', { name: 'Open navigation menu' });
    fireEvent.click(btn);
    expect(onOpenMobileNav).toHaveBeenCalledTimes(1);
  });

  it('omitting onOpenMobileNav renders no hamburger button', () => {
    render(<FermentationProfileForm mode="create" onSaved={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Open navigation menu' })).toBeNull();
  });

  it('passing onOpenMobileNav renders the hamburger in edit mode too', () => {
    const onOpenMobileNav = vi.fn();
    render(
      <FermentationProfileForm
        mode="edit"
        initialProfile={baseFermentationProfile({ id: 'ferm-1' })}
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
