// Art Lab battle script (variant-independent, ~15 s).
//
// Computed FROM the art's frame durations and marks, so the timeline stays in sync when the art
// changes. Times are ACTION ms (see time.ts); hit-stops are a time remap, not timers. Contact
// GEOMETRY picks where a projectile strikes, never when: both flights have fixed durations, so two
// variants whose anims share totals and mark times share the whole timeline to the millisecond.
//
//  1. summons: dragon first; the wizard once the dragon has landed ('land' marks drive dust / rings)
//  2. idle ~2.2 s (both monsters breathe)
//  3. wizard attack: 'charge' (orb charges at the staff) → 'release' (bolt leaves the orb)
//  4. bolt flight (440 ms) along a swooping arc from the orb to the FIRST SOLID CONTACT with the
//     dragon's silhouette (pixel test on the pose shown just before the hit), the arc chosen so
//     that contact lies deep in the body near the dragon's strike height (its chest) → impact
//     there: the dragon's 'hit' starts so that its 'impact' frame lands exactly on it; hit-stop;
//     ≤2 px shake; local light; sparks → recovery → idle
//  5. ~0.8 s later the dragon 'attack': breath from 'fire' to 'fireEnd' (start of that frame); the
//     shards fly from the muzzle of the frame shown to their own first contact with the wizard
//     (the first one in 256 ms), aimed so the first contact lands at the wizard's upper body
//     (strikeHeight), where its hit reaction (head and hat knocked back) happens
//  6. wizard 'hit' with its 'impact' frame on the first breath contact, then 'death'
//     ('dissolve' → particles from the wizard's own vanishing pixels)
//  7. dragon 'victory' once the last of the wizard is gone, then idle until the end (≥ 15 s)

import type { ArtVariant, DragonAnim, WizardAnim, XY } from '../types';
import { animLength, frameAt, frameStart, markTime } from './anim';
import { TimeMap, type HitStop } from './time';

export type ActorId = 'dragon' | 'wizard';

export interface TrackEntry {
  /** Action ms. */
  at: number;
  anim: string;
}

export interface ActorTrack {
  /** Sorted by `at`. Before the first entry the actor is hidden. */
  entries: TrackEntry[];
  /** Action ms from which the actor is hidden (the wizard after its death). */
  hideAt?: number;
}

/** Camera shake in LAB time. */
export interface Shake {
  at: number;
  dur: number;
  amp: number;
}

/** Effect cues (action ms). fx-effects.ts turns them into effect instances. */
export type FxCue =
  | { kind: 'summon'; who: ActorId; circle: number; appear: number; land: number; end: number }
  | { kind: 'charge'; start: number; release: number }
  | { kind: 'release'; at: number }
  /** The bolt flies boltAt(path, ease(τ)·uEnd): it reaches `uEnd` (the contact) at `impact`. */
  | { kind: 'bolt'; start: number; impact: number; path: BoltPath; uEnd: number }
  /** `point`: world pixel of the contact (where the burst is centred). */
  | { kind: 'impact'; at: number; target: ActorId; point: XY }
  /**
   * `flight`: ms the first shard takes from the mouth to its contact `point` (at `contact`);
   * `aimDy`: the stream aims at the target's core shifted by this many px vertically.
   */
  | { kind: 'breath'; start: number; stop: number; flight: number; contact: number; point: XY; aimDy: number }
  | { kind: 'dissolve'; deathStart: number }
  | { kind: 'victory'; start: number; end: number; hop: number | null };

export interface BattleScript {
  /** Total length in LAB ms (hit-stops included). */
  duration: number;
  time: TimeMap;
  tracks: Record<ActorId, ActorTrack>;
  /** Named beats in action ms (debug readout, tests). */
  beats: Record<string, number>;
  shakes: Shake[];
  cues: FxCue[];
}

/** World-space geometry of one actor (pure: anim + frame → world pixel). */
export interface ActorGeo {
  point(anim: string, frame: number, name: 'core' | 'muzzle'): XY;
  /** Is world pixel p covered by the drawing of (anim, frame)? */
  opaque(anim: string, frame: number, p: XY): boolean;
  /** Optional extra frame point (e.g. 'chest', 'head') in world pixels, if the art defines it. */
  named?(anim: string, frame: number, name: string): XY | undefined;
}

/**
 * Height (world y) at which a projectile should strike a target pose: its 'chest' point if the art
 * defines one, else 60 % of the way from the core up to the 'head' (the upper body, where a hit
 * reaction that knocks the head back reads), else the core.
 */
