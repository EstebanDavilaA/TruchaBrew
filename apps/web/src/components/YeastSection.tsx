import React, { useState } from 'react';
import type { YeastItem } from '../types/brewing';
import { useCatalog } from '../context/CatalogContext';
import { Plus, Trash2, FlaskConical } from 'lucide-react';
import { Button, NumberInput, Table, TableHeaderCell, TableCell, SectionCard } from './ui';
import { PresetPickerModal } from './PresetPickerModal';

interface YeastSectionProps {
  yeasts: YeastItem[];
  onUpdate: (updated: YeastItem[]) => void;
  /** Optional stable anchor id (jump-nav target). Defaults to 'recipe-yeast'. */
  sectionId?: string;
}

export const YeastSection: React.FC<YeastSectionProps> = ({ yeasts, onUpdate, sectionId }) => {
  const { error: catalogError } = useCatalog();
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  const handleAttenuationChange = (id: string, attenuationPct: number) => {
    onUpdate(yeasts.map((y) => (y.id === id ? { ...y, attenuationPct: Math.max(0, Math.min(100, attenuationPct)) } : y)));
  };

  const handleRemove = (id: string) => {
    onUpdate(yeasts.filter((y) => y.id !== id));
  };

  return (
    <SectionCard
      id={sectionId ?? 'recipe-yeast'}
      title="Yeast Strain & Fermentation"
      headingLevel={3}
      icon={<FlaskConical className="w-5 h-5 text-purple-400" />}
      collapsible
    >
      {/* Yeast Table */}
      <Table>
        <thead className="bg-slate-800/80 border-b border-slate-700">
          <tr>
            <TableHeaderCell>Yeast Name</TableHeaderCell>
            <TableHeaderCell>Laboratory</TableHeaderCell>
            <TableHeaderCell>Type</TableHeaderCell>
            <TableHeaderCell>Form</TableHeaderCell>
            <TableHeaderCell className="text-right">Attenuation %</TableHeaderCell>
            <TableHeaderCell className="text-center">Action</TableHeaderCell>
          </tr>
        </thead>
        <tbody>
          {yeasts.map((yeast) => (
            <tr key={yeast.id} className="hover:bg-slate-800/40 transition-colors">
              <TableCell variant="text" className="font-medium">{yeast.name}</TableCell>
              <TableCell variant="text">{yeast.laboratory}</TableCell>
              <TableCell variant="text">{yeast.type}</TableCell>
              <TableCell variant="text">{yeast.form}</TableCell>
              <TableCell className="text-right">
                <NumberInput
                  type="number"
                  size="sm"
                  align="right"
                  width="md"
                  aria-label={`${yeast.name} attenuation %`}
                  min="50"
                  max="98"
                  value={yeast.attenuationPct}
                  onChange={(e) => handleAttenuationChange(yeast.id, parseInt(e.target.value, 10) || 75)}
                />
              </TableCell>
              <TableCell variant="text" className="text-center">
                <Button
                  variant="icon"
                  type="button"
                  onClick={() => handleRemove(yeast.id)}
                  className="text-slate-400 hover:text-rose-400 p-2"
                  title="Remove yeast"
                  aria-label={`Remove ${yeast.name}`}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </TableCell>
            </tr>
          ))}
          {yeasts.length === 0 && (
            <tr>
              <TableCell variant="text" colSpan={6} className="text-center italic">
                No yeast added yet. Select a yeast strain below.
              </TableCell>
            </tr>
          )}
        </tbody>
      </Table>

      {/* Add Yeast Action */}
      <div className="flex items-center justify-end gap-3 mt-2">
        {catalogError && <span className="text-xs text-rose-400 italic">Catalog unavailable.</span>}
        <Button
          variant="secondary"
          size="sm"
          type="button"
          onClick={() => setIsPickerOpen(true)}
          disabled={!!catalogError}
          data-testid="yeast-open-picker-btn"
        >
          <Plus className="w-4 h-4" /> Select Yeast from Catalog
        </Button>
      </div>

      <PresetPickerModal
        category="Yeast"
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        onSelectPreset={(name, _category, details) => {
          const newItem: YeastItem = {
            id: 'y-user-' + Date.now(),
            name,
            laboratory: (details as any).laboratory ?? '',
            type: (details as any).yeastType ?? 'Ale',
            form: (details as any).form ?? 'Dry',
            attenuationPct: (details as any).attenuationPct ?? 75,
            amountPkg: 1,
          };
          onUpdate([...yeasts, newItem]);
          setIsPickerOpen(false);
        }}
        onSelectCustom={() => {
          const newItem: YeastItem = {
            id: 'y-user-' + Date.now(),
            name: 'Custom Yeast',
            laboratory: '',
            type: 'Ale',
            form: 'Dry',
            attenuationPct: 75,
            amountPkg: 1,
          };
          onUpdate([...yeasts, newItem]);
          setIsPickerOpen(false);
        }}
      />
    </SectionCard>
  );
};
