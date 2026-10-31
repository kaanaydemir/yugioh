// Çamur Pençe Ruhu (v3 art): every anim exists with marks and holds, validateArt (normal tier) reports no errors, the
// rig is deterministic, P2 is a relight of the same silhouette, the puddle (the "feet") never moves in idle / guard,
// the body palette avoids the player colours, the eyes are lights (violet, never outlined) and the death liquefies
// into the puddle (the mask sinks last: no body above the puddle on the last frame).

import { describe, expect, it } from 'vitest';
import art from '../../src/art/monsters-v3/mudgrasp_spirit';
import { PAL, RAMPS } from '../../src/art/palette';
import { drawFrame, validateArt } from '../../src/art/rigkit';
import type { AnyMonsterAnim, AnimSpec } from '../../src/art/types';
import { DEATH_PRESETS } from '../../src/cinematics/_v3/presets';

const ALL: readonly AnyMonsterAnim[] = ['idle', 'guard', 'attack', 'roar', 'hit', 'toGuard', 'fromGuard', 'hitHeavy', 'hitMagic', 'summon', 'death', 'revive', 'special'];
const specOf = (a: AnyMonsterAnim): AnimSpec => ((art.anims as Record<string, AnimSpec>)[a] ?? (art.extraAnims as Record<string, AnimSpec>)[a])!;
const opaque = (a: AnyMonsterAnim, f: number, light: 'left' | 'right' = 'left') => {
  const p = drawFrame(art, a, f, light);
  let n = 0;
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (p.isOpaque(x, y)) n++;
  return { p, n };
};

describe('mudgrasp_spirit', () => {
  it('has every anim, marks and holds; medium weight, relit P2, hover 0', () => {
    for (const a of ALL) {
      const spec = specOf(a);
      expect(spec, a).toBeTruthy();
      expect(spec.holds?.length, a).toBe(spec.frames);
    }
    expect(art.anims.attack.marks?.release).toBe(art.attackImpactFrame);
    expect(art.anims.attack.marks?.contact).toBeDefined();
    expect(specOf('special').marks?.release).toBeDefined();
    expect(specOf('summon').marks?.land).toBeDefined();
    expect(specOf('death').marks?.dissolve).toBeDefined();
    expect(specOf('idle').frames).toBeGreaterThanOrEqual(16);
    expect(art.p2).toBe('relight');
    expect(art.weight).toBe('medium');
    expect(art.hover).toBe(0);
  });

  it('validateArt (normal tier, projectile attack) has no errors', () => {
    expect(validateArt(art, { tier: 'normal', attack: 'projectile' }).filter((f) => f.severity === 'error').map((f) => `${f.rule} ${f.anim}`)).toEqual([]);
  });

  it('fits the medium sheet budget (KK-13)', () => {
    const frames = ALL.reduce((s, a) => s + specOf(a).frames, 0);
    expect(frames).toBeLessThanOrEqual(140);
    expect(art.w * art.h * 4 * frames).toBeLessThanOrEqual(3.6e6);
  });

  it('draws deterministically and P2 keeps the silhouette', () => {
    for (const [a, f] of [['idle', 0], ['special', 7], ['death', 6]] as const) {
      const x = drawFrame(art, a, f, 'left');
      const y = drawFrame(art, a, f, 'left');
      expect(x.data.every((v: number, i: number) => v === y.data[i]), `${a} ${f}`).toBe(true);
      const r = drawFrame(art, a, f, 'right');
      let diff = 0;
      for (let yy = 0; yy < x.h; yy++) for (let xx = 0; xx < x.w; xx++) if (x.isOpaque(xx, yy) !== r.isOpaque(xx, yy)) diff++;
      expect(diff, `${a} ${f}`).toBe(0);
    }
  });

  it('is a 64-class body: idle f0 between 1800 and 3000 px, bbox at least 60 wide', () => {
    const { p, n } = opaque('idle', 0);
    expect(n).toBeGreaterThan(1800);
    expect(n).toBeLessThan(3000);
    expect(p.bounds()!.w).toBeGreaterThanOrEqual(60);
  });

  it('keeps the puddle (lowest 6 rows) still through idle, guard and the transitions (HA-9)', () => {
    const band = (a: AnyMonsterAnim, f: number) => {
      const p = drawFrame(art, a, f, 'left');
      let bottom = -1;
      for (let y = p.h - 1; y >= 0 && bottom < 0; y--) for (let x = 0; x < p.w; x++) if (p.isOpaque(x, y)) { bottom = y; break; }
      let x0 = p.w;
      let x1 = -1;
      for (let y = bottom - 5; y <= bottom; y++) for (let x = 0; x < p.w; x++) if (p.isOpaque(x, y)) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
      return `${bottom}:${x0}..${x1}`;
    };
    const ref = band('idle', 0);
    for (const a of ['idle', 'guard', 'toGuard', 'fromGuard'] as const) for (let f = 0; f < specOf(a).frames; f++) expect(band(a, f), `${a} ${f}`).toBe(ref);
  });

  it('uses only earth / stone / void + ink + white (eyes) — never the player colours', () => {
    const ok = new Set<number>([PAL.ink, PAL.white, ...RAMPS.earth, ...RAMPS.stone, ...RAMPS.void]);
    for (const a of ALL)
      for (let f = 0; f < specOf(a).frames; f++) {
        const p = drawFrame(art, a, f, f % 2 ? 'right' : 'left');
        for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
          const c = p.get(x, y);
          if (c !== null) expect(ok.has(c), `${a} f${f} colour ${c.toString(16)} at ${x},${y}`).toBe(true);
        }
      }
  });

  it('the eyes are violet lights on idle f0 and blaze white on the special pull', () => {
    const has = (a: AnyMonsterAnim, f: number, c: number) => {
      const p = drawFrame(art, a, f, 'left');
      for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (p.get(x, y) === c) return true;
      return false;
    };
    expect(has('idle', 0, PAL.void4)).toBe(true);
    expect(has('special', 7, PAL.white)).toBe(true);
  });

  it('death liquefies into the puddle: the last frame is a low, flat remnant, no mask', () => {
    const n = specOf('death').frames;
    const { p } = opaque('death', n - 1);
    const b = p.bounds()!;
    expect(b.h).toBeLessThanOrEqual(8);
    let stone = 0;
    for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (p.get(x, y) === PAL.stone4 || p.get(x, y) === PAL.stone3) stone++;
    expect(stone).toBe(0);
    // the mask is still there (sinking) two frames earlier: it goes last
    const { p: q } = opaque('death', n - 3);
    let mask = 0;
    for (let y = 0; y < q.h; y++) for (let x = 0; x < q.w; x++) if (q.get(x, y) === PAL.stone3 || q.get(x, y) === PAL.stone4) mask++;
    expect(mask).toBeGreaterThan(10);
  });

  it('the death preset is liquid, not the reserved stone ending (§5.2)', () => {
    expect(DEATH_PRESETS.mudgrasp_spirit.material).toBe('water');
  });
});
