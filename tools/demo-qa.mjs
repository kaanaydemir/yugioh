#!/usr/bin/env node
// Arena v2 demo QA driver for Neon Düello (headless Chromium + Vite dev server).
//
//   node tools/demo-qa.mjs scan  [--from 1] [--to 60]
//        Simulate CPU-vs-CPU demo games in Node (the same engine + bot + seeds as ?mode=demo) and
//        list per seed: turns, winner, summons, attacks, spells, traps and when Volkan Arenası
//        (the field spell) lands. Use it to pick seeds that show the key moments.
//
//   node tools/demo-qa.mjs games [--plan "demo:3:1,arena:5:3,..."] [--parallel 2] [--out shots/demo-qa/games]
//                               [--game-timeout MS] [--stall MS] [--scale 2] [--turns N] [--profile]
//        Plays unattended v2 demo games to gameOver in REAL time, one fresh page per game.
//        Plan entries are "<entry>:<seed>:<speed>[:skip]":
//          entry demo  → demo.html?mode=demo&seed=S&speed=K           (window.__NEON_ARENA = 'v2')
//          entry arena → index.html?mode=demo&seed=S&speed=K&arena=v2 (URL param)
//          entry v1    → index.html?mode=demo&seed=S&speed=K          (the default arena, for comparison)
//          entry v3z5x → v3 look + zones=5 + deck=expanded (new monsters on the 5-lane board)
//          ":skip" adds &skipIntro=1 (default: the opening cinematic plays).
//        Records __neon.duel.errors() (handler errors + watchdog timeouts), __neon.errors, page
//        errors, console errors/warnings, stalls, the event timeline, fps; screenshots the key
//        moments (opening, summons, tributes, attacks, spells/traps, Volkan Arenası, destroys,
//        damage, game over) into <out>/<game>/NN-<moment>.png plus contact sheets, and writes
//        <out>/report.json. Exit code 1 on any error / timeout / stall.
//
//   node tools/demo-qa.mjs play  [--seed 4] [--out shots/demo-qa/play] [--arena v2]
//        Real-mouse hot-seat playtest (curtain off): every pointer action is page.mouse on the
//        canvas. Hover → inspect, summon into each monster zone (both players), set into each
//        spell/trap zone, attack, end turn, zoneAt hit-test sweep over the whole board (centres,
//        corners, edges of every tile against board.zoneAt and HumanInput.pick), HUD overlap
//        checks (UI rects vs zones, menus inside the screen). Prints PASS/FAIL lines + findings.
//
//   node tools/demo-qa.mjs flow  [--page demo.html] [--out shots/demo-qa/flow]
//        The demo page end to end by real clicks: title → İzle (Demo) → Esc → Ana Menüye Dön →
//        2 Oyuncu → pass-device curtain → Esc → Teslim Ol → game over → TEKRAR OYNA.
//
//   node tools/demo-qa.mjs v1 --base <worktree> [--base <worktree2>] [--out shots/demo-qa/v1]
//        v1-unchanged check: renders the same deterministic shots (?dev=board, a stepped demo
//        frame, the title) with tools/shot.mjs in THIS tree and in each baseline worktree
//        (e.g. `git worktree add <scratch>/qa-base HEAD`; give it its own node_modules dir of
//        per-package symlinks so its Vite dep cache does not clobber this tree's), then pixel-
//        diffs them (diff PNGs: changed pixels in magenta). Also renders each shot twice in this
//        tree to measure run-to-run noise.

import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
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
      if (o[k] !== undefined) o[k] = [].concat(o[k], v);
      else o[k] = v;
    } else o._.push(a);
  }
  return o;
}

const args = parseArgs(process.argv.slice(2));
const cmd = args._[0] ?? 'help';
const T0 = Date.now();
const log = (...a) => console.log(`[qa ${String(((Date.now() - T0) / 1000).toFixed(0)).padStart(5)}s]`, ...a);

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

async function startServer(dir = root) {
  const port = 6600 + Math.floor(Math.random() * 600);
  const server = await createServer({
    root: dir,
    logLevel: 'error',
    server: { port, host: '127.0.0.1', strictPort: false, hmr: false },
    clearScreen: false,
  });
  await server.listen();
  return { server, base: server.resolvedUrls.local[0] };
}

