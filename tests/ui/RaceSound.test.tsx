// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RaceSession } from '../../src/ui/screens/racing/RaceSession';
import { createDrivingDemo } from '../../src/ui/fixtures/driving-demo';

const audio = vi.hoisted(() => ({
  created: vi.fn(), resume: vi.fn(async () => {}), setActive: vi.fn(async () => {}),
  setVolume: vi.fn(), update: vi.fn(), dispose: vi.fn(), countdown: vi.fn(),
  shift: vi.fn(), checkpoint: vi.fn(), finish: vi.fn(async () => {}),
}));
vi.mock('../../src/ui/audio/RacingAudio', () => ({ RacingAudio: class {
  constructor() { audio.created(); }
  resume = audio.resume; setActive = audio.setActive; setVolume = audio.setVolume;
  update = audio.update; dispose = audio.dispose; countdown = audio.countdown;
  shift = audio.shift; checkpoint = audio.checkpoint; finish = audio.finish;
} }));

afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe('automatic race audio', () => {
  it('unlocks sound from Start race, plays countdown and respects mute through resume/restart', async () => {
    vi.stubGlobal('AudioContext', class {});
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const { unmount } = render(<RaceSession driver={createDrivingDemo()} showLabels onViewResults={() => {}} />);
    expect(audio.created).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Start race' }));
    expect(audio.created).toHaveBeenCalledOnce();
    expect(audio.resume).toHaveBeenCalled();
    await screen.findByRole('button', { name: 'Mute sound' });
    await waitFor(() => expect(audio.setActive).toHaveBeenLastCalledWith(true));
    expect(audio.countdown).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Mute sound' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pause session' }));
    const resumeCount = audio.resume.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Resume session' }));
    expect(audio.resume).toHaveBeenCalledTimes(resumeCount);
    expect(screen.getByRole('button', { name: 'Enable sound' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Restart session' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start race' }));
    expect(audio.resume).toHaveBeenCalledTimes(resumeCount);
    fireEvent.click(screen.getByRole('button', { name: 'Enable sound' }));
    await screen.findByRole('button', { name: 'Mute sound' });
    expect(audio.resume).toHaveBeenCalledTimes(resumeCount + 1);
    expect(audio.created).toHaveBeenCalledOnce();
    unmount();
    expect(audio.dispose).toHaveBeenCalledOnce();
  });
});
