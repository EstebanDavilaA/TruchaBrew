import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BatchNoteLog } from '../src/components/BatchNoteLog';
import type { BatchNote } from '@truchabrew/shared-types';

function note(overrides: Partial<BatchNote> = {}): BatchNote {
  return {
    id: 'note-1',
    batchId: 'batch-1',
    timestamp: '2026-08-01T12:00:00.000Z',
    status: 'Fermenting',
    note: 'pitched yeast',
    ...overrides,
  };
}

describe('empty state', () => {
  it('renders an explicit empty prompt, not a zero-row table', () => {
    render(<BatchNoteLog notes={[]} onCreate={vi.fn()} onUpdate={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByTestId('note-log-empty')).toBeInTheDocument();
  });
});

describe('canonical ordering', () => {
  it('renders notes ascending by timestamp regardless of the received array order', () => {
    const notes = [
      note({ id: 'b', timestamp: '2026-08-02T00:00:00.000Z', note: 'second' }),
      note({ id: 'a', timestamp: '2026-08-01T00:00:00.000Z', note: 'first' }),
    ];
    render(<BatchNoteLog notes={notes} onCreate={vi.fn()} onUpdate={vi.fn()} onDelete={vi.fn()} />);
    const rows = screen.getAllByTestId(/^note-row-/);
    expect(rows[0]).toHaveTextContent('first');
    expect(rows[1]).toHaveTextContent('second');
  });
});

describe('note stage and timestamp are displayed, never editable', () => {
  it('shows the recorded status and timestamp for each note', () => {
    render(<BatchNoteLog notes={[note({ status: 'Conditioning' })]} onCreate={vi.fn()} onUpdate={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByTestId('note-stage-note-1')).toHaveTextContent('Conditioning');
  });
});

describe('add a note', () => {
  it('submits { note } via onCreate and resets the form on success', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    render(<BatchNoteLog notes={[]} onCreate={onCreate} onUpdate={vi.fn()} onDelete={vi.fn()} />);

    fireEvent.click(screen.getByTestId('note-add-button'));
    fireEvent.change(screen.getByLabelText('New note'), { target: { value: 'brew day' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(onCreate).toHaveBeenCalledWith({ note: 'brew day' });
    });
    await waitFor(() => {
      expect(screen.queryByTestId('note-add-form')).not.toBeInTheDocument();
    });
  });

  it('a rejected onCreate leaves the form and its entered text on screen', async () => {
    const onCreate = vi.fn().mockRejectedValue(new Error('failed'));
    render(<BatchNoteLog notes={[]} onCreate={onCreate} onUpdate={vi.fn()} onDelete={vi.fn()} />);

    fireEvent.click(screen.getByTestId('note-add-button'));
    fireEvent.change(screen.getByLabelText('New note'), { target: { value: 'brew day' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(onCreate).toHaveBeenCalled();
    });
    expect(screen.getByTestId('note-add-form')).toBeInTheDocument();
    expect((screen.getByLabelText('New note') as HTMLTextAreaElement).value).toBe('brew day');
  });
});

describe('edit a note (AC-32: text only)', () => {
  it('submits the new text via onUpdate', async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    render(<BatchNoteLog notes={[note()]} onCreate={vi.fn()} onUpdate={onUpdate} onDelete={vi.fn()} />);

    fireEvent.click(screen.getByTestId('note-edit-note-1'));
    fireEvent.change(screen.getByLabelText('Note'), { target: { value: 'pitched yeast, updated' } });
    fireEvent.click(screen.getByTitle('Save'));

    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledWith('note-1', { note: 'pitched yeast, updated' });
    });
  });
});

describe('AC-11/AC-13: icon buttons have accessible names, titles retained', () => {
  it('Edit and Delete resolve by their aria-label and keep their title tooltip', () => {
    render(<BatchNoteLog notes={[note()]} onCreate={vi.fn()} onUpdate={vi.fn()} onDelete={vi.fn()} />);

    const editBtn = screen.getByLabelText('Edit note');
    expect(editBtn).toBeInTheDocument();
    expect(editBtn.getAttribute('title')).toBe('Edit');

    const deleteBtn = screen.getByLabelText('Delete note');
    expect(deleteBtn).toBeInTheDocument();
    expect(deleteBtn.getAttribute('title')).toBe('Delete');
  });

  it('after clicking edit, Save and Cancel resolve by their aria-label', () => {
    render(<BatchNoteLog notes={[note()]} onCreate={vi.fn()} onUpdate={vi.fn()} onDelete={vi.fn()} />);

    fireEvent.click(screen.getByTestId('note-edit-note-1'));

    expect(screen.getByLabelText('Save note')).toBeInTheDocument();
    expect(screen.getByLabelText('Cancel editing note')).toBeInTheDocument();
  });
});

