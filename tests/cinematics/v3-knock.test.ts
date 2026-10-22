// A3 Y1 — the hit kit's contact frame (docs/v3/A3_MIMARI.md §10; REHBER HA-11, HA-21, KK-4).
// On the frame a blow lands, the struck sprite stands where it rested: only the recoil's f0 (the
// struck region) changes. The knock-back starts on the first frame change after the contact (the
// recoil's f1, a lethal blow's death pose, the next frame of a body struck from behind), or one tick
// past a held pose's hold; art with knock: 'pose' gets only the rest of knockPx from the kit. A guard
// (MonsterUnit.guardHit) also stands still on its contact frame.
//
// Fake scene / sprite in node, the real MonsterUnit API on top (Object.create of its prototype):
// Phaser itself and the drawing modules (flash, sparks, sound, hologram, badge, textures) are
// stubbed. The fake clock follows Phaser 3.90 / ShowClock: one UPDATE per frame (tweens, then sprite
// animations, then timers, then the listeners added later, e.g. onFrame), a new tween's first update
// only captures its start value, a hit-stop sets every time scale to 0 until it has run out in real
// time, promise continuations run between frames.

import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';

const W = vi.hoisted(() => {
  // the v3 look (decided once at module init by src/view/layout.ts): set before any import runs
  (globalThis as { __NEON_LOOK?: string }).__NEON_LOOK = 'v3';
  const FRAME = 1000 / 60;
  type Listener = (...a: never[]) => unknown;

  class Emitter {
    private readonly m = new Map<string, { fn: Listener; once: boolean }[]>();
    on(e: string, fn: Listener): this {
      this.list(e).push({ fn, once: false });
      return this;
    }
    once(e: string, fn: Listener): this {
      this.list(e).push({ fn, once: true });
      return this;
    }
    off(e: string, fn?: Listener): this {
      const l = this.m.get(e);
      if (l) for (let i = l.length - 1; i >= 0; i--) if (!fn || l[i].fn === fn) l.splice(i, 1);
      return this;
    }
    emit(e: string, ...a: unknown[]): boolean {
      const l = this.m.get(e);
      if (!l || !l.length) return false;
      for (const x of [...l]) {
        if (x.once) this.off(e, x.fn);
        (x.fn as (...b: unknown[]) => unknown)(...a);
      }
      return true;
    }
    count(e: string): number {
      return this.m.get(e)?.length ?? 0;
    }
    private list(e: string) {
      let l = this.m.get(e);
      if (!l) this.m.set(e, (l = []));
      return l;
    }
  }

  const EASE: Record<string, (v: number) => number> = {
    'Quad.Out': (v) => v * (2 - v),
    'Cubic.Out': (v) => (v - 1) ** 3 + 1,
    'Back.Out': (v) => {
      const s = 1.70158;
      const w = v - 1;
      return w * w * ((s + 1) * w + s) + 1;
    },
    'Sine.InOut': (v) => 0.5 * (1 - Math.cos(Math.PI * v)),
  };

  interface TweenCfg {
    targets: { x: number; y: number };
    x?: number;
    y?: number;
    duration: number;
    ease?: string;
    onUpdate?: () => void;
    onComplete?: () => void;
    onStop?: () => void;
  }

  class Tween {
    dead = false;
    private started = false;
    private elapsed = 0;
    private readonly from: Record<string, number> = {};
    private readonly props: Record<string, number> = {};
    constructor(readonly cfg: TweenCfg) {
      if (typeof cfg.x === 'number') this.props.x = cfg.x;
      if (typeof cfg.y === 'number') this.props.y = cfg.y;
    }
    stop(): void {
      if (this.dead) return;
      this.dead = true;
      this.cfg.onStop?.();
    }
    update(dt: number): void {
      if (this.dead) return;
      const t = this.cfg.targets as unknown as Record<string, number>;
      // Phaser 3.90 TweenData PENDING_RENDER: the first update captures the start, no time passes
      if (!this.started) {
        this.started = true;
        for (const k in this.props) this.from[k] = t[k];
        return;
      }
      this.elapsed += dt;
      const p = Math.min(1, this.elapsed / this.cfg.duration);
      const e = EASE[this.cfg.ease ?? ''] ?? ((v: number) => v);
      for (const k in this.props) t[k] = this.from[k] + (this.props[k] - this.from[k]) * e(p);
      this.cfg.onUpdate?.();
      if (p >= 1) {
        this.dead = true;
        this.cfg.onComplete?.();
      }
    }
  }

  interface Spec {
    frames: number;
    hold(f: number): number;
  }

  class Sprite extends Emitter {
    x = 0;
    y = 0;
    active = true;
    visible = true;
    flipX = false;
    depth = 10;
    alpha = 1;
    scaleX = 1;
    scaleY = 1;
    angle = 0;
    frame = { name: 'idle:0' };
    texture = { key: 'fake' };
    private cur: { anim: string; key: string; f: number; acc: number; loop: boolean } | null = null;
    readonly anims = {
      isPlaying: false,
      timeScale: 1,
      stop: (): void => {
        this.cur = null;
        this.anims.isPlaying = false;
      },
    };
    constructor(
      readonly scene: Scene,
      private readonly specOf: (anim: string) => Spec | undefined,
    ) {
      super();
      scene.sprites.push(this);
    }
    setPosition(x: number, y: number): this {
      this.x = x;
      this.y = y;
      return this;
    }
    setFrame(name: string): this {
      this.frame = { name };
      return this;
    }
    /** Phaser: play() shows the start frame at once and emits 'animationstart' (no 'animationupdate'). */
    play(cfg: { key: string; repeat?: number; startFrame?: number }): this {
      const anim = cfg.key.slice(cfg.key.lastIndexOf(':') + 1);
      this.cur = { anim, key: cfg.key, f: cfg.startFrame ?? 0, acc: 0, loop: cfg.repeat === -1 };
      this.anims.isPlaying = true;
      this.frame = { name: `${anim}:${this.cur.f}` };
      this.emit('animationstart');
      return this;
    }
    /** The sprite's animation step (Phaser: UpdateList → Sprite.preUpdate → AnimationState.update). */
    tick(dt: number): void {
      const c = this.cur;
      if (!c || !this.anims.isPlaying || dt <= 0) return;
      const spec = this.specOf(c.anim);
      if (!spec) return;
      c.acc += dt * this.anims.timeScale;
      while (this.cur === c && c.acc >= spec.hold(c.f)) {
        c.acc -= spec.hold(c.f);
        if (c.f + 1 < spec.frames) c.f++;
        else if (c.loop) c.f = 0;
        else {
          this.anims.isPlaying = false;
          this.cur = null;
          this.emit(`animationcomplete-${c.key}`);
          return;
        }
        this.frame = { name: `${c.anim}:${c.f}` };
        this.emit('animationupdate', { key: c.key }, { index: c.f + 1 });
      }
    }
  }

  interface Shot {
    x: number;
    y: number;
    frame: string;
  }

  class Scene {
    readonly events = new Emitter();
    readonly sprites: Sprite[] = [];
    readonly tweens = {
      timeScale: 1,
      list: [] as Tween[],
      add: (cfg: TweenCfg): Tween => {
        const tw = new Tween(cfg);
        this.tweens.list.push(tw);
        return tw;
      },
      killTweensOf: (target: unknown): void => {
        for (const tw of this.tweens.list) if (tw.cfg.targets === target) tw.dead = true;
      },
    };
    readonly time = {
      now: 0,
      timers: [] as { at: number; cb: () => void }[],
      delayedCall: (ms: number, cb: () => void) => {
        this.time.timers.push({ at: this.time.now + ms, cb });
        return { remove: () => undefined };
      },
    };
    readonly anims = { globalTimeScale: 1, exists: () => true };
    readonly textures = { list: {} as Record<string, unknown> };
    /** Rendered frames: per sprite, what each frame showed. */
    readonly shots = new Map<Sprite, Shot[]>();
    private frozen = 0;
    private freshFreeze = false;
    private readonly thaw: (() => void)[] = [];

    /** ShowClock.freeze: every time scale 0 at once; counts down in real time from the next update. */
    freeze(ms: number): Promise<void> {
      this.frozen = Math.max(this.frozen, ms);
      this.freshFreeze = true;
      this.setScale(0);
      return new Promise((r) => this.thaw.push(r));
    }
    private setScale(k: number): void {
      this.tweens.timeScale = k;
      this.anims.globalTimeScale = k;
    }
    /** One game frame, then the promise continuations queued during it; then its render. */
    async step(n = 1): Promise<void> {
      for (let i = 0; i < n; i++) {
        this.freshFreeze = false;
        const dt = FRAME * this.tweens.timeScale;
        // UPDATE: the tween manager (skips a frozen step), the update list (sprite anims), the clock
        if (dt > 0) for (const tw of [...this.tweens.list]) tw.update(dt);
        this.tweens.list = this.tweens.list.filter((t) => !t.dead);
        for (const s of this.sprites) s.tick(dt);
        this.time.now += dt;
        for (const t of [...this.time.timers]) {
          if (this.time.now + 1e-9 < t.at) continue;
          this.time.timers.splice(this.time.timers.indexOf(t), 1);
          t.cb();
        }
        // ...the listeners added later (onFrame), the hit-stop countdown
        this.events.emit('update', this.time.now, FRAME);
        if (this.frozen > 0 && !this.freshFreeze) {
          this.frozen -= FRAME;
          if (this.frozen <= 1e-9) {
            this.frozen = 0;
            this.setScale(1);
            for (const r of this.thaw.splice(0)) r();
          }
        }
        this.events.emit('postupdate');
        this.events.emit('prerender');
        for (const s of this.sprites) {
          let l = this.shots.get(s);
          if (!l) this.shots.set(s, (l = []));
          l.push({ x: s.x, y: s.y, frame: s.frame.name });
        }
        await new Promise<void>((r) => setTimeout(r, 0));
      }
    }
    /** The last rendered frame of a sprite. */
    shown(s: Sprite): Shot {
      const l = this.shots.get(s) ?? [];
      return l[l.length - 1];
    }
  }

  return { FRAME, Emitter, Scene, Sprite };
});

