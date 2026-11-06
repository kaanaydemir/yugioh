// Talih Zarı (lucky_die) — v3 presentation (docs/v3/YENI_KARTLAR.md §7 S12; lane E). The v1 look keeps the generic
// spell activation and the placeholder die (b2/placeholders.ts): the hook steps aside without ?look=v3.
//
// "Altın, koyu noktalı büyük piksel zar atılır, izometrik dönüşle 3 kez seker, toz → yuvarlanır, N'de durur → her
//  noktadan bir altın kıvılcım canavarlara uçar, rozetler +N00. 6'da havai fişek ve akor; 1'de tek donuk 'tok'."
//
// The die is a real cube rasterised every frame (./_lucky_die_cube.ts): it tumbles through any angle on whole pixels,
// lands flat on each bounce, rolls edge over edge and settles with the rolled face UP. The face it shows is the engine's
// value: the tumble is computed backwards from the final pose, so every frame is consistent with where it ends.
//
// BEAT LIST (scene ms at 1×; × 1.35 in game time with the v3 tempo). Signature ≈ 2.8 s after the opening (D = the
// die's birth; numbers are DIE_T below). Measured (tools/measure.mjs, game ms, activation → input): six 4.68 s,
// three 4.23 s, one 4.02 s, set card 4.37 s; camera 0.
//   0      common v3 spell opening (spells/_kit): the card hovers beside its owner (a set card stands up on its tile),
//          "TALİH ZARI" plate, short hover (hold 200 → 130)
//   ~330   RELEASE: a gold orb leaves the card (a hand card: its top edge; a set card: its lower edge) for the caster's
//          cupped light just in front of it — always over the BOARD floor (handSpawn: a hand card hovers out over the
//          arena wall, so the die is born on the board edge in front of the card's top corner, clear of the duelist)
//   D+0    FORM: the die condenses there in four native sizes (h 3 → 5 → 7 → 9, 28 ms apart: a white, two hot-gold
//          silhouette frames, then its real faces), ten gold motes are pulled in, a gold light pool opens — e_dieForm
//   D+100  RATTLE: four hard shakes (46 ms; ±2 px, a quarter turn about a random axis each: the faces flicker), motes
//          spill off it — e_dieRattle (its knocks land on the shakes)
//   D+290  WIND-UP: the die dips back 3 px and up (anticipation, 56 ms)
//   D+346  THROW (from here until it lies still the die flies at DEPTH.FX: over every body and stat badge): a high arc (apex 42 px) to the first bounce, tumbling fast (4 quarter turns + a side wobble + a
//          yaw, stepped π/16 angles), its 2:1 ink shadow running over the floor, smaller the higher it is — e_dieThrow
//   D+646  BOUNCE 1: lands flat — "TA-K" (e_dieTak: corner + face slap), a 1-px dip, a ring of floor-grey puffs +
//          gold chips, a gold floor ring and a light flash; up again 16 px (180 ms, 2 quarter turns)
//   D+826  BOUNCE 2: "tak" (softer, higher), smaller dust; up 6 px (110 ms, 1 quarter turn)
//   D+936  BOUNCE 3: "tak" (softest) + a little dust; it ROLLS edge over edge twice (120 + 160 ms, the centre lifting
//          over the front edge each time, a puff on the first face landing) — e_dieRoll (knocks on the landings)
//   D+1216 TEETER: it rocks up on its front edge (80 ms) and falls back flat (30 ms) — e_dieStop (tick + last clack)
//   D+1326 STOP: the rolled face flashes gold4 for three frames, a gold floor ring, the pool swells.
//          ONE: no teeter, no flash — a single dull "tok" (e_dieDud), grey dust squeezed out sideways along the floor,
//          the die sags 1 px and its light dims
//   D+1386 PIPS LIFT: one pip after another (62 ms apart; the ONE's lone pip slowly, 300 ms) lifts out of the top face
//          (its socket goes dim) on a small arc to the FACE IN THE AIR 46 px above the die — the rolled face redrawn
//          flat and big, facing the viewer (5×5 gold pips in a 30×30 gold frame that inks itself in three steps), so
//          the number reads at a glance; each pip rings the next note of a rising major pentatonic run (e_diePip,
//          pitched per pip: the roll is COUNTED in notes)
//   +40    SPARKS: each pip in turn (36 ms apart) bursts in a 3-frame star and sends one gold spark per boosted
//          monster on a curved path (220 ms, a 4-px stepped trail); every arrival STEPS that monster's badge by
//          exactly +100, no roll (1700 → 1800 → 1900; e_dieTick pitched up the run, the plate blinks gold for two
//          frames, a small gold burst + light on its body) — the badge counts
//   last   every spark in: each monster's edge climbs gold (rimClimb), ONE gold number "+N00" pinned low on ITS OWN
//          body (./_lucky_die_number: a 3-px float, gone in 0.8 s, awaited — never above its head, which on this board
//          is the opponent's row; two that would touch fan apart sideways, 90 ms apart), e_dieBoost (rising run)
//   SIX:   as the face completes — e_dieJackpot (the struck pentatonic chord) and three fireworks rise from the die
//          and burst over the CASTER's boosted monsters (gold, the caster's colour, fire): rings in rings, blinking
//          glitter, a gold glitter rain onto each head; air light only — e_dieFirework ×3 (three pitches)
//   end    the die dissolves top-down into rising gold motes (e_dieFade, 240 ms), the light fades; the spent card is
//          born on the floor under it and leaves for the graveyard (cardLeaves)
// Where it lands: restSpot() scores a grid over the CASTER's side — its half of the bridge through its own monster
// row (never past the bridge's middle line) — from the live board: no body in front of or under the die, no stat badge
// under it, close to the boosted monsters (a short spark fan); the face in the air may slide sideways to keep clear
// of badges, enemy bodies and the portrait screens. At rest the die sits above the badges (FX − 10) unless a body
// stands in front of it. With the stock boards it lands on the caster's own empty lane.
// P2: everything mirrored — thrown from P2's side; its own monsters boosted.
// The diceRoll event is this card's (registerLaneE): the activation hook plays it inside its own scene; a diceRoll that
// reaches the director on its own (v3) plays the same die from the caster's cast spot.
// No camera move, no full-screen wash; every crisp thing on whole pixels, palette only.

import type Phaser from 'phaser';
import type { CardId } from '../../data/cards';
import type { GameEvent, PlayerId } from '../../engine/types';
import { PAL, PLAYER_RAMP } from '../../art/palette';
import { BOARD_COLS, BOARD_MID_COL, BOARD_ROWS, DEPTH, LANE_MID, LOOK_V3, type XY, duelistXY, isoToScreen, screenToIso, monsterRow, unitDepth, zoneXY } from '../../view/layout';
import { Raster, floorRing, onFrame, run } from '../../vfx/setpieces';
import { Sparks as PxSparks } from '../../vfx/combat';
import { wait } from '../../vfx/core';
import { fxRng, rimClimb, silhouetteOf } from '../_v3/spellfx';
import { boostNumber, numberWidth } from './_lucky_die_number';
import { panAt, play as playV3 } from '../_v3/sound';
import { cardLeaves } from '../_v3/card';
import { ARENA_NT } from '../../view/board-nt/flag';
import { SCREENS } from '../../view/board-nt/layout-nt';
import { registerCardHook } from '../api';
import { registerLaneE, type LaneECtx } from '../b2e/dispatch';
import { GOLD_FX, bg, castSpot, evAt, ip, lightFlash, lightPool, relax, setTileOf, spellOpening, type ActCtx, type AnyCtx } from './_kit';
import type { SfxName } from '../../audio/sfx';
import { KZ, PIPS, type M3, type DieLook, groundDir, mul, paintDie, pipOffsets, rot, upright } from './_lucky_die_cube';

const ID: CardId = 'lucky_die';
const R = Math.round;
const QT = Math.PI / 2;
const STEP = Math.PI / 16;

// ================================================================ timings (scene ms)

export const DIE_T = Object.freeze({
  /** Die formation sizes (half edges) and the gap between them. */
  formSizes: [3, 5, 7, 9] as readonly number[],
  formStep: 28,
  rattleAt: 100,
  shakes: 4,
  shakeMs: 46,
  windAt: 290,
  windMs: 56,
  throwAt: 346,
  /** Flight segments: the throw, then the two smaller bounces. */
  air: [300, 180, 110] as readonly number[],
  apex: [42, 16, 6] as readonly number[],
  roll: [120, 160] as readonly number[],
  teeterUp: 80,
  teeterDown: 30,
  /** After the stop: the flash, then the first pip. */
  pipsAfter: 60,
  pipGap: 62,
  pipRise: 110,
  /** The ONE's lone pip rises slowly. */
  pipRiseDud: 300,
  sparksAfter: 40,
  sparkGap: 36,
  sparkMs: 220,
  holdEnd: 60,
  fadeMs: 240,
});

