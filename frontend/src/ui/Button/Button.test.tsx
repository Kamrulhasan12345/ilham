import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './Button';

describe('Button', () => {
  it('renders its label and responds to a click', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);
    const button = screen.getByRole('button', { name: 'Save' });
    button.click();
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('applies the primary variant class when requested', () => {
    render(<Button variant="primary">Continue</Button>);
    const button = screen.getByRole('button', { name: 'Continue' });
    expect(button.className).toMatch(/primary/);
  });

  it('is disabled when the disabled prop is set, and does not fire onClick', () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Submitting…
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Submitting…' });
    expect(button).toBeDisabled();
    button.click();
    expect(onClick).not.toHaveBeenCalled();
  });

  it('defaults to type="button" so it never submits a surrounding form by accident', () => {
    render(<Button>Click</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });
});
