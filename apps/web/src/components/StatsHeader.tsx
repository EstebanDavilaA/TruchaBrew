import React from 'react';
import type { CalculatedStats, EquipmentProfile, UserConfig } from '@truchabrew/shared-types';
import { formatGravity, formatMass, formatVolume, formatHopMass } from '@truchabrew/calculations';
import { srmToHex, getSRMColorName } from '../utils/srmColor';
import { Flame, Droplets, Scale, Activity } from 'lucide-react';
import { CARD_CLASS, METRIC_TILE_CLASS, METRIC_LABEL_CLASS, METRIC_VALUE_CLASS, SECTION_HEADING_CLASS } from './designSystem';

interface StatsHeaderProps {
  stats: CalculatedStats;
  equipment: EquipmentProfile;
  config: UserConfig;
}

// AC-19/AC-20 — the active strategy's DISPLAY name, replacing the two
// hardcoded captions ("Balling Formula", "Tinseth") this component used to
// carry. AC-27's "(approximate)" qualifier applies here too (§4 deviation 1)
// so the caption never silently implies Garetz is a verified formula.
const ABV_STRATEGY_LABEL: Record<UserConfig['abvFormula'], string> = {
  simple: 'Simple',
  balling: 'Balling',
};

const IBU_STRATEGY_LABEL: Record<UserConfig['ibuFormula'], string> = {
  tinseth: 'Tinseth',
  rager: 'Rager',
  garetz: 'Garetz (approximate)',
};

export const StatsHeader: React.FC<StatsHeaderProps> = ({ stats, equipment, config }) => {
  const srmHex = srmToHex(stats.srm);
  const colorName = getSRMColorName(stats.srm);

  return (
    <div className={`${CARD_CLASS} text-slate-100 mb-6`}>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4 pb-4 border-b border-slate-800">
        <h2 className={SECTION_HEADING_CLASS}>
          <Activity className="w-5 h-5" /> Live Recipe Statistics
        </h2>
        <div className="flex items-center gap-3 text-sm text-slate-400">
          <span>Batch Size: <strong className="text-slate-200">{formatVolume(equipment.batchSizeL, config.unitSystem)}</strong></span>
          <span>•</span>
          <span>Pre-Boil Vol: <strong className="text-slate-200">{formatVolume(stats.preBoilVolumeL, config.unitSystem)}</strong></span>
          <span>•</span>
          <span>Efficiency: <strong className="text-slate-200">{equipment.brewhouseEfficiencyPct}%</strong></span>
        </div>
      </div>

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Original Gravity */}
        <div className={METRIC_TILE_CLASS}>
          <div className={METRIC_LABEL_CLASS}>Original Gravity</div>
          <div className={`${METRIC_VALUE_CLASS} text-white`}>{formatGravity(stats.og, config.gravityUnit)}</div>
          <div className="text-xs text-slate-400 mt-1">Pre-boil: {formatGravity(stats.preBoilGravity, config.gravityUnit)}</div>
        </div>

        {/* Final Gravity */}
        <div className={METRIC_TILE_CLASS}>
          <div className={METRIC_LABEL_CLASS}>Final Gravity (Est.)</div>
          <div className={`${METRIC_VALUE_CLASS} text-slate-200`}>{formatGravity(stats.fg, config.gravityUnit)}</div>
          <div className="text-xs text-slate-400 mt-1">Attenuation: {stats.attenuationPct}%</div>
        </div>

        {/* ABV */}
        <div className={`${METRIC_TILE_CLASS} relative overflow-hidden`}>
          <div className="text-xs text-amber-400/90 font-medium mb-1 flex items-center justify-between">
            <span>ABV</span>
            <Flame className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div className={`${METRIC_VALUE_CLASS} text-amber-400`}>{stats.abv.toFixed(1)}%</div>
          <div className="text-xs text-slate-400 mt-1">{ABV_STRATEGY_LABEL[config.abvFormula]}</div>
        </div>

        {/* IBU */}
        <div className={METRIC_TILE_CLASS}>
          <div className="text-xs text-emerald-400/90 font-medium mb-1">Bitterness (IBU)</div>
          <div className={`${METRIC_VALUE_CLASS} text-emerald-400`}>{stats.ibu} <span className="text-xs font-normal text-slate-400">IBU</span></div>
          <div className="text-xs text-slate-400 mt-1">{IBU_STRATEGY_LABEL[config.ibuFormula]}</div>
        </div>

        {/* Color / SRM */}
        <div className={METRIC_TILE_CLASS}>
          <div className={`${METRIC_LABEL_CLASS} flex items-center justify-between`}>
            <span>Color (SRM)</span>
            <span className="w-3.5 h-3.5 rounded-full border border-slate-600 shadow-inner" style={{ backgroundColor: srmHex }} />
          </div>
          <div className={`${METRIC_VALUE_CLASS} text-slate-100 flex items-baseline gap-1.5`}>
            {stats.srm} <span className="text-xs font-normal text-slate-400">({stats.ebc} EBC)</span>
          </div>
          <div className="text-xs text-slate-400 truncate mt-1">{colorName}</div>
        </div>

        {/* BU:GU / RBR */}
        <div className={METRIC_TILE_CLASS}>
          <div className={METRIC_LABEL_CLASS}>BU:GU Ratio</div>
          <div className={`${METRIC_VALUE_CLASS} text-cyan-400`}>{stats.buGu}</div>
          <div className="text-xs text-slate-400 mt-1">RBR: {stats.rbr}</div>
        </div>
      </div>

      {/* Secondary Quick Specs Bar */}
      <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-3">
        <div className="flex items-center gap-2">
          <Scale className="w-4 h-4 text-slate-500" />
          <span>Total Grain: <strong className="text-slate-200">{formatMass(stats.totalGrainKg, config.unitSystem)}</strong></span>
          <span className="mx-1">•</span>
          <span>Total Hops: <strong className="text-slate-200">{formatHopMass(stats.totalHopG, config.unitSystem)}</strong></span>
        </div>
        <div className="flex items-center gap-2">
          <Droplets className="w-4 h-4 text-sky-400" />
          <span>Mash Water: <strong className="text-slate-200">{formatVolume(stats.mashWaterL, config.unitSystem)}</strong></span>
          <span className="mx-1">+</span>
          <span>Sparge: <strong className="text-slate-200">{formatVolume(stats.spargeWaterL, config.unitSystem)}</strong></span>
          <span className="mx-1">=</span>
          <span>Total Water: <strong className="text-slate-200">{formatVolume(stats.totalWaterL, config.unitSystem)}</strong></span>
        </div>
      </div>
    </div>
  );
};
