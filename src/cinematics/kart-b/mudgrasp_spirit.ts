// Çamur Pençe Ruhu (mudgrasp_spirit) — its v3 cinematics (?look=v3 only; YENI_KARTLAR §6 C10). Painters: ./mudgrasp_spirit-fx.ts.
// Every registration below is gated on LOOK_V3: the v1 look keeps today's paths byte for byte (KK-9).
//
// Summon — "the climb" (one of the two climb entrances, §5):
//   0     the tile softens into a turning mud vortex (mgVortex, sustained; a violet pit glows in it, bubbles pop)
//   f2    two hands BURST up out of the mud (mgBurst: the 600 Hz şlop) — clods fly, a violet flash from below
//   f3    the palms SLAP down and grip the tile's edges (mgSlap: el şaplağı) — mud splats on the floor, a 2-px shake
//   f4–6  the body is hauled up between the gripping hands (mgHaul: a long wet drag, a strained grunt); the mask surfaces
//   f7    land: out of the mud (mgLand), the vortex closes in steps, a ripple ring, the finale (badge pop)
//   f8    the mask seats with a click and the violet eyes ignite (a light flash on the face)
//   f9    shake-off: wet clods thrown off the body
// Strike — "Çamur Atışı":
//   the hand digs a fistful out of the mound (mgCharge, from the declaration), cocks it behind the hood, swings and
//   RELEASES (mgRelease: suction pull-off + throw) — a sticky lump with a violet ember lobs over in a high arc with its
//   shadow sliding over the floor, shedding drops; it lands "ŞLAP" on the body's face toward the spirit (mgImpact; the
//   battle's 60-ms medium hit-stop and number): a splat star, goo that slides down the struck body, droplets and a stain
//   at its feet. Then the hand slaps into the ground and sinks (mgSink, the attack's f7–8). Direct: the lump splats in
//   front of the duelist and the stain stays on the floor.
// Effect — "Pençe kilidi" (the pin), on the engine's events (HANDBOOK §6.4): battle → [death] → activate → positionChange
//   activate   mud alive: the spirit rears (special f1–4) while the ground under the attacker grumbles and seeps
//              (mgGrumble), then PLUNGES its hands into its own tile (f5) — under the attacker mud hands burst up
//              (mgBurst), seize its feet (mgGrab: staggered suction cups), yank it 2 px down into the mud, and the
//              spirit pulls (f6–8, the moan mgRoar). Mud dead: its spilled mud crawls over the floor from its old tile
//              to the attacker first ("the dead spirit's mud still reaching"), then the same grab.
//   positionChange (consumed here): the attacker is forced into its guard pose (toGuard) under the clamp (mgClamp),
//              its card turns; the pool contracts into the 6-px ring (mgRing), the hands sink into it.
//   status     the persistent mud ring with stirring hands and violet pops stays on the attacker's tile (aura 'mudPin';
//              the padlock badge is the engine's plateLock), expired by an observer once the lock turn is over.
// Death — "sıvı olup karoya geri akar" (§5.2; no shatter, no drying, no crumbling):
//   the mask slips (mgMaskSlip), six cracks open in the tile, the body liquefies (the vortex turns backwards in the
//   sprite) and runs out along the cracks and drains down into them (mgDrain, sustained), the mask lies in the puddle
//   and sinks LAST (mgGlk), the puddle is drunk into the centre and the cracks close in three steps while the card is
//   born on the tile.
// No camera moves of its own (EF-8): no ctx.focus anywhere in this file.

import type Phaser from 'phaser';
import { PAL, RAMPS } from '../../art/palette';
import type { AnyMonsterAnim } from '../../art/types';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import type { GameEvent, Uid } from '../../engine/types';
import { DEPTH, LOOK_V3, TILE_H, TILE_W, type XY, zoneXY } from '../../view/layout';
import { lightFlash, lightPool } from '../../view/light';
import { Sparks, animate, onFrame, sleep } from '../../vfx/combat';
import { Raster, qbez } from '../../vfx/setpieces';
import { shake } from '../../vfx/core';
import { registerCardHook, registerObserver, registerStrike, type CinematicContext, type StrikeArgs } from '../api';
import { atFrame, fade as fadeSnd, panAt, play, start, takeCharge } from '../_v3/sound';
import { runSummon, type Stage } from '../summon-a/_kit';
import { strikeStartFrame } from '../_v3/clash';
import { behindBodies, cardLeaves } from '../_v3/card';
import { deathStartFrom, takePlannedEntry } from '../_v3/posematch';
import { planGuardBreak, runGuardBreak, showsGuard } from '../_v3/guardbreak';
import { contactFlash } from '../_v3/flash';
import { sourceOwnsDeath } from '../strikes-b/_kit';
import { MUD, MudMask, WET_DROPS, WET_HAND, cracks, drawBall, floorStain, gooDecal, gripMarks, mudCrawl, mudPinAura, mudSplat, mudVortex, pinGrab, rng, seepAt, violetSeams, wetHand } from './mudgrasp_spirit-fx';

type Ev<T extends GameEvent['type']> = Extract<GameEvent, { type: T }>;
type Ctx<T extends GameEvent['type']> = CinematicContext<Ev<T>>;
type Rng = () => number;

const ID = 'mudgrasp_spirit';

const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const rint = (p: XY): XY => ({ x: Math.round(p.x), y: Math.round(p.y) });
const live = (u: MonsterUnit | null | undefined): MonsterUnit | null => (u && !u.retired && u.sprite.active ? u : null);
const MUD_DROPS = WET_DROPS;