export function strikeHeight(geo: ActorGeo, anim: string, frame: number): number {
  const core = geo.point(anim, frame, 'core');
  const chest = geo.named?.(anim, frame, 'chest');
  if (chest) return chest.y;
  const head = geo.named?.(anim, frame, 'head');
  return head ? core.y + STRIKE_UP * (head.y - core.y) : core.y;
}

/** A quadratic arc from `from` to `to`; `arc` > 0 bulges up, < 0 sags (screen px at the middle). */
export interface BoltPath {
  from: XY;
  to: XY;
  arc: number;
}

/** Point of a bolt path at geometric parameter u (0 = from, 1 = to; extrapolates beyond). */
export function boltAt(p: BoltPath, u: number): XY {
  return { x: p.from.x + (p.to.x - p.from.x) * u, y: p.from.y + (p.to.y - p.from.y) * u - p.arc * 4 * u * (1 - u) };
}

/** The bolt's speed curve: flight fraction s → path fraction (starts slow, accelerates into the hit). */
export function boltEase(s: number): number {
  const c = Math.max(0, Math.min(1, s));
  return c * (0.55 + 0.45 * c);
}

/** Inverse of boltEase (path fraction → flight fraction). */
export function boltEaseInv(u: number): number {
  const c = Math.max(0, Math.min(1, u));
  return (-0.55 + Math.sqrt(0.55 * 0.55 + 4 * 0.45 * c)) / (2 * 0.45);
}

/** Approximate length of f over [0, u1] in px. */
export function pathLength(f: (u: number) => XY, u1: number, n = 48): number {
  let L = 0;
  let a = f(0);
  for (let i = 1; i <= n; i++) {
    const b = f((u1 * i) / n);
    L += Math.hypot(b.x - a.x, b.y - a.y);
    a = b;
  }
  return L;
}

/**
 * First SOLID contact of a path with an actor's drawing: the first u at which the path pixel is
 * covered AND the path stays inside the body for `depth` more px (so thin parts — a staff, a horn
 * tip, a wing edge — are passed over). Returns null when the path never enters the body.
 */
export function firstContact(geo: ActorGeo, anim: string, frame: number, f: (u: number) => XY, depth = 4): { u: number; p: XY } | null {
  const L = Math.max(1, pathLength(f, 1));
  const du = 0.5 / L;
  const deep = (u: number) => {
    for (let d = 1; d <= depth; d++) if (!geo.opaque(anim, frame, f(u + (d * 1) / L))) return false;
    return true;
  };
  for (let u = 0; u <= 1 + 1e-9; u += du) {
    const p = f(u);
    if (geo.opaque(anim, frame, p) && deep(u)) return { u, p: { x: Math.round(p.x), y: Math.round(p.y) } };
  }
  return null;
}

/**
 * Smallest distance (px, capped at r) between the path before `uStop` (minus its last `skip` px)
 * and the actor's drawing — how close the projectile grazes the body on its way in.
 */
export function clearance(geo: ActorGeo, anim: string, frame: number, f: (u: number) => XY, uStop: number, r = 6, skip = 5): number {
  const L = Math.max(1, pathLength(f, 1));
  const end = uStop - skip / L;
  let best = r;
  for (let u = 0; u < end; u += 1 / L) {
    const p = f(u);
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        const d = Math.hypot(dx, dy);
        if (d < best && geo.opaque(anim, frame, { x: p.x + dx, y: p.y + dy })) best = d;
      }
  }
  return best;
}

/**
 * Projectile flight times (action ms), FIXED rather than distance / speed: every variant shares
 * A's arena and slots, and its battle timing must not drift when a silhouette moves its contact a
 * few px (variant B's taller wizard puts the breath contact further away than A's; with a
 * distance-derived flight every beat after it drifted by 9–28 ms as the art evolved). The values
 * are exactly what A's geometry gave at the former nominal speeds (0.34 px/ms; the bolt clamped
 * to its 440 ms minimum), so A's timeline is unchanged. The effects take their speed from the cue
 * (distance to the contact / flight).
 */
const BOLT_FLIGHT = 440;
const BREATH_FLIGHT = 256;
/**
 * Arc candidates (px). Each is scored by how deep toward the core its first solid contact lies
 * (so the bolt hits the body, not the snout or a horn), plus how cleanly it passes everything
 * else on the way in (no grazing the nose), minus how far that contact lies outside a band around
 * the target's strike height (its chest: not the skull above it, not a foreleg below it); ties
 * keep the earlier, flatter arc. The deep sags serve a target whose long neck and head stand
 * between the orb and the core (variant B's dragon): every flatter arc meets the skull first,
 * these dive under the jaw into the chest; the deepest ones meet the forelegs and lose on the
 * strike band, so the best arc lies inside the list rather than at its end (B: -34). (A's choice
 * is unchanged: its -18 contact lies 4 px above its chest point and still scores best.)
 */
