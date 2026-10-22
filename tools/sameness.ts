// Sameness gate (docs/v3/A3_MIMARI.md §9, docs/v3/REHBER.md §8.2.1; A3 build row Y6): are two monsters
// of the same body plan (or archetype) more than recoloured copies of each other — in silhouette,
// motion path, rhythm, idle / guard loops? Node, deterministic, measured on the game's own frames.
//
//   npx vite-node tools/sameness.ts --look v3 --plan biped [--ids a,b] [--against all] [--art FILE]…
//       [--anims attack,roar,hit,idle,guard] [--controls] [--cross FILE:ID] [--blind DIR --key-out KEYDIR]
//       [--seed N] [--out DIR] [--json] [--thresholds FILE] [--source joints|points|proxy]
//       [--overlays warn|all|none]
//   npx vite-node tools/sameness.ts --score DIR/form.json --key KEYDIR/key.json [--note FILE]
//   npx vite-node tools/sameness.ts --calib [--out DIR]
//
// Members: --plan P = every registry art (under --look) whose MonsterArt.bodyPlan.id is P; --ids a,b
// names them ('id' = the art the look draws, 'id:v1' / 'id:v3' forces one); --art FILE adds an
// unregistered draft (its default export; tag '<id>:draft'). Every member pair (different ids) is a
// gate pair. --against all adds every member × every other registry art as an OUT-OF-PLAN pair:
// measured the same way, a KALIR there counts as UYARI (blind eye test), it never blocks.
//
// Metrics (tools/lib/sameness-metrics.ts, tools/lib/tracks.ts): KEY, MOT (sig / loop / avg, per anim),
// SI (+ SIloop, reported), RHYTHM, SIL0, HEAT, PAL; bands of §9.3 (GEÇER / UYARI / KALIR). The MOT track
// source of a pair: joints() when both arts have them (plan members), else points() (other v3 art),
// else the silhouette proxy (v1).
//
// Output (--out, default shots/v3/a3/sameness): sameness.txt / .json (pair matrix, per-anim MOT +
// rhythm table, reasons, controls, the A4 target check), and for every UYARI / KALIR pair one overlay
// PNG <a>__<b>.png ×3: the key-pose silhouettes (A red, B blue, both light), the HEAT masks and the
// track paths of both monsters on a neutral skeleton (time runs dark → bright). LOOK at them.
//
// --controls (§9.4): (a) colour — each member × its ramp-shifted copy; (c) ±60 ms — each member × itself
// with every hold moved ±60 ms; (b) cross build — --cross FILE:ID, FILE default-exporting the synthetic
// member built with member ID's anims on another member's build / parts (planArt; Y9), compared with
// ID (+ its ±60 ms version). A control that does not come out KALIR on its metrics → exit 3 ("the
// metric is blind": the gate cannot be used with that definition).
//
// --blind DIR (§9.5): ref.png (each member's NAMED idle f0, one tone, 56 px, ×3), sil.png (shuffled
// CODED silhouettes: attack release, roar peak, hit f0, guard f0), motion.png (coded PAIRS of strips:
// attack and idle loop on a common neutral stick body driven by each member's tracks; some pairs are
// controls: one member twice, one strip with ±60 ms holds), form.json (blank answers). The answer key
// goes to --key-out KEYDIR (a separate directory the reviewer never sees). --score scores a filled form.
//
// --calib: the §9.2 calibration (12 v1 monsters + the slice): reproduces the silhouette and proxy
// tables, checks the acceptance controls (a), (c)–(g) ((b) needs plan members: Y9) and prints the gate
// definition's values; exit 3 when one fails.
//
// Exit: 0 clean · 1 a UYARI · 2 a KALIR · 3 a control did not hold. --score: 0 pass · 2 a pair failed
// (KALIR) · 3 the reviewer failed the control pairs (the test is void).

import fs from 'node:fs';
import path from 'node:path';
import { PAL } from '../src/art/palette';
import { PixelCanvas } from '../src/art/pixel';
import type { MonsterArt } from '../src/art/types';
import { GRID_H, GRID_W, NORM_H, blitMask, loadArtFile, loadRegistry, normMask, prng, shuffled, text, textWidth, writePng, type Look, type Registry } from './lib/framelib';
import {
  type Anim,
  type BlindForm,
  type BlindKey,
  type JudgeOpts,
  type Metric,
  type MotSource,
  type PairJudgement,
  type PairMetrics,
  type Thresholds,
  type Verdict,
  controlHeld,
  exitCode,
  iou,
  judgePair,
  median,
  scoreBlind,
  withThresholds,
  worst,
} from './lib/sameness-metrics';
import {
  AVG_ANIMS,
  type Entity,
  type NamedTrack,
  type Profile,
  colourShifted,
  jittered,
  keyMasks,
  makeEntity,
  measurePair,
  profileOf,
  releaseFrame,
} from './lib/tracks';

// ---------------------------------------------------------------- args

const argv = process.argv.slice(2).filter((a) => a !== '--');
const arg = (k: string): string | undefined => {
  const i = argv.indexOf(`--${k}`);
  return i >= 0 && argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[i + 1] : undefined;
};
const args = (k: string): string[] => argv.flatMap((a, i) => (a === `--${k}` && argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[i + 1].split(',').map((s) => s.trim()).filter(Boolean) : []));
const flag = (k: string): boolean => argv.includes(`--${k}`);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const rel = (f: string) => {
  const r = path.relative(ROOT, f);
  return r.startsWith('..') ? f : r || '.';
};
const f3 = (x: number | undefined) => (x === undefined || !Number.isFinite(x) ? '  -  ' : (x < 0 ? '' : ' ') + x.toFixed(3));
const f2 = (x: number | undefined) => (x === undefined || !Number.isFinite(x) ? ' - ' : x.toFixed(2));
const VCH: Record<Verdict, string> = { 'GEÇER': 'G', 'UYARI': 'U', 'KALIR': 'K' };

function usage(msg?: string): never {
  if (msg) console.error(`sameness: ${msg}`);
  console.error(
    'usage: npx vite-node tools/sameness.ts --look v3 (--plan ID | --ids a,b) [--against all] [--art FILE] [--controls] [--cross FILE:ID] [--blind DIR --key-out KEYDIR] [--out DIR] [--json]\n' +
      '       npx vite-node tools/sameness.ts --score form.json --key key.json\n' +
      '       npx vite-node tools/sameness.ts --calib [--out DIR]',
  );
  process.exit(msg ? 2 : 0);
}

const T: Thresholds = withThresholds(arg('thresholds') ? JSON.parse(fs.readFileSync(path.resolve(arg('thresholds')!), 'utf8')) : null);
const OUT = path.resolve(ROOT, arg('out') ?? (flag('calib') ? 'shots/v3/a3/sameness/calib' : 'shots/v3/a3/sameness'));
const SOURCE = arg('source') as MotSource | undefined;
if (SOURCE && !['joints', 'points', 'proxy'].includes(SOURCE)) usage(`--source must be joints, points or proxy (got ${SOURCE})`);
const ANIMS = args('anims').length ? (args('anims') as Anim[]) : undefined;
const OVERLAYS = arg('overlays') ?? 'warn';

// ---------------------------------------------------------------- --score

