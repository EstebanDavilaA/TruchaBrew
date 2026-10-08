import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { FeedbackButton } from '../src/components/FeedbackButton';
import { FeedbackModal, getFeedbackContext } from '../src/components/FeedbackModal';
import type { FeedbackInput, FeedbackResponse } from '@truchabrew/shared-types';

describe('M43_P1 Feedback Web Component Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // AC-12 & AC-13: FeedbackButton sizing, positioning, visibility
  it('AC-12: FeedbackButton satisfies minimum 44px touch target (WCAG 2.5.5)', () => {
    render(<FeedbackButton onClick={() => {}} />);
    const btn = screen.getByTestId('feedback-button');
    expect(btn).toBeInTheDocument();
    const className = btn.className;
    expect(className).toContain('min-h-11');
    expect(className).toContain('min-w-11');
    expect(className).toContain('h-12');
    expect(className).toContain('w-12');
    expect(btn).toHaveAttribute('aria-label', 'Send feedback');
  });

  it('AC-13: FeedbackButton renders with fixed bottom-4 right-4 z-40', () => {
    render(<FeedbackButton onClick={() => {}} />);
    const btn = screen.getByTestId('feedback-button');
    expect(btn.className).toContain('fixed');
    expect(btn.className).toContain('bottom-4');
    expect(btn.className).toContain('right-4');
    expect(btn.className).toContain('z-40');
  });

  // AC-14: FeedbackModal open/close toggle
  it('AC-14: clicking FeedbackButton opens modal; clicking close/cancel or Escape closes it', async () => {
    function TestShell() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <FeedbackButton onClick={() => setOpen(true)} />
          <FeedbackModal isOpen={open} onClose={() => setOpen(false)} />
        </>
      );
    }

    render(<TestShell />);

    // Initially modal is not open
    expect(screen.queryByTestId('feedback-modal')).not.toBeInTheDocument();

    // Click button to open
    fireEvent.click(screen.getByTestId('feedback-button'));
    expect(screen.getByTestId('feedback-modal')).toBeInTheDocument();

    // Click cancel button to close
    fireEvent.click(screen.getByTestId('feedback-cancel-button'));
    expect(screen.queryByTestId('feedback-modal')).not.toBeInTheDocument();

    // Reopen and test close button (X)
    fireEvent.click(screen.getByTestId('feedback-button'));
    expect(screen.getByTestId('feedback-modal')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Close feedback dialog'));
    expect(screen.queryByTestId('feedback-modal')).not.toBeInTheDocument();

    // Reopen and test Escape key
    fireEvent.click(screen.getByTestId('feedback-button'));
    expect(screen.getByTestId('feedback-modal')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('feedback-modal')).not.toBeInTheDocument();
  });

  // AC-15: FeedbackModal accessibility & dialog semantics
  it('AC-15: FeedbackModal has role="dialog", aria-modal="true", and accessible title', () => {
    render(<FeedbackModal isOpen={true} onClose={() => {}} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'feedback-modal-title');
    expect(screen.getByText('Tell Us What Went Wrong')).toHaveAttribute('id', 'feedback-modal-title');
  });

  // AC-16: Honest privacy disclosure in modal
  it('AC-16: FeedbackModal renders explicit privacy disclosure text', () => {
    render(<FeedbackModal isOpen={true} onClose={() => {}} />);
    const disclosure = screen.getByTestId('feedback-privacy-disclosure');
    expect(disclosure).toBeInTheDocument();
    expect(disclosure.textContent).toContain(
      'Only your message and the technical screen context shown below will be sent. Your recipes, inventory, and database remain strictly on your machine.',
    );
  });

  // AC-17: Non-destructive error handling: typed message remains in textarea
  it('AC-17: non-destructive error handling preserves typed message in textarea upon error', async () => {
    const onSendMock = vi.fn().mockRejectedValue(new Error('Outbound webhook responded with status 502'));

    render(<FeedbackModal isOpen={true} onClose={() => {}} onSend={onSendMock} />);

    const input = screen.getByTestId('feedback-message-input') as HTMLTextAreaElement;
    const sendBtn = screen.getByTestId('feedback-send-button');

    // Type a message
    fireEvent.change(input, { target: { value: 'Kettle element shut off unexpectedly' } });
    expect(input.value).toBe('Kettle element shut off unexpectedly');

    // Submit
    fireEvent.click(sendBtn);

    // Wait for error banner
    await waitFor(() => expect(screen.getByTestId('feedback-error-banner')).toBeInTheDocument());
    expect(screen.getByTestId('feedback-error-banner').textContent).toContain(
      'Outbound webhook responded with status 502',
    );

    // Assert message is strictly preserved in textarea!
    expect(input.value).toBe('Kettle element shut off unexpectedly');
  });

  // AC-18: Success feedback flow: success banner shown, message cleared, modal closes
  it('AC-18: success feedback flow displays success banner, clears message, and auto-closes', async () => {
    const onCloseMock = vi.fn();
    const onSendMock = vi.fn().mockResolvedValue({
      success: true,
      timestamp: '2026-09-07T12:00:00.000Z',
    } as FeedbackResponse);

    render(<FeedbackModal isOpen={true} onClose={onCloseMock} onSend={onSendMock} />);

    const input = screen.getByTestId('feedback-message-input') as HTMLTextAreaElement;
    const sendBtn = screen.getByTestId('feedback-send-button');

    fireEvent.change(input, { target: { value: 'Everything went super smoothly!' } });
    fireEvent.click(sendBtn);

    await waitFor(() => expect(screen.getByTestId('feedback-success-banner')).toBeInTheDocument());
    expect(screen.getByTestId('feedback-success-banner').textContent).toContain('Feedback Received!');

    // Wait for auto-close timeout
    await waitFor(() => expect(onCloseMock).toHaveBeenCalled(), { timeout: 2000 });
  });

  // AC-19: Technical context extraction with active batch
  it('AC-19: technical context extraction with active batch includes batchId, batchName, batchStage', async () => {
    let sentPayload: FeedbackInput | undefined;
    const onSendMock = vi.fn().mockImplementation((payload: FeedbackInput) => {
      sentPayload = payload;
      return Promise.resolve({ success: true, timestamp: new Date().toISOString() });
    });

    const batchMeta = {
      id: 'batch-42',
      name: 'Nelson Sauvin Saison',
      stage: 'Brewing',
    };

    render(
      <FeedbackModal
        isOpen={true}
        onClose={() => {}}
        view="batchDetail"
        batchMeta={batchMeta}
        onSend={onSendMock}
      />,
    );

    const input = screen.getByTestId('feedback-message-input');
    fireEvent.change(input, { target: { value: 'Hop timer beeped late' } });
    fireEvent.click(screen.getByTestId('feedback-send-button'));

    await waitFor(() => expect(onSendMock).toHaveBeenCalled());
    expect(sentPayload).toBeDefined();
    expect(sentPayload!.context.batchId).toBe('batch-42');
    expect(sentPayload!.context.batchName).toBe('Nelson Sauvin Saison');
    expect(sentPayload!.context.batchStage).toBe('Brewing');
    expect(sentPayload!.context.appVersion).toBe('0.1.0');
  });

  // AC-20: Technical context extraction without active batch
  it('AC-20: technical context extraction without active batch excludes batch fields', async () => {
    let sentPayload: FeedbackInput | undefined;
    const onSendMock = vi.fn().mockImplementation((payload: FeedbackInput) => {
      sentPayload = payload;
      return Promise.resolve({ success: true, timestamp: new Date().toISOString() });
    });

    render(
      <FeedbackModal
        isOpen={true}
        onClose={() => {}}
        view="list"
        batchMeta={undefined}
        onSend={onSendMock}
      />,
    );

    const input = screen.getByTestId('feedback-message-input');
    fireEvent.change(input, { target: { value: 'Sorting by name reversed' } });
    fireEvent.click(screen.getByTestId('feedback-send-button'));

    await waitFor(() => expect(onSendMock).toHaveBeenCalled());
    expect(sentPayload).toBeDefined();
    expect(sentPayload!.context.route).toBe('list');
    expect(sentPayload!.context.appVersion).toBe('0.1.0');
    expect(sentPayload!.context.viewport).toBeDefined();
    expect(sentPayload!.context.batchId).toBeUndefined();
    expect(sentPayload!.context.batchName).toBeUndefined();
    expect(sentPayload!.context.batchStage).toBeUndefined();
  });

  // Unit tests on getFeedbackContext
  it('getFeedbackContext helper extracts route, viewport and optional batch metadata', () => {
    const ctxWithoutBatch = getFeedbackContext('inventory');
    expect(ctxWithoutBatch.route).toBe('inventory');
    expect(ctxWithoutBatch.appVersion).toBe('0.1.0');
    expect(ctxWithoutBatch.viewport.width).toBeGreaterThan(0);
    expect(ctxWithoutBatch.viewport.height).toBeGreaterThan(0);
    expect(ctxWithoutBatch.batchId).toBeUndefined();

    const ctxWithBatch = getFeedbackContext('batchDetail', {
      id: 'b-1',
      name: 'IPA',
      stage: 'Fermenting',
    });
    expect(ctxWithBatch.batchId).toBe('b-1');
    expect(ctxWithBatch.batchName).toBe('IPA');
    expect(ctxWithBatch.batchStage).toBe('Fermenting');
  });
});
