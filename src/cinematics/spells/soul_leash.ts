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
//   +0     THROW (180): a chain shoots out of the card along a sagging arc to the victim's neck, a gold ring at
//          its tip — e_leashThrow (seven links rising)
//   +180   WEAVE (300): the purple-gold leather collar wraps round the neck in 16 steps, clockwise from the
//          front; two gold studs set; the BUCKLE shuts (one white frame) — e_leashWeave (groan, 4 ticks, click);
//          the body jolts 1 px; gold light at the neck
//   +540   GRIP (60): the body goes still (its animation stops: the soul is held), one void3 frame
//   +600   TEAR (280): the SHADOW peels off the body — first it covers it (the body goes dark), then it slides
//          out toward the caster's side in stepped pixels (1 2 4 6 9), void sparks off the seam; the collar
//          goes with the shadow (it is the soul that is leashed) — e_leashTear (soft rip + "hoo"); the arena
//          dims a little; the body's floor shadow is gone: a dark ribbon on the floor ties its feet to the
//          shadow's feet
//   +880   THE WALK: the shadow glides ahead in 4 quiet steps (240 each, a 1-px rise, a void puff at every
//          footfall) — e_leashShadowStep ×4; the chain from the card holds its collar, sagging and tightening.
//          ONE BEAT behind, the body follows in 4 heavy dull steps (stepped 3-frame moves, a 1-px drop and dust on
//          every footfall, frozen pose) — e_leashBodyStep ×4 on the off-beats (pat-THUD-pat-THUD)
//   +1840  the shadow stands on the new zone and TURNS to face its new side (one void4 frame) — e_leashTurn
//   +2120  MERGE: the body walks into its shadow: void3 frame, the shadow is gone, the body turns (void4 frame),
//          its animation comes back — e_leashMerge (suck → thud on the merge frame)
//   +2200  LOCK: the collar is back on the body's neck, the buckle flashes, "klak" — e_leashLock; a stepped
//          gold → void floor ring, the new tile flashes, the light comes back up
//   +2400  BOND: the chain turns into the thin light bond: a white pulse runs down it from the collar to the
//          card, a glint goes round the collar — e_leashBond
//   ~2700  done. For as long as the leash stays: the collar on the neck, the thin bond from the collar's ring to
//          the leash card (void2 / void3 with a slow gold bead), a faint light at the collar.
//
// THE OPPONENT'S DRAW PHASE (lpGain from the leash, a card hook): the bond beats twice (hot), green light runs
//   from the card down the bond into the collar — e_leashPulse; a green orb leaves the collar on an arc to the
//   owner's LP panel — e_leashGift; on arrival the v3 LP gain (+1000) plays (fx.presentHeal).
//
// THE RETURN (the leash left the field: controlChange 'return', sourceUid null — claimed by the borrowed slot's
//   byUid): the buckle springs open, the collar falls in pieces (motes) — e_leashSnap; the freed shadow peels off
//   and runs home ahead in two quick glides — e_leashHome, the body follows LIVELY (its animation playing) in
//   three steps; at home the shadow turns, the body walks into it — e_leashMerge; ~1.3 s.
// No free zone at the owner (destroy, reason 'rule'): the collar falls, the shadow runs for home, hits the full
//   row and is thrown back into the body — e_leashBounce; then its own death plays (the chain's next handler).

import Phaser from 'phaser';
import type { CardId } from '../../data/cards';
import type { GameEvent, GameState, PlayerId, Uid } from '../../engine/types';
import { PAL } from '../../art/palette';
import { DEPTH, LOOK_V3, type XY, unitDepth, zoneXY } from '../../view/layout';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import type { FieldView } from '../../duel/FieldView';
import type { TileCard } from '../../view/TileCard';
import { Sparks as PxSparks } from '../../vfx/combat';
import { Raster, onFrame, qbez, run } from '../../vfx/setpieces';
import { wait } from '../../vfx/core';
import { panAt, play as playV3 } from '../_v3/sound';
import { rimFlash, silhouetteOf } from '../_v3/spellfx';
import { fx, registerCardHook, registerEvent, type CinematicContext } from '../api';
import { registerLaneE, type LaneECtx } from '../b2e/dispatch';
import { bg, idxOf, lightDim, lightFlash, lightPool, relax, setTileOf, spellOpening, type ActCtx, type LightHandle } from './_kit';
import { Collar, ShadowDouble, drawLeash, neckAt, neckOf, stepRing, type LeashLook, type Neck } from './_soul_leash_fx';

