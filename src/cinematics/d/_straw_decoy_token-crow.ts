// Saman Korkuluk (straw_decoy_token) — the crow that visits the scarecrows now and then (?look=v3 only; the `_`
// file registers nothing, ./straw_decoy_token.ts starts it when a token takes the field).
//
// The crow is NOT baked into the idle / guard loops (a row of tokens from one Saman Korkuluklar would show four
// cloned crows on the same beat). One crow per scene, at most one visit at a time, rarely: a first visit a few
// seconds after the tokens stand, then one every 9–15 s, on ONE token picked at random among those resting in
// their loop. The crow comes in from beyond the sprite's frame (high, from the foe's side), lands on the near
// sleeve and rides its sway (it follows the sleeve's top on the frame on screen), looks round, pecks, caws once
// (scarecrowCrow, quiet) and flies off out of view (scarecrowFlap). Whenever its scarecrow stops resting — a position
// change, a strike, a blow, the vanish — it takes off at once from where it sits (never a pop).

import type Phaser from 'phaser';
import type { FieldView } from '../../duel/FieldView';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import { drawCrow, type CrowMode } from '../../art/monsters-v3/straw_decoy_token-kit';
import { Raster } from '../../vfx/setpieces';
import { onFrame } from '../../vfx/combat';
import type { XY } from '../../view/layout';
import { panAt, play } from '../_v3/sound';
import { strawPoint } from './_straw_decoy_token-fx';

const ID = 'straw_decoy_token';
const R = Math.round;
/** first visit after the manager starts, then the gap between visits (ms) */
const FIRST: readonly [number, number] = [2600, 4200];
const GAP: readonly [number, number] = [9000, 15000];

/** Is the token standing quietly in its idle / guard loop (a crow may sit on it)? */
export function resting(u: MonsterUnit): boolean {
  if (!u.sprite.active || u.retired || !u.sprite.visible || u.claimed || u.posed || u.sprite.alpha < 0.95) return false;
  const a = u.frameInfo().anim;
  return a === 'idle' || a === 'guard';
}

type Phase = 'in' | 'sit' | 'out';

/** One visit: in → sit → out, drawn into its own raster just in front of its scarecrow. */
class Visit {
  private phase: Phase = 'in';
  private el = 0;
  private pos: XY;
  private from: XY;
  private outTo: XY = { x: 0, y: 0 };
  private cawed = false;
  private readonly face: 1 | -1;
  private readonly r: Raster;
  done = false;

  constructor(
    private readonly sc: Phaser.Scene,
    readonly u: MonsterUnit,
  ) {
    this.face = u.flipX ? -1 : 1;
    const p = this.perch() ?? { x: u.home.x, y: u.home.y - 30 };
    // it comes from high on the foe's side, from beyond the sprite's frame
    this.from = { x: p.x + this.face * 74, y: p.y - 58 };
    this.pos = { ...this.from };
    this.r = new Raster(sc, p.x - 140, p.y - 130, 280, 170, u.sprite.depth + 0.2);
  }

  /** the crow's feet on the near sleeve's top (frame on screen) */
  private perch(): XY | null {
    const b = strawPoint(this.u, 'barR');
    return b ? { x: b.x - 2 * this.face, y: b.y - 2 } : null;
  }

  private leave(): void {
    if (this.phase === 'out') return;
    this.phase = 'out';
    this.el = 0;
    this.from = { ...this.pos };
    this.outTo = { x: this.pos.x + this.face * 96, y: this.pos.y - 92 };
    play('scarecrowFlap', { volume: 0.5, pan: panAt(this.pos.x) });
  }

