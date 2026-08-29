import { useState } from 'react';
import type { BrewSheetModel } from '@truchabrew/calculations';
import { CARD_CLASS, SECTION_HEADING_CLASS, SUBSECTION_HEADING_CLASS, SUBPANEL_CLASS, METADATA_TEXT_CLASS } from './designSystem';
import { Table, TableHeaderCell, TableCell, Button } from './ui';
import { Printer, ChevronDown, ChevronUp } from 'lucide-react';

export interface BrewSheetProps {
  model: BrewSheetModel;
}

function EmptyRow({ colSpan }: { colSpan: number }) {
  return (
    <tr>
      <TableCell colSpan={colSpan} className="text-slate-400 italic">
        None
      </TableCell>
    </tr>
  );
}

/**
 * Brew Sheet Viewer (M18_P1 spec §1.1/§2.4). Pure presentation: props in,
 * JSX out. Owns only its own open/closed toggle state, which is
 * component-local and ephemeral (Ambiguity 9) — never persisted, never
 * touches formData.
 */
export function BrewSheet({ model }: BrewSheetProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={CARD_CLASS}>
      <div className="flex items-center justify-between">
        <h3 className={SECTION_HEADING_CLASS}>Brew Sheet</h3>
        <Button
          variant="secondary"
          size="sm"
          data-testid="brew-sheet-toggle"
          aria-expanded={isOpen}
          onClick={() => setIsOpen((o) => !o)}
        >
          {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {isOpen ? 'Hide Brew Sheet' : 'View Brew Sheet'}
        </Button>
      </div>

      {isOpen && (
        <div
          data-testid="brew-sheet"
          data-brew-sheet-print-root=""
          className="mt-4 print:mt-0 print:block space-y-5"
        >
          <div className="flex justify-end print:hidden">
            <Button
              variant="secondary"
              size="sm"
              data-testid="brew-sheet-print-btn"
              onClick={() => window.print()}
            >
              <Printer className="w-3.5 h-3.5" /> Print
            </Button>
          </div>

          <div>
            <h4 className="text-xl font-bold text-white">{model.header.recipeName}</h4>
            <p className={METADATA_TEXT_CLASS}>
              {model.header.styleName} · {model.header.typeLabel} · By {model.header.author} · Batch: {model.header.batchName}
            </p>
          </div>

          <div className={SUBPANEL_CLASS}>
            <h5 className={SUBSECTION_HEADING_CLASS}>Equipment</h5>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm text-slate-200">
              <div>
                <div className={METADATA_TEXT_CLASS}>Profile</div>
                {model.equipment.profileName}
              </div>
              <div>
                <div className={METADATA_TEXT_CLASS}>Brewhouse Eff.</div>
                {model.equipment.brewhouseEfficiencyPct}%
              </div>
              <div>
                <div className={METADATA_TEXT_CLASS}>Mash Eff.</div>
                {model.equipment.mashEfficiencyPct}%
              </div>
              <div>
                <div className={METADATA_TEXT_CLASS}>Batch Size</div>
                {model.equipment.batchSizeL} L
              </div>
              <div>
                <div className={METADATA_TEXT_CLASS}>Boil Time</div>
                {model.equipment.boilTimeMin} min
              </div>
            </div>
          </div>

          <div className={SUBPANEL_CLASS}>
            <h5 className={SUBSECTION_HEADING_CLASS}>Vitals</h5>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm text-slate-200">
              <div>
                <div className={METADATA_TEXT_CLASS}>OG</div>
                {model.vitals.og.toFixed(3)}
              </div>
              <div>
                <div className={METADATA_TEXT_CLASS}>FG</div>
                {model.vitals.fg.toFixed(3)}
              </div>
              <div>
                <div className={METADATA_TEXT_CLASS}>ABV</div>
                {model.vitals.abv.toFixed(1)}%
              </div>
              <div>
                <div className={METADATA_TEXT_CLASS}>IBU</div>
                {model.vitals.ibu}
              </div>
              <div>
                <div className={METADATA_TEXT_CLASS}>BU/GU</div>
                {model.vitals.buGu.toFixed(2)}
              </div>
              <div>
                <div className={METADATA_TEXT_CLASS}>SRM</div>
                {model.vitals.srm.toFixed(1)}
              </div>
              <div>
                <div className={METADATA_TEXT_CLASS}>EBC</div>
                {model.vitals.ebc.toFixed(1)}
              </div>
              <div>
                <div className={METADATA_TEXT_CLASS}>Plato OG</div>
                {model.vitals.platoOg.toFixed(1)} °P
              </div>
            </div>
          </div>

          <div className={SUBPANEL_CLASS}>
            <h5 className={SUBSECTION_HEADING_CLASS}>Water Volumes</h5>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm text-slate-200">
              <div>
                <div className={METADATA_TEXT_CLASS}>Mash Water</div>
                {model.volumes.mashWaterL.toFixed(1)} L
              </div>
              <div>
                <div className={METADATA_TEXT_CLASS}>Sparge Water</div>
                {model.volumes.spargeWaterL.toFixed(1)} L @ {model.volumes.spargeTempC.toFixed(1)}°C
              </div>
              <div>
                <div className={METADATA_TEXT_CLASS}>Total Water</div>
                {model.volumes.totalWaterL.toFixed(1)} L
              </div>
              <div>
                <div className={METADATA_TEXT_CLASS}>Pre-Boil Volume</div>
                {model.volumes.preBoilVolumeL.toFixed(1)} L
              </div>
              <div>
                <div className={METADATA_TEXT_CLASS}>Pre-Boil Gravity</div>
                {model.volumes.preBoilGravity.toFixed(3)}
              </div>
              <div>
                <div className={METADATA_TEXT_CLASS}>Post-Boil Volume</div>
                {model.volumes.postBoilVolumeL.toFixed(1)} L
              </div>
            </div>
          </div>

          <div className={SUBPANEL_CLASS}>
            <h5 className={SUBSECTION_HEADING_CLASS}>Mash Schedule</h5>
            <div className="text-sm text-slate-200 mb-2">
              {model.mash.profileName ?? '—'} · Strike: {model.mash.strikeTempC !== null ? `${model.mash.strikeTempC.toFixed(1)}°C` : '—'} · Target pH:{' '}
              {model.mash.targetPh !== null ? model.mash.targetPh.toFixed(2) : '—'} · Sparge: {model.mash.spargeTempC.toFixed(1)}°C
            </div>
            <Table>
              <thead>
                <tr>
                  <TableHeaderCell>Step</TableHeaderCell>
                  <TableHeaderCell>Type</TableHeaderCell>
                  <TableHeaderCell>Temp</TableHeaderCell>
                  <TableHeaderCell>Time</TableHeaderCell>
                  <TableHeaderCell>Ramp</TableHeaderCell>
                </tr>
              </thead>
              <tbody>
                {model.mash.rests.length === 0 ? (
                  <EmptyRow colSpan={5} />
                ) : (
                  model.mash.rests.map((r) => (
                    <tr key={r.id} data-testid={`brew-sheet-mash-rest-${r.id}`}>
                      <TableCell>{r.name}</TableCell>
                      <TableCell>{r.type}</TableCell>
                      <TableCell>{r.stepTempC.toFixed(1)}°C</TableCell>
                      <TableCell>{r.stepTimeMin} min</TableCell>
                      <TableCell>{r.rampTimeMin} min</TableCell>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </div>

          <div className={SUBPANEL_CLASS}>
            <h5 className={SUBSECTION_HEADING_CLASS}>Fermentables ({model.fermentables.totalKg.toFixed(3)} kg)</h5>
            <Table>
              <thead>
                <tr>
                  <TableHeaderCell>Name</TableHeaderCell>
                  <TableHeaderCell>Type</TableHeaderCell>
                  <TableHeaderCell>Amount</TableHeaderCell>
                  <TableHeaderCell>%</TableHeaderCell>
                  <TableHeaderCell>Color</TableHeaderCell>
                </tr>
              </thead>
              <tbody>
                {model.fermentables.rows.length === 0 ? (
                  <EmptyRow colSpan={5} />
                ) : (
                  model.fermentables.rows.map((f) => (
                    <tr key={f.id} data-testid={`brew-sheet-fermentable-${f.id}`}>
                      <TableCell>{f.name}</TableCell>
                      <TableCell>{f.type}</TableCell>
                      <TableCell>{f.amountKg.toFixed(3)} kg</TableCell>
                      <TableCell>{f.percentOfGrist.toFixed(1)}%</TableCell>
                      <TableCell>
                        {f.colorSrm.toFixed(1)} SRM / {f.colorEbc.toFixed(1)} EBC
                      </TableCell>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </div>

          <div className={SUBPANEL_CLASS}>
            <h5 className={SUBSECTION_HEADING_CLASS}>Hops ({model.hops.totalG.toFixed(1)} g)</h5>
            <Table>
              <thead>
                <tr>
                  <TableHeaderCell>Name</TableHeaderCell>
                  <TableHeaderCell>Use</TableHeaderCell>
                  <TableHeaderCell>Amount</TableHeaderCell>
                  <TableHeaderCell>AA%</TableHeaderCell>
                  <TableHeaderCell>Timing</TableHeaderCell>
                  <TableHeaderCell>IBU</TableHeaderCell>
                  <TableHeaderCell>%</TableHeaderCell>
                </tr>
              </thead>
              <tbody>
                {model.hops.rows.length === 0 ? (
                  <EmptyRow colSpan={7} />
                ) : (
                  model.hops.rows.map((h) => (
                    <tr key={h.id} data-testid={`brew-sheet-hop-${h.id}`}>
                      <TableCell>{h.name}</TableCell>
                      <TableCell>{h.use}</TableCell>
                      <TableCell>{h.amountG} g</TableCell>
                      <TableCell>{h.alphaAcidPct}%</TableCell>
                      <TableCell>{h.timingLabel}</TableCell>
                      <TableCell>{h.ibuContribution.toFixed(1)}</TableCell>
                      <TableCell>{h.percentOfTotalHops.toFixed(1)}%</TableCell>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </div>

          <div className={SUBPANEL_CLASS}>
            <h5 className={SUBSECTION_HEADING_CLASS}>Miscs</h5>
            <Table>
              <thead>
                <tr>
                  <TableHeaderCell>Name</TableHeaderCell>
                  <TableHeaderCell>Type</TableHeaderCell>
                  <TableHeaderCell>Use</TableHeaderCell>
                  <TableHeaderCell>Amount</TableHeaderCell>
                  <TableHeaderCell>Time</TableHeaderCell>
                </tr>
              </thead>
              <tbody>
                {model.miscs.length === 0 ? (
                  <EmptyRow colSpan={5} />
                ) : (
                  model.miscs.map((m) => (
                    <tr key={m.id} data-testid={`brew-sheet-misc-${m.id}`}>
                      <TableCell>{m.name}</TableCell>
                      <TableCell>{m.type}</TableCell>
                      <TableCell>{m.use}</TableCell>
                      <TableCell>
                        {m.amount} {m.unit}
                      </TableCell>
                      <TableCell>{m.timeMinutes} min</TableCell>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </div>

          <div className={SUBPANEL_CLASS}>
            <h5 className={SUBSECTION_HEADING_CLASS}>Yeast</h5>
            <Table>
              <thead>
                <tr>
                  <TableHeaderCell>Name</TableHeaderCell>
                  <TableHeaderCell>Lab</TableHeaderCell>
                  <TableHeaderCell>Type</TableHeaderCell>
                  <TableHeaderCell>Form</TableHeaderCell>
                  <TableHeaderCell>Attenuation</TableHeaderCell>
                  <TableHeaderCell>Amount</TableHeaderCell>
                </tr>
              </thead>
              <tbody>
                {model.yeasts.length === 0 ? (
                  <EmptyRow colSpan={6} />
                ) : (
                  model.yeasts.map((y) => (
                    <tr key={y.id} data-testid={`brew-sheet-yeast-${y.id}`}>
                      <TableCell>{y.name}</TableCell>
                      <TableCell>{y.laboratory}</TableCell>
                      <TableCell>{y.type}</TableCell>
                      <TableCell>{y.form}</TableCell>
                      <TableCell>{y.attenuationPct}%</TableCell>
                      <TableCell>{y.amountPkg}</TableCell>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </div>

          <div className={SUBPANEL_CLASS}>
            <h5 className={SUBSECTION_HEADING_CLASS}>Fermentation Schedule</h5>
            <div className="text-sm text-slate-200 mb-2">{model.fermentation.profileName ?? '—'}</div>
            <Table>
              <thead>
                <tr>
                  <TableHeaderCell>Step</TableHeaderCell>
                  <TableHeaderCell>Type</TableHeaderCell>
                  <TableHeaderCell>Temp</TableHeaderCell>
                  <TableHeaderCell>Time</TableHeaderCell>
                  <TableHeaderCell>Ramp</TableHeaderCell>
                  <TableHeaderCell>Pressure</TableHeaderCell>
                </tr>
              </thead>
              <tbody>
                {model.fermentation.steps.length === 0 ? (
                  <EmptyRow colSpan={6} />
                ) : (
                  model.fermentation.steps.map((s) => (
                    <tr key={s.id} data-testid={`brew-sheet-fermentation-${s.id}`}>
                      <TableCell>{s.name}</TableCell>
                      <TableCell>{s.type}</TableCell>
                      <TableCell>{s.stepTempC.toFixed(1)}°C</TableCell>
                      <TableCell>{s.stepTimeDays} d</TableCell>
                      <TableCell>{s.rampDays} d</TableCell>
                      <TableCell>{s.pressurePsi !== null ? `${s.pressurePsi} psi` : '—'}</TableCell>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </div>

          <div className={SUBPANEL_CLASS}>
            <h5 className={SUBSECTION_HEADING_CLASS}>Carbonation</h5>
            <div className="text-sm text-slate-200" data-testid="brew-sheet-carbonation">
              {model.carbonationVolumes !== null ? `${model.carbonationVolumes.toFixed(1)} vols CO2` : '—'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
