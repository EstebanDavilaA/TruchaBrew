import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import type { UserConfig } from '@truchabrew/shared-types';
import { EquipmentManager } from '../src/components/EquipmentManager';
import { ConfigProvider } from '../src/context/ConfigContext';
import { ApiClientError } from '../src/api/client';
import { baseEquipment } from './helpers/fixtures';

vi.mock('../src/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/api/client')>();
  return {
    ...actual,
    createEquipmentProfile: vi.fn(),
    updateEquipmentProfile: vi.fn(),
    deleteEquipmentProfile: vi.fn(),
  };
});

import { createEquipmentProfile, updateEquipmentProfile, deleteEquipmentProfile } from '../src/api/client';

const mockedCreate = vi.mocked(createEquipmentProfile);
const mockedUpdate = vi.mocked(updateEquipmentProfile);
const mockedDelete = vi.mocked(deleteEquipmentProfile);

const noop = () => {};

// M7_P2 §1.3/Ambiguity 9 — EquipmentManager now reads config via
// useConfig(), so every render is wrapped in a real ConfigProvider (same
// fetch-stub pattern BatchDetail.test.tsx established). Defaults to
// 'metric' unless a test calls stubConfigFetch with an override first.
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

function stubConfigFetch(config: Partial<UserConfig> = {}) {
  const testConfig = { ...DEFAULT_TEST_CONFIG, ...config };
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === '/api/config') return Promise.resolve(jsonResponse(testConfig));
      return Promise.reject(new Error(`Unexpected global fetch call in EquipmentManager.test.tsx: ${url}`));
    }),
  );
}

