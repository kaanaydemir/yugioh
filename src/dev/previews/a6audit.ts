// ?dev=a6audit&s=<scenario> — the duel scene on a staged scenario (as ?dev=duel) with the A6 crispness
// audit (docs/v3/A6_PLAN.md §4.1, §6.3; KO-1 / KO-2): on every frame it counts the visible images in
// the UI depth band (DEPTH.HUD … DEPTH.INSPECT: the HUD, the hand and the cards flown at hand depth)
// that are rotated, fractionally scaled or drawn at a fractional position, and publishes the tally
// on window.__neon.a6audit. Target for every A6 key: 0 (no allow-list).
//
//   node tools/shot.mjs "?dev=a6audit&s=a6Hover&look=v3" --fresh --film 24 --every 50 \
//     --eval "console.log(JSON.stringify(window.__neon.a6audit.summary()))"
//
// &kit=1 instead shows the shared A56.0 UI kit live (src/art/frame-v3.ts, src/view/v3/ui-kit.ts):
// card / plate frames, a running rim node, closing target corners, the reject stamp, a monster's
// current-frame contour (contourOf) and stamped text — the lanes' reference page.
//
// Query: &s=<key> (without: the scenario list of ?dev=duel), &lo= / &hi= the depth band
// (default 2000 / 2200), &all=1 every depth. Images, sprites and bitmap texts inside containers are
// judged by their world transform (container scale / rotation included) on the camera that draws them.
// The tally starts at the duel's (re)start: __neon.a6audit.reset() starts it again (e.g. at t = 0).

import type Phaser from 'phaser';
import type { DevPreview } from '../types';
import { DEPTH } from '../../view/layout';
import { PAL } from '../../art/palette';
import { PixelCanvas } from '../../art/pixel';
import { frameRectV3, trimV3 } from '../../art/frame-v3';
import { monsterAnimKey, monsterFrameName, monsterTextureKey } from '../../art/textures';
import { brackets, plateFrame, rejectStamp, rimRect, showContour, stampText } from '../../view/v3/ui-kit';
import { pixelText } from '../../ui/text';
import { SCENARIOS } from '../../duel/scenarios';
import { duelReady } from '../../scenes/DuelScene';
import type { DuelMode } from '../../scenes/launch';
import duelPreview from './duel';

interface AuditSample {
  frame: number;
  type: string;
  key: string;
  depth: number;
  x: number;
  y: number;
  rot: number;
  sx: number;
  sy: number;
  why: string;
}

interface Audit {
  lo: number;
  hi: number;
  frames: number;
  /** Visible images judged (summed over frames). */
  checked: number;
  /** Violations (an object counts once per frame, with all its reasons). */
  bad: number;
  rot: number;
  scale: number;
  pos: number;
  /** The first 40 violations. */
  samples: AuditSample[];
  reset(): void;
  summary(): { frames: number; checked: number; bad: number; rot: number; scale: number; pos: number; lo: number; hi: number };
}

const EPS = 1e-3;
const frac = (v: number) => Math.abs(v - Math.round(v)) > EPS;
const nonInt = (v: number) => Math.abs(v) < EPS || frac(Math.abs(v));

type Judged = Phaser.GameObjects.Image | Phaser.GameObjects.Sprite | Phaser.GameObjects.BitmapText;

function isJudged(o: Phaser.GameObjects.GameObject): o is Judged {
  return o.type === 'Image' || o.type === 'Sprite' || o.type === 'BitmapText';
}

function install(duel: Phaser.Scene, lo: number, hi: number): Audit {
  const a: Audit = {
    lo,
    hi,
    frames: 0,
    checked: 0,
    bad: 0,
    rot: 0,
    scale: 0,
    pos: 0,
    samples: [],
    reset() {
      this.frames = 0;
      this.checked = 0;
      this.bad = 0;
      this.rot = 0;
      this.scale = 0;
      this.pos = 0;
      this.samples = [];
    },
    summary() {
      return { frames: this.frames, checked: this.checked, bad: this.bad, rot: this.rot, scale: this.scale, pos: this.pos, lo: this.lo, hi: this.hi };
    },
  };
  const judge = (o: Judged, topDepth: number) => {
    const alpha = (o as { alpha?: number }).alpha ?? 1;
    if (!o.visible || alpha <= 0) return;
    a.checked++;
    const m = o.getWorldTransformMatrix();
    const rot = Math.atan2(m.b, m.a);
    const sx = Math.hypot(m.a, m.b);
    const sy = Math.hypot(m.c, m.d);
    // the top-left corner of the drawn frame in world space, then on the camera that draws it
    const ox = -o.displayOriginX;
    const oy = -o.displayOriginY;
    let x = m.a * ox + m.c * oy + m.tx;
    let y = m.b * ox + m.d * oy + m.ty;
    const cam = duel.cameras.main;
    x -= cam.scrollX * o.scrollFactorX;
    y -= cam.scrollY * o.scrollFactorY;
    const why: string[] = [];
    if (Math.abs(rot) > EPS) {
      why.push('rot');
      a.rot++;
    }
    if (nonInt(sx) || nonInt(sy)) {
      why.push('scale');
      a.scale++;
    }
    if (frac(x) || frac(y)) {
      why.push('pos');
      a.pos++;
    }
    if (!why.length) return;
    a.bad++;
    if (a.samples.length < 40)
      a.samples.push({ frame: a.frames, type: o.type, key: o.texture?.key ?? '', depth: topDepth, x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100, rot: Math.round(rot * 1000) / 1000, sx: Math.round(sx * 1000) / 1000, sy: Math.round(sy * 1000) / 1000, why: why.join('+') });
  };
  // top-level objects decide the band by their depth; a container's children inherit it
  const walk = (list: Phaser.GameObjects.GameObject[], topDepth: number | null) => {
    for (const o of list) {
      const depth = topDepth ?? (o as { depth?: number }).depth ?? 0;
      const band = depth >= lo && depth < hi;
      if (o.type === 'Container') {
        const c = o as Phaser.GameObjects.Container;
        if (c.visible && c.alpha > 0) walk(c.list, depth);
        continue;
      }
      if (band && isJudged(o)) judge(o, depth);
    }
  };
  const onFrame = () => {
    a.frames++;
    walk(duel.children.list, null);
  };
  // the duel scene's own event emitter survives restarts (__neon.duel.restart, --fresh films)
  duel.events.on('postupdate', onFrame);
  duel.events.on('create', () => a.reset());
  return a;
}

