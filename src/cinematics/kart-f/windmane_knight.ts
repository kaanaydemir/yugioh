// Fırtına Şövalyesi (windmane_knight) — the v3 presentation (lane F). Design: docs/v3/oturum-f/windmane_knight.md
// (§0.1 wins over the older text). Every registration is gated on LOOK_V3 (v1 registers nothing here), priority 20,
// named kart-f:windmane_knight:<part>. Sounds: src/audio/v3/windmane_knight.ts (the voice ships with this file).
//
// The knight carries a steppe GALE in his horsehair mane. Whatever moves on him (mane, pennon, grey dust) shows
// the game state: a quiet stream = normal, a taut, longer stream + circling dust = the summon-turn storm (+500),
// dead stillness = death. The storm is a dry GALE of hair ribbons and grey dust (never sand: hourglass_imp; never
// lightning / thunder: judgment_bolt, volt_lizard).
//
//   tribute   the tributes are scoured by gale ribbons blowing toward his tile (the generic streams carry them in)
//   summon    "Rüzgâr Cephesi'nden Çıkış": a low gale front of streaming hair ribbons and grey dust crosses his tile
//             from the enemy side to his back; inside it the two gold eye-points kindle first, then the body steps
//             out of the storm (summon f0–f5) — the lance butt is driven into the tile (land: dust ring, plant thump)
//             — the cut-in holds his breath (mane gathered, f7–f9) — as the band leaves, the UNFURL (f10): the mane
//             whip-cracks out to full length, a grit spray flies downwind, the finale; the brew aura starts
//   effect    "Fırtına Yükü" (no activate event: the +500 surfaces as the statChange on entering the battle phase
//             of the summon turn): the circling dust contracts to his feet, the roar lifts the lance and spirals the
//             mane up, then SNAPS it into a taut horizontal blade (roar release) — a gust bursts downwind, a gold
//             pool flashes on his tile only, the badge rolls 2300 → 2800 with a gold "+500 FIRTINA" chip; the aura
//             becomes the storm (12 fast specks, the storm tail off the mane tip, wind streaks behind him)
//   calm      "Fırtına diner" (end phase statChange 2800 → 2300): the specks fall to the tile, the tail drifts off
//             and blinks out, the badge settles with a muted "−500" (a calm, not a loss)
//   strike    normal "Kargı Hamlesi": couch, two heavy steps of lunge, the thrust, then the DOUBLE HIT — a frame
//             later the mane lashes the target's head ("ŞAK"); blocked: sparks skid along the guard and he is
//             shoved back
//             storm "Fırtına Hücumu" (summon turn only): the rigid lance spins about the grip (4 angles + a smear arc), a
//             knee-high dust devil, a gale wall builds behind him, he CHARGES inside it (a 4-frame heavy run), the GALE BOOM on contact
//             (a pressure ring, grey dust ring, hair ribbons blowing past the target); direct: the gale sweeps on
//             to the duelist; blocked (e.g. the titan's −500 eats the storm): the gale SPLITS around the guard
//   death     "Kof Zırh" (the hollow armour): the sprite's own ending — the calm (mane and pennon freeze, the aura
//             dies), the rigid mane snaps off and shatters flat, the empty helm falls, the plate comes apart
//             standing, the lance topples like a felled flagpole, the pennon lands last (the card is born);
//             no shatter, no kneel, no sinking: the pile settles in grey dust and goes out in palette steps

import Phaser from 'phaser';
import { CARDS, isMonster } from '../../data/cards';
import { summonTurnBonus } from '../../engine/query';
import type { GameEvent, GameState, PlayerId, Uid } from '../../engine/types';
import { PAL, RAMPS } from '../../art/palette';
import { mulberry32 } from '../../art/pixel';
import type { AnyMonsterAnim, MonsterPointName } from '../../art/types';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import { DEPTH, LOOK_V3, type XY, unitDepth, zoneXY } from '../../view/layout';
import { lightFlash, lightPool, type LightHandle } from '../../view/light';
import { E, Px, Sparks, animate, onFrame, sleep, stopTime } from '../../vfx/combat';
import { shake } from '../../vfx/core';
import { pixelText } from '../../ui/text';
import { fx, registerCardHook, registerObserver, registerStrike } from '../api';
import type { CinematicContext, StrikeArgs } from '../_core/types';
import { strikeStartFrame } from '../_v3/clash';
import { atFrame, dropCharge, fade as fadeSnd, hush, panAt, play, start, takeCharge } from '../_v3/sound';
import { sfx } from '../../audio/sfx';
import { holoOnset } from '../_v3/summon';
import { behindBodies, cardLeaves } from '../_v3/card';
import { contactFlash } from '../_v3/flash';
import { deathStartFrom, takePlannedEntry } from '../_v3/posematch';
import { planGuardBreak, runGuardBreak, showsGuard } from '../_v3/guardbreak';
import { runSummon, type Stage } from '../summon-a/_kit';
import { sourceOwnsDeath } from '../strikes-b/_kit';
import { contactFeet, layer } from '../strikes-a/_kit';

const ID = 'windmane_knight';
const AURA = 'fsStorm';
type AnyCtx = CinematicContext<GameEvent>;
type EvOf<T extends GameEvent['type']> = Extract<GameEvent, { type: T }>;
type Ctx<T extends GameEvent['type']> = CinematicContext<EvOf<T>>;

/** Horsehair (the mane, its tail, the ribbons of the gale): dark → light. */
const HAIR = [PAL.earth1, PAL.earth2, PAL.earth3, PAL.earth4] as const;
/** Grey gale dust (never earth3/earth4 with gold3: that is the hourglass' sand). */
const DUST = [PAL.stone3, PAL.stone2, PAL.stone1] as const;
const DUST_LIT = [PAL.mist, PAL.stone3, PAL.stone2] as const;
const TAU = Math.PI * 2;

// ================================================================ state

/** The slot of `uid` and its controller in `s` (null: not on the field). */
function slotOf(s: GameState, uid: Uid): { p: PlayerId; slot: NonNullable<GameState['players'][0]['monsters'][number]> } | null {
  for (const p of [0, 1] as PlayerId[]) for (const m of s.players[p].monsters) if (m && m.uid === uid) return { p, slot: m };
  return null;
}

/** The +500 is on for `uid` in `s` (engine/query summonTurnBonus — never derived from the ATK number). */
function stormOn(s: GameState, uid: Uid): boolean {
  const at = slotOf(s, uid);
  const c = s.cards[uid];
  if (!at || !c) return false;
  const d = CARDS[c.cardId];
  return !!d && isMonster(d) && summonTurnBonus(s, d, at.p, at.slot) > 0;
}

/** The aura level `uid` should show in `s`: 2 the storm, 1 the brew (summon turn, a battle still to come), 0 none. */
function levelIn(s: GameState, uid: Uid): 0 | 1 | 2 {
  if (stormOn(s, uid)) return 2;
  const at = slotOf(s, uid);
  if (!at || s.cards[uid]?.cardId !== ID) return 0;
  const m = at.slot;
  if (!m.faceUp || !m.normalSummoned || m.position !== 'attack' || m.enteredTurn !== s.turn || s.activePlayer !== at.p) return 0;
  // turn 1 has no battle phase: the wind dies before it rises (no brew)
  if (s.turn <= 1 || s.phase !== 'main') return 0;
  if (m.noAttackTurn === s.turn) return 0;
  return 1;
}

// ================================================================ geometry

const other = (p: PlayerId): PlayerId => (p === 0 ? 1 : 0);
const norm = (a: XY): XY => {
  const l = Math.hypot(a.x, a.y) || 1;
  return { x: a.x / l, y: a.y / l };
};
const rint = (p: XY): XY => ({ x: Math.round(p.x), y: Math.round(p.y) });

/** Toward the opponent along the knight's lane (screen, normalised). */
function forwardOf(p: PlayerId, zone: number): XY {
  const a = zoneXY(p, 'monster', zone);
  const b = zoneXY(other(p), 'monster', zone);
  return norm({ x: b.x - a.x, y: b.y - a.y });
}

/** The knight's forward for a unit: toward the enemy along its facing (screen). */
function fwdOfUnit(u: MonsterUnit): XY {
  const d = u.flipX ? -1 : 1;
  return norm({ x: d, y: -0.5 * d });
}

/** A named art point on the frame the unit shows now (world, whole pixels); `fb` when the art has none. */
function pointNow(u: MonsterUnit, name: MonsterPointName, fb?: XY): XY {
  const fi = u.frameInfo();
  const pts = u.art.points && fi.anim ? u.art.points(fi.anim, fi.frame) : null;
  const p = pts?.[name];
  if (p) return rint(u.framePoint(p.x, p.y));
  return rint(fb ?? u.core());
}

/** A named point of `anim` frame `f` (frame px). */
function artPoint(u: MonsterUnit, anim: AnyMonsterAnim, f: number, name: MonsterPointName): XY | null {
  return u.art.points?.(anim, f)?.[name] ?? null;
}

/** The feet (floor) under the sprite where it stands now. */
function feetOf(u: MonsterUnit): XY {
  return { x: Math.round(u.sprite.x), y: Math.round(u.sprite.y + u.art.hover + u.lift) };
}

/** Put the sprite's feet on `p` (whole pixels, depth re-sorted). */
function setFeet(u: MonsterUnit, p: XY): void {
  const s = u.sprite;
  if (!s.active) return;
  s.setPosition(Math.round(p.x), Math.round(p.y - u.art.hover));
  s.setDepth(unitDepth(Math.round(p.y)));
}

// ================================================================ painters

/**
 * One horsehair ribbon: a 2-px wavy stroke from `p` along `d` (len px), its upper edge a tone lighter, the
 * head end (the tip) the lightest. Whole pixels, palette steps only.
 */
function ribbon(px: Px, p: XY, d: XY, len: number, ph: number, amp: number, tone = 2): void {
  // a smooth 2-px horsehair stroke: one gentle S-curve over its whole length (never a kinked scribble), the
  // core one tone, the leading (upper) edge a step lighter, the last 3 px a tapered 1-px tail
  const nx = -d.y;
  const ny = d.x;
  const L = Math.max(4, Math.round(len));
  const core = HAIR[Math.max(1, Math.min(2, tone))];
  const lead = HAIR[Math.max(2, Math.min(3, tone + 1))];
  const tail = HAIR[Math.max(0, Math.min(2, tone - 1))];
  let px0 = Number.NaN;
  let py0 = Number.NaN;
  for (let i = 0; i < L; i++) {
    const u = i / L;
    const w = Math.round(Math.sin(u * TAU * 0.8 + ph) * amp * 1.4 * Math.min(1, u * 3));
    const x = Math.round(p.x + d.x * i + nx * w);
    const y = Math.round(p.y + d.y * i + ny * w);
    if (x === px0 && y === py0) continue;
    px0 = x;
    py0 = y;
    if (i >= L - 3) {
      px.dot(x, y, tail);
      continue;
    }
    px.dot(x, y, lead);
    px.dot(x, y + 1, core);
  }
}

