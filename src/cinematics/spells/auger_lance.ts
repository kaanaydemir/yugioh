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
// Beat list (scene ms; tempo 1.35 in game time; the §7 storyboard length wins over REHBER §5 — see TEMPO.md):
//   opening  hand / own set card: the common v3 opening (≤ 0.7 s). Quick answer: no opening here — the reveal
//            played in the activate batch; quickFire is a small cock-and-release (the card dips, leans up ~60°, one
//            spark tick, e_quickFire) — a follow-through, not a second reveal; it lies back down, dimmed, as the lance appears
//   T+0      RELEASE + LOCK: a 7-px teal orb with a twin spiral trail flies to the sky over the target (170 ms, its
//            own light); a spiral reticle closes round the target's tile, corner ticks snap in (e_augerLock +40)
//            (an equip: its holder's bond snaps in teal here — the little aura sword fizzles, it never floats in
//            front of the drilled card)
//   T+170    the orb bursts into a star and spins open the SKY RIFT (a turquoise spiral aperture, its own light);
//            the LANCE (13 px shaft / 17 px collar, a deep two-tone helical flute, a thin drive spindle running up
//            into the rift — cut cleanly by the rift's near lip) screws down out of it (300 ms, e_augerDescend: the
//            1 → 8 kHz whistle over the 120 Hz rotor) with a vertical speed smear, its shadow grows;
//            150 ms before contact the vortex tears the card up onto ONE CORNER, turning (a face-down card shows
//            its face as it turns)
//   T+470    BITE: 50 ms freeze, star, e_augerBite, 1 px shake; the card spins like a TOP (6 → 20 rad/s, drawn in
//            12 clear poses per turn), its side corners trail 1-px teal arcs, its shadow precesses under it
//   T+520    DRILL (480 ms): a teal vortex helix wraps the bit, the lance shudders 1 px, sinks 6 px; shavings
//            (solid 1-px spirals) are flung along the spin, chips spark, grinding rings ripple, the card heats teal;
//            e_augerDrill (rotor 120 → 165 Hz, ends on the pierce frame) + e_augerCurls (metal pings 3.5 → 9 kHz)
//   T+1000   PIERCE (an equip's holder: its statChange plays here as the plain stat beat, −700): e_augerPierce (rotor surge + hard cut, burr rip, steel ting); the card flashes white for one
//            beat with the bore ALREADY punched and the lance tip in front, then steps to teal4 (70 ms freeze in
//            all), a floor shock ring, a big light, 2 px shake, card shards
//   T+1070   THE BORE (130 ms): a 6-px hole with a glowing lip, a helical FOUNTAIN of big curls out of it
//   T+1200   CRACK (100 ms): three cracks run out of the bore; the lance RETRACTS back up into the rift (240 ms,
//            e_augerRetract, streaks), the rift twists shut (140 ms)
//   T+1300   the dying top TOPPLES (270 ms): off its corner, back onto the tile face up (150 ms, its face always
//            showing), the SLAP (e_augerSlap) — then it spins out flat like a dropped coin into its rest pose
//            (e_augerSpin: a rattle whose tick rate rises); no edge-on frame, no re-raise; its pieces drift apart;
//            dust, a teal scorch spiral burns into the tile; a field spell: cracks run along the floor tiles from
//            the slap on (e_augerRift)
//   T+1570   the drilled card leaves IN PIECES (brokenLeaves: the proxy raster itself — bore, cracks, three
//            pieces — flies the card-continuity arc to the graveyard, e_augerShards; it never heals), then the
//            spent lance card; the rest of the resolution plays
//   Signature ≈ 1.6 s scene (storyboard 1.8 s) + the card flights.
//
// Pixel rules: the lance, the reticle, the shavings and the proxy card are whole-pixel rasters (Raster), palette
// only (night / steel / mist / white / teal / ink); the proxy card is rendered by the tiny 3-D card renderer of
// src/art/cards.ts (renderCard) — the same crisp nearest-neighbour look as TileCard. Seeded rng (fxRng) only.

import Phaser from 'phaser';
import type { GameEvent, PlayerId, Uid, ZoneRef } from '../../engine/types';
import type { CardId } from '../../data/cards';
import { PAL } from '../../art/palette';
import { FLAT_H, FLAT_W, ISO_CX, ISO_CY, ISO_TEX_H, ISO_TEX_W, STAND_H, STAND_W, cardIsoKey, cardMip, isoProject, poseAxes, qAxis, qFromBasis, qMul, qSlerp, renderCard, restQuat, standQuat, type Quat, type V3 } from '../../art/cards';
import type { TileCard } from '../../view/TileCard';
import { CardSprite } from '../../view/CardSprite';
import { BOARD_CENTER, DEPTH, LOOK_V3, type XY, zoneXY } from '../../view/layout';
import { shake, wait } from '../../vfx/core';
import { Sparks as PxSparks, stopTime } from '../../vfx/combat';
import { E, Raster, floorRing, onFrame, run, seg } from '../../vfx/setpieces';
import { flightMs, landingCount } from '../_v3/card';
import { V3HOOKS } from '../v3small/_hooks';
import { sfx } from '../../audio/sfx';
import { equipAnchor } from '../../duel/auras-v3';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import { panAt, play as playV3, start as startV3 } from '../_v3/sound';
import { fxRng } from '../_v3/spellfx';
import { fx, registerCardHook, type CinematicContext } from '../api';
import { evAt, idxOf, lightFlash, lightPool, relax, spellOpening, type Opening } from './_kit';
import { prime, quickFire, quickReveal, type QuickFire } from './_quick_e';

type AnyCtx = CinematicContext<GameEvent>;

// ---------------------------------------------------------------- timing (scene ms)

const ORB_MS = 170;
const DESCENT_MS = 300;
const LIFT_MS = 150;
const DRILL_MS = 480;
const HOLE_MS = 130;
const CRACK_MS = 100;
const RETRACT_MS = 240;
const COLLAPSE_MS = 270;
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
  /** Bore hole radius (px; 0 = none). */
  hole?: number;
  /** The hole's lip glows (white / teal4 inner ring) instead of a burnt one. */
  hot?: boolean;
  /** Cracks out of the hole, 0..1 of their reach. */
  crack?: number;
  /** The pieces between the cracks drift apart by this many px. */
  split?: number;
}

/** The card standing on its corner, turned θ round the vertical, with a small precession wobble. */
function cornerQ(theta: number, wobble: number): Quat {
  const tilt = qAxis([Math.cos(theta * 0.5), Math.sin(theta * 0.5), 0], wobble);
  return qMul(tilt, qMul(qAxis([0, 0, 1], theta), qMul(standQuat(), ROLL)));
}

/** Spin poses per revolution: the turning card is quantized to clear, distinct poses (no aliasing flicker). */
const SPIN_STEPS = 12;
/** The highest visible spin rate (rad/s): every sampled frame stays a readable pose. */
const SPIN_MAX = 20;

/**
 * The dying top TOPPLES: the card standing face-on on its corner (rolled `r` in its plane) settles onto its
 * bottom edge, tips BACK by `phi` (0 standing → π/2 flat, face up) and keeps turning `psi` round the vertical —
 * one continuous fall that always shows its face, ending exactly in the tile's rest pose (no edge-on frame).
 */
function toppleQ(r: number, phi: number, psi: number): { q: Quat; uz: number; vz: number } {
  const h: V3 = [Math.SQRT1_2, -Math.SQRT1_2, 0];
  const d: V3 = [Math.SQRT1_2 * Math.sin(phi), Math.SQRT1_2 * Math.sin(phi), -Math.cos(phi)];
  const u: V3 = [Math.cos(r) * h[0] + Math.sin(r) * d[0], Math.cos(r) * h[1] + Math.sin(r) * d[1], Math.sin(r) * d[2]];
  const v: V3 = [-Math.sin(r) * h[0] + Math.cos(r) * d[0], -Math.sin(r) * h[1] + Math.cos(r) * d[1], Math.cos(r) * d[2]];
  const c = Math.cos(psi);
  const s = Math.sin(psi);
  const yaw = (a: V3): V3 => [a[0] * c - a[1] * s, a[0] * s + a[1] * c, a[2]];
  return { q: qFromBasis(yaw(u), yaw(v)), uz: Math.abs(u[2]), vz: Math.abs(v[2]) };
}

