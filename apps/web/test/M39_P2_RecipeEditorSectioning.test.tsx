import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import type { UserConfig } from '@truchabrew/shared-types';
import App from '../src/App';
import { baseEquipment, baseStoredRecipe } from './helpers/fixtures';
import { ConfigProvider } from '../src/context/ConfigContext';
import { CatalogProvider } from '../src/context/CatalogContext';
import { FermentableSection } from '../src/components/FermentableSection';
import { HopSection } from '../src/components/HopSection';
import { YeastSection } from '../src/components/YeastSection';
import { MiscSection } from '../src/components/MiscSection';

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

// Mirror App.test.tsx's api/client mock so the full <App /> editor mounts.
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
    createBatch: vi.fn(),
    getBatch: vi.fn(),
    listBatches: vi.fn(),
    deleteRecipe: vi.fn(),
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

const mockedGetCatalog = vi.mocked(getCatalog);
const mockedListEquipmentProfiles = vi.mocked(listEquipmentProfiles);
const mockedListMashProfiles = vi.mocked(listMashProfiles);
const mockedListFermentationProfiles = vi.mocked(listFermentationProfiles);
const mockedListRecipes = vi.mocked(listRecipes);
const mockedGetRecipe = vi.mocked(getRecipe);

const EQUIPMENT = baseEquipment();
const STORED_RECIPE = baseStoredRecipe({ id: 'r-saved-1', name: 'Saved Test Recipe' });

