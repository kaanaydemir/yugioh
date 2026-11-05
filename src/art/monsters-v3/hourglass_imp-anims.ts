// Kum Saati Cücesi v3 — animations: pose tables, holds, marks, points (docs/v3/oturum-f/hourglass_imp.md §4–§5,
// §0.9 rev. 1).
//
// Rhythm: LIGHT and fidgety, but the glass is a planted wall that moves only when he moves it. The life in idle is the
// stream marching down the neck every frame, the breath (chest, then the head a frame later), the floppy hat tip
// lagging two frames, a blink, an ear twitch and the "is it still running?" double tap on the glass.
//   idle 16 · guard 6 (he hides behind the glass, eyes over its post) · toGuard / fromGuard 5 · attack 13 ("Kum Topu":
//   the glass hefted to the hip as a cannon, stopper flicked, jet) · roar 10 ("Kıkır": the glass spun like a top) ·
//   hit 6 · hitHeavy 8 ("Şapka gözüne") · hitMagic 8 ("Zaman donar": the sand freezes, then drops in a lump) · summon
//   14 ("Dökülüş": poured into a cone, sculpted top-down, the glass caught and planted) · death 10 ("Kendi kum saatine
//   akar") · revive 12 (the death backwards, a sneeze) · special 12 ("Kum Mührü": the eye-level aim through the
//   bulb, the overhead flip, the pour) · victory 10 (the glass balanced upside down on one fingertip).
// Every one-shot but death / victory ends on idle f0 (HA-14).

import type { AnimSpec, AnyMonsterAnim, MonsterAnim, MonsterAnimExtra, MonsterPoints } from '../types';
import { GLASS0, type GlassPose } from './hourglass_imp-glass';
import { AX, GY, NEUTRAL, rigPoints, skeleton, type Pose } from './hourglass_imp-rig';

const rnd = Math.round;
const spec = (frames: number, fps: number, loop: boolean, holds: number[], marks?: AnimSpec['marks']): AnimSpec => ({ frames, fps, loop, holds, ...(marks ? { marks } : {}) });

type K = Partial<Omit<Pose, 'g'>> & { g?: Partial<GlassPose> };
const mk = (base: Pose, d: K): Pose => ({ ...base, ...d, g: { ...base.g, ...(d.g ?? {}) } });

/** The glass's centre → its base pivot (for a held glass placed by its middle). */
function at(a: number, cx: number, cy: number, extra: Partial<GlassPose> = {}): Partial<GlassPose> {
  const r = (a * Math.PI) / 180;
  return { a, ox: cx - 13.5 * Math.sin(r), oy: cy + 13.5 * Math.cos(r), ...extra };
}
/** Tipping about one bottom corner of the upright glass (side −1 left corner, +1 right corner). */
function tip(a: number, side: -1 | 1, extra: Partial<GlassPose> = {}): Partial<GlassPose> {
  const r = (a * Math.PI) / 180;
  const cx = side > 0 ? 45 : 29;
  const vx = -side * 8;
  return { a, ox: cx + vx * Math.cos(r), oy: 61 + vx * Math.sin(r), ...extra };
}

// ------------------------------------------------------------------ idle (16 frames)

const IDLE_N = 16;
// Every transition moves ONE big thing (HA-17 / HA-18): a breath (the chest, then the head a frame later) alternates
// with a rock toward the glass (the body leans in, then the head catches up); the hat tip lags two frames behind
// whatever moved; the blink, the ear twitch and the double tap on the glass ride on top.
const I = {
  cy: [0, -1, -1, 0, 0, 0, 0, 0, 0, -1, -1, 0, 0, 0, 0, 0],
  hA: [0, 0, -1, -1, 0, 0, 0, 0, 0, 0, -1, -1, 0, 0, 0, 0],
  lean: [0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 0],
  hx: [0, 0, 0, 0, 0, -1, 0, 1, 0, 0, 0, 0, 0, -1, 0, 1],
  tx: [0, 1, 1, 1, 1, 1, 1, 0, 0, -1, -1, 0, 0, 0, 0, 0],
  ty: [0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0],
  eye: [0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  ear: [0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0],
  nhy: [50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 48, 50, 50],
  hot: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0],
  glint: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  fhy: [53, 53, 52, 52, 53, 53, 53, 53, 53, 53, 52, 52, 53, 53, 53, 51],
};
export function idlePose(f: number): Pose {
  const k = ((f % IDLE_N) + IDLE_N) % IDLE_N;
  return mk(NEUTRAL, {
    cy: I.cy[k], hy: I.hA[k] - I.cy[k], bx: I.lean[k], hx: I.hx[k], tx: I.tx[k], ty: I.ty[k], eye: I.eye[k], ear: I.ear[k], nhy: I.nhy[k], glint: I.glint[k], fhy: I.fhy[k],
    ngrip: I.nhy[k] < 50 ? 2 : 0,
    g: { ph: k, hot: I.hot[k] },
  });
}
const IDLE0 = idlePose(0);
const IDLE_HOLDS = [110, 90, 120, 100, 110, 90, 120, 100, 90, 110, 120, 90, 80, 100, 90, 110];

