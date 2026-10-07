// Test-mode clock for deterministic films of async cinematics (?test=1, tools/shot.mjs).
//
// main.ts's step(ms) runs every frame back-to-back inside one task, so `await` continuations of
// a cinematic only advance between steps (a film of a promise-chained cinematic stretches). This
// wraps step() so it yields a macrotask after every 1/60 s frame (Date.now is already virtualized
// by main.ts while frozen). Same flag as the previews' installVirtualClock, so it installs once.
//
// armOnFreeze(fn): run fn on the first freeze() — films start exactly at t = 0 of an action.

type Neon = Window['__neon'] & { __virtualClock?: boolean; __duelArmed?: (() => void)[] };

export function installTestClock(): void {
  const neon = window.__neon as Neon;
  if (!neon || neon.__virtualClock) return;
  neon.__virtualClock = true;
  const step = neon.step.bind(neon);
  (neon as unknown as { step: (ms: number) => Promise<void> }).step = async (ms: number) => {
    const dt = 1000 / 60;
    const n = Math.max(1, Math.round(ms / dt));
    for (let i = 0; i < n; i++) {
      step(dt);
      await new Promise<void>((r) => setTimeout(r, 0));
    }
  };
  const freeze = neon.freeze.bind(neon);
  neon.freeze = () => {
    freeze();
    const fns = neon.__duelArmed?.splice(0) ?? [];
    for (const f of fns) {
      try {
        f();
      } catch (e) {
        console.error('[testClock] armed fn failed', e);
      }
    }
  };
}

/** Run `fn` right after the next freeze() (tools/shot.mjs --film / --step call it). */
export function armOnFreeze(fn: () => void): void {
  const neon = window.__neon as Neon;
  if (!neon.__duelArmed) neon.__duelArmed = [];
  neon.__duelArmed.push(fn);
}
