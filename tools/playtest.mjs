#!/usr/bin/env node
// Real-player playtest driver for Neon Düello: drives the game with REAL mouse clicks and key
// presses through Playwright (page.mouse / page.keyboard on the canvas), not engine dispatch.
//
//   node tools/playtest.mjs <script.mjs> [--query "?mode=hotseat&seed=3"] [--scale 2] [--timeout MS]
//
// The script default-exports `async (t) => { ... }` and gets the helpers below. Screenshots go
// to shots/playtest/<name>.png. Page console errors / page errors / __neon.duel.errors() are
// printed at the end (exit code 1 if the page threw).
//
//   await t.goto('?mode=hotseat&seed=3&speed=3')      // (re)load; waits for __neon.ready
//   await t.click(x, y)                                // game pixel (640×360) → canvas coords
//   await t.move(x, y); await t.key('Escape'); await t.hold(x, y, ms)
//   await t.shot('name' [, { clip: [x, y, w, h] }])
//   await t.wait(ms); await t.until('js expr', { timeout })   // page-side predicate
//   await t.js('js expr')                              // evaluate (async ok) in the page
//   await t.inputMode()                                // HumanInput.mode ('idle', 'zone', 'menu', ...)
//   await t.waitMode('idle' | ['idle','zone'], { timeout })
//   t.zone(player, spot, index)                        // screen centre of a board zone
//   await t.handXY(uid)                                // resting screen point of a hand card
//   t.note('...')                                      // logged with a timestamp

import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

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
const scriptPath = args._[0];
if (!scriptPath) {
  console.error('usage: node tools/playtest.mjs <script.mjs> [--query "?..."] [--scale 2]');
  process.exit(2);
}
const scale = Number(args.scale ?? 2);
const outDir = path.resolve(root, args.out ?? 'shots/playtest');
fs.mkdirSync(outDir, { recursive: true });

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

// ---- board geometry (mirror of src/view/layout.ts)
// zones5 (?zones=5 with ?look=v3, set by goto / --query): 7×5 grid, origin (288, 80), graveyard / deck on col 6
let Z5 = /[?&]zones=5(&|$)/.test(args.query ?? '') && /[?&]look=v3(&|$)/.test(args.query ?? '');
let BOARD_OX = Z5 ? 288 : 320;
let BOARD_OY = Z5 ? 80 : 96;
function setZones5(q) {
  Z5 = /[?&]zones=5(&|$)/.test(q) && /[?&]look=v3(&|$)/.test(q);
  BOARD_OX = Z5 ? 288 : 320;
  BOARD_OY = Z5 ? 80 : 96;
}
function isoToScreen(col, row) {
  return { x: BOARD_OX + (col - row) * 32, y: BOARD_OY + (col + row) * 16 };
}
function zoneCell(player, spot, index = 0) {
  let c;
  switch (spot) {
    case 'monster':
      c = { col: 1 + index, row: 3 };
      break;
    case 'spellTrap':
      c = { col: 1 + index, row: 4 };
      break;
    case 'field':
      c = { col: 0, row: 3 };
      break;
    case 'graveyard':
      c = { col: Z5 ? 6 : 4, row: 3 };
      break;
    case 'deck':
      c = { col: Z5 ? 6 : 4, row: 4 };
      break;
    default:
      c = { col: 0, row: 4 };
  }
  return player === 0 ? c : { col: (Z5 ? 6 : 4) - c.col, row: 4 - c.row };
}

const port = 5900 + Math.floor(Math.random() * 600);
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
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
});

