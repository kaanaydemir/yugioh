// Şafak Kılıçları (dawn_swords) — lane E's NEW SIGNATURE (v3 look only): THE GILDED DAWN CAGE.
// Owner decision 1 (docs/v3/YENI_KARTLAR.md, "Sahip kararları"): the dropped S6 Yaldızlı Kafes storyboard, adapted to
// this card — it locks ALL the opponent's monsters (and reveals the face-down ones) for three of their turns, so the
// cage stands over the opponent's WHOLE monster row; its camera-side bars are DAWN SWORDS planted tip-down, a dawn
// sun crowns it, a padlock with three TONGUES is the counter. The old look keeps the fence of six light blades
// (./_dawn_v3.ts, untouched). Drawings: ./_dawn_e_paint.ts. Sounds: src/audio/v3/e/dawn_swords.ts (e_dawn*).
//
// BEAT LIST (scene ms at 1×; game time ×1.35 with the v3 tempo). t = 0 is the frame the card lies flat on its zone.
// ACTIVATE (hook 'activate', after the common v3 spell opening ≈ 0.55 s and landV3):
//   0      OMEN: the cage's shadow falls on the opponent's row (stepped, 3 levels, darker as it nears); the chain
//          starts paying out — e_dawnChain (heavy links over the pulley ratchet, quickening)
//   0–270  THE DESCENT: the gilded cage drops from 170 px above (inQuad), on its chain from the top of the screen; its
//          sword bars still DULL (gold2 / gold1), the door hanging open and swinging 56 ↔ 70° as it falls
//   270    LAND: the foot rail hits the floor — 1 white frame on the whole cage, hit-stop 50 ms, 2-px shake, dust spurts
//          from under the front and side rails, gold sparks at the corner posts, a floor ring + flash, the chain's
//          links ring — e_dawnLand (iron gong, clank 2.3, the bars ringing on)
//   290–430 the cage bounces: −3, 0, −1, 0 px (34 ms steps)
//   400    THE DAWN: the sun on the crown ignites (white frame → lit, a light flash, its gold pool) — e_dawnSun; the
//          LIGHT RUNS DOWN THE SWORD BARS one after another, left → right (≤ 26 ms apart, the spread capped at 300 ms;
//          130 ms each: a white head with gold4 halo pixels, the crossguard flaring as it starts, a spark as the tip
//          meets the rail): each blade turns from dull to bright gold behind it; a gold floor light walks along the
//          row; every FACE-DOWN monster flips face-up as the light reaches its lane (a white-gold ring on its tile;
//          the engine's own flip presentation, ctx.play — cause 'reveal', no flip effect)
//   760    THE DOOR swings shut (70 → 0°, its 6 drawings, 110 ms, accelerating) …
//   870    … SLAM: the door's white frame, hit-stop 50 ms, 1-px shake, the front bars RATTLE (±1 px, 3 frames), sparks
//          burst from the latch, a gold flash — e_dawnSlam
//   910    CAGED: every monster in the row goes COLD — a cold edge light (water2 → water4) drains down it from the head;
//          cold light pools fade in under the lanes; the monsters LEAN on the front bars (1 → 2 px toward the camera
//          side, stepped; the bar touched flashes white) and ease back — e_dawnCold
//   930    THE PADLOCK drops 10 px onto the latch with its shackle open (80 ms) and SNAPS shut (white frame, a twinkle,
//          a 4-step bob) — e_dawnShackle
//   1080   the three TONGUES light one by one (60 ms apart, a twinkle on each) — e_dawnTongue ×3 up the G ladder
//   1200   the small padlock badge pops onto the lying spell card — e_dawnBadge
//   1310   the input returns (≈ 1.3 s of signature + two 50-ms hit-stops)
// IDLE (as long as the card is on the field): the sun's rays twinkle (cross ↔ diagonal), a glint runs down one sword
//   now and then, a light climbs the chain, cold breath rises from the floor inside, a gold mote drifts down from
//   the sun; the light pools breathe.
// COUNTER (each end of the opponent's turn; 'counter' event): the right-most lit TONGUE turns (white → half turned →
//   flat and dark, 50 ms steps), the lock jolts 1 px and swings ±1 px, a gold ring spreads from the lock, the sun
//   flares, the badge's pip turns too — e_dawnTick (three ratchet ticks + the church bell G4). ≈ 0.55 s.
// LAST (counter 1 → 0): the last tongue turns — e_dawnLast (the bell low on D4) → +300 the padlock SPRINGS OPEN and
//   drops to the floor, two bounces, clatter — e_dawnUnlock → the door swings open, the sun goes cold, the cold
//   pools fade → +620 the cage is HAULED UP out of the top (inCubic, 420 ms), dust spurts where its rail leaves the
//   floor — e_dawnHaul. The card then leaves for the graveyard ('destroyed', reason 'rule').
// EARLY DESTRUCTION ('destroyed' while the counter is still > 0: Arınma Dalgası …): its own break — two white frames,
//   the chain SNAPS and whips up out of the screen, the sword bars burst into gold shards, the frame drops 1 → 6 px
//   and breaks into a shower of gilded pieces, the padlock falls — e_dawnBreak. ≈ 0.6 s.
// OBSERVER: a staged / restored board shows the cage at once (its padlock reads the counter); a cage whose card is
//   gone is removed.
//
// Everything on scene time (speed / hit-stop aware), whole pixels, palette tones, no camera move.

import Phaser from 'phaser';
import type { GameEvent, PlayerId, Uid } from '../../engine/types';
import { other } from '../../engine/types';
import { PAL } from '../../art/palette';
import type { Motif } from '../../art/spellmotifs-v3';
import { DEPTH, TILE_W, LANE_COLS, unitDepth, zoneXY, type XY } from '../../view/layout';
import { TEX, shake, wait } from '../../vfx/core';
import { E, Raster, Sparks, floorRing, freeze, lerp, onFrame, rnd, rr, run } from '../../vfx/setpieces';
import { fxCount, motifTexture, rimClimb } from '../_v3/spellfx';
import { panAt, play as playV3 } from '../_v3/sound';
import { cardLeaves } from '../_v3/card';
import { fx, type CinematicContext } from '../api';
import type { TileCard } from '../../view/TileCard';
import { bg, evAt, ip, lightFlash, lightPool, relax, setTileOf, spellOpening, type LightHandle } from './_kit';
import { dawnCasting, resolutionParts } from './_dawn_v3';
import {
  BADGE_H,
  BADGE_W,
  CHAIN_W,
  DOOR_ANGLES,
  LOCK_AX,
  LOCK_AY,
  LOCK_H,
  LOCK_W,
  SUN_C,
  SUN_H,
  SUN_W,
  cageGeo,
  cp,
  footprint,
  frontFoot,
  lockAt,
  paintBack,
  paintBadge,
  paintChain,
  paintDoor,
  paintFront,
  paintLock,
  paintSun,
  sunAt,
  type CageGeo,
} from './_dawn_e_paint';

type AnyCtx = CinematicContext<GameEvent>;
type ActCtx = CinematicContext<Extract<GameEvent, { type: 'activate' }>>;
type CounterCtx = CinematicContext<Extract<GameEvent, { type: 'counter' }>>;
type DestroyCtx = CinematicContext<Extract<GameEvent, { type: 'destroy' }>>;

const R = Math.round;
const ID = 'dawn_swords';

