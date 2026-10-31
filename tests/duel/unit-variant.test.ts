// Lane A shared infrastructure — the monster variant mechanism (docs/v3/kart-a/cloud_hatchling.md §3.3;
// src/art/variants.ts, src/duel/unit-variant.ts, the MonsterUnit hooks, src/cinematics/_core/project.ts):
//  - the registry: a slot shows a variant only in the v3 look and only while its `when` holds; sheet keys
//  - the unit hooks: a unit with a variant shows / plays the variant's own sheets; every other unit
//    gets null from every hook (today's path)
//  - the sheet swap persists across resyncs (upgrade-only; a rebuilt unit of a grown uid is grown from
//    its first frame; a slot without the growth — a re-summoned hatchling — builds a baby)
//  - the badge never rolls back: the projected snapshot after the growth's activate already carries
//    permAtk / permDef (FieldView.sync's setStats reads currentAtk of that snapshot)

import { describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  // the v3 look (decided once at module init by src/view/layout.ts): set before any import runs
  (globalThis as { __NEON_LOOK?: string }).__NEON_LOOK = 'v3';
});
vi.mock('phaser', async () => (await import('../presentation/_phaser-stub')).phaserStub());
vi.mock('../../src/art/textures', async (orig) => {
  const real = await orig<typeof import('../../src/art/textures')>();
  return { ...real, prepareMonsterSheet: vi.fn((_s: unknown, _a: unknown, o: { key: string }) => o.key), warmMonsterSheet: vi.fn() };
});

import { PAL } from '../../src/art/palette';
import type { AnimSpec, MonsterArt } from '../../src/art/types';
import { prepareMonsterSheet, warmMonsterSheet } from '../../src/art/textures';
import { registerMonsterVariant, rewindAnims, rewindSfx, slotVariant, variantArt, variantOfSheetKey, variantSheetKey } from '../../src/art/variants';
import { MonsterUnit } from '../../src/duel/MonsterUnit';
import { installUnitVariants, setUnitVariant, syncSlotVariant, syncUidVariants, uidVariant, unitSheetKey, variantOf, variantTag } from '../../src/duel/unit-variant';
import { applyEvent, projectBatch } from '../../src/cinematics/_core/project';
import { apply, currentAtk, currentDef, type Action, type GameState } from '../../src/engine';
import type { MonsterSlot } from '../../src/engine/types';
import { scenario } from '../engine/helpers';
import { nextCoin } from '../engine/b2_kit';

const spec = (frames: number, loop = false): AnimSpec => ({ frames, fps: 10, loop });
const GROWN: MonsterArt = {
  id: 'cloud_hatchling',
  w: 8,
  h: 8,
  anchorX: 4,
  anchorY: 7,
  hover: 0,
  muzzle: { x: 6, y: 3 },
  core: { x: 4, y: 4 },
  anims: { idle: spec(2, true), roar: spec(2), attack: spec(2), hit: spec(2), guard: spec(1) },
  attackImpactFrame: 1,
  draw: (p, _anim, f) => void p.set(1 + f, 2, PAL.white),
  p2: 'relight',
};
registerMonsterVariant('cloud_hatchling', {
  name: 'grown',
  art: () => GROWN,
  when: (s) => s.permAtk !== undefined,
  rewind: [
    { anim: 'special', reverse: true },
    { anim: 'summon', reverse: true },
  ],
  rewindSfx: 'uiClick',
});
installUnitVariants();

const slot = (o: Partial<MonsterSlot> = {}): MonsterSlot => ({ uid: 7, position: 'attack', faceUp: true, enteredTurn: 1, attacksThisTurn: 0, positionChangedTurn: -1, ...o });

/** A stand-in unit: the fields the hooks read, setArt recorded. */
function fakeUnit(scene: object, uid = 7, player: 0 | 1 = 0) {
  const u = { scene, uid, cardId: 'cloud_hatchling', player, art: { id: 'cloud_hatchling' } as MonsterArt, sheetKey: 'mon:cloud_hatchling', setArt: vi.fn() };
  u.setArt.mockImplementation((a: MonsterArt) => (u.art = a));
  return u as unknown as MonsterUnit & { setArt: ReturnType<typeof vi.fn> };
}
const fakeScene = () => ({ textures: { exists: () => false } }) as unknown as Phaser.Scene;

function stateWith(m: MonsterSlot | null): GameState {
  const s = scenario({ p0: { monsters: ['cloud_hatchling'] } });
  const uid = s.players[0].monsters[0]!.uid;
  s.players[0].monsters[0] = m ? { ...m, uid } : null;
  return s;
}

