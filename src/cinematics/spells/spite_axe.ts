// Hınç Baltası (spite_axe) — v3 presentation (docs/v3/YENI_KARTLAR.md §7 S10; lane E). The v1 look keeps the
// generic equip and the batch-2 placeholder toDeck (src/cinematics/b2/placeholders.ts): every hook below steps
// aside without ?look=v3.
//
// "Yüz, kafatası yok. Kara demir, kor çatlaklı, zincirle sarılı ve sapı canlı damarlar gibi atan bir balta gökten
//  iner ve canavarın yanına zemine saplanır (çatlak, kor kıvılcımı) → canavar eğilip sapı kavrar; damarlar koluna
//  doğru tırmanır → canavar baltayı yerden söker (zincirler gerilip şaklar), gözleri kor rengine yanar, ATK +800
//  yuvarlanır. Dönüş (1.4 s): balta canavarın elinden kendiliğinden kayar, zincirlerini şaklatarak sahibinin deste
//  yığınının üstüne çakılır; zincirlerden biri LP paneline kırbaç gibi vurur (−500)."
//
// BEAT LIST (scene ms at 1×; ×1.35 in game time with the v3 tempo). The axe is drawn in code (_spite_axe_motif.ts):
// 24 pre-drawn haft angles, never a rotated / scaled sprite.
// ACTIVATE (hook 'activate'):
//   0      common v3 spell opening (spells/_kit spellOpening): the card beside its owner (or standing on its set
//          tile), "HINÇ BALTASI" plate, a short hover
//   ~300   LAND (op.landV3): the card flies onto its spell zone and lies down; the tile burns one ember tone
// EQUIP (hook 'equip', +ms from the event):
//   +0     OMEN: the lying card's art flares ember; an ember spark shoots from the card up into the sky over the
//          bite point; an ember target cross blinks on the floor beside the monster — e_axeOmen (the drone's first
//          throb, a chain shiver)
//   +150   the AXE appears high above (white-hot first frame), TUMBLES half a turn (4 turn drawings)…
//   +260   …and DIVES head-first along its own haft line (inQuad), two chains streaming behind it, ember sparks
//          trailing, a 1-frame light line behind it — e_axeFall (falling whistle + chain rattle)
//   +500   THE BITE beside the wielder, on the side whose ground is FREE (planBite: the front first, else the back,
//          else the front corner of its own tile), the haft's top 5 px off the body's edge at grip height: ONE white
//          silhouette frame, then the real drawing with white-cored cracks (heat 4) through the 80 ms hit-stop; a
//          1-frame hot floor ellipse; five ember cracks race out (stepped); dirt + ember burst; 3 px shake — e_axeBite.
//          The haft QUIVERS (±1 px, 6 frames).
//   +560   the chains fall slack and coil round two iron pegs on the far side (real links: _spite_axe_chain.ts)
//   +640   VEIN PULSE (the haft beats, the cracks flare, an ember ring breathes) — e_axePulse
//   +830   THE REACH: the wielder CROUCHES and LEANS (a crisp pixel double, _spite_axe_grip.ts BodyDouble: rows fold
//          at the knee, the upper body shears toward the haft) and steps in until its HAND (an authored anchor per
//          monster: a fist, a jaw, a claw, a tail) lies ON the haft. The plan is built round that hand: the haft is drawn
//          long enough (scale ≥ 1) for its top to stand over the hand, the bite never lands on the axe card's own tile
//   +1040  THE GRIP (contact frame): the hand's own tones wrap the haft as knuckles (in front of it) — e_axeGrip; a
//          1-px fire-ramp VEIN climbs from the hand up the body's near edge to the head (stepped; then it beats)
//   +1360  THE WRENCH: three ESCALATING tugs (230 ms each: yank → strain → give) — the body leans back AWAY, the haft
//          tilts toward it and lifts 1 → 3 → 5 px out of the bite; the body hangs on the haft (its hand stays on the
//          haft's station at the hand's height); cracks step up a band, dirt + embers, shakes — e_axeWrench
//   +2050  SNAP: the chains break (white stars, links FLUNG), hit-stop 60 ms; the axe TEARS OUT in the fist, white-
//          cored; the body jerks back with it — e_axeSnap
//   +2110  THE HEAVE: the axe swings up ROUND THE HAND (its station locked in the fist, 15° drawings, never through the
//          floor), the hand choking up the haft, the body rising out of its lean; slung onto the back (two hot frames)
//   +2350  THE OATH: the vein flares white → fire4 and cools out, the EYES IGNITE and LEAD (≈290 ms: a white frame, then a
//          2-px ember core with a shrinking 4-px flare on an ink backing), the body's edge flares later, soft — e_axeIgnite;
//   +2640  then "+800" (no oversize pop) BESIDE the body on its front side, or over its shoulder when a neighbour stands there, the badge
//          rolls; the persistent aura starts (AxeAura)
//   +3040  the number has faded out; the input returns
// DESTROYED (hook 'destroyed', the axe's card leaves its spell zone): the card flares ember, a crack runs across it,
//   it crumbles into embers on its tile — e_axeCard
// RETURN (lane-E toDeck, registerLaneE; +ms):
//   +0     SLIP: the slung axe shudders (±1 px), the wielder's eyes go out (a wisp of ember smoke); a dead wielder's
//          axe (Fallen) wrenches itself out of the floor instead — e_axeSlip. A card tile left on the field (a
//          monster's death / a mass wipe: no 'destroyed' hook) crumbles to embers on its tile (crumbleTile, e_axeCard)
//   +200   it drops 4 px out of the grip, tilts, and LAUNCHES (the −800 rolls NOW, as it leaves): one white-cored
//          frame, a high arc to its OWNER's deck pile (the apex kept under the HUD band), spinning 1.5 turns, a chain
//          of real links whipping behind with white cracks — e_axeFly
//   +640   SLAM onto the deck pile: the white-cored drawing for the 60 ms stop, the pile squashes, its cards fan 1 px,
//          a dust ring widens, embers; 2 px shake — e_axeDeck (a card-stack "güm", no iron); it sinks into the pile
//   +770   THE LASH: a red-hot chain of links unrolls from the pile in an S-wave (2–3 crests travelling), its tip
//          OVERSHOOTS the panel and snaps back: one held CRACK frame (a white-cored 8-ray star on the tip), the panel
//          recoils 2 px (hud.shake) with a stepped white → fire edge, a spark ring; the −500 pops and the LP drains ON
//          that contact frame (P2: under its top panel) — e_axeLash (a whip crack landing as a 100 Hz hit). The lash is
//          heavy 2-px links with white-hot cores riding the crests, arcing above the duelists' avatars
//   +1020  the chain jerks back off the panel in a wave and slithers into the pile; done (≈1.35 s)

import type Phaser from 'phaser';
import type { CardId } from '../../data/cards';
import type { GameEvent, PlayerId, Uid } from '../../engine/types';
import { PAL } from '../../art/palette';
import { currentAtk } from '../../engine/query';
import { crackPath } from '../../art/spellmotifs-v3';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import { DEPTH, LOOK_V3, type XY, panelRect, zoneXY } from '../../view/layout';
import { shake, wait } from '../../vfx/core';
import { E, Raster, freeze, lerp, onFrame, qbez, run, spriteBox } from '../../vfx/setpieces';
import { frameRGBA } from '../../art/atlas';
import type { TileCard } from '../../view/TileCard';
import { isoCanvas } from '../../art/cards';
import { FlungLinks, PixBag, chainLinks, heavyChainLinks } from './_spite_axe_chain';
import { Sparks as PxSparks } from '../../vfx/combat';
import { fxCount, fxRng, motifImage, numberUnderBar, rimClimb, rimFlash, setMotif, silhouetteOf } from '../_v3/spellfx';
import { panAt, play as playV3 } from '../_v3/sound';
import { axeNumber, type AxeNumber } from './_spite_axe_number';
import { lpPoint } from '../_core/helpers';
import { LP_ROLL_MAX_MS } from '../_v3/budget';
import { fx, registerCardHook, registerEvent, registerObserver, type CinematicContext } from '../api';
import { registerLaneE, type LaneECtx } from '../b2e/dispatch';
import { bg, evAt, idxOf, lightFlash, lightPool, relax, setTileOf, spellOpening, type ActCtx, type AnyCtx } from './_kit';
import { type AxeOpts, type AxeSize, axeAngle, axeKey, axeOffset } from './_spite_axe_motif';
import { BodyDouble, handAnchor, handTones } from './_spite_axe_grip';
import { AURAS, AxeAura, DETACHED, FALLEN, LAST, type AxePose, drawEyes, eyesOf, holdAt, holdPose } from './_spite_axe_aura';

const ID: CardId = 'spite_axe';
const R = Math.round;
type EquipCtx = CinematicContext<Extract<GameEvent, { type: 'equip' }>>;
type DestroyCtx = CinematicContext<Extract<GameEvent, { type: 'destroy' }>>;
type DeckCtx = LaneECtx<'toDeck'>;
type StatEv = Extract<GameEvent, { type: 'statChange' }>;

// ================================================================ timing (scene ms, 1×)

const OPEN_HOLD = 160;
const T = {
  omenMs: 120,
  appear: 150,
  tumbleMs: 90,
  diveMs: 210,
  stop: 80,
  quiverFrames: 6,
  pulseEvery: 190,
  reachStep: 70,
  veinMs: 320,
  tugMs: 230,
  snapStop: 60,
  pullMs: 220,
  tail: 160,
} as const;
const RET = { shudder: 120, drop: 90, flyMs: 430, slamStop: 60, sinkMs: 130, lashMs: 200, backMs: 180 } as const;

const EMBER = [PAL.white, PAL.fire4, PAL.fire3, PAL.fire2, PAL.fire1] as const;
const EMBER_DOWN = [PAL.fire4, PAL.fire3, PAL.fire2, PAL.fire1, PAL.stone0] as const;
const VEIN_RIM = [PAL.crim1, PAL.crim2, PAL.fire2, PAL.fire3] as const;

// ================================================================ small helpers

function frames(scene: Phaser.Scene, n: number): Promise<void> {
  return new Promise((resolve) => {
    let k = 0;
    onFrame(scene, (dt) => {
      if (dt > 0) k++;
      if (k >= n) {
        resolve();
        return false;
      }
      return true;
    });
  });
}

const quant = (t: number, n: number): number => Math.floor(Math.max(0, Math.min(1, t)) * n) / n;

/** The shortest signed turn from a to b (degrees). */
const turn = (a: number, b: number): number => ((((b - a) % 360) + 540) % 360) - 180;

/** An axe image (lg or sm drawing) with helpers to re-pose it. */
class AxeSprite {
  readonly img: Phaser.GameObjects.Image;
  o: AxeOpts;
  constructor(scene: Phaser.Scene, o: AxeOpts, x: number, y: number, depth: number) {
    this.o = { ...o };
    this.img = motifImage(scene, ...axeKey(this.o), x, y, depth);
  }
  set(o: Partial<AxeOpts>): this {
    this.o = { ...this.o, ...o };
    setMotif(this.img, ...axeKey(this.o));
    return this;
  }
  at(x: number, y: number): this {
    this.img.setPosition(R(x), R(y));
    return this;
  }
  /** Cut every row under world row `floor` (buried in the floor). */
  bury(floor: number | null): this {
    const cut = floor === null ? null : R(floor - this.img.y);
    if (cut !== (this.o.cut ?? null)) this.set({ cut });
    return this;
  }
  /** World point of a local (u, v) of the drawing. */
  pt(u: number, v: number): XY {
    const d = axeOffset(this.o, u, v);
    return { x: this.img.x + d.x, y: this.img.y + d.y };
  }
  destroy(): void {
    if (this.img.active) this.img.destroy();
  }
}

/** Points of a chain hanging / streaming from `a` toward `b` with a sideways wave (amp, phase). */
function chainPts(a: XY, b: XY, amp: number, phase: number, n = 10): XY[] {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const out: XY[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const w = Math.sin(t * Math.PI * 2 + phase) * amp * t;
    out.push({ x: a.x + dx * t + nx * w, y: a.y + dy * t + ny * w });
  }
  return out;
}

// ================================================================ floor cracks (the bite)

interface Cracks {
  /** 0 … 1 how far they have run; `glow` 0 cold … 4 white-hot core. */
  grow(k: number): void;
  glow(level: number): void;
  slit(on: boolean): void;
  cool(ms: number): Promise<void>;
  destroy(): void;
}

