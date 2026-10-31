// Neon Tower layer: FLOOR (slots / grid) — owner A1 (docs/v3/ARENA_NEON_TOWER.md §2, §7, §12).
// The slot art on the top plate: for every zone BoardViewCalm builds (LANES-aware, so 5+5 and 3+3 both get
// exactly the zones layout.ts says) one slot image — calm's 64×32 tile geometry in the owner's tones: a dim
// thin border (cyan1 / crimson1: BoardViewCalm's `base` line, which it steps up on hover / selection / flash),
// a faint glow ring outside it, the calm pad interior (kept, the stepped floor light reads it). The slot
// sits just above calm's own pad image (which stays underneath: zoneAt / tileImage / TargetMarks keep
// working on it) and under the stepped light (TILE + 0.5), the lit line masks and every highlight.
// The neutral centre strip is part of the platform body; this layer animates it: the emblem's two ring
// halves breathe on opposite phases, the dashes of the centre line carry a slow light run, all of it
// dark until the floodlights are on. In 3+3 the outer lane cells (grid cols 0 and 6) have no zone: they
// stay empty graphite, painted into the platform body.

import type Phaser from 'phaser';
import { FLOOR_FRAMES, NT_FLOOR_KEY, SLOT_DOWN, SLOT_EMPTY, SLOT_OCCUPIED, buildFloorArt } from '../../art/arena-nt/floor';
import { NT_PAL } from '../../art/arena-nt/palette';
import type { FloorArt } from '../../art/arena-nt/floor';
import { APRON_BOX, NT_APRON_FX_KEY, NT_APRON_KEY, buildApronArt, type ApronArt } from '../../art/arena-nt/apron';
import { calmZones } from '../board-calm/art';
import type { FieldView } from '../../duel/FieldView';
import type { GameEvent, PlayerId } from '../../engine/types';
import { type BoardSpot, zoneXY } from '../layout';
import { CENTER_EMBLEM, NT_DEPTH } from './layout-nt';
import { TEX } from '../../vfx/core';
import { type NtCtx, type NtLayer } from './layer';
import { ensureNtTexture } from './textures';

type Img = Phaser.GameObjects.Image;

/** Depth of the apron: above the wall's iso floor (9.95), below the wall band (10), the stands and the platform. */
const APRON_Z = 9.96;

/** Register the floor atlas (idempotent): slot frames, emblem levels, dash masks. Used by boot step 22 and the layer. */
export function registerFloorTextures(scene: Phaser.Scene): FloorArt {
  const art = buildFloorArt();
  ensureNtTexture(scene, 'floor', NT_FLOOR_KEY, () => art.atlas.canvas);
  const tex = scene.textures.get(NT_FLOOR_KEY);
  for (const [name, r] of art.atlas.frames) if (!tex.has(name)) tex.add(name, 0, r.x, r.y, r.w, r.h);
  registerApronTextures(scene);
  return art;
}

/** Register the apron (hall floor around the platform): the opaque floor texture and the fx atlas of its light strips (idempotent). */
export function registerApronTextures(scene: Phaser.Scene): ApronArt {
  const art = buildApronArt();
  ensureNtTexture(scene, 'apron', NT_APRON_KEY, () => art.canvas);
  ensureNtTexture(scene, 'apron-fx', NT_APRON_FX_KEY, () => art.fx.canvas);
  const tex = scene.textures.get(NT_APRON_FX_KEY);
  for (const [name, r] of art.fx.frames) if (!tex.has(name)) tex.add(name, 0, r.x, r.y, r.w, r.h);
  return art;
}

/** Ring level (0..2) of a half-emblem at phase u: dim, a rise, a held peak, a fall. */
function breath(u: number): number {
  const f = ((u % 1) + 1) % 1;
  return f < 0.3 ? 0 : f < 0.45 ? 1 : f < 0.75 ? 2 : f < 0.9 ? 1 : 0;
}

