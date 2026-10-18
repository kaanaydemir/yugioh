// Işık Zincirleri (chains_of_light) — GAME_DESIGN §7: glowing chains shoot out of the card, wrap
// the attacker mid-lunge, drag it back to its own tile and lock with a clank; "SAVAŞ BİTTİ", and
// the turn ends.
//
// activate: the common trap opening, then (owning the whole resolution run)
//   · the coiled attacker launches itself anyway (attack anim, afterimages, a lunge that is still
//     travelling when the chains arrive)
//   · three gold chains with magenta halos shoot from the standing card, coil around it in the
//     air (it struggles), lock (padlock sigil, hit-stop) and haul it back home (./_chains lightChains)
//   · home: the chains snap taut with a second clank — white flash, gold sparks, a small shake
//   · the attackNegated event plays through the 'negate' hook below ("SAVAŞ BİTTİ"), the spent
//     trap burns out to the graveyard; the engine's end-phase / next-turn events follow.
// negate: with hints.bound the activation already bound the attacker → only the "SAVAŞ BİTTİ"
//   banner and the log line; otherwise the generic attackNegated presentation (battle/declare).
//
// The v3 look (?look=v3; docs/v3/A0_ENVANTER.md §6.2 item 10), chainsV3 below — scene ms from the
// activation, budget ≤ 2.0 s to its end:
//   0      the v3 trap opening (traps/_opening): the card springs up on its tile, the chains rattle
//          in it, ONE short local "TUZAK!" (no full-width band, no screen flash)
//   280    the attacker launches anyway: its strike continues from the declaration's charge pose
//          (attack frames up to the last KEY frame before its release — never stopping on a smear,
//          e.g. the magus holds its raised staff, f4, not the 50 ms swing f5) — a melee body lunges
//          along the floor, a ranged one leans in while its charge gathers at the muzzle / the orb
//   ~400   the chains shoot from the card, WIND ROUND THE DEFENDER (behind its body, out past its
//          flanks — never drawn over it) and on at the attacker
//   ~720   they coil round it and lock (clank, 60 ms hit-stop): it is caught mid-lunge on the
//          frame it reached, a breath / orb charge is snuffed, the arrow breaks; from here until
//          the release it is never on one frame: it strains on a quiet PAIR of its charge frames
//          (strainPair: neighbours ≤ 2.5 × idleΔ apart — magus and wyrm f3/f4) in an uneven
//          tremble (strainLoop), and no pose stands less than 40 ms
//   ~780   it resists part by part: each coil bites in turn (top → bottom) with a 1-px jerk
//          against the pull; bites ≥ 90 ms apart also squeeze it back a frame (the others coalesce)
//   ~990   hauled home in three jerks along the floor, dust at its feet on every one; a jerk
//          throws it back one frame and it settles leaning into its lunge for ≥ 100 ms (a jerk
//          inside that settle is coalesced; the snap home answers the last one)
//   ~1200  the last haul: "SAVAŞ BİTTİ" drops in as a short plate under the phase bar (the only
//          result text)
//   ~1300  home: the chains snap taut (clank) — the snap throws it back one frame (1 px past its
//          tile), it settles straining for 100 ms; then the chains let go ON THE FRAME its coil
//          starts to unwind (the coils spring off as sparks, the strands whip back into the card)
//          and it comes down through its own charge frames, reversed, into idle — every step one
//          frame from the last, never a jump to an unrelated pose; the spent card lies back down
//          and leaves for its graveyard.

import type Phaser from 'phaser';
import { PAL, PLAYER_COLOR } from '../../art/palette';
import { DEPTH, LOOK_V3, type XY, zoneXY } from '../../view/layout';
import { lightFlash } from '../../view/light';
import { shake, tween, wait } from '../../vfx/core';
import { afterimages, stopTime, whiteFlash } from '../../vfx/combat';
import { Raster, Sparks, onFrame, run } from '../../vfx/setpieces';
import { Sparks as PxSparks } from '../../vfx/combat';
import { animSpec, framePoint, hasHolds } from '../../art/animtime';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import { canHandOver, strikeStartFrame } from '../_v3/clash';
import { frameDelta, idleDelta } from '../_v3/posematch';
import { CHAINS_V3, lightChains, lightChainsV3 } from './_chains';
import { banner, type BannerOpts } from '../../vfx/banners';
import { fx, registerCardHook, type CinematicContext } from '../api';
import { TAU, type EvOf, all, holdFrame, lerpXY, live, other, rnd, rr, seed, takeAttack } from '../battle/_kit';
import { resultPlate, trapExit, trapOpening } from './_opening';

