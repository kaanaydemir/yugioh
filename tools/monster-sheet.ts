// Monster animation sheets for art review (v3 A2) — every frame of every animation of a monster,
// rendered in Node exactly like the game draws its sheet frames (src/art/textures.ts
// drawMonsterFrame: a fresh PixelCanvas(w, h) + art.draw / art.drawExtra), with per-frame hold
// times, marks and the A2 art metrics (docs/v3/A0_ENVANTER.md §6.2 items 7–8).
//
//   npx vite-node tools/monster-sheet.ts --id crystal_wyrm [options]
//
//   --id a[,b]         monster id(s) (src/data/cards.ts MONSTER_IDS), or "all"
//   --look v1|v3       which art: v1 (default) = src/art/monsters/<id>.ts; v3 = the ?look=v3 art
//                      (src/art/monsters-v3/<id>.ts when it exists, else the v1 art: a clean
//                      fallback, reported as "v1 art (no v3 file)"). Sets globalThis.__NEON_LOOK
//                      before the art registry is imported, like the game does from ?look=v3.
//   --anims a,b|all|none   animations to draw (default all = the base five + the art's extras, in
//                      sheet order); "none" = only --still
//   --p2               player 2's view: frames drawn with { lightFrom: 'right' } when the art says
//                      p2: 'relight' (else the P1 frames: 'mirror'), shown mirrored as on screen.
//                      Metrics (bbox, points) stay in the frame's own, unmirrored coordinates.
//   --scale N          strip scale (default 3, nearest neighbour)
//   --sheet-scale N    scale of the all-anims contact sheet (default min(scale, 2))
//   --cols N           frames per strip row before wrapping (default 12)
//   --points           mark the per-frame points (art.points(); the fixed muzzle / core without it)
//   --still            also write idle f0 next to the hand-painted still map (src/still/*-map.ts,
//                      crystal_wyrm and abyss_magus only) at ×3, in the still scene's orientation
//                      (wyrm as P1, magus as P2 mirrored), + silhouette IoU / colours / isolated px
//   --out DIR          output directory (default shots/monster-sheet)
//   --art FILE         draw a MonsterArt module outside the registry instead (its default export;
//                      e.g. a draft, or a test art); --id may then be omitted (taken from art.id),
//                      the label says "file <name>"
//
// Files (in DIR; <tag> = <id>-<look>[-p2]):
//   <tag>-<anim>.png   strip of all frames ×scale on the calm floor tone (PAL.night1); every frame
//                      sits in a 1-px frame-boundary box (PAL.night3; an edge the drawing touches is
//                      drawn PAL.crim3) under a header in the game's pixel font (src/art/font.ts sm):
//                      frame index, hold ms, and the names of the marks on that frame
//   <tag>-all.png      contact sheet: one row per animation
//   <tag>.txt / .json  per-frame table (hold, start ms, marks, bbox, margin, edge px, isolated px,
//                      Δ to the previous frame) and the per-anim summary printed below
//   <id>-<look>-still.png   (--still) game idle f0 | still map, ×3 and ×1
//
// Printed per animation: frames, total ms, marks, bbox per frame + holds (second line), the smallest
// frame-edge margin (0 = the drawing touches the frame edge; A2 rule: no frame may), the
// isolated-pixel count (opaque pixels without a same-coloured 4-neighbour: speckle measure; max
// and mean per frame), and the pose-pop metric: Δ = pixels that differ between two frames (colour or
// opacity); idleΔ = mean Δ of consecutive idle frames (loop seam included); out = Δ(last frame,
// idle f0) / idleΔ (toGuard: vs guard f0) — the A2 criterion is out ≤ 1.2; in = Δ(idle f0,
// first frame) / idleΔ (how hard the anim starts); seam = Δ(last, f0) / the loop's own mean Δ
// for looping anims. death has no out (the body is gone); victory ends on a held pose (shown,
// not judged).
//
// The PNG encoder is the one of tools/neon-still.ts (copied: that file runs on import).

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { pathToFileURL } from 'node:url';
import { animLengthMs, animList, animSpec, frameMs, frameStartMs, isExtraAnim } from '../src/art/animtime';
import { drawGlyph, getFont, hasGlyph } from '../src/art/font';
import { PAL } from '../src/art/palette';
import { PixelCanvas } from '../src/art/pixel';
import type { AnimMark, AnimSpec, AnyMonsterAnim, DrawOpts, MonsterArt, MonsterPointName } from '../src/art/types';
import { ANIM_MARKS, MONSTER_POINT_NAMES } from '../src/art/types';

// ---------------------------------------------------------------- args

