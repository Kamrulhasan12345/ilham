import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Card } from './Card';

describe('Card', () => {
  it('renders its children inside a div', () => {
    render(<Card>hello</Card>);
    expect(screen.getByText('hello').tagName).toBe('DIV');
  });

  it('forwards extra props, like a custom className, onto the root element', () => {
    render(<Card className="extra">content</Card>);
    expect(screen.getByText('content')).toHaveClass('extra');
  });
});
