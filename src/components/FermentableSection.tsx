import React, { useState } from 'react';
import type { FermentableItem } from '../types/brewing';
import { INGREDIENT_CATALOG } from '../data/seedData';
import { Plus, Trash2, Wheat } from 'lucide-react';

interface FermentableSectionProps {
  fermentables: FermentableItem[];
  totalGrainKg: number;
  onUpdate: (updated: FermentableItem[]) => void;
}

export const FermentableSection: React.FC<FermentableSectionProps> = ({ fermentables, totalGrainKg, onUpdate }) => {
  const [selectedCatalogId, setSelectedCatalogId] = useState('');
  const [amountKgInput, setAmountKgInput] = useState('1.0');

  const handleAddFromCatalog = () => {
    const catalogItem = INGREDIENT_CATALOG.fermentables.find((f) => f.id === selectedCatalogId);
    if (!catalogItem) return;

    const newItem: FermentableItem = {
      id: 'f-user-' + Date.now(),
      name: catalogItem.name,
      type: catalogItem.type,
      amountKg: parseFloat(amountKgInput) || 1.0,
      colorSrm: catalogItem.colorSrm,
      potentialSg: catalogItem.potentialSg
    };

    onUpdate([...fermentables, newItem]);
    setSelectedCatalogId('');
  };

  const handleAmountChange = (id: string, newAmount: number) => {
    const updated = fermentables.map((f) => (f.id === id ? { ...f, amountKg: Math.max(0, newAmount) } : f));
    onUpdate(updated);
  };

  const handleRemove = (id: string) => {
    onUpdate(fermentables.filter((f) => f.id !== id));
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
          <Wheat className="w-5 h-5 text-amber-500" /> Fermentables & Malts
        </h3>
        <span className="text-xs text-slate-400">Total: <strong className="text-slate-200">{totalGrainKg} kg</strong></span>
      </div>

      {/* Fermentables Table */}
      <div className="overflow-x-auto mb-4">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="bg-slate-800/80 text-xs text-slate-400 uppercase border-b border-slate-700">
            <tr>
              <th className="py-2 px-3">Name</th>
              <th className="py-2 px-3">Type</th>
              <th className="py-2 px-3 text-right">Amount (kg)</th>
              <th className="py-2 px-3 text-right">% Grain Bill</th>
              <th className="py-2 px-3 text-right">Color (SRM)</th>
              <th className="py-2 px-3 text-right">Potential (SG)</th>
              <th className="py-2 px-3 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {fermentables.map((item) => {
              const pct = totalGrainKg > 0 ? ((item.amountKg / totalGrainKg) * 100).toFixed(1) : '0';
              return (
                <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-2.5 px-3 font-medium text-slate-100">{item.name}</td>
                  <td className="py-2.5 px-3 text-xs text-slate-400">{item.type}</td>
                  <td className="py-2.5 px-3 text-right">
                    <input
                      type="number"
                      step="0.05"
                      min="0"
                      value={item.amountKg}
                      onChange={(e) => handleAmountChange(item.id, parseFloat(e.target.value) || 0)}
                      className="w-20 text-right bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-100 focus:outline-none focus:border-amber-500"
                    />
                  </td>
                  <td className="py-2.5 px-3 text-right text-xs text-amber-400 font-semibold">{pct}%</td>
                  <td className="py-2.5 px-3 text-right text-xs text-slate-300">{item.colorSrm} SRM</td>
                  <td className="py-2.5 px-3 text-right text-xs text-slate-300">{item.potentialSg.toFixed(3)}</td>
                  <td className="py-2.5 px-3 text-center">
                    <button
                      onClick={() => handleRemove(item.id)}
                      className="text-slate-500 hover:text-rose-400 p-1 transition-colors"
                      title="Remove fermentable"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
            {fermentables.length === 0 && (
              <tr>
                <td colSpan={7} className="py-4 text-center text-xs text-slate-500 italic">
                  No fermentables added yet. Add malts below to calculate gravity and color.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add Ingredient Form */}
      <div className="flex flex-wrap items-center gap-3 bg-slate-800/50 p-3 rounded-lg border border-slate-800">
        <span className="text-xs text-slate-400 font-medium">Add Fermentable:</span>
        <select
          value={selectedCatalogId}
          onChange={(e) => setSelectedCatalogId(e.target.value)}
          className="flex-1 min-w-[200px] bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
        >
          <option value="">-- Select Grain / Malt from Catalog --</option>
          {INGREDIENT_CATALOG.fermentables.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name} ({cat.colorSrm} SRM, SG {cat.potentialSg})
            </option>
          ))}
        </select>
        <div className="flex items-center gap-1">
          <input
            type="number"
            step="0.1"
            min="0.1"
            value={amountKgInput}
            onChange={(e) => setAmountKgInput(e.target.value)}
            className="w-20 bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-amber-500 text-right"
          />
          <span className="text-xs text-slate-400">kg</span>
        </div>
        <button
          onClick={handleAddFromCatalog}
          disabled={!selectedCatalogId}
          className="bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold px-3 py-2 rounded flex items-center gap-1 transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Malt
        </button>
      </div>
    </div>
  );
};