/** A named point of one frame of the mud's art, in world space. */
function pointOf(u: MonsterUnit, anim: AnyMonsterAnim, f: number, name: 'muzzle' | 'hand' | 'claw' | 'head' | 'core'): XY {
  const p = u.art.points ? u.art.points(anim, f)[name] : undefined;
  const q = p ?? (name === 'core' ? u.art.core : u.art.muzzle);
  return u.framePoint(q.x, q.y);
}

/** Resolve once `cond` holds, or after `ms`. */
function until(sc: Phaser.Scene, cond: () => boolean, ms: number): Promise<void> {
  if (cond()) return Promise.resolve();
  return new Promise<void>((res) => {
    onFrame(sc, (_dt, el) => {
      if (cond() || el >= ms) {
        res();
        return false;
      }
      return true;
    });
  });
}

/** Wet clods thrown from `at` (whole-pixel mud drops that land on the floor and lie there a beat). */
function clods(sc: Phaser.Scene, at: XY, floorY: number, n: number, R: Rng, o: { up?: number; spread?: number; dir?: number; depth?: number } = {}): void {
  const sp = new Sparks(sc, o.depth ?? DEPTH.FX);
  const up = o.up ?? 1;
  const spread = o.spread ?? 1;
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (R() - 0.5) * Math.PI * spread + (o.dir ?? 0) * 0.5;
    const v = (40 + R() * 70) * up;
    sp.add({
      x: at.x + Math.round((R() - 0.5) * 4),
      y: at.y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      ay: 360,
      floor: floorY + Math.round((R() - 0.4) * 6),
      bounce: 0.05,
      life: 380 + R() * 260,
      colors: MUD_DROPS,
      shape: R() < 0.35 ? 'sq' : 'px',
      size: 2,
      fadeAt: 1,
    });
  }
  sp.release();
}

/** Violet motes rising (the spirit's light escaping the mud). */
function violetMotes(sc: Phaser.Scene, at: XY, n: number, R: Rng, depth = DEPTH.FX + 1): void {
  const sp = new Sparks(sc, depth);
  for (let i = 0; i < n; i++)
    sp.add({ x: at.x + Math.round((R() - 0.5) * 10), y: at.y - Math.round(R() * 3), vx: (R() - 0.5) * 16, vy: -18 - R() * 26, drag: 1.4, life: 360 + R() * 260, colors: [PAL.void4, PAL.void3, PAL.void2, PAL.void1], shape: 'px', fadeAt: 1, flicker: true });
  sp.release();
}

/** A wet ripple ring on the floor: a dark wet band, its lit far lip and one violet glint running round (whole px). */
function ripple(sc: Phaser.Scene, at: XY, rx: number, ms: number): void {
  const r = Raster.around(sc, at.x, at.y, rx * 2 + 10, rx + 10, DEPTH.SHADOW + 0.4);
  void animate(sc, ms, (t) => {
    const q = Math.round(rx * (0.45 + 0.55 * t));
    const qy = Math.max(1, Math.round(q / 2));
    r.draw((g) => {
      g.ring(at.x, at.y, q, qy, t < 0.6 ? PAL.earth1 : PAL.earth0);
      if (t < 0.75) g.ring(at.x, at.y, q, Math.max(1, qy - 1), t < 0.4 ? PAL.earth3 : PAL.earth2, 1, Math.PI * 1.1, Math.PI * 1.7);
      if (t < 0.5) g.ring(at.x, at.y, Math.max(2, q - 4), Math.max(1, Math.round((q - 4) / 2)), PAL.earth0);
      if (t < 0.6) {
        const a = Math.PI * (0.3 + 1.4 * t);
        g.px(Math.round(at.x + Math.cos(a) * q), Math.round(at.y + Math.sin(a) * qy), PAL.void3);
      }
    });
  }).then(() => r.destroy());
}

// ================================================================ summon: the climb out of the vortex

/** Two fat wet hands bursting up out of the vortex at the sprite's own wrists (drawn over its thinner arms). */
function burstHands(sc: Phaser.Scene, u: MonsterUnit, surfaceY: number, ms: number, seed: number): Promise<void> {
  const R = rng(seed);
  const W = 110;
  const H = 64;
  const r = new Raster(sc, Math.round(u.home.x) - W / 2, surfaceY - 52, W, H, u.sprite.depth + 0.2);
  const mk = new MudMask(r.x, r.y, r.w, r.h);
  const ph = [R(), R()];
  return animate(sc, ms, (t, el) => {
    const up = t < 0.25 ? Math.round((t / 0.25) * 3) / 3 : 1;
    r.begin();
    mk.clear();
    const bases: XY[] = [];
    [rint(pointOf(u, 'summon', 2, 'hand')), rearWrist(u, -25, -13)].forEach((w, i) => {
      const base = { x: w.x - 2, y: surfaceY };
      bases.push(base);
      const flex = Math.sin(el / 45 + ph[i] * 6);
      const tip = { x: Math.round(lerp(base.x, w.x + flex * 0.6, up)), y: Math.round(lerp(base.y, w.y + 2, up)) };
      // fingers splay and claw at the air (open ↔ half-curled), a drip forming under each palm
      wetHand(mk, base, tip, { w: 2.6, open: 0.75 + 0.25 * flex, cup: i === 0 ? 1 : -1, drip: (el / 260 + ph[i]) % 1, bend: (i === 0 ? 1 : -1) * 1.5, collar: 1.1 });
    });
    mk.wet(r, { tones: WET_HAND, seepY: surfaceY + 1, phase: Math.floor(el / 60) });
    for (const b of bases) seepAt(r, b, 2.6, el / 1000);
    r.end();
  }).then(() => r.destroy());
}