beforeEach(() => {
  mockedCreate.mockReset();
  mockedUpdate.mockReset();
  mockedDelete.mockReset();
  stubConfigFetch();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Web: equipment list load fails', () => {
  it('renders an error panel with Retry, and never the empty state', () => {
    const onReload = vi.fn();
    render(
      <ConfigProvider><EquipmentManager
        profiles={[]}
        loadError="Request failed with status 500."
        onReload={onReload}
        activeRecipeEquipmentId={null}
        onCreated={noop}
        onUpdated={noop}
        onDeleted={noop}
      /></ConfigProvider>,
    );

    expect(screen.getByText("Couldn't load your equipment profiles")).toBeInTheDocument();
    expect(screen.getByText('Request failed with status 500.')).toBeInTheDocument();
    expect(screen.queryByText(/no equipment profiles yet/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(onReload).toHaveBeenCalledTimes(1);
  });
});

describe('Web: zero equipment profiles, no load error', () => {
  it('renders the empty state, not an error panel', () => {
    render(
      <ConfigProvider><EquipmentManager
        profiles={[]}
        loadError={null}
        onReload={noop}
        activeRecipeEquipmentId={null}
        onCreated={noop}
        onUpdated={noop}
        onDeleted={noop}
      /></ConfigProvider>,
    );
    expect(screen.getByText(/no equipment profiles yet/i)).toBeInTheDocument();
    expect(screen.queryByText(/couldn't load/i)).not.toBeInTheDocument();
  });
});

describe("AC-35: Delete is disabled for the open recipe's profile", () => {
  it('disables Delete with a visible reason for the active profile; every other profile stays enabled', () => {
    const profiles = [baseEquipment({ id: 'eq-1', name: 'Kit A' }), baseEquipment({ id: 'eq-2', name: 'Kit B' })];
    render(
      <ConfigProvider><EquipmentManager
        profiles={profiles}
        loadError={null}
        onReload={noop}
        activeRecipeEquipmentId="eq-1"
        onCreated={noop}
        onUpdated={noop}
        onDeleted={noop}
      /></ConfigProvider>,
    );

    fireEvent.click(screen.getByTestId('equipment-row-eq-1'));
    const blockedDelete = screen.getByTestId('equipment-delete');
    expect(blockedDelete).toBeDisabled();
    expect(blockedDelete).toHaveAttribute('title', 'In use by the recipe currently open in the editor');
    const cancelButtons = screen.getAllByRole('button', { name: 'Cancel' });
    fireEvent.click(cancelButtons.find((b) => b.textContent === 'Cancel')!);

    fireEvent.click(screen.getByTestId('equipment-row-eq-2'));
    expect(screen.getByTestId('equipment-delete')).not.toBeDisabled();
  });
});

describe('create flow', () => {
  it('creating a profile calls createEquipmentProfile and onCreated with the result, then closes the form', async () => {
    const created = baseEquipment({ id: 'new-id', name: 'Brand New Kit' });
    mockedCreate.mockResolvedValueOnce(created);
    const onCreated = vi.fn();

    render(
      <ConfigProvider><EquipmentManager
        profiles={[]}
        loadError={null}
        onReload={noop}
        activeRecipeEquipmentId={null}
        onCreated={onCreated}
        onUpdated={noop}
        onDeleted={noop}
      /></ConfigProvider>,
    );

    fireEvent.click(screen.getByTestId('equipment-new-profile'));
    fireEvent.change(screen.getByLabelText(/profile name/i), { target: { value: 'Brand New Kit' } });
    fireEvent.click(screen.getByRole('button', { name: /save profile/i }));

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(created));
    expect(mockedCreate).toHaveBeenCalledTimes(1);
    expect(mockedCreate.mock.calls[0][0]).toMatchObject({ name: 'Brand New Kit', derivedFromEquipmentId: null });
    expect(screen.queryByRole('button', { name: /save profile/i })).not.toBeInTheDocument();
  });
});

describe('edit flow', () => {
  it('pre-fills the form from the target profile and calls updateEquipmentProfile with the id and full body', async () => {
    const existing = baseEquipment({ id: 'eq-9', name: 'Old Name', mashWaterRatioLPerKg: 3.0 });
    const updated = { ...existing, name: 'New Name' };
    mockedUpdate.mockResolvedValueOnce(updated);
    const onUpdated = vi.fn();

    render(
      <ConfigProvider><EquipmentManager
        profiles={[existing]}
        loadError={null}
        onReload={noop}
        activeRecipeEquipmentId={null}
        onCreated={noop}
        onUpdated={onUpdated}
        onDeleted={noop}
      /></ConfigProvider>,
    );

    fireEvent.click(screen.getByTestId('equipment-row-eq-9'));
    const nameInput = screen.getByLabelText(/profile name/i) as HTMLInputElement;
    expect(nameInput.value).toBe('Old Name');

    fireEvent.change(nameInput, { target: { value: 'New Name' } });
    fireEvent.click(screen.getByRole('button', { name: /save profile/i }));

    await waitFor(() => expect(onUpdated).toHaveBeenCalledWith(updated));
    expect(mockedUpdate).toHaveBeenCalledWith('eq-9', expect.objectContaining({ name: 'New Name', mashWaterRatioLPerKg: 3.0 }));
    // derivedFromEquipmentId must never be part of the update body (server-owned).
    expect(mockedUpdate.mock.calls[0][1]).not.toHaveProperty('derivedFromEquipmentId');
  });
});

describe('delete flow', () => {
  it('deleting an unreferenced profile calls deleteEquipmentProfile then onDeleted', async () => {
    const profile = baseEquipment({ id: 'eq-5', name: 'Deletable' });
    mockedDelete.mockResolvedValueOnce(undefined);
    const onDeleted = vi.fn();

    render(
      <ConfigProvider><EquipmentManager
        profiles={[profile]}
        loadError={null}
        onReload={noop}
        activeRecipeEquipmentId={null}
        onCreated={noop}
        onUpdated={noop}
        onDeleted={onDeleted}
      /></ConfigProvider>,
    );

    fireEvent.click(screen.getByTestId('equipment-row-eq-5'));
    fireEvent.click(screen.getByTestId('equipment-delete'));
    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
    expect(mockedDelete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('confirm-dialog-confirm'));

    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith('eq-5'));
    expect(mockedDelete).toHaveBeenCalledTimes(1);
    expect(mockedDelete).toHaveBeenCalledWith('eq-5');
    // Success returns to the list.
    expect(screen.getByTestId('equipment-new-profile')).toBeInTheDocument();
  });

  it('a 409 EQUIPMENT_IN_USE failure shows the server message inline and does not call onDeleted', async () => {
    const profile = baseEquipment({ id: 'eq-6', name: 'Popular Kit' });
    mockedDelete.mockRejectedValueOnce(
      new ApiClientError('EQUIPMENT_IN_USE', 'Cannot delete — still used by recipe "Trucha West Coast IPA".'),
    );
    const onDeleted = vi.fn();

    render(
      <ConfigProvider><EquipmentManager
        profiles={[profile]}
        loadError={null}
        onReload={noop}
        activeRecipeEquipmentId={null}
        onCreated={noop}
        onUpdated={noop}
        onDeleted={onDeleted}
      /></ConfigProvider>,
    );

    fireEvent.click(screen.getByTestId('equipment-row-eq-6'));
    fireEvent.click(screen.getByTestId('equipment-delete'));
    fireEvent.click(screen.getByTestId('confirm-dialog-confirm'));

    await waitFor(() => {
      expect(screen.getByText('Cannot delete — still used by recipe "Trucha West Coast IPA".')).toBeInTheDocument();
    });
    expect(onDeleted).not.toHaveBeenCalled();
    // Dialog closes, form stays open, list is not shown.
    await waitFor(() => expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument());
    expect((screen.getByLabelText(/profile name/i) as HTMLInputElement).value).toBe('Popular Kit');
    expect(screen.queryByTestId('equipment-new-profile')).not.toBeInTheDocument();
  });

  it('cancelling the dialog aborts: zero API calls, form stays open with values intact', () => {
    const profile = baseEquipment({ id: 'eq-7', name: 'Untouched Kit' });
    render(
      <ConfigProvider><EquipmentManager
        profiles={[profile]}
        loadError={null}
        onReload={noop}
        activeRecipeEquipmentId={null}
        onCreated={noop}
        onUpdated={noop}
        onDeleted={noop}
      /></ConfigProvider>,
    );

    fireEvent.click(screen.getByTestId('equipment-row-eq-7'));
    fireEvent.click(screen.getByTestId('equipment-delete'));
    fireEvent.click(screen.getByTestId('confirm-dialog-cancel'));

    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();
    expect(mockedDelete).not.toHaveBeenCalled();
    expect((screen.getByLabelText(/profile name/i) as HTMLInputElement).value).toBe('Untouched Kit');
  });
});

describe('AC-54: validation identifies the field', () => {
  it('a blank/whitespace name shows "Name is required" and disables Save', () => {
    render(
      <ConfigProvider><EquipmentManager
        profiles={[]}
        loadError={null}
        onReload={noop}
        activeRecipeEquipmentId={null}
        onCreated={noop}
        onUpdated={noop}
        onDeleted={noop}
      /></ConfigProvider>,
    );
    fireEvent.click(screen.getByTestId('equipment-new-profile'));
    fireEvent.change(screen.getByLabelText(/profile name/i), { target: { value: '   ' } });

    expect(screen.getByText(/name is required/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save profile/i })).toBeDisabled();
  });

  it('mashWaterRatioLPerKg = 0 shows a message naming that field and disables Save', () => {
    render(
      <ConfigProvider><EquipmentManager
        profiles={[]}
        loadError={null}
        onReload={noop}
        activeRecipeEquipmentId={null}
        onCreated={noop}
        onUpdated={noop}
        onDeleted={noop}
      /></ConfigProvider>,
    );
    fireEvent.click(screen.getByTestId('equipment-new-profile'));
    fireEvent.change(screen.getByLabelText(/profile name/i), { target: { value: 'Valid Name' } });
    fireEvent.change(screen.getByLabelText(/mash water ratio/i), { target: { value: '0' } });

    expect(screen.getByText(/Mash Water Ratio: Must be greater than 0/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save profile/i })).toBeDisabled();
  });
});

