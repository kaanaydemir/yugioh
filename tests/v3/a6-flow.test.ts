// Lane A6-B (docs/v3/A6_PLAN.md §6.4) — B0: the HUD v3 skin (F10, contract S-1). Painters stay on the
// palette and on frameRectV3's geometry; the baked text lays out exactly like pixelText(); the style →
// trim table matches F10; the v3 HUD is handed out only under V3_A6_B and offers HudView's whole API;
// A6-B's files hold no off-palette colour constant and no ADD blend (source scan). Later B steps add
// the odometer, target-corner, A6_MS and decision tests here.

import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('phaser', async () => (await import('../presentation/_phaser-stub')).phaserStub());

import { FRAME_V3, frameRectV3 } from '../../src/art/frame-v3';
import { PAL } from '../../src/art/palette';
import { PixelCanvas } from '../../src/art/pixel';
import { measureText } from '../../src/ui/text';
import {
  HUD3,
  ICON_DISABLED,
  buttonBodyV3,
  chipV3,
  emblemV3,
  iconTones,
  layoutLine,
  menuIconV3,
  panelBodyV3,
  plateBodyV3,
  recolorIcon,
  styleTone,
  styleTrim,
  textCanvas,
  trimPixels,
} from '../../src/view/v3/hudSkin';

const G = globalThis as Record<string, unknown>;
const PAL_SET = new Set<number>(Object.values(PAL));

afterEach(() => {
  delete G.__NEON_LOOK;
  delete G.__NEON_V3FLAGS;
});

/** Every opaque pixel of a canvas is fully opaque and a PAL colour. */
function offPalette(p: PixelCanvas): string[] {
  const bad: string[] = [];
  for (let y = 0; y < p.h; y++)
    for (let x = 0; x < p.w; x++) {
      const a = p.alpha(x, y);
      if (a === 0) continue;
      const c = p.get(x, y)!;
      if (a !== 255 || !PAL_SET.has(c)) bad.push(`${x},${y}:${c.toString(16)}@${a}`);
    }
  return bad;
}

describe('HUD v3 painters (F10, S-1)', () => {
  it('every painter draws opaque palette pixels only', () => {
    const canvases: [string, PixelCanvas][] = [
      ['panel P1', panelBodyV3(0)],
      ['panel P2', panelBodyV3(1)],
      ['emblem P1', emblemV3(0)],
      ['emblem P2', emblemV3(1)],
      ['chip P1', chipV3(0, 0)],
      ['chip P2 caret+1', chipV3(1, 1)],
      ['button', buttonBodyV3(136, 25, false)],
      ['button pressed', buttonBodyV3(136, 25, true)],
      ['plate', plateBodyV3(120, 17, 0)],
      ['plate -1', plateBodyV3(120, 17, -1)],
      ['plate -2', plateBodyV3(120, 17, -2)],
      ['text md', textCanvas("Bir kart seç ya da SAVAŞ'a geç", 'md', PAL.white)],
      ['text lg', textCanvas('3648', 'lg', PAL.crim3)],
      ['text sm', textCanvas('Animasyon hızı: 3× (tıkla: değiştir)', 'sm', PAL.mist)],
      ['menu icon', menuIconV3(iconTones('neutral'))],
    ];
    for (const [name, p] of canvases) expect(offPalette(p), name).toEqual([]);
  });

  it('the panel keeps the frame rules: ink outline with cut corners, header band night1 over night0', () => {
    const p = panelBodyV3(0);
    const { w, h, header } = HUD3.panel;
    expect([p.w, p.h]).toEqual([w, h]);
    expect(p.get(0, 0)).toBeNull(); // cut corner
    expect(p.get(1, 0)).toBe(FRAME_V3.ink);
    expect(p.get(0, h - 2)).toBe(FRAME_V3.ink);
    expect(p.get(4, 4)).toBe(FRAME_V3.bodyTop); // header band
    expect(p.get(4, header + 4)).toBe(FRAME_V3.bodyBottom); // body
  });

  it('trimPixels is frameRectV3’s own trim: the ring one pixel inside, light top / left, dark bottom / right', () => {
    for (const [w, h] of [
      [148, 64],
      [136, 24],
      [17, 15],
    ] as const) {
      const t = trimPixels(w, h);
      const ref = new PixelCanvas(w, h);
      frameRectV3(ref, 0, 0, w, h, { light: PAL.gold4, dark: PAL.gold1 }, { body: false, outline: false });
      const light = new Set(t.light.map(([x, y]) => `${x},${y}`));
      const dark = new Set(t.dark.map(([x, y]) => `${x},${y}`));
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const c = ref.get(x, y);
          expect(light.has(`${x},${y}`), `${w}x${h} light ${x},${y}`).toBe(c === PAL.gold4);
          expect(dark.has(`${x},${y}`), `${w}x${h} dark ${x},${y}`).toBe(c === PAL.gold1);
        }
      expect(t.light.length + t.dark.length).toBe(2 * (w - 2) + 2 * (h - 2) - 4);
      expect(t.light.every(([x, y]) => x === 1 || y === 1)).toBe(true);
    }
  });

  it('a pressed button face is the normal one moved down by exactly one whole pixel', () => {
    const n = buttonBodyV3(40, 16, false);
    const p = buttonBodyV3(40, 16, true);
    for (let y = 0; y < 15; y++) for (let x = 0; x < 40; x++) expect(p.get(x, y + 1)).toBe(n.get(x, y));
    for (let x = 0; x < 40; x++) {
      expect(n.get(x, 15)).toBeNull();
      expect(p.get(x, 0)).toBeNull();
    }
  });
});

