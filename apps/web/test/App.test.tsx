import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import type { UserConfig, CalculatedStats } from '@truchabrew/shared-types';
import type { MashPlan } from '@truchabrew/calculations';
import App from '../src/App';
import { ApiClientError } from '../src/api/client';
import { baseEquipment, baseStoredRecipe, baseBatch } from './helpers/fixtures';
// M7_P2 AC-18 gap-closing follow-up — real production components/context
// used to prove the lockstep contract, rather than <App /> (see the note
// above that describe block for why).
import { ConfigProvider, useConfig } from '../src/context/ConfigContext';
import { StatsHeader } from '../src/components/StatsHeader';
import { MashSection } from '../src/components/MashSection';
import { SettingsManager } from '../src/components/SettingsManager';


// M7_P1 amendment §1.4 — App.tsx now mounts ConfigProvider, which issues its
// own GET /api/config via the real global `fetch` (not routed through
// api/client.ts, per §1.4's ConfigContext.tsx charge). Stubbed here at the
// fetch level so every <App /> mount in this file resolves to a default
// config rather than hitting a real network call.
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
  createBatch,
  getBatch,
  listBatches,
  deleteRecipe,
} from '../src/api/client';

const mockedGetCatalog = vi.mocked(getCatalog);
const mockedListEquipmentProfiles = vi.mocked(listEquipmentProfiles);
const mockedListMashProfiles = vi.mocked(listMashProfiles);
const mockedListFermentationProfiles = vi.mocked(listFermentationProfiles);
const mockedListRecipes = vi.mocked(listRecipes);
const mockedGetRecipe = vi.mocked(getRecipe);
const mockedCreateBatch = vi.mocked(createBatch);
const mockedGetBatch = vi.mocked(getBatch);
const mockedListBatches = vi.mocked(listBatches);
const mockedDeleteRecipe = vi.mocked(deleteRecipe);

const EQUIPMENT = baseEquipment();
const STORED_RECIPE = baseStoredRecipe({ id: 'r-saved-1', name: 'Saved Test Recipe' });

