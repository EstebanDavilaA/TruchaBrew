export type MashStepType = 'Infusion' | 'Decoction' | 'Temperature';
export type FermentationStepType =
  | 'Primary' | 'Secondary' | 'Tertiary' | 'ColdCrash' | 'Carbonation' | 'Conditioning';

export interface MashStep {
  id: string;
  name: string;
  type: MashStepType;
  stepTempC: number;          // [0, 110]
  stepTimeMin: number;        // [0, 600]
  rampTimeMin: number;        // [0, 600]
  infuseAmountL: number | null;   // null = compute; a number is a verbatim override
  infuseWaterTempC: number;       // [0, 110]. Temperature of the water added at this step.
}

export interface MashProfile {
  id: string;
  name: string;
  targetPh: number;               // [3, 9]. Recorded target; prediction is M6.
  spargeTempC: number | null;     // null = inherit equipment.spargeTemperatureC
  steps: MashStep[];              // ordered, dense, 0-based; may be empty
}

export interface FermentationStep {
  id: string;
  name: string;
  type: FermentationStepType;
  stepTempC: number;          // [-10, 40]
  stepTimeDays: number;       // [0, 365]
  rampDays: number;           // [0, 60]
  pressurePsi: number | null; // stored; inert until M5
}

export interface FermentationProfile {
  id: string;
  name: string;
  steps: FermentationStep[];  // ordered, dense, 0-based; may be empty
}
