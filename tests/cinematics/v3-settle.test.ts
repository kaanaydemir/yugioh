// A3 Y1b — the pre-contact idle settle (src/cinematics/_v3/posematch.ts; A3_MIMARI §10, REHBER HA-21 /
// KK-4): a blow on a resting v3 body lands on a frame its struck pose continues (idle f0, or another
// idle frame within KK-4 of every struck f0), the idle loop steered there by one even time scale,
// holds × 0.65 … × 1.35, no frame skipped.
//
// The planner is checked against a model of Phaser 3.90's AnimationState stepping (accumulator +=
// delta × timeScale; one frame advance when it reaches the frame's hold, the hold subtracted), on
// the slice's own idle holds; the runtime part (settleBefore / endSettle) on a fake unit.

import { describe, expect, it } from 'vitest';
import { SETTLE_STRETCH, endSettle, planSettle, settleBefore, strikeContactIn, struckGoal, type SettleGoal, type SettleLoop } from '../../src/cinematics/_v3/posematch';
import type { MonsterUnit } from '../../src/duel/MonsterUnit';

const TICK = 1000 / 60;
/** src/art/monsters-v3/crystal_wyrm-anims.ts IDLE_HOLDS, abyss_magus-anims.ts IDLE_HOLDS. */
const WYRM = Array.from({ length: 20 }, (_, f) => (f === 16 ? 80 : 100));
const MAGUS = [120, 110, 110, 130, 150, 130, 110, 110, 120, 110, 110, 130, 150, 130, 110, 110];
const S_MIN = 1 / (1 + SETTLE_STRETCH);
const S_MAX = 1 / (1 - SETTLE_STRETCH);

/** Phaser's stepping from `loop` at `speed`: the frame on screen on the last render before `contactIn`, and every frame's time on screen. */
function simulate(holds: readonly number[], loop: SettleLoop, speed: number, contactIn: number): { last: number; shown: { f: number; ms: number }[]; skipped: boolean } {
  let f = loop.frame;
  let acc = loop.into;
  const shown: { f: number; ms: number }[] = [{ f, ms: 0 }];
  let skipped = false;
  let t = 0;
  let last = f;
  for (;;) {
    t += TICK;
    if (t >= contactIn) break; // this render shows the struck pose
    acc += TICK * speed;
    if (acc >= holds[f]) {
      acc -= holds[f];
      const nf = (f + 1) % holds.length;
      if (acc >= holds[nf]) skipped = true; // (never: holds ≫ a tick)
      f = nf;
      shown.push({ f, ms: 0 });
    }
    shown[shown.length - 1].ms += TICK;
    last = f;
  }
  return { last, shown, skipped };
}

const goalOf = (targets: number[], cost?: (f: number) => number): SettleGoal => ({ isTarget: (f) => targets.includes(f), cost });

