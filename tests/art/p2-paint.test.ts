// A4.1 review fix — the background painting of a real game's monster sheets (src/art/textures.ts).
// A P2 'relight' sheet is painted ahead only up to a player-2 unit's entrance (base anims + 'summon');
// its other anims wait for the first player-2 use of that monster (monsterSheetKey(id, 1), or
// warmP2Sheet when player 2 sets it face-down) and then join the one background queue. Warming a P2
// sheet's poses warms the P1 sheet's same poses too (a player-2 unit plays the P1 anim keys). ?test
// keeps painting every planned sheet whole and synchronously. Small stand-in arts replace the
// registry: the queue and the bookkeeping are under test here, not the drawing.

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MonsterId } from '../../src/data/cards';
import { MONSTER_IDS } from '../../src/data/cards';
import type { AnimSpec, AnyMonsterAnim, MonsterArt, MonsterAnimExtra } from '../../src/art/types';

vi.hoisted(() => {
  // the v3 look (decided once at module init by src/view/layout.ts): set before any import runs
  (globalThis as { __NEON_LOOK?: string }).__NEON_LOOK = 'v3';
});
vi.mock('phaser', async () => (await import('../presentation/_phaser-stub')).phaserStub());

/** The relit (v3-like) stand-ins; every other monster is an old-style art (grid sheet, mirrored P2). */
const RELIT: MonsterId[] = ['crystal_wyrm', 'abyss_magus', 'stone_sentinel'];

vi.mock('../../src/art/monsters', async () => {
  const { PAL } = await import('../../src/art/palette');
  const spec = (frames: number, loop = false): AnimSpec => ({ frames, fps: 10, loop });
  const make = (id: MonsterId, v3: boolean): MonsterArt => {
    const art: MonsterArt = {
      id,
      w: 8,
      h: 8,
      anchorX: 4,
      anchorY: 7,
      hover: 0,
      muzzle: { x: 6, y: 3 },
      core: { x: 4, y: 4 },
      anims: { idle: spec(2, true), roar: spec(2), attack: spec(2), hit: spec(2), guard: spec(1) },
      attackImpactFrame: 1,
      draw: (p, _anim, f, o) => void p.set(1 + f, o?.lightFrom === 'right' ? 5 : 2, PAL.white),
    };
    if (v3) {
      const extra: Partial<Record<MonsterAnimExtra, AnimSpec>> = { summon: spec(2), death: spec(2), revive: spec(2), hitHeavy: spec(1), hitMagic: spec(1), victory: spec(1), toGuard: spec(1), fromGuard: spec(1) };
      if (id === 'abyss_magus') extra.special = spec(1);
      art.extraAnims = extra;
      art.drawExtra = (p, _anim, f, o) => void p.set(2, (o?.lightFrom === 'right' ? 4 : 1) + f, PAL.ink);
      art.p2 = 'relight';
    }
    return art;
  };
  const { MONSTER_IDS: ids } = await import('../../src/data/cards');
  const v1 = new Map(ids.map((id) => [id, make(id, false)]));
  const v3 = new Map(['crystal_wyrm', 'abyss_magus', 'stone_sentinel'].map((id) => [id, make(id as MonsterId, true)]));
  return {
    monsterArt: (id: MonsterId) => v3.get(id) ?? v1.get(id)!,
    monsterArtV3: (id: MonsterId) => v3.get(id) ?? null,
    monsterArtV1: (id: MonsterId) => v1.get(id)!,
  };
});

// ---------------------------------------------------------------- DOM / Phaser stand-ins

interface FakeFrame {
  name: string;
  source: unknown;
  sourceIndex: number;
  setTrim(): FakeFrame;
  setSize(): FakeFrame;
}

function fakeCanvas(): { width: number; height: number; getContext(): { putImageData(): void } } {
  return { width: 0, height: 0, getContext: () => ({ putImageData: () => undefined }) };
}