function floorCracks(scene: Phaser.Scene, at: XY, seed: number, side: number): Cracks {
  const ras = Raster.around(scene, at.x, at.y, 120, 64, DEPTH.TILE_FX + 3);
  // five cracks on the floor's 2:1 plane, the longest two running along the tile's diagonals
  const dirs = [
    [1, 0.5, 26],
    [-1, 0.5, 22],
    [1, -0.5, 18],
    [-1, -0.5, 24],
    [0.2 * side, 1, 10],
  ] as const;
  const paths = dirs.map(([dx, dy, len], i) => crackPath(at, { x: R(at.x + dx * len), y: R(at.y + dy * len * 0.55) }, seed * 7 + i * 13, 2));
  let k = 0;
  let level = 3;
  let slit = false;
  let dead = false;
  const draw = (): void => {
    if (dead) return;
    ras.begin();
    if (slit) {
      for (let x = -3; x <= 3; x++) ras.px(at.x + x, at.y, Math.abs(x) === 3 ? PAL.stone0 : PAL.ink);
      ras.px(at.x - 2, at.y - 1, PAL.stone0);
      ras.px(at.x + 2, at.y + 1, PAL.stone0);
    }
    if (level >= 0)
      for (const p of paths) {
        const n = Math.ceil(p.length * k);
        for (let i = 0; i < n; i++) {
          const q = p[i];
          // hot near the bite and at the running head, cooler behind
          const head = i >= n - 2 && k < 1;
          const near = i < p.length * 0.35;
          const lv = Math.max(0, Math.min(4, level + (head ? 1 : 0) + (near ? 0 : -1)));
          ras.px(q.x, q.y, [PAL.stone0, PAL.fire1, PAL.fire2, PAL.fire3, PAL.fire4][lv]);
        }
      }
    ras.end();
  };
  draw();
  return {
    grow(v) {
      k = Math.max(k, Math.min(1, v));
      draw();
    },
    glow(v) {
      level = v;
      draw();
    },
    slit(on) {
      slit = on;
      draw();
    },
    async cool(ms) {
      const steps = Math.max(1, level + 1);
      for (let i = 0; i < steps && !dead; i++) {
        await wait(scene, ms / steps);
        level--;
        draw();
      }
      if (!dead) {
        level = -1;
        draw();
        await wait(scene, 260);
        slit = false;
        draw();
      }
    },
    destroy() {
      dead = true;
      ras.destroy();
    },
  };
}

/**
 * A flat dirt puff on the floor: 1-px stepped ellipse rings (earth2 outer, earth1 inner), widening over `n` frames and
 * thinning out — clean tone bands, no dither.
 */
async function dirtRing(sc: Phaser.Scene, ras: Raster, at: XY, r0: number, n: number): Promise<void> {
  for (let f = 0; f < n; f++) {
    if (!ras.alive) return;
    ras.begin();
    const rr = [r0 + f * 3, r0 + f * 3 - 3];
    rr.forEach((r, j) => {
      if (r < 2 || (j === 1 && f >= n - 1)) return;
      const steps = Math.max(16, Math.round(r * 4));
      for (let a = 0; a < steps; a++) {
        const an = (a / steps) * Math.PI * 2;
        const sn = Math.sin(an);
        // the back arc thins first (the near half stays one frame longer)
        if (f >= n - 2 && sn < 0) continue;
        if (f >= 1 && j === 0 && a % 4 === 3) continue;
        ras.px(R(at.x + Math.cos(an) * r), R(at.y + 1 + sn * r * 0.5), j === 0 ? PAL.earth1 : PAL.earth2);
      }
    });
    ras.end();
    await frames(sc, 2);
  }
  if (ras.alive) {
    ras.begin();
    ras.end();
  }
}

// ================================================================ ACTIVATE

registerCardHook(ID, 'activate', async (ctx: ActCtx) => {
  if (!LOOK_V3) return ctx.base();
  const ev = ctx.ev;
  const sc = ctx.scene;
  const run0 = fx.resolutionRun(ctx);
  const ti = idxOf(ctx, run0, (e) => e.type === 'target');
  const ei = idxOf(ctx, run0, (e) => e.type === 'equip' && e.spellUid === ev.uid);
  const set = setTileOf(ctx);
  const op = await spellOpening(ctx, { uid: ev.uid, cardId: ev.cardId, player: ev.player, from: set ? 'set' : 'hand', zone: ev.zone, hold: OPEN_HOLD });
  if (ev.zone === null || ei < 0) {
    await op.close();
    relax(ctx);
    await fx.playRun(ctx, run0);
    return;
  }
  const zone = ev.zone;
  const at = zoneXY(ev.player, 'spellTrap', zone);
  const land = (): void => {
    playV3('cardPlace', { volume: 0.8, pan: panAt(at.x) });
    bg(ctx.views.board.flashTile(ev.player, 'spellTrap', zone, PAL.fire2, 150));
    void lightFlash(sc, at.x, at.y, PAL.fire2, 20, 220, { floorY: at.y, intensity: 0.55 });
  };
  const tile = op.landV3 ? await op.landV3({ spot: 'spellTrap', index: zone, ms: 90, lieMs: set ? 110 : 80, onLand: land }) : await op.land({ spot: 'spellTrap', index: zone });
  if (ti >= 0) ctx.consumeAt(ti);
  await ctx.play(ei, { from: { x: tile.home.x, y: tile.home.y } });
  await fx.playRun(ctx, fx.resolutionRun(ctx));
  relax(ctx, 300);
});

// ================================================================ EQUIP — the signature

/** Monsters being forged right now (the aura upgrade observer leaves them alone). */
const forging = new Set<Uid>();

registerCardHook(ID, 'equip', async (ctx: EquipCtx) => {
  if (!LOOK_V3) return ctx.base();
  const ev = ctx.ev;
  const u = ctx.unit(ev.targetUid);
  const ci = ctx.findType('statChange', (e) => e.uid === ev.targetUid, { until: (e) => e.type !== 'statChange' });
  if (!u || u.retired || !u.sprite.active || !u.sprite.visible) {
    if (ci >= 0) await ctx.play(ci);
    return;
  }
  forging.add(u.uid);
  try {
    await axeScene(ctx, u, ci);
  } finally {
    restoreBadges([...HIDDEN_BADGES]);
    forging.delete(u.uid);
    if (!u.retired && u.sprite.active) u.settle();
  }
});

// ---------------------------------------------------------------- the wielder's frames (no posing needed to measure)

interface FrameMask {
  W: number;
  H: number;
  data: Uint8ClampedArray;
}
const maskCache = new Map<string, FrameMask | null>();

function frameMask(s: Phaser.GameObjects.Sprite, name: string): FrameMask | null {
  const key = `${s.texture.key}|${name}`;
  if (maskCache.has(key)) return maskCache.get(key) ?? null;
  let m: FrameMask | null = null;
  try {
    const fr = s.texture.get(name);
    if (fr && fr.name === name) {
      const data = frameRGBA(fr);
      if (data) m = { W: fr.realWidth, H: fr.realHeight, data };
    }
  } catch {
    m = null;
  }
  if (maskCache.size > 120) maskCache.clear();
  maskCache.set(key, m);
  return m;
}

/**
 * The outermost opaque world x of frame `name` on the `side` (+1 right / −1 left) within world rows [y0, y1], as if the
 * sprite stood at its current position shifted by dx; null when the rows are empty.
 */
function edgeX(s: Phaser.GameObjects.Sprite, name: string, y0: number, y1: number, side: number, dx = 0): number | null {
  const m = frameMask(s, name);
  if (!m) return null;
  const left = Math.round(s.x - s.displayOriginX) + dx;
  const top = Math.round(s.y - s.displayOriginY);
  let best: number | null = null;
  for (let wy = Math.round(y0); wy <= Math.round(y1); wy++) {
    const fy = wy - top;
    if (fy < 0 || fy >= m.H) continue;
    for (let fx = 0; fx < m.W; fx++) {
      if (m.data[(fy * m.W + fx) * 4 + 3] === 0) continue;
      const wx = left + (s.flipX ? m.W - 1 - fx : fx);
      if (best === null || (side > 0 ? wx > best : wx < best)) best = wx;
    }
  }
  return best;
}

/** The planted drawing for a bite on screen side `side` of the body, its haft leaning `lean` 15° steps further in
 *  toward the body (0: the plain 75° plant): the blade fans away, the haft leans in. */
const plantFor = (side: number, lean = 0): { angle: number; mirror: boolean } => (side > 0 ? { angle: 75 - 15 * lean, mirror: true } : { angle: 105 + 15 * lean, mirror: false });

interface BitePlan {
  side: number;
  front: boolean;
  bite: XY;
  floorY: number;
  plantO: XY;
  angle: number;
  mirror: boolean;
  /** The axe drawing's exact scale (≥ 1: a tall wielder gets a longer haft so its hand finds it). */
  scale: number;
  /** The wielder's gripping hand (idle:0 frame px, see _spite_axe_grip.ts) and where it is at rest (world). */
  hand: XY;
  handW: XY;
  /** The haft station (lg units along the haft, −31 … −10) at the hand's height. */
  gripU: number;
  /** The axe's depth while planted (in front of the wielder, and of any neighbour it overlaps). */
  depth?: number;
  /** Opposing bodies' boxes (the chain pegs keep clear of them). */
  foes?: readonly { l: number; r: number; t: number; b: number }[];
}

const REACH_PX = 6;
const SCALES = [1, 1.1, 1.2, 1.3, 1.4, 1.5] as const;

/** The haft station u (−31 … −10, half steps) whose point lies nearest world row `y` for an axe with origin O. */
function stationAt(o: AxeOpts, O: XY, y: number): number {
  let best = -20;
  let bd = Infinity;
  for (let u = -31; u <= -10; u += 0.5) {
    const d = Math.abs(O.y + axeOffset(o, u, 0).y - y);
    if (d < bd - 0.01) {
      bd = d;
      best = u;
    }
  }
  return best;
}

/** World pixel of idle:0 frame point fp for the sprite at its current position. */
function frameWorld(s: Phaser.GameObjects.Sprite, fp: XY): XY {
  const W = s.frame.realWidth;
  return { x: Math.round(s.x - s.displayOriginX) + (s.flipX ? W - 1 - fp.x : fp.x), y: Math.round(s.y - s.displayOriginY) + fp.y };
}

/**
 * Where the axe bites: beside the body on the side whose ground is FREE (no other monster's body over the axe's
 * footprint, never on the axe card's own tile), the front first. The plan is built round the wielder's HAND (an
 * authored anchor per monster): the haft is long enough (the drawing's scale) for its top to stand above the hand,
 * the station at the hand's height stands REACH_PX off the hand, and the haft never cuts into the body (the bite
 * moves out; the haft leans a step further in when that leaves the hand too far). Both sides taken: the front corner
 * of its own tile (nearer the camera).
 */
function planBite(ctx: EquipCtx, u: MonsterUnit): BitePlan {
  const s = u.sprite;
  const ev = ctx.ev;
  const home = { x: R(u.home.x), y: R(u.home.y) };
  const facing = u.flipX ? -1 : 1;
  const others: { l: number; r: number; t: number; b: number; d: number; foe: boolean }[] = [];
  for (const p of ctx.state.players)
    for (const m of p.monsters) {
      if (!m || m.uid === u.uid) continue;
      const o = ctx.unit(m.uid);
      const sil = o && o.sprite.active && o.sprite.visible ? silhouetteOf(o.sprite) : null;
      if (sil) others.push({ l: sil.left, r: sil.right, t: sil.top, b: sil.bottom, d: o!.sprite.depth, foe: o!.player !== u.player });
    }
  // the axe card's own tile (lying on its spell zone): the bite never lands on it (the cracks read on clean floor)
  const own = ctx.views.field.tileAt(ev.player, 'spellTrap', ev.spellZone);
  const ownAt = own ? { x: R(own.home.x), y: R(own.home.y) } : zoneXY(ev.player, 'spellTrap', ev.spellZone);
  const onOwnTile = (q: XY): boolean => Math.abs(q.x - ownAt.x) / 30 + Math.abs(q.y - ownAt.y) / 16 < 1.25;
  type Plan = BitePlan & { box: { l: number; r: number; t: number; b: number }; miss: number };
  const build = (side: number, floorY: number): Plan => {
    const front = side === facing;
    const hand = handAnchor(u, side);
    const handW = frameWorld(s, hand);
    const handH = floorY - handW.y;
    let best: Plan | null = null;
    for (const lean of [0, 1]) {
      const pp = plantFor(side, lean);
      // the haft's top stands ≥ 5 px above the hand
      let scale: number = SCALES[SCALES.length - 1];
      for (const k of SCALES) {
        const o: AxeOpts = { size: 'lg', angle: pp.angle, mirror: pp.mirror, scale: k };
        const oy = floorY - axeOffset(o, 9, 11).y + 3;
        if (floorY - (oy + axeOffset(o, -31, 0).y) >= handH + 5) {
          scale = k;
          break;
        }
      }
      const lg: AxeOpts = { size: 'lg', angle: pp.angle, mirror: pp.mirror, scale };
      const toe = axeOffset(lg, 9, 11);
      const oy = floorY - toe.y + 3;
      const gripU = stationAt(lg, { x: 0, y: oy }, handW.y + 1);
      const g = axeOffset(lg, gripU, 0);
      // the station at the hand's height stands REACH_PX off the hand…
      let ox = handW.x + side * REACH_PX - g.x;
      // …and no part of the haft / cheek may cut into the body at rest: the bite moves out until it clears
      let push = 0;
      for (let uu = -31; uu <= 3; uu += 1)
        for (const vv of [-3, 3]) {
          const q = axeOffset(lg, uu, vv);
          const x = ox + q.x;
          const y = oy + q.y;
          const e = edgeX(s, 'idle:0', y, y, side);
          if (e === null) continue;
          push = Math.max(push, (e + side * 2 - x) * side);
        }
      ox += side * Math.max(0, push);
      const miss = REACH_PX + Math.max(0, push);
      const plantO = { x: R(ox), y: R(oy) };
      const bite = { x: R(ox + toe.x), y: floorY };
      const xs = [plantO.x + axeOffset(lg, -31, 0).x, bite.x, plantO.x + axeOffset(lg, -2, 15).x];
      const box = { l: Math.min(...xs) - 3, r: Math.max(...xs) + 3, t: plantO.y + axeOffset(lg, -31, 0).y, b: floorY + 2 };
      const plan: Plan = { side, front, bite, floorY, plantO, angle: pp.angle, mirror: pp.mirror, scale, hand, handW, gripU, box, miss };
      if (!best || miss < best.miss - 3) best = plan;
    }
    return best!;
  };
  // an OPPOSING body counts with a wide margin (an axe biting right beside the enemy reads as the enemy's): its box
  // grows by 40 px sideways and 8 px down, so the axe keeps to the wielder's own side whenever it can
  const overlap = (pl: Plan): number => {
    const b = pl.box;
    const bodies = others.reduce((a, o) => {
      const m = o.foe ? 40 : 1;
      return a + Math.max(0, Math.min(b.r, o.r + m) - Math.max(b.l, o.l - m)) * Math.max(0, Math.min(b.b, o.b + (o.foe ? 8 : 0)) - Math.max(b.t, o.t + 4));
    }, 0);
    // its own card's tile under the bite: as bad as a body; a long reach (a big step out) a little worse than none
    return bodies + (onOwnTile(pl.bite) || onOwnTile(pl.plantO) ? 1e6 : 0) + Math.max(0, pl.miss - 10) * 8;
  };
  // the front first, then the back; then the same a little nearer / farther from the camera: the least covered wins
  const foes = others.filter((o) => o.foe).map((o) => ({ l: o.l, r: o.r, t: o.t, b: o.b }));
  let best: Plan | null = null;
  let bestA = Infinity;
  // dy 16: the front corner of its own tile, nearer the camera than any neighbour's feet (the crowded fallback)
  for (const dy of [5, 10, 0, 16, -4, 22])
    for (const side of [facing, -facing]) {
      const plan = build(side, home.y + dy);
      const a = overlap(plan);
      if (a < bestA) {
        bestA = a;
        best = plan;
      }
      if (a === 0) return { ...plan, foes };
    }
  // crowded: drawn in front of any neighbour it overlaps (it is the target's axe, never hidden behind another body)
  const b = best!.box;
  const cover = others.filter((o) => b.l < o.r + 1 && b.r > o.l - 1 && b.t < o.b && b.b > o.t + 4);
  return { ...best!, foes, depth: Math.max(s.depth, ...cover.map((o) => o.d)) + 1 };
}

