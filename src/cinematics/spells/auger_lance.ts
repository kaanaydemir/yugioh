// Burgu Mızrağı (auger_lance, S7, QUICK spell, destroySpellTrapQuick) — v3 look only (?look=v3); the old look
// keeps the default activation (ctx.base()). Storyboard: docs/v3/YENI_KARTLAR.md §7 S7 — "bilerek kısa ve keskin":
// a steel, spiral-grooved AUGER LANCE screws down out of the sky, spins the target card like a TOP on its corner,
// shavings curl out of its grooves like wood/steel swarf, the card is drilled through, the lance pulls back up.
// Sound identity (§5.1 S7): the 1 → 8 kHz whistle, steel, the 120 Hz saw rotor (src/audio/v3/e/auger_lance.ts).
//
// Paths
//   hand / own set card (own Main Phase): the common v3 spell opening (spells/_kit spellOpening, keepCard,
//        releaseFrom 'top'), then the signature below.
//   QUICK ANSWER (a set card in the opponent's attackDeclared / summoned window): the engine emits `activate`,
//        then asks the activator for the target (a later batch). The activate hook plays the QUICK-SPELL REVEAL
//        (spells/_quick_e.ts: turquoise zig-zag snap, "HIZLI BÜYÜ!", its own sound) and PRIMES the card (it lies
//        back down cocked, a turquoise pulse round its tile); the `target` hook (keyed by this card) springs it
//        back up in the next batch and plays the signature; the battle / summon then carries on (an equip drilled
//        during an attack: the ATK is recalculated before damage — the statChange plays right after the pierce).
//   spell_seal answered the activation: the target arrives in a later batch too — the target hook plays it.
//
// Beat list (scene ms; tempo 1.35 in game time; budget REHBER §5 "Büyü" 1.2–2.0 s → ≤ 2.9 s game):
//   opening  hand ≈ 200 (+ hold 100) / set ≈ 180 (+ hold 100) — the common v3 opening (≤ 0.7 s)
//   T+0      RELEASE: a teal orb leaves the card's top edge for the sky over the target (170 ms, line);
//            the LOCK: a spiral reticle of three teal arcs closes round the target's tile, four corner ticks
//            snap in, the tile flashes teal (e_augerLock at +40)
//   T+170    the orb bursts into a star in the sky — the LANCE pokes out of it, spinning (its grooves scroll), and
//            SCREWS DOWN, accelerating (320 ms): e_augerDescend (the 1 → 8 kHz whistle over the 120 Hz rotor)
//            starts on this frame; its shadow grows on the floor under it (ink checker); teal motion arcs orbit
//            the bit
//   T+340    ANTICIPATION: the vortex of the spinning lance tears the target card off its tile — it tilts up onto
//            ONE CORNER (150 ms) and starts turning slowly (a face-down card shows its face as it turns)
//   T+490    BITE (contact): the tip meets the card's top corner — 50 ms freeze, white star, e_augerBite (steel
//            clank + crack), 1 px shake; the card now spins like a TOP (accelerating 6 → 34 rad/s, a precession
//            wobble), the lance sinks 5 px into it; e_augerDrill (start; the rotor climbing 120 → 165 Hz) and
//            e_augerCurls (+30: dry ticks rising in pitch) — SHAVINGS curl out of the grooves (little steel/teal
//            spirals flung outwards along the spin, falling), chips spark at the contact, the floor light flickers
//            teal, the card tints teal as it heats
//   T+930    PIERCE: drill stops; e_augerPierce (crack + deep punch + steel ring); a 70 ms freeze; the card goes
//            white for 2 frames, the lance punches 10 px THROUGH it, a burst of card shards + a last spray of
//            curls, a white floor flash, 2 px shake; a HOLE stays punched through the card's centre
//   T+1000   RETRACT: the lance pulls straight back up and out of frame (220 ms, ease-in): e_augerRetract
//            ("vuuş") with speed streaks; the drilled card falls flat onto its tile (140 ms, dust), face up,
//            the hole through it
//   T+1180   the drilled card leaves for its owner's graveyard from its tile (card continuity, _v3/card
//            cardLeaves); the spent Burgu Mızrağı card lies down / drops and leaves too (op.leave, +60)
//   T+1240   the rest of the resolution (statChange of an equip's monster, a field spell going out, …) plays
//   ≈ T+1.9 s everything landed. Signature ≈ 1.25 s + the card flights (storyboard: 1.8 s).
//
// Pixel rules: the lance, the reticle, the shavings and the proxy card are whole-pixel rasters (Raster), palette
// only (night / steel / mist / white / teal / ink); the proxy card is rendered by the tiny 3-D card renderer of
// src/art/cards.ts (renderCard) — the same crisp nearest-neighbour look as TileCard. Seeded rng (fxRng) only.

