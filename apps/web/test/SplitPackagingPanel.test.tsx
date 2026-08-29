import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SplitPackagingPanel } from '../src/components/SplitPackagingPanel';

describe('M17_P1 AC-7, AC-8 & AC-17: SplitPackagingPanel', () => {
  it('renders default package with full volume allocated (AC-7)', () => {
    render(<SplitPackagingPanel totalBeerVolumeL={20.0} peakFermentationTempC={20.0} />);

    expect(screen.getByTestId('split-packaging-panel')).toBeInTheDocument();
    expect(screen.getByTestId('package-row-0')).toBeInTheDocument();
    expect(screen.getByTestId('packaging-volume-balance')).toHaveTextContent('All 20.0 L Allocated');
  });

  it('updates priming sugar and bottle count dynamically when sugar type and bottle size change (AC-8)', () => {
    render(<SplitPackagingPanel totalBeerVolumeL={20.0} peakFermentationTempC={20.0} />);

    // Bottle run is row 0
    const bottleSugarSelect = screen.getByLabelText(/priming sugar/i);
    expect(bottleSugarSelect).toBeInTheDocument();

    // Total sugar with table_sugar (1.0x) for 20L @ 2.4 vol CO2 and 20C peak temp
    const initialSugarText = screen.getByTestId('priming-sugar-total-0').textContent;

    // Change sugar type to DME (1.40x)
    fireEvent.change(bottleSugarSelect, { target: { value: 'dme' } });

    const dmeSugarText = screen.getByTestId('priming-sugar-total-0').textContent;
    expect(dmeSugarText).not.toBe(initialSugarText);

    // Change bottle size from 330mL to 500mL
    const bottleSizeSelect = screen.getByLabelText(/bottle size/i);
    fireEvent.change(bottleSizeSelect, { target: { value: '500' } });

    // 20L in 500mL bottles = 40 bottles
    expect(screen.getByTestId('bottle-count-0')).toHaveTextContent('40 bottles');
  });

  it('adds and removes packages and updates unassigned balance on the go (AC-7)', () => {
    const handleChange = vi.fn();
    render(<SplitPackagingPanel totalBeerVolumeL={20.0} peakFermentationTempC={20.0} onPackagingChange={handleChange} />);

    // Change volume of package 0 to 10L (freeing 10L)
    const volumeInput = screen.getByLabelText(/volume \(l\)/i);
    fireEvent.change(volumeInput, { target: { value: '10' } });

    // Click Add Package button
    const addPkgBtn = screen.getByTestId('add-package-btn');
    fireEvent.click(addPkgBtn);

    expect(screen.getByTestId('package-row-1')).toBeInTheDocument();
    expect(handleChange).toHaveBeenCalled();

    // Remove package 2
    const removeBtn = screen.getByTestId('remove-package-btn-1');
    fireEvent.click(removeBtn);

    expect(screen.queryByTestId('package-row-1')).not.toBeInTheDocument();
  });

  it('calculates priming solution dilution and syringe dose per bottle live (AC-17)', () => {
    render(<SplitPackagingPanel totalBeerVolumeL={20.0} peakFermentationTempC={20.0} />);

    expect(screen.getByTestId('priming-solution-panel-0')).toBeInTheDocument();

    // Initial total solution with 200 mL water
    const initialSolText = screen.getByTestId('total-solution-ml-0').textContent;
    expect(initialSolText).toContain('mL');

    // Change water volume to 300 mL
    const waterInput = screen.getByLabelText(/dilution water volume/i);
    fireEvent.change(waterInput, { target: { value: '300' } });

    const newSolText = screen.getByTestId('total-solution-ml-0').textContent;
    expect(newSolText).not.toBe(initialSolText);

    // Target syringe dose test
    const doseInput = screen.getByLabelText(/target syringe dose/i);
    fireEvent.change(doseInput, { target: { value: '5' } });

    expect(screen.getByTestId('syringe-dose-ml-0')).toHaveTextContent('5 mL / btl');
  });
});
