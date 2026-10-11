// HD FX layers — the crisp bloom pass and the soft light textures.
//
// Rule of the look (docs/STYLE_HD.md §2): light is not pixels. Bloom, glows, beams, fog are soft and full
// resolution and flow OVER sharp pixels — but a monster's own pixels are never blurred. So bloom is not a
// full-screen post effect: it runs only on two dedicated display-list LAYERS that hold emissive, additive
// things (beams, sparks, summon columns, eye glows, tile pulses). Monsters and the arena live outside them.
//
//   fx.front   bloom layer ABOVE the units (depth DEPTH.FX): beams, sparks, flashes, muzzle flares
//   fx.back    bloom layer BELOW the units (depth just above the tile glow band): floor glows, magic circles
//   fx.glow(obj, 'front'|'back')   move an object into a layer (give it blendMode ADD)
//   fx.glowSprite(x, y, color, size, alpha, where)  soft additive blob in a layer (the "separate additive glow
//                                  sprite" for emissive parts: eyes, veins, flame tips)
//   bloom                          live settings {enabled, strength, spread}
//
// Layer contract: contents composite ADDITIVELY (alpha is dropped by the bloom pass), so put only light in them.
// The pass is a 3-level pyramid (1/2, 1/4, 1/8 resolution, one separable 9-tap gaussian each) added back on the
// untouched full-resolution layer image: tight core halo + wide soft falloff, no threshold needed.

import Phaser from 'phaser';
import { DEPTH } from '../../view/layout';

export const HD_BLOOM = 'HDBloom';

/** Live bloom settings, shared by all layers. */
export const bloom = {
  enabled: true,
  /** Overall halo strength added on top of the sharp layer (1 = halo as bright as its source). */
  strength: 1.0,
  /** Blur reach multiplier (1 = ~6 / 13 / 26 px at the three levels). */
  spread: 1.0,
  /** Relative weight of the three pyramid levels. */
  levels: [0.62, 0.5, 0.38] as [number, number, number],
};

const FRAG = `
#define SHADER_NAME HD_BLOOM_FS
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform sampler2D uMainSampler;
uniform sampler2D uTex1;
uniform sampler2D uTex2;
uniform sampler2D uTex3;
uniform vec2 uTexel;
uniform vec2 uDir;
uniform float uMode;      /* 0 downsample, 1 blur, 2 composite */
uniform vec4 uParams;     /* x strength, y/z/w level weights */

varying vec2 outTexCoord;

void main ()
{
    vec2 uv = outTexCoord;
    if (uMode < 0.5)
    {
        vec2 o = uTexel * 0.5;
        vec4 c = texture2D(uMainSampler, uv + vec2(-o.x, -o.y));
        c += texture2D(uMainSampler, uv + vec2(o.x, -o.y));
        c += texture2D(uMainSampler, uv + vec2(-o.x, o.y));
        c += texture2D(uMainSampler, uv + vec2(o.x, o.y));
        gl_FragColor = c * 0.25;
    }
    else if (uMode < 1.5)
    {
        vec2 d = uDir * uTexel;
        vec4 c = texture2D(uMainSampler, uv) * 0.2270270270;
        c += (texture2D(uMainSampler, uv + d * 1.3846153846) + texture2D(uMainSampler, uv - d * 1.3846153846)) * 0.3162162162;
        c += (texture2D(uMainSampler, uv + d * 3.2307692308) + texture2D(uMainSampler, uv - d * 3.2307692308)) * 0.0702702703;
        gl_FragColor = c;
    }
    else
    {
        vec4 base = texture2D(uMainSampler, uv);
        vec3 halo = texture2D(uTex1, uv).rgb * uParams.y + texture2D(uTex2, uv).rgb * uParams.z + texture2D(uTex3, uv).rgb * uParams.w;
        /* additive layer: alpha is dropped so the premultiplied composite adds light instead of darkening the scene */
        vec3 add = halo * uParams.x;
        float ign = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
        float any = step(0.0005, max(add.r, max(add.g, add.b)));
        gl_FragColor = vec4(base.rgb + add + (ign - 0.5) * (1.0 / 255.0) * any, 0.0);
    }
}
`;

