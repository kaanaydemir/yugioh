// Kabuk Zıpkıncı — Körfez kalkanı (tidalBayShroud) in the v3 look (docs/v3/oturum-c-tasarim.md §2.1 "Signature").
// The rule is a pure legality filter (src/engine/query.ts shrouded()); there is no engine event for it, so the
// picture is staged from three places:
//
//   A. raise   the harpooner's statChange (the Bay turns face-up: +400) while it becomes shrouded — the `special`
//              anim (the harpoon planted, the rope claw raised, the nacre a step brighter) and a STANDING WAVE WALL
//              rising round its tile ellipse (0 → 4 px over 400 ms, then 2 px), its back half behind the crab and its
//              front half in front, one white foam crest running round it once (600 ms). Summoned / flipped while the
//              Bay is already up: the 600 ms version after the land (syncShroud { short }).
//   B. aura    while shrouded: a 2-px front arc, a 1-px back arc, the crest circling every 2.4 s on the AMBIENT
//              clock (it never freezes in a hit-stop), a stepped water4 floor ring at 0.5; one soft lap every 4 crest
//              cycles (−32 dB class).
//   C. deflect the opponent's attack-target / spell-target click on the shrouded crab (src/duel/HumanInput.ts, one
//              LOOK_V3-gated line in pickZone's reject branch → shroudReject): the reticle corners close in, hit the
//              wall — which CURLS up to 10 px where they struck — skid 12 px along the ellipse and are flung off in two
//              tone steps; a "KORUNUYOR" wave plate pops above the crab (one size bigger for 34 ms), holds 500 ms, slides
//              down 3 px and sinks in two tone steps. "Şlup" + the stamp. UI layer: real time (never the show clock),
//              never blocks input, ≤ 600 ms, debounced 800 ms. Not R3's "0 · KORUNDU" pillow (a number, a bell).
//   D. drop    the harpooner stops being shrouded (the Bay leaves → statChange back): the wall collapses into a
//              splash ring that soaks into the tile (400 ms).
// No registrations here (HumanInput imports this module): the hooks live in ./tide_harpooner.ts.
// A wave wall is this card's own set piece (lane rule: no whirlpool / geyser / spout — it is a flat standing wall).

import type Phaser from 'phaser';
import { PAL } from '../../art/palette';
import { shroudWall } from '../../art/monsters-v3/tide_harpooner-fx';
import type { DuelViews } from '../../duel/types';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import { shrouded } from '../../engine/query';
import type { GameState, PlayerId } from '../../engine/types';
import type { BoardSpot } from '../../view/layout';
import { DEPTH, LOOK_V3, TILE_H, TILE_W, type XY, unitDepth } from '../../view/layout';
import { lightFlash, lightPool, type LightHandle } from '../../view/light';
import { animate, sleep } from '../../vfx/combat';
import type { CinematicContext } from '../_core/types';
import { atFrame, panAt, play } from '../_v3/sound';
import { Surface, clamp, plateKey, rnd } from './tide_harpooner-fx';

const AURA = 'bayShroud';
const CREST_MS = 2400;

/** A ticker on the scene's own update (game time, unscaled by the show clock: hit-stops never freeze it). */
function ambient(scene: Phaser.Scene, fn: (el: number, dt: number) => boolean): () => void {
  let el = 0;
  let alive = true;
  const upd = (_t: number, dt: number) => {
    if (!alive) return;
    el += dt;
    if (!fn(el, dt)) stop();
  };
  const stop = () => {
    if (!alive) return;
    alive = false;
    scene.events.off('update', upd);
  };
  scene.events.on('update', upd);
  scene.events.once('shutdown', stop);
  return stop;
}