if (arg('score')) {
  const formFile = path.resolve(arg('score')!);
  const keyFile = arg('key') ? path.resolve(arg('key')!) : usage('--score needs --key');
  const form = JSON.parse(fs.readFileSync(formFile, 'utf8')) as BlindForm;
  const key = JSON.parse(fs.readFileSync(keyFile, 'utf8')) as BlindKey;
  const s = scoreBlind(form, key);
  const lines: string[] = [];
  lines.push(`blind eye test score (A3_MIMARI §9.5) — form ${rel(formFile)}, key ${rel(keyFile)}, members ${key.members.join(', ')}`);
  if (path.dirname(formFile) === path.dirname(keyFile)) lines.push('WARNING: the key sits in the form directory (§9.5 wants a separate directory the reviewer never sees)');
  for (const p of s.pairs)
    lines.push(`  ${`${p.a} × ${p.b}`.padEnd(44)} silhouettes ${p.silCorrect}/${p.silCodes} ${p.silPass ? 'ok' : 'FAIL'}  motion "farklı" ${p.motCorrect}/${p.motCodes} ${p.motPass ? 'ok' : 'FAIL'}  → ${p.pass ? 'GEÇER' : 'KALIR'}`);
  lines.push(`  control pairs answered "aynı": ${s.controls.same}/${s.controls.total} (${(100 * s.controls.rate).toFixed(0)} %, need ≥ 80 %) → ${s.controls.valid ? 'reviewer valid' : 'REVIEWER ELIMINATED: the test is void'}`);
  if (s.invalid.length) lines.push(`  blank / unknown answers (count as wrong): ${s.invalid.join('; ')}`);
  lines.push(`result: ${s.pass ? 'PASS' : s.controls.valid ? 'FAIL (failing pairs count as KALIR)' : 'VOID'} (exit ${s.exit})`);
  const txt = lines.join('\n');
  console.log(txt);
  const note = arg('note') ? path.resolve(arg('note')!) : path.join(path.dirname(formFile), 'score.txt');
  fs.mkdirSync(path.dirname(note), { recursive: true });
  if (arg('note')) fs.appendFileSync(note, `\n${txt}\n`);
  else fs.writeFileSync(note, txt + '\n');
  fs.writeFileSync(note.replace(/\.txt$/, '') + '.json', JSON.stringify({ tool: 'tools/sameness.ts --score', form: rel(formFile), key: rel(keyFile), ...s }, null, 1));
  console.log(`[sameness] score → ${rel(note)}`);
  process.exit(s.exit);
}

// ---------------------------------------------------------------- registry + entities

const LOOK = (arg('look') ?? 'v3') as Look;
if (LOOK !== 'v1' && LOOK !== 'v3') usage(`--look must be v1 or v3 (got ${LOOK})`);
const reg: Registry = await loadRegistry(LOOK);
const t0 = Date.now();

const profiles = new Map<string, Profile>();
function prof(e: Entity): Profile {
  let p = profiles.get(e.tag);
  if (!p) {
    p = profileOf(e);
    profiles.set(e.tag, p);
  }
  return p;
}

/** A registry art: 'id' = the art the look draws, 'id:v1' / 'id:v3' forces one. */
const regCache = new Map<string, Entity>();
function regEntity(spec: string): Entity {
  const hit = regCache.get(spec);
  if (hit) return hit;
  const [id, ver] = spec.split(':');
  if (!reg.MONSTER_IDS.includes(id)) usage(`unknown monster id ${id} (known: ${reg.MONSTER_IDS.join(', ')})`);
  let art: MonsterArt;
  if (ver === 'v1') art = reg.monsterArtV1(id);
  else if (ver === 'v3') art = reg.monsterArtV3(id) ?? usage(`${id} has no v3 art`);
  else if (ver) usage(`bad member ${spec} (id, id:v1 or id:v3)`);
  else art = reg.monsterArt(id);
  const e = makeEntity(spec, art);
  regCache.set(spec, e);
  return e;
}
const versionOf = (e: Entity) => (e.tag.endsWith(':draft') ? 'draft' : e.art === reg.monsterArtV1(e.id) ? 'v1' : 'v3');

/** The pair's own v1 KEY (both sides' v1 art), for the A4 target "KEY below its own v1 value". */
const v1Keys = new Map<string, Uint8Array[]>();
function keyV1(a: Entity, b: Entity): number | null {
  if (!reg.MONSTER_IDS.includes(a.id) || !reg.MONSTER_IDS.includes(b.id) || a.id === b.id) return null;
  if (versionOf(a) === 'v1' && versionOf(b) === 'v1') return null;
  const km = (id: string) => {
    if (!v1Keys.has(id)) v1Keys.set(id, keyMasks(regEntity(`${id}:v1`)));
    return v1Keys.get(id)!;
  };
  const A = km(a.id);
  const B = km(b.id);
  return A.reduce((s, m, k) => s + iou(m, B[k]), 0) / A.length;
}

// ---------------------------------------------------------------- drawing (overlays, blind pages)

const BG = PAL.night0;
const TXT = PAL.mist;
const DIM = PAL.steel;
const RA = [PAL.crim1, PAL.crim2, PAL.crim3, PAL.crim4];
const RB = [PAL.water1, PAL.water2, PAL.water3, PAL.water4];

/** Neutral stick-body places (normalized px, anchor = (0, 0), body height 56) per track vocabulary. */
const NEUTRAL: Record<MotSource, Record<string, [number, number]>> = {
  joints: { head: [0, -50], hip: [0, -26], handN: [11, -30], handF: [-11, -30], footN: [6, 0], footF: [-6, 0], propN: [16, -38], propF: [-16, -38], prop: [16, -38] },
  points: { head: [3, -48], core: [0, -30], muzzle: [12, -44], hand: [13, -27], prop: [18, -38], feet: [0, 0] },
  proxy: { top: [0, -56], front: [22, -28], back: [-22, -28], mass: [0, -24] },
};
const BONES: Record<MotSource, [string, string][]> = {
  joints: [['hip', 'head'], ['hip', 'handN'], ['hip', 'handF'], ['hip', 'footN'], ['hip', 'footF'], ['handN', 'propN'], ['handF', 'propF'], ['handN', 'prop']],
  points: [['core', 'head'], ['head', 'muzzle'], ['core', 'hand'], ['hand', 'prop'], ['core', 'feet']],
  proxy: [['mass', 'top'], ['mass', 'front'], ['mass', 'back']],
};
const ROOT_OF: Record<MotSource, string> = { joints: 'hip', points: 'core', proxy: 'mass' };

function neutral(src: MotSource, name: string, i: number): [number, number] {
  return NEUTRAL[src][name] ?? [Math.round(20 * Math.cos(i * 1.7)), Math.round(-28 + 18 * Math.sin(i * 1.7))];
}

/** Joint places of one time sample of a track on the neutral body. */
function poseAt(t: NamedTrack, names: readonly string[], s: number, src: MotSource, gain = 1): Map<string, [number, number]> {
  const m = new Map<string, [number, number]>();
  names.forEach((n, i) => {
    const k = t.names.indexOf(n);
    const b = neutral(src, n, i);
    m.set(n, k < 0 ? b : [b[0] + t.data[s][2 * k] * NORM_H * gain, b[1] + t.data[s][2 * k + 1] * NORM_H * gain]);
  });
  return m;
}

function bonesOf(src: MotSource, names: readonly string[]): [string, string][] {
  const known = BONES[src].filter(([a, b]) => names.includes(a) && names.includes(b));
  const root = names.includes(ROOT_OF[src]) ? ROOT_OF[src] : names[0];
  const linked = new Set(known.flat());
  for (const n of names) if (!linked.has(n) && n !== root) known.push([root, n]);
  return known;
}

function drawStick(p: PixelCanvas, pose: Map<string, [number, number]>, ox: number, oy: number, bones: [string, string][], bone: number, joint: number): void {
  for (const [a, b] of bones) {
    const A = pose.get(a);
    const B = pose.get(b);
    if (A && B) p.line(Math.round(ox + A[0]), Math.round(oy + A[1]), Math.round(ox + B[0]), Math.round(oy + B[1]), bone);
  }
  for (const q of pose.values()) p.rect(Math.round(ox + q[0]) - 1, Math.round(oy + q[1]) - 1, 2, 2, joint);
}

