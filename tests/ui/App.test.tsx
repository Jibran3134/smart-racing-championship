// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeAll, describe, expect, it } from 'vitest';
import { App } from '../../src/app/App';

// jsdom does not implement modal dialog methods. Real browser checks cover
// focus trapping and Escape; these shims only model open/close for unit tests.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () {
    if (!this.hasAttribute('open')) return;
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
});

describe('application foundation', () => {
  it('navigates across five screens and preserves race mode', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Every route.');
    const navigation = within(screen.getByRole('navigation', { name: 'Main navigation' }));
    fireEvent.click(navigation.getByRole('button', { name: /Track Explorer/ }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Track Explorer');
    fireEvent.click(navigation.getByRole('button', { name: /Algorithm Lab/ }));
    expect(screen.getByRole('heading', { name: 'Binary min-heap' })).toBeInTheDocument();
    fireEvent.click(navigation.getByRole('button', { name: /Championship/ }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Championship Dashboard');
    fireEvent.click(screen.getByRole('button', { name: /Championship setup/ }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Championship');
    expect(screen.getByRole('button', { name: 'Start race' })).toBeDisabled();
    fireEvent.click(navigation.getByRole('button', { name: /Overview/ }));
    fireEvent.click(screen.getByRole('button', { name: /02 \/ QUICK RACE/ }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Quick Race');
    expect(document.body.textContent).not.toMatch(/Jibran|Alishba/i);
  });

  it('selects map vertices by pointer, keyboard and selector', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Explore the circuit/ }));
    const fuel = screen.getByRole('button', { name: 'Fuel station' });
    fireEvent.click(fuel);
    expect(screen.getByRole('heading', { name: 'Fuel station' })).toBeInTheDocument();
    expect(fuel).toHaveAttribute('aria-pressed', 'true');
    fireEvent.keyDown(screen.getByRole('button', { name: 'Checkpoint 02' }), { key: 'Enter' });
    expect(screen.getByRole('heading', { name: 'Checkpoint 02' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Jump to vertex'), { target: { value: '12' } });
    expect(screen.getByRole('heading', { name: 'Nitro pickup' })).toBeInTheDocument();
    const map = screen.getByRole('group', { name: /interactive circuit map/ });
    const originalView = map.getAttribute('viewBox');
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(map.getAttribute('viewBox')).not.toBe(originalView);
    fireEvent.click(screen.getByRole('button', { name: 'Fit' }));
    expect(map).toHaveAttribute('viewBox', originalView);
  });

  it('runs real heap operations, handles empty/invalid input and resets', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Open Algorithm Lab' }));
    const input = screen.getByLabelText('Value to insert');
    fireEvent.change(input, { target: { value: '-5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Insert value' }));
    expect(screen.getByRole('status')).toHaveTextContent('Inserted -5. Minimum is -5.');
    fireEvent.click(screen.getByRole('button', { name: 'Extract min' }));
    expect(screen.getByRole('status')).toHaveTextContent('Extracted minimum: -5.');
    fireEvent.change(input, { target: { value: '' } });
    expect(screen.getByRole('button', { name: 'Insert value' })).toBeDisabled();
    for (let index = 0; index < 7; index++) fireEvent.click(screen.getByRole('button', { name: 'Extract min' }));
    expect(screen.getByRole('button', { name: 'Extract min' })).toBeDisabled();
    expect(screen.getByText('Heap empty. Insert a value to begin.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(screen.getByRole('button', { name: 'Extract min' })).toBeEnabled();
    expect(screen.getByRole('img', { name: /Min-heap in array order: 3,/ })).toBeInTheDocument();
  });

  it('opens instructions/settings and applies map and motion settings for the session', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Instructions' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Choose your next move.');
    fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Open settings' }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Map labels/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Reduce motion/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }));
    fireEvent.click(screen.getByRole('button', { name: /Explore the circuit/ }));
    expect(document.querySelectorAll('.node-label')).toHaveLength(0);
    expect(document.querySelector('.app-shell')).toHaveClass('reduce-motion');
    fireEvent.click(screen.getByRole('button', { name: 'Open settings' }));
    expect(screen.getByRole('checkbox', { name: /Map labels/ })).not.toBeChecked();
  });
});
