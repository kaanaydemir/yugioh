// A1 item 10 — P2 'relight'. The test-only shim (src/dev/relight-shim.ts) relights the abyss
// magus idle for player 2 with the hand-painted still frame (lit from the frame's top-right). On
// screen player 2 is mirrored, so: P1 (original) and P2 relit are lit from the screen LEFT, P2
// 'mirror' (today's flipX of the P1 sheet) from the screen RIGHT. Pins that with litBias() and
// that the shim leaves every non-relit draw identical to the original art.

import { describe, expect, it } from 'vitest';
import { monsterArt } from '../../src/art/monsters';
import { PixelCanvas } from '../../src/art/pixel';
import { MONSTER_ANIMS } from '../../src/art/types';
import { idleBob, litBias, relightShimArt } from '../../src/dev/relight-shim';

const base = monsterArt('abyss_magus');
const shim = relightShimArt();

function frame(art = base, anim: (typeof MONSTER_ANIMS)[number] = 'idle', f = 0, right = false): PixelCanvas {
  const p = new PixelCanvas(art.w, art.h);
  if (right) art.draw(p, anim, f, { lightFrom: 'right' });
  else art.draw(p, anim, f);
  return p;
}

describe('relight shim (dev only)', () => {
  it('opts in to the P2 relight sheet; the shipped magus stays mirror', () => {
    expect(shim.p2).toBe('relight');
    expect(base.p2 ?? 'mirror').toBe('mirror');
  });

  it('P1 draws (no DrawOpts) are pixel-identical to the original art, every anim and frame', () => {
    for (const anim of MONSTER_ANIMS)
      for (let f = 0; f < base.anims[anim].frames; f++) expect(Array.from(frame(shim, anim, f).data), `${anim}:${f}`).toEqual(Array.from(frame(base, anim, f).data));
  });

  it('only the idle is relit; the other anims draw the original even with lightFrom right', () => {
    for (const anim of MONSTER_ANIMS.filter((a) => a !== 'idle'))
      for (let f = 0; f < base.anims[anim].frames; f++) expect(Array.from(frame(shim, anim, f, true).data), `${anim}:${f}`).toEqual(Array.from(frame(base, anim, f).data));
    expect(Array.from(frame(shim, 'idle', 0, true).data)).not.toEqual(Array.from(frame(base, 'idle', 0).data));
  });

  it('the relit idle keeps the original float (bob per frame)', () => {
    const bobs = Array.from({ length: base.anims.idle.frames }, (_, f) => idleBob(f));
    expect(bobs[0]).toBe(0);
    expect(Math.min(...bobs)).toBeLessThan(0);
    // the relit frame's top edge follows the original's
    for (let f = 0; f < bobs.length; f++) expect(frame(shim, 'idle', f, true).bounds()!.y - frame(shim, 'idle', 0, true).bounds()!.y).toBe(bobs[f]);
  });

  it('screen light side: P1 left, P2 mirror right, P2 relit left', () => {
    const p1 = litBias(frame(base));
    const p2mirror = litBias(frame(base), true);
    const p2relit = litBias(frame(shim, 'idle', 0, true), true);
    for (const k of ['bias', 'mass'] as const) {
      expect(p1[k], `P1 ${k}`).toBeGreaterThan(0);
      expect(p2mirror[k], `P2 mirror ${k}`).toBeLessThan(0);
      expect(p2relit[k], `P2 relit ${k}`).toBeGreaterThan(0);
    }
  });
});