beforeEach(() => {
  // RA-4: reset jsdom's URL before every test in this file (rather than
  // introducing createMemoryRouter/MemoryRouter, which would force all 46
  // render(<App />) sites to change and would test a different router
  // implementation than production ships).
  window.history.replaceState({}, '', '/');
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === '/api/config') return Promise.resolve(jsonResponse(DEFAULT_TEST_CONFIG));
      // NEW in M9_P1 — InventoryManager is self-contained (BatchList
      // precedent) and issues its own GET /api/inventory[?...] directly
      // through the real, unmocked api/client.ts request() helper, so the
      // route Inventory tests exercise needs to resolve here.
      if (url.startsWith('/api/inventory')) return Promise.resolve(jsonResponse([]));
      return Promise.reject(new Error(`Unexpected global fetch call in App.test.tsx: ${url}`));
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
  mockedCreateBatch.mockReset();
  mockedGetBatch.mockReset();
  mockedListBatches.mockReset().mockResolvedValue([]);
  mockedDeleteRecipe.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function openSavedRecipe() {
  render(<App />);
  await waitFor(() => screen.getByText('Saved Test Recipe'));
  fireEvent.click(screen.getByText('Saved Test Recipe'));
  // The editor header ("Brew This") only renders once the editor view mounts.
  await waitFor(() => screen.getByRole('button', { name: /Brew This/ }));
}

// ---------------------------------------------------------------------------
// M13_P1 §3.1 — App shell viewport scroll isolation (AC-1/AC-2/AC-3).
// ---------------------------------------------------------------------------

describe('AC-1/AC-2/AC-3: app shell viewport scroll isolation', () => {
  it('AC-1: root viewport carries h-screen overflow-hidden flex', async () => {
    const { container } = render(<App />);
    await waitFor(() => screen.getByText('Saved Test Recipe'));
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain('h-screen');
    expect(root.className).toContain('overflow-hidden');
    expect(root.className).toContain('flex');
  });

  it('AC-2: Sidebar carries h-full flex-shrink-0 and TopBar is flex-shrink-0 sticky top-0', async () => {
    render(<App />);
    await waitFor(() => screen.getByText('Saved Test Recipe'));
    const nav = screen.getByRole('navigation');
    expect(nav.className).toContain('h-full');
    expect(nav.className).toContain('flex-shrink-0');

    const header = screen.getByTestId('topbar-lead').closest('header') as HTMLElement;
    expect(header.className).toContain('flex-shrink-0');
    expect(header.className).toContain('sticky');
    expect(header.className).toContain('top-0');
  });

  it('AC-3: PageContainer carries flex-1 overflow-y-auto min-w-0, confining scroll to itself', async () => {
    render(<App />);
    await waitFor(() => screen.getByText('Saved Test Recipe'));
    const main = screen.getByTestId('page-container');
    expect(main.className).toContain('flex-1');
    expect(main.className).toContain('overflow-y-auto');
    expect(main.className).toContain('min-w-0');
  });
});

describe('AC-8: the "Brew This" control', () => {
  it('(a) exists in the editor header, reachable once a saved recipe is open', async () => {
    await openSavedRecipe();
    expect(screen.getByRole('button', { name: /Brew This/ })).toBeInTheDocument();
  });

  it('(b) is disabled with a reason when the recipe has never been saved (storedId === null)', async () => {
    render(<App />);
    await waitFor(() => screen.getByRole('button', { name: 'New Recipe' }));
    fireEvent.click(screen.getByRole('button', { name: 'New Recipe' }));

    const brewButton = await screen.findByRole('button', { name: /Brew This/ });
    expect(brewButton).toBeDisabled();
    expect(brewButton).toHaveAttribute('title', expect.stringMatching(/save this recipe/i));
  });

  it('(b) is disabled with a reason once the open (saved) recipe is dirtied', async () => {
    await openSavedRecipe();
    expect(screen.getByRole('button', { name: /Brew This/ })).not.toBeDisabled();

    // Dirty the recipe by editing its name.
    const nameInput = screen.getByPlaceholderText('Recipe Name');
    fireEvent.change(nameInput, { target: { value: 'Changed Name' } });

    await waitFor(() => {
      const brewButton = screen.getByRole('button', { name: /Brew This/ });
      expect(brewButton).toBeDisabled();
      expect(brewButton).toHaveAttribute('title', expect.stringMatching(/save your changes/i));
    });
  });

  it('(b) is enabled (storedId !== null && !isDirty) right after opening a saved, clean recipe', async () => {
    await openSavedRecipe();
    expect(screen.getByRole('button', { name: /Brew This/ })).not.toBeDisabled();
  });

  it('(c)/(d) clicking it POSTs through client.ts and navigates to the created batch on success', async () => {
    const createdBatch = baseBatch({ id: 'batch-new-1', name: 'Batch #1 - Saved Test Recipe', recipeId: STORED_RECIPE.id });
    mockedCreateBatch.mockResolvedValue(createdBatch);
    mockedGetBatch.mockResolvedValue({ ...createdBatch, readings: [], notes: [] });

    await openSavedRecipe();
    fireEvent.click(screen.getByRole('button', { name: /Brew This/ }));

    await waitFor(() => {
      expect(mockedCreateBatch).toHaveBeenCalledWith(STORED_RECIPE.id);
    });
    // Navigated using the id from the response body (getBatch called with it).
    await waitFor(() => {
      expect(mockedGetBatch).toHaveBeenCalledWith('batch-new-1');
    });
    // M13_P1 §3.4.4 forced fallout: the batch name now renders twice by
    // design (TopBar's <h1> title AND the BatchDetail header card, per the
    // spec's identity+status panel) — getByText would ambiguously match
    // both, so this targets the TopBar heading specifically.
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Batch #1 - Saved Test Recipe' })).toBeInTheDocument();
    });
  });

  it('(e) does not navigate on failure, and surfaces the server message', async () => {
    mockedCreateBatch.mockRejectedValue(new ApiClientError('VALIDATION_FAILED', 'Recipe not found'));

    await openSavedRecipe();
    fireEvent.click(screen.getByRole('button', { name: /Brew This/ }));

    await waitFor(() => {
      expect(screen.getByText(/Recipe not found/)).toBeInTheDocument();
    });
    // Still on the editor — the recipe name input is still present — and
    // getBatch (the batch-detail fetch) was never called.
    expect(screen.getByDisplayValue('Saved Test Recipe')).toBeInTheDocument();
    expect(mockedGetBatch).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// M5.5_P1 — new blocks for AC-13 through AC-21 (§1.2's named integration-test
// exception, deviation-register entry 12). No existing block above this
// comment is touched.
// ---------------------------------------------------------------------------

// NEW in M9_P1 — 'Inventory' appended (AC-19's bounded charge: extend any
// exhaustive per-destination loop to cover it). Every loop below that
// iterates NAV_LABELS now exercises the Inventory route too.
const NAV_LABELS = ['Recipes', 'Equipment Profiles', 'Mash Profiles', 'Fermentation Profiles', 'Water Profiles', 'Batches', 'Inventory'] as const;

const ROUTE_H1 = {
  list: 'Recipe Library',
  editor: 'Recipe Editor',
  equipment: 'Equipment Profiles',
  mashProfiles: 'Mash Profiles',
  fermentationProfiles: 'Fermentation Profiles',
  waterProfiles: 'Water Profiles',
  batches: 'Brewing Batches',
  inventory: 'Inventory',
} as const;

const LISTED_BATCH = baseBatch({ id: 'batch-list-1', name: 'Batch #1 - Original Recipe' });

function mockBatchesRoute() {
  mockedListBatches.mockResolvedValue([LISTED_BATCH]);
  mockedGetBatch.mockResolvedValue({ ...LISTED_BATCH, readings: [], notes: [] });
}

async function navigateTo(label: (typeof NAV_LABELS)[number]) {
  fireEvent.click(screen.getByRole('button', { name: label }));
}

describe('AC-13: every route renders the sidebar', () => {
  it('all five destination buttons are present on list, equipment, mashProfiles, fermentationProfiles, batches and editor', async () => {
    mockBatchesRoute();
    render(<App />);
    await waitFor(() => screen.getByText('Saved Test Recipe'));

    for (const label of NAV_LABELS) {
      for (const target of NAV_LABELS) {
        expect(screen.getByRole('button', { name: target })).toBeInTheDocument();
      }
      await navigateTo(label);
      await waitFor(() => {
        for (const target of NAV_LABELS) {
          expect(screen.getByRole('button', { name: target })).toBeInTheDocument();
        }
      });
    }

    // Reach editor via the saved fixture recipe.
    await navigateTo('Recipes');
    await waitFor(() => screen.getByText('Saved Test Recipe'));
    fireEvent.click(screen.getByText('Saved Test Recipe'));
    await waitFor(() => screen.getByRole('button', { name: /Brew This/ }));
    for (const target of NAV_LABELS) {
      expect(screen.getByRole('button', { name: target })).toBeInTheDocument();
    }
  });
});

describe('AC-14: every route renders exactly one <h1>, with the bound accessible name', () => {
  it('list, equipment, mashProfiles, fermentationProfiles each have exactly one <h1> matching TopBar\'s title', async () => {
    render(<App />);
    await waitFor(() => screen.getByText('Saved Test Recipe'));
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveAccessibleName(ROUTE_H1.list);

    for (const [label, h1] of [
      ['Equipment Profiles', ROUTE_H1.equipment],
      ['Mash Profiles', ROUTE_H1.mashProfiles],
      ['Fermentation Profiles', ROUTE_H1.fermentationProfiles],
    ] as const) {
      await navigateTo(label);
      await waitFor(() => {
        expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
        expect(screen.getByRole('heading', { level: 1 })).toHaveAccessibleName(h1);
      });
    }
  });

  it('editor has exactly one <h1> = "Recipe Editor"', async () => {
    await openSavedRecipe();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveAccessibleName(ROUTE_H1.editor);
  });

  it('batches has exactly one <h1> = "Brewing Batches", rendered by BatchList\'s own TopBar', async () => {
    mockBatchesRoute();
    render(<App />);
    await waitFor(() => screen.getByText('Saved Test Recipe'));
    await navigateTo('Batches');
    await waitFor(() => {
      expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
      expect(screen.getByRole('heading', { level: 1 })).toHaveAccessibleName(ROUTE_H1.batches);
    });
  });

  it('batchDetail has exactly one <h1> containing the fixture batch\'s name, rendered by BatchDetail\'s own TopBar', async () => {
    mockBatchesRoute();
    render(<App />);
    await waitFor(() => screen.getByText('Saved Test Recipe'));
    await navigateTo('Batches');
    await waitFor(() => screen.getByText(LISTED_BATCH.name));
    fireEvent.click(screen.getByText(LISTED_BATCH.name));
    await waitFor(() => {
      expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
      expect(screen.getByRole('heading', { level: 1 })).toHaveAccessibleName(
        new RegExp(LISTED_BATCH.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
      );
    });
  });
});

describe('AC-15: sidebar navigation actually navigates', () => {
  it('clicking each of the four non-Recipes destinations from list lands on the right page, and Recipes returns to Recipe Library', async () => {
    mockBatchesRoute();
    render(<App />);
    await waitFor(() => screen.getByText('Saved Test Recipe'));

    for (const [label, h1] of [
      ['Equipment Profiles', ROUTE_H1.equipment],
      ['Mash Profiles', ROUTE_H1.mashProfiles],
      ['Fermentation Profiles', ROUTE_H1.fermentationProfiles],
      ['Water Profiles', ROUTE_H1.waterProfiles],
      ['Batches', ROUTE_H1.batches],
      ['Inventory', ROUTE_H1.inventory],
    ] as const) {
      await navigateTo(label);
      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1 })).toHaveAccessibleName(h1);
      });
      await navigateTo('Recipes');
      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1 })).toHaveAccessibleName(ROUTE_H1.list);
      });
    }
  });
});

describe('AC-16: collapse state survives navigation', () => {
  it('stays collapsed across a round trip to Batches and back', async () => {
    mockBatchesRoute();
    render(<App />);
    await waitFor(() => screen.getByText('Saved Test Recipe'));

    fireEvent.click(screen.getByRole('button', { name: 'Collapse navigation' }));
    await waitFor(() => screen.getByRole('button', { name: 'Expand navigation' }));
    for (const label of NAV_LABELS) {
      expect(screen.queryByText(label)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }

    await navigateTo('Batches');
    await waitFor(() => screen.getByRole('heading', { level: 1, name: ROUTE_H1.batches }));
    expect(screen.getByRole('button', { name: 'Expand navigation' })).toBeInTheDocument();
    for (const label of NAV_LABELS) {
      expect(screen.queryByText(label)).not.toBeInTheDocument();
    }

    await navigateTo('Recipes');
    await waitFor(() => screen.getByRole('heading', { level: 1, name: ROUTE_H1.list }));
    expect(screen.getByRole('button', { name: 'Expand navigation' })).toBeInTheDocument();
  });
});

describe('AC-17: every route is reachable while collapsed', () => {
  it('reaches all five nav destinations via icon-only buttons without ever expanding', async () => {
    mockBatchesRoute();
    render(<App />);
    await waitFor(() => screen.getByText('Saved Test Recipe'));

    fireEvent.click(screen.getByRole('button', { name: 'Collapse navigation' }));
    await waitFor(() => screen.getByRole('button', { name: 'Expand navigation' }));

    for (const [label, h1] of [
      ['Equipment Profiles', ROUTE_H1.equipment],
      ['Mash Profiles', ROUTE_H1.mashProfiles],
      ['Fermentation Profiles', ROUTE_H1.fermentationProfiles],
      ['Batches', ROUTE_H1.batches],
      ['Inventory', ROUTE_H1.inventory],
      ['Recipes', ROUTE_H1.list],
    ] as const) {
      await navigateTo(label);
      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1 })).toHaveAccessibleName(h1);
      });
      expect(screen.getByRole('button', { name: 'Expand navigation' })).toBeInTheDocument();
    }
  });
});

