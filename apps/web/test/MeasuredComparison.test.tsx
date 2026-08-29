import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MeasuredComparison } from '../src/components/MeasuredComparison';

const baseProps = {
  measuredOg: 1.056,
  measuredFg: 1.012,
  measuredAbv: 5.9,
  measuredAttenuationPct: 78.6,
  measuredEfficiencyPct: 74.2,
  estimatedOg: 1.052,
  estimatedFg: 1.013,
  estimatedAbv: 5.1,
  estimatedAttenuationPct: 75.0,
  estimatedEfficiencyPct: 75.0,
  isRecalculated: false,
};

describe('AC-37: the comparison table shows measured against estimated', () => {
  it('renders five rows (OG, FG, ABV, attenuation, efficiency) with measured, estimated and a delta', () => {
    render(<MeasuredComparison {...baseProps} />);
    expect(screen.getByTestId('comparison-row-og-measured')).toHaveTextContent('1.056');
    expect(screen.getByTestId('comparison-row-og-estimated')).toHaveTextContent('1.052');
    expect(screen.getByTestId('comparison-row-fg-measured')).toHaveTextContent('1.012');
    expect(screen.getByTestId('comparison-row-abv-measured')).toHaveTextContent('5.9%');
    expect(screen.getByTestId('comparison-row-attenuation-measured')).toHaveTextContent('78.6%');
    expect(screen.getByTestId('comparison-row-efficiency-measured')).toHaveTextContent('74.2%');
    // Delta = measured - estimated, displayed.
    expect(screen.getByTestId('comparison-row-og-delta')).toHaveTextContent('+0.004');
  });
});

describe('AC-39: the null-snapshot branch recomputes AND labels', () => {
  it('isRecalculated: true renders a visible (recalculated) marker', () => {
    render(<MeasuredComparison {...baseProps} isRecalculated />);
    expect(screen.getByTestId('measured-comparison-recalculated')).toBeInTheDocument();
    expect(screen.getByTestId('measured-comparison-recalculated')).toHaveTextContent('recalculated');
  });

  it('isRecalculated: false renders no such marker', () => {
    render(<MeasuredComparison {...baseProps} isRecalculated={false} />);
    expect(screen.queryByTestId('measured-comparison-recalculated')).not.toBeInTheDocument();
  });
});

describe('AC-40: absent measured values are suppressed, never zeroed', () => {
  it('a null measured field renders "not recorded", no delta, and no 0/0.0/—/NaN/Infinity', () => {
    render(
      <MeasuredComparison
        {...baseProps}
        measuredFg={null}
        measuredAbv={null}
        measuredAttenuationPct={null}
      />,
    );
    expect(screen.getByTestId('comparison-row-fg-measured')).toHaveTextContent('not recorded');
    expect(screen.getByTestId('comparison-row-fg-delta')).toHaveTextContent('');
    expect(screen.getByTestId('comparison-row-abv-measured')).toHaveTextContent('not recorded');
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Infinity/)).not.toBeInTheDocument();
    expect(screen.queryByText('0.0%')).not.toBeInTheDocument();
  });

  it('a measured value equal to its estimate exactly renders a delta of 0.0 — suppression is keyed on absence, not falsiness', () => {
    render(<MeasuredComparison {...baseProps} measuredAbv={5.1} estimatedAbv={5.1} />);
    expect(screen.getByTestId('comparison-row-abv-delta')).toHaveTextContent('0.0%');
  });

  it('efficiency row suppressed when measuredEfficiencyPct is null', () => {
    render(<MeasuredComparison {...baseProps} measuredEfficiencyPct={null} />);
    expect(screen.getByTestId('comparison-row-efficiency-measured')).toHaveTextContent('not recorded');
  });
});