/** A stepped dust billow (a low cloud bank piece): flat bands, a lit top. */
function billow(px: Px, x: number, y: number, r: number, lit: boolean): void {
  const R = Math.max(2, Math.round(r));
  px.ellipse(x, y, R, Math.max(1, Math.round(R * 0.62)), PAL.stone1);
  px.ellipse(x, y - 1, R - 1, Math.max(1, Math.round(R * 0.5)), PAL.stone2);
  if (R >= 3) px.ellipse(x - 1, y - Math.round(R * 0.35), Math.max(1, R - 2), Math.max(1, Math.round(R * 0.3)), lit ? PAL.stone3 : PAL.stone2);
}

/** Stepped iso ring on the floor (whole pixels), 1 px thick. */
function isoRing(px: Px, x: number, y: number, r: number, c: number): void {
  px.ellipseRing(Math.round(x), Math.round(y), Math.max(1, Math.round(r)), Math.max(1, Math.round(r * 0.5)), 1, c);
}

/** A grey dust ring opening on the floor in whole steps (dark tones: dust, not light). */
function dustRing(sc: Phaser.Scene, at: XY, o: { r0?: number; r1?: number; ms?: number; depth?: number; tones?: readonly number[] } = {}): Promise<void> {
  const px = layer(sc, o.depth ?? DEPTH.TILE_FX + 5);
  const tones = o.tones ?? [PAL.stone3, PAL.stone3, PAL.stone2, PAL.stone1];
  const r0 = o.r0 ?? 6;
  const r1 = o.r1 ?? 30;
  return animate(sc, o.ms ?? 360, (t) => {
    px.clear();
    if (t >= 1) return;
    const k = Math.min(tones.length - 1, Math.floor(t * tones.length));
    const r = r0 + (r1 - r0) * E.outC(Math.floor(t * 6) / 6);
    isoRing(px, at.x, at.y, r, tones[k]);
    if (k < 2) isoRing(px, at.x, at.y, r - 2, PAL.stone1);
  }).then(() => px.g.destroy());
}

/** Dust puffs on the floor (grey, low, settling). */
function dustPuffs(sc: Phaser.Scene, at: XY, n: number, o: { spread?: number; push?: XY; depth?: number; rnd: () => number }): void {
  const sp = new Sparks(sc, o.depth ?? DEPTH.FX - 2);
  const R = o.rnd;
  for (let i = 0; i < n; i++) {
    const a = R() * TAU;
    const r = R() * (o.spread ?? 8);
    sp.add({
      x: Math.round(at.x + Math.cos(a) * r),
      y: Math.round(at.y + Math.sin(a) * r * 0.4),
      vx: Math.cos(a) * (10 + R() * 18) + (o.push?.x ?? 0),
      vy: -(4 + R() * 10) + (o.push?.y ?? 0),
      drag: 2.2,
      life: 380 + R() * 260,
      colors: DUST,
      shape: 'puff',
      size: 2 + R() * 1.5,
      grow: 4,
      alpha: 0.75,
      delay: R() * 50,
    });
  }
  sp.release();
}

/** Grit / hair specks flung downwind (`d`), whole pixels, falling a little. */
function gritSpray(sc: Phaser.Scene, at: XY, d: XY, n: number, rnd: () => number, o: { speed?: number; depth?: number; hair?: number } = {}): void {
  const sp = new Sparks(sc, o.depth ?? DEPTH.FX);
  const v = o.speed ?? 120;
  for (let i = 0; i < n; i++) {
    const hair = i < (o.hair ?? Math.ceil(n / 3));
    const s = v * (0.6 + rnd() * 0.7);
    sp.add({
      x: Math.round(at.x + (rnd() - 0.5) * 6),
      y: Math.round(at.y + (rnd() - 0.5) * 8),
      vx: d.x * s + (rnd() - 0.5) * 20,
      vy: d.y * s + (rnd() - 0.5) * 16 - 6,
      ay: 40,
      drag: 1.4,
      life: 280 + rnd() * 260,
      colors: hair ? [PAL.earth4, PAL.earth3, PAL.earth2] : [PAL.stone3, PAL.stone2, PAL.stone1],
      shape: hair ? 'streak' : 'px',
      len: hair ? 3 : undefined,
      fadeAt: 1,
    });
  }
  sp.release();
}

// ================================================================ the gale (a moving band of hair ribbons + grey dust)

interface Rib {
  /** along the travel axis from the band's centre (px), across (0 = floor … h), length, speed factor, phase, tone */
  a: number;
  h: number;
  len: number;
  k: number;
  ph: number;
  tone: number;
}

interface Gale {
  /** Move the band's centre (floor point). */
  at(p: XY): void;
  /** 0..1 how much of the band shows (grows / dies in whole steps). */
  amount(k: number): void;
  /** Split the band around a point (two plumes) — 0 none … 1 fully split. */
  split(k: number, around?: XY): void;
  /** 0…1 a gust swell: the billows and ribbons grow (the front's stepped pulses). */
  swell(k: number): void;
  readonly centre: XY;
  destroy(): void;
}

/**
 * A low gale band travelling along `dir` (screen): a stepped bank of grey dust billows behind (depth `back`) and
 * horsehair ribbons streaming through it in front (depth `front`), `w` px long, `h` px tall, rolling on its own
 * clock. Whole pixels; it never makes a full-width band (it is clipped to ±w/2 of its centre).
 */
function gale(sc: Phaser.Scene, o: { at: XY; dir: XY; w: number; h: number; back: number; front: number; seed: number; ribbons?: number; billows?: number; scale?: number }): Gale {
  const rnd = mulberry32(o.seed);
  const back = layer(sc, o.back);
  const front = layer(sc, o.front);
  const d = norm(o.dir);
  const ribs: Rib[] = [];
  const nR = o.ribbons ?? 9;
  for (let i = 0; i < nR; i++) ribs.push({ a: ((i + 0.5) / nR - 0.5) * o.w + (rnd() - 0.5) * 4, h: 4 + ((i * 7) % nR) / nR * (o.h - 8), len: 12 + rnd() * 8, k: 0.7 + rnd() * 0.7, ph: rnd() * TAU, tone: 1 + Math.floor(rnd() * 3) });
  const nB = o.billows ?? 7;
  // two rows of billows: a low bank on the floor and a higher, thinner crest
  const bil = Array.from({ length: nB }, (_, i) => ({ a: ((i + 0.5) / nB - 0.5) * o.w + (rnd() - 0.5) * 6, r: (i % 2 ? 4 : 6) + rnd() * 4, ph: rnd() * TAU, up: i % 2 ? 0.5 + rnd() * 0.5 : rnd() * 0.25 }));
  let c = { ...o.at };
  let amt = 1;
  let spl = 0;
  let sw = 0;
  const SC = o.scale ?? 1;
  let around: XY | null = null;
  let alive = true;
  const stop = onFrame(sc, (_dt, el) => {
    if (!alive) return false;
    back.clear();
    front.clear();
    if (amt <= 0) return true;
    const A = Math.floor(amt * 4) / 4;
    const half = (o.w / 2) * A;
    // billows: a rolling bank (each one rises and falls on its own phase, whole pixels)
    for (const b of bil) {
      if (Math.abs(b.a) > half) continue;
      const roll = Math.sin(el * 0.012 + b.ph);
      const r = b.r * SC * (1 + 0.35 * Math.round(sw * 3) / 3) * (0.85 + 0.15 * roll) * (0.6 + 0.4 * A);
      let x = c.x + d.x * b.a;
      let y = c.y + d.y * b.a - r * 0.5 - b.up * (o.h * 0.35) - Math.round(roll);
      if (spl > 0 && around) {
        const side = b.a * d.x >= 0 ? 1 : -1;
        y += side * spl * 10;
        x += -side * spl * 2;
      }
      billow(back, Math.round(x), Math.round(y), r, b.up > 0.4);
    }
    // ribbons: streaming along the band, wrapping inside it
    for (const r of ribs) {
      const span = o.w;
      let a = r.a + ((el * 0.16 * r.k) % span);
      if (a > span / 2) a -= span;
      if (Math.abs(a) > half) continue;
      let x = c.x + d.x * a;
      let y = c.y + d.y * a - r.h;
      if (spl > 0 && around) {
        const side = r.h > o.h / 2 ? -1 : 1;
        y += side * spl * 12;
      }
      ribbon(front, { x: Math.round(x), y: Math.round(y) }, { x: -d.x, y: -d.y }, r.len * (0.6 + 0.4 * A) * (1 + 0.4 * sw), r.ph + el * 0.02, 1.2, r.tone);
    }
    return true;
  });
  return {
    get centre() {
      return c;
    },
    at(p) {
      c = { x: p.x, y: p.y };
    },
    amount(k) {
      amt = k;
    },
    swell(k) {
      sw = Math.max(0, Math.min(1, k));
    },
    split(k, p) {
      spl = k;
      around = p ?? around;
    },
    destroy() {
      if (!alive) return;
      alive = false;
      stop();
      back.g.destroy();
      front.g.destroy();
    },
  };
}

// ================================================================ the storm aura (setAura 'fsStorm')

interface Storm {
  readonly level: number;
  /** calm() was asked: it is dying. */
  readonly calming: boolean;
  /** 1 brew, 2 storm, 3 the dust devil (during the storm strike). */
  setLevel(n: 1 | 2 | 3): void;
  /** Wind dies: the specks fall to the floor, the tail drifts off, then the aura is gone (destroys itself). */
  calm(o?: { freeze?: boolean }): void;
  destroy(): void;
}

/**
 * Round 3 #8: knights with a neighbour in the lane behind them (downwind, within a tile column): their storm tail
 * and wind streaks are clipped so the stream never crosses the neighbour's body (updated by the aura observer).
 */
const CROWDED = new Set<Uid>();

/** Is a monster standing in the lane right behind (downwind of) the knight at `p`/`zone` in `s`? */
function crowdedIn(s: GameState, p: PlayerId, zone: number): boolean {
  const me = zoneXY(p, 'monster', zone);
  const dw = p === 0 ? -1 : 1;
  for (const z of [zone - 1, zone + 1]) {
    if (z < 0 || z >= s.players[p].monsters.length || !s.players[p].monsters[z]) continue;
    const o = zoneXY(p, 'monster', z);
    const dx = (o.x - me.x) * dw;
    if (dx > 0 && dx < 80) return true;
  }
  return false;
}

