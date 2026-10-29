// Lane A6-B (docs/v3/A6_PLAN.md §6.4) — B0: the HUD v3 skin (F10, contract S-1). Painters stay on the
// palette and on frameRectV3's geometry; the baked text lays out exactly like pixelText(); the style →
// trim table matches F10; the v3 HUD is handed out only under V3_A6_B and offers HudView's whole API;
// A6-B's files hold no off-palette colour constant and no ADD blend (source scan). Later B steps add
// the odometer, target-corner, A6_MS and decision tests here; B5 the deck-out (F8) and the result plate /
// victory / defeat (F9): the plate's Turkish lines and geometry, its painters, the fireworks' place, the
// loser's stepped shade (one side only), the motes, the dying tube and the timings against A6_MS.

import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('phaser', async () => (await import('../presentation/_phaser-stub')).phaserStub());

import { FRAME_V3, frameRectV3 } from '../../src/art/frame-v3';
import { PAL, PLAYER_RAMP } from '../../src/art/palette';
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
    'endHintFlash',
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

describe('B-open: the "DÜELLO!" plate and the HUD arrival (F0)', () => {
  it('the display face: 13-px caps, letters 2 px apart, the word and the marks fit inside the trim', async () => {
    const T = await import('../../src/view/v3/TurnPlate');
    const { letters, w } = T.duelWordLayout();
    expect(letters.map((l) => l.ch).join('')).toBe('DÜELLO!');
    for (let i = 1; i < letters.length; i++) expect(letters[i].x - (letters[i - 1].x + letters[i - 1].w)).toBe(2);
    expect(w).toBe(letters[letters.length - 1].x + letters[letters.length - 1].w);
    for (const L of letters) for (const [c, r] of T.duelLetterPixels(L.ch)) {
      expect(c >= 0 && c < L.w, `${L.ch} col ${c}`).toBe(true);
      expect(r >= (L.dots ? -3 : 0) && r < T.DUEL_CAP, `${L.ch} row ${r}`).toBe(true);
    }
    const lay = T.duelPlateLayout();
    const { w: W, h: H } = T.DUEL_PLATE;
    for (const v of [lay.wordX, lay.capY, lay.markY, ...lay.marks]) expect(Number.isInteger(v)).toBe(true);
    // inside the trim (rows / columns 2 … size − 3): the Ü's dots + outline above, the sparks below
    expect(lay.capY - 3 - 1).toBeGreaterThanOrEqual(2);
    expect(lay.capY + T.DUEL_CAP + 2).toBeLessThanOrEqual(H - 3);
    expect(lay.marks[0]).toBeGreaterThanOrEqual(3);
    expect(lay.marks[1] + 9).toBeLessThanOrEqual(W - 3);
    expect(lay.wordX - 1).toBeGreaterThan(lay.marks[0] + 9);
    expect(lay.marks[1]).toBeGreaterThan(lay.wordX + lay.wordW);
    // centred (± 1 px) and symmetric marks
    expect(Math.abs(lay.wordX - (W - lay.wordX - lay.wordW))).toBeLessThanOrEqual(1);
    expect(Math.abs(lay.marks[0] - (W - lay.marks[1] - 9))).toBeLessThanOrEqual(1);
  });

  it('letters, marks and bodies are opaque palette pixels with an ink outline; the stamp steps white → gold4 → bands → one down', async () => {
    const T = await import('../../src/view/v3/TurnPlate');
    for (const ch of 'DÜELO!')
      for (const st of ['white', 'hot', 'rest', 'dim'] as const) {
        const c = T.duelLetterCanvas(ch, st);
        expect(offPalette(c), `${ch}:${st}`).toEqual([]);
        // the canvas border is outline or empty: never fill
        for (let x = 0; x < c.w; x++) for (const y of [0, c.h - 1]) expect([null, PAL.ink]).toContain(c.get(x, y));
        for (let y = 0; y < c.h; y++) for (const x of [0, c.w - 1]) expect([null, PAL.ink]).toContain(c.get(x, y));
      }
    // D's left stem, cap rows 0 / 6 / 12 at canvas (1, 1 + r)
    const at = (st: 'white' | 'hot' | 'rest' | 'dim', r: number) => T.duelLetterCanvas('D', st).get(1, 1 + r);
    expect([at('rest', 0), at('rest', 6), at('rest', 12)]).toEqual([PAL.gold4, PAL.gold3, PAL.gold2]);
    expect([at('dim', 0), at('dim', 6), at('dim', 12)]).toEqual([PAL.gold3, PAL.gold2, PAL.gold1]);
    expect([at('white', 6), at('hot', 6)]).toEqual([PAL.white, PAL.gold4]);
    // the Ü keeps its dots 3 rows above its caps, an ink row between them (never touching the U)
    const u = T.duelLetterCanvas('Ü', 'rest');
    expect(u.get(1 + 2, 1)).toBe(PAL.gold4);
    expect(u.get(1 + 2, 3)).toBe(PAL.ink);
    expect(u.get(1 + 5, 6)).toBe(null); // the U's open inside
    for (const p of [0, 1] as const) for (const st of ['white', 'rest', 'blink', 'dim'] as const) expect(offPalette(T.duelMarkCanvas(p, st)), `mark ${p} ${st}`).toEqual([]);
    expect(T.duelMarkCanvas(0, 'rest').get(4, 4)).toBe(PAL.white);
    expect(T.duelMarkCanvas(1, 'rest').get(4, 3)).toBe(PAL.crim3);
    for (const step of [-2, -1, 0]) {
      const b = T.duelPlateBody(step);
      expect(offPalette(b), `body ${step}`).toEqual([]);
      expect(b.get(2, 0)).toBe(PAL.ink); // the outline, its 2-px corner cut
      expect(b.get(0, 0)).toBe(null);
    }
  });

  it('the plate sits centred under the phase bar, above the board, clear of every deal path (P1 or P2 first)', async () => {
    const T = await import('../../src/view/v3/TurnPlate');
    const L = await import('../../src/view/layout');
    const r = T.duelPlateRect();
    for (const v of [r.x, r.y, r.w, r.h]) expect(Number.isInteger(v)).toBe(true);
    expect(Math.abs(r.x + r.w / 2 - L.BOARD_CENTER.x)).toBeLessThanOrEqual(1);
    const bar = L.UI.phaseBar;
    expect(r.y + Math.min(...T.DUEL_PLATE.drop)).toBeGreaterThanOrEqual(bar.y + bar.h); // the drop never enters the bar
    expect(r.h).toBeGreaterThanOrEqual(12);
    // CardSprite.flyTo: quadratic arc (control = midpoint − arc), scale × (1 + 0.1 sin πt), lean ≤ 0.32 rad
    const deck = L.zoneXY(1, 'deck');
    const from = { x: deck.x, y: deck.y - 6 - 4 }; // the pile top (≤ 6 layers) − 4 (flow/opening.ts deal)
    const flight = (to: { x: number; y: number }, arc: number, s0: number, s1: number) => {
      let gap = Infinity;
      const cx = (from.x + to.x) / 2;
      const cy = (from.y + to.y) / 2 - arc;
      const lean = Math.min(0.32, (Math.abs(to.x - from.x) / 400) * 0.3 + 0.06);
      for (let i = 0; i <= 200; i++) {
        const t = i / 200;
        const u = 1 - t;
        const x = u * u * from.x + 2 * u * t * cx + t * t * to.x;
        const y = u * u * from.y + 2 * u * t * cy + t * t * to.y;
        const b = Math.sin(Math.PI * t);
        const s = (s0 + (s1 - s0) * t) * (1 + 0.1 * b);
        const rot = lean * b;
        const hw = 24 * s * Math.cos(rot) + 34 * s * Math.sin(rot);
        const hh = 24 * s * Math.sin(rot) + 34 * s * Math.cos(rot);
        const gx = Math.max(r.x - (x + hw), x - hw - (r.x + r.w));
        const gy = Math.max(r.y - (y + hh), y - hh - (r.y + r.h));
        gap = Math.min(gap, Math.max(gx, gy));
      }
      return gap;
    };
    // P1 starts: P2's opening cards arc into its mini row (HandView.miniPos: panel centre ± 7 px a card, 5 px under it)
    const p2 = L.panelRect(1);
    for (let i = 0; i < 4; i++) {
      const to = { x: Math.round(p2.x + p2.w / 2 + (i - 1.5) * 7), y: p2.y + p2.h + 5 };
      expect(flight(to, 30, 0.5, 9 / 48), `mini ${i}`).toBeGreaterThanOrEqual(1);
    }
    // P2 starts (hot-seat): its full cards fly down the middle column into the hand (always below the deck)
    for (const x of [230, 320, 410]) expect(flight({ x, y: L.UI.handRestTop + 34 }, 54, 0.5, 1), `hand ${x}`).toBeGreaterThanOrEqual(1);
  });

  it('timings: the HUD arrives in 160–240 ms (A6_MS.hudIn, never locking), the plate enters well before the deal, the ripple reaches every pad by 360 ms', async () => {
    const { HUD_ARRIVAL } = await import('../../src/view/v3/hudV3');
    const { A6_MS } = await import('../../src/view/v3/motion');
    const total = 3 * HUD_ARRIVAL.stagger + HUD_ARRIVAL.slideMs;
    expect(total).toBeGreaterThanOrEqual(A6_MS.hudIn.min ?? 0);
    expect(total).toBeLessThanOrEqual(A6_MS.hudIn.max);
    for (const o of [HUD_ARRIVAL.p1, HUD_ARRIVAL.p2, HUD_ARRIVAL.top, HUD_ARRIVAL.buttons]) {
      // 2–3 whole pixels a frame on average (F0: "2–3 tam piksel adımla")
      const perFrame = Math.hypot(o.dx, o.dy) / (HUD_ARRIVAL.slideMs / (1000 / 60));
      expect(perFrame).toBeGreaterThanOrEqual(1.5);
      expect(perFrame).toBeLessThanOrEqual(3);
    }
    expect(HUD_ARRIVAL.overshoot).toBeLessThanOrEqual(2); // KO-2
    const T = await import('../../src/view/v3/TurnPlate');
    const P = T.DUEL_PLATE;
    const glintFrames = Math.ceil((T.duelWordLayout().w + 2 * T.DUEL_CAP) / P.glintStep) + 1;
    expect(((P.glintFrame + glintFrames) * 1000) / 60).toBeLessThan(600); // entered long before the plate leaves (deal +420 …)
    expect(((P.stampFrame + 6) * 1000) / 60).toBeLessThanOrEqual(200); // the last letter stamps by 200 ms
    const { rippleZones, OPENING_V3 } = await import('../../src/cinematics/v3small/opening-flow');
    const z = rippleZones();
    expect(z.length).toBe(18);
    expect(Math.max(...z.map((q) => q.at))).toBeLessThanOrEqual(360);
    expect(z[0].at).toBeLessThanOrEqual(OPENING_V3.sidesAt);
  });
});

