// Saman Korkuluk (straw_decoy_token, lane D) — the S9 token's own v3 summon, strike, hit hand-over and vanish
// (?look=v3 only for everything new; v1 keeps the old placeholder vanish, moved here byte for byte from
// src/cinematics/b2/placeholders.ts). Pieces: ./_straw_decoy_token-fx.ts; sounds: src/audio/v3/straw.ts.
//
// Summon (from:'token', ≈ 1.2 s per token; a batch of tokens from one Saman Korkuluklar is staged together, each
// one 120 ms after the last, so 2–4 tokens take ≈ 1.3–1.6 s): the stake drops out of the sky — a thin falling
// streak and its shadow growing on the tile (scarecrowFall) — and is planted on 'land' with a dry wood "tok"
// (scarecrowStakeA / B / C: the three stakes of a batch have three pitches; kept ≈ 6 dB under the spell), dirt
// clods and one flat dirt ring; straw stalks blow in from upwind on curling paths and wrap the stake
// (scarecrowWrap); the old jacket flies in from upwind with a cloth smear and snaps on (SU_F.jacketIn → jacket,
// scarecrowJacket); the sack head drops from above and squashes on the stake (SU_F.sack, scarecrowSack); the hat
// flips through the air in an arc and lands (SU_F.hat, scarecrowHat); the button eyes light ONCE (SU_F.eye,
// scarecrowEye: the buttons themselves turn gold with a 1-px halo, then fade; a warm floor flash; the badge pops).
// A token set in defense hunches into its guard straight from the last summon frame (scarecrowLower). The last
// token of the batch sends a crow up off its shoulder and away out of the frame: a far "gak … gak"
// (scarecrowCrow). Afterwards each token's loop runs at its own pace (desync) and one crow at a time visits one
// token now and then (./_straw_decoy_token-crow.ts). Hologram: none (a stake is a thing, not a projection). Lane
// E's spell cinematic may play the summons itself: ctx.play(i, { strawIndex: k, strawCount: n }).
//
// Strike "Saman Tokadı" (the token has 0 ATK; it only attacks once switched to attack position): it rocks back on
// its stake (scarecrowCharge, from the declaration on) while it HOPS across the floor on its stake (a light "tok"
// + dirt flick per landing, scarecrowHop), f5 the straw arm whips forward (scarecrowWhip), f6 contact: a straw
// slap — chaff flies along the blow (scarecrowSlap). The striking token is drawn in front of every unit on its
// way (never hidden behind a big monster). Blocked: the straw splays on the guard and the stake wobbles back
// (scarecrowBounce), it hops home. Losing (a 0-ATK attack on an attack-position monster): the counter blow knocks it back one long hop
// toward home, out in the open, and it comes undone there (the vanish below). Direct: the slap lands on the duelist.
// Struck: a blow on the token (guard or upright) hands the token to its vanish ON the contact — the binding is
// already coming undone while the attacker goes home (no "hit, stand, then die" beat).
// Vanish (tokenVanish; never a graveyard): death f1 the rope binding comes undone (scarecrowUntie), f2 the sack
// head tips, f3 the straw bundles spill to the floor (scarecrowSpill: stalks fly out and LIE on the marble) while
// the head falls off in an arc (f3, f4; the hat flips off it), f5 it hits the floor and squashes (scarecrowSack),
// bounces once (f6, the hat lands: scarecrowHat), f8 the stake topples onto the floor (scarecrowTopple: dust along
// the stake, 1 px shake); then the wind takes the straw away (scarecrowScatter) while the remains thin out in two
// steps and the token card dissolves. ≈ 1.2 s. A position change plays scarecrowLower / scarecrowRaise on the
// transition pose. Camera never moves (EF-8).

