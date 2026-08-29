import { useState } from 'react';
import type { Reading, ReadingWriteInput } from '@truchabrew/shared-types';
import { sortReadings } from '@truchabrew/calculations';
import { Pencil, Trash2, Plus, X, Check, Calculator } from 'lucide-react';
import { CARD_CLASS } from './designSystem';
import { RefractometerFermentationModal } from './RefractometerFermentationModal';
import { ConfirmDialog } from './ConfirmDialog';
import { Button, Input, NumberInput, Table, TableHeaderCell, TableCell } from './ui';


interface ReadingLogProps {
  readings: Reading[];
  initialOg?: number | null;
  onCreate: (input: ReadingWriteInput) => Promise<void>;
  onUpdate: (readingId: string, input: ReadingWriteInput) => Promise<void>;
  onDelete: (readingId: string) => Promise<void>;
}

interface ReadingFormState {
  readingTime: string; // <input type="datetime-local"> value, LOCAL time
  sg: string;
  tempC: string;
  ph: string;
  pressurePsi: string;
  comment: string;
}

/** `datetime-local` inputs speak LOCAL wall-clock time, not UTC — Date's own
 * getters (not toISOString, which is UTC) build that value from an ISO instant. */
function isoToDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** The inverse: a `datetime-local` value (local time, no timezone) -> a UTC 'Z'-suffixed ISO instant. */
function datetimeLocalValueToIso(value: string): string {
  return new Date(value).toISOString();
}

function formatDisplayTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function emptyFormState(): ReadingFormState {
  return {
    readingTime: isoToDatetimeLocalValue(new Date().toISOString()),
    sg: '',
    tempC: '',
    ph: '',
    pressurePsi: '',
    comment: '',
  };
}

function formStateFromReading(r: Reading): ReadingFormState {
  return {
    readingTime: isoToDatetimeLocalValue(r.readingTime),
    sg: r.sg === null ? '' : String(r.sg),
    tempC: r.tempC === null ? '' : String(r.tempC),
    ph: r.ph === null ? '' : String(r.ph),
    pressurePsi: r.pressurePsi === null ? '' : String(r.pressurePsi),
    comment: r.comment,
  };
}

function toWriteInput(state: ReadingFormState): ReadingWriteInput {
  return {
    readingTime: datetimeLocalValueToIso(state.readingTime),
    sg: state.sg === '' ? null : parseFloat(state.sg),
    tempC: state.tempC === '' ? null : parseFloat(state.tempC),
    ph: state.ph === '' ? null : parseFloat(state.ph),
    pressurePsi: state.pressurePsi === '' ? null : parseFloat(state.pressurePsi),
    comment: state.comment,
  };
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="flex flex-col text-xs text-slate-400 gap-1">
      {label}
      {children}
    </label>
  );
}

function ReadingFormFields({
  state,
  setState,
  idPrefix,
}: {
  state: ReadingFormState;
  setState: (updater: (prev: ReadingFormState) => ReadingFormState) => void;
  idPrefix: string;
}) {
  const update = (patch: Partial<ReadingFormState>) => setState((prev) => ({ ...prev, ...patch }));
  return (
    <>
      <Field label="Time" htmlFor={`${idPrefix}-readingTime`}>
        <Input
          id={`${idPrefix}-readingTime`}
          type="datetime-local"
          size="sm"
          value={state.readingTime}
          onChange={(e) => update({ readingTime: e.target.value })}
          required
        />
      </Field>
      <Field label="SG" htmlFor={`${idPrefix}-sg`}>
        <NumberInput
          id={`${idPrefix}-sg`}
          step="0.001"
          size="sm"
          width="sm"
          value={state.sg}
          onChange={(e) => update({ sg: e.target.value })}
        />
      </Field>
      <Field label="Temp (°C)" htmlFor={`${idPrefix}-tempC`}>
        <NumberInput
          id={`${idPrefix}-tempC`}
          step="0.1"
          size="sm"
          width="sm"
          value={state.tempC}
          onChange={(e) => update({ tempC: e.target.value })}
        />
      </Field>
      <Field label="pH" htmlFor={`${idPrefix}-ph`}>
        <NumberInput
          id={`${idPrefix}-ph`}
          step="0.01"
          size="sm"
          width="sm"
          value={state.ph}
          onChange={(e) => update({ ph: e.target.value })}
        />
      </Field>
      <Field label="Pressure (psi)" htmlFor={`${idPrefix}-pressurePsi`}>
        <NumberInput
          id={`${idPrefix}-pressurePsi`}
          step="0.1"
          size="sm"
          width="sm"
          value={state.pressurePsi}
          onChange={(e) => update({ pressurePsi: e.target.value })}
        />
      </Field>
      <Field label="Comment" htmlFor={`${idPrefix}-comment`}>
        <Input
          id={`${idPrefix}-comment`}
          type="text"
          size="sm"
          className="w-40"
          value={state.comment}
          onChange={(e) => update({ comment: e.target.value })}
        />
      </Field>
    </>
  );
}