/** The three cracks out of the bore (screen angles, rad): irregular so the pieces differ in size. */
const CRACKS = [-1.25, 0.85, 2.55] as const;

/** A whole-pixel proxy of the target card, rendered every frame by the 3-D card renderer. */
class TopCard {
  readonly ras: Raster;
  private readonly front;
  private readonly back;
  constructor(
    readonly scene: Phaser.Scene,
    public floor: XY,
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
    const pc = r.pc;
    const { ex, ey, n } = poseAxes(p.q, p.w, p.h);
    renderCard(pc, BC, BC, ex, ey, n, this.front, this.back, { light: p.light, tint: p.tint, tintAmt: p.tintAmt, solid: p.solid });
    const flat = Math.abs(n[2]) > 0.7;
    // the cracks: jagged ink lines from the bore out to the card's edge (a teal4 spark at each growing end)
    if (p.crack && p.crack > 0) {
      const reach = 40 * p.crack;
      for (let i = 0; i < CRACKS.length; i++) {
        const a = CRACKS[i];
        const ca = Math.cos(a);
        const sa = Math.sin(a) * (flat ? 0.55 : 1);
        let last: [number, number] | null = null;
        for (let d = (p.hole ?? 2) + 1; d <= reach; d += 1) {
          const j = Math.floor(d / 3) % 2 ? 1 : 0;
          const X = Math.round(BC + ca * d - sa * j);
          const Y = Math.round(BC + sa * d + ca * j);
          if (!pc.isOpaque(X, Y)) break;
          pc.set(X, Y, PAL.ink);
          last = [X, Y];
        }
        if (last && p.crack < 1) pc.set(last[0], last[1], PAL.teal4);
      }
    }
    // the bore through the card's centre: a punched-out ellipse; its lip glows (hot) or is burnt (ink / teal1)
    if (p.hole && p.hole > 0) {
      const rx = p.hole;
      const ry = Math.max(1, Math.round(p.hole * (flat ? 0.55 : 0.8)));
      for (let y = -ry - 2; y <= ry + 2; y++)
        for (let x = -rx - 2; x <= rx + 2; x++) {
          const d = (x * x) / (rx * rx) + (y * y) / (ry * ry);
          const X = BC + x;
          const Y = BC + y;
          if (!pc.isOpaque(X, Y)) continue;
          if (d <= 1) pc.erase(X, Y);
          else if (d <= 1.7) pc.set(X, Y, p.hot ? (y < 0 ? PAL.white : PAL.teal4) : y < 0 ? PAL.ink : PAL.teal1);
          else if (d <= 2.6 && p.hot) pc.set(X, Y, y < 0 ? PAL.teal3 : PAL.teal2);
        }
    }
    // the pieces drift apart along the cracks
    if (p.split && p.split > 0) {
      const src = pc.clone();
      pc.clear();
      const bounds = [...CRACKS].map((a) => ((a % TAU) + TAU) % TAU).sort((x, y) => x - y);
      for (let y = 0; y < BUF; y++)
        for (let x = 0; x < BUF; x++) {
          const c = src.get(x, y);
          if (c === null || !src.isOpaque(x, y)) continue;
          const ang = ((Math.atan2((y - BC) / (flat ? 0.55 : 1), x - BC) % TAU) + TAU) % TAU;
          let k = bounds.findIndex((b) => ang < b);
          if (k < 0) k = 0;
          const lo = bounds[(k + bounds.length - 1) % bounds.length];
          const hi = bounds[k];
          const mid = lo < hi ? (lo + hi) / 2 : (lo + hi + TAU) / 2;
          const X = Math.round(x + Math.cos(mid) * p.split);
          const Y = Math.round(y + Math.sin(mid) * p.split * (flat ? 0.55 : 1));
          pc.set(X, Y, c);
        }
    }
    r.end();
  }
  destroy(): void {
    this.ras.destroy();
  }
}

const TAU = Math.PI * 2;

// ---------------------------------------------------------------- the lance (pixel raster, drawn every frame)

/** Bit (tapering cutter), fluted shaft, collar (the rotor hub): rows. Above the collar a thin drive spindle runs
 *  up into the SKY RIFT (the lance has no free top end: it is cut by the rift's front lip). */
const L_BIT = 22;
const L_SHAFT = 48;
const L_COLLAR = 10;
/** Half widths: shaft (13 px), collar (17 px), the drive spindle (7 px). */
const L_HW = 6;
const L_CHW = 8;
const L_SHW = 3;
/** Raster width (the lance + the vortex helix + the rift + the vibration). */
const L_W = 64;
/** The flute's lead (rows per turn). */
const L_P = 9;
/** The sky rift's full half width (px; iso 2.6 : 1). */
const RIFT_RX = 17;

/** Body tones across the shaft (key light from the top left): lit, mid, shade (u in −1..1). */
function bodyTone(u: number): number {
  return u < -0.45 ? PAL.mist : u < 0.4 ? PAL.steel : PAL.night4;
}

/**
 * The SKY RIFT the lance screws out of: a turquoise spiral aperture (iso ellipse) high over the target. Drawn in
 * two halves round the lance — `back` (the dark inside with two turning spiral arms, the far rim), `front` (the
 * near rim, white glints running round it, a teal1 under-lip) — so the shaft reads as passing THROUGH it.
 * `open` 0..1 (its size), `spin` (rad).
 */
function drawRift(g: Raster, x: number, y: number, open: number, spin: number, front: boolean): void {
  const rx = Math.round(RIFT_RX * open);
  if (rx < 2) {
    if (open > 0 && !front) g.px(x, y, PAL.white);
    return;
  }
  const ry = Math.max(1, Math.round(rx * 0.38));
  if (!front) {
    // the inside: night1, two spiral arms (teal1 → teal2) turning into its centre
    for (let yy = -ry + 1; yy <= ry - 1; yy++)
      for (let xx = -rx + 1; xx <= rx - 1; xx++) if ((xx * xx) / ((rx - 1) * (rx - 1)) + (yy * yy) / (ry * ry) < 1) g.px(x + xx, y + yy, PAL.night1);
    for (let s = 0; s < 2; s++)
      for (let j = 2; j < 26; j++) {
        const a = spin + s * Math.PI + j * 0.32;
        const r = (j / 26) * (rx - 2);
        g.px(Math.round(x + Math.cos(a) * r), Math.round(y + Math.sin(a) * r * 0.38), j < 9 ? PAL.teal3 : j < 18 ? PAL.teal2 : PAL.teal1);
      }
  }
  // the rim: the far half teal2 / teal3, the near half teal4 with two white glints chasing round it
  const n = Math.round(rx * 7);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const sn = Math.sin(a);
    if (sn >= 0 !== front) continue;
    const X = Math.round(x + Math.cos(a) * rx);
    const Y = Math.round(y + sn * ry);
    const gl = (((a - spin * 1.4) % Math.PI) + Math.PI) % Math.PI;
    const c = front ? (gl < 0.35 ? PAL.white : PAL.teal4) : sn < -0.6 ? PAL.teal2 : PAL.teal3;
    g.px(X, Y, c);
    if (front) g.px(X, Y + 1, gl < 0.35 ? PAL.teal3 : PAL.teal1);
  }
  // the ink edge: outside the far rim (it reads against the arena's dark wall and the bright portrait alike)
  if (!front)
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      if (Math.sin(a) >= 0) continue;
      g.px(Math.round(x + Math.cos(a) * (rx + 1)), Math.round(y + Math.sin(a) * (ry + 1)), PAL.ink);
    }
}