/** Two masks on one grid: A only red, B only blue, both light. */
function blitPair(p: PixelCanvas, a: Uint8Array, b: Uint8Array, x: number, y: number): void {
  for (let gy = 0; gy < GRID_H; gy++)
    for (let gx = 0; gx < GRID_W; gx++) {
      const i = gy * GRID_W + gx;
      if (a[i] && b[i]) p.set(x + gx, y + gy, PAL.mist);
      else if (a[i]) p.set(x + gx, y + gy, PAL.crim2);
      else if (b[i]) p.set(x + gx, y + gy, PAL.water2);
    }
}

/** Overlay PNG of a pair (×3): key poses, HEAT masks, track paths per anim. */
function overlayPng(a: Profile, b: Profile, m: PairMetrics, j: PairJudgement, file: string): void {
  const anims = Object.keys(m.mot) as Anim[];
  const src = m.source;
  const PW = 112;
  const PH = 88;
  const cols = 4;
  const rowsT = Math.ceil(anims.length / cols);
  const title = `${a.tag} (red) × ${b.tag} (blue): ${j.overall}  KEY ${m.KEY.toFixed(3)} SI ${m.SI.toFixed(3)} HEAT ${m.HEAT.toFixed(3)}  MOT ${src} sig ${m.MOTsig.toFixed(2)} loop ${m.MOTloop.toFixed(2)} avg ${m.MOTavg.toFixed(2)}`;
  const legend = 'silhouettes: red = A only, blue = B only, light = both · tracks on a neutral body: A red, B blue, time dark → bright · gold title = same rhythm';
  const W = Math.max(4 + 3 * (GRID_W + 6), 4 + cols * (PW + 4), 8 + textWidth(title), 8 + textWidth(legend));
  const H = 4 + 3 * 9 + 2 * (GRID_H + 12) + rowsT * (PH + 12) + 8;
  const p = new PixelCanvas(W, H);
  p.rect(0, 0, W, H, BG);
  let y = 3;
  text(p, 4, y, title, TXT);
  text(p, 4, y + 9, legend, DIM);
  y += 19;
  const keyNames = ['idle f0', 'attack release', 'hit f0'];
  keyNames.forEach((n, k) => {
    const x = 4 + k * (GRID_W + 6);
    text(p, x, y, `${n} IoU ${iou(a.key[k], b.key[k]).toFixed(2)}`, DIM);
    p.rect(x, y + 9, GRID_W, GRID_H, PAL.ink);
    blitPair(p, a.key[k], b.key[k], x, y + 9);
  });
  y += GRID_H + 12;
  ['HEAT attack', 'HEAT hit'].forEach((n, k) => {
    const x = 4 + k * (GRID_W + 6);
    text(p, x, y, `${n} IoU ${iou(a.heat[k], b.heat[k]).toFixed(2)}`, DIM);
    p.rect(x, y + 9, GRID_W, GRID_H, PAL.ink);
    blitPair(p, a.heat[k], b.heat[k], x, y + 9);
  });
  y += GRID_H + 12;
  anims.forEach((an, i) => {
    const x = 4 + (i % cols) * (PW + 4);
    const yy = y + Math.floor(i / cols) * (PH + 12);
    const ta = a.anims[an]!.tracks[src]!;
    const tb = b.anims[an]!.tracks[src]!;
    const names = ta.names.filter((n) => tb.names.includes(n));
    const r = m.rhythm[an];
    text(p, x, yy, `${an} MOT ${f2(m.mot[an])}`, r?.same ? PAL.gold3 : DIM);
    // each panel on its own canvas: paths that leave it are clipped, not drawn over the next one
    const q = new PixelCanvas(PW, PH);
    q.rect(0, 0, PW, PH, PAL.ink);
    const ox = PW / 2;
    const oy = PH - 14;
    const base = new Map(names.map((n, k) => [n, neutral(src, n, k)] as [string, [number, number]]));
    drawStick(q, base, ox, oy, bonesOf(src, names), PAL.night3, PAL.night4);
    for (const [t, ramp] of [[ta, RA], [tb, RB]] as const)
      for (const n of names) {
        const S = t.data.length;
        let prev: [number, number] | null = null;
        for (let s = 0; s < S; s++) {
          const pt = poseAt(t, [n], s, src).get(n)!;
          const c = ramp[Math.min(3, Math.floor((s / S) * 4))];
          const X = Math.round(ox + pt[0]);
          const Y = Math.round(oy + pt[1]);
          if (prev) q.line(prev[0], prev[1], X, Y, c);
          else q.rect(X - 1, Y - 1, 2, 2, c);
          prev = [X, Y];
        }
      }
    p.blit(q, x, yy + 9);
  });
  writePng(p, file, 3, BG);
}

// ---------------------------------------------------------------- pair runs

interface PairRow {
  a: Entity;
  b: Entity;
  outOfPlan: boolean;
  control?: { id: 'a' | 'b' | 'c'; required: Metric[] };
  m: PairMetrics;
  j: PairJudgement;
  keyV1: number | null;
  a4: { met: boolean; misses: string[] } | null;
}

function runPair(a: Entity, b: Entity, o: { outOfPlan?: boolean; control?: PairRow['control'] } = {}): PairRow {
  const m = measurePair(prof(a), prof(b), { source: SOURCE, anims: ANIMS, t: T });
  const newCard = !reg.MONSTER_IDS.includes(a.id) || !reg.MONSTER_IDS.includes(b.id);
  const jo: JudgeOpts = { t: T, outOfPlan: o.outOfPlan, newCard };
  const j = judgePair(m, jo);
  const kv1 = o.control ? null : keyV1(a, b);
  let a4: PairRow['a4'] = null;
  if (!o.control && !o.outOfPlan) {
    const misses: string[] = [];
    if (!(m.MOTsig < T.MOTsig.warn)) misses.push(`MOTsig ${m.MOTsig.toFixed(3)} ≥ ${T.MOTsig.warn}`);
    if (!(m.MOTloop < T.MOTloop.warn)) misses.push(`MOTloop ${m.MOTloop.toFixed(3)} ≥ ${T.MOTloop.warn}`);
    if (!(m.MOTavg < T.MOTavg.warn)) misses.push(`MOTavg ${m.MOTavg.toFixed(3)} ≥ ${T.MOTavg.warn}`);
    if (!(m.SI < T.SI.warn)) misses.push(`SI ${m.SI.toFixed(3)} ≥ ${T.SI.warn}`);
    if (m.rhythm.attack?.same) misses.push('RHYTHM same in attack');
    if (m.rhythm.idle?.same) misses.push('RHYTHM same in idle');
    if (j.v.HEAT === 'KALIR') misses.push('HEAT rule triggered');
    if (!(m.KEY < T.KEY.fail)) misses.push(`KEY ${m.KEY.toFixed(3)} ≥ ${T.KEY.fail}`);
    if (kv1 !== null && !(m.KEY < kv1)) misses.push(`KEY ${m.KEY.toFixed(3)} not below its v1 value ${kv1.toFixed(3)}`);
    misses.push('(+ blind eye test 100 %, §9.5)');
    a4 = { met: misses.length === 1, misses };
  }
  return { a, b, outOfPlan: !!o.outOfPlan, control: o.control, m, j, keyV1: kv1, a4 };
}