type RT = Phaser.Renderer.WebGL.RenderTarget;

export class HDBloomPipeline extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  constructor(game: Phaser.Game) {
    super({
      game,
      name: HD_BLOOM,
      fragShader: FRAG,
      // [0] receives the layer; then ping-pong pairs at 1/2, 1/4, 1/8 resolution
      renderTarget: [{ scale: 1 }, { scale: 0.5 }, { scale: 0.5 }, { scale: 0.25 }, { scale: 0.25 }, { scale: 0.125 }, { scale: 0.125 }],
    } as Phaser.Types.Renderer.WebGL.WebGLPipelineConfig);
  }

  override onDraw(target: RT): void {
    const rts = this.renderTargets as RT[];
    const gl = this.gl;
    const on = bloom.enabled && bloom.strength > 0 && rts.length >= 7;
    // While rendering INTO the pyramid the extra samplers must not point at units that still hold pyramid textures
    // (WebGL rejects a draw whose framebuffer texture is bound anywhere in the program: "feedback loop").
    this.set1i('uTex1', 0);
    this.set1i('uTex2', 0);
    this.set1i('uTex3', 0);

    if (on) {
      const [A0, B0, A1, B1, A2, B2] = [rts[1], rts[2], rts[3], rts[4], rts[5], rts[6]];
      const pass = (src: RT, dst: RT, mode: number, dx = 0, dy = 0) => {
        this.set1f('uMode', mode);
        this.set2f('uTexel', 1 / src.width, 1 / src.height);
        this.set2f('uDir', dx, dy);
        this.bindAndDraw(src, dst);
      };
      const s = bloom.spread;
      pass(target, A0, 0);
      pass(A0, B0, 1, s, 0);
      pass(B0, A0, 1, 0, s);
      pass(A0, A1, 0);
      pass(A1, B1, 1, s, 0);
      pass(B1, A1, 1, 0, s);
      pass(A1, A2, 0);
      pass(A2, B2, 1, s, 0);
      pass(B2, A2, 1, 0, s);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, A0.texture.webGLTexture);
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, A1.texture.webGLTexture);
      gl.activeTexture(gl.TEXTURE3);
      gl.bindTexture(gl.TEXTURE_2D, A2.texture.webGLTexture);
      gl.activeTexture(gl.TEXTURE0);
      this.set1i('uTex1', 1);
      this.set1i('uTex2', 2);
      this.set1i('uTex3', 3);
      const [w1, w2, w3] = bloom.levels;
      this.set4f('uParams', bloom.strength, w1, w2, w3);
    } else {
      this.set4f('uParams', 0, 0, 0, 0);
    }
    this.set1f('uMode', 2);
    this.bindAndDraw(target);
  }
}

/** Register the bloom post pipeline. Idempotent. */
export function installBloom(game: Phaser.Game): boolean {
  const r = game.renderer;
  if (!(r instanceof Phaser.Renderer.WebGL.WebGLRenderer)) return false;
  const classes = (r.pipelines as unknown as { postPipelineClasses: { has(k: string): boolean } }).postPipelineClasses;
  if (!classes.has(HD_BLOOM)) r.pipelines.addPostPipeline(HD_BLOOM, HDBloomPipeline);
  return true;
}

// ================================================================ soft textures

export const SOFT = {
  /** Smooth radial falloff, 128 px (scale freely: linear filtered). */
  glow: 'hd:glow',
  /** Hot core + short skirt, 128 px. */
  core: 'hd:glow:core',
  /** Soft ring, 128 px. */
  ring: 'hd:ring',
  /** Horizontal anamorphic streak, 256×32. */
  streak: 'hd:streak',
  /** Soft contact shadow ellipse (black, alpha), 128×64. */
  shadow: 'hd:shadow',
  /** 1×1 white. */
  px: 'hd:px',
} as const;

function canvasTex(scene: Phaser.Scene, key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): void {
  if (scene.textures.exists(key)) return;
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  draw(cv.getContext('2d')!);
  const tex = scene.textures.addCanvas(key, cv)!;
  tex.setFilter(Phaser.Textures.FilterMode.LINEAR);
}

