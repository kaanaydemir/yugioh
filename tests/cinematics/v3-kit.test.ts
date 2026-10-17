// v3 shared kits, part 1 (docs/v3/A0_ENVANTER.md §6.2 item 1): the pure decisions of the
// hit-reaction kit — the contact flash never lights more than half the silhouette and lights the
// side the blow came from (P1 and mirrored P2), and the recoil pose follows the blow's size and
// kind with a fallback to the plain 'hit'.

import { describe, expect, it } from 'vitest';
import { monsterArt } from '../../src/art/monsters';
import { PixelCanvas } from '../../src/art/pixel';
import { MONSTER_ANIMS, type AnyMonsterAnim, type MonsterAnim } from '../../src/art/types';
import { MONSTER_IDS, type MonsterId } from '../../src/data/cards';
import { cropFromHist, histOf, type CropRect, type Hist } from '../../src/cinematics/_v3/flash';
import { blowKindOf, blowSide, hitAnimFor, isHeavyBlow } from '../../src/cinematics/_v3/blow';

function frameHist(id: MonsterId, anim: MonsterAnim, f: number): Hist {
  const art = monsterArt(id);
  const p = new PixelCanvas(art.w, art.h);
  art.draw(p, anim, f);
  return histOf(p.data, art.w, art.h);
}

/** Opaque pixels inside a FRAME-space crop. */
function lit(h: Hist, r: CropRect): number {
  let n = 0;
  if (r.h === h.h) for (let x = r.x; x < r.x + r.w; x++) n += h.cols[x];
  else for (let y = r.y; y < r.y + r.h; y++) n += h.rows[y];
  return n;
}

/** Mean frame column of the lit part vs the whole body (which side of the body it is on). */
function litSide(h: Hist, r: CropRect): 'left' | 'right' {
  return r.x === 0 ? 'left' : 'right';
}

const DIRS = { fromLeft: { x: 0.9, y: -0.45 }, fromRight: { x: -0.9, y: 0.45 }, fromAbove: { x: 0.1, y: 1 } };

describe('contact flash (≤ half the silhouette, on the struck side)', () => {
  it('never covers more than the asked share, and never more than half, on any frame of any monster', () => {
    for (const id of MONSTER_IDS as readonly MonsterId[])
      for (const anim of MONSTER_ANIMS)
        for (let f = 0; f < monsterArt(id).anims[anim].frames; f++) {
          const h = frameHist(id, anim, f);
          if (!h.total) continue;
          for (const flip of [false, true])
            for (const d of Object.values(DIRS))
              for (const cover of [0.3, 0.4, 0.45, 0.9]) {
                const r = cropFromHist(h, flip, d, cover);
                if (!r) continue;
                expect(lit(h, r) / h.total, `${id} ${anim}:${f} flip=${flip}`).toBeLessThanOrEqual(Math.min(0.5, cover) + 1e-9);
              }
        }
  }, 60_000); // draws every frame of the 12 monsters (~3 s alone; slower on a loaded machine)

  it('lights the side the blow comes from — P1 (facing right) and P2 (flipX, mirrored)', () => {
    const h = frameHist('crystal_wyrm', 'idle', 0);
    // P1: a blow travelling right comes from the screen left = the frame's left
    expect(litSide(h, cropFromHist(h, false, DIRS.fromLeft, 0.4)!)).toBe('left');
    expect(litSide(h, cropFromHist(h, false, DIRS.fromRight, 0.4)!)).toBe('right');
    // P2 (mirrored on screen): a blow from the screen right lands on the frame's LEFT columns
    expect(litSide(h, cropFromHist(h, true, DIRS.fromRight, 0.4)!)).toBe('left');
    expect(litSide(h, cropFromHist(h, true, DIRS.fromLeft, 0.4)!)).toBe('right');
    // from above: the top rows
    const top = cropFromHist(h, false, DIRS.fromAbove, 0.4)!;
    expect(top.y).toBe(0);
    expect(top.w).toBe(h.w);
  });
});

describe('blow classification and the recoil pose', () => {
  const unit = (has: AnyMonsterAnim[], flipX = false) => ({ flipX, has: (a: AnyMonsterAnim) => a === 'hit' || has.includes(a) });

  it('front / back / above follow the facing (the assassin behind its target)', () => {
    expect(blowSide(unit([]), { x: -1, y: 0.4 })).toBe('front'); // P1 hit from the right
    expect(blowSide(unit([]), { x: 1, y: -0.2 })).toBe('back');
    expect(blowSide(unit([], true), { x: 1, y: -0.4 })).toBe('front'); // P2 hit from the left
    expect(blowSide(unit([], true), { x: -1, y: -0.15 })).toBe('back'); // sbShadeAtk: shade on the wolf's far side
    expect(blowSide(unit([]), { x: 0.1, y: 1 })).toBe('above');
  });

  it('kind: the monster strike table; no monster source (spells, effects) is magic', () => {
    expect(blowKindOf(monsterArt('crystal_wyrm'))).toBe('magic');
    expect(blowKindOf(monsterArt('magma_titan'))).toBe('physical');
    expect(blowKindOf({ art: monsterArt('shade_assassin') })).toBe('physical');
    expect(blowKindOf(null)).toBe('magic');
  });

  it('heavy: power 3, a lethal blow, or a heavy body at power 2+', () => {
    expect(isHeavyBlow(3, false, null)).toBe(true);
    expect(isHeavyBlow(1, true, null)).toBe(true);
    expect(isHeavyBlow(2, false, 'heavy')).toBe(true);
    expect(isHeavyBlow(2, false, 'mediumHeavy')).toBe(true);
    expect(isHeavyBlow(1, false, 'heavy')).toBe(false);
    expect(isHeavyBlow(2, false, 'light')).toBe(false);
    expect(isHeavyBlow(2, false, null)).toBe(false);
  });

  it('pose: hitMagic for magic, hitHeavy for heavy, else hit — falling back to hit when the art lacks them', () => {
    const full = unit(['hitHeavy', 'hitMagic']);
    expect(hitAnimFor(full, { kind: 'magic', heavy: true })).toBe('hitMagic');
    expect(hitAnimFor(full, { kind: 'physical', heavy: true })).toBe('hitHeavy');
    expect(hitAnimFor(full, { kind: 'physical', heavy: false })).toBe('hit');
    const old = unit([]);
    expect(hitAnimFor(old, { kind: 'magic', heavy: true })).toBe('hit');
    expect(hitAnimFor(old, { kind: 'physical', heavy: true })).toBe('hit');
    expect(hitAnimFor(unit(['hitHeavy']), { kind: 'magic', heavy: true })).toBe('hitHeavy');
  });
});
