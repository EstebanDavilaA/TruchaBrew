import type { InputHTMLAttributes } from 'react';
import { INPUT_CLASS, INPUT_COMPACT_CLASS, INPUT_UNDERLINE_CLASS, CONTROL_HEIGHT_CLASS } from '../designSystem';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  size?: 'sm' | 'md';
  mono?: boolean;
  /** 'default' = boxed form field; 'underline' = inline metadata style matching the recipe-builder title inputs (no box, bottom-border on hover/focus). */
  variant?: 'default' | 'underline';
}

export function Input({ size = 'md', mono = false, variant = 'default', className, ...props }: InputProps) {
  const baseClasses =
    variant === 'underline'
      ? INPUT_UNDERLINE_CLASS
      : size === 'sm'
        ? INPUT_COMPACT_CLASS
        : `${INPUT_CLASS} ${CONTROL_HEIGHT_CLASS}`;
  const monoClasses = mono ? 'font-mono tabular-nums' : '';
  const mergedClass = ['w-full', baseClasses, monoClasses, className].filter(Boolean).join(' ');

  return <input className={mergedClass} {...props} />;
}
