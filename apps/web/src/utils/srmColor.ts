/**
 * Converts SRM color value to hex code for UI visualization
 */
export function srmToHex(srm: number): string {
  if (srm <= 0) return '#FAF5EE';
  if (srm <= 2) return '#F8F753';
  if (srm <= 4) return '#F6E52D';
  if (srm <= 6) return '#EAB715';
  if (srm <= 8) return '#E59D12';
  if (srm <= 10) return '#DC8811';
  if (srm <= 13) return '#D16F10';
  if (srm <= 17) return '#BD510D';
  if (srm <= 21) return '#A83B0B';
  if (srm <= 25) return '#8D270A';
  if (srm <= 30) return '#701408';
  if (srm <= 35) return '#560907';
  if (srm <= 40) return '#3B0404';
  return '#1A0101';
}

export function getSRMColorName(srm: number): string {
  if (srm < 3) return 'Straw / Pale';
  if (srm < 6) return 'Yellow / Gold';
  if (srm < 9) return 'Amber';
  if (srm < 14) return 'Deep Amber / Copper';
  if (srm < 19) return 'Brown';
  if (srm < 30) return 'Dark Brown';
  return 'Black / Stout';
}
