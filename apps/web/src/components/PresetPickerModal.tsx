import React, { useMemo, useState } from 'react';
import type { InventoryCategory, InventoryCustomDetails } from '@truchabrew/shared-types';
import type { CatalogFermentable, CatalogHop, CatalogYeast, CatalogMisc } from '@truchabrew/shared-types';
import { useCatalog } from '../context/CatalogContext';
import { Wheat, Flower2, FlaskConical, Sparkles, X, Plus } from 'lucide-react';
import { ListRow, LIST_CONTAINER_CLASS } from './ListRow';
import { Modal } from './Modal';
import { Button, Input } from './ui';

export interface PresetPickerModalProps {
  category: InventoryCategory;
  isOpen: boolean;
  onClose: () => void;
  // `presetDetails` (M12_P1 Amendment 1, spec §7.3.1) carries the preset's
  // category-specific vitals so InventoryForm's "Category Details" card
  // pre-fills — see presetDetailsFor below for the exact per-category mapping.
  onSelectPreset: (presetName: string, category: InventoryCategory, presetDetails: InventoryCustomDetails) => void;
  onSelectCustom: (category: InventoryCategory) => void;
}

const CATEGORY_TITLE: Record<InventoryCategory, string> = {
  Fermentable: 'Select Fermentable',
  Hop: 'Select Hop',
  Yeast: 'Select Yeast',
  Misc: 'Select Misc',
};

const CATEGORY_ICON: Record<InventoryCategory, React.ComponentType<{ className?: string }>> = {
  Fermentable: Wheat,
  Hop: Flower2,
  Yeast: FlaskConical,
  Misc: Sparkles,
};

type Preset = CatalogFermentable | CatalogHop | CatalogYeast | CatalogMisc;

/** Case-insensitive substring match against name, and (when present) lab or type. */
function matchesQuery(preset: Preset, query: string): boolean {
  if (query === '') return true;
  const q = query.toLowerCase();
  if (preset.name.toLowerCase().includes(q)) return true;
  if ('laboratory' in preset && preset.laboratory.toLowerCase().includes(q)) return true;
  if ('type' in preset && String(preset.type).toLowerCase().includes(q)) return true;
  return false;
}

function vitalsFor(category: InventoryCategory, preset: Preset): string {
  switch (category) {
    case 'Fermentable': {
      const f = preset as CatalogFermentable;
      return `Potential: ${f.potentialSg} SG • Color: ${f.colorSrm} SRM • Type: ${f.type}`;
    }
    case 'Hop': {
      const h = preset as CatalogHop;
      return `Alpha Acid: ${h.alphaAcidPct}% • Form: ${h.type}`;
    }
    case 'Yeast': {
      const y = preset as CatalogYeast;
      return `Lab: ${y.laboratory} • Type: ${y.type} • Attenuation: ${y.attenuationPct}%`;
    }
    case 'Misc': {
      const m = preset as CatalogMisc;
      return `Type: ${m.type} • Default: ${m.defaultUse} (${m.defaultUnit})`;
    }
  }
}

/** Maps a selected catalog preset to its InventoryCustomDetails pre-fill (spec §7.3.1). */
function presetDetailsFor(category: InventoryCategory, preset: Preset): InventoryCustomDetails {
  switch (category) {
    case 'Hop': {
      const h = preset as CatalogHop;
      return { category: 'Hop', alphaAcidPct: h.alphaAcidPct, hopType: h.type };
    }
    case 'Fermentable': {
      const f = preset as CatalogFermentable;
      return { category: 'Fermentable', potentialSg: f.potentialSg, colorSrm: f.colorSrm, grainType: f.type };
    }
    case 'Yeast': {
      const y = preset as CatalogYeast;
      return { category: 'Yeast', laboratory: y.laboratory, attenuationPct: y.attenuationPct, yeastType: y.type, form: y.form };
    }
    case 'Misc': {
      const m = preset as CatalogMisc;
      return { category: 'Misc', miscType: m.type, defaultUse: m.defaultUse, defaultUnit: m.defaultUnit } as any;
    }
  }
}

/** Searchable modal picker for selecting a catalog ingredient, or falling back to custom entry (spec §3.2). */
export const PresetPickerModal: React.FC<PresetPickerModalProps> = ({ category, isOpen, onClose, onSelectPreset, onSelectCustom }) => {
  const { catalog } = useCatalog();
  const [query, setQuery] = useState('');

  const presets: Preset[] = useMemo(() => {
    switch (category) {
      case 'Fermentable':
        return catalog.fermentables;
      case 'Hop':
        return catalog.hops;
      case 'Yeast':
        return catalog.yeasts;
      case 'Misc':
        return catalog.miscs;
    }
  }, [category, catalog]);

  const filtered = useMemo(() => presets.filter((p) => matchesQuery(p, query)), [presets, query]);

  const Icon = CATEGORY_ICON[category];

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidthClass="max-w-lg" containerClassName="max-h-[80vh] flex flex-col">
      <div data-testid="preset-picker-modal" className="flex flex-col min-h-0 flex-1">
        <div className="flex items-center justify-between gap-3 p-5 border-b border-slate-800">
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <Icon className="w-4 h-4 text-amber-400" />
            {CATEGORY_TITLE[category]}
          </h2>
          <Button
            variant="icon"
            type="button"
            onClick={onClose}
            aria-label="Close"
            title="Close"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="p-5 pb-3">
          <Input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search..."
            data-testid="preset-picker-search"
          />
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-3">
          {filtered.length === 0 && <div className="text-sm text-slate-400 text-center py-6">No presets match your search.</div>}
          {filtered.length > 0 && (
            <div className={LIST_CONTAINER_CLASS}>
              {filtered.map((preset) => (
                <ListRow
                  key={preset.id}
                  testId={`preset-item-${preset.id}`}
                  label={`Select ${preset.name}`}
                  primary={
                    <span className="flex items-center gap-2">
                      <Icon className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      {preset.name}
                    </span>
                  }
                  meta={vitalsFor(category, preset)}
                  onOpen={() => onSelectPreset(preset.name, category, presetDetailsFor(category, preset))}
                />
              ))}
            </div>
          )}
        </div>

        <div className="p-5 pt-3 border-t border-slate-800">
          <Button
            variant="secondary"
            size="sm"
            type="button"
            onClick={() => onSelectCustom(category)}
            data-testid="preset-add-custom-btn"
            className="w-full border-dashed"
          >
            <Plus className="w-4 h-4" /> Add Custom Item
          </Button>
        </div>
      </div>
    </Modal>
  );
};
