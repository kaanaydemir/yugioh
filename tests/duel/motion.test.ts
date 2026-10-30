// A1 item 5 — weight profiles (src/duel/motion.ts). Pins the profile table to the A0 starting
// values (docs/v3/a0/altyapi-olcum.md §2.5), the class of each of the 12 monsters (plan §2), the
// DONE criterion of the guard knock-back (heavy ≤ 1 px, light 3 px) and — with the profiles
// off (the default look) — that every reaction value is exactly the weight-blind number it was.

import { describe, expect, it } from 'vitest';
import { MONSTER_IDS, type MonsterId } from '../../src/data/cards';
import { monsterArt } from '../../src/art/monsters';
import { WEIGHT_CLASSES, type WeightClass } from '../../src/art/types';
import {
  DEFAULT_WEIGHT,
  LEGACY_GUARD_PUSH_PX,
  LEGACY_HIT_JITTER_PX,
  LEGACY_SHAKE_PX,
  LEGACY_STOP_MS,
  MOTION_PROFILES,
  WEIGHT_MOTION,
  blowSourceUid,
  contactShakePx,
  contactStopMs,
  guardPushPx,
  motionProfile,
  pickByPower,
  reactGuardPushPx,
  reactGuardReturnEase,
  reactHitJitterPx,
  reactShakePx,
  reactStopMs,
  weightOf,
  type Power,
} from '../../src/duel/motion';

const POWERS: Power[] = [1, 2, 3];
/** Heaviest → lightest along the hit-stop / knock-back axis (floater and caster are off-axis). */
const AXIS: WeightClass[] = ['heavy', 'mediumHeavy', 'medium', 'mediumLight', 'light'];
/** Phaser 3.90 ease names the table may use (Phaser.Math.Easing, "Name.In/Out/InOut"). */
const EASES = new Set(
  ['Quad', 'Cubic', 'Quart', 'Quint', 'Sine', 'Expo', 'Circ', 'Back', 'Elastic', 'Bounce'].flatMap((n) => [`${n}.In`, `${n}.Out`, `${n}.InOut`]).concat(['Linear']),
);

describe('profile table', () => {
  it('has one profile per WeightClass, keyed by its own class', () => {
    expect(Object.keys(MOTION_PROFILES).sort()).toEqual([...WEIGHT_CLASSES].sort());
    for (const w of WEIGHT_CLASSES) expect(MOTION_PROFILES[w].weight).toBe(w);
  });

  it('is well-formed: ranges lo ≤ hi, whole pixels, valid Phaser eases, knock-back grows with power', () => {
    for (const w of WEIGHT_CLASSES) {
      const m = MOTION_PROFILES[w];
      for (const r of [m.anticipationMs, m.contactStopMs, m.shakePx]) {
        expect(r[0], w).toBeGreaterThanOrEqual(0);
        expect(r[0], w).toBeLessThanOrEqual(r[1]);
      }
      for (const px of [...m.shakePx, ...m.guardPushPx, m.hitJitterPx]) expect(Number.isInteger(px), `${w} px ${px}`).toBe(true);
      expect(m.guardPushPx[0], w).toBeLessThanOrEqual(m.guardPushPx[1]);
      expect(m.guardPushPx[1], w).toBeLessThanOrEqual(m.guardPushPx[2]);
      expect(m.recoveryMs, w).toBeGreaterThan(0);
      expect(EASES.has(m.releaseEase), `${w} ${m.releaseEase}`).toBe(true);
      expect(EASES.has(m.guardReturnEase), `${w} ${m.guardReturnEase}`).toBe(true);
    }
  });

  it('holds the A0 starting values (altyapi-olcum §2.5)', () => {
    const doc: Record<WeightClass, { ant?: [number, number]; ease?: string; stop: [number, number]; shake: [number, number]; rec?: number }> = {
      heavy: { ant: [280, 360], ease: 'Cubic.In', stop: [100, 130], shake: [3, 4], rec: 450 },
      mediumHeavy: { ant: [220, 300], ease: 'Quad.In', stop: [80, 110], shake: [3, 3], rec: 350 },
      medium: { ant: [160, 220], ease: 'Quad.Out', stop: [60, 80], shake: [2, 2], rec: 280 },
      mediumLight: { ant: [90, 150], ease: 'Expo.Out', stop: [40, 60], shake: [1, 2], rec: 200 },
      light: { ease: 'Quad.In', stop: [40, 40], shake: [1, 1] }, // "take-off + glide", "dive (in-quad)"
      floater: { stop: [30, 40], shake: [0, 1] }, // "sine sway", "soft"
      caster: { stop: [60, 60], shake: [1, 2] }, // "gather 300 ms + channel", "sudden release"
    };
    for (const w of WEIGHT_CLASSES) {
      const m = MOTION_PROFILES[w];
      const d = doc[w];
      if (d.ant) expect(m.anticipationMs, w).toEqual(d.ant);
      if (d.ease) expect(m.releaseEase, w).toBe(d.ease);
      if (d.rec) expect(m.recoveryMs, w).toBe(d.rec);
      expect(m.contactStopMs, w).toEqual(d.stop);
      expect(m.shakePx, w).toEqual(d.shake);
    }
    expect(MOTION_PROFILES.caster.anticipationMs[0]).toBeGreaterThanOrEqual(300);
    expect(MOTION_PROFILES.heavy.recovery).toBe('settle');
    expect(MOTION_PROFILES.caster.recovery).toBe('drape');
  });

  it('orders the classes: heavier blows freeze longer, heavier guards are pushed less', () => {
    for (let i = 1; i < AXIS.length; i++) {
      const heavier = MOTION_PROFILES[AXIS[i - 1]];
      const lighter = MOTION_PROFILES[AXIS[i]];
      const label = `${AXIS[i - 1]} vs ${AXIS[i]}`;
      expect(heavier.contactStopMs[0], label).toBeGreaterThanOrEqual(lighter.contactStopMs[0]);
      expect(heavier.contactStopMs[1], label).toBeGreaterThanOrEqual(lighter.contactStopMs[1]);
      expect(heavier.anticipationMs[0], label).toBeGreaterThanOrEqual(lighter.anticipationMs[0] - 30); // light: take-off
      for (const p of POWERS) expect(guardPushPx(AXIS[i - 1], p), `${label} p${p}`).toBeLessThanOrEqual(guardPushPx(AXIS[i], p));
    }
    expect(MOTION_PROFILES.floater.contactStopMs[1]).toBeLessThanOrEqual(MOTION_PROFILES.light.contactStopMs[0]);
  });
});

