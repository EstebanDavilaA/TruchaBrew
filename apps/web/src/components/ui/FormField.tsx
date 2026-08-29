import { useId, isValidElement, cloneElement, type ReactNode } from 'react';
import { FORM_LABEL_CLASS, METADATA_TEXT_CLASS } from '../designSystem';

export interface FormFieldProps {
  label?: string;
  htmlFor?: string;
  id?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}

export function FormField({
  label,
  htmlFor,
  id,
  hint,
  error,
  required,
  className,
  children,
}: FormFieldProps) {
  const generatedId = useId();
  const effectiveId = id ?? htmlFor ?? (label ? generatedId : undefined);

  const renderedChild =
    isValidElement(children) && effectiveId
      ? cloneElement(children as React.ReactElement<{ id?: string }>, {
          id: (children.props as { id?: string }).id ?? effectiveId,
        })
      : children;

  return (
    <div className={['flex flex-col gap-1.5', className].filter(Boolean).join(' ')}>
      {label && (
        <label htmlFor={effectiveId} className={FORM_LABEL_CLASS}>
          {label}
          {required && <span className="text-amber-500 ml-0.5">*</span>}
        </label>
      )}
      {renderedChild}
      {hint && !error && <span className={METADATA_TEXT_CLASS}>{hint}</span>}
      {error && <span className="text-xs text-rose-400">{error}</span>}
    </div>
  );
}

