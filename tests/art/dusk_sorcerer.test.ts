// Akşam Büyücüsü v3 (the "comet coat" rewrite): every anim of the v3 contract exists with holds and marks, validateArt
// reports no errors, a frame is deterministic, P2 is a relight of the same silhouette, and the figure is clearly bigger than
// the Uçurum Büyücüsü (≥ 64 px tall incl. hat / moon, wider than the magus) — the first attempt was 44 px.
import { describe, expect, it } from 'vitest';
import dusk from '../../src/art/monsters-v3/dusk_sorcerer';
import magus from '../../src/art/monsters-v3/abyss_magus';
import { drawFrame, validateArt } from '../../src/art/rigkit';
import type { AnyMonsterAnim } from '../../src/art/types';

const ALL: readonly AnyMonsterAnim[] = ['idle', 'guard', 'attack', 'roar', 'hit', 'toGuard', 'fromGuard', 'hitHeavy', 'hitMagic', 'summon', 'death', 'revive', 'victory'];

describe('dusk_sorcerer', () => {
  it('has every anim with holds, the attack marks and a relit P2', () => {
    for (const a of ALL) {
      const spec = (dusk.anims as Record<string, { frames: number; holds?: number[] }>)[a] ?? (dusk.extraAnims as Record<string, { frames: number; holds?: number[] }>)[a];
      expect(spec, a).toBeTruthy();
      expect(spec.holds?.length, a).toBe(spec.frames);
    }
    const m = dusk.anims.attack.marks!;
    expect([m.charge, m.release, m.contact, m.recover]).toEqual([1, 6, 7, 8]);
    expect(dusk.p2).toBe('relight');
  });
  it('validateArt (normal tier) has no errors', () => {
    const left = validateArt(dusk, { tier: 'normal' }).filter((f) => f.severity === 'error');
    expect(left.map((f) => `${f.rule} ${f.anim}`)).toEqual([]);
  });
  it('is deterministic and P2 keeps the silhouette', () => {
    const a = drawFrame(dusk, 'idle', 0, 'left');
    const b = drawFrame(dusk, 'idle', 0, 'left');
    expect(a.data.every((v: number, i: number) => v === b.data[i])).toBe(true);
    const r = drawFrame(dusk, 'idle', 0, 'right');
    let diff = 0;
    for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) if (a.isOpaque(x, y) !== r.isOpaque(x, y)) diff++;
    expect(diff).toBe(0);
  });
  it('is taller and wider than the magus', () => {
    const d = drawFrame(dusk, 'idle', 0, 'left').bounds()!;
    const g = drawFrame(magus, 'idle', 0, 'left').bounds()!;
    expect(d.h).toBeGreaterThanOrEqual(64);
    expect(d.h).toBeGreaterThan(g.h);
    expect(d.w).toBeGreaterThan(g.w);
  });
});