describe('DONE: guard knock-back by weight', () => {
  it('heavy ≤ 1 px at every power (0 px below power 3), light 3 px at every power', () => {
    for (const p of POWERS) {
      expect(guardPushPx('heavy', p)).toBeLessThanOrEqual(1);
      expect(guardPushPx('light', p)).toBe(3);
    }
    expect(guardPushPx('heavy', 1)).toBe(0);
    expect(guardPushPx('heavy', 2)).toBe(0);
  });

  it('Taş Muhafız does not move when the hawk bounces off it (sbHawkBlocked: guardReact power 1)', () => {
    const sentinel = monsterArt('stone_sentinel');
    expect(reactGuardPushPx(sentinel, 1, true)).toBe(0);
    expect(reactGuardPushPx({ art: sentinel }, 1, true)).toBe(0); // as MonsterUnit passes itself
    expect(reactGuardPushPx(monsterArt('storm_hawk'), 1, true)).toBe(3);
    // the old weight-blind push it replaces (still the default look)
    expect(reactGuardPushPx(sentinel, 1, false)).toBe(2);
  });

  it('a heavy guard springs back without overshoot', () => {
    expect(MOTION_PROFILES.heavy.guardReturnEase.startsWith('Back')).toBe(false);
    expect(reactGuardReturnEase('heavy', true)).toBe('Quad.Out');
  });
});

describe('the 12 monsters (plan §2)', () => {
  const PLAN: Partial<Record<MonsterId, WeightClass>> = {
    crystal_wyrm: 'mediumHeavy', // orta-ağır
    abyss_magus: 'caster', // süzülen büyücü
    magma_titan: 'heavy', // ağır
    coral_serpent: 'medium', // orta
    ember_wolf: 'mediumLight', // orta-hafif
    tide_golem: 'heavy', // ağır
    storm_hawk: 'light', // hafif (uçan)
    stone_sentinel: 'heavy', // ağır
    lumen_sprite: 'floater', // hafif (süzülen)
    shade_assassin: 'mediumLight', // orta-hafif
    volt_lizard: 'mediumLight', // orta-hafif
    thorn_lurker: 'medium', // orta
  };

  it('each art declares its weight class', () => {
    expect(MONSTER_IDS.length).toBeGreaterThanOrEqual(12);
    for (const id of MONSTER_IDS.slice(0, 12)) {  // the original 12 (later cards use the placeholder weight)
      expect(monsterArt(id).weight, id).toBe(PLAN[id]);
      expect(weightOf(monsterArt(id)), id).toBe(PLAN[id]);
      expect(motionProfile(monsterArt(id)).weight, id).toBe(PLAN[id]);
    }
  });
});

