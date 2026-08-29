import { useState, type ReactNode } from 'react';
import { FormField, NumberInput, Select, Button } from '../ui';
import { CARD_CLASS, SUBPANEL_CLASS, MONO_VALUE_CLASS, METADATA_TEXT_CLASS } from '../designSystem';
import { Info } from 'lucide-react';

// M8_P1 spec §1.3 / §2.3 — shared presentational shell. Presentation only:
// no arithmetic, no format* call of its own. The ONE shared non-finite check
// for calculator outputs that have no M7 format* helper (Brix, pressure)
// lives here, in ResultRow, per §2.3's binding rule.
const EM_DASH = '—';

export interface CalculatorCardProps {
  title: string;
  children: ReactNode;
  /** Optional one-sentence summary of what this calculator computes (M34_P4 RA-6). */
  description?: string;
  /** Optional plain-language formula summary shown under the description (M34_P4 RA-6). */
  formula?: string;
}

export function CalculatorCard({ title, children, description, formula }: CalculatorCardProps) {
  const [infoOpen, setInfoOpen] = useState(false);

  return (
    <section className={CARD_CLASS}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <h2 className="text-lg font-bold text-white">{title}</h2>
        {(description !== undefined || formula !== undefined) && (
          <Button
            variant="icon"
            type="button"
            onClick={() => setInfoOpen((open) => !open)}
            aria-expanded={infoOpen}
            aria-label={`About ${title}`}
            title={`About ${title}`}
            className="p-1.5 text-slate-400 hover:text-amber-400 -mt-1 -mr-1"
          >
            <Info className="w-4 h-4" />
          </Button>
        )}
      </div>

      {infoOpen && (description !== undefined || formula !== undefined) && (
        <div className="mb-4 rounded-lg bg-slate-950/60 border border-slate-800 p-3 text-xs text-slate-300 space-y-2">
          {description !== undefined && <p className="leading-relaxed">{description}</p>}
          {formula !== undefined && (
            <p className={`leading-relaxed ${METADATA_TEXT_CLASS}`}>
              <span className="font-semibold text-slate-200">Formula:</span> {formula}
            </p>
          )}
        </div>
      )}

      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

export interface NumericFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

/** A labelled numeric text input. Value/onChange are strings — parsing happens at the call site, not here (§2.4). */
export function NumericField({ label, value, onChange }: NumericFieldProps) {
  return (
    <FormField label={label}>
      <NumberInput
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </FormField>
  );
}

export interface SelectFieldProps {
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (value: string) => void;
}

/** A labelled select input, styled to match NumericField. Value/onChange are strings — the caller looks up the underlying factor at call time (M8_P2 §2.4). */
export function SelectField({ label, value, options, onChange }: SelectFieldProps) {
  return (
    <FormField label={label}>
      <Select
        value={value}
        options={options}
        onChange={(e) => onChange(e.target.value)}
      />
    </FormField>
  );
}

export interface ResultRowProps {
  label: string;
  /** A pre-formatted string (from an M7 format* helper), or a raw finite/non-finite number for Brix/pressure outputs, which have no M7 helper. */
  value: string | number;
  /** Unit suffix applied only when `value` is a raw number (Brix/pressure path). */
  unit?: string;
  /** Decimal places applied only when `value` is a raw number. */
  fractionDigits?: number;
}

/** The one shared non-finite -> em-dash check for outputs with no M7 format* helper (§2.3). */
export function ResultRow({ label, value, unit, fractionDigits }: ResultRowProps) {
  const text =
    typeof value === 'string'
      ? value
      : Number.isFinite(value)
        ? `${value.toFixed(fractionDigits ?? 2)}${unit ? ` ${unit}` : ''}`
        : EM_DASH;

  return (
    <div className={`flex items-center justify-between ${SUBPANEL_CLASS}`}>
      <span className="text-xs text-slate-400 font-medium">{label}</span>
      <span className={`text-sm font-bold text-amber-400 ${MONO_VALUE_CLASS}`}>{text}</span>
    </div>
  );
}
