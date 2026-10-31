// Boşluk Gözü (void_eye) — v3 presentation (docs/v3/YENI_KARTLAR.md §7 S3; lane E). The v1 look keeps the generic
// activation and the batch-2 placeholder massDestroy (src/cinematics/b2/placeholders.ts): every hook below steps
// aside without ?look=v3.
//
// "Arena ışıkları kısılır → sahanın üstünde, gökyüzünde dikey bir yarık belirir ve dev bir göz gibi açılır (mor-siyah
//  iris, yıldızlı göz bebeği); zemin hiç açılmaz → göz bakışını sahaya indirir: tüm canavarlar aynı anda yerden kopar,
//  yavaşça dönerek yukarı süzülür (tek kolektif yükseliş) → göz bebeği büzülür ve hepsini bir anda içine alır → göz
//  kapanır (kapak iki kez kırpar), sahaya tek bir mor gözyaşı damlası düşer, 3 px sarsıntı."
//
// BEAT LIST (scene ms; ×1.35 in game time with the v3 tempo). The activation hook:
//   0      common v3 spell opening (spells/_kit): the card leaves the hand for its owner's side (or a set card stands
//          up on its tile), "BOŞLUK GÖZÜ" plate, a short hover. The last 160 ms of the hover: THE LIGHTS GO DOWN —
//          the light layer dims to 0.9 (floods out, the arena sinks into night) — e_voidDim
//   ~380   release: a violet orb leaves the card's top edge and zips straight up to the sky point over the field;
//          the spent card drops to its graveyard behind it (card continuity)
// The massDestroy (registerLaneE, this file) — ONE collective scene for every per-card event of the wipe:
//   +0     THE RIFT: a star flare where the orb hits; a vertical 1-px white crack with violet lips zig-zags down and
//          up the sky (4 stepped growths), short side cracks branch off, glass flakes of the sky fall — e_voidRift
//   +300   THE LIDS OPEN sideways (stepped, eased): a vertical almond EYE 45×81 px — night lids with a lit lip,
//          violet-black sclera, a ringed violet iris (16 stepped spokes), a black STARRY pupil with twinkling
//          stars and a white catch-light; a violet light pool breathes under it — e_voidLid ("şııııp")
//   +720   it looks round: the iris twitches left, right (searching)
//   +920   THE GAZE falls: the iris drops 6 px, a violet light washes over the field, every doomed tile lights violet,
//          face-down cards are seen through and flip face up one after another — e_voidGaze, e_voidReveal ×n;
//          the 28 Hz swell starts under it — e_voidSwell
//   +1080  THE COLLECTIVE RISE: every monster (both sides, tokens too) squats 1 px, tears off the floor with a 2-px
//          snap and floats up toward the eye — slowly, together — turning round on the way (facing flips with a
//          one-frame violet edge silhouette), swaying, tinting violet; their shadows shrink on the floor, motes
//          rise from their tiles — e_voidRise (the upward choir, no tremolo)
//   +1460  a GUARDIAN CHARM answers: its tile flares gold, a gold tether snaps up to its monster and yanks it back
//          down onto its tile (thud, dust, a gold ring, "KORUNDU") — e_voidSave, e_voidThud
//   +2080  THE PUPIL CONTRACTS (two stepped frames, 9 → 3 px) — e_voidTick (dry, close); 70 ms hit-stop; every
//          rising body flashes white for one frame and turns into a violet silhouette
//   +2120  THE SWALLOW: each silhouette unravels from the top down into a stream of pixel motes that pours into the
//          pupil (crop by whole rows; 300 ms); the iris brightens with each — e_voidGulp; the swell and the choir
//          stop on it
//   +2440  the pupil gulps (3 → 5 → 4) and a violet flash leaves the eye
//   +2480  THE EYE CLOSES (lids slide shut in 140 ms) — e_voidBlink; it BLINKS TWICE (open a crack, shut) at
//          +2700 / +2880 — e_voidBlink ×2
//   +3000  THE TEAR: one purple drop swells at the bottom of the slit and falls onto the middle of the field;
//          at +3320 it lands: a splash ring spreads on the floor, a violet floor flash, 3 px shake — e_voidDrip;
//          the slit fades from the sky, the lights come back up
//   +3360  the cards: every destroyed card lifts off its own (now revealed) tile and arcs to its owner's graveyard,
//          60 ms apart; a token's tile crumbles into violet motes (tokens have no card to keep); a broken charm or
//          an equip leaves its tile the same way
// The ground NEVER opens (YENI_KARTLAR: "zemin hiç açılmaz"): everything goes UP.

import Phaser from 'phaser';
import type { CardId } from '../../data/cards';
import type { GameEvent, PlayerId, Uid } from '../../engine/types';
import { PAL } from '../../art/palette';
import { BOARD_CENTER, DEPTH, LOOK_V3, type XY, zoneXY } from '../../view/layout';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import type { TileCard } from '../../view/TileCard';
import { Raster, freeze, run, spriteBox } from '../../vfx/setpieces';
import { shake, wait } from '../../vfx/core';
import { pixelText } from '../../ui/text';
import { fxRng } from '../_v3/spellfx';
import { panAt, play as playV3, start as startV3 } from '../_v3/sound';
import { cardLeaves } from '../_v3/card';
import { fx, registerCardHook } from '../api';
import { registerLaneE, type LaneECtx } from '../b2e/dispatch';
import { bg, lightBeam, lightDim, lightFlash, lightPool, relax, setTileOf, spellOpening, starFlare, type ActCtx, type BeamHandle, type LightHandle } from './_kit';

const R = Math.round;
const ID: CardId = 'void_eye';
type MassCtx = LaneECtx<'massDestroy'>;

