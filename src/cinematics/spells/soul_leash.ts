// Ruh Tasması (soul_leash) — v3 presentation (docs/v3/YENI_KARTLAR.md §7 S8; lane E). The v1 look keeps the
// generic activation and the batch-2 placeholder (src/cinematics/b2/placeholders.ts): every hook below steps
// aside without ?look=v3. No strings, no hops, no cross (that is Kukla İpi): a COLLAR, a CHAIN, and the monster's
// own SHADOW walking ahead of its body.
//
// BEAT LIST — the take (scene ms after the common opening; ×1.35 in game time with the v3 tempo):
//   0      common v3 spell opening (spells/_kit): the card leaves the hand for its owner's side (or a set card
//          stands up on its tile), "RUH TASMASI" plate, a short hover (~0.55 s)
//   ~550   LAND: the equip flies on whole pixels to its spell zone and lies down — e_leashLand (leather slap +
//          links), a void light on the zone (mark `land`)
//   +0     THROW (180): a CHAIN of real links (6×5 gold face-on ovals, purple side-on links between them, it
//          sags and sways a pixel; clipped behind every other unit and stat plate) shoots out of the card along a
//          sagging arc to the victim's neck, a 5×4 gold hook ring at its tip — e_leashThrow (a leather strap whip: air, a thin high link run, the strap cracks)
//   +180   WEAVE (300): the leather collar (3 px of void4 / void3 / void2 leather between ink lines, gold studs
//          every 3 px, a 5×4 brass buckle) wraps round the neck in 16 steps, clockwise from the front, led by a
//          gold needle pixel with a gold2 rim on the band's top edge; on closing the whole band flashes gold4,
//          then the buckle goes half → shut (one white frame) — e_leashWeave (groan, 4 ticks, click); the body jolts 1 px
//   +540   GRIP (60): the body goes still (its animation stops: the soul is held), one void rim frame
//   +600   TEAR (280): the SHADOW peels out from BEHIND the body (drawn under it, 2 px out on the first frame,
//          then 3 5 7 10 12 14 16) toward the route's first step — the body stays in full view — with a stride
//          shear, void sparks off the seam; the collar goes with the shadow (it is the soul that is leashed) —
//          e_leashTear (soft rip + "hoo"); the arena dims a little; a dark ribbon on the floor ties the body's
//          feet to the shadow's feet (the body's own floor shadow is gone)
//   +880   THE WALK along a ROUTE (planRoute: through the free lane round the other units, pulled straight
//          where clean; every other unit's body AND stat plate is an obstacle): the shadow strides ahead in 3–6
//          steps (≤220 each — the walk is capped at ~1 s, long routes take quicker steps; a sheared stride pose, a 1-px rise, a
//          void footprint that fades on every footfall) — e_leashShadowStep; it stays behind its body until it
//          has stepped clear, then sorts by its feet. ONE BEAT behind, the body follows in heavy dull steps
//          (stepped 3-frame moves, a 1-px drop and 1-px lean forward on every footfall, dust, frozen pose) —
//          e_leashBodyStep on the off-beats (pat-THUD-pat-THUD); the chain from the card holds the collar
//   end    the shadow stands on the new zone and TURNS to face its new side (one void4 frame) — e_leashTurn
//   +120   MERGE: the body walks into its shadow: void frame, the shadow is gone, the collar is back on the body
//          with its buckle OPEN, the body turns, its animation comes back — e_leashMerge
//   +80    LOCK: the band flashes gold4 → white, the buckle swings half → KLAK (white frame), the collar
//          squashes 1 px, the chain snaps taut (its last 4 links flash white toward the card), a 110 ms hit stop
//          holds the white frame, then a 2-px body shake, a gold starburst at the buckle and a big two-ring
//          stepped gold → void floor ring (r 60) — e_leashLock (strap thwack + thump + a small brass clank +
//          the kla-k latch); the new tile flashes, the light comes back up
//   +200   BOND: the chain drops and becomes the thin bond — hanging from the BACK of the collar behind the body,
//          then lying on the floor, swinging round the body's back side (clear of its stat plate) to the card —
//          and a white light runs up it into the collar — e_leashBond
//   done.  For as long as the leash stays: the collar on the neck, the thin LIGHT bond (a lit gold3 / void4 core
//          over a void3 underline, a white-gold bead running up it every 1.5 s): a 3-px stub leaves the buckle in
//          front of the neck, hangs behind the body, then lies on the floor turning out IN FRONT of the feet
//          toward the card's side, so it reads for both players; a faint light at the collar. The generic equip aura is muted while the leash is the only
//          equip (it would hang a sword and a waist ring on the leashed monster).
//
// THE OPPONENT'S DRAW PHASE (lpGain from the leash, a card hook; the beats overlap — no lull): the bond beats twice (2 px leaf3 / leaf4 with
//   a leaf2 halo, leaf light pools at the collar and the card on each beat), a 6-px green run goes from the card
//   along the floor and up into the collar, the collar flashes leaf4 — e_leashPulse; a green orb leaves the collar on an arc to the
//   owner's LP panel — e_leashGift; on arrival the v3 LP gain (+1000) plays (fx.presentHeal).
//
// THE RETURN (the leash left the field: controlChange 'return', sourceUid null — claimed by the borrowed slot's
//   byUid): the buckle springs open, the collar falls in pieces (motes) — e_leashSnap; the freed shadow peels off
//   and runs home ahead in two quick glides — e_leashHome, the body follows LIVELY (its animation playing) in
//   three steps; at home the shadow turns, the body walks into it — e_leashMerge; ~1.3 s.
// No free zone at the owner (destroy, reason 'rule'): the collar falls, the shadow runs for the owner's row up to
//   its edge, every occupied tile there flashes a void4 wall, the shadow recoils 2 px, a hit stop, it is thrown
//   back into the body (a 2-px knock) — e_leashBounce; one beat's hold, then its own death plays.

import Phaser from 'phaser';
import type { CardId } from '../../data/cards';
import type { GameEvent, GameState, PlayerId, Uid } from '../../engine/types';
import { PAL } from '../../art/palette';
import { DEPTH, LANES, LOOK_V3, type XY, unitDepth, zoneXY } from '../../view/layout';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import type { FieldView } from '../../duel/FieldView';
import type { TileCard } from '../../view/TileCard';
import { Sparks as PxSparks } from '../../vfx/combat';
import { Raster, onFrame, qbez, run } from '../../vfx/setpieces';
import { hitStop, wait } from '../../vfx/core';
import { panAt, play as playV3 } from '../_v3/sound';
import { rimFlash, silhouetteOf } from '../_v3/spellfx';
import { fx, registerCardHook, registerEvent, type CinematicContext } from '../api';
import { registerLaneE, type LaneECtx } from '../b2e/dispatch';
import { bg, idxOf, lightDim, lightFlash, lightPool, relax, setTileOf, spellOpening, type ActCtx, type LightHandle } from './_kit';
import { Collar, ShadowDouble, along, drawBond, drawLeash, lockBurst, neckAt, neckOf, planRoute, routeLength, stepRing, walkerMask, type LeashLook, type Obstacle, type Neck } from './_soul_leash_fx';

const R = Math.round;
const ID: CardId = 'soul_leash';

// ---- timings (scene ms)
const T = Object.freeze({
  throw: 180,
  weave: 300,
  grip: 60,
  tear: 280,
  step: 220,
  /** The walk's time cap (scene ms for the shadow's strides): long routes take shorter steps, not more time. */
  walk: 960,
  turnWait: 40,
  lockAfterMerge: 80,
  bond: 260,
});

/** Stop-motion time: t quantised to `steps` steps. */
const q = (t: number, steps: number) => Math.min(1, Math.floor(t * steps) / steps);
const lerpXY = (a: XY, b: XY, k: number): XY => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k });

// ================================================================ who owns an event

function slotOf(s: GameState, uid: Uid) {
  for (const p of [0, 1] as PlayerId[]) {
    const ms = s.players[p].monsters;
    for (let i = 0; i < ms.length; i++) if (ms[i]?.uid === uid) return ms[i]!;
  }
  return null;
}

/** Is `uid` held by a Ruh Tasması in state `s`? */
function leashedIn(s: GameState, uid: Uid): boolean {
  const b = slotOf(s, uid)?.borrowed;
  return !!b && b.until === 'equip' && s.cards[b.byUid]?.cardId === ID;
}

// ================================================================ the lingering collar + bond

interface Linger {
  readonly uid: Uid;
  readonly leashUid: Uid;
  readonly neck: Neck;
  destroy(): void;
  /** The Draw Phase heartbeat: the bond beats, green light runs down it into the collar. Resolves there. */
  pulse(): Promise<XY | null>;
  /** The take's last beat: a white light runs up the new bond into the collar. */
  bondIn(): Promise<void>;
  /** The collar's world point now (null: hidden). */
  collarAt(): XY | null;
  /** Its wearer is destroyed: the collar snaps off, the bond goes dark from the collar to the card, the card dims. */
  die(): Promise<void>;
}

