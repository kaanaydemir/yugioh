# HD render — volumetric sprite renderer

The library every HD monster is built with (docs/STYLE_HD.md: *"canavarlar elle boyanmaz:
iskelet + hacimler → ışık → palet rampaları"*). You describe a creature as a **rig** (bones,
IK, secondary motion) and **volumes** (ellipsoids, tubes, crystal facets, membranes, flames,
fur clumps); the renderer lights them with one baked key light, snaps every pixel to a
hue-shifted palette ramp, draws the line work, and returns the color sprite **plus a matching
normal map** (and an emissive mask for bloom). Every frame comes from the same rig, so
proportions never drift, and the normal map always lines up with the art.

```
rig (Skeleton / ik2 / lagChain / springChain / poseAt)
  └─ parts (layers, back → front), each a G-buffer:  material · normal · depth · bias · heat · id
       primitives depth-merge inside a part ("clay")
  └─ finish():  per part  light + quantize → despeckle → edge light / clump lines → details
                composite  contact shadow (2 px) on parts behind · inner line (1 px) on the front edge
                outline    selective colored contour around the silhouette
                overlays   glints / sparkles / smears (light, never outlined)
  └─ HDRenderResult { color, normal, emissive, stages?, ms, timing }
```

Proof / reference: `demo.ts` ("Küre Gezgini", a crystal orb on four legs — uses every feature)
and `src/hd/dev/render-preview.ts` (stage sheet, animation strips, material/primitive sampler).
Regenerate the PNGs with `node src/hd/render/tools/shots.mjs` → `shots/hd/render/*.png`
(`stages`, `idle`, `hit`, `sampler`, `final-x3`). The trial shell can show it live with
`mountRenderPreview(scene)` (4-stage sheet + the animated creature under Light2D).

## Quick start

```ts
import { HDRenderer, MAT, farSide, Skeleton, ik2, lagChain, poseAt, bezier, type Key } from '../render';

const r = new HDRenderer(128, 128);           // one renderer per sprite size; reuse it for every frame

function render(anim: MonsterAnim, frame: number): HDFrame {
  const P = pose(anim, frame);                 // your numbers: angles, offsets, 0..1 controls
  const rig = SK.solve({ x: 60, y: 70, angle: P.lean }, { neck: P.neck });
  r.begin();
  r.part('far-leg').tube([hip, knee, ankle], [6, 4, 3], { mat: farSide(MAT.charcoalFur) });
  r.part('body').ellipsoid(rig.at('spine', 0.5), 24, 16, { mat: MAT.charcoalFur, angle: 0.1 });
  r.part('mane', { lines: false, shadow: false, outline: false })
    .wisp(bezier(a, b, c, d), 6, frame / 12, { mat: MAT.flame });
  r.part('eye', { shadow: false }).sphere(eyePos, 2.5, { mat: MAT.eyeAmber, heat: 'radial' });
  return r.finish();                           // { color, normal, emissive, ms, timing }
}
```

`render()` must be deterministic; the app caches frames (`memoFrames()` helps).

## Conventions

- Screen space: **x right, y DOWN, z TOWARD THE VIEWER** (bigger z = in front). Angles in
  degrees: 0 = right, 90 = down. Sprites face **right**; P2 is flipped by the consumer, who must
  also invert the normal map's X (`flipFrame()` does both if you bake a flipped copy).
- Coordinates are sprite pixels; floats are fine (pixels are sampled at their centers, no AA).
  Sub-pixel motion in the rig gives smooth animation — the volumes re-rasterize every frame.
- Colors only from `src/art/palette.ts`. Materials compose palette ramps; never invent hexes.
- Light comes from the top-left (`KEY_LIGHT`), shadows fall bottom-right.

## Parts

`r.part(name, opts)` adds a layer on top of the previous ones. Inside a part, primitives
**depth-merge** (higher z wins) — use one part per rigid piece that should read as one surface
(torso + belly + chest, a whole leg). Between parts you get **line work**.

| option | default | meaning |
|---|---|---|
| `lines` | true | 1 px inner line where this part's edge lies over earlier parts |
| `shadow` | true | 2 px contact shadow cast on earlier parts (bottom-right of the edge) |
| `outline` | true | contributes to the silhouette outline (false for light/fire you want soft) |
| `order` | creation | composite order — lets a wing swap behind/in front per pose |

`r.getPart(name)`, `r.frame(draw)` (begin → draw → finish), `r.overlay(fn)` (light after the outline).

## Primitives (all chainable on a `Part`; every call takes `{ mat, bias?, tone?, id?, mode? }`)

