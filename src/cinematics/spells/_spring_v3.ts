// Şifa Pınarı (healing_spring) — the v3 look. Lane A5-A step A-6 (docs/v3/A5_PLAN.md §3.5: "kontrollü
// iyileştirme akışı, düellocunun kendisinde"). Behind V3_A5_A only: healing_spring.ts hands its
// 'activate' hook over on its first line; v1 and the plain v3 look run the old code unchanged.
//
// Times are scene ms from activate at 1× (hand; a set card stands up on its own tile instead of flying):
//   0–320    the A2 opening (spellOpeningV3, hold 120): the card beside its owner, the duelist's 'command'
//   320      RELEASE: a two-frame white silhouette; the card's pixels pour into an orb at its BOTTOM edge
//            (releaseFrom 'bottom'; a set card's own pixels, setRelease 'flow') and the orb hops down
//            onto the rune ring under it — a set card's into its own tile — in 150 ms. whoosh (A2 kit),
//            mark `release`
//   470      ERUPT: the pool opens on the floor (a dark water disc inside two stepped rings, the spring's
//            light lying round it as a teal0 band), a stepped shock ring runs out to 56 px, and the
//            SIGNATURE fountain shoots up one height per frame (14 → 30 → 48 → 64 → 76 → 86 → 82 →
//            80 px: never smaller than the old 82-px geyser — the user's rule of 24 Oct): a stepped jet
//            11 → 9 → 7 px wide (water4 lit edge, white core, teal4 … teal1; no outline), a crown
//            folding over, water curtains falling from it to a 27-px ring (53 px across, the old
//            geyser's 52 at least; four behind, four in front, breaking into drops), spray thrown off
//            the crown, ripples running out on the pool, a teal light flash and a caustic pool.
//            springRise, mark `erupt`
//   crest    DROPS: 6 gem drops (white core + water4, a 9-px teal streak) 36 ms apart on short arcs
//            from the crown's side to the duelist's chest; on each landing a 2-frame "+" glint on him. springDrop, one
//            pentatonic step higher each ("it fills up"), mark `drop:<i>`
//   1st drop the heal: ctx.play(lpGain, { delivered: true }) → the LP presentation (lane A6-B's
//            V3HOOKS.presentHeal when filled, else today's presentHeal; contract S-14); a teal 1-px edge
//            light climbs the duelist's outline (rimClimb) — mark `heal`
//   3rd drop the duelist cheers (victory, then back to idle)
//   last+40  SETTLE: the jet sinks in six steps, the curtains drain, the crown splashes down, the pool's
//            rings spread and step down the teal ramp to nothing; the spent card is born in the pool and
//            leaves for the graveyard (cardLeaves). springSettle, mark `settle`
//   ≤ 1400   the input comes back (A5 §6.3); the pool's last steps run on
// Place: beside the duelist, off the board (castSpot / castFloor): it covers no monster. A set card's
// spring stands on its own tile: a monster behind it stays readable through the 9-px jet and the
// broken 1-px curtains (EF-2: never > 50 % of a body). P2: castSpot / castFloor mirrored (upper right);
// the drawings are not mirrored (their light stays at the screen's top left).
// No camera move (only today's relax() safety), no full-screen wash, no whole-sprite tint.
// REDUCED_MOTION (A5 §3.0 / §6.4, step A-8): the jet stops at its full 80 px (no crest overshoot), the spray
// and the crown's splash are halved; every time stays the same.

