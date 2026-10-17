// src/art/animtime.ts — per-frame hold timing, marks, art lookups (v3 A1 contract).
import { describe, expect, it } from 'vitest';
import {
  animLengthMs,
  animList,
  animSpec,
  artAnimMs,
  artMarkFrame,
  artMarkMs,
  frameAtMs,
  frameEndMs,
  frameMs,
  framePoint,
  frameStartMs,
  hasAnim,
  hasHolds,
  holdOf,
  impactFrame,
  impactMs,
  isBaseAnim,
  isExtraAnim,
  markFrame,
  markMs,
  progressAtMs,
  rangeMs,
} from '../../src/art/animtime';
import { monsterArt } from '../../src/art/monsters';
import type { AnimSpec, MonsterArt } from '../../src/art/types';
import { MONSTER_ANIMS, MONSTER_ANIMS_EXTRA } from '../../src/art/types';
import { MONSTER_IDS } from '../../src/data/cards';

const plain: AnimSpec = { frames: 10, fps: 12, loop: false };
const held: AnimSpec = { frames: 5, fps: 10, loop: false, holds: [300, 50, 50, 400, 200] };
/** holds with gaps: frame 1 has none, frame 2 is 0, frame 4 is missing → 1000/fps = 100 */
const mixed: AnimSpec = { frames: 5, fps: 10, loop: true, holds: [250, NaN, 0, 60] };

/**
 * Phaser 3.90's playback of one animation, re-implemented from its source
 * (AnimationState.update + Animation.getFirstTick / getNextTick / nextFrame, skipMissedFrames):
 * nextTick = frame.duration || msPerFrame; the frame advances once the accumulator reaches it.
 * Returns the frame shown after each update.
 */
function phaserPlayback(spec: AnimSpec, dt: number, steps: number): { t: number; frame: number }[] {
  const msPerFrame = 1000 / spec.fps;
  const dur = (f: number) => (spec.holds?.[f] && spec.holds[f] > 0 ? spec.holds[f] : 0); // textures.ts passes only positive holds
  let frame = 0;
  let acc = 0;
  let nextTick = dur(0) || msPerFrame;
  let playing = true;
  let t = 0;
  const out: { t: number; frame: number }[] = [];
  for (let s = 0; s < steps; s++) {
    t += dt;
    if (playing) {
      acc += dt;
      const advance = () => {
        if (frame === spec.frames - 1 && !spec.loop) {
          playing = false; // state.complete()
          return;
        }
        frame = frame === spec.frames - 1 ? 0 : frame + 1;
        acc -= nextTick; // getNextTick
        nextTick = dur(frame) || msPerFrame;
      };
      // first advance on >=, the skipped ones (skipMissedFrames) on >
      if (acc >= nextTick) {
        advance();
        let safety = 0;
        while (playing && acc > nextTick && safety++ < 60) advance();
      }
    }
    out.push({ t, frame });
  }
  return out;
}