  tick(dt: number): void {
    if (this.done) return;
    this.el += dt;
    const ok = resting(this.u);
    if (this.phase !== 'out' && !ok) this.leave();
    let mode: CrowMode = 'perch';
    let wing = 0;
    let cf: 1 | -1 = this.face;
    const e = this.el;
    if (this.phase === 'in') {
      const D = 560;
      const t = Math.min(1, e / D);
      const k = 1 - (1 - t) * (1 - t);
      const p = this.perch() ?? this.pos;
      this.pos = { x: this.from.x + (p.x - this.from.x) * k, y: this.from.y + (p.y - this.from.y) * k - Math.sin(Math.PI * t) * 6 };
      cf = (-this.face) as 1 | -1;
      if (t < 0.28) {
        mode = 'far';
        wing = Math.floor(e / 90) % 2;
      } else if (t < 0.86) {
        mode = 'fly';
        wing = [0, 1, 2][Math.floor(e / 70) % 3];
      } else {
        // braking: wings forward and down, then the feet take the sleeve
        mode = 'fly';
        wing = 2;
      }
      if (t >= 1) {
        this.phase = 'sit';
        this.el = 0;
      }
    } else if (this.phase === 'sit') {
      this.pos = this.perch() ?? this.pos;
      // a little routine on the sleeve: wings settle, it looks round, pecks, caws once, pecks, crouches, goes
      const steps: [number, CrowMode, number, 1 | -1][] = [
        [90, 'perch', 1, this.face],
        [260, 'perch', 0, this.face],
        [160, 'peck', 0, this.face],
        [200, 'perch', 0, this.face],
        [260, 'perch', 0, (-this.face) as 1 | -1],
        [140, 'perch', 0, this.face],
        [280, 'caw', 0, this.face],
        [180, 'perch', 0, this.face],
        [150, 'peck', 0, this.face],
        [170, 'perch', 0, this.face],
        [140, 'crouch', 0, this.face],
      ];
      let acc = 0;
      let i = 0;
      for (; i < steps.length; i++) {
        if (e < acc + steps[i][0]) break;
        acc += steps[i][0];
      }
      if (i >= steps.length) this.leave();
      else {
        [, mode, wing, cf] = steps[i];
        if (mode === 'caw' && !this.cawed) {
          this.cawed = true;
          play('scarecrowCrow', { volume: 0.32, pan: panAt(this.pos.x) });
        }
      }
    }
    if (this.phase === 'out') {
      const D = 640;
      const t = Math.min(1, this.el / D);
      const k = t * t * 0.7 + t * 0.3;
      this.pos = { x: this.from.x + (this.outTo.x - this.from.x) * k, y: this.from.y + (this.outTo.y - this.from.y) * k };
      cf = this.face;
      if (t < 0.12) {
        mode = 'crouch';
      } else if (t < 0.62) {
        mode = 'fly';
        wing = [0, 1, 2][Math.floor(this.el / 60) % 3];
      } else {
        mode = 'far';
        wing = Math.floor(this.el / 80) % 2;
      }
      if (t >= 1) {
        this.end();
        return;
      }
    }
    if (this.u.sprite.active) this.r.img.setDepth(this.u.sprite.depth + 0.2);
    const x = R(this.pos.x);
    const y = R(this.pos.y);
    // the raster keeps the crow inside it (it moves with a far flight)
    if (x - this.r.x < 14 || x - this.r.x > this.r.w - 14 || y - this.r.y < 14 || y - this.r.y > this.r.h - 6) this.r.moveTo(x - this.r.w / 2, y - this.r.h / 2);
    this.r.draw((q) => drawCrow(q.pc, x - q.x, y - q.y, mode, wing, cf, -1));
  }

  end(): void {
    if (this.done) return;
    this.done = true;
    this.r.destroy();
  }
}

class Crows {
  private seed: number;
  private timer: number;
  private visit: Visit | null = null;
  private idle = 0;

  constructor(
    private readonly sc: Phaser.Scene,
    private readonly field: FieldView,
    seed: number,
  ) {
    this.seed = (Math.abs(Math.floor(seed)) % 2147483646) + 1;
    this.timer = this.range(FIRST);
    onFrame(sc, (dt) => this.tick(dt), () => {
      this.visit?.end();
      MANAGERS.delete(sc);
    });
  }

  private rnd(): number {
    this.seed = (this.seed * 16807) % 2147483647;
    return (this.seed - 1) / 2147483646;
  }
  private range([a, b]: readonly [number, number]): number {
    return a + (b - a) * this.rnd();
  }

  private tokens(): MonsterUnit[] {
    return this.field.units().filter((u) => u.cardId === ID && u.sprite.active && !u.retired);
  }

  private tick(dt: number): boolean {
    if (this.visit) {
      this.visit.tick(dt);
      if (this.visit.done) {
        this.visit = null;
        this.timer = this.range(GAP);
      }
      return true;
    }
    const all = this.tokens();
    if (!all.length) {
      // no scarecrow left: the crow goes home (the manager stops; the next token starts a new one)
      this.idle += dt;
      return this.idle < 1500;
    }
    this.idle = 0;
    this.timer -= dt;
    if (this.timer > 0) return true;
    const free = all.filter(resting);
    if (!free.length) {
      this.timer = 1200;
      return true;
    }
    const u = free[Math.min(free.length - 1, Math.floor(this.rnd() * free.length))];
    this.visit = new Visit(this.sc, u);
    return true;
  }

  /** a token was (re)summoned: a visit that was far off is brought a little closer (never sooner than FIRST) */
  wake(): void {
    if (!this.visit && this.timer > FIRST[1]) this.timer = this.range(FIRST);
  }
}

const MANAGERS = new Map<Phaser.Scene, Crows>();

/** Start (once per scene) the crow that visits the straw tokens of `field`. */
export function crowVisits(sc: Phaser.Scene, field: FieldView, seed: number): void {
  const m = MANAGERS.get(sc);
  if (m) {
    m.wake();
    return;
  }
  MANAGERS.set(sc, new Crows(sc, field, seed));
}