import Phaser from 'phaser';
import { PAL, type Ramp } from '../../art/palette';
import type { AnyMonsterAnim } from '../../art/types';
import type { GameEvent } from '../../engine/types';
import type { FieldView } from '../../duel/FieldView';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import { DEPTH, LOOK_V3, unitDepth, zoneXY, type XY } from '../../view/layout';
import { lightFlash } from '../../view/light';
import { TEX, shake, tween } from '../../vfx/core';
import { animate, sleep } from '../../vfx/combat';
import { registerCardHook, registerEvent, registerStrike, type CinematicContext } from '../api';
import type { StrikeArgs } from '../_core/types';
import { strikeStartFrame } from '../_v3/clash';
import { summonPose } from '../_v3/summon';
import { atFrame, atMark, panAt, play, start, takeCharge } from '../_v3/sound';
import { worldBox } from '../strikes-b/_kit';
import { runSummon, type Stage } from '../summon-a/_kit';
import { FLOOR_DEPTH, Litter, chaffBurst, crowOff, eyeGlint, fallShadow, plantBurst, seedFx, stakeDust, strawPoint, windWrap } from './_straw_decoy_token-fx';
import { crowVisits } from './_straw_decoy_token-crow';
import { D_F, SU_F } from '../../art/monsters-v3/straw_decoy_token-anims';
import type { SfxName } from '../../audio/sfx';

const ID = 'straw_decoy_token';
/** (summonPose wants a ramp even without a hologram) straw. */
const STRAW_RAMP: Ramp = [PAL.night2, PAL.gold1, PAL.gold2, PAL.gold3, PAL.gold4];
const STAKES: readonly SfxName[] = ['scarecrowStakeA', 'scarecrowStakeB', 'scarecrowStakeC'];
/** A batch of tokens: each one starts this long after the one before. */
const STAGGER_MS = 120;
const HIT_ANIMS: readonly AnyMonsterAnim[] = ['hit', 'hitHeavy', 'hitMagic'];
/** Depth lift of a striking token over the unit band (units are UNIT + y, y < 360; FX stays above). */
const STRIKE_LIFT = 400;

type BattleEv = Extract<GameEvent, { type: 'battle' }>;
type VanishEv = Extract<GameEvent, { type: 'tokenVanish' }>;
type SummonEv = Extract<GameEvent, { type: 'summon' }>;

const R = Math.round;
const norm = (p: XY): XY => {
  const l = Math.hypot(p.x, p.y) || 1;
  return { x: p.x / l, y: p.y / l };
};

// ================================================================ summon

function entranceFor(k: number, n: number): (S: Stage) => Promise<void> {
  return async (S: Stage) => {
    const sc = S.scene;
    const u = S.unit;
    const pan = panAt(S.home.x);
    const dir = S.dir;
    seedFx(u.uid * 37 + k * 11 + 3);
    const pool = S.glow({ color: PAL.gold3, radius: 18, intensity: 0.3, anim: 'flicker', fadeIn: 120 });
    play('scarecrowFall', { volume: 0.55, pan });
    await fallShadow(sc, S.home, 150, S.depth + 0.5);
    const p = summonPose(sc, u, { ramp: STRAW_RAMP, hologram: false });
    if (!p) return;
    const snd: { wrap: ReturnType<typeof start> | null } = { wrap: null };
    atMark(u, 'summon', 'land', () => {
      // (a token is small: its "tok" sits ≈ 6 dB under the spell's activation, SE-7)
      play(STAKES[k % STAKES.length], { volume: 0.36, pan });
      plantBurst(sc, S.home, dir);
      pool.setIntensity(0.65, 40);
      void shake(sc, 50, 1);
    });
    atFrame(
      u,
      'summon',
      SU_F.wrap,
      () => {
        snd.wrap = start('scarecrowWrap', { volume: 0.7, pan });
        windWrap(sc, u, S.home, dir, u.rangeMs('summon', SU_F.wrap, SU_F.jacketIn + 1));
      },
      { late: false },
    );
    // the jacket flies in (its whoosh starts as it enters, its snap lands on the frame it goes on)
    atFrame(
      u,
      'summon',
      SU_F.jacketIn,
      () => {
        snd.wrap?.stop(80);
        snd.wrap = null;
        play('scarecrowJacket', { volume: 0.75, pan });
      },
      { late: false },
    );
    atFrame(u, 'summon', SU_F.sack, () => play('scarecrowSack', { volume: 0.7, pan }), { late: false });
    atFrame(u, 'summon', SU_F.hat, () => play('scarecrowHat', { volume: 0.6, pan }), { late: false });
    atFrame(
      u,
      'summon',
      SU_F.eye,
      () => {
        play('scarecrowEye', { volume: 0.8, pan });
        eyeGlint(sc, u);
        pool.setColor(PAL.gold4);
        pool.setIntensity(0.8, 30);
        void u.badge.pop();
        if (k === n - 1) {
          const from = strawPoint(u, 'barR') ?? { x: S.home.x, y: S.home.y - 32 };
          void sleep(sc, 140).then(() => {
            play('scarecrowCrow', { volume: 0.75, pan });
            void crowOff(sc, { x: from.x, y: from.y - 1 }, (-dir) as 1 | -1, DEPTH.FX + 1);
          });
        }
      },
      { late: false },
    );
    // a token set in defense hunches into its guard straight out of the summon's last pose (never a pop from
    // the upright idle f0 into the guard loop)
    let hunch: Promise<void> = Promise.resolve();
    if (u.position === 'defense' && u.has('toGuard')) {
      atFrame(
        u,
        'summon',
        u.frameCount('summon') - 1,
        () => {
          play('scarecrowLower', { volume: 0.45, pan });
          hunch = u.playRange('toGuard', 0, undefined, { hold: true }).then(() => {
            if (u.sprite.active && !u.retired && !u.claimed) u.rest();
          });
        },
        { late: false },
      );
    }
    await p.done;
    // (the hunch plays out on its own: the duel goes on while the token settles into its guard)
    void hunch;
    snd.wrap?.stop(40);
    void pool.fadeOut(300);
    desync(u);
    crowVisits(sc, S.ctx.views.field, u.uid * 97 + 13);
  };
}

