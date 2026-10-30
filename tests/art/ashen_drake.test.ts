// Kül Ejderi (ashen_drake, v3 art, registered): every anim the v3 contract needs exists with holds and
// marks, validateArt (normal tier) is clean, a frame is deterministic, P2 is a relight of the SAME
// silhouette, the quadruped stays low and wide (it is not the Kristal Ejder's upright biped), the
// planted claws never move in idle / guard / transitions (HA-9), and every frame keeps its margin.

import { describe, expect, it } from 'vitest';
import art from '../../src/art/monsters-v3/ashen_drake';
import { drawFrame, validateArt } from '../../src/art/rigkit';
import type { AnyMonsterAnim } from '../../src/art/types';

const ALL: readonly AnyMonsterAnim[] = ['idle', 'guard', 'attack', 'roar', 'hit', 'toGuard', 'fromGuard', 'hitHeavy', 'hitMagic', 'summon', 'death', 'revive', 'victory'];
const spec = (a: AnyMonsterAnim) => ((art.anims as Record<string, { frames: number; holds?: number[]; marks?: Record<string, number> }>)[a] ?? (art.extraAnims as Record<string, { frames: number; holds?: number[]; marks?: Record<string, number> }>)[a]);

describe('ashen_drake', () => {
  it('has every anim with holds, marks and the contact mark of the pounce', () => {
    for (const a of ALL) {
      const s = spec(a);
      expect(s, a).toBeTruthy();
      expect(s.holds?.length, a).toBe(s.frames);
    }
    expect(spec('attack').marks?.release).toBeDefined();
    expect(spec('attack').marks?.contact).toBe(6);
    expect(spec('death').marks?.dissolve).toBeDefined();
    expect(art.p2).toBe('relight');
  });

  it('validateArt (normal tier) has no errors beyond the death continuing the reaction', () => {
    const left = validateArt(art, { tier: 'normal' }).filter((f) => !(f.rule === 'HA-1' && f.anim === 'death'));
    expect(left.map((f) => `${f.rule} ${f.anim}`)).toEqual([]);
  });

  it('draws deterministically and P2 keeps the silhouette', () => {
    const a = drawFrame(art, 'idle', 3, 'left');
    const b = drawFrame(art, 'idle', 3, 'left');
    expect(a.data.length === b.data.length && a.data.every((v: number, i: number) => v === b.data[i])).toBe(true);
    const r = drawFrame(art, 'idle', 3, 'right');
    let diff = 0;
    for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) if (a.isOpaque(x, y) !== r.isOpaque(x, y)) diff++;
    expect(diff).toBe(0);
  });

  it('is a low, wide quadruped (not an upright biped) of an 80-class mass', () => {
    const f = drawFrame(art, 'idle', 0, 'left');
    let x0 = 999, x1 = -1, y0 = 999, y1 = -1, n = 0;
    for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) if (f.isOpaque(x, y)) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); n++; }
    expect((x1 - x0 + 1) / (y1 - y0 + 1)).toBeGreaterThan(1.4);
    expect(n).toBeGreaterThan(3000);
    expect(n).toBeLessThan(4200);
  });

  it('keeps the planted claws and every frame inside the frame', () => {
    const lowRows = (a: AnyMonsterAnim, fr: number) => {
      const f = drawFrame(art, a, fr, 'left');
      let x0 = 999, x1 = -1, edge = 0;
      for (let y = art.anchorY - 6; y < art.anchorY; y++) for (let x = 0; x < f.w; x++) if (f.isOpaque(x, y)) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
      for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) if (f.isOpaque(x, y) && (x < 1 || y < 1 || x > f.w - 2 || y > f.h - 2)) edge++;
      return { x0, x1, edge };
    };
    const ref = lowRows('idle', 0);
    for (const a of ['idle', 'guard', 'toGuard', 'fromGuard'] as const) for (let k = 0; k < spec(a).frames; k++) expect(lowRows(a, k), `${a} ${k}`).toMatchObject({ x0: ref.x0, x1: ref.x1 });
    for (const a of ALL) for (let k = 0; k < spec(a).frames; k++) expect(lowRows(a, k).edge, `${a} ${k}`).toBe(0);
  });
});