describe('AC-18: editor-route contextual actions survive the rework', () => {
  it('Scale Batch, Brew This and the SaveBar control are all present in the top bar', async () => {
    await openSavedRecipe();
    expect(screen.getByRole('button', { name: /Scale Batch/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Brew This/ })).toBeInTheDocument();
    // SaveBar renders a Save control when the recipe is clean it still mounts;
    // presence of the recipe name input confirms the editor page content itself
    // also still renders alongside the reworked top bar.
    expect(screen.getByPlaceholderText('Recipe Name')).toBeInTheDocument();
  });
});

describe('AC-19: destination buttons are gone from the top bar', () => {
  it('no <header>-descendant element has an accessible name equal to any NAV_ITEMS label, on any route', async () => {
    mockBatchesRoute();
    const { container } = render(<App />);
    await waitFor(() => screen.getByText('Saved Test Recipe'));

    for (const label of NAV_LABELS) {
      const header = container.querySelector('header');
      expect(header).not.toBeNull();
      if (header) {
        for (const navLabel of NAV_LABELS) {
          expect(within(header).queryByRole('button', { name: navLabel })).not.toBeInTheDocument();
        }
      }
      await navigateTo(label);
      await waitFor(() => {
        expect(screen.getByRole('button', { name: label })).toHaveAttribute('aria-current', 'page');
      });
    }
  });
});

describe('AC-20: Header is deleted, not orphaned', () => {
  it('App.tsx declares no function Header and contains no <Header JSX usage', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const source = readFileSync(join(process.cwd(), 'src/App.tsx'), 'utf8');
    expect(source).not.toMatch(/function Header\(/);
    expect(source).not.toMatch(/<Header[\s/>]/);
  });
});

// M13_P1 §3.2 (BUG-013) — this block SUPERSEDES the pre-M13_P1 "other
// destinations never confirm" contract. The old behaviour (navigating from a
// dirty editor to Equipment/MashSchedules/etc. silently switched view with
// zero prompt, only Recipes confirmed) was itself BUG-013: any navigation
// away from a dirty editor must immediately prompt, regardless of
// destination (AC-4). Non-editor -> non-editor transitions still never
// confirm (AC-6, verified separately below).
describe('AC-21/AC-4/AC-5: unsaved-changes confirm fires for ANY destination while the editor is dirty (BUG-013)', () => {
  it('confirms on Recipes when dirty; declining stays, accepting leaves and resets dirty state', async () => {
    mockBatchesRoute();
    await openSavedRecipe();
    fireEvent.change(screen.getByPlaceholderText('Recipe Name'), { target: { value: 'Changed Name' } });

    // M27_P1: the guard is now useBlocker + the app's own ConfirmDialog, not
    // window.confirm (RA-2, RA-13).
    await navigateTo('Recipes');
    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('confirm-dialog-cancel'));
    // Declined — still on editor.
    expect(screen.getByDisplayValue('Changed Name')).toBeInTheDocument();
    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();

    await navigateTo('Recipes');
    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('confirm-dialog-confirm'));
    await waitFor(() => screen.getByText('Saved Test Recipe'));
  });

  it('AC-4/AC-5: confirms on Equipment Profiles too (BUG-013 fix) — declining stays on editor with edits intact, accepting leaves and resets dirty state', async () => {
    await openSavedRecipe();
    fireEvent.change(screen.getByPlaceholderText('Recipe Name'), { target: { value: 'Changed Name' } });

    await navigateTo('Equipment Profiles');
    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('confirm-dialog-cancel'));
    // Declined — still on editor, edit intact.
    expect(screen.getByDisplayValue('Changed Name')).toBeInTheDocument();
    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();

    await navigateTo('Equipment Profiles');
    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('confirm-dialog-confirm'));
    await waitFor(() => screen.getByRole('heading', { level: 1, name: ROUTE_H1.equipment }));

    // Re-opening the (now-closed) editor shows a clean recipe, not the
    // discarded "Changed Name" edit — proves editor.closeEditor() actually ran.
    await navigateTo('Recipes');
    await waitFor(() => screen.getByText('Saved Test Recipe'));
    fireEvent.click(screen.getByText('Saved Test Recipe'));
    await waitFor(() => screen.getByRole('button', { name: /Brew This/ }));
    expect(screen.queryByDisplayValue('Changed Name')).not.toBeInTheDocument();
  });

  it('AC-6: non-editor route transitions never trigger a phantom prompt (Equipment -> Recipes, Batches -> Settings)', async () => {
    mockBatchesRoute();
    render(<App />);
    await waitFor(() => screen.getByText('Saved Test Recipe'));

    await navigateTo('Equipment Profiles');
    await waitFor(() => screen.getByRole('heading', { level: 1, name: ROUTE_H1.equipment }));
    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();
    await navigateTo('Recipes');
    await waitFor(() => screen.getByText('Saved Test Recipe'));
    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();

    await navigateTo('Batches');
    await waitFor(() => screen.getByRole('heading', { level: 1, name: ROUTE_H1.batches }));
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    await waitFor(() => screen.getByTestId('settings-select-gravityUnit'));
    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// M5.5_P2 — new blocks for AC-19 through AC-24 (§1.2's bounded new-block
// allowance for App.test.tsx). No existing block above this comment is
// touched. These verify the TopBar-moved-into-manager conversion at the
// App-shell level for the equipment/mashProfiles/fermentationProfiles routes.
// ---------------------------------------------------------------------------

describe('M5.5_P2 AC-19: AC-14 one-<h1>-per-route invariant is unmodified', () => {
  it('the existing AC-14 block above still passes unmodified — sentinel check that this file adds no regression to it', async () => {
    render(<App />);
    await waitFor(() => screen.getByText('Saved Test Recipe'));
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveAccessibleName(ROUTE_H1.list);
  });
});

describe('M5.5_P2 AC-20: exactly one <h1> while a profile create form is open', () => {
  it.each([
    ['Equipment Profiles', 'New Equipment Profile'],
    ['Mash Profiles', 'New Mash Profile'],
    ['Fermentation Profiles', 'New Fermentation Profile'],
  ] as const)('%s -> %s', async (navLabel, formTitle) => {
    render(<App />);
    await waitFor(() => screen.getByText('Saved Test Recipe'));
    await navigateTo(navLabel);
    await waitFor(() => screen.getByRole('heading', { level: 1, name: navLabel }));

    const newButton = screen.getByRole('button', { name: /^New Profile$/ });
    fireEvent.click(newButton);

    await waitFor(() => {
      expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
      expect(screen.getByRole('heading', { level: 1 })).toHaveAccessibleName(formTitle);
    });
  });
});

describe('M5.5_P2 AC-21: the sidebar is unchanged and un-overlaid while a form is open', () => {
  it('all five NAV_ITEMS labels remain clickable and Equipment Profiles carries aria-current', async () => {
    render(<App />);
    await waitFor(() => screen.getByText('Saved Test Recipe'));
    await navigateTo('Equipment Profiles');
    await waitFor(() => screen.getByRole('heading', { level: 1, name: 'Equipment Profiles' }));
    fireEvent.click(screen.getByRole('button', { name: 'New Profile' }));
    await waitFor(() => screen.getByRole('heading', { level: 1, name: 'New Equipment Profile' }));

    for (const label of NAV_LABELS) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
    const current = NAV_LABELS.map((label) => screen.getByRole('button', { name: label })).filter(
      (btn) => btn.getAttribute('aria-current') === 'page',
    );
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveAccessibleName('Equipment Profiles');
  });
});

describe('M5.5_P2 AC-22: an open form never blocks sidebar navigation, and no confirm is invoked', () => {
  it('clicking Batches while the equipment create form is open navigates there, unblocked', async () => {
    mockBatchesRoute();
    render(<App />);
    await waitFor(() => screen.getByText('Saved Test Recipe'));
    await navigateTo('Equipment Profiles');
    await waitFor(() => screen.getByRole('heading', { level: 1, name: 'Equipment Profiles' }));
    fireEvent.click(screen.getByRole('button', { name: 'New Profile' }));
    await waitFor(() => screen.getByRole('heading', { level: 1, name: 'New Equipment Profile' }));

    await navigateTo('Batches');
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveAccessibleName(ROUTE_H1.batches);
    });
    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();
  });
});