/** The rear arm's wrist (no named point: the summon pose's rear wrist offset from the anchor, mirrored for P2). */
function rearWrist(u: MonsterUnit, dx: number, dy: number): XY {
  return rint(u.framePoint(u.art.anchorX + dx, u.art.anchorY + dy));
}

/** The tile's front edge under a world x on its tile (iso diamond): the lip the climbing hands hook over. */
function tileLip(home: XY, x: number): XY {
  const hw = TILE_W / 2;
  const dx = clamp(Math.abs(x - home.x), 0, hw - 2);
  return { x: Math.round(home.x + Math.sign(x - home.x) * dx), y: Math.round(home.y + (TILE_H / 2) * (1 - dx / hw)) };
}

async function climbV3(S: Stage): Promise<void> {
  const sc = S.scene;
  const { home, unit: u } = S;
  const R = rng(S.ev.uid * 13 + 7);
  const pan = panAt(home.x);
  fadeSnd(['summonCharge'], 160);
  if (!u.has('summon')) return;
  const n = u.frameCount('summon');
  const LAND = u.markFrame('summon', 'land', 7);
  // ---- the tile softens: a glossy whirlpool opens under the sprite's own puddle, its violet pit lights the floor
  const vortex = S.own(mudVortex(sc, { x: home.x, y: home.y + 1 }, 30, DEPTH.SHADOW + 0.5, S.ev.uid * 5 + 1));
  vortex.speed = 3;
  const whirl = start('mgVortex', { volume: 0.85, pan });
  u.pose('summon', 0);
  u.showSprite();
  const done = u.playRange('summon', 0, undefined, { hold: false });
  // the vortex opens (stepped) and spins up until the hands come; bubbles pop, violet motes leak up
  void animate(sc, u.rangeMs('summon', 0, 2), (t) => {
    vortex.open = Math.max(0.25, Math.round(t * 4) / 4);
    vortex.speed = 3 + 6 * t;
    vortex.pit = t;
  });
  vortex.ripple();
  violetMotes(sc, home, 3, R, DEPTH.FX);
  // f2: two fat hands BURST up out of the mud and claw at the air (held: the hook of the climb)
  atFrame(u, 'summon', 2, () => {
    play('mgBurst', { volume: 0.95, pan });
    void burstHands(sc, u, home.y - 1, Math.max(120, u.frameMs('summon', 2) - 10), S.ev.uid * 3 + 5);
    const a = rint(pointOf(u, 'summon', 2, 'hand'));
    const b = rint(pointOf(u, 'summon', 2, 'claw'));
    clods(sc, { x: a.x, y: home.y - 1 }, home.y, 7, R, { up: 1.3, spread: 0.6 });
    clods(sc, { x: b.x, y: home.y - 1 }, home.y, 7, R, { up: 1.3, spread: 0.6 });
    violetMotes(sc, home, 7, R);
    void lightFlash(sc, home.x, home.y - 4, PAL.void3, 40, 300, { floorY: home.y, air: 0.7, intensity: 1 });
    vortex.ripple();
  }, { late: false });
  // f3: the palms SLAM onto the tile's edges and the fingers hook over its lip
  let grips: ReturnType<typeof gripMarks> | null = null;
  atFrame(u, 'summon', 3, () => {
    play('mgSlap', { volume: 1, pan });
    void shake(sc, 130, 2);
    // the near front hand and the rear hand: one on each side edge of the tile
    const pts = [rint(pointOf(u, 'summon', 3, 'hand')), rearWrist(u, -29, -1)].map((p) => ({ at: tileLip(home, p.x + Math.sign(p.x - home.x) * 5), side: Math.sign(p.x - home.x) || 1 }));
    grips = gripMarks(sc, pts, u.sprite.depth + 0.15);
    void animate(sc, 90, (t) => {
      if (grips) grips.grip = Math.round(t * 3) / 3;
    });
    for (const p of pts) {
      floorStain(sc, { x: p.at.x - p.side * 5, y: p.at.y - 2 }, 7, DEPTH.SHADOW + 0.6, 1300);
      clods(sc, p.at, home.y + 4, 6, R, { up: 0.7, spread: 1.2 });
      void lightFlash(sc, p.at.x, p.at.y, PAL.void3, 18, 220, { floorY: p.at.y, intensity: 0.7 });
    }
    vortex.pit = 1;
  }, { late: false });
  // f4: the haul — the mask surfaces and the body is dragged up between the gripping hands
  atFrame(u, 'summon', 4, () => {
    play('mgHaul', { volume: 0.9, pan });
    vortex.speed = 10;
    vortex.ripple();
  }, { late: false });
  atFrame(u, 'summon', 5, () => {
    clods(sc, rint(pointOf(u, 'summon', 5, 'core')), home.y, 5, R, { up: 0.8, spread: 1.4 });
    vortex.ripple();
  }, { late: false });
  // land: out of the mud — the hands let go of the edges, the vortex closes in steps, a wet ripple ring
  atFrame(u, 'summon', LAND, () => {
    whirl.stop(90);
    play('mgLand', { volume: 0.95, pan });
    grips?.destroy();
    ripple(sc, home, 38, 460);
    ripple(sc, home, 26, 360);
    clods(sc, home, home.y + 1, 9, R, { up: 0.7, spread: 1.6 });
    void shake(sc, 170, 2);
    void lightFlash(sc, home.x, home.y, PAL.earth3, 34, 360, { floorY: home.y, ring: true, intensity: 0.7 });
    void animate(sc, 260, (t) => {
      vortex.open = t < 0.34 ? 0.7 : t < 0.67 ? 0.4 : 0.15;
      vortex.speed = 10 * (1 - t);
      vortex.pit = 1 - t;
    }).then(() => vortex.destroy());
  }, { late: false });
  // the mask seats (a click down) and the eyes ignite — the plate pops on this beat (it is whole now)
  atFrame(u, 'summon', Math.min(n - 1, LAND + 1), () => {
    const h = rint(pointOf(u, 'summon', LAND + 1, 'head'));
    void lightFlash(sc, h.x, h.y, PAL.void4, 26, 340, { floorY: home.y, air: 1, intensity: 1 });
    violetMotes(sc, { x: h.x, y: h.y + 2 }, 5, R, u.sprite.depth + 0.5);
    void u.badge.pop();
  }, { late: false });
  // shake-off: wet clods thrown off the body, a drip or two
  atFrame(u, 'summon', Math.min(n - 1, LAND + 2), () => {
    const c = rint(pointOf(u, 'summon', LAND + 2, 'core'));
    clods(sc, { x: c.x, y: c.y - 6 }, home.y, 10, R, { up: 0.9, spread: 1.8 });
    play('mgDrip', { volume: 0.5, pan });
    void sleep(sc, 90).then(() => play('mgDrip', { volume: 0.4, pan, pitch: 0.85 }));
  }, { late: false });
  try {
    await done;
  } finally {
    whirl.stop(60);
    (grips as ReturnType<typeof gripMarks> | null)?.destroy();
  }
}