import type Phaser from 'phaser';
import type { PlayerId } from '../../engine/types';
import { PAL } from '../../art/palette';
import { FOUNTAIN_H, fountainTop, paintFountain, paintFountainPool } from '../../art/spellmotifs-v3';
import { DEPTH, type XY, unitDepth } from '../../view/layout';
import { REDUCED_MOTION } from '../../view/v3/motion';
import { wait } from '../../vfx/core';
import { Raster, onFrame } from '../../vfx/setpieces';
import { Sparks as PxSparks } from '../../vfx/combat';
import { fx } from '../api';
import { cardLeaves } from '../_v3/card';
import { panAt, play as playV3 } from '../_v3/sound';
import { dropArcs, fxCount, fxRng, rimClimb } from '../_v3/spellfx';
import { bg, castFloor, castSpot, evAt, fs, idxOf, ip, lightFlash, lightPool, relax, setTileOf, spellOpening, type ActCtx } from './_kit';

// ================================================================ the plan (pure; the tests read it)

/** Scene timings (ms at 1×) and sizes of the v3 spring (A5 §3.5; heights: the user's rule of 24 Oct). */
export const SPRING_V3 = Object.freeze({
  /** The opening's hold (spellOpeningV3 halves it: 100 ms). */
  openHold: 200,
  /** The orb's hop from the card's bottom edge down to the floor / tile. */
  orbMs: 130,
  orbLift: 16,
  /** The jet's height on each rendered frame from the eruption (one step per frame, never skipped). */
  rise: [14, 30, 48, 64, 76, 86, 82, FOUNTAIN_H] as readonly number[],
  /** …and while it sinks (one step per two frames). */
  sink: [62, 44, 26, 12, 4, 0] as readonly number[],
  /** The pool's radius (rx) per two frames from the eruption; then it holds the last (the curtains land inside it). */
  pool: [8, 12, 16, 20, 24, 28] as readonly number[],
  /** The light band round the pool at full size. */
  halo: 6,
  /**
   * The curtains' floor ring and their fall from the crown (ms, from the jet's 4th height). 27: the
   * curtains spread 53 px, never narrower than the old geyser's 52 (the user's rule of 24 Oct).
   */
  reach: 27,
  curtainFallMs: 170,
  /** The eruption's shock ring: out to 56 px (the old floorRing r1) in 18 frames. */
  shockR: [10, 56] as readonly number[],
  shockFrames: 18,
  /** The drops: count, launch gap, flight, arc height; the first leaves on the jet's crest frame. */
  drops: 6,
  dropGap: 36,
  dropMs: 110,
  /** The drops' trail (px, stepping down the teal ramp): a stream that reads at 1×. */
  dropTrail: 9,
  dropApex: 12,
  /** The rise frame (index into `rise`) the first drop leaves on: the crest (86 px). */
  dropFrame: 5,
  /** The pool's spread and fade (frames per step) after the jet has sunk. */
  fadeSteps: 4,
  fadeFrames: 3,
  /** The spent card is born in the pool this long after the settle starts (the jet has mostly sunk). */
  cardAfter: 90,
  /** The water's light climbing the duelist (rimClimb), darkest step first. */
  rim: [PAL.teal1, PAL.teal2, PAL.teal3] as readonly number[],
});

/**
 * The jet's height on rise frame `i` (one height per rendered frame). With reduced motion (A5 §3.0 / §6.4,
 * step A-8) it never passes the full FOUNTAIN_H — no crest overshoot — on the very same frames.
 */
export function riseHeight(i: number, reduced: boolean = REDUCED_MOTION): number {
  const h = SPRING_V3.rise[Math.max(0, Math.min(SPRING_V3.rise.length - 1, i))];
  return reduced ? Math.min(FOUNTAIN_H, h) : h;
}

/** The drops' pitch ladder: A minor pentatonic upward from the recipe's A5 (semitones). */
export const DROP_STEPS: readonly number[] = [0, 3, 5, 7, 10, 12];

/** The pitch multiplier of drop `i` (each drop one pentatonic step higher: "it fills up"). */
export function dropPitch(i: number): number {
  return Math.pow(2, DROP_STEPS[Math.max(0, Math.min(DROP_STEPS.length - 1, i))] / 12);
}