describe('baked text (palette pixels instead of a multiply tint)', () => {
  it('lays out exactly like pixelText / measureText (Turkish letters included)', () => {
    const lines = ['OYUNCU 1', 'ÇEKME', 'BİTİŞ', 'TURU BİTİR', "Bir kart seç ya da SAVAŞ'a geç", 'Düello menüsü (Esc)', '4000', '1×'];
    for (const s of lines)
      for (const size of ['sm', 'md', 'lg'] as const) {
        const L = layoutLine(s, size);
        const m = measureText(s, size);
        expect([L.w, L.h], `${size} '${s}'`).toEqual([m.w, m.h]);
      }
  });

  it('a glyph is its fill colour plus a 1-px PAL.ink outline, nothing else', () => {
    const p = textCanvas('ŞĞÜ', 'md', PAL.cyan3);
    const colours = new Set<number>();
    for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (p.alpha(x, y)) colours.add(p.get(x, y)!);
    expect([...colours].sort()).toEqual([PAL.ink, PAL.cyan3].sort());
  });
});

describe('style → trim (F10)', () => {
  it('SAVAŞ crim2 / crim3, TURU BİTİR teal2 / teal3, neutral steel / mist, players cyan / crimson', () => {
    expect(styleTrim('fire')).toEqual({ dark: PAL.crim2, light: PAL.crim3 });
    expect(styleTrim('spell')).toEqual({ dark: PAL.teal2, light: PAL.teal3 });
    expect(styleTrim('neutral')).toEqual({ dark: PAL.steel, light: PAL.mist });
    expect(styleTrim('p1')).toEqual({ dark: PAL.cyan2, light: PAL.cyan3 });
    expect(styleTrim('p2')).toEqual({ dark: PAL.crim2, light: PAL.crim3 });
  });

  it('hover / active one tone up, disabled two down, clamped to the ramp', () => {
    expect(styleTrim('p1', 1)).toEqual({ dark: PAL.cyan3, light: PAL.cyan4 });
    expect(styleTrim('fire', -2)).toEqual({ dark: PAL.crim0, light: PAL.crim1 });
    expect(styleTrim('spell', 5)).toEqual({ dark: PAL.teal4, light: PAL.teal4 });
    expect(styleTone('neutral', 2)).toBe(PAL.white);
  });

  it('re-toned icons keep the ink outline and use only the given tones', () => {
    const src = new PixelCanvas(4, 3);
    src.set(0, 0, PAL.white).set(1, 0, PAL.mist).set(2, 0, PAL.steel).set(3, 0, PAL.night3).set(0, 1, PAL.ink);
    const t = iconTones('fire');
    const out = recolorIcon(src, t);
    expect([out.get(0, 0), out.get(1, 0), out.get(2, 0), out.get(3, 0), out.get(0, 1)]).toEqual([t.w, t.m, t.s, t.n, PAL.ink]);
    const d = recolorIcon(src, ICON_DISABLED);
    expect(offPalette(d)).toEqual([]);
  });
});