vi.mock('phaser', () => ({
  default: {
    GameObjects: { Sprite: class {} },
    BlendModes: { ADD: 1 },
    Animations: { Events: { ANIMATION_UPDATE: 'animationupdate', ANIMATION_START: 'animationstart', ANIMATION_COMPLETE: 'animationcomplete', ANIMATION_COMPLETE_KEY: 'animationcomplete-' } },
    Scenes: { Events: { UPDATE: 'update', POST_UPDATE: 'postupdate', PRE_RENDER: 'prerender', SHUTDOWN: 'shutdown' } },
  },
}));
type FakeScene = InstanceType<typeof W.Scene>;
vi.mock('../../src/vfx/core', () => ({ wait: (sc: FakeScene, ms: number) => new Promise<void>((r) => sc.time.delayedCall(ms, r)) }));
vi.mock('../../src/vfx/combat', () => ({
  // the impact burst: its hit-stop (noStop: none)
  impact: (sc: FakeScene, _x: number, _y: number, o: { noStop?: boolean; stopMs?: number } = {}) => (o.noStop ? Promise.resolve() : sc.freeze(o.stopMs ?? 80)),
  stopTime: (sc: FakeScene, ms: number) => sc.freeze(ms),
  setCombatSfx: () => undefined,
  framePointToWorld: (s: { x: number; y: number }, fx: number, fy: number) => ({ x: s.x + fx, y: s.y + fy }),
}));
vi.mock('../../src/vfx/setpieces', () => ({
  // as the real one: every UPDATE, dt = min(50, delta) × the tween time scale; fn(0, 0) at once
  onFrame: (sc: FakeScene, fn: (dt: number, el: number) => boolean | void) => {
    let el = 0;
    let stopped = false;
    const h = (_t: number, delta: number) => {
      const dt = Math.min(50, delta) * sc.tweens.timeScale;
      el += dt;
      if (fn(dt, el) === false) stop();
    };
    const stop = () => {
      if (stopped) return;
      stopped = true;
      sc.events.off('update', h as never);
    };
    sc.events.on('update', h as never);
    if (fn(0, 0) === false) stop();
    return stop;
  },
  run: () => Promise.resolve(),
  Raster: { around: () => ({ draw: () => undefined, destroy: () => undefined }) },
}));
vi.mock('../../src/vfx/hologram', () => ({ clearHologram: () => undefined, getHologram: () => null }));
vi.mock('../../src/duel/StatBadge', () => ({ StatBadge: class {} }));
vi.mock('../../src/art/textures', () => ({
  monsterAnimKey: (id: string, anim: string) => `${id}:${anim}`,
  monsterFrameName: (anim: string, f: number) => `${anim}:${f}`,
  monsterTextureKey: (id: string) => `mon:${id}`,
  monsterP2TextureKey: (id: string) => `mon:${id}:p2`,
  monsterSheetKey: (id: string) => `mon:${id}`,
  monsterFrame: () => ({ bounds: () => null }),
  warmMonsterSheet: () => undefined,
}));
vi.mock('../../src/cinematics/_v3/flash', () => ({ contactFlash: () => undefined }));
// the fake scene has no sheet pixels, so posematch plans no death entry by itself; a test may plan
// the lethal recoil's entry (A3 core review F1: the death replaces the recoil from its struck f0)
const PLAN = vi.hoisted(() => ({ entry: undefined as unknown }));
vi.mock('../../src/cinematics/_v3/posematch', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../src/cinematics/_v3/posematch')>();
  return {
    ...real,
    planDeathEntry: (...a: Parameters<typeof real.planDeathEntry>) => (PLAN.entry !== undefined ? (PLAN.entry as ReturnType<typeof real.planDeathEntry>) : real.planDeathEntry(...a)),
  };
});
vi.mock('../../src/cinematics/_v3/sound', () => ({
  hitSoundFor: () => null,
  panAt: () => 0,
  play: () => undefined,
  playHit: () => undefined,
  quietCombat: (f: () => unknown) => f(),
  soundsOf: () => null,
  sourceCard: () => null,
}));