describe('delete a note', () => {
  it('confirms then calls onDelete', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    render(<BatchNoteLog notes={[note()]} onCreate={vi.fn()} onUpdate={vi.fn()} onDelete={onDelete} />);

    fireEvent.click(screen.getByTestId('note-delete-note-1'));
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('confirm-dialog-confirm'));

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith('note-1');
    });
  });

  it('cancel never calls onDelete and closes the dialog (RA-8)', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    render(<BatchNoteLog notes={[note()]} onCreate={vi.fn()} onUpdate={vi.fn()} onDelete={onDelete} />);

    fireEvent.click(screen.getByTestId('note-delete-note-1'));
    fireEvent.click(screen.getByTestId('confirm-dialog-cancel'));

    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();
  });

  it('resting state has no dialog (RA-9, AC-15)', () => {
    render(<BatchNoteLog notes={[note()]} onCreate={vi.fn()} onUpdate={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.queryByTestId('confirm-dialog')).toBeNull();
    expect(screen.queryAllByRole('dialog')).toHaveLength(0);
  });

  it('busy lockstep disables both dialog buttons while the delete is in flight (AC-16)', async () => {
    let resolveDelete: () => void = () => {};
    const onDelete = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveDelete = resolve;
        }),
    );
    render(<BatchNoteLog notes={[note()]} onCreate={vi.fn()} onUpdate={vi.fn()} onDelete={onDelete} />);

    fireEvent.click(screen.getByTestId('note-delete-note-1'));
    fireEvent.click(screen.getByTestId('confirm-dialog-confirm'));

    await waitFor(() => {
      expect(screen.getByTestId('confirm-dialog-confirm')).toBeDisabled();
    });
    expect(screen.getByTestId('confirm-dialog-cancel')).toBeDisabled();

    resolveDelete();

    await waitFor(() => {
      expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();
    });
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('a rejected delete closes the dialog but keeps the row on screen (AC-17)', async () => {
    const onDelete = vi.fn().mockRejectedValue(new Error('failed'));
    render(<BatchNoteLog notes={[note()]} onCreate={vi.fn()} onUpdate={vi.fn()} onDelete={onDelete} />);

    fireEvent.click(screen.getByTestId('note-delete-note-1'));
    fireEvent.click(screen.getByTestId('confirm-dialog-confirm'));

    await waitFor(() => {
      expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();
    });
    expect(screen.getByTestId('note-row-note-1')).toBeInTheDocument();
  });
});

describe('M33_P3: BatchNoteLog button primitive adoption (AC-2..AC-8, AC-11)', () => {
  it('AC-2: header Add Note button renders with Button primary size="sm" (gap-1.5, text-xs px-3 py-1.5)', () => {
    render(<BatchNoteLog notes={[]} onCreate={vi.fn()} onUpdate={vi.fn()} onDelete={vi.fn()} />);

    const addBtn = screen.getByTestId('note-add-button');
    expect(addBtn).toHaveClass('inline-flex', 'items-center', 'justify-center', 'gap-1.5');
    expect(addBtn).toHaveClass('text-xs', 'px-3', 'py-1.5', 'font-medium', 'rounded-lg');
    expect(addBtn).toHaveClass('bg-amber-600', 'text-white');
  });

  it('AC-3 & AC-4 & AC-11: inline edit row Save and Cancel icon buttons render through Button primitive', () => {
    render(<BatchNoteLog notes={[note()]} onCreate={vi.fn()} onUpdate={vi.fn()} onDelete={vi.fn()} />);

    fireEvent.click(screen.getByTestId('note-edit-note-1'));

    const saveBtn = screen.getByLabelText('Save note');
    expect(saveBtn).toHaveClass('inline-flex', 'items-center', 'justify-center');
    expect(saveBtn).toHaveClass('p-2', 'text-emerald-400');
    expect(saveBtn.getAttribute('type')).toBe('submit');

    const cancelBtn = screen.getByLabelText('Cancel editing note');
    expect(cancelBtn).toHaveClass('inline-flex', 'items-center', 'justify-center');
    expect(cancelBtn).toHaveClass('p-2', 'text-slate-400');
    expect(cancelBtn.getAttribute('type')).toBe('button');
  });

  it('AC-5 & AC-6 & AC-11: note row Edit and Delete icon buttons render through Button primitive', () => {
    render(<BatchNoteLog notes={[note()]} onCreate={vi.fn()} onUpdate={vi.fn()} onDelete={vi.fn()} />);

    const editBtn = screen.getByTestId('note-edit-note-1');
    expect(editBtn).toHaveClass('inline-flex', 'items-center', 'justify-center');
    expect(editBtn).toHaveClass('p-1.5', 'text-slate-400');
    expect(editBtn).toHaveAttribute('aria-label', 'Edit note');

    const deleteBtn = screen.getByTestId('note-delete-note-1');
    expect(deleteBtn).toHaveClass('inline-flex', 'items-center', 'justify-center');
    expect(deleteBtn).toHaveClass('p-1.5', 'text-slate-400');
    expect(deleteBtn).toHaveAttribute('aria-label', 'Delete note');
  });

  it('AC-7 & AC-8: add form Save and Cancel buttons render with Button size="sm"', () => {
    render(<BatchNoteLog notes={[]} onCreate={vi.fn()} onUpdate={vi.fn()} onDelete={vi.fn()} />);

    fireEvent.click(screen.getByTestId('note-add-button'));

    const saveBtn = screen.getByRole('button', { name: 'Save' });
    expect(saveBtn).toHaveClass('inline-flex', 'items-center', 'justify-center', 'gap-1.5');
    expect(saveBtn).toHaveClass('text-xs', 'px-3', 'py-1.5', 'font-medium', 'bg-amber-600');
    expect(saveBtn.getAttribute('type')).toBe('submit');

    const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
    expect(cancelBtn).toHaveClass('inline-flex', 'items-center', 'justify-center', 'gap-1.5');
    expect(cancelBtn).toHaveClass('text-xs', 'px-3', 'py-1.5', 'font-medium', 'bg-slate-800');
    expect(cancelBtn.getAttribute('type')).toBe('button');
  });
});

