// A1 item 6 — the single show clock (src/duel/showclock.ts): nested hit-stops, speed kept through
// stops, pause (and what still runs while paused), show time, and the shake / hologram clock.
// Runs on a fake scene (no Phaser in node): an event emitter plus the few manager fields the clock
// owns, with a timer clock and tweens that behave like Phaser's (delta × own scale × manager scale).

import { describe, expect, it } from 'vitest';
import type Phaser from 'phaser';
import { ShowClock, peekShowClock, showClock } from '../../src/duel/showclock';

type Fn = (...a: unknown[]) => void;

class Emitter {
  private m = new Map<string, { fn: Fn; once: boolean }[]>();
  on(e: string, fn: Fn) {
    const l = this.m.get(e) ?? [];
    l.push({ fn, once: false });
    this.m.set(e, l);
  }
  once(e: string, fn: Fn) {
    const l = this.m.get(e) ?? [];
    l.push({ fn, once: true });
    this.m.set(e, l);
  }
  off(e: string, fn: Fn) {
    const l = this.m.get(e);
    if (l) this.m.set(e, l.filter((x) => x.fn !== fn));
  }
  emit(e: string, ...a: unknown[]) {
    const l = [...(this.m.get(e) ?? [])];
    for (const x of l) {
      if (x.once) this.off(e, x.fn);
      x.fn(...a);
    }
  }
  count(e: string) {
    return (this.m.get(e) ?? []).length;
  }
}

/** Phaser-like timer event + clock (Clock.update semantics: elapsed += delta × scale). */
class FakeTimer {
  elapsed = 0;
  paused = false;
  fired = false;
  constructor(
    readonly delay: number,
    readonly cb: () => void,
  ) {}
}
class FakeClock {
  timeScale = 1;
  _active: FakeTimer[] = [];
  _pendingInsertion: FakeTimer[] = [];
  delayedCall(delay: number, cb: () => void): FakeTimer {
    const t = new FakeTimer(delay, cb);
    this._pendingInsertion.push(t);
    return t;
  }
  preUpdate() {
    this._active.push(...this._pendingInsertion.splice(0));
  }
  update(_time: number, delta: number) {
    const d = delta * this.timeScale;
    for (const e of this._active) {
      if (e.paused || e.fired) continue;
      e.elapsed += d;
      if (e.elapsed >= e.delay) {
        e.fired = true;
        e.cb();
      }
    }
  }
}

/** Phaser-like tween: update(delta) scales by its own and the manager's timeScale. */
class FakeTween {
  elapsed = 0;
  done = false;
  dead = false;
  constructor(
    readonly parent: FakeTweens,
    readonly duration: number,
  ) {}
  update(delta: number): boolean {
    if (this.done) return true;
    this.elapsed += delta * this.parent.timeScale;
    if (this.elapsed >= this.duration) this.done = true;
    return this.done;
  }
  isPendingRemove() {
    return this.done;
  }
  isDestroyed() {
    return this.dead;
  }
  destroy() {
    this.dead = true;
  }
}
class FakeTweens {
  timeScale = 1;
  processing = false;
  tweens: FakeTween[] = [];
  add(duration: number): FakeTween {
    const t = new FakeTween(this, duration);
    this.tweens.push(t);
    return t;
  }
  update(delta: number) {
    const done = this.tweens.filter((t) => t.update(delta));
    this.tweens = this.tweens.filter((t) => !done.includes(t));
  }
}