describe('Web: equipment save fails', () => {
  it('a failed create keeps the form open with the entered values and an error banner; onCreated is not called', async () => {
    mockedCreate.mockRejectedValueOnce(new ApiClientError('VALIDATION_FAILED', 'batchSizeL must be > 0.'));
    const onCreated = vi.fn();

    render(
      <ConfigProvider><EquipmentManager
        profiles={[]}
        loadError={null}
        onReload={noop}
        activeRecipeEquipmentId={null}
        onCreated={onCreated}
        onUpdated={noop}
        onDeleted={noop}
      /></ConfigProvider>,
    );
    fireEvent.click(screen.getByTestId('equipment-new-profile'));
    fireEvent.change(screen.getByLabelText(/profile name/i), { target: { value: 'Will Fail' } });
    fireEvent.click(screen.getByRole('button', { name: /save profile/i }));

    await waitFor(() => {
      expect(screen.getByText('batchSizeL must be > 0.')).toBeInTheDocument();
    });
    expect(onCreated).not.toHaveBeenCalled();
    expect((screen.getByLabelText(/profile name/i) as HTMLInputElement).value).toBe('Will Fail');
    expect(screen.getByRole('button', { name: /save profile/i })).toBeInTheDocument(); // form still open
  });
});

// ---------------------------------------------------------------------------
// M5.5_P2 — new blocks for the modal -> full-page conversion (§1.2's bounded
// new-block allowance). No existing block above this comment is touched.
// ---------------------------------------------------------------------------