function fakeTexture(key: string, img: { width: number; height: number }) {
  const frames: Record<string, FakeFrame> = {};
  const t = {
    key,
    manager: {},
    frames,
    source: [{ width: img.width, height: img.height, update: () => undefined }] as unknown[],
    add(name: string, si: number): FakeFrame {
      const fr: FakeFrame = {
        name,
        source: t.source[si],
        sourceIndex: si,
        setTrim() {
          return this;
        },
        setSize() {
          return this;
        },
      };
      frames[name] = fr;
      return fr;
    },
    has: (name: string) => name in frames,
  };
  return t;
}

function fakeScene() {
  const list: Record<string, ReturnType<typeof fakeTexture>> = {};
  const anims = new Map<string, unknown>();
  return {
    sys: { game: {} },
    textures: {
      list,
      exists: (k: string) => k in list,
      remove: (k: string) => void delete list[k],
      addImage: (k: string, img: { width: number; height: number }) => (list[k] = fakeTexture(k, img)),
      get: (k: string) => list[k],
    },
    anims: {
      exists: (k: string) => anims.has(k),
      remove: (k: string) => anims.delete(k),
      create: (cfg: { key: string }) => (anims.set(cfg.key, cfg), cfg),
      get: (k: string) => anims.get(k),
    },
  };
}

const g = globalThis as unknown as Record<string, unknown>;

/** A fresh textures module (its sheet state is module-level) on a page with this query. */
async function freshTextures(search: string) {
  g.document = { createElement: fakeCanvas };
  g.ImageData = class {
    constructor(
      readonly data: Uint8ClampedArray,
      readonly width: number,
      readonly height: number,
    ) {}
  };
  g.location = { search };
  vi.resetModules();
  return import('../../src/art/textures');
}

afterEach(() => {
  delete g.location;
  delete g.document;
  delete g.ImageData;
});

/** Wait (real timers: the painters run on setTimeout) until `ok()`, at most `ms`. */
async function until(ok: () => boolean, ms = 5000): Promise<void> {
  const t0 = Date.now();
  while (!ok()) {
    if (Date.now() - t0 > ms) throw new Error('timed out');
    await new Promise((r) => setTimeout(r, 2));
  }
}

const p2Key = (id: MonsterId) => `mon:${id}:p2`;
const restOf = (id: MonsterId): AnyMonsterAnim[] => ['death', 'revive', ...(id === 'abyss_magus' ? (['special'] as const) : []), 'hitHeavy', 'hitMagic', 'victory', 'toGuard', 'fromGuard'];

