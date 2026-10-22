// Taş Muhafız v3 (A3 pilot, Y8) — the ANIM TABLES: hand-keyed beats and holds over biped v1 poses.
// The plan gives words and geometry (the pose fields, bipedRig for the reach() keys below); the
// choreography is this file's (A3_MIMARI §4.2: no default motion anywhere in the plan). Every number
// is a whole-pixel decision: a stone block either moves a pixel or it does not (REHBER IŞ-12).
//
// Base (part 1): idle 12 f / 1.68 s · guard 6 f / 1.04 s · attack (Kaya Fırlatma) 17 f / 1.48 s (charge →
// release 950 ms) · roar 12 f / 1.30 s · hit 6 f / 0.60 s.
// Extras (part 2), every one ending on its exact end pose (out 0):
//   summon    15 f / 1.13 s  land@7 (470 ms)  the floor breaks open, a LOOSE column of blocks comes up out
//             of it (helm and pauldrons first), stands clear on its hovering sabatons, then its joints
//             close from the bottom up; moss squashes and settles; the shield, risen out of the floor
//             beside it, is heaved and driven into its socket (the peak beat); the ᛉ, then the eye LAST
//   death     10 f / 0.76 s  impact = contact@0 (= hitHeavy f0), dissolve@4 (330 ms)  reels, the light
//             leaves (a held dead beat), the knees give, the stack slumps with its joints opening, the
//             helm tumbles off onto the floor at the shield's foot, the near pauldron slides off; the
//             edges crumble (rigkit crumble pass); the shield stands; the last frame is the low heap
//   revive    13 f / 1.21 s  land@5 (370 ms)  from the heap: the binding light in the cracks, the chunks
//             fly back up their fall paths, helm and pauldron rise back (rigkit reassemble pass); land
//             whole; the ᛉ, the Ψ and the eye light in turn; a first breath
//   hitHeavy   8 f / 0.75 s  impact = contact@0, recover@4 (280 ms)  driven back a step: the back foot
//             lifts, plants a step behind (dust), the knees take it, the foot steps home in the air
//   hitMagic   8 f / 0.71 s  impact = contact@0, recover@4 (250 ms)  the runes burn white, the spell's
//             light runs out from the ᛉ in hairline cracks, rigid, a 1-px block rattle, the sag, settle
//   toGuard    5 f / 0.36 s  → guard f0: the shield heaved and driven into its socket, the body hunkers
//   fromGuard  5 f / 0.38 s  → idle f0: the shield pulled from its socket and set down, the body rises
//   victory    7 f / 1.00 s  (held last pose, 400 ms) the shield planted with a thud, the fist to the chest

import { bipedRig, type BipedDelta, type BipedProp } from '../bodyplans/biped/v1';
import type { AnimDef, AnimDefs, Beat, LoopDef } from '../rigkit/anim';
import type { V } from '../rigkit/geom';
import { BUILD, OX, OY, REST, type SentinelFx } from './stone_sentinel-build';
import { DIG_AT } from './stone_sentinel-fx';
import { REST_RIG, type Pose } from './stone_sentinel-parts';

type D = BipedDelta & { fx?: Partial<SentinelFx> };

/** v1 frame px → this frame. */
const at1 = (x: number, y: number): V => [x + OX, y + OY];

/**
 * The tower shield PLANTED in the floor: it stays where it stands while the body breathes and shifts
 * above it (the far hand only grips it); `d` moves it from there (px).
 */
const REST_SHIELD = REST_RIG.props.shield!.at;
const planted = (d: V = [0, 0]): BipedProp => ({ at: 'floor', a: 0, show: 1, off: [REST_SHIELD[0] - REST_RIG.root[0] + d[0], REST_SHIELD[1] - REST_RIG.ground + d[1]] });

// ------------------------------------------------------------------ idle: the wall breathes
//
// The shield stays planted in the floor; above it the body is a stack of stone blocks that moves one
// block at a time (HA-6 overlap), every frame a whole-pixel move, long holds between them:
//   f1   the torso (courses, chest plate, pauldrons, the arm hanging from them) lifts a pixel — the
//        inhale; the helm and the hanging fist stay a frame behind
//   f2   the helm and the fist catch up while the hips start onto the front foot (a pixel forward);
//   f3   the upper body follows the hips — the top of the breath, the weight forward
//   f4   the pauldrons settle first (the shoulders let go) while the upper body sways on a pixel past
//        the hips; f5 the torso follows the pauldrons down, the helm a frame behind
//   f6   the helm settles while the hips go back; f7 the upper body follows them home
//   f8   the stone sags a pixel past rest as the weight goes onto the back foot (hips a pixel back,
//        the upper body a frame behind them); f9 the helm and fist sag, the upper body follows;
//   f10  the torso rises back while the pauldrons hang a frame; f11 they and the fist follow, the
//        hips come home with the upper body a frame behind; the helm rises last (f0)
// The light leads the stone: the ᛉ pulses twice a loop (every 6 frames), the eye slit flares at the
// top of the breath — the helm glancing a pixel toward the foe with it — and dims in the sag.

/**
 * Per frame, px: courses up, chest up, pauldrons up, helm up, fist up, hips forward, upper body held
 * back (−) / still forward (+) of the hips.
 */
const IDLE_BLOCKS: readonly (readonly [number, number, number, number, number, number, number])[] = [
  [0, 0, 0, 0, 0, 0, 0],
  [1, 1, 1, 0, 0, 0, 0],
  [1, 1, 1, 1, 1, 1, -1],
  [1, 1, 1, 1, 1, 1, 0],
  [1, 1, 0, 1, 1, 1, 1],
  [0, 0, 0, 1, 1, 1, 1],
  [0, 0, 0, 0, 0, 0, 1],
  [0, 0, 0, 0, 0, 0, 0],
  [-1, -1, -1, 0, 0, -1, 1],
  [-1, -1, -1, -1, -1, -1, 0],
  [0, 0, -1, -1, -1, -1, 0],
  [0, 0, 0, -1, 0, 0, -1],
];
const IDLE_RUNE = [1, 1.6, 1.6, 1, 1, 1, 1, 1.6, 1.6, 1, 1, 1];
/** The helm glances a pixel toward the foe at the top of the breath (with the eye's flare) and back. */
const IDLE_LOOK = [0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0];
const IDLE_SLIT = [1, 1, 2, 2, 1.4, 1, 1, 1, 1, 0.6, 0.8, 1];
const IDLE_HOLDS = [170, 130, 120, 150, 140, 130, 120, 150, 130, 160, 130, 150];

/** Stagger the blocks: the plan carries courses, pauldrons, helm and hand with the chest / hips; these keys hold them back. */
function blocks(course: number, chest: number, pad: number, helm: number, fist: number, hipX: number, upper: number): D {
  return {
    props: { shield: planted() },
    breath: chest,
    hip: { x: hipX, y: 0, tilt: 0 },
    head: { x: 0, y: chest - helm, a: 0, lag: 0 },
    armN: { hand: [0, 0] as V, bend: 1, grip: 'fist' },
    fx: { padN: chest - pad, padF: chest - pad, fistY: chest - fist, courseY: -course, upperX: upper },
  };
}