/**
 * A reading table + add/edit/delete form (M5_P1 spec §1.1). Presentational —
 * `onCreate`/`onUpdate`/`onDelete` own the actual API calls, error recording
 * (the `readingError` state) and readings-array updates; this component only
 * decides whether ITS OWN form resets on success. A rejected promise leaves
 * the form (and its entered values) on screen rather than clearing it —
 * AC-38's "entered form values are all still on screen" property.
 */
export function ReadingLog({ readings, initialOg, onCreate, onUpdate, onDelete }: ReadingLogProps) {
  const [addForm, setAddForm] = useState<ReadingFormState | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<ReadingFormState | null>(null);
  const [busy, setBusy] = useState(false);
  const [refractModalOpen, setRefractModalOpen] = useState(false);
  const [pendingDeleteReading, setPendingDeleteReading] = useState<Reading | null>(null);
  // O-2: a LOCAL error, distinct from the parent's readingError. toWriteInput
  // can throw a RangeError (datetimeLocalValueToIso's Date(...).toISOString()
  // on an unparseable datetime-local value) BEFORE onCreate/onUpdate is ever
  // called — the parent never sees that failure and so never populates its
  // own error state, which is why the three catch{} blocks below used to
  // (wrongly) assume the parent had already covered every failure mode. This
  // state exists so that specific failure gets a visible message instead of
  // a Save click that silently does nothing.
  const [parseError, setParseError] = useState<string | null>(null);

  const handleApplyCorrectedSg = (sg: number) => {
    const formatted = sg.toFixed(3);
    if (editingId && editForm) {
      setEditForm((prev) => (prev ? { ...prev, sg: formatted } : prev));
    } else if (addForm) {
      setAddForm((prev) => (prev ? { ...prev, sg: formatted } : prev));
    } else {
      setAddForm({
        ...emptyFormState(),
        sg: formatted,
      });
    }
  };

  const startAdd = () => {
    setAddForm(emptyFormState());
    setParseError(null);
  };
  const cancelAdd = () => {
    setAddForm(null);
    setParseError(null);
  };

  const submitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm) return;

    let input: ReadingWriteInput;
    try {
      input = toWriteInput(addForm);
    } catch {
      setParseError('That time could not be understood. Please re-enter it.');
      return; // onCreate is deliberately never called.
    }
    setParseError(null);

    setBusy(true);
    try {
      await onCreate(input);
      setAddForm(null);
    } catch {
      // The parent already recorded readingError for THIS failure (the
      // onCreate call itself was reached and rejected) — keep the form open,
      // values intact.
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (r: Reading) => {
    setEditingId(r.id);
    setEditForm(formStateFromReading(r));
    setParseError(null);
  };
  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(null);
    setParseError(null);
  };

  const submitEdit = async (e: React.FormEvent, readingId: string) => {
    e.preventDefault();
    if (!editForm) return;

    let input: ReadingWriteInput;
    try {
      input = toWriteInput(editForm);
    } catch {
      setParseError('That time could not be understood. Please re-enter it.');
      return; // onUpdate is deliberately never called.
    }
    setParseError(null);

    setBusy(true);
    try {
      await onUpdate(readingId, input);
      setEditingId(null);
      setEditForm(null);
    } catch {
      // The parent already recorded readingError for THIS failure (the
      // onUpdate call itself was reached and rejected) — keep the row in
      // edit mode.
    } finally {
      setBusy(false);
    }
  };

  const requestDelete = (r: Reading) => {
    setPendingDeleteReading(r);
  };

  const confirmDelete = async () => {
    if (pendingDeleteReading === null) return;
    setBusy(true);
    try {
      await onDelete(pendingDeleteReading.id);
    } catch {
      // The parent already recorded readingError for this rejected onDelete
      // call; the row stays on screen.
    } finally {
      setBusy(false);
      setPendingDeleteReading(null);
    }
  };

  const cancelDelete = () => {
    setPendingDeleteReading(null);
  };

  return (
    <div className={`${CARD_CLASS} !p-0 overflow-hidden`}>
      <div className="px-4 py-3 flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-slate-100">Readings</h3>
          <Button
            variant="secondary"
            size="sm"
            type="button"
            onClick={() => setRefractModalOpen(true)}
            data-testid="open-refractometer-btn"
            title="Convert optical Brix reading into alcohol-corrected SG"
          >
            <Calculator className="w-3.5 h-3.5 text-amber-400" />
            Refractometer Tool
          </Button>
        </div>
        {!addForm && (
          <Button
            variant="primary"
            size="sm"
            type="button"
            onClick={startAdd}
            data-testid="reading-add-button"
          >
            <Plus className="w-3.5 h-3.5" /> Log Reading
          </Button>
        )}

      </div>

      <RefractometerFermentationModal
        open={refractModalOpen}
        onClose={() => setRefractModalOpen(false)}
        initialOg={initialOg}
        onApplySg={handleApplyCorrectedSg}
      />

      {parseError && (
        <div className="mx-4 mt-3 bg-rose-950/60 border border-rose-800 rounded-lg px-3 py-2 text-xs text-rose-200" data-testid="reading-parse-error">
          {parseError}
        </div>
      )}

      {readings.length === 0 && !addForm && (
        <div className="px-4 py-8 text-center text-sm text-slate-400" data-testid="reading-log-empty">
          No readings yet — logged gravity and temperature readings will appear here.
        </div>
      )}

      {readings.length > 0 && (
        <Table>
          <thead>
            <tr className="border-b border-slate-800">
              <TableHeaderCell>Time</TableHeaderCell>
              <TableHeaderCell>SG</TableHeaderCell>
              <TableHeaderCell>Temp (°C)</TableHeaderCell>
              <TableHeaderCell>pH</TableHeaderCell>
              <TableHeaderCell>Pressure (psi)</TableHeaderCell>
              <TableHeaderCell>Comment</TableHeaderCell>
              <TableHeaderCell className="text-right">Actions</TableHeaderCell>
            </tr>
          </thead>
          <tbody>
            {/* O-1: rendered in canonical order (sortReadings), matching the
                chart's plotting order — never the array order the parent
                happens to pass, which a back-dated or time-edited reading
                could otherwise leave out of order. */}
            {sortReadings(readings).map((r) =>
              editingId === r.id && editForm ? (
                <tr key={r.id} data-testid={`reading-row-${r.id}`} className="bg-slate-800/40">
                  <TableCell variant="text" colSpan={7}>
                    <form onSubmit={(e) => submitEdit(e, r.id)} className="flex flex-wrap items-end gap-2">
                      <ReadingFormFields state={editForm} setState={(fn) => setEditForm((prev) => (prev ? fn(prev) : prev))} idPrefix={`edit-${r.id}`} />
                      <div className="flex gap-1">
                        <Button
                          variant="icon"
                          type="submit"
                          disabled={busy}
                          title="Save"
                          aria-label="Save reading"
                          className="text-emerald-400 hover:text-emerald-300"
                        >
                          <Check className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="icon"
                          type="button"
                          onClick={cancelEdit}
                          title="Cancel"
                          aria-label="Cancel editing reading"
                          className="text-slate-400 hover:text-slate-200"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </form>
                  </TableCell>
                </tr>
              ) : (
                <tr key={r.id} data-testid={`reading-row-${r.id}`}>
                  <TableCell className="whitespace-nowrap">{formatDisplayTime(r.readingTime)}</TableCell>
                  <TableCell>{r.sg !== null ? r.sg.toFixed(3) : '—'}</TableCell>
                  <TableCell>{r.tempC !== null ? r.tempC.toFixed(1) : '—'}</TableCell>
                  <TableCell>{r.ph !== null ? r.ph.toFixed(2) : '—'}</TableCell>
                  <TableCell>{r.pressurePsi !== null ? r.pressurePsi.toFixed(1) : '—'}</TableCell>
                  <TableCell variant="text">{r.comment}</TableCell>
                  <TableCell variant="text" className="text-right">
                    <div className="inline-flex gap-1">
                      <Button
                        variant="icon"
                        type="button"
                        onClick={() => startEdit(r)}
                        title="Edit"
                        aria-label="Edit reading"
                        data-testid={`reading-edit-${r.id}`}
                        className="p-1.5 text-slate-400 hover:text-amber-400"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="icon"
                        type="button"
                        onClick={() => requestDelete(r)}
                        title="Delete"
                        aria-label="Delete reading"
                        data-testid={`reading-delete-${r.id}`}
                        className="p-1.5 text-slate-400 hover:text-rose-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </tr>
              ),
            )}
          </tbody>
        </Table>
      )}

      {addForm && (
        <form onSubmit={submitAdd} className="px-4 py-3 border-t border-slate-800 flex flex-wrap items-end gap-2" data-testid="reading-add-form">
          <ReadingFormFields state={addForm} setState={(fn) => setAddForm((prev) => (prev ? fn(prev) : prev))} idPrefix="add" />
          <div className="flex gap-2">
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
        open={pendingDeleteReading !== null}
        busy={busy}
        title="Delete this reading?"
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