let failed = false;
const t0 = Date.now();
const logs = [];
try {
  const context = await browser.newContext({ viewport: { width: 640 * scale, height: 360 * scale }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const navTimeout = Math.max(Number(args.timeout ?? 120000), 120000);
  page.setDefaultNavigationTimeout(navTimeout);
  page.setDefaultTimeout(navTimeout);
  page.on('console', (m) => {
    const txt = m.text();
    if (m.type() === 'error' || m.type() === 'warning') logs.push(`[console.${m.type()}] ${txt}`);
    else if (m.type() === 'log' && !txt.startsWith('%c') && args.verbose) logs.push(`[console.log] ${txt}`);
  });
  page.on('pageerror', (e) => {
    failed = true;
    logs.push(`[pageerror] ${e.message}\n${e.stack ?? ''}`);
  });

  let box = null;
  const canvasBox = async () => {
    box = await page.locator('canvas').first().boundingBox();
    return box;
  };
  const toPage = async (x, y) => {
    const b = box ?? (await canvasBox());
    const z = b.width / 640;
    return { x: b.x + (x + 0.5) * z, y: b.y + (y + 0.5) * z };
  };

  const t = {
    page,
    note: (s) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${s}`),
    async goto(query, o = {}) {
      let q = query.startsWith('?') ? query : '?' + query;
      setZones5(q);
      q += (q.length > 1 ? '&' : '') + 'test=1';
      await page.goto(base + q, { waitUntil: 'load' });
      box = null;
      if (o.ready !== false) await page.waitForFunction(() => window.__neon && window.__neon.ready === true, null, { timeout: o.timeout ?? navTimeout });
      await canvasBox();
    },
    async click(x, y, o = {}) {
      const p = await toPage(x, y);
      await page.mouse.move(p.x, p.y, { steps: 2 });
      await page.waitForTimeout(o.hover ?? 60);
      await page.mouse.down({ button: o.button ?? 'left' });
      await page.waitForTimeout(o.downMs ?? 40);
      await page.mouse.up({ button: o.button ?? 'left' });
      await page.waitForTimeout(o.after ?? 120);
    },
    async hold(x, y, ms) {
      const p = await toPage(x, y);
      await page.mouse.move(p.x, p.y);
      await page.mouse.down();
      await page.waitForTimeout(ms);
      await page.mouse.up();
    },
    async move(x, y, o = {}) {
      const p = await toPage(x, y);
      await page.mouse.move(p.x, p.y, { steps: o.steps ?? 4 });
      await page.waitForTimeout(o.after ?? 120);
    },
    async key(k, o = {}) {
      await page.keyboard.press(k, { delay: o.delay ?? 30 });
      await page.waitForTimeout(o.after ?? 120);
    },
    async wait(ms) {
      await page.waitForTimeout(ms);
    },
    async shot(name, o = {}) {
      const b = box ?? (await canvasBox());
      const z = b.width / 640;
      const clip = o.clip ? { x: b.x + o.clip[0] * z, y: b.y + o.clip[1] * z, width: o.clip[2] * z, height: o.clip[3] * z } : b;
      const file = path.join(outDir, `${name}.png`);
      await page.screenshot({ path: file, clip });
      return file;
    },
    async js(expr) {
      return page.evaluate(`(async () => (${expr}))()`);
    },
    async until(expr, o = {}) {
      return page.waitForFunction(`(() => { try { return !!(${expr}); } catch (e) { return false; } })()`, null, {
        timeout: o.timeout ?? 60000,
        polling: o.every ?? 100,
      });
    },
    async inputMode() {
      return page.evaluate(() => {
        const sc = window.__neon.game.scene.keys.Duel;
        const c = sc && sc.controller;
        if (!c) return 'none';
        return c.input.mode ?? 'unknown';
      });
    },
    async waitMode(modes, o = {}) {
      const list = Array.isArray(modes) ? modes : [modes];
      await page.waitForFunction(
        (l) => {
          const sc = window.__neon.game.scene.keys.Duel;
          const c = sc && sc.controller;
          return !!c && l.includes(c.input.mode) && (c.input.mode === 'curtain' || !c.busy);
        },
        list,
        { timeout: o.timeout ?? 120000, polling: 100 },
      );
      await page.waitForTimeout(o.settle ?? 250);
    },
    zone(player, spot, index = 0) {
      const c = zoneCell(player, spot, index);
      return isoToScreen(c.col, c.row);
    },
    async handXY(uid) {
      return page.evaluate((u) => window.__neon.duel.views.hand.cardXY(u), uid);
    },
    async state() {
      return page.evaluate(() => window.__neon.duel.state());
    },
    async errors() {
      return page.evaluate(() => ({ duel: window.__neon.duel?.errors?.(), page: window.__neon.errors }));
    },
    logs,
  };

  const mod = await import(pathToFileURL(path.resolve(process.cwd(), scriptPath)).href);
  try {
    await mod.default(t, args);
  } catch (e) {
    failed = true;
    logs.push(`[script error] ${e && e.stack ? e.stack : e}`);
    try {
      await t.shot('_failure');
      logs.push('[script error] screenshot at shots/playtest/_failure.png');
    } catch {}
  }
  try {
    const errs = await t.errors();
    if (errs.page?.length) {
      failed = true;
      logs.push(`[neon.errors] ${JSON.stringify(errs.page)}`);
    }
    if (errs.duel && (errs.duel.handlers.length || errs.duel.timeouts.length)) logs.push(`[duel.errors] ${JSON.stringify(errs.duel)}`);
  } catch {}
} finally {
  for (const l of logs) console.log(l);
  console.log(`[playtest] done in ${((Date.now() - t0) / 1000).toFixed(1)}s${failed ? ' (FAILED)' : ''}`);
  await browser.close();
  await server.close();
}
process.exit(failed ? 1 : 0);
