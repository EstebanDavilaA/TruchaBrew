import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import type { UserConfig } from '@truchabrew/shared-types';
import { RecipeLibrary } from '../src/components/RecipeLibrary';
import { ConfigProvider } from '../src/context/ConfigContext';
import { ApiClientError } from '../src/api/client';

vi.mock('../src/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/api/client')>();
  return {
    ...actual,
    listRecipes: vi.fn(),
    duplicateRecipe: vi.fn(),
    importBrewfatherRecipes: vi.fn(),
  };
});

import { listRecipes, importBrewfatherRecipes } from '../src/api/client';

const mockedListRecipes = vi.mocked(listRecipes);
const mockedImportBrewfatherRecipes = vi.mocked(importBrewfatherRecipes);

// M7_P2 §1.3/Ambiguity 9 — RecipeLibrary now reads config via useConfig(),
// so every render is wrapped in a real ConfigProvider (same fetch-stub
// pattern BatchDetail.test.tsx established). Defaults to 'metric' unless a
// test overrides it via renderLibrary's third argument.
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

function stubConfigFetch(config: Partial<UserConfig> = {}) {
  const testConfig = { ...DEFAULT_TEST_CONFIG, ...config };
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === '/api/config') return Promise.resolve(jsonResponse(testConfig));
      return Promise.reject(new Error(`Unexpected global fetch call in RecipeLibrary.test.tsx: ${url}`));
    }),
  );
}

beforeEach(() => {
  mockedListRecipes.mockReset();
  mockedImportBrewfatherRecipes.mockReset();
  stubConfigFetch();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AC-44: failed list load shows an error, not an empty state', () => {
  it('renders an error panel with Retry, and never the "no recipes yet" empty state, when GET /api/recipes returns 500', async () => {
    mockedListRecipes.mockRejectedValue(new ApiClientError('INTERNAL', 'Request failed with status 500.'));

    render(
      <ConfigProvider><RecipeLibrary onOpen={vi.fn()} onOpenError={vi.fn()} onNew={vi.fn()} canCreate={true} /></ConfigProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("Couldn't load your recipes")).toBeInTheDocument();
    });
    expect(screen.getByText('Request failed with status 500.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();

    expect(screen.queryByText(/no recipes yet/i)).not.toBeInTheDocument();
  });
});

describe('M5.5_P3 AC-14: the recipe search input is in TopBar\'s search slot, not a body card', () => {
  it('the input is a descendant of [data-testid="topbar-search"] and not of [data-testid="page-container"]', async () => {
    mockedListRecipes.mockResolvedValue([]);
    render(
      <ConfigProvider><RecipeLibrary onOpen={vi.fn()} onOpenError={vi.fn()} onNew={vi.fn()} canCreate={true} /></ConfigProvider>,
    );
    await waitFor(() => screen.getByPlaceholderText('Search by name or style…'));
    const input = screen.getByPlaceholderText('Search by name or style…');
    const searchSlot = screen.getByTestId('topbar-search');
    const pageContainer = screen.getByTestId('page-container');
    expect(searchSlot).toContainElement(input);
    expect(pageContainer).not.toContainElement(input);
  });
});

describe('M5.5_P3 AC-15: + New Recipe is in TopBar\'s action slot', () => {
  it('the button named New Recipe is a descendant of topbar-actions and not of page-container', async () => {
    mockedListRecipes.mockResolvedValue([]);
    render(
      <ConfigProvider><RecipeLibrary onOpen={vi.fn()} onOpenError={vi.fn()} onNew={vi.fn()} canCreate={true} /></ConfigProvider>,
    );
    await waitFor(() => screen.getByTestId('page-container'));
    const button = screen.getByRole('button', { name: /New Recipe/ });
    const actionsSlot = screen.getByTestId('topbar-actions');
    const pageContainer = screen.getByTestId('page-container');
    expect(actionsSlot).toContainElement(button);
    expect(pageContainer).not.toContainElement(button);
  });
});