import Phaser from 'phaser';
import type { GameEvent, PlayerId, Uid, ZoneRef } from '../../engine/types';
import type { CardId } from '../../data/cards';
import { PAL } from '../../art/palette';
import { FLAT_H, FLAT_W, STAND_H, STAND_W, ZS, cardMip, isoProject, poseAxes, qAxis, qMul, qSlerp, renderCard, restQuat, standQuat, type Quat } from '../../art/cards';
import type { TileCard } from '../../view/TileCard';
import { DEPTH, LOOK_V3, type XY, zoneXY } from '../../view/layout';
import { shake, wait } from '../../vfx/core';
import { Sparks as PxSparks, stopTime } from '../../vfx/combat';
import { E, Raster, onFrame, run, seg } from '../../vfx/setpieces';
import { cardLeaves } from '../_v3/card';
import { panAt, play as playV3, start as startV3 } from '../_v3/sound';
import { fxRng } from '../_v3/spellfx';
import { fx, registerCardHook, type CinematicContext } from '../api';
import { evAt, idxOf, lightFlash, lightPool, relax, spellOpening, type Opening } from './_kit';
import { prime, primeKey, quickReveal } from './_quick_e';

type AnyCtx = CinematicContext<GameEvent>;

// ---------------------------------------------------------------- timing (scene ms)

const ORB_MS = 170;
const DESCENT_MS = 300;
const LIFT_MS = 150;
const DRILL_MS = 400;
const RETRACT_MS = 220;
const COLLAPSE_MS = 120;
const BITE_STOP = 50;
const PIERCE_STOP = 70;

// ---------------------------------------------------------------- the proxy card (spinning top)

/** The proxy card's size while it stands on its corner (world units; 0.8 of a standing card). */
const TOP_S = 0.56;
const TOP_W = STAND_W * TOP_S;
const TOP_H = STAND_H * TOP_S;
/** Vertical extent of the card standing on one corner (rolled 45° in its plane), world units. */
const TOP_EXT = (TOP_W + TOP_H) / Math.SQRT2;
/** Height of its centre / its top corner above the floor (world z). */
const TOP_ZC = TOP_EXT / 2 + 1;
const BUF = 128;
const BC = 64;
const ROLL = qAxis([0, 0, 1], Math.PI / 4);

interface TopPose {
  q: Quat;
  w: number;
  h: number;
  z: number;
  light?: number;
  tint?: number;
  tintAmt?: number;
  solid?: number;
  hole?: number;
}

/** The card standing on its corner, turned θ round the vertical, with a small precession wobble. */
function cornerQ(theta: number, wobble: number): Quat {
  const tilt = qAxis([Math.cos(theta * 0.5), Math.sin(theta * 0.5), 0], wobble);
  return qMul(tilt, qMul(qAxis([0, 0, 1], theta), qMul(standQuat(), ROLL)));
}

/** A whole-pixel proxy of the target card, rendered every frame by the 3-D card renderer. */
class TopCard {
  readonly ras: Raster;
  private readonly front;
  private readonly back;
  constructor(
    readonly scene: Phaser.Scene,
    readonly floor: XY,
    cardId: CardId,
    owner: PlayerId,
    depth: number,
  ) {
    this.ras = new Raster(scene, floor.x - BC, floor.y - BC, BUF, BUF, depth);
    this.front = cardMip(cardId, owner);
    this.back = cardMip('back', owner);
  }
  draw(p: TopPose): void {
    const r = this.ras;
    if (!r.alive) return;
    const [, py] = isoProject([0, 0, p.z]);
    r.moveTo(this.floor.x - BC, Math.round(this.floor.y + py) - BC);
    r.begin();
    const { ex, ey, n } = poseAxes(p.q, p.w, p.h);
    renderCard(r.pc, BC, BC, ex, ey, n, this.front, this.back, { light: p.light, tint: p.tint, tintAmt: p.tintAmt, solid: p.solid });
    // the drilled hole through the card's centre: a punched-out ellipse with a burnt ink / teal1 lip
    if (p.hole && p.hole > 0) {
      const rx = p.hole;
      const ry = Math.max(1, Math.round(p.hole * 0.6));
      for (let y = -ry - 1; y <= ry + 1; y++)
        for (let x = -rx - 1; x <= rx + 1; x++) {
          const d = (x * x) / (rx * rx) + (y * y) / (ry * ry);
          const X = BC + x;
          const Y = BC + y;
          if (!r.pc.isOpaque(X, Y)) continue;
          if (d <= 1) r.pc.erase(X, Y);
          else if (d <= 1.9) r.pc.set(X, Y, y < 0 ? PAL.ink : PAL.teal1);
        }
    }
    r.end();
  }
  /** Screen point of the top corner while it stands on its corner at height z (on the vertical axis). */
  destroy(): void {
    this.ras.destroy();
  }
}