// ================================================================ geometry

/** Half sizes of the open eye (a vertical almond) and of the iris. */
const EH = 40;
const EW = 22;
const IRIS = 15;
/** The eye's centre: over the middle of the field, in the sky behind the back row. */
function eyeAt(): XY {
  return { x: R(BOARD_CENTER.x), y: Math.max(56, R(BOARD_CENTER.y - 118)) };
}

// ================================================================ timings (scene ms from the massDestroy)

const T = {
  rift: 0,
  riftMs: 200,
  lid: 220,
  lidMs: 360,
  look: 580,
  gaze: 740,
  lift: 860,
  liftMs: 900,
  save: 1180,
  contract: 1760,
  swallow: 1790,
  swallowMs: 260,
  gulp: 2060,
  close: 2100,
  closeMs: 120,
  blink1: 2250,
  blink2: 2340,
  tear: 2320,
  tearFall: 2400,
  land: 2610,
  end: 2630,
} as const;

// ================================================================ helpers

const ease = {
  inOut: (t: number) => 0.5 - Math.cos(Math.PI * Math.min(1, Math.max(0, t))) / 2,
  out: (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3),
  in: (t: number) => Math.pow(Math.min(1, Math.max(0, t)), 2),
};
const seg = (el: number, a: number, ms: number) => Math.min(1, Math.max(0, (el - a) / ms));
/** Quantise t to n steps (stepped, pixel-art motion). */
const q = (t: number, n: number) => Math.floor(Math.min(1, t) * n) / n;

/** The eye's lid opening (0 shut … 1 open) at `el`. */
function lidAt(el: number): number {
  if (el < T.lid) return 0;
  if (el < T.close) return q(ease.out(seg(el, T.lid, T.lidMs)), 7);
  const shut = 1 - q(seg(el, T.close, T.closeMs), 4);
  if (el < T.blink1) return shut;
  const blink = (b: number) => {
    const u = el - b;
    if (u < 0 || u > 130) return 0;
    return u < 60 ? q(u / 60, 3) * 0.3 : 0.3 - q((u - 60) / 70, 3) * 0.3;
  };
  return Math.max(blink(T.blink1), blink(T.blink2) * 0.85);
}

// ================================================================ the eye (a raster in the sky)

interface EyeState {
  /** crack length 0..1 */
  crack: number;
  open: number;
  ix: number;
  iy: number;
  rp: number;
  /** iris brightness 0..2 */
  glow: number;
  el: number;
  /** the slit fades away at the end (0..1 = gone) */
  fade: number;
}

/** 1-px zig-zag of the rift (deterministic, period 10). */
const JAG = [0, 0, 1, 1, 1, 0, -1, -1, 0, 0];
const jag = (y: number) => JAG[((y % JAG.length) + JAG.length) % JAG.length];
/** Side cracks: [row offset from the centre, direction, length]. */
const BRANCH: readonly (readonly [number, number, number])[] = [
  [-44, -1, 6],
  [-30, 1, 4],
  [34, -1, 5],
  [47, 1, 7],
  [-52, 1, 3],
];
/** Stars of the pupil (unit-circle positions) and their twinkle phase. */
const STARS: readonly (readonly [number, number, number])[] = [
  [-0.45, -0.3, 0],
  [0.3, -0.55, 1],
  [0.15, 0.35, 2],
  [-0.3, 0.45, 1],
  [0.55, 0.1, 0],
  [-0.05, -0.05, 2],
];

