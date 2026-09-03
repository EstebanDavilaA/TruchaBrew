import React, { useState } from 'react';
import type { FermentableItem } from '../types/brewing';
import { useCatalog } from '../context/CatalogContext';
import { useConfig } from '../context/ConfigContext';
import { formatMass } from '@truchabrew/calculations';
import { Plus, Trash2, Wheat } from 'lucide-react';
import { Button, NumberInput, Table, TableHeaderCell, TableCell, SectionCard } from './ui';
import { PresetPickerModal } from './PresetPickerModal';

interface FermentableSectionProps {
  fermentables: FermentableItem[];
  totalGrainKg: number;
  onUpdate: (updated: FermentableItem[]) => void;
  /** Optional stable anchor id (jump-nav target). Defaults to 'recipe-fermentables'. */
  sectionId?: string;
}

export const FermentableSection: React.FC<FermentableSectionProps> = ({ fermentables, totalGrainKg, onUpdate, sectionId }) => {
  const { error: catalogError } = useCatalog();
  const { config } = useConfig();
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  const handleAmountChange = (id: string, newAmount: number) => {
    const updated = fermentables.map((f) => (f.id === id ? { ...f, amountKg: Math.max(0, newAmount) } : f));
    onUpdate(updated);
  };

  const handleRemove = (id: string) => {
    onUpdate(fermentables.filter((f) => f.id !== id));
  };

  return (
    <SectionCard
      id={sectionId ?? 'recipe-fermentables'}
      title="Fermentables & Malts"
      headingLevel={3}
      icon={<Wheat className="w-5 h-5 text-amber-500" />}
      badge={
        <span className="text-xs text-slate-400">
          Total:{' '}
          <strong className="text-slate-200">{formatMass(totalGrainKg, config.unitSystem)}</strong>
        </span>
      }
      collapsible
    >
      {/* Fermentables Table */}
      <div className="mb-4">
        <Table>
          <thead className="bg-slate-800/80 border-b border-slate-700">
            <tr>
              <TableHeaderCell>Name</TableHeaderCell>
              <TableHeaderCell>Type</TableHeaderCell>
              <TableHeaderCell className="text-right">Amount (kg)</TableHeaderCell>
              <TableHeaderCell className="text-right">% Grain Bill</TableHeaderCell>
              <TableHeaderCell className="text-right">Color (SRM)</TableHeaderCell>
              <TableHeaderCell className="text-right">Potential (SG)</TableHeaderCell>
              <TableHeaderCell className="text-center">Action</TableHeaderCell>
            </tr>
          </thead>
          <tbody>
            {fermentables.map((item) => {
              const pct = totalGrainKg > 0 ? ((item.amountKg / totalGrainKg) * 100).toFixed(1) : '0';
              return (
                <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                  <TableCell variant="text" className="font-medium">{item.name}</TableCell>
                  <TableCell variant="text">{item.type}</TableCell>
                  <TableCell className="text-right">
                    <NumberInput
                      type="number"
                      aria-label={`${item.name} amount (kg)`}
                      step="0.05"
                      min="0"
                      value={item.amountKg}
                      onChange={(e) => handleAmountChange(item.id, parseFloat(e.target.value) || 0)}
                      width="xl"
                      size="sm"
                      align="right"
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="text-amber-400 font-semibold">{pct}%</span>
                  </TableCell>
                  <TableCell className="text-right">{item.colorSrm} SRM</TableCell>
                  <TableCell className="text-right">{item.potentialSg.toFixed(3)}</TableCell>
                  <TableCell variant="text" className="text-center">
                    <Button
                      variant="icon"
                      type="button"
                      onClick={() => handleRemove(item.id)}
                      className="text-slate-400 hover:text-rose-400 p-2"
                      title="Remove fermentable"
                      aria-label={`Remove ${item.name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </tr>
              );
            })}
            {fermentables.length === 0 && (
              <tr>
                <TableCell variant="text" colSpan={7} className="text-center italic">
                  No fermentables added yet. Add malts below to calculate gravity and color.
                </TableCell>
              </tr>
            )}
          </tbody>
        </Table>
      </div>

      {/* Add Ingredient Action */}
      <div className="flex items-center justify-end gap-3 mt-2">
        {catalogError && <span className="text-xs text-rose-400 italic">Catalog unavailable.</span>}
        <Button
          variant="secondary"
          size="sm"
          type="button"
          onClick={() => setIsPickerOpen(true)}
          disabled={!!catalogError}
          data-testid="fermentable-open-picker-btn"
        >
          <Plus className="w-4 h-4" /> Add Fermentable from Catalog
        </Button>
      </div>

      <PresetPickerModal
        category="Fermentable"
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        onSelectPreset={(name, _category, details) => {
          const newItem: FermentableItem = {
            id: 'f-user-' + Date.now(),
            name,
            type: (details as any).grainType ?? 'Grain',
            amountKg: 1.0,
            colorSrm: (details as any).colorSrm ?? 3.0,
            potentialSg: (details as any).potentialSg ?? 1.036,
          };
          onUpdate([...fermentables, newItem]);
          setIsPickerOpen(false);
        }}
        onSelectCustom={() => {
          const newItem: FermentableItem = {
            id: 'f-user-' + Date.now(),
            name: 'Custom Fermentable',
            type: 'Grain',
            amountKg: 1.0,
            colorSrm: 3.0,
            potentialSg: 1.036,
          };
          onUpdate([...fermentables, newItem]);
          setIsPickerOpen(false);
        }}
      />
    </SectionCard>
  );
};