/** The scene's timings (ms at 1×, scene time). */
export const CAGE_T = Object.freeze({
  openHold: 100,
  /** The descent: its length and its height. */
  drop: 270,
  fallH: 170,
  /** The landing's hit-stop and the bounce steps. */
  landStop: 50,
  bounce: [-3, 0, -1, 0] as readonly number[],
  bounceStep: 34,
  /** The sun ignites (after the land frame) and the light runs down each sword. */
  sunAt: 110,
  runStagger: 26,
  /** The whole run's stagger spread is capped (a 5-lane cage has 16 sword bars). */
  runSpread: 300,
  runMs: 130,
  /** The door starts to swing shut (after the land frame) and its swing. */
  doorAt: 470,
  swing: 110,
  slamStop: 50,
  /** After the slam: the padlock drops, the tongues light, the cold, the badge, the end. */
  lockAt: 60,
  lockDrop: 80,
  tongue0: 210,
  tongueGap: 60,
  coldAt: 40,
  badgeAt: 330,
  endAt: 440,
  /** A counter, the last counter and the haul, the break. */
  tickMs: 520,
  springAt: 300,
  haulAt: 620,
  haul: 420,
  breakMs: 620,
});

/**
 * The impact frame of the big layers (land, break): every tone steps up to gold4 — a blazing pale-gold cage, not a
 * solid white block (EF-4: the white share of the frame stays small); the white goes only where the blow lands.
 */
const flashTone = (c: number): number => (c === PAL.ink ? c : PAL.gold4);

const DIM_KEY = { blade: [PAL.gold2, PAL.gold1] as const, lit: [PAL.gold4, PAL.gold3] as const };

// ================================================================ registry

const cages = new WeakMap<Phaser.Scene, Map<Uid, DawnCage>>();

/** The live cage of a spell uid, or null. */
export function cageOf(scene: Phaser.Scene, uid: Uid): DawnCage | null {
  const c = cages.get(scene)?.get(uid) ?? null;
  if (c && !c.alive) {
    cages.get(scene)?.delete(uid);
    return null;
  }
  return c;
}

export function allCages(scene: Phaser.Scene): DawnCage[] {
  const m = cages.get(scene);
  if (!m) return [];
  for (const [u, c] of [...m]) if (!c.alive) m.delete(u);
  return [...m.values()];
}

// ================================================================ textures

const motif = (px: () => import('../../art/pixel').PixelCanvas, ax = 0, ay = 0) => (): Motif => ({ px: px(), ax, ay });

function geoKey(g: CageGeo): string {
  return `dawnE:${g.target}:${TILE_W}:${LANE_COLS.join('')}`;
}

/** The front layer with its blades dull (`lit` false) or bright; `white` = the land frame. */
function frontTex(sc: Phaser.Scene, g: CageGeo, lit: boolean, white = false): string {
  return motifTexture(sc, `${geoKey(g)}:front:${lit ? 1 : 0}:${white ? 1 : 0}`, motif(() => {
    const p = paintFront(g);
    const [a, b] = lit ? DIM_KEY.lit : DIM_KEY.blade;
    // the blades are painted white / gold3: repaint them dull or bright (the sun lights them)
    const n = g.bars.length - 1;
    for (let k = 1; k < n; k++) {
      if (k === g.kc || k === g.kh || k === g.kl) continue;
      const f = frontFoot(g, k);
      for (let h = 2; h < g.H - 9; h++) {
        const y = f.y - h - g.oy;
        if (p.get(f.x - g.ox, y) === PAL.white || p.get(f.x - g.ox, y) === PAL.gold4) p.set(f.x - g.ox, y, h > g.H - 13 && lit ? PAL.white : a);
        if (p.get(f.x + 1 - g.ox, y) === PAL.gold3) p.set(f.x + 1 - g.ox, y, b);
      }
    }
    if (white) p.map(flashTone);
    return p;
  })).key;
}

function backTex(sc: Phaser.Scene, g: CageGeo, white = false): string {
  return motifTexture(sc, `${geoKey(g)}:back:${white ? 1 : 0}`, motif(() => {
    const p = paintBack(g);
    if (white) p.map(flashTone);
    return p;
  })).key;
}

function doorTex(sc: Phaser.Scene, g: CageGeo, deg: number, lit: boolean, white = false): string {
  return motifTexture(sc, `${geoKey(g)}:door:${deg}:${lit ? 1 : 0}:${white ? 1 : 0}`, motif(() => {
    const p = paintDoor(g, deg, white);
    if (!lit && !white) p.map((c) => (c === PAL.white ? PAL.gold2 : c === PAL.gold3 ? PAL.gold1 : c === PAL.gold4 ? PAL.gold2 : c));
    return p;
  })).key;
}

function lockTex(sc: Phaser.Scene, lit: number, o: { turning?: number; open?: boolean; white?: boolean } = {}): { key: string; ox: number; oy: number } {
  const t = motifTexture(sc, `dawnE:lock:${lit}:${o.turning ?? -1}:${o.open ? 1 : 0}:${o.white ? 1 : 0}`, motif(() => paintLock(lit, o), LOCK_AX, LOCK_AY));
  return { key: t.key, ox: t.ax / t.w, oy: t.ay / t.h };
}

function badgeTex(sc: Phaser.Scene, lit: number, o: { turning?: number; white?: boolean } = {}): string {
  return motifTexture(sc, `dawnE:badge:${lit}:${o.turning ?? -1}:${o.white ? 1 : 0}`, motif(() => paintBadge(lit, o), 6, 7)).key;
}

function sunTex(sc: Phaser.Scene, lit: number, phase: number, white = false): string {
  return motifTexture(sc, `dawnE:sun:${lit}:${phase}:${white ? 1 : 0}`, motif(() => paintSun(lit, phase, white), SUN_C, SUN_C)).key;
}

function chainTex(sc: Phaser.Scene, len: number): string {
  return motifTexture(sc, `dawnE:chain:${len}`, motif(() => paintChain(len), 3, len - 1)).key;
}

// ================================================================ the cage (a persistent view)

export class DawnCage {
  readonly g: CageGeo;
  readonly target: PlayerId;
  /** The back layer, cut in vertical strips per lane (each strip sorts with its own lane: a long cage is not one depth). */
  private backs: Phaser.GameObjects.Image[] = [];
  private front: Phaser.GameObjects.Image;
  private door: Phaser.GameObjects.Image;
  private lock: Phaser.GameObjects.Image;
  private sun: Phaser.GameObjects.Image;
  private chain: Phaser.GameObjects.Image;
  private badge: Phaser.GameObjects.Image | null = null;
  private glint: Phaser.GameObjects.Image;
  private chainGlint: Phaser.GameObjects.Image;
  private sunPool: LightHandle | null = null;
  private coldPools: LightHandle[] = [];
  private motes: Sparks | null = null;
  private stopIdle: (() => void) | null = null;
  private dead = false;
  /** Current vertical offset of the whole cage (px; negative = up), its door angle, the lit tongues. */
  dy = 0;
  private dx = 0;
  doorDeg = 0;
  private bladesLit = true;
  private sunLit = 1;
  private sunPhase = 0;
  lit = 3;
  private lockShown = true;
  private lockDx = 0;
  private lockDy = 0;
  private badgeY = 0;
  /** An animation of this cage is running (the observer leaves it alone). */
  busy = 0;
  /** The spell tile (for the badge). */
  tileRef: TileCard | null = null;
  readonly depthBack: number;
  readonly depthFront: number;

