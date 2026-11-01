// Kukla İpi (puppet_string) — v3 presentation (docs/v3/YENI_KARTLAR.md §7 S2; lane E). The v1 look keeps the
// generic activation and the batch-2 placeholder (src/cinematics/b2/placeholders.ts): every hook below steps aside
// without ?look=v3.
//
// BEAT LIST — the take (scene ms; ×1.35 in game time with the v3 tempo):
//   0      common v3 spell opening (spells/_kit): the card leaves the hand for its owner's side (or a set card
//          stands up on its tile), "KUKLA İPİ" plate, a short hover
//   ~380   release: the orb leaves the card's top edge and zips to the point above the victim; the spent card
//          drops to the graveyard behind it
//   +0     THE CROSS: a dark-gold wooden marionette cross pops out of the orb (gold flash + star flare), drops
//          8 px with a pendulum overshoot and hangs ~46 px over the victim's head, bobbing — e_puppetCross
//          ("tok" on the catch); a gold light pool opens on the victim's tile
//   +260   FIVE STRINGS drop one after another (75 ms apart: the hands, the feet, the HEAD last), each a 1-px gold4 line with a white falling tip — e_puppetTsing ×5 (E5 G5 A5 B5 D6,
//          panned with the string); each lands on its limb with a star hook: flash frame → small star — e_puppetHook,
//          the string buzzes ±1 px for 120 ms, a 1-px jolt in the body
//   +670   tension: the cross lifts 3 px, the five strings straighten, the body rises 2 px on them
//   +760   the SPIRAL GLINT: a 5×5 teal spiral turns in its eye (4 frames × 70 ms, ~1 turn) — e_puppetGlint
//   +1020  THREE JERKY PUPPET HOPS (400 ms each) to the new zone: the cross jerks ahead first (anticipation),
//          the strings slant, the body is yanked up in 3 stepped pixels (lift 12) — e_puppetCreak; it travels a
//          third of the way on 2-frame stop-motion steps; it drops, 1-px bounce, dust — e_puppetStep. Its card
//          slides under it hop by hop; an equip's gold tether follows it from its owner's row
//   +2220  it lands on the new zone FACING THE WRONG WAY, a beat, then turns round on the strings (a gold frame,
//          the flip) — e_puppetTurn; the new tile flashes gold
//   +2520  the strings draw up into the cross (top → bottom) — e_puppetSettle; the cross shrinks to the small
//          cross that keeps hanging over it; ONE thin light string stays
//   ~2740  done (measured: ePuppet 4.87 s game time from the click, opening included). For the rest of the turn the small cross hangs over the monster and its single string follows
//          the body wherever it goes (attacks too), swaying, a bead of light running down it now and then.
//
// THE RETURN (End Phase, controlChange 'return', sourceUid null — claimed by the borrowed slot's byUid):
//   0      the small cross flares and becomes the big one again; four strings shoot back down (40 ms apart)
//   +240   the body jerks up 2 px against them
//   +290   FIVE SNAPS, 72 ms apart, right → left: each string breaks at a point along it, the upper piece whips
//          back into the cross, the lower piece curls and falls away, its star pops — e_puppetPing ×5 (descending)
//   +700   the cross breaks into falling gold motes
//   +700   it staggers home in three uneven lurches (still facing the wrong way: stumbling backwards) —
//          e_puppetStagger, e_puppetStep
//   +1400  at home it turns round, shakes its head (±1 px) as the last teal glint leaves its eye — e_puppetFree
//   ~1620  done.
// No free zone at the owner (destroy, reason 'rule'): the strings come down and snap the same way, it lurches
// toward its owner's side, bounces off the full row, and its own death plays (the chain's next handler).
// A face-down target is carried as its face-down card (the strings hook the tile; no glint, it stays hidden).

import Phaser from 'phaser';
import type { CardId } from '../../data/cards';
import type { GameEvent, GameState, PlayerId, Uid } from '../../engine/types';
import { PAL } from '../../art/palette';
import { BRIDGE_ROWS, DEPTH, LOOK_V3, type Rect, type XY, isoToScreen, screenToIso, unitDepth, zoneXY } from '../../view/layout';
import { KEEP_OUT, SCREENS } from '../../view/board-nt/layout-nt';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import type { FieldView } from '../../duel/FieldView';
import type { TileCard } from '../../view/TileCard';
import { Sparks as PxSparks } from '../../vfx/combat';
import { Raster, onFrame, run, spriteBox } from '../../vfx/setpieces';
import { hitStop, wait } from '../../vfx/core';
import { panAt, play as playV3 } from '../_v3/sound';
import { fx, registerCardHook, registerEvent, type CinematicContext } from '../api';
import { registerLaneE, type LaneECtx } from '../b2e/dispatch';
import { GOLD_FX, bg, evAt, idxOf, lightFlash, lightPool, relax, setTileOf, spellOpening, starFlare, type ActCtx, type LightHandle } from './_kit';
import {
  CROSS_EXT,
  CROSS_HOOKS,
  CROSS_KEY,
  CROSS_MID_KEY,
  CROSS_M_O,
  CROSS_O,
  CROSS_SMALL_KEY,
  CROSS_S_EXT,
  CROSS_S_O,
  CROSS_W,
  CROSS_H,
  SPIRAL_KEY,
  STAR_KEY,
  drawString,
  newString,
  puppetTextures,
  stringLayer,
  type StringSpec,
} from './_puppet_string_fx';
import { puppetPose, type PuppetPose } from './_puppet_string_body';
import { PUPPET_STRING_MIDI } from '../../audio/v3/e/puppet_string';

const R = Math.round;
const ID: CardId = 'puppet_string';
/**
 * The lingering strings, by monster uid. Not ctx.keep: the Director drops kept handles at the end of every batch,
 * and this one must hang over the monster until the End Phase (several batches later). Cleared on scene shutdown.
 */
const LINGER = new Map<Uid, Linger>();
function keepLinger(sc: Phaser.Scene, uid: Uid, l: Linger): void {
  LINGER.get(uid)?.destroy();
  LINGER.set(uid, l);
  sc.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    for (const h of LINGER.values()) h.destroy();
    LINGER.clear();
  });
}
function takeLinger(uid: Uid): Linger | null {
  const l = LINGER.get(uid) ?? null;
  LINGER.delete(uid);
  return l;
}

// ---- timings (scene ms)
const CROSS_DROP = 260;
const STRING_GAP = 75;
const STRING_FALL = 110;
const HOP_MS = 400;
/** Hop heights (px): the third is the big one (it lands with a hit-stop). */
const HOP_LIFT = [16, 20, 24];
/** The cross hangs this far over the head (never higher than HANG_MIN: the phase bar). */
const HANG = 34;
const HANG_MIN = 30;

/** Pitch factor for string i (E5 G5 A5 B5 D6 relative to the recipe's E5). */
const tsingPitch = (i: number) => Math.pow(2, (PUPPET_STRING_MIDI[i] - PUPPET_STRING_MIDI[0]) / 12);
/** Snap pitches (relative to B5), right → left descending. */
const PING_SEMIS = [3, 0, -2, -5, -7];

/** Stop-motion time: t quantised to `steps` steps. */
const q = (t: number, steps: number) => Math.min(1, Math.floor(t * steps) / steps);

// ================================================================ who owns an event

/** The slot of `uid` in a state (any side). */
function slotOf(s: GameState, uid: Uid) {
  for (const p of [0, 1] as PlayerId[]) {
    const ms = s.players[p].monsters;
    for (let i = 0; i < ms.length; i++) if (ms[i]?.uid === uid) return ms[i]!;
  }
  return null;
}

