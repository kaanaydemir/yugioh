// rigkit — the v3 core (A3_MIMARI §2, §3.1, §3.2): pure, Phaser-free, deterministic; no module
// state (the frame size, the light, the material table and the pools are parameters / instances).
//   drawing craft (Y2, copied from the A2 slice and proven byte-identical once): light, raster,
//   composite, edges, maps, cloth, geom, passes/*;
//   motion grammar (Y3): pose (pose algebra), anim (compiler, toMonsterArt), validate (validateArt).

export * from './geom';
export * from './light';
export * from './raster';
export * from './composite';
export * from './edges';
export * from './maps';
export * from './cloth';
export * from './passes';
export * from './pose';
export * from './anim';
export * from './validate';
