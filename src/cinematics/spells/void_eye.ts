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
//          on the palette, never with alpha: an INK stamp in 2×2 Bayer quarter steps (¼ → ½) over the sky, the wall,
//          the platform and the pads (under the tile glows, the cards and the units); light is a hole cut in it
//          (the eye's glow on the wall, its gaze on the field) — e_voidDim
//   ~380   release: a violet orb leaves the card's top edge and zips straight up to the sky point over the field;
//          the spent card drops to its graveyard behind it (card continuity)
// The massDestroy (registerLaneE, this file) — ONE collective scene for every per-card event of the wipe:
//   +0     THE RIFT: a star flare where the orb hits; night cloud banks swell in round it (3 steps; lit tops, violet
//          undersides, behind the units); a vertical 1-px white crack with violet lips zig-zags down and up the
//          sky (4 stepped growths; it stops at the eye's bottom tip), side cracks branch off, glass flakes fall —
//          e_voidRift. The eye lies HIGH in the sky over the back wall (its top tip under the phase bar), in front
//          of the units (DEPTH.FX + 1, see SKY_DEPTH)
//   +220   THE LIDS OPEN sideways (7 ease-in steps: a slow slit, then they part fast — synced to the sound): a
//          vertical almond EYE 75 × 81 px — lids with volume (a lit lip, skin, a shaded crease, the outer fold, an
//          ink rim), violet-black sclera, a ringed violet iris (turning fibres), a black STARRY pupil and a white
//          catch-light; the night stamp opens round it (its glow on the wall) — e_voidLid ("şııııp")
//          while open it LIVES: the lid lips flutter 1 px, the pupil breathes 1 px, the stars twinkle every 90 ms
//   +580   it looks round: the iris twitches left, right (searching) — e_voidTwitch ("tk … tk")
//   +740   THE GAZE falls: the iris drops 8 px, the night opens over the field in 3 steps (the violet floor light
//          shows), every doomed tile lights violet, face-down cards flip face up one after another — e_voidGaze,
//          e_voidReveal ×n; the 28 Hz swell starts under it and climbs to the contraction — e_voidSwell; the iris
//          then follows the crown (it leans to the side with more bodies and wanders 1 px); a slow spiral of motes
//          winds into the pupil
//   +860   THE COLLECTIVE RISE: every monster (both sides, tokens and magic_hat decoys too) squats 1 px, tears off
//          the floor with a 2-px snap and ascends WITHOUT EVER PARKING: a curved path (it swings outward, then in)
//          to its seat on a crown fanned out on both sides of the eye, and from 42 % on the whole crown tightens
//          toward the pupil, accelerating (half way in at the contraction); three slow turns each (6 × 35 ms squash
//          turns with a 1-px void4 OUTLINE, never a fill) spread over the rise, a 1-px bob on each body's own beat;
//          shadows shrink, motes rise — e_voidRise (no tremolo)
//   +1180  a GUARDIAN CHARM answers: its tile flares gold, a gold tether snaps up to its monster and yanks it back
//          down onto its tile (thud, dust, a gold outline); "KORUNDU" on an ink plate in front of its tile for
//          450 ms, gone before the contraction — e_voidSave, e_voidThud
//   +1870  the choir and the swell stop dead (a 30 ms gap of silence for the tick)
//   +1900  THE PUPIL CONTRACTS (two stepped frames, 10 → 6 → 3 px) — e_voidTick (dry, close); hit-stop: every body
//          freezes for ONE frame in its own pixels inside a 1-px WHITE outline
//   +1940  THE PULL, all at once (3 ms apart): 3 stepped, accelerating frames to the pupil (30 → 60 → 86 %) while
//          they SHRINK (0.8 → 0.55 → 0.3) and SINK INTO THE DARK — their own pixels in a lilac rim, then a void1,
//          then a void0 silhouette (the rim dims void3 → void2); 1-px streaks converge behind them; each pops into a
//          mote burst at the pupil rim (the pupil flicks white), its tile flashes violet and its card flies home at
//          once (≤ 240 ms, a soft glass tick — e_voidCard); a token / decoy tile crumbles — e_voidGulp
//   +2120  the pupil GULPS (3 → 7 → 5 → 4): an iris-ring flash and a white rim on the lids, a violet flash; the
//          floor light closes in 3 steps
//   +2220  THE EYE CLOSES (lids slide shut in 120 ms; the shut eye shows as a lid seam with hanging lashes) —
//          e_voidBlink; every card is home by now: the blinks play on a still board
//   +2400  BLINK 1 (opens a crack 0.35 in 3 steps, shuts in 3), +2600 BLINK 2 — e_voidBlink on each shut
//   +2720  the seam seals from the top down to the slit at its bottom tip (3 steps)
//   +2740  THE TEAR: one purple drop swells at the slit in 4 frames to 9×13 (a one-frame white glint), hangs —
//          e_voidTink —
//   +2880  falls with smear frames (ease-in) to the board centre (or the nearest tile no saved monster stands on);
//          the clouds shrink away (3 steps)
//   +3060  it LANDS: two stepped splash rings, a crown of 10 droplets, a violet stain fading in steps, a light hole
//          in the night, 3 px shake — e_voidDrip; the night lifts in 2 quarter steps
//   +3200  end (the splash rings / droplets finish in a 220 ms tail)
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
import { Raster, run, spriteBox } from '../../vfx/setpieces';
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

/** Half sizes of the open eye (a vertical almond) and of the iris: a sky-sized eye, 75 × 81 px with its lids. */
const EH = 40;
const EW = 30;
const IRIS = 20;
/** The top edge the eye and every risen body keep clear of (the phase bar / LP panels live above it). */
const HUD_CLEAR = 40;
/** Lid band width (lip, skin, crease, outer fold, outline). */
const LID = 6;
/**
 * The eye's centre: over the middle of the field, HIGH in the sky over the back wall (its top tip stays just under
 * the phase bar; its bottom tip clears the back row's heads as far as it can).
 */
function eyeAt(): XY {
  return { x: R(BOARD_CENTER.x), y: Math.max(EH + 18, R(BOARD_CENTER.y) - 102) };
}
/**
 * The sky layer (clouds, rift, eye): in front of the units and the piles. Tried behind the units (r6): on a crowded
 * board the tall back-row monster in the centre lane hid the iris through the whole lid / look / gaze beat, so the
 * eye is kept in front — but raised into the sky over the back wall, framed by its clouds and its glow, and smaller
 * at the bottom tip, so it covers far less of the back row. The risen bodies float under it; the silhouettes of the
 * pull go in front of it (RISE_DEPTH / PULL_DEPTH).
 */
