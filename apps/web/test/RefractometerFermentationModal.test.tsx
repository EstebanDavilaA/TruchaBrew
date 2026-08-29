import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RefractometerFermentationModal } from '../src/components/RefractometerFermentationModal';

describe('RefractometerFermentationModal component (AC-10)', () => {
  it('does not render when open is false', () => {
    const { container } = render(
      <RefractometerFermentationModal
        open={false}
        onClose={vi.fn()}
        onApplySg={vi.fn()}
      />
    );
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('renders inputs and calculates alcohol-corrected SG with Sean Terrill formula', () => {
    const handleApply = vi.fn();
    const handleClose = vi.fn();

    render(
      <RefractometerFermentationModal
        open={true}
        onClose={handleClose}
        initialOg={1.053}
        onApplySg={handleApply}
      />
    );

    expect(screen.getByText('Fermentation Refractometer Tool')).toBeDefined();

    // With OG ~1.053 (~13 °Bx) and Current 6.5 °Bx, result is displayed
    const resultElement = screen.getByTestId('corrected-sg-result');
    expect(resultElement.textContent).toBe('1.012');

    // Click apply
    const applyBtn = screen.getByTestId('apply-corrected-sg-btn');
    fireEvent.click(applyBtn);

    expect(handleApply).toHaveBeenCalledWith(1.012);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('applies NumberInput styling and tabular-nums formatting (M29_P3 AC-13 / M34_P1)', () => {
    const { container } = render(
      <RefractometerFermentationModal
        open={true}
        onClose={vi.fn()}
        initialOg={1.053}
        onApplySg={vi.fn()}
      />
    );
    const input = screen.getByLabelText('Wort Correction Factor (WCF)');
    expect(input.className).toContain('font-mono');
    expect(input.className).toContain('tabular-nums');
    expect(container.querySelector('.tabular-nums')).not.toBeNull();
  });

  it('AC-7..AC-10: modal renders NumberInput and Button primitives', () => {
    render(
      <RefractometerFermentationModal
        open={true}
        onClose={vi.fn()}
        initialOg={1.053}
        onApplySg={vi.fn()}
      />
    );
    const closeBtn = screen.getByLabelText('Close modal');
    expect(closeBtn).toHaveClass('inline-flex', 'items-center', 'justify-center');

    const initBrixInput = screen.getByLabelText('Original Wort (°Brix / OG)');
    expect(initBrixInput).toHaveAttribute('id', 'refract-initial-brix');
    expect(initBrixInput).toHaveClass('font-mono', 'tabular-nums');

    const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
    expect(cancelBtn).toHaveClass('inline-flex', 'items-center', 'justify-center', 'gap-1.5');
    expect(cancelBtn).toHaveClass('text-xs', 'px-3', 'py-1.5');

    const applyBtn = screen.getByTestId('apply-corrected-sg-btn');
    expect(applyBtn).toHaveClass('inline-flex', 'items-center', 'justify-center', 'gap-1.5');
    expect(applyBtn).toHaveClass('text-xs', 'px-3', 'py-1.5');
  });
});