// ------------------------------------------------------------------ guard (6 frames loop): "Camın ardı"

// Round 1 #13: he takes cover BEHIND the glass (the body 5 px over, the glass overlapping the coat), only the hat cone
// and the gold eyes over the post, both hands clamped round it.
const G: K = { crouch: 3, bx: 5, lean: 1, nhx: 31, nhy: 46, ngrip: 1, fhx: 30, fhy: 50, fgrip: 1, gFront: 1, mouth: 3, ear: 3, tx: -1 };
const GUARD_N = 6;
// the peek: he leans OUT past the post (forward, not up) to check the foe, then ducks back behind the glass
const GQ = { hy: [0, 0, -1, -1, 0, 0], hx: [0, 0, 1, 1, 0, 0], tx: [-1, -1, -2, -2, -1, -1], eye: [0, 0, 3, 3, 0, 0] };
export function guardPose(f: number): Pose {
  const k = ((f % GUARD_N) + GUARD_N) % GUARD_N;
  return mk(IDLE0, { ...G, hy: GQ.hy[k], hx: GQ.hx[k], tx: GQ.tx[k], eye: GQ.eye[k], g: { ph: k, per: 6 } });
}
const GUARD0 = guardPose(0);
const GUARD_HOLDS = [180, 150, 160, 190, 150, 120];

// ------------------------------------------------------------------ toGuard / fromGuard (5 frames each)

const TG: K[] = [
  { crouch: 1, lean: 1, tx: 1, nhy: 49, g: { ph: 1 } },
  { crouch: 2, bx: 2, lean: 1, tx: 2, ty: 1, ear: 3, nhx: 31, nhy: 48, ngrip: 1, g: { ph: 2 } },
  { crouch: 3, bx: 4, lean: 1, tx: 0, ear: 3, nhx: 31, nhy: 47, ngrip: 1, fhx: 27, fhy: 51, mouth: 3, gFront: 1, g: { ph: 3 } },
  { ...G, tx: -2, g: { ph: 4 } },
];
const toGuardPose = (f: number): Pose => (f >= TG.length ? GUARD0 : mk(IDLE0, TG[f]));
const TG_HOLDS = [60, 70, 80, 70, 80];

const FG: K[] = [
  { ...G, tx: 0, ear: 1, eye: 3, g: { ph: 1 } },
  { crouch: 2, bx: 3, lean: 1, tx: 2, ty: 1, ear: 1, nhx: 31, nhy: 48, ngrip: 1, gFront: 1, g: { ph: 2 } },
  { crouch: 1, bx: 1, lean: 1, tx: 1, nhy: 49, g: { ph: 3 } },
  { cy: -1, tx: -1, g: { ph: 4 } },
];
const fromGuardPose = (f: number): Pose => (f >= FG.length ? IDLE0 : mk(IDLE0, FG[f]));
const FG_HOLDS = [70, 70, 80, 70, 80];

// ------------------------------------------------------------------ attack (13 frames): "Kum Topu"