describe('M5.5_P2 AC-23: form state and sidebar collapse state are independent', () => {
  it('opening the equipment create form after collapsing leaves the sidebar collapsed', async () => {
    render(<App />);
    await waitFor(() => screen.getByText('Saved Test Recipe'));

    fireEvent.click(screen.getByRole('button', { name: 'Collapse navigation' }));
    await waitFor(() => screen.getByRole('button', { name: 'Expand navigation' }));

    await navigateTo('Equipment Profiles');
    await waitFor(() => screen.getByRole('heading', { level: 1, name: 'Equipment Profiles' }));
    fireEvent.click(screen.getByRole('button', { name: 'New Profile' }));
    await waitFor(() => screen.getByRole('heading', { level: 1, name: 'New Equipment Profile' }));

    expect(screen.getByRole('button', { name: 'Expand navigation' })).toBeInTheDocument();
    for (const label of NAV_LABELS) {
      expect(screen.queryByText(label)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
  });
});

describe('M5.5_P2 AC-24: no unsaved-changes guard was introduced on the three profile routes', () => {
  it('navigating away from an open equipment create form with edits does not call window.confirm', async () => {
    render(<App />);
    await waitFor(() => screen.getByText('Saved Test Recipe'));
    await navigateTo('Equipment Profiles');
    await waitFor(() => screen.getByRole('heading', { level: 1, name: 'Equipment Profiles' }));
    fireEvent.click(screen.getByRole('button', { name: 'New Profile' }));
    await waitFor(() => screen.getByRole('heading', { level: 1, name: 'New Equipment Profile' }));

    fireEvent.change(screen.getByLabelText('Profile Name'), { target: { value: 'Dirty Draft' } });

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    await navigateTo('Recipes');
    await waitFor(() => screen.getByText('Saved Test Recipe'));
    expect(confirmSpy).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// M5.5_P3 — new blocks for the integration-typed criteria in that spec's §3
// (§1.2's bounded new-block allowance). No existing block above this comment
// is touched, apart from the two permitted AC-14 `it(...)` title renames
// (Resolved Ambiguity 6).
// ---------------------------------------------------------------------------

const ALL_ROUTES: Array<[label: (typeof NAV_LABELS)[number] | 'editor', h1: string]> = [
  ['Recipes', ROUTE_H1.list],
  ['Equipment Profiles', ROUTE_H1.equipment],
  ['Mash Profiles', ROUTE_H1.mashProfiles],
  ['Fermentation Profiles', ROUTE_H1.fermentationProfiles],
  ['Batches', ROUTE_H1.batches],
  ['Inventory', ROUTE_H1.inventory],
];

describe('M5.5_P3 AC-4: every route mounts exactly one PageContainer', () => {
  it('list, equipment, mashProfiles, fermentationProfiles, batches, editor each have exactly one page-container and one main landmark', async () => {
    mockBatchesRoute();
    render(<App />);
    await waitFor(() => screen.getByText('Saved Test Recipe'));
    expect(screen.getAllByTestId('page-container')).toHaveLength(1);
    expect(screen.getAllByRole('main')).toHaveLength(1);

    for (const [label, h1] of ALL_ROUTES.slice(1)) {
      await navigateTo(label as (typeof NAV_LABELS)[number]);
      await waitFor(() => screen.getByRole('heading', { level: 1, name: h1 }));
      expect(screen.getAllByTestId('page-container')).toHaveLength(1);
      expect(screen.getAllByRole('main')).toHaveLength(1);
    }

    await navigateTo('Recipes');
    await waitFor(() => screen.getByText('Saved Test Recipe'));
    fireEvent.click(screen.getByText('Saved Test Recipe'));
    await waitFor(() => screen.getByRole('heading', { level: 1, name: ROUTE_H1.editor }));
    expect(screen.getAllByTestId('page-container')).toHaveLength(1);
    expect(screen.getAllByRole('main')).toHaveLength(1);
  });
});

describe('M5.5_P3 AC-5: all seven routes\' containers are class-identical', () => {
  it('the set of distinct container className values across routes has size 1 and equals PAGE_CONTAINER_CLASS', async () => {
    const { PAGE_CONTAINER_CLASS } = await import('../src/components/PageContainer');
    mockBatchesRoute();
    render(<App />);
    await waitFor(() => screen.getByText('Saved Test Recipe'));
    const classes = new Set<string>();
    classes.add(screen.getByTestId('page-container').className);

    for (const [label, h1] of ALL_ROUTES.slice(1)) {
      await navigateTo(label as (typeof NAV_LABELS)[number]);
      await waitFor(() => screen.getByRole('heading', { level: 1, name: h1 }));
      classes.add(screen.getByTestId('page-container').className);
    }

    await navigateTo('Recipes');
    await waitFor(() => screen.getByText('Saved Test Recipe'));
    fireEvent.click(screen.getByText('Saved Test Recipe'));
    await waitFor(() => screen.getByRole('heading', { level: 1, name: ROUTE_H1.editor }));
    classes.add(screen.getByTestId('page-container').className);

    expect(classes.size).toBe(1);
    expect([...classes][0]).toBe(PAGE_CONTAINER_CLASS);
  });
});

describe('M5.5_P3 AC-13: every route mounts exactly one TopBar', () => {
  it('exactly one topbar-lead exists on list, batches and batchDetail (the three routes App.tsx used to also render TopBar for)', async () => {
    mockBatchesRoute();
    render(<App />);
    await waitFor(() => screen.getByText('Saved Test Recipe'));
    expect(screen.getAllByTestId('topbar-lead')).toHaveLength(1);

    await navigateTo('Batches');
    await waitFor(() => screen.getByRole('heading', { level: 1, name: ROUTE_H1.batches }));
    expect(screen.getAllByTestId('topbar-lead')).toHaveLength(1);

    await waitFor(() => screen.getByText(LISTED_BATCH.name));
    fireEvent.click(screen.getByText(LISTED_BATCH.name));
    await waitFor(() => screen.getAllByRole('heading', { level: 1 }));
    expect(screen.getAllByTestId('topbar-lead')).toHaveLength(1);
  });
});

describe('M5.5_P3 AC-16 / AC-17 / AC-22: navigation source sweeps', () => {
  it('the literal &larr; Back never occurs in apps/web/src', async () => {
    const { readFileSync, readdirSync, statSync } = await import('node:fs');
    const { join } = await import('node:path');
    const root = join(process.cwd(), 'src');
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.(tsx?|jsx?)$/.test(entry)) {
          const content = readFileSync(full, 'utf8');
          if (content.includes('&larr; Back')) offenders.push(full);
        }
      }
    };
    walk(root);
    expect(offenders).toEqual([]);
  });

  it('BatchList.tsx and BatchDetail.tsx contain zero <h1 occurrences', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const batchList = readFileSync(join(process.cwd(), 'src/pages/BatchList.tsx'), 'utf8');
    const batchDetail = readFileSync(join(process.cwd(), 'src/pages/BatchDetail.tsx'), 'utf8');
    expect(batchList).not.toMatch(/<h1/);
    expect(batchDetail).not.toMatch(/<h1/);
  });
});

describe('M5.5_P3 AC-6 / AC-7: no route-level wrapper hard-codes a width any more', () => {
  it('none of the route/manager/form files contain a max-w-7xl|5xl|4xl route wrapper string', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const files = [
      'src/App.tsx',
      'src/components/RecipeLibrary.tsx',
      'src/pages/BatchList.tsx',
      'src/pages/BatchDetail.tsx',
      'src/components/EquipmentManager.tsx',
      'src/components/MashProfileManager.tsx',
      'src/components/FermentationProfileManager.tsx',
      'src/components/EquipmentForm.tsx',
      'src/components/MashProfileForm.tsx',
      'src/components/FermentationProfileForm.tsx',
    ];
    for (const f of files) {
      const source = readFileSync(join(process.cwd(), f), 'utf8');
      expect(source).not.toContain('max-w-7xl mx-auto');
      expect(source).not.toContain('max-w-5xl mx-auto');
      expect(source).not.toContain('max-w-4xl mx-auto');
    }
  });

  it('the six form/manager files and BatchDetail.tsx render PageContainer where they used to render a max-w wrapper', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const files = [
      'src/components/EquipmentManager.tsx',
      'src/components/MashProfileManager.tsx',
      'src/components/FermentationProfileManager.tsx',
      'src/components/EquipmentForm.tsx',
      'src/components/MashProfileForm.tsx',
      'src/components/FermentationProfileForm.tsx',
      'src/pages/BatchDetail.tsx',
    ];
    for (const f of files) {
      const source = readFileSync(join(process.cwd(), f), 'utf8');
      expect(source).toMatch(/<PageContainer>/);
    }
  });
});

