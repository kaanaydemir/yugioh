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
import { lightPool, type LightHandle } from '../../view/light';
import { animate } from '../../vfx/combat';
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
      // up to 10 px in 60 ms, then down over 260 ms
      this.curlK = el < 60 ? el / 60 : Math.max(0, 1 - (el - 60) / 260);
      return el0 < 340;
    });
  }
  private draw(): void {
    this.back.clear();
    this.front.clear();
    if (this.height <= 0 && this.collapse <= 0 && this.run < 0) return;
    const rx = Math.floor(TILE_W / 2) - 1;
    const ry = Math.floor(TILE_H / 2) - 1;
    const crest = this.run >= 0 ? this.run : this.crest;
    const o = { height: this.height, crest, curlAt: this.curlAt, curl: this.curlK, collapse: this.collapse, rx, ry };
    // the back arc a px lower than the front (1 px vs 2 px, EF-2: the front stays at the feet)
    shroudWall(this.back.canvas, this.c.x, this.c.y, 'back', { ...o, height: Math.max(0, this.height - 1) });
    shroudWall(this.front.canvas, this.c.x, this.c.y, 'front', o);
  }
  /** A: the wall rises (0 → 4 px over 400 ms, then 2 px; one crest run round it over 600 ms). */
  async raise(short: boolean): Promise<void> {
    const sc = this.u.scene;
    const up = short ? 240 : 400;
    this.setLight(0.5, up);
    await animate(sc, up, (t) => (this.height = 4 * t));
    void animate(sc, short ? 360 : 600, (t) => (this.run = t >= 1 ? -1 : t)).then(() => (this.run = -1));
    await animate(sc, short ? 160 : 220, (t) => (this.height = 4 - 2 * t));
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
    let raised: Promise<void> = Promise.resolve();
    const go = () => {
      play('harpBayRaise', { volume: 0.9, pan });
      play('harpPlant', { volume: 0.7, pan, pitch: 1.05 });
      raised = a.raise(false);
    };
    if (u.has('special')) atFrame(u, 'special', relF, go);
    else go();
    await anim;
    await raised;
    if (u.sprite.active && !u.retired && u.frameInfo().anim !== 'special') u.rest();
  } else if (!on && cur) {
    play('harpBayDrop', { volume: 0.9, pan: panAt(u.home.x) });
    await cur.drop();
    if (u.aura(AURA) === cur) u.setAura(AURA, null);
  }
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
  // the box the corners close on: the crab's body above its tile
  const core = u.core();
  const box = { x0: rnd(core.x - 22), x1: rnd(core.x + 22), y0: rnd(core.y - 24), y1: rnd(c.y + 2) };
  // where they strike the wall: the front of the ring, on the side the corners come from (the opponent's side)
  const fromRight = u.player === 0; // P2 sits up-right of P1's monsters
  const at = fromRight ? 0.88 : 0.12; // (u grows from the front centre toward the LEFT on screen)
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
  const top = u.worldPoint('top');
  const plateAt = (big: boolean, dy: number): void => {
    const k = plateKey(scene, big, 0);
    plate.setTexture(k.key).setPosition(rnd(c.x - k.w / 2), rnd(top.y - 14 - k.h / 2 + dy)).setVisible(true);
  };
  ambient(scene, (el) => {
    ret.clear();
    // 0–90: the corners close in (gap 10 → 0) on the crab
    if (el < 90) {
      const g = rnd(10 * (1 - el / 90));
      corners(ret, box.x0 - g, box.y0 - g, box.x1 + g, box.y1 + g, PAL.white);
    } else if (el < 300) {
      if (!hitDone) {
        hitDone = true;
        aura?.hit(at);
        play('harpShlup', { volume: 0.9, pan });
      }
      // 90–300: they skid 12 px along the ellipse and are flung off, two tone steps out
      const t = (el - 90) / 210;
      const p0 = ringPt(at);
      const p1 = ringPt(at + (fromRight ? -0.06 : 0.06));
      const sk = { x: p0.x + (p1.x - p0.x) * Math.min(1, t * 1.6), y: p0.y + (p1.y - p0.y) * Math.min(1, t * 1.6) };
      const fling = t > 0.55 ? (t - 0.55) * 30 : 0;
      const dx = rnd(sk.x - p0.x + (fromRight ? fling : -fling));
      const dy = rnd(sk.y - p0.y - fling * 0.8);
      const col = t < 0.5 ? PAL.white : t < 0.8 ? PAL.water4 : PAL.water2;
      const half = rnd(lerpN(22, 8, t));
      const cx = rnd(core.x + dx);
      const cy = rnd(core.y + dy + 6);
      corners(ret, cx - half, cy - half, cx + half, cy + half, col);
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
