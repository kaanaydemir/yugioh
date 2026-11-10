// Neon Tower layer: FLOOR (slots / grid) — owner A1.
// Readability pass: apron rail strips and blinking lamps stay off so the floor around the platform stays calm and dark.

import Phaser from 'phaser';
import { FLOOR_FRAMES, NT_FLOOR_KEY, SLOT_DOWN, SLOT_EMPTY, SLOT_OCCUPIED, SEAL_RAMP, type SealTheme, buildFloorArt, fieldTheme } from '../../art/arena-nt/floor';
import type { FloorArt } from '../../art/arena-nt/floor';
import { APRON_BOX, NT_APRON_FX_KEY, NT_APRON_KEY, buildApronArt, type ApronArt } from '../../art/arena-nt/apron';
import { buildCalmArt, calmZones } from '../board-calm/art';
import { PAL, RAMPS } from '../../art/palette';
import type { FieldView } from '../../duel/FieldView';
import type { GameEvent, PlayerId } from '../../engine/types';
import { BANISH_PAD, BOARD_V4, type BoardSpot, zoneXY } from '../layout';
import { CENTER_EMBLEM, NT_COLS, NT_DEPTH, NT_ROWS, PLATE_OUTLINE, PLATE_X0, PLATE_X1, PLATE_Y0, PLATE_Y1, ntIso } from './layout-nt';
import { mulberry32 } from '../../art/pixel';
import { TEX } from '../../vfx/core';
import { type NtCtx, type NtLayer } from './layer';
import { ensureNtTexture } from './textures';

type Img = Phaser.GameObjects.Image;

const APRON_Z = 9.96;

/** Arena v4 step 3: the lit field seal's light pool (white, stepped bands; tinted with the theme at run time). */
const SEAL_HALO = { w: 80, h: 40 } as const;
const SEAL_HALO_KEY = 'nt:floor:sealhalo';
function ensureSealHalo(scene: Phaser.Scene): string {
  if (scene.textures.exists(SEAL_HALO_KEY)) return SEAL_HALO_KEY;
  const { w, h } = SEAL_HALO;
  const t = scene.textures.createCanvas(SEAL_HALO_KEY, w, h);
  if (!t) return '__DEFAULT';
  const img = new ImageData(w, h);
  const bands = [0.5, 0.32, 0.16];
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const dx = (i + 0.5 - w / 2) / (w / 2);
      const dy = (j + 0.5 - h / 2) / (h / 2);
      const r = Math.sqrt(dx * dx + dy * dy);
      if (r >= 1) continue;
      const v = Math.round(255 * bands[Math.min(2, Math.floor(r * 3))]);
      const o = (j * w + i) * 4;
      img.data[o] = img.data[o + 1] = img.data[o + 2] = v;
      img.data[o + 3] = 255;
    }
  t.getContext().putImageData(img, 0, 0);
  t.refresh();
  return SEAL_HALO_KEY;
}

// ---------------------------------------------------------------- smooth slot borders (readability pass)
// Owner feedback 2026-11-02: the tile lines of hedef-gorunum-1/2 are smooth, ours were hard 1-px stairs.
// The slots are drawn on a 2D canvas instead: an anti-aliased diamond line + a faint glow + a light interior
// tint, in the player's PAL ramp (cyan / crimson). Same frame names as the pixel atlas (FLOOR_FRAMES.slot),
// same 64×32 box, same place; the diamond is fitted to the calm board's own zone-line mask.

const NT_FLOOR_SMOOTH_KEY = 'nt:floor:smooth';

const rgbOf = (c: number): string => `${(c >> 16) & 255}, ${(c >> 8) & 255}, ${c & 255}`;

// ---------------------------------------------------------------- stone texture of the plate (readability pass)
// Owner feedback: the plate of hedef-gorunum-1/2 has a texture, ours was one flat colour. A soft 2D-canvas
// overlay on the plate's top (clipped to the octagon, under the slots): big iso stone flags with thin
// anti-aliased seams (dark groove + lit lip from the top left), a gentle per-flag tone shift and low-frequency
// mottling. Deterministic (seeded), static, drawn once.

