// Monster quality gates (docs/v3/REHBER.md §8.1 KK-3…KK-6 + IŞ-1 + KK-13 budget; A3 build row Y6):
// tools/monster-sheet.ts JSON → a pass / fail table. The sheet numbers (margins, edge px, isolated /
// opaque, Δ, in / out, seams, marks, points) come from the JSON; what a sheet does not hold (feet band,
// contact-frame change, P2 light side, render ms, uncropped bytes, reference frame noise) is measured
// on the same art, drawn the same way.
//
//   npx vite-node tools/monster-sheet.ts --id stone_sentinel --look v3 --anims all --points --out DIR
//   npx vite-node tools/monster-sheet.ts --id stone_sentinel --look v3 --anims all --points --p2 --out DIR
//   npx vite-node tools/monster-gates.ts DIR/stone_sentinel-v3.json DIR/stone_sentinel-v3-p2.json
//       [--class ace|large|medium|small] [--ref still|v1|none] [--l3 anim,anim] [--out FILE] [--json]
//
// Rows (each P1 and P2 when both sheets are given):
//   KK-3  Sİ-2 margin ≥ 2 and edge px 0 on every frame · HA-14 out ≤ 1.2 (one-shots; victory is shown,
//         not judged: REHBER §10.4) · HA-15 in ≤ 2.0 (attack, roar, special) · HA-16 seam ≤ 1.4 (idle,
//         guard) · HA-17 idle max Δ ≤ 1.8 × idleΔ · HA-18 liveliness idleΔ / idle f0 opaque ≥ 15 % ·
//         HA-19 guard Δ 0.3–0.8 × idleΔ · HA-20 idle f0 ↔ guard f0 ≥ 3 × idleΔ → toGuard + fromGuard,
//         each ≤ 400 ms · IŞ-10 noise (isolated / opaque): idle mean ≤ 10 %, body frames ≤ 15 %, effect
//         frames ≤ 20 % (classes: framelib noiseClass), idle f0 ≤ 1.1 × the reference frame (--ref:
//         the approved still when one exists — wyrm / sentinel as P1, magus as P2 — else v1 idle f0)
//   KK-4  HA-21 contact frame local: Δ(f0, idle f0) / idle f0 opaque < 50 % for hit, hitHeavy, hitMagic
//         and death when death marks f0 as contact (the on-screen half of KK-4 is tools/contact-probe.mjs)
//   KK-5  HA-9 walkers: bottom row and the x range of the lowest 6 rows fixed in every idle, guard,
//         toGuard, fromGuard frame · HA-10 floaters: points().feet fixed there (dx = 0), idle float
//         baseline within ±1 px of idle f0
//   KK-6  HA-1 mandatory marks (framelib REQUIRED_MARKS) · HA-25 points().muzzle on every frame
//   IŞ-1  key light from the screen's top-left in both views (P2 as shown: relit frame, flipped):
//         litBias (src/dev/relight-shim.ts) > 0 on idle f0; on attack release, hit f0, guard f0 the relit
//         P2 reads more left-lit than the plain mirror of P1 (litBias is unreliable there in absolute
//         terms: glass wings / emissive flares sit at the run ends — see the IŞ-1 block)
//   KK-13 frames ≤ 140 · render ≤ 8 ms / frame in reference-machine ms (process CPU time against the
//         slice wyrm's documented 6.7 ms, timed in alternation: robust to the shared machine's load) · uncropped sheet bytes per side (w × h × 4 × frames) within the size class budget
//         (ace 7 / large 5 / medium 3.6 / small 2.2 MB; --class overrides) · A3_MIMARI §8 L3+ share:
//         frames drawn with escape level ≥ 3 (whole-art L5 = 100 %; a plan art reports
//         MonsterArt-level `levels` {anim: level} if planArt sets it, else --l3 names them) — over 50 %
//         means the monster is knowingly in the ace tier
//
// Known slice deviations (REHBER §10) are shown as "known", not failures. For crystal_wyrm and
// abyss_magus the A2 acceptance value of each rule (REHBER columns "Dilim") is printed beside it.
// Exit 0: every gate passes (known deviations allowed) · 2: a gate fails · 1: bad input.

import fs from 'node:fs';
import path from 'node:path';
import { animList, animSpec } from '../src/art/animtime';
import type { AnyMonsterAnim, DrawOpts, MonsterArt } from '../src/art/types';
import {
  FrameStore,
  SHEET_BUDGET_MB,
  cpuMs,
  delta,
  feetBand,
  isolated,
  loadArtFile,
  loadRegistry,
  missingMarks,
  noiseClass,
  nowMs,
  sizeClass,
  type Look,
  type SizeClass,
} from './lib/framelib';