describe('M5.5_P2 AC-2/AC-4/AC-5/AC-6: create form is a full page, not a modal', () => {
  it('no fixed/inset-0/backdrop-blur/z-50 classes; exactly one <h1>; Save+Cancel live in <header>; form/button ids match', () => {
    const { container } = render(
      <ConfigProvider><EquipmentManager profiles={[]} loadError={null} onReload={noop} activeRecipeEquipmentId={null} onCreated={noop} onUpdated={noop} onDeleted={noop} /></ConfigProvider>,
    );
    fireEvent.click(screen.getByTestId('equipment-new-profile'));

    for (const cls of ['fixed', 'inset-0', 'backdrop-blur', 'z-50']) {
      expect(container.querySelector(`.${cls}`)).toBeNull();
    }

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveAccessibleName('New Equipment Profile');

    const header = container.querySelector('header');
    expect(header).not.toBeNull();
    const saveBtn = within(header as HTMLElement).getByRole('button', { name: /save profile/i });
    // Two controls share the accessible name "Cancel" by design (leading icon + text button).
    const cancelBtns = within(header as HTMLElement).getAllByRole('button', { name: 'Cancel' });
    expect(saveBtn).toBeInTheDocument();
    expect(cancelBtns).toHaveLength(2);

    expect(saveBtn).toHaveAttribute('type', 'submit');
    expect(saveBtn).toHaveAttribute('form', 'equipment-profile-form');
    const form = container.querySelector('form');
    expect(form).toHaveAttribute('id', 'equipment-profile-form');
  });

  it('edit mode: <h1> reads "Edit <profile name>"', () => {
    const profile = baseEquipment({ id: 'eq-edit-1', name: 'My Kit' });
    render(
      <ConfigProvider><EquipmentManager profiles={[profile]} loadError={null} onReload={noop} activeRecipeEquipmentId={null} onCreated={noop} onUpdated={noop} onDeleted={noop} /></ConfigProvider>,
    );
    fireEvent.click(screen.getByTestId('equipment-row-eq-edit-1'));
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveAccessibleName('Edit My Kit');
  });
});