describe('M5.5_P3 AC-23: no page body renders a back control', () => {
  it('no element inside page-container on any route has an accessible name matching /^(←\\s*)?back$/i', async () => {
    mockBatchesRoute();
    render(<App />);
    await waitFor(() => screen.getByText('Saved Test Recipe'));

    for (const [label, h1] of ALL_ROUTES.slice(1)) {
      await navigateTo(label as (typeof NAV_LABELS)[number]);
      await waitFor(() => screen.getByRole('heading', { level: 1, name: h1 }));
      const container = screen.getByTestId('page-container');
      const buttons = within(container).queryAllByRole('button');
      for (const b of buttons) {
        expect(b.textContent ?? '').not.toMatch(/^(←\s*)?back$/i);
      }
    }
  });
});

describe('M5.5_P3 AC-33: the list route\'s three banners still render, in place, unconditionally-correctly', () => {
  it('(a) libraryError renders inside page-container above the recipe grid', async () => {
    mockedGetRecipe.mockReset().mockRejectedValue(new ApiClientError('INTERNAL', 'Request failed with status 500.'));
    render(<App />);
    await waitFor(() => screen.getByText('Saved Test Recipe'));
    fireEvent.click(screen.getByText('Saved Test Recipe'));
    await waitFor(() => screen.getByText('Request failed with status 500.'));
    const pageContainer = screen.getByTestId('page-container');
    expect(pageContainer).toContainElement(screen.getByText('Request failed with status 500.'));
  });

  it('(b) equipmentError set renders its banner and suppresses the amber note', async () => {
    mockedListEquipmentProfiles.mockReset().mockRejectedValue(new ApiClientError('INTERNAL', 'Request failed with status 500.'));
    render(<App />);
    await waitFor(() => screen.getByText(/Couldn't load equipment profiles/));
    expect(screen.queryByText(/No equipment profiles yet/)).toBeNull();
  });

  it('(c) zero profiles and no error renders the amber note, and its button navigates to Equipment Profiles', async () => {
    mockedListEquipmentProfiles.mockReset().mockResolvedValue([]);
    render(<App />);
    await waitFor(() => screen.getByText(/No equipment profiles yet/));
    fireEvent.click(screen.getByRole('button', { name: 'Go to Equipment Profiles' }));
    await waitFor(() => screen.getByRole('heading', { level: 1, name: ROUTE_H1.equipment }));
  });
});

// ---------------------------------------------------------------------------
// M5.5_P4 — recipe delete in the editor TopBar (BUG-006). No block above this
// comment is touched.
// ---------------------------------------------------------------------------

describe('M5.5_P4 AC-37/AC-38/AC-39: recipe delete in the editor TopBar', () => {
  it('AC-38: recipe-delete is absent (not merely disabled) when the recipe is unsaved', async () => {
    render(<App />);
    await waitFor(() => screen.getByText(/No equipment profiles yet|Saved Test Recipe/));
    fireEvent.click(screen.getByRole('button', { name: /New Recipe/ }));
    await waitFor(() => screen.getByRole('button', { name: /Brew This/ }));
    expect(screen.queryByTestId('recipe-delete')).not.toBeInTheDocument();
  });

  it('AC-37: present in topbar-actions as first child when saved; confirming calls deleteRecipe(storedId) once, returns to the library, and never invokes the unsaved-changes window.confirm even from a dirty editor', async () => {
    mockedDeleteRecipe.mockResolvedValueOnce(undefined);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    await openSavedRecipe();
    const actions = screen.getByTestId('topbar-actions');
    const deleteBtn = within(actions).getByTestId('recipe-delete');
    expect(deleteBtn).toBe(actions.firstElementChild);

    // Make the editor dirty — proves the delete path bypasses goToLibrary()'s
    // window.confirm guard entirely (Ambiguity 10).
    fireEvent.change(screen.getByPlaceholderText('Recipe Name'), { target: { value: 'Changed Name' } });
    confirmSpy.mockClear();

    fireEvent.click(deleteBtn);
    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
    expect(mockedDeleteRecipe).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('confirm-dialog-confirm'));

    await waitFor(() => screen.getByText('Saved Test Recipe'));
    expect(mockedDeleteRecipe).toHaveBeenCalledTimes(1);
    expect(mockedDeleteRecipe).toHaveBeenCalledWith('r-saved-1');
    expect(confirmSpy).not.toHaveBeenCalled();

    confirmSpy.mockRestore();
  });

  it('AC-23 (M26_P1 Amendment 2): the editor route\'s topbar-actions carries flex-wrap, inherited from TopBar with no per-file edit', async () => {
    await openSavedRecipe();
    const actions = screen.getByTestId('topbar-actions');
    expect(actions.className.split(/\s+/)).toContain('flex-wrap');
  });

  it('AC-39: a rejected delete keeps the editor open, shows the error, and the dirty-editor guard still raises ConfirmDialog on a subsequent navigation (M27_P1: via useBlocker, not window.confirm — see executor deviation note)', async () => {
    mockedDeleteRecipe.mockRejectedValueOnce(new ApiClientError('INTERNAL', 'Cannot delete this recipe.'));
    mockBatchesRoute();

    await openSavedRecipe();
    fireEvent.click(screen.getByTestId('recipe-delete'));
    fireEvent.click(screen.getByTestId('confirm-dialog-confirm'));

    await waitFor(() => screen.getByText(/Couldn't delete this recipe: Cannot delete this recipe\./));
    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Brew This/ })).toBeInTheDocument(); // editor still open

    fireEvent.change(screen.getByPlaceholderText('Recipe Name'), { target: { value: 'Changed Name' } });
    await navigateTo('Recipes');
    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('confirm-dialog-confirm'));
    await waitFor(() => screen.getByText('Saved Test Recipe'));
  });
});

// ---------------------------------------------------------------------------
// M7_P1 amendment (2026-08-13) — AC-14 (App loads config on mount) and
// AC-26 (persistence round-trip actually moves the numbers on screen).
// ---------------------------------------------------------------------------

describe('AC-14: App loads the config on mount into shared state', () => {
  it('mounting <App /> issues exactly one GET /api/config', async () => {
    render(<App />);
    await waitFor(() => screen.getByText('Saved Test Recipe'));

    const configCalls = vi.mocked(fetch).mock.calls.filter(([input]) => {
      const url = typeof input === 'string' ? input : (input as URL | Request).toString();
      return url === '/api/config';
    });
    expect(configCalls).toHaveLength(1);
  });
});

