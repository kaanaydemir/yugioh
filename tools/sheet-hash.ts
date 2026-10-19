// Monster sheet fingerprints — sha256 of every frame of every monster sheet, rendered in Node.
//
//   npx vite-node tools/sheet-hash.ts [--out FILE] [--compare OLD.json] [--note "text"]
//                                       (default FILE: shots/sheet-hashes.json)
//
// For each of the 12 monsters (src/data/cards.ts MONSTER_IDS, art from src/art/monsters) every
// frame of every animation is drawn into a fresh PixelCanvas exactly like src/art/textures.ts
// does for the game's sheets (monsterFrame: new PixelCanvas(w, h) + art.draw(p, anim, frame)), and
// the RGBA bytes are hashed. The JSON holds, per monster: frame size, anchor / muzzle / core,
// attackImpactFrame, the sheet grid the game builds (cols × rows, ≤ 4096 px wide), per animation
// its spec (frames, fps, loop, and holds / marks once the A1 contract has them) and one hash per
// frame, a hash of the whole sheet (all frames in game order) and of the card portrait.
// Optional parts of the v3 contract are fingerprinted separately when a monster has them, so the
// five base animations stay comparable: `extra` (extraAnims via drawExtra) and `p2` (the P2
// 'relight' sheet: drawn with { lightFrom: 'right' }).
//
// Every frame is drawn twice, the second time in reverse order: `deterministic: false` means the
// art depends on draw order / hidden state (the game always builds sheets in forward order).
//
// --compare OLD.json prints every frame whose pixels changed (and spec / size changes) and exits
// with code 2 if any base frame differs — the A1 "old monsters stay pixel-identical" gate:
//   npx vite-node tools/sheet-hash.ts --out /tmp/now.json --compare shots/v3/a1/baseline/sheet-hashes.json
//
// --look v3 (A3 Y0, docs/v3/A3_MIMARI.md §13): fingerprint the v3 art instead — only the monsters that
// HAVE v3 art (src/art/monsters-v3/<id>.ts, the art ?look=v3 draws), each with its base anims, its
// extra anims, its P2 'relight' sheet and (when the art has points()) a hash of its per-frame points;
// the reverse-order determinism check covers the extra and P2 frames too. globalThis.__NEON_LOOK is
// set before the art registry is imported, like the game does from ?look=v3 (default FILE:
// shots/sheet-hashes-v3.json). Its --compare is strict: ANY difference of a fingerprinted monster
// (base, extra or P2 frame, spec, holds, marks, points, portrait, size, anchor, determinism) exits 2;
// a monster with v3 art that the old file does not have yet is listed but not a failure (a new v3
// monster joins the baseline when it is rewritten), one that disappeared is a failure. Comparing a
// v1 file with a v3 run (or the reverse) exits 2. Without --look (= --look v1) nothing changes:
//   npx vite-node tools/sheet-hash.ts --out /tmp/v1.json --compare shots/v3/a3/baseline/sheet-hashes-v1.json
//   npx vite-node tools/sheet-hash.ts --look v3 --out /tmp/v3.json --compare shots/v3/a3/baseline/sheet-hashes-v3.json

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import type { MonsterArt } from '../src/art/types';
import type { PixelCanvas as PixelCanvasT } from '../src/art/pixel';

// ---------------------------------------------------------------- args

