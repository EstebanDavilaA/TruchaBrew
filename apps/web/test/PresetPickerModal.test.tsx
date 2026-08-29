import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { CatalogResponse } from '@truchabrew/shared-types';
import { PresetPickerModal } from '../src/components/PresetPickerModal';

const TEST_CATALOG: CatalogResponse = {
  fermentables: [
    { id: 'cat-f-1', name: 'Pale Ale Malt', type: 'Grain', colorSrm: 3.5, potentialSg: 1.038 },
    { id: 'cat-f-2', name: 'Munich Malt', type: 'Grain', colorSrm: 10.0, potentialSg: 1.035 },
  ],
  hops: [
    { id: 'cat-h-1', name: 'Citra', alphaAcidPct: 12.5, type: 'Pellet' },
    { id: 'cat-h-2', name: 'Mosaic', alphaAcidPct: 11.8, type: 'Pellet' },
    { id: 'cat-h-3', name: 'Cascade', alphaAcidPct: 6.5, type: 'Pellet' },
  ],
  yeasts: [{ id: 'cat-y-1', name: 'US-05 SafAle American', laboratory: 'Fermentis', type: 'Ale', form: 'Dry', attenuationPct: 78 }],
  miscs: [{ id: 'cat-m-1', name: 'Gypsum', type: 'WaterAgent', defaultUse: 'Mash', defaultUnit: 'g' }],
};

vi.mock('../src/context/CatalogContext', () => ({
  useCatalog: () => ({
    catalog: TEST_CATALOG,
    loading: false,
    error: null,
    reload: vi.fn(),
  }),
}));