function stormAura(sc: Phaser.Scene, u: MonsterUnit, level: 1 | 2 | 3): Storm {
  const s = u.sprite;
  const back = layer(sc, s.depth - 0.5);
  const front = layer(sc, s.depth + 0.5);
  const rnd = mulberry32(u.uid * 31 + 7);
  let lvl: number = level;
  let calmAt = -1;
  let frozen = false;
  let alive = true;
  let pool: LightHandle | null = null;
  const N = 12;
  const specks = Array.from({ length: N }, (_, i) => ({ a0: (i / N) * TAU + rnd() * 0.3, h: rnd(), c: i % 3 === 0 ? PAL.mist : i % 3 === 1 ? PAL.steel : PAL.stone3, big: i % 2 === 0 }));
  const streaks: { y: number; x: number; len: number; born: number }[] = [];
  let nextStreak = 0;
  let calmFrom: { x: number; y: number }[] = [];
  const kill = () => {
    if (!alive) return;
    alive = false;
    stop();
    back.g.destroy();
    front.g.destroy();
    const p = pool;
    pool = null;
    if (p && p.alive) void p.fadeOut(200);
  };
  let lastEl = 0;
  const stop = onFrame(sc, (dt, el) => {
    lastEl = el;
    if (!alive) return false;
    if (!s.active || u.retired) {
      kill();
      return false;
    }
    back.g.setDepth(s.depth - 0.5);
    front.g.setDepth(s.depth + 0.5);
    back.clear();
    front.clear();
    if (!s.visible) return true;
    const feet = feetOf(u);
    const dw = u.flipX ? 1 : -1; // downwind (behind him)
    // the pool on his tile (storm only)
    if (lvl >= 2 && calmAt < 0 && !pool) pool = lightPool(sc, u.home.x, u.home.y, { color: PAL.gold3, radius: 21, floorY: u.home.y, intensity: 0.55, anim: 'breathe', fadeIn: 200 });
    if ((lvl < 2 || calmAt >= 0) && pool) {
      const p = pool;
      pool = null;
      if (p.alive) void p.fadeOut(220);
    }
    // ---- specks circling the tile (behind on the far half, in front on the near half)
    const n = lvl >= 2 ? 12 : 6;
    const rx = lvl >= 3 ? 12 : lvl >= 2 ? 18 : 22;
    const period = lvl >= 3 ? 520 : lvl >= 2 ? 900 : 1600;
    if (calmAt < 0) calmFrom = [];
    for (let i = 0; i < n; i++) {
      const q = specks[(i * (12 / n)) | 0];
      const a = q.a0 + (frozen ? 0 : (el / period) * TAU);
      let x = feet.x + Math.cos(a) * rx;
      let y = feet.y - 2 + Math.sin(a) * rx * 0.45 - (lvl >= 3 ? 2 + q.h * 22 : lvl >= 2 ? q.h * 6 : q.h * 3);
      if (calmAt >= 0) {
        // the wind dies: the specks fall to the floor in three steps and lie there, then go out
        const k = Math.min(3, Math.floor((el - calmAt) / 90));
        if (!calmFrom[i]) calmFrom[i] = { x, y };
        x = calmFrom[i].x;
        const floorY = feet.y - 1 + Math.sin(q.a0) * 3;
        y = calmFrom[i].y + (floorY - calmFrom[i].y) * (k / 3);
        if (el - calmAt > 420 && (i + Math.floor((el - calmAt) / 60)) % 2 === 0) continue;
      }
      const L = Math.sin(a) < 0 ? back : front;
      L.dot(Math.round(x), Math.round(y), q.c);
      if (q.big) L.dot(Math.round(x) - Math.sign(Math.cos(a)) , Math.round(y), PAL.stone2);
    }
    // ---- the dust devil (storm strike): three whirling dashed bands stacked knee-high, tighter going up
    if (lvl >= 3 && calmAt < 0) {
      const rot = Math.floor(el / 40);
      for (let b = 0; b < 3; b++) {
        const R = 15 - b * 3;
        const hy = feet.y - 2 - b * 7;
        const tone = b === 0 ? PAL.stone2 : b === 1 ? PAL.stone3 : PAL.mist;
        for (let j = 0; j < 24; j++) {
          if ((j + rot * (b + 1)) % 6 >= 3) continue;
          const a = (j / 24) * TAU;
          const x = Math.round(feet.x + Math.cos(a) * R);
          const y = Math.round(hy + Math.sin(a) * R * 0.4);
          (Math.sin(a) < 0 ? back : front).dot(x, y, tone);
        }
      }
    }
    // ---- the storm tail: strands extending the mane tip downwind (storm only), rippling
    // round 3 #3: the calm RETRACTS it in three stepped lengths (≈ 120 ms each) while the taut strands droop
    // round 3 #8: a neighbour in the lane behind him clips the tail to his own tile column
    if (lvl >= 2 && (calmAt < 0 || el - calmAt < 360)) {
      const tip = pointNow(u, 'staff', { x: feet.x + dw * 28, y: feet.y - 70 });
      const step = calmAt >= 0 ? Math.min(2, Math.floor((el - calmAt) / 120)) + 1 : 0; // 0 taut, 1–3 retracting
      const keep = step === 0 ? 1 : step === 1 ? 0.7 : step === 2 ? 0.45 : 0.22;
      const clip = CROWDED.has(u.uid) ? 0.55 : 1;
      // round 2 #4: a long, taut stepped tail — the +500 is readable at 1× (four 2-px strands, 22 → 13 px)
      for (let k = 0; k < 4; k++) {
        if (step >= 2 && k === 3) continue;
        const len = Math.max(3, Math.round(((lvl >= 3 ? 26 : 22) - k * 3) * keep * clip));
        const droop = step * 0.22;
        ribbon(back, { x: tip.x + dw * (1 + (k % 2)), y: tip.y - 2 + k * 2 + step }, norm({ x: dw, y: droop }), len, el * (step ? 0.012 : 0.03) + k * 1.7, step ? 0.4 : 0.8, Math.max(0, 3 - (k % 3) - (step >= 2 ? 1 : 0)));
      }
    }
    // ---- wind streaks behind him (storm only)
    if (lvl >= 2 && calmAt < 0 && !frozen) {
      if (el >= nextStreak) {
        // round 2 #4: ≈ 3.5 wind streaks a second blow THROUGH his tile, front to back
        nextStreak = el + 280;
        const cl = CROWDED.has(u.uid);
        streaks.push({ y: feet.y - 6 - Math.floor(rnd() * 56), x: feet.x - dw * 26, len: (cl ? 6 : 10) + Math.floor(rnd() * (cl ? 4 : 7)), born: el });
      }
    }
    for (let i = streaks.length - 1; i >= 0; i--) {
      const k = streaks[i];
      const age = el - k.born;
      if (age > (CROWDED.has(u.uid) ? 300 : 460) || calmAt >= 0) {
        streaks.splice(i, 1);
        continue;
      }
      const x0 = Math.round(k.x + dw * age * 0.15);
      const L = back;
      L.line(x0, k.y, x0 + dw * k.len, k.y, age < 160 ? PAL.mist : age < 320 ? PAL.stone3 : PAL.stone2);
      L.line(x0 + dw * (k.len - 3), k.y + 1, x0 + dw * k.len, k.y + 1, PAL.stone2);
    }
    if (calmAt >= 0 && el - calmAt > 560) {
      kill();
      return false;
    }
    void dt;
    return true;
  });
  return {
    get level() {
      return lvl;
    },
    setLevel(n) {
      if (calmAt >= 0) return;
      lvl = n;
    },
    get calming() {
      return calmAt >= 0;
    },
    calm(o = {}) {
      if (calmAt >= 0) return;
      frozen = !!o.freeze;
      calmAt = lastEl;
    },
    destroy: kill,
  };
}

function stormOf(u: MonsterUnit | null | undefined): Storm | null {
  if (!u) return null;
  return (u.aura(AURA) as unknown as Storm | null) ?? null;
}

/** Set the knight's aura to `lvl` (0: calm it down). */
function setStorm(sc: Phaser.Scene, u: MonsterUnit, lvl: 0 | 1 | 2 | 3, o: { freeze?: boolean } = {}): void {
  const cur = stormOf(u);
  if (lvl === 0) {
    if (cur) cur.calm(o);
    return;
  }
  if (cur && !cur.calming) {
    cur.setLevel(lvl);
    return;
  }
  u.setAura(AURA, stormAura(sc, u, lvl));
}

/** Seconds → scene wait in a cinematic context. */
const waitMs = (sc: Phaser.Scene, ms: number): Promise<void> => sleep(sc, ms);

/** Wait for `p`, at most `ms` (scene time). */
function capped(sc: Phaser.Scene, p: Promise<unknown>, ms: number): Promise<void> {
  return Promise.race([p.then(() => undefined, () => undefined), sleep(sc, ms)]);
}

/** Resolve when the unit shows `anim` frame ≥ f (or it left the anim / at most `max` ms). */
function untilShown(u: MonsterUnit, anim: AnyMonsterAnim, f: number, max = 3000): Promise<void> {
  return new Promise<void>((resolve) => {
    let done = false;
    const fin = () => {
      if (done) return;
      done = true;
      resolve();
    };
    atFrame(u, anim, f, fin, { maxMs: max });
    void sleep(u.scene, max).then(fin);
  });
}

// ================================================================ tribute: the gale scours the tributes

if (LOOK_V3)
  registerCardHook(
    ID,
    'tribute',
    async (ctx) => {
      const ev = ctx.ev;
      const sc = ctx.scene;
      // where the knight will stand (the summon of this group)
      const si = ctx.find((e) => e.type === 'summon' && e.uid === ev.forUid);
      const sEv = si >= 0 ? (ctx.events[si] as EvOf<'summon'>) : null;
      if (!sEv || sEv.from !== 'hand') return ctx.base();
      const to = zoneXY(sEv.player, 'monster', sEv.zone);
      const fwd = forwardOf(sEv.player, sEv.zone);
      const uids = [ev.uid];
      for (let i = ctx.index + 1; i < ctx.events.length; i++) {
        const e = ctx.events[i];
        if (e.type === 'tribute' && e.forUid === ev.forUid) uids.push(e.uid);
        else if (e.type !== 'toGraveyard' && e.type !== 'destroy') break;
      }
      const rnd = mulberry32(ev.forUid * 13 + 5);
      // a gust runs over each tribute toward the knight's tile: ribbons tear across the body, grey dust lifts
      uids.forEach((uid, i) => {
        const u = ctx.unit(uid);
        const from = u ? { ...u.home } : null;
        if (!from) return;
        const dir = norm({ x: to.x - from.x || -fwd.x, y: to.y - from.y || -fwd.y });
        const g = gale(sc, { at: { x: from.x - dir.x * 30, y: from.y - dir.y * 30 }, dir, w: 44, h: 34, back: unitDepth(from.y) - 0.6, front: unitDepth(from.y) + 0.6, seed: uid * 7 + 3, ribbons: 5, billows: 7 });
        g.amount(0.25);
        void (async () => {
          await sleep(sc, 40 + i * 90);
          await animate(sc, 520, (t) => {
            const k = E.inOutQ(t);
            g.at({ x: from.x - dir.x * 30 + dir.x * 70 * k, y: from.y - dir.y * 30 + dir.y * 70 * k });
            g.amount(t < 0.2 ? 0.25 + t * 3.5 : t > 0.8 ? (1 - t) * 5 : 1);
          });
          g.destroy();
        })();
        dustPuffs(sc, from, 6, { spread: 10, push: { x: dir.x * 30, y: dir.y * 10 }, rnd });
      });
      play(sEv.player === 0 ? 'wmkGaleFront' : 'wmkGaleFrontP2', { volume: 0.55, pan: panAt(to.x) * 0.5 });
      return ctx.base();
    },
    { priority: 20, name: `kart-f:${ID}:tribute` },
  );