const NT_PLATE_TEX_KEY = 'nt:plate:texture';

function ensurePlateTexture(scene: Phaser.Scene): string | null {
  if (scene.textures.exists(NT_PLATE_TEX_KEY)) return NT_PLATE_TEX_KEY;
  const W = PLATE_X1 - PLATE_X0;
  const H = PLATE_Y1 - PLATE_Y0;
  const ct = scene.textures.createCanvas(NT_PLATE_TEX_KEY, W, H);
  if (!ct) return null;
  const g = ct.getContext();
  g.clearRect(0, 0, W, H);
  g.save();
  g.translate(-PLATE_X0, -PLATE_Y0);
  // clip to the plate's top octagon, 5 px inside the coping
  const pts = PLATE_OUTLINE.map(([c, r]) => ntIso(c, r));
  const mx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
  const my = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  g.beginPath();
  pts.forEach((p, i) => {
    const dx = p.x - mx;
    const dy = p.y - my;
    const k = 1 - 7 / Math.hypot(dx, dy * 2);
    const x = mx + dx * k;
    const y = my + dy * k;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  });
  g.closePath();
  g.clip();

  const rnd = mulberry32(90210);
  const ink = rgbOf(PAL.ink);
  const lit = rgbOf(PAL.stone3);
  // 1. per-flag tone shift: flags of 1 × 1 tile in the 7 × 5 reference grid, offset half a tile
  // one flag = the 64 × 32 diamond centred on grid point (c, r); flags sit on the half-tile so their seams
  // run between the slots
  const flag = (c: number, r: number): void => {
    const p = ntIso(c, r);
    g.beginPath();
    g.moveTo(p.x, p.y - 16);
    g.lineTo(p.x + 32, p.y);
    g.lineTo(p.x, p.y + 16);
    g.lineTo(p.x - 32, p.y);
    g.closePath();
  };
  for (let c = -2; c <= NT_COLS + 1; c++)
    for (let r = -3; r <= NT_ROWS + 2; r++) {
      const v = rnd();
      flag(c - 0.5, r - 0.5);
      g.fillStyle = v < 0.5 ? `rgba(${ink}, ${(0.05 + v * 0.1).toFixed(3)})` : `rgba(${lit}, ${((v - 0.5) * 0.07).toFixed(3)})`;
      g.fill();
    }
  // 2. low-frequency mottling (soft blotches, no single-pixel noise)
  for (let i = 0; i < 70; i++) {
    const x = PLATE_X0 + rnd() * W;
    const y = PLATE_Y0 + rnd() * H;
    const rx = 10 + rnd() * 26;
    const gr = g.createRadialGradient(x, y, 0, x, y, rx);
    const dark = rnd() < 0.6;
    gr.addColorStop(0, dark ? `rgba(${ink}, 0.10)` : `rgba(${lit}, 0.05)`);
    gr.addColorStop(1, dark ? `rgba(${ink}, 0)` : `rgba(${lit}, 0)`);
    g.fillStyle = gr;
    g.beginPath();
    g.ellipse(x, y, rx, rx * 0.5, 0, 0, Math.PI * 2);
    g.fill();
  }
  // 3. the flag seams: groove (ink) + a lit lip one pixel below-right
  const seam = (x0: number, y0: number, x1: number, y1: number): void => {
    g.lineWidth = 1;
    g.strokeStyle = `rgba(${ink}, 0.34)`;
    g.beginPath();
    g.moveTo(x0, y0);
    g.lineTo(x1, y1);
    g.stroke();
    g.strokeStyle = `rgba(${lit}, 0.07)`;
    g.beginPath();
    g.moveTo(x0, y0 + 1);
    g.lineTo(x1, y1 + 1);
    g.stroke();
  };
  for (let k = -3; k <= NT_COLS + 2; k++) {
    // lines of constant col (running down-left) and constant row (running down-right), on the half-tile
    const a = ntIso(k - 0.5, -4);
    const b = ntIso(k - 0.5, NT_ROWS + 3);
    seam(a.x, a.y, b.x, b.y);
  }
  for (let k = -4; k <= NT_ROWS + 3; k++) {
    const a = ntIso(-3, k - 0.5);
    const b = ntIso(NT_COLS + 2, k - 0.5);
    seam(a.x, a.y, b.x, b.y);
  }
  g.restore();
  ct.refresh();
  return NT_PLATE_TEX_KEY;
}

