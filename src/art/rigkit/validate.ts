// rigkit / validate — validateArt(): the motion rules of REHBER §4 checked on ANY MonsterArt (the
// slice too; A3_MIMARI §2, §3.2, §12).
//
//   HA-1   mandatory marks: attack / roar / special charge, release = impact, recover (attack also
//          contact unless its attack is a projectile); hit* impact = contact = 0, recover; death
//          impact = contact = 0, dissolve; summon / revive land; marks in order and in range
//   HA-2   every hold 40–200 ms (only victory's held last frame may be longer)
//   HA-3   attack: the longest frame is an anticipation frame (charge ≤ f < release); attack /
//          special: release ≤ 70 ms; attack contact 50–90 ms; attack / roar / special: the recovery
//          frames (recover → end) never shorten
//   HA-4   hit / hitHeavy / hitMagic: f0 40–60 ms, f1 40–70 ms, recover at 240–370 ms, the recovery
//          frames 70–150 ms
//   HA-5   no anim with all holds equal
//   HA-14  out = Δ(last frame, idle f0) / idleΔ ≤ 1.2 (toGuard: against guard f0; death and victory
//          excepted) — measured in pixels, P1 and (p2: 'relight') P2
//   HA-29  toGuard / fromGuard: 5–7 frames, ≤ 0.4 s
//   §4.9   per tier: the mandatory anims (hit, hitHeavy, hitMagic, summon, death, revive) and, for the
//          normal / common tiers, the recommended frame counts (warnings)
// Findings carry the rule id; 'warn' marks recommendations and context-dependent rules.

import { PixelCanvas } from '../pixel';
import { MONSTER_ANIMS, type AnimSpec, type AnyMonsterAnim, type MonsterAnim, type MonsterAnimExtra, type MonsterArt } from '../types';

/** Card tier (A3_MIMARI §6.1, REHBER §0.2). src/presentation/types.ts re-exports this type. */
export type Tier = 'ace' | 'normal' | 'common';

export interface Finding {
  readonly rule: string;
  readonly anim?: AnyMonsterAnim;
  readonly frame?: number;
  readonly severity: 'error' | 'warn';
  readonly message: string;
  /** measured value, when the rule measures something */
  readonly value?: number;
}

export interface ValidateOpts {
  /** tier rules of §4.9 (default: none of the recommended counts; the mandatory anims always) */
  readonly tier?: Tier;
  /** the attack's kind: a projectile's contact belongs to the cinematic (HA-1). Unknown: a warning. */
  readonly attack?: 'melee' | 'beam' | 'projectile';
  /** HA-14 renders frames (default true) */
  readonly pixels?: boolean;
}

const BASE = new Set<string>(MONSTER_ANIMS);
const ONE_SHOT_OUT: readonly AnyMonsterAnim[] = ['attack', 'roar', 'hit', 'summon', 'revive', 'special', 'hitHeavy', 'hitMagic', 'toGuard', 'fromGuard'];
const HITS: readonly AnyMonsterAnim[] = ['hit', 'hitHeavy', 'hitMagic'];
const MANDATORY: readonly MonsterAnimExtra[] = ['hitHeavy', 'hitMagic', 'summon', 'death', 'revive'];
/** §4.9 recommended minimum frames (normal / common; [min, max] for hit) and max duration (ms). */
const TIER_FRAMES: Record<'normal' | 'common', Partial<Record<AnyMonsterAnim, { min: number; max?: number; ms?: number }>>> = {
  normal: { idle: { min: 12 }, guard: { min: 6 }, toGuard: { min: 5, ms: 400 }, fromGuard: { min: 5, ms: 400 }, attack: { min: 10 }, roar: { min: 9 }, hit: { min: 5, max: 6 }, hitHeavy: { min: 7 }, hitMagic: { min: 7 }, summon: { min: 10 }, death: { min: 8, ms: 900 }, revive: { min: 10 } },
  common: { idle: { min: 12 }, guard: { min: 6 }, toGuard: { min: 4, ms: 400 }, fromGuard: { min: 4, ms: 400 }, attack: { min: 9 }, roar: { min: 8 }, hit: { min: 5, max: 6 }, hitHeavy: { min: 6 }, hitMagic: { min: 6 }, summon: { min: 8 }, death: { min: 8, ms: 900 }, revive: { min: 8 } },
};

/** The spec of an anim the art has (base or extra). */
function specOf(art: MonsterArt, anim: AnyMonsterAnim): AnimSpec | undefined {
  return BASE.has(anim) ? art.anims[anim as MonsterAnim] : art.extraAnims?.[anim as MonsterAnimExtra];
}
/** Hold of frame f (the AnimSpec rule: a missing / non-positive hold falls back to 1000 / fps). */
function holdOf(s: AnimSpec, f: number): number {
  const h = s.holds?.[f];
  return h !== undefined && h > 0 ? h : 1000 / s.fps;
}

