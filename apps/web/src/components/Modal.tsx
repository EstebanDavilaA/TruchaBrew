import React, { useEffect, useRef } from 'react';

/**
 * Shared accessible dialog wrapper (M25_P1 spec). Owns the backdrop, the
 * ARIA dialog contract (role / aria-modal / aria-labelledby /
 * aria-describedby), the focus trap, Escape-to-dismiss, focus restoration,
 * and backdrop-click dismissal for every modal in the app. See RA-1..RA-6.
 */
export interface ModalProps {
  /** Whether the modal is currently open and mounted. */
  readonly isOpen: boolean;
  /** Callback fired when modal requests dismissal (Escape key, backdrop click, or close button). */
  readonly onClose: () => void;
  /** Accessible title for aria-labelledby. If string provided, can be rendered or linked to title ID. */
  readonly titleId?: string;
  /** Optional accessible description for aria-describedby. */
  readonly ariaDescribedBy?: string;
  /** ARIA role: 'dialog' (default) or 'alertdialog' (for confirm prompts). */
  readonly role?: 'dialog' | 'alertdialog';
  /** Max width / sizing class for the dialog container (e.g. 'max-w-lg', 'max-w-4xl'). Defaults to 'max-w-lg'. */
  readonly maxWidthClass?: string;
  /** Additional container classes. */
  readonly containerClassName?: string;
  /** Additional backdrop classes. */
  readonly backdropClassName?: string;
  /** Optional ref to focus when the modal opens. Defaults to first focusable element. */
  readonly initialFocusRef?: React.RefObject<HTMLElement | null>;
  /** Disable clicking backdrop to close. Defaults to false. */
  readonly disableBackdropClick?: boolean;
  /** Disable Escape key to close. Defaults to false. */
  readonly disableEscape?: boolean;
  /** If true, indicates an in-flight operation; disables backdrop and Escape dismissals. */
  readonly busy?: boolean;
  /** Modal content. */
  readonly children: React.ReactNode;
}

// RA-2 — the exact focusable-elements selector, binding.
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

// RA-5 — a module-level stacked-modal registry (mount order = stack order).
// Escape only ever dismisses the topmost (most-recently-registered) modal.
let modalStack: string[] = [];
let modalIdCounter = 0;

function registerModal(id: string): void {
  if (!modalStack.includes(id)) modalStack = [...modalStack, id];
}

function unregisterModal(id: string): void {
  modalStack = modalStack.filter((existingId) => existingId !== id);
}

function isTopmostModal(id: string): boolean {
  return modalStack.length > 0 && modalStack[modalStack.length - 1] === id;
}

function isElementVisible(el: HTMLElement): boolean {
  if (el.hidden) return false;
  const style = window.getComputedStyle(el);
  return style.display !== 'none' && style.visibility !== 'hidden';
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(isElementVisible);
}

interface UseModalA11yOptions {
  isOpen: boolean;
  onClose: () => void;
  containerRef: React.RefObject<HTMLElement | null>;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  disableEscape?: boolean;
  busy?: boolean;
}

/**
 * Hook encapsulating: the stacked-modal registry (RA-5), the Tab/Shift+Tab
 * focus-trap loop (RA-2), Escape dismissal gated by busy/disableEscape
 * (RA-3), and initial-focus / focus-restoration (RA-4).
 */
export function useModalA11y({
  isOpen,
  onClose,
  containerRef,
  initialFocusRef,
  disableEscape = false,
  busy = false,
}: UseModalA11yOptions): void {
  const modalIdRef = useRef<string | null>(null);
  if (modalIdRef.current === null) {
    modalIdCounter += 1;
    modalIdRef.current = `modal-${modalIdCounter}`;
  }

  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  // Registration + initial focus + focus restoration (RA-4, RA-5).
  useEffect(() => {
    if (!isOpen) return;
    const id = modalIdRef.current as string;

    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    registerModal(id);

    const container = containerRef.current;
    let target: HTMLElement | null = null;
    if (initialFocusRef && initialFocusRef.current) {
      target = initialFocusRef.current;
    } else if (container) {
      const focusable = getFocusableElements(container);
      target = focusable[0] ?? container;
    }
    target?.focus();

    return () => {
      unregisterModal(id);
      previouslyFocusedRef.current?.focus();
      previouslyFocusedRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Escape + Tab-trap keydown handling, only acting when this instance is
  // the topmost modal (RA-5).
  useEffect(() => {
    if (!isOpen) return;
    const id = modalIdRef.current as string;

    function handleKeyDown(e: KeyboardEvent) {
      if (!isTopmostModal(id)) return;

      if (e.key === 'Escape') {
        if (busy || disableEscape) return;
        e.stopPropagation();
        onClose();
        return;
      }

      if (e.key === 'Tab') {
        const container = containerRef.current;
        if (!container) return;
        const focusable = getFocusableElements(container);

        if (focusable.length === 0) {
          e.preventDefault();
          container.focus();
          return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement as HTMLElement | null;

        if (e.shiftKey) {
          if (active === first || !active || !container.contains(active)) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (active === last || !active || !container.contains(active)) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, busy, disableEscape, onClose, containerRef]);
}

export function Modal({
  isOpen,
  onClose,
  titleId,
  ariaDescribedBy,
  role = 'dialog',
  maxWidthClass = 'max-w-lg',
  containerClassName = '',
  backdropClassName = '',
  initialFocusRef,
  disableBackdropClick = false,
  disableEscape = false,
  busy = false,
  children,
}: ModalProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useModalA11y({ isOpen, onClose, containerRef, initialFocusRef, disableEscape, busy });

  if (!isOpen) return null;

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget) return;
    if (disableBackdropClick || busy) return;
    onClose();
  }

  return (
    <div
      className={`fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 ${backdropClassName}`.trim()}
      onClick={handleBackdropClick}
    >
      <div
        ref={containerRef}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={ariaDescribedBy}
        tabIndex={-1}
        className={`bg-slate-900 border border-slate-800 rounded-xl shadow-2xl w-full ${maxWidthClass} ${containerClassName}`.trim()}
      >
        {children}
      </div>
    </div>
  );
}