/** Phaser.Cameras.Scene2D.Effects.Shake, reduced: elapsed += delta, offset re-rolled each update. */
class FakeShake {
  isRunning = false;
  duration = 0;
  progress = 0;
  _elapsed = 0;
  _offsetX = 0;
  _offsetY = 0;
  rolls = 0;
  private cb: ((c: unknown, p: number) => void) | null = null;
  constructor(readonly cam: FakeCamera) {}
  start(ms: number, cb: (c: unknown, p: number) => void) {
    this.isRunning = true;
    this.duration = ms;
    this._elapsed = 0;
    this._offsetX = this._offsetY = 0;
    this.progress = 0;
    this.cb = cb;
    this.cam.emit('camerashakestart');
  }
  update(_time: number, delta: number) {
    if (!this.isRunning) return;
    this._elapsed += delta;
    this.progress = Math.min(1, this._elapsed / this.duration);
    this.cb?.(this.cam, this.progress);
    if (this._elapsed < this.duration) {
      this.rolls++;
      this._offsetX = 1 + (this.rolls % 3);
      this._offsetY = 1;
    } else this.isRunning = false;
  }
}
class FakeCamera extends Emitter {
  shakeEffect: FakeShake;
  constructor(readonly scene: object) {
    super();
    this.shakeEffect = new FakeShake(this);
  }
  shake(ms: number, _i: number, _f: boolean, cb: (c: unknown, p: number) => void) {
    this.shakeEffect.start(ms, cb);
  }
}

const DT = 1000 / 60;

class FakeScene {
  events = new Emitter();
  tweens = new FakeTweens();
  time = new FakeClock();
  anims = { globalTimeScale: 1 };
  game = { loop: { time: 5000 } };
  cameras: { main: FakeCamera };
  constructor() {
    this.cameras = { main: new FakeCamera(this) };
  }
  /** One game frame, in Phaser's order (pre-update, update listeners, camera). */
  frame(dt = DT) {
    this.game.loop.time += dt;
    const t = this.game.loop.time;
    this.time.preUpdate();
    this.events.emit('preupdate', t, dt);
    // the scene managers' UPDATE listeners come first (registered at scene boot: timers, tweens,
    // cameras), then every listener added later (the clock's tick, freeze countdowns, effects)
    this.time.update(t, dt);
    this.tweens.update(dt);
    this.cameras.main.shakeEffect.update(t, dt);
    this.events.emit('update', t, dt);
  }
  frames(n: number, dt = DT) {
    for (let i = 0; i < n; i++) this.frame(dt);
  }
  /** Run frames until `ms` of loop time passed. */
  run(ms: number) {
    const end = this.game.loop.time + ms - 1e-6;
    while (this.game.loop.time < end) this.frame();
  }
  get scales() {
    return [this.tweens.timeScale, this.time.timeScale, this.anims.globalTimeScale];
  }
  asScene() {
    return this as unknown as Phaser.Scene;
  }
}

function mk(opts: { strictFx?: boolean; legacyThaw?: boolean } = {}) {
  const sc = new FakeScene();
  const clock = showClock(sc.asScene());
  if (opts.strictFx !== undefined) clock.strictFx = opts.strictFx;
  if (opts.legacyThaw !== undefined) clock.legacyThaw = opts.legacyThaw;
  return { sc, clock };
}

/** SpeedControl's part of a frame: it writes the speed it wants every PRE_UPDATE. */
function speedControl(sc: FakeScene, clock: ShowClock, value: () => number) {
  sc.events.on('preupdate', () => clock.setSpeed(value(), 1));
}

/** Loop time (ms) at which a promise resolves, stepping frames. */
async function resolvesAt(sc: FakeScene, p: Promise<void>, max = 5000): Promise<number> {
  let done = false;
  void p.then(() => (done = true));
  const t0 = sc.game.loop.time;
  while (!done && sc.game.loop.time - t0 < max) {
    sc.frame();
    await Promise.resolve();
    await Promise.resolve();
  }
  return sc.game.loop.time - t0;
}

describe('ShowClock: one clock per scene', () => {
  it('is made on first use, reused, and disposed on SHUTDOWN (scales back to 1×, listeners gone)', () => {
    const { sc, clock } = mk();
    expect(showClock(sc.asScene())).toBe(clock);
    clock.setSpeed(2);
    void clock.freeze(100);
    const r = clock.pause();
    expect(sc.events.count('update')).toBe(2); // tick + the freeze countdown
    sc.events.emit('shutdown');
    expect(clock.isDisposed).toBe(true);
    expect(peekShowClock(sc.asScene())).toBeUndefined();
    expect(sc.events.count('update')).toBe(0);
    expect(sc.scales).toEqual([1, 1, 1]);
    r(); // releasing after the scene is gone is harmless
    expect(showClock(sc.asScene())).not.toBe(clock);
  });

  it('adopts a speed set before it existed', () => {
    const sc = new FakeScene();
    sc.tweens.timeScale = sc.time.timeScale = sc.anims.globalTimeScale = 3;
    expect(new ShowClock(sc.asScene()).speed).toBe(3);
  });
});

