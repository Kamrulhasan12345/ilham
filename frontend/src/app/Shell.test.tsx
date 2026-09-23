import { RouterProvider, createMemoryHistory, createRootRoute, createRouter } from '@tanstack/react-router';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AuthProvider } from '../auth/AuthContext';
import { Shell } from './Shell';

// Shell now reads router state unconditionally (for the nav's current-menu
// highlight), so — like Shell.role.test.tsx — it needs a real RouterProvider
// even for these auth-independent assertions (skip link, #main landmark,
// brand). AuthProvider (real, uncontrolled) starts in "loading" status, so
// the nav itself never renders here and no apiFetch mocking is needed.
function renderShell(children: React.ReactNode) {
  const rootRoute = createRootRoute({
    component: () => (
      <AuthProvider>
        <Shell>{children}</Shell>
      </AuthProvider>
    ),
  });
  const router = createRouter({ routeTree: rootRoute, history: createMemoryHistory() });
  return render(<RouterProvider router={router} />);
}

describe('Shell', () => {
  it('renders a skip link that targets #main', async () => {
    renderShell(<p>content</p>);
    const skip = await screen.findByText('Skip to content');
    expect(skip).toHaveAttribute('href', '#main');
  });

  it('renders its children inside a focusable #main landmark', async () => {
    renderShell(<p>page content</p>);
    const main = await screen.findByRole('main');
    expect(main).toHaveAttribute('id', 'main');
    expect(main).toHaveAttribute('tabIndex', '-1');
    expect(screen.getByText('page content')).toBeInTheDocument();
  });

  it('shows the brand in English and Arabic', async () => {
    renderShell(<p>content</p>);
    expect(await screen.findByText('Ilham')).toBeInTheDocument();
    expect(screen.getByText('إلهام')).toHaveAttribute('dir', 'rtl');
  });
});
