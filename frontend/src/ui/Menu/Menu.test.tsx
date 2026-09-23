import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Menu, MenuButton } from './Menu';

describe('Menu', () => {
  it('is closed by default and opens on trigger click', () => {
    render(
      <Menu label="Account">
        <MenuButton>Sign out</MenuButton>
      </Menu>,
    );
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Account' }));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Sign out' })).toBeInTheDocument();
  });

  it('closes on Escape', () => {
    render(
      <Menu label="Account">
        <MenuButton>Sign out</MenuButton>
      </Menu>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Account' }));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('closes on an outside click', () => {
    render(
      <div>
        <Menu label="Account">
          <MenuButton>Sign out</MenuButton>
        </Menu>
        <button type="button">Elsewhere</button>
      </div>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Account' }));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Elsewhere' }));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('closes when a menu item is clicked', () => {
    render(
      <Menu label="Account">
        <MenuButton>Sign out</MenuButton>
      </Menu>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Account' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Sign out' }));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