describe('planSettle (pure)', () => {
  it('leaves a loop alone that lands on a target anyway, a tick or more inside it', () => {
    // wyrm f9 + 50 ms, contact in 100 ms (+ half a tick): f10 + 50 ms on the frame before contact (> a tick from both ends)
    const p = planSettle({ holds: WYRM, frame: 9, into: 50 }, 100 + TICK / 2, goalOf([0, 10]));
    expect(p).not.toBeNull();
    expect(p!.speed).toBe(1);
    expect(p!.frame).toBe(10);
    expect(p!.target).toBe(true);
  });

  it('has nothing to plan on a wind-up shorter than three ticks, or a one-frame loop', () => {
    expect(planSettle({ holds: WYRM, frame: 3, into: 0 }, 40, goalOf([0]))).toBeNull();
    expect(planSettle({ holds: [100], frame: 0, into: 0 }, 700, goalOf([0]))).toBeNull();
  });

  for (const [name, holds, targets] of [
    ['crystal_wyrm (targets f0, f10)', WYRM, [0, 10]],
    ['abyss_magus (target f0)', MAGUS, [0]],
  ] as const) {
    it(`${name}: every plan stays within ±35 %, and a target plan shows its target on the frame before contact (Phaser stepping, every phase × wind-up)`, () => {
      const L = holds.reduce((a, b) => a + b, 0);
      let plans = 0;
      let hits = 0;
      let reached = 0;
      for (const contactIn of [340, 450, 583, 683, 900, 1200]) {
        for (let p0 = 0; p0 < L; p0 += 11) {
          let f = 0;
          let s = 0;
          while (s + holds[f] <= p0) s += holds[f++];
          const loop = { holds, frame: f, into: p0 - s };
          const plan = planSettle(loop, contactIn, goalOf([...targets]));
          if (!plan) continue;
          plans++;
          expect(plan.speed).toBeGreaterThanOrEqual(S_MIN - 1e-9);
          expect(plan.speed).toBeLessThanOrEqual(S_MAX + 1e-9);
          expect(plan.hold).toBeCloseTo(1 / plan.speed, 9);
          const sim = simulate(holds, loop, plan.speed, contactIn);
          expect(sim.skipped).toBe(false);
          // every frame the steered loop completed stayed on screen its hold × speed⁻¹, within a tick
          for (const q of sim.shown.slice(1, -1)) {
            expect(q.ms).toBeGreaterThanOrEqual(holds[q.f] * (1 - SETTLE_STRETCH) - TICK - 1e-6);
            expect(q.ms).toBeLessThanOrEqual(holds[q.f] * (1 + SETTLE_STRETCH) + TICK + 1e-6);
          }
          if (plan.target) {
            hits++;
            expect(targets).toContain(sim.last);
            if (sim.last === plan.frame) reached++;
          }
        }
      }
      expect(plans).toBeGreaterThan(100);
      expect(hits).toBeGreaterThan(plans * 0.25);
      expect(reached).toBe(hits);
    }, 30000);
  }

  it('steers to the gentlest target; an unreachable target leaves the loop alone unless a clearly closer frame is in reach', () => {
    // magus at f2 + 27 ms, contact 683 ms away: f0 needs ×2.5 — out of reach
    const loop = { holds: MAGUS, frame: 2, into: 27 };
    const none = planSettle(loop, 683, goalOf([0]));
    expect(none!.speed).toBe(1);
    expect(none!.target).toBe(false);
    // costs (points): a frame in reach that makes the contact local (< 50) and 5+ points better → best effort
    const be = planSettle(loop, 683, goalOf([0], (f) => (f === 9 ? 48 : 70)));
    expect(be!.target).toBe(false);
    expect(be!.frame).toBe(9);
    expect(be!.cost).toBe(48);
    expect(be!.speed).toBeGreaterThanOrEqual(S_MIN);
    expect(be!.speed).toBeLessThanOrEqual(S_MAX);
    // better but still a whole-body change (≥ 50), or less than BEST_EFFORT_GAIN better: untouched
    expect(planSettle(loop, 683, goalOf([0], (f) => (f === 9 ? 60 : 70)))!.speed).toBe(1);
    expect(planSettle(loop, 683, goalOf([0], (f) => (f === 9 ? 47 : 51)))!.speed).toBe(1);
    // saMagusBlocked's wyrm (P2): the untouched loop is 33 ms into f11 at contact, 583 ms after f5 + 50:
    // f10's middle is 83 ms behind → the loop slows (holds × ~1.17) and lands on f10
    const w = planSettle({ holds: WYRM, frame: 5, into: 50 }, 583, goalOf([0, 10]));
    expect(w!.target).toBe(true);
    expect(w!.frame).toBe(10);
    expect(w!.speed).toBeLessThan(1);
    expect(simulate(WYRM, { holds: WYRM, frame: 5, into: 50 }, w!.speed, 583).last).toBe(10);
  });
});

