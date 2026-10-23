#!/usr/bin/env node
// Texture memory + monster sheet painting of the running game (headless Chromium + Vite dev
// server, like tools/measure.mjs). The A4.1 scaling gate's measuring tool (docs/v3/A3_MIMARI.md
// §11.2, REHBER KK-13): how many bytes every texture holds — per key and per category (monster
// sheets P1 / P2, cut-ins, cards, arena, vfx, ui) — how long the monster sheets take to paint, and
// whether anything blocks the main thread for more than 50 ms.
//
//   node tools/texmem.mjs [--look v1|v3|both] [--boot] [--scenario a,b] [--demo 9,2] [options]
//
//   --look v1|v3|both  which look(s) to measure (default both)
//   --boot             the game's boot: index.html (title screen) until every monster sheet the boot
//                      queued is painted and the first-use warming is done (default when no run is given)
//   --scenario KEYS    ?dev=duel&s=<key>&test=1 (what films / measure pages hold): its boot (staged
//                      sheets painted synchronously), then the scenario played in real time to the end
//   --demo SEEDS       ?mode=demo&seed=<s>&speed=<speed>&skipIntro=1: a CPU-vs-CPU game played in real time
//                      to the game over (the texture state after a whole game)
//   --speed N          demo speed (default 3)
//   --repeat N         demo: play the same seed N times in the same page (__neon.duel.restart, as "Tekrar
//                      Oyna") and snapshot after every game — whatever grows from game to game is a leak
//                      or an unbounded cache (default 1)
//   --profile          also record a V8 CPU profile of the run: inclusive ms of the sheet painters
//                      (works on any checkout, also the ones without the paint statistics)
//   --root DIR         serve another checkout (e.g. a snapshot of the code before a change)
//   --out FILE         JSON (default shots/texmem.json); a readable table goes next to it (.txt)
//   --label TEXT       stored in the JSON and printed in the table header
//   --atlas-png DIR    boot runs: also write every source canvas of the cropped monster sheets (the
//                      packed animation groups) as DIR/<look>-<key>-<i>.png, to look at the atlas
//   --game-timeout MS  per demo game (default 900000)
//   --settle MS        real ms waited after a run ends before the snapshot (default 1500)
//
// Bytes: every texture source counts width × height × 4 (RGBA) — the GPU copy; a canvas-backed
// source holds the same again in its canvas on the CPU side (Phaser keeps the canvas for context
// loss), so the CPU + GPU footprint of a canvas texture is twice the number shown. `gl` is the sum
// over every live WebGL texture (render targets included). `heapMB` is the JS heap after a forced GC
// (ArrayBuffer backing stores, e.g. PixelCanvas frame caches, are NOT in it: see `frameCache`).
// Painting: `paint` comes from src/art/textures.ts sheetPaintStats() when the served code has it
// (CPU ms in the painters per sheet, when each sheet finished); `bootToPaintedMs` is the wall time
// from navigation start until every queued sheet is painted (whenMonstersBuilt() on older code, which
// does not paint P2 sheets ahead); `longtasks` are the main-thread tasks ≥ 50 ms (PerformanceObserver),
// with the cinematic event that was playing.
//
// Categories (by texture key): monP1 `mon:<id>`, monP2 `mon:<id>:p2`, monOther (other `mon:` keys),
// cutin `cutin:*`, cards (`card*`, `tilecard*`, `cardart*`, `pile*`, `hand*`), arena (`arena*`, `board*`,
// `calm*`, `stadium*`, `sky*`, `tile*`), vfx (`fx*`, `vfx*`, `shatter*`, `set*`, `light*`, `glow*`, `holo*`,
// `summon*`, `combat*`, `px*`, `spark*`, `ring*`, `flow*`, `duel:shadow*`), ui (`ui*`, `font*`, `hud*`,
// `duel*`, `btn*`, `num*`, `title*`, `icon*`, `duelist*`), other.
//
// Exit code 1 when a run fails (page error, timeout).