/** Is `uid` borrowed by a Kukla İpi in state `s`? */
function borrowedByPuppet(s: GameState, uid: Uid): boolean {
  const b = slotOf(s, uid)?.borrowed;
  return !!b && b.until === 'endPhase' && s.cards[b.byUid]?.cardId === ID;
}

// ================================================================ routing and HUD clearance

/**
 * The walk between two monster zones in three legs, along a lane (never straight through the other units):
 * out of the source row onto the bridge (same column), along the bridge to the target's column, in to the
 * target. Same column: three even thirds (nothing stands between).
 */
function route(from: XY, to: XY): XY[] {
  const a = screenToIso(from.x, from.y);
  const b = screenToIso(to.x, to.y);
  const ca = R(a.col);
  const ra = R(a.row);
  const cb = R(b.col);
  const rb = R(b.row);
  const lerp = (k: number): XY => ({ x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k });
  if (ca === cb || ra === rb) return [lerp(1 / 3), lerp(2 / 3), { ...to }];
  // the bridge row nearest each end (one bridge row in the v3 board: both the same)
  const near = (r: number) => BRIDGE_ROWS.reduce((best, x) => (Math.abs(x - r) < Math.abs(best - r) ? x : best), BRIDGE_ROWS[0]);
  const w1 = isoToScreen(ca, near(ra));
  const w2 = isoToScreen(cb, near(rb));
  return [w1, w2, { ...to }];
}

/** Screen rects the puppeteer's cross must keep clear of (the arena's portrait screens, the HUD plates). */
const KEEP: readonly Rect[] = [...SCREENS, KEEP_OUT.phaseBar, KEEP_OUT.toolbar, KEEP_OUT.p2Panel, KEEP_OUT.p1Panel, KEEP_OUT.inspect].filter(Boolean);

function hitsKeep(x: number, y: number, e: { l: number; t: number; r: number; b: number }): boolean {
  const x0 = x - e.l - 1;
  const x1 = x + e.r + 1;
  const y0 = y - e.t - 1;
  const y1 = y + e.b + 1;
  for (const k of KEEP) if (x1 > k.x && x0 < k.x + k.w && y1 > k.y && y0 < k.y + k.h) return true;
  return false;
}

/**
 * Where the cross can hang: `want` if it is clear of the HUD / portraits; else the nearest clear spot — first
 * sideways (the strings slant: the puppeteer works from the side), a little lower if that is not enough, never
 * lower than `minGap` px over `bodyTop`. Falls back to `want`.
 */
function placeCross(want: XY, e: { l: number; t: number; r: number; b: number }, bodyTop: number, minGap = 10): XY {
  const w = { x: R(want.x), y: R(Math.max(HANG_MIN, want.y)) };
  if (!hitsKeep(w.x, w.y, e)) return w;
  let best: XY | null = null;
  let cost = Infinity;
  const yMax = R(bodyTop - minGap - e.b);
  for (let dy = 0; dy <= 18; dy += 2) {
    const y = w.y + dy;
    if (dy > 0 && y > yMax) break;
    for (let dx = 0; dx <= 56; dx++) {
      if (dx + dy * 2 >= cost) break;
      for (const sgn of [-1, 1]) {
        const x = w.x + sgn * dx;
        if (x - e.l < 2 || x + e.r > 638) continue;
        if (!hitsKeep(x, y, e)) {
          best = { x, y };
          cost = dx + dy * 2;
          break;
        }
      }
    }
  }
  return best ?? w;
}

// ================================================================ the puppet body (unit or face-down tile)

/** What the strings move: a monster unit (face-up) or its face-down tile. */
interface Body {
  unit: MonsterUnit | null;
  tile: TileCard | null;
  /** Floor point under it right now. */
  ground: XY;
  /** Height above the floor (px). */
  lift: number;
  /** Sideways nudge (px), on top of ground. */
  nx: number;
  /** Extra y nudge (px, positive = down). */
  ny: number;
  hover: number;
  /** The five limb points relative to the body's sprite position (P1 facing), string order. */
  limbs: XY[];
  flip: boolean;
  /** The limp-puppet pose frames (lean / dangle) while the strings hold it; null: plain sprite. */
  pose: PuppetPose | null;
  /** The strings twist (cross over) during the pirouette. */
  twist: boolean;
}

function makeBody(sc: Phaser.Scene, unit: MonsterUnit | null, tile: TileCard | null, ground: XY): Body {
  const b: Body = { unit, tile, ground: { ...ground }, lift: 0, nx: 0, ny: 0, hover: unit ? unit.hover : 0, limbs: [], flip: unit ? unit.sprite.flipX : false, pose: null, twist: false };
  if (unit) {
    const s = unit.sprite;
    const box = spriteBox(sc, s);
    const sx = s.x;
    const sy = s.y;
    const top = box.top;
    const bottom = box.bottom;
    const h = bottom - top;
    const coreY = Math.round(top + h * 0.45);
    const span = (y: number): [number, number] => box.spanAt(y) ?? [box.left, box.right];
    const [hl, hr] = span(coreY);
    const footY = Math.round(bottom - Math.max(2, h * 0.08));
    const [fl, fr] = span(footY);
    const headY = Math.round(top + Math.max(2, h * 0.06));
    const [al, ar] = span(headY);
    // world points in the sprite's current facing (b.flip); limbAt mirrors them when the sprite flips later
    const L: XY[] = [
      { x: hl + 2, y: coreY },
      { x: fl + 3, y: footY },
      { x: R((al + ar) / 2), y: headY },
      { x: fr - 3, y: footY },
      { x: hr - 2, y: coreY },
    ];
    // never two feet on one pixel, never two hands: spread them
    if (L[3].x - L[1].x < 6) {
      const c = (L[1].x + L[3].x) / 2;
      L[1].x = c - 3;
      L[3].x = c + 3;
    }
    if (L[4].x - L[0].x < 10) {
      const c = (L[0].x + L[4].x) / 2;
      L[0].x = c - 5;
      L[4].x = c + 5;
    }
    b.limbs = L.map((p) => ({ x: R(p.x - sx), y: R(p.y - sy) }));
  } else if (tile) {
    // a face-down card lying on its tile: its four corners and its centre
    const hx = 14;
    const hy = 7;
    b.limbs = [
      { x: -hx, y: 0 },
      { x: -4, y: hy - 1 },
      { x: 0, y: -hy + 1 },
      { x: 4, y: hy - 1 },
      { x: hx, y: 0 },
    ];
  }
  return b;
}

/** The sprite (or tile) position for the body's current ground / lift / nudge. */
function bodyAnchor(b: Body): XY {
  return { x: R(b.ground.x + b.nx), y: R(b.ground.y - b.hover - b.lift + b.ny) };
}

function placeBody(b: Body): void {
  const a = bodyAnchor(b);
  if (b.unit && b.unit.sprite.active) {
    const s = b.unit.sprite;
    s.setPosition(a.x, a.y);
    s.setDepth(unitDepth(R(b.ground.y)));
    b.unit.lift = Math.max(0, R(b.lift - b.ny));
  }
  if (b.tile && b.tile.active) {
    b.tile.setPosition(R(b.ground.x + b.nx), R(b.ground.y - (b.unit ? 0 : b.lift) + (b.unit ? 0 : b.ny)));
    if (!b.unit) b.tile.setDepth(DEPTH.UNIT + R(b.ground.y));
  }
}

/** Set the limp pose (no-op without pose frames). */
function pose(b: Body, lean: number, dangle: number): void {
  if (b.pose && (b.pose.lean !== R(lean) || b.pose.dangle !== R(dangle))) b.pose.set(lean, dangle);
}

