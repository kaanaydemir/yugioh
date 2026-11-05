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
//          a night veil (ink, over the sky / stadium / floor / tiles, under the tile glows, the cards and the units)
//          steps down in 4 visible steps to 0.5, the light layer dims fully — e_voidDim
//   ~380   release: a violet orb leaves the card's top edge and zips straight up to the sky point over the field;
//          the spent card drops to its graveyard behind it (card continuity)
// The massDestroy (registerLaneE, this file) — ONE collective scene for every per-card event of the wipe:
//   +0     THE RIFT: a star flare where the orb hits; a vertical 1-px white crack with violet lips zig-zags down and
//          up the sky (4 stepped growths), short side cracks branch off, glass flakes of the sky fall — e_voidRift.
//          The sky layer (rift + eye) lies OVER the night veil but UNDER the tile glows, the cards and every unit:
//          the eye hangs in the sky BEHIND the back row (a back-row monster stands in front of it)
//   +220   THE LIDS OPEN sideways (stepped, eased): a vertical almond EYE 45×81 px — night lids with a lit lip,
//          violet-black sclera, a ringed violet iris (turning fibres), a black STARRY pupil with twinkling
//          stars and a white catch-light; a violet light pool breathes under it — e_voidLid ("şııııp")
//   +580   it looks round: the iris twitches left, right (searching)
//   +740   THE GAZE falls: the iris drops 6 px, a violet light washes over the field, every doomed tile lights violet,
//          face-down cards are seen through and flip face up one after another — e_voidGaze, e_voidReveal ×n;
//          the 28 Hz swell starts under it — e_voidSwell
//   +860   THE COLLECTIVE RISE: every monster (both sides, tokens and magic_hat decoys too) squats 1 px, tears off
//          the floor with a 2-px snap and floats up to its own seat on a U-shaped crown that cradles the eye (left
//          bodies on the left arm, right on the right, the outer seats higher) — slowly, together — turning round on
//          the way (3 facing flips, each with a one-frame violet edge silhouette), swaying 1 px; their shadows shrink
//          on the floor, motes rise from their tiles — e_voidRise (the upward choir, no tremolo)
//   +1180  a GUARDIAN CHARM answers: its tile flares gold, a gold tether snaps up to its monster and yanks it back
//          down onto its tile (thud, dust, a gold ring); "KORUNDU" shows over its head for 450 ms and is gone
//          before the contraction — e_voidSave, e_voidThud
//   +1900  THE PUPIL CONTRACTS (two stepped frames, 7 → 4 → 2 px) — e_voidTick (dry, close); 70 ms hit-stop; every
//          risen body flashes WHITE for one frame, then becomes a flat void3 silhouette with a void4 rim (tint
//          FILLS only: palette colours, never a multiply)
//   +1960  THE PULL: every silhouette is snapped to the pupil in 4 stepped, accelerating frames (positions only),
//          10 ms apart, 1-px streak trails converging on the pupil behind them; each body pops into a dense mote
//          burst at the pupil rim (the pupil flicks white on each), its tile flashes violet and goes dark —
//          e_voidGulp (reverse glass suction → glass pinch); the swell and the choir stop
//   +2200  the pupil GULPS (2 → 5 → 4 → 3): an iris-ring flash and a 2-frame white rim on the lids, a violet flash
//          leaves the eye
//   +2330  THE EYE CLOSES (lids slide shut in 120 ms) — e_voidBlink; the cards go home now (each destroyed card
//          lifts off its tile and arcs to its owner's graveyard, 45 ms apart, a soft glass tick as it lands —
//          e_voidCard, max 3 voices); a token / decoy has no card: it went into the eye whole
//   +2520  BLINK 1 (opens a crack 0.35 in 3 steps, shuts in 3), a fully shut hold of 100 ms,
//   +2740  BLINK 2 — e_voidBlink on each shut
//   +2900  THE TEAR: one purple drop (7×10 with a highlight) swells at the bottom of the slit in 3 frames, hangs,
//   +3020  falls with smear frames (ease-in) onto the centre of the board;
//   +3240  it LANDS: two stepped splash rings (void4 then void3, ~48 px), a crown of 8 droplets, a violet stain on
//          the floor fading in steps, a strong violet floor flash, 3 px shake — e_voidDrip; the slit is gone, the
//          night veil lifts in 4 steps
//   +3700  end
// The ground NEVER opens (YENI_KARTLAR: "zemin hiç açılmaz"): everything goes UP.