import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(REPO, 'package.json'));

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
const ROOT = path.resolve(args.root ?? REPO);
const OUT = path.resolve(REPO, args.out ?? 'shots/texmem.json');
const LOOKS = args.look === 'v1' ? ['v1'] : args.look === 'v3' ? ['v3'] : ['v1', 'v3'];
const SPEED = Number(args.speed ?? 3);
const REPEAT = Math.max(1, Number(args.repeat ?? 1));
const GAME_TIMEOUT = Number(args['game-timeout'] ?? 900000);
const SETTLE = Number(args.settle ?? 1500);
const PROFILE = args.profile === 'true';
const ATLAS_PNG = args['atlas-png'] && args['atlas-png'] !== 'true' ? path.resolve(REPO, args['atlas-png']) : null;
const split = (v) => (v && v !== 'true' ? String(v).split(',').map((s) => s.trim()).filter(Boolean) : []);
const RUNS = [];
for (const look of LOOKS) {
  if (args.boot === 'true' || (!args.scenario && !args.demo)) RUNS.push({ look, kind: 'boot', arg: null });
  for (const k of split(args.scenario)) RUNS.push({ look, kind: 'scenario', arg: k });
  for (const s of split(args.demo)) RUNS.push({ look, kind: 'demo', arg: Number(s) });
}

function chromePath() {
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  try {
    for (const d of fs.readdirSync(base).sort().reverse()) {
      if (/^chromium-\d+$/.test(d)) {
        const p = path.join(base, d, 'chrome-linux', 'chrome');
        if (fs.existsSync(p)) return p;
      }
    }
  } catch {}
  return undefined;
}

function gitInfo(dir) {
  try {
    const sha = execFileSync('git', ['-C', dir, 'rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    const dirty = execFileSync('git', ['-C', dir, 'status', '--porcelain', '--', 'src'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    return { head: sha, srcDirty: dirty.length > 0 };
  } catch {
    const snap = path.join(dir, '.snapshot-head');
    return fs.existsSync(snap) ? { head: fs.readFileSync(snap, 'utf8').trim(), snapshot: true } : null;
  }
}

const log = (...a) => console.log('[texmem]', ...a);

// ---------------------------------------------------------------- categories

const CATS = ['monP1', 'monP2', 'monOther', 'cutin', 'cards', 'arena', 'vfx', 'ui', 'other'];

function categoryOf(key) {
  if (/^mon:[a-z_]+$/.test(key)) return 'monP1';
  if (/^mon:[a-z_]+:p2$/.test(key)) return 'monP2';
  if (key.startsWith('mon:')) return 'monOther';
  if (key.startsWith('cutin')) return 'cutin';
  if (/^(card|tilecard|cardart|pile|hand|deck|grave)/.test(key)) return 'cards';
  if (/^(arena|board|calm|stadium|sky|tile|iso|floor|pitch|crowd|backdrop)/.test(key)) return 'arena';
  if (/^(fx|vfx|shatter|set|light|glow|holo|summon|combat|px|spark|ring|flow|particle|duel:shadow|beam|bolt|chain|trap|spell|banner|rune)/.test(key)) return 'vfx';
  if (/^(ui|font|hud|duel|btn|num|title|icon|duelist|prompt|log|menu|panel|text|glyph|cursor)/.test(key)) return 'ui';
  return 'other';
}

// ---------------------------------------------------------------- page side

/** Installed before any page script: long tasks, the RAF clock and the cinematic event in play. */
const INIT = () => {
  window.__tm = { longtasks: [], ev: '', raf0: 0 };
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) window.__tm.longtasks.push({ start: Math.round(e.startTime), ms: Math.round(e.duration), ev: window.__tm.ev });
    }).observe({ type: 'longtask', buffered: true });
  } catch {}
  requestAnimationFrame((t) => (window.__tm.raf0 = Math.round(t)));
};

/** Hook the cinematics observer once the app modules exist (the playing event names long tasks). */
const HOOK_EVENTS = async () => {
  try {
    const m = await import('/src/cinematics/_core/registry.ts');
    m.registerObserver((ev) => (window.__tm.ev = ev.type));
    return true;
  } catch {
    return false;
  }
};