import type { CinematicContext } from '../../src/cinematics/_core/types';
import { afterContact, blowSide, drawnKnockPx, kitKnockPx, knock, knockPx, poseTravelPx, reactGuard, reactHit } from '../../src/cinematics/_v3/react';
import type { GameEvent } from '../../src/engine/types';
import { animSpec, frameMs } from '../../src/art/animtime';
import { monsterArtV3 } from '../../src/art/monsters';
import type { MonsterArt } from '../../src/art/types';
import type { MonsterId } from '../../src/data/cards';
import { MonsterUnit } from '../../src/duel/MonsterUnit';
import type { XY } from '../../src/view/layout';

afterAll(() => {
  delete (globalThis as { __NEON_LOOK?: string }).__NEON_LOOK;
});
afterEach(() => {
  PLAN.entry = undefined;
});

type FakeSprite = InstanceType<typeof W.Sprite>;
type Ctx = CinematicContext<GameEvent>;

let nextUid = 1;

/** The real MonsterUnit API over a fake sprite / scene, resting (idle / guard loop) at rest0. */
function unitOf(sc: FakeScene, id: MonsterId, o: { player?: 0 | 1; defense?: boolean; art?: MonsterArt } = {}): { u: MonsterUnit; s: FakeSprite } {
  const art = o.art ?? monsterArtV3(id)!;
  const s = new W.Sprite(sc, (anim) => {
    const spec = animSpec(art, anim as never);
    return spec ? { frames: spec.frames, hold: (f: number) => frameMs(spec, f) } : undefined;
  });
  const u = Object.create(MonsterUnit.prototype) as MonsterUnit;
  const player = o.player ?? 1;
  Object.assign(u as unknown as Record<string, unknown>, {
    scene: sc,
    sprite: s,
    art,
    cardId: id,
    uid: nextUid++,
    player,
    zone: 1,
    position: o.defense ? 'defense' : 'attack',
    p1Key: `mon:${id}`,
    p2Key: `mon:${id}:p2`,
    sheetKey: `mon:${id}`,
    tile: null,
    lift: 0,
    retired: false,
    posed: false,
    guardBroken: false,
    auras: new Map(),
    shown: true,
    playToken: 0,
    waiters: [],
    kbBase: null,
    kbToken: 0,
    kbTween: null,
    braceToken: 0,
    claimed_: false,
    claimPin: null,
    claimFn: null,
    claimDepth: 0,
  });
  const r = u.rest0;
  s.setPosition(r.x, r.y);
  s.flipX = player === 1;
  u.rest();
  return { u, s };
}

