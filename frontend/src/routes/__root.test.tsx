import { RouterProvider, createMemoryHistory, createRootRoute, createRouter } from '@tanstack/react-router';
import { render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../lib/apiClient';
import { RouteError } from './__root';

// RouteError renders a TanStack Router <Link>, which throws without a
// router in context, so these render through a minimal real router.
async function renderWithRouter(ui: ReactElement) {
  const rootRoute = createRootRoute({ component: () => ui });
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  });
  await router.load();
  render(<RouterProvider router={router} />);
}

describe('RouteError', () => {
  it('shows the ApiError message and a way forward, never a stack trace', async () => {
    await renderWithRouter(<RouteError error={new ApiError(404, 'not_found', 'hadith not found')} />);

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('hadith not found')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Return to the collections.' })).toHaveAttribute(
      'href',
      '/collections',
    );
    expect(screen.queryByText(/at\s+\S+\s+\(.*:\d+:\d+\)/)).not.toBeInTheDocument();
  });

  it('falls back to a generic message for a non-ApiError', async () => {
    await renderWithRouter(<RouteError error={new Error('some internal detail leaked from a stack trace')} />);

    expect(screen.getByText('Something went wrong.')).toBeInTheDocument();
    expect(
      screen.queryByText('some internal detail leaked from a stack trace'),
    ).not.toBeInTheDocument();
  });
});