/** Half edge of the die (world units): ≈ 36 px wide on screen. */
const H = 9;
/** The die's raster box. */
const BOX = 52;

// ================================================================ helpers

/** The BOARD floor's screen step per world unit along a ground direction (2:1 iso). */
function floorStep(d: readonly [number, number, number]): XY {
  return { x: d[0] - d[1], y: (d[0] + d[1]) / 2 };
}

const snap = (a: number): number => Math.round(a / STEP) * STEP;

interface DieState {
  /** Floor point under the die's centre (screen), the centre's height over it (world units). */
  fx: number;
  fy: number;
  z: number;
  /** Extra screen offset (rattle jitter, sag). */
  jx: number;
  jy: number;
  h: number;
  M: M3;
  look: DieLook;
  /** Dissolve: rows of the raster above this are gone (−1: whole). */
  cut: number;
  shadow: number;
  el: number;
  /** At rest on the floor: sorted with the bodies by its floor point; airborne / rolling it flies over every body and
   *  body (DEPTH.FX); low, it stays under the stat badges. */
  grounded: boolean;
  /** Its depth at rest: just under the badges, over the bodies, unless a body stands in front of it (then sorted by its floor). */
  restDepth: number;
}

interface DieView {
  s: DieState;
  /** Screen centre of the die. */
  centre(): XY;
  stop(): void;
}

/** The die's raster (sorted with the bodies by its floor point) and its floor shadow, redrawn every frame. */
function makeDie(sc: Phaser.Scene, s: DieState, seed: number): DieView {
  const ras = new Raster(sc, 0, 0, BOX, BOX, DEPTH.FX);
  const shadow = new Raster(sc, 0, 0, 48, 24, DEPTH.TILE_FX + 5);
  const motes = new PxSparks(sc, DEPTH.FX + 1);
  const rnd = fxRng(seed);
  const centre = (): XY => ({ x: R(s.fx + s.jx), y: R(s.fy - s.z * KZ + s.jy) });
  const stopFrame = onFrame(sc, (dt, el) => {
    if (!ras.alive) return false;
    s.el = el;
    const c = centre();
    const ox = c.x - BOX / 2;
    const oy = c.y - BOX / 2;
    ras.moveTo(ox, oy);
    // high in the air it flies over everything; low (rolling, teetering, at rest) it is sorted with the bodies by its
    // floor point, so it always stays UNDER the stat badges (FX − 20: they count while it lies there)
    ras.img.setDepth(s.grounded ? s.restDepth : s.z > H * 2.2 ? DEPTH.FX : unitDepth(s.fy) + 0.5);
    ras.begin();
    if (s.h > 0) {
      paintDie(ras.pc, BOX / 2, BOX / 2, s.h, s.M, s.look);
      ras.pc.outline(PAL.ink);
    }
    if (s.cut >= 0) {
      const pc = ras.pc;
      for (let y = 0; y < Math.min(BOX, s.cut); y++) for (let x = 0; x < BOX; x++) pc.erase(x, y);
      for (let y = s.cut; y < Math.min(BOX, s.cut + 2); y++)
        for (let x = 0; x < BOX; x++) {
          if (pc.get(x, y) === null) continue;
          pc.set(x, y, y === s.cut ? PAL.white : PAL.gold4);
          if (dt > 0 && (x + y) % 3 === 0 && rnd() < 0.5)
            motes.add({ x: ox + x, y: oy + y, vx: (rnd() - 0.5) * 18, vy: -(24 + rnd() * 40), drag: 1.2, life: 280 + rnd() * 260, colors: [PAL.white, PAL.gold4, PAL.gold3, PAL.gold2], shape: rnd() < 0.18 ? 'plus' : 'px', fadeAt: 1 });
        }
    }
    ras.end();
    // the shadow: a 2:1 ink oval on the floor, smaller and fainter the higher the die is
    shadow.moveTo(R(s.fx) - 24, R(s.fy) - 12);
    shadow.begin();
    if (s.shadow > 0 && s.h > 0) {
      const lift = Math.max(0, s.z - s.h);
      const k = Math.max(0.35, 1 - lift / 70);
      const rx = (s.h * 2 + 1) * k;
      const ry = rx / 2;
      const a = R(150 * k * s.shadow);
      for (let y = 0; y < 24; y++)
        for (let x = 0; x < 48; x++) {
          const qx = (x + 0.5 - 24) / rx;
          const qy = (y + 0.5 - 12) / ry;
          const q = qx * qx + qy * qy;
          if (q <= 1) shadow.pc.set(x, y, q < 0.45 ? PAL.ink : PAL.night0, q < 0.45 ? a : R(a * 0.7));
        }
    }
    shadow.end();
    return true;
  });
  return {
    s,
    centre,
    stop() {
      stopFrame();
      ras.destroy();
      shadow.destroy();
      motes.release();
    },
  };
}

/** A bounce's floor dust: a ring of floor-grey puffs thrown sideways + a few gold chips knocked off the die. */
function dust(sc: Phaser.Scene, at: XY, k: number, seed: number): void {
  const rnd = fxRng(seed);
  const sp = new PxSparks(sc, unitDepth(at.y) + 0.7);
  const n = R(10 * k) + 2;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rnd() * 0.3;
    const v = (22 + rnd() * 30) * (0.6 + k * 0.6);
    sp.add({ x: at.x + Math.cos(a) * 6, y: at.y + Math.sin(a) * 3, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.5 - 6, drag: 4, life: 300 + rnd() * 200 * k, colors: [PAL.mist, PAL.stone3, PAL.stone2, PAL.night3], shape: i % 3 === 0 ? 'puff' : 'sq', size: i % 3 === 0 ? 3 : 2, grow: 4, fadeAt: 0.5 });
  }
  for (let i = 0; i < R(5 * k); i++) {
    const side = i % 2 === 0 ? -1 : 1;
    sp.add({ x: at.x + side * 4, y: at.y - 2, vx: side * (20 + rnd() * 40), vy: -(50 + rnd() * 60) * k, ay: 420, life: 300 + rnd() * 160, colors: [PAL.white, PAL.gold4, PAL.gold3, PAL.gold2], shape: 'px', fadeAt: 1, floor: at.y + 2, bounce: 0.3 });
  }
  sp.release();
}

/**
 * A badge's count step: a 1-px gold4 frame round the plate for two frames (white corners on the first), drawn just over
 * the badge — the eye sees each +100 land.
 */
function badgeBlink(sc: Phaser.Scene, img: Phaser.GameObjects.Image): void {
  if (!img.active || !img.visible) return;
  const b = img.getBounds();
  const x0 = Math.floor(b.x) - 1;
  const y0 = Math.floor(b.y) - 1;
  const w = Math.ceil(b.width) + 2;
  const h = Math.ceil(b.height) + 2;
  const ras = new Raster(sc, x0, y0, w, h, img.depth + 1);
  let n = 0;
  onFrame(sc, () => {
    if (!ras.alive) return false;
    if (n >= 2) {
      ras.destroy();
      return false;
    }
    ras.begin();
    for (let x = 1; x < w - 1; x++) {
      ras.pc.set(x, 0, PAL.gold4);
      ras.pc.set(x, h - 1, PAL.gold3);
    }
    for (let y = 1; y < h - 1; y++) {
      ras.pc.set(0, y, PAL.gold4);
      ras.pc.set(w - 1, y, PAL.gold3);
    }
    if (n === 0) for (const [cx, cy] of [[1, 1], [w - 2, 1], [1, h - 2], [w - 2, h - 2]] as const) ras.pc.set(cx, cy, PAL.white);
    ras.end();
    n++;
    return true;
  });
}

// ================================================================ the face in the air (the readable number)

interface AirFace {
  /** Pip i arrives (rising from `from`); resolves when it is in place. */
  lift(i: number, from: XY, ms: number): Promise<void>;
  /** Pip i bursts (its sparks leave from it). */
  pop(i: number): void;
  /** World point of pip i. */
  at(i: number): XY;
  frame(on: boolean): void;
  destroy(): void;
}

/**
 * The rolled face redrawn flat and big, facing the viewer, above the die: a 30×30 gold frame (it draws itself in three
 * steps) and 5×5 pips (ink rim, gold3 body, gold4 cap, white glint) that rise into it one by one.
 */