beforeEach(() => {
  window.history.replaceState({}, '', '/');
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === '/api/config') return Promise.resolve(jsonResponse(DEFAULT_TEST_CONFIG));
      if (url.startsWith('/api/inventory')) return Promise.resolve(jsonResponse([]));
      return Promise.reject(new Error(`Unexpected global fetch call in M39_P2_RecipeEditorSectioning.test.tsx: ${url}`));
    }),
  );
  mockedGetCatalog.mockReset().mockResolvedValue({ fermentables: [], hops: [], yeasts: [], miscs: [] });
  mockedListEquipmentProfiles.mockReset().mockResolvedValue([EQUIPMENT]);
  mockedListMashProfiles.mockReset().mockResolvedValue([]);
  mockedListFermentationProfiles.mockReset().mockResolvedValue([]);
  mockedListRecipes.mockReset().mockResolvedValue([
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
  mockedGetRecipe.mockReset().mockResolvedValue(STORED_RECIPE);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function openSavedRecipe() {
  render(<App />);
  await waitFor(() => screen.getByText('Saved Test Recipe'));
  fireEvent.click(screen.getByText('Saved Test Recipe'));
  await waitFor(() => screen.getByRole('button', { name: /Brew This/ }));
}

function renderIngredient(ui: ReactElement) {
  return render(
    <ConfigProvider>
      <CatalogProvider>{ui}</CatalogProvider>
    </ConfigProvider>,
  );
}

// ---------------------------------------------------------------------------
// Component-level: SectionCard adoption on the four ingredient sections
// ---------------------------------------------------------------------------

describe('AC-1..AC-4: ingredient sections render as SectionCards (App editor)', () => {
  it.each([
    ['recipe-fermentables', 'Fermentables & Malts'],
    ['recipe-hops', 'Hops & Contextual Hop Schedule'],
    ['recipe-yeast', 'Yeast Strain & Fermentation'],
    ['recipe-miscs', 'Misc & Water Agents'],
  ])('%s is an h3 SectionCard titled "%s"', async (id, title) => {
    await openSavedRecipe();
    const section = screen.getByTestId(`${id}-section`);
    expect(section).toBeInTheDocument();
    expect(document.getElementById(id)).toBe(section);
    // The collapsible header's accessible name also includes the badge text,
    // so match the title as a substring.
    expect(screen.getByRole('heading', { level: 3, name: new RegExp(title) })).toBeInTheDocument();
  });

  it('AC-2: hop SectionCard keeps estimated-ibu-display inside its section', async () => {
    await openSavedRecipe();
    const section = screen.getByTestId('recipe-hops-section');
    expect(within(section).getByTestId('estimated-ibu-display')).toBeInTheDocument();
  });
});

describe('AC-5..AC-8: collapsibility, independence and badge at component level', () => {
  it('AC-5: every ingredient panel is mounted on first render (open by default)', () => {
    renderIngredient(
      <>
        <FermentableSection fermentables={[]} totalGrainKg={0} onUpdate={vi.fn()} />
        <HopSection
          hops={[]}
          wortGravity={1.05}
          batchSizeL={20}
          hopUtilizationPct={87}
          hopstandUtilizationFactor={0.26}
          hopstandTemperatureC={79}
          totalHopG={0}
          totalIbu={0}
          onUpdate={vi.fn()}
        />
        <YeastSection yeasts={[]} onUpdate={vi.fn()} />
        <MiscSection miscs={[]} onUpdate={vi.fn()} />
      </>,
    );

    expect(screen.getByTestId('recipe-fermentables-panel')).toBeInTheDocument();
    expect(screen.getByTestId('recipe-hops-panel')).toBeInTheDocument();
    expect(screen.getByTestId('recipe-yeast-panel')).toBeInTheDocument();
    expect(screen.getByTestId('recipe-miscs-panel')).toBeInTheDocument();
  });

  it('AC-6: clicking a toggle collapses then re-expands the card', () => {
    renderIngredient(
      <HopSection
        hops={[]}
        wortGravity={1.05}
        batchSizeL={20}
        hopUtilizationPct={87}
        hopstandUtilizationFactor={0.26}
        hopstandTemperatureC={79}
        totalHopG={0}
        totalIbu={0}
        onUpdate={vi.fn()}
      />,
    );

    const toggle = screen.getByTestId('recipe-hops-toggle');
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(toggle);
    expect(screen.queryByTestId('recipe-hops-panel')).not.toBeInTheDocument();
    expect(screen.getByTestId('recipe-hops-toggle')).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(screen.getByTestId('recipe-hops-toggle'));
    expect(screen.getByTestId('recipe-hops-panel')).toBeInTheDocument();
    expect(screen.getByTestId('recipe-hops-toggle')).toHaveAttribute('aria-expanded', 'true');
  });

  it('AC-7: collapsing recipe-hops does not collapse the other ingredient cards', () => {
    renderIngredient(
      <>
        <FermentableSection fermentables={[]} totalGrainKg={0} onUpdate={vi.fn()} />
        <HopSection
          hops={[]}
          wortGravity={1.05}
          batchSizeL={20}
          hopUtilizationPct={87}
          hopstandUtilizationFactor={0.26}
          hopstandTemperatureC={79}
          totalHopG={0}
          totalIbu={0}
          onUpdate={vi.fn()}
        />
      </>,
    );

    fireEvent.click(screen.getByTestId('recipe-hops-toggle'));
    expect(screen.queryByTestId('recipe-hops-panel')).not.toBeInTheDocument();
    expect(screen.getByTestId('recipe-fermentables-panel')).toBeInTheDocument();
    expect(screen.getByTestId('recipe-fermentables-toggle')).toHaveAttribute('aria-expanded', 'true');
  });

  it('AC-8: hop header summary lives in the badge slot and hosts no nested interactive control', () => {
    renderIngredient(
      <HopSection
        hops={[]}
        wortGravity={1.05}
        batchSizeL={20}
        hopUtilizationPct={87}
        hopstandUtilizationFactor={0.26}
        hopstandTemperatureC={79}
        totalHopG={0}
        totalIbu={0}
        onUpdate={vi.fn()}
      />,
    );

    const toggle = screen.getByTestId('recipe-hops-toggle');
    expect(within(toggle).getByTestId('estimated-ibu-display')).toBeInTheDocument();
    // The badge content is non-interactive: no nested button/input inside the toggle.
    expect(within(toggle).queryByRole('button')).not.toBeInTheDocument();
    expect(toggle.querySelectorAll('input').length).toBe(0);
  });
});

describe('AC-14: optional sectionId prop overrides the canonical id', () => {
  it('defaults to the canonical id when sectionId is omitted', () => {
    renderIngredient(<FermentableSection fermentables={[]} totalGrainKg={0} onUpdate={vi.fn()} />);
    expect(screen.getByTestId('recipe-fermentables-section')).toBeInTheDocument();
  });

  it('a custom sectionId is written verbatim onto the root section', () => {
    renderIngredient(
      <FermentableSection
        fermentables={[]}
        totalGrainKg={0}
        onUpdate={vi.fn()}
        sectionId="custom-ingredients"
      />,
    );
    expect(screen.getByTestId('custom-ingredients-section')).toBeInTheDocument();
    expect(document.getElementById('custom-ingredients')).toBe(
      screen.getByTestId('custom-ingredients-section'),
    );
  });
});

// ---------------------------------------------------------------------------
// App-level: recipe editor editing / CRUD regressions
// ---------------------------------------------------------------------------

describe('AC-12, AC-13, AC-33, AC-34, AC-38: recipe editor regressions', () => {
  it('AC-12: editing a fermentable amount dirties the recipe (save path intact)', async () => {
    await openSavedRecipe();
    await waitFor(() => expect(screen.getByTestId('recipe-fermentables-section')).toBeInTheDocument());

    const amountInput = screen.getByLabelText('Pale Ale Malt (2-Row) amount (kg)');
    fireEvent.change(amountInput, { target: { value: '6.5' } });

    await waitFor(() => {
      expect(screen.getByLabelText('Pale Ale Malt (2-Row) amount (kg)')).toHaveValue(6.5);
      const brewButton = screen.getByRole('button', { name: /Brew This/ });
      expect(brewButton).toBeDisabled();
      expect(brewButton).toHaveAttribute('title', expect.stringMatching(/save your changes/i));
    });
  });

  it('AC-13: adding and removing a hop row still works inside the recipe-hops card', async () => {
    mockedGetCatalog.mockResolvedValue({
      fermentables: [],
      hops: [{ id: 'cat-h-1', name: 'Citra', alphaAcidPct: 12.5, type: 'Pellet' }],
      yeasts: [],
      miscs: [],
    });

    await openSavedRecipe();
    await waitFor(() => expect(screen.getByTestId('recipe-hops-section')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('hop-open-picker-btn'));
    fireEvent.click(screen.getByTestId('preset-item-cat-h-1'));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Remove Citra' })).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Remove Citra' }));
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Remove Citra' })).not.toBeInTheDocument(),
    );
  });

  it('AC-33: collapsing a card leaves the recipe clean (no dirty flag)', async () => {
    await openSavedRecipe();
    await waitFor(() => expect(screen.getByTestId('recipe-fermentables-section')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /Brew This/ })).not.toBeDisabled();

    fireEvent.click(screen.getByTestId('recipe-fermentables-toggle'));
    expect(screen.queryByTestId('recipe-fermentables-panel')).not.toBeInTheDocument();

    expect(screen.getByRole('button', { name: /Brew This/ })).not.toBeDisabled();
  });

  it('AC-34: every recipe ingredient heading is an h3', async () => {
    await openSavedRecipe();
    expect(
      screen.getByRole('heading', { level: 3, name: /Fermentables & Malts/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 3, name: /Hops & Contextual Hop Schedule/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 3, name: /Yeast Strain & Fermentation/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: /Misc & Water Agents/ })).toBeInTheDocument();
  });

  it('AC-38: MashSection, WaterSection, StyleTargetPanel and the identity header remain un-wrapped', async () => {
    await openSavedRecipe();
    expect(screen.getByTestId('mash-profile-picker')).toBeInTheDocument();
    expect(screen.getByTestId('water-summary-row')).toBeInTheDocument();
    expect(screen.getByTestId('style-target-panel')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /Live Recipe Statistics/ })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Recipe Name')).toBeInTheDocument();
  });
});
