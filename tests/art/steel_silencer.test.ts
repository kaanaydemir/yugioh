// Çelik Susturucu (v3 art): every anim exists with marks and holds, validateArt (normal tier) reports no errors, a frame is
// deterministic, P2 is a relight of the same silhouette, the art is a hand-made rig (not a plan recolour) of the large class.

import { describe, expect, it } from 'vitest';
import art from '../../src/art/monsters-v3/steel_silencer';
import { drawFrame, validateArt } from '../../src/art/rigkit';
import type { AnyMonsterAnim } from '../../src/art/types';

const ALL: readonly AnyMonsterAnim[] = ['idle', 'guard', 'attack', 'roar', 'hit', 'toGuard', 'fromGuard', 'hitHeavy', 'hitMagic', 'summon', 'death', 'revive', 'victory'];

describe('steel_silencer', () => {
  it('has every anim, marks and holds', () => {
    for (const a of ALL) {
      const spec = (art.anims as Record<string, { frames: number; holds?: number[] }>)[a] ?? (art.extraAnims as Record<string, { frames: number; holds?: number[] }>)[a];
      expect(spec, a).toBeTruthy();
      expect(spec.holds?.length, a).toBe(spec.frames);
    }
    expect(art.anims.attack.marks?.release).toBeDefined();
    expect(art.anims.attack.marks?.contact).toBeDefined();
    expect(art.p2).toBe('relight');
    expect(art.weight).toBe('heavy');
  });
  it('validateArt (normal tier) has no errors', () => {
    expect(validateArt(art, { tier: 'normal', attack: 'melee' }).filter((f) => f.severity === 'error').map((f) => `${f.rule} ${f.anim}`)).toEqual([]);
  });
  it('is large: idle f0 at least 3000 px, bbox at least 70 wide', () => {
    const a = drawFrame(art, 'idle', 0, 'left');
    let n = 0;
    for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) if (a.isOpaque(x, y)) n++;
    expect(n).toBeGreaterThan(3000);
    expect(a.bounds()!.w).toBeGreaterThanOrEqual(70);
  });
  it('draws deterministically and P2 keeps the silhouette', () => {
    const a = drawFrame(art, 'idle', 0, 'left');
    const b = drawFrame(art, 'idle', 0, 'left');
    expect(a.data.length === b.data.length && a.data.every((v: number, i: number) => v === b.data[i])).toBe(true);
    const r = drawFrame(art, 'idle', 0, 'right');
    let diff = 0;
    for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) if (a.isOpaque(x, y) !== r.isOpaque(x, y)) diff++;
    expect(diff).toBe(0);
  });
});