/** &kit=1: the A56.0 UI kit, live (a reference page for the lanes; see the header). */
function kitPage(scene: Phaser.Scene): void {
  scene.cameras.main.setBackgroundColor(PAL.night2);
  pixelText(scene, 8, 4, 'A56.0 UI KIT — frame-v3 · ui-kit (palette only, whole pixels)', { size: 'sm', color: PAL.gold4 }).setDepth(DEPTH.DEBUG);
  // static painters
  const st = new PixelCanvas(640, 120);
  frameRectV3(st, 8, 16, 48, 68, 'monster');
  frameRectV3(st, 60, 16, 48, 68, 'monster', { ace: true });
  frameRectV3(st, 112, 16, 48, 68, 'spell');
  frameRectV3(st, 164, 16, 48, 68, 'trap');
  frameRectV3(st, 216, 16, 48, 68, 'p1');
  frameRectV3(st, 268, 16, 48, 68, 'p2', { cut: 2 });
  plateFrame(st, 324, 16, 112, 20, 'p1');
  plateFrame(st, 324, 40, 112, 20, 'p1', { step: -1 });
  plateFrame(st, 324, 64, 112, 20, 'p1', { step: -2 });
  frameRectV3(st, 444, 16, 96, 28, trimV3('p2', 1));
  for (const t of [0, 1, 2]) rejectStamp(st, 456 + t * 14, 64, { tone: t });
  scene.textures.addImage('a6audit:kit:static', st.toCanvas() as unknown as HTMLImageElement);
  scene.add.image(0, 14, 'a6audit:kit:static').setOrigin(0);
  // live painters: a rim whose node runs (2.4 s a lap), corners closing 4 → 0 px in three steps
  const live = scene.textures.createCanvas('a6audit:kit:live', 240, 70)!;
  const buf = new PixelCanvas(240, 70);
  const place = scene.add.image(8, 140, 'a6audit:kit:live').setOrigin(0);
  void place;
  let el = 0;
  scene.events.on('update', (_t: number, dt: number) => {
    el += dt;
    buf.clear();
    rimRect(buf, 2, 2, 110, 30, PAL.cyan2, { node: { t: (el % 2400) / 2400, head: PAL.white, tail: [PAL.cyan4, PAL.cyan3] } });
    const step = Math.floor((el % 1200) / 150);
    const gap = step < 4 ? 4 - Math.min(4, Math.round((step * 4) / 3)) : 0;
    brackets(buf, 140, 14, 40, 36, PAL.gold3, { gap, joint: step === 3 ? PAL.white : undefined });
    live.context.putImageData(buf.toImageData(), 0, 0);
    live.refresh();
  });
  // a monster's current-frame contour, re-taken on every frame change of its idle
  const id = 'storm_hawk';
  const spr = scene.add.sprite(352, 196, monsterTextureKey(id), monsterFrameName('idle', 0)).setOrigin(0.5, 1).setDepth(10);
  let ring: { destroy(): void } | null = null;
  const retake = () => {
    ring?.destroy();
    ring = showContour(scene, spr, PAL.gold3, { depth: 9 });
  };
  spr.on('animationupdate', retake);
  spr.play({ key: monsterAnimKey(id, 'idle'), repeat: -1 });
  retake();
  // stamped text, again every 2 s
  let stamp: { text: Phaser.GameObjects.BitmapText } | null = null;
  const restamp = () => {
    stamp?.text.destroy();
    stamp = stampText(scene, 420, 150, 'DÜELLO! · TUR 4', { size: 'md', color: PAL.gold3 });
  };
  restamp();
  scene.time.addEvent({ delay: 2000, loop: true, callback: restamp });
}

const preview: DevPreview = {
  name: 'a6audit',
  description: 'A6 crispness audit on a staged duel scenario (&s=<key>): rotated / fractional UI images per frame → __neon.a6audit',
  async create(scene, params) {
    if (params.get('kit') === '1') return kitPage(scene);
    const name = params.get('s') ?? '';
    if (!SCENARIOS[name]) {
      await duelPreview.create(scene, params);
      return;
    }
    const all = params.get('all') === '1';
    const lo = all ? -Infinity : Number(params.get('lo') ?? DEPTH.HUD);
    const hi = all ? Infinity : Number(params.get('hi') ?? DEPTH.INSPECT);
    const ready = duelReady();
    const game = scene.game;
    scene.scene.start('Duel', {
      mode: (params.get('mode') as DuelMode | null) ?? 'hotseat',
      curtain: false,
      skipIntro: true,
      stage: SCENARIOS[name].stage,
      speed: params.get('speed') ? Number(params.get('speed')) : undefined,
      scenario: name,
      filmScenario: params.has('test'),
    });
    await ready;
    const duel = game.scene.getScene('Duel');
    (window.__neon as unknown as Record<string, unknown>).a6audit = install(duel, lo, hi);
  },
};

export default preview;
