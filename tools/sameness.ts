// Sameness gate (docs/v3/A3_MIMARI.md §9, docs/v3/REHBER.md §8.2.1; A3 build row Y6): are two monsters
// of the same body plan (or archetype) more than recoloured copies of each other — in silhouette,
// motion path, rhythm, idle / guard loops? Node, deterministic, measured on the game's own frames.
//
//   npx vite-node tools/sameness.ts --look v3 --plan biped [--ids a,b] [--against all] [--art FILE]…
//       [--anims attack,roar,hit,idle,guard] [--controls] [--cross FILE:ID] [--blind DIR --key-out KEYDIR]
//       [--seed N] [--out DIR] [--json] [--thresholds FILE] [--source joints|points|proxy]
//       [--overlays warn|all|none]
//   npx vite-node tools/sameness.ts --score DIR/form.json --key KEYDIR/key.json [--note FILE]
//   npx vite-node tools/sameness.ts --calib [--art FILE]… [--cross FILE:ID]… [--out DIR]
//
// Members: --plan P = every registry art (under --look) whose MonsterArt.bodyPlan.id is P; --ids a,b
// names them ('id' = the art the look draws, 'id:v1' / 'id:v3' forces one); --art FILE adds an
// unregistered draft (its default export; tag '<id>:draft'). A member pair (different ids) of ONE body
// plan — or of two hand-made arts without a plan, like the slice pair — is a gate pair; members of
// different plans (biped × serpent, a plan member × a hand-made ace) are an OUT-OF-PLAN pair (A4.1).
// --against all adds every member × every other registry art as an OUT-OF-PLAN pair. Out of plan: measured
// the same way, a KALIR there counts as UYARI (blind eye test), it never blocks; the matrix marks the
// metrics that reached the KALIR line with '!' (e.g. "0.820U!").
//
// Metrics (tools/lib/sameness-metrics.ts, tools/lib/tracks.ts): KEY, MOT (sig / loop / avg, per anim),
// SI (+ SIloop, reported), RHYTHM, SIL0, HEAT, PAL; bands of §9.3 (GEÇER / UYARI / KALIR). The MOT track
// source of a pair: joints() when both arts have them (plan members), else points() (other v3 art),
// else the silhouette proxy (v1).
//
// Output (--out, default shots/v3/a3/sameness): sameness.txt / .json (pair matrix, per-anim MOT +
// rhythm table, reasons, controls, the A4 target check with its margins), and for every UYARI / KALIR
// pair one overlay PNG <a>__<b>.png ×3: the key-pose silhouettes (A red, B blue, both light), the HEAT
// masks and the track paths of both monsters on a neutral skeleton (time runs dark → bright; a panel
// whose motion is small — loops, hits — is magnified by a whole-number gain, "×g" in its title). LOOK
// at them.
//
// --controls (§9.4): (a) colour — each member × its ramp-shifted copy; (c) ±60 ms — each member × itself
// with every hold moved ±60 ms; (b) cross build — --cross FILE:ID, FILE default-exporting the synthetic
// member built with member ID's anims on another member's build / parts (planArt; Y9), compared with
// ID (+ its ±60 ms version). A control holds when it comes out KALIR on its metrics AND sits in the upper
// half of the KALIR band on each band metric (value ≥ fail + CONTROL_MARGIN × (1 − fail): KEY / MOTavg ≥ 0.85,
// MOTsig ≥ 0.90, MOTloop ≥ 0.925; A4.1); else exit 3 ("the metric is blind": the gate cannot be used with
// that definition). "depth" = where a control sits in the band, worst metric (1 = a perfect copy).
//
// --blind DIR (§9.5): ref.png (each member's NAMED idle f0, one tone, 56 px, ×3), sil.png (shuffled
// CODED silhouettes: attack release, roar peak, hit f0, guard f0), motion.png (coded PAIRS of strips:
// attack, roar (A4.1: MOTsig is max(attack, roar), so a roar-driven UYARI is put in front of the eye too)
// and idle loop on a common neutral stick body driven by each member's tracks; some pairs are controls:
// one member twice, one strip with ±60 ms holds), form.json (blank answers). The answer key goes to
// --key-out KEYDIR (a separate directory the reviewer never sees). --score scores a filled form.
//
// --calib: the §9.2 calibration (12 v1 monsters + the slice): reproduces the silhouette and proxy
// tables, checks the acceptance controls (a), (c)–(g) and prints the gate definition's values; then the
// A4.1 recalibration on the v3 members (the registered v3 arts + every --art draft; --cross FILE:ID adds
// control (b)): their pair matrix, same-character v1 → v3 rows, the controls with their margins and the
// distribution against the §9.3 bands. Exit 3 when a check fails.
//
// Exit: 0 clean · 1 a UYARI · 2 a KALIR · 3 a control did not hold. --score: 0 pass · 2 a pair failed
// (KALIR) · 3 the reviewer failed the control pairs (the test is void).