registerCardHook(
  'chains_of_light',
  'activate',
  async (ctx) => {
    if (LOOK_V3) return chainsV3(ctx);
    const ev = ctx.ev;
    const sc = ctx.scene;
    seed(ev.uid * 19 + 11);
    const runIdx = fx.resolutionRun(ctx);
    const ni = runIdx.find((i) => ctx.events[i].type === 'attackNegated') ?? -1;
    const nEv = ni >= 0 ? (ctx.events[ni] as EvOf<'attackNegated'>) : null;
    const pend = ctx.before.pending;
    const trig = pend && pend.kind === 'trapResponse' && pend.trigger.kind === 'attackDeclared' ? pend.trigger : null;
    const attackerUid = nEv?.attackerUid ?? trig?.attackerUid ?? null;
    const attacker = attackerUid !== null ? live(ctx.unit(attackerUid)) : null;
    const trapPt = ev.zone !== null ? zoneXY(ev.player, 'spellTrap', ev.zone) : zoneXY(ev.player, 'spellTrap', 1);
    const aCore = attacker ? attacker.core() : zoneXY(other(ev.player), 'monster', 1);
    const op = await trapOpening(ctx, { focus: lerpXY({ x: trapPt.x, y: trapPt.y - 30 }, aCore, 0.45) });
    const { hold, other: kept } = takeAttack(ctx);
    kept?.destroy();

    if (attacker) {
      // where it was going: the declared target, else the defending duelist
      const tUid = hold?.targetUid ?? trig?.targetUid ?? null;
      const tu = tUid !== null ? live(ctx.unit(tUid)) : null;
      const aim: XY = tu ? tu.home : hold ? { x: hold.to.x, y: hold.to.y + 18 } : fx.duelistPoint(ctx, ev.player);
      void ctx.focus(lerpXY(aCore, { x: op.face.x, y: op.face.y }, 0.4), { zoom: 1.06, ms: 360, pan: 0.32 });
      // the chains rattle awake in the card (the sfx's lock "tak" lands on the lock below)
      ctx.sfx('chains', { volume: 1 });
      hold?.dropMarks();
      await hold?.release(50);
      const s = attacker.sprite;
      const home = attacker.rest0;
      const dash = { x: Math.round(home.x + (aim.x - attacker.home.x) * 0.42), y: Math.round(home.y + (aim.y - attacker.home.y) * 0.42) };
      attacker.posed = true;
      // anticipation: it crouches for the leap
      await tween(sc, { targets: s, scaleY: 0.9, scaleX: 1.06, duration: 120, ease: 'Quad.Out' });
      // ---- it launches itself anyway
      void attacker.play('attack');
      ctx.sfx('whoosh', { volume: 0.6, pitch: 1.1 });
      void afterimages(sc, s, 260, PLAYER_COLOR[attacker.player], { every: 40, alpha: 0.45 });
      void tween(sc, { targets: s, scaleY: 1, scaleX: 1, duration: 160, ease: 'Back.Out' });
      let bound = false;
      const lunge = tween(sc, { targets: s, x: dash.x, y: dash.y, duration: 320, ease: 'Quad.Out' }).then(() => {
        // caught: it hangs in the chains, struggling on its attack frame
        if (s.active && !bound) holdFrame(attacker, 'attack', attacker.impactFrame);
      });
      await wait(sc, 70);
      // ---- the chains shoot from the standing card and bind it
      const struggle = (async () => {
        await lunge;
        while (!bound && s.active) {
          s.x = dash.x + (rnd() < 0.5 ? -1 : 1);
          await wait(sc, 50);
          if (!bound && s.active) s.x = dash.x;
          await wait(sc, 40);
        }
      })();
      await lightChains(sc, op.face, attacker, {
        home,
        onLock: () => {
          bound = true;
          sc.tweens.killTweensOf(s);
        },
      });
      bound = true;
      await struggle;
      // ---- home: the chains snap taut — a second clank
      if (s.active) {
        s.setPosition(home.x, home.y).setScale(1);
        ctx.sfx('chains', { volume: 0.7, pitch: 0.6 });
        ctx.sfx('shieldBlock', { volume: 0.5, pitch: 0.7 });
        void whiteFlash(sc, s, 1);
        void shake(sc, 140, 2);
        const c = attacker.core();
        void lightFlash(sc, c.x, c.y, PAL.gold4, 44, 420, { floorY: attacker.home.y, ring: true });
        const sp = new Sparks(sc, DEPTH.FX + 4);
        sp.burst(16, () => {
          const a = rr(0, TAU);
          const v = rr(50, 130);
          return { x: c.x, y: c.y + rr(-8, 8), vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6 - 30, ay: 320, drag: 2, life: rr(220, 420), ramp: [PAL.white, PAL.gold4, PAL.gold3, PAL.mag3], tex: rnd() < 0.3 ? 'fx:plus' : 'fx:px1', trail: true };
        });
        sp.close();
        await stopTime(sc, 40);
        void attacker.play('hit');
      }
      attacker.posed = false;
    } else {
      hold?.destroy();
    }
    // ---- "SAVAŞ BİTTİ" (the negate hook), the spent trap leaves
    const exit = wait(sc, 80).then(() => trapExit(ctx, op));
    if (ni >= 0 && !ctx.isConsumed(ni)) await ctx.play(ni, { bound: true });
    await all([exit, op.banner]);
    await fx.playRun(ctx, fx.resolutionRun(ctx));
  },
  { name: 'tb:chains_of_light:activate' },
);