describe('the v3 HUD behind V3_A6_B (§5.0.3)', () => {
  const API = [
    'getLp',
    'setLp',
    'setCounts',
    'setActive',
    'setPhase',
    'setTurn',
    'setButtons',
    'setLocked',
    'setSpeed',
    'setHint',
    'flashHint',
    'setSoundOn',
    'setPlayerName',
    'lpXY',
    'panelXY',
    'countXY',
    'flashPanel',
    'shake',
    'setVisible',
    'destroy',
  ];
  const GETTERS = ['currentPhase', 'speedLevel', 'hintText'];

  async function load(look: 'v1' | 'v3', a6?: string): Promise<{ HudView: unknown; HudV3: unknown; HudViewProto: object }> {
    vi.resetModules();
    G.__NEON_LOOK = look;
    if (a6 !== undefined) G.__NEON_V3FLAGS = { a6 };
    const { HudView } = await import('../../src/view/HudView');
    const { HudV3 } = await import('../../src/view/v3/hudV3');
    return { HudView, HudV3, HudViewProto: (HudView as { prototype: object }).prototype };
  }

  it('new HudView() is the v3 HUD only with lane B on; v1, &a6=off and &a6=a keep today’s HUD', async () => {
    const on = await load('v3');
    expect(on.HudView).toBe(on.HudV3);
    const onB = await load('v3', 'b');
    expect(onB.HudView).toBe(onB.HudV3);
    for (const [look, a6] of [
      ['v1', undefined],
      ['v3', 'off'],
      ['v3', 'a'],
    ] as const) {
      const r = await load(look, a6);
      expect(r.HudView, `${look} a6=${a6}`).not.toBe(r.HudV3);
    }
  }, 60000);

  it('the v3 HUD offers every public method and getter of HudView', async () => {
    const v1 = await load('v1');
    const proto = (v1.HudV3 as { prototype: object }).prototype;
    for (const k of API) {
      expect(typeof (v1.HudViewProto as Record<string, unknown>)[k], `HudView.${k}`).toBe('function');
      expect(typeof (proto as Record<string, unknown>)[k], `HudV3.${k}`).toBe('function');
    }
    for (const k of GETTERS) {
      expect(Object.getOwnPropertyDescriptor(v1.HudViewProto, k)?.get, `HudView.${k}`).toBeTypeOf('function');
      expect(Object.getOwnPropertyDescriptor(proto, k)?.get, `HudV3.${k}`).toBeTypeOf('function');
    }
  }, 60000);
});

