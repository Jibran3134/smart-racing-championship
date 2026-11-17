export interface RacingSamples { v10: AudioBuffer; v8: AudioBuffer; tyres: AudioBuffer }

/** Assets are bundled locally; runtime never contacts an external sound host. */
export async function loadRacingSamples(context: BaseAudioContext, signal: AbortSignal): Promise<RacingSamples> {
  const load = async (name: string) => {
    const response = await fetch(`${import.meta.env.BASE_URL}audio/${name}`, { signal });
    if (!response.ok) throw new Error(`Could not load racing audio (${response.status}).`);
    const data = await response.arrayBuffer();
    if (signal.aborted) throw new DOMException('Audio loading cancelled.', 'AbortError');
    return context.decodeAudioData(data);
  };
  const [v10, v8, tyres] = await Promise.all([load('formula-v10.wav'), load('formula-v8.wav'), load('tire-squeal.wav')]);
  return { v10, v8, tyres };
}