registerCardHook(
  'chains_of_light',
  'negate',
  async (ctx) => {
    if (!ctx.hints.bound) return ctx.base();
    ctx.log('Saldırı geçersiz kılındı!', PAL.mag3);
    void ctx.unfocus(300);
    // v3: the one short result, under the phase bar — never a second full-width band
    if (LOOK_V3) return resultPlate(ctx.scene, 'SAVAŞ BİTTİ');
    const o: BannerOpts & { stagger: number } = { style: 'trap', hold: 120, stagger: 18 };
    await banner(ctx.scene, 'SAVAŞ BİTTİ', o);
  },
  { name: 'tb:chains_of_light:negate' },
);

// ================================================================ the v3 look (?look=v3)

type ActCtx = CinematicContext<EvOf<'activate'>>;

/** The attacker launches this long into the activation (while the trap is still opening). */
const LAUNCH_AT_V3 = 280;

/** How long the snap at home holds the attacker thrown back (and 1 px past its tile) (ms). */
const SNAP_MS_V3 = 60;
/** …then it settles, straining, this long before the chains let go (home → release = both). */
const SNAP_SETTLE_V3 = 100;
/** A coil bites: thrown back / settle (ms); a bite within BITE_GAP_V3 of the last one is coalesced. */
const BITE_V3 = { throw: 50, settle: 90 } as const;
const BITE_GAP_V3 = 90;
/** A haul step yanks it: one throw-back frame, then a settle of ≥ 100 ms (A2 motion review r2 #2). */
const YANK_V3 = { throw: 50, settle: 100 } as const;

/** Strikes that leave the body as a beam / orb / bolt / jet: the attacker leans in, it does not run. */
const RANGED: ReadonlySet<string> = new Set(['crystal_wyrm', 'abyss_magus', 'stone_sentinel', 'tide_golem', 'volt_lizard', 'lumen_sprite', 'coral_serpent']);

/** The colour of a ranged strike's charge (breath, orb...) gathering at its muzzle. */
const CHARGE: Readonly<Record<string, readonly number[]>> = {
  crystal_wyrm: [PAL.white, PAL.cyan4, PAL.cyan3, PAL.cyan2],
  abyss_magus: [PAL.white, PAL.void4, PAL.void3, PAL.void2],
};