// ================================================================ summon: out of the gale front

/**
 * Round 2 #2: while the shared cut-in band runs inside the summon, its four generic stingers are answered by the
 * knight's own kit (as tide_harpooner-fx cutinVoice): the band's whoosh → a gale gust built from the howl, the plate's
 * cardSlam → a deep plate clank with the helm ring, its impactHeavy layer dropped (the clank IS the slam), the exit's
 * summonBurst dropped (the UNFURL is the beat, played by galeEntrance on the same tick). Every other name passes
 * through. The global sfx.play is restored on the exit stinger, when `until` settles, or after `maxMs`.
 */
function knightCutinVoice(scene: Phaser.Scene, until: Promise<unknown>, maxMs = 1700): void {
  const orig = sfx.play;
  let done = false;
  const restore = () => {
    if (done) return;
    done = true;
    if (sfx.play === mine) sfx.play = orig;
  };
  const vol = (opts: Parameters<typeof sfx.play>[1], k: number) => Math.min(1, (opts?.volume ?? 1) * k);
  const mine: typeof sfx.play = (name, opts) => {
    switch (name) {
      case 'whoosh':
        return orig.call(sfx, 'wmkCutGust', { ...opts, pitch: 1, volume: vol(opts, 1) });
      case 'cardSlam':
        return orig.call(sfx, 'wmkCutClank', { ...opts, pitch: 1, volume: vol(opts, 1.4) });
      case 'impactHeavy':
        return;
      case 'summonBurst':
        restore();
        return;
      default:
        return orig.call(sfx, name, opts);
    }
  };
  sfx.play = mine;
  void until.then(restore, restore);
  const t = scene.time.delayedCall(maxMs, restore);
  scene.events.once('shutdown', () => {
    t.remove(false);
    restore();
  });
}


async function galeEntrance(S: Stage): Promise<void> {
  const sc = S.scene;
  const u = S.unit;
  const home = S.home;
  const rnd = mulberry32(u.uid * 31 + 11);
  const fwd = forwardOf(S.player, S.ev.zone);
  const down = { x: -fwd.x, y: -fwd.y };
  // the camera eases toward him as every ace entrance does (the same single lean the placeholder made; EF-8)
  if (S.big) void S.ctx.focus({ x: home.x, y: home.y - 30 }, { ms: 420, pan: 0.3 });
  // ---- the gale front: from the enemy side of his tile to his back (never a full-width band)
  const g = S.own(gale(sc, { at: { x: home.x + fwd.x * 60, y: home.y + fwd.y * 60 }, dir: down, w: 70, h: 34, back: S.depth - 0.6, front: S.depth + 0.6, seed: u.uid * 5 + 1, ribbons: 10, billows: 14, scale: 1.45 }));
  g.amount(0.25);
  const arrive = start(S.dir > 0 ? 'wmkGaleFront' : 'wmkGaleFrontP2', { volume: 0.9, pan: panAt(home.x) * 0.5 });
  const FRONT_MS = 760;
  const crossing = animate(sc, FRONT_MS, (t) => {
    const k = E.inOutQ(t);
    g.at({ x: home.x + fwd.x * (60 - 120 * k), y: home.y + fwd.y * (60 - 120 * k) });
    g.amount(t < 0.15 ? 0.25 + t * 5 : t > 0.82 ? Math.max(0, (1 - t) * 5.5) : 1);
    // round 2 #5: three stepped gust swells ≈ 0.3 s apart — the same rhythm as the sound's three swells
    const ms = t * FRONT_MS;
    const ph = ((ms - 20) % 300) / 300;
    g.swell(ms < 20 || ms > 900 ? 0 : ph < 0.35 ? ph / 0.35 : Math.max(0, 1 - (ph - 0.35) / 0.4));
  });
  // ---- inside it: the two gold eye-points kindle first (the body is still hidden)
  await S.wait(110);
  const eyesPx = layer(sc, S.depth + 0.7);
  const head = artPoint(u, 'summon', 0, 'head');
  const eye = head ? rint(u.framePoint(head.x, head.y)) : { x: home.x, y: home.y - 60 };
  void lightFlash(sc, eye.x, eye.y, PAL.gold4, 12, 260, { floorY: home.y, air: 1, intensity: 0.7 });
  const eyeRun = animate(sc, 170, (t) => {
    eyesPx.clear();
    const c = t < 0.35 ? PAL.gold3 : PAL.gold4;
    // two eye-points in the dust, each a gold core with a gold3 halo cross (lights: no outline)
    for (const ex of [eye.x, eye.x + S.dir * 3]) {
      if (t >= 0.35) eyesPx.dot(ex - 1, eye.y, PAL.gold2).dot(ex + 1, eye.y, PAL.gold2).dot(ex, eye.y - 1, PAL.gold2).dot(ex, eye.y + 1, PAL.gold2);
      eyesPx.dot(ex, eye.y, c);
    }
  }).then(() => eyesPx.g.destroy());
  await eyeRun;
  // ---- then the body steps out of the storm, already moving (a short palette-step onset)
  u.pose('summon', 0);
  u.showSprite();
  void holoOnset(sc, u, RAMPS.stone, 180);
  const walk = u.playRange('summon', 0, 9);
  atFrame(u, 'summon', 1, () => play('wmkStep', { volume: 0.6, pan: panAt(home.x) }), { late: false });
  atFrame(u, 'summon', 3, () => play('wmkStep', { volume: 0.7, pan: panAt(home.x) }), { late: false });
  // ---- land (f6): the lance butt is driven into the tile
  const landF = u.markFrame('summon', 'land', 6);
  let landed = false;
  atFrame(
    u,
    'summon',
    landF,
    () => {
      landed = true;
      play('wmkLancePlant', { volume: 0.95, pan: panAt(home.x) });
      arrive.stop(220);
      const butt = rint({ x: home.x + S.dir * 24, y: home.y });
      void dustRing(sc, butt, { r0: 3, r1: 18, ms: 300 });
      dustPuffs(sc, butt, 5, { spread: 4, rnd });
      void shake(sc, 120, 2);
      void lightFlash(sc, butt.x, butt.y, PAL.gold3, 20, 140, { floorY: home.y, intensity: 0.8 });
    },
    { late: true, maxMs: 2400 },
  );
  await crossing;
  g.destroy();
  // trailing grit blows past downwind and blinks out
  gritSpray(sc, { x: home.x + down.x * 26, y: home.y - 18 }, down, 12, rnd, { speed: 90, hair: 4 });
  await untilShown(u, 'summon', landF + 1, 1600);
  if (!landed) arrive.stop(160);
  // ---- the held breath: the cut-in band (mane gathered, eyes lit — summon f7–f9)
  if (S.cutIn) {
    const cut = S.climax();
    knightCutinVoice(sc, cut);
    await cut;
  } else await capped(sc, walk, 400);
  // ---- the UNFURL (f10): the mane whip-cracks out to full length, the pennon snaps taut — the finale
  const unfurl = u.playRange('summon', 10);
  fadeSnd(['summonBurst'], 40); // (no cut-in: nothing generic is left under the unfurl either)
  play('wmkManeUnfurl', { volume: 1, pan: panAt(home.x) });
  const mane = pointNow(u, 'staff', { x: home.x - S.dir * 30, y: home.y - 66 });
  gritSpray(sc, mane, { x: -S.dir, y: -0.1 }, 12, rnd, { speed: 150, hair: 6, depth: S.depth + 0.6 });
  const tip = pointNow(u, 'muzzle', { x: home.x + S.dir * 26, y: home.y - 70 });
  void lightFlash(sc, tip.x, tip.y, PAL.gold3, 14, 180, { floorY: home.y, air: 1, intensity: 0.6 });
  // round 2 #9: no generic finale ring — the unfurl's own hair spray and the grey dust ring carry the finale
  S.finale({ ring: 0, ramp: RAMPS.stone, freezeMs: S.big ? 40 : 0, sfx: null, playerRing: false });
  void dustRing(sc, home, { r0: 8, r1: 34, ms: 420 });
  // the brew starts (summon turn, a battle still to come): six grains of grey dust circling his tile
  const lvl = levelIn(S.ctx.stateNext, u.uid);
  if (lvl > 0) setStorm(sc, u, lvl);
  // round 3 #7: no battle this turn (turn 1) or his attack is locked — the wind dies before it rises: once the
  // unfurl has cracked, one soft gust, then the stream SAGS (three stepped droops) and a little dust drops off it
  const sn = S.ctx.stateNext;
  const at = slotOf(sn, u.uid);
  const never = !!at && at.slot.normalSummoned && at.slot.position === 'attack' && (sn.turn <= 1 || at.slot.noAttackTurn === sn.turn);
  if (never) {
    await capped(sc, unfurl, 420);
    await windDies(sc, u, rnd);
    return;
  }
  await capped(sc, unfurl, 420);
}

/** Round 3 #7: the gust that never becomes a storm — a soft breath, the stream droops to calm, dust falls. */
async function windDies(sc: Phaser.Scene, u: MonsterUnit, rnd: () => number): Promise<void> {
  if (!u.sprite.active) return;
  const pan = panAt(u.home.x);
  const dw = u.flipX ? 1 : -1;
  play('wmkCutGust', { volume: 0.32, pan, pitch: 0.8 });
  const px = layer(sc, u.sprite.depth - 0.5);
  let dust = false;
  await animate(sc, 420, (t) => {
    px.clear();
    if (t >= 1 || !u.sprite.active) return;
    const tip = pointNow(u, 'staff', { x: u.home.x + dw * 28, y: u.home.y - 70 });
    // 0–120 the soft gust lifts three strands off the tip; then three stepped droops, shorter each step
    const step = t < 0.28 ? 0 : t < 0.52 ? 1 : t < 0.76 ? 2 : 3;
    const len = [12, 9, 6, 3][step];
    for (let k = 0; k < 3; k++) ribbon(px, { x: tip.x + dw * (1 + (k % 2)), y: tip.y - 1 + k * 2 + step }, norm({ x: dw, y: -0.1 + step * 0.35 }), len - k, t * 4 + k * 1.3, step ? 0.3 : 0.7, Math.max(0, 2 - step + (k === 0 ? 1 : 0) - 1));
    if (step >= 1 && !dust) {
      dust = true;
      const sp = new Sparks(sc, u.sprite.depth + 0.4);
      for (let i = 0; i < 6; i++) sp.add({ x: tip.x + dw * Math.round(rnd() * 8), y: tip.y + Math.round(rnd() * 3), vx: (rnd() - 0.5) * 5, vy: 6 + rnd() * 8, ay: 200, life: 280 + rnd() * 140, colors: [PAL.stone3, PAL.stone2], shape: 'sq', size: 1, floor: u.home.y - 1, bounce: 0, fadeAt: 1 });
      sp.release();
    }
  });
  px.g.destroy();
}