// ---------------------------------------------------------------- args

const argv = process.argv.slice(2).filter((a) => a !== '--');
const arg = (k: string): string | undefined => {
  const i = argv.indexOf(`--${k}`);
  return i >= 0 && argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[i + 1] : undefined;
};
const flag = (k: string) => argv.includes(`--${k}`);
const VALUE_FLAGS = new Set(['--class', '--ref', '--l3', '--out']);
const files = argv.filter((a, i) => a.endsWith('.json') && !VALUE_FLAGS.has(argv[i - 1] ?? ''));
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
if (!files.length) {
  console.error('usage: npx vite-node tools/monster-gates.ts <id>-<look>.json [<id>-<look>-p2.json] [--class ace|large|medium|small] [--ref still|v1|none] [--l3 a,b] [--out FILE] [--json]');
  process.exit(1);
}

// ---------------------------------------------------------------- sheet JSON (tools/monster-sheet.ts)

interface FrameInfo {
  frame: number;
  holdMs: number;
  marks: string[];
  margin: number | null;
  touches: string[];
  edgePx: number;
  isolated: number;
  opaque: number;
  deltaPrev: number | null;
  points: Record<string, { x: number; y: number }>;
}
interface AnimRep {
  anim: AnyMonsterAnim;
  frames: number;
  loop: boolean;
  totalMs: number;
  marks: Record<string, number>;
  minMargin: number | null;
  maxEdgePx: number;
  popIn: number | null;
  popOut: number | null;
  seam: number | null;
  meanDelta: number | null;
  info: FrameInfo[];
}
interface Sheet {
  tool: string;
  id: string;
  look: Look;
  art: string;
  view: string;
  frame: { w: number; h: number; anchorX: number; anchorY: number; hover: number };
  p2: string;
  idle: { meanDelta: number; deltas: number[]; guardSwapDelta: number };
  anims: Record<string, AnimRep>;
}

const sheets = files.map((f) => ({ file: f, s: JSON.parse(fs.readFileSync(path.resolve(f), 'utf8')) as Sheet }));
for (const { file, s } of sheets) if (s.tool !== 'tools/monster-sheet.ts' || !s.anims?.idle) throw new Error(`${file}: not a tools/monster-sheet.ts JSON with the idle anim`);
const first = sheets[0].s;
for (const { file, s } of sheets) if (s.id !== first.id || s.look !== first.look || s.art !== first.art) throw new Error(`${file}: another monster / look / art than ${files[0]}`);
const P1 = sheets.find((x) => x.s.view === 'P1')?.s ?? null;
const P2 = sheets.find((x) => x.s.view.startsWith('P2'))?.s ?? null;
const views = [P1, P2].filter((v): v is Sheet => !!v);

// ---------------------------------------------------------------- the art (drawn like the sheet)

const reg = await loadRegistry(first.look);
const art: MonsterArt = first.art.startsWith('file ') ? await loadArtFile(first.art.slice(5)) : reg.monsterArt(first.id);
const isV3 = first.look === 'v3' && (first.art === 'v3' || first.art.startsWith('file '));
const store = new FrameStore(art);
const relit = art.p2 === 'relight';
const optsOf = (v: Sheet): DrawOpts | undefined => (v.view === 'P2 relight' ? { lightFrom: 'right' } : undefined);
const frameOf = (v: Sheet, anim: AnyMonsterAnim, f: number) => store.get(anim, f, optsOf(v));
const { litBias } = await import('../src/dev/relight-shim');
const SLICE = new Set(['crystal_wyrm', 'abyss_magus']);

// ---------------------------------------------------------------- rows

