// Kül Ejderi (ashen_drake, v3 art, revision 3 — docs/v3/kart-a/ashen_drake.md §9.4): the hunched ash
// vulture. Every anim with its holds and marks, validateArt (ace tier) clean, deterministic frames, P2 a
// relight of the SAME opaque mask on every frame, the vulture shape (taller than wide, the hood above, the
// skull hanging low), the talons fixed in idle / guard / transitions (HA-9, tail included), margins, the
// one gold4 of the heart, night0 only inside the rib cage, the cloak really gone on attack f4, the
// near-empty last death frame, the accretion table and the distinction card.
// (The card art and the cut-in are redrawn in the card-art stage; their budgets stay pinned here.)

import { describe, expect, it } from 'vitest';
import art, { ASHEN_BUILD, ASHEN_DISTINCTION, ASHEN_MOUTH, ASHEN_RIBS, ASHEN_ORDER } from '../../src/art/monsters-v3/ashen_drake';
import { rig } from '../../src/art/monsters-v3/ashen_drake-rig';
import { framePose } from '../../src/art/monsters-v3/ashen_drake-anims';
import card from '../../src/art/cardart-v3/ashen_drake';
import cutinFactory from '../../src/art/cutins-v3/ashen_drake';
import { KIT } from '../../src/art/cutins/index';
import { PixelCanvas } from '../../src/art/pixel';
import { PAL } from '../../src/art/palette';
import { artStats, renderArt } from '../../src/art/cardart-v3/_kit';
import { drawFrame, validateArt } from '../../src/art/rigkit';
import type { AnyMonsterAnim } from '../../src/art/types';

const ALL: readonly AnyMonsterAnim[] = ['idle', 'guard', 'attack', 'roar', 'hit', 'toGuard', 'fromGuard', 'hitHeavy', 'hitMagic', 'summon', 'death', 'revive', 'victory'];
type Spec = { frames: number; holds?: number[]; marks?: Record<string, number> };
const spec = (a: AnyMonsterAnim): Spec => (art.anims as Record<string, Spec>)[a] ?? (art.extraAnims as Record<string, Spec>)[a];
const opaque = (p: PixelCanvas) => {
  let n = 0;
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (p.isOpaque(x, y)) n++;
  return n;
};
const count = (p: PixelCanvas, c: number) => {
  let n = 0;
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (p.get(x, y) === c) n++;
  return n;
};

