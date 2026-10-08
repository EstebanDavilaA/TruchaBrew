import { MessageSquare } from 'lucide-react';

export interface FeedbackButtonProps {
  onClick: () => void;
}

export function FeedbackButton({ onClick }: FeedbackButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Send feedback"
      data-testid="feedback-button"
      className="fixed bottom-4 right-4 z-40 h-12 w-12 min-h-11 min-w-11 rounded-full bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white shadow-xl flex items-center justify-center cursor-pointer transition-transform active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
    >
      <MessageSquare className="w-6 h-6" />
    </button>
  );
}