| primitive | use for | notes |
|---|---|---|
| `ellipsoid(c, rx, ry, {angle, rz, flat, heat})` / `sphere` | bodies, heads, joints, orbs, eyes | true ellipsoid normals; `rz` = depth radius (small = disc); `heat: 'radial'` for glowing balls |
| `tube(path, radius, {depth, facets, belly, rings, caps, heat})` / `capsule` | limbs, necks, tails, horns | radius per point / constant / `(t)=>r`; `depth` per point lets a tail pass behind; `facets` = crystal / armored cross-section; `belly {from, mat|bias, side}` = ventral band; `rings {every, mat|bias}` = segment plates |
| `facet(pts, {normal})` | flat authored planes (head planes, plates) | combine with `tone` for hand-picked tones |
| `facet3(pts3)` | planar facet from 3D points | normal from the plane — sharp crystal edges |
| `gem(outline, {apex, height, table})` | rocks, studs, crystal clusters | one facet per outline edge |
| `cutGem(c, rx, ry, {sides, rings, twist})` | orbs, gem eyes, crystal cores | brilliant cut, ~6·sides facets |
| `shard(base, tip, halfWidth, {height, shoulder})` | crystal spikes, claws, horns, teeth | 4 flat facets around a ridge |
| `membrane(pts, {normal, billow})` | wing panels, fins, frills | `billow` < 0 cups (wing catching air); translucent materials show the body through |
| `cloth(top[], bottom[], {folds, depth, phase})` | capes, banners, ear flaps | flat fold strips; animate `phase` |
| `flame({spine, width, t, sway, turbulence, licks, base})` / `wisp(spine, w, t)` | fire, manes, plumes, magic | emissive; seamless loop over `t` 0..1; deterministic |
| `furClump(root, tip, w, {bend, baseNormal, lean})` | single tufts | body normal + own rounded normal → clean bands |
| `furFringe(path, {count, length, width, side, flow, comb, baseNormal})` | silhouette fringes, ruffs, manes, cheek tufts | `baseNormal(t, root)` = the body's normal → the coat shades as one volume |
| `furCoat(c, rx, ry, {spacing, length, width, flow})` | a whole furry body | undercoat ellipsoid + layered clumps (shingle order) |
| `bias(pts, Δ)`, `biasWhere(fn)` | tone decals under lighting (markings, soot, inner glow) | ±0.15 ≈ one band |
| `paint(pts, {mat})` | change material inside a region (belly plates, stripes) | keeps the normals |
| `detail(d => …)` | eyes, pupils, veins, scars after lighting | `d.set / d.line / d.shift / d.shiftLine / d.setTone`; `{emissive: true}` tags glow |

Lower-level: every primitive is also a plain function on a `GBuffer` + `Brush` (`primitives.ts`),
and `Spine` gives fast nearest-point queries for custom shapes.

## Materials (`materials.ts`)

A material maps light to **one of 5–7 palette tones** (no dithering on creatures):

```ts
const HIDE = material({
  name: 'hide',
  ramp: hueRamp(RAMPS.night, { drop: { bottom: 1 }, highlight: [PAL.steel, PAL.mist, PAL.white] }),
  gamma: 0.85,                                   // <1 = more light tones, >1 = more shadow
  spec: { power: 28, min: 0.9, color: PAL.gold4 }, // warm glint (highlights lean gold)
  outline: { dark: PAL.night0, lit: PAL.night3 },   // selective outline, never black
  line: PAL.night1,                                 // inner line on the shadow side
});
```

Fields: `ramp`, `thresholds` (tone boundaries in light space), `gamma`, `wrap` (soft terminator),
`occlusion`, `spec` (glint), `edgeLight` (crystal/metal facet edges catch light), `transmit`
(light exits the far rim of clear solids — crystal-ball crescent), `emissive` (unlit, tone from
`heat`, tagged for bloom), `translucent {alpha, behind}` (see-through panels), `outline {dark, lit}`,
`line`, `clumpLines` (fur), `rim` (receives rig bounce/rim), `despeckle`.

**Hue shift rule:** shadows lean navy/purple (`night*`, `void*`), highlights lean warm (`gold4`,
`white`). Build ramps by extending a palette ramp with neighbours: `hueRamp(core, { shadow, highlight, drop })`.

Presets (`MAT.*`): `iceHide` (Kristal Ejder hide), `crystal` (faceted glowing crystal), `glass`
(translucent wing glass), `gold`, `steel`, `charcoalFur` (Kor Kurdu), `stone`, `mouth`, `flame`,
`energy`, `eyeCyan`, `eyeAmber`. Derive: `variant(m, patch)`, `farSide(m)` (one step darker for
far limbs/wings). See them all in `shots/hd/render/sampler.png`.

