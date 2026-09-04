import { useState } from 'react';
import { AlertTriangle, Database, Loader2, RefreshCw, ShieldAlert } from 'lucide-react';
import type { DatabaseBackup, RestoreMode, RestoreSummary } from '@truchabrew/shared-types';
import { restoreDatabaseBackup } from '../api/client';
import { Modal } from './Modal';
import { Button, Badge } from './ui';
import { CARD_CLASS, SECTION_HEADING_CLASS, BODY_TEXT_CLASS, METADATA_TEXT_CLASS, ERROR_STATE_CLASS } from './designSystem';

export interface BackupRestoreModalProps {
  /** Whether the modal is open. Rendered content also requires a non-null `backup` (RA-3 precedent: nothing to preview without one). */
  isOpen: boolean;
  /** The parsed-and-validated backup file to preview/restore, or null before one has been selected. */
  backup: DatabaseBackup | null;
  onClose: () => void;
  /** Test/caller hook fired with the server's RestoreSummary right before the page reload (RA-3). */
  onRestored?: (summary: RestoreSummary) => void;
}

interface EntityCountTile {
  testId: string;
  label: string;
  value: number;
}

/** The 7 countable entity families (M36_P2 EntityCounts) — `config` is a single row, not counted (see shared-types/backup.ts). */
function entityTiles(backup: DatabaseBackup): EntityCountTile[] {
  return [
    { testId: 'recipes', label: 'Recipes', value: backup.data.recipes.length },
    { testId: 'batches', label: 'Batches', value: backup.data.batches.length },
    { testId: 'equipmentProfiles', label: 'Equipment Profiles', value: backup.data.equipmentProfiles.length },
    { testId: 'mashProfiles', label: 'Mash Profiles', value: backup.data.mashProfiles.length },
    { testId: 'fermentationProfiles', label: 'Fermentation Profiles', value: backup.data.fermentationProfiles.length },
    { testId: 'waterProfiles', label: 'Water Profiles', value: backup.data.waterProfiles.length },
    { testId: 'inventoryItems', label: 'Inventory Items', value: backup.data.inventoryItems.length },
  ];
}

/**
 * Confirmation dialog for M36_P2's restore flow (spec §1.4/AC-14..AC-19).
 * Built entirely from `components/ui/` primitives plus the shared `Modal`
 * shell — the mode picker is two toggle `<Button>`s (aria-pressed), the same
 * "no native radio, a Button pair instead" pattern `Calculators.tsx`'s
 * category pills already established, so this file needs neither RA-4's
 * checkbox/radio exemption nor a new ui/ primitive (AC-19).
 */