export function createFloorLayer(ctx: NtCtx): NtLayer {
  const scene = ctx.scene;
  const art = registerFloorTextures(scene);
  const apron = registerApronTextures(scene);
  // the hall floor around the platform: just above the wall's iso floor (9.95), below the wall band, stands and the platform
  ctx.add(scene.add.image(APRON_BOX.x, APRON_BOX.y, NT_APRON_KEY).setOrigin(0).setDepth(APRON_Z));
  // its light strips (one white mask per rail piece, tinted by a pulse that runs outward from the platform) and beacon lamps
  const railTones = [NT_PAL.blue, NT_PAL.red];
  const railImgs: Img[] = apron.strips.map((st) => ctx.add(scene.add.image(st.x, st.y, NT_APRON_FX_KEY, st.frame).setOrigin(0).setDepth(APRON_Z + 0.01).setVisible(false)));
  const lampImgs: Img[] = apron.lamps.map((l) => ctx.add(scene.add.image(l.x, l.y, TEX.px1).setOrigin(0).setScale(l.wide ? 2 : 1, 1).setDepth(APRON_Z + 0.02).setVisible(false)));

  // ---- the slots: one image per zone, three states (empty / occupied / face-down) read off the FieldView, the border one tone up
  // for the side to move and for a moment on a summon / attack of that side. The calm pad image stays underneath (zoneAt, tileImage,
  // TargetMarks, the stepped floor light) and calm's own hover / selection line and fill stay above.
  interface Slot {
    img: Img;
    player: PlayerId;
    spot: BoardSpot;
    index: number;
    pile: boolean;
    state: number;
    boost: number;
    shown: string;
  }
  const slots: Slot[] = calmZones().map((z) => {
    const c = zoneXY(z.player, z.spot, z.index);
    const pile = z.spot !== 'monster' && z.spot !== 'spellTrap';
    const shown = FLOOR_FRAMES.slot(z.player, pile);
    const img = ctx.add(scene.add.image(c.x - 32, c.y - 16, NT_FLOOR_KEY, shown).setOrigin(0).setDepth(NT_DEPTH.floor + 0.25));
    return { img, player: z.player, spot: z.spot, index: z.index, pile, state: SLOT_EMPTY, boost: 0, shown };
  });
  const fieldView = (): FieldView | null => (scene as unknown as { views?: { field?: FieldView } }).views?.field ?? null;
  /** The state of a zone right now. */
  const stateOf = (z: Slot, f: FieldView): number => {
    try {
      if (z.spot === 'deck' || z.spot === 'graveyard') return f.pile(z.player, z.spot).count > 0 ? SLOT_OCCUPIED : SLOT_EMPTY;
      if (z.spot === 'banish') return SLOT_EMPTY;
      const e = f.entry(z.player, z.spot, z.index);
      if (!e) return SLOT_EMPTY;
      return e.tile.faceUp ? SLOT_OCCUPIED : SLOT_DOWN;
    } catch {
      return SLOT_EMPTY;
    }
  };
  /** Until this time a side's slot borders show one tone up (a summon / attack declaration of that side). */
  const liftUntil: [number, number] = [0, 0];
  let nextScan = 0;

  // ---- the centre strip's life
  const emblem = ctx.add(scene.add.image(CENTER_EMBLEM.x, CENTER_EMBLEM.y, NT_FLOOR_KEY, FLOOR_FRAMES.emblem(0, 0)).setOrigin(0).setDepth(NT_DEPTH.floor + 0.1));
  const dashTones = [NT_PAL.metal[2], NT_PAL.metal[3], NT_PAL.metal[4]];
  const dashes: Img[] = art.dashes.map((d, k) =>
    ctx.add(scene.add.image(d.x, d.y, NT_FLOOR_KEY, FLOOR_FRAMES.dash(k)).setOrigin(0).setDepth(NT_DEPTH.floor + 0.1).setVisible(false)),
  );
  let lights = true;
  let onAt = 0;
  let active: PlayerId | null = null;
  let now = 0;
  let lastB = -1;
  let lastR = -1;
  let pending: { until: number; done: () => void } | null = null;

  return {
    name: 'floor',
    owner: 'A1',
    setActivePlayer(p) {
      active = p;
    },
    setLights(on, animate) {
      lights = on;
      if (pending) {
        pending.done();
        pending = null;
      }
      if (!on) return Promise.resolve();
      onAt = now + (animate ? 900 : 0);
      if (!animate) return Promise.resolve();
      return new Promise<void>((done) => {
        pending = { until: onAt + 100, done };
      });
    },
    onGameEvent(ev: GameEvent) {
      if (ev.type !== 'summon' && ev.type !== 'attackDeclare') return;
      const p = (ev as { player?: PlayerId }).player;
      if (p === undefined) return;
      liftUntil[p] = now + 900;
      nextScan = 0;
    },
    tick(_dt, t) {
      now = t;
      // slots: re-read the board a few times a second (the FieldView is the truth), one setFrame per change
      if (t >= nextScan) {
        nextScan = t + 120;
        const f = fieldView();
        const lit = lights && t >= onAt;
        for (const z of slots) {
          const st = lit && f ? stateOf(z, f) : SLOT_EMPTY;
          const bo = lit && (active === z.player || t < liftUntil[z.player]) ? 1 : 0;
          const name = FLOOR_FRAMES.slot(z.player, z.pile, st, bo);
          if (name !== z.shown) {
            z.img.setFrame(name);
            z.shown = name;
          }
        }
      }
      if (pending && t >= pending.until) {
        pending.done();
        pending = null;
      }
      const on = lights && t >= onAt;
      // emblem: the two halves breathe on opposite phases (a 4.8 s cycle); the active side's half rests one level up
      let b = on ? Math.max(breath(t / 4800), active === 0 ? 1 : 0) : 0;
      let r = on ? Math.max(breath(t / 4800 + 0.5), active === 1 ? 1 : 0) : 0;
      if (on && b === 0 && r === 0) b = 1;
      if (b !== lastB || r !== lastR) {
        emblem.setFrame(FLOOR_FRAMES.emblem(b, r));
        lastB = b;
        lastR = r;
      }
      // apron: a pulse runs outward along each rail (7.5 s lap, 3-tone head, the side to move one level up), the lamps blink
      apron.strips.forEach((st, i) => {
        const img = railImgs[i];
        if (!on) {
          img.setVisible(false);
          return;
        }
        const u = (((t / 7500 + st.rail * 0.21) * 9 - st.n) % 9 + 9) % 9;
        let level = u < 0.9 ? 3 : u < 1.9 ? 2 : u < 3 ? 1 : 0;
        if (active === st.side) level = Math.max(level, 1);
        img.setVisible(level > 0).setTint(railTones[st.side][1 + level]);
      });
      apron.lamps.forEach((l, i) => {
        const img = lampImgs[i];
        if (!on) {
          img.setVisible(false);
          return;
        }
        const f = (((t + l.phase) % l.period) + l.period) % l.period / l.period;
        img.setVisible(true).setTint(railTones[l.side][f < 0.18 ? 4 : f < 0.5 ? 2 : 1]);
      });
      // dashes: a light run along the centre line (7.2 s lap, 2-tone head)
      const n = dashes.length;
      dashes.forEach((d, k) => {
        if (!on) {
          d.setVisible(false);
          return;
        }
        const u = (t / 7200) * (n + 4) - k;
        const lv = ((u % (n + 4)) + (n + 4)) % (n + 4);
        const level = lv < 0.8 ? 3 : lv < 1.8 ? 2 : lv < 2.6 ? 1 : 0;
        d.setVisible(level > 0).setTint(dashTones[level - 1]);
      });
    },
    destroy() {
      if (pending) pending.done();
      pending = null;
    },
  };
}
