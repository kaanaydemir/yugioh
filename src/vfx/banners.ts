import type Phaser from 'phaser';
import type { Phase, PlayerId } from '../engine/types';
export type BannerStyle = 'turn' | 'phase' | 'trap' | 'spell' | 'big';
export interface BannerOpts { style?: BannerStyle; color?: number; sub?: string }
export async function banner(scene: Phaser.Scene, text: string, o: BannerOpts = {}): Promise<void> {}
export async function turnBanner(scene: Phaser.Scene, player: PlayerId, turn: number): Promise<void> {}
export async function phaseBanner(scene: Phaser.Scene, phase: Phase): Promise<void> {}
export async function trapBanner(scene: Phaser.Scene): Promise<void> {}
export async function duelStart(scene: Phaser.Scene): Promise<void> {}
export async function victory(scene: Phaser.Scene, player: PlayerId, o: { hold?: number } = {}): Promise<void> {}
