// The biped plan's version directories (docs/v3/A3_MIMARI.md §3.6). A monster pins the version it is
// built on by importing it:
//
//   import { v1 as biped } from '../bodyplans/biped';
//   export const SENTINEL: BipedMember<{ rune: number; slit: number }> = { … };
//   export default planArt(biped, SENTINEL);            // MonsterArt.bodyPlan = { id: 'biped', version: 1 }
//
// Each export is stamped with the number of its directory (versionDir: 'v1' → 1, checked against the
// directories found by the glob below); nobody types a version. A behaviour change is a copy of the
// directory (v1/ → v2/) changed only there, plus a `v2` export here; members move one by one; a
// directory nobody imports any more is deleted (tests/art/bodyplan-pins.test.ts keeps that honest).

import { versionDir } from '../types';
import { BIPED_V1, type BipedPlan } from './v1';

const DIRS = Object.keys(import.meta.glob('./v*/index.ts', { eager: true }));

export const v1: BipedPlan = versionDir(BIPED_V1, 'v1', DIRS);