describe('B2: the LP counter, the bar and the gain (F3)', () => {
  /** The count simulated frame by frame (60 fps, the tween's clock): the shown number, the unit wheel's clicks. */
  async function simulate(from: number, to: number) {
    const { countUnit, lpRollMs, lpEase, wheelPositions, digitCount, LP_WHEELS } = await import('../../src/view/v3/odometer');
    const n = Math.max(LP_WHEELS.min, digitCount(from), digitCount(to));
    const k = countUnit(from, to);
    const clicks = Math.round(Math.abs(to - from) / 10 ** k);
    const ms = lpRollMs(clicks, 400);
    const shown: number[] = [];
    const clickAt: number[] = [];
    const frame = 1000 / 60;
    const start = Math.round(wheelPositions(from, n, k)[k]);
    let last = start;
    let advanced = 0;
    for (let t = 0; t <= ms + frame; t += frame) {
      const e = lpEase(Math.min(1, t / ms));
      const pos = wheelPositions(from + (to - from) * e, n, k);
      // the number the windows show (each wheel's nearest digit)
      shown.push(pos.reduce((acc, p, j) => acc + (((Math.round(p) % 10) + 10) % 10) * 10 ** j, 0));
      const d = Math.round(pos[k]);
      if (d !== last) {
        clickAt.push(t);
        advanced += Math.abs(d - last);
        last = d;
      }
    }
    return { n, k, clicks, ms, shown, clickAt, advanced, start, end: last };
  }

  it('a mechanical count: the finest wheel clicks once per unit, the upper wheels turn only on the carry', async () => {
    const { wheelPositions, countUnit } = await import('../../src/view/v3/odometer');
    expect(countUnit(4000, 3500)).toBe(2);
    expect(countUnit(4000, 1000)).toBe(2);
    expect(countUnit(1800, 2800)).toBe(2);
    expect(countUnit(3999, 4000)).toBe(0);
    expect(Math.abs(99999 - 0) / 10 ** countUnit(99999, 0)).toBeLessThanOrEqual(60);
    // at rest every wheel shows its digit exactly
    expect(wheelPositions(3500, 4, 2)).toEqual([0, 0, 35, 3]);
    // between 4000 and 3900 the thousands wheel turns exactly while the hundreds wheel passes 0 → 9
    for (let v = 4000; v >= 3500; v -= 5) {
      const [, , h, th] = wheelPositions(v, 4, 2);
      const hm = ((h % 10) + 10) % 10;
      const turning = th !== Math.round(th);
      expect(turning, `v ${v}`).toBe(hm > 9 && hm < 10);
    }
  });

  it('the count stays inside F3: ≤ 360 ms (≤ the 400-ms LP budgets), one click per unit, the shown number never turns back', async () => {
    const { A6_MS } = await import('../../src/view/v3/motion');
    for (const [from, to] of [
      [4000, 3500],
      [4000, 1000],
      [1800, 2800],
      [4000, 4500],
      [900, 0],
      [100, 0],
    ]) {
      const r = await simulate(from, to);
      expect(r.ms, `${from} → ${to}`).toBeLessThanOrEqual(360);
      expect(r.ms).toBeLessThanOrEqual(Math.min(A6_MS.lpDamage.max, A6_MS.lpGain.max));
      // the fastest wheel turns exactly one digit per unit (several may pass within one early frame)
      expect(r.advanced, `${from} → ${to} clicks`).toBe(r.clicks);
      expect(Math.abs(r.end - r.start)).toBe(r.clicks);
      expect(r.clickAt.length).toBeLessThanOrEqual(r.clicks);
      expect(r.shown[0]).toBe(from);
      expect(r.shown[r.shown.length - 1]).toBe(to);
      for (let i = 1; i < r.shown.length; i++) {
        if (to < from) expect(r.shown[i], `${from} → ${to} frame ${i}`).toBeLessThanOrEqual(r.shown[i - 1]);
        else expect(r.shown[i], `${from} → ${to} frame ${i}`).toBeGreaterThanOrEqual(r.shown[i - 1]);
      }
    }
  });

  it('ticks: one per click at most every 34 ms (the gate), however fast the wheel turns', async () => {
    const { tickGate, LP_V3 } = await import('../../src/view/v3/hudV3');
    expect(LP_V3.tickGapMs).toBeGreaterThanOrEqual(34);
    const r = await simulate(4000, 1000);
    const gate = tickGate(LP_V3.tickGapMs);
    const ticks = r.clickAt.filter((t) => gate(t));
    expect(ticks.length).toBeGreaterThan(3);
    for (let i = 1; i < ticks.length; i++) expect(ticks[i] - ticks[i - 1]).toBeGreaterThanOrEqual(34);
  });

  it('the windows: palette pixels, a 1-px frame with cut corners round an ink inside, 17 px apart', async () => {
    const { lpWindowsCanvas, LP_WHEELS } = await import('../../src/view/v3/odometer');
    const p = lpWindowsCanvas(4);
    expect(p.w).toBe(4 * LP_WHEELS.pitch - 1);
    expect(p.h).toBe(LP_WHEELS.bottom - LP_WHEELS.top + 2);
    for (let y = 0; y < p.h; y++)
      for (let x = 0; x < p.w; x++) {
        const c = p.get(x, y);
        if (c !== null) expect(PAL_SET.has(c), `${x},${y}`).toBe(true);
      }
    for (let i = 0; i < 4; i++) {
      const x0 = i * LP_WHEELS.pitch;
      expect(p.get(x0, 0), 'cut corner').toBeNull();
      expect(p.get(x0 + 1, 0)).toBe(LP_WHEELS.frame);
      expect(p.get(x0, 1)).toBe(LP_WHEELS.frame);
      expect(p.get(x0 + 1, 1)).toBe(LP_WHEELS.inside);
      expect(p.get(x0 + 15, p.h - 1), 'cut corner').toBeNull();
      if (i < 3) expect(p.get(x0 + 16, 5), 'gap between windows').toBeNull();
    }
  });

  it('tones: a turning edge one palette step down; low LP is 1–999 (F3); the timings fit the plan', async () => {
    const { toneDown } = await import('../../src/view/v3/odometer');
    const { isLowLp, LP_V3, PANEL_DEPTH } = await import('../../src/view/v3/hudV3');
    const { DEPTH } = await import('../../src/view/layout');
    expect(toneDown(PAL.white)).toBe(PAL.mist);
    expect(toneDown(PAL.crim3)).toBe(PAL.crim2);
    expect(toneDown(PAL.leaf3)).toBe(PAL.leaf2);
    expect(toneDown(PAL.night3)).toBe(PAL.night2);
    expect([isLowLp(999), isLowLp(1), isLowLp(1000), isLowLp(0)]).toEqual([true, true, false, false]);
    expect(LP_V3.erodeAt + LP_V3.erodeMs).toBeLessThanOrEqual(360);
    expect(LP_V3.trimMs + 34).toBeLessThanOrEqual(400);
    expect(LP_V3.shakeMs).toBeLessThanOrEqual(120);
    expect(LP_V3.lowBeatMs * 2).toBe(1200);
    expect(LP_V3.lowPulseMs).toBeGreaterThanOrEqual(50); // ≥ 3 frames (§1.5)
    expect(LP_V3.barStep).toBe(4);
    // the panels sit above today's panelGlow fill (HUD + 4.5) and under the effects flying into them (HUD + 6)
    expect(PANEL_DEPTH).toBeGreaterThan(DEPTH.HUD + 5);
    expect(PANEL_DEPTH).toBeLessThan(DEPTH.HUD + 6);
  });

  it('the bar: LP past 4000 is a second lap from the left, so a gain from 4000 still shows a slice', async () => {
    const { lpBarPx } = await import('../../src/view/v3/hudV3');
    const { HUD3 } = await import('../../src/view/v3/hudSkin');
    const w = HUD3.bar.w;
    expect(lpBarPx(0, w)).toEqual({ main: 0, over: 0 });
    expect(lpBarPx(-50, w)).toEqual({ main: 0, over: 0 });
    expect(lpBarPx(2000, w)).toEqual({ main: Math.round(w / 2), over: 0 });
    expect(lpBarPx(4000, w)).toEqual({ main: w, over: 0 });
    // lumenGain (4000 → 4500): a slice at least one 4-px step wide on the second lap
    expect(lpBarPx(4500, w).main).toBe(w);
    expect(lpBarPx(4500, w).over).toBeGreaterThanOrEqual(4 * 4);
    expect(lpBarPx(99999, w)).toEqual({ main: w, over: w });
    // monotonic across both laps
    let last = -1;
    for (let v = 0; v <= 8000; v += 50) {
      const b = lpBarPx(v, w);
      expect(b.main + b.over).toBeGreaterThanOrEqual(last);
      expect(b.over === 0 || b.main === w).toBe(true);
      last = b.main + b.over;
    }
  });

  it('the gain (presentHeal, S-14): the handler ends within A6_MS.lpGain; the number never touches its panel', async () => {
    const { A6_MS } = await import('../../src/view/v3/motion');
    const { HEAL_V3 } = await import('../../src/cinematics/v3small/heal');
    const { LP_WHEELS } = await import('../../src/view/v3/odometer');
    const { textMetrics } = await import('../../src/ui/text');
    const { panelRect } = await import('../../src/view/layout');
    expect(HEAL_V3.handlerMs).toBeLessThanOrEqual(A6_MS.lpGain.max - 17);
    expect(HEAL_V3.handlerMs).toBeGreaterThanOrEqual(LP_WHEELS.rollMs);
    // the number's ink (centred on its cap band, 1-px outline × scale): lg on its first frame, md after,
    // then the jump + float
    const ink = (size: 'md' | 'lg', y0: number) => {
      const m = textMetrics(size);
      const top = y0 - Math.floor(m.capHeight / 2) - m.scale;
      return { top, bottom: top + m.capHeight + 2 * m.scale - 1 };
    };
    const p1 = panelRect(0);
    const p2 = panelRect(1);
    const y1 = p1.y - HEAL_V3.gapP1;
    expect(ink('lg', y1).bottom).toBeLessThanOrEqual(p1.y - 2); // P1: above its panel, 1 px clear
    const y2 = p2.y + p2.h + HEAL_V3.gapP2;
    expect(ink('lg', y2).top).toBeGreaterThanOrEqual(p2.y + p2.h + 1); // P2: below its panel, 1 px clear …
    expect(ink('md', y2).top - HEAL_V3.jump - HEAL_V3.riseP2).toBeGreaterThanOrEqual(p2.y + p2.h + 1); // … after its float too
    // a palette fade (two steps), gone within its life; the jump settles inside the count
    expect(HEAL_V3.fade1).toBeLessThan(HEAL_V3.fade2);
    expect(HEAL_V3.fade2).toBeLessThan(HEAL_V3.lifeMs);
    expect(HEAL_V3.jumpMs).toBeLessThanOrEqual(HEAL_V3.handlerMs);
  });
});

