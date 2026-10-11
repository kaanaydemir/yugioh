// HD render — preview sheets for the volumetric sprite renderer (src/hd/render).
//
// Pure PixelCanvas builders (work in Node and the browser):
//   buildStageSheet(frame, f?, stages?)  albedo | normals | lit | final (outlined) | emissive | re-lit
//   buildAnimStrip(anim) / buildIdleStrip()   every frame of the demo's 'idle' (loop) or 'hit' (one-shot)
//   buildSamplerSheet()                  every material preset and primitive on its own
//   buildRenderPreview()                 stage sheet + idle strip stacked
// and a mount helper for the trial shell: mountRenderPreview(scene) adds a 4-stage sheet plus the
// live, normal-mapped, animated demo creature (Phaser Light2D) under two orbiting side lights.
// PNGs: node src/hd/render/tools/shots.mjs → shots/hd/render/.

import { PixelCanvas } from '../../art/pixel';
import { PAL } from '../../art/palette';
import { getFont, drawGlyph } from '../../art/font';
import { DEMO_ANCHOR, DEMO_ANIMS, DEMO_H, DEMO_IDLE_FRAMES, DEMO_W, renderDemo, type DemoAnim } from '../render/demo';
import { HDRenderer, MAT, bezier, relight, drawDropShadow, type HDRenderResult } from '../render';

const BG = PAL.night0;
const PANEL = PAL.night1;

/** Draw text with the game's small pixel font. */
export function label(p: PixelCanvas, text: string, x: number, y: number, color: number = PAL.mist): void {
  const f = getFont('sm');
  let cx = x;
  for (const ch of text) {
    const g = f.glyphs.get(ch.charCodeAt(0)) ?? f.glyphs.get('?'.charCodeAt(0));
    if (!g) {
      cx += f.def.spaceW + 1;
      continue;
    }
    drawGlyph(p, g, f.def.cellH, cx, y, color);
    cx += g.w + 1;
  }
}

function panel(p: PixelCanvas, x: number, y: number, w: number, h: number, checker = false): void {
  p.rect(x, y, w, h, PANEL);
  if (checker) for (let yy = 0; yy < h; yy += 8) for (let xx = (yy / 8) % 2 ? 8 : 0; xx < w; xx += 16) p.rect(x + xx, y + yy, 8, 8, PAL.night2);
  p.frame(x - 1, y - 1, w + 2, h + 2, PAL.night3);
}

/** Composite a frame over a panel (alpha-aware). */
function put(p: PixelCanvas, src: PixelCanvas, x: number, y: number): void {
  p.blit(src, x, y);
}

export type StageName = 'albedo' | 'normals' | 'lit' | 'final' | 'emissive' | 'relit';
const ALL_STAGES: StageName[] = ['albedo', 'normals', 'lit', 'final', 'emissive', 'relit'];
const STAGE_LABEL: Record<StageName, string> = {
  albedo: 'ALBEDO',
  normals: 'NORMALS',
  lit: 'LIT + RAMPS',
  final: 'FINAL: LINES + OUTLINE',
  emissive: 'EMISSIVE MASK',
  relit: 'NORMAL MAP RE-LIT',
};

/** Stage sheet for one frame of the demo creature (all six stages, or a subset). */
export function buildStageSheet(frame = 0, f: HDRenderResult = renderDemo(frame, { stages: true }), stages: readonly StageName[] = ALL_STAGES): PixelCanvas {
  const s = f.stages!;
  const cell = DEMO_W;
  const gap = 10;
  const top = 14;
  const cols = stages.length;
  const W = cols * cell + (cols + 1) * gap;
  const H = top + cell + gap * 2 + 12;
  const p = new PixelCanvas(W, H);
  p.rect(0, 0, W, H, BG);
  const relit = () =>
    relight(
      f,
      [
        { pos: [DEMO_W + 10, 40, 60], color: PAL.crim3, intensity: 1.1 },
        { pos: [-20, DEMO_H - 10, 50], color: PAL.cyan3, intensity: 0.9 },
      ],
      0x30365e,
      f.emissive,
    );
  const img: Record<StageName, () => PixelCanvas> = {
    albedo: () => s.albedo,
    normals: () => s.normal,
    lit: () => s.lit,
    final: () => s.final,
    emissive: () => f.emissive,
    relit,
  };
  stages.forEach((name, i) => {
    const x = gap + i * (cell + gap);
    panel(p, x, top, cell, cell, name === 'normals');
    if (name === 'final' || name === 'relit') drawDropShadow(p, [x + DEMO_ANCHOR[0], top + DEMO_ANCHOR[1]], 42, 9);
    put(p, img[name](), x, top);
    label(p, `${ALL_STAGES.indexOf(name) + 1} ${STAGE_LABEL[name]}`, x, 3);
  });
  label(p, `KURE GEZGINI 192x192  frame ${frame}  render ${f.ms.toFixed(1)} ms`, gap, top + cell + gap + 2, PAL.steel);
  return p;
}