describe('spec timing', () => {
  it('without holds every frame lasts 1000/fps and sums exactly like the old formulas', () => {
    expect(hasHolds(plain)).toBe(false);
    expect(frameMs(plain, 3)).toBe(1000 / 12);
    for (let f = 0; f <= plain.frames; f++) {
      // MonsterUnit.impactMs / playToFrame: (frame / fps) * 1000 — bit-identical
      expect(frameStartMs(plain, f)).toBe((f / plain.fps) * 1000);
      // kits: ((frames - from) / fps) * 1000
      expect(rangeMs(plain, f, plain.frames)).toBe(((plain.frames - f) / plain.fps) * 1000);
    }
    expect(animLengthMs(plain)).toBe((plain.frames / plain.fps) * 1000);
  });

  it('holds replace 1000/fps per frame', () => {
    expect(hasHolds(held)).toBe(true);
    expect([0, 1, 2, 3, 4].map((f) => frameMs(held, f))).toEqual([300, 50, 50, 400, 200]);
    expect([0, 1, 2, 3, 4, 5].map((f) => frameStartMs(held, f))).toEqual([0, 300, 350, 400, 800, 1000]);
    expect(animLengthMs(held)).toBe(1000);
    expect(frameEndMs(held, 0)).toBe(300);
    expect(frameEndMs(held, 4)).toBe(1000);
    expect(rangeMs(held, 1, 4)).toBe(500);
    expect(rangeMs(held, 4, 1)).toBe(-500);
  });

  it('missing / zero / bad holds fall back to 1000/fps', () => {
    expect([0, 1, 2, 3, 4].map((f) => holdOf(mixed, f))).toEqual([250, 0, 0, 60, 0]);
    expect([0, 1, 2, 3, 4].map((f) => frameMs(mixed, f))).toEqual([250, 100, 100, 60, 100]);
    expect(animLengthMs(mixed)).toBe(610);
    expect(hasHolds({ frames: 3, fps: 10, loop: false, holds: [0, 0, 0] })).toBe(false);
  });

  it('clamps frame indices and supports fractional ranges', () => {
    expect(frameStartMs(held, -3)).toBe(0);
    expect(frameStartMs(held, 99)).toBe(1000);
    expect(rangeMs(held, 0.5, 1)).toBe(150);
    expect(rangeMs(held, 0.5, 3.5)).toBe(150 + 50 + 50 + 200);
    expect(rangeMs(plain, 1.5, 2)).toBe((0.5 / 12) * 1000);
  });

  it('frameAtMs: frame f is shown on [start(f), start(f+1))', () => {
    expect(frameAtMs(held, -10)).toBe(0);
    expect(frameAtMs(held, 0)).toBe(0);
    expect(frameAtMs(held, 299.9)).toBe(0);
    expect(frameAtMs(held, 300)).toBe(1);
    expect(frameAtMs(held, 349)).toBe(1);
    expect(frameAtMs(held, 350)).toBe(2);
    expect(frameAtMs(held, 400)).toBe(3);
    expect(frameAtMs(held, 799)).toBe(3);
    expect(frameAtMs(held, 800)).toBe(4);
    // one-shot: holds the last frame
    expect(frameAtMs(held, 1000)).toBe(4);
    expect(frameAtMs(held, 5000)).toBe(4);
    // loop: wraps
    expect(frameAtMs(mixed, 610)).toBe(0);
    expect(frameAtMs(mixed, 610 + 250)).toBe(1);
    expect(frameAtMs(mixed, 2 * 610 + 455)).toBe(3);
    expect(frameAtMs({ frames: 1, fps: 10, loop: false }, 500)).toBe(0);
  });

  it('frameAtMs matches Phaser playback (dt that never ties a frame boundary)', () => {
    for (const spec of [plain, held, mixed, { ...held, loop: true }]) {
      for (const dt of [7, 13, 1000 / 60 + 0.0001]) {
        for (const { t, frame } of phaserPlayback(spec, dt, 400)) {
          // ties aside, Phaser shows frameAtMs(t) — up to float error right at a boundary
          const exp = frameAtMs(spec, t);
          if (exp !== frame) expect(Math.abs(t - nearestBoundary(spec, t))).toBeLessThan(1e-6);
        }
      }
    }
  });

  it('progressAtMs', () => {
    expect(progressAtMs(held, 0)).toBe(0);
    expect(progressAtMs(held, 250)).toBe(0.25);
    expect(progressAtMs(held, 2000)).toBe(1);
    expect(progressAtMs(mixed, 610 + 61)).toBeCloseTo(0.1);
  });
});

function nearestBoundary(spec: AnimSpec, t: number): number {
  const total = animLengthMs(spec);
  const local = spec.loop ? t % total : t;
  let best = Infinity;
  for (let f = 0; f <= spec.frames; f++) {
    const b = frameStartMs(spec, f);
    if (Math.abs(b - local) < Math.abs(best - local)) best = b;
  }
  return spec.loop ? t - local + best : best;
}

describe('marks', () => {
  const spec: AnimSpec = { frames: 8, fps: 10, loop: false, holds: [200, 100, 100, 40, 40, 300, 100, 100], marks: { impact: 3, recover: 5, land: 42 } };
  it('markFrame: defined, fallback, clamped', () => {
    expect(markFrame(spec, 'impact', 0)).toBe(3);
    expect(markFrame(spec, 'release', 6)).toBe(6);
    expect(markFrame(spec, 'charge', -5)).toBe(0);
    expect(markFrame(spec, 'land', 0)).toBe(7);
  });
  it('markMs = start of the mark frame', () => {
    expect(markMs(spec, 'impact', 0)).toBe(400);
    expect(markMs(spec, 'recover', 0)).toBe(480);
  });
});