/**
 * Where the spring stands (the floor point of its jet): beside the caster's duelist on the cast
 * floor for a hand card, the card's own tile for a set card.
 */
export function springSpot(player: PlayerId, setHome: XY | null): XY {
  if (setHome) return { x: Math.round(setHome.x), y: Math.round(setHome.y) };
  const c = castSpot(player);
  return { x: c.x, y: castFloor(c) };
}

// ================================================================ the fountain (runtime)

interface Fountain {
  /** Resolves on the frame the jet stands at its full height. */
  readonly risen: Promise<void>;
  /** Resolves on rise frame SPRING_V3.dropFrame (the crest): the drops leave. */
  readonly crest: Promise<void>;
  /** The point drops leave from: the crown's side facing `toward` (whole pixels). */
  spout(toward: XY): XY;
  /** Sink, drain, splash and fade; resolves when the pool is gone (the fountain removes itself). */
  settle(): Promise<void>;
  destroy(): void;
}

/** Spray off the crown: no white in it (the drops into the duelist are the only white things in the air). */
const SPRAY = [PAL.water4, PAL.teal4, PAL.teal3, PAL.teal2] as const;
const SHOCK = [PAL.white, PAL.teal4, PAL.teal3, PAL.teal2, PAL.teal1] as const;

/**
 * The signature fountain on `at` (its jet's floor point). Two rasters: the floor (pool, light band,
 * shock ring, ripples) under everything standing, and the fountain itself sorted with the units by
 * its floor y; spray on the pixel particle layer. Every step is one rendered frame at most, so 2× / 3×
 * never skips a height (SÜ-3).
 */
