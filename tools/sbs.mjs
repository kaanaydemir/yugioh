#!/usr/bin/env node
// Before | after side-by-side pages (A56.0; docs/v3/A5_PLAN.md §1.2, A6_PLAN.md §1.4, the
// checkpoint A56.K §5.0.5 and the closing package A56.Z §5.0.6). The same game moment is captured
// twice — "before" (the shared A56.0 base: frames saved in shots/v3/a56/before/, or the same tree
// with the lanes switched off) and "after" (now) — and the pairs are laid out next to each other,
// at 1× for the phone test (--x1), on one page (--page) or one PNG per pair.
//
//   node tools/sbs.mjs --spec tools/sbs/a56k.json --capture shots/v3/a56/before          # one side
//   node tools/sbs.mjs --spec tools/sbs/a56k.json --before shots/v3/a56/before --x1 --page \
//        --out shots/v3/a56/checkpoint/sbs-1x.png                                       # after = now
//   node tools/sbs.mjs --spec tools/sbs/a56k.json --before-suffix "&a5=off&a6=off" --x1 --page --out x.png
//   node tools/sbs.mjs --pairs "turn|?dev=duel&s=flowTurnP1|event:turnStart+300" --look v3 \
//        --before-suffix "&a6=off" --out x.png --page
//
// The spec (JSON): { "title": "…", "look": "v3", "pairs": [ { "name": "turn", "label": "tur başı
// (+300 ms)", "query": "?dev=duel&s=flowTurnP1", "at": <when>, "zoom": [{ "clip": [x, y, w, h],
// "scale": 3 }] }, … ] }. `look` (or --look) appends &look=… to every query that has none.
// <when> — the game moment, on the frozen clock (t = 0 when the action starts, 60 frames/s):
//   300                         game ms after t = 0 (the frame round(ms / 16.67))
//   { "frame": 18 }             that frame
//   { "event": "turnStart", "plus": 300 }   a cinematic event (Director.runEvent) of that type
//                               starts, + plus ms. "nth": 2 = its second start; "edge": "end" =
//                               when its handler finished; "frac": 0.5 = halfway through it.
//   { "sfx": "cardSet", "plus": 40 }        a sound (sfx.play) of that name, + plus ms ("nth")
//   { "lp": true, "plus": 150 }             the LP panel starts to change (HudView.setLp with its
//                               roll; "player": 0|1 for one panel only), + plus ms ("nth")
//   "atBefore" / "atAfter" override "at" on one side, for a beat a lane renamed or moved (a new
//   landing sound): the page shows both moments.
//   Event / sound moments are resolved separately on each side, so a retimed scene is still
//   compared at the same beat. A moment that is already past when it becomes known (a negative
//   plus, an end edge, frac) is captured in a second pass from a fresh load.
//   Inline pairs instead of a spec: --pairs "name|query|when;…" with when = ms, f:<frame>,
//   event:<type>[#nth][@end][+|-ms], sfx:<name>[#nth][+|-ms] or lp[:p1|p2][#nth][+|-ms].
// Queries: ?dev=duel&s=<key> is restarted --fresh (as tools/shot.mjs --fresh), a duel launch
// (?mode=…&holdIntro=1 …) is restarted from its held opening; any other page (?dev=cards) is
// frozen once ready and stepped. Captures are the 640×360 game canvas at 1×; game frame N is
// pixel-identical to the tools/shot.mjs --fresh film frame of the same game frame (a filmdiff film
// frame i is game frame 2i, at t = i × 33.3 ms).
//
// Sides (each is a directory of <name>.png, or captured now):
//   --before DIR          the before frames (e.g. shots/v3/a56/before, written with --capture)
//   --before-suffix Q     or capture the before side now with Q appended to every URL (e.g. the
//                         kill-switches "&a5=off&a6=off": the same tree without the lanes)
//   --after DIR           the after frames; default: capture now (with --after-suffix Q)
//   --capture DIR         capture mode: only capture every pair into DIR (<name>.png + sbs.json:
//                         query, moment, resolved frame, git HEAD); --suffix Q appends Q;
//                         --side before|after picks the atBefore / atAfter moments (default before)
// Page:
//   --out FILE|DIR        with --page the page PNG, else a directory of sbs-<name>.png
//   --page                all pairs on one page
//   --x1                  1× frames (640×360, no magnification): the phone test of A56.K / A56.Z
//   --scale N             frame magnification without --x1 (default 2); a pair's "zoom" rows are
//                         drawn at their own scale (nearest neighbour)
//   --title TEXT          page title (default the spec's)
//   --frames DIR          where captured frames go (default <out>.frames/{before,after})
//   --only a,b            only these pairs
//   --look v1|v3          as above;  --jobs N  captures in parallel (default 2);  --help
// Exit 0 when every pair has both frames, 2 when a capture failed (the pair is drawn with the
// error in place of the frame), 1 on bad arguments.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ROOT, startServer, launchBrowser, gotoReady, queryKind, freshScenarioInPage, freshLaunchInPage } from './lib/pagekit.mjs';

