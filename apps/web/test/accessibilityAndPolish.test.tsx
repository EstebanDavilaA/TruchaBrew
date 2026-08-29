import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import { FermentableSection } from '../src/components/FermentableSection';
import { HopSection } from '../src/components/HopSection';
import { YeastSection } from '../src/components/YeastSection';
import { CatalogProvider } from '../src/context/CatalogContext';
import { ConfigProvider } from '../src/context/ConfigContext';
import type { FermentableItem, HopItem, YeastItem, UserConfig } from '@truchabrew/shared-types';
import App from '../src/App';
import { baseEquipment, baseStoredRecipe } from './helpers/fixtures';

// AC-11 (below) mounts the real <App /> to open the scale modal and assert
// on its rendered DOM attributes now that they are emitted dynamically by
// the shared <Modal> wrapper (M25_P1) rather than as literal source text.
vi.mock('../src/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/api/client')>();
  return {
    ...actual,
    getCatalog: vi.fn(),
    listEquipmentProfiles: vi.fn(),
    listMashProfiles: vi.fn(),
    listFermentationProfiles: vi.fn(),
    listRecipes: vi.fn(),
    getRecipe: vi.fn(),
  };
});

import {
  getCatalog,
  listEquipmentProfiles,
  listMashProfiles,
  listFermentationProfiles,
  listRecipes,
  getRecipe,
} from '../src/api/client';

// File-wide default so the AC-6..AC-9 blocks below (which mount the real
// CatalogProvider directly, not <App />) keep resolving getCatalog() to a
// real promise rather than the bare vi.fn() the mock above installs. The
// AC-11 describe further down overrides these with its own fixtures.
beforeEach(() => {
  vi.mocked(getCatalog).mockResolvedValue({ fermentables: [], hops: [], yeasts: [], miscs: [] });
  vi.mocked(listEquipmentProfiles).mockResolvedValue([]);
  vi.mocked(listMashProfiles).mockResolvedValue([]);
  vi.mocked(listFermentationProfiles).mockResolvedValue([]);
  vi.mocked(listRecipes).mockResolvedValue([]);
});

const SAMPLE_FERMENTABLES: FermentableItem[] = [
  {
    id: 'f-1',
    name: 'Pilsner Malt',
    type: 'Grain',
    amountKg: 4.5,
    colorSrm: 1.5,
    potentialSg: 1.037,
  },
];

const SAMPLE_HOPS: HopItem[] = [
  {
    id: 'h-1',
    name: 'Saaz',
    type: 'Pellet',
    use: 'Boil',
    timeMinutes: 60,
    amountG: 50,
    alphaAcidPct: 3.5,
    boilMins: 60,
    whirlpoolMins: null,
    whirlpoolTempC: null,
    dryHopDayOffset: null,
    dryHopDurationDays: null,
  },
];

const SAMPLE_YEASTS: YeastItem[] = [
  {
    id: 'y-1',
    name: 'Saflager W-34/70',
    laboratory: 'Fermentis',
    type: 'Lager',
    form: 'Dry',
    attenuationPct: 83,
    amountPkg: 1,
  },
];

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <ConfigProvider>
      <CatalogProvider>{ui}</CatalogProvider>
    </ConfigProvider>,
  );
}