const idle: LoopDef<Pose> = {
  n: IDLE_BLOCKS.length,
  holds: IDLE_HOLDS,
  at: (f) => {
    const b = blocks(...IDLE_BLOCKS[f]);
    return { ...b, head: { ...b.head!, x: IDLE_LOOK[f] }, fx: { ...b.fx, rune: IDLE_RUNE[f], slit: IDLE_SLIT[f] } } as D;
  },
};

// ------------------------------------------------------------------ guard: the shell
//
// The shield stays planted where it stands (sunk a pixel deeper: KK-5 keeps the feet band) and its Ψ
// wakes; the sentinel hunkers down into it — hips 3 px lower and a pixel forward over the planted
// feet, the spine leaning into the slab so the far pauldron tucks in behind its rim and the helm
// peers over it, sunk a pixel between the pauldrons; the near arm hangs braced at the thigh. The
// chest ᛉ dims as the Ψ lights (the rune's strength moves into the shield) and the eye slit burns.
// The loop is calmer than the idle: the Ψ flares first, then a shallow breath (chest, then pauldrons
// and helm a frame later), the slit flaring with the second Ψ beat. 6 frames, 1.04 s.

const GUARD_BASE: D = {
  hip: { x: 1, y: 3, tilt: 0 },
  lean: 0.12,
  head: { x: 1, y: 1, a: 0, lag: 0 },
  armN: { hand: [0, 1], bend: 1, grip: 'fist' },
  props: { shield: planted([0, 1]) },
};
/** Per frame: chest up, pauldrons + helm up, Ψ, eye slit, fist up (every frame moves one block or the fist). */
const GUARD_KEYS: readonly (readonly [number, number, number, number, number])[] = [
  [0, 0, 1, 1.4, 0],
  [0, 0, 2, 1.4, 1],
  [1, 0, 2, 1.4, 1],
  [1, 1, 1, 1.4, 0],
  [0, 1, 1, 2, 0],
  [0, 0, 0.8, 1.4, -1],
];
const guard: LoopDef<Pose> = {
  n: GUARD_KEYS.length,
  holds: [190, 150, 160, 200, 160, 180],
  at: (f) => {
    const [c, p, sr, sl, fist] = GUARD_KEYS[f];
    return {
      ...GUARD_BASE,
      breath: c,
      head: { ...GUARD_BASE.head!, y: 1 + c - p },
      fx: { padN: c - p, padF: c - p, fistY: c - fist, srune: sr, slit: sl, rune: 0.8 },
    } as D;
  },
};

// ------------------------------------------------------------------ hit: the blow lands on the shield

const beat = (ms: number, key: D, name?: Beat<Pose>['name']): Beat<Pose> => ({ ms, key, ...(name ? { name } : {}) });

const hit: AnimDef<Pose> = {
  base: 'idle0',
  struck: { regions: ['propF', 'head', 'extra'] },
  beats: [
    // contact: the slab is driven a pixel back and up off the floor, chips burst off its face; the
    // helm jolts back and the eye goes dark — the hips, legs, arm and chest keep idle f0's pixels
    beat(50, { props: { shield: planted([-2, -1]) }, head: { x: -1, y: 0, a: 0, lag: 0 }, fx: { slit: 0.2, rune: 0.4, chips: 0.15 } }, 'struck'),
    // the recoil: the hips give a pixel (poseKnockPx), the statue tips back on its heels, the arm swings
    beat(60, { props: { shield: planted([-2, 0]) }, hip: { x: -1, y: 0, tilt: 0 }, lean: -0.05, head: { x: -1, y: 0, a: 0, lag: 0.4 }, armN: { hand: [1, -1], bend: 1, grip: 'fist' }, fx: { slit: 0.3, rune: 0.5, chips: 0.4 } }),
    beat(130, { props: { shield: planted([-1, 0]) }, hip: { x: -1, y: 1, tilt: 0 }, lean: -0.07, head: { x: -1, y: 1, a: 0, lag: 0.3 }, armN: { hand: [2, 0], bend: 1, grip: 'fist' }, fx: { slit: 0.5, rune: 0.7, chips: 0.7, dust: 0.3, dustAt: 3 } }),
    beat(100, { props: { shield: planted([0, 0]) }, hip: { x: -1, y: 0, tilt: 0 }, lean: -0.03, head: { x: 0, y: 0, a: 0, lag: 0 }, armN: { hand: [1, 0], bend: 1, grip: 'fist' }, fx: { slit: 0.8, rune: 0.9, chips: 0.95, dust: 0.65, dustAt: 3 } }, 'recover'),
    beat(120, { props: { shield: planted() }, lean: 0.02, armN: { hand: [-1, 0], bend: 1, grip: 'fist' }, fx: { dust: 0.9, dustAt: 3 } }),
  ],
  end: 'idle0',
  endMs: 140,
};

// ------------------------------------------------------------------ attack: Kaya Fırlatma (the rock throw)
//
// The v1 throw's beats, re-keyed on the plan (A3_MIMARI §6.2 checklist; fix round 1: the v1 f1 dig, a
// strain hold, an accelerating lift, the shield's counterweight swing, the follow-through under the helm):
//   look   the helm dips toward the dig spot (the charge: the declaration holds here)
//   dig    the hips sink, the near arm hangs straight down beside the near foot — upper arm under its
//          pauldron, bracer and fist below it, never an arch out to the side — the fingers bite into the
//          floor (it cracks, the boulder's top shows)
//   STRAIN the earth holds: the body heaves a pixel against it, the arm straight, the rock shaken 1 px
//          up, the crack widening, the lip heaving (the second-longest hold)
//   rip    out of the floor in one fast frame (the crater opens under it, dirt bursts); then the lift
//          accelerates — the wrist curls under it at the belt, the catch at the shoulder, up past the
//          helm, overhead — the rock's centre rising 3 → 12 → 14 → 12 → 4 px a frame (the release: 18)
//   hold   leaning back, the rock trembling over the helm, the eye's glint; the shield SWUNG OUT the
//          other way, lifted and leaning (the counterweight)
//   throw  the whip over the top (one 50 ms in-between, the shield pulled back in), the RELEASE with the
//          hand opening forward-up, the rock just off the fingertips (a 2-px smear)
//   follow the arm swings through BELOW the helm (forearm across the chest, fist at the far side), the
//          weight onto the front foot, then home; the crater stays open until the last frame (the
//          presentation's crater decal takes it over)
// One arm, the rock torn from the ground and thrown forward-up: not the heavy trio's two-armed overhead
// slam (A3_MIMARI §9). The feet never move.

/** A delta over a pose: nested objects merged, tuples and values replaced (PoseDelta semantics). */
function over<T>(a: T, d: unknown): T {
  if (d === undefined) return a;
  if (Array.isArray(d) || typeof d !== 'object' || d === null) return d as T;
  const o: Record<string, unknown> = { ...(a as Record<string, unknown>) };
  for (const [k, v] of Object.entries(d as Record<string, unknown>)) o[k] = over((a as Record<string, unknown>)?.[k], v);
  return o as T;
}