/**
 * Tokens of one batch must not sway as clones: each one's idle / guard loop runs at its own pace (a timeScale from
 * its uid, 0.86…1.14), so loops that start together drift apart within a few seconds — never a jump to another
 * frame. One-shots always run at 1 (the timeScale is only ours while a loop plays and a play's own is respected).
 */
function desync(u: MonsterUnit): void {
  const s = u.sprite;
  const unit = u as MonsterUnit & Record<string, unknown>;
  if (unit.__strawPace || !s.active) return;
  const ts = 0.86 + (((u.uid * 37 + 11) % 29) / 28) * 0.28 + 0.0013;
  const apply = () => {
    if (!s.active) return;
    const a = u.frameInfo().anim;
    const loop = a === 'idle' || a === 'guard';
    if (loop && s.anims.timeScale === 1) s.anims.timeScale = ts;
    else if (!loop && s.anims.timeScale === ts) s.anims.timeScale = 1;
  };
  unit.__strawPace = true;
  s.on('animationstart', apply);
  s.once('destroy', () => s.off('animationstart', apply));
  apply();
}

/** Old entrance (no v3 summon pose): the generic kit's own. */
async function legacyEntrance(S: Stage): Promise<void> {
  S.unit.showSprite();
  S.finale();
}

registerCardHook(
  ID,
  'summon',
  async (ctx) => {
    if (!LOOK_V3) return ctx.base();
    const ev = ctx.ev;
    if (ev.from === 'field') return ctx.base();
    const h = ctx.hints as { strawIndex?: number; strawCount?: number };
    if (typeof h.strawIndex === 'number') {
      await runSummon(ctx, legacyEntrance, entranceFor(h.strawIndex, h.strawCount ?? h.strawIndex + 1));
      return;
    }
    // the leader of a batch: the other tokens of the same spell follow on a stagger
    const run: number[] = [];
    for (let i = ctx.index + 1; i < ctx.events.length; i++) {
      const e = ctx.events[i];
      if (e.type !== 'summon' || e.cardId !== ID || (e as SummonEv).sourceUid !== ev.sourceUid) break;
      if (!ctx.isConsumed(i)) run.push(i);
    }
    const n = run.length + 1;
    const jobs: Promise<void>[] = [runSummon(ctx, legacyEntrance, entranceFor(0, n))];
    run.forEach((i, j) => {
      jobs.push(sleep(ctx.scene, STAGGER_MS * (j + 1)).then(() => ctx.play(i, { strawIndex: j + 1, strawCount: n })));
    });
    await Promise.all(jobs);
  },
  { priority: 20, name: 'd:straw_decoy_token:summon' },
);

// ================================================================ vanish