/** Draw one frame like the game's sheets do (P1: no DrawOpts; P2 relight: lightFrom 'right'). */
export function drawFrame(art: MonsterArt, anim: AnyMonsterAnim, frame: number, light: 'left' | 'right' = 'left'): PixelCanvas {
  const p = new PixelCanvas(art.w, art.h);
  const o = light === 'right' ? { lightFrom: 'right' as const } : undefined;
  if (BASE.has(anim)) {
    if (o) art.draw(p, anim as MonsterAnim, frame, o);
    else art.draw(p, anim as MonsterAnim, frame);
  } else if (o) art.drawExtra!(p, anim as MonsterAnimExtra, frame, o);
  else art.drawExtra!(p, anim as MonsterAnimExtra, frame);
  return p;
}

/** Pixels that differ (colour or opacity) between two frames of the same size. */
export function frameDelta(a: PixelCanvas, b: PixelCanvas): number {
  let n = 0;
  for (let i = 0; i < a.data.length; i += 4)
    if (a.data[i] !== b.data[i] || a.data[i + 1] !== b.data[i + 1] || a.data[i + 2] !== b.data[i + 2] || a.data[i + 3] !== b.data[i + 3]) n++;
  return n;
}

export function validateArt(art: MonsterArt, o: ValidateOpts = {}): Finding[] {
  const out: Finding[] = [];
  const add = (rule: string, anim: AnyMonsterAnim | undefined, message: string, extra: { frame?: number; severity?: 'error' | 'warn'; value?: number } = {}) =>
    out.push({ rule, ...(anim ? { anim } : {}), ...(extra.frame !== undefined ? { frame: extra.frame } : {}), severity: extra.severity ?? 'error', message, ...(extra.value !== undefined ? { value: extra.value } : {}) });
  const anims: AnyMonsterAnim[] = [...MONSTER_ANIMS, ...(Object.keys(art.extraAnims ?? {}) as MonsterAnimExtra[]).filter((a) => art.extraAnims![a])];

  // ---- spec integrity
  for (const a of anims) {
    const s = specOf(art, a)!;
    if (s.holds && s.holds.length !== s.frames) add('SPEC', a, `${s.holds.length} holds for ${s.frames} frames`);
    for (const [m, f] of Object.entries(s.marks ?? {})) if (f === undefined || !Number.isInteger(f) || f < 0 || f >= s.frames) add('SPEC', a, `mark ${m} = ${f} outside 0…${s.frames - 1}`);
  }

  // ---- §4.9 mandatory anims (every tier)
  for (const a of MANDATORY) if (!art.extraAnims?.[a] || !art.drawExtra) add('§4.9', a, `${a} is mandatory in every tier (REHBER §4.9)`);

  for (const a of anims) {
    const s = specOf(art, a)!;
    const m = s.marks ?? {};
    const holds = Array.from({ length: s.frames }, (_, f) => holdOf(s, f));
    const startOf = (f: number) => holds.slice(0, f).reduce((x, y) => x + y, 0);
    const total = startOf(s.frames);

    // ---- HA-1 marks
    const need = (mark: keyof typeof m, why: string, severity: 'error' | 'warn' = 'error') => {
      if (m[mark] === undefined) add('HA-1', a, `no ${mark} mark (${why})`, { severity });
    };
    if (a === 'attack' || a === 'roar' || a === 'special') {
      need('charge', 'first anticipation frame');
      need('release', 'the release frame');
      need('impact', 'release / impact pair');
      need('recover', 'first recovery frame');
      if (m.release !== undefined && m.impact !== undefined && m.release !== m.impact) add('HA-1', a, `impact ${m.impact} ≠ release ${m.release}`);
      if (m.charge !== undefined && m.release !== undefined && !(m.charge < m.release)) add('HA-1', a, `charge ${m.charge} not before release ${m.release}`);
      if (m.release !== undefined && m.recover !== undefined && !(m.release < m.recover)) add('HA-1', a, `recover ${m.recover} not after release ${m.release}`);
      if (a === 'attack' && m.contact === undefined && o.attack !== 'projectile')
        add('HA-1', a, o.attack ? `no contact mark (a ${o.attack} attack reaches its target in the anim)` : 'no contact mark (required for a melee / beam attack; a projectile’s contact is the cinematic’s)', { severity: o.attack ? 'error' : 'warn' });
      if (a === 'attack' && m.contact !== undefined && m.release !== undefined && m.contact < m.release) add('HA-1', a, `contact ${m.contact} before release ${m.release}`);
    }
    if (HITS.includes(a) || a === 'death') {
      if (m.impact !== 0) add('HA-1', a, m.impact === undefined ? 'no impact mark (f0)' : `impact on f${m.impact}, not f0`);
      if (m.contact !== 0) add('HA-1', a, m.contact === undefined ? 'no contact mark (impact and contact both on f0)' : `contact on f${m.contact}, not f0`);
      if (a === 'death') need('dissolve', 'erosion start');
      else need('recover', 'first recovery frame');
    }
    if (a === 'summon' || a === 'revive') need('land', 'feet / hover settle');

    // ---- HA-2 holds 40–200 ms (victory's held last pose excepted)
    holds.forEach((h, f) => {
      if (a === 'victory' && f === s.frames - 1) return;
      if (h < 40 || h > 200) add('HA-2', a, `f${f} holds ${h} ms (40–200)`, { frame: f, value: h });
    });

    // ---- HA-3 long anticipation, short strike
    if (a === 'attack' && m.release !== undefined) {
      const c0 = m.charge ?? 0;
      const longest = Math.max(...holds);
      const f = holds.indexOf(longest);
      if (!(f >= c0 && f < m.release)) add('HA-3', a, `the longest frame (f${f}, ${longest} ms) is not an anticipation frame (f${c0}…f${m.release - 1})`, { frame: f, value: longest });
    }
    if ((a === 'attack' || a === 'special') && m.release !== undefined && holds[m.release] > 70) add('HA-3', a, `release f${m.release} holds ${holds[m.release]} ms (≤ 70)`, { frame: m.release, value: holds[m.release] });
    if (a === 'attack' && m.contact !== undefined && (holds[m.contact] < 50 || holds[m.contact] > 90)) add('HA-3', a, `contact f${m.contact} holds ${holds[m.contact]} ms (50–90)`, { frame: m.contact, value: holds[m.contact] });
    if ((a === 'attack' || a === 'roar' || a === 'special') && m.recover !== undefined)
      for (let f = m.recover + 1; f < s.frames; f++) if (holds[f] < holds[f - 1]) add('HA-3', a, `recovery shortens at f${f} (${holds[f - 1]} → ${holds[f]} ms)`, { frame: f, value: holds[f] });

    // ---- HA-4 reaction rhythm
    if (HITS.includes(a)) {
      if (holds[0] < 40 || holds[0] > 60) add('HA-4', a, `f0 holds ${holds[0]} ms (40–60)`, { frame: 0, value: holds[0] });
      if (s.frames > 1 && (holds[1] < 40 || holds[1] > 70)) add('HA-4', a, `f1 holds ${holds[1]} ms (40–70)`, { frame: 1, value: holds[1] });
      if (m.recover !== undefined) {
        const at = startOf(m.recover);
        if (at < 240 || at > 370) add('HA-4', a, `recover starts at ${at} ms (240–370)`, { frame: m.recover, value: at });
        for (let f = m.recover; f < s.frames; f++) if (holds[f] < 70 || holds[f] > 150) add('HA-4', a, `recovery f${f} holds ${holds[f]} ms (70–150)`, { frame: f, value: holds[f] });
      }
    }

    // ---- HA-5 uneven holds
    if (s.frames > 1 && holds.every((h) => h === holds[0])) add('HA-5', a, `every frame holds ${holds[0]} ms`);

    // ---- HA-29 guard transitions
    if ((a === 'toGuard' || a === 'fromGuard') && (s.frames < 5 || s.frames > 7 || total > 400)) add('HA-29', a, `${s.frames} frames / ${total} ms (5–7 frames, ≤ 400 ms)`, { value: total });

    // ---- §4.9 recommended counts per tier
    const t = o.tier === 'normal' || o.tier === 'common' ? TIER_FRAMES[o.tier][a] : undefined;
    if (t) {
      if (s.frames < t.min || (t.max !== undefined && s.frames > t.max)) add('§4.9', a, `${s.frames} frames (${o.tier}: ${t.max !== undefined ? `${t.min}–${t.max}` : `≥ ${t.min}`})`, { severity: 'warn', value: s.frames });
      if (t.ms !== undefined && total > t.ms) add('§4.9', a, `${total} ms (${o.tier}: ≤ ${t.ms} ms)`, { severity: 'warn', value: total });
    }
  }

  // ---- HA-14 out (pixels)
  if (o.pixels !== false) {
    const lights: ('left' | 'right')[] = art.p2 === 'relight' ? ['left', 'right'] : ['left'];
    for (const light of lights) {
      const idle = Array.from({ length: art.anims.idle.frames }, (_, f) => drawFrame(art, 'idle', f, light));
      let sum = 0;
      for (let f = 0; f < idle.length; f++) sum += frameDelta(idle[f], idle[(f + 1) % idle.length]);
      const idleD = idle.length > 1 ? sum / idle.length : 0;
      const guard0 = drawFrame(art, 'guard', 0, light);
      for (const a of ONE_SHOT_OUT) {
        const s = specOf(art, a);
        if (!s || s.loop) continue;
        const last = drawFrame(art, a, s.frames - 1, light);
        const d = frameDelta(last, a === 'toGuard' ? guard0 : idle[0]);
        const outV = idleD > 0 ? d / idleD : d > 0 ? Infinity : 0;
        if (outV > 1.2) add('HA-14', a, `${light === 'left' ? 'P1' : 'P2'}: out = ${outV.toFixed(2)} (Δ ${d} px / idleΔ ${idleD.toFixed(1)}; ≤ 1.2)`, { frame: s.frames - 1, value: outV });
      }
    }
  }
  return out;
}