describe('M5.5_P2 AC-7/AC-8: list <-> form exclusivity', () => {
  it('opening the create form removes every profile row and the New Profile button; Cancel restores list mode', () => {
    const profiles = [baseEquipment({ id: 'eq-1', name: 'Kit A' }), baseEquipment({ id: 'eq-2', name: 'Kit B' })];
    render(
      <ConfigProvider><EquipmentManager profiles={profiles} loadError={null} onReload={noop} activeRecipeEquipmentId={null} onCreated={noop} onUpdated={noop} onDeleted={noop} /></ConfigProvider>,
    );

    expect(screen.getByTestId('equipment-row-eq-1')).toBeInTheDocument();
    expect(screen.getByTestId('equipment-row-eq-2')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('equipment-new-profile'));

    expect(screen.queryByTestId('equipment-row-eq-1')).toBeNull();
    expect(screen.queryByTestId('equipment-row-eq-2')).toBeNull();
    expect(screen.queryByTestId('equipment-new-profile')).toBeNull();

    // Two controls share the accessible name "Cancel" by design (the leading
    // ArrowLeft icon button and the text button) — disambiguate by text content.
    const cancelButtons = screen.getAllByRole('button', { name: 'Cancel' });
    fireEvent.click(cancelButtons.find((b) => b.textContent === 'Cancel')!);

    expect(screen.getByTestId('equipment-row-eq-1')).toBeInTheDocument();
    expect(screen.getByTestId('equipment-row-eq-2')).toBeInTheDocument();
    expect(screen.getByTestId('equipment-new-profile')).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveAccessibleName('Equipment Profiles');
  });
});

describe('M5.5_P2 AC-9/AC-10: list-mode degenerate cases render inside the new TopBar shell', () => {
  it('zero profiles, no load error: one <h1> route title plus the existing empty state', () => {
    render(<ConfigProvider><EquipmentManager profiles={[]} loadError={null} onReload={noop} activeRecipeEquipmentId={null} onCreated={noop} onUpdated={noop} onDeleted={noop} /></ConfigProvider>);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveAccessibleName('Equipment Profiles');
    expect(screen.getByText(/no equipment profiles yet/i)).toBeInTheDocument();
  });

  it('a load error: error panel + Retry render, empty state does not, New Profile stays present and enabled', () => {
    render(
      <ConfigProvider><EquipmentManager
        profiles={[]}
        loadError="Request failed with status 500."
        onReload={noop}
        activeRecipeEquipmentId={null}
        onCreated={noop}
        onUpdated={noop}
        onDeleted={noop}
      /></ConfigProvider>,
    );
    expect(screen.getByText("Couldn't load your equipment profiles")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    expect(screen.queryByText(/no equipment profiles yet/i)).not.toBeInTheDocument();
    const newBtn = screen.getByTestId('equipment-new-profile');
    expect(newBtn).toBeInTheDocument();
    expect(newBtn).not.toBeDisabled();
  });
});

describe('M5.5_P4 AC-24: no unsaved-changes / window.confirm remnants', () => {
  it('the only window.confirm call in EquipmentManager.tsx/EquipmentForm.tsx is zero — both delete flows now use ConfirmDialog', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const managerSrc = readFileSync(join(process.cwd(), 'src/components/EquipmentManager.tsx'), 'utf8');
    const formSrc = readFileSync(join(process.cwd(), 'src/components/EquipmentForm.tsx'), 'utf8');
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
    const profiles = [baseEquipment({ id: 'eq-1', name: 'Kit A' }), baseEquipment({ id: 'eq-2', name: 'Kit B' })];
    const { container } = render(
      <ConfigProvider><EquipmentManager profiles={profiles} loadError={null} onReload={noop} activeRecipeEquipmentId={null} onCreated={noop} onUpdated={noop} onDeleted={noop} /></ConfigProvider>,
    );
    expect(container.querySelectorAll('[data-testid$="-edit-eq-1"], [data-testid$="-delete-eq-1"]')).toHaveLength(0);
    expect(container.querySelectorAll('[title="Edit"], [title="Delete"]')).toHaveLength(0);
  });

  it('EquipmentManager.tsx contains no Pencil or Trash2 import', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const src = readFileSync(join(process.cwd(), 'src/components/EquipmentManager.tsx'), 'utf8');
    expect(src).not.toContain('Pencil');
    expect(src).not.toContain('Trash2');
  });
});