function airFace(sc: Phaser.Scene, centre: XY, value: number, dud: boolean): AirFace {
  const S = 15; // half size of the frame
  const PS = 12; // pip spacing scale (face units → px)
  const W = 2 * S + 40;
  const ras = new Raster(sc, centre.x - W / 2, centre.y - W / 2, W, W + 60, DEPTH.FX_TOP + 4);
  const trail = new PxSparks(sc, DEPTH.FX_TOP + 3);
  const pips = PIPS[value];
  const spots = pips.map(([s, t]) => ({ x: centre.x + R(s * PS), y: centre.y + R(t * PS) }));
  const state = pips.map(() => ({ shown: false, popped: -1, x: 0, y: 0 }));
  let frameStep = 0;
  let alive = true;
  let now = 0;
  const stop = onFrame(sc, (_dt, el) => {
    if (!alive) return false;
    now = el;
    const ox = ras.x;
    const oy = ras.y;
    ras.begin();
    const pc = ras.pc;
    // the frame: corners first, then the full rounded square (gold2 line, gold3 inner line on the lit top-left)
    if (frameStep > 0) {
      const x0 = centre.x - S - ox;
      const y0 = centre.y - S - oy;
      const n = 2 * S;
      for (let i = 0; i <= n; i++) {
        const corner = i < 6 || i > n - 6;
        if (frameStep < 2 && !corner) continue;
        if (i === 0 || i === n) continue;
        const c = dud ? PAL.gold1 : PAL.gold2;
        pc.set(x0 + i, y0, frameStep >= 3 ? PAL.gold3 : c);
        pc.set(x0 + i, y0 + n, c);
        pc.set(x0, y0 + i, frameStep >= 3 ? PAL.gold3 : c);
        pc.set(x0 + n, y0 + i, c);
      }
    }
    state.forEach((p, i) => {
      if (!p.shown) return;
      const x = p.x - ox;
      const y = p.y - oy;
      if (p.popped >= 0) {
        // a three-frame star where the pip burst
        const age = el - p.popped;
        if (age > 150) return;
        const r = 1 + Math.floor(age / 40);
        const c = age < 50 ? PAL.white : age < 100 ? PAL.gold4 : PAL.gold3;
        for (let k = -r; k <= r; k++) {
          pc.set(x + k, y, c);
          pc.set(x, y + k, c);
        }
        if (age < 90) for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) pc.set(x + dx * (r - 1), y + dy * (r - 1), PAL.gold4);
        return;
      }
      // the pip: a 5×5 disc
      const body = dud ? PAL.gold2 : PAL.gold3;
      const cap = dud ? PAL.gold3 : PAL.gold4;
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) {
          if (Math.abs(dx) === 2 && Math.abs(dy) === 2) continue;
          const edge = Math.abs(dx) === 2 || Math.abs(dy) === 2;
          pc.set(x + dx, y + dy, edge ? (dx > 0 || dy > 0 ? PAL.gold1 : body) : dx <= 0 && dy <= 0 ? cap : body);
        }
      if (!dud && Math.floor(el / 120 + i) % 4 !== 0) pc.set(x - 1, y - 1, PAL.white);
    });
    pc.outline(PAL.ink);
    ras.end();
    return true;
  });
  return {
    async lift(i, from, ms) {
      const p = state[i];
      const to = spots[i];
      p.shown = true;
      const ctrl = { x: (from.x + to.x) / 2 + (to.x - from.x) * 0.2, y: Math.min(from.y, to.y) - 10 };
      const rnd = fxRng(i * 13 + value);
      await run(sc, ms, (t) => {
        const k = 1 - (1 - t) * (1 - t);
        const a = 1 - k;
        p.x = R(a * a * from.x + 2 * a * k * ctrl.x + k * k * to.x);
        p.y = R(a * a * from.y + 2 * a * k * ctrl.y + k * k * to.y);
        if (rnd() < 0.7) trail.add({ x: p.x + R((rnd() - 0.5) * 2), y: p.y + 2, vx: 0, vy: 6, life: 180 + rnd() * 120, colors: dud ? [PAL.gold2, PAL.gold1] : [PAL.gold4, PAL.gold3, PAL.gold2], shape: 'px', fadeAt: 1 });
      });
      p.x = to.x;
      p.y = to.y;
    },
    pop(i) {
      state[i].popped = now;
    },
    at: (i) => ({ ...spots[i] }),
    frame(on) {
      if (!on) {
        frameStep = 0;
        return;
      }
      frameStep = 1;
      bg(wait(sc, 50).then(() => (frameStep = 2)));
      bg(wait(sc, 100).then(() => (frameStep = 3)));
    },
    destroy() {
      if (!alive) return;
      alive = false;
      stop();
      ras.destroy();
      trail.release();
    },
  };
}

// ================================================================ the sparks (pip → monster)

interface Spark {
  from: XY;
  to: XY;
  ctrl: XY;
  born: number;
  ms: number;
  trail: XY[];
  done: boolean;
}

/**
 * One raster over the whole sparks' field: every spark is a 3×3 head (white core, gold4 arms) with a 4-px stepped trail
 * (gold4 → gold3 → gold2 → gold1) on a curved path. `fire` resolves on arrival.
 */
function sparkField(sc: Phaser.Scene, box: { x0: number; y0: number; x1: number; y1: number }) {
  const ras = new Raster(sc, box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0, DEPTH.FX_TOP + 6);
  const list: Spark[] = [];
  let now = 0;
  let alive = true;
  const TR = [PAL.gold4, PAL.gold3, PAL.gold2, PAL.gold1];
  const stop = onFrame(sc, (_dt, el) => {
    if (!alive) return false;
    now = el;
    ras.begin();
    const pc = ras.pc;
    for (const s of list) {
      if (s.done) continue;
      const t = Math.min(1, (now - s.born) / s.ms);
      // ease in: the spark gathers speed toward its monster
      const k = t * t * 0.6 + t * 0.4;
      const a = 1 - k;
      const p = { x: R(a * a * s.from.x + 2 * a * k * s.ctrl.x + k * k * s.to.x), y: R(a * a * s.from.y + 2 * a * k * s.ctrl.y + k * k * s.to.y) };
      const last = s.trail[0];
      if (!last || last.x !== p.x || last.y !== p.y) {
        s.trail.unshift(p);
        if (s.trail.length > 5) s.trail.pop();
      }
      for (let i = s.trail.length - 1; i >= 1; i--) pc.set(s.trail[i].x - ras.x, s.trail[i].y - ras.y, TR[Math.min(3, i - 1)]);
      const hx = p.x - ras.x;
      const hy = p.y - ras.y;
      pc.set(hx - 1, hy, PAL.gold4);
      pc.set(hx + 1, hy, PAL.gold4);
      pc.set(hx, hy - 1, PAL.gold4);
      pc.set(hx, hy + 1, PAL.gold4);
      pc.set(hx, hy, PAL.white);
      if (t >= 1) s.done = true;
    }
    ras.end();
    return true;
  });
  return {
    fire(from: XY, to: XY, ms: number, bend: number): Promise<void> {
      const mx = (from.x + to.x) / 2;
      const my = (from.y + to.y) / 2;
      // bend sideways off the straight line (perpendicular), and always up a little: a thrown arc
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const l = Math.hypot(dx, dy) || 1;
      const ctrl = { x: mx - (dy / l) * bend, y: my + (dx / l) * bend - 18 };
      const s: Spark = { from, to, ctrl, born: now, ms, trail: [], done: false };
      list.push(s);
      return wait(sc, ms);
    },
    destroy() {
      if (!alive) return;
      alive = false;
      stop();
      ras.destroy();
    },
  };
}

// ================================================================ fireworks (a six)

/**
 * A rocket climbs from `from` to `burst` (a 2-px white head over a gold-and-fire spark tail, wobbling as it climbs),
 * then BURSTS over a boosted monster: a white star flash, an outer ring of 2-px stars in the ramp (two speeds: a ring
 * inside a ring), an inner ring of plus-sparks, a crown of long-lived blinking glitter, and a short GOLD GLITTER RAIN
 * that falls onto the monster under it (`onto`: its head) — all stepped palette tones, no blend glow; the light layer
 * gives an air bloom only (no floor pool: the burst hangs in the air).
 */