/** The standing wave wall round a harpooner's tile (the aura object; MonsterUnit.setAura disposes it). */
export class ShroudAura {
  private readonly back: Surface;
  private readonly front: Surface;
  private readonly stopTick: () => void;
  private readonly floor: LightHandle;
  /** wall height (px, may be fractional while it rises) */
  height = 0;
  /** an extra crest run (the raise): 0…1 progress round the ring, −1 none */
  run = -1;
  /** the running raise 0…1 (1 = every column up) */
  rise = 1;
  /** the first lap's white wake behind the crest (ring fraction) */
  wake = 0;
  private curlAt = 0;
  private curlK = 0;
  collapse = 0;
  private dead = false;
  private dropping = false;
  private crest = 0;
  private laps = 0;
  private readonly c: XY;
  constructor(private readonly u: MonsterUnit) {
    const sc = u.scene;
    const h = u.home;
    this.c = { x: h.x, y: h.y };
    this.back = new Surface(sc, unitDepth(h.y) - 0.5);
    this.front = new Surface(sc, unitDepth(h.y) + 0.5);
    this.floor = lightPool(sc, h.x, h.y, { color: PAL.water4, radius: Math.round(TILE_W * 0.45), intensity: 0, anim: 'shimmer', fadeIn: 0 });
    this.stopTick = ambient(sc, (el) => {
      if (this.dead) return false;
      this.crest = (el % CREST_MS) / CREST_MS;
      const lap = Math.floor(el / (CREST_MS * 4));
      if (lap > this.laps) {
        this.laps = lap;
        if (this.height >= 1.5 && !this.dropping) play('harpBayLap', { volume: 0.8, pan: panAt(this.c.x) });
      }
      this.draw();
      return true;
    });
  }
  /** The floor ring light (0 … 0.5). */
  setLight(k: number, ms: number): void {
    this.floor.setIntensity(k, ms);
  }
  /** A targeting attempt hit the wall at ring position `at` (0…1 from the front centre, toward the right). */
  hit(at: number): void {
    this.curlAt = at;
    const sc = this.u.scene;
    let el0 = 0;
    ambient(sc, (el) => {
      if (this.dead) return false;
      el0 = el;
      // the full 10-px column at once, held ≥ 4 frames with its white crest, then down over 200 ms
      this.curlK = el < 170 ? 1 : Math.max(0, 1 - (el - 170) / 200);
      return el0 < 370 + 20;
    });
  }
  private draw(): void {
    this.back.clear();
    this.front.clear();
    if (this.height <= 0 && this.collapse <= 0 && this.run < 0) return;
    const rx = Math.floor(TILE_W / 2) - 1;
    const ry = Math.floor(TILE_H / 2) - 1;
    const crest = this.run >= 0 ? this.run : this.crest;
    const o = { height: this.height, crest, curlAt: this.curlAt, curl: this.curlK, collapse: this.collapse, rx, ry, rise: this.rise, wake: this.run >= 0 ? this.wake : 0 };
    // the back arc a px lower than the front (1 px vs 2 px, EF-2: the front stays at the feet)
    shroudWall(this.back.canvas, this.c.x, this.c.y, 'back', { ...o, height: Math.max(0, this.height - 1) });
    shroudWall(this.front.canvas, this.c.x, this.c.y, 'front', o);
  }
  /** A: the wall rises (0 → 4 px over 400 ms, then 2 px; one crest run round it over 600 ms). */
  async raise(short: boolean): Promise<void> {
    const sc = this.u.scene;
    const up = short ? 260 : 400;
    this.setLight(0.5, up);
    // the columns stand up in a running wave from the front (where the harpoon was planted) round both sides to the
    // back, each in whole-pixel steps to 4 px; the white crest starts running as the wave closes behind the crab
    this.height = 4;
    this.rise = 0;
    await animate(sc, up, (t) => (this.rise = t));
    this.rise = 1;
    // at the 4-px peak the crest throws foam flecks off the front arc; the first lap leaves a white wake (~3 px)
    if (!short) foamFlecks(sc, this.c, rx0(), ry0(), this.u.uid);
    this.wake = 0.03;
    void animate(sc, short ? 360 : 600, (t) => (this.run = t >= 1 ? -1 : t)).then(() => {
      this.run = -1;
      this.wake = 0;
    });
    await animate(sc, short ? 160 : 260, (t) => (this.height = t < 0.34 ? 4 : t < 0.67 ? 3 : 2));
    this.height = 2;
  }
  /** D: the wall collapses into a splash ring that soaks into the tile (400 ms), then it is gone. */
  async drop(): Promise<void> {
    if (this.dropping) return;
    this.dropping = true;
    const sc = this.u.scene;
    void this.floor.fadeOut(400);
    const h0 = this.height;
    await animate(sc, 400, (t) => {
      this.height = h0 * (1 - t);
      this.collapse = Math.max(0.02, t);
    });
    this.free();
  }
  private free(): void {
    if (this.dead) return;
    this.dead = true;
    this.stopTick();
    this.back.destroy();
    this.front.destroy();
    void this.floor.fadeOut(120);
  }
  /** Disposable: the unit leaves / the aura is replaced — a quick collapse, then gone. */
  destroy(): void {
    if (this.dead || this.dropping) return;
    void this.drop();
  }
}

