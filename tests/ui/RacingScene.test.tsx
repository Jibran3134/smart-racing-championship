// @vitest-environment jsdom
import { fireEvent, render, screen, act } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RaceSession } from '../../src/ui/screens/racing/RaceSession';
import { createDrivingDemo } from '../../src/ui/fixtures/driving-demo';

afterEach(() => vi.unstubAllGlobals());

describe('driving scene controls', () => {
  it('shows the chequered flag and actual finish state after a complete driving race', () => {
    const driver = createDrivingDemo(); driver.start(); driver.step(120);
    render(<RaceSession driver={driver} showLabels onViewResults={() => {}} />);
    expect(screen.getByText('CHEQUERED FLAG')).toBeInTheDocument();
    expect(screen.getByText(/Finish time/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Restart session' })).toBeEnabled();
  });

  it('changes cameras and delegates focused keyboard nitro while ignoring form fields', () => {
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const driver = createDrivingDemo(); driver.start(); driver.step(3.2);
    render(<RaceSession driver={driver} showLabels onViewResults={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Resume session' }));
    const viewport = screen.getByRole('group', { name: /^Racing viewport/ });
    expect(screen.getByRole('button', { name: 'Follow car' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.keyDown(viewport, { code: 'KeyC' });
    expect(screen.getByRole('button', { name: 'Circuit view' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.keyDown(screen.getByLabelText('Camera car'), { code: 'KeyN' });
    expect(driver.getState().cars.find((car) => car.isHuman)?.nitro).toBe(3);
    fireEvent.keyDown(viewport, { code: 'KeyN' });
    expect(driver.getState().cars.find((car) => car.isHuman)?.nitro).toBe(2);
    expect(screen.getByRole('button', { name: 'Nitro engaged' })).toBeDisabled();
    fireEvent.keyDown(viewport, { code: 'Space' });
    expect(screen.getByRole('button', { name: 'Resume session' })).toBeEnabled();
  });

  it('handles missing audio gracefully and pauses when the tab is hidden', async () => {
    vi.stubGlobal('AudioContext', undefined);
    const cancel = vi.fn();
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 19));
    vi.stubGlobal('cancelAnimationFrame', cancel);
    const driver = createDrivingDemo();
    render(<RaceSession driver={driver} showLabels onViewResults={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Enable sound' }));
    expect(await screen.findByText(/Audio is unavailable in this browser/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Start race' }));
    expect(screen.getByRole('button', { name: 'Pause session' })).toBeInTheDocument();
    const descriptor = Object.getOwnPropertyDescriptor(document, 'hidden');
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(cancel).toHaveBeenCalledWith(19);
    expect(screen.getByRole('button', { name: 'Resume session' })).toBeInTheDocument();
    if (descriptor) Object.defineProperty(document, 'hidden', descriptor);
    else Reflect.deleteProperty(document, 'hidden');
  });
});