async function firework(sc: Phaser.Scene, from: XY, burst: XY, onto: XY, ramp: readonly number[], seed: number, pitch: number): Promise<void> {
  const rnd = fxRng(seed);
  const tail = new PxSparks(sc, DEPTH.FX_TOP + 5);
  const head = new Raster(sc, 0, 0, 4, 4, DEPTH.FX_TOP + 6);
  const UP = 230;
  let px = from.x;
  let py = from.y;
  await run(sc, UP, (t, _el, dt) => {
    const k = 1 - (1 - t) * (1 - t);
    const x = R(from.x + (burst.x - from.x) * t + Math.sin(t * 11 + seed) * 1.5);
    const y = R(from.y + (burst.y - from.y) * k);
    head.moveTo(x - 1, y - 1);
    head.draw((g) => {
      g.px(x - 1, y - 1, PAL.white);
      g.px(x, y - 1, PAL.white);
      g.px(x - 1, y, PAL.gold4);
      g.px(x, y, PAL.gold4);
    });
    if (dt > 0) {
      const steps = Math.max(1, Math.ceil(Math.hypot(x - px, y - py) / 2));
      for (let i = 0; i < steps; i++) {
        const q = { x: px + ((x - px) * i) / steps, y: py + ((y - py) * i) / steps };
        tail.add({ x: q.x + (rnd() - 0.5) * 1.5, y: q.y + 1, vx: (rnd() - 0.5) * 10, vy: 6 + rnd() * 12, ay: 70, life: 220 + rnd() * 160, colors: [PAL.gold4, PAL.gold3, PAL.fire3, PAL.fire2, PAL.fire1], shape: 'px', fadeAt: 1 });
      }
    }
    px = x;
    py = y;
  });
  head.destroy();
  tail.release();
  playV3('e_dieFirework', { volume: 0.75, pan: panAt(burst.x), pitch });
  // air bloom only: the floor pool is sent far below the screen (a pool painted at the burst's height lay on the
  // tiles as a patch with no cause)
  void lightFlash(sc, burst.x, burst.y, ramp[3], 60, 560, { floorY: 640, intensity: 0.9, air: 1 });
  const sp = new PxSparks(sc, DEPTH.FX_TOP + 5);
  // the flash: a white star for a few frames
  sp.add({ x: burst.x, y: burst.y, life: 120, colors: [PAL.white, PAL.white, ramp[4]], shape: 'star', size: 9, fadeAt: 1 });
  // the outer rings: 2-px stars flying out, slowing, sagging, stepping down the ramp (a fast ring and a slower one)
  const n = 36;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rnd() * 0.06;
    const v = i % 2 === 0 ? 132 + (i % 3) * 8 : 92 + (i % 3) * 6;
    sp.add({ x: burst.x, y: burst.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.85, drag: 2.6, ay: 50, life: 700 + rnd() * 220, colors: [PAL.white, ramp[4], ramp[4], ramp[3], ramp[3], ramp[2], ramp[1]], shape: 'sq', size: 2, fadeAt: 1 });
  }
  // the inner ring: plus-sparks, slower, white-hot
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + 0.2;
    const v = 50 + (i % 2) * 12;
    sp.add({ x: burst.x, y: burst.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.85, drag: 2.6, ay: 30, life: 520 + rnd() * 140, colors: [PAL.white, PAL.gold4, ramp[4], ramp[3]], shape: 'plus', fadeAt: 1 });
  }
  // a crown of glitter that hangs and blinks
  for (let i = 0; i < 26; i++) {
    const a = rnd() * Math.PI * 2;
    const r = 12 + rnd() * 40;
    sp.add({ x: burst.x + Math.cos(a) * r, y: burst.y + Math.sin(a) * r * 0.8, vy: 8 + rnd() * 10, ay: 22, life: 640 + rnd() * 420, delay: 180 + rnd() * 240, colors: [PAL.white, PAL.gold4, ramp[4], ramp[3]], shape: 'px', flicker: true, fadeAt: 1 });
  }
  // the GOLD GLITTER RAIN onto the boosted monster below: it lands on its head and stops there
  for (let i = 0; i < 18; i++) {
    const x = onto.x + R((rnd() - 0.5) * 30);
    sp.add({ x: burst.x + (x - burst.x) * 0.3 + (rnd() - 0.5) * 8, y: burst.y + 6 + rnd() * 10, vx: (x - burst.x) * 0.7, vy: 30 + rnd() * 30, ay: 120, life: 520 + rnd() * 240, delay: 120 + i * 18, colors: [PAL.white, PAL.gold4, PAL.gold3, PAL.gold2], shape: i % 4 === 0 ? 'plus' : 'px', flicker: true, fadeAt: 1, floor: onto.y + 6 + R(rnd() * 6), bounce: 0.2 });
  }
  sp.release();
}

// ================================================================ the die scene

interface DieRun {
  player: PlayerId;
  value: number;
  /** Where the die forms (screen) and the floor under it. */
  spawn: XY;
  spawnFloor: number;
  /** statChange events of the boost (indices) and the spell's own graveyard trip (−1: none). */
  stats: number[];
  gi: number;
  /** The rest spot and path, when the caller already chose the spawn by it. */
  plan?: RestPlan;
}

type Box = { x0: number; y0: number; x1: number; y1: number };
const area = (a: Box, b: Box): number => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
/** The duelist avatar's box (its feet on duelistXY). */
const avatarBox = (p: PlayerId): Box => {
  const d = duelistXY(p);
  return { x0: d.x - 12, y0: d.y - 42, x1: d.x + 12, y1: d.y + 4 };
};

/** The throw's ground path: spawn floor → three bounce contacts (b1, b2, b3) → two rolls along `d` → rest. b1 / b2 may
 *  bend sideways off the straight line (`bend`, px, perpendicular on screen) so the contacts stay on free floor. */
interface DiePath {
  d: readonly [number, number, number];
  step: XY;
  b1: XY;
  b2: XY;
  b3: XY;
  /** The first leg's apex (world units): a long throw past a crowded row flies higher, over the stat badges. */
  apex0: number;
}

function planPath(f0: XY, rest: XY, bend: number, f1 = 0.62): DiePath {
  const d = groundDir(rest.x - f0.x, rest.y - f0.y);
  const step = floorStep(d);
  const rollLen = 4 * H; // two quarter rolls, 2h each (world units)
  const b3: XY = { x: rest.x - step.x * rollLen, y: rest.y - step.y * rollLen };
  const dx = b3.x - f0.x;
  const dy = b3.y - f0.y;
  const l = Math.hypot(dx, dy) || 1;
  const n = { x: -dy / l, y: dx / l };
  const f2 = f1 + (1 - f1) * 0.62;
  const b1: XY = { x: f0.x + dx * f1 + n.x * bend, y: f0.y + dy * f1 + n.y * bend };
  const b2: XY = { x: f0.x + dx * f2 + n.x * bend * 0.45, y: f0.y + dy * f2 + n.y * bend * 0.45 };
  const apex0 = Math.max(DIE_T.apex[0], Math.min(70, DIE_T.apex[0] + (Math.hypot(b1.x - f0.x, b1.y - f0.y) - 80) * 0.3));
  return { d, step, b1, b2, b3, apex0 };
}

interface Body {
  box: Box;
  floor: number;
  home: XY;
  badge: Box;
  mine: boolean;
}

function boardBodies(ctx: AnyCtx, player: PlayerId): Body[] {
  const bodies: Body[] = [];
  for (const p of [0, 1] as const)
    for (const slot of ctx.state.players[p].monsters) {
      if (!slot) continue;
      const u = ctx.unit(slot.uid);
      if (!u || u.retired) continue;
      const sil = silhouetteOf(u.sprite);
      const h = { x: R(u.home.x), y: R(u.home.y) };
      const box = sil ? { x0: sil.left, y0: sil.top, x1: sil.right, y1: sil.bottom } : { x0: h.x - 14, y0: h.y - 40, x1: h.x + 14, y1: h.y };
      const bi = u.badge?.image;
      const bb = bi && bi.visible ? bi.getBounds() : null;
      const badge = bb ? { x0: Math.floor(bb.x), y0: Math.floor(bb.y), x1: Math.ceil(bb.x + bb.width), y1: Math.ceil(bb.y + bb.height) } : { x0: h.x - 18, y0: h.y + 4, x1: h.x + 18, y1: h.y + 18 };
      bodies.push({ box, floor: h.y, home: h, badge, mine: p === player });
    }
  return bodies;
}

const pad = (b: Box, n: number): Box => ({ x0: b.x0 - n, y0: b.y0 - n, x1: b.x1 + n, y1: b.y1 + n });

/** What a floor contact costs: the die's box over bodies and badges, and its dust ring on a monster's own tile. */
function contactCost(p: XY, bodies: readonly Body[], k: number, avatars: readonly Box[] = []): number {
  const die: Box = { x0: p.x - 19, y0: p.y - 34, x1: p.x + 19, y1: p.y + 3 };
  let c = 0;
  for (const a of avatars) c += area(pad(a, 4), die) * 6 * k;
  for (const bd of bodies) {
    // a body in front would hide the bounce: the worst place for it
    c += area(die, bd.box) * (bd.floor > p.y ? 8 : 2) * k;
    c += area(die, pad(bd.badge, 2)) * 7 * k;
    // the dust ring (≈ 20 px across) must not land on a monster's tile, under its feet
    const q = Math.abs(p.x - bd.home.x) / 34 + Math.abs(p.y - bd.home.y) / 17;
    if (q < 1) c += (1 - q) * 2400 * k;
  }
  return c;
}

