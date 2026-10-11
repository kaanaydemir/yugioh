// HD render — public API. Import from here:
//
//   import { HDRenderer, MAT, farSide, Skeleton, ik2, lagChain, bezier } from '../render';
//
// See README.md in this folder for the pipeline, conventions and costs.

export * from './math';
export * from './color';
export * from './materials';
export { GBuffer, EMPTY, LIT, type Brush } from './gbuffer';
export * from './primitives';
export { DEFAULT_RIG, KEY_LIGHT, GLINT, type LightRig } from './shading';
export { drawDropShadow, dropShadow, type DropShadowOpts } from './lines';
export { HDRenderer, Part, type BrushOpts, type PartOptions, type RenderOptions, type HDRenderResult, type DetailCtx, type OverlayCtx } from './renderer';
export * from './rig';
export * from './util';