/** The five limb points in world px, left → right on screen (string i takes the i-th: the strings never cross). */
function limbsNow(b: Body): XY[] {
  const a = bodyAnchor(b);
  const mirrored = b.flip !== (b.unit ? b.unit.sprite.flipX : false);
  const pts = b.limbs.map((l) => {
    const r = { x: mirrored ? -l.x : l.x, y: l.y };
    const o = b.pose ? b.pose.offset(r) : { x: 0, y: 0 };
    return { x: a.x + r.x + o.x, y: a.y + r.y + o.y };
  });
  // the head stays in the middle; the four others sort by x, hands outside the feet (a marionette's fan)
  const head = pts[2];
  const rest = [pts[0], pts[1], pts[3], pts[4]].sort((p, q) => p.x - q.x);
  const [l0, l1, r1, r0] = rest;
  // the pirouette: the strings cross over (each string takes the mirrored limb)
  return b.twist ? [r0, r1, head, l1, l0] : [l0, l1, head, r1, r0];
}

/** A limb point in world px. */
function limbAt(b: Body, i: number): XY {
  return limbsNow(b)[i];
}

/** The eye points (world px) under the current pose and facing. */
function eyesAt(b: Body): XY[] {
  if (!b.pose || !b.unit) return [];
  const a = bodyAnchor(b);
  const flip = b.unit.sprite.flipX;
  return b.pose.eyes.map((e) => {
    const r = { x: flip ? -e.x - 1 : e.x, y: e.y };
    const o = b.pose!.offset(r);
    return { x: a.x + r.x + o.x, y: a.y + r.y + o.y };
  });
}

/** Top of the body (for the cross height). */
function bodyTop(b: Body): number {
  return Math.min(...b.limbs.map((l) => l.y)) + bodyAnchor(b).y;
}

/**
 * Other units' stat badges the body passes over fade back (and stay faded until the walk ends: no flicker, and a
 * neighbour's numbers never read as the puppet's own). Restored by the returned fn.
 */
function badgeDimmer(sc: Phaser.Scene, field: FieldView, b: Body): () => void {
  const touched = new Set<Phaser.GameObjects.Image>();
  const stop = onFrame(sc, () => {
    if (!b.unit || !b.unit.sprite.active) return true;
    const box = spriteBox(sc, b.unit.sprite);
    for (const u of field.units()) {
      if (u === b.unit || u.retired) continue;
      const img = u.badge.image;
      if (!img.active || !img.visible || touched.has(img)) continue;
      const bx0 = img.x - img.displayOriginX;
      const by0 = img.y - img.displayOriginY;
      // the body's box, grown 4 px down (its feet and shadow)
      const over = box.right > bx0 && box.left < bx0 + img.displayWidth && box.bottom + 4 > by0 && box.top < by0 + img.displayHeight;
      if (over) {
        touched.add(img);
        img.setAlpha(0.2);
      }
    }
    return true;
  });
  return () => {
    stop();
    for (const img of touched) if (img.active) sc.tweens.add({ targets: img, alpha: 1, duration: 200 });
  };
}

// ================================================================ the rig (cross + five strings + stars)

interface Rig {
  cross: Phaser.GameObjects.Image;
  /** Cross knot position (world). */
  at: XY;
  strings: StringSpec[];
  stars: Phaser.GameObjects.Image[];
  layer: Raster;
  tether: { from: XY; on: boolean } | null;
  /** The cross's light: follows the cross every frame (air glow, a small pool under the body). */
  light: LightHandle | null;
  stop(): void;
}

function crossHook(r: Rig, i: number): XY {
  return { x: r.at.x + CROSS_HOOKS[i].x, y: r.at.y + CROSS_HOOKS[i].y };
}

/** The star hangs just under the limb point: the string visibly ends in it. */
const STAR_DY = 4;

function makeRig(sc: Phaser.Scene, b: Body, at: XY): Rig {
  puppetTextures(sc);
  const cross = sc.add.image(at.x, at.y, CROSS_KEY).setOrigin(CROSS_O.x / CROSS_W, CROSS_O.y / CROSS_H).setDepth(DEPTH.FX + 7);
  const layer = stringLayer(sc);
  const strings = [0, 1, 2, 3, 4].map(() => newString({ ...at }, { ...at }));
  const stars = [0, 1, 2, 3, 4].map(() => sc.add.image(0, 0, STAR_KEY, 's').setDepth(DEPTH.FX + 8).setVisible(false));
  const rig: Rig = { cross, at: { ...at }, strings, stars, layer, tether: null, light: null, stop: () => undefined };
  let frame = 0;
  rig.stop = onFrame(sc, (dt) => {
    if (!layer.alive) return false;
    frame++;
    cross.setPosition(R(rig.at.x), R(rig.at.y));
    rig.light?.setPosition(R(rig.at.x), R(rig.at.y), R(b.ground.y));
    layer.draw((r) => {
      if (rig.tether?.on) {
        // the equip's link: a thin gold1 line from its card to the feet, a gold3 pixel every 5
        const f = rig.tether.from;
        const to = { x: R(b.ground.x + b.nx), y: R(b.ground.y + b.ny) };
        r.line(f.x, f.y, to.x, to.y, PAL.gold1);
        const n = Math.max(1, Math.floor(Math.hypot(to.x - f.x, to.y - f.y) / 5));
        const ph = Math.floor(frame / 3) % 5;
        for (let k = 0; k < n; k++) {
          const t = (k * 5 + ph) / (n * 5);
          r.px(R(f.x + (to.x - f.x) * t), R(f.y + (to.y - f.y) * t), PAL.gold3);
        }
      }
      strings.forEach((s, i) => {
        s.a = crossHook(rig, i);
        if (s.cut === null) s.b = limbAt(b, i);
        if (s.buzz > 0) s.buzz -= dt;
        drawString(r, s, frame);
      });
    });
    strings.forEach((s, i) => {
      const st = stars[i];
      if (!st.active) return;
      const show = s.star && s.cut === null;
      st.setVisible(show);
      if (show) st.setPosition(s.b.x, s.b.y + STAR_DY - 1);
    });
    return true;
  });
  return rig;
}

function destroyRig(r: Rig): void {
  r.stop();
  r.layer.destroy();
  if (r.cross.active) r.cross.destroy();
  r.stars.forEach((s) => s.active && s.destroy());
  if (r.light) void r.light.fadeOut(200);
  r.light = null;
}

/** Show the cross as the big / mid / small texture (the knot stays put). */
function crossSize(r: Rig, size: 'big' | 'mid' | 'small'): void {
  if (!r.cross.active) return;
  if (size === 'big') r.cross.setTexture(CROSS_KEY).setOrigin(CROSS_O.x / CROSS_W, CROSS_O.y / CROSS_H);
  else if (size === 'mid') r.cross.setTexture(CROSS_MID_KEY).setOrigin(CROSS_M_O.x / 25, CROSS_M_O.y / 14);
  else r.cross.setTexture(CROSS_SMALL_KEY).setOrigin(CROSS_S_O.x / 13, CROSS_S_O.y / 9);
}

/** Drop string i (falls STRING_FALL ms), hook it with a star flash. */
async function dropString(sc: Phaser.Scene, r: Rig, i: number, o: { ms?: number; volume?: number; quiet?: boolean } = {}): Promise<void> {
  const s = r.strings[i];
  s.level = 1;
  const pan = panAt(s.b.x);
  playV3('e_puppetTsing', { volume: o.volume ?? 0.8, pitch: tsingPitch(i), pan });
  await run(sc, o.ms ?? STRING_FALL, (t) => {
    s.drop = t < 1 ? q(t * t * 0.4 + t * 0.6, 8) : 1;
  });
  s.drop = 1;
  s.buzz = 120;
  if (!o.quiet) playV3('e_puppetHook', { volume: 0.95, pan });
  // the hook bites: a flash frame, then the star
  const st = r.stars[i];
  st.setFrame('f').setVisible(true).setPosition(s.b.x, s.b.y + STAR_DY - 1);
  s.star = true;
  void lightFlash(sc, s.b.x, s.b.y, PAL.gold3, 12, 200, { intensity: 0.6 });
  sc.time.delayedCall(60, () => st.active && st.setFrame('s'));
}