function ensureSmoothSlots(scene: Phaser.Scene): string {
  if (scene.textures.exists(NT_FLOOR_SMOOTH_KEY)) return NT_FLOOR_SMOOTH_KEY;
  // the zone line's extent inside its 64×32 box
  const line = buildCalmArt().masks.line;
  let x0 = 64;
  let x1 = -1;
  let y0 = 32;
  let y1 = -1;
  for (let j = 0; j < 32; j++)
    for (let i = 0; i < 64; i++)
      if (line.get(i, j) !== null) {
        x0 = Math.min(x0, i);
        x1 = Math.max(x1, i);
        y0 = Math.min(y0, j);
        y1 = Math.max(y1, j);
      }
  if (x1 < 0) return NT_FLOOR_KEY;
  const L = x0 + 0.5;
  const R = x1 + 0.5;
  const T = y0 + 0.5;
  const B = y1 + 0.5;
  const cx = (L + R) / 2;
  const cy = (T + B) / 2;

  const specs: { name: string; player: 0 | 1; state: number; boost: number }[] = [];
  for (const player of [0, 1] as const)
    for (const pile of [false, true])
      for (const state of pile ? [SLOT_EMPTY, SLOT_OCCUPIED] : [SLOT_EMPTY, SLOT_OCCUPIED, SLOT_DOWN])
        for (const boost of [0, 1]) specs.push({ name: FLOOR_FRAMES.slot(player, pile, state, boost), player, state, boost });
  const cols = 4;
  const W = cols * 64;
  const H = Math.ceil(specs.length / cols) * 32;
  const ct = scene.textures.createCanvas(NT_FLOOR_SMOOTH_KEY, W, H);
  if (!ct) return NT_FLOOR_KEY;
  const g = ct.getContext();
  g.clearRect(0, 0, W, H);
  g.lineJoin = 'round';
  const diamond = (inset: number): void => {
    g.beginPath();
    g.moveTo(cx, T + inset / 2);
    g.lineTo(R - inset, cy);
    g.lineTo(cx, B - inset / 2);
    g.lineTo(L + inset, cy);
    g.closePath();
  };
  specs.forEach((sp, k) => {
    const ramp = sp.player === 0 ? RAMPS.cyan : RAMPS.crim;
    const on = sp.state !== SLOT_EMPTY;
    const lit = on || sp.boost === 1;
    g.save();
    g.translate((k % cols) * 64, Math.floor(k / cols) * 32);
    // interior: a dark wash (empty) or a faint player tint (occupied)
    diamond(1.5);
    g.fillStyle = on ? `rgba(${rgbOf(ramp[0])}, 0.38)` : 'rgba(7, 7, 15, 0.16)';
    g.fill();
    // soft glow just around the line
    diamond(0);
    g.lineWidth = 3.2;
    g.strokeStyle = `rgba(${rgbOf(ramp[lit ? 3 : 2])}, ${on ? 0.26 : lit ? 0.17 : 0.11})`;
    g.stroke();
    // the line itself: thin, anti-aliased
    diamond(0);
    g.lineWidth = 1.1;
    g.strokeStyle = `rgba(${rgbOf(ramp[on ? 3 : 2])}, ${on ? 0.95 : lit ? 0.85 : 0.68})`;
    g.stroke();
    // face-down: four small studs at the diamond's tips
    if (sp.state === SLOT_DOWN) {
      g.fillStyle = `rgba(${rgbOf(PAL.steel)}, 0.9)`;
      for (const [px, py] of [
        [cx, T + 3],
        [R - 5, cy],
        [cx, B - 3],
        [L + 5, cy],
      ] as const) {
        g.beginPath();
        g.ellipse(px, py, 1.6, 0.9, 0, 0, Math.PI * 2);
        g.fill();
      }
    }
    g.restore();
  });
  ct.refresh();
  specs.forEach((sp, k) => ct.add(sp.name, 0, (k % cols) * 64, Math.floor(k / cols) * 32, 64, 32));
  return NT_FLOOR_SMOOTH_KEY;
}

