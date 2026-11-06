// Şafak Kılıçları (dawn_swords) — lane E's NEW SIGNATURE (v3 look only): THE GILDED DAWN CAGE.
// Owner decision 1 (docs/v3/YENI_KARTLAR.md, "Sahip kararları"): the dropped S6 Yaldızlı Kafes storyboard, adapted to
// this card — it locks ALL the opponent's monsters (and reveals the face-down ones) for three of their turns, so the
// cage stands over the opponent's WHOLE monster row; every second camera-side bar is a DAWN SWORD planted tip-down
// (3-px blade with a white edge, a crossguard under the top rail, a pommel above it), a rising DAWN SUN (a disc with a
// fan of rays) crowns it, a padlock with three TONGUE PLATES is the counter. The old look keeps the fence of six
// light blades (./_dawn_v3.ts, untouched). Drawings: ./_dawn_e_paint.ts. Break debris: ./_dawn_e_break.ts.
// Sounds: src/audio/v3/e/dawn_swords.ts (e_dawn*).
//
// BEAT LIST (scene ms at 1×; game time ×1.35 with the v3 tempo). t = 0 is the frame the card lies flat on its zone.
// Round 3 (critic fixes): a real birdcage DOME over the middle lane, steel sword bars vs gilded rods, a one-column
// DOOR set piece, a big padlock with three tongue BOLTS on its face, a quicker flow (≈ 5.0 s game time with flips).
// ACTIVATE (hook 'activate', after the common v3 spell opening ≈ 0.55 s and landV3):
//   0      OMEN: the cage's shadow falls on the opponent's row (stepped, 3 levels); the pulley ratchet — e_dawnChain
//   0–270  THE DESCENT: the gilded cage drops from 170 px above (inQuad) on its chain, its swords DULL, the door
//          hanging WIDE OPEN toward the camera (100°), swinging 90 ↔ 100° as it falls
//   270    LAND: a pale-gold frame on the whole cage, hit-stop 50 ms, 2-px shake, dust, gold sparks at the posts, a
//          floor ring + flash — e_dawnLand (the low gong of the gilded bars); the bounce rocks the open door
//   450    THE DAWN: the sun finial on the dome ignites, its ray fan RISES in three drawings — e_dawnSun;
//   570    … the DAWN WAVE runs down every steel blade (480 ms per blade, staggered left → right over 180 ms), a
//          light beam from the sun, a gold floor light; as it touches a lane, that lane's FACE-DOWN monster flips
//          face-up (the engine's own flip, cause 'reveal')
//   ~1300  +80 hold → THE DOOR swings shut (100 → 0°, 150 ms, accelerating — e_dawnSwing) … SLAM: the door's white
//          frame, hit-stop 50 ms, a white ring and sparks off the latch — e_dawnSlam (a bright brass latch KLAK);
//          the OVERSHOOT frame (−8°) and back, the bars rattle. The reveal flips run on under the door.
//   +100   CAGED (after the flips): every monster goes COLD (an edge light drains down it, cold pools, breath mist —
//          e_dawnCold) and LEANS on the bars one after another (60 ms apart, 5 px, a one-frame squash on contact,
//          the touched bar flashes, a frost puff) and eases back. An EMPTY row skips this beat.
//   +300   THE PADLOCK drops 14 px onto the latch (while they ease back), shackle open, SNAPS shut with a pop —
//          e_dawnShackle; +160 the three TONGUE BOLTS turn their gilded faces out (140 ms apart) — e_dawnTongue ×3
//   +170   the small padlock badge pops onto the lying spell card (its left corner) — e_dawnBadge; +150 the end
// IDLE (as long as the card is on the field): the sun's rays twinkle (long ↔ short), a glint runs down one sword now
//   and then, a light climbs the chain, cold breath rises inside, a gold mote drifts down; the caged units' frost.
// COUNTER (each end of the opponent's turn; 'counter' event) ≈ 0.65 s: the whole padlock flashes white and POPS (a
//   gold halo); the right-most lit BOLT TURNS (4 drawings, 45 ms: narrowing → edge-on, its slot framed white, a spark
//   burst and a small ring → its IRON back) — the bell
//   tolls (e_dawnTick: three ratchet ticks + the church bell G4): the lock swings ±2 px three times, a gold ring
//   spreads, a light pulse climbs from the lock up the latch post and the vault to the sun, the sun flares and a gold
//   ripple runs out along every sword from the middle; the badge's pip turns too.
// LAST (counter 1 → 0): the last bolt turns — e_dawnLast (the bell low, D4) → +300 the padlock SPRINGS OPEN and
//   drops to the floor, two bounces — e_dawnUnlock → the door creaks WIDE open (90°, e_dawnDoor), the sun's ray fan
//   collapses in three drawings, the frost and the cold pools leave → +370 the cage is HAULED UP out of the top
//   (inCubic, 420 ms) — e_dawnHaul (a rising chain-and-ratchet line).
// EARLY DESTRUCTION ('destroyed' while the counter is still > 0: Arınma Dalgası …) ≈ 0.95 s: its own BREAK — two
//   pale-gold frames; the chain SNAPS and whips up (a visible link segment flicking); every sword SNAPS: its upper
//   half flies off spinning, drawn as a SWORD (steel blade, guard, pommel); the frame sags, splits at the door and
//   COLLAPSES into FEW, THICK (3-px) pieces that tumble, bounce and lie FLAT along the rail (the vault / dome / back
//   pieces in the back layer, behind the caged monsters), then cool gold → stone (steel → night) as light motes
//   rise off them; the padlock and the sun fall and bounce — e_dawnBreak (a falling bell arpeggio of the bars + clatter).
// STAGED / RESTORED boards: the cage is built with the board, before the first event (no pop-in); a late restore
//   fades in. A cage whose card is gone is removed.
//
// Everything on scene time (speed / hit-stop aware), whole pixels, palette tones, no camera move.

import Phaser from 'phaser';
import type { GameEvent, GameState, PlayerId, Uid } from '../../engine/types';
import { other } from '../../engine/types';
import { PAL } from '../../art/palette';
import type { Motif } from '../../art/spellmotifs-v3';
import { DEPTH, TILE_W, LANE_COLS, unitDepth, zoneXY, type XY } from '../../view/layout';
import { TEX, shake, wait } from '../../vfx/core';
import { E, Raster, Sparks, floorRing, freeze, lerp, onFrame, rnd, rr, run } from '../../vfx/setpieces';
import { fxCount, motifTexture, rimClimb, silhouetteOf } from '../_v3/spellfx';
import { panAt, play as playV3 } from '../_v3/sound';
import { cardLeaves } from '../_v3/card';
import { fx, type CinematicContext } from '../api';
import type { TileCard } from '../../view/TileCard';
import { onDuelStart } from '../../duel/seeds';
import { bg, evAt, ip, lightBeam, lightFlash, lightPool, relax, setTileOf, spellOpening, type LightHandle } from './_kit';
import { dawnCasting, resolutionParts } from './_dawn_v3';
import {
  BADGE_H,
  BADGE_W,
  CHAIN_W,
  DOOR_ANGLES,
  LOCK_AX,
  LOCK_AY,
  SUN_C,
  SUN_CY,
  SUN_H,
  SUN_RISE,
  SUN_W,
  TONGUE_X,
  TONGUE_Y,
  bladeSpan,
  cageGeo,
  cp,
  footprint,
  frontFoot,
  latchAt,
  lockAt,
  paintBack,
  paintBadge,
  paintChain,
  paintDoor,
  paintFront,
  paintLock,
  paintSun,
  rodKs,
  sunAt,
  swordKs,
  vrAt,
  type CageGeo,
} from './_dawn_e_paint';
import { debris, stickOf, type Stick } from './_dawn_e_break';

type AnyCtx = CinematicContext<GameEvent>;
type ActCtx = CinematicContext<Extract<GameEvent, { type: 'activate' }>>;
type CounterCtx = CinematicContext<Extract<GameEvent, { type: 'counter' }>>;
type DestroyCtx = CinematicContext<Extract<GameEvent, { type: 'destroy' }>>;
type Sprite = Phaser.GameObjects.Sprite;

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
  /** The sun ignites (after the land frame); its ray fan rises in SUN_RISE drawings. */
  sunAt: 110,
  sunStep: 40,
  /** The dawn wave: per blade, and the left → right stagger of the whole row. */
  waveMs: 460,
  waveSpread: 180,
  /** After the wave: a hold, then the door swings and slams (the reveal flips overlap it), its overshoot frame. */
  doorHold: 80,
  swing: 150,
  slamStop: 50,
  overshoot: 34,
  /** After the slam: the hold, the cold (and lean; skipped on an empty row), the padlock, the tongues, the badge. */
  slamHold: 100,
  lean: [50, 50, 34, 280, 60, 60] as readonly number[],
  leanStagger: 60,
  lockAfterCold: 300,
  lockDrop: 100,
  tongue0: 160,
  tongueGap: 140,
  badgeAfter: 170,
  endAfter: 150,
  /** A counter, the last counter and the haul. */
  tickMs: 650,
  springAt: 300,
  haulAt: 370,
  haul: 420,
  /** The break: sag, the collapse, the whole. */
  sag: 200,
  breakMs: 950,
});

