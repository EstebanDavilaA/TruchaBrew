export type FermentableType = 'Grain' | 'Sugar' | 'LiquidExtract' | 'DryExtract' | 'Adjunct';
export type HopUse = 'Boil' | 'DryHop' | 'FirstWort' | 'Aroma' | 'Whirlpool';
export type HopType = 'Pellet' | 'Leaf' | 'Cryo';
export type YeastType = 'Ale' | 'Lager' | 'Hybrid' | 'Wheat';
export type YeastForm = 'Dry' | 'Liquid';

export interface FermentableItem {
  id: string;
  name: string;
  type: FermentableType;
  amountKg: number;
  colorSrm: number;
  potentialSg: number; // e.g. 1.037
  notes?: string;
}

export interface HopItem {
  id: string;
  name: string;
  amountG: number;
  alphaAcidPct: number;
  use: HopUse;
  timeMinutes: number;
  type: HopType;
}

export interface YeastItem {
  id: string;
  name: string;
  type: YeastType;
  form: YeastForm;
  laboratory: string;
  attenuationPct: number;
  amountPkg: number;
}

export interface EquipmentProfile {
  id: string;
  name: string;
  batchSizeL: number;
  boilTimeMin: number;
  brewhouseEfficiencyPct: number;
  mashEfficiencyPct: number;
  boilOffRateLPerHour: number;
  trubChillerLossL: number;
}

export interface Recipe {
  id: string;
  name: string;
  author: string;
  styleName: string;
  equipment: EquipmentProfile;
  fermentables: FermentableItem[];
  hops: HopItem[];
  yeasts: YeastItem[];
  notes: string;
}

export interface CalculatedStats {
  og: number;
  fg: number;
  abv: number;
  ibu: number;
  srm: number;
  ebc: number;
  buGu: number;
  rbr: number;
  totalGrainKg: number;
  totalHopG: number;
  mashWaterL: number;
  spargeWaterL: number;
  totalWaterL: number;
  preBoilVolumeL: number;
  preBoilGravity: number;
}
