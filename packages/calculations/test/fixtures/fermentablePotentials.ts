/**
 * PPG (points per pound per gallon) keyed by the fixture's fermentable `name`.
 * Covers exactly the 16 distinct names across the six Montano recipes.
 * A lookup miss throws — it must never silently default.
 *
 * Source: standard published grain-potential tables (Briess/BestMalz-adjacent
 * PPG figures), applied uniformly by name only — no per-recipe overrides.
 */
const POTENTIALS_TABLE: Record<string, number> = {
  'Pale Ale': 37.5, // standard 2-row pale ale malt, ~37-38 PPG
  Pilsner: 37.0, // continental pilsner malt
  'Wheat Malt': 38.0, // wheat malt, high-extract
  'Chateau Maize Flakes': 39.0, // flaked maize, high-extract adjunct
  'BEST Vienna': 36.5, // Vienna malt
  'BEST Biscuit': 35.0, // biscuit/toasted malt
  'Rye Malt': 36.0, // malted rye
  'Caramel Munich I': 34.0, // crystal/caramel malt, light
  'Oats, Flaked': 33.0, // flaked oats
  'Caramel Munich III': 33.0, // crystal/caramel malt, dark
  Acidulated: 30.0, // acidulated malt, low-extract
  'Caramel Amber': 34.0, // crystal/caramel malt, amber
  Chocolate: 28.0, // chocolate malt, roasted
  'BEST Caramel Aromatic': 33.0, // crystal/caramel malt, aromatic
  'Black Malt': 25.0, // black patent malt, heavily roasted
  'Roasted Barley': 25.0, // roasted unmalted barley
};

export const FERMENTABLE_POTENTIALS_PPG: Readonly<Record<string, number>> = Object.freeze({
  ...POTENTIALS_TABLE,
});

/** Looks up PPG by fermentable name. Throws on any unknown name — never silently defaults. */
export function lookupPotentialPpg(name: string): number {
  const value = FERMENTABLE_POTENTIALS_PPG[name];
  if (value === undefined) {
    throw new Error(`No fermentable potential (PPG) known for name "${name}"`);
  }
  return value;
}
