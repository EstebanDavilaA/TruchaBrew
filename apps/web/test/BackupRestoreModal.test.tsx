import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { DatabaseBackup, RestoreSummary } from '@truchabrew/shared-types';
import { BackupRestoreModal } from '../src/components/BackupRestoreModal';
import * as client from '../src/api/client';

vi.mock('../src/api/client', () => ({
  restoreDatabaseBackup: vi.fn(),
}));

const BACKUP: DatabaseBackup = {
  schemaVersion: 1,
  exportedAt: '2026-08-30T12:00:00.000Z',
  appVersion: '1.4.2',
  data: {
    recipes: [{}, {}] as DatabaseBackup['data']['recipes'],
    batches: [{}] as DatabaseBackup['data']['batches'],
    equipmentProfiles: [{}, {}, {}] as DatabaseBackup['data']['equipmentProfiles'],
    mashProfiles: [{}] as DatabaseBackup['data']['mashProfiles'],
    fermentationProfiles: [] as DatabaseBackup['data']['fermentationProfiles'],
    waterProfiles: [{}, {}] as DatabaseBackup['data']['waterProfiles'],
    inventoryItems: [{}, {}, {}, {}] as DatabaseBackup['data']['inventoryItems'],
    config: { id: 'default', unitSystem: 'metric', gravityUnit: 'sg', temperatureUnit: 'celsius', ibuFormula: 'tinseth', abvFormula: 'simple' },
  },
};

const SUMMARY: RestoreSummary = {
  restoredAt: '2026-08-30T12:05:00.000Z',
  mode: 'merge',
  counts: { recipes: 2, batches: 1, equipmentProfiles: 3, mashProfiles: 1, fermentationProfiles: 0, waterProfiles: 2, inventoryItems: 4 },
};

let reloadSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  reloadSpy = vi.fn();
  // jsdom's real location.reload just warns "not implemented" — stubbed so
  // RA-3's post-restore reload can be exercised and asserted (same pattern
  // as SettingsManager.test.tsx's URL.createObjectURL/anchor.click stubs).
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, reload: reloadSpy },
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('AC-14: modal launch', () => {
  it('renders nothing when backup is null, even if isOpen is true', () => {
    render(<BackupRestoreModal isOpen={true} backup={null} onClose={vi.fn()} />);
    expect(screen.queryByTestId('backup-restore-modal')).not.toBeInTheDocument();
  });

  it('renders the modal with data-testid="backup-restore-modal" when open with a backup', () => {
    render(<BackupRestoreModal isOpen={true} backup={BACKUP} onClose={vi.fn()} />);
    expect(screen.getByTestId('backup-restore-modal')).toBeInTheDocument();
  });

  it('renders nothing when isOpen is false, even with a backup present', () => {
    render(<BackupRestoreModal isOpen={false} backup={BACKUP} onClose={vi.fn()} />);
    expect(screen.queryByTestId('backup-restore-modal')).not.toBeInTheDocument();
  });

  it('shows the backup metadata: exported timestamp, app version, schema version', () => {
    render(<BackupRestoreModal isOpen={true} backup={BACKUP} onClose={vi.fn()} />);
    const metadata = screen.getByTestId('backup-restore-metadata');
    expect(metadata).toHaveTextContent('1.4.2');
    expect(metadata).toHaveTextContent('1'); // schema version
    expect(metadata.textContent).toContain(new Date(BACKUP.exportedAt).toLocaleString());
  });
});

describe('AC-15: entity count previews', () => {
  it('renders a count tile per entity family, matching the backup contents', () => {
    render(<BackupRestoreModal isOpen={true} backup={BACKUP} onClose={vi.fn()} />);
    expect(screen.getByTestId('backup-restore-count-recipes')).toHaveTextContent('2');
    expect(screen.getByTestId('backup-restore-count-batches')).toHaveTextContent('1');
    expect(screen.getByTestId('backup-restore-count-equipmentProfiles')).toHaveTextContent('3');
    expect(screen.getByTestId('backup-restore-count-mashProfiles')).toHaveTextContent('1');
    expect(screen.getByTestId('backup-restore-count-fermentationProfiles')).toHaveTextContent('0');
    expect(screen.getByTestId('backup-restore-count-waterProfiles')).toHaveTextContent('2');
    expect(screen.getByTestId('backup-restore-count-inventoryItems')).toHaveTextContent('4');
  });
});

