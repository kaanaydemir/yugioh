// First-use texture warming (v3 A1 item 11).
//
// Some textures are generated the first time a cinematic needs them: the drop shadow of a
// monster (its first unit / summon), the shatter frame (its first death), the Soul Recall ghost,
// the stat chevrons, the battle-phase edge vignette... Plan §3: "no hitch on the first summon /
// first attack". warmFirstUse() makes them ahead of time for the monsters in the decks, in short
// idle slices after boot — and only once every deferred monster sheet is painted
// (textures.whenMonstersBuilt): the sheet painting itself is the biggest first-use cost, it is
// already sliced in the background, and the jobs below read its cached frames.
//
// Every job calls the game's own generator, which returns early when the texture exists: a job
// the game already ran costs nothing, and warming changes no pixel (same generator, same key,
// same texture). Order: what the first summon / death needs first (shadows, shatter frames), then
// the rest.
//
// Not warmed, by design (measured cheap or not knowable ahead): per-instance canvases
// (`tilecard:live:<n>`, `duel:badge:<n>`, a board's `arena:lava:<id>`), size-dependent panels
// (`ui:panel:<style>:<w>x<h>…`), the title screen's own textures.
//
//   warmFirstUse(scene)                  — boot step 50-warm (idle slices; ?test: right away)
//   warmStats()                          — what ran, how long (tools / dev)

import type Phaser from 'phaser';
import { CARDS, DEFAULT_DECK, isMonster, type MonsterId } from '../data/cards';
import { monsterArt } from '../art/monsters';
import { PAL } from '../art/palette';
import { whenMonstersBuilt } from '../art/textures';

export interface WarmJob {
  kind: string;
  /** What it makes (for stats / logs). */
  label: string;
  run(scene: Phaser.Scene): void;
}

export interface WarmStats {
  monsters: MonsterId[];
  jobs: number;
  done: number;
  /** Total ms spent in jobs, and the longest single job. */
  ms: number;
  maxJobMs: number;
  maxJob: string;
  /** performance.now() when the first job ran / when the last one finished (0 = not yet). */
  startedAt: number;
  finishedAt: number;
  byKind: Record<string, { n: number; ms: number; max: number }>;
  errors: string[];
}

const stats: WarmStats = { monsters: [], jobs: 0, done: 0, ms: 0, maxJobMs: 0, maxJob: '', startedAt: 0, finishedAt: 0, byKind: {}, errors: [] };

export function warmStats(): WarmStats {
  return stats;
}

/** The monsters of the decks (both players use DEFAULT_DECK), in deck order, once each. */
export function deckMonsters(deck: readonly string[] = DEFAULT_DECK): MonsterId[] {
  const out: MonsterId[] = [];
  for (const id of deck) {
    const def = CARDS[id as keyof typeof CARDS];
    if (def && isMonster(def) && !out.includes(def.id as MonsterId)) out.push(def.id as MonsterId);
  }
  return out;
}

/** The warm jobs for these monsters (generators are imported lazily: no import cycle at boot). */
export async function warmJobs(ids: readonly MonsterId[]): Promise<WarmJob[]> {
  const [unit, shatter, setpieces, flow, banners] = await Promise.all([
    import('./MonsterUnit'),
    import('../vfx/shatter'),
    import('../vfx/setpieces'),
    import('../cinematics/flow/_kit'),
    import('../vfx/banners'),
  ]);
  const jobs: WarmJob[] = [];
  // first summon: the unit's drop shadow
  for (const id of ids) jobs.push({ kind: 'shadow', label: `duel:shadow ${id}`, run: (s) => unit.warmUnitShadow(s, id) });
  // first death: the shatter texture of the frame the default death breaks (shatterUnit: 'hit'
  // with hold + a 2-frame flash + 70 ms → hit frame 1); other frames are made on use (~0.3 ms)
  for (const id of ids) {
    const f = Math.min(1, monsterArt(id).anims.hit.frames - 1);
    jobs.push({ kind: 'shatter', label: `shatter:${id}:hit:${f}`, run: (s) => shatter.warmShatter(s, id, 'hit', f) });
  }
  // the first battle phase's red edge pulse, the stat chevrons
  jobs.push({ kind: 'vignette', label: 'set:vignette crim2', run: (s) => banners.vignetteKey(s, PAL.crim2) });
  jobs.push({ kind: 'chevron', label: 'flow:chev2 up/down', run: (s) => (flow.chevronTexture(s, true), flow.chevronTexture(s, false)) });
  // Soul Recall's ghost of every monster that can end up in a graveyard
  for (const id of ids) jobs.push({ kind: 'ghost', label: `set:ghost:${id}`, run: (s) => setpieces.ghostTexture(s, id) });
  return jobs;
}

/**
 * Run the warm jobs for `ids` (default: the deck monsters) after the monster sheets are painted:
 * in idle slices of ~`sliceMs` (one job per slice at least; setTimeout, like the sheet painting),
 * or all at once with `sync`. Resolves with the stats when done. Safe to call again (no-op jobs).
 */
export async function warmFirstUse(scene: Phaser.Scene, o: { ids?: readonly MonsterId[]; sync?: boolean; sliceMs?: number } = {}): Promise<WarmStats> {
  const ids = o.ids ?? deckMonsters();
  const sliceMs = o.sliceMs ?? 4;
  await whenMonstersBuilt();
  const jobs = await warmJobs(ids);
  stats.monsters = [...ids];
  stats.jobs += jobs.length;
  const runOne = (j: WarmJob) => {
    const t0 = performance.now();
    if (!stats.startedAt) stats.startedAt = t0;
    try {
      j.run(scene);
    } catch (e) {
      stats.errors.push(`${j.label}: ${String(e)}`);
    }
    const ms = performance.now() - t0;
    stats.done++;
    stats.ms += ms;
    if (ms > stats.maxJobMs) {
      stats.maxJobMs = ms;
      stats.maxJob = j.label;
    }
    const k = (stats.byKind[j.kind] ??= { n: 0, ms: 0, max: 0 });
    k.n++;
    k.ms += ms;
    k.max = Math.max(k.max, ms);
  };
  if (o.sync) {
    for (const j of jobs) runOne(j);
    stats.finishedAt = performance.now();
    return stats;
  }
  return new Promise<WarmStats>((resolve) => {
    let i = 0;
    const tick = () => {
      const t0 = performance.now();
      do runOne(jobs[i++]);
      while (i < jobs.length && performance.now() - t0 < sliceMs);
      if (i < jobs.length) setTimeout(tick, 0);
      else {
        stats.finishedAt = performance.now();
        resolve(stats);
      }
    };
    if (jobs.length) setTimeout(tick, 0);
    else resolve(stats);
  });
}