describe('variant registry (src/art/variants.ts)', () => {
  it('a slot shows the variant only while `when` holds; keys per player; key parsing', () => {
    expect(slotVariant('cloud_hatchling', slot())).toBeNull();
    expect(slotVariant('cloud_hatchling', slot({ permAtk: 1200, permDef: 800 }))).toBe('grown');
    expect(slotVariant('stone_sentinel', slot({ permAtk: 1200 }))).toBeNull();
    expect(variantArt('cloud_hatchling', 'grown')).toBe(GROWN);
    expect(variantArt('cloud_hatchling', 'nope')).toBeNull();
    expect(variantSheetKey('cloud_hatchling', 'grown', 0)).toBe('mon:cloud_hatchling:grown');
    expect(variantSheetKey('cloud_hatchling', 'grown', 1)).toBe('mon:cloud_hatchling:grown:p2');
    expect(variantOfSheetKey('mon:cloud_hatchling:grown:p2')).toEqual({ id: 'cloud_hatchling', name: 'grown', p2: true });
    expect(variantOfSheetKey('mon:cloud_hatchling:grown')).toEqual({ id: 'cloud_hatchling', name: 'grown', p2: false });
    for (const k of ['mon:cloud_hatchling', 'mon:cloud_hatchling:p2', 'mon:stone_sentinel:grown', 'mon:cloud_hatchling:grown:idle', undefined]) expect(variantOfSheetKey(k), String(k)).toBeNull();
  });

  it('the rewind contract: the base form rewinds its summon; a variant its own steps and voice', () => {
    expect(rewindAnims('cloud_hatchling', null)).toEqual([{ anim: 'summon', reverse: true }]);
    expect(rewindAnims('stone_sentinel', null)).toEqual([{ anim: 'summon', reverse: true }]);
    expect(rewindAnims('cloud_hatchling', 'grown').map((s) => s.anim)).toEqual(['special', 'summon']);
    expect(rewindSfx('cloud_hatchling', null)).toBeNull();
    expect(rewindSfx('cloud_hatchling', 'grown')).toBe('uiClick');
  });
});

describe('unit hooks (src/duel/unit-variant.ts → MonsterUnit)', () => {
  it('every hook is null for a unit without a variant (today\'s path)', () => {
    const u = fakeUnit(fakeScene());
    expect(variantOf(u)).toBeNull();
    expect(variantTag(u)).toBe('');
    expect(MonsterUnit.sheetFor!(u)).toBeNull();
    expect(MonsterUnit.animSheetFor!(u)).toBeNull();
    expect(MonsterUnit.animKeyFor!(u, 'idle')).toBeNull();
    MonsterUnit.onBuilt!(u);
    expect(u.setArt).not.toHaveBeenCalled();
    expect(unitSheetKey(u)).toBe('mon:cloud_hatchling'); // monsterSheetKey(id, 0)
  });

  it('setUnitVariant swaps the art once, warms both players\' sheets, and the hooks point at the variant\'s own sheets', () => {
    const sc = fakeScene();
    const u = fakeUnit(sc, 8, 1);
    vi.mocked(prepareMonsterSheet).mockClear();
    vi.mocked(warmMonsterSheet).mockClear();
    expect(setUnitVariant(u, 'grown')).toBe(true);
    expect(u.setArt).toHaveBeenCalledTimes(1);
    expect(u.setArt).toHaveBeenCalledWith(GROWN);
    expect(variantOf(u)).toBe('grown');
    expect(variantTag(u)).toBe(':grown');
    expect(uidVariant(sc, 8)).toBe('grown');
    const warmed = vi.mocked(warmMonsterSheet).mock.calls.map((c) => c[0]).sort();
    expect(warmed).toEqual(['mon:cloud_hatchling:grown', 'mon:cloud_hatchling:grown:p2']);
    // the P2 sheet is drawn lit from the right
    const p2 = vi.mocked(prepareMonsterSheet).mock.calls.find((c) => c[2]?.key === 'mon:cloud_hatchling:grown:p2');
    expect(p2?.[2]?.draw).toEqual({ lightFrom: 'right' });
    expect(MonsterUnit.sheetFor!(u)).toBe('mon:cloud_hatchling:grown:p2');
    expect(MonsterUnit.animSheetFor!(u)).toBe('mon:cloud_hatchling:grown');
    expect(MonsterUnit.animKeyFor!(u, 'attack')).toBe('mon:cloud_hatchling:grown:attack');
    // upgrade-only: the same name again does nothing, another / unknown name is refused
    expect(setUnitVariant(u, 'grown')).toBe(true);
    expect(setUnitVariant(u, 'nope')).toBe(false);
    expect(u.setArt).toHaveBeenCalledTimes(1);
  });

  it('ownsKey: P1 / P2 / the shown sheet / the anim keys\' sheet; nothing else', () => {
    const u = { p1Key: 'mon:x', p2Key: 'mon:x:p2', sheetKey: 'mon:x:grown:p2', animSheetKey: 'mon:x:grown' };
    const owns = (k: string) => MonsterUnit.prototype.ownsKey.call(u as unknown as MonsterUnit, k);
    for (const k of ['mon:x', 'mon:x:p2', 'mon:x:grown:p2', 'mon:x:grown']) expect(owns(k), k).toBe(true);
    for (const k of ['mon:y', 'shatter:x:idle:0', 'mon:x:other']) expect(owns(k), k).toBe(false);
  });
});