// ---------------------------------------------------------------- the lance (pixel raster, drawn every frame)

const L_BIT = 18;
const L_SHAFT = 52;
const L_COLLAR = 9;
const L_LEN = L_BIT + L_SHAFT + L_COLLAR;
const L_W = 34;

/** Body tones across the shaft (key light from the top left): lit, mid, shade. */
function bodyTone(c: number, hw: number): number {
  const f = (c + hw) / Math.max(1, 2 * hw);
  return f < 0.3 ? PAL.mist : f < 0.68 ? PAL.steel : PAL.night4;
}

/**
 * Draw the auger lance with its tip at (x, tipY): a tapering spiral bit, a grooved shaft, a collar with a teal
 * band; the spiral grooves scroll with `phase` (it turns); `orbit` (rad) places the two teal motion arcs.
 */
function drawLance(g: Raster, x: number, tipY: number, phase: number, orbit: number, o: { arcs?: boolean; hot?: number } = {}): void {
  const top = tipY - L_LEN;
  const rowHW = (y: number): number => {
    const d = tipY - y;
    if (d < L_BIT) return Math.floor((d * 4.6) / L_BIT);
    if (d < L_BIT + L_SHAFT) return 4;
    if (d < L_BIT + L_SHAFT + 2) return 6;
    if (d < L_BIT + L_SHAFT + 6) return 5;
    return 4;
  };
  // ink outline first (1 px around the body, and under the tip)
  for (let y = top; y <= tipY; y++) {
    const hw = rowHW(y);
    g.px(x - hw - 1, y, PAL.ink);
    g.px(x + hw + 1, y, PAL.ink);
  }
  g.rect(x - 4, top - 1, 9, 1, PAL.ink);
  g.px(x, tipY + 1, PAL.ink);
  for (let y = top; y <= tipY; y++) {
    const d = tipY - y;
    const hw = rowHW(y);
    const collar = d >= L_BIT + L_SHAFT;
    for (let c = -hw; c <= hw; c++) {
      let col = bodyTone(c, hw);
      if (collar) {
        // the collar: dark steel with a glowing teal band (the spell's energy driving the rotor)
        const cd = d - L_BIT - L_SHAFT;
        col = cd === 2 || cd === 3 ? (Math.floor(phase / 2) % 2 ? PAL.teal4 : PAL.teal3) : cd >= 7 ? PAL.night3 : c < -1 ? PAL.steel : PAL.night4;
      } else {
        // the spiral groove (slope ≈ 0.7 px per column), scrolling down as the lance turns; a lit lip above it
        const k = (((y + Math.floor((c + hw) * 0.7) - phase) % 6) + 6) % 6;
        if (k === 0) col = c > hw - 2 ? PAL.night1 : PAL.night2;
        else if (k === 1 && c < hw - 1) col = c < 0 ? PAL.white : PAL.mist;
        // the bit's cutting edge heats teal near the tip while drilling
        if (o.hot && d < 5 && k !== 0) col = o.hot > 0.5 ? PAL.teal4 : col;
      }
      g.px(x + c, y, col);
    }
  }
  // the very tip: one white pixel
  g.px(x, tipY, PAL.white);
  if (o.arcs) {
    // two teal motion arcs orbiting the bit (front half bright, back half dim)
    for (let i = 0; i < 2; i++) {
      const a = orbit + i * Math.PI;
      const ay = tipY - 8 - i * 9;
      for (let s = 0; s < 4; s++) {
        const aa = a - s * 0.32;
        const px = Math.round(x + Math.cos(aa) * 7);
        const py = Math.round(ay + Math.sin(aa) * 2);
        const front = Math.sin(aa) > 0;
        if (!front && Math.abs(px - x) <= 3) continue; // behind the shaft
        g.px(px, py, s === 0 ? (front ? PAL.white : PAL.teal3) : front ? PAL.teal4 : PAL.teal2);
      }
    }
  }
}

// ---------------------------------------------------------------- small set pieces

