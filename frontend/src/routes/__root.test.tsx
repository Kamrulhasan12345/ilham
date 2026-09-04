import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../lib/apiClient';
import { RouteError } from './__root';

describe('RouteError', () => {
  it('shows the ApiError message and a way forward, never a stack trace', () => {
    render(<RouteError error={new ApiError(404, 'not_found', 'hadith not found')} />);

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('hadith not found')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Return home.' })).toHaveAttribute('href', '/');
    expect(screen.queryByText(/at\s+\S+\s+\(.*:\d+:\d+\)/)).not.toBeInTheDocument();
  });

  it('falls back to a generic message for a non-ApiError', () => {
    render(<RouteError error={new Error('some internal detail leaked from a stack trace')} />);

    expect(screen.getByText('Something went wrong.')).toBeInTheDocument();
    expect(
      screen.queryByText('some internal detail leaked from a stack trace'),
    ).not.toBeInTheDocument();
  });
});
