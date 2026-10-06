// Sound contract. Everything is synthesized with WebAudio (no audio files).
// STUB until the audio agent implements it — all calls are safe no-ops.

export type SfxName =
  // UI
  | 'uiHover' | 'uiClick' | 'uiBack' | 'uiError' | 'uiConfirm'
  // cards
  | 'cardDraw' | 'cardSlide' | 'cardPlace' | 'cardSlam' | 'cardFlip' | 'cardSet' | 'shuffle'
  // flow
  | 'turnStart' | 'phaseChange' | 'yourMove' | 'passDevice'
  // summoning
  | 'summonCharge' | 'summonBurst' | 'materialize' | 'tribute' | 'cutIn' | 'roarBig' | 'roarSmall' | 'flipReveal'
  // combat
  | 'attackDeclare' | 'whoosh' | 'beamCharge' | 'beamFire' | 'slash' | 'bite' | 'impactLight' | 'impactHeavy'
  | 'shatter' | 'shieldBlock' | 'directHit'
  // LP
  | 'lpDown' | 'lpUp' | 'lpTick' | 'burn' | 'heal'
  // spells & traps
  | 'spellActivate' | 'trapActivate' | 'lightning' | 'chains' | 'mirror' | 'groundCrack' | 'fieldChange' | 'equip'
  | 'revive' | 'lockOn'
  // elements
  | 'fireBurst' | 'waterSplash' | 'windGust' | 'earthQuake' | 'darkPulse' | 'holyChime' | 'thunder'
  // results
  | 'victory' | 'defeat';

export interface SfxOpts {
  /** 0..1, default 1. */
  volume?: number;
  /** Playback-rate style pitch multiplier, default 1. */
  pitch?: number;
  /** -1 (left) .. 1 (right). */
  pan?: number;
}

export type MusicTrack = 'title' | 'duel' | 'victory';

export const sfx = {
  play(_name: SfxName, _opts?: SfxOpts): void {},
  /** Resume the AudioContext after a user gesture (browsers block autoplay). */
  unlock(): void {},
  setMuted(_m: boolean): void {},
  isMuted(): boolean {
    return false;
  },
};

export const music = {
  play(_track: MusicTrack): void {},
  stop(_fadeMs = 600): void {},
  /** 0..1 — raise during battles / low LP for a tenser mix. */
  setIntensity(_v: number): void {},
};