const argv = process.argv.slice(2).filter((a: string) => a !== '--');
const arg = (k: string): string | undefined => {
  const i = argv.indexOf(`--${k}`);
  return i >= 0 && argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[i + 1] : undefined;
};
const flag = (k: string): boolean => argv.includes(`--${k}`);
const intArg = (k: string, d: number): number => {
  const v = arg(k);
  const n = v === undefined ? d : Math.floor(Number(v));
  if (!Number.isFinite(n) || n < 1) throw new Error(`--${k} must be a positive integer (got ${v})`);
  return n;
};

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const LOOK_ARG = arg('look') ?? 'v1';
if (LOOK_ARG !== 'v1' && LOOK_ARG !== 'v3') throw new Error(`--look must be v1 or v3 (got ${LOOK_ARG})`);
const P2 = flag('p2');
const SCALE = intArg('scale', 3);
const SHEET_SCALE = intArg('sheet-scale', Math.min(SCALE, 2));
const COLS = intArg('cols', 12);
const POINTS = flag('points');
const STILL = flag('still');
const OUT = path.resolve(ROOT, arg('out') ?? 'shots/monster-sheet');
const ANIMS_ARG = arg('anims') ?? 'all';
const ART_FILE = arg('art');
if (!arg('id') && !ART_FILE) {
  console.error('usage: npx vite-node tools/monster-sheet.ts --id crystal_wyrm [--look v3] [--anims all] [--p2] [--scale 3] [--points] [--still] [--out DIR]');
  process.exit(1);
}

// The look is decided once when src/view/layout.ts is first evaluated (LOOK_V3): set the global
// BEFORE the art registry (and anything importing layout.ts) is loaded.
(globalThis as { __NEON_LOOK?: string }).__NEON_LOOK = LOOK_ARG;
const { MONSTER_IDS } = await import('../src/data/cards');
const registry = await import('../src/art/monsters');
const { LOOK } = await import('../src/view/layout');
if (LOOK !== LOOK_ARG) throw new Error(`layout.ts LOOK is ${LOOK}, wanted ${LOOK_ARG} (was it imported before the global was set?)`);

type MonsterId = (typeof MONSTER_IDS)[number];
const fileArt: MonsterArt | null = ART_FILE ? ((await import(pathToFileURL(path.resolve(ART_FILE)).href)) as { default: MonsterArt }).default : null;
if (ART_FILE && !fileArt?.id) throw new Error(`--art ${ART_FILE}: no default-exported MonsterArt`);
const ids: MonsterId[] = fileArt ? [fileArt.id] : arg('id') === 'all' ? [...MONSTER_IDS] : (arg('id')!.split(',').map((s) => s.trim()) as MonsterId[]);
for (const id of ids) if (!MONSTER_IDS.includes(id)) throw new Error(`unknown monster id ${id} (known: ${MONSTER_IDS.join(', ')})`);
fs.mkdirSync(OUT, { recursive: true });

// ---------------------------------------------------------------- PNG (tools/neon-still.ts)

const CRC_T = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