describe('M5.5_P3 AC-16: the library\'s floating control card is gone', () => {
  it('no ancestor element (other than TopBar\'s own header/flex row) is shared by the search input and the New Recipe button', async () => {
    mockedListRecipes.mockResolvedValue([]);
    const { container } = render(
      <ConfigProvider><RecipeLibrary onOpen={vi.fn()} onOpenError={vi.fn()} onNew={vi.fn()} canCreate={true} /></ConfigProvider>,
    );
    await waitFor(() => screen.getByTestId('page-container'));
    expect(container.innerHTML).not.toContain(
      'bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg mb-6 flex flex-wrap items-center justify-between',
    );
    const input = screen.getByPlaceholderText('Search by name or style…');
    const button = screen.getByRole('button', { name: /New Recipe/ });
    // Their nearest common ancestor must be TopBar's own <header>, not a body card.
    const header = container.querySelector('header')!;
    expect(header).toContainElement(input);
    expect(header).toContainElement(button);
  });
});

describe('M5.5_P3 AC-25: canCreate semantics survive the move', () => {
  it('disabled + title when canCreate is false; neither when true', async () => {
    mockedListRecipes.mockResolvedValue([]);
    const { rerender } = render(
      <ConfigProvider><RecipeLibrary onOpen={vi.fn()} onOpenError={vi.fn()} onNew={vi.fn()} canCreate={false} /></ConfigProvider>,
    );
    await waitFor(() => screen.getByTestId('page-container'));
    let button = screen.getByRole('button', { name: /New Recipe/ });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('title', 'Create an equipment profile before starting a new recipe.');

    rerender(
      <ConfigProvider><RecipeLibrary onOpen={vi.fn()} onOpenError={vi.fn()} onNew={vi.fn()} canCreate={true} /></ConfigProvider>,
    );
    button = screen.getByRole('button', { name: /New Recipe/ });
    expect(button).not.toBeDisabled();
    expect(button).not.toHaveAttribute('title');
  });
});

describe('M5.5_P3 AC-28: recipe search still filters, with the same debounce and failure semantics', () => {
  it('typing calls listRecipes with the typed query after the 200ms debounce', async () => {
    mockedListRecipes.mockResolvedValue([]);
    const { fireEvent } = await import('@testing-library/react');
    render(
      <ConfigProvider><RecipeLibrary onOpen={vi.fn()} onOpenError={vi.fn()} onNew={vi.fn()} canCreate={true} /></ConfigProvider>,
    );
    const input = await screen.findByPlaceholderText('Search by name or style…');
    mockedListRecipes.mockClear();
    fireEvent.change(input, { target: { value: 'ipa' } });
    await waitFor(() => expect(mockedListRecipes).toHaveBeenCalledWith('ipa'), { timeout: 1000 });
  });
});