// Round 1 #1/#2: the cannon is held FORWARD at chest height (the glass spans x ≈ 27–55, his face and coat stay clear
// of it), the far hand pinned to its back cap; the whole body acts: brace + lean back (f1–f3, the back foot steps
// back 2 px), the deepest load with the head tucked to the cap and the hat tip lagging forward (f4–f5), a 2-px recoil
// with a head bob and the hat tip whipping back (f6), a 1-px shake (f7–f8), then a settle with the tassel overshooting.
const CX = 40;
const CY = 48;
const A: K[] = [
  { tx: 1, eye: 3, g: { ph: 1 } }, // looks at the target, the hat tip snaps forward
  { crouch: 1, lean: -1, ffx: -1, nhx: 32, nhy: 46, ngrip: 1, pinF: 1, tx: 1, mouth: 4, g: { ...tip(20, 1), flow: 0 } }, // charge: heave
  { crouch: 2, bx: -1, lean: -1, nfx: 1, ffx: -2, nhx: 31, nhy: 50, ngrip: 1, pinF: 1, tx: 0, ty: 1, mouth: 4, g: { ...at(45, CX - 3, CY - 2), flow: 0 } },
  { crouch: 2, bx: -1, lean: -2, nfx: 1, ffx: -2, nhx: 31, nhy: 53, ngrip: 1, pinF: 1, tx: -1, ty: 1, mouth: 4, g: { ...at(70, CX - 1, CY - 1), flow: 0 } },
  { crouch: 3, bx: -1, lean: -1, hx: 1, hy: 1, nfx: 2, ffx: -2, nhx: 31, nhy: 54, ngrip: 1, pinF: 1, tx: 2, ty: 1, eye: 4, mouth: 4, g: { ...at(90, CX, CY), flow: 0 } }, // aim (longest): the deepest load
  { crouch: 3, bx: -1, lean: -1, hx: 1, hy: 1, nfx: 2, ffx: -2, nhx: 31, nhy: 54, ngrip: 1, pinF: 1, tx: 3, eye: 4, mouth: 1, g: { ...at(90, CX, CY), flow: 0, open: 1, hot: 1 } }, // the stopper pops
  { crouch: 2, bx: -3, lean: -2, hy: -1, nfx: 2, ffx: -3, nhx: 29, nhy: 54, ngrip: 1, pinF: 1, tx: -3, ty: -1, eye: 2, mouth: 2, g: { ...at(90, CX - 2, CY - 1), flow: 0, open: 1, jet: 6 } }, // release: recoil, head bob, hat whips back
  { crouch: 2, bx: -2, lean: -2, nfx: 2, ffx: -3, nhx: 30, nhy: 54, ngrip: 1, pinF: 1, tx: -2, ty: 1, eye: 2, mouth: 2, g: { ...at(90, CX - 1, CY), flow: 0, open: 1, jet: 11, sB: 0.45 } }, // contact (shake)
  { crouch: 2, bx: -3, lean: -1, nfx: 2, ffx: -3, nhx: 29, nhy: 54, ngrip: 1, pinF: 1, tx: -1, eye: 0, mouth: 1, g: { ...at(90, CX - 2, CY), flow: 0, open: 1, jet: 5, sB: 0.38 } },
  { crouch: 1, bx: -1, nfx: 1, ffx: -2, nhx: 31, nhy: 53, ngrip: 1, pinF: 1, tx: 2, ty: 1, mouth: 0, g: { ...at(70, CX - 1, CY - 1), flow: 0, sB: 0.38 } }, // recover: re-corked
  { crouch: 1, nfx: 1, ffx: -1, nhx: 31, nhy: 50, ngrip: 1, pinF: 1, tx: 3, ty: -1, g: { ...at(45, CX - 3, CY - 2), flow: 0, sB: 0.5 } }, // tassel overshoot
  { nhx: 31, nhy: 48, ngrip: 0, tx: -2, ty: 1, g: { ...tip(8, 1), sB: 0.55, ph: 2 }, puff: 1 }, // thunk
];
/**
 * Blocked (Round 1 #8): the comic backlash, drawn by the strike cinematic on its own layer (no sprite frames: the
 * frame budget is spent on the death / special / summon in-betweens). The splash knocks the cannon out of his grip
 * nose-up, it tumbles, he lunges with both arms and his eyes squeezed shut, catches it against his chest and settles
 * sheepishly (ears drooped); the sprite then takes over on the attack's thunk frame (BLOCKED_RESUME).
 */
export const BLOCKED_CATCH: { pose: Pose; ms: number }[] = ([
  [{ crouch: 2, bx: -3, lean: -2, hy: -1, nfx: 2, ffx: -3, nhx: 33, nhy: 45, ngrip: 0, fhx: 27, fhy: 44, fgrip: 0, tx: -4, ty: -1, eye: 3, mouth: 2, ear: 2, g: { ...at(65, CX - 2, CY - 5), flow: 0, sB: 0.4 } }, 80],
  [{ crouch: 1, bx: 1, lean: 2, nfx: 3, ffx: -1, nhx: 36, nhy: 41, ngrip: 0, fhx: 33, fhy: 43, fgrip: 0, tx: -2, ty: 1, eye: 2, mouth: 4, ear: 2, g: { ...at(40, CX - 2, CY - 9), flow: 0, sB: 0.45 } }, 90],
  [{ crouch: 2, bx: 1, lean: 2, nfx: 2, pinN: 1, ngrip: 1, pinF: 1, fgrip: 1, tx: 3, ty: 1, eye: 2, mouth: 4, ear: 1, puff: 1, g: { ...at(20, 37, 47), flow: 0, sB: 0.5 } }, 110],
  [{ crouch: 1, hy: 1, pinN: 1, ngrip: 1, tx: -1, ty: 1, eye: 1, mouth: 3, ear: 3, g: { ...tip(8, 1), sB: 0.55, ph: 2 } }, 170],
] as [K, number][]).map(([k, ms]) => ({ pose: mk(IDLE0, k), ms }));
export const BLOCKED_RESUME = 11;
const attackPose = (f: number): Pose => (f >= A.length ? IDLE0 : mk(IDLE0, A[f]));
const ATTACK_HOLDS = [70, 90, 90, 100, 180, 110, 60, 70, 80, 100, 110, 120, 130];

// ------------------------------------------------------------------ roar (10 frames): "Kıkır" — the glass spun like a top