if (LOOK_V3)
  registerCardHook(
    ID,
    'summon',
    async (ctx) => {
      if (ctx.ev.from !== 'hand') return ctx.base();
      await runSummon(ctx, async () => undefined, galeEntrance);
    },
    { priority: 20, name: `kart-f:${ID}:summon` },
  );

// ================================================================ "Fırtına Yükü" / "Fırtına diner" (the statChange)

/** A small gold chip ("+500 FIRTINA") rising off his badge; whole pixels, blinks out (no alpha ramp). */
function chip(sc: Phaser.Scene, at: XY, text: string, color: number, o: { rise?: number; ms?: number } = {}): Promise<void> {
  const t = pixelText(sc, at.x, at.y, text, { size: 'sm', color, outline: true, align: 'center', originX: 0.5, originY: 1, shadow: 0 });
  t.setDepth(DEPTH.FX_TOP + 40);
  const ms = o.ms ?? 640;
  const rise = o.rise ?? 4;
  return animate(sc, ms, (k) => {
    if (!t.active) return;
    t.setPosition(Math.round(at.x), Math.round(at.y - 6 * E.outBack(Math.min(1, k * 4)) - rise * k));
    t.setVisible(k < 0.82 || Math.floor(k * 40) % 2 === 0);
  }).then(() => t.destroy());
}

/** The badge's world point (falls back over the head). */
function badgePoint(u: MonsterUnit): XY {
  const b = u.badge.image;
  if (b && b.active) return { x: Math.round(b.x - b.displayWidth * 0.22), y: Math.round(b.y - b.displayHeight / 2 - 1) };
  const t = u.worldPoint('top');
  return { x: Math.round(t.x), y: Math.round(t.y - 6) };
}

async function stormCharge(ctx: Ctx<'statChange'>, u: MonsterUnit): Promise<void> {
  const sc = ctx.scene;
  const ev = ctx.ev;
  const home = u.home;
  const pan = panAt(home.x);
  const rnd = mulberry32(u.uid * 17 + ctx.state.turn);
  const dw = u.flipX ? 1 : -1;
  setStorm(sc, u, 1);
  if (u.shownStats.atk !== ev.prevAtk) void u.setStats(ev.prevAtk, ev.prevDef, false);
  const hum = start('wmkStormCharge', { volume: 0.95, pan });
  // 0–160: the brew's ring contracts to his feet (stepped, grey)
  void dustRing(sc, home, { r0: 26, r1: 8, ms: 200, tones: [PAL.stone2, PAL.stone3, PAL.stone3, PAL.mist] });
  // round 3 #6: the gathering is trimmed (≈ 190 ms): a shorter breath before the roar, the spiral up to the
  // release played 1.2× — the release frame itself (the snap) keeps its own beat
  await sleep(sc, 60);
  u.posed = true;
  const relF = u.markFrame('roar', 'release', 4);
  const spiral = u.playRange('roar', 0, relF - 1, { timeScale: 1.2 });
  let rolled = false;
  const roll = () => {
    if (rolled) return;
    rolled = true;
    u.battleTint = false;
    void u.setStats(ev.atk, ev.def, true);
    void chip(sc, badgePoint(u), '+500 FIRTINA', PAL.gold4, { rise: 4, ms: 640 });
    play('wmkStormTick', { volume: 0.8, pan });
  };
  await capped(sc, spiral, 1400);
  const roar = u.playRange('roar', relF);
  // release: the mane SNAPS into a taut blade — a gust bursts downwind off it, the gold pool on his tile only
  play('wmkBladeTaut', { volume: 1, pan });
  setStorm(sc, u, 2);
  const mane = pointNow(u, 'staff', { x: home.x + dw * 30, y: home.y - 70 });
  const gust = layer(sc, u.sprite.depth - 0.6);
  const gustRun = animate(sc, 260, (t) => {
    gust.clear();
    if (t >= 1) return;
    const step = Math.floor(t * 5);
    for (let k = 0; k < 4; k++) ribbon(gust, { x: mane.x + dw * (4 + step * 6 + k * 2), y: mane.y - 4 + k * 3 }, { x: dw, y: 0 }, 10 - k, t * 9 + k, 0.8, 3 - (k % 3));
  }).then(() => gust.g.destroy());
  gritSpray(sc, mane, { x: dw, y: 0 }, 10, rnd, { speed: 160, hair: 5, depth: u.sprite.depth + 0.6 });
  void lightFlash(sc, home.x, home.y, PAL.gold3, 24, 180, { floorY: home.y, intensity: 0.85 });
  const eyeP = pointNow(u, 'head', u.worldPoint('top'));
  void lightFlash(sc, eyeP.x, eyeP.y, PAL.gold4, 10, 200, { floorY: home.y, air: 1, intensity: 0.7 });
  void shake(sc, 120, 1);
  await sleep(sc, 60);
  roll();
  // the low "VUMM" sits inside the charge; it lets go 100 ms after the roll
  void sleep(sc, 100).then(() => hum.stop(200));
  await gustRun;
  await capped(sc, roar, 900);
  roll();
  u.posed = false;
}

/**
 * "Fırtına diner" (round 3 #3: the mirror of the charge). The plate is HELD on the storm number (the end phase's sync
 * may already have snapped it), the storm tail retracts in three stepped lengths and droops (the aura's calm), a short
 * fall of grey dust drops off the mane — only then the badge ROLLS down on the beat with
 * a readable "-500 DİNDİ" chip (mist on ink, a calm, not a loss).
 */
async function stormSettle(ctx: Ctx<'statChange'>, u: MonsterUnit): Promise<void> {
  const sc = ctx.scene;
  const ev = ctx.ev;
  const pan = panAt(u.home.x);
  const rnd = mulberry32(u.uid * 19 + ctx.state.turn);
  let holding = true;
  const hold = () => {
    if (holding && u.sprite.active && u.shownStats.atk !== ev.prevAtk) void u.setStats(ev.prevAtk, ev.prevDef, false);
  };
  hold();
  onFrame(sc, () => {
    if (!holding) return false;
    hold();
    return true;
  });
  play('wmkStormSettle', { volume: 0.85, pan });
  setStorm(sc, u, 0);
  // the dust that rode the gale falls off the mane: grey specks dropping straight down (no wind left)
  const mane = pointNow(u, 'staff', { x: u.home.x + (u.flipX ? 30 : -30), y: u.home.y - 66 });
  const head = pointNow(u, 'head', u.worldPoint('top'));
  const sp = new Sparks(sc, u.sprite.depth + 0.4);
  for (let i = 0; i < 9; i++) {
    const x = Math.round(mane.x + (head.x - mane.x) * (i / 9) + (rnd() - 0.5) * 4);
    sp.add({ x, y: mane.y + Math.round(rnd() * 4), vx: (rnd() - 0.5) * 6, vy: 4 + rnd() * 10, ay: 220, life: 300 + rnd() * 160, colors: [PAL.mist, PAL.stone3, PAL.stone2], shape: 'sq', size: 1, floor: u.home.y - 1, bounce: 0, fadeAt: 1 });
  }
  sp.release();
  // the beat: the tail has visibly retracted, now the plate rolls down
  await sleep(sc, 240);
  holding = false;
  void u.setStats(ev.atk, ev.def, true);
  play('wmkStormTick', { volume: 0.4, pan, pitch: 0.8 });
  await chip(sc, badgePoint(u), '-500 DİNDİ', PAL.mist, { rise: -3, ms: 600 });
}

if (LOOK_V3)
  registerCardHook(
    ID,
    'statChange',
    async (ctx) => {
      const ev = ctx.ev;
      const u = ctx.unit(ev.uid);
      if (!u || u.retired || !u.sprite.active || !u.sprite.visible) return ctx.base();
      // the +500 itself (engine/query summonTurnBonus), never the raw ATK number
      const onNext = stormOn(ctx.stateNext, ev.uid);
      const up = onNext && ev.atk - ev.prevAtk >= 500 && ev.def === ev.prevDef;
      const at = slotOf(ctx.stateNext, ev.uid);
      const summonTurn = !!at && !!at.slot.normalSummoned && at.slot.enteredTurn === ctx.stateNext.turn;
      const down = !onNext && summonTurn && ev.prevAtk - ev.atk >= 500 && ev.def === ev.prevDef && ctx.stateNext.phase !== 'battle';
      if (up) return stormCharge(ctx, u);
      if (down) return stormSettle(ctx, u);
      if (onNext) u.battleTint = false;
      return ctx.base();
    },
    { priority: 20, name: `kart-f:${ID}:statChange` },
  );

// ================================================================ the declaration (storm on: the storm charge)

/** The storm strike's held charge (started at the declaration; the strike takes it). */
const STORM_CHARGE = new Map<Uid, { stop(ms?: number): void }>();

/** Knights whose storm declaration is pending (declared, the strike has not taken the charge yet). */
const STORM_DECL = new Set<Uid>();

/**
 * Round 3 #2: the declaration let go without the storm strike (a trap negated / bounced / destroyed him, the phase
 * ended, the scene shut down): the storm voice fades like the shared held charge does (declare.ts dropCharge), and
 * the dust devil (aura level 3) falls back to the storm (or whatever the state now asks for).
 */
function cutStormCharge(ctx: AnyCtx | null, ms = 140): void {
  for (const uid of [...STORM_DECL, ...STORM_CHARGE.keys()]) {
    STORM_CHARGE.get(uid)?.stop(ms);
    STORM_CHARGE.delete(uid);
    STORM_DECL.delete(uid);
    const u = ctx?.unit(uid);
    const st = stormOf(u);
    if (ctx && u && st && !st.calming && st.level >= 3) {
      const want = levelIn(ctx.stateNext, uid);
      if (want === 1 || want === 2) st.setLevel(want);
      else setStorm(ctx.scene, u, 0);
    }
  }
}

