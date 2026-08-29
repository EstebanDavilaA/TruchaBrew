import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import { Modal } from '../src/components/Modal';

describe('Modal (M25_P1 AC-1..AC-5)', () => {
  describe('AC-1: focus trapping', () => {
    it('Tab on the last focusable element wraps to the first; Shift+Tab on the first wraps to the last', () => {
      render(
        <Modal isOpen onClose={vi.fn()}>
          <button type="button">First</button>
          <input type="text" aria-label="middle" />
          <button type="button">Last</button>
        </Modal>,
      );

      const first = screen.getByText('First');
      const last = screen.getByText('Last');

      last.focus();
      expect(document.activeElement).toBe(last);
      fireEvent.keyDown(document, { key: 'Tab' });
      expect(document.activeElement).toBe(first);

      first.focus();
      expect(document.activeElement).toBe(first);
      fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
      expect(document.activeElement).toBe(last);
    });

    it('focuses the container itself when there are zero focusable elements inside', () => {
      const { container } = render(
        <Modal isOpen onClose={vi.fn()}>
          <p>No interactive content here.</p>
        </Modal>,
      );
      const dialog = container.querySelector('[role="dialog"]');
      expect(dialog).not.toBeNull();
      expect(document.activeElement).toBe(dialog);
    });
  });

  describe('AC-2: Escape dismissal', () => {
    it('pressing Escape calls onClose', () => {
      const onClose = vi.fn();
      render(
        <Modal isOpen onClose={onClose}>
          <button type="button">Ok</button>
        </Modal>,
      );
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not call onClose on Escape when busy', () => {
      const onClose = vi.fn();
      render(
        <Modal isOpen onClose={onClose} busy>
          <button type="button">Ok</button>
        </Modal>,
      );
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onClose).not.toHaveBeenCalled();
    });

    it('does not call onClose on Escape when disableEscape is true', () => {
      const onClose = vi.fn();
      render(
        <Modal isOpen onClose={onClose} disableEscape>
          <button type="button">Ok</button>
        </Modal>,
      );
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('AC-3: focus restoration', () => {
    it('returns focus to the element that was focused before the modal opened', () => {
      function Harness() {
        const [open, setOpen] = useState(false);
        return (
          <div>
            <button type="button" onClick={() => setOpen(true)}>
              Open modal
            </button>
            <Modal isOpen={open} onClose={() => setOpen(false)}>
              <button type="button">Inside</button>
            </Modal>
          </div>
        );
      }

      render(<Harness />);
      const opener = screen.getByText('Open modal');
      opener.focus();
      expect(document.activeElement).toBe(opener);

      fireEvent.click(opener);
      expect(screen.getByText('Inside')).toBeInTheDocument();
      expect(document.activeElement).not.toBe(opener);

      fireEvent.keyDown(document, { key: 'Escape' });
      expect(screen.queryByText('Inside')).not.toBeInTheDocument();
      expect(document.activeElement).toBe(opener);
    });
  });

  describe('AC-4: backdrop click dismissal', () => {
    it('clicking the backdrop calls onClose; clicking inside the dialog container does not', () => {
      const onClose = vi.fn();
      const { container } = render(
        <Modal isOpen onClose={onClose}>
          <button type="button">Inside</button>
        </Modal>,
      );

      const dialog = container.querySelector('[role="dialog"]') as HTMLElement;
      fireEvent.click(dialog);
      expect(onClose).not.toHaveBeenCalled();

      const backdrop = dialog.parentElement as HTMLElement;
      fireEvent.click(backdrop);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not call onClose on backdrop click when disableBackdropClick is true', () => {
      const onClose = vi.fn();
      const { container } = render(
        <Modal isOpen onClose={onClose} disableBackdropClick>
          <button type="button">Inside</button>
        </Modal>,
      );
      const dialog = container.querySelector('[role="dialog"]') as HTMLElement;
      const backdrop = dialog.parentElement as HTMLElement;
      fireEvent.click(backdrop);
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('AC-5: stacked modal hierarchy', () => {
    // Realistic composition: a base modal and a confirm dialog opened "on
    // top of" it (e.g. a delete-confirmation raised from within an already-
    // open editor modal) are two sibling <Modal> instances gated by their
    // own isOpen booleans in a shared parent — not one physically nested
    // inside the other's children. The registry's mount-order stack tracks
    // that composition (RA-5): whichever registers last is topmost.
    it('Escape closes only the topmost (most-recently-opened) modal, leaving the base modal open', () => {
      const onCloseBase = vi.fn();
      const onCloseNested = vi.fn();

      function Harness() {
        const [confirmOpen, setConfirmOpen] = useState(false);
        return (
          <div>
            <Modal isOpen onClose={onCloseBase}>
              <button type="button" onClick={() => setConfirmOpen(true)}>
                Delete
              </button>
            </Modal>
            <Modal isOpen={confirmOpen} onClose={onCloseNested} role="alertdialog">
              <button type="button">Confirm delete</button>
            </Modal>
          </div>
        );
      }

      render(<Harness />);
      fireEvent.click(screen.getByText('Delete'));
      expect(screen.getByText('Confirm delete')).toBeInTheDocument();

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(onCloseNested).toHaveBeenCalledTimes(1);
      expect(onCloseBase).not.toHaveBeenCalled();
    });
  });
});