/** The spiral reticle closing round the target's tile (three teal arcs + four corner ticks), until stopped. */
function lockReticle(sc: Phaser.Scene, at: XY): { stop(ms?: number): Promise<void> } {
  const ras = Raster.around(sc, at.x, at.y, 96, 56, DEPTH.SHADOW - 1);
  let level = 1;
  let dead = false;
  const stop = onFrame(sc, (_dt, el) => {
    if (dead) return false;
    ras.draw((g) => {
      if (level <= 0.02) return;
      const k = E.outCubic(Math.min(1, el / 220));
      const rx = Math.round(40 - 16 * k);
      const ry = Math.round(rx / 2);
      const a0 = el * 0.009;
      for (let i = 0; i < 3; i++) {
        const a = a0 + (i * Math.PI * 2) / 3;
        g.ring(at.x, at.y, rx, ry, i === 0 ? PAL.teal4 : PAL.teal3, level, a, a + 1.1);
      }
      g.ring(at.x, at.y, rx - 5, ry - 3, PAL.teal1, level * 0.8, -a0 * 1.3, -a0 * 1.3 + 2.2);
      if (el > 120) {
        // four corner ticks snap in (an iso diamond round the tile)
        const s = el < 160 ? 4 : 0;
        for (const [dx, dy] of [
          [0, -1],
          [1, 0],
          [0, 1],
          [-1, 0],
        ] as const) {
          const cx = Math.round(at.x + dx * (30 + s));
          const cy = Math.round(at.y + dy * (15 + s / 2));
          g.px(cx, cy, PAL.white);
          g.px(cx - dy, cy + dx, PAL.teal4);
          g.px(cx + dy, cy - dx, PAL.teal4);
        }
      }
    });
    return true;
  });
  return {
    async stop(ms = 160) {
      if (dead) return;
      await run(sc, ms, (t) => (level = 1 - t));
      dead = true;
      stop();
      ras.destroy();
    },
  };
}

/** A white-teal star burst at a point (the orb becoming the lance; the bite). */
function star(sc: Phaser.Scene, at: XY, size = 6, ms = 160, depth: number = DEPTH.FX + 8): void {
  const ras = Raster.around(sc, at.x, at.y, size * 4 + 6, size * 4 + 6, depth);
  void run(sc, ms, (t) => {
    ras.draw((g) => {
      const s = Math.round(size * (1 - E.inQuad(t)));
      if (s <= 0) return;
      g.rect(at.x - s * 2, at.y, s * 4 + 1, 1, t < 0.4 ? PAL.white : PAL.teal4);
      g.rect(at.x, at.y - s, 1, s * 2 + 1, t < 0.4 ? PAL.white : PAL.teal4);
      g.rect(at.x - 1, at.y - 1, 3, 3, PAL.white);
      if (s > 2) {
        g.px(at.x - s, at.y - s + 1, PAL.teal3);
        g.px(at.x + s, at.y - s + 1, PAL.teal3);
        g.px(at.x - s, at.y + s - 1, PAL.teal3);
        g.px(at.x + s, at.y + s - 1, PAL.teal3);
      }
    });
  }).then(() => ras.destroy());
}

interface Curl {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  size: number;
  age: number;
  life: number;
  teal: boolean;
  floor: number;
}

/** The shavings: little steel / teal spirals flung outwards along the spin, curling as they fly and fall. */
class Curls {
  private readonly ras: Raster;
  private readonly list: Curl[] = [];
  private readonly stopFn: () => void;
  private dead = false;
  constructor(
    readonly sc: Phaser.Scene,
    readonly at: XY,
    depth: number,
  ) {
    this.ras = Raster.around(sc, at.x, at.y + 10, 220, 150, depth);
    this.stopFn = onFrame(sc, (dt) => this.tick(dt));
  }
  add(c: Omit<Curl, 'age'>): void {
    this.list.push({ ...c, age: 0 });
  }
  private tick(dt: number): boolean {
    if (this.dead) return false;
    const s = dt / 1000;
    this.ras.draw((g) => {
      for (let i = this.list.length - 1; i >= 0; i--) {
        const c = this.list[i];
        c.age += dt;
        if (c.age >= c.life) {
          this.list.splice(i, 1);
          continue;
        }
        c.vy += 300 * s;
        c.vx *= Math.exp(-1.6 * s);
        c.x += c.vx * s;
        c.y += c.vy * s;
        if (c.y > c.floor) {
          c.y = c.floor;
          c.vy *= -0.3;
          c.vx *= 0.5;
          c.vr *= 0.5;
        }
        c.rot += c.vr * s;
        // a little Archimedean spiral of 7 whole pixels: bright at its curled-in end, steel at its tail
        const n = 7;
        let lx = NaN;
        let ly = NaN;
        for (let j = 0; j < n; j++) {
          const ang = c.rot + j * 0.95;
          const rr = 0.4 + (j * c.size) / n;
          const px = Math.round(c.x + Math.cos(ang) * rr);
          const py = Math.round(c.y + Math.sin(ang) * rr * 0.8);
          if (px === lx && py === ly) continue;
          lx = px;
          ly = py;
          const fade = c.age > c.life * 0.75 && j > 3;
          if (fade) continue;
          g.px(px, py, j < 2 ? PAL.white : c.teal ? (j < 4 ? PAL.teal4 : PAL.teal2) : j < 4 ? PAL.mist : PAL.steel);
        }
      }
    });
    return true;
  }
  destroyWhenDone(): void {
    const sc = this.sc;
    const poll = onFrame(sc, () => {
      if (this.list.length && !this.dead) return true;
      this.destroy();
      return false;
    });
    void poll;
  }
  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    this.stopFn();
    this.ras.destroy();
  }
}