## Light rig (`shading.ts`)

`new HDRenderer(w, h, { light: { … } })` — `key` (toward the light, default top-left +
toward viewer), `wrap` 0.3, `aoRadius` 3 / `aoStrength` 0.45 (creases where primitives meet
inside a part), `bounce` (reflected ground light lifting the core shadow, default on), `rim`
(optional baked rim; the dynamic P1-cyan / P2-crimson rims come from the app's Light2D + the
normal map, so leave it off for monsters).

## Line work (`lines.ts`)

- **Inner line** (1 px): on the front part's edge over another part. Shadow side → `mat.line`;
  lit side → two tones down its own ramp (soft).
- **Contact shadow** (2 px): on parts behind, cast bottom-right: −2 tones touching, −1 further.
  Emissive and translucent parts don't cast it; emissive pixels never receive it.
- **Selective outline** (1 px, outside the silhouette): `outline.dark` where the edge faces away
  from the light, `outline.lit` where it faces it. Outline pixels get outward normals (they catch
  dynamic side lights).
- **Drop shadow**: `drawDropShadow(canvas, c, rx, ry)` / `dropShadow(rx, ry)` — 4 nested alpha
  steps of `PAL.ink`. The sprite frames do not include it (the app places it; `hover` lifts it).

## Rig (`rig.ts`)

- `new Skeleton(defs).solve(root, pose, {scale, world})` → `Rig` with `get/start/end/at(bone, t, side)/local/joints`.
  Bones: `{ name, parent, length, angle (relative to parent), at, offset, z }`. Pose = angle deltas.
- `ik2(root, target, l1, l2, bend)` → `{ joint, end, reached, a1, a2 }` — planted feet, reaching hands.
- `lagChain({ root, count, seg, rest, rootAngle, drive, t, lag })` — **loops**: a wave travels root → tip (tails, manes, wing fingers, capes). Seamless.
- `springChain({ anchor(t), count, seg, rest, stiffness, damping, gravity, t })` — **one-shots**: Verlet chain dragged by the body, simulated from t = 0 every call (deterministic follow-through).
- `poseAt(rest, keys, frame, loop?)` with `Key { f, pose, ease }` — keyframed poses, per-key easing
  (`ease.*`: inOutSine, outBack, outExpo, snap…), fractional frames, seamless loops.
- `loopPhase(f, n, lag)`, `lagged(curve, f, lag)` for overlapping action.

## Output

`finish()` → `HDRenderResult`:
- `color: PixelCanvas` — the sprite (alpha 255, or the translucent alpha where glass covers nothing).
- `normal: PixelCanvas` — **RGB = n·0.5 + 0.5, +Y UP** (Phaser Light2D / OpenGL), alpha = color alpha.
  Flat (0,0,1) = (128,128,255).
- `emissive: PixelCanvas` — RGB = color, A = glow strength (flames, eyes, energy, tagged details). Feed it to bloom.
- `stages` (with `finish({ stages: true })`): `albedo`, `normal`, `lit` (shaded, no line work), `final`.
- `ms`, `timing { prims, shade, composite, outline, encode }`.

Helpers (`util.ts`): `memoFrames`, `flipFrame` / `flipCanvasX(canvas, normal)`, `relight(frame, lights)` (CPU preview of the normal map).

## Cost

Measured in headless Chromium (Vite dev server), machine shared with other jobs (load ≈ 3–4):

| what | cost |
|---|---|
| demo creature, 192×192, 12 parts, ~14k px (85-facet gem, 27 fur clumps, 1 flame, 4 IK legs) | **median ≈ 10 ms**, p90 ≈ 15–18 ms per frame |
| breakdown | primitives ≈ 5–6 · lighting ≈ 3 · composite ≈ 1.7 · outline ≈ 0.9 · encode ≈ 0.7 ms |
| 12-frame idle bake | ≈ 115 ms |
| flame 10×46 px | ≈ 1.5–2 ms (noise-bound; scales with area) |
| fur clump 15×5 px | ≈ 50 µs |
| cut gem r = 40 (85 facets) | ≈ 0.4 ms |
| tube, 50 px spine | ≈ 0.15 ms |

Cost scales with covered pixels (not frame size): every buffer tracks a dirty box. The renderer
reuses all buffers between frames (only the three output canvases are allocated), so keep one
renderer per sprite size and cache finished frames. Under `vite-node` / Vite SSR the numbers are
2–4× worse (imports become getter calls in hot loops) — measure in the browser.

Tips: many small flames cost more than a few big ones; fur counts of 10–30 clumps per fringe are
plenty at 128–192 px; prefer `tube` over many `sphere`s for limbs.