type AnyCtx = CinematicContext;

const rx0 = (): number => Math.floor(TILE_W / 2) - 1;
const ry0 = (): number => Math.floor(TILE_H / 2) - 1;

/** Four foam flecks thrown off the wall's crest at its 4-px peak (front arc), arcing out and landing as wet dots. */
function foamFlecks(sc: Phaser.Scene, c: XY, rx: number, ry: number, seed: number): void {
  const s = new Surface(sc, unitDepth(c.y) + 0.6);
  const fl = [0.08, 0.36, 0.64, 0.92].map((k, i) => {
    const a = Math.PI / 2 + (k - 0.5) * Math.PI * 0.9; // spread over the front arc
    const ox = Math.cos(a);
    const oy = Math.sin(a);
    return { x: c.x + ox * rx, y: c.y + oy * ry - 5, vx: ox * (34 + ((seed + i * 7) % 5) * 6), vy: -50 - i * 6, floor: c.y + oy * ry + 3, land: -1 as number, lx: 0 };
  });
  void animate(sc, 420, (_t, el) => {
    s.clear();
    const k = el / 1000;
    for (const f of fl) {
      let x = f.x + f.vx * k;
      let y = f.y + f.vy * k + 400 * k * k;
      if (f.land < 0 && y >= f.floor && k > 0.05) {
        f.land = el;
        f.lx = x;
      }
      if (f.land >= 0) {
        x = f.lx;
        y = f.floor;
        s.set(x, y, el - f.land < 140 ? PAL.water4 : PAL.water3);
      } else s.set(x, y, PAL.white).set(x, y + 1, PAL.water4);
    }
  }).then(() => s.destroy());
}

/** The plant's sand spray: six earth clods flung up off the harpoon's foot, falling back and lying a beat. */
function sandSpray(sc: Phaser.Scene, foot: XY, floorY: number, depth: number, seed: number): void {
  const s = new Surface(sc, depth);
  // wet sand: dark earth clods with a water glint among them, flung high and wide so they read off the crab's own tan
  const tones = [PAL.earth2, PAL.white, PAL.earth1, PAL.water4, PAL.earth2, PAL.earth3];
  const cl = Array.from({ length: 6 }, (_, i) => ({ vx: (i - 2.5) * 30 + ((seed * 13 + i * 5) % 7) - 3, vy: -120 - ((seed + i * 11) % 4) * 14, c: tones[i] }));
  void animate(sc, 460, (t, el) => {
    s.clear();
    const k = el / 1000;
    for (const q of cl) {
      const x = foot.x + q.vx * k;
      const y = Math.min(floorY + 1, foot.y + q.vy * k + 640 * k * k);
      if (t > 0.8 && (rnd(el / 34) & 1)) continue;
      s.set(x, y, q.c);
      if (y < floorY) s.set(x + 1, y, q.c);
    }
  }).then(() => s.destroy());
}

/** The nacre brightens for a frame on the plant: a white band along the lip (then water4, then gone). */
function nacreFlare(sc: Phaser.Scene, u: MonsterUnit): void {
  const c = u.core();
  const s = new Surface(sc, u.sprite.depth + 0.06);
  const sgn = u.flipX ? -1 : 1;
  void animate(sc, 100, (t) => {
    s.clear();
    const col = t < 0.4 ? PAL.white : PAL.water4;
    for (let i = 0; i < 11; i++) {
      const a = -Math.PI * 0.9 + (i / 10) * Math.PI * 0.95;
      s.set(c.x + Math.cos(a) * 7 * sgn, c.y + Math.sin(a) * 6, col);
      if (t < 0.4 && i % 2 === 0) s.set(c.x + Math.cos(a) * 6 * sgn, c.y + Math.sin(a) * 5, PAL.water4);
    }
  }).then(() => s.destroy());
}

/** The aura at rest at once (no raise): a harpooner found shrouded without its wall (a staged duel, a missed event). */
export function ensureShroud(u: MonsterUnit): ShroudAura | null {
  if (!LOOK_V3 || !u.sprite.active || u.retired) return null;
  const cur = u.aura(AURA) as ShroudAura | null;
  if (cur) return cur;
  const a = new ShroudAura(u);
  a.height = 2;
  a.setLight(0.5, 0);
  u.setAura(AURA, a);
  return a;
}