/** What a flight costs: the die's box sampled along a leg in the air, over badges (they count) and bodies. */
function flightCost(a: XY, b: XY, z0: number, apex: number, bodies: readonly Body[]): number {
  let c = 0;
  for (const t of [0.2, 0.4, 0.6, 0.8]) {
    const z = z0 + (H - z0) * t + 4 * apex * t * (1 - t);
    const x = a.x + (b.x - a.x) * t;
    const y = a.y + (b.y - a.y) * t - z * KZ;
    const die: Box = { x0: x - 18, y0: y - 18, x1: x + 18, y1: y + 18 };
    for (const bd of bodies) c += area(die, bd.badge) * 3 + area(die, bd.box) * 0.8;
  }
  return c;
}

/** The face in the air: straight over the die, or slid sideways / lifted when that is clearer of the stat badges
 *  (padded 6 px), enemy bodies, the duelists and the portrait screens. */
function faceSpot(q: XY, bodies: readonly Body[], avatars: readonly Box[], screens: readonly Box[]): { dx: number; dy: number; cost: number } {
  let best = { dx: 0, dy: 0, cost: Infinity };
  for (const dy of [0, -8, 6])
    for (const dx of [0, 14, -14, 26, -26, 38, -38, 50, -50]) {
      const cy = q.y - 55 + dy;
      const face: Box = { x0: q.x + dx - 17, y0: cy - 17, x1: q.x + dx + 17, y1: cy + 17 };
      let fs = Math.abs(dx) * 2 + Math.abs(dy) * 3;
      for (const bd of bodies) {
        fs += area(face, pad(bd.badge, 6)) * 4;
        if (!bd.mine) fs += area(face, bd.box) * 1.5;
      }
      for (const a of avatars) fs += area(face, a) * 2;
      for (const sr of screens) fs += area(face, sr) * 6;
      if (face.y0 < 52) fs += (52 - face.y0) * 30;
      if (fs < best.cost) best = { dx, dy, cost: fs };
    }
  return best;
}

export interface RestPlan extends XY {
  occluded: boolean;
  faceDx: number;
  faceDy: number;
  path: DiePath;
  score: number;
}

/**
 * Where the die comes to rest AND how it gets there: always on the CASTER's side — the free-est floor spot (whole
 * pixels) on a grid over the caster's half of the bridge back through its monster row to its front strip and the board's
 * side columns. Never past the bridge's middle line. A plan loses points for every body standing IN FRONT of the die
 * (it would hide it) or under it, for every stat badge under the die or under the face in the air (the badges must stay
 * readable while they count), for a duelist under it, for its distance from the boosted monsters, AND for its path:
 * each of the three bounce contacts and the two rolls is scored like the rest spot (a bounce never lands on a
 * monster's tile or throws its dust under one), the flight over badges and bodies costs too, and the bounces may bend
 * sideways off the straight line round occupied tiles.
 */
function restSpot(ctx: AnyCtx, player: PlayerId, from: XY, targets: readonly XY[]): RestPlan {
  const bodies = boardBodies(ctx, player);
  const avatars = [avatarBox(0), avatarBox(1)];
  const mr = monsterRow(player);
  const back = player === 0 ? 1 : -1;
  const mid = (monsterRow(0) + monsterRow(1)) / 2;
  const inner = mid + back * 0.4;
  const outer = mr;
  const aim = targets.length ? { x: targets.reduce((a, q) => a + q.x, 0) / targets.length, y: targets.reduce((a, q) => a + q.y, 0) / targets.length } : zoneXY(player, 'monster', LANE_MID);
  const screens: readonly Box[] = ARENA_NT ? SCREENS.map((r) => ({ x0: r.x, y0: r.y, x1: r.x + r.w, y1: r.y + r.h })) : [];
  const f0 = { x: R(from.x), y: R(from.y) };
  let best: RestPlan | null = null;
  for (let k = 0.15; k <= Math.min(Math.abs(mr - mid) + 1.0, (BOARD_ROWS - 1) / 2 - 0.1) + 1e-6; k += 0.05)
    for (let col = 0.2; col <= BOARD_COLS - 1.2 + 1e-6; col += 0.1) {
      const row = mid + back * k;
      const f = isoToScreen(col, row);
      const q = { x: R(f.x), y: R(f.y) };
      const reach = Math.hypot(q.x - f0.x, q.y - f0.y);
      if (reach < 52) continue;
      if (q.y < 108) continue;
      const die: Box = { x0: q.x - 19, y0: q.y - 34, x1: q.x + 19, y1: q.y + 3 };
      const d = (row - mid) * back;
      const dIn = (inner - mid) * back;
      const dOut = (outer - mid) * back;
      let score = Math.max(0, 80 - reach) * 12 + Math.hypot(q.x - aim.x, q.y - aim.y) * 0.9 + (d < dIn ? (dIn - d) * 160 : d > dOut ? (d - dOut) * 30 : 0);
      for (const bd of bodies) {
        score += area(die, bd.box) * (bd.floor > q.y ? 4 : 1.5);
        score += area(die, bd.badge) * 3;
      }
      for (const a of avatars) score += area(die, a) * 6;
      if (best && score >= best.score) continue;
      const fc = faceSpot(q, bodies, avatars, screens);
      score += fc.cost;
      if (best && score >= best.score) continue;
      // the path: the cheapest bend
      let pathBest: { path: DiePath; cost: number } | null = null;
      for (const f1 of [0.45, 0.62, 0.74, 0.84])
      for (const bend of [0, 12, -12, 24, -24, 36, -36]) {
        const path = planPath(f0, q, bend, f1);
        // the throw itself needs length: the first bounce well away from the hand, room for the arc
        const throwLen = Math.hypot(path.b3.x - f0.x, path.b3.y - f0.y);
        if (throwLen < 50) continue;
        let c = Math.abs(bend) * 0.6 + Math.max(0, 76 - throwLen) * 10;
        // every contact on the board's tiles (not off its edge)
        for (const b of [path.b1, path.b2, path.b3]) {
          const g = screenToIso(b.x, b.y);
          c += (Math.max(0, -0.1 - g.col) + Math.max(0, g.col - (BOARD_COLS - 0.9)) + Math.max(0, -0.1 - g.row) + Math.max(0, g.row - (BOARD_ROWS - 0.9))) * 900;
        }
        c += contactCost(path.b1, bodies, 1, avatars) + contactCost(path.b2, bodies, 0.8, avatars) + contactCost(path.b3, bodies, 0.8, avatars);
        const rollMid = { x: (path.b3.x + q.x) / 2, y: (path.b3.y + q.y) / 2 };
        c += contactCost(rollMid, bodies, 0.6);
        c += flightCost(f0, path.b1, 14, path.apex0, bodies) + flightCost(path.b1, path.b2, H, DIE_T.apex[1], bodies) + flightCost(path.b2, path.b3, H, DIE_T.apex[2], bodies);
        // the rolls must stay on the board
        if (!pathBest || c < pathBest.cost) pathBest = { path, cost: c };
      }
      if (!pathBest) continue;
      score += pathBest.cost;
      if (!best || score < best.score) best = { ...q, occluded: bodies.some((bd) => bd.floor > q.y && area(die, bd.box) > 0), faceDx: fc.dx, faceDy: fc.dy, path: pathBest.path, score };
    }
  if (!best) {
    const q = isoToScreen(BOARD_MID_COL, (inner + outer) / 2);
    best = { x: R(q.x), y: R(q.y), occluded: false, faceDx: 0, faceDy: 0, path: planPath(f0, q, 0), score: Infinity };
  }
  return best;
}

/**
 * Where the die is born out of a card in the hand: in the air over the BOARD floor (never over the arena wall), just
 * in front of the card's upper half and clear of the caster's duelist (the throw then never crosses the avatar).
 */
function handSpawn(player: PlayerId, card: XY): { spawn: XY; floor: number } {
  const dir = player === 0 ? 1 : -1;
  const target = { x: card.x + dir * 22, y: card.y - 18 };
  const av = avatarBox(player);
  const LIFT = 22;
  let best = { spawn: { x: target.x, y: target.y }, floor: target.y + LIFT };
  let bestScore = Infinity;
  for (let row = -0.25; row <= BOARD_ROWS - 0.75 + 1e-6; row += 0.05)
    for (let col = -0.2; col <= BOARD_COLS - 0.8 + 1e-6; col += 0.05) {
      const f = isoToScreen(col, row);
      const s = { x: R(f.x), y: R(f.y) - LIFT };
      const die: Box = { x0: s.x - 19, y0: s.y - 19, x1: s.x + 19, y1: s.y + 19 };
      const score = Math.hypot(s.x - target.x, s.y - target.y) + area(die, av) * 8;
      if (score < bestScore) {
        bestScore = score;
        best = { spawn: s, floor: R(f.y) };
      }
    }
  return best;
}

