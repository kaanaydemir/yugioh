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
import { DEPTH, LOOK_V3, type XY, unitDepth, zoneXY } from '../../view/layout';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import type { FieldView } from '../../duel/FieldView';
import type { TileCard } from '../../view/TileCard';
import { Sparks as PxSparks } from '../../vfx/combat';
import { Raster, onFrame, run, spriteBox } from '../../vfx/setpieces';
import { wait } from '../../vfx/core';
import { panAt, play as playV3 } from '../_v3/sound';
import { fx, registerCardHook, registerEvent, type CinematicContext } from '../api';
import { registerLaneE, type LaneECtx } from '../b2e/dispatch';
import { GOLD_FX, bg, evAt, idxOf, lightFlash, lightPool, relax, setTileOf, spellOpening, starFlare, type ActCtx, type LightHandle } from './_kit';
import {
  CROSS_HOOKS,
  CROSS_KEY,
  CROSS_O,
  CROSS_SMALL_KEY,
  CROSS_S_O,
  SPIRAL_KEY,
  STAR_KEY,
  drawString,
  newString,
  puppetTextures,
  stringLayer,
  type StringSpec,
} from './_puppet_string_fx';
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
const HOPS = 3;
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
  /** Eye point relative to the sprite position (P1 facing). */
  eye: XY;
  flip: boolean;
}