describe('B3: target corners (F4), the reject (F5), the engine lock', () => {
  const BOX = { x0: 300, y0: 120, x1: 339, y1: 159 };
  /** World pixels of one corner image drawn at cornerXY: [x, y, colour]. */
  async function cornerPixels(c: 'tl' | 'tr' | 'bl' | 'br', box: typeof BOX, gap: number, tone: number) {
    const { cornerCanvas, cornerXY } = await import('../../src/view/v3/TargetMarks');
    const p = cornerCanvas(c, tone);
    const at = cornerXY(c, box, gap);
    const out: [number, number, number][] = [];
    for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (p.alpha(x, y)) out.push([at.x + x, at.y + y, p.get(x, y)!]);
    return { p, at, out };
  }

  it('the corner images are palette pixels: an L of AIM.leg (≥ 4 px) per arm, its 1-px ink outline (every tone the marks use)', async () => {
    const { AIM, CORNERS, cornerCanvas } = await import('../../src/view/v3/TargetMarks');
    expect(AIM.leg).toBeGreaterThanOrEqual(4);
    for (const tone of [PAL.gold1, PAL.gold2, PAL.gold3, PAL.gold4, PAL.white, PAL.crim3])
      for (const c of CORNERS) {
        const p = cornerCanvas(c, tone);
        expect(offPalette(p), `${c} ${tone.toString(16)}`).toEqual([]);
        let lit = 0;
        let ink = 0;
        for (let y = 0; y < p.h; y++)
          for (let x = 0; x < p.w; x++) {
            if (!p.alpha(x, y)) continue;
            if (p.get(x, y) === tone) lit++;
            else if (p.get(x, y) === PAL.ink) ink++;
          }
        expect(lit, `${c}: corner + 2 legs`).toBe(2 * AIM.leg - 1);
        expect(ink).toBeGreaterThan(lit);
      }
  });

  it('cornerXY puts each corner pixel `gap` px outside the box, whole pixels, arms pointing along the box edges', async () => {
    const { AIM } = await import('../../src/view/v3/TargetMarks');
    for (const gap of [AIM.gap + 4, AIM.gap, AIM.gap - 2, 0, -3])
      for (const c of ['tl', 'tr', 'bl', 'br'] as const) {
        const { at, out } = await cornerPixels(c, BOX, gap, PAL.gold3);
        expect(Number.isInteger(at.x) && Number.isInteger(at.y)).toBe(true);
        const lit = out.filter((q) => q[2] === PAL.gold3);
        const left = c === 'tl' || c === 'bl';
        const top = c === 'tl' || c === 'tr';
        const cx = left ? BOX.x0 - gap : BOX.x1 + gap;
        const cy = top ? BOX.y0 - gap : BOX.y1 + gap;
        expect(lit.some(([x, y]) => x === cx && y === cy), `${c} gap ${gap}: corner pixel`).toBe(true);
        // the arms run from the corner pixel towards the box, AIM.leg long
        const row = lit.filter(([, y]) => y === cy).map(([x]) => x);
        const col = lit.filter(([x]) => x === cx).map(([, y]) => y);
        expect(Math.max(...row) - Math.min(...row) + 1).toBe(AIM.leg);
        expect(Math.max(...col) - Math.min(...col) + 1).toBe(AIM.leg);
        expect(left ? Math.min(...row) : Math.max(...row)).toBe(cx);
        expect(top ? Math.min(...col) : Math.max(...col)).toBe(cy);
      }
  });

  it('closing in, the corners never cross (minGap keeps ≥ 2 px between facing legs)', async () => {
    const { AIM, minGap } = await import('../../src/view/v3/TargetMarks');
    for (let w = 6; w <= 90; w += 3)
      for (let h = 6; h <= 70; h += 4) {
        const b = { x0: 100, y0: 100, x1: 100 + w - 1, y1: 100 + h - 1 };
        const g = minGap(b);
        expect(g).toBeLessThanOrEqual(0);
        // tl's horizontal arm ends at x0 − g + leg − 1; tr's starts at x1 + g − (leg − 1)
        const tlEnd = b.x0 - g + AIM.leg - 1;
        const trStart = b.x1 + g - (AIM.leg - 1);
        const tlFoot = b.y0 - g + AIM.leg - 1;
        const blTop = b.y1 + g - (AIM.leg - 1);
        if (g < 0) {
          expect(trStart - tlEnd, `${w}×${h}`).toBeGreaterThanOrEqual(2);
          expect(blTop - tlFoot, `${w}×${h}`).toBeGreaterThanOrEqual(2);
        }
      }
  });

  it('arrival 4 → 2 → 1 → 0 px in 30-ms steps, settled within A6_MS.targetsVisible; breathing 1 px, staggered; reduced: none', async () => {
    const { AIM, arriveExtra, breathIn } = await import('../../src/view/v3/TargetMarks');
    const { A6_MS } = await import('../../src/view/v3/motion');
    expect([0, 29, 30, 59, 60, 89, 90, 400].map((t) => arriveExtra(t, false))).toEqual([4, 4, 2, 2, 1, 1, 0, 0]);
    expect(AIM.stepMs * AIM.arrive.length).toBeLessThanOrEqual(A6_MS.targetsVisible.max);
    expect([0, 90].map((t) => arriveExtra(t, true))).toEqual([0, 0]);
    expect([0, 419, 420, 839, 840].map((t) => breathIn(t, 0, false))).toEqual([0, 0, -1, -1, 0]);
    // A6B-6: neighbours breathe in anti-phase (half the 420-ms period apart)
    expect(AIM.breathStagger * 2).toBe(AIM.breathMs);
    expect([0, 209, 210, 629, 630].map((t) => breathIn(t, 1, false))).toEqual([0, 0, 0, 0, -1]);
    for (const t of [0, 500, 1000]) expect(breathIn(t, 0, true)).toBe(0);
  });

  it('the reject stamp: ±2 px three times in 30-ms steps, two palette steps down, gone by A6_MS.invalidClick; reduced: colour only', async () => {
    const { REJECT, rejectStep } = await import('../../src/view/v3/TargetMarks');
    const { A6_MS } = await import('../../src/view/v3/motion');
    const { rejectStamp } = await import('../../src/view/v3/ui-kit');
    const seq = [0, 30, 60, 90, 120, 150].map((t) => rejectStep(t, false));
    expect(seq.map((s) => s?.dx)).toEqual([0, 2, -2, 2, 0, 0]);
    expect(seq.map((s) => s?.tone)).toEqual([0, 0, 0, 0, 1, 2]);
    expect(rejectStep(REJECT.totalMs, false)).toBeNull();
    expect(REJECT.totalMs).toBeLessThanOrEqual(A6_MS.invalidClick.max);
    expect(REJECT.tileFrames).toBe(2);
    for (let t = 0; t < REJECT.totalMs; t += 10) expect(rejectStep(t, true)?.dx).toBe(0);
    for (const tone of [0, 1, 2]) expect(offPalette(rejectStamp(new PixelCanvas(9, 9), 4, 4, { tone })), `tone ${tone}`).toEqual([]);
  });

  it('the engine lock (V3HOOKS.target): 4 → 2 → 0 px by the lock frame, then a palette step down, 240 ms in all', async () => {
    const { LOCK, lockGap } = await import('../../src/view/v3/TargetMarks');
    expect([0, 39, 40, 79, 80, 239].map(lockGap)).toEqual([4, 4, 2, 2, 0, 0]);
    expect(LOCK.lockAt).toBe(80);
    expect(LOCK.fadeAt).toBeGreaterThan(LOCK.lockAt);
    expect(LOCK.ms).toBe(240);
  });

  it('opaque boxes: the union of the rest frames (what the corners frame) and their union', async () => {
    const { opaqueBox, unionBox } = await import('../../src/view/v3/TargetMarks');
    const w = 7;
    const h = 5;
    const d = new Uint8ClampedArray(w * h * 4);
    expect(opaqueBox(d, w, h)).toBeNull();
    d[(1 * w + 2) * 4 + 3] = 255;
    d[(3 * w + 5) * 4 + 3] = 255;
    expect(opaqueBox(d, w, h)).toEqual({ x0: 2, y0: 1, x1: 5, y1: 3 });
    expect(unionBox({ x0: 2, y0: 1, x1: 5, y1: 3 }, { x0: 0, y0: 2, x1: 3, y1: 4 })).toEqual({ x0: 0, y0: 1, x1: 5, y1: 4 });
    expect(unionBox(null, null)).toBeNull();
  });
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

  it('v1: none; v3 lane B on: turnStart + phaseChange + duelPlate + hudIn + presentHeal + target + decision + deckOut + gameOver (and nothing outside lane B); lane B off: none of B’s', async () => {
    expect(await filled('v1')).toEqual([]);
    const b = await filled('v3', 'b');
    expect(b).toEqual(expect.arrayContaining(['turnStart', 'phaseChange', 'duelPlate', 'hudIn', 'presentHeal', 'target', 'decision', 'deckOut', 'gameOver']));
    expect(b.filter((h) => !LANE_B_HOOKS.includes(h))).toEqual([]);
    for (const a6 of ['off', 'a']) expect((await filled('v3', a6)).filter((h) => LANE_B_HOOKS.includes(h)), `a6=${a6}`).toEqual([]);
  }, 120000);
});

