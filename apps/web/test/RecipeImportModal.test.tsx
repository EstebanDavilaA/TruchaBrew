import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import type { RecipeWriteInput, EquipmentProfile } from '@truchabrew/shared-types';
import { RecipeImportModal } from '../src/components/RecipeImportModal';
import * as client from '../src/api/client';
import * as designSystem from '../src/components/designSystem';

const SOURCE = fs.readFileSync(path.resolve(__dirname, '../src/components/RecipeImportModal.tsx'), 'utf-8');

vi.mock('../src/api/client', () => ({
  createRecipe: vi.fn(),
  updateRecipe: vi.fn(),
}));

const mockEquipmentProfiles: EquipmentProfile[] = [
  {
    id: 'eq-braumeister-20',
    name: 'Braumeister 20L',
    batchSizeL: 20.0,
    boilTimeMin: 60,
    brewhouseEfficiencyPct: 75.0,
    mashEfficiencyPct: 82.0,
    boilOffRateLPerHour: 3.0,
    trubChillerLossL: 2.0,
    hopUtilizationPct: 100,
    derivedFromEquipmentId: null,
    mashWaterRatioLPerKg: 3.0,
    grainAbsorptionLPerKg: 0.96,
    hopstandUtilizationFactor: 0.5,
    hopstandTemperatureC: 85,
    spargeTemperatureC: 76,
    mashTunHeatCapacityL: 0,
    grainTemperatureC: 20,
    notes: '',
  },
  {
    id: 'eq-grainfather-30',
    name: 'Grainfather G30',
    batchSizeL: 23.0,
    boilTimeMin: 60,
    brewhouseEfficiencyPct: 78.0,
    mashEfficiencyPct: 85.0,
    boilOffRateLPerHour: 3.0,
    trubChillerLossL: 2.0,
    hopUtilizationPct: 100,
    derivedFromEquipmentId: null,
    mashWaterRatioLPerKg: 3.0,
    grainAbsorptionLPerKg: 0.96,
    hopstandUtilizationFactor: 0.5,
    hopstandTemperatureC: 85,
    spargeTemperatureC: 76,
    mashTunHeatCapacityL: 0,
    grainTemperatureC: 20,
    notes: '',
  },
];

const mockParsedRecipes: RecipeWriteInput[] = [
  {
    name: 'Sierra Nevada Celebration Clone',
    author: 'Ken Grossman',
    styleName: 'American IPA',
    notes: 'Fresh hop celebration ale',
    equipmentId: 'eq-braumeister-20',
    mashProfileId: null,
    fermentationProfileId: null,
    waterSourceId: null,
    waterTargetId: null,
    fermentables: [
      { name: 'Pale 2-Row', type: 'Grain', amountKg: 5.5, colorSrm: 3.5, potentialSg: 1.037 },
      { name: 'Caramel 60L', type: 'Grain', amountKg: 0.5, colorSrm: 60.0, potentialSg: 1.034 },
    ],
    hops: [
      { name: 'Centennial', alphaAcidPct: 10.0, amountG: 30, use: 'Boil', boilMins: 60, whirlpoolMins: null, whirlpoolTempC: null, type: 'Pellet' },
      { name: 'Cascade', alphaAcidPct: 6.0, amountG: 50, use: 'DryHop', boilMins: null, whirlpoolMins: null, whirlpoolTempC: null, timeMinutes: 4320, type: 'Pellet' },
    ],
    yeasts: [
      { name: 'California Ale', laboratory: 'White Labs', type: 'Ale', form: 'Liquid', attenuationPct: 78.0, amountPkg: 1 },
    ],
    miscs: [
      { name: 'Whirlfloc', type: 'Fining', use: 'Boil', timeMinutes: 10, amount: 1, unit: 'each' },
    ],
  },
  {
    name: 'Pliny the Elder Clone',
    author: 'Vinnie Cilurzo',
    styleName: 'Double IPA',
    notes: 'Classic West Coast DIPA',
    equipmentId: 'eq-braumeister-20',
    mashProfileId: null,
    fermentationProfileId: null,
    waterSourceId: null,
    waterTargetId: null,
    fermentables: [
      { name: 'Pilsner Malt', type: 'Grain', amountKg: 7.0, colorSrm: 2.0, potentialSg: 1.037 },
    ],
    hops: [
      { name: 'Simcoe', alphaAcidPct: 13.0, amountG: 50, use: 'Boil', boilMins: 60, whirlpoolMins: null, whirlpoolTempC: null, type: 'Pellet' },
    ],
    yeasts: [
      { name: 'SafAle US-05', laboratory: 'Fermentis', type: 'Ale', form: 'Dry', attenuationPct: 81.0, amountPkg: 1 },
    ],
    miscs: [],
  },
];