/** The boost's statChange indices right after the diceRoll at `di` (they are consumed by the scene). */
function statRun(ctx: AnyCtx, di: number): number[] {
  const out: number[] = [];
  for (let i = di + 1; i < ctx.events.length; i++) {
    const e = ctx.events[i];
    if (e.type !== 'statChange') break;
    if (!ctx.isConsumed(i)) out.push(i);
  }
  return out;
}

/** Floor points of the boosted monsters (the statChanges at `stats`) that are on screen. */
function targetHomes(ctx: AnyCtx, stats: readonly number[]): XY[] {
  const out: XY[] = [];
  for (const i of stats) {
    const e = evAt(ctx, i, 'statChange');
    const u = e ? ctx.unit(e.uid) : undefined;
    if (u && !u.retired && u.sprite.visible) out.push({ x: R(u.home.x), y: R(u.home.y) });
  }
  return out;
}

async function playDie(ctx: AnyCtx, r: DieRun): Promise<void> {
  const sc = ctx.scene;
  const T = DIE_T;
  const N = Math.max(1, Math.min(6, Math.round(r.value)));
  const dud = N === 1;
  const six = N === 6;
  const pan = panAt(r.spawn.x);
  const sfx = (name: SfxName, o: { volume?: number; pitch?: number; at?: number } = {}) => playV3(name, { volume: o.volume ?? 0.9, pitch: o.pitch, pan: o.at !== undefined ? panAt(o.at) : pan });
  const rnd = fxRng(r.spawn.x * 7 + N * 31 + r.player);

  // ---- who is boosted (their statChanges are this scene's): the rest spot is chosen near them
  const targets = r.stats
    .map((i) => ({ i, e: evAt(ctx, i, 'statChange') }))
    .filter((q): q is { i: number; e: Extract<GameEvent, { type: 'statChange' }> } => !!q.e)
    .map((q) => ({ ...q, u: ctx.unit(q.e.uid) }));
  for (const q of targets) ctx.consumeAt(q.i);
  const live = targets.filter((q) => q.u && !q.u.retired && q.u.sprite.visible);
  const aims = live.map((q) => {
    const p = q.u!.worldPoint('core');
    return { x: R(p.x), y: R(p.y) };
  });

  // ---- the path: spawn → three bounces → two rolls → rest (planned with the rest spot: every contact on free floor)
  const f0: XY = { x: r.spawn.x, y: r.spawnFloor };
  const rest = r.plan ?? restSpot(ctx, r.player, f0, live.map((q) => ({ x: R(q.u!.home.x), y: R(q.u!.home.y) })));
  const { d, step, b1, b2, b3, apex0 } = rest.path;
  const axis: readonly [number, number, number] = [-d[1], d[0], 0]; // z × d: a forward roll
  const lerpXY = (a: XY, b: XY, t: number): XY => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  const final = upright(N);
  console.log('DIEDBG', JSON.stringify({spawn:r.spawn,floor:r.spawnFloor,rest:{x:rest.x,y:rest.y,fdx:rest.faceDx,fdy:rest.faceDy},b1,b2,b3,apex0}));
  // the tumble, counted backwards from the rest pose: angles (radians) at each contact
  const TH = { start: -QT * 9, b1: -QT * 5, b2: -QT * 3, b3: -QT * 2 };
  const PH = { start: QT * 2, b1: QT, b2: 0 };
  const PS = { start: QT * 1.5, b1: 0 };
  const pose = (th: number, ph: number, ps: number): M3 => mul(rot([0, 0, 1], snap(ps)), mul(rot(axis, snap(th)), mul(rot(d, snap(ph)), final)));

  const S: DieState = { fx: r.spawn.x, fy: r.spawnFloor, z: (r.spawnFloor - r.spawn.y) / KZ, jx: 0, jy: 0, h: 0, M: pose(TH.start, PH.start, PS.start), look: {}, cut: -1, shadow: 1, el: 0, grounded: false, restDepth: unitDepth(rest.y) + 0.5 };
  const die = makeDie(sc, S, r.spawn.x * 3 + N);
  const pool = lightPool(sc, r.spawn.x, r.spawn.y, { color: PAL.gold3, radius: 26, floorY: r.spawnFloor, air: 0.5, airRadius: 14, intensity: 0, anim: 'breathe', fadeIn: 0 });
  pool.setIntensity(0.9, 120);
  const follow = onFrame(sc, () => {
    if (!pool.alive) return false;
    const c = die.centre();
    pool.setPosition(c.x, c.y, R(S.fy));
    return true;
  });

  let el = 0;
  const at = async (ms: number) => {
    if (ms > el) await wait(sc, ms - el);
    el = Math.max(el, ms);
  };

  // ---- FORM: four native sizes, a white then a hot frame, then the faces
  sfx('e_dieForm');
  void lightFlash(sc, r.spawn.x, r.spawn.y, PAL.gold4, 26, 260, { floorY: r.spawnFloor, intensity: 0.9 });
  T.formSizes.forEach((h, i) => {
    bg(wait(sc, i * T.formStep).then(() => {
      S.h = h;
      S.look = i === 0 ? { tint: 'white' } : i < 3 ? { tint: 'hot' } : {};
    }));
  });
  {
    const sp = new PxSparks(sc, DEPTH.FX + 2);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      sp.add({ x: r.spawn.x + Math.cos(a) * 18, y: r.spawn.y + Math.sin(a) * 12, tx: r.spawn.x, ty: r.spawn.y, life: 120 + i * 6, colors: [PAL.gold3, PAL.gold4, PAL.white], shape: i % 3 === 0 ? 'plus' : 'px', fadeAt: 1 });
    }
    sp.release();
  }

  // ---- RATTLE: hard shakes, a quarter turn each about a random axis (the faces flicker), motes spill off
  await at(T.rattleAt);
  S.h = H;
  S.look = {};
  sfx('e_dieRattle');
  const shakeAxes: readonly (readonly [number, number, number])[] = [[1, 0, 0], [0, 1, 0], [0, 0, 1], axis, d];
  const jit = [[2, -1], [-2, 1], [1, 1], [-2, -1], [2, 0], [-1, 1]] as const;
  const mote = new PxSparks(sc, DEPTH.FX + 2);
  for (let i = 0; i < T.shakes; i++) {
    const [jx, jy] = jit[i % jit.length];
    S.jx = jx;
    S.jy = jy;
    const ax = shakeAxes[Math.floor(rnd() * shakeAxes.length)];
    S.M = mul(rot(ax, QT * (rnd() < 0.5 ? 1 : -1)), S.M);
    const c = die.centre();
    for (let k = 0; k < 2; k++) mote.add({ x: c.x + R((rnd() - 0.5) * 20), y: c.y + R((rnd() - 0.5) * 12), vx: (rnd() - 0.5) * 20, vy: -(10 + rnd() * 20), drag: 1.5, life: 260 + rnd() * 180, colors: [PAL.gold4, PAL.gold3, PAL.gold2], shape: 'px', fadeAt: 1 });
    await wait(sc, T.shakeMs);
    el += T.shakeMs;
  }
  mote.release();
  S.jx = 0;
  S.jy = 0;
  // settle into the throw pose
  S.M = pose(TH.start, PH.start, PS.start);

  // ---- WIND-UP: dips back and up
  await at(T.windAt);
  const z0 = S.z;
  const back = { x: -step.x * 3, y: -step.y * 3 };
  await run(sc, T.windMs, (t) => {
    const k = Math.sin(t * Math.PI * 0.5);
    S.jx = R(back.x * 1.2 * k);
    S.jy = R(back.y * k);
    S.z = z0 + 3 * k;
  });
  el += T.windMs;
  S.jx = 0;
  S.jy = 0;
  // fold the wind-up into the floor point so the throw starts where the die is
  const start: XY = { x: f0.x + R(back.x * 1.2), y: f0.y + R(back.y) };

  // ---- THROW + BOUNCES
  await at(T.throwAt);
  sfx('e_dieThrow');
  pool.setIntensity(0.75, 120);
  const legs: { from: XY; to: XY; z0: number; ms: number; apex: number; th: [number, number]; ph: [number, number]; ps: [number, number] }[] = [
    { from: start, to: b1, z0: S.z, ms: T.air[0] + R((apex0 - T.apex[0]) * 2), apex: apex0, th: [TH.start, TH.b1], ph: [PH.start, PH.b1], ps: [PS.start, PS.b1] },
    { from: b1, to: b2, z0: H, ms: T.air[1], apex: T.apex[1], th: [TH.b1, TH.b2], ph: [PH.b1, PH.b2], ps: [0, 0] },
    { from: b2, to: b3, z0: H, ms: T.air[2], apex: T.apex[2], th: [TH.b2, TH.b3], ph: [0, 0], ps: [0, 0] },
  ];
  for (let li = 0; li < legs.length; li++) {
    const L = legs[li];
    await run(sc, L.ms, (t) => {
      const p = lerpXY(L.from, L.to, t);
      S.fx = p.x;
      S.fy = p.y;
      // a parabola from z0 down to resting height, the apex `apex` above the higher end
      const base = L.z0 + (H - L.z0) * t;
      S.z = base + 4 * L.apex * t * (1 - t);
      // spin fastest just after the hit, easing toward the next contact
      const k = 1 - (1 - t) * (1 - t) * 0.6 - 0.4 * (1 - t);
      S.M = pose(L.th[0] + (L.th[1] - L.th[0]) * k, L.ph[0] + (L.ph[1] - L.ph[0]) * k, L.ps[0] + (L.ps[1] - L.ps[0]) * k);
    });
    el += L.ms;
    S.fx = L.to.x;
    S.fy = L.to.y;
    S.z = H;
    S.M = pose(L.th[1], L.ph[1], L.ps[1]);
    // CONTACT: tak, dust, ring, light
    const g = [1, 0.62, 0.36][li];
    sfx('e_dieTak', { volume: 0.95 * (0.55 + g * 0.45), pitch: 1 + li * 0.07, at: L.to.x });
    dust(sc, { x: R(L.to.x), y: R(L.to.y) }, g, li * 17 + N);
    bg(floorRing(sc, R(L.to.x), R(L.to.y), { r0: 6, r1: R(16 + 18 * g), ms: 260 + 80 * g, ramp: GOLD_FX, depth: DEPTH.TILE_FX + 3, width: g > 0.5 ? 2 : 1 }));
    void lightFlash(sc, R(L.to.x), R(L.to.y) - 6, PAL.gold3, R(18 + 14 * g), 260, { floorY: R(L.to.y), intensity: 0.5 + 0.4 * g });
    // a one-frame dip into the floor on the hard first hit (the die's weight)
    if (li === 0) {
      S.jy = 1;
      bg(wait(sc, 34).then(() => (S.jy = 0)));
    }
  }

  // ---- ROLL: edge over edge, twice; then the teeter
  sfx('e_dieRoll', { at: b3.x });
  const rollFrom = (q: number): XY => ({ x: b3.x + step.x * 2 * H * q, y: b3.y + step.y * 2 * H * q });
  const pivotPose = (q: number, a: number) => {
    // α (0..π/2) of quarter q: the centre swings over the front bottom edge
    const off = H + (-H * Math.cos(a) + H * Math.sin(a));
    const p0 = rollFrom(q);
    S.fx = p0.x + step.x * off;
    S.fy = p0.y + step.y * off;
    S.z = H * (Math.cos(a) + Math.sin(a));
    S.M = pose(TH.b3 + QT * q + a, 0, 0);
  };
  for (let q = 0; q < 2; q++) {
    await run(sc, T.roll[q], (t) => pivotPose(q, snap(QT * (q === 0 ? t : t * t * 0.4 + t * 0.6))));
    el += T.roll[q];
    pivotPose(q, QT);
    if (q === 0) dust(sc, { x: R(S.fx), y: R(S.fy) }, 0.25, 99 + N);
  }
  // TEETER (not on a ONE: it just stops dead): up on its front edge, then back down flat
  const restP = rollFrom(2);
  const teeter = (a: number) => {
    // the pivot is the front bottom edge of the resting die: the centre starts at (−h, h) from it
    const off = -H * Math.cos(a) + H * Math.sin(a);
    S.fx = restP.x + step.x * (H + off);
    S.fy = restP.y + step.y * (H + off);
    S.z = H * (Math.cos(a) + Math.sin(a));
    S.M = pose(TH.b3 + QT * 2 + a, 0, 0);
  };
  if (!dud) {
    sfx('e_dieStop');
    await run(sc, T.teeterUp, (t) => teeter(snap(0.38 * Math.sin((t * Math.PI) / 2))));
    await run(sc, T.teeterDown, (t) => teeter(snap(0.38 * (1 - t * t))));
    el += T.teeterUp + T.teeterDown;
  }
  S.fx = restP.x;
  S.fy = restP.y;
  S.z = H;
  S.M = final;
  S.grounded = true;

  // ---- STOP: the rolled face is in
  const C = die.centre();
  if (dud) {
    sfx('e_dieDud', { volume: 1 });
    S.jy = 1;
    pool.setIntensity(0.35, 200);
    dust(sc, { x: R(S.fx), y: R(S.fy) }, 0.3, 7);
    {
      const sp = new PxSparks(sc, DEPTH.FX + 2);
      // a flat grey sigh of dust squeezed out from under it, sideways along the floor (the top face — the ONE — stays clear)
      for (let i = 0; i < 8; i++) {
        const side = i % 2 === 0 ? -1 : 1;
        sp.add({ x: C.x + side * 14, y: R(S.fy) - 1, vx: side * (14 + i * 3), vy: -(2 + (i % 3)), drag: 2, life: 480, colors: [PAL.stone3, PAL.stone2, PAL.night3], shape: 'puff', size: 3, grow: 3, fadeAt: 0.4 });
      }
      sp.release();
    }
  } else {
    S.look = { flash: N };
    bg(wait(sc, 50).then(() => (S.look = {})));
    bg(floorRing(sc, R(S.fx), R(S.fy), { r0: 10, r1: 40, ms: 380, ramp: GOLD_FX, depth: DEPTH.TILE_FX + 3 }));
    void lightFlash(sc, C.x, C.y, PAL.gold4, 34, 340, { floorY: R(S.fy), intensity: 0.9, air: 0.6 });
    pool.setIntensity(1, 160);
  }

  // ---- PIPS LIFT into the face in the air
  await wait(sc, T.pipsAfter);
  const faceAt: XY = { x: C.x + rest.faceDx, y: C.y - 46 + rest.faceDy };
  const face = airFace(sc, faceAt, N, dud);
  face.frame(true);
  const pipFrom = pipOffsets(final, H, N).map((o) => ({ x: C.x + R(o.x), y: C.y + R(o.y) }));
  const PENTA = [0, 2, 4, 7, 9, 12];
  const lifts: Promise<void>[] = [];
  const airLight = lightPool(sc, faceAt.x, faceAt.y, { color: PAL.gold3, radius: 18, floorY: R(S.fy), air: 0.6, airRadius: 20, intensity: 0, fadeIn: 0 });
  for (let i = 0; i < N; i++) {
    if (i > 0) await wait(sc, T.pipGap);
    S.look = { emptied: { value: N, n: i + 1 } };
    sfx('e_diePip', { pitch: Math.pow(2, (dud ? -5 : PENTA[i]) / 12), volume: dud ? 0.6 : 0.8, at: faceAt.x });
    lifts.push(face.lift(i, pipFrom[i], dud ? T.pipRiseDud : T.pipRise));
    airLight.setIntensity(dud ? 0.3 : 0.25 + (0.6 * (i + 1)) / N, 80);
  }
  await Promise.all(lifts);

  // ---- SIX: the jackpot chord + fireworks while the sparks fly
  const shows: Promise<void>[] = [];
  if (six) {
    sfx('e_dieJackpot', { volume: 1 });
    const ramps = [[PAL.gold0, PAL.gold1, PAL.gold2, PAL.gold3, PAL.gold4], PLAYER_RAMP[r.player], [PAL.fire0, PAL.fire1, PAL.fire2, PAL.fire3, PAL.fire4]] as const;
    // the bursts hang over the CASTER's boosted monsters (left → right), each raining glitter onto the head under it;
    // with fewer than three boosted monsters the rest burst beside the die
    const heads = live.map((q) => {
      const t = q.u!.worldPoint('top');
      return { x: R(t.x), y: R(t.y) };
    });
    heads.sort((p, q) => p.x - q.x);
    const pick: XY[] = heads.length >= 3 ? [heads[0], heads[Math.floor(heads.length / 2)], heads[heads.length - 1]] : [...heads];
    const extra = [{ x: C.x - 40, y: C.y - 30 }, { x: C.x + 40, y: C.y - 30 }, { x: C.x, y: C.y - 40 }];
    for (let i = 0; pick.length < 3; i++) pick.push(extra[i]);
    const pitches = [0.9, 1.06, 1.2];
    pick.forEach((h, i) => {
      // a little back toward the caster (the row behind a caster's head is the opponent's)
      const b = { x: h.x + (r.player === 0 ? -14 : 14), y: Math.max(52, h.y - 16) };
      shows.push(wait(sc, 40 + i * 120).then(() => firework(sc, { x: C.x + (i - 1) * 6, y: C.y - 10 }, b, h, ramps[i], 50 + i * 7, pitches[i])));
    });
  }

  // ---- SPARKS: each pip bursts and sends one spark to every boosted monster; each arrival = +100 on its badge
  await wait(sc, T.sparksAfter);
  let box = { x0: faceAt.x - 30, y0: faceAt.y - 30, x1: faceAt.x + 30, y1: faceAt.y + 30 };
  for (const a of aims) box = { x0: Math.min(box.x0, a.x - 30), y0: Math.min(box.y0, a.y - 50), x1: Math.max(box.x1, a.x + 30), y1: Math.max(box.y1, a.y + 30) };
  const field = sparkField(sc, box);
  const counts = live.map(() => 0);
  const arrivals: Promise<void>[] = [];
  for (let i = 0; i < N; i++) {
    if (i > 0) await wait(sc, T.sparkGap);
    face.pop(i);
    const from = face.at(i);
    live.forEach((q, m) => {
      const to = aims[m];
      const bend = ((i % 2 === 0 ? 1 : -1) * (10 + ((i * 7 + m * 5) % 9))) * (to.x >= from.x ? 1 : -1);
      arrivals.push(
        field.fire(from, to, T.sparkMs + m * 20, bend).then(() => {
          counts[m]++;
          const u = q.u!;
          if (u.retired) return;
          const k = counts[m];
          const e = q.e;
          // the badge COUNTS: it steps exactly +100 per spark (no roll in between: 1700 → 1800 → 1900 …; the last one
          // lands exactly on the engine's values) and its plate blinks gold for two frames
          if (k >= N) void u.setStats(e.atk, e.def, false);
          else void u.setStats(e.prevAtk + 100 * k, e.prevDef + 100 * k, false);
          badgeBlink(sc, u.badge.image);
          sfx('e_dieTick', { pitch: Math.pow(2, PENTA[Math.min(5, k - 1)] / 12), volume: 0.5, at: to.x });
          const sp = new PxSparks(sc, u.sprite.depth + 1);
          for (let j = 0; j < 5; j++) {
            const a = (j / 5) * Math.PI * 2 + k;
            sp.add({ x: to.x, y: to.y, vx: Math.cos(a) * 40, vy: Math.sin(a) * 30 - 10, drag: 3, life: 200, colors: [PAL.white, PAL.gold4, PAL.gold3], shape: 'px', fadeAt: 1 });
          }
          sp.release();
          void lightFlash(sc, to.x, to.y, PAL.gold3, 16, 200, { floorY: R(u.home.y), intensity: 0.45 });
        }),
      );
    });
  }
  // the face's frame goes once the last pip has burst
  bg(wait(sc, 160).then(() => face.frame(false)));
  void airLight.fadeOut(300);
  await Promise.all(arrivals);
  field.destroy();
  face.destroy();

  // ---- every spark is in: the edge climbs gold, ONE number per monster — pinned low on ITS monster's body,
  // never above its head (above a caster's head is the opponent's row on this board), a 3-px float, gone in 0.8 s;
  // two numbers that would touch fan apart sideways and pop 90 ms apart
  sfx('e_dieBoost', { volume: 0.85, at: aims[0]?.x ?? C.x });
  const spots: { x: number; y: number; w: number }[] = [];
  const finals = live.map(async (q, m) => {
    const u = q.u!;
    const e = q.e;
    const delta = Math.abs(e.atk - e.prevAtk) || 100 * N;
    const w = numberWidth(sc, delta);
    // low on its own body (its legs, just over its own badge): far from the row behind it, whose badges sit at this
    // monster's head height
    const core = { x: R(u.home.x), y: R(u.home.y) - 13 };
    let n = { x: core.x, y: core.y, w };
    let delay = m * 50;
    for (const sp of spots)
      if (Math.abs(n.x - sp.x) < (n.w + sp.w) / 2 + 2 && Math.abs(n.y - sp.y) < 12) {
        // fan away from the other number (toward this monster's own side of it), and come a beat later
        const side = core.x >= sp.x ? 1 : -1;
        n = { ...n, x: sp.x + side * R((n.w + sp.w) / 2 + 3) };
        delay += 90;
      }
    spots.push(n);
    await wait(sc, delay);
    if (u.retired) return;
    const rim = rimClimb(sc, u.sprite, { ramp: [PAL.gold2, PAL.gold3, PAL.gold4], from: 'feet', stepMs: 45, holdMs: 140, fadeMs: 120, depth: u.sprite.depth + 0.6 });
    await Promise.all([rim, boostNumber(sc, n.x, n.y, delta, { rise: 3 })]);
  });
  // statChanges of monsters that are not on screen just settle
  for (const q of targets) if (!live.includes(q) && q.u && !q.u.retired) void q.u.setStats(q.e.atk, q.e.def, false);
  await wait(sc, T.holdEnd);

  // ---- the die dissolves; the spent card leaves for the graveyard from under it
  sfx('e_dieFade', { volume: 0.7 });
  void pool.fadeOut(T.fadeMs + 100);
  let send: Promise<void> = Promise.resolve();
  const g = evAt(ctx, r.gi, 'toGraveyard');
  if (g && !ctx.isConsumed(r.gi)) {
    ctx.consumeAt(r.gi);
    send = cardLeaves(ctx, { owner: g.owner, cardId: g.cardId, from: { x: R(S.fx), y: R(S.fy) + 2 }, delay: 120 });
  }
  await run(sc, T.fadeMs, (t) => {
    S.cut = Math.floor((t * BOX) / 2) * 2;
    S.shadow = 1 - t;
  });
  follow();
  die.stop();
  await Promise.all([...finals, ...shows.map((p) => p.catch(() => undefined))]);
  await send;
}

