import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StrengthPlot } from './StrengthPlot';

describe('StrengthPlot', () => {
  const sixIdenticalWeights = Array.from({ length: 6 }, () => 0.95);

  it('renders one row for every one of the 8 possible weights, high to low', () => {
    render(
      <StrengthPlot
        weights={sixIdenticalWeights}
        baseWeights={sixIdenticalWeights}
        strength={0.95}
      />,
    );
    const labels = screen.getAllByTestId('plot-row-weight').map((el) => el.textContent);
    expect(labels).toEqual(['0.95', '0.80', '0.60', '0.50', '0.40', '0.25', '0.15', '0.10']);
  });

  it('draws one dot per link at its weight', () => {
    render(
      <StrengthPlot
        weights={sixIdenticalWeights}
        baseWeights={sixIdenticalWeights}
        strength={0.95}
      />,
    );
    expect(screen.getAllByTestId('plot-dot')).toHaveLength(6);
  });

  it('marks nothing when two or more links tie at the minimum, and says they tie', () => {
    render(<StrengthPlot weights={[0.95, 0.95]} baseWeights={[0.95, 0.95]} strength={0.95} />);
    expect(screen.queryByTestId('plot-dot-excluded')).not.toBeInTheDocument();
    expect(screen.getByText(/tie/i)).toBeInTheDocument();
  });

  it('marks the single dot that sets the score when there is a unique minimum', () => {
    render(
      <StrengthPlot weights={[0.95, 0.6, 0.95]} baseWeights={[0.95, 0.6, 0.95]} strength={0.6} />,
    );
    expect(screen.queryAllByTestId('plot-dot-excluded')).toHaveLength(0);
    expect(screen.getByText('sets the score')).toBeInTheDocument();
  });

  it('never renders a bare number without the six-grade legend', () => {
    render(
      <StrengthPlot
        weights={sixIdenticalWeights}
        baseWeights={sixIdenticalWeights}
        strength={0.95}
      />,
    );
    expect(screen.getByText('trustworthy')).toBeInTheDocument();
    expect(screen.getByText('abandoned')).toBeInTheDocument();
  });

  it('prints the specimen foot arithmetic, with the anʿana figure', () => {
    render(<StrengthPlot weights={[0.9, 0.95]} baseWeights={[0.95, 0.95]} strength={0.9} />);
    expect(screen.getByText(/lowest weight 0\.90/)).toBeInTheDocument();
    expect(screen.getByText(/anʿana 0\.05/)).toBeInTheDocument();
  });

  it('prints anʿana 0.00 when no link carries the penalty', () => {
    render(
      <StrengthPlot
        weights={sixIdenticalWeights}
        baseWeights={sixIdenticalWeights}
        strength={0.95}
      />,
    );
    expect(screen.getByText(/anʿana 0\.00/)).toBeInTheDocument();
  });
});