describe('button skin lifetime', () => {
  it('a skin destroyed during the update emit it listens to is not ticked into the dead scene', async () => {
    // A tween / timer / QA-input callback that destroys a button runs inside the scene's 'update'
    // emit; the emitter keeps walking the listener list it started with, so the skin's listener is
    // called once more after destroy(), when Phaser has already cleared the button's scene.
    const { phaserStub } = await import('../presentation/_phaser-stub');
    const { ButtonSkinV3 } = await import('../../src/view/v3/hudSkin');
    const any = phaserStub().default as Record<string, unknown>;
    const listeners: ((t: number, dt: number) => void)[] = [];
    const events = {
      on: (_e: string, fn: (t: number, dt: number) => void) => listeners.push(fn),
      off: (_e: string, fn: (t: number, dt: number) => void) => {
        const i = listeners.indexOf(fn);
        if (i >= 0) listeners.splice(i, 1);
      },
    };
    const scene = new Proxy(
      {},
      { get: (_t, k) => (k === 'events' ? events : k === 'time' ? { timeScale: 1 } : any[String(k)]) },
    );
    const host = { scene: scene as unknown, w: 48, h: 15, add: () => undefined };
    const skin = new ButtonSkinV3(host as unknown as ConstructorParameters<typeof ButtonSkinV3>[0], {
      label: 'İPTAL',
      size: 'sm',
      style: 'neutral',
    });
    expect(listeners.length).toBe(1);
    const walking = [...listeners];
    skin.flash(34);
    skin.destroy();
    host.scene = undefined;
    expect(listeners.length).toBe(0);
    expect(() => walking.forEach((fn) => fn(0, 16))).not.toThrow();
  });
});