  constructor(
    readonly scene: Phaser.Scene,
    readonly uid: Uid,
    readonly owner: PlayerId,
    readonly zone: number,
  ) {
    let m = cages.get(scene);
    if (!m) {
      m = new Map();
      cages.set(scene, m);
      scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => cages.delete(scene));
    }
    m.get(uid)?.destroy();
    m.set(uid, this);
    this.target = other(owner);
    const g = (this.g = cageGeo(this.target));
    const feet = LANE_COLS.map((_, i) => zoneXY(this.target, 'monster', i).y);
    this.depthBack = unitDepth(Math.min(...feet)) - 0.5;
    this.depthFront = unitDepth(Math.max(...feet)) + 0.5;
    const add = (key: string, d: number) => scene.add.image(0, 0, key).setOrigin(0, 0).setDepth(d).setVisible(false);
    // strip k covers lane k's back bars; it sorts just behind the lane before it (whose sprite cannot reach it)
    const xs = LANE_COLS.map((_, i) => zoneXY(this.target, 'monster', i));
    const order = xs.map((p, i) => ({ p, i })).sort((a, b) => a.p.x - b.p.x);
    order.forEach((o, j) => {
      const x0 = j === 0 ? g.ox : o.p.x - 4;
      const x1 = j === order.length - 1 ? g.ox + g.w : order[j + 1].p.x - 4;
      const prev = j === 0 ? o.p.y : Math.min(o.p.y, order[j - 1].p.y);
      const img = add(backTex(scene, g), Math.min(unitDepth(prev), unitDepth(o.p.y)) - 0.5);
      img.setCrop(x0 - g.ox, 0, x1 - x0, g.h);
      img.setData('crop', [x0 - g.ox, x1 - x0]);
      this.backs.push(img);
    });
    this.front = add(frontTex(scene, g, true), this.depthFront);
    this.door = add(doorTex(scene, g, 0, true), this.depthFront + 0.1);
    const lt = lockTex(scene, 3);
    this.lock = scene.add.image(0, 0, lt.key).setOrigin(lt.ox, lt.oy).setDepth(this.depthFront + 0.2).setVisible(false);
    this.sun = scene.add.image(0, 0, sunTex(scene, 1, 0)).setOrigin(SUN_C / SUN_W, SUN_C / SUN_H).setDepth(this.depthFront + 0.05).setVisible(false);
    const s = sunAt(g);
    const len = s.y - 7 + 12 + CAGE_T.fallH + 20;
    this.chain = scene.add.image(0, 0, chainTex(scene, len)).setOrigin(3 / CHAIN_W, (len - 1) / len).setDepth(this.depthFront + 0.04).setVisible(false);
    this.glint = scene.add.image(0, 0, TEX.px1).setTintFill(PAL.white).setDepth(this.depthFront + 0.06).setVisible(false);
    this.chainGlint = scene.add.image(0, 0, TEX.px1).setTintFill(PAL.white).setDepth(this.depthFront + 0.06).setVisible(false);
    this.place();
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  get alive(): boolean {
    return !this.dead && this.front.active;
  }

  // ---------------------------------------------------------------- placing

  private place(): void {
    const g = this.g;
    const x = g.ox + this.dx;
    const y = g.oy + R(this.dy);
    for (const b of this.backs) b.setPosition(g.ox, y);
    this.front.setPosition(x, y);
    this.door.setPosition(x, y);
    const s = sunAt(g);
    this.sun.setPosition(s.x, s.y + R(this.dy));
    this.chain.setPosition(s.x, s.y - 10 + R(this.dy));
    const l = lockAt(g);
    this.lock.setPosition(l.x + this.dx + this.lockDx, l.y + R(this.dy) + this.lockDy);
  }

  private show(on: boolean): void {
    for (const i of [...this.backs, this.front, this.door, this.sun, this.chain]) i.setVisible(on);
    this.lock.setVisible(on && this.lockShown);
  }

  private setDoor(deg: number, white = false): void {
    // the nearest drawing
    let best: number = DOOR_ANGLES[0];
    for (const a of DOOR_ANGLES) if (Math.abs(a - deg) < Math.abs(best - deg)) best = a;
    this.doorDeg = best;
    this.door.setTexture(doorTex(this.scene, this.g, best, this.bladesLit && best === 0, white));
  }

  private setLock(lit: number, o: { turning?: number; open?: boolean; white?: boolean } = {}): void {
    const t = lockTex(this.scene, lit, o);
    this.lock.setTexture(t.key).setOrigin(t.ox, t.oy);
  }

  private setSun(lit: number, white = false): void {
    this.sunLit = lit;
    this.sun.setTexture(sunTex(this.scene, lit, this.sunPhase, white));
  }

  private setWhite(on: boolean): void {
    for (const b of this.backs) {
      const [cx, cw] = b.getData('crop') as [number, number];
      b.setTexture(backTex(this.scene, this.g, on)).setCrop(cx, 0, cw, this.g.h);
    }
    this.front.setTexture(frontTex(this.scene, this.g, this.bladesLit, on));
    this.setDoor(this.doorDeg, on);
  }

  // ---------------------------------------------------------------- lights and idle life

  private lightsOn(ms: number): void {
    const sc = this.scene;
    const s = sunAt(this.g);
    if (!this.sunPool) {
      this.sunPool = lightPool(sc, s.x, s.y, { color: PAL.gold3, radius: 22, floorY: cp(this.g.cm, this.g.rm, 0).y, air: 0.5, airRadius: 12, intensity: 0, anim: 'breathe', fadeIn: 0 });
      this.sunPool.setIntensity(0.7, ms);
    }
    this.coldOn(ms);
  }

  private coldOn(ms: number): void {
    if (this.coldPools.length) return;
    const sc = this.scene;
    LANE_COLS.forEach((_, i) => {
      const z = zoneXY(this.target, 'monster', i);
      const h = lightPool(sc, z.x, z.y - 10, { color: PAL.water3, radius: 20, floorY: z.y, air: 0.25, airRadius: 10, intensity: 0, anim: 'breathe', fadeIn: 0 });
      h.setIntensity(0.45, ms);
      this.coldPools.push(h);
    });
  }

  private coldOff(ms: number): void {
    for (const h of this.coldPools) void h.fadeOut(ms);
    this.coldPools = [];
  }

  private startIdle(): void {
    if (this.stopIdle || this.dead) return;
    const sc = this.scene;
    const g = this.g;
    this.motes = new Sparks(sc, this.depthFront + 0.07);
    const swords: number[] = [];
    for (let k = 1; k < g.bars.length - 1; k++) if (k !== g.kc && k !== g.kh && k !== g.kl) swords.push(k);
    let nextGlint = 300;
    let glintAt = -1;
    let glintK = swords[0];
    let nextChain = 900;
    let chainAt = -1;
    let nextCold = 120;
    let nextMote = 500;
    this.stopIdle = onFrame(sc, (_dt, el) => {
      if (this.dead) return false;
      if (this.busy > 0 && this.dy !== 0) {
        this.glint.setVisible(false);
        return true;
      }
      // the sun's rays twinkle
      const ph = Math.floor(el / 260) % 2;
      if (ph !== this.sunPhase && this.sunLit > 0) {
        this.sunPhase = ph;
        this.setSun(this.sunLit);
      }
      // a glint runs down one sword's bright edge (7 steps × 30 ms)
      if (el >= nextGlint && this.bladesLit) {
        glintAt = el;
        glintK = swords[Math.floor(rnd() * swords.length) % swords.length];
        nextGlint = el + 620 + rnd() * 520;
      }
      if (glintAt >= 0 && el - glintAt < 240) {
        const f = frontFoot(g, glintK);
        const span = g.H - 13;
        const row = Math.floor(((el - glintAt) / 240) * span);
        this.glint.setVisible(true).setPosition(f.x + this.dx, f.y - (g.H - 11) + row + R(this.dy));
      } else this.glint.setVisible(false);
      // a light climbs the chain
      if (el >= nextChain) {
        chainAt = el;
        nextChain = el + 1300 + rnd() * 700;
      }
      if (chainAt >= 0 && el - chainAt < 400) {
        const s = sunAt(g);
        const up = Math.floor(((el - chainAt) / 400) * 40);
        this.chainGlint.setVisible(true).setPosition(s.x - 1 + (Math.floor(up / 5) % 2 ? 1 : 0), s.y - 9 - up + R(this.dy));
      } else this.chainGlint.setVisible(false);
      // cold breath rising from the floor inside the cage
      if (el >= nextCold) {
        nextCold = el + 170 + rnd() * 140;
        const i = Math.floor(rnd() * LANE_COLS.length) % LANE_COLS.length;
        const z = zoneXY(this.target, 'monster', i);
        this.motes?.add({ x: z.x + rr(-14, 14), y: z.y + rr(-3, 4), vy: -rr(6, 12), life: rr(600, 900), ramp: [PAL.water4, PAL.water3, PAL.water2, PAL.water1], wobble: 5, wobbleHz: 0.8, fade: 0.45 });
      }
      // a gold mote drifts down from the sun
      if (el >= nextMote && this.sunLit > 0) {
        nextMote = el + 700 + rnd() * 500;
        const s = sunAt(g);
        this.motes?.add({ x: s.x + rr(-4, 4), y: s.y + 4, vy: rr(8, 14), vx: rr(-4, 4), life: rr(700, 1000), ramp: [PAL.gold4, PAL.gold3, PAL.gold2, PAL.gold1], wobble: 4, fade: 0.4 });
      }
      return true;
    });
  }