// ================================================================ the lingering string (rest of the turn)

interface Linger {
  destroy(): void;
  /** The small cross's world position (the return grows the big one there). */
  where(): XY | null;
  /** Hand the scene over: stop drawing (the caller rebuilds the rig). */
  handOver(): void;
}

function lingerString(sc: Phaser.Scene, field: FieldView, uid: Uid, start: XY | null): Linger {
  puppetTextures(sc);
  const cross = sc.add.image(0, 0, CROSS_SMALL_KEY).setOrigin(CROSS_S_O.x / 13, CROSS_S_O.y / 9).setDepth(DEPTH.FX + 7).setVisible(false);
  // a 1-px string layer: a narrow column moved with the cross (never a full-screen upload for the whole turn)
  const RW = 120;
  const RH = 180;
  const ras = new Raster(sc, 0, 0, RW, RH, DEPTH.FX + 6);
  const air = lightPool(sc, 0, 0, { color: PAL.gold3, radius: 6, spill: null, air: 0.35, airRadius: 8, intensity: 0, fadeIn: 0, anim: 'breathe' });
  let el = 0;
  let cx: number | null = start ? start.x : null;
  let cy: number | null = start ? start.y : null;
  let gone = 0;
  let alive = true;
  let fadeK = 1;
  let last: XY | null = null;
  const stop = onFrame(sc, (dt) => {
    if (!alive) return false;
    el += dt;
    const u = field.unit(uid);
    const t = u && !u.retired && u.sprite.active && u.sprite.visible ? null : field.tileOf(uid);
    let head: XY | null = null;
    if (u && !u.retired && u.sprite.active && u.sprite.visible) {
      const box = spriteBox(sc, u.sprite);
      const hy = R(box.top + Math.max(2, (box.bottom - box.top) * 0.06));
      const span = box.spanAt(hy) ?? [box.left, box.right];
      head = { x: R((span[0] + span[1]) / 2), y: hy };
    } else if (t && t.active && t.visible) head = { x: R(t.x), y: R(t.y) - 1 };
    if (!head) {
      gone += dt;
      if (gone > 80) fadeK = Math.max(0, fadeK - dt / 260);
    } else {
      gone = 0;
      last = head;
    }
    if (!last || fadeK <= 0) {
      if (fadeK <= 0) {
        alive = false;
        destroy();
      }
      return fadeK > 0;
    }
    // the cross trails the body (eased, whole pixels), clear of the HUD, bobbing 1 px every 450 ms, swaying ±1 px
    const want = placeCross({ x: last.x, y: Math.max(HANG_MIN, last.y - 34) }, CROSS_S_EXT, last.y, 8);
    cx = cx === null ? want.x : cx + (want.x - cx) * Math.min(1, dt / 120);
    cy = cy === null ? want.y : cy + (want.y - cy) * Math.min(1, dt / 120);
    const sway = Math.floor(el / 700) % 4 === 1 ? 1 : Math.floor(el / 700) % 4 === 3 ? -1 : 0;
    const at = { x: R(cx) + sway, y: R(cy) + (Math.floor(el / 450) % 2) };
    cross.setPosition(at.x, at.y).setVisible(fadeK > 0.5).setAlpha(1);
    air.setPosition(at.x, at.y, last.y).setIntensity(0.5 * fadeK, 0);
    const a = { x: at.x, y: at.y + 5 };
    const b = { x: Math.max(a.x - RW / 2 + 1, Math.min(a.x + RW / 2 - 2, last.x)), y: Math.min(a.y + RH - 4, last.y) };
    ras.moveTo(a.x - RW / 2, a.y - 2);
    ras.draw((r) => {
      if (fadeK < 0.5) {
        // fading: the string goes slack and drops in pieces
        r.line(a.x, a.y, a.x, a.y + 4, PAL.gold2);
        return;
      }
      r.line(a.x, a.y, b.x, b.y, PAL.gold3);
      // a bead of light runs down every 1.6 s
      const ph = (el % 1600) / 600;
      if (ph < 1) {
        const k = q(ph, 12);
        const x = R(a.x + (b.x - a.x) * k);
        const y = R(a.y + (b.y - a.y) * k);
        r.px(x, y, PAL.gold4);
        r.px(x, y - 1, PAL.gold4);
      }
      r.px(b.x, b.y, PAL.gold4);
    });
    return true;
  });
  const destroy = () => {
    alive = false;
    if (LINGER.get(uid) === handle) LINGER.delete(uid);
    stop();
    ras.destroy();
    if (cross.active) cross.destroy();
    void air.fadeOut(120);
  };
  const handle: Linger = {
    destroy,
    where: () => (cross.active && cross.visible ? { x: cross.x, y: cross.y } : null),
    handOver: destroy,
  };
  return handle;
}

// ================================================================ dust / motes

function dust(sc: Phaser.Scene, at: XY, n = 6): void {
  const sp = new PxSparks(sc, unitDepth(at.y) + 1);
  for (let i = 0; i < n; i++) {
    const side = i % 2 ? 1 : -1;
    sp.add({ x: at.x + side * (2 + (i % 3) * 2), y: at.y, vx: side * (14 + (i % 3) * 8), vy: -10 - (i % 2) * 8, ay: 60, drag: 2, life: 260 + (i % 3) * 40, colors: [PAL.stone3, PAL.stone2, PAL.stone1], shape: 'px', fadeAt: 0.6 });
  }
  sp.release();
}

function motesFall(sc: Phaser.Scene, at: XY, n: number, colors: readonly number[]): void {
  const sp = new PxSparks(sc, DEPTH.FX + 8);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    sp.add({ x: R(at.x + Math.cos(a) * (4 + (i % 4) * 4)), y: R(at.y + Math.sin(a) * 3), vx: Math.cos(a) * 24, vy: -18 + (i % 3) * 6, ay: 90, drag: 1.5, life: 420 + (i % 5) * 60, colors, shape: i % 5 === 0 ? 'plus' : 'px', fadeAt: 0.55 });
  }
  sp.release();
}

/** The cross breaks: its bars fly apart as stepped wooden splinters (gold1 / gold2 sticks) with gold motes. */
function crossBreak(sc: Phaser.Scene, at: XY): void {
  const sp = new PxSparks(sc, DEPTH.FX + 8);
  const bits = [
    { dx: -14, vx: -40, vy: -30 },
    { dx: -6, vx: -18, vy: -46 },
    { dx: 0, vx: 4, vy: -52 },
    { dx: 7, vx: 22, vy: -42 },
    { dx: 14, vx: 42, vy: -26 },
  ];
  for (const b of bits) sp.add({ x: at.x + b.dx, y: at.y, vx: b.vx, vy: b.vy, ay: 160, drag: 0.8, life: 520, colors: [PAL.gold3, PAL.gold2, PAL.gold1], shape: 'plus', fadeAt: 0.7 });
  sp.release();
  motesFall(sc, at, 14, [PAL.gold4, PAL.gold4, PAL.gold3, PAL.gold2]);
}

// ================================================================ the take

type CCCtx = LaneECtx<'controlChange'>;

/** The cross's spot over a body standing at `ground` (HUD-clear). */
function hangOver(b: Body, ground: XY): XY {
  const top = bodyTop(b) - bodyAnchor(b).y + R(ground.y - b.hover);
  return placeCross({ x: ground.x, y: top - HANG }, CROSS_EXT, top);
}

