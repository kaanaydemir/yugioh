// Stepped light (v3 look, A1 item 9): the tone table matches the still preview's seats, levels are
// quarter steps with a fixed ordered dither, and only matte pad / pile pixels are ever lit.
import { describe, expect, it } from 'vitest';
import { PAL } from '../../src/art/palette';
import { topAt } from '../../src/still/arena';
import { zoneXY } from '../../src/view/layout';
import { MAX_STEPS, padColorAt, quantize, stepTone, stepsAt } from '../../src/view/light/stepped';

describe('stepped light: tone table', () => {
  it('matches the still preview seats (src/still/scene.ts CYAN_LIGHT / VIOLET_LIGHT on a pad)', () => {
    expect(stepTone(PAL.night1, PAL.cyan3, 1)).toBe(PAL.cyan0);
    expect(stepTone(PAL.night1, PAL.void3, 1)).toBe(PAL.void1);
  });

  it('never darkens, and a second step goes one tone further up the same ramp', () => {
    for (const hue of [PAL.cyan3, PAL.void3, PAL.fire3, PAL.gold4, PAL.water3, PAL.leaf3, PAL.crim3, PAL.mag3, PAL.white]) {
      for (const base of [PAL.night0, PAL.night1]) {
        const a = stepTone(base, hue, 1);
        const b = stepTone(base, hue, 2);
        expect(a).not.toBe(base);
        expect(b).not.toBe(a);
      }
    }
    expect(stepTone(PAL.night1, PAL.white, 1)).toBe(PAL.night2);
    expect(stepTone(PAL.night1, PAL.white, 2)).toBe(PAL.night3);
    expect(stepTone(PAL.night1, PAL.cyan3, 2)).toBe(PAL.cyan1);
    expect(stepTone(PAL.night1, PAL.cyan3, 0)).toBe(PAL.night1);
  });
});

describe('stepped light: levels and dither', () => {
  it('quantises to quarter steps in [0, MAX_STEPS]', () => {
    expect(quantize(0)).toBe(0);
    expect(quantize(-1)).toBe(0);
    expect(quantize(0.1)).toBe(0);
    expect(quantize(0.2)).toBe(0.25);
    expect(quantize(1.06)).toBe(1);
    expect(quantize(9)).toBe(MAX_STEPS);
  });

  it('a fraction is an ordered dither of that density (fixed to the floor)', () => {
    for (const [level, lit] of [
      [0.25, 1],
      [0.5, 2],
      [0.75, 3],
      [1, 4],
    ] as const) {
      let n = 0;
      for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) n += stepsAt(level, x, y);
      expect(n).toBe(lit);
    }
    // 1.5: every pixel one step, half of them two
    let two = 0;
    for (let y = 10; y < 12; y++) for (let x = 20; x < 22; x++) two += stepsAt(1.5, x, y) === 2 ? 1 : 0;
    expect(two).toBe(2);
  });
});

describe('stepped light: pad mask', () => {
  it('lights only matte pad / pile pixels (never zone lines, gaps, border, bridge or the slab edge)', () => {
    const z = zoneXY(0, 'monster', 2);
    let pad = 0;
    for (let y = z.y - 20; y <= z.y + 20; y++)
      for (let x = z.x - 40; x <= z.x + 40; x++) {
        const t = topAt(x, y);
        const c = padColorAt(x, y);
        if (t && (t.kind === 'pad' || t.kind === 'pile')) {
          expect(c).toBe(t.color);
          pad++;
        } else expect(c).toBeNull();
      }
    expect(pad).toBeGreaterThan(400);
    expect(padColorAt(-1, 10)).toBeNull();
    expect(padColorAt(10, 400)).toBeNull();
  });
});