function springFountain(sc: Phaser.Scene, at: XY, seed: number): Fountain {
  const S = SPRING_V3;
  const bx = Math.round(at.x);
  const by = Math.round(at.y);
  const rnd = fxRng(seed);
  const floorR = S.shockR[1] + 2;
  const floor = new Raster(sc, bx - floorR - 1, by - Math.ceil(floorR / 2) - 2, floorR * 2 + 3, floorR + 5, DEPTH.TILE_FX + 4);
  const topMax = fountainTop(by, Math.max(...S.rise)) - 10;
  const jet = new Raster(sc, bx - 34, topMax, 69, by - topMax + 6, unitDepth(by) + 1);
  const spray = new PxSparks(sc, unitDepth(by) + 1.5);
  let frame = 0;
  let h = 0;
  let poolR = 0;
  let halo = 0;
  let fall = 0;
  let drain = 0;
  let fade = -1; // the pool's fade step (−1: not fading)
  let settling = false;
  let settleFrame = 0;
  let curtainAt = -1; // scene ms the curtains started falling
  let el0 = 0;
  const ripples: number[] = []; // birth frames
  let resolveRisen: () => void = () => undefined;
  const risen = new Promise<void>((r) => (resolveRisen = r));
  let resolveCrest: () => void = () => undefined;
  const crest = new Promise<void>((r) => (resolveCrest = r));
  let resolveGone: () => void = () => undefined;
  const gone = new Promise<void>((r) => (resolveGone = r));
  let dead = false;
  const kill = () => {
    if (dead) return;
    dead = true;
    stop();
    floor.destroy();
    jet.destroy();
    spray.release();
    resolveRisen();
    resolveCrest();
    resolveGone();
  };
  const crownXY = () => ({ x: bx - 1, y: fountainTop(by, h) });
  const drawFloor = () => {
    floor.begin();
    const ph = Math.floor(el0 / 34);
    // the shock ring of the eruption: out to 56 px, a palette step down every fifth of its run
    if (frame < S.shockFrames) {
      const k = frame / (S.shockFrames - 1);
      const r = Math.round(S.shockR[0] + (S.shockR[1] - S.shockR[0]) * (1 - (1 - k) * (1 - k)));
      floor.pc.ellipseRing(bx - floor.x + 0.5, by - floor.y + 0.5, r, r / 2, SHOCK[Math.min(SHOCK.length - 1, Math.floor(k * SHOCK.length))]);
    }
    if (poolR > 0) {
      // the fade: the rings spread a step and their tones walk down the teal ramp to nothing
      const f = fade;
      const fill = f < 0 ? PAL.teal1 : f === 0 ? PAL.teal1 : f === 1 ? PAL.teal0 : null;
      const rim = f < 1 ? PAL.teal3 : f === 1 ? PAL.teal2 : f === 2 ? PAL.teal1 : PAL.teal0;
      const inner = f < 0 ? PAL.teal2 : f === 0 ? PAL.teal2 : PAL.teal1;
      if (fill === null) {
        // only the two thinning rings are left
        floor.pc.ellipseRing(bx - floor.x + 0.5, by - floor.y + 0.5, poolR, poolR / 2, rim);
        if (f < S.fadeSteps - 1) floor.pc.ellipseRing(bx - floor.x + 0.5, by - floor.y + 0.5, poolR - 3, (poolR - 3) / 2, PAL.teal0);
      } else paintFountainPool(floor.pc, bx - floor.x, by - floor.y, poolR, { phase: ph, halo, rim, inner, fill });
      // ripples running out on the water from the jet's foot, one tone down every quarter of the way
      for (const born of ripples) {
        const age = frame - born;
        const r = 5 + Math.round(age * 1.5);
        if (r >= poolR - 1 || fill === null) continue;
        const tone = age < 4 ? PAL.teal4 : r < poolR * 0.6 ? PAL.teal3 : PAL.teal2;
        floor.pc.ellipseRing(bx - floor.x + 0.5, by - floor.y + 0.5, r, r / 2, tone);
      }
    }
    floor.end();
  };
  const drawJet = () => {
    jet.begin();
    if (h > 0 || (fall > 0 && drain < 1)) {
      const ph = Math.floor(el0 / 34);
      // while it sinks the curtains keep falling along the full fountain's arcs (they drain, not drop)
      paintFountain(jet.pc, bx - jet.x, by - jet.y, h, { phase: ph, reach: S.reach, fall, drain, crown: h >= 16 || (settling && h > 0), curtainH: settling ? FOUNTAIN_H : undefined });
    }
    jet.end();
  };
  const stop = onFrame(sc, (dt, el) => {
    if (dead) return false;
    el0 = el;
    const step = dt > 0;
    if (step) frame++;
    if (!settling) {
      // the rise: one height per rendered frame from the eruption (frame 0 = the first height)
      const i = Math.min(S.rise.length - 1, frame);
      h = riseHeight(i);
      if (i >= S.dropFrame) resolveCrest();
      if (i === S.rise.length - 1) resolveRisen();
      poolR = S.pool[Math.min(S.pool.length - 1, Math.floor(frame / 2))];
      halo = Math.min(S.halo, Math.floor(frame / 2));
      if (curtainAt < 0 && h >= 64) curtainAt = el;
      fall = curtainAt < 0 ? 0 : Math.min(1, (el - curtainAt) / S.curtainFallMs);
      if (step && frame % 8 === 2) ripples.push(frame);
      // spray thrown off the crown while it stands (halved under reduced motion)
      if (step && h >= 64 && rnd() < (REDUCED_MOTION ? 0.45 : 0.9)) {
        const c = crownXY();
        const side = rnd() < 0.5 ? -1 : 1;
        spray.add({ x: c.x + side * Math.round(2 + rnd() * 5), y: c.y + 2, vx: side * (14 + rnd() * 34), vy: -(24 + rnd() * 40), ay: 640, life: 300 + rnd() * 180, colors: SPRAY, shape: 'px', fadeAt: 1 });
      }
    } else {
      // the settle: the jet sinks a height every two frames, the curtains drain, then the pool fades
      const sf = frame - settleFrame;
      const i = Math.floor(sf / 2);
      h = i < S.sink.length ? S.sink[i] : 0;
      // the feed stops: the curtains' tops go at once, the water below falls away over ≈ 9 frames
      drain = Math.min(1, Math.sqrt(sf / 9));
      if (i >= S.sink.length) {
        const f = Math.floor((sf - S.sink.length * 2) / S.fadeFrames);
        if (f !== fade && step) {
          fade = f;
          poolR += 2;
          halo = Math.max(0, halo - 2);
        }
        if (fade >= S.fadeSteps) {
          kill();
          return false;
        }
      }
    }
    drawFloor();
    drawJet();
    return true;
  });
  return {
    risen,
    crest,
    spout(toward) {
      // the crown of the jet at its full height (the crest overshoots it for two frames)
      const c = { x: bx - 1, y: fountainTop(by, FOUNTAIN_H) };
      const side = toward.x < c.x ? -1 : 1;
      return { x: c.x + side * 6, y: c.y + 3 };
    },
    settle() {
      if (dead) return Promise.resolve();
      if (!settling) {
        settling = true;
        settleFrame = frame;
        // the first sink step shows on this very frame (the springSettle sound plays on it)
        h = S.sink[0];
        drawFloor();
        drawJet();
        // the crown splashes down: a last burst of drops falling out of it, down toward the pool
        const c = crownXY();
        for (let k = 0; k < fxCount(10); k++) {
          const side = k % 2 === 0 ? -1 : 1;
          spray.add({ x: c.x + side * Math.round(rnd() * 6), y: c.y + 1, vx: side * (8 + rnd() * 30), vy: 20 + rnd() * 40, ay: 900, life: 360 + rnd() * 100, colors: SPRAY, shape: rnd() < 0.3 ? 'sq' : 'px', size: 2, fadeAt: 1 });
        }
      }
      return gone;
    },
    destroy: kill,
  };
}

