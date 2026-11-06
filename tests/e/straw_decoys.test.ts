// Lane E — Saman Korkuluklar (straw_decoys): the film stages (src/duel/scenarios/e_straw_decoys.ts) play through the
// engine and emit what the presentation (src/cinematics/spells/straw_decoys.ts) consumes: in the activation batch
// `activate`, one `summon {from:'token'}` per decoy (first free zones, left → right) and the spell's own
// toGraveyard(resolved); answering a direct attack, the attacker's pick arrives in a later batch as `target`
// (sourceUid = the spell) and the battle then aims at that decoy.
import { describe, expect, it } from 'vitest';
import { apply, type Action, type GameEvent, type GameState } from '../../src/engine';
import { buildStage, uidOf } from '../../src/duel/scenario';
import PACK from '../../src/duel/scenarios/e_straw_decoys';
import { isUiStep } from '../../src/duel/scenarios';
import type { CardId } from '../../src/data/cards';
import type { PlayerId } from '../../src/engine/types';
import art from '../../src/art/cardart-v3/straw_decoys';
import { artStats, renderArt } from '../../src/art/cardart-v3/_kit';

function runStage(key: string): { state: GameState; batches: GameEvent[][] } {
  const sc = PACK[key];
  let state = buildStage(sc.stage);
  const batches: GameEvent[][] = [];
  for (const step of sc.steps) {
    if (isUiStep(step)) continue;
    const a = (typeof step === 'function' ? step({ uid: (id: CardId, p?: PlayerId) => uidOf(state, id, p) }) : step) as Action;
    const r = apply(state, a);
    state = r.state;
    batches.push(r.events);
  }
  return { state, batches };
}

const tokenZones = (ev: GameEvent[]) => ev.flatMap((e) => (e.type === 'summon' && e.from === 'token' ? [e.zone] : []));

describe('e_straw_decoys stages', () => {
  const cases: [string, number, number[]][] = [
    // key, the batch with the activation, the token zones
    ['eStrawAttack', 1, [0, 1, 2, 3]],
    ['eStrawAttackP2', 1, [0, 1, 2, 3]],
    ['eStrawAttackWait', 1, [0, 1, 2, 3]],
    ['eStrawAttack3', 1, [0, 1]],
    ['eStrawOwn', 0, [0, 1, 3]],
    ['eStrawOwnP2', 0, [0, 1, 3]],
    ['eStrawSet', 0, [1, 2]],
    ['eStrawSetP2', 0, [1, 2]],
    ['eStrawOne', 0, [2]],
    ['eStrawSummon', 1, [0, 1, 2]],
  ];
  for (const [key, bi, zones] of cases)
    it(key, () => {
      const { batches } = runStage(key);
      const ev = batches[bi];
      const a = ev.find((e) => e.type === 'activate');
      expect(a && a.type === 'activate' && a.cardId).toBe('straw_decoys');
      expect(tokenZones(ev)).toEqual(zones);
      const g = ev.find((e) => e.type === 'toGraveyard' && e.cardId === 'straw_decoys');
      expect(g && g.type === 'toGraveyard' && g.from).toBe('resolved');
    });
  it('eStrawAttack: the attack turns to the picked decoy', () => {
    const { batches } = runStage('eStrawAttack');
    const t = batches[2].find((e) => e.type === 'target');
    expect(t && t.type === 'target' && t.targets[0]).toEqual({ player: 1, zone: 'monster', index: 1 });
    const b = batches[2].find((e) => e.type === 'battle');
    expect(b && b.type === 'battle' && b.targetZone).toBe(1);
  });
});

describe('straw_decoys card art', () => {
  for (const size of ['big', 'small'] as const)
    it(`${size}: palette, noise and colour budgets`, () => {
      const r = renderArt(art, 0);
      const s = artStats(r[size], size === 'big' ? r.bigPx : r.smallPx, size === 'big' ? art.focus : undefined);
      expect(r.auto).toBe(false);
      expect(s.offPalette).toBe(0);
      expect(s.colors).toBeLessThanOrEqual(20);
      expect(s.isolated).toBeLessThanOrEqual(0.1);
    });
});

// ---- the cinematic's pure painters (src/cinematics/spells/_straw_decoys_paint.ts): palette only, every crow pose
// inside its raster, the flying poses within the clearance the glide is planned with (CROW_LOW / CROW_HIGH)
import { PixelCanvas } from '../../src/art/pixel';
import { PAL } from '../../src/art/palette';
import * as SP from '../../src/cinematics/spells/_straw_decoys_paint';

describe('straw_decoys painters', () => {
  const pal = new Set<number>(Object.values(PAL) as number[]);
  it('the crow: palette only, flying poses inside CROW_LOW / CROW_HIGH, the caw throws the head up', () => {
    const heads: Record<string, number> = {};
    for (const pose of ['up', 'mid', 'down', 'flare', 'perch', 'crouch', 'caw', 'cawEnd', 'bob'] as const) {
      const p = new PixelCanvas(SP.CW, SP.CH);
      SP.paintCrowPx(p, pose, pose === 'caw' ? 2 : 0);
      const b = p.bounds();
      expect(b, pose).not.toBeNull();
      for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
        const c = p.get(x, y);
        if (c !== null) expect(pal.has(c), `${pose} ${x},${y}`).toBe(true);
      }
      if (pose === 'up' || pose === 'mid' || pose === 'down') {
        expect(b!.y + b!.h - 1 - SP.CFY).toBeLessThanOrEqual(SP.CROW_LOW);
        expect(SP.CFY - b!.y).toBeLessThanOrEqual(SP.CROW_HIGH);
      }
      heads[pose] = b!.y;
    }
    expect(heads.caw).toBeLessThan(heads.perch);
  });
  it('the scarecrow: the stab crater and the sack head paint palette-only pixels', () => {
    const p = new PixelCanvas(SP.RW, SP.RH);
    SP.paintDecoyPx(p, { ...SP.freshBuild(), stake: true, stakeY: 0, sink: 2, squash1: 2, crater: 1, wrap: 1, coatY: 0, headY: 0, hatY: 0, arm: 4 }, 0);
    let n = 0;
    for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
      const c = p.get(x, y);
      if (c === null) continue;
      n++;
      expect(pal.has(c)).toBe(true);
    }
    expect(n).toBeGreaterThan(300);
  });
});
