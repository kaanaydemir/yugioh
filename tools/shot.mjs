#!/usr/bin/env node
// Screenshot / filmstrip tool for Neon Düello (headless Chromium + Vite dev server).
//
//   node tools/shot.mjs "<query>" [options]
//
//   <query>            URL query, e.g. "?dev=monster&id=crystal_wyrm" or "?seed=3"
//   --out FILE         output PNG (default shots/shot.png)
//   --scale N          zoom (viewport = 640N×360N; default 2, film default 1)
//   --wait MS          real-time wait after ready before capture (default 400)
//   --step MS          freeze the game loop and advance exactly MS of game time before capture
//   --eval "JS"        async JS run in the page after ready (window.__neon is available)
//   --film N           capture N frames into one contact sheet (freezes time; deterministic)
//   --every MS         game time between film frames (default 100)
//   --start MS         game time to advance before the first film frame (default 0)
//   --cols C           contact sheet columns (default 4)
//   --clip x,y,w,h     crop to a region in GAME pixels (640×360 space)
//   --timeout MS       ready timeout (default 30000)
//
// Prints page errors / console errors. Exit code 1 if the page threw.

import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv) {
  const o = { query: '', _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
      o[k] = v;
    } else o._.push(a);
  }
  o.query = o._[0] ?? '';
  return o;
}

const args = parseArgs(process.argv.slice(2));
const film = args.film ? Number(args.film) : 0;
const scale = Number(args.scale ?? (film ? 1 : 2));
const out = path.resolve(root, args.out ?? 'shots/shot.png');
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

const port = 5300 + Math.floor(Math.random() * 600);
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
try {
  const page = await browser.newPage({ viewport: { width: 640 * scale, height: 360 * scale }, deviceScaleFactor: 1 });
  const logs = [];
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') logs.push(`[console.${m.type()}] ${m.text()}`);
  });
  page.on('pageerror', (e) => {
    failed = true;
    logs.push(`[pageerror] ${e.message}\n${e.stack ?? ''}`);
  });

  let q = args.query.startsWith('?') ? args.query : '?' + args.query;
  q += (q.length > 1 ? '&' : '') + 'test=1';
  await page.goto(base + q, { waitUntil: 'load' });
  try {
    await page.waitForFunction(() => window.__neon && window.__neon.ready === true, null, { timeout: Number(args.timeout ?? 30000) });
  } catch {
    logs.push('[shot] timed out waiting for window.__neon.ready');
    failed = true;
  }

  if (args.eval) {
    try {
      await page.evaluate(`(async () => { ${args.eval} })()`);
    } catch (e) {
      logs.push(`[eval error] ${e.message}`);
      failed = true;
    }
  }

  const canvas = page.locator('canvas').first();
  const box = await canvas.boundingBox();
  const clipArg = args.clip ? args.clip.split(',').map(Number) : null;
  const clip = clipArg && box
    ? { x: box.x + clipArg[0] * scale, y: box.y + clipArg[1] * scale, width: clipArg[2] * scale, height: clipArg[3] * scale }
    : box ?? undefined;

  if (film) {
    const every = Number(args.every ?? 100);
    const start = Number(args.start ?? 0);
    const cols = Number(args.cols ?? 4);
    await page.evaluate(() => window.__neon.freeze());
    if (start > 0) await page.evaluate((ms) => window.__neon.step(ms), start);
    const frames = [];
    for (let i = 0; i < film; i++) {
      if (i > 0) await page.evaluate((ms) => window.__neon.step(ms), every);
      const buf = await page.screenshot({ clip });
      frames.push({ t: start + i * every, b64: buf.toString('base64') });
    }
    const sheet = await browser.newPage({ viewport: { width: 400, height: 300 }, deviceScaleFactor: 1 });
    const w = clip.width;
    const html = `<html><body style="margin:0;background:#000;font:12px monospace;color:#9ef">
      <div style="display:grid;grid-template-columns:repeat(${cols}, ${w}px);gap:4px;padding:4px">
      ${frames
        .map(
          (f, i) => `<div><div style="padding:1px 2px">#${i} t=${f.t}ms</div><img style="display:block" src="data:image/png;base64,${f.b64}"></div>`,
        )
        .join('')}
      </div></body></html>`;
    await sheet.setContent(html);
    await sheet.screenshot({ path: out, fullPage: true });
  } else {
    if (args.step) {
      await page.evaluate(() => window.__neon.freeze());
      await page.evaluate((ms) => window.__neon.step(ms), Number(args.step));
    } else {
      await page.waitForTimeout(Number(args.wait ?? 400));
    }
    await page.screenshot({ path: out, clip });
  }

  const errs = await page.evaluate(() => window.__neon?.errors ?? []).catch(() => []);
  for (const e of errs) logs.push(`[neon.errors] ${e}`);
  if (errs.length) failed = true;
  for (const l of logs) console.log(l);
  console.log(`[shot] wrote ${path.relative(root, out)}`);
} finally {
  await browser.close();
  await server.close();
}
process.exit(failed ? 1 : 0);