export function BackupRestoreModal({ isOpen, backup, onClose, onRestored }: BackupRestoreModalProps) {
  const [mode, setMode] = useState<RestoreMode>('merge');
  const [isRestoring, setIsRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    if (isRestoring) return;
    setError(null);
    setMode('merge');
    onClose();
  };

  const handleConfirm = async () => {
    if (!backup) return;
    setIsRestoring(true);
    setError(null);
    try {
      const summary = await restoreDatabaseBackup({ backup, mode });
      onRestored?.(summary);
      // RA-3 — invalidate every client cache the simplest reliable way: a
      // full reload, so every open view re-fetches against the now-restored
      // database rather than this component trying to reach into every
      // other context provider individually (out of this phase's
      // Authorized Files to Modify anyway).
      onClose();
      window.location.reload();
    } catch (err: unknown) {
      // AC-18 — the error banner shows, the modal stays open, and `mode`
      // is untouched: nothing here resets state on failure.
      setError(err instanceof Error ? err.message : 'An unexpected error occurred while restoring the backup.');
    } finally {
      setIsRestoring(false);
    }
  };

  if (!backup) return null;

  const tiles = entityTiles(backup);

  return (
    <Modal isOpen={isOpen} onClose={handleClose} titleId="backup-restore-modal-title" maxWidthClass="max-w-lg" containerClassName="p-5" busy={isRestoring}>
      <div data-testid="backup-restore-modal">
        <div className="flex items-center gap-2 mb-3">
          <Database className="w-5 h-5 text-amber-500" />
          <h2 id="backup-restore-modal-title" className={SECTION_HEADING_CLASS}>
            Restore Database Backup
          </h2>
        </div>

        <div className={`${CARD_CLASS} !p-3 mb-4 grid grid-cols-1 sm:grid-cols-3 gap-2`} data-testid="backup-restore-metadata">
          <div>
            <div className={METADATA_TEXT_CLASS}>Exported</div>
            <div className="text-xs text-slate-200 font-medium">{new Date(backup.exportedAt).toLocaleString()}</div>
          </div>
          <div>
            <div className={METADATA_TEXT_CLASS}>App Version</div>
            <div className="text-xs text-slate-200 font-medium">{backup.appVersion}</div>
          </div>
          <div>
            <div className={METADATA_TEXT_CLASS}>Schema Version</div>
            <div className="text-xs text-slate-200 font-medium">{backup.schemaVersion}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4" data-testid="backup-restore-entity-counts">
          {tiles.map((tile) => (
            <div key={tile.testId} data-testid={`backup-restore-count-${tile.testId}`} className="bg-slate-800/80 border border-slate-700/60 rounded-lg p-2 text-center">
              <div className="text-lg font-bold text-amber-400 font-mono tabular-nums">{tile.value}</div>
              <div className="text-[10px] text-slate-400">{tile.label}</div>
            </div>
          ))}
        </div>

        <div className={`${BODY_TEXT_CLASS} mb-2 font-semibold`}>Restore Mode</div>
        <div className="grid grid-cols-1 gap-2 mb-4" role="group" aria-label="Restore Mode">
          <Button
            type="button"
            variant="secondary"
            data-testid="backup-restore-mode-merge"
            aria-pressed={mode === 'merge'}
            disabled={isRestoring}
            onClick={() => setMode('merge')}
            className={`!justify-start w-full h-auto text-left py-2.5 ${mode === 'merge' ? 'border-amber-500/70 bg-slate-800' : ''}`}
          >
            <RefreshCw className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span className="flex flex-col items-start gap-0.5">
              <span className="font-semibold text-slate-100">Merge into Database (Additive)</span>
              <span className="text-xs text-slate-400 font-normal">Keeps your existing data. Records that collide by ID are added as new copies.</span>
            </span>
          </Button>

          <Button
            type="button"
            variant="secondary"
            data-testid="backup-restore-mode-replace"
            aria-pressed={mode === 'replace'}
            disabled={isRestoring}
            onClick={() => setMode('replace')}
            className={`!justify-start w-full h-auto text-left py-2.5 ${mode === 'replace' ? 'border-rose-500/70 bg-slate-800' : ''}`}
          >
            <ShieldAlert className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span className="flex flex-col items-start gap-0.5">
              <span className="font-semibold text-slate-100 flex items-center gap-2">
                Replace Database (Destructive)
                <Badge variant="danger" size="sm">
                  Destructive
                </Badge>
              </span>
              <span className="text-xs text-slate-400 font-normal">
                Permanently erases all current recipes, batches, and profiles, then restores the backup's contents in their place.
              </span>
            </span>
          </Button>
        </div>

        {error && (
          <div role="alert" className={`${ERROR_STATE_CLASS} flex items-center gap-2 mb-4`} data-testid="backup-restore-error">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex items-center justify-end gap-3">
          <Button variant="secondary" size="sm" type="button" onClick={handleClose} disabled={isRestoring}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" type="button" data-testid="backup-restore-confirm-btn" onClick={handleConfirm} disabled={isRestoring}>
            {isRestoring && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {isRestoring ? 'Restoring…' : 'Confirm Restore'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
