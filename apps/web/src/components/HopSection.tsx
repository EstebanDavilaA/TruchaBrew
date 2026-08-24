import React, { useState } from 'react';
import type { HopItem, HopUse } from '@truchabrew/shared-types';
import { useCatalog } from '../context/CatalogContext';
import { useConfig } from '../context/ConfigContext';
import {
  calculateSingleHopIbu,
  calculateAltitudeHopUtilization,
  classifyHopUse,
  formatHopMass,
} from '@truchabrew/calculations';
import { Plus, Trash2, Sprout } from 'lucide-react';
import { CARD_CLASS, SECTION_HEADING_CLASS } from './designSystem';

interface HopSectionProps {
  hops: HopItem[];
  wortGravity: number;
  batchSizeL: number;
  hopUtilizationPct: number;
  hopstandUtilizationFactor: number;
  hopstandTemperatureC: number;
  altitudeMeters?: number;
  totalHopG: number;
  totalIbu: number;
  onUpdate: (updated: HopItem[]) => void;
}

export const HopSection: React.FC<HopSectionProps> = ({
  hops,
  wortGravity,
  batchSizeL,
  hopUtilizationPct,
  hopstandUtilizationFactor,
  hopstandTemperatureC,
  altitudeMeters = 0,
  totalHopG,
  totalIbu,
  onUpdate,
}) => {
  const { catalog, error: catalogError } = useCatalog();
  const { config } = useConfig();
  const [selectedCatalogId, setSelectedCatalogId] = useState('');
  const [amountGInput, setAmountGInput] = useState('25');
  const [useInput, setUseInput] = useState<HopUse>('Boil');
  const [timeInput, setTimeInput] = useState('60');
  const [whirlpoolTempInput, setWhirlpoolTempInput] = useState(String(hopstandTemperatureC));
  const [dryHopOffsetInput, setDryHopOffsetInput] = useState('3');
  const [dryHopDurationInput, setDryHopDurationInput] = useState('4');

  const handleAddFromCatalog = () => {
    const catalogItem = catalog.hops.find((h) => h.id === selectedCatalogId);
    if (!catalogItem) return;

    const useClass = classifyHopUse(useInput);
    const parsedTime = parseInt(timeInput, 10) || 0;
    const parsedWhirlpoolTemp = parseFloat(whirlpoolTempInput) || hopstandTemperatureC;
    const parsedDayOffset = parseInt(dryHopOffsetInput, 10) || 0;
    const parsedDurationDays = parseFloat(dryHopDurationInput) || 3;

    const newItem: HopItem = {
      id: 'h-user-' + Date.now(),
      name: catalogItem.name,
      alphaAcidPct: catalogItem.alphaAcidPct,
      amountG: parseFloat(amountGInput) || 25,
      use: useInput,
      boilMins: useClass === 'boil' ? parsedTime : null,
      whirlpoolMins: useClass === 'hopstand' ? parsedTime : null,
      whirlpoolTempC: useClass === 'hopstand' ? parsedWhirlpoolTemp : null,
      dryHopDayOffset: useInput === 'DryHop' ? parsedDayOffset : null,
      dryHopDurationDays: useInput === 'DryHop' ? parsedDurationDays : null,
      timeMinutes: useInput === 'DryHop' ? parsedDurationDays * 1440 : (useClass === 'none' ? parsedTime : null),
      type: catalogItem.type,
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

  const handleBoilMinsChange = (id: string, mins: number) => {
    onUpdate(hops.map((h) => (h.id === id ? { ...h, boilMins: Math.max(0, mins) } : h)));
  };

  const handleWhirlpoolMinsChange = (id: string, mins: number) => {
    onUpdate(hops.map((h) => (h.id === id ? { ...h, whirlpoolMins: Math.max(0, mins) } : h)));
  };

  const handleWhirlpoolTempChange = (id: string, tempC: number) => {
    onUpdate(hops.map((h) => (h.id === id ? { ...h, whirlpoolTempC: tempC } : h)));
  };

  const handleDryHopOffsetChange = (id: string, offset: number) => {
    onUpdate(hops.map((h) => (h.id === id ? { ...h, dryHopDayOffset: Math.max(0, offset) } : h)));
  };

  const handleDryHopDurationChange = (id: string, duration: number) => {
    onUpdate(
      hops.map((h) =>
        h.id === id
          ? {
              ...h,
              dryHopDurationDays: Math.max(0, duration),
              timeMinutes: Math.max(0, duration) * 1440,
            }
          : h,
      ),
    );
  };

  const handleUseChange = (id: string, newUse: HopUse) => {
    onUpdate(
      hops.map((h) => {
        if (h.id !== id) return h;
        const newClass = classifyHopUse(newUse);
        return {
          ...h,
          use: newUse,
          boilMins: newClass === 'boil' ? (h.boilMins ?? 60) : h.boilMins,
          whirlpoolMins: newClass === 'hopstand' ? (h.whirlpoolMins ?? 20) : h.whirlpoolMins,
          whirlpoolTempC: newClass === 'hopstand' ? (h.whirlpoolTempC ?? hopstandTemperatureC) : h.whirlpoolTempC,
          dryHopDayOffset: newUse === 'DryHop' ? (h.dryHopDayOffset ?? 3) : h.dryHopDayOffset,
          dryHopDurationDays: newUse === 'DryHop' ? (h.dryHopDurationDays ?? 4) : h.dryHopDurationDays,
          timeMinutes: newUse === 'DryHop' ? (h.dryHopDurationDays ?? 4) * 1440 : h.timeMinutes,
        };
      }),
    );
  };

  const handleRemove = (id: string) => {
    onUpdate(hops.filter((h) => h.id !== id));
  };

  return (
    <div className={CARD_CLASS}>
      <div className="flex items-center justify-between mb-4">
        <h3 className={SECTION_HEADING_CLASS}>
          <Sprout className="w-5 h-5 text-emerald-500" /> Hops & Contextual Hop Schedule
        </h3>
        <div className="flex items-center gap-4 text-xs font-semibold text-slate-400 bg-slate-900/50 px-3 py-2 rounded-lg border border-slate-800">
          <div>
            <span className="text-slate-300">Total Hops:</span>{' '}
            <span className="text-amber-400">{formatHopMass(totalHopG, config.unitSystem)}</span>
          </div>
          <div>
            <span className="text-slate-300">Estimated IBU:</span>{' '}
            <span className="text-amber-400" data-testid="estimated-ibu-display">{totalIbu.toFixed(1)}</span>
            {altitudeMeters > 0 && (
              <span className="text-[10px] text-sky-400 ml-1">({altitudeMeters}m alt)</span>
            )}
          </div>
        </div>
      </div>

      {/* Hop Table */}
      <div className="overflow-x-auto mb-4">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="bg-slate-800/80 text-xs text-slate-400 uppercase border-b border-slate-700">
            <tr>
              <th scope="col" className="py-2 px-3">Hop Variety</th>
              <th scope="col" className="py-2 px-3">Use</th>
              <th scope="col" className="py-2 px-3 text-right">Timing / Schedule</th>
              <th scope="col" className="py-2 px-3 text-right">Amount (g)</th>
              <th scope="col" className="py-2 px-3 text-right">Alpha Acid %</th>
              <th scope="col" className="py-2 px-3 text-right">Contribution (IBU)</th>
              <th scope="col" className="py-2 px-3 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {hops.map((hop) => {
              let itemIbu = calculateSingleHopIbu(hop, wortGravity, batchSizeL, {
                hopUtilizationPct,
                hopstandUtilizationFactor,
              });
              if (altitudeMeters > 0) {
                itemIbu = calculateAltitudeHopUtilization(itemIbu, altitudeMeters);
              }

              const hopUseClass = classifyHopUse(hop.use);

              return (
                <tr key={hop.id} className="hover:bg-slate-800/40 transition-colors" data-testid={`hop-row-${hop.id}`}>
                  <td className="py-2.5 px-3 font-medium text-slate-100 flex items-center gap-2">
                    {hop.name}
                    <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded border border-slate-700">
                      {hop.type}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-xs">
                    <select
                      value={hop.use}
                      aria-label="Hop use"
                      data-testid={`hop-use-select-${hop.id}`}
                      onChange={(e) => handleUseChange(hop.id, e.target.value as HopUse)}
                      className={`px-2 py-1 rounded font-semibold text-[11px] bg-slate-800 border focus:outline-none cursor-pointer ${
                        hop.use === 'Boil'
                          ? 'text-amber-300 border-amber-800/60'
                          : hop.use === 'Whirlpool'
                            ? 'text-indigo-300 border-indigo-800/60'
                            : hop.use === 'DryHop'
                              ? 'text-emerald-300 border-emerald-800/60'
                              : 'text-sky-300 border-sky-800/60'
                      }`}
                    >
                      <option value="Boil">Boil</option>
                      <option value="Whirlpool">Whirlpool</option>
                      <option value="DryHop">Dry Hop</option>
                      <option value="FirstWort">First Wort</option>
                      <option value="Aroma">Aroma</option>
                    </select>
                  </td>

                  {/* Contextual Timing / Schedule Input */}
                  <td className="py-2.5 px-3 text-right">
                    {hopUseClass === 'boil' ? (
                      <div className="flex items-center justify-end gap-1">
                        <input
                          type="number"
                          min="0"
                          aria-label="Boil minutes"
                          data-testid={`hop-boil-mins-${hop.id}`}
                          value={hop.boilMins ?? 0}
                          onChange={(e) => handleBoilMinsChange(hop.id, parseInt(e.target.value, 10) || 0)}
                          className="w-16 text-right bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-100 focus:outline-none focus:border-emerald-500 text-xs"
                        />
                        <span className="text-[11px] text-slate-400">min</span>
                      </div>
                    ) : hopUseClass === 'hopstand' ? (
                      <div className="flex items-center justify-end gap-1.5">
                        <input
                          type="number"
                          min="0"
                          aria-label="Whirlpool minutes"
                          data-testid={`hop-whirlpool-mins-${hop.id}`}
                          value={hop.whirlpoolMins ?? 0}
                          onChange={(e) => handleWhirlpoolMinsChange(hop.id, parseInt(e.target.value, 10) || 0)}
                          className="w-14 text-right bg-slate-800 border border-slate-700 rounded px-1.5 py-1 text-slate-100 focus:outline-none focus:border-emerald-500 text-xs"
                        />
                        <span className="text-[10px] text-slate-400">min @</span>
                        <input
                          type="number"
                          step="0.5"
                          aria-label="Whirlpool temp"
                          data-testid={`hop-whirlpool-temp-${hop.id}`}
                          value={hop.whirlpoolTempC ?? hopstandTemperatureC}
                          onChange={(e) => handleWhirlpoolTempChange(hop.id, parseFloat(e.target.value) || 0)}
                          className="w-14 text-right bg-slate-800 border border-slate-700 rounded px-1.5 py-1 text-slate-100 focus:outline-none focus:border-emerald-500 text-xs"
                        />
                        <span className="text-[10px] text-slate-400">°C</span>
                      </div>
                    ) : hop.use === 'DryHop' ? (
                      <div className="flex items-center justify-end gap-1.5">
                        <span className="text-[10px] text-slate-400">Day</span>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          aria-label="Dry hop day offset"
                          data-testid={`hop-dry-offset-${hop.id}`}
                          value={hop.dryHopDayOffset ?? 0}
                          onChange={(e) => handleDryHopOffsetChange(hop.id, parseInt(e.target.value, 10) || 0)}
                          className="w-12 text-right bg-slate-800 border border-slate-700 rounded px-1.5 py-1 text-slate-100 focus:outline-none focus:border-emerald-500 text-xs"
                        />
                        <span className="text-[10px] text-slate-400">+</span>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          aria-label="Dry hop duration days"
                          data-testid={`hop-dry-duration-${hop.id}`}
                          value={
                            hop.dryHopDurationDays ??
                            (hop.timeMinutes ? Math.round(hop.timeMinutes / 1440) : 3)
                          }
                          onChange={(e) => handleDryHopDurationChange(hop.id, parseFloat(e.target.value) || 0)}
                          className="w-12 text-right bg-slate-800 border border-slate-700 rounded px-1.5 py-1 text-slate-100 focus:outline-none focus:border-emerald-500 text-xs"
                        />
                        <span className="text-[10px] text-slate-400">d</span>
                      </div>
                    ) : (
                      <div className="text-right text-xs text-slate-500">—</div>
                    )}
                  </td>

                  <td className="py-2.5 px-3 text-right">
                    <input
                      type="number"
                      aria-label={`${hop.name} amount (g)`}
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
                      aria-label={`${hop.name} alpha acid %`}
                      step="0.1"
                      min="0"
                      value={hop.alphaAcidPct}
                      onChange={(e) => handleAlphaChange(hop.id, parseFloat(e.target.value) || 0)}
                      className="w-16 text-right bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-100 focus:outline-none focus:border-emerald-500 text-xs"
                    />
                  </td>
                  <td className="py-2.5 px-3 text-right text-xs text-emerald-400 font-bold" data-testid={`hop-ibu-${hop.id}`}>
                    {itemIbu.toFixed(1)} IBU
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <button
                      type="button"
                      onClick={() => handleRemove(hop.id)}
                      className="text-slate-500 hover:text-rose-400 p-2 transition-colors cursor-pointer"
                      title="Remove hop"
                      aria-label={`Remove ${hop.name}`}
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
          disabled={!!catalogError}
          className="flex-1 min-w-[180px] bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <option value="">-- Select Hop Variety --</option>
          {catalog.hops.map((cat) => (
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
          <option value="FirstWort">First Wort</option>
          <option value="Aroma">Aroma</option>
        </select>

        {useInput === 'DryHop' ? (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-400">Day</span>
            <input
              type="number"
              min="0"
              placeholder="0"
              value={dryHopOffsetInput}
              onChange={(e) => setDryHopOffsetInput(e.target.value)}
              className="w-12 bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-500 text-right"
            />
            <span className="text-xs text-slate-400">+</span>
            <input
              type="number"
              min="1"
              placeholder="3"
              value={dryHopDurationInput}
              onChange={(e) => setDryHopDurationInput(e.target.value)}
              className="w-12 bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-500 text-right"
            />
            <span className="text-xs text-slate-400">days</span>
          </div>
        ) : useInput === 'Whirlpool' || useInput === 'Aroma' ? (
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min="0"
              placeholder="20"
              value={timeInput}
              onChange={(e) => setTimeInput(e.target.value)}
              className="w-12 bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-500 text-right"
            />
            <span className="text-xs text-slate-400">min @</span>
            <input
              type="number"
              step="1"
              value={whirlpoolTempInput}
              onChange={(e) => setWhirlpoolTempInput(e.target.value)}
              className="w-14 bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-500 text-right"
            />
            <span className="text-xs text-slate-400">°C</span>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <input
              type="number"
              min="0"
              value={timeInput}
              onChange={(e) => setTimeInput(e.target.value)}
              className="w-14 bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-500 text-right"
            />
            <span className="text-xs text-slate-400">min</span>
          </div>
        )}

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
          disabled={!selectedCatalogId || !!catalogError}
          className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold px-3 py-2 rounded flex items-center gap-1 transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Add Hop
        </button>
        {catalogError && (
          <span className="text-xs text-rose-400 italic">Catalog unavailable — you can still edit amounts above.</span>
        )}
      </div>
    </div>
  );
};