/** The texture state of the page (serialized by Playwright). */
const SNAPSHOT = async () => {
  const g = window.__neon.game;
  const list = g.textures.list;
  const rows = [];
  for (const k of Object.keys(list)) {
    if (k === '__DEFAULT' || k === '__MISSING' || k === '__WHITE' || k === '__NORMAL') continue;
    const t = list[k];
    let bytes = 0;
    let canvas = 0;
    const dims = [];
    for (const s of t.source || []) {
      bytes += (s.width || 0) * (s.height || 0) * 4;
      if (s.isCanvas) canvas++;
      if (dims.length < 6) dims.push(`${s.width}x${s.height}`);
    }
    rows.push({ key: k, bytes, sources: (t.source || []).length, canvas, frames: t.frameTotal, dims });
  }
  const r = g.renderer;
  let glBytes = 0;
  let glN = 0;
  for (const w of r && r.glTextureWrappers ? r.glTextureWrappers : []) {
    if (!w || !w.webGLTexture) continue;
    glN++;
    glBytes += (w.width || 0) * (w.height || 0) * 4;
  }
  if (typeof window.gc === 'function') {
    window.gc();
    window.gc();
  }
  const mem = performance.memory;
  const out = { rows, gl: { textures: glN, bytes: glBytes }, heapMB: mem ? +(mem.usedJSHeapSize / 1048576).toFixed(1) : -1, anims: g.anims.anims.size };
  try {
    const tx = await import('/src/art/textures.ts');
    if (typeof tx.sheetPaintStats === 'function') out.paint = tx.sheetPaintStats();
    if (typeof tx.frameCacheStats === 'function') out.frameCache = tx.frameCacheStats();
    if (typeof tx.monsterSheetStats === 'function') out.sheets = tx.monsterSheetStats();
  } catch (e) {
    out.textureModule = String(e);
  }
  try {
    const w = await import('/src/duel/warm.ts');
    const s = w.warmStats();
    out.warm = { jobs: s.jobs, done: s.done, ms: +s.ms.toFixed(1), maxJobMs: +s.maxJobMs.toFixed(1), maxJob: s.maxJob, startedAt: Math.round(s.startedAt), finishedAt: Math.round(s.finishedAt), errors: s.errors };
  } catch {}
  out.scenes = g.scene.getScenes(true).map((s) => s.sys.settings.key);
  out.longtasks = window.__tm ? window.__tm.longtasks.slice() : [];
  out.errors = (window.__neon.errors || []).slice(0, 20);
  out.at = Math.round(performance.now());
  return out;
};

/** Resolves (page time, ms) once the boot's monster sheets are painted and the warming is done. */
const WAIT_PAINTED = async (capMs) => {
  const t0 = performance.now();
  const tx = await import('/src/art/textures.ts');
  const res = { builtAt: -1, paintedAt: -1, warmAt: -1, timedOut: false };
  const cap = new Promise((r) => setTimeout(() => r('cap'), capMs));
  await Promise.race([tx.whenMonstersBuilt().then(() => (res.builtAt = Math.round(performance.now()))), cap]);
  // newer code: every sheet the boot queued (P2 sheets included)
  if (typeof tx.whenSheetsPainted === 'function') await Promise.race([tx.whenSheetsPainted().then(() => (res.paintedAt = Math.round(performance.now()))), cap]);
  else res.paintedAt = res.builtAt;
  try {
    const w = await import('/src/duel/warm.ts');
    for (;;) {
      const s = w.warmStats();
      if (s.finishedAt > 0) {
        res.warmAt = Math.round(s.finishedAt);
        break;
      }
      if (performance.now() - t0 > capMs) {
        res.timedOut = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 100));
    }
  } catch {}
  if (res.builtAt < 0 || res.paintedAt < 0) res.timedOut = true;
  return res;
};

// ---------------------------------------------------------------- profile

/** Inclusive ms per function name (a sample counts once per name, recursion included). */
function inclusiveByName(profile, names) {
  const parent = new Map();
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
  const out = Object.fromEntries(names.map((n) => [n, 0]));
  const samples = profile.samples ?? [];
  const deltas = profile.timeDeltas ?? [];
  for (let i = 0; i < samples.length; i++) {
    const us = deltas[i + 1] ?? deltas[i] ?? 0;
    const seen = new Set();
    let id = samples[i];
    while (id !== undefined) {
      const n = byId.get(id);
      const fn = n?.callFrame?.functionName;
      if (fn && fn in out && !seen.has(fn)) {
        seen.add(fn);
        out[fn] += us;
      }
      id = parent.get(id);
    }
  }
  for (const k of Object.keys(out)) out[k] = Math.round(out[k] / 1000);
  return out;
}