async function takeScene(ctx: CCCtx, hint: { crossAt?: XY } = {}): Promise<void> {
  const ev = ctx.ev;
  const sc = ctx.scene;
  const field = ctx.views.field;
  const from = zoneXY(ev.from, 'monster', ev.fromZone);
  const to = zoneXY(ev.to, 'monster', ev.toZone);
  const faceUp = ev.cardId !== null;
  const rel = field.release(ev.uid);
  const unit = rel.unit && !rel.unit.retired && rel.unit.sprite.active ? rel.unit : null;
  const tile = rel.tile && rel.tile.active ? rel.tile : null;
  if (unit) {
    unit.badge.setVisible(false);
    unit.lift = 0;
  }
  const b = makeBody(sc, unit, tile, from);
  placeBody(b);
  const undim = badgeDimmer(sc, field, b);
  // an equip travels with it: its card stays in the owner's row, a gold tether follows the body
  const eqSlot = ctx.state.players.flatMap((p) => p.spellTraps).find((s) => s && s.equippedTo === ev.uid) ?? null;
  const eqTile = eqSlot ? field.tileOf(eqSlot.uid) : null;

  // ---- the cross: a two-frame silhouette pop (2× white, 1× gold4), then the wood, dropping with a pendulum
  const hang: XY = hint.crossAt ? { x: hint.crossAt.x, y: hint.crossAt.y + 8 } : hangOver(b, from);
  const rig = makeRig(sc, b, { x: hang.x, y: hang.y - 8 });
  if (eqTile) rig.tether = { from: { x: R(eqTile.home.x), y: R(eqTile.home.y) }, on: false };
  rig.light = lightPool(sc, hang.x, hang.y, { color: PAL.gold4, radius: 8, spill: null, floorY: from.y, air: 0.6, airRadius: 14, intensity: 0, fadeIn: 0, anim: 'flicker' });
  rig.light.setIntensity(1, 160);
  bg(starFlare(sc, { x: hang.x, y: hang.y - 8 }, 240, GOLD_FX, 26));
  void lightFlash(sc, hang.x, hang.y - 8, PAL.gold4, 34, 320, { floorY: from.y, intensity: 1 });
  playV3('e_puppetCross', { volume: 1, pan: panAt(hang.x) });
  rig.cross.setScale(2).setTintFill(PAL.white);
  await wait(sc, 40);
  rig.cross.setScale(1).setTintFill(PAL.gold4);
  await wait(sc, 40);
  rig.cross.clearTint();
  // the drop with a pendulum overshoot (stepped): -8 → +3 → -1 → 0
  await run(sc, CROSS_DROP, (t) => {
    const k = t < 0.45 ? -8 + 11 * (t / 0.45) : t < 0.7 ? 3 - 4 * ((t - 0.45) / 0.25) : -1 + (t - 0.7) / 0.3;
    rig.at.y = hang.y + R(k);
  });
  rig.at.y = hang.y;
  // the cross bobs while it works
  let bob = true;
  let bobEl = 0;
  const yBase = { y: hang.y };
  const stopBob = onFrame(sc, (dt) => {
    if (!bob) return false;
    bobEl += dt;
    rig.at.y = yBase.y + (Math.floor(bobEl / 380) % 2);
    return true;
  });

  // ---- five strings: hand, hand, foot, foot, head (outside → in), the head last
  const order = [0, 4, 1, 3, 2];
  const drops: Promise<void>[] = [];
  for (let k = 0; k < order.length; k++) {
    drops.push(
      dropString(sc, rig, order[k]).then(() => {
        // a 1-px jolt in the body on every hook
        b.ny = -1;
        placeBody(b);
        sc.time.delayedCall(50, () => {
          b.ny = 0;
          placeBody(b);
        });
      }),
    );
    await wait(sc, STRING_GAP);
  }
  await Promise.all(drops);
  // hooked: the monster stops its own idle — from now on it is a puppet (pose frames of this frame)
  if (unit) b.pose = puppetPose(sc, unit.sprite);
  // ---- tension: the cross lifts, the body rises on the strings, its legs hang
  playV3('e_puppetCreak', { volume: 0.6, pitch: 1.2, pan: panAt(from.x) });
  await run(sc, 90, (t) => {
    yBase.y = hang.y - R(3 * q(t, 3));
    b.lift = R(2 * q(t, 2));
    pose(b, 0, q(t, 2) >= 1 ? 1 : 0);
    placeBody(b);
  });
  rig.strings.forEach((s) => (s.buzz = 90));
  // ---- the spiral glint: a turning spiral in each eye, a teal flash over the face
  const spirals: Phaser.GameObjects.Image[] = [];
  const eyes = eyesAt(b);
  if (unit && eyes.length) {
    for (let k = 0; k < eyes.length; k++) spirals.push(sc.add.image(0, 0, SPIRAL_KEY, 'fl').setDepth(DEPTH.FX + 9).setFlipX(unit.sprite.flipX));
    playV3('e_puppetGlint', { volume: 0.9, pan: panAt(from.x) });
    const e = eyes[0];
    void lightFlash(sc, e.x, e.y, PAL.teal4, 14, 380, { intensity: 0.9 });
    unit.sprite.setTint(PAL.teal4);
  } else if (tile) {
    // a face-down card: one star glints across its back instead (it stays hidden)
    playV3('e_puppetGlint', { volume: 0.6, pitch: 1.2, pan: panAt(from.x) });
    bg(starFlare(sc, { x: R(from.x) + 4, y: R(from.y) - 2 }, 260, GOLD_FX, 12));
  }
  const spiralTick = spirals.length
    ? onFrame(sc, (_dt, el) => {
        const es = eyesAt(b);
        if (unit && el > 66 && unit.sprite.isTinted) unit.sprite.clearTint();
        spirals.forEach((sp, k) => {
          if (!sp.active || !es[k]) return;
          // the first two frames: a star flash; then the 3 × 3 spiral turns (70 ms a quarter)
          if (el < 66) sp.setFrame('fl').setPosition(es[k].x, es[k].y);
          else sp.setFrame(`f${Math.floor((el - 66) / 70) % 4}`).setPosition(es[k].x, es[k].y);
        });
        return true;
      })
    : () => undefined;
  await wait(sc, spirals.length ? 380 : 260);
  spiralTick();
  if (unit && unit.sprite.isTinted) unit.sprite.clearTint();
  spirals.forEach((sp) => sp.destroy());
  bob = false;
  stopBob();

  // ---- three jerky hops along the lane (out to the bridge, along it, in)
  if (rig.tether) rig.tether.on = true;
  if (eqTile) eqTile.tileFlash(PAL.gold3, 260);
  const legs = route(from, to);
  let g0: XY = { ...from };
  const crossDy = hang.y - from.y;
  for (let h = 0; h < legs.length; h++) {
    const g1 = legs[h];
    const c0 = { ...rig.at };
    const want = { x: g1.x, y: g1.y + crossDy };
    const c1 = placeCross(want, CROSS_EXT, g1.y + (bodyTop(b) - bodyAnchor(b).y) - b.hover);
    const lift = HOP_LIFT[h] ?? 18;
    const dir = Math.sign(R(g1.x - g0.x)) || (h % 2 ? 1 : -1);
    // anticipation: the cross jerks ahead and up first (the strings slant), the body is yanked up in 3 steps,
    // leaning toward the pull, its legs left hanging
    playV3('e_puppetCreak', { volume: 0.75, pitch: 0.95 + h * 0.06, pan: panAt(g0.x) });
    playV3('e_puppetHopString', { volume: 0.55, pitch: [1, 1.12, 1.26][h] ?? 1, pan: panAt(g0.x) });
    await run(sc, 120, (t) => {
      const k = q(t, 3);
      rig.at.x = R(c0.x + (c1.x - c0.x) * 0.45 * k);
      rig.at.y = R(c0.y - 6 * k);
      b.lift = 2 + R((lift - 2) * k);
      pose(b, dir * (k < 0.5 ? 1 : 3), k > 0 ? 2 : 1);
      placeBody(b);
    });
    rig.strings.forEach((s) => (s.buzz = 60));
    // the travel: stop-motion steps along a short arc; at the top it hangs (legs down), then leans back
    await run(sc, 180, (t) => {
      const k = q(t, 6);
      b.ground = { x: g0.x + (g1.x - g0.x) * k, y: g0.y + (g1.y - g0.y) * k };
      b.lift = lift + R(4 * Math.sin(Math.PI * k));
      rig.at.x = R(c0.x + (c1.x - c0.x) * (0.45 + 0.55 * k));
      rig.at.y = R(c0.y - 6 + (c1.y - c0.y + 4) * k);
      const apex = k >= 0.34 && k <= 0.5;
      pose(b, apex ? 0 : k < 0.34 ? dir * 3 : -dir * 2, apex ? 3 : 2);
      placeBody(b);
      if (tile && unit) tile.setPosition(R(b.ground.x), R(b.ground.y));
    });
    // the drop: down in 2 steps, the body snaps upright, 1-px bounce
    await run(sc, 60, (t) => {
      b.lift = R(lift * (1 - q(t, 2)));
      rig.at.y = R(c1.y - 2 + 2 * t);
      pose(b, -dir, 0);
      placeBody(b);
    });
    rig.at = { ...c1 };
    b.lift = 0;
    b.ny = 1;
    pose(b, 0, 0);
    placeBody(b);
    const big = h === legs.length - 1;
    playV3('e_puppetStep', { volume: big ? 1 : 0.85, pitch: 1 - h * 0.05, pan: panAt(g1.x) });
    dust(sc, { x: R(g1.x), y: R(g1.y) }, big ? 10 : 6);
    void lightFlash(sc, g1.x, g1.y, PAL.gold2, big ? 26 : 18, 220, { intensity: big ? 0.8 : 0.5 });
    if (big) await hitStop(sc, 70);
    await wait(sc, 40);
    b.ny = 0;
    placeBody(b);
    await wait(sc, Math.max(0, HOP_MS - 120 - 180 - 60 - 40));
    g0 = { ...g1 };
  }
  b.ground = { ...to };
  placeBody(b);
  // back to the real sprite before the turn
  b.pose?.restore();
  b.pose = null;

  // ---- it turns round on the strings: a pirouette (yanked up, narrow – flip – narrow, the strings twist)
  await wait(sc, 60);
  playV3('e_puppetTurn', { volume: 0.95, pan: panAt(to.x) });
  if (unit) {
    const s = unit.sprite;
    const sx0 = s.scaleX;
    const steps: { lift: number; sx: number; twist: boolean; flip?: boolean }[] = [
      { lift: 3, sx: 1, twist: false },
      { lift: 6, sx: 0.67, twist: false },
      { lift: 7, sx: 0.34, twist: true },
      { lift: 7, sx: 0.34, twist: true, flip: true },
      { lift: 6, sx: 0.67, twist: false },
      { lift: 4, sx: 1, twist: false },
    ];
    rig.strings.forEach((st) => (st.buzz = 200));
    for (const st of steps) {
      b.lift = st.lift;
      rig.at.y = rig.at.y - (st.lift > 5 ? 0 : 0);
      if (st.flip) {
        unit.setController(ev.to, ev.toZone);
        b.hover = unit.hover;
        void lightFlash(sc, to.x, to.y - 20, PAL.gold4, 22, 200, { floorY: to.y, intensity: 0.9 });
        bg(starFlare(sc, { x: R(to.x), y: R(bodyTop(b)) + 10 }, 160, GOLD_FX, 14));
      }
      b.twist = st.twist;
      s.setScale(sx0 * st.sx, s.scaleY);
      placeBody(b);
      await wait(sc, 38);
    }
    s.setScale(sx0, s.scaleY);
    b.twist = false;
    b.lift = 0;
    placeBody(b);
    dust(sc, to, 4);
  } else await wait(sc, 90);
  // the card on the new zone (built for its new side) — a gold flash covers the swap
  const ntile = field.placeCard(ev.to, 'monster', ev.toZone, ev.uid, (ctx.stateNext.cards[ev.uid]?.cardId ?? 'stone_sentinel') as CardId, faceUp, (slotOf(ctx.stateNext, ev.uid)?.position ?? 'attack') === 'defense' ? 'side' : 'up');
  ntile.tileFlash(PAL.gold3, 300);
  if (tile && tile !== ntile) tile.destroy();
  if (unit) {
    const e = field.entryOf(ev.uid);
    if (e) {
      e.unit = unit;
      unit.tile = ntile;
    }
  } else {
    b.tile = null;
  }
  void lightFlash(sc, to.x, to.y, PAL.gold3, 26, 320, { intensity: 0.8, ring: true });
  await wait(sc, 70);

  // ---- the strings draw up; the cross shrinks big → mid → small; one string stays
  playV3('e_puppetSettle', { volume: 0.95, pan: panAt(to.x) });
  if (rig.tether) rig.tether.on = false;
  const ups = [2, 1, 3, 0, 4];
  await run(sc, 220, (t) => {
    ups.forEach((i, k) => {
      const s = rig.strings[i];
      const local = Math.max(0, Math.min(1, t * 1.6 - k * 0.15));
      if (local > 0) {
        s.star = false;
        s.drop = 1 - q(local, 5);
      }
    });
  });
  rig.stars.forEach((s) => s.setVisible(false));
  void lightFlash(sc, rig.at.x, rig.at.y, PAL.gold4, 14, 200, { intensity: 0.8 });
  crossSize(rig, 'mid');
  await wait(sc, 50);
  crossSize(rig, 'small');
  motesFall(sc, rig.at, 8, [PAL.gold4, PAL.gold3, PAL.gold2]);
  await wait(sc, 40);
  const lingerAt = { ...rig.at };
  destroyRig(rig);
  undim();
  // hand the body back to the field
  if (unit) {
    unit.lift = 0;
    unit.badge.setVisible(true);
    unit.settle();
  }
  field.sync(ctx.stateNext);
  keepLinger(sc, ev.uid, lingerString(sc, field, ev.uid, lingerAt));
}