describe('ShowClock: nested hit-stops', () => {
  it('a single freeze holds every scale at 0 for its real ms, then gives the speed back', async () => {
    const { sc, clock } = mk();
    clock.setSpeed(3);
    const p = clock.freeze(100);
    expect(sc.scales).toEqual([0, 0, 0]);
    const at = await resolvesAt(sc, p);
    expect(at).toBeGreaterThanOrEqual(100);
    expect(at).toBeLessThan(100 + DT + 1e-6);
    expect(sc.scales).toEqual([3, 3, 3]);
  });

  it('overlapping freezes merge into one that ends with the longest; every caller resolves then', async () => {
    const { sc, clock } = mk();
    const ends: number[] = [];
    const t0 = sc.game.loop.time;
    const mark = (p: Promise<void>) => void p.then(() => ends.push(Math.round(sc.game.loop.time - t0)));
    mark(clock.freeze(100));
    sc.run(30);
    mark(clock.freeze(50)); // inside: shorter than what is left → no change
    sc.run(30);
    const t3 = sc.game.loop.time - t0;
    mark(clock.freeze(120)); // inside: longer → the freeze now ends 120 ms after this call
    for (let i = 0; i < 20; i++) {
      sc.frame();
      await Promise.resolve();
      expect(clock.frozen || sc.game.loop.time - t0 >= t3 + 120 - 1e-6).toBe(true);
      if (clock.frozen) expect(sc.scales).toEqual([0, 0, 0]);
    }
    await Promise.resolve();
    expect(ends.length).toBe(3);
    expect(new Set(ends).size).toBe(1);
    // the first frame at or after t3 + 120 (the first call alone would have ended at 100)
    expect(ends[0]).toBeGreaterThanOrEqual(Math.round(t3 + 120));
    expect(ends[0]).toBeLessThan(t3 + 120 + DT);
    expect(sc.scales).toEqual([1, 1, 1]);
  });

  it('a stop started inside another never restores 1× (regression: old combat.stopTime in core.hitStop)', async () => {
    const { sc, clock } = mk();
    clock.setSpeed(2);
    const a = clock.freeze(60);
    sc.run(20);
    const b = clock.freeze(30);
    await resolvesAt(sc, Promise.all([a, b]).then(() => undefined));
    expect(sc.scales).toEqual([2, 2, 2]); // not 1, not 0
  });

  it('v3: a speed change during a freeze is kept and applied the moment time flows (no 1-frame drift)', async () => {
    const { sc, clock } = mk({ legacyThaw: false });
    const p = clock.freeze(50);
    clock.setSpeed(0.35, 1); // e.g. slowMo starting inside the stop
    expect(sc.scales).toEqual([0, 0, 0]);
    await resolvesAt(sc, p);
    expect(sc.scales).toEqual([0.35, 0.35, 0.35]);
  });

  it('v1 / v2 (legacyThaw): a stop gives back the speed it began with until SpeedControl writes again (the old one-frame drift)', () => {
    const { sc, clock } = mk({ legacyThaw: true });
    let want = 1;
    speedControl(sc, clock, () => want);
    sc.frame();
    void clock.freeze(50); // combat.stopTime at 1×
    sc.frame();
    want = 0.7; // gameOver's slowMo inside the stop
    const seen: number[] = [];
    let ended = -1;
    for (let i = 0; i < 6; i++) {
      sc.frame();
      if (ended < 0 && !clock.frozen) {
        ended = i;
        seen.push(sc.tweens.timeScale); // the rest of the frame the stop ended in
      } else if (ended >= 0) seen.push(sc.tweens.timeScale);
    }
    expect(ended).toBeGreaterThanOrEqual(0);
    // the frame it ends in: 1× (saved), the next frames: 0.7 (written at their PRE_UPDATE)
    expect(seen[0]).toBe(1);
    expect(seen.slice(1).every((k) => k === 0.7)).toBe(true);
  });

  it('v1 / v2 (legacyThaw): core.hitStop keeps 0 to the end of the frame it ends in, then its saved speed', async () => {
    const { sc, clock } = mk({ legacyThaw: true });
    clock.setSpeed(2);
    let resolved = false;
    void clock.freeze(40, 'hit').then(() => (resolved = true));
    let n = 0;
    while (clock.frozen && n++ < 10) sc.frame();
    expect(clock.frozen).toBe(false);
    expect(sc.scales).toEqual([0, 0, 0]); // still the frame the stop ended in (old: before `await` returned)
    await Promise.resolve();
    expect(sc.scales).toEqual([2, 2, 2]);
    await Promise.resolve();
    expect(resolved).toBe(true);
  });

  it('stopped scene clocks really stop: timers and tweens do not advance during the freeze', async () => {
    const { sc, clock } = mk();
    let fired = 0;
    sc.time.delayedCall(50, () => fired++);
    const tw = sc.tweens.add(200);
    sc.frame();
    const p = clock.freeze(100);
    const before = tw.elapsed;
    sc.run(90);
    expect(fired).toBe(0);
    expect(tw.elapsed).toBe(before);
    await resolvesAt(sc, p);
    sc.run(60);
    expect(fired).toBe(1);
  });

  it('freeze(0) / negative resolve at once and freeze nothing', async () => {
    const { sc, clock } = mk();
    await clock.freeze(0);
    await clock.freeze(-5);
    expect(clock.frozen).toBe(false);
    expect(sc.scales).toEqual([1, 1, 1]);
  });
});

