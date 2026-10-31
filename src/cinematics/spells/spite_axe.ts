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
//   +500   THE BITE: its head buries 9 px in the floor beside the monster (rows under the floor line are cut);
//          hit-stop 80 ms; a white-hot frame; five ember cracks race out over the floor (stepped growth); a dirt
//          + ember burst; a floor flash (fire3); 3 px shake — e_axeBite. The haft QUIVERS (±1 px, 6 frames).
//   +560   the chains fall slack and coil on the floor in two heaps — e_axeChain
//   +640   VEIN PULSE ×3 (every 210 ms): a hot wave runs down the haft's veins, the cracks flare, the floor cracks
//          brighten a step, an ember ring breathes round the bite — e_axePulse (low beating drone)
//   +760   THE REACH: the monster leans toward the axe (2 px, stepped) and dips 1 px; crimson-ember veins CLIMB its
//          edge from the feet (rimClimb, fire ramp) — the axe is taking it
//   +1220  THE WRENCH: the haft trembles harder (±1–2 px), the chains lift off the floor and pull TAUT to two iron
//          pegs (straight link lines, vibrating), the floor cracks run longer and glow fire4 — e_axeWrench (groan)
//   +1580  SNAP: the chains break (white spark at each break, links flung), hit-stop 60 ms; the axe TEARS OUT of the
//          floor (dirt clods + ember spray, a dark slit left in the floor) — e_axeSnap…
//   +1600  …and swings up in an arc to its wielder's back (turning to the slung pose, 6 turn drawings), shrinking
//          into the slung axe on a white-hot frame
//   +1820  THE OATH: the EYES IGNITE (white-hot, then ember; a 4-ray star on them), the body's edge flares ember,
//          the single "+800" beside the head, the badge rolls; the persistent aura starts (AxeAura) — e_axeIgnite.
//          The floor cracks cool down the fire ramp to nothing (≈500 ms, not waited for)
//   +1950  the input returns
// DESTROYED (hook 'destroyed', the axe's card leaves its spell zone): the card flares ember, a crack runs across it,
//   it crumbles into embers on its tile — e_axeCard
// RETURN (lane-E toDeck, registerLaneE; +ms):
//   +0     SLIP: the slung axe shudders (±1 px), the wielder's eyes go out (a wisp of ember smoke), the −800 rolls;
//          a dead wielder's axe (Fallen) wrenches itself out of the floor instead — e_axeSlip
//   +200   it drops 4 px out of the grip, tilts, and LAUNCHES: it flies in a high arc to its OWNER's deck pile,
//          spinning 1.5 turns, growing to the big drawing on an ember frame, its chains whipping behind with small
//          white cracks along them — e_axeFly
//   +640   SLAM onto the deck pile, head down: hit-stop 60 ms, white-hot frame, ember burst, 2 px shake, the pile
//          bumps (+1 card) — e_axeDeck; the axe sinks into the pile (cut from the top, ember look)
//   +760   THE LASH: a chain uncoils from the pile and whips across to the owner's LP panel (a travelling wave of
//          links); the CRACK on the panel: a white → ember edge flash round the panel, spark burst, the damage
//          event (−500) plays there — e_axeLash
//   +1100  the chain snaps back into the pile; done (≈1.25 s)

import type Phaser from 'phaser';
import type { CardId } from '../../data/cards';
import type { GameEvent, PlayerId, Uid } from '../../engine/types';
import { PAL } from '../../art/palette';
import { crackPath } from '../../art/spellmotifs-v3';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import { DEPTH, LOOK_V3, type XY, panelRect, zoneXY } from '../../view/layout';
import { shake, wait } from '../../vfx/core';
import { E, Raster, freeze, lerp, onFrame, qbez, run, spriteBox } from '../../vfx/setpieces';
import { Sparks as PxSparks } from '../../vfx/combat';
import { fxCount, fxRng, motifImage, numberUnderBar, rimClimb, rimFlash, setMotif, silhouetteOf } from '../_v3/spellfx';
import { panAt, play as playV3 } from '../_v3/sound';
import { impactNumber } from '../_v3/number';
import { lpPoint } from '../_core/helpers';
import { fx, registerCardHook, registerEvent, registerObserver, type CinematicContext } from '../api';
import { registerLaneE, type LaneECtx } from '../b2e/dispatch';
import { bg, evAt, idxOf, lightFlash, lightPool, relax, setTileOf, spellOpening, type ActCtx, type AnyCtx } from './_kit';
import { type AxeOpts, axeAngle, axeKey, axeOffset, paintLink } from './_spite_axe_motif';
import { AURAS, AxeAura, FALLEN, LAST, type AxePose, drawEyes, holdAt, holdPose, plantPose } from './_spite_axe_aura';

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
  reachMs: 260,
  pulsesBeforeWrench: 3,
  wrenchMs: 280,
  snapStop: 60,
  pullMs: 190,
  tail: 130,
} as const;
const RET = { shudder: 120, drop: 90, flyMs: 430, slamStop: 60, sinkMs: 130, lashMs: 180, backMs: 160 } as const;

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

