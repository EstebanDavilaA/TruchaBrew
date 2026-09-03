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
import { Button, NumberInput, Select, Table, TableHeaderCell, TableCell, SectionCard } from './ui';
import { PresetPickerModal } from './PresetPickerModal';

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
  /** Optional stable anchor id (jump-nav target). Defaults to 'recipe-hops'. */
  sectionId?: string;
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
  sectionId,
}) => {
  const { error: catalogError } = useCatalog();
  const { config } = useConfig();
  const [isPickerOpen, setIsPickerOpen] = useState(false);

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
    <SectionCard
      id={sectionId ?? 'recipe-hops'}
      title="Hops & Contextual Hop Schedule"
      headingLevel={3}
      icon={<Sprout className="w-5 h-5 text-emerald-500" />}
      badge={
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
      }
      collapsible
    >
      {/* Hop Table */}
      <div className="mb-4">
        <Table>
          <thead className="bg-slate-800/80 border-b border-slate-700">
            <tr>
              <TableHeaderCell>Hop Variety</TableHeaderCell>
              <TableHeaderCell>Use</TableHeaderCell>
              <TableHeaderCell>Schedule</TableHeaderCell>
              <TableHeaderCell className="text-right">Amount (g)</TableHeaderCell>
              <TableHeaderCell className="text-right">Alpha Acid %</TableHeaderCell>
              <TableHeaderCell className="text-right">Contribution (IBU)</TableHeaderCell>
              <TableHeaderCell className="text-center">Action</TableHeaderCell>
            </tr>
          </thead>
          <tbody>
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
                  <TableCell variant="text" className="font-medium">
                    <div className="flex items-center justify-between gap-2">
                      {hop.name}
                      <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded border border-slate-700">
                        {hop.type}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell variant="text">
                    <Select
                      value={hop.use}
                      aria-label="Hop use"
                      data-testid={`hop-use-select-${hop.id}`}
                      onChange={(e) => handleUseChange(hop.id, e.target.value as HopUse)}
                      size="sm"
                    >
                      <option value="Boil">Boil</option>
                      <option value="Whirlpool">Whirlpool</option>
                      <option value="DryHop">Dry Hop</option>
                      <option value="FirstWort">First Wort</option>
                      <option value="Aroma">Aroma</option>
                    </Select>
                  </TableCell>

                  {/* Schedule */}
                  <TableCell>
                    {hopUseClass === 'boil' ? (
                      <div className="flex items-center gap-1.5">
                        <NumberInput
                          type="number"
                          size="sm"
                          align="right"
                          width="md"
                          min="0"
                          aria-label="Boil minutes"
                          data-testid={`hop-boil-mins-${hop.id}`}
                          value={hop.boilMins ?? 0}
                          onChange={(e) => handleBoilMinsChange(hop.id, parseInt(e.target.value, 10) || 0)}
                        />
                        <span className="text-xs text-slate-400">min</span>
                      </div>
                    ) : hopUseClass === 'hopstand' ? (
                      <div className="flex items-center gap-1.5">
                        <NumberInput
                          type="number"
                          size="sm"
                          align="right"
                          width="md"
                          min="0"
                          aria-label="Whirlpool minutes"
                          data-testid={`hop-whirlpool-mins-${hop.id}`}
                          value={hop.whirlpoolMins ?? 0}
                          onChange={(e) => handleWhirlpoolMinsChange(hop.id, parseInt(e.target.value, 10) || 0)}
                        />
                        <span className="text-xs text-slate-400">min @</span>
                        <NumberInput
                          type="number"
                          size="sm"
                          align="right"
                          width="sm"
                          step="0.5"
                          aria-label="Whirlpool temp"
                          data-testid={`hop-whirlpool-temp-${hop.id}`}
                          value={hop.whirlpoolTempC ?? hopstandTemperatureC}
                          onChange={(e) => handleWhirlpoolTempChange(hop.id, parseFloat(e.target.value) || 0)}
                        />
                        <span className="text-xs text-slate-400">°C</span>
                      </div>
                    ) : hop.use === 'DryHop' ? (
                      <div className="flex items-center gap-1.5">
                        <NumberInput
                          type="number"
                          size="sm"
                          align="right"
                          width="xs"
                          min="0"
                          step="1"
                          aria-label="Dry hop day offset"
                          data-testid={`hop-dry-offset-${hop.id}`}
                          value={hop.dryHopDayOffset ?? 0}
                          onChange={(e) => handleDryHopOffsetChange(hop.id, parseInt(e.target.value, 10) || 0)}
                        />
                        <span className="text-xs text-slate-400">+</span>
                        <NumberInput
                          type="number"
                          size="sm"
                          align="right"
                          width="xs"
                          min="0"
                          step="1"
                          aria-label="Dry hop duration days"
                          data-testid={`hop-dry-duration-${hop.id}`}
                          value={
                            hop.dryHopDurationDays ??
                            (hop.timeMinutes ? Math.round(hop.timeMinutes / 1440) : 3)
                          }
                          onChange={(e) => handleDryHopDurationChange(hop.id, parseFloat(e.target.value) || 0)}
                        />
                        <span className="text-xs text-slate-400">days</span>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-400 font-mono">—</div>
                    )}
                  </TableCell>

                  <TableCell className="text-right">
                    <NumberInput
                      type="number"
                      size="sm"
                      align="right"
                      width="md"
                      aria-label={`${hop.name} amount (g)`}
                      step="5"
                      min="0"
                      value={hop.amountG}
                      onChange={(e) => handleAmountChange(hop.id, parseFloat(e.target.value) || 0)}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <NumberInput
                      type="number"
                      size="sm"
                      align="right"
                      width="md"
                      aria-label={`${hop.name} alpha acid %`}
                      step="0.1"
                      min="0"
                      value={hop.alphaAcidPct}
                      onChange={(e) => handleAlphaChange(hop.id, parseFloat(e.target.value) || 0)}
                    />
                  </TableCell>
                  <TableCell className="text-right" data-testid={`hop-ibu-${hop.id}`}>
                    <span className="text-emerald-400 font-bold">{itemIbu.toFixed(1)} IBU</span>
                  </TableCell>
                  <TableCell variant="text" className="text-center">
                    <Button
                      variant="icon"
                      type="button"
                      onClick={() => handleRemove(hop.id)}
                      className="text-slate-400 hover:text-rose-400 p-2"
                      title="Remove hop"
                      aria-label={`Remove ${hop.name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </tr>
              );
            })}
            {hops.length === 0 && (
              <tr>
                <TableCell variant="text" colSpan={7} className="text-center italic">
                  No hops added yet. Add hop additions below to calculate bittering & aroma.
                </TableCell>
              </tr>
            )}
          </tbody>
        </Table>
      </div>

      {/* Add Hop Action */}
      <div className="flex items-center justify-end gap-3 mt-2">
        {catalogError && (
          <span className="text-xs text-rose-400 italic">Catalog unavailable.</span>
        )}
        <Button
          variant="secondary"
          size="sm"
          type="button"
          onClick={() => setIsPickerOpen(true)}
          disabled={!!catalogError}
          data-testid="hop-open-picker-btn"
        >
          <Plus className="w-4 h-4" /> Add Hop from Catalog
        </Button>
      </div>

      <PresetPickerModal
        category="Hop"
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        onSelectPreset={(name, _category, details) => {
          const newItem: HopItem = {
            id: 'h-user-' + Date.now(),
            name,
            alphaAcidPct: (details as any).alphaAcidPct ?? 5.0,
            amountG: 25,
            use: 'Boil',
            boilMins: 60,
            whirlpoolMins: null,
            whirlpoolTempC: null,
            dryHopDayOffset: null,
            dryHopDurationDays: null,
            timeMinutes: 60,
            type: (details as any).hopType ?? 'Pellet',
          };
          onUpdate([...hops, newItem]);
          setIsPickerOpen(false);
        }}
        onSelectCustom={() => {
          const newItem: HopItem = {
            id: 'h-user-' + Date.now(),
            name: 'Custom Hop',
            alphaAcidPct: 5.0,
            amountG: 25,
            use: 'Boil',
            boilMins: 60,
            whirlpoolMins: null,
            whirlpoolTempC: null,
            dryHopDayOffset: null,
            dryHopDurationDays: null,
            timeMinutes: 60,
            type: 'Pellet',
          };
          onUpdate([...hops, newItem]);
          setIsPickerOpen(false);
        }}
      />
    </SectionCard>
  );
};
