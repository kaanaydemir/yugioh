// Kutup Örsü (polar_anvil, lane D, C13) — its own v3 summon, strike and death (?look=v3 only; v1 falls through
// to the chain below every hook, byte-identical). Pieces: ./_polar_anvil-fx.ts; sounds: src/audio/v3/polar_anvil.ts.
//
// Summon (≈ 1.9 s at tempo): two half rings slide shut on the floor (N orange behind, S blue in front) while
// the art's two half-anvils slide in with a blue arc buzzing between them (polarAnvilSlide, held to 'land');
// on 'land' — KLAK: the weld cracks, the half rings become one blue ring that rolls out, a spark fountain
// bursts out of the seam and bounces on the marble, hit-stop 40 ms, shake 2 (polarAnvilKlak); the fountain
// sizzles (f5), the hammer-arms unfold and tap the face "tık tık" (f7).
// Strike "İtme Dalgası" (ranged; the anvil never leaves its tile): the mauls rise while iron dust streams
// heel (N) → horn (S) along three field arcs and the floor ring draws in (polarAnvilCharge, from the
// declaration); 'release' DANG — sparks off the face, the anvil's long ring (polarAnvilDang); 'contact' — three
// field-ring fronts roll out of the horn with their floor arcs and a moving blue floor light
// (polarAnvilWave, held until the first front lands); the first front is the impact (hit-stop of the
// mediumHeavy class, the struck body's material, the kit's knock-back), a ring steps out round the body and
// iron dust flies on (polarAnvilWaveHit); the next two fronts land as smaller pulses. Blocked: the fronts break
// on the guard and two echoes ring back (polarAnvilRebound), the anvil jolts. Direct: bigger fronts across
// the field to the duelist.
// Death: the art's pose (poles swap wildly f1–f3, the pieces repel f4–f8); the floor light strobes orange /
// blue with the swap (polarAnvilSwap), on 'dissolve' two half rings shoot apart — orange back, blue forward —
// with the iron dust (polarAnvilRepel), plates land (polarAnvilPlate ×2), and on the burst frame iron plates
// skid out over the floor while the last pole sparks die (polarAnvilBurst). Camera never moves (EF-8).

import { PAL, RAMPS, type Ramp } from '../../art/palette';
import type { GameEvent } from '../../engine/types';
import { DEPTH, LOOK_V3, type XY } from '../../view/layout';
import { lightFlash } from '../../view/light';
import { shake } from '../../vfx/core';
import { sleep } from '../../vfx/combat';
import { registerCardHook, registerStrike } from '../api';
import type { StrikeArgs } from '../_core/types';
import { strikeStartFrame } from '../_v3/clash';
import { deathV3 } from '../_v3/death';
import { summonPose } from '../_v3/summon';
import { atFrame, atMark, panAt, play, start, takeCharge } from '../_v3/sound';
import { sourceOwnsDeath } from '../strikes-b/_kit';
import { runSummon, type Stage } from '../summon-a/_kit';
import { faceSparks, fieldLines, fieldSeam, ironPlates, poleOf, poleStrobe, pushWave, repelBurst, seedFx, sparkFountain, waveContact, waveRebound } from './_polar_anvil-fx';

const ID = 'polar_anvil';
/** The hologram onset's tones: the blue field. */
const FIELD: Ramp = [PAL.night2, PAL.water1, PAL.water2, PAL.water3, PAL.water4];
type BattleEv = Extract<GameEvent, { type: 'battle' }>;

const norm = (p: XY): XY => {
  const l = Math.hypot(p.x, p.y) || 1;
  return { x: p.x / l, y: p.y / l };
};

// ================================================================ summon

async function entranceV3(S: Stage): Promise<void> {
  const sc = S.scene;
  const u = S.unit;
  const pan = panAt(S.home.x);
  seedFx(u.uid * 29 + 3);
  const seam = S.own(fieldSeam(sc, S.home, S.dir, S.depth));
  const slide = start('polarAnvilSlide', { volume: 0.8, pan });
  const pool = S.glow({ color: PAL.water3, radius: 26, intensity: 0.55, anim: 'flicker', fadeIn: 120 });
  // the field draws itself a beat before the halves come in
  await S.wait(90);
  // a short onset (160 ms): the dark iron halves are seen sliding in, not a long scan
  const p = summonPose(sc, u, { ramp: FIELD, holoMs: 160 });
  if (!p) {
    slide.stop(60);
    seam.destroy();
    return;
  }
  atMark(u, 'summon', 'land', () => {
    slide.stop(25);
    play('polarAnvilKlak', { volume: 0.95, pan });
    seam.weld();
    const face = poleOf(u, 'face') ?? { x: S.home.x, y: S.home.y - 24 };
    sparkFountain(sc, { x: face.x, y: face.y - 2 }, S.home.y, S.depth + 0.5);
    pool.setIntensity(1.1, 40);
    S.finale({ ring: 56, ramp: RAMPS.water, shake: 2, sfx: null, freezeMs: 40, playerRing: false });
  });
  atFrame(u, 'summon', 5, () => play('polarAnvilFount', { volume: 0.7, pan }), { late: false });
  atFrame(u, 'summon', 7, () => play('polarAnvilArms', { volume: 0.85, pan }), { late: false });
  await p.done;
  void pool.fadeOut(260);
}

registerCardHook(
  ID,
  'summon',
  async (ctx) => {
    if (!LOOK_V3) return ctx.base();
    const ev = ctx.ev;
    if (ev.from === 'field') return ctx.base();
    // the sovereign's split lands its pieces itself (lane D polar_sovereign)
    if (ev.from === 'graveyard' && ev.sourceUid !== null && ctx.cardId(ev.sourceUid) === 'polar_sovereign') return ctx.base();
    await runSummon(ctx, entranceV3, entranceV3);
  },
  { priority: 20, name: 'd:polar_anvil:summon' },
);