function makeBody(sc: Phaser.Scene, unit: MonsterUnit | null, tile: TileCard | null, ground: XY): Body {
  const b: Body = { unit, tile, ground: { ...ground }, lift: 0, nx: 0, ny: 0, hover: unit ? unit.hover : 0, limbs: [], eye: { x: 0, y: 0 }, flip: unit ? unit.sprite.flipX : false };
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
    const eyeY = Math.round(top + Math.max(3, h * 0.2));
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
    // the eye: on the body's centre line (the art's core x), a step toward its facing, a head's height down
    const tp = unit.worldPoint('top');
    b.eye = { x: R(tp.x + (s.flipX ? -2 : 2) - sx), y: R(eyeY - sy) };
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
    b.eye = { x: 0, y: 0 };
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

/** The five limb points in world px, left → right on screen (string i takes the i-th: the strings never cross). */
function limbsNow(b: Body): XY[] {
  const a = bodyAnchor(b);
  const mirrored = b.flip !== (b.unit ? b.unit.sprite.flipX : false);
  const pts = b.limbs.map((l) => ({ x: a.x + (mirrored ? -l.x : l.x), y: a.y + l.y }));
  // the head stays in the middle; the four others sort by x, hands outside the feet (a marionette's fan)
  const head = pts[2];
  const rest = [pts[0], pts[1], pts[3], pts[4]].sort((p, q) => p.x - q.x);
  const [l0, l1, r1, r0] = rest;
  return [l0, l1, head, r1, r0];
}

/** A limb point in world px. */
function limbAt(b: Body, i: number): XY {
  return limbsNow(b)[i];
}

function eyeAt(b: Body): XY {
  const a = bodyAnchor(b);
  const x = b.flip !== (b.unit ? b.unit.sprite.flipX : false) ? -b.eye.x : b.eye.x;
  return { x: a.x + x, y: a.y + b.eye.y };
}

/** Top of the body (for the cross height). */
function bodyTop(b: Body): number {
  return Math.min(...b.limbs.map((l) => l.y)) + bodyAnchor(b).y;
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
  stop(): void;
}

function crossHook(r: Rig, i: number): XY {
  return { x: r.at.x + CROSS_HOOKS[i].x, y: r.at.y + CROSS_HOOKS[i].y };
}

function makeRig(sc: Phaser.Scene, b: Body, at: XY): Rig {
  puppetTextures(sc);
  const cross = sc.add.image(at.x, at.y, CROSS_KEY).setOrigin(CROSS_O.x / 35, CROSS_O.y / 19).setDepth(DEPTH.FX + 7);
  const layer = stringLayer(sc);
  const strings = [0, 1, 2, 3, 4].map(() => newString({ ...at }, { ...at }));
  const stars = [0, 1, 2, 3, 4].map(() => sc.add.image(0, 0, STAR_KEY, 's').setDepth(DEPTH.FX + 8).setVisible(false));
  const rig: Rig = { cross, at: { ...at }, strings, stars, layer, tether: null, stop: () => undefined };
  let frame = 0;
  rig.stop = onFrame(sc, (dt) => {
    if (!layer.alive) return false;
    frame++;
    cross.setPosition(R(rig.at.x), R(rig.at.y));
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
      if (show) st.setPosition(s.b.x, s.b.y);
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
  if (!o.quiet) playV3('e_puppetHook', { volume: 0.75, pan });
  // the hook bites: a flash frame, then the small star
  const st = r.stars[i];
  st.setFrame('f').setVisible(true).setPosition(s.b.x, s.b.y);
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

function lingerString(sc: Phaser.Scene, field: FieldView, uid: Uid): Linger {
  puppetTextures(sc);
  const cross = sc.add.image(0, 0, CROSS_SMALL_KEY).setOrigin(CROSS_S_O.x / 13, CROSS_S_O.y / 9).setDepth(DEPTH.FX + 7).setVisible(false);
  // a 1-px string layer: a narrow column moved with the cross (never a full-screen upload for the whole turn)
  const RW = 48;
  const RH = 180;
  const ras = new Raster(sc, 0, 0, RW, RH, DEPTH.FX + 6);
  const air = lightPool(sc, 0, 0, { color: PAL.gold3, radius: 10, air: 0.35, airRadius: 8, intensity: 0, fadeIn: 0, anim: 'breathe' });
  let el = 0;
  let cx: number | null = null;
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
    // the cross trails the body (eased, whole pixels), bobbing 1 px every 450 ms, swaying ±1 px
    const target = last.x;
    cx = cx === null ? target : cx + (target - cx) * Math.min(1, dt / 120);
    const sway = Math.floor(el / 700) % 4 === 1 ? 1 : Math.floor(el / 700) % 4 === 3 ? -1 : 0;
    const cy = Math.max(14, last.y - 34) + (Math.floor(el / 450) % 2);
    const at = { x: R(cx) + sway, y: R(cy) };
    cross.setPosition(at.x, at.y).setVisible(fadeK > 0.5).setAlpha(1);
    air.setPosition(at.x, at.y, last.y + 30).setIntensity(0.5 * fadeK, 0);
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
        r.px(x, y, PAL.white);
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

// ================================================================ the take

type CCCtx = LaneECtx<'controlChange'>;

async function takeScene(ctx: CCCtx): Promise<void> {
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
  // an equip travels with it: its card stays in the owner's row, a gold tether follows the body
  const eqSlot = ctx.state.players.flatMap((p) => p.spellTraps).find((s) => s && s.equippedTo === ev.uid) ?? null;
  const eqTile = eqSlot ? field.tileOf(eqSlot.uid) : null;

  // ---- the cross
  const top = bodyTop(b);
  const hang: XY = { x: R(from.x), y: R(Math.max(HANG_MIN, top - HANG)) };
  const rig = makeRig(sc, b, { x: hang.x, y: hang.y - 8 });
  rig.cross.setVisible(false);
  if (eqTile) rig.tether = { from: { x: R(eqTile.home.x), y: R(eqTile.home.y) }, on: false };
  const pool = lightPool(sc, from.x, from.y, { color: PAL.gold3, radius: 22, intensity: 0, fadeIn: 0, air: 0, anim: 'breathe' });
  pool.setIntensity(0.7, 300);
  const crossLight: LightHandle = lightPool(sc, hang.x, hang.y, { color: PAL.gold4, radius: 14, floorY: from.y, air: 0.55, airRadius: 12, intensity: 0, fadeIn: 0, anim: 'flicker' });
  crossLight.setIntensity(0.8, 200);
  bg(starFlare(sc, { x: hang.x, y: hang.y - 8 }, 200, GOLD_FX, 22));
  void lightFlash(sc, hang.x, hang.y - 8, PAL.gold4, 30, 300, { floorY: from.y, intensity: 0.9 });
  rig.cross.setVisible(true);
  playV3('e_puppetCross', { volume: 0.9, pan: panAt(hang.x) });
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
    drops.push(dropString(sc, rig, order[k]).then(() => {
      // a 1-px jolt in the body on every hook
      b.ny = -1;
      placeBody(b);
      sc.time.delayedCall(50, () => {
        b.ny = 0;
        placeBody(b);
      });
    }));
    await wait(sc, STRING_GAP);
  }
  await Promise.all(drops);
  // ---- tension: the cross lifts, the body rises on the strings
  playV3('e_puppetCreak', { volume: 0.5, pitch: 1.2, pan: panAt(from.x) });
  await run(sc, 90, (t) => {
    yBase.y = hang.y - R(3 * q(t, 3));
    b.lift = R(2 * q(t, 2));
    placeBody(b);
  });
  rig.strings.forEach((s) => (s.buzz = 90));
  // ---- the spiral glint in its eye
  let spiral: Phaser.GameObjects.Image | null = null;
  if (unit) {
    spiral = sc.add.image(0, 0, SPIRAL_KEY, 'f0').setDepth(DEPTH.FX + 9);
    playV3('e_puppetGlint', { volume: 0.75, pan: panAt(from.x) });
    const e = eyeAt(b);
    void lightFlash(sc, e.x, e.y, PAL.teal4, 10, 300, { intensity: 0.7 });
  } else if (tile) {
    // a face-down card: one star glints across its back instead (it stays hidden)
    playV3('e_puppetGlint', { volume: 0.55, pitch: 1.2, pan: panAt(from.x) });
    bg(starFlare(sc, { x: R(from.x) + 4, y: R(from.y) - 2 }, 260, GOLD_FX, 12));
  }
  const spiralTick = spiral
    ? onFrame(sc, (_dt, el) => {
        if (!spiral || !spiral.active) return false;
        const e = eyeAt(b);
        spiral.setPosition(e.x, e.y).setFrame(`f${Math.floor(el / 70) % 4}`);
        return true;
      })
    : () => undefined;
  await wait(sc, 260);
  spiralTick();
  if (spiral) spiral.destroy();
  bob = false;
  stopBob();

  // ---- three jerky hops
  if (rig.tether) rig.tether.on = true;
  if (eqTile) eqTile.tileFlash(PAL.gold3, 260);
  for (let h = 0; h < HOPS; h++) {
    const g0 = { x: from.x + ((to.x - from.x) * h) / HOPS, y: from.y + ((to.y - from.y) * h) / HOPS };
    const g1 = { x: from.x + ((to.x - from.x) * (h + 1)) / HOPS, y: from.y + ((to.y - from.y) * (h + 1)) / HOPS };
    const c0 = { ...rig.at };
    const c1 = { x: R(g1.x), y: R(Math.max(HANG_MIN, g1.y - (from.y - hang.y))) };
    // anticipation: the cross jerks ahead and up first (the strings slant), the body is yanked up in 3 steps
    playV3('e_puppetCreak', { volume: 0.7, pitch: 0.95 + h * 0.06, pan: panAt(g0.x) });
    playV3('e_puppetTsing', { volume: 0.28, pitch: tsingPitch((h * 2) % 5) * 2, pan: panAt(g0.x) });
    await run(sc, 120, (t) => {
      const k = q(t, 3);
      rig.at.x = R(c0.x + (c1.x - c0.x) * 0.45 * k);
      rig.at.y = R(c0.y - 6 * k);
      b.lift = 2 + R(10 * k);
      // the feet dangle: a 1-px sideways shiver
      b.nx = k > 0 ? (Math.floor(t * 6) % 2 ? 1 : -1) : 0;
      placeBody(b);
    });
    b.nx = 0;
    rig.strings.forEach((s) => (s.buzz = 60));
    // the travel: 2-frame stop-motion steps along a short arc
    await run(sc, 180, (t) => {
      const k = q(t, 6);
      b.ground = { x: g0.x + (g1.x - g0.x) * k, y: g0.y + (g1.y - g0.y) * k };
      b.lift = 12 + R(4 * Math.sin(Math.PI * k));
      rig.at.x = R(c0.x + (c1.x - c0.x) * (0.45 + 0.55 * k));
      rig.at.y = R(c0.y - 6 + 4 * k);
      placeBody(b);
      if (tile && unit) tile.setPosition(R(b.ground.x), R(b.ground.y));
    });
    // the drop: down in 2 steps, 1-px bounce
    await run(sc, 60, (t) => {
      b.lift = R(12 * (1 - q(t, 2)));
      rig.at.y = R(c1.y - 2 + 2 * t);
      placeBody(b);
    });
    b.lift = 0;
    b.ny = 1;
    placeBody(b);
    playV3('e_puppetStep', { volume: 0.85, pitch: 1 - h * 0.04, pan: panAt(g1.x) });
    dust(sc, { x: R(g1.x), y: R(g1.y) });
    void lightFlash(sc, g1.x, g1.y, PAL.gold2, 18, 220, { intensity: 0.5 });
    await wait(sc, 40);
    b.ny = 0;
    placeBody(b);
    pool.setPosition(R(g1.x), R(g1.y));
    crossLight.setPosition(rig.at.x, rig.at.y, g1.y);
    await wait(sc, Math.max(0, HOP_MS - 120 - 180 - 60 - 40));
  }
  b.ground = { ...to };
  placeBody(b);

  // ---- it turns round on the strings
  await wait(sc, 90);
  playV3('e_puppetTurn', { volume: 0.85, pan: panAt(to.x) });
  if (unit) {
    // yanked up 3 px, it flips in the air, drops back with a knock
    rig.at.y -= 3;
    b.lift = 3;
    placeBody(b);
    rig.strings.forEach((s) => (s.buzz = 80));
    await wait(sc, 60);
    unit.setController(ev.to, ev.toZone);
    b.hover = unit.hover;
    placeBody(b);
    await wait(sc, 50);
    rig.at.y += 3;
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
  await wait(sc, 110);

  // ---- the strings draw up; the cross shrinks to the small one; one string stays
  playV3('e_puppetSettle', { volume: 0.75, pan: panAt(to.x) });
  if (rig.tether) rig.tether.on = false;
  const ups = [2, 1, 3, 0, 4];
  await run(sc, 220, (t) => {
    ups.forEach((i, k) => {
      const s = rig.strings[i];
      const local = Math.max(0, Math.min(1, t * 1.6 - k * 0.15));
      if (local > 0) {
        s.star = false;
        // retract: re-anchor the string's end upward (drop shrinks)
        s.drop = 1 - q(local, 5);
      }
    });
  });
  rig.stars.forEach((s) => s.setVisible(false));
  motesFall(sc, rig.at, 8, [PAL.gold4, PAL.gold3, PAL.gold2]);
  destroyRig(rig);
  void pool.fadeOut(260);
  void crossLight.fadeOut(200);
  // hand the body back to the field
  if (unit) {
    unit.lift = 0;
    unit.badge.setVisible(true);
    unit.settle();
  }
  field.sync(ctx.stateNext);
  keepLinger(sc, ev.uid, lingerString(sc, field, ev.uid));
}

// ================================================================ the return

/** The five strings come back down from the hanging cross and snap; the body jerks. Resolves after the last snap. */
async function snapAll(sc: Phaser.Scene, b: Body, crossAt: XY): Promise<void> {
  const rig = makeRig(sc, b, crossAt);
  const flare = lightPool(sc, crossAt.x, crossAt.y, { color: PAL.gold4, radius: 12, floorY: b.ground.y, air: 0.6, airRadius: 12, intensity: 0, fadeIn: 0, anim: 'flicker' });
  flare.setIntensity(1, 120);
  bg(starFlare(sc, crossAt, 160, GOLD_FX, 16));
  playV3('e_puppetCross', { volume: 0.6, pitch: 1.12, pan: panAt(crossAt.x) });
  // the centre string is already there (the lingering one); the four others shoot down fast
  rig.strings[2].drop = 1;
  rig.strings[2].star = true;
  for (const i of [0, 4, 1, 3]) {
    bg(dropString(sc, rig, i, { ms: 60, volume: 0.45, quiet: true }));
    await wait(sc, 40);
  }
  await wait(sc, 80);
  // the body jerks up against them
  b.lift = 2;
  placeBody(b);
  playV3('e_puppetCreak', { volume: 0.6, pitch: 1.3, pan: panAt(b.ground.x) });
  await wait(sc, 50);
  // five snaps, right → left, descending
  const order = [4, 3, 2, 1, 0];
  for (let k = 0; k < 5; k++) {
    const i = order[k];
    const s = rig.strings[i];
    s.cut = [0.35, 0.55, 0.45, 0.6, 0.4][k];
    rig.stars[i].setVisible(false);
    playV3('e_puppetPing', { volume: 0.85, pitch: Math.pow(2, PING_SEMIS[k] / 12), pan: panAt(s.b.x) });
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
    await wait(sc, 72);
  }
  b.nx = 0;
  b.lift = 0;
  placeBody(b);
  // the cross breaks into falling gold
  await wait(sc, 60);
  motesFall(sc, rig.at, 14, [PAL.white, PAL.gold4, PAL.gold3, PAL.gold2]);
  void lightFlash(sc, rig.at.x, rig.at.y, PAL.gold4, 22, 260, { floorY: b.ground.y, intensity: 0.8 });
  rig.cross.setVisible(false);
  void flare.fadeOut(200);
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
  const crossAt: XY = where ? { x: R(where.x), y: R(where.y) - 6 } : { x: R(from.x), y: R(Math.max(HANG_MIN, bodyTop(b) - HANG)) };
  await snapAll(sc, b, crossAt);
  // ---- it staggers home in two uneven lurches (facing the wrong way: backwards)
  const lurches = [
    { k: 0.4, ms: 240, lift: 5, over: 2 },
    { k: 0.74, ms: 210, lift: 3, over: -2 },
    { k: 1, ms: 190, lift: 2, over: 1 },
  ];
  let k0 = 0;
  for (let n = 0; n < lurches.length; n++) {
    const L = lurches[n];
    playV3(n === 1 ? 'e_puppetStep' : 'e_puppetStagger', { volume: 0.8, pitch: [1, 0.9, 0.94][n], pan: panAt(b.ground.x) });
    await run(sc, L.ms, (t) => {
      const e = t < 0.75 ? (t / 0.75) * (t / 0.75) : 1;
      const kk = k0 + (L.k - k0) * e;
      b.ground = { x: from.x + (to.x - from.x) * kk, y: from.y + (to.y - from.y) * kk };
      b.lift = R(L.lift * Math.sin(Math.PI * Math.min(1, t / 0.75)));
      // an off-balance sideways overshoot at the end of the lurch
      b.nx = t > 0.75 ? L.over : 0;
      placeBody(b);
      if (tile && unit) tile.setPosition(R(b.ground.x), R(b.ground.y));
    });
    dust(sc, { x: R(b.ground.x), y: R(b.ground.y) }, 4);
    k0 = L.k;
    await wait(sc, n === 0 ? 50 : 30);
  }
  b.nx = 0;
  b.ground = { ...to };
  placeBody(b);
  // ---- home: it turns back round and shakes the spell off
  playV3('e_puppetFree', { volume: 0.85, pan: panAt(to.x) });
  let spiral: Phaser.GameObjects.Image | null = null;
  if (unit) {
    unit.setController(ev.to, ev.toZone);
    b.hover = unit.hover;
    spiral = sc.add.image(0, 0, SPIRAL_KEY, 'f2').setDepth(DEPTH.FX + 9);
  }
  await run(sc, 160, (t) => {
    b.nx = t < 0.9 ? (Math.floor(t * 8) % 2 ? 1 : -1) : 0;
    placeBody(b);
    if (spiral) {
      const e = eyeAt(b);
      spiral.setPosition(e.x, e.y - R(3 * t)).setFrame(`f${(2 + Math.floor(t * 6)) % 4}`).setVisible(t < 0.6 || Math.floor(t * 10) % 2 === 0);
    }
  });
  spiral?.destroy();
  b.nx = 0;
  placeBody(b);
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
  await wait(sc, 60);
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
  const crossAt: XY = where ? { x: R(where.x), y: R(where.y) - 6 } : { x: R(home.x), y: R(Math.max(HANG_MIN, bodyTop(b) - HANG)) };
  await snapAll(sc, b, crossAt);
  // it lurches toward its owner's row … and bounces off: there is no room
  const owner = ctx.owner(ev.uid);
  const dir = owner === 1 ? { x: 0.6, y: -1 } : { x: -0.6, y: 1 };
  playV3('e_puppetStagger', { volume: 0.8, pan: panAt(home.x) });
  await run(sc, 180, (t) => {
    const k = Math.sin(Math.PI * Math.min(1, t * 1.3));
    b.nx = R(dir.x * 8 * k);
    b.ny = R(dir.y * 5 * k);
    b.lift = R(4 * k);
    placeBody(b);
  });
  b.nx = 0;
  b.ny = 0;
  b.lift = 0;
  placeBody(b);
  dust(sc, home, 4);
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
  // the orb goes where the cross will appear: over the victim's head
  const field = ctx.views.field;
  const u = field.unit(cc.uid);
  const g = zoneXY(cc.from, 'monster', cc.fromZone);
  const top = u && u.sprite.visible ? spriteBox(sc, u.sprite).top : g.y - 10;
  const point = { x: R(g.x), y: R(Math.max(HANG_MIN, top - HANG)) - 8 };
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