const ctxOf = (sc: FakeScene): Ctx => ({ scene: sc }) as unknown as Ctx;

/** The blow travelling from the opponent's side into the unit's front (P2 target: +x). */
const FRONT = (player: 0 | 1): XY => (player === 1 ? { x: 1, y: -0.5 } : { x: -1, y: 0.5 });

/**
 * Follow a contact: the frames rendered from the contact frame on. Returns the contact frame, the
 * index of the first frame showing another frame than the contact frame, and of the first frame
 * whose position differs from rest.
 */
async function follow(sc: FakeScene, s: FakeSprite, rest: XY, frames = 60) {
  const from = (sc.shots.get(s) ?? []).length;
  await sc.step(frames);
  const seq = (sc.shots.get(s) ?? []).slice(from);
  const contact = seq[0];
  const firstChange = seq.findIndex((f) => f.frame !== contact.frame);
  const firstMove = seq.findIndex((f) => f.x !== rest.x || f.y !== rest.y);
  return { seq, contact, firstChange, firstMove, last: seq[seq.length - 1] };
}

describe('knock-back split (A3 §10.2)', () => {
  it("the slice monsters keep the whole kit push ('sprite' default); 'pose' art gets only the rest of a front blow", () => {
    const sc = new W.Scene();
    for (const id of ['crystal_wyrm', 'abyss_magus'] as const) {
      const { u } = unitOf(sc, id);
      expect(u.art.knock).toBeUndefined();
      for (const p of [1, 2, 3] as const) for (const side of ['front', 'back', 'above'] as const) expect(kitKnockPx(u, p, side)).toBe(knockPx(u, p, side));
    }
    const base = monsterArtV3('crystal_wyrm')!;
    const { u } = unitOf(sc, 'crystal_wyrm', { art: { ...base, knock: 'pose', poseKnockPx: [1, 1, 2] } });
    for (const p of [1, 2, 3] as const) {
      expect(kitKnockPx(u, p, 'front')).toBe(Math.max(0, knockPx(u, p, 'front') - [1, 1, 2][p - 1]));
      expect(kitKnockPx(u, p, 'back')).toBe(knockPx(u, p, 'back'));
      expect(kitKnockPx(u, p, 'above')).toBe(knockPx(u, p, 'above'));
    }
  });
});