/** A test-only art: an old monster plus two extras (declared in non-canonical key order). */
function withExtras(base: MonsterArt): MonsterArt {
  return {
    ...base,
    attackImpactFrame: 5,
    anims: { ...base.anims, attack: { ...base.anims.attack, marks: { impact: 2 } } },
    extraAnims: {
      victory: { frames: 3, fps: 8, loop: false },
      summon: { frames: 4, fps: 10, loop: false, holds: [500, 80, 80, 300], marks: { land: 1 } },
      death: { frames: 0, fps: 10, loop: false },
    },
    drawExtra(p, _anim, frame) {
      base.draw(p, 'idle', frame);
    },
    points(anim, frame) {
      return anim === 'summon' ? { head: { x: 10 + frame, y: 4 }, muzzle: { x: 1, y: 2 } } : {};
    },
  };
}

describe('art lookups', () => {
  it('the old monsters have exactly the five base anims and the old impact timing', () => {
    for (const id of MONSTER_IDS) {
      const art = monsterArt(id);
      expect(animList(art)).toEqual(MONSTER_ANIMS);
      for (const a of MONSTER_ANIMS_EXTRA) expect(hasAnim(art, a)).toBe(false);
      expect(impactFrame(art)).toBe(art.attackImpactFrame);
      // MonsterUnit.impactMs today: (attackImpactFrame / anims.attack.fps) * 1000
      expect(impactMs(art)).toBe((art.attackImpactFrame / art.anims.attack.fps) * 1000);
      for (const a of MONSTER_ANIMS) {
        const s = art.anims[a];
        expect(s.holds).toBeUndefined();
        // MonsterUnit.play safety net: (frames / fps) * 1000
        expect(animLengthMs(s)).toBe((s.frames / s.fps) * 1000);
        expect(artAnimMs(art, a)).toBe((s.frames / s.fps) * 1000);
      }
    }
  });

  it('extras: canonical order, need drawExtra, empty specs are skipped', () => {
    const art = withExtras(monsterArt('crystal_wyrm'));
    expect(animList(art)).toEqual([...MONSTER_ANIMS, 'summon', 'victory']);
    expect(hasAnim(art, 'summon')).toBe(true);
    expect(hasAnim(art, 'death')).toBe(false);
    expect(animSpec(art, 'revive')).toBeUndefined();
    expect(animList({ ...art, drawExtra: undefined })).toEqual(MONSTER_ANIMS);
    expect(artAnimMs(art, 'summon')).toBe(960);
    expect(artAnimMs(art, 'death')).toBe(0);
    expect(isExtraAnim('summon') && isBaseAnim('idle') && !isExtraAnim('idle') && !isBaseAnim('toGuard')).toBe(true);
  });

  it('impact mark overrides attackImpactFrame; other marks fall back', () => {
    const art = withExtras(monsterArt('crystal_wyrm'));
    expect(impactFrame(art)).toBe(2);
    expect(impactMs(art)).toBe((2 / art.anims.attack.fps) * 1000);
    expect(artMarkFrame(art, 'summon', 'land')).toBe(1);
    expect(artMarkMs(art, 'summon', 'land')).toBe(500);
    expect(artMarkFrame(art, 'victory', 'land', 2)).toBe(2);
    expect(artMarkMs(art, 'death', 'dissolve')).toBe(0);
    const old = monsterArt('stone_sentinel');
    expect(artMarkFrame(old, 'attack', 'impact')).toBe(old.attackImpactFrame);
  });

  it('framePoint: points() first, then muzzle / anchor / core', () => {
    const base = monsterArt('abyss_magus');
    const art = withExtras(base);
    expect(framePoint(art, 'summon', 3, 'head')).toEqual({ x: 13, y: 4 });
    expect(framePoint(art, 'summon', 3, 'muzzle')).toEqual({ x: 1, y: 2 });
    expect(framePoint(art, 'idle', 0, 'muzzle')).toEqual(base.muzzle);
    expect(framePoint(art, 'idle', 0, 'feet')).toEqual({ x: base.anchorX, y: base.anchorY });
    expect(framePoint(base, 'attack', 4, 'staff')).toEqual(base.core);
  });
});