/** By monster uid. Not ctx.keep: it must outlive many batches. Cleared on scene shutdown (one listener per scene). */
const LINGER = new Map<Uid, Linger>();
const SHUTDOWN_HOOKED = new WeakSet<Phaser.Scene>();
function keepLinger(sc: Phaser.Scene, l: Linger): void {
  const old = LINGER.get(l.uid);
  if (old && old !== l) old.destroy();
  LINGER.set(l.uid, l);
  if (SHUTDOWN_HOOKED.has(sc)) return;
  SHUTDOWN_HOOKED.add(sc);
  sc.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    SHUTDOWN_HOOKED.delete(sc);
    for (const h of [...LINGER.values()]) h.destroy();
    LINGER.clear();
  });
}
function takeLinger(uid: Uid): Linger | null {
  const l = LINGER.get(uid) ?? null;
  LINGER.delete(uid);
  return l;
}
function lingerOfLeash(leashUid: Uid): Linger | null {
  for (const l of LINGER.values()) if (l.leashUid === leashUid) return l;
  return null;
}

/**
 * The generic equip aura (Ejder Kılıcı's floating sword + waist ring, FieldView.sync) is off-design for the
 * leash: while the leash is the monster's only equip, its aura slot holds this no-op so the sync never makes one.
 */
const NO_AURA = { destroy: () => undefined };
function onlyLeashEquips(field: FieldView, uid: Uid): boolean {
  const st = (field as unknown as { lastState?: GameState | null }).lastState;
  if (!st) return true;
  let any = false;
  for (const pl of st.players)
    for (const c of pl.spellTraps) {
      if (!c || c.equippedTo !== uid) continue;
      if (st.cards[c.uid]?.cardId !== ID) return false;
      any = true;
    }
  return any;
}
function muteEquipAura(field: FieldView, u: MonsterUnit): void {
  if (u.aura('equip') === NO_AURA) return;
  if (onlyLeashEquips(field, u.uid)) u.setAura('equip', NO_AURA);
}

function lingerBond(sc: Phaser.Scene, field: FieldView, uid: Uid, leashUid: Uid, neck: Neck): Linger {
  const collar = new Collar(sc, neck.rx, neck.ry);
  collar.look = { prog: 1, buckle: 'on', fall: 0, glint: -1 };
  const RW = 300;
  const RH = 180;
  // the hanging part (behind the wearer) and the part lying on the floor (under every unit)
  const back = new Raster(sc, 0, 0, RW, RH, DEPTH.UNIT);
  const floor = new Raster(sc, 0, 0, RW, RH, DEPTH.SHADOW + 2);
  const front = new Raster(sc, 0, 0, RW, RH, DEPTH.UNIT);
  const clip = othersClip(field, uid);
  const glow: LightHandle = lightPool(sc, 0, 0, { color: PAL.void3, radius: 10, air: 0.3, airRadius: 7, intensity: 0, fadeIn: 0, anim: 'breathe' });
  let alive = true;
  let el = 0;
  let fadeK = 1;
  let gone = 0;
  const look: LeashLook = { mode: 'bond', sag: 1, prog: 1, pulse: -1, phase: 0 };
  let collarPt: XY | null = null;
  let cardPt: XY | null = null;
  let dying = false;
  let collarHidden = false;
  let fadeAll = 1;
  let lastSprite: { x: number; y: number; flipX: boolean; depth: number; hover: number } | null = null;
  const stop = onFrame(sc, (dt) => {
    if (!alive) return false;
    el += dt;
    look.phase = el;
    const u = field.unit(uid);
    const t = field.tileOf(leashUid);
    if (dying) {
      // the wearer is going: draw the dying bond from its last place (no collar)
      collar.draw({ x: -50, y: -50 }, 0, false);
      const ls = lastSprite;
      if (!ls || !cardPt) return true;
      const c = neckAt(neck, ls.x, ls.y, ls.flipX);
      const hook = collar.backPoint(c, ls.flipX);
      const ground = { x: R(ls.x), y: R(ls.y + ls.hover) };
      back.img.setVisible(false);
      front.img.setVisible(fadeAll > 0.5 && !collarHidden);
      floor.img.setVisible(fadeAll > 0.3);
      back.begin();
      floor.begin();
      front.begin();
      drawBond(back, floor, hook, ground, cardPt, look, ls.flipX, undefined, undefined, R(ls.x), clip);
      back.end();
      floor.end();
      front.end();
      glow.setIntensity(0, 0);
      return true;
    }
    const show = !!u && !u.retired && u.sprite.active && u.sprite.visible && u.sprite.alpha > 0.05 && !!t && t.active;
    if (show && u) lastSprite = { x: u.sprite.x, y: u.sprite.y, flipX: u.sprite.flipX, depth: u.sprite.depth, hover: u.hover + u.lift };
    if (!show) {
      gone += dt;
      if (gone > 80) fadeK = Math.max(0, fadeK - dt / 200);
    } else {
      gone = 0;
      fadeK = 1;
    }
    if (fadeK <= 0) {
      destroy();
      return false;
    }
    if (!u || !u.sprite.active || !t || !t.active) {
      back.draw(() => undefined);
      floor.draw(() => undefined);
      front.draw(() => undefined);
      collar.draw({ x: -50, y: -50 }, 0, false);
      return true;
    }
    if (show) muteEquipAura(field, u);
    const s = u.sprite;
    const c = neckAt(neck, s.x, s.y, s.flipX);
    collarPt = c;
    const vis = show && fadeK > 0.5;
    collar.draw(c, s.depth, vis);
    const card = { x: R(t.x), y: R(t.y) };
    cardPt = card;
    const hook = collar.backPoint(c, s.flipX);
    const ground = { x: R(s.x), y: R(s.y + u.hover + u.lift) };
    const x0 = Math.min(card.x, hook.x) - 60;
    const y0 = Math.min(card.y, hook.y) - 12;
    back.moveTo(x0, y0);
    floor.moveTo(x0, y0);
    front.moveTo(x0, y0);
    back.img.setDepth(s.depth - 0.5).setVisible(vis);
    front.img.setDepth(s.depth + 0.3).setVisible(vis);
    floor.img.setVisible(vis);
    const sil = silhouetteOf(s);
    // the hanging column: from the back of the collar toward the body's middle until the column is inside the
    // wearer's own silhouette (hidden behind it: no second pole beside the body)
    let vx = hook.x;
    if (sil) {
      const y0c = R(hook.y) + 2;
      const y1c = R(ground.y) - 3;
      const inside = (x: number) => {
        let k = 0;
        let n = 0;
        for (let y = y0c; y <= y1c; y += 2) {
          n++;
          if (sil.has(x, y)) k++;
        }
        return n === 0 || k / n >= 0.75;
      };
      const dir = Math.sign(R(s.x) - hook.x) || (s.flipX ? -1 : 1);
      for (let i = 0; i <= 24; i++) {
        if (inside(hook.x + dir * i)) {
          vx = hook.x + dir * i;
          break;
        }
        if (i === 24) vx = R(s.x);
      }
    }
    back.begin();
    floor.begin();
    front.begin();
    if (vis) drawBond(back, floor, hook, ground, card, look, s.flipX, front, collar.ring(c), vx, clip);
    back.end();
    floor.end();
    front.end();
    glow.setPosition(c.x, c.y, ground.y);
    glow.setIntensity(show ? 0.45 : 0, 0);
    return true;
  });
  const destroy = () => {
    if (!alive) return;
    alive = false;
    if (LINGER.get(uid) === handle) LINGER.delete(uid);
    stop();
    back.destroy();
    floor.destroy();
    front.destroy();
    collar.destroy();
    void glow.fadeOut(120);
    const u = field.unit(uid);
    if (u && u.aura('equip') === NO_AURA) u.setAura('equip', null);
  };
  const handle: Linger = {
    uid,
    leashUid,
    neck,
    destroy,
    collarAt: () => collarPt,
    async die() {
      // hold the bond on screen whatever the wearer does now (its death may hide it at once)
      dying = true;
      const cp = collarPt;
      playV3('e_leashSnap', { volume: 0.6, pitch: 0.85, pan: cp ? panAt(cp.x) : 0 });
      if (cp) {
        void lightFlash(sc, cp.x, cp.y, PAL.void3, 12, 200, { intensity: 0.6 });
        motesFall(sc, { x: cp.x, y: cp.y + 3 }, 8, [PAL.gold3, PAL.void3, PAL.void2, PAL.void1]);
      }
      collarHidden = true;
      await run(sc, 300, (k) => (look.dark = q(k, 12)));
      const t = field.tileOf(leashUid);
      if (t && t.active) t.tileFlash(PAL.void1, 320);
      if (cardPt) void lightFlash(sc, cardPt.x, cardPt.y, PAL.void2, 16, 260, { intensity: 0.6 });
      await run(sc, 160, (k) => (fadeAll = 1 - k));
      destroy();
    },
    async bondIn() {
      // the chain has become the bond: a white light runs up it from the card into the collar
      look.pulseColor = PAL.void4;
      look.pulseHead = PAL.white;
      await run(sc, 300, (k) => (look.pulse = q(k, 14)));
      look.pulse = -1;
      look.pulseColor = undefined;
      look.pulseHead = undefined;
      collar.look.glint = 0;
      bg(run(sc, 200, (k) => (collar.look.glint = k)).then(() => (collar.look.glint = -1)));
    },
    async pulse() {
      // two heartbeats, equally loud: on each the whole bond swells to 2 px in leaf with a leaf2 halo and light
      // pools at both ends; the second beat STAYS lit while a fat green run (white head) climbs the whole bond
      // from the card into the collar; the collar flashes (one white frame, then leaf4) and the gift leaves at
      // once (no lull)
      look.hotColor = PAL.leaf3;
      look.hotLight = PAL.leaf4;
      look.hotHalo = PAL.leaf2;
      const beat = () => {
        look.hot = true;
        const cp = collarPt;
        if (cp) void lightFlash(sc, cp.x, cp.y, PAL.leaf3, 16, 240, { intensity: 0.8 });
        if (cardPt) void lightFlash(sc, cardPt.x, cardPt.y, PAL.leaf3, 20, 240, { intensity: 0.85 });
        collar.look.tint = PAL.leaf3;
      };
      beat();
      await wait(sc, 100);
      look.hot = false;
      collar.look.tint = undefined;
      await wait(sc, 70);
      beat();
      // the green runs from the card along the floor, up behind the body, into the collar
      look.pulseColor = PAL.leaf3;
      look.pulseHead = PAL.white;
      await run(sc, 240, (k) => {
        look.pulse = q(k, 16);
        if (k > 0.35) look.hot = false;
      });
      look.hot = false;
      look.pulse = -1;
      look.pulseColor = undefined;
      look.pulseHead = undefined;
      look.hotColor = look.hotLight = look.hotHalo = undefined;
      // the collar flashes on arrival: a white core frame, then leaf4, and a leaf halo round the band
      collar.look.bandFlash = PAL.white;
      collar.look.halo = PAL.leaf4;
      const cp = collarPt;
      if (cp) void lightFlash(sc, cp.x, cp.y, PAL.leaf4, 18, 260, { intensity: 1 });
      sc.time.delayedCall(35, () => {
        collar.look.bandFlash = undefined;
        collar.look.tint = PAL.leaf4;
        collar.look.halo = PAL.leaf3;
      });
      sc.time.delayedCall(110, () => {
        collar.look.tint = undefined;
        collar.look.halo = undefined;
      });
      collar.look.glint = 0;
      bg(run(sc, 200, (k) => (collar.look.glint = k)).then(() => (collar.look.glint = -1)));
      return collarPt;
    },
  };
  return handle;
}

