import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { Reading } from '@truchabrew/shared-types';
import { ReadingLog } from '../src/components/ReadingLog';

function reading(overrides: Partial<Reading> = {}): Reading {
  return {
    id: 'reading-1',
    batchId: 'batch-1',
    readingTime: '2026-08-01T12:00:00.000Z',
    sg: 1.048,
    tempC: 20,
    comment: '',
    ph: null,
    pressurePsi: null,
    ...overrides,
  };
}

describe('ReadingLog — empty state and table rendering', () => {
  it('shows the empty prompt when there are no readings', () => {
    render(<ReadingLog readings={[]} onCreate={vi.fn()} onUpdate={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByTestId('reading-log-empty')).toBeInTheDocument();
  });

  it('renders one row per reading with formatted values, and "—" for null fields', () => {
    render(
      <ReadingLog
        readings={[reading({ id: 'r1', sg: 1.048, tempC: 20, ph: null, pressurePsi: null, comment: 'day 1' })]}
        onCreate={vi.fn()}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByTestId('reading-row-r1')).toBeInTheDocument();
    expect(screen.getByText('1.048')).toBeInTheDocument();
    expect(screen.getByText('20.0')).toBeInTheDocument();
    expect(screen.getByText('day 1')).toBeInTheDocument();
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBe(2); // ph and pressurePsi
  });
});

describe('ReadingLog — add form', () => {
  it('submitting calls onCreate with a well-formed ReadingWriteInput and resets the form on success', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    render(<ReadingLog readings={[]} onCreate={onCreate} onUpdate={vi.fn()} onDelete={vi.fn()} />);

    fireEvent.click(screen.getByTestId('reading-add-button'));
    fireEvent.change(screen.getByLabelText('SG'), { target: { value: '1.05' } });
    fireEvent.change(screen.getByLabelText('Temp (°C)'), { target: { value: '19.5' } });
    fireEvent.change(screen.getByLabelText('Comment'), { target: { value: 'pitched yeast' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1));
    const input = onCreate.mock.calls[0][0];
    expect(input.sg).toBe(1.05);
    expect(input.tempC).toBe(19.5);
    expect(input.comment).toBe('pitched yeast');
    expect(input.ph).toBeNull();
    expect(input.pressurePsi).toBeNull();
    expect(input.readingTime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/);

    // Form closes / resets after a successful create.
    await waitFor(() => {
      expect(screen.queryByTestId('reading-add-form')).not.toBeInTheDocument();
    });
  });

  it('a rejected onCreate keeps the form open with the entered values intact (AC-38)', async () => {
    const onCreate = vi.fn().mockRejectedValue(new Error('rejected'));
    render(<ReadingLog readings={[]} onCreate={onCreate} onUpdate={vi.fn()} onDelete={vi.fn()} />);

    fireEvent.click(screen.getByTestId('reading-add-button'));
    fireEvent.change(screen.getByLabelText('SG'), { target: { value: '1.05' } });
    fireEvent.change(screen.getByLabelText('Comment'), { target: { value: 'keep me' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1));

    expect(screen.getByTestId('reading-add-form')).toBeInTheDocument();
    expect((screen.getByLabelText('SG') as HTMLInputElement).value).toBe('1.05');
    expect((screen.getByLabelText('Comment') as HTMLInputElement).value).toBe('keep me');
  });

  it('Cancel closes the form without calling onCreate', () => {
    const onCreate = vi.fn();
    render(<ReadingLog readings={[]} onCreate={onCreate} onUpdate={vi.fn()} onDelete={vi.fn()} />);
    fireEvent.click(screen.getByTestId('reading-add-button'));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByTestId('reading-add-form')).not.toBeInTheDocument();
    expect(onCreate).not.toHaveBeenCalled();
  });
});

describe('ReadingLog — edit and delete', () => {
  it('edit pre-fills the row form and submitting calls onUpdate with the full replacement', async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    render(
      <ReadingLog
        readings={[reading({ id: 'r1', sg: 1.048, tempC: 20, comment: 'original' })]}
        onCreate={vi.fn()}
        onUpdate={onUpdate}
        onDelete={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('reading-edit-r1'));
    expect((screen.getByLabelText('SG') as HTMLInputElement).value).toBe('1.048');

    fireEvent.change(screen.getByLabelText('Comment'), { target: { value: 'updated' } });
    fireEvent.click(screen.getByTitle('Save'));

    await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
    expect(onUpdate).toHaveBeenCalledWith('r1', expect.objectContaining({ comment: 'updated', sg: 1.048 }));
  });

  it('a rejected onUpdate keeps the row in edit mode with the entered values (AC-38)', async () => {
    const onUpdate = vi.fn().mockRejectedValue(new Error('rejected'));
    render(
      <ReadingLog
        readings={[reading({ id: 'r1', comment: 'original' })]}
        onCreate={vi.fn()}
        onUpdate={onUpdate}
        onDelete={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('reading-edit-r1'));
    fireEvent.change(screen.getByLabelText('Comment'), { target: { value: 'still editing' } });
    fireEvent.click(screen.getByTitle('Save'));

    await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
    expect((screen.getByLabelText('Comment') as HTMLInputElement).value).toBe('still editing');
  });

  it('delete asks for confirmation and calls onDelete only when confirmed', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    render(<ReadingLog readings={[reading({ id: 'r1' })]} onCreate={vi.fn()} onUpdate={vi.fn()} onDelete={onDelete} />);

    fireEvent.click(screen.getByTestId('reading-delete-r1'));
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('confirm-dialog-cancel'));
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('reading-delete-r1'));
    fireEvent.click(screen.getByTestId('confirm-dialog-confirm'));
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith('r1'));
  });

  it('resting state has no dialog (RA-9, AC-19)', () => {
    render(<ReadingLog readings={[reading({ id: 'r1' })]} onCreate={vi.fn()} onUpdate={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.queryByTestId('confirm-dialog')).toBeNull();
    expect(screen.queryAllByRole('dialog')).toHaveLength(0);
  });

  it('a rejected delete closes the dialog, keeps the row, and does not trigger the parse-error banner (AC-20)', async () => {
    const onDelete = vi.fn().mockRejectedValue(new Error('failed'));
    render(<ReadingLog readings={[reading({ id: 'r1' })]} onCreate={vi.fn()} onUpdate={vi.fn()} onDelete={onDelete} />);

    fireEvent.click(screen.getByTestId('reading-delete-r1'));
    fireEvent.click(screen.getByTestId('confirm-dialog-confirm'));

    await waitFor(() => {
      expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();
    });
    expect(screen.getByTestId('reading-row-r1')).toBeInTheDocument();
    expect(screen.queryByTestId('reading-parse-error')).not.toBeInTheDocument();
  });
});