/** Every frame of a demo animation on panels (with the 4-step drop shadow). */
export function buildAnimStrip(anim: DemoAnim = 'idle', cols = 6): PixelCanvas {
  const n = DEMO_ANIMS[anim].frames;
  const gap = 6;
  const rows = Math.ceil(n / cols);
  const W = cols * DEMO_W + (cols + 1) * gap;
  const H = rows * (DEMO_H + gap + 12) + gap;
  const p = new PixelCanvas(W, H);
  p.rect(0, 0, W, H, BG);
  for (let f = 0; f < n; f++) {
    const x = gap + (f % cols) * (DEMO_W + gap);
    const y = 12 + Math.floor(f / cols) * (DEMO_H + gap + 12);
    panel(p, x, y, DEMO_W, DEMO_H);
    drawDropShadow(p, [x + DEMO_ANCHOR[0], y + DEMO_ANCHOR[1]], 42, 9);
    const fr = renderDemo(f, { anim });
    put(p, fr.color, x, y);
    label(p, `${anim} ${f}  ${fr.ms.toFixed(1)}ms`, x, y - 11);
  }
  return p;
}

/** The 12-frame idle loop. */
export function buildIdleStrip(cols = 6): PixelCanvas {
  return buildAnimStrip('idle', cols);
}

/**
 * Library sampler: every material preset on a sphere-ish volume and every primitive on its own,
 * rendered through the full pipeline (lights, ramps, lines, outline). 80×80 cells.
 */
