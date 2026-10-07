// Title showcase: monsters take turns materializing on the arena with the real summon set
// pieces. A card slams onto a monster tile, the attribute summon plays (big for aces), the
// monster idles, roars now and then, and eventually glitches out to make room for the next.
// Everything lives in world space (it drifts with the title camera).

import Phaser from 'phaser';
import { CARDS, MONSTER_IDS, isMonster, type Attribute, type MonsterId } from '../../data/cards';
import { monsterArt } from '../../art/monsters';
import { ATTRIBUTE_RAMP, PAL, PLAYER_COLOR, RAMPS } from '../../art/palette';
import { PixelCanvas, mulberry32 } from '../../art/pixel';
import { monsterAnimKey, monsterFrameName, monsterTextureKey } from '../../art/textures';
import type { MonsterAnim } from '../../art/types';
import { sfx, type SfxName } from '../../audio/sfx';
import type { PlayerId } from '../../engine/types';
import { DEPTH, unitDepth, zoneXY } from '../../view/layout';
import { TileCard } from '../../view/TileCard';
import { safe, tween, wait } from '../../vfx/core';
import {
  attackArrow,
  beam,
  bite,
  dive,
  framePointToWorld,
  impact,
  lightning,
  lockOn,
  lunge,
  projectile,
  vineWhip,
  xSlash,
} from '../../vfx/combat';
import { dematerialize, glitch } from '../../vfx/hologram';
import { shatter } from '../../vfx/shatter';
import { attributeSummon } from '../../vfx/summon';
import { cutIn } from '../../vfx/cutin';

interface Slot {
  player: PlayerId;
  idx: number;
}

interface Unit {
  id: MonsterId;
  slot: Slot;
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Image;
  card: TileCard | null;
  busy: boolean;
  born: number;
}

/** The opening line-up (ace first — it lands with the logo ignition). */
const OPENING: { id: MonsterId; slot: Slot }[] = [
  { id: 'crystal_wyrm', slot: { player: 0, idx: 1 } },
  { id: 'abyss_magus', slot: { player: 1, idx: 1 } },
  { id: 'ember_wolf', slot: { player: 0, idx: 0 } },
  { id: 'tide_golem', slot: { player: 1, idx: 2 } },
  { id: 'storm_hawk', slot: { player: 0, idx: 2 } },
  { id: 'shade_assassin', slot: { player: 1, idx: 0 } },
];

const SHADOW_KEY = (rx: number) => `title:shadow:${rx}`;

function shadowTex(scene: Phaser.Scene, rx: number): string {
  const key = SHADOW_KEY(rx);
  if (scene.textures.exists(key)) return key;
  const ry = Math.max(3, Math.round(rx / 2.4));
  const p = new PixelCanvas(rx * 2 + 1, ry * 2 + 1);
  for (let y = 0; y <= ry * 2; y++)
    for (let x = 0; x <= rx * 2; x++) {
      const d = Math.hypot((x - rx) / rx, (y - ry) / ry);
      if (d > 1) continue;
      const a = d < 0.55 ? 150 : d < 0.8 ? 105 : 60;
      if (d >= 0.8 && !PixelCanvas.ditherAt(x, y, 8)) continue;
      p.set(x, y, PAL.ink, a);
    }
  scene.textures.addCanvas(key, p.toCanvas());
  return key;
}

export interface ShowcaseOpts {
  seed?: number;
  /** Max monsters on the board at once (default 4). */
  max?: number;
  /** Seconds between arrivals (default 2.9). */
  period?: number;
  /** Volume multiplier for the showcase sounds (read every time; 0 = silent). */
  volume?: () => number;
  /** Whether ace arrivals may play the full-screen cut-in right now (read every time). */
  cutins?: () => boolean;
}