describe('B4 registration (§6.4): the block wrapper is lane B’s only event handler, v3 lane B only, first on `damage`', () => {
  async function damageChain(look: 'v1' | 'v3', a6?: string): Promise<string[]> {
    vi.resetModules();
    G.__NEON_LOOK = look;
    if (a6 !== undefined) G.__NEON_V3FLAGS = { a6 };
    else delete G.__NEON_V3FLAGS;
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { loadCinematics } = await import('../../src/cinematics');
    await loadCinematics();
    errors.mockRestore();
    const { listHandlers } = await import('../../src/cinematics/_core/registry');
    return listHandlers().events.damage ?? [];
  }
  it('v1 and lanes a / off: no a6:block; v3 lane B: a6:block (p10) runs first, today’s tb:damage after it', async () => {
    for (const [look, a6] of [['v1', undefined], ['v3', 'off'], ['v3', 'a']] as const) expect((await damageChain(look, a6)).some((n) => n.startsWith('a6:block')), `${look} ${a6}`).toBe(false);
    const chain = await damageChain('v3', 'b');
    expect(chain[0]).toBe('a6:block (p10)');
    expect(chain).toContain('tb:damage (p0)');
  }, 120000);
});

describe('B4: the trap window marks (S-4), the prompt plate, the curtain, the block (F6 / F7)', () => {
  it('contourPath: the 1-px outline of the card, each pixel once, clockwise from the left; outerRing one pixel further out', async () => {
    const { contourPath, outerRing } = await import('../../src/view/v3/TrapPromptV3');
    // a little iso card: a parallelogram, as TileCard.currentPixels() gives it
    const px = new PixelCanvas(20, 10);
    for (let y = 0; y < 10; y++) for (let x = 0; x < 12; x++) px.set(x + Math.floor(y / 1.25), y, PAL.night1);
    const path = contourPath(px, 100, 50);
    const key = (p: readonly number[]) => `${p[0]},${p[1]}`;
    expect(new Set(path.map(key)).size).toBe(path.length);
    const op = (x: number, y: number) => px.isOpaque(x - 100, y - 50);
    for (const [x, y] of path) {
      expect(op(x, y), `${x},${y} outside the card`).toBe(false);
      expect(op(x - 1, y) || op(x + 1, y) || op(x, y - 1) || op(x, y + 1), `${x},${y} touches the card`).toBe(true);
    }
    // clockwise (screen y down): the angle round the centre never decreases
    const cx = path.reduce((a, p) => a + p[0], 0) / path.length;
    const cy = path.reduce((a, p) => a + p[1], 0) / path.length;
    const ang = path.map(([x, y]) => Math.atan2(y - cy, x - cx));
    for (let i = 1; i < ang.length; i++) expect(ang[i]).toBeGreaterThanOrEqual(ang[i - 1] - 1e-9);
    const ring = outerRing(px, 100, 50);
    const onPath = new Set(path.map(key));
    for (const p of ring) {
      expect(onPath.has(key(p))).toBe(false);
      expect(op(p[0], p[1])).toBe(false);
    }
    expect(ring.length).toBeGreaterThan(path.length);
  });

  it('rimFrame: hidden before its stagger, traces in traceMs with the tip as the node, whole + running node, settles in three palette steps; reduced motion: whole at once, no node', async () => {
    const { TRAP_MARK, rimFrame } = await import('../../src/view/v3/TrapPromptV3');
    const L = 80;
    expect(rimFrame(0, 1, L, null, false)).toMatchObject({ drawn: 0, tone: null });
    const mid = rimFrame(TRAP_MARK.traceMs / 2, 0, L, null, false);
    expect(mid.drawn).toBe(L / 2);
    expect(mid.head).toBe(mid.drawn - 1);
    expect(mid.outer).toBeNull();
    const whole = rimFrame(TRAP_MARK.traceMs + 10, 0, L, null, false);
    expect(whole).toMatchObject({ drawn: L, tone: PAL.mag3, outer: PAL.mag1 });
    expect(whole.head).toBeGreaterThanOrEqual(0);
    // card i starts i × stagger later
    expect(rimFrame(TRAP_MARK.staggerMs - 1, 1, L, null, false).drawn).toBe(0);
    expect(rimFrame(TRAP_MARK.staggerMs + TRAP_MARK.traceMs, 1, L, null, false).drawn).toBe(L);
    // the node laps the rim
    const heads = new Set<number>();
    for (let t = 0; t < TRAP_MARK.lapMs; t += 1000 / 60) heads.add(rimFrame(TRAP_MARK.traceMs + t, 0, L, null, false).head);
    expect(heads.size).toBeGreaterThan(20);
    // settle at 500: mag2, mag1, mag0, then gone — no node, no outer line
    const tones = [0, 1, 2, 3].map((k) => rimFrame(500 + k * TRAP_MARK.settleStepMs + 1, 0, L, 500, false));
    expect(tones.map((f) => f.tone)).toEqual([PAL.mag2, PAL.mag1, PAL.mag0, null]);
    expect(tones.every((f) => f.head === -1 && f.outer === null)).toBe(true);
    // reduced motion (KO-9): whole at once, still, for every card
    expect(rimFrame(0, 2, L, null, true)).toMatchObject({ drawn: L, tone: PAL.mag3, head: -1 });
  });

  it('the prompt plate: on the defender’s side (P2 under its panel, P1 above the action buttons), on screen, clear of the board’s spell / trap row, whole pixels; it slides 12 px with a 1-px overshoot and rests', async () => {
    const { TRAP_Q, trapCardXY, trapPromptRect, trapPromptWidth, trapPromptX } = await import('../../src/view/v3/TrapPromptV3');
    const { UI, zoneXY } = await import('../../src/view/layout');
    for (const p of [0, 1] as const)
      for (const n of [1, 2, 3]) {
        const r = trapPromptRect(p, n);
        expect(Number.isInteger(r.x) && Number.isInteger(r.y)).toBe(true);
        expect(r.x).toBeGreaterThanOrEqual(0);
        expect(r.x + r.w).toBeLessThanOrEqual(640);
        expect(r.y).toBeGreaterThanOrEqual(0);
        expect(r.y + r.h).toBeLessThanOrEqual(360);
        if (p === 1) expect(r.y).toBeGreaterThanOrEqual(UI.p2Panel.y + UI.p2Panel.h);
        else expect(r.y + r.h).toBeLessThanOrEqual(UI.buttons.y);
        // never over a spell / trap zone (the cards being asked about) nor the inspect column
        for (const q of [0, 1] as const) for (let i = 0; i < 3; i++) expect(zoneXY(q, 'spellTrap', i).x + 32).toBeLessThan(r.x);
        expect(r.x).toBeGreaterThan(UI.inspect.x + UI.inspect.w);
        expect(r.w).toBe(trapPromptWidth(n));
        for (let i = 0; i < n; i++) {
          const c = trapCardXY(i, n, r.w);
          expect(Number.isInteger(c.x) && Number.isInteger(c.y)).toBe(true);
          expect(c.x - 24).toBeGreaterThanOrEqual(TRAP_Q.padX - 1);
          expect(c.x + 24).toBeLessThanOrEqual(r.w - TRAP_Q.padX + 1);
        }
      }
    const xs: number[] = [];
    for (let t = 0; t <= TRAP_Q.settledMs + 20; t += 1000 / 60) xs.push(trapPromptX(500, t, false));
    expect(xs[0]).toBe(500 + TRAP_Q.slide);
    expect(Math.min(...xs)).toBe(500 - TRAP_Q.over);
    expect(xs[xs.length - 1]).toBe(500);
    expect(xs.every(Number.isInteger)).toBe(true);
    expect(trapPromptX(500, 0, true)).toBe(500);
  });

  it('the curtain plate: centred over the hand band (the board stays visible), Turkish lines, whole pixels; it rises 6 px and rests', async () => {
    const { CURTAIN, CURTAIN_LINE2, curtainLine1, curtainRect, curtainY } = await import('../../src/view/v3/CurtainV3');
    const { UI } = await import('../../src/view/layout');
    for (const kind of ['turn', 'trap'] as const)
      for (const p of [0, 1] as const) {
        const r = curtainRect(kind, p);
        expect(Number.isInteger(r.x) && Number.isInteger(r.y)).toBe(true);
        expect(Math.abs(r.x + r.w / 2 - 320)).toBeLessThanOrEqual(1);
        expect(r.y + r.h).toBeLessThanOrEqual(UI.handRestTop);
        expect(r.h).toBeLessThan(60); // a plate, not a curtain over the screen
      }
    expect(curtainLine1('turn', 1).map((s) => s.text).join('')).toBe('SIRA: OYUNCU 2');
    expect(curtainLine1('trap', 0).map((s) => s.text).join('')).toBe('TUZAK SORUSU: OYUNCU 1');
    expect(CURTAIN_LINE2).toBe('Hazır olunca dokun');
    const ys: number[] = [];
    for (let t = 0; t <= CURTAIN.riseMs + 20; t += 1000 / 60) ys.push(curtainY(252, t, false));
    expect(ys[0]).toBe(252 + CURTAIN.rise);
    expect(ys[ys.length - 1]).toBe(252);
    expect(ys.every((y, i) => Number.isInteger(y) && (i === 0 || y <= ys[i - 1]))).toBe(true);
    expect(CURTAIN.waveMs).toBe(30);
    expect(CURTAIN.fold.length * CURTAIN.foldStepMs).toBeLessThanOrEqual(110); // "90 ms'de katlanır" (3 steps × 2 frames)
  });

  it('the block (F6): only a blocked attack’s recoil (defence, DEF > ATK, the attacker’s owner pays); the shield is palette pixels over the DEF digits', async () => {
    const { BLOCK_V3, SHIELD_H, SHIELD_W, blockOf, shieldCanvas, shieldXY } = await import('../../src/cinematics/v3small/block');
    const battle = (o: Record<string, unknown>) => ({ type: 'battle', player: 0, attackerUid: 6, attackerZone: 2, targetUid: 12, targetZone: 0, attackerAtk: 400, targetPosition: 'defense', targetValue: 2100, result: 'noDestroy', ...o }) as never;
    const dmg = (o: Record<string, unknown>) => ({ type: 'damage', player: 0, amount: 1700, source: 'battle', sourceUid: 12, lpAfter: 2300, ...o }) as never;
    const decl = { type: 'attackDeclare', player: 0, attackerUid: 6, attackerZone: 2, targetUid: 12, targetZone: 0 } as never;
    expect(blockOf([decl, battle({}), dmg({})], 2, dmg({}))).toBeTruthy(); // atkBlocked
    expect(blockOf([decl, battle({}), dmg({ player: 1 })], 2, dmg({ player: 1 }))).toBeNull(); // the defender pays: not a block's recoil
    expect(blockOf([decl, battle({ targetPosition: 'attack' }), dmg({})], 2, dmg({}))).toBeNull(); // a lost battle, not a block
    expect(blockOf([decl, battle({ result: 'direct', targetUid: null })], 1, dmg({}))).toBeNull();
    expect(blockOf([decl, battle({}), dmg({ source: 'effect' })], 2, dmg({ source: 'effect' }))).toBeNull(); // a counter / burn
    expect(blockOf([dmg({})], 0, dmg({}))).toBeNull();
    for (const p of [0, 1] as const)
      for (const step of [0, 1, 2, 'white'] as const) {
        const c = shieldCanvas(PLAYER_RAMP[p], step);
        expect([c.w, c.h]).toEqual([SHIELD_W, SHIELD_H]);
        expect(offPalette(c), `${p} ${step}`).toEqual([]);
      }
    const at = shieldXY({ x: 320, y: 203 }, 500, 2100);
    expect(Number.isInteger(at.x) && Number.isInteger(at.y)).toBe(true);
    expect(at.y + SHIELD_H + BLOCK_V3.gapBadge).toBeLessThanOrEqual(203 - 4);
    expect(at.x).toBeGreaterThan(320 - 4); // over the right (DEF) half of the badge
    expect(BLOCK_V3.shieldHoldMs).toBe(260);
    expect(BLOCK_V3.wordHoldMs).toBe(400);
  });
});