export function buildSamplerSheet(): PixelCanvas {
  const S = 80;
  const r = new HDRenderer(S, S);
  const cells: [string, (r: HDRenderer, t: number) => void][] = [
    ['iceHide', (r) => r.part('a').sphere([40, 42], 26, { mat: MAT.iceHide })],
    ['crystal gem', (r) => r.part('a').cutGem([40, 42], 27, 26, { mat: MAT.crystal, sides: 12, rings: [[0.82, 9], [0.56, 17], [0.3, 22]] })],
    ['glass', (r) => {
      r.part('a').sphere([30, 46], 18, { mat: MAT.iceHide });
      r.part('b').membrane([[14, 18], [66, 12], [70, 60], [24, 70]], { mat: MAT.glass, billow: -0.4 });
    }],
    ['gold', (r) => r.part('a').sphere([40, 42], 26, { mat: MAT.gold })],
    ['steel', (r) => r.part('a').sphere([40, 42], 26, { mat: MAT.steel })],
    ['charcoalFur', (r) => r.part('a').furCoat([40, 44], 26, 22, { mat: MAT.charcoalFur, spacing: 7, length: 13, width: 4.5, flow: [-0.6, 0.8], seed: 2 })],
    ['stone', (r) => r.part('a').gem([[16, 60], [12, 38], [28, 16], [54, 14], [68, 34], [64, 62]], { mat: MAT.stone, height: 18, table: 0.35 })],
    ['mouth', (r) => r.part('a').sphere([40, 42], 26, { mat: MAT.mouth })],
    ['flame', (r, t) => r.part('a', { outline: false }).flame({ mat: MAT.flame, spine: [[40, 72], [40, 12]], width: 14, t })],
    ['energy', (r) => r.part('a', { outline: false }).sphere([40, 42], 24, { mat: MAT.energy, heat: 'radial' })],
    ['eyeCyan', (r) => r.part('a').sphere([40, 42], 20, { mat: MAT.eyeCyan, heat: 'radial' })],
    ['eyeAmber', (r) => r.part('a').sphere([40, 42], 20, { mat: MAT.eyeAmber, heat: 'radial' })],
    ['tube rings', (r) => r.part('a').tube(bezier([8, 66], [20, 10], [60, 70], [72, 14], 16), (t) => 9 - t * 6, { mat: MAT.iceHide, rings: { every: 6, bias: -0.3 }, belly: { from: 0.4, mat: MAT.gold } })],
    ['tube facets', (r) => r.part('a').tube(bezier([10, 60], [30, 20], [50, 64], [70, 22], 16), 9, { mat: MAT.steel, facets: 4 })],
    ['shards', (r) => {
      const p = r.part('a');
      p.shard([20, 72], [14, 14], 7, { mat: MAT.crystal });
      p.shard([44, 74], [50, 8], 9, { mat: MAT.crystal, z: 3 });
      p.shard([62, 72], [72, 30], 6, { mat: MAT.crystal });
    }],
    ['cloth', (r, t) => {
      const top: [number, number][] = [];
      const bot: [number, number][] = [];
      for (let i = 0; i <= 8; i++) {
        top.push([10 + i * 7.5, 12 + Math.sin(i * 0.6) * 2]);
        bot.push([6 + i * 8.5, 68 + Math.sin(i * 0.9 + t * 6.28) * 3]);
      }
      r.part('a').cloth(top, bot, { mat: MAT.steel, folds: 2.5, depth: 0.7, phase: t * 6.28 });
    }],
    ['fur fringe', (r) => {
      const p = r.part('a');
      p.ellipsoid([40, 34], 26, 18, { mat: MAT.iceHide });
      p.furFringe(bezier([12, 36], [24, 64], [56, 64], [68, 36], 12), { mat: MAT.charcoalFur, count: 12, length: 16, width: 5, flow: [0, 1], comb: 0.4, seed: 4 });
    }],
    ['wisp', (r, t) => r.part('a', { outline: false }).wisp(bezier([16, 72], [10, 40], [60, 50], [56, 10], 12), 9, t, { mat: MAT.flame })],
    ['facet3 / gem', (r) => r.part('a').gem([[40, 8], [70, 30], [62, 70], [18, 70], [10, 30]], { mat: MAT.gold, height: 20, table: 0.4 })],
    ['ellipsoid rz', (r) => {
      const p = r.part('a');
      p.ellipsoid([28, 40], 18, 26, { mat: MAT.iceHide, angle: 0.4, rz: 8 });
      p.ellipsoid([54, 44], 16, 24, { mat: MAT.iceHide, angle: -0.3, rz: 30 });
    }],
    ['fur + fire mane', (r, t) => {
      r.part('body').furCoat([38, 50], 26, 17, { mat: MAT.charcoalFur, spacing: 6.5, length: 10, width: 4, flow: [-1, 0.35], seed: 9, lean: 0.45 });
      const p = r.part('mane', { lines: false, shadow: false, outline: false });
      for (let i = 0; i < 4; i++) {
        const x = 22 + i * 9;
        const y = 36 - Math.sin((i / 3) * Math.PI) * 4;
        p.wisp(bezier([x, y + 4], [x - 3, y - 6], [x - 10, y - 12], [x - 14 + i, y - 22 + i * 2], 8), 4.2 - i * 0.3, t + i * 0.23, { mat: MAT.flame, seed: 20 + i, sway: 3 });
      }
    }],
    ['wing: bones + glass', (r) => {
      const wr: [number, number] = [56, 22];
      const tips: [number, number][] = [[8, 12], [6, 40], [20, 66]];
      const p = r.part('wing');
      for (let i = 0; i < tips.length; i++) {
        const a = tips[i];
        const b = i + 1 < tips.length ? tips[i + 1] : ([58, 58] as [number, number]);
        const mid: [number, number] = [(a[0] + b[0]) / 2 * 0.6 + wr[0] * 0.4, (a[1] + b[1]) / 2 * 0.6 + wr[1] * 0.4];
        p.membrane([wr, ...bezier(a, mid, b, undefined, 8)], { mat: MAT.glass, billow: -0.35, bias: 0.1 - i * 0.08 });
      }
      for (const tip of tips) p.tube(bezier(wr, [(wr[0] + tip[0]) / 2, (wr[1] + tip[1]) / 2 - 4], tip, undefined, 8), (u) => 2.4 - u * 1.6, { mat: MAT.iceHide, z: 3 });
      p.tube([[74, 40], [64, 30], wr], [3.4, 3, 2.6], { mat: MAT.iceHide, z: 4 });
      p.detail((d) => {
        for (let i = 0; i < tips.length; i++) {
          const a = tips[i];
          const b = i + 1 < tips.length ? tips[i + 1] : ([58, 58] as [number, number]);
          const m: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
          d.line([wr[0] + (m[0] - wr[0]) * 0.25, wr[1] + (m[1] - wr[1]) * 0.25], [wr[0] + (m[0] - wr[0]) * 0.8, wr[1] + (m[1] - wr[1]) * 0.8], PAL.cyan4, { emissive: true });
        }
      });
    }],
    ['parts + lines', (r) => {
      r.part('back').sphere([30, 34], 20, { mat: MAT.iceHide });
      r.part('front').sphere([48, 50], 20, { mat: MAT.iceHide });
      r.part('top').capsule([16, 66], [66, 20], 6, 4, { mat: MAT.gold });
    }],
  ];
  const cols = 7;
  const gap = 4;
  const lab = 11;
  const rows = Math.ceil(cells.length / cols);
  const p = new PixelCanvas(cols * (S + gap) + gap, rows * (S + gap + lab) + gap);
  p.rect(0, 0, p.w, p.h, BG);
  cells.forEach(([name, fn], i) => {
    const x = gap + (i % cols) * (S + gap);
    const y = lab + Math.floor(i / cols) * (S + gap + lab);
    panel(p, x, y, S, S);
    r.begin();
    fn(r, 0.25);
    const f = r.finish();
    p.blit(f.color, x, y);
    label(p, name, x + 1, y - 10);
  });
  return p;
}