/** The old placeholder vanish (v1 and arts without a death pose): the straw token squashes and scatters. */
function ghostOf(scene: Phaser.Scene, unit: { sprite: Phaser.GameObjects.Sprite; hide(): void }): Phaser.GameObjects.Image {
  const s = unit.sprite;
  const g = scene.add.image(s.x, s.y, s.texture.key, s.frame.name).setOrigin(s.originX, s.originY).setFlipX(s.flipX).setDepth(s.depth);
  unit.hide();
  return g;
}
function sparks(scene: Phaser.Scene, at: XY, color: number, n = 10, r = 18, ms = 420): void {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (i % 3) * 0.2;
    const p = scene.add.image(R(at.x), R(at.y), i % 4 === 0 ? TEX.plus : TEX.px2).setTint(i % 3 === 0 ? PAL.white : color).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.FX);
    scene.tweens.add({ targets: p, x: R(at.x + Math.cos(a) * r), y: R(at.y + Math.sin(a) * r * 0.6), alpha: 0, duration: ms, ease: 'Cubic.Out', onComplete: () => p.destroy() });
  }
}
async function placeholderVanish(ctx: CinematicContext<VanishEv>): Promise<void> {
  const ev = ctx.ev;
  const scene = ctx.scene;
  const field = ctx.views.field;
  const at = zoneXY(ev.player, 'monster', ev.zone);
  const { tile, unit } = field.release(ev.uid);
  ctx.sfx('cardSlide', { volume: 0.6, pitch: 1.4 });
  sparks(scene, { x: at.x, y: at.y - 10 }, PAL.gold3, 12, 20, 520);
  const jobs: Promise<void>[] = [];
  let ghost: Phaser.GameObjects.Image | null = null;
  if (unit) {
    ghost = ghostOf(scene, unit);
    jobs.push(tween(scene, { targets: ghost, scaleY: 0.2, alpha: 0, duration: 260, ease: 'Quad.In' }));
  }
  if (tile) jobs.push(tween(scene, { targets: tile, alpha: 0, duration: 260 }));
  await Promise.all(jobs);
  ghost?.destroy();
  tile?.destroy();
  if (unit) field.forget(ev.uid);
}

const usable = (u: MonsterUnit | null | undefined): u is MonsterUnit => !!u && !u.retired && u.sprite.active && u.has('death');

/**
 * The v3 vanish: the binding comes undone, the straw spills and lies on the floor, the stake topples, the wind
 * takes the straw. `push`: the blow's direction (the wind follows it), `struck`: it starts on a contact.
 */