describe('M5.5_P3 AC-29: notices passthrough renders above the load-error panel, and is presentation-only', () => {
  it('renders the notices node as the first child inside PageContainer', async () => {
    mockedListRecipes.mockResolvedValue([]);
    render(
      <ConfigProvider>
        <RecipeLibrary
          onOpen={vi.fn()}
          onOpenError={vi.fn()}
          onNew={vi.fn()}
          canCreate={true}
          notices={<div data-testid="my-notice">A notice</div>}
        />
      </ConfigProvider>,
    );
    await waitFor(() => screen.getByTestId('page-container'));
    const pageContainer = screen.getByTestId('page-container');
    const notice = screen.getByTestId('my-notice');
    expect(pageContainer).toContainElement(notice);
    expect(pageContainer.firstElementChild).toBe(notice);
  });

  it('when notices is undefined, nothing extra renders in its place', async () => {
    mockedListRecipes.mockResolvedValue([]);
    render(
      <ConfigProvider><RecipeLibrary onOpen={vi.fn()} onOpenError={vi.fn()} onNew={vi.fn()} canCreate={true} /></ConfigProvider>,
    );
    await waitFor(() => screen.getByTestId('page-container'));
    expect(screen.queryByTestId('my-notice')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// M5.5_P4 — ListRow conversion (BUG-006 + BUG-007). No block above this
// comment is touched.
// ---------------------------------------------------------------------------

function summary(overrides: Partial<import('@truchabrew/shared-types').RecipeSummary> = {}) {
  return {
    id: 'r-1',
    name: 'Trucha IPA',
    author: 'Tester',
    styleName: '21A. American IPA',
    equipmentId: 'eq-1',
    equipmentName: 'Test Equipment',
    batchSizeL: 20,
    fermentableCount: 1,
    hopCount: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('M5.5_P4 AC-15/16/17: no inline edit/rename/delete controls remain', () => {
  it('renders zero -edit-/-delete- testids and zero Edit/Rename/Delete-titled controls, for 2+ recipes', async () => {
    mockedListRecipes.mockResolvedValue([summary({ id: 'r-1', name: 'One' }), summary({ id: 'r-2', name: 'Two' })]);
    const { container } = render(<ConfigProvider><RecipeLibrary onOpen={vi.fn()} onOpenError={vi.fn()} onNew={vi.fn()} canCreate={true} /></ConfigProvider>);
    await waitFor(() => screen.getByTestId('recipe-row-r-1'));
    expect(container.querySelectorAll('[data-testid$="-edit-r-1"], [data-testid$="-delete-r-1"]')).toHaveLength(0);
    expect(container.querySelectorAll('[title="Edit"], [title="Rename"], [title="Delete"]')).toHaveLength(0);
  });

  it('RecipeLibrary.tsx contains no occurrence of the removed symbols/imports', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const src = readFileSync(join(process.cwd(), 'src/components/RecipeLibrary.tsx'), 'utf8');
    for (const token of ['patchRecipeName', 'deleteRecipe', 'renamingId', 'renameValue', 'startRename', 'commitRename', 'Pencil', 'Trash2']) {
      expect(src).not.toContain(token);
    }
  });
});

describe('M5.5_P4 AC-21: row click opens the editor', () => {
  it('clicking a row calls onOpen exactly once with that recipe\'s id', async () => {
    mockedListRecipes.mockResolvedValue([summary({ id: 'r-1', name: 'One' })]);
    const onOpen = vi.fn().mockResolvedValue(undefined);
    render(<ConfigProvider><RecipeLibrary onOpen={onOpen} onOpenError={vi.fn()} onNew={vi.fn()} canCreate={true} /></ConfigProvider>);
    const row = await screen.findByTestId('recipe-row-r-1');
    const { fireEvent } = await import('@testing-library/react');
    fireEvent.click(row);
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledWith('r-1');
  });
});

describe('M5.5_P4 AC-18: Duplicate is retained and isolated from row activation', () => {
  it('renders exactly N Duplicate controls; clicking one calls duplicateRecipe(id) and not onOpen', async () => {
    mockedListRecipes.mockResolvedValue([summary({ id: 'r-1', name: 'One' }), summary({ id: 'r-2', name: 'Two' })]);
    const onOpen = vi.fn().mockResolvedValue(undefined);
    render(<ConfigProvider><RecipeLibrary onOpen={onOpen} onOpenError={vi.fn()} onNew={vi.fn()} canCreate={true} /></ConfigProvider>);
    await screen.findByTestId('recipe-row-r-1');
    const dupButtons = screen.getAllByTitle('Duplicate');
    expect(dupButtons).toHaveLength(2);

    const { fireEvent } = await import('@testing-library/react');
    const { duplicateRecipe } = await import('../src/api/client');
    const mockedDuplicate = vi.mocked(duplicateRecipe);
    mockedDuplicate.mockResolvedValueOnce({ id: 'r-1-copy' } as never);
    fireEvent.click(dupButtons[0]);
    expect(mockedDuplicate).toHaveBeenCalledWith('r-1');
    expect(onOpen).not.toHaveBeenCalled();
  });
});

describe('M5.5_P4 AC-24: recipe row data preservation', () => {
  it('displays name, style, equipment, batch size, and singular malt/hop counts', async () => {
    mockedListRecipes.mockResolvedValue([
      summary({ id: 'r-1', name: 'Singular Batch', styleName: '', fermentableCount: 1, hopCount: 1 }),
    ]);
    render(<ConfigProvider><RecipeLibrary onOpen={vi.fn()} onOpenError={vi.fn()} onNew={vi.fn()} canCreate={true} /></ConfigProvider>);
    const row = await screen.findByTestId('recipe-row-r-1');
    expect(row).toHaveTextContent('Singular Batch');
    expect(row).toHaveTextContent('No style set');
    expect(row).toHaveTextContent('Test Equipment');
    // M7_P2 §4 Deviation 1: batchSizeL now routes through formatVolume,
    // whose metric default is 1 fraction digit (was a bare `{batchSizeL} L`
    // before this phase) — "20 L" -> "20.0 L" under the default metric
    // config used by this test (renderLibrary defaults to unitSystem: 'metric').
    expect(row).toHaveTextContent('20.0 L');
    expect(row).toHaveTextContent('1 malt');
    expect(row).toHaveTextContent('1 hop');
  });

  it('displays plural malt/hop counts for a multi-malt/multi-hop fixture', async () => {
    mockedListRecipes.mockResolvedValue([
      summary({ id: 'r-2', name: 'Plural Batch', styleName: '21A. American IPA', fermentableCount: 3, hopCount: 4 }),
    ]);
    render(<ConfigProvider><RecipeLibrary onOpen={vi.fn()} onOpenError={vi.fn()} onNew={vi.fn()} canCreate={true} /></ConfigProvider>);
    const row = await screen.findByTestId('recipe-row-r-2');
    expect(row).toHaveTextContent('21A. American IPA');
    expect(row).toHaveTextContent('3 malts');
    expect(row).toHaveTextContent('4 hops');
  });
});

// ---------------------------------------------------------------------------
// M7_P2 §1.3/AC-13 — the library row meta figure converts through
// formatVolume per the active unit system; not 20 L under 'us'.
// ---------------------------------------------------------------------------

describe('AC-13: RecipeLibrary batch size converts', () => {
  it('renders 5.28 gal, not 20 L, under "us"', async () => {
    stubConfigFetch({ unitSystem: 'us' });
    mockedListRecipes.mockResolvedValue([summary({ id: 'r-1', batchSizeL: 20 })]);
    render(<ConfigProvider><RecipeLibrary onOpen={vi.fn()} onOpenError={vi.fn()} onNew={vi.fn()} canCreate={true} /></ConfigProvider>);
    const row = await screen.findByTestId('recipe-row-r-1');
    await waitFor(() => expect(row).toHaveTextContent('5.28 gal'));
    expect(row).not.toHaveTextContent('20 L');
  });

  it('renders 20.0 L under "metric"', async () => {
    stubConfigFetch({ unitSystem: 'metric' });
    mockedListRecipes.mockResolvedValue([summary({ id: 'r-1', batchSizeL: 20 })]);
    render(<ConfigProvider><RecipeLibrary onOpen={vi.fn()} onOpenError={vi.fn()} onNew={vi.fn()} canCreate={true} /></ConfigProvider>);
    const row = await screen.findByTestId('recipe-row-r-1');
    expect(row).toHaveTextContent('20.0 L');
  });
});

// ---------------------------------------------------------------------------
// M10_P1 — Brewfather JSON Ingestion UI
// ---------------------------------------------------------------------------

describe('M10_P1: Brewfather JSON Ingestion UI', () => {
  it('AC-14: renders "Import JSON" button in TopBar with hidden file input', async () => {
    mockedListRecipes.mockResolvedValue([]);
    render(
      <ConfigProvider>
        <RecipeLibrary onOpen={vi.fn()} onOpenError={vi.fn()} onNew={vi.fn()} canCreate={true} />
      </ConfigProvider>,
    );

    expect(screen.getByRole('button', { name: /import json/i })).toBeInTheDocument();
    const fileInput = screen.getByTestId('brewfather-file-input');
    expect(fileInput).toBeInTheDocument();
    expect(fileInput).toHaveAttribute('type', 'file');
    expect(fileInput).toHaveAttribute('accept', '.json,application/json');
  });

  it('AC-15: 1-Click File Upload flow calls API client and displays success notice', async () => {
    mockedListRecipes.mockResolvedValue([]);
    mockedImportBrewfatherRecipes.mockResolvedValue({
      importedCount: 2,
      recipes: [],
    });

    render(
      <ConfigProvider>
        <RecipeLibrary onOpen={vi.fn()} onOpenError={vi.fn()} onNew={vi.fn()} canCreate={true} />
      </ConfigProvider>,
    );

    const fileInput = screen.getByTestId('brewfather-file-input');
    const validJsonContent = JSON.stringify({ name: 'Test Recipe' });
    const file = new File([validJsonContent], 'recipes.json', { type: 'application/json' });

    // Trigger file change event
    const { fireEvent } = await import('@testing-library/react');
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(mockedImportBrewfatherRecipes).toHaveBeenCalled();
    });

    const banner = await screen.findByTestId('import-status-banner');
    expect(banner).toHaveTextContent(/successfully imported 2 recipes/i);
  });

  it('AC-16: failed upload error displays alert notice without crashing library view', async () => {
    mockedListRecipes.mockResolvedValue([]);
    mockedImportBrewfatherRecipes.mockRejectedValue(new ApiClientError('VALIDATION_FAILED', 'Invalid recipe structure'));

    render(
      <ConfigProvider>
        <RecipeLibrary onOpen={vi.fn()} onOpenError={vi.fn()} onNew={vi.fn()} canCreate={true} />
      </ConfigProvider>,
    );

    const fileInput = screen.getByTestId('brewfather-file-input');
    const validJsonContent = JSON.stringify({ invalid: true });
    const file = new File([validJsonContent], 'invalid.json', { type: 'application/json' });

    const { fireEvent } = await import('@testing-library/react');
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(mockedImportBrewfatherRecipes).toHaveBeenCalled();
    });

    const banner = await screen.findByTestId('import-status-banner');
    expect(banner).toHaveTextContent(/invalid recipe structure/i);
  });
});

describe('AC-19 (M26_P1 Amendment 2): Import JSON is icon-only below md with a stable accessible name', () => {
  it('the visible text is wrapped in an element with hidden + md:inline; aria-label matches idle/importing text; exactly one button resolves by name', async () => {
    mockedListRecipes.mockResolvedValue([]);
    render(
      <ConfigProvider>
        <RecipeLibrary onOpen={vi.fn()} onOpenError={vi.fn()} onNew={vi.fn()} canCreate={true} />
      </ConfigProvider>,
    );
    await waitFor(() => screen.getByTestId('page-container'));

    const button = screen.getByRole('button', { name: /import json/i });
    expect(button).toHaveAttribute('aria-label', 'Import JSON');

    const label = button.querySelector('span')!;
    expect(label).not.toBeNull();
    const labelTokens = label.className.split(/\s+/);
    expect(labelTokens).toContain('hidden');
    expect(labelTokens).toContain('md:inline');
    expect(label.textContent).toBe('Import JSON');

    expect(screen.getAllByRole('button', { name: /import json/i })).toHaveLength(1);
  });

  it('aria-label switches to "Importing…" while an import is in flight', async () => {
    mockedListRecipes.mockResolvedValue([]);
    let resolveImport: (value: { importedCount: number; recipes: never[] }) => void = () => {};
    mockedImportBrewfatherRecipes.mockImplementation(
      () => new Promise((resolve) => { resolveImport = resolve; }),
    );
    render(
      <ConfigProvider>
        <RecipeLibrary onOpen={vi.fn()} onOpenError={vi.fn()} onNew={vi.fn()} canCreate={true} />
      </ConfigProvider>,
    );
    await waitFor(() => screen.getByTestId('page-container'));

    const fileInput = screen.getByTestId('brewfather-file-input');
    const file = new File([JSON.stringify({ name: 'x' })], 'recipes.json', { type: 'application/json' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /importing/i })).toHaveAttribute('aria-label', 'Importing…');
    });
    // Wait for FileReader's async onload to actually invoke the mocked API
    // client before resolving — otherwise `resolveImport` may still be the
    // pre-call no-op assigned before mockImplementation's executor ran.
    await waitFor(() => expect(mockedImportBrewfatherRecipes).toHaveBeenCalled());

    resolveImport({ importedCount: 1, recipes: [] });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /import json/i })).toHaveAttribute('aria-label', 'Import JSON');
    });
  });

  it('the "New Recipe" button label carries no hidden/md: token', async () => {
    mockedListRecipes.mockResolvedValue([]);
    render(
      <ConfigProvider>
        <RecipeLibrary onOpen={vi.fn()} onOpenError={vi.fn()} onNew={vi.fn()} canCreate={true} />
      </ConfigProvider>,
    );
    await waitFor(() => screen.getByTestId('page-container'));
    const newRecipeButton = screen.getByRole('button', { name: /New Recipe/ });
    // RA-10: only the Import JSON button's label is wrapped in a hidden/md:inline
    // span; New Recipe's label stays a direct text node with no wrapper element.
    expect(newRecipeButton.querySelector('span')).toBeNull();
    expect(newRecipeButton.textContent).toContain('New Recipe');
  });
});