const R: K[] = [
  { nhx: 31, nhy: 44, ngrip: 1, mouth: 1, g: { ph: 1 } },
  { nhx: 31, nhy: 42, ngrip: 1, eye: 1, mouth: 1, cy: -1, crouch: 1, lean: -1, tx: 1, g: { sx: 0.6, ph: 2 } }, // charge: the twist (wound up)
  { nhx: 30, nhy: 46, ngrip: 0, eye: 1, mouth: 2, cy: -1, bx: 1, lean: 1, tx: 2, ty: -1, g: { sx: -0.55, ph: 4 } }, // release: spinning, the giggle
  { nhx: 30, nhy: 45, ngrip: 0, eye: 1, mouth: 1, cy: 0, bx: -1, tx: 1, ty: 1, g: { sx: -1, ph: 5 } },
  { nhx: 30, nhy: 46, ngrip: 0, eye: 1, mouth: 2, cy: -1, bx: 1, lean: 1, tx: -1, ty: -1, g: { sx: 0.25, ph: 6 } },
  { nhx: 32, nhy: 47, ngrip: 0, eye: 3, mouth: 2, cy: 0, crouch: 1, lean: 1, tx: -2, g: { sx: 1, slosh: 1, ph: 7 } }, // recover: slapped still
  { eye: 0, mouth: 1, tx: 1, ty: 1, g: { slosh: -1, ph: 9 } },
];
const roarPose = (f: number): Pose => (f >= R.length ? IDLE0 : mk(IDLE0, R[f]));
const ROAR_HOLDS = [80, 130, 70, 70, 80, 110, 130, 140];

// ------------------------------------------------------------------ hit (6 frames)

// Round 1 #11: the glass stays planted (HA-21) but the imp takes the blow: a 2-px squash + lean back, a head snap,
// the hat tip whipping 3–4 px.
const HT: K[] = [
  { crouch: 1, lean: -1, hx: -1, eye: 2, mouth: 4, tx: 4, ty: -1, ngrip: 1, g: { ph: 1 } },
  { crouch: 2, bx: -1, lean: -2, hy: -1, eye: 2, mouth: 4, tx: 3, ty: -2, ngrip: 1, g: { ph: 2, flow: 3 } },
  { crouch: 1, bx: -1, lean: -1, eye: 2, mouth: 3, tx: 1, ngrip: 1, g: { ph: 3 } },
  { eye: 0, mouth: 3, tx: -2, ty: 1, g: { ph: 4 } }, // recover
  { tx: 1, g: { ph: 5 } },
];
const hitPose = (f: number): Pose => (f >= HT.length ? IDLE0 : mk(IDLE0, HT[f]));
const HIT_HOLDS = [50, 60, 140, 90, 100, 110];

// ------------------------------------------------------------------ hitHeavy (8 frames): "Şapka gözüne"

const HH: K[] = [
  { crouch: 1, lean: -1, hx: -1, eye: 2, mouth: 4, tx: 4, ty: -1, ngrip: 1, grains: 1, g: { ph: 1 } },
  { bx: -3, lean: -1, hat: 1, eye: 5, mouth: 2, tx: 3, nhx: 28, nhy: 44, ngrip: 0, fhx: 13, fhy: 49, fgrip: 0, nfx: -1, grains: 2, g: { ph: 2 } },
  { bx: -3, hat: 1, eye: 5, mouth: 2, tx: 1, nhx: 31, nhy: 45, ngrip: 0, fhx: 13, fhy: 50, fgrip: 0, nfx: -1, g: { ...tip(8, 1), ph: 3 } },
  { bx: -2, lean: 1, hat: 1, eye: 5, mouth: 3, tx: -1, nhx: 33, nhy: 45, ngrip: 0, g: { ...tip(20, 1), ph: 4 } }, // gropes blindly
  { bx: -1, lean: 1, hat: 1, eye: 5, mouth: 3, nhx: 32, nhy: 47, ngrip: 1, g: { ...tip(5, 1), ph: 5 } }, // recover: caught
  { hat: 1, eye: 5, mouth: 0, nhx: 27, nhy: 39, ngrip: 2, g: { ph: 6 } }, // pushes the hat up with a finger
  { hat: 0, eye: 0, mouth: 0, nhx: 27, nhy: 41, ngrip: 2, ty: 1, g: { ph: 7 } },
];
const hitHeavyPose = (f: number): Pose => (f >= HH.length ? IDLE0 : mk(IDLE0, HH[f]));
const HH_HOLDS = [50, 60, 80, 80, 90, 100, 110, 120];

// ------------------------------------------------------------------ hitMagic (8 frames): "Zaman donar"

const HM: K[] = [
  { by: -1, ear: 2, eye: 3, mouth: 2, spark: 1, tx: 0, ty: -2, g: { ph: 0, flow: 2 } },
  { by: -1, ear: 2, eye: 3, mouth: 2, spark: 2, tx: 0, ty: -2, g: { ph: 0, flow: 2 } },
  { by: -1, ear: 2, eye: 3, mouth: 2, spark: 1, tx: 0, ty: -2, g: { ph: 0, flow: 2 } },
  { by: -1, ear: 2, eye: 3, mouth: 3, tx: 0, ty: -2, g: { ph: 0, flow: 2 } },
  { ear: 2, eye: 3, mouth: 2, g: { flow: 0, lump: 1 } }, // recover: the frozen sand drops in a lump
  { crouch: 1, ear: 1, eye: 2, mouth: 3, hx: -1, tx: 2, g: { flow: 0, lump: 5 } },
  { hx: 1, tx: -2, ty: 1, eye: 1, g: { ph: 1 } }, // head shake, the trickle resumes
];
const hitMagicPose = (f: number): Pose => (f >= HM.length ? IDLE0 : mk(IDLE0, HM[f]));
const HM_HOLDS = [50, 60, 80, 70, 90, 100, 110, 120];