// ---------------------------------------------------------------- badges out of the way of the axe

const HIDDEN_BADGES = new Set<MonsterUnit>();

/** Hide every visible ATK/DEF badge whose rectangle overlaps the planted axe (head, haft and grip). */
function hideBadgesOver(ctx: EquipCtx, plan: BitePlan): MonsterUnit[] {
  const lg: AxeOpts = { size: 'lg', angle: plan.angle, mirror: plan.mirror, scale: plan.scale };
  const pts = [axeOffset(lg, -31, 0), axeOffset(lg, 9, 11), axeOffset(lg, -2, 15), axeOffset(lg, 6, -10)].map((d) => ({ x: plan.plantO.x + d.x, y: plan.plantO.y + d.y }));
  const l = Math.min(...pts.map((q) => q.x)) - 4 - REACH_PX;
  const r = Math.max(...pts.map((q) => q.x)) + 4 + REACH_PX;
  const t = Math.min(...pts.map((q) => q.y)) - 4;
  const b = Math.max(plan.floorY, ...pts.map((q) => q.y)) + 4;
  const out: MonsterUnit[] = [];
  for (const p of ctx.state.players)
    for (const m of p.monsters) {
      if (!m) continue;
      const o = ctx.unit(m.uid);
      if (!o || o.retired || !o.badge.visible) continue;
      const bb = o.badge.image.getBounds();
      if (bb.right < l || bb.left > r || bb.bottom < t || bb.top > b) continue;
      o.badge.setVisible(false);
      HIDDEN_BADGES.add(o);
      out.push(o);
    }
  return out;
}

function restoreBadges(us: readonly MonsterUnit[]): void {
  for (const o of us) {
    if (!HIDDEN_BADGES.delete(o)) continue;
    if (!o.retired && !o.badge.visible) o.badge.setVisible(true);
  }
}

// ---------------------------------------------------------------- the vein (1-px fire ramp up the body's near edge)

/** The vein's path: from the grip up the body's near edge to the eye row, then along that row to the eye. */
function veinPath(s: Phaser.GameObjects.Sprite, grip: XY, side: number, eye: XY | null): XY[] {
  const sil = silhouetteOf(s);
  if (!sil) return [];
  const out: XY[] = [];
  const stopY = eye ? eye.y : sil.top + 3;
  let x = grip.x;
  const nearest = (y: number, around: number, reach: number): number | null => {
    let best: number | null = null;
    for (let d = 0; d <= reach; d++)
      for (const xx of [around + d, around - d]) {
        if (!sil.has(xx, y)) continue;
        // walk outward to the edge on the near side
        let ex = xx;
        while (sil.has(ex + side, y)) ex += side;
        if (best === null || Math.abs(ex - around) < Math.abs(best - around)) best = ex;
      }
    return best;
  };
  for (let y = grip.y; y >= stopY; y--) {
    const ex = nearest(y, x, out.length ? 4 : 10) ?? (out.length ? nearest(y, x, 12) : null);
    if (ex === null) {
      if (out.length) break;
      continue;
    }
    // fill the step so the line stays connected
    const nx = ex - side;
    if (out.length) {
      const last = out[out.length - 1];
      const st = Math.sign(nx - last.x);
      if (Math.abs(nx - last.x) <= 6) for (let xx = last.x + st; st !== 0 && xx !== nx; xx += st) if (sil.has(xx, last.y)) out.push({ x: xx, y: last.y });
    }
    out.push({ x: nx, y });
    x = nx + side;
  }
  if (eye && out.length) {
    // a short run in toward the eye along the brow (never across the face); the ignition carries the rest
    const last = out[out.length - 1];
    const st = Math.sign(eye.x - last.x);
    for (let xx = last.x + st, k = 0; st !== 0 && xx !== eye.x && k < 4; xx += st, k++) if (sil.has(xx, last.y - 1)) out.push({ x: xx, y: last.y - 1 });
  }
  return out;
}

const VEIN = [PAL.white, PAL.fire4, PAL.fire4, PAL.fire3, PAL.fire3, PAL.fire3, PAL.fire2, PAL.crim3] as const;

// ---------------------------------------------------------------- the scene

/**
 * Where the oath's "+800" stands: beside the body on its FRONT side when that is clear of every other body, else
 * over its shoulder (above the head, on the front half), never over its face or a neighbour's head.
 */
function oathNumberAt(ctx: EquipCtx, u: MonsterUnit): { x: number; y: number; rise: number } {
  const s = u.sprite;
  const sil = silhouetteOf(s);
  const front = u.player === 0 ? 1 : -1;
  const home = { x: R(u.home.x), y: R(u.home.y) };
  const midY = sil ? R(sil.top + (sil.bottom - sil.top) * 0.42) : R(home.y - 24);
  const edge = sil ? (front > 0 ? sil.right : sil.left) : home.x + front * 14;
  const boxes: { l: number; r: number; t: number; b: number }[] = [];
  for (const p of ctx.state.players)
    for (const m of p.monsters) {
      if (!m || m.uid === u.uid) continue;
      const o = ctx.unit(m.uid);
      const os = o && o.sprite.active && o.sprite.visible ? silhouetteOf(o.sprite) : null;
      if (os) boxes.push({ l: os.left, r: os.right, t: os.top, b: os.bottom });
    }
  // the number's box (5 glyphs ≈ 34 × 14 px round its centre, + the jump and the rise above it)
  const clear = (x: number, y: number): boolean => !boxes.some((b) => x + 19 > b.l && x - 19 < b.r && y + 8 > b.t && y - 20 < b.b) && x > 22 && x < 618;
  const side = { x: R(edge + front * 17), y: numberUnderBar(midY).y };
  if (clear(side.x, side.y)) return { ...side, rise: Math.min(8, numberUnderBar(midY).rise) };
  const top = sil ? sil.top : home.y - 50;
  const cx = sil ? R((sil.left + sil.right) / 2 + front * 6) : home.x;
  const over = numberUnderBar(top - 12);
  return { x: cx, y: over.y, rise: Math.min(6, over.rise) };
}

/**
 * Where the axe appears for its dive: high over the bite, a little out on its blade side — the first candidate whose
 * whole dive line keeps off the duelists' portraits and the HUD panels (P2's dive came down through its portrait):
 * then a diagonal in from the board side.
 */
function skyFor(ctx: EquipCtx, plantO: XY, side: number): XY {
  const boxes: { l: number; r: number; t: number; b: number }[] = [];
  for (const pl of [0, 1] as const) {
    try {
      const spr = ctx.views.duelists?.get(pl)?.sprite;
      if (spr && spr.active && spr.visible) {
        const bb = spr.getBounds();
        boxes.push({ l: bb.left - 6, r: bb.right + 6, t: bb.top - 6, b: bb.bottom + 4 });
      }
    } catch {
      /* no duelists */
    }
    const pr = panelRect(pl);
    boxes.push({ l: pr.x - 6, r: pr.x + pr.w + 6, t: pr.y - 6, b: pr.y + pr.h + 6 });
  }
  const cost = (sk: XY): number => {
    let n = 0;
    for (let i = 0; i <= 24; i++) {
      const x = lerp(sk.x, plantO.x, i / 24);
      const y = lerp(sk.y, plantO.y, i / 24);
      // the axe drawing is ~ 24 px round its head
      if (boxes.some((b) => x + 14 > b.l && x - 14 < b.r && y + 14 > b.t && y - 14 < b.b)) n++;
    }
    return n;
  };
  const cands: XY[] = [];
  for (const [dx, h] of [
    [side * 30, 160],
    [side * 30, 130],
    [side * 30, 104],
    [-side * 30, 130],
    [side * 70, 120],
    [-side * 70, 120],
    [side * 110, 100],
    [-side * 110, 100],
    [0, 90],
  ] as const)
    cands.push({ x: R(Math.max(16, Math.min(624, plantO.x + dx))), y: R(Math.max(-12, plantO.y - h)) });
  let best = cands[0];
  let bc = Infinity;
  for (const c of cands) {
    const k = cost(c);
    if (k === 0) return c;
    if (k < bc) {
      bc = k;
      best = c;
    }
  }
  return best;
}

