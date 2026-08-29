import type { ButtonHTMLAttributes, ReactNode } from 'react';
import {
  BUTTON_PRIMARY_CLASS,
  BUTTON_SECONDARY_CLASS,
  BUTTON_DANGER_CLASS,
  BUTTON_ICON_CLASS,
} from '../designSystem';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'icon';
export type ButtonSize = 'sm' | 'md';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children?: ReactNode;
}

const VARIANT_MAP: Record<ButtonVariant, string> = {
  primary: BUTTON_PRIMARY_CLASS,
  secondary: BUTTON_SECONDARY_CLASS,
  danger: BUTTON_DANGER_CLASS,
  icon: BUTTON_ICON_CLASS,
};

export function Button({
  variant = 'primary',
  size = 'md',
  type = 'button',
  className,
  children,
  ...props
}: ButtonProps) {
  const baseVariantClass = VARIANT_MAP[variant];
  const sizeClass = size === 'sm' && variant !== 'icon' ? 'text-xs px-3 py-1.5' : '';
  const layoutClass = variant !== 'icon' ? 'inline-flex items-center justify-center gap-1.5' : 'inline-flex items-center justify-center';
  const mergedClass = [layoutClass, baseVariantClass, sizeClass, className].filter(Boolean).join(' ');

  return (
    <button type={type} className={mergedClass} {...props}>
      {children}
    </button>
  );

}
