import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfirmDialog } from '../src/components/ConfirmDialog';

describe('ConfirmDialog', () => {
  it('renders nothing when open is false', () => {
    const { container } = render(
      <ConfirmDialog open={false} title="Delete?" message="Sure?" onConfirm={() => {}} onCancel={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();
  });

  it('renders the dialog with title, message, and default confirm label when open', () => {
    render(<ConfirmDialog open title="Delete Recipe" message="This cannot be undone." onConfirm={() => {}} onCancel={() => {}} />);
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
    expect(screen.getByText('Delete Recipe')).toBeInTheDocument();
    expect(screen.getByText('This cannot be undone.')).toBeInTheDocument();
    expect(screen.getByTestId('confirm-dialog-confirm')).toHaveTextContent('Delete');
  });

  it('uses a custom confirmLabel when provided', () => {
    render(
      <ConfirmDialog open title="t" message="m" confirmLabel="Remove" onConfirm={() => {}} onCancel={() => {}} />,
    );
    expect(screen.getByTestId('confirm-dialog-confirm')).toHaveTextContent('Remove');
  });

  it('fires onConfirm / onCancel exactly once on click', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<ConfirmDialog open title="t" message="m" onConfirm={onConfirm} onCancel={onCancel} />);
    fireEvent.click(screen.getByTestId('confirm-dialog-confirm'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId('confirm-dialog-cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('disables both buttons while busy', () => {
    render(<ConfirmDialog open busy title="t" message="m" onConfirm={() => {}} onCancel={() => {}} />);
    expect(screen.getByTestId('confirm-dialog-confirm')).toBeDisabled();
    expect(screen.getByTestId('confirm-dialog-cancel')).toBeDisabled();
  });

  it('does not call onConfirm/onCancel when busy and clicked', async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<ConfirmDialog open busy title="t" message="m" onConfirm={onConfirm} onCancel={onCancel} />);
    // Disabled buttons don't fire click handlers via userEvent (which respects pointer-events),
    // but assert directly regardless of the interaction library's own guard.
    screen.getByTestId('confirm-dialog-confirm').click();
    screen.getByTestId('confirm-dialog-cancel').click();
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('AC-2 & AC-3: action buttons render via Button primitive with size="sm"', () => {
    render(<ConfirmDialog open title="t" message="m" onConfirm={() => {}} onCancel={() => {}} />);
    const cancelBtn = screen.getByTestId('confirm-dialog-cancel');
    expect(cancelBtn).toHaveClass('inline-flex', 'items-center', 'justify-center', 'gap-1.5');
    expect(cancelBtn).toHaveClass('text-xs', 'px-3', 'py-1.5', 'bg-slate-800');

    const confirmBtn = screen.getByTestId('confirm-dialog-confirm');
    expect(confirmBtn).toHaveClass('inline-flex', 'items-center', 'justify-center', 'gap-1.5');
    expect(confirmBtn).toHaveClass('text-xs', 'px-3', 'py-1.5', 'bg-rose-950/80');
  });
});