async function axeScene(ctx: EquipCtx, u: MonsterUnit, ci: number): Promise<void> {
  const ev = ctx.ev;
  const sc = ctx.scene;
  const s = u.sprite;
  const rnd = fxRng(ev.spellUid * 31 + 5);
  const home = { x: R(u.home.x), y: R(u.home.y) };
  const plan = planBite(ctx, u);
  const side = plan.side;
  const bite = plan.bite;
  const plantO = plan.plantO;
  const lgPlant: AxeOpts = { size: 'lg', angle: plan.angle, mirror: plan.mirror, heat: 2, scale: plan.scale };
  const st = evAt(ctx, ci, 'statChange');
  const tile = ctx.views.field.tileAt(ev.player, 'spellTrap', ev.spellZone);
  const from: XY = (ctx.hints.from as XY | undefined) ?? (tile ? { x: tile.home.x, y: tile.home.y } : zoneXY(ev.player, 'spellTrap', ev.spellZone));
  const depthAxe = plan.depth ?? s.depth + 1;
  const sparks = new PxSparks(sc, DEPTH.FX + 3);
  const fxr = new Raster(sc, 0, 0, 640, 360, DEPTH.FX + 2);
  const chainR = new Raster(sc, 0, 0, 640, 360, depthAxe - 0.2);
  const veinR = new Raster(sc, 0, 0, 640, 360, s.depth + 0.6);
  const flung = new FlungLinks(sc, DEPTH.FX + 2.5);
  const bag = new PixBag();
  const rest = { x: R(s.x), y: R(s.y) };
  const alive = (): boolean => !u.retired && s.active;
  // the ATK/DEF badges that would cover the haft and the grip (the wielder's own, a crowded neighbour's) step aside
  // for the beat and come back before the +800 rolls (restored in axeScene's caller's finally too)
  const hidden = hideBadgesOver(ctx, plan);
  // ---- OMEN: the card's ember spark leaves for the sky over the bite point; a target cross on the floor
  playV3('e_axeOmen', { volume: 0.9, pan: panAt(bite.x) });
  if (tile && tile.active) bg(tile.pulse(PAL.fire3, 200));
  void lightFlash(sc, from.x, from.y, PAL.fire3, 12, 110, { floorY: from.y, intensity: 0.5 });
  // it drops from high over its blade side, a steep line, head first
  const sky = skyFor(ctx, plantO, side);
  const sparkTop: XY = { x: sky.x, y: Math.max(8, sky.y + 10) };
  await run(sc, T.omenMs, (t) => {
    const k = E.outCubic(t);
    fxr.begin();
    for (let i = 0; i < 6; i++) {
      const kk = Math.max(0, k - i * 0.035);
      const x = lerp(from.x, sparkTop.x, kk);
      const y = lerp(from.y - 6, sparkTop.y, kk) - Math.sin(kk * Math.PI) * 18;
      fxr.px(x, y, i === 0 ? PAL.white : i < 3 ? PAL.fire4 : PAL.fire3);
    }
    if (Math.floor(t * 6) % 2 === 0) {
      for (let i = -4; i <= 4; i++) fxr.px(bite.x + i, bite.y, Math.abs(i) <= 1 ? PAL.fire4 : PAL.fire2);
      for (let i = -2; i <= 2; i++) fxr.px(bite.x + i * 2, bite.y + i, i === 0 ? PAL.fire4 : PAL.fire2);
    }
    fxr.end();
  });
  fxr.begin();
  fxr.end();

  // ---- the AXE appears high above (one white-hot frame), tumbles half a turn…
  const startA = plan.angle + 180;
  const axe = new AxeSprite(sc, { ...lgPlant, angle: startA, heat: 4 }, sky.x, sky.y, depthAxe);
  sparks.add({ x: sky.x, y: Math.max(6, sky.y), life: 160, colors: [PAL.white, PAL.fire4, PAL.fire3], shape: 'star', fadeAt: 1 });
  await frames(sc, 1);
  await run(sc, T.tumbleMs, (t) => {
    const a = startA + turn(startA, plan.angle + 360) * quant(E.outQuad(t), 4);
    axe.set({ angle: a, heat: 2 }).at(sky.x, sky.y - R(Math.sin(t * Math.PI) * 4));
  });
  axe.set({ angle: plan.angle });

  // ---- …and DIVES head-first, its chains streaming behind
  playV3('e_axeFall', { volume: 0.55, pan: panAt(bite.x) });
  // whole quarter-step intensities, set at once (a ramp would fade through the light layer's ordered dither)
  const light = lightPool(sc, sky.x, sky.y, { color: PAL.fire4, radius: 11, floorY: bite.y, air: 0.5, airRadius: 12, intensity: 0, fadeIn: 0 });
  const fdx = plantO.x - sky.x;
  const fdy = plantO.y - sky.y;
  const fl = Math.hypot(fdx, fdy) || 1;
  let prev = { ...sky };
  await run(sc, T.diveMs, (t, el, dt) => {
    const k = E.inQuad(t);
    const x = lerp(sky.x, plantO.x, k);
    const y = lerp(sky.y, plantO.y - 4, k);
    axe.at(x, y);
    light.setPosition(x, y + 10, bite.y);
    // the floor lights up only as the head closes on it (a pool far under a high axe read as a dithered stain)
    if (t > 0.72) light.setIntensity(0.5, 0);
    chainR.begin();
    bag.clear();
    for (const [w, off, ph] of [
      [-14, -2, 0],
      [-24, 2, 2],
    ] as const) {
      const a0 = axe.pt(w, 0);
      const tail = { x: a0.x - (fdx / fl) * 24 + off, y: a0.y - (fdy / fl) * 24 };
      chainLinks(bag, chainPts(a0, tail, 3, el / 40 + ph, 8));
    }
    bag.flush(chainR);
    if (dt > 0) for (let i = 1; i <= 8; i++) chainR.px(R(lerp(prev.x, x, i / 8)), R(lerp(prev.y, y, i / 8)) + 4, i > 5 ? PAL.fire4 : PAL.fire2);
    chainR.end();
    if (dt > 0 && rnd() < 0.7) sparks.add({ x: x + (rnd() - 0.5) * 8, y: y + rnd() * 8, vx: (rnd() - 0.5) * 20, vy: -20 - rnd() * 30, life: 220 + rnd() * 160, colors: EMBER_DOWN, shape: 'px', fadeAt: 1 });
    prev = { x, y };
  });

  // ---- THE BITE: one white silhouette frame, then the real axe white-cracked through the hit-stop
  axe.at(plantO.x, plantO.y).bury(bite.y);
  axe.set({ look: 'hot' });
  playV3('e_axeBite', { volume: 1, pan: panAt(bite.x) });
  const cracks = floorCracks(sc, bite, ev.spellUid, side);
  cracks.glow(4);
  // the planted axe carries no floor pool (its stepped dither read as a dark stain beside the bite): its light is the
  // cracks, the flashes and the embers; the pool comes back for the pull through the air
  light.setPosition(bite.x, bite.y - 8, bite.y);
  light.setIntensity(0, 0);
  void shake(sc, 170, 3);
  // the floor flash: one frame of a hot floor ellipse round the bite
  const floorFlash = Raster.around(sc, bite.x, bite.y, 80, 40, DEPTH.TILE_FX + 2);
  floorFlash.begin();
  for (let a = 0; a < 96; a++) {
    for (const [r, c] of [
      [22, PAL.fire2],
      [15, PAL.fire3],
      [8, PAL.fire4],
    ] as const) {
      if (a % (r > 20 ? 2 : 1)) continue;
      floorFlash.px(R(bite.x + Math.cos((a / 96) * Math.PI * 2) * r), R(bite.y + Math.sin((a / 96) * Math.PI * 2) * r * 0.5), c);
    }
  }
  floorFlash.end();
  const nBurst = fxCount(26);
  for (let i = 0; i < nBurst; i++) {
    const a = Math.PI + (i / nBurst) * Math.PI + (rnd() - 0.5) * 0.3;
    const v = 50 + rnd() * 120;
    const dirt = i % 3 === 0;
    sparks.add({ x: bite.x + (rnd() - 0.5) * 6, y: bite.y - 1, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.9, ay: 380, drag: 1.2, life: 280 + rnd() * 320, colors: dirt ? [PAL.stone2, PAL.stone1, PAL.stone0] : EMBER, shape: dirt ? 'sq' : i % 4 === 1 ? 'plus' : 'px', floor: bite.y + 6 + rnd() * 8, bounce: 0.3, fadeAt: 1 });
  }
  chainR.begin();
  chainR.end();
  bg(run(sc, 120, (t) => cracks.grow(quant(t, 3))));
  await frames(sc, 1);
  floorFlash.destroy();
  const biteRing = Raster.around(sc, bite.x, bite.y, 72, 36, DEPTH.TILE_FX + 2);
  bg(dirtRing(sc, biteRing, bite, 7, 4).then(() => biteRing.destroy()));
  axe.set({ look: 'plain', heat: 4 }).bury(bite.y);
  await freeze(sc, T.stop);
  axe.set({ heat: 3 });
  for (let f = 0; f < T.quiverFrames; f++) {
    const amp = f < 2 ? 2 : f < 4 ? 1 : f % 2;
    axe.at(plantO.x + (f % 2 === 0 ? amp : -amp), plantO.y).bury(bite.y);
    await frames(sc, 1);
  }
  axe.at(plantO.x, plantO.y).bury(bite.y).set({ heat: 2 });
  cracks.glow(3);

  // ---- the chains fall slack and coil round two iron pegs on the far side of the axe
  playV3('e_axeChain', { volume: 0.6, pan: panAt(bite.x) });
  // the pegs on the far side of the axe; when that ground runs under an OPPOSING body, they fold in toward the
  // wielder's own tile instead (in front of the axe, nearer the camera) so the chains never cross the enemy's feet
  const pegsFar: XY[] = [
    { x: bite.x + side * 22, y: bite.y - 3 },
    { x: bite.x + side * 12, y: bite.y + 8 },
  ];
  const nearFoe = (pts: readonly XY[]): boolean =>
    (plan.foes ?? []).some((o) => pts.some((q) => q.x >= o.l - 6 && q.x <= o.r + 6 && q.y >= o.t - 4 && q.y <= o.b + 10) || (Math.min(...pts.map((q) => q.x)) <= o.r + 4 && Math.max(...pts.map((q) => q.x)) >= o.l - 4 && Math.abs(o.b - bite.y) < 16));
  const pegs: XY[] = nearFoe(pegsFar)
    ? [
        { x: bite.x + side * 6, y: bite.y + 12 },
        { x: bite.x - side * 6, y: bite.y + 10 },
      ]
    : pegsFar;
  const wraps = [-14, -24];
  /** taut 0 slack … 1 straight; wob = the vibration amplitude (px). */
  const drawChains = (k: number, taut: number, el: number, wob: number, broken = false): void => {
    chainR.begin();
    bag.clear();
    pegs.forEach((peg, ci2) => {
      const a0 = axe.pt(wraps[ci2], ci2 === 0 ? 1 : -1);
      // the peg: an iron spike in the floor
      bag.set(peg.x, peg.y, PAL.stone3);
      bag.set(peg.x, peg.y - 1, PAL.stone4);
      bag.set(peg.x, peg.y - 2, PAL.stone3);
      bag.set(peg.x - 1, peg.y - 2, PAL.stone2);
      bag.set(peg.x + 1, peg.y - 2, PAL.stone2);
      if (broken) {
        // the stubs: three links lying at the peg
        chainLinks(bag, [peg, { x: peg.x - side * 8, y: peg.y + 1 }]);
        return;
      }
      if (taut > 0) {
        const n0 = Math.hypot(peg.x - a0.x, peg.y - a0.y) / 3.5;
        chainLinks(bag, [a0, peg], { wob: (i) => (wob > 0 ? R(Math.sin((i / n0) * Math.PI) * wob * ((Math.floor(el / 30) + i + ci2) % 2 ? 1 : -1)) : 0), heat: (i) => (taut > 0.8 && i < 2 ? 1 : 0) });
      } else {
        const sag = { x: lerp(a0.x, peg.x, 0.5), y: lerp(a0.y - 16, Math.max(a0.y, peg.y) + 4, k) };
        const pts: XY[] = [];
        for (let i = 0; i <= 8; i++) pts.push(qbez(a0, sag, peg, i / 8));
        for (let i = 0; i < 4 * k; i++) pts.push({ x: peg.x + (i % 2 ? 3 : -3), y: peg.y + 2 + (i % 2) });
        chainLinks(bag, pts);
      }
    });
    bag.flush(chainR);
    chainR.end();
  };
  bg(run(sc, 160, (t) => drawChains(quant(E.outCubic(t), 4), 0, 0, 0)));

  // ---- VEIN PULSES (the haft beats) while the wielder turns to it
  const pulse = (i: number): Promise<void> => {
    playV3('e_axePulse', { volume: 0.75 + i * 0.1, pitch: 1 + i * 0.04, pan: panAt(bite.x) });
    cracks.glow(4);
    void lightFlash(sc, bite.x, bite.y - 8, PAL.fire3, 12 + i * 3, 120, { floorY: bite.y, intensity: 0.5 });
    const ring = Raster.around(sc, bite.x, bite.y, 60, 32, DEPTH.TILE_FX + 2);
    return run(sc, 200, (t) => {
      const st2 = Math.floor(t * 4);
      axe.set({ pulse: Math.min(3, st2), heat: st2 < 2 ? 3 : 2 });
      ring.begin();
      const r = 6 + st2 * 4 + i * 2;
      for (let a = 0; a < 48; a++) {
        if (a % 3 === 0) continue;
        ring.px(R(bite.x + Math.cos((a / 48) * Math.PI * 2) * r), R(bite.y + Math.sin((a / 48) * Math.PI * 2) * r * 0.5), [PAL.fire3, PAL.crim3, PAL.crim2, PAL.crim1][st2] ?? PAL.crim1);
      }
      ring.end();
    }).then(() => {
      ring.destroy();
      axe.set({ pulse: -1, heat: 2 });
      cracks.glow(3);
    });
  };
  await wait(sc, 30);
  bg(pulse(0));
  await wait(sc, T.pulseEvery);

  // ---- THE REACH: it CROUCHES and LEANS to the axe (a crisp pixel double: rows fold at the knee, the upper body
  // shears toward the haft) and steps in, until its hand lies on the haft — the contact frame
  const dbl = new BodyDouble(sc, u, rest);
  const pl = { ox: 0, oy: 0, crouch: 0, lean: 0 };
  /** The hand (world) under body params q. */
  const handAt = (q: typeof pl): XY => dbl.map(plan.hand.x, plan.hand.y, q);
  /** Put the body so its hand lies on world x `x` (crouch / lean given): returns the offset used. */
  const bodyTo = (x: number | null, crouch: number, lean: number, oy = 0): void => {
    if (!alive()) return;
    const q = { ox: 0, oy, crouch, lean };
    if (x !== null) q.ox = x - handAt(q).x;
    else q.ox = pl.ox;
    Object.assign(pl, q);
    if (dbl.ok) dbl.set(pl.ox, pl.oy, pl.crouch, pl.lean);
    else s.setPosition(rest.x + pl.ox, rest.y + pl.oy);
  };
  // the haft's station under the hand for the axe as it stands now (origin O, angle a)
  let gripU = plan.gripU;
  const axeO = (): AxeOpts => ({ size: 'lg', angle: axe.o.angle, mirror: axe.o.mirror, scale: plan.scale });
  const station = (uu: number): XY => axe.pt(uu, 0);
  const handLean = (k: number): number => side * k; // + toward the haft
  // the hand's rest x and the haft's x at its row: the gap the reach closes (2 → 4 → all of it)
  const gap0 = station(gripU).x - handAt(pl).x;
  for (const [f, crouch, lean] of [
    [0.3, 1, 1],
    [0.65, 2, 2],
  ] as const) {
    const lq = { ox: 0, oy: 0, crouch, lean: handLean(lean) };
    bodyTo(handAt(lq).x + R(gap0 * f), crouch, handLean(lean));
    await wait(sc, T.reachStep);
  }
  // the contact: the hand ON the haft (its station re-read at the crouched hand's height)
  const cq = { ox: 0, oy: 0, crouch: 2, lean: handLean(3) };
  gripU = stationAt(axeO(), { x: axe.img.x, y: axe.img.y }, handAt(cq).y);
  bodyTo(station(gripU).x, 2, handLean(3));
  await wait(sc, T.reachStep);
  // the FINGERS: the hand's own tones wrapped over the haft at the grip (in front of the axe): the hold reads
  const tones = handTones(u, plan.hand);
  const fist = new Raster(sc, 0, 0, 640, 360, depthAxe + 0.3);
  let fistOn = true;
  const drawFist = (hot = false): void => {
    fist.begin();
    if (fistOn && alive()) {
      const g = station(gripU);
      const dir = axeOffset(axeO(), -10, 0);
      const vert = Math.abs(dir.y) >= Math.abs(dir.x);
      // knuckles across the haft: 3 × 3 (fill, fill, shade), an ink rim round them
      for (let i = -2; i <= 2; i++)
        for (let j = -2; j <= 2; j++) {
          const [x, y] = vert ? [g.x + i, g.y + j] : [g.x + j, g.y + i];
          const rim = Math.abs(i) === 2 || Math.abs(j) === 2;
          if (rim && Math.abs(i) === 2 && Math.abs(j) === 2) continue;
          fist.px(x, y, rim ? PAL.ink : hot && i === 0 && j === -1 ? PAL.fire3 : j === 1 ? tones.shade : tones.fill);
        }
    }
    fist.end();
  };
  drawFist();
  // ---- THE GRIP (contact frame): an ember spark at the hand, the vein starts up the arm
  playV3('e_axeGrip', { volume: 0.95, pan: panAt(station(gripU).x) });
  bg(pulse(1));
  sparks.add({ x: station(gripU).x, y: station(gripU).y, life: 110, colors: [PAL.white, PAL.fire4, PAL.fire3], shape: 'star', fadeAt: 1 });
  let veinK = 0;
  let veinHot = 0;
  let veinOn = true;
  const drawVein = (): void => {
    veinR.begin();
    if (veinOn && alive()) {
      // the path on the UNDEFORMED body at the current offset (the sprite stands there), then onto the double
      const flat = { ...pl, crouch: 0, lean: 0 };
      const h = dbl.map(plan.hand.x, plan.hand.y, flat);
      const eyes = eyesOf(s);
      const raw = veinPath(s, { x: h.x - side, y: h.y }, side, eyes.length ? eyes[0] : null);
      const path = dbl.ok ? raw.map((q) => dbl.warp(q)) : raw;
      const n = Math.min(path.length, Math.ceil(path.length * veinK));
      for (let i = 0; i < n; i++) {
        const back = n - 1 - i;
        // growing: a hot head and a fire trail; grown: it beats (a fire4 pulse runs up it every ~9 px)
        const beat = (i + Math.floor(sc.time.now / 45)) % 9;
        const c = veinHot > 0 ? (back < 2 ? PAL.white : PAL.fire4) : veinK >= 1 ? (beat < 2 ? PAL.fire4 : PAL.fire3) : VEIN[Math.min(VEIN.length - 1, back)];
        veinR.px(path[i].x, path[i].y, c);
        // a second pixel of burn just inside it (the vein is 1 px; its glow is the body's own edge warming)
        if (veinK >= 1 && beat < 2) veinR.px(path[i].x - side, path[i].y, PAL.fire2);
      }
    }
    veinR.end();
  };
  const veinStop = onFrame(sc, () => {
    drawVein();
    drawFist();
    return veinOn;
  });
  await run(sc, T.veinMs, (t) => {
    veinK = quant(t, 8);
    // the hand holds: the upper body squeezes a pixel lower on every other step (the knuckles stay on the haft)
    const sq = Math.floor(t * 8) % 2 === 1 ? 3 : 2;
    bodyTo(station(gripU).x, sq, handLean(3));
  });
  veinK = 1;
  bodyTo(station(gripU).x, 2, handLean(3));

  // ---- THE WRENCH: three ESCALATING tugs. The body leans back AWAY from the bite (the shear reverses), the haft
  // TILTS toward it a 15° drawing a tug and lifts 1 → 3 → 5 px out of the bite; the hand never leaves the haft: the
  // body is placed so the hand lies on the haft's station at the hand's own height (the hand slides up the haft as it
  // tilts) — the axe leads, the body follows its pull
  playV3('e_axeWrench', { volume: 1, pan: panAt(bite.x) });
  const tugs = [
    { tilt: 1, lift: 1, lean: -2, crouch: 1 },
    { tilt: 1, lift: 3, lean: -4, crouch: 1 },
    { tilt: 2, lift: 5, lean: -5, crouch: 0 },
  ];
  /** The axe at a tilt / lift (+ a sideways jitter), the body hung on its station. */
  const hang = (tilt: number, up: number, jx: number, lean: number, crouch: number, heat: number, pulseK: number): void => {
    axe.set({ angle: plan.angle - side * 15 * tilt, heat, pulse: pulseK }).at(plantO.x + jx, plantO.y - up).bury(bite.y);
    const q = { ox: pl.ox, oy: 0, crouch, lean: handLean(lean) };
    gripU = stationAt(axeO(), { x: axe.img.x, y: axe.img.y }, handAt(q).y);
    bodyTo(station(gripU).x, crouch, handLean(lean));
  };
  const tugRing = Raster.around(sc, bite.x, bite.y, 72, 36, DEPTH.TILE_FX + 2);
  for (let i = 0; i < tugs.length; i++) {
    const tg = tugs[i];
    // the YANK lands: the crack glow steps up a band, an ember light pulse, a dirt + ember puff out of the bite
    cracks.glow(Math.min(4, 2 + i));
    cracks.grow(1);
    void lightFlash(sc, bite.x, bite.y - 6, i === 2 ? PAL.fire4 : PAL.fire3, 12 + i * 5, 90, { intensity: 0.45 + i * 0.2 });
    void shake(sc, 50 + i * 20, 1 + (i === 2 ? 1 : 0));
    for (let k = 0; k < fxCount(5 + i * 4); k++) {
      const an = Math.PI + 0.25 + rnd() * (Math.PI - 0.5);
      const v = 30 + i * 22 + rnd() * 40;
      const clod = k % 2 === 0;
      sparks.add({ x: bite.x + (rnd() - 0.5) * 6, y: bite.y - 1, vx: Math.cos(an) * v, vy: Math.sin(an) * v * 0.9, ay: 420, life: 240 + rnd() * 160, colors: clod ? [PAL.earth2, PAL.earth1, PAL.earth0] : EMBER_DOWN, shape: clod ? 'sq' : 'px', size: clod ? 2 : 1, floor: bite.y + 2 + R(rnd() * 6), bounce: 0.2, fadeAt: 1 });
    }
    bg(dirtRing(sc, tugRing, bite, 6 + i * 3, 3 + i));
    await run(sc, T.tugMs, (t, el, dt) => {
      // YANK (the first frames: the full lean, the haft at its lift +1 overshoot), STRAIN (held, trembling), GIVE (a
      // pixel back) — every tug further than the last
      const ph = t < 0.18 ? 0 : t < 0.7 ? 1 : 2;
      const f = Math.floor(el / 34);
      const amp = i === 2 ? 2 : 1;
      const up = ph === 0 ? tg.lift + 1 : ph === 2 ? tg.lift - 1 : tg.lift;
      const jx = ph === 1 ? (f % 2 === 0 ? amp : -amp) * (f % 3 === 2 ? 0 : 1) : 0;
      const lean = ph === 2 ? tg.lean + 1 : tg.lean - (i === 2 && ph === 1 && f % 2 === 0 ? 1 : 0);
      hang(tg.tilt, up, jx, lean, ph === 0 ? tg.crouch + 1 : tg.crouch, ph === 0 ? 4 : t > 0.5 ? 3 : 2, f % 4);
      drawChains(1, 1, el + i * 200, i === 2 ? 1 + (f % 2) : ph === 1 ? 1 : 0);
      if (dt > 0 && rnd() < 0.3 + i * 0.2) sparks.add({ x: bite.x + (rnd() - 0.5) * 10, y: bite.y, vx: (rnd() - 0.5) * 30, vy: -30 - rnd() * 40, ay: 200, life: 240, colors: rnd() < 0.5 ? EMBER_DOWN : [PAL.earth2, PAL.earth1], shape: rnd() < 0.3 ? 'sq' : 'px', fadeAt: 1 });
    });
  }
  // a 40 ms catch just before the snap: everything holds at full strain
  hang(2, 5, 0, -6, 1, 3, -1);
  cracks.glow(4);
  await freeze(sc, 40);
  bg(wait(sc, 400).then(() => tugRing.destroy()));

  // ---- SNAP: the chains break (links flung, spinning); the axe TEARS OUT (dirt clods, the slit); the wielder jerks
  // back with it — the hand never lets go
  playV3('e_axeSnap', { volume: 0.85, pan: panAt(bite.x) });
  pegs.forEach((peg, ci2) => {
    const a0 = axe.pt(wraps[ci2], 0);
    const mid = { x: R((a0.x + peg.x) / 2), y: R((a0.y + peg.y) / 2) };
    sparks.add({ x: mid.x, y: mid.y, life: 110, colors: [PAL.white, PAL.fire4], shape: 'star', fadeAt: 1 });
    for (let i = 0; i < 3; i++)
      flung.add({ x: mid.x + (rnd() - 0.5) * 4, y: mid.y, vx: side * (40 + rnd() * 80), vy: -70 - rnd() * 70, floor: bite.y + 4 + R(rnd() * 8), spin: 0.8 + rnd() * 0.8, life: 600 + rnd() * 250 });
  });
  drawChains(1, 1, 0, 0, true);
  // dirt clods (2-px squares, earth and stone) and embers out of the hole
  for (let i = 0; i < fxCount(16); i++) {
    const a = Math.PI + 0.2 + rnd() * (Math.PI - 0.4);
    const v = 50 + rnd() * 90;
    const clod = i % 2 === 0;
    sparks.add({ x: bite.x + (rnd() - 0.5) * 8, y: bite.y - 1, vx: Math.cos(a) * v, vy: Math.sin(a) * v, ay: 460, drag: 0.8, life: 320 + rnd() * 260, colors: clod ? [PAL.earth2, PAL.earth1, PAL.earth0] : EMBER, shape: clod ? 'sq' : 'px', size: clod ? 2 : 1, floor: bite.y + 3 + rnd() * 8, bounce: 0.25, fadeAt: 1 });
  }
  cracks.slit(true);
  void shake(sc, 120, 2);
  // the body jerks back a further 3 px, leaning hard away; the axe comes out with the hand (hung on it, white-hot)
  const ripA = plan.angle - side * 15 * 3;
  const jerk = { ox: pl.ox - side * 3, oy: 0, crouch: 0, lean: handLean(-6) };
  bodyTo(handAt(jerk).x, 0, handLean(-6));
  /** The axe hung on the hand by its station (rotating round the hand). */
  let heaveScale: number = plan.scale;
  const hangOnHand = (angle: number, mirror: boolean, heat: number, size: AxeSize = 'lg'): void => {
    const o: AxeOpts = { size, angle, mirror, scale: size === 'lg' ? heaveScale : undefined };
    const h = handAt(pl);
    const d = axeOffset(o, gripU, 0);
    axe.set({ angle, mirror, heat, scale: o.scale, size }).at(h.x - d.x, h.y - d.y).bury(null);
  };
  hangOnHand(ripA, plan.mirror, 4);
  await freeze(sc, T.snapStop);
  bg(cracks.cool(520).then(() => cracks.destroy()));

  // ---- THE HEAVE: the axe swings UP round the hand (its station locked in the fist, 15° drawings) over the
  // shoulder, the body rising out of its lean; then the hand slings it onto the back (two hot frames, the small axe)
  const hp = holdPose(u.player);
  const a0 = ripA;
  // the turn that never swings the head down through the floor (90°) — the shorter one when both or neither do
  const cw = (((hp.angle - a0) % 360) + 360) % 360;
  const ccw = cw - 360;
  const through = (d: number, at: number): boolean => {
    for (let k = 15; k < Math.abs(d); k += 15) if (axeAngle(a0 + Math.sign(d) * k) === at) return true;
    return false;
  };
  const dA = through(cw, 90) && !through(ccw, 90) ? ccw : through(ccw, 90) && !through(cw, 90) ? cw : Math.abs(cw) <= Math.abs(ccw) ? cw : ccw;
  const nSteps = Math.max(1, Math.round(Math.abs(dA) / 15));
  const heaveLean = [-6, -5, -3, -1, 0, 1, 1];
  const gu0 = gripU;
  await run(sc, T.pullMs + 80, (t, _el, dt) => {
    const k = E.inOutSine(t);
    const st2 = Math.floor(k * nSteps);
    const a = a0 + Math.sign(dA) * 15 * st2;
    const li = Math.min(heaveLean.length - 1, Math.floor(t * heaveLean.length));
    // the body comes back under the swing: offset toward rest, the lean through upright into a pixel of follow-through
    pl.ox = R(jerk.ox * (1 - quant(t, 4)));
    bodyTo(null, t < 0.3 ? 1 : 0, handLean(heaveLean[li]));
    // the hand CHOKES UP the haft as it heaves (its station slides toward the head): a tight swing round the fist,
    // never a wide arc across the neighbours
    gripU = lerp(gu0, -13, quant(t, 4));
    // a long haft (a tall wielder's) shortens back to the plain drawing as it comes up (0.1 steps)
    heaveScale = Math.round((plan.scale + (1 - plan.scale) * quant(t, 3)) * 10) / 10;
    hangOnHand(a, t < 0.5 ? plan.mirror : hp.mirror, t < 0.15 ? 3 : 2);
    axe.img.setDepth(depthAxe);
    // the torn chain ends trail from the haft
    chainR.begin();
    bag.clear();
    const w = axe.pt(-20, 0);
    chainLinks(bag, [w, { x: w.x - side * 3, y: w.y + 9 }]);
    bag.flush(chainR);
    chainR.end();
    const hd = axe.pt(-2, 6);
    light.setPosition(hd.x, hd.y + 6, u.home.y);
    light.setIntensity(0.5, 0);
    if (dt > 0 && rnd() < 0.8) sparks.add({ x: hd.x, y: hd.y + 4, vx: (rnd() - 0.5) * 20, vy: 10, ay: 120, life: 220, colors: EMBER_DOWN, shape: 'px', fadeAt: 1 });
  });
  chainR.begin();
  chainR.end();
  // the sling: the fist lets go over the shoulder, the axe settles onto the back (two hot frames, small drawing)
  fistOn = false;
  drawFist();
  bodyTo(null, 0, 0);
  dbl.destroy();
  if (alive()) s.setPosition(rest.x, rest.y);
  const hold = holdAt(u);
  const hh = handAt({ ox: 0, oy: 0, crouch: 0, lean: 0 });
  axe.set({ size: 'sm', angle: hp.angle, mirror: hp.mirror, heat: 4, scale: undefined }).at(R((hold.x + hh.x) / 2), R((hold.y + hh.y) / 2) - 3);
  axe.img.setDepth(s.depth - 0.4);
  await frames(sc, 1);
  axe.at(hold.x, hold.y);
  await frames(sc, 1);
  axe.destroy();
  fist.destroy();
  bg((async () => {
    light.setIntensity(0.25, 0);
    await wait(sc, 120);
    light.destroy();
  })());

  restoreBadges(hidden);
  // ---- THE OATH: the vein flares to the head, the eyes ignite, then (beside the body) +800
  playV3('e_axeIgnite', { volume: 1, pan: panAt(home.x) });
  let oathNum: AxeNumber | null = null;
  veinHot = 1;
  if (alive()) {
    const aura = new AxeAura(sc, u, ev.spellUid, { eyeLvl: 3 });
    u.setAura('equip', aura);
    const eyes = aura.eyes();
    const back = u.player === 0 ? -1 : 1;
    // the IGNITION leads (≈ 290 ms scene, ≈ 390 ms game): one white frame (a 2-px core and a 4-px flare each side on
    // an ink backing), then the ember core holds while the flare shrinks 4 → 3 → 2 → 1 and cools fire4 → fire3 → fire2
    if (eyes.length) {
      const e0 = eyes[0];
      const star = Raster.around(sc, e0.x, e0.y, 32, 16, s.depth + 0.7);
      const FL = [4, 4, 4, 3, 3, 2, 2, 1, 1, 0];
      bg(
        run(sc, 290, (t, el) => {
          const white = el < 34;
          const i = Math.min(FL.length - 1, Math.floor(t * FL.length));
          const fl = FL[i];
          const fc = white ? PAL.white : i < 3 ? PAL.fire4 : i < 6 ? PAL.fire3 : PAL.fire2;
          star.begin();
          // the dark backing first (one ink row over and under the flare), so the ember reads on any body colour
          for (let d = -fl - 1; d <= fl + 1; d++) {
            star.px(e0.x + d, e0.y - 1, PAL.ink);
            star.px(e0.x + d, e0.y + 1, PAL.ink);
          }
          for (let d = 1; d <= fl; d++) {
            const c = d >= fl - 1 && !white ? (fc === PAL.fire4 ? PAL.fire3 : PAL.fire2) : fc;
            star.px(e0.x + d, e0.y, c);
            star.px(e0.x - d, e0.y, c);
          }
          // the 2-px core (on every eye pixel, and one beside the first toward the back)
          for (const e of eyes) star.px(e.x, e.y, white ? PAL.white : PAL.fire4);
          star.px(e0.x + back, e0.y, white ? PAL.white : PAL.fire4);
          if (!white && i < 4) star.px(e0.x, e0.y, PAL.white);
          star.end();
        }).then(() => star.destroy()),
      );
    }
    bg(wait(sc, 290).then(() => (aura.eyeLvl = 2)));
    // the body's ember edge follows the eyes (soft, late): the eyes lead
    bg(wait(sc, 150).then(() => (alive() ? rimFlash(sc, s, { ramp: [PAL.fire3, PAL.fire2, PAL.fire2, PAL.crim2], hold: 1 }) : undefined)));
    void lightFlash(sc, home.x, home.y - 20, PAL.fire3, 16, 320, { floorY: home.y, intensity: 0.45 });
    if (st) {
      await wait(sc, 290);
      const delta = Math.abs(st.atk - st.prevAtk);
      if (delta > 0 && alive()) {
        const at = oathNumberAt(ctx, u);
        oathNum = axeNumber(sc, at.x, at.y, delta, { kind: st.atk >= st.prevAtk ? 'heal' : 'damage', life: 560, fadeMs: 140, rise: at.rise, pop: 1 });
      }
      void u.setStats(st.atk, st.def, true);
    }
  } else if (st) void u.setStats(st.atk, st.def, false);
  if (ci >= 0) ctx.consumeAt(ci);
  // the vein cools down the ramp and goes out
  bg(
    (async () => {
      await wait(sc, 90);
      veinHot = 0;
      await wait(sc, 260);
      veinOn = false;
      veinStop();
      veinR.destroy();
    })(),
  );
  bg(
    wait(sc, 900).then(() => {
      fxr.destroy();
      chainR.destroy();
      flung.destroy();
      sparks.release();
    }),
  );
  await wait(sc, T.tail);
  // the +800 reads and fades out inside the scene: the input never returns under it
  if (oathNum) await (oathNum as AxeNumber).done;
}