describe('Milestone 14 Phase 1: Accessibility, Token Consolidation & UI/UX Polish', () => {
  const SRC_DIR = path.resolve(__dirname, '../src');

  describe('AC-1..AC-5: Recipe Editor Token Consolidation', () => {
    const editorFiles = [
      'components/FermentableSection.tsx',
      'components/HopSection.tsx',
      'components/YeastSection.tsx',
      'components/MashSection.tsx',
      'components/MiscSection.tsx',
    ];

    it.each(editorFiles)('%s imports and applies CARD_CLASS and SECTION_HEADING_CLASS', (relPath) => {
      const fullPath = path.resolve(SRC_DIR, relPath);
      const content = fs.readFileSync(fullPath, 'utf-8');

      expect(content).toMatch(/import\s*\{[^}]*CARD_CLASS[^}]*\}\s*from\s*['"]\.\/designSystem['"]/);
      expect(content).toMatch(/import\s*\{[^}]*SECTION_HEADING_CLASS[^}]*\}\s*from\s*['"]\.\/designSystem['"]/);

      // Verify no literal card wrapper string remains
      expect(content).not.toContain('bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg mb-6');
    });
  });

  describe('AC-6: Table Column Scope', () => {
    it('FermentableSection sets scope="col" on all <th> elements', () => {
      renderWithProviders(
        <FermentableSection
          fermentables={SAMPLE_FERMENTABLES}
          totalGrainKg={4.5}
          onUpdate={vi.fn()}
        />,
      );

      const headers = screen.getAllByRole('columnheader');
      expect(headers.length).toBe(7);
      headers.forEach((th) => {
        expect(th.getAttribute('scope')).toBe('col');
      });
    });

    it('HopSection sets scope="col" on all <th> elements', () => {
      renderWithProviders(
        <HopSection
          hops={SAMPLE_HOPS}
          wortGravity={1.050}
          batchSizeL={20}
          hopUtilizationPct={100}
          hopstandUtilizationFactor={0.5}
          hopstandTemperatureC={80}
          totalHopG={50}
          totalIbu={25}
          onUpdate={vi.fn()}
        />,
      );

      const headers = screen.getAllByRole('columnheader');
      expect(headers.length).toBe(7);
      headers.forEach((th) => {
        expect(th.getAttribute('scope')).toBe('col');
      });
    });

    it('YeastSection sets scope="col" on all <th> elements', () => {
      renderWithProviders(
        <YeastSection
          yeasts={SAMPLE_YEASTS}
          onUpdate={vi.fn()}
        />,
      );

      const headers = screen.getAllByRole('columnheader');
      expect(headers.length).toBe(6);
      headers.forEach((th) => {
        expect(th.getAttribute('scope')).toBe('col');
      });
    });
  });

  describe('AC-7..AC-9: Accessible Table Inputs & Remove Actions', () => {
    it('AC-7: Fermentable amount input and remove button have accessible names and padding', () => {
      renderWithProviders(
        <FermentableSection
          fermentables={SAMPLE_FERMENTABLES}
          totalGrainKg={4.5}
          onUpdate={vi.fn()}
        />,
      );

      const amountInput = screen.getByLabelText('Pilsner Malt amount (kg)');
      expect(amountInput).toBeDefined();
      expect(amountInput.getAttribute('type')).toBe('number');

      const removeBtn = screen.getByLabelText('Remove Pilsner Malt');
      expect(removeBtn).toBeDefined();
      expect(removeBtn.className).toContain('p-2');
    });

    it('AC-8: Hop amount, alpha acid inputs, and remove button have accessible names and padding', () => {
      renderWithProviders(
        <HopSection
          hops={SAMPLE_HOPS}
          wortGravity={1.050}
          batchSizeL={20}
          hopUtilizationPct={100}
          hopstandUtilizationFactor={0.5}
          hopstandTemperatureC={80}
          totalHopG={50}
          totalIbu={25}
          onUpdate={vi.fn()}
        />,
      );

      const amountInput = screen.getByLabelText('Saaz amount (g)');
      expect(amountInput).toBeDefined();

      const alphaInput = screen.getByLabelText('Saaz alpha acid %');
      expect(alphaInput).toBeDefined();

      const removeBtn = screen.getByLabelText('Remove Saaz');
      expect(removeBtn).toBeDefined();
      expect(removeBtn.className).toContain('p-2');
    });

    it('AC-9: Yeast attenuation input and remove button have accessible names and padding', () => {
      renderWithProviders(
        <YeastSection
          yeasts={SAMPLE_YEASTS}
          onUpdate={vi.fn()}
        />,
      );

      const attInput = screen.getByLabelText('Saflager W-34/70 attenuation %');
      expect(attInput).toBeDefined();

      const removeBtn = screen.getByLabelText('Remove Saflager W-34/70');
      expect(removeBtn).toBeDefined();
      expect(removeBtn.className).toContain('p-2');
    });
  });

  describe('AC-10..AC-11 & AC-14: App.tsx Accessibility & Copy Attributes', () => {
    const appContent = fs.readFileSync(path.resolve(SRC_DIR, 'App.tsx'), 'utf-8');

    it('AC-10: Back navigation button renders aria-label="Back to recipe library"', () => {
      expect(appContent).toContain('aria-label="Back to recipe library"');
    });

    it('AC-14: Recipe delete confirmation copy names the recipe and lists deleted items', () => {
      expect(appContent).toContain(
        'message={`This will permanently delete "${recipe.name}" and all its fermentables, hops, yeast, and miscs. This cannot be undone.`}',
      );
    });
  });

  describe('AC-12: Focus Visibility Styling', () => {
    it('index.css includes global :focus-visible rule', () => {
      const cssContent = fs.readFileSync(path.resolve(SRC_DIR, 'index.css'), 'utf-8');
      expect(cssContent).toContain(':focus-visible');
      expect(cssContent).toContain('outline: 2px solid #38bdf8');
      expect(cssContent).toContain('outline-offset: 2px');
    });
  });

  describe('AC-13: Branding Title Tag', () => {
    it('index.html title matches TruchaBrew branding', () => {
      const htmlPath = path.resolve(__dirname, '../index.html');
      const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
      expect(htmlContent).toContain('<title>TruchaBrew</title>');
    });
  });

  // M25_P1 RA-6 reconciliation of the former AC-11 (a literal source-text
  // sweep on App.tsx): the scale modal's role/aria-modal/aria-labelledby
  // attributes are now emitted dynamically by the shared <Modal> wrapper
  // (Modal.tsx), not authored as literal JSX attribute text in App.tsx, so a
  // text sweep can no longer observe them. This renders the real modal and
  // asserts on the attributes it actually produces in the DOM instead —
  // strictly stronger than the sweep it replaces.
  describe('AC-11: Scale modal renders role="dialog", aria-modal="true", aria-labelledby, and the target-size aria-label (M25_P1 RA-6)', () => {
    const DEFAULT_TEST_CONFIG: UserConfig = {
      id: 'default',
      unitSystem: 'metric',
      gravityUnit: 'sg',
      temperatureUnit: 'celsius',
      ibuFormula: 'tinseth',
      abvFormula: 'simple',
    };

    function jsonResponse(body: unknown, status = 200): Response {
      return {
        ok: status >= 200 && status < 300,
        status,
        text: () => Promise.resolve(JSON.stringify(body)),
      } as Response;
    }

    const EQUIPMENT = baseEquipment();
    const STORED_RECIPE = baseStoredRecipe({ id: 'r-saved-1', name: 'Saved Test Recipe' });

    beforeEach(() => {
      // RA-4: reset jsdom's URL before this describe block's <App /> mount.
      window.history.replaceState({}, '', '/');
      vi.stubGlobal(
        'fetch',
        vi.fn((input: RequestInfo | URL) => {
          const url = typeof input === 'string' ? input : input.toString();
          if (url === '/api/config') return Promise.resolve(jsonResponse(DEFAULT_TEST_CONFIG));
          if (url.startsWith('/api/inventory')) return Promise.resolve(jsonResponse([]));
          return Promise.reject(new Error(`Unexpected global fetch call in accessibilityAndPolish.test.tsx: ${url}`));
        }),
      );
      vi.mocked(getCatalog).mockReset().mockResolvedValue({ fermentables: [], hops: [], yeasts: [], miscs: [] });
      vi.mocked(listEquipmentProfiles).mockReset().mockResolvedValue([EQUIPMENT]);
      vi.mocked(listMashProfiles).mockReset().mockResolvedValue([]);
      vi.mocked(listFermentationProfiles).mockReset().mockResolvedValue([]);
      vi.mocked(listRecipes).mockReset().mockResolvedValue([
        {
          id: STORED_RECIPE.id,
          name: STORED_RECIPE.name,
          author: STORED_RECIPE.author,
          styleName: STORED_RECIPE.styleName,
          equipmentId: EQUIPMENT.id,
          equipmentName: EQUIPMENT.name,
          batchSizeL: EQUIPMENT.batchSizeL,
          fermentableCount: 1,
          hopCount: 0,
          createdAt: STORED_RECIPE.createdAt,
          updatedAt: STORED_RECIPE.updatedAt,
        },
      ]);
      vi.mocked(getRecipe).mockReset().mockResolvedValue(STORED_RECIPE);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('opening the scale modal exposes the full AC-11 attribute set on the real DOM', async () => {
      render(<App />);
      await waitFor(() => screen.getByText('Saved Test Recipe'));
      fireEvent.click(screen.getByText('Saved Test Recipe'));
      await waitFor(() => screen.getByRole('button', { name: /Brew This/ }));

      fireEvent.click(screen.getByRole('button', { name: /Scale Batch/ }));

      const dialog = await waitFor(() => screen.getByRole('dialog'));
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      const labelledBy = dialog.getAttribute('aria-labelledby');
      expect(labelledBy).toBe('scale-modal-title');
      const titleEl = document.getElementById('scale-modal-title');
      expect(titleEl).not.toBeNull();
      expect(dialog).toContainElement(titleEl);

      expect(screen.getByLabelText('Target batch size in liters')).toBeInTheDocument();
    });
  });
});
