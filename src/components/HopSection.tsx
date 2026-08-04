import React, { useState } from 'react';
import type { HopItem, HopUse } from '../types/brewing';
import { INGREDIENT_CATALOG } from '../data/seedData';
import { calculateSingleHopIbu } from '../calculations/brewingMath';
import { Plus, Trash2, Sprout } from 'lucide-react';

interface HopSectionProps {
  hops: HopItem[];
  preBoilGravity: number;
  batchSizeL: number;
  totalHopG: number;
  totalIbu: number;
  onUpdate: (updated: HopItem[]) => void;
}

export const HopSection: React.FC<HopSectionProps> = ({
  hops,
  preBoilGravity,
  batchSizeL,
  totalHopG,
  totalIbu,
  onUpdate
}) => {
  const [selectedCatalogId, setSelectedCatalogId] = useState('');
  const [amountGInput, setAmountGInput] = useState('25');
  const [useInput, setUseInput] = useState<HopUse>('Boil');
  const [timeInput, setTimeInput] = useState('60');

  const handleAddFromCatalog = () => {
    const catalogItem = INGREDIENT_CATALOG.hops.find((h) => h.id === selectedCatalogId);
    if (!catalogItem) return;

    const newItem: HopItem = {
      id: 'h-user-' + Date.now(),
      name: catalogItem.name,
      alphaAcidPct: catalogItem.alphaAcidPct,
      amountG: parseFloat(amountGInput) || 25,
      use: useInput,
      timeMinutes: parseInt(timeInput, 10) || 0,
      type: catalogItem.type
    };

    onUpdate([...hops, newItem]);
    setSelectedCatalogId('');
  };

  const handleAmountChange = (id: string, amountG: number) => {
    onUpdate(hops.map((h) => (h.id === id ? { ...h, amountG: Math.max(0, amountG) } : h)));
  };

  const handleAlphaChange = (id: string, alphaAcidPct: number) => {
    onUpdate(hops.map((h) => (h.id === id ? { ...h, alphaAcidPct: Math.max(0, alphaAcidPct) } : h)));
  };

  const handleTimeChange = (id: string, timeMinutes: number) => {
    onUpdate(hops.map((h) => (h.id === id ? { ...h, timeMinutes: Math.max(0, timeMinutes) } : h)));
  };

  const handleRemove = (id: string) => {
    onUpdate(hops.filter((h) => h.id !== id));
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
          <Sprout className="w-5 h-5 text-emerald-500" /> Hops & Hop Schedule
        </h3>
        <div className="text-xs text-slate-400 flex items-center gap-3">
          <span>Total Hops: <strong className="text-slate-200">{totalHopG} g</strong></span>
          <span>•</span>
          <span>Total IBU: <strong className="text-emerald-400">{totalIbu} IBU</strong></span>
        </div>
      </div>

      {/* Hop Table */}
      <div className="overflow-x-auto mb-4">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="bg-slate-800/80 text-xs text-slate-400 uppercase border-b border-slate-700">
            <tr>
              <th className="py-2 px-3">Hop Name</th>
              <th className="py-2 px-3">Use</th>
              <th className="py-2 px-3 text-right">Time (min)</th>
              <th className="py-2 px-3 text-right">Amount (g)</th>
              <th className="py-2 px-3 text-right">Alpha Acid %</th>
              <th className="py-2 px-3 text-right">Contribution (IBU)</th>
              <th className="py-2 px-3 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {hops.map((hop) => {
              const itemIbu = Math.round(calculateSingleHopIbu(hop, preBoilGravity, batchSizeL));
              return (
                <tr key={hop.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-2.5 px-3 font-medium text-slate-100 flex items-center gap-2">
                    {hop.name}
                    <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded border border-slate-700">
                      {hop.type}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-xs">
                    <span className={`px-2 py-0.5 rounded font-semibold text-[11px] ${
                      hop.use === 'Boil' ? 'bg-amber-950/80 text-amber-300 border border-amber-800/50' :
                      hop.use === 'Whirlpool' ? 'bg-indigo-950/80 text-indigo-300 border border-indigo-800/50' :
                      'bg-emerald-950/80 text-emerald-300 border border-emerald-800/50'
                    }`}>
                      {hop.use}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <input
                      type="number"
                      min="0"
                      value={hop.timeMinutes}
                      onChange={(e) => handleTimeChange(hop.id, parseInt(e.target.value, 10) || 0)}
                      className="w-16 text-right bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-100 focus:outline-none focus:border-emerald-500 text-xs"
                    />
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <input
                      type="number"
                      step="5"
                      min="0"
                      value={hop.amountG}
                      onChange={(e) => handleAmountChange(hop.id, parseFloat(e.target.value) || 0)}
                      className="w-16 text-right bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-100 focus:outline-none focus:border-emerald-500 text-xs"
                    />
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={hop.alphaAcidPct}
                      onChange={(e) => handleAlphaChange(hop.id, parseFloat(e.target.value) || 0)}
                      className="w-16 text-right bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-100 focus:outline-none focus:border-emerald-500 text-xs"
                    />
                  </td>
                  <td className="py-2.5 px-3 text-right text-xs text-emerald-400 font-bold">
                    {itemIbu} IBU
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <button
                      onClick={() => handleRemove(hop.id)}
                      className="text-slate-500 hover:text-rose-400 p-1 transition-colors"
                      title="Remove hop"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
            {hops.length === 0 && (
              <tr>
                <td colSpan={7} className="py-4 text-center text-xs text-slate-500 italic">
                  No hops added yet. Add hop additions below to calculate bittering & aroma.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add Hop Form */}
      <div className="flex flex-wrap items-center gap-3 bg-slate-800/50 p-3 rounded-lg border border-slate-800">
        <span className="text-xs text-slate-400 font-medium">Add Hop:</span>
        <select
          value={selectedCatalogId}
          onChange={(e) => setSelectedCatalogId(e.target.value)}
          className="flex-1 min-w-[180px] bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
        >
          <option value="">-- Select Hop Variety --</option>
          {INGREDIENT_CATALOG.hops.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name} ({cat.alphaAcidPct}% AA)
            </option>
          ))}
        </select>

        <select
          value={useInput}
          onChange={(e) => setUseInput(e.target.value as HopUse)}
          className="bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
        >
          <option value="Boil">Boil</option>
          <option value="Whirlpool">Whirlpool</option>
          <option value="DryHop">Dry Hop</option>
        </select>

        <div className="flex items-center gap-1">
          <input
            type="number"
            value={timeInput}
            onChange={(e) => setTimeInput(e.target.value)}
            className="w-14 bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-500 text-right"
          />
          <span className="text-xs text-slate-400">min</span>
        </div>

        <div className="flex items-center gap-1">
          <input
            type="number"
            step="5"
            value={amountGInput}
            onChange={(e) => setAmountGInput(e.target.value)}
            className="w-16 bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-500 text-right"
          />
          <span className="text-xs text-slate-400">g</span>
        </div>

        <button
          onClick={handleAddFromCatalog}
          disabled={!selectedCatalogId}
          className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold px-3 py-2 rounded flex items-center gap-1 transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Hop
        </button>
      </div>
    </div>
  );
};