describe('AC-20 (Amendment 2): readings table has an overflow-x-auto scroll container', () => {
  it('the table has a direct parent div with overflow-x-auto; table className is unchanged', () => {
    const { container } = render(
      <ReadingLog readings={[reading({ id: 'r1' })]} onCreate={vi.fn()} onUpdate={vi.fn()} onDelete={vi.fn()} />,
    );
    const table = container.querySelector('table') as HTMLElement;
    expect(table).not.toBeNull();
    expect(table.className).toBe('w-full border-collapse');
    const parent = table.parentElement as HTMLElement;
    expect(parent.tagName).toBe('DIV');
    expect(parent.className.split(/\s+/)).toContain('overflow-x-auto');
  });
});

describe('AC-12/AC-13: icon buttons have accessible names, titles retained', () => {
  it('Edit and Delete resolve by their aria-label and keep their title tooltip', () => {
    render(<ReadingLog readings={[reading({ id: 'r1' })]} onCreate={vi.fn()} onUpdate={vi.fn()} onDelete={vi.fn()} />);

    const editBtn = screen.getByLabelText('Edit reading');
    expect(editBtn).toBeInTheDocument();
    expect(editBtn.getAttribute('title')).toBe('Edit');

    const deleteBtn = screen.getByLabelText('Delete reading');
    expect(deleteBtn).toBeInTheDocument();
    expect(deleteBtn.getAttribute('title')).toBe('Delete');
  });

  it('after clicking edit, Save and Cancel resolve by their aria-label', () => {
    render(<ReadingLog readings={[reading({ id: 'r1' })]} onCreate={vi.fn()} onUpdate={vi.fn()} onDelete={vi.fn()} />);

    fireEvent.click(screen.getByTestId('reading-edit-r1'));

    expect(screen.getByLabelText('Save reading')).toBeInTheDocument();
    expect(screen.getByLabelText('Cancel editing reading')).toBeInTheDocument();
  });
});