function matrixLines(rows: PairRow[]): string[] {
  const out: string[] = [];
  out.push(`  ${'pair'.padEnd(46)} ${'src'.padEnd(6)} ${['KEY', 'MOTsig', 'MOTloop', 'MOTavg', 'SI', 'RHYTHM', 'SIL0', 'HEAT'].map((h) => h.padEnd(8)).join('')}${'PAL'.padEnd(6)} verdict`);
  for (const r of rows) {
    const v = r.j.v;
    const cell = (x: number, k: Metric) => `${f3(x)}${VCH[v[k]]}`.padEnd(8);
    const rh = `${r.m.rhythm.attack?.same ? 'att' : ''}${r.m.rhythm.idle?.same ? (r.m.rhythm.attack?.same ? '+' : '') + 'idl' : ''}` || 'diff';
    out.push(
      `  ${`${r.a.tag} × ${r.b.tag}${r.outOfPlan ? ' (out of plan)' : ''}`.padEnd(46)} ${r.m.source.padEnd(6)} ${cell(r.m.KEY, 'KEY')}${cell(r.m.MOTsig, 'MOTsig')}${cell(r.m.MOTloop, 'MOTloop')}${cell(r.m.MOTavg, 'MOTavg')}${cell(r.m.SI, 'SI')}${`${rh} ${VCH[v.RHYTHM]}`.padEnd(8)}${cell(r.m.SIL0, 'SIL0')}${cell(r.m.HEAT, 'HEAT')}${f2(r.m.PAL).padEnd(6)} ${r.j.overall}`,
    );
  }
  return out;
}

function detailLines(rows: PairRow[]): string[] {
  const out: string[] = [];
  for (const r of rows) {
    out.push(`  ${r.a.tag} × ${r.b.tag} (MOT ${r.m.source}; SIloop ${r.m.SIloop.toFixed(3)}, MOTavgAll ${r.m.MOTavgAll.toFixed(3)}${r.keyV1 !== null ? `, KEY of the v1 pair ${r.keyV1.toFixed(3)}` : ''}):`);
    for (const an of Object.keys(r.m.rhythm) as Anim[]) {
      const rh = r.m.rhythm[an]!;
      out.push(`      ${an.padEnd(9)} MOT ${f3(r.m.mot[an])}${AVG_ANIMS.includes(an) ? ' ' : '*'}  rhythm ${rh.a.map((x) => Math.round(x)).join('/')} | ${rh.b.map((x) => Math.round(x)).join('/')} ${rh.same ? 'SAME' : 'diff'}`);
    }
    if (r.j.why.length) out.push(`      → ${r.j.overall}: ${r.j.why.join('; ')}`);
    if (r.a4) out.push(`      A4 target (§9.3, absolute): ${r.a4.met ? 'met by the numbers' : 'NOT met'} — ${r.a4.misses.join('; ')}`);
  }
  out.push('  (* = reported, not in MOTavg; rhythm parts: swing charge→release / release→recover / total, reaction impact→recover / total, death impact→dissolve / total, summon start→land / total, loop total / head period / body period / head lag, ms)');
  return out;
}

const pairJson = (r: PairRow) => ({
  a: r.a.tag,
  b: r.b.tag,
  outOfPlan: r.outOfPlan,
  control: r.control ?? null,
  versions: [versionOf(r.a), versionOf(r.b)],
  metrics: r.m,
  verdicts: r.j.v,
  overall: r.j.overall,
  why: r.j.why,
  keyV1: r.keyV1,
  a4: r.a4,
});

const safe = (s: string) => s.replace(/[^a-zA-Z0-9_-]+/g, '-');

// ---------------------------------------------------------------- --calib (§9.2)