const SKY_DEPTH = DEPTH.FX + 1;
/** The clouds round the eye are sky proper: behind the cards and the units (they never hide a monster). */
const CLOUD_DEPTH = DEPTH.TILE_FX + 6;
/** Bodies while they rise float just under the eye (they pass behind its lids, never over it). */
const RISE_DEPTH = DEPTH.FX + 0.2;
/** From the contraction on the silhouettes are in front of the eye: they are pulled INTO the pupil. */
const PULL_DEPTH = DEPTH.FX + 2;
/** The night stamp: over the light layer's floor stamps and the pads, under the tile glows. */
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
  /** the pull starts one 40 ms frame after the contraction: no held silhouette */
  pull: 1940,
  /** 3 stepped frames per body (+ the arrival) */
  pullStep: 40,
  pullStagger: 3,
  gulp: 2120,
  close: 2220,
  closeMs: 120,
  blink1: 2400,
  blink2: 2600,
  /** the closed seam seals from the top down to the tear's slit (3 steps) */
  seal: 2720,
  sealMs: 120,
  tear: 2740,
  tearFall: 2880,
  land: 3060,
  end: 3200,
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

/**
 * The pull's tones per stepped frame: the first frame still shows the body's own pixels (shrinking, in a lilac rim),
 * then it sinks into the dark — a void1, then a void0 silhouette — while its rim stays lilac, then dims.
 */
const PULL_FILL = [null, PAL.void1, PAL.void0] as const;
const PULL_RIM = [PAL.void3, PAL.void3, PAL.void2] as const;

/** A slow turn: the body narrows, mirrors at the middle, widens back (35 ms a frame). */
const TURN = [0.75, 0.5, 0.25, 0.25, 0.5, 0.75] as const;
const TURN_MS = 35;

/** The lid lips' flutter (open fraction, 110 ms a step) and the iris' wander along the crown (px). */
const FLUTTER = [1, 0.97, 1, 1, 0.95, 1, 0.97, 1, 1] as const;
const WANDER = [0, 1, 1, 0, -1, 0] as const;

/** One blink: 6 frames × 20 ms — opens a crack (0.12 → 0.24 → 0.35), shuts (0.24 → 0.12 → 0). */
const BLINK = [0.12, 0.24, 0.35, 0.24, 0.12, 0] as const;
const BLINK_MS = 120;

/** The eye's lid opening (0 shut … 1 open) at `el`. */
function lidAt(el: number): number {
  if (el < T.lid) return 0;
  // ease-in, 7 steps: the slit widens slowly, then the lids part fast — the widest motion lands on the sound's rise
  // and the last step on its wet "p" (e_voidLid peaks at ~0.45 s game time = 333 scene ms × 1.35)
  if (el < T.close) return q(ease.in(seg(el, T.lid, T.lidMs)), 7);
  if (el < T.close + T.closeMs) return 1 - q(seg(el, T.close, T.closeMs), 4);
  for (const b of [T.blink1, T.blink2]) {
    const u = el - b;
    if (u >= 0 && u < BLINK_MS) return BLINK[Math.floor(u / 20)];
  }
  return 0;
}

// ================================================================ the night (shared by the hook and the wipe)

/**
 * THE LIGHTS GO DOWN — on the palette, never with alpha (REHBER EF-6 / EF-7): a full-opacity INK stamp in world-aligned
 * 2×2 Bayer quarter steps over the sky, the wall, the platform and the pads (under the tile glows, the cards and the
 * units). Light is a HOLE in it: where the eye's glow and its gaze fall, the stamp steps back (a quarter-step rim, then
 * none), so the lit floor shows its own pixels. Every pixel on screen stays an exact PAL colour.
 */
interface NightHole {
  x: number;
  y: number;
  rx: number;
  ry: number;
}
class Night {
  readonly r: Raster;
  level = 0;
  holes: NightHole[] = [];
  private key = '';
  constructor(sc: Phaser.Scene) {
    this.r = new Raster(sc, 0, 0, GAME_W, GAME_H, NIGHT_DEPTH);
  }
  /** Redraw only when the level or a hole changed (a stepped stamp, it never drifts). */
  sync(): void {
    const key = `${this.level}|${this.holes.map((h) => `${h.x},${h.y},${h.rx},${h.ry}`).join(';')}`;
    if (key === this.key || !this.r.alive) return;
    this.key = key;
    const lv = this.level;
    const holes = this.holes.filter((h) => h.rx > 0 && h.ry > 0);
    this.r.draw((r) => {
      if (lv <= 0) return;
      for (let y = 0; y < GAME_H; y++) {
        for (let x = 0; x < GAME_W; x++) {
          let l = lv;
          for (const h of holes) {
            const dx = (x - h.x) / h.rx;
            const dy = (y - h.y) / h.ry;
            const d = dx * dx + dy * dy;
            // inside: no stamp; a rim one quarter step lighter than the night
            if (d < 1) l = 0;
            else if (d < 1.6 && l > 0) l = Math.min(l, lv - 0.25);
          }
          if (l > 0) r.dpx(x, y, PAL.ink, l);
        }
      }
    });
  }
  destroy(): void {
    this.r.destroy();
  }
}
const nights = new WeakMap<Phaser.Scene, Night>();
/** The night's levels going down / coming back up (quarter steps, 2×2 Bayer). */
const NIGHT_DOWN = [0.25, 0.5] as const;
const NIGHT_UP = [0.25, 0] as const;

/** The lights go down: the ink stamp in 2 quarter steps (130 ms apart). */
function nightDown(sc: Phaser.Scene): void {
  if (nights.get(sc)?.r.alive) return;
  const n = new Night(sc);
  nights.set(sc, n);
  void lightDim(sc, 1, 440);
  NIGHT_DOWN.forEach((a, i) =>
    bg(
      wait(sc, i * 130).then(() => {
        if (nights.get(sc) !== n) return;
        n.level = a;
        n.sync();
      }),
    ),
  );
}
/** The running night of this scene (light holes are cut into it by the wipe). */
const nightOf = (sc: Phaser.Scene): Night | null => {
  const n = nights.get(sc);
  return n && n.r.alive ? n : null;
};

/** The lights come back up in 2 quarter steps (100 ms apart); the stamp is removed. */
async function nightUp(sc: Phaser.Scene): Promise<void> {
  const n = nights.get(sc);
  void lightDim(sc, 0, 500);
  if (!n) return;
  nights.delete(sc);
  n.holes = [];
  for (const a of NIGHT_UP) {
    if (!n.r.alive) return;
    n.level = a;
    n.sync();
    await wait(sc, 100);
  }
  n.destroy();
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
  /** the slit is gone (0 = shown, 1 = gone) */
  fade: number;
  /** the gulp: 1 = the iris' outer ring flashes white, 2 = + a white rim on the lids */
  flash: number;
  /** the eye has closed for good: no rift any more, the shut lids (the seam) show instead */
  closed: boolean;
  /** the visible part of the closed seam (1 = the whole shut eye … the slit at its bottom tip that holds the tear) */
  seam: number;
}

/** 1-px zig-zag of the rift (deterministic, period 10). */
const JAG = [0, 0, 1, 1, 1, 0, -1, -1, 0, 0];
const jag = (y: number) => JAG[((y % JAG.length) + JAG.length) % JAG.length];
/** Side cracks: [row offset from the centre, direction, length]. */
const BRANCH: readonly (readonly [number, number, number])[] = [
  [-42, -1, 7],
  [-30, 1, 5],
  [32, -1, 6],
  [44, 1, 8],
  [-47, 1, 4],
];
/** Stars of the pupil (unit-circle positions) and their twinkle phase. */
const STARS: readonly (readonly [number, number, number])[] = [
  [-0.45, -0.3, 0],
  [0.3, -0.55, 1],
  [0.15, 0.35, 2],
  [-0.3, 0.5, 1],
  [0.55, 0.1, 0],
  [-0.05, -0.05, 2],
  [0.6, -0.35, 2],
  [-0.62, 0.15, 0],
];
/** Lash rows (offsets from the centre). */
const LASHES = [-29, -12, 12, 29] as const;