/** The lance's shadow on the floor: an ink checker ellipse that grows as it nears (no alpha). */
function floorShadow(sc: Phaser.Scene, at: XY): { set(k: number): void; destroy(): void } {
  const ras = Raster.around(sc, at.x, at.y, 40, 14, DEPTH.SHADOW - 2);
  return {
    set(k: number) {
      ras.draw((g) => {
        const rx = Math.round(2 + 9 * k);
        const ry = Math.max(1, Math.round(rx / 2.4));
        for (let y = -ry; y <= ry; y++)
          for (let x = -rx; x <= rx; x++) {
            if ((x * x) / (rx * rx) + (y * y) / (ry * ry) > 1) continue;
            const X = at.x + x;
            const Y = at.y + y;
            if (k > 0.7 || (X + Y) % 2 === 0) g.px(X, Y, PAL.ink);
          }
      });
    },
    destroy() {
      ras.destroy();
    },
  };
}

// ---------------------------------------------------------------- the signature

interface SigArgs {
  /** The activation's opening (keepCard, releaseFrom 'top'). */
  op: Opening;
  /** The target card. */
  ref: ZoneRef;
  /** This auger lance's uid. */
  uid: Uid;
  /** Indices of the resolution events still to play (the target event itself excluded). */
  run: number[];
}