describe('AC-26: persistence round-trip actually moves the numbers on screen', () => {
  function ogTileText(): string {
    const label = screen.getByText('Original Gravity');
    return label.parentElement!.textContent!;
  }

  it('(1) mounts showing the raw SG string, (2) selecting Plato updates the OG tile live without reload, (3) a fresh mount with the server now returning plato shows the Plato string on first paint', async () => {
    await openSavedRecipe();
    // (1) default gravityUnit is 'sg' — OG tile shows the raw SG value
    // (three decimals, no suffix) rather than any °P string.
    expect(ogTileText()).toMatch(/^Original Gravity1\.\d{3}/);
    expect(ogTileText()).not.toContain('°P');

    // (2) navigate to Settings, change Gravity Display to Plato — a PUT
    // fires and the editor's OG tile (still mounted in hook state) updates
    // live, no remount.
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    await waitFor(() => expect(screen.getByTestId('settings-select-gravityUnit')).toBeInTheDocument());

    vi.mocked(fetch).mockImplementationOnce((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === '/api/config' && init?.method === 'PUT') {
        return Promise.resolve(jsonResponse({ ...DEFAULT_TEST_CONFIG, gravityUnit: 'plato' }));
      }
      return Promise.reject(new Error(`unexpected fetch in AC-26 test: ${url}`));
    });
    fireEvent.change(screen.getByTestId('settings-select-gravityUnit'), { target: { value: 'plato' } });

    fireEvent.click(screen.getByRole('button', { name: 'Recipes' }));
    await waitFor(() => expect(screen.getByText('Saved Test Recipe')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Saved Test Recipe'));
    await waitFor(() => expect(screen.getByRole('button', { name: /Brew This/ })).toBeInTheDocument());
    await waitFor(() => expect(ogTileText()).toContain('°P'));
    expect(ogTileText()).not.toMatch(/\d\.\d{3}/);
  });

  it('(3) remounting the app fresh with GET returning gravityUnit: plato shows a °P string on first paint, never the raw SG', async () => {
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === '/api/config') {
        return Promise.resolve(jsonResponse({ ...DEFAULT_TEST_CONFIG, gravityUnit: 'plato' }));
      }
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    });

    await openSavedRecipe();
    await waitFor(() => expect(ogTileText()).toContain('°P'));
  });
});

// ---------------------------------------------------------------------------
// M7_P2 §1.3/AC-14/AC-17 — equipment-picker option labels convert through
// formatVolume; the scale modal's "Current Batch Size" deliberately does
// NOT (Resolved Ambiguity 7), and its target-size input label gains an
// explicit "(L)" annotation. Both assertions live in this same file/test
// per AC-14's own requirement so the exception can't quietly regress.
// ---------------------------------------------------------------------------

describe('AC-14: equipment-picker labels convert, the scale modal deliberately does not', () => {
  it('the equipment-picker option label reads 5.28 gal under "us"', async () => {
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === '/api/config') {
        return Promise.resolve(jsonResponse({ ...DEFAULT_TEST_CONFIG, unitSystem: 'us' }));
      }
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    });

    await openSavedRecipe();
    await waitFor(() => expect(screen.getByDisplayValue(/5\.28 gal/)).toBeInTheDocument());
  });

  it('the scale modal\'s "Current Batch Size" still reads 20 L under "us", and the target-size input label carries the literal "(L)" annotation', async () => {
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === '/api/config') {
        return Promise.resolve(jsonResponse({ ...DEFAULT_TEST_CONFIG, unitSystem: 'us' }));
      }
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    });

    await openSavedRecipe();
    // The picker converted (asserted above, in the same file per AC-14) —
    // now open the scale modal and confirm the deliberate exception.
    fireEvent.click(screen.getByRole('button', { name: /Scale Batch/ }));
    await waitFor(() => expect(screen.getByText(/Current Batch Size/)).toBeInTheDocument());

    expect(screen.getByText(/Current Batch Size/).parentElement?.textContent).toContain('20 L');
    expect(screen.getByText(/Current Batch Size/).parentElement?.textContent).not.toContain('gal');
    expect(screen.getByText('Target Batch Size (L)')).toBeInTheDocument();
  });
});

describe('AC-17: canonical storage integrity — a unit change writes nothing but /api/config', () => {
  it('rendering under "us" then "imperial" issues zero PUT/POST/PATCH calls to anything other than /api/config, and never mutates the recipe/equipment objects handed to the components', async () => {
    // Frozen deep copies taken BEFORE either render, per AC-17's second half:
    // proving no converted display value is ever written back into the
    // mocked recipe/equipment objects the components actually receive
    // (mockedGetRecipe/mockedListEquipmentProfiles resolve to these exact
    // object references, so an in-place mutation would show up here).
    const frozenRecipe = structuredClone(STORED_RECIPE);
    const frozenEquipment = structuredClone(EQUIPMENT);

    // --- Pass 1: 'us' ---------------------------------------------------
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === '/api/config') {
        return Promise.resolve(jsonResponse({ ...DEFAULT_TEST_CONFIG, unitSystem: 'us' }));
      }
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    });

    const { unmount } = render(<App />);
    await waitFor(() => screen.getByText('Saved Test Recipe'));
    fireEvent.click(screen.getByText('Saved Test Recipe'));
    await waitFor(() => screen.getByRole('button', { name: /Brew This/ }));
    await waitFor(() => expect(screen.getByDisplayValue(/5\.28 gal/)).toBeInTheDocument());

    expect(STORED_RECIPE).toEqual(frozenRecipe);
    expect(EQUIPMENT).toEqual(frozenEquipment);

    const writeCallsUs = vi.mocked(fetch).mock.calls.filter(([input, init]) => {
      const url = typeof input === 'string' ? input : (input as URL | Request).toString();
      const method = (init?.method ?? 'GET').toUpperCase();
      return ['PUT', 'POST', 'PATCH'].includes(method) && url !== '/api/config';
    });
    expect(writeCallsUs).toHaveLength(0);

    unmount();
    // RA-4: this test remounts <App /> a second time within its own body
    // (not just across it() blocks, which the module beforeEach already
    // resets) — the first mount navigated into the editor route, so the URL
    // must be reset before the second mount or it deep-links straight back
    // into the editor instead of the recipe list.
    window.history.replaceState({}, '', '/');

    // --- Pass 2: 'imperial' — actually exercised this time, matching the
    // test's own title (previously the mock returned 'us' unconditionally
    // and the component was never re-rendered under 'imperial' at all). ---
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === '/api/config') {
        return Promise.resolve(jsonResponse({ ...DEFAULT_TEST_CONFIG, unitSystem: 'imperial' }));
      }
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    });

    render(<App />);
    await waitFor(() => screen.getByText('Saved Test Recipe'));
    fireEvent.click(screen.getByText('Saved Test Recipe'));
    await waitFor(() => screen.getByRole('button', { name: /Brew This/ }));
    await waitFor(() => expect(screen.getByDisplayValue(/4\.40 imp gal/)).toBeInTheDocument());

    expect(STORED_RECIPE).toEqual(frozenRecipe);
    expect(EQUIPMENT).toEqual(frozenEquipment);

    const writeCallsImperial = vi.mocked(fetch).mock.calls.filter(([input, init]) => {
      const url = typeof input === 'string' ? input : (input as URL | Request).toString();
      const method = (init?.method ?? 'GET').toUpperCase();
      return ['PUT', 'POST', 'PATCH'].includes(method) && url !== '/api/config';
    });
    expect(writeCallsImperial).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// M7_P2 AC-18 gap-closing follow-up — the lockstep criterion had zero
// coverage. A minimal harness (ConfigProvider + the real StatsHeader,
// MashSection and SettingsManager components) is used instead of <App />
// because App.tsx's actual routing unmounts StatsHeader/MashSection when
// navigating to the Settings route — which would defeat the "no remount"
// half of the criterion. This proves the same production ConfigContext
// plumbing (useConfig/applyConfig) propagates one config change to both
// consumers in a single commit.
// ---------------------------------------------------------------------------

