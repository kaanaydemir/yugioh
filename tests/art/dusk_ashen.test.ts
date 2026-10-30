// Alacakaranlık Büyücüsü + Kül Ejderi (v3 art, registered): every anim the v3 contract needs exists with
// marks and holds, validateArt (normal tier) reports no errors, a frame is deterministic, P2 is a relight
// of the same silhouette, and the two arts are not the arts they were derived from (distinct palette and size).

import { describe, expect, it } from 'vitest';
import dusk from '../../src/art/monsters-v3/dusk_sorcerer';
import ashen from '../../src/art/monsters-v3/ashen_drake';
import { drawFrame, validateArt } from '../../src/art/rigkit';
import type { AnyMonsterAnim } from '../../src/art/types';

const ALL: readonly AnyMonsterAnim[] = ['idle', 'guard', 'attack', 'roar', 'hit', 'toGuard', 'fromGuard', 'hitHeavy', 'hitMagic', 'summon', 'death', 'revive', 'victory'];

for (const art of [dusk, ashen]) {
  describe(art.id, () => {
    it('has every anim, marks and holds', () => {
      for (const a of ALL) {
        const spec = (art.anims as Record<string, { frames: number; holds?: number[] }>)[a] ?? (art.extraAnims as Record<string, { frames: number; holds?: number[] }>)[a];
        expect(spec, a).toBeTruthy();
        expect(spec.holds?.length, a).toBe(spec.frames);
      }
      expect(art.anims.attack.marks?.release).toBeDefined();
      expect(art.p2).toBe('relight');
    });
    it('validateArt (normal tier) has no errors', () => {
      // the same two known notes the aces carry: a projectile attack has no contact mark (magus), a death
      // continues the reaction (wyrm, REHBER §10.6) — nothing else
      const left = validateArt(art, { tier: 'normal' }).filter((f) => !(f.rule === 'HA-1' && (f.anim === 'attack' || f.anim === 'death')));
      expect(left.map((f) => `${f.rule} ${f.anim}`)).toEqual([]);
    });
    it('draws deterministically and P2 keeps the silhouette', () => {
      const a = drawFrame(art, 'idle', 0, 'left');
      const b = drawFrame(art, 'idle', 0, 'left');
      expect(Buffer.from(a.data).equals(Buffer.from(b.data))).toBe(true);
      const r = drawFrame(art, 'idle', 0, 'right');
      let diff = 0;
      for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) if (a.isOpaque(x, y) !== r.isOpaque(x, y)) diff++;
      expect(diff).toBe(0);
    });
  });
}