async function vanishV3(sc: Phaser.Scene, field: FieldView, ev: VanishEv, o: { push?: XY; struck?: boolean } = {}): Promise<void> {
  const { tile, unit: u } = field.release(ev.uid);
  const home: XY = tile ? { x: tile.home.x, y: tile.home.y } : zoneXY(ev.player, 'monster', ev.zone);
  if (!u) {
    if (tile) await tile.dissolve(320).then(() => tile.active && tile.destroy());
    return;
  }
  seedFx(u.uid * 53 + 7);
  u.badge.setVisible(false);
  u.posed = true;
  sc.events.emit('v3:dying', u);
  const s = u.sprite;
  const feet = u.worldPoint('feet');
  const ground: XY = { x: R(feet.x), y: R(feet.y) };
  const pan = panAt(ground.x);
  const face: 1 | -1 = u.flipX ? -1 : 1;
  const wind: 1 | -1 = o.push && Math.abs(o.push.x) > 0.05 ? (o.push.x > 0 ? 1 : -1) : ((-face) as 1 | -1);
  const litter = new Litter(sc, ground, FLOOR_DEPTH + 1);
  try {
    // ---- the binding comes undone
    const showsGuard = (() => {
      const a = u.frameInfo().anim;
      return a === 'guard' || a === 'toGuard';
    })();
    if (showsGuard && u.has('fromGuard')) {
      // the hunched guard is thrown open first (one beat), never a pop into the upright death frame
      u.asClaimant(() => u.pose('fromGuard', 1));
      await sleep(sc, 50);
    }
    const from = o.struck ? 0 : 1;
    // the pose is stepped here on the scene clock, frame by frame (a hit-stop or a claim elsewhere must
    // never stall the vanish on the floor); each beat fires on the tick its frame is shown
    let blown: Promise<void> = Promise.resolve();
    let leave: Promise<unknown> = Promise.resolve();
    const GUST = D_F.topple + 1;
    const beats: Record<number, () => void> = {
      [D_F.untie]: () => {
        play('scarecrowUntie', { volume: 0.85, pan });
        const c = strawPoint(u, 'core') ?? { x: ground.x, y: ground.y - 27 };
        chaffBurst(sc, { x: c.x, y: c.y + 4 }, { x: wind * 0.6, y: -0.4 }, ground.y, 8, s.depth + 0.4);
      },
      // the sack head lands on the floor (it fell in an arc off the stake, f2 → f5) and bounces once
      [D_F.sack]: () => {
        play('scarecrowSack', { volume: 0.55, pan });
        const hd = strawPoint(u, 'head');
        if (hd) litter.throw({ x: hd.x, y: hd.y + 3 }, 3, { vx: face * 20, vy: -30, spread: 20, floorY: ground.y });
      },
      [D_F.hat]: () => play('scarecrowHat', { volume: 0.4, pan }),
      [D_F.spill]: () => {
        play('scarecrowSpill', { volume: 0.85, pan });
        const c = strawPoint(u, 'core') ?? { x: ground.x, y: ground.y - 24 };
        litter.throw({ x: c.x, y: c.y + 6 }, 14, { vx: -face * 20, vy: -20, spread: 45, floorY: ground.y, floorJitter: 4 });
        litter.throw({ x: ground.x, y: ground.y - 10 }, 10, { vx: face * 25, vy: -40, spread: 35, floorY: ground.y, delay: 80, floorJitter: 4 });
      },
      [D_F.topple]: () => {
        play('scarecrowTopple', { volume: 0.8, pan });
        const top = strawPoint(u, 'head', { anim: 'death', frame: D_F.topple });
        const bar = strawPoint(u, 'barL', { anim: 'death', frame: D_F.topple }) ?? ground;
        stakeDust(sc, ground, top && Math.abs(top.x - ground.x) > Math.abs(bar.x - ground.x) ? top : bar, ground.y);
        litter.throw({ x: R((ground.x + bar.x) / 2), y: ground.y - 4 }, 5, { vx: 0, vy: -50, spread: 40, floorY: ground.y });
        void shake(sc, 70, 1);
        // the gust comes right behind the impact
      },
      // the wind takes the straw at once after the topple (no still beat on the floor); the card dissolves under it
      [GUST]: () => {
        if (litter.blowing) return;
        play('scarecrowScatter', { volume: 0.75, pan });
        blown = litter.blowAway(wind);
        // the token card goes quietly in three palette-free steps (no ember burn: the straw gust is the beat)
        if (tile && tile.active)
          leave = (async () => {
            for (const a of [0.66, 0.33, 0]) {
              await sleep(sc, 60);
              if (tile.active) tile.setAlpha(a);
            }
            if (tile.active) tile.destroy();
          })();
        void lightFlash(sc, ground.x, ground.y - 2, PAL.gold2, 14, 200, { floorY: ground.y, intensity: 0.3 });
        const c = strawPoint(u, 'core') ?? ground;
        litter.throw({ x: c.x, y: ground.y - 3 }, 6, { vx: wind * 40, vy: -30, spread: 25, floorY: ground.y });
      },
    };
    const last = u.frameCount('death') - 1;
    // f0 … the topple on the sheet's holds (the fall a little quicker); the topple's impact is followed 60 ms
    // later by the gust, and the remains thin out over the last two frames while the straw blows off
    for (let f = from; f <= Math.min(D_F.topple, last); f++) {
      if (!s.active) break;
      u.asClaimant(() => u.pose('death', f));
      beats[f]?.();
      await sleep(sc, f === D_F.topple ? 60 : Math.round(u.frameMs('death', f) * (f >= 4 ? 0.8 : 1)));
    }
    beats[GUST]();
    for (const [f, a] of [[GUST, 0.66], [GUST + 1, 0.33]] as const) {
      if (!s.active) break;
      if (f <= last) u.asClaimant(() => u.pose('death', f));
      s.setAlpha(a);
      await sleep(sc, 60);
    }
    if (s.active) s.setVisible(false);
    await Promise.all([leave, Promise.race([blown, sleep(sc, 700)])]);
  } catch (e) {
    console.error('[straw vanish]', e);
  } finally {
    litter.destroy();
    u.posed = false;
    if (!u.retired) u.retire();
    field.forget(ev.uid);
    sc.events.emit('v3:dead', u);
  }
}