const PAINT_FNS = ['drawMonsterFrame', 'paintCell', 'paintSlice', 'ensureAnims', 'buildMonster', 'buildAllMonsters', 'upload', 'packGroup', 'commitGroup', 'paintGroupNow', 'warmFirstUse'];

// ---------------------------------------------------------------- runs

const { createServer } = await import(pathToFileURL(require.resolve('vite')).href);
const { chromium } = require('playwright-core');

const server = await createServer({
  root: ROOT,
  configFile: fs.existsSync(path.join(ROOT, 'vite.config.ts')) ? path.join(ROOT, 'vite.config.ts') : false,
  logLevel: 'error',
  cacheDir: ROOT === REPO ? undefined : path.join(ROOT, '.vite-cache'),
  server: { port: 6900 + Math.floor(Math.random() * 600), host: '127.0.0.1', strictPort: false, hmr: false },
  clearScreen: false,
});
await server.listen();
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch({
  executablePath: chromePath(),
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--js-flags=--expose-gc', '--enable-precise-memory-info'],
});

async function gotoRetry(page, url) {
  try {
    await page.goto(url, { waitUntil: 'load', timeout: 240000 });
  } catch (e) {
    log(`retrying ${url}: ${String(e.message).split('\n')[0]}`);
    await page.goto(url, { waitUntil: 'load', timeout: 240000 });
  }
}

function urlOf(run) {
  const look = run.look === 'v3' ? '&look=v3' : '';
  if (run.kind === 'boot') return `${base}?boot=1${look}`;
  if (run.kind === 'scenario') return `${base}?dev=duel&s=${encodeURIComponent(run.arg)}${look}&test=1`;
  return `${base}?mode=demo&seed=${run.arg}&speed=${SPEED}&skipIntro=1${look}`;
}

/** Poll a demo game until its game over (and the game-over cinematic is done). */
async function playToGameOver(page, rec) {
  const t1 = Date.now();
  const game = { winner: null, reason: null, turns: 0, lp: null, wallMs: 0, timedOut: false };
  let last = '';
  let lastMove = Date.now();
  for (;;) {
    const st = await page.evaluate(() => {
      const s = window.__neon.duel.state();
      return { turn: s.turn, phase: s.phase, winner: s.winner, reason: s.winReason, lp: [s.players[0].lp, s.players[1].lp] };
    });
    if (st.winner !== null && st.winner !== undefined) {
      Object.assign(game, { winner: st.winner, reason: st.reason, turns: st.turn, lp: st.lp });
      break;
    }
    const sig = `${st.turn}|${st.phase}|${st.lp}`;
    if (sig !== last) {
      last = sig;
      lastMove = Date.now();
    }
    if (Date.now() - t1 > GAME_TIMEOUT) {
      rec.notes.push(`game not over after ${GAME_TIMEOUT} ms (turn ${st.turn})`);
      game.timedOut = rec.timedOut = true;
      break;
    }
    if (Date.now() - lastMove > 240000) {
      rec.notes.push(`stalled at turn ${st.turn} ${st.phase}`);
      game.timedOut = rec.timedOut = true;
      break;
    }
    await page.waitForTimeout(1000);
  }
  await page.waitForFunction(() => !window.__neon.duel.busy(), null, { timeout: 120000 }).catch(() => rec.notes.push('busy 120 s after the game over'));
  game.wallMs = Date.now() - t1;
  return game;
}

