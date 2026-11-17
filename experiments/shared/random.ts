/** Stable uint32 LCG. Dataset identity depends only on the documented seed. */
export function random(seed: number): () => number {
  let current = seed >>> 0;
  return () => { current = (Math.imul(current, 1664525) + 1013904223) >>> 0; return current / 0x100000000; };
}