/** The state this cinematic ends on (the projected state right after its event). */
function stateOf(ctx: AnyCtx): GameState {
  return ctx.stateNext;
}

/**
 * Bring the harpooner's shroud in line with the state after this event: raise the wall (A, or its 600 ms version
 * when `short`) when it is now shrouded and has none; drop it (D) when it no longer is.
 */
export async function syncShroud(ctx: AnyCtx, u: MonsterUnit, o: { short?: boolean } = {}): Promise<void> {
  if (!LOOK_V3 || !u.sprite.active || u.retired) return;
  let on = false;
  try {
    on = shrouded(stateOf(ctx), u.uid);
  } catch {
    on = false;
  }
  const cur = u.aura(AURA) as ShroudAura | null;
  if (on && !cur) {
    const a = new ShroudAura(u);
    u.setAura(AURA, a);
    const pan = panAt(u.home.x);
    if (o.short) {
      play('harpBayRaise', { volume: 0.7, pan });
      await a.raise(true);
      return;
    }
    // the plant that calls the bay: the special pose; the wall rises from its release (the harpoon hits the sand)
    const relF = u.markFrame('special', 'release', 4);
    const anim = u.has('special') ? u.play('special') : Promise.resolve();
    let raisedOk!: () => void;
    const raised = new Promise<void>((r) => (raisedOk = r));
    const go = () => {
      play('harpBayRaise', { volume: 0.9, pan });
      play('harpPlant', { volume: 0.9, pan, pitch: 1.05 });
      // the plant that calls the bay: a white stepped flash pool at the harpoon's foot
      const foot = u.framePoint(...staffOf(u));
      void lightFlash(u.scene, foot.x, u.home.y, PAL.white, 16, 260, { floorY: u.home.y, intensity: 0.75 });
      sandSpray(u.scene, { x: foot.x, y: u.home.y - 1 }, u.home.y + 2, unitDepth(u.home.y) + 0.4, u.uid);
      nacreFlare(u.scene, u);
      void a.raise(false).then(raisedOk, raisedOk);
    };
    if (u.has('special')) atFrame(u, 'special', relF, go, { maxMs: 3000 });
    else go();
    // the pose's recover frames play on under whatever follows; the caller goes on once the wall stands
    void anim.then(() => {
      if (u.sprite.active && !u.retired && u.frameInfo().anim !== 'special') u.rest();
    });
    await Promise.race([raised, anim.then(() => sleep(u.scene, 700))]);
  } else if (!on && cur) {
    play('harpBayDrop', { volume: 0.9, pan: panAt(u.home.x) });
    await cur.drop();
    if (u.aura(AURA) === cur) u.setAura(AURA, null);
  }
}

/** The special pose's planted harpoon foot (frame px) on its release frame. */
function staffOf(u: MonsterUnit): [number, number] {
  const f = u.markFrame('special', 'release', 4);
  const p = u.art.points?.('special', f).staff ?? u.art.muzzle;
  return [p.x, p.y];
}

// ================================================================ C. the deflection (UI layer)

const lastDeflect = new WeakMap<MonsterUnit, number>();

/**
 * HumanInput's pickZone reject branch (v3): a click by `player` on the opponent's SHROUDED harpooner while it picks an
 * attack or spell target. Plays the deflection and flashes its own hint; true = handled (the generic reject is
 * skipped). false for anything else (the generic reject answers).
 */
export function shroudReject(scene: Phaser.Scene, views: DuelViews, state: GameState | null | undefined, h: { player: PlayerId; spot: BoardSpot; index: number } | null, player: PlayerId): boolean {
  if (!LOOK_V3 || !state || !h || h.spot !== 'monster' || h.player === player) return false;
  const slot = state.players[h.player]?.monsters[h.index];
  if (!slot) return false;
  let on = false;
  try {
    on = shrouded(state, slot.uid);
  } catch {
    on = false;
  }
  if (!on) return false;
  const u = views.field.unitAt(h.player, h.index);
  try {
    views.hud.flashHint('Gelgit Körfezi korunuyor: Kabuk Zıpkıncı hedef alınamaz', { style: 'neutral', ms: 1200 });
  } catch {
    /* the hint is optional */
  }
  if (!u || !u.sprite.active) return true;
  ensureShroud(u);
  const now = scene.time.now;
  if (now - (lastDeflect.get(u) ?? -1e9) < 800) return true; // debounced
  lastDeflect.set(u, now);
  deflect(scene, u, views);
  return true;
}