const BOLT_ARCS = [0, -6, 8, -10, 16, -14, -18, -22, -26, -30, -34, -38, -42, -46, -50];
/** Contacts within this many px (vertically) of the strike height are not penalized. */
const BOLT_STRIKE_BAND = 6;
/** Score lost per px a contact lies outside the strike band (the same weight as 1 px of clearance). */
const BOLT_STRIKE_COST = 0.02;
/**
 * How far (px) the breath may aim above the target's core so that its first solid contact lands at
 * the strike height (the stream rises from a low mouth and meets the front of the body — a robe
 * hem flared toward the dragon, the staff hand — well before the core column).
 */
const BREATH_AIM_MAX = 48;
/** Strike height between core (0) and head (1) when the art has no 'chest' point. */
const STRIKE_UP = 0.6;
const HITSTOP_BOLT = 80;
const HITSTOP_BREATH = 70;
/** Beat spacing (action ms). */
const D_CIRCLE_LEAD = 450; // the dragon's circle draws before it appears
const W_CIRCLE_LEAD = 420;
const W_AFTER_D_LAND = 600; // the wizard starts once the dragon has landed and shaken out
const IDLE_BEFORE_FIGHT = 2200;
const GAP_BEFORE_BREATH = 800; // after the dragon's recovery
const VICTORY_AFTER_DEATH = 350; // a beat of stillness when the last of the wizard is gone
const END_HOLD = 1500;
/** Minimum battle length (action ms + holds ≈ lab ms). */
const MIN_LENGTH = 15000;