// ================================================================ the scene rig (collar + chain + floor ribbon)

/** One floor shadow ellipse size for a sprite (from its silhouette width). */
function footRx(s: Phaser.GameObjects.Sprite): number {
  const sil = silhouetteOf(s);
  return sil ? Math.max(6, Math.min(14, R((sil.right - sil.left) * 0.32))) : 8;
}

interface Body {
  unit: MonsterUnit;
  tile: TileCard | null;
  ground: XY;
  /** Extra y (px, + = down: the dull step's drop). */
  ny: number;
  /** Extra x (px: the heavy step's 1-px lean forward). */
  nx?: number;
}

function placeBody(b: Body): void {
  const s = b.unit.sprite;
  if (!s.active) return;
  s.setPosition(R(b.ground.x + (b.nx ?? 0)), R(b.ground.y - b.unit.hover + b.ny));
  s.setDepth(unitDepth(R(b.ground.y)));
  if (b.tile && b.tile.active) b.tile.setPosition(R(b.ground.x), R(b.ground.y));
}

/** Hide a unit's own drop shadow for as long as `on()` says (after its update has placed it). */
function hideUnitShadow(sc: Phaser.Scene, u: MonsterUnit, on: () => boolean): () => void {
  const h = () => {
    if (!on()) {
      sc.events.off(Phaser.Scenes.Events.POST_UPDATE, h);
      return;
    }
    if (u.shadow.active) u.shadow.setVisible(false);
  };
  sc.events.on(Phaser.Scenes.Events.POST_UPDATE, h);
  h();
  return () => sc.events.off(Phaser.Scenes.Events.POST_UPDATE, h);
}

/** Void sparks off a seam / a footfall (seeded by position: no Math.random in what repeats). */
function voidPuff(sc: Phaser.Scene, at: XY, n: number, up = 14, colors: readonly number[] = [PAL.void4, PAL.void3, PAL.void2, PAL.void1]): void {
  const sp = new PxSparks(sc, unitDepth(at.y) + 2);
  for (let i = 0; i < n; i++) {
    const side = i % 2 ? 1 : -1;
    sp.add({ x: R(at.x + side * (1 + (i % 3) * 2)), y: R(at.y - (i % 2)), vx: side * (6 + (i % 4) * 5), vy: -up - (i % 3) * 6, drag: 2.5, life: 300 + (i % 4) * 50, colors, shape: 'px', fadeAt: 0.6 });
  }
  sp.release();
}

function dust(sc: Phaser.Scene, at: XY, n = 6): void {
  const sp = new PxSparks(sc, unitDepth(at.y) + 1);
  for (let i = 0; i < n; i++) {
    const side = i % 2 ? 1 : -1;
    sp.add({ x: at.x + side * (2 + (i % 3) * 3), y: at.y, vx: side * (10 + (i % 3) * 7), vy: -6 - (i % 2) * 5, ay: 50, drag: 2.4, life: 240 + (i % 3) * 40, colors: [PAL.stone3, PAL.stone2, PAL.stone1], shape: 'px', fadeAt: 0.6 });
  }
  sp.release();
}

function motesFall(sc: Phaser.Scene, at: XY, n: number, colors: readonly number[]): void {
  const sp = new PxSparks(sc, DEPTH.FX + 8);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    sp.add({ x: R(at.x + Math.cos(a) * (2 + (i % 3) * 2)), y: R(at.y + Math.sin(a) * 2), vx: Math.cos(a) * 18, vy: -12 + (i % 3) * 6, ay: 80, drag: 1.5, life: 380 + (i % 5) * 50, colors, shape: i % 5 === 0 ? 'plus' : 'px', fadeAt: 0.55 });
  }
  sp.release();
}

/** The take's moving parts, drawn every frame from one state. */
interface Rig {
  collar: Collar;
  /** Who wears the collar now. */
  wearer: 'body' | 'shadow' | 'none';
  shadow: ShadowDouble | null;
  /** The chain (null: none). */
  leash: LeashLook | null;
  leashFrom: XY;
  /** The floor ribbon from the body's feet to the shadow's feet. */
  ribbon: boolean;
  footRx: number;
  /** The throw's flying tip goes here (the neck) before the collar exists. */
  leashTarget?: XY;
  stop(): void;
  collarPoint(): XY | null;
}

function makeRig(sc: Phaser.Scene, b: Body, neck: Neck, leashFrom: XY, area: XY[], clip?: (x: number, y: number) => boolean): Rig {
  const collar = new Collar(sc, neck.rx, neck.ry);
  const xs = area.map((p) => p.x);
  const ys = area.map((p) => p.y);
  const x0 = Math.min(...xs) - 40;
  const y0 = Math.min(...ys) - 110;
  const x1 = Math.max(...xs) + 40;
  const y1 = Math.max(...ys) + 20;
  const chain = new Raster(sc, x0, y0, x1 - x0, y1 - y0, DEPTH.FX + 4);
  const floor = new Raster(sc, x0, Math.min(...ys) - 20, x1 - x0, y1 - Math.min(...ys) + 20, DEPTH.SHADOW + 1);
  floor.img.setAlpha(0.6);
  const rig: Rig = {
    collar,
    wearer: 'none',
    shadow: null,
    leash: null,
    leashFrom,
    ribbon: false,
    footRx: footRx(b.unit.sprite),
    stop: () => undefined,
    collarPoint: () => null,
  };
  const shadowFlip = (sh: ShadowDouble) => (sh.turned ? !neck.flip : neck.flip);
  rig.collarPoint = () => {
    if (rig.wearer === 'shadow' && rig.shadow) return neckAt(neck, rig.shadow.anchor.x, rig.shadow.anchor.y, shadowFlip(rig.shadow));
    if (rig.wearer === 'body') return neckAt(neck, b.unit.sprite.x, b.unit.sprite.y, b.unit.sprite.flipX);
    return null;
  };
  let el = 0;
  const stopDraw = onFrame(sc, (dt) => {
    if (!chain.alive) return false;
    el += dt;
    if (rig.leash) rig.leash.phase = el;
    const c = rig.collarPoint();
    const depth = rig.wearer === 'shadow' && rig.shadow ? rig.shadow.img.depth : b.unit.sprite.depth;
    if (c) collar.draw(c, depth, true);
    else collar.draw({ x: -60, y: -60 }, 0, false);
    chain.draw((r) => {
      if (!rig.leash) return;
      const end = c ? collar.ring(c) : rig.leashFrom;
      drawLeash(r, rig.leashFrom, rig.leash.prog < 1 && rig.leashTarget ? rig.leashTarget : end, rig.leash, clip);
    });
    floor.draw((r) => {
      if (!rig.ribbon || !rig.shadow) return;
      const bf = { x: R(b.ground.x), y: R(b.ground.y) };
      const sf = { x: rig.shadow.anchor.x, y: rig.shadow.anchor.y + b.unit.hover };
      // the body's own floor shadow, the shadow figure's, and the dark ribbon between them
      r.ell(bf.x + 0.5, bf.y + 0.5, rig.footRx - 2, 2, PAL.ink);
      r.ell(sf.x + 0.5, sf.y + 0.5, rig.footRx, 3, PAL.ink);
      r.line(bf.x, bf.y, sf.x, sf.y, PAL.ink, 1, 3);
      r.line(bf.x, bf.y - 2, sf.x, sf.y - 2, PAL.void1);
    });
    return true;
  });
  rig.stop = () => {
    stopDraw();
    chain.destroy();
    floor.destroy();
    collar.destroy();
    rig.shadow?.destroy();
    rig.shadow = null;
  };
  return rig;
}

// ================================================================ the take

type CCCtx = LaneECtx<'controlChange'>;