/** A strike's charge gathering at the muzzle point of the frame the attacker shows (follows it). */
function chargeGlow(sc: Phaser.Scene, u: MonsterUnit, ramp: readonly number[]): { snuff(): void } {
  const ras = Raster.around(sc, u.sprite.x, u.sprite.y, 24, 24, u.sprite.depth + 0.5);
  let k = 0;
  let dead = false;
  const at = (): XY => {
    const fi = u.frameInfo();
    const p = framePoint(u.art, fi.anim ?? 'attack', fi.frame, 'muzzle');
    const w = u.framePoint(p.x, p.y);
    return { x: Math.round(w.x), y: Math.round(w.y) };
  };
  const stop = onFrame(sc, (dt, el) => {
    if (dead || !u.sprite.active) return false;
    k = Math.min(1, k + dt / 320);
    const p = at();
    ras.moveTo(p.x - 12, p.y - 12);
    ras.draw((g) => {
      const r = 1 + Math.round(3 * k) + (Math.floor(el / 60) % 2);
      g.disc(p.x, p.y, r + 1, ramp[2], 0.5);
      g.disc(p.x, p.y, r, ramp[1]);
      g.disc(p.x, p.y, Math.max(1, r - 2), ramp[0]);
      // motes drawn in from round it
      for (let i = 0; i < 4; i++) {
        const a = el * 0.01 + (i / 4) * Math.PI * 2;
        const d = Math.round(9 - 6 * ((el * 0.004 + i * 0.25) % 1));
        g.px(p.x + Math.round(Math.cos(a) * d), p.y + Math.round(Math.sin(a) * d * 0.7), ramp[i % 2 ? 1 : 0]);
      }
    });
    return true;
  });
  return {
    snuff() {
      if (dead) return;
      dead = true;
      stop();
      const p = u.sprite.active ? at() : { x: ras.x + 12, y: ras.y + 12 };
      ras.destroy();
      // the charge gutters out: a little burst that falls
      const sp = new PxSparks(sc, DEPTH.FX + 4);
      for (let i = 0; i < 10; i++) {
        const a = rr(0, TAU);
        const v = rr(30, 80);
        sp.add({ x: p.x, y: p.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6 - 10, ay: 260, drag: 2, life: rr(160, 300), colors: [ramp[0], ramp[1], ramp[2], PAL.night3], shape: 'px', fadeAt: 1 });
      }
      sp.release();
    },
  };
}

// ---------------------------------------------------------------- the bound pose (v3)
//
// A2 motion review r2 #2: the bound attacker strained on its swing smear (the magus' attack f5,
// a 50 ms in-between 5.6 × idleΔ from the frame before) and every coil bite / haul step restarted
// the tremble, so only its 30–45 ms entries ever played — a 15–30 Hz two-pose buzz. Now:
//   · the lunge never stops on a smear (strainStop): it holds the last key frame before the release
//   · it strains on a PAIR of neighbouring frames that differ little (strainPair: Δ ≤ 2.5 × idleΔ)
//   · every tug of the chains is one throw-back frame and a settle (Strain.tug); tugs that arrive
//     while an earlier one still runs are coalesced, and no pose stands less than MIN_DWELL_MS

/** v3 arts: a frame held this short is an in-between (a smear) — never a pose to hold. */
const SMEAR_MS = 60;
/** …so is one shorter than a key (KEY_MS) that jumps more than JUMP_MAX × idleΔ from the one before. */
const KEY_MS = 100;
const JUMP_MAX = 3;
/** Two neighbouring frames that differ at most this × idleΔ tremble as one strained pose. */
const PAIR_MAX = 2.5;
/** No pose of the bound body stands shorter than this (ms; the throw of a tug waits for it). */
const MIN_DWELL_MS = 40;

/** Δ(attack f, attack g) / idleΔ on the unit's own sheet; null when unknown (a frame not painted yet). */
function attackDelta(u: MonsterUnit, f: number, g: number): number | null {
  const idle = idleDelta(u);
  const d = frameDelta(u, `attack:${f}`, `attack:${g}`);
  return idle === null || d === null ? null : d / idle;
}

/** An attack frame that is only an in-between (v3 arts with per-frame holds; old arts: never). */
function isSmear(u: MonsterUnit, f: number): boolean {
  const spec = animSpec(u.art, 'attack');
  if (!spec || !hasHolds(spec)) return false;
  const ms = u.frameMs('attack', f);
  if (ms <= SMEAR_MS) return true;
  if (f <= 0 || ms >= KEY_MS) return false;
  const d = attackDelta(u, f - 1, f);
  return d !== null && d > JUMP_MAX;
}

/** The frame the lunge stops on: the last key frame before the release (never a smear), ≥ f0. */
function strainStop(u: MonsterUnit, f0: number, release: number): number {
  let f = Math.max(f0, release - 1);
  while (f > f0 && isSmear(u, f)) f--;
  return f;
}

