import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import { MashProfileManager } from '../src/components/MashProfileManager';
import { ApiClientError } from '../src/api/client';
import { baseMashProfile } from './helpers/fixtures';

vi.mock('../src/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/api/client')>();
  return {
    ...actual,
    createMashProfile: vi.fn(),
    updateMashProfile: vi.fn(),
    deleteMashProfile: vi.fn(),
  };
});

import { createMashProfile, updateMashProfile, deleteMashProfile } from '../src/api/client';

const mockedCreate = vi.mocked(createMashProfile);
const mockedUpdate = vi.mocked(updateMashProfile);
const mockedDelete = vi.mocked(deleteMashProfile);

const noop = () => {};

beforeEach(() => {
  mockedCreate.mockReset();
  mockedUpdate.mockReset();
  mockedDelete.mockReset();
});

describe('Web: mash list load fails', () => {
  it('renders an error panel with Retry, and never the empty state', () => {
    const onReload = vi.fn();
    render(
      <MashProfileManager
        profiles={[]}
        loadError="Request failed with status 500."
        onReload={onReload}
        activeRecipeProfileId={null}
        onCreated={noop}
        onUpdated={noop}
        onDeleted={noop}
      />,
    );

    expect(screen.getByText("Couldn't load your mash profiles")).toBeInTheDocument();
    expect(screen.getByText('Request failed with status 500.')).toBeInTheDocument();
    expect(screen.queryByText(/no mash profiles yet/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(onReload).toHaveBeenCalledTimes(1);
  });
});

describe('Web: zero mash profiles, no load error', () => {
  it('renders the empty state, not an error panel', () => {
    render(
      <MashProfileManager profiles={[]} loadError={null} onReload={noop} activeRecipeProfileId={null} onCreated={noop} onUpdated={noop} onDeleted={noop} />,
    );
    expect(screen.getByText(/no mash profiles yet/i)).toBeInTheDocument();
    expect(screen.queryByText(/couldn't load/i)).not.toBeInTheDocument();
  });
});

describe("AC-55: Delete is disabled for the open recipe's schedule", () => {
  it('disables Delete with a visible reason for the active profile; every other profile stays enabled', () => {
    const profiles = [baseMashProfile({ id: 'mash-1', name: 'Sched A' }), baseMashProfile({ id: 'mash-2', name: 'Sched B' })];
    render(
      <MashProfileManager
        profiles={profiles}
        loadError={null}
        onReload={noop}
        activeRecipeProfileId="mash-1"
        onCreated={noop}
        onUpdated={noop}
        onDeleted={noop}
      />,
    );

    fireEvent.click(screen.getByTestId('mash-row-mash-1'));
    const blockedDelete = screen.getByTestId('mash-delete');
    expect(blockedDelete).toBeDisabled();
    expect(blockedDelete).toHaveAttribute('title', 'In use by the recipe currently open in the editor');
    const cancelButtons = screen.getAllByRole('button', { name: 'Cancel' });
    fireEvent.click(cancelButtons.find((b) => b.textContent === 'Cancel')!);

    fireEvent.click(screen.getByTestId('mash-row-mash-2'));
    expect(screen.getByTestId('mash-delete')).not.toBeDisabled();
  });
});

describe('create flow', () => {
  it('creating a profile calls createMashProfile and onCreated with the result, then closes the form', async () => {
    const created = baseMashProfile({ id: 'new-id', name: 'Brand New Schedule' });
    mockedCreate.mockResolvedValueOnce(created);
    const onCreated = vi.fn();

    render(
      <MashProfileManager profiles={[]} loadError={null} onReload={noop} activeRecipeProfileId={null} onCreated={onCreated} onUpdated={noop} onDeleted={noop} />,
    );

    fireEvent.click(screen.getByTestId('mash-new-profile'));
    fireEvent.change(screen.getByLabelText(/profile name/i), { target: { value: 'Brand New Schedule' } });
    fireEvent.click(screen.getByRole('button', { name: /save profile/i }));

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(created));
    expect(mockedCreate).toHaveBeenCalledTimes(1);
    expect(mockedCreate.mock.calls[0][0]).toMatchObject({ name: 'Brand New Schedule' });
    expect(screen.queryByRole('button', { name: /save profile/i })).not.toBeInTheDocument();
  });
});

describe('edit flow', () => {
  it('pre-fills the form from the target profile, including its steps, and calls updateMashProfile with the id and full body', async () => {
    const existing = baseMashProfile({ id: 'mash-9', name: 'Old Name', targetPh: 5.2 });
    const updated = { ...existing, name: 'New Name' };
    mockedUpdate.mockResolvedValueOnce(updated);
    const onUpdated = vi.fn();

    render(
      <MashProfileManager profiles={[existing]} loadError={null} onReload={noop} activeRecipeProfileId={null} onCreated={noop} onUpdated={onUpdated} onDeleted={noop} />,
    );

    fireEvent.click(screen.getByTestId('mash-row-mash-9'));
    const nameInput = screen.getByLabelText(/profile name/i) as HTMLInputElement;
    expect(nameInput.value).toBe('Old Name');
    expect(screen.getByTestId('mash-step-row-0')).toBeInTheDocument();

    fireEvent.change(nameInput, { target: { value: 'New Name' } });
    fireEvent.click(screen.getByRole('button', { name: /save profile/i }));

    await waitFor(() => expect(onUpdated).toHaveBeenCalledWith(updated));
    expect(mockedUpdate).toHaveBeenCalledWith('mash-9', expect.objectContaining({ name: 'New Name', targetPh: 5.2 }));
  });
});

describe('delete flow', () => {
  it('deleting an unreferenced schedule calls deleteMashProfile then onDeleted', async () => {
    const profile = baseMashProfile({ id: 'mash-5', name: 'Deletable' });
    mockedDelete.mockResolvedValueOnce(undefined);
    const onDeleted = vi.fn();

    render(
      <MashProfileManager profiles={[profile]} loadError={null} onReload={noop} activeRecipeProfileId={null} onCreated={noop} onUpdated={noop} onDeleted={onDeleted} />,
    );

    fireEvent.click(screen.getByTestId('mash-row-mash-5'));
    fireEvent.click(screen.getByTestId('mash-delete'));
    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
    expect(mockedDelete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('confirm-dialog-confirm'));

    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith('mash-5'));
    expect(mockedDelete).toHaveBeenCalledTimes(1);
    expect(mockedDelete).toHaveBeenCalledWith('mash-5');
    expect(screen.getByTestId('mash-new-profile')).toBeInTheDocument();
  });

  it('a 409 PROFILE_IN_USE failure shows the server message inline and does not call onDeleted', async () => {
    const profile = baseMashProfile({ id: 'mash-6', name: 'Popular Schedule' });
    mockedDelete.mockRejectedValueOnce(
      new ApiClientError('PROFILE_IN_USE', 'Cannot delete — still used by recipe "Trucha West Coast IPA".'),
    );
    const onDeleted = vi.fn();

    render(
      <MashProfileManager profiles={[profile]} loadError={null} onReload={noop} activeRecipeProfileId={null} onCreated={noop} onUpdated={noop} onDeleted={onDeleted} />,
    );

    fireEvent.click(screen.getByTestId('mash-row-mash-6'));
    fireEvent.click(screen.getByTestId('mash-delete'));
    fireEvent.click(screen.getByTestId('confirm-dialog-confirm'));

    await waitFor(() => {
      expect(screen.getByText('Cannot delete — still used by recipe "Trucha West Coast IPA".')).toBeInTheDocument();
    });
    expect(onDeleted).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument());
    expect((screen.getByLabelText(/profile name/i) as HTMLInputElement).value).toBe('Popular Schedule');
    expect(screen.queryByTestId('mash-new-profile')).not.toBeInTheDocument();
  });

  it('cancelling the dialog aborts: zero API calls, form stays open with values intact', () => {
    const profile = baseMashProfile({ id: 'mash-7', name: 'Untouched Schedule' });
    render(
      <MashProfileManager profiles={[profile]} loadError={null} onReload={noop} activeRecipeProfileId={null} onCreated={noop} onUpdated={noop} onDeleted={noop} />,
    );

    fireEvent.click(screen.getByTestId('mash-row-mash-7'));
    fireEvent.click(screen.getByTestId('mash-delete'));
    fireEvent.click(screen.getByTestId('confirm-dialog-cancel'));

    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();
    expect(mockedDelete).not.toHaveBeenCalled();
    expect((screen.getByLabelText(/profile name/i) as HTMLInputElement).value).toBe('Untouched Schedule');
  });
});

describe('validation', () => {
  it('a blank/whitespace name shows "Name is required" and disables Save', () => {
    render(<MashProfileManager profiles={[]} loadError={null} onReload={noop} activeRecipeProfileId={null} onCreated={noop} onUpdated={noop} onDeleted={noop} />);
    fireEvent.click(screen.getByTestId('mash-new-profile'));
    fireEvent.change(screen.getByLabelText(/profile name/i), { target: { value: '   ' } });

    expect(screen.getByText(/name is required/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save profile/i })).toBeDisabled();
  });
});

