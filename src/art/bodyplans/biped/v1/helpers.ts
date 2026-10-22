// biped v1 — the helper VOCABULARY (docs/v3/A3_MIMARI.md §3.3, §4.2): words, never sentences.
//
// Every word returns a pose DELTA (BipedDelta: nested fields partial) over whatever the member keys;
// none carries choreography. The loop words (breathe, weightShift) take period, phase and amplitude
// as REQUIRED arguments — there is no default, so two members can never share an idle by omission
// (§9 loop signature); a missing or non-finite value throws. The other words are geometric: a power
// or a px they are given, scaled by the build's own proportions (that is why the vocabulary is bound
// to a build: biped.helpers(build) — the §3.3 sketch had `helpers` as a build-free property, but the
// words that raise a hand need its arm's length).
//
// Glue (not part of the plan interface): plus() adds deltas (numbers add, tuples add per element,
// nested objects recurse, flags / names: the last one wins), loopTimes() gives a loop's frame start
// times from its holds, delayed() shifts a loop word in time (a follower 1–3 frames late, HA-6),
// handAt() turns a shoulder-relative hand place into the arm's hand offset.

import type { PlanHelpers } from '../../types';
import type { WeightClass } from '../../../types';
import type { RegionId } from '../../../rigkit/pose';
import type { V } from '../../../rigkit/geom';
import { restOf, type BipedBuild } from './build';
import type { BipedDelta, BipedPose } from './pose';
import { bipedPoseKnockPx } from './skeleton';

type Power = 1 | 2 | 3;
type Plain = Record<string, unknown>;
const isPlain = (v: unknown): v is Plain => typeof v === 'object' && v !== null && !Array.isArray(v);

function plusValue(a: unknown, b: unknown): unknown {
  if (b === undefined) return a;
  if (a === undefined) return b;
  if (typeof a === 'number' && typeof b === 'number') return a + b;
  if (Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x) => typeof x === 'number')) return a.map((x, i) => (x as number) + (b[i] as number));
  if (isPlain(a) && isPlain(b)) {
    const out: Plain = { ...a };
    for (const k of Object.keys(b)) out[k] = plusValue(a[k], b[k]);
    return out;
  }
  return b;
}

/** Sum of deltas: numbers add, number tuples add per element, nested objects recurse, the rest: last wins. */
export function plus(...ds: readonly BipedDelta[]): BipedDelta {
  return ds.reduce<BipedDelta>((acc, d) => plusValue(acc, d) as BipedDelta, {});
}

/** Start time (ms) of every frame of a loop with these holds, and the loop's total. */
export function loopTimes(holds: readonly number[]): { at: readonly number[]; total: number } {
  const at: number[] = [];
  let t = 0;
  for (const h of holds) {
    at.push(t);
    t += h;
  }
  return { at, total: t };
}

/**
 * The BipedArm.hand offset that puts a hand at `place` — px from its own shoulder (x forward, y down),
 * which is how a key pose is thought of ("the fist 4 px above the shoulder, 10 px ahead"). Pure
 * geometry of the build's rest hand; the arm still clamps if the place is out of reach.
 */
export function handAt(b: BipedBuild, side: 'N' | 'F', place: V): V {
  const rest = side === 'N' ? restOf(b).handN : restOf(b).handF;
  return [place[0] - rest[0], place[1] - rest[1]];
}

/** A loop word evaluated `ms` later in time (a follower that comes `ms` behind its leader). */
export function delayed<T>(word: (tMs: number) => T, ms: number): (tMs: number) => T {
  need('delayed', { ms });
  return (t) => word(t - ms);
}

function need(word: string, o: Record<string, unknown>): void {
  for (const [k, v] of Object.entries(o)) if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`biped.${word}: '${k}' is required (a finite number; got ${String(v)}) — loop words carry no default`);
}
function needPeriod(word: string, periodMs: number): void {
  if (!(periodMs > 0)) throw new Error(`biped.${word}: periodMs must be > 0 (got ${periodMs})`);
}
function needPower(word: string, p: number): asserts p is Power {
  if (p !== 1 && p !== 2 && p !== 3) throw new Error(`biped.${word}: power must be 1, 2 or 3 (got ${p})`);
}

const TAU = Math.PI * 2;