import fs from 'node:fs';
import path from 'node:path';
import { frameMs } from '../src/art/animtime';
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
  BAND_METRICS,
  CONTROL_MARGIN,
  METRICS,
  controlFloor,
  controlHeld,
  controlMargin,
  exitCode,
  iou,
  judgePair,
  median,
  outOfPlan,
  panelGain,
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
  pairSource,
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
/** The lowest values that keep a control held (upper half of each KALIR band), for the report. */
const FLOORS = BAND_METRICS.filter((k) => k !== 'SI').map((k) => `${k} ≥ ${+controlFloor(k, T).toFixed(3)}`).join(', ');
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
  const legend = 'silhouettes: red = A only, blue = B only, light = both · tracks on a neutral body: A red, B blue, time dark → bright, ×g magnified · gold title = same rhythm';
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
    // small motions (loops, hits) are magnified by a whole-number gain so their paths can be read
    let maxPx = 0;
    for (const t of [ta, tb])
      for (const row of t.data)
        for (const n of names) {
          const k = t.names.indexOf(n);
          maxPx = Math.max(maxPx, Math.hypot(row[2 * k], row[2 * k + 1]) * NORM_H);
        }
    const gain = panelGain(maxPx, 16);
    text(p, x, yy, `${an} MOT ${f2(m.mot[an])}${gain > 1 ? ` ×${gain}` : ''}`, r?.same ? PAL.gold3 : DIM);
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
          const pt = poseAt(t, [n], s, src, gain).get(n)!;
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
  /** the verdicts before the out-of-plan rule turned a KALIR into UYARI */
  raw: PairJudgement['v'];
  keyV1: number | null;
  a4: { met: boolean; misses: string[]; margins: string[] } | null;
}

/** The rhythm components (index → name) of an anim kind, for "differs on …" notes. */
function rhythmDiffs(an: Anim, ra: number[], rb: number[]): string[] {
  const names = an === 'idle' || an === 'guard' ? ['total', 'head period', 'body period', 'head lag'] : ['charge→release', 'release→recover', 'total'];
  return ra.map((x, i) => (Math.abs(x - rb[i]) > Math.max(T.RHYTHM.ms, T.RHYTHM.pct * Math.max(Math.abs(x), Math.abs(rb[i]))) ? `${names[i] ?? i} ${Math.round(x)}/${Math.round(rb[i])}` : '')).filter(Boolean);
}

function runPair(a: Entity, b: Entity, o: { outOfPlan?: boolean; control?: PairRow['control'] } = {}): PairRow {
  const m = measurePair(prof(a), prof(b), { source: SOURCE, anims: ANIMS, t: T });
  const newCard = !reg.MONSTER_IDS.includes(a.id) || !reg.MONSTER_IDS.includes(b.id);
  const jo: JudgeOpts = { t: T, outOfPlan: o.outOfPlan, newCard };
  const j = judgePair(m, jo);
  const raw = o.outOfPlan ? judgePair(m, { ...jo, outOfPlan: false }).v : j.v;
  const kv1 = o.control ? null : keyV1(a, b);
  let a4: PairRow['a4'] = null;
  // the A4 absolute target (§9.3) is for the members of one body plan (the heavy trio, the quadrupeds)
  if (!o.control && !o.outOfPlan && a.plan !== null && a.plan === b.plan) {
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
    // how far inside each condition the pair sits: a thin margin is a design risk the numbers alone hide
    const margins = [
      `MOTsig ${(T.MOTsig.warn - m.MOTsig).toFixed(3)}`,
      `MOTloop ${(T.MOTloop.warn - m.MOTloop).toFixed(3)}`,
      `MOTavg ${(T.MOTavg.warn - m.MOTavg).toFixed(3)}`,
      `SI ${(T.SI.warn - m.SI).toFixed(3)}`,
      `KEY ${(T.KEY.fail - m.KEY).toFixed(3)} below ${T.KEY.fail}${kv1 !== null ? `, ${(kv1 - m.KEY).toFixed(3)} below its v1 value` : ''}`,
      `HEAT ${(T.HEAT.warn - m.HEAT).toFixed(3)}`,
      ...(['attack', 'idle'] as const).filter((an) => m.rhythm[an]).map((an) => `RHYTHM ${an} differs on ${rhythmDiffs(an, m.rhythm[an]!.a, m.rhythm[an]!.b).join(', ') || 'nothing'}`),
    ];
    a4 = { met: misses.length === 1, misses, margins };
  }
  return { a, b, outOfPlan: !!o.outOfPlan, control: o.control, m, j, raw, keyV1: kv1, a4 };
}

