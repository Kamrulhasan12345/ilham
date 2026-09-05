import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AuthProvider } from '../auth/AuthContext';
import { Shell } from './Shell';

describe('Shell', () => {
  it('renders a skip link that targets #main', () => {
    render(
      <AuthProvider>
        <Shell>
          <p>content</p>
        </Shell>
      </AuthProvider>,
    );
    const skip = screen.getByText('Skip to content');
    expect(skip).toHaveAttribute('href', '#main');
  });

  it('renders its children inside a focusable #main landmark', () => {
    render(
      <AuthProvider>
        <Shell>
          <p>page content</p>
        </Shell>
      </AuthProvider>,
    );
    const main = screen.getByRole('main');
    expect(main).toHaveAttribute('id', 'main');
    expect(main).toHaveAttribute('tabIndex', '-1');
    expect(screen.getByText('page content')).toBeInTheDocument();
  });

  it('shows the brand in English and Arabic', () => {
    render(
      <AuthProvider>
        <Shell>
          <p>content</p>
        </Shell>
      </AuthProvider>,
    );
    expect(screen.getByText('Ilham')).toBeInTheDocument();
    expect(screen.getByText('إلهام')).toHaveAttribute('dir', 'rtl');
  });
});
