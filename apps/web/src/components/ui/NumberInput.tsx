import type { InputHTMLAttributes } from 'react';
import { INPUT_CLASS, INPUT_COMPACT_CLASS, CONTROL_HEIGHT_CLASS, MONO_VALUE_CLASS } from '../designSystem';

export type NumberInputWidth = 'full' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

const WIDTH_CLASS: Record<NumberInputWidth, string> = {
  full: 'w-full',
  xs: 'w-12',
  sm: 'w-14',
  md: 'w-16',
  lg: 'w-20',
  xl: 'w-24',
  '2xl': 'w-40',
};

export interface NumberInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  size?: 'sm' | 'md';
  align?: 'left' | 'right';
  width?: NumberInputWidth;
  addonRight?: string;
}

export function NumberInput({
  size = 'md',
  align = 'left',
  width = 'full',
  type = 'text',
  inputMode = 'decimal',
  addonRight,
  className,
  ...props
}: NumberInputProps) {
  const baseClasses = size === 'sm' ? INPUT_COMPACT_CLASS : `${INPUT_CLASS} ${CONTROL_HEIGHT_CLASS}`;
  const alignClass = align === 'right' ? 'text-right' : '';
  const inputClasses = [
    WIDTH_CLASS[width],
    baseClasses,
    MONO_VALUE_CLASS,
    alignClass,
    addonRight ? 'pr-10' : '',
    className,
  ].filter(Boolean).join(' ');

  if (addonRight) {
    return (
      <div className={`relative inline-flex items-center ${width === 'full' ? 'w-full' : 'w-auto'}`}>
        <input type={type} inputMode={inputMode} className={inputClasses} {...props} />
        <span className="absolute right-2.5 text-xs text-slate-400 font-medium pointer-events-none select-none">
          {addonRight}
        </span>
      </div>
    );
  }

  return <input type={type} inputMode={inputMode} className={inputClasses} {...props} />;
}