  // ---------------------------------------------------------------- the badge over the spell card

  private badgeSpot(): XY {
    const t = this.tileRef && this.tileRef.active ? this.tileRef : null;
    const h = t ? ip(t.home) : zoneXY(this.owner, 'spellTrap', this.zone);
    return { x: h.x, y: h.y - 3 };
  }

  private setBadge(n: number, pop = false, o: { turning?: number; white?: boolean } = {}): void {
    if (this.dead) return;
    if (n <= 0 && o.turning === undefined) {
      this.badge?.destroy();
      this.badge = null;
      return;
    }
    const key = badgeTex(this.scene, n, o);
    const at = this.badgeSpot();
    this.badgeY = at.y;
    if (!this.badge || !this.badge.active) {
      this.badge = this.scene.add.image(at.x, at.y, key).setOrigin(6 / BADGE_W, 7 / BADGE_H).setDepth(DEPTH.CARD_ON_TILE + 6);
      if (pop) {
        const b = this.badge;
        b.setY(at.y + 4).setTexture(badgeTex(this.scene, n, { white: true }));
        void run(this.scene, 150, (t) => {
          if (!b.active) return;
          b.setY(R(lerp(at.y + 4, at.y, E.outBack(t)) - Math.sin(t * Math.PI) * 3));
          if (t > 0.22) b.setTexture(key);
        }).then(() => b.active && b.setTexture(badgeTex(this.scene, this.lit)));
      }
    } else this.badge.setTexture(key);
  }

  // ---------------------------------------------------------------- the activation

  /**
   * The whole signature from the frame the card lies flat: descent, land, the dawn run (`onReach(lane)` fires as
   * the light reaches a lane: the reveal flips), the door, the padlock, the cold. Resolves at the end.
   */
  async cast(o: { lit: number; onReach?: (zone: number) => void; units: () => Phaser.GameObjects.Sprite[] }): Promise<void> {
    this.busy++;
    const sc = this.scene;
    const g = this.g;
    const T = CAGE_T;
    try {
      this.lit = o.lit;
      this.bladesLit = false;
      this.front.setTexture(frontTex(sc, g, false));
      this.setSun(0);
      this.lockShown = false;
      this.dy = -T.fallH;
      this.setDoor(70);
      this.place();
      this.show(true);
      const mid = cp(g.cm, g.rm, 0);
      // ---- OMEN + DESCENT
      playV3('e_dawnChain', { volume: 0.8, pan: panAt(mid.x) });
      const shadow = new Raster(sc, g.ox, g.oy, g.w, g.h, DEPTH.SHADOW + 1);
      const fp = footprint(g);
      const drawShadow = (lvl: number) =>
        shadow.draw((r) => {
          r.poly(fp, PAL.night0, lvl);
        });
      await run(sc, T.drop, (t) => {
        const k = E.inQuad(t);
        this.dy = -T.fallH * (1 - k);
        // the door swings as it falls
        this.setDoor(t < 0.5 ? 56 + 14 * Math.round(Math.sin(t * 12) * 0.5 + 0.5) : 70);
        this.place();
        drawShadow(t < 0.4 ? 0.25 : t < 0.8 ? 0.5 : 0.75);
      });
      // ---- LAND
      this.dy = 0;
      this.setDoor(70);
      this.place();
      shadow.destroy();
      playV3('e_dawnLand', { volume: 0.95, pan: panAt(mid.x) });
      this.setWhite(true);
      // the white-hot line where the foot rail strikes the floor (front and right sides)
      const hit = new Raster(sc, g.ox, g.oy, g.w, g.h, this.depthFront + 0.02);
      hit.draw((r) => {
        r.line(cp(g.c0, g.rB, 0).x, cp(g.c0, g.rB, 0).y, cp(g.c1, g.rB, 0).x, cp(g.c1, g.rB, 0).y, PAL.white);
        r.line(cp(g.c1, g.rB, 0).x, cp(g.c1, g.rB, 0).y, cp(g.c1, g.rA, 0).x, cp(g.c1, g.rA, 0).y, PAL.white);
      });
      this.landDust();
      void lightFlash(sc, mid.x, mid.y, PAL.gold2, 44, 300, { floorY: mid.y, intensity: 0.5 });
      bg(shake(sc, 140, 2));
      await freeze(sc, T.landStop);
      await wait(sc, 17);
      hit.destroy();
      this.setWhite(false);
      this.setDoor(70);
      // the bounce
      bg((async () => {
        for (const b of T.bounce) {
          await wait(sc, T.bounceStep);
          if (this.dead) return;
          this.dy = b;
          this.place();
        }
      })());
      await wait(sc, T.sunAt);
      // ---- THE DAWN: the sun ignites, the light runs down the swords
      playV3('e_dawnSun', { volume: 0.85, pan: panAt(mid.x) });
      this.setSun(1, true);
      bg(wait(sc, 34).then(() => this.alive && this.setSun(1)));
      this.lightsOnSun();
      const runP = this.dawnRun(o.onReach);
      await wait(sc, T.doorAt - T.sunAt);
      await runP;
      // ---- THE DOOR swings shut … SLAM
      const d0 = this.doorDeg;
      await run(sc, T.swing, (t) => {
        this.setDoor(d0 * (1 - E.inQuad(t)));
        this.place();
      });
      this.setDoor(0, true);
      playV3('e_dawnSlam', { volume: 1, pan: panAt(lockAt(g).x) });
      this.slamSparks();
      bg(shake(sc, 100, 1));
      await freeze(sc, T.slamStop);
      this.setDoor(0);
      bg(this.rattle(3));
      // ---- after the slam: cold, padlock, tongues, badge
      const after = (ms: number, fn: () => void | Promise<void>) => wait(sc, ms).then(() => (this.dead ? undefined : fn()));
      const jobs: Promise<unknown>[] = [];
      jobs.push(after(T.coldAt, () => this.cold(o.units())));
      jobs.push(after(T.lockAt, () => this.dropLock(o.lit)));
      for (let i = 0; i < o.lit; i++) {
        jobs.push(
          after(T.tongue0 + i * T.tongueGap, () => {
            playV3('e_dawnTongue', { volume: 0.6, pitch: [1, 1.122, 1.335][i], pan: panAt(lockAt(g).x) });
            this.setLock(i + 1);
            this.twinkle(lockAt(g).x - 4 + i * 4, lockAt(g).y + 10);
          }),
        );
      }
      jobs.push(
        after(T.badgeAt, () => {
          playV3('e_dawnBadge', { volume: 0.5, pan: panAt(this.badgeSpot().x) });
          this.setBadge(o.lit, true);
        }),
      );
      await wait(sc, T.endAt);
      await Promise.all(jobs);
      this.startIdle();
    } finally {
      this.busy--;
    }
  }