describe('ShowClock: pause (the duel menu)', () => {
  it('holds the scales at 0, stops show time and the hit-stop countdown; nested; release is idempotent', async () => {
    const { sc, clock } = mk();
    clock.setSpeed(2);
    const stop = clock.freeze(100);
    sc.run(40);
    const r1 = clock.pause();
    const r2 = clock.pause();
    const now0 = clock.now;
    sc.run(1000);
    expect(sc.scales).toEqual([0, 0, 0]);
    expect(clock.now).toBe(now0);
    expect(clock.frozen).toBe(true); // the 60 ms left of the stop are still left
    r1();
    r1();
    sc.run(200);
    expect(clock.paused).toBe(true); // one pause still held
    r2();
    expect(clock.paused).toBe(false);
    const at = await resolvesAt(sc, stop);
    expect(at).toBeGreaterThanOrEqual(60 - DT);
    expect(at).toBeLessThanOrEqual(60 + DT);
    expect(sc.scales).toEqual([2, 2, 2]);
  });

  it('show time follows the scale: speed counts, freezes and pauses do not', () => {
    const { sc, clock } = mk();
    const n0 = clock.now;
    sc.frames(60); // 1 s at 1×
    clock.setSpeed(3);
    sc.frames(60); // 1 s at 3×
    void clock.freeze(500);
    sc.frames(30); // frozen
    const r = clock.pause();
    sc.frames(60);
    r();
    expect(clock.now - n0).toBeCloseTo(1000 + 3000, 6);
  });

  it('what existed when the pause began stays frozen; what the menu makes while paused runs at 1×', () => {
    const { sc, clock } = mk();
    clock.setSpeed(3);
    let showFired = 0;
    let menuFired = 0;
    sc.time.delayedCall(100, () => showFired++);
    const showTween = sc.tweens.add(300);
    sc.frame();
    const elapsed0 = showTween.elapsed;
    const release = clock.pause();
    // the menu: a 170 ms unfold tween and a 150 ms confirm timer, made after the pause began
    const menuTween = sc.tweens.add(170);
    sc.time.delayedCall(150, () => menuFired++);
    sc.run(200);
    expect(showTween.elapsed).toBe(elapsed0);
    expect(showFired).toBe(0);
    expect(menuFired).toBe(1);
    expect(menuTween.dead).toBe(true); // completed and removed like TweenManager.step does
    expect(sc.tweens.tweens).not.toContain(menuTween);
    expect(sc.scales).toEqual([0, 0, 0]);
    release();
    sc.run(50);
    expect(showTween.elapsed).toBeGreaterThan(elapsed0);
    expect(sc.scales).toEqual([3, 3, 3]);
  });
});