/**
 * Draw the auger lance with its tip at (x, tipY), running up into the sky rift at `riftY`: a tapering spiral
 * bit, a shaft with a DEEP two-tone helical flute (the groove follows the cylinder: y-offset ∝ asin(u), a dark
 * groove of 3 rows with its own shade, a white / mist lit lip above it), a wide dark rotor collar with a teal
 * band, then a thin drive spindle up to the rift (rows above the rift's centre are never drawn — the rift's
 * near lip cuts the steel cleanly). The flute scrolls with `phase` (it turns). `vortex` (0..1) wraps a teal
 * helix cone round the bit (drilling); `orbit` (rad) turns it; `smear` (0..1) its descent speed streaks.
 */
function drawLance(g: Raster, x: number, tipY: number, riftY: number, phase: number, orbit: number, o: { vortex?: number; hot?: number; arcs?: boolean; smear?: number; rift?: number; riftSpin?: number; riftX?: number } = {}): void {
  const top = riftY;
  const rx0 = o.riftX ?? x;
  const rowHW = (d: number): number => {
    if (d < L_BIT) return Math.min(L_HW + 1, Math.floor(((d + 1) * (L_HW + 1.6)) / L_BIT));
    if (d < L_BIT + L_SHAFT) return L_HW;
    if (d < L_BIT + L_SHAFT + 2) return L_CHW;
    if (d < L_BIT + L_SHAFT + 7) return L_CHW - 1;
    if (d < L_BIT + L_SHAFT + L_COLLAR) return L_HW - 1;
    return L_SHW;
  };
  const vortex = o.vortex ?? 0;
  const rift = o.rift ?? 0;
  if (rift > 0) drawRift(g, rx0, riftY, rift, o.riftSpin ?? 0, false);
  // the back half of the vortex helix first (behind the lance)
  if (vortex > 0) vortexHelix(g, x, tipY, orbit, vortex, false);
  if (tipY >= top) {
    // descent smear: two pairs of streaks beside the shaft and a ghost of the bit's flanks above it (teal2 / teal1)
    const sm = o.smear ?? 0;
    if (sm > 0.05) {
      const len = Math.round(26 * sm);
      for (const [dx, c, off] of [
        [-(L_HW + 3), PAL.mist, 4],
        [L_HW + 3, PAL.teal3, 9],
        [-(L_HW + 6), PAL.teal2, 14],
        [L_HW + 6, PAL.teal1, 18],
      ] as const) {
        const y0 = Math.max(top, tipY - off - len);
        const y1 = tipY - off;
        if (y1 > y0) g.rect(x + dx, y0, 1, y1 - y0, c);
      }
      for (const [gy, c] of [
        [6, PAL.teal2],
        [12, PAL.teal1],
      ] as const)
        for (let d = 0; d < L_BIT; d += 1) {
          const y = tipY - gy - d;
          if (y < top) break;
          const hw = rowHW(d);
          g.px(x - hw - 2, y, c);
          g.px(x + hw + 2, y, c);
        }
    }
    // ink outline (1 px round the body and under the tip)
    for (let y = top; y <= tipY; y++) {
      const hw = rowHW(tipY - y);
      g.px(x - hw - 1, y, PAL.ink);
      g.px(x + hw + 1, y, PAL.ink);
      const hwUp = rowHW(tipY - y + 1);
      // horizontal ink where the width steps (collar shoulders, the spindle's foot, the bit's steps)
      if (y - 1 >= top) {
        for (let c = hwUp + 1; c <= hw + 1; c++) {
          g.px(x - c, y - 1, PAL.ink);
          g.px(x + c, y - 1, PAL.ink);
        }
        for (let c = hw + 1; c <= hwUp + 1; c++) {
          g.px(x - c, y, PAL.ink);
          g.px(x + c, y, PAL.ink);
        }
      }
    }
    g.px(x - 1, tipY + 1, PAL.ink);
    g.px(x + 1, tipY + 1, PAL.ink);
    g.px(x, tipY + 2, PAL.ink);
    for (let y = top; y <= tipY; y++) {
      const d = tipY - y;
      const hw = rowHW(d);
      const collar = d >= L_BIT + L_SHAFT && d < L_BIT + L_SHAFT + L_COLLAR;
      const spindle = d >= L_BIT + L_SHAFT + L_COLLAR;
      for (let c = -hw; c <= hw; c++) {
        const u = c / (hw + 0.5);
        let col = bodyTone(u);
        if (spindle) {
          // the drive spindle: dark steel, one teal thread spiralling up it (the energy fed down from the rift)
          col = u < -0.5 ? PAL.steel : u < 0.5 ? PAL.night4 : PAL.night3;
          const k = (((Math.floor(y + c - phase * 0.7) % 6) + 6) % 6) as number;
          if (k === 0) col = c <= 0 ? PAL.teal4 : PAL.teal2;
        } else if (collar) {
          // the collar: dark steel with a glowing teal band (the spell's energy driving the rotor)
          const cd = d - L_BIT - L_SHAFT;
          if (cd === 3 || cd === 4) col = (Math.floor(phase / 3) + (c > 0 ? 1 : 0)) % 2 ? PAL.teal4 : PAL.teal3;
          else if (cd === 2 || cd === 5) col = PAL.teal1;
          else col = cd >= 8 ? PAL.night3 : u < -0.4 ? PAL.steel : u < 0.3 ? PAL.night4 : PAL.night3;
        } else {
          // the flute: a helix on the cylinder (the groove bends with asin(u)), scrolling as the lance turns
          const off = (L_P * Math.asin(Math.max(-1, Math.min(1, u)))) / Math.PI;
          const k = (((Math.floor(y - off - phase) % L_P) + L_P) % L_P) as number;
          if (k <= 2) col = k === 0 ? PAL.night1 : u < -0.3 ? PAL.night3 : PAL.night2;
          else if (k === 3) col = u < -0.15 ? PAL.white : u < 0.45 ? PAL.mist : PAL.steel;
          // the bit's cutting edge heats teal near the tip while drilling
          if (o.hot && d < 6 && k > 2) col = o.hot > 0.5 ? (d < 3 ? PAL.white : PAL.teal4) : col;
        }
        g.px(x + c, y, col);
      }
    }
    g.px(x, tipY, PAL.white);
  }
  if (vortex > 0) vortexHelix(g, x, tipY, orbit, vortex, true);
  if (o.arcs && tipY > top + 12) {
    // two teal motion arcs orbiting the bit while it falls (front bright, back hidden by the shaft)
    for (let i = 0; i < 2; i++) {
      const a = orbit + i * Math.PI;
      const ay = tipY - 10 - i * 11;
      if (ay < top + 2) continue;
      for (let s = 0; s < 5; s++) {
        const aa = a - s * 0.3;
        const px = Math.round(x + Math.cos(aa) * 11);
        const py = Math.round(ay + Math.sin(aa) * 3);
        const front = Math.sin(aa) > 0;
        if (!front && Math.abs(px - x) <= L_HW + 1) continue;
        g.px(px, py, s === 0 ? (front ? PAL.white : PAL.teal3) : front ? PAL.teal4 : PAL.teal2);
      }
    }
  }
  if (rift > 0) drawRift(g, rx0, riftY, rift, o.riftSpin ?? 0, true);
}