// ------------------------------------------------------------------ summon (14 frames, land @ 9): "Dökülüş"

const POUR: K = { body: 0, gShow: 0, pour: 1 };
// Round 1 #6: the sculpt is no longer a one-frame pop — the hat tip breaks the cone's crest (f6), the cone's shoulders
// bulge into a head and arms (f7), then the sand bands slide down off him (f8–f10).
const SU: K[] = [
  { ...POUR, cone: 4, g: { ph: 0 } },
  { ...POUR, cone: 8, g: { ph: 1 } },
  { ...POUR, cone: 13, g: { ph: 2 } },
  { ...POUR, cone: 18, g: { ph: 3 } },
  { ...POUR, cone: 24, g: { ph: 4 } },
  { ...POUR, cone: 31, g: { ph: 5 } },
  { body: 1, gShow: 0, pour: 1, cone: 30, sandTop: 37, sandBot: 99, eye: 1, tx: -1, nhx: 27, nhy: 54, ngrip: 1, g: { ph: 6 } }, // the hat tip breaks the crest
  { body: 1, gShow: 0, pour: 24, cone: 19, heap: 6, sandTop: 36, sandBot: 99, eye: 1, tx: 1, ty: 1, nhx: 28, nhy: 53, ngrip: 1, fhx: 14, fhy: 54, g: { ph: 7 } }, // shoulders bulge into head and arms
  { body: 1, gShow: 0, pour: 2, sandTop: 41, sandBot: 99, heap: 5, eye: 1, tx: -1, ty: 1, nhx: 27, nhy: 53, ngrip: 1, g: { ph: 8 } }, // the sand slides off: the face
  { body: 1, gShow: 0, sandTop: 48, sandBot: 99, heap: 4, eye: 3, mouth: 2, nhx: 28, nhy: 50, ngrip: 0, g: { ph: 9 } }, // eyes open
  { body: 1, gShow: 0, sandTop: 55, sandBot: 99, heap: 2, eye: 3, mouth: 2, nhx: 29, nhy: 40, ngrip: 0, fhx: 24, fhy: 41, fgrip: 0, cy: -1, g: { ph: 10 } }, // arms up
  { gShow: 1, eye: 3, mouth: 1, nhx: 30, nhy: 39, ngrip: 1, fhx: 25, fhy: 40, fgrip: 1, cy: -1, lean: 1, tx: 2, g: { ...at(135, 37, 29), flow: 1, ph: 11 } }, // LAND: caught
  { eye: 0, mouth: 1, nhx: 31, nhy: 43, ngrip: 1, fhx: 25, fhy: 45, lean: 1, tx: 1, ty: 1, g: { ...at(45, 34, 41), ph: 12 } }, // the twirl
  { mouth: 1, nhx: 31, nhy: 49, ngrip: 0, tx: -1, ty: 1, puff: 2, g: { ph: 13 } }, // planted
  { lean: 1, hx: 1, eye: 1, mouth: 1, ear: 1, tx: -1, g: { ph: 14 } }, // cheek to the glass, grin
];
const summonPose = (f: number): Pose => (f >= SU.length ? IDLE0 : mk(IDLE0, SU[f]));
const SU_HOLDS = [90, 80, 80, 80, 80, 80, 70, 70, 70, 70, 60, 70, 80, 90, 110, 130];

// ------------------------------------------------------------------ death (10 frames, dissolve @ 4)