registerEvent(
  'tokenVanish',
  async (ctx: CinematicContext<VanishEv>) => {
    const ev = ctx.ev;
    if (ev.cardId !== ID) return ctx.base();
    if (!LOOK_V3 || !usable(ctx.views.field.unit(ev.uid))) return placeholderVanish(ctx);
    // an effect that clears several tokens at once (a wipe): the rest of the run comes undone together, each one
    // a beat after the last, instead of one after another
    const jobs: Promise<void>[] = [vanishV3(ctx.scene, ctx.views.field, ev, { struck: ev.cause === 'battle' })];
    if (ev.cause !== 'battle') {
      let k = 0;
      for (let i = ctx.index + 1; i < ctx.events.length; i++) {
        const e = ctx.events[i];
        if (e.type !== 'tokenVanish') break;
        if (ctx.isConsumed(i) || e.cardId !== ID || e.cause !== ev.cause || !usable(ctx.views.field.unit(e.uid))) continue;
        ctx.consumeAt(i);
        const d = 140 * ++k;
        jobs.push(sleep(ctx.scene, d).then(() => vanishV3(ctx.scene, ctx.views.field, e, {})));
      }
    }
    await Promise.all(jobs);
  },
  { priority: 20, name: 'd:straw_decoy_token:vanish' },
);

/**
 * A blow on a token that leaves with it (battle → tokenVanish): the vanish is consumed here and started on the
 * contact itself (the guard reaction / recoil is the hand-over), the battle goes on around it.
 */
async function handOver(ctx: CinematicContext<BattleEv>, uid: number | null): Promise<void> {
  if (!LOOK_V3 || uid === null) return ctx.base();
  const sc = ctx.scene;
  const field = ctx.views.field;
  const vi = ctx.findType('tokenVanish', (e) => e.uid === uid, { until: (e) => e.type === 'attackDeclare' || e.type === 'turnStart' || e.type === 'phaseChange' });
  const u = field.unit(uid);
  if (vi < 0 || !usable(u)) return ctx.base();
  ctx.consumeAt(vi);
  const vev = ctx.events[vi] as VanishEv;
  let run: Promise<void> | null = null;
  const go = (push?: XY): Promise<void> => (run ??= vanishV3(sc, field, vev, { struck: true, push }));
  const unit = u as MonsterUnit & Record<string, unknown>;
  const gh = u.guardHit;
  const pl = u.play;
  const pr = u.playRange;
  unit.guardHit = function (this: MonsterUnit, o: Parameters<MonsterUnit['guardHit']>[0] = {}) {
    const r = gh.call(u, { ...o, hold: true });
    const d = o.dir;
    void sleep(sc, 40).then(() => go(d));
    return r;
  };
  unit.play = function (this: MonsterUnit, anim: AnyMonsterAnim, opts?: Parameters<MonsterUnit['play']>[1]) {
    const r = pl.call(u, anim, opts);
    if (HIT_ANIMS.includes(anim)) void sleep(sc, 70).then(() => go());
    return r;
  };
  unit.playRange = function (this: MonsterUnit, anim: AnyMonsterAnim, a?: number, b?: number, o?: Parameters<MonsterUnit['playRange']>[3]) {
    const r = pr.call(u, anim, a, b, o);
    if (HIT_ANIMS.includes(anim) && !run) void sleep(sc, 70).then(() => go());
    return r;
  };
  try {
    await ctx.base();
  } finally {
    // back to the prototype's methods (the own overrides go)
    const own = unit as Record<string, unknown>;
    for (const k of ['guardHit', 'play', 'playRange']) delete own[k];
  }
  await go();
}

registerCardHook(ID, 'defend', (ctx) => handOver(ctx as CinematicContext<BattleEv>, (ctx.ev as BattleEv).targetUid), { priority: 20, name: 'd:straw_decoy_token:defend' });

// ================================================================ position

/**
 * A position change keeps the generic card turn and pose, plus the scarecrow's own sound: it hunches on its stake
 * (scarecrowLower on toGuard f1) or straightens up (scarecrowRaise on fromGuard f1). The visiting crow, if any, takes
 * off on its own (the unit is posed).
 */
