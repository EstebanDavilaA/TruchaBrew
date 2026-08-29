export type MiscType = 'Spice' | 'Fining' | 'WaterAgent' | 'Herb' | 'Flavor' | 'Other';
export type MiscUse = 'Mash' | 'Boil' | 'Whirlpool' | 'Primary' | 'Secondary' | 'Bottling';
export type MiscUnit = 'g' | 'ml' | 'tsp' | 'tbsp' | 'each';

export interface MiscItem {
  id: string;
  name: string;
  type: MiscType;
  use: MiscUse;
  timeMinutes: number; // 0 for uses with no time dimension
  amount: number;
  unit: MiscUnit;
  notes?: string;
}
