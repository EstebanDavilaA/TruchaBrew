import React from 'react';
import type { BatchStatus } from '@truchabrew/shared-types';
import {
  STATUS_BADGE_CLASS,
  STATUS_BADGE_WRAPPER_CLASS,
  SEMANTIC_BADGE_CLASS,
  type SemanticBadgeVariant,
} from '../designSystem';

export type BadgeVariant = BatchStatus | SemanticBadgeVariant;
export type BadgeSize = 'sm' | 'md';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  status?: BatchStatus;
  size?: BadgeSize;
  pulse?: boolean;
  dot?: boolean;
  children?: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  status,
  size = 'md',
  pulse = false,
  dot = false,
  className = '',
  children,
  ...rest
}) => {
  const sizeClasses =
    size === 'sm'
      ? 'px-2 py-0.5 text-[11px] font-medium rounded-full border inline-flex items-center gap-1'
      : `${STATUS_BADGE_WRAPPER_CLASS} inline-flex items-center gap-1.5`;
  const resolvedVariant = status ?? variant;

  let colorClasses = SEMANTIC_BADGE_CLASS.neutral;
  if (resolvedVariant && resolvedVariant in STATUS_BADGE_CLASS) {
    colorClasses = STATUS_BADGE_CLASS[resolvedVariant as BatchStatus];
  } else if (resolvedVariant && resolvedVariant in SEMANTIC_BADGE_CLASS) {
    colorClasses = SEMANTIC_BADGE_CLASS[resolvedVariant as SemanticBadgeVariant];
  }

  const pulseClasses = pulse ? 'animate-pulse' : '';

  return (
    <span
      className={`${sizeClasses} ${colorClasses} ${pulseClasses} ${className}`.trim().replace(/\s+/g, ' ')}
      {...rest}
    >
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current inline-block" aria-hidden="true" />}
      {children}
    </span>
  );
};