if (LOOK_V3)
  registerCardHook(
    ID,
    'summon',
    async (ctx) => {
      if (ctx.ev.from === 'field') return ctx.base();
      await runSummon(ctx, async () => undefined, climbV3);
    },
    { priority: 20, name: 'kart-b:mudgrasp_spirit:summon' },
  );

// ================================================================ strike: "Çamur Atışı"

/** Where the lump lands on a target: its body's face toward the thrower, a little above the core. */
function landOn(t: MonsterUnit, from: XY): XY {
  const c = t.core();
  const dx = Math.sign(from.x - c.x) || 1;
  const half = Math.round(t.art.w * 0.16);
  return rint({ x: c.x + dx * half, y: c.y - 3 });
}

async function lobV3(s: StrikeArgs): Promise<void> {
  const u = s.attacker;
  const sc = s.scene;
  const R = rng(u.uid * 53 + (s.target?.uid ?? 3));
  const res = (s.ctx.ev as Ev<'battle'>).result;
  const loses = res === 'attackerDestroyed' || res === 'bothDestroyed';
  const n = u.frameCount('attack');
  const f0 = strikeStartFrame(u);
  const REL = u.markFrame('attack', 'release', 6);
  const CON = u.markFrame('attack', 'contact', REL + 1);
  const pan = panAt(u.home.x);
  const charge = takeCharge(u, 'mgCharge', { volume: 0.85, pan });
  let relSounded = false;
  const rel = () => {
    if (relSounded) return;
    relSounded = true;
    charge.stop(40);
    play('mgRelease', { volume: 0.9, pan });
  };
  // the scoop: the hand digs the fistful out of the mound (clods fly off the mound)
  if (f0 <= 2)
    atFrame(u, 'attack', 2, () => {
      const h = rint(pointOf(u, 'attack', 2, 'hand'));
      clods(sc, h, u.home.y, 6, R, { up: 0.6, spread: 1 });
    }, { late: false });
  atFrame(u, 'attack', REL, rel, { late: false });
  // play through the release into the follow-through (the arm keeps moving while the lump flies), hold there
  const toRel = Math.max(60, u.rangeMs('attack', f0, REL));
  const swing = u.playRange('attack', f0, CON, { hold: true });
  await sleep(sc, toRel);
  rel();
  // ---- release: the lump leaves the palm of the release frame
  const from = rint(pointOf(u, 'attack', REL, 'muzzle'));
  const to: XY = s.target && !s.direct ? landOn(s.target, from) : rint(s.to);
  const g0 = u.home.y;
  const g1 = s.target ? s.target.home.y : s.toGround.y;
  const dist = Math.hypot(to.x - from.x, to.y - from.y);
  const flight = clamp(Math.round(200 + dist * 0.8), 270, 400);
  const arc = clamp(Math.round(dist * 0.35), 26, 48);
  const ctrl = { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - arc * 2 };
  const x0 = Math.floor(Math.min(from.x, to.x) - 28);
  const y0 = Math.floor(Math.min(from.y, to.y) - arc - 24);
  const r = new Raster(sc, x0, y0, Math.ceil(Math.abs(to.x - from.x) + 56), Math.ceil(Math.max(g0, g1) - y0 + 14), DEPTH.FX);
  const shadow = new Raster(sc, x0, y0, r.w, r.h, DEPTH.SHADOW + 0.5);
  const mk = new MudMask(r.x, r.y, r.w, r.h);
  const ember = lightPool(sc, from.x, from.y, { color: PAL.void3, spill: PAL.void2, radius: 14, floorY: g0, air: 0.9, intensity: 0.7, anim: 'breathe', fadeIn: 0 });
  const drops = new Sparks(sc, DEPTH.FX - 0.5);
  let lastDrop = 0;
  let prev = from;
  void lightFlash(sc, from.x, from.y, PAL.void3, 20, 180, { floorY: g0, air: 0.8, intensity: 0.6 });
  // the follow-through wobble: the mud body jiggles a pixel while the lump is in the air (never a frozen frame)
  const sx0 = u.sprite.x;
  const sy0 = u.sprite.y;
  await animate(sc, flight, (t, el, dt) => {
    const p = rint(qbez(from, ctrl, to, t));
    const vx = dt > 0 ? ((p.x - prev.x) * 1000) / dt : 0;
    const vy = dt > 0 ? ((p.y - prev.y) * 1000) / dt : 0;
    prev = p;
    const fy = Math.round(lerp(g0, g1, t));
    const fx = Math.round(lerp(from.x, to.x, t));
    ember.setPosition(p.x, p.y, fy);
    r.draw((g) => drawBall(g, mk, p, Math.floor(el / 50), t < 0.12 ? vx * 2 : vx, vy));
    // its shadow on the floor (shrinks while the lump is high)
    const h = fy - p.y;
    const sr = h > 34 ? 2 : h > 16 ? 3 : 5;
    shadow.draw((g) => g.ell(fx, fy, sr, sr > 3 ? 2 : 1, PAL.ink));
    if (u.sprite.active && u.frameInfo().frame >= CON) u.sprite.setPosition(sx0, sy0 + ((Math.floor(el / 70) & 1) === 0 ? 0 : 1));
    // it sheds glossy drops on the way
    if (el - lastDrop > 60 && t < 0.88) {
      lastDrop = el;
      drops.add({ x: p.x - Math.sign(to.x - from.x) * 4, y: p.y + 3, vx: (R() - 0.5) * 12, vy: 14, ay: 460, floor: fy, bounce: 0, life: 460, colors: MUD_DROPS, shape: 'sq', size: 2, fadeAt: 1 });
    }
  });
  if (u.sprite.active) u.sprite.setPosition(sx0, sy0);
  r.destroy();
  shadow.destroy();
  drops.release();
  void ember.fadeOut(80);
  // ---- contact: ŞLAP (the battle kit stages the 60-ms hit-stop, the number and the reaction on this beat)
  s.impact(to);
  play('mgImpact', { volume: s.blocked ? 0.8 : 1, pan: panAt(to.x) });
  const victim = s.target && !s.direct && s.target.sprite.active && s.target.sprite.visible ? s.target : null;
  void mudSplat(sc, to, g1, victim ? victim.sprite.depth + 0.6 : DEPTH.FX + 1, s.blocked, u.uid * 7 + 1);
  void lightFlash(sc, to.x, to.y, PAL.void3, s.blocked ? 26 : 36, 320, { floorY: g1, air: 0.7, intensity: 0.95 });
  violetMotes(sc, to, 5, R);
  if (victim) {
    gooDecal(sc, victim, to, victim.sprite.depth + 0.3, u.uid * 11 + 3);
    floorStain(sc, { x: victim.home.x + (from.x < to.x ? -3 : 3), y: victim.home.y + 1 }, s.blocked ? 8 : 11, DEPTH.SHADOW + 0.6, 1300);
  } else {
    floorStain(sc, rint(s.toGround), 13, DEPTH.SHADOW + 0.6, 1500);
    clods(sc, rint(s.toGround), s.toGround.y, 10, R, { up: 0.8, spread: 1.6 });
  }
  await swing;
  if (loses) return;
  // ---- the hand slaps into the ground and sinks (f8), then it is pulled back out (recover)
  atFrame(u, 'attack', Math.min(n - 1, CON + 1), () => {
    play('mgSink', { volume: 0.8, pan });
    const h = rint(pointOf(u, 'attack', CON + 1, 'hand'));
    const g = { x: h.x, y: Math.min(u.home.y + 4, h.y) };
    floorStain(sc, g, 7, DEPTH.SHADOW + 0.6, 800);
    clods(sc, g, u.home.y + 2, 6, R, { up: 0.6, spread: 1.2 });
    ripple(sc, g, 12, 300);
  }, { late: false });
  await u.playRange('attack', CON + 1, undefined, { hold: false });
}