  private lightsOnSun(): void {
    const s = sunAt(this.g);
    void lightFlash(this.scene, s.x, s.y, PAL.gold4, 30, 260, { floorY: cp(this.g.cm, this.g.rm, 0).y, intensity: 0.8, air: 0.6 });
    this.lightsOn(260);
    // remove the cold pools for now: they come with the cold beat
    this.coldOff(0);
  }

  /** The dust and sparks of the landing: along the front and right foot rails, gold sparks at the posts. */
  private landDust(): void {
    const sc = this.scene;
    const g = this.g;
    const sp = new Sparks(sc, this.depthFront + 0.08);
    const pts: XY[] = [];
    for (let k = 0; k < g.bars.length; k += 2) pts.push(cp(g.bars[k], g.rB, 0));
    for (const r of g.sideRows) pts.push(cp(g.c1, r, 0));
    for (const p of pts) {
      for (let i = 0; i < fxCount(2); i++) {
        sp.add({ x: p.x + rr(-2, 2), y: p.y + 1, vx: rr(-30, 20), vy: -rr(8, 26), ay: 40, drag: 2, life: rr(260, 420), ramp: [PAL.stone4, PAL.stone3, PAL.stone2, PAL.stone1], fade: 0.5 });
      }
    }
    for (const c of [cp(g.c0, g.rB, 0), cp(g.c1, g.rB, 0), cp(g.c1, g.rA, 0)]) {
      for (let i = 0; i < fxCount(4); i++) {
        const side = i % 2 ? 1 : -1;
        sp.add({ x: c.x + side, y: c.y - 1, vx: side * rr(20, 50), vy: -rr(30, 60), ay: 180, life: rr(220, 340), ramp: [PAL.white, PAL.gold4, PAL.gold3, PAL.gold2], tex: i === 0 ? TEX.plus : TEX.px1, fade: 0.4 });
      }
    }
    sp.close();
    bg(floorRing(sc, cp(g.cm, g.rm, 0).x, cp(g.cm, g.rm, 0).y, { r0: 20, r1: R(((g.c1 - g.c0) * TILE_W) / 2 + 10), ms: 260, ramp: [PAL.gold4, PAL.gold3, PAL.gold2, PAL.gold1], depth: DEPTH.TILE_FX + 2 }));
  }

  /**
   * The dawn light runs down the sword bars left → right; the blades turn bright behind it. `onReach(zone)` fires
   * when the run passes a lane's centre.
   */
  private async dawnRun(onReach?: (zone: number) => void): Promise<void> {
    const sc = this.scene;
    const g = this.g;
    const T = CAGE_T;
    const ras = new Raster(sc, g.ox, g.oy - 4, g.w, g.h + 4, this.depthFront + 0.03);
    const ks: number[] = [];
    for (let k = 1; k < g.bars.length - 1; k++) if (k !== g.kc && k !== g.kh && k !== g.kl) ks.push(k);
    const stagger = Math.min(T.runStagger, T.runSpread / Math.max(1, ks.length - 1));
    const total = (ks.length - 1) * stagger + T.runMs;
    const reached = new Set<number>();
    const floor = lightPool(sc, cp(g.c0, g.rm, 0).x, cp(g.c0, g.rm, 0).y - 8, { color: PAL.gold4, radius: 26, floorY: cp(g.c0, g.rm, 0).y, air: 0.3, intensity: 0.9, fadeIn: 60 });
    const sp = new Sparks(sc, this.depthFront + 0.08);
    let lastSpark = -1;
    await run(sc, total, (_t, el) => {
      const colNow = g.c0 + ((g.c1 - g.c0) * Math.min(1, el / total)) * 1.0;
      const fl = cp(colNow, g.rm, 0);
      floor.setPosition(fl.x, fl.y - 8, fl.y);
      LANE_COLS.forEach((_c, i) => {
        // the lane's zone (P2's zones run right → left): reached when the light, on the same row, passes its x
        const z = zoneXY(this.target, 'monster', i);
        if (!reached.has(i) && fl.x >= z.x - 3) {
          reached.add(i);
          bg(floorRing(sc, z.x, z.y, { r0: 4, r1: 22, ms: 240, ramp: [PAL.white, PAL.gold4, PAL.gold3, PAL.gold2], depth: DEPTH.TILE_FX + 2 }));
          onReach?.(i);
        }
      });
      ras.draw((r) => {
        ks.forEach((k, j) => {
          const t0 = j * stagger;
          const u = (el - t0) / T.runMs;
          if (u < 0) return;
          const f = frontFoot(g, k);
          const top = g.H - 10;
          const head = u >= 1 ? 2 : R(top - (top - 2) * E.inQuad(Math.min(1, u)));
          // the lit blade behind the head
          for (let h = head; h <= top; h++) {
            r.px(f.x, f.y - h, h > g.H - 13 ? PAL.white : PAL.gold4);
            r.px(f.x + 1, f.y - h, PAL.gold3);
          }
          if (u < 1) {
            // the head: 2 white pixels wide, 2 rows, a gold4 halo pixel either side
            r.px(f.x, f.y - head, PAL.white);
            r.px(f.x + 1, f.y - head, PAL.white);
            r.px(f.x, f.y - head + 1, PAL.white);
            r.px(f.x + 1, f.y - head + 1, PAL.white);
            r.px(f.x - 1, f.y - head, PAL.gold4);
            r.px(f.x + 2, f.y - head, PAL.gold4);
            // the crossguard flares on the run's first frames
            if (u < 0.25) for (let x = -2; x <= 3; x++) r.px(f.x + x, f.y - (g.H - 9), PAL.white);
          } else if (u < 1.3) {
            // the tip touches the rail: a spark
            if (lastSpark !== k) {
              lastSpark = k;
              sp.add({ x: f.x, y: f.y - 2, vx: rr(-20, 20), vy: -rr(20, 40), ay: 120, life: rr(160, 260), ramp: [PAL.white, PAL.gold4, PAL.gold3], fade: 0.5 });
            }
          }
        });
      });
    });
    this.bladesLit = true;
    this.front.setTexture(frontTex(sc, g, true));
    ras.destroy();
    sp.close();
    void floor.fadeOut(260);
    for (let i = 0; i < LANE_COLS.length; i++) if (!reached.has(i)) onReach?.(i);
  }

  /** The slam: sparks burst from the latch, a white flare. */
  private slamSparks(): void {
    const sc = this.scene;
    const l = lockAt(this.g);
    const sp = new Sparks(sc, this.depthFront + 0.3);
    for (let i = 0; i < fxCount(12); i++) {
      const a = rr(-Math.PI, 0);
      const v = rr(40, 110);
      sp.add({ x: l.x, y: l.y + 6, vx: Math.cos(a) * v, vy: Math.sin(a) * v, ay: 260, drag: 1, life: rr(180, 320), ramp: [PAL.white, PAL.gold4, PAL.gold3, PAL.gold2], tex: i < 2 ? TEX.plus : TEX.px1, fade: 0.4 });
    }
    sp.close();
    void lightFlash(sc, l.x, l.y + 6, PAL.gold4, 26, 200, { floorY: cp(this.g.bars[this.g.kl], this.g.rB, 0).y, intensity: 0.8 });
  }

  /** The front bars rattle ±1 px for `n` frames (34 ms). */
  private async rattle(n: number): Promise<void> {
    for (let i = 0; i < n; i++) {
      if (this.dead) return;
      this.dx = i % 2 === 0 ? 1 : -1;
      this.place();
      await wait(this.scene, 34);
    }
    this.dx = 0;
    if (!this.dead) this.place();
  }