/**
 * A key whose near hand goes to `to` (v1 px) from wherever its pose puts the shoulder (the plan
 * clamps an out-of-reach hand along the line). The arm is drawn `upperX` px off the rig, so is the hand.
 */
function reach(d: D, to: V, grip: 'fist' | 'open' | 'hold' = 'fist', bend: 1 | -1 = 1): (base: Pose) => Pose {
  return (base) => {
    const p = over(base, d) as Pose;
    const rig = bipedRig(BUILD, p);
    const ux = Math.round(p.fx?.upperX ?? 0);
    const t = at1(to[0], to[1]);
    const hand: V = [t[0] - ux - rig.shoulderN[0] - REST.handN[0], t[1] - rig.shoulderN[1] - REST.handN[1]];
    return over(p, { armN: { hand, bend, grip } });
  };
}

/** The boulder in the floor, its centre `dy` px under the dig spot (shown above the hole's lip only). */
const rockInFloor = (dy: number): BipedProp => ({ at: 'floor', a: 0, show: 1, off: [DIG_AT[0] - REST_RIG.root[0], DIG_AT[1] + dy - REST_RIG.ground] });
/** The boulder carried by the near hand, its centre `off` px from the hand. */
const rockInHand = (off: V): BipedProp => ({ at: 'handN', a: 0, show: 1, off });
const NO_ROCK: BipedProp = { at: 'handN', a: 0, show: 0 };
/** The planted shield shoved / lifted by the far arm (px from where it stands). */
const shieldAt = planted;
/**
 * The far hand ON the slab's grip wherever the slab stands (the far arm reaches with it). The plan
 * carries a hand with its shoulder, so a body leaning back over a slab shoved out the other way would
 * leave the hand short of the grip: the hand is solved here from the shoulder this pose puts it at
 * (joints().handF and points().grip then follow the slab itself).
 */
function onShield(p: Pose): Pose {
  const s = p.props?.shield;
  if (!s || s.at !== 'floor') return p;
  const rig = bipedRig(BUILD, p);
  const g = rig.props.shield?.at;
  if (!g) return p;
  const ux = Math.round(p.fx?.upperX ?? 0);
  const hand: V = [g[0] - ux - rig.shoulderF[0] - REST.handF[0], g[1] - rig.shoulderF[1] - REST.handF[1]];
  return over(p, { armF: { hand, bend: 1, grip: 'hold' } });
}
/** Beats whose far hand stays on the slab all through (the throw: it digs, heaves and throws one-handed). */
const pinned = (beats: readonly Beat<Pose>[]): Beat<Pose>[] =>
  beats.map((b) => {
    const k = b.key;
    return { ...b, key: (base: Pose) => onShield(typeof k === 'function' ? k(base) : over(base, k)) };
  });

const attack: AnimDef<Pose> = {
  base: 'idle0',
  beats: pinned([
    // look: the eyes go to the ground first — the helm dips toward the dig spot, the near pauldron drops
    // a pixel, the fist tightens (the declaration holds this frame)
    { name: 'charge', ms: 50, key: { head: { x: -1, y: 1, a: 0, lag: 0 }, fx: { rune: 1.3, padN: 1, fistY: -1 } } },
    // the bend begins: hips down, the spine tipping a little to the near side, the arm hanging
    { ms: 50, key: { hip: { x: 0, y: 2, tilt: 0 }, lean: -0.05, head: { x: -1, y: 1, a: 0, lag: 0.45 }, armN: { hand: [-1, 1], bend: 1, grip: 'fist' }, fx: { rune: 1.35, padN: 1 } } },
    // the reach: hips 4 px down over the planted feet, the arm straight down beside the near foot, the hand opening over the floor
    { ms: 60, key: { hip: { x: 0, y: 4, tilt: 0 }, lean: -0.1, head: { x: -1, y: 1, a: 0, lag: 0.35 }, armN: { hand: [-1.5, 3], bend: 1, grip: 'open' }, fx: { rune: 1.4, padN: 1 } } },
    // the dig: the fingers bite into the floor, it cracks; the boulder's top shows in the crack
    { ms: 70, key: { hip: { x: 0, y: 5, tilt: 0 }, lean: -0.12, head: { x: -1, y: 2, a: 0, lag: 0.2 }, armN: { hand: [-1.5, 3], bend: 1, grip: 'fist' }, props: { rock: rockInFloor(2) }, fx: { rune: 1.5, padN: 1, crack: 0.6, dirt: 0.15, dust: 0.2 } } },
    // the STRAIN: the earth holds — the body heaves a pixel against it, the arm straight, the rock shaken
    // a pixel up in its bed, the crack widening, the lip of the crater heaving
    { ms: 140, key: { hip: { x: 0, y: 4, tilt: 0 }, lean: -0.11, head: { x: -1, y: 1, a: 0, lag: 0.3 }, armN: { hand: [-1.5, 3], bend: 1, grip: 'fist' }, props: { rock: rockInFloor(1) }, fx: { rune: 1.6, padN: 0, crack: 1, crater: 0.35, dirt: 0.3, dust: 0.4 } } },
    // the RIP: out of the floor in one fast frame, hanging under the fist; the crater open, dirt bursting
    { ms: 50, key: reach({ hip: { x: 0, y: 1, tilt: 0 }, lean: -0.05, head: { x: -1, y: 0, a: 0, lag: 0.3 }, props: { rock: rockInHand([0, 6]) }, fx: { rune: 1.7, crack: 1, crater: 1, dirt: 0.5, dust: 0.65 } }, [11, 51], 'fist') },
    // the curl: the elbow stays under the shoulder (the pivot), the forearm swings forward-up, the
    // wrist turning under the rock, which rolls up onto the fist at the belt
    { ms: 60, key: reach({ hip: { x: 0, y: 0, tilt: 0 }, lean: -0.04, head: { x: -1, y: 0, a: 0, lag: 0.1 }, props: { rock: rockInHand([-2, -2]) }, fx: { rune: 1.75, crack: 1, crater: 1, dirt: 0.75, dust: 0.85, padN: -1 } }, [17, 46], 'hold', 1) },
    // the catch at the shoulder: the elbow tucked under it, the rock settling beside the helm
    { ms: 100, key: reach({ hip: { x: 0, y: 2, tilt: 0 }, lean: -0.06, head: { x: -1, y: 0, a: 0, lag: 0 }, props: { rock: rockInHand([0, -4]), shield: shieldAt([1, 0]) }, fx: { rune: 1.8, crack: 1, crater: 1, dirt: 0.95, padN: -1 } }, [10, 34], 'hold', -1) },
    // the press: up off the shoulder past the helm, the elbow driving up in front of the pauldron; the
    // shield starts out the other way
    { ms: 60, key: reach({ hip: { x: -1, y: 1, tilt: 0 }, lean: -0.08, head: { x: -1, y: 0, a: 0, lag: 0.3 }, props: { rock: rockInHand([0, -5]), shield: shieldAt([3, -1]) }, fx: { rune: 1.85, slit: 1.3, crack: 1, crater: 1, padN: -2 } }, [10, 23], 'hold', 1) },
    // heaved overhead: leaning back, the shield shoved out and up the other way, leaning (the counterweight)
    { ms: 80, key: reach({ hip: { x: -1, y: 2, tilt: 0 }, lean: -0.13, head: { x: -1, y: -1, a: 0, lag: 0 }, props: { rock: rockInHand([1, -6]), shield: shieldAt([6, -3]) }, fx: { rune: 1.9, slit: 1.6, glint: 1, crack: 1, crater: 1, padN: -2, tilt: 1 } }, [12, 15], 'hold', -1) },
    // the hold, the longest frame right before the throw: the rock trembles back a pixel over the helm,
    // the knees take the load, the slab swung furthest out and leaning, the eye's glint
    { ms: 180, key: reach({ hip: { x: -1, y: 2, tilt: 0 }, lean: -0.14, head: { x: -1, y: -1, a: 0, lag: 0 }, props: { rock: rockInHand([0, -7]), shield: shieldAt([7, -3]) }, fx: { rune: 2, slit: 2, glint: 2, crack: 1, crater: 1, padN: -2, tilt: 2 } }, [11, 15], 'hold', -1) },
    // the whip: hips drive forward, the arm comes over the top in front of its pauldron, the shield pulled back in
    { ms: 50, key: reach({ hip: { x: 1, y: 1, tilt: 0 }, lean: 0.04, twist: 0.15, head: { x: 0, y: 0, a: 0, lag: 0.3 }, slots: { pauldronN: 'head' }, props: { rock: rockInHand([1, -6]), shield: shieldAt([2, -1]) }, fx: { rune: 2, slit: 2, glint: 1, crack: 1, crater: 1, padN: -2, tilt: 1 } }, [21, 13], 'hold', -1) },
    // RELEASE: the hand opens forward-up toward the foe, the rock just off the fingertips (the muzzle),
    // the shoulder rolled over, the helm dipping under the arm; a 2-px smear behind the rock
    { name: 'release', smear: true, ms: 60, key: reach({ hip: { x: 2, y: 2, tilt: 0 }, lean: 0.15, twist: 0.35, head: { x: 2, y: 3, a: 0, lag: 0.2 }, slots: { pauldronN: 'head' }, props: { rock: rockInHand([10, -6]), shield: shieldAt([0, 0]) }, fx: { rune: 2, slit: 2, crack: 1, crater: 1, padN: -1 } }, [33, 9], 'open', -1) },
    // the follow-through: the arm swings on through BELOW the helm — the forearm across the chest, the
    // fist at the far side — the weight onto the front foot (dust off it)
    { name: 'recover', ms: 90, key: reach({ hip: { x: 2, y: 2, tilt: 0 }, lean: 0.16, twist: 0.3, head: { x: 1, y: 1, a: 0, lag: 0.3 }, props: { rock: NO_ROCK }, fx: { rune: 1.8, slit: 1.6, crack: 1, crater: 1, dust: 0.3, dustAt: 4 } }, [41, 40], 'fist') },
    { ms: 110, key: reach({ hip: { x: 1, y: 1, tilt: 0 }, lean: 0.08, twist: 0.15, head: { x: 1, y: 1, a: 0, lag: 0.2 }, props: { rock: NO_ROCK }, fx: { rune: 1.5, slit: 1.3, crack: 1, crater: 1, dust: 0.65, dustAt: 4 } }, [22, 46]) },
    { ms: 130, key: reach({ hip: { x: 0, y: 0, tilt: 0 }, lean: 0.02, head: { x: 0, y: 1, a: 0, lag: 0.1 }, props: { rock: NO_ROCK }, fx: { rune: 1.2, slit: 1.1, crack: 1, crater: 1, dust: 0.9, dustAt: 4 } }, [14, 47]) },
  ]),
  end: 'idle0',
  endMs: 140,
};