/** Every other unit's screen box (for the walk's route). */
function obstaclesFor(field: FieldView, self: MonsterUnit): Obstacle[] {
  const out: Obstacle[] = [];
  for (const p of [0, 1] as PlayerId[])
    for (let i = 0; i < LANES; i++) {
      const u = field.unitAt(p, i);
      if (!u || u === self || u.retired || !u.sprite.active || !u.sprite.visible) continue;
      const sil = silhouetteOf(u.sprite);
      if (sil) out.push({ x0: sil.left, y0: sil.top, x1: sil.right + 1, y1: sil.bottom + 1, y: R(u.sprite.y + u.hover), has: (x, y) => sil.has(x, y) });
      const bb = badgeBox(u);
      if (bb) out.push({ ...bb, y: bb.y0, has: (x, y) => x >= bb.x0 && x < bb.x1 && y >= bb.y0 && y < bb.y1 });
    }
  return out;
}

/** A unit's stat plate on screen (null: hidden). */
function badgeBox(u: MonsterUnit): { x0: number; y0: number; x1: number; y1: number } | null {
  const im = u.badge.image;
  if (!im.active || !im.visible) return null;
  const bb = im.getBounds();
  return { x0: Math.floor(bb.x) - 1, y0: Math.floor(bb.y) - 1, x1: Math.ceil(bb.right) + 1, y1: Math.ceil(bb.bottom) + 1 };
}

/**
 * The chain's clip: every OTHER unit's body and stat plate (the chain passes behind them, never over a torso or a
 * plate). Silhouettes are cached per frame by silhouetteOf.
 */
function chainClip(field: FieldView, self: MonsterUnit): (x: number, y: number) => boolean {
  const others: MonsterUnit[] = [];
  for (const p of [0, 1] as PlayerId[])
    for (let i = 0; i < LANES; i++) {
      const u = field.unitAt(p, i);
      if (u && u !== self) others.push(u);
    }
  let frame = -1;
  let tests: ((x: number, y: number) => boolean)[] = [];
  return (x, y) => {
    const now = self.sprite.scene?.game.getFrame() ?? 0;
    if (now !== frame) {
      frame = now;
      tests = [];
      for (const u of others) {
        if (u.retired || !u.sprite.active || !u.sprite.visible) continue;
        const sil = silhouetteOf(u.sprite);
        if (sil) tests.push((px, py) => px >= sil.left && px <= sil.right && py >= sil.top && py <= sil.bottom && sil.has(px, py));
        const bb = badgeBox(u);
        if (bb) tests.push((px, py) => px >= bb.x0 && px < bb.x1 && py >= bb.y0 && py < bb.y1);
      }
    }
    for (const t of tests) if (t(x, y)) return true;
    return false;
  };
}

/**
 * The lingering bond's clip: every OTHER unit's body and stat plate plus a 1-px margin round them (live: units
 * come and go while the leash lasts), so the bond never shows in the gap between a neighbour's staff and robe.
 */
function othersClip(field: FieldView, selfUid: Uid): (x: number, y: number) => boolean {
  let frame = -1;
  let tests: ((x: number, y: number) => boolean)[] = [];
  return (x, y) => {
    const self = field.unit(selfUid);
    const now = self?.sprite.scene?.game.getFrame() ?? 0;
    if (now !== frame) {
      frame = now;
      tests = [];
      for (const p of [0, 1] as PlayerId[])
        for (let i = 0; i < LANES; i++) {
          const u = field.unitAt(p, i);
          if (!u || u === self || u.retired || !u.sprite.active || !u.sprite.visible) continue;
          const sil = silhouetteOf(u.sprite);
          if (sil) {
            const has = (px: number, py: number) => px >= sil.left && px <= sil.right && py >= sil.top && py <= sil.bottom && sil.has(px, py);
            tests.push((px, py) => has(px, py) || has(px - 1, py) || has(px + 1, py) || has(px, py - 1));
          }
          const bb = badgeBox(u);
          if (bb) tests.push((px, py) => px >= bb.x0 - 1 && px < bb.x1 + 1 && py >= bb.y0 - 1 && py < bb.y1 + 1);
        }
    }
    for (const t of tests) if (t(x, y)) return true;
    return false;
  };
}

/** A shadow footfall: a small void print on the floor that fades in three stepped tones. */
function footprint(sc: Phaser.Scene, at: XY): void {
  const ras = Raster.around(sc, at.x, at.y, 11, 5, DEPTH.SHADOW + 1);
  const tones = [PAL.void2, PAL.void1, PAL.ink];
  bg(
    run(sc, 420, (t) => {
      const i = Math.min(2, Math.floor(t * 3));
      ras.draw((r) => {
        if (t >= 1) return;
        r.ell(at.x + 0.5, at.y + 0.5, 3.5 - i * 0.5, 1.5, tones[i]);
      });
    }).then(() => ras.destroy()),
  );
}

