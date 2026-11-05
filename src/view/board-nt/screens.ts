// Neon Tower layer: SCREENS (portrait screens) — owner B2 (docs/v3/ARENA_NEON_TOWER.md §2, §7, §10).
// The two big digital screens hanging on the back wall (layout-nt.ts SCREENS, 92×79 incl. the shear; 80×56
// picture; ANGLED: sheared 1 px per 6 columns, see src/art/arena-nt/screens.ts): the player's (blue frame, brown-haired boy in the blue coat) and the opponent's (crimson frame,
// white-haired boy in the red coat), pixel-art portraits baked in src/art/arena-nt/portraits.ts, with a name
// plate (OYUNCU 1 / OYUNCU 2, or BİLGİSAYAR in a vs-CPU duel; Turkish text through the UI text API).
//
// Alive, calm (every motion is a function of the arena clock, see src/art/arena-nt/screens-anim.ts):
//   idle      blink, hair sway, a sheared dithered scan line rolling down, a lit sweep column now and then, a one-frame flicker, a rare
//             sideways tear, the inactive side's neon line breathing; the active side's frame is one tone brighter
//   reaction  damage: the face winces (eyes shut), the picture jolts 1 px, one lit flash frame, a slipped band on a
//             big hit, the neon goes hot; healing: a smile and a lit band climbing the picture; a summon: a sweep
//             column; game over: the winner keeps smiling, the loser winces and the picture keeps tearing
//   power     lights out → the screens are dark (frame only); lights on → the picture is drawn in from the top row by
//             row behind a bright edge (≈ 0.4 s)
// ~9 game objects per screen, no tweens, no timers (the whole layer runs on tick()). Depth: NT_DEPTH.screens.

import type Phaser from 'phaser';
import {
  NT_SCREENS_KEY,
  type ScreenOverlayKind,
  dyAt,
  frameName,
  litName,
  overlayName,
  paintPlate,
  picName,
  scanName,
  screensBake,
  shearPiece,
  PIC_AT,
} from '../../art/arena-nt/screens';
import { blinkAt, breathAt, flickerAt, scanAt, sweepAt, swayAt, tearAt } from '../../art/arena-nt/screens-anim';
import { PORTRAIT_W } from '../../art/arena-nt/portraits';
import { canvasTexture } from '../../art/textures';
import { PixelCanvas } from '../../art/pixel';
import { textCanvas } from '../v3/hudSkin';
import { PAL, RAMPS } from '../../art/palette';
import type { GameEvent, PlayerId } from '../../engine/types';
import { wait } from '../../vfx/core';
import { NT_DEPTH, SCREENS } from './layout-nt';
import type { NtCtx, NtLayer } from './layer';
import { ensureNtTexture } from './textures';

/** Sub-depths inside NT_DEPTH.screens (11 … 12; wallLights start at 12). */
const Z = {
  pic: NT_DEPTH.screens,
  patch: NT_DEPTH.screens + 0.1,
  tear: NT_DEPTH.screens + 0.2,
  lit: NT_DEPTH.screens + 0.3,
  frame: NT_DEPTH.screens + 0.5,
  plate: NT_DEPTH.screens + 0.6,
  num: NT_DEPTH.screens + 0.7,
} as const;

/** Register the screens' atlas texture + frames once (boot step 27 and, as a fallback, the layer). */
export function ensureScreenTextures(scene: Phaser.Scene): void {
  const bake = screensBake();
  ensureNtTexture(scene, 'screens', NT_SCREENS_KEY, () => bake.canvas);
  const tex = scene.textures.get(NT_SCREENS_KEY);
  for (const [name, r] of Object.entries(bake.frames)) if (!tex.has(name)) tex.add(name, 0, r.x, r.y, r.w, r.h);
}

