// M8_P1 spec §2.1 / Resolved Ambiguity 5. Pure functions only — no I/O, no
// React. KPA_PER_PSI is module-private (Ambiguity 6); nothing is added to
// constants.ts.

/** Exact by definition of the pound-force per square inch (Resolved Ambiguity 5). */
const KPA_PER_PSI = 6.894757293168361;

export function psiToKpa(psi: number): number {
  return psi * KPA_PER_PSI;
}

export function kpaToPsi(kpa: number): number {
  return kpa / KPA_PER_PSI;
}

/** psiToKpa(psi) / 100 — delegates, no second psi factor (Resolved Ambiguity 5). */
export function psiToBar(psi: number): number {
  return psiToKpa(psi) / 100;
}

/** kpaToPsi(bar * 100) — delegates. */
export function barToPsi(bar: number): number {
  return kpaToPsi(bar * 100);
}