function drawEye(r: Raster, c: XY, s: EyeState): void {
  const L = Math.round(s.crack * (EH + 10));
  const faded = s.fade >= 1;
  if (faded) return;
  const dim = s.fade > 0.5;
  // ---- the rift (always under the lids; beyond the tips it IS the eye's tear in the sky)
  for (let dy = -L; dy <= L; dy++) {
    const x = c.x + jag(c.y + dy);
    const tip = Math.abs(dy) > L - 3;
    r.px(x - 1, c.y + dy, dim ? PAL.void1 : PAL.void2);
    r.px(x + 1, c.y + dy, dim ? PAL.void1 : PAL.void2);
    r.px(x, c.y + dy, dim ? PAL.void2 : tip ? PAL.void4 : PAL.white);
  }
  if (s.crack > 0.6 && !dim) {
    for (const [oy, dir, n] of BRANCH) {
      if (Math.abs(oy) > L) continue;
      for (let k = 1; k <= n; k++) r.px(c.x + jag(c.y + oy) + dir * (k + 1), c.y + oy + (k >> 1) * Math.sign(oy), k === n ? PAL.void2 : PAL.void3);
    }
  }
  if (s.open <= 0) return;
  // ---- the lens
  for (let dy = -EH; dy <= EH; dy++) {
    const f = 1 - (dy / EH) * (dy / EH);
    const hw = Math.floor(EW * s.open * f);
    if (hw < 1) continue;
    const y = c.y + dy;
    for (let dx = -hw - 4; dx <= hw + 4; dx++) {
      const x = c.x + dx;
      const a = Math.abs(dx);
      if (a > hw) {
        // lids: left lid lit (mist lip, night4 skin), right lid shaded; ink outline
        const k = a - hw;
        const col = k === 4 ? PAL.ink : dx < 0 ? (k === 1 ? PAL.mist : k === 2 ? PAL.night4 : PAL.night3) : k === 1 ? PAL.night4 : k === 2 ? PAL.night3 : PAL.night2;
        r.px(x, y, col);
        continue;
      }
      // inside: sclera, iris, pupil
      const ux = dx - s.ix;
      const uy = dy - s.iy;
      const d = Math.sqrt(ux * ux + uy * uy);
      let col: number;
      if (d <= s.rp) {
        col = PAL.ink;
        for (const [sx, sy, ph] of STARS) {
          if (R(sx * s.rp) === ux && R(sy * s.rp) === uy) col = (Math.floor(s.el / 160) + ph) % 3 === 0 ? PAL.white : PAL.void3;
        }
      } else if (d <= s.rp + 1.2) col = s.glow > 1 ? PAL.white : PAL.void4;
      else if (d <= 9) col = s.glow > 0.5 ? PAL.void4 : PAL.void3;
      else if (d <= 13) {
        const ang = Math.atan2(uy, ux);
        // fine radial fibres (every 4th of 32 sectors), turning slowly
        const spoke = Math.floor(((ang + Math.PI + s.el / 1400) / (Math.PI * 2)) * 32) % 4 === 0;
        col = spoke ? (s.glow > 1.5 ? PAL.void4 : PAL.void3) : s.glow > 1.5 ? PAL.void3 : PAL.void2;
      } else if (d <= IRIS) col = PAL.void1;
      else col = PAL.void0;
      // lid shadow inside the lens: the shaded (right) side one ink row, the lit side a void1 band
      if (a >= hw - 1 && d > IRIS) col = dx > 0 ? PAL.ink : PAL.void1;
      // catch-light (one bright glint, top left of the pupil) + a small second one
      const cxl = -Math.max(1, R(s.rp * 0.4));
      const cyl = -Math.max(1, R(s.rp * 0.45));
      if ((ux === cxl && (uy === cyl || uy === cyl + 1)) || (ux === cxl + 1 && uy === cyl && s.rp >= 4)) col = PAL.white;
      r.px(x, y, col);
    }
  }
  // lashes: three short ink spikes on each lid, pointing out and down
  if (s.open > 0.5) {
    for (const oy of [-24, -8, 8, 24]) {
      const f = 1 - (oy / EH) * (oy / EH);
      const hw = Math.floor(EW * s.open * f) + 5;
      for (const side of [-1, 1]) {
        r.px(c.x + side * hw, c.y + oy, PAL.ink);
        r.px(c.x + side * (hw + 1), c.y + oy + 1, PAL.ink);
      }
    }
  }
}

// ================================================================ particles (pixel motes)

interface Mote {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** pull toward this point (the pupil) when set */
  to: XY | null;
  x0: number;
  y0: number;
  age: number;
  life: number;
  c: number;
  /** gravity px/s² */
  g: number;
  /** 2-px trail */
  trail: boolean;
}

class Motes {
  private ms: Mote[] = [];
  add(m: Partial<Mote> & { x: number; y: number; life: number; c: number }): void {
    this.ms.push({ vx: 0, vy: 0, to: null, age: 0, g: 0, trail: false, x0: m.x, y0: m.y, ...m });
  }
  step(dt: number): void {
    const s = dt / 1000;
    for (const m of this.ms) {
      m.age += dt;
      if (m.to) {
        const t = ease.in(m.age / m.life);
        m.x = m.x0 + (m.to.x - m.x0) * t;
        m.y = m.y0 + (m.to.y - m.y0) * t;
      } else {
        m.vy += m.g * s;
        m.x += m.vx * s;
        m.y += m.vy * s;
      }
    }
    this.ms = this.ms.filter((m) => m.age < m.life);
  }
  draw(r: Raster): void {
    for (const m of this.ms) {
      const x = R(m.x);
      const y = R(m.y);
      const late = m.age / m.life > 0.7;
      r.px(x, y, late && m.c !== PAL.white ? PAL.void3 : m.c);
      if (m.trail) {
        const tx = m.to ? m.x0 - m.to.x : -m.vx;
        const ty = m.to ? m.y0 - m.to.y : -m.vy;
        const l = Math.hypot(tx, ty) || 1;
        r.px(R(m.x + tx / l), R(m.y + ty / l), PAL.void2);
      }
    }
  }
  get count(): number {
    return this.ms.length;
  }
}

// ================================================================ the bodies

interface Body {
  uid: Uid;
  cardId: CardId;
  player: PlayerId;
  zone: number;
  owner: PlayerId;
  kind: 'monster' | 'token' | 'saved';
  unit: MonsterUnit | null;
  tile: TileCard | null;
  faceDown: boolean;
  ghost: Phaser.GameObjects.Sprite | null;
  /** the ghost's start (sprite position) and its floor point */
  x0: number;
  y0: number;
  floor: XY;
  /** where it floats to (lift / drift) */
  lift: number;
  drift: number;
  ph: number;
  flipEvery: number;
  lastFlip: number;
  edgeUntil: number;
  /** the swallow: rows already eaten (crop) */
  eaten: number;
  gone: boolean;
  light: LightHandle | null;
  /** saved: when it was yanked back (ms) */
  yank: number;
  landed: boolean;
}

/** A guardian charm save: the charm card and the monster it keeps. */
interface Save {
  charmUid: Uid;
  charmCard: CardId;
  owner: PlayerId;
  zone: number;
  saved: Uid;
}

/** A spell / trap card that breaks with the wipe (a charm, an equip): it leaves its tile at the end. */
interface Card {
  uid: Uid;
  cardId: CardId;
  owner: PlayerId;
  tile: TileCard | null;
}

// ================================================================ the activation (opening → orb to the sky)

