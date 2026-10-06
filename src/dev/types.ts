import type Phaser from 'phaser';

/**
 * A dev preview page, opened with `?dev=<name>` (plus any extra query params).
 * Add one per feature in `src/dev/previews/<name>.ts` (default export). Previews are
 * how agents and humans look at art, VFX and UI in isolation (see tools/shot.mjs).
 * `create` may be async; window.__neon.ready is set when it resolves.
 */
export interface DevPreview {
  name: string;
  description: string;
  create(scene: Phaser.Scene, params: URLSearchParams): void | Promise<void>;
}
