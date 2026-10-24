// A56.0 hooks (S-8), the graveyard landing count (A6 §2.3) and the S-4 trapPulse contract skeleton.

import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('phaser', async () => (await import('../presentation/_phaser-stub')).phaserStub());

import { landingCount } from '../../src/cinematics/_v3/card';

const G = globalThis as Record<string, unknown>;

afterEach(() => {
  delete G.__NEON_LOOK;
});

describe('graveyard landing count (A6 §2.3)', () => {
  it('one more than shown, capped by the engine state, never down', () => {
    expect(landingCount(0, 1)).toBe(1); // a plain destroy: 0 → 1
    expect(landingCount(3, 5)).toBe(4); // two cards in flight: the first lands on 4 …
    expect(landingCount(4, 5)).toBe(5); // … the second on 5
    expect(landingCount(1, 1)).toBe(1); // tribute set: the pile was synced to 1 while the card flew (no 1 → 2 → 1)
    expect(landingCount(6, 5)).toBe(6); // a later batch already shows more: never goes down
    expect(landingCount(2, undefined)).toBe(3); // no state: as before
    expect(landingCount(2, null)).toBe(3);
  });
});

describe('V3HOOKS (S-8)', () => {
  it('no hook is filled in v1; in v3 only the lanes fill them (all lanes switched off: none)', async () => {
    for (const [look, lanes] of [['v1', ''], ['v3', 'off'], ['v3', '']] as const) {
      vi.resetModules();
      G.__NEON_LOOK = look;
      if (lanes) G.__NEON_V3FLAGS = { a5: lanes, a6: lanes };
      else delete G.__NEON_V3FLAGS;
      const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const { loadCinematics } = await import('../../src/cinematics');
      const loaded = await loadCinematics();
      errors.mockRestore();
      expect(loaded.some((p) => p.includes('v3small/_hooks'))).toBe(true);
      expect(loaded.some((p) => p.includes('flow/draw'))).toBe(true);
      const { filledV3Hooks } = await import('../../src/cinematics/v3small/_hooks');
      if (look === 'v1' || lanes === 'off') expect(filledV3Hooks(), `${look} lanes=${lanes || 'on'}`).toEqual([]);
      else expect(filledV3Hooks().length, 'v3 with the lanes on').toBeGreaterThan(0);
    }
    delete G.__NEON_V3FLAGS;
  }, 60000);
});