async function takeScene(ctx: CCCtx): Promise<void> {
  const ev = ctx.ev;
  const sc = ctx.scene;
  const field = ctx.views.field;
  const from = zoneXY(ev.from, 'monster', ev.fromZone);
  const to = zoneXY(ev.to, 'monster', ev.toZone);
  const u0 = field.unit(ev.uid);
  if (!u0 || u0.retired || !u0.sprite.active || !u0.sprite.visible) return ctx.base();
  const leashTile = ev.sourceUid !== null ? field.tileOf(ev.sourceUid) : null;
  const A: XY = leashTile ? { x: R(leashTile.home.x), y: R(leashTile.home.y) - 1 } : { x: R(to.x), y: R(to.y) + 16 };
  // the walk's route, measured while every unit still stands where it is
  const silW = silhouetteOf(u0.sprite);
  const walkW = silW ? Math.max(10, R((silW.right - silW.left) * 0.8)) : 20;
  const mask = silW ? walkerMask(silW, R(from.x), R(from.y)) : [];
  const route = planRoute({ x: R(from.x), y: R(from.y) }, { x: R(to.x), y: R(to.y) }, obstaclesFor(field, u0), mask);
  const rel = field.release(ev.uid);
  const unit = rel.unit && !rel.unit.retired && rel.unit.sprite.active ? rel.unit : u0;
  const tile = rel.tile && rel.tile.active ? rel.tile : null;
  unit.settle();
  unit.badge.setVisible(false);
  unit.lift = 0;
  const s = unit.sprite;
  const neck = neckOf(s, ev.cardId) ?? { dx: 0, dy: -20, rx: 6, ry: 3, flip: s.flipX };
  const b: Body = { unit, tile, ground: { ...from }, ny: 0 };
  placeBody(b);
  const neck0 = neckAt(neck, s.x, s.y, s.flipX);
  const rig = makeRig(sc, b, neck, A, [A, from, to, ...route], chainClip(field, unit));

  // ---- THROW: the chain shoots from the card to the neck
  rig.leash = { mode: 'chain', sag: 12, prog: 0, pulse: -1, phase: 0, sway: true };
  rig.leashTarget = { x: neck0.x, y: neck0.y + neck.ry + 1 };
  const cardGlow = lightPool(sc, A.x, A.y, { color: PAL.void3, radius: 16, intensity: 0, fadeIn: 0, anim: 'breathe' });
  cardGlow.setIntensity(0.7, 120);
  playV3('e_leashThrow', { volume: 0.85, pan: panAt(A.x) });
  await run(sc, T.throw, (t) => {
    if (rig.leash) {
      rig.leash.prog = q(t * t * 0.3 + t * 0.7, 9);
      rig.leash.sag = R(12 - 8 * t);
    }
  });
  if (rig.leash) rig.leash.prog = 1;
  rig.leashTarget = undefined;

  // ---- WEAVE: the collar wraps round the neck
  rig.wearer = 'body';
  playV3('e_leashWeave', { volume: 0.9, pan: panAt(neck0.x) });
  void lightFlash(sc, neck0.x, neck0.y, PAL.gold3, 14, 260, { floorY: from.y, intensity: 0.6 });
  b.ny = -1;
  placeBody(b);
  sc.time.delayedCall(50, () => {
    b.ny = 0;
    placeBody(b);
  });
  const neckLight = lightPool(sc, neck0.x, neck0.y, { color: PAL.gold3, radius: 12, floorY: from.y, air: 0.5, airRadius: 9, intensity: 0, fadeIn: 0, anim: 'flicker' });
  neckLight.setIntensity(0.6, 120);
  await run(sc, T.weave, (t) => {
    rig.collar.look.prog = q(Math.min(1, t / 0.95), 16);
  });
  rig.collar.look.prog = 1;
  // the band closes: it flashes gold4 once (two frames), then the buckle snaps shut
  rig.collar.look.bandFlash = PAL.gold4;
  rig.collar.look.buckle = 'half';
  sc.time.delayedCall(50, () => {
    rig.collar.look.bandFlash = undefined;
    rig.collar.look.buckle = 'flash';
  });
  sc.time.delayedCall(100, () => (rig.collar.look.buckle = 'on'));
  void lightFlash(sc, neck0.x, neck0.y + neck.ry, PAL.gold4, 10, 200, { intensity: 0.8 });

  // ---- GRIP: the body goes still; one void frame
  await wait(sc, T.grip);
  s.anims.pause();
  bg(rimFlash(sc, s, { ramp: [PAL.void4, PAL.void3, PAL.void2], hold: 1 }));
  await wait(sc, 40);

  // ---- TEAR: the shadow peels out from BEHIND the body, sideways toward the route — the body stays in view
  const sil = silhouetteOf(s);
  playV3('e_leashTear', { volume: 0.95, pan: panAt(from.x) });
  void lightDim(sc, 0.35, 280);
  let ribbonOn = true;
  const unhide = hideUnitShadow(sc, unit, () => ribbonOn);
  if (sil) rig.shadow = new ShadowDouble(sc, s, sil);
  rig.ribbon = true;
  const sh = rig.shadow;
  const anchor0 = { x: R(s.x), y: R(s.y) };
  const r1 = route[1] ?? to;
  const tearDir = Math.abs(r1.x - from.x) >= 4 ? Math.sign(r1.x - from.x) : Math.sign(to.x - from.x) || 1;
  const tearSteps = [2, 3, 5, 7, 10, 12, 14, 16];
  let lastK = -1;
  await run(sc, T.tear, (t) => {
    const k = tearSteps[Math.min(tearSteps.length - 1, Math.floor(t * tearSteps.length))];
    if (sh) {
      sh.place({ x: anchor0.x + tearDir * k, y: anchor0.y });
      sh.img.setDepth(s.depth - 0.1);
      sh.setPose(k >= 5 && k < 12 ? 1 : 0);
    }
    if (k !== lastK) {
      // the seam: void sparks off the body's edge where the shadow comes away
      const seam = { x: R(neck0.x + tearDir * (walkW / 2 + 1)), y: R(neck0.y + 6 + (k % 3) * 5) };
      voidPuff(sc, seam, 3, 18);
    }
    if (k >= 7 && rig.wearer === 'body' && sh) {
      rig.wearer = 'shadow';
      rig.collar.look.glint = 0;
      bg(run(sc, 160, (g) => (rig.collar.look.glint = g)).then(() => (rig.collar.look.glint = -1)));
    }
    lastK = k;
  });
  if (sh) rig.wearer = 'shadow';
  void neckLight.fadeOut(200);
  const collarLight = lightPool(sc, neck0.x, neck0.y, { color: PAL.void3, radius: 10, floorY: from.y, air: 0.45, airRadius: 8, intensity: 0, fadeIn: 0, anim: 'breathe' });
  collarLight.setIntensity(0.55, 160);

  // ---- THE WALK along the route: the shadow ahead (quiet striding steps), the body one beat behind (heavy)
  const shRoute: XY[] = [{ x: from.x + tearDir * 16, y: from.y }, ...route.slice(1)];
  const N = Math.max(3, Math.min(6, R(routeLength(route) / 26)));
  const ST = Math.min(T.step, R(T.walk / N));
  // one beat behind, its footfalls on the off-beats: shadow pat at k·ST, body thud at (k + 1.5)·ST
  const bodyDelay = R(2.5 * ST - ST * 0.68);
  const total = bodyDelay + N * ST;
  const desiredFlip = ev.to === 1;
  let shStepsDone = 0;
  let bStepsDone = 0;
  let turned = false;
  let wisps = 0;
  let separated = false;
  const wispSp = new PxSparks(sc, DEPTH.FX + 2);
  await run(sc, total + T.turnWait, (_t, el) => {
    // living detail: thin void wisps rise off the shadow's head and shoulders
    if (sh && el >= wisps * 70) {
      wisps++;
      const w = sh.img.width;
      const x = R(sh.img.x + 4 + ((wisps * 37) % Math.max(1, w - 8)));
      const top = silTopAt(sh, x);
      if (top !== null) wispSp.add({ x, y: top, vx: (wisps % 3) - 1, vy: -16 - (wisps % 4) * 4, drag: 0.6, life: 420, colors: [PAL.void3, PAL.void2, PAL.void1], shape: 'px', fadeAt: 0.5 });
    }
    // the shadow: eased strides on whole pixels — a sheared stride pose and a 1-px rise mid-step
    if (sh) {
      const se = Math.min(N * ST, el);
      const i = Math.min(N - 1, Math.floor(se / ST));
      const lt = el >= N * ST ? 1 : (se - i * ST) / ST;
      const e = lt < 0.5 ? 2 * lt * lt : 1 - 2 * (1 - lt) * (1 - lt);
      const g = along(shRoute, (i + e) / N);
      const walking = el < N * ST;
      const rise = walking && lt > 0.3 && lt < 0.7 ? 1 : 0;
      // the footfall frames (the end of every stride and the first of the next): the hem kicks forward and
      // the figure leans 1 px into the step
      const fall = walking && (lt >= 0.86 || (i > 0 && lt < 0.08));
      // after the walk it does not stand still: it breathes (a 1-px bob), then sinks into its feet as the body
      // comes up behind it (stepped, a quarter of its height at most) — the merge finishes the sink
      const wait0 = N * ST + T.turnWait;
      const waitLen = Math.max(1, total + T.turnWait - wait0);
      const wk = walking ? 0 : Math.max(0, Math.min(1, (el - wait0) / waitLen));
      sh.sink = wk > 0.45 ? R(q((wk - 0.45) / 0.55, 4) * sh.img.height * 0.25) : 0;
      const bob = !walking && wk <= 0.45 && Math.floor(el / 110) % 2 === 1 ? 1 : 0;
      sh.lean = fall ? 1 : 0;
      sh.place({ x: g.x, y: g.y - unit.hover - rise + bob });
      sh.setPose(fall ? 3 : walking && lt > 0.12 && lt < 0.78 ? (i % 2 ? 2 : 1) : 0);
      // behind its body until it has stepped clear, then sorted by its feet like any unit
      if (!separated && Math.abs(g.x - b.ground.x) >= walkW * 0.95) separated = true;
      sh.img.setDepth(separated ? unitDepth(R(g.y)) + 0.1 : s.depth - 0.1);
      while (shStepsDone < N && el >= (shStepsDone + 1) * ST) {
        shStepsDone++;
        const foot = along(shRoute, shStepsDone / N);
        playV3('e_leashShadowStep', { volume: 0.9, pitch: 1 + (shStepsDone % 2) * 0.05, pan: panAt(foot.x) });
        // the print lands under the LEADING hem edge (ahead of the anchor along the facing)
        const lead = (sh.turned ? !neck.flip : neck.flip) ? -1 : 1;
        const fp = { x: R(foot.x + lead * Math.max(3, walkW * 0.3)), y: R(foot.y) };
        voidPuff(sc, fp, 4, 10, [PAL.void3, PAL.void2, PAL.void1]);
        footprint(sc, fp);
      }
      if (!turned && el >= N * ST + 30) {
        turned = true;
        if ((sh.turned ? !neck.flip : neck.flip) !== desiredFlip) {
          sh.turned = !sh.turned;
          sh.place();
        }
        bg(rimFlash(sc, sh.img, { ramp: [PAL.void4, PAL.void3, PAL.void2], hold: 1 }));
        playV3('e_leashTurn', { volume: 0.8, pan: panAt(to.x) });
      }
    }
    // the body: stepped 3-frame moves (150 ms), planted 90 ms; on every footfall a 1-px drop, a 1-px lean
    // forward and dust, then it settles back
    const be = el - bodyDelay;
    if (be >= 0) {
      const j = Math.min(N - 1, Math.floor(Math.min(be, N * ST - 1) / ST));
      const mv = R(ST * 0.68);
      const lt = be >= N * ST ? 1 : Math.min(1, (be - j * ST) / mv);
      const k = (j + q(lt, 3)) / N;
      b.ground = along(route, k);
      const planted = be - j * ST;
      const hit = planted >= mv && planted < mv + 80 && be < N * ST + 80;
      b.ny = hit && planted < mv + 50 ? 1 : 0;
      const fwd = Math.sign(along(route, Math.min(1, (j + 1) / N)).x - along(route, j / N).x);
      b.nx = hit ? fwd : 0;
      placeBody(b);
      while (bStepsDone < N && be >= bStepsDone * ST + mv) {
        bStepsDone++;
        const foot = along(route, bStepsDone / N);
        playV3('e_leashBodyStep', { volume: 0.85, pitch: 1 - bStepsDone * 0.02, pan: panAt(foot.x) });
        dust(sc, { x: R(foot.x), y: R(foot.y) }, 5);
      }
    }
    // the chain: tighter as the shadow pulls ahead, slack as it reaches the card's row
    const c = rig.collarPoint();
    if (rig.leash && c) {
      const d = Math.hypot(c.x - A.x, c.y - A.y);
      rig.leash.sag = Math.max(2, Math.min(10, R(d / 12)));
    }
    if (c) collarLight.setPosition(c.x, c.y, b.ground.y);
    cardGlow.setIntensity(0.5 + 0.2 * (Math.floor(el / 240) % 2), 0);
  });
  wispSp.release();
  b.ground = { ...to };
  b.ny = 0;
  b.nx = 0;
  placeBody(b);

  // ---- MERGE: the body walks into its shadow; the collar comes back to the body with its buckle open
  playV3('e_leashMerge', { volume: 0.9, pan: panAt(to.x) });
  if (rig.shadow) {
    const shm = rig.shadow;
    const s0 = shm.sink;
    const H = shm.img.height;
    let lastStep = -1;
    await run(sc, 120, (t) => {
      const st = Math.min(3, Math.floor(t * 4));
      shm.sink = R(s0 + (H * 0.75 - s0) * ((st + 1) / 4));
      shm.place();
      if (st !== lastStep) {
        lastStep = st;
        voidPuff(sc, { x: R(to.x + (st % 2 ? 4 : -4)), y: R(to.y) }, 2, 8, [PAL.void4, PAL.void3, PAL.void2]);
      }
    });
  } else await wait(sc, 120);
  bg(rimFlash(sc, s, { ramp: [PAL.void4, PAL.void3, PAL.void2, PAL.void1], hold: 2 }));
  rig.wearer = 'body';
  rig.collar.look.buckle = 'open';
  if (rig.shadow) {
    rig.shadow.destroy();
    rig.shadow = null;
  }
  rig.ribbon = false;
  ribbonOn = false;
  unhide();
  voidPuff(sc, { x: R(to.x), y: R(to.y) }, 8, 16);
  await wait(sc, 40);
  unit.setController(ev.to, ev.toZone);
  s.anims.resume();
  await wait(sc, 40);

  // ---- LOCK: the buckle swings shut (open → half → KLAK). The band flashes gold4 then white, the chain's last
  // four links snap taut toward the card, a hit stop holds the white frame, then the body shakes 2 px and a big
  // stepped gold ring runs out over the floor
  rig.collar.look.buckle = 'half';
  rig.collar.look.bandFlash = PAL.gold4;
  await wait(sc, T.lockAfterMerge - 40);
  const c1 = rig.collarPoint() ?? neckAt(neck, s.x, s.y, s.flipX);
  playV3('e_leashLock', { volume: 1, pan: panAt(to.x) });
  rig.collar.look.buckle = 'flash';
  rig.collar.look.bandFlash = PAL.white;
  rig.collar.rx = neck.rx + 1;
  if (rig.leash) {
    rig.leash.sag = 0;
    rig.leash.sway = false;
    rig.leash.snap = 0;
  }
  // the KLAK frame, all at once: a collar-shaped gold halo 3 px out round the band, the starburst at the buckle,
  // a void ripple starting up the chain toward the card, and the floor rings already OUT past the feet (white)
  rig.collar.look.halo = PAL.white;
  if (rig.leash) rig.leash.pulse = 1;
  bg(lockBurst(sc, rig.collar.ring(c1)));
  bg(stepRing(sc, to, { r0: 22, r1: 62, ms: 480, ramp: [PAL.white, PAL.gold4, PAL.gold3, PAL.gold2, PAL.void3, PAL.void2] }));
  bg(stepRing(sc, to, { r0: 14, r1: 36, ms: 360, ramp: [PAL.gold4, PAL.gold3, PAL.void4, PAL.void3] }));
  void lightFlash(sc, c1.x, c1.y, PAL.gold4, 34, 420, { floorY: to.y, intensity: 1 });
  void lightDim(sc, 0, 320);
  b.ny = -1;
  placeBody(b);
  await hitStop(sc, 110);
  rig.collar.rx = neck.rx;
  rig.collar.look.bandFlash = PAL.gold4;
  rig.collar.look.halo = PAL.gold4;
  sc.time.delayedCall(40, () => {
    rig.collar.look.bandFlash = undefined;
    rig.collar.look.halo = PAL.gold3;
  });
  sc.time.delayedCall(90, () => {
    rig.collar.look.buckle = 'on';
    rig.collar.look.halo = PAL.void4;
  });
  sc.time.delayedCall(140, () => (rig.collar.look.halo = undefined));
  if (rig.leash) bg(run(sc, 150, (k) => rig.leash && (rig.leash.snap = q(k, 4))));
  // the ripple runs up the chain from the collar to the card (white head, void4 body)
  if (rig.leash) {
    const lr = rig.leash;
    lr.pulseColor = PAL.void4;
    bg(
      run(sc, 220, (k) => (lr.pulse = 1 - q(k, 11))).then(() => {
        lr.pulse = -1;
        lr.pulseColor = undefined;
        void lightFlash(sc, A.x, A.y, PAL.void4, 14, 160, { intensity: 0.7 });
      }),
    );
  }
  // the 2-px shake of the locked body (the camera never moves)
  const jolt = [2, -2, 1, -1, 0];
  b.ny = 0;
  await run(sc, jolt.length * 34, (t) => {
    b.nx = jolt[Math.min(jolt.length - 1, Math.floor(t * jolt.length))];
    placeBody(b);
  });
  b.nx = 0;
  placeBody(b);
  // the card on the new zone (built for its new side)
  const ntile = field.placeCard(ev.to, 'monster', ev.toZone, ev.uid, (ctx.stateNext.cards[ev.uid]?.cardId ?? 'stone_sentinel') as CardId, true, (slotOf(ctx.stateNext, ev.uid)?.position ?? 'attack') === 'defense' ? 'side' : 'up');
  ntile.tileFlash(PAL.void3, 300);
  if (tile && tile !== ntile) tile.destroy();
  const e = field.entryOf(ev.uid);
  if (e) {
    e.unit = unit;
    unit.tile = ntile;
  }
  b.tile = null;
  await wait(sc, 80);
  if (rig.leash) rig.leash.snap = undefined;

  // ---- BOND: the chain drops off the front and becomes the thin bond — hanging behind the body, lying on the
  // floor to the card — and a white light runs up it into the collar
  if (rig.leash) rig.leash.hot = false;
  playV3('e_leashBond', { volume: 0.8, pan: panAt((A.x + to.x) / 2) });
  rig.stop();
  muteEquipAura(field, unit);
  let linger: Linger | null = null;
  if (ev.sourceUid !== null) {
    linger = lingerBond(sc, field, ev.uid, ev.sourceUid, neck);
    keepLinger(sc, linger);
  }
  if (linger) await linger.bondIn();
  else await wait(sc, T.bond);
  void lightFlash(sc, A.x, A.y, PAL.void3, 16, 220, { intensity: 0.7 });

  // ---- hand over to the field
  void collarLight.fadeOut(160);
  void cardGlow.fadeOut(220);
  unit.lift = 0;
  unit.badge.setVisible(true);
  unit.settle();
  field.sync(ctx.stateNext);
  muteEquipAura(field, unit);
}