// ================================================================ the aura on staged / restored boards

/** Every spite_axe on the field wears its own aura (replaces the generic equip sword a board sync gave it). */
function ensureAuras(ctx: AnyCtx): void {
  const s = ctx.state;
  for (const p of s.players)
    for (const stc of p.spellTraps) {
      if (!stc || stc.equippedTo === null || stc.equippedTo === undefined) continue;
      if (s.cards[stc.uid]?.cardId !== ID) continue;
      const u = ctx.unit(stc.equippedTo);
      if (!u || u.retired || !u.sprite.active || forging.has(u.uid)) continue;
      if (u.aura('equip') instanceof AxeAura) continue;
      u.setAura('equip', new AxeAura(ctx.scene, u, stc.uid));
    }
}

/**
 * The axe's card is OURS to break, whoever breaks it: another card's scene that releases its tile (Yıldırım Hükmü's
 * equip break, a battle's rule destroy, the default destroy) gets nothing back — the tile crumbles to embers right
 * then (crumbleTile, e_axeCard), never the generic teal / white card break. Our own releases bypass it.
 */
let ownRelease = 0;
const PATCHED = new WeakSet<object>();
let lastCtx: AnyCtx | null = null;
type ReleaseFn = (uid: Uid) => { tile: TileCard | null; unit: MonsterUnit | null };
function claimTiles(ctx: AnyCtx): void {
  lastCtx = ctx;
  const field = ctx.views.field as unknown as { release: ReleaseFn };
  if (PATCHED.has(field)) return;
  PATCHED.add(field);
  const orig: ReleaseFn = field.release.bind(field);
  field.release = (uid: Uid) => {
    const r = orig(uid);
    const c = lastCtx;
    if (ownRelease > 0 || !LOOK_V3 || !c || !r.tile || !r.tile.active) return r;
    if ((r.tile.cardId ?? c.state.cards[uid]?.cardId) !== ID) return r;
    const tile = r.tile;
    LAST_ZONE.set(uid, { player: tile.player, zone: -1, at: { x: R(tile.home.x), y: R(tile.home.y) } });
    bg(crumbleTile(c.scene, tile, uid, ID));
    return { tile: null, unit: r.unit };
  };
}
/** field.release for this card's own scenes (bypasses the claim). */
function releaseOwn(ctx: AnyCtx, uid: Uid): { tile: TileCard | null; unit: MonsterUnit | null } {
  ownRelease++;
  try {
    return ctx.views.field.release(uid);
  } finally {
    ownRelease--;
  }
}