/** The teal vortex cone wrapping the bit while it drills: two strands, ~2 turns over 30 rows, widening upwards. */
function vortexHelix(g: Raster, x: number, tipY: number, orbit: number, k: number, front: boolean): void {
  const H = Math.round(30 * Math.min(1, k * 1.6));
  for (let s = 0; s < 2; s++) {
    let lx = NaN;
    let ly = NaN;
    for (let h = 2; h <= H; h += 0.5) {
      const a = orbit + s * Math.PI - h * 0.42;
      const r = 8 + h * 0.42;
      const sn = Math.sin(a);
      if (sn > 0 !== front) {
        lx = NaN;
        continue;
      }
      const px = Math.round(x + Math.cos(a) * r);
      const py = Math.round(tipY - h + sn * r * 0.32);
      if (!front && Math.abs(px - x) <= L_HW + 1) continue;
      if (px === lx && py === ly) continue;
      lx = px;
      ly = py;
      const fade = h > H * 0.7;
      g.px(px, py, front ? (h < 8 ? PAL.white : fade ? PAL.teal3 : PAL.teal4) : fade ? PAL.teal1 : PAL.teal2);
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
        c.vy += 900 * s;
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
        // an Archimedean spiral drawn as ONE solid 1-px stroke (4-connected steps, no dotted ring): white at its
        // curled-in end, mist / teal4 in the middle, steel / teal2 at its tail; `size` = its outer radius
        const n = Math.max(6, Math.round(c.size * 3.2));
        const turn = Math.min(0.6, 7.2 / n);
        let lx = NaN;
        let ly = NaN;
        const fadeTail = c.age > c.life * 0.75;
        for (let j = 0; j <= n; j++) {
          if (fadeTail && j > n * 0.5) break;
          const ang = c.rot + j * turn;
          const rr = 0.4 + (j * c.size) / n;
          const px = Math.round(c.x + Math.cos(ang) * rr);
          const py = Math.round(c.y + Math.sin(ang) * rr * 0.8);
          if (px === lx && py === ly) continue;
          const k = j / n;
          const col = k < 0.2 ? PAL.white : c.teal ? (k < 0.6 ? PAL.teal4 : PAL.teal2) : k < 0.6 ? PAL.mist : PAL.steel;
          // a diagonal step gets its corner pixel (a solid stroke, never a checker)
          if (!Number.isNaN(lx) && Math.abs(px - lx) === 1 && Math.abs(py - ly) === 1) g.px(px, ly, col);
          else if (!Number.isNaN(lx) && (Math.abs(px - lx) > 1 || Math.abs(py - ly) > 1)) g.line(lx, ly, px, py, col);
          g.px(px, py, col);
          lx = px;
          ly = py;
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
function floorShadow(sc: Phaser.Scene, at0: XY): { set(k: number, dx?: number, dy?: number): void; destroy(): void } {
  const ras = Raster.around(sc, at0.x, at0.y, 44, 18, DEPTH.SHADOW - 2);
  return {
    set(k: number, dx = 0, dy = 0) {
      const at = { x: at0.x + dx, y: at0.y + dy };
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

// ---------------------------------------------------------------- the caster (what the lance's orb leaves)

/**
 * The card that casts the lance: the common v3 opening's card (hand / own set card) or the quick answer's card
 * standing on its tile (quickFire) — the signature only needs where the orb leaves it, the launch, and the
 * card's way out.
 */
interface Caster {
  /** Where the orb leaves the card (its top edge). */
  from: XY;
  /** The orb leaves now (the opening's clean-up). */
  launch(to: XY): void;
  /** The spent card goes to the graveyard (consumes toGraveyard `gi`). */
  leave(gi: number): Promise<void>;
  /** Nothing to resolve: the card goes. */
  close(): Promise<void>;
  /** The lance appears: the caster steps back (the quick card lies down, dimmed) so the eye goes to the target. */
  bite?(): void;
}

/** The common v3 opening as a Caster (its own little orb runs hidden under the auger's). */
function openingCaster(op: Opening): Caster {
  const standing = !(op.card instanceof CardSprite);
  const from = { x: Math.round(op.center.x), y: Math.round(op.center.y - (standing ? 22 : 34) - 2) };
  return {
    from,
    launch(to) {
      bg(op.release(to, { path: 'line', ms: ORB_MS, size: 1, light: false }));
    },
    leave: (gi) => (op.leave ? op.leave(gi) : Promise.resolve()),
    close: () => op.close(),
  };
}

/** The quick answer's fired card as a Caster. */
function quickCaster(q: QuickFire): Caster {
  return { from: q.top, launch: () => undefined, leave: (gi) => q.leave(gi), close: () => q.close(), bite: () => q.settle() };
}

/**
 * The orb flies from the caster to the sky over the target (straight, accelerating): a 7-px teal orb with a
 * white core, two teal pixels orbiting its path (a short spiral trail — the auger's twist), its own light.
 */
function augerOrb(sc: Phaser.Scene, from: XY, to: XY, ms: number, floorY: number, depth: number): Promise<void> {
  const ras = Raster.around(sc, (from.x + to.x) / 2, (from.y + to.y) / 2, Math.abs(to.x - from.x) + 40, Math.abs(to.y - from.y) + 40, depth);
  const light = lightPool(sc, from.x, from.y, { color: PAL.teal3, radius: 18, floorY: Math.max(floorY, from.y), intensity: 0.52, fadeIn: 0 });
  const trail: { x: number; y: number; c: number; age: number }[] = [];
  let last = -1;
  return run(sc, ms, (t, el) => {
    const k = E.inQuad(t) * 0.65 + t * 0.35;
    const x = Math.round(from.x + (to.x - from.x) * k);
    const y = Math.round(from.y + (to.y - from.y) * k);
    light.setPosition(x, y, Math.max(y, floorY));
    // the twin spiral: two pixels orbiting the path (perpendicular to it), leaving a 1-px trail that steps down
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const L = Math.max(1, Math.hypot(dx, dy));
    const nx = -dy / L;
    const ny = dx / L;
    const step = Math.floor(el / 16);
    if (step !== last) {
      last = step;
      for (let i = 0; i < 2; i++) {
        const a = el * 0.05 + i * Math.PI;
        trail.push({ x: Math.round(x + nx * Math.cos(a) * 5), y: Math.round(y + ny * Math.cos(a) * 5), c: Math.sin(a) > 0 ? PAL.teal4 : PAL.teal2, age: 0 });
      }
    }
    for (const p of trail) p.age += 1;
    ras.draw((g) => {
      for (const p of trail) {
        if (p.age > 9) continue;
        g.px(p.x, p.y, p.age < 3 ? p.c : p.age < 6 ? PAL.teal2 : PAL.teal1);
      }
      g.rect(x - 1, y - 6, 3, 4, PAL.teal2);
      g.disc(x, y, 3, Math.floor(el / 40) % 2 ? PAL.teal3 : PAL.teal2);
      g.disc(x, y, 2, PAL.teal4);
      g.rect(x - 1, y - 1, 2, 2, PAL.white);
    });
  }).then(() => {
    ras.destroy();
    void light.fadeOut(80);
  });
}

// ---------------------------------------------------------------- the signature

interface SigArgs {
  /** The card casting it (the common opening, or the quick answer's fired card). */
  cast: Caster;
  /** The target card. */
  ref: ZoneRef;
  /** This auger lance's uid. */
  uid: Uid;
  /** Indices of the resolution events still to play (the target event itself excluded). */
  run: number[];
}

/** A ground-level teal SCORCH SPIRAL burnt into the tile under the drilled card: it cools in steps, then goes. */
function scorchSpiral(sc: Phaser.Scene, at: XY, depth: number): void {
  const ras = Raster.around(sc, at.x, at.y, 64, 34, depth);
  const ramp = [PAL.white, PAL.teal4, PAL.teal3, PAL.teal2, PAL.teal1];
  void run(sc, 760, (t) => {
    ras.draw((g) => {
      const grow = Math.min(1, t * 6);
      const cool = Math.floor(seg(t, 0.1, 1) * ramp.length);
      if (cool >= ramp.length) return;
      for (let s = 0; s < 2; s++) {
        let lx = NaN;
        let ly = NaN;
        const N = Math.round(90 * grow);
        for (let j = 0; j <= N; j++) {
          const a = s * Math.PI + j * 0.13;
          const r = 3 + j * 0.25;
          const x = Math.round(at.x + Math.cos(a) * r);
          const y = Math.round(at.y + Math.sin(a) * r * 0.5);
          if (x === lx && y === ly) continue;
          const c = ramp[Math.min(ramp.length - 1, cool + (j > 60 ? 1 : 0))];
          if (!Number.isNaN(lx) && Math.abs(x - lx) === 1 && Math.abs(y - ly) === 1) g.px(x, ly, c);
          g.px(x, y, c);
          lx = x;
          ly = y;
        }
      }
    });
  }).then(() => ras.destroy());
}

/**
 * Field spell drilled: the arena feels it — three teal cracks run from the field slot along the floor tiles'
 * seams (iso 2:1 steps, jagged), their light snaps on and off; e_augerRift. ≈ 260 ms scene.
 */
async function fieldRift(sc: Phaser.Scene, from: XY, pan: number): Promise<void> {
  playV3('e_augerRift', { volume: 0.9, pan });
  const toward = { x: BOARD_CENTER.x - from.x, y: BOARD_CENTER.y - from.y };
  const base = Math.atan2(toward.y, toward.x);
  const rnd = fxRng(911);
  const paths: XY[][] = [-0.5, 0, 0.5].map((da) => {
    const pts: XY[] = [{ x: from.x, y: from.y }];
    let x = from.x;
    let y = from.y;
    const dir = base + da;
    for (let i = 0; i < 70; i++) {
      // a tile seam step: 2 px across, 1 px down (iso), toward `dir`, with a jag now and then
      const sx = Math.cos(dir) >= 0 ? 1 : -1;
      const sy = Math.sin(dir) >= 0 ? 1 : -1;
      const steep = Math.abs(Math.sin(dir)) > Math.abs(Math.cos(dir)) * 0.5;
      if (i % 2 === 0 || !steep) x += sx;
      if (i % 2 === 1 || (steep && rnd() < 0.3)) y += sy;
      if (rnd() < 0.08) x -= sx;
      pts.push({ x, y });
    }
    return pts;
  });
  const ras = Raster.around(sc, from.x, from.y, 200, 140, DEPTH.SHADOW - 1);
  const glow = lightPool(sc, from.x, from.y, { color: PAL.teal3, radius: 40, floorY: from.y, intensity: 1.1, fadeIn: 0 });
  await run(sc, 300, (t) => {
    const n = Math.round(70 * E.outCubic(seg(t, 0, 0.45)));
    const cool = Math.floor(seg(t, 0.45, 1) * 4);
    glow.setPosition(Math.round(from.x + toward.x * 0.3 * seg(t, 0, 0.45)), Math.round(from.y + toward.y * 0.3 * seg(t, 0, 0.45)), from.y);
    ras.draw((g) => {
      if (cool >= 4) return;
      for (const pts of paths)
        for (let i = 0; i < Math.min(n, pts.length); i++) {
          const head = i > n - 4;
          g.px(pts[i].x, pts[i].y, head && t < 0.45 ? PAL.white : [PAL.teal4, PAL.teal3, PAL.teal2, PAL.teal1][cool]);
          if (cool < 2 && i % 2 === 0) g.px(pts[i].x, pts[i].y + 1, PAL.teal1);
        }
    });
  });
  void glow.fadeOut(120);
  ras.destroy();
}

async function signature(ctx: AnyCtx, s: SigArgs): Promise<void> {
  const sc = ctx.scene;
  const field = ctx.views.field;
  const { cast, ref } = s;
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
    await cast.close();
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
  const sky: XY = { x: floor.x, y: Math.max(36, floor.y - 140) };
  // (the camera never moves in lane E scenes)
  // an EQUIP drilled: its holder's ATK drops. The equip's own death (Ejder Kılıcı's sword rising and breaking)
  // never plays on top of the drill — this card IS its death: the holder's bond snaps in teal at the lock (the
  // small aura sword fizzles out, so it never floats in front of the spinning card), and its statChange plays
  // on the PIERCE frame as the plain stat beat (the −700 roll), nothing else.
  const slot = ref.zone === 'spellTrap' ? ctx.state.players[ref.player].spellTraps[ref.index] : null;
  const holderUid = slot && slot.uid === dEv!.uid ? (slot.equippedTo ?? null) : null;
  const ci = holderUid !== null ? idxOf(ctx, s.run, (e) => e.type === 'statChange' && e.uid === holderUid) : -1;
  const holder = holderUid !== null ? ctx.unit(holderUid) : null;

  // ---- T+0: release + lock
  const lock = lockReticle(sc, floor);
  if (tile && tile.active) tile.tileFlash(PAL.teal3, 260);
  void wait(sc, 40).then(() => playV3('e_augerLock', { volume: 0.8, pan }));
  cast.launch(sky);
  if (holder && !holder.retired && holder.hasAura('equip')) snapBond(sc, holder);
  await augerOrb(sc, cast.from, sky, ORB_MS, floor.y, DEPTH.FX_TOP + 13);

  // ---- T+170: the lance pokes out of the orb's star and screws down
  // the orb bursts into the SKY RIFT: a turquoise spiral aperture spins open (110 ms) and the lance screws out of it
  star(sc, sky, 7, 180, uDepth + 2);
  void lightFlash(sc, sky.x, sky.y, PAL.teal4, 16, 220, { floorY: floor.y, air: 0.8, intensity: 0.34 });
  const riftLight = lightPool(sc, sky.x, sky.y, { color: PAL.teal3, radius: 18, floorY: floor.y, intensity: 0.42, anim: 'flicker', fadeIn: 90 });
  playV3('e_augerDescend', { volume: 0.95, pan });
  // the caster has done its part: the quick card settles back down (dimmed) as the lance takes the stage
  cast.bite?.();
  const riftY = sky.y;
  const lance = new Raster(sc, floor.x - L_W / 2, riftY - 12, L_W, floor.y - riftY + 20, uDepth + 1);
  let rift = 0;
  let riftOpen = 1;
  let riftSpin = 0;
  let smear = 0;
  const riftLoop = onFrame(sc, (dt) => {
    if (!lance.alive) return false;
    riftSpin += dt * 0.011;
    rift = riftOpen > rift ? Math.min(riftOpen, rift + dt / 110) : Math.max(riftOpen, rift - dt / 140);
    return true;
  });
  const shadow = floorShadow(sc, floor);
  const top = new TopCard(sc, floor, victimId, owner, uDepth + 0.5);
  const flatPose: TopPose = { q: restQuat(owner, 'up', faceUp), w: FLAT_W, h: FLAT_H, z: 0 };
  const theta0 = faceUp ? 0 : Math.PI;
  const contactY = Math.round(floor.y + isoProject([0, 0, TOP_ZC * 2])[1]);
  const startTip = riftY;
  let tipY = startTip;
  let phase = 0;
  let orbit = 0;
  let hot = 0;
  let vortex = 0;
  let jit = 0;
  let lanceOn = true;
  const drawL = () => {
    if (!lanceOn) return;
    lance.draw((g) => drawLance(g, floor.x + jit, Math.round(tipY), riftY, Math.floor(phase), orbit, { arcs: vortex === 0, hot, vortex, smear, rift, riftSpin, riftX: floor.x }));
  };
  // the card's spin state
  let theta = theta0;
  let wob = 0;
  let spinV = 0;
  let tint = 0;
  // the drawn angle: quantized to SPIN_STEPS clear poses per turn once it spins fast (no aliasing flicker)
  const thetaDrawn = (): number => (spinV > 8 ? Math.round(theta / (TAU / SPIN_STEPS)) * (TAU / SPIN_STEPS) : theta);
  const cornerPose = (): TopPose => {
    const th = thetaDrawn();
    return { q: cornerQ(th, wob), w: TOP_W, h: TOP_H, z: TOP_ZC, light: 0.22 * Math.cos(th * 2), tint: PAL.teal4, tintAmt: tint };
  };
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
    phase += s2 * (liftK >= 1 ? 80 : 45);
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
    // the speed smear: it grows with the fall's speed, gone on the last frames before the bite
    smear = t < 0.9 ? Math.min(1, 0.2 + 1.5 * t) : 0.4;
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
  smear = 0;
  top.draw(cornerPose());
  drawL();

  // ---- T+470: BITE
  playV3('e_augerBite', { volume: 1, pan });
  star(sc, { x: floor.x, y: contactY }, 7, 150, uDepth + 2);
  void lightFlash(sc, floor.x, contactY, PAL.white, 20, 200, { floorY: floor.y, air: 0.7, intensity: 0.8 });
  void shake(sc, 100, 1);
  void lock.stop(200);
  await stopTime(sc, BITE_STOP);
  const drill = startV3('e_augerDrill', { volume: 0.85, pan });
  playV3('e_augerCurls', { volume: 1, pan });
  const floorLight = lightPool(sc, floor.x, floor.y, { color: PAL.teal3, radius: 30, floorY: floor.y, intensity: 0.9, anim: 'flicker', fadeIn: 0 });
  const curls = new Curls(sc, { x: floor.x, y: contactY }, uDepth + 1.5);
  const chips = new PxSparks(sc, uDepth + 1.6);
  const rings = new Raster(sc, floor.x - 30, contactY - 10, 60, 30, uDepth + 1.4);
  // the top's spin trail: its two side corners leave short 1-px arcs (teal3 → teal1) behind them as it turns
  const cardCY = Math.round(floor.y + isoProject([0, 0, TOP_ZC])[1]);
  const trail = Raster.around(sc, floor.x, cardCY, 96, 80, uDepth + 0.45);
  const cornerAt = (th: number, i: number): XY => {
    const { ex, ey } = poseAxes(cornerQ(th, wob), TOP_W, TOP_H);
    const sx = i === 0 || i === 3 ? -0.5 : 0.5;
    const sy = i < 2 ? -0.5 : 0.5;
    return { x: floor.x + ex[0] * sx + ey[0] * sy, y: cardCY + ex[1] * sx + ey[1] * sy };
  };
  let curlAcc = 0;
  let chipAcc = 0;
  const dir = s.uid % 2 ? 1 : -1;
  await run(sc, DRILL_MS, (t, el, dt) => {
    spinV = 6 + (SPIN_MAX - 6) * E.inQuad(t);
    wob = 0.09 * Math.sin(t * 9) * (1 - t * 0.4);
    tint = 0.34 * E.inQuad(t);
    hot = t;
    vortex = E.outCubic(Math.min(1, t * 2.5));
    // the lance shudders 1 px side to side as it bites (every 2 frames), harder at the end
    jit = Math.floor(el / (t < 0.5 ? 45 : 30)) % 2 ? 1 : 0;
    tipY = contactY + Math.round(6 * E.outCubic(t));
    // the top precesses: its shadow circles a pixel or two under it
    shadow.set(1, Math.round(2 * Math.cos(el * 0.018)), Math.round(Math.sin(el * 0.018)));
    trail.draw((g) => {
      if (t < 0.12) return;
      const th0 = thetaDrawn();
      // the two corners furthest out to the sides right now
      const cs = [0, 1, 2, 3].map((i) => ({ i, p: cornerAt(th0, i) })).sort((a, b) => a.p.x - b.p.x);
      for (const { i } of [cs[0], cs[3]]) {
        let prev = cornerAt(th0, i);
        for (let k = 1; k <= 4; k++) {
          const p = cornerAt(th0 - k * 0.2, i);
          g.line(Math.round(prev.x), Math.round(prev.y), Math.round(p.x), Math.round(p.y), k === 1 ? PAL.teal3 : k < 4 ? PAL.teal2 : PAL.teal1);
          prev = p;
        }
      }
    });
    curlAcc += dt;
    chipAcc += dt;
    // shavings flung along the spin (one side faster: the turning direction), denser and bigger as it bites
    const every = 64 - 34 * t;
    while (curlAcc >= every) {
      curlAcc -= every;
      const side = rnd() < 0.68 ? dir : -dir;
      curls.add({
        x: floor.x + side * 4,
        y: Math.round(tipY) + 2,
        vx: side * (55 + rnd() * 85),
        vy: -(70 + rnd() * 90),
        rot: rnd() * 6.28,
        vr: side * (8 + rnd() * 10),
        size: 2 + Math.floor(rnd() * 2 + t * 2),
        life: 520 + rnd() * 300,
        teal: rnd() < 0.3,
        floor: floor.y + Math.round((rnd() - 0.3) * 10),
      });
    }
    if (chipAcc >= 34) {
      chipAcc = 0;
      const a = rnd() * Math.PI * 2;
      chips.add({ x: floor.x, y: Math.round(tipY) + 1, vx: Math.cos(a) * 80, vy: Math.sin(a) * 45 - 30, drag: 3, life: 140 + rnd() * 100, colors: [PAL.white, PAL.teal4, PAL.teal3], shape: 'px', fadeAt: 1 });
    }
    // grinding rings ripple out of the contact point (every 90 ms a flat teal ellipse widening)
    rings.draw((g) => {
      for (let k = 0; k < 3; k++) {
        const ph = ((el + k * 90) % 270) / 270;
        const rx = Math.round(4 + ph * 22);
        g.ring(floor.x, Math.round(tipY) + 1, rx, Math.max(1, Math.round(rx * 0.3)), ph < 0.4 ? PAL.teal4 : ph < 0.75 ? PAL.teal3 : PAL.teal1, 1);
      }
    });
  });
  rings.destroy();
  trail.destroy();

  // ---- T+1000: PIERCE — a freeze on the white card, a floor shock ring, the lance punched through
  drill.stop(20);
  playV3('e_augerPierce', { volume: 1, pan });
  spinning = false;
  spinLoop();
  // the card snaps face-on under the flash (the drilled face reads), the bore opens in it
  theta = Math.round(theta / TAU) * TAU;
  wob = 0;
  tint = 0;
  jit = 0;
  vortex = 0;
  tipY = contactY + 18;
  hot = 1;
  drawL();
  // the flash frame already shows the punched bore (the lance's tip in front of it): white for one beat only
  top.draw({ ...cornerPose(), tint: PAL.white, tintAmt: 0.85, hole: 5, hot: true });
  void floorRing(sc, floor.x, floor.y, { r0: 8, r1: 64, ms: 380, ramp: [PAL.white, PAL.teal4, PAL.teal3, PAL.teal2, PAL.teal1], depth: DEPTH.SHADOW - 1, width: 2 });
  void lightFlash(sc, floor.x, floor.y - 20, PAL.teal4, 40, 360, { floorY: floor.y, ring: true, intensity: 1.1, air: 0.6 });
  void floorLight.fadeOut(260);
  void shake(sc, 200, 2);
  // the equip's holder loses its bonus NOW (the plain stat beat: crim edge, "−700", the badge rolls)
  const statJob: Promise<void> = ci >= 0 ? ctx.play(ci, {}).catch((e) => console.error('[auger_lance] stat', e)) : Promise.resolve();
  const holeAt = { x: floor.x, y: Math.round(floor.y + isoProject([0, 0, TOP_ZC])[1]) };
  const shardSp = new PxSparks(sc, uDepth + 1.6);
  for (let i = 0; i < 22; i++) {
    const a = rnd() * Math.PI * 2;
    const v = 70 + rnd() * 120;
    shardSp.add({ x: holeAt.x, y: holeAt.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6 - 30, ay: 260, drag: 1.5, life: 300 + rnd() * 260, colors: [PAL.white, PAL.teal4, PAL.night4, PAL.night3], shape: i % 4 === 0 ? 'plus' : 'px', floor: floor.y + 4, bounce: 0.3, fadeAt: 0.8 });
  }
  shardSp.release();
  chips.release();
  await stopTime(sc, PIERCE_STOP / 2);
  // …then it steps down to teal4: the face, the bore and its glowing lip read while time is still held
  top.draw({ ...cornerPose(), tint: PAL.teal4, tintAmt: 0.5, hole: 5, hot: true });
  await stopTime(sc, PIERCE_STOP / 2);

  // ---- T+1070: THE BORE — a 6-px hole with a glowing lip held; a helical FOUNTAIN of big curls out of it
  let hole = 4;
  let fountain = 0;
  await run(sc, HOLE_MS, (t, el) => {
    hole = t < 0.25 ? 5 : 6;
    phase += 2;
    drawL();
    top.draw({ ...cornerPose(), hole, hot: true, tint: PAL.teal4, tintAmt: 0.25 * (1 - t) });
    // the fountain: one curl every 9 ms on a rising helix round the bore
    const want = Math.floor(el / 9);
    while (fountain < want && fountain < 16) {
      const a = fountain * 0.95;
      const side = Math.cos(a) >= 0 ? 1 : -1;
      curls.add({
        x: holeAt.x + Math.round(Math.cos(a) * 5),
        y: holeAt.y + Math.round(Math.sin(a) * 2),
        vx: Math.cos(a) * (60 + rnd() * 50),
        vy: -(190 + rnd() * 80) + fountain * 4,
        rot: a,
        vr: side * 14,
        size: 4 + (fountain % 3 === 0 ? 1 : 0),
        life: 620 + rnd() * 200,
        teal: fountain % 3 === 1,
        floor: floor.y + Math.round((rnd() - 0.3) * 12),
      });
      fountain++;
    }
  });
  curls.destroyWhenDone();

  // ---- T+1200: CRACK — three cracks run out of the bore; the lance pulls back up (RETRACT)
  playV3('e_augerRetract', { volume: 0.9, pan });
  shadow.destroy();
  const tip1 = tipY;
  const retract = run(sc, RETRACT_MS, (t) => {
    // back up INTO the rift (its last 15 % the rift starts to close round the spindle)
    tipY = tip1 + (riftY - 3 - tip1) * E.inQuad(t);
    if (t > 0.85) riftOpen = 0;
    phase += 3;
    lance.draw((g) => {
      drawLance(g, floor.x, Math.round(tipY), riftY, Math.floor(phase), orbit, { hot: 1 - t, rift, riftSpin, riftX: floor.x });
      // speed streaks under the leaving lance
      const len = Math.min(Math.round(34 * Math.min(1, t * 3)), floor.y - Math.round(tipY) - 4);
      if (len > 0 && tipY > riftY) {
        g.rect(floor.x - 8, Math.round(tipY) + 2, 1, len, PAL.teal2);
        g.rect(floor.x + 8, Math.round(tipY) + 6, 1, Math.round(len * 0.7), PAL.teal3);
        g.rect(floor.x - 3, Math.round(tipY) + 4, 1, Math.round(len * 0.5), PAL.teal4);
        g.rect(floor.x, Math.round(tipY) + 3, 1, Math.round(len * 0.4), PAL.white);
      }
    });
  }).then(async () => {
    lanceOn = false;
    // the rift twists shut (the last of its spiral), its light goes
    riftOpen = 0;
    void riftLight.fadeOut(140);
    await run(sc, 140, () =>
      lance.draw((g) => {
        drawRift(g, floor.x, riftY, rift, riftSpin, false);
        drawRift(g, floor.x, riftY, rift, riftSpin, true);
      }),
    );
    riftLoop();
    lance.destroy();
  });
  await run(sc, CRACK_MS, (t) => top.draw({ ...cornerPose(), hole: 6, hot: t < 0.5, crack: E.outCubic(t) }));

  // ---- T+1300: the dying top TOPPLES: it settles off its corner onto its edge and tips back FLAT, FACE UP (the
  // first 55 %, barely turning, so its face always shows — no edge-on frame), SLAPS onto the tile, then spins
  // out flat like a dropped coin into the tile's rest pose (P2: the longer way round), the pieces drifting apart
  // along the cracks. No re-raise: the leaving card is born from this very pose.
  const endQ = restQuat(owner, 'up', true);
  const psiEnd = Math.PI / 4 + (owner === 1 ? Math.PI : 0);
  const psiFall = Math.min(psiEnd, 0.35);
  const LAND = 0.55;
  let slapped = false;
  // a field spell: the arena feels it — cracks run along the floor from its slot, started ON the slap (it overlaps
  // the spin-out instead of waiting for it)
  let fieldBeat: Promise<void> = Promise.resolve();
  const slap = () => {
    slapped = true;
    playV3('e_augerSlap', { volume: 0.9, pan });
    // the spin-out's coin rattle (its tick rate rises as it settles, one last clack)
    playV3('e_augerSpin', { volume: 0.85, pan });
    floorDust(sc, floor, uDepth + 0.6, rnd);
    scorchSpiral(sc, floor, DEPTH.SHADOW - 1);
    void lightFlash(sc, floor.x, floor.y, PAL.teal3, 26, 300, { intensity: 0.7 });
    void shake(sc, 70, 1);
    if (ref.zone === 'field') fieldBeat = fieldRift(sc, floor, pan);
  };
  await run(sc, COLLAPSE_MS, (t) => {
    const fa = seg(t, 0, LAND);
    const r = (Math.PI / 4) * (1 - E.outCubic(seg(fa, 0, 0.6)));
    const phi = (Math.PI / 2) * E.inQuad(fa);
    // the spin: a little while it falls, the rest flat on the tile, slowing to a stop
    const psi = psiFall * fa + (psiEnd - psiFall) * E.outQuad(seg(t, LAND, 1));
    const w = TOP_W + (FLAT_W - TOP_W) * E.inQuad(fa);
    const h = TOP_H + (FLAT_H - TOP_H) * E.inQuad(fa);
    const tq = toppleQ(r, phi, psi);
    const z = fa < 1 ? (tq.uz * w + tq.vz * h) / 2 + (1 - fa) : 0;
    if (fa >= 1 && !slapped) slap();
    const sp = fa < 1 ? 1 + Math.round(fa) : 2 + Math.round(2 * seg(t, LAND, 1));
    top.draw({ q: tq.q, w, h, z, light: -0.12 * Math.sin(Math.PI * fa), hole: 6 - Math.round(fa * 2), crack: 1, split: sp });
  });
  if (!slapped) slap();
  // the BROKEN card at rest: a whole-pixel 3-piece pose (bore 4, cracks, pieces 3 px apart). It never heals:
  // this very raster is what flies to the graveyard below.
  const brokenPose: TopPose = { q: endQ, w: FLAT_W, h: FLAT_H, z: 0, hole: 4, crack: 1, split: 3 };
  top.draw({ ...brokenPose, split: 4 });
  await wait(sc, 50);
  top.draw(brokenPose);
  await wait(sc, 40);

  // ---- T+1420: the cards leave (the drilled one — still in pieces — then the spent lance)
  let victimGone: Promise<void> = Promise.resolve();
  const vg = evAt(ctx, vgi, 'toGraveyard');
  if (owned && vg) {
    if (tile && tile.active) tile.destroy();
    victimGone = brokenLeaves(ctx, top, vg, brokenPose, pan);
  } else {
    // the card stays for the next handler (Hınç Baltası goes back to its owner's deck, its own toDeck scene):
    // the tile shows again under the proxy for that handler — face up, as the drill showed it
    if (tile && tile.active) {
      tile.setVisible(true);
      if (tile.faceUp !== true && dEv) tile.setCard(dEv.cardId);
    }
    top.destroy();
  }
  const spent = wait(sc, 40).then(() => cast.leave(gi));
  await retract;
  await fieldBeat;
  relax(ctx, 300);
  // the rest of the resolution (a field spell going out, …)
  const rest = s.run.filter((i) => i !== di && i !== vgi && i !== gi && i !== ci && !ctx.isConsumed(i));
  await fx.playRun(ctx, rest);
  await fx.all([victimGone, spent, statJob]);
  await fx.playRun(ctx, fx.resolutionRun(ctx));
}

/**
 * The drilled card goes to its owner's graveyard IN PIECES (round 4: it never heals into a whole card): the
 * proxy raster itself — bore, cracks, three pieces — lifts off the tile with a brittle rustle (e_augerShards),
 * the pieces loosening a pixel more at the top of the arc, teal embers dropping off them, a dithered shadow on
 * the floor; it lands on the pile, which then shows the card (the pile's own face) with a bump and teal dust.
 * The same arc and timing as _v3/card.ts cardLeaves (card continuity), so it sits with every other flight.
 */
async function brokenLeaves(ctx: AnyCtx, top: TopCard, g: Extract<GameEvent, { type: 'toGraveyard' }>, pose: TopPose, pan: number): Promise<void> {
  const sc = ctx.scene;
  const pile = ctx.views.field.pile(g.owner, 'graveyard');
  const from = { x: top.floor.x, y: top.floor.y };
  const to0 = pile.topXY();
  const to = { x: Math.round(to0.x), y: Math.round(to0.y) };
  const dist = Math.hypot(to.x - from.x, to.y - from.y);
  const ms = flightMs(dist) + 40;
  const arc = Math.round(Math.min(34, 14 + dist * 0.12));
  const lift = 6;
  top.ras.img.setDepth(DEPTH.FX + 5);
  playV3('e_augerShards', { volume: 0.8, pan });
  const shadow = Raster.around(sc, (from.x + to.x) / 2, (from.y + to.y) / 2, Math.abs(to.x - from.x) + 40, Math.abs(to.y - from.y) + 24, DEPTH.CARD_ON_TILE + 7);
  const embers = new PxSparks(sc, DEPTH.FX + 4);
  const rnd = fxRng(g.uid * 5 + 77);
  let floorAt = { ...from };
  let height = 0;
  const drawShadow = () =>
    shadow.draw((r) => {
      const k = Math.max(0.35, 1 - height / 60);
      const rx = Math.round(14 * k);
      const ry = Math.max(2, Math.round(7 * k));
      for (let y = -ry; y <= ry; y++)
        for (let x = -rx; x <= rx; x++) {
          const d = (x * x) / (rx * rx) + (y * y) / (ry * ry);
          if (d > 1 || (x + y) % 2 !== 0) continue;
          r.px(Math.round(floorAt.x) + x, Math.round(floorAt.y) + y, PAL.ink);
        }
    });
  const place = (split: number) => {
    top.floor = { x: Math.round(floorAt.x), y: Math.round(floorAt.y) - height };
    top.draw({ ...pose, split });
    drawShadow();
  };
  await run(sc, 60, (t) => {
    height = Math.round(lift * (1 - (1 - t) * (1 - t)));
    place(3);
  });
  let lastEmber = -99;
  await run(sc, ms, (t, el) => {
    const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    floorAt = { x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e };
    height = Math.round(lift * (1 - e) + arc * Math.sin(Math.PI * e));
    // the pieces loosen a pixel at the top of the arc, then close up again for the landing (still broken)
    place(3 + Math.round(Math.sin(Math.PI * t)));
    if (el - lastEmber >= 28 && t < 0.85) {
      lastEmber = el;
      const x = Math.round(floorAt.x + (rnd() - 0.5) * 22);
      const y = Math.round(floorAt.y - height + (rnd() - 0.5) * 8);
      embers.add({ x, y, vx: (rnd() - 0.5) * 20, vy: 10, ay: 160, life: 200 + rnd() * 100, colors: [PAL.teal4, PAL.teal2, PAL.teal1], shape: 'px', fadeAt: 1 });
    }
  });
  embers.release();
  shadow.destroy();
  // land on the pile (the count from the engine state: A6 §2.3, as cardLeaves)
  const count = landingCount(pile.count, ctx.after?.players?.[g.owner]?.graveyard?.length);
  const accept = V3HOOKS.pileAccept;
  if (accept) {
    const img = sc.add.image(to.x, to.y, cardIsoKey(g.cardId, 'up', g.owner)).setOrigin(ISO_CX / ISO_TEX_W, ISO_CY / ISO_TEX_H).setDepth(DEPTH.FX + 5);
    top.destroy();
    pile.set(count, g.cardId);
    accept(ctx, { owner: g.owner, cardId: g.cardId, pile, at: to, count, card: img });
    return;
  }
  top.destroy();
  try {
    sfx.play('cardPlace', { volume: 0.45, pitch: 0.9 });
  } catch {
    /* no audio */
  }
  pile.set(count, g.cardId);
  pile.bump();
  // the drilled card's teal dust puffs off the pile (its last breath)
  const sp = new PxSparks(sc, DEPTH.FX + 4);
  for (let i = 0; i < 8; i++) {
    const a = Math.PI + (i / 7) * Math.PI;
    sp.add({ x: to.x, y: to.y, vx: Math.cos(a) * 46, vy: Math.sin(a) * 22, drag: 4, life: 220, colors: [PAL.white, PAL.teal4, PAL.teal2], shape: 'px', fadeAt: 1 });
  }
  sp.release();
}

/**
 * The equip's holder's bond snaps at the lock: the little aura sword fizzles out in teal (it never floats in
 * front of the drilled card). Its gold pixels become teal sparks that drop to the holder's floor.
 */
function snapBond(sc: Phaser.Scene, u: MonsterUnit): void {
  const s = u.sprite;
  const an = equipAnchor(u);
  const gx = Math.round(s.x + an.dx);
  const gy = Math.round(s.y + an.dy);
  u.setAura('equip', null);
  star(sc, { x: gx, y: gy - 6 }, 4, 130, s.depth + 1);
  const sp = new PxSparks(sc, s.depth + 1);
  const rnd = fxRng(u.uid * 3 + 5);
  for (let i = 0; i < 9; i++)
    sp.add({ x: gx + Math.round((rnd() - 0.5) * 4), y: gy - Math.round(rnd() * 14), vx: (rnd() - 0.5) * 50, vy: -20 - rnd() * 30, ay: 260, life: 260 + rnd() * 120, colors: [PAL.white, PAL.teal4, PAL.teal3, PAL.teal1], shape: i % 3 === 0 ? 'plus' : 'px', floor: Math.round(u.home.y), bounce: 0.2, fadeAt: 1 });
  sp.release();
}

/** A ring of dust puffs as the drilled card slaps flat on its tile. */
function floorDust(sc: Phaser.Scene, at: XY, depth: number, rnd: () => number): void {
  const sp = new PxSparks(sc, depth);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    sp.add({ x: Math.round(at.x + Math.cos(a) * 14), y: Math.round(at.y + Math.sin(a) * 7), vx: Math.cos(a) * 34, vy: Math.sin(a) * 14 - 6, drag: 4, life: 260 + rnd() * 160, size: 2, shape: 'puff', colors: [PAL.night4, PAL.night3, PAL.night2], fadeAt: 0.6 });
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
    // the quick answer: the reveal (with the card's name under "HIZLI BÜYÜ!"), then the card lies down cocked;
    // the target comes in the next batch (the 'target' hook below fires it — no second opening)
    const q = await quickReveal(ctx, { sub: 'BURGU MIZRAĞI', hold: 20 });
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
  await signature(ctx, { cast: openingCaster(op), ref, uid: ev.uid, run: run0.filter((i) => i !== ti) });
});

registerCardHook('auger_lance', 'target', async (ctx) => {
  if (!LOOK_V3) return ctx.base();
  const ev = ctx.ev;
  const ref = ev.targets[0];
  if (!ref) return ctx.base();
  const uid = ev.sourceUid;
  const p = ev.player;
  const zone = ctx.state.players[p].spellTraps.findIndex((st) => st?.uid === uid);
  const onField = zone >= 0 && !!ctx.views.field.tileAt(p, 'spellTrap', zone);
  const actx = ctx as unknown as AnyCtx;
  if (onField) {
    // the cocked quick answer FIRES: it snaps up with one zig-zag tick and the orb leaves it at once
    const q = await quickFire(actx, { uid, cardId: 'auger_lance', player: p, zone: onField ? zone : null });
    await signature(actx, { cast: quickCaster(q), ref, uid, run: fx.resolutionRun(ctx) });
    return;
  }
  // (a spell_seal window delayed the target of a hand cast: the card already went — a short opening again)
  const op = await spellOpening(actx, { uid, cardId: 'auger_lance', player: p, from: 'hand', zone: null, hold: 100, keepCard: true, releaseFrom: 'top' });
  await signature(actx, { cast: openingCaster(op), ref, uid, run: fx.resolutionRun(ctx) });
});