// Round 1 #3: the pour is in-betweened — the dry sand body slumps and is eaten top-down (cut) while a thick ribbon
// curls into the top cap and the upper bulb rises a step a frame; the hat stays dry sand and falls in an arc (head →
// apex → cap), re-coloured only when it lands; the full glass rocks 1 px top-heavy, then topples 20 / 45 / 70 / 90°
// with a 1-px bounce on landing.
const DRY: K = { crouch: 4, lean: 2, eye: 1, mouth: 3, nhx: 31, nhy: 49, ngrip: 1, fhx: 29, fhy: 52, tx: 3, ty: 2, sandTop: 0, sandBot: 99 };
const D: K[] = [
  { crouch: 1, lean: -1, eye: 2, mouth: 4, tx: 3, ngrip: 1 },
  { crouch: 2, lean: 1, eye: 2, mouth: 2, hat: 2, nhx: 31, nhy: 48, ngrip: 1, fhx: 29, fhy: 51, tx: 2, ty: 1 },
  { crouch: 3, lean: 2, eye: 1, mouth: 3, hat: 2, nhx: 31, nhy: 49, ngrip: 1, fhx: 29, fhy: 52, tx: 3, ty: 2 },
  { crouch: 3, lean: 2, eye: 1, mouth: 3, hat: 2, nhx: 31, nhy: 49, ngrip: 1, fhx: 29, fhy: 52, tx: 3, ty: 2, sandTop: 0, sandBot: 44 }, // dries top-down
  { ...DRY, hat: 2, ribbon: 1, g: { sB: 0.66, flow: 0, hot: 1 } }, // DISSOLVE: the pour begins
  { ...DRY, cut: 40, heap: 3, ribbon: 2, hat: 3, hatDry: 1, hax: 27, hay: 31, hang: -18, g: { sB: 0.74, flow: 0, hot: 1 } }, // the head is gone, the hat flies
  { ...DRY, cut: 49, heap: 5, ribbon: 2, hat: 3, hatDry: 1, hax: 33, hay: 26, hang: -8, g: { sB: 0.82, flow: 0, hot: 1 } },
  { body: 0, heap: 5, ribbon: 3, hat: 3, hax: 37, hay: 31, hang: 0, g: { sB: 0.9, flow: 0, hot: 1 } }, // the hat lands on the cap
  { body: 0, hat: 3, hax: 38, hay: 31, hang: 4, g: { sB: 1, flow: 0, ox: 38 } }, // full: it rocks 1 px, top-heavy
  { body: 0, hat: 3, hax: 37, hay: 34, hang: 18, g: { ...tip(-20, -1), sB: 1, flow: 0 } }, // the topple
  { body: 0, hat: 3, hax: 44, hay: 43, hang: 50, g: { ...tip(-45, -1), ox: tip(-45, -1).ox! + 2, sB: 1, flow: 0 } },
  { body: 0, hat: 3, hax: 47, hay: 51, hang: 80, g: { ...tip(-70, -1), ox: tip(-70, -1).ox! + 4, sB: 1, flow: 0 } },
  { body: 0, hat: 3, hax: 45, hay: 55, hang: 95, g: { a: -90, ox: 34, oy: 52, sB: 1, flow: 0 } }, // lands, bounces 1 px
  { body: 0, hat: 3, hax: 45, hay: 57, hang: 95, tx: 1, g: { a: -90, ox: 34, oy: 53, sB: 1, flow: 0, crack: 1 } },
];
export const DEATH_TOPPLE = 9;
const LYING = D[D.length - 1];
const deathPose = (f: number): Pose => mk(IDLE0, D[Math.min(f, D.length - 1)]);
const D_HOLDS = [50, 60, 70, 60, 60, 60, 60, 70, 80, 60, 45, 45, 45, 80];

// ------------------------------------------------------------------ revive (12 frames, land @ 8): the death backwards

const RV: K[] = [
  { ...LYING },
  { body: 0, hat: 3, hax: 50, hay: 52, hang: 60, g: { ...tip(-60, -1), sB: 1, flow: 0 } },
  { body: 0, hat: 3, hax: 50, hay: 46, hang: 35, g: { ...tip(-22, -1), sB: 1, flow: 0 } },
  { body: 0, hat: 3, hax: 41, hay: 30, hang: 8, g: { sB: 1, sA: 0.15, hot: 1, ph: 4 } }, // upright, full up top; the hat hops back up
  { crouch: 4, lean: 2, eye: 1, mouth: 3, hat: 3, hax: 37, hay: 31, hang: 0, nhx: 31, nhy: 49, ngrip: 1, fhx: 29, fhy: 52, sandTop: 0, sandBot: 99, ribbon: 3, g: { sB: 0.9, sA: 0.2, hot: 1, ph: 5 } },
  { crouch: 2, lean: 1, eye: 1, mouth: 3, hat: 3, hax: 28, hay: 30, hang: -20, nhx: 31, nhy: 49, ngrip: 1, sandTop: 0, sandBot: 99, ribbon: 2, g: { sB: 0.78, sA: 0.3, ph: 6 } }, // the hat jumps
  { crouch: 1, eye: 3, mouth: 2, sandTop: 47, sandBot: 99, tx: 2, ty: -1, g: { sB: 0.68, sA: 0.36, ph: 7 } },
  { eye: 3, mouth: 2, tx: 1, puff: 1, g: { sB: 0.62, ph: 8 } }, // LAND
  { eye: 1, mouth: 2, hy: 1, sneeze: 1, tx: -1, g: { ph: 9 } },
  { eye: 1, mouth: 0, hy: -1, sneeze: 2, tx: 1, ty: 1, g: { ph: 10 } },
];
const revivePose = (f: number): Pose => (f >= RV.length ? IDLE0 : mk(IDLE0, RV[f]));
const RV_HOLDS = [130, 90, 80, 80, 90, 90, 80, 70, 90, 110, 130];

// ------------------------------------------------------------------ special (12 frames): "Kum Mührü"