/**
 * The sky's cloud lobes round the eye (as on the card art): night bodies with a lit top rim, a violet underside where
 * the eye lights them, an ink outline. They swell in with the rift in 3 steps, drift 1 px, and shrink away (3 steps)
 * after the tear has fallen. [dx, dy, r, drift phase]
 */
const CLOUDS: readonly (readonly [number, number, number, number])[] = [
  [-36, -24, 8, 0],
  [-50, -14, 7, 1],
  [-41, -4, 9, 2],
  [-55, 6, 6, 3],
  [-39, 14, 8, 1],
  [-32, 27, 6, 2],
  [37, -20, 8, 2],
  [51, -9, 7, 0],
  [42, 2, 9, 3],
  [54, 13, 6, 1],
  [38, 19, 7, 0],
  [31, 30, 6, 3],
];
function drawClouds(r: Raster, c: XY, scale: number, el: number, glow: boolean): void {
  if (scale <= 0) return;
  const lobes = CLOUDS.map(([dx, dy, rr, ph], i) => {
    const drift = Math.floor((el + ph * 170) / 340) % 2;
    const rr2 = rr * scale;
    // wide, flat puffs (1.6 : 0.8), not balls
    return { x: c.x + R(dx * (0.6 + 0.4 * scale)) + (dx < 0 ? -drift : drift), y: c.y + dy + (i % 2 ? drift : 0), rx: Math.max(1, rr2 * 1.6), ry: Math.max(1, rr2 * 0.8) };
  });
  const inside = (x: number, y: number) => lobes.some((l) => ((x - l.x) / l.rx) ** 2 + ((y - l.y) / l.ry) ** 2 <= 1);
  const x0 = c.x - 74;
  const y0 = c.y - EH - 6;
  for (let y = y0; y <= c.y + EH + 6; y++) {
    for (let x = x0; x <= c.x + 74; x++) {
      if (!inside(x, y)) {
        if (inside(x + 1, y) || inside(x - 1, y) || inside(x, y + 1) || inside(x, y - 1)) r.px(x, y, PAL.ink);
        continue;
      }
      // tone bands: lit top rim (the moon side), night body, a violet underside facing the eye
      // tone bands: a lit 1-px top rim, a night2 crown, a night1 body, a violet underside lit by the eye (brighter
      // on the side facing the eye while it is open)
      const towardEye = Math.abs(x - c.x) < EW + LID + 12;
      let col: number = PAL.night1;
      if (!inside(x, y - 1)) col = PAL.night3;
      else if (!inside(x, y - 3)) col = PAL.night2;
      else if (!inside(x, y + 1)) col = glow && towardEye ? PAL.void3 : PAL.void2;
      else if (!inside(x, y + 3)) col = glow ? PAL.void2 : PAL.void1;
      r.px(x, y, col);
    }
  }
}

