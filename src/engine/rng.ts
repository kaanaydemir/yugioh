// Deterministic RNG (mulberry32). The engine keeps its generator state in `GameState.rng`
// so a game is fully reproducible from its seed and the sequence of actions.

/** One mulberry32 step: returns a float in [0, 1) and the next state. */
export function mulberry32Step(state: number): { value: number; next: number } {
  const a = (state + 0x6d2b79f5) | 0;
  let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, next: a >>> 0 };
}

/** Draws a float in [0, 1) from an object holding a mulberry32 state in `rng` (mutates it). */
export function nextRandom(holder: { rng: number }): number {
  const r = mulberry32Step(holder.rng);
  holder.rng = r.next;
  return r.value;
}

/** Fisher–Yates shuffle driven by `holder.rng` (mutates both). */
export function shuffleInPlace<T>(holder: { rng: number }, arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(nextRandom(holder) * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
}

/** A standalone generator (used by the bot and tests): returns a function yielding floats in [0, 1). */
export function makeRng(seed: number): () => number {
  const holder = { rng: seed >>> 0 };
  return () => nextRandom(holder);
}
