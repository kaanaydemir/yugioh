// rigkit / passes / reassemble — the stone revive (A3 Y8): the crumble read backwards. At progress 0
// the body is as broken as the crumble left it at 1 (its edge chunks lying on the floor, the cracks
// open); as the progress grows the chunks fly back up the paths they fell along into their notches
// and the cracks close behind them — with the binding light in them while they close (the revive is
// not the death run in reverse: the light comes back into the stone with the matter). The same two
// halves as crumble: reassemblePass BEFORE the outline, drawDebris AFTER it.

import { clamp } from '../geom';
import { crumblePass, type CrumbleOpts, type Debris } from './crumble';
import type { PartComp } from '../composite';

export interface ReassembleOpts extends Omit<CrumbleOpts, 't' | 'glow'> {
  /** progress 0…1 (0 = broken, 1 = whole) */
  readonly t: number;
  /** light in the closing cracks: 0 dark … 1 hot (default: hot while the cracks are wide, dimming as they close) */
  readonly glow?: number;
}

export function reassemblePass(f: PartComp, o: ReassembleOpts): Debris {
  const t = clamp(o.t, 0, 1);
  return crumblePass(f, { ...o, t: 1 - t, glow: o.glow ?? clamp(1.15 - t, 0, 1) });
}