function drawEye(r: Raster, c: XY, s: EyeState): void {
  if (s.fade >= 1) return;
  // ---- the rift (under the lids; beyond the tips it IS the eye's tear in the sky) — gone once the eye has shut
  if (!s.closed && s.crack > 0) {
    // it tears down from above: long into the sky, but its lower end stops at the eye's bottom tip (it never runs
    // down over the back row)
    const L = Math.round(s.crack * (EH + 8));
    const Ld = Math.round(s.crack * (EH - 2));
    for (let dy = -L; dy <= Ld; dy++) {
      const x = c.x + jag(c.y + dy);
      const tip = dy < -L + 3 || dy > Ld - 3;
      r.px(x - 1, c.y + dy, PAL.void2);
      r.px(x + 1, c.y + dy, PAL.void2);
      r.px(x, c.y + dy, tip ? PAL.void4 : PAL.white);
    }
    if (s.crack > 0.6) {
      for (const [oy, dir, n] of BRANCH) {
        if (oy < -L || oy > Ld) continue;
        for (let k = 1; k <= n; k++) r.px(c.x + jag(c.y + oy) + dir * (k + 1), c.y + oy + (k >> 1) * Math.sign(oy), k === n ? PAL.void2 : PAL.void3);
      }
    }
  }
  // the shut lids lie under a blink's narrow lens (its tips are the seam)
  if (s.closed && s.seam > 0) drawSeam(r, c, s.seam);
  if (s.open <= 0) return;
  // ---- the lens
  for (let dy = -EH; dy <= EH; dy++) {
    const f = 1 - (dy / EH) * (dy / EH);
    const hw = Math.floor(EW * s.open * f);
    if (hw < 1) continue;
    const y = c.y + dy;
    for (let dx = -hw - LID; dx <= hw + LID; dx++) {
      const x = c.x + dx;
      const a = Math.abs(dx);
      if (a > hw) {
        // the lids have VOLUME: a lit lip on the lens, two skin bands, a shaded crease, the outer fold catching the
        // light again, an ink outline (white on the gulp's rim frame). The left lid is lit, the right one shaded.
        const k = a - hw;
        const lit = dx < 0;
        const up = dy < 0;
        let col: number;
        if (k === LID) col = s.flash >= 2 ? PAL.white : PAL.ink;
        else if (k === 1) col = s.flash >= 2 ? PAL.white : lit ? PAL.mist : up ? PAL.night4 : PAL.night3;
        else if (k === 2) col = lit ? PAL.night4 : PAL.night3;
        else if (k === 3) col = lit ? (up ? PAL.night4 : PAL.night3) : PAL.night2;
        else if (k === 4) col = lit ? PAL.night1 : PAL.night0;
        else col = lit ? PAL.night3 : PAL.night2;
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
          if (R(sx * s.rp) === ux && R(sy * s.rp) === uy) col = (Math.floor(s.el / 90) + ph) % 3 === 0 ? PAL.white : PAL.void3;
        }
      } else if (d <= s.rp + 1.2) col = s.glow > 1 ? PAL.white : PAL.void4;
      else if (d <= 12.5) col = s.glow > 0.5 ? PAL.void4 : PAL.void3;
      else if (d <= 17) {
        const ang = Math.atan2(uy, ux);
        // fine radial fibres (every 4th of 40 sectors), turning slowly
        const spoke = Math.floor(((ang + Math.PI + s.el / 1400) / (Math.PI * 2)) * 40) % 4 === 0;
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
    for (const oy of LASHES) {
      const f = 1 - (oy / EH) * (oy / EH);
      const hw = Math.floor(EW * s.open * f) + LID + 1;
      for (const side of [-1, 1]) {
        r.px(c.x + side * hw, c.y + oy, PAL.ink);
        r.px(c.x + side * (hw + 1), c.y + oy + 1, PAL.ink);
        r.px(c.x + side * (hw + 2), c.y + oy + 1, PAL.ink);
      }
    }
  }
}

/**
 * The SHUT eye: the two lids meet on a dark violet seam (lit lid left, shaded right, ink outline, the lashes hanging
 * down). `part` < 1 seals it from the top: only the lower part — at the end the slit that holds the tear — is left.
 */
function drawSeam(r: Raster, c: XY, part: number): void {
  const from = EH - Math.max(4, R(2 * EH * part));
  for (let dy = from; dy <= EH; dy++) {
    const f = 1 - (dy / EH) * (dy / EH);
    const hw = Math.floor(5 * Math.sqrt(f));
    const y = c.y + dy;
    // the slit glows faintly (void3) between the lids; the lit lid's outer edge catches a mist lip
    r.px(c.x, y, Math.abs(dy) < EH - 3 ? PAL.void3 : PAL.void2);
    for (let k = 1; k <= hw + 1; k++) {
      r.px(c.x - k, y, k === hw + 1 && hw > 1 ? PAL.mist : k === 1 ? PAL.night3 : PAL.night4);
      r.px(c.x + k, y, k === 1 ? PAL.night2 : k === hw + 1 ? PAL.night2 : PAL.night3);
    }
    r.px(c.x - hw - 2, y, PAL.ink);
    r.px(c.x + hw + 2, y, PAL.ink);
  }
  r.px(c.x, c.y + from - 1, PAL.ink);
  if (part < 0.6) return;
  for (const oy of LASHES) {
    if (oy < from) continue;
    const hw = Math.floor(5 * Math.sqrt(1 - (oy / EH) * (oy / EH))) + 3;
    for (const side of [-1, 1]) {
      r.px(c.x + side * hw, c.y + oy + 1, PAL.ink);
      r.px(c.x + side * (hw + 1), c.y + oy + 2, PAL.ink);
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
  /** with `to`: radians the mote winds round its target on the way in (a spiral) */
  spin: number;
}

class Motes {
  private ms: Mote[] = [];
  add(m: Partial<Mote> & { x: number; y: number; life: number; c: number }): void {
    this.ms.push({ vx: 0, vy: 0, to: null, age: 0, g: 0, trail: false, spin: 0, x0: m.x, y0: m.y, ...m });
  }
  step(dt: number): void {
    const s = dt / 1000;
    for (const m of this.ms) {
      m.age += dt;
      if (m.to) {
        const t = ease.in(m.age / m.life);
        if (m.spin) {
          const a = m.spin * t;
          const ox = m.x0 - m.to.x;
          const oy = m.y0 - m.to.y;
          m.x = m.to.x + (ox * Math.cos(a) - oy * Math.sin(a)) * (1 - t);
          m.y = m.to.y + (ox * Math.sin(a) + oy * Math.cos(a)) * (1 - t);
        } else {
          m.x = m.x0 + (m.to.x - m.x0) * t;
          m.y = m.y0 + (m.to.y - m.y0) * t;
        }
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
  /** a 1-px outline (4 fill copies, one pixel out): shown on a turn, a save, the contraction and the pull */
  rims: Phaser.GameObjects.Sprite[];
  /** the outline shows until this scene ms (Infinity from the contraction on) */
  rimUntil: number;
  /** the opaque box size at the start */
  boxW: number;
  boxH: number;
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
  /** the two turns (scene ms) */
  flips: number[];
  /** the running turn's start (-1: none) and whether it has mirrored yet */
  turn: number;
  turned: boolean;
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
    rimUntil: -1,
    boxW: 24,
    boxH: 32,
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
    turn: -1,
    turned: false,
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
  g.setDepth(RISE_DEPTH + g.y / 10000);
  b.ghost = g;
  b.x0 = g.x;
  b.y0 = g.y;
  const box = spriteBox(sc, g);
  b.offX = R(g.x - box.cx);
  b.offY = R(g.y - box.cy);
  b.boxW = R(box.w);
  b.boxH = R(box.h);
}

/**
 * The risen seats: a crown fanned out on both sides of the eye. Bodies left of the eye take the left arm, the
 * others the right; the seat nearest the eye is the lowest, the outer ones climb a little. Every seat keeps its
 * box top at or under HUD_CLEAR (never over the phase bar / LP panels): a crowded arm compresses sideways instead
 * of climbing. Bodies overlap their neighbours by about a third of their width (the inner one in front).
 */
function seat(bodies: Body[], eye: XY): void {
  const rise = bodies.filter((b) => b.kind !== 'saved' && b.ghost);
  for (const side of [-1, 1] as const) {
    const arm = rise.filter((b) => (side < 0 ? b.x0 < eye.x : b.x0 >= eye.x)).sort((a, b) => Math.abs(a.x0 - eye.x) - Math.abs(b.x0 - eye.x));
    if (!arm.length) continue;
    const inner = EW + 8;
    const room = (side < 0 ? eye.x - 26 : GAME_W - 26 - eye.x) - inner;
    // natural spacing: each body takes 62 % of its width; squeeze when the arm would leave the screen
    const need = arm.reduce((acc, b, j) => acc + (j === arm.length - 1 ? b.boxW : b.boxW * 0.62), 0);
    const k = need > room ? room / need : 1;
    let at = inner;
    arm.forEach((b, j) => {
      const cx = eye.x + side * (at + (b.boxW * k) / 2);
      at += b.boxW * 0.62 * k;
      let cy = eye.y + 24 - j * 7;
      cy = Math.min(cy, cy0Of(b) - 30);
      cy = Math.max(cy, HUD_CLEAR + Math.ceil(b.boxH / 2) + 1);
      b.tx = R(cx + b.offX);
      b.ty = R(cy + b.offY);
      // the inner seats in front of the outer ones while they rise
      b.ghost!.setDepth(RISE_DEPTH + (10 - j) / 100);
    });
  }
  for (const b of bodies) {
    if (b.kind !== 'saved' || !b.ghost) continue;
    b.tx = b.x0 + R((eye.x - b.x0) * 0.08);
    b.ty = b.y0 - 22;
  }
}
const cy0Of = (b: Body) => b.y0 - b.offY;

/** Lay a 1-px outline of fill copies (one pixel out on 4 sides) under a body, in `color`. */
function rimOf(sc: Phaser.Scene, b: Body, color: number): void {
  const g = b.ghost;
  if (!g) return;
  if (b.rims.length) {
    for (const r of b.rims) r.setTintFill(color);
    moveRims(b);
    return;
  }
  b.rims = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ].map(([dx, dy]) => sc.add.sprite(g.x + dx, g.y + dy, g.texture.key, g.frame.name).setTintFill(color).setData('d', [dx, dy]));
  moveRims(b);
}
/** Keep the outline on its body: position, frame, facing, origin, scale, depth; shown while the body is outlined. */
function moveRims(b: Body, el = 0): void {
  const g = b.ghost;
  if (!g) return;
  const on = g.visible && el < b.rimUntil;
  for (const r of b.rims) {
    const [dx, dy] = r.getData('d') as [number, number];
    r.setVisible(on);
    if (!on) continue;
    if (r.frame.name !== g.frame.name) r.setFrame(g.frame.name);
    r.setPosition(g.x + dx, g.y + dy)
      .setFlipX(g.flipX)
      .setOrigin(g.originX, g.originY)
      .setScale(g.scaleX, g.scaleY)
      .setDepth(g.depth - 0.0001);
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
  const to0 = pile.topXY();
  const to = { x: R(to0.x), y: R(to0.y) };
  const dist = Math.hypot(to.x - a.x, to.y - a.y);
  // fast (≤ 240 ms): every card is home before the eye's first blink, the blinks play on a still board
  const ms = R(150 + Math.min(90, dist * 0.25));
  const arc = R(Math.min(22, 8 + dist * 0.08));
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

/**
 * Where the tear lands: the centre of the board, unless a saved monster stands there — then the nearest monster
 * tile to the centre that nobody kept (it is empty after the wipe), so the splash is never hidden by a survivor.
 */
function tearPoint(bodies: Body[]): XY {
  const mid = { x: R(BOARD_CENTER.x), y: R(BOARD_CENTER.y) };
  const kept = bodies.filter((b) => b.kind === 'saved').map((b) => b.floor);
  const clear = (p: XY) => kept.every((k) => Math.abs(k.x - p.x) > 34 || Math.abs(k.y - p.y) > 26);
  if (clear(mid)) return mid;
  const cands: XY[] = [];
  for (const pl of [0, 1] as PlayerId[])
    for (let z = 0; z < 5; z++) {
      const p = zoneXY(pl, 'monster', z);
      cands.push({ x: R(p.x), y: R(p.y) });
    }
  const ok = cands.filter(clear).sort((a, b) => Math.hypot(a.x - mid.x, a.y - mid.y) - Math.hypot(b.x - mid.x, b.y - mid.y));
  return ok[0] ?? mid;
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
    // three slow turns spread over the whole rise, each body on its own beat (a turn is 6 × 35 ms: it ends before
    // the contraction)
    const o = (i * 53) % 150;
    b.flips = [T.lift + 150 + o, T.lift + 450 + o, T.lift + 740 + o].filter((t) => t < T.contract - TURN.length * TURN_MS - 20);
  });
  for (const c of cards) c.tile = field.tileOf(c.uid);
  const landAt = tearPoint(bodies);
  // the iris leans toward the side of the field with more doomed bodies
  const nL = bodies.filter((b) => b.kind !== 'saved' && b.floor.x < eye.x).length;
  const nR = bodies.filter((b) => b.kind !== 'saved' && b.floor.x >= eye.x).length;
  const lean = Math.sign(nR - nL);

  // ---- the canvases: the sky (the eye, over the units), the air (motes, streaks, tether, tear), the floor
  const sky = Raster.around(sc, eye.x, eye.y, (EW + LID + 6) * 2, (EH + 16) * 2, SKY_DEPTH);
  const cloudR = Raster.around(sc, eye.x, eye.y, 160, (EH + 16) * 2, CLOUD_DEPTH);
  const air = new Raster(sc, 0, 0, 640, 360, DEPTH.FX + 6);
  const floor = new Raster(sc, 0, 0, 640, 360, DEPTH.TILE_FX + 2);
  const motes = new Motes();
  const S: EyeState = { crack: 0, open: 0, ix: 0, iy: 0, rp: 8, glow: 0, el: 0, fade: 0, flash: 0, closed: false, seam: 0 };
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
  /** the spell / trap cards that break with the wipe go home with the first body the eye takes */
  let cardsSent = false;
  const sendCards = () => {
    if (cardsSent) return;
    cardsSent = true;
    cards.forEach((c, k) => {
      const { tile } = field.release(c.uid);
      flights.push(cardHome(ctx, c.owner, c.cardId, tile ? tile.home : zoneXY(c.owner, 'spellTrap', 0), tile, k * 30));
    });
  };

  // stars flare where the orb hit (the rift starts from it)
  bg(starFlare(sc, eye, 200, [PAL.white, PAL.void4, PAL.void3, PAL.void2, PAL.void1], 22));
  playV3('e_voidRift', { volume: 0.85 });

  /** The tear's landing on the floor raster at scene ms `el` (also drawn by the tail after the scene). */
  const splash = (r: Raster, el: number): void => {
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
        for (let a = 0; a < 180; a++) {
          const ang = (a / 180) * Math.PI * 2;
          const cs = Math.cos(ang);
          const sn = Math.sin(ang);
          r.px(R(landAt.x + cs * rx), R(landAt.y + sn * ry), c);
          r.px(R(landAt.x + cs * (rx - 1)), R(landAt.y + sn * Math.max(1, ry - 1)), c);
        }
      };
      ring(0, 26, PAL.void4);
      ring(70, 18, PAL.void3);
      // the stain (stepped tones)
      const sc3 = u < 100 ? PAL.void4 : u < 190 ? PAL.void3 : u < 270 ? PAL.void2 : u < 330 ? PAL.void1 : -1;
      if (sc3 >= 0) {
        for (let yy = -2; yy <= 2; yy++) {
          const w = [4, 7, 8, 7, 4][yy + 2];
          for (let xx = -w; xx <= w; xx++) r.px(landAt.x + xx, landAt.y + yy, sc3);
        }
        if (u < 190) r.px(landAt.x - 3, landAt.y - 1, PAL.white);
      }
    }
  };

  let last = 0;
  await run(sc, T.end, (_t, el, dt) => {
    S.el = el;
    // ================================ the eye's state
    S.crack = q(ease.out(seg(el, T.rift, T.riftMs)), 4);
    S.open = lidAt(el);
    S.closed = el >= T.close;
    // the shut seam seals from the top down to the tear's slit (3 steps) right after the second blink
    S.seam = 1 - q(seg(el, T.seal, T.sealMs), 3) * 0.9;
    // the open eye is alive: the lid lips flutter 1 px on an uneven beat (nothing stands still)
    if (el > T.lid + T.lidMs && el < T.close) S.open = FLUTTER[Math.floor(el / 110) % FLUTTER.length];
    // looks round (left, right: searching), then the gaze falls; while they rise the iris follows the crown,
    // leaning toward the side with more bodies and wandering 1 px along it
    if (el < T.gaze) S.ix = el >= T.look ? (el < T.look + 70 ? -3 : el < T.look + 140 ? 3 : 0) : 0;
    else if (el < T.gaze + 200 || el >= T.contract) S.ix = 0;
    else S.ix = Math.max(-2, Math.min(2, lean + WANDER[Math.floor((el - T.gaze - 200) / 170) % WANDER.length]));
    S.iy = el < T.gaze ? 0 : q(ease.out(seg(el, T.gaze, 120)), 3) * 8;
    if (el >= T.close) S.iy = 8;
    // the pupil: dilates as it looks, contracts in two stepped frames, bites on each arrival, gulps
    // (the pupil breathes 1 px while it watches: 10 ↔ 9 every 300 ms)
    if (el < T.contract) S.rp = el >= T.gaze ? (Math.floor((el - T.gaze) / 300) % 2 ? 9 : 10) : 8;
    else if (el < T.contract + 20) S.rp = 6;
    else if (el < T.gulp) S.rp = el - lastBite < 34 ? 4 : 3;
    else if (el < T.gulp + 40) S.rp = 7;
    else if (el < T.gulp + 80) S.rp = 5;
    else S.rp = 4;
    S.glow = el >= T.contract && el < T.contract + 50 ? 2 : el - lastBite < 34 ? 2 : el >= T.pull && el < T.gulp + 60 ? 1 : el >= T.gaze ? 0.6 : 0;
    S.flash = el >= T.gulp && el < T.gulp + 34 ? 2 : el >= T.gulp && el < T.gulp + 80 ? 1 : 0;
    S.fade = el < T.tearFall + 40 ? 0 : 1;

    // ================================ marks
    once('lid', el, T.lid, () => {
      playV3('e_voidLid', { volume: 0.9 });
      eyeLight = lightPool(sc, eye.x, eye.y, { color: PAL.void3, radius: 96, floorY: fieldMid.y, air: 0.75, airRadius: 58, intensity: 0, anim: 'breathe', fadeIn: 0 });
      eyeLight.setIntensity(1, 420);
    });
    once('look', el, T.look, () => playV3('e_voidTwitch', { volume: 0.85 }));
    once('gaze', el, T.gaze, () => {
      playV3('e_voidGaze', { volume: 0.9 });
      swell = startV3('e_voidSwell', { volume: 0.85 });
      gazeLight = lightPool(sc, fieldMid.x, fieldMid.y, { color: PAL.void3, radius: 150, intensity: 0, tint: 0.6, fadeIn: 0 });
      gazeLight.setIntensity(1.1, 260);
      gazeBeam = lightBeam(sc, { x: eye.x, y: eye.y + 8 }, { x: fieldMid.x, y: fieldMid.y - 30 }, PAL.void3, 0, { width: 52, intensity: 0.55, shimmer: 0.2 });
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
          // a revealed body steps out of its card: a violet outline for two frames (never a fill before the contraction)
          rimOf(sc, b, PAL.void4);
          b.rimUntil = el + 60;
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
    // the choir and the swell stop dead 40 ms before the tick: the dry tick lands in a gap of silence
    once('hush', el, T.contract - 30, () => {
      (swell as { stop(ms?: number): void } | null)?.stop(25);
      (choir as { stop(ms?: number): void } | null)?.stop(25);
    });
    once('contract', el, T.contract, () => {
      playV3('e_voidTick', { volume: 1 });
      // the hit-stop is the bodies' own: every body holds still for ONE frame (the eye keeps living), still in its
      // own pixels, inside a single-frame WHITE 1-px outline — the last time they are seen as themselves
      for (const b of bodies) {
        if (b.kind === 'saved' || !b.ghost) continue;
        const g = b.ghost;
        g.anims.stop();
        g.setScale(1);
        g.setDepth(PULL_DEPTH + g.y / 1000);
        rimOf(sc, b, PAL.white);
        b.rimUntil = Infinity;
      }
    });
    once('silhouette', el, T.pull, () => {
      // the bodies SINK into the dark as they are pulled: their own pixels for one frame, then dark void silhouettes
      // (void1 → void0) inside a lilac rim, pulled at once (3 ms apart, nearest first)
      playV3('e_voidGulp', { volume: 1 });
      const order = bodies.filter((b) => b.kind !== 'saved' && b.ghost).sort((a, c) => Math.hypot(a.ghost!.x - eye.x, a.ghost!.y - eye.y) - Math.hypot(c.ghost!.x - eye.x, c.ghost!.y - eye.y));
      order.forEach((b, k) => {
        const g = b.ghost!;
        rimOf(sc, b, PULL_RIM[0]);
        const box = spriteBox(sc, g);
        b.offX = R(g.x - box.cx);
        b.offY = R(g.y - box.cy);
        b.px0 = g.x;
        b.py0 = g.y;
        b.pullAt = T.pull + k * T.pullStagger;
      });
    });
    once('gulp', el, T.gulp, () => {
      void lightFlash(sc, eye.x, eye.y, PAL.void4, 80, 380, { floorY: fieldMid.y, air: 0.9, intensity: 1.2 });
      (gazeBeam as BeamHandle | null)?.fadeOut(200);
      (gazeLight as LightHandle | null)?.setIntensity(0.4, 200);
      for (const b of bodies) if (b.kind !== 'saved') void b.light?.fadeOut(120);
    });
    once('close', el, T.close + 60, () => playV3('e_voidBlink', { volume: 0.9 }));
    once('blink1', el, T.blink1 + 100, () => playV3('e_voidBlink', { volume: 0.7, pitch: 1.08 }));
    once('blink2', el, T.blink2 + 100, () => playV3('e_voidBlink', { volume: 0.6, pitch: 1.16 }));
    once('tearLight', el, T.tear, () => {
      playV3('e_voidTink', { volume: 0.8 });
      tearLight = lightPool(sc, eye.x, eye.y + EH, { color: PAL.void4, radius: 20, floorY: fieldMid.y, air: 0.7, airRadius: 12, intensity: 1, fadeIn: 60 });
      (eyeLight as LightHandle | null)?.setIntensity(0.4, 300);
    });
    once('land', el, T.land, () => {
      playV3('e_voidDrip', { volume: 1, pan: panAt(landAt.x) });
      void (tearLight as LightHandle | null)?.fadeOut(120);
      void shake(sc, 160, 3);
      void lightFlash(sc, landAt.x, landAt.y, PAL.void4, 70, 560, { intensity: 1.8, ring: true });
      void (eyeLight as LightHandle | null)?.fadeOut(400);
      void (gazeLight as LightHandle | null)?.fadeOut(500);
      bg(wait(sc, 120).then(() => nightUp(sc)));
      // the crown of droplets
      for (let k = 0; k < 10; k++) {
        const a = Math.PI + (k / 9) * Math.PI;
        motes.add({ x: landAt.x + R(Math.cos(a) * 4), y: landAt.y - 1, vx: Math.cos(a) * (56 + (k % 2) * 20), vy: -80 - (k % 3) * 26 + Math.sin(a) * 10, g: 420, life: 380, c: k % 2 ? PAL.void4 : PAL.white, trail: true });
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
      // ---- THE PULL: 3 stepped, accelerating frames to the pupil, shrinking (1 → 0.8 → 0.55 → 0.3); then gone
      if (b.kind !== 'saved' && fired.has('silhouette')) {
        const u = el - b.pullAt;
        if (u < 0) {
          moveRims(b, el);
          continue;
        }
        const FR = [0.3, 0.6, 0.86] as const;
        const SC = [0.8, 0.55, 0.3] as const;
        const fi = Math.floor(u / T.pullStep);
        const cx0 = b.px0 - b.offX;
        const cy0 = b.py0 - b.offY;
        if (fi < 3) {
          const f = FR[fi];
          const k = SC[fi];
          const cx = R(cx0 + (pp.x - cx0) * f);
          const cy = R(cy0 + (pp.y - cy0) * f);
          g.setScale(k);
          g.setPosition(R(cx + b.offX * k), R(cy + b.offY * k));
          if (g.getData('fi') !== fi) {
            g.setData('fi', fi);
            const fill = PULL_FILL[fi];
            if (fill === null) g.clearTint();
            else g.setTintFill(fill);
            for (const rr of b.rims) rr.setTintFill(PULL_RIM[fi]);
          }
          moveRims(b, el);
          if (!g.getData('s' + fi)) {
            g.setData('s' + fi, true);
            // three streaks from where it hung: its top, centre and bottom, converging on the pupil
            const hh = R(b.boxH / 2);
            streaks.push([cx0, cy0 - hh, cx, cy - R(hh * k), el], [cx0, cy0, cx, cy, el], [cx0, cy0 + hh, cx, cy + R(hh * k), el]);
          }
        } else {
          // arrival: it pops into a dense burst at the pupil rim and is gone
          b.gone = true;
          g.setVisible(false);
          moveRims(b, el);
          lastBite = el;
          for (let m = 0; m < 14; m++) {
            const a = (m / 14) * Math.PI * 2 + b.ph;
            const rr = S.rp + 4 + (m % 3) * 2;
            motes.add({ x: pp.x + Math.cos(a) * rr, y: pp.y + Math.sin(a) * rr, to: pp, life: 90 + (m % 4) * 30, c: m % 3 === 0 ? PAL.white : m % 3 === 1 ? PAL.void4 : PAL.void3 });
          }
          // its tile flashes violet; its card goes home now, fast (all cards are home before the blinks)
          const t = b.tile;
          if (t?.active) t.setHighlight(PAL.void4);
          if (b.kind === 'monster') {
            bg(
              wait(sc, 40).then(() => {
                if (t?.active) t.setHighlight(null);
                const { tile } = field.release(b.uid);
                field.forget(b.uid);
                flights.push(cardHome(ctx, b.owner, b.cardId, tile ? tile.home : b.floor, tile, 0));
              }),
            );
          } else {
            // a token / decoy has no card: its tile crumbles (it went into the eye whole)
            const { tile } = field.release(b.uid);
            field.forget(b.uid);
            if (b.kind === 'decoy') field.remove(b.uid);
            if (tile) {
              for (let m = 0; m < 10; m++) motes.add({ x: b.floor.x + R((rng() - 0.5) * 24), y: b.floor.y + R((rng() - 0.5) * 8), vy: -30 - rng() * 30, life: 380, c: m % 2 ? PAL.void4 : PAL.void3 });
              flights.push(tile.fadeOut(200).then(() => tile.destroy()));
            }
          }
          sendCards();
        }
        continue;
      }
      // the hit-stop: frozen in place from the contraction to the pull
      if (el >= T.contract && b.kind !== 'saved') {
        moveRims(b, el);
        continue;
      }
      // ---- the rise: squat 1 px (anticipation), snap 2 px (tears off), then ONE continuous ascent that never parks:
      // a curved path (it swings outward, then in, like a slow vortex) to its seat on the crown, and from 42 % on the
      // whole crown tightens toward the pupil (half way in by the contraction, accelerating) — the contraction
      // finishes a motion already under way. Every body bobs 1 px on its own beat.
      let gx = b.x0;
      let gy = b.y0;
      if (el >= T.lift) {
        const k = el - T.lift;
        if (k < 60) gy = b.y0 + 1;
        else if (k < 110) gy = b.y0 - 2;
        else {
          const u = seg(el, T.lift + 110, T.contract - T.lift - 110);
          const a = Math.min(1, u / 0.78);
          const e = ease.out(a);
          const side = b.tx >= eye.x + b.offX ? 1 : -1;
          const swing = b.kind === 'saved' ? 0 : Math.sin(Math.PI * a) * 10 * side;
          gx = b.x0 + (b.tx - b.x0) * e + swing;
          gy = b.y0 - 2 + (b.ty - b.y0 + 2) * e;
          if (b.kind !== 'saved') {
            const tight = ease.in(seg(u, 0.42, 0.58)) * 0.48;
            gx += (pp.x + b.offX - b.tx) * tight;
            gy += (pp.y + b.offY - b.ty) * tight;
          }
          gy += Math.floor((el + b.ph * 60) / 190) % 2 ? -1 : 0;
        }
      }
      const sway = el >= T.lift + 110 ? Math.round(Math.sin(el / 300 + b.ph)) : 0;
      // the guardian charm's save: yanked down in 160 ms (ease-in), lands, stays
      if (b.kind === 'saved' && b.yank >= 0) {
        if (b.turn >= 0) {
          b.turn = -1;
          g.setScale(1);
        }
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
          // a gold outline for two frames (it is kept)
          rimOf(sc, b, PAL.gold4);
          b.rimUntil = el + 60;
          // "KORUNDU" on an ink plate at a fixed screen y just in front of its tile (under its feet: never over the
          // risen band, the eye or a neighbour — on a centre-lane survivor the space over its head is the eye's),
          // 450 ms, gone before the contraction
          const wy = b.floor.y + 22;
          const w = pixelText(sc, b.floor.x, wy, 'KORUNDU', { size: 'md', color: PAL.gold3 }).setOrigin(0.5, 1).setDepth(DEPTH.FX_TOP);
          const pw = R(w.width) + 6;
          const ph = R(w.height) + 4;
          const plate = sc.add.rectangle(R(b.floor.x - pw / 2), wy - ph + 2, pw, ph, PAL.ink).setOrigin(0).setDepth(DEPTH.FX_TOP - 0.01);
          const edge = sc.add.rectangle(R(b.floor.x - pw / 2) + 1, wy + 1, pw - 2, 1, PAL.gold1).setOrigin(0).setDepth(DEPTH.FX_TOP - 0.005);
          const life = Math.min(450, Math.max(200, T.contract - 20 - el));
          words.push(
            run(sc, life, (t) => {
              const on = t < 0.8 || Math.floor(t * 16) % 2 === 0;
              w.setVisible(on);
              plate.setVisible(on);
              edge.setVisible(on);
            }).then(() => {
              w.destroy();
              plate.destroy();
              edge.destroy();
            }),
          );
        }
        if (b.landed) {
          gx = b.x0;
          gy = b.y0;
        }
      }
      g.x = R(gx + (b.landed ? 0 : sway));
      g.y = R(gy);
      // turning: two slow turns — the body narrows (0.66 → 0.33), mirrors, widens back (0.33 → 0.66 → 1), 30 ms a
      // frame, a 1-px void4 OUTLINE round it while it turns (no fill, no rotation)
      if (el < T.contract && !(b.kind === 'saved' && b.yank >= 0)) {
        if (b.turn < 0 && b.flips.length && el >= b.flips[0]) {
          b.flips.shift();
          b.turn = el;
          b.turned = false;
          rimOf(sc, b, PAL.void4);
          b.rimUntil = el + TURN.length * TURN_MS;
        }
        if (b.turn >= 0) {
          const fi = Math.floor((el - b.turn) / TURN_MS);
          if (fi >= TURN.length / 2 && !b.turned) {
            b.turned = true;
            g.setFlipX(!g.flipX);
            g.setOrigin(1 - g.originX, g.originY);
          }
          if (fi >= TURN.length) {
            b.turn = -1;
            g.setScale(1);
          } else g.setScale(TURN[fi], 1);
        }
      }
      moveRims(b, el);
      b.light?.setPosition(g.x, g.y - 14, b.floor.y);
      // motes rising off its tile while it floats
      if (el >= T.lift && el < T.contract && b.kind !== 'saved' && rng() < dtS / 70) {
        motes.add({ x: b.floor.x + R((rng() - 0.5) * 22), y: b.floor.y + R((rng() - 0.5) * 6), vy: -26 - rng() * 20, life: 520, c: rng() < 0.3 ? PAL.void4 : PAL.void3 });
      }
    }

    // ================================ light: holes in the night stamp (the eye's glow on the wall, its gaze on the field)
    const night = nightOf(sc);
    if (night) {
      const holes: NightHole[] = [];
      const lid = lidAt(el);
      if (S.fade < 1) {
        if (!S.closed && lid > 0) holes.push({ x: eye.x, y: eye.y, rx: R(30 + 44 * lid), ry: EH + 12 });
        else if (!S.closed && S.crack > 0) holes.push({ x: eye.x, y: eye.y, rx: R(16 * S.crack), ry: R((EH + 8) * S.crack) });
        else if (S.closed) holes.push({ x: eye.x, y: eye.y + R(EH * (1 - S.seam)), rx: 16, ry: Math.max(10, R(EH * S.seam)) });
      }
      const gIn = q(seg(el, T.gaze, 180), 3);
      const gOut = q(seg(el, T.gulp, 210), 3);
      const gr = R(118 * gIn * (1 - gOut));
      if (gr > 0) holes.push({ x: fieldMid.x, y: fieldMid.y, rx: gr, ry: R(gr * 0.52) });
      if (el >= T.land && el < T.land + 200) holes.push({ x: landAt.x, y: landAt.y, rx: el < T.land + 100 ? 40 : 24, ry: el < T.land + 100 ? 20 : 12 });
      night.holes = holes;
      night.sync();
    }
    // a slow spiral of 1-px motes winding into the pupil while the bodies rise (the pull of the gaze)
    if (el >= T.gaze + 80 && el < T.contract - 60 && rng() < dtS / 34) {
      const a = rng() * Math.PI * 2;
      const rr = 44 + rng() * 22;
      motes.add({ x: eye.x + Math.cos(a) * rr, y: eye.y + Math.sin(a) * rr * 0.9, to: pupil(), spin: 2.4, life: 520 + rng() * 240, c: rng() < 0.2 ? PAL.white : rng() < 0.5 ? PAL.void4 : PAL.void3 });
    }

    // ================================ draw
    const clouds = el < T.tearFall + 40 ? q(seg(el, T.rift, T.riftMs), 3) : 1 - q(seg(el, T.tearFall + 40, 180), 3);
    cloudR.draw((r) => drawClouds(r, eye, clouds, el, S.open > 0 && !S.closed));
    sky.draw((r) => drawEye(r, eye, S));
    floor.draw((r) => {
      // shrinking shadows under the risen bodies (stepped radii)
      for (const b of bodies) {
        if (!b.ghost || b.gone || el < T.lift || el >= T.pull || (b.kind === 'saved' && b.landed)) continue;
        // (opaque ink: a solid core and a 3/4 Bayer rim — no alpha)
        const h = b.y0 - b.ghost.y;
        const rx = Math.max(2, 9 - Math.floor(h / 12));
        const ry = Math.max(1, rx >> 1);
        for (let yy = -ry; yy <= ry; yy++) {
          const w = Math.floor(rx * Math.sqrt(1 - (yy * yy) / ((ry + 0.5) * (ry + 0.5))));
          for (let xx = -w; xx <= w; xx++) r.dpx(b.floor.x + xx, b.floor.y + yy, PAL.ink, Math.abs(xx) >= w - 1 || Math.abs(yy) === ry ? 0.75 : 1);
        }
      }
      splash(r, el);
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
      // the tear: swells at the bottom of the slit (4 frames, the last one with a white glint), hangs, falls with
      // smear frames onto its landing point
      if (el >= T.tear && el < T.land) {
        const sy = eye.y + EH + 3;
        const sw = el - T.tear;
        const fall = ease.in(seg(el, T.tearFall, T.land - T.tearFall));
        const x = R(eye.x + (landAt.x - eye.x) * fall);
        const y = R(sy + (landAt.y - 1 - sy) * fall);
        (tearLight as LightHandle | null)?.setPosition(x, y, fieldMid.y);
        if (el < T.tearFall) {
          const size = sw < 30 ? 0 : sw < 60 ? 1 : sw < 90 ? 2 : 3;
          drawDrop(r, x, sy + [1, 3, 6, 9][size], size as 0 | 1 | 2 | 3, 0, sw >= 90 && sw < 130);
        } else {
          // smear: the stretched drop + two fading ghost copies above it, spaced by the speed
          const v = R(4 + fall * 16);
          drawDrop(r, x, y, 3, Math.min(6, R(fall * 9)), false);
          if (fall > 0.08) r.rect(x - 1, y - 16 - v, 3, v, PAL.void3);
          if (fall > 0.3) r.rect(x, y - 18 - v * 2, 1, v, PAL.void2);
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
  sendCards();
  for (const b of bodies) {
    if (b.kind === 'saved') {
      b.ghost?.destroy();
      for (const r of b.rims) r.destroy();
      b.unit?.show();
      b.unit?.settle();
      continue;
    }
    b.ghost?.destroy();
    for (const r of b.rims) r.destroy();
  }
  // the motes of the splash keep drawing a moment longer
  const tail = run(sc, 220, (_t, tel, dt) => {
    motes.step(dt);
    air.draw((r) => motes.draw(r));
    floor.draw((r) => splash(r, T.end + tel));
    sky.draw(() => undefined);
    cloudR.draw(() => undefined);
  });
  await Promise.all([...flights, tail, ...words]);
  sky.destroy();
  cloudR.destroy();
  air.destroy();
  floor.destroy();
  for (const b of bodies) b.light?.destroy();
  // whatever else came with the wipe (stat changes, an attacked decoy) plays now, in order
  for (const i of later) if (!ctx.isConsumed(i)) await ctx.play(i);
}

/**
 * The purple tear (feet at y): size 0 a bead 3×4, 1 a drop 5×7, 2 a drop 7×10, 3 the full drop 9×13 — a void3
 * body, a void4 lit left side, a white glint (2×2 + a one-frame white flare on `shine`), a void2 belly, ink
 * outline; `stretch` px longer while it falls.
 */
function drawDrop(r: Raster, x: number, y: number, size: 0 | 1 | 2 | 3, stretch: number, shine: boolean): void {
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
  const rows = size === 1 ? [0, 1, 1, 2, 2, 2, 1] : size === 2 ? [0, 0, 1, 1, 2, 2, 3, 3, 3, 3, 2] : [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 4, 4, 3];
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
  const hy = top + R(H * 0.5);
  r.px(x - 1, hy, PAL.white);
  if (size >= 2) r.px(x - 1, hy + 1, PAL.white);
  if (size === 3) r.px(x - 2, hy + 1, PAL.white);
  if (shine) {
    // the hang's one-frame flare: a white cross on the glint
    r.px(x - 2, hy, PAL.white);
    r.px(x - 1, hy - 1, PAL.white);
    r.px(x - 1, hy + 2, PAL.white);
    r.px(x - 3, hy + 1, PAL.white);
  }
}