/** Build the shared soft textures (glow, ring, streak, shadow). Idempotent. */
export function buildSoftTextures(scene: Phaser.Scene): void {
  const radial = (g: CanvasRenderingContext2D, n: number, stops: [number, number][]) => {
    const c = n / 2;
    const gr = g.createRadialGradient(c, c, 0, c, c, c);
    for (const [t, a] of stops) gr.addColorStop(t, `rgba(255,255,255,${a})`);
    g.fillStyle = gr;
    g.fillRect(0, 0, n, n);
  };
  // smooth-step-ish falloff built from many stops (canvas gradients are piecewise linear)
  const falloff = (pow: number): [number, number][] => Array.from({ length: 17 }, (_, i) => [i / 16, Math.pow(1 - i / 16, pow)] as [number, number]);
  canvasTex(scene, SOFT.glow, 128, 128, (g) => radial(g, 128, falloff(2.4)));
  canvasTex(scene, SOFT.core, 128, 128, (g) =>
    radial(g, 128, [
      [0, 1],
      [0.12, 0.95],
      [0.28, 0.45],
      [0.5, 0.14],
      [0.75, 0.035],
      [1, 0],
    ]),
  );
  canvasTex(scene, SOFT.ring, 128, 128, (g) =>
    radial(g, 128, [
      [0, 0],
      [0.62, 0],
      [0.82, 0.9],
      [0.9, 0.55],
      [1, 0],
    ]),
  );
  canvasTex(scene, SOFT.streak, 256, 32, (g) => {
    g.save();
    g.translate(128, 16);
    g.scale(8, 1);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, 16);
    for (let i = 0; i <= 16; i++) gr.addColorStop(i / 16, `rgba(255,255,255,${Math.pow(1 - i / 16, 2.2)})`);
    g.fillStyle = gr;
    g.fillRect(-16, -16, 32, 32);
    g.restore();
  });
  canvasTex(scene, SOFT.shadow, 128, 64, (g) => {
    g.save();
    g.translate(64, 32);
    g.scale(2, 1);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, 32);
    for (let i = 0; i <= 16; i++) gr.addColorStop(i / 16, `rgba(0,0,0,${0.9 * Math.pow(1 - i / 16, 1.6)})`);
    g.fillStyle = gr;
    g.fillRect(-32, -32, 64, 64);
    g.restore();
  });
  canvasTex(scene, SOFT.px, 1, 1, (g) => {
    g.fillStyle = '#fff';
    g.fillRect(0, 0, 1, 1);
  });
}

// ================================================================ layers

export type GlowWhere = 'front' | 'back';

export interface HDFx {
  readonly front: Phaser.GameObjects.Layer;
  readonly back: Phaser.GameObjects.Layer;
  /** Move an object into a bloom layer. Returns it. (Give it blendMode ADD; layers composite additively.) */
  glow<T extends Phaser.GameObjects.GameObject>(obj: T, where?: GlowWhere): T;
  /** A soft additive blob (SOFT.glow) of `size` px diameter, tinted `color`, in a bloom layer. */
  glowSprite(x: number, y: number, color: number, size: number, alpha?: number, where?: GlowWhere, texture?: string): Phaser.GameObjects.Image;
}

/** Depth of the back / front bloom layers. */
export const FX_DEPTH = { back: DEPTH.TILE_FX + 5, front: DEPTH.FX } as const;

export function createFx(scene: Phaser.Scene): HDFx {
  buildSoftTextures(scene);
  const mk = (depth: number) => {
    const l = scene.add.layer();
    l.setDepth(depth);
    l.setPostPipeline(HD_BLOOM);
    return l;
  };
  const back = mk(FX_DEPTH.back);
  const front = mk(FX_DEPTH.front);
  const fx: HDFx = {
    front,
    back,
    glow(obj, where = 'front') {
      (where === 'front' ? front : back).add(obj);
      return obj;
    },
    glowSprite(x, y, color, size, alpha = 1, where = 'front', texture = SOFT.glow) {
      const im = scene.add.image(x, y, texture).setDisplaySize(size, size).setTint(color).setAlpha(alpha).setBlendMode(Phaser.BlendModes.ADD);
      (where === 'front' ? front : back).add(im);
      return im;
    },
  };
  return fx;
}