async function measureRun(run) {
  const ctx = await browser.newContext({ viewport: { width: 640, height: 360 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.setDefaultTimeout(600000);
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e.message).slice(0, 400)));
  page.on('console', (m) => {
    if (m.type() === 'error' && consoleErrors.length < 40) consoleErrors.push(m.text().slice(0, 400));
  });
  await page.addInitScript(INIT);
  let cdp = null;
  if (PROFILE) {
    cdp = await ctx.newCDPSession(page);
    await cdp.send('Profiler.enable');
    await cdp.send('Profiler.setSamplingInterval', { interval: 250 });
    await cdp.send('Profiler.start');
  }
  const rec = { ...run, url: '', t: {}, notes: [] };
  rec.url = urlOf(run).replace(base, '/');
  const wall0 = Date.now();
  try {
    await gotoRetry(page, urlOf(run));
    rec.t.loadWall = Date.now() - wall0;
    await page.waitForFunction(() => window.__neon && window.__neon.game && window.__neon.game.scene.getScenes(true).some((s) => s.sys.settings.key !== 'Boot'), null, { timeout: 300000 });
    rec.t.firstSceneWall = Date.now() - wall0;
    rec.hooked = await page.evaluate(HOOK_EVENTS);
    if (run.kind === 'boot') {
      const w = await page.evaluate(WAIT_PAINTED, 240000);
      rec.t = { ...rec.t, ...w };
      if (w.timedOut) rec.notes.push('painting / warming did not finish within 240 s');
      if (ATLAS_PNG) {
        const pngs = await page.evaluate(() => {
          const out = [];
          const list = window.__neon.game.textures.list;
          for (const k of Object.keys(list)) {
            if (!k.startsWith('mon:') || (list[k].source || []).length < 2) continue;
            list[k].source.forEach((s, i) => {
              if (i > 0 && s.image && s.image.toDataURL) out.push({ key: k, i, w: s.width, h: s.height, url: s.image.toDataURL('image/png') });
            });
          }
          return out;
        });
        fs.mkdirSync(ATLAS_PNG, { recursive: true });
        for (const p of pngs) fs.writeFileSync(path.join(ATLAS_PNG, `${run.look}-${p.key.replace(/:/g, '_')}-${String(p.i).padStart(2, '0')}.png`), Buffer.from(p.url.split(',')[1], 'base64'));
        rec.notes.push(`${pngs.length} atlas canvases written to ${path.relative(REPO, ATLAS_PNG)}`);
      }
    } else if (run.kind === 'scenario') {
      await page.waitForFunction(() => window.__neon.ready === true && !!window.__neon.duel, null, { timeout: 300000 });
      rec.t.readyWall = Date.now() - wall0;
      rec.t.readyAt = await page.evaluate(() => Math.round(performance.now()));
      const t1 = Date.now();
      // the scenario again, in real time (the dev preview armed its film start on a freeze that never comes)
      await page.evaluate((k) => window.__neon.duel.scenario(k), run.arg);
      await page.waitForFunction(() => !window.__neon.duel.busy(), null, { timeout: 120000 }).catch(() => rec.notes.push('still busy 120 s after the steps'));
      rec.t.playWall = Date.now() - t1;
    } else {
      await page.waitForFunction(() => window.__neon.ready === true && !!window.__neon.duel, null, { timeout: 300000 });
      rec.t.readyWall = Date.now() - wall0;
      rec.games = [];
      for (let g = 0; g < REPEAT; g++) {
        if (g > 0) {
          // "Tekrar Oyna": the same seed again in the same page (every cache is warm now)
          await page.evaluate(({ seed, speed }) => {
            window.__neon.ready = false;
            void window.__neon.duel.restart({ mode: 'demo', seed, speed, skipIntro: true });
          }, { seed: run.arg, speed: SPEED });
          await page.waitForFunction(() => window.__neon.ready === true && !!window.__neon.duel, null, { timeout: 300000 });
        }
        const game = await playToGameOver(page, rec);
        if (g < REPEAT - 1 || REPEAT > 1) {
          await page.waitForTimeout(SETTLE);
          game.snap = await page.evaluate(SNAPSHOT);
        }
        rec.games.push(game);
        Object.assign(rec, { winner: game.winner, reason: game.reason, turns: game.turns, lp: game.lp });
        if (game.timedOut) break;
      }
      rec.t.playWall = rec.games.reduce((a, gm) => a + gm.wallMs, 0);
    }
    await page.waitForTimeout(SETTLE);
    rec.snap = await page.evaluate(SNAPSHOT);
  } catch (e) {
    rec.failed = String(e && e.message ? e.message : e).slice(0, 600);
  }
  if (cdp) {
    try {
      const { profile } = await cdp.send('Profiler.stop');
      rec.profileMs = inclusiveByName(profile, PAINT_FNS);
    } catch (e) {
      rec.notes.push(`profile failed: ${String(e).slice(0, 200)}`);
    }
  }
  rec.pageErrors = pageErrors;
  rec.consoleErrors = consoleErrors;
  rec.wallMs = Date.now() - wall0;
  await ctx.close();
  return rec;
}

// ---------------------------------------------------------------- report

const MB = (b) => +(b / 1048576).toFixed(2);