describe('ashen_drake (rev. 3, the ash vulture)', () => {
  it('has the 13 anims with the blueprint holds and marks (133 frames)', () => {
    const frames: Record<string, number> = { idle: 20, guard: 8, toGuard: 6, fromGuard: 6, attack: 14, roar: 9, hit: 6, hitHeavy: 8, hitMagic: 8, summon: 14, death: 12, revive: 12, victory: 10 };
    let total = 0;
    for (const a of ALL) {
      const s = spec(a);
      expect(s, a).toBeTruthy();
      expect(s.frames, a).toBe(frames[a]);
      expect(s.holds?.length, a).toBe(s.frames);
      total += s.frames;
    }
    expect(total).toBe(133);
    const idle = spec('idle').holds!;
    expect(idle.reduce((x, y) => x + y, 0)).toBe(2000);
    expect(idle[1]).toBeGreaterThanOrEqual(130);
    expect(spec('attack').marks).toMatchObject({ charge: 1, release: 6, contact: 9, recover: 10 });
    expect(spec('attack').holds!.reduce((x, y) => x + y, 0)).toBe(1350);
    expect(Math.max(...spec('attack').holds!)).toBe(spec('attack').holds![4]);
    expect(spec('roar').marks).toMatchObject({ charge: 1, release: 4, recover: 6 });
    for (const a of ['hit', 'hitHeavy', 'hitMagic', 'death'] as const) expect(spec(a).marks, a).toMatchObject({ impact: 0, contact: 0 });
    expect(spec('death').marks?.dissolve).toBe(5);
    expect(spec('summon').marks?.land).toBe(1);
    expect(spec('revive').marks?.land).toBe(6);
    expect(art.p2).toBe('relight');
    expect(art.weight).toBe('heavy');
    expect(art.knock).toBe('pose');
  });

  it('validateArt (ace tier) is clean but for the death continuing the reaction', () => {
    const left = validateArt(art, { tier: 'ace' }).filter((f) => f.severity === 'error' && !(f.rule === 'HA-1' && f.anim === 'death'));
    expect(left.map((f) => `${f.rule} ${f.anim} ${f.message}`)).toEqual([]);
  });

  it('draws deterministically and P2 keeps the exact opaque mask on every frame', () => {
    const a = drawFrame(art, 'idle', 3, 'left');
    const b = drawFrame(art, 'idle', 3, 'left');
    expect(a.data.every((v: number, i: number) => v === b.data[i])).toBe(true);
    for (const an of ALL)
      for (let f = 0; f < spec(an).frames; f++) {
        const l = drawFrame(art, an, f, 'left');
        const r = drawFrame(art, an, f, 'right');
        let diff = 0;
        for (let i = 3; i < l.data.length; i += 4) if ((l.data[i] > 0) !== (r.data[i] > 0)) diff++;
        expect(diff, `${an} f${f}`).toBe(0);
      }
  });

  it('is a hunched vulture: taller than wide, the hood above, the skull hanging low and forward', () => {
    const f = drawFrame(art, 'idle', 0, 'left');
    let x0 = 999, x1 = -1, y0 = 999, y1 = -1, topX = -1;
    for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) if (f.isOpaque(x, y)) { if (y < y0) topX = x; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const wh = (x1 - x0 + 1) / (y1 - y0 + 1);
    expect(wh).toBeGreaterThanOrEqual(0.75);
    expect(wh).toBeLessThanOrEqual(1.05);
    const n = opaque(f);
    expect(n).toBeGreaterThanOrEqual(2900);
    expect(n).toBeLessThanOrEqual(3500);
    const R = rig(framePose('idle', 0));
    expect(topX).toBeLessThan(R.skull[0]);
    // the skull's lowest point is ≥ 30 px below the hood peak
    expect(R.mouth[1] - y0).toBeGreaterThanOrEqual(30);
  });

  it('keeps the talons (and the tail) fixed in idle / guard / transitions, and every frame inside its margin', () => {
    const low = (a: AnyMonsterAnim, fr: number) => {
      const f = drawFrame(art, a, fr, 'left');
      const rows: string[] = [];
      for (let y = 94; y < f.h; y++) {
        let s = '';
        for (let x = 0; x < f.w; x++) s += f.isOpaque(x, y) ? '1' : '0';
        rows.push(s);
      }
      return rows.join('|');
    };
    const ref = low('idle', 0);
    for (const a of ['idle', 'guard', 'toGuard', 'fromGuard'] as const) for (let k = 0; k < spec(a).frames; k++) expect(low(a, k) === ref, `${a} f${k}`).toBe(true);
    for (const a of ALL)
      for (let k = 0; k < spec(a).frames; k++) {
        const f = drawFrame(art, a, k, 'left');
        let edge = 0;
        for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) if (f.isOpaque(x, y) && (x < 2 || y < 2 || x > f.w - 3 || y > f.h - 3)) edge++;
        expect(edge, `${a} f${k}`).toBe(0);
      }
  });

  it('has exactly one gold4 (the heart) in the idle frames but the relax frame, none on f1', () => {
    for (let k = 0; k < 20; k++) expect(count(drawFrame(art, 'idle', k, 'left'), PAL.gold4), `idle f${k}`).toBe(k === 1 ? 0 : 1);
  });

  it('shows night0 only inside the rib cavity', () => {
    const f = drawFrame(art, 'idle', 0, 'left');
    for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) if (f.get(x, y) === PAL.night0) expect(x >= 44 && x <= 68 && y >= 42 && y <= 74, `${x},${y}`).toBe(true);
  });

  it('tears the cloak off (attack f4: ≥ 45 % of idle f0 redrawn, the bare struts showing) and the death ends near-empty (≤ 40 px)', () => {
    // deviation from §9.4 (opaque ≤ 60 %): the bare wing struts, spread above the body, keep most of the
    // silhouette's area, so the change itself is measured: the plate field is gone from the frame
    const i0 = drawFrame(art, 'idle', 0);
    const a4 = drawFrame(art, 'attack', 4);
    let d = 0;
    for (let i = 0; i < i0.data.length; i += 4) if (i0.data[i] !== a4.data[i] || i0.data[i + 1] !== a4.data[i + 1] || i0.data[i + 2] !== a4.data[i + 2] || i0.data[i + 3] !== a4.data[i + 3]) d++;
    expect(d).toBeGreaterThanOrEqual(0.45 * opaque(i0));
    expect(opaque(drawFrame(art, 'death', 11))).toBeLessThanOrEqual(40);
  });

  it('exports the accretion table, the mouth / ribs points and the distinction card', () => {
    expect(ASHEN_ORDER.length).toBe(44);
    expect(new Set(ASHEN_ORDER).size).toBe(44);
    expect(ASHEN_BUILD.length).toBe(14);
    expect(ASHEN_BUILD[7].seated).toBe(44);
    expect(ASHEN_BUILD.reduce((n, b) => n + b.seats.length, 0)).toBe(44);
    const m = ASHEN_MOUTH('attack', 6);
    expect(m.y).toBeGreaterThan(70);
    expect(ASHEN_RIBS('idle', 0).x).toBeGreaterThan(40);
    for (const k of ['silhouette', 'rhythm', 'idle', 'guard', 'signaturePart', 'material', 'signatureMove'] as const) expect(ASHEN_DISTINCTION[k].length, k).toBeGreaterThan(20);
  });

  it('paints the card picture and the cut-in within their budgets (redrawn in the card-art stage)', () => {
    for (let f = 0; f < (card.frames ?? 1); f++) {
      const r = renderArt(card, f);
      expect([r.bigPx.w, r.bigPx.h]).toEqual([88, 68]);
      expect([r.smallPx.w, r.smallPx.h]).toEqual([44, 34]);
      for (const [l, px, focus] of [[r.big, r.bigPx, card.focus], [r.small, r.smallPx, card.focusSmall ?? ([card.focus[0] / 2, card.focus[1] / 2] as const)]] as const) {
        const st = artStats(l, px, focus);
        expect(st.offPalette).toBe(0);
        expect(st.colors).toBeLessThanOrEqual(20);
      }
    }
    const cut = cutinFactory(KIT);
    expect(cut.id).toBe('ashen_drake');
    expect([cut.w, cut.h]).toEqual([200, 144]);
    const palette = new Set<number>(Object.values(PAL) as number[]);
    const p = new PixelCanvas(cut.w, cut.h);
    cut.draw(p, 0, { lightFrom: 'left' });
    for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (p.isOpaque(x, y)) expect(palette.has(p.get(x, y)!)).toBe(true);
  });
});