describe('B5: the deck-out (F8), the result plate, victory / defeat (F9)', () => {
  const FRAME = 1000 / 60;

  it('the plate says who won and why, in Turkish: hot-seat "KAZANAN: OYUNCU n", vsBot "KAZANDIN!" / "KAYBETTİN" (no crown, the person’s own reason)', async () => {
    const { RESULT_REASON, RESULT_REASON_LOST, resultText } = await import('../../src/view/v3/ResultPlate');
    const line1 = (t: { line1: { text: string }[] }) => t.line1.map((s) => s.text).join('');
    for (const w of [0, 1] as const) {
      const t = resultText({ winner: w, reason: 'lp', viewerWon: null });
      expect(line1(t)).toBe(`KAZANAN: OYUNCU ${w + 1}`);
      expect(t.line1[0].color).toBe(PAL.gold4);
      expect(t.line1[1].color).toBe(PLAYER_RAMP[w][3]);
      expect(t.win).toBe(true);
    }
    expect(RESULT_REASON).toEqual({ lp: "Rakibin LP'si sıfırlandı", deckout: 'Rakibin destesi bitti', surrender: 'Rakip teslim oldu' });
    expect(RESULT_REASON_LOST).toEqual({ lp: "LP'n sıfırlandı", deckout: 'Desten bitti', surrender: 'Teslim oldun' });
    for (const r of ['lp', 'deckout', 'surrender'] as const) {
      expect(resultText({ winner: 1, reason: r, viewerWon: null }).line2).toBe(RESULT_REASON[r]);
      const won = resultText({ winner: 0, reason: r, viewerWon: true });
      expect([line1(won), won.line2, won.win]).toEqual(['KAZANDIN!', RESULT_REASON[r], true]);
      const lost = resultText({ winner: 1, reason: r, viewerWon: false });
      expect([line1(lost), lost.line2, lost.win]).toEqual(['KAYBETTİN', RESULT_REASON_LOST[r], false]);
      expect(lost.line1[0].color).toBe(PAL.crim3);
    }
    expect(resultText({ winner: 0, reason: null, viewerWon: null }).line2).toBe('');
  });

  it('every letter is in the font, and the lines (crown included) fit between the duelists’ marks', async () => {
    const { RESULT, RESULT_REASON, RESULT_REASON_LOST, resultText } = await import('../../src/view/v3/ResultPlate');
    const glyphs = (s: string) => [...s].filter((c) => c !== ' ').length;
    const lines1: string[] = ['KAZANAN: OYUNCU 1', 'KAZANAN: OYUNCU 2', 'KAZANDIN!', 'KAYBETTİN'];
    for (const s of lines1) expect(layoutLine(s, 'md').glyphs.length, s).toBe(glyphs(s));
    for (const s of [...Object.values(RESULT_REASON), ...Object.values(RESULT_REASON_LOST)]) {
      const L = layoutLine(s, 'sm');
      expect(L.glyphs.length, s).toBe(glyphs(s));
      expect(L.w, s).toBeLessThanOrEqual(RESULT.w - 2 * (RESULT.markInset + 9 + 3));
    }
    const crown = 9 + RESULT.crownGap; // the crown icon is ≤ 9 px wide
    for (const w of [0, 1] as const)
      for (const v of [null, true, false] as const) {
        const t = resultText({ winner: w, reason: 'lp', viewerWon: v });
        const W = layoutLine(t.line1.map((s) => s.text).join(''), 'md').w + (t.win ? crown : 0);
        const x0 = Math.round((RESULT.w - W) / 2);
        expect(x0, `${w} ${v}`).toBeGreaterThanOrEqual(RESULT.markInset + 9 + 3);
        expect(x0 + W, `${w} ${v}`).toBeLessThanOrEqual(RESULT.w - RESULT.markInset - 9 - 3);
      }
  });

  it('the plate stands where the "DÜELLO!" plate stood: centred, 3 px under the phase bar, clear of both panels; the button row under it', async () => {
    const { RESULT, resultButtonRects, resultPlateRect } = await import('../../src/view/v3/ResultPlate');
    const { UI } = await import('../../src/view/layout');
    const r = resultPlateRect();
    expect(Number.isInteger(r.x) && Number.isInteger(r.y)).toBe(true);
    expect(r.x + r.w / 2).toBe(320);
    expect(r.y).toBe(UI.phaseBar.y + UI.phaseBar.h + RESULT.gapBelowBar);
    const apart = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) =>
      a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;
    for (const q of [UI.p1Panel, UI.p2Panel, UI.phaseBar, UI.buttons]) expect(apart(r, q)).toBe(true);
    for (const menu of [true, false]) {
      const bs = resultButtonRects(r, menu);
      expect(bs.length).toBe(menu ? 2 : 1);
      for (const b of bs) {
        expect(Number.isInteger(b.x) && Number.isInteger(b.y)).toBe(true);
        expect(b.y).toBe(r.y + r.h + RESULT.btnGap);
        expect(b.h).toBe(RESULT.btnH);
        for (const q of [UI.p1Panel, UI.p2Panel, UI.phaseBar]) expect(apart(b, q)).toBe(true);
      }
      const left = bs[0].x;
      const right = bs[bs.length - 1].x + bs[bs.length - 1].w;
      expect(Math.abs((left + right) / 2 - 320)).toBeLessThanOrEqual(0.5);
      if (menu) expect(bs[1].x - (bs[0].x + bs[0].w)).toBe(RESULT.btnSpace);
    }
  });

  it('the plate’s bodies are opaque palette pixels in its three opening heights (2 frames each), then rest; reduced motion: at rest at once', async () => {
    const { RESULT, resultBody, resultOpening } = await import('../../src/view/v3/ResultPlate');
    for (const h of RESULT.openH)
      for (const step of [-2, -1, 0]) {
        const p = resultBody(h, step);
        expect([p.w, p.h]).toEqual([RESULT.w, h]);
        expect(offPalette(p), `${h} ${step}`).toEqual([]);
        // the 1-px ink outline (the corners are cut)
        expect(p.get(RESULT.w >> 1, 0)).toBe(PAL.ink);
        expect(p.get(RESULT.w >> 1, h - 1)).toBe(PAL.ink);
      }
    const seq = [0, 1, 2, 3, 4, 5, 6, 40].map((f) => resultOpening(f, false));
    expect(seq.map((o) => o.h)).toEqual([6, 6, 20, 20, 40, 40, 40, 40]);
    expect(seq.map((o) => o.step)).toEqual([-2, -2, -1, -1, 0, 0, 0, 0]);
    expect(resultOpening(0, true)).toEqual({ h: RESULT.h, step: 0 });
  });

  it('fireworks: palette pixels only, ≤ 31 px across, over in FIREWORK_FRAMES; three in the winner’s half, clear of the plate, the panels and the phase bar', async () => {
    const { FIREWORK_FRAMES, RESULT, fireworkPixels, fireworkPoints, resultPlateRect } = await import('../../src/view/v3/ResultPlate');
    const { UI } = await import('../../src/view/layout');
    const { RAMPS } = await import('../../src/art/palette');
    let maxR = 0;
    let maxDrop = 0;
    for (const ramp of [PLAYER_RAMP[0], PLAYER_RAMP[1], RAMPS.gold])
      for (const size of RESULT.fireworkSizes) {
        for (let f = 0; f < FIREWORK_FRAMES; f++) {
          const px = fireworkPixels(f, ramp, size);
          expect(px, `${f}`).not.toBeNull();
          for (const q of px!) {
            expect(PAL_SET.has(q.c)).toBe(true);
            expect(Number.isInteger(q.x) && Number.isInteger(q.y)).toBe(true);
            if (f >= 5) {
              maxR = Math.max(maxR, Math.abs(q.x));
              maxDrop = Math.max(maxDrop, q.y);
            }
          }
        }
        expect(fireworkPixels(FIREWORK_FRAMES, ramp, size)).toBeNull();
      }
    expect(2 * maxR + 1).toBeLessThanOrEqual(31);
    const plate = resultPlateRect();
    for (const w of [0, 1] as const) {
      const pts = fireworkPoints(w, plate);
      expect(pts.length).toBe(RESULT.fireworksAt.length);
      for (const p of pts) {
        expect(Number.isInteger(p.x) && Number.isInteger(p.y)).toBe(true);
        // the winner's half: P1 left of the plate, P2 right of it
        if (w === 0) expect(p.x + maxR).toBeLessThan(plate.x);
        else expect(p.x - maxR).toBeGreaterThan(plate.x + plate.w);
        const box = { x: p.x - maxR - 1, y: p.y - maxR - 1, w: 2 * maxR + 3, h: 2 * maxR + 3 + maxDrop };
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.w).toBeLessThanOrEqual(640);
        expect(box.y).toBeGreaterThanOrEqual(0);
        for (const q of [UI.p1Panel, UI.p2Panel, UI.phaseBar, UI.inspect, plate])
          expect(box.x + box.w <= q.x || q.x + q.w <= box.x || box.y + box.h <= q.y || q.y + q.h <= box.y, JSON.stringify([w, p, q])).toBe(true);
      }
      // mirrored about the screen's middle column
      const other = fireworkPoints((1 - w) as 0 | 1, plate);
      pts.forEach((p, i) => expect(p.x + other[i].x).toBe(640));
    }
  });

  it('deck-out pieces: the crimson "0" tag, the missing card’s outline (each pixel once, round its centre), the falling pieces — palette only', async () => {
    const { emptyTagCanvas, missingCardPath, pieceFrame, dashOn } = await import('../../src/cinematics/v3small/end');
    for (const s of ['on', 'dim', 'rest'] as const) {
      const t = emptyTagCanvas(s);
      expect([t.w, t.h]).toEqual([9, 9]);
      expect(offPalette(t), s).toEqual([]);
    }
    for (const p of [0, 1] as const) {
      const path = missingCardPath(p);
      expect(path.length).toBeGreaterThan(40);
      expect(new Set(path.map((q) => `${q[0]},${q[1]}`)).size).toBe(path.length);
    }
    // 2 on / 2 off, marching one pixel every two frames
    expect([0, 1, 2, 3].map((i) => dashOn(i, 0))).toEqual([true, true, false, false]);
    expect([0, 1, 2, 3].map((i) => dashOn(i, 2))).toEqual([true, false, false, true]);
    for (let b = 0; b < 11; b++) {
      const f = pieceFrame({ x: 0.6, y: 0.8 }, b);
      expect(f.tone !== null && PAL_SET.has(f.tone)).toBe(true);
      expect(Number.isInteger(f.dx) && Number.isInteger(f.dy)).toBe(true);
    }
    expect(pieceFrame({ x: 1, y: 0 }, 11).tone).toBeNull();
  });

  it('the deck-out plate: "DESTE BİTTİ" in white on the crimson plate (TurnPlate kind deckOut)', async () => {
    const { deckOutPlateText, plateWidth, plateRect } = await import('../../src/view/v3/TurnPlate');
    const seg = deckOutPlateText();
    expect(seg.map((s) => s.text).join('')).toBe('DESTE BİTTİ');
    expect(seg.every((s) => s.color === PAL.white)).toBe(true);
    for (const p of [0, 1] as const) {
      const r = plateRect(p, plateWidth(seg, 'deckOut'));
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.x + r.w).toBeLessThanOrEqual(640);
    }
  });

  it('the loser’s shade: one palette step down a ramp at a time (a dead tube ends on night1), only that side’s pads / lines / trim, stepped front row first', async () => {
    const { SHADE_BOX, shadeTone, sideShadeCanvas } = await import('../../src/cinematics/v3small/end');
    const { RAMPS } = await import('../../src/art/palette');
    const { screenToIso } = await import('../../src/view/layout');
    expect(shadeTone(PAL.night3, 1)).toBe(PAL.night2);
    expect(shadeTone(PAL.night1, 2)).toBe(PAL.ink);
    expect(shadeTone(PAL.cyan3, 2)).toBe(PAL.cyan1);
    expect(shadeTone(PAL.crim1, 2)).toBe(PAL.night1);
    expect(shadeTone(PAL.gold3, 0)).toBe(PAL.gold3);
    for (const p of [0, 1] as const) {
      const full = sideShadeCanvas(p, 2, 2);
      const front = sideShadeCanvas(p, 1, 0);
      expect([full.w, full.h]).toEqual([SHADE_BOX.w, SHADE_BOX.h]);
      expect(offPalette(full)).toEqual([]);
      let n = 0;
      let nFront = 0;
      for (let y = 0; y < full.h; y++)
        for (let x = 0; x < full.w; x++) {
          if (front.isOpaque(x, y)) nFront++;
          if (!full.isOpaque(x, y)) continue;
          n++;
          const c = full.get(x, y)!;
          const own = (p === 0 ? RAMPS.cyan : RAMPS.crim) as readonly number[];
          const otherRamp = (p === 0 ? RAMPS.crim : RAMPS.cyan) as readonly number[];
          expect(otherRamp.includes(c) && !own.includes(c), `${p} ${x},${y}`).toBe(false);
          const row = screenToIso(SHADE_BOX.x + x + 0.5, SHADE_BOX.y + y + 0.5).row;
          // its side of the bridge, or its own neon trim
          if (!(own.includes(c) || c === PAL.night1)) expect(p === 0 ? row > 2.5 : row < 1.5, `${p} ${x},${y} row ${row}`).toBe(true);
        }
      expect(n).toBeGreaterThan(2000);
      expect(nFront).toBeGreaterThan(0);
      expect(nFront).toBeLessThan(n);
    }
  }, 60000);

  it('the dying tube: two-frame sputters on a fixed 4-s loop, one step up, on the loser’s trim only', async () => {
    const { SPUTTER, sputterAt, sputterCanvas, sideShadeCanvas } = await import('../../src/cinematics/v3small/end');
    const on = [];
    for (let f = 0; f < SPUTTER.loop; f++) if (sputterAt(f)) on.push(f);
    expect(on.length).toBe(SPUTTER.at.length * SPUTTER.frames);
    expect(sputterAt(SPUTTER.at[0].f + SPUTTER.loop)).toBe(sputterAt(SPUTTER.at[0].f));
    expect(sputterAt(0)).toBeNull();
    for (const p of [0, 1] as const) {
      const dead = sideShadeCanvas(p, 2, 2);
      for (const part of ['all', 'l', 'r'] as const) {
        const s = sputterCanvas(p, part);
        expect(offPalette(s)).toEqual([]);
        let n = 0;
        for (let y = 0; y < s.h; y++)
          for (let x = 0; x < s.w; x++) {
            if (!s.isOpaque(x, y)) continue;
            n++;
            // a pixel the shade darkened (the tube), one step brighter than its dead tone
            expect(dead.isOpaque(x, y)).toBe(true);
            if (part === 'l') expect(x).toBeLessThan(320 - 136);
            if (part === 'r') expect(x).toBeGreaterThanOrEqual(320 - 136);
          }
        if (part === 'all') expect(n).toBeGreaterThan(50);
      }
    }
  }, 60000);

  it('podium motes: gold only, rising (never sinking) 1 px every two frames within ±12 px, gone after their life', async () => {
    const { MOTE, moteAt } = await import('../../src/cinematics/v3small/end');
    const { RAMPS } = await import('../../src/art/palette');
    const gold = RAMPS.gold as readonly number[];
    for (let n = 0; n < 40; n++) {
      let lastY = Infinity;
      for (let a = 0; a < MOTE.life; a++) {
        const m = moteAt(n, a)!;
        expect(gold.includes(m.tone)).toBe(true);
        if (m.tail !== null) expect(gold.includes(m.tail)).toBe(true);
        expect(Math.abs(m.dx)).toBeLessThanOrEqual(12);
        expect(m.dy).toBeLessThanOrEqual(Math.min(lastY, 0));
        lastY = m.dy;
      }
      expect(moteAt(n, MOTE.life)).toBeNull();
      expect(moteAt(n, -1)).toBeNull();
    }
  });

  it('timings inside A6_MS: deck-out ≤ 1400 ms; game over 3000–3500 ms with today’s slow motion; the beam lands before the plate', async () => {
    const { BEAM, END_V3_MS } = await import('../../src/cinematics/v3small/end');
    const { A6_MS } = await import('../../src/view/v3/motion');
    const T = END_V3_MS;
    expect(T.deckOut).toBeLessThanOrEqual(A6_MS.deckOut.max);
    expect(T.cardFrom < T.breakAt && T.breakAt < T.deckPlateAt && T.deckPlateAt < T.unfocusAt && T.unfocusAt < T.deckOut).toBe(true);
    // the shown blinks fit before the card rises
    expect(T.blinks * 2 * T.blinkFrames * FRAME).toBeLessThanOrEqual(T.cardFrom);
    const game = T.gameOver + T.slowMoMs * (1 - T.slowMo); // today's slowMo(0.7, 500): 150 ms longer in game time
    expect(game).toBeGreaterThanOrEqual(A6_MS.gameOver.min!);
    expect(game).toBeLessThanOrEqual(A6_MS.gameOver.max);
    expect(T.winnerAt + BEAM.dropFrames * FRAME).toBeLessThan(T.plateAt - T.hopLead);
    expect(T.plateAt < T.releaseAt && T.releaseAt < T.gameOver).toBe(true);
    expect(T.shadeSteps[T.shadeSteps.length - 1]).toBeLessThan(T.winnerAt);
  });
});

