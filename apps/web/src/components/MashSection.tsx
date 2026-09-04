import React from 'react';
import type { Recipe, MashProfile, FermentationProfile, UserConfig } from '@truchabrew/shared-types';
import type { MashPlan } from '@truchabrew/calculations';
import { formatTemperature, formatVolume, strikeTempExceedsEnzymeLimit } from '@truchabrew/calculations';
import { Thermometer, Snowflake, Droplets, AlertTriangle } from 'lucide-react';
import { CARD_CLASS, SECTION_HEADING_CLASS, FORM_SELECT_COMPACT_CLASS, MONO_VALUE_CLASS } from './designSystem';
import { Table, TableHeaderCell, TableCell } from './ui';




interface MashSectionProps {
  /** The recipe's own hydrated profiles — MashSection reads these, never the manager lists (AC-51). */
  recipe: Recipe;
  /** From the hook, memoised on the same key as `stats` — never recomputed here. */
  mashPlan: MashPlan;
  /** Population source for the picker dropdowns ONLY — never for a displayed value. */
  mashProfiles: MashProfile[];
  fermentationProfiles: FermentationProfile[];
  onSelectMashProfile: (id: string | null) => void;
  onSelectFermentationProfile: (id: string | null) => void;
  /** AC-23 — strike/sparge/mash-step temperatures render through formatTemperature per this config. */
  config: UserConfig;
}