// ------------------------------------------------------------------ roar: the shield slam
//
// The identity is the shield: the far arm wrenches the planted slab up out of the floor (the coil,
// the longest hold with the shield high), DRIVES it back down (the impact: rock spikes heave up in
// front of it, dust and grit burst), then the sentinel rears up behind it, the near fist thrust to
// the sky, the helm thrown back, ᛉ and slit blazing, rune sparks rising; then it settles.

const roar: AnimDef<Pose> = {
  base: 'idle0',
  beats: pinned([
    { name: 'charge', ms: 90, key: { head: { x: 0, y: 1, a: 0, lag: 0 }, props: { shield: shieldAt([0, -1]) }, fx: { rune: 1.3, srune: 0.6, padF: -1 } } },
    // the far arm wrenches the slab up out of the floor; the body leans back against it
    { ms: 130, key: { hip: { x: -1, y: 0, tilt: 0 }, lean: -0.06, head: { x: -1, y: 0, a: 0, lag: 0.2 }, armN: { hand: [-1, 0], bend: 1, grip: 'fist' }, armF: { hand: [0, -7], bend: 1, grip: 'hold' }, props: { shield: shieldAt([-1, -7]) }, fx: { rune: 1.5, srune: 1.2, slit: 1.4, padF: -1 } } },
    // the coil, the longest hold: the shield high, the hanging fist clenched back
    { ms: 170, key: { hip: { x: -1, y: 0, tilt: 0 }, lean: -0.09, head: { x: -1, y: -1, a: 0, lag: 0 }, armN: { hand: [-2, -1], bend: 1, grip: 'fist' }, armF: { hand: [0, -9], bend: 1, grip: 'hold' }, props: { shield: shieldAt([-1, -9]) }, fx: { rune: 1.7, srune: 1.6, slit: 1.6, padF: -2, fistY: -1 } } },
    // the drop begins near the top — the body already falling onto it — so the slab SPEEDS UP into
    // the floor (2 px, then 8 px: heavy, Cubic.In)
    { ms: 50, key: { hip: { x: 0, y: 1, tilt: 0 }, lean: 0.02, head: { x: 0, y: 0, a: 0, lag: 0.3 }, armN: { hand: [0, -1], bend: 1, grip: 'fist' }, armF: { hand: [0, -7], bend: 1, grip: 'hold' }, props: { shield: shieldAt([0, -7]) }, fx: { rune: 1.8, srune: 1.8, slit: 1.8 } } },
    // IMPACT: the slab driven into the floor, the floor cracks, spikes heave up in front of it, dust and grit
    { name: 'release', ms: 60, key: { hip: { x: 1, y: 3, tilt: 0 }, lean: 0.1, head: { x: 1, y: 2, a: 0, lag: 0.2 }, armN: { hand: [1, 1], bend: 1, grip: 'fist' }, props: { shield: shieldAt([0, 1]) }, fx: { rune: 2, srune: 2, slit: 2, crack: 0.7, crackAt: 1, spikes: 0.55, dust: 0.2, dustAt: 1, chips: 0.2, chipsAt: 1 } } },
    // rising out of the slam: the elbow leads the fist up past the shoulder (forearm upright), the helm
    // halfway back, the pauldron lifting with it — the in-between of the rise (HA-13)
    { ms: 55, key: reach({ hip: { x: 1, y: 1, tilt: 0 }, lean: 0, head: { x: 0, y: 0, a: 0, lag: 0.3 }, props: { shield: shieldAt([0, 1]) }, fx: { rune: 2, srune: 1.9, slit: 2, glint: 1, crack: 0.9, crackAt: 1, spikes: 0.8, dust: 0.32, dustAt: 1, chips: 0.38, chipsAt: 1, spark: 0.1, padN: -1 } }, [10, 30], 'fist', -1) },
    // the roar: reared up behind the shield, the fist thrust to the sky in front of its pauldron, the helm thrown back
    { ms: 110, key: reach({ hip: { x: 0, y: -1, tilt: 0 }, lean: -0.11, head: { x: -1, y: -2, a: 0, lag: 0 }, slots: { pauldronN: 'head' }, props: { shield: shieldAt([0, 1]) }, fx: { rune: 2, srune: 1.8, slit: 2, glint: 2, crack: 1, crackAt: 1, spikes: 1, dust: 0.45, dustAt: 1, chips: 0.55, chipsAt: 1, spark: 0.25, padN: -2 } }, [15, 2], 'fist', 1) },
    { ms: 100, key: reach({ hip: { x: 0, y: -1, tilt: 0 }, lean: -0.12, head: { x: -1, y: -2, a: 0, lag: 0 }, slots: { pauldronN: 'head' }, props: { shield: shieldAt([0, 1]) }, fx: { rune: 2, srune: 1.6, slit: 2, glint: 1, crack: 1, crackAt: 1, spikes: 0.85, dust: 0.75, dustAt: 1, chips: 0.85, chipsAt: 1, spark: 0.55, padN: -2 } }, [14, 1], 'fist', 1) },
    // coming down: the fist back past the shoulder, the forearm upright (the rise in reverse)
    { name: 'recover', ms: 110, key: reach({ hip: { x: 0, y: 0, tilt: 0 }, lean: -0.06, head: { x: -1, y: -1, a: 0, lag: 0.2 }, props: { shield: shieldAt([0, 1]) }, fx: { rune: 1.7, srune: 1.3, slit: 1.5, crack: 1, crackAt: 1, spikes: 0.5, dust: 0.95, dustAt: 1, spark: 0.8, padN: -1 } }, [8, 31], 'fist', -1) },
    { ms: 130, key: { hip: { x: 0, y: 0, tilt: 0 }, lean: -0.02, head: { x: 0, y: 0, a: 0, lag: 0.1 }, armN: { hand: [-1, -1], bend: 1, grip: 'fist' }, props: { shield: shieldAt([0, 0]) }, fx: { rune: 1.3, srune: 0.8, slit: 1.2, crack: 0.6, crackAt: 1, spikes: 0.2, spark: 0.97, fistY: 1 } } },
    { ms: 140, key: { hip: { x: 0, y: 0, tilt: 0 }, props: { shield: shieldAt([0, 0]) }, fx: { rune: 1.1, srune: 0.3, crack: 0.3, crackAt: 1 } } },
  ]),
  end: 'idle0',
  endMs: 150,
};