describe('RecipeImportModal (M22_P1 AC-4..AC-8)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('AC-4: renders pre-flight preview modal with parsed vitals and ingredient counts', () => {
    render(
      <RecipeImportModal
        isOpen={true}
        onClose={vi.fn()}
        parsedRecipes={mockParsedRecipes}
        existingRecipes={[]}
        equipmentProfiles={mockEquipmentProfiles}
        defaultEquipmentId="eq-braumeister-20"
        onImportComplete={vi.fn()}
      />
    );

    expect(screen.getByTestId('recipe-import-modal')).toBeInTheDocument();
    expect(screen.getByText('Sierra Nevada Celebration Clone')).toBeInTheDocument();
    expect(screen.getByText('Pliny the Elder Clone')).toBeInTheDocument();
    expect(screen.getByText('American IPA')).toBeInTheDocument();
    expect(screen.getByText('Double IPA')).toBeInTheDocument();
    expect(screen.getByText('2G · 2H · 1Y')).toBeInTheDocument();
  });

  it('AC-5: allows toggling individual recipe selection and Select/Deselect All', () => {
    render(
      <RecipeImportModal
        isOpen={true}
        onClose={vi.fn()}
        parsedRecipes={mockParsedRecipes}
        existingRecipes={[]}
        equipmentProfiles={mockEquipmentProfiles}
        defaultEquipmentId="eq-braumeister-20"
        onImportComplete={vi.fn()}
      />
    );

    const importBtn = screen.getByTestId('confirm-import-btn');
    expect(importBtn).toHaveTextContent('Import Selected (2)');

    // Deselect first recipe
    const checkbox1 = screen.getByLabelText('Select Sierra Nevada Celebration Clone');
    fireEvent.click(checkbox1);
    expect(importBtn).toHaveTextContent('Import Selected (1)');

    // Deselect All toggle
    const toggleAllBtn = screen.getByText('Select All');
    fireEvent.click(toggleAllBtn);
    expect(importBtn).toHaveTextContent('Import Selected (2)');
  });

  it('AC-6: assigns selected target Equipment Profile to imported recipes', async () => {
    const onImportComplete = vi.fn();
    vi.mocked(client.createRecipe).mockResolvedValue({ id: 'rec-new-1', name: 'Test' } as any);

    render(
      <RecipeImportModal
        isOpen={true}
        onClose={vi.fn()}
        parsedRecipes={[mockParsedRecipes[0]]}
        existingRecipes={[]}
        equipmentProfiles={mockEquipmentProfiles}
        defaultEquipmentId="eq-braumeister-20"
        onImportComplete={onImportComplete}
      />
    );

    // Switch equipment to Grainfather G30
    const eqSelect = screen.getByLabelText('Target Equipment Profile');
    fireEvent.change(eqSelect, { target: { value: 'eq-grainfather-30' } });

    // Click Import
    fireEvent.click(screen.getByTestId('confirm-import-btn'));

    await waitFor(() => {
      expect(client.createRecipe).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Sierra Nevada Celebration Clone',
          equipmentId: 'eq-grainfather-30',
        })
      );
      expect(onImportComplete).toHaveBeenCalledWith(1);
    });
  });

  it('AC-7: detects duplicate recipe by name and supports copy/overwrite/skip strategies', async () => {
    const onImportComplete = vi.fn();
    const existing = [
      { id: 'rec-existing-1', name: 'Sierra Nevada Celebration Clone' },
    ];

    render(
      <RecipeImportModal
        isOpen={true}
        onClose={vi.fn()}
        parsedRecipes={[mockParsedRecipes[0]]}
        existingRecipes={existing}
        equipmentProfiles={mockEquipmentProfiles}
        defaultEquipmentId="eq-braumeister-20"
        onImportComplete={onImportComplete}
      />
    );

    expect(screen.getByText('Duplicate Detected')).toBeInTheDocument();
    expect(screen.getByText('Collision Action:')).toBeInTheDocument();

    // 1. Overwrite strategy
    const overwriteRadio = screen.getByLabelText('Overwrite Existing');
    fireEvent.click(overwriteRadio);

    vi.mocked(client.updateRecipe).mockResolvedValue({ id: 'rec-existing-1', name: 'Sierra Nevada Celebration Clone' } as any);

    fireEvent.click(screen.getByTestId('confirm-import-btn'));

    await waitFor(() => {
      expect(client.updateRecipe).toHaveBeenCalledWith(
        'rec-existing-1',
        expect.objectContaining({
          name: 'Sierra Nevada Celebration Clone',
        })
      );
      expect(onImportComplete).toHaveBeenCalledWith(1);
    });
  });
});