describe('AC-16: mode selection with a clear warning for Replace', () => {
  it('defaults to Merge selected (aria-pressed) and lets Replace be selected instead', () => {
    render(<BackupRestoreModal isOpen={true} backup={BACKUP} onClose={vi.fn()} />);
    const merge = screen.getByTestId('backup-restore-mode-merge');
    const replace = screen.getByTestId('backup-restore-mode-replace');
    expect(merge).toHaveAttribute('aria-pressed', 'true');
    expect(replace).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(replace);
    expect(replace).toHaveAttribute('aria-pressed', 'true');
    expect(merge).toHaveAttribute('aria-pressed', 'false');
  });

  it('Replace carries explicit destructive warning text and a warning badge; Merge does not', () => {
    render(<BackupRestoreModal isOpen={true} backup={BACKUP} onClose={vi.fn()} />);
    const replace = screen.getByTestId('backup-restore-mode-replace');
    expect(replace).toHaveTextContent(/Destructive/i);
    expect(replace).toHaveTextContent(/permanently erases/i);

    const merge = screen.getByTestId('backup-restore-mode-merge');
    expect(merge).not.toHaveTextContent(/Destructive/i);
    expect(merge).toHaveTextContent(/additive/i);
  });
});

describe('AC-17: confirm/execute flow with a loading state', () => {
  it('confirming calls restoreDatabaseBackup with the selected mode, shows a loading state, then closes and reloads on success', async () => {
    let resolveRestore: (value: RestoreSummary) => void = () => {};
    vi.mocked(client.restoreDatabaseBackup).mockReturnValueOnce(
      new Promise<RestoreSummary>((resolve) => {
        resolveRestore = resolve;
      }),
    );

    const onClose = vi.fn();
    render(<BackupRestoreModal isOpen={true} backup={BACKUP} onClose={onClose} />);

    fireEvent.click(screen.getByTestId('backup-restore-confirm-btn'));

    await waitFor(() => expect(screen.getByTestId('backup-restore-confirm-btn')).toBeDisabled());
    expect(screen.getByText('Restoring…')).toBeInTheDocument();

    resolveRestore(SUMMARY);

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(reloadSpy).toHaveBeenCalledTimes(1);
    expect(client.restoreDatabaseBackup).toHaveBeenCalledWith({ backup: BACKUP, mode: 'merge' });
  });

  it('sends mode: "replace" when Replace is selected before confirming', async () => {
    vi.mocked(client.restoreDatabaseBackup).mockResolvedValueOnce(SUMMARY);
    render(<BackupRestoreModal isOpen={true} backup={BACKUP} onClose={vi.fn()} />);

    fireEvent.click(screen.getByTestId('backup-restore-mode-replace'));
    fireEvent.click(screen.getByTestId('backup-restore-confirm-btn'));

    await waitFor(() => expect(client.restoreDatabaseBackup).toHaveBeenCalledWith({ backup: BACKUP, mode: 'replace' }));
  });
});

describe('AC-18: accessible error banner on failure, without dismissing or corrupting state', () => {
  it('shows an accessible error message when the restore API call fails, keeps the modal open, and does not reload', async () => {
    vi.mocked(client.restoreDatabaseBackup).mockRejectedValueOnce(new Error('restore blew up'));
    const onClose = vi.fn();
    render(<BackupRestoreModal isOpen={true} backup={BACKUP} onClose={onClose} />);

    fireEvent.click(screen.getByTestId('backup-restore-mode-replace'));
    fireEvent.click(screen.getByTestId('backup-restore-confirm-btn'));

    await waitFor(() => expect(screen.getByTestId('backup-restore-error')).toBeInTheDocument());
    expect(screen.getByTestId('backup-restore-error')).toHaveAttribute('role', 'alert');
    expect(screen.getByText('restore blew up')).toBeInTheDocument();

    // Modal is still open, mode selection survived the failure, and no
    // reload/close happened.
    expect(screen.getByTestId('backup-restore-modal')).toBeInTheDocument();
    expect(screen.getByTestId('backup-restore-mode-replace')).toHaveAttribute('aria-pressed', 'true');
    expect(onClose).not.toHaveBeenCalled();
    expect(reloadSpy).not.toHaveBeenCalled();

    // The confirm button is usable again (not stuck disabled/loading).
    expect(screen.getByTestId('backup-restore-confirm-btn')).not.toBeDisabled();
  });
});

describe('AC-19: zero raw buttons/inputs — the mode picker uses Button toggles, not native radios', () => {
  it('every actionable control is a <button> rendered by the Button primitive', () => {
    render(<BackupRestoreModal isOpen={true} backup={BACKUP} onClose={vi.fn()} />);
    const modal = screen.getByTestId('backup-restore-modal');
    expect(modal.querySelectorAll('input')).toHaveLength(0);
    expect(modal.querySelectorAll('select')).toHaveLength(0);
    for (const btn of Array.from(modal.querySelectorAll('button'))) {
      expect(btn.getAttribute('type')).toBe('button');
    }
  });
});
