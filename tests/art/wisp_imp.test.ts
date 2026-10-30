import { describe, expect, it } from 'vitest';
import art from '../../src/art/monsters-v3/wisp_imp';
import { drawFrame, validateArt } from '../../src/art/rigkit/validate';
import { PAL } from '../../src/art/palette';

describe('wisp_imp v3 art', () => {
  it('passes validateArt without errors', () => {
    const errs = validateArt(art, { tier: 'normal' }).filter((f) => f.severity === 'error');
    expect(errs).toEqual([]);
  }, 60000);

  it('has every extra anim and mandatory marks', () => {
    for (const a of ['summon', 'death', 'revive', 'hitHeavy', 'hitMagic', 'victory', 'toGuard', 'fromGuard'] as const) expect(art.extraAnims?.[a]).toBeTruthy();
    expect(art.anims.attack.marks?.contact).toBeDefined();
    expect(art.p2).toBe('relight');
  });

  it('is deterministic and uses palette colours only', () => {
    const a = drawFrame(art, 'idle', 3);
    const b = drawFrame(art, 'idle', 3);
    expect(Array.from(a.data)).toEqual(Array.from(b.data));
    const pal = new Set<number>(Object.values(PAL));
    for (let i = 0; i < a.data.length; i += 4) {
      if (!a.data[i + 3]) continue;
      expect(pal.has((a.data[i] << 16) | (a.data[i + 1] << 8) | a.data[i + 2])).toBe(true);
    }
  });
});