export function registerFloorTextures(scene: Phaser.Scene): FloorArt {
  const art = buildFloorArt();
  ensureNtTexture(scene, 'floor', NT_FLOOR_KEY, () => art.atlas.canvas);
  const tex = scene.textures.get(NT_FLOOR_KEY);
  for (const [name, r] of art.atlas.frames) if (!tex.has(name)) tex.add(name, 0, r.x, r.y, r.w, r.h);
  registerApronTextures(scene);
  return art;
}

export function registerApronTextures(scene: Phaser.Scene): ApronArt {
  const art = buildApronArt();
  // arena v3 "floor and braziers": the apron is painted in final colours (./art/arena-nt/hallfloor.ts) — its own layer
  // name keeps it out of the navy lift (calm-remap LIFT_LAYERS), like the brick wall
  ensureNtTexture(scene, 'apron-v3', NT_APRON_KEY, () => art.canvas);
  ensureNtTexture(scene, 'apron-fx', NT_APRON_FX_KEY, () => art.fx.canvas);
  const tex = scene.textures.get(NT_APRON_FX_KEY);
  for (const [name, r] of art.fx.frames) if (!tex.has(name)) tex.add(name, 0, r.x, r.y, r.w, r.h);
  return art;
}

export function createFloorLayer(ctx: NtCtx): NtLayer {
  const scene = ctx.scene;
  const art = registerFloorTextures(scene);
  const apron = registerApronTextures(scene);
  ctx.add(scene.add.image(APRON_BOX.x, APRON_BOX.y, NT_APRON_KEY).setOrigin(0).setDepth(APRON_Z));
  const railImgs: Img[] = apron.strips.map((st) => ctx.add(scene.add.image(st.x, st.y, NT_APRON_FX_KEY, st.frame).setOrigin(0).setDepth(APRON_Z + 0.01).setVisible(false)));
  const lampImgs: Img[] = apron.lamps.map((l) => ctx.add(scene.add.image(l.x, l.y, TEX.px1).setOrigin(0).setScale(l.wide ? 2 : 1, 1).setDepth(APRON_Z + 0.02).setVisible(false)));

  interface Slot {
    img: Img;
    player: PlayerId;
    spot: BoardSpot;
    index: number;
    pile: boolean;
    state: number;
    boost: number;
    shown: string;
    /** arena v4 field seal: the theme it shows / lights toward, when that theme changed, the level it fades from */
    theme: SealTheme;
    themeAt: number;
    fromLv: number;
    lv: number;
  }
  // owner decision 2026-11-02: back to the fb7243b board top — the smooth stone-flag texture over the plate and the smooth,
  // thin slot lines (the pixel-dither version read as "dotted"). The thick stage, daises and side walls of h3 stay.
  // arena pass "board top" (2026-11-05, owner: calm clean slate, crisp 1-px borders, no anti-aliased canvas lines): the
  // smooth plate overlay and the smooth slot lines are retired (kept below for an A/B); the slots are the pixel atlas.
  void ensurePlateTexture;
  void ensureSmoothSlots;
  void PLATE_X0;
  void PLATE_Y0;
  const slotKey = NT_FLOOR_KEY;
  // arena v4: the banish pads are not drawn (BANISH_PAD: nothing is ever shown there — no empty inset holes)
  const slots: Slot[] = calmZones().filter((z) => BANISH_PAD || z.spot !== 'banish').map((z) => {
    const c = zoneXY(z.player, z.spot, z.index);
    const pile = z.spot !== 'monster' && z.spot !== 'spellTrap';
    const shown = frameOf(z.player, z.spot, pile, SLOT_EMPTY, 0, 'none', 0);
    const img = ctx.add(scene.add.image(c.x - 32, c.y - 16, slotKey, shown).setOrigin(0).setDepth(NT_DEPTH.floor + 0.25));
    return { img, player: z.player, spot: z.spot, index: z.index, pile, state: SLOT_EMPTY, boost: 0, shown, theme: 'none' as SealTheme, themeAt: -1e9, fromLv: 0, lv: 0 };
  });
  // arena v4 step 3: the non-play slots are raised pads (field seal, deck / graveyard plates), not inset tiles
  function frameOf(player: PlayerId, spot: BoardSpot, pile: boolean, state: number, boost: number, theme: SealTheme, lv: number): string {
    if (BOARD_V4 && spot === 'field') return theme === 'none' || lv <= 0 ? FLOOR_FRAMES.seal(player, 'none', 0, boost) : FLOOR_FRAMES.seal(player, theme, lv);
    if (BOARD_V4 && (spot === 'deck' || spot === 'graveyard')) return FLOOR_FRAMES.pile(player, spot, state === SLOT_EMPTY ? SLOT_EMPTY : SLOT_OCCUPIED, boost);
    return FLOOR_FRAMES.slot(player, pile, state, boost);
  }
  /** The face-up Field Spell's theme on a seal ('none' when empty / face-down). */
  const themeOf = (z: { player: PlayerId }, f: FieldView): SealTheme => {
    try {
      const e = f.entry(z.player, 'field', 0);
      return e && e.tile.faceUp ? fieldTheme(e.cardId) : 'none';
    } catch {
      return 'none';
    }
  };
  /**
   * The seal's light level (0 … 3) at time t: it ignites in stepped notches (0 → 1 → 2 → 3, 110 ms each) with a double flare
   * on top, then breathes slowly between 2 and 3 (each seal on its own phase); it goes out the same way down.
   */
  const sealLevel = (z: { theme: SealTheme; themeAt: number; fromLv: number; player: PlayerId }, t: number): number => {
    const k = t - z.themeAt;
    if (z.theme === 'none') return Math.max(0, z.fromLv - Math.floor(k / 110) - 1);
    if (k < 330) return Math.max(z.fromLv, Math.min(3, Math.floor(k / 110) + 1));
    if (k < 900) return Math.floor((k - 330) / 95) % 2 === 0 ? 3 : 2;
    const u = (((k - 900) / 2600 + z.player * 0.37) % 1 + 1) % 1;
    return u < 0.55 ? 3 : 2;
  };
  // the lit seal's light pool (ADD, white, tinted with the theme): it spreads round a card lying on the seal, 3 stepped bands
  const haloKey = ensureSealHalo(scene);
  const halos = new Map<object, Img>();
  for (const z of slots)
    if (BOARD_V4 && z.spot === 'field') {
      const c = zoneXY(z.player, 'field', 0);
      halos.set(z, ctx.add(scene.add.image(Math.round(c.x) - SEAL_HALO.w / 2, Math.round(c.y) - SEAL_HALO.h / 2, haloKey).setOrigin(0).setBlendMode(Phaser.BlendModes.ADD).setDepth(NT_DEPTH.floor + 0.32).setVisible(false)));
    }
  const haloShown = new Map<object, string>();
  const fieldView = (): FieldView | null => (scene as unknown as { views?: { field?: FieldView } }).views?.field ?? null;
  const stateOf = (z: Slot, f: FieldView): number => {
    try {
      if (z.spot === 'deck' || z.spot === 'graveyard') return f.pile(z.player, z.spot).count > 0 ? SLOT_OCCUPIED : SLOT_EMPTY;
      if (z.spot === 'banish') return SLOT_EMPTY;
      const e = f.entry(z.player, z.spot, z.index);
      if (!e) return SLOT_EMPTY;
      return e.tile.faceUp ? SLOT_OCCUPIED : SLOT_DOWN;
    } catch {
      return SLOT_EMPTY;
    }
  };
  // the theme a seal fades out in (it remembers its last lit theme)
  const fadeTheme = new Map<object, SealTheme>();
  const lastTheme = (z: object): SealTheme => fadeTheme.get(z) ?? 'gold';
  const liftUntil: [number, number] = [0, 0];
  let nextScan = 0;

  const emblem = ctx.add(scene.add.image(CENTER_EMBLEM.x, CENTER_EMBLEM.y, NT_FLOOR_KEY, FLOOR_FRAMES.emblem(0, 0)).setOrigin(0).setDepth(NT_DEPTH.floor + 0.1).setVisible(false));
  const dashes: Img[] = art.dashes.map((d, k) =>
    ctx.add(scene.add.image(d.x, d.y, NT_FLOOR_KEY, FLOOR_FRAMES.dash(k)).setOrigin(0).setDepth(NT_DEPTH.floor + 0.1).setVisible(false)),
  );
  let lights = true;
  let onAt = 0;
  let active: PlayerId | null = null;
  let now = 0;
  let pending: { until: number; done: () => void } | null = null;

  return {
    name: 'floor',
    owner: 'A1',
    setActivePlayer(p) {
      active = p;
    },
    setLights(on, animate) {
      lights = on;
      if (pending) {
        pending.done();
        pending = null;
      }
      if (!on) return Promise.resolve();
      onAt = now + (animate ? 900 : 0);
      if (!animate) return Promise.resolve();
      return new Promise<void>((done) => {
        pending = { until: onAt + 100, done };
      });
    },
    onGameEvent(ev: GameEvent) {
      if (ev.type !== 'summon' && ev.type !== 'attackDeclare') return;
      const p = (ev as { player?: PlayerId }).player;
      if (p === undefined) return;
      liftUntil[p] = now + 900;
      nextScan = 0;
    },
    tick(_dt, t) {
      now = t;
      if (t >= nextScan) {
        nextScan = t + 120;
        const f = fieldView();
        const lit = lights && t >= onAt;
        for (const z of slots) {
          const st = lit && f ? stateOf(z, f) : SLOT_EMPTY;
          const bo = lit && (active === z.player || t < liftUntil[z.player]) ? 1 : 0;
          z.state = st;
          z.boost = bo;
          if (BOARD_V4 && z.spot === 'field') {
            const th = lit && f ? themeOf(z, f) : 'none';
            if (th !== z.theme) {
              if (z.theme !== 'none') fadeTheme.set(z, z.theme);
              z.fromLv = z.lv;
              z.theme = th;
              z.themeAt = t;
            }
          }
        }
      }
      for (const z of slots) {
        if (BOARD_V4 && z.spot === 'field') z.lv = sealLevel(z, t);
        const name = frameOf(z.player, z.spot, z.pile, z.state, z.boost, z.theme === 'none' && z.lv > 0 ? lastTheme(z) : z.theme, z.lv);
        if (name !== z.shown) {
          z.img.setFrame(name);
          z.shown = name;
        }
        const halo = halos.get(z);
        if (halo) {
          const th = z.theme === 'none' ? lastTheme(z) : z.theme;
          const key = `${th}:${z.lv}`;
          if (haloShown.get(z) !== key) {
            haloShown.set(z, key);
            halo.setVisible(z.lv > 0 && th !== 'none');
            if (z.lv > 0 && th !== 'none') halo.setTint(SEAL_RAMP[th][2]).setAlpha([0, 0.4, 0.7, 1][z.lv]);
          }
        }
      }
      if (pending && t >= pending.until) {
        pending.done();
        pending = null;
      }
      emblem.setVisible(false);
      for (const img of railImgs) img.setVisible(false);
      for (const img of lampImgs) img.setVisible(false);
      for (const d of dashes) d.setVisible(false);
    },
    destroy() {
      if (pending) pending.done();
      pending = null;
    },
  };
}