if (LOOK_V3)
  registerObserver((ev, ctx) => {
    if (!STORM_DECL.size && !STORM_CHARGE.size) return;
    const t = ev.type;
    const uid = (ev as { uid?: Uid }).uid;
    const mine = uid !== undefined && (STORM_DECL.has(uid) || STORM_CHARGE.has(uid));
    if (t === 'activate' || t === 'attackNegated' || t === 'phaseChange' || t === 'turnStart' || t === 'gameOver' || (mine && (t === 'destroy' || t === 'toHand' || t === 'controlChange' || t === 'positionChange' || t === 'flip')))
      cutStormCharge(ctx);
  });

if (LOOK_V3)
  registerCardHook(
    ID,
    'attackDeclare',
    async (ctx) => {
      const ev = ctx.ev;
      const storm = stormOn(ctx.state, ev.attackerUid);
      const u = ctx.unit(ev.attackerUid);
      const p = ctx.base();
      if (storm && u) {
        setStorm(ctx.scene, u, 3);
        STORM_DECL.add(u.uid);
        ctx.scene.events.once('shutdown', () => cutStormCharge(null, 0));
        // the charge pose is on screen: the storm charge takes the normal one over
        atFrame(
          u,
          'attack',
          u.markFrame('attack', 'charge', 1),
          () => {
            // (a trap already sprang on the declaration: the storm voice never starts)
            if (!STORM_DECL.has(u.uid)) return;
            dropCharge(u, 60);
            STORM_CHARGE.get(u.uid)?.stop(60);
            STORM_CHARGE.set(u.uid, start('wmkChargeStorm', { volume: 0.9, pan: panAt(u.home.x) }));
            const h = pointNow(u, 'head', u.worldPoint('top'));
            void lightFlash(ctx.scene, h.x, h.y, PAL.gold4, 10, 160, { floorY: u.home.y, air: 1, intensity: 0.6 });
          },
          { maxMs: 800 },
        );
      }
      await p;
    },
    { priority: 20, name: `kart-f:${ID}:declare` },
  );

// ================================================================ strikes