  /** The padlock drops onto the latch, shackle open, and snaps shut. */
  private async dropLock(lit: number): Promise<void> {
    const sc = this.scene;
    this.lockShown = true;
    this.setLock(0, { open: true });
    this.lock.setVisible(true);
    await run(sc, CAGE_T.lockDrop, (t) => {
      this.lockDy = -R(10 * (1 - E.inQuad(t)));
      this.place();
    });
    this.lockDy = 0;
    playV3('e_dawnShackle', { volume: 0.75, pan: panAt(lockAt(this.g).x) });
    this.setLock(0, { white: true });
    this.twinkle(lockAt(this.g).x, lockAt(this.g).y + 2);
    await wait(sc, 34);
    this.setLock(0);
    // the bob: down 1, up, settle
    for (const d of [1, 0, 1, 0]) {
      this.lockDy = d;
      this.place();
      await wait(sc, 34);
    }
    void lit;
  }

  /** A 4-ray white twinkle at (x, y) for 3 frames. */
  private twinkle(x: number, y: number): void {
    const sp = new Sparks(this.scene, this.depthFront + 0.3);
    sp.add({ x, y, life: 100, ramp: [PAL.white, PAL.gold4], tex: TEX.plus, fade: 0.5 });
    sp.close();
  }

  /** The caged monsters go cold (an edge light drains down them) and lean on the front bars. */
  private async cold(units: Phaser.GameObjects.Sprite[]): Promise<void> {
    const sc = this.scene;
    const g = this.g;
    playV3('e_dawnCold', { volume: 0.7, pan: panAt(cp(g.cm, g.rm, 0).x) });
    this.coldOn(220);
    const leans: Promise<void>[] = [];
    for (const s of units) {
      if (!s.active || !s.visible) continue;
      bg(rimClimb(sc, s, { ramp: [PAL.water2, PAL.water3, PAL.water4], from: 'head', stepMs: 60, holdMs: 360, fadeMs: 180 }));
      // a cold breath: mist puffs off the top of the body
      const top = { x: s.x, y: s.getBounds().top + 4 };
      const mist = new Sparks(sc, this.depthFront + 0.07);
      for (let i = 0; i < fxCount(7); i++) {
        mist.add({ x: R(top.x + rr(-8, 8)), y: R(top.y + rr(0, 8)), vx: rr(-14, 14), vy: -rr(8, 22), drag: 1.5, life: rr(380, 620), delay: 60 + i * 25, ramp: [PAL.white, PAL.water4, PAL.water3, PAL.water2], wobble: 6, wobbleHz: 1, fade: 0.45 });
      }
      mist.close();
      const rest = { x: s.x, y: s.y };
      // lean toward the camera side (+row: screen (−2, +1))
      leans.push(
        (async () => {
          const steps: [number, number, number][] = [
            [60, -1, 0],
            [60, -2, 1],
            [200, -2, 1],
            [60, -1, 0],
          ];
          await wait(sc, 60);
          for (const [ms, x, y] of steps) {
            if (!s.active) return;
            s.setPosition(R(rest.x + x), R(rest.y + y));
            if (x === -2 && ms === 60) this.barFlash(s.x);
            await wait(sc, ms);
          }
          if (s.active) s.setPosition(rest.x, rest.y);
        })(),
      );
    }
    await Promise.all(leans);
  }

  /** The front bar nearest screen x flashes white for two frames (a monster leans on it). */
  private barFlash(x: number): void {
    const g = this.g;
    let best = 1;
    for (let k = 1; k < g.bars.length - 1; k++) if (Math.abs(frontFoot(g, k).x - x) < Math.abs(frontFoot(g, best).x - x)) best = k;
    const f = frontFoot(g, best);
    const ras = new Raster(this.scene, f.x - 1, f.y - g.H, 4, g.H, this.depthFront + 0.03);
    ras.draw((r) => {
      for (let h = Math.round(g.H * 0.3); h < Math.round(g.H * 0.7); h++) {
        r.px(f.x, f.y - h, PAL.white);
        r.px(f.x + 1, f.y - h, PAL.gold4);
      }
    });
    bg(wait(this.scene, 50).then(() => ras.destroy()));
  }

  // ---------------------------------------------------------------- restore

  /** Show the cage at once (a staged / restored board) with `n` tongues lit. */
  restore(n: number): void {
    this.lit = n;
    this.bladesLit = true;
    this.front.setTexture(frontTex(this.scene, this.g, true));
    this.setSun(1);
    this.lockShown = true;
    this.setLock(n);
    this.setDoor(0);
    this.dy = 0;
    this.place();
    this.show(true);
    const imgs = [...this.backs, this.front, this.door, this.sun, this.chain, this.lock];
    for (const i of imgs) i.setAlpha(0.5);
    bg(wait(this.scene, 100).then(() => imgs.forEach((i) => i.active && i.setAlpha(1))));
    this.lightsOn(240);
    this.setBadge(n);
    this.startIdle();
  }

  /** The counter went up (a late build): just show `n`. */
  setCount(n: number): void {
    this.lit = n;
    this.setLock(n);
    this.setBadge(n, true);
  }

  // ---------------------------------------------------------------- the counter

  /** The counter goes from `from` to `from − 1`: a tongue turns and the bell tolls; at 0 the cage is hauled up. */
  async tick(from: number): Promise<void> {
    this.busy++;
    const sc = this.scene;
    const g = this.g;
    try {
      const i = Math.max(0, Math.min(2, from - 1));
      const l = lockAt(g);
      const last = from <= 1;
      playV3(last ? 'e_dawnLast' : 'e_dawnTick', { volume: 0.85, pan: panAt(l.x) });
      // the tongue turns: white, half turned, flat
      this.setLock(from, { white: true });
      this.setBadge(from, false, { white: true });
      await wait(sc, 34);
      this.setLock(from - 1, { turning: i });
      this.setBadge(from - 1, false, { turning: i });
      this.twinkle(l.x - 4 + i * 4, l.y + 9);
      await wait(sc, 50);
      this.setLock(from - 1);
      this.lit = from - 1;
      if (!last) this.setBadge(from - 1);
      // the bell: a ring from the lock, the sun flares, the lock jolts and swings
      bg(floorRing(sc, l.x, cp(g.bars[g.kl], g.rB, 0).y, { r0: 4, r1: 30, ms: 320, ramp: [PAL.white, PAL.gold4, PAL.gold3, PAL.gold2], depth: DEPTH.TILE_FX + 2 }));
      void lightFlash(sc, l.x, l.y + 8, PAL.gold3, 30, 300, { floorY: cp(g.bars[g.kl], g.rB, 0).y, intensity: 0.7 });
      this.setSun(1, true);
      bg(wait(sc, 50).then(() => this.alive && this.setSun(this.sunLit)));
      for (const [dx, dy] of [
        [0, 1],
        [1, 1],
        [-1, 0],
        [1, 0],
        [0, 0],
      ] as const) {
        this.lockDx = dx;
        this.lockDy = dy;
        this.place();
        await wait(sc, 50);
      }
      if (!last) {
        await wait(sc, Math.max(0, CAGE_T.tickMs - 84 - 250));
        return;
      }
      await wait(sc, Math.max(0, CAGE_T.springAt - 84 - 250));
      await this.release();
    } finally {
      this.busy--;
    }
  }

