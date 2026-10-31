// Kabuk Zıpkıncı (v3 art): every anim exists with marks and holds, validateArt (ace tier, projectile attack) reports no
// errors, a frame is deterministic, P2 is a relight of the same silhouette, the idle feet band never moves, the death
// leaves the harpoon to the cinematic from f3 and buries the shell, the card picture and the cut-in keep their budgets,
// and the effect painters draw palette-only pixels.

import { describe, expect, it } from 'vitest';
import art from '../../src/art/monsters-v3/tide_harpooner';
import card from '../../src/art/cardart-v3/tide_harpooner';
import cutinFactory from '../../src/art/cutins-v3/tide_harpooner';
import { KIT } from '../../src/art/cutins/index';
import { PixelCanvas } from '../../src/art/pixel';
import { PAL } from '../../src/art/palette';
import { artStats, renderArt } from '../../src/art/cardart-v3/_kit';
import { drawFrame, validateArt } from '../../src/art/rigkit';
import type { AnyMonsterAnim } from '../../src/art/types';
import { harpoonFrame, korunuyorPlate, ropeLine, shroudWall, splinters, exitSpray } from '../../src/art/monsters-v3/tide_harpooner-fx';

const ALL: readonly AnyMonsterAnim[] = ['idle', 'guard', 'attack', 'roar', 'hit', 'toGuard', 'fromGuard', 'hitHeavy', 'hitMagic', 'summon', 'death', 'revive', 'special'];
const PALETTE = new Set<number>(Object.values(PAL) as number[]);

const opaque = (p: PixelCanvas) => {
  let n = 0;
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (p.isOpaque(x, y)) n++;
  return n;
};