describe('AC-16 (M26_P1 Amendment 1): RecipeLibrary forwards onOpenMobileNav to its TopBar', () => {
  it('passing onOpenMobileNav renders the hamburger and clicking it calls the callback', async () => {
    mockedListRecipes.mockResolvedValue([]);
    const onOpenMobileNav = vi.fn();
    render(
      <ConfigProvider>
        <RecipeLibrary onOpen={vi.fn()} onOpenError={vi.fn()} onNew={vi.fn()} canCreate={true} onOpenMobileNav={onOpenMobileNav} />
      </ConfigProvider>,
    );
    await waitFor(() => screen.getByPlaceholderText('Search by name or style…'));
    const btn = screen.getByRole('button', { name: 'Open navigation menu' });
    fireEvent.click(btn);
    expect(onOpenMobileNav).toHaveBeenCalledTimes(1);
  });

  it('omitting onOpenMobileNav renders no hamburger button', async () => {
    mockedListRecipes.mockResolvedValue([]);
    render(
      <ConfigProvider>
        <RecipeLibrary onOpen={vi.fn()} onOpenError={vi.fn()} onNew={vi.fn()} canCreate={true} />
      </ConfigProvider>,
    );
    await waitFor(() => screen.getByPlaceholderText('Search by name or style…'));
    expect(screen.queryByRole('button', { name: 'Open navigation menu' })).toBeNull();
  });
});

