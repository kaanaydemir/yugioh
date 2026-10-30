// Job B: the placeholder card pictures are distinct per monster, palette-only and 44x34 / 88x68.
import { describe, expect, it } from 'vitest';
import { MONSTER_IDS, type MonsterId } from '../../src/data/cards';
import { PAL } from '../../src/art/palette';
import { PixelCanvas } from '../../src/art/pixel';
import { emblemFor, placeholderPortrait, placeholderPortraitBig } from '../../src/art/monsters/_placeholder-new';

const IDS = ['windmane_knight', 'venom_drake', 'wing_lady', 'wisp_imp', 'hourglass_imp', 'shield_titan', 'seal_head', 'seal_arm_r', 'seal_arm_l', 'seal_leg_r', 'seal_leg_l', 'grim_warden', 'steel_silencer'] as MonsterId[];
const small = (id: MonsterId) => {
  const p = new PixelCanvas(44, 34);
  placeholderPortrait(p, id);
  return p;
};

describe('placeholder card pictures', () => {
  it('every id is in the roster', () => {
    for (const id of IDS) expect(MONSTER_IDS).toContain(id);
  });
  it('are fully opaque, palette-only and 44x34 (88x68 big)', () => {
    const pal = new Set<number>(Object.values(PAL) as number[]);
    for (const id of IDS) {
      const p = small(id);
      for (let y = 0; y < 34; y++)
        for (let x = 0; x < 44; x++) {
          const c = p.get(x, y);
          expect(c, `${id} ${x},${y}`).not.toBeNull();
          expect(pal.has(c as number), `${id} colour ${(c as number).toString(16)}`).toBe(true);
        }
      const b = placeholderPortraitBig(id);
      expect([b.w, b.h]).toEqual([88, 68]);
    }
  });
  it('differ pairwise by at least 12% of the pixels (shape or backdrop, not only the tint)', () => {
    const imgs = IDS.map(small);
    for (let i = 0; i < IDS.length; i++)
      for (let j = i + 1; j < IDS.length; j++) {
        // grim_warden shares wisp_imp's attribute+race family: still a different name seed and emblem
        let diff = 0;
        for (let y = 0; y < 34; y++) for (let x = 0; x < 44; x++) if (imgs[i].get(x, y) !== imgs[j].get(x, y)) diff++;
        expect(diff / (44 * 34), `${IDS[i]} vs ${IDS[j]}`).toBeGreaterThan(0.12);
      }
  });
  it('emblems follow the id first, then the race', () => {
    expect(emblemFor('seal_head', 'Büyücü')).toBe('eye');
    expect(emblemFor('seal_leg_l', 'Büyücü')).toBe('bootL');
    expect(emblemFor('hourglass_imp', 'Büyücü')).toBe('hourglass');
    expect(emblemFor('whatever', 'Makine')).toBe('gear');
    expect(emblemFor('whatever', '???')).toBe('crystal');
  });
});