registerCardHook(ID, 'activate', async (ctx: ActCtx) => {
  if (!LOOK_V3) return ctx.base();
  const ev = ctx.ev;
  const sc = ctx.scene;
  const mi = ctx.findType('massDestroy', (e) => e.sourceUid === ev.uid);
  const gi = ctx.findType('toGraveyard', (e) => e.uid === ev.uid && e.from === 'resolved');
  let dimmed = false;
  const dimNow = () => {
    if (dimmed) return;
    dimmed = true;
    void lightDim(sc, 0.9, 520);
    playV3('e_voidDim', { volume: 0.8 });
  };
  const op = await spellOpening(ctx, {
    uid: ev.uid,
    cardId: ev.cardId,
    player: ev.player,
    from: setTileOf(ctx) ? 'set' : 'hand',
    zone: ev.zone,
    hold: 240,
    keepCard: true,
    releaseFrom: 'top',
    onHold: (h) => bg(wait(sc, Math.max(0, h - 160)).then(dimNow)),
  });
  if (mi < 0) {
    void lightDim(sc, 0, 300);
    await op.close();
    relax(ctx);
    await fx.playRun(ctx, fx.resolutionRun(ctx));
    return;
  }
  dimNow();
  const eye = eyeAt();
  await op.release(eye, { path: 'line', ms: 220, size: 2, light: false });
  const spent = wait(sc, 160).then(() => (op.leave ? op.leave(gi) : undefined));
  await ctx.play(mi, { voidEye: true });
  await spent;
  relax(ctx, 300);
  await fx.playRun(ctx, fx.resolutionRun(ctx));
});

// ================================================================ the wipe

registerLaneE(
  'massDestroy',
  (ctx) => LOOK_V3 && ctx.ev.sourceUid !== null && ctx.cardId(ctx.ev.sourceUid) === ID,
  (ctx) => voidEyeWipe(ctx),
);

/** Gather the wipe's per-card events (they are all presented here, as one rise). */
function collect(ctx: MassCtx): { bodies: Body[]; saves: Save[]; cards: Card[]; later: number[] } {
  const src = ctx.ev.sourceUid!;
  const field = ctx.views.field;
  const evs = ctx.events;
  const bodies: Body[] = [];
  const saves: Save[] = [];
  const cards: Card[] = [];
  const later: number[] = [];
  const ownerOf = (i: number, uid: Uid): PlayerId => {
    for (let j = i + 1; j < evs.length && j < i + 4; j++) {
      const e = evs[j];
      if (e.type === 'toGraveyard' && e.uid === uid) {
        ctx.consumeAt(j);
        return e.owner;
      }
    }
    return ctx.owner(uid);
  };
  for (let i = ctx.index + 1; i < evs.length; i++) {
    const e = evs[i] as GameEvent;
    if (ctx.isConsumed(i)) continue;
    if (e.type === 'toGraveyard' && e.uid === src) break;
    if (e.type === 'destroy') {
      ctx.consumeAt(i);
      const owner = ownerOf(i, e.uid);
      if (e.location === 'monster') {
        const unit = field.unit(e.uid);
        bodies.push(newBody(e.uid, e.cardId, e.player, e.zone, owner, 'monster', unit, field.tileOf(e.uid)));
      } else cards.push({ uid: e.uid, cardId: e.cardId, owner, tile: field.tileOf(e.uid) });
    } else if (e.type === 'tokenVanish') {
      ctx.consumeAt(i);
      bodies.push(newBody(e.uid, e.cardId, e.player, e.zone, e.player, 'token', field.unit(e.uid), field.tileOf(e.uid)));
    } else if (e.type === 'activate' && e.kind === 'spell' && e.from === 'spellTrap' && e.zone !== null) {
      // a guardian charm takes the blow for its monster
      const slot = ctx.stateAt(i).players[e.player].spellTraps[e.zone];
      if (!slot || slot.equippedTo === undefined || slot.equippedTo === null) break;
      ctx.consumeAt(i);
      saves.push({ charmUid: e.uid, charmCard: e.cardId, owner: e.player, zone: e.zone, saved: slot.equippedTo });
    } else if (e.type === 'decoyPopped' || e.type === 'statChange' || e.type === 'toGraveyard') later.push(i);
    else break;
  }
  for (const sv of saves) {
    if (bodies.some((b) => b.uid === sv.saved)) continue;
    const loc = ctx.locate(sv.saved);
    const unit = field.unit(sv.saved);
    if (!loc || !unit || !unit.sprite.visible) continue;
    bodies.push(newBody(sv.saved, ctx.cardId(sv.saved), loc.player, loc.index, ctx.owner(sv.saved), 'saved', unit, field.tileOf(sv.saved)));
  }
  return { bodies, saves, cards, later };
}

function newBody(uid: Uid, cardId: CardId, player: PlayerId, zone: number, owner: PlayerId, kind: Body['kind'], unit: MonsterUnit | null, tile: TileCard | null): Body {
  const floor = zoneXY(player, 'monster', zone);
  return {
    uid,
    cardId,
    player,
    zone,
    owner,
    kind,
    unit,
    tile,
    faceDown: !unit || !unit.sprite.visible,
    ghost: null,
    x0: floor.x,
    y0: floor.y,
    floor: { x: R(floor.x), y: R(floor.y) },
    lift: 0,
    drift: 0,
    ph: 0,
    flipEvery: 300,
    lastFlip: 0,
    edgeUntil: -1,
    eaten: 0,
    gone: false,
    light: null,
    yank: -1,
    landed: false,
  };
}