/** The whole signature length after the card lies flat, without reveal flips (scene ms; the tests read it). */
export function castLength(): number {
  const T = CAGE_T;
  const land = T.drop + T.landStop + 17;
  const wave = T.sunAt + SUN_RISE * T.sunStep + T.waveMs + T.waveSpread;
  const slam = T.doorHold + T.swing + T.slamStop + T.overshoot;
  const after = T.slamHold + T.lockAfterCold + T.lockDrop + 170 + T.tongue0 + 2 * T.tongueGap + T.badgeAfter + T.endAfter;
  return land + wave + slam + after;
}

/**
 * The impact frame of the big layers (land, break): every tone steps up to gold4 — a blazing pale-gold cage, not a
 * solid white block (EF-4: the white share of the frame stays small); the white goes only where the blow lands.
 */
const flashTone = (c: number): number => (c === PAL.ink ? c : PAL.gold4);

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
  return `dawnE3:${g.target}:${TILE_W}:${LANE_COLS.join('')}`;
}

/** The front layer with its swords dull (`lit` false) or bright; `white` = the land frame; `snapped` = the break. */
function frontTex(sc: Phaser.Scene, g: CageGeo, lit: boolean, white = false, snapped = false): string {
  return motifTexture(sc, `${geoKey(g)}:front:${lit ? 1 : 0}:${white ? 1 : 0}:${snapped ? 1 : 0}`, motif(() => {
    const p = paintFront(g, { lit, snapped });
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

/** `white`: true = the slam's white frame; 'gold' = the land / break frame (the pale-gold flashTone, EF-4). */
function doorTex(sc: Phaser.Scene, g: CageGeo, deg: number, lit: boolean, white: boolean | 'gold' = false): string {
  return motifTexture(sc, `${geoKey(g)}:door:${deg}:${lit ? 1 : 0}:${white === 'gold' ? 2 : white ? 1 : 0}`, motif(() => {
    const p = paintDoor(g, deg, white === true, { lit });
    if (white === 'gold') p.map(flashTone);
    else if (!lit && !white) p.map((c) => (c === PAL.gold4 ? PAL.gold3 : c));
    return p;
  })).key;
}

type LockLook = { turning?: number; step?: number; open?: boolean; white?: boolean; pop?: boolean };

function lockTex(sc: Phaser.Scene, lit: number, o: LockLook = {}): { key: string; ox: number; oy: number } {
  const t = motifTexture(sc, `dawnE3:lock:${lit}:${o.turning ?? -1}:${o.step ?? -1}:${o.open ? 1 : 0}:${o.white ? 1 : 0}:${o.pop ? 1 : 0}`, motif(() => paintLock(lit, o), LOCK_AX, LOCK_AY));
  return { key: t.key, ox: t.ax / t.w, oy: t.ay / t.h };
}

function badgeTex(sc: Phaser.Scene, lit: number, o: { turning?: number; white?: boolean } = {}): string {
  return motifTexture(sc, `dawnE:badge:${lit}:${o.turning ?? -1}:${o.white ? 1 : 0}`, motif(() => paintBadge(lit, o), 6, 7)).key;
}

function sunTex(sc: Phaser.Scene, lit: number, phase: number, white = false): string {
  return motifTexture(sc, `dawnE3:sun:${lit}:${phase}:${white ? 1 : 0}`, motif(() => paintSun(lit, phase, white), SUN_C, SUN_CY)).key;
}

function chainTex(sc: Phaser.Scene, len: number): string {
  return motifTexture(sc, `dawnE:chain:${len}`, motif(() => paintChain(len), 3, len - 1)).key;
}

/** The chain's bottom ring sits on the sun's disc. */
const CHAIN_DY = -7;

// ================================================================ the frost on the caged units

/**
 * The caged units' lasting COLD while the cage stands: a frost band on the lower body (the body's own contour
 * pixels, recoloured: water3 at the feet, water2 above, a water4 frost glint on every 5th) and a breath puff off the
 * head every ~1.4 s. Follows each sprite's animation (the mask is the frame on screen). Never tints the body.
 */
class Frost {
  private ras = new Map<Sprite, Raster>();
  private mist: Sparks;
  private stop: () => void;
  private nextPuff = new Map<Sprite, number>();
  private gone = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly units: () => Sprite[],
    depth: number,
  ) {
    this.mist = new Sparks(scene, depth);
    this.stop = onFrame(scene, (_dt, el) => {
      if (this.gone) return false;
      const live = new Set(this.units().filter((s) => s.active && s.visible));
      for (const [s, r] of [...this.ras]) {
        if (!live.has(s)) {
          r.destroy();
          this.ras.delete(s);
        }
      }
      for (const s of live) {
        const sil = silhouetteOf(s);
        if (!sil) continue;
        const W = sil.right - sil.left + 6;
        const H = sil.bottom - sil.top + 6;
        let r = this.ras.get(s);
        if (!r || r.w < W || r.h < H) {
          r?.destroy();
          r = new Raster(this.scene, sil.left - 3, sil.top - 3, W + 8, H + 8, s.depth + 0.01);
          this.ras.set(s, r);
        }
        r.moveTo(sil.left - 3, sil.top - 3);
        r.img.setDepth(s.depth + 0.01);
        const h = sil.bottom - sil.top;
        const band = sil.bottom - Math.max(6, R(h * 0.42));
        const feet = sil.bottom - Math.max(3, R(h * 0.18));
        r.draw((rr2) => {
          let n = 0;
          for (const q of sil.contour()) {
            if (q.y < band) continue;
            n++;
            rr2.px(q.x, q.y, q.y >= feet ? PAL.water3 : PAL.water2);
            if ((q.x * 3 + q.y * 5) % 11 === 0) rr2.px(q.x, q.y, PAL.water4);
          }
          // the frost crust on the floor line under the feet
          for (const q of sil.outside()) if (q.y >= sil.bottom - 1 && (q.x & 1) === 0) rr2.px(q.x, q.y, PAL.water4);
          void n;
        });
        // a breath puff off the head now and then
        const nx = this.nextPuff.get(s);
        if (nx === undefined) this.nextPuff.set(s, el + 300 + rnd() * 900);
        else if (el >= nx) {
          this.nextPuff.set(s, el + 1200 + rnd() * 600);
          const top = { x: (sil.left + sil.right) / 2, y: sil.top + 3 };
          for (let i = 0; i < fxCount(3); i++) {
            this.mist.add({ x: R(top.x + rr(-5, 5)), y: R(top.y + rr(0, 4)), vx: rr(-8, 8), vy: -rr(6, 14), drag: 1.5, life: rr(420, 620), delay: i * 40, ramp: [PAL.water4, PAL.water3, PAL.water2], wobble: 4, wobbleHz: 1, fade: 0.5 });
          }
        }
      }
      return true;
    });
  }

  destroy(): void {
    if (this.gone) return;
    this.gone = true;
    this.stop();
    for (const r of this.ras.values()) r.destroy();
    this.ras.clear();
    this.mist.close();
  }
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
  private frost: Frost | null = null;
  private stopIdle: (() => void) | null = null;
  private dead = false;
  /** Current vertical offset of the whole cage (px; negative = up), its door angle, the lit tongues. */
  dy = 0;
  private dx = 0;
  doorDeg = 0;
  private bladesLit = true;
  private sunLit = SUN_RISE;
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
  /** The caged units (set by the hooks / the observer from their context). */
  unitsFn: () => Sprite[] = () => [];
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
    this.sun = scene.add.image(0, 0, sunTex(scene, SUN_RISE, 0)).setOrigin(SUN_C / SUN_W, SUN_CY / SUN_H).setDepth(this.depthFront + 0.05).setVisible(false);
    const s = sunAt(g);
    const len = s.y + 12 + CAGE_T.fallH + 20;
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
    this.chain.setPosition(s.x, s.y + CHAIN_DY + R(this.dy));
    const l = lockAt(g);
    this.lock.setPosition(l.x + this.dx + this.lockDx, l.y + R(this.dy) + this.lockDy);
  }

  private show(on: boolean): void {
    for (const i of [...this.backs, this.front, this.door, this.sun, this.chain]) i.setVisible(on);
    this.lock.setVisible(on && this.lockShown);
  }

  private setDoor(deg: number, white: boolean | 'gold' = false): void {
    // the nearest drawing
    let best: number = DOOR_ANGLES[0];
    for (const a of DOOR_ANGLES) if (Math.abs(a - deg) < Math.abs(best - deg)) best = a;
    this.doorDeg = best;
    this.door.setTexture(doorTex(this.scene, this.g, best, this.bladesLit, white));
  }

  private setLock(lit: number, o: LockLook = {}): void {
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
    this.setDoor(this.doorDeg, on ? 'gold' : false);
  }

  /** Screen point of the sword bar k's blade at height h (at rest + the cage's current offset). */
  private bladeAt(k: number, h: number): XY {
    const f = frontFoot(this.g, k);
    return { x: f.x + this.dx, y: f.y - h + R(this.dy) };
  }

  // ---------------------------------------------------------------- lights and idle life

  private lightsOn(ms: number): void {
    const sc = this.scene;
    const s = sunAt(this.g);
    if (!this.sunPool) {
      this.sunPool = lightPool(sc, s.x, s.y, { color: PAL.gold3, radius: 24, floorY: cp(this.g.cm, this.g.rm, 0).y, air: 0.55, airRadius: 14, intensity: 0, anim: 'breathe', fadeIn: 0 });
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

  /** The caged units' lasting frost (on while the cage stands). */
  private frostOn(): void {
    if (this.frost || this.dead) return;
    this.frost = new Frost(this.scene, () => this.unitsFn(), this.depthFront + 0.07);
  }

  private frostOff(): void {
    this.frost?.destroy();
    this.frost = null;
  }

  private startIdle(): void {
    if (this.stopIdle || this.dead) return;
    const sc = this.scene;
    const g = this.g;
    this.motes = new Sparks(sc, this.depthFront + 0.07);
    const swords = swordKs(g);
    const bs = bladeSpan(g);
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
      const ph = Math.floor(el / 300) % 2;
      if (ph !== this.sunPhase && this.sunLit > 0) {
        this.sunPhase = ph;
        this.setSun(this.sunLit);
      }
      // a glint runs down one sword's white edge (its blade, guard → tip)
      if (el >= nextGlint && this.bladesLit) {
        glintAt = el;
        glintK = swords[Math.floor(rnd() * swords.length) % swords.length];
        nextGlint = el + 620 + rnd() * 520;
      }
      if (glintAt >= 0 && el - glintAt < 260) {
        const span = bs.guard - 1 - bs.tip;
        const row = Math.floor(((el - glintAt) / 260) * span);
        const p = this.bladeAt(glintK, bs.guard - 1 - row);
        this.glint.setVisible(true).setPosition(p.x, p.y);
      } else this.glint.setVisible(false);
      // a light climbs the chain
      if (el >= nextChain) {
        chainAt = el;
        nextChain = el + 1300 + rnd() * 700;
      }
      if (chainAt >= 0 && el - chainAt < 400) {
        const s = sunAt(g);
        const up = Math.floor(((el - chainAt) / 400) * 40);
        this.chainGlint.setVisible(true).setPosition(s.x - 1 + (Math.floor(up / 5) % 2 ? 1 : 0), s.y + CHAIN_DY - 2 - up + R(this.dy));
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
        this.motes?.add({ x: s.x + rr(-5, 5), y: s.y + 6, vy: rr(8, 14), vx: rr(-4, 4), life: rr(700, 1000), ramp: [PAL.gold4, PAL.gold3, PAL.gold2, PAL.gold1], wobble: 4, fade: 0.4 });
      }
      return true;
    });
  }

  // ---------------------------------------------------------------- the badge over the spell card

  private badgeSpot(): XY {
    const t = this.tileRef && this.tileRef.active ? this.tileRef : null;
    const h = t ? ip(t.home) : zoneXY(this.owner, 'spellTrap', this.zone);
    // round 3: on the tile's LEFT corner, the far side from the counter chip (+10 px right) — clear of the stat plates
    return { x: h.x - 13, y: h.y - 1 };
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
   * The whole signature from the frame the card lies flat: descent, land, the dawn (sun + wave; `onReach(lane)`
   * fires as the wave touches the floor in a lane — the reveal flips; the door waits for every promise it returns),
   * the door, the cold, the padlock, the tongues, the badge. Resolves at the end.
   */
  async cast(o: { lit: number; onReach?: (zone: number) => Promise<unknown> | void }): Promise<void> {
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
      this.setDoor(100);
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
        // the door hangs WIDE OPEN toward the camera and swings as the cage falls (the viewer waits for it)
        this.setDoor(t < 0.6 ? (Math.floor(t * 10) % 2 ? 90 : 100) : 100);
        this.place();
        drawShadow(t < 0.4 ? 0.25 : t < 0.8 ? 0.5 : 0.75);
      });
      // ---- LAND
      this.dy = 0;
      this.setDoor(100);
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
      this.setDoor(100);
      // the bounce (the open door rocks with it: 100 → 90 → 100)
      bg((async () => {
        for (const [i, b] of T.bounce.entries()) {
          await wait(sc, T.bounceStep);
          if (this.dead) return;
          this.dy = b;
          if (this.busy && this.doorDeg >= 90) this.setDoor(i === 0 || i === 1 ? 90 : 100);
          this.place();
        }
      })());
      await wait(sc, T.sunAt);
      // ---- THE DAWN: the sun ignites, its ray fan rises
      playV3('e_dawnSun', { volume: 0.9, pan: panAt(mid.x) });
      this.setSun(1, true);
      this.lightsOnSun();
      for (let k = 1; k <= SUN_RISE; k++) {
        if (k > 1) this.setSun(k, k === SUN_RISE);
        await wait(sc, T.sunStep);
        if (k === 1) this.setSun(1);
      }
      this.setSun(SUN_RISE);
      // … and the dawn wave runs down every sword (the reveal flips start as it reaches their lanes)
      const flips: Promise<unknown>[] = [];
      await this.dawnWave((z) => {
        const p = o.onReach?.(z);
        if (p) flips.push(p);
      });
      await wait(sc, T.doorHold);
      // ---- THE DOOR swings shut … SLAM (the flips run on under it)
      playV3('e_dawnSwing', { volume: 0.7, pan: panAt(lockAt(g).x) });
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
      // the overshoot: the door bangs past the frame (−8°) and back
      this.setDoor(-8);
      await wait(sc, T.overshoot);
      this.setDoor(0);
      bg(this.rattle(3));
      await Promise.all(flips);
      await wait(sc, T.slamHold);
      // ---- CAGED: the cold and the lean (the frost stays); an empty row goes straight to the padlock
      if (this.dead) return;
      const units = this.unitsFn().filter((u) => u.active && u.visible);
      let cold: Promise<void> = Promise.resolve();
      if (units.length) {
        cold = this.cold(units);
        await wait(sc, T.lockAfterCold);
      } else {
        this.coldOn(220);
        this.frostOn();
      }
      // ---- THE PADLOCK (it drops while the caged monsters ease back off the bars)
      if (this.dead) return;
      await this.dropLock();
      await wait(sc, T.tongue0);
      for (let i = 0; i < o.lit; i++) {
        if (this.dead) return;
        this.lightTongue(i);
        if (i < o.lit - 1) await wait(sc, T.tongueGap);
      }
      await wait(sc, T.badgeAfter);
      if (this.dead) return;
      playV3('e_dawnBadge', { volume: 0.6, pan: panAt(this.badgeSpot().x) });
      this.setBadge(o.lit, true);
      await wait(sc, T.endAfter);
      await cold;
      this.startIdle();
    } finally {
      this.busy--;
    }
  }

  private lightsOnSun(): void {
    const s = sunAt(this.g);
    void lightFlash(this.scene, s.x, s.y, PAL.gold4, 34, 300, { floorY: cp(this.g.cm, this.g.rm, 0).y, intensity: 0.8, air: 0.7 });
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
   * THE DAWN WAVE: a 4-row white-gold band runs DOWN every sword at once (the blades staggered left → right), each
   * blade turning bright behind it; the guards flare as it starts; a light beam sweeps from the sun to the touchdown
   * point; a gold floor light walks with the touchdowns; `onReach(zone)` fires as the wave touches the floor in a lane.
   */
  private async dawnWave(onReach?: (zone: number) => void): Promise<void> {
    const sc = this.scene;
    const g = this.g;
    const T = CAGE_T;
    const bs = bladeSpan(g);
    const ks = swordKs(g);
    const x0 = frontFoot(g, ks[0]).x;
    const x1 = frontFoot(g, ks[ks.length - 1]).x;
    const delayOf = (k: number) => R(((frontFoot(g, k).x - x0) / Math.max(1, x1 - x0)) * T.waveSpread);
    const total = T.waveSpread + T.waveMs;
    const ras = new Raster(sc, g.ox - 2, g.oy - 6, g.w + 4, g.h + 8, this.depthFront + 0.03);
    const reached = new Set<number>();
    const touched = new Set<number>();
    const footL = cp(g.c0, g.rB, 0);
    const floor = lightPool(sc, footL.x, footL.y - 6, { color: PAL.gold4, radius: 24, floorY: footL.y, air: 0.3, intensity: 0, fadeIn: 0 });
    floor.setIntensity(0.9, 120);
    const s = sunAt(g);
    const beam = lightBeam(sc, { x: s.x, y: s.y }, footL, PAL.gold4, 0, { width: 12, intensity: 0.6, floor: { from: footL, to: footL }, floorWidth: 10 });
    const sp = new Sparks(sc, this.depthFront + 0.08);
    playV3('e_dawnWave', { volume: 0.75, pan: panAt(cp(g.cm, g.rB, 0).x) });
    await run(sc, total, (_t, el) => {
      // the touchdown front: the right-most blade whose wave has reached the floor
      let frontX = footL.x;
      let frontY = footL.y;
      ras.draw((r) => {
        for (const k of ks) {
          const u = (el - delayOf(k)) / T.waveMs;
          if (u < 0) continue;
          const f = this.bladeAt(k, 0);
          const top = bs.guard - 1;
          const head = u >= 1 ? bs.tip - 1 : R(top - (top - bs.tip) * E.inOutSine(Math.min(1, u)));
          // the guard flares at the start
          if (u < 0.12) for (let x = -3; x <= 3; x++) r.px(f.x + x, f.y - (bs.guard + 1), PAL.white);
          if (u < 0.08) r.px(f.x, f.y - (g.H + 3), PAL.white);
          // the lit blade behind the head (guard → head)
          for (let h = Math.max(bs.tip, head); h <= top; h++) {
            const d = h - bs.tip;
            r.px(f.x, f.y - h, d < 2 ? PAL.white : h > bs.guard - 12 && h < bs.guard - 2 ? PAL.gold3 : PAL.gold4);
            if (d >= 2) r.px(f.x - 1, f.y - h, PAL.white);
            if (d >= 4) r.px(f.x + 1, f.y - h, PAL.gold3);
          }
          if (u < 1) {
            // the wave head: 2 white rows 5 wide, then 2 gold4 rows 3 wide (a band of light, not a dot)
            for (let row = 0; row < 4; row++) {
              const h = head - row;
              if (h < bs.tip) continue;
              const w = row < 2 ? 2 : 1;
              for (let x = -w; x <= w; x++) r.px(f.x + x, f.y - h, row < 2 ? (Math.abs(x) === 2 ? PAL.gold4 : PAL.white) : PAL.gold4);
            }
          } else if (!touched.has(k)) {
            touched.add(k);
            // the tip meets the floor: a spark and a white floor glint
            for (let i = 0; i < fxCount(3); i++) sp.add({ x: f.x, y: f.y - 1, vx: rr(-30, 30), vy: -rr(20, 50), ay: 160, life: rr(180, 300), ramp: [PAL.white, PAL.gold4, PAL.gold3], fade: 0.5 });
          }
          if (u >= 1 && f.x > frontX) {
            frontX = f.x;
            frontY = f.y;
          }
          if (u >= 1 && u < 1.35) for (let x = -3; x <= 3; x++) r.px(f.x + x, f.y + 1 + (Math.abs(x) > 1 ? 0 : 0), Math.abs(x) <= 1 ? PAL.white : PAL.gold4);
        }
      });
      const fl = { x: frontX, y: frontY };
      floor.setPosition(fl.x, fl.y - 6, fl.y);
      beam.setEnds({ x: s.x, y: s.y + R(this.dy) }, { x: fl.x, y: fl.y - 10 }, { from: { x: footL.x, y: footL.y }, to: fl });
      LANE_COLS.forEach((_c, i) => {
        const z = zoneXY(this.target, 'monster', i);
        // the lane is reached when the touchdown front, on the front rail, passes its x (P2's zones run right → left)
        if (!reached.has(i) && touched.size > 0 && fl.x >= z.x - 6) {
          reached.add(i);
          bg(floorRing(sc, z.x, z.y, { r0: 4, r1: 22, ms: 240, ramp: [PAL.white, PAL.gold4, PAL.gold3, PAL.gold2], depth: DEPTH.TILE_FX + 2 }));
          onReach?.(i);
        }
      });
    });
    this.bladesLit = true;
    this.front.setTexture(frontTex(sc, g, true));
    ras.destroy();
    sp.close();
    void floor.fadeOut(260);
    void beam.fadeOut(220);
    for (let i = 0; i < LANE_COLS.length; i++) if (!reached.has(i)) onReach?.(i);
  }

  /** The slam: sparks burst from the latch, a white ring spreads off the latch post, a white flare. */
  private slamSparks(): void {
    const sc = this.scene;
    const l = latchAt(this.g);
    const sp = new Sparks(sc, this.depthFront + 0.3);
    for (let i = 0; i < fxCount(14); i++) {
      const a = rr(-Math.PI * 1.1, 0.1);
      const v = rr(50, 120);
      sp.add({ x: l.x, y: l.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, ay: 260, drag: 1, life: rr(180, 340), ramp: [PAL.white, PAL.gold4, PAL.gold3, PAL.gold2], tex: i < 3 ? TEX.plus : TEX.px1, fade: 0.4 });
    }
    sp.close();
    bg(this.airRing(l.x, l.y, 3, 12, 170));
    void lightFlash(sc, l.x, l.y, PAL.gold4, 30, 220, { floorY: cp(this.g.bars[this.g.kl], this.g.rB, 0).y, intensity: 0.9, air: 0.8 });
  }

  /** A ring in the AIR (a circle in screen space, 1 px: white → gold4 → gold3) spreading from r0 to r1. */
  private async airRing(x: number, y: number, r0: number, r1: number, ms: number): Promise<void> {
    const ras = new Raster(this.scene, x - r1 - 2, y - r1 - 2, 2 * r1 + 5, 2 * r1 + 5, this.depthFront + 0.31);
    await run(this.scene, ms, (t) => {
      const r = R(lerp(r0, r1, E.outQuad(t)));
      const c = t < 0.34 ? PAL.white : t < 0.67 ? PAL.gold4 : PAL.gold3;
      ras.draw((q) => {
        const n = Math.max(12, R(r * 7));
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2;
          q.px(R(x + Math.cos(a) * r), R(y + Math.sin(a) * r), c);
        }
      });
    });
    ras.destroy();
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

  /** The padlock drops onto the latch, shackle open, and snaps shut (the beat's hero). */
  private async dropLock(): Promise<void> {
    const sc = this.scene;
    this.lockShown = true;
    this.setLock(0, { open: true });
    this.lock.setVisible(true);
    playV3('e_dawnLockDrop', { volume: 0.55, pan: panAt(lockAt(this.g).x) });
    await run(sc, CAGE_T.lockDrop, (t) => {
      this.lockDy = -R(14 * (1 - E.inQuad(t)));
      this.place();
    });
    this.lockDy = 0;
    playV3('e_dawnShackle', { volume: 1, pan: panAt(lockAt(this.g).x) });
    this.setLock(0, { white: true, pop: true });
    const l = lockAt(this.g);
    this.twinkle(l.x, l.y + 3);
    const sp = new Sparks(sc, this.depthFront + 0.3);
    for (let i = 0; i < fxCount(6); i++) sp.add({ x: l.x + rr(-3, 3), y: l.y + 9, vx: rr(-50, 50), vy: -rr(20, 60), ay: 240, life: rr(160, 260), ramp: [PAL.white, PAL.gold4, PAL.gold3], fade: 0.4 });
    sp.close();
    void lightFlash(sc, l.x, l.y + 15, PAL.gold4, 20, 200, { intensity: 0.6, air: 0.6, floorY: cp(this.g.bars[this.g.kl], this.g.rB, 0).y });
    await wait(sc, 34);
    this.setLock(0);
    // the bob: down 2, up, 1, settle
    for (const d of [2, 0, 1, 0]) {
      this.lockDy = d;
      this.place();
      await wait(sc, 34);
    }
  }

  /** Tongue i lights: a white plate frame, a twinkle under it, the tick + tiny bell. */
  private lightTongue(i: number): void {
    const l = lockAt(this.g);
    playV3('e_dawnTongue', { volume: 0.85, pitch: [1, 1.122, 1.335][i], pan: panAt(l.x) });
    // the bolt turns its gilded face out: edge-on white, then lit (and the lock pops)
    this.setLock(i, { turning: i, step: 1, pop: true });
    bg(wait(this.scene, 34).then(() => this.alive && this.setLock(i + 1)));
    this.twinkle(l.x - LOCK_AX + TONGUE_X[i] + 1, l.y - LOCK_AY + TONGUE_Y + 2);
  }

  /** A 4-ray white twinkle at (x, y) for 3 frames. */
  private twinkle(x: number, y: number): void {
    const sp = new Sparks(this.scene, this.depthFront + 0.3);
    sp.add({ x, y, life: 100, ramp: [PAL.white, PAL.gold4], tex: TEX.plus, fade: 0.5 });
    sp.close();
  }

  /** The caged monsters go cold (an edge light drains down them), lean on the front bars and ease back. */
  private async cold(units: Sprite[]): Promise<void> {
    const sc = this.scene;
    const g = this.g;
    playV3('e_dawnCold', { volume: 0.8, pan: panAt(cp(g.cm, g.rm, 0).x) });
    this.coldOn(220);
    bg(wait(sc, 220).then(() => this.frostOn()));
    const leans: Promise<void>[] = [];
    let j = 0;
    for (const s of units) {
      if (!s.active || !s.visible) continue;
      const order = j++;
      bg(rimClimb(sc, s, { ramp: [PAL.water2, PAL.water3, PAL.water4], from: 'head', stepMs: 60, holdMs: 260, fadeMs: 180 }));
      // a cold breath: mist puffs off the top of the body
      const top = { x: s.x, y: s.getBounds().top + 4 };
      const mist = new Sparks(sc, this.depthFront + 0.07);
      for (let i = 0; i < fxCount(7); i++) {
        mist.add({ x: R(top.x + rr(-8, 8)), y: R(top.y + rr(0, 8)), vx: rr(-14, 14), vy: -rr(8, 22), drag: 1.5, life: rr(380, 620), delay: 60 + i * 25, ramp: [PAL.white, PAL.water4, PAL.water3, PAL.water2], wobble: 6, wobbleHz: 1, fade: 0.45 });
      }
      mist.close();
      const rest = { x: s.x, y: s.y };
      const sx = s.scaleX;
      const sy = s.scaleY;
      // LEAN toward the camera side (+row: screen (−x, +y)) — 5 px, a one-frame squash on contact, held, then back;
      // the monsters go one after another (a wave along the row)
      leans.push(
        (async () => {
          const steps: [number, number][] = [
            [-2, 1],
            [-4, 2],
            [-5, 2],
            [-5, 2],
            [-3, 1],
            [-1, 0],
          ];
          await wait(sc, 100 + order * CAGE_T.leanStagger);
          for (let k = 0; k < steps.length; k++) {
            if (!s.active) return;
            const [x, y] = steps[k];
            s.setPosition(R(rest.x + x), R(rest.y + y));
            if (k === 2) {
              // contact: squash for a frame, the bar flashes, frost puffs off it
              s.setScale(sx * 1.06, sy * 0.94);
              const bx = this.barFlash(s.x - 4);
              this.frostPuff(bx.x, bx.y);
              playV3('e_dawnLean', { volume: 0.4, pan: panAt(s.x) });
            } else if (k === 3) s.setScale(sx, sy);
            await wait(sc, CAGE_T.lean[k]);
          }
          if (s.active) s.setPosition(rest.x, rest.y).setScale(sx, sy);
        })(),
      );
    }
    await Promise.all(leans);
  }

  /** A small frost puff where a caged monster touched a bar: white / water4 motes spreading off the contact point. */
  private frostPuff(x: number, y: number): void {
    const sp = new Sparks(this.scene, this.depthFront + 0.08);
    for (let i = 0; i < fxCount(7); i++) {
      const a = rr(-Math.PI, Math.PI);
      sp.add({ x: x + rr(-1, 1), y: y + rr(-3, 3), vx: Math.cos(a) * rr(15, 35), vy: Math.sin(a) * rr(10, 25) - 6, drag: 2.5, life: rr(260, 420), ramp: [PAL.white, PAL.water4, PAL.water3, PAL.water2], fade: 0.5 });
    }
    sp.add({ x, y, life: 100, ramp: [PAL.white, PAL.water4], tex: TEX.plus, fade: 0.5 });
    sp.close();
  }

  /** The front bar nearest screen x flashes white for three frames (a monster leans on it). */
  private barFlash(x: number): XY {
    const g = this.g;
    let best = 1;
    for (let k = 1; k < g.bars.length - 1; k++) if (Math.abs(frontFoot(g, k).x - x) < Math.abs(frontFoot(g, best).x - x)) best = k;
    const f = frontFoot(g, best);
    const ras = new Raster(this.scene, f.x - 2, f.y - g.H, 5, g.H, this.depthFront + 0.03);
    ras.draw((r) => {
      for (let h = Math.round(g.H * 0.25); h < Math.round(g.H * 0.7); h++) {
        r.px(f.x, f.y - h, PAL.white);
        r.px(f.x - 1, f.y - h, PAL.white);
        r.px(f.x + 1, f.y - h, PAL.gold4);
      }
    });
    bg(wait(this.scene, 100).then(() => ras.destroy()));
    return { x: f.x, y: f.y - Math.round(g.H * 0.5) };
  }

  // ---------------------------------------------------------------- restore

  /** Show the cage at once with `n` tongues lit: `fade` (a late restore) fades it in; a staged board does not. */
  restore(n: number, fade = true): void {
    this.lit = n;
    this.bladesLit = true;
    this.front.setTexture(frontTex(this.scene, this.g, true));
    this.setSun(SUN_RISE);
    this.lockShown = true;
    this.setLock(n);
    this.setDoor(0);
    this.dy = 0;
    this.place();
    this.show(true);
    if (fade) {
      const imgs = [...this.backs, this.front, this.door, this.sun, this.chain, this.lock];
      for (const i of imgs) i.setAlpha(0.5);
      bg(wait(this.scene, 100).then(() => imgs.forEach((i) => i.active && i.setAlpha(1))));
    }
    this.lightsOn(fade ? 240 : 0);
    this.frostOn();
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
      playV3(last ? 'e_dawnLast' : 'e_dawnTick', { volume: 0.9, pan: panAt(l.x) });
      // the whole padlock flashes white and POPS (a gold halo, the eye goes to it), then the bolt TURNS (4 drawings)
      this.setLock(from, { white: true, pop: true });
      this.setBadge(from, false, { white: true });
      await wait(sc, 34);
      const tx = l.x - LOCK_AX + TONGUE_X[i] + 1;
      const ty = l.y - LOCK_AY + TONGUE_Y + 2;
      // the bell rings at 110 ms (the sound's strike): everything after it hangs off this
      bg(wait(sc, 110 - 34).then(() => this.bell()));
      for (let st = 0; st < 4; st++) {
        this.setLock(from - 1, { turning: i, step: st, pop: st < 2 });
        if (st === 1) {
          // edge-on: a burst big enough to read at 1× — two crosses, a spray and a small ring off the bolt
          this.setBadge(from - 1, false, { turning: i });
          const sp = new Sparks(sc, this.depthFront + 0.3);
          for (let j = 0; j < fxCount(9); j++) sp.add({ x: tx, y: ty + rr(-2, 3), vx: rr(-60, 60), vy: -rr(20, 80), ay: 240, life: rr(180, 300), ramp: [PAL.white, PAL.gold4, PAL.gold3], fade: 0.4 });
          sp.add({ x: tx, y: ty + 1, life: 140, ramp: [PAL.white, PAL.gold4], tex: TEX.plus, fade: 0.5 });
          sp.add({ x: tx + (i === 2 ? -6 : 6), y: ty - 4, vy: -10, life: 120, delay: 40, ramp: [PAL.white, PAL.gold4], tex: TEX.plus, fade: 0.5 });
          sp.close();
          bg(this.airRing(tx, ty + 1, 2, 9, 150));
        }
        await wait(sc, 45);
      }
      this.setLock(from - 1);
      this.lit = from - 1;
      if (!last) this.setBadge(from - 1);
      if (!last) {
        await wait(sc, Math.max(0, CAGE_T.tickMs - 34 - 180));
        return;
      }
      await wait(sc, Math.max(0, CAGE_T.springAt + 300 - 34 - 180));
      await this.release();
    } finally {
      this.busy--;
    }
  }

  /**
   * The bell's visual: the lock swings ±2 px three times, a gold ring spreads from it, a light pulse climbs from the
   * lock up the latch post, along the top rail and up the vault hoop to the sun, the sun flares, and a gold ripple
   * runs out along every sword from the middle.
   */
  private async bell(): Promise<void> {
    if (this.dead) return;
    const sc = this.scene;
    const g = this.g;
    const l = lockAt(g);
    const footY = cp(g.bars[g.kl], g.rB, 0).y;
    bg(floorRing(sc, l.x, footY, { r0: 4, r1: 34, ms: 360, ramp: [PAL.white, PAL.gold4, PAL.gold3, PAL.gold2], depth: DEPTH.TILE_FX + 2 }));
    void lightFlash(sc, l.x, l.y + 8, PAL.gold3, 26, 300, { floorY: footY, intensity: 0.6 });
    // the swing
    bg((async () => {
      for (const dx of [2, -2, 2, -1, 1, 0]) {
        if (this.dead) return;
        this.lockDx = dx;
        this.lockDy = dx === 0 ? 0 : Math.abs(dx) === 2 ? 0 : 1;
        this.place();
        await wait(sc, 50);
      }
    })());
    // the pulse: lock → up the latch post → along the top rail to the door's middle → up the hoop → the sun
    const top = cp(g.bars[g.kl], g.rB, g.H - 1);
    const midTop = cp(g.bars[g.kc], g.rB, g.H - 1);
    const path: XY[] = [{ x: l.x, y: l.y }, top, midTop];
    const N = 8;
    for (let i = 1; i <= N; i++) {
      const phi = (Math.PI / 2) * (i / N);
      path.push(cp(g.bars[g.kc], g.rm + (g.rB - g.rm) * Math.cos(phi), g.H + vrAt(g, g.bars[g.kc]) * Math.sin(phi)));
    }
    const s = sunAt(g);
    path.push({ x: s.x, y: s.y + 6 });
    const segs: number[] = [0];
    for (let i = 1; i < path.length; i++) segs.push(segs[i - 1] + Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y));
    const L = segs[segs.length - 1];
    const at = (d: number): XY => {
      d = Math.max(0, Math.min(L, d));
      let i = 1;
      while (i < segs.length - 1 && segs[i] < d) i++;
      const u = (d - segs[i - 1]) / Math.max(1e-6, segs[i] - segs[i - 1]);
      return { x: R(lerp(path[i - 1].x, path[i].x, u)), y: R(lerp(path[i - 1].y, path[i].y, u)) };
    };
    const ras = new Raster(sc, g.ox, g.oy - 10, g.w, g.h + 10, this.depthFront + 0.25);
    await run(sc, 200, (t) => {
      const d = L * E.inQuad(t);
      ras.draw((r) => {
        for (let j = 0; j < 6; j++) {
          const p = at(d - j * 2);
          const c = j < 2 ? PAL.white : j < 4 ? PAL.gold4 : PAL.gold3;
          r.px(p.x, p.y, c);
          if (j < 2) {
            r.px(p.x + 1, p.y, PAL.gold4);
            r.px(p.x - 1, p.y, PAL.gold4);
          }
        }
      });
    });
    ras.destroy();
    if (this.dead) return;
    // the sun flares; the ripple runs out along the swords
    this.setSun(this.sunLit, true);
    bg(wait(sc, 50).then(() => this.alive && this.setSun(this.sunLit)));
    void lightFlash(sc, s.x, s.y, PAL.gold4, 24, 260, { floorY: cp(g.cm, g.rm, 0).y, intensity: 0.6, air: 0.7 });
    const ks = swordKs(g);
    const cx = frontFoot(g, g.kc).x;
    const far = Math.max(...ks.map((k) => Math.abs(frontFoot(g, k).x - cx)));
    const bs = bladeSpan(g);
    const rip = new Raster(sc, g.ox, g.oy, g.w, g.h, this.depthFront + 0.03);
    await run(sc, 220, (_t, el) => {
      rip.draw((r) => {
        for (const k of ks) {
          const u = (el - (Math.abs(frontFoot(g, k).x - cx) / Math.max(1, far)) * 120) / 100;
          if (u < 0 || u > 1) continue;
          const f = this.bladeAt(k, 0);
          for (let h = bs.tip + 2; h < bs.guard; h++) r.px(f.x, f.y - h, u < 0.5 ? PAL.white : PAL.gold4);
          for (let x = -3; x <= 3; x++) r.px(f.x + x, f.y - (bs.guard + 1), u < 0.5 ? PAL.white : PAL.gold4);
        }
      });
    });
    rip.destroy();
  }

  /** The last tongue has turned: the padlock springs open and drops, the door creaks open, the cage is hauled up. */
  private async release(): Promise<void> {
    const sc = this.scene;
    const g = this.g;
    const l = lockAt(g);
    const floorY = cp(g.bars[g.kl], g.rB, 0).y + 3;
    playV3('e_dawnUnlock', { volume: 0.85, pan: panAt(l.x) });
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
    await wait(sc, 140);
    // the door creaks open (wide: a readable beat), the sun's ray fan collapses in three drawings, the cold leaves
    playV3('e_dawnDoor', { volume: 0.7, pan: panAt(cp(g.bars[g.kh], g.rB, 0).x) });
    bg(
      run(sc, 300, (t) => {
        if (this.dead) return;
        this.setDoor(90 * E.outQuad(t));
      }),
    );
    this.coldOff(300);
    this.frostOff();
    for (const k of [2, 1, 0]) {
      await wait(sc, 50);
      this.setSun(k, k === 2);
    }
    void this.sunPool?.fadeOut(300);
    this.sunPool = null;
    this.stopIdle?.();
    this.stopIdle = null;
    this.glint.setVisible(false);
    this.chainGlint.setVisible(false);
    await wait(sc, Math.max(0, CAGE_T.haulAt - 140 - 150));
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
   * Destroyed early: the cage's own BREAK. Two pale-gold frames; the chain SNAPS and whips up; every sword snaps (its
   * upper half flies off, spinning); the frame sags and splits at the door; then it COLLAPSES into its real pieces
   * (./_dawn_e_break.ts): bars, rails, hoops and posts fall, tumble, bounce on the floor and dissolve in steps.
   */
  async shatter(): Promise<void> {
    this.busy++;
    const sc = this.scene;
    const g = this.g;
    const T = CAGE_T;
    try {
      this.stopIdle?.();
      this.stopIdle = null;
      this.glint.setVisible(false);
      this.chainGlint.setVisible(false);
      this.frostOff();
      playV3('e_dawnBreak', { volume: 0.95, pan: panAt(cp(g.cm, g.rm, 0).x) });
      this.setWhite(true);
      this.setLock(this.lit, { white: true });
      this.setSun(SUN_RISE, true);
      this.setBadge(0);
      const s0 = sunAt(g);
      // the flash is in the AIR at the crown (no floor patch on the dark floor)
      void lightFlash(sc, s0.x, s0.y, PAL.gold4, 26, 180, { floorY: s0.y + 4, intensity: 0.5, air: 0.8 });
      await wait(sc, 34);
      this.setWhite(false);
      await wait(sc, 34);
      this.setLock(0, { open: true });
      this.setSun(0);
      this.coldOff(200);
      void this.sunPool?.fadeOut(200);
      this.sunPool = null;
      // ---- the chain snaps and whips up
      bg(this.chainWhip());
      // ---- every sword SNAPS: the front shows the planted stubs, the upper halves fly off spinning
      const bs = bladeSpan(g);
      const snapH = bs.tip + R((bs.guard - bs.tip) * 0.42);
      this.front.setTexture(frontTex(sc, g, true, false, true));
      const shards: Stick[] = [];
      for (const k of swordKs(g)) {
        const f = this.bladeAt(k, 0);
        const a = { x: f.x, y: f.y - snapH - 1 };
        const b = { x: f.x, y: f.y - (g.H + 4) };
        const side = f.x < cp(g.cm, g.rB, 0).x ? -1 : 1;
        shards.push({
          ...stickOf(a, b, { vx: side * rr(30, 70), vy: -rr(110, 170), va: side * rr(9, 15), floor: f.y + rr(4, 10), lit: PAL.white, shade: PAL.mist, w: 3, guardAt: (bs.guard - snapH) / (g.H + 4 - snapH), sword: 'top' }),
        });
      }
      const box = { x: g.ox - 60, y: g.oy - 80, w: g.w + 120, h: g.h + 110 };
      bg(debris(sc, shards, { depth: this.depthFront + 0.3, box, gravity: 820, holdMs: 100, maxMs: 600, onBounce: (x, y, first) => first && this.clink(x, y) }));
      const spk = new Sparks(sc, this.depthFront + 0.3);
      for (const k of swordKs(g)) {
        const f = this.bladeAt(k, snapH + 1);
        for (let i = 0; i < fxCount(3); i++) spk.add({ x: f.x, y: f.y, vx: rr(-50, 50), vy: -rr(20, 80), ay: 260, life: rr(160, 280), ramp: [PAL.white, PAL.gold4, PAL.gold3], fade: 0.4 });
      }
      spk.close();
      // ---- the frame sags and splits at the door; the padlock and the sun fall
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
      let sagDy = 0;
      await run(sc, T.sag, (t) => {
        if (this.dead) return;
        const k = E.inQuad(t);
        sagDy = R(6 * k);
        const sp2 = R(3 * k);
        const jud = Math.floor(t * 10) % 2;
        this.front.setPosition(g.ox - sp2 - jud, g.oy + sagDy + R(2 * k));
        right.setPosition(g.ox + sp2 + jud, g.oy + sagDy);
        this.backs.forEach((b, i) => b.setPosition(g.ox + backX[i] * R(2 * k), g.oy + R(sagDy * 0.6)));
        sun.setY(R(s0.y + 14 * k));
        if (lock.active) lock.setY(R(l0 + 8 * k));
      });
      right.destroy();
      // ---- the COLLAPSE: every piece falls on its own
      bg(shake(sc, 120, 1));
      playV3('e_dawnCollapse', { volume: 0.85, pan: panAt(cp(g.cm, g.rm, 0).x) });
      for (const i of [...this.backs, this.front, this.door]) i.setVisible(false);
      const { front, back } = this.pieces(sagDy, snapH);
      bg(debris(sc, back, { depth: this.depthBack, box, gravity: 900, holdMs: 80, maxMs: 440 }));
      bg(debris(sc, front, { depth: this.depthFront + 0.01, box, gravity: 900, holdMs: 80, maxMs: 440, onBounce: (x, y, first) => first && rnd() < 0.35 && this.clink(x, y) }));
      // the padlock and the sun fall and bounce
      const floorY = cp(g.bars[g.kl], g.rB, 0).y + 3;
      const sunFloor = cp(g.cm, g.rm, 0).y;
      bg(this.dropBounce(lock, floorY, 380));
      bg(this.dropBounce(sun, sunFloor, 420));
      const mid = cp(g.cm, g.rm, 0);
      bg(floorRing(sc, mid.x, mid.y, { r0: 10, r1: 52, ms: 280, ramp: [PAL.gold3, PAL.gold2, PAL.gold1], depth: DEPTH.TILE_FX + 2 }));
      await wait(sc, T.breakMs - 68 - T.sag);
    } finally {
      this.busy--;
    }
  }

  /** A small clink on a piece's floor contact: two gold sparks. */
  private clink(x: number, y: number): void {
    const sp = new Sparks(this.scene, this.depthFront + 0.3);
    for (let i = 0; i < fxCount(2); i++) sp.add({ x, y: y - 1, vx: rr(-40, 40), vy: -rr(20, 50), ay: 260, life: rr(120, 200), ramp: [PAL.white, PAL.gold4, PAL.gold2], fade: 0.4 });
    sp.close();
  }

  /** An image falls to `floorY` and bounces twice, then steps out. */
  private dropBounce(img: Phaser.GameObjects.Image, floorY: number, ms: number): Promise<void> {
    const y0 = img.y;
    const fall = Math.max(0, floorY - y0);
    return run(this.scene, ms, (t) => {
      if (!img.active) return;
      let y: number;
      if (t < 0.5) y = y0 + fall * E.inQuad(t / 0.5);
      else if (t < 0.72) y = floorY - 5 * Math.sin(((t - 0.5) / 0.22) * Math.PI);
      else if (t < 0.86) y = floorY - 2 * Math.sin(((t - 0.72) / 0.14) * Math.PI);
      else y = floorY;
      img.setY(R(y));
    }).then(async () => {
      if (!img.active) return;
      for (const a of [0.66, 0.33]) {
        await wait(this.scene, 50);
        if (img.active) img.setAlpha(a);
      }
      await wait(this.scene, 50);
      if (img.active) img.setVisible(false).setAlpha(1);
    });
  }

  /** The chain snaps: its free end whips up and sideways (a visible link segment flicking), then it runs out of the top. */
  private async chainWhip(): Promise<void> {
    const sc = this.scene;
    const g = this.g;
    const s = sunAt(g);
    const chain = this.chain;
    chain.setVisible(false);
    const topY = -12;
    const ras = new Raster(sc, s.x - 60, topY - 4, 120, s.y - topY + 20, this.depthFront + 0.04);
    const end0 = { x: s.x, y: s.y + CHAIN_DY };
    await run(sc, 300, (t) => {
      // the free end: up and out to the right, swinging back; the curve between it and the top anchor
      const k = E.outQuad(t);
      const ex = end0.x + R(26 * Math.sin(t * Math.PI * 1.4));
      const ey = R(lerp(end0.y, topY - 30, k));
      const amp = 16 * (1 - t);
      ras.draw((r) => {
        const pts: XY[] = [];
        const N = 18;
        for (let i = 0; i <= N; i++) {
          const u = i / N;
          const x = lerp(s.x, ex, u) + Math.sin(u * Math.PI) * amp * (i % 2 ? 1 : 1) * Math.sin(t * 9 + u * 3);
          const y = lerp(topY, ey, u);
          pts.push({ x: R(x), y: R(y) });
        }
        // ink, then the links: 2-px gold links, every other one lit
        for (let i = 1; i < pts.length; i++) {
          const a = pts[i - 1];
          const b = pts[i];
          r.line(a.x - 1, a.y, b.x - 1, b.y, PAL.ink);
          r.line(a.x + 2, a.y, b.x + 2, b.y, PAL.ink);
        }
        for (let i = 1; i < pts.length; i++) {
          const a = pts[i - 1];
          const b = pts[i];
          r.line(a.x, a.y, b.x, b.y, i % 2 ? PAL.gold4 : PAL.gold2);
          r.line(a.x + 1, a.y, b.x + 1, b.y, i % 2 ? PAL.gold3 : PAL.gold1);
        }
        // the broken end link: a white flick for the first frames
        if (t < 0.3) {
          const e = pts[pts.length - 1];
          r.px(e.x, e.y, PAL.white);
          r.px(e.x + 1, e.y, PAL.white);
          r.px(e.x, e.y + 1, PAL.gold4);
        }
      });
    });
    ras.destroy();
  }

  /**
   * The cage as its pieces at the collapse (the sag offset `dy`, swords already snapped at `snapH`): sticks with
   * their kicks — the bars (rods and the sword stubs) topple outward from the door, the top rails break into
   * segments that drop, the hoops and the ridge fall from the top, the posts lean and fall.
   */
  private pieces(dy: number, snapH: number): { front: Stick[]; back: Stick[] } {
    // round 3: FEWER, THICKER pieces (3-px bars, swords drawn as swords); anything whose floor is behind the front
    // rail (the vault, the dome, the ridge, the back side) falls in the BACK layer, behind the caged monsters
    const g = this.g;
    const front: Stick[] = [];
    const back: Stick[] = [];
    const n = g.bars.length - 1;
    const midX = cp(g.cm, g.rB, 0).x;
    const at = (c: number, r: number, h: number): XY => {
      const p = cp(c, r, h);
      return { x: p.x, y: p.y + dy };
    };
    const kick = (x: number, up = 1) => {
      const side = x < midX ? -1 : 1;
      return { vx: side * rr(15, 55), vy: -rr(20, 70) * up, va: side * rr(2, 7) };
    };
    const floorF = (c: number) => cp(c, g.rB, 0).y + rr(2, 6);
    const floorB = (c: number, r: number) => cp(c, r, 0).y - rr(1, 3);
    // the front bars: every second rod (whole), the sword stubs (tip … snap, drawn as blades)
    rodKs(g).forEach((k, i) => {
      if (i % 2) return;
      const a = at(g.bars[k], g.rB, 2);
      const b = at(g.bars[k], g.rB, g.H - 2);
      front.push(stickOf(a, b, { ...kick(a.x), floor: floorF(g.bars[k]), lit: PAL.gold3, shade: PAL.gold2, w: 3 }));
    });
    for (const k of swordKs(g)) {
      const a = at(g.bars[k], g.rB, 1);
      const b = at(g.bars[k], g.rB, snapH);
      front.push(stickOf(a, b, { ...kick(a.x, 0.5), floor: floorF(g.bars[k]), lit: PAL.white, shade: PAL.mist, w: 3, sword: 'tip', delay: R(rr(0, 60)) }));
    }
    // the door (its latch stile and its middle rail), the door posts and the corner posts
    for (const k of [g.kh, g.kl]) {
      const a = at(g.bars[k], g.rB, 0);
      const b = at(g.bars[k], g.rB, g.H + 1);
      front.push(stickOf(a, b, { ...kick(a.x, 0.6), floor: floorF(g.bars[k]), lit: PAL.gold4, shade: PAL.gold2, w: 3 }));
    }
    front.push(stickOf(at(g.bars[g.kh], g.rB, R(g.H * 0.5)), at(g.bars[g.kl], g.rB, R(g.H * 0.5)), { vx: rr(-10, 10), vy: -rr(40, 70), va: rr(-4, 4), floor: floorF(g.cm), lit: PAL.gold4, shade: PAL.gold2, w: 3 }));
    for (const [c, r] of [[g.c0, g.rB], [g.c1, g.rB], [g.c1, g.rA]] as const) {
      const a = at(c, r, 0);
      const b = at(c, r, g.H + 2);
      const s = { ...kick(a.x, 0.4), va: (a.x < midX ? -1 : 1) * rr(3, 6), lit: PAL.gold4, shade: PAL.gold2, w: 3 as const };
      if (r === g.rB) front.push(stickOf(a, b, { ...s, floor: floorF(c) }));
      else back.push(stickOf(a, b, { ...s, floor: floorB(c, r) }));
    }
    // the top rail (lintel) in long segments, the foot rail in longer ones
    for (let k = 0; k < n; k += 4) {
      const a = at(g.bars[k], g.rB, g.H - 1);
      const b = at(g.bars[Math.min(n, k + 4)], g.rB, g.H - 1);
      front.push(stickOf(a, b, { ...kick(a.x, 0.3), floor: floorF(g.bars[k]), lit: PAL.gold4, shade: PAL.gold2, w: 3, delay: R(rr(0, 50)) }));
    }
    for (let k = 0; k < n; k += 6) {
      const a = at(g.bars[k], g.rB, 0);
      const b = at(g.bars[Math.min(n, k + 6)], g.rB, 0);
      front.push(stickOf(a, b, { vx: rr(-10, 10), vy: -rr(30, 60), va: rr(-1, 1), floor: cp(g.bars[k], g.rB, 0).y + 3, lit: PAL.gold3, shade: PAL.gold1, w: 3 }));
    }
    // the right side: one rod and its top rail
    {
      const a = at(g.c1, g.rm, 2);
      const b = at(g.c1, g.rm, g.H - 2);
      back.push(stickOf(a, b, { vx: rr(20, 50), vy: -rr(20, 50), va: rr(2, 6), floor: floorB(g.c1, g.rm), lit: PAL.gold3, shade: PAL.gold1, w: 3 }));
      back.push(stickOf(at(g.c1, g.rA, g.H - 1), at(g.c1, g.rB, g.H - 1), { vx: rr(20, 40), vy: -rr(20, 40), va: rr(-3, 3), floor: floorB(g.c1, g.rm), lit: PAL.gold3, shade: PAL.gold1, w: 3 }));
    }
    // the vault: every fourth front hoop half as one arc piece (behind: it lands inside the cage), the DOME as its
    // three big ribs, the ridge in three pieces
    for (let k = 0; k <= n; k += 4) {
      const c = g.bars[k];
      if (Math.abs(c - g.cm) < g.DW) continue;
      const vr = vrAt(g, c);
      back.push(stickOf(at(c, g.rB, g.H), at(c, g.rm, g.H + vr), { ...kick(cp(c, g.rB, 0).x, 0.6), floor: floorB(c, g.rm), lit: PAL.gold3, shade: PAL.gold1, w: 2, delay: R(rr(0, 40)) }));
    }
    for (const d of [-g.DW * 0.6, 0, g.DW * 0.6]) {
      const c = g.cm + d;
      const vr = vrAt(g, c);
      const a = at(c, g.rB, g.H);
      const b = at(c, g.rm, g.H + vr);
      back.push(stickOf(a, b, { vx: (d === 0 ? rr(-10, 10) : Math.sign(d) * rr(20, 40)), vy: -rr(30, 60), va: rr(-5, 5), floor: floorB(c, g.rm), lit: PAL.gold4, shade: PAL.gold2, w: 3 }));
    }
    for (let i = 0; i < 3; i++) {
      const c0 = g.c0 + ((g.c1 - g.c0) * i) / 3;
      const c1 = g.c0 + ((g.c1 - g.c0) * (i + 1)) / 3;
      const a = at(c0, g.rm, g.H + R(vrAt(g, c0)));
      const b = at(c1, g.rm, g.H + R(vrAt(g, c1)));
      back.push(stickOf(a, b, { vx: rr(-20, 20), vy: -rr(10, 40), va: rr(-2, 2), floor: floorB((c0 + c1) / 2, g.rm), lit: PAL.gold4, shade: PAL.gold2, w: 3 }));
    }
    // the back side: every fourth rod, the back top rail in long segments, the left side
    for (let k = 2; k < n; k += 4) {
      const a = at(g.bars[k], g.rA, 2);
      const b = at(g.bars[k], g.rA, g.H - 2);
      back.push(stickOf(a, b, { vx: rr(-20, 20), vy: -rr(10, 40), va: rr(-5, 5), floor: floorB(g.bars[k], g.rA), lit: PAL.gold2, shade: PAL.gold1, w: 3 }));
    }
    for (let k = 0; k < n; k += 6) {
      const a = at(g.bars[k], g.rA, g.H - 1);
      const b = at(g.bars[Math.min(n, k + 6)], g.rA, g.H - 1);
      back.push(stickOf(a, b, { vx: rr(-10, 10), vy: -rr(10, 30), va: rr(-2, 2), floor: floorB(g.bars[k + 3] ?? g.bars[k], g.rA), lit: PAL.gold3, shade: PAL.gold1, w: 3 }));
    }
    {
      const a = at(g.c0, g.rm, 2);
      const b = at(g.c0, g.rm, g.H - 2);
      back.push(stickOf(a, b, { vx: -rr(20, 50), vy: -rr(20, 50), va: -rr(2, 6), floor: floorB(g.c0, g.rm), lit: PAL.gold2, shade: PAL.gold1, w: 3 }));
    }
    back.push(stickOf(at(g.c0, g.rA, 0), at(g.c0, g.rA, g.H + 1), { vx: -rr(10, 30), vy: -rr(10, 30), va: -rr(2, 5), floor: floorB(g.c0, g.rA), lit: PAL.gold3, shade: PAL.gold1, w: 3 }));
    return { front, back };
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    this.stopIdle?.();
    this.stopIdle = null;
    this.motes?.close();
    this.motes = null;
    this.frostOff();
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

interface FieldLike {
  unit(uid: Uid): { locked?: boolean; sprite: Sprite } | null | undefined;
  tileAt(p: PlayerId, spot: 'spellTrap', i: number): TileCard | null;
}

/** The caged monsters' sprites (the target's monster row, units with a visible sprite). */
function cagedOf(state: GameState, field: FieldLike, target: PlayerId): Sprite[] {
  const out: Sprite[] = [];
  for (const m of state.players[target].monsters) {
    if (!m) continue;
    const u = field.unit(m.uid);
    if (u && !u.locked && u.sprite.active && u.sprite.visible) out.push(u.sprite);
  }
  return out;
}

function caged(ctx: AnyCtx, target: PlayerId): Sprite[] {
  return cagedOf(ctx.state, ctx.views.field as unknown as FieldLike, target);
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
    cage.unitsFn = () => caged(ctx, target);
    const cev = evAt(ctx, parts.counter, 'counter');
    if (parts.counter >= 0) ctx.consumeAt(parts.counter);
    const played = new Set<number>();
    await cage.cast({
      lit: cev?.value ?? 3,
      onReach: (z) => {
        const ps: Promise<unknown>[] = [];
        for (const f of parts.flips) {
          if (f.zone !== z || played.has(f.i)) continue;
          played.add(f.i);
          ps.push(ctx.play(f.i));
        }
        return ps.length ? Promise.all(ps) : undefined;
      },
    });
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
  const target = other(ev.player);
  if (ev.value > ev.prev) {
    if (!c) {
      c = new DawnCage(sc, ev.uid, ev.player, ev.zone);
      c.tileRef = tile;
      c.unitsFn = () => caged(ctx, target);
      c.restore(ev.value);
    } else c.setCount(ev.value);
    return;
  }
  if (!c) {
    c = new DawnCage(sc, ev.uid, ev.player, ev.zone);
    c.tileRef = tile;
    c.unitsFn = () => caged(ctx, target);
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

/** Scenes whose Director has run an event (the staged-board build is only for the board as it was built). */
const seen = new WeakSet<Phaser.Scene>();

/** Build the cages of a board in `state` (staged / restored); `fade` for a late build. */
function buildCages(sc: Phaser.Scene, state: GameState, field: FieldLike, fade: boolean): Set<Uid> {
  const present = new Set<Uid>();
  state.players.forEach((p, pi) => {
    p.spellTraps.forEach((st, zi) => {
      if (!st || !st.faceUp) return;
      if (state.cards[st.uid]?.cardId !== ID) return;
      present.add(st.uid);
      const n = st.counter ?? 0;
      if (n <= 0 || dawnCasting.has(st.uid) || cageOf(sc, st.uid)) return;
      const c = new DawnCage(sc, st.uid, pi as PlayerId, zi);
      c.tileRef = field.tileAt(pi as PlayerId, 'spellTrap', zi);
      const target = other(pi as PlayerId);
      c.unitsFn = () => cagedOf(state, field, target);
      c.restore(n, fade);
    });
  });
  return present;
}

/** A staged / restored board shows its cage; a cage whose card is gone is removed. */
export function cageObserve(ctx: AnyCtx): void {
  const sc = ctx.scene;
  seen.add(sc);
  const present = buildCages(sc, ctx.state, ctx.views.field as unknown as FieldLike, true);
  for (const c of allCages(sc)) {
    if (!present.has(c.uid) && !c.busy && !dawnCasting.has(c.uid)) c.destroy();
    else if (!c.busy) c.unitsFn = () => caged(ctx, c.target);
  }
}

type NeonDuel = { state(): GameState; views: { field: unknown } };

/** The duel scene now running (its QA handle), or null. */
function liveDuel(): { scene: Phaser.Scene; state: GameState; field: FieldLike } | null {
  const neon = (globalThis as { __neon?: { game?: Phaser.Game; duel?: NeonDuel } }).__neon;
  const sc = neon?.game?.scene?.getScene?.('Duel') as Phaser.Scene | undefined;
  const duel = neon?.duel;
  if (!sc || !duel || !sc.sys?.isActive?.()) return null;
  try {
    return { scene: sc, state: duel.state(), field: duel.views.field as FieldLike };
  } catch {
    return null;
  }
}

let watching = false;

/**
 * The cage of a STAGED board is built with the board — before the first event — so a staged / restored board never
 * shows the cage popping in (the badge and the cage are there from frame 0). Runs now (the duel that loaded this
 * module) and on the first frame of every later duel (restart, a QA scenario), until its first event.
 */
export function installStageWatch(): void {
  if (watching) return;
  watching = true;
  const tryBuild = (): void => {
    const d = liveDuel();
    if (!d || seen.has(d.scene)) return;
    try {
      buildCages(d.scene, d.state, d.field, false);
    } catch (e) {
      console.error('[dawn cage] stage build failed', e);
    }
  };
  tryBuild();
  onDuelStart(() => {
    const neon = (globalThis as { __neon?: { game?: Phaser.Game } }).__neon;
    const sc = neon?.game?.scene?.getScene?.('Duel') as Phaser.Scene | undefined;
    if (!sc) return;
    sc.events.once(Phaser.Scenes.Events.UPDATE, tryBuild);
  });
}