// ================================================================ the return

/** The five strings come back down from the hanging cross and snap; the body jerks. Resolves after the cross breaks. */
async function snapAll(sc: Phaser.Scene, b: Body, crossAt: XY): Promise<void> {
  const rig = makeRig(sc, b, crossAt);
  // the small cross grows back: small → mid → big
  crossSize(rig, 'small');
  rig.light = lightPool(sc, crossAt.x, crossAt.y, { color: PAL.gold4, radius: 8, spill: null, floorY: b.ground.y, air: 0.6, airRadius: 12, intensity: 0, fadeIn: 0, anim: 'flicker' });
  rig.light.setIntensity(1, 100);
  bg(starFlare(sc, crossAt, 160, GOLD_FX, 16));
  playV3('e_puppetCross', { volume: 0.75, pitch: 1.12, pan: panAt(crossAt.x) });
  await wait(sc, 30);
  crossSize(rig, 'mid');
  await wait(sc, 30);
  crossSize(rig, 'big');
  // the centre string is already there (the lingering one); the four others shoot down fast
  rig.strings[2].drop = 1;
  rig.strings[2].star = true;
  for (const i of [0, 4, 1, 3]) {
    bg(dropString(sc, rig, i, { ms: 60, volume: 0.5, quiet: true }));
    await wait(sc, 36);
  }
  await wait(sc, 60);
  // the body jerks up against them
  b.lift = 2;
  placeBody(b);
  playV3('e_puppetCreak', { volume: 0.7, pitch: 1.3, pan: panAt(b.ground.x) });
  await wait(sc, 40);
  // five snaps, right → left, descending
  const order = [4, 3, 2, 1, 0];
  for (let k = 0; k < 5; k++) {
    const i = order[k];
    const s = rig.strings[i];
    s.cut = [0.35, 0.55, 0.45, 0.6, 0.4][k];
    rig.stars[i].setVisible(false);
    playV3('e_puppetPing', { volume: 1, pitch: Math.pow(2, PING_SEMIS[k] / 12), pan: panAt(s.b.x) });
    bg(starFlare(sc, s.b, 140, GOLD_FX, 8));
    const cutAt = { x: R(s.a.x + (s.b.x - s.a.x) * s.cut), y: R(s.a.y + (s.b.y - s.a.y) * s.cut) };
    void lightFlash(sc, cutAt.x, cutAt.y, PAL.white, 10, 160, { intensity: 0.6 });
    bg(
      run(sc, 340, (t) => {
        s.up = q(t * 1.6, 6);
        s.fall = R(48 * t * t);
      }).then(() => (s.level = 0)),
    );
    // each snap jolts the body sideways, away from the string
    b.nx = i < 2 ? 1 : i > 2 ? -1 : 0;
    b.lift = Math.max(0, 2 - Math.floor(k / 2));
    placeBody(b);
    await wait(sc, 60);
  }
  b.nx = 0;
  b.lift = 0;
  placeBody(b);
  // the cross breaks: splinters and falling gold
  await wait(sc, 30);
  playV3('e_puppetCrossBreak', { volume: 1, pan: panAt(rig.at.x) });
  crossBreak(sc, rig.at);
  void lightFlash(sc, rig.at.x, rig.at.y, PAL.gold4, 22, 260, { floorY: b.ground.y, intensity: 0.8 });
  rig.cross.setVisible(false);
  sc.time.delayedCall(320, () => destroyRig(rig));
}