/** Swap a body's unit for a free sprite copy that keeps animating (the unit hides). */
function ghostOf(sc: Phaser.Scene, b: Body): void {
  const u = b.unit;
  if (!u) return;
  const s = u.sprite;
  const g = sc.add.sprite(R(s.x), R(s.y), s.texture.key, s.frame.name).setOrigin(s.originX, s.originY).setFlipX(s.flipX).setDepth(s.depth);
  const anim = s.anims?.currentAnim;
  if (anim) {
    try {
      g.play({ key: anim.key, startFrame: Math.max(0, Math.min(anim.frames.length - 1, (s.anims.currentFrame?.index ?? 1) - 1)) });
    } catch {
      /* a still copy is fine */
    }
  }
  u.hide();
  g.setDepth(DEPTH.FX + 2 + s.y / 1000);
  b.ghost = g;
  b.x0 = g.x;
  b.y0 = g.y;
}

async function voidEyeWipe(ctx: MassCtx): Promise<void> {
  const sc = ctx.scene;
  const field = ctx.views.field;
  const eye = eyeAt();
  const pupil = (s: EyeState): XY => ({ x: eye.x + s.ix, y: eye.y + s.iy });
  const { bodies, saves, cards, later } = collect(ctx);
  const rng = fxRng(eye.x * 31 + bodies.length * 7 + 5);
  // the order every body turns / sways in (deterministic)
  bodies.forEach((b, i) => {
    b.ph = rng() * Math.PI * 2;
    b.flipEvery = 380 + ((i * 53) % 110);
    b.lastFlip = 0;
  });
  for (const c of cards) c.tile = field.tileOf(c.uid);

  // ---- the canvases: the sky (the eye), the air (motes, tether, tear), the floor (shadows, splash)
  const sky = Raster.around(sc, eye.x, eye.y, EW * 2 + 14, (EH + 22) * 2, DEPTH.FX + 4);
  const air = new Raster(sc, 0, 0, 640, 360, DEPTH.FX + 6);
  const floor = new Raster(sc, 0, 0, 640, 360, DEPTH.TILE_FX + 2);
  const motes = new Motes();
  const S: EyeState = { crack: 0, open: 0, ix: 0, iy: 0, rp: 9, glow: 0, el: 0, fade: 0 };

  // ---- lights
  let eyeLight: LightHandle | null = null;
  let gazeLight: LightHandle | null = null;
  let gazeBeam: BeamHandle | null = null;
  let tearLight: LightHandle | null = null;
  const fieldMid: XY = { x: R(BOARD_CENTER.x), y: R(BOARD_CENTER.y) };

  // ---- one-shot marks
  const fired = new Set<string>();
  const once = (k: string, el: number, at: number, fn: () => void) => {
    if (el >= at && !fired.has(k)) {
      fired.add(k);
      fn();
    }
  };
  let swell: { stop(ms?: number): void } | null = null;
  let choir: { stop(ms?: number): void } | null = null;
  const words: Promise<void>[] = [];
  const doomedTiles = bodies.filter((b) => b.kind !== 'saved' && b.tile).map((b) => b.tile!);

  // stars flare where the orb hit (the rift starts from it)
  bg(starFlare(sc, eye, 200, [PAL.white, PAL.void4, PAL.void3, PAL.void2, PAL.void1], 22));
  playV3('e_voidRift', { volume: 0.85 });

  let last = 0;
  await run(sc, T.end, (_t, el, dt) => {
    S.el = el;
    // ================================ the eye's state
    S.crack = q(ease.out(seg(el, T.rift, T.riftMs)), 4);
    S.open = lidAt(el);
    // the open eye breathes: the lids ease 1 px in and out (nothing stands still)
    if (el > T.lid + T.lidMs && el < T.close) S.open = Math.floor(el / 420) % 2 ? 0.95 : 1;
    // looks round, then the gaze falls
    if (el < T.gaze) S.ix = el >= T.look ? (el < T.look + 90 ? -2 : el < T.look + 180 ? 2 : 0) : 0;
    else S.ix = 0;
    S.iy = el < T.gaze ? 0 : q(ease.out(seg(el, T.gaze, 120)), 3) * 6;
    if (el >= T.close) S.iy = 6;
    // the pupil: dilates as it looks, contracts in two stepped frames, gulps
    if (el < T.contract) S.rp = el >= T.gaze ? 7 : 6;
    else if (el < T.contract + 40) S.rp = 4;
    else if (el < T.gulp) S.rp = 2;
    else if (el < T.gulp + 50) S.rp = 4;
    else S.rp = 3;
    S.glow = el >= T.contract && el < T.contract + 50 ? 2 : el >= T.swallow && el < T.gulp + 60 ? 1 : el >= T.gaze ? 0.6 : 0;
    S.fade = el < T.tear + 100 ? 0 : el < T.tear + 220 ? 0.6 : 1;

    // ================================ marks
    once('lid', el, T.lid, () => {
      playV3('e_voidLid', { volume: 0.9 });
      eyeLight = lightPool(sc, eye.x, eye.y, { color: PAL.void3, radius: 80, floorY: fieldMid.y, air: 0.75, airRadius: 46, intensity: 0, anim: 'breathe', fadeIn: 0 });
      eyeLight.setIntensity(1, 420);
    });
    once('gaze', el, T.gaze, () => {
      playV3('e_voidGaze', { volume: 0.9 });
      swell = startV3('e_voidSwell', { volume: 0.85 });
      gazeLight = lightPool(sc, fieldMid.x, fieldMid.y, { color: PAL.void3, radius: 150, intensity: 0, tint: 0.6, fadeIn: 0 });
      gazeLight.setIntensity(1.1, 260);
      gazeBeam = lightBeam(sc, { x: eye.x, y: eye.y + 6 }, { x: fieldMid.x, y: fieldMid.y - 30 }, PAL.void3, 0, { width: 44, intensity: 0.55, shimmer: 0.2 });
      for (const t of doomedTiles) if (t.active) t.setHighlight(PAL.void3);
      // face-down cards are seen through: they flip up one after another
      bodies
        .filter((b) => b.faceDown && b.tile)
        .forEach((b, k) => {
          bg(
            wait(sc, 40 + k * 50).then(async () => {
              if (!b.tile?.active) return;
              b.tile.setCard(b.cardId);
              playV3('e_voidReveal', { volume: 0.8, pan: panAt(b.floor.x), pitch: 1 + k * 0.06 });
              await b.tile.flipUp(150);
            }),
          );
        });
    });
    once('lift', el, T.lift, () => {
      choir = startV3('e_voidRise', { volume: 0.9 });
      for (const b of bodies) {
        if (b.faceDown && b.kind !== 'saved') b.unit = field.addUnit(b.uid, { hidden: true });
        ghostOf(sc, b);
        if (b.ghost && b.faceDown) {
          // a revealed body steps out of its card: one violet frame
          b.ghost.setTintFill(PAL.void4);
          b.edgeUntil = el + 50;
        }
        // where it goes: up toward the eye, drawn in a little (the back row is already close to it)
        b.lift = Math.max(30, Math.min(100, R((b.y0 - eye.y) * 0.7)));
        b.drift = R((eye.x - b.x0) * 0.12);
        if (b.kind === 'saved') b.lift = Math.min(b.lift, 22);
        if (b.ghost) b.light = lightPool(sc, b.x0, b.y0 - 12, { color: PAL.void3, radius: 14, floorY: b.y0, air: 0.35, intensity: 0.7, anim: 'breathe' });
      }
    });
    for (const sv of saves) {
      once(`save${sv.charmUid}`, el, T.save, () => {
        const b = bodies.find((x) => x.uid === sv.saved);
        const tile = field.tileOf(sv.charmUid);
        if (tile) void tile.pulse(PAL.gold3, 360);
        playV3('e_voidSave', { volume: 0.9, pan: panAt(b?.floor.x ?? eye.x) });
        if (b) b.yank = el;
      });
    }
    once('contract', el, T.contract, () => {
      playV3('e_voidTick', { volume: 1 });
      void freeze(sc, 70);
      for (const b of bodies) {
        if (b.kind === 'saved' || !b.ghost) continue;
        b.ghost.anims.stop();
        b.ghost.setTint(PAL.void3);
      }
    });
    once('silhouette', el, T.contract + 40, () => {
      for (const b of bodies) if (b.kind !== 'saved' && b.ghost) b.ghost.setTint(PAL.void3);
    });
    once('swallow', el, T.swallow, () => {
      playV3('e_voidGulp', { volume: 1 });
      (swell as { stop(ms?: number): void } | null)?.stop(260);
      (choir as { stop(ms?: number): void } | null)?.stop(200);
      // decoy hats (magic_hat) pop with the swallow (their own presentation)
      for (const i of later) if (ctx.events[i].type === 'decoyPopped' && !ctx.isConsumed(i)) bg(ctx.play(i));
    });
    once('gulp', el, T.gulp, () => {
      void lightFlash(sc, eye.x, eye.y, PAL.void4, 70, 380, { floorY: fieldMid.y, air: 0.9, intensity: 1.2 });
      (gazeBeam as BeamHandle | null)?.fadeOut(200);
      (gazeLight as LightHandle | null)?.setIntensity(0.4, 200);
      for (const b of bodies) void b.light?.fadeOut(120);
    });
    once('close', el, T.close + 60, () => playV3('e_voidBlink', { volume: 0.9 }));
    once('blink1', el, T.blink1 + 70, () => playV3('e_voidBlink', { volume: 0.7, pitch: 1.08 }));
    once('blink2', el, T.blink2 + 70, () => playV3('e_voidBlink', { volume: 0.6, pitch: 1.16 }));
    once('lightsUp', el, T.tear, () => {
      tearLight = lightPool(sc, eye.x, eye.y + EH, { color: PAL.void4, radius: 16, floorY: fieldMid.y, air: 0.6, airRadius: 8, intensity: 0.9, fadeIn: 60 });
      (eyeLight as LightHandle | null)?.setIntensity(0.4, 300);
    });
    once('land', el, T.land, () => {
      playV3('e_voidDrip', { volume: 1, pan: panAt(fieldMid.x) });
      void (tearLight as LightHandle | null)?.fadeOut(120);
      void shake(sc, 160, 3);
      void lightFlash(sc, fieldMid.x, fieldMid.y, PAL.void3, 60, 520, { intensity: 1.1, ring: true });
      void (eyeLight as LightHandle | null)?.fadeOut(400);
      void (gazeLight as LightHandle | null)?.fadeOut(500);
      void lightDim(sc, 0, 700);
      // the splash droplets
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2 + 0.3;
        motes.add({ x: fieldMid.x, y: fieldMid.y - 1, vx: Math.cos(a) * 46, vy: -40 - (k % 3) * 18, g: 300, life: 300, c: k % 2 ? PAL.void4 : PAL.void3 });
      }
    });

    // ================================ bodies
    const dtS = Math.max(0, el - last);
    last = el;
    motes.step(dtS);
    for (const b of bodies) {
      const g = b.ghost;
      if (!g || !g.active || b.gone) continue;
      const u = seg(el, T.lift, T.liftMs);
      // squat 1 px (anticipation), snap 2 px (tears off), then the slow float
      let ly = 0;
      if (el >= T.lift) {
        const k = el - T.lift;
        ly = k < 60 ? -1 : k < 110 ? 2 : 2 + (b.lift - 2) * ease.inOut((k - 110) / (T.liftMs - 110));
      }
      let lx = b.drift * ease.inOut(u);
      // keep drifting a little after the rise ends (nothing stands still)
      if (el > T.lift + T.liftMs) ly += Math.min(4, (el - T.lift - T.liftMs) / 60);
      const sway = el >= T.lift ? Math.round(Math.sin(el / 280 + b.ph)) : 0;
      // the guardian charm's save: yanked down in 160 ms (ease-in), lands, stays
      if (b.kind === 'saved' && b.yank >= 0) {
        const y = seg(el, b.yank + 90, 160);
        const held = 1 - ease.in(y);
        ly = Math.min(ly, (b.lift * 0.5 + 2) * held);
        lx *= held;
        if (y >= 1 && !b.landed) {
          b.landed = true;
          ly = 0;
          playV3('e_voidThud', { volume: 0.9, pan: panAt(b.floor.x) });
          void shake(sc, 90, 1);
          b.tile?.ringBurst(PAL.gold3, 360);
          b.tile?.dust(10, 0.8);
          g.setTint(PAL.gold4);
          b.edgeUntil = el + 50;
          const w = pixelText(sc, b.floor.x, b.floor.y - 50, 'KORUNDU', { size: 'md', color: PAL.gold3 }).setOrigin(0.5, 1).setDepth(DEPTH.FX_TOP);
          words.push(
            run(sc, 700, (t) => {
              w.y = R(b.floor.y - 50 - q(t, 6) * 8);
              w.setVisible(t < 0.85 || Math.floor(t * 20) % 2 === 0);
            }).then(() => w.destroy()),
          );
        }
        if (b.landed) {
          ly = 0;
          lx = 0;
        }
      }
      g.x = R(b.x0 + lx + (b.landed ? 0 : sway));
      g.y = R(b.y0 - ly);
      // turning: flip the facing with a one-frame violet edge silhouette (no rotation, no scale)
      if (el >= T.lift + 140 && el < T.contract && !(b.kind === 'saved' && b.yank >= 0) && el - b.lastFlip > b.flipEvery) {
        if (b.lastFlip === 0) b.lastFlip = T.lift + 140 + ((b.ph * 60) | 0);
        else {
          b.lastFlip = el;
          g.setFlipX(!g.flipX);
          g.setOrigin(1 - g.originX, g.originY);
          g.setTint(PAL.void2);
          b.edgeUntil = el + 35;
        }
      }
      if (b.edgeUntil >= 0 && el >= b.edgeUntil && el < T.contract) {
        b.edgeUntil = -1;
        if (b.kind === 'saved' && b.landed) g.clearTint();
        else if (el >= T.lift + 400 && b.kind !== 'saved') g.setTint(PAL.void4);
        else g.clearTint();
      }
      if (el >= T.lift + 400 && el < T.contract && b.edgeUntil < 0 && b.kind !== 'saved' && !g.isTinted) g.setTint(PAL.void4);
      b.light?.setPosition(g.x, g.y - 14, b.floor.y);
      // motes rising off its tile while it floats
      if (el >= T.lift && el < T.contract && b.kind !== 'saved' && rng() < dtS / 70) {
        motes.add({ x: b.floor.x + R((rng() - 0.5) * 22), y: b.floor.y + R((rng() - 0.5) * 6), vy: -26 - rng() * 20, life: 520, c: rng() < 0.3 ? PAL.void4 : PAL.void3 });
      }
      // THE SWALLOW: unravel from the top into a stream of motes poured into the pupil
      if (el >= T.swallow && b.kind !== 'saved') {
        const fw = g.frame.width;
        const fh = g.frame.height;
        const k = Math.min(1, (el - T.swallow) / T.swallowMs);
        const rows = Math.min(fh, Math.floor((k * fh) / 2) * 2);
        if (rows > b.eaten) {
          const top = g.y - g.originY * g.displayHeight;
          const left = g.x - g.originX * g.displayWidth;
          const box = spriteBox(sc, g);
          for (let rr = b.eaten; rr < rows; rr += 2) {
            const yy = top + rr;
            if (yy < box.top - 1 || yy > box.bottom + 1) continue;
            for (let m = 0; m < 2; m++) {
              const xx = Math.max(box.left, Math.min(box.right, left + fw * (0.25 + rng() * 0.5)));
              motes.add({ x: xx, y: yy, to: pupil(S), life: 160 + rng() * 120, c: m === 0 ? PAL.void4 : rng() < 0.4 ? PAL.white : PAL.void3, trail: true });
            }
          }
          b.eaten = rows;
          g.setCrop(0, rows, fw, Math.max(0, fh - rows));
        }
        if (rows >= fh) {
          b.gone = true;
          g.setVisible(false);
        }
      }
    }

    // ================================ draw
    sky.draw((r) => drawEye(r, eye, S));
    floor.draw((r) => {
      // shrinking shadows under the risen bodies (stepped radii), the splash ring
      for (const b of bodies) {
        if (!b.ghost || b.gone || el < T.lift || (b.kind === 'saved' && b.landed)) continue;
        const h = b.y0 - b.ghost.y;
        const rx = Math.max(2, 9 - Math.floor(h / 10));
        const ry = Math.max(1, rx >> 1);
        for (let yy = -ry; yy <= ry; yy++) {
          const w = Math.floor(rx * Math.sqrt(1 - (yy * yy) / ((ry + 0.5) * (ry + 0.5))));
          for (let xx = -w; xx <= w; xx++) r.px(b.floor.x + xx + (b.ghost.x - b.x0), b.floor.y + yy, PAL.ink, 150);
        }
      }
      if (el >= T.land) {
        const u = seg(el, T.land, 420);
        const rx = 3 + q(ease.out(u), 7) * 26;
        const ry = rx / 2;
        const col = u < 0.4 ? PAL.void4 : u < 0.75 ? PAL.void3 : PAL.void2;
        if (u < 1)
          for (let a = 0; a < 64; a++) {
            const ang = (a / 64) * Math.PI * 2;
            r.px(R(fieldMid.x + Math.cos(ang) * rx), R(fieldMid.y + Math.sin(ang) * ry), col);
          }
        if (u < 0.5) for (let xx = -2; xx <= 2; xx++) r.px(fieldMid.x + xx, fieldMid.y, PAL.void3);
      }
    });
    air.draw((r) => {
      motes.draw(r);
      // the gold tether of a save (from the charm's tile to the monster's feet), shaking taut
      for (const sv of saves) {
        const b = bodies.find((x) => x.uid === sv.saved);
        if (!b?.ghost || b.yank < 0 || el > b.yank + 330) continue;
        const from = zoneXY(sv.owner, 'spellTrap', sv.zone);
        const to = { x: b.ghost.x, y: b.ghost.y - 2 };
        const grow = Math.min(1, (el - b.yank) / 90);
        const ex = from.x + (to.x - from.x) * grow;
        const ey = from.y - 4 + (to.y - from.y + 4) * grow;
        const late = el > b.yank + 250;
        r.line(from.x, from.y - 4, ex, ey, late ? PAL.gold2 : PAL.gold3);
        if (!late) r.line(from.x + 1, from.y - 4, ex + 1, ey, PAL.gold4);
      }
      // the tear: swells at the bottom of the slit, falls (ease-in) to the middle of the field
      if (el >= T.tear && el < T.land) {
        const sy = eye.y + EH + 2;
        const grow = seg(el, T.tear, T.tearFall - T.tear);
        const fall = ease.in(seg(el, T.tearFall, T.land - T.tearFall));
        const x = eye.x;
        const y = R(sy + (fieldMid.y - 4 - sy) * fall);
        const big = grow > 0.5 ? 1 : 0;
        (tearLight as LightHandle | null)?.setPosition(x, y, fieldMid.y);
        // the drop: a 5-px wide body (void3, a void4 lit left side, a white glint), a 1-px tip, ink outline; a
        // short violet trail above it while it falls
        const h = big ? 1 : 0;
        r.px(x, y - 4 - h, PAL.ink);
        r.px(x, y - 3 - h, PAL.void3);
        r.rect(x - 1, y - 2 - h, 3, 1, PAL.void3);
        r.rect(x - 2, y - 1, 5, 2 + h, PAL.void3);
        r.rect(x - 1, y + 1 + h, 3, 1, PAL.void2);
        r.px(x - 2, y - 1, PAL.void4);
        r.px(x - 1, y - 2 - h, PAL.void4);
        r.px(x - 1, y - 1, PAL.white);
        r.px(x - 3, y, PAL.ink);
        r.px(x + 3, y, PAL.ink);
        r.px(x - 2, y + 1 + h, PAL.ink);
        r.px(x + 2, y + 1 + h, PAL.ink);
        r.rect(x - 1, y + 2 + h, 3, 1, PAL.ink);
        if (fall > 0.15) r.rect(x, y - 8 - h, 1, 3, PAL.void2);
        if (fall > 0.45) r.rect(x, y - 13 - h, 1, 4, PAL.void1);
      }
    });
    // falling glass flakes from the rift
    if (el < T.lid + 200 && el > 60 && rng() < dtS / 45) {
      const yy = eye.y + R((rng() - 0.5) * 2 * EH * S.crack);
      motes.add({ x: eye.x + (rng() < 0.5 ? -2 : 2), y: yy, vx: (rng() - 0.5) * 30, vy: 10, g: 140, life: 420, c: rng() < 0.5 ? PAL.mist : PAL.void4 });
    }
  });

  // ================================ the cards go to the graveyards
  const flights: Promise<void>[] = [];
  let k = 0;
  for (const t of doomedTiles) if (t.active) t.setHighlight(null);
  for (const b of bodies) {
    if (b.kind === 'saved') {
      b.ghost?.destroy();
      b.unit?.show();
      b.unit?.settle();
      continue;
    }
    b.ghost?.destroy();
    const { tile } = field.release(b.uid);
    field.forget(b.uid);
    if (b.kind === 'token') {
      if (tile) {
        for (let m = 0; m < 10; m++) motes.add({ x: b.floor.x + R((rng() - 0.5) * 24), y: b.floor.y + R((rng() - 0.5) * 8), vy: -30 - rng() * 30, life: 380, c: PAL.void3 });
        flights.push(tile.fadeOut(220).then(() => tile.destroy()));
      }
      continue;
    }
    flights.push(cardLeaves(ctx, { owner: b.owner, cardId: b.cardId, from: tile ? tile.home : b.floor, tile, delay: k * 30, ms: 320 }));
    k++;
  }
  for (const c of cards) {
    const { tile } = field.release(c.uid);
    flights.push(cardLeaves(ctx, { owner: c.owner, cardId: c.cardId, from: tile ? tile.home : zoneXY(c.owner, 'spellTrap', 0), tile, delay: k * 30, ms: 320 }));
    k++;
  }
  // the motes of the crumbling tokens keep drawing while the cards fly
  const tail = run(sc, 420, (_t, _el, dt) => {
    motes.step(dt);
    air.draw((r) => motes.draw(r));
    floor.draw(() => undefined);
    sky.draw(() => undefined);
  });
  await Promise.all([...flights, tail, ...words]);
  sky.destroy();
  air.destroy();
  floor.destroy();
  for (const b of bodies) b.light?.destroy();
  // whatever else came with the wipe (stat changes, hats) plays now, in order
  for (const i of later) if (!ctx.isConsumed(i)) await ctx.play(i);
}
