import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PageHeader } from './PageHeader';

describe('PageHeader', () => {
  it('renders the title as an h1', () => {
    render(<PageHeader title="Collections" />);
    expect(screen.getByRole('heading', { level: 1, name: 'Collections' })).toBeInTheDocument();
  });

  it('renders trailing content beside the title when given', () => {
    render(<PageHeader title="Notes" trailing={<span>3 notes</span>} />);
    expect(screen.getByText('3 notes')).toBeInTheDocument();
  });

  it('renders nothing extra when trailing is omitted', () => {
    render(<PageHeader title="Circles" />);
    expect(screen.queryByText('3 notes')).not.toBeInTheDocument();
  });
});