registerObserver((_ev, ctx) => {
  if (!LOOK_V3) return;
  try {
    claimTiles(ctx);
    ensureAuras(ctx);
  } catch (e) {
    console.error('[spite_axe] aura', e);
  }
});

/**
 * The axe's bonus taken back from a wielder still standing (its card left the field): the aura ends here (never
 * Ejder Kılıcı's sword break, which keys on the 'equip' aura), then the plain stat roll plays.
 */
/** −800s taken over by the return scene (played before the toDeck): rolled at the launch. */
const DEFERRED = new Map<Uid, { atk: number; def: number }>();
/** Wielders whose axe is leaving right now: their −800 waits for the axe's launch. */
const LAUNCH = new Map<Uid, Promise<void>>();

registerEvent(
  'statChange',
  async (ctx) => {
    const e = ctx.ev as StatEv;
    if (LOOK_V3 && e.atk < e.prevAtk && LAUNCH.has(e.uid)) await LAUNCH.get(e.uid);
    if (LOOK_V3 && e.atk < e.prevAtk) {
      // played BEFORE its axe's return (a mass wipe's pass plays the stat first): the return scene rolls it at the
      // launch, the aura stays on until then
      const aura = [...AURAS.values()].find((a) => a.unit.uid === e.uid);
      if (aura && ctx.events.some((x) => x.type === 'toDeck' && x.uid === aura.cardUid)) {
        DEFERRED.set(e.uid, { atk: e.atk, def: e.def });
        return;
      }
      const u = ctx.unit(e.uid);
      const a = u?.aura('equip');
      if (u && a instanceof AxeAura) {
        const still = ctx.stateNext.players.some((p) => p.spellTraps.some((x) => !!x && x.equippedTo === e.uid && ctx.stateNext.cards[x.uid]?.cardId === ID));
        if (!still) u.setAura('equip', null);
      }
    }
    return ctx.base();
  },
  { name: 'e:spite_axe:stat', priority: 7 },
);

// ================================================================ DESTROYED: the card crumbles to embers

/** The axe's card crumbles into embers on its tile (an ember crack runs across it, sparks rise, it burns away). */
async function crumbleTile(sc: Phaser.Scene, tile: TileCard, uid: Uid, cardId: CardId, sound = true): Promise<void> {
  const home = { x: R(tile.home.x), y: R(tile.home.y) };
  if (!tile.faceUp) {
    tile.setCard(cardId);
    await tile.flipUp(150);
  }
  if (sound) playV3('e_axeCard', { volume: 0.8, pan: panAt(home.x) });
  bg(tile.pulse(PAL.fire3, 180));
  void lightFlash(sc, home.x, home.y, PAL.fire3, 22, 300, { floorY: home.y, intensity: 0.6 });
  const crack = Raster.around(sc, home.x, home.y, 48, 28, tile.depth + 0.5);
  const path = crackPath({ x: home.x - 14, y: home.y - 3 }, { x: home.x + 14, y: home.y + 3 }, uid * 3 + 1, 2);
  const rnd = fxRng(uid * 5 + 2);
  const sp = new PxSparks(sc, DEPTH.FX + 2);
  await run(sc, 120, (t) => {
    const n = Math.ceil(path.length * quant(t, 3));
    crack.begin();
    for (let i = 0; i < n; i++) crack.px(path[i].x, path[i].y, i >= n - 2 ? PAL.white : PAL.fire3);
    crack.end();
  });
  for (let i = 0; i < fxCount(16); i++)
    sp.add({ x: home.x + (rnd() - 0.5) * 30, y: home.y + (rnd() - 0.5) * 12, vx: (rnd() - 0.5) * 16, vy: -18 - rnd() * 30, life: 380 + rnd() * 320, colors: EMBER_DOWN, shape: 'px', fadeAt: 1 });
  sp.release();
  // it crumbles to EMBER from the crack outward (palette-only, never the card's teal accent dissolve)
  const img = (tile as unknown as { img?: Phaser.GameObjects.Image }).img;
  if (tile.active) {
    // the transform: the tile's image when it has one, else the tile itself (centred on its home)
    const src = img && img.active ? img : (tile as unknown as Phaser.GameObjects.Image);
    const shim = src === img ? src : ({ getWorldTransformMatrix: () => tile.getWorldTransformMatrix(), originX: 0.5, originY: 0.5 } as unknown as Phaser.GameObjects.Image);
    const hideTile = { setVisible: (v: boolean) => tile.setVisible(v) } as unknown as Phaser.GameObjects.Image;
    await emberCrumble(sc, shim, isoCanvas(tile.cardId ?? cardId, tile.orientation, tile.player), path, 420, uid * 7 + 3, tile.depth + 0.6, hideTile);
    if (tile.active) tile.setVisible(false);
  } else await tile.dissolve(240);
  crack.destroy();
  if (tile.active) tile.destroy();
}

