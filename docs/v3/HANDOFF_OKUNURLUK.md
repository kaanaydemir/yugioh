# Handoff: readability / colour pass (for an outside AI agent, e.g. Gemini)

> TR özet: Bu dosya, haftalık sıfırlamaya (Perş. 2026-11-05 23:00 TR) kadar başka bir yapay zekânın
> "okunurluk / renk" işini yapabilmesi için yazıldı. Ayrı dalda çalışır; ana dala ve şerit dallarına dokunmaz.
> Sıfırlamadan sonra Claude işi inceler, kontrollerden geçirir ve ana dala alır.

## Branch rules (important)
- Work ONLY on branch **`gemini/okunurluk`**, created from `claude/yugioh-card-game-tgi7td`.
  `git fetch origin && git checkout -b gemini/okunurluk origin/claude/yugioh-card-game-tgi7td`
- Commit small steps with clear messages; push to `origin gemini/okunurluk` often.
- NEVER push to `claude/yugioh-card-game-tgi7td` or any `claude/kart-*` branch. Do not open pull requests.
- Do NOT merge other branches into yours. Claude will merge your branch later.

## Read first
- `CLAUDE.md` (rules: 640×360 pixel art, integer scaling, colours only from `src/art/palette.ts`,
  positions only via `src/view/layout.ts`, camera never changes).
- `docs/YOL_HARITASI.md` (latest owner decisions at the bottom).

## Goal
Make the duel screen read clearly at a glance, matching the owner-approved target image
**`docs/v3/ref/hedef-gorunum-2.png`** (made from the current screen `docs/v3/ref/simdiki-gorunum-1.png`).
The owner especially LOVED THE FOG — keep and animate it.

Change ONLY these (all for the default `v3` look):
1. Background (stands, machines, walls, floor around the platform): darker, lower contrast, less
   saturated, less detail; layered slowly drifting fog toward the edges; a few small warm torch lights
   that flicker.
2. The two hologram statues: keep them, much dimmer / more transparent (sit inside the fog).
3. Board floor: calm smooth dark slate with subtle texture; thinner, softer grid lines; cyan (P1) and
   red (P2) tile borders kept but with less glow.
4. Lighting: one warm key light from the top-left; soft contact shadow under every unit; faint light
   pool at each unit's feet; subtle top-left rim on units — via the light layer, NOT by editing sprites.
5. HUD panels/buttons: same position, size and text; slimmer frames, much less neon glow.

## Do NOT touch
- Monster / unit sprites and their art files (`src/art/monsters*`, `src/art/rigkit`, `src/art/materials`),
  cut-ins, card art, cinematics (`src/cinematics/**`), audio (`src/audio/**`), engine (`src/engine/**`),
  card data (`src/data/**`). Units must look identical.
- Camera, layout positions, screen resolution.
- The old `v1` look: it must stay pixel-identical (gates below).

## Where the arena lives (start here)
- Arena textures: `src/art/arena-nt/**`, boot steps `src/boot/21-arena-nt-platform.ts` …
  `src/boot/31-arena-nt-lights.ts` (floor 22, wall 23, stands 24, crowd 26, screens 27, holograms 28, pads 29, lights 31).
- Arena runtime view: `src/view/board-nt/**` (also `src/view/board-calm/**`).
- Light layer: `src/view/light/**` (profiles, pools, halos).
- HUD v3: `src/view/v3/**` (hudSkin, hudV3), `src/view/HudView.ts`, `src/view/Button.ts`.

## Tools / how to check your work
- `npm install` once. `npm run typecheck` must be clean.
- Screenshot the duel: `node tools/shot.mjs "?dev=duel&s=a6Hover&look=v3" --out shots/ok/<name>.png`
  (headless Chromium + Playwright). LOOK at every PNG you produce.
- Filmstrip for motion (fog/torches): add `--film 12 --every 120 --cols 4`.
- Gates before every push:
  - `npm run typecheck` clean.
  - `npx vitest run` — no NEW failures (known: cardface-v3 G1, dusk_ashen, hourglass_imp, shield_titan,
    crag_axeman "own voice"; cloud_hatchling "no cyan" may time out under load).
  - v1 unchanged: `node tools/filmdiff.mjs --set v1 --base shots/v3/a3/baseline/v1films` → 17/17 IDENTICAL,
    `node tools/filmdiff.mjs --set a6v1 --base shots/v3/a56/baseline/a6v1films` → 26/26 IDENTICAL.
  - Colours only from palette: `node tools/palcheck.mjs`.
- Keep a log in `docs/v3/oturum-okunurluk.md`: what you changed, before/after screenshot paths, open issues.

## Done = 
A before/after pair (`docs/v3/ref/okunurluk-oncesi.png`, `docs/v3/ref/okunurluk-sonrasi.png`) that looks
like the target, all gates green, everything pushed to `gemini/okunurluk`.
