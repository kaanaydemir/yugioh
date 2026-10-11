// Arena v2 volcano layer: lava cracks spreading through the marble (CPU-painted canvas texture).

import Phaser from 'phaser';
import { type CrackField, buildCrackField2, paintCracks2 } from '../../art/arena-v2/lava';
import { SLAB_RECT } from '../../art/arena-v2/geom';
import { PAL } from '../../art/palette';
import { mix } from '../../art/pixel';
import { type BoardCtx, D2 } from './types';

type Img = Phaser.GameObjects.Image;

export class Lava {
  private crack: CrackField | null = null;
  private crackKey = '';
  private front = 0;
  private flow = false;
  private heat = 0; // glow (cooling toward stone)
  private alpha = 0;
  private tex: Phaser.Textures.CanvasTexture | null = null;
  private imgData: ImageData | null = null;
  private img: Img | null = null;
  private glow: Img | null = null;
  private token = 0;
  private frame = 0;
  private texKey: string;

  constructor(private readonly ctx: BoardCtx & { id: number }) {
    this.texKey = `arena2:lava:${ctx.id}`;
  }

  /** Crack the marble open from `origin` (animated spread ~1.1 s, or instantly). */
  async erupt(origin: { col: number; row: number }, animate: boolean): Promise<void> {
    const token = ++this.token;
    this.ensure(origin);
    const f = this.crack!;
    const end = f.maxDist + 16;
    this.alpha = 1;
    this.heat = 1;
    if (!animate) {
      this.front = end;
      this.flow = true;
      this.paint();
      this.sync();
      return;
    }
    this.flow = false;
    this.front = 0;
    this.img!.clearTint();
    this.paint();
    await this.ctx.run(900, (k) => token === this.token && (this.front = f.mostDist * k), 'Sine.Out', 40);
    if (token !== this.token) return;
    await this.ctx.run(200, (k) => token === this.token && (this.front = f.mostDist + (end - f.mostDist) * k));
    if (token !== this.token) return;
    this.front = end;
    this.flow = true;
  }

  /** The lava cools to stone and fades. */
  async cool(animate: boolean): Promise<void> {
    const token = ++this.token;
    if (!animate || !this.img) {
      this.alpha = 0;
      this.heat = 0;
      this.flow = false;
      this.sync();
      return;
    }
    const a0 = this.alpha;
    const h0 = this.heat;
    await Promise.all([
      this.ctx.run(700, (k) => token === this.token && (this.heat = h0 * (1 - k)), 'Quad.Out'),
      this.ctx.run(900, (k) => token === this.token && (this.alpha = a0 * (1 - k)), 'Quad.In'),
    ]);
    if (token === this.token) this.flow = false;
  }

  tick(_dt: number): void {
    if (!this.crack || !this.img) return;
    this.frame++;
    const spreading = !this.flow && this.alpha > 0;
    if (spreading || (this.flow && this.alpha > 0 && this.frame % 4 === 0)) this.paint();
    this.sync();
  }

  /** Embers rising from the cracks (called from the particle update). */
  emberTick(): void {
    if (!this.crack || this.alpha < 0.3 || this.heat < 0.5) return;
    const spreading = !this.flow;
    if (this.ctx.rnd() < (spreading ? 0.9 : 0.18)) {
      const pts = this.crack.embers;
      const e = pts[Math.floor(this.ctx.rnd() * pts.length)];
      if (e.d <= this.front && (!spreading || e.d > this.front - 24)) this.ctx.spawn('ember', e.x, e.y - 1, PAL.fire4, spreading ? -(30 + this.ctx.rnd() * 40) : undefined);
    }
  }

  destroy(): void {
    this.token++;
    if (this.tex) {
      const key = this.tex.key;
      this.tex = null;
      if (this.ctx.scene.textures.exists(key)) this.ctx.scene.textures.remove(key);
    }
  }

  private ensure(origin: { col: number; row: number }): void {
    const key = `${origin.col},${origin.row}`;
    if (this.crack && this.crackKey === key) return;
    this.crack = buildCrackField2(origin);
    this.crackKey = key;
    if (this.tex) return;
    const scene = this.ctx.scene;
    if (scene.textures.exists(this.texKey)) scene.textures.remove(this.texKey);
    const cv = document.createElement('canvas');
    cv.width = SLAB_RECT.w;
    cv.height = SLAB_RECT.h;
    cv.getContext('2d', { willReadFrequently: true });
    this.tex = scene.textures.addCanvas(this.texKey, cv);
    if (!this.tex) throw new Error('arena v2: cannot create lava canvas');
    this.imgData = this.tex.getContext().createImageData(SLAB_RECT.w, SLAB_RECT.h);
    this.img = this.ctx.add(scene.add.image(SLAB_RECT.x, SLAB_RECT.y, this.texKey).setOrigin(0).setDepth(D2.lava));
    this.glow = this.ctx.add(scene.add.image(SLAB_RECT.x, SLAB_RECT.y, this.texKey).setOrigin(0).setDepth(D2.lavaGlow).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0));
  }

  private paint(): void {
    if (!this.crack || !this.tex || !this.imgData) return;
    paintCracks2(this.crack, this.imgData.data, this.front, this.flow ? this.ctx.t : null);
    this.tex.getContext().putImageData(this.imgData, 0, 0);
    this.tex.refresh();
  }

  private sync(): void {
    if (!this.img || !this.glow) return;
    const vis = this.alpha > 0.001;
    this.img.setVisible(vis).setAlpha(this.alpha);
    const k = this.heat;
    this.img.setTint(k >= 1 ? 0xffffff : mix(PAL.stone1, 0xffffff, k));
    this.glow.setVisible(vis).setAlpha(this.alpha * k * (0.34 + 0.12 * Math.sin(this.ctx.t / 420)));
  }
}