describe('contact frame: the struck sprite stands at rest, the shove starts on the first frame change', () => {
  for (const player of [1, 0] as const) {
    for (const where of ['between frames', 'inside an update'] as const) {
      it(`plain hit, P${player + 1}, contact ${where}: f0 at rest, 1 px on f1, springs back`, async () => {
        const sc = new W.Scene();
        const { u, s } = unitOf(sc, 'crystal_wyrm', { player });
        await sc.step(7); // somewhere inside the idle loop
        const rest = u.rest0;
        const dir = FRONT(player);
        const hit = () => void reactHit(ctxOf(sc), u, { power: 2, dir, kind: 'physical', by: null });
        if (where === 'between frames') hit();
        else sc.time.delayedCall(1, hit);
        const r = await follow(sc, s, rest, 90);
        expect(blowSide(u, dir)).toBe('front');
        expect(r.contact.frame).toBe('hit:0');
        expect({ x: r.contact.x, y: r.contact.y }).toEqual(rest);
        // nothing moves before the first frame change; the shove shows on that very frame
        expect(r.firstChange).toBeGreaterThan(1);
        expect(r.seq[r.firstChange].frame).toBe('hit:1');
        expect(r.firstMove).toBe(r.firstChange);
        expect(r.seq[r.firstChange].x - rest.x).toBe(Math.sign(dir.x));
        expect(r.seq[r.firstChange].y).toBe(rest.y);
        // the whole kit push is reached, then the body springs back to rest
        const px = knockPx(u, 2, 'front');
        expect(Math.max(...r.seq.map((f) => Math.abs(f.x - rest.x)))).toBe(px);
        expect({ x: r.last.x, y: r.last.y }).toEqual(rest);
        for (const f of r.seq) expect(Number.isInteger(f.x) && Number.isInteger(f.y)).toBe(true);
      });
    }
  }

  it('lethal hit: f0 at rest, the shove on the first frame change, and it stays pushed (a death follows)', async () => {
    const sc = new W.Scene();
    const { u, s } = unitOf(sc, 'abyss_magus', { player: 1 });
    await sc.step(5);
    const rest = u.rest0;
    const dir = FRONT(1);
    void reactHit(ctxOf(sc), u, { power: 2, dir, kind: 'physical', by: null, lethal: true });
    const r = await follow(sc, s, rest, 90);
    expect(r.contact.frame).toBe('hitHeavy:0');
    expect({ x: r.contact.x, y: r.contact.y }).toEqual(rest);
    expect(r.firstChange).toBeGreaterThan(1);
    expect(r.firstMove).toBe(r.firstChange);
    const px = knockPx(u, 2, 'front');
    expect(r.last.x - rest.x).toBe(px * Math.sign(dir.x));
  });

  it("lethal hit handed over to the death pose by play() (no 'animationupdate'): the shove lands on the death's entry frame", async () => {
    const sc = new W.Scene();
    const { u, s } = unitOf(sc, 'abyss_magus', { player: 0 });
    await sc.step(3);
    const rest = u.rest0;
    // the struck frame held by pose(), then the death pose plays from its posematch entry frame
    u.pose('hitHeavy', 0);
    void knock(u, FRONT(0), 2, { hold: true });
    void sc.freeze(80);
    sc.time.delayedCall(50, () => void u.playRange('death', 1, undefined, { hold: true }));
    const r = await follow(sc, s, rest, 40);
    expect(r.contact.frame).toBe('hitHeavy:0');
    expect({ x: r.contact.x, y: r.contact.y }).toEqual(rest);
    expect(r.seq[r.firstChange].frame).toBe('death:1');
    expect(r.firstMove).toBe(r.firstChange);
    expect(r.last.x - rest.x).toBe(-2);
  });

  it('re-posed after the knock call, before the contact frame is drawn (the bolt\'s jolt frame): still at rest on it', async () => {
    const sc = new W.Scene();
    const { u, s } = unitOf(sc, 'abyss_magus', { player: 1 });
    await sc.step(4);
    const rest = u.rest0;
    // the lethal recoil handed over to the death pose at once; then the bolt shows its jolt frame
    void u.playRange('death', 0, undefined, { hold: true });
    void knock(u, { x: 0, y: 1 }, 1, { hold: true });
    u.pose('hitMagic', 0);
    void sc.freeze(90);
    sc.time.delayedCall(u.frameMs('hitMagic', 0), () => void u.playRange('death', 0, undefined, { hold: true }));
    const r = await follow(sc, s, rest, 40);
    expect(r.contact.frame).toBe('hitMagic:0');
    expect({ x: r.contact.x, y: r.contact.y }).toEqual(rest);
    expect(r.seq[r.firstChange].frame).toBe('death:0');
    expect(r.firstMove).toBe(r.firstChange);
    expect({ x: r.last.x - rest.x, y: r.last.y - rest.y }).toEqual({ x: 0, y: 1 });
  });

  it('blow from behind (no recoil pose): at rest on contact, shoved forward from the next frame change', async () => {
    const sc = new W.Scene();
    const { u, s } = unitOf(sc, 'crystal_wyrm', { player: 0 });
    await sc.step(4);
    const rest = u.rest0;
    const dir = { x: 1, y: -0.5 }; // travels the way P1 faces: from behind
    expect(blowSide(u, dir)).toBe('back');
    const before = s.frame.name;
    void reactHit(ctxOf(sc), u, { power: 2, dir, kind: 'physical', by: null });
    const r = await follow(sc, s, rest, 90);
    expect(r.contact.frame).toBe(before); // the idle goes on: no recoil pose
    expect({ x: r.contact.x, y: r.contact.y }).toEqual(rest);
    expect(r.seq[r.firstChange].frame.startsWith('idle:')).toBe(true);
    expect(r.firstMove).toBe(r.firstChange);
    expect(r.seq[r.firstChange].x - rest.x).toBe(1);
    expect(Math.max(...r.seq.map((f) => f.x - rest.x))).toBe(knockPx(u, 2, 'back'));
    expect({ x: r.last.x, y: r.last.y }).toEqual(rest);
  });

  it('blow from above (the bolt, lethal): at rest on contact, then 1 px DOWN from the first frame change, held', async () => {
    const sc = new W.Scene();
    const { u, s } = unitOf(sc, 'crystal_wyrm', { player: 1 });
    await sc.step(6);
    const rest = u.rest0;
    const dir = { x: 0, y: 1 };
    expect(blowSide(u, dir)).toBe('above');
    void sc.freeze(90); // the bolt owns its hit-stop (noStop below)
    void reactHit(ctxOf(sc), u, { power: 3, dir, kind: 'magic', by: null, lethal: true, noStop: true });
    const r = await follow(sc, s, rest, 60);
    expect(r.contact.frame).toBe('hitMagic:0');
    expect({ x: r.contact.x, y: r.contact.y }).toEqual(rest);
    expect(r.firstMove).toBe(r.firstChange);
    expect({ x: r.seq[r.firstChange].x - rest.x, y: r.seq[r.firstChange].y - rest.y }).toEqual({ x: 0, y: 1 });
    expect({ x: r.last.x - rest.x, y: r.last.y - rest.y }).toEqual({ x: 0, y: 1 });
  });

  it("knock: 'pose' art: the kit adds only knockPx − poseKnockPx[power], by the same trigger", async () => {
    const sc = new W.Scene();
    const base = monsterArtV3('crystal_wyrm')!;
    const art: MonsterArt = { ...base, knock: 'pose', poseKnockPx: [1, 1, 1] };
    const { u, s } = unitOf(sc, 'crystal_wyrm', { player: 1, art });
    await sc.step(2);
    const rest = u.rest0;
    void reactHit(ctxOf(sc), u, { power: 2, dir: FRONT(1), kind: 'physical', by: null });
    const r = await follow(sc, s, rest, 90);
    expect({ x: r.contact.x, y: r.contact.y }).toEqual(rest);
    const kit = knockPx(u, 2, 'front') - 1;
    expect(kit).toBeGreaterThan(0);
    expect(r.firstMove).toBe(r.firstChange);
    expect(Math.max(...r.seq.map((f) => Math.abs(f.x - rest.x)))).toBe(kit);
  });

  // A3 core review F1: a lethal blow's shove is held into the death pose (§10.1), which carries none
  // of the recoil's drawn travel — the kit moves the whole knockPx (the old split left a heavy body
  // with no shove at all, and a medium one short by its drawn part).
  for (const weight of ['heavy', 'medium'] as const) {
    const poseArt = (): MonsterArt => ({ ...monsterArtV3('abyss_magus')!, weight, knock: 'pose', poseKnockPx: [1, 1, 1] });

    it(`lethal + pose (${weight}), no planned entry (the recoil plays out): at rest on contact, shoved on the first frame change, held at knockPx`, async () => {
      const sc = new W.Scene();
      const { u, s } = unitOf(sc, 'abyss_magus', { player: 1, art: poseArt() });
      await sc.step(5);
      const rest = u.rest0;
      const dir = FRONT(1);
      const k = knockPx(u, 2, 'front');
      expect(k).toBeGreaterThan(kitKnockPx(u, 2, 'front', { anim: 'hitHeavy' })); // the non-lethal split leaves part out
      void reactHit(ctxOf(sc), u, { power: 2, dir, kind: 'physical', by: null, lethal: true });
      const r = await follow(sc, s, rest, 90);
      expect(r.contact.frame).toBe('hitHeavy:0');
      expect({ x: r.contact.x, y: r.contact.y }).toEqual(rest);
      expect(r.firstChange).toBeGreaterThan(1);
      expect(r.firstMove).toBe(r.firstChange);
      expect(r.seq[r.firstChange].x - rest.x).toBe(Math.sign(dir.x));
      // held where knock() aims it: whole px along the (unit) blow, y foreshortened × 0.6
      const l = Math.hypot(dir.x, dir.y);
      expect({ x: r.last.x - rest.x, y: r.last.y - rest.y }).toEqual({ x: Math.round((dir.x / l) * k) + 0, y: Math.round((dir.y / l) * k * 0.6) + 0 });
    });

    it(`lethal + pose (${weight}), the death replaces the recoil from its struck f0 (HA-24): the shove lands on the death's first frame change, held at knockPx`, async () => {
      const sc = new W.Scene();
      const { u, s } = unitOf(sc, 'abyss_magus', { player: 0, art: poseArt() });
      await sc.step(3);
      const rest = u.rest0;
      const dir = FRONT(0);
      PLAN.entry = { anim: 'hitHeavy', hold: 0, start: 0, cost: 0 };
      void reactHit(ctxOf(sc), u, { power: 2, dir, kind: 'physical', by: null, lethal: true });
      const r = await follow(sc, s, rest, 90);
      expect(r.contact.frame).toBe('death:0');
      expect({ x: r.contact.x, y: r.contact.y }).toEqual(rest);
      expect(r.seq[r.firstChange].frame).toBe('death:1');
      expect(r.firstMove).toBe(r.firstChange);
      expect(r.last.x - rest.x).toBe(knockPx(u, 2, 'front') * Math.sign(dir.x));
      expect(r.last.frame.startsWith('death:')).toBe(true);
    });
  }

  it('lethal + pose: a death that continues from a later recoil frame keeps that frame\'s drawn part', () => {
    const sc = new W.Scene();
    const travel: Record<string, readonly number[]> = { hitHeavy: [0, 2, 3, 3, 1, 0, 0, 0] };
    const art: MonsterArt = { ...monsterArtV3('abyss_magus')!, weight: 'medium', knock: 'pose', poseKnockPx: [1, 1, 2], joints: (a, f) => ({ hip: { x: 20 - (travel[a]?.[f] ?? 0), y: 30 } }) };
    const { u } = unitOf(sc, 'abyss_magus', { player: 1, art });
    const k = knockPx(u, 2, 'front');
    expect(kitKnockPx(u, 2, 'front', { lethal: true, entry: null })).toBe(k);
    expect(kitKnockPx(u, 2, 'front', { lethal: true, entry: { anim: 'hitHeavy', hold: 0, start: 0, cost: 0 } })).toBe(k);
    expect(kitKnockPx(u, 2, 'front', { lethal: true, entry: { anim: 'hitHeavy', hold: 1, start: 2, cost: 0.4 } })).toBe(Math.max(0, k - 2));
    // a blow from behind / above is never split
    expect(kitKnockPx(u, 2, 'back', { lethal: true, entry: { anim: 'hitHeavy', hold: 1, start: 2, cost: 0.4 } })).toBe(knockPx(u, 2, 'back'));
  });

  // A3 core review F4: the kit leaves out what the recoil that PLAYS draws (measured on the art's rig),
  // not the declared table by blow power.
  it("knock: 'pose' with joints(): the kit subtracts the measured travel of the recoil that plays", async () => {
    const sc = new W.Scene();
    const travel: Record<string, readonly number[]> = { hit: [0, 1, 1, 1, 0, 0], hitHeavy: [0, 2, 3, 3, 1, 0, 0, 0], hitMagic: [0, 0, 0, 0, 0, 0, 0, 0] };
    const joints = (a: string, f: number) => ({ hip: { x: 20 - (travel[a]?.[f] ?? 0), y: 30 } });
    const art: MonsterArt = { ...monsterArtV3('abyss_magus')!, weight: 'medium', knock: 'pose', poseKnockPx: [1, 1, 2], joints };
    const { u, s } = unitOf(sc, 'abyss_magus', { player: 1, art });
    expect(poseTravelPx(art, 'hit')).toBe(1);
    expect(poseTravelPx(art, 'hitHeavy')).toBe(3);
    expect(poseTravelPx(art, 'hitHeavy', 1)).toBe(2);
    expect(poseTravelPx(art, 'hitMagic')).toBe(0);
    expect(poseTravelPx(monsterArtV3('abyss_magus')!, 'hit')).toBeNull(); // no joints: the declared table
    for (const p of [1, 2, 3] as const) {
      const k = knockPx(u, p, 'front');
      expect(kitKnockPx(u, p, 'front', { anim: 'hit' })).toBe(Math.max(0, k - 1));
      expect(kitKnockPx(u, p, 'front', { anim: 'hitHeavy' })).toBe(Math.max(0, k - 3));
      expect(kitKnockPx(u, p, 'front', { anim: 'hitMagic' })).toBe(k); // the declared table would drop 1–2 px
      expect(drawnKnockPx(u, p)).toBe([1, 1, 2][p - 1]); // no recoil named: the declared table
    }
    // in the kit: a magic front blow on this art plays hitMagic (no drawn travel) and gets the whole shove
    await sc.step(2);
    const rest = u.rest0;
    void reactHit(ctxOf(sc), u, { power: 2, dir: FRONT(1), kind: 'magic', by: null });
    const r = await follow(sc, s, rest, 90);
    expect(r.contact.frame).toBe('hitMagic:0');
    expect({ x: r.contact.x, y: r.contact.y }).toEqual(rest);
    expect(r.firstMove).toBe(r.firstChange);
    expect(Math.max(...r.seq.map((f) => Math.abs(f.x - rest.x)))).toBe(knockPx(u, 2, 'front'));
    expect({ x: r.last.x, y: r.last.y }).toEqual(rest);
  });

  it('a pose that holds: the shove starts one tick past its hold (show time stands still in the hit-stop)', async () => {
    const sc = new W.Scene();
    const { u, s } = unitOf(sc, 'crystal_wyrm', { player: 1 });
    await sc.step(2);
    const rest = u.rest0;
    u.pose('hit', 0);
    let firedAt = -1;
    let frame = 0;
    afterContact(u, () => (firedAt = frame));
    void sc.freeze(100);
    for (frame = 1; frame <= 40 && firedAt < 0; frame++) await sc.step();
    // the freeze's 6 frames + ceil((hold + 1 tick) / tick) frames of show time
    const hold = u.frameMs('hit', 0);
    expect(firedAt).toBe(6 + Math.ceil((hold + W.FRAME) / W.FRAME - 1e-9));
    expect({ x: s.x, y: s.y }).toEqual(rest);
  });

  it('a shove waiting for its frame change is dropped when something else moves the sprite first', async () => {
    const sc = new W.Scene();
    const { u, s } = unitOf(sc, 'crystal_wyrm', { player: 1 });
    await sc.step(2);
    const rest = u.rest0;
    u.pose('hit', 0);
    let done = false;
    void knock(u, FRONT(1), 3).then(() => (done = true));
    s.setPosition(rest.x - 5, rest.y); // a strike carries it
    await sc.step(30);
    expect(done).toBe(true);
    expect(s.x).toBe(rest.x - 5);
  });
});

describe('guard (MonsterUnit.guardHit): the contact frame stands still too', () => {
  for (const survive of [true, false]) {
    for (const where of ['between frames', 'inside an update'] as const) {
      it(`guard ${survive ? 'holds' : 'breaks'}, contact ${where}: at rest on the contact frame, pushed after it`, async () => {
        const sc = new W.Scene();
        const { u, s } = unitOf(sc, 'abyss_magus', { player: 1, defense: true });
        await sc.step(5);
        expect(u.guarding).toBe(true);
        const rest = u.rest0;
        const dir = FRONT(1);
        const hit = () => void reactGuard(ctxOf(sc), u, { power: 2, dir, survive, noStop: true });
        if (where === 'between frames') hit();
        else sc.time.delayedCall(1, hit);
        const r = await follow(sc, s, rest, 60);
        expect({ x: r.contact.x, y: r.contact.y }).toEqual(rest);
        expect(r.firstMove).toBeGreaterThan(0);
        expect(Math.max(...r.seq.map((f) => Math.abs(f.x - rest.x)))).toBeGreaterThan(0);
        if (survive) expect({ x: r.last.x, y: r.last.y }).toEqual(rest);
        else expect(r.last.x).not.toBe(rest.x);
      });
    }
  }
});
