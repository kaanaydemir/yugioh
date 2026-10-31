// Yansıyan Okçu (reflection_archer, v3 art, registered): every anim the v3 contract needs exists with holds and marks,
// validateArt (normal tier, projectile attack) is clean, a frame is deterministic, P2 is a relight of the SAME silhouette,
// every frame keeps its 2-px margin, the archer stands tall in a puddle whose dark-blue reflection lies UNDER the ground
// line, the reflection looks at the viewer once per idle loop (two eyes), it breaks in death before the archer does,
// the summon's f7 is the archer as the reflection's mirror image, and both card pictures paint within budget.
import { describe, expect, it } from 'vitest';
import art from '../../src/art/monsters-v3/reflection_archer';
import card from '../../src/art/cardart-v3/reflection_archer';
import { PAL } from '../../src/art/palette';
import { artStats, renderArt } from '../../src/art/cardart-v3/_kit';
import { drawFrame, validateArt } from '../../src/art/rigkit';
import type { AnyMonsterAnim } from '../../src/art/types';

const ALL: readonly AnyMonsterAnim[] = ['idle', 'guard', 'attack', 'roar', 'hit', 'toGuard', 'fromGuard', 'hitHeavy', 'hitMagic', 'summon', 'death', 'revive'];
type S = { frames: number; holds?: number[]; marks?: Record<string, number> };
const spec = (a: AnyMonsterAnim): S => (art.anims as Record<string, S>)[a] ?? (art.extraAnims as Record<string, S>)[a];
const REFL = new Set<number>([PAL.water1, PAL.water2, PAL.water3, PAL.night0, PAL.night1]);
/** Reflection-tone pixels below the ground line (inside the puddle). */
const reflPx = (a: AnyMonsterAnim, f: number) => {
  const p = drawFrame(art, a, f, 'left');
  let n = 0;
  for (let y = art.anchorY + 1; y < p.h; y++) for (let x = 0; x < p.w; x++) if (REFL.has(p.get(x, y) as number)) n++;
  return n;
};
/** White pixels in the reflection's head rows (its eyes). */
const reflEyes = (f: number) => {
  const p = drawFrame(art, 'idle', f, 'left');
  let n = 0;
  for (let y = art.anchorY + 8; y < p.h; y++) for (let x = art.anchorX - 6; x <= art.anchorX + 6; x++) if (p.get(x, y) === PAL.white || p.get(x, y) === PAL.water4) n++;
  return n;
};

describe('reflection_archer', () => {
  it('has every anim with holds and marks', () => {
    for (const a of ALL) {
      const s = spec(a);
      expect(s, a).toBeTruthy();
      expect(s.holds?.length, a).toBe(s.frames);
    }
    expect(spec('idle').frames).toBe(20);
    expect(spec('attack').marks).toEqual({ charge: 1, release: 6, impact: 6, recover: 8 });
    expect(spec('summon').marks?.land).toBe(10);
    expect(spec('death').marks?.dissolve).toBe(4);
    expect(art.p2).toBe('relight');
    expect(art.weight).toBe('mediumHeavy');
  });

  it('validateArt (normal tier) has no errors', { timeout: 60000 }, () => {
    expect(validateArt(art, { tier: 'normal', attack: 'projectile' }).filter((f) => f.severity === 'error').map((f) => `${f.rule} ${f.anim} ${f.message}`)).toEqual([]);
  });

  it('draws deterministically and P2 keeps the silhouette', () => {
    const a = drawFrame(art, 'idle', 5, 'left');
    const b = drawFrame(art, 'idle', 5, 'left');
    expect(a.data.every((v: number, i: number) => v === b.data[i])).toBe(true);
    const r = drawFrame(art, 'idle', 5, 'right');
    let diff = 0;
    for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) if (a.isOpaque(x, y) !== r.isOpaque(x, y)) diff++;
    expect(diff).toBe(0);
  });

  it('is a tall archer over a wide puddle and every frame keeps a 2-px margin', { timeout: 60000 }, () => {
    const p = drawFrame(art, 'idle', 0, 'left');
    const b = p.bounds()!;
    expect(art.anchorY - b.y).toBeGreaterThanOrEqual(50);
    expect(b.y + b.h - 1 - art.anchorY).toBeGreaterThanOrEqual(12);
    for (const a of ALL) {
      for (let i = 0; i < spec(a).frames; i++) {
        const q = drawFrame(art, a, i, 'left').bounds();
        if (!q) continue;
        expect(Math.min(q.x, q.y, art.w - q.x - q.w, art.h - q.y - q.h), `${a} f${i}`).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('the reflection lives under the ground line, looks at the viewer once per loop and breaks first in death', () => {
    expect(reflPx('idle', 0)).toBeGreaterThan(120);
    // f12 (the turned head) shows two eyes in the reflection's head rows; f0 shows its profile eye
    expect(reflEyes(12)).toBeGreaterThan(reflEyes(0));
    // death f4: the reflection is gone while the archer still stands (flat)
    expect(reflPx('death', 4)).toBeLessThan(reflPx('idle', 0) / 4);
    expect(drawFrame(art, 'death', 4, 'left').bounds()!.y).toBeLessThan(art.anchorY - 45);
  });

  it('summon: the drop first, then the puddle and the reflection, the archer unfolding up', () => {
    const f0 = drawFrame(art, 'summon', 0, 'left').bounds()!;
    expect(f0.w).toBeLessThanOrEqual(4);
    expect(reflPx('summon', 6)).toBeGreaterThan(80);
    const h7 = art.anchorY - drawFrame(art, 'summon', 7, 'left').bounds()!.y;
    const h10 = art.anchorY - drawFrame(art, 'summon', 10, 'left').bounds()!.y;
    expect(h7).toBeLessThan(h10 / 2);
  });

  it('points: the muzzle is the arrow point at full draw and on the bow otherwise', () => {
    const idle = art.points!('idle', 0).muzzle!;
    expect(idle.x).toBeGreaterThan(art.anchorX + 10);
    expect(art.points!('attack', 4).muzzle!.x).toBeGreaterThanOrEqual(art.anchorX + 18);
    expect(art.points!('attack', 6).muzzle!.x).toBeGreaterThanOrEqual(art.anchorX + 18);
  });

  it('card picture: 4 living frames, both sizes inside the kit budgets', () => {
    expect(card.frames).toBe(4);
    const r = renderArt(card, 0);
    expect(r.auto).toBe(false);
    for (const [l, px, foc] of [[r.big, r.bigPx, card.focus], [r.small, r.smallPx, card.focusSmall]] as const) {
      const st = artStats(l, px, foc, true);
      expect(st.offPalette).toBe(0);
      expect(st.colors).toBeLessThanOrEqual(24);
      expect(st.focusOk).toBe(true);
      expect(st.isolated).toBeLessThanOrEqual(0.1);
    }
  });
});