/** Write `p` ×k (nearest) as an RGBA PNG; transparent pixels get `bg` (or stay transparent). */
function png(p: PixelCanvas, k: number, bg: number | null, file: string): void {
  const W = p.w * k;
  const H = p.h * k;
  const raw = Buffer.alloc((W * 4 + 1) * H);
  for (let y = 0; y < H; y++) {
    raw[y * (W * 4 + 1)] = 0;
    for (let x = 0; x < W; x++) {
      const sx = Math.floor(x / k);
      const sy = Math.floor(y / k);
      const a = p.alpha(sx, sy);
      let c = p.get(sx, sy);
      let alpha = 255;
      if (a === 0 || c === null) {
        if (bg === null) alpha = 0;
        c = bg ?? 0;
      } else if (a < 255 && bg !== null) {
        const t = a / 255;
        const m = (s: number) => Math.round(((c! >> s) & 255) * t + ((bg >> s) & 255) * (1 - t));
        c = (m(16) << 16) | (m(8) << 8) | m(0);
      }
      const i = y * (W * 4 + 1) + 1 + x * 4;
      raw[i] = (c >> 16) & 255;
      raw[i + 1] = (c >> 8) & 255;
      raw[i + 2] = c & 255;
      raw[i + 3] = alpha;
    }
  }
  const crc = (b: Buffer) => {
    let c = 0xffffffff;
    for (const v of b) c = CRC_T[(c ^ v) & 255] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (t: string, d: Buffer) => {
    const l = Buffer.alloc(4);
    l.writeUInt32BE(d.length);
    const td = Buffer.concat([Buffer.from(t, 'ascii'), d]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([l, td, c]);
  };
  const ih = Buffer.alloc(13);
  ih.writeUInt32BE(W, 0);
  ih.writeUInt32BE(H, 4);
  ih[8] = 8;
  ih[9] = 6;
  const data = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ih),
    chunk('IDAT', zlib.deflateSync(raw, { level: 6 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  fs.writeFileSync(path.join(OUT, file), data);
}

// ---------------------------------------------------------------- pixel font (src/art/font.ts sm)

const FONT = getFont('sm');
const TEXT_H = FONT.def.cellH;

function textWidth(s: string, k: number): number {
  let w = 0;
  for (const ch of s) w += ((FONT.glyphs.get((hasGlyph(ch) ? ch : '?').charCodeAt(0))?.w ?? 3) + 1) * k;
  return Math.max(0, w - k);
}

/** Draw `s` with its cell top-left at (x, y), every font pixel a k×k block. Returns the width. */
function text(p: PixelCanvas, x: number, y: number, s: string, c: number, k = 1): number {
  let pen = x;
  for (const raw of s) {
    const ch = hasGlyph(raw) ? raw : '?';
    const g = FONT.glyphs.get(ch.charCodeAt(0));
    if (!g) continue;
    if (k === 1) drawGlyph(p, g, TEXT_H, pen, y, c);
    else for (let j = 0; j < TEXT_H; j++) for (let i = 0; i < g.w; i++) if (g.bits[j * g.w + i]) p.rect(pen + i * k, y + j * k, k, k, c);
    pen += (g.w + 1) * k;
  }
  return pen - x;
}

// ---------------------------------------------------------------- frames + metrics

/** One frame as the game draws it (textures.ts drawMonsterFrame). */
function drawFrame(art: MonsterArt, anim: AnyMonsterAnim, frame: number, o?: DrawOpts): PixelCanvas {
  const p = new PixelCanvas(art.w, art.h);
  const spec = animSpec(art, anim)!;
  const f = Math.min(frame, spec.frames - 1);
  if (isExtraAnim(anim)) art.drawExtra!(p, anim, f, o);
  else if (o) art.draw(p, anim, f, o);
  else art.draw(p, anim, f);
  return p;
}

/** Pixels that differ between two same-size frames (colour or opacity; two transparent = same). */
function delta(a: PixelCanvas, b: PixelCanvas): number {
  let n = 0;
  const A = a.data;
  const B = b.data;
  for (let i = 0; i < A.length; i += 4) {
    if (A[i + 3] === 0 && B[i + 3] === 0) continue;
    if (A[i] !== B[i] || A[i + 1] !== B[i + 1] || A[i + 2] !== B[i + 2] || A[i + 3] !== B[i + 3]) n++;
  }
  return n;
}

/** Opaque pixels whose opaque 4-neighbours all have another colour (tools/neon-still.ts). */
function isolated(p: PixelCanvas): number {
  let n = 0;
  for (let y = 0; y < p.h; y++)
    for (let x = 0; x < p.w; x++) {
      const c = p.get(x, y);
      if (c === null) continue;
      let same = false;
      let any = false;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const d = p.get(x + dx, y + dy);
        if (d === null) continue;
        any = true;
        if (d === c) same = true;
      }
      if (any && !same) n++;
    }
  return n;
}

function colours(p: PixelCanvas): number {
  const s = new Set<number>();
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
    const c = p.get(x, y);
    if (c !== null) s.add(c);
  }
  return s.size;
}

type Edge = 'L' | 'T' | 'R' | 'B';
interface FrameInfo {
  frame: number;
  holdMs: number;
  startMs: number;
  marks: string[];
  bbox: { x: number; y: number; w: number; h: number } | null;
  /** smallest distance (px) from the drawing to a frame edge; 0 = touches */
  margin: number | null;
  touches: Edge[];
  /** opaque pixels on the outermost frame rows / columns */
  edgePx: number;
  isolated: number;
  opaque: number;
  /** Δ to the previous frame (frame 0: to the last frame for loops, else null) */
  deltaPrev: number | null;
  points: Partial<Record<MonsterPointName, { x: number; y: number }>>;
}

function frameInfo(p: PixelCanvas): Pick<FrameInfo, 'bbox' | 'margin' | 'touches' | 'edgePx' | 'isolated' | 'opaque'> {
  const bbox = p.bounds();
  let edgePx = 0;
  for (let x = 0; x < p.w; x++) {
    if (p.isOpaque(x, 0)) edgePx++;
    if (p.h > 1 && p.isOpaque(x, p.h - 1)) edgePx++;
  }
  for (let y = 1; y < p.h - 1; y++) {
    if (p.isOpaque(0, y)) edgePx++;
    if (p.w > 1 && p.isOpaque(p.w - 1, y)) edgePx++;
  }
  const touches: Edge[] = [];
  let margin: number | null = null;
  if (bbox) {
    const m = { L: bbox.x, T: bbox.y, R: p.w - (bbox.x + bbox.w), B: p.h - (bbox.y + bbox.h) };
    margin = Math.min(m.L, m.T, m.R, m.B);
    for (const e of ['L', 'T', 'R', 'B'] as Edge[]) if (m[e] === 0) touches.push(e);
  }
  return { bbox, margin, touches, edgePx, isolated: isolated(p), opaque: p.coverage() };
}

/** Mark names on frame f (attack's 'impact' falls back to attackImpactFrame, like animtime.impactFrame). */
function marksAt(art: MonsterArt, anim: AnyMonsterAnim, spec: AnimSpec, f: number): string[] {
  const out: string[] = [];
  for (const m of ANIM_MARKS) if (spec.marks?.[m as AnimMark] === f) out.push(m);
  if (anim === 'attack' && spec.marks?.impact === undefined && art.attackImpactFrame === f) out.push('impact*');
  return out;
}

const POINT_COL: Record<MonsterPointName, number> = {
  muzzle: PAL.gold3,
  core: PAL.cyan3,
  head: PAL.mag3,
  hand: PAL.teal3,
  staff: PAL.gold4,
  claw: PAL.crim3,
  feet: PAL.leaf3,
  grip: PAL.water3,
};

function pointsOf(art: MonsterArt, anim: AnyMonsterAnim, f: number): FrameInfo['points'] {
  const explicit = art.points?.(anim, f) ?? {};
  const out: FrameInfo['points'] = {};
  for (const n of MONSTER_POINT_NAMES) if (explicit[n]) out[n] = { x: explicit[n]!.x, y: explicit[n]!.y };
  if (!art.points) {
    out.core = { x: art.core.x, y: art.core.y };
    if (anim === 'attack') out.muzzle = { x: art.muzzle.x, y: art.muzzle.y };
  }
  return out;
}

// ---------------------------------------------------------------- drawing helpers

const BG = PAL.ink;
const FLOOR = PAL.night1;
const BOX = PAL.night3;
const BOX_TOUCH = PAL.crim3;
const TXT = PAL.mist;
const TXT_DIM = PAL.steel;
const TXT_MARK = PAL.gold3;
const TXT_BAD = PAL.crim3;

/** Nearest-neighbour blit of `src` ×k at (x, y) (optionally mirrored). */
function blitScaled(dst: PixelCanvas, src: PixelCanvas, x: number, y: number, k: number, flipX = false): void {
  for (let sy = 0; sy < src.h; sy++)
    for (let sx = 0; sx < src.w; sx++) {
      const a = src.alpha(sx, sy);
      if (!a) continue;
      const c = src.get(sx, sy)!;
      const dx = flipX ? src.w - 1 - sx : sx;
      for (let j = 0; j < k; j++) for (let i = 0; i < k; i++) dst.set(x + dx * k + i, y + sy * k + j, c, a);
    }
}

/** A frame ×k on the floor tone inside a 1-px boundary box (touched edges in red); returns the box size. */
function frameCell(dst: PixelCanvas, fr: PixelCanvas, x: number, y: number, k: number, touches: Edge[], flipX: boolean, pts?: FrameInfo['points']): void {
  const w = fr.w * k;
  const h = fr.h * k;
  dst.rect(x + 1, y + 1, w, h, FLOOR);
  blitScaled(dst, fr, x + 1, y + 1, k, flipX);
  // the box (screen sides: a mirrored frame's L/R edges swap)
  const side = (e: Edge): Edge => (flipX && e === 'L' ? 'R' : flipX && e === 'R' ? 'L' : e);
  const t = new Set(touches.map(side));
  dst.hline(x, x + w + 1, y, t.has('T') ? BOX_TOUCH : BOX);
  dst.hline(x, x + w + 1, y + h + 1, t.has('B') ? BOX_TOUCH : BOX);
  dst.vline(x, y, y + h + 1, t.has('L') ? BOX_TOUCH : BOX);
  dst.vline(x + w + 1, y, y + h + 1, t.has('R') ? BOX_TOUCH : BOX);
  if (pts) {
    for (const [n, q] of Object.entries(pts) as [MonsterPointName, { x: number; y: number }][]) {
      const px = flipX ? fr.w - 1 - Math.round(q.x) : Math.round(q.x);
      const py = Math.round(q.y);
      // a ring one pixel-cell around the point's cell
      dst.frame(x + 1 + (px - 1) * k, y + 1 + (py - 1) * k, 3 * k, 3 * k, POINT_COL[n]);
    }
  }
}

// ---------------------------------------------------------------- per monster

interface AnimReport {
  anim: AnyMonsterAnim;
  frames: number;
  fps: number;
  loop: boolean;
  totalMs: number;
  holds: number[];
  marks: Record<string, number>;
  minMargin: number | null;
  touchFrames: number[];
  maxEdgePx: number;
  isolatedMax: number;
  isolatedMean: number;
  /** Δ(idle f0, f0) / idleΔ */
  popIn: number | null;
  /** Δ(last, idle f0 | guard f0) / idleΔ */
  popOut: number | null;
  popOutPx: number | null;
  popOutVs: 'idle f0' | 'guard f0' | null;
  /** loops: Δ(last, f0) / mean Δ of the loop */
  seam: number | null;
  meanDelta: number | null;
  info: FrameInfo[];
}

const r2 = (v: number) => Math.round(v * 100) / 100;

function reportAnim(art: MonsterArt, anim: AnyMonsterAnim, o: DrawOpts | undefined, idle: PixelCanvas[], guard0: PixelCanvas, idleMean: number): { rep: AnimReport; frames: PixelCanvas[] } {
  const spec = animSpec(art, anim)!;
  const frames = Array.from({ length: spec.frames }, (_, f) => drawFrame(art, anim, f, o));
  const info: FrameInfo[] = frames.map((p, f) => ({
    frame: f,
    holdMs: r2(frameMs(spec, f)),
    startMs: r2(frameStartMs(spec, f)),
    marks: marksAt(art, anim, spec, f),
    ...frameInfo(p),
    deltaPrev: f > 0 ? delta(frames[f - 1], p) : spec.loop && spec.frames > 1 ? delta(frames[spec.frames - 1], p) : null,
    points: pointsOf(art, anim, f),
  }));
  const deltas = info.map((i) => i.deltaPrev).filter((v): v is number => v !== null);
  const meanDelta = deltas.length ? deltas.reduce((a, b) => a + b, 0) / deltas.length : null;
  const last = frames[frames.length - 1];
  let popOutVs: AnimReport['popOutVs'] = null;
  let popOutPx: number | null = null;
  if (!spec.loop && anim !== 'death') {
    popOutVs = anim === 'toGuard' ? 'guard f0' : 'idle f0';
    popOutPx = delta(last, anim === 'toGuard' ? guard0 : idle[0]);
  }
  const iso = info.map((i) => i.isolated);
  const margins = info.map((i) => i.margin).filter((v): v is number => v !== null);
  const marks: Record<string, number> = { ...(spec.marks ?? {}) } as Record<string, number>;
  if (anim === 'attack' && marks.impact === undefined) marks['impact*'] = art.attackImpactFrame;
  const rep: AnimReport = {
    anim,
    frames: spec.frames,
    fps: spec.fps,
    loop: spec.loop,
    totalMs: r2(animLengthMs(spec)),
    holds: info.map((i) => i.holdMs),
    marks,
    minMargin: margins.length ? Math.min(...margins) : null,
    touchFrames: info.filter((i) => i.touches.length).map((i) => i.frame),
    maxEdgePx: Math.max(...info.map((i) => i.edgePx)),
    isolatedMax: Math.max(...iso),
    isolatedMean: r2(iso.reduce((a, b) => a + b, 0) / iso.length),
    popIn: anim === 'idle' || !idleMean ? null : r2(delta(idle[0], frames[0]) / idleMean),
    popOut: popOutPx === null || !idleMean ? null : r2(popOutPx / idleMean),
    popOutPx,
    popOutVs,
    seam: spec.loop && meanDelta ? r2(delta(last, frames[0]) / meanDelta) : null,
    meanDelta: meanDelta === null ? null : r2(meanDelta),
    info,
  };
  return { rep, frames };
}

/** Strip PNG of one animation (wrapped after COLS frames). */
function stripPng(art: MonsterArt, title: string, rep: AnimReport, frames: PixelCanvas[], file: string): void {
  const k = SCALE;
  const tk = k >= 3 ? 2 : 1; // header text scale
  const M = 6;
  const cellW = art.w * k + 2;
  const cellH = art.h * k + 2;
  const headH = (TEXT_H * 2 + 1) * tk + 2;
  const cols = Math.min(COLS, frames.length);
  const rows = Math.ceil(frames.length / cols);
  const gap = 4 * tk;
  const titleH = TEXT_H * tk + 4;
  const W = Math.max(M * 2 + cols * cellW + (cols - 1) * gap, M * 2 + textWidth(title, tk));
  const H = M * 2 + titleH + rows * (headH + cellH) + (rows - 1) * gap;
  const img = new PixelCanvas(W, H);
  img.rect(0, 0, W, H, BG);
  text(img, M, M, title, TXT, tk);
  frames.forEach((fr, f) => {
    const i = rep.info[f];
    const x = M + (f % cols) * (cellW + gap);
    const y = M + titleH + Math.floor(f / cols) * (headH + cellH + gap);
    let w = text(img, x, y, `f${f}`, i.touches.length ? TXT_BAD : TXT, tk);
    w += text(img, x + w + 3 * tk, y, `${Math.round(i.holdMs)}ms`, TXT_DIM, tk) + 3 * tk;
    // screen sides (a mirrored P2 frame swaps L / R; the .txt keeps the frame's own sides)
    const sides = i.touches.map((e) => (P2 && e === 'L' ? 'R' : P2 && e === 'R' ? 'L' : e));
    if (i.touches.length) text(img, x + w + 3 * tk, y, `EDGE ${sides.join('')}`, TXT_BAD, tk);
    if (i.marks.length) text(img, x, y + TEXT_H * tk + tk, i.marks.join(' '), TXT_MARK, tk);
    frameCell(img, fr, x, y + headH, k, i.touches, P2, POINTS ? i.points : undefined);
  });
  png(img, 1, BG, file);
}

/** Contact sheet: one row per animation, a label column on the left. */
function sheetPng(art: MonsterArt, title: string, reps: { rep: AnimReport; frames: PixelCanvas[] }[], file: string): void {
  const k = SHEET_SCALE;
  const tk = 1;
  const M = 6;
  const cellW = art.w * k + 2;
  const cellH = art.h * k + 2;
  const headH = TEXT_H * tk + 1;
  const gap = 3;
  const labelW = 64;
  const titleH = TEXT_H + 4;
  const maxFrames = Math.max(...reps.map((r) => r.frames.length));
  const W = Math.max(M * 2 + labelW + maxFrames * (cellW + gap), M * 2 + textWidth(title, tk));
  const H = M * 2 + titleH + reps.length * (headH + cellH + gap * 2);
  const img = new PixelCanvas(W, H);
  img.rect(0, 0, W, H, BG);
  text(img, M, M, title, TXT, tk);
  reps.forEach(({ rep, frames }, r) => {
    const y = M + titleH + r * (headH + cellH + gap * 2);
    text(img, M, y + headH, rep.anim, TXT, tk);
    text(img, M, y + headH + TEXT_H, `${rep.frames}f ${Math.round(rep.totalMs)}ms`, TXT_DIM, tk);
    if (rep.popOut !== null) text(img, M, y + headH + TEXT_H * 2, `out ${rep.popOut}`, rep.popOut > 1.2 ? TXT_BAD : TXT_DIM, tk);
    if (rep.touchFrames.length) text(img, M, y + headH + TEXT_H * 3, 'EDGE', TXT_BAD, tk);
    frames.forEach((fr, f) => {
      const i = rep.info[f];
      const x = M + labelW + f * (cellW + gap);
      text(img, x, y, `${f} ${Math.round(i.holdMs)}${i.marks.length ? ` ${i.marks.join(' ')}` : ''}`, i.marks.length ? TXT_MARK : TXT_DIM, tk);
      frameCell(img, fr, x, y + headH, k, i.touches, P2, POINTS ? i.points : undefined);
    });
  });
  png(img, 1, BG, file);
}

// ---------------------------------------------------------------- still comparison

/** Alpha-mask IoU of two canvases placed so that their anchors coincide. */
function iouAligned(a: PixelCanvas, ax: number, ay: number, b: PixelCanvas, bx: number, by: number): number {
  const ox = ax - bx;
  const oy = ay - by; // b pixel (x, y) sits at a pixel (x + ox, y + oy)
  let inter = 0;
  let uni = 0;
  const x0 = Math.min(0, ox);
  const y0 = Math.min(0, oy);
  const x1 = Math.max(a.w, b.w + ox);
  const y1 = Math.max(a.h, b.h + oy);
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      const A = a.isOpaque(x, y);
      const B = b.isOpaque(x - ox, y - oy);
      if (A && B) inter++;
      if (A || B) uni++;
    }
  return uni ? inter / uni : 1;
}

async function stillCompare(id: MonsterId, art: MonsterArt, artLabel: string, lines: string[]): Promise<void> {
  const STILLS: Partial<Record<MonsterId, { load: () => Promise<(p: PixelCanvas) => void>; flip: boolean }>> = {
    crystal_wyrm: { load: async () => (await import('../src/still/wyrm')).drawWyrm, flip: false },
    abyss_magus: { load: async () => (await import('../src/still/magus')).drawMagus, flip: true },
  };
  const s = STILLS[id];
  if (!s) {
    const l = `${id}: --still: no still map (only crystal_wyrm and abyss_magus have one)`;
    console.log(l);
    lines.push(l);
    return;
  }
  // the map was painted over the v1 idle f0: its geometry is the v1 art's
  const v1 = registry.monsterArtV1(id);
  const map = new PixelCanvas(v1.w, v1.h);
  (await s.load())(map);
  // the still shows the wyrm as P1 and the magus as P2 (mirrored; its map is lit from the frame's
  // top-right, i.e. like a 'relight' P2 frame): draw the game frame the same way
  const relit = s.flip && art.p2 === 'relight';
  const game = drawFrame(art, 'idle', 0, relit ? { lightFrom: 'right' } : undefined);
  const k = 3;
  const M = 6;
  const gap = 12;
  const titleH = TEXT_H * 2 + 6;
  const w = Math.max(game.w, map.w);
  const h = Math.max(game.h, map.h);
  const W = M * 2 + 2 * (w * k + 2) + gap + 2 * (w + 2) + gap * 2;
  const H = M * 2 + titleH + h * k + 2;
  const img = new PixelCanvas(W, H);
  img.rect(0, 0, W, H, BG);
  const how = s.flip ? `P2 view (mirrored${relit ? ', relight frame' : art.p2 === 'relight' ? '' : ', mirror: P1 frame'})` : 'P1 view';
  text(img, M, M, `${id} idle f0 (${artLabel}) | still map (src/still)  ×3 and ×1, ${how}`, TXT, 1);
  // bottom-align both on their anchors (the ground line)
  const base = M + titleH + 1;
  const place = (p: PixelCanvas, anchorY: number) => base + (Math.max(art.anchorY, v1.anchorY) - anchorY) * k;
  const xs = [M, M + w * k + 2 + gap];
  frameCell(img, game, xs[0], place(game, art.anchorY), k, [], s.flip);
  frameCell(img, map, xs[1], place(map, v1.anchorY), k, [], s.flip);
  const x1 = xs[1] + w * k + 2 + gap * 2;
  frameCell(img, game, x1, base + (Math.max(art.anchorY, v1.anchorY) - art.anchorY), 1, [], s.flip);
  frameCell(img, map, x1 + w + 2 + gap, base + (Math.max(art.anchorY, v1.anchorY) - v1.anchorY), 1, [], s.flip);
  text(img, xs[0], M + TEXT_H + 2, 'game', TXT_DIM, 1);
  text(img, xs[1], M + TEXT_H + 2, 'still map', TXT_DIM, 1);
  const file = `${id}-${fileArt ? 'file' : LOOK_ARG}-still.png`;
  png(img, 1, BG, file);
  const iou = iouAligned(game, art.anchorX, art.anchorY, map, v1.anchorX, v1.anchorY);
  // pixels opaque in both (anchor-aligned) whose colour differs: how far the game frame is from the map
  let both = 0;
  let recol = 0;
  for (let y = 0; y < map.h; y++)
    for (let x = 0; x < map.w; x++) {
      const m = map.get(x, y);
      const g = game.get(x + art.anchorX - v1.anchorX, y + art.anchorY - v1.anchorY);
      if (m === null || g === null) continue;
      both++;
      if (m !== g) recol++;
    }
  const bb = (b: ReturnType<PixelCanvas['bounds']>) => (b ? `${b.w}x${b.h}@${b.x},${b.y}` : '-');
  const l = `${id} still: game idle f0 (${artLabel}${relit ? ', lightFrom right' : ''}) frame ${game.w}x${game.h} bbox ${bb(game.bounds())} px ${game.coverage()} colours ${colours(game)} isolated ${isolated(game)} | still map frame ${map.w}x${map.h} bbox ${bb(map.bounds())} px ${map.coverage()} colours ${colours(map)} isolated ${isolated(map)} | silhouette IoU (anchor-aligned) ${iou.toFixed(3)} | colour differs on ${recol}/${both} shared px (${((100 * recol) / Math.max(1, both)).toFixed(1)}%) → ${file}`;
  console.log(l);
  lines.push(l);
}

// ---------------------------------------------------------------- run

const summary: Record<string, unknown> = {};
for (const id of ids) {
  const art = fileArt ?? registry.monsterArt(id);
  const hasV3 = registry.hasMonsterArtV3(id);
  const artLabel = fileArt ? `file ${path.basename(ART_FILE!)}` : LOOK_ARG === 'v3' ? (hasV3 ? 'v3 art' : 'v1 art (no v3 file)') : 'v1 art';
  const relight = P2 && art.p2 === 'relight';
  const o: DrawOpts | undefined = relight ? { lightFrom: 'right' } : undefined;
  const view = P2 ? (relight ? 'P2 relight' : 'P2 mirror') : 'P1';
  const tag = `${id}-${fileArt ? 'file' : LOOK_ARG}${P2 ? '-p2' : ''}`;
  const all = animList(art);
  let anims: AnyMonsterAnim[];
  if (ANIMS_ARG === 'all') anims = all;
  else if (ANIMS_ARG === 'none') anims = [];
  else {
    const want = ANIMS_ARG.split(',').map((s) => s.trim()) as AnyMonsterAnim[];
    for (const a of want) if (!all.includes(a)) console.log(`${id}: no '${a}' animation in the ${artLabel} (has: ${all.join(', ')}) — skipped`);
    anims = all.filter((a) => want.includes(a)); // sheet order
  }
  const lines: string[] = [];
  const head = `${id} — ${artLabel}, ${view}, frame ${art.w}x${art.h}, anchor ${art.anchorX},${art.anchorY}, hover ${art.hover}, weight ${art.weight ?? '-'}, p2 ${art.p2 ?? 'mirror'}, points() ${art.points ? 'yes' : 'no'}; anims: ${all.join(', ')}`;
  console.log(head);
  lines.push(head);

  // idle (and guard f0) are the reference of the pose-pop metric, whatever --anims says
  const idleSpec = art.anims.idle;
  const idle = Array.from({ length: idleSpec.frames }, (_, f) => drawFrame(art, 'idle', f, o));
  const idleDs = idle.length > 1 ? idle.map((p, f) => delta(p, idle[(f + 1) % idle.length])) : [0];
  const idleMean = idleDs.reduce((a, b) => a + b, 0) / idleDs.length;
  const guard0 = drawFrame(art, 'guard', 0, o);
  const idleLine = `  idleΔ ${r2(idleMean)} px (consecutive idle frames incl. the loop seam: ${idleDs.join(' ')}); idle f0 opaque ${idle[0].coverage()} px; idle f0 → guard f0 Δ ${delta(idle[0], guard0)} px = ${idleMean ? r2(delta(idle[0], guard0) / idleMean) : '-'}× idleΔ`;
  console.log(idleLine);
  lines.push(idleLine);

  const reps: { rep: AnimReport; frames: PixelCanvas[] }[] = [];
  for (const anim of anims) {
    const r = reportAnim(art, anim, o, idle, guard0, idleMean);
    reps.push(r);
    const { rep } = r;
    const marks = Object.entries(rep.marks).map(([m, f]) => `${m}@${f}`).join(' ') || '-';
    const pop =
      rep.popOut !== null
        ? `out ${rep.popOut}× (${rep.popOutPx} px vs ${rep.popOutVs})${rep.popOut > 1.2 ? ' POP' : ''}`
        : rep.anim === 'death'
          ? 'out - (death)'
          : 'out - (loop)';
    const l = `  ${rep.anim.padEnd(9)} ${String(rep.frames).padStart(2)} f ${String(Math.round(rep.totalMs)).padStart(5)} ms ${rep.loop ? 'loop' : 'once'}  marks ${marks}  margin ${rep.minMargin ?? '-'}${rep.touchFrames.length ? ` EDGE in f${rep.touchFrames.join(',')}` : ''} (edge px max ${rep.maxEdgePx})  isolated max ${rep.isolatedMax} mean ${rep.isolatedMean}  pop in ${rep.popIn ?? '-'}× ${pop}${rep.seam !== null ? `  seam ${rep.seam}×` : ''}`;
    // bbox per frame (w×h@x,y in the frame's own coordinates) + hold ms
    const bl = `            bbox ${rep.info.map((i) => `${i.frame}:${i.bbox ? `${i.bbox.w}x${i.bbox.h}@${i.bbox.x},${i.bbox.y}` : '-'}`).join(' ')}  holds ${rep.holds.map((h) => Math.round(h)).join('/')}`;
    console.log(l);
    console.log(bl);
    lines.push(l, bl);
    const title = `${id} ${rep.anim} — ${artLabel}, ${view}, ${rep.frames} f, ${Math.round(rep.totalMs)} ms, ${rep.loop ? 'loop' : 'once'}, x${SCALE}`;
    stripPng(art, title, rep, r.frames, `${tag}-${rep.anim}.png`);
  }
  if (reps.length) sheetPng(art, `${id} — ${artLabel}, ${view}, all animations x${SHEET_SCALE}`, reps, `${tag}-all.png`);

  // per-frame table
  lines.push('', 'per frame: anim f | hold ms | start ms | marks | bbox w×h@x,y | margin | touches | edge px | isolated | opaque | Δprev | points');
  for (const { rep } of reps)
    for (const i of rep.info)
      lines.push(
        `  ${rep.anim.padEnd(9)} ${String(i.frame).padStart(2)} | ${String(i.holdMs).padStart(6)} | ${String(i.startMs).padStart(7)} | ${(i.marks.join(',') || '-').padEnd(10)} | ${i.bbox ? `${i.bbox.w}x${i.bbox.h}@${i.bbox.x},${i.bbox.y}` : '-'} | ${i.margin ?? '-'} | ${i.touches.join('') || '-'} | ${i.edgePx} | ${i.isolated} | ${i.opaque} | ${i.deltaPrev ?? '-'} | ${Object.entries(i.points).map(([n, q]) => `${n} ${q.x},${q.y}`).join(' ') || '-'}`,
      );
  if (STILL) {
    lines.push('');
    await stillCompare(id, art, artLabel, lines);
  }
  fs.writeFileSync(path.join(OUT, `${tag}.txt`), lines.join('\n') + '\n');
  const json = {
    tool: 'tools/monster-sheet.ts',
    id,
    look: LOOK_ARG,
    art: fileArt ? `file ${ART_FILE}` : hasV3 && LOOK_ARG === 'v3' ? 'v3' : 'v1',
    view,
    frame: { w: art.w, h: art.h, anchorX: art.anchorX, anchorY: art.anchorY, hover: art.hover },
    weight: art.weight ?? null,
    p2: art.p2 ?? 'mirror',
    idle: { meanDelta: r2(idleMean), deltas: idleDs, guardSwapDelta: delta(idle[0], guard0) },
    anims: Object.fromEntries(reps.map(({ rep }) => [rep.anim, rep])),
  };
  fs.writeFileSync(path.join(OUT, `${tag}.json`), JSON.stringify(json, null, 1));
  summary[id] = { anims: reps.length };
  console.log(`[monster-sheet] ${id}: ${reps.length} strip(s)${reps.length ? `, ${tag}-all.png` : ''}, ${tag}.txt/.json${STILL ? `, ${id}-${fileArt ? 'file' : LOOK_ARG}-still.png` : ''} → ${path.relative(ROOT, OUT) || '.'}`);
}