/** A crop of the lit picture shown over the base picture. */
interface LitCrop {
  key: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A running reaction of one screen. */
interface Reaction {
  kind: 'hurt' | 'glad';
  start: number;
  until: number;
  power: number;
}

/** The names the plates show: the vs-CPU duel names the computer's side BİLGİSAYAR (as the HUD does). */
function plateNames(scene: Phaser.Scene): [string, string] {
  const names: [string, string] = ['OYUNCU 1', 'OYUNCU 2'];
  try {
    const d = scene.sys.settings.data as { mode?: string; botPlayer?: PlayerId } | undefined;
    if (d?.mode === 'vsBot') names[d.botPlayer ?? 1] = 'BİLGİSAYAR';
  } catch {
    /* no launch data (previews): the defaults */
  }
  return names;
}

/** How long the LP readout stays on a screen after damage / healing (ms): pop, hold, two blinks, gone. (LP only: one hit = one number, at the impact.) */
const READOUT_MS = 1500;

/** Ceiling rods (a 3-px steel bar with a lit edge) the screens hang from: x offsets inside the screen, top y of the bezel there. */
const ROD_X = [14, 76] as const;

export function createScreensLayer(ctx: NtCtx): NtLayer {
  const scene = ctx.scene;
  ensureScreenTextures(scene);
  const bake = screensBake();
  const names = plateNames(scene);
  /** The sheared picture's size (the pic texture) */
  const PICH = bake.frames[picName(0)].h;

  interface Screen {
    who: 0 | 1;
    /** where the sheared picture sits on the screen (top-left) */
    px: number;
    py: number;
    pic: Phaser.GameObjects.Image;
    swayImg: Phaser.GameObjects.Image;
    patch: Phaser.GameObjects.Image;
    tear: Phaser.GameObjects.Image;
    litA: Phaser.GameObjects.Image;
    litB: Phaser.GameObjects.Image;
    scan: Phaser.GameObjects.Image;
    frame: Phaser.GameObjects.Image;
    plate: Phaser.GameObjects.Image;
    plateKeys: [string, string];
    /** the LP readout (the LP now, never the amount), shown on the picture for READOUT_MS */
    num: Phaser.GameObjects.Image;
    numKey: string;
    numAt: { x: number; y: number };
    numStart: number;
    // last applied state (skip redundant Phaser calls)
    last: { frame: number; patch: string; sway: number; jx: number; litA: string; litB: string; tear: string; reveal: number; textTone: number; scan: number };
    rx: Reaction | null;
    /** when the last summon sweep started (ms) or −1 */
    kick: number;
    /** power-on progress 0..PICH rows (−1 = dark) */
    rows: number;
  }

  const screens: Screen[] = ([0, 1] as const).map((who) => {
    const r = SCREENS[who];
    const ap = bake.at[picName(who)];
    const px = r.x + ap.x;
    const py = r.y + ap.y;
    const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => ctx.add(o);
    const img = (frame: string, z: number, x = px, y = py): Phaser.GameObjects.Image => add(scene.add.image(x, y, NT_SCREENS_KEY, frame).setOrigin(0).setDepth(z));

    // ---- the ceiling rods the screen hangs from (a 3-px bar from the top of the screen up into the ceiling)
    for (const dx of ROD_X) {
      const top = r.y + dyAt(who, dx) + 1;
      add(scene.add.rectangle(r.x + dx, 0, 3, top, PAL.night1).setOrigin(0).setDepth(Z.pic - 0.5));
      add(scene.add.rectangle(r.x + dx, 0, 1, top, PAL.night3).setOrigin(0).setDepth(Z.pic - 0.4));
      add(scene.add.rectangle(r.x + dx + 2, 0, 1, top, PAL.ink).setOrigin(0).setDepth(Z.pic - 0.4));
    }

    const pic = img(picName(who), Z.pic);
    const swayImg = img(overlayName(who, 'swayP'), Z.patch).setVisible(false);
    const patch = img(overlayName(who, 'blink'), Z.patch + 0.05).setVisible(false);
    const tear = img(picName(who), Z.tear).setVisible(false);
    const litA = img(litName(who), Z.lit).setVisible(false);
    const litB = img(litName(who), Z.lit + 0.01).setVisible(false);
    const asc = bake.at[scanName(who)];
    const scan = img(scanName(who), Z.lit + 0.02, r.x + asc.x, r.y + asc.y).setVisible(false);
    const frame = add(scene.add.image(r.x, r.y, NT_SCREENS_KEY, frameName(who, false)).setOrigin(0).setDepth(Z.frame));

    // ---- name plate (sheared with the screen): baked here from the HUD's text painter in two tones (idle / active)
    const R = who === 0 ? RAMPS.cyan : RAMPS.crim;
    // the right plate must stay right of the duelist notch (art/arena-nt/screens.ts NOTCH): OYUNCU 2 (41 px) still fits; only the
    // computer's longer name (BİLGİSAYAR, vs-CPU duels only) shows as CPU — a hot-seat duel always reads OYUNCU 2
    const label = who === 1 && names[who] === 'BİLGİSAYAR' && (textCanvas(names[who], 'sm', R[3]).bounds()?.w ?? 0) > 41 ? 'CPU' : names[who];
    const plateKeys: [string, string] = [`nt:screens:plate:${who}:${label}:3`, `nt:screens:plate:${who}:${label}:4`];
    const plates = [3, 4].map((tone) => paintPlate(who, textCanvas(label, 'sm', R[tone])));
    plates.forEach((pl, i) => canvasTexture(scene, plateKeys[i], pl.canvas));
    const plate = add(scene.add.image(r.x + plates[0].x, r.y + plates[0].y, plateKeys[0]).setOrigin(0).setDepth(Z.plate));
    const num = add(scene.add.image(0, 0, NT_SCREENS_KEY, frameName(who, false)).setOrigin(0).setDepth(Z.num).setVisible(false));
    return {
      who,
      num,
      numKey: '',
      numAt: { x: 0, y: 0 },
      numStart: -9999,
      px,
      py,
      pic,
      swayImg,
      patch,
      tear,
      litA,
      litB,
      scan,
      frame,
      plate,
      plateKeys,
      last: { frame: 0, patch: '', sway: 0, jx: 0, litA: '', litB: '', tear: '', reveal: -2, textTone: 3, scan: -1 },
      rx: null,
      kick: -1,
      rows: PICH,
    };
  });

  let now = 0;
  let active: PlayerId | null = null;
  /** game over: who won (the winner keeps smiling, the loser keeps wincing) */
  let over: PlayerId | null = null;
  /** power-on progress (rows drawn per screen); a lights-out screen is dark (−1) */
  let rising = false;
  let powerRun = 0;

  /**
   * The LP readout of a screen: ONLY the life points now ("LP" over the number, small), parked in the free strip left of the face
   * (never over the face, never a second damage number: the one amount of a hit is the number at the defender's impact point).
   * The textures are baked on demand (tiny, cached by the texture manager).
   */
  function readout(who: 0 | 1, lpAfter: number, gain: boolean): void {
    const s = screens[who];
    const R = who === 0 ? RAMPS.cyan : RAMPS.crim;
    const key = `nt:screens:lp:${who}:${gain ? '+' : '-'}${lpAfter}`;
    const crop = (c: PixelCanvas): PixelCanvas => {
      const b = c.bounds();
      return b ? c.crop(b.x, b.y, b.w, b.h) : c;
    };
    const lbl = crop(textCanvas('LP', 'sm', gain ? RAMPS.cyan[3] : R[3]));
    const val = crop(textCanvas(String(lpAfter), 'sm', gain ? RAMPS.cyan[4] : PAL.white));
    const w = Math.max(lbl.w, val.w);
    const flat = new PixelCanvas(w, lbl.h + 1 + val.h);
    flat.blit(lbl, 0, 0);
    flat.blit(val, w - val.w, lbl.h + 1);
    const sh = shearPiece(flat, who, PIC_AT.x + 1, PIC_AT.y + 4);
    if (!scene.textures.exists(key)) canvasTexture(scene, key, sh.canvas);
    s.numKey = key;
    s.numAt = { x: SCREENS[who].x + sh.x, y: SCREENS[who].y + sh.y };
    s.numStart = now;
    s.num.setTexture(key);
  }

  function react(who: 0 | 1, kind: Reaction['kind'], power: number): void {
    const ms = Math.round((kind === 'hurt' ? 420 : 640) * power);
    screens[who].rx = { kind, start: now, until: now + ms, power };
  }

  /** A column (`w` px wide) of the lit picture, clipped to the picture; null when fully outside. */
  function column(x: number, w = 7): LitCrop | null {
    const x0 = Math.max(0, x);
    const cw = Math.min(PORTRAIT_W, x + w) - x0;
    return cw > 0 ? { key: `col${x}:${w}`, x: x0, y: 0, w: cw, h: PICH } : null;
  }

  // ---- one screen, one tick
  function update(s: Screen, t: number): void {
    const { who } = s;
    const L = s.last;
    const rows = s.rows < 0 ? -1 : Math.floor(s.rows);

    // dark / drawing-in: the picture is revealed from the top, a bright lit edge under the last row
    if (rows < PICH) {
      if (L.reveal !== rows) {
        L.reveal = rows;
        s.pic.setVisible(rows > 0);
        if (rows > 0) s.pic.setCrop(0, 0, PORTRAIT_W, rows);
        const edge = rows > 0;
        s.litB.setVisible(edge);
        if (edge) s.litB.setCrop(0, Math.max(0, rows - 2), PORTRAIT_W, Math.min(2, rows)).setPosition(s.px, s.py + Math.max(0, rows - 2));
        for (const o of [s.litA, s.swayImg, s.patch, s.tear, s.scan, s.plate, s.num]) o.setVisible(false);
        L.litA = L.litB = L.tear = '';
        L.patch = '#';
        L.sway = 9;
        L.scan = -1;
      }
      if (L.frame !== -1) {
        L.frame = -1;
        s.frame.setFrame(frameName(who, false));
      }
      return;
    }
    if (L.reveal !== PICH) {
      L.reveal = PICH;
      s.pic.setVisible(true).setCrop();
      s.plate.setVisible(true);
      L.frame = -1;
    }

    const rx = s.rx && t < s.rx.until ? s.rx : null;
    if (!rx) s.rx = null;
    const ago = rx ? t - rx.start : 0;

    // ---- jolt (whole pixels): a hit shakes the picture inside its frame
    const jx = rx && rx.kind === 'hurt' && ago < 160 ? [1, -1, 1, 0][Math.floor(ago / 40)] : 0;
    if (jx !== L.jx) {
      L.jx = jx;
      s.pic.setX(s.px + jx);
    }

    // ---- hair sway (still while the face winces)
    const sway = rx && rx.kind === 'hurt' ? 0 : swayAt(who, t);
    if (sway !== L.sway) {
      L.sway = sway;
      if (sway === 0) s.swayImg.setVisible(false);
      else s.swayImg.setFrame(overlayName(who, sway < 0 ? 'swayN' : 'swayP')).setVisible(true);
    }
    const R0 = SCREENS[who];
    if (sway !== 0) {
      const at = bake.at[overlayName(who, sway < 0 ? 'swayN' : 'swayP')];
      s.swayImg.setPosition(R0.x + at.x + jx, R0.y + at.y);
    }

    // ---- mood patch: the reaction face (game over: held), else a blink
    let mood: ScreenOverlayKind | '' = '';
    if (over !== null) mood = over === who ? 'glad' : 'hurt';
    else if (rx) mood = rx.kind;
    else if (blinkAt(who, t)) mood = 'blink';
    if (mood !== L.patch) {
      L.patch = mood;
      if (mood === '') s.patch.setVisible(false);
      else s.patch.setFrame(overlayName(who, mood)).setVisible(true);
    }
    if (mood !== '') {
      const at = bake.at[overlayName(who, mood)];
      s.patch.setPosition(R0.x + at.x + jx, R0.y + at.y);
    }

    // ---- lit overlays. A: hit flash / heal sweeps / summon sweep / flicker / idle sweep column; B: (power-on edge only)
    let a: LitCrop | null = null;
    if (rx && rx.kind === 'hurt' && ago < 70) a = { key: 'flash', x: 0, y: 0, w: PORTRAIT_W, h: PICH };
    else if (rx && rx.kind === 'glad') {
      // two broad lit columns cross the picture, one after the other (≈ 320 ms each)
      a = column(Math.round(-9 + ((PORTRAIT_W + 9) * (ago % 320)) / 320), 9);
    } else if (s.kick >= 0 && t - s.kick < 360) a = column(Math.round(-9 + ((PORTRAIT_W + 9) * (t - s.kick)) / 360), 9);
    else if (flickerAt(who, t)) a = { key: 'flash', x: 0, y: 0, w: PORTRAIT_W, h: PICH };
    else {
      const x = sweepAt(who, t);
      if (x !== null) a = column(x, 8);
    }
    const aKey = a ? a.key : '';
    if (aKey !== L.litA) {
      L.litA = aKey;
      if (!a) s.litA.setVisible(false);
      else s.litA.setCrop(a.x, a.y, a.w, a.h).setVisible(true);
    }
    if (a) s.litA.setPosition(s.px + a.x + (a.key === 'flash' ? jx : 0), s.py + a.y);
    if (L.litB !== '') {
      L.litB = '';
      s.litB.setVisible(false);
    }

    // ---- the scan line rolls down the picture (a sheared dithered row, parallel to the bezel)
    const row = scanAt(who, t);
    if (row !== L.scan) {
      L.scan = row;
      const asc = bake.at[scanName(who)];
      s.scan.setPosition(R0.x + asc.x + jx, R0.y + asc.y + row).setVisible(true);
    }

    // ---- tear: a band slipped sideways (idle: rare; big hit and the loser at game over: stronger)
    let tr = tearAt(who, t);
    if (rx && rx.kind === 'hurt' && rx.power > 1.2 && ago >= 40 && ago < 170) tr = { y: 14 + (Math.floor(ago / 40) % 3) * 11, h: 5, dx: ago < 100 ? 3 : -2 };
    if (over !== null && over !== who && Math.floor(t / 90) % 11 === 0) tr = { y: 10 + (Math.floor(t / 990) % 4) * 11, h: 4, dx: 3 };
    const tKey = tr ? `${tr.y}:${tr.h}:${tr.dx}` : '';
    if (tKey !== L.tear) {
      L.tear = tKey;
      if (!tr) s.tear.setVisible(false);
      else s.tear.setCrop(0, tr.y, PORTRAIT_W, tr.h).setPosition(s.px + tr.dx, s.py + tr.y).setVisible(true);
    }

    // ---- frame: the active side's neon is bright, the inactive one breathes, a reaction goes hot
    const fk = active === who || breathAt(who, t) || !!rx || over === who ? 1 : 0;
    if (fk !== L.frame) {
      L.frame = fk;
      s.frame.setFrame(frameName(who, fk === 1));
    }
    // ---- the LP readout: pops in one pixel low, rises 2 px, blinks twice at the end, then is gone
    const na = t - s.numStart;
    const showNum = na >= 0 && na < READOUT_MS && !(na > READOUT_MS - 360 && Math.floor(na / 90) % 2 === 1);
    if (showNum) {
      const lift = na < 160 ? 0 : na < 320 ? 1 : 2;
      s.num.setPosition(s.numAt.x + jx, s.numAt.y - lift).setVisible(true);
    } else if (s.num.visible) s.num.setVisible(false);

    // the name plate's text one tone up on the active side
    const tone = active === who ? 4 : 3;
    if (tone !== L.textTone) {
      L.textTone = tone;
      s.plate.setTexture(s.plateKeys[tone === 4 ? 1 : 0]);
    }
  }

  /** Lights out → dark frames; lights on → the pictures are drawn in (~0.4 s). */
  function setPower(on: boolean, animate: boolean): Promise<void> {
    const run = ++powerRun;
    if (!on) {
      for (const s of screens) s.rows = -1;
      rising = false;
      return Promise.resolve();
    }
    for (const s of screens) s.rows = animate ? 0 : PICH;
    if (!animate) {
      rising = false;
      return Promise.resolve();
    }
    // the picture starts after the floor lines are lit (~160 ms), then 0.36 s of drawing-in
    return wait(scene, 160)
      .then(() => {
        if (run === powerRun) rising = true;
        return wait(scene, 360);
      })
      .then(() => undefined);
  }

  return {
    name: 'screens',
    owner: 'B2',
    tick(dt: number, t: number): void {
      now = t;
      if (rising) {
        let busy = false;
        for (const s of screens)
          if (s.rows >= 0 && s.rows < PICH) {
            s.rows = Math.min(PICH, s.rows + (dt * PICH) / 360);
            busy = busy || s.rows < PICH;
          }
        rising = busy;
      }
      for (const s of screens) update(s, t);
    },
    setLights(on: boolean, animate: boolean): Promise<void> {
      return setPower(on, animate);
    },
    setActivePlayer(p: PlayerId | null): void {
      active = p;
    },
    onGameEvent(ev: GameEvent): void {
      switch (ev.type) {
        case 'damage':
          react(ev.player, 'hurt', ev.amount >= 2000 ? 1.7 : ev.amount >= 1000 ? 1.3 : 1);
          readout(ev.player, Math.max(0, ev.lpAfter), false);
          break;
        case 'lpGain':
          react(ev.player, 'glad', 1);
          readout(ev.player, ev.lpAfter, true);
          break;
        case 'summon':
          screens[ev.player].kick = now;
          break;
        case 'gameOver':
          over = ev.winner;
          break;
        default:
          break;
      }
    },
    destroy(): void {
      /* objects are owned by the view (ctx.add) */
    },
  };
}
