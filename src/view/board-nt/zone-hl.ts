// Arena v4 step 4 (8c): the hover / selection highlight of the NON-PLAY zones follows their own shape. The field seal (a flat hex)
// and the deck / graveyard pads (small raised diamonds) are not 64 × 32 tiles any more, so the calm arena's tile-diamond outline
// round them read as a phantom sixth tile. Same language as the calm highlight (BoardViewCalm.highlightZone): the outline takes
// the colour in three stepped notches, the interior a dark tone of it, four chevrons lock on from outside and breathe, a 3-px
// light runs round the outline. Drawn from white masks of each shape (art/arena-nt/floor.ts zoneShapeMask). BOARD_V4 only.

import type Phaser from 'phaser';
import { type ZoneShape, ZONE_SHAPE_HALF, zoneShapeMask } from '../../art/arena-nt/floor';
import { PAL, RAMPS } from '../../art/palette';
import type { Color } from '../../art/pixel';
import type { PlayerId } from '../../engine/types';
import { type BoardSpot, DEPTH, zoneXY } from '../layout';
import { CALM } from '../board-calm/art';
import { TEX } from '../../vfx/core';
import { ensureNtTexture } from './textures';

type Img = Phaser.GameObjects.Image;

const NEUTRAL: readonly Color[] = [PAL.ink, PAL.night0, PAL.night1, PAL.night2, PAL.night3, PAL.night4, PAL.steel, PAL.mist, PAL.white];
const HUES: readonly (readonly Color[])[] = Object.entries(RAMPS)
  .filter(([k]) => k !== 'night')
  .map(([, r]) => r);

function rampOf(c: Color): { ramp: readonly Color[]; i: number } {
  for (const r of [NEUTRAL, ...HUES]) {
    const i = r.indexOf(c);
    if (i >= 0) return { ramp: r, i };
  }
  return { ramp: NEUTRAL, i: NEUTRAL.length - 1 };
}
const step = (c: Color, k: number): Color => {
  const { ramp, i } = rampOf(c);
  return ramp[Math.max(0, Math.min(ramp.length - 1, i + k))];
};
const dark = (c: Color): Color => {
  const { ramp } = rampOf(c);
  return ramp === NEUTRAL ? PAL.night2 : ramp[0];
};

/** Does this zone get a shaped highlight (the field seal, the deck / graveyard pads)? */
export function shapedZone(spot: BoardSpot): ZoneShape | null {
  return spot === 'field' ? 'seal' : spot === 'deck' || spot === 'graveyard' ? 'pile' : null;
}

interface Hl {
  shape: ZoneShape;
  x: number;
  y: number;
  color: Color;
  fill: Img;
  line: Img;
  tips: Img[];
  march: Img[];
  path: { x: number; y: number }[];
  k: number;
  dying: boolean;
  born: number;
}

const D = { fill: DEPTH.TILE_FX, line: DEPTH.TILE_FX + 1, march: DEPTH.TILE_FX + 2, tips: DEPTH.TILE_FX + 3 } as const;

export class ShapedHighlights {
  private readonly map = new Map<string, Hl>();
  private readonly keys: Record<ZoneShape, { line: string; fill: string; path: { x: number; y: number }[] }>;
  private t = 0;

  constructor(private readonly scene: Phaser.Scene) {
    const mk = (s: ZoneShape) => {
      const line = zoneShapeMask(s, 'line');
      // the outline in walking order (angle round the centre: the shapes are convex)
      const pts: { x: number; y: number; a: number }[] = [];
      for (let j = 0; j < line.h; j++) for (let i = 0; i < line.w; i++) if (line.alpha(i, j) > 0) pts.push({ x: i, y: j, a: Math.atan2((j + 0.5 - 16) * 2, i + 0.5 - 32) });
      pts.sort((p, q) => p.a - q.a);
      return {
        line: ensureNtTexture(scene, 'react', `nt:hl:line:${s}`, () => line),
        fill: ensureNtTexture(scene, 'react', `nt:hl:fill:${s}`, () => zoneShapeMask(s, 'fill')),
        path: pts.map(({ x, y }) => ({ x, y })),
      };
    };
    this.keys = { slot: mk('slot'), seal: mk('seal'), pile: mk('pile') };
  }