/** The reticle corners, the wall's curl, the skid and the KORUNUYOR plate (≤ 600 ms, real time). */
function deflect(scene: Phaser.Scene, u: MonsterUnit, _views: DuelViews): void {
  const pan = panAt(u.home.x);
  const c = u.home;
  const aura = u.aura(AURA) as ShroudAura | null;
  const core = u.core();
  // where they strike the wall: the front of the ring, on the side the corners come from (the opponent's side)
  const fromRight = u.player === 0; // P2 sits up-right of P1's monsters
  // the side of the ring facing the attacker, just on the front (tall) arc: right-front for P2's attacks, left-front for P1's
  const at = fromRight ? 0.79 : 0.21;
  const rx = Math.floor(TILE_W / 2) - 1;
  const ry = Math.floor(TILE_H / 2) - 1;
  const ringPt = (k: number): XY => {
    const a = Math.PI / 2 + k * Math.PI * 2;
    return { x: rnd(c.x + Math.cos(a) * rx), y: rnd(c.y + Math.sin(a) * ry) };
  };
  const ret = new Surface(scene, DEPTH.FX_TOP + 2);
  const plate = scene.add.image(0, 0, plateKey(scene, true, 0).key).setOrigin(0, 0).setDepth(DEPTH.FX_TOP + 3).setVisible(false);
  let hitDone = false;
  let stamped = false;
  const dropAt: (XY | null)[] = [null, null];
  const top = u.worldPoint('top');
  const plateAt = (big: boolean, dy: number): void => {
    const k = plateKey(scene, big, 0);
    plate.setTexture(k.key).setPosition(rnd(c.x - k.w / 2), rnd(top.y - 14 - k.h / 2 + dy)).setVisible(true);
  };
  /** the reticle box rests just OUTSIDE the wall at ring position k (its inner edge touching the water, so the
   *  curl column at the strike point stands clear beside it, never under the corners) */
  const outside = (k: number, half: number): XY => {
    const p = ringPt(k);
    const ox = p.x - c.x;
    const oy = (p.y - c.y) * 2; // iso: the ellipse's outward normal is twice as steep as the radius
    const ol = Math.hypot(ox, oy) || 1;
    return { x: rnd(p.x + (ox / ol) * (half + 2)), y: rnd(p.y - 4 + (oy / ol) * (half + 2) * 0.5) };
  };
  ambient(scene, (el) => {
    ret.clear();
    const p0 = outside(at, 6);
    // the skid runs toward the FRONT centre (down the near arc, away from the stat labels), along the ellipse tangent
    const dirK = fromRight ? 1 : -1;
    // 0–100: the reticle corners close in — not on the crab: onto the FRONT ARC of the wave wall, where they strike
    if (el < 100) {
      const t = el / 100;
      const e = t * t;
      const cx = rnd(lerpN(core.x, p0.x, e));
      const cy = rnd(lerpN(core.y - 4, p0.y, e));
      const half = rnd(lerpN(24, 6, e));
      corners(ret, cx - half, cy - half, cx + half, cy + half, PAL.white);
    } else if (el < 420) {
      if (!hitDone) {
        hitDone = true;
        aura?.hit(at);
        play('harpShlup', { volume: 1, pan });
        startle(scene, u);
      }
      // 100–320: they SKID along the wall (15 px of the ellipse, riding its top), 320–420: flung off outward + up,
      // fading in two tone steps
      const t = (el - 100) / 220;
      const k = Math.min(1, t);
      // 0.12 of the ring ≈ 13–16 px of travel along the wall, riding just outside it (decelerating: friction)
      const skidAt = at + dirK * 0.1 * (1 - (1 - k) * (1 - k));
      const p = ringPt(skidAt);
      const q = outside(skidAt, 6);
      let cx = q.x;
      let cy = q.y;
      let half = 6;
      let col: number = PAL.white;
      if (el >= 320) {
        // it slides on off the wall along the ellipse's tangent (no fling up over the labels), fading in two steps
        const f = (el - 320) / 100;
        const a = Math.PI / 2 + skidAt * Math.PI * 2;
        const tg = { x: -Math.sin(a) * rx * dirK, y: Math.cos(a) * ry * dirK };
        const tl = Math.hypot(tg.x, tg.y) || 1;
        cx = rnd(q.x + (tg.x / tl) * 8 * f);
        cy = rnd(q.y + (tg.y / tl) * 8 * f);
        half = rnd(6 - 2 * f);
        col = f < 0.5 ? PAL.water4 : PAL.water2;
      } else if (t > 0.8) col = PAL.white;
      void p;
      corners(ret, cx - half, cy - half, cx + half, cy + half, col);
      // two foam drops thrown off the curl along the skid (they arc, land as wet dots and soak in)
      const fe = el - 100;
      const s0 = ringPt(at);
      const a0 = Math.PI / 2 + at * Math.PI * 2;
      const tg0 = { x: -Math.sin(a0) * dirK, y: Math.cos(a0) * dirK * 0.5 };
      for (let i = 0; i < 2; i++) {
        const sp = 70 + i * 30;
        const kk = fe / 1000;
        const floorY = s0.y + 2 + i * 2;
        let dx = s0.x + tg0.x * sp * kk;
        let dy: number = s0.y - 9 + (-60 + i * 15) * kk + 420 * kk * kk;
        const landed = dy >= floorY && kk > 0.05;
        if (landed) {
          // it stays where it first touched the floor
          dropAt[i] ??= { x: rnd(dx), y: floorY };
          dx = dropAt[i]!.x;
          dy = dropAt[i]!.y;
        }
        const cdrop = landed ? (fe < 260 ? PAL.water4 : PAL.water3) : PAL.white;
        ret.set(dx, dy, cdrop);
        if (!landed) ret.set(dx, dy + 1, PAL.water4);
      }
    }
    // the plate: pops at 120 ms (one size bigger for 34 ms), holds 500, slides down 3 px and sinks in two steps
    if (el >= 120) {
      if (!stamped) {
        stamped = true;
        play('harpStamp', { volume: 0.85, pan });
      }
      const pe = el - 120;
      if (pe < 34) plateAt(true, 0);
      else if (pe < 534) plateAt(false, 0);
      else if (pe < 600) {
        const k = plateKey(scene, false, 1);
        plate.setTexture(k.key).setPosition(rnd(c.x - k.w / 2), rnd(top.y - 14 - k.h / 2 + 2)).setVisible(true);
      } else if (pe < 660) {
        const k = plateKey(scene, false, 2);
        plate.setTexture(k.key).setPosition(rnd(c.x - k.w / 2), rnd(top.y - 14 - k.h / 2 + 3)).setVisible(true);
      } else {
        ret.destroy();
        plate.destroy();
        return false;
      }
    }
    return true;
  });
}