const rel = (p) => (p.startsWith(ROOT + path.sep) ? path.relative(ROOT, p) : p);

// ---------------------------------------------------------------- args

function parseArgs(argv) {
  const o = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      const v = argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
      o[k] = v;
    } else o._.push(a);
  }
  return o;
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  const out = [];
  for (const l of fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1)) {
    if (!l.startsWith('//')) break;
    out.push(l.replace(/^\/\/ ?/, ''));
  }
  console.log(out.join('\n'));
  process.exit(0);
}

function usage(msg) {
  if (msg) console.error(`[sbs] ${msg}`);
  console.error('usage: node tools/sbs.mjs (--spec FILE | --pairs "name|query|when;…") (--capture DIR [--suffix Q] | [--before DIR | --before-suffix Q] [--after DIR | --after-suffix Q] --out FILE|DIR [--page] [--x1] [--scale N]) [--look v3] [--only a,b] [--jobs N] | --help');
  process.exit(1);
}

const str = (k) => (args[k] && args[k] !== 'true' ? args[k] : null);
const suffixOf = (q) => (q ? (q.startsWith('&') ? q : `&${q}`) : '');

/** Parse an inline moment: ms | f:N | event:type[#nth][@end][+|-ms] | sfx:name[#nth][+|-ms]. */
function parseWhen(s) {
  s = String(s ?? '0').trim();
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  let m = /^f:(\d+)$/.exec(s);
  if (m) return { frame: Number(m[1]) };
  m = /^lp(?::p([12]))?(?:#(\d+))?([+-]\d+)?$/.exec(s);
  if (m) {
    const o = { lp: true };
    if (m[1]) o.player = Number(m[1]) - 1;
    if (m[2]) o.nth = Number(m[2]);
    if (m[3]) o.plus = Number(m[3]);
    return o;
  }
  m = /^(event|sfx):([\w-]+)(?:#(\d+))?(@end)?([+-]\d+)?$/.exec(s);
  if (m) {
    const o = { [m[1]]: m[2] };
    if (m[3]) o.nth = Number(m[3]);
    if (m[4]) o.edge = 'end';
    if (m[5]) o.plus = Number(m[5]);
    return o;
  }
  usage(`bad moment "${s}"`);
}

let spec = { title: null, look: null, pairs: [] };
if (str('spec')) {
  const file = path.resolve(process.cwd(), str('spec'));
  if (!fs.existsSync(file)) usage(`no such spec ${str('spec')}`);
  spec = JSON.parse(fs.readFileSync(file, 'utf8'));
  spec.file = rel(file);
} else if (str('pairs')) {
  spec.pairs = str('pairs')
    .split(';')
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => {
      const [name, query, when] = x.split('|');
      if (!name || !query) usage(`bad pair "${x}" (name|query|when)`);
      return { name, label: name, query, at: parseWhen(when ?? '0') };
    });
} else usage('give --spec FILE or --pairs');
if (!Array.isArray(spec.pairs) || !spec.pairs.length) usage('the spec has no pairs');
for (const p of spec.pairs) {
  if (!p.name || !/^[\w.-]+$/.test(p.name)) usage(`pair name "${p.name}" must be [A-Za-z0-9_.-]`);
  if (!p.query) usage(`pair ${p.name} has no query`);
  for (const k of ['at', 'atBefore', 'atAfter']) if (typeof p[k] === 'string') p[k] = parseWhen(p[k]);
  if (p.at === undefined) p.at = 0;
}
const ONLY = str('only') ? str('only').split(',').map((x) => x.trim()) : null;
const PAIRS = ONLY ? spec.pairs.filter((p) => ONLY.includes(p.name)) : spec.pairs;
if (!PAIRS.length) usage('--only left no pairs');
const LOOK = str('look') ?? spec.look ?? null;
if (LOOK && LOOK !== 'v1' && LOOK !== 'v3') usage('--look must be v1 or v3');
const JOBS = Math.max(1, Math.floor(Number(args.jobs ?? 2)) || 1);
const X1 = args.x1 === 'true';
const SCALE = X1 ? 1 : Math.max(1, Math.floor(Number(args.scale ?? 2)) || 2);
const CAPTURE = str('capture');
/** --capture: which side's moments (atBefore / atAfter) to use (default before: the A56.0 frames). */
const CAPTURE_SIDE = str('side') ?? 'before';
if (CAPTURE_SIDE !== 'before' && CAPTURE_SIDE !== 'after') usage('--side must be before or after');
const OUT = str('out');
if (!CAPTURE && !OUT) usage('give --capture DIR or --out FILE|DIR');

/** The URL of a pair on one side: the look (unless the query has one) + the side's suffix. */
function urlOf(p, suffix) {
  let q = p.query.startsWith('?') || /\.html/.test(p.query) ? p.query : `?${p.query}`;
  if (LOOK && !/[?&]look=/.test(q)) q += `&look=${LOOK}`;
  return q + suffix;
}

function gitInfo() {
  try {
    const head = execFileSync('git', ['-C', ROOT, 'rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    const dirty = execFileSync('git', ['-C', ROOT, 'status', '--porcelain', '--', 'src'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    return { head, srcDirty: dirty.length > 0 };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- capture

/**
 * In the page, after the fresh restart: hook the anchor, start the action (freeze), step to the
 * moment. Returns { frame, t, anchorFrame } or { retryAtFrame } when the moment was already past.
 */
async function stepToMoment(o) {
  const N = window.__neon;
  const DT = 1000 / 60;
  const load = new Function('u', 'return import(u)');
  const at = o.at;
  let frame = 0;
  let inStep = false;
  const hits = []; // anchor starts (frames)
  const ends = []; // anchor ends (event edge 'end' / frac)
  if (at && typeof at === 'object' && at.event) {
    const sc = N.game.scene.getScene('Duel');
    const dir = sc && sc.director;
    if (!dir || typeof dir.runEvent !== 'function') throw new Error(`no Duel director for the event anchor ${at.event}`);
    const orig = dir.runEvent.bind(dir);
    dir.runEvent = (b, i, h) => {
      const ev = b.events[i];
      const p = orig(b, i, h);
      if (ev && ev.type === at.event) {
        const k = hits.length;
        hits.push(inStep ? frame + 1 : frame);
        Promise.resolve(p).then(() => (ends[k] = inStep ? frame + 1 : frame));
      }
      return p;
    };
  }
  if (at && typeof at === 'object' && at.lp) {
    // the LP panel starts to change (HudView.setLp with its roll) — the same hook as tools/measure.mjs
    const hud = N.duel && N.duel.views && N.duel.views.hud;
    if (!hud || typeof hud.setLp !== 'function') throw new Error('no HUD setLp for the lp anchor');
    const setLp = hud.setLp.bind(hud);
    hud.setLp = (pl, v, animate, ...r) => {
      if (animate !== false && (at.player === undefined || at.player === pl)) hits.push(inStep ? frame + 1 : frame);
      return setLp(pl, v, animate, ...r);
    };
  }
  if (at && typeof at === 'object' && at.sfx) {
    const m = await load('/src/audio/sfx.ts');
    const s = m.sfx;
    const play = s.play;
    s.play = function (name, ...r) {
      if (name === at.sfx) hits.push(inStep ? frame + 1 : frame);
      return play.call(this, name, ...r);
    };
  }
  N.freeze(); // t = 0: the armed scenario steps / the held opening start
  // let the armed start's promise continuations run before frame 1, as they do in tools/shot.mjs
  // (its freeze() is a page.evaluate of its own): frame N here is then pixel-identical to the
  // film frame of the same game frame (filmdiff frame i = game frame 2i)
  await new Promise((r) => setTimeout(r, 0));
  const nth = Math.max(1, (at && at.nth) || 1);
  let target = null;
  if (typeof at === 'number') target = at > 0 ? Math.max(1, Math.round(at / DT)) : 0;
  else if (at && typeof at.frame === 'number') target = at.frame;
  const maxFrames = Math.round((o.maxMs || 20000) / DT);
  let anchorFrame = null;
  for (;;) {
    if (target === null) {
      const needEnd = at.edge === 'end' || typeof at.frac === 'number';
      if (hits.length >= nth && (!needEnd || ends[nth - 1] !== undefined)) {
        anchorFrame = hits[nth - 1];
        const plus = Math.round((at.plus || 0) / DT);
        if (typeof at.frac === 'number') target = anchorFrame + Math.round(at.frac * (ends[nth - 1] - anchorFrame)) + plus;
        else if (at.edge === 'end') target = ends[nth - 1] + plus;
        else target = anchorFrame + plus;
        if (target < frame) return { retryAtFrame: Math.max(0, target), anchorFrame };
      }
    }
    if (target !== null && frame >= target) break;
    if (frame >= maxFrames) throw new Error(`the moment ${JSON.stringify(at)} did not come within ${o.maxMs || 20000} ms (${hits.length} anchor hit(s))`);
    inStep = true;
    await N.step(DT);
    inStep = false;
    frame++;
  }
  return { frame, t: Math.round(frame * DT), anchorFrame, anchorT: anchorFrame === null ? null : Math.round(anchorFrame * DT) };
}

/** A pair's moment on one side: atBefore / atAfter override at (a beat that moved or renamed). */
const momentOf = (p, side) => (side === 'after' ? p.atAfter : side === 'before' ? p.atBefore : undefined) ?? p.at;

async function captureOne(browser, base, p, suffix, file, side) {
  const url = urlOf(p, suffix);
  const kind = queryKind(url);
  const attempt = async (at) => {
    const page = await browser.newPage({ viewport: { width: 640, height: 360 }, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 200)));
    try {
      page.setDefaultTimeout(600000);
      await gotoReady(page, `${base}${url}${url.includes('?') ? '&' : '?'}test=1`, 300000);
      if (kind === 'scenario') await page.evaluate(freshScenarioInPage, new URLSearchParams(url.replace(/^[^?]*\?/, '')).get('s'));
      else if (kind === 'launch') await page.evaluate(freshLaunchInPage);
      if (p.eval) await page.evaluate(`(async () => { ${p.eval} })()`);
      const r = await page.evaluate(stepToMoment, { at, maxMs: p.maxMs ?? 20000 });
      if (r.retryAtFrame !== undefined) return { retry: r.retryAtFrame, anchorFrame: r.anchorFrame };
      const canvas = page.locator('canvas').first();
      const box = await canvas.boundingBox();
      fs.mkdirSync(path.dirname(file), { recursive: true });
      await page.screenshot({ path: file, clip: box ?? undefined });
      const neonErrors = await page.evaluate(() => window.__neon?.errors ?? []).catch(() => []);
      return { ...r, errors: [...errors, ...neonErrors.map(String)] };
    } finally {
      await page.close();
    }
  };
  let r = await attempt(momentOf(p, side));
  if (r.retry !== undefined) {
    const anchorFrame = r.anchorFrame;
    r = await attempt({ frame: r.retry });
    r.anchorFrame = anchorFrame;
    r.anchorT = anchorFrame === null ? null : Math.round((anchorFrame * 1000) / 60);
    r.secondPass = true;
  }
  return { url, ...r };
}

/** Capture every pair of `pairs` on one side into `dir`; returns { name → result }. */
async function captureSide(pairs, suffix, dir, label) {
  fs.mkdirSync(dir, { recursive: true });
  const { server, base } = await startServer({ lo: 7400, span: 500 });
  const browser = await launchBrowser();
  const results = {};
  try {
    const queue = [...pairs];
    const worker = async () => {
      for (;;) {
        const p = queue.shift();
        if (!p) return;
        const file = path.join(dir, `${p.name}.png`);
        const t0 = Date.now();
        try {
          const r = await captureOne(browser, base, p, suffix, file, label === 'capture' ? CAPTURE_SIDE : label);
          results[p.name] = { ok: true, file, ...r };
          console.log(`  [${label}] ${p.name.padEnd(16)} ${r.url}  frame ${r.frame} (t=${r.t} ms)${r.anchorFrame !== null && r.anchorFrame !== undefined ? `, anchor at ${r.anchorT} ms` : ''}${r.secondPass ? ' (second pass)' : ''}${r.errors?.length ? `  errors: ${r.errors.slice(0, 2).join(' | ')}` : ''}  [${Math.round((Date.now() - t0) / 1000)} s]`);
        } catch (e) {
          results[p.name] = { ok: false, file: null, url: urlOf(p, suffix), error: String(e?.message ?? e).split('\n')[0].slice(0, 300) };
          console.log(`  [${label}] ${p.name.padEnd(16)} FAILED: ${results[p.name].error}`);
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(JOBS, pairs.length) }, worker));
  } finally {
    await browser.close();
    await server.close();
  }
  fs.writeFileSync(
    path.join(dir, 'sbs.json'),
    JSON.stringify({ tool: 'tools/sbs.mjs', version: 1, date: new Date().toISOString(), git: gitInfo(), spec: spec.file ?? null, look: LOOK, suffix, side: label === 'capture' ? CAPTURE_SIDE : label, pairs: Object.fromEntries(pairs.map((p) => [p.name, { query: p.query, at: momentOf(p, label === 'capture' ? CAPTURE_SIDE : label), ...results[p.name], file: results[p.name]?.file ? path.basename(results[p.name].file) : null }])) }, null, 1),
  );
  return results;
}

// ---------------------------------------------------------------- compose

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const momentText = (at) =>
  typeof at === 'number'
    ? `t=${at} ms`
    : at.frame !== undefined
      ? `frame ${at.frame}`
      : `${at.event ? `event ${at.event}` : at.lp ? `LP change${at.player !== undefined ? ` P${at.player + 1}` : ''}` : `sfx ${at.sfx}`}${at.nth > 1 ? ` #${at.nth}` : ''}${at.edge === 'end' ? ' end' : ''}${typeof at.frac === 'number' ? ` ×${at.frac}` : ''}${at.plus ? ` ${at.plus > 0 ? '+' : ''}${at.plus} ms` : ''}`;

/** One side's frame of a pair: { b64, w, h, note } or { error }. */
function sideFrame(side, p) {
  if (side.dir) {
    const f = path.join(side.dir, `${p.name}.png`);
    if (!fs.existsSync(f)) return { error: `no ${rel(f)}` };
    let note = '';
    try {
      const m = JSON.parse(fs.readFileSync(path.join(side.dir, 'sbs.json'), 'utf8')).pairs?.[p.name];
      if (m && m.t !== undefined) note = `t=${m.t} ms${m.anchorT !== null && m.anchorT !== undefined ? ` (anchor ${m.anchorT})` : ''}`;
    } catch {
      /* frames without a manifest */
    }
    return { b64: fs.readFileSync(f).toString('base64'), note };
  }
  const r = side.results?.[p.name];
  if (!r || !r.ok) return { error: r?.error ?? 'not captured' };
  return { b64: fs.readFileSync(r.file).toString('base64'), note: `t=${r.t} ms${r.anchorT !== null && r.anchorT !== undefined ? ` (anchor ${r.anchorT})` : ''}` };
}

function pageHtml(title, pairs, before, after) {
  const W = 640 * SCALE;
  const H = 360 * SCALE;
  const cell = (fr, w, h, clip, scale) => {
    if (fr.error) return `<div class="miss" style="width:${w}px;height:${h}px">${esc(fr.error)}</div>`;
    if (!clip) return `<img style="width:${w}px;height:${h}px" src="data:image/png;base64,${fr.b64}">`;
    const [x, y, cw, ch] = clip;
    return `<div style="width:${cw * scale}px;height:${ch * scale}px;overflow:hidden;position:relative"><img style="position:absolute;left:${-x * scale}px;top:${-y * scale}px;width:${640 * scale}px;height:${360 * scale}px" src="data:image/png;base64,${fr.b64}"></div>`;
  };
  const rows = pairs
    .map((p) => {
      const b = sideFrame(before, p);
      const a = sideFrame(after, p);
      const zooms = (p.zoom ?? [])
        .map((z) => {
          const s = Math.max(1, Math.floor(z.scale ?? 3));
          const [, , cw, ch] = z.clip;
          return `<div class="sub">×${s} ${z.clip.join(',')}</div><div class="pair">${cell(b, cw * s, ch * s, z.clip, s)}${cell(a, cw * s, ch * s, z.clip, s)}</div>`;
        })
        .join('');
      const mb = momentText(momentOf(p, 'before'));
      const ma = momentText(momentOf(p, 'after'));
      return `<section><div class="lab"><b>${esc(p.label ?? p.name)}</b> <span>${esc(p.name)} · ${esc(p.query)} · ${esc(mb === ma ? mb : `önce ${mb} / sonra ${ma}`)}</span></div>
        <div class="pair"><div><div class="side">ÖNCE ${esc(b.note ?? '')}</div>${cell(b, W, H)}</div><div><div class="side">SONRA ${esc(a.note ?? '')}</div>${cell(a, W, H)}</div></div>${zooms}</section>`;
    })
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body{margin:0;background:#07070f;color:#a3b1da;font:12px "DejaVu Sans Mono",monospace}
    h1{font-size:14px;margin:8px 8px 4px;color:#f4f7ff} .meta{margin:0 8px 6px;color:#6578b4}
    section{margin:6px 8px 12px} .lab b{color:#f4f7ff} .lab span{color:#6578b4}
    .pair{display:flex;gap:8px;align-items:flex-start;margin-top:3px} .side{color:#3fe0ea;margin:2px 0}
    .sub{color:#6578b4;margin-top:6px} img{display:block;image-rendering:pixelated}
    .miss{display:flex;align-items:center;justify-content:center;background:#1b2352;color:#ff4d5e;text-align:center}
  </style></head><body><h1>${esc(title)}</h1><div class="meta">önce: ${esc(before.desc)} · sonra: ${esc(after.desc)} · ${X1 ? '1× (büyütmesiz)' : `×${SCALE}`}</div>${rows}</body></html>`;
}

async function renderPage(html, file) {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage({ viewport: { width: 640 * SCALE * 2 + 40, height: 400 }, deviceScaleFactor: 1 });
    await page.setContent(html);
    // the page is exactly as wide as its widest row
    const w = await page.evaluate(() => Math.ceil(document.documentElement.scrollWidth));
    await page.setViewportSize({ width: w, height: 400 });
    fs.mkdirSync(path.dirname(file), { recursive: true });
    await page.screenshot({ path: file, fullPage: true });
  } finally {
    await browser.close();
  }
}

// ---------------------------------------------------------------- run

const t0 = Date.now();
if (CAPTURE) {
  const dir = path.resolve(process.cwd(), CAPTURE);
  const suffix = suffixOf(str('suffix'));
  console.log(`[sbs] capturing ${PAIRS.length} pair(s)${LOOK ? `, look ${LOOK}` : ''}${suffix ? `, suffix ${suffix}` : ''} → ${rel(dir)}`);
  const res = await captureSide(PAIRS, suffix, dir, 'capture');
  const bad = Object.values(res).filter((r) => !r.ok).length;
  console.log(`[sbs] ${PAIRS.length - bad}/${PAIRS.length} captured → ${rel(dir)} [${Math.round((Date.now() - t0) / 1000)} s]`);
  process.exit(bad ? 2 : 0);
}

const outAbs = path.resolve(process.cwd(), OUT);
const PAGE = args.page === 'true';
const framesRoot = path.resolve(process.cwd(), str('frames') ?? `${outAbs}.frames`);
const sides = {};
for (const side of ['before', 'after']) {
  const dir = str(side);
  if (dir) {
    const abs = path.resolve(process.cwd(), dir);
    if (!fs.existsSync(abs)) usage(`--${side}: no such directory ${dir}`);
    sides[side] = { dir: abs, desc: rel(abs) };
  } else {
    if (side === 'before' && !str('before-suffix')) usage('the before side needs --before DIR or --before-suffix Q');
    const suffix = suffixOf(str(`${side}-suffix`));
    sides[side] = { suffix, desc: `now${suffix ? ` ${suffix}` : ''}` };
  }
}
for (const side of ['before', 'after']) {
  if (sides[side].dir) continue;
  const dir = path.join(framesRoot, side);
  console.log(`[sbs] capturing the ${side} side (${PAIRS.length} pair(s)${sides[side].suffix ? `, suffix ${sides[side].suffix}` : ''}) → ${rel(dir)}`);
  sides[side].results = await captureSide(PAIRS, sides[side].suffix, dir, side);
}
const title = str('title') ?? spec.title ?? 'önce | sonra';
const written = [];
if (PAGE) {
  await renderPage(pageHtml(title, PAIRS, sides.before, sides.after), outAbs);
  written.push(outAbs);
} else {
  for (const p of PAIRS) {
    const f = path.join(outAbs, `sbs-${p.name}.png`);
    await renderPage(pageHtml(`${title} — ${p.label ?? p.name}`, [p], sides.before, sides.after), f);
    written.push(f);
  }
}
const missing = PAIRS.filter((p) => sideFrame(sides.before, p).error || sideFrame(sides.after, p).error).map((p) => p.name);
console.log(`[sbs] wrote ${written.map(rel).join(', ')} (${PAIRS.length} pair(s), ${X1 ? '1×' : `×${SCALE}`}${missing.length ? `; MISSING frames: ${missing.join(', ')}` : ''}) [${Math.round((Date.now() - t0) / 1000)} s]`);
process.exit(missing.length ? 2 : 0);
