import React, { useState } from 'react';
import type { YeastItem } from '../types/brewing';
import { useCatalog } from '../context/CatalogContext';
import { Plus, Trash2, FlaskConical } from 'lucide-react';
import { CARD_CLASS, SECTION_HEADING_CLASS } from './designSystem';

interface YeastSectionProps {
  yeasts: YeastItem[];
  onUpdate: (updated: YeastItem[]) => void;
}

export const YeastSection: React.FC<YeastSectionProps> = ({ yeasts, onUpdate }) => {
  const { catalog, error: catalogError } = useCatalog();
  const [selectedCatalogId, setSelectedCatalogId] = useState('');

  const handleAddFromCatalog = () => {
    const catalogItem = catalog.yeasts.find((y) => y.id === selectedCatalogId);
    if (!catalogItem) return;

    const newItem: YeastItem = {
      id: 'y-user-' + Date.now(),
      name: catalogItem.name,
      laboratory: catalogItem.laboratory,
      type: catalogItem.type,
      form: catalogItem.form,
      attenuationPct: catalogItem.attenuationPct,
      amountPkg: 1
    };

    onUpdate([...yeasts, newItem]);
    setSelectedCatalogId('');
  };

  const handleAttenuationChange = (id: string, attenuationPct: number) => {
    onUpdate(yeasts.map((y) => (y.id === id ? { ...y, attenuationPct: Math.max(0, Math.min(100, attenuationPct)) } : y)));
  };

  const handleRemove = (id: string) => {
    onUpdate(yeasts.filter((y) => y.id !== id));
  };

  return (
    <div className={CARD_CLASS}>
      <div className="flex items-center justify-between mb-4">
        <h3 className={SECTION_HEADING_CLASS}>
          <FlaskConical className="w-5 h-5 text-purple-400" /> Yeast Strain & Fermentation
        </h3>
      </div>

      {/* Yeast Table */}
      <div className="overflow-x-auto mb-4">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="bg-slate-800/80 text-xs text-slate-400 uppercase border-b border-slate-700">
            <tr>
              <th scope="col" className="py-2 px-3">Yeast Name</th>
              <th scope="col" className="py-2 px-3">Laboratory</th>
              <th scope="col" className="py-2 px-3">Type</th>
              <th scope="col" className="py-2 px-3">Form</th>
              <th scope="col" className="py-2 px-3 text-right">Attenuation %</th>
              <th scope="col" className="py-2 px-3 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {yeasts.map((yeast) => (
              <tr key={yeast.id} className="hover:bg-slate-800/40 transition-colors">
                <td className="py-2.5 px-3 font-medium text-slate-100">{yeast.name}</td>
                <td className="py-2.5 px-3 text-xs text-slate-400">{yeast.laboratory}</td>
                <td className="py-2.5 px-3 text-xs text-slate-300">{yeast.type}</td>
                <td className="py-2.5 px-3 text-xs text-slate-400">{yeast.form}</td>
                <td className="py-2.5 px-3 text-right">
                  <input
                    type="number"
                    aria-label={`${yeast.name} attenuation %`}
                    min="50"
                    max="98"
                    value={yeast.attenuationPct}
                    onChange={(e) => handleAttenuationChange(yeast.id, parseInt(e.target.value, 10) || 75)}
                    className="w-16 text-right bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-100 focus:outline-none focus:border-purple-500 text-xs"
                  />
                </td>
                <td className="py-2.5 px-3 text-center">
                  <button
                    type="button"
                    onClick={() => handleRemove(yeast.id)}
                    className="text-slate-500 hover:text-rose-400 p-2 transition-colors cursor-pointer"
                    title="Remove yeast"
                    aria-label={`Remove ${yeast.name}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {yeasts.length === 0 && (
              <tr>
                <td colSpan={6} className="py-4 text-center text-xs text-slate-500 italic">
                  No yeast added yet. Select a yeast strain below.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add Yeast Form */}
      <div className="flex flex-wrap items-center gap-3 bg-slate-800/50 p-3 rounded-lg border border-slate-800">
        <span className="text-xs text-slate-400 font-medium">Add Yeast:</span>
        <select
          value={selectedCatalogId}
          onChange={(e) => setSelectedCatalogId(e.target.value)}
          disabled={!!catalogError}
          className="flex-1 min-w-[220px] bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <option value="">-- Select Yeast Strain --</option>
          {catalog.yeasts.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name} ({cat.laboratory}) - {cat.attenuationPct}% Attenuation
            </option>
          ))}
        </select>
        <button
          onClick={handleAddFromCatalog}
          disabled={!selectedCatalogId || !!catalogError}
          className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold px-3 py-2 rounded flex items-center gap-1 transition-colors"
        >
          <Plus className="w-4 h-4" /> Select Yeast
        </button>
        {catalogError && <span className="text-xs text-rose-400 italic">Catalog unavailable — you can still edit fields above.</span>}
      </div>
    </div>
  );
};