export function buildBattle(v: ArtVariant, geo: Record<ActorId, ActorGeo>, opts: { hop?: number | null } = {}): BattleScript {
  const D = v.dragon.anims;
  const W = v.wizard.anims;
  const len = {
    dSummon: animLength(D.summon),
    dHit: animLength(D.hit),
    dAttack: animLength(D.attack),
    dVictory: animLength(D.victory),
    wSummon: animLength(W.summon),
    wAttack: animLength(W.attack),
    wHit: animLength(W.hit),
    wDeath: animLength(W.death),
  };

  // 1. summons
  const dCircle = 0;
  const dSummon = D_CIRCLE_LEAD;
  const dLand = dSummon + markTime(D.summon, 'land', D.summon.durations.length - 1);
  const dSummonEnd = dSummon + len.dSummon;
  const wSummon = Math.max(dSummon + 900, dLand + W_AFTER_D_LAND);
  const wCircle = wSummon - W_CIRCLE_LEAD;
  const wLand = wSummon + markTime(W.summon, 'land', W.summon.durations.length - 1);
  const wSummonEnd = wSummon + len.wSummon;

  // 2. idle → 3. wizard attack
  const wAttack = Math.max(wSummonEnd, dSummonEnd) + IDLE_BEFORE_FIGHT;
  const charge = wAttack + markTime(W.attack, 'charge', 0);
  const release = Math.max(charge + 1, wAttack + markTime(W.attack, 'release', Math.floor(W.attack.durations.length / 2)));
  const wAttackEnd = wAttack + len.wAttack;

  // 4. bolt flight → impact on the dragon, at the first solid contact with the pose shown just
  //    before the impact frame (aimed at the core of the impact frame; of BOLT_ARCS the arc whose
  //    contact is deepest toward the core, grazes nothing on the way in and lies at the strike
  //    height is chosen, so it swoops in under the snout into the chest instead of hitting a
  //    horn, the nose or a foreleg)
  const relFrame = frameAt(W.attack, release - wAttack);
  const muzzle0 = geo.wizard.point('attack', relFrame, 'muzzle');
  const dHitImpactOff = markTime(D.hit, 'impact', 0);
  const dHitImpactFrame = frameAt(D.hit, dHitImpactOff);
  const preHit = dHitImpactFrame > 0 ? { anim: 'hit', frame: dHitImpactFrame - 1 } : { anim: 'idle', frame: 0 };
  const core1 = geo.dragon.point('hit', dHitImpactFrame, 'core');
  const dStrikeY = strikeHeight(geo.dragon, 'hit', dHitImpactFrame);
  let boltPath: BoltPath = { from: muzzle0, to: core1, arc: 0 };
  let boltContact = { u: 1, p: { x: Math.round(core1.x), y: Math.round(core1.y) } };
  let bestScore = -Infinity;
  for (const arc of BOLT_ARCS) {
    const path = { from: muzzle0, to: core1, arc };
    const f = (u: number) => boltAt(path, u);
    const c = firstContact(geo.dragon, preHit.anim, preHit.frame, f);
    if (!c) continue;
    const offStrike = Math.max(0, Math.abs(c.p.y - dStrikeY) - BOLT_STRIKE_BAND);
    const score = c.u + 0.02 * clearance(geo.dragon, preHit.anim, preHit.frame, f, c.u) - BOLT_STRIKE_COST * offStrike;
    if (score > bestScore + 0.005) {
      bestScore = score;
      boltPath = path;
      boltContact = c;
    }
  }
  const boltFlight = BOLT_FLIGHT;
  const impact = release + boltFlight;
  const dHit = impact - dHitImpactOff;
  const dHitEnd = dHit + len.dHit;

  // 5. dragon attack (breath)
  const wHitImpactOff = markTime(W.hit, 'impact', 0);
  const fireOff = markTime(D.attack, 'fire', Math.floor(D.attack.durations.length / 2));
  const fireFrame = frameAt(D.attack, fireOff);
  const fireEndFrame = Math.max(fireFrame + 1, D.attack.marks?.fireEnd ?? fireFrame + 2);
  const fireEndOff = Math.min(len.dAttack, frameStart(D.attack, fireEndFrame));
  const mouth = geo.dragon.point('attack', fireFrame, 'muzzle');
  const wHitImpactFrame = frameAt(W.hit, wHitImpactOff);
  const wCore = geo.wizard.point('hit', wHitImpactFrame, 'core');
  const wPre = wHitImpactFrame > 0 ? { anim: 'hit', frame: wHitImpactFrame - 1 } : { anim: 'idle', frame: 0 };
  // aim: the core, raised until the stream's first solid contact lands at the strike height of the
  // impact pose (the upper body: the wizard's hit knocks its head and hat back, so a contact low on
  // the robe front read wrong); a straight line from the low mouth otherwise strikes the flared
  // hem / the foot of the staff
  const wStrikeY = strikeHeight(geo.wizard, 'hit', wHitImpactFrame);
  let breathAimDy = 0;
  let breathHit = { u: 1, p: { x: Math.round(wCore.x), y: Math.round(wCore.y) } };
  let bestOff = Infinity;
  for (let dy = 0; dy >= -BREATH_AIM_MAX; dy -= 2) {
    const aim = { x: wCore.x, y: wCore.y + dy };
    const c = firstContact(geo.wizard, wPre.anim, wPre.frame, (u) => ({ x: mouth.x + (aim.x - mouth.x) * u, y: mouth.y + (aim.y - mouth.y) * u }));
    if (!c) continue;
    const off = Math.abs(c.p.y - wStrikeY);
    if (off < bestOff - 0.5) {
      bestOff = off;
      breathAimDy = dy;
      breathHit = c;
    }
  }
  const breathFlight = BREATH_FLIGHT;
  let dAttack = Math.max(dHitEnd + GAP_BEFORE_BREATH, wAttackEnd + 200);
  // the wizard must have finished its own attack before the breath's hit starts
  const wHitEarliest = wAttackEnd + 120;
  if (dAttack + fireOff + breathFlight - wHitImpactOff < wHitEarliest) dAttack = wHitEarliest + wHitImpactOff - breathFlight - fireOff;
  const fire = dAttack + fireOff;
  const fireEnd = Math.max(fire + 60, dAttack + fireEndOff);
  const dAttackEnd = dAttack + len.dAttack;

  // 6. wizard hit → death
  const contact = fire + breathFlight;
  const wHit = contact - wHitImpactOff;
  const wDeath = wHit + len.wHit;
  const dissolve = wDeath + markTime(W.death, 'dissolve', 0);
  const wDeathEnd = wDeath + len.wDeath;

  // 7. victory → idle hold
  const victory = Math.max(dAttackEnd + 300, wDeathEnd + VICTORY_AFTER_DEATH);
  const victoryEnd = victory + len.dVictory;
  const hop = opts.hop == null ? null : victory + opts.hop;

  const stops: HitStop[] = [
    { at: impact, dur: HITSTOP_BOLT },
    { at: contact, dur: HITSTOP_BREATH },
  ];
  const holdTotal = stops.reduce((s, h) => s + h.dur, 0);
  const endAction = Math.max(victoryEnd + END_HOLD, MIN_LENGTH - holdTotal);
  const time = new TimeMap(stops);

  const tracks: Record<ActorId, ActorTrack> = {
    dragon: {
      entries: [
        { at: dSummon, anim: 'summon' satisfies DragonAnim },
        { at: dSummonEnd, anim: 'idle' satisfies DragonAnim },
        { at: dHit, anim: 'hit' satisfies DragonAnim },
        { at: dHitEnd, anim: 'idle' satisfies DragonAnim },
        { at: dAttack, anim: 'attack' satisfies DragonAnim },
        { at: dAttackEnd, anim: 'idle' satisfies DragonAnim },
        { at: victory, anim: 'victory' satisfies DragonAnim },
        { at: victoryEnd, anim: 'idle' satisfies DragonAnim },
      ],
    },
    wizard: {
      entries: [
        { at: wSummon, anim: 'summon' satisfies WizardAnim },
        { at: wSummonEnd, anim: 'idle' satisfies WizardAnim },
        { at: wAttack, anim: 'attack' satisfies WizardAnim },
        { at: wAttackEnd, anim: 'idle' satisfies WizardAnim },
        { at: wHit, anim: 'hit' satisfies WizardAnim },
        { at: wDeath, anim: 'death' satisfies WizardAnim },
      ],
      hideAt: wDeathEnd,
    },
  };
  // keep tracks sorted and free of zero-length entries even if the art's timings are unusual
  for (const tr of Object.values(tracks)) {
    tr.entries.sort((p, q) => p.at - q.at);
    tr.entries = tr.entries.filter((e, i, arr) => i === arr.length - 1 || arr[i + 1].at > e.at);
  }

  const cues: FxCue[] = [
    { kind: 'summon', who: 'dragon', circle: dCircle, appear: dSummon, land: dLand, end: dSummonEnd },
    { kind: 'summon', who: 'wizard', circle: wCircle, appear: wSummon, land: wLand, end: wSummonEnd },
    { kind: 'charge', start: charge, release },
    { kind: 'release', at: release },
    { kind: 'bolt', start: release, impact, path: boltPath, uEnd: boltContact.u },
    { kind: 'impact', at: impact, target: 'dragon', point: boltContact.p },
    { kind: 'breath', start: fire, stop: fireEnd, flight: breathFlight, contact, point: breathHit.p, aimDy: breathAimDy },
    { kind: 'dissolve', deathStart: wDeath },
    { kind: 'victory', start: victory, end: victoryEnd, hop },
  ];

  const shakes: Shake[] = [
    { at: time.toLab(impact), dur: 220, amp: 2 },
    { at: time.toLab(contact), dur: 180, amp: 2 },
  ];

  return {
    duration: Math.round(time.toLab(endAction)),
    time,
    tracks,
    beats: {
      dCircle, dSummon, dLand, dSummonEnd, wCircle, wSummon, wLand, wSummonEnd,
      wAttack, charge, release, boltFlight, boltArc: boltPath.arc, impact, dHit, dHitEnd, wAttackEnd,
      dAttack, fire, fireEnd, breathFlight, breathAimDy, breathStrikeY: Math.round(wStrikeY), contact, dAttackEnd,
      wHit, wDeath, dissolve, wDeathEnd, victory, victoryEnd, end: endAction,
    },
    shakes,
    cues,
  };
}

/** Deterministic integer shake offset at lab time t (sum of active shakes, clamped). */
export function shakeAt(shakes: readonly Shake[], t: number, max: number): XY {
  const PX = [2, -2, 1, -1, 2, -1, 1, 0];
  const PY = [-1, 1, 1, -1, 0, 1, -1, 0];
  let x = 0;
  let y = 0;
  for (const s of shakes) {
    const u = t - s.at;
    if (u < 0 || u >= s.dur) continue;
    const k = Math.floor(u / 34);
    const fall = 1 - u / s.dur;
    const amp = Math.max(1, Math.round(s.amp * fall));
    x += Math.sign(PX[k % PX.length]) * Math.min(amp, Math.abs(PX[k % PX.length]));
    y += Math.sign(PY[k % PY.length]) * Math.min(amp, Math.abs(PY[k % PY.length]));
  }
  const m = Math.max(0, Math.floor(max));
  return { x: Math.max(-m, Math.min(m, x)), y: Math.max(-m, Math.min(m, y)) };
}