describe('O-1: the reading table renders in canonical order', () => {
  it('given readings in a deliberately non-chronological array order, renders rows ascending by readingTime, ties by id ascending', () => {
    const readings = [
      reading({ id: 'later', readingTime: '2026-08-03T00:00:00.000Z', comment: 'third' }),
      reading({ id: 'earliest', readingTime: '2026-08-01T00:00:00.000Z', comment: 'first' }),
      reading({ id: 'middle', readingTime: '2026-08-02T00:00:00.000Z', comment: 'second' }),
    ];
    render(<ReadingLog readings={readings} onCreate={vi.fn()} onUpdate={vi.fn()} onDelete={vi.fn()} />);

    const rows = screen.getAllByTestId(/^reading-row-/);
    expect(rows.map((r) => r.textContent)).toEqual([
      expect.stringContaining('first'),
      expect.stringContaining('second'),
      expect.stringContaining('third'),
    ]);
  });
});

describe('O-2: an unparseable reading time surfaces, never silently no-ops', () => {
  // JSDOM (like a real spec-compliant browser) refuses to SET a
  // `type="datetime-local"` input's `.value` to a free-text or
  // semantically-invalid string at all — the DOM coerces it to `''`, and the
  // field's `required` attribute then blocks the submit event from ever
  // firing, so `fireEvent.change(..., { value: 'garbage' })` can't exercise
  // this path (verified directly against this repo's JSDOM). The real
  // vulnerability this guards is `datetimeLocalValueToIso`'s
  // `new Date(value).toISOString()` throwing for a value that reaches it by
  // some other means (e.g. a browser that renders datetime-local as a plain
  // text field without native validation, or non-native form fillers) — so
  // this stubs `Date.prototype.toISOString` to throw for the scope of one
  // submit, which exercises exactly the failure `toWriteInput` is guarding
  // against without depending on bypassing JSDOM's (accurate) native
  // input validation.
  it('submitting the add form produces a visible error, leaves the form open with its values intact, and never calls onCreate, when the time cannot be converted to an instant', async () => {
    const onCreate = vi.fn();
    render(<ReadingLog readings={[]} onCreate={onCreate} onUpdate={vi.fn()} onDelete={vi.fn()} />);

    fireEvent.click(screen.getByTestId('reading-add-button'));
    fireEvent.change(screen.getByLabelText('SG'), { target: { value: '1.05' } });

    const original = Date.prototype.toISOString;
    Date.prototype.toISOString = () => {
      throw new RangeError('Invalid time value');
    };
    try {
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
      await waitFor(() => {
        expect(screen.getByTestId('reading-parse-error')).toBeInTheDocument();
      });
    } finally {
      Date.prototype.toISOString = original;
    }
    expect(screen.getByTestId('reading-add-form')).toBeInTheDocument();
    expect((screen.getByLabelText('SG') as HTMLInputElement).value).toBe('1.05');
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('the same is asserted for the edit form', async () => {
    const onUpdate = vi.fn();
    render(
      <ReadingLog
        readings={[reading({ id: 'r1', comment: 'original' })]}
        onCreate={vi.fn()}
        onUpdate={onUpdate}
        onDelete={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('reading-edit-r1'));

    const original = Date.prototype.toISOString;
    Date.prototype.toISOString = () => {
      throw new RangeError('Invalid time value');
    };
    try {
      fireEvent.click(screen.getByTitle('Save'));
      await waitFor(() => {
        expect(screen.getByTestId('reading-parse-error')).toBeInTheDocument();
      });
    } finally {
      Date.prototype.toISOString = original;
    }
    expect(screen.getByTestId('reading-row-r1')).toBeInTheDocument();
    expect(onUpdate).not.toHaveBeenCalled();
  });
});

describe('M33_P2: ReadingLog button primitive adoption (AC-2..AC-9, AC-12, AC-20)', () => {
  it('AC-2 & AC-3: header buttons render with Button primitive classes (secondary/primary, size="sm", gap-1.5)', () => {
    render(<ReadingLog readings={[]} onCreate={vi.fn()} onUpdate={vi.fn()} onDelete={vi.fn()} />);

    const refractBtn = screen.getByTestId('open-refractometer-btn');
    expect(refractBtn).toHaveClass('inline-flex', 'items-center', 'justify-center', 'gap-1.5');
    expect(refractBtn).toHaveClass('text-xs', 'px-3', 'py-1.5', 'font-medium', 'rounded-lg');
    expect(refractBtn).toHaveClass('bg-slate-800', 'border-slate-700');

    const addBtn = screen.getByTestId('reading-add-button');
    expect(addBtn).toHaveClass('inline-flex', 'items-center', 'justify-center', 'gap-1.5');
    expect(addBtn).toHaveClass('text-xs', 'px-3', 'py-1.5', 'font-medium', 'rounded-lg');
    expect(addBtn).toHaveClass('bg-amber-600', 'text-white');
  });

  it('AC-4 & AC-5 & AC-12: inline edit row Save and Cancel icon buttons render through Button primitive', () => {
    render(
      <ReadingLog
        readings={[reading({ id: 'r1', comment: 'test' })]}
        onCreate={vi.fn()}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('reading-edit-r1'));

    const saveBtn = screen.getByLabelText('Save reading');
    expect(saveBtn).toHaveClass('inline-flex', 'items-center', 'justify-center');
    expect(saveBtn).toHaveClass('p-2', 'text-emerald-400');
    expect(saveBtn.getAttribute('type')).toBe('submit');

    const cancelBtn = screen.getByLabelText('Cancel editing reading');
    expect(cancelBtn).toHaveClass('inline-flex', 'items-center', 'justify-center');
    expect(cancelBtn).toHaveClass('p-2', 'text-slate-400');
    expect(cancelBtn.getAttribute('type')).toBe('button');
  });

  it('AC-6 & AC-7 & AC-12: table row Edit and Delete icon buttons render through Button primitive', () => {
    render(
      <ReadingLog
        readings={[reading({ id: 'r1', comment: 'test' })]}
        onCreate={vi.fn()}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    const editBtn = screen.getByTestId('reading-edit-r1');
    expect(editBtn).toHaveClass('inline-flex', 'items-center', 'justify-center');
    expect(editBtn).toHaveClass('p-1.5', 'text-slate-400');
    expect(editBtn).toHaveAttribute('aria-label', 'Edit reading');

    const deleteBtn = screen.getByTestId('reading-delete-r1');
    expect(deleteBtn).toHaveClass('inline-flex', 'items-center', 'justify-center');
    expect(deleteBtn).toHaveClass('p-1.5', 'text-slate-400');
    expect(deleteBtn).toHaveAttribute('aria-label', 'Delete reading');
  });

  it('AC-8 & AC-9 & AC-20: add form Save and Cancel buttons render with Button size="sm"', () => {
    render(<ReadingLog readings={[]} onCreate={vi.fn()} onUpdate={vi.fn()} onDelete={vi.fn()} />);

    fireEvent.click(screen.getByTestId('reading-add-button'));

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