/** The two attack frames a bound body strains on: `hi` leans into the strike, `lo` is pulled back. */
interface StrainPair {
  lo: number;
  hi: number;
}

/**
 * The strain pair for a body caught on attack frame `caught` (its lunge plays up to `fStop`): the
 * neighbouring non-smear frames (k, k+1) ≤ fStop nearest to it whose Δ ≤ PAIR_MAX × idleΔ (ties:
 * the later pair). None that close: the caught frame and its quieter neighbour; Δ unknown: the
 * caught frame (stepped back off a smear) and the one before it.
 */
function strainPair(u: MonsterUnit, caught: number, fStop: number): StrainPair {
  let c = Math.max(0, Math.min(caught, fStop));
  while (c > 0 && isSmear(u, c)) c--;
  if (idleDelta(u) === null) return { lo: Math.max(0, c - 1), hi: c };
  let best: { p: StrainPair; dist: number } | null = null;
  for (let k = 0; k + 1 <= fStop; k++) {
    if (isSmear(u, k) || isSmear(u, k + 1)) continue;
    const d = attackDelta(u, k, k + 1);
    if (d === null || d > PAIR_MAX) continue;
    const dist = c >= k && c <= k + 1 ? 0 : Math.min(Math.abs(c - k), Math.abs(c - k - 1));
    if (!best || dist <= best.dist) best = { p: { lo: k, hi: k + 1 }, dist };
  }
  if (best) return best.p;
  const back = c > 0 ? attackDelta(u, c - 1, c) : null;
  const fwd = c + 1 <= fStop && !isSmear(u, c + 1) ? attackDelta(u, c, c + 1) : null;
  if (fwd !== null && (back === null || fwd < back)) return { lo: c, hi: c + 1 };
  return { lo: Math.max(0, c - 1), hi: c };
}

/** How hard a tug pulls: a stronger one may cut a weaker one short; an equal or weaker one is coalesced. */
const TUG = { bite: 1, yank: 2, snap: 3 } as const;

/**
 * The bound attacker never hangs on one frame: from the lock to the release it strains on its
 * strain pair in an uneven tremble (hi ↔ lo, never a metronome), and every tug of the chains is
 * one throw-back frame (lo) and a settle (hi) before the tremble resumes.
 */
interface Strain {
  readonly pair: StrainPair;
  /**
   * A tug: thrown back to `lo` for `throwMs`, then it settles on `hi` for `settleMs`. While an
   * earlier tug of the same or a stronger kind still runs this one is coalesced (null); the throw
   * waits until the pose shown has stood MIN_DWELL_MS. Returns the ms until the throw shows.
   */
  tug(kind: keyof typeof TUG, throwMs: number, settleMs: number): number | null;
  /**
   * The last pull: once the running tug (if any) has settled it leans into the chains on `hi`
   * without the tremble, until the next tug (the snap home lands on a pose that has stood).
   */
  lean(): void;
  /** ms until the running tug has settled (0: none). */
  readonly busyMs: number;
  /** ms since the strain began (the scaled scene clock: frozen by hit-stops, sped up by the game speed). */
  readonly el: number;
  /** The attack frame it shows now. */
  readonly frame: number;
  stop(): void;
}