describe('ShowClock: shake and hologram time', () => {
  function shakeFrames(sc: FakeScene, clock: ShowClock, ms: number, before?: () => void): number {
    clock.bindShake(sc.cameras.main as unknown as Phaser.Cameras.Scene2D.Camera);
    let done = false;
    sc.cameras.main.shake(ms, 0, true, (_c, p) => {
      if (p >= 1) done = true;
    });
    before?.();
    let n = 0;
    while (!done && n < 1000) {
      sc.frame();
      n++;
    }
    return n;
  }

  it('v3: at 3× a shake lasts a third of its frames', () => {
    const a = mk({ strictFx: true });
    const n1 = shakeFrames(a.sc, a.clock, 300);
    const b = mk({ strictFx: true });
    b.clock.setSpeed(3);
    const n3 = shakeFrames(b.sc, b.clock, 300);
    expect(n1).toBe(18); // 300 ms at 60 fps
    expect(n3).toBe(6); // 100 ms
  });

  it('v1 / v2 (no look switch): a shake is real time exactly as before — any speed, hit-stop or pause', () => {
    const a = mk({ strictFx: false });
    expect(shakeFrames(a.sc, a.clock, 300, () => void a.clock.freeze(100))).toBe(18);
    const b = mk({ strictFx: false });
    b.clock.setSpeed(3);
    expect(shakeFrames(b.sc, b.clock, 300)).toBe(18);
    const c = mk({ strictFx: false });
    const r = c.clock.pause();
    expect(shakeFrames(c.sc, c.clock, 300)).toBe(18);
    r();
  });

  it('v3: the pause holds a shake', () => {
    const b = mk({ strictFx: true });
    const r = b.clock.pause();
    b.clock.bindShake(b.sc.cameras.main as unknown as Phaser.Cameras.Scene2D.Camera);
    b.sc.cameras.main.shake(100, 0, true, () => undefined);
    b.sc.frames(30);
    expect(b.sc.cameras.main.shakeEffect._elapsed).toBe(0);
    r();
  });

  it('v3 (strictFx): a hit-stop holds the shake on its first offset (the kick), then it plays in full', () => {
    const { sc, clock } = mk({ strictFx: true });
    clock.bindShake(sc.cameras.main as unknown as Phaser.Cameras.Scene2D.Camera);
    void clock.freeze(100);
    sc.cameras.main.shake(300, 0, true, () => undefined);
    const eff = sc.cameras.main.shakeEffect;
    sc.frame();
    const kick = [eff._offsetX, eff._offsetY];
    expect(kick).not.toEqual([0, 0]);
    for (let i = 0; i < 4; i++) {
      sc.frame();
      expect([eff._offsetX, eff._offsetY]).toEqual(kick); // held
      expect(eff._elapsed).toBe(0);
    }
    // ~6 frozen frames (100 ms) + 18 frames of shake
    let n = 5;
    while (eff.isRunning && n < 100) {
      sc.frame();
      n++;
    }
    expect(n).toBeGreaterThanOrEqual(6 + 18);
    expect(n).toBeLessThanOrEqual(7 + 18);
  });

  it('hologram time: v1 at 1× is exactly game.loop.time, hit-stops included; v3 freezes in a hit-stop', () => {
    const v1 = mk({ strictFx: false });
    void v1.clock.freeze(200);
    v1.sc.frames(30);
    expect(v1.clock.fxNow).toBe(v1.sc.game.loop.time);

    const v3 = mk({ strictFx: true });
    v3.sc.frames(3);
    const t0 = v3.clock.fxNow;
    void v3.clock.freeze(100);
    v3.sc.frames(5); // inside the stop
    expect(v3.clock.fxNow).toBe(t0);
    v3.sc.frames(20);
    expect(v3.clock.fxNow).toBeGreaterThan(t0);
  });

  it('hologram time, v3: 3× runs it 3× fast and the pause holds it', () => {
    const { sc, clock } = mk({ strictFx: true });
    clock.setSpeed(3);
    const t0 = clock.fxNow;
    sc.frames(60);
    expect(clock.fxNow - t0).toBeCloseTo(3000, 6);
    const r = clock.pause();
    const t1 = clock.fxNow;
    sc.frames(60);
    expect(clock.fxNow).toBeCloseTo(t1, 6);
    r();
  });

  it('hologram time, v1 / v2: game.loop.time at any speed and through a pause, as before', () => {
    const { sc, clock } = mk({ strictFx: false });
    clock.setSpeed(3);
    sc.frames(60);
    expect(clock.fxNow).toBe(sc.game.loop.time);
    const r = clock.pause();
    sc.frames(60);
    expect(clock.fxNow).toBe(sc.game.loop.time);
    r();
  });

  it('slow motion: v1 keeps the user speed for shake / hologram, v3 follows it', () => {
    const v1 = mk({ strictFx: false });
    v1.clock.setSpeed(0.35, 1);
    expect(v1.clock.fxScale).toBe(1);
    const v3 = mk({ strictFx: true });
    v3.clock.setSpeed(0.35, 1);
    expect(v3.clock.fxScale).toBe(0.35);
  });
});