describe('AC-1: RecipeImportModal dialog semantics (M23_P1)', () => {
  it('exposes exactly one dialog with aria-modal and a labelledby pointing at its own title', () => {
    render(
      <RecipeImportModal
        isOpen={true}
        onClose={vi.fn()}
        parsedRecipes={mockParsedRecipes}
        existingRecipes={[]}
        equipmentProfiles={mockEquipmentProfiles}
        defaultEquipmentId="eq-braumeister-20"
        onImportComplete={vi.fn()}
      />
    );

    const dialogs = screen.getAllByRole('dialog');
    expect(dialogs).toHaveLength(1);
    const dialog = dialogs[0];
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleName('Import External Recipes');

    const labelledBy = dialog.getAttribute('aria-labelledby');
    expect(labelledBy).toBeTruthy();
    const titleEl = document.getElementById(labelledBy!);
    expect(titleEl).toBe(screen.getByText('Import External Recipes'));
  });
});

describe('AC-3: closed RecipeImportModal exposes no dialog', () => {
  it('queryAllByRole("dialog") is empty when isOpen is false', () => {
    render(
      <RecipeImportModal
        isOpen={false}
        onClose={vi.fn()}
        parsedRecipes={mockParsedRecipes}
        existingRecipes={[]}
        equipmentProfiles={mockEquipmentProfiles}
        defaultEquipmentId="eq-braumeister-20"
        onImportComplete={vi.fn()}
      />
    );
    expect(screen.queryAllByRole('dialog')).toHaveLength(0);
  });
});

describe('AC-5: primary button on the app-standard amber-600 palette (M23_P1, M34_P2 adoption reconcile)', () => {
  // M24_P1 RA-9 moved the token import from local to designSystem; M34_P2
  // migrated the primary button onto <Button variant="primary"> from ./ui.
  // The invariant (amber-600 palette, not amber-500/slate-950) now lives in
  // designSystem's BUTTON_PRIMARY_CLASS, which <Button variant="primary">
  // applies. Assert the primitive renders the token and the file adopts it.
  it('renders <Button variant="primary"> and designSystem.BUTTON_PRIMARY_CLASS carries the app-standard amber-600 triplet with zero amber-500/slate-950', () => {
    expect(SOURCE).toMatch(/import\s*\{[^}]*\bButton\b[^}]*\}\s*from\s*['"]\.\/ui['"]/);
    expect(SOURCE).toMatch(/<Button[^>]*variant="primary"/);
    expect(designSystem.BUTTON_PRIMARY_CLASS).not.toContain('bg-amber-500 hover:bg-amber-400');
    expect(designSystem.BUTTON_PRIMARY_CLASS).not.toContain('text-slate-950');
    expect(designSystem.BUTTON_PRIMARY_CLASS).toContain('bg-amber-600 hover:bg-amber-500 text-white');
  });
});

describe('AC-6: zero red-* classes remain (M23_P1)', () => {
  it('matches zero occurrences of bg-red-/border-red-/text-red-, and rose replacements are present', () => {
    expect(SOURCE).not.toMatch(/\bbg-red-|\bborder-red-|\btext-red-/);
    expect(SOURCE).toContain('bg-rose-950/80');
    expect(SOURCE).toContain('border-rose-800');
    expect(SOURCE).toContain('text-rose-300');
  });
});

describe('AC-7: form-control backgrounds on standard (RA-3, M23_P1, M34_P2 adoption reconcile)', () => {
  // M24_P1 RA-9: the local FORM_SELECT_CLASS const was replaced by the shared
  // FORM_SELECT_COMPACT_CLASS import; M34_P2 further migrated the equipment
  // <select> onto <Select size="sm"> from ./ui, which applies
  // FORM_SELECT_COMPACT_CLASS. Reasserted as an adoption assertion plus the
  // now-authoritative token value.
  it('renders <Select size="sm"> and designSystem.FORM_SELECT_COMPACT_CLASS declares bg-slate-800', () => {
    expect(SOURCE).toMatch(/import\s*\{[^}]*\bSelect\b[^}]*\}\s*from\s*['"]\.\/ui['"]/);
    expect(SOURCE).toMatch(/<Select[^>]*size="sm"/);
    expect(designSystem.FORM_SELECT_COMPACT_CLASS).toContain('bg-slate-800');
    expect(designSystem.FORM_SELECT_COMPACT_CLASS).not.toContain('bg-slate-950');
  });
});