describe('B1: turn plate, odometer, turn / phase timings (F1, F2)', () => {
  it('the plate sits on its owner\u2019s side, whole pixels, on screen, clear of the panel and its mini-hand row', async () => {
    const { PLATE, plateRect, plateWidth, turnPlateText } = await import('../../src/view/v3/TurnPlate');
    const { UI } = await import('../../src/view/layout');
    for (const p of [0, 1] as const) {
      for (const turn of [1, 4, 14, 99]) {
        for (const mode of ['hotseat', 'vsBot', 'demo'] as const) {
          for (const human of [true, false]) {
            const segs = turnPlateText({ mode, human, player: p, turn });
            const w = plateWidth(segs, 'turn');
            const r = plateRect(p, w);
            expect(w).toBeGreaterThanOrEqual(PLATE.minW);
            expect(r.h).toBeGreaterThanOrEqual(12); // §1.5 plates ≥ 12 px
            for (const v of [r.x, r.y, r.w, r.h]) expect(Number.isInteger(v)).toBe(true);
            expect(r.x).toBeGreaterThanOrEqual(0);
            expect(r.x + r.w).toBeLessThanOrEqual(640);
            const panel = p === 0 ? UI.p1Panel : UI.p2Panel;
            // the mini-hand row (≈ 13 px) between the panel and the plate stays clear
            if (p === 0) expect(panel.y - (r.y + r.h)).toBeGreaterThanOrEqual(13);
            else expect(r.y - (panel.y + panel.h)).toBeGreaterThanOrEqual(13);
            // the text fits with its padding
            expect(w).toBeGreaterThanOrEqual(PLATE.padX * 2);
          }
        }
      }
    }
  });

  it('turn plate texts: hot-seat / vsBot / CPU, Turkish letters, palette tones', async () => {
    const { turnPlateText, battlePlateText } = await import('../../src/view/v3/TurnPlate');
    const txt = (o: Parameters<typeof turnPlateText>[0]) => turnPlateText(o).map((s) => s.text).join('');
    expect(txt({ mode: 'hotseat', human: true, player: 1, turn: 4 })).toBe('OYUNCU 2 · TUR 4');
    expect(txt({ mode: 'vsBot', human: true, player: 0, turn: 4 })).toBe('SIRA SENDE · TUR 4');
    expect(txt({ mode: 'vsBot', human: false, player: 1, turn: 4 })).toBe('BİLGİSAYAR · TUR 4');
    expect(txt({ mode: 'demo', human: false, player: 0, turn: 7 })).toBe('OYUNCU 1 · TUR 7');
    expect(battlePlateText().map((s) => s.text).join('')).toBe('SAVAŞ AŞAMASI');
    for (const s of [...turnPlateText({ mode: 'hotseat', human: true, player: 0, turn: 1 }), ...turnPlateText({ mode: 'hotseat', human: true, player: 1, turn: 1 }), ...battlePlateText()])
      expect(PAL_SET.has(s.color)).toBe(true);
  });

  it('the plate body + trim are palette pixels; its trim appears in two palette steps (KO: no alpha)', async () => {
    const { plateCanvas, plateTrim } = await import('../../src/view/v3/TurnPlate');
    const { RAMPS } = await import('../../src/art/palette');
    for (const spec of [
      { player: 0 as const, kind: 'turn' as const, segments: [{ text: 'OYUNCU 1 · TUR 4', color: PAL.white }] },
      { player: 1 as const, kind: 'battle' as const, segments: [{ text: 'SAVAŞ AŞAMASI', color: PAL.white }] },
    ]) {
      const c = plateCanvas(spec);
      expect(offPalette(c)).toEqual([]);
      expect(c.h).toBe(20);
      // ink outline, corners cut
      expect(c.get(5, 0)).toBe(PAL.ink);
      expect(c.alpha(0, 0)).toBe(0);
    }
    const R = RAMPS.cyan;
    expect(plateTrim(R, 0)).toEqual({ dark: R[3], light: R[4] });
    expect(plateTrim(R, -1)).toEqual({ dark: R[2], light: R[3] });
    expect(plateTrim(R, -2)).toEqual({ dark: R[1], light: R[2] });
  });

  it('timings stay inside A6_MS: turn start 450 (lock), phase waits ≤ 120, battle ≤ 300 + a tail ≤ 250', async () => {
    const { A6_MS } = await import('../../src/view/v3/motion');
    const { PLATE, plateTiming } = await import('../../src/view/v3/TurnPlate');
    const { TURN_V3_MS } = await import('../../src/cinematics/v3small/turn');
    const frame = 1000 / 60;
    // a scene wait resolves on the first whole frame at or past it
    const held = (ms: number) => Math.ceil(ms / frame - 1e-6) * frame;
    expect(TURN_V3_MS.turnStart).toBeLessThanOrEqual(A6_MS.turnStart.lock!);
    expect(plateTiming('turn').settledMs).toBe(TURN_V3_MS.turnStart);
    expect(held(TURN_V3_MS.phaseDraw)).toBeLessThanOrEqual(A6_MS.phaseChange.lock!);
    expect(held(TURN_V3_MS.phaseOther)).toBeLessThanOrEqual(A6_MS.phaseChange.lock!);
    expect(held(TURN_V3_MS.battle)).toBeLessThanOrEqual(A6_MS.phaseBattle.lock!);
    expect(plateTiming('battle').settledMs).toBeLessThanOrEqual(A6_MS.phaseBattle.lock!);
    // the battle plate's tail: hold, then three hops — over within the tail budget after the input returns
    expect(TURN_V3_MS.battleHold + 3 * PLATE.hopMs).toBeLessThanOrEqual(A6_MS.phaseBattle.tail!);
    // the turn cycle (end → turn start → draw phase → draw (today's 367) → main) fits 1250 ms
    const cycle = held(TURN_V3_MS.phaseOther) + held(TURN_V3_MS.turnStart) + held(TURN_V3_MS.phaseDraw) + 367 + held(TURN_V3_MS.phaseOther) + frame;
    expect(cycle).toBeLessThanOrEqual(A6_MS.turnCycle.max);
  }, 60000);

  it('odometer digits sit in fixed whole-pixel cells (a rolling number never jiggles)', async () => {
    const { digitCell, digitLayout, digitWidth } = await import('../../src/view/v3/odometer');
    const cell = digitCell('md');
    expect(cell.advance).toBe(cell.w - 1);
    for (let d = 0; d <= 9; d++) {
      const [g] = digitLayout(String(d), 'md');
      expect(Number.isInteger(g.x)).toBe(true);
      expect(g.x).toBeGreaterThanOrEqual(0);
      expect(g.x + g.w).toBeLessThanOrEqual(cell.w);
    }
    expect(digitWidth('10', 'md')).toBe(2 * cell.advance + 1);
    const a = digitLayout('19', 'md');
    const b = digitLayout('20', 'md');
    // the cells are the same whatever the digits: only the glyph inside a cell may centre differently
    expect(Math.floor(a[1].x / cell.advance)).toBe(Math.floor(b[1].x / cell.advance));
  });

  it('the readiness ring is a closed 1-px palette ellipse (2:1), r 12 / 20 / 28; its halves split at the centre row', async () => {
    const { isoRingCanvas, calmWaveMs } = await import('../../src/cinematics/v3small/turn');
    for (const r of [12, 20, 28]) {
      const back = isoRingCanvas(r, PAL.crim3, 'back');
      const front = isoRingCanvas(r, PAL.crim3, 'front');
      const all = isoRingCanvas(r, PAL.crim3);
      for (let y = 0; y < all.h; y++)
        for (let x = 0; x < all.w; x++) expect((back.alpha(x, y) > 0) !== (front.alpha(x, y) > 0) || all.alpha(x, y) === 0).toBe(true);
      const c = isoRingCanvas(r, PAL.crim3);
      expect(c.w).toBe(2 * r + 1);
      expect(c.h).toBe(2 * Math.round(r / 2) + 1);
      expect(offPalette(c)).toEqual([]);
      // symmetric left / right and top / bottom; every ring pixel has a ring neighbour (closed)
      for (let y = 0; y < c.h; y++)
        for (let x = 0; x < c.w; x++) {
          const on = c.alpha(x, y) > 0;
          expect(on).toBe(c.alpha(c.w - 1 - x, y) > 0);
          expect(on).toBe(c.alpha(x, c.h - 1 - y) > 0);
          if (!on) continue;
          let n = 0;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && c.alpha(x + dx, y + dy) > 0) n++;
          expect(n).toBeGreaterThanOrEqual(2);
        }
    }
    // the side wave reaches farther monsters later
    const { zoneXY } = await import('../../src/view/layout');
    for (const p of [0, 1] as const) {
      const near = calmWaveMs(p, zoneXY(p, 'monster', 1));
      const far = calmWaveMs(p, zoneXY(p, 'spellTrap', 1));
      expect(near).toBeGreaterThan(0);
      expect(near).toBeLessThan(400);
      expect(Math.abs(far - near)).toBeGreaterThan(0);
    }
  }, 60000);

  it('the turn plate lands at the draw phase only when the duel ends before the main phase (deck-out)', async () => {
    const { endsBeforeMain } = await import('../../src/cinematics/v3small/turn');
    const ev = (...types: string[]) => types.map((type) => ({ type }));
    // beginTurn with a card to draw: turnStart, draw phase, draw, main phase
    const normal = ev('turnStart', 'phaseChange', 'draw', 'phaseChange');
    expect(endsBeforeMain(normal, 1)).toBe(false);
    // the first turn (no draw)
    expect(endsBeforeMain(ev('turnStart', 'phaseChange', 'phaseChange'), 1)).toBe(false);
    // an empty deck: the draw phase is followed by deckOut and gameOver, no main phase
    const out = ev('turnStart', 'phaseChange', 'deckOut', 'gameOver');
    expect(endsBeforeMain(out, 1)).toBe(true);
    // a batch that stops at the draw phase (nothing after it) keeps the plate up
    expect(endsBeforeMain(ev('turnStart', 'phaseChange'), 1)).toBe(false);
  });

  it('ui3Sfx: today\u2019s sound stands in while a ui3 recipe is the silent skeleton, the ui3 sound once written', async () => {
    const { sfx } = await import('../../src/audio/sfx');
    const { UI_FLOW_RECIPES } = await import('../../src/audio/v3/ui-flow');
    const { ui3Sfx } = await import('../../src/view/v3/hudV3');
    const played: string[] = [];
    const spy = vi.spyOn(sfx, 'play').mockImplementation((n) => void played.push(n));
    const R = UI_FLOW_RECIPES as unknown as Record<string, { play: (...a: unknown[]) => void }>;
    const keep = R.ui3Phase;
    try {
      R.ui3Phase = { play() {} };
      ui3Sfx('ui3Phase', {}, 'phaseChange');
      R.ui3Phase = { play(_v: unknown) {} };
      ui3Sfx('ui3Phase', {}, 'phaseChange');
    } finally {
      R.ui3Phase = keep;
      spy.mockRestore();
    }
    expect(played).toEqual(['phaseChange', 'ui3Phase']);
  }, 60000);
});

