import Phaser from 'phaser';
import type { DevPreview } from '../dev/types';
import { PAL } from '../art/palette';

const previews = new Map<string, DevPreview>();
for (const m of Object.values(import.meta.glob<{ default: DevPreview }>('../dev/previews/*.ts', { eager: true }))) {
  if (m.default?.name) previews.set(m.default.name, m.default);
}

/** Hosts `?dev=<name>` previews. With no/unknown name it lists all previews. */
export class DevScene extends Phaser.Scene {
  constructor() {
    super('Dev');
  }

  async create(): Promise<void> {
    const params = (this.registry.get('params') as URLSearchParams) ?? new URLSearchParams(location.search);
    const name = params.get('dev') ?? '';
    const preview = previews.get(name);
    this.cameras.main.setBackgroundColor(PAL.night0);
    if (!preview) {
      const lines = ['DEV PREVIEWS (?dev=<name>)', ...[...previews.values()].map((p) => `${p.name} — ${p.description}`)];
      this.add.text(8, 8, lines.join('\n'), { fontFamily: 'monospace', fontSize: '8px', color: '#b6fbff' });
      window.__neon.ready = true;
      return;
    }
    try {
      await preview.create(this, params);
    } catch (err) {
      console.error(err);
      window.__neon.errors.push(`preview ${name}: ${String(err)}`);
    }
    window.__neon.ready = true;
  }
}