export class Showcase {
  readonly scene: Phaser.Scene;
  private readonly units: Unit[] = [];
  private readonly rnd: () => number;
  private readonly max: number;
  private readonly period: number;
  private readonly volume: () => number;
  private readonly cutins: () => boolean;
  private arrivals = 0;
  private running = false;
  private gen = 0;
  private queue: MonsterId[] = [];
  private openingIndex = 0;
  private actTimer: Phaser.Time.TimerEvent | null = null;
  private clashing = false;
  private summoning = false;
  private sinceClash = 0;
  /** Fired on every summon beat (e.g. to sync the logo). */
  onBeat: ((id: MonsterId, beat: string) => void) | null = null;

  constructor(scene: Phaser.Scene, opts: ShowcaseOpts = {}) {
    this.scene = scene;
    this.rnd = mulberry32(opts.seed ?? 4242);
    this.max = opts.max ?? 4;
    this.period = (opts.period ?? 2.9) * 1000;
    this.volume = opts.volume ?? (() => 1);
    this.cutins = opts.cutins ?? (() => false);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.stop());
  }

  get count(): number {
    return this.units.length;
  }

  /** Start the arrivals loop. */
  start(firstDelay = 0): void {
    if (this.running) return;
    this.running = true;
    const gen = ++this.gen;
    void this.loop(gen, firstDelay);
    this.actTimer = this.scene.time.addEvent({ delay: 2300, loop: true, callback: () => this.act() });
  }

  /** Stop arrivals (monsters stay). */
  stop(): void {
    this.running = false;
    this.gen++;
    this.actTimer?.remove(false);
    this.actTimer = null;
  }

  /** Stop and clear the board (monsters glitch out). */
  async clear(ms = 380): Promise<void> {
    this.stop();
    const all = [...this.units];
    await Promise.all(all.map((u, i) => wait(this.scene, i * 40).then(() => this.dismiss(u, ms, false))));
  }

  private async loop(gen: number, firstDelay: number): Promise<void> {
    const s = this.scene;
    await wait(s, firstDelay);
    while (this.running && gen === this.gen) {
      const t0 = s.time.now;
      if (this.units.length >= this.max) {
        const oldest = this.units.filter((u) => !u.busy).sort((a, b) => a.born - b.born)[0];
        if (oldest) await this.dismiss(oldest);
        await wait(s, 260);
      }
      // one focus at a time: let a running clash finish first
      while (this.clashing && this.running && gen === this.gen) await wait(s, 100);
      if (!this.running || gen !== this.gen) break;
      const next = this.pickNext();
      if (next) await this.summon(next.id, next.slot);
      const used = s.time.now - t0;
      await wait(s, Math.max(400, this.period - used));
    }
  }

  private pickNext(): { id: MonsterId; slot: Slot } | null {
    const free = this.freeSlots();
    if (free.length === 0) return null;
    const present = new Set(this.units.map((u) => u.id));
    if (this.openingIndex < OPENING.length) {
      const o = OPENING[this.openingIndex++];
      if (!present.has(o.id) && free.some((f) => f.player === o.slot.player && f.idx === o.slot.idx)) return o;
    }
    if (this.queue.length === 0) {
      this.queue = [...MONSTER_IDS];
      for (let i = this.queue.length - 1; i > 0; i--) {
        const j = Math.floor(this.rnd() * (i + 1));
        [this.queue[i], this.queue[j]] = [this.queue[j], this.queue[i]];
      }
    }
    let id = this.queue.shift()!;
    for (let k = 0; k < MONSTER_IDS.length && present.has(id); k++) {
      this.queue.push(id);
      id = this.queue.shift()!;
    }
    // balance the sides
    const p0 = this.units.filter((u) => u.slot.player === 0).length;
    const p1 = this.units.length - p0;
    const want: PlayerId = p0 <= p1 ? 0 : 1;
    const side = free.filter((f) => f.player === want);
    const pool = side.length ? side : free;
    const slot = pool[Math.floor(this.rnd() * pool.length)];
    return { id, slot };
  }

  private freeSlots(): Slot[] {
    const out: Slot[] = [];
    for (const player of [0, 1] as PlayerId[])
      for (let idx = 0; idx < 3; idx++) if (!this.units.some((u) => u.slot.player === player && u.slot.idx === idx)) out.push({ player, idx });
    return out;
  }

  private play(name: SfxName, volume: number, pitch = 1): void {
    const v = this.volume();
    if (v <= 0) return;
    sfx.play(name, { volume: volume * v, pitch });
  }

  /** Card slam + full attribute summon in a slot. */
  async summon(id: MonsterId, slot: Slot): Promise<void> {
    const s = this.scene;
    const def = CARDS[id];
    if (!isMonster(def)) return;
    const art = monsterArt(id);
    const at = zoneXY(slot.player, 'monster', slot.idx);
    const flip = slot.player === 1;
    const sprite = s.add.sprite(at.x, at.y - art.hover, monsterTextureKey(id), monsterFrameName('idle', 0));
    sprite.setOrigin((flip ? art.w - art.anchorX : art.anchorX) / art.w, art.anchorY / art.h).setFlipX(flip).setDepth(unitDepth(at.y));
    sprite.setVisible(false);
    const rx = Math.max(9, Math.min(24, Math.round(art.w * (art.hover > 0 ? 0.2 : 0.27))));
    const shadow = s.add.image(at.x, at.y + 1, shadowTex(s, rx)).setDepth(DEPTH.SHADOW).setAlpha(0);
    const unit: Unit = { id, slot, sprite, shadow, card: null, busy: true, born: s.time.now };
    this.units.push(unit);
    this.summoning = true;
    try {
      await this.summonInto(unit, at, flip);
    } finally {
      this.summoning = false;
    }
  }

  private async summonInto(unit: Unit, at: { x: number; y: number }, flip: boolean): Promise<void> {
    const s = this.scene;
    const { id, slot, sprite, shadow } = unit;
    const def = CARDS[id];
    if (!isMonster(def)) return;
    const art = monsterArt(id);

    // the card drops out of the sky and slams onto the tile
    let card: TileCard | null = null;
    try {
      card = new TileCard(s, slot.player, 'monster', slot.idx, id, true, 'up');
      unit.card = card;
      card.setVisible(false);
      const from = { x: at.x + (flip ? 40 : -40), y: at.y - 150 };
      card.setVisible(true);
      this.play('cardSlide', 0.35);
      await card.slamIn(from, 360, { arc: 26, trail: true, impact: true });
      this.play('cardSlam', 0.4);
    } catch (e) {
      console.warn('[title] TileCard unavailable', e);
    }

    const big = def.ace;
    this.arrivals++;
    // an ace's full-screen cut-in (not for the opening arrival — that moment belongs to the logo)
    if (big && this.arrivals > 1 && this.cutins() && this.running) {
      this.play('cutIn', 0.5);
      await safe(cutIn(s, { monsterId: id, name: def.name, attribute: def.attribute, player: slot.player }));
    }
    await safe(
      attributeSummon(s, {
        x: at.x,
        y: at.y,
        attribute: def.attribute,
        player: slot.player,
        sprite,
        monsterId: id,
        big,
        onBeat: (b) => {
          this.onBeat?.(id, b);
          if (b === 'circle') this.play('summonCharge', 0.3);
          if (b === 'pillar') this.play('summonBurst', 0.35);
          if (b === 'reveal') {
            this.play('materialize', 0.35);
            void tween(s, { targets: shadow, alpha: art.hover > 0 ? 0.6 : 1, duration: 300 });
          }
          if (b === 'roar') this.play(big || def.level >= 5 ? 'roarBig' : 'roarSmall', 0.35);
          if (b === 'impact') this.play(big ? 'impactHeavy' : 'impactLight', 0.3);
        },
      }),
    );
    unit.busy = false;
    unit.born = s.time.now;
  }

  /** Glitch out and remove a unit. */
  async dismiss(u: Unit, ms = 520, glitchFirst = true): Promise<void> {
    const i = this.units.indexOf(u);
    if (i < 0) return;
    u.busy = true;
    const s = this.scene;
    const def = CARDS[u.id];
    const attribute: Attribute = isMonster(def) ? def.attribute : 'LIGHT';
    this.play('darkPulse', 0.18, 1.4);
    if (glitchFirst) await safe(glitch(s, u.sprite, 160, 1, { attribute }));
    void tween(s, { targets: u.shadow, alpha: 0, duration: ms });
    const cardOut = u.card ? safe(u.card.dissolve(ms + 120)) : Promise.resolve();
    await safe(dematerialize(s, u.sprite, ms, { attribute }));
    await cardOut;
    u.sprite.destroy();
    u.shadow.destroy();
    u.card?.destroy();
    const j = this.units.indexOf(u);
    if (j >= 0) this.units.splice(j, 1);
  }

  /** Idle life: now and then a monster roars, swings, or attacks across the board. */
  private act(): void {
    if (!this.running || this.clashing) return;
    const idle = this.units.filter((u) => !u.busy && u.sprite.visible);
    if (idle.length === 0) return;
    const p0 = idle.filter((u) => u.slot.player === 0);
    const p1 = idle.filter((u) => u.slot.player === 1);
    this.sinceClash++;
    if (!this.summoning && p0.length && p1.length && this.sinceClash >= 3 && this.rnd() < 0.55) {
      this.sinceClash = 0;
      const side = this.rnd() < 0.5 ? 0 : 1;
      const atk = (side === 0 ? p0 : p1)[Math.floor(this.rnd() * (side === 0 ? p0 : p1).length)];
      const defs = side === 0 ? p1 : p0;
      const def = defs[Math.floor(this.rnd() * defs.length)];
      void this.clash(atk, def);
      return;
    }
    if (this.rnd() < 0.3) return;
    const u = idle[Math.floor(this.rnd() * idle.length)];
    const anim: MonsterAnim = this.rnd() < 0.6 ? 'roar' : 'attack';
    this.playOnce(u, anim);
    if (anim === 'roar') this.play('roarSmall', 0.18, 0.9 + this.rnd() * 0.3);
  }

  /**
   * A showcase battle: declare (arrow + lock-on), the attacker's signature-style strike synced
   * to its attack impact frame, the impact, and — if the attacker's ATK is higher — the target
   * shatters into its own pixels and its slot frees up for the next arrival.
   */
  async clash(a: Unit, b: Unit): Promise<void> {
    const s = this.scene;
    const da = CARDS[a.id];
    const db = CARDS[b.id];
    if (!isMonster(da) || !isMonster(db)) return;
    this.clashing = true;
    a.busy = true;
    b.busy = true;
    const gen = this.gen;
    try {
      const artA = monsterArt(a.id);
      const artB = monsterArt(b.id);
      const ramp = ATTRIBUTE_RAMP[da.attribute];
      const tc = () => framePointToWorld(b.sprite, artB.core.x, artB.core.y);
      const ac = framePointToWorld(a.sprite, artA.core.x, artA.core.y);
      const floorB = zoneXY(b.slot.player, 'monster', b.slot.idx);
      const floorA = zoneXY(a.slot.player, 'monster', a.slot.idx);
      // declare
      const t0 = tc();
      const arrow = attackArrow(s, ac, t0, a.slot.player);
      const lock = lockOn(s, t0.x, t0.y, { color: PLAYER_COLOR[a.slot.player], size: 26 });
      this.play('attackDeclare', 0.3);
      await wait(s, 520);
      arrow.destroy();
      lock.destroy();
      if (!a.sprite.active || !b.sprite.active) return;

      let landed = false;
      const hit = (power: 1 | 2 | 3 = 2) => {
        if (landed || !b.sprite.active) return;
        landed = true;
        const c = tc();
        void impact(s, c.x, c.y, { power, sprite: b.sprite, ramp });
        this.playOnce(b, 'hit', true);
      };
      const spec = artA.anims.attack;
      const impactMs = (artA.attackImpactFrame / spec.fps) * 1000;
      const muzzle = () => framePointToWorld(a.sprite, artA.muzzle.x, artA.muzzle.y);
      const attack = () => this.playOnce(a, 'attack', true);

      switch (a.id) {
        case 'crystal_wyrm':
        case 'coral_serpent':
          attack();
          this.play('beamCharge', 0.25);
          await wait(s, impactMs - 60);
          await safe(beam(s, muzzle(), tc(), a.id === 'crystal_wyrm' ? 'prism' : 'water', { chargeMs: 60, fireMs: 340, onImpact: () => hit(a.id === 'crystal_wyrm' ? 3 : 2) }));
          break;
        case 'abyss_magus':
          attack();
          await wait(s, impactMs - 40);
          await safe(projectile(s, muzzle(), tc(), 'darkOrb', { chargeMs: 60, onImpact: () => hit() }));
          break;
        case 'lumen_sprite':
          attack();
          await wait(s, impactMs);
          await safe(projectile(s, muzzle(), tc(), 'spark', { chargeMs: 40, onImpact: () => hit(1) }));
          break;
        case 'stone_sentinel':
          attack();
          await wait(s, impactMs);
          await safe(projectile(s, muzzle(), tc(), 'boulder', { chargeMs: 0, onImpact: () => hit() }));
          break;
        case 'tide_golem':
          attack();
          await wait(s, impactMs);
          await safe(projectile(s, floorA, floorB, 'wave', { onImpact: () => hit() }));
          break;
        case 'volt_lizard':
          attack();
          await wait(s, impactMs);
          this.play('lightning', 0.3);
          await safe(lightning(s, muzzle(), tc(), { ramp: RAMPS.cyan, onImpact: () => hit() }));
          break;
        case 'thorn_lurker':
          attack();
          await wait(s, impactMs - 120);
          await safe(vineWhip(s, floorA, tc(), { onImpact: () => hit() }));
          break;
        case 'storm_hawk':
          a.sprite.play(monsterAnimKey(a.id, 'attack'));
          await safe(dive(s, a.sprite, tc(), { onImpact: () => hit(), ramp: RAMPS.leaf }));
          a.sprite.play(monsterAnimKey(a.id, 'idle'));
          break;
        default: {
          // melee rush timed so contact lands on the attack impact frame
          attack();
          const dash = 120;
          await safe(
            lunge(s, a.sprite, floorB, {
              anticipation: Math.max(80, impactMs - dash),
              ms: dash,
              trail: a.id === 'shade_assassin' ? PAL.void3 : PAL.fire3,
              onDash: () => {
                if (a.id === 'ember_wolf') {
                  const c = tc();
                  void bite(s, c.x, c.y, PAL.fire3, { snapAt: dash });
                }
              },
              onImpact: () => {
                const c = tc();
                if (a.id === 'shade_assassin') void xSlash(s, c.x, c.y, { ramp: RAMPS.void });
                hit(a.id === 'magma_titan' ? 3 : 2);
              },
            }),
          );
        }
      }
      hit();
      await wait(s, 200);
      // outcome: a higher ATK destroys the target (showcase rules: both in attack position)
      if (da.atk > db.atk && b.sprite.active && gen === this.gen && this.running) {
        const i = this.units.indexOf(b);
        if (i >= 0) {
          this.play('shatter', 0.35);
          const dir = { x: floorB.x - floorA.x, y: floorB.y - floorA.y };
          await safe(shatter(s, b.sprite, { monsterId: b.id, attribute: db.attribute, push: dir }));
          void tween(s, { targets: b.shadow, alpha: 0, duration: 200 });
          const card = b.card;
          if (card) void safe(card.dissolve(500)).then(() => card.destroy());
          b.sprite.destroy();
          b.shadow.destroy();
          const j = this.units.indexOf(b);
          if (j >= 0) this.units.splice(j, 1);
        }
      }
    } finally {
      this.clashing = false;
      if (a.sprite.active) a.busy = false;
      if (b.sprite.active) b.busy = false;
    }
  }

  private playOnce(u: Unit, anim: MonsterAnim, keepBusy = false): void {
    const key = monsterAnimKey(u.id, anim);
    if (!this.scene.anims.exists(key)) return;
    u.busy = true;
    u.sprite.play(key);
    u.sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      if (!u.sprite.active) return;
      u.sprite.play(monsterAnimKey(u.id, 'idle'));
      if (!keepBusy) u.busy = false;
    });
  }
}