describe('M29_P2 AC-3/AC-4: RecipeLibrary list row duplicate button accessibility', () => {
  it('duplicate button carries aria-label with recipe name, title="Duplicate", and is not disabled when idle', async () => {
    mockedListRecipes.mockResolvedValue([summary({ id: 'r-1', name: 'Trucha IPA' })]);
    render(
      <ConfigProvider>
        <RecipeLibrary onOpen={vi.fn()} onOpenError={vi.fn()} onNew={vi.fn()} canCreate={true} />
      </ConfigProvider>,
    );
    const duplicateButton = await screen.findByRole('button', { name: 'Duplicate "Trucha IPA"' });
    expect(duplicateButton).toBeInTheDocument();
    expect(duplicateButton.getAttribute('title')).toBe('Duplicate');
    expect(duplicateButton).not.toBeDisabled();
  });
});

describe('M38_P1 AC-11/AC-12: folder tab strip', () => {
  it('renders All, Unfiled, and dynamic folder tabs with counts derived from the loaded recipes', async () => {
    mockedListRecipes.mockResolvedValue([
      summary({ id: 'r-1', name: 'IPA One', folder: 'IPAs' }),
      summary({ id: 'r-2', name: 'IPA Two', folder: 'IPAs' }),
      summary({ id: 'r-3', name: 'Lager One', folder: 'Lagers' }),
      summary({ id: 'r-4', name: 'No Folder' }),
    ]);
    render(<ConfigProvider><RecipeLibrary onOpen={vi.fn()} onOpenError={vi.fn()} onNew={vi.fn()} canCreate={true} /></ConfigProvider>);
    await waitFor(() => screen.getByTestId('recipe-row-r-1'));

    expect(screen.getByTestId('folder-tab-__all__')).toHaveTextContent('All (4)');
    expect(screen.getByTestId('folder-tab-__unfiled__')).toHaveTextContent('Unfiled (1)');
    expect(screen.getByTestId('folder-tab-IPAs')).toHaveTextContent('IPAs (2)');
    expect(screen.getByTestId('folder-tab-Lagers')).toHaveTextContent('Lagers (1)');
  });

  it('clicking a folder tab narrows the visible rows to that folder only', async () => {
    mockedListRecipes.mockResolvedValue([
      summary({ id: 'r-1', name: 'IPA One', folder: 'IPAs' }),
      summary({ id: 'r-2', name: 'Lager One', folder: 'Lagers' }),
      summary({ id: 'r-3', name: 'No Folder' }),
    ]);
    render(<ConfigProvider><RecipeLibrary onOpen={vi.fn()} onOpenError={vi.fn()} onNew={vi.fn()} canCreate={true} /></ConfigProvider>);
    await waitFor(() => screen.getByTestId('recipe-row-r-1'));

    fireEvent.click(screen.getByTestId('folder-tab-IPAs'));

    expect(screen.getByTestId('recipe-row-r-1')).toBeInTheDocument();
    expect(screen.queryByTestId('recipe-row-r-2')).not.toBeInTheDocument();
    expect(screen.queryByTestId('recipe-row-r-3')).not.toBeInTheDocument();
  });

  it('clicking the Unfiled tab shows only recipes with no folder', async () => {
    mockedListRecipes.mockResolvedValue([
      summary({ id: 'r-1', name: 'IPA One', folder: 'IPAs' }),
      summary({ id: 'r-2', name: 'No Folder' }),
    ]);
    render(<ConfigProvider><RecipeLibrary onOpen={vi.fn()} onOpenError={vi.fn()} onNew={vi.fn()} canCreate={true} /></ConfigProvider>);
    await waitFor(() => screen.getByTestId('recipe-row-r-1'));

    fireEvent.click(screen.getByTestId('folder-tab-__unfiled__'));

    expect(screen.queryByTestId('recipe-row-r-1')).not.toBeInTheDocument();
    expect(screen.getByTestId('recipe-row-r-2')).toBeInTheDocument();
  });
});

