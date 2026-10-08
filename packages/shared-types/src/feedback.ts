export interface FeedbackViewport {
  width: number;
  height: number;
}

export interface FeedbackContext {
  appVersion: string;
  route: string;
  viewport: FeedbackViewport;
  batchId?: string;
  batchName?: string;
  batchStage?: string;
}

export interface FeedbackInput {
  message: string;
  context: FeedbackContext;
}

export interface FeedbackResponse {
  success: boolean;
  timestamp: string;
}

export interface OutboundWebhookPayload {
  content: string;
  text: string;
  feedback: {
    message: string;
    timestamp: string;
    context: FeedbackContext;
  };
}

export type FeedbackErrorCode = 'FEEDBACK_DELIVERY_FAILED' | 'FEEDBACK_NOT_CONFIGURED';
