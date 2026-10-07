// How scenes hand off to each other, plus persisted player settings.
import type { PlayerId } from '../engine/types';

/** hotseat: two humans share the screen. vsBot: human (P1) vs the CPU. demo: CPU vs CPU (title attract mode / QA). */
export type DuelMode = 'hotseat' | 'vsBot' | 'demo';

/** Data passed with `scene.start('Duel', launch)`. */
export interface DuelLaunch {
  mode: DuelMode;
  seed?: number;
  firstPlayer?: PlayerId;
  /** Which player the CPU controls in vsBot mode (default 1). */
  botPlayer?: PlayerId;
  /** Skip the opening cinematic (QA / quick restart). */
  skipIntro?: boolean;
}

export interface Settings {
  /** Animation speed multiplier. */
  speed: 1 | 2 | 3;
  sound: boolean;
  music: boolean;
  /** Hot-seat privacy curtain between turns (hides the next player's hand until they tap). */
  curtain: boolean;
}

const KEY = 'neon-duello:settings';
const DEFAULTS: Settings = { speed: 1, sound: true, music: true, curtain: true };

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    /* storage unavailable */
  }
  return { ...DEFAULTS };
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable */
  }
}

/** Launch options from the URL (?mode=vsBot&seed=7&skipIntro=1) — used by QA tools. */
export function launchFromUrl(params: URLSearchParams): DuelLaunch | null {
  const mode = params.get('mode') as DuelMode | null;
  if (!mode) return null;
  const seed = params.get('seed');
  const first = params.get('first');
  return {
    mode,
    seed: seed !== null ? Number(seed) : undefined,
    firstPlayer: first === '0' || first === '1' ? (Number(first) as PlayerId) : undefined,
    skipIntro: params.get('skipIntro') === '1',
  };
}