describe('M38_P1 AC-13/AC-14: tag badges and tag filtering', () => {
  it('renders each tag as a Badge (variant="neutral" size="xs") per recipe row', async () => {
    mockedListRecipes.mockResolvedValue([summary({ id: 'r-1', name: 'Tagged', tags: ['Hazy', 'Citra'] })]);
    render(<ConfigProvider><RecipeLibrary onOpen={vi.fn()} onOpenError={vi.fn()} onNew={vi.fn()} canCreate={true} /></ConfigProvider>);
    await waitFor(() => screen.getByTestId('recipe-row-r-1'));

    const tagContainer = screen.getByTestId('recipe-tags-r-1');
    expect(tagContainer).toHaveTextContent('Hazy');
    expect(tagContainer).toHaveTextContent('Citra');
  });

  it('clicking a tag badge filters the library to recipes with that tag, and shows a dismissible active filter chip', async () => {
    mockedListRecipes.mockResolvedValue([
      summary({ id: 'r-1', name: 'Has Citra', tags: ['Citra'] }),
      summary({ id: 'r-2', name: 'No Citra', tags: ['Mosaic'] }),
    ]);
    render(<ConfigProvider><RecipeLibrary onOpen={vi.fn()} onOpenError={vi.fn()} onNew={vi.fn()} canCreate={true} /></ConfigProvider>);
    await waitFor(() => screen.getByTestId('recipe-row-r-1'));

    fireEvent.click(screen.getByText('Citra'));

    expect(screen.getByTestId('recipe-row-r-1')).toBeInTheDocument();
    expect(screen.queryByTestId('recipe-row-r-2')).not.toBeInTheDocument();

    const activeChip = screen.getByTestId('active-tag-filter-badge');
    expect(activeChip).toHaveTextContent('Citra');

    const dismiss = screen.getByRole('button', { name: 'Clear tag filter "Citra"' });
    fireEvent.click(dismiss);

    expect(screen.getByTestId('recipe-row-r-2')).toBeInTheDocument();
    expect(screen.queryByTestId('active-tag-filter-badge')).not.toBeInTheDocument();
  });

  it('recipes with no tags render no tag container', async () => {
    mockedListRecipes.mockResolvedValue([summary({ id: 'r-1', name: 'Plain' })]);
    render(<ConfigProvider><RecipeLibrary onOpen={vi.fn()} onOpenError={vi.fn()} onNew={vi.fn()} canCreate={true} /></ConfigProvider>);
    await waitFor(() => screen.getByTestId('recipe-row-r-1'));
    expect(screen.queryByTestId('recipe-tags-r-1')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// M38_P1 Amendment 1 — AC-32 (F-6, RA-10), client half. filterRecipesLocal
// is a deliberate module-private mirror of the server's filterRecipes
// (RA-10 keeps them in lockstep; it is NOT imported or unified). It uses a
// TRUTHINESS guard (`if (options.folder)` / `if (options.tag)`), which is
// exactly what makes an empty-string param mean "no filter" on the client —
// a nullish-exclusion guard (`!== undefined && !== null`) would treat `''`
// as a real filter and regress AC-32. Pinned here by source read (the
// established fs-reading pattern in this file, e.g. the M5.5_P4 removed-
// symbols test) plus a behavioral check that the no-filter state shows both
// filed and unfiled recipes, matching the server's RA-10 semantics.
// ---------------------------------------------------------------------------
describe('M38_P1 Amendment 1 — AC-32/RA-10: the client filter treats an empty-string param as "no filter"', () => {
  it('filterRecipesLocal guards folder/tag by truthiness (so "" is no filter), not by nullish-exclusion', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const src = readFileSync(join(process.cwd(), 'src/components/RecipeLibrary.tsx'), 'utf8');
    // The RA-10 pin: an empty string (falsy) falls through as "no filter",
    // agreeing with the server's filterRecipes after RA-10.
    expect(src).toMatch(/if \(options\.folder\) \{/);
    expect(src).toMatch(/if \(options\.tag\) \{/);
    // A nullish-exclusion guard would treat '' as a real filter — that is
    // the exact regression RA-10 closed server-side and must not exist here.
    expect(src).not.toMatch(/options\.folder !== undefined && options\.folder !== null/);
  });

  it('with no folder/tag filter active, both filed and unfiled recipes are shown (server-identical "no filter" semantics)', async () => {
    mockedListRecipes.mockResolvedValue([
      summary({ id: 'r-1', name: 'Filed', folder: 'IPAs' }),
      summary({ id: 'r-2', name: 'Unfiled' }),
    ]);
    render(<ConfigProvider><RecipeLibrary onOpen={vi.fn()} onOpenError={vi.fn()} onNew={vi.fn()} canCreate={true} /></ConfigProvider>);
    await waitFor(() => screen.getByTestId('recipe-row-r-1'));
    // The "All" state is filterRecipesLocal with no folder/tag values — the
    // same "show everything" result an empty-string param must produce.
    expect(screen.getByTestId('recipe-row-r-1')).toBeInTheDocument();
    expect(screen.getByTestId('recipe-row-r-2')).toBeInTheDocument();
    expect(screen.getByTestId('folder-tab-__all__')).toHaveTextContent('All (2)');
  });
});


