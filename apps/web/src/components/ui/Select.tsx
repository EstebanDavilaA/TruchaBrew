import type { SelectHTMLAttributes, ReactNode } from 'react';
import { FORM_SELECT_CLASS, FORM_SELECT_COMPACT_CLASS, CONTROL_HEIGHT_CLASS } from '../designSystem';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  size?: 'sm' | 'md';
  options?: readonly SelectOption[];
  children?: ReactNode;
}

export function Select({ size = 'md', options, children, className, ...props }: SelectProps) {
  const baseClasses = size === 'sm' ? FORM_SELECT_COMPACT_CLASS : `${FORM_SELECT_CLASS} ${CONTROL_HEIGHT_CLASS}`;
  const mergedClass = ['w-full', baseClasses, className].filter(Boolean).join(' ');

  return (
    <select className={mergedClass} {...props}>
      {options
        ? options.map((opt) => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </option>
          ))
        : children}
    </select>
  );
}