if (flag('calib')) {
  fs.mkdirSync(OUT, { recursive: true });
  const ents: Entity[] = [];
  for (const id of reg.MONSTER_IDS) ents.push(regEntity(`${id}:v1`));
  for (const id of reg.MONSTER_IDS) if (reg.monsterArtV3(id)) ents.push(regEntity(`${id}:v3`));
  const byTag = new Map(ents.map((e) => [e.tag, e]));
  const L: string[] = [];
  const checks: { what: string; ok: boolean; detail: string }[] = [];
  const check = (what: string, ok: boolean, detail: string) => checks.push({ what, ok, detail });
  L.push(`sameness --calib (A3_MIMARI §9.2): ${ents.length} arts (${ents.map((e) => e.tag).join(', ')})`);
  const BASE5: Anim[] = ['attack', 'roar', 'hit', 'idle', 'guard'];
  const pairs: { a: Entity; b: Entity; proxy: PairMetrics; gate: PairMetrics; j: PairJudgement }[] = [];
  for (let i = 0; i < ents.length; i++)
    for (let k = i + 1; k < ents.length; k++) {
      const pa = prof(ents[i]);
      const pb = prof(ents[k]);
      const proxy = measurePair(pa, pb, { source: 'proxy', anims: BASE5, t: T });
      const gate = measurePair(pa, pb, { t: T });
      pairs.push({ a: ents[i], b: ents[k], proxy, gate, j: judgePair(gate, { t: T }) });
    }
  const find = (a: string, b: string) => pairs.find((p) => (p.a.tag === a && p.b.tag === b) || (p.a.tag === b && p.b.tag === a))!;
  const v1 = pairs.filter((p) => p.a.tag.endsWith(':v1') && p.b.tag.endsWith(':v1'));
  const stat = (xs: number[]) => {
    const s = [...xs].sort((x, y) => x - y);
    return { p50: s[Math.floor(s.length / 2)], p90: s[Math.floor(s.length * 0.9)], max: s[s.length - 1] };
  };
  // --- silhouette table
  L.push('', '--- silhouette metrics (judge/calib.txt): value [expected] per pair; tolerance ±0.005');
  const SIL: [string, string, number, number, number, number][] = [
    ['crystal_wyrm:v1', 'crystal_wyrm:v3', 0.88, 0.613, 0.997, 0.833],
    ['abyss_magus:v1', 'abyss_magus:v3', 0.83, 0.579, 0.955, 0.819],
    ['magma_titan:v1', 'stone_sentinel:v1', 0.662, 0.459, 0.721, 0.652],
    ['tide_golem:v1', 'stone_sentinel:v1', 0.658, 0.307, 0.651, 0.706],
    ['magma_titan:v1', 'tide_golem:v1', 0.615, 0.357, 0.646, 0.631],
    ['ember_wolf:v1', 'volt_lizard:v1', 0.545, 0.36, 0.555, 0.582],
    ['stone_sentinel:v1', 'thorn_lurker:v1', 0.65, 0.401, 0.708, 0.599],
    ['crystal_wyrm:v3', 'abyss_magus:v3', 0.509, 0.199, 0.526, 0.524],
  ];
  for (const [a, b, ...exp] of SIL) {
    const p = find(a, b).proxy;
    const got = [p.KEY, p.SI, p.SIL0, p.HEAT];
    const ok = got.every((g, i) => Math.abs(g - exp[i]) <= 0.005 + 1e-9);
    L.push(`  ${`${a} × ${b}`.padEnd(40)} ${['KEY', 'SI', 'SIL0', 'HEAT'].map((n, i) => `${n} ${got[i].toFixed(3)} [${exp[i].toFixed(3)}]`).join('  ')}  ${ok ? 'ok' : 'MISMATCH'}`);
    check(`§9.2 silhouette row ${a} × ${b}`, ok, got.map((g) => g.toFixed(3)).join(' / '));
  }
  const SILD: Record<string, [number, number, number]> = { KEY: [0.448, 0.555, 0.662], SI: [0.12, 0.284, 0.459], SIL0: [0.474, 0.573, 0.721], HEAT: [0.541, 0.64, 0.706] };
  for (const [k, exp] of Object.entries(SILD)) {
    const s = stat(v1.map((p) => p.proxy[k as 'KEY'] as number));
    const got = [s.p50, s.p90, s.max];
    const ok = got.every((g, i) => Math.abs(g - exp[i]) <= 0.005 + 1e-9);
    L.push(`  66 v1 pairs ${k.padEnd(5)} median / p90 / max ${got.map((g) => g.toFixed(3)).join(' / ')} [${exp.map((e) => e.toFixed(3)).join(' / ')}]  ${ok ? 'ok' : 'MISMATCH'}`);
    check(`§9.2 66 v1 pairs ${k}`, ok, got.map((g) => g.toFixed(3)).join(' / '));
  }
  // --- proxy MOT table
  L.push('', '--- motion, silhouette proxy MOTs (revise/mot.txt; attack / roar / hit DTW, idle / guard cyclic, 5 anims): value [expected]; tolerance ±0.01 (2 decimals), ±0.005 (3 decimals), golem × sentinel attack ±0.02');
  const MOTX: [string, string, number[]][] = [
    ['crystal_wyrm:v1', 'crystal_wyrm:v3', [0.93, 0.84, 0.86, 0.75, 1.0, 0.932, 0.996, 0.875]],
    ['abyss_magus:v1', 'abyss_magus:v3', [0.83, 0.94, 0.75, 0.44, 0.98, 0.939, 0.985, 0.789]],
    ['tide_golem:v1', 'stone_sentinel:v1', [0.59, 0.05, 0.55, 0.43, -0.04, 0.593, 0.434, 0.316]],
    ['magma_titan:v1', 'stone_sentinel:v1', [0.42, -0.2, 0.12, 0.08, -0.62, 0.418, 0.075, -0.041]],
    ['magma_titan:v1', 'tide_golem:v1', [0.21, 0.69, -0.19, 0.22, 0.59, 0.691, 0.591, 0.304]],
    ['ember_wolf:v1', 'volt_lizard:v1', [0.4, 0.6, 0.12, 0.3, 0.56, 0.597, 0.562, 0.396]],
    ['crystal_wyrm:v3', 'abyss_magus:v3', [0.2, 0.35, 0.86, 0.16, 0.61, 0.347, 0.612, 0.436]],
  ];
  const motRow = (m: PairMetrics) => [m.mot.attack!, m.mot.roar!, m.mot.hit!, m.mot.idle!, m.mot.guard!, m.MOTsig, m.MOTloop, m.MOTavg];
  const MOTN = ['attack', 'roar', 'hit', 'idle', 'guard', 'MOTsig', 'MOTloop', 'MOTavg'];
  for (const [a, b, exp] of MOTX) {
    const got = motRow(find(a, b).proxy);
    const tol = (i: number) => (i >= 5 ? 0.005 : a === 'tide_golem:v1' && i === 0 ? 0.02 : 0.01) + 1e-9;
    const ok = got.every((g, i) => Math.abs(g - exp[i]) <= tol(i));
    L.push(`  ${`${a} × ${b}`.padEnd(40)} ${MOTN.map((n, i) => `${n} ${i >= 5 ? got[i].toFixed(3) : got[i].toFixed(2)} [${i >= 5 ? exp[i].toFixed(3) : exp[i].toFixed(2)}]`).join(' ')}  ${ok ? 'ok' : 'MISMATCH'}`);
    check(`§9.2 proxy MOT row ${a} × ${b}`, ok, got.map((g) => g.toFixed(3)).join(' / '));
  }
  {
    const g = find('tide_golem:v1', 'stone_sentinel:v1').proxy.mot.attack!;
    check('Y6: golem × sentinel MOTs attack 0.59 ± 0.02', Math.abs(g - 0.59) <= 0.02, g.toFixed(3));
  }
  const MOTD: Record<string, [number, number, number]> = { attack: [0.27, 0.48, 0.875], idle: [0.21, 0.55, 0.7], guard: [0.44, 0.68, 0.97], MOTsig: [0.42, 0.68, 0.875], MOTloop: [0.46, 0.69, 0.97], MOTavg: [0.29, 0.51, 0.62] };
  for (const [k, exp] of Object.entries(MOTD)) {
    const xs = v1.map((p) => (k in p.proxy.mot ? p.proxy.mot[k as Anim]! : (p.proxy[k as 'MOTsig'] as number)));
    const s = stat(xs);
    const got = [s.p50, s.p90, s.max];
    const ok = got.every((x, i) => Math.abs(x - exp[i]) <= (i === 2 && k !== 'idle' ? 0.005 : 0.01) + 1e-9);
    L.push(`  66 v1 pairs ${k.padEnd(7)} median / p90 / max ${got.map((x) => x.toFixed(3)).join(' / ')} [${exp.join(' / ')}]  ${ok ? 'ok' : 'MISMATCH'}`);
    check(`§9.2 proxy 66 v1 pairs ${k}`, ok, got.map((x) => x.toFixed(3)).join(' / '));
  }
  // --- gate definition values (§9.1 source per pair; MOTavg over the base five)
  L.push('', '--- gate values (§9.1 track source per pair: points where both arts have them, else the proxy; MOTavg over attack/roar/hit/idle/guard)');
  const focus: [string, string][] = [
    ['crystal_wyrm:v1', 'crystal_wyrm:v3'],
    ['abyss_magus:v1', 'abyss_magus:v3'],
    ['magma_titan:v1', 'stone_sentinel:v1'],
    ['tide_golem:v1', 'stone_sentinel:v1'],
    ['magma_titan:v1', 'tide_golem:v1'],
    ['ember_wolf:v1', 'volt_lizard:v1'],
    ['crystal_wyrm:v3', 'abyss_magus:v3'],
  ];
  const focusRows = focus.map(([a, b]) => {
    const p = find(a, b);
    return { a: p.a, b: p.b, outOfPlan: false, m: p.gate, j: p.j, keyV1: null, a4: null } as PairRow;
  });
  L.push(...matrixLines(focusRows));
  L.push(...detailLines(focusRows.slice(-1)));
  {
    const sl = find('crystal_wyrm:v3', 'abyss_magus:v3');
    const pr = measurePair(prof(sl.a), prof(sl.b), { source: 'proxy', t: T });
    L.push(`  slice pair, proxy over the same anims: MOTsig ${pr.MOTsig.toFixed(3)} MOTloop ${pr.MOTloop.toFixed(3)} MOTavg ${pr.MOTavg.toFixed(3)} (MOTavgAll ${pr.MOTavgAll.toFixed(3)}); points MOTavgAll ${sl.gate.MOTavgAll.toFixed(3)}`);
  }
  // --- verdicts of the heavy trio (§9.3 "Sınama") and the distribution over the 66 v1 pairs
  L.push('', '--- §9.3 test on the v1 heavy trio (gate verdicts)');
  for (const [a, b, want] of [
    ['tide_golem:v1', 'stone_sentinel:v1', 'KALIR'],
    ['magma_titan:v1', 'tide_golem:v1', 'KALIR'],
    ['magma_titan:v1', 'stone_sentinel:v1', 'UYARI'],
  ] as const) {
    const p = find(a, b);
    L.push(`  ${`${a} × ${b}`.padEnd(40)} ${p.j.overall} [${want}]: ${p.j.why.join('; ')}`);
    check(`§9.3 test ${a} × ${b} = ${want}`, p.j.overall === want, p.j.overall);
  }
  const dist = (k: 'MOTsig' | 'MOTloop' | 'MOTavg') => {
    const vs = v1.map((p) => p.j.v[k]);
    return `${vs.filter((v) => v === 'UYARI').length} UYARI / ${vs.filter((v) => v === 'KALIR').length} KALIR`;
  };
  L.push(`  66 v1 pairs: MOTsig ${dist('MOTsig')} [15 / 3], MOTloop ${dist('MOTloop')} [8 / 3], MOTavg ${dist('MOTavg')} [13 / 0]; overall ${['GEÇER', 'UYARI', 'KALIR'].map((v) => `${v} ${v1.filter((p) => p.j.overall === v).length}`).join(', ')}`);
  // --- acceptance controls
  L.push('', '--- calibration acceptance (§9.2 (a)–(g)); (b) needs plan members (Y9)');
  const ctlRows: PairRow[] = [];
  for (const e of ents) {
    const ca = colourShifted(e);
    const cc = jittered(e);
    const ra = runPair(e, ca, { control: { id: 'a', required: ['KEY', 'MOTsig', 'MOTloop', 'MOTavg'] } });
    const rc = runPair(e, cc, { control: { id: 'c', required: ['KEY', 'MOTsig', 'MOTloop', 'MOTavg'] } });
    ctlRows.push(ra, rc);
    const pc = measurePair(prof(e), prof(cc), { source: 'proxy', anims: BASE5, t: T });
    const pa = measurePair(prof(e), prof(ca), { source: 'proxy', t: T });
    L.push(
      `  ${e.tag.padEnd(18)} (a) colour [${ra.m.source}] KEY ${ra.m.KEY.toFixed(3)} sig ${ra.m.MOTsig.toFixed(3)} loop ${ra.m.MOTloop.toFixed(3)} avg ${ra.m.MOTavg.toFixed(3)} → ${controlHeld(ra.j, ra.control!.required) ? 'KALIR ok' : 'NOT KALIR'}` +
        ` (proxy ${pa.MOTsig.toFixed(2)}/${pa.MOTloop.toFixed(2)}/${pa.MOTavg.toFixed(2)})` +
        ` | (c) ±60 ms [${rc.m.source}] KEY ${rc.m.KEY.toFixed(3)} sig ${rc.m.MOTsig.toFixed(3)} loop ${rc.m.MOTloop.toFixed(3)} avg ${rc.m.MOTavg.toFixed(3)} → ${controlHeld(rc.j, rc.control!.required) ? 'KALIR ok' : 'NOT KALIR'}` +
        ` (proxy sig ${pc.MOTsig.toFixed(3)} loop ${pc.MOTloop.toFixed(3)} avg ${pc.MOTavg.toFixed(3)})`,
    );
    check(`(a) colour change ${e.tag} → KALIR`, controlHeld(ra.j, ra.control!.required), ra.j.overall);
    check(`(c) ±60 ms holds ${e.tag} → KALIR`, controlHeld(rc.j, rc.control!.required), rc.j.overall);
    // §9.2 states these to two decimals ("MOTsig 1,00, MOTloop ≥ 0,99, MOTavg ≥ 0,97"): compared at that precision
    const r2 = (x: number) => Math.round(x * 100) / 100;
    check(`(c) proxy ${e.tag}: MOTsig 1.00, MOTloop ≥ 0.99, MOTavg ≥ 0.97 (2 decimals)`, r2(pc.MOTsig) >= 1 && r2(pc.MOTloop) >= 0.99 && r2(pc.MOTavg) >= 0.97, `${pc.MOTsig.toFixed(3)} / ${pc.MOTloop.toFixed(3)} / ${pc.MOTavg.toFixed(3)}`);
  }
  for (const id of ['crystal_wyrm', 'abyss_magus']) {
    const p = find(`${id}:v1`, `${id}:v3`);
    L.push(`  (d) ${id} v1 → v3 [${p.gate.source}] MOTavg ${p.gate.MOTavg.toFixed(3)} (need ≥ 0.70)`);
    check(`(d) same character ${id} v1 → v3 MOTavg ≥ 0.70`, p.gate.MOTavg >= 0.7, p.gate.MOTavg.toFixed(3));
  }
  {
    const p = find('tide_golem:v1', 'stone_sentinel:v1');
    L.push(`  (e) v1 golem × sentinel → ${p.j.overall} (must not be GEÇER): ${p.j.why.join('; ')}`);
    check('(e) v1 golem × sentinel not GEÇER', p.j.overall !== 'GEÇER', p.j.overall);
  }
  {
    const md = { MOTsig: median(v1.map((p) => p.gate.MOTsig)), MOTloop: median(v1.map((p) => p.gate.MOTloop)), MOTavg: median(v1.map((p) => p.gate.MOTavg)) };
    const ok = md.MOTsig < T.MOTsig.warn && md.MOTloop < T.MOTloop.warn && md.MOTavg < T.MOTavg.warn;
    L.push(`  (f) 66 v1 pairs medians MOTsig ${md.MOTsig.toFixed(3)} MOTloop ${md.MOTloop.toFixed(3)} MOTavg ${md.MOTavg.toFixed(3)} (GEÇER band < ${T.MOTsig.warn} / ${T.MOTloop.warn} / ${T.MOTavg.warn})`);
    check('(f) 66 v1 pair medians in the GEÇER band', ok, `${md.MOTsig.toFixed(3)} / ${md.MOTloop.toFixed(3)} / ${md.MOTavg.toFixed(3)}`);
  }
  {
    const p = find('crystal_wyrm:v3', 'abyss_magus:v3');
    const pr = measurePair(prof(p.a), prof(p.b), { source: 'proxy', t: T });
    const jp = judgePair(pr, { t: T });
    const okG = (['MOTsig', 'MOTloop', 'MOTavg'] as const).every((k) => p.j.v[k] === 'GEÇER');
    const okP = (['MOTsig', 'MOTloop', 'MOTavg'] as const).every((k) => jp.v[k] === 'GEÇER');
    L.push(`  (g) slice pair [${p.gate.source}] MOTsig ${p.gate.MOTsig.toFixed(3)} MOTloop ${p.gate.MOTloop.toFixed(3)} MOTavg ${p.gate.MOTavg.toFixed(3)} → ${okG ? 'GEÇER ×3 ok' : 'NOT GEÇER'}; [proxy] ${pr.MOTsig.toFixed(3)} / ${pr.MOTloop.toFixed(3)} / ${pr.MOTavg.toFixed(3)} → ${okP ? 'GEÇER ×3 ok' : 'NOT GEÇER'}; overall ${p.j.overall}${p.j.why.length ? ` (${p.j.why.join('; ')})` : ''}`);
    check(`(g) slice pair GEÇER on the three MOT values, ${p.gate.source} tracks`, okG && p.gate.source === 'points', `${p.gate.MOTsig.toFixed(3)} / ${p.gate.MOTloop.toFixed(3)} / ${p.gate.MOTavg.toFixed(3)}`);
    check('(g) slice pair GEÇER on the three MOT values, proxy', okP, `${pr.MOTsig.toFixed(3)} / ${pr.MOTloop.toFixed(3)} / ${pr.MOTavg.toFixed(3)}`);
  }
  const failed = checks.filter((c) => !c.ok);
  L.push('', `checks: ${checks.length}, failed ${failed.length}${failed.length ? ':\n  ' + failed.map((c) => `${c.what} (${c.detail})`).join('\n  ') : ''}`);
  L.push(`[sameness --calib] ${profiles.size} profiles, ${pairs.length} pairs + ${ctlRows.length} controls in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  const txt = L.join('\n');
  console.log(txt);
  fs.writeFileSync(path.join(OUT, 'calib.txt'), txt + '\n');
  fs.writeFileSync(
    path.join(OUT, 'calib.json'),
    JSON.stringify({ tool: 'tools/sameness.ts --calib', thresholds: T, checks, pairs: pairs.map((p) => ({ a: p.a.tag, b: p.b.tag, proxy5: p.proxy, gate: p.gate, verdicts: p.j.v, overall: p.j.overall })), controls: ctlRows.map(pairJson) }, null, 1),
  );
  console.log(`[sameness] → ${rel(path.join(OUT, 'calib.txt'))}, calib.json`);
  process.exit(failed.length ? 3 : 0);
}

// ---------------------------------------------------------------- members and pairs

const PLAN = arg('plan');
const members: Entity[] = [];
const addMember = (e: Entity) => {
  if (!members.some((m) => m.tag === e.tag)) members.push(e);
};
if (PLAN) for (const id of reg.MONSTER_IDS) if (reg.monsterArt(id).bodyPlan?.id === PLAN) addMember(regEntity(id));
for (const s of args('ids')) addMember(regEntity(s));
const draftTags = new Set<string>();
for (const file of args('art')) {
  const art = await loadArtFile(file);
  let tag = `${art.id}:draft`;
  if (draftTags.has(tag)) tag = `${art.id}:${path.basename(file).replace(/\.[^.]+$/, '')}`;
  draftTags.add(tag);
  addMember(makeEntity(tag, art));
}
if (!PLAN && !args('ids').length && !args('art').length) usage('name the members: --plan ID, --ids a,b or --art FILE');

const L: string[] = [];
L.push(`sameness — look ${LOOK}${PLAN ? `, plan ${PLAN}` : ''}; members (${members.length}): ${members.map((m) => `${m.tag} [${versionOf(m)}${m.plan ? `, plan ${m.plan}` : ''}, tracks ${prof(m).sources.join('/')}]`).join(', ') || '-'}`);
if (PLAN && !members.some((m) => m.plan === PLAN)) L.push(`  note: no registry art is built on plan '${PLAN}' yet (MonsterArt.bodyPlan); only the named members are compared`);
if (arg('thresholds')) L.push(`  thresholds overridden from ${arg('thresholds')}: ${JSON.stringify(T)}`);

const rows: PairRow[] = [];
for (let i = 0; i < members.length; i++)
  for (let k = i + 1; k < members.length; k++) if (members[i].id !== members[k].id) rows.push(runPair(members[i], members[k]));
if (arg('against') === 'all') {
  const ids = new Set(members.map((m) => m.id));
  for (const m of members) for (const id of reg.MONSTER_IDS) if (!ids.has(id)) rows.push(runPair(m, regEntity(id), { outOfPlan: true }));
} else if (arg('against')) usage(`--against takes 'all' (got ${arg('against')})`);

// ---------------------------------------------------------------- controls

const ctlRows: PairRow[] = [];
if (flag('controls')) {
  for (const m of members) {
    ctlRows.push(runPair(m, colourShifted(m), { control: { id: 'a', required: ['KEY', 'MOTsig', 'MOTloop', 'MOTavg'] } }));
    ctlRows.push(runPair(m, jittered(m), { control: { id: 'c', required: ['KEY', 'MOTsig', 'MOTloop', 'MOTavg'] } }));
  }
  for (const spec of args('cross')) {
    const [file, id] = spec.split(':');
    const of = members.find((m) => m.tag === id || m.id === id) ?? (id ? regEntity(id) : usage(`--cross FILE:ID (got ${spec})`));
    const art = await loadArtFile(file);
    const cross = makeEntity(`${art.id}:cross`, art, { control: 'b', of: of.tag });
    ctlRows.push(runPair(of, cross, { control: { id: 'b', required: ['MOTsig', 'MOTloop'] } }));
    ctlRows.push(runPair(of, jittered(cross), { control: { id: 'c', required: ['MOTsig', 'MOTloop'] } }));
  }
}
const controlsHeld = ctlRows.every((r) => controlHeld(r.j, r.control!.required));

// ---------------------------------------------------------------- report

L.push('', 'pair matrix (G GEÇER · U UYARI · K KALIR; §9.3 bands):');
L.push(...(rows.length ? matrixLines(rows) : ['  (no pair: fewer than two members with different ids)']));
if (rows.length) L.push('', 'per anim: MOT and rhythm', ...detailLines(rows));
if (flag('controls')) {
  L.push('', `controls (§9.4: each must come out KALIR on its metrics, else exit 3): ${controlsHeld ? 'all held' : 'NOT ALL HELD — the metric is blind'}`);
  L.push(...matrixLines(ctlRows));
  for (const r of ctlRows) L.push(`  (${r.control!.id}) ${r.a.tag} × ${r.b.tag}: needs KALIR on ${r.control!.required.join(', ')} → ${controlHeld(r.j, r.control!.required) ? 'held' : `NOT HELD (${r.control!.required.filter((k) => r.j.v[k] !== 'KALIR').map((k) => `${k} ${r.j.v[k]}`).join(', ')})`}`);
  if (!args('cross').length) L.push('  (b) cross build: not run (needs --cross FILE:ID with a planArt-built synthetic member, Y9)');
}

fs.mkdirSync(OUT, { recursive: true });
const pngs: string[] = [];
for (const r of rows)
  if (OVERLAYS === 'all' || (OVERLAYS === 'warn' && r.j.overall !== 'GEÇER')) {
    const file = path.join(OUT, `${safe(r.a.tag)}__${safe(r.b.tag)}.png`);
    overlayPng(prof(r.a), prof(r.b), r.m, r.j, file);
    pngs.push(rel(file));
  }

// ---------------------------------------------------------------- blind pages (§9.5)

if (arg('blind')) {
  const DIR = path.resolve(arg('blind')!);
  const KEYDIR = arg('key-out') ? path.resolve(arg('key-out')!) : usage('--blind needs --key-out KEYDIR (the answer key goes to a separate directory)');
  if (KEYDIR === DIR || KEYDIR.startsWith(DIR + path.sep)) usage('--key-out must not be the blind directory or inside it');
  if (members.length < 2) usage('--blind needs at least two members');
  const seed = Number(arg('seed') ?? 1);
  const rnd = prng(seed);
  const tone = PAL.mist;
  const k3 = 3;
  // ref.png: named idle f0 of every member
  {
    const cw = GRID_W + 8;
    const head = 'ref: her üyenin idle f0 silüeti (adlı)';
    const p = new PixelCanvas(Math.max(4 + members.length * cw, 8 + textWidth(head)), GRID_H + 26);
    p.rect(0, 0, p.w, p.h, PAL.night1);
    text(p, 4, 3, head, DIM);
    members.forEach((m, i) => {
      const x = 4 + i * cw;
      text(p, x, 13, m.tag, TXT);
      blitMask(p, prof(m).key[0], x, 22, 1, tone);
    });
    writePng(p, path.join(DIR, 'ref.png'), k3, PAL.night1);
  }
  // sil.png: coded silhouettes
  const silKey: BlindKey['silhouettes'] = {};
  {
    const cells: { member: string; pose: string; mask: Uint8Array }[] = [];
    for (const m of members) {
      const e = m;
      const pr = prof(e);
      const H = pr.H;
      const st = e.store;
      const roarPeak = releaseFrame(e, 'roar');
      cells.push({ member: m.tag, pose: 'attack release', mask: pr.key[1] });
      cells.push({ member: m.tag, pose: `roar peak (f${roarPeak})`, mask: normMask(e.art, st.get('roar', roarPeak), H) });
      cells.push({ member: m.tag, pose: 'hit f0', mask: pr.key[2] });
      cells.push({ member: m.tag, pose: 'guard f0', mask: normMask(e.art, st.get('guard', 0), H) });
    }
    const order = shuffled(cells, rnd);
    const cols = 4;
    const cw = GRID_W + 8;
    const ch = GRID_H + 12;
    const head = 'sil: kodlu silüetler — her kodu bir üyeye ata';
    const p = new PixelCanvas(Math.max(4 + cols * cw, 8 + textWidth(head)), 14 + Math.ceil(order.length / cols) * ch);
    p.rect(0, 0, p.w, p.h, PAL.night1);
    text(p, 4, 3, head, DIM);
    order.forEach((c, i) => {
      const code = `S${String(i + 1).padStart(2, '0')}`;
      silKey[code] = { member: c.member, pose: c.pose };
      const x = 4 + (i % cols) * cw;
      const y = 14 + Math.floor(i / cols) * ch;
      text(p, x, y, code, TXT);
      blitMask(p, c.mask, x, y + 9, 1, tone);
    });
    writePng(p, path.join(DIR, 'sil.png'), k3, PAL.night1);
  }
  // motion.png: coded strip pairs on a neutral stick body
  const pairKey: BlindKey['pairs'] = {};
  {
    const all = members.map((m) => prof(m));
    const src: MotSource = (['joints', 'points'] as const).find((s) => all.every((p) => p.sources.includes(s))) ?? 'proxy';
    const names = (anim: Anim) => all.reduce<string[]>((acc, p) => acc.filter((n) => p.anims[anim]?.tracks[src]?.names.includes(n)), all[0].anims[anim]!.tracks[src]!.names);
    const items: { left: Entity; right: Entity; control: boolean }[] = [];
    for (let i = 0; i < members.length; i++) for (let k = i + 1; k < members.length; k++) if (members[i].id !== members[k].id) items.push({ left: members[i], right: members[k], control: false });
    for (const m of members) items.push({ left: m, right: jittered(m), control: true });
    const order = shuffled(items, rnd).map((it) => (rnd() < 0.5 ? it : { left: it.right, right: it.left, control: it.control }));
    const POSES = [1, 4, 7, 10, 13, 16, 19, 22];
    // idle loops move a few px: both strips of a pair get the same ×IDLE_GAIN so the motion is readable
    const IDLE_GAIN = 3;
    const CW = 64;
    const CH = 74;
    const stripH = CH + 2;
    const pairH = 12 + 4 * stripH + 8;
    const head1 = `motion: her kodlu çift iki şerittir (1, 2): attack ve idle döngüsü, ortak çöp gövdede (${src})`;
    const head2 = `idle hareketi ×${IDLE_GAIN} büyütüldü (iki şeritte de aynı) — iki şerit aynı üyenin hareketi mi? "aynı" / "farklı"`;
    const W = Math.max(4 + 22 + POSES.length * CW, 8 + textWidth(head1), 8 + textWidth(head2));
    const p = new PixelCanvas(W, 23 + order.length * pairH);
    p.rect(0, 0, p.w, p.h, PAL.night1);
    text(p, 4, 3, head1, DIM);
    text(p, 4, 12, head2, DIM);
    order.forEach((it, i) => {
      const code = `M${String(i + 1).padStart(2, '0')}`;
      const tagOf = (e: Entity) => (e.control === 'c' ? e.of! : e.tag);
      pairKey[code] = { left: tagOf(it.left), right: tagOf(it.right), same: tagOf(it.left) === tagOf(it.right), control: it.control };
      const y0 = 23 + i * pairH;
      text(p, 4, y0, code, TXT);
      const strips: [string, Entity, Anim][] = [
        ['1', it.left, 'attack'],
        ['2', it.right, 'attack'],
        ['1', it.left, 'idle'],
        ['2', it.right, 'idle'],
      ];
      strips.forEach(([lab, e, anim], si) => {
        const y = y0 + 10 + si * stripH;
        text(p, 4, y + 2, `${lab}`, TXT);
        text(p, 4, y + 11, anim === 'attack' ? 'atk' : 'idle', DIM);
        if (anim === 'idle') text(p, 4, y + 20, `×${IDLE_GAIN}`, DIM);
        const t = prof(e).anims[anim]!.tracks[src]!;
        const ns = names(anim);
        const bones = bonesOf(src, ns);
        POSES.forEach((s, c) => {
          const x = 4 + 22 + c * CW;
          p.rect(x, y, CW - 2, CH, PAL.night0);
          drawStick(p, poseAt(t, ns, s, src, anim === 'idle' ? IDLE_GAIN : 1), x + CW / 2 - 1, y + CH - 8, bones, tone, PAL.white);
        });
      });
    });
    writePng(p, path.join(DIR, 'motion.png'), k3, PAL.night1);
  }
  const form: BlindForm & { tool: string; talimat: string } = {
    tool: 'tools/sameness.ts --blind',
    talimat:
      'ref.png her üyenin adlı idle f0 silüetini gösterir. sil.png içindeki her kodu (S01…) bir üye adıyla doldur. motion.png içindeki her çift (M01…) iki şerittir (1 ve 2: attack ve idle döngüsü, aynı çöp gövdede); aynı üyenin hareketi ise "aynı", değilse "farklı" yaz.',
    members: members.map((m) => m.tag),
    silhouettes: Object.fromEntries(Object.keys(silKey).map((c) => [c, ''])),
    pairs: Object.fromEntries(Object.keys(pairKey).map((c) => [c, ''])),
  };
  const key: BlindKey = { tool: 'tools/sameness.ts --blind', seed, members: members.map((m) => m.tag), silhouettes: silKey, pairs: pairKey };
  fs.mkdirSync(DIR, { recursive: true });
  fs.mkdirSync(KEYDIR, { recursive: true });
  fs.writeFileSync(path.join(DIR, 'form.json'), JSON.stringify(form, null, 1));
  fs.writeFileSync(path.join(KEYDIR, 'key.json'), JSON.stringify(key, null, 1));
  L.push('', `blind pages (§9.5): ${rel(DIR)}/{ref,sil,motion}.png + form.json (${Object.keys(silKey).length} silhouettes, ${Object.keys(pairKey).length} motion pairs of which ${Object.values(pairKey).filter((x) => x.control).length} controls; seed ${seed}); key → ${rel(path.join(KEYDIR, 'key.json'))}`);
}

const code = exitCode(
  rows.map((r) => r.j.overall),
  controlsHeld,
);
L.push('', `overlays: ${pngs.length ? pngs.join(', ') : '-'}`);
L.push(`[sameness] ${profiles.size} profiles, ${rows.length} pairs${ctlRows.length ? ` + ${ctlRows.length} controls` : ''} in ${((Date.now() - t0) / 1000).toFixed(1)} s → ${rel(path.join(OUT, 'sameness.txt'))}, sameness.json; worst ${worst(rows.map((r) => r.j.overall))}${flag('controls') ? `, controls ${controlsHeld ? 'held' : 'NOT held'}` : ''}; exit ${code}`);
const txt = L.join('\n');
const json = { tool: 'tools/sameness.ts', look: LOOK, plan: PLAN ?? null, members: members.map((m) => ({ tag: m.tag, id: m.id, version: versionOf(m), plan: m.plan, sources: prof(m).sources })), thresholds: T, pairs: rows.map(pairJson), controls: ctlRows.map(pairJson), controlsHeld, overlays: pngs, exit: code };
fs.writeFileSync(path.join(OUT, 'sameness.txt'), txt + '\n');
fs.writeFileSync(path.join(OUT, 'sameness.json'), JSON.stringify(json, null, 1));
console.log(flag('json') ? JSON.stringify(json, null, 1) : txt);
process.exit(code);
