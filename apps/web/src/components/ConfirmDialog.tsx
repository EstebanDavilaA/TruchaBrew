import { Loader2 } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './ui';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  /** Label of the destructive button. Defaults to 'Delete'. */
  confirmLabel?: string;
  /** True while the confirmed action is in flight. Disables both buttons. */
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ open, title, message, confirmLabel, busy, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <Modal isOpen={open} onClose={onCancel} role="alertdialog" maxWidthClass="max-w-sm" containerClassName="p-5" busy={busy}>
      <div data-testid="confirm-dialog">
        <h2 className="text-base font-bold text-slate-100 mb-2">{title}</h2>
        <p className="text-sm text-slate-400 mb-5">{message}</p>
        <div className="flex items-center justify-end gap-3">
          <Button
            variant="secondary"
            size="sm"
            type="button"
            data-testid="confirm-dialog-cancel"
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            size="sm"
            type="button"
            data-testid="confirm-dialog-confirm"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {confirmLabel ?? 'Delete'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
