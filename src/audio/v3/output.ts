// v3 output ceiling (sound QA A2 #1): the master chain's last stage for the new look. The v3 mix
// stacks a character's own contact sound on the struck body's material hit, so its big beats
// drove the old safety clipper (transparent to 0.7, asymptote 0.98) to −0.2 … −1.0 dBFS and the
// inter-sample peaks to −0.03 dBTP. In the v3 look the clipper is transparent a little lower and
// can never output more than `top` (−1.5 dBFS sample peak at most), at 4× oversampling; levels
// under the knee pass unchanged. The old look (LOOK_V3 false) gets null: engine.ts builds its
// chain exactly as before.

import { LOOK_V3 } from '../../view/layout';
import type { OutputCeiling } from '../engine';

export const V3_CEILING: OutputCeiling | null = LOOK_V3 ? { knee: 0.6, top: 0.84, lowpass: 0 } : null;