/**
 * The card's own pixels crumble to embers: a ragged front runs out from the crack (`crack`, world points); a pixel
 * ahead of it keeps its colour, AT it flares white → fire4, behind it either goes out or lifts off as a 1-px ember
 * (fire3 → fire2 → crim2 → stone0 by age, rising with a sway, whole pixels). Palette tones only, no alpha. Hides img.
 */
function emberCrumble(sc: Phaser.Scene, img: Phaser.GameObjects.Image, pc: { w: number; h: number; get(x: number, y: number): number | null }, crack: readonly XY[], ms: number, seed: number, depth: number, hide?: Phaser.GameObjects.Image): Promise<void> {
  const m = img.getWorldTransformMatrix().decomposeMatrix();
  const cos = Math.cos(m.rotation);
  const sin = Math.sin(m.rotation);
  const ox = img.originX * pc.w;
  const oy = img.originY * pc.h;
  const rnd = fxRng(seed);
  interface P {
    x: number;
    y: number;
    c: number;
    tb: number;
    flies: boolean;
    vx: number;
    vy: number;
    ph: number;
    life: number;
  }
  const parts: P[] = [];
  let maxD = 1;
  const dist = (x: number, y: number): number => crack.reduce((a, q) => Math.min(a, Math.hypot(q.x - x, (q.y - y) * 2)), Infinity);
  for (let y = 0; y < pc.h; y++)
    for (let x = 0; x < pc.w; x++) {
      const c = pc.get(x, y);
      if (c === null) continue;
      const lx = (x + 0.5 - ox) * m.scaleX;
      const ly = (y + 0.5 - oy) * m.scaleY;
      const wx = R(m.translateX + lx * cos - ly * sin);
      const wy = R(m.translateY + lx * sin + ly * cos);
      const d = dist(wx, wy) + rnd() * 3;
      maxD = Math.max(maxD, d);
      parts.push({ x: wx, y: wy, c, tb: d, flies: rnd() < 0.35, vx: (rnd() - 0.5) * 22, vy: -(26 + rnd() * 60), ph: rnd() * 6.28, life: 240 + rnd() * 260 });
    }
  const burn = ms * 0.55;
  for (const p of parts) p.tb = (p.tb / maxD) * burn;
  const ras = new Raster(sc, 0, 0, 640, 360, depth);
  (hide ?? img).setVisible(false);
  const AGE = [PAL.fire3, PAL.fire3, PAL.fire2, PAL.crim2, PAL.stone0] as const;
  return run(sc, ms, (_t, el) => {
    ras.begin();
    for (const p of parts) {
      const dt = el - p.tb;
      if (dt < -40) ras.px(p.x, p.y, p.c);
      else if (dt < 0) ras.px(p.x, p.y, PAL.fire1);
      else if (dt < 30) ras.px(p.x, p.y, dt < 15 ? PAL.white : PAL.fire4);
      else if (p.flies && dt < p.life) {
        const k = dt / p.life;
        const s2 = dt / 1000;
        ras.px(R(p.x + p.vx * s2 + Math.sin(p.ph + dt * 0.014) * 2 * k), R(p.y + p.vy * s2 - 60 * s2 * s2), AGE[Math.min(AGE.length - 1, Math.floor(k * AGE.length))]);
      }
    }
    ras.end();
  }).then(() => ras.destroy());
}

registerCardHook(ID, 'destroyed', async (ctx: DestroyCtx) => {
  if (!LOOK_V3) return ctx.base();
  const ev = ctx.ev;
  if (ev.location !== 'spellTrap') return ctx.base();
  const field = ctx.views.field;
  const { tile } = releaseOwn(ctx, ev.uid);
  if (tile && tile.active) {
    LAST_ZONE.set(ev.uid, { player: ev.player, zone: ev.zone, at: { x: R(tile.home.x), y: R(tile.home.y) } });
    await crumbleTile(ctx.scene, tile, ev.uid, ev.cardId);
  }
  field.forget(ev.uid);
});

/** Where each axe card last lay (its spell zone), for the return scene's fallback. */
const LAST_ZONE = new Map<Uid, { player: PlayerId; zone: number; at: XY }>();

// ================================================================ RETURN: back to its owner's deck, the lash

registerLaneE(
  'toDeck',
  (ctx) => LOOK_V3 && ctx.ev.from === 'spellTrap' && ctx.ev.cardId === ID,
  (ctx) => returnScene(ctx),
);