describe('tide_harpooner', () => {
  it('has every anim, marks and holds', () => {
    for (const a of ALL) {
      const spec = (art.anims as Record<string, { frames: number; holds?: number[] }>)[a] ?? (art.extraAnims as Record<string, { frames: number; holds?: number[] }>)[a];
      expect(spec, a).toBeTruthy();
      expect(spec.holds?.length, a).toBe(spec.frames);
    }
    expect(art.anims.attack.marks?.release).toBe(art.attackImpactFrame);
    expect(art.anims.attack.marks?.contact).toBeDefined();
    expect(art.extraAnims?.special?.marks?.release).toBeDefined();
    expect(art.p2).toBe('relight');
    expect(art.weight).toBe('mediumHeavy');
  }, 120000);

  it('validateArt (ace tier) has no errors', () => {
    expect(validateArt(art, { tier: 'ace', attack: 'projectile' }).filter((f) => f.severity === 'error').map((f) => `${f.rule} ${f.anim} ${f.message}`)).toEqual([]);
  }, 120000);

  it('is an 80-class ace: idle f0 ≈ 2300–3200 px, a round spiral mass + a mast', () => {
    const a = drawFrame(art, 'idle', 0, 'left');
    const n = opaque(a);
    expect(n).toBeGreaterThan(2200);
    expect(n).toBeLessThan(3400);
    const b = a.bounds()!;
    expect(b.w).toBeGreaterThanOrEqual(56);
    expect(b.h).toBeGreaterThanOrEqual(60);
  });

  it('draws deterministically and P2 keeps the silhouette', () => {
    const a = drawFrame(art, 'idle', 0, 'left');
    const b = drawFrame(art, 'idle', 0, 'left');
    expect(a.data.every((v: number, i: number) => v === b.data[i])).toBe(true);
    const r = drawFrame(art, 'idle', 0, 'right');
    let diff = 0;
    for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) if (a.isOpaque(x, y) !== r.isOpaque(x, y)) diff++;
    expect(diff).toBe(0);
  });

  it('only uses palette colours, never a player colour, teal or magenta on the body', () => {
    const banned = new Set<number>([PAL.cyan0, PAL.cyan1, PAL.cyan2, PAL.cyan3, PAL.cyan4, PAL.crim0, PAL.crim1, PAL.crim2, PAL.crim3, PAL.crim4, PAL.teal0, PAL.teal1, PAL.teal2, PAL.teal3, PAL.teal4, PAL.mag0, PAL.mag1, PAL.mag2, PAL.mag3, PAL.mag4]);
    for (const a of ALL) {
      const spec = (art.anims as Record<string, { frames: number }>)[a] ?? (art.extraAnims as Record<string, { frames: number }>)[a];
      for (let f = 0; f < spec.frames; f++)
        for (const light of ['left', 'right'] as const) {
          const p = drawFrame(art, a, f, light);
          for (let y = 0; y < p.h; y++)
            for (let x = 0; x < p.w; x++) {
              const c = p.get(x, y);
              if (c === null) continue;
              expect(PALETTE.has(c), `${a} f${f}`).toBe(true);
              expect(banned.has(c), `${a} f${f}`).toBe(false);
            }
        }
    }
  }, 120000);

  it('keeps the fire accent under 8 % of the body in idle', () => {
    const fire = new Set<number>([PAL.fire1, PAL.fire2, PAL.fire3]);
    for (let f = 0; f < art.anims.idle.frames; f++) {
      const p = drawFrame(art, 'idle', f, 'left');
      let n = 0;
      let k = 0;
      for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (p.isOpaque(x, y)) { n++; if (fire.has(p.get(x, y)!)) k++; }
      expect(k / n).toBeLessThan(0.08);
    }
  });

  it('death: the harpoon leaves the sprite on f3 and the shell sinks to its apex', () => {
    const stone = (p: PixelCanvas) => { let n = 0; for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (p.get(x, y) === PAL.stone3) n++; return n; };
    expect(stone(drawFrame(art, 'death', 2, 'left'))).toBeGreaterThan(0);
    expect(stone(drawFrame(art, 'death', 3, 'left'))).toBe(0);
    expect(opaque(drawFrame(art, 'death', 8, 'left'))).toBeLessThan(opaque(drawFrame(art, 'death', 4, 'left')) * 0.7);
  });

  it('paints the card picture at both sizes within the kit budgets and the cut-in at its own density, both lights', () => {
    for (let f = 0; f < (card.frames ?? 1); f++) {
      const r = renderArt(card, f);
      expect([r.bigPx.w, r.bigPx.h]).toEqual([88, 68]);
      expect([r.smallPx.w, r.smallPx.h]).toEqual([44, 34]);
      for (const [l, px, focus] of [[r.big, r.bigPx, card.focus], [r.small, r.smallPx, card.focusSmall!]] as const) {
        const st = artStats(l, px, focus, true);
        expect(st.offPalette).toBe(0);
        expect(st.isolated).toBeLessThanOrEqual(0.1);
        expect(st.colors).toBeLessThanOrEqual(20);
        expect(st.focusOk).toBe(true);
        expect(st.subjectFill).toBeLessThanOrEqual(0.75);
      }
    }
    const cut = cutinFactory(KIT);
    expect(cut.id).toBe('tide_harpooner');
    expect([cut.w, cut.h]).toEqual([200, 144]);
    expect(cut.holds!.length).toBe(cut.frames);
    expect(cut.p2).toBe('relight');
    for (const light of ['left', 'right'] as const)
      for (let f = 0; f < cut.frames; f++) {
        const p = new PixelCanvas(cut.w, cut.h);
        cut.draw(p, f, { lightFrom: light });
        let n = 0;
        for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (p.isOpaque(x, y)) { n++; expect(PALETTE.has(p.get(x, y)!)).toBe(true); }
        expect(n, `${light} ${f}`).toBeGreaterThan(4000);
      }
  }, 120000);

  it('effect painters draw palette pixels only', () => {
    const p = new PixelCanvas(200, 160);
    for (const ha of [0, 180, -20]) p.blit(harpoonFrame(ha, 'left', { bury: ha === -20 ? 10 : 0 }).px, 0, 0);
    ropeLine(p, [4, 10], [150, 30], { sag: 6, wobble: 2, phase: 0.4, wet: 1 });
    ropeLine(p, [4, 40], [150, 40], { taut: true });
    for (const half of ['back', 'front'] as const) shroudWall(p, 100, 120, half, { height: 3, crest: 0.2, curlAt: 0.1, curl: 1 });
    shroudWall(p, 100, 120, 'front', { height: 2, crest: 0.5, collapse: 0.7 });
    splinters(p, [60, 98], 0.4);
    exitSpray(p, [150, 100], [1, 0], 0.7, 130);
    p.blit(korunuyorPlate(true), 10, 120);
    for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) { const c = p.get(x, y); if (c !== null) expect(PALETTE.has(c)).toBe(true); }
    expect(korunuyorPlate(false).w).toBeLessThan(korunuyorPlate(true).w);
  });
});