  set(player: PlayerId, spot: BoardSpot, index: number, color: number | null): void {
    const key = `${player}:${spot}:${index}`;
    const cur = this.map.get(key);
    if (color === null) {
      if (cur) cur.dying = true;
      return;
    }
    if (cur) {
      cur.dying = false;
      cur.color = color;
      return;
    }
    const shape = shapedZone(spot);
    if (!shape) return;
    const c = zoneXY(player, spot, index);
    const x = Math.round(c.x);
    const y = Math.round(c.y);
    const K = this.keys[shape];
    const sc = this.scene;
    const h: Hl = {
      shape,
      x,
      y,
      color,
      fill: sc.add.image(x - 32, y - 16, K.fill).setOrigin(0).setDepth(D.fill),
      line: sc.add.image(x - 32, y - 16, K.line).setOrigin(0).setDepth(D.line),
      tips: [
        sc.add.image(0, 0, CALM.atlas, CALM.tipT).setOrigin(0).setDepth(D.tips),
        sc.add.image(0, 0, CALM.atlas, CALM.tipT).setOrigin(0).setDepth(D.tips).setFlipY(true),
        sc.add.image(0, 0, CALM.atlas, CALM.tipL).setOrigin(0).setDepth(D.tips),
        sc.add.image(0, 0, CALM.atlas, CALM.tipL).setOrigin(0).setDepth(D.tips).setFlipX(true),
      ],
      march: [0, 1, 2].map(() => sc.add.image(0, 0, TEX.px1).setOrigin(0).setDepth(D.march)),
      path: K.path,
      k: 0,
      dying: false,
      born: this.t,
    };
    this.map.set(key, h);
    this.update(h, 0);
  }

  clear(): void {
    for (const h of this.map.values()) h.dying = true;
  }

  tick(dt: number): void {
    this.t += dt;
    for (const [key, h] of this.map) if (!this.update(h, dt)) this.map.delete(key);
  }

  destroy(): void {
    for (const h of this.map.values()) this.kill(h);
    this.map.clear();
  }

  private kill(h: Hl): void {
    for (const o of [h.fill, h.line, ...h.tips, ...h.march]) o.destroy();
  }

  private update(h: Hl, dt: number): boolean {
    h.k = Math.max(0, Math.min(1, h.k + (h.dying ? -dt / 110 : dt / 130)));
    if (h.dying && h.k <= 0) {
      this.kill(h);
      return false;
    }
    const c = h.color;
    const age = this.t - h.born;
    const stage = h.k < 0.34 ? 0 : h.k < 0.67 ? 1 : 2;
    h.line.setTint(step(c, stage - 2));
    h.fill.setVisible(stage > 0).setTint(dark(c));
    const settle = h.dying ? 1 - h.k : Math.max(0, 1 - age / 220);
    const d = 2 + Math.round(1 - Math.cos(age / 190) + settle * settle * 6);
    const half = ZONE_SHAPE_HALF[h.shape];
    // chevron frames as the calm arena's (tipT 18 wide, 5 tall at the shape's top / bottom tip; tipL 9 wide at its side tips)
    const pos = [
      { x: h.x - 9, y: h.y - half.h - d },
      { x: h.x - 9, y: h.y + half.h - 5 + d },
      { x: h.x - half.w - 2 * d, y: h.y - 5 },
      { x: h.x + half.w - 9 + 2 * d, y: h.y - 5 },
    ];
    h.tips.forEach((t, i) => t.setPosition(pos[i].x, pos[i].y).setTint(stage === 2 ? c : step(c, -1)).setVisible(stage > 0));
    const L = h.path;
    const head = Math.floor(age * 0.06) % L.length;
    h.march.forEach((m, i) => {
      const q = L[(head - i + L.length) % L.length];
      m.setPosition(h.x - 32 + q.x, h.y - 16 + q.y)
        .setTint(step(c, i === 0 ? 1 : 0))
        .setVisible(stage === 2);
    });
    return true;
  }
}
