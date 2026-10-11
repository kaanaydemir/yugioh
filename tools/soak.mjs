#!/usr/bin/env node
// Soak / performance test for Neon Düello: plays N unattended CPU-vs-CPU demo games in ONE
// browser session (headless Chromium + Vite dev server) and records, per game and per turn:
//
//   winner / turns / wall time, __neon.duel.errors() (handler errors + watchdog timeouts),
//   page errors + console errors, live object counts of the Duel scene (display list, recursive
//   object count, per-camera render lists, update list, particle emitters + live particles,
//   tweens, timers, scene/game event listeners, interactive objects), texture count + texture
//   memory, GL texture wrappers, JS heap (performance.memory, after a forced GC), average / max
//   JS time per frame (Game.step wrapped: update + render split) and every frame spike with the
//   cinematic event that was playing.
//
// Games are chained with __neon.duel.restart() (scene restart, as "Tekrar Oyna" does); every
// --title-th game goes Duel → Title → Duel instead (as "Ana Menü" + a new duel from the menu).
//
//   node tools/soak.mjs [--games 12] [--seed 1] [--speed 3] [--slow 4] [--title 4] [--intro alt]
//                       [--repeat] [--detail] [--snap] [--stepped] [--profile <game#>]
//                       [--boot-profile] [--game-timeout MS] [--out shots/soak/report.json]
//                       [--scale 1] [--quiet]
//   e.g. node tools/soak.mjs --games 12 --detail                      (the standard soak)
//        node tools/soak.mjs --games 8 --seed 10 --repeat --snap --title 1   (leak hunt)
//        node tools/soak.mjs --games 0 --boot-profile                       (boot time only)
//
//   --slow K         every K-th game (index % K === K-1) runs at speed 1 (0 = never). Default 4.
//   --title K        every K-th game (index % K === 1; 1 = every game) starts through the title screen (0 = never). Default 4.
//   --intro 0|1|alt  play the opening cinematic: always / never / every other game (default alt).
//   --stepped        freeze the loop and step 1/60 s frames as fast as possible (deterministic
//                    frame count; test clock; ?test=1 so boot art is built synchronously).
//                    Frames are submitted back-to-back with no vsync, so their render time
//                    includes GPU back-pressure (headless swiftshader: 30+ ms, multi-second
//                    stalls): use it for leak / determinism checks, not for frame timing.
//                    Default: real time (requestAnimationFrame).
//   --profile N      record a V8 CPU profile of game N and print the top self-time functions.
//   --boot-profile   record a CPU profile of the page load (boot) and print the top functions.
//   --repeat         every game replays --seed (identical games: after the first one every cache
//                    is warm, so any growth of objects / textures / heap between games is a leak).
//   --snap           V8 heap snapshots at the start of game 1 and of the last game; prints what grew.
//   --detail         also record per-turn display-list groups, scene listeners and texture keys
//                    (diff them between samples to see WHAT accumulates).
//
// Writes the full JSON report to --out (+ a screenshot of every game's end next to it) and prints
// a summary table. Exit code 1 on any error, watchdog timeout, page error, stall or timeout.
//
// Reading the numbers (headless Chromium + swiftshader): the frame RATE is bound by the software
// GPU (~14 screens of overdraw: 8–20 fps), not by our JS — "avg_ms" is JS time per frame (Game.step:
// update + render command submission). Animations clamp dt to 50 ms, so below 20 fps game time
// runs slower than wall time and games take longer in wall-clock terms.

import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv) {
  const o = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
      o[k] = v;
    } else o._.push(a);
  }
  return o;
}

const args = parseArgs(process.argv.slice(2));
const GAMES = Number(args.games ?? 12);
const SEED0 = Number(args.seed ?? 1);
const SPEED = Number(args.speed ?? 3);
const SLOW_EVERY = Number(args.slow ?? 4);
const TITLE_EVERY = Number(args.title ?? 4);
const INTRO = String(args.intro ?? 'alt');
const STEPPED = args.stepped === 'true';
const PROFILE_GAME = args.profile !== undefined ? Number(args.profile) : -1;
const BOOT_PROFILE = args['boot-profile'] === 'true';
const GAME_TIMEOUT = Number(args['game-timeout'] ?? 20 * 60 * 1000);
const QUIET = args.quiet === 'true';
// replay the same seed every game: caches are warm after the first, so any growth is a leak
const REPEAT = args.repeat === 'true';
const SNAP = args.snap === 'true';
let snapA = null;
const scale = Number(args.scale ?? 1);
const out = path.resolve(root, args.out ?? 'shots/soak/report.json');
fs.mkdirSync(path.dirname(out), { recursive: true });

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

const log = (...a) => console.log(`[soak ${((Date.now() - T0) / 1000).toFixed(0).padStart(5)}s]`, ...a);
const T0 = Date.now();

// ------------------------------------------------------------------ page-side instrumentation
// Installed once (it lives on the Phaser.Game, so it survives scene restarts). Everything it
// records is read back with __soak.* calls.