function summarize(rec) {
  if (!rec.snap) return null;
  const cats = Object.fromEntries(CATS.map((c) => [c, 0]));
  const counts = Object.fromEntries(CATS.map((c) => [c, 0]));
  let total = 0;
  for (const r of rec.snap.rows) {
    const c = categoryOf(r.key);
    r.cat = c;
    cats[c] += r.bytes;
    counts[c]++;
    total += r.bytes;
  }
  const lt = rec.snap.longtasks ?? [];
  return {
    totalMB: MB(total),
    textures: rec.snap.rows.length,
    catsMB: Object.fromEntries(CATS.map((c) => [c, MB(cats[c])])),
    catCounts: counts,
    monMB: MB(cats.monP1 + cats.monP2 + cats.monOther),
    glMB: MB(rec.snap.gl.bytes),
    glTextures: rec.snap.gl.textures,
    heapMB: rec.snap.heapMB,
    longtasks: lt.length,
    longestTask: Math.max(0, ...lt.map((t) => t.ms)),
    longtasksAfterBoot: lt.filter((t) => t.start > (rec.t.paintedAt > 0 ? rec.t.paintedAt : rec.t.readyAt ?? 0)).map((t) => `${t.ms}ms@${t.start}${t.ev ? `(${t.ev})` : ''}`),
  };
}

const results = [];
let failed = 0;
try {
  log(`${RUNS.length} run(s), root ${path.relative(REPO, ROOT) || '.'}`);
  // warm the dev server's module transforms once (an unstaged dev page), so the first run's load
  // times are not the server's cold compile
  {
    const ctx = await browser.newContext({ viewport: { width: 640, height: 360 } });
    const page = await ctx.newPage();
    try {
      await gotoRetry(page, `${base}?dev=duel&test=1`);
      await page.waitForFunction(() => window.__neon && window.__neon.game, null, { timeout: 300000 });
    } catch (e) {
      log(`warm-up page failed: ${String(e).slice(0, 200)}`);
    }
    await ctx.close();
  }
  for (const run of RUNS) {
    const rec = await measureRun(run);
    rec.summary = summarize(rec);
    results.push(rec);
    const s = rec.summary;
    if (rec.failed || rec.pageErrors.length || rec.timedOut) failed++;
    log(
      `${run.look} ${run.kind}${run.arg !== null ? ` ${run.arg}` : ''}: ${rec.failed ? `FAILED ${rec.failed}` : `total ${s.totalMB} MB (mon P1 ${s.catsMB.monP1} / P2 ${s.catsMB.monP2}), gl ${s.glMB} MB, heap ${s.heapMB} MB, longest task ${s.longestTask} ms`}${rec.pageErrors.length ? `, ${rec.pageErrors.length} page errors` : ''} [${Math.round(rec.wallMs / 1000)} s]`,
    );
  }
} finally {
  await browser.close();
  await server.close();
}

const out = { tool: 'texmem', date: new Date().toISOString(), label: args.label ?? null, root: path.relative(REPO, ROOT) || '.', git: gitInfo(ROOT), speed: SPEED, runs: results };
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));