import Phaser from 'phaser';
import type { CardId } from '../../data/cards';
import type { GameEvent, PlayerId, Uid } from '../../engine/types';
import { ISO_CX, ISO_CY, ISO_TEX_H, ISO_TEX_W, cardIsoKey } from '../../art/cards';
import { PAL } from '../../art/palette';
import { BOARD_CENTER, DEPTH, GAME_H, GAME_W, LOOK_V3, type XY, zoneXY } from '../../view/layout';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import type { TileCard } from '../../view/TileCard';
import { dropHat, getHat } from '../../view/hats';
import { Raster, freeze, run, spriteBox } from '../../vfx/setpieces';
import { shake, wait } from '../../vfx/core';
import { pixelText } from '../../ui/text';
import { fxRng } from '../_v3/spellfx';
import { panAt, play as playV3, start as startV3 } from '../_v3/sound';
import { landingCount } from '../_v3/card';
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
  return { x: R(BOARD_CENTER.x), y: Math.max(54, R(BOARD_CENTER.y - 120)) };
}
/** The sky layer: over the night veil, under the tile glows (TILE_FX), the cards and the units. */
const SKY_DEPTH = DEPTH.TILE_FX - 0.3;
/** The night veil: over the light layer's own dim (TILE_FX − 0.5), under the sky layer. */
const NIGHT_DEPTH = DEPTH.TILE_FX - 0.4;

// ================================================================ timings (scene ms from the massDestroy)

const T = {
  rift: 0,
  riftMs: 200,
  lid: 220,
  lidMs: 360,
  look: 580,
  gaze: 740,
  lift: 860,
  liftMs: 1000,
  save: 1180,
  contract: 1900,
  pull: 1960,
  /** 4 stepped frames per body */
  pullStep: 40,
  pullStagger: 10,
  gulp: 2200,
  close: 2330,
  closeMs: 120,
  cards: 2330,
  blink1: 2520,
  blink2: 2740,
  tear: 2900,
  tearFall: 3020,
  land: 3240,
  end: 3700,
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

/** One blink: 6 frames × 20 ms — opens a crack (0.12 → 0.24 → 0.35), shuts (0.24 → 0.12 → 0). */
const BLINK = [0.12, 0.24, 0.35, 0.24, 0.12, 0] as const;
const BLINK_MS = 120;

/** The eye's lid opening (0 shut … 1 open) at `el`. */
function lidAt(el: number): number {
  if (el < T.lid) return 0;
  if (el < T.close) return q(ease.out(seg(el, T.lid, T.lidMs)), 7);
  if (el < T.close + T.closeMs) return 1 - q(seg(el, T.close, T.closeMs), 4);
  for (const b of [T.blink1, T.blink2]) {
    const u = el - b;
    if (u >= 0 && u < BLINK_MS) return BLINK[Math.floor(u / 20)];
  }
  return 0;
}

// ================================================================ the night veil (shared by the hook and the wipe)

/** Stepped alpha levels of the night veil going down / coming back up. */
const NIGHT_DOWN = [0.14, 0.26, 0.38, 0.5] as const;
const NIGHT_UP = [0.36, 0.22, 0.1, 0] as const;
const nights = new WeakMap<Phaser.Scene, Phaser.GameObjects.Rectangle>();

/** The lights go down: an ink veil in 4 visible steps (110 ms apart) + the light layer's own full dim. */
function nightDown(sc: Phaser.Scene): void {
  if (nights.get(sc)?.active) return;
  const r = sc.add.rectangle(-8, -8, GAME_W + 16, GAME_H + 16, PAL.ink, 1).setOrigin(0).setDepth(NIGHT_DEPTH).setAlpha(0);
  nights.set(sc, r);
  void lightDim(sc, 1, 440);
  NIGHT_DOWN.forEach((a, i) =>
    bg(
      wait(sc, i * 110).then(() => {
        if (r.active && nights.get(sc) === r) r.setAlpha(a);
      }),
    ),
  );
}

/** The lights come back up in 4 steps (90 ms apart); the veil is removed. */
async function nightUp(sc: Phaser.Scene): Promise<void> {
  const r = nights.get(sc);
  void lightDim(sc, 0, 500);
  if (!r) return;
  nights.delete(sc);
  for (const a of NIGHT_UP) {
    if (!r.active) return;
    r.setAlpha(a);
    await wait(sc, 90);
  }
  r.destroy();
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
  /** the gulp: 1 = the iris' outer ring flashes white, 2 = + a white rim on the lids */
  flash: number;
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
        // lids: left lid lit (mist lip, night4 skin), right lid shaded; ink outline (white on the gulp's rim frames)
        const k = a - hw;
        const col =
          k === 4
            ? s.flash >= 2
              ? PAL.white
              : PAL.ink
            : dx < 0
              ? k === 1
                ? PAL.mist
                : k === 2
                  ? PAL.night4
                  : PAL.night3
              : k === 1
                ? s.flash >= 2
                  ? PAL.mist
                  : PAL.night4
                : k === 2
                  ? PAL.night3
                  : PAL.night2;
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
      } else if (d <= IRIS) col = s.flash >= 1 ? PAL.white : PAL.void1;
      else if (d <= IRIS + 1 && s.flash >= 1) col = PAL.void4;
      else col = PAL.void0;
      // lid shadow inside the lens: the shaded (right) side one ink row, the lit side a void1 band
      if (a >= hw - 1 && d > IRIS + 1) col = dx > 0 ? PAL.ink : PAL.void1;
      // catch-light (one bright glint, top left of the pupil) + a small second one
      const cxl = -Math.max(1, R(s.rp * 0.4));
      const cyl = -Math.max(1, R(s.rp * 0.45));
      if ((ux === cxl && (uy === cyl || uy === cyl + 1)) || (ux === cxl + 1 && uy === cyl && s.rp >= 4)) col = PAL.white;
      r.px(x, y, col);
    }
  }
  // lashes: short ink spikes on each lid, pointing out and down
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
  kind: 'monster' | 'token' | 'saved' | 'decoy';
  unit: MonsterUnit | null;
  tile: TileCard | null;
  faceDown: boolean;
  ghost: Phaser.GameObjects.Sprite | null;
  /** the silhouette's 1-px rim (4 fill copies, one pixel out) from the contraction on */
  rims: Phaser.GameObjects.Sprite[];
  /** the ghost's start (sprite position) and its floor point */
  x0: number;
  y0: number;
  floor: XY;
  /** the ghost's position minus its opaque box centre (so the body is steered by its centre) */
  offX: number;
  offY: number;
  /** the risen seat: the ghost position at the end of the rise */
  tx: number;
  ty: number;
  /** where the pull starts (ghost position at the contraction) */
  px0: number;
  py0: number;
  /** the pull's start (scene ms) */
  pullAt: number;
  ph: number;
  /** the three facing flips (scene ms) */
  flips: number[];
  edgeUntil: number;
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