describe('lookups', () => {
  it('weightOf: absent / unknown → medium; accepts a class, an art or a unit-like { art }', () => {
    expect(DEFAULT_WEIGHT).toBe('medium');
    expect(weightOf(null)).toBe('medium');
    expect(weightOf(undefined)).toBe('medium');
    expect(weightOf({})).toBe('medium');
    expect(weightOf({ weight: 'nope' as WeightClass })).toBe('medium');
    expect(weightOf('light')).toBe('light');
    expect(weightOf({ weight: 'caster' })).toBe('caster');
    expect(weightOf({ art: { weight: 'heavy' } })).toBe('heavy');
  });

  it('pickByPower: power 1 / 2 / 3 → lo / round(mid) / hi (out-of-range powers clamp)', () => {
    expect(POWERS.map((p) => pickByPower([100, 130], p))).toEqual([100, 115, 130]);
    expect(POWERS.map((p) => pickByPower([3, 4], p))).toEqual([3, 4, 4]);
    expect(pickByPower([40, 60], 0)).toBe(40);
    expect(pickByPower([40, 60], 5)).toBe(60);
    expect(pickByPower([40, 60], undefined)).toBe(50);
    expect(POWERS.map((p) => contactStopMs('heavy', p))).toEqual([100, 115, 130]);
    expect(POWERS.map((p) => contactStopMs('light', p))).toEqual([40, 40, 40]);
    expect(POWERS.map((p) => contactShakePx('mediumLight', p))).toEqual([1, 2, 2]);
  });
});

describe('the switch: profiles off = the old weight-blind reactions, bit for bit', () => {
  it('is off by default (no ?look=v3 / __NEON_MOTION in the test environment)', () => {
    expect(WEIGHT_MOTION).toBe(false);
  });

  it('legacy tables are the literals the call sites used', () => {
    for (const p of POWERS) {
      expect(LEGACY_STOP_MS[p - 1]).toBe([0, 60, 80, 100][p]); // vfx/combat impact, guardReact
      expect(LEGACY_SHAKE_PX[p - 1]).toBe([0, 1.5, 3, 5][p]); // vfx/combat impact
      expect(LEGACY_GUARD_PUSH_PX[p - 1]).toBe(p >= 2 ? 3 : 2); // MonsterUnit.guardHit
      expect(LEGACY_HIT_JITTER_PX[p - 1]).toBe(p >= 2 ? 1 : 0.5); // vfx/combat impact
    }
  });

  it('off: every reaction value ignores the weights (and the default `on` is off)', () => {
    const sources = [null, undefined, ...WEIGHT_CLASSES, ...MONSTER_IDS.map((id) => monsterArt(id))];
    for (const p of POWERS)
      for (const s of sources) {
        expect(reactStopMs(p, s, false)).toBe([0, 60, 80, 100][p]);
        expect(reactStopMs(p, s)).toBe([0, 60, 80, 100][p]);
        expect(reactShakePx(p, s, false)).toBe([0, 1.5, 3, 5][p]);
        expect(reactShakePx(p, s)).toBe([0, 1.5, 3, 5][p]);
        expect(reactGuardPushPx(s, p, false)).toBe(p >= 2 ? 3 : 2);
        expect(reactGuardPushPx(s, p)).toBe(p >= 2 ? 3 : 2);
        expect(reactHitJitterPx(s, p)).toBe(p >= 2 ? 1 : 0.5);
        expect(reactGuardReturnEase(s)).toBe('Back.Out');
      }
  });

  it('on: the source drives hit-stop / shake (none → legacy), the target its own push / jitter', () => {
    const titan = monsterArt('magma_titan');
    const hawk = monsterArt('storm_hawk');
    expect(POWERS.map((p) => reactStopMs(p, titan, true))).toEqual([100, 115, 130]);
    expect(POWERS.map((p) => reactStopMs(p, hawk, true))).toEqual([40, 40, 40]);
    expect(POWERS.map((p) => reactShakePx(p, titan, true))).toEqual([3, 4, 4]);
    expect(POWERS.map((p) => reactStopMs(p, null, true))).toEqual([60, 80, 100]);
    expect(POWERS.map((p) => reactShakePx(p, undefined, true))).toEqual([1.5, 3, 5]);
    expect(reactHitJitterPx(titan, 2, true)).toBe(0);
    expect(reactHitJitterPx(hawk, 1, true)).toBe(1);
  });
});

describe('blowSourceUid: who dealt the blow a unit reacts to', () => {
  const battle = { type: 'battle', attackerUid: 7, targetUid: 12 };
  it('battle: the target reacts to the attacker, the attacker (counter blow) to the target', () => {
    expect(blowSourceUid(battle, 12)).toBe(7);
    expect(blowSourceUid(battle, 7)).toBe(12);
  });
  it('null outside a battle, for a bystander, and on a direct attack for the attacker', () => {
    expect(blowSourceUid({ type: 'destroy', attackerUid: 7, targetUid: 12 }, 12)).toBeNull();
    expect(blowSourceUid(battle, 3)).toBeNull();
    expect(blowSourceUid({ type: 'battle', attackerUid: 7, targetUid: null }, 7)).toBeNull();
    expect(blowSourceUid(null, 7)).toBeNull();
  });
});