function strainLoop(sc: Phaser.Scene, u: MonsterUnit, pair: StrainPair): Strain {
  // [0 = hi / 1 = lo, ms]: an irregular tremble on the pair
  const LOOP: readonly (readonly [0 | 1, number])[] = [
    [0, 100],
    [1, 45],
    [0, 70],
    [1, 40],
    [0, 120],
    [1, 55],
  ];
  /** What follows a tug's settle: the tremble, or (lean()) one long lean on hi. */
  let after: readonly (readonly [0 | 1, number])[] = LOOP;
  let seq: readonly (readonly [0 | 1, number])[] = LOOP;
  let i = 0;
  let t = 0;
  let alive = true;
  let shown = -1;
  let dwell = 0;
  let busy = 0;
  let busyKind = 0;
  /** Entries of `seq` that belong to the running tug (its wait, throw and settle). */
  let tugLen = 0;
  let el = 0;
  const frameOf = (k: 0 | 1) => (k ? pair.lo : pair.hi);
  const show = (f: number) => {
    if (f === shown) return;
    if (u.sprite.active) u.pose('attack', f);
    shown = f;
    dwell = 0;
  };
  // caught on its strain frame: that pose has already stood (the first tug may throw it at once)
  const fi0 = u.frameInfo();
  const already = fi0.anim === 'attack' && fi0.frame === pair.hi;
  show(pair.hi);
  if (already) dwell = MIN_DWELL_MS;
  const stop = onFrame(sc, (dt) => {
    if (!alive || !u.sprite.active) return false;
    t += dt;
    el += dt;
    dwell += dt;
    busy = Math.max(0, busy - dt);
    while (t >= seq[i][1]) {
      t -= seq[i][1];
      i++;
      if (i >= seq.length) {
        seq = after;
        i = 0;
      }
      show(frameOf(seq[i][0]));
    }
    return true;
  });
  return {
    pair,
    tug(kind, throwMs, settleMs) {
      if (!alive) return null;
      const k = TUG[kind];
      if (busy > 0 && k <= busyKind) return null;
      // never flash a pose: the throw waits until the one shown has stood its minimum
      const hold = shown === pair.lo ? 0 : Math.max(0, Math.ceil(MIN_DWELL_MS - dwell));
      const s: (readonly [0 | 1, number])[] = [];
      if (hold > 0) s.push([0, hold]);
      s.push([1, Math.max(1, throwMs)], [0, Math.max(1, settleMs)]);
      tugLen = s.length;
      s.push(...after);
      seq = s;
      i = 0;
      t = 0;
      busy = hold + throwMs + settleMs;
      busyKind = k;
      show(frameOf(seq[0][0]));
      return hold;
    },
    lean() {
      if (!alive) return;
      after = [[0, 1e7]];
      if (busy > 0 && i < tugLen) {
        // the tug runs out first (its throw and settle), then the lean
        seq = [...seq.slice(0, tugLen), ...after];
        return;
      }
      // in the tremble: a lo entry keeps its minimum, then the lean
      seq = shown === pair.lo && dwell < MIN_DWELL_MS ? [[1, Math.ceil(MIN_DWELL_MS - dwell)], ...after] : after;
      tugLen = 0;
      i = 0;
      t = 0;
      show(frameOf(seq[0][0]));
    },
    get busyMs() {
      return busy;
    },
    get el() {
      return el;
    },
    get frame() {
      return shown;
    },
    stop() {
      alive = false;
      stop();
    },
  };
}

/**
 * Let go of the strike: the coil unwinds back down its own charge frames (from `from` to 0, a
 * little slower each frame: 50, 70, 90 ms…), then the idle loop takes over from frame 0 — every
 * step an in-between of the one before. `first` runs right after the first frame shows (same frame).
 */
async function unwind(sc: Phaser.Scene, u: MonsterUnit, from: number, first?: () => void): Promise<void> {
  let k = 0;
  for (let f = from; f >= 0; f--, k++) {
    if (!u.sprite.active) break;
    u.pose('attack', f);
    if (k === 0) first?.();
    await wait(sc, Math.min(100, 50 + 20 * k));
  }
  if (k === 0) first?.();
  u.posed = false;
  if (u.sprite.active && !u.retired) u.rest();
}

/** Dust kicked up at a dragged body's feet (crisp puffs, the floor's tones). */
function scrape(sc: Phaser.Scene, feet: XY, dir: number): void {
  const sp = new PxSparks(sc, DEPTH.FX - 2);
  for (let i = 0; i < 6; i++)
    sp.add({ x: Math.round(feet.x + rr(-8, 8)), y: Math.round(feet.y + rr(-2, 1)), vx: dir * rr(10, 40), vy: rr(-30, -8), drag: 2, life: rr(240, 420), size: rr(1.5, 3), shape: 'puff', colors: [PAL.mist, PAL.steel, PAL.night4, PAL.night3], fadeAt: 1 });
  sp.release();
}

