import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { InventoryForm } from '../src/components/InventoryForm';
import { ApiClientError } from '../src/api/client';
import { MISC_INVENTORY_UNITS } from '@truchabrew/calculations';

vi.mock('../src/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/api/client')>();
  return {
    ...actual,
    createInventoryItem: vi.fn(),
    updateInventoryItem: vi.fn(),
  };
});

import { createInventoryItem } from '../src/api/client';

const mockedCreateInventoryItem = vi.mocked(createInventoryItem);

beforeEach(() => {
  mockedCreateInventoryItem.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

function submitForm() {
  fireEvent.click(screen.getByRole('button', { name: 'Save Item' }));
}

/**
 * Clicks a field's visible label text and returns the resulting
 * `document.activeElement` (M31_P3 AC-9/AC-24).
 *
 * jsdom does not implement the browser's built-in <label> "activation
 * behaviour" of delegating a click through to its associated control
 * (https://github.com/jsdom/jsdom/issues/3117) -- fireEvent.click() alone
 * never moves focus here even when for/id association is correct. We
 * replicate that native delegation via the label's own `.control` lookup,
 * which only resolves an element when `for`/`id` (or DOM nesting) genuinely
 * associate the label with its control -- exactly the wiring FormField must
 * produce for a real browser to focus the right element on label click.
 */
function clickLabelAndReturnFocusedElement(labelText: string | RegExp): Element | null {
  const label = screen.getByText(labelText).closest('label');
  if (!label) throw new Error(`"${String(labelText)}" did not resolve to a <label> element`);
  fireEvent.click(label);
  (label as HTMLLabelElement).control?.focus();
  return document.activeElement;
}

describe('AC-35: form submits exactly InventoryWriteInput', () => {
  it('the posted body has exactly the 8 client-writable keys, no server-owned keys', async () => {
    mockedCreateInventoryItem.mockResolvedValue({
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
      // NEW in M9_P2 — createInventoryItem now returns InventoryStockView.
      baseQuantity: 4,
      deductedQuantity: 0,
      openDeductionCount: 0,
    });

    render(<InventoryForm mode="create" onSaved={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByTestId('inventory-form-name'), { target: { value: 'Pale Ale Malt' } });
    fireEvent.change(screen.getByTestId('inventory-form-quantity'), { target: { value: '4' } });
    submitForm();

    await waitFor(() => expect(mockedCreateInventoryItem).toHaveBeenCalled());
    const body = mockedCreateInventoryItem.mock.calls[0][0];
    // 9 client-writable keys since M12_P1 Amendment 1 added `customDetails`.
    expect(Object.keys(body).sort()).toEqual(
      ['category', 'costPerUnit', 'customDetails', 'expiryDate', 'name', 'notes', 'purchaseDate', 'quantity', 'unit'].sort(),
    );
    expect(body).not.toHaveProperty('id');
    expect(body).not.toHaveProperty('nameKey');
    expect(body).not.toHaveProperty('createdAt');
    expect(body).not.toHaveProperty('updatedAt');
  });

  it('selecting Fermentable leaves kg as the only unit option; Misc offers exactly the five MISC_INVENTORY_UNITS', () => {
    render(<InventoryForm mode="create" onSaved={vi.fn()} onCancel={vi.fn()} />);

    const unitSelect = screen.getByTestId('inventory-form-unit') as HTMLSelectElement;
    // Default category is Fermentable.
    expect(within(unitSelect).getAllByRole('option').map((o) => (o as HTMLOptionElement).value)).toEqual(['kg']);

    fireEvent.change(screen.getByTestId('inventory-form-category'), { target: { value: 'Misc' } });
    expect(within(unitSelect).getAllByRole('option').map((o) => (o as HTMLOptionElement).value)).toEqual([...MISC_INVENTORY_UNITS]);
  });
});

describe('AC-36: duplicate error surfaces without data loss', () => {
  it('a 409 INVENTORY_DUPLICATE renders the server message inline and retains every entered value', async () => {
    mockedCreateInventoryItem.mockRejectedValue(new ApiClientError('INVENTORY_DUPLICATE', 'An inventory item named "Pale Ale Malt" already exists.'));

    render(<InventoryForm mode="create" onSaved={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByTestId('inventory-form-name'), { target: { value: 'Pale Ale Malt' } });
    fireEvent.change(screen.getByTestId('inventory-form-quantity'), { target: { value: '4' } });
    fireEvent.change(screen.getByTestId('inventory-form-cost-per-unit'), { target: { value: '3.2' } });
    fireEvent.change(screen.getByTestId('inventory-form-notes'), { target: { value: 'my notes' } });
    submitForm();

    await waitFor(() => {
      expect(screen.getByText(/already exists/)).toBeInTheDocument();
    });

    expect((screen.getByTestId('inventory-form-name') as HTMLInputElement).value).toBe('Pale Ale Malt');
    expect((screen.getByTestId('inventory-form-quantity') as HTMLInputElement).value).toBe('4');
    expect((screen.getByTestId('inventory-form-cost-per-unit') as HTMLInputElement).value).toBe('3.2');
    expect((screen.getByTestId('inventory-form-notes') as HTMLTextAreaElement).value).toBe('my notes');
  });
});

describe('AC-7/AC-9: initialPreset pre-fill and category locking (M12_P1)', () => {
  it('preset selection pre-fills name and locks category to the preset category', () => {
    render(<InventoryForm mode="create" initialPreset={{ category: 'Hop', name: 'Citra' }} onSaved={vi.fn()} onCancel={vi.fn()} />);

    expect((screen.getByTestId('inventory-form-name') as HTMLInputElement).value).toBe('Citra');
    const categorySelect = screen.getByTestId('inventory-form-category') as HTMLSelectElement;
    expect(categorySelect.value).toBe('Hop');
    expect(categorySelect.disabled).toBe(true);
    expect((screen.getByTestId('inventory-form-unit') as HTMLSelectElement).value).toBe('g');
  });

  it('custom fallback locks category to the picker context with a blank name', () => {
    render(<InventoryForm mode="create" initialPreset={{ category: 'Yeast' }} onSaved={vi.fn()} onCancel={vi.fn()} />);

    expect((screen.getByTestId('inventory-form-name') as HTMLInputElement).value).toBe('');
    const categorySelect = screen.getByTestId('inventory-form-category') as HTMLSelectElement;
    expect(categorySelect.value).toBe('Yeast');
    expect(categorySelect.disabled).toBe(true);
    expect((screen.getByTestId('inventory-form-unit') as HTMLSelectElement).value).toBe('pkg');
  });

  it('no initialPreset (plain create) leaves category unlocked, defaulting to Fermentable', () => {
    render(<InventoryForm mode="create" onSaved={vi.fn()} onCancel={vi.fn()} />);

    const categorySelect = screen.getByTestId('inventory-form-category') as HTMLSelectElement;
    expect(categorySelect.disabled).toBe(false);
    expect(categorySelect.value).toBe('Fermentable');
  });

  it('submitting a preset-prefilled form posts the preset category and name', async () => {
    mockedCreateInventoryItem.mockResolvedValue({
      id: 'inv-2',
      category: 'Hop',
      name: 'Citra',
      nameKey: 'citra',
      quantity: 100,
      unit: 'g',
      costPerUnit: null,
      purchaseDate: null,
      expiryDate: null,
      notes: '',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      baseQuantity: 100,
      deductedQuantity: 0,
      openDeductionCount: 0,
    });

    render(<InventoryForm mode="create" initialPreset={{ category: 'Hop', name: 'Citra' }} onSaved={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByTestId('inventory-form-quantity'), { target: { value: '100' } });
    submitForm();

    await waitFor(() => expect(mockedCreateInventoryItem).toHaveBeenCalled());
    const body = mockedCreateInventoryItem.mock.calls[0][0];
    expect(body.category).toBe('Hop');
    expect(body.name).toBe('Citra');
    expect(body.unit).toBe('g');
  });
});

describe('M31_P4: InventoryForm milestone-closing accessibility assertions', () => {
  it('AC-6: the category-locked note adopts METADATA_TEXT_CLASS, stays a <p>, keeps its text and data-testid, and text-[11px] is gone', () => {
    const { container } = render(<InventoryForm mode="create" initialPreset={{ category: 'Hop', name: 'Citra' }} onSaved={vi.fn()} onCancel={vi.fn()} />);

    const note = screen.getByTestId('inventory-form-category-locked-note');
    expect(note.tagName).toBe('P');
    expect(note).toHaveTextContent('Category is locked to Hop from the preset picker.');
    expect(note.className).toContain('text-xs text-slate-400');
    expect(note.className).toContain('mt-1');
    expect(container.innerHTML).not.toContain('text-[11px]');
  });

  it('AC-11: every input/select/textarea in the form resolves to a non-empty accessible name', () => {
    const { container } = render(<InventoryForm mode="create" initialPreset={{ category: 'Hop', name: 'Citra' }} onSaved={vi.fn()} onCancel={vi.fn()} />);

    const controls = container.querySelectorAll('input, select, textarea');
    expect(controls.length).toBeGreaterThan(0);
    controls.forEach((el) => {
      const hasAriaLabel = (el.getAttribute('aria-label') ?? '').trim() !== '';
      const hasLabels = (el as HTMLInputElement).labels && (el as HTMLInputElement).labels!.length > 0;
      expect(hasAriaLabel || hasLabels).toBe(true);
    });
  });

  it('AC-12: clicking the Item Name label focuses its input', () => {
    render(<InventoryForm mode="create" onSaved={vi.fn()} onCancel={vi.fn()} />);
    expect(clickLabelAndReturnFocusedElement('Item Name')).toBe(screen.getByTestId('inventory-form-name'));
  });
});

describe('AC-16: Hop category detail controls', () => {
  it('renders Alpha Acid %, Hop Type, Origin, Year, Lot #, and Manufacturing Date when category is Hop', () => {
    render(<InventoryForm mode="create" initialPreset={{ category: 'Hop', name: 'Citra' }} onSaved={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByTestId('inventory-form-alpha-acid')).toBeInTheDocument();
    expect(screen.getByTestId('inventory-form-hop-type')).toBeInTheDocument();
    expect(screen.getByTestId('inventory-form-origin')).toBeInTheDocument();
    expect(screen.getByTestId('inventory-form-year')).toBeInTheDocument();
    expect(screen.getByTestId('inventory-form-lot-number')).toBeInTheDocument();
    expect(screen.getByTestId('inventory-form-manufacturing-date')).toBeInTheDocument();
    // Not the other categories' controls.
    expect(screen.queryByTestId('inventory-form-potential-sg')).not.toBeInTheDocument();
    expect(screen.queryByTestId('inventory-form-laboratory')).not.toBeInTheDocument();
    expect(screen.queryByTestId('inventory-form-misc-type')).not.toBeInTheDocument();
  });
});

describe('AC-17: Fermentable category detail controls', () => {
  it('renders Potential SG, Color SRM, Grain Type, Supplier, Origin, Lot #, and Manufacturing Date when category is Fermentable', () => {
    render(<InventoryForm mode="create" onSaved={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByTestId('inventory-form-potential-sg')).toBeInTheDocument();
    expect(screen.getByTestId('inventory-form-color-srm')).toBeInTheDocument();
    expect(screen.getByTestId('inventory-form-grain-type')).toBeInTheDocument();
    expect(screen.getByTestId('inventory-form-supplier')).toBeInTheDocument();
    expect(screen.getByTestId('inventory-form-origin')).toBeInTheDocument();
    expect(screen.getByTestId('inventory-form-lot-number')).toBeInTheDocument();
    expect(screen.getByTestId('inventory-form-manufacturing-date')).toBeInTheDocument();
  });
});

describe('AC-18: Yeast category detail controls', () => {
  it('renders Laboratory, Product ID, Attenuation %, Yeast Type, Form, Lot #, and Manufacturing Date when category is Yeast', () => {
    render(<InventoryForm mode="create" initialPreset={{ category: 'Yeast' }} onSaved={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByTestId('inventory-form-laboratory')).toBeInTheDocument();
    expect(screen.getByTestId('inventory-form-product-id')).toBeInTheDocument();
    expect(screen.getByTestId('inventory-form-attenuation')).toBeInTheDocument();
    expect(screen.getByTestId('inventory-form-yeast-type')).toBeInTheDocument();
    expect(screen.getByTestId('inventory-form-yeast-form')).toBeInTheDocument();
    expect(screen.getByTestId('inventory-form-lot-number')).toBeInTheDocument();
    expect(screen.getByTestId('inventory-form-manufacturing-date')).toBeInTheDocument();
  });
});

describe('AC-19: Misc category detail controls', () => {
  it('renders Misc Type, Default Use, Lot #, and Manufacturing Date when category is Misc', () => {
    render(<InventoryForm mode="create" initialPreset={{ category: 'Misc' }} onSaved={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByTestId('inventory-form-misc-type')).toBeInTheDocument();
    expect(screen.getByTestId('inventory-form-default-use')).toBeInTheDocument();
    expect(screen.getByTestId('inventory-form-lot-number')).toBeInTheDocument();
    expect(screen.getByTestId('inventory-form-manufacturing-date')).toBeInTheDocument();
    // Not Hop/Fermentable/Yeast controls.
    expect(screen.queryByTestId('inventory-form-alpha-acid')).not.toBeInTheDocument();
    expect(screen.queryByTestId('inventory-form-potential-sg')).not.toBeInTheDocument();
    expect(screen.queryByTestId('inventory-form-laboratory')).not.toBeInTheDocument();
  });
});

describe('AC-20: preset pre-filling with user vitals customization', () => {
  it('selecting preset pre-fills its vitals; overriding Alpha Acid % persists the customized value', async () => {
    mockedCreateInventoryItem.mockResolvedValue({
      id: 'inv-3',
      category: 'Hop',
      name: 'Amarillo',
      nameKey: 'amarillo',
      quantity: 100,
      unit: 'g',
      costPerUnit: null,
      purchaseDate: null,
      expiryDate: null,
      notes: '',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      baseQuantity: 100,
      deductedQuantity: 0,
      openDeductionCount: 0,
      customDetails: { category: 'Hop', alphaAcidPct: 8.5, hopType: 'Pellet' },
    });

    render(
      <InventoryForm
        mode="create"
        initialPreset={{ category: 'Hop', name: 'Amarillo', customDetails: { category: 'Hop', alphaAcidPct: 9.2, hopType: 'Pellet' } }}
        onSaved={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    // Pre-filled from the preset.
    expect((screen.getByTestId('inventory-form-alpha-acid') as HTMLInputElement).value).toBe('9.2');
    expect((screen.getByTestId('inventory-form-hop-type') as HTMLSelectElement).value).toBe('Pellet');

    // User overrides the crop-specific Alpha Acid %.
    fireEvent.change(screen.getByTestId('inventory-form-alpha-acid'), { target: { value: '8.5' } });
    fireEvent.change(screen.getByTestId('inventory-form-quantity'), { target: { value: '100' } });
    submitForm();

    await waitFor(() => expect(mockedCreateInventoryItem).toHaveBeenCalled());
    const body = mockedCreateInventoryItem.mock.calls[0][0];
    expect(body.customDetails).toEqual({
      category: 'Hop',
      alphaAcidPct: 8.5,
      hopType: 'Pellet',
      origin: null,
      year: null,
      lotNumber: null,
      manufacturingDate: null,
    });
  });
});

describe('M31_P3 AC-1 to AC-9: Core Item Information accessible names & click-to-focus', () => {
  it('AC-1 to AC-8: every core field resolves via getByLabelText', () => {
    render(<InventoryForm mode="create" onSaved={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByLabelText(/^category/i)).toBe(screen.getByTestId('inventory-form-category'));
    expect(screen.getByLabelText(/^item name/i)).toBe(screen.getByTestId('inventory-form-name'));
    expect(screen.getByLabelText(/^quantity/i)).toBe(screen.getByTestId('inventory-form-quantity'));
    expect(screen.getByLabelText(/^unit/i)).toBe(screen.getByTestId('inventory-form-unit'));
    expect(screen.getByLabelText('Cost Per Unit')).toBe(screen.getByTestId('inventory-form-cost-per-unit'));
    expect(screen.getByLabelText('Purchase Date')).toBe(screen.getByTestId('inventory-form-purchase-date'));
    expect(screen.getByLabelText('Expiry Date')).toBe(screen.getByTestId('inventory-form-expiry-date'));
    expect(screen.getByLabelText('Notes')).toBe(screen.getByTestId('inventory-form-notes'));
  });

  it('AC-9: clicking core item labels moves focus to the associated control', () => {
    render(<InventoryForm mode="create" onSaved={vi.fn()} onCancel={vi.fn()} />);

    expect(clickLabelAndReturnFocusedElement('Category')).toBe(screen.getByTestId('inventory-form-category'));
    expect(clickLabelAndReturnFocusedElement('Item Name')).toBe(screen.getByTestId('inventory-form-name'));
    expect(clickLabelAndReturnFocusedElement('Quantity')).toBe(screen.getByTestId('inventory-form-quantity'));
    expect(clickLabelAndReturnFocusedElement('Unit')).toBe(screen.getByTestId('inventory-form-unit'));
    expect(clickLabelAndReturnFocusedElement('Cost Per Unit')).toBe(screen.getByTestId('inventory-form-cost-per-unit'));
    expect(clickLabelAndReturnFocusedElement('Purchase Date')).toBe(screen.getByTestId('inventory-form-purchase-date'));
    expect(clickLabelAndReturnFocusedElement('Expiry Date')).toBe(screen.getByTestId('inventory-form-expiry-date'));
    expect(clickLabelAndReturnFocusedElement('Notes')).toBe(screen.getByTestId('inventory-form-notes'));
  });
});

describe('M31_P3 AC-10 to AC-24: Category Details accessible names & click-to-focus', () => {
  it('AC-10, AC-11, AC-12, AC-23: Hop category detail fields resolve via getByLabelText', () => {
    render(<InventoryForm mode="create" initialPreset={{ category: 'Hop', name: 'Citra' }} onSaved={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByLabelText('Alpha Acid (%)')).toBe(screen.getByTestId('inventory-form-alpha-acid'));
    expect(screen.getByLabelText('Hop Form / Type')).toBe(screen.getByTestId('inventory-form-hop-type'));
    expect(screen.getByLabelText('Origin / Country')).toBe(screen.getByTestId('inventory-form-origin'));
    expect(screen.getByLabelText('Crop Year')).toBe(screen.getByTestId('inventory-form-year'));
    expect(screen.getByLabelText('Lot # / Batch')).toBe(screen.getByTestId('inventory-form-lot-number'));
    expect(screen.getByLabelText('Harvest / Manufacturing Date')).toBe(screen.getByTestId('inventory-form-manufacturing-date'));
  });

  it('AC-13, AC-14, AC-15, AC-16, AC-23: Fermentable category detail fields resolve via getByLabelText', () => {
    render(<InventoryForm mode="create" onSaved={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByLabelText('Potential (SG)')).toBe(screen.getByTestId('inventory-form-potential-sg'));
    expect(screen.getByLabelText('Color (SRM)')).toBe(screen.getByTestId('inventory-form-color-srm'));
    expect(screen.getByLabelText('Fermentable Type')).toBe(screen.getByTestId('inventory-form-grain-type'));
    expect(screen.getByLabelText('Supplier / Maltster')).toBe(screen.getByTestId('inventory-form-supplier'));
    expect(screen.getByLabelText('Origin / Country')).toBe(screen.getByTestId('inventory-form-origin'));
    expect(screen.getByLabelText('Lot # / Batch')).toBe(screen.getByTestId('inventory-form-lot-number'));
    expect(screen.getByLabelText('Manufacturing Date')).toBe(screen.getByTestId('inventory-form-manufacturing-date'));
  });

  it('AC-17, AC-18, AC-19, AC-20, AC-23: Yeast category detail fields resolve via getByLabelText', () => {
    render(<InventoryForm mode="create" initialPreset={{ category: 'Yeast' }} onSaved={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByLabelText('Laboratory / Brand')).toBe(screen.getByTestId('inventory-form-laboratory'));
    expect(screen.getByLabelText('Product ID / Code')).toBe(screen.getByTestId('inventory-form-product-id'));
    expect(screen.getByLabelText('Attenuation (%)')).toBe(screen.getByTestId('inventory-form-attenuation'));
    expect(screen.getByLabelText('Yeast Type')).toBe(screen.getByTestId('inventory-form-yeast-type'));
    expect(screen.getByLabelText('Form')).toBe(screen.getByTestId('inventory-form-yeast-form'));
    expect(screen.getByLabelText('Lot # / Batch')).toBe(screen.getByTestId('inventory-form-lot-number'));
    expect(screen.getByLabelText('Manufacturing Date')).toBe(screen.getByTestId('inventory-form-manufacturing-date'));
  });

  it('AC-21, AC-22, AC-23: Misc category detail fields resolve via getByLabelText', () => {
    render(<InventoryForm mode="create" initialPreset={{ category: 'Misc' }} onSaved={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByLabelText('Misc Type')).toBe(screen.getByTestId('inventory-form-misc-type'));
    expect(screen.getByLabelText('Default Use')).toBe(screen.getByTestId('inventory-form-default-use'));
    expect(screen.getByLabelText('Lot # / Batch')).toBe(screen.getByTestId('inventory-form-lot-number'));
    expect(screen.getByLabelText('Manufacturing Date')).toBe(screen.getByTestId('inventory-form-manufacturing-date'));
  });

  it('AC-24: clicking category detail labels moves focus to the associated control', () => {
    render(<InventoryForm mode="create" initialPreset={{ category: 'Hop', name: 'Citra' }} onSaved={vi.fn()} onCancel={vi.fn()} />);

    expect(clickLabelAndReturnFocusedElement('Alpha Acid (%)')).toBe(screen.getByTestId('inventory-form-alpha-acid'));
    expect(clickLabelAndReturnFocusedElement('Hop Form / Type')).toBe(screen.getByTestId('inventory-form-hop-type'));
    expect(clickLabelAndReturnFocusedElement('Origin / Country')).toBe(screen.getByTestId('inventory-form-origin'));
    expect(clickLabelAndReturnFocusedElement('Crop Year')).toBe(screen.getByTestId('inventory-form-year'));
    expect(clickLabelAndReturnFocusedElement('Lot # / Batch')).toBe(screen.getByTestId('inventory-form-lot-number'));
    expect(clickLabelAndReturnFocusedElement('Harvest / Manufacturing Date')).toBe(screen.getByTestId('inventory-form-manufacturing-date'));
  });
});

describe('M31_P3 AC-25: action buttons render via <Button>', () => {
  const baseItem = {
    id: 'inv-99',
    category: 'Fermentable' as const,
    name: 'Pilsner Malt',
    nameKey: 'pilsner malt',
    quantity: 10,
    unit: 'kg' as const,
    costPerUnit: 1.5,
    purchaseDate: null,
    expiryDate: null,
    notes: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    baseQuantity: 10,
    deductedQuantity: 0,
    openDeductionCount: 0,
  };

  it('Cancel, Save Item, and Delete buttons carry canonical Button primitive styling', () => {
    render(
      <InventoryForm
        mode="edit"
        initialItem={baseItem}
        onSaved={vi.fn()}
        onCancel={vi.fn()}
        deleteAction={{ onConfirm: () => {}, busy: false, error: null }}
      />,
    );

    const cancelButtons = screen.getAllByRole('button', { name: 'Cancel' });
    const cancelBtn = cancelButtons.find((b) => b.textContent === 'Cancel')!;
    const saveBtn = screen.getByRole('button', { name: /save item/i });
    const deleteBtn = screen.getByRole('button', { name: /delete/i });

    expect(cancelBtn).toHaveClass('rounded-lg');
    expect(saveBtn).toHaveClass('bg-amber-600', 'rounded-lg');
    expect(deleteBtn).toHaveClass('bg-rose-950/80', 'rounded-lg');
  });
});

describe('AC-16 (M26_P1 Amendment 1): InventoryForm forwards onOpenMobileNav to its TopBar', () => {
  it('passing onOpenMobileNav renders the hamburger and clicking it calls the callback', () => {
    const onOpenMobileNav = vi.fn();
    render(<InventoryForm mode="create" onSaved={vi.fn()} onCancel={vi.fn()} onOpenMobileNav={onOpenMobileNav} />);
    const btn = screen.getByRole('button', { name: 'Open navigation menu' });
    fireEvent.click(btn);
    expect(onOpenMobileNav).toHaveBeenCalledTimes(1);
  });

  it('omitting onOpenMobileNav renders no hamburger button', () => {
    render(<InventoryForm mode="create" onSaved={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Open navigation menu' })).toBeNull();
  });
});
