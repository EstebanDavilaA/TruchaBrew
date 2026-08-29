import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import type { InventoryItem, CatalogResponse } from '@truchabrew/shared-types';
import { InventoryManager } from '../src/components/InventoryManager';

// M12_P1 — PresetPickerModal (rendered on demand by InventoryManager) reads
// the catalog via useCatalog(). Mocked the same way HopSection.test.tsx
// mocks it, so this file doesn't have to stand up a real CatalogProvider +
// /api/catalog fetch just to test the inventory list/filter/CRUD surface.
const TEST_CATALOG: CatalogResponse = {
  fermentables: [{ id: 'cat-f-1', name: 'Pale Ale Malt', type: 'Grain', colorSrm: 3.5, potentialSg: 1.038 }],
  hops: [{ id: 'cat-h-1', name: 'Citra', alphaAcidPct: 12.5, type: 'Pellet' }],
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

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(JSON.stringify(body)),
  } as Response;
}

function baseItem(overrides: Partial<InventoryItem> = {}): InventoryItem {
  return {
    id: 'inv-1',
    category: 'Fermentable',
    name: 'Pale Ale Malt',
    nameKey: 'pale ale malt',
    quantity: 4,
    unit: 'kg',
    costPerUnit: 3.2,
    purchaseDate: null,
    expiryDate: null,
    notes: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

let items: InventoryItem[] = [];

beforeEach(() => {
  items = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.startsWith('/api/inventory') && (!init || init.method === undefined || init.method === 'GET')) {
        return Promise.resolve(jsonResponse(items));
      }
      if (url.startsWith('/api/inventory') && init?.method === 'POST') {
        const body = JSON.parse(init.body as string);
        const created: InventoryItem = { ...baseItem(body), id: 'inv-new', nameKey: body.name.toLowerCase(), ...body };
        return Promise.resolve(jsonResponse({ ...created, baseQuantity: created.quantity, deductedQuantity: 0, openDeductionCount: 0 }, 201));
      }
      return Promise.reject(new Error(`Unexpected fetch call in InventoryManager.test.tsx: ${url}`));
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function fetchedUrls(): string[] {
  return vi.mocked(fetch).mock.calls.map(([input]) => (typeof input === 'string' ? input : (input as URL | Request).toString()));
}

describe('AC-33: Inventory page filters issue the pinned requests', () => {
  it('initial render, category filter, out-of-stock filter, and both combined', async () => {
    render(<InventoryManager />);
    await waitFor(() => expect(fetchedUrls()).toContain('/api/inventory'));

    fireEvent.click(screen.getByTestId('inventory-filter-category-Hop'));
    await waitFor(() => expect(fetchedUrls()).toContain('/api/inventory?category=Hop'));

    fireEvent.click(screen.getByTestId('inventory-filter-out-of-stock'));
    await waitFor(() => expect(fetchedUrls()).toContain('/api/inventory?category=Hop&outOfStock=true'));
  });

  it('toggling out-of-stock alone (no category) issues outOfStock=true', async () => {
    render(<InventoryManager />);
    await waitFor(() => expect(fetchedUrls()).toContain('/api/inventory'));

    fireEvent.click(screen.getByTestId('inventory-filter-out-of-stock'));
    await waitFor(() => expect(fetchedUrls()).toContain('/api/inventory?outOfStock=true'));
  });

  it('rows render name, quantity, unit, and costPerUnit (or "—" when null)', async () => {
    items = [
      baseItem({ id: 'inv-1', name: 'Pale Ale Malt', quantity: 4, unit: 'kg', costPerUnit: 3.2 }),
      baseItem({ id: 'inv-2', name: 'Flaked Oats', quantity: 1, unit: 'kg', costPerUnit: null }),
    ];
    render(<InventoryManager />);

    await waitFor(() => screen.getByText('Pale Ale Malt'));
    expect(screen.getByTestId('inventory-row-inv-1')).toHaveTextContent('4');
    expect(screen.getByTestId('inventory-row-inv-1')).toHaveTextContent('kg');
    expect(screen.getByTestId('inventory-row-inv-1')).toHaveTextContent('3.2');

    expect(screen.getByTestId('inventory-row-inv-2')).toHaveTextContent('Flaked Oats');
    expect(screen.getByTestId('inventory-row-inv-2')).toHaveTextContent('—');
  });
});

describe('AC-34: stock flags rendered', () => {
  it('negative -> both flags; zero -> out-of-stock only; positive -> neither', async () => {
    items = [
      baseItem({ id: 'inv-neg', quantity: -0.5 }),
      baseItem({ id: 'inv-zero', quantity: 0 }),
      baseItem({ id: 'inv-plenty', quantity: 4 }),
    ];
    render(<InventoryManager />);
    await waitFor(() => screen.getByTestId('inventory-row-inv-neg'));

    expect(screen.getByTestId('inventory-flag-out-of-stock-inv-neg')).toBeInTheDocument();
    expect(screen.getByTestId('inventory-flag-negative-stock-inv-neg')).toBeInTheDocument();

    expect(screen.getByTestId('inventory-flag-out-of-stock-inv-zero')).toBeInTheDocument();
    expect(screen.queryByTestId('inventory-flag-negative-stock-inv-zero')).not.toBeInTheDocument();

    expect(screen.queryByTestId('inventory-flag-out-of-stock-inv-plenty')).not.toBeInTheDocument();
    expect(screen.queryByTestId('inventory-flag-negative-stock-inv-plenty')).not.toBeInTheDocument();
  });
});

describe('AC-3: InventoryManager renders 4 collapsible category sections', () => {
  it('renders Fermentables, Hops, Yeasts, and Miscs section cards with item count badges', async () => {
    items = [
      baseItem({ id: 'inv-1', category: 'Fermentable', name: 'Pale Ale Malt' }),
      baseItem({ id: 'inv-2', category: 'Fermentable', name: 'Munich Malt' }),
      baseItem({ id: 'inv-3', category: 'Hop', name: 'Citra', unit: 'g' }),
    ];
    render(<InventoryManager />);
    await waitFor(() => screen.getByTestId('inventory-row-inv-1'));

    for (const category of ['Fermentable', 'Hop', 'Yeast', 'Misc']) {
      expect(screen.getByTestId(`inventory-category-header-${category}`)).toBeInTheDocument();
    }
    expect(screen.getByTestId('inventory-category-header-Fermentable')).toHaveTextContent('Fermentables');
    expect(screen.getByTestId('inventory-category-header-Fermentable')).toHaveTextContent('(2)');
    expect(screen.getByTestId('inventory-category-header-Hop')).toHaveTextContent('Hops');
    expect(screen.getByTestId('inventory-category-header-Hop')).toHaveTextContent('(1)');
    expect(screen.getByTestId('inventory-category-header-Yeast')).toHaveTextContent('(0)');
    expect(screen.getByTestId('inventory-category-header-Misc')).toHaveTextContent('(0)');
  });
});

describe('AC-4: section collapse and expand toggles', () => {
  it('clicking the section header chevron collapses/expands the item list for that category', async () => {
    items = [baseItem({ id: 'inv-1', category: 'Fermentable', name: 'Pale Ale Malt' })];
    render(<InventoryManager />);
    await waitFor(() => screen.getByTestId('inventory-row-inv-1'));

    expect(screen.getByTestId('inventory-row-inv-1')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('inventory-category-toggle-Fermentable'));
    expect(screen.queryByTestId('inventory-row-inv-1')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('inventory-category-toggle-Fermentable'));
    expect(screen.getByTestId('inventory-row-inv-1')).toBeInTheDocument();
  });
});

describe('AC-5: quick + Add button per category section opens PresetPickerModal', () => {
  it('clicking inventory-add-hop opens PresetPickerModal with category="Hop"', async () => {
    render(<InventoryManager />);
    await waitFor(() => expect(fetchedUrls()).toContain('/api/inventory'));

    expect(screen.queryByTestId('preset-picker-modal')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('inventory-add-hop'));

    expect(screen.getByTestId('preset-picker-modal')).toBeInTheDocument();
    expect(screen.getByText('Select Hop')).toBeInTheDocument();
    expect(screen.getByTestId('preset-item-cat-h-1')).toBeInTheDocument();
  });
});

describe('AC-7: preset selection pre-fills InventoryForm', () => {
  it('selecting "Citra" preset navigates to InventoryForm with name="Citra", category="Hop", unit="g"', async () => {
    render(<InventoryManager />);
    await waitFor(() => expect(fetchedUrls()).toContain('/api/inventory'));

    fireEvent.click(screen.getByTestId('inventory-add-hop'));
    fireEvent.click(screen.getByTestId('preset-item-cat-h-1'));

    expect(screen.queryByTestId('preset-picker-modal')).not.toBeInTheDocument();
    expect((screen.getByTestId('inventory-form-name') as HTMLInputElement).value).toBe('Citra');
    expect((screen.getByTestId('inventory-form-category') as HTMLSelectElement).value).toBe('Hop');
    expect((screen.getByTestId('inventory-form-category') as HTMLSelectElement).disabled).toBe(true);
    expect((screen.getByTestId('inventory-form-unit') as HTMLSelectElement).value).toBe('g');
  });
});

describe('AC-8/AC-9: "+ Add Custom Item" fallback preserves category, blank name', () => {
  it('opens InventoryForm with category locked to Hop and a blank name', async () => {
    render(<InventoryManager />);
    await waitFor(() => expect(fetchedUrls()).toContain('/api/inventory'));

    fireEvent.click(screen.getByTestId('inventory-add-hop'));
    fireEvent.click(screen.getByTestId('preset-add-custom-btn'));

    expect(screen.queryByTestId('preset-picker-modal')).not.toBeInTheDocument();
    expect((screen.getByTestId('inventory-form-name') as HTMLInputElement).value).toBe('');
    expect((screen.getByTestId('inventory-form-category') as HTMLSelectElement).value).toBe('Hop');
    expect((screen.getByTestId('inventory-form-category') as HTMLSelectElement).disabled).toBe(true);
  });
});

describe('AC-10: global search bar filters items across all 4 category sections live', () => {
  it('typing a search query narrows visible rows and count badges', async () => {
    items = [
      baseItem({ id: 'inv-1', category: 'Fermentable', name: 'Pale Ale Malt' }),
      baseItem({ id: 'inv-2', category: 'Hop', name: 'Citra Hops', unit: 'g' }),
    ];
    render(<InventoryManager />);
    await waitFor(() => screen.getByTestId('inventory-row-inv-1'));

    fireEvent.change(screen.getByTestId('inventory-search'), { target: { value: 'citra' } });

    expect(screen.queryByTestId('inventory-row-inv-1')).not.toBeInTheDocument();
    expect(screen.getByTestId('inventory-row-inv-2')).toBeInTheDocument();
    expect(screen.getByTestId('inventory-category-header-Fermentable')).toHaveTextContent('(0)');
    expect(screen.getByTestId('inventory-category-header-Hop')).toHaveTextContent('(1)');
  });
});

describe('AC-11: out-of-stock filter narrows each category section', () => {
  it('enabling the out-of-stock pill re-fetches with outOfStock=true', async () => {
    items = [baseItem({ id: 'inv-1', category: 'Fermentable', name: 'Pale Ale Malt', quantity: 0 })];
    render(<InventoryManager />);
    await waitFor(() => expect(fetchedUrls()).toContain('/api/inventory'));

    fireEvent.click(screen.getByTestId('inventory-filter-out-of-stock'));
    await waitFor(() => expect(fetchedUrls()).toContain('/api/inventory?outOfStock=true'));
  });
});

describe('AC-21: category row vitals badges (M12_P1 Amendment 1)', () => {
  it('displays active category-specific vitals from customDetails per category', async () => {
    items = [
      baseItem({ id: 'inv-hop', category: 'Hop', name: 'Amarillo', unit: 'g', customDetails: { category: 'Hop', alphaAcidPct: 8.5, hopType: 'Pellet' } }),
      baseItem({
        id: 'inv-ferm',
        category: 'Fermentable',
        name: 'Pale Ale Malt',
        customDetails: { category: 'Fermentable', potentialSg: 1.037, colorSrm: 3.5 },
      }),
      baseItem({ id: 'inv-none', category: 'Fermentable', name: 'No Vitals Malt', customDetails: null }),
    ];
    render(<InventoryManager />);
    await waitFor(() => screen.getByTestId('inventory-row-inv-hop'));

    expect(screen.getByTestId('inventory-vitals-inv-hop')).toHaveTextContent('8.5% AA • Pellet');
    expect(screen.getByTestId('inventory-vitals-inv-ferm')).toHaveTextContent('1.037 SG • 3.5 SRM');
    expect(screen.queryByTestId('inventory-vitals-inv-none')).not.toBeInTheDocument();
  });
});

describe('AC-7 (Amendment 1): preset selection also pre-fills customDetails', () => {
  it('selecting the Citra hop preset pre-fills Alpha Acid % and Hop Form from the catalog', async () => {
    render(<InventoryManager />);
    await waitFor(() => expect(fetchedUrls()).toContain('/api/inventory'));

    fireEvent.click(screen.getByTestId('inventory-add-hop'));
    fireEvent.click(screen.getByTestId('preset-item-cat-h-1'));

    expect((screen.getByTestId('inventory-form-alpha-acid') as HTMLInputElement).value).toBe('12.5');
    expect((screen.getByTestId('inventory-form-hop-type') as HTMLSelectElement).value).toBe('Pellet');
  });
});

describe('AC-12: item edit, save, and delete round-trip from category view', () => {
  it('opening a row from its category section opens the edit form pre-filled', async () => {
    items = [baseItem({ id: 'inv-1', category: 'Fermentable', name: 'Pale Ale Malt', quantity: 4 })];
    render(<InventoryManager />);
    await waitFor(() => screen.getByTestId('inventory-row-inv-1'));

    fireEvent.click(screen.getByTestId('inventory-row-inv-1'));
    expect((screen.getByTestId('inventory-form-name') as HTMLInputElement).value).toBe('Pale Ale Malt');
    expect(screen.getByTestId('inventory-delete')).toBeInTheDocument();
  });
});

describe('M31_P4: InventoryManager milestone-closing accessibility assertions', () => {
  it('AC-8: search control is named "Search inventory" and still filters', async () => {
    items = [
      baseItem({ id: 'inv-1', category: 'Fermentable', name: 'Pale Ale Malt' }),
      baseItem({ id: 'inv-2', category: 'Hop', name: 'Citra Hops', unit: 'g' }),
    ];
    render(<InventoryManager />);
    await waitFor(() => screen.getByTestId('inventory-row-inv-1'));

    const search = screen.getByLabelText('Search inventory');
    expect(search).toBe(screen.getByTestId('inventory-search'));

    fireEvent.change(search, { target: { value: 'citra' } });
    expect(screen.queryByTestId('inventory-row-inv-1')).not.toBeInTheDocument();
    expect(screen.getByTestId('inventory-row-inv-2')).toBeInTheDocument();
  });

  it('AC-9: category filter renders as a segmented pill strip (RA-3) and still filters', async () => {
    render(<InventoryManager />);
    await waitFor(() => expect(fetchedUrls()).toContain('/api/inventory'));

    const strip = screen.getByTestId('inventory-filter-category');
    expect(strip).toBe(screen.getByRole('group', { name: 'Filter by category' }));
    expect(within(strip).getByTestId('inventory-filter-category-All')).toHaveAttribute('aria-pressed', 'true');
    expect(within(strip).getByTestId('inventory-filter-category-Hop')).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(screen.getByTestId('inventory-filter-category-Hop'));
    await waitFor(() => expect(fetchedUrls()).toContain('/api/inventory?category=Hop'));
    expect(within(strip).getByTestId('inventory-filter-category-Hop')).toHaveAttribute('aria-pressed', 'true');
    expect(within(strip).getByTestId('inventory-filter-category-All')).toHaveAttribute('aria-pressed', 'false');
  });

  it('AC-10: out-of-stock renders as a pill button in the filter strip (FEAT-029), aria-pressed reflects the active filter, and still filters', async () => {
    render(<InventoryManager />);
    await waitFor(() => expect(fetchedUrls()).toContain('/api/inventory'));

    const strip = screen.getByTestId('inventory-filter-category');
    const pill = within(strip).getByTestId('inventory-filter-out-of-stock');
    expect(pill).toBe(screen.getByRole('button', { name: /out of stock/i }));
    expect(pill).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(pill);
    expect(pill).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => expect(fetchedUrls()).toContain('/api/inventory?outOfStock=true'));

    fireEvent.click(pill);
    expect(pill).toHaveAttribute('aria-pressed', 'false');
    await waitFor(() => expect(fetchedUrls()).toContain('/api/inventory'));
  });
});

describe('AC-16 (M26_P1 Amendment 1): InventoryManager forwards onOpenMobileNav to its TopBar', () => {
  it('passing onOpenMobileNav renders the hamburger and clicking it calls the callback', async () => {
    const onOpenMobileNav = vi.fn();
    render(<InventoryManager onOpenMobileNav={onOpenMobileNav} />);
    await waitFor(() => expect(screen.getByText('Inventory')).toBeInTheDocument());
    const btn = screen.getByRole('button', { name: 'Open navigation menu' });
    fireEvent.click(btn);
    expect(onOpenMobileNav).toHaveBeenCalledTimes(1);
  });

  it('omitting onOpenMobileNav renders no hamburger button', async () => {
    render(<InventoryManager />);
    await waitFor(() => expect(screen.getByText('Inventory')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Open navigation menu' })).toBeNull();
  });

  it('forwards onOpenMobileNav into InventoryForm when opened in edit mode', async () => {
    items = [baseItem({ id: 'inv-1', name: 'Pale Ale Malt' })];
    const onOpenMobileNav = vi.fn();
    render(<InventoryManager onOpenMobileNav={onOpenMobileNav} />);
    await waitFor(() => screen.getByTestId('inventory-row-inv-1'));

    fireEvent.click(screen.getByTestId('inventory-row-inv-1'));
    const btn = screen.getByRole('button', { name: 'Open navigation menu' });
    fireEvent.click(btn);
    expect(onOpenMobileNav).toHaveBeenCalledTimes(1);
  });
});