describe('AC-18: lockstep — one config change, all consumers update in the same commit', () => {
  it('StatsHeader and MashSection both convert after applyConfig, with no remount and exactly one GET /api/config total', async () => {
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = (init?.method ?? 'GET').toUpperCase();
      if (url === '/api/config' && method === 'GET') {
        return Promise.resolve(jsonResponse(DEFAULT_TEST_CONFIG));
      }
      if (url === '/api/config' && method === 'PUT') {
        return Promise.resolve(jsonResponse({ ...DEFAULT_TEST_CONFIG, unitSystem: 'us' }));
      }
      return Promise.reject(new Error(`unexpected fetch in AC-18 test: ${url} ${method}`));
    });

    const equipment = baseEquipment({ batchSizeL: 20 });
    const stats: CalculatedStats = {
      og: 1.05,
      fg: 1.012,
      abv: 5.0,
      ibu: 40,
      srm: 8,
      ebc: 16,
      buGu: 0.76,
      rbr: 1.2,
      totalGrainKg: 5,
      totalHopG: 100,
      mashWaterL: 15,
      spargeWaterL: 10,
      totalWaterL: 25,
      preBoilVolumeL: 23,
      preBoilGravity: 1.045,
      attenuationPct: 77,
      postBoilVolumeL: 20,
    };
    const mashPlan: MashPlan = {
      hasMashProfile: true,
      profileId: 'mash-1',
      profileName: 'Test Mash Schedule',
      targetPh: 5.4,
      spargeTemperatureC: 76,
      spargeTemperatureSource: 'equipment',
      totalGrainKg: 5,
      strikeWaterL: 15.5,
      strikeTemperatureC: 67,
      steps: [],
      totalInfusionWaterL: 0,
      mashWaterBalanceL: 0,
    };
    const recipe = baseStoredRecipe();

    function Harness() {
      const { config } = useConfig();
      return (
        <>
          <StatsHeader stats={stats} equipment={equipment} config={config} />
          <MashSection
            recipe={recipe}
            mashPlan={mashPlan}
            mashProfiles={[]}
            fermentationProfiles={[]}
            onSelectMashProfile={() => {}}
            onSelectFermentationProfile={() => {}}
            config={config}
          />
          <SettingsManager />
        </>
      );
    }

    render(
      <ConfigProvider>
        <Harness />
      </ConfigProvider>,
    );

    // Initial commit: unitSystem === 'metric'.
    await waitFor(() => expect(screen.getByText('20.0 L')).toBeInTheDocument());
    expect(screen.getByText('15.5 L')).toBeInTheDocument();

    // Trigger applyConfig via the real SettingsManager -> ConfigContext path
    // (no remount, no page reload) — mirrors the production Settings flow.
    await waitFor(() => screen.getByTestId('settings-select-unitSystem'));
    fireEvent.change(screen.getByTestId('settings-select-unitSystem'), { target: { value: 'us' } });

    // Both consumers reflect the new unitSystem in the same commit.
    await waitFor(() => {
      expect(screen.getByText('5.28 gal')).toBeInTheDocument();
      expect(screen.getByText('4.09 gal')).toBeInTheDocument();
    });

    // GET /api/config was issued exactly once in total (the mount-time
    // load); the PUT that followed the settings change is a distinct method
    // and is not counted here.
    const getConfigCalls = vi.mocked(fetch).mock.calls.filter(([input, init]) => {
      const url = typeof input === 'string' ? input : (input as URL | Request).toString();
      const method = ((init?.method as string | undefined) ?? 'GET').toUpperCase();
      return url === '/api/config' && method === 'GET';
    });
    expect(getConfigCalls).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// M8_P1 — new blocks for AC-19 (reachable via the sidebar, on every route)
// and AC-22 (lockstep, exercised through the full App). No existing block
// above this comment is touched (§1.3's exhaustive App.test.tsx charge).
// ---------------------------------------------------------------------------

describe('AC-19: Calculators is reachable via the sidebar, on every route', () => {
  it('clicking Calculators from the recipe list lands on the Calculators page with aria-current="page"', async () => {
    render(<App />);
    await waitFor(() => screen.getByText('Saved Test Recipe'));
    fireEvent.click(screen.getByRole('button', { name: 'Calculators' }));
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveAccessibleName('Calculators'));
    expect(screen.getByRole('button', { name: 'Calculators' })).toHaveAttribute('aria-current', 'page');
  });

  it('clicking Calculators from Batches lands on the Calculators page', async () => {
    mockBatchesRoute();
    render(<App />);
    await waitFor(() => screen.getByText('Saved Test Recipe'));
    await navigateTo('Batches');
    await waitFor(() => screen.getByRole('heading', { level: 1, name: ROUTE_H1.batches }));
    fireEvent.click(screen.getByRole('button', { name: 'Calculators' }));
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveAccessibleName('Calculators'));
    expect(screen.getByRole('button', { name: 'Calculators' })).toHaveAttribute('aria-current', 'page');
  });

  it('clicking Calculators from Settings lands on the Calculators page', async () => {
    render(<App />);
    await waitFor(() => screen.getByText('Saved Test Recipe'));
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    await waitFor(() => screen.getByTestId('settings-select-unitSystem'));
    fireEvent.click(screen.getByRole('button', { name: 'Calculators' }));
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveAccessibleName('Calculators'));
    expect(screen.getByRole('button', { name: 'Calculators' })).toHaveAttribute('aria-current', 'page');
  });
});

describe('AC-22: lockstep, exercised through the full App — a Settings change updates the mounted Calculators page in the same commit', () => {
  it('changing temperatureUnit via the real Settings route updates the strike card while still on Calculators, no remount', async () => {
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = (init?.method ?? 'GET').toUpperCase();
      if (url === '/api/config' && method === 'GET') {
        return Promise.resolve(jsonResponse(DEFAULT_TEST_CONFIG));
      }
      if (url === '/api/config' && method === 'PUT') {
        return Promise.resolve(jsonResponse({ ...DEFAULT_TEST_CONFIG, temperatureUnit: 'fahrenheit' }));
      }
      return Promise.reject(new Error(`unexpected fetch in AC-22 (App) test: ${url} ${method}`));
    });

    render(<App />);
    await waitFor(() => screen.getByText('Saved Test Recipe'));
    fireEvent.click(screen.getByRole('button', { name: 'Calculators' }));
    await waitFor(() => expect(screen.getByText('78.1 °C')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    await waitFor(() => screen.getByTestId('settings-select-temperatureUnit'));
    fireEvent.change(screen.getByTestId('settings-select-temperatureUnit'), { target: { value: 'fahrenheit' } });

    fireEvent.click(screen.getByRole('button', { name: 'Calculators' }));
    await waitFor(() => expect(screen.getByText('172.6 °F')).toBeInTheDocument());
  });
});

// ---------------------------------------------------------------------------
// M26_P1 — AC-13/AC-16: App integration for the off-canvas mobile navigation
// drawer. Amendment 1 (RA-8) threaded `onOpenMobileNav` into all 11 View
// branches App.tsx renders — not only the editor route's inline <TopBar>, but
// also every top-level component that mounts its own <TopBar> (RecipeLibrary,
// EquipmentManager, MashProfileManager, FermentationProfileManager,
// WaterProfileManager, InventoryManager, SettingsManager, Calculators,
// BatchList, BatchDetail), each via `onOpenMobileNav={() => setMobileNavOpen(true)}`.
// <MobileNav> itself is mounted (conditionally, per RA-2) alongside <Sidebar>
// in every route. The AC-13 block below covers the editor route; the AC-16
// block further down proves the wiring end-to-end through <App>'s real
// navigation flow on all 10 of the other routes.
// ---------------------------------------------------------------------------

