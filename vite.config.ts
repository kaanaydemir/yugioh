import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  base: './',
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: { host: '0.0.0.0', port: 5173 },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 4000,
    // Multi-page build: the game, the HD trial page, the side-by-side comparison page and the
    // arena v2 demo page.
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        trial: fileURLToPath(new URL('./trial.html', import.meta.url)),
        compare: fileURLToPath(new URL('./compare.html', import.meta.url)),
        // Arena v2 demo: the normal game with window.__NEON_ARENA = 'v2' set before boot.
        demo: fileURLToPath(new URL('./demo.html', import.meta.url)),
      },
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