/** A spell / trap card that breaks with the wipe (a charm, an equip): it leaves its tile with the others. */
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
    nightDown(sc);
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
    void nightUp(sc);
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
    } else if (e.type === 'decoyPopped' && e.cause === 'destroyed') {
      // a magic_hat decoy: its hat rises with the others and goes into the eye (no pop of its own)
      ctx.consumeAt(i);
      bodies.push(newBody(e.uid, 'magic_hat', e.player, e.zone, e.player, 'decoy', null, field.tileOf(e.uid)));
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
    faceDown: kind !== 'decoy' && (!unit || !unit.sprite.visible),
    ghost: null,
    rims: [],
    x0: floor.x,
    y0: floor.y,
    floor: { x: R(floor.x), y: R(floor.y) },
    offX: 0,
    offY: 0,
    tx: floor.x,
    ty: floor.y,
    px0: floor.x,
    py0: floor.y,
    pullAt: T.pull,
    ph: 0,
    flips: [],
    edgeUntil: -1,
    gone: false,
    light: null,
    yank: -1,
    landed: false,
  };
}

/** Swap a body's unit (or a decoy's hat) for a free sprite copy that keeps animating (the original hides). */
function ghostOf(sc: Phaser.Scene, b: Body): void {
  let g: Phaser.GameObjects.Sprite | null = null;
  if (b.kind === 'decoy') {
    const h = getHat(sc, b.uid);
    if (!h || !h.img.active) return;
    const im = h.img;
    g = sc.add.sprite(R(im.x), R(im.y), im.texture.key, im.frame.name).setOrigin(im.originX, im.originY);
    dropHat(sc, b.uid);
  } else {
    const u = b.unit;
    if (!u) return;
    const s = u.sprite;
    g = sc.add.sprite(R(s.x), R(s.y), s.texture.key, s.frame.name).setOrigin(s.originX, s.originY).setFlipX(s.flipX);
    const anim = s.anims?.currentAnim;
    if (anim) {
      try {
        g.play({ key: anim.key, startFrame: Math.max(0, Math.min(anim.frames.length - 1, (s.anims.currentFrame?.index ?? 1) - 1)) });
      } catch {
        /* a still copy is fine */
      }
    }
    u.hide();
  }
  g.setDepth(DEPTH.FX + 2 + g.y / 1000);
  b.ghost = g;
  b.x0 = g.x;
  b.y0 = g.y;
  const box = spriteBox(sc, g);
  b.offX = R(g.x - box.cx);
  b.offY = R(g.y - box.cy);
}

/**
 * The risen seats: a U-shaped crown cradling the eye. Bodies left of the eye take the left arm, the others the
 * right; the seat nearest the eye is the lowest, the outer ones climb. Every body rises at least 34 px.
 */
function seat(bodies: Body[], eye: XY): void {
  const rise = bodies.filter((b) => b.kind !== 'saved' && b.ghost);
  for (const side of [-1, 1] as const) {
    const arm = rise.filter((b) => (side < 0 ? b.x0 < eye.x : b.x0 >= eye.x)).sort((a, b) => Math.abs(a.x0 - eye.x) - Math.abs(b.x0 - eye.x));
    const n = arm.length;
    const step = n > 1 ? Math.min(30, 118 / (n - 1)) : 0;
    arm.forEach((b, j) => {
      const cx = eye.x + side * (EW + 24 + j * step);
      const cy = eye.y + 30 - j * (n > 1 ? 44 / Math.max(1, n - 1) : 0) - (j === 0 ? 0 : 4);
      const box = cy0Of(b);
      b.tx = R(cx + b.offX);
      b.ty = R(Math.min(cy, box - 34) + b.offY);
    });
  }
  for (const b of bodies) {
    if (b.kind !== 'saved' || !b.ghost) continue;
    b.tx = b.x0 + R((eye.x - b.x0) * 0.08);
    b.ty = b.y0 - 22;
  }
}
const cy0Of = (b: Body) => b.y0 - b.offY;