// ================================================================== part 2: the extras
//
// The heavy struck pose (hitHeavy f0 = death f0, HA-24): the slab driven hard back into the body and
// up off the floor, the helm snapped back, the eye nearly out, chips off the shield's face — the
// hips, legs, near arm and chest keep idle f0's pixels (HA-21).
const HEAVY_STRUCK: D = { props: { shield: planted([-3, -1]) }, head: { x: -2, y: 0, a: 0, lag: 0 }, fx: { slit: 0.1, rune: 0.3, chips: 0.2 } };

// ------------------------------------------------------------------ hitHeavy: driven back a step
//
// A harder blow than hit: the shield slammed back, then the whole statue rocks back on its heels, the
// near (back) foot comes up and plants a step behind (dust off the heel), the knees take the load, the
// weight comes forward again over the planted feet and the back foot lifts and steps home. The feet
// only move in the air (HA-9).
const hitHeavy: AnimDef<Pose> = {
  base: 'idle0',
  struck: { regions: ['propF', 'head', 'extra'] },
  beats: [
    beat(50, HEAVY_STRUCK, 'struck'),
    beat(60, { props: { shield: planted([-3, 0]) }, hip: { x: -2, y: 0, tilt: 0 }, lean: -0.08, head: { x: -2, y: 0, a: 0, lag: 0.4 }, armN: { hand: [1, -1], bend: 1, grip: 'fist' }, fx: { slit: 0.2, rune: 0.4, chips: 0.45 } }),
    beat(80, { props: { shield: planted([-2, 0]) }, footN: { step: [-3, 0], lift: 2 }, hip: { x: -3, y: 0, tilt: 0 }, lean: -0.1, head: { x: -2, y: 0, a: 0, lag: 0.3 }, armN: { hand: [2, 0], bend: 1, grip: 'fist' }, fx: { slit: 0.3, rune: 0.5, chips: 0.7 } }),
    beat(90, { props: { shield: planted([-1, 0]) }, footN: { step: [-3, 0], lift: 0 }, hip: { x: -3, y: 2, tilt: 0 }, lean: -0.06, head: { x: -1, y: 1, a: 0, lag: 0.3 }, armN: { hand: [1, 0], bend: 1, grip: 'fist' }, fx: { slit: 0.5, rune: 0.7, chips: 0.95, dust: 0.3, dustAt: 7 } }),
    beat(110, { props: { shield: planted() }, footN: { step: [-3, 0], lift: 0 }, hip: { x: -1, y: 1, tilt: 0 }, lean: 0.02, head: { x: 0, y: 1, a: 0, lag: 0.2 }, armN: { hand: [-1, 0], bend: 1, grip: 'fist' }, fx: { slit: 0.8, rune: 0.9, dust: 0.6, dustAt: 7 } }, 'recover'),
    beat(110, { props: { shield: planted() }, footN: { step: [-1, 0], lift: 2 }, hip: { x: 0, y: 0, tilt: 0 }, lean: 0.04, armN: { hand: [0, 0], bend: 1, grip: 'fist' }, fx: { dust: 0.85, dustAt: 7 } }),
    beat(120, { props: { shield: planted() }, hip: { x: 0, y: 1, tilt: 0 }, lean: 0.01, fx: { fistY: 1 } }),
  ],
  end: 'idle0',
  endMs: 130,
};

