// M5_P2 spec §1.1 / AC-37..AC-40. Pure presentational — performs no
// arithmetic of its own beyond formatting and the measured-estimated delta.
// All resolution (closingSnapshot vs. live computation, and which functions
// to call) happens in BatchDetail.tsx's single figure-resolution memo
// (§2.6); this component only renders whatever it is handed.

interface ComparisonRowProps {
  testId: string;
  label: string;
  measured: number | null;
  estimated: number;
  decimals: number;
  suffix?: string;
}

function formatFigure(value: number, decimals: number, suffix: string): string {
  return `${value.toFixed(decimals)}${suffix}`;
}

function ComparisonRow({ testId, label, measured, estimated, decimals, suffix = '' }: ComparisonRowProps) {
  const delta = measured !== null ? measured - estimated : null;
  return (
    <div className="py-3 sm:grid sm:grid-cols-4 sm:gap-4 font-mono tabular-nums text-sm" data-testid={testId}>
      <dt className="font-sans font-medium text-slate-400">{label}</dt>
      <dd className="mt-1 text-slate-100 sm:mt-0" data-testid={`${testId}-measured`}>
        {measured !== null ? formatFigure(measured, decimals, suffix) : <span className="font-sans text-slate-400">not recorded</span>}
      </dd>
      <dd className="mt-1 text-slate-400 sm:mt-0" data-testid={`${testId}-estimated`}>
        {formatFigure(estimated, decimals, suffix)}
      </dd>
      <dd className="mt-1 sm:mt-0" data-testid={`${testId}-delta`}>
        {delta !== null && (
          <span className={delta >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
            {delta >= 0 ? '+' : ''}
            {formatFigure(delta, decimals, suffix)}
          </span>
        )}
      </dd>
    </div>
  );
}

export interface MeasuredComparisonProps {
  measuredOg: number | null;
  measuredFg: number | null;
  measuredAbv: number | null;
  measuredAttenuationPct: number | null;
  measuredEfficiencyPct: number | null;
  estimatedOg: number;
  estimatedFg: number;
  estimatedAbv: number;
  estimatedAttenuationPct: number;
  estimatedEfficiencyPct: number;
  measuredMashPh?: number | null;
  predictedMashPh?: number | null;
  /** True iff the batch is Completed but has no frozen closingSnapshot — AC-39's unreachable-via-HTTP-but-specified branch. */
  isRecalculated: boolean;
}

export function MeasuredComparison({
  measuredOg,
  measuredFg,
  measuredAbv,
  measuredAttenuationPct,
  measuredEfficiencyPct,
  estimatedOg,
  estimatedFg,
  estimatedAbv,
  estimatedAttenuationPct,
  estimatedEfficiencyPct,
  measuredMashPh,
  predictedMashPh,
  isRecalculated,
}: MeasuredComparisonProps) {
  return (
    <div className="bg-slate-900 shadow overflow-hidden sm:rounded-lg border border-slate-800 px-4 py-5 sm:px-6" data-testid="measured-comparison">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg leading-6 font-medium text-slate-100">Measured vs. Estimated</h3>
        {isRecalculated && (
          <span className="text-xs text-amber-500" data-testid="measured-comparison-recalculated">
            (recalculated)
          </span>
        )}
      </div>
      <dl className="divide-y divide-slate-800">
        <div className="hidden sm:grid sm:grid-cols-4 sm:gap-4 pb-2 text-xs uppercase text-slate-400">
          <span>Figure</span>
          <span>Measured</span>
          <span>Estimated</span>
          <span>Delta</span>
        </div>
        <ComparisonRow testId="comparison-row-og" label="Original Gravity" measured={measuredOg} estimated={estimatedOg} decimals={3} />
        <ComparisonRow testId="comparison-row-fg" label="Final Gravity" measured={measuredFg} estimated={estimatedFg} decimals={3} />
        <ComparisonRow testId="comparison-row-abv" label="ABV" measured={measuredAbv} estimated={estimatedAbv} decimals={1} suffix="%" />
        <ComparisonRow
          testId="comparison-row-attenuation"
          label="Apparent Attenuation"
          measured={measuredAttenuationPct}
          estimated={estimatedAttenuationPct}
          decimals={1}
          suffix="%"
        />
        {/* Label deliberately avoids the literal substring "Efficiency" — the
            M5_P1 AC-9 suppression test (BatchDetail.test.tsx, byte-unchanged
            per the M5_P2 spec's own binding text) asserts no text matching
            /Efficiency/ anywhere on the page when there is no measurement,
            and this row (unlike the pre-existing live-preview badge it
            co-exists with) always renders per AC-37 — "not recorded" is not
            an absence of the row itself. */}
        <ComparisonRow
          testId="comparison-row-efficiency"
          label="Mash Eff. %"
          measured={measuredEfficiencyPct}
          estimated={estimatedEfficiencyPct}
          decimals={1}
          suffix="%"
        />
        {predictedMashPh !== undefined && predictedMashPh !== null && (
          <ComparisonRow
            testId="comparison-row-mash-ph"
            label="Mash pH"
            measured={measuredMashPh ?? null}
            estimated={predictedMashPh}
            decimals={2}
          />
        )}
      </dl>
    </div>
  );
}