// Round 1 #4/#12: the aim holds the glass up so its LOWER bulb is in front of his eye (the gold eye shines through
// the glass); the flip stays at chest / head height IN FRONT of him (never up in a back-row neighbour's plate band),
// 20 → 45 → 90 → 135 → 180°, both hands pinned to the glass every frame; he rises onto his toes and leans back under
// its weight, the far arm swinging out for balance at the top of the turn.
const AIM: K = { lean: 2, eye: 4, mouth: 3, pinN: 1, ngrip: 1, pinF: 1, fgrip: 1, tx: -1, g: { a: 0, ox: 31, oy: 49, ph: 1 } };
const UP: K = { by: -1, cy: -1, hat: 2, pinN: 1, ngrip: 1 };
const SP: K[] = [
  { nhy: 49, ngrip: 1, eye: 3, g: { ph: 1 } },
  { ...AIM }, // charge: held up at eye level, he squints THROUGH the lower bulb (the aim hold)
  { ...UP, lean: 0, eye: 3, mouth: 2, pinF: 1, tx: -2, g: { ...at(20, 35, 34), ph: 2 } },
  { ...UP, lean: -1, eye: 3, mouth: 2, fhx: 11, fhy: 46, fgrip: 0, nfl: 1, ffl: 1, tx: -3, ty: 1, g: { ...at(45, 38, 34), ph: 3 } },
  { ...UP, lean: -1, eye: 3, mouth: 2, fhx: 10, fhy: 44, fgrip: 0, nfl: 1, ffl: 1, tx: -3, g: { ...at(90, 39, 34), ph: 3 } },
  { ...UP, lean: -1, eye: 3, mouth: 1, fhx: 11, fhy: 45, fgrip: 0, nfl: 1, ffl: 1, tx: -2, ty: 1, g: { ...at(135, 38, 34), ph: 4 } },
  { ...UP, lean: 0, eye: 3, mouth: 1, pinF: 1, tx: -1, g: { ...at(180, 36, 34), ph: 4 } },
  { ...UP, lean: 0, eye: 0, mouth: 1, pinF: 1, tx: 0, g: { ...at(180, 36, 34), ph: 5, hot: 1, sA: 0.32, sB: 0.7 } }, // release
  { ...UP, lean: 0, eye: 0, mouth: 1, pinF: 1, tx: 1, g: { ...at(180, 36, 34), ph: 6, hot: 1, sA: 0.18, sB: 0.84 } }, // contact: the pour
  { cy: 0, eye: 0, mouth: 1, hat: 2, pinN: 1, ngrip: 1, pinF: 1, tx: 1, g: { ...at(150, 38, 36), ph: 7, sA: 0.14, sB: 0.86 } },
  { eye: 0, mouth: 0, pinN: 1, ngrip: 1, fhx: 25, fhy: 45, tx: 1, g: { ...at(45, 34, 41), ph: 8, sA: 0.3, sB: 0.7 } }, // recover
  { mouth: 0, nhx: 31, nhy: 49, tx: -1, ty: 1, puff: 1, g: { sA: 0.38, sB: 0.64, ph: 9 } }, // thunk
  { mouth: 1, nhx: 27, nhy: 46, ngrip: 0, fhx: 25, fhy: 47, fgrip: 0, grains: 1, g: { ph: 10 } }, // dusts off his hands
];
const specialPose = (f: number): Pose => (f >= SP.length ? IDLE0 : mk(IDLE0, SP[f]));
export const SPECIAL_THUNK = 11;
const SP_HOLDS = [70, 160, 80, 60, 60, 60, 70, 60, 140, 110, 100, 110, 120, 130];

// ------------------------------------------------------------------ victory (10 frames): balanced on one fingertip

const V: K[] = [
  { nhx: 31, nhy: 47, ngrip: 1, mouth: 1, g: { ph: 1 } },
  { cy: -1, pinN: 1, ngrip: 1, pinF: 1, mouth: 1, hat: 2, g: { ...at(40, 35, 39), ph: 2 } },
  { cy: -1, by: -1, pinN: 1, ngrip: 1, pinF: 1, mouth: 2, hat: 2, eye: 3, g: { ...at(120, 37, 32), ph: 3 } },
  // balanced on one fingertip: the body sways under it (bx / lean), the far arm out for balance
  { cy: -1, lean: 1, nhx: 32, nhy: 39, ngrip: 2, fhx: 12, fhy: 46, fgrip: 0, mouth: 1, hat: 2, eye: 3, tx: -1, g: { ...at(180, 32, 22), ph: 4 } },
  { cy: -1, bx: -1, lean: 0, nhx: 31, nhy: 39, ngrip: 2, fhx: 11, fhy: 44, fgrip: 0, mouth: 1, hat: 2, eye: 0, tx: 1, g: { ...at(180, 31, 22), ph: 5 } },
  { cy: -1, bx: 1, lean: 2, nhx: 33, nhy: 39, ngrip: 2, fhx: 13, fhy: 47, fgrip: 0, mouth: 1, hat: 2, eye: 0, tx: -2, g: { ...at(180, 33, 22), ph: 6 } },
  { cy: -1, lean: 1, nhx: 32, nhy: 39, ngrip: 2, fhx: 12, fhy: 46, fgrip: 0, mouth: 2, hat: 2, eye: 3, tx: 0, g: { ...at(180, 32, 22), ph: 7 } },
  { cy: -1, nhx: 30, nhy: 40, ngrip: 0, fhx: 26, fhy: 41, fgrip: 0, mouth: 2, hat: 2, eye: 3, g: { ...at(90, 39, 26), ph: 8 } }, // tossed
  { lean: 1, hx: 1, eye: 1, mouth: 1, ear: 1, nhx: 31, nhy: 49, puff: 1, tx: -1, g: { ph: 9 } }, // caught, hugged
  { lean: 1, hx: 1, eye: 4, mouth: 1, ear: 1, glint: 1, nhx: 31, nhy: 49, tx: -2, ty: 1, g: { ph: 10 } }, // the wink, held
];
const victoryPose = (f: number): Pose => mk(IDLE0, V[Math.min(f, V.length - 1)]);
const V_HOLDS = [90, 110, 100, 130, 120, 120, 110, 100, 120, 600];