const INSTRUMENT = (DETAIL) => `(() => {
  const DETAIL = ${DETAIL ? 'true' : 'false'};
  if (window.__soak) return 'already';
  const neon = window.__neon;
  const game = neon.game;
  const S = {
    gameNo: 0,
    frames: null,
    samples: [],
    lastTurn: -1,
    curEvent: '',
    evStart: 0,
    evTimes: {},
    observerOff: null,
    detail: DETAIL,
  };
  const newFrames = () => ({ n: 0, sum: 0, upd: 0, rend: 0, max: 0, maxUpd: 0, maxRend: 0, over16: 0, over33: 0, over50: 0, over100: 0, spikes: [], hist: {} });
  S.frames = newFrames();

  // ---- frame timing: wrap the TimeStep callback (Game.step) — works for RAF and for step()
  const loop = game.loop;
  const orig = loop.callback;
  let tPre = 0, tPostStep = 0, tPreRender = 0;
  game.events.on('prestep', () => { tPre = performance.now(); });
  game.events.on('poststep', () => { tPostStep = performance.now(); });
  game.events.on('prerender', () => { tPreRender = performance.now(); });
  loop.callback = function (time, delta) {
    const t0 = performance.now();
    tPre = tPostStep = tPreRender = t0;
    orig.call(this, time, delta);
    const t1 = performance.now();
    const dt = t1 - t0;
    const upd = tPostStep - tPre;
    const rend = t1 - tPostStep;
    const F = S.frames;
    F.n++; F.sum += dt; F.upd += upd; F.rend += rend;
    if (dt > F.max) F.max = dt;
    if (upd > F.maxUpd) F.maxUpd = upd;
    if (rend > F.maxRend) F.maxRend = rend;
    if (dt > 16.7) F.over16++;
    if (dt > 33) F.over33++;
    if (dt > 50) F.over50++;
    if (dt > 100) F.over100++;
    const b = dt < 4 ? '<4' : dt < 8 ? '<8' : dt < 16 ? '<16' : dt < 33 ? '<33' : dt < 50 ? '<50' : dt < 100 ? '<100' : '>=100';
    F.hist[b] = (F.hist[b] || 0) + 1;
    if (dt > 50 && F.spikes.length < 400) {
      const st = (() => { try { return neon.duel && neon.duel.state(); } catch { return null; } })();
      F.spikes.push({ ms: +dt.toFixed(1), upd: +upd.toFixed(1), rend: +rend.toFixed(1), turn: st ? st.turn : -1, ev: S.curEvent, frame: F.n, scene: activeScenes() });
    }
  };

  function activeScenes() {
    return game.scene.getScenes(true).map((s) => s.sys.settings.key).join(',');
  }

  // ---- which cinematic event is playing (registerObserver from the cinematics registry)
  import('/src/cinematics/_core/registry.ts').then((m) => {
    S.observerOff = m.registerObserver((ev) => {
      const now = performance.now();
      if (S.curEvent) S.evTimes[S.curEvent] = (S.evTimes[S.curEvent] || 0) + (now - S.evStart);
      S.curEvent = ev.type;
      S.evStart = now;
    });
  }).catch((e) => console.error('[soak] observer import failed', e));
  // --detail: count texture frames created per texture key prefix (Texture#add is their only maker)
  S.frameAdds = {};
  if (DETAIL) {
    try {
      const TexProto = Object.getPrototypeOf(game.textures.list['__DEFAULT']);
      const add = TexProto.add;
      TexProto.add = function (name, ...rest) {
        const k = String(this.key).split(':').slice(0, 2).join(':').replace(/^[0-9a-f]{8}-.*/, '(uuid)');
        S.frameAdds[k] = (S.frameAdds[k] || 0) + 1;
        return add.call(this, name, ...rest);
      };
    } catch (e) { console.error('[soak] frame counter failed', e); }
  }
  import('/src/vfx/hologram.ts').then((m) => { if (typeof m.hologramStats === 'function') S.holo = m.hologramStats; }).catch(() => undefined);

  // ---- counts
  function walk(list, acc) {
    for (const o of list) {
      acc.total++;
      acc.types[o.type] = (acc.types[o.type] || 0) + 1;
      if (o.type === 'ParticleEmitter') {
        acc.emitters++;
        try { acc.particles += o.getAliveParticleCount(); } catch {}
      }
      if (o.visible === false) acc.hidden++;
      if (o.list && Array.isArray(o.list)) walk(o.list, acc);
    }
    return acc;
  }

  function sceneCounts(scene) {
    if (!scene || !scene.sys) return null;
    const sys = scene.sys;
    const list = sys.displayList ? sys.displayList.list : [];
    const acc = walk(list, { total: 0, hidden: 0, emitters: 0, particles: 0, types: {} });
    const tm = scene.tweens;
    const tweens = tm ? (tm.getTweens ? tm.getTweens().length : (tm.tweens || []).length) : 0;
    const clock = scene.time;
    const timers = clock ? ((clock._active || []).length + (clock._pendingInsertion || []).length) : 0;
    const ev = scene.events;
    const evCounts = {};
    let evTotal = 0;
    for (const n of ev.eventNames()) { const c = ev.listenerCount(n); evCounts[String(n)] = c; evTotal += c; }
    const input = scene.input;
    const cams = scene.cameras ? scene.cameras.cameras.map((c) => ({ name: c.name || String(c.id), render: c.renderList ? c.renderList.length : -1 })) : [];
    return {
      key: sys.settings.key,
      display: list.length,
      objects: acc.total,
      hidden: acc.hidden,
      emitters: acc.emitters,
      particles: acc.particles,
      types: acc.types,
      update: sys.updateList ? sys.updateList.length : -1,
      tweens,
      timers,
      events: evTotal,
      eventsBy: evCounts,
      interactive: input && input._list ? input._list.length : -1,
      inputEvents: input ? input.eventNames().reduce((a, n) => a + input.listenerCount(n), 0) : -1,
      cams,
      anims: scene.anims ? scene.anims.anims.size : -1,
    };
  }

  function textureStats() {
    const list = game.textures.list;
    let n = 0, canvas = 0, bytes = 0;
    for (const k of Object.keys(list)) {
      if (k === '__DEFAULT' || k === '__MISSING' || k === '__WHITE' || k === '__NORMAL') continue;
      n++;
      const t = list[k];
      for (const s of t.source || []) {
        bytes += (s.width || 0) * (s.height || 0) * 4;
        if (s.isCanvas) canvas++;
      }
    }
    const r = game.renderer;
    return {
      textures: n,
      canvasTextures: canvas,
      texMB: +(bytes / 1048576).toFixed(1),
      glTextures: r && r.glTextureWrappers ? r.glTextureWrappers.length : -1,
      glBuffers: r && r.glBufferWrappers ? r.glBufferWrappers.length : -1,
      glFramebuffers: r && r.glFramebufferWrappers ? r.glFramebufferWrappers.length : -1,
      anims: game.anims.anims.size,
      gameEvents: game.events.eventNames().reduce((a, n) => a + game.events.listenerCount(n), 0),
      domCanvases: document.getElementsByTagName('canvas').length,
    };
  }

  function heap(gc) {
    if (gc && typeof window.gc === 'function') { window.gc(); window.gc(); }
    const m = performance.memory;
    return m ? +(m.usedJSHeapSize / 1048576).toFixed(2) : -1;
  }

  function duelScene() { return game.scene.getScene('Duel'); }

  // what the display list holds, grouped (type|texture|depth) — diffed between samples to find leaks
  function groups(scene) {
    const g = {};
    const add = (o, pre) => {
      const tex = o.texture && o.texture.key ? o.texture.key : '';
      const k = pre + o.type + '|' + tex.replace(/:\\d+$/, '') + '|' + Math.round(o.depth || 0);
      g[k] = (g[k] || 0) + 1;
      if (o.list && Array.isArray(o.list)) for (const c of o.list) add(c, '  ');
    };
    if (scene && scene.sys && scene.sys.displayList) for (const o of scene.sys.displayList.list) add(o, '');
    return g;
  }

  // scene event listeners by event name + the first bit of the handler's source
  function listeners(scene) {
    const out = {};
    if (!scene || !scene.events) return out;
    const ev = scene.events;
    for (const n of ev.eventNames()) {
      for (const fn of ev.listeners(n)) {
        const src = String(fn).replace(/\\s+/g, ' ').slice(0, 90);
        const k = String(n) + ' :: ' + src;
        out[k] = (out[k] || 0) + 1;
      }
    }
    return out;
  }

  function textureKeys() {
    const g = {};
    for (const k of Object.keys(game.textures.list)) {
      const pre = k.split(':').slice(0, 2).join(':');
      g[pre] = (g[pre] || 0) + 1;
    }
    return g;
  }

  function sample(tag, gc = false) {
    const D = neon.duel;
    let st = null;
    try { st = D && D.state(); } catch {}
    const s = {
      tag,
      t: +(performance.now() / 1000).toFixed(1),
      game: S.gameNo,
      turn: st ? st.turn : -1,
      phase: st ? st.phase : '',
      busy: D ? D.busy() : null,
      heapMB: heap(gc),
      duel: sceneCounts(duelScene()),
      title: game.scene.isActive('Title') ? sceneCounts(game.scene.getScene('Title')) : null,
      tex: textureStats(),
      holo: S.holo ? S.holo() : null,
    };
    if (S.detail) {
      s.groups = groups(duelScene());
      s.listeners = listeners(duelScene());
      s.texKeys = textureKeys();
      s.frameAdds = { ...S.frameAdds };
    }
    S.samples.push(s);
    return s;
  }

  // per-turn sampler: the first idle moment (controller waiting for an action) of every turn
  setInterval(() => {
    const D = neon.duel;
    if (!D || !game.scene.isActive('Duel')) return;
    let st;
    try { st = D.state(); } catch { return; }
    if (st.turn !== S.lastTurn && !D.busy()) {
      S.lastTurn = st.turn;
      sample('turn');
    }
  }, 25);

  window.__soak = {
    begin(no) {
      S.gameNo = no;
      S.frames = newFrames();
      S.samples = [];
      S.lastTurn = -1;
      S.evTimes = {};
      S.curEvent = '';
      neon.errors.length = 0;
    },
    sample,
    take() {
      const F = S.frames;
      const now = performance.now();
      if (S.curEvent) { S.evTimes[S.curEvent] = (S.evTimes[S.curEvent] || 0) + (now - S.evStart); S.evStart = now; }
      return {
        frames: { n: F.n, avg: F.n ? +(F.sum / F.n).toFixed(2) : 0, avgUpd: F.n ? +(F.upd / F.n).toFixed(2) : 0, avgRend: F.n ? +(F.rend / F.n).toFixed(2) : 0, max: +F.max.toFixed(1), maxUpd: +F.maxUpd.toFixed(1), maxRend: +F.maxRend.toFixed(1), over16: F.over16, over33: F.over33, over50: F.over50, over100: F.over100, hist: F.hist, spikes: F.spikes },
        samples: S.samples,
        evTimes: Object.fromEntries(Object.entries(S.evTimes).map(([k, v]) => [k, Math.round(v)])),
        pageErrors: [...neon.errors],
      };
    },
    status() {
      const D = neon.duel;
      let st = null;
      try { st = D && D.state(); } catch {}
      return { ready: !!neon.ready, duel: game.scene.isActive('Duel'), title: game.scene.isActive('Title'), turn: st ? st.turn : -1, winner: st ? st.winner : null, reason: st ? st.winReason : null, busy: D ? D.busy() : null, lp: st ? [st.players[0].lp, st.players[1].lp] : null };
    },
    errors() {
      const D = neon.duel;
      try { return D ? D.errors() : { handlers: [], timeouts: [] }; } catch (e) { return { handlers: [String(e)], timeouts: [] }; }
    },
  };
  return 'ok';
})()`;

