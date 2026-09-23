import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { VerdictBand } from './VerdictBand';

describe('VerdictBand', () => {
  it('leads with the plain word and follows with the bracketed weight', () => {
    render(
      <VerdictBand word="strong" strength={0.95}>
        Every narrator identified.
      </VerdictBand>,
    );
    expect(screen.getByText('strong')).toBeInTheDocument();
    expect(screen.getByText('[wt 0.95]')).toBeInTheDocument();
    expect(screen.getByText('Every narrator identified.')).toBeInTheDocument();
  });

  it('states the absence with no number when there is no chain', () => {
    render(
      <VerdictBand word="none" strength={null}>
        Nothing to score.
      </VerdictBand>,
    );
    expect(screen.getByText('This hadith carries no recorded chain.')).toBeInTheDocument();
  });

  it('always prints the disclaimer beside the verdict', () => {
    render(
      <VerdictBand word="weak" strength={0.25}>
        A weak link found.
      </VerdictBand>,
    );
    expect(
      screen.getByText(/Ilham reports grades that classical scholars wrote centuries ago/),
    ).toBeInTheDocument();
  });
});