/** Işık Zincirleri, the v3 look (see the header). */
async function chainsV3(ctx: ActCtx): Promise<void> {
  const ev = ctx.ev;
  const sc = ctx.scene;
  seed(ev.uid * 19 + 11);
  const runIdx = fx.resolutionRun(ctx);
  const ni = runIdx.find((i) => ctx.events[i].type === 'attackNegated') ?? -1;
  const nEv = ni >= 0 ? (ctx.events[ni] as EvOf<'attackNegated'>) : null;
  const pend = ctx.before.pending;
  const trig = pend && pend.kind === 'trapResponse' && pend.trigger.kind === 'attackDeclared' ? pend.trigger : null;
  const attackerUid = nEv?.attackerUid ?? trig?.attackerUid ?? null;
  const attacker = attackerUid !== null ? live(ctx.unit(attackerUid)) : null;
  const trapPt = ev.zone !== null ? zoneXY(ev.player, 'spellTrap', ev.zone) : zoneXY(ev.player, 'spellTrap', 1);
  const aCore = attacker ? attacker.core() : zoneXY(other(ev.player), 'monster', 1);
  const { hold, other: kept } = takeAttack(ctx);
  kept?.destroy();
  const tUid = hold?.targetUid ?? trig?.targetUid ?? null;
  const defender = tUid !== null ? live(ctx.unit(tUid)) : null;

  // ---- "SAVAŞ BİTTİ": the attackNegated event through the negate hook (once)
  let negP: Promise<void> | null = null;
  const negate = () => {
    if (!negP) negP = ni >= 0 && !ctx.isConsumed(ni) ? ctx.play(ni, { bound: true }) : Promise.resolve();
  };

  // ---- the attacker launches anyway, while the trap is still springing
  /** The frame its lunge stops on (the last key before the release; never a smear). */
  let fStop = 0;
  /** Where its lunge takes the sprite (the chains' rasters are sized to reach it). */
  let reach: XY | undefined;
  let glow: { snuff(): void } | null = null;
  let lungeDone: Promise<void> = Promise.resolve();
  let launched = false;
  let caught = false;
  const launch = () => {
    if (!attacker || caught || launched) return;
    launched = true;
    const u = attacker;
    const s = u.sprite;
    if (!s.active) return;
    u.posed = true;
    if (canHandOver(hold)) hold.handOver();
    hold?.dropMarks();
    sc.tweens.killTweensOf(s);
    const f0 = strikeStartFrame(u);
    const rel = u.markFrame('attack', 'release', u.impactFrame);
    fStop = strainStop(u, f0, rel);
    void u.playRange('attack', f0, fStop);
    const r = u.rest0;
    const aim: XY = defender ? defender.home : hold ? { x: hold.to.x, y: hold.to.y + 18 } : fx.duelistPoint(ctx, ev.player);
    const dx = aim.x - u.home.x;
    const dy = aim.y - u.home.y;
    const d = Math.hypot(dx, dy) || 1;
    const ranged = RANGED.has(u.cardId);
    const dist = ranged ? 6 : Math.min(54, d * 0.36);
    const dash = { x: Math.round(r.x + (dx / d) * dist), y: Math.round(r.y + (dy / d) * dist) };
    reach = dash;
    const ms = Math.max(240, Math.min(420, u.rangeMs('attack', f0, fStop)));
    ctx.sfx('whoosh', { volume: 0.5, pitch: ranged ? 0.8 : 1.1 });
    if (ranged) glow = chargeGlow(sc, u, CHARGE[u.cardId] ?? [PAL.white, PAL.gold4, PAL.gold3, PAL.gold2]);
    const p0 = { x: s.x, y: s.y };
    lungeDone = run(sc, ms, (t) => {
      if (caught || !s.active) return;
      const e = 1 - (1 - t) * (1 - t);
      s.setPosition(Math.round(p0.x + (dash.x - p0.x) * e), Math.round(p0.y + (dash.y - p0.y) * e));
    });
  };
  void wait(sc, LAUNCH_AT_V3)
    .then(launch)
    .catch((e) => console.error('[chains] launch', e));
  const op = await trapOpening(ctx, { focus: lerpXY({ x: trapPt.x, y: trapPt.y - 30 }, aCore, 0.45) });

  /** The release at home (the chains let go, the coil unwinds into idle). */
  let released: Promise<void> = Promise.resolve();
  if (attacker && attacker.sprite.active) {
    launch();
    const u = attacker;
    const s = u.sprite;
    void ctx.focus(lerpXY(aCore, op.face, 0.4), { ms: 320, pan: 0.28 });
    const home = u.rest0;
    // the pull runs from the attacker back toward home: its feet dig in against it
    const pullDir = Math.sign(home.x - s.x) || (u.player === 0 ? -1 : 1);
    let strain: Strain | null = null;
    let lastBite = -1e9;
    const chains = await lightChainsV3(sc, op.face, u, {
      home,
      defender,
      reach,
      onLock: () => {
        caught = true;
        ctx.sfx('chains', { volume: 1 });
        sc.tweens.killTweensOf(s);
        // caught mid-lunge: the pose stops on the frame it reached — and strains on from there, on
        // the quiet pair of key frames there (strainPair: never on a smear)
        if (s.active) s.anims.stop();
        const fi = u.frameInfo();
        const caughtFrame = fi.anim === 'attack' ? fi.frame : Math.max(0, Math.min(fStop, u.impactFrame - 1));
        if (s.active) strain = strainLoop(sc, u, strainPair(u, caughtFrame, Math.max(fStop, caughtFrame)));
        glow?.snuff();
        hold?.shatterMarks();
      },
      onCoil: (i) => {
        // each coil bites in turn (a 1-px jerk against it); the pose answers the bites that are far
        // enough apart: squeezed back a frame, then it strains on
        if (!s.active) return;
        const st = strain as Strain | null;
        if (st && st.el - lastBite >= BITE_GAP_V3 && st.tug('bite', BITE_V3.throw, BITE_V3.settle) !== null) lastBite = st.el;
        const x0 = s.x;
        s.x = x0 - pullDir;
        ctx.sfx('chains', { volume: 0.25, pitch: 1.3 + i * 0.15 });
        void wait(sc, 40).then(() => {
          if (s.active && caught) s.x = x0;
        });
      },
      onStep: (k, feet) => {
        // the result drops in under the phase bar as the last haul begins
        if (k === CHAINS_V3.steps - 1) negate();
        if (!s.active) return;
        // dragged on its feet: a jerk throws it back a frame and it leans into its lunge again,
        // settling ≥ 100 ms (jerks inside that settle are coalesced; the snap home takes the last)
        if (k < CHAINS_V3.steps - 1) strain?.tug('yank', YANK_V3.throw, YANK_V3.settle);
        else strain?.lean();
        scrape(sc, feet, -pullDir);
        ctx.sfx('cardSlide', { volume: 0.35, pitch: 0.6 + k * 0.1 });
      },
    });
    await lungeDone;
    // ---- home: the chains snap taut (clank) — the snap throws it back once more, 1 px past its
    // tile and back; a beat later the chains let go on the very frame its coil starts to unwind,
    // and it comes down through its own charge frames into idle
    if (s.active) {
      s.setPosition(home.x, home.y);
      ctx.sfx('chains', { volume: 0.7, pitch: 0.6 });
      ctx.sfx('shieldBlock', { volume: 0.45, pitch: 0.7 });
      void shake(sc, 120, 1);
      const c = u.core();
      void lightFlash(sc, c.x, u.home.y, PAL.gold4, 30, 360, { floorY: u.home.y, ring: true });
      // the snap throws it back one frame (1 px past its tile), it settles straining, and as the
      // chains let go the coil comes down from there — every step one frame away from the last
      const st = strain as Strain | null;
      const lead = st?.tug('snap', SNAP_MS_V3, SNAP_SETTLE_V3) ?? 0;
      const lo = st ? st.pair.lo : Math.max(0, fStop - 1);
      if (!st) u.pose('attack', lo);
      released = (async () => {
        if (lead > 0) await wait(sc, lead);
        if (s.active) s.x = home.x + pullDir;
        await wait(sc, SNAP_MS_V3);
        if (s.active) s.x = home.x;
        await wait(sc, SNAP_SETTLE_V3);
        st?.stop();
        if (s.active) s.setPosition(home.x, home.y);
        await unwind(sc, u, lo, () => chains.release());
      })();
    } else {
      (strain as Strain | null)?.stop();
      chains.release();
      u.posed = false;
    }
  } else {
    hold?.destroy();
  }
  // ---- "SAVAŞ BİTTİ" (the negate hook: a short plate), the spent trap leaves
  const exit = trapExit(ctx, op);
  negate();
  await all([exit, negP ?? Promise.resolve(), op.banner, released]);
  await fx.playRun(ctx, fx.resolutionRun(ctx));
}
