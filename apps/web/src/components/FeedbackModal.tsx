import React, { useState, useRef, useEffect } from 'react';
import type { FeedbackContext, FeedbackInput, FeedbackResponse } from '@truchabrew/shared-types';
import { sendFeedback, ApiClientError } from '../api/client';
import { Modal } from './Modal';
import { MessageSquare, Send, CheckCircle2, AlertTriangle, X } from 'lucide-react';
import {
  BUTTON_PRIMARY_CLASS,
  BUTTON_SECONDARY_CLASS,
  BUTTON_ICON_CLASS,
  INPUT_CLASS,
  MONO_VALUE_CLASS,
} from './designSystem';

// oxlint-disable-next-line react/only-export-components
export function getFeedbackContext(
  view: string,
  batchMeta?: { id: string; name: string; stage?: string },
): FeedbackContext {
  const route =
    typeof window !== 'undefined' && window.location.pathname && window.location.pathname !== '/'
      ? window.location.pathname
      : view;

  return {
    appVersion: '0.1.0',
    route: route || view,
    viewport: {
      width: typeof window !== 'undefined' && window.innerWidth ? window.innerWidth : 1024,
      height: typeof window !== 'undefined' && window.innerHeight ? window.innerHeight : 768,
    },
    ...(batchMeta
      ? {
          batchId: batchMeta.id,
          batchName: batchMeta.name,
          batchStage: batchMeta.stage,
        }
      : {}),
  };
}

export interface FeedbackModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly view?: string;
  readonly batchMeta?: { id: string; name: string; stage?: string };
  readonly onSend?: (input: FeedbackInput) => Promise<FeedbackResponse>;
}

export function FeedbackModal({
  isOpen,
  onClose,
  view = 'list',
  batchMeta,
  onSend = sendFeedback,
}: FeedbackModalProps) {
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const autoCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const context = getFeedbackContext(view, batchMeta);

  useEffect(() => {
    if (isOpen) {
      // oxlint-disable-next-line react/set-state-in-effect
      setSuccess(false);
      // oxlint-disable-next-line react/set-state-in-effect
      setError(null);
      // Auto-focus textarea on open
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
    } else {
      if (autoCloseTimerRef.current) {
        clearTimeout(autoCloseTimerRef.current);
        autoCloseTimerRef.current = null;
      }
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = message.trim();
    if (!trimmed) {
      setError('Message cannot be empty');
      return;
    }

    setIsSending(true);
    setError(null);

    try {
      await onSend({
        message: trimmed,
        context,
      });

      setSuccess(true);
      setIsSending(false);
      setMessage(''); // Clear text strictly upon success

      autoCloseTimerRef.current = setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: unknown) {
      setIsSending(false);
      const msg =
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Failed to send feedback';
      setError(msg);
      // Brewer typed text is preserved in message state!
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
    }
  };

  const handleClose = () => {
    if (autoCloseTimerRef.current) {
      clearTimeout(autoCloseTimerRef.current);
      autoCloseTimerRef.current = null;
    }
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      titleId="feedback-modal-title"
      maxWidthClass="max-w-lg"
      containerClassName="p-6"
      initialFocusRef={textareaRef}
    >
      <div data-testid="feedback-modal" className="flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 id="feedback-modal-title" className="text-lg font-bold text-white flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-amber-500" /> Tell Us What Went Wrong
          </h3>
          <button
            type="button"
            onClick={handleClose}
            className={BUTTON_ICON_CLASS}
            aria-label="Close feedback dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {success ? (
          <div
            data-testid="feedback-success-banner"
            className="bg-emerald-950/60 border border-emerald-800 rounded-lg p-5 text-center flex flex-col items-center gap-2 text-emerald-200"
          >
            <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            <div className="font-semibold text-base text-white">Feedback Received!</div>
            <p className="text-sm text-emerald-300">
              Thank you for helping improve TruchaBrew.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label htmlFor="feedback-message" className="block text-xs font-semibold text-slate-300 mb-1.5">
                What went wrong or felt confusing?
              </label>
              <textarea
                id="feedback-message"
                ref={textareaRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Describe what happened, what you were expecting, or what felt awkward with wet hands…"
                className={`${INPUT_CLASS} w-full min-h-[120px] resize-y`}
                disabled={isSending}
                data-testid="feedback-message-input"
                aria-label="Feedback message"
                maxLength={5000}
              />
            </div>

            {error && (
              <div
                data-testid="feedback-error-banner"
                className="bg-rose-950/60 border border-rose-800 rounded-lg px-4 py-3 flex items-center gap-3 text-sm text-rose-200"
              >
                <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div
              data-testid="feedback-privacy-disclosure"
              className="bg-slate-950/50 border border-slate-800 rounded-lg p-3 text-xs text-slate-400 flex flex-col gap-1.5"
            >
              <p className="text-slate-300 font-medium">
                Only your message and the technical screen context shown below will be sent. Your recipes, inventory, and database remain strictly on your machine.
              </p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
                <span>App: <strong className={`text-slate-200 ${MONO_VALUE_CLASS}`}>{context.appVersion}</strong></span>
                <span>•</span>
                <span>Route: <strong className={`text-slate-200 ${MONO_VALUE_CLASS}`}>{context.route}</strong></span>
                <span>•</span>
                <span>Viewport: <strong className={`text-slate-200 ${MONO_VALUE_CLASS}`}>{context.viewport.width}x{context.viewport.height}</strong></span>
                {context.batchName && (
                  <>
                    <span>•</span>
                    <span>Batch: <strong className="text-amber-300">{context.batchName}</strong> ({context.batchStage ?? 'Unknown'})</span>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={handleClose}
                disabled={isSending}
                className={BUTTON_SECONDARY_CLASS}
                data-testid="feedback-cancel-button"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSending || message.trim().length === 0}
                className={BUTTON_PRIMARY_CLASS}
                data-testid="feedback-send-button"
              >
                <span className="flex items-center gap-2">
                  <Send className="w-4 h-4" />
                  {isSending ? 'Sending…' : 'Send Feedback'}
                </span>
              </button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}