// ================================================================ the activation

registerCardHook(ID, 'activate', async (ctx: ActCtx) => {
  if (!LOOK_V3) return ctx.base();
  const ev = ctx.ev;
  const player = ev.player;
  const di = ctx.findType('diceRoll', (e) => e.sourceUid === ev.uid, { until: (e) => e.type === 'activate' || e.type === 'turnStart' });
  const set = setTileOf(ctx);
  const op = await spellOpening(ctx, { uid: ev.uid, cardId: ev.cardId, player, from: set ? 'set' : 'hand', zone: ev.zone, hold: 200, releaseFrom: set ? 'bottom' : 'top', setRelease: 'flow' });
  relax(ctx, 300);
  const roll = evAt(ctx, di, 'diceRoll');
  if (!roll) {
    await op.close();
    return;
  }
  ctx.consumeAt(di);
  const stats = statRun(ctx, di);
  const gi = ctx.findType('toGraveyard', (e) => e.uid === ev.uid && e.from === 'resolved', { from: di + 1 + stats.length, until: (e) => e.type === 'activate' || e.type === 'turnStart' });
  // the die forms in the caster's cupped light just in front of the card, always over the board floor (a hand card
  // hovers beside its duelist, out over the arena wall: the die is born on the board edge in front of its top corner)
  const c = ip(op.center);
  const dir = player === 0 ? 1 : -1;
  // a set card: the die is born beside its tile, on the side whose throw runs clearest (the plan scores the path)
  const homes = targetHomes(ctx, stats);
  let born = set ? { spawn: { x: c.x + dir * 22, y: c.y + 4 }, floor: R(ip(set.home).y) } : handSpawn(player, c);
  let plan = restSpot(ctx, player, { x: born.spawn.x, y: born.floor }, homes);
  if (set) {
    const alt = { spawn: { x: c.x - dir * 22, y: c.y + 4 }, floor: R(ip(set.home).y) };
    const altPlan = restSpot(ctx, player, { x: alt.spawn.x, y: alt.floor }, homes);
    if (altPlan.score < plan.score) {
      born = alt;
      plan = altPlan;
    }
  }
  const floor = born.floor;
  const spawn: XY = born.spawn;
  await op.release(spawn, { path: 'arc', lift: 10, ms: 140, size: 2, ramp: GOLD_FX, floorTo: floor });
  await playDie(ctx, { player, value: roll.value, spawn, spawnFloor: floor, stats, gi, plan });
});

// ================================================================ a diceRoll of this card on its own (v3)

registerLaneE(
  'diceRoll',
  (ctx: LaneECtx<'diceRoll'>) => LOOK_V3 && ctx.ev.sourceUid !== null && ctx.cardId(ctx.ev.sourceUid) === ID,
  async (ctx: LaneECtx<'diceRoll'>) => {
    const ev = ctx.ev;
    const c = castSpot(ev.player);
    const stats = statRun(ctx, ctx.index);
    const gi = ctx.findType('toGraveyard', (e) => e.uid === ev.sourceUid && e.from === 'resolved', { from: ctx.index + 1 + stats.length, until: (e) => e.type === 'activate' || e.type === 'turnStart' });
    const born = handSpawn(ev.player, c);
    await playDie(ctx, { player: ev.player, value: ev.value, spawn: born.spawn, spawnFloor: born.floor, stats, gi });
  },
);