/** The shadow figure's top edge at world column x (null: no pixel there). */
function silTopAt(sh: ShadowDouble, x: number): number | null {
  const img = sh.img;
  const tex = img.texture.getSourceImage() as HTMLCanvasElement;
  const lx = sh.turned ? R(img.x + img.width - 1 - x) : R(x - img.x);
  if (lx < 0 || lx >= img.width) return null;
  const g = tex.getContext?.('2d');
  if (!g) return null;
  const col = g.getImageData(lx, 0, 1, img.height).data;
  for (let y = 0; y < img.height; y++) if (col[y * 4 + 3] > 0) return R(img.y + y);
  return null;
}

function collarRingAt(rig: Rig, c: XY): XY {
  return rig.collar.ring(c);
}

// ================================================================ the return

/** The buckle springs open and the collar falls off the neck in pieces. Resolves when it is gone. */
async function collarFalls(sc: Phaser.Scene, u: MonsterUnit, neck: Neck): Promise<void> {
  const s = u.sprite;
  const collar = new Collar(sc, neck.rx, neck.ry);
  collar.look = { prog: 1, buckle: 'flash', fall: 0, glint: -1 };
  const at = () => neckAt(neck, s.x, s.y, s.flipX);
  collar.draw(at(), s.depth);
  playV3('e_leashSnap', { volume: 0.9, pan: panAt(s.x) });
  void lightFlash(sc, at().x, at().y, PAL.gold4, 14, 220, { intensity: 0.7 });
  await wait(sc, 50);
  collar.look.buckle = 'open';
  await run(sc, 260, (t) => {
    collar.look.fall = q(t, 5) * 7;
    collar.draw(at(), s.depth, !(t > 0.7 && Math.floor(t * 20) % 2 === 0));
  });
  motesFall(sc, { x: at().x, y: at().y + 6 }, 10, [PAL.gold4, PAL.void3, PAL.void2, PAL.void1]);
  collar.destroy();
}