/** Two heavy steps over `ms` from `a` to `b` (a dust puff on each footfall). */
function stride(u: MonsterUnit, a: XY, b: XY, ms: number, rnd: () => number, o: { steps?: number; glide?: number; sound?: boolean; onT?: (t: number) => void } = {}): Promise<void> {
  const sc = u.scene;
  const steps = o.steps ?? 2;
  let next = 1;
  return animate(sc, ms, (t) => {
    const k = E.inOutQ(t);
    const lift = o.glide ? o.glide * Math.sin(Math.PI * t) : 0;
    const p = { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
    setFeet(u, { x: p.x, y: p.y - lift });
    o.onT?.(t);
    if (!o.glide && next <= steps && t >= next / (steps + 0.4)) {
      next++;
      const f = feetOf(u);
      dustPuffs(sc, { x: f.x, y: f.y }, 3, { spread: 3, rnd });
      if (o.sound) play('wmkStep', { volume: 0.55, pan: panAt(f.x) });
    }
  }).then(() => setFeet(u, b));
}

/** The mane's lash over the target's head ("ŞAK"): a 2-frame crescent of hair + a white whip tip. */
function lash(sc: Phaser.Scene, at: XY, dir: number, depth: number): Promise<void> {
  const px = layer(sc, depth);
  return animate(sc, 110, (t) => {
    px.clear();
    if (t >= 1) return;
    const f = t < 0.5 ? 0 : 1;
    const R = 9 + f * 3;
    for (let i = 0; i <= 10; i++) {
      const a = -Math.PI * 0.9 + (i / 10) * Math.PI * 0.75;
      const x = Math.round(at.x + dir * Math.cos(a) * R);
      const y = Math.round(at.y + Math.sin(a) * R * 0.7);
      const c = i > 8 ? PAL.earth4 : i > 4 ? PAL.earth3 : PAL.earth2;
      px.dot(x, y, f ? HAIR[Math.max(0, HAIR.indexOf(c as never) - 1)] : c).dot(x, y + 1, PAL.earth1);
    }
    const tipA = -Math.PI * 0.15;
    const tx = Math.round(at.x + dir * Math.cos(tipA) * R);
    const ty = Math.round(at.y + Math.sin(tipA) * R * 0.7);
    if (!f) px.dot(tx, ty, PAL.white).dot(tx + dir, ty, PAL.mist).dot(tx, ty - 1, PAL.mist);
  }).then(() => px.g.destroy());
}

/** Steel sparks skidding along a guard (mist / white, short streaks), thrown back toward the attacker. */
function skidSparks(sc: Phaser.Scene, at: XY, back: XY, n: number, rnd: () => number): void {
  const sp = new Sparks(sc, DEPTH.FX + 2);
  for (let i = 0; i < n; i++) {
    const a = Math.atan2(back.y, back.x) + (rnd() - 0.5) * 1.6;
    const v = 70 + rnd() * 90;
    sp.add({ x: at.x, y: at.y + Math.round((rnd() - 0.5) * 8), vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, ay: 300, life: 160 + rnd() * 160, colors: [PAL.white, PAL.mist, PAL.steel], shape: 'streak', len: 3, fadeAt: 1 });
  }
  sp.release();
}

/** The gale boom: a pressure ring (white → mist → steel, whole steps) + a grey dust ring on the floor. */
function galeBoom(sc: Phaser.Scene, at: XY, floor: XY): Promise<void> {
  const px = layer(sc, DEPTH.FX + 3);
  void dustRing(sc, floor, { r0: 8, r1: 40, ms: 460 });
  const tones = [PAL.white, PAL.mist, PAL.steel, PAL.stone2];
  return animate(sc, 240, (t) => {
    px.clear();
    if (t >= 1) return;
    const k = Math.min(3, Math.floor(t * 4));
    const r = 8 + k * 9;
    px.ellipseRing(at.x, at.y, r, Math.round(r * 0.8), k < 2 ? 3 : 2, tones[k]);
    if (k >= 1) px.ellipseRing(at.x, at.y, r - 5, Math.round((r - 5) * 0.8), 1, tones[Math.min(3, k + 1)]);
  }).then(() => px.g.destroy());
}

/** Where the lance tip of `anim` frame `f` meets `aim`: the feet point for the strike (never past the target). */
function lungeFeet(u: MonsterUnit, anim: AnyMonsterAnim, f: number, aim: XY, inset: number): XY {
  const tip = artPoint(u, anim, f, 'muzzle') ?? u.art.muzzle;
  // contactFeet works on the 'attack' geometry by frame point: same frame size for every anim
  return rint(contactFeet(u, tip.x, tip.y, aim, inset));
}

/** A direct attack never crosses the board: the lunge stops `max` px out along its lane (the gale / blow carries on). */
function capReach(home: XY, goal: XY, max: number): XY {
  const dx = goal.x - home.x;
  const dy = goal.y - home.y;
  const L = Math.hypot(dx, dy);
  if (L <= max) return goal;
  return rint({ x: home.x + (dx / L) * max, y: home.y + (dy / L) * max });
}

/**
 * Round 3 #1: the clash point the battle handler gets when the knight LOSES. The handler treats an attacker within
 * 44 px of the clash as melee (_v3/clash isMelee): it then claims him where he stands and plays the counter + the
 * death from the contact pose. The lance tip reaches ≈ 49 px from his core, so the handler took him for a ranged
 * attacker (a jagged backlash line, no claim — the strike then walked him home). The point slides back along the
 * shaft to 42 px: still inside the target (the tip is set 3 px into its core), now a melee clash.
 */
function meleeClash(u: MonsterUnit, tip: XY): XY {
  const c = u.core();
  const dx = tip.x - c.x;
  const dy = tip.y - c.y;
  const L = Math.hypot(dx, dy);
  if (L <= 42) return tip;
  return rint({ x: c.x + (dx / L) * 42, y: c.y + (dy / L) * 42 });
}

/** The point the lance meets: the target's core, else (direct) the floor point in front of the duelist. */
function aimOf(s: StrikeArgs): XY {
  if (s.direct || !s.target || !s.target.sprite.active) return { x: s.to.x, y: s.to.y };
  return s.target.core();
}

/** "Kargı Hamlesi": couch, lunge (two steps), thrust, the lash, home. */
async function lanceStrike(s: StrikeArgs): Promise<void> {
  const u = s.attacker;
  const sc = s.scene;
  const rnd = mulberry32(u.uid * 97 + (s.target?.uid ?? 3));
  const pan = panAt(u.home.x);
  const charge = takeCharge(u, 'wmkCharge', { volume: 0.85, pan });
  const home = { ...u.home };
  const dir = u.flipX ? -1 : 1;
  const relF = u.markFrame('attack', 'release', 5);
  const conF = u.markFrame('attack', 'contact', 6);
  const held = strikeStartFrame(u);
  const f0 = held > 0 ? Math.min(held + 1, relF) : 0;
  const loses = s.ctx.ev.result === 'attackerDestroyed' || s.ctx.ev.result === 'bothDestroyed';
  const aim = aimOf(s);
  const goal0 = lungeFeet(u, 'attack', conF, aim, s.direct ? 10 : s.blocked ? 7 : 3);
  const goal = s.direct ? capReach(home, goal0, 48) : goal0;
  // round 3 #4: a close target (the next tile in the lane) would already have the couched tip on its face before
  // the lunge — he takes a weight-back step during the couch instead, so a clear gap shows and the lunge closes it
  // on the contact frame
  const fwd = fwdOfUnit(u);
  const tipCouch = artPoint(u, 'attack', relF, 'muzzle');
  const tipW = tipCouch ? u.framePoint(tipCouch.x, tipCouch.y) : null;
  const gap = tipW && !s.direct ? (aim.x - tipW.x) * dir : 99;
  const backPx = gap < 20 ? Math.min(12, Math.ceil((20 - gap) / Math.max(0.5, Math.abs(fwd.x)))) : 0;
  const couchAt = rint({ x: home.x - fwd.x * backPx, y: home.y - fwd.y * backPx });
  let lost = false;
  u.posed = true;
  try {
    // ---- the couch (the frames after the declaration's charge pose), the weight shifts forward
    const couch = u.playRange('attack', f0, relF, { timeScale: 1.6 });
    if (backPx > 0) {
      // two stepped shifts back (whole pixels), a scuff of dust under the planted foot
      const cms = Math.max(120, u.rangeMs('attack', f0, relF) / 1.6);
      await animate(sc, cms * 0.6, (t) => {
        const k = t < 0.5 ? 0.5 : 1;
        setFeet(u, { x: home.x + (couchAt.x - home.x) * k, y: home.y + (couchAt.y - home.y) * k });
      });
      dustPuffs(sc, couchAt, 2, { spread: 3, push: { x: -fwd.x * 10, y: -fwd.y * 4 }, rnd });
    }
    await couch;
    if (!u.sprite.active) return;
    // ---- release: the lunge — two heavy steps, a short mane smear behind
    charge.stop(60);
    play('wmkLunge', { volume: 0.9, pan });
    await stride(u, couchAt, goal, backPx > 0 ? 240 : 220, rnd, { steps: 2 });
    // ---- contact: the thrust
    u.pose('attack', conF);
    const tipNow = pointNow(u, 'muzzle', aim);
    s.impact(loses ? meleeClash(u, tipNow) : tipNow);
    play(s.blocked ? 'wmkBlocked' : 'wmkThrust', { volume: 1, pan: panAt(tipNow.x) });
    const floor = s.direct ? s.toGround : s.target ? s.target.home : s.toGround;
    if (s.blocked) {
      const back = { x: -dir, y: 0.4 * dir };
      skidSparks(sc, tipNow, back, 7, rnd);
    } else dustPuffs(sc, { x: tipNow.x, y: floor.y }, 4, { spread: 6, rnd });
    if (loses) {
      // round 3 #1: he stays where the blow met him — the handler claims him there and the death follows its counter
      lost = true;
      await sleep(sc, 34);
      return;
    }
    const rest = u.playRange('attack', conF, undefined, { hold: true });
    // ---- f7: the double hit — the mane lashes the target's head
    await untilShown(u, 'attack', conF + 1, 400);
    const head = s.target && s.target.sprite.active && !s.direct ? s.target.worldPoint('top') : { x: aim.x, y: aim.y - 14 };
    void lash(sc, { x: Math.round(head.x - dir * 2), y: Math.round(head.y + 6) }, dir, DEPTH.FX + 4);
    play('wmkLash', { volume: 0.85, pan: panAt(head.x) });
    // blocked: shoved back off the guard (6 px)
    if (s.blocked) {
      const f = feetOf(u);
      await animate(sc, 90, (t) => setFeet(u, { x: f.x - dir * 6 * E.outQ(t), y: f.y + 3 * E.outQ(t) * dir }));
    }
    // ---- f8–f9: he pulls the lance back; then two steps home
    await untilShown(u, 'attack', s.direct ? conF + 2 : conF + 3, 700);
    await stride(u, feetOf(u), home, s.direct ? 380 : 440, rnd, { steps: 2, sound: true });
    await capped(sc, rest, 500);
  } finally {
    charge.stop(80);
    u.posed = false;
    if (!lost && u.sprite.active && !u.retired && u.frameInfo().anim !== 'death') {
      setFeet(u, home);
      if (u.frameInfo().anim === 'attack') u.rest();
    }
  }
}

/** "Fırtına Hücumu": the rigid lance spin, the dust devil, the gale wall, the charging run, the gale boom. */
async function stormStrike(s: StrikeArgs): Promise<void> {
  const u = s.attacker;
  const sc = s.scene;
  const rnd = mulberry32(u.uid * 101 + (s.target?.uid ?? 5));
  const pan = panAt(u.home.x);
  dropCharge(u, 60);
  const charge = STORM_CHARGE.get(u.uid) ?? start('wmkChargeStorm', { volume: 0.9, pan });
  STORM_CHARGE.delete(u.uid);
  STORM_DECL.delete(u.uid);
  const home = { ...u.home };
  const dir = u.flipX ? -1 : 1;
  const fwd = fwdOfUnit(u);
  const relF = u.markFrame('special', 'release', 11);
  const conF = u.markFrame('special', 'contact', 12);
  // the charging-run loop: the four frames before the release (contact, down, passing, contact)
  const run0 = relF - 4;
  const low = run0 - 1;
  const loses = s.ctx.ev.result === 'attackerDestroyed' || s.ctx.ev.result === 'bothDestroyed';
  const aim = aimOf(s);
  const goal0 = lungeFeet(u, 'special', conF, aim, s.direct ? 12 : s.blocked ? 8 : 3);
  const goal = s.direct ? capReach(home, goal0, 64) : goal0;
  const storm = stormOf(u);
  storm?.setLevel(3);
  u.posed = true;
  let lost = false;
  let wall: Gale | null = null;
  try {
    // ---- f1–f5: the rigid lance spins about the grip (4 angles + the smear arc), the mane spirals up, the dust devil whirls
    const spin = s.direct ? 2 : 1; // direct: the anticipation spin is shortened (one angle fewer)
    await u.playRange('special', spin, low, { timeScale: 1.15 });
    if (!u.sprite.active) return;
    // ---- f6 (hold): the deep charge stance, the mane wrapped forward round the helm; the gale wall builds behind him
    const behind = (k: number): XY => {
      const f = feetOf(u);
      return { x: f.x - fwd.x * (16 - 12 * k), y: f.y - fwd.y * (16 - 12 * k) };
    };
    wall = gale(sc, { at: behind(0), dir: fwd, w: 60, h: 40, back: u.sprite.depth - 0.7, front: u.sprite.depth + 0.7, seed: u.uid * 3 + 9, ribbons: 9, billows: 12, scale: 1.5 });
    wall.amount(0.25);
    const w0 = wall;
    u.pose('special', low);
    await animate(sc, u.frameMs('special', low) + 120, (t) => {
      w0.amount(0.25 + 0.75 * Math.min(1, t * 1.6));
      w0.at(behind(0));
    });
    // ---- f7–f10 looped: the charging run — heavy strides (dust on each footfall), the plate bobbing, the mane taut;
    //      the wall rides behind him; f11 the release lean lands just before contact
    charge.stop(50);
    play('wmkStormRelease', { volume: 1, pan });
    const start0 = feetOf(u);
    let shown = -1;
    await stride(u, start0, goal, 300, rnd, {
      steps: 2,
      sound: true,
      onT: (t) => {
        w0.at(behind(Math.min(1, t * 1.4)));
        const f = t < 0.78 ? run0 + (Math.floor(t * 5.2) % 4) : relF;
        if (f !== shown) {
          shown = f;
          u.pose('special', f);
        }
      },
    });
    // ---- f7 contact: the gale BOOM; the wall overtakes him and blows past (or splits around the guard)
    u.pose('special', conF);
    const tipNow = pointNow(u, 'muzzle', aim);
    // round 2 #3: the gale boom IS the contact — the generic body blow is never stacked under it (a struck body with
    // its own material still sounds)
    hush(['impactHeavy', 'impactLight'], () => s.impact(loses ? meleeClash(u, tipNow) : tipNow));
    play(s.blocked ? 'wmkStormSplit' : 'wmkGaleBoom', { volume: 1, pan: panAt(tipNow.x) });
    void stopTime(sc, 30);
    void shake(sc, 180, s.blocked ? 2 : 4);
    const floor = s.direct ? s.toGround : s.target ? s.target.home : s.toGround;
    void galeBoom(sc, tipNow, floor);
    void lightFlash(sc, tipNow.x, tipNow.y, PAL.gold3, 26, 200, { floorY: floor.y, intensity: 0.7 });
    gritSpray(sc, tipNow, fwd, 14, rnd, { speed: 170, hair: 6 });
    // the wall: past the target downwind (300 ms) — on to the duelist (direct) — split around the guard (blocked)
    const from = { ...w0.centre };
    const passTo = s.direct ? s.toGround : { x: floor.x + fwd.x * 34, y: floor.y + fwd.y * 34 };
    void (async () => {
      await animate(sc, s.direct ? 360 : 300, (t) => {
        const k = E.outQ(t);
        w0.at({ x: from.x + (passTo.x - from.x) * k, y: from.y + (passTo.y - from.y) * k });
        // round 2 #3: the pressure front swells on contact and splits AROUND the target as it streams past
        w0.swell(t < 0.5 ? 1 : (1 - t) * 2);
        if (!s.direct) w0.split(Math.min(1, t * (s.blocked ? 2 : 2.6)), floor);
        w0.amount(t > 0.6 ? Math.max(0, (1 - t) * 2.5) : 1);
      });
      w0.destroy();
      if (s.direct) {
        // its last billow breaks on the duelist
        dustPuffs(sc, s.toGround, 8, { spread: 10, push: { x: fwd.x * 20, y: fwd.y * 10 }, rnd });
        gritSpray(sc, { x: s.toGround.x, y: s.toGround.y - 16 }, fwd, 10, rnd, { speed: 120 });
      }
    })();
    wall = null;
    if (s.blocked) skidSparks(sc, tipNow, { x: -dir, y: 0.3 * dir }, 8, rnd);
    storm?.setLevel(2);
    if (loses) {
      // round 3 #1: no trip home — the handler claims him at the contact point (counter, then the hollow armour)
      lost = true;
      await sleep(sc, 34);
      return;
    }
    const rest = u.playRange('special', conF, undefined, { hold: true });
    if (s.blocked) {
      const f = feetOf(u);
      await animate(sc, 110, (t) => setFeet(u, { x: f.x - dir * 8 * E.outQ(t), y: f.y + 4 * E.outQ(t) * dir }));
    }
    // ---- f8–f10: the storm detaches, he recovers upright; then home
    await untilShown(u, 'special', conF + 3, 800);
    await stride(u, feetOf(u), home, s.direct ? 420 : 480, rnd, { steps: 2, sound: true });
    await capped(sc, rest, 500);
  } finally {
    wall?.destroy();
    charge.stop(80);
    u.posed = false;
    if (stormOf(u) && !stormOf(u)!.calming && stormOn(s.ctx.stateNext, u.uid)) stormOf(u)!.setLevel(2);
    if (!lost && u.sprite.active && !u.retired && u.frameInfo().anim !== 'death') {
      setFeet(u, home);
      if (u.frameInfo().anim === 'special') u.rest();
    }
  }
}

if (LOOK_V3)
  registerStrike(
    ID,
    (s) => {
      // the storm strike only on the summon turn's battle (the +500 on, read from the engine)
      const storm = stormOn(s.ctx.state, s.attacker.uid) && s.attacker.has('special');
      return storm ? stormStrike(s) : lanceStrike(s);
    },
    { priority: 20, name: `kart-f:${ID}:strike` },
  );

// ================================================================ death "Kof Zırh" (option b: no shatter)

async function hollowArmour(ctx: Ctx<'destroy'>): Promise<void> {
  const ev = ctx.ev;
  const field = ctx.views.field;
  const unit = field.unit(ev.uid);
  if (!unit || unit.retired || !unit.sprite.active || !unit.sprite.visible || !unit.has('death')) return ctx.base();
  const sc = ctx.scene;
  const gi = ctx.findType('toGraveyard', (e) => e.uid === ev.uid, {
    until: (e) => e.type !== 'toGraveyard' && e.type !== 'destroy' && e.type !== 'fieldSpell' && e.type !== 'statChange',
  });
  const gEv = gi >= 0 ? (ctx.events[gi] as EvOf<'toGraveyard'>) : null;
  if (gi >= 0) ctx.consumeAt(gi);
  const owner = gEv ? gEv.owner : ctx.owner(ev.uid);
  const { tile } = field.release(ev.uid);
  const tileHome = tile ? { x: tile.home.x, y: tile.home.y } : zoneXY(ev.player, 'monster', ev.zone);
  // round 3 #1: a knight that lost his strike dies where the blow met him (the handler holds him there): the pile,
  // its dust and the card are born at his feet, not on the tile he left
  const at0 = feetOf(unit);
  const home = Math.hypot(at0.x - tileHome.x, at0.y - tileHome.y) > 2 ? at0 : tileHome;
  unit.badge.setVisible(false);
  unit.posed = true;
  const u = unit;
  const rnd = mulberry32(u.uid * 53 + 1);
  const pan = panAt(home.x);
  const onBorn = typeof ctx.hints.onBorn === 'function' ? (ctx.hints.onBorn as () => void) : null;
  let leave: Promise<void> | null = null;
  const born = () => {
    if (leave) return;
    try {
      onBorn?.();
    } catch (e) {
      console.error('[windmane] onBorn', e);
    }
    if (gEv) leave = cardLeaves(ctx, { owner, cardId: ev.cardId, from: home, tile, depthAt: behindBodies(ctx, u) }).catch((e) => console.error('[windmane] card', e));
    else if (tile && tile.active) leave = tile.dissolve(420).then(() => (tile.active ? tile.destroy() : undefined)).catch(() => undefined);
    else leave = Promise.resolve();
  };
  ctx.scene.events.emit('v3:dying', u);
  try {
    const n = u.frameCount('death');
    const inDeath = () => u.frameInfo().anim === 'death';
    if (ctx.hints.hit !== false) contactFlash(sc, u.sprite, (ctx.hints.push as XY | undefined) ?? { x: u.player === 0 ? -1 : 1, y: 0 }, { frames: 2, coverage: 0.4 });
    // join a lethal recoil that hands over to the pose by itself; a guard breaks open into it
    let planned = takePlannedEntry(u);
    if (!planned && !inDeath() && showsGuard(u)) {
      const g = planGuardBreak(u);
      if (g) {
        runGuardBreak(u, g);
        planned = takePlannedEntry(u);
      }
    }
    // round 3 #1: a knight killed at his own contact point shows a short recoil only (≤ 120 ms after the handler hands
    // him over) — the calm must follow the blow, not stand beside it
    const struckAway = home !== tileHome;
    if (planned && !inDeath()) await capped(sc, untilShown(u, 'death', 0, 700), Math.min(struckAway ? 120 : 700, (planned.leadMs ?? u.rangeMs(planned.anim, 0, planned.hold)) + 40));
    if (!inDeath() && u.sprite.active) {
      const st = Math.max(0, Math.min(n - 2, planned ? planned.start : deathStartFrom(u)));
      u.asClaimant(() => void u.playRange('death', st, undefined, { hold: true }));
    }
    // ---- the beats on their frames (the voice's death roles, played here: no shatter)
    const at = (f: number, cb: () => void) => atFrame(u, 'death', f, cb, { late: false, maxMs: 2400 });
    // (a lethal recoil may join the pose past f1: the calm is never skipped — late plays it at once)
    atFrame(u, 'death', 1, () => play('wmkCalmCut', { volume: 0.9, pan }), { late: true, maxMs: 2400 });
    // f2 the CALM: everything that always moved is still — the aura freezes and its dust falls
    atFrame(u, 'death', 2, () => setStorm(sc, u, 0, { freeze: true }), { late: true, maxMs: 2400 });
    at(3, () => play('wmkManeSnap', { volume: 0.9, pan }));
    at(4, () => play('wmkPlateFall', { volume: 0.95, pan }));
    at(5, () => {
      play('wmkPlateClank', { volume: 0.85, pan });
      // the rigid mane shatters FLAT behind him: comet shards skitter along the floor, no wind
      const back = u.flipX ? 1 : -1;
      const sp = new Sparks(sc, unitDepth(home.y) + 0.4);
      for (let i = 0; i < 7; i++) sp.add({ x: home.x + back * (12 + rnd() * 16), y: home.y - 1, vx: back * (20 + rnd() * 40), vy: -(10 + rnd() * 20), ay: 360, drag: 1.5, life: 380 + rnd() * 200, colors: [PAL.earth4, PAL.earth3, PAL.earth2, PAL.earth1], shape: 'sq', size: 1, floor: home.y + Math.round(rnd() * 3), bounce: 0.2, fadeAt: 1 });
      sp.release();
    });
    at(6, () => play('wmkPlateClank', { volume: 0.75, pan }));
    at(7, () => play('wmkPoleFall', { volume: 0.9, pan }));
    at(8, () => {
      // round 2 #8: the shaft's knock on the frame it lies flat (the swish played on f7)
      play('wmkPoleKnock', { volume: 0.9, pan });
      // the lance lands along the floor in front: a line of dust where it hits
      const tip = pointNow(u, 'muzzle', home);
      dustPuffs(sc, { x: tip.x, y: Math.max(tip.y, home.y - 2) }, 4, { spread: 6, rnd });
    });
    const penF = Math.min(n - 1, 9);
    at(penF, () => {
      play('wmkPennonFlop', { volume: 0.85, pan });
      born();
      void dustRing(sc, home, { r0: 6, r1: 26, ms: 360, tones: [PAL.stone2, PAL.stone2, PAL.stone1] });
    });
    // the ENDING (round 2 #8): the two empty greaves tip over one after the other — "tunk… tunk", the hollow C3 ring
    if (n > penF + 2) {
      const tunk = (f: number, k: number) =>
        at(f, () => {
          play('wmkGreaveTip', { volume: 0.8, pan, pitch: k ? 0.94 : 1.04 });
          dustPuffs(sc, { x: home.x + (k ? -1 : 1) * (u.flipX ? -10 : 10), y: home.y - 1 }, 3, { spread: 4, rnd, depth: unitDepth(home.y) + 0.5 });
        });
      tunk(n - 2, 0);
      tunk(n - 1, 1);
    }
    await capped(sc, untilShown(u, 'death', n - 1, 2000), 2000);
    if (u.sprite.active) await sleep(sc, u.frameMs('death', n - 1) + 40);
    // ---- the pile settles in grey dust and goes out in palette steps (no shatter: nothing was inside)
    play('wmkHollowBurst', { volume: 0.6, pan });
    dustPuffs(sc, home, 4, { spread: 14, rnd, depth: unitDepth(home.y) + 0.5 });
    const steps = [0xb8b8c8, 0x8890a8, 0x586078];
    for (const c of steps) {
      if (!u.sprite.active) break;
      u.sprite.setTint(c);
      await sleep(sc, 60);
    }
    if (u.sprite.active) u.sprite.setVisible(false);
  } catch (e) {
    console.error('[windmane] death failed', e);
  } finally {
    born();
    u.posed = false;
    u.setAura(AURA, null);
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
      return hollowArmour(ctx);
    },
    { priority: 20, name: `kart-f:${ID}:death` },
  );

// ================================================================ the aura's lifetime (observer)

/** Knights the observer has seen (their auras are reconciled on the board events). */
const KNIGHTS = new Set<Uid>();

if (LOOK_V3)
  registerObserver((ev, ctx) => {
    const t = ev.type;
    if (t !== 'phaseChange' && t !== 'turnStart' && t !== 'attackDeclare' && t !== 'battle' && t !== 'flip' && t !== 'positionChange' && t !== 'destroy' && t !== 'summon' && t !== 'statChange' && t !== 'gameOver') return;
    const s = ctx.stateNext;
    for (const p of [0, 1] as PlayerId[]) for (const m of s.players[p].monsters) if (m && s.cards[m.uid]?.cardId === ID) KNIGHTS.add(m.uid);
    for (const uid of [...KNIGHTS]) {
      // the hooks drive their own beats (the summon's brew, the charge / the calm, the death's freeze)
      // round 3 #8: a neighbour behind him clips the storm tail
      const at = slotOf(s, uid);
      const zi = at ? s.players[at.p].monsters.findIndex((m) => m?.uid === uid) : -1;
      if (at && zi >= 0 && crowdedIn(s, at.p, zi)) CROWDED.add(uid);
      else CROWDED.delete(uid);
      if ((t === 'summon' || t === 'statChange' || t === 'destroy') && (ev as { uid?: Uid }).uid === uid) continue;
      const u = ctx.unit(uid);
      if (!at) KNIGHTS.delete(uid);
      if (!u || u.retired) continue;
      const want = levelIn(s, uid);
      // entering the battle phase: the +500 already counts in the projected state; the plate keeps the old
      // number through the phase's sync (FieldView keeps a battle-tinted plate) until Fırtına Yükü rolls it
      if (t === 'phaseChange' && want === 2) u.battleTint = true;
      const cur = stormOf(u);
      const have = cur && !cur.calming ? cur.level : 0;
      if (want === 0) {
        // the storm itself is settled by the end phase's statChange (the calm); everything else drops now
        if (have >= 2 && t === 'phaseChange' && s.phase === 'end') continue;
        if (have > 0) setStorm(ctx.scene, u, 0);
      } else if (want === 1 && have === 0 && t !== 'phaseChange') setStorm(ctx.scene, u, 1);
      else if (want === 2 && have < 2 && (t === 'attackDeclare' || t === 'battle')) setStorm(ctx.scene, u, 2);
    }
  });

export type { AnyCtx };

// ================================================================ revive: one plate tick per seated piece (round 2 #10)

/** Revives already scored (uid:turn): the spell's batch is seen by several events. */
const REVIVES = new Set<string>();

if (LOOK_V3)
  registerObserver((_ev, ctx) => {
    // the spell (soul_recall) consumes the summon inside its own handler, so no observer ever sees it run: look ahead
    // in the batch from whatever event starts it
    const sv = ctx.events.slice(ctx.index).find((e): e is EvOf<'summon'> => e.type === 'summon' && e.from === 'graveyard' && e.cardId === ID);
    if (!sv) return;
    const key = `${sv.uid}:${ctx.state.turn}`;
    if (REVIVES.has(key)) return;
    REVIVES.add(key);
    const ev = sv;
    const sc = ctx.scene;
    const uid = ev.uid;
    // the revive pose is started by the spell's own presentation (soul_recall): wait for it, then score its frames
    let armed = false;
    const t0 = sc.time.now;
    const poll = sc.time.addEvent({
      delay: 16,
      loop: true,
      callback: () => {
        const u = ctx.unit(uid);
        if (armed || sc.time.now - t0 > 8000) return poll.remove(false);
        if (!u || u.frameInfo().anim !== 'revive') return;
        armed = true;
        poll.remove(false);
        const pan = panAt(u.home.x);
        // f1 the fauld seats on the boots, f3 the cuirass drops in, f5 the helm lands last
        ([[1, 0.85, 0.94], [3, 0.95, 1], [5, 1, 1.08]] as const).forEach(([f, vol, pitch]) =>
          atFrame(u, 'revive', f, () => play('wmkReviveTick', { volume: vol, pan, pitch }), { late: f === 1, maxMs: 2400 }),
        );
      },
    });
  });