async function signature(ctx: AnyCtx, s: SigArgs): Promise<void> {
  const sc = ctx.scene;
  const field = ctx.views.field;
  const { op, ref } = s;
  const spot = ref.zone === 'field' ? 'field' : 'spellTrap';
  const floor0 = zoneXY(ref.player, spot, ref.index);
  const floor = { x: Math.round(floor0.x), y: Math.round(floor0.y) };
  const pan = panAt(floor.x);
  const rnd = fxRng(4242 + s.uid * 7 + ref.index * 13);
  // the resolution: the victim's destroy + its trip to the graveyard, the lance's own trip, the rest
  const di = idxOf(ctx, s.run, (e) => e.type === 'destroy' && e.player === ref.player && (ref.zone === 'field' ? e.location === 'field' : e.location === 'spellTrap' && e.zone === ref.index));
  const dEv = evAt(ctx, di, 'destroy');
  const vgi = dEv ? idxOf(ctx, s.run, (e) => e.type === 'toGraveyard' && e.uid === dEv.uid) : -1;
  const gi = idxOf(ctx, s.run, (e) => e.type === 'toGraveyard' && e.uid === s.uid && e.from === 'resolved');
  const victimTile0 = field.tileAt(ref.player, spot, ref.index);
  const victimTile: TileCard | null = victimTile0 && victimTile0.active ? victimTile0 : null;
  const victimId: CardId | null = dEv?.cardId ?? victimTile?.cardId ?? null;
  if (di < 0 || !victimId) {
    // nothing to drill (the target left in between): the card simply goes
    await op.close();
    relax(ctx);
    await fx.playRun(ctx, fx.resolutionRun(ctx));
    return;
  }
  ctx.consumeAt(di);
  const owned = vgi >= 0;
  if (owned) ctx.consumeAt(vgi);
  // the victim's tile: ours when its card goes to the graveyard here; else (Hınç Baltası's return to the deck)
  // it is only hidden under the proxy and shown again for the next handler
  const tile = owned ? field.release(dEv!.uid).tile : victimTile;
  const faceUp = tile ? tile.faceUp : true;
  const owner = ref.player;
  const uDepth = DEPTH.UNIT + floor.y;
  const sky: XY = { x: floor.x, y: Math.max(14, floor.y - 140) };
  // (the camera never moves in lane E scenes)

  // ---- T+0: release + lock
  const lock = lockReticle(sc, floor);
  if (tile && tile.active) tile.tileFlash(PAL.teal3, 260);
  void wait(sc, 40).then(() => playV3('e_augerLock', { volume: 0.8, pan }));
  await op.release(sky, { path: 'line', ms: ORB_MS, size: 2, light: false });

  // ---- T+170: the lance pokes out of the orb's star and screws down
  star(sc, sky, 7, 180, uDepth + 2);
  void lightFlash(sc, sky.x, sky.y, PAL.teal4, 24, 240, { floorY: floor.y, air: 0.8, intensity: 0.8 });
  playV3('e_augerDescend', { volume: 0.95, pan });
  const LR_TOP = -L_LEN - 20;
  const lance = new Raster(sc, floor.x - L_W / 2, LR_TOP, L_W, floor.y - LR_TOP + 4, uDepth + 1);
  const shadow = floorShadow(sc, floor);
  const top = new TopCard(sc, floor, victimId, owner, uDepth + 0.5);
  const flatPose: TopPose = { q: restQuat(owner, 'up', faceUp), w: FLAT_W, h: FLAT_H, z: 0 };
  const theta0 = faceUp ? 0 : Math.PI;
  const contactY = Math.round(floor.y + isoProject([0, 0, TOP_ZC * 2])[1]);
  const startTip = sky.y;
  let tipY = startTip;
  let phase = 0;
  let orbit = 0;
  let hot = 0;
  let lanceOn = true;
  const drawL = () => {
    if (!lanceOn) return;
    lance.draw((g) => drawLance(g, floor.x, Math.round(tipY), Math.floor(phase), orbit, { arcs: true, hot }));
  };
  // the card's spin state
  let theta = theta0;
  let wob = 0;
  let spinV = 0;
  let tint = 0;
  const cornerPose = (): TopPose => ({ q: cornerQ(theta, wob), w: TOP_W, h: TOP_H, z: TOP_ZC, light: 0.22 * Math.cos(theta * 2), tint: PAL.teal4, tintAmt: tint });
  const liftPose = (k: number): TopPose => {
    const e = E.outCubic(k);
    const c = cornerPose();
    return { q: qSlerp(flatPose.q, c.q, e), w: FLAT_W + (TOP_W - FLAT_W) * e, h: FLAT_H + (TOP_H - FLAT_H) * e, z: TOP_ZC * e + 4 * Math.sin(Math.PI * k), light: c.light, tint: c.tint, tintAmt: c.tintAmt };
  };
  // the proxy shows from the start (flat, exactly the tile's look), the tile hides under it
  top.draw(flatPose);
  if (tile && tile.active) tile.setVisible(false);
  // a spinning loop drives the proxy + the lance from now until the pierce (whatever pose is current)
  let spinning = true;
  let liftK = -1;
  let poseNow: () => TopPose = () => flatPose;
  const spinLoop = onFrame(sc, (dt) => {
    if (!spinning) return false;
    const s2 = dt / 1000;
    phase += s2 * (liftK >= 1 ? 70 : 40);
    orbit += s2 * 22;
    theta += spinV * s2;
    top.draw(poseNow());
    drawL();
    return true;
  });
  // descent (ease-in, a little linear so it never hangs at the top), the shadow grows; 150 ms before the
  // contact the vortex tears the card up onto its corner, turning slowly (anticipation)
  const liftStart = DESCENT_MS - LIFT_MS;
  await run(sc, DESCENT_MS, (t, el) => {
    const k = 0.25 * t + 0.75 * E.inQuad(t);
    tipY = startTip + (contactY - startTip) * k;
    shadow.set(t);
    if (el >= liftStart) {
      if (liftK < 0) {
        spinV = 6;
        poseNow = () => (liftK < 1 ? liftPose(liftK) : cornerPose());
      }
      liftK = Math.min(1, (el - liftStart) / LIFT_MS);
    }
  });
  liftK = 1;
  poseNow = cornerPose;
  tipY = contactY;
  top.draw(cornerPose());
  drawL();

  // ---- T+490: BITE
  playV3('e_augerBite', { volume: 1, pan });
  star(sc, { x: floor.x, y: contactY }, 6, 150, uDepth + 2);
  void lightFlash(sc, floor.x, contactY, PAL.white, 22, 220, { floorY: floor.y, air: 0.7, intensity: 1 });
  void shake(sc, 100, 1);
  void lock.stop(200);
  await stopTime(sc, BITE_STOP);
  const drill = startV3('e_augerDrill', { volume: 0.85, pan });
  void wait(sc, 30).then(() => playV3('e_augerCurls', { volume: 0.9, pan }));
  const floorLight = lightPool(sc, floor.x, floor.y, { color: PAL.teal3, radius: 30, floorY: floor.y, intensity: 0.9, anim: 'flicker', fadeIn: 0 });
  const curls = new Curls(sc, { x: floor.x, y: contactY }, uDepth + 1.5);
  const chips = new PxSparks(sc, uDepth + 1.6);
  let curlAcc = 0;
  let chipAcc = 0;
  const dir = s.uid % 2 ? 1 : -1;
  await run(sc, DRILL_MS, (t, _el, dt) => {
    spinV = 6 + 28 * E.inQuad(t);
    wob = 0.09 * Math.sin(t * 9) * (1 - t * 0.4);
    tint = 0.32 * E.inQuad(t);
    hot = t;
    tipY = contactY + Math.round(5 * E.outCubic(t));
    curlAcc += dt;
    chipAcc += dt;
    // shavings flung along the spin (one side faster: the turning direction), denser as it bites
    const every = 70 - 40 * t;
    while (curlAcc >= every) {
      curlAcc -= every;
      const side = rnd() < 0.68 ? dir : -dir;
      curls.add({
        x: floor.x + side * 2,
        y: Math.round(tipY) + 2,
        vx: side * (50 + rnd() * 80),
        vy: -(40 + rnd() * 70),
        rot: rnd() * 6.28,
        vr: side * (8 + rnd() * 10),
        size: 2 + Math.floor(rnd() * 3),
        life: 520 + rnd() * 300,
        teal: rnd() < 0.3,
        floor: floor.y + Math.round((rnd() - 0.3) * 10),
      });
    }
    if (chipAcc >= 40) {
      chipAcc = 0;
      const a = rnd() * Math.PI * 2;
      chips.add({ x: floor.x, y: Math.round(tipY) + 1, vx: Math.cos(a) * 70, vy: Math.sin(a) * 40 - 30, drag: 3, life: 140 + rnd() * 100, colors: [PAL.white, PAL.teal4, PAL.teal3], shape: 'px', fadeAt: 1 });
    }
  });

  // ---- T+930: PIERCE
  drill.stop(25);
  playV3('e_augerPierce', { volume: 1, pan });
  spinning = false;
  spinLoop();
  tipY = contactY + 15;
  hot = 1;
  drawL();
  top.draw({ ...cornerPose(), tint: PAL.white, tintAmt: 0.7 });
  void lightFlash(sc, floor.x, floor.y - 20, PAL.white, 44, 380, { floorY: floor.y, ring: true, intensity: 1.4, air: 0.6 });
  void floorLight.fadeOut(260);
  void shake(sc, 160, 2);
  // the last spray of curls + card shards out of the hole
  const holeAt = { x: floor.x, y: Math.round(floor.y + isoProject([0, 0, TOP_ZC])[1]) };
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    curls.add({ x: holeAt.x, y: holeAt.y, vx: Math.cos(a) * (70 + rnd() * 60), vy: Math.sin(a) * 50 - 60, rot: rnd() * 6.28, vr: 12, size: 2 + Math.floor(rnd() * 2), life: 600, teal: i % 3 === 0, floor: floor.y + Math.round((rnd() - 0.3) * 10) });
  }
  const shardSp = new PxSparks(sc, uDepth + 1.6);
  for (let i = 0; i < 16; i++) {
    const a = rnd() * Math.PI * 2;
    const v = 60 + rnd() * 110;
    shardSp.add({ x: holeAt.x, y: holeAt.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6 - 30, ay: 260, drag: 1.5, life: 300 + rnd() * 250, colors: [PAL.white, PAL.teal4, PAL.night4, PAL.night3], shape: i % 5 === 0 ? 'plus' : 'px', floor: floor.y + 4, bounce: 0.3, fadeAt: 0.8 });
  }
  shardSp.release();
  chips.release();
  curls.destroyWhenDone();
  await stopTime(sc, PIERCE_STOP);
  top.draw({ ...cornerPose(), hole: 3 });

  // ---- T+1000: RETRACT + the drilled card falls flat
  playV3('e_augerRetract', { volume: 0.9, pan });
  shadow.destroy();
  const tip1 = tipY;
  const retract = run(sc, RETRACT_MS, (t) => {
    tipY = tip1 + (LR_TOP + L_LEN - 30 - tip1) * E.inQuad(t);
    phase += 3;
    lance.draw((g) => {
      drawLance(g, floor.x, Math.round(tipY), Math.floor(phase), orbit, { arcs: false, hot: 1 - t });
      // speed streaks under the leaving lance
      const len = Math.round(30 * Math.min(1, t * 3));
      if (len > 0) {
        g.rect(floor.x - 6, Math.round(tipY) + 2, 1, len, PAL.teal2);
        g.rect(floor.x + 6, Math.round(tipY) + 6, 1, Math.round(len * 0.7), PAL.teal3);
        g.rect(floor.x, Math.round(tipY) + 3, 1, Math.round(len * 0.4), PAL.white);
      }
    });
  }).then(() => {
    lanceOn = false;
    lance.destroy();
  });
  // the drilled card drops flat on its tile, FACE UP (what was drilled reads), the hole through it
  const endQ = restQuat(owner, 'up', true);
  const cq = cornerPose().q;
  await run(sc, COLLAPSE_MS, (t) => {
    const e = E.inQuad(t);
    top.draw({ q: qSlerp(cq, endQ, e), w: TOP_W + (FLAT_W - TOP_W) * e, h: TOP_H + (FLAT_H - TOP_H) * e, z: TOP_ZC * (1 - e), hole: 3 - Math.round(e), tint: PAL.teal4, tintAmt: 0.3 * (1 - e) });
  });
  top.draw({ q: endQ, w: FLAT_W, h: FLAT_H, z: 0, hole: 2 });
  floorDust(sc, floor, uDepth + 0.6, rnd);
  void lightFlash(sc, floor.x, floor.y, PAL.teal2, 26, 260, { intensity: 0.6 });
  await wait(sc, 20);

  // ---- T+1180: the cards leave (the drilled one, then the spent lance)
  let victimGone: Promise<void> = Promise.resolve();
  const vg = evAt(ctx, vgi, 'toGraveyard');
  if (owned && vg) {
    if (tile && tile.active) tile.destroy();
    victimGone = cardLeaves(ctx, { owner: vg.owner, cardId: vg.cardId, from: floor });
    top.destroy();
  } else {
    // the card stays for the next handler (e.g. a return to the deck): the tile shows again under the proxy
    if (tile && tile.active) {
      tile.setVisible(true);
      if (tile.faceUp !== true && dEv) tile.setCard(dEv.cardId);
    }
    top.destroy();
  }
  const spent = wait(sc, 40).then(() => (op.leave ? op.leave(gi) : undefined));
  await retract;
  relax(ctx, 300);
  // the rest of the resolution (an equip's monster's ATK, a field spell going out, …)
  const rest = s.run.filter((i) => i !== di && i !== vgi && i !== gi && !ctx.isConsumed(i));
  await fx.playRun(ctx, rest);
  await fx.all([victimGone, spent]);
  await fx.playRun(ctx, fx.resolutionRun(ctx));
}