if (LOOK_V3) registerStrike(ID, (s) => lobV3(s), { priority: 20, name: 'kart-b:mudgrasp_spirit:strike' });

// ================================================================ effect: "Pençe kilidi" (activate → positionChange)

/** Pinned attackers with the mud-ring aura (expired by the observer below). */
const pinned = new Set<Uid>();

if (LOOK_V3)
  registerObserver((ev, ctx) => {
    if (!pinned.size) return;
    if (ev.type !== 'turnStart' && ev.type !== 'phaseChange' && ev.type !== 'controlChange' && ev.type !== 'destroy' && ev.type !== 'gameOver') return;
    for (const uid of [...pinned]) {
      const loc = ctx.locate(uid, 'next');
      const slot = loc && loc.zone === 'monster' ? ctx.stateNext.players[loc.player].monsters[loc.index] : null;
      if (ev.type === 'gameOver' || !slot || slot.lockPositionTurn === undefined || ctx.stateNext.turn > slot.lockPositionTurn) {
        ctx.unit(uid)?.setAura('mudPin', null);
        pinned.delete(uid);
      }
    }
  });

/** The forced guard: the attacker turns into its guard pose under the clamp, its card turns side-on. */
async function forceGuard(ctx: Ctx<'activate'>, a: MonsterUnit): Promise<void> {
  const tile = ctx.tile(a.uid);
  const jobs: Promise<unknown>[] = [];
  if (tile && tile.orientation !== 'side') jobs.push(tile.rotateTo('side', 260));
  a.position = 'defense';
  a.badge.setPosition('defense');
  ctx.sfx('cardSlide', { volume: 0.45 });
  if (a.has('toGuard')) jobs.push(a.playRange('toGuard', 0, undefined, { hold: true }).then(() => a.rest()));
  else {
    // no transition pose: it drops into its guard loop under the clamp
    a.posed = false;
    a.rest();
    a.posed = true;
    jobs.push(sleep(ctx.scene, 120));
  }
  await Promise.race([Promise.all(jobs), sleep(ctx.scene, 420)]);
}

