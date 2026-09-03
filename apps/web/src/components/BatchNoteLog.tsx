import { useState } from 'react';
import type { BatchNote, BatchNoteWriteInput } from '@truchabrew/shared-types';
import { sortBatchNotes } from '@truchabrew/calculations';
import { Pencil, Trash2, Plus, X, Check } from 'lucide-react';
import { CARD_CLASS, INPUT_CLASS } from './designSystem';
import { Button } from './ui';
import { ConfirmDialog } from './ConfirmDialog';

interface BatchNoteLogProps {
  notes: BatchNote[];
  onCreate: (input: BatchNoteWriteInput) => Promise<void>;
  onUpdate: (noteId: string, input: BatchNoteWriteInput) => Promise<void>;
  onDelete: (noteId: string) => Promise<void>;
}

function formatDisplayTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/**
 * A note list + add/edit/delete form (M5_P2 spec §1.1). Presentational —
 * `onCreate`/`onUpdate`/`onDelete` own the actual API calls, error recording
 * (the parent's `noteError` state) and the `notes` array update; this
 * component only decides whether ITS OWN form resets on success. A rejected
 * promise leaves the form (and its entered value) on screen rather than
 * clearing it — the same discipline ReadingLog uses (AC-42).
 *
 * Renders `sortBatchNotes(notes)` rather than the received array order
 * (same discipline as ReadingLog's O-1 fix) — a note is never shown out of
 * chronological order relative to when it was written, regardless of the
 * order the parent's state updates arrive in.
 */
export function BatchNoteLog({ notes, onCreate, onUpdate, onDelete }: BatchNoteLogProps) {
  const [addText, setAddText] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [busy, setBusy] = useState(false);
  const [pendingDeleteNote, setPendingDeleteNote] = useState<BatchNote | null>(null);

  const startAdd = () => setAddText('');
  const cancelAdd = () => setAddText(null);

  const submitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (addText === null) return;
    setBusy(true);
    try {
      await onCreate({ note: addText });
      setAddText(null);
    } catch {
      // Parent already recorded noteError; keep the form open, value intact.
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (n: BatchNote) => {
    setEditingId(n.id);
    setEditText(n.note);
  };
  const cancelEdit = () => {
    setEditingId(null);
    setEditText('');
  };

  const submitEdit = async (e: React.FormEvent, noteId: string) => {
    e.preventDefault();
    setBusy(true);
    try {
      await onUpdate(noteId, { note: editText });
      setEditingId(null);
      setEditText('');
    } catch {
      // Parent already recorded noteError; keep the row in edit mode.
    } finally {
      setBusy(false);
    }
  };

  const requestDelete = (n: BatchNote) => {
    setPendingDeleteNote(n);
  };

  const confirmDelete = async () => {
    if (pendingDeleteNote === null) return;
    setBusy(true);
    try {
      await onDelete(pendingDeleteNote.id);
    } catch {
      // Parent already recorded noteError; the row stays on screen.
    } finally {
      setBusy(false);
      setPendingDeleteNote(null);
    }
  };

  const cancelDelete = () => {
    setPendingDeleteNote(null);
  };

  const ordered = sortBatchNotes(notes);

  return (
    <div className={`${CARD_CLASS} !p-0 overflow-hidden`} data-testid="batch-note-log">
      <div className="px-4 py-3 flex items-center justify-between border-b border-slate-800">
        <h3 className="text-sm font-medium text-slate-100">Notes</h3>
        {addText === null && (
          <Button
            variant="primary"
            size="sm"
            type="button"
            onClick={startAdd}
            data-testid="note-add-button"
          >
            <Plus className="w-3.5 h-3.5" /> Add Note
          </Button>
        )}
      </div>

      {ordered.length === 0 && addText === null && (
        <div className="px-4 py-8 text-center text-sm text-slate-400" data-testid="note-log-empty">
          No notes yet — write one to keep a timestamped log of this batch.
        </div>
      )}

      {ordered.length > 0 && (
        <ul className="divide-y divide-slate-800">
          {ordered.map((n) =>
            editingId === n.id ? (
              <li key={n.id} data-testid={`note-row-${n.id}`} className="px-4 py-3 bg-slate-800/40">
                <form onSubmit={(e) => submitEdit(e, n.id)} className="flex flex-col gap-2">
                  <textarea
                    aria-label="Note"
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    rows={2}
                    className={`${INPUT_CLASS} text-sm`}
                  />
                  <div className="flex gap-1 justify-end">
                    <Button
                      variant="icon"
                      type="submit"
                      disabled={busy}
                      title="Save"
                      aria-label="Save note"
                      className="text-emerald-400 hover:text-emerald-300"
                    >
                      <Check className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="icon"
                      type="button"
                      onClick={cancelEdit}
                      title="Cancel"
                      aria-label="Cancel editing note"
                      className="text-slate-400 hover:text-slate-200"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </form>
              </li>
            ) : (
              <li key={n.id} data-testid={`note-row-${n.id}`} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs text-slate-400 flex items-center gap-2">
                      <span data-testid={`note-time-${n.id}`}>{formatDisplayTime(n.timestamp)}</span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400" data-testid={`note-stage-${n.id}`}>
                        {n.status}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-200 whitespace-pre-wrap">{n.note}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="icon"
                      type="button"
                      onClick={() => startEdit(n)}
                      title="Edit"
                      aria-label="Edit note"
                      data-testid={`note-edit-${n.id}`}
                      className="p-1.5 text-slate-400 hover:text-amber-400"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="icon"
                      type="button"
                      onClick={() => requestDelete(n)}
                      title="Delete"
                      aria-label="Delete note"
                      data-testid={`note-delete-${n.id}`}
                      className="p-1.5 text-slate-400 hover:text-rose-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </li>
            ),
          )}
        </ul>
      )}

      {addText !== null && (
        <form onSubmit={submitAdd} className="px-4 py-3 border-t border-slate-800 flex flex-col gap-2" data-testid="note-add-form">
          <textarea
            aria-label="New note"
            value={addText}
            onChange={(e) => setAddText(e.target.value)}
            rows={2}
            placeholder="What happened at this stage?"
            className={`${INPUT_CLASS} text-sm`}
          />
          <div className="flex gap-2 justify-end">
            <Button
              variant="primary"
              size="sm"
              type="submit"
              disabled={busy}
            >
              Save
            </Button>
            <Button
              variant="secondary"
              size="sm"
              type="button"
              onClick={cancelAdd}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}


      <ConfirmDialog
        open={pendingDeleteNote !== null}
        busy={busy}
        title="Delete this note?"
        message="This cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => {
          void confirmDelete();
        }}
        onCancel={cancelDelete}
      />
    </div>
  );
}
