// Art Lab time model.
//
// There is ONE lab clock `t` (ms). Everything on screen is a pure function of it. The battle
// script is authored in ACTION time `a`: lab time with the hit-stops taken out. During a hit-stop
// the lab clock keeps running (shake and impact light play) while action time holds, so actors
// and action-clocked effects freeze on their impact frame.

/** A hit-stop: action time holds for `dur` ms of lab time when it reaches `at`. */
export interface HitStop {
  /** Action time (ms) of the stop. */
  at: number;
  /** Hold length in lab ms. */
  dur: number;
}

interface Stop {
  /** Action time of the stop. */
  a: number;
  /** Lab time at which the hold starts. */
  t: number;
  dur: number;
}

export class TimeMap {
  private readonly stops: Stop[];

  constructor(stops: readonly HitStop[] = []) {
    const sorted = [...stops].sort((p, q) => p.at - q.at);
    let acc = 0;
    this.stops = sorted.map((s) => {
      const r = { a: s.at, t: s.at + acc, dur: Math.max(0, s.dur) };
      acc += r.dur;
      return r;
    });
  }

  /** Lab time at which action time `a` is reached (the START of a hold for a stop at `a`). */
  toLab(a: number): number {
    let t = a;
    for (const s of this.stops) if (a > s.a) t += s.dur;
    return t;
  }

  /** Action time shown at lab time `t`. */
  toAction(t: number): number {
    let a = t;
    for (const s of this.stops) {
      if (t >= s.t + s.dur) a -= s.dur;
      else if (t > s.t) a -= t - s.t;
    }
    return a;
  }

  /** Lab-time windows of the holds (for the shake / debug readouts). */
  holds(): { t: number; dur: number }[] {
    return this.stops.map((s) => ({ t: s.t, dur: s.dur }));
  }
}