describe('M5.5_P4 AC-22/23: row click opens edit mode, never deletes', () => {
  it('clicking a row shows the edit form with the name pre-filled and title "Edit <name>"; zero delete calls', () => {
    const profile = baseEquipment({ id: 'eq-click', name: 'Clickable Kit' });
    render(
      <ConfigProvider><EquipmentManager profiles={[profile]} loadError={null} onReload={noop} activeRecipeEquipmentId={null} onCreated={noop} onUpdated={noop} onDeleted={noop} /></ConfigProvider>,
    );
    fireEvent.click(screen.getByTestId('equipment-row-eq-click'));
    expect(screen.getByRole('heading', { level: 1 })).toHaveAccessibleName('Edit Clickable Kit');
    expect((screen.getByLabelText(/profile name/i) as HTMLInputElement).value).toBe('Clickable Kit');
    expect(mockedDelete).not.toHaveBeenCalled();
  });
});

describe('M5.5_P4 AC-25: equipment row data preservation', () => {
  it('displays all six metadata strings verbatim', () => {
    const profile = baseEquipment({
      id: 'eq-data',
      name: 'Data Kit',
      batchSizeL: 20,
      boilTimeMin: 60,
      brewhouseEfficiencyPct: 75,
      hopUtilizationPct: 87,
      mashWaterRatioLPerKg: 3,
      grainAbsorptionLPerKg: 0.96,
    });
    render(
      <ConfigProvider><EquipmentManager profiles={[profile]} loadError={null} onReload={noop} activeRecipeEquipmentId={null} onCreated={noop} onUpdated={noop} onDeleted={noop} /></ConfigProvider>,
    );
    const row = screen.getByTestId('equipment-row-eq-data');
    // M7_P2 §4 Deviation 1: batchSizeL now routes through formatVolume,
    // whose metric default is 1 fraction digit ("20 L" -> "20.0 L") under
    // the default metric config this test renders with (stubConfigFetch()'s
    // default). The L/kg ratio rows are unchanged (Ambiguity 5) and keep
    // their bare, unformatted values.
    expect(row).toHaveTextContent('20.0 L batch');
    expect(row).toHaveTextContent('60 min boil');
    expect(row).toHaveTextContent('75% brewhouse eff.');
    expect(row).toHaveTextContent('87% hop util.');
    expect(row).toHaveTextContent('3 L/kg mash water');
    expect(row).toHaveTextContent('0.96 L/kg absorption');
  });
});

// ---------------------------------------------------------------------------
// M7_P2 §1.3/AC-13 — batch size converts through formatVolume; the L/kg
// ratio rows stay unconverted (Ambiguity 5).
// ---------------------------------------------------------------------------

describe('AC-13: EquipmentManager batch size converts; ratio rows do not', () => {
  it('renders 5.28 gal batch, and still 3 L/kg mash water / 1.1 L/kg absorption, under "us"', async () => {
    stubConfigFetch({ unitSystem: 'us' });
    const profile = baseEquipment({ id: 'eq-us', batchSizeL: 20, mashWaterRatioLPerKg: 3, grainAbsorptionLPerKg: 1.1 });
    render(
      <ConfigProvider><EquipmentManager profiles={[profile]} loadError={null} onReload={noop} activeRecipeEquipmentId={null} onCreated={noop} onUpdated={noop} onDeleted={noop} /></ConfigProvider>,
    );
    const row = screen.getByTestId('equipment-row-eq-us');
    await waitFor(() => expect(row).toHaveTextContent('5.28 gal batch'));
    expect(row).toHaveTextContent('3 L/kg mash water');
    expect(row).toHaveTextContent('1.1 L/kg absorption');
  });

  it('renders 20.0 L batch under "metric"', async () => {
    stubConfigFetch({ unitSystem: 'metric' });
    const profile = baseEquipment({ id: 'eq-metric', batchSizeL: 20 });
    render(
      <ConfigProvider><EquipmentManager profiles={[profile]} loadError={null} onReload={noop} activeRecipeEquipmentId={null} onCreated={noop} onUpdated={noop} onDeleted={noop} /></ConfigProvider>,
    );
    const row = screen.getByTestId('equipment-row-eq-metric');
    expect(row).toHaveTextContent('20.0 L batch');
  });
});