// ------------------------------------------------------------------ hitMagic: the spell runs through the stone
//
// The spell lands in the runes: the eye slit and the ᛉ / Ψ stems burn white and its light runs out
// from the ᛉ along hairline cracks; the statue goes rigid (up on its locked knees, the arm stiff),
// the blocks rattle a pixel each way (the chest one way, the pauldrons the other), then the stiffness
// breaks: it sags below its rest, the light spent below normal, and the blocks settle back one by one.
const hitMagic: AnimDef<Pose> = {
  base: 'idle0',
  struck: { regions: ['head', 'extra'] },
  beats: [
    beat(50, { head: { x: 0, y: -1, a: 0, lag: 0 }, fx: { slit: 2, rune: 2, srune: 1.6, flare: 1, crackle: 1, vein: 0.45 } }, 'struck'),
    beat(60, { hip: { x: 0, y: -1, tilt: 0 }, lean: -0.03, head: { x: 0, y: -1, a: 0, lag: 0 }, armN: { hand: [1, -1], bend: 1, grip: 'fist' }, fx: { slit: 2, rune: 2, srune: 1.6, flare: 0.6, crackle: 0.9, vein: 1 } }),
    beat(70, { hip: { x: 0, y: -1, tilt: 0 }, lean: -0.03, head: { x: 0, y: -1, a: 0, lag: 0 }, armN: { hand: [1, -1], bend: 1, grip: 'fist' }, fx: { slit: 1.8, rune: 1.8, srune: 1.3, flare: 0.3, crackle: 0.55, vein: 1, upperX: 1, padN: -1 } }),
    beat(70, { hip: { x: 0, y: -1, tilt: 0 }, lean: -0.02, head: { x: 0, y: -1, a: 0, lag: 0 }, armN: { hand: [0, -1], bend: 1, grip: 'fist' }, fx: { slit: 1.5, rune: 1.5, srune: 1, crackle: 0.3, vein: 1, upperX: -1, padF: -1 } }),
    beat(100, { hip: { x: 0, y: 1, tilt: 0 }, lean: 0.04, head: { x: 0, y: 1, a: 0, lag: 0.3 }, armN: { hand: [0, 1], bend: 1, grip: 'fist' }, fx: { slit: 0.5, rune: 0.6, srune: 0.4 } }, 'recover'),
    beat(110, { hip: { x: 0, y: 1, tilt: 0 }, lean: 0.02, fx: { slit: 0.7, rune: 0.8, padN: 1, padF: 1, fistY: 1 } }),
    beat(120, { fx: { slit: 0.9, rune: 1, padN: 1 } }),
  ],
  end: 'idle0',
  endMs: 130,
};

// ------------------------------------------------------------------ death: the crumble
//
// From the heavy struck pose it reels back after its helm; the light leaves the eye and the ᛉ; the
// weight comes forward and the knees give; cracks run out from the ᛉ (the binding fails at its
// heart) and the joints between the blocks open while the stack slumps onto itself (the chest onto
// the belt); then it comes apart: the helm tips off the front and drops to the floor at the foot of
// the shield (in front of everything: head.front), the near pauldron slides off its shoulder to the
// floor, the far one behind the slab; at the dissolve the edges start to crumble (chunks falling,
// the body's own stone dust rolling out). The planted shield stands while its guardian falls apart
// behind it. The last frame is the low heap the death kit breaks into stone (its shatter and the
// card come after it).
const HEAP_BODY: D = { hip: { x: 1, y: 4, tilt: 0 }, lean: 0.1, breath: -4 };
const death: AnimDef<Pose> = {
  base: 'idle0',
  struck: { regions: ['propF', 'head', 'extra'] },
  beats: [
    beat(60, HEAVY_STRUCK, 'struck'),
    beat(80, { props: { shield: planted([-2, 0]) }, hip: { x: -2, y: 0, tilt: 0 }, lean: -0.08, head: { x: -2, y: 0, a: 0, lag: 0.4 }, armN: { hand: [1, -1], bend: 1, grip: 'fist' }, fx: { slit: 0, rune: 0.15, chips: 0.45 } }),
    beat(110, { props: { shield: planted([-1, 0]) }, hip: { x: 0, y: 2, tilt: 0 }, lean: 0.03, head: { x: -1, y: 2, a: 0, lag: 0.3 }, armN: { hand: [1, 1], bend: 1, grip: 'fist' }, pass: { crumble: 0.1 }, fx: { slit: 0, rune: 0, chips: 0.7, padN: 1, padF: 1 } }),
    beat(80, { hip: { x: 0, y: 3, tilt: 0 }, lean: 0.07, breath: -2, head: { x: 0, y: 3, a: 0, lag: 0 }, armN: { hand: [1, 3], bend: 1, grip: 'fist' }, pass: { crumble: 0.25 }, fx: { slit: 0, rune: 0, chips: 0.95, padN: 2, padF: 2 } }),
    beat(70, { ...HEAP_BODY, head: { x: 2, y: 3, a: 0, lag: 0 }, armN: { hand: [1, 5], bend: 1, grip: 'fist' }, pass: { crumble: 0.4 }, fx: { slit: 0, rune: 0, courseY: 1, padN: 6, padNX: -1, padF: 5, dust: 0.2, dustAt: 5, dustTone: 1 } }, 'dissolve'),
    beat(60, { ...HEAP_BODY, head: { x: 4, y: 9, a: 0, lag: 0 }, slots: { helm: 'head.front' }, armN: { hand: [1, 7], bend: 1, grip: 'fist' }, pass: { crumble: 0.52 }, fx: { slit: 0, rune: 0, courseY: 1, padN: 12, padNX: -2, padF: 8, dust: 0.35, dustAt: 5, dustTone: 1 } }),
    beat(50, { ...HEAP_BODY, head: { x: 4, y: 19, a: 0, lag: 0 }, slots: { helm: 'head.front' }, armN: { hand: [1, 8], bend: 1, grip: 'fist' }, pass: { crumble: 0.64 }, fx: { slit: 0, rune: 0, courseY: 1, padN: 19, padNX: -3, padF: 10, dust: 0.5, dustAt: 5, dustTone: 1 } }),
    beat(60, { ...HEAP_BODY, head: { x: 4, y: 27, a: 0, lag: 0 }, slots: { helm: 'head.front' }, armN: { hand: [1, 8], bend: 1, grip: 'fist' }, pass: { crumble: 0.76 }, fx: { slit: 0, rune: 0, courseY: 1, padN: 21, padNX: -3, padF: 11, dust: 0.62, dustAt: 5, dustTone: 1, chips: 0.3, chipsAt: 4 } }),
    beat(80, { ...HEAP_BODY, head: { x: 4, y: 26, a: 0, lag: 0 }, slots: { helm: 'head.front' }, armN: { hand: [1, 8], bend: 1, grip: 'fist' }, pass: { crumble: 0.88 }, fx: { slit: 0, rune: 0, courseY: 1, padN: 20, padNX: -3, padF: 11, dust: 0.78, dustAt: 5, dustTone: 1, chips: 0.6, chipsAt: 4 } }),
    beat(110, { ...HEAP_BODY, head: { x: 4, y: 27, a: 0, lag: 0 }, slots: { helm: 'head.front' }, armN: { hand: [1, 8], bend: 1, grip: 'fist' }, pass: { crumble: 1 }, fx: { slit: 0, rune: 0, courseY: 1, padN: 21, padNX: -3, padF: 11, dust: 0.92, dustAt: 5, dustTone: 1, chips: 0.9, chipsAt: 4 } }),
  ],
  end: 'hold',
};