/** Lay a 1-px rim of fill copies under a silhouette. */
function rimOf(sc: Phaser.Scene, b: Body, color: number): void {
  const g = b.ghost;
  if (!g) return;
  for (const r of b.rims) r.destroy();
  b.rims = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ].map(([dx, dy]) =>
    sc.add
      .sprite(g.x + dx, g.y + dy, g.texture.key, g.frame.name)
      .setOrigin(g.originX, g.originY)
      .setFlipX(g.flipX)
      .setDepth(g.depth - 0.001)
      .setTintFill(color)
      .setData('d', [dx, dy]),
  );
}
function moveRims(b: Body): void {
  const g = b.ghost;
  if (!g) return;
  for (const r of b.rims) {
    const [dx, dy] = r.getData('d') as [number, number];
    r.setPosition(g.x + dx, g.y + dy).setVisible(g.visible);
  }
}

/** A destroyed card goes home: it lifts off its tile and arcs to its owner's graveyard; a glass tick on landing. */
async function cardHome(ctx: MassCtx, owner: PlayerId, cardId: CardId, from: XY, tile: TileCard | null, delay: number): Promise<void> {
  const sc = ctx.scene;
  if (delay) await wait(sc, delay);
  if (!sc.sys.isActive()) {
    if (tile?.active) tile.destroy();
    return;
  }
  const pile = ctx.views.field.pile(owner, 'graveyard');
  const key = cardIsoKey(cardId, 'up', owner);
  const a = { x: R(from.x), y: R(from.y) };
  const img = sc.add.image(a.x, a.y, key).setOrigin(ISO_CX / ISO_TEX_W, ISO_CY / ISO_TEX_H).setDepth(DEPTH.FX + 5);
  if (tile?.active) tile.destroy();
  // one violet fill frame (the eye's mark on it), then the card itself
  img.setTintFill(PAL.void4);
  await wait(sc, 30);
  if (!img.active) return;
  img.clearTint();
  const to0 = pile.topXY();
  const to = { x: R(to0.x), y: R(to0.y) };
  const dist = Math.hypot(to.x - a.x, to.y - a.y);
  const ms = R(220 + Math.min(160, dist * 0.45));
  const arc = R(Math.min(30, 12 + dist * 0.1));
  await run(sc, ms, (t) => {
    if (!img.active) return;
    const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    img.setPosition(R(a.x + (to.x - a.x) * e), R(a.y + (to.y - a.y) * e - 4 * (1 - e) - arc * Math.sin(Math.PI * e)));
  });
  const count = landingCount(pile.count, ctx.after?.players?.[owner]?.graveyard?.length);
  pile.set(count, cardId);
  pile.bump();
  playV3('e_voidCard', { volume: 0.55, pan: panAt(to.x) });
  if (img.active) img.destroy();
}