describe('M5.5_P4 AC-28/29: Delete in TopBar actions, gated by mode', () => {
  it('edit mode: Delete is the first child of topbar-actions', () => {
    const profile = baseEquipment({ id: 'eq-topbar', name: 'Topbar Kit' });
    render(
      <ConfigProvider><EquipmentManager profiles={[profile]} loadError={null} onReload={noop} activeRecipeEquipmentId={null} onCreated={noop} onUpdated={noop} onDeleted={noop} /></ConfigProvider>,
    );
    fireEvent.click(screen.getByTestId('equipment-row-eq-topbar'));
    const actions = screen.getByTestId('topbar-actions');
    expect(within(actions).getByTestId('equipment-delete')).toBe(actions.firstElementChild);
  });

  it('create mode: no Delete control and no confirm-dialog', () => {
    render(
      <ConfigProvider><EquipmentManager profiles={[]} loadError={null} onReload={noop} activeRecipeEquipmentId={null} onCreated={noop} onUpdated={noop} onDeleted={noop} /></ConfigProvider>,
    );
    fireEvent.click(screen.getByTestId('equipment-new-profile'));
    expect(screen.queryByTestId('equipment-delete')).not.toBeInTheDocument();
    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();
  });
});

describe('M5.5_P4 AC-36: busy lockout', () => {
  it('while a delete is in flight, both dialog buttons are disabled', async () => {
    const profile = baseEquipment({ id: 'eq-busy', name: 'Busy Kit' });
    let resolveDelete: () => void;
    mockedDelete.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolveDelete = resolve;
      }),
    );
    render(
      <ConfigProvider><EquipmentManager profiles={[profile]} loadError={null} onReload={noop} activeRecipeEquipmentId={null} onCreated={noop} onUpdated={noop} onDeleted={noop} /></ConfigProvider>,
    );
    fireEvent.click(screen.getByTestId('equipment-row-eq-busy'));
    fireEvent.click(screen.getByTestId('equipment-delete'));
    fireEvent.click(screen.getByTestId('confirm-dialog-confirm'));

    await waitFor(() => expect(screen.getByTestId('confirm-dialog-confirm')).toBeDisabled());
    expect(screen.getByTestId('confirm-dialog-cancel')).toBeDisabled();
    resolveDelete!();
  });
});

describe('AC-16 (M26_P1 Amendment 1): EquipmentManager forwards onOpenMobileNav to its TopBar', () => {
  it('passing onOpenMobileNav renders the hamburger and clicking it calls the callback', () => {
    const onOpenMobileNav = vi.fn();
    render(
      <ConfigProvider>
        <EquipmentManager
          profiles={[]}
          loadError={null}
          onReload={noop}
          activeRecipeEquipmentId={null}
          onCreated={noop}
          onUpdated={noop}
          onDeleted={noop}
          onOpenMobileNav={onOpenMobileNav}
        />
      </ConfigProvider>,
    );
    const btn = screen.getByRole('button', { name: 'Open navigation menu' });
    fireEvent.click(btn);
    expect(onOpenMobileNav).toHaveBeenCalledTimes(1);
  });

  it('omitting onOpenMobileNav renders no hamburger button', () => {
    render(
      <ConfigProvider>
        <EquipmentManager
          profiles={[]}
          loadError={null}
          onReload={noop}
          activeRecipeEquipmentId={null}
          onCreated={noop}
          onUpdated={noop}
          onDeleted={noop}
        />
      </ConfigProvider>,
    );
    expect(screen.queryByRole('button', { name: 'Open navigation menu' })).toBeNull();
  });

  it('forwards onOpenMobileNav into EquipmentForm when opened in create mode', () => {
    const onOpenMobileNav = vi.fn();
    render(
      <ConfigProvider>
        <EquipmentManager
          profiles={[]}
          loadError={null}
          onReload={noop}
          activeRecipeEquipmentId={null}
          onCreated={noop}
          onUpdated={noop}
          onDeleted={noop}
          onOpenMobileNav={onOpenMobileNav}
        />
      </ConfigProvider>,
    );
    fireEvent.click(screen.getByTestId('equipment-new-profile'));
    const btn = screen.getByRole('button', { name: 'Open navigation menu' });
    fireEvent.click(btn);
    expect(onOpenMobileNav).toHaveBeenCalledTimes(1);
  });
});
