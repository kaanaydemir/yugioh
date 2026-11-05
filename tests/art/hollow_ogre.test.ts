// Kovuk Devi (v3 art): every anim exists with marks and holds, validateArt (normal tier, melee) reports no errors, the
// rig is deterministic, P2 is a relight of the same silhouette, the root feet (+ the planted club head) never move in
// idle / guard, the palette is earth / leaf / void / gold only (never the player colours), the ember eyes and knot
// lights are lights (never outlined), the special plants a seed (violet) and lights a knot, and the death ends on
// the lone wilted sprout (§5.2: roots into the tile, no stone / ash ending).

import { describe, expect, it } from 'vitest';
import art from '../../src/art/monsters-v3/hollow_ogre';
import { SEED_LOOP } from '../../src/art/monsters-v3/hollow_ogre-anims';
import { PAL, RAMPS } from '../../src/art/palette';
import { drawFrame, validateArt } from '../../src/art/rigkit';
import type { AnyMonsterAnim, AnimSpec } from '../../src/art/types';

const ALL: readonly AnyMonsterAnim[] = ['idle', 'guard', 'attack', 'roar', 'hit', 'toGuard', 'fromGuard', 'hitHeavy', 'hitMagic', 'summon', 'death', 'revive', 'special'];
const specOf = (a: AnyMonsterAnim): AnimSpec => ((art.anims as Record<string, AnimSpec>)[a] ?? (art.extraAnims as Record<string, AnimSpec>)[a])!;
const count = (a: AnyMonsterAnim, f: number, pred: (c: number) => boolean, light: 'left' | 'right' = 'left') => {
  const p = drawFrame(art, a, f, light);
  let n = 0;
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) { const c = p.get(x, y); if (c !== null && pred(c)) n++; }
  return { p, n };
};

describe('hollow_ogre', () => {
  it('has every anim, marks and holds; heavy walker, relit P2', () => {
    for (const a of ALL) {
      const s = specOf(a);
      expect(s, a).toBeTruthy();
      expect(s.holds?.length, a).toBe(s.frames);
    }
    expect(art.anims.attack.marks?.release).toBe(art.attackImpactFrame);
    expect(art.anims.attack.marks?.contact).toBeDefined();
    expect(specOf('special').marks?.release).toBeDefined();
    expect(specOf('summon').marks?.land).toBeDefined();
    expect(specOf('revive').marks?.land).toBeDefined();
    expect(specOf('death').marks?.dissolve).toBeDefined();
    expect(specOf('idle').frames).toBeGreaterThanOrEqual(16);
    expect(art.p2).toBe('relight');
    expect(art.weight).toBe('heavy');
    expect(art.hover).toBe(0);
    // the per-seed loop sits inside the special and spans release / contact
    const m = specOf('special').marks!;
    expect(SEED_LOOP.from).toBeLessThan(m.release!);
    expect(SEED_LOOP.to).toBeGreaterThan(m.contact!);
    expect(SEED_LOOP.to).toBeLessThan(specOf('special').frames - 1);
  });

  it('validateArt (normal tier, melee attack) has no errors', () => {
    expect(validateArt(art, { tier: 'normal', attack: 'melee' }).filter((f) => f.severity === 'error').map((f) => `${f.rule} ${f.anim} ${f.message}`)).toEqual([]);
  });

  it('fits the medium sheet budget (KK-13)', () => {
    const frames = ALL.reduce((s, a) => s + specOf(a).frames, 0);
    expect(frames).toBeLessThanOrEqual(140);
    expect(art.w * art.h * 4 * frames).toBeLessThanOrEqual(3.6e6);
  });

  it('draws deterministically and P2 keeps the silhouette', () => {
    for (const [a, f] of [['idle', 0], ['attack', 6], ['special', 5], ['summon', 4], ['death', 3]] as const) {
      const x = drawFrame(art, a, f, 'left');
      const y = drawFrame(art, a, f, 'left');
      expect(x.data.every((v: number, i: number) => v === y.data[i]), `${a} ${f}`).toBe(true);
      const r = drawFrame(art, a, f, 'right');
      let diff = 0;
      for (let yy = 0; yy < x.h; yy++) for (let xx = 0; xx < x.w; xx++) if (x.isOpaque(xx, yy) !== r.isOpaque(xx, yy)) diff++;
      expect(diff, `${a} ${f}`).toBe(0);
    }
  });

  it('is a 64-class giant: idle f0 between 1800 and 2800 px, taller than wide', () => {
    const { p, n } = count('idle', 0, () => true);
    expect(n).toBeGreaterThan(1800);
    expect(n).toBeLessThan(2800);
    const b = p.bounds()!;
    expect(b.h).toBeGreaterThan(60);
    expect(b.w).toBeGreaterThanOrEqual(50);
  });

  it('keeps the feet band (lowest 6 rows: root toes + planted club head) still in idle, guard and the transitions (HA-9)', () => {
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

  it('uses only earth / leaf / void / gold + ink + white — never the player colours or cyan / crim / teal / mag', () => {
    const ok = new Set<number>([PAL.ink, PAL.white, ...RAMPS.earth, ...RAMPS.leaf, ...RAMPS.void, ...RAMPS.gold]);
    for (const a of ALL)
      for (let f = 0; f < specOf(a).frames; f++) {
        const p = drawFrame(art, a, f, f % 2 ? 'right' : 'left');
        for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
          const c = p.get(x, y);
          if (c !== null) expect(ok.has(c), `${a} f${f} colour ${c.toString(16)} at ${x},${y}`).toBe(true);
        }
      }
  });

  it('the ember eyes glow gold in the hollow; the special plants a violet seed and lights a knot', () => {
    expect(count('idle', 0, (c) => c === PAL.gold4 || c === PAL.gold3).n).toBeGreaterThan(2);
    const m = specOf('special').marks!;
    expect(count('special', m.release!, (c) => c === PAL.void4).n).toBeGreaterThan(0);
    expect(count('special', m.contact! + 1, (c) => c === PAL.void4 || c === PAL.white).n).toBeGreaterThan(2);
    // void3 / void4 are lights only: none on idle f0 (the hollow darkness is void0 / void1)
    expect(count('idle', 0, (c) => c === PAL.void3 || c === PAL.void4).n).toBe(0);
  });

  it('death ends on the lone wilted sprout: a tiny remnant on the ground line', () => {
    const n = specOf('death').frames;
    const { p } = count('death', n - 1, () => true);
    const b = p.bounds()!;
    expect(b.h).toBeLessThanOrEqual(8);
    expect(b.w).toBeLessThanOrEqual(12);
    expect(b.y + b.h - 1).toBeGreaterThanOrEqual(art.anchorY);
  });
});