// ---------------------------------------------------------------- the runtime (fake unit)

type Fn = (...a: never[]) => unknown;
class Emitter {
  private readonly m = new Map<string, Fn[]>();
  on(e: string, fn: Fn): this {
    (this.m.get(e) ?? this.m.set(e, []).get(e)!).push(fn);
    return this;
  }
  once(e: string, fn: Fn): this {
    const w = ((...a: never[]) => {
      this.off(e, w);
      return fn(...a);
    }) as Fn;
    return this.on(e, w);
  }
  off(e: string, fn?: Fn): this {
    const l = this.m.get(e);
    if (l) for (let i = l.length - 1; i >= 0; i--) if (!fn || l[i] === fn) l.splice(i, 1);
    return this;
  }
  emit(e: string, ...a: unknown[]): boolean {
    for (const fn of [...(this.m.get(e) ?? [])]) (fn as (...b: unknown[]) => unknown)(...a);
    return true;
  }
  count(e: string): number {
    return this.m.get(e)?.length ?? 0;
  }
}

function fakeUnit(holds: readonly number[], frame: number, into: number, attack?: { holds: number[]; contact?: number }) {
  const sceneEvents = new Emitter();
  const spriteEvents = new Emitter();
  const anims = { isPlaying: true, forward: true, timeScale: 1, accumulator: into, currentAnim: { key: 'mon:test:idle' } as { key: string } | null };
  const sprite = {
    active: true,
    visible: true,
    anims,
    frame: { name: `idle:${frame}` },
    on: (e: string, fn: Fn) => spriteEvents.on(e, fn),
    off: (e: string, fn?: Fn) => spriteEvents.off(e, fn),
    once: (e: string, fn: Fn) => spriteEvents.once(e, fn),
  };
  const emitted: unknown[][] = [];
  const scene = {
    events: Object.assign(sceneEvents, {}),
    tweens: { timeScale: 1 },
  };
  const origEmit = sceneEvents.emit.bind(sceneEvents);
  sceneEvents.emit = (e: string, ...a: unknown[]) => {
    if (e.startsWith('v3:')) emitted.push([e, ...a]);
    return origEmit(e, ...a);
  };
  const aspec = attack ? { frames: attack.holds.length, fps: 10, holds: attack.holds, marks: attack.contact !== undefined ? { contact: attack.contact } : {} } : undefined;
  const range = (h: readonly number[], a: number, b: number) => h.slice(a, b).reduce((x, y) => x + y, 0);
  const u = {
    uid: 7,
    sprite,
    scene,
    retired: false,
    position: 'attack',
    guarding: false,
    sheetKey: 'mon:test',
    p1Key: 'mon:test',
    p2Key: 'mon:test:p2',
    frameInfo() {
      const n = String(sprite.frame.name);
      return { anim: n.slice(0, n.indexOf(':')), frame: Number(n.slice(n.indexOf(':') + 1)) };
    },
    frameCount: (a: string) => (a === 'idle' ? holds.length : a === 'attack' && aspec ? aspec.frames : 0),
    frameMs: (a: string, f: number) => (a === 'idle' ? holds[f] : 0),
    spec: (a: string) => (a === 'attack' ? aspec : undefined),
    rangeMs: (a: string, x: number, y: number) => (a === 'attack' && aspec ? range(aspec.holds, x, y) : 0),
    has: () => false,
  };
  /** One game frame: the anim steps like Phaser's (scene UPDATE listeners run after it). */
  const step = () => {
    if (anims.isPlaying && anims.currentAnim) {
      anims.accumulator += TICK * anims.timeScale;
      const n = String(sprite.frame.name);
      const f = Number(n.slice(n.indexOf(':') + 1));
      if (n.startsWith('idle:') && anims.accumulator >= holds[f]) {
        anims.accumulator -= holds[f];
        sprite.frame.name = `idle:${(f + 1) % holds.length}`;
      }
    }
    sceneEvents.emit('update', 0, TICK);
  };
  return { u: u as unknown as MonsterUnit, anims, sprite, spriteEvents, sceneEvents, step, emitted };
}