/** Chains: polyline of links (world points), drawn into a raster. */
function chainAlong(r: Raster, pts: readonly XY[], pitch = 3, lit = -1): void {
  let acc = 0;
  let n = 0;
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len <= 0) continue;
    const dx = (b.x - a.x) / len;
    const dy = (b.y - a.y) / len;
    while (acc <= len) {
      const x = R(a.x + dx * acc);
      const y = R(a.y + dy * acc);
      // ink under-pixel so the links read on any floor
      r.px(x, y + 1, PAL.ink);
      paintLink((px, py, c) => r.px(px, py, c), x, y, dx, dy, n, n === lit);
      n++;
      acc += pitch;
    }
    acc -= len;
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
    forging.delete(u.uid);
  }
});

async function axeScene(ctx: EquipCtx, u: MonsterUnit, ci: number): Promise<void> {
  const ev = ctx.ev;
  const sc = ctx.scene;
  const s = u.sprite;
  const rnd = fxRng(ev.spellUid * 31 + 5);
  const side = u.player === 0 ? -1 : 1; // the wielder's back side on screen
  const home = { x: R(u.home.x), y: R(u.home.y) };
  // beside the body, just off its back edge (never under it)
  const sil = silhouetteOf(s);
  const edgeX = sil ? (side < 0 ? sil.left : sil.right) : home.x + side * 20;
  const bite: XY = { x: R(edgeX + side * 26), y: home.y + 6 };
  const pp = plantPose(u.player);
  const lgPlant: AxeOpts = { size: 'lg', angle: pp.angle, mirror: pp.mirror, heat: 2 };
  // O (the head's origin) such that the blade's toe bites 5 px under the floor line at the bite point
  const edge = axeOffset(lgPlant, 9, 11);
  const plantO: XY = { x: bite.x - edge.x, y: bite.y - edge.y + 3 };
  const st = evAt(ctx, ci, 'statChange');
  const tile = ctx.views.field.tileAt(ev.player, 'spellTrap', ev.spellZone);
  const from: XY = (ctx.hints.from as XY | undefined) ?? (tile ? { x: tile.home.x, y: tile.home.y } : zoneXY(ev.player, 'spellTrap', ev.spellZone));
  const depthAxe = s.depth + 1;
  const sparks = new PxSparks(sc, DEPTH.FX + 3);
  const fxr = new Raster(sc, 0, 0, 640, 360, DEPTH.FX + 2);
  const chainR = new Raster(sc, 0, 0, 640, 360, depthAxe - 0.2);

  // ---- OMEN: the card's ember spark leaves for the sky over the bite point; a target cross on the floor
  playV3('e_axeOmen', { volume: 0.9, pan: panAt(bite.x) });
  if (tile && tile.active) bg(tile.pulse(PAL.fire3, 200));
  void lightFlash(sc, from.x, from.y, PAL.fire3, 18, 240, { floorY: from.y, intensity: 0.6 });
  // where the axe will come from: up the haft line from the plant point, off the top of the screen at most
  const d = axeOffset({ size: 'lg', angle: pp.angle, mirror: pp.mirror }, 100, 0);
  const dl = Math.hypot(d.x, d.y);
  const ux = d.x / dl;
  const uy = d.y / dl;
  // it drops from high over its head end, a steep line (head first), never from more than 160 px
  void ux;
  void uy;
  const sky: XY = { x: R(plantO.x - side * 34), y: R(Math.max(-12, plantO.y - 160)) };
  const fdx = plantO.x - sky.x;
  const fdy = plantO.y - sky.y;
  const fl = Math.hypot(fdx, fdy) || 1;
  const sparkTop: XY = { x: sky.x, y: Math.max(8, sky.y + 10) };
  await run(sc, T.omenMs, (t) => {
    const k = E.outCubic(t);
    const hx = lerp(from.x, sparkTop.x, k);
    const hy = lerp(from.y - 6, sparkTop.y, k) - Math.sin(k * Math.PI) * 18;
    fxr.begin();
    // a short ember streak and the target cross blinking beside the monster
    for (let i = 0; i < 6; i++) {
      const kk = Math.max(0, k - i * 0.035);
      const x = lerp(from.x, sparkTop.x, kk);
      const y = lerp(from.y - 6, sparkTop.y, kk) - Math.sin(kk * Math.PI) * 18;
      fxr.px(x, y, i === 0 ? PAL.white : i < 3 ? PAL.fire4 : PAL.fire3);
    }
    fxr.px(hx + 1, hy, PAL.fire4);
    if (Math.floor(t * 6) % 2 === 0) {
      for (let i = -4; i <= 4; i++) fxr.px(bite.x + i, bite.y + R(i * 0), Math.abs(i) <= 1 ? PAL.fire4 : PAL.fire2);
      for (let i = -2; i <= 2; i++) fxr.px(bite.x + i * 2, bite.y + i, Math.abs(i) <= 0 ? PAL.fire4 : PAL.fire2);
    }
    fxr.end();
  });
  fxr.begin();
  fxr.end();

  // ---- the AXE appears high above (white-hot), tumbles half a turn…
  const axe = new AxeSprite(sc, { ...lgPlant, angle: pp.angle + 180, look: 'hot' }, sky.x, sky.y, depthAxe);
  sparks.add({ x: sky.x, y: Math.max(6, sky.y), life: 160, colors: [PAL.white, PAL.fire4, PAL.fire3], shape: 'star', fadeAt: 1 });
  await frames(sc, 1);
  axe.set({ look: 'plain' });
  const startA = pp.angle + 180;
  let tumbleF = 0;
  await run(sc, T.tumbleMs, (t, _el, dt) => {
    if (dt > 0) tumbleF++;
    const a = startA + turn(startA, pp.angle + 360) * quant(E.outQuad(t), 4);
    axe.set({ angle: a, heat: 2 }).at(sky.x, sky.y - R(Math.sin(t * Math.PI) * 4));
  });
  axe.set({ angle: pp.angle });

  // ---- …and DIVES head-first along its haft line, chains streaming behind
  playV3('e_axeFall', { volume: 0.95, pan: panAt(bite.x) });
  const light = lightPool(sc, sky.x, sky.y, { color: PAL.fire4, radius: 11, floorY: bite.y, air: 0.5, airRadius: 12, intensity: 0, anim: 'flicker', fadeIn: 0 });
  light.setIntensity(0.5, 200);
  let prev = { ...sky };
  await run(sc, T.diveMs, (t, el, dt) => {
    const k = E.inQuad(t);
    const x = lerp(sky.x, plantO.x, k);
    const y = lerp(sky.y, plantO.y - 4, k);
    axe.at(x, y);
    light.setPosition(x, y + 10, bite.y);
    const pom = axe.pt(-32, 0);
    chainR.begin();
    // two chains stream back up the dive line, waving
    for (const [off, ph] of [
      [-3, 0],
      [3, 2],
    ] as const) {
      const tail = { x: pom.x - (fdx / fl) * 26 + off, y: pom.y - (fdy / fl) * 26 };
      chainAlong(chainR, chainPts({ x: pom.x + off * 0.3, y: pom.y }, tail, 3, el / 40 + ph, 8));
    }
    // a one-frame light line behind the head
    if (dt > 0) for (let i = 1; i <= 8; i++) chainR.px(R(lerp(prev.x, x, i / 8)) + 0, R(lerp(prev.y, y, i / 8)) + 4, i > 5 ? PAL.fire4 : PAL.fire2);
    chainR.end();
    if (dt > 0 && rnd() < 0.7) sparks.add({ x: x + (rnd() - 0.5) * 8, y: y + rnd() * 8, vx: (rnd() - 0.5) * 20, vy: -20 - rnd() * 30, life: 220 + rnd() * 160, colors: EMBER_DOWN, shape: 'px', fadeAt: 1 });
    prev = { x, y };
  });

  // ---- THE BITE
  axe.at(plantO.x, plantO.y).bury(bite.y);
  axe.set({ look: 'hot' });
  playV3('e_axeBite', { volume: 1, pan: panAt(bite.x) });
  const cracks = floorCracks(sc, bite, ev.spellUid, side);
  cracks.glow(4);
  light.setPosition(bite.x, bite.y - 8, bite.y);
  light.setIntensity(0.3, 200);
  void shake(sc, 170, 3);
  const nBurst = fxCount(26);
  for (let i = 0; i < nBurst; i++) {
    const a = Math.PI + (i / nBurst) * Math.PI + (rnd() - 0.5) * 0.3; // upward fan
    const v = 50 + rnd() * 120;
    const dirt = i % 3 === 0;
    sparks.add({ x: bite.x + (rnd() - 0.5) * 6, y: bite.y - 1, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.9, ay: 380, drag: 1.2, life: 280 + rnd() * 320, colors: dirt ? [PAL.stone2, PAL.stone1, PAL.stone0] : EMBER, shape: dirt ? 'sq' : i % 4 === 1 ? 'plus' : 'px', floor: bite.y + 6 + rnd() * 8, bounce: 0.3, fadeAt: 1 });
  }
  chainR.begin();
  chainR.end();
  bg(run(sc, 120, (t) => cracks.grow(quant(t, 3))));
  await freeze(sc, T.stop);
  axe.set({ look: 'plain', heat: 3 });
  // the haft quivers
  for (let f = 0; f < T.quiverFrames; f++) {
    const amp = f < 2 ? 2 : f < 4 ? 1 : f % 2;
    axe.at(plantO.x + (f % 2 === 0 ? amp : -amp), plantO.y).bury(bite.y);
    await frames(sc, 1);
  }
  axe.at(plantO.x, plantO.y).bury(bite.y).set({ heat: 2 });
  cracks.glow(3);

  // ---- the chains fall slack and coil on the floor (two heaps)
  playV3('e_axeChain', { volume: 0.85, pan: panAt(bite.x) });
  const pom = axe.pt(-32, 0);
  const heapA: XY = { x: bite.x - side * 12, y: bite.y + 6 };
  const heapB: XY = { x: bite.x + side * 14, y: bite.y + 2 };
  const drawSlack = (k: number, taut = 0, el = 0): void => {
    chainR.begin();
    for (const [heap, off] of [
      [heapA, -1],
      [heapB, 1],
    ] as const) {
      const a0 = { x: pom.x + off, y: pom.y };
      if (taut > 0) {
        // pulled straight to the peg, vibrating a pixel
        const v = Math.round(Math.sin(el / 18 + off) * (taut > 0.6 ? 1 : 0));
        chainAlong(chainR, chainPts(a0, heap, v, 0, 6));
        chainR.px(heap.x, heap.y, PAL.stone3);
        chainR.px(heap.x, heap.y + 1, PAL.ink);
      } else {
        // falling: from streaming up to a coil heap on the floor
        const sag = { x: lerp(a0.x, heap.x, 0.5), y: lerp(a0.y - 16, Math.max(a0.y, heap.y) + 4, k) };
        const pts: XY[] = [];
        for (let i = 0; i <= 8; i++) pts.push(qbez(a0, sag, heap, i / 8));
        // the coil: a few links piled round the heap
        for (let i = 0; i < 4 * k; i++) pts.push({ x: heap.x + (i % 2 ? 2 : -2) * off, y: heap.y + (i % 3) - 1 });
        chainAlong(chainR, pts);
      }
    }
    chainR.end();
  };
  bg(run(sc, 160, (t) => drawSlack(quant(E.outCubic(t), 4))));

  // ---- VEIN PULSES, THE REACH
  const pulse = (i: number): Promise<void> => {
    playV3('e_axePulse', { volume: 0.75 + i * 0.1, pitch: 1 + i * 0.04, pan: panAt(bite.x) });
    cracks.glow(4);
    void lightFlash(sc, bite.x, bite.y - 8, PAL.fire3, 16 + i * 3, 220, { floorY: bite.y, intensity: 0.35 + i * 0.1 });
    const ring = Raster.around(sc, bite.x, bite.y, 60, 32, DEPTH.TILE_FX + 2);
    return run(sc, 200, (t, _e) => {
      const st2 = Math.floor(t * 4);
      axe.set({ pulse: Math.min(3, st2), heat: st2 < 2 ? 3 : 2 }).bury(bite.y);
      ring.begin();
      const r = 6 + st2 * 4 + i * 2;
      for (let a = 0; a < 48; a++) {
        const x = R(bite.x + Math.cos((a / 48) * Math.PI * 2) * r);
        const y = R(bite.y + Math.sin((a / 48) * Math.PI * 2) * r * 0.5);
        if (a % 3 !== 0) ring.px(x, y, [PAL.fire3, PAL.crim3, PAL.crim2, PAL.crim1][st2] ?? PAL.crim1);
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
  // the monster leans toward the axe, the veins climb it
  const rest = { x: s.x, y: s.y };
  const lean = side;
  bg(
    run(sc, T.reachMs, (t) => {
      if (u.retired || !s.active) return;
      const st2 = quant(E.outCubic(t), 2);
      s.setPosition(R(rest.x + lean * 2 * st2), R(rest.y + (st2 >= 1 ? 1 : 0)));
    }),
  );
  bg(rimClimb(sc, s, { ramp: VEIN_RIM, stepMs: 60, holdMs: 620, fadeMs: 160, from: 'feet' }));
  bg(pulse(1));
  await wait(sc, T.pulseEvery);

  // ---- THE WRENCH: the haft trembles harder, the chains pull taut to their pegs, the cracks run longer
  playV3('e_axeWrench', { volume: 0.95, pan: panAt(bite.x) });
  cracks.glow(4);
  await run(sc, T.wrenchMs, (t, el) => {
    const amp = t < 0.4 ? 1 : 2;
    const f = Math.floor(el / 34);
    const lift = R(t * 2); // it starts to come up
    axe.at(plantO.x + (f % 2 === 0 ? amp : -amp) * (f % 3 === 2 ? 0 : 1), plantO.y - lift).bury(bite.y).set({ heat: t > 0.6 ? 3 : 2, pulse: f % 4 });
    drawSlack(1, t, el);
    cracks.grow(1);
    if (!u.retired && s.active) s.setPosition(R(rest.x + lean * (2 + (f % 2))), R(rest.y + 1));
    if (rnd() < 0.3) sparks.add({ x: bite.x + (rnd() - 0.5) * 10, y: bite.y, vx: (rnd() - 0.5) * 30, vy: -30 - rnd() * 40, ay: 200, life: 240, colors: EMBER_DOWN, shape: 'px', fadeAt: 1 });
  });

  // ---- SNAP: the chains break, the axe tears out of the floor
  playV3('e_axeSnap', { volume: 1, pan: panAt(bite.x) });
  chainR.begin();
  chainR.end();
  for (const [heap, off] of [
    [heapA, -1],
    [heapB, 1],
  ] as const) {
    const mid = { x: R((pom.x + heap.x) / 2), y: R((pom.y + heap.y) / 2) };
    sparks.add({ x: mid.x, y: mid.y, life: 120, colors: [PAL.white, PAL.fire4], shape: 'star', fadeAt: 1 });
    for (let i = 0; i < fxCount(5); i++)
      sparks.add({ x: mid.x, y: mid.y, vx: off * (40 + rnd() * 70), vy: -40 - rnd() * 60, ay: 420, life: 360 + rnd() * 200, colors: [PAL.stone4, PAL.stone3, PAL.stone2], shape: 'sq', floor: bite.y + 8, bounce: 0.35, fadeAt: 1 });
  }
  for (let i = 0; i < fxCount(18); i++) {
    const a = Math.PI + rnd() * Math.PI;
    const v = 40 + rnd() * 100;
    const dirt = i % 2 === 0;
    sparks.add({ x: bite.x + (rnd() - 0.5) * 8, y: bite.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, ay: 420, drag: 1, life: 300 + rnd() * 260, colors: dirt ? [PAL.stone2, PAL.stone1, PAL.stone0] : EMBER, shape: dirt ? 'sq' : 'px', floor: bite.y + 4 + rnd() * 8, bounce: 0.3, fadeAt: 1 });
  }
  axe.set({ look: 'hot' }).bury(null);
  cracks.slit(true);
  void shake(sc, 120, 2);
  await freeze(sc, T.snapStop);
  axe.set({ look: 'plain', heat: 2 });
  bg(cracks.cool(520).then(() => cracks.destroy()));

  // ---- the arc up to the wielder's back, turning to the slung pose
  if (!u.retired && s.active) u.settle();
  const hp = holdPose(u.player);
  const hold = holdAt(u);
  const a0 = pp.angle;
  const dA = turn(pp.angle, hp.angle);
  const start = { x: plantO.x, y: plantO.y - 2 };
  const ctrl = { x: lerp(start.x, hold.x, 0.3), y: Math.min(start.y, hold.y) - 40 };
  let lastA = a0;
  await run(sc, T.pullMs, (t, _el, dt) => {
    const k = E.outCubic(t);
    const p = qbez(start, ctrl, hold, k);
    const a = a0 + dA * quant(k, 6);
    // the mirror flips halfway through the turn (a pre-drawn turn drawing seen from its other face)
    axe.set({ angle: a, mirror: t < 0.5 ? pp.mirror : hp.mirror }).at(p.x, p.y);
    axe.img.setDepth(t < 0.6 ? depthAxe : s.depth - 0.4);
    light.setPosition(p.x, p.y + 6, u.home.y);
    if (dt > 0 && rnd() < 0.8) sparks.add({ x: p.x, y: p.y + 4, vx: (rnd() - 0.5) * 20, vy: 10, ay: 120, life: 220, colors: EMBER_DOWN, shape: 'px', fadeAt: 1 });
    lastA = a;
  });
  void lastA;
  // into the slung small axe on a white-hot frame
  axe.set({ size: 'sm', angle: hp.angle, mirror: hp.mirror, look: 'hot' }).at(hold.x, hold.y);
  axe.img.setDepth(s.depth - 0.4);
  await frames(sc, 1);
  axe.destroy();
  void light.fadeOut(260);

  // ---- THE OATH: the eyes ignite, +800
  playV3('e_axeIgnite', { volume: 1, pan: panAt(home.x) });
  const alive = !u.retired && s.active;
  if (alive) {
    const aura = new AxeAura(sc, u, ev.spellUid, { eyeLvl: 3 });
    u.setAura('equip', aura);
    const eyes = aura.eyes();
    // a 4-ray star on the eyes
    if (eyes.length) {
      const e0 = eyes[0];
      const star = Raster.around(sc, e0.x, e0.y, 24, 24, s.depth + 0.7);
      bg(
        run(sc, 200, (t) => {
          const r = [2, 4, 5, 3, 1][Math.min(4, Math.floor(t * 5))];
          star.begin();
          for (let i = 1; i <= r; i++) {
            const c = i <= 1 ? PAL.white : i <= 3 ? PAL.fire4 : PAL.fire3;
            star.px(e0.x + i, e0.y, c);
            star.px(e0.x - i, e0.y, c);
            if (i <= r - 2) {
              star.px(e0.x, e0.y + i, c);
              star.px(e0.x, e0.y - i, c);
            }
          }
          star.end();
        }).then(() => star.destroy()),
      );
    }
    bg(wait(sc, 260).then(() => (aura.eyeLvl = 2)));
    bg(rimFlash(sc, s, { ramp: [PAL.fire4, PAL.fire3, PAL.fire3, PAL.fire2, PAL.crim2], hold: 2 }));
    void lightFlash(sc, home.x, home.y - 20, PAL.fire3, 20, 360, { floorY: home.y, intensity: 0.6 });
    if (st) {
      const delta = Math.abs(st.atk - st.prevAtk);
      const head = u.worldPoint('top');
      const nb = numberUnderBar(R(head.y) - 6);
      if (delta > 0) bg(impactNumber(sc, R(head.x - side * 30), nb.y, delta, { kind: st.atk >= st.prevAtk ? 'heal' : 'damage', rise: nb.rise }));
      void u.setStats(st.atk, st.def, true);
    }
  } else if (st) void u.setStats(st.atk, st.def, false);
  if (ci >= 0) ctx.consumeAt(ci);
  bg(wait(sc, 900).then(() => {
    fxr.destroy();
    chainR.destroy();
    sparks.release();
  }));
  await wait(sc, T.tail);
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

registerObserver((_ev, ctx) => {
  if (!LOOK_V3) return;
  try {
    ensureAuras(ctx);
  } catch (e) {
    console.error('[spite_axe] aura', e);
  }
});

/**
 * The axe's bonus taken back from a wielder still standing (its card left the field): the aura ends here (never
 * Ejder Kılıcı's sword break, which keys on the 'equip' aura), then the plain stat roll plays.
 */
registerEvent(
  'statChange',
  async (ctx) => {
    const e = ctx.ev as StatEv;
    if (LOOK_V3 && e.atk < e.prevAtk) {
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

registerCardHook(ID, 'destroyed', async (ctx: DestroyCtx) => {
  if (!LOOK_V3) return ctx.base();
  const ev = ctx.ev;
  if (ev.location !== 'spellTrap') return ctx.base();
  const sc = ctx.scene;
  const field = ctx.views.field;
  const { tile } = field.release(ev.uid);
  if (tile && tile.active) {
    const home = { x: R(tile.home.x), y: R(tile.home.y) };
    if (!tile.faceUp) {
      tile.setCard(ev.cardId);
      await tile.flipUp(150);
    }
    playV3('e_axeCard', { volume: 0.8, pan: panAt(home.x) });
    bg(tile.pulse(PAL.fire3, 180));
    void lightFlash(sc, home.x, home.y, PAL.fire3, 22, 300, { floorY: home.y, intensity: 0.6 });
    const crack = Raster.around(sc, home.x, home.y, 48, 28, tile.depth + 0.5);
    const path = crackPath({ x: home.x - 14, y: home.y - 3 }, { x: home.x + 14, y: home.y + 3 }, ev.uid * 3 + 1, 2);
    const rnd = fxRng(ev.uid * 5 + 2);
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
    await tile.dissolve(240);
    crack.destroy();
    tile.destroy();
  }
  field.forget(ev.uid);
});

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
  // a card tile still on the field (its destroy was presented by someone who left it): it crumbles now
  const left = field.release(ev.uid).tile;
  if (left && left.active) bg(left.dissolve(220).then(() => left.active && left.destroy()));
  field.forget(ev.uid);
  // where the axe is: slung on a standing wielder, fallen on the floor, or (unknown) over its owner's row
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
  else {
    const lp = LAST.get(ev.uid);
    const z = zoneXY(owner, 'spellTrap', 2);
    pose = lp ?? { x: R(z.x), y: R(z.y - 30), ...holdPose(owner), size: 'sm' };
  }
  const ci = wielder ? ctx.findType('statChange', (e) => e.uid === wielder!.uid && e.atk < e.prevAtk) : -1;
  const pile = field.pile(owner, 'deck');
  const deck = pile.topXY();
  const sparks = new PxSparks(sc, DEPTH.FX + 3);
  const axe = new AxeSprite(sc, { size: pose.size, angle: pose.angle, mirror: pose.mirror, heat: 2 }, pose.x, pose.y, wielder ? wielder.sprite.depth - 0.4 : DEPTH.UNIT + pose.y + 20);
  const ex = new Raster(sc, 0, 0, 640, 360, DEPTH.FX + 1);

  // ---- SLIP: it shudders, the eyes go out (a wisp of smoke), the −800
  playV3('e_axeSlip', { volume: 0.95, pan: panAt(pose.x) });
  if (ci >= 0) bg(ctx.play(ci));
  const back = wielder && wielder.player === 0 ? -1 : 1;
  let f = 0;
  await run(sc, RET.shudder, (t, _el, dt) => {
    if (dt > 0) f++;
    axe.at(pose.x + (f % 2 === 0 ? 1 : -1), pose.y).set({ pulse: Math.min(3, Math.floor(t * 4)) });
    ex.begin();
    // the eyes dying: ember → fire2 → a smoke pixel drifting up
    const lvl = t < 0.35 ? 2 : t < 0.7 ? 1 : 0;
    drawEyes(ex, eyes, back, lvl, f);
    if (lvl === 0) for (const e of eyes.slice(0, 2)) ex.px(e.x, e.y - 1 - Math.floor(t * 4), PAL.stone2);
    ex.end();
  });
  ex.begin();
  ex.end();
  // it drops out of the grip and tilts
  const tilt = pose.angle + (pose.mirror ? -15 : 15);
  await run(sc, RET.drop, (t) => axe.at(pose.x, pose.y + R(E.inQuad(t) * 4)).set({ angle: t > 0.5 ? tilt : pose.angle, pulse: -1 }));

  // ---- LAUNCH: an ember frame, the big drawing, a high arc to the deck, spinning, chains whipping
  playV3('e_axeFly', { volume: 0.95, pan: panAt(pose.x) });
  axe.set({ size: 'lg', look: 'ember' });
  axe.img.setDepth(DEPTH.FX + 2);
  await frames(sc, 1);
  axe.set({ look: 'plain' });
  const startP = { x: pose.x, y: pose.y + 4 };
  const deckMirror = owner === 1;
  const endA = 90;
  // the head (O) lands on the pile's top, the blade in it
  const slamO: XY = { x: R(deck.x), y: R(deck.y - 4) };
  const ctrl = { x: lerp(startP.x, slamO.x, 0.5), y: Math.min(startP.y, slamO.y) - 44 };
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
    const pom = axe.pt(-32, 0);
    trail.unshift(pom);
    if (trail.length > 10) trail.pop();
    ex.begin();
    // the chains whip behind: two strands along the recent path of the pommel, waving
    if (trail.length > 2)
      for (const off of [-2, 2]) {
        const pts = trail.map((q, i) => ({ x: q.x + off * Math.sin(el / 30 + i), y: q.y + off * Math.cos(el / 30 + i) }));
        chainAlong(ex, pts, 3, Math.floor(el / 40) % 6);
      }
    ex.end();
    // little white cracks along the chains
    if (dt > 0 && el - crackT > 90 && trail.length > 4) {
      crackT = el;
      const q = trail[3 + Math.floor(rnd() * Math.min(5, trail.length - 4))];
      sparks.add({ x: q.x, y: q.y, life: 90, colors: [PAL.white, PAL.fire4], shape: 'plus', fadeAt: 1 });
    }
  });
  ex.begin();
  ex.end();

  // ---- SLAM onto the deck pile
  playV3('e_axeDeck', { volume: 1, pan: panAt(slamO.x) });
  axe.set({ angle: endA, mirror: deckMirror, look: 'hot' }).at(slamO.x, slamO.y);
  void lightF.fadeOut(300);
  void lightFlash(sc, slamO.x, slamO.y, PAL.fire3, 22, 360, { floorY: R(deck.y + 4), intensity: 0.8 });
  void shake(sc, 120, 2);
  try {
    pile.set(pile.count + 1, pile.topCard);
    pile.bump();
  } catch {
    /* the sync fixes the pile anyway */
  }
  for (let i = 0; i < fxCount(18); i++) {
    const a = Math.PI + rnd() * Math.PI;
    const v = 40 + rnd() * 90;
    sparks.add({ x: slamO.x, y: slamO.y + 2, vx: Math.cos(a) * v, vy: Math.sin(a) * v, ay: 300, life: 260 + rnd() * 220, colors: EMBER, shape: i % 3 === 0 ? 'plus' : 'px', fadeAt: 1 });
  }
  await freeze(sc, RET.slamStop);
  axe.set({ look: 'plain', heat: 3 });
  // it sinks into the pile (cut from the bottom row up, ember)
  const pileTop = R(deck.y);
  bg(
    run(sc, RET.sinkMs, (t) => {
      const st2 = quant(t, 4);
      if (st2 >= 0.5) axe.set({ look: 'ember' });
      axe.at(slamO.x, slamO.y + R(st2 * 34)).bury(pileTop);
    }).then(() => axe.destroy()),
  );

  // ---- THE LASH: a chain whips from the pile to the owner's LP panel
  const lp = lpPoint(ctx, owner);
  const pr = panelRect(owner);
  const tip: XY = { x: R(lp.x), y: R(lp.y) };
  const root: XY = { x: R(deck.x), y: R(deck.y - 6) };
  const whip = new Raster(sc, 0, 0, 640, 360, DEPTH.HUD + 6);
  playV3('e_axeLash', { volume: 1, pan: panAt(tip.x) });
  const mid = { x: lerp(root.x, tip.x, 0.5), y: Math.min(root.y, tip.y) - 70 };
  const drawWhip = (pts: readonly XY[], hot: boolean): void => {
    whip.begin();
    // an ember line under the links (the chain is red-hot from the axe), then the iron links over it
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y)));
      for (let j = 0; j < n; j++) {
        const x = R(lerp(a.x, b.x, j / n));
        const y = R(lerp(a.y, b.y, j / n));
        whip.px(x, y + 1, PAL.ink);
        whip.px(x, y - 1, hot ? PAL.fire3 : PAL.fire1);
        whip.px(x, y, hot ? PAL.fire4 : PAL.fire2);
      }
    }
    chainAlong(whip, pts, 3);
    whip.end();
  };
  await run(sc, RET.lashMs, (t, el) => {
    const k = E.inQuad(t);
    const pts: XY[] = [];
    const n = 18;
    for (let i = 0; i <= n; i++) {
      const s2 = (i / n) * k;
      const p = qbez(root, mid, tip, s2);
      // a travelling wave along the chain, decaying toward the tip
      const w = Math.sin(s2 * 14 - el / 12) * 5 * (1 - s2);
      pts.push({ x: p.x, y: p.y + w });
    }
    drawWhip(pts, t > 0.7);
    const h = pts[pts.length - 1];
    sparks.add({ x: h.x, y: h.y, life: 80, colors: [PAL.fire4, PAL.fire3], shape: 'px', fadeAt: 1 });
  });
  // the CRACK on the panel
  const panel = new Raster(sc, pr.x - 6, pr.y - 6, pr.w + 12, pr.h + 12, DEPTH.HUD + 5.5);
  for (let i = 0; i < fxCount(16); i++) {
    const a = rnd() * Math.PI * 2;
    const v = 50 + rnd() * 110;
    sparks.add({ x: tip.x, y: tip.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, ay: 200, life: 220 + rnd() * 200, colors: EMBER, shape: i % 4 === 0 ? 'star' : 'px', fadeAt: 1 });
  }
  const sparkHud = new PxSparks(sc, DEPTH.HUD + 7);
  sparkHud.add({ x: tip.x, y: tip.y, life: 140, colors: [PAL.white, PAL.fire4, PAL.fire3], shape: 'star', fadeAt: 1 });
  sparkHud.release();
  void shake(sc, 140, 2);
  let dmg: Promise<void> = Promise.resolve();
  if (di >= 0 && !ctx.isConsumed(di)) dmg = ctx.play(di, { delivered: true });
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
  // the chain snaps back into the pile
  await run(sc, RET.backMs, (t, el) => {
    const k = 1 - E.outCubic(t);
    const pts: XY[] = [];
    const n = 14;
    for (let i = 0; i <= n; i++) {
      const s2 = (i / n) * k;
      const p = qbez(root, mid, tip, s2);
      pts.push({ x: p.x, y: p.y + Math.sin(s2 * 10 + el / 10) * 2 });
    }
    if (k > 0.05) drawWhip(pts, false);
    else {
      whip.begin();
      whip.end();
    }
  });
  whip.destroy();
  ex.destroy();
  sparks.release();
  await dmg;
}

void spriteBox;