describe('A6-B fix round 1 (critic A6B-1 … A6B-7)', () => {
  it('A6B-1: the hint\u2019s words step with the plate — never a plate without words (dim → full, palette tones)', async () => {
    const { HINT_WORDS, HINT_WORDS_FLASH, HINT_WORDS_REASON } = await import('../../src/view/v3/hudV3');
    for (const ramp of [HINT_WORDS, HINT_WORDS_FLASH, HINT_WORDS_REASON]) {
      expect(ramp.length).toBe(3);
      for (const c of ramp) expect(PAL_SET.has(c)).toBe(true);
    }
    // −2 / −1 / 0: steel → mist → white; a flash crim2 → crim3 → crim4 (each step brighter)
    expect([...HINT_WORDS]).toEqual([PAL.steel, PAL.mist, PAL.white]);
    expect([...HINT_WORDS_FLASH]).toEqual([PAL.crim2, PAL.crim3, PAL.crim4]);
    // A6B-11: a reason past its burn: amber gold, no channel-all-high "white" (palcheck: every channel > 235)
    expect([...HINT_WORDS_REASON]).toEqual([PAL.gold1, PAL.gold2, PAL.gold3]);
    for (const c of HINT_WORDS_REASON) expect(Math.min(c >> 16, (c >> 8) & 255, c & 255)).toBeLessThanOrEqual(235);
  });

  it('A6B-2: a trap answered in hot-seat with the curtain turns the defender’s hand face down (v3 lane B only)', async () => {
    const mk = async (look: 'v1' | 'v3', a6?: string, o: { mode?: 'hotseat' | 'vsBot'; curtain?: boolean; owner?: 0 | 1; down?: boolean } = {}) => {
      vi.resetModules();
      G.__NEON_LOOK = look;
      if (a6 !== undefined) G.__NEON_V3FLAGS = { a6 };
      const { ViewerPolicy } = await import('../../src/duel/viewer');
      const calls: [boolean, number][] = [];
      const hand = {
        owner: o.owner ?? 1,
        isFaceDown: o.down ?? false,
        async waveFaceDown(down: boolean, ms: number) {
          calls.push([down, ms]);
          hand.isFaceDown = down;
        },
      };
      const v = new ViewerPolicy({ mode: o.mode ?? 'hotseat', cpu: [], curtain: o.curtain ?? true, hand: hand as never, hud: {} as never, prompt: {} as never });
      await v.coverAfterAnswer(1);
      return calls;
    };
    expect(await mk('v3')).toEqual([[true, 30]]);
    expect(await mk('v3', 'b')).toEqual([[true, 30]]);
    // nothing to hide: v1, lane B off, vsBot, no curtain, a hand already down or someone else's on screen
    expect(await mk('v1')).toEqual([]);
    expect(await mk('v3', 'off')).toEqual([]);
    expect(await mk('v3', 'a')).toEqual([]);
    expect(await mk('v3', undefined, { mode: 'vsBot' })).toEqual([]);
    expect(await mk('v3', undefined, { curtain: false })).toEqual([]);
    expect(await mk('v3', undefined, { down: true })).toEqual([]);
    expect(await mk('v3', undefined, { owner: 0 })).toEqual([]);
  }, 60000);

  it('A6B-3: the result plate reads early (line 1 two letters a frame from the opening’s last step, line 2 four) and stays inside F9', async () => {
    const { RESULT, resultText } = await import('../../src/view/v3/ResultPlate');
    const { layoutLine: lay } = await import('../../src/view/v3/hudSkin');
    const t = resultText({ winner: 0, reason: 'lp', viewerWon: null });
    const n1 = lay(t.line1.map((x) => x.text).join(''), 'md').glyphs.length;
    const n2 = lay(t.line2, 'sm').glyphs.length;
    const stamp0 = (RESULT.openH.length - 1) * RESULT.openFrames;
    const end1 = stamp0 + Math.ceil(n1 / RESULT.line1PerFrame);
    const end2 = Math.max(stamp0 + 1, end1 - RESULT.line2Lead) + Math.ceil(n2 / RESULT.line2PerFrame);
    // "KAZANAN: OYUNCU 1" reads ≤ 200 ms after the plate opens (≈ 1.1 s after the game-over event), the reason ≤ 300 ms
    expect(end1 * (1000 / 60)).toBeLessThanOrEqual(200);
    expect(end2 * (1000 / 60)).toBeLessThanOrEqual(300);
    // three fireworks, 150 ms apart
    expect(RESULT.fireworksAt.length).toBe(3);
    for (let i = 1; i < 3; i++) expect(RESULT.fireworksAt[i] - RESULT.fireworksAt[i - 1]).toBe(150);
  });

  it('A6B-3: fireworks read at 1×: a 2 × 2 core, eight continuous 1-px rays growing to ≥ 7 px', async () => {
    const { fireworkPixels } = await import('../../src/view/v3/ResultPlate');
    const { RAMPS } = await import('../../src/art/palette');
    // the burst's frames come after a 4-frame climb: the flash, then rays 3 → 5 → 7
    const flash = fireworkPixels(4, RAMPS.gold, 1)!;
    expect(flash.filter((q) => q.c === PAL.white).map((q) => `${q.x},${q.y}`).sort()).toEqual(['0,0', '0,1', '1,0', '1,1']);
    const full = fireworkPixels(7, RAMPS.gold, 1)!;
    const set = new Set(full.map((q) => `${q.x},${q.y}`));
    // the right ray: (2..8, 0) all lit — a continuous 7-px line from the core
    for (let x = 2; x <= 8; x++) expect(set.has(`${x},0`), `${x}`).toBe(true);
    // the up ray (x 0) and the diagonal (1 + k, 1 + k)
    for (let k = 1; k <= 7; k++) {
      expect(set.has(`0,${-k}`)).toBe(true);
      expect(set.has(`${1 + k},${1 + k}`)).toBe(true);
    }
    expect(full.filter((q) => q.c === PAL.white).length).toBe(8); // the eight tips
  });

  it('A6B-3: the podium pool — gold bands on the podium floor only, stepping in, holding past the beam, stepping out', async () => {
    const { BEAM, POOL, podiumPoolAt, podiumPoolCanvas } = await import('../../src/cinematics/v3small/end');
    const { topAt } = await import('../../src/still/arena');
    const GOLD = new Set<number>([PAL.gold0, PAL.gold1, PAL.gold2, PAL.gold3]);
    for (const p of [0, 1] as const) {
      const o = podiumPoolCanvas(p, 3, true);
      let lit = 0;
      for (let y = 0; y < o.p.h; y++)
        for (let x = 0; x < o.p.w; x++) {
          const c = o.p.get(x, y);
          if (c === null) continue;
          lit++;
          expect(GOLD.has(c)).toBe(true);
          expect(topAt(o.x + x, o.y + y)?.kind).toBe('border');
        }
      expect(lit).toBeGreaterThan(200);
      expect(offPalette(o.p)).toEqual([]);
      // fewer levels light fewer pixels; level 0 lights none
      const count = (lv: number) => {
        const q = podiumPoolCanvas(p, lv).p;
        let n = 0;
        for (let y = 0; y < q.h; y++) for (let x = 0; x < q.w; x++) if (q.get(x, y) !== null) n++;
        return n;
      };
      expect(count(0)).toBe(0);
      expect(count(1)).toBeLessThan(count(2));
      expect(count(2)).toBeLessThan(count(3));
    }
    const hold = BEAM.holdFrames + POOL.holdAfterBeam;
    expect(podiumPoolAt(0, false)).toEqual({ level: 1, flick: false });
    expect(podiumPoolAt(1, false)).toEqual({ level: 2, flick: false });
    expect(podiumPoolAt(2, false)?.level).toBe(3);
    expect(podiumPoolAt(hold - 1, false)).toEqual({ level: 3, flick: false });
    expect(podiumPoolAt(hold, false)?.level).toBe(2);
    expect(podiumPoolAt(hold + POOL.outFrames, false)?.level).toBe(1);
    expect(podiumPoolAt(hold + 2 * POOL.outFrames, false)).toBeNull();
    // ≈ 400 ms of pool after the beam
    expect(POOL.holdAfterBeam * (1000 / 60)).toBeGreaterThanOrEqual(380);
    expect(podiumPoolAt(0, true)).toEqual({ level: 3, flick: false });
  });

  it('A6B-4: the readiness ring — 2 px of crimson with an ink line, r 10 → 22 → 34 on whole pixels (past the badge), halves split at the centre row', async () => {
    const { READY_RADII, readySteps, readyStepsReduced, readyBandCanvas, TURN_V3_MS } = await import('../../src/cinematics/v3small/turn');
    expect([...READY_RADII]).toEqual([10, 22, 34]);
    for (const player of [0, 1] as const) {
      const steps = readySteps(player);
      // three growth steps of two frames, the last held two more, then two palette steps down: 200 ms
      expect(steps.slice(0, 3).map((s) => s.r)).toEqual([...READY_RADII]);
      expect(steps.reduce((n, s) => n + s.frames, 0)).toBe(12);
      expect(steps.slice(2).every((s) => s.r === 34)).toBe(true);
      // the bottom of the r-34 band (y + 17) and its ink (y + 18) run under the stat badge's last row (y + 15)
      expect(Math.round(34 / 2) + 1).toBeGreaterThan(11 + 4);
      // reduced motion: no growth
      expect(readyStepsReduced(player).every((s) => s.r === 34)).toBe(true);
    }
    // P2's ring leads with white (it parts from P2's crimson grid); P1's with crim4
    expect(readySteps(1)[0].outer).toBe(PAL.white);
    expect(readySteps(0)[0].outer).toBe(PAL.crim4);
    // the last attacker's ring (third, 120 ms of stagger) and pool end inside the 250-ms tail after the input returns
    expect(TURN_V3_MS.ringFrom + 2 * TURN_V3_MS.ringStagger + 12 * (1000 / 60)).toBeLessThanOrEqual(TURN_V3_MS.battle + 10 + 250);
    expect(TURN_V3_MS.poolHoldMs).toBeGreaterThanOrEqual(150);
    expect(TURN_V3_MS.ringFrom + 2 * TURN_V3_MS.ringStagger + TURN_V3_MS.poolHoldMs + TURN_V3_MS.poolOutMs).toBeLessThanOrEqual(TURN_V3_MS.battle + 10 + 250);
    for (const st of [...readySteps(0), ...readySteps(1)]) {
      const p = readyBandCanvas(st.r, st.outer, st.inner);
      const ry = Math.round(st.r / 2);
      expect([p.w, p.h]).toEqual([2 * st.r + 3, 2 * ry + 3]);
      expect(offPalette(p)).toEqual([]);
      const tones = new Set<number>();
      for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (p.get(x, y) !== null) tones.add(p.get(x, y)!);
      expect([...tones].sort()).toEqual([PAL.ink, st.outer, st.inner].sort());
      // the leftmost column is ink (the line outside), then the outer tone, then the inner tone
      const mid = ry + 1;
      expect([p.get(0, mid), p.get(1, mid), p.get(2, mid)]).toEqual([PAL.ink, st.outer, st.inner]);
      const back = readyBandCanvas(st.r, st.outer, st.inner, 'back');
      const front = readyBandCanvas(st.r, st.outer, st.inner, 'front');
      for (let y = 0; y < p.h; y++)
        for (let x = 0; x < p.w; x++) {
          const c = p.get(x, y);
          expect(y < mid ? back.get(x, y) : front.get(x, y)).toBe(c);
          expect(y < mid ? front.get(x, y) : back.get(x, y)).toBeNull();
        }
    }
  });

  it('A6B-5: the spark flies a whole-pixel arc from the plate to its target, every frame on a continuous path, round the field', async () => {
    const { SPARK, linePixels, sparkFrames, sparkPoint } = await import('../../src/view/v3/TurnPlate');
    const { BOARD_CENTER } = await import('../../src/view/layout');
    const cases = [
      { a: { x: 76, y: 228 }, b: { x: 196, y: 12 } },
      { a: { x: 560, y: 92 }, b: { x: 196, y: 12 } },
    ];
    for (const { a, b } of cases) {
      const n = sparkFrames(a, b, 12);
      expect(n).toBeGreaterThanOrEqual(SPARK.minFrames);
      expect(n).toBeLessThanOrEqual(12);
      const pts = Array.from({ length: n + 1 }, (_, i) => sparkPoint(a, b, i, n));
      expect(pts[0]).toEqual(a);
      expect(pts[n]).toEqual(b);
      for (const q of pts) expect(Number.isInteger(q.x) && Number.isInteger(q.y)).toBe(true);
      // the trail between two frames is a gapless 8-connected line
      for (let i = 0; i < n; i++) {
        const line = linePixels(pts[i], pts[i + 1]);
        for (let k = 1; k < line.length; k++) expect(Math.max(Math.abs(line[k].x - line[k - 1].x), Math.abs(line[k].y - line[k - 1].y))).toBe(1);
      }
      // the arc's middle lies farther from the board's centre than the straight line's middle
      const mid = pts[Math.round(n / 2)];
      const straight = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      expect(Math.hypot(mid.x - BOARD_CENTER.x, mid.y - BOARD_CENTER.y)).toBeGreaterThan(Math.hypot(straight.x - BOARD_CENTER.x, straight.y - BOARD_CENTER.y) - 1);
      // bulge 0: straight
      const s = sparkPoint(a, b, n / 2, n, 0);
      expect(Math.abs(s.x - straight.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(s.y - straight.y)).toBeLessThanOrEqual(1);
    }
  });

  it('A6B-5: the plate folds out in place (12 → 6 → 2 px, two frames each) — no hops across the screen', async () => {
    const { PLATE } = await import('../../src/view/v3/TurnPlate');
    expect([...PLATE.fold]).toEqual([12, 6, 2]);
    expect(PLATE.fold.length * PLATE.foldFrames * (1000 / 60)).toBeLessThanOrEqual(120);
    for (let i = 1; i < PLATE.fold.length; i++) expect(PLATE.fold[i]).toBeLessThan(PLATE.fold[i - 1]);
  });

  it('A6B-6: overlapping candidates drop the corners that fall inside another’s box; the hovered corner is thick with its joint where the thin one’s is', async () => {
    const { AIM, CORNERS, cornerCanvas, cornerJoint, cornerXY, overlappedCorners, thickCornerCanvas } = await import('../../src/view/v3/TargetMarks');
    const wolf = { x0: 100, y0: 40, x1: 160, y1: 90 };
    const lizard = { x0: 140, y0: 70, x1: 210, y1: 120 };
    const w = overlappedCorners(wolf, AIM.gap, [lizard]);
    const l = overlappedCorners(lizard, AIM.gap, [wolf]);
    expect([...w]).toEqual(['br']);
    expect([...l]).toEqual(['tl']);
    expect(overlappedCorners(wolf, AIM.gap, []).size).toBe(0);
    expect(overlappedCorners(wolf, AIM.gap, [{ x0: 400, y0: 40, x1: 460, y1: 90 }]).size).toBe(0);
    for (const c of CORNERS) {
      const thick = thickCornerCanvas(c, PAL.gold4, PAL.white);
      expect(offPalette(thick)).toEqual([]);
      const thin = cornerCanvas(c, PAL.gold3);
      // the joint pixel lands on the same screen pixel for both sizes (thick: right / bottom start 2 px earlier)
      const p = cornerXY(c, wolf, AIM.gap);
      const j = cornerJoint(c, wolf, AIM.gap);
      const right = c === 'tr' || c === 'br';
      const bottom = c === 'bl' || c === 'br';
      expect(thin.get(j.x - p.x, j.y - p.y)).toBe(PAL.gold3);
      expect(thick.get(j.x - (right ? p.x - 2 : p.x), j.y - (bottom ? p.y - 2 : p.y))).toBe(PAL.white);
      // 2-px legs: more lit pixels than the thin corner
      let a = 0;
      let b = 0;
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if (thick.get(x, y) !== null && thick.get(x, y) !== PAL.ink) a++;
      for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) if (thin.get(x, y) !== null && thin.get(x, y) !== PAL.ink) b++;
      expect(a).toBeGreaterThanOrEqual(2 * b);
    }
  });
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
      '../../src/cinematics/v3small/opening-flow.ts',
      '../../src/cinematics/v3small/heal.ts',
      '../../src/view/v3/TargetMarks.ts',
      '../../src/cinematics/v3small/target.ts',
      '../../src/view/v3/TrapPromptV3.ts',
      '../../src/view/v3/CurtainV3.ts',
      '../../src/cinematics/v3small/decision.ts',
      '../../src/cinematics/v3small/block.ts',
      '../../src/view/v3/ResultPlate.ts',
      '../../src/cinematics/v3small/end.ts',
    ],
    {
      eager: true,
      query: '?raw',
      import: 'default',
    },
  );

  it('no new camera call in the lane\u2019s new files (KO-10, §6.3); end.ts keeps exactly today\u2019s two leans', () => {
    for (const [f, src] of Object.entries(SOURCES)) {
      if (!/TurnPlate|odometer|v3small|TargetMarks|TrapPromptV3|CurtainV3|ResultPlate/.test(f)) continue;
      const lines = src.split('\n').filter((l) => !/^\s*\/\//.test(l));
      // today's deck-out and game-over leans are kept at their beats (the user's decision): marked `keep-lean`
      const kept = lines.filter((l) => l.includes('keep-lean'));
      if (/v3small\/end\.ts$/.test(f)) {
        expect(kept.length, f).toBe(2);
        expect(kept[0]).toMatch(/ctx\.focus\(\{ x: at\.x, y: at\.y - 10 \}, \{ zoom: 1\.07, ms: 320, pan: 0\.45 \}\)/);
        expect(kept[1]).toMatch(/ctx\.focus\(\{ x: chest\.x, y: chest\.y \}, \{ zoom: 1\.07, ms: 520, pan: 0\.35 \}\)/);
      } else expect(kept, f).toEqual([]);
      const code = lines.filter((l) => !l.includes('keep-lean')).join('\n');
      expect(/\bfocus\(|closeUp|setZoom|\.pan\(|descend\(/.test(code), f).toBe(false);
    }
  });

  it('no colour constant outside the palette, no ADD blend, no alpha fade in A6-B files', () => {
    expect(Object.keys(SOURCES).length).toBe(16);
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