describe('the sheet swap persists across resyncs', () => {
  it('a grown unit stays grown through every later sync; a rebuilt unit of that uid is grown from its first frame', () => {
    const sc = fakeScene();
    const grownState = stateWith(slot({ permAtk: 1200, permDef: 800 }));
    const uid = grownState.players[0].monsters[0]!.uid;
    const u = fakeUnit(sc, uid);
    // sync 1: the slot is grown → the unit is upgraded
    syncUidVariants(sc, grownState);
    syncSlotVariant(u, 'cloud_hatchling', grownState.players[0].monsters[0]!);
    expect(variantOf(u)).toBe('grown');
    expect(MonsterUnit.sheetFor!(u)).toBe('mon:cloud_hatchling:grown');
    // syncs 2…4 (the same state, then a stale snapshot without the growth): never rolled back
    for (const s of [grownState, grownState, stateWith(slot())]) {
      syncUidVariants(sc, s);
      syncSlotVariant(u, 'cloud_hatchling', s.players[0].monsters[0]!);
      expect(variantOf(u)).toBe('grown');
      expect(MonsterUnit.sheetFor!(u)).toBe('mon:cloud_hatchling:grown');
    }
    expect(u.setArt).toHaveBeenCalledTimes(1);
    // a unit rebuilt for the grown uid (a hat reveal, a rebuilt tile) is grown in its constructor
    syncUidVariants(sc, grownState);
    const rebuilt = fakeUnit(sc, uid);
    MonsterUnit.onBuilt!(rebuilt);
    expect(variantOf(rebuilt)).toBe('grown');
    // a slot without the growth (a re-summoned hatchling): the uid is dropped, a new unit is a baby
    syncUidVariants(sc, stateWith(slot()));
    const baby = fakeUnit(sc, uid);
    MonsterUnit.onBuilt!(baby);
    expect(variantOf(baby)).toBeNull();
    // a face-down grown slot shows no unit variant either
    syncUidVariants(sc, stateWith(slot({ faceUp: false, permAtk: 1200, permDef: 800 })));
    expect(uidVariant(sc, uid)).toBeNull();
  });
});

describe('the badge never rolls back (project.ts: the growth is projected)', () => {
  const coinAct = (p: 0 | 1, zone: number): Action => ({ type: 'activateMonster', player: p, zone });
  const call = (p: 0 | 1, c: 'heads' | 'tails'): Action => ({ type: 'callCoin', player: p, call: c });

  it('every snapshot from the hatchling\'s activate on carries permAtk / permDef = the engine\'s after state', () => {
    let s = scenario({ p0: { monsters: ['dial_jester', 'cloud_hatchling'] }, p1: { monsters: ['stone_sentinel'] } });
    s = apply(s, coinAct(0, 0)).state;
    const before = structuredClone(s);
    const r = apply(s, call(0, nextCoin(s)));
    const uid = r.state.players[0].monsters[1]!.uid;
    expect([currentAtk(r.state, uid), currentDef(r.state, uid)]).toEqual([2300, 1700]);
    const snaps = projectBatch(before, r.events);
    const ai = r.events.findIndex((e) => e.type === 'activate' && e.uid === uid);
    expect(ai).toBeGreaterThanOrEqual(0);
    expect(currentAtk(snaps[ai], uid), 'before its activate: the baby').toBe(1100);
    for (let n = ai + 1; n < snaps.length; n++) {
      const m = snaps[n].players[0].monsters[1]!;
      expect([m.permAtk, m.permDef], `snap ${n}`).toEqual([1200, 800]);
      expect([currentAtk(snaps[n], uid), currentDef(snaps[n], uid)], `snap ${n}`).toEqual([2300, 1700]);
    }
  });

  it('an activate of any other monster effect, or of a hatchling that already grew, changes nothing', () => {
    const s = scenario({ p0: { monsters: ['cloud_hatchling', 'dial_jester'] } });
    const h = s.players[0].monsters[0]!;
    h.permAtk = 500;
    h.permDef = 100;
    applyEvent(s, { type: 'activate', player: 0, uid: h.uid, cardId: 'cloud_hatchling', kind: 'monsterEffect', from: 'monster', zone: 0 } as never);
    expect([h.permAtk, h.permDef]).toEqual([500, 100]);
    const j = s.players[0].monsters[1]!;
    applyEvent(s, { type: 'activate', player: 0, uid: j.uid, cardId: 'dial_jester', kind: 'monsterEffect', from: 'monster', zone: 1 } as never);
    expect(j.permAtk).toBeUndefined();
  });
});