// ------------------------------------------------------------------ specs

export const IMPACT = 6;
export const ANIMS: Record<MonsterAnim, AnimSpec> = {
  idle: spec(IDLE_N, 8, true, IDLE_HOLDS),
  guard: spec(GUARD_N, 6, true, GUARD_HOLDS),
  roar: spec(8, 10, false, ROAR_HOLDS, { charge: 1, release: 2, impact: 2, recover: 5 }),
  attack: spec(13, 10, false, ATTACK_HOLDS, { charge: 1, release: IMPACT, impact: IMPACT, contact: 7, recover: 9 }),
  hit: spec(6, 12, false, HIT_HOLDS, { impact: 0, contact: 0, recover: 3 }),
};
export const EXTRA_ANIMS: Partial<Record<MonsterAnimExtra, AnimSpec>> = {
  summon: spec(16, 10, false, SU_HOLDS, { land: 11 }),
  death: spec(14, 12, false, D_HOLDS, { impact: 0, contact: 0, dissolve: 4 }),
  revive: spec(11, 10, false, RV_HOLDS, { land: 7 }),
  special: spec(14, 10, false, SP_HOLDS, { charge: 1, release: 7, impact: 7, contact: 8, recover: 10 }),
  hitHeavy: spec(8, 12, false, HH_HOLDS, { impact: 0, contact: 0, recover: 4 }),
  hitMagic: spec(8, 12, false, HM_HOLDS, { impact: 0, contact: 0, recover: 4 }),
  victory: spec(10, 10, false, V_HOLDS),
  toGuard: spec(5, 16, false, TG_HOLDS),
  fromGuard: spec(5, 16, false, FG_HOLDS),
};

const CACHE = new Map<string, Pose>();
export function framePose(anim: AnyMonsterAnim, f: number): Pose {
  const id = `${anim}:${f}`;
  let p = CACHE.get(id);
  if (!p) {
    switch (anim) {
      case 'idle': p = idlePose(f); break;
      case 'guard': p = guardPose(f); break;
      case 'attack': p = attackPose(f); break;
      case 'roar': p = roarPose(f); break;
      case 'hit': p = hitPose(f); break;
      case 'hitHeavy': p = hitHeavyPose(f); break;
      case 'hitMagic': p = hitMagicPose(f); break;
      case 'toGuard': p = toGuardPose(f); break;
      case 'fromGuard': p = fromGuardPose(f); break;
      case 'summon': p = summonPose(f); break;
      case 'revive': p = revivePose(f); break;
      case 'death': p = deathPose(f); break;
      case 'special': p = specialPose(f); break;
      case 'victory': p = victoryPose(f); break;
      default: p = IDLE0;
    }
    CACHE.set(id, p);
  }
  return p;
}

const clampPt = (x: number, y: number) => ({ x: Math.max(2, Math.min(57, rnd(x))), y: Math.min(GY, Math.max(2, rnd(y))) });

/** muzzle = the glass's stopper hole (the jet and the seal leave from the glass); core = the middle of the body (the
 *  glass's middle when he is gone); head = the face; hand / grip = the near / far hand. */
export function framePoints(anim: AnyMonsterAnim, f: number): MonsterPoints {
  const o = framePose(anim, f);
  const pt = rigPoints(o);
  const core = o.body ? pt.core : pt.neck;
  return {
    muzzle: clampPt(pt.muzzle[0], pt.muzzle[1]),
    core: clampPt(core[0], core[1]),
    head: clampPt(o.body ? pt.head[0] : pt.neck[0], o.body ? pt.head[1] : pt.neck[1]),
    hand: clampPt(pt.hand[0], pt.hand[1]),
    grip: clampPt(pt.grip[0], pt.grip[1]),
    feet: { x: AX, y: GY },
  };
}

export const MUZZLE = framePoints('attack', IMPACT).muzzle!;

/** Rig joints for the sameness tool. */
export function frameJoints(anim: AnyMonsterAnim, f: number): Record<string, { x: number; y: number }> {
  const o = framePose(anim, f);
  const sk = skeleton(o);
  const pt = rigPoints(o);
  const p = (q: readonly [number, number]) => ({ x: rnd(q[0]), y: rnd(q[1]) });
  return {
    head: p(sk.Hc), shoulderN: p(sk.Sn), shoulderF: p(sk.Sf), elbowN: p(sk.elN), elbowF: p(sk.elF), handN: p(sk.wN), handF: p(sk.wF),
    footN: p(sk.footN), footF: p(sk.footF), neck: p(pt.neck), muzzle: p(pt.muzzle),
  };
}

export { GLASS0 };