// ------------------------------------------------------------------ summon: the assembly
//
// The floor of the tile breaks open and a loose column of stone blocks comes up out of it — helm and
// pauldrons first, a gap of floor-light between every block — until the whole column stands clear,
// the sabatons hovering over the hole; then its joints close from the bottom up (the feet land, the
// belt locks onto them, the courses and the chest, then the pauldrons and the helm drop into their
// seats: [land]); the moss caps squash on the impact and settle; the shield, risen out of the floor
// beside it, is heaved and driven down into its socket (the peak beat: the kit's finale shakes on
// it); the ᛉ kindles, and the eye lights LAST.
const stack = (rise: number, gap: number, lock: number): Partial<SentinelFx> => ({ rise, gap, lock, wobble: 1 });
/** While the column is loose the far arm hangs tucked in behind the torso (its slab is still in the floor). */
const TUCKED_F: D['armF'] = { hand: [-4, -3], bend: 1, grip: 'hold' };
const summon: AnimDef<Pose> = {
  base: 'idle0',
  beats: [
    beat(60, { props: { shield: planted([0, 40]) }, armF: TUCKED_F, fx: { ...stack(64, 1, 0), rune: 0, slit: 0, pit: 0.85, dirt: 0.15, dirtAt: 5 } }),
    beat(70, { props: { shield: planted([0, 40]) }, armF: TUCKED_F, fx: { ...stack(42, 1, 0), rune: 0, slit: 0, pit: 0.9, dirt: 0.4, dirtAt: 5 } }),
    beat(60, { props: { shield: planted([0, 32]) }, armF: TUCKED_F, fx: { ...stack(22, 1, 0), rune: 0, slit: 0, pit: 1, dirt: 0.68, dirtAt: 5 } }),
    beat(60, { props: { shield: planted([0, 22]) }, armF: TUCKED_F, fx: { ...stack(8, 1, 0), rune: 0, slit: 0, pit: 1, dirt: 0.92, dirtAt: 5 } }),
    beat(110, { props: { shield: planted([0, 14]) }, armF: TUCKED_F, fx: { ...stack(0, 1, 1), rune: 0, slit: 0, pit: 1, dust: 0.15, dustAt: 5 } }),
    beat(60, { props: { shield: planted([0, 8]) }, armF: { hand: [-2, -2], bend: 1, grip: 'hold' }, fx: { ...stack(0, 1, 2), rune: 0, slit: 0, pit: 1.1, dust: 0.3, dustAt: 5 } }),
    beat(50, { props: { shield: planted([0, 4]) }, armF: { hand: [-1, -1], bend: 1, grip: 'hold' }, fx: { ...stack(0, 1, 4), rune: 0, slit: 0, pit: 1.25, dust: 0.45, dustAt: 5 } }),
    beat(90, { props: { shield: planted([0, 1]) }, hip: { x: 0, y: 1, tilt: 0 }, fx: { rune: 0, slit: 0, mossY: 1, pit: 1.45, dust: 0.6, dustAt: 5 } }, 'land'),
    beat(80, { props: { shield: planted() }, fx: { rune: 0, slit: 0, pit: 1.7, dust: 0.8, dustAt: 5 } }),
    beat(70, { props: { shield: planted([0, -2]) }, lean: -0.03, armF: { hand: [0, -2], bend: 1, grip: 'hold' }, fx: { rune: 0.4, slit: 0, srune: 0.5, pit: 1.9 } }),
    beat(50, { props: { shield: planted([0, 1]) }, hip: { x: 0, y: 1, tilt: 0 }, lean: 0.05, fx: { rune: 1.4, slit: 0, srune: 1.6, dust: 0.25, dustAt: 1 } }),
    beat(80, { props: { shield: planted() }, lean: 0.02, fx: { rune: 1.6, slit: 0.8, glint: 1, srune: 0.8, dust: 0.55, dustAt: 1 } }),
    beat(100, { fx: { rune: 1.3, slit: 2, glint: 2, srune: 0.2, dust: 0.85, dustAt: 1 } }),
    beat(60, { fx: { rune: 1.15, slit: 1.4, glint: 1 } }),
  ],
  end: 'idle0',
  endMs: 130,
};

// ------------------------------------------------------------------ revive: the reassembly
//
// Not the summon: the guardian comes back out of its own rubble. The heap the death left lies on the
// tile, its cracks lit by the binding light; the broken-off chunks fly back up the paths they fell
// along into their notches while the blocks heave back up the way they slumped (the pauldrons up
// the shoulders, the helm out of the chest, the arm off the floor), the cracks closing behind the
// light — [land] whole and standing; then the light comes back into the runes: the ᛉ, the shield's Ψ,
// and the eye last; a first breath, and the idle.
const HEAP: D = { ...HEAP_BODY, head: { x: 4, y: 27, a: 0, lag: 0 }, slots: { helm: 'head.front' }, armN: { hand: [1, 8], bend: 1, grip: 'fist' }, fx: { slit: 0, rune: 0, courseY: 1, padN: 21, padNX: -3, padF: 11 } };
const revive: AnimDef<Pose> = {
  base: 'idle0',
  beats: [
    beat(100, { ...HEAP, pass: { reassemble: 0 } }),
    beat(80, { ...HEAP, head: { x: 4, y: 24, a: 0, lag: 0 }, pass: { reassemble: 0.16 }, fx: { ...HEAP.fx, padN: 18 } }),
    beat(70, { ...HEAP_BODY, head: { x: 4, y: 15, a: 0, lag: 0 }, slots: { helm: 'head.front' }, armN: { hand: [1, 6], bend: 1, grip: 'fist' }, pass: { reassemble: 0.34 }, fx: { slit: 0, rune: 0, courseY: 1, padN: 11, padNX: -2, padF: 8 } }),
    beat(60, { hip: { x: 1, y: 3, tilt: 0 }, lean: 0.07, breath: -3, head: { x: 3, y: 5, a: 0, lag: 0 }, armN: { hand: [1, 4], bend: 1, grip: 'fist' }, pass: { reassemble: 0.55 }, fx: { slit: 0, rune: 0, courseY: 1, padN: 5, padNX: -1, padF: 4 } }),
    beat(60, { hip: { x: 0, y: 2, tilt: 0 }, lean: 0.03, breath: -1, head: { x: 1, y: 2, a: 0, lag: 0 }, armN: { hand: [1, 2], bend: 1, grip: 'fist' }, pass: { reassemble: 0.76 }, fx: { slit: 0, rune: 0, padN: 2, padF: 1 } }),
    beat(90, { hip: { x: 0, y: 1, tilt: 0 }, pass: { reassemble: 0.93 }, fx: { slit: 0, rune: 0, mossY: 1 } }, 'land'),
    beat(90, { pass: { reassemble: 1 }, fx: { slit: 0, rune: 0.6 } }),
    beat(80, { fx: { slit: 0, rune: 1.3, srune: 0.9 } }),
    beat(80, { fx: { slit: 0.8, glint: 1, rune: 1.5, srune: 0.4 } }),
    beat(110, { fx: { slit: 2, glint: 2, rune: 1.4 } }),
    beat(120, { breath: 1, fx: { slit: 1.4, glint: 1, rune: 1.2, padN: 1, padF: 1 } }),
    beat(130, { fx: { rune: 1.1 } }),
  ],
  end: 'idle0',
  endMs: 140,
};