registerEvent(
  'positionChange',
  async (ctx) => {
    const ev = ctx.ev;
    const u = ctx.views.field.unit(ev.uid);
    if (!LOOK_V3 || !u || u.cardId !== ID || !u.sprite.active) return ctx.base();
    const pan = panAt(u.home.x);
    const toDef = ev.position === 'defense';
    const anim: AnyMonsterAnim = toDef ? 'toGuard' : 'fromGuard';
    if (u.has(anim)) atFrame(u, anim, 1, () => play(toDef ? 'scarecrowLower' : 'scarecrowRaise', { volume: 0.7, pan }), { maxMs: 1500 });
    await ctx.base();
  },
  { priority: 20, name: 'd:straw_decoy_token:position' },
);

// ================================================================ strike

/** Where the feet stand so the straw hand (tipR) of `frame` lands on `aim` (world px; offsets are position-free). */
function feetFor(u: MonsterUnit, aim: XY, frame: number): XY {
  const tip = strawPoint(u, 'tipR', { anim: 'attack', frame });
  const foot = strawPoint(u, 'foot', { anim: 'attack', frame });
  if (!tip || !foot) return aim;
  return { x: R(aim.x - (tip.x - foot.x)), y: R(aim.y - (tip.y - foot.y)) };
}

registerStrike(
  ID,
  async (s: StrikeArgs) => {
    if (!LOOK_V3) return s.base?.();
    const u = s.attacker;
    const sc = s.scene;
    const spr = u.sprite;
    seedFx(u.uid * 41 + (s.target?.uid ?? 3));
    const ctx = s.ctx as CinematicContext<BattleEv>;
    const res = ctx.ev.result;
    const loses = res === 'attackerDestroyed' || res === 'bothDestroyed';
    const sgn: 1 | -1 = u.flipX ? -1 : 1;
    const pan = panAt(u.home.x);
    const f0 = strikeStartFrame(u);
    const REL = u.markFrame('attack', 'release', 5);
    const CON = u.markFrame('attack', 'contact', REL + 1);
    const feetHome: XY = { x: u.rest0.x, y: u.rest0.y + u.hover };
    // ---- the aim: the near face of the target's box (a direct slap: the duelist's point)
    const box = s.target && s.target.sprite.active ? worldBox(s.target) : null;
    const aim: XY = box ? { x: R(box.cx - sgn * Math.max(4, box.w / 2 - 4)), y: R(Math.min(s.to.y, box.cy + 4)) } : { x: R(s.to.x), y: R(s.to.y) };
    let feet = feetFor(u, aim, CON);
    // the stake stands on the floor line of the target (never floats over / under it)
    feet = { x: feet.x - sgn * (s.blocked ? 3 : 0), y: R(s.toGround.y + (s.direct ? 0 : 2)) };
    const dist = Math.hypot(feet.x - feetHome.x, feet.y - feetHome.y);
    // the little token travels IN FRONT of every unit on its way (a 0/0 straw slap must never be hidden behind a
    // big monster standing on the lane); it sinks back into its row when home
    const place = (p: XY, lift = 0) => {
      if (!spr.active || u.retired) return;
      spr.setPosition(R(p.x), R(p.y - u.hover - lift));
      spr.setDepth(unitDepth(p.y) + STRIKE_LIFT);
    };
    /** Hop along a straight line in `n` hops of `ms` each (whole px, a 7-px arc, a "tok" per landing). */
    const hops = async (a: XY, b: XY, n: number, ms: number, vol: number) => {
      for (let i = 0; i < n; i++) {
        const p0 = { x: a.x + ((b.x - a.x) * i) / n, y: a.y + ((b.y - a.y) * i) / n };
        const p1 = { x: a.x + ((b.x - a.x) * (i + 1)) / n, y: a.y + ((b.y - a.y) * (i + 1)) / n };
        await animate(sc, ms, (t) => place({ x: p0.x + (p1.x - p0.x) * t, y: p0.y + (p1.y - p0.y) * t }, Math.sin(Math.PI * t) * 7));
        place(p1);
        play('scarecrowHop', { volume: vol, pan: panAt(p1.x) });
        chaffBurst(sc, { x: R(p1.x), y: R(p1.y - 1) }, { x: 0, y: -0.3 }, p1.y, 3, DEPTH.FX - 1);
      }
    };
    // ---- the wind-up rocks back on the stake while it hops across
    const charge = takeCharge(u, 'scarecrowCharge', { volume: 0.8, pan });
    const nHops = Math.max(2, Math.min(5, R(dist / 24)));
    const hopMs = Math.max(95, Math.min(150, R(560 / nHops)));
    await Promise.all([u.playRange('attack', f0, REL), hops(feetHome, feet, nHops, hopMs, 0.7)]);
    // ---- release: the straw arm whips
    charge.stop(30);
    play('scarecrowWhip', { volume: 0.9, pan: panAt(feet.x) });
    if (spr.active && !u.claimed) u.pose('attack', REL);
    await sleep(sc, u.frameMs('attack', REL));
    if (spr.active && !u.claimed) u.pose('attack', CON);
    // ---- contact
    const tip = strawPoint(u, 'tipR') ?? aim;
    const hitAt: XY = s.direct ? { x: R(s.to.x), y: R(s.to.y) } : tip;
    s.impact(hitAt);
    const blow = norm({ x: s.toGround.x - u.home.x, y: s.toGround.y - u.home.y });
    if (s.blocked && !loses) {
      play('scarecrowBounce', { volume: 0.9, pan: panAt(tip.x) });
      chaffBurst(sc, tip, { x: -blow.x, y: -0.6 }, s.toGround.y, 12);
    } else {
      play('scarecrowSlap', { volume: 0.9, pan: panAt(hitAt.x) });
      chaffBurst(sc, hitAt, { x: blow.x, y: -0.3 }, s.direct ? hitAt.y + 20 : s.toGround.y, 18);
      void lightFlash(sc, hitAt.x, hitAt.y, PAL.gold3, 14, 160, { floorY: s.toGround.y, intensity: 0.4 });
    }
    // ---- a loser comes undone right here (its tokenVanish is ours)
    if (loses) {
      const vi = ctx.findType('tokenVanish', (e) => e.uid === u.uid, { until: (e) => e.type === 'attackDeclare' || e.type === 'turnStart' });
      if (vi >= 0 && usable(u)) {
        ctx.consumeAt(vi);
        // the counter blow knocks it back one long hop toward home (out of the defender's shadow, in the open),
        // and it comes undone where it lands
        await sleep(sc, 60);
        const kick: XY = { x: R(feet.x + (feetHome.x - feet.x) * Math.min(0.45, 22 / Math.max(1, dist))), y: R(feet.y + (feetHome.y - feet.y) * Math.min(0.45, 22 / Math.max(1, dist))) };
        if (spr.active && !u.claimed) u.pose('hitHeavy', 1);
        await animate(sc, 170, (t) => place({ x: feet.x + (kick.x - feet.x) * t, y: feet.y + (kick.y - feet.y) * t }, Math.sin(Math.PI * t) * 10));
        place(kick);
        play('scarecrowHop', { volume: 0.6, pan: panAt(kick.x) });
        chaffBurst(sc, { x: kick.x, y: kick.y - 1 }, { x: -blow.x, y: -0.3 }, kick.y, 5, DEPTH.FX - 1);
        await vanishV3(sc, ctx.views.field, ctx.events[vi] as VanishEv, { struck: true, push: { x: -blow.x, y: 0 } });
      }
      return;
    }
    await sleep(sc, u.frameMs('attack', CON));
    if (!spr.active || u.retired) return;
    // ---- home: hop back while the recovery frames play
    const back = u.rangeMs('attack', CON + 1, u.frameCount('attack'));
    void u.playRange('attack', CON + 1);
    if (s.blocked) {
      // thrown back off the guard: one long wobbling bounce, then hops
      const kick: XY = { x: R(feet.x - sgn * 10), y: feet.y };
      await animate(sc, 150, (t) => place({ x: feet.x + (kick.x - feet.x) * t, y: feet.y }, Math.sin(Math.PI * t) * 9));
      place(kick);
      play('scarecrowHop', { volume: 0.6, pan: panAt(kick.x) });
      await hops(kick, feetHome, Math.max(2, nHops - 1), Math.max(90, R(back / Math.max(2, nHops - 1)) - 10), 0.5);
    } else await hops(feet, feetHome, Math.max(2, nHops - 1), Math.max(90, Math.min(140, R(back / Math.max(2, nHops - 1)))), 0.5);
    place(feetHome);
    if (spr.active) spr.setDepth(unitDepth(u.home.y));
  },
  { priority: 20, name: 'd:straw_decoy_token:strike' },
);