type Status = 'ok' | 'FAIL' | 'known' | 'info' | 'n/a';
interface Row {
  kk: string;
  rule: string;
  what: string;
  values: string;
  limit: string;
  status: Status;
  a2?: string;
  note?: string;
}
const rows: Row[] = [];
const pct = (x: number) => `${(100 * x).toFixed(1)} %`;
const r2 = (x: number) => (Math.round(x * 100) / 100).toFixed(2);
const tagOf = (v: Sheet) => (v.view === 'P1' ? 'P1' : 'P2');
const A2: Record<string, string> = {
  'Sİ-2': 'ejder 2 (roar f4), büyücü 3 (death / revive); kenar 0',
  'HA-14': '0 (her one-shot idle f0’da biter)',
  'HA-15': '0,81–1,6',
  'HA-16': 'idle 1,09–1,29 / guard 1,09–1,40',
  'HA-17': '1,43 / 1,71',
  'HA-18': '%21,7 / %18,7',
  'HA-19': '0,43 / 0,68',
  'HA-20': '4,78 / 4,44 → 7 / 5 kare, ≤ 0,4 sn',
  'IŞ-10 idle': 'idle %6,6–7,1 (ejder) / %8,2–9,2 (büyücü)',
  'IŞ-10 body': 'gövde en çok %14,7 (büyücü toGuard / guard)',
  'IŞ-10 effect': 'efekt en çok %19,0 (büyücü death / summon)',
  'IŞ-10 ref': 'still %6,0 / %8,3',
  'HA-21': '%38–44 (hit, hitHeavy, hitMagic; büyücü death)',
  'HA-9': 'ejder y 99, x 54..77, 42 karede',
  'HA-10': 'büyücü: yer noktası sabit, dx 0',
  'KK-13 frames': '136 / 130',
  'KK-13 ms': '6,6–6,8 / 6,2–6,6 ms',
  'KK-13 bytes': '6,56 / 6,76 MB',
};
function add(r: Row): void {
  if (SLICE.has(first.id) && A2[r.rule] && r.a2 === undefined) r.a2 = A2[r.rule];
  rows.push(r);
}
const perView = (fn: (v: Sheet) => { text: string; ok: boolean }) => {
  const res = views.map((v) => ({ v, ...fn(v) }));
  return { values: res.map((r) => `${tagOf(r.v)} ${r.text}`).join(' | '), ok: res.every((r) => r.ok) };
};
const st = (ok: boolean): Status => (ok ? 'ok' : 'FAIL');
const animsOf = (v: Sheet) => Object.values(v.anims);