  /** The last tongue has turned: the padlock springs open and drops, the door opens, the cage is hauled up. */
  private async release(): Promise<void> {
    const sc = this.scene;
    const g = this.g;
    const l = lockAt(g);
    const floorY = cp(g.bars[g.kl], g.rB, 0).y + 3;
    playV3('e_dawnUnlock', { volume: 0.8, pan: panAt(l.x) });
    this.setLock(0, { open: true, white: true });
    this.setBadge(0);
    await wait(sc, 34);
    this.setLock(0, { open: true });
    // the padlock falls to the floor: two bounces, then fades out in steps
    const lock = this.lock;
    const y0 = lock.y;
    const fall = floorY - y0;
    const lx = lock.x;
    bg(
      run(sc, 420, (t) => {
        if (!lock.active) return;
        let y: number;
        if (t < 0.45) y = y0 + fall * E.inQuad(t / 0.45);
        else if (t < 0.7) y = floorY - 5 * Math.sin(((t - 0.45) / 0.25) * Math.PI);
        else if (t < 0.85) y = floorY - 2 * Math.sin(((t - 0.7) / 0.15) * Math.PI);
        else y = floorY;
        lock.setPosition(lx + (t > 0.45 ? 2 : 0), R(y));
        lock.setAlpha(t > 0.9 ? 0.5 : 1);
      }).then(() => {
        this.lockShown = false;
        lock.setVisible(false).setAlpha(1);
      }),
    );
    // the door swings open, the sun goes cold, the cold leaves
    bg(
      run(sc, 220, (t) => {
        if (this.dead) return;
        this.setDoor(56 * E.outQuad(t));
      }),
    );
    this.coldOff(300);
    await wait(sc, 120);
    this.setSun(0);
    void this.sunPool?.fadeOut(300);
    this.sunPool = null;
    this.stopIdle?.();
    this.stopIdle = null;
    this.glint.setVisible(false);
    this.chainGlint.setVisible(false);
    await wait(sc, CAGE_T.haulAt - CAGE_T.springAt - 120);
    // HAUL
    playV3('e_dawnHaul', { volume: 0.85, pan: panAt(cp(g.cm, g.rm, 0).x) });
    const sp = new Sparks(sc, this.depthFront + 0.08);
    for (let k = 0; k < g.bars.length; k += 2) {
      const p = cp(g.bars[k], g.rB, 0);
      sp.add({ x: p.x, y: p.y, vx: rr(-10, 10), vy: -rr(10, 30), ay: 30, life: rr(240, 380), ramp: [PAL.stone3, PAL.stone2, PAL.stone1], fade: 0.5 });
    }
    sp.close();
    await run(sc, CAGE_T.haul, (t) => {
      if (this.dead) return;
      this.dy = -R((CAGE_T.fallH + 30) * E.inCubic(t));
      this.place();
    });
    this.destroy();
  }

  // ---------------------------------------------------------------- early destruction

  /**
   * Destroyed early: the cage's own break. Two white frames; the chain SNAPS and whips up out of the screen; the sword
   * bars burst into gold shards; the whole frame sags and drops (0 → 8 px, a 1-px judder) while the padlock and the
   * sun fall; then the frame breaks into a shower of gilded pieces along every rail.
   */
  async shatter(): Promise<void> {
    this.busy++;
    const sc = this.scene;
    const g = this.g;
    try {
      this.stopIdle?.();
      this.stopIdle = null;
      this.glint.setVisible(false);
      this.chainGlint.setVisible(false);
      playV3('e_dawnBreak', { volume: 0.95, pan: panAt(cp(g.cm, g.rm, 0).x) });
      this.setWhite(true);
      this.setLock(this.lit, { white: true });
      this.setSun(1, true);
      this.setBadge(0);
      await wait(sc, 34);
      this.setWhite(false);
      this.setLock(0, { open: true });
      this.setSun(0);
      const sp = new Sparks(sc, this.depthFront + 0.08);
      // the sword bars burst into gold shards (their blades go: the front layer's blades turn dull, then the frame drops)
      this.bladesLit = false;
      this.front.setTexture(frontTex(sc, g, false));
      for (let k = 1; k < g.bars.length - 1; k++) {
        const f = frontFoot(g, k);
        for (let i = 0; i < fxCount(6); i++) {
          const h = rr(4, g.H - 6);
          sp.add({ x: f.x, y: f.y - h, vx: rr(-60, 40), vy: -rr(20, 90), ay: 300, drag: 0.8, life: rr(300, 520), ramp: [PAL.white, PAL.gold4, PAL.gold3, PAL.gold2, PAL.gold1], tex: i === 0 ? TEX.px2 : TEX.px1, trail: i % 3 === 0, fade: 0.3 });
        }
      }
      void lightFlash(sc, cp(g.cm, g.rm, 0).x, cp(g.cm, g.rm, 0).y - 20, PAL.gold4, 60, 260, { floorY: cp(g.cm, g.rm, 0).y, intensity: 0.8, air: 0.5 });
      this.coldOff(200);
      void this.sunPool?.fadeOut(200);
      this.sunPool = null;
      // the chain snaps and whips up
      const chain = this.chain;
      const s0 = sunAt(g);
      bg(
        run(sc, 260, (t) => {
          if (!chain.active) return;
          chain.setY(R(s0.y - 10 - 12 - 260 * E.inQuad(t)));
          chain.setX(s0.x + (Math.floor(t * 8) % 2 ? 1 : -1));
        }).then(() => chain.active && chain.setVisible(false)),
      );
      // the frame BREAKS IN TWO at the door: each half sags, slides apart and drops; the padlock and the sun fall
      const lock = this.lock;
      const l0 = lock.y;
      const sun = this.sun;
      const lx = lockAt(g).x - g.ox;
      const right = this.scene.add.image(this.front.x, this.front.y, this.front.texture.key).setOrigin(0, 0).setDepth(this.depthFront);
      right.setCrop(lx, 0, g.w - lx, g.h);
      this.front.setCrop(0, 0, lx, g.h);
      this.door.setVisible(false);
      const backX = this.backs.map((b) => {
        const [cx, cw] = b.getData('crop') as [number, number];
        return cx + cw / 2 < lx ? -1 : 1;
      });
      await run(sc, 240, (t) => {
        if (this.dead) return;
        const k = E.inQuad(t);
        const dy = R(18 * k);
        const sp2 = R(5 * k);
        const jud = Math.floor(t * 10) % 2;
        this.front.setPosition(g.ox - sp2 - jud, g.oy + dy + R(4 * k));
        right.setPosition(g.ox + sp2 + jud, g.oy + dy);
        this.backs.forEach((b, i) => b.setPosition(g.ox + backX[i] * R(3 * k), g.oy + R(dy * 0.7)));
        sun.setY(R(s0.y + 34 * k));
        if (lock.active) lock.setY(R(l0 + 30 * k));
        if (t > 0.5 && rnd() < 0.5) sp.add({ x: g.ox + lx + rr(-3, 3), y: g.oy + rr(10, g.h - 10) + dy, vx: rr(-30, 30), vy: -rr(10, 40), ay: 300, life: rr(200, 320), ramp: [PAL.white, PAL.gold4, PAL.gold3], fade: 0.4 });
      });
      this.dy = 18;
      right.destroy();
      // … and breaks into gilded pieces along every rail
      bg(shake(sc, 100, 1));
      const pieces = new Sparks(sc, this.depthFront + 0.08);
      const railPts: XY[] = [];
      for (let k = 0; k < g.bars.length; k++) {
        for (const h of [0, g.H]) {
          railPts.push(cp(g.bars[k], g.rB, h));
          if (k % 2 === 0) railPts.push(cp(g.bars[k], g.rA, h));
        }
        if (k % 2 === 0) railPts.push(cp(g.bars[k], g.rm, g.H + g.VR));
      }
      for (const r of g.sideRows) for (const h of [0, g.H]) railPts.push(cp(g.c1, r, h));
      for (const p of railPts) {
        if (rnd() > 0.75) continue;
        pieces.add({ x: p.x + rr(-2, 2), y: p.y + this.dy, vx: rr(-35, 35), vy: -rr(5, 45), ay: 340, life: rr(300, 520), ramp: [PAL.gold4, PAL.gold3, PAL.gold2, PAL.gold1, PAL.gold0], tex: rnd() < 0.4 ? TEX.px2 : TEX.px1, fade: 0.3 });
      }
      pieces.close();
      sp.close();
      for (const i of [...this.backs, this.front, this.door, this.sun, this.lock]) i.setVisible(false);
      const mid = cp(g.cm, g.rm, 0);
      bg(floorRing(sc, mid.x, mid.y, { r0: 10, r1: 60, ms: 260, ramp: [PAL.gold3, PAL.gold2, PAL.gold1], depth: DEPTH.TILE_FX + 2 }));
      await wait(sc, CAGE_T.breakMs - 270);
    } finally {
      this.busy--;
    }
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    this.stopIdle?.();
    this.stopIdle = null;
    this.motes?.close();
    this.motes = null;
    for (const i of [...this.backs, this.front, this.door, this.lock, this.sun, this.chain, this.glint, this.chainGlint]) i.destroy();
    this.badge?.destroy();
    this.badge = null;
    this.sunPool?.destroy();
    this.sunPool = null;
    for (const h of this.coldPools) h.destroy();
    this.coldPools = [];
    const m = cages.get(this.scene);
    if (m?.get(this.uid) === this) m.delete(this.uid);
  }
}

