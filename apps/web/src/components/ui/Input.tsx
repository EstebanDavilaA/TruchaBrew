import type { InputHTMLAttributes } from 'react';
import { INPUT_CLASS, INPUT_COMPACT_CLASS, CONTROL_HEIGHT_CLASS } from '../designSystem';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  size?: 'sm' | 'md';
  mono?: boolean;
}

export function Input({ size = 'md', mono = false, className, ...props }: InputProps) {
  const baseClasses = size === 'sm' ? INPUT_COMPACT_CLASS : `${INPUT_CLASS} ${CONTROL_HEIGHT_CLASS}`;
  const monoClasses = mono ? 'font-mono tabular-nums' : '';
  const mergedClass = ['w-full', baseClasses, monoClasses, className].filter(Boolean).join(' ');

  return <input className={mergedClass} {...props} />;
}