// KK-3 ---------------------------------------------------------------
{
  const m = perView((v) => {
    let best: { m: number; at: string } = { m: Infinity, at: '-' };
    for (const a of animsOf(v)) for (const i of a.info) if (i.margin !== null && i.margin < best.m) best = { m: i.margin, at: `${a.anim} f${i.frame}` };
    return { text: `${best.m} (${best.at})`, ok: best.m >= 2 };
  });
  add({ kk: 'KK-3', rule: 'Sİ-2', what: 'kenar payı (en küçük)', values: m.values, limit: '≥ 2', status: st(m.ok) });
  const e = perView((v) => {
    const bad = animsOf(v).flatMap((a) => a.info.filter((i) => i.edgePx > 0).map((i) => `${a.anim} f${i.frame}`));
    return { text: bad.length ? bad.join(',') : '0', ok: !bad.length };
  });
  add({ kk: 'KK-3', rule: 'Sİ-2', what: 'kenar pikseli', values: e.values, limit: '0', status: st(e.ok), a2: SLICE.has(first.id) ? '0' : undefined });
}
{
  let known = false;
  const o = perView((v) => {
    const bad: string[] = [];
    let mx = 0;
    for (const a of animsOf(v)) {
      if (a.loop || a.anim === 'death' || a.popOut === null) continue;
      if (a.anim === 'victory') {
        if (a.popOut > 1.2) known = true;
        continue;
      }
      mx = Math.max(mx, a.popOut);
      if (a.popOut > 1.2) bad.push(`${a.anim} ${a.popOut}`);
    }
    return { text: bad.length ? bad.join(', ') : `max ${r2(mx)}`, ok: !bad.length };
  });
  add({ kk: 'KK-3', rule: 'HA-14', what: 'out (one-shot son kare → idle f0 / toGuard → guard f0)', values: o.values, limit: '≤ 1,2', status: st(o.ok), note: known ? 'victory ends on a held pose: shown, not judged (REHBER §10.4)' : undefined });
}
{
  const i = perView((v) => {
    const xs = (['attack', 'roar', 'special'] as const).filter((a) => v.anims[a]?.popIn != null).map((a) => ({ a, x: v.anims[a].popIn! }));
    const bad = xs.filter((q) => q.x > 2);
    return { text: xs.length ? `${r2(Math.min(...xs.map((q) => q.x)))}–${r2(Math.max(...xs.map((q) => q.x)))}${bad.length ? ` (${bad.map((q) => `${q.a} ${q.x}`).join(', ')})` : ''}` : '-', ok: !bad.length };
  });
  add({ kk: 'KK-3', rule: 'HA-15', what: 'in (attack, roar, special)', values: i.values, limit: '≤ 2,0', status: st(i.ok) });
}
{
  const s = perView((v) => {
    const xs = (['idle', 'guard'] as const).map((a) => ({ a, x: v.anims[a]?.seam ?? null }));
    return { text: xs.map((q) => `${q.a} ${q.x ?? '-'}`).join(' '), ok: xs.every((q) => q.x !== null && q.x <= 1.4) };
  });
  add({ kk: 'KK-3', rule: 'HA-16', what: 'döngü dikişi', values: s.values, limit: '≤ 1,4', status: st(s.ok) });
  const j = perView((v) => {
    const x = Math.max(...v.idle.deltas) / v.idle.meanDelta;
    return { text: r2(x), ok: x <= 1.8 };
  });
  add({ kk: 'KK-3', rule: 'HA-17', what: 'idle en büyük Δ / idleΔ', values: j.values, limit: '≤ 1,8', status: st(j.ok) });
  const l = perView((v) => {
    const x = v.idle.meanDelta / v.anims.idle.info[0].opaque;
    return { text: `${pct(x)} (idleΔ ${v.idle.meanDelta})`, ok: x >= 0.15 };
  });
  add({ kk: 'KK-3', rule: 'HA-18', what: 'canlılık: idleΔ / idle f0 opak', values: l.values, limit: '≥ %15', status: st(l.ok) });
  const g = perView((v) => {
    const gd = v.anims.guard?.meanDelta;
    if (gd == null) return { text: 'no guard sheet', ok: false };
    const x = gd / v.idle.meanDelta;
    return { text: r2(x), ok: x >= 0.3 && x <= 0.8 };
  });
  add({ kk: 'KK-3', rule: 'HA-19', what: 'guard Δ / idleΔ', values: g.values, limit: '0,3–0,8', status: st(g.ok) });
  const t = perView((v) => {
    const x = v.idle.guardSwapDelta / v.idle.meanDelta;
    if (x < 3) return { text: `${r2(x)} (< 3: transitions optional)`, ok: true };
    const tr = (['toGuard', 'fromGuard'] as const).map((a) => (v.anims[a] ? `${a} ${v.anims[a].frames} f ${Math.round(v.anims[a].totalMs)} ms` : `${a} MISSING`));
    const ok = (['toGuard', 'fromGuard'] as const).every((a) => v.anims[a] && v.anims[a].totalMs <= 400);
    return { text: `${r2(x)} → ${tr.join(', ')}`, ok };
  });
  add({ kk: 'KK-3', rule: 'HA-20', what: 'idle f0 ↔ guard f0 Δ / idleΔ ≥ 3 → toGuard + fromGuard', values: t.values, limit: 'var, ≤ 400 ms', status: st(t.ok) });
}
{
  const idle = perView((v) => {
    const xs = v.anims.idle.info.map((i) => i.isolated / i.opaque);
    const mean = xs.reduce((s, x) => s + x, 0) / xs.length;
    return { text: `mean ${pct(mean)} (frames ${pct(Math.min(...xs))}–${pct(Math.max(...xs))})`, ok: mean <= 0.1 };
  });
  add({ kk: 'KK-3', rule: 'IŞ-10 idle', what: 'gürültü: idle ortalaması', values: idle.values, limit: '≤ %10', status: st(idle.ok) });
  for (const cls of ['body', 'effect'] as const) {
    const r = perView((v) => {
      let mx = 0;
      let at = '-';
      const bad: string[] = [];
      for (const a of animsOf(v))
        for (const i of a.info) {
          const c = noiseClass(a.anim, i.frame, a.marks, a.frames);
          if (c.cls !== cls || !i.opaque) continue;
          const x = i.isolated / i.opaque;
          if (x > mx) {
            mx = x;
            at = `${a.anim} f${i.frame}`;
          }
          if (x > c.limit) bad.push(`${a.anim} f${i.frame} ${pct(x)}`);
        }
      return { text: bad.length ? bad.join(', ') : `max ${pct(mx)} (${at})`, ok: !bad.length };
    });
    add({ kk: 'KK-3', rule: `IŞ-10 ${cls}`, what: cls === 'body' ? 'gürültü: gövde kareleri' : 'gürültü: efekt kareleri (attack / special cast, summon, revive, death çözülme)', values: r.values, limit: cls === 'body' ? '≤ %15' : '≤ %20', status: st(r.ok) });
  }
  // the reference frame: the approved still (matching view) or the v1 idle f0
  const REF = arg('ref') ?? 'auto';
  const STILLS: Record<string, { load: () => Promise<(p: import('../src/art/pixel').PixelCanvas) => void>; view: 'P1' | 'P2' }> = {
    crystal_wyrm: { load: async () => (await import('../src/still/wyrm')).drawWyrm, view: 'P1' },
    abyss_magus: { load: async () => (await import('../src/still/magus')).drawMagus, view: 'P2' },
    stone_sentinel: { load: async () => (await import('../src/still/sentinel')).drawSentinel, view: 'P1' },
  };
  const { PixelCanvas } = await import('../src/art/pixel');
  const v1 = reg.monsterArtV1(first.id);
  let refRatio: { noise: number; label: string; view: 'P1' | 'P2' } | null = null;
  if ((REF === 'auto' || REF === 'still') && STILLS[first.id] && isV3) {
    const c = new PixelCanvas(v1.w, v1.h);
    (await STILLS[first.id].load())(c);
    refRatio = { noise: isolated(c) / c.coverage(), label: 'approved still', view: STILLS[first.id].view };
  } else if ((REF === 'auto' && isV3) || REF === 'v1') {
    const c = new FrameStore(v1).get('idle', 0);
    refRatio = { noise: isolated(c) / c.coverage(), label: 'v1 idle f0', view: 'P1' };
  }
  const vRef = views.find((v) => tagOf(v) === refRatio?.view) ?? null;
  if (refRatio && vRef) {
    const i0 = vRef.anims.idle.info[0];
    const x = i0.isolated / i0.opaque;
    add({ kk: 'KK-3', rule: 'IŞ-10 ref', what: `gürültü: idle f0 / referans (${refRatio.label}, ${refRatio.view})`, values: `idle f0 ${pct(x)} / ref ${pct(refRatio.noise)} = ${r2(x / refRatio.noise)}×`, limit: '≤ 1,1×', status: st(x <= 1.1 * refRatio.noise + 1e-12) });
  } else add({ kk: 'KK-3', rule: 'IŞ-10 ref', what: 'gürültü: idle f0 / referans', values: refRatio ? `no ${refRatio.view} sheet given` : 'no reference (v1 art or --ref none)', limit: '≤ 1,1×', status: 'n/a' });
}