async function pinV3(ctx: Ctx<'activate'>): Promise<void> {
  const ev = ctx.ev;
  const sc = ctx.scene;
  // the battle that triggered it: the last one that targeted this mud
  let bi = -1;
  for (let i = ctx.index - 1; i >= 0; i--) {
    const e = ctx.events[i];
    if (e.type === 'battle' && e.targetUid === ev.uid) {
      bi = i;
      break;
    }
  }
  const bEv = bi >= 0 ? (ctx.events[bi] as Ev<'battle'>) : null;
  const a = bEv ? live(ctx.unit(bEv.attackerUid)) : null;
  if (!bEv || !a || !a.sprite.visible) return ctx.base();
  const pi = ctx.findType('positionChange', (e) => e.uid === a.uid);
  if (pi >= 0) ctx.consumeAt(pi);
  const R = rng(ev.uid * 31 + a.uid * 7);
  const mud = ev.from === 'monster' ? live(ctx.unit(ev.uid)) : null;
  const mudAlive = !!mud && mud.sprite.visible && mud.has('special');
  const mudSpot = mud ? { ...mud.home } : bEv.targetZone !== null ? zoneXY((1 - bEv.player) as 0 | 1, 'monster', bEv.targetZone) : null;
  const aPan = panAt(a.home.x);
  const s = a.sprite;
  const feet = { x: Math.round(a.home.x), y: Math.round(a.home.y) };
  const grab = pinGrab(sc, a, ev.uid * 17 + a.uid);
  // the pit's violet light: it rises with the seep, flares on the burst, settles into the aura's own light
  const pool = lightPool(sc, feet.x, feet.y, { color: PAL.void3, spill: PAL.void2, radius: 26, floorY: feet.y, intensity: 0, anim: 'flicker', fadeIn: 0 });
  pool.setIntensity(0.45, 200);
  a.posed = true;
  const y0 = s.y;
  const x0 = s.x;
  let tremble = false;
  let sinkPx = 0;
  const stopTremble = onFrame(sc, (_dt, el) => {
    if (!s.active) return false;
    const jx = tremble ? (Math.floor(el / 45) % 2 ? 1 : -1) : 0;
    s.setPosition(x0 + jx, y0 + sinkPx);
    return true;
  });
  let mudDone: Promise<void> = Promise.resolve();
  try {
    // ---- 1. the floor under the attacker answers: it darkens, swells, leaks violet from three seams, boils, and
    //         the feet start to go down; meanwhile the spirit rears (or its spilled mud crawls over from its tile)
    play('mgGrumble', { volume: 0.9, pan: aPan });
    void shake(sc, 300, 1);
    let plunge: number;
    if (mudAlive && mud) {
      mud.posed = true;
      const SP_REL = mud.markFrame('special', 'release', 5);
      const HOLD = Math.min(mud.frameCount('special') - 1, mud.markFrame('special', 'recover', 9) - 1);
      plunge = mud.rangeMs('special', 1, SP_REL);
      const mpan = panAt(mud.home.x);
      atFrame(mud, 'special', SP_REL, () => {
        play('mgSink', { volume: 0.75, pan: mpan });
        const h = rint(pointOf(mud, 'special', SP_REL, 'hand'));
        clods(sc, { x: h.x, y: Math.min(mud.home.y + 3, h.y) }, mud.home.y + 2, 9, R, { up: 0.9, spread: 1.2 });
        ripple(sc, { x: h.x, y: mud.home.y }, 16, 320);
        void lightFlash(sc, mud.home.x, mud.home.y, PAL.void3, 32, 280, { floorY: mud.home.y, intensity: 0.9 });
      }, { late: false });
      atFrame(mud, 'special', Math.min(HOLD, SP_REL + 1), () => play('mgRoar', { volume: 0.6, pan: mpan }), { late: false });
      mudDone = (async () => {
        await mud.playRange('special', 1, HOLD, { hold: true });
        // the pull is held while the clamp turns the attacker, then the arms come back out and it closes its wall again
        await sleep(sc, 300);
        if (!live(mud)) return;
        await mud.playRange('special', HOLD + 1, undefined, { hold: true });
        if (live(mud) && mud.position === 'defense' && mud.has('toGuard')) await mud.playRange('toGuard', 0, undefined, { hold: true });
      })();
    } else {
      plunge = 420;
      if (mudSpot) {
        // the dead spirit's tile cracks open violet, and its spilled mud crawls over the floor to the attacker
        void violetSeams(sc, { x: Math.round(mudSpot.x), y: Math.round(mudSpot.y) }, 26, 420, DEPTH.SHADOW + 0.7, ev.uid * 5 + 9);
        void lightFlash(sc, mudSpot.x, mudSpot.y, PAL.void3, 30, 320, { floorY: mudSpot.y, intensity: 0.9 });
        violetMotes(sc, mudSpot, 6, R);
        void mudCrawl(sc, { x: mudSpot.x, y: mudSpot.y + 1 }, { x: feet.x, y: feet.y + 1 }, plunge, DEPTH.SHADOW + 0.6, ev.uid * 3 + 2);
        play('mgDrip', { volume: 0.5, pan: panAt(mudSpot.x) });
      }
    }
    let rings = 0;
    await animate(sc, plunge, (t, el) => {
      grab.seep = Math.round(Math.min(1, 0.25 + t * 0.8) * 6) / 6;
      grab.stir = Math.round(clamp((t - 0.15) / 0.6, 0, 1) * 4) / 4;
      // the floor answers: ripple rings run out from under the feet, the feet start to go down a pixel
      if (el >= rings * 130 && t < 0.92) {
        rings++;
        ripple(sc, feet, 20 + rings * 2, 320);
        if (rings % 2 === 0) clods(sc, { x: feet.x + Math.round((R() - 0.5) * 18), y: feet.y }, feet.y + 1, 2, R, { up: 0.45 });
      }
      pool.setIntensity(0.45 + 0.4 * t, 0);
      sinkPx = t > 0.55 ? 1 : 0;
      tremble = t > 0.6;
    });
    tremble = false;
    // ---- 2. the hands BURST up beside the attacker's feet
    play('mgBurst', { volume: 1, pan: aPan });
    clods(sc, { x: feet.x, y: feet.y - 1 }, feet.y + 2, 14, R, { up: 1.15, spread: 1.6 });
    violetMotes(sc, feet, 8, R);
    void lightFlash(sc, feet.x, feet.y - 4, PAL.void3, 40, 300, { floorY: feet.y, air: 0.7, intensity: 1 });
    pool.setIntensity(1.1, 60);
    await animate(sc, 150, (t) => {
      grab.seep = 1;
      grab.burst = Math.round(t * 4) / 4;
    });
    // ---- 3. they wrap the feet and yank them down into the mud
    play('mgGrab', { volume: 0.95, pan: aPan });
    tremble = true;
    await animate(sc, 200, (t) => {
      grab.grab = Math.round(t * 5) / 5;
      grab.collar = t < 0.5 ? 1 : 2;
      sinkPx = t < 0.4 ? 2 : 3;
    });
    // ---- 4. the clamp forces the guard; the pool contracts into the 6-px ring around a violet pit
    play('mgClamp', { volume: 0.95, pan: aPan });
    void shake(sc, 150, 2);
    clods(sc, feet, feet.y + 2, 6, R, { up: 0.5, spread: 1.8 });
    const guard = pi >= 0 ? forceGuard(ctx, a) : Promise.resolve();
    void sleep(sc, 120).then(() => play('mgRing', { volume: 0.85, pan: aPan }));
    await animate(sc, 320, (t) => {
      grab.ring = Math.round(t * 4) / 4;
      grab.stir = t < 0.5 ? 0.5 : 0;
      if (t > 0.6) tremble = false;
    });
    await guard;
    // ---- 5. the hands sink into the ring, the feet settle in it; the persistent status takes over the same pixels
    tremble = false;
    if (pi >= 0) {
      a.setAura('mudPin', mudPinAura(sc, a, a.uid * 13 + ev.uid));
      pinned.add(a.uid);
    }
    await animate(sc, 180, (t) => {
      grab.sink = Math.round(t * 3) / 3;
      sinkPx = t < 0.34 ? 3 : t < 0.67 ? 2 : 1;
    });
    sinkPx = 0;
    void pool.fadeOut(240);
  } catch (e) {
    console.error('[mudgrasp pin] failed', e);
  } finally {
    stopTremble();
    grab.destroy();
    if (pool.alive) void pool.fadeOut(120);
    if (s.active) s.setPosition(x0, y0);
    a.posed = false;
    if (live(a)) {
      const ev2 = pi >= 0 ? (ctx.events[pi] as Ev<'positionChange'>) : null;
      if (ev2 && a.position !== ev2.position) {
        a.position = ev2.position;
        a.badge.setPosition(ev2.position);
      }
      a.rest();
    }
  }
  // the spirit's own recovery runs on behind the next beats (not awaited past a short tail)
  await Promise.race([mudDone, sleep(sc, 120)]);
  void mudDone.then(() => {
    if (live(mud)) {
      mud!.posed = false;
      mud!.rest();
    }
  });
}

