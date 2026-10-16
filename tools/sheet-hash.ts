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

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { MONSTER_IDS } from '../src/data/cards';
import { monsterArt } from '../src/art/monsters';
import { PixelCanvas } from '../src/art/pixel';
import { CARD_ART_H, CARD_ART_W, MONSTER_ANIMS } from '../src/art/types';
import type { MonsterArt } from '../src/art/types';

// ---------------------------------------------------------------- args

const argv = process.argv.slice(2).filter((a) => a !== '--');
const arg = (k: string): string | undefined => {
  const i = argv.indexOf(`--${k}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = path.resolve(ROOT, arg('out') ?? 'shots/sheet-hashes.json');
const COMPARE = arg('compare');
const NOTE = arg('note') ?? null;

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
};

interface AnimOut {
  frames: number;
  fps: number;
  loop: boolean;
  holds?: number[];
  marks?: Record<string, number>;
  hashes: string[];
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
  // optional v3 parts (absent today)
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
        hashes.push(
          frameHash(art.w, art.h, (p) =>
            (art.draw as (p: PixelCanvas, a: string, f: number, o?: { lightFrom: 'left' | 'right' }) => void)(p, anim, f, { lightFrom: 'right' }),
          ),
        );
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

const monsters: Record<string, MonsterOut> = {};
let frames = 0;
let mb = 0;
for (const id of MONSTER_IDS) {
  const m = hashMonster(monsterArt(id) as ArtV3);
  monsters[id] = m;
  frames += m.frames;
  mb += m.sheet.mb;
  console.log(
    `${id.padEnd(15)} ${m.w}×${m.h}  ${m.frames} frames (${MONSTER_ANIMS.map((a) => `${a} ${m.anims[a].frames}`).join(', ')})  sheet ${m.sheet.cols}×${m.sheet.rows} ${m.sheet.mb} MB  ${m.sheet.hash.slice(0, 12)}${m.deterministic ? '' : '  NOT DETERMINISTIC'}${m.extra ? `  +extra ${Object.keys(m.extra).length}` : ''}${m.p2 ? '  +p2 relight' : ''}  [${m.drawMs} ms]`,
  );
}
const doc = {
  tool: 'tools/sheet-hash.ts',
  version: 1,
  date: new Date().toISOString(),
  root: ROOT,
  git: gitInfo(),
  note: NOTE,
  summary: { monsters: MONSTER_IDS.length, frames, sheetMB: Math.round(mb * 100) / 100 },
  monsters,
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(doc, null, 1));
console.log(`[sheet-hash] ${MONSTER_IDS.length} monsters, ${frames} frames, ${doc.summary.sheetMB} MB of sheets → ${path.relative(ROOT, OUT)}`);

// ---------------------------------------------------------------- compare

if (COMPARE) {
  const old = JSON.parse(fs.readFileSync(path.resolve(COMPARE), 'utf8')) as typeof doc;
  let baseDiffs = 0;
  const lines: string[] = [];
  for (const id of new Set([...Object.keys(old.monsters ?? {}), ...Object.keys(monsters)])) {
    const a = old.monsters?.[id];
    const b = monsters[id];
    if (!a || !b) {
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
      if (JSON.stringify(x.holds ?? null) !== JSON.stringify(y.holds ?? null)) lines.push(`${id}.${anim}: holds ${JSON.stringify(x.holds ?? null)} → ${JSON.stringify(y.holds ?? null)}`);
      if (JSON.stringify(x.marks ?? null) !== JSON.stringify(y.marks ?? null)) lines.push(`${id}.${anim}: marks ${JSON.stringify(x.marks ?? null)} → ${JSON.stringify(y.marks ?? null)}`);
      const changed: number[] = [];
      for (let f = 0; f < Math.max(x.hashes.length, y.hashes.length); f++) if (x.hashes[f] !== y.hashes[f]) changed.push(f);
      if (changed.length) {
        lines.push(`${id}.${anim}: frames ${changed.join(', ')} changed`);
        baseDiffs++;
      }
    }
    if (a.portrait !== b.portrait) lines.push(`${id}: portrait changed`);
    if (JSON.stringify(a.extra ?? null) !== JSON.stringify(b.extra ?? null)) lines.push(`${id}: extra anims ${a.extra ? Object.keys(a.extra).join('/') : '-'} → ${b.extra ? Object.keys(b.extra).join('/') : '-'} (or their frames changed)`);
    if (JSON.stringify(a.p2 ?? null) !== JSON.stringify(b.p2 ?? null)) lines.push(`${id}: p2 sheet ${a.p2 ? a.p2.mode : '-'} → ${b.p2 ? b.p2.mode : '-'} (or its frames changed)`);
  }
  console.log(`[sheet-hash] compare with ${COMPARE}: ${baseDiffs ? `${baseDiffs} base difference(s)` : 'all base frames identical'}`);
  for (const l of lines) console.log(`  ${l}`);
  if (baseDiffs) process.exit(2);
}