async function returnScene(ctx: DeckCtx): Promise<void> {
  const ev = ctx.ev;
  const sc = ctx.scene;
  const field = ctx.views.field;
  const owner: PlayerId = ev.owner;
  const rnd = fxRng(ev.uid * 17 + 3);
  const di = ctx.findType('damage', (e) => e.sourceUid === ev.uid && e.player === owner);
  // a card tile still on the field (its destroy was presented by someone who left it): it crumbles to embers too
  const left = releaseOwn(ctx, ev.uid).tile;
  const leftAt = left && left.active ? { x: R(left.home.x), y: R(left.home.y) } : null;
  if (left && left.active) bg(crumbleTile(sc, left, ev.uid, ev.cardId));
  field.forget(ev.uid);
  // where the axe is: slung on a standing wielder, fallen on the floor, or (unknown) over its card's last zone
  const aura = AURAS.get(ev.uid);
  const fallen = FALLEN.get(ev.uid);
  let pose: AxePose;
  let wielder: MonsterUnit | null = null;
  let eyes: XY[] = [];
  if (aura && !aura.unit.retired) {
    wielder = aura.unit;
    eyes = aura.eyes();
    pose = aura.take();
    if (wielder.aura('equip') instanceof AxeAura) wielder.setAura('equip', null);
  } else if (fallen) pose = fallen.take();
  else if (DETACHED.get(ev.uid) && !DETACHED.get(ev.uid)!.retired && DETACHED.get(ev.uid)!.sprite.active && LAST.get(ev.uid)) {
    // a board sync already ended the aura: the axe is still on its back (its last pose), the eyes still lit
    wielder = DETACHED.get(ev.uid)!;
    eyes = eyesOf(wielder.sprite);
    pose = LAST.get(ev.uid)!;
  } else {
    const lp = LAST.get(ev.uid);
    const lz = LAST_ZONE.get(ev.uid);
    const z = leftAt ?? lz?.at ?? field.pile(owner, 'deck').topXY();
    pose = lp ?? { x: R(z.x), y: R(z.y - 24), ...holdPose(owner), size: 'sm' };
  }
  LAST_ZONE.delete(ev.uid);
  DETACHED.delete(ev.uid);
  // the −800 rolls when the axe LEAVES its bearer (the launch), never before
  const ci = wielder ? ctx.findType('statChange', (e) => e.uid === wielder!.uid && e.atk < e.prevAtk) : -1;
  if (ci >= 0) ctx.consumeAt(ci);
  // the −800 waits for the launch however it is played (a mass wipe's pass may play it beside this scene)
  let launched: () => void = () => undefined;
  let holding = false;
  let finalStats: { atk: number; def: number } | null = null;
  if (wielder) {
    const w = wielder;
    LAUNCH.set(w.uid, new Promise<void>((res) => (launched = res)));
    bg(wait(sc, 4000).then(() => launched()));
    // the badge keeps the bonus until the launch, even if a board sync between batches already took it down
    const se = ctx.events.find((x): x is StatEv => x.type === 'statChange' && x.uid === w.uid && x.atk < x.prevAtk);
    const hold = se ? se.prevAtk : Math.max(w.shownStats.atk, currentAtk(ctx.stateNext, w.uid) + 800);
    finalStats = se ? { atk: se.atk, def: se.def } : { atk: hold - 800, def: w.shownStats.def };
    holding = true;
    onFrame(sc, () => {
      if (!holding || w.retired || !w.sprite.active) return false;
      const sh = w.shownStats;
      if (sh.atk !== hold) void w.setStats(hold, sh.def, false);
      return true;
    });
  }
  const pile = field.pile(owner, 'deck');
  const deck = pile.topXY();
  const sparks = new PxSparks(sc, DEPTH.FX + 3);
  const axe = new AxeSprite(sc, { size: pose.size, angle: pose.angle, mirror: pose.mirror, heat: 2 }, pose.x, pose.y, wielder ? wielder.sprite.depth - 0.4 : DEPTH.UNIT + pose.y + 20);
  const ex = new Raster(sc, 0, 0, 640, 360, DEPTH.FX + 1);
  const bag = new PixBag();

  // ---- SLIP: it shudders, the eyes go out (a wisp of smoke)
  playV3('e_axeSlip', { volume: 0.95, pan: panAt(pose.x) });
  const back = wielder && wielder.player === 0 ? -1 : 1;
  let f = 0;
  await run(sc, RET.shudder, (t, _el, dt) => {
    if (dt > 0) f++;
    axe.at(pose.x + (f % 2 === 0 ? 1 : -1), pose.y).set({ pulse: Math.min(3, Math.floor(t * 4)) });
    ex.begin();
    const lvl = t < 0.35 ? 2 : t < 0.7 ? 1 : 0;
    drawEyes(ex, eyes, back, lvl, f);
    if (lvl === 0) for (const e of eyes.slice(0, 2)) ex.px(e.x, e.y - 1 - Math.floor(t * 4), PAL.stone2);
    ex.end();
  });
  ex.begin();
  ex.end();
  const tilt = pose.angle + (pose.mirror ? -15 : 15);
  await run(sc, RET.drop, (t) => axe.at(pose.x, pose.y + R(E.inQuad(t) * 4)).set({ angle: t > 0.5 ? tilt : pose.angle, pulse: -1 }));

  // ---- LAUNCH: a white-cracked frame, the big drawing, an arc to the deck (under the HUD band), spinning
  playV3('e_axeFly', { volume: 0.6, pan: panAt(pose.x) });
  holding = false;
  launched();
  if (wielder) LAUNCH.delete(wielder.uid);
  const late = wielder ? DEFERRED.get(wielder.uid) : undefined;
  if (wielder) DEFERRED.delete(wielder.uid);
  // the −800 rolls here (the consumed statChange is presented by this roll)
  const fin = late ?? finalStats;
  if (wielder && !wielder.retired && fin) void wielder.setStats(fin.atk, fin.def, true);
  else if (ci >= 0) bg(ctx.play(ci));
  axe.set({ size: 'lg', heat: 4 });
  axe.img.setDepth(DEPTH.FX + 2);
  await frames(sc, 1);
  axe.set({ heat: 2 });
  const startP = { x: pose.x, y: pose.y + 4 };
  const deckMirror = owner === 1;
  const endA = 90;
  const slamO: XY = { x: R(deck.x), y: R(deck.y - 4) };
  // the arc's apex stays under the top HUD band (P2's pile is near it)
  const ctrl = { x: lerp(startP.x, slamO.x, 0.5), y: Math.max(owner === 1 ? 52 : 16, Math.min(startP.y, slamO.y) - 44) };
  const spin = 360 + 180 + turn(tilt + 540, endA);
  const trail: XY[] = [];
  const lightF = lightPool(sc, startP.x, startP.y, { color: PAL.fire3, radius: 16, air: 0.5, airRadius: 10, intensity: 0.6, anim: 'flicker', fadeIn: 0 });
  let crackT = 0;
  await run(sc, RET.flyMs, (t, el, dt) => {
    const k = E.inOutSine(t);
    const p = qbez(startP, ctrl, slamO, k);
    const a = tilt + spin * quant(t, 18);
    axe.set({ angle: axeAngle(a), mirror: t < 0.5 ? pose.mirror : deckMirror, heat: 2 }).at(p.x, p.y);
    lightF.setPosition(p.x, p.y);
    trail.unshift(axe.pt(-32, 0));
    if (trail.length > 9) trail.pop();
    ex.begin();
    bag.clear();
    if (trail.length > 2) {
      const pts = trail.map((q, i) => ({ x: q.x + Math.round(Math.sin(el / 30 + i) * 2), y: q.y + Math.round(Math.cos(el / 30 + i) * 2) }));
      chainLinks(bag, pts, { heat: (i) => (i === Math.floor(el / 40) % 6 ? 2 : 0) });
    }
    bag.flush(ex);
    ex.end();
    if (dt > 0 && el - crackT > 90 && trail.length > 4) {
      crackT = el;
      const q = trail[3 + Math.floor(rnd() * Math.min(5, trail.length - 4))];
      sparks.add({ x: q.x, y: q.y, life: 90, colors: [PAL.white, PAL.fire4], shape: 'plus', fadeAt: 1 });
    }
  });
  ex.begin();
  ex.end();

  // ---- SLAM onto the deck pile: the pile squashes, its cards fan a pixel, a dust ring; the axe white-cracked
  playV3('e_axeDeck', { volume: 0.85, pan: panAt(slamO.x) });
  axe.set({ angle: endA, mirror: deckMirror, heat: 4 }).at(slamO.x, slamO.y + 2);
  void lightF.fadeOut(300);
  void lightFlash(sc, slamO.x, slamO.y, PAL.fire3, 22, 300, { floorY: R(deck.y + 4), intensity: 0.7 });
  void shake(sc, 120, 2);
  try {
    pile.set(pile.count + 1, pile.topCard);
    pile.bump();
  } catch {
    /* the sync fixes the pile anyway */
  }
  const dust = Raster.around(sc, deck.x, deck.y + 4, 100, 50, DEPTH.FX);
  bg(
    (async () => {
      for (let i = 0; i < 6; i++) {
        dust.begin();
        // the fanned card edges (1 px out each side, two frames), then the dust ring widening
        if (i < 2)
          for (let y = -2; y <= 2; y++) {
            dust.px(deck.x - 21 - (y + 2 > 2 ? 1 : 0), deck.y + 3 + y, y === -2 ? PAL.mist : PAL.stone3);
            dust.px(deck.x + 21 + (y + 2 > 2 ? 1 : 0), deck.y + 3 + y, y === -2 ? PAL.mist : PAL.stone3);
          }
        const r = 22 + i * 4;
        for (let a = 0; a < 64; a++) {
          if ((a + i) % (i < 3 ? 2 : 3)) continue;
          const sn = Math.sin((a / 64) * Math.PI * 2);
          // only the near half of the ring (the pile hides the far half)
          if (sn < -0.2) continue;
          const x = R(deck.x + Math.cos((a / 64) * Math.PI * 2) * r);
          const y = R(deck.y + 8 + sn * r * 0.5);
          dust.px(x, y, i < 2 ? PAL.stone3 : i < 4 ? PAL.stone2 : PAL.stone1);
        }
        dust.end();
        await frames(sc, 2);
      }
      dust.destroy();
    })(),
  );
  for (let i = 0; i < fxCount(12); i++) {
    const a = Math.PI + rnd() * Math.PI;
    const v = 30 + rnd() * 70;
    sparks.add({ x: slamO.x, y: slamO.y + 2, vx: Math.cos(a) * v, vy: Math.sin(a) * v, ay: 300, life: 240 + rnd() * 200, colors: EMBER, shape: 'px', fadeAt: 1 });
  }
  await freeze(sc, RET.slamStop);
  axe.set({ heat: 3 });
  const pileTop = R(deck.y);
  bg(
    run(sc, RET.sinkMs, (t) => {
      const st2 = quant(t, 4);
      axe.set({ heat: st2 >= 0.5 ? 1 : 3 }).at(slamO.x, slamO.y + 2 + R(st2 * 34)).bury(pileTop);
    }).then(() => axe.destroy()),
  );

  // ---- THE LASH: a red-hot chain whips out of the pile in an S-wave and CRACKS on the owner's LP panel
  const lp = lpPoint(ctx, owner);
  const pr = panelRect(owner);
  // it strikes the LP NUMBER's left edge (where the drain starts), never the name label over it
  const lpLeft = pr.x + (pr.w > 140 ? 22 : 16);
  const tip: XY = { x: R(lpLeft - 1), y: R(lp.y) };
  const root: XY = { x: R(deck.x), y: R(deck.y - 6) };
  const whip = new Raster(sc, 0, 0, 640, 360, DEPTH.HUD + 6);
  const starR = new Raster(sc, 0, 0, 640, 360, DEPTH.HUD + 7);
  playV3('e_axeLash', { volume: 1, pan: panAt(tip.x) });
  // the arc keeps ABOVE the duelists' avatars (it never cuts across a portrait figure); when no arc under the HUD band
  // clears them, the chain runs just behind the avatar instead (the crack star stays on top of the panel)
  const avatars: { l: number; r: number; t: number; b: number; d: number }[] = [];
  for (const pl of [0, 1] as const) {
    try {
      const dv = ctx.views.duelists?.get(pl);
      const spr = dv?.sprite;
      if (spr && spr.active && spr.visible) {
        const bb = spr.getBounds();
        avatars.push({ l: bb.left - 3, r: bb.right + 3, t: bb.top - 4, b: bb.bottom, d: spr.depth });
      }
    } catch {
      /* no duelists */
    }
  }
  const topY = owner === 1 ? 40 : 12;
  const mid = { x: lerp(root.x, tip.x, 0.5), y: Math.max(topY, Math.min(root.y, tip.y) - 60) };
  const hits = (m: XY): boolean => {
    for (let i = 0; i <= 32; i++) {
      const q = qbez(root, m, tip, i / 32);
      if (avatars.some((a) => q.x >= a.l && q.x <= a.r && q.y >= a.t - 10 && q.y <= a.b)) return true;
    }
    return false;
  };
  while (hits(mid) && mid.y > topY) mid.y = Math.max(topY, mid.y - 6);
  if (hits(mid)) whip.img.setDepth(Math.min(...avatars.map((a) => a.d)) - 0.5);
  const over: XY = { x: R(tip.x + (tip.x - mid.x) * 0.08), y: R(tip.y + (tip.y - mid.y) * 0.08) };
  /** The chain along the arc up to `k`, an S-wave of `crests` travelling down it (amp px), hot links. */
  const chainAt = (k: number, amp: number, phase: number, end: XY): XY[] => {
    const pts: XY[] = [];
    const n = 24;
    for (let i = 0; i <= n; i++) {
      const s2 = (i / n) * k;
      const p = qbez(root, mid, end, s2);
      const q = qbez(root, mid, end, Math.min(1, s2 + 0.02));
      const dx = q.x - p.x;
      const dy = q.y - p.y;
      const l = Math.hypot(dx, dy) || 1;
      // three crests travelling down the chain toward the tip, the amplitude growing toward the middle of the run
      const w = Math.sin((s2 / Math.max(0.05, k)) * Math.PI * 6 - phase) * amp * Math.sin(Math.min(1, s2 / Math.max(0.05, k)) * Math.PI);
      pts.push({ x: p.x - (dy / l) * w, y: p.y + (dx / l) * w });
    }
    return pts;
  };
  let smear: XY[] = [];
  const drawWhip = (pts: readonly XY[], hot: number, tipOn = true): void => {
    whip.begin();
    // the chain's weight: last frame's line, one flat crimson tone, under the links (no alpha)
    for (const q of smear) whip.px(q.x, q.y, PAL.crim1);
    bag.clear();
    // heavy 2-px links; a white-hot core rides the travelling crests toward the tip
    const crest = Math.floor(sc.time.now / 28);
    heavyChainLinks(bag, pts, { heat: (i) => (hot >= 2 ? 2 : i % 4 === 0 ? 2 : hot), core: (i) => (i - crest) % 9 === 0 || (hot >= 2 && i % 5 === 0) });
    // the tip: a hot iron hook (3×3, white core) that reads at 1×
    const h = pts[pts.length - 1];
    if (tipOn)
      for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1]] as const) bag.set(h.x + dx, h.y + dy, dx === 0 && dy === 0 ? PAL.white : PAL.fire4);
    bag.flush(whip);
    whip.end();
    smear = pts.map((q) => ({ x: R(q.x), y: R(q.y) + 1 }));
  };
  // out: the chain unrolls with the wave
  await run(sc, RET.lashMs, (t, el) => {
    const k = E.inQuad(t);
    const pts = chainAt(k, 10 * (1 - t * 0.6), el / 16, over);
    drawWhip(pts, t > 0.5 ? 1 : 0);
    const h = pts[pts.length - 1];
    sparks.add({ x: h.x, y: h.y, life: 80, colors: [PAL.fire4, PAL.fire3], shape: 'px', fadeAt: 1 });
  });
  // the CRACK: the tip overshoots the panel and snaps back onto it — one held frame of the crack star
  const crackStar = (r: Raster, c: XY, size: number): void => {
    for (let i = -size; i <= size; i++) {
      const col = Math.abs(i) <= 1 ? PAL.white : Math.abs(i) <= size - 2 ? PAL.fire4 : PAL.fire3;
      r.px(c.x + i, c.y, col);
      r.px(c.x, c.y + i, col);
      if (Math.abs(i) <= size - 3) {
        r.px(c.x + i, c.y + i, col);
        r.px(c.x + i, c.y - i, col);
      }
    }
    // the burst: eight short broken rays beyond the star
    for (let a = 0; a < 8; a++) {
      const an = (a / 8) * Math.PI * 2 + Math.PI / 8;
      for (let d = size + 2; d <= size + 4; d++) r.px(R(c.x + Math.cos(an) * d), R(c.y + Math.sin(an) * d * 0.8), d === size + 2 ? PAL.fire4 : PAL.fire3);
    }
  };
  drawWhip(chainAt(1, 0, 0, tip), 2);
  starR.begin();
  crackStar(starR, tip, 6);
  starR.end();
  // CONTACT: the −500 and the LP drain start on this very frame (the number pops through the crack's hold); on P2's
  // top panel it lands BELOW the panel (mirroring P1's above-the-panel number), clear of the counter row
  let dmg: Promise<void> = Promise.resolve();
  if (di >= 0 && !ctx.isConsumed(di)) {
    const dev = ctx.events[di] as Extract<GameEvent, { type: 'damage' }>;
    {
      // presented here (never the shared number: on P1's panel it covered the name label, on P2's top panel it landed
      // in the counter row): P1 ABOVE its panel's top edge, P2 UNDER its panel — over the HUD, a short float
      ctx.consumeAt(di);
      const ny = owner === 1 ? R(pr.y + pr.h + 19) : R(pr.y - 12);
      const num = axeNumber(sc, R(lp.x), ny, dev.amount, { kind: 'damage', depth: DEPTH.HUD + 20, rise: 4, life: 1300, fadeMs: 280, pop: 1 });
      try {
        const d = ctx.views.duelists?.get(owner);
        if (d) {
          void d.play('hurt');
          void d.jolt();
        }
      } catch {
        /* no duelists */
      }
      if (dev.lpAfter <= 1000) ctx.music.setIntensity(1);
      void num;
      dmg = ctx.views.hud.setLp(owner, dev.lpAfter, true, { maxMs: LP_ROLL_MAX_MS }).then(() => undefined);
    }
  }
  try {
    ctx.views.hud.shake(owner, 2, 200);
  } catch {
    /* no hud */
  }
  const panel = new Raster(sc, pr.x - 6, pr.y - 6, pr.w + 12, pr.h + 12, DEPTH.HUD + 5.5);
  for (let i = 0; i < fxCount(16); i++) {
    const a = rnd() * Math.PI * 2;
    const v = 50 + rnd() * 110;
    sparks.add({ x: tip.x, y: tip.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, ay: 200, life: 220 + rnd() * 200, colors: EMBER, shape: i % 4 === 0 ? 'star' : 'px', fadeAt: 1 });
  }
  const sparkHud = new PxSparks(sc, DEPTH.HUD + 7);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    sparkHud.add({ x: tip.x, y: tip.y, vx: Math.cos(a) * 90, vy: Math.sin(a) * 60, ay: 160, life: 260, colors: [PAL.white, PAL.fire4, PAL.fire3, PAL.fire2], shape: 'plus', fadeAt: 1 });
  }
  sparkHud.release();
  void shake(sc, 140, 2);
  const edge = [PAL.white, PAL.white, PAL.fire4, PAL.fire3, PAL.fire3, PAL.fire2, PAL.fire1] as const;
  bg(
    (async () => {
      for (let i = 0; i < edge.length; i++) {
        panel.begin();
        const g = Math.min(3, i);
        for (let x = pr.x - g; x <= pr.x + pr.w + g - 1; x++) {
          if ((x + i) % 4 === 0 && i > 2) continue;
          panel.px(x, pr.y - g, edge[i]);
          panel.px(x, pr.y + pr.h + g - 1, edge[i]);
        }
        for (let y = pr.y - g; y <= pr.y + pr.h + g - 1; y++) {
          if ((y + i) % 4 === 0 && i > 2) continue;
          panel.px(pr.x - g, y, edge[i]);
          panel.px(pr.x + pr.w + g - 1, y, edge[i]);
        }
        panel.end();
        await frames(sc, 2);
      }
      panel.destroy();
    })(),
  );
  // the crack frame holds a beat (the number is already up)
  await freeze(sc, 60);
  starR.begin();
  starR.end();
  smear = [];
  // the recoil: the chain jerks back off the panel in a wave and slithers into the pile
  await run(sc, RET.backMs, (t, el) => {
    const k = 1 - E.inOutSine(t);
    if (k > 0.04) drawWhip(chainAt(k, 7 * (1 - t), -el / 14, tip), t < 0.3 ? 1 : 0, false);
    else {
      whip.begin();
      whip.end();
    }
  });
  whip.destroy();
  starR.destroy();
  ex.destroy();
  sparks.release();
  await dmg;
}

void spriteBox;
