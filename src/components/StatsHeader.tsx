import React from 'react';
import type { CalculatedStats } from '../types/brewing';
import { srmToHex, getSRMColorName } from '../utils/srmColor';
import { Flame, Droplets, Scale, Activity } from 'lucide-react';

interface StatsHeaderProps {
  stats: CalculatedStats;
  batchSizeL: number;
}

export const StatsHeader: React.FC<StatsHeaderProps> = ({ stats, batchSizeL }) => {
  const srmHex = srmToHex(stats.srm);
  const colorName = getSRMColorName(stats.srm);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl text-slate-100 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4 pb-4 border-b border-slate-800">
        <h2 className="text-xl font-bold text-amber-400 flex items-center gap-2">
          <Activity className="w-5 h-5" /> Live Recipe Statistics
        </h2>
        <div className="flex items-center gap-3 text-sm text-slate-400">
          <span>Batch Size: <strong className="text-slate-200">{batchSizeL} L</strong></span>
          <span>•</span>
          <span>Pre-Boil Vol: <strong className="text-slate-200">{stats.preBoilVolumeL} L</strong></span>
          <span>•</span>
          <span>Efficiency: <strong className="text-slate-200">75%</strong></span>
        </div>
      </div>

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Original Gravity */}
        <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700/60">
          <div className="text-xs text-slate-400 font-medium mb-1">Original Gravity</div>
          <div className="text-2xl font-extrabold text-white tracking-tight">{stats.og.toFixed(3)}</div>
          <div className="text-xs text-slate-400 mt-1">Pre-boil: {stats.preBoilGravity.toFixed(3)}</div>
        </div>

        {/* Final Gravity */}
        <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700/60">
          <div className="text-xs text-slate-400 font-medium mb-1">Final Gravity (Est.)</div>
          <div className="text-2xl font-extrabold text-slate-200 tracking-tight">{stats.fg.toFixed(3)}</div>
          <div className="text-xs text-slate-400 mt-1">Attenuation: 78%</div>
        </div>

        {/* ABV */}
        <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700/60 relative overflow-hidden">
          <div className="text-xs text-amber-400/90 font-medium mb-1 flex items-center justify-between">
            <span>ABV</span>
            <Flame className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div className="text-2xl font-extrabold text-amber-400 tracking-tight">{stats.abv}%</div>
          <div className="text-xs text-slate-400 mt-1">Balling Formula</div>
        </div>

        {/* IBU */}
        <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700/60">
          <div className="text-xs text-emerald-400/90 font-medium mb-1">Bitterness (IBU)</div>
          <div className="text-2xl font-extrabold text-emerald-400 tracking-tight">{stats.ibu} <span className="text-xs font-normal text-slate-400">IBU</span></div>
          <div className="text-xs text-slate-400 mt-1">Tinseth</div>
        </div>

        {/* Color / SRM */}
        <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700/60">
          <div className="text-xs text-slate-400 font-medium mb-1 flex items-center justify-between">
            <span>Color (SRM)</span>
            <span className="w-3.5 h-3.5 rounded-full border border-slate-600 shadow-inner" style={{ backgroundColor: srmHex }} />
          </div>
          <div className="text-2xl font-extrabold text-slate-100 tracking-tight flex items-baseline gap-1.5">
            {stats.srm} <span className="text-xs font-normal text-slate-400">({stats.ebc} EBC)</span>
          </div>
          <div className="text-xs text-slate-400 truncate mt-1">{colorName}</div>
        </div>

        {/* BU:GU / RBR */}
        <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700/60">
          <div className="text-xs text-slate-400 font-medium mb-1">BU:GU Ratio</div>
          <div className="text-2xl font-extrabold text-cyan-400 tracking-tight">{stats.buGu}</div>
          <div className="text-xs text-slate-400 mt-1">RBR: {stats.rbr}</div>
        </div>
      </div>

      {/* Secondary Quick Specs Bar */}
      <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-3">
        <div className="flex items-center gap-2">
          <Scale className="w-4 h-4 text-slate-500" />
          <span>Total Grain: <strong className="text-slate-200">{stats.totalGrainKg} kg</strong></span>
          <span className="mx-1">•</span>
          <span>Total Hops: <strong className="text-slate-200">{stats.totalHopG} g</strong></span>
        </div>
        <div className="flex items-center gap-2">
          <Droplets className="w-4 h-4 text-sky-400" />
          <span>Mash Water: <strong className="text-slate-200">{stats.mashWaterL} L</strong></span>
          <span className="mx-1">+</span>
          <span>Sparge: <strong className="text-slate-200">{stats.spargeWaterL} L</strong></span>
          <span className="mx-1">=</span>
          <span>Total Water: <strong className="text-slate-200">{stats.totalWaterL} L</strong></span>
        </div>
      </div>
    </div>
  );
};