// ---- the readable table
const L = [];
L.push(`texmem ${out.date}  root ${out.root}  ${out.git ? `${out.git.head.slice(0, 8)}${out.git.srcDirty ? ' + uncommitted src' : ''}${out.git.snapshot ? ' (snapshot)' : ''}` : ''}${out.label ? `  — ${out.label}` : ''}`);
L.push('');
L.push('run                         total   monP1   monP2  monOth   cutin   cards   arena     vfx      ui   other |  #tex   gl MB  heap |  paint→ms  warm→ms  firstScene  longest  >50ms');
for (const r of results) {
  const s = r.summary;
  const name = `${r.look} ${r.kind}${r.arg !== null ? ` ${r.arg}` : ''}`.padEnd(26);
  if (!s) {
    L.push(`${name}  FAILED ${r.failed ?? ''}`);
    continue;
  }
  const c = s.catsMB;
  const f = (v) => String(v.toFixed(2)).padStart(7);
  const paintAt = r.t.paintedAt ?? -1;
  L.push(
    `${name} ${f(s.totalMB)} ${f(c.monP1)} ${f(c.monP2)} ${f(c.monOther)} ${f(c.cutin)} ${f(c.cards)} ${f(c.arena)} ${f(c.vfx)} ${f(c.ui)} ${f(c.other)} | ${String(s.textures).padStart(5)} ${f(s.glMB)} ${String(s.heapMB).padStart(5)} | ${String(paintAt >= 0 ? paintAt : '-').padStart(8)} ${String(r.t.warmAt ?? '-').padStart(8)} ${String(r.t.firstSceneWall ?? '-').padStart(11)} ${String(s.longestTask).padStart(8)} ${String(s.longtasks).padStart(6)}`,
  );
}
L.push('');
for (const r of results) {
  if (!r.snap) continue;
  L.push(`--- ${r.look} ${r.kind}${r.arg !== null ? ` ${r.arg}` : ''}  (${r.url})`);
  const mon = r.snap.rows.filter((x) => x.key.startsWith('mon:')).sort((a, b) => b.bytes - a.bytes);
  for (const m of mon) L.push(`  ${m.key.padEnd(24)} ${String(MB(m.bytes).toFixed(2)).padStart(6)} MB  ${String(m.sources).padStart(2)} src  ${m.frames} frames  ${m.dims.join(' ')}`);
  const top = r.snap.rows.filter((x) => !x.key.startsWith('mon:')).sort((a, b) => b.bytes - a.bytes).slice(0, 12);
  L.push(`  largest others: ${top.map((x) => `${x.key} ${MB(x.bytes)}`).join(', ')}`);
  if (r.snap.paint) {
    const p = r.snap.paint;
    L.push(`  paint: ${JSON.stringify({ sheets: p.sheets?.length ?? 0, cpuMs: p.cpuMs, packMs: p.packMs, uploads: p.uploads, firstAt: p.firstAt, doneAt: p.doneAt, pending: p.pending })}`);
  }
  if (r.snap.frameCache) {
    const fc = r.snap.frameCache;
    L.push(`  frame cache: grid ${fc.grid.frames} frames ${MB(fc.grid.bytes)} MB, pinned ${fc.pinned.frames} ${MB(fc.pinned.bytes)} MB, lru ${fc.lru.frames} ${MB(fc.lru.bytes)} MB (budget ${MB(fc.lru.budget)}); ${JSON.stringify(fc.counts)}`);
  }
  if (r.profileMs) L.push(`  profile (inclusive ms): ${Object.entries(r.profileMs).filter(([, v]) => v > 0).map(([k, v]) => `${k} ${v}`).join(', ')}`);
  if (r.summary?.longtasksAfterBoot?.length) L.push(`  long tasks after boot: ${r.summary.longtasksAfterBoot.slice(0, 30).join(' ')}`);
  if (r.winner !== undefined) L.push(`  game: winner P${r.winner + 1} (${r.reason}) turn ${r.turns}, lp ${r.lp}`);
  if (r.games && r.games.length > 1)
    for (const [i, g] of r.games.entries()) {
      if (!g.snap) continue;
      const gs = summarize({ snap: g.snap, t: {} });
      const fc = g.snap.frameCache;
      L.push(
        `  game ${i + 1}: P${(g.winner ?? -2) + 1} turn ${g.turns}  total ${gs.totalMB} MB (mon P1 ${gs.catsMB.monP1} / P2 ${gs.catsMB.monP2}, vfx ${gs.catsMB.vfx}, ui ${gs.catsMB.ui}), ${gs.textures} textures, gl ${gs.glMB} MB, heap ${gs.heapMB} MB${fc ? `, frame cache ${MB(fc.grid.bytes + fc.pinned.bytes + fc.lru.bytes)} MB (grid ${fc.grid.frames}, pinned ${fc.pinned.frames}, lru ${fc.lru.frames})` : ''}`,
      );
    }
  if (r.notes.length) L.push(`  notes: ${r.notes.join(' | ')}`);
  if (r.pageErrors.length) L.push(`  PAGE ERRORS: ${r.pageErrors.join(' | ')}`);
  if (r.snap.errors?.length) L.push(`  __neon.errors: ${r.snap.errors.join(' | ')}`);
}
const table = L.join('\n');
fs.writeFileSync(OUT.replace(/\.json$/, '') + '.txt', table + '\n');
console.log('\n' + table);
console.log(`\n[texmem] wrote ${path.relative(REPO, OUT)} (+ .txt)`);
process.exit(failed ? 1 : 0);