describe('Web: mash save fails', () => {
  it('a failed create keeps the form open with the entered values and an error banner; onCreated is not called', async () => {
    mockedCreate.mockRejectedValueOnce(new ApiClientError('VALIDATION_FAILED', 'targetPh must be between 3 and 9.'));
    const onCreated = vi.fn();

    render(
      <MashProfileManager profiles={[]} loadError={null} onReload={noop} activeRecipeProfileId={null} onCreated={onCreated} onUpdated={noop} onDeleted={noop} />,
    );
    fireEvent.click(screen.getByTestId('mash-new-profile'));
    fireEvent.change(screen.getByLabelText(/profile name/i), { target: { value: 'Will Fail' } });
    fireEvent.click(screen.getByRole('button', { name: /save profile/i }));

    await waitFor(() => {
      expect(screen.getByText('targetPh must be between 3 and 9.')).toBeInTheDocument();
    });
    expect(onCreated).not.toHaveBeenCalled();
    expect((screen.getByLabelText(/profile name/i) as HTMLInputElement).value).toBe('Will Fail');
    expect(screen.getByRole('button', { name: /save profile/i })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// M5.5_P2/P3 AC-3/AC-4/AC-5/AC-6: create form is a full page, not a modal
// ---------------------------------------------------------------------------

describe('M5.5_P2 AC-3/AC-4/AC-5/AC-6: create form is a full page, not a modal', () => {
  it('no fixed/inset-0/backdrop-blur/z-50 classes; exactly one <h1>; Save+Cancel live in <header>; form/button ids match', () => {
    const { container } = render(
      <MashProfileManager profiles={[]} loadError={null} onReload={noop} activeRecipeProfileId={null} onCreated={noop} onUpdated={noop} onDeleted={noop} />,
    );
    fireEvent.click(screen.getByTestId('mash-new-profile'));

    for (const cls of ['fixed', 'inset-0', 'backdrop-blur', 'z-50']) {
      expect(container.querySelector(`.${cls}`)).toBeNull();
    }

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveAccessibleName('New Mash Profile');

    const header = container.querySelector('header');
    expect(header).not.toBeNull();
    const saveBtn = within(header as HTMLElement).getByRole('button', { name: /save profile/i });
    const cancelBtns = within(header as HTMLElement).getAllByRole('button', { name: 'Cancel' });
    expect(saveBtn).toBeInTheDocument();
    expect(cancelBtns).toHaveLength(2);

    expect(saveBtn).toHaveAttribute('type', 'submit');
    expect(saveBtn).toHaveAttribute('form', 'mash-profile-form');
    const form = container.querySelector('form');
    expect(form).toHaveAttribute('id', 'mash-profile-form');
  });

  it('edit mode: <h1> reads "Edit <profile name>"', () => {
    const profile = baseMashProfile({ id: 'mash-edit-1', name: 'My Schedule' });
    render(
      <MashProfileManager profiles={[profile]} loadError={null} onReload={noop} activeRecipeProfileId={null} onCreated={noop} onUpdated={noop} onDeleted={noop} />,
    );
    fireEvent.click(screen.getByTestId('mash-row-mash-edit-1'));
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveAccessibleName('Edit My Schedule');
  });
});

describe('list <-> form exclusivity', () => {
  it('opening the create form removes every profile row and the New Schedule button; Cancel restores list mode', () => {
    const profiles = [baseMashProfile({ id: 'mash-1', name: 'Sched A' }), baseMashProfile({ id: 'mash-2', name: 'Sched B' })];
    render(
      <MashProfileManager profiles={profiles} loadError={null} onReload={noop} activeRecipeProfileId={null} onCreated={noop} onUpdated={noop} onDeleted={noop} />,
    );

    expect(screen.getByTestId('mash-row-mash-1')).toBeInTheDocument();
    expect(screen.getByTestId('mash-row-mash-2')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('mash-new-profile'));

    expect(screen.queryByTestId('mash-row-mash-1')).toBeNull();
    expect(screen.queryByTestId('mash-row-mash-2')).toBeNull();
    expect(screen.queryByTestId('mash-new-profile')).toBeNull();

    const cancelButtons = screen.getAllByRole('button', { name: 'Cancel' });
    fireEvent.click(cancelButtons.find((b) => b.textContent === 'Cancel')!);

    expect(screen.getByTestId('mash-row-mash-1')).toBeInTheDocument();
    expect(screen.getByTestId('mash-row-mash-2')).toBeInTheDocument();
    expect(screen.getByTestId('mash-new-profile')).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveAccessibleName('Mash Profiles');
  });
});

describe('M5.5_P4 AC-24: no unsaved-changes / window.confirm remnants', () => {
  it('zero window.confirm calls remain in MashProfileManager.tsx/MashProfileForm.tsx', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const managerSrc = readFileSync(join(process.cwd(), 'src/components/MashProfileManager.tsx'), 'utf8');
    const formSrc = readFileSync(join(process.cwd(), 'src/components/MashProfileForm.tsx'), 'utf8');
    expect((managerSrc.match(/window\.confirm/g) ?? []).length).toBe(0);
    expect((formSrc.match(/window\.confirm/g) ?? []).length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// M5.5_P4 — ListRow + TopBar delete conversion (BUG-006 + BUG-007). No block
// above this comment is touched.
// ---------------------------------------------------------------------------

describe('M5.5_P4 AC-15/16/17: no inline edit/delete controls remain in the list', () => {
  it('renders zero -edit-/-delete- testids and zero Edit/Delete-titled controls in the list', () => {
    const profiles = [baseMashProfile({ id: 'mash-1', name: 'Sched A' }), baseMashProfile({ id: 'mash-2', name: 'Sched B' })];
    const { container } = render(
      <MashProfileManager profiles={profiles} loadError={null} onReload={noop} activeRecipeProfileId={null} onCreated={noop} onUpdated={noop} onDeleted={noop} />,
    );
    expect(container.querySelectorAll('[data-testid$="-edit-mash-1"], [data-testid$="-delete-mash-1"]')).toHaveLength(0);
    expect(container.querySelectorAll('[title="Edit"], [title="Delete"]')).toHaveLength(0);
  });

  it('MashProfileManager.tsx contains no Pencil or Trash2 import', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const src = readFileSync(join(process.cwd(), 'src/components/MashProfileManager.tsx'), 'utf8');
    expect(src).not.toContain('Pencil');
    expect(src).not.toContain('Trash2');
  });
});

describe('M5.5_P4 AC-22/23: row click opens edit mode, never deletes', () => {
  it('clicking a row shows the edit form with the name pre-filled and title "Edit <name>"; zero delete calls', () => {
    const profile = baseMashProfile({ id: 'mash-click', name: 'Clickable Schedule' });
    render(
      <MashProfileManager profiles={[profile]} loadError={null} onReload={noop} activeRecipeProfileId={null} onCreated={noop} onUpdated={noop} onDeleted={noop} />,
    );
    fireEvent.click(screen.getByTestId('mash-row-mash-click'));
    expect(screen.getByRole('heading', { level: 1 })).toHaveAccessibleName('Edit Clickable Schedule');
    expect((screen.getByLabelText(/profile name/i) as HTMLInputElement).value).toBe('Clickable Schedule');
    expect(mockedDelete).not.toHaveBeenCalled();
  });
});

describe('M5.5_P4 AC-26: mash row data preservation', () => {
  it('displays step count (plural), target pH, and the "inherit equipment default" sparge branch', () => {
    const profile = baseMashProfile({
      id: 'mash-data-1',
      name: 'Data Schedule',
      targetPh: 5.4,
      spargeTempC: null,
      steps: [
        { id: 's-1', name: 'Rest 1', type: 'Infusion', stepTempC: 67, stepTimeMin: 60, rampTimeMin: 0, infuseAmountL: null, infuseWaterTempC: 100 },
        { id: 's-2', name: 'Rest 2', type: 'Temperature', stepTempC: 72, stepTimeMin: 10, rampTimeMin: 0, infuseAmountL: null, infuseWaterTempC: 100 },
      ],
    });
    render(
      <MashProfileManager profiles={[profile]} loadError={null} onReload={noop} activeRecipeProfileId={null} onCreated={noop} onUpdated={noop} onDeleted={noop} />,
    );
    const row = screen.getByTestId('mash-row-mash-data-1');
    expect(row).toHaveTextContent('2 steps');
    expect(row).toHaveTextContent('Target pH 5.4');
    expect(row).toHaveTextContent('Sparge: inherit equipment default');
  });

  it('displays the explicit sparge temperature branch and a singular step count', () => {
    const profile = baseMashProfile({
      id: 'mash-data-2',
      name: 'Single Step Schedule',
      targetPh: 5.6,
      spargeTempC: 78,
      steps: [{ id: 's-1', name: 'Rest 1', type: 'Infusion', stepTempC: 67, stepTimeMin: 60, rampTimeMin: 0, infuseAmountL: null, infuseWaterTempC: 100 }],
    });
    render(
      <MashProfileManager profiles={[profile]} loadError={null} onReload={noop} activeRecipeProfileId={null} onCreated={noop} onUpdated={noop} onDeleted={noop} />,
    );
    const row = screen.getByTestId('mash-row-mash-data-2');
    expect(row).toHaveTextContent('1 step');
    expect(row).not.toHaveTextContent('1 steps');
    expect(row).toHaveTextContent('Sparge: 78 °C');
  });
});

describe('M5.5_P4 AC-28/29: Delete in TopBar actions, gated by mode', () => {
  it('edit mode: Delete is the first child of topbar-actions', () => {
    const profile = baseMashProfile({ id: 'mash-topbar', name: 'Topbar Schedule' });
    render(
      <MashProfileManager profiles={[profile]} loadError={null} onReload={noop} activeRecipeProfileId={null} onCreated={noop} onUpdated={noop} onDeleted={noop} />,
    );
    fireEvent.click(screen.getByTestId('mash-row-mash-topbar'));
    const actions = screen.getByTestId('topbar-actions');
    expect(within(actions).getByTestId('mash-delete')).toBe(actions.firstElementChild);
  });

  it('create mode: no Delete control and no confirm-dialog', () => {
    render(<MashProfileManager profiles={[]} loadError={null} onReload={noop} activeRecipeProfileId={null} onCreated={noop} onUpdated={noop} onDeleted={noop} />);
    fireEvent.click(screen.getByTestId('mash-new-profile'));
    expect(screen.queryByTestId('mash-delete')).not.toBeInTheDocument();
    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();
  });
});

describe('M5.5_P4 AC-36: busy lockout', () => {
  it('while a delete is in flight, both dialog buttons are disabled', async () => {
    const profile = baseMashProfile({ id: 'mash-busy', name: 'Busy Schedule' });
    let resolveDelete: () => void;
    mockedDelete.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolveDelete = resolve;
      }),
    );
    render(
      <MashProfileManager profiles={[profile]} loadError={null} onReload={noop} activeRecipeProfileId={null} onCreated={noop} onUpdated={noop} onDeleted={noop} />,
    );
    fireEvent.click(screen.getByTestId('mash-row-mash-busy'));
    fireEvent.click(screen.getByTestId('mash-delete'));
    fireEvent.click(screen.getByTestId('confirm-dialog-confirm'));

    await waitFor(() => expect(screen.getByTestId('confirm-dialog-confirm')).toBeDisabled());
    expect(screen.getByTestId('confirm-dialog-cancel')).toBeDisabled();
    resolveDelete!();
  });
});

describe('AC-16 (M26_P1 Amendment 1): MashProfileManager forwards onOpenMobileNav to its TopBar', () => {
  it('passing onOpenMobileNav renders the hamburger and clicking it calls the callback', () => {
    const onOpenMobileNav = vi.fn();
    render(
      <MashProfileManager
        profiles={[]}
        loadError={null}
        onReload={noop}
        activeRecipeProfileId={null}
        onCreated={noop}
        onUpdated={noop}
        onDeleted={noop}
        onOpenMobileNav={onOpenMobileNav}
      />,
    );
    const btn = screen.getByRole('button', { name: 'Open navigation menu' });
    fireEvent.click(btn);
    expect(onOpenMobileNav).toHaveBeenCalledTimes(1);
  });

  it('omitting onOpenMobileNav renders no hamburger button', () => {
    render(
      <MashProfileManager
        profiles={[]}
        loadError={null}
        onReload={noop}
        activeRecipeProfileId={null}
        onCreated={noop}
        onUpdated={noop}
        onDeleted={noop}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Open navigation menu' })).toBeNull();
  });

  it('forwards onOpenMobileNav into MashProfileForm when opened in create mode', () => {
    const onOpenMobileNav = vi.fn();
    render(
      <MashProfileManager
        profiles={[]}
        loadError={null}
        onReload={noop}
        activeRecipeProfileId={null}
        onCreated={noop}
        onUpdated={noop}
        onDeleted={noop}
        onOpenMobileNav={onOpenMobileNav}
      />,
    );
    fireEvent.click(screen.getByTestId('mash-new-profile'));
    const btn = screen.getByRole('button', { name: 'Open navigation menu' });
    fireEvent.click(btn);
    expect(onOpenMobileNav).toHaveBeenCalledTimes(1);
  });
});
