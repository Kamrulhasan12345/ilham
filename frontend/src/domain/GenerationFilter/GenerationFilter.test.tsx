import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GenerationFilter } from './GenerationFilter';

describe('GenerationFilter', () => {
  it('prints the readout as text beside step buttons', () => {
    let value = 10;
    const { rerender } = render(
      <GenerationFilter
        maxGeneration={10}
        value={value}
        onChange={(next) => {
          value = next;
          rerender(
            <GenerationFilter
              maxGeneration={10}
              value={value}
              onChange={() => {}}
              visibleCount={6}
              totalCount={6}
              alwaysShown={0}
            />,
          );
        }}
        visibleCount={6}
        totalCount={6}
        alwaysShown={0}
      />,
    );
    expect(screen.getByText('Showing 6 of 6 narrators — generations 1 to 10')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Show one fewer generation' }));
    expect(value).toBe(9);
  });

  it('says what a generation is, that filtering scores nothing, and who always shows', () => {
    render(
      <GenerationFilter
        maxGeneration={7}
        value={7}
        onChange={() => {}}
        visibleCount={5}
        totalCount={6}
        alwaysShown={1}
      />,
    );
    expect(screen.getByText(/1 is the Companions/)).toBeInTheDocument();
    expect(screen.getByText(/nothing is scored here/)).toBeInTheDocument();
    expect(screen.getByText(/1 of 6 narrator carries no recorded generation/)).toBeInTheDocument();
  });
});