// ================================================================ strike

registerStrike(
  ID,
  async (s: StrikeArgs) => {
    if (!LOOK_V3) return s.base?.();
    const u = s.attacker;
    const sc = s.scene;
    seedFx(u.uid * 41 + (s.target?.uid ?? 3));
    const res = (s.ctx.ev as BattleEv).result;
    const loses = res === 'attackerDestroyed' || res === 'bothDestroyed';
    const sgn = u.flipX ? -1 : 1;
    const pan = panAt(u.home.x);
    const n = u.frameCount('attack');
    const f0 = strikeStartFrame(u);
    const REL = u.markFrame('attack', 'release', 5);
    const CON = u.markFrame('attack', 'contact', REL + 1);
    const HOLD = Math.min(n - 2, CON + 2);
    // ---- charge: the mauls rise, iron dust streams heel → horn (the declaration's hum goes on)
    const charge = takeCharge(u, 'polarAnvilCharge', { volume: 0.85, pan });
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      charge.stop(30);
      play('polarAnvilDang', { volume: 0.9, pan });
      const face = poleOf(u, 'face');
      if (face) faceSparks(sc, face, sgn, u.home.y);
      void shake(sc, 90, 1);
    };
    atFrame(u, 'attack', REL, release, { late: false });
    fieldLines(sc, u, u.rangeMs('attack', f0, REL) + 30);
    void u.playRange('attack', f0, HOLD);
    await sleep(sc, u.rangeMs('attack', f0, CON));
    release();
    // ---- contact: the push wave rolls out of the horn
    const horn = poleOf(u, 'horn') ?? u.muzzle();
    const from: XY = { x: horn.x + sgn * 5, y: horn.y };
    const aim = s.to;
    const dir = norm({ x: aim.x - from.x, y: aim.y - from.y });
    // the fronts land on the body's near side, not in its core
    const to: XY = s.direct ? { x: Math.round(aim.x), y: Math.round(aim.y) } : { x: Math.round(aim.x - dir.x * 9), y: Math.round(aim.y - dir.y * 9) };
    const dist = Math.hypot(to.x - from.x, to.y - from.y);
    const ms = Math.round(Math.max(110, Math.min(s.direct ? 380 : 320, dist * 2.1)));
    const waveSnd = start('polarAnvilWave', { volume: 0.85, pan });
    let arrived!: () => void;
    const arrival = new Promise<void>((r) => (arrived = r));
    const depth = s.target && s.target.sprite.active ? Math.max(DEPTH.FX - 1, s.target.sprite.depth + 0.5) : DEPTH.FX;
    const ground = s.target ? s.target.home : s.toGround;
    const wave = pushWave(sc, {
      from,
      to,
      g0: { x: from.x, y: u.home.y },
      g1: { x: ground.x - Math.round(dir.x * 10), y: ground.y },
      ms,
      depth,
      big: s.direct,
      blocked: s.blocked,
      onArrive: () => {
        waveSnd.stop(40);
        s.impact(to);
        play(s.blocked ? 'polarAnvilRebound' : 'polarAnvilWaveHit', { volume: s.blocked ? 0.8 : 0.85, pan: panAt(to.x) });
        if (s.blocked) {
          waveContact(sc, to, ground, { dir, depth, small: true });
          void waveRebound(sc, { from, to, depth });
        } else waveContact(sc, to, ground, { dir, depth, small: false });
        arrived();
      },
      onEcho: (i, at) => {
        if (s.blocked) return;
        void lightFlash(sc, at.x, at.y, PAL.water3, 18 - i * 3, 200, { floorY: ground.y, intensity: 0.6 });
      },
    });
    await arrival;
    if (loses || !u.sprite.active || u.retired) {
      void wave;
      return;
    }
    await sleep(sc, 60);
    if (!u.sprite.active || u.retired) return;
    if (s.blocked) {
      // the echo comes home: the anvil jolts on its base
      await u.play('hit');
      return;
    }
    // recovery: the mauls settle back to the face
    await u.playRange('attack', HOLD + 1);
  },
  { priority: 20, name: 'd:polar_anvil:strike' },
);

// ================================================================ death

registerCardHook(
  ID,
  'destroyed',
  (ctx) => {
    if (!LOOK_V3) return ctx.base();
    if (ctx.ev.location !== 'monster' || sourceOwnsDeath(ctx)) return ctx.base();
    const sc = ctx.scene;
    const u = ctx.views.field.unit(ctx.ev.uid);
    if (!u || u.retired || !u.sprite.active || !u.sprite.visible) return ctx.base();
    seedFx(u.uid * 53 + 7);
    const home = { ...u.home };
    const dir: 1 | -1 = u.flipX ? -1 : 1;
    const dissolveF = u.markFrame('death', 'dissolve', 4);
    atFrame(u, 'death', 1, () => poleStrobe(sc, home, Math.max(120, u.rangeMs('death', 1, dissolveF))), { maxMs: 3000 });
    atFrame(
      u,
      'death',
      dissolveF,
      () => {
        repelBurst(sc, { x: home.x, y: u.core().y }, home, dir, u.sprite.depth + 0.3);
        void shake(sc, 120, 2);
      },
      { maxMs: 3000 },
    );
    return deathV3(ctx, {
      fallback: () => ctx.base(),
      onBurst: () => ironPlates(sc, home, dir, DEPTH.FX - 1),
    });
  },
  { priority: 20, name: 'd:polar_anvil:death' },
);