// ------------------------------------------------------------------ CPU profile summary

function summarizeProfile(profile, top = 30) {
  const nodes = new Map(profile.nodes.map((n) => [n.id, n]));
  const self = new Map();
  const dt = profile.timeDeltas;
  const counts = new Map();
  for (let i = 0; i < profile.samples.length; i++) {
    const id = profile.samples[i];
    counts.set(id, (counts.get(id) ?? 0) + (dt[i] ?? 0));
  }
  let total = 0;
  for (const [id, us] of counts) {
    const n = nodes.get(id);
    const cf = n.callFrame;
    const file = cf.url ? cf.url.replace(/^https?:\/\/[^/]+\//, '').replace(/\?.*$/, '') : '';
    const key = `${cf.functionName || '(anon)'}  ${file}:${cf.lineNumber + 1}`;
    self.set(key, (self.get(key) ?? 0) + us);
    total += us;
  }
  const byFile = new Map();
  for (const [k, us] of self) {
    const file = k.split('  ')[1]?.replace(/:\d+$/, '') || '(native)';
    byFile.set(file, (byFile.get(file) ?? 0) + us);
  }
  // inclusive time of the boot steps / texture builders (subtree sums; recursion counted once)
  const children = new Map(profile.nodes.map((n) => [n.id, n.children ?? []]));
  const selfById = counts;
  const incl = new Map();
  const totalOf = (id) => {
    if (incl.has(id)) return incl.get(id);
    let t = selfById.get(id) ?? 0;
    for (const c of children.get(id) ?? []) t += totalOf(c);
    incl.set(id, t);
    return t;
  };
  const inclusive = new Map();
  const want = /^(build|register|buildAll|buildMonster|buildCardTextures|buildArenaTextures|buildUiTextures|buildSetTextures|buildCombatTextures|buildNumberTextures|buildParticleTextures|buildSummonTextures|buildCoreTextures|registerFonts|registerHologram|create|sheetTexture|addCanvas)$/;
  for (const n of profile.nodes) {
    const cf = n.callFrame;
    if (!want.test(cf.functionName)) continue;
    const file = cf.url.replace(/^https?:\/\/[^/]+\//, '').replace(/\?.*$/, '');
    if (!file.startsWith('src/') && cf.functionName !== 'addCanvas') continue;
    // skip nested occurrences of the same frame (count the outermost)
    let pid = null;
    const key = `${cf.functionName}  ${file}:${cf.lineNumber + 1}`;
    inclusive.set(key, (inclusive.get(key) ?? 0) + totalOf(n.id));
  }
  const rows = [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, top);
  const files = [...byFile.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
  return {
    totalMs: Math.round(total / 1000),
    functions: rows.map(([k, us]) => ({ fn: k, ms: Math.round(us / 1000), pct: +((100 * us) / total).toFixed(1) })),
    files: files.map(([k, us]) => ({ file: k, ms: Math.round(us / 1000), pct: +((100 * us) / total).toFixed(1) })),
    inclusive: [...inclusive.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30).map(([k, us]) => ({ fn: k, ms: Math.round(us / 1000) })),
  };
}

function printProfile(title, s) {
  console.log(`\n=== ${title}: ${s.totalMs} ms sampled`);
  console.log('  by file:');
  for (const f of s.files) console.log(`    ${String(f.ms).padStart(7)} ms ${String(f.pct).padStart(5)}%  ${f.file}`);
  if (s.inclusive?.length) {
    console.log('  builders (inclusive time):');
    for (const f of s.inclusive) console.log(`    ${String(f.ms).padStart(7)} ms  ${f.fn}`);
  }
  console.log('  by function (self time):');
  for (const f of s.functions) console.log(`    ${String(f.ms).padStart(7)} ms ${String(f.pct).padStart(5)}%  ${f.fn}`);
}

// ------------------------------------------------------------------ heap snapshots (--snap)

/** Take a V8 heap snapshot over CDP and aggregate it by constructor / node name. */
async function heapCensus(cdp) {
  const chunks = [];
  const onChunk = (e) => chunks.push(e.chunk);
  cdp.on('HeapProfiler.addHeapSnapshotChunk', onChunk);
  await cdp.send('HeapProfiler.collectGarbage');
  await cdp.send('HeapProfiler.takeHeapSnapshot', { reportProgress: false });
  cdp.off('HeapProfiler.addHeapSnapshotChunk', onChunk);
  const snap = JSON.parse(chunks.join(''));
  const meta = snap.snapshot.meta;
  const F = meta.node_fields;
  const N = F.length;
  const iType = F.indexOf('type');
  const iName = F.indexOf('name');
  const iSize = F.indexOf('self_size');
  const types = meta.node_types[iType];
  const nodes = snap.nodes;
  const strings = snap.strings;
  const agg = new Map();
  let total = 0;
  for (let i = 0; i < nodes.length; i += N) {
    const t = types[nodes[i + iType]];
    if (t === 'hidden' || t === 'synthetic') continue;
    let name = strings[nodes[i + iName]];
    if (t === 'string' || t === 'concatenated string' || t === 'sliced string') name = '(string)';
    else if (t === 'code') name = '(code)';
    else if (t === 'array') name = `(array) ${name}`;
    else if (t === 'closure') name = `(closure) ${name}`;
    const k = `${name}`.slice(0, 120);
    const a = agg.get(k) ?? [0, 0];
    a[0]++;
    a[1] += nodes[i + iSize];
    total += nodes[i + iSize];
    agg.set(k, a);
  }
  return { total, agg };
}

function censusDiff(a, b, top = 25) {
  const rows = [];
  for (const [k, [n, sz]] of b.agg) {
    const [n0, sz0] = a.agg.get(k) ?? [0, 0];
    if (n - n0 !== 0 || sz - sz0 !== 0) rows.push({ name: k, count: n - n0, kb: Math.round((sz - sz0) / 1024) });
  }
  for (const [k, [n0, sz0]] of a.agg) if (!b.agg.has(k)) rows.push({ name: k, count: -n0, kb: -Math.round(sz0 / 1024) });
  rows.sort((x, y) => Math.abs(y.kb) - Math.abs(x.kb));
  return { totalKb: Math.round((b.total - a.total) / 1024), rows: rows.slice(0, top) };
}

// ------------------------------------------------------------------ run

const port = 6000 + Math.floor(Math.random() * 600);
const server = await createServer({
  root,
  logLevel: 'error',
  server: { port, host: '127.0.0.1', strictPort: false, hmr: false },
  clearScreen: false,
});
await server.listen();
const base = server.resolvedUrls.local[0];

const browser = await chromium.launch({
  executablePath: chromePath(),
  args: [
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
    '--autoplay-policy=no-user-gesture-required',
    '--enable-precise-memory-info',
    '--js-flags=--expose-gc',
    // keep RAF and timers running at full rate in a background/headless page
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows',
  ],
});

const report = { started: new Date().toISOString(), opts: { GAMES, SEED0, SPEED, SLOW_EVERY, TITLE_EVERY, INTRO, STEPPED, REPEAT }, boot: null, games: [], console: [] };
let failed = false;

try {
  const page = await browser.newPage({ viewport: { width: 640 * scale, height: 360 * scale }, deviceScaleFactor: 1 });
  page.setDefaultTimeout(180000);
  page.setDefaultNavigationTimeout(180000);
  const consoleLines = [];
  page.on('console', (m) => {
    const t = m.text();
    if (m.type() === 'error' || m.type() === 'warning') {
      const line = `[console.${m.type()}] ${t}`;
      consoleLines.push(line);
      if (!QUIET) console.log('   ', line.slice(0, 400));
    } else if (m.type() === 'log' && !t.startsWith('%c') && t.startsWith('[soak')) console.log('   ', t);
  });
  const pageErrors = [];
  page.on('pageerror', (e) => {
    pageErrors.push(`${e.message}\n${e.stack ?? ''}`);
    console.log('    [pageerror]', e.message);
  });
  page.on('crash', () => {
    pageErrors.push('PAGE CRASHED');
    console.log('    [crash] the page crashed');
  });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');

  // ---- boot (first game is loaded from the URL)
  // long tasks during load = the frames the boot blocks
  await page.addInitScript(() => {
    window.__longtasks = [];
    try {
      new PerformanceObserver((l) => {
        for (const e of l.getEntries()) window.__longtasks.push({ start: Math.round(e.startTime), ms: Math.round(e.duration) });
      }).observe({ type: 'longtask', buffered: true });
    } catch {}
    window.__firstRaf = 0;
    let n = 0;
    const raf = (t) => {
      n++;
      window.__rafTimes = window.__rafTimes || [];
      if (window.__rafTimes.length < 600) window.__rafTimes.push(Math.round(t));
      requestAnimationFrame(raf);
    };
    requestAnimationFrame(raf);
  });

  const intro0 = INTRO === '1' || INTRO === 'alt';
  const q0 = `?mode=demo&seed=${SEED0}&speed=${SLOW_EVERY > 0 && SLOW_EVERY === 1 ? 1 : SPEED}${intro0 ? '' : '&skipIntro=1'}${STEPPED ? '&test=1' : ''}`;
  if (BOOT_PROFILE) {
    await cdp.send('Profiler.enable');
    await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
    await cdp.send('Profiler.start');
  }
  const tNav = Date.now();
  await page.goto(base + q0, { waitUntil: 'load' });
  const tLoad = Date.now();
  await page.waitForFunction(() => window.__neon && window.__neon.game && window.__neon.game.scene.isActive('Duel'), null, { timeout: 180000 });
  const tDuel = Date.now();
  if (STEPPED) {
    // stepped runs start frozen right away (the opening is stepped too)
    await page.evaluate(() => window.__neon.freeze());
  } else {
    await page.waitForFunction(() => window.__neon.ready === true, null, { timeout: 180000 });
  }
  const tReady = Date.now();
  let bootProfile = null;
  if (BOOT_PROFILE) {
    const { profile } = await cdp.send('Profiler.stop');
    bootProfile = summarizeProfile(profile, 40);
  }
  const bootPage = await page.evaluate(() => ({
    nav: performance.getEntriesByType('navigation')[0]?.toJSON?.() ?? null,
    longtasks: window.__longtasks,
    raf: (window.__rafTimes || []).slice(0, 120),
    textures: Object.keys(window.__neon.game.textures.list).length,
  }));
  const nav = bootPage.nav;
  const gaps = [];
  for (let i = 1; i < bootPage.raf.length; i++) gaps.push(bootPage.raf[i] - bootPage.raf[i - 1]);
  report.boot = {
    wallLoadMs: tLoad - tNav,
    wallDuelActiveMs: tDuel - tNav,
    wallReadyMs: tReady - tNav,
    domContentLoaded: nav ? Math.round(nav.domContentLoadedEventEnd) : -1,
    loadEvent: nav ? Math.round(nav.loadEventEnd) : -1,
    longtasks: bootPage.longtasks,
    longestTask: Math.max(0, ...bootPage.longtasks.map((t) => t.ms)),
    rafGapMax: gaps.length ? Math.max(...gaps) : -1,
    textures: bootPage.textures,
    profile: bootProfile,
  };
  log(`boot: load ${report.boot.wallLoadMs} ms, duel scene active ${report.boot.wallDuelActiveMs} ms, ready ${report.boot.wallReadyMs} ms; longest task ${report.boot.longestTask} ms; tasks>50ms: ${bootPage.longtasks.map((t) => `${t.ms}@${t.start}`).join(' ')}`);
  if (bootProfile) printProfile('boot CPU profile', bootProfile);

  const inst = await page.evaluate(INSTRUMENT(args.detail === 'true'));
  log('instrumentation', inst);

  // ---------------------------------------------------------------- games
  const stepFrames = async (ms) => {
    // stepped mode: advance the frozen game in 1/60 s frames (the test clock yields between frames)
    await page.evaluate((m) => window.__neon.step(m), ms);
  };
  const waitUntil = async (fn, arg, timeoutMs, label) => {
    const t = Date.now();
    for (;;) {
      const ok = await page.evaluate(fn, arg).catch(() => false);
      if (ok) return true;
      if (Date.now() - t > timeoutMs) {
        log(`timeout waiting for ${label}`);
        return false;
      }
      if (STEPPED) await stepFrames(500);
      else await page.waitForTimeout(250);
    }
  };

  for (let g = 0; g < GAMES; g++) {
    const seed = REPEAT ? SEED0 : SEED0 + g;
    const slow = SLOW_EVERY > 0 && g % SLOW_EVERY === SLOW_EVERY - 1;
    const speed = slow ? 1 : SPEED;
    const viaTitle = g > 0 && TITLE_EVERY > 0 && (TITLE_EVERY === 1 || g % TITLE_EVERY === 1);
    const intro = INTRO === '1' ? true : INTRO === '0' ? false : g % 2 === 0;
    const rec = { game: g, seed, speed, viaTitle, intro, start: null, winner: null, reason: null, turns: 0, wallMs: 0, lp: null, errors: null, pageErrors: [], consoleErrors: [], timedOut: false };
    const tg = Date.now();

    if (g > 0) {
      if (viaTitle) {
        // Duel → Title (as the "Ana Menü" button) → wait on the menu → a new duel from the title
        await page.evaluate(() => {
          const s = window.__neon.game.scene.getScene('Duel');
          s.controller?.stop();
          s.director?.dropKept();
          s.scene.start('Title', { from: 'duel' });
        });
        await waitUntil(() => window.__neon.game.scene.isActive('Title') && !window.__neon.game.scene.isActive('Duel'), null, 60000, 'title');
        if (STEPPED) await stepFrames(4000);
        else await page.waitForTimeout(4000);
        rec.titleSample = await page.evaluate(() => window.__soak.sample('title', true));
        await page.evaluate(({ seed, speed, intro }) => {
          window.__neon.ready = false;
          window.__soak.begin(-1);
          const t = window.__neon.game.scene.getScene('Title');
          t.scene.start('Duel', { mode: 'demo', seed, speed, skipIntro: !intro });
        }, { seed, speed, intro });
        await waitUntil(() => window.__neon.game.scene.isActive('Duel') && window.__neon.ready === true && !!window.__neon.duel, null, 180000, 'duel from title');
      } else {
        // "Tekrar Oyna": DuelScene.restartDuel through the QA hook
        await page.evaluate(({ seed, speed, intro }) => {
          window.__neon.ready = false;
          void window.__neon.duel.restart({ mode: 'demo', seed, speed, skipIntro: !intro });
        }, { seed, speed, intro });
        await waitUntil(() => window.__neon.ready === true && window.__neon.game.scene.isActive('Duel'), null, 180000, 'restart');
      }
    }
    await page.evaluate((no) => window.__soak.begin(no), g);
    rec.start = await page.evaluate(() => window.__soak.sample('start', true));
    if (SNAP && (g === 1 || g === GAMES - 1)) {
      const c = await heapCensus(cdp);
      log(`heap snapshot at the start of game ${g}: ${(c.total / 1048576).toFixed(1)} MB in JS objects`);
      if (g === 1) snapA = c;
      else if (snapA) {
        report.heapDiff = censusDiff(snapA, c, 40);
        console.log(`\n=== heap growth, start of game 1 → start of game ${g}: ${report.heapDiff.totalKb} KB`);
        for (const r of report.heapDiff.rows) console.log(`  ${String(r.kb).padStart(7)} KB ${String(r.count).padStart(7)}  ${r.name}`);
      }
    }
    const nErr0 = pageErrors.length;
    const nCon0 = consoleLines.length;
    if (PROFILE_GAME === g) {
      await cdp.send('Profiler.enable');
      await cdp.send('Profiler.setSamplingInterval', { interval: 500 });
      await cdp.send('Profiler.start');
    }
    log(`game ${g}: seed ${seed} speed ${speed}${viaTitle ? ' (via title)' : ''}${intro ? ' (opening)' : ' (skipIntro)'}; start objects ${rec.start.duel?.objects} heap ${rec.start.heapMB} MB`);

    // play to the end
    let lastTurn = -1;
    let lastProgress = Date.now();
    let lastSig = '';
    for (;;) {
      const st = await page.evaluate(() => window.__soak.status()).catch((e) => ({ err: String(e) }));
      if (st.err) {
        log('status failed', st.err);
        break;
      }
      if (st.winner !== null && st.winner !== undefined) {
        rec.winner = st.winner;
        rec.reason = st.reason;
        rec.turns = st.turn;
        rec.lp = st.lp;
        break;
      }
      const sig = `${st.turn}|${st.lp}|${st.busy}`;
      if (sig !== lastSig) {
        lastSig = sig;
        lastProgress = Date.now();
      }
      if (st.turn !== lastTurn) {
        lastTurn = st.turn;
        if (!QUIET && st.turn % 4 === 0) log(`  game ${g} turn ${st.turn} lp ${st.lp}`);
      }
      if (Date.now() - tg > GAME_TIMEOUT) {
        log(`  game ${g} TIMED OUT after ${GAME_TIMEOUT} ms (turn ${st.turn})`);
        rec.timedOut = true;
        failed = true;
        break;
      }
      if (Date.now() - lastProgress > 120000) {
        log(`  game ${g} STALLED (no state change for 120 s; turn ${st.turn}, busy ${st.busy})`);
        rec.stalled = true;
        failed = true;
        break;
      }
      if (STEPPED) await stepFrames(1000);
      else await page.waitForTimeout(500);
    }
    rec.wallMs = Date.now() - tg;
    // let the game-over cinematic finish (the prompt waits for a choice)
    await waitUntil(() => !window.__neon.duel.busy(), null, 60000, 'game over cinematic');
    if (STEPPED) await stepFrames(3000);
    else await page.waitForTimeout(3000);
    rec.end = await page.evaluate(() => window.__soak.sample('end', true));
    const took = await page.evaluate(() => window.__soak.take());
    rec.frames = took.frames;
    rec.samples = took.samples;
    rec.evTimes = took.evTimes;
    rec.neonErrors = took.pageErrors;
    rec.errors = await page.evaluate(() => window.__soak.errors());
    rec.pageErrors = pageErrors.slice(nErr0);
    rec.consoleErrors = consoleLines.slice(nCon0).filter((l) => l.startsWith('[console.error]'));
    rec.consoleWarnings = consoleLines.slice(nCon0).filter((l) => l.startsWith('[console.warning]')).length;
    const metrics = await cdp.send('Performance.getMetrics');
    rec.cdp = Object.fromEntries(metrics.metrics.filter((m) => ['JSHeapUsedSize', 'JSHeapTotalSize', 'Nodes', 'JSEventListeners', 'Documents', 'Frames', 'LayoutCount'].includes(m.name)).map((m) => [m.name, m.name.startsWith('JSHeap') ? +(m.value / 1048576).toFixed(1) : m.value]));
    if (PROFILE_GAME === g) {
      const { profile } = await cdp.send('Profiler.stop');
      rec.profile = summarizeProfile(profile, 40);
      printProfile(`game ${g} CPU profile`, rec.profile);
    }
    await page.screenshot({ path: path.join(path.dirname(out), `game-${g}-end.png`) }).catch(() => undefined);
    const nErr = (rec.errors?.handlers?.length ?? 0) + (rec.errors?.timeouts?.length ?? 0) + rec.pageErrors.length + rec.neonErrors.length;
    if (nErr) failed = true;
    const turnSamples = rec.samples.filter((s) => s.tag === 'turn');
    const objs = turnSamples.map((s) => s.duel?.objects ?? 0);
    log(
      `game ${g} done: winner P${rec.winner === null ? '?' : rec.winner + 1} (${rec.reason}) turn ${rec.turns}, ${(rec.wallMs / 1000).toFixed(0)} s; ` +
        `frames ${rec.frames.n} avg ${rec.frames.avg} ms (upd ${rec.frames.avgUpd} / rend ${rec.frames.avgRend}) max ${rec.frames.max}, >50ms ${rec.frames.over50}, >100ms ${rec.frames.over100}; ` +
        `objects/turn ${objs.length ? `${Math.min(...objs)}..${Math.max(...objs)}` : '-'} end ${rec.end.duel?.objects}; tweens end ${rec.end.duel?.tweens} timers ${rec.end.duel?.timers}; ` +
        `tex ${rec.end.tex.textures} (${rec.end.tex.texMB} MB, gl ${rec.end.tex.glTextures}); heap ${rec.start.heapMB}→${rec.end.heapMB} MB; ` +
        `errors: handlers ${rec.errors?.handlers?.length ?? '?'} timeouts ${rec.errors?.timeouts?.length ?? '?'} page ${rec.pageErrors.length + rec.neonErrors.length} console.error ${rec.consoleErrors.length}`,
    );
    for (const h of rec.errors?.handlers ?? []) log('   handler error:', JSON.stringify(h).slice(0, 600));
    for (const h of rec.errors?.timeouts ?? []) log('   watchdog:', h);
    report.games.push(rec);
    fs.writeFileSync(out, JSON.stringify(report, null, 1));
  }
  report.console = consoleLines;
} catch (e) {
  failed = true;
  console.error('[soak] failed', e);
} finally {
  report.finished = new Date().toISOString();
  fs.writeFileSync(out, JSON.stringify(report, null, 1));
  await browser.close();
  await server.close();
}

// ------------------------------------------------------------------ summary
const G = report.games;
if (G.length) {
  console.log('\n=== soak summary');
  console.log(' #  seed spd  T  intro  winner turns  wall_s  frames  avg_ms upd  rend  max_ms >50 >100 | st_obj end_obj tw tm  emit evL | tex  texMB gl  | heap_s heap_e | err');
  for (const r of G) {
    const s = r.start?.duel ?? {};
    const e = r.end?.duel ?? {};
    const errs = (r.errors?.handlers?.length ?? 0) + (r.errors?.timeouts?.length ?? 0) + r.pageErrors.length + (r.neonErrors?.length ?? 0);
    console.log(
      [
        String(r.game).padStart(2),
        String(r.seed).padStart(5),
        String(r.speed).padStart(3),
        r.viaTitle ? ' T' : '  ',
        r.intro ? '  yes' : '   no',
        `   P${r.winner === null ? '?' : r.winner + 1}`.padEnd(7),
        String(r.turns).padStart(5),
        String(Math.round(r.wallMs / 1000)).padStart(7),
        String(r.frames?.n ?? 0).padStart(7),
        String(r.frames?.avg ?? 0).padStart(7),
        String(r.frames?.avgUpd ?? 0).padStart(4),
        String(r.frames?.avgRend ?? 0).padStart(5),
        String(r.frames?.max ?? 0).padStart(7),
        String(r.frames?.over50 ?? 0).padStart(4),
        String(r.frames?.over100 ?? 0).padStart(4),
        '|',
        String(s.objects ?? '-').padStart(6),
        String(e.objects ?? '-').padStart(7),
        String(e.tweens ?? '-').padStart(3),
        String(e.timers ?? '-').padStart(3),
        String(e.emitters ?? '-').padStart(4),
        String(e.events ?? '-').padStart(4),
        '|',
        String(r.end?.tex?.textures ?? '-').padStart(4),
        String(r.end?.tex?.texMB ?? '-').padStart(6),
        String(r.end?.tex?.glTextures ?? '-').padStart(4),
        '|',
        String(r.start?.heapMB ?? '-').padStart(6),
        String(r.end?.heapMB ?? '-').padStart(6),
        '|',
        String(errs),
      ].join(' '),
    );
  }
  const allErr = G.reduce((a, r) => a + (r.errors?.handlers?.length ?? 0) + (r.errors?.timeouts?.length ?? 0) + r.pageErrors.length + (r.neonErrors?.length ?? 0), 0);
  console.log(`\n${G.length} games, ${allErr} errors, ${G.filter((r) => r.timedOut || r.stalled).length} timed out/stalled. Report: ${path.relative(root, out)}`);
}
process.exit(failed ? 1 : 0);
