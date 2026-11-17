import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadRacingSamples } from '../../src/ui/audio/racing-samples';

afterEach(() => vi.unstubAllGlobals());
describe('local racing recordings', () => {
  it('loads and decodes both bundled recordings without external requests', async () => {
    const fetch = vi.fn(async (url: string) => ({ ok: url.startsWith('/audio/'), arrayBuffer: async () => new ArrayBuffer(8) }));
    vi.stubGlobal('fetch', fetch);
    const buffer = { duration: 1 } as AudioBuffer;
    const decodeAudioData = vi.fn(async () => buffer);
    const result = await loadRacingSamples({ decodeAudioData } as unknown as BaseAudioContext, new AbortController().signal);
    expect(result).toEqual({ engine: buffer, tyres: buffer });
    expect(fetch.mock.calls.map(([url]) => url)).toEqual(['/audio/engine-loop.wav', '/audio/tire-squeal.wav']);
    expect(decodeAudioData).toHaveBeenCalledTimes(2);
  });
  it('reports missing samples clearly', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404 })));
    await expect(loadRacingSamples({} as BaseAudioContext, new AbortController().signal)).rejects.toThrow('Could not load racing audio (404)');
  });
});