const lerpN = (a: number, b: number, t: number): number => a + (b - a) * clamp(t, 0, 1);

/**
 * The crab answers the strike on its wall: for two frames it starts up — the special pose's first rise (the body up a
 * px, the eye stalks lifted toward the noise, the rope claw raised over the shell, the harpoon pulled a step out of the
 * sand) — then settles back into its idle. Only while it idles (real time: the UI layer).
 */
function startle(scene: Phaser.Scene, u: MonsterUnit): void {
  if (!u.has('special') || !u.sprite.active || u.retired || u.frameInfo().anim !== 'idle') return;
  if (!u.pose('special', 1)) return;
  ambient(scene, (el) => {
    if (!u.sprite.active || u.retired) return false;
    if (el < 70) return true;
    if (u.frameInfo().anim === 'special') u.rest();
    return false;
  });
}

/** Four 4-px L corners (1-px line, an ink pixel at each outer tip) on a box. */
function corners(s: Surface, x0: number, y0: number, x1: number, y1: number, c: number): void {
  const L = 4;
  for (let i = 0; i < L; i++) {
    s.set(x0 + i, y0, c).set(x0, y0 + i, c);
    s.set(x1 - i, y0, c).set(x1, y0 + i, c);
    s.set(x0 + i, y1, c).set(x0, y1 - i, c);
    s.set(x1 - i, y1, c).set(x1, y1 - i, c);
  }
  s.set(x0 + L, y0, PAL.ink).set(x0, y0 + L, PAL.ink).set(x1 - L, y0, PAL.ink).set(x1, y0 + L, PAL.ink);
  s.set(x0 + L, y1, PAL.ink).set(x0, y1 - L, PAL.ink).set(x1 - L, y1, PAL.ink).set(x1, y1 - L, PAL.ink);
}