describe('settleBefore / endSettle (runtime)', () => {
  it('steers the idle through anims.timeScale, lands on the target before contact and hands the speed back when the struck pose starts', () => {
    // magus at f12 + 40 ms; contact in 700 ms: the middle of the next f0 is 520 ms of loop away → slowed (×0.75)
    const t = fakeUnit(MAGUS, 12, 40);
    const plan = settleBefore(t.u, 700, goalOf([0]));
    expect(plan).not.toBeNull();
    expect(plan!.target).toBe(true);
    expect(plan!.speed).toBeLessThan(1);
    expect(plan!.hold).toBeLessThanOrEqual(1 + SETTLE_STRETCH);
    expect(t.anims.timeScale).toBeCloseTo(plan!.speed, 9);
    expect(t.emitted.some((e) => e[0] === 'v3:settle' && e[1] === 7)).toBe(true);
    let el = 0;
    let last = '';
    while (el + TICK < 700) {
      t.step();
      el += TICK;
      last = String(t.sprite.frame.name);
    }
    expect(last).toBe('idle:0');
    // the contact: the struck pose starts (Phaser emits animationstart inside play())
    t.anims.currentAnim = { key: 'mon:test:hit' };
    t.sprite.frame.name = 'hit:0';
    t.spriteEvents.emit('animationstart');
    expect(t.anims.timeScale).toBe(1);
    expect(t.spriteEvents.count('animationstart')).toBe(0);
    expect(t.sceneEvents.count('update')).toBe(0);
  });

  it('ends on its own one tick after the planned contact, and leaves a time scale someone else set', () => {
    const t = fakeUnit(MAGUS, 12, 40);
    const plan = settleBefore(t.u, 400, goalOf([0, 15]));
    expect(plan).not.toBeNull();
    if (plan!.speed !== 1) {
      for (let el = 0; el < 400 + 3 * TICK; el += TICK) t.step();
      expect(t.anims.timeScale).toBe(1);
    }
    const t2 = fakeUnit(MAGUS, 12, 40);
    const p2 = settleBefore(t2.u, 700, goalOf([0]));
    expect(p2!.speed).not.toBe(1);
    // a play with its own time scale (MonsterUnit.playRange sets it before play())
    t2.anims.timeScale = 0.5;
    t2.spriteEvents.emit('animationstart');
    expect(t2.anims.timeScale).toBe(0.5);
  });

  it('does nothing for a unit that does not rest: defense position, guarding, another anim, or a time scale already set', () => {
    for (const k of ['defense', 'guarding', 'anim', 'scaled'] as const) {
      const t = fakeUnit(MAGUS, 12, 40);
      const u = t.u as unknown as { position: string; guarding: boolean };
      if (k === 'defense') u.position = 'defense';
      if (k === 'guarding') u.guarding = true;
      if (k === 'anim') t.sprite.frame.name = 'attack:2';
      if (k === 'scaled') t.anims.timeScale = 0.8;
      expect(settleBefore(t.u, 700, goalOf([0]))).toBeNull();
      expect(t.anims.timeScale).toBe(k === 'scaled' ? 0.8 : 1);
    }
  });

  it('a re-plan replaces the running settle; endSettle hands the speed back at once', () => {
    const t = fakeUnit(MAGUS, 12, 40);
    settleBefore(t.u, 900, goalOf([0]));
    for (let i = 0; i < 10; i++) t.step();
    const p = settleBefore(t.u, 700, goalOf([0]));
    expect(p).not.toBeNull();
    expect(t.spriteEvents.count('animationstart')).toBe(p!.speed === 1 ? 0 : 1);
    endSettle(t.u);
    expect(t.anims.timeScale).toBe(1);
    expect(t.sceneEvents.count('update')).toBe(0);
  });

  it("strikeContactIn: the attack's 'contact' mark from the frame shown (or a given start frame); null without one", () => {
    const a = fakeUnit(WYRM, 0, 0, { holds: [60, 90, 100, 160, 110, 70, 90, 100], contact: 6 });
    // the wyrm's strike: from the frame after the charge pose (f2) to the contact mark (f6)
    expect(strikeContactIn(a.u, 2)).toBe(100 + 160 + 110 + 70);
    a.sprite.frame.name = 'attack:3';
    a.anims.accumulator = 40;
    expect(strikeContactIn(a.u)).toBe(160 + 110 + 70 - 40);
    a.sprite.frame.name = 'attack:6';
    expect(strikeContactIn(a.u)).toBeNull();
    const b = fakeUnit(WYRM, 0, 0, { holds: [60, 90, 100, 160], contact: undefined });
    b.sprite.frame.name = 'attack:1';
    expect(strikeContactIn(b.u)).toBeNull();
  });
});