// ================================================================ the hooks (v3; dawn_swords.ts delegates)

/** The caged monsters' sprites (the target's monster row, face-up units with a visible sprite). */
function caged(ctx: AnyCtx, target: PlayerId): Phaser.GameObjects.Sprite[] {
  const out: Phaser.GameObjects.Sprite[] = [];
  for (const m of ctx.state.players[target].monsters) {
    if (!m) continue;
    const u = ctx.unit(m.uid);
    if (u && !u.locked && u.sprite.active && u.sprite.visible) out.push(u.sprite);
  }
  return out;
}

export async function cageActivate(ctx: ActCtx): Promise<void> {
  const ev = ctx.ev;
  const sc = ctx.scene;
  const run0 = fx.resolutionRun(ctx);
  const parts = resolutionParts(ctx, ev.uid, run0);
  // the reveal flips follow the counter but are not 'run' events (fx.resolutionRun stops before them): find them
  for (let i = ctx.index + 1; i < ctx.events.length; i++) {
    const e = ctx.events[i];
    if (e.type === 'flip' && e.cause === 'reveal' && e.sourceUid === ev.uid) {
      if (!parts.flips.some((f) => f.i === i)) parts.flips.push({ i, zone: e.zone });
    } else if (e.type !== 'counter') break;
  }
  const set = setTileOf(ctx);
  const op = await spellOpening(ctx, { uid: ev.uid, cardId: ev.cardId, player: ev.player, from: set ? 'set' : 'hand', zone: ev.zone, hold: CAGE_T.openHold });
  if (ev.zone === null) {
    await op.close();
    relax(ctx);
    await fx.playRun(ctx, run0);
    return;
  }
  const zone = ev.zone;
  const at = zoneXY(ev.player, 'spellTrap', zone);
  let tile: TileCard;
  if (op.landV3) {
    const land = () => {
      playV3('cardPlace', { volume: 0.8, pan: panAt(at.x) });
      bg(ctx.views.board.flashTile(ev.player, 'spellTrap', zone, PAL.gold3, 150));
      void lightFlash(sc, at.x, at.y, PAL.gold3, 20, 220, { floorY: at.y, intensity: 0.55 });
    };
    tile = await op.landV3({ spot: 'spellTrap', index: zone, ms: 110, lieMs: set ? 160 : 120, onLand: land });
  } else tile = await op.land({ spot: 'spellTrap', index: zone });

  dawnCasting.add(ev.uid);
  try {
    const cage = new DawnCage(sc, ev.uid, ev.player, zone);
    cage.tileRef = tile;
    const target = other(ev.player);
    const cev = evAt(ctx, parts.counter, 'counter');
    if (parts.counter >= 0) ctx.consumeAt(parts.counter);
    const flips: Promise<unknown>[] = [];
    await cage.cast({
      lit: cev?.value ?? 3,
      onReach: (z) => {
        for (const f of parts.flips) if (f.zone === z) flips.push(ctx.play(f.i));
      },
      units: () => caged(ctx, target),
    });
    await Promise.all(flips);
  } finally {
    dawnCasting.delete(ev.uid);
  }
  await fx.playRun(ctx, fx.resolutionRun(ctx));
  relax(ctx, 300);
}

export async function cageCounter(ctx: CounterCtx): Promise<void> {
  const ev = ctx.ev;
  const sc = ctx.scene;
  let c = cageOf(sc, ev.uid);
  const tile = ctx.views.field.tileAt(ev.player, 'spellTrap', ev.zone);
  if (ev.value > ev.prev) {
    if (!c) {
      c = new DawnCage(sc, ev.uid, ev.player, ev.zone);
      c.tileRef = tile;
      c.restore(ev.value);
    } else c.setCount(ev.value);
    return;
  }
  if (!c) {
    c = new DawnCage(sc, ev.uid, ev.player, ev.zone);
    c.tileRef = tile;
    c.restore(ev.prev);
  }
  if (tile) c.tileRef = tile;
  await c.tick(ev.prev);
}

export async function cageDestroyed(ctx: DestroyCtx): Promise<void> {
  const ev = ctx.ev;
  const sc = ctx.scene;
  const field = ctx.views.field;
  const gi = ctx.findType('toGraveyard', (e) => e.uid === ev.uid, { until: (e) => e.type !== 'toGraveyard' && e.type !== 'destroy' });
  const g = evAt(ctx, gi, 'toGraveyard');
  if (gi >= 0) ctx.consumeAt(gi);
  const slot = ctx.state.players[ev.player].spellTraps[ev.zone];
  const expired = (slot?.counter ?? 1) <= 0;
  const cage = cageOf(sc, ev.uid);
  const jobs: Promise<unknown>[] = [];
  if (cage && !expired) jobs.push(cage.shatter());
  const { tile } = field.release(ev.uid);
  const home = tile ? ip(tile.home) : zoneXY(ev.player, 'spellTrap', ev.zone);
  if (tile && tile.active) {
    if (!tile.faceUp) {
      tile.setCard(ev.cardId);
      await tile.flipUp(160);
    }
    bg(tile.pulse(PAL.gold4, 200));
    void lightFlash(sc, home.x, home.y, PAL.gold3, 26, 360, { intensity: 0.6 });
    bg(floorRing(sc, home.x, home.y, { r0: 4, r1: 24, ms: 300, ramp: [PAL.white, PAL.gold4, PAL.gold3, PAL.gold2] }));
    await wait(sc, expired ? 120 : 60);
  }
  if (g) jobs.push(cardLeaves(ctx, { owner: g.owner, cardId: ev.cardId, from: home, tile }));
  else if (tile && tile.active) jobs.push(tile.dissolve(300).then(() => tile.active && tile.destroy()));
  field.forget(ev.uid);
  await fx.all(jobs);
  cageOf(sc, ev.uid)?.destroy();
}

/** A staged / restored board shows its cage; a cage whose card is gone is removed. */
export function cageObserve(ctx: AnyCtx): void {
  const sc = ctx.scene;
  const present = new Set<Uid>();
  ctx.state.players.forEach((p, pi) => {
    p.spellTraps.forEach((st, zi) => {
      if (!st || !st.faceUp) return;
      if (ctx.state.cards[st.uid]?.cardId !== ID) return;
      present.add(st.uid);
      const n = st.counter ?? 0;
      if (n <= 0 || dawnCasting.has(st.uid) || cageOf(sc, st.uid)) return;
      const c = new DawnCage(sc, st.uid, pi as PlayerId, zi);
      c.tileRef = ctx.views.field.tileAt(pi as PlayerId, 'spellTrap', zi);
      c.restore(n);
    });
  });
  for (const c of allCages(sc)) if (!present.has(c.uid) && !c.busy && !dawnCasting.has(c.uid)) c.destroy();
}
