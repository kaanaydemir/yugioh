// A1 item 4 — MonsterUnit timing unity. MonsterUnit (and the cinematic kits' pose / playFrom
// wrappers) now read every animation duration through src/art/animtime.ts. Phaser timers fire
// when the accumulated frame delta reaches the duration, so even a 1-ulp change of a duration
// can move an event by a whole frame: for the old monsters (no per-frame holds) each helper must
// return exactly the float the replaced `fps` arithmetic produced. This pins that for all 12
// monsters, expression by expression (the call sites are named in each test).

import { describe, expect, it } from 'vitest';
import { MONSTER_IDS } from '../../src/data/cards';
import { monsterArt } from '../../src/art/monsters';
import { MONSTER_ANIMS, type AnimSpec } from '../../src/art/types';
import { animLengthMs, frameMs, frameStartMs, impactFrame, impactMs, rangeMs } from '../../src/art/animtime';

const arts = MONSTER_IDS.map((id) => monsterArt(id));

function eachSpec(fn: (spec: AnimSpec, label: string) => void): void {
  for (const art of arts) for (const anim of MONSTER_ANIMS) fn(art.anims[anim], `${art.id}.${anim}`);
}

describe('old monsters: helper durations are bit-identical to the fps arithmetic they replace', () => {
  it('have no per-frame holds (the precondition)', () => {
    eachSpec((spec, label) => expect(spec.holds, label).toBeUndefined());
  });

  it('play() safety net: animLengthMs === (frames / fps) * 1000 (also guardHitFromSprite)', () => {
    eachSpec((spec, label) => {
      expect(animLengthMs(spec), label).toBe((spec.frames / spec.fps) * 1000);
      expect(animLengthMs(spec), label).toBe((spec.frames / Math.max(1, spec.fps)) * 1000);
    });
  });

  it('playToFrame safety net / summon-b whenFrame: rangeMs(0, f + 1) === ((f + 1) / fps) * 1000', () => {
    eachSpec((spec, label) => {
      for (let f = 0; f < spec.frames; f++) expect(rangeMs(spec, 0, f + 1) * 1.6 + 300, `${label} f${f}`).toBe(((f + 1) / spec.fps) * 1000 * 1.6 + 300);
    });
  });

  it('playToFrame on a guarding unit: frameStartMs(f) === (f / max(1, fps)) * 1000', () => {
    eachSpec((spec, label) => {
      for (let f = 0; f < spec.frames; f++) expect(frameStartMs(spec, Math.max(0, f)), `${label} f${f}`).toBe((Math.max(0, f) / Math.max(1, spec.fps)) * 1000);
    });
  });

  it('kits playFrom safety nets: rangeMs(from, frames) === ((frames - from) / fps) * 1000', () => {
    eachSpec((spec, label) => {
      for (let from = 0; from < spec.frames; from++) {
        const old = ((spec.frames - from) / spec.fps) * 1000;
        const now = rangeMs(spec, from, spec.frames);
        expect(now, `${label} from ${from}`).toBe(old);
        // the exact safety expressions of the four kits
        expect(now * 1.5 + 200).toBe(old * 1.5 + 200); // strikes-a / summon-a
        expect(now * 1.6 + 250).toBe(old * 1.6 + 250); // strikes-b / summon-b
      }
    });
  });

  it('summon-a untilFrame: rangeMs(cur, f + 1) === ((f - cur + 1) / fps) * 1000', () => {
    eachSpec((spec, label) => {
      for (let cur = 0; cur < spec.frames; cur++)
        for (let f = cur + 1; f < spec.frames; f++) expect(rangeMs(spec, cur, f + 1) * 1.5 + 150, `${label} ${cur}→${f}`).toBe(((f - cur + 1) / spec.fps) * 1000 * 1.5 + 150);
    });
  });

  it('kits frameMs / _defaults charge windows: frameMs(spec, f) === 1000 / fps', () => {
    eachSpec((spec, label) => {
      for (let f = 0; f < spec.frames; f++) expect(frameMs(spec, f), `${label} f${f}`).toBe(1000 / spec.fps);
    });
  });

  it('summon-b frameMs(u, anim, from, to): rangeMs === ((to - from) / fps) * 1000 (both directions)', () => {
    eachSpec((spec, label) => {
      for (let a = 0; a <= spec.frames; a++)
        for (let b = 0; b <= spec.frames; b++) expect(rangeMs(spec, a, b), `${label} ${a}→${b}`).toBe(((b - a) / spec.fps) * 1000);
    });
  });

  it('impactMs / impactFrame === attackImpactFrame arithmetic (MonsterUnit.impactMs, chains_of_light)', () => {
    for (const art of arts) {
      expect(impactFrame(art), art.id).toBe(art.attackImpactFrame);
      expect(impactMs(art), art.id).toBe((art.attackImpactFrame / art.anims.attack.fps) * 1000);
    }
  });

  it('_defaults darkOrb: rangeMs(0, impact - 1) and frameMs(impact - 1)', () => {
    for (const art of arts) {
      const spec = art.anims.attack;
      const pre = art.attackImpactFrame - 1;
      expect(Math.max(0, rangeMs(spec, 0, pre) - 120), art.id).toBe(Math.max(0, ((art.attackImpactFrame - 1) / spec.fps) * 1000 - 120));
      expect(120 + frameMs(spec, pre), art.id).toBe(120 + 1000 / spec.fps);
    }
  });

  it('frame-multiple sites (k × 1000/fps) that moved to rangeMs / impactMs match for the monsters that use them', () => {
    // summon-a stage.roar: toPeak = (peak - from) × (1000 / fps) → rangeMs(roar, from, peak)
    for (const id of ['crystal_wyrm', 'abyss_magus', 'magma_titan', 'coral_serpent', 'ember_wolf', 'tide_golem'] as const) {
      const spec = monsterArt(id).anims.roar;
      for (let from = 0; from < spec.frames; from++)
        for (let peak = from; peak < spec.frames; peak++) expect(rangeMs(spec, from, peak), `${id} ${from}→${peak}`).toBe((peak - from) * (1000 / spec.fps));
    }
    // strikes-a abyss_magus: launchAt = attackImpactFrame × frameMs(attack) → impactMs
    const magus = monsterArt('abyss_magus');
    expect(impactMs(magus)).toBe(magus.attackImpactFrame * (1000 / magus.anims.attack.fps));
  });
});

describe('per-frame holds reach the timing helpers', () => {
  it('a held attack moves the impact and the safety nets with it', () => {
    const spec: AnimSpec = { frames: 6, fps: 10, loop: false, holds: [300, 0, 0, 40, 40, 200] };
    expect(frameMs(spec, 0)).toBe(300);
    expect(frameMs(spec, 1)).toBe(100);
    expect(frameStartMs(spec, 3)).toBe(500);
    expect(animLengthMs(spec)).toBe(780);
    expect(rangeMs(spec, 4, spec.frames)).toBe(240);
  });
});