describe('ShowClock: v3 presentation tempo (docs/v3/TEMPO.md)', () => {
  it('defaults to 1 and leaves the scales untouched (v1 / v2 never set it)', () => {
    const { sc, clock } = mk();
    clock.setSpeed(2);
    expect(clock.tempo).toBe(1);
    expect(sc.scales).toEqual([2, 2, 2]);
    expect(clock.flowScale).toBe(2);
    expect(clock.snapshot().tempo).toBe(1);
  });

  it('tempo t runs the show t times longer, with the speed setting still on top', () => {
    const { sc, clock } = mk();
    clock.setTempo(1.35);
    expect(sc.scales[0]).toBeCloseTo(1 / 1.35, 9);
    clock.setSpeed(3);
    expect(sc.scales[0]).toBeCloseTo(3 / 1.35, 9);
    expect(clock.flowScale).toBeCloseTo(3 / 1.35, 9);
    const n0 = clock.now;
    clock.setSpeed(1);
    sc.frames(60); // 1 s of loop time
    expect(clock.now - n0).toBeCloseTo(1000 / 1.35, 6);
    clock.setTempo(1);
    expect(sc.scales).toEqual([1, 1, 1]);
  });

  it('a hit-stop holds for ms × the freeze factor of real time; the speed comes back divided by the tempo', async () => {
    const { sc, clock } = mk();
    clock.setTempo(1.35, 1.35 * 1.15);
    const p = clock.freeze(100);
    expect(sc.scales).toEqual([0, 0, 0]);
    expect(clock.flowScale).toBeCloseTo(1 / 1.35, 9);
    const at = await resolvesAt(sc, p);
    const want = 100 * 1.35 * 1.15;
    expect(at).toBeGreaterThanOrEqual(want);
    expect(at).toBeLessThan(want + DT + 1e-6);
    expect(sc.scales[0]).toBeCloseTo(1 / 1.35, 9);
  });

  it('back to tempo 1: freezes are their plain ms again', async () => {
    const { sc, clock } = mk();
    clock.setTempo(1.5);
    clock.setTempo(1);
    const at = await resolvesAt(sc, clock.freeze(100));
    expect(at).toBeGreaterThanOrEqual(100);
    expect(at).toBeLessThan(100 + DT + 1e-6);
  });

  it('dispose resets the tempo', () => {
    const { sc, clock } = mk();
    clock.setTempo(2);
    sc.events.emit('shutdown');
    expect(sc.scales).toEqual([1, 1, 1]);
    expect(clock.tempo).toBe(1);
  });
});