// ---------------------------------------------------------------- the goal on the slice art

describe('struckGoal (the frames a blow may land on, read off the sheet)', () => {
  it('on the slice art, drawn as the game draws it: crystal_wyrm idle f0 and f10 (its breath plateau) qualify on both light sides, abyss_magus only f0', async () => {
    const { loadRegistry, FrameStore } = await import('../../tools/lib/framelib');
    const { animSpec } = await import('../../src/art/animtime');
    const reg = await loadRegistry('v3');
    const want: Record<string, number[]> = { crystal_wyrm: [0, 10], abyss_magus: [0] };
    for (const id of Object.keys(want)) {
      const art = reg.monsterArt(id);
      const st = new FrameStore(art);
      for (const side of [undefined, { lightFrom: 'right' as const }]) {
        const n = animSpec(art, 'idle')!.frames;
        const idle = Array.from({ length: n }, (_, f) => st.get('idle', f, side).data);
        const struck = (['hit', 'hitHeavy', 'hitMagic', 'death'] as const).filter((a) => animSpec(art, a)).map((a) => st.get(a, 0, side).data);
        const g = struckGoal(idle, struck);
        expect(g).not.toBeNull();
        expect(Array.from({ length: n }, (_, f) => f).filter((f) => g!.isTarget(f))).toEqual(want[id]);
        // the cost of a target is within KK-4 of every localised struck f0, never 50 % or more
        for (const f of want[id]) expect(g!.cost!(f)).toBeLessThan(50);
      }
    }
  }, 60000);

  it('gives no goal when no struck f0 is drawn from idle f0 (it changes half the body or more), and f0 is always a target otherwise', () => {
    const px = (on: number[]) => {
      const d = new Uint8ClampedArray(4 * 4 * 4);
      for (const i of on) d.set([200, 100, 50, 255], i * 4);
      return d;
    };
    const idle = [px([0, 1, 2, 3, 4, 5, 6, 7]), px([0, 1, 2, 3, 4, 5, 10, 11]), px([8, 9, 10, 11, 12, 13, 14, 15])];
    // struck = idle f0 with one pixel moved (2 of 8 opaque pixels change: 25 %)
    expect(struckGoal(idle, [px([0, 1, 2, 3, 4, 5, 6, 9])])!.isTarget(0)).toBe(true);
    // f1 differs from the struck pose in half the body (50 %): not a target; f2 is another body
    const g = struckGoal(idle, [px([0, 1, 2, 3, 4, 5, 6, 9])])!;
    expect([0, 1, 2].filter((f) => g.isTarget(f))).toEqual([0]);
    // a struck pose that changes the whole body is not drawn from idle f0: no goal
    expect(struckGoal(idle, [px([8, 9, 10, 11, 12, 13, 14, 15])])).toBeNull();
    expect(struckGoal(idle, [])).toBeNull();
  });
});
