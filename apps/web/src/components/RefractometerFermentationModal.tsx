import { useState, useEffect } from 'react';
import {
  convertBrixReadingToSg,
  convertSgToBrixReading,
  convertFermentationRefractometerFg,
} from './calculators/refractometerBridge';
import { DEFAULT_WORT_CORRECTION_FACTOR } from '@truchabrew/calculations';
import {
  SECTION_HEADING_CLASS,
  METRIC_TILE_CLASS,
  METRIC_LABEL_CLASS,
  METRIC_VALUE_CLASS,
  MONO_VALUE_CLASS,
} from './designSystem';
import { X, Calculator, ArrowRight } from 'lucide-react';
import { Modal } from './Modal';
import { Button, NumberInput } from './ui';

export interface RefractometerFermentationModalProps {
  open: boolean;
  onClose: () => void;
  initialOg?: number | null;
  onApplySg: (correctedSg: number) => void;
}

export function RefractometerFermentationModal({
  open,
  onClose,
  initialOg = null,
  onApplySg,
}: RefractometerFermentationModalProps) {
  const [initialBrix, setInitialBrix] = useState<string>('13.0');
  const [currentBrix, setCurrentBrix] = useState<string>('6.5');
  const [wcf, setWcf] = useState<string>(String(DEFAULT_WORT_CORRECTION_FACTOR));

  useEffect(() => {
    if (initialOg && initialOg > 1.0) {
      const derivedBrix = convertSgToBrixReading(initialOg);
      setInitialBrix(derivedBrix.toFixed(1));
    }
  }, [initialOg, open]);

  const initBrixNum = parseFloat(initialBrix) || 0;
  const currBrixNum = parseFloat(currentBrix) || 0;
  const wcfNum = parseFloat(wcf) || DEFAULT_WORT_CORRECTION_FACTOR;

  let correctedSg: number | null = null;
  let uncorrectedSg: number | null = null;

  if (initBrixNum > 0 && currBrixNum > 0 && wcfNum > 0) {
    correctedSg = convertFermentationRefractometerFg({
      initialBrix: initBrixNum,
      finalBrix: currBrixNum,
      wortCorrectionFactor: wcfNum,
    });
    uncorrectedSg = convertBrixReadingToSg(currBrixNum);
  }

  const handleApply = () => {
    if (correctedSg !== null && correctedSg > 0) {
      onApplySg(Number(correctedSg.toFixed(3)));
      onClose();
    }
  };

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      titleId="refractometer-modal-title"
      backdropClassName="backdrop-blur-xs"
      containerClassName="rounded-2xl border-slate-700 p-6 relative text-slate-100 max-h-[90vh] overflow-y-auto"
    >
      <div>
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h2 id="refractometer-modal-title" className={SECTION_HEADING_CLASS}>
                Fermentation Refractometer Tool
              </h2>
              <p className="text-xs text-slate-400">
                Alcohol-corrected SG from optical Brix readings (Sean Terrill model)
              </p>
            </div>
          </div>
          <Button
            variant="icon"
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            title="Close"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="refract-initial-brix" className="block text-xs font-medium text-slate-300">
                Original Wort (°Brix / OG)
              </label>
              <NumberInput
                id="refract-initial-brix"
                step="0.1"
                value={initialBrix}
                onChange={(e) => setInitialBrix(e.target.value)}
                className="mt-1 block w-full"
              />
              <span className="text-[11px] text-slate-400 font-mono tabular-nums">
                ≈ {initBrixNum > 0 ? convertBrixReadingToSg(initBrixNum).toFixed(3) : '—'} SG
              </span>
            </div>

            <div>
              <label htmlFor="refract-current-brix" className="block text-xs font-medium text-slate-300">
                Current Reading (°Brix)
              </label>
              <NumberInput
                id="refract-current-brix"
                step="0.1"
                value={currentBrix}
                onChange={(e) => setCurrentBrix(e.target.value)}
                className="mt-1 block w-full"
              />
              <span className="text-[11px] text-slate-400">Optical reading during fermentation</span>
            </div>
          </div>

          <div>
            <label htmlFor="refract-wcf" className="block text-xs font-medium text-slate-300">
              Wort Correction Factor (WCF)
            </label>
            <NumberInput
              id="refract-wcf"
              step="0.01"
              value={wcf}
              onChange={(e) => setWcf(e.target.value)}
              className="mt-1 block w-full"
            />
            <span className="text-[11px] text-slate-400">Standard wort default is 1.04</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div className={METRIC_TILE_CLASS}>
              <div className={METRIC_LABEL_CLASS}>Uncorrected SG (Raw)</div>
              <div className={`text-base font-bold text-slate-400 mt-1 line-through ${MONO_VALUE_CLASS}`}>
                {uncorrectedSg !== null ? uncorrectedSg.toFixed(3) : '—'}
              </div>
              <div className="text-[10px] text-slate-400">distorted by ethanol</div>
            </div>

            <div className={`${METRIC_TILE_CLASS} border-amber-500/40 bg-amber-950/20`}>
              <div className={METRIC_LABEL_CLASS}>Corrected Real SG</div>
              <div className={`${METRIC_VALUE_CLASS} ${MONO_VALUE_CLASS} text-amber-400`} data-testid="corrected-sg-result">
                {correctedSg !== null ? correctedSg.toFixed(3) : '—'}
              </div>
              <div className="text-[10px] text-amber-500/80">Sean Terrill Cubic</div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
          <Button
            variant="secondary"
            size="sm"
            type="button"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            type="button"
            data-testid="apply-corrected-sg-btn"
            disabled={correctedSg === null}
            onClick={handleApply}
          >
            Use Corrected SG ({correctedSg !== null ? correctedSg.toFixed(3) : '—'})
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </Modal>
  );
}