// KK-4 ---------------------------------------------------------------
{
  const h = perView((v) => {
    const i0 = frameOf(v, 'idle', 0);
    const op = i0.coverage();
    const parts: string[] = [];
    let ok = true;
    for (const a of ['hit', 'hitHeavy', 'hitMagic', 'death'] as const) {
      const rep = v.anims[a];
      if (!rep) continue;
      const x = delta(i0, frameOf(v, a, 0)) / op;
      const gated = a !== 'death' || rep.marks.contact === 0;
      if (gated && x >= 0.5) ok = false;
      parts.push(`${a} ${pct(x)}${gated ? '' : ' (not a contact frame: no contact mark)'}`);
    }
    return { text: parts.join(', ') || 'no reaction anims', ok };
  });
  const knownDeath = views.some((v) => v.anims.death && v.anims.death.marks.contact === undefined);
  add({ kk: 'KK-4', rule: 'HA-21', what: 'temas karesi yerel: Δ(f0, idle f0) / idle f0 opak (sayfa; ekran: contact-probe)', values: h.values, limit: '< %50', status: st(h.ok), note: knownDeath ? 'death without a contact mark is not a contact frame (its f0 continues the reaction); the missing mark is a KK-6 item' : undefined });
}

// KK-5 ---------------------------------------------------------------
{
  const POS = ['idle', 'guard', 'toGuard', 'fromGuard'] as const;
  if (!art.hover) {
    const r = perView((v) => {
      const ref = feetBand(frameOf(v, 'idle', 0))!;
      let n = 0;
      const bad: string[] = [];
      for (const a of POS) {
        const spec = animSpec(art, a);
        if (!spec) continue;
        for (let f = 0; f < spec.frames; f++) {
          n++;
          const b = feetBand(frameOf(v, a, f));
          if (!b || b.bottom !== ref.bottom || b.x0 !== ref.x0 || b.x1 !== ref.x1) bad.push(`${a} f${f}${b ? ` y${b.bottom} x${b.x0}..${b.x1}` : ''}`);
        }
      }
      return { text: `y ${ref.bottom}, x ${ref.x0}..${ref.x1} in ${n - bad.length}/${n} frames${bad.length ? `; moved: ${bad.slice(0, 6).join(', ')}${bad.length > 6 ? '…' : ''}` : ''}`, ok: !bad.length };
    });
    add({ kk: 'KK-5', rule: 'HA-9', what: 'ayak satırı ve x aralığı (alt 6 satır) idle / guard / toGuard / fromGuard', values: r.values, limit: 'sabit', status: st(r.ok) });
  } else {
    const r = perView((v) => {
      const feet = (a: string, f: number) => v.anims[a]?.info[f]?.points?.feet ?? art.points?.(a as AnyMonsterAnim, f)?.feet ?? null;
      const f0 = feet('idle', 0);
      let n = 0;
      const bad: string[] = [];
      for (const a of POS) {
        const spec = animSpec(art, a);
        if (!spec) continue;
        for (let f = 0; f < spec.frames; f++) {
          n++;
          const q = feet(a, f);
          if (!q || !f0 || q.x !== f0.x || q.y !== f0.y) bad.push(`${a} f${f}`);
        }
      }
      const base = feetBand(frameOf(v, 'idle', 0))!.bottom;
      const ys = Array.from({ length: art.anims.idle.frames }, (_, f) => feetBand(frameOf(v, 'idle', f))!.bottom);
      const bob = Math.max(...ys.map((y) => Math.abs(y - base)));
      return { text: `feet ${f0 ? `(${f0.x}, ${f0.y})` : 'none'} fixed in ${n - bad.length}/${n} frames${bad.length ? ` (moves: ${bad.slice(0, 6).join(', ')})` : ''}; idle float baseline y ${Math.min(...ys)}..${Math.max(...ys)} (±${bob})`, ok: !bad.length && !!f0 && bob <= 1 };
    });
    add({ kk: 'KK-5', rule: 'HA-10', what: `süzülen (hover ${art.hover}): yer noktası sabit (dx 0), taban ±1 px`, values: r.values, limit: 'sabit, ±1', status: st(r.ok) });
  }
}