async function returnScene(ctx: CCCtx): Promise<void> {
  const ev = ctx.ev;
  const sc = ctx.scene;
  const field = ctx.views.field;
  const from = zoneXY(ev.from, 'monster', ev.fromZone);
  const to = zoneXY(ev.to, 'monster', ev.toZone);
  const linger = takeLinger(ev.uid);
  linger?.destroy();
  const u0 = field.unit(ev.uid);
  if (!u0 || u0.retired || !u0.sprite.active) return ctx.base();
  const silR = silhouetteOf(u0.sprite);
  const route = planRoute({ x: R(from.x), y: R(from.y) }, { x: R(to.x), y: R(to.y) }, obstaclesFor(field, u0), silR ? walkerMask(silR, R(from.x), R(from.y)) : []);
  const rel = field.release(ev.uid);
  const unit = rel.unit && !rel.unit.retired && rel.unit.sprite.active ? rel.unit : u0;
  const tile = rel.tile && rel.tile.active ? rel.tile : null;
  unit.settle();
  unit.badge.setVisible(false);
  const s = unit.sprite;
  const neck = linger?.neck ?? neckOf(s, ctx.cardId(ev.uid)) ?? { dx: 0, dy: -20, rx: 5, ry: 2, flip: s.flipX };
  const b: Body = { unit, tile, ground: { ...from }, ny: 0 };
  placeBody(b);
  await collarFalls(sc, unit, neck);

  // the freed shadow peels off and runs home ahead; the body follows, lively
  const sil = silhouetteOf(s);
  const rig = makeRig(sc, b, neck, { x: from.x, y: from.y }, [from, to, ...route]);
  let ribbonOn = true;
  const unhide = hideUnitShadow(sc, unit, () => ribbonOn);
  if (sil) rig.shadow = new ShadowDouble(sc, s, sil);
  rig.ribbon = true;
  const sh = rig.shadow;
  playV3('e_leashTear', { volume: 0.55, pitch: 1.3, pan: panAt(from.x) });
  playV3('e_leashHome', { volume: 0.85, pan: panAt((from.x + to.x) / 2) });
  const SH_MS = 420;
  const B_DELAY = 130;
  const B_STEPS = 3;
  const B_ST = 150;
  let steps = 0;
  let turned = false;
  const desiredFlip = ev.to === 1;
  await run(sc, B_DELAY + B_STEPS * B_ST + 40, (_t, el) => {
    if (sh) {
      const k = Math.min(1, el / SH_MS);
      const e = k < 0.5 ? 2 * k * k : 1 - 2 * (1 - k) * (1 - k);
      const g = along(route, q(e, 10));
      sh.place({ x: g.x, y: g.y - unit.hover });
      sh.setPose(k > 0 && k < 1 ? (Math.floor(k * 4) % 2 ? 2 : 1) : 0);
      sh.img.setDepth(unitDepth(R(g.y)) + 0.1);
      if (!turned && el >= SH_MS) {
        turned = true;
        if ((sh.turned ? !neck.flip : neck.flip) !== desiredFlip) {
          sh.turned = !sh.turned;
          sh.place();
        }
      }
    }
    const be = el - B_DELAY;
    if (be >= 0) {
      const k = Math.min(1, be / (B_STEPS * B_ST));
      b.ground = along(route, k);
      b.ny = 0;
      placeBody(b);
      while (steps < B_STEPS && be >= (steps + 1) * B_ST) {
        steps++;
        const foot = along(route, steps / B_STEPS);
        playV3('e_leashBodyStep', { volume: 0.5, pitch: 1.25, pan: panAt(foot.x) });
        dust(sc, { x: R(foot.x), y: R(foot.y) }, 3);
      }
    }
  });
  b.ground = { ...to };
  placeBody(b);
  // home: the body walks into its shadow and turns round
  playV3('e_leashMerge', { volume: 0.6, pitch: 1.15, pan: panAt(to.x) });
  await wait(sc, 100);
  ribbonOn = false;
  unhide();
  rig.stop();
  unit.setController(ev.to, ev.toZone);
  bg(rimFlash(sc, s, { ramp: [PAL.void4, PAL.void3, PAL.void2], hold: 1 }));
  voidPuff(sc, { x: R(to.x), y: R(to.y) }, 6, 12);
  await wait(sc, 40);
  const cardId = ctx.stateNext.cards[ev.uid]?.cardId;
  const ntile = field.placeCard(ev.to, 'monster', ev.toZone, ev.uid, (cardId ?? 'stone_sentinel') as CardId, ev.cardId !== null, (slotOf(ctx.stateNext, ev.uid)?.position ?? 'attack') === 'defense' ? 'side' : 'up');
  if (tile && tile !== ntile) tile.destroy();
  const e = field.entryOf(ev.uid);
  if (e) {
    e.unit = unit;
    unit.tile = ntile;
  }
  unit.lift = 0;
  unit.badge.setVisible(true);
  unit.settle();
  ntile.tileFlash(PAL.void2, 220);
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
  linger?.destroy();
  const unit = field.unitAt(ev.player, ev.zone);
  if (!unit || unit.retired || !unit.sprite.active || !unit.sprite.visible) return;
  unit.settle();
  const s = unit.sprite;
  const neck = linger?.neck ?? neckOf(s, ctx.cardId(ev.uid)) ?? { dx: 0, dy: -20, rx: 5, ry: 2, flip: s.flipX };
  await collarFalls(sc, unit, neck);
  const sil = silhouetteOf(s);
  if (!sil) return;
  const sh = new ShadowDouble(sc, s, sil);
  const owner = ctx.owner(ev.uid);
  const a0 = { x: R(s.x), y: R(s.y) };
  // the owner's row: it runs for the nearest monster there (its zone is home's neighbour) and stops at its edge
  const ownUnits: MonsterUnit[] = [];
  for (let i = 0; i < LANES; i++) {
    const o = field.unitAt(owner, i);
    if (o && o !== unit && !o.retired && o.sprite.active) ownUnits.push(o);
  }
  let near: MonsterUnit | null = null;
  let nd = Infinity;
  for (const o of ownUnits) {
    const d = Math.hypot(o.sprite.x - a0.x, o.sprite.y - a0.y);
    if (d < nd) {
      nd = d;
      near = o;
    }
  }
  const tgt = near ? { x: near.sprite.x, y: near.sprite.y } : { x: a0.x + (owner === 1 ? 40 : -40), y: a0.y + (owner === 1 ? -25 : 25) };
  const dl = Math.max(1, Math.hypot(tgt.x - a0.x, tgt.y - a0.y));
  const dir = { x: (tgt.x - a0.x) / dl, y: (tgt.y - a0.y) / dl };
  // the run stops a body-width short of the row (the edge of the full row)
  const RUN = Math.max(24, Math.min(70, R(dl - 22)));
  playV3('e_leashHome', { volume: 0.7, pan: panAt(home.x) });
  // it runs for home in striding steps …
  await run(sc, 300, (t) => {
    const k = q(t, 9) * RUN;
    sh.place({ x: a0.x + dir.x * k, y: a0.y + dir.y * k });
    sh.setPose(t < 1 ? (Math.floor(t * 5) % 2 ? 2 : 1) : 0);
    sh.img.setDepth(unitDepth(R(a0.y + dir.y * k + unit.hover)) + 0.1);
  });
  sh.setPose(0);
  // … hits the full row: every occupied tile of the owner's row flashes void4 (a wall), a white-void impact ring
  // at the shadow's leading shoulder, the nearest monster jolts, a hit stop …
  const hit = { x: R(a0.x + dir.x * (RUN + 4)), y: R(a0.y + unit.hover + dir.y * (RUN + 4)) };
  playV3('e_leashBounce', { volume: 0.95, pan: panAt(hit.x) });
  bg(rimFlash(sc, sh.img, { ramp: [PAL.white, PAL.void4, PAL.void3], hold: 1 }));
  for (const o of ownUnits) {
    const t = o.tile;
    if (t && t.active) t.tileFlash(PAL.void4, 90);
    bg(rimFlash(sc, o.sprite, { ramp: [PAL.void4, PAL.void3], hold: 1 }));
    bg(wallBar(sc, { x: R(o.sprite.x), y: R(o.sprite.y + o.hover) }));
  }
  const shW = sh.img.width;
  const shH = sh.img.height;
  bg(impactRing(sc, { x: R(sh.img.x + shW / 2 + dir.x * shW * 0.35), y: R(sh.img.y + shH * 0.45) }));
  voidPuff(sc, { x: hit.x, y: hit.y }, 8, 16);
  if (near) {
    const ns = near.sprite;
    const x0 = ns.x;
    const jolt = [R(dir.x > 0 ? 1 : -1), 0, R(dir.x > 0 ? -1 : 1), 0];
    bg(run(sc, 4 * 34, (t) => ns.active && ns.setX(x0 + jolt[Math.min(3, Math.floor(t * 4))])).then(() => ns.active && ns.setX(x0)));
  }
  // the 2-px recoil off the wall
  sh.place({ x: a0.x + dir.x * (RUN - 2), y: a0.y + dir.y * (RUN - 2) });
  await hitStop(sc, 80);
  // … and is thrown back into the body (fast, stepped)
  await run(sc, 160, (t) => {
    const k = (1 - q(t, 6)) * (RUN - 2);
    sh.place({ x: a0.x + dir.x * k, y: a0.y + dir.y * k });
  });
  sh.destroy();
  b0Jolt(sc, s, dir);
  bg(rimFlash(sc, s, { ramp: [PAL.void4, PAL.void3, PAL.void2], hold: 1 }));
  // one beat: the soul's residue settles at its feet (a dim void flicker, a soft murmur) — then its death
  playV3('e_leashSettle', { volume: 0.8, pan: panAt(a0.x) });
  const feet = { x: R(a0.x), y: R(a0.y + unit.hover) };
  const res = Raster.around(sc, feet.x, feet.y, 30, 10, DEPTH.SHADOW + 2);
  await run(sc, 260, (t) => {
    const f = Math.floor(t * 6);
    res.draw((r) => {
      if (t >= 1) return;
      const c = [PAL.void3, PAL.void1, PAL.void2, PAL.void1, PAL.void2, PAL.void1][Math.min(5, f)];
      r.ring(feet.x + 0.5, feet.y + 0.5, 9 - Math.min(5, f), 3 - (f >> 2) * 0.5, c);
      if (f % 2 === 0) r.px(feet.x + ((f * 5) % 11) - 5, feet.y - 1 - (f % 3), PAL.void3);
    });
  });
  res.destroy();
}

/** The body takes its thrown-back shadow: a 2-px knock away from home. */
function b0Jolt(sc: Phaser.Scene, s: Phaser.GameObjects.Sprite, dir: XY): void {
  const x0 = s.x;
  const k = [R(-dir.x * 2) || -2, R(-dir.x), 0];
  bg(run(sc, 3 * 40, (t) => s.active && s.setX(x0 + k[Math.min(2, Math.floor(t * 3))])).then(() => s.active && s.setX(x0)));
}

/** A wall on an occupied tile: a void4 upright bar flash in front of the unit's feet for two frames. */
function wallBar(sc: Phaser.Scene, at: XY): Promise<void> {
  const ras = Raster.around(sc, at.x, at.y - 10, 40, 30, DEPTH.FX + 5);
  return run(sc, 2 * 45, (t) => {
    const f = Math.min(1, Math.floor(t * 2));
    ras.draw((r) => {
      if (t >= 1) return;
      const c = f === 0 ? PAL.void4 : PAL.void2;
      // a flat iso diamond rim on the tile and a few upright ticks: the full row stands closed
      r.ring(at.x + 0.5, at.y + 0.5, 14, 7, c);
      for (const dx of [-12, -6, 0, 6, 12]) r.line(at.x + dx, at.y - 2 - (Math.abs(dx) < 7 ? 1 : 0), at.x + dx, at.y - (f === 0 ? 12 : 8), c);
    });
  }).then(() => ras.destroy());
}