describe('PresetPickerModal (M12_P1, spec §3.2)', () => {
  it('renders nothing when isOpen is false', () => {
    render(
      <PresetPickerModal category="Hop" isOpen={false} onClose={vi.fn()} onSelectPreset={vi.fn()} onSelectCustom={vi.fn()} />,
    );
    expect(screen.queryByTestId('preset-picker-modal')).not.toBeInTheDocument();
  });

  it('header shows category-specific title and search input', () => {
    render(<PresetPickerModal category="Hop" isOpen onClose={vi.fn()} onSelectPreset={vi.fn()} onSelectCustom={vi.fn()} />);
    expect(screen.getByText('Select Hop')).toBeInTheDocument();
    expect(screen.getByTestId('preset-picker-search')).toBeInTheDocument();
  });

  it('renders one clickable row per preset for the given category, with vitals', () => {
    render(<PresetPickerModal category="Hop" isOpen onClose={vi.fn()} onSelectPreset={vi.fn()} onSelectCustom={vi.fn()} />);

    expect(screen.getByTestId('preset-item-cat-h-1')).toBeInTheDocument();
    expect(screen.getByTestId('preset-item-cat-h-2')).toBeInTheDocument();
    expect(screen.getByTestId('preset-item-cat-h-3')).toBeInTheDocument();
    expect(screen.getByTestId('preset-item-cat-h-1')).toHaveTextContent('Alpha Acid: 12.5% • Form: Pellet');
  });

  it('AC-6: typing "citra" in the hop picker filters results to Citra preset only', () => {
    render(<PresetPickerModal category="Hop" isOpen onClose={vi.fn()} onSelectPreset={vi.fn()} onSelectCustom={vi.fn()} />);

    fireEvent.change(screen.getByTestId('preset-picker-search'), { target: { value: 'citra' } });

    expect(screen.getByTestId('preset-item-cat-h-1')).toBeInTheDocument();
    expect(screen.queryByTestId('preset-item-cat-h-2')).not.toBeInTheDocument();
    expect(screen.queryByTestId('preset-item-cat-h-3')).not.toBeInTheDocument();
  });

  it('search is case-insensitive and also matches yeast lab / hop-type-like fields', () => {
    render(<PresetPickerModal category="Yeast" isOpen onClose={vi.fn()} onSelectPreset={vi.fn()} onSelectCustom={vi.fn()} />);

    fireEvent.change(screen.getByTestId('preset-picker-search'), { target: { value: 'FERMENTIS' } });
    expect(screen.getByTestId('preset-item-cat-y-1')).toBeInTheDocument();

    fireEvent.change(screen.getByTestId('preset-picker-search'), { target: { value: 'nonexistent' } });
    expect(screen.queryByTestId('preset-item-cat-y-1')).not.toBeInTheDocument();
    expect(screen.getByText('No presets match your search.')).toBeInTheDocument();
  });

  it('clicking a preset row calls onSelectPreset with its name, category, and preset vitals (M12_P1 Amendment 1 §7.3.1)', () => {
    const onSelectPreset = vi.fn();
    render(<PresetPickerModal category="Hop" isOpen onClose={vi.fn()} onSelectPreset={onSelectPreset} onSelectCustom={vi.fn()} />);

    fireEvent.click(screen.getByTestId('preset-item-cat-h-1'));
    expect(onSelectPreset).toHaveBeenCalledWith('Citra', 'Hop', { category: 'Hop', alphaAcidPct: 12.5, hopType: 'Pellet' });
  });

  it('presetDetails maps Fermentable, Yeast, and Misc presets per spec §7.3.1', () => {
    const onSelectPresetFermentable = vi.fn();
    const { unmount: unmountFermentable } = render(
      <PresetPickerModal category="Fermentable" isOpen onClose={vi.fn()} onSelectPreset={onSelectPresetFermentable} onSelectCustom={vi.fn()} />,
    );
    fireEvent.click(screen.getByTestId('preset-item-cat-f-1'));
    expect(onSelectPresetFermentable).toHaveBeenCalledWith('Pale Ale Malt', 'Fermentable', {
      category: 'Fermentable',
      potentialSg: 1.038,
      colorSrm: 3.5,
      grainType: 'Grain',
    });
    unmountFermentable();

    const onSelectPresetYeast = vi.fn();
    const { unmount: unmountYeast } = render(<PresetPickerModal category="Yeast" isOpen onClose={vi.fn()} onSelectPreset={onSelectPresetYeast} onSelectCustom={vi.fn()} />);
    fireEvent.click(screen.getByTestId('preset-item-cat-y-1'));
    expect(onSelectPresetYeast).toHaveBeenCalledWith('US-05 SafAle American', 'Yeast', {
      category: 'Yeast',
      laboratory: 'Fermentis',
      attenuationPct: 78,
      yeastType: 'Ale',
      form: 'Dry',
    });
    unmountYeast();

    const onSelectPresetMisc = vi.fn();
    render(<PresetPickerModal category="Misc" isOpen onClose={vi.fn()} onSelectPreset={onSelectPresetMisc} onSelectCustom={vi.fn()} />);
    fireEvent.click(screen.getByTestId('preset-item-cat-m-1'));
    expect(onSelectPresetMisc).toHaveBeenCalledWith('Gypsum', 'Misc', { category: 'Misc', miscType: 'WaterAgent', defaultUse: 'Mash', defaultUnit: 'g' });
  });

  it('AC-8: clicking "+ Add Custom Item" dispatches onSelectCustom with category context', () => {
    const onSelectCustom = vi.fn();
    render(<PresetPickerModal category="Misc" isOpen onClose={vi.fn()} onSelectPreset={vi.fn()} onSelectCustom={onSelectCustom} />);

    const btn = screen.getByTestId('preset-add-custom-btn');
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);
    expect(onSelectCustom).toHaveBeenCalledWith('Misc');
  });

  it('clicking Close calls onClose', () => {
    const onClose = vi.fn();
    render(<PresetPickerModal category="Fermentable" isOpen onClose={onClose} onSelectPreset={vi.fn()} onSelectCustom={vi.fn()} />);

    fireEvent.click(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('renders Fermentable-specific vitals', () => {
    render(<PresetPickerModal category="Fermentable" isOpen onClose={vi.fn()} onSelectPreset={vi.fn()} onSelectCustom={vi.fn()} />);
    expect(screen.getByTestId('preset-item-cat-f-1')).toHaveTextContent('Potential: 1.038 SG • Color: 3.5 SRM • Type: Grain');
  });

  it('renders Yeast-specific vitals', () => {
    render(<PresetPickerModal category="Yeast" isOpen onClose={vi.fn()} onSelectPreset={vi.fn()} onSelectCustom={vi.fn()} />);
    expect(screen.getByTestId('preset-item-cat-y-1')).toHaveTextContent('Lab: Fermentis • Type: Ale • Attenuation: 78%');
  });

  it('renders Misc-specific vitals', () => {
    render(<PresetPickerModal category="Misc" isOpen onClose={vi.fn()} onSelectPreset={vi.fn()} onSelectCustom={vi.fn()} />);
    expect(screen.getByTestId('preset-item-cat-m-1')).toHaveTextContent('Type: WaterAgent • Default: Mash (g)');
  });

  it('AC-4..AC-6: close button, search input, and add custom button render through primitives', () => {
    render(<PresetPickerModal category="Fermentable" isOpen onClose={vi.fn()} onSelectPreset={vi.fn()} onSelectCustom={vi.fn()} />);
    const closeBtn = screen.getByLabelText('Close');
    expect(closeBtn).toHaveClass('inline-flex', 'items-center', 'justify-center');

    const searchInput = screen.getByTestId('preset-picker-search');
    expect(searchInput).toHaveClass('bg-slate-800', 'text-slate-100');

    const addBtn = screen.getByTestId('preset-add-custom-btn');
    expect(addBtn).toHaveClass('inline-flex', 'items-center', 'justify-center', 'gap-1.5', 'border-dashed');
  });
});