function matrixLines(rows: PairRow[]): string[] {
  const out: string[] = [];
  out.push(`  ${'pair'.padEnd(46)} ${'src'.padEnd(6)} ${['KEY', 'MOTsig', 'MOTloop', 'MOTavg', 'SI', 'RHYTHM', 'SIL0', 'HEAT'].map((h) => h.padEnd(8)).join('')}${'PAL'.padEnd(6)} verdict`);
  for (const r of rows) {
    const v = r.j.v;
    // '!' = out of plan, this metric reached the KALIR line (counted as UYARI: blind eye test)
    const bang = (k: Metric) => (r.raw[k] === 'KALIR' && v[k] !== 'KALIR' ? '!' : '');
    const cell = (x: number, k: Metric) => `${f3(x)}${VCH[v[k]]}${bang(k)}`.padEnd(8);
    const rh = `${r.m.rhythm.attack?.same ? 'att' : ''}${r.m.rhythm.idle?.same ? (r.m.rhythm.attack?.same ? '+' : '') + 'idl' : ''}` || 'diff';
    out.push(
      `  ${`${r.a.tag} × ${r.b.tag}${r.outOfPlan ? ' (out of plan)' : ''}`.padEnd(46)} ${r.m.source.padEnd(6)} ${cell(r.m.KEY, 'KEY')}${cell(r.m.MOTsig, 'MOTsig')}${cell(r.m.MOTloop, 'MOTloop')}${cell(r.m.MOTavg, 'MOTavg')}${cell(r.m.SI, 'SI')}${`${rh} ${VCH[v.RHYTHM]}${bang('RHYTHM')}`.padEnd(8)}${cell(r.m.SIL0, 'SIL0')}${cell(r.m.HEAT, 'HEAT')}${f2(r.m.PAL).padEnd(6)} ${r.j.overall}${METRICS.some((k) => bang(k)) ? ' (KALIR line reached out of plan → UYARI, blind eye test)' : ''}`,
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
    if (r.a4) {
      out.push(`      A4 target (§9.3, absolute): ${r.a4.met ? 'met by the numbers' : 'NOT met'} — ${r.a4.misses.join('; ')}`);
      out.push(`      A4 margins (how far inside each condition): ${r.a4.margins.join('; ')}`);
    }
  }
  out.push('  (* = reported, not in MOTavg; rhythm parts: swing charge→release / release→recover / total, reaction impact→recover / total, death impact→dissolve / total, summon start→land / total, loop total / head period / body period / head lag, ms)');
  return out;
}

const pairJson = (r: PairRow) => ({
  a: r.a.tag,
  b: r.b.tag,
  outOfPlan: r.outOfPlan,
  control: r.control ? { ...r.control, margin: controlMargin(r.m, r.control.required, T), held: controlHeld(r.j, r.control.required, r.m, { t: T }) } : null,
  versions: [versionOf(r.a), versionOf(r.b)],
  metrics: r.m,
  verdicts: r.j.v,
  rawVerdicts: r.raw,
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
  // A4.1: unregistered v3 drafts (--art) join the v3 population of the recalibration (tag '<id>:draft')
  for (const file of args('art')) {
    const art = await loadArtFile(file);
    if (!ents.some((x) => x.tag === `${art.id}:draft`)) ents.push(makeEntity(`${art.id}:draft`, art));
  }
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
    return { a: p.a, b: p.b, outOfPlan: false, m: p.gate, j: p.j, raw: p.j.v, keyV1: null, a4: null } satisfies PairRow;
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
  L.push(
    '',
    `--- calibration acceptance (§9.2 (a)–(g)); a control holds when it is KALIR AND in the upper half of the KALIR band on every band metric it names (depth ≥ ${CONTROL_MARGIN}: ${FLOORS}; A4.1), on its gate source and on the proxy; (b) cross builds in the A4.1 section (--cross)`,
  );
  const ctlRows: PairRow[] = [];
  const REQ4: Metric[] = ['KEY', 'MOTsig', 'MOTloop', 'MOTavg'];
  const REQ3: Metric[] = ['MOTsig', 'MOTloop', 'MOTavg'];
  const heldM = (r: PairRow) => controlHeld(r.j, r.control!.required, r.m, { t: T });
  const marginOf = (r: PairRow) => controlMargin(r.m, r.control!.required, T);
  // the 14 arts §9.2 measured its "(c) proxy MOTsig 1,00, MOTloop ≥ 0,99, MOTavg ≥ 0,97" on (12 v1 + the slice)
  const obsPop = (e: Entity) => e.tag.endsWith(':v1') || e.tag === 'crystal_wyrm:v3' || e.tag === 'abyss_magus:v3';
  const obsNotes: string[] = [];
  const minHold = (e: Entity) => Math.min(...BASE5.flatMap((an) => {
    const s = e.spec(an);
    return s ? Array.from({ length: s.frames }, (_, f) => frameMs(s, f)) : [];
  }));
  for (const e of ents) {
    const ca = colourShifted(e);
    const cc = jittered(e);
    const ra = runPair(e, ca, { control: { id: 'a', required: REQ4 } });
    const rc = runPair(e, cc, { control: { id: 'c', required: REQ4 } });
    ctlRows.push(ra, rc);
    const pc = measurePair(prof(e), prof(cc), { source: 'proxy', anims: BASE5, t: T });
    const pa = measurePair(prof(e), prof(ca), { source: 'proxy', t: T });
    const pcHeld = controlHeld(judgePair(pc, { t: T }), REQ3, pc, { t: T });
    const paHeld = controlHeld(judgePair(pa, { t: T }), REQ3, pa, { t: T });
    L.push(
      `  ${e.tag.padEnd(19)} (a) colour [${ra.m.source}] KEY ${ra.m.KEY.toFixed(3)} sig ${ra.m.MOTsig.toFixed(3)} loop ${ra.m.MOTloop.toFixed(3)} avg ${ra.m.MOTavg.toFixed(3)} → ${heldM(ra) ? 'KALIR ok' : 'NOT HELD'} (depth ${marginOf(ra).toFixed(3)})` +
        ` (proxy ${pa.MOTsig.toFixed(2)}/${pa.MOTloop.toFixed(2)}/${pa.MOTavg.toFixed(2)})` +
        ` | (c) ±60 ms [${rc.m.source}] KEY ${rc.m.KEY.toFixed(3)} sig ${rc.m.MOTsig.toFixed(3)} loop ${rc.m.MOTloop.toFixed(3)} avg ${rc.m.MOTavg.toFixed(3)} → ${heldM(rc) ? 'KALIR ok' : 'NOT HELD'} (depth ${marginOf(rc).toFixed(3)})` +
        ` (proxy sig ${pc.MOTsig.toFixed(3)} loop ${pc.MOTloop.toFixed(3)} avg ${pc.MOTavg.toFixed(3)}, depth ${controlMargin(pc, REQ3, T).toFixed(3)})`,
    );
    check(`(a) colour change ${e.tag} → KALIR, depth ≥ ${CONTROL_MARGIN}`, heldM(ra), `${ra.j.overall}, depth ${marginOf(ra).toFixed(3)}`);
    check(`(a) colour change ${e.tag}, proxy → KALIR, depth ≥ ${CONTROL_MARGIN}`, paHeld, `depth ${controlMargin(pa, REQ3, T).toFixed(3)}`);
    check(`(c) ±60 ms holds ${e.tag} → KALIR, depth ≥ ${CONTROL_MARGIN}`, heldM(rc), `${rc.j.overall}, depth ${marginOf(rc).toFixed(3)}`);
    check(`(c) ±60 ms holds ${e.tag}, proxy → KALIR, depth ≥ ${CONTROL_MARGIN}`, pcHeld, `${pc.MOTsig.toFixed(3)} / ${pc.MOTloop.toFixed(3)} / ${pc.MOTavg.toFixed(3)}, depth ${controlMargin(pc, REQ3, T).toFixed(3)}`);
    // §9.2's observation, stated to two decimals ("MOTsig 1,00, MOTloop ≥ 0,99, MOTavg ≥ 0,97"), stays the
    // regression check of the 14 arts it was measured on. It is no tolerance for later art (A3 open item 3):
    // ±60 ms on a 50 ms hold is +120 % (or the 40 ms floor), beyond the DTW band (±3 of 24 samples ≈ ±12 %),
    // so a v3 art with very short holds reads 0.98–0.99 — the metric working, KALIR with a wide margin.
    const r2 = (x: number) => Math.round(x * 100) / 100;
    const obs = r2(pc.MOTsig) >= 1 && r2(pc.MOTloop) >= 0.99 && r2(pc.MOTavg) >= 0.97;
    const obsTxt = `${pc.MOTsig.toFixed(3)} / ${pc.MOTloop.toFixed(3)} / ${pc.MOTavg.toFixed(3)}`;
    if (obsPop(e)) check(`(c) §9.2 observation ${e.tag}: proxy MOTsig 1.00, MOTloop ≥ 0.99, MOTavg ≥ 0.97 (2 decimals)`, obs, obsTxt);
    else obsNotes.push(`  (c) ${e.tag}: the §9.2 proxy observation (1.00 / ≥ 0.99 / ≥ 0.97) ${obs ? 'also holds' : `is not reached (shortest hold ${minHold(e)} ms) — reported, not a calibration failure: the control is KALIR with margin`} (${obsTxt})`);
  }
  if (obsNotes.length) L.push('  arts after the §9.2 calibration population (12 v1 + the slice):', ...obsNotes);
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
  // --- A4.1: the recalibration on the v3 members (§9.3 "A4.1 sonunda v3 çiftleriyle yeniden kalibre")
  const V3 = ents.filter((e) => e.tag.endsWith(':v3') || e.tag.endsWith(':draft'));
  let a41: Record<string, unknown> | null = null;
  if (V3.length >= 2) {
    L.push('', `--- A4.1 recalibration on the v3 members (${V3.map((e) => `${e.tag}${e.plan ? ` [${e.plan}]` : ''}`).join(', ')}): gate source per pair (§9.1); members of different body plans are out of plan (§9.3: a KALIR there counts as UYARI, '!')`);
    const v3rows: PairRow[] = [];
    for (let i = 0; i < V3.length; i++)
      for (let k = i + 1; k < V3.length; k++) if (V3[i].id !== V3[k].id) v3rows.push(runPair(V3[i], V3[k], { outOfPlan: outOfPlan(V3[i].plan, V3[k].plan) }));
    L.push(...matrixLines(v3rows), ...detailLines(v3rows));
    // same character, v1 → v3: the wyrm and the magus kept their v1 motion (control (d)); the others were
    // re-choreographed on purpose (A3 / A4), so their rows only show how far the redesign moved
    const KEPT = ['crystal_wyrm', 'abyss_magus'];
    const same = V3.filter((e) => reg.MONSTER_IDS.includes(e.id)).map((e) => {
      const a = regEntity(`${e.id}:v1`);
      const m = measurePair(prof(a), prof(e), { t: T });
      return { a, b: e, m, j: judgePair(m, { t: T }), kept: KEPT.includes(e.id) };
    });
    L.push('', '  same character, v1 → v3 (motion kept: wyrm, magus — control (d); the others re-choreographed on purpose, reported):');
    for (const s of same)
      L.push(`    ${`${s.a.tag} → ${s.b.tag}`.padEnd(40)} [${s.m.source}] KEY ${s.m.KEY.toFixed(3)} SIL0 ${s.m.SIL0.toFixed(3)} MOTsig ${s.m.MOTsig.toFixed(3)} MOTloop ${s.m.MOTloop.toFixed(3)} MOTavg ${s.m.MOTavg.toFixed(3)} SI ${s.m.SI.toFixed(3)} HEAT ${s.m.HEAT.toFixed(3)} → ${s.j.overall}${s.kept ? ' (motion kept)' : ''}`);
    // control (b): one member's anims on another member's build (--cross FILE:ID), and its ±60 ms version
    const crossRows: PairRow[] = [];
    const used = new Set(ents.map((e) => e.tag));
    for (const spec of args('cross')) {
      const [file, id] = spec.split(':');
      const of = V3.find((m) => m.tag === id) ?? V3.find((m) => m.id === id && m.tag.endsWith(':draft')) ?? V3.find((m) => m.id === id) ?? usage(`--cross FILE:ID: no v3 member '${id}'`);
      const art = await loadArtFile(file);
      let tag = `${art.id}:cross`;
      for (let n = 2; used.has(tag); n++) tag = `${art.id}:cross${n}`;
      used.add(tag);
      const cross = makeEntity(tag, art, { control: 'b', of: of.tag });
      crossRows.push(runPair(of, cross, { control: { id: 'b', required: ['MOTsig', 'MOTloop'] } }));
      crossRows.push(runPair(of, jittered(cross), { control: { id: 'c', required: ['MOTsig', 'MOTloop'] } }));
    }
    if (crossRows.length) {
      L.push('', `  control (b) cross builds (a member's anims on another member's body) and their ±60 ms versions: KALIR with depth ≥ ${CONTROL_MARGIN} on MOTsig, MOTloop`);
      L.push(...matrixLines(crossRows));
      for (const r of crossRows) {
        L.push(`    (${r.control!.id}) ${r.a.tag} × ${r.b.tag}: depth ${marginOf(r).toFixed(3)} → ${heldM(r) ? 'held' : 'NOT HELD'}`);
        check(`(${r.control!.id}) cross build ${r.a.tag} × ${r.b.tag} → KALIR, depth ≥ ${CONTROL_MARGIN}`, heldM(r), `MOTsig ${r.m.MOTsig.toFixed(3)} MOTloop ${r.m.MOTloop.toFixed(3)}, depth ${marginOf(r).toFixed(3)}`);
      }
    } else L.push('', '  control (b) cross builds: not run (--cross FILE:ID, a planArt-built synthetic member)');
    // the distribution against the §9.3 bands
    const v3ctl = ctlRows.filter((r) => V3.some((e) => e.tag === r.a.tag)).concat(crossRows);
    const fmt = (xs: number[]) => (xs.length ? xs.map((x) => x.toFixed(3)).join(' ') : '-');
    const mx = (xs: number[]) => (xs.length ? Math.max(...xs).toFixed(3) : '-');
    const mn = (xs: number[]) => (xs.length ? Math.min(...xs).toFixed(3) : '-');
    const inPlan = v3rows.filter((r) => !r.outOfPlan);
    const oop = v3rows.filter((r) => r.outOfPlan);
    const vx = V3.flatMap((e) => reg.MONSTER_IDS.filter((id) => id !== e.id).map((id) => find(e.tag, `${id}:v1`)));
    const cnt = (vs: Verdict[]) => `${vs.filter((v) => v === 'UYARI').length} U / ${vs.filter((v) => v === 'KALIR').length} K`;
    L.push('', `  distribution against the §9.3 bands (raw verdicts: an out-of-plan KALIR is counted as KALIR here); in plan = ${inPlan.map((r) => `${r.a.tag} × ${r.b.tag}`).join(', ') || '-'}; ${oop.length} out-of-plan v3 pairs; ${vx.length} v3 × other v1 pairs (the --against all population, proxy); controls = (a), (c) of the v3 members + (b):`);
    const dist: Record<string, unknown> = {};
    for (const k of ['KEY', 'MOTsig', 'MOTloop', 'MOTavg', 'SI', 'HEAT', 'SIL0'] as const) {
      const band = k === 'HEAT' ? `warn ${T.HEAT.warn}` : k === 'SIL0' ? `warn ${T.SIL0.warn}, new ${T.SIL0.failNew}` : `${T[k].warn} / ${T[k].fail}`;
      const ctl = v3ctl.filter((r) => r.control!.required.includes(k)).map((r) => r.m[k]);
      const kept = same.filter((s) => s.kept).map((s) => s.m[k]);
      const o = oop.map((r) => r.m[k]);
      const x = vx.map((p) => p.gate[k] as number);
      L.push(
        `    ${k.padEnd(8)} [${band}]  in plan ${fmt(inPlan.map((r) => r.m[k]))} (${cnt(inPlan.map((r) => r.raw[k]))}) · v3 out of plan max ${mx(o)} median ${o.length ? median(o).toFixed(3) : '-'} (${cnt(oop.map((r) => r.raw[k]))}) · v3 × v1 max ${mx(x)} median ${x.length ? median(x).toFixed(3) : '-'} (${cnt(vx.map((p) => p.j.v[k]))}) · same character, motion kept: min ${mn(kept)} · controls min ${mn(ctl)}`,
      );
      dist[k] = { inPlan: inPlan.map((r) => r.m[k]), outOfPlan: o, v3xv1: x, keptMin: kept.length ? Math.min(...kept) : null, controlsMin: ctl.length ? Math.min(...ctl) : null };
    }
    L.push(`    RHYTHM   same-rhythm anims in plan: ${inPlan.map((r) => `${r.a.tag} × ${r.b.tag}: ${(Object.keys(r.m.rhythm) as Anim[]).filter((an) => r.m.rhythm[an]!.same).join(', ') || 'none'}`).join('; ') || '-'}; out of plan: ${oop.map((r) => `${r.a.tag} × ${r.b.tag}: ${(Object.keys(r.m.rhythm) as Anim[]).filter((an) => r.m.rhythm[an]!.same).join(', ') || 'none'}`).join('; ')}`);
    L.push(`    overall  v3 pairs (raw): ${(['GEÇER', 'UYARI', 'KALIR'] as const).map((v) => `${v} ${v3rows.filter((r) => worst(METRICS.map((k) => r.raw[k])) === v).length}`).join(', ')}; v3 × v1 (raw): ${(['GEÇER', 'UYARI', 'KALIR'] as const).map((v) => `${v} ${vx.filter((p) => p.j.overall === v).length}`).join(', ')}`);
    a41 = { members: V3.map((e) => ({ tag: e.tag, plan: e.plan })), pairs: v3rows.map(pairJson), same: same.map((s) => ({ a: s.a.tag, b: s.b.tag, kept: s.kept, metrics: s.m, overall: s.j.overall })), cross: crossRows.map(pairJson), distribution: dist };
  }
  const failed = checks.filter((c) => !c.ok);
  L.push('', `checks: ${checks.length}, failed ${failed.length}${failed.length ? ':\n  ' + failed.map((c) => `${c.what} (${c.detail})`).join('\n  ') : ''}`);
  L.push(`[sameness --calib] ${profiles.size} profiles, ${pairs.length} pairs + ${ctlRows.length} controls in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  const txt = L.join('\n');
  console.log(txt);
  fs.writeFileSync(path.join(OUT, 'calib.txt'), txt + '\n');
  fs.writeFileSync(
    path.join(OUT, 'calib.json'),
    JSON.stringify({ tool: 'tools/sameness.ts --calib', thresholds: T, controlMargin: CONTROL_MARGIN, checks, pairs: pairs.map((p) => ({ a: p.a.tag, b: p.b.tag, proxy5: p.proxy, gate: p.gate, verdicts: p.j.v, overall: p.j.overall })), controls: ctlRows.map(pairJson), a41 }, null, 1),
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
  for (let k = i + 1; k < members.length; k++) if (members[i].id !== members[k].id) rows.push(runPair(members[i], members[k], { outOfPlan: outOfPlan(members[i].plan, members[k].plan) }));
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
  const used = new Set(members.map((m) => m.tag));
  for (const spec of args('cross')) {
    const [file, id] = spec.split(':');
    const of = members.find((m) => m.tag === id || m.id === id) ?? (id ? regEntity(id) : usage(`--cross FILE:ID (got ${spec})`));
    const art = await loadArtFile(file);
    // a unique tag per cross build: profiles are cached by tag
    let tag = `${art.id}:cross`;
    for (let n = 2; used.has(tag); n++) tag = `${art.id}:cross${n}`;
    used.add(tag);
    const cross = makeEntity(tag, art, { control: 'b', of: of.tag });
    ctlRows.push(runPair(of, cross, { control: { id: 'b', required: ['MOTsig', 'MOTloop'] } }));
    ctlRows.push(runPair(of, jittered(cross), { control: { id: 'c', required: ['MOTsig', 'MOTloop'] } }));
  }
}
const ctlHeld = (r: PairRow) => controlHeld(r.j, r.control!.required, r.m, { t: T });
const controlsHeld = ctlRows.every(ctlHeld);

// ---------------------------------------------------------------- report

L.push('', 'pair matrix (G GEÇER · U UYARI · K KALIR; §9.3 bands):');
L.push(...(rows.length ? matrixLines(rows) : ['  (no pair: fewer than two members with different ids)']));
if (rows.length) L.push('', 'per anim: MOT and rhythm', ...detailLines(rows));
if (flag('controls')) {
  L.push('', `controls (§9.4: each must come out KALIR on its metrics, in the upper half of the KALIR band (${FLOORS}), else exit 3): ${controlsHeld ? 'all held' : 'NOT ALL HELD — the metric is blind'}`);
  L.push(...matrixLines(ctlRows));
  for (const r of ctlRows) {
    const mg = controlMargin(r.m, r.control!.required, T);
    const short = r.control!.required.filter((k) => r.j.v[k] !== 'KALIR' || ((BAND_METRICS as readonly string[]).includes(k) && (r.m[k as 'KEY'] as number) < controlFloor(k as 'KEY', T) - 1e-9));
    L.push(`  (${r.control!.id}) ${r.a.tag} × ${r.b.tag}: needs KALIR on ${r.control!.required.join(', ')} (depth ≥ ${CONTROL_MARGIN}) → ${ctlHeld(r) ? `held (depth ${mg.toFixed(3)})` : `NOT HELD (${short.map((k) => `${k} ${r.j.v[k]}${(BAND_METRICS as readonly string[]).includes(k) ? ` ${(r.m[k as 'KEY'] as number).toFixed(3)}` : ''}`).join(', ')}; margin ${mg.toFixed(3)})`}`);
  }
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
    const items: { left: Entity; right: Entity; control: boolean }[] = [];
    for (let i = 0; i < members.length; i++) for (let k = i + 1; k < members.length; k++) if (members[i].id !== members[k].id) items.push({ left: members[i], right: members[k], control: false });
    for (const m of members) items.push({ left: m, right: jittered(m), control: true });
    const order = shuffled(items, rnd).map((it) => (rnd() < 0.5 ? it : { left: it.right, right: it.left, control: it.control }));
    const POSES = [1, 4, 7, 10, 13, 16, 19, 22];
    // A4.1: the roar joins the attack (MOTsig = max(attack, roar): a roar-driven UYARI must reach the eye)
    const BLIND_ANIMS: Anim[] = ['attack', 'roar', 'idle'];
    const LABEL: Partial<Record<Anim, string>> = { attack: 'atk', roar: 'roar', idle: 'idle' };
    // idle loops move a few px: both strips of a pair get the same ×IDLE_GAIN so the motion is readable
    const IDLE_GAIN = 3;
    const CW = 64;
    const CH = 74;
    const stripH = CH + 2;
    const pairH = 12 + 2 * BLIND_ANIMS.length * stripH + 8;
    const head1 = `motion: her kodlu çift iki şerittir (1, 2): ${BLIND_ANIMS.join(', ')} (döngü), çiftin iki şeridi ortak bir çöp gövdede`;
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
      // each pair on the track source its gate measures (joints for two plan members, points, the proxy)
      const pl = prof(it.left);
      const pr = prof(it.right);
      const src = pairSource(pl, pr);
      const strips = BLIND_ANIMS.flatMap((an) => [['1', it.left, an], ['2', it.right, an]] as [string, Entity, Anim][]);
      strips.forEach(([lab, e, anim], si) => {
        const y = y0 + 10 + si * stripH;
        text(p, 4, y + 2, `${lab}`, TXT);
        text(p, 4, y + 11, LABEL[anim] ?? anim, DIM);
        if (anim === 'idle') text(p, 4, y + 20, `×${IDLE_GAIN}`, DIM);
        const t = prof(e).anims[anim]!.tracks[src]!;
        const ns = pl.anims[anim]!.tracks[src]!.names.filter((n) => pr.anims[anim]!.tracks[src]!.names.includes(n));
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
      'ref.png her üyenin adlı idle f0 silüetini gösterir. sil.png içindeki her kodu (S01…) bir üye adıyla doldur. motion.png içindeki her çift (M01…) iki şerittir (1 ve 2: attack, roar ve idle döngüsü, aynı çöp gövdede); aynı üyenin hareketi ise "aynı", değilse "farklı" yaz.',
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