/** The vocabulary bound to one build. */
export function bipedHelpers(b: BipedBuild): PlanHelpers<BipedBuild, BipedPose> {
  const r = restOf(b);
  const L = r.armReach;
  /** a shoulder-relative hand place (kept within 0.96 of the arm's reach: a word never asks for a
   *  straight, clamped arm) → the arm's hand offset (BipedArm.hand) */
  const handTo = (side: 'N' | 'F', place: V): V => {
    const d = Math.hypot(place[0], place[1]);
    const k = d > 0.96 * L ? (0.96 * L) / d : 1;
    const rest = side === 'N' ? r.handN : r.handF;
    return [place[0] * k - rest[0], place[1] * k - rest[1]];
  };

  const struck = (region: RegionId, power: Power): BipedDelta => {
    needPower('struck', power);
    switch (region) {
      case 'head':
        return { head: { x: -power, y: power === 3 ? -1 : 0, a: -0.06 * power } };
      case 'chest':
        return { chestLean: -0.09 * power, twist: -0.1 * power };
      case 'armN':
        return { armN: { hand: [-1.5 * power, -power] } };
      case 'armF':
        return { armF: { hand: [-1.5 * power, -power] } };
      case 'hips':
        return { hip: { x: -power } };
      case 'propF':
        return b.farArm === 'shield' ? { props: { shield: { a: -0.05 * power } } } : {};
      default:
        return {}; // lower, tail, wings, extra: no geometric meaning on a biped (the member keys its own)
    }
  };

  return {
    breathe(o) {
      need('breathe', { periodMs: o?.periodMs, phase: o?.phase, amp: o?.amp });
      needPeriod('breathe', o.periodMs);
      return (t) => ({ breath: o.amp * 0.5 * (1 - Math.cos(TAU * (t / o.periodMs + o.phase))) });
    },
    weightShift(o) {
      need('weightShift', { periodMs: o?.periodMs, phase: o?.phase, px: o?.px });
      needPeriod('weightShift', o.periodMs);
      return (t) => ({ hip: { x: o.px * Math.sin(TAU * (t / o.periodMs + o.phase)) } });
    },
    plant(foot) {
      return foot === 'N' ? { footN: { step: [0, 0], lift: 0 } } : { footF: { step: [0, 0], lift: 0 } };
    },
    step(foot, dx) {
      need('step', { dx });
      return foot === 'N' ? { footN: { step: [dx, 0], lift: 0 } } : { footF: { step: [dx, 0], lift: 0 } };
    },
    struck,
    struckBack(power) {
      needPower('struckBack', power);
      return { chestLean: 0.09 * power, head: { x: power, a: 0.08 * power } };
    },
    struckAbove(power) {
      needPower('struckAbove', power);
      return { hip: { y: power }, head: { y: power, a: 0.1 * power } };
    },
    recoilPush(weight: WeightClass, power) {
      needPower('recoilPush', power);
      const k = bipedPoseKnockPx(b, weight)[power - 1];
      const f0 = plus(struck('chest', power), struck('head', power));
      const f1: BipedDelta = { hip: { x: -Math.ceil(k / 2) }, lean: -0.03 * power, chestLean: -0.06 * power, head: { x: -power, a: -0.05 * power, lag: 0.5 } };
      const f2: BipedDelta = { hip: { x: -k }, lean: -0.04 * power, chestLean: -0.03 * power, head: { x: -Math.ceil(power / 2), a: -0.03 * power, lag: 0.25 } };
      return [f0, f1, f2] as const;
    },
    guardTuck(o) {
      need('guardTuck', { dropPx: o?.dropPx });
      // hand places relative to their shoulders; "in front of the chest" = the chest centre (−the
      // shoulder's offset from it) + a forward share of the arm (forward is +x for the P1 art)
      const front = (s: V, fwd: number, down: number): V => [-s[0] + fwd * L, -s[1] + down * L];
      if (o.lead === 'shield')
        // the far hand brings its prop across the chest; the near arm tucks behind it
        return {
          hip: { y: o.dropPx },
          armF: { hand: handTo('F', front(r.shoulderF, 0.3, 0.45)) },
          armN: { hand: handTo('N', front(r.shoulderN, 0.25, 0.4)) },
          slots: { armN: 'armN.tuck' },
        };
      // both forearms raised in front of the chest
      return {
        hip: { y: o.dropPx },
        armN: { hand: handTo('N', front(r.shoulderN, 0.35, 0.2)) },
        armF: { hand: handTo('F', front(r.shoulderF, 0.45, 0.05)) },
      };
    },
    throwArc(o) {
      need('throwArc', { liftPx: o?.liftPx });
      const side = o.from === 'handN' ? 'N' : 'F';
      const key = side === 'N' ? 'armN' : 'armF';
      // the hand's path around its shoulder: wound back and low → up behind the head → over the
      // top → released forward and high → followed through forward and low (shoulder-relative)
      const path: readonly [V, BipedPose['armN']['grip']][] = [
        [[-0.35 * L, 0.6 * L], 'fist'],
        [[-0.35 * L, -0.55 * L - o.liftPx], 'fist'],
        [[0.1 * L, -0.85 * L - o.liftPx], 'fist'],
        [[0.75 * L, -0.35 * L], 'open'],
        [[0.7 * L, 0.45 * L], 'open'],
      ];
      return path.map(([p, grip]): BipedDelta => ({ [key]: { hand: handTo(side, p), grip } }));
    },
  };
}