export const MashSection: React.FC<MashSectionProps> = ({
  recipe,
  mashPlan,
  mashProfiles,
  fermentationProfiles,
  onSelectMashProfile,
  onSelectFermentationProfile,
  config,
}) => {
  return (
    <div className={CARD_CLASS}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ------------------------------------------------------------- */}
        {/* Mash schedule                                                */}
        {/* ------------------------------------------------------------- */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className={SECTION_HEADING_CLASS}>
              <Thermometer className="w-5 h-5 text-amber-500" /> Mash Profile
            </h3>
            <select
              value={recipe.mashProfile?.id ?? ''}
              onChange={(e) => onSelectMashProfile(e.target.value === '' ? null : e.target.value)}
              data-testid="mash-profile-picker"
              aria-label="Select Mash Profile"
              className={FORM_SELECT_COMPACT_CLASS}
            >
              <option value="">None</option>
              {mashProfiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {!mashPlan.hasMashProfile && (
            <div className="text-xs text-slate-400 bg-slate-800/40 border border-slate-800 rounded-lg p-4" data-testid="mash-no-profile">
              No mash profile attached. Pick one above, or create one from the Mash Profiles manager, to see strike water and infusion volumes here.
            </div>
          )}

          {mashPlan.hasMashProfile && (
            <div data-testid="mash-plan">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700/60">
                  <div className="text-xs text-slate-400 font-medium mb-1 flex items-center gap-1">
                    <Droplets className="w-3.5 h-3.5 text-sky-400" /> Strike Water
                  </div>
                  <div className={`text-xl font-extrabold text-white ${MONO_VALUE_CLASS}`}>{formatVolume(mashPlan.strikeWaterL, config.unitSystem)}</div>
                </div>
                {mashPlan.strikeTemperatureC !== null ? (
                  <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700/60">
                    <div className="text-xs text-amber-400/90 font-medium mb-1">Strike Temperature</div>
                    <div className={`text-xl font-extrabold text-amber-400 ${MONO_VALUE_CLASS}`} data-testid="mash-strike-temperature-value">
                      {formatTemperature(mashPlan.strikeTemperatureC, config.temperatureUnit)}
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-800/40 p-3 rounded-lg border border-slate-800 flex items-center text-xs text-slate-400 italic" data-testid="mash-no-steps">
                    This profile has no steps yet
                  </div>
                )}
              </div>

              {mashPlan.strikeTemperatureC !== null && strikeTempExceedsEnzymeLimit(mashPlan.strikeTemperatureC) && (
                <div
                  className="bg-amber-950/50 border border-amber-800 rounded-lg p-2.5 mb-3 flex items-start gap-2 text-xs text-amber-300"
                  data-testid="mash-strike-temp-warning"
                >
                  <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <strong>Warning:</strong> Strike temperature ({formatTemperature(mashPlan.strikeTemperatureC, config.temperatureUnit)}) exceeds 78.0°C — risk of denaturing enzymes.
                  </div>
                </div>
              )}

              <div className="text-xs text-slate-400 mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span>
                  Sparge Temp:{' '}
                  <strong className={`text-slate-200 ${MONO_VALUE_CLASS}`} data-testid="mash-sparge-temperature-value">
                    {formatTemperature(mashPlan.spargeTemperatureC, config.temperatureUnit)} ({mashPlan.spargeTemperatureSource === 'mashProfile' ? 'profile override' : 'equipment default'})
                  </strong>
                </span>
                <span>•</span>
                <span>
                  Target pH: <strong className={`text-slate-200 ${MONO_VALUE_CLASS}`} data-testid="mash-target-ph-value">{mashPlan.targetPh}</strong>
                </span>
              </div>

              {mashPlan.steps.length > 0 && (
                <div className="mb-3">
                  <Table>
                    <thead className="bg-slate-800/80 border-b border-slate-700">
                      <tr>
                        <TableHeaderCell>Step</TableHeaderCell>
                        <TableHeaderCell>Type</TableHeaderCell>
                        <TableHeaderCell className="text-right">Temp</TableHeaderCell>
                        <TableHeaderCell className="text-right">Rest</TableHeaderCell>
                        <TableHeaderCell className="text-right">Infusion</TableHeaderCell>
                        <TableHeaderCell className="text-right">Volume After</TableHeaderCell>
                      </tr>
                    </thead>
                    <tbody>
                      {mashPlan.steps.map((step) => (
                        <tr key={step.stepId} data-testid={`mash-plan-step-${step.position}`}>
                          <TableCell size="sm" variant="text" className="font-medium">{step.name}</TableCell>
                          <TableCell size="sm" variant="text">{step.type}</TableCell>
                          <TableCell size="sm" className="text-right">{formatTemperature(step.stepTempC, config.temperatureUnit)}</TableCell>
                          <TableCell size="sm" className="text-right">{step.stepTimeMin} min</TableCell>
                          <TableCell size="sm" className="text-right">
                            {step.infusionVolumeL === null ? (
                              <span className="text-slate-600">—</span>
                            ) : (
                              <span>
                                {formatVolume(step.infusionVolumeL, config.unitSystem)}{' '}
                                <span className="text-[10px] text-slate-400">({step.infusionSource})</span>
                              </span>
                            )}
                          </TableCell>
                          <TableCell size="sm" className="text-right">{formatVolume(step.mashVolumeAfterL, config.unitSystem)}</TableCell>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              )}


              {mashPlan.mashWaterBalanceL < 0 && (
                <div className="text-[11px] text-amber-400/90 bg-amber-950/30 border border-amber-900 rounded-lg px-3 py-2 flex items-start gap-1.5" data-testid="mash-water-balance-warning">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                  This profile calls for {formatVolume(Math.abs(mashPlan.mashWaterBalanceL), config.unitSystem)} more water than the recipe's mash-water figure allows.
                </div>
              )}
            </div>
          )}
        </div>

        {/* ------------------------------------------------------------- */}
        {/* Fermentation schedule                                        */}
        {/* ------------------------------------------------------------- */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className={SECTION_HEADING_CLASS}>
              <Snowflake className="w-5 h-5 text-amber-500" /> Fermentation Profile
            </h3>
            <select
              value={recipe.fermentationProfile?.id ?? ''}
              onChange={(e) => onSelectFermentationProfile(e.target.value === '' ? null : e.target.value)}
              data-testid="fermentation-profile-picker"
              aria-label="Select Fermentation Profile"
              className={FORM_SELECT_COMPACT_CLASS}
            >
              <option value="">None</option>
              {fermentationProfiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {recipe.fermentationProfile === null && (
            <div className="text-xs text-slate-400 bg-slate-800/40 border border-slate-800 rounded-lg p-4" data-testid="fermentation-no-profile">
              No fermentation profile attached. Pick one above, or create one from the Fermentation Profiles manager.
            </div>
          )}

          {recipe.fermentationProfile !== null && recipe.fermentationProfile.steps.length === 0 && (
            <div className="text-xs text-slate-400 italic bg-slate-800/40 border border-slate-800 rounded-lg p-4" data-testid="fermentation-no-steps">
              This profile has no steps yet.
            </div>
          )}

          {recipe.fermentationProfile !== null && recipe.fermentationProfile.steps.length > 0 && (
            <Table>
              <thead className="bg-slate-800/80 border-b border-slate-700">
                <tr>
                  <TableHeaderCell>Step</TableHeaderCell>
                  <TableHeaderCell>Type</TableHeaderCell>
                  <TableHeaderCell className="text-right">Temp</TableHeaderCell>
                  <TableHeaderCell className="text-right">Duration</TableHeaderCell>
                  <TableHeaderCell className="text-right">Pressure</TableHeaderCell>
                </tr>
              </thead>
              <tbody>
                {recipe.fermentationProfile.steps.map((step, i) => (
                  <tr key={step.id} data-testid={`fermentation-plan-step-${i}`}>
                    <TableCell size="sm" variant="text" className="font-medium">{step.name}</TableCell>
                    <TableCell size="sm" variant="text">{step.type}</TableCell>
                    <TableCell size="sm" className="text-right">{formatTemperature(step.stepTempC, config.temperatureUnit)}</TableCell>
                    <TableCell size="sm" className="text-right">{step.stepTimeDays} d</TableCell>
                    <TableCell size="sm" className="text-right">{step.pressurePsi === null ? <span className="text-slate-600">—</span> : `${step.pressurePsi} psi`}</TableCell>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
      </div>
    </div>
  );
};