// KK-6 ---------------------------------------------------------------
{
  const v = P1 ?? first;
  const miss: string[] = [];
  const known: string[] = [];
  for (const a of Object.values(v.anims)) {
    for (const m of missingMarks(a.anim, a.marks)) {
      if (first.id === 'crystal_wyrm' && a.anim === 'death' && m === 'contact') known.push('death: contact (REHBER §10.6)');
      else miss.push(`${a.anim}: ${m}`);
    }
  }
  const atk = v.anims.attack;
  const contact = atk?.marks.contact !== undefined ? `attack contact f${atk.marks.contact}` : 'attack without contact (projectile: contact in the cinematic)';
  add({ kk: 'KK-6', rule: 'HA-1', what: 'zorunlu işaretler', values: `${miss.length ? `missing ${miss.join('; ')}` : 'all present'}${known.length ? `; known: ${known.join('; ')}` : ''}; ${contact}`, limit: 'hepsi', status: miss.length ? 'FAIL' : known.length ? 'known' : 'ok' });
  if (art.points) {
    const bad: string[] = [];
    let n = 0;
    for (const a of Object.values(v.anims))
      for (const i of a.info) {
        n++;
        if (!i.points?.muzzle) bad.push(`${a.anim} f${i.frame}`);
      }
    add({ kk: 'KK-6', rule: 'HA-25', what: 'points().muzzle her karede', values: `${n - bad.length}/${n} frames${bad.length ? `; missing ${bad.slice(0, 8).join(', ')}` : ''}`, limit: 'her kare', status: st(!bad.length) });
  } else add({ kk: 'KK-6', rule: 'HA-25', what: 'points().muzzle her karede', values: 'the art has no points() (fixed muzzle)', limit: 'her kare', status: isV3 ? 'FAIL' : 'n/a' });
}