async function returnScene(ctx: CCCtx): Promise<void> {
  const ev = ctx.ev;
  const sc = ctx.scene;
  const field = ctx.views.field;
  const from = zoneXY(ev.from, 'monster', ev.fromZone);
  const to = zoneXY(ev.to, 'monster', ev.toZone);
  const linger = takeLinger(ev.uid);
  const where = linger?.where?.() ?? null;
  linger?.destroy();
  const rel = field.release(ev.uid);
  const unit = rel.unit && !rel.unit.retired && rel.unit.sprite.active ? rel.unit : null;
  const tile = rel.tile && rel.tile.active ? rel.tile : null;
  if (unit) {
    unit.settle();
    unit.badge.setVisible(false);
  }
  const b = makeBody(sc, unit, tile, from);
  placeBody(b);
  const undim = badgeDimmer(sc, field, b);
  const crossAt: XY = where ? placeCross({ x: R(where.x), y: R(where.y) - 6 }, CROSS_EXT, bodyTop(b)) : hangOver(b, from);
  await snapAll(sc, b, crossAt);
  if (unit) b.pose = puppetPose(sc, unit.sprite);
  // ---- it staggers home along the lane in three uneven lurches (facing the wrong way: stumbling backwards)
  const legs = route(from, to);
  const shape = [
    { lift: 5, over: 2, lean: 2 },
    { lift: 3, over: -2, lean: -2 },
    { lift: 2, over: 1, lean: 1 },
  ];
  let g0: XY = { ...from };
  for (let n = 0; n < legs.length; n++) {
    const L = shape[n];
    const g1 = legs[n];
    const dist = Math.hypot(g1.x - g0.x, g1.y - g0.y);
    const ms = Math.max(140, Math.min(200, R(120 + dist * 0.9)));
    const dir = Math.sign(R(g1.x - g0.x)) || 1;
    playV3(n === 1 ? 'e_puppetStep' : 'e_puppetStagger', { volume: 0.85, pitch: [1, 0.9, 0.94][n], pan: panAt(b.ground.x) });
    const ga = { ...g0 };
    await run(sc, ms, (t) => {
      const e = t < 0.75 ? (t / 0.75) * (t / 0.75) : 1;
      b.ground = { x: ga.x + (g1.x - ga.x) * e, y: ga.y + (g1.y - ga.y) * e };
      b.lift = R(L.lift * Math.sin(Math.PI * Math.min(1, t / 0.75)));
      // an off-balance sideways overshoot at the end of the lurch; the body leans back (dragged, backwards)
      b.nx = t > 0.75 ? L.over : 0;
      pose(b, t < 0.75 ? -dir * Math.abs(L.lean) : dir, t < 0.4 ? 1 : 0);
      placeBody(b);
      if (tile && unit) tile.setPosition(R(b.ground.x), R(b.ground.y));
    });
    dust(sc, { x: R(b.ground.x), y: R(b.ground.y) }, 4);
    g0 = { ...g1 };
    await wait(sc, n === 0 ? 30 : 20);
  }
  b.nx = 0;
  b.ground = { ...to };
  pose(b, 0, 0);
  b.pose?.restore();
  b.pose = null;
  placeBody(b);
  // ---- home: it turns back round and shakes the spell off (the last glint leaves its eyes)
  playV3('e_puppetFree', { volume: 1, pan: panAt(to.x) });
  let spirals: Phaser.GameObjects.Image[] = [];
  let eyes0: XY[] = [];
  if (unit) {
    unit.setController(ev.to, ev.toZone);
    b.hover = unit.hover;
    const p = puppetPose(sc, unit.sprite);
    if (p) {
      eyes0 = p.eyes.map((e) => ({ x: unit.sprite.flipX ? -e.x - 1 : e.x, y: e.y }));
      p.restore();
    }
    spirals = eyes0.map(() => sc.add.image(0, 0, SPIRAL_KEY, 'f2').setDepth(DEPTH.FX + 9).setFlipX(unit.sprite.flipX));
  }
  await run(sc, 160, (t) => {
    b.nx = t < 0.9 ? (Math.floor(t * 8) % 2 ? 1 : -1) : 0;
    placeBody(b);
    const a = bodyAnchor(b);
    spirals.forEach((sp, k) => {
      const e = eyes0[k];
      sp.setPosition(a.x + e.x, a.y + e.y - R(3 * t)).setFrame(`f${(2 + Math.floor(t * 6)) % 4}`).setVisible(t < 0.6 || Math.floor(t * 10) % 2 === 0);
    });
  });
  spirals.forEach((sp) => sp.destroy());
  b.nx = 0;
  placeBody(b);
  undim();
  const cardId = ctx.stateNext.cards[ev.uid]?.cardId;
  const ntile = field.placeCard(ev.to, 'monster', ev.toZone, ev.uid, (cardId ?? 'stone_sentinel') as CardId, ev.cardId !== null, (slotOf(ctx.stateNext, ev.uid)?.position ?? 'attack') === 'defense' ? 'side' : 'up');
  if (tile && tile !== ntile) tile.destroy();
  if (unit) {
    const e = field.entryOf(ev.uid);
    if (e) {
      e.unit = unit;
      unit.tile = ntile;
    }
    unit.lift = 0;
    unit.badge.setVisible(true);
    unit.settle();
  }
  ntile.tileFlash(PAL.gold2, 220);
  field.sync(ctx.stateNext);
  await wait(sc, 20);
}

// ================================================================ no free zone: destroyed by rule

type DestroyCtx = CinematicContext<Extract<GameEvent, { type: 'destroy' }>>;