/** A 2-frame white → void impact ring (an upright ellipse: it hits a wall of bodies, not the floor). */
function impactRing(sc: Phaser.Scene, at: XY): Promise<void> {
  const ras = Raster.around(sc, at.x, at.y, 34, 48, DEPTH.FX + 6);
  return run(sc, 3 * 40, (t) => {
    const f = Math.min(2, Math.floor(t * 3));
    ras.draw((r) => {
      if (t >= 1) return;
      const rx = [6, 10, 13][f];
      const ry = [11, 17, 21][f];
      r.ring(at.x + 0.5, at.y + 0.5, rx, ry, [PAL.white, PAL.void4, PAL.void2][f]);
      if (f === 0) r.ring(at.x + 0.5, at.y + 0.5, rx - 2, ry - 3, PAL.void4);
    });
  }).then(() => ras.destroy());
}

// ================================================================ registration

// The activation: the common v3 opening, the card lands on its zone, then the take (the controlChange event,
// played through the lane-E dispatcher below).
registerCardHook(ID, 'activate', async (ctx: ActCtx) => {
  if (!LOOK_V3) return ctx.base();
  const ev = ctx.ev;
  const sc = ctx.scene;
  const run0 = fx.resolutionRun(ctx);
  const ti = idxOf(ctx, run0, (e) => e.type === 'target');
  const ei = idxOf(ctx, run0, (e) => e.type === 'equip' && e.spellUid === ev.uid);
  const ci = ctx.findType('controlChange', (e) => e.reason === 'take' && e.sourceUid === ev.uid);
  const op = await spellOpening(ctx, { uid: ev.uid, cardId: ev.cardId, player: ev.player, from: setTileOf(ctx) ? 'set' : 'hand', zone: ev.zone, hold: 220 });
  if (ev.zone === null || !op.landV3) {
    await op.close();
    relax(ctx);
    await fx.playRun(ctx, run0);
    return;
  }
  const at = zoneXY(ev.player, 'spellTrap', ev.zone);
  const tile = await op.landV3({
    spot: 'spellTrap',
    index: ev.zone,
    onLand: () => {
      playV3('e_leashLand', { volume: 0.9, pan: panAt(at.x) });
      void lightFlash(sc, at.x, at.y, PAL.void3, 24, 320, { intensity: 0.8, ring: true });
    },
  });
  tile.tileFlash(PAL.void3, 240);
  if (ci < 0 || ei < 0) {
    // it fizzles (the target is gone): the rule destroy of the card plays from the run
    relax(ctx);
    await fx.playRun(ctx, run0);
    return;
  }
  if (ti >= 0) ctx.consumeAt(ti);
  ctx.consumeAt(ei);
  await wait(sc, 60);
  await ctx.play(ci);
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
  (ctx) => LOOK_V3 && ctx.ev.reason === 'return' && (ctx.ev.sourceUid === null ? leashedIn(ctx.state, ctx.ev.uid) : ctx.cardId(ctx.ev.sourceUid) === ID),
  (ctx) => returnScene(ctx),
);

// the rule destroy of a leashed monster with no room at its owner: the collar falls, the shadow bounces, then its death
registerEvent(
  'destroy',
  async (ctx: DestroyCtx) => {
    const ev = ctx.ev;
    if (!LOOK_V3 || ev.reason !== 'rule' || ev.location !== 'monster' || ev.sourceUid !== null || !leashedIn(ctx.state, ev.uid)) return ctx.base();
    try {
      await noRoomScene(ctx);
    } catch (e) {
      console.error('[soul_leash] no-room', e);
    }
    return ctx.base();
  },
  { name: 'e:soul_leash:noRoom', priority: 5 },
);

// the leashed monster is destroyed (battle, an effect): the collar snaps off and the bond goes dark from the
// monster to the leash card, which dims — beside its own death, not instead of it
registerEvent(
  'destroy',
  async (ctx: DestroyCtx) => {
    const ev = ctx.ev;
    if (!LOOK_V3 || ev.location !== 'monster' || ev.reason === 'rule') return ctx.base();
    const l = takeLinger(ev.uid);
    if (l) bg(l.die());
    return ctx.base();
  },
  { name: 'e:soul_leash:dies', priority: 4 },
);

// the opponent's Draw Phase: the bond beats, green light flows to the owner's LP panel, then the v3 LP gain
registerCardHook(ID, 'lpGain', async (ctx) => {
  if (!LOOK_V3) return ctx.base();
  const ev = ctx.ev;
  const sc = ctx.scene;
  const l = ev.sourceUid !== null ? lingerOfLeash(ev.sourceUid) : null;
  playV3('e_leashPulse', { volume: 0.9 });
  let from: XY | null = l ? await l.pulse() : null;
  if (!from) {
    const t = ev.sourceUid !== null ? ctx.views.field.tileOf(ev.sourceUid) : null;
    from = t ? { x: R(t.x), y: R(t.y) - 2 } : null;
  }
  const lp = fx.lpPoint(ctx, ev.player);
  if (from) {
    playV3('e_leashGift', { volume: 0.85, pan: panAt(from.x) });
    void lightFlash(sc, from.x, from.y, PAL.leaf3, 14, 240, { intensity: 0.8 });
    const ctrl = { x: (from.x + lp.x) / 2, y: Math.min(from.y, lp.y) - 40 };
    const trail = new PxSparks(sc, DEPTH.HUD + 5);
    // one raster over the whole flight: a pulsing orb with a ring and a tapering comet tail of its last positions
    const bx0 = R(Math.min(from.x, lp.x, (from.x + lp.x) / 2) - 12);
    const by0 = R(Math.min(from.y, lp.y, Math.min(from.y, lp.y) - 40) - 12);
    const bx1 = R(Math.max(from.x, lp.x) + 12);
    const by1 = R(Math.max(from.y, lp.y) + 12);
    const orb = new Raster(sc, bx0, by0, bx1 - bx0, by1 - by0, DEPTH.HUD + 6);
    const glow = lightPool(sc, from.x, from.y, { color: PAL.leaf3, radius: 12, air: 0.7, airRadius: 9, intensity: 0.8, fadeIn: 0 });
    let lastX = from.x;
    let lastY = from.y;
    const f0 = from;
    let n = 0;
    const tail: XY[] = [];
    await run(sc, 370, (t, el) => {
      const k = t * t * 0.55 + t * 0.45;
      const p = qbez(f0, ctrl, lp, k);
      const x = R(p.x);
      const y = R(p.y);
      const beat = Math.floor(el / 80) % 2;
      if (!tail.length || tail[0].x !== x || tail[0].y !== y) {
        tail.unshift({ x, y });
        if (tail.length > 12) tail.pop();
      }
      orb.draw((r) => {
        // the tail: older points are smaller and darker (stepped, no blending)
        for (let i = tail.length - 1; i >= 1; i--) {
          const q0 = tail[i];
          const rad = i < 3 ? 3 : i < 6 ? 2 : i < 9 ? 1.5 : 1;
          r.disc(q0.x + 0.5, q0.y + 0.5, rad, i < 4 ? PAL.leaf3 : i < 8 ? PAL.leaf2 : PAL.leaf1);
          if (i < 4) r.px(q0.x, q0.y, PAL.leaf4);
        }
        // the orb: a ring that beats, a bright core, a white heart
        r.ring(x + 0.5, y + 0.5, beat ? 7 : 6, beat ? 7 : 6, beat ? PAL.leaf3 : PAL.leaf2);
        r.disc(x + 0.5, y + 0.5, 4.5, PAL.leaf1);
        r.disc(x + 0.5, y + 0.5, 3.5, PAL.leaf3);
        r.disc(x + 0.5, y + 0.5, 2, PAL.leaf4);
        r.px(x, y, PAL.white);
        r.px(x - 1, y - 1, PAL.white);
      });
      glow.setPosition(x, y, y + 20);
      if (x !== lastX || y !== lastY) {
        n++;
        trail.add({ x, y, vy: 4, life: 300, colors: [PAL.leaf4, PAL.leaf3, PAL.leaf2, PAL.leaf1], shape: n % 4 === 0 ? 'plus' : 'px', fadeAt: 0.7 });
        trail.add({ x: x + (n % 2 ? 2 : -2), y: y + 1, vx: n % 2 ? 8 : -8, vy: 10, life: 240, colors: [PAL.leaf3, PAL.leaf2, PAL.leaf1], shape: 'px', fadeAt: 0.6 });
      }
      lastX = x;
      lastY = y;
    });
    // the arrival: a leaf burst on the panel
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const sp = i % 2 ? 34 : 56;
      trail.add({ x: R(lp.x), y: R(lp.y), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6, drag: 3, life: 300, colors: [PAL.white, PAL.leaf4, PAL.leaf3, PAL.leaf2], shape: i % 3 === 0 ? 'plus' : 'px', fadeAt: 0.6 });
    }
    trail.release();
    orb.destroy();
    void lightFlash(sc, lp.x, lp.y, PAL.leaf3, 20, 260, { intensity: 0.8 });
    void glow.fadeOut(160);
  }
  await fx.presentHeal(ctx, ev);
});