// IŞ-1 ---------------------------------------------------------------
// litBias (src/dev/relight-shim.ts) reads the light side from the luminance at the ends of interior
// runs: reliable on the calm idle f0 (its A1 definition: mirror −45.5 → relight +19.6), not on frames
// whose glass wings or emissive flares sit at the run ends (wyrm guard f0 relit −13.5, magus P1 attack
// f6 −3.7, both lit correctly by eye). So: idle f0 > 0 in both views (absolute), and on attack release,
// hit f0 and guard f0 the relit P2 must read more left-lit than the plain mirror of P1 (relative).
{
  const rel = (v: Sheet) => v.anims.attack?.marks.release ?? v.anims.attack?.marks.impact ?? v.anims.attack?.marks['impact*'] ?? art.attackImpactFrame;
  const fmt = (b: number) => `${b > 0 ? '+' : ''}${b.toFixed(1)}`;
  const r = perView((v) => {
    const mirror = v.view !== 'P1';
    const b0 = litBias(frameOf(v, 'idle', 0), mirror).bias;
    const others: [AnyMonsterAnim, number][] = [['attack', rel(v)], ['hit', 0], ['guard', 0]];
    const parts = others.map(([a, f]) => {
      const shown = litBias(frameOf(v, a, f), mirror).bias;
      const asMirror = mirror && relit ? litBias(store.get(a, f), true).bias : null;
      return { text: `${a} f${f} ${fmt(shown)}${asMirror !== null ? ` (mirror ${fmt(asMirror)})` : ''}`, ok: asMirror === null || shown > asMirror };
    });
    return { text: `idle f0 ${fmt(b0)}${mirror && relit ? ` (mirror ${fmt(litBias(store.get('idle', 0), true).bias)})` : ''}; ${parts.map((p) => p.text).join(', ')}`, ok: b0 > 0 && parts.every((p) => p.ok) };
  });
  const need = isV3 && art.p2 !== 'relight';
  add({ kk: 'IŞ-1', rule: 'IŞ-1', what: `ışık ekranın sol üstünden (P2 ${art.p2 ?? 'mirror'}, gösterildiği gibi aynalı): idle f0 litBias > 0; P2'de öteki anahtar kareler relight > mirror`, values: r.values + (need ? '; v3 art without p2 relight' : ''), limit: '> 0 / relight > mirror', status: isV3 ? st(r.ok && !need) : r.ok ? 'ok' : 'info' });
}

// KK-13 ---------------------------------------------------------------
{
  const all = animList(art);
  const frames = all.reduce((s, a) => s + animSpec(art, a)!.frames, 0);
  add({ kk: 'KK-13', rule: 'KK-13 frames', what: 'kare sayısı (bütün animler, taraf başına)', values: `${frames} (${all.length} anims)`, limit: '≤ 140', status: st(frames <= 140) });
  // render time (≤ 8 ms / frame on the reference machine, A3_MIMARI §11.1). The build machine is shared:
  // under load the wall clock triples and even the process CPU time grows ~25 % (cache / core
  // contention). So the art is timed in alternation with the reference art whose cost §11.1 documents —
  // the slice wyrm, 6.6–6.8 ms / frame — and the gate reads the art's cost in reference-machine ms:
  // cpu(art) / cpu(wyrm) × 6.7. Fresh frame caches, one warm-up pass each, then 3 alternating rounds;
  // the fastest pass of each counts. Raw CPU and wall-clock means are printed beside it.
  const REF_MS = 6.7;
  const refArt = reg.monsterArtV3('crystal_wyrm');
  const timePass = (a: MonsterArt, o?: DrawOpts) => {
    const s = new FrameStore(a);
    const list = animList(a);
    let n = 0;
    const t = nowMs();
    const c = cpuMs();
    for (const x of list)
      for (let f = 0; f < animSpec(a, x)!.frames; f++) {
        s.get(x, f, o);
        n++;
      }
    return { cpu: (cpuMs() - c) / n, wall: (nowMs() - t) / n };
  };
  const isRef = !refArt || refArt === art;
  const mins = { p1: { cpu: Infinity, wall: Infinity }, p2: { cpu: Infinity, wall: Infinity }, ref: { cpu: Infinity, wall: Infinity } };
  const keep = (k: keyof typeof mins, t: { cpu: number; wall: number }) => {
    mins[k] = { cpu: Math.min(mins[k].cpu, t.cpu), wall: Math.min(mins[k].wall, t.wall) };
  };
  timePass(art);
  if (!isRef) timePass(refArt!);
  for (let round = 0; round < 3; round++) {
    keep('p1', timePass(art));
    if (relit) keep('p2', timePass(art, { lightFrom: 'right' }));
    if (!isRef) keep('ref', timePass(refArt!));
  }
  const norm = (cpu: number) => (isRef ? cpu : (cpu / mins.ref.cpu) * REF_MS);
  const show = (t: { cpu: number; wall: number }) => `${norm(t.cpu).toFixed(2)} ms${isRef ? '' : ' ref-machine'} (CPU ${t.cpu.toFixed(2)}, wall ${t.wall.toFixed(2)})`;
  const ms = Math.max(norm(mins.p1.cpu), relit ? norm(mins.p2.cpu) : 0);
  add({
    kk: 'KK-13',
    rule: 'KK-13 ms',
    what: `boyama süresi / kare (Node; ${isRef ? 'the reference art itself: raw CPU' : `CPU / crystal_wyrm v3 CPU (${mins.ref.cpu.toFixed(2)} ms now) × ${REF_MS} ms`})`,
    values: `P1 ${show(mins.p1)}${relit ? ` | P2 ${show(mins.p2)}` : ''}`,
    limit: '≤ 8 ms',
    status: isRef ? (ms <= 8 ? 'ok' : 'info') : st(ms <= 8),
    note: isRef && ms > 8 ? `the reference art is ${REF_MS} ms by definition (A3_MIMARI §11.1); its raw CPU only shows the machine load now` : undefined,
  });
  const cls = (arg('class') as SizeClass | undefined) ?? sizeClass(art, reg.monsterArtV1(first.id).w, isV3);
  if (!SHEET_BUDGET_MB[cls]) throw new Error(`--class must be ace, large, medium or small (got ${cls})`);
  const bytes = art.w * art.h * 4 * frames;
  add({ kk: 'KK-13', rule: 'KK-13 bytes', what: `kırpılmamış sayfa baytı / taraf (${art.w}×${art.h}×4×${frames}), sınıf ${cls}${arg('class') ? ' (--class)' : ''}`, values: `${(bytes / 1e6).toFixed(2)} MB`, limit: `≤ ${SHEET_BUDGET_MB[cls]} MB`, status: st(bytes <= SHEET_BUDGET_MB[cls] * 1e6) });
  // A3_MIMARI §8: share of frames drawn with escape level ≥ 3
  let l3: string[] | null = null;
  let label = '';
  const levels = (art as MonsterArt & { levels?: Partial<Record<string, number>> }).levels;
  if (arg('l3')) {
    l3 = arg('l3')!.split(',').map((s) => s.trim());
    label = '--l3';
  } else if (!art.bodyPlan) {
    l3 = all;
    label = isV3 ? 'whole art (L5)' : 'whole art (v1)';
  } else if (levels) {
    l3 = all.filter((a) => (levels[a] ?? 0) >= 3);
    label = 'art.levels';
  }
  if (l3) {
    const n = all.filter((a) => l3!.includes(a)).reduce((s, a) => s + animSpec(art, a)!.frames, 0);
    const share = n / frames;
    add({ kk: 'KK-13', rule: 'L3+', what: 'L3+ kare payı (A3_MIMARI §8)', values: `${pct(share)} (${n}/${frames}; ${label})${share > 0.5 ? ' → ace tier by rule' : ''}`, limit: '> %50 → as katmanı', status: 'info' });
  } else add({ kk: 'KK-13', rule: 'L3+', what: 'L3+ kare payı (A3_MIMARI §8)', values: `unknown: plan art '${art.bodyPlan!.id}' exposes no levels (pass --l3 anims)`, limit: '> %50 → as katmanı', status: 'n/a' });
}