// ------------------------------------------------------------------ toGuard / fromGuard
//
// The guard is the shield planted deeper and the body hunkered behind it (guard f0). toGuard: the far
// hand grips and heaves the slab up out of its socket while the body starts down, then drives it
// down into the floor (the Ψ flaring as it bites) as the body hunkers in, the helm sinking last.
// fromGuard: the Ψ dims, the slab is pulled up out of its socket as the body rises, the helm comes
// up over the rim a frame late, the slab is set down, the arm swings back to its hang. The feet and
// the shield's foot never move sideways (HA-9), so no floor dust here: the Ψ is the accent.
const toGuard: AnimDef<Pose> = {
  base: 'idle0',
  beats: [
    beat(60, { props: { shield: planted([0, -1]) }, hip: { x: 0, y: 1, tilt: 0 }, armF: { hand: [0, -1], bend: 1, grip: 'hold' }, fx: { srune: 0.3 } }),
    beat(70, { props: { shield: planted([0, -2]) }, hip: { x: 0, y: 2, tilt: 0 }, lean: 0.05, head: { x: 0, y: 0, a: 0, lag: 0.5 }, armN: { hand: [1, -1], bend: 1, grip: 'fist' }, armF: { hand: [0, -2], bend: 1, grip: 'hold' }, fx: { srune: 0.6, rune: 0.9, slit: 1.2, fistY: -1 } }),
    beat(60, { props: { shield: planted([0, 1]) }, hip: { x: 1, y: 3, tilt: 0 }, lean: 0.1, head: { x: 1, y: 0, a: 0, lag: 0.4 }, armN: { hand: [1, 0], bend: 1, grip: 'fist' }, fx: { srune: 1.8, rune: 0.8, slit: 1.4 } }),
    beat(80, { props: { shield: planted([0, 1]) }, hip: { x: 1, y: 3, tilt: 0 }, lean: 0.12, head: { x: 1, y: 1, a: 0, lag: 0.2 }, armN: { hand: [0, 1], bend: 1, grip: 'fist' }, fx: { srune: 1.3, rune: 0.8, slit: 1.4, padF: 1 } }),
  ],
  end: 'guard0',
  endMs: 90,
};

const fromGuard: AnimDef<Pose> = {
  base: 'guard0',
  beats: [
    beat(70, { props: { shield: planted([0, 0]) }, hip: { x: 1, y: 2, tilt: 0 }, lean: 0.09, head: { x: 1, y: 1, a: 0, lag: 0.3 }, armF: { hand: [0, -1], bend: 1, grip: 'hold' }, fx: { srune: 0.6, rune: 0.85 } }),
    beat(70, { props: { shield: planted([0, -1]) }, hip: { x: 0, y: 1, tilt: 0 }, lean: 0.05, head: { x: 1, y: 1, a: 0, lag: 0.5 }, armF: { hand: [0, -1], bend: 1, grip: 'hold' }, fx: { srune: 0.4, rune: 0.9, slit: 1.2 } }),
    beat(70, { props: { shield: planted() }, hip: { x: 0, y: 0, tilt: 0 }, lean: 0.01, head: { x: 0, y: 0, a: 0, lag: 0.2 }, armN: { hand: [-1, 0], bend: 1, grip: 'fist' }, fx: { srune: 0.2, rune: 1, slit: 1 } }),
    beat(80, { props: { shield: planted() }, hip: { x: 0, y: 0, tilt: 0 }, lean: 0, head: { x: 0, y: 0, a: 0, lag: 0 }, armN: { hand: [0, 0], bend: 1, grip: 'fist' }, fx: { srune: 0, rune: 1, slit: 1, padN: 1, fistY: 1 } }),
  ],
  end: 'idle0',
  endMs: 90,
};

// ------------------------------------------------------------------ victory: the salute
//
// Not the roar's fist to the sky: the guardian stands up to its full height, heaves the shield and
// plants it with a thud (the Ψ flares, dust at its foot), then brings the near fist to its chest
// beside the ᛉ and holds it there — the eye steady and bright.
const victory: AnimDef<Pose> = {
  base: 'idle0',
  beats: [
    beat(100, { hip: { x: 0, y: -1, tilt: 0 }, lean: -0.03, head: { x: 0, y: -1, a: 0, lag: 0.3 }, fx: { rune: 1.3 } }),
    beat(90, { props: { shield: planted([0, -2]) }, hip: { x: 0, y: -1, tilt: 0 }, lean: -0.04, head: { x: 0, y: -1, a: 0, lag: 0 }, armN: { hand: [1, -1], bend: 1, grip: 'fist' }, armF: { hand: [0, -2], bend: 1, grip: 'hold' }, fx: { rune: 1.5, srune: 0.6, fistY: -1 } }),
    { ms: 60, key: reach({ props: { shield: planted([0, 1]) }, hip: { x: 0, y: 0, tilt: 0 }, lean: 0.02, head: { x: 0, y: 0, a: 0, lag: 0.3 }, fx: { rune: 1.8, srune: 1.8, dust: 0.25, dustAt: 1 } }, [19, 40], 'fist') },
    { ms: 100, key: reach({ props: { shield: planted() }, hip: { x: 0, y: -1, tilt: 0 }, lean: -0.02, head: { x: 0, y: -1, a: 0, lag: 0 }, fx: { rune: 2, srune: 1.2, slit: 1.4, glint: 1, dust: 0.55, dustAt: 1 } }, [22, 33], 'fist') },
    { ms: 120, key: reach({ props: { shield: planted() }, hip: { x: 0, y: -1, tilt: 0 }, lean: -0.03, head: { x: 0, y: -1, a: 0, lag: 0 }, fx: { rune: 2, srune: 0.9, slit: 1.8, glint: 2, dust: 0.85, dustAt: 1 } }, [24, 32], 'fist') },
    { ms: 130, key: reach({ props: { shield: planted() }, hip: { x: 0, y: -1, tilt: 0 }, lean: -0.03, head: { x: 0, y: -1, a: 0, lag: 0 }, fx: { rune: 1.9, srune: 0.8, slit: 1.6, glint: 1 } }, [24, 32], 'fist') },
    { ms: 400, key: reach({ props: { shield: planted() }, hip: { x: 0, y: -1, tilt: 0 }, lean: -0.03, head: { x: 0, y: -1, a: 0, lag: 0 }, fx: { rune: 1.8, srune: 0.8, slit: 1.5 } }, [24, 32], 'fist') },
  ],
  end: 'hold',
};

export const ANIMS: AnimDefs<Pose> = {
  idle,
  guard,
  attack,
  roar,
  hit,
  hitHeavy,
  hitMagic,
  death,
  summon,
  revive,
  toGuard,
  fromGuard,
  victory,
};