const argv = process.argv.slice(2).filter((a) => a !== '--');
const arg = (k: string): string | undefined => {
  const i = argv.indexOf(`--${k}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const LOOK_ARG = arg('look') ?? 'v1';
if (LOOK_ARG !== 'v1' && LOOK_ARG !== 'v3') throw new Error(`--look must be v1 or v3 (got ${LOOK_ARG})`);
const V3 = LOOK_ARG === 'v3';
const OUT = path.resolve(ROOT, arg('out') ?? (V3 ? 'shots/sheet-hashes-v3.json' : 'shots/sheet-hashes.json'));
const COMPARE = arg('compare');
const NOTE = arg('note') ?? null;

// The look is decided once when src/view/layout.ts is first evaluated (LOOK_V3): under --look v3 the
// global is set BEFORE the art registry (and anything importing layout.ts) is loaded. --look v1
// leaves it unset, exactly as before (Node has no location: layout.ts falls back to 'v1').
if (V3) (globalThis as { __NEON_LOOK?: string }).__NEON_LOOK = 'v3';
const { MONSTER_IDS } = await import('../src/data/cards');
const { monsterArt, monsterArtV3 } = await import('../src/art/monsters');
const { PixelCanvas } = await import('../src/art/pixel');
const { CARD_ART_H, CARD_ART_W, MONSTER_ANIMS } = await import('../src/art/types');
const { LOOK } = await import('../src/view/layout');
if (LOOK !== LOOK_ARG) throw new Error(`layout.ts LOOK is ${LOOK}, wanted ${LOOK_ARG} (was it imported before the global was set?)`);
type PixelCanvas = PixelCanvasT;

// ---------------------------------------------------------------- types (v3 extensions are optional)

interface SpecLike {
  frames: number;
  fps: number;
  loop: boolean;
  holds?: number[];
  marks?: Record<string, number>;
}

/** MonsterArt plus the optional v3 contract fields (A1, docs/v3/A0_ENVANTER.md §5.4), if present. */
type ArtV3 = MonsterArt & {
  extraAnims?: Record<string, SpecLike | undefined>;
  drawExtra?: (p: PixelCanvas, anim: string, frame: number, o?: { lightFrom: 'left' | 'right' }) => void;
  p2?: 'mirror' | 'relight';
  weight?: string;
  points?: (anim: string, frame: number) => Record<string, { x: number; y: number } | undefined>;
};

interface AnimOut {
  frames: number;
  fps: number;
  loop: boolean;
  holds?: number[];
  marks?: Record<string, number>;
  hashes: string[];
  /** --look v3 only, when the art has points(): sha256 of every frame's points (JSON, sorted names). */
  points?: string;
}

interface MonsterOut {
  w: number;
  h: number;
  anchor: [number, number];
  hover: number;
  muzzle: [number, number];
  core: [number, number];
  attackImpactFrame: number;
  frames: number;
  sheet: { cols: number; rows: number; w: number; h: number; mb: number; hash: string };
  anims: Record<string, AnimOut>;
  portrait: string | null;
  extra?: Record<string, AnimOut>;
  p2?: { mode: string; anims: Record<string, AnimOut> };
  weight?: string;
  deterministic: boolean;
  drawMs: number;
}

// ---------------------------------------------------------------- hashing

const sha = (b: Uint8ClampedArray | Uint8Array): string => crypto.createHash('sha256').update(b).digest('hex');

function frameHash(w: number, h: number, draw: (p: PixelCanvas) => void): string {
  const p = new PixelCanvas(w, h);
  draw(p);
  return sha(p.data);
}

function specOut(s: SpecLike, hashes: string[]): AnimOut {
  const o: AnimOut = { frames: s.frames, fps: s.fps, loop: s.loop, hashes };
  if (s.holds) o.holds = [...s.holds];
  if (s.marks) o.marks = { ...s.marks };
  return o;
}

/** --look v3: hash of the art's per-frame points of one anim (absent without points()). */
function pointsHash(art: ArtV3, anim: string, frames: number): string | undefined {
  if (!V3 || !art.points) return undefined;
  const rows: string[] = [];
  for (let f = 0; f < frames; f++) {
    const pts = art.points(anim, f) ?? {};
    rows.push(
      Object.keys(pts)
        .sort()
        .map((k) => (pts[k] ? `${k}:${pts[k]!.x},${pts[k]!.y}` : `${k}:-`))
        .join(' '),
    );
  }
  return crypto.createHash('sha256').update(rows.join('\n')).digest('hex');
}

type DrawWithOpts = (p: PixelCanvas, a: string, f: number, o?: { lightFrom: 'left' | 'right' }) => void;

function hashMonster(art: ArtV3): MonsterOut {
  const t0 = performance.now();
  const anims: Record<string, AnimOut> = {};
  const all: string[] = [];
  for (const anim of MONSTER_ANIMS) {
    const spec = art.anims[anim];
    const hashes: string[] = [];
    for (let f = 0; f < spec.frames; f++) hashes.push(frameHash(art.w, art.h, (p) => art.draw(p, anim, f)));
    anims[anim] = specOut(spec, hashes);
    all.push(...hashes);
  }
  // the same frames in reverse order: must give the same pixels
  let deterministic = true;
  for (const anim of [...MONSTER_ANIMS].reverse()) {
    const spec = art.anims[anim];
    for (let f = spec.frames - 1; f >= 0; f--) {
      if (frameHash(art.w, art.h, (p) => art.draw(p, anim, f)) !== anims[anim].hashes[f]) deterministic = false;
    }
  }
  // the game's sheet grid (src/art/textures.ts sheetTexture / prepareMonster)
  const n = all.length;
  const cols = Math.max(1, Math.min(n, Math.floor(4096 / art.w)));
  const rows = Math.ceil(n / cols);
  const sheetHash = crypto.createHash('sha256').update(all.join('\n')).digest('hex');
  let portrait: string | null = null;
  if (art.portrait) portrait = frameHash(CARD_ART_W, CARD_ART_H, (p) => art.portrait!(p));

  const out: MonsterOut = {
    w: art.w,
    h: art.h,
    anchor: [art.anchorX, art.anchorY],
    hover: art.hover,
    muzzle: [art.muzzle.x, art.muzzle.y],
    core: [art.core.x, art.core.y],
    attackImpactFrame: art.attackImpactFrame,
    frames: n,
    sheet: { cols, rows, w: cols * art.w, h: rows * art.h, mb: Math.round(((cols * art.w * rows * art.h * 4) / 1048576) * 100) / 100, hash: sheetHash },
    anims,
    portrait,
    deterministic,
    drawMs: 0,
  };
  // optional v3 parts (absent on the v1 art)
  if (art.extraAnims && art.drawExtra) {
    const extra: Record<string, AnimOut> = {};
    for (const [anim, spec] of Object.entries(art.extraAnims)) {
      if (!spec) continue;
      const hashes: string[] = [];
      for (let f = 0; f < spec.frames; f++) hashes.push(frameHash(art.w, art.h, (p) => art.drawExtra!(p, anim, f)));
      extra[anim] = specOut(spec, hashes);
    }
    out.extra = extra;
  }
  if (art.p2 === 'relight') {
    const p2: Record<string, AnimOut> = {};
    for (const anim of MONSTER_ANIMS) {
      const spec = art.anims[anim];
      const hashes: string[] = [];
      for (let f = 0; f < spec.frames; f++) {
        hashes.push(frameHash(art.w, art.h, (p) => (art.draw as DrawWithOpts)(p, anim, f, { lightFrom: 'right' })));
      }
      p2[anim] = specOut(spec, hashes);
    }
    if (art.extraAnims && art.drawExtra) {
      for (const [anim, spec] of Object.entries(art.extraAnims)) {
        if (!spec) continue;
        const hashes: string[] = [];
        for (let f = 0; f < spec.frames; f++) hashes.push(frameHash(art.w, art.h, (p) => art.drawExtra!(p, anim, f, { lightFrom: 'right' })));
        p2[`extra:${anim}`] = specOut(spec, hashes);
      }
    }
    out.p2 = { mode: 'relight', anims: p2 };
  }
  // the extra and P2 frames in reverse order too (A3 Y0; the v1 art has neither)
  if (out.extra) {
    for (const anim of Object.keys(out.extra).reverse()) {
      for (let f = out.extra[anim].frames - 1; f >= 0; f--) {
        if (frameHash(art.w, art.h, (p) => art.drawExtra!(p, anim, f)) !== out.extra[anim].hashes[f]) out.deterministic = false;
      }
    }
  }
  if (out.p2) {
    for (const key of Object.keys(out.p2.anims).reverse()) {
      const a = out.p2.anims[key];
      const extraAnim = key.startsWith('extra:') ? key.slice(6) : null;
      for (let f = a.frames - 1; f >= 0; f--) {
        const h = frameHash(art.w, art.h, (p) =>
          extraAnim ? art.drawExtra!(p, extraAnim, f, { lightFrom: 'right' }) : (art.draw as DrawWithOpts)(p, key, f, { lightFrom: 'right' }),
        );
        if (h !== a.hashes[f]) out.deterministic = false;
      }
    }
  }
  // --look v3: the per-frame points the cinematics aim at (beam from the mouth, staff tip, feet)
  if (V3 && art.points) {
    for (const anim of MONSTER_ANIMS) out.anims[anim].points = pointsHash(art, anim, out.anims[anim].frames);
    if (out.extra) for (const anim of Object.keys(out.extra)) out.extra[anim].points = pointsHash(art, anim, out.extra[anim].frames);
  }
  if (art.weight) out.weight = art.weight;
  out.drawMs = Math.round(performance.now() - t0);
  return out;
}

// ---------------------------------------------------------------- run

function gitInfo(): { head: string; artDirty: boolean } | null {
  try {
    const head = execFileSync('git', ['-C', ROOT, 'rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    const dirty = execFileSync('git', ['-C', ROOT, 'status', '--porcelain', '--', 'src/art', 'src/data'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    return { head, artDirty: dirty.length > 0 };
  } catch {
    return null;
  }
}

// --look v1: every monster's game art (monsterArt = the v1 art). --look v3: only the monsters that
// have v3 art, and that art (monsterArtV3 = what monsterArt returns under ?look=v3 for them).
const IDS = V3 ? MONSTER_IDS.filter((id) => monsterArtV3(id) !== null) : [...MONSTER_IDS];
const monsters: Record<string, MonsterOut> = {};
let frames = 0;
let extraFrames = 0;
let p2Frames = 0;
let mb = 0;
const countFrames = (r: Record<string, AnimOut> | undefined): number => Object.values(r ?? {}).reduce((n, a) => n + a.hashes.length, 0);
for (const id of IDS) {
  const m = hashMonster((V3 ? monsterArtV3(id)! : monsterArt(id)) as ArtV3);
  monsters[id] = m;
  frames += m.frames;
  extraFrames += countFrames(m.extra);
  p2Frames += countFrames(m.p2?.anims);
  mb += m.sheet.mb;
  console.log(
    `${id.padEnd(15)} ${m.w}×${m.h}  ${m.frames} frames (${MONSTER_ANIMS.map((a) => `${a} ${m.anims[a].frames}`).join(', ')})  sheet ${m.sheet.cols}×${m.sheet.rows} ${m.sheet.mb} MB  ${m.sheet.hash.slice(0, 12)}${m.deterministic ? '' : '  NOT DETERMINISTIC'}${m.extra ? `  +extra ${Object.keys(m.extra).length} (${countFrames(m.extra)} frames)` : ''}${m.p2 ? `  +p2 relight (${countFrames(m.p2.anims)} frames)` : ''}  [${m.drawMs} ms]`,
  );
}
const doc = {
  tool: 'tools/sheet-hash.ts',
  version: 1,
  look: LOOK_ARG,
  date: new Date().toISOString(),
  root: ROOT,
  git: gitInfo(),
  note: NOTE,
  summary: V3
    ? { monsters: IDS.length, frames, extraFrames, p2Frames, sheetMB: Math.round(mb * 100) / 100 }
    : { monsters: MONSTER_IDS.length, frames, sheetMB: Math.round(mb * 100) / 100 },
  monsters,
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(doc, null, 1));
console.log(
  `[sheet-hash] ${V3 ? `look v3: ${IDS.length} monster(s) with v3 art (${IDS.join(', ')}), ${frames} base + ${extraFrames} extra + ${p2Frames} P2 frames` : `${MONSTER_IDS.length} monsters, ${frames} frames`}, ${doc.summary.sheetMB} MB of sheets → ${path.relative(ROOT, OUT)}`,
);

// ---------------------------------------------------------------- compare

/** --look v3: frame / spec / points differences of one group of anims (extra, or the P2 sheet). */
function animGroupDiffs(label: string, x: Record<string, AnimOut> | undefined, y: Record<string, AnimOut> | undefined): string[] {
  const out: string[] = [];
  if (!x && !y) return out;
  if (!x || !y) return [`${label}: only in ${x ? 'the old' : 'the new'} file`];
  for (const anim of new Set([...Object.keys(x), ...Object.keys(y)])) {
    const a = x[anim];
    const b = y[anim];
    if (!a || !b) {
      out.push(`${label}.${anim}: only in ${a ? 'the old' : 'the new'} file`);
      continue;
    }
    for (const k of ['frames', 'fps', 'loop'] as const) if (a[k] !== b[k]) out.push(`${label}.${anim}: ${k} ${a[k]} → ${b[k]}`);
    if (JSON.stringify(a.holds ?? null) !== JSON.stringify(b.holds ?? null)) out.push(`${label}.${anim}: holds ${JSON.stringify(a.holds ?? null)} → ${JSON.stringify(b.holds ?? null)}`);
    if (JSON.stringify(a.marks ?? null) !== JSON.stringify(b.marks ?? null)) out.push(`${label}.${anim}: marks ${JSON.stringify(a.marks ?? null)} → ${JSON.stringify(b.marks ?? null)}`);
    if ((a.points ?? null) !== (b.points ?? null)) out.push(`${label}.${anim}: per-frame points changed`);
    const changed: number[] = [];
    for (let f = 0; f < Math.max(a.hashes.length, b.hashes.length); f++) if (a.hashes[f] !== b.hashes[f]) changed.push(f);
    if (changed.length) out.push(`${label}.${anim}: frames ${changed.join(', ')} changed`);
  }
  return out;
}

if (COMPARE) {
  const old = JSON.parse(fs.readFileSync(path.resolve(COMPARE), 'utf8')) as typeof doc;
  const oldLook = (old as { look?: string }).look ?? 'v1';
  if (oldLook !== LOOK_ARG) {
    console.log(`[sheet-hash] compare with ${COMPARE}: that file is a --look ${oldLook} fingerprint, this run is --look ${LOOK_ARG} — not comparable`);
    process.exit(2);
  }
  let baseDiffs = 0;
  /** --look v3 only: differences outside the base frames (every one fails the v3 gate). */
  let v3Diffs = 0;
  const lines: string[] = [];
  for (const id of new Set([...Object.keys(old.monsters ?? {}), ...Object.keys(monsters)])) {
    const a = old.monsters?.[id];
    const b = monsters[id];
    if (!a || !b) {
      if (V3 && !a) {
        lines.push(`${id}: new v3 art, not in the old file (not compared; rewrite the baseline to add it)`);
        continue;
      }
      lines.push(`${id}: only in ${a ? 'the old' : 'the new'} file`);
      baseDiffs++;
      continue;
    }
    for (const k of ['w', 'h', 'hover', 'attackImpactFrame'] as const) {
      if (a[k] !== b[k]) {
        lines.push(`${id}: ${k} ${a[k]} → ${b[k]}`);
        baseDiffs++;
      }
    }
    for (const k of ['anchor', 'muzzle', 'core'] as const) {
      if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) {
        lines.push(`${id}: ${k} ${JSON.stringify(a[k])} → ${JSON.stringify(b[k])}`);
        baseDiffs++;
      }
    }
    for (const anim of new Set([...Object.keys(a.anims), ...Object.keys(b.anims)])) {
      const x = a.anims[anim];
      const y = b.anims[anim];
      if (!x || !y) {
        lines.push(`${id}.${anim}: only in ${x ? 'the old' : 'the new'} file`);
        baseDiffs++;
        continue;
      }
      for (const k of ['frames', 'fps', 'loop'] as const) {
        if (x[k] !== y[k]) {
          lines.push(`${id}.${anim}: ${k} ${x[k]} → ${y[k]}`);
          baseDiffs++;
        }
      }
      if (JSON.stringify(x.holds ?? null) !== JSON.stringify(y.holds ?? null)) {
        lines.push(`${id}.${anim}: holds ${JSON.stringify(x.holds ?? null)} → ${JSON.stringify(y.holds ?? null)}`);
        if (V3) v3Diffs++;
      }
      if (JSON.stringify(x.marks ?? null) !== JSON.stringify(y.marks ?? null)) {
        lines.push(`${id}.${anim}: marks ${JSON.stringify(x.marks ?? null)} → ${JSON.stringify(y.marks ?? null)}`);
        if (V3) v3Diffs++;
      }
      if (V3 && (x.points ?? null) !== (y.points ?? null)) {
        lines.push(`${id}.${anim}: per-frame points changed`);
        v3Diffs++;
      }
      const changed: number[] = [];
      for (let f = 0; f < Math.max(x.hashes.length, y.hashes.length); f++) if (x.hashes[f] !== y.hashes[f]) changed.push(f);
      if (changed.length) {
        lines.push(`${id}.${anim}: frames ${changed.join(', ')} changed`);
        baseDiffs++;
      }
    }
    if (a.portrait !== b.portrait) {
      lines.push(`${id}: portrait changed`);
      if (V3) v3Diffs++;
    }
    if (V3) {
      // strict: every extra / P2 frame, spec and point, the determinism flag and the weight
      const ex = animGroupDiffs(`${id}.extra`, a.extra, b.extra);
      const p2 = a.p2?.mode !== b.p2?.mode ? [`${id}: p2 sheet ${a.p2 ? a.p2.mode : '-'} → ${b.p2 ? b.p2.mode : '-'}`] : animGroupDiffs(`${id}.p2`, a.p2?.anims, b.p2?.anims);
      for (const l of [...ex, ...p2]) lines.push(l);
      v3Diffs += ex.length + p2.length;
      if (a.deterministic !== b.deterministic) {
        lines.push(`${id}: deterministic ${a.deterministic} → ${b.deterministic}`);
        v3Diffs++;
      }
      if ((a.weight ?? null) !== (b.weight ?? null)) {
        lines.push(`${id}: weight ${a.weight ?? '-'} → ${b.weight ?? '-'}`);
        v3Diffs++;
      }
    } else {
      if (JSON.stringify(a.extra ?? null) !== JSON.stringify(b.extra ?? null)) lines.push(`${id}: extra anims ${a.extra ? Object.keys(a.extra).join('/') : '-'} → ${b.extra ? Object.keys(b.extra).join('/') : '-'} (or their frames changed)`);
      if (JSON.stringify(a.p2 ?? null) !== JSON.stringify(b.p2 ?? null)) lines.push(`${id}: p2 sheet ${a.p2 ? a.p2.mode : '-'} → ${b.p2 ? b.p2.mode : '-'} (or its frames changed)`);
    }
  }
  if (V3) {
    const n = baseDiffs + v3Diffs;
    console.log(`[sheet-hash] compare with ${COMPARE}: ${n ? `${n} difference(s) (look v3: every one fails)` : 'all base, extra and P2 frames, specs and points identical'}`);
  } else {
    console.log(`[sheet-hash] compare with ${COMPARE}: ${baseDiffs ? `${baseDiffs} base difference(s)` : 'all base frames identical'}`);
  }
  for (const l of lines) console.log(`  ${l}`);
  if (baseDiffs || v3Diffs) process.exit(2);
}