describe('B1 registration audit (§6.4): lane B fills only its own hooks, only under V3_A6_B', () => {
  const LANE_B_HOOKS = ['duelPlate', 'hudIn', 'turnStart', 'phaseChange', 'deckOut', 'gameOver', 'decision', 'target', 'presentHeal'];
  async function filled(look: 'v1' | 'v3', a6?: string): Promise<string[]> {
    vi.resetModules();
    G.__NEON_LOOK = look;
    if (a6 !== undefined) G.__NEON_V3FLAGS = { a6 };
    else delete G.__NEON_V3FLAGS;
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { loadCinematics } = await import('../../src/cinematics');
    const loaded = await loadCinematics();
    errors.mockRestore();
    expect(loaded.some((p) => p.includes('v3small/turn'))).toBe(true);
    const { filledV3Hooks } = await import('../../src/cinematics/v3small/_hooks');
    return filledV3Hooks();
  }

  it('v1: none; v3 lane B on: turnStart + phaseChange (and nothing outside lane B); lane B off: none of B’s', async () => {
    expect(await filled('v1')).toEqual([]);
    const b = await filled('v3', 'b');
    expect(b).toEqual(expect.arrayContaining(['turnStart', 'phaseChange']));
    expect(b.filter((h) => !LANE_B_HOOKS.includes(h))).toEqual([]);
    for (const a6 of ['off', 'a']) expect((await filled('v3', a6)).filter((h) => LANE_B_HOOKS.includes(h)), `a6=${a6}`).toEqual([]);
  }, 120000);
});