async function voidEyeWipe(ctx: MassCtx): Promise<void> {
  const sc = ctx.scene;
  const field = ctx.views.field;
  const eye = eyeAt();
  const { bodies, saves, cards, later } = collect(ctx);
  const rng = fxRng(eye.x * 31 + bodies.length * 7 + 5);
  nightDown(sc); // no-op when the activation hook already dimmed
  bodies.forEach((b, i) => {
    b.ph = rng() * Math.PI * 2;
    // three facing flips spread over the rise, each body on its own beat
    const o = (i * 47) % 130;
    b.flips = [T.lift + 220 + o, T.lift + 520 + o, T.lift + 820 + o].filter((t) => t < T.contract - 40);
  });
  for (const c of cards) c.tile = field.tileOf(c.uid);

  // ---- the canvases: the sky (the eye, behind the units), the air (motes, streaks, tether, tear), the floor
  const sky = Raster.around(sc, eye.x, eye.y, EW * 2 + 14, (EH + 22) * 2, SKY_DEPTH);
  const air = new Raster(sc, 0, 0, 640, 360, DEPTH.FX + 6);
  const floor = new Raster(sc, 0, 0, 640, 360, DEPTH.TILE_FX + 2);
  const motes = new Motes();
  const S: EyeState = { crack: 0, open: 0, ix: 0, iy: 0, rp: 9, glow: 0, el: 0, fade: 0, flash: 0 };
  const pupil = (): XY => ({ x: eye.x + S.ix, y: eye.y + S.iy });

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
  const flights: Promise<void>[] = [];
  const doomedTiles = bodies.filter((b) => b.kind !== 'saved' && b.tile).map((b) => b.tile!);
  /** the last pupil arrival (the pupil flicks white for 2 frames on each) */
  let lastBite = -999;
  /** streak trails left by the pull: [x0, y0, x1, y1, born] */
  const streaks: [number, number, number, number, number][] = [];

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
    // the pupil: dilates as it looks, contracts in two stepped frames, bites on each arrival, gulps
    if (el < T.contract) S.rp = el >= T.gaze ? 7 : 6;
    else if (el < T.contract + 40) S.rp = 4;
    else if (el < T.gulp) S.rp = el - lastBite < 34 ? 3 : 2;
    else if (el < T.gulp + 40) S.rp = 5;
    else if (el < T.gulp + 90) S.rp = 4;
    else S.rp = 3;
    S.glow = el >= T.contract && el < T.contract + 50 ? 2 : el - lastBite < 34 ? 2 : el >= T.pull && el < T.gulp + 60 ? 1 : el >= T.gaze ? 0.6 : 0;
    S.flash = el >= T.gulp && el < T.gulp + 34 ? 2 : el >= T.gulp && el < T.gulp + 80 ? 1 : 0;
    S.fade = el < T.blink2 + BLINK_MS + 160 ? 0 : el < T.land ? 0.6 : 1;

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
        .filter((b) => b.faceDown && b.tile && b.kind !== 'decoy')
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
          // a revealed body steps out of its card: one violet fill frame
          b.ghost.setTintFill(PAL.void4);
          b.edgeUntil = el + 50;
        }
        if (b.ghost) b.light = lightPool(sc, b.x0, b.y0 - 12, { color: PAL.void3, radius: 14, floorY: b.y0, air: 0.35, intensity: 0.7, anim: 'breathe' });
      }
      seat(bodies, eye);
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
        b.ghost.setTintFill(PAL.white);
      }
    });
    once('silhouette', el, T.contract + 40, () => {
      // a flat violet silhouette inside a one-pixel void4 rim (fills only: palette colours)
      const order = bodies.filter((b) => b.kind !== 'saved' && b.ghost).sort((a, c) => Math.hypot(a.ghost!.x - eye.x, a.ghost!.y - eye.y) - Math.hypot(c.ghost!.x - eye.x, c.ghost!.y - eye.y));
      order.forEach((b, k) => {
        b.ghost!.setTintFill(PAL.void3);
        rimOf(sc, b, PAL.void4);
        b.px0 = b.ghost!.x;
        b.py0 = b.ghost!.y;
        b.pullAt = T.pull + k * T.pullStagger;
      });
    });
    once('pull', el, T.pull, () => {
      playV3('e_voidGulp', { volume: 1 });
      (swell as { stop(ms?: number): void } | null)?.stop(300);
      (choir as { stop(ms?: number): void } | null)?.stop(220);
    });
    once('gulp', el, T.gulp, () => {
      void lightFlash(sc, eye.x, eye.y, PAL.void4, 70, 380, { floorY: fieldMid.y, air: 0.9, intensity: 1.2 });
      (gazeBeam as BeamHandle | null)?.fadeOut(200);
      (gazeLight as LightHandle | null)?.setIntensity(0.4, 200);
      for (const b of bodies) if (b.kind !== 'saved') void b.light?.fadeOut(120);
    });
    once('close', el, T.close + 60, () => playV3('e_voidBlink', { volume: 0.9 }));
    once('cards', el, T.cards, () => {
      // the cards go home while the eye blinks
      let k = 0;
      for (const t of doomedTiles) if (t.active) t.setHighlight(null);
      for (const b of bodies) {
        if (b.kind !== 'monster') continue;
        const { tile } = field.release(b.uid);
        field.forget(b.uid);
        flights.push(cardHome(ctx, b.owner, b.cardId, tile ? tile.home : b.floor, tile, k * 45));
        k++;
      }
      for (const c of cards) {
        const { tile } = field.release(c.uid);
        flights.push(cardHome(ctx, c.owner, c.cardId, tile ? tile.home : zoneXY(c.owner, 'spellTrap', 0), tile, k * 45));
        k++;
      }
    });
    once('blink1', el, T.blink1 + 100, () => playV3('e_voidBlink', { volume: 0.7, pitch: 1.08 }));
    once('blink2', el, T.blink2 + 100, () => playV3('e_voidBlink', { volume: 0.6, pitch: 1.16 }));
    once('tearLight', el, T.tear, () => {
      tearLight = lightPool(sc, eye.x, eye.y + EH, { color: PAL.void4, radius: 18, floorY: fieldMid.y, air: 0.7, airRadius: 10, intensity: 1, fadeIn: 60 });
      (eyeLight as LightHandle | null)?.setIntensity(0.4, 300);
    });
    once('land', el, T.land, () => {
      playV3('e_voidDrip', { volume: 1, pan: panAt(fieldMid.x) });
      void (tearLight as LightHandle | null)?.fadeOut(120);
      void shake(sc, 160, 3);
      void lightFlash(sc, fieldMid.x, fieldMid.y, PAL.void4, 70, 560, { intensity: 1.8, ring: true });
      void (eyeLight as LightHandle | null)?.fadeOut(400);
      void (gazeLight as LightHandle | null)?.fadeOut(500);
      bg(wait(sc, 120).then(() => nightUp(sc)));
      // the crown of droplets
      for (let k = 0; k < 8; k++) {
        const a = Math.PI + (k / 7) * Math.PI;
        motes.add({ x: fieldMid.x + R(Math.cos(a) * 3), y: fieldMid.y - 1, vx: Math.cos(a) * (44 + (k % 2) * 16), vy: -50 - (k % 3) * 22 + Math.sin(a) * 10, g: 340, life: 340, c: k % 2 ? PAL.void4 : PAL.white });
      }
    });

    // ================================ bodies
    const dtS = Math.max(0, el - last);
    last = el;
    motes.step(dtS);
    const pp = pupil();
    for (const b of bodies) {
      const g = b.ghost;
      if (!g || !g.active || b.gone) continue;
      // ---- THE PULL: 4 stepped, accelerating frames to the pupil; then a mote burst at the rim
      if (b.kind !== 'saved' && el >= T.pull && fired.has('silhouette')) {
        const u = el - b.pullAt;
        if (u < 0) {
          moveRims(b);
          continue;
        }
        const FR = [0.1, 0.32, 0.64, 1] as const;
        const fi = Math.min(3, Math.floor(u / T.pullStep));
        const f = FR[fi];
        const cx0 = b.px0 - b.offX;
        const cy0 = b.py0 - b.offY;
        const cx = R(cx0 + (pp.x - cx0) * f);
        const cy = R(cy0 + (pp.y - cy0) * f);
        if (fi < 3) {
          g.setPosition(cx + b.offX, cy + b.offY);
          moveRims(b);
          if (!g.getData('s' + fi)) {
            g.setData('s' + fi, true);
            const box = spriteBox(sc, g);
            // three streaks from where it hung: its top, centre and bottom, converging on the pupil
            const hh = R(box.h / 2);
            streaks.push([cx0, cy0 - hh, cx, cy - R(hh * (1 - f)), el], [cx0, cy0, cx, cy, el], [cx0, cy0 + hh, cx, cy + R(hh * (1 - f)), el]);
          }
        } else {
          // arrival: it pops into a dense burst at the pupil rim and is gone
          b.gone = true;
          g.setVisible(false);
          moveRims(b);
          lastBite = el;
          for (let m = 0; m < 14; m++) {
            const a = (m / 14) * Math.PI * 2 + b.ph;
            const rr = S.rp + 4 + (m % 3) * 2;
            motes.add({ x: pp.x + Math.cos(a) * rr, y: pp.y + Math.sin(a) * rr, to: pp, life: 90 + (m % 4) * 30, c: m % 3 === 0 ? PAL.white : m % 3 === 1 ? PAL.void4 : PAL.void3 });
          }
          // its tile flashes and goes dark; a token / decoy tile crumbles (it has no card to keep)
          if (b.tile?.active) {
            b.tile.setHighlight(null);
            void b.tile.pulse(PAL.void4, 200);
          }
          if (b.kind === 'token' || b.kind === 'decoy') {
            const { tile } = field.release(b.uid);
            field.forget(b.uid);
            if (b.kind === 'decoy') field.remove(b.uid);
            if (tile) {
              for (let m = 0; m < 10; m++) motes.add({ x: b.floor.x + R((rng() - 0.5) * 24), y: b.floor.y + R((rng() - 0.5) * 8), vy: -30 - rng() * 30, life: 380, c: m % 2 ? PAL.void4 : PAL.void3 });
              flights.push(tile.fadeOut(200).then(() => tile.destroy()));
            }
          }
        }
        continue;
      }
      // ---- the rise: squat 1 px (anticipation), snap 2 px (tears off), then the slow float to its seat
      let gx = b.x0;
      let gy = b.y0;
      if (el >= T.lift) {
        const k = el - T.lift;
        if (k < 60) gy = b.y0 + 1;
        else if (k < 110) gy = b.y0 - 2;
        else {
          const e = ease.inOut((k - 110) / (T.liftMs - 110));
          gx = b.x0 + (b.tx - b.x0) * e;
          gy = b.y0 - 2 + (b.ty - b.y0 + 2) * e;
        }
        // keep breathing after the rise ends (nothing stands still): 1 px up / down
        if (k > T.liftMs) gy += Math.floor((k - T.liftMs) / 180) % 2 ? -1 : 0;
      }
      const sway = el >= T.lift + 110 ? Math.round(Math.sin(el / 300 + b.ph)) : 0;
      // the guardian charm's save: yanked down in 160 ms (ease-in), lands, stays
      if (b.kind === 'saved' && b.yank >= 0) {
        const y = seg(el, b.yank + 90, 160);
        const held = 1 - ease.in(y);
        gy = b.y0 - Math.max(0, Math.min(b.y0 - gy, (b.y0 - b.ty) * 0.6 + 2) * held);
        gx = b.x0 + (gx - b.x0) * held;
        if (y >= 1 && !b.landed) {
          b.landed = true;
          playV3('e_voidThud', { volume: 0.9, pan: panAt(b.floor.x) });
          void shake(sc, 90, 1);
          b.tile?.ringBurst(PAL.gold3, 360);
          b.tile?.dust(10, 0.8);
          g.setTintFill(PAL.gold4);
          b.edgeUntil = el + 40;
          // "KORUNDU" just over its head (kept under the eye's tip), 450 ms, gone before the contraction
          const top = spriteBox(sc, g).top;
          const wy = R(Math.max(eye.y + EH + 14, top - 3));
          const w = pixelText(sc, b.floor.x, wy, 'KORUNDU', { size: 'md', color: PAL.gold3 }).setOrigin(0.5, 1).setDepth(DEPTH.FX_TOP);
          const life = Math.min(450, Math.max(200, T.contract - 20 - el));
          words.push(
            run(sc, life, (t) => {
              w.y = R(wy - q(t, 4) * 4);
              w.setVisible(t < 0.8 || Math.floor(t * 16) % 2 === 0);
            }).then(() => w.destroy()),
          );
        }
        if (b.landed) {
          gx = b.x0;
          gy = b.y0;
        }
      }
      g.x = R(gx + (b.landed ? 0 : sway));
      g.y = R(gy);
      // turning: three facing flips, each with a one-frame violet edge silhouette (no rotation, no scale)
      if (el < T.contract && !(b.kind === 'saved' && b.yank >= 0) && b.flips.length && el >= b.flips[0]) {
        b.flips.shift();
        g.setFlipX(!g.flipX);
        g.setOrigin(1 - g.originX, g.originY);
        g.setTintFill(PAL.void4);
        b.edgeUntil = el + 40;
      }
      if (b.edgeUntil >= 0 && el >= b.edgeUntil && el < T.contract) {
        b.edgeUntil = -1;
        g.clearTint();
      }
      b.light?.setPosition(g.x, g.y - 14, b.floor.y);
      // motes rising off its tile while it floats
      if (el >= T.lift && el < T.contract && b.kind !== 'saved' && rng() < dtS / 70) {
        motes.add({ x: b.floor.x + R((rng() - 0.5) * 22), y: b.floor.y + R((rng() - 0.5) * 6), vy: -26 - rng() * 20, life: 520, c: rng() < 0.3 ? PAL.void4 : PAL.void3 });
      }
    }

    // ================================ draw
    sky.draw((r) => drawEye(r, eye, S));
    floor.draw((r) => {
      // shrinking shadows under the risen bodies (stepped radii)
      for (const b of bodies) {
        if (!b.ghost || b.gone || el < T.lift || el >= T.pull || (b.kind === 'saved' && b.landed)) continue;
        const h = b.y0 - b.ghost.y;
        const rx = Math.max(2, 9 - Math.floor(h / 12));
        const ry = Math.max(1, rx >> 1);
        for (let yy = -ry; yy <= ry; yy++) {
          const w = Math.floor(rx * Math.sqrt(1 - (yy * yy) / ((ry + 0.5) * (ry + 0.5))));
          for (let xx = -w; xx <= w; xx++) r.px(b.floor.x + xx, b.floor.y + yy, PAL.ink, 150);
        }
      }
      // the tear's landing: two stepped splash rings (void4 first, void3 behind it) and a stain that fades in steps
      if (el >= T.land) {
        const u = el - T.land;
        const ring = (startMs: number, maxR: number, col: number) => {
          const v = seg(u, startMs, 300);
          if (v <= 0 || v >= 1) return;
          const rx = R(4 + q(ease.out(v), 6) * maxR);
          const ry = Math.max(2, rx >> 1);
          const c = v > 0.7 ? PAL.void2 : col;
          // a 2-px band (the outer ring and one pixel inside it), whole pixels
          for (let a = 0; a < 160; a++) {
            const ang = (a / 160) * Math.PI * 2;
            const cs = Math.cos(ang);
            const sn = Math.sin(ang);
            r.px(R(fieldMid.x + cs * rx), R(fieldMid.y + sn * ry), c);
            r.px(R(fieldMid.x + cs * (rx - 1)), R(fieldMid.y + sn * Math.max(1, ry - 1)), c);
          }
        };
        ring(0, 22, PAL.void4);
        ring(70, 16, PAL.void3);
        // the stain (stepped tones)
        const sc3 = u < 140 ? PAL.void4 : u < 260 ? PAL.void3 : u < 380 ? PAL.void2 : u < 460 ? PAL.void1 : -1;
        if (sc3 >= 0) {
          for (let yy = -2; yy <= 2; yy++) {
            const w = [3, 6, 7, 6, 3][yy + 2];
            for (let xx = -w; xx <= w; xx++) r.px(fieldMid.x + xx, fieldMid.y + yy, sc3);
          }
          if (u < 260) r.px(fieldMid.x - 3, fieldMid.y - 1, PAL.white);
        }
      }
    });
    air.draw((r) => {
      // the pull's streaks: converging 1-px lines, stepping down the void ramp as they age
      for (const [x0, y0, x1, y1, born] of streaks) {
        const age = el - born;
        if (age > 130) continue;
        r.line(x0, y0, x1, y1, age < 40 ? PAL.void4 : age < 85 ? PAL.void3 : PAL.void2);
      }
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
      // the tear: swells at the bottom of the slit (3 frames), hangs, falls with smear frames to the board centre
      if (el >= T.tear && el < T.land) {
        const sy = eye.y + EH + 2;
        const sw = el - T.tear;
        const fall = ease.in(seg(el, T.tearFall, T.land - T.tearFall));
        const x = eye.x;
        const y = R(sy + (fieldMid.y - 6 - sy) * fall);
        (tearLight as LightHandle | null)?.setPosition(x, y, fieldMid.y);
        const size = sw < 40 ? 0 : sw < 80 ? 1 : 2;
        if (el < T.tearFall) drawDrop(r, x, sy + [1, 3, 5][size], size, 0);
        else {
          // smear: the stretched drop + two fading ghost copies above it, spaced by the speed
          const v = R(4 + fall * 14);
          drawDrop(r, x, y, 2, Math.min(5, R(fall * 8)));
          if (fall > 0.08) r.rect(x - 1, y - 12 - v, 3, v, PAL.void3);
          if (fall > 0.3) r.rect(x, y - 14 - v * 2, 1, v, PAL.void2);
        }
      }
    });
    // falling glass flakes from the rift
    if (el < T.lid + 200 && el > 60 && rng() < dtS / 45) {
      const yy = eye.y + R((rng() - 0.5) * 2 * EH * S.crack);
      motes.add({ x: eye.x + (rng() < 0.5 ? -2 : 2), y: yy, vx: (rng() - 0.5) * 30, vy: 10, g: 140, life: 420, c: rng() < 0.5 ? PAL.mist : PAL.void4 });
    }
  });

  // ================================ tidy up
  for (const b of bodies) {
    if (b.kind === 'saved') {
      b.ghost?.destroy();
      b.unit?.show();
      b.unit?.settle();
      continue;
    }
    b.ghost?.destroy();
    for (const r of b.rims) r.destroy();
  }
  // the motes of the splash keep drawing while the last cards land
  const tail = run(sc, 160, (_t, _el, dt) => {
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
  // whatever else came with the wipe (stat changes, an attacked decoy) plays now, in order
  for (const i of later) if (!ctx.isConsumed(i)) await ctx.play(i);
}

/**
 * The purple tear (feet at y): size 0 a bead 3×4, 1 a drop 5×7, 2 the full drop 7×10 — a void3 body, a void4 lit
 * left side, a white glint, a void2 belly, ink outline; `stretch` px longer while it falls.
 */
function drawDrop(r: Raster, x: number, y: number, size: 0 | 1 | 2, stretch: number): void {
  if (size === 0) {
    r.rect(x - 1, y - 3, 3, 3, PAL.void3);
    r.px(x - 1, y - 3, PAL.void4);
    r.px(x, y - 4, PAL.ink);
    r.px(x - 2, y - 2, PAL.ink);
    r.px(x + 2, y - 2, PAL.ink);
    r.rect(x - 1, y, 3, 1, PAL.ink);
    return;
  }
  // rows from the top: half widths of the body (a pointed top, round bottom)
  const rows = size === 1 ? [0, 1, 1, 2, 2, 2, 1] : [0, 0, 1, 1, 2, 2, 3, 3, 3, 3, 2];
  const H = rows.length + stretch;
  const top = y - H;
  for (let i = 0; i < H; i++) {
    // the stretched part repeats the narrow upper rows
    const ri = i < stretch ? Math.min(2, i >> 1) : i - stretch;
    const hw = rows[Math.min(rows.length - 1, ri)];
    const yy = top + i;
    r.px(x - hw - 1, yy, PAL.ink);
    r.px(x + hw + 1, yy, PAL.ink);
    for (let dx = -hw; dx <= hw; dx++) {
      let c: number = PAL.void3;
      if (dx === -hw && hw > 0) c = PAL.void4;
      if (i >= H - 3 && dx >= 0 && hw > 1) c = PAL.void2;
      r.px(x + dx, yy, c);
    }
  }
  r.px(x, top - 1, PAL.ink);
  r.rect(x - rows[rows.length - 1], y, rows[rows.length - 1] * 2 + 1, 1, PAL.ink);
  // the highlight
  r.px(x - 1, top + R(H * 0.55), PAL.white);
  if (size === 2) r.px(x - 1, top + R(H * 0.55) + 1, PAL.white);
}