describe('P2 relit sheets in a real game (base + summon ahead, the rest on first player-2 use)', () => {
  it('the boot paints every P1 sheet whole and every planned P2 sheet up to its entrance poses', async () => {
    const tx = await freshTextures('');
    const scene = fakeScene();
    tx.buildAllMonsters(scene as never, { p1: [...MONSTER_IDS], p2: [...MONSTER_IDS] });
    await tx.whenSheetsPainted();
    for (const id of MONSTER_IDS) expect(tx.monsterSheetPending(`mon:${id}`), id).toEqual([]);
    for (const id of RELIT) expect(tx.monsterSheetPending(p2Key(id)), id).toEqual(restOf(id));
    const st = tx.sheetPaintStats();
    expect([...st.deferred].sort()).toEqual(RELIT.map(p2Key).sort());
    expect(st.queue).toBe(0);
    // old-style arts have no relit sheet: player 2 mirrors the P1 sheet
    expect(tx.monsterSheetKey('ember_wolf', 1)).toBe('mon:ember_wolf');
  });

  it('the first player-2 unit queues the rest of its sheet (once); warmP2Sheet does the same a turn ahead', async () => {
    const tx = await freshTextures('');
    const scene = fakeScene();
    tx.buildAllMonsters(scene as never, { p1: [...MONSTER_IDS], p2: [...MONSTER_IDS] });
    await tx.whenSheetsPainted();
    expect(tx.monsterSheetKey('abyss_magus', 1)).toBe(p2Key('abyss_magus'));
    expect(tx.sheetPaintStats().deferred).not.toContain(p2Key('abyss_magus'));
    await tx.whenSheetsPainted();
    expect(tx.monsterSheetPending(p2Key('abyss_magus'))).toEqual([]);
    // queued once: a second use finds the sheet complete
    expect(tx.monsterSheetKey('abyss_magus', 1)).toBe(p2Key('abyss_magus'));
    expect(tx.sheetPaintStats().queue).toBe(0);
    // player 2 sets a monster face-down: its rest is painted before the flip can need it
    tx.warmP2Sheet('stone_sentinel');
    await tx.whenSheetsPainted();
    expect(tx.monsterSheetPending(p2Key('stone_sentinel'))).toEqual([]);
    // a monster player 2 never fields keeps its rest unpainted
    expect(tx.monsterSheetPending(p2Key('crystal_wyrm'))).toEqual(restOf('crystal_wyrm'));
    expect(tx.sheetPaintStats().deferred).toEqual([p2Key('crystal_wyrm')]);
    // a P1 unit asks for nothing on the P2 side
    expect(tx.monsterSheetKey('crystal_wyrm', 0)).toBe('mon:crystal_wyrm');
    expect(tx.sheetPaintStats().deferred).toEqual([p2Key('crystal_wyrm')]);
  });

  it('a monster planned for P1 only gets its P2 sheet lazily, from the first player-2 use or a set', async () => {
    const tx = await freshTextures('');
    const scene = fakeScene();
    tx.buildAllMonsters(scene as never, { p1: [...MONSTER_IDS], p2: [] });
    await tx.whenSheetsPainted();
    expect(tx.monsterSheetPending(p2Key('crystal_wyrm'))).toBeNull();
    expect(tx.monsterSheetKey('crystal_wyrm', 1)).toBe(p2Key('crystal_wyrm'));
    tx.warmP2Sheet('abyss_magus');
    await tx.whenSheetsPainted();
    expect(tx.monsterSheetPending(p2Key('crystal_wyrm'))).toEqual([]);
    expect(tx.monsterSheetPending(p2Key('abyss_magus'))).toEqual([]);
  });

  it('warming a P2 sheet warms the P1 sheet of the same monster too (not the other way round)', async () => {
    const tx = await freshTextures('');
    const scene = fakeScene();
    const { monsterArt } = await import('../../src/art/monsters');
    const art = monsterArt('crystal_wyrm');
    // registered, nothing queued: every anim pending on both sheets
    tx.prepareMonsterSheet(scene as never, art);
    tx.prepareMonsterSheet(scene as never, art, { key: p2Key('crystal_wyrm'), draw: { lightFrom: 'right' } });
    const p1 = 'mon:crystal_wyrm';
    expect(tx.monsterSheetPending(p1)).toContain('death');
    tx.warmMonsterSheet(p2Key('crystal_wyrm'), ['death']);
    await until(() => !tx.monsterSheetPending(p1)!.includes('death') && !tx.monsterSheetPending(p2Key('crystal_wyrm'))!.includes('death'));
    expect(tx.monsterSheetPending(p1)).toContain('revive');
    expect(tx.monsterSheetPending(p2Key('crystal_wyrm'))).toContain('revive');
    tx.warmMonsterSheet(p1, ['revive']);
    await until(() => !tx.monsterSheetPending(p1)!.includes('revive'));
    // let any stray painter tick run: the P2 sheet's revive stays pending
    await new Promise((r) => setTimeout(r, 30));
    expect(tx.monsterSheetPending(p2Key('crystal_wyrm'))).toContain('revive');
  });

  it('?test paints every planned sheet whole and synchronously (no deferred rest)', async () => {
    const tx = await freshTextures('?test=1');
    const scene = fakeScene();
    tx.buildAllMonsters(scene as never, { p1: [...MONSTER_IDS], p2: [...MONSTER_IDS] });
    for (const id of MONSTER_IDS) expect(tx.monsterSheetPending(`mon:${id}`), id).toEqual([]);
    for (const id of RELIT) expect(tx.monsterSheetPending(p2Key(id)), id).toEqual([]);
    expect(tx.sheetPaintStats().deferred).toEqual([]);
    tx.warmP2Sheet('crystal_wyrm');
    expect(tx.sheetPaintStats().queue).toBe(0);
  });
});