describe('A6-B source scan (§6.4)', () => {
  const SOURCES = import.meta.glob<string>(
    [
      '../../src/view/v3/hudSkin.ts',
      '../../src/view/v3/hudV3.ts',
      '../../src/dev/previews/hud3.ts',
      '../../src/view/v3/TurnPlate.ts',
      '../../src/view/v3/odometer.ts',
      '../../src/cinematics/v3small/turn.ts',
    ],
    {
      eager: true,
      query: '?raw',
      import: 'default',
    },
  );

  it('no new camera call in the lane\u2019s new files (KO-10, §6.3)', () => {
    for (const [f, src] of Object.entries(SOURCES)) {
      if (!/TurnPlate|odometer|v3small/.test(f)) continue;
      const code = src
        .split('\n')
        .filter((l) => !/^\s*\/\//.test(l))
        .join('\n');
      expect(/\bfocus\(|closeUp|setZoom|\.pan\(|descend\(/.test(code), f).toBe(false);
    }
  });

  it('no colour constant outside the palette, no ADD blend, no alpha fade in A6-B files', () => {
    expect(Object.keys(SOURCES).length).toBe(6);
    for (const [f, src] of Object.entries(SOURCES)) {
      const hexes = [...src.matchAll(/0x[0-9a-fA-F]{6}\b/g)].map((m) => Number(m[0]));
      expect(
        hexes.filter((c) => !PAL_SET.has(c)),
        f,
      ).toEqual([]);
      expect(/BlendModes\.ADD|setBlendMode\(/.test(src), `${f}: blend`).toBe(false);
      expect(/\.setAlpha\(/.test(src), `${f}: alpha`).toBe(false);
    }
  });
});