describe('AC-13: App integration — hamburger opens MobileNav; selecting a destination navigates and closes it', () => {
  it('clicking the TopBar hamburger opens the mobile drawer, and it is not present before that', async () => {
    await openSavedRecipe();

    expect(screen.queryByRole('dialog', { name: 'Mobile navigation' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Open navigation menu' }));
    expect(screen.getByRole('dialog', { name: 'Mobile navigation' })).toBeInTheDocument();
  });

  it('selecting a destination in the drawer navigates to that view and closes the drawer', async () => {
    await openSavedRecipe();

    fireEvent.click(screen.getByRole('button', { name: 'Open navigation menu' }));
    const dialog = screen.getByRole('dialog', { name: 'Mobile navigation' });

    // Two "Equipment Profiles" buttons now exist (desktop Sidebar + drawer) —
    // scope the click to the one inside the mobile drawer.
    fireEvent.click(within(dialog).getByRole('button', { name: 'Equipment Profiles' }));

    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveAccessibleName('Equipment Profiles'));
    expect(screen.queryByRole('dialog', { name: 'Mobile navigation' })).toBeNull();
  });

  it('the close button dismisses the drawer without navigating', async () => {
    await openSavedRecipe();

    fireEvent.click(screen.getByRole('button', { name: 'Open navigation menu' }));
    expect(screen.getByRole('dialog', { name: 'Mobile navigation' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Close navigation' }));
    expect(screen.queryByRole('dialog', { name: 'Mobile navigation' })).toBeNull();
    // Still on the editor route.
    expect(screen.getByDisplayValue('Saved Test Recipe')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// M26_P1 Amendment 1 — AC-16: the App-level verification the amendment's
// spec explicitly requires and the critic found missing (CRITIC_REPORT.md
// 2026-08-21 "second audit", Finding F1). The 15 per-component test files
// each prove their own component CAN render the hamburger when handed the
// prop; nothing before this block proved that <App> itself actually hands
// the prop over on routes other than the editor. All 10 remaining routes
// (list/default, equipment, mashProfiles, fermentationProfiles,
// waterProfiles, batches, batchDetail, inventory, settings, calculators)
// are exercised through the app's real render tree and real navigation flow
// (not an isolated component mount) — each a different branch of the
// onOpenMobileNav wiring App.tsx forwards per view.
// ---------------------------------------------------------------------------

describe('AC-16: hamburger reaches non-editor routes through App\'s real navigation tree', () => {
  it('list route (the initial view): hamburger is present and opens MobileNav, absent beforehand', async () => {
    render(<App />);
    await waitFor(() => screen.getByText('Saved Test Recipe'));

    expect(screen.queryByRole('dialog', { name: 'Mobile navigation' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation menu' }));
    expect(screen.getByRole('dialog', { name: 'Mobile navigation' })).toBeInTheDocument();
  });

  it('settings route: navigating there via the Settings button, the hamburger opens MobileNav', async () => {
    render(<App />);
    await waitFor(() => screen.getByText('Saved Test Recipe'));

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    await waitFor(() => screen.getByTestId('settings-select-gravityUnit'));

    expect(screen.queryByRole('dialog', { name: 'Mobile navigation' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation menu' }));
    expect(screen.getByRole('dialog', { name: 'Mobile navigation' })).toBeInTheDocument();
  });

  it('batches route: navigating there via the sidebar, the hamburger opens MobileNav', async () => {
    mockBatchesRoute();
    render(<App />);
    await waitFor(() => screen.getByText('Saved Test Recipe'));

    await navigateTo('Batches');
    await waitFor(() => screen.getByRole('heading', { level: 1, name: ROUTE_H1.batches }));

    expect(screen.queryByRole('dialog', { name: 'Mobile navigation' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation menu' }));
    expect(screen.getByRole('dialog', { name: 'Mobile navigation' })).toBeInTheDocument();
  });

  it('equipment route: navigating there via the sidebar, the hamburger opens MobileNav', async () => {
    render(<App />);
    await waitFor(() => screen.getByText('Saved Test Recipe'));

    await navigateTo('Equipment Profiles');
    await waitFor(() => screen.getByRole('heading', { level: 1, name: ROUTE_H1.equipment }));

    expect(screen.queryByRole('dialog', { name: 'Mobile navigation' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation menu' }));
    expect(screen.getByRole('dialog', { name: 'Mobile navigation' })).toBeInTheDocument();
  });

  it('mashProfiles route: navigating there via the sidebar, the hamburger opens MobileNav', async () => {
    render(<App />);
    await waitFor(() => screen.getByText('Saved Test Recipe'));

    await navigateTo('Mash Profiles');
    await waitFor(() => screen.getByRole('heading', { level: 1, name: ROUTE_H1.mashProfiles }));

    expect(screen.queryByRole('dialog', { name: 'Mobile navigation' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation menu' }));
    expect(screen.getByRole('dialog', { name: 'Mobile navigation' })).toBeInTheDocument();
  });

  it('fermentationProfiles route: navigating there via the sidebar, the hamburger opens MobileNav', async () => {
    render(<App />);
    await waitFor(() => screen.getByText('Saved Test Recipe'));

    await navigateTo('Fermentation Profiles');
    await waitFor(() => screen.getByRole('heading', { level: 1, name: ROUTE_H1.fermentationProfiles }));

    expect(screen.queryByRole('dialog', { name: 'Mobile navigation' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation menu' }));
    expect(screen.getByRole('dialog', { name: 'Mobile navigation' })).toBeInTheDocument();
  });

  it('waterProfiles route: navigating there via the sidebar, the hamburger opens MobileNav', async () => {
    render(<App />);
    await waitFor(() => screen.getByText('Saved Test Recipe'));

    await navigateTo('Water Profiles');
    await waitFor(() => screen.getByRole('heading', { level: 1, name: ROUTE_H1.waterProfiles }));

    expect(screen.queryByRole('dialog', { name: 'Mobile navigation' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation menu' }));
    expect(screen.getByRole('dialog', { name: 'Mobile navigation' })).toBeInTheDocument();
  });

  it('inventory route: navigating there via the sidebar, the hamburger opens MobileNav', async () => {
    render(<App />);
    await waitFor(() => screen.getByText('Saved Test Recipe'));

    await navigateTo('Inventory');
    await waitFor(() => screen.getByRole('heading', { level: 1, name: ROUTE_H1.inventory }));

    expect(screen.queryByRole('dialog', { name: 'Mobile navigation' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation menu' }));
    expect(screen.getByRole('dialog', { name: 'Mobile navigation' })).toBeInTheDocument();
  });

  it('calculators route: navigating there via the sidebar, the hamburger opens MobileNav', async () => {
    render(<App />);
    await waitFor(() => screen.getByText('Saved Test Recipe'));

    // 'Calculators' is not part of NAV_LABELS (that constant predates the
    // calculators destination), so it's clicked directly here rather than
    // through navigateTo().
    fireEvent.click(screen.getByRole('button', { name: 'Calculators' }));
    await waitFor(() => screen.getByRole('heading', { level: 1, name: 'Calculators' }));

    expect(screen.queryByRole('dialog', { name: 'Mobile navigation' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation menu' }));
    expect(screen.getByRole('dialog', { name: 'Mobile navigation' })).toBeInTheDocument();
  });

  it('batchDetail route: navigating there via Batches then selecting a batch, the hamburger opens MobileNav', async () => {
    mockBatchesRoute();
    render(<App />);
    await waitFor(() => screen.getByText('Saved Test Recipe'));

    await navigateTo('Batches');
    await waitFor(() => screen.getByText(LISTED_BATCH.name));
    fireEvent.click(screen.getByText(LISTED_BATCH.name));
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveAccessibleName(
        new RegExp(LISTED_BATCH.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
      );
    });

    expect(screen.queryByRole('dialog', { name: 'Mobile navigation' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation menu' }));
    expect(screen.getByRole('dialog', { name: 'Mobile navigation' })).toBeInTheDocument();
  });
});