const R = Math.round;
const ID: CardId = 'soul_leash';

// ---- timings (scene ms)
const T = Object.freeze({
  throw: 180,
  weave: 300,
  grip: 60,
  tear: 280,
  step: 220,
  steps: 4,
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
  /** The collar's world point now (null: hidden). */
  collarAt(): XY | null;
}

/** By monster uid. Not ctx.keep: it must outlive many batches. Cleared on scene shutdown. */
const LINGER = new Map<Uid, Linger>();
function keepLinger(sc: Phaser.Scene, l: Linger): void {
  LINGER.get(l.uid)?.destroy();
  LINGER.set(l.uid, l);
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
function lingerOfLeash(leashUid: Uid): Linger | null {
  for (const l of LINGER.values()) if (l.leashUid === leashUid) return l;
  return null;
}

function lingerBond(sc: Phaser.Scene, field: FieldView, uid: Uid, leashUid: Uid, neck: Neck): Linger {
  const collar = new Collar(sc, neck.rx, neck.ry);
  collar.look = { prog: 1, buckle: 'on', fall: 0, glint: -1 };
  const RW = 220;
  const RH = 170;
  const ras = new Raster(sc, 0, 0, RW, RH, DEPTH.FX + 4);
  const glow: LightHandle = lightPool(sc, 0, 0, { color: PAL.void3, radius: 10, air: 0.3, airRadius: 7, intensity: 0, fadeIn: 0, anim: 'breathe' });
  let alive = true;
  let el = 0;
  let fadeK = 1;
  let gone = 0;
  const look: LeashLook = { mode: 'bond', sag: 3, prog: 1, pulse: -1, phase: 0 };
  let collarPt: XY | null = null;
  const stop = onFrame(sc, (dt) => {
    if (!alive) return false;
    el += dt;
    look.phase = el;
    const u = field.unit(uid);
    const t = field.tileOf(leashUid);
    const show = !!u && !u.retired && u.sprite.active && u.sprite.visible && !!t && t.active;
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
      ras.draw(() => undefined);
      collar.draw({ x: -50, y: -50 }, 0, false);
      return true;
    }
    const s = u.sprite;
    const c = neckAt(neck, s.x, s.y, s.flipX);
    collarPt = c;
    collar.draw(c, s.depth, show && fadeK > 0.5);
    const a = { x: R(t.x), y: R(t.y) - 1 };
    const b = collar.ring(c);
    ras.moveTo(Math.min(a.x, b.x) - 12, Math.min(a.y, b.y) - 12);
    ras.draw((r) => {
      if (fadeK < 0.5) return;
      drawLeash(r, a, b, look);
    });
    glow.setPosition(c.x, c.y, s.y + u.hover);
    glow.setIntensity(show ? 0.45 : 0, 0);
    return true;
  });
  const destroy = () => {
    if (!alive) return;
    alive = false;
    if (LINGER.get(uid) === handle) LINGER.delete(uid);
    stop();
    ras.destroy();
    collar.destroy();
    void glow.fadeOut(120);
  };
  const handle: Linger = {
    uid,
    leashUid,
    neck,
    destroy,
    collarAt: () => collarPt,
    async pulse() {
      // two heartbeats (hot), then the green runs down the bond from the card into the collar
      look.hot = true;
      await wait(sc, 90);
      look.hot = false;
      await wait(sc, 80);
      look.hot = true;
      await wait(sc, 90);
      look.hot = false;
      look.pulseColor = PAL.leaf4;
      await run(sc, 260, (k) => (look.pulse = q(k, 13)));
      look.pulse = -1;
      look.pulseColor = undefined;
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
}

function placeBody(b: Body): void {
  const s = b.unit.sprite;
  if (!s.active) return;
  s.setPosition(R(b.ground.x), R(b.ground.y - b.unit.hover + b.ny));
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

function makeRig(sc: Phaser.Scene, b: Body, neck: Neck, leashFrom: XY, area: XY[]): Rig {
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
  const stopDraw = onFrame(sc, () => {
    if (!chain.alive) return false;
    const c = rig.collarPoint();
    const depth = rig.wearer === 'shadow' && rig.shadow ? rig.shadow.img.depth : b.unit.sprite.depth;
    if (c) collar.draw(c, depth, true);
    else collar.draw({ x: -60, y: -60 }, 0, false);
    chain.draw((r) => {
      if (!rig.leash) return;
      const end = c ? collar.ring(c) : rig.leashFrom;
      drawLeash(r, rig.leashFrom, rig.leash.prog < 1 && rig.leashTarget ? rig.leashTarget : end, rig.leash);
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
  const rel = field.release(ev.uid);
  const unit = rel.unit && !rel.unit.retired && rel.unit.sprite.active ? rel.unit : u0;
  const tile = rel.tile && rel.tile.active ? rel.tile : null;
  unit.settle();
  unit.badge.setVisible(false);
  unit.lift = 0;
  const s = unit.sprite;
  const neck = neckOf(s, ev.cardId) ?? { dx: 0, dy: -20, rx: 5, ry: 2, flip: s.flipX };
  const b: Body = { unit, tile, ground: { ...from }, ny: 0 };
  placeBody(b);
  const neck0 = neckAt(neck, s.x, s.y, s.flipX);
  const rig = makeRig(sc, b, neck, A, [A, from, to]);
  const dir = { x: to.x - from.x, y: to.y - from.y };
  const dlen = Math.max(1, Math.hypot(dir.x, dir.y));
  const ux = { x: dir.x / dlen, y: dir.y / dlen };

  // ---- THROW: the chain shoots from the card to the neck
  rig.leash = { mode: 'chain', sag: 7, prog: 0, pulse: -1, phase: 0 };
  rig.leashTarget = { x: neck0.x, y: neck0.y + neck.ry + 1 };
  const cardGlow = lightPool(sc, A.x, A.y, { color: PAL.void3, radius: 16, intensity: 0, fadeIn: 0, anim: 'breathe' });
  cardGlow.setIntensity(0.7, 120);
  playV3('e_leashThrow', { volume: 0.85, pan: panAt(A.x) });
  await run(sc, T.throw, (t) => {
    if (rig.leash) {
      rig.leash.prog = q(t * t * 0.3 + t * 0.7, 9);
      rig.leash.sag = R(7 - 4 * t);
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
  rig.collar.look.buckle = 'flash';
  sc.time.delayedCall(50, () => (rig.collar.look.buckle = 'on'));
  void lightFlash(sc, neck0.x, neck0.y + neck.ry, PAL.gold4, 10, 200, { intensity: 0.8 });

  // ---- GRIP: the body goes still; one void frame
  await wait(sc, T.grip);
  s.anims.pause();
  bg(rimFlash(sc, s, { ramp: [PAL.white, PAL.void4, PAL.void3, PAL.void2], hold: 2 }));
  await wait(sc, 40);

  // ---- TEAR: the shadow peels off the body toward the caster's side
  const sil = silhouetteOf(s);
  playV3('e_leashTear', { volume: 0.95, pan: panAt(from.x) });
  void lightDim(sc, 0.35, 280);
  let ribbonOn = true;
  const unhide = hideUnitShadow(sc, unit, () => ribbonOn);
  if (sil) {
    rig.shadow = new ShadowDouble(sc, s, sil);
    rig.shadow.img.setDepth(s.depth + 0.1);
  }
  rig.ribbon = true;
  const sh = rig.shadow;
  const anchor0 = { x: R(s.x), y: R(s.y) };
  const tearSteps = [0, 1, 2, 4, 7, 10, 13, 16];
  let lastK = -1;
  await run(sc, T.tear, (t) => {
    const k = tearSteps[Math.min(tearSteps.length - 1, Math.floor(t * tearSteps.length))];
    if (sh) sh.place({ x: anchor0.x + ux.x * k, y: anchor0.y + ux.y * k });
    if (k !== lastK && k > 0) {
      // the seam: void sparks off the leading edge of the body
      const seam = { x: R(neck0.x + ux.x * (k + 2)), y: R(neck0.y + 8 + (k % 3) * 4) };
      voidPuff(sc, seam, 3, 18);
    }
    if (k >= 4 && rig.wearer === 'body' && sh) {
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

  // ---- THE WALK: shadow ahead (4 quiet steps), body one beat behind (4 heavy dull steps on the off-beats)
  const shStart = sh ? { ...sh.anchor } : anchor0;
  const shEnd = { x: R(to.x), y: R(to.y - unit.hover) };
  const N = T.steps;
  const ST = T.step;
  // one beat behind, its footfalls on the off-beats: shadow pat at k·ST, body thud at (k + 1.5)·ST
  const bodyDelay = R(2.5 * ST - 150);
  const total = bodyDelay + N * ST;
  const desiredFlip = ev.to === 1;
  let shStepsDone = 0;
  let bStepsDone = 0;
  let turned = false;
  let wisps = 0;
  const wispSp = new PxSparks(sc, DEPTH.FX + 2);
  await run(sc, total + T.turnWait, (_t, el) => {
    // living detail: thin void wisps rise off the shadow's head and shoulders
    if (sh && el < N * ST && el >= wisps * 70) {
      wisps++;
      const w = sh.img.width;
      const x = R(sh.img.x + 4 + ((wisps * 37) % Math.max(1, w - 8)));
      const top = silTopAt(sh, x);
      if (top !== null) wispSp.add({ x, y: top, vx: (wisps % 3) - 1, vy: -16 - (wisps % 4) * 4, drag: 0.6, life: 420, colors: [PAL.void3, PAL.void2, PAL.void1], shape: 'px', fadeAt: 0.5 });
    }
    // the shadow: smooth glides on whole pixels, a 1-px rise mid-step
    if (sh) {
      const se = Math.min(N * ST, el);
      const i = Math.min(N - 1, Math.floor(se / ST));
      const lt = el >= N * ST ? 1 : (se - i * ST) / ST;
      const e = lt < 0.5 ? 2 * lt * lt : 1 - 2 * (1 - lt) * (1 - lt);
      const k = (i + e) / N;
      const p = lerpXY(shStart, shEnd, k);
      const rise = el < N * ST && lt > 0.25 && lt < 0.75 ? 1 : 0;
      sh.place({ x: p.x, y: p.y - rise });
      sh.img.setDepth(unitDepth(R(p.y + unit.hover)) + 0.1);
      while (shStepsDone < N && el >= (shStepsDone + 1) * ST) {
        shStepsDone++;
        const foot = lerpXY(shStart, shEnd, shStepsDone / N);
        playV3('e_leashShadowStep', { volume: 0.7, pitch: 1 + (shStepsDone % 2) * 0.05, pan: panAt(foot.x) });
        voidPuff(sc, { x: R(foot.x), y: R(foot.y + unit.hover) }, 4, 10, [PAL.void3, PAL.void2, PAL.void1]);
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
    // the body: stepped 3-frame moves (150 ms), planted 90 ms; a 1-px drop and dust on every footfall
    const be = el - bodyDelay;
    if (be >= 0) {
      const j = Math.min(N - 1, Math.floor(Math.min(be, N * ST - 1) / ST));
      const lt = be >= N * ST ? 1 : Math.min(1, (be - j * ST) / 150);
      const k = (j + q(lt, 3)) / N;
      b.ground = lerpXY(from, to, k);
      const planted = be - j * ST;
      b.ny = planted >= 150 && planted < 210 && be < N * ST + 60 ? 1 : 0;
      placeBody(b);
      while (bStepsDone < N && be >= bStepsDone * ST + 150) {
        bStepsDone++;
        const foot = lerpXY(from, to, bStepsDone / N);
        playV3('e_leashBodyStep', { volume: 0.85, pitch: 1 - bStepsDone * 0.02, pan: panAt(foot.x) });
        dust(sc, { x: R(foot.x), y: R(foot.y) }, 5);
      }
    }
    // the chain: tighter as the shadow pulls ahead, slack as it reaches the card's row
    const c = rig.collarPoint();
    if (rig.leash && c) {
      const d = Math.hypot(c.x - A.x, c.y - A.y);
      rig.leash.sag = Math.max(2, Math.min(8, R(d / 14)));
    }
    if (c) collarLight.setPosition(c.x, c.y, b.ground.y);
    cardGlow.setIntensity(0.5 + 0.2 * (Math.floor(el / 240) % 2), 0);
  });
  wispSp.release();
  b.ground = { ...to };
  b.ny = 0;
  placeBody(b);

  // ---- MERGE: the body walks into its shadow
  playV3('e_leashMerge', { volume: 0.9, pan: panAt(to.x) });
  await wait(sc, 120);
  bg(rimFlash(sc, s, { ramp: [PAL.void4, PAL.void3, PAL.void2, PAL.void1], hold: 2 }));
  rig.wearer = 'body';
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
  await wait(sc, 34);

  // ---- LOCK
  await wait(sc, T.lockAfterMerge - 34);
  const c1 = rig.collarPoint() ?? neckAt(neck, s.x, s.y, s.flipX);
  playV3('e_leashLock', { volume: 1, pan: panAt(to.x) });
  rig.collar.look.buckle = 'flash';
  sc.time.delayedCall(70, () => (rig.collar.look.buckle = 'on'));
  if (rig.leash) rig.leash.hot = true;
  bg(stepRing(sc, to, { r0: 6, r1: 30, ms: 420, ramp: [PAL.white, PAL.gold4, PAL.gold3, PAL.void3, PAL.void2] }));
  void lightFlash(sc, c1.x, c1.y, PAL.gold4, 26, 360, { floorY: to.y, intensity: 0.95 });
  void lightDim(sc, 0, 320);
  b.ny = -1;
  placeBody(b);
  sc.time.delayedCall(60, () => {
    b.ny = 0;
    placeBody(b);
  });
  motesFall(sc, collarRingAt(rig, c1), 6, [PAL.white, PAL.gold4, PAL.gold3]);
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
  await wait(sc, 200);

  // ---- BOND: the chain becomes the thin light bond, a pulse runs from the collar to the card
  if (rig.leash) {
    rig.leash.hot = false;
    rig.leash.mode = 'bond';
    rig.leash.sag = 3;
  }
  playV3('e_leashBond', { volume: 0.8, pan: panAt((A.x + to.x) / 2) });
  rig.collar.look.glint = 0;
  bg(run(sc, 200, (g) => (rig.collar.look.glint = g)).then(() => (rig.collar.look.glint = -1)));
  await run(sc, T.bond, (t) => {
    if (rig.leash) {
      rig.leash.pulse = 1 - q(t, 13);
      rig.leash.phase += 16;
    }
  });
  if (rig.leash) rig.leash.pulse = -1;
  void lightFlash(sc, A.x, A.y, PAL.void3, 16, 220, { intensity: 0.7 });

  // ---- hand over to the field + the lingering collar / bond
  rig.stop();
  void collarLight.fadeOut(160);
  void cardGlow.fadeOut(220);
  unit.lift = 0;
  unit.badge.setVisible(true);
  unit.settle();
  field.sync(ctx.stateNext);
  if (ev.sourceUid !== null) keepLinger(sc, lingerBond(sc, field, ev.uid, ev.sourceUid, neck));
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
  const rig = makeRig(sc, b, neck, { x: from.x, y: from.y }, [from, to]);
  let ribbonOn = true;
  const unhide = hideUnitShadow(sc, unit, () => ribbonOn);
  if (sil) rig.shadow = new ShadowDouble(sc, s, sil);
  rig.ribbon = true;
  const sh = rig.shadow;
  playV3('e_leashTear', { volume: 0.55, pitch: 1.3, pan: panAt(from.x) });
  const a0 = { x: R(s.x), y: R(s.y) };
  const aEnd = { x: R(to.x), y: R(to.y - unit.hover) };
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
      const p = lerpXY(a0, aEnd, q(e, 10));
      sh.place(p);
      sh.img.setDepth(unitDepth(R(p.y + unit.hover)) + 0.1);
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
      b.ground = lerpXY(from, to, k);
      b.ny = 0;
      placeBody(b);
      while (steps < B_STEPS && be >= (steps + 1) * B_ST) {
        steps++;
        const foot = lerpXY(from, to, steps / B_STEPS);
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
  const dir = owner === 1 ? { x: 0.8, y: -0.5 } : { x: -0.8, y: 0.5 };
  const a0 = { x: R(s.x), y: R(s.y) };
  playV3('e_leashHome', { volume: 0.7, pan: panAt(home.x) });
  // it runs for home …
  await run(sc, 170, (t) => {
    const k = q(t, 6) * 16;
    sh.place({ x: a0.x + dir.x * k, y: a0.y + dir.y * k });
  });
  // … hits the full row and is thrown back into the body
  playV3('e_leashBounce', { volume: 0.9, pan: panAt(home.x) });
  bg(rimFlash(sc, sh.img, { ramp: [PAL.white, PAL.void4, PAL.void3], hold: 1 }));
  voidPuff(sc, { x: R(home.x + dir.x * 18), y: R(home.y + dir.y * 18) }, 6, 14);
  await wait(sc, 40);
  await run(sc, 120, (t) => {
    const k = (1 - q(t, 4)) * 16;
    sh.place({ x: a0.x + dir.x * k, y: a0.y + dir.y * k });
  });
  sh.destroy();
  await rimFlash(sc, s, { ramp: [PAL.void4, PAL.void3, PAL.void2], hold: 1 });
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
    const orb = new Raster(sc, 0, 0, 11, 11, DEPTH.HUD + 6);
    const glow = lightPool(sc, from.x, from.y, { color: PAL.leaf3, radius: 12, air: 0.7, airRadius: 9, intensity: 0.8, fadeIn: 0 });
    let lastX = from.x;
    let lastY = from.y;
    const f0 = from;
    let n = 0;
    await run(sc, 520, (t, el) => {
      const k = t * t * 0.55 + t * 0.45;
      const p = qbez(f0, ctrl, lp, k);
      const x = R(p.x);
      const y = R(p.y);
      const beat = Math.floor(el / 80) % 2;
      orb.moveTo(x - 5, y - 5);
      orb.draw((r) => {
        r.disc(x + 0.5, y + 0.5, 4 + beat * 0.5, PAL.leaf1);
        r.disc(x + 0.5, y + 0.5, 3, PAL.leaf2);
        r.disc(x + 0.5, y + 0.5, 2, PAL.leaf3);
        r.px(x, y, PAL.white);
        r.px(x - 1, y, PAL.leaf4);
        r.px(x, y - 1, PAL.leaf4);
        r.px(x - 1, y - 1, PAL.leaf4);
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
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      trail.add({ x: R(lp.x), y: R(lp.y), vx: Math.cos(a) * 40, vy: Math.sin(a) * 26, drag: 3, life: 300, colors: [PAL.white, PAL.leaf4, PAL.leaf3, PAL.leaf2], shape: i % 3 === 0 ? 'plus' : 'px', fadeAt: 0.6 });
    }
    trail.release();
    orb.destroy();
    void lightFlash(sc, lp.x, lp.y, PAL.leaf3, 20, 260, { intensity: 0.8 });
    void glow.fadeOut(160);
  }
  await fx.presentHeal(ctx, ev);
});