describe('S-4 trapPulse (lane A6-B, B4: the v3 decision hook, src/cinematics/v3small/decision.ts)', () => {
  // A scene / views just big enough for TrapMarksV3: graphics, update / shutdown events, the field's
  // set cards (two face-down spell / trap cards of P2, one face-up, one of P1), a calm-arena pad flash.
  type Fn = (...a: unknown[]) => void;
  function fakeScene() {
    const on = new Map<string, Set<Fn>>();
    const events = {
      on(e: string, f: Fn) {
        if (!on.has(e)) on.set(e, new Set());
        on.get(e)!.add(f);
        return events;
      },
      once(e: string, f: Fn) {
        const w: Fn & { orig?: Fn } = (...a) => {
          events.off(e, w);
          f(...a);
        };
        w.orig = f;
        return events.on(e, w);
      },
      off(e: string, f: Fn) {
        for (const h of [...(on.get(e) ?? [])]) if (h === f || (h as Fn & { orig?: Fn }).orig === f) on.get(e)!.delete(h);
        return events;
      },
      emit(e: string, ...a: unknown[]) {
        for (const h of [...(on.get(e) ?? [])]) h(...a);
      },
    };
    const graphics: { active: boolean; rects: number }[] = [];
    const scene = {
      events,
      tweens: { timeScale: 1 },
      add: {
        graphics() {
          const g = {
            active: true,
            rects: 0,
            setDepth: () => g,
            clear: () => ((g.rects = 0), g),
            fillStyle: () => g,
            fillRect: () => ((g.rects += 1), g),
            destroy: () => void (g.active = false),
          };
          graphics.push(g);
          return g;
        },
      },
    };
    const step = (ms: number, n = 1) => {
      for (let i = 0; i < n; i++) events.emit('update', 0, ms);
    };
    return { scene, graphics, step };
  }
  async function fakeViews() {
    const { PixelCanvas } = await import('../../src/art/pixel');
    const card = (x: number, y: number, faceUp: boolean) => {
      const px = new PixelCanvas(12, 8);
      px.rect(1, 1, 10, 6, 0x123456);
      return { faceUp, active: true, standing: false, home: { x, y }, currentPixels: () => ({ px, x: x - 6, y: y - 4 }) };
    };
    const entries = [
      { player: 1, spot: 'spellTrap', index: 0, tile: card(416, 144, false) },
      { player: 1, spot: 'spellTrap', index: 1, tile: card(384, 128, true) },
      { player: 1, spot: 'spellTrap', index: 2, tile: card(352, 112, false) },
      { player: 0, spot: 'spellTrap', index: 0, tile: card(224, 176, false) },
      { player: 1, spot: 'monster', index: 0, tile: card(384, 160, false) },
    ];
    const flashes: unknown[] = [];
    return { views: { field: { tiles: () => entries }, board: { flashTile: (...a: unknown[]) => (flashes.push(a), Promise.resolve()) } }, flashes };
  }
  function fakeCtx(scene: unknown, views: unknown, trigger: unknown) {
    const kept = new Map<string, { destroy(): void }>();
    const waited: number[] = [];
    const ctx = {
      ev: { type: 'decision', pending: { kind: 'trapResponse', player: 1, trigger, options: [12] } },
      scene,
      views,
      keep: (k: string, h: { destroy(): void }) => {
        const old = kept.get(k);
        if (old && old !== h) old.destroy();
        kept.set(k, h);
      },
      take: (k: string) => {
        const h = kept.get(k) ?? null;
        kept.delete(k);
        return h;
      },
      wait: (ms: number) => (waited.push(ms), Promise.resolve()),
      base: () => Promise.resolve(),
    };
    return { ctx, kept, waited };
  }
  const ATTACK = { kind: 'attackDeclared', attackerUid: 6, targetUid: null };
  const SUMMON = { kind: 'summoned', monsterUid: 6 };
  async function load() {
    vi.resetModules();
    G.__NEON_LOOK = 'v3';
    vi.doMock('../../src/view/light', async (orig) => ({
      ...((await orig()) as object),
      lightFlash: () => Promise.resolve(),
      lightPool: () => ({ fadeOut: () => Promise.resolve(), destroy: () => undefined }),
    }));
    const d = await import('../../src/cinematics/v3small/decision');
    const m = await import('../../src/view/v3/TrapPromptV3');
    const k = await import('../../src/cinematics/battle/_kit');
    const { V3HOOKS } = await import('../../src/cinematics/v3small/_hooks');
    return { ...d, ...m, isSetPulse: k.isSetPulse, V3HOOKS };
  }
  afterEach(() => {
    vi.doUnmock('../../src/view/light');
  });

  it('every trapResponse window keeps a trapPulse handle (an empty { destroy } when nothing is marked)', async () => {
    const { decisionV3, V3HOOKS, TrapMarksV3 } = await load();
    expect(V3HOOKS.decision).toBe(decisionV3);
    // the attack window: P2's two face-down spell / trap cards are marked (not the face-up one, not P1's)
    const { scene, graphics, step } = fakeScene();
    const { views, flashes } = await fakeViews();
    const a = fakeCtx(scene, views, ATTACK);
    await decisionV3(a.ctx as never);
    const h = a.kept.get('trapPulse') as InstanceType<typeof TrapMarksV3>;
    expect(h).toBeInstanceOf(TrapMarksV3);
    expect(typeof h.destroy).toBe('function');
    expect(h.marked).toBe(true);
    expect(h.tiles.length).toBe(2);
    expect(a.waited).toEqual([290]); // A2's Chains timing: the marked window holds 300 ms (a frame-rounded 290)
    step(1000 / 60, 30);
    expect(graphics.filter((g) => g.active && g.rects > 0).length).toBeGreaterThanOrEqual(2); // a rim per card
    expect(flashes.length).toBe(2); // each card's pad lights (the calm arena's stepped flash)
    // the summon window: the handle is kept too, empty (nothing marked, nothing drawn)
    const s = fakeScene();
    const b = fakeCtx(s.scene, views, SUMMON);
    await decisionV3(b.ctx as never);
    const e = b.kept.get('trapPulse') as InstanceType<typeof TrapMarksV3>;
    expect(e).toBeInstanceOf(TrapMarksV3);
    expect(e.marked).toBe(false);
    expect(s.graphics.length).toBe(0);
    // a stale handle of an earlier window goes when the next window opens
    await decisionV3(a.ctx as never);
    expect(h.alive).toBe(false);
    expect((a.kept.get('trapPulse') as InstanceType<typeof TrapMarksV3>).alive).toBe(true);
  });

  it('the CPU / scenario summon-window fast path (S-15) marks nothing, ≤ 120 ms, and still keeps trapPulse', async () => {
    const { decisionV3, isFastWindow, openTrapMarks } = await load();
    const { A6_MS } = await import('../../src/view/v3/motion');
    expect(A6_MS.decisionFast.max).toBeLessThanOrEqual(120);
    const { scene, graphics } = fakeScene();
    const { views, flashes } = await fakeViews();
    const c = fakeCtx(scene, views, SUMMON);
    expect(isFastWindow(c.ctx.ev as never)).toBe(true);
    expect(isFastWindow(fakeCtx(scene, views, ATTACK).ctx.ev as never)).toBe(false);
    await decisionV3(c.ctx as never);
    expect(c.waited).toEqual([]); // over at once: no wait at all (≤ 120 ms with room to spare)
    const h = c.kept.get('trapPulse') as { marked: boolean; destroy(): void };
    expect(h).toBeTruthy();
    expect(h.marked).toBe(false);
    expect(graphics.length).toBe(0);
    expect(flashes.length).toBe(0);
    // a person is asked after all: the prompt marks the cards through the same handle
    expect(openTrapMarks(scene as never)).toBe(h);
    openTrapMarks(scene as never)?.mark();
    expect(h.marked).toBe(true);
    expect(graphics.length).toBe(4); // a rim + a node graphics per card
  });

  it('trapOpeningV3 and tb:responseDeclined take the handle and destroy (or settle) it', async () => {
    const { decisionV3, isSetPulse, openTrapMarks } = await load();
    // the takers (unchanged code): both take 'trapPulse'; the decline settles a SetPulse-like handle
    const opening = (await import('../../src/cinematics/traps/_opening.ts?raw')).default as string;
    const declare = (await import('../../src/cinematics/battle/declare.ts?raw')).default as string;
    const v3Body = opening.slice(opening.indexOf('async function trapOpeningV3'));
    expect(v3Body).toMatch(/const pulse = ctx\.take\('trapPulse'\);\s*if \(isSetPulse\(pulse\)\) pulse\.destroy\(\);\s*else pulse\?\.destroy\(\);/);
    const declined = declare.slice(declare.indexOf("'responseDeclined'"));
    expect(declined).toMatch(/const h = ctx\.take\('trapPulse'\);\s*if \(isSetPulse\(h\)\) h\.settle\(PAL\.night4\);\s*else h\?\.destroy\(\);/);
    // the v3 handle is SetPulse-shaped: settle() cools the rims down in palette steps, then they go
    const { scene, graphics, step } = fakeScene();
    const { views } = await fakeViews();
    const a = fakeCtx(scene, views, ATTACK);
    await decisionV3(a.ctx as never);
    const h = a.ctx.take('trapPulse') as unknown as { settle(c?: number): void; destroy(): void; alive: boolean };
    expect(isSetPulse(h as never)).toBe(true);
    step(1000 / 60, 30);
    h.settle(0x3b4c91);
    step(1000 / 60, 3);
    expect(graphics.some((g) => g.active)).toBe(true); // still stepping down
    step(1000 / 60, 6);
    expect(graphics.every((g) => !g.active)).toBe(true); // gone after three palette steps
    expect(h.alive).toBe(true); // a valid, empty handle until it is destroyed
    // the trap opening destroys it: gone at once, idempotent, no longer the open window
    h.destroy();
    h.destroy();
    expect(h.alive).toBe(false);
    expect(openTrapMarks(scene as never)).toBeNull();
    // an unmarked handle (the fast path) settled by a decline is simply destroyed
    const b = fakeCtx(fakeScene().scene, views, SUMMON);
    await decisionV3(b.ctx as never);
    const e = b.ctx.take('trapPulse') as unknown as { settle(): void; alive: boolean };
    e.settle();
    expect(e.alive).toBe(false);
  });
});
