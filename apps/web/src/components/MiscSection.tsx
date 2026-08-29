import React, { useState } from 'react';
import type { MiscItem, MiscUse } from '@truchabrew/shared-types';
import { useCatalog } from '../context/CatalogContext';
import { Plus, Trash2, Droplet } from 'lucide-react';
import { CARD_CLASS, SECTION_HEADING_CLASS } from './designSystem';
import { Button, NumberInput, Select, Table, TableHeaderCell, TableCell } from './ui';
import { PresetPickerModal } from './PresetPickerModal';

interface MiscSectionProps {
  miscs: MiscItem[];
  onUpdate: (updated: MiscItem[]) => void;
}

export const MiscSection: React.FC<MiscSectionProps> = ({ miscs, onUpdate }) => {
  const { error: catalogError } = useCatalog();
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  const handleAmountChange = (id: string, amount: number) => {
    onUpdate(miscs.map((m) => (m.id === id ? { ...m, amount: Math.max(0, amount) } : m)));
  };

  const handleTimeChange = (id: string, timeMinutes: number) => {
    onUpdate(miscs.map((m) => (m.id === id ? { ...m, timeMinutes: Math.max(0, timeMinutes) } : m)));
  };

  const handleUseChange = (id: string, use: MiscUse) => {
    onUpdate(miscs.map((m) => (m.id === id ? { ...m, use } : m)));
  };

  const handleRemove = (id: string) => {
    onUpdate(miscs.filter((m) => m.id !== id));
  };

  return (
    <div className={CARD_CLASS}>
      <div className="flex items-center justify-between mb-4">
        <h3 className={SECTION_HEADING_CLASS}>
          <Droplet className="w-5 h-5 text-sky-400" /> Misc & Water Agents
        </h3>
        <span className="text-xs text-slate-400 italic">Stored with the recipe — not yet part of the calculated stats</span>
      </div>

      {/* Misc Table */}
      <div className="mb-4">
        <Table>
          <thead className="bg-slate-800/80 border-b border-slate-700">
            <tr>
              <TableHeaderCell>Name</TableHeaderCell>
              <TableHeaderCell>Type</TableHeaderCell>
              <TableHeaderCell>Use</TableHeaderCell>
              <TableHeaderCell className="text-right">Time (min)</TableHeaderCell>
              <TableHeaderCell className="text-right">Amount</TableHeaderCell>
              <TableHeaderCell>Unit</TableHeaderCell>
              <TableHeaderCell className="text-center">Action</TableHeaderCell>
            </tr>
          </thead>
          <tbody>
            {miscs.map((item) => (
              <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                <TableCell variant="text" className="font-medium">{item.name}</TableCell>
                <TableCell variant="text">{item.type}</TableCell>
                <TableCell variant="text">
                  <Select
                    value={item.use}
                    onChange={(e) => handleUseChange(item.id, e.target.value as MiscUse)}
                    aria-label={`Use for ${item.name}`}
                    size="sm"
                  >
                    {(['Mash', 'Boil', 'Whirlpool', 'Primary', 'Secondary', 'Bottling'] as MiscUse[]).map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </Select>
                </TableCell>
                <TableCell className="text-right">
                  <NumberInput
                    type="number"
                    min="0"
                    value={item.timeMinutes}
                    onChange={(e) => handleTimeChange(item.id, parseInt(e.target.value, 10) || 0)}
                    aria-label={`Time in minutes for ${item.name}`}
                    width="md"
                    size="sm"
                    align="right"
                  />
                </TableCell>
                <TableCell className="text-right">
                  <NumberInput
                    type="number"
                    step="0.1"
                    min="0"
                    value={item.amount}
                    onChange={(e) => handleAmountChange(item.id, parseFloat(e.target.value) || 0)}
                    aria-label={`Amount of ${item.name}`}
                    width="md"
                    size="sm"
                    align="right"
                  />
                </TableCell>
                <TableCell variant="text">{item.unit}</TableCell>
                <TableCell variant="text" className="text-center">
                  <Button
                    variant="icon"
                    type="button"
                    onClick={() => handleRemove(item.id)}
                    className="text-slate-400 hover:text-rose-400 p-1"
                    title="Remove misc"
                    aria-label={`Remove ${item.name}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </TableCell>
              </tr>
            ))}
            {miscs.length === 0 && (
              <tr>
                <TableCell variant="text" colSpan={7} className="text-center italic">
                  No misc additions yet. Add finings, spices or water agents below.
                </TableCell>
              </tr>
            )}
          </tbody>
        </Table>
      </div>

      {/* Add Misc Action */}
      <div className="flex items-center justify-end gap-3 mt-2">
        {catalogError && <span className="text-xs text-rose-400 italic">Catalog unavailable.</span>}
        <Button
          variant="secondary"
          size="sm"
          type="button"
          onClick={() => setIsPickerOpen(true)}
          disabled={!!catalogError}
          data-testid="misc-open-picker-btn"
        >
          <Plus className="w-4 h-4" /> Add Misc from Catalog
        </Button>
      </div>

      <PresetPickerModal
        category="Misc"
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        onSelectPreset={(name, _category, details) => {
          const newItem: MiscItem = {
            id: 'm-user-' + Date.now(),
            name,
            type: (details as any).miscType ?? 'Other',
            use: 'Boil',
            timeMinutes: 15,
            amount: 1,
            unit: (details as any).unit ?? (details as any).defaultUnit ?? 'item',
          };
          onUpdate([...miscs, newItem]);
          setIsPickerOpen(false);
        }}
        onSelectCustom={() => {
          const newItem: MiscItem = {
            id: 'm-user-' + Date.now(),
            name: 'Custom Misc',
            type: 'Other',
            use: 'Boil',
            timeMinutes: 15,
            amount: 1,
            unit: 'g',
          };
          onUpdate([...miscs, newItem]);
          setIsPickerOpen(false);
        }}
      />
    </div>
  );
};