// ================================================================ small pieces

/**
 * A 2-frame "+" glint at (x, y) (A5 §3.5): a 7-px plus — white centre and arms, teal3 tips (it reads on
 * a teal coat and a red one alike) — then a 3-px teal4 one.
 */
function glint(sc: Phaser.Scene, x: number, y: number): void {
  const ras = new Raster(sc, Math.round(x) - 4, Math.round(y) - 4, 9, 9, DEPTH.FX + 6);
  let f = 0;
  onFrame(sc, (dt) => {
    if (dt > 0) f++;
    if (f >= 2 || !ras.alive) {
      ras.destroy();
      return false;
    }
    ras.begin();
    const cx = Math.round(x);
    const cy = Math.round(y);
    if (f === 0) {
      for (let k = -3; k <= 3; k++) {
        const c = Math.abs(k) === 3 ? PAL.teal3 : PAL.white;
        ras.px(cx + k, cy, c);
        ras.px(cx, cy + k, c);
      }
    } else {
      for (const [dx, dy] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ])
        ras.px(cx + dx, cy + dy, PAL.teal4);
      ras.px(cx, cy, PAL.white);
    }
    ras.end();
    return true;
  });
}

// ================================================================ the scene

/** Şifa Pınarı's 'activate' in the v3 look (see the file header). */
export async function springActivateV3(ctx: ActCtx): Promise<void> {
  const S = SPRING_V3;
  const ev = ctx.ev;
  const sc = ctx.scene;
  const run0 = fx.resolutionRun(ctx);
  const li = idxOf(ctx, run0, (e) => e.type === 'lpGain');
  const gi = idxOf(ctx, run0, (e) => e.type === 'toGraveyard' && e.from === 'resolved' && e.uid === ev.uid);
  const set = setTileOf(ctx);
  const spot = springSpot(ev.player, set ? ip(set.home) : null);
  const pan = panAt(spot.x);
  const op = await spellOpening(ctx, {
    uid: ev.uid,
    cardId: ev.cardId,
    player: ev.player,
    from: set ? 'set' : 'hand',
    zone: ev.zone,
    hold: S.openHold,
    releaseFrom: 'bottom',
    setRelease: 'flow',
    // the spring erupts where the name plate lies: it steps out at once
    plateOut: 0,
  });
  // today's safety: the world camera at rest (a no-op while it rests; the scene adds no camera move)
  relax(ctx, 300);

  // ---- RELEASE (mark `release`): the orb hops from the card's bottom edge down onto the spring's spot
  await op.release({ x: spot.x, y: spot.y - 1 }, { path: 'arc', lift: S.orbLift, ms: S.orbMs, size: 2 });

  // ---- ERUPT (mark `erupt`)
  playV3('springRise', { volume: 0.95, pan });
  const fountain = springFountain(sc, spot, spot.x * 31 + spot.y * 17 + ev.player);
  void lightFlash(sc, spot.x, spot.y - 30, PAL.teal4, fs(40), 420, { floorY: spot.y, intensity: 1 });
  const pool = lightPool(sc, spot.x, spot.y, { color: PAL.teal3, radius: fs(30), intensity: 0.9, anim: 'caustic', fadeIn: 60 });
  await fountain.crest;

  // ---- DROPS (marks `drop:<i>`, `heal`): from the crown's side to the duelist's chest
  const duelist = ctx.views.duelists?.get(ev.player) ?? null;
  const chest = duelist ? duelist.chest() : { x: spot.x + (ev.player === 0 ? 40 : -40), y: spot.y - 30 };
  const target = { x: Math.round(chest.x), y: Math.round(chest.y) };
  let healed: Promise<void> = Promise.resolve();
  let cheer: Promise<void> = Promise.resolve();
  let settled: Promise<void> | null = null;
  let send: Promise<void> = Promise.resolve();
  /** SETTLE (mark `settle`): the jet sinks, the pool fades; the spent card is born in the pool and leaves. */
  const settle = () => {
    if (settled) return;
    playV3('springSettle', { volume: 0.9, pan });
    settled = fountain.settle();
    void pool.fadeOut(320);
    const g = evAt(ctx, gi, 'toGraveyard');
    if (g && !ctx.isConsumed(gi)) {
      ctx.consumeAt(gi);
      send = cardLeaves(ctx, { owner: g.owner, cardId: g.cardId, from: { x: spot.x, y: spot.y + 1 }, delay: S.cardAfter });
    }
  };
  const from = fountain.spout(target);
  await dropArcs(sc, {
    from,
    to: target,
    n: S.drops,
    kind: 'water',
    apex: S.dropApex,
    ms: S.dropMs,
    gap: S.dropGap,
    spread: 2,
    depth: DEPTH.FX + 5,
    seed: ev.player * 7 + 3,
    trail: S.dropTrail,
    drop: 'gem',
    onLand: (i, at) => {
      playV3('springDrop', { volume: 0.8, pitch: dropPitch(i), pan: panAt(at.x) });
      glint(sc, at.x, at.y);
      if (i === 0) {
        // the heal reaches the duelist: the LP presentation (S-14) and the water's light climbing him
        if (li >= 0) healed = ctx.play(li, { delivered: true });
        if (duelist) bg(rimClimb(sc, duelist.sprite, { ramp: S.rim, stepMs: 60, holdMs: 160, fadeMs: 120 }));
      }
      if (i === 2 && duelist) {
        cheer = (async () => {
          await duelist.play('victory');
          // victory holds its last frame (fist up): ease back to the idle loop
          await wait(sc, 220);
          await duelist.play('idle');
        })();
      }
      // the last landing settles the spring
      if (i === S.drops - 1) settle();
    },
  });
  settle();
  await healed;
  await fx.playRun(ctx, fx.resolutionRun(ctx));
  await send;
  bg(cheer);
  if (settled) bg(settled);
}
