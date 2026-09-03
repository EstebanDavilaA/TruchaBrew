import React from 'react';
import type { ApiErrorCode } from '@truchabrew/shared-types';
import { Save, AlertTriangle, Loader2, X } from 'lucide-react';
import { Button } from './ui';

export type SaveState = 'idle' | 'saving' | 'error';

interface SaveBarProps {
  saveState: SaveState;
  saveError: { code: ApiErrorCode; message: string } | null;
  isDirty: boolean;
  onSave: () => void;
  onDismissError: () => void;
}

/**
 * Idle / saving / error states with a persistent error banner. The banner is
 * not auto-dismissed by further editing (spec §Resolved Ambiguities, "A
 * failed save never touches the working recipe") — only a subsequent
 * successful save or the explicit dismiss button clears it, and dismissing
 * does NOT clear the dirty flag.
 */
export const SaveBar: React.FC<SaveBarProps> = ({ saveState, saveError, isDirty, onSave, onDismissError }) => {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <Button
          variant="primary"
          size="sm"
          type="button"
          onClick={onSave}
          disabled={saveState === 'saving'}
        >
          {saveState === 'saving' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saveState === 'saving' ? 'Saving…' : saveState === 'error' ? 'Retry Save' : 'Save Recipe'}
        </Button>
        {isDirty && saveState !== 'saving' && <span className="text-xs text-amber-400 font-medium">Unsaved changes</span>}
        {!isDirty && saveState === 'idle' && <span className="text-xs text-emerald-400 font-medium">Saved</span>}
      </div>

      {saveState === 'error' && saveError && (
        <div className="bg-rose-950/60 border border-rose-800 rounded-lg px-4 py-3 flex items-start gap-3 text-sm text-rose-200">
          <AlertTriangle className="w-4 h-4 text-rose-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <div className="font-semibold text-rose-300">Save failed ({saveError.code})</div>
            <div className="text-rose-200/90">{saveError.message}</div>
            <div className="text-rose-300/70 text-xs mt-1">Your edits are still here. Fix the issue and press Retry Save.</div>
          </div>
          <Button
            variant="icon"
            type="button"
            onClick={onDismissError}
            className="text-rose-400 hover:text-rose-200 flex-shrink-0 p-1"
            title="Dismiss (edits stay unsaved)"
            aria-label="Dismiss (edits stay unsaved)"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
};