if (LOOK_V3)
  registerCardHook(ID, 'effect', (ctx) => pinV3(ctx), { priority: 20, name: 'kart-b:mudgrasp_spirit:effect' });

// ================================================================ death: liquefies and flows back into the tile's cracks

async function liquidDeathV3(ctx: Ctx<'destroy'>): Promise<void> {
  const ev = ctx.ev;
  const sc = ctx.scene;
  const field = ctx.views.field;
  const u = field.unit(ev.uid);
  if (!u || u.retired || !u.sprite.active || !u.sprite.visible || !u.has('death')) return ctx.base();
  const R = rng(ev.uid * 29 + 13);
  // bookkeeping (as _v3/death.ts deathV3): claim the card's graveyard move, release the unit from the field
  const gi = ctx.findType('toGraveyard', (e) => e.uid === ev.uid, {
    until: (e) => e.type !== 'toGraveyard' && e.type !== 'destroy' && e.type !== 'fieldSpell' && e.type !== 'statChange',
  });
  const gEv = gi >= 0 ? (ctx.events[gi] as Ev<'toGraveyard'>) : null;
  if (gi >= 0) ctx.consumeAt(gi);
  const owner = gEv ? gEv.owner : ctx.owner(ev.uid);
  const { tile } = field.release(ev.uid);
  const home = tile ? { x: Math.round(tile.home.x), y: Math.round(tile.home.y) } : zoneXY(ev.player, 'monster', ev.zone);
  u.badge.setVisible(false);
  u.posed = true;
  const onBorn = typeof ctx.hints.onBorn === 'function' ? (ctx.hints.onBorn as () => void) : null;
  let leave: Promise<void> | null = null;
  const burst = () => {
    if (leave) return;
    try {
      onBorn?.();
    } catch (e) {
      console.error('[mudgrasp death] onBorn', e);
    }
    if (gEv) leave = cardLeaves(ctx, { owner, cardId: ev.cardId, from: home, tile, depthAt: behindBodies(ctx, u) }).catch((e) => console.error('[mudgrasp death] card', e));
    else if (tile && tile.active) leave = tile.dissolve(420).then(() => void (tile.active && tile.destroy())).catch(() => undefined);
    else leave = Promise.resolve();
  };
  ctx.scene.events.emit('v3:dying', u);
  const pan = panAt(home.x);
  const cr = cracks(sc, { x: home.x, y: home.y + 1 }, 40, DEPTH.SHADOW + 0.55, ev.uid * 7 + 3);
  cr.spin = -7;
  const glow = lightPool(sc, home.x, home.y, { color: PAL.void3, spill: PAL.void2, radius: 18, floorY: home.y, intensity: 0, anim: 'breathe', fadeIn: 0 });
  let drain: ReturnType<typeof start> | null = null;
  try {
    const n = u.frameCount('death');
    if (ctx.hints.hit !== false) contactFlash(sc, u.sprite, (ctx.hints.push as XY | undefined) ?? { x: u.player === 0 ? -1 : 1, y: 0 }, { frames: 2, coverage: 0.4 });
    const inDeath = () => u.frameInfo().anim === 'death';
    let planned = takePlannedEntry(u);
    if (!planned && !inDeath() && showsGuard(u)) {
      const g = planGuardBreak(u);
      if (g) {
        runGuardBreak(u, g);
        planned = takePlannedEntry(u);
      }
    }
    if (planned && !inDeath()) await until(sc, inDeath, Math.min(700, (planned.leadMs ?? u.rangeMs(planned.anim, 0, planned.hold)) + 40));
    if (!inDeath() && u.sprite.active) {
      const start0 = Math.max(0, Math.min(n - 2, planned ? planned.start : deathStartFrom(u)));
      u.asClaimant(() => void u.playRange('death', start0, undefined, { hold: true }));
    }
    const DIS = u.markFrame('death', 'dissolve', 4);
    // f1: the clay mask slips on the melting face; wet clods spray off
    atFrame(u, 'death', 1, () => {
      play('mgMaskSlip', { volume: 0.9, pan });
      const c = rint(pointOf(u, 'death', 1, 'core'));
      clods(sc, c, home.y, 8, R, { up: 0.7, spread: 1.6 });
    }, { late: false });
    // f2: the tile cracks open under the slumping body
    atFrame(u, 'death', 2, () => {
      glow.setIntensity(0.6, 200);
      void animate(sc, Math.max(120, u.rangeMs('death', 2, DIS)), (t) => {
        cr.grow = Math.round(t * 6) / 6;
      });
    }, { late: false });
    // dissolve: the body runs out along the seams as glossy tongues, then is sucked back down into them
    atFrame(u, 'death', DIS, () => {
      drain = start('mgDrain', { volume: 0.9, pan });
      cr.grow = 1;
      const span = Math.max(240, u.rangeMs('death', DIS, n - 1));
      void animate(sc, span, (t) => {
        cr.flow = Math.min(1, Math.round(t * 2.2 * 8) / 8);
        cr.drain = clamp(Math.round(((t - 0.45) / 0.55) * 6) / 6, 0, 1);
        cr.puddle = t < 0.4 ? 0 : Math.round(lerp(26, 18, (t - 0.4) / 0.6));
      });
      violetMotes(sc, home, 5, R, DEPTH.FX);
    }, { late: false });
    // the mask lies in the puddle and sinks last: bubbles ring it, the final glk
    atFrame(u, 'death', Math.max(DIS + 1, n - 3), () => {
      const h = rint(pointOf(u, 'death', n - 3, 'head'));
      ripple(sc, { x: h.x, y: home.y }, 12, 360);
    }, { late: false });
    atFrame(u, 'death', Math.max(DIS + 1, n - 2), () => {
      (drain as ReturnType<typeof start> | null)?.stop(140);
      play('mgGlk', { volume: 0.9, pan });
      const h = rint(pointOf(u, 'death', n - 2, 'head'));
      void lightFlash(sc, h.x, home.y - 2, PAL.void3, 20, 280, { floorY: home.y, air: 0.4, intensity: 0.8 });
      ripple(sc, { x: h.x, y: home.y }, 16, 340);
      violetMotes(sc, { x: h.x, y: home.y - 1 }, 3, R, DEPTH.FX);
    }, { late: false });
    await until(sc, () => !u.sprite.active || (inDeath() && u.frameInfo().frame >= n - 1), u.animMs('death') + 300);
    if (u.sprite.active) await sleep(sc, u.frameMs('death', n - 1));
    // the last beat: the puddle is drunk into the centre (its spiral turning backwards), the seams close in three
    // steps — and only then is the card born on the clean tile (nothing drawn over it)
    if (u.sprite.active) u.sprite.setVisible(false);
    cr.flow = 0;
    cr.spin = -9;
    void glow.fadeOut(200);
    await animate(sc, 220, (t) => {
      const step = Math.min(4, Math.floor(t * 5));
      cr.puddle = [20, 14, 9, 4, 0][step];
      cr.close = Math.min(3, Math.max(0, step - 1));
    });
    cr.close = 3;
    cr.puddle = 0;
    burst();
  } catch (e) {
    console.error('[mudgrasp death] failed', e);
  } finally {
    burst();
    (drain as ReturnType<typeof start> | null)?.stop(60);
    cr.destroy();
    void glow.fadeOut(80);
    u.posed = false;
    if (!u.retired) u.retire(0);
    field.forget(ev.uid);
    ctx.scene.events.emit('v3:dead', u);
  }
  await leave;
}

if (LOOK_V3)
  registerCardHook(
    ID,
    'destroyed',
    (ctx) => {
      if (ctx.ev.location !== 'monster' || sourceOwnsDeath(ctx)) return ctx.base();
      return liquidDeathV3(ctx);
    },
    { priority: 20, name: 'kart-b:mudgrasp_spirit:death' },
  );