async function launch() {
  return chromium.launch({
    executablePath: chromePath(),
    args: [
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--ignore-gpu-blocklist',
      '--autoplay-policy=no-user-gesture-required',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows',
    ],
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ====================================================================================== scan

async function cmdScan() {
  const from = Number(args.from ?? 1);
  const to = Number(args.to ?? 40);
  const { server } = await startServer();
  try {
    const E = await server.ssrLoadModule('/src/engine/index.ts');
    const rows = [];
    for (let seed = from; seed <= to; seed++) {
      const r = E.newGame({ seed });
      let state = r.state;
      let cpu = (seed ^ 0x5bd1e995) >>> 0;
      const c = { seed, turns: 0, winner: null, reason: '', summons: 0, tributes: 0, sets: 0, attacks: 0, direct: 0, spells: [], traps: [], volcanoTurn: null, destroys: 0, actions: 0 };
      for (let i = 0; i < 4000 && state.winner === null; i++) {
        const a = E.chooseAction(state, cpu++);
        const res = E.apply(state, a);
        state = res.state;
        c.actions++;
        for (const ev of res.events) {
          if (ev.type === 'summon') c.summons++;
          else if (ev.type === 'tribute') c.tributes++;
          else if (ev.type === 'setMonster' || ev.type === 'setSpellTrap') c.sets++;
          else if (ev.type === 'attackDeclare') {
            c.attacks++;
            if (ev.targetUid === null) c.direct++;
          } else if (ev.type === 'activate' && ev.kind === 'spell') c.spells.push(ev.cardId);
          else if (ev.type === 'activate' && ev.kind === 'trap') c.traps.push(ev.cardId);
          else if (ev.type === 'fieldSpell' && ev.active && c.volcanoTurn === null) c.volcanoTurn = state.turn;
          else if (ev.type === 'destroy') c.destroys++;
        }
      }
      c.turns = state.turn;
      c.winner = state.winner;
      c.reason = state.winReason;
      rows.push(c);
    }
    console.log('seed turns win  reason      summ trib sets atk dir destr volcano  spells / traps');
    for (const c of rows) {
      console.log(
        `${String(c.seed).padStart(4)} ${String(c.turns).padStart(5)}  P${c.winner === null ? '?' : c.winner + 1}  ${String(c.reason).padEnd(10)} ${String(c.summons).padStart(4)} ${String(c.tributes).padStart(4)} ${String(c.sets).padStart(4)} ${String(c.attacks).padStart(3)} ${String(c.direct).padStart(3)} ${String(c.destroys).padStart(5)} ${String(c.volcanoTurn ?? '-').padStart(7)}  ${c.spells.join(',')} / ${c.traps.join(',')}`,
      );
    }
  } finally {
    await server.close();
  }
}

// ====================================================================================== games

// Page-side hook: once the duel exists, observe every cinematic event and pass it to Node.
const OBSERVE = `(() => {
  if (window.__qaObs) return;
  window.__qaObs = { frames: 0, t0: performance.now() };
  const raf = () => { window.__qaObs.frames++; requestAnimationFrame(raf); };
  requestAnimationFrame(raf);
  const iv = setInterval(() => {
    if (!window.__neon || !window.__neon.game) return;
    clearInterval(iv);
    // JS time per frame (Game.step: update + render command submission), as tools/soak.mjs does
    const O = window.__qaObs;
    O.js = { n: 0, sum: 0, max: 0, over50: 0 };
    const loop = window.__neon.game.loop;
    const orig = loop.callback;
    loop.callback = function (time, delta) {
      const t0 = performance.now();
      orig.call(this, time, delta);
      const dt = performance.now() - t0;
      O.js.n++; O.js.sum += dt; if (dt > O.js.max) O.js.max = dt; if (dt > 50) O.js.over50++;
    };
    import('/src/cinematics/_core/registry.ts').then((m) => {
      m.registerObserver((ev) => {
        let turn = -1, lp = null;
        try { const s = window.__neon.duel.state(); turn = s.turn; lp = [s.players[0].lp, s.players[1].lp]; } catch {}
        const d = {};
        for (const k of ['player', 'owner', 'winner', 'reason', 'cardId', 'kind', 'method', 'from', 'zone', 'targetZone', 'attackerZone', 'amount', 'active', 'source', 'result', 'phase', 'turn', 'location', 'cause'])
          if (ev[k] !== undefined) d[k] = ev[k];
        try { window.__qaMoment({ type: ev.type, t: Math.round(performance.now()), turn, lp, d }); } catch {}
      });
    }).catch((e) => console.error('[qa] observer import failed', e));
  }, 50);
})()`;

// Which moments get screenshots: max per game and capture delays (ms of real time at speed 1).
const MOMENTS = {
  summon: { max: 6, at: [700, 1700] },
  tribute: { max: 2, at: [350] },
  setMonster: { max: 1, at: [500] },
  setSpellTrap: { max: 1, at: [500] },
  flip: { max: 2, at: [500] },
  attackDeclare: { max: 6, at: [350, 1100] },
  battle: { max: 4, at: [250] },
  activate: { max: 5, at: [450, 1500] },
  fieldSpell: { max: 2, at: [300, 1400, 3500, 7000] },
  equip: { max: 1, at: [600] },
  destroy: { max: 4, at: [180] },
  damage: { max: 4, at: [250] },
  lpGain: { max: 1, at: [400] },
  attackNegated: { max: 2, at: [300] },
  gameStart: { max: 1, at: [300, 1500, 3000, 5000, 7500, 10500] },
  turnStart: { max: 3, at: [300] },
  deckOut: { max: 1, at: [600] },
  gameOver: { max: 1, at: [1200, 3500, 7000] },
};

function planList() {
  const p = String(args.plan ?? 'demo:3:3,arena:5:1,demo:7:1,arena:2:3');
  return p.split(',').map((s) => {
    const [entry, seed, speed, flag] = s.trim().split(':');
    return { entry, seed: Number(seed), speed: Number(speed ?? 3), intro: flag !== 'skip' };
  });
}

function gameUrl(base, g) {
  const q = `mode=demo&seed=${g.seed}&speed=${g.speed}${g.intro ? '' : '&skipIntro=1'}`;
  if (g.entry === 'demo') return `${base}demo.html?${q}`;
  if (g.entry === 'arena') return `${base}?${q}&arena=v2`;
  if (g.entry === 'v1') return `${base}?${q}`;
  if (g.entry === 'v3') return `${base}?${q}&look=v3`;
  if (g.entry === 'v3z5') return `${base}?${q}&look=v3&zones=5`; // v3 look + the 5+5 board // the v3 look (A2/A3 acceptance demo games)
  if (g.entry === 'v3z5x') return `${base}?${q}&look=v3&zones=5&deck=expanded`; // 5+5 board + the expanded card pool (seeded 20-card decks)
  throw new Error(`unknown entry ${g.entry}`);
}

async function contactSheet(browser, files, out, cols = 2, w = 640) {
  if (!files.length) return;
  const page = await browser.newPage({ viewport: { width: 400, height: 300 }, deviceScaleFactor: 1 });
  const imgs = files.map((f) => ({ name: path.basename(f), b64: fs.readFileSync(f).toString('base64') }));
  await page.setContent(`<html><body style="margin:0;background:#000;font:12px monospace;color:#9ef">
    <div style="display:grid;grid-template-columns:repeat(${cols}, ${w}px);gap:4px;padding:4px">
    ${imgs.map((f) => `<div><div style="padding:1px 2px">${f.name}</div><img style="display:block;width:${w}px;image-rendering:pixelated" src="data:image/png;base64,${f.b64}"></div>`).join('')}
    </div></body></html>`);
  await page.waitForTimeout(100);
  await page.screenshot({ path: out, fullPage: true });
  await page.close();
}

async function playGame(browser, base, g, idx, outDir) {
  const scale = Number(args.scale ?? 2);
  const name = `g${idx}-${g.entry}-s${g.seed}x${g.speed}${g.intro ? '' : '-skip'}`;
  const dir = path.join(outDir, name);
  fs.mkdirSync(dir, { recursive: true });
  for (const f of fs.readdirSync(dir)) if (f.endsWith('.png')) fs.unlinkSync(path.join(dir, f));
  const rec = {
    name, ...g, url: '', winner: null, reason: null, turns: 0, lp: null, wallMs: 0, bootMs: 0, fps: 0,
    duelErrors: null, neonErrors: [], pageErrors: [], consoleErrors: [], consoleWarnings: [],
    timedOut: false, stalled: false, events: {}, timeline: [], shots: [], notes: [],
  };
  const ctx = await browser.newContext({ viewport: { width: 640 * scale, height: 360 * scale }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.setDefaultTimeout(180000);
  page.setDefaultNavigationTimeout(180000);
  page.on('console', (m) => {
    const t = m.text();
    if (m.type() === 'error') rec.consoleErrors.push(t.slice(0, 1200));
    else if (m.type() === 'warning') rec.consoleWarnings.push(t.slice(0, 400));
  });
  page.on('pageerror', (e) => rec.pageErrors.push(`${e.message}\n${(e.stack ?? '').slice(0, 1500)}`));
  page.on('crash', () => rec.pageErrors.push('PAGE CRASHED'));

  // ---- screenshots: one at a time, named by order + moment
  const counts = {};
  let shotNo = 0;
  let chain = Promise.resolve();
  let closed = false;
  const k = g.speed >= 3 ? 0.5 : g.speed >= 2 ? 0.7 : 1;
  const shoot = (label, delayMs) => {
    const due = Date.now() + delayMs;
    chain = chain.then(async () => {
      const w = due - Date.now();
      if (w > 0) await sleep(w);
      if (closed) return;
      const file = path.join(dir, `${String(++shotNo).padStart(2, '0')}-${label}.png`);
      try {
        const box = await page.locator('canvas').first().boundingBox();
        await page.screenshot({ path: file, clip: box ?? undefined, timeout: 30000 });
        rec.shots.push(path.relative(root, file));
      } catch (e) {
        rec.notes.push(`shot ${label} failed: ${String(e).slice(0, 200)}`);
      }
    });
  };
  const tStart = Date.now();
  await page.exposeBinding('__qaMoment', (_src, m) => {
    m.wall = Date.now() - tStart;
    rec.timeline.push(m);
    rec.events[m.type] = (rec.events[m.type] ?? 0) + 1;
    const spec = MOMENTS[m.type];
    if (!spec) return;
    counts[m.type] = (counts[m.type] ?? 0) + 1;
    if (counts[m.type] > spec.max) return;
    if (m.type === 'activate' && m.d.kind === 'monsterEffect' && counts[m.type] > 3) return;
    const who = m.d.player ?? m.d.owner ?? m.d.winner;
    const tag = [m.type === 'gameStart' ? 'opening' : m.type, m.d.cardId, m.d.kind === 'trap' ? 'trap' : '', who !== undefined ? `p${who + 1}` : '', `t${m.turn}`].filter(Boolean).join('-');
    // the opening is long whatever the speed: its shots are not scaled
    const kk = m.type === 'gameStart' ? 1 : k;
    spec.at.forEach((ms, i) => shoot(`${tag}${spec.at.length > 1 ? `-${String.fromCharCode(97 + i)}` : ''}`, Math.round(ms * kk)));
  });
  await page.addInitScript(OBSERVE);

  rec.url = gameUrl(base, g);
  log(`${name}: ${rec.url.replace(base, '/')}`);
  await page.goto(rec.url, { waitUntil: 'load' });
  // the arena variant actually in use (layout.ts decides it once at init)
  await page.waitForFunction(() => window.__neon && window.__neon.game && window.__neon.game.scene.isActive('Duel'), null, { timeout: 180000 });
  rec.bootMs = Date.now() - tStart;
  rec.arena = await page.evaluate(() => import('/src/view/layout.ts').then((m) => m.ARENA_VARIANT)).catch((e) => `?${e}`);
  // --profile: sample a V8 CPU profile of the whole game (after boot) and summarize it by file / function
  let cdp = null;
  if (args.profile === 'true') {
    cdp = await ctx.newCDPSession(page);
    await cdp.send('Profiler.enable');
    await cdp.send('Profiler.setSamplingInterval', { interval: 500 });
    await cdp.send('Profiler.start');
  }

  const gameTimeout = Number(args['game-timeout'] ?? 50 * 60 * 1000);
  const stallMs = Number(args.stall ?? 240000);
  // --turns N: stop once turn N is over (a smoke run instead of a full game)
  const maxTurns = Number(args.turns ?? 0);
  let lastSig = '';
  let lastProgress = Date.now();
  let lastTurnLogged = -1;
  for (;;) {
    const st = await page
      .evaluate(() => {
        const D = window.__neon.duel;
        if (!D) return { none: true };
        const s = D.state();
        return { turn: s.turn, phase: s.phase, winner: s.winner, reason: s.winReason, lp: [s.players[0].lp, s.players[1].lp], busy: D.busy(), n: window.__qaObs ? window.__qaObs.frames : 0 };
      })
      .catch((e) => ({ err: String(e) }));
    if (st.err) {
      rec.notes.push(`status failed: ${st.err.slice(0, 300)}`);
      break;
    }
    if (!st.none) {
      if (st.winner !== null && st.winner !== undefined) {
        Object.assign(rec, { winner: st.winner, reason: st.reason, turns: st.turn, lp: st.lp });
        break;
      }
      if (maxTurns && st.turn > maxTurns) {
        Object.assign(rec, { winner: null, reason: `stopped after ${maxTurns} turns`, turns: st.turn, lp: st.lp, stoppedEarly: true });
        break;
      }
      const sig = `${st.turn}|${st.phase}|${st.lp}|${st.busy}|${rec.timeline.length}`;
      if (sig !== lastSig) {
        lastSig = sig;
        lastProgress = Date.now();
      }
      if (st.turn !== lastTurnLogged && st.turn % 3 === 0) {
        lastTurnLogged = st.turn;
        log(`  ${name} turn ${st.turn} lp ${st.lp} (${((Date.now() - tStart) / 1000).toFixed(0)} s)`);
      }
      if (Date.now() - lastProgress > stallMs) {
        rec.stalled = true;
        rec.notes.push(`stalled: no state/event change for ${stallMs} ms at turn ${st.turn} phase ${st.phase} busy ${st.busy}`);
        shoot('STALL', 0);
        break;
      }
    }
    if (Date.now() - tStart > gameTimeout) {
      rec.timedOut = true;
      shoot('TIMEOUT', 0);
      break;
    }
    await sleep(500);
  }
  rec.wallMs = Date.now() - tStart;
  // let the game-over cinematic play out (its shots are already queued), then the final frame
  if (!rec.stoppedEarly) {
    await page.waitForFunction(() => !window.__neon.duel.busy(), null, { timeout: 90000 }).catch(() => rec.notes.push('busy after gameOver for 90 s'));
    await sleep(Math.round(7500 * k));
  }
  shoot('final', 0);
  await chain;
  const fin = await page.evaluate(() => ({
    duel: window.__neon.duel ? window.__neon.duel.errors() : null,
    neon: [...(window.__neon.errors ?? [])],
    frames: window.__qaObs ? window.__qaObs.frames : 0,
    js: window.__qaObs && window.__qaObs.js ? { n: window.__qaObs.js.n, avg: +(window.__qaObs.js.sum / Math.max(1, window.__qaObs.js.n)).toFixed(2), max: +window.__qaObs.js.max.toFixed(1), over50: window.__qaObs.js.over50 } : null,
    t: window.__qaObs ? performance.now() - window.__qaObs.t0 : 1,
    promptUp: (() => {
      const sc = window.__neon.game.scene.getScene('Duel');
      const out = [];
      const walk = (l) => { for (const o of l) { if (o.labelText && o.visible && o.active) out.push(o.labelText); if (o.list) walk(o.list); } };
      if (sc) walk(sc.children.list);
      return out;
    })(),
  })).catch((e) => ({ err: String(e) }));
  closed = true;
  if (cdp) {
    const { profile } = await cdp.send('Profiler.stop');
    rec.profile = summarizeProfile(profile);
    log(`${name} CPU profile (${rec.profile.totalMs} ms sampled) by file:`);
    for (const f of rec.profile.files) log(`   ${String(f.ms).padStart(7)} ms ${String(f.pct).padStart(5)}%  ${f.file}`);
    log(`${name} top functions (self time):`);
    for (const f of rec.profile.functions) log(`   ${String(f.ms).padStart(7)} ms ${String(f.pct).padStart(5)}%  ${f.fn}`);
  }
  rec.duelErrors = fin.duel ?? null;
  rec.neonErrors = fin.neon ?? [];
  rec.fps = fin.frames ? +((fin.frames * 1000) / fin.t).toFixed(1) : 0;
  rec.buttonsAtEnd = fin.promptUp;
  rec.jsFrame = fin.js;
  await ctx.close();
  // contact sheets of every moment (8 per sheet)
  const pngs = fs.readdirSync(dir).filter((f) => /^\d\d-.*\.png$/.test(f)).sort().map((f) => path.join(dir, f));
  for (let i = 0; i < pngs.length; i += 8) await contactSheet(browser, pngs.slice(i, i + 8), path.join(outDir, `${name}-sheet${Math.floor(i / 8) + 1}.png`));
  const nErr = (rec.duelErrors?.handlers?.length ?? 0) + (rec.duelErrors?.timeouts?.length ?? 0) + rec.neonErrors.length + rec.pageErrors.length;
  rec.ok = !nErr && !rec.timedOut && !rec.stalled && (rec.winner !== null || !!rec.stoppedEarly);
  log(
    `${name} done: arena ${rec.arena}, winner P${rec.winner === null ? '?' : rec.winner + 1} (${rec.reason}) turn ${rec.turns} lp ${rec.lp}, ` +
      `${(rec.wallMs / 1000).toFixed(0)} s, boot ${(rec.bootMs / 1000).toFixed(1)} s, ${rec.fps} fps, JS/frame ${rec.jsFrame ? `avg ${rec.jsFrame.avg} ms max ${rec.jsFrame.max} ms >50ms ${rec.jsFrame.over50}/${rec.jsFrame.n}` : '?'}; ` +
      `errors: handlers ${rec.duelErrors?.handlers?.length ?? '?'} watchdog ${rec.duelErrors?.timeouts?.length ?? '?'} page ${rec.pageErrors.length + rec.neonErrors.length} console.error ${rec.consoleErrors.length} warn ${rec.consoleWarnings.length}; shots ${rec.shots.length}` +
      `${rec.stalled ? ' STALLED' : ''}${rec.timedOut ? ' TIMED OUT' : ''}`,
  );
  for (const h of rec.duelErrors?.handlers ?? []) log(`   handler error: ${JSON.stringify(h).slice(0, 700)}`);
  for (const h of rec.duelErrors?.timeouts ?? []) log(`   watchdog: ${h}`);
  for (const e of [...rec.pageErrors, ...rec.neonErrors]) log(`   page error: ${e.slice(0, 700)}`);
  for (const e of rec.consoleErrors.slice(0, 10)) log(`   console.error: ${e.slice(0, 500)}`);
  for (const n of rec.notes) log(`   note: ${n}`);
  return rec;
}

function summarizeProfile(profile, top = 25) {
  const nodes = new Map(profile.nodes.map((n) => [n.id, n]));
  const counts = new Map();
  for (let i = 0; i < profile.samples.length; i++) counts.set(profile.samples[i], (counts.get(profile.samples[i]) ?? 0) + (profile.timeDeltas[i] ?? 0));
  const self = new Map();
  const byFile = new Map();
  let total = 0;
  for (const [id, us] of counts) {
    const cf = nodes.get(id).callFrame;
    const file = cf.url ? cf.url.replace(/^https?:\/\/[^/]+\//, '').replace(/\?.*$/, '') : '(native)';
    const key = `${cf.functionName || '(anon)'}  ${file}:${cf.lineNumber + 1}`;
    self.set(key, (self.get(key) ?? 0) + us);
    byFile.set(file, (byFile.get(file) ?? 0) + us);
    total += us;
  }
  const rows = (m) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, top);
  return {
    totalMs: Math.round(total / 1000),
    files: rows(byFile).map(([k, us]) => ({ file: k, ms: Math.round(us / 1000), pct: +((100 * us) / total).toFixed(1) })),
    functions: rows(self).map(([k, us]) => ({ fn: k, ms: Math.round(us / 1000), pct: +((100 * us) / total).toFixed(1) })),
  };
}

async function cmdGames() {
  const plan = planList();
  const outDir = path.resolve(root, args.out ?? 'shots/demo-qa/games');
  fs.mkdirSync(outDir, { recursive: true });
  const parallel = Math.max(1, Number(args.parallel ?? 1));
  const { server, base } = await startServer();
  const report = { started: new Date().toISOString(), plan, games: [] };
  const reportFile = path.join(outDir, args.report ?? 'report.json');
  let failed = false;
  try {
    let next = 0;
    const worker = async () => {
      const browser = await launch();
      try {
        while (next < plan.length) {
          const i = next++;
          let rec;
          try {
            rec = await playGame(browser, base, plan[i], i, outDir);
          } catch (e) {
            rec = { name: `g${i}`, ...plan[i], ok: false, crash: String(e && e.stack ? e.stack : e) };
            log(`game ${i} crashed: ${rec.crash}`);
          }
          if (!rec.ok) failed = true;
          report.games[i] = rec;
          fs.writeFileSync(reportFile, JSON.stringify(report, null, 1));
        }
      } finally {
        await browser.close();
      }
    };
    await Promise.all(Array.from({ length: Math.min(parallel, plan.length) }, worker));
  } finally {
    report.finished = new Date().toISOString();
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 1));
    await server.close();
  }
  console.log('\n=== summary');
  for (const r of report.games) {
    if (!r) continue;
    console.log(
      `${r.ok ? 'OK  ' : 'FAIL'} ${r.name}: arena ${r.arena} P${r.winner === null || r.winner === undefined ? '?' : r.winner + 1} ${r.reason ?? ''} t${r.turns} ${(r.wallMs / 1000 || 0).toFixed(0)}s ${r.fps}fps ` +
        `handlers ${r.duelErrors?.handlers?.length ?? '?'} watchdog ${r.duelErrors?.timeouts?.length ?? '?'} page ${(r.pageErrors?.length ?? 0) + (r.neonErrors?.length ?? 0)} console.error ${r.consoleErrors?.length ?? '?'}` +
        ` events ${Object.entries(r.events ?? {}).filter(([k]) => ['summon', 'attackDeclare', 'activate', 'fieldSpell', 'destroy', 'gameOver'].includes(k)).map(([k, v]) => `${k}:${v}`).join(' ')}`,
    );
  }
  console.log(`report: ${path.relative(root, reportFile)}`);
  return failed;
}

// ====================================================================================== play

const SC = 'window.__neon.game.scene.keys.Duel';

async function cmdPlay() {
  const scale = Number(args.scale ?? 2);
  const arena = String(args.arena ?? 'v2');
  const outDir = path.resolve(root, args.out ?? `shots/demo-qa/play${arena === 'v2' ? '' : '-' + arena}`);
  fs.mkdirSync(outDir, { recursive: true });
  const { server, base } = await startServer();
  const browser = await launch();
  const results = [];
  const findings = [];
  const logs = [];
  let failed = false;
  const pass = (name, ok, info = '') => {
    results.push({ name, ok, info });
    if (!ok) failed = true;
    log(`${ok ? 'PASS' : 'FAIL'} ${name}${info ? ' — ' + info : ''}`);
  };
  const find = (area, sev, text) => {
    findings.push({ area, sev, text });
    log(`FINDING [${area}/${sev}] ${text}`);
  };
  try {
    const ctx = await browser.newContext({ viewport: { width: 640 * scale, height: 360 * scale }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    page.setDefaultTimeout(180000);
    page.setDefaultNavigationTimeout(180000);
    page.on('console', (m) => {
      if (m.type() === 'error' || m.type() === 'warning') logs.push(`[console.${m.type()}] ${m.text().slice(0, 600)}`);
    });
    page.on('pageerror', (e) => {
      failed = true;
      logs.push(`[pageerror] ${e.message}\n${(e.stack ?? '').slice(0, 1200)}`);
    });
    let box = null;
    const js = (expr) => page.evaluate(`(async () => (${expr}))()`);
    const toPage = (x, y) => ({ x: box.x + (x + 0.5) * (box.width / 640), y: box.y + (y + 0.5) * (box.width / 640) });
    const frames = async (n = 2) => {
      const f = await js('window.__neon.game.loop.frame');
      await page.waitForFunction((t) => window.__neon.game.loop.frame >= t, f + n, { timeout: 30000, polling: 30 });
    };
    const move = async (x, y, o = {}) => {
      const p = toPage(x, y);
      await page.mouse.move(p.x, p.y, { steps: o.steps ?? 2 });
      await frames(o.frames ?? 2);
    };
    const click = async (x, y, o = {}) => {
      await move(x, y, o);
      await page.mouse.down({ button: o.button ?? 'left' });
      await page.waitForTimeout(40);
      await page.mouse.up({ button: o.button ?? 'left' });
      await frames(o.frames ?? 3);
    };
    const until = (expr, timeout = 120000) =>
      page.waitForFunction(`(() => { try { return !!(${expr}); } catch (e) { return false; } })()`, null, { timeout, polling: 100 });
    const waitMode = async (modes, timeout = 240000) => {
      const l = JSON.stringify([].concat(modes));
      await until(`${SC}.controller && ${l}.includes(${SC}.controller.input.mode) && (${SC}.controller.input.mode === 'curtain' || !${SC}.controller.busy)`, timeout);
      await frames(4);
    };
    const mode = () => js(`${SC}.controller.input.mode`);
    let shotNo = 0;
    const shot = async (name, clip) => {
      const z = box.width / 640;
      const c = clip ? { x: box.x + clip[0] * z, y: box.y + clip[1] * z, width: clip[2] * z, height: clip[3] * z } : box;
      const file = path.join(outDir, `${String(++shotNo).padStart(2, '0')}-${name}.png`);
      await page.screenshot({ path: file, clip: c });
      return file;
    };
    const stage = async (spec) => {
      await js(`window.__neon.duel.restart(${JSON.stringify({ mode: 'hotseat', curtain: false, speed: 3, stage: spec })})`);
      await waitMode('idle');
    };
    const L = async () => js(`import('/src/view/layout.ts').then((m) => ({ v: m.ARENA_VARIANT, UI: m.UI, tw: m.TILE_W, th: m.TILE_H }))`);
    const zoneXY = (p, spot, i = 0) => js(`import('/src/view/layout.ts').then((m) => m.zoneXY(${p}, ${JSON.stringify(spot)}, ${i}))`);
    const st = () => js('window.__neon.duel.state()');
    const menuOpen = () => js(`${SC}.views.menu.isOpen`);
    const menuRect = () => js(`(() => { const m = ${SC}.views.menu; return m.isOpen ? { x: m.left, y: m.top, w: m.w, h: m.h, labels: m.labels } : null; })()`);
    const clickMenu = async (id) => {
      await until(`${SC}.views.menu.isOpen && ${SC}.views.menu.rowXY(${JSON.stringify(id)})`, 15000);
      await page.waitForTimeout(300);
      const p = await js(`${SC}.views.menu.rowXY(${JSON.stringify(id)})`);
      await click(p.x, p.y);
    };
    const handXY = (uid) => js(`window.__neon.duel.views.hand.cardXY(${uid})`);
    const handUid = async (cardId, owner) => {
      const s = await st();
      const p = owner ?? s.activePlayer;
      return s.players[p].hand.find((u) => s.cards[u].cardId === cardId);
    };
    const clickHand = async (cardId, owner) => {
      const uid = await handUid(cardId, owner);
      const p = await handXY(uid);
      // aim at the visible (peeking) part of the card
      await move(p.x, Math.min(356, p.y - 20));
      await page.waitForTimeout(250);
      const q = await handXY(uid);
      await click(q.x, Math.min(356, q.y - 20));
      await page.waitForTimeout(300);
    };
    const buttonXY = (expr) => js(`(() => { const b = ${expr}; const m = b.getWorldTransformMatrix(); return { x: Math.round(m.tx + b.w / 2), y: Math.round(m.ty + b.h / 2), enabled: b.enabled, visible: b.visible }; })()`);
    const labelButtonXY = (label) =>
      js(`(() => {
        const out = [];
        const walk = (list) => { for (const o of list) { if (o.labelText === ${JSON.stringify(label)} && o.active && o.visible) out.push(o); if (o.list) walk(o.list); } };
        walk(${SC}.children.list);
        const b = out[out.length - 1];
        if (!b) return null;
        const m = b.getWorldTransformMatrix();
        return { x: Math.round(m.tx + b.w / 2), y: Math.round(m.ty + b.h / 2) };
      })()`);
    const hot = () => js(`${SC}.controller.input.zoneHover ? ${SC}.controller.input.zoneHover.hot : null`);

    // interactive objects (anything in scene.input's list) — a click over any of them never reaches the board
    const interactiveRects = () =>
      js(`(() => {
        const sc = ${SC};
        const out = [];
        for (const o of sc.input._list) {
          if (!o.active || !o.visible || !o.input || !o.input.enabled) continue;
          let b;
          try { b = o.getBounds(); } catch { continue; }
          const ha = o.input.hitArea;
          out.push({ type: o.type, name: o.name || '', depth: o.depth, x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), label: o.labelText || (o.parentContainer && o.parentContainer.labelText) || '' });
        }
        return out;
      })()`);

    // =========================================================== boot
    await page.goto(`${base}?mode=hotseat&seed=4&skipIntro=1&curtain=0&speed=3&test=1${arena === 'v2' ? '&arena=v2' : ''}`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__neon && window.__neon.ready === true, null, { timeout: 180000 });
    box = await page.locator('canvas').first().boundingBox();
    const lay = await L();
    pass('arena variant', lay.v === arena, `ARENA_VARIANT=${lay.v}`);
    const HW = lay.tw / 2;
    const HH = lay.th / 2;

    // all zone centres
    const ZONES = [];
    for (const p of [0, 1])
      for (const [spot, n] of [['monster', 3], ['spellTrap', 3], ['field', 1], ['graveyard', 1], ['deck', 1], ['banish', 1]])
        for (let i = 0; i < n; i++) ZONES.push({ player: p, spot, index: i, ...(await zoneXY(p, spot, i)) });
    const inDiamond = (z, x, y) => Math.abs(x + 0.5 - z.x) / HW + Math.abs(y + 0.5 - z.y) / HH <= 1;

    // ---- static: zoneAt over every pixel vs the ideal diamonds
    const sweep = await js(`(() => {
      const b = ${SC}.views.board;
      const out = {};
      for (let y = 0; y < 360; y++) for (let x = 0; x < 640; x++) {
        const z = b.zoneAt(x, y);
        if (z) { const k = z.player + ':' + z.spot + ':' + z.index; out[k] = out[k] || []; out[k].push(x + y * 640); }
      }
      return out;
    })()`);
    let mism = 0;
    const mismEx = [];
    for (const z of ZONES) {
      const k = `${z.player}:${z.spot}:${z.index}`;
      const got = new Set(sweep[k] ?? []);
      let inside = 0;
      let missing = 0;
      for (let y = Math.floor(z.y - HH) - 1; y <= z.y + HH + 1; y++)
        for (let x = Math.floor(z.x - HW) - 1; x <= z.x + HW + 1; x++) {
          const want = inDiamond(z, x, y);
          const has = got.has(x + y * 640);
          if (want) inside++;
          if (want !== has && Math.abs(Math.abs(x + 0.5 - z.x) / HW + Math.abs(y + 0.5 - z.y) / HH - 1) > 0.06) {
            missing++;
            if (mismEx.length < 8) mismEx.push(`${k} (${x},${y}) want ${want} got ${has}`);
          }
        }
      mism += missing;
      if (!got.size) find('layout', 'high', `board.zoneAt never returns ${k}`);
    }
    pass('board.zoneAt matches the ideal tile diamonds (pixel sweep, 1-px edge tolerance)', mism === 0, mism ? `${mism} px off: ${mismEx.join('; ')}` : `${ZONES.length} zones`);

    // ---- static: UI rects / interactive objects over zone tiles
    const UIr = lay.UI;
    const rects = { phaseBar: UIr.phaseBar, p1Panel: UIr.p1Panel, p2Panel: UIr.p2Panel, inspect: UIr.inspect, buttons: UIr.buttons };
    const covers = (r, z) => {
      let n = 0;
      for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (inDiamond(z, x, y)) n++;
      return n;
    };
    for (const [k, r] of Object.entries(rects))
      for (const z of ZONES) {
        const n = covers(r, z);
        if (n > 0) find('hud', n > 40 ? 'med' : 'low', `UI.${k} ${JSON.stringify(r)} overlaps zone P${z.player + 1} ${z.spot} ${z.index} by ${n} px`);
      }

    // =========================================================== P1 turn: hover → inspect
    const P1_HAND = ['ember_wolf', 'storm_hawk', 'lumen_sprite', 'mirror_barrier', 'chains_of_light', 'judgment_bolt'];
    const STAGE_A = {
      turn: 3,
      active: 0,
      phase: 'main',
      p0: { hand: P1_HAND, graveyard: ['magma_titan'] },
      p1: { hand: ['tide_golem', 'stone_sentinel', 'volt_lizard', 'chasm_trap'], monsters: ['coral_serpent', null, 'thorn_lurker'], spellTraps: [null, 'mirror_barrier', null], graveyard: ['shade_assassin'], field: 'volcano_arena' },
    };
    await stage(STAGE_A);
    await move(320, 180);
    await shot('p1-idle');
    // idle: interactive objects covering zone tiles (they swallow board clicks: HumanInput ignores a pointerup that is over any)
    const idleObjs = await interactiveRects();
    const reportCover = (objs, when) => {
      for (const o of objs)
        for (const z of ZONES) {
          const n = covers({ x: o.x, y: o.y, w: o.w, h: o.h }, z);
          if (n > 30) find('hud', 'med', `${when}: interactive ${o.type}${o.label ? ' "' + o.label + '"' : ''} (${o.x},${o.y} ${o.w}×${o.h}, depth ${o.depth}) covers ${n} px of zone P${z.player + 1} ${z.spot} ${z.index} — clicks there never reach the board`);
        }
    };
    reportCover(idleObjs, 'idle');
    logs.push('[idle interactive] ' + JSON.stringify(idleObjs));

    const s0 = await st();
    let hovered = 0;
    for (const uid of s0.players[0].hand) {
      const p = await handXY(uid);
      await move(p.x, Math.min(356, p.y - 18), { frames: 4 });
      await page.waitForTimeout(350);
      const r = await js(`({ vis: ${SC}.views.inspect.visible, hov: ${SC}.views.hand.hoverUid })`);
      if (r.vis && r.hov === uid) hovered++;
      else logs.push(`hover hand uid ${uid} at (${p.x},${p.y}): inspect ${r.vis} hoverUid ${r.hov}`);
      if (uid === s0.players[0].hand[2]) await shot('p1-hover-hand');
    }
    pass('hovering each P1 hand card raises it and opens the inspect panel', hovered === s0.players[0].hand.length, `${hovered}/${s0.players[0].hand.length}`);
    // board hover: P2 monsters (face-up) + P2 field spell + P2 graveyard + own set? → inspect
    for (const [spot, i, name] of [['monster', 0, 'P2 coral (face-up)'], ['monster', 2, 'P2 thorn'], ['field', 0, 'P2 field'], ['graveyard', 0, 'P2 graveyard'], ['spellTrap', 1, 'P2 set trap']]) {
      await move(320, 340);
      await page.waitForTimeout(250);
      const z = await zoneXY(1, spot, i);
      await move(z.x, z.y + (spot === 'monster' ? -8 : 0), { frames: 4 });
      await page.waitForTimeout(450);
      const r = await js(`({ vis: ${SC}.views.inspect.visible, key: ${SC}.controller.input.hoverKey })`);
      pass(`hover ${name} → inspect`, r.vis, `hoverKey ${r.key}`);
      if (spot === 'monster' && i === 0) await shot('p1-hover-p2-monster');
    }

    // =========================================================== summon into each P1 monster zone
    const sample = (z) => [
      [0, 0],
      [HW - 6, 0],
      [-(HW - 6), 0],
      [0, HH - 4],
      [0, -(HH - 4)],
      [HW / 2, HH / 2 - 2],
      [-HW / 2, -HH / 2 + 2],
      [HW / 2, -HH / 2 + 2],
      [-HW / 2, HH / 2 - 2],
    ].map(([dx, dy]) => ({ x: Math.round(z.x + dx), y: Math.round(z.y + dy) }));
    const neighbours = (z) => [
      { x: z.x + HW * 2, y: z.y, why: 'one tile right (iso col+1,row-1)' },
      { x: z.x - HW * 2, y: z.y, why: 'one tile left' },
      { x: z.x + HW, y: z.y - HH, why: 'next col (gap / pad)' },
      { x: z.x - HW, y: z.y + HH, why: 'prev col (gap / pad)' },
      { x: z.x - HW, y: z.y - HH, why: 'row toward the bridge' },
      { x: z.x + HW, y: z.y + HH, why: 'row behind' },
    ];
    /** In a zone-pick mode: real mouse over every candidate (centre/corners/edges) + the tiles around them. */
    const hitTest = async (cands, label) => {
      let ok = 0;
      let n = 0;
      const bad = [];
      const candKeys = new Set(cands.map((c) => `${c.player}:${c.spot}:${c.index}`));
      for (const c of cands) {
        const z = await zoneXY(c.player, c.spot, c.index);
        for (const p of sample(z)) {
          await move(p.x, p.y);
          const h = await hot();
          n++;
          if (h === `${c.player}:${c.spot}:${c.index}`) ok++;
          else bad.push(`(${p.x},${p.y}) on ${c.player}:${c.spot}:${c.index} → hot '${h}'`);
        }
        for (const p of neighbours(z)) {
          if (p.x < 0 || p.y < 0 || p.x >= 640 || p.y >= 360) continue;
          const zz = await js(`${SC}.views.board.zoneAt(${p.x}, ${p.y})`);
          const k = zz ? `${zz.player}:${zz.spot}:${zz.index}` : '';
          if (candKeys.has(k)) continue; // a neighbour that is itself a candidate
          await move(p.x, p.y);
          const h = await hot();
          n++;
          if (h === '' || h === null) ok++;
          else bad.push(`(${p.x},${p.y}) ${p.why} of ${c.player}:${c.spot}:${c.index} (zoneAt '${k}') → hot '${h}'`);
        }
      }
      pass(`${label}: pointer hit-testing (${n} real mouse points)`, ok === n, bad.slice(0, 6).join('; '));
      return bad;
    };

    for (const zi of [0, 1, 2]) {
      await stage(STAGE_A);
      await clickHand('ember_wolf', 0);
      const mr = await menuRect();
      pass(`P1 zone ${zi}: hand click opens the menu`, !!mr, mr ? mr.labels.join(', ') : 'no menu');
      if (!mr) continue;
      if (mr.x < 0 || mr.y < 0 || mr.x + mr.w > 640 || mr.y + mr.h > 360) find('hud', 'med', `hand menu off-screen ${JSON.stringify(mr)}`);
      if (zi === 0) await shot('p1-hand-menu');
      await clickMenu('normalSummon');
      await waitMode('zone', 20000);
      if (zi === 0) {
        const objs = await interactiveRects();
        reportCover(objs.filter((o) => !idleObjs.some((q) => q.x === o.x && q.y === o.y && q.w === o.w && q.h === o.h)), 'zone pick');
        await move((await zoneXY(0, 'monster', 1)).x, (await zoneXY(0, 'monster', 1)).y);
        await shot('p1-summon-zone-pick');
        await hitTest([0, 1, 2].map((i) => ({ player: 0, spot: 'monster', index: i })), 'P1 monster zone pick');
      }
      // click near an edge of the target diamond (not the centre)
      const z = await zoneXY(0, 'monster', zi);
      await click(Math.round(z.x - HW / 2 + 4), Math.round(z.y + HH / 2 - 4));
      await waitMode('idle');
      const s = await st();
      const m = s.players[0].monsters[zi];
      pass(`P1 summon into monster zone ${zi} by click`, !!m && s.cards[m.uid].cardId === 'ember_wolf', m ? s.cards[m.uid].cardId : 'empty');
      if (zi === 1) await shot('p1-after-summon');
    }

    // =========================================================== set into each P1 spell/trap zone
    await stage(STAGE_A);
    for (const [zi, card] of [[2, 'mirror_barrier'], [0, 'chains_of_light'], [1, 'judgment_bolt']]) {
      await clickHand(card, 0);
      const mr = await menuRect();
      if (!mr) {
        pass(`P1 set ${card}: menu`, false, 'no menu');
        continue;
      }
      await clickMenu('setSpellTrap');
      await page.waitForTimeout(300);
      if ((await mode()) === 'zone') {
        if (card === 'mirror_barrier') {
          await shot('p1-set-zone-pick');
          await hitTest([0, 1, 2].map((i) => ({ player: 0, spot: 'spellTrap', index: i })), 'P1 spell/trap zone pick');
        }
        const z = await zoneXY(0, 'spellTrap', zi);
        await click(Math.round(z.x + HW / 2 - 4), Math.round(z.y - HH / 2 + 4));
      }
      await waitMode('idle');
      const s = await st();
      const t = s.players[0].spellTraps[zi];
      pass(`P1 set ${card} into spell/trap zone ${zi} by click`, !!t && s.cards[t.uid].cardId === card, t ? s.cards[t.uid].cardId : 'empty');
    }
    await shot('p1-after-sets');

    // =========================================================== attack (stage: P1 battle-ready monster)
    await stage({ ...STAGE_A, p0: { ...STAGE_A.p0, monsters: [null, 'crystal_wyrm', 'storm_hawk'] } });
    const bb = await buttonXY(`${SC}.views.hud.battleButton`);
    pass('SAVAŞ button enabled in main phase', bb.enabled && bb.visible, JSON.stringify(bb));
    await click(bb.x, bb.y);
    await waitMode('idle');
    pass('SAVAŞ click → battle phase', (await st()).phase === 'battle');
    await shot('p1-battle-idle');
    const wy = await zoneXY(0, 'monster', 1);
    await click(wy.x, wy.y - 10);
    await page.waitForTimeout(400);
    let mr = await menuRect();
    if (mr) {
      if (mr.x < 0 || mr.y < 0 || mr.x + mr.w > 640 || mr.y + mr.h > 360) find('hud', 'med', `attack menu off-screen ${JSON.stringify(mr)}`);
      await shot('p1-attack-menu');
      await clickMenu('attack');
    }
    const okZone = await waitMode('zone', 20000).then(() => true, () => false);
    pass('click own monster in battle → target pick', okZone, mr ? mr.labels.join(', ') : 'no menu');
    if (okZone) {
      await shot('p1-attack-target-pick');
      await hitTest([0, 2].map((i) => ({ player: 1, spot: 'monster', index: i })), 'P2 monster target pick');
      const tz = await zoneXY(1, 'monster', 0);
      await click(tz.x, tz.y - 6);
      // P2 has a set Ayna Bariyeri: hot-seat → P2's trap prompt (curtain off)
      const trap = await waitMode(['trap', 'idle'], 240000).then(() => mode(), () => 'timeout');
      if (trap === 'trap') {
        await page.waitForTimeout(1200);
        await shot('p2-trap-prompt');
        const pr = await js(`(() => { const out = []; const walk = (l) => { for (const o of l) { if (o.labelText && o.visible && o.active) { const m = o.getWorldTransformMatrix(); out.push({ l: o.labelText, x: Math.round(m.tx), y: Math.round(m.ty), w: o.w, h: o.h }); } if (o.list) walk(o.list); } }; walk(${SC}.children.list); return out; })()`);
        logs.push('[trap prompt buttons] ' + JSON.stringify(pr));
        const pas = await labelButtonXY('GEÇ');
        pass('trap prompt shows a GEÇ button', !!pas, JSON.stringify(pr.map((b) => b.l)));
        if (pas) await click(pas.x, pas.y);
      } else pass('trap prompt for P2 after the attack', false, `mode ${trap}`);
      await waitMode('idle', 240000);
      const ev = await js('window.__neon.duel.lastEvents().map((e) => e.type).join(",")');
      const s = await st();
      pass('attack resolved (battle event)', /battle/.test(ev) || s.players[1].lp < 4000 || !s.players[1].monsters[0], ev.slice(0, 200));
      await shot('p1-after-attack');
    }

    // =========================================================== end turn → P2 (hot-seat, curtain off)
    const eb = await buttonXY(`${SC}.views.hud.endTurnButton`);
    await click(eb.x, eb.y);
    await page.waitForTimeout(600);
    const confirmBtn = await labelButtonXY('BİTİR');
    if (confirmBtn) await click(confirmBtn.x, confirmBtn.y);
    await waitMode(['idle', 'curtain'], 240000);
    let s2 = await st();
    pass('TURU BİTİR → P2 turn', s2.activePlayer === 1, `active P${s2.activePlayer + 1} turn ${s2.turn} phase ${s2.phase}`);
    const owner = await js(`${SC}.views.hand.owner`);
    pass('hot-seat: the hand view follows P2', owner === 1, `hand owner P${owner + 1}`);
    await shot('p2-turn-idle');

    // =========================================================== P2 summons into each P2 zone + sets
    const STAGE_B = {
      turn: 4,
      active: 1,
      phase: 'main',
      p0: { hand: ['ember_wolf'], monsters: ['crystal_wyrm', null, 'stone_sentinel'], spellTraps: ['chasm_trap', null, null] },
      p1: { hand: ['tide_golem', 'volt_lizard', 'chains_of_light', 'mirror_barrier', 'healing_spring'] },
    };
    for (const zi of [0, 1, 2]) {
      await stage(STAGE_B);
      await clickHand('volt_lizard', 1);
      if (!(await menuOpen())) {
        pass(`P2 zone ${zi}: hand click opens the menu`, false);
        continue;
      }
      await clickMenu('normalSummon');
      await waitMode('zone', 20000);
      if (zi === 0) {
        await shot('p2-summon-zone-pick');
        await hitTest([0, 1, 2].map((i) => ({ player: 1, spot: 'monster', index: i })), 'P2 monster zone pick');
      }
      const z = await zoneXY(1, 'monster', zi);
      await click(Math.round(z.x + HW / 2 - 4), Math.round(z.y - HH / 2 + 4));
      // P1 has a set Uçurum Kapanı: the summon may ask P1 (hot-seat) to respond
      const m2 = await waitMode(['idle', 'trap'], 240000).then(() => mode(), () => 'timeout');
      if (m2 === 'trap') {
        await page.waitForTimeout(1200);
        if (zi === 0) await shot('p1-trap-prompt-on-summon');
        const pas = await labelButtonXY('GEÇ');
        if (pas) await click(pas.x, pas.y);
        await waitMode('idle', 240000);
      }
      const s = await st();
      const m = s.players[1].monsters[zi];
      pass(`P2 summon into monster zone ${zi} by click`, !!m && s.cards[m.uid].cardId === 'volt_lizard', m ? s.cards[m.uid].cardId : 'empty');
    }
    await stage(STAGE_B);
    for (const [zi, card] of [[0, 'chains_of_light'], [2, 'mirror_barrier']]) {
      await clickHand(card, 1);
      if (!(await menuOpen())) {
        pass(`P2 set ${card}: menu`, false);
        continue;
      }
      await clickMenu('setSpellTrap');
      await page.waitForTimeout(300);
      if ((await mode()) === 'zone') {
        if (zi === 0) await hitTest([0, 1, 2].map((i) => ({ player: 1, spot: 'spellTrap', index: i })), 'P2 spell/trap zone pick');
        const z = await zoneXY(1, 'spellTrap', zi);
        await click(z.x, z.y);
      }
      await waitMode('idle');
      const s = await st();
      const t = s.players[1].spellTraps[zi];
      pass(`P2 set ${card} into spell/trap zone ${zi} by click`, !!t && s.cards[t.uid].cardId === card, t ? s.cards[t.uid].cardId : 'empty');
    }
    await shot('p2-after-sets');

    // =========================================================== P2 battle: attack the P1 monster in the far corner
    await stage({ ...STAGE_B, phase: 'battle', p1: { ...STAGE_B.p1, monsters: [null, null, 'magma_titan'] }, p0: { ...STAGE_B.p0, spellTraps: [] } });
    const tz2 = await zoneXY(1, 'monster', 2);
    await click(tz2.x, tz2.y - 12);
    await page.waitForTimeout(400);
    mr = await menuRect();
    if (mr) {
      if (mr.x < 0 || mr.y < 0 || mr.x + mr.w > 640 || mr.y + mr.h > 360) find('hud', 'med', `P2 attack menu off-screen ${JSON.stringify(mr)}`);
      await shot('p2-attack-menu');
      await clickMenu('attack');
    }
    const okZ2 = await waitMode('zone', 20000).then(() => true, () => false);
    pass('P2: click own monster in battle → target pick', okZ2, mr ? JSON.stringify(mr) : 'no menu');
    if (okZ2) {
      await hitTest([0, 2].map((i) => ({ player: 0, spot: 'monster', index: i })), 'P1 monster target pick (P2 attacking)');
      const z = await zoneXY(0, 'monster', 2);
      await click(z.x, z.y - 6);
      await waitMode('idle', 240000);
      await shot('p2-after-attack');
    }

    // =========================================================== log panel + pause menu over the board
    await stage(STAGE_A);
    const lb = await buttonXY(`${SC}.views.hud.logButton`);
    await click(lb.x, lb.y);
    await page.waitForTimeout(700);
    const logOpen = await js(`${SC}.views.log.open`);
    pass('log button opens the log', logOpen);
    const lr = await js(`(() => { const l = ${SC}.views.log; const r = l.root || l.panel || l.container; if (!r) return null; const b = r.getBounds(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }; })()`).catch(() => null);
    if (lr) for (const z of ZONES) {
      const n = covers(lr, z);
      if (n > 40) find('hud', 'low', `log panel ${JSON.stringify(lr)} covers ${n} px of zone P${z.player + 1} ${z.spot} ${z.index} while open`);
    }
    await shot('log-open');
    await click(lb.x, lb.y);
    await page.waitForTimeout(400);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(900);
    await shot('pause-menu');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(600);

    // HUD close-ups for readability (3× clips)
    await stage({ ...STAGE_A, p0: { ...STAGE_A.p0, monsters: ['crystal_wyrm', null, 'storm_hawk'], lp: 2350 } });
    await move(320, 200);
    await page.waitForTimeout(500);
    await shot('hud-top', [0, 0, 640, 60]);
    await shot('hud-bottom', [0, 290, 640, 70]);
    const pe = await js('window.__neon.duel.errors()');
    pass('no cinematic handler errors / watchdog timeouts during the playtest', !pe.handlers.length && !pe.timeouts.length, JSON.stringify(pe).slice(0, 600));
    const ne = await js('window.__neon.errors');
    pass('no page errors', !ne.length, JSON.stringify(ne).slice(0, 600));
  } catch (e) {
    failed = true;
    log('[play] script error', e && e.stack ? e.stack : e);
  } finally {
    for (const l of logs) console.log(l.slice(0, 2000));
    fs.writeFileSync(path.join(outDir, 'results.json'), JSON.stringify({ results, findings, logs }, null, 1));
    console.log(`\n=== play: ${results.filter((r) => r.ok).length}/${results.length} passed, ${findings.length} findings`);
    for (const r of results) if (!r.ok) console.log(`FAIL ${r.name}: ${r.info}`);
    for (const f of findings) console.log(`FINDING [${f.area}/${f.sev}] ${f.text}`);
    await browser.close();
    await server.close();
  }
  return failed;
}

// ====================================================================================== v1

/** Deterministic v1 shots: [name, query, shot.mjs args]. */
const V1_SHOTS = [
  ['board', '?dev=board', ['--step', '2000']],
  ['title', '', ['--step', '3000']],
  ['demo-s2', '?mode=demo&seed=2&skipIntro=1', ['--step', '4000']],
  ['demo-s3-opening', '?mode=demo&seed=3&holdIntro=1', ['--step', '5200']],
  ['hotseat-s3', '?mode=hotseat&seed=3&skipIntro=1&curtain=0', ['--step', '2500']],
  ['scenario-tributeWyrm', '?dev=duel&s=tributeWyrm', ['--step', '3200']],
  ['scenario-lethal', '?dev=duel&s=lethal', ['--step', '6000']],
];

function runShot(tree, query, extra, out) {
  return new Promise((resolve) => {
    const t = Date.now();
    // a long ready timeout: under machine load the duel can take minutes to become interactive
    const ps = spawn(process.execPath, [path.join(tree, 'tools/shot.mjs'), query, ...extra, '--timeout', String(args['shot-timeout'] ?? 300000), '--out', out], { cwd: tree, stdio: ['ignore', 'pipe', 'pipe'] });
    let txt = '';
    ps.stdout.on('data', (d) => (txt += d));
    ps.stderr.on('data', (d) => (txt += d));
    ps.on('close', (code) => resolve({ code, txt, ms: Date.now() - t }));
  });
}

/** Pixel diff of two PNGs in the browser: counts + a diff image (changed pixels magenta over a dimmed copy). */
async function diffPng(page, a, b, out) {
  const A = fs.readFileSync(a).toString('base64');
  const B = fs.readFileSync(b).toString('base64');
  const r = await page.evaluate(
    async ({ A, B }) => {
      const load = (s) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = 'data:image/png;base64,' + s; });
      const [ia, ib] = await Promise.all([load(A), load(B)]);
      if (ia.width !== ib.width || ia.height !== ib.height) return { sizeMismatch: [ia.width, ia.height, ib.width, ib.height] };
      const w = ia.width, h = ia.height;
      const get = (img) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.drawImage(img, 0, 0); return x.getImageData(0, 0, w, h); };
      const da = get(ia), db = get(ib);
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const x = c.getContext('2d');
      const o = x.createImageData(w, h);
      let any = 0, big = 0, x0 = w, y0 = h, x1 = -1, y1 = -1;
      for (let i = 0; i < w * h; i++) {
        const k = i * 4;
        const d = Math.max(Math.abs(da.data[k] - db.data[k]), Math.abs(da.data[k + 1] - db.data[k + 1]), Math.abs(da.data[k + 2] - db.data[k + 2]));
        if (d > 0) {
          any++;
          if (d > 24) big++;
          const px = i % w, py = (i / w) | 0;
          if (px < x0) x0 = px; if (py < y0) y0 = py; if (px > x1) x1 = px; if (py > y1) y1 = py;
          o.data[k] = 255; o.data[k + 1] = 0; o.data[k + 2] = 255; o.data[k + 3] = 255;
        } else {
          o.data[k] = da.data[k] * 0.35; o.data[k + 1] = da.data[k + 1] * 0.35; o.data[k + 2] = da.data[k + 2] * 0.35; o.data[k + 3] = 255;
        }
      }
      x.putImageData(o, 0, 0);
      return { w, h, any, big, bbox: x1 < 0 ? null : [x0, y0, x1 - x0 + 1, y1 - y0 + 1], png: any ? c.toDataURL('image/png').split(',')[1] : null };
    },
    { A, B },
  );
  if (r.png) fs.writeFileSync(out, Buffer.from(r.png, 'base64'));
  delete r.png;
  return r;
}

async function cmdV1() {
  const bases = [].concat(args.base ?? []).map((b) => path.resolve(b));
  if (!bases.length) throw new Error('v1: pass --base <worktree> (e.g. a `git worktree add <scratch>/qa-base HEAD`)');
  const outDir = path.resolve(root, args.out ?? 'shots/demo-qa/v1');
  fs.mkdirSync(outDir, { recursive: true });
  const only = args.only ? String(args.only).split(',') : null;
  const shots = V1_SHOTS.filter(([n]) => !only || only.includes(n));
  const trees = [['cur', root], ['cur2', root], ...bases.map((b, i) => [`base${i ? i + 1 : ''}`, b])];
  const rows = [];
  for (const [name, query, extra] of shots) {
    const files = {};
    for (const [tag, tree] of trees) {
      const out = path.join(outDir, `${name}.${tag}.png`);
      const r = await runShot(tree, query, extra, out);
      const errs = r.txt.split('\n').filter((l) => /pageerror|neon\.errors|console\.error|timed out|eval error/.test(l));
      log(`${name} [${tag}] ${path.relative(root, tree) || '.'}: exit ${r.code} ${(r.ms / 1000).toFixed(0)} s${errs.length ? ' — ' + errs.join(' | ').slice(0, 400) : ''}`);
      if (r.code !== 0 && !errs.length) log(`   shot.mjs output: ${r.txt.trim().split('\n').slice(-6).join(' | ').slice(0, 900)}`);
      files[tag] = fs.existsSync(out) ? out : null;
    }
    const browser = await launch();
    try {
      const page = await browser.newPage();
      const noise = files.cur && files.cur2 ? await diffPng(page, files.cur, files.cur2, path.join(outDir, `${name}.noise-diff.png`)) : null;
      for (const [tag] of trees.slice(2)) {
        const d = files.cur && files[tag] ? await diffPng(page, files[tag], files.cur, path.join(outDir, `${name}.${tag}-diff.png`)) : null;
        rows.push({ name, base: tag, noise, diff: d });
        log(`${name}: cur vs ${tag}: ${d ? `${d.any} px differ (${d.big} strongly), bbox ${JSON.stringify(d.bbox)}` : 'missing'}; run-to-run noise ${noise ? `${noise.any} px (${noise.big} strongly) bbox ${JSON.stringify(noise.bbox)}` : '?'}`);
      }
    } finally {
      await browser.close();
    }
  }
  fs.writeFileSync(path.join(outDir, 'v1-report.json'), JSON.stringify(rows, null, 1));
  console.log('\n=== v1 unchanged check (diff vs baseline; noise = this tree rendered twice)');
  let bad = false;
  for (const r of rows) {
    const verdict = !r.diff ? 'MISSING' : r.diff.any === 0 ? 'IDENTICAL' : r.noise && r.diff.any <= r.noise.any * 1.5 + 50 ? 'within noise' : 'DIFFERS';
    if (verdict === 'DIFFERS' || verdict === 'MISSING') bad = true;
    console.log(`${r.name.padEnd(22)} vs ${r.base.padEnd(6)} ${verdict.padEnd(12)} diff ${r.diff ? r.diff.any : '-'} (strong ${r.diff ? r.diff.big : '-'}) noise ${r.noise ? r.noise.any : '-'}`);
  }
  return bad;
}

// ====================================================================================== flow

/**
 * The demo page end to end, as a visitor would use it: demo.html (no params) → title attract →
 * click → menu → "İzle (Demo)" → watch a few turns → Esc → "Ana Menüye Dön" → confirm → title →
 * "2 Oyuncu (Aynı Ekran)" → pass-device curtain (click) → Esc → Teslim Ol → confirm → game over
 * → "TEKRAR OYNA" → the next duel. Real mouse clicks only; errors are collected throughout.
 */
async function cmdFlow() {
  const scale = Number(args.scale ?? 2);
  const page0 = String(args.page ?? 'demo.html');
  const outDir = path.resolve(root, args.out ?? 'shots/demo-qa/flow');
  fs.mkdirSync(outDir, { recursive: true });
  const { server, base } = await startServer();
  const browser = await launch();
  const results = [];
  const logs = [];
  let failed = false;
  const pass = (name, ok, info = '') => {
    results.push({ name, ok, info });
    if (!ok) failed = true;
    log(`${ok ? 'PASS' : 'FAIL'} ${name}${info ? ' — ' + info : ''}`);
  };
  try {
    const ctx = await browser.newContext({ viewport: { width: 640 * scale, height: 360 * scale }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    page.setDefaultTimeout(180000);
    page.on('console', (m) => {
      if (m.type() === 'error' || m.type() === 'warning') logs.push(`[console.${m.type()}] ${m.text().slice(0, 600)}`);
    });
    page.on('pageerror', (e) => {
      failed = true;
      logs.push(`[pageerror] ${e.message}\n${(e.stack ?? '').slice(0, 1200)}`);
    });
    let box = null;
    const js = (expr) => page.evaluate(`(async () => (${expr}))()`);
    const toPage = (x, y) => ({ x: box.x + (x + 0.5) * (box.width / 640), y: box.y + (y + 0.5) * (box.width / 640) });
    const click = async (x, y) => {
      const p = toPage(x, y);
      await page.mouse.move(p.x, p.y, { steps: 3 });
      await page.waitForTimeout(150);
      await page.mouse.down();
      await page.waitForTimeout(50);
      await page.mouse.up();
      await page.waitForTimeout(300);
    };
    const until = (expr, timeout = 180000) =>
      page.waitForFunction(`(() => { try { return !!(${expr}); } catch (e) { return false; } })()`, null, { timeout, polling: 200 });
    let n = 0;
    const shot = async (name) => page.screenshot({ path: path.join(outDir, `${String(++n).padStart(2, '0')}-${name}.png`), clip: box });
    const labelXY = (label, scene = 'Duel') =>
      js(`(() => {
        const sc = window.__neon.game.scene.keys[${JSON.stringify(scene)}];
        const out = [];
        const walk = (list) => { for (const o of list) { if (o.labelText === ${JSON.stringify(label)} && o.active && o.visible) out.push(o); if (o.list) walk(o.list); } };
        walk(sc.children.list);
        const b = out[out.length - 1];
        if (!b) return null;
        const m = b.getWorldTransformMatrix();
        return { x: Math.round(m.tx + b.w / 2), y: Math.round(m.ty + b.h / 2) };
      })()`);
    const clickLabel = async (label, scene = 'Duel', timeout = 30000) => {
      const t = Date.now();
      let p = null;
      while (!p && Date.now() - t < timeout) {
        p = await labelXY(label, scene);
        if (!p) await page.waitForTimeout(250);
      }
      if (!p) throw new Error(`no button "${label}"`);
      // prompts ignore input until their buttons have risen in
      await page.waitForTimeout(1500);
      p = (await labelXY(label, scene)) ?? p;
      await click(p.x, p.y);
      return p;
    };
    const titleRow = (id) =>
      js(`(() => { const t = window.__neon.game.scene.keys.Title; const r = t.menu.rows.find((r) => r.entry.id === ${JSON.stringify(id)}); const b = r.zone.getBounds(); return { x: Math.round(b.centerX), y: Math.round(b.centerY) }; })()`);
    const menuRow = (id) => js(`window.__neon.game.scene.keys.Duel.views.menu.rowXY(${JSON.stringify(id)})`);
    const errs = () => js(`({ duel: window.__neon.duel ? window.__neon.duel.errors() : null, neon: [...window.__neon.errors] })`);

    await page.goto(`${base}${page0}`, { waitUntil: 'load' });
    await until('window.__neon && window.__neon.ready === true');
    box = await page.locator('canvas').first().boundingBox();
    const variant = await js(`import('/src/view/layout.ts').then((m) => m.ARENA_VARIANT)`);
    pass(`${page0} boots (arena ${variant})`, page0 !== 'demo.html' || variant === 'v2', variant);
    await page.waitForTimeout(9000);
    await shot('title-attract');
    // the first click skips the intro / unlocks audio; keep clicking until the menu is up
    for (let i = 0; i < 40; i++) {
      if ((await js(`window.__neon.game.scene.keys.Title.screen`)) === 'menu') break;
      await click(320, 200);
      await page.waitForTimeout(3000);
    }
    await until(`window.__neon.game.scene.keys.Title.screen === 'menu'`, 60000);
    await page.waitForTimeout(1500);
    await shot('title-menu');
    const demoRow = await titleRow('demo');
    await click(demoRow.x, demoRow.y);
    await until(`window.__neon.game.scene.isActive('Duel') && window.__neon.duel`, 120000);
    pass('title → İzle (Demo) starts a demo duel', (await js('window.__neon.duel.launch.mode')) === 'demo');
    await page.waitForTimeout(6000);
    await shot('demo-opening');
    await until(`window.__neon.duel.state().turn >= 3`, 600000);
    await page.waitForTimeout(1500);
    await shot('demo-turn3');
    // Esc → düello menüsü (spectator: Devam / Ana Menü) → Ana Menüye Dön → confirm
    await page.keyboard.press('Escape');
    await until(`window.__neon.game.scene.keys.Duel.views.menu.isOpen`, 30000);
    await page.waitForTimeout(1200);
    await shot('demo-esc-menu');
    const q = await menuRow('quit');
    pass('Esc in the demo opens the düello menüsü with "Ana Menüye Dön"', !!q);
    if (q) {
      await click(q.x, q.y);
      await clickLabel('ANA MENÜ');
      await until(`window.__neon.game.scene.isActive('Title') && !window.__neon.game.scene.isActive('Duel')`, 120000);
      await page.waitForTimeout(2500);
      await shot('back-to-title');
      pass('Ana Menüye Dön → title', true);
    }
    // hot-seat with the curtain
    const hsRow = await titleRow('hotseat');
    await until(`window.__neon.game.scene.keys.Title.screen === 'menu'`, 60000);
    await click(hsRow.x, hsRow.y);
    await until(`window.__neon.game.scene.isActive('Duel') && window.__neon.duel && window.__neon.game.scene.keys.Duel.controller && window.__neon.game.scene.keys.Duel.controller.input.mode === 'curtain'`, 300000);
    await page.waitForTimeout(2500);
    await shot('hotseat-curtain');
    await click(320, 180);
    await until(`window.__neon.game.scene.keys.Duel.controller.input.mode === 'idle' && !window.__neon.game.scene.keys.Duel.controller.busy`, 120000);
    await page.waitForTimeout(800);
    await shot('hotseat-idle');
    pass('curtain click → the player acts', true);
    await page.keyboard.press('Escape');
    await until(`window.__neon.game.scene.keys.Duel.views.menu.isOpen`, 30000);
    await page.waitForTimeout(500);
    await shot('hotseat-pause');
    const sr = await menuRow('surrender');
    pass('pause menu offers Teslim Ol', !!sr);
    if (sr) {
      await click(sr.x, sr.y);
      await clickLabel('TESLİM OL');
      await until(`window.__neon.duel.state().winner !== null`, 60000);
      const again = await clickLabel('TEKRAR OYNA', 'Duel', 180000).then(() => true, (e) => (logs.push(String(e)), false));
      await shot('after-replay-click');
      pass('game over → TEKRAR OYNA button', again);
      if (again) {
        await until(`window.__neon.game.scene.isActive('Duel') && window.__neon.duel.state().winner === null && window.__neon.duel.state().turn >= 1`, 180000);
        await page.waitForTimeout(3000);
        await shot('replayed-duel');
        pass('TEKRAR OYNA → a new duel', true);
      }
    }
    const e = await errs();
    pass('no handler errors / watchdog timeouts / page errors', !(e.duel?.handlers?.length || e.duel?.timeouts?.length || e.neon.length), JSON.stringify(e).slice(0, 600));
  } catch (e) {
    failed = true;
    log('[flow] script error', e && e.stack ? e.stack : e);
  } finally {
    for (const l of logs) console.log(l.slice(0, 1500));
    fs.writeFileSync(path.join(outDir, 'results.json'), JSON.stringify({ results, logs }, null, 1));
    console.log(`\n=== flow: ${results.filter((r) => r.ok).length}/${results.length} passed`);
    for (const r of results) if (!r.ok) console.log(`FAIL ${r.name}: ${r.info}`);
    await browser.close();
    await server.close();
  }
  return failed;
}

// ====================================================================================== main

let failed = false;
try {
  if (cmd === 'scan') await cmdScan();
  else if (cmd === 'games') failed = await cmdGames();
  else if (cmd === 'play') failed = await cmdPlay();
  else if (cmd === 'v1') failed = await cmdV1();
  else if (cmd === 'flow') failed = await cmdFlow();
  else {
    console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').filter((l) => l.startsWith('//')).slice(0, 40).join('\n'));
  }
} catch (e) {
  failed = true;
  console.error('[qa] failed', e);
}
process.exit(failed ? 1 : 0);