async function noRoomScene(ctx: DestroyCtx): Promise<void> {
  const ev = ctx.ev;
  const sc = ctx.scene;
  const field = ctx.views.field;
  const home = zoneXY(ev.player, 'monster', ev.zone);
  const linger = takeLinger(ev.uid);
  const where = linger?.where?.() ?? null;
  linger?.destroy();
  const unit0 = field.unitAt(ev.player, ev.zone);
  const unit = unit0 && !unit0.retired && unit0.sprite.active && unit0.sprite.visible ? unit0 : null;
  const tile = field.tileAt(ev.player, 'monster', ev.zone);
  if (unit) unit.settle();
  const b = makeBody(sc, unit, unit ? null : tile, home);
  const crossAt: XY = where ? placeCross({ x: R(where.x), y: R(where.y) - 6 }, CROSS_EXT, bodyTop(b)) : hangOver(b, home);
  await snapAll(sc, b, crossAt);
  if (unit) b.pose = puppetPose(sc, unit.sprite);
  // it lurches toward its owner's row (the first leg of the way home: onto the bridge) … and hits a wall: the
  // owner's row is full — every tile there flashes crimson, a white impact, a "tok" and a denied buzz
  const owner = ctx.owner(ev.uid);
  const homeOf = zoneXY(owner, 'monster', 0);
  const leg = route(home, homeOf)[0];
  const d = Math.hypot(leg.x - home.x, leg.y - home.y) || 1;
  const ux = (leg.x - home.x) / d;
  const uy = (leg.y - home.y) / d;
  const dir = Math.sign(ux) || 1;
  playV3('e_puppetStagger', { volume: 0.85, pan: panAt(home.x) });
  await run(sc, 150, (t) => {
    const k = q(t, 5);
    b.nx = R(ux * 14 * k);
    b.ny = R(uy * 14 * k);
    b.lift = R(5 * Math.sin(Math.PI * k * 0.5));
    pose(b, dir * 2, 1);
    placeBody(b);
  });
  // the wall: the impact point is just ahead of the body
  const hitAt = { x: R(home.x + ux * 22), y: R(home.y + uy * 22) - 14 };
  playV3('e_puppetDenied', { volume: 1, pan: panAt(hitAt.x) });
  for (let i = 0; i < 5; i++) {
    const t = field.tileAt(owner, 'monster', i);
    if (t && t.active) t.tileFlash(PAL.crim3, 260);
  }
  void lightFlash(sc, hitAt.x, hitAt.y, PAL.white, 18, 140, { floorY: home.y, intensity: 1 });
  void lightFlash(sc, homeOf.x, homeOf.y, PAL.crim3, 40, 300, { intensity: 0.8, ring: true });
  const wall = new Raster(sc, hitAt.x - 12, hitAt.y - 20, 24, 40, DEPTH.FX + 9);
  // a 1-frame white impact star, then two frames of a crimson barrier line (perpendicular to the lurch)
  wall.draw((r) => {
    r.line(hitAt.x - 6, hitAt.y, hitAt.x + 6, hitAt.y, PAL.white);
    r.line(hitAt.x, hitAt.y - 6, hitAt.x, hitAt.y + 6, PAL.white);
    r.px(hitAt.x - 1, hitAt.y - 1, PAL.white);
    r.px(hitAt.x + 1, hitAt.y + 1, PAL.white);
  });
  await hitStop(sc, 60);
  await wait(sc, 34);
  wall.draw((r) => {
    const px = -uy;
    const py = ux;
    for (let k = -14; k <= 14; k++) if (k % 3 !== 0) r.px(R(hitAt.x + px * k), R(hitAt.y + py * k * 0.6 + k * 0.2), Math.abs(k) > 10 ? PAL.crim2 : PAL.crim3);
  });
  // bounced: it falls back to its tile, staggering
  await run(sc, 160, (t) => {
    const k = 1 - q(t, 4);
    b.nx = R(ux * 14 * k - ux * 3 * Math.sin(Math.PI * t));
    b.ny = R(uy * 14 * k);
    b.lift = R(3 * Math.sin(Math.PI * t));
    pose(b, -dir * 3, 0);
    placeBody(b);
  });
  wall.destroy();
  b.nx = 0;
  b.ny = 0;
  b.lift = 0;
  pose(b, 0, 0);
  b.pose?.restore();
  b.pose = null;
  placeBody(b);
  dust(sc, home, 6);
  if (unit) unit.settle();
  await wait(sc, 60);
}

// ================================================================ registration

// The activation: the common v3 opening, the orb to the cross point, then the take (the controlChange event,
// played through the lane-E dispatcher below with the orb hint); the spent card leaves meanwhile.
registerCardHook(ID, 'activate', async (ctx: ActCtx) => {
  if (!LOOK_V3) return ctx.base();
  const ev = ctx.ev;
  const sc = ctx.scene;
  const run0 = fx.resolutionRun(ctx);
  const ti = idxOf(ctx, run0, (e) => e.type === 'target');
  const ci = ctx.findType('controlChange', (e) => e.reason === 'take' && e.sourceUid === ev.uid);
  const gi = ctx.findType('toGraveyard', (e) => e.uid === ev.uid);
  const cc = evAt(ctx, ci, 'controlChange');
  const op = await spellOpening(ctx, { uid: ev.uid, cardId: ev.cardId, player: ev.player, from: setTileOf(ctx) ? 'set' : 'hand', zone: ev.zone, hold: 200, keepCard: true, releaseFrom: 'top' });
  if (!cc) {
    await op.close();
    relax(ctx);
    await fx.playRun(ctx, run0);
    return;
  }
  if (ti >= 0) ctx.consumeAt(ti);
  // the orb goes where the cross will appear: over the victim's head (HUD-clear, the same spot the take uses)
  const field = ctx.views.field;
  const u = field.unit(cc.uid);
  const g = zoneXY(cc.from, 'monster', cc.fromZone);
  const top = u && u.sprite.visible ? spriteBox(sc, u.sprite).top : g.y - 10;
  const c = placeCross({ x: g.x, y: top - HANG }, CROSS_EXT, top);
  const point = { x: c.x, y: c.y - 8 };
  await op.release(point, { path: 'line', ms: 190, size: 2, light: false });
  const spent = wait(sc, 160).then(() => (op.leave ? op.leave(gi) : undefined));
  await ctx.play(ci, { puppetOrb: true });
  await spent;
  relax(ctx, 300);
  await fx.playRun(ctx, fx.resolutionRun(ctx));
});

registerLaneE(
  'controlChange',
  (ctx) => LOOK_V3 && ctx.ev.reason === 'take' && ctx.ev.sourceUid !== null && ctx.cardId(ctx.ev.sourceUid) === ID,
  (ctx) => takeScene(ctx),
);

registerLaneE(
  'controlChange',
  (ctx) => LOOK_V3 && ctx.ev.reason === 'return' && (ctx.ev.sourceUid === null ? borrowedByPuppet(ctx.state, ctx.ev.uid) : ctx.cardId(ctx.ev.sourceUid) === ID),
  (ctx) => returnScene(ctx),
);

// the rule destroy of a borrowed monster with no room at its owner: the snap first, then its own death
registerEvent(
  'destroy',
  async (ctx: DestroyCtx) => {
    const ev = ctx.ev;
    if (!LOOK_V3 || ev.reason !== 'rule' || ev.location !== 'monster' || ev.sourceUid !== null || !borrowedByPuppet(ctx.state, ev.uid)) return ctx.base();
    try {
      await noRoomScene(ctx);
    } catch (e) {
      console.error('[puppet_string] no-room', e);
    }
    return ctx.base();
  },
  { name: 'e:puppet_string:noRoom', priority: 5 },
);
