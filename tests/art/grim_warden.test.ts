// Hortlak Muhafız (grim_warden, v3 art, R2 "Fener Bekçisi" lantern warden): every anim the v3 contract needs exists with
// holds and marks (special = the drain), validateArt (normal tier) is clean, a frame is deterministic, P2 is a relight
// of the SAME silhouette, the warden is a tall thin "L" (a vertical body + planted halberd, a horizontal lantern arm),
// the boots and the halberd's butt never move in idle / guard / transitions (HA-9), every frame keeps its margin, the
// soul fire is light (leaf3 / leaf4 only after the outline: never a body tone), the body never uses the player
// colours, the frame fits the large-class sheet budget. Card art + cut-in are covered by their own files' tests.

import { describe, expect, it } from 'vitest';
import art from '../../src/art/monsters-v3/grim_warden';
import { PAL } from '../../src/art/palette';
import { drawFrame, validateArt } from '../../src/art/rigkit';
import type { AnyMonsterAnim } from '../../src/art/types';

const ALL: readonly AnyMonsterAnim[] = ['idle', 'guard', 'attack', 'roar', 'hit', 'toGuard', 'fromGuard', 'hitHeavy', 'hitMagic', 'summon', 'death', 'revive', 'special'];
type S = { frames: number; holds?: number[]; marks?: Record<string, number> };
const spec = (a: AnyMonsterAnim): S => (art.anims as Record<string, S>)[a] ?? (art.extraAnims as Record<string, S>)[a];

describe('grim_warden (lantern warden)', () => {
  it('has every anim with holds and marks; special carries the drain beats', () => {
    for (const a of ALL) {
      const s = spec(a);
      expect(s, a).toBeTruthy();
      expect(s.holds?.length, a).toBe(s.frames);
    }
    expect(spec('idle').frames).toBe(20);
    expect(spec('attack').marks?.release).toBe(art.attackImpactFrame);
    expect(spec('attack').marks?.contact).toBeGreaterThan(spec('attack').marks!.release);
    const sp = spec('special').marks!;
    expect(sp.charge).toBeLessThan(sp.release);
    expect(sp.release).toBeLessThan(sp.recover);
    expect(spec('death').marks?.dissolve).toBeDefined();
    expect(spec('summon').marks?.land).toBeDefined();
    expect(art.p2).toBe('relight');
    expect(art.weight).toBe('heavy');
  });

  it('validateArt (normal tier) has no errors', () => {
    expect(validateArt(art, { tier: 'normal', attack: 'melee' }).filter((f) => f.severity === 'error').map((f) => `${f.rule} ${f.anim}`)).toEqual([]);
  });

  it('fits the large-class sheet budget (≤ 5 MB uncropped per side, ≤ 140 frames)', () => {
    const frames = ALL.reduce((n, a) => n + spec(a).frames, 0);
    expect(frames).toBeLessThanOrEqual(140);
    expect(art.w * art.h * 4 * frames).toBeLessThanOrEqual(5e6);
  });

  it('draws deterministically and P2 keeps the silhouette', () => {
    for (const [a, f] of [['idle', 3], ['attack', 6], ['special', 7], ['death', 6]] as const) {
      const x = drawFrame(art, a, f, 'left');
      const y = drawFrame(art, a, f, 'left');
      expect(x.data.every((v: number, i: number) => v === y.data[i]), `${a} ${f}`).toBe(true);
      const r = drawFrame(art, a, f, 'right');
      let diff = 0;
      for (let yy = 0; yy < x.h; yy++) for (let xx = 0; xx < x.w; xx++) if (x.isOpaque(xx, yy) !== r.isOpaque(xx, yy)) diff++;
      expect(diff, `${a} ${f}`).toBe(0);
    }
  });

  it('is a tall, thin "L": the lantern hangs out right of the body, the halberd rises above the hood', () => {
    const f = drawFrame(art, 'idle', 0, 'left');
    const b = f.bounds()!;
    expect(b.h).toBeGreaterThanOrEqual(84);
    expect(b.w).toBeGreaterThanOrEqual(64);
    const pt = art.points!('idle', 0);
    // the lantern (muzzle) is well forward of the anchor, at mid height; the spade head is the top of the figure
    expect(pt.muzzle!.x - art.anchorX).toBeGreaterThanOrEqual(28);
    expect(pt.muzzle!.y).toBeGreaterThan(50);
    expect(pt.muzzle!.y).toBeLessThan(80);
    expect(pt.staff!.y).toBeLessThan(pt.head!.y);
    // the soul fire burns in the lantern: leaf4 pixels around the muzzle
    let fire = 0;
    for (let y = pt.muzzle!.y - 5; y <= pt.muzzle!.y + 5; y++) for (let x = pt.muzzle!.x - 4; x <= pt.muzzle!.x + 4; x++) if (f.get(x, y) === PAL.leaf4) fire++;
    expect(fire).toBeGreaterThan(2);
  });

  it('keeps the boots and the halberd butt planted, and every frame inside its margin', () => {
    const lowRows = (a: AnyMonsterAnim, fr: number) => {
      const f = drawFrame(art, a, fr, 'left');
      let x0 = 999, x1 = -1, bottom = -1, edge = 0;
      for (let y = art.anchorY - 4; y <= art.anchorY + 1; y++) for (let x = 0; x < f.w; x++) if (f.isOpaque(x, y)) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); bottom = Math.max(bottom, y); }
      for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) if (f.isOpaque(x, y) && (x < 2 || y < 2 || x > f.w - 3 || y > f.h - 3)) edge++;
      return { x0, x1, bottom, edge };
    };
    const ref = lowRows('idle', 0);
    for (const a of ['idle', 'guard', 'toGuard', 'fromGuard'] as const) for (let k = 0; k < spec(a).frames; k++) expect(lowRows(a, k), `${a} ${k}`).toMatchObject({ x0: ref.x0, x1: ref.x1, bottom: ref.bottom });
    for (const a of ALL) for (let k = 0; k < spec(a).frames; k++) expect(lowRows(a, k).edge, `${a} ${k}`).toBe(0);
  }, 30000);

  it('paints palette colours only and never the player colours or the forbidden body ramps', () => {
    const palette = new Set<number>(Object.values(PAL) as number[]);
    const banned = new Set<number>([PAL.cyan0, PAL.cyan1, PAL.cyan2, PAL.cyan3, PAL.cyan4, PAL.crim0, PAL.crim1, PAL.crim2, PAL.crim3, PAL.crim4, PAL.mag0, PAL.mag1, PAL.mag2, PAL.mag3, PAL.mag4, PAL.teal0, PAL.teal1, PAL.teal2, PAL.teal3, PAL.teal4]);
    for (const a of ALL)
      for (let k = 0; k < spec(a).frames; k += 2)
        for (const light of ['left', 'right'] as const) {
          const f = drawFrame(art, a, k, light);
          for (let y = 0; y < f.h; y++)
            for (let x = 0; x < f.w; x++) {
              const c = f.get(x, y);
              if (c === null) continue;
              expect(palette.has(c), `${a} ${k} ${light} ${c.toString(16)}`).toBe(true);
              expect(banned.has(c), `${a} ${k} ${light} ${c.toString(16)}`).toBe(false);
            }
        }
  }, 30000);
});
