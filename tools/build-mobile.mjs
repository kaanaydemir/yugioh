// Builds the game as ONE self-contained HTML file for the Expo app (mobile/).
//
//   node tools/build-mobile.mjs        → mobile/assets/game/game.html
//
// Why one file: the app shows the game in a WebView from a local file (no server, works offline).
// iOS WebViews refuse to load ES-module chunks from file:// URLs, so every chunk (including the
// lazily imported cinematics) is bundled into a single module and inlined into the page.
// The page sets window.__PRISM_MOBILE = true (src/main.ts: fill the screen) and window.__NEON_LOOK = 'v3'
// (the v3 look: Neon Tower arena, 5+5 zones, v3 cards) before the game boots.

import { build } from 'vite';
import { fileURLToPath, URL } from 'node:url';
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const tmp = join(root, 'mobile', '.build-tmp');
const outDir = join(root, 'mobile', 'assets', 'game');

rmSync(tmp, { recursive: true, force: true });

await build({
  configFile: false,
  root,
  base: './',
  logLevel: 'warn',
  resolve: { alias: { '@': join(root, 'src') } },
  build: {
    target: 'es2022',
    outDir: tmp,
    emptyOutDir: true,
    modulePreload: false,
    chunkSizeWarningLimit: 100000,
    rollupOptions: {
      input: join(root, 'index.html'),
      output: { inlineDynamicImports: true },
    },
  },
});

const assets = join(tmp, 'assets');
const js = readdirSync(assets).filter((f) => f.endsWith('.js'));
if (js.length !== 1) throw new Error(`expected one JS bundle, got ${js.length}: ${js.join(', ')}`);
const code = readFileSync(join(assets, js[0]), 'utf8').replace(/<\/script/gi, '<\\/script');

let html = readFileSync(join(tmp, 'index.html'), 'utf8');
html = html.replace(/<script type="module"[^>]*src="[^"]*"[^>]*><\/script>\s*/g, '');
html = html.replace(/<link rel="modulepreload"[^>]*>\s*/g, '');
// Phone viewport: no zoom gestures, draw under the notch (the app paints the safe area black).
html = html.replace(
  /<meta name="viewport"[^>]*>/,
  '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />',
);
// No text selection / callout / tap highlight on long press.
html = html.replace(
  '</style>',
  '  * { -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent; }\n    </style>',
);
// A function replacer: a string replacer would expand `$&`, `$'` … sequences inside the bundle.
html = html.replace(
  '</body>',
  // __NEON_LOOK = 'v3': the playable game is the v3 look (Neon Tower arena, 5+5 zones, v3 cards). Without
  // it the page falls back to the legacy v1 look, because the app opens game.html with no `?look=v3`.
  () =>
    `  <script>window.__PRISM_MOBILE = true; window.__NEON_LOOK = 'v3';</script>\n    <script type="module">${code}</script>\n  </body>`,
);

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'game.html'), html);
rmSync(tmp, { recursive: true, force: true });
console.log(`[build-mobile] mobile/assets/game/game.html  ${(html.length / 1024 / 1024).toFixed(2)} MB`);