// ---------------------------------------------------------------- report

const fails = rows.filter((r) => r.status === 'FAIL');
const lines: string[] = [];
const relp = (f: string) => {
  const r = path.relative(ROOT, path.resolve(f));
  return r.startsWith('..') ? path.resolve(f) : r;
};
lines.push(`monster-gates — ${first.id}, look ${first.look}, art ${first.art}; sheets: ${files.map(relp).join(', ')}; views ${views.map((v) => v.view).join(' + ')}`);
let kk = '';
for (const r of rows) {
  if (r.kk !== kk) {
    kk = r.kk;
    lines.push('', kk);
  }
  lines.push(`  ${r.status.padEnd(5)} ${r.rule.padEnd(13)} ${r.what}`);
  lines.push(`        ${r.values}   [limit ${r.limit}]${r.a2 ? `   A2: ${r.a2}` : ''}`);
  if (r.note) lines.push(`        note: ${r.note}`);
}
lines.push('', `${rows.length} rows: ${rows.filter((r) => r.status === 'ok').length} ok, ${fails.length} FAIL, ${rows.filter((r) => r.status === 'known').length} known, ${rows.filter((r) => r.status === 'n/a').length} n/a, ${rows.filter((r) => r.status === 'info').length} info${fails.length ? ` — FAIL: ${fails.map((r) => `${r.rule} ${r.what}`).join('; ')}` : ''}`);
const txt = lines.join('\n');
if (flag('json')) console.log(JSON.stringify({ tool: 'tools/monster-gates.ts', id: first.id, look: first.look, art: first.art, rows, fails: fails.length }, null, 1));
else console.log(txt);
if (arg('out')) {
  const out = path.resolve(arg('out')!);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, txt + '\n');
  fs.writeFileSync(out.replace(/\.txt$/, '') + '.json', JSON.stringify({ tool: 'tools/monster-gates.ts', id: first.id, look: first.look, art: first.art, rows, fails: fails.length }, null, 1));
}
process.exit(fails.length ? 2 : 0);