/** Stage sheet + idle strip stacked. */
export function buildRenderPreview(frame = 0): PixelCanvas {
  const a = buildStageSheet(frame);
  const b = buildIdleStrip(6);
  const W = Math.max(a.w, b.w);
  const p = new PixelCanvas(W, a.h + b.h);
  p.rect(0, 0, W, p.h, BG);
  p.blit(a, 0, 0);
  p.blit(b, 0, a.h);
  return p;
}

/**
 * Mount into a Phaser scene (for the trial shell): a 4-stage sheet at 1× (normals | lit | final |
 * re-lit) and the live, animated demo creature lit by Light2D through its normal maps, under two
 * orbiting side lights (P1 cyan, P2 crimson). Returns a cleanup function.
 */
export function mountRenderPreview(scene: Phaser.Scene, o: { x?: number; y?: number } = {}): () => void {
  const sheet = buildStageSheet(0, undefined, ['normals', 'lit', 'final', 'relit']);
  const key = 'hd-render-sheet';
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, sheet.toCanvas());
  const W = scene.scale.width;
  const H = scene.scale.height;
  const img = scene.add.image(o.x ?? Math.round((W - sheet.w) / 2), o.y ?? 6, key).setOrigin(0, 0);

  // live creature: one texture per frame, its normal map attached as the data source
  const frames: string[] = [];
  for (let f = 0; f < DEMO_IDLE_FRAMES; f++) {
    const fr = renderDemo(f);
    const fk = `hd-render-demo-${f}`;
    if (scene.textures.exists(fk)) scene.textures.remove(fk);
    const tex = scene.textures.addCanvas(fk, fr.color.toCanvas());
    tex?.setDataSource(fr.normal.toCanvas());
    frames.push(fk);
  }
  const sx = Math.round(W / 2);
  const sy = Math.min(H - DEMO_H - 4, img.y + sheet.h + 6);
  const spr = scene.add.image(sx - DEMO_ANCHOR[0], sy, frames[0]).setOrigin(0, 0).setPipeline('Light2D');
  scene.lights.enable().setAmbientColor(0x6a70a0);
  const cx = sx;
  const cy = sy + DEMO_H * 0.55;
  const cyan = scene.lights.addLight(cx - 120, cy + 40, 300, PAL.cyan3, 1.6);
  const crim = scene.lights.addLight(cx + 120, cy - 60, 300, PAL.crim3, 1.6);
  let t = 0;
  const onUpdate = (_time: number, dt: number) => {
    t += dt;
    spr.setTexture(frames[Math.floor(t / 100) % DEMO_IDLE_FRAMES]);
    const a = t / 1600;
    cyan.setPosition(cx + Math.cos(a + Math.PI) * 150, cy + Math.sin(a + Math.PI) * 70);
    crim.setPosition(cx + Math.cos(a) * 150, cy + Math.sin(a) * 70);
  };
  scene.events.on('update', onUpdate);
  return () => {
    scene.events.off('update', onUpdate);
    img.destroy();
    spr.destroy();
    scene.lights.removeLight(cyan);
    scene.lights.removeLight(crim);
  };
}