/** A ring of dust puffs as the drilled card slaps flat on its tile. */
function floorDust(sc: Phaser.Scene, at: XY, depth: number, rnd: () => number): void {
  const sp = new PxSparks(sc, depth);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    sp.add({ x: Math.round(at.x + Math.cos(a) * 12), y: Math.round(at.y + Math.sin(a) * 6), vx: Math.cos(a) * 30, vy: Math.sin(a) * 12 - 6, drag: 4, life: 260 + rnd() * 160, size: 2, shape: 'puff', colors: [PAL.night4, PAL.night3, PAL.night2], fadeAt: 0.6 });
  }
  sp.release();
}

function bg(p: Promise<unknown>): void {
  p.catch((e) => console.error('[auger_lance]', e));
}

// ---------------------------------------------------------------- hooks

registerCardHook('auger_lance', 'activate', async (ctx) => {
  if (!LOOK_V3) return ctx.base();
  const ev = ctx.ev;
  const run0 = fx.resolutionRun(ctx);
  const ti = idxOf(ctx, run0, (e) => e.type === 'target' && e.sourceUid === ev.uid);
  const response = ev.from === 'spellTrap' && ctx.state.activePlayer !== ev.player;
  if (response) {
    // the quick answer: the reveal now, the target in the next batch (the 'target' hook below)
    const q = await quickReveal(ctx);
    await prime(ctx, q, ev.uid);
    return;
  }
  const set = ev.from === 'spellTrap' && ev.zone !== null && !!ctx.views.field.tileAt(ev.player, 'spellTrap', ev.zone);
  const op = await spellOpening(ctx, { uid: ev.uid, cardId: ev.cardId, player: ev.player, from: set ? 'set' : 'hand', zone: ev.zone, hold: 150, keepCard: true, releaseFrom: 'top' });
  const tEv = evAt(ctx, ti, 'target');
  const ref = tEv?.targets[0] ?? null;
  if (!ref) {
    // the target comes later (a spell_seal window opened): the 'target' hook plays the lance then
    await op.close();
    relax(ctx);
    return;
  }
  ctx.consumeAt(ti);
  await signature(ctx, { op, ref, uid: ev.uid, run: run0.filter((i) => i !== ti) });
});

registerCardHook('auger_lance', 'target', async (ctx) => {
  if (!LOOK_V3) return ctx.base();
  const ev = ctx.ev;
  const ref = ev.targets[0];
  if (!ref) return ctx.base();
  const uid = ev.sourceUid;
  const p = ev.player;
  ctx.take(primeKey(uid))?.destroy();
  const zone = ctx.state.players[p].spellTraps.findIndex((st) => st?.uid === uid);
  const onField = zone >= 0 && !!ctx.views.field.tileAt(p, 'spellTrap', zone);
  // the primed card springs back up (the common v3 set opening, short hold) and fires
  const op = await spellOpening(ctx as unknown as AnyCtx, { uid, cardId: 'auger_lance', player: p, from: onField ? 'set' : 'hand', zone: onField ? zone : null, hold: 100, keepCard: true, releaseFrom: 'top' });
  await signature(ctx as unknown as AnyCtx, { op, ref, uid, run: fx.resolutionRun(ctx) });
});
