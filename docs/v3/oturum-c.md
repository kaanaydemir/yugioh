# Oturum C (lane C) — durum

Branch: `claude/kart-c` · Kartlar: tide_harpooner (C1), reed_heron (C8), crag_axeman (C7), kite_fencer (C9), steppe_spiralhorn (C11).

## Yöntem
- Her kart kendi git worktree'sinde (`/home/user/wt/<id>`, branch `kartc/<id>`) yapılır; bitince `claude/kart-c`'ye
  birleştirilip push edilir. Paylaşılan dosyalarda yalnız tek satırlık eklemeler.
- Mimari haritası: `docs/v3/oturum-c-mimari.md`. Ayrışma/tasarım kutsal kitabı: `docs/v3/oturum-c-tasarim.md`.
- Her kart: sanat rig'i → sunum (sinematik + SFX) → en az 3 bağımsız film-bak-eleştir-düzelt turu → çekişmeli kapı doğrulaması → birleştirme.
- Kapılar: typecheck, test (bilinen 3 hata dışında yeni hata yok), filmdiff v1 17/17 + a6v1 26/26 IDENTICAL,
  measure --camera-gate, palcheck. Taban çizgileri 684e290'dan (`shots/` git'e girmez).

## Ortam notu
- playwright-core 1.56.1 tarayıcı revizyonu 1194 ister; ortamda 1243 var. `/opt/pw-browsers/chromium*-1194` symlink'leri eklendi.

## Kart durumu (2026-11-05 devam — haftalık sıfırlamadan sonra; main birleştirildi, kapı tabanları `shots/v3/main2/` main ucundan)

Bilinen vitest hataları (bizim değil): arena-nt-platform ×2, cardface-v3 G1, dusk_ashen, hourglass_imp, shield_titan, board-nt-layout dais.

| Kart | Durum | Kalan iş |
|---|---|---|
| tide_harpooner | **BİTTİ** (67baa70). 3 eleştiri turu (r1–r3 hepsi "fail" + her turdan sonra düzeltme; r3: 0 blocker, 3 major, 13 minor → hepsi düzeltildi, 2'si kısmen). Kapılar: typecheck temiz; test yalnız bilinen hatalar; monster-gates `--class ace --ref none` 21 ok / 0 FAIL (`--class large` bayt ve v1-yer-tutucu-ref satırlarında düşer: kart as ★); filmdiff v1 17/17 + a6v1 26/26 IDENTICAL; camera gate 15 ok + 21 NOBASE ok, 0 FAIL; palcheck thpAttack FAIL ama referans as `saWyrmAtk` aynı renklerle (cyan0/crim0/void2, tahta+ortak kit) ve daha yüksek beyazla düşüyor — kart kaynaklı değil | r3 düzeltmeleri yeniden eleştirilmedi (bilinçli: tasarruf). |
| kite_fencer | **BİTTİ** (2026-11-05). 3 eleştiri turu + r3 düzeltmeleri (4 major hepsi, 5 minor: 3 tam, 2 kısmen): seviyeli yanal 2. saldırı kesiği, hedef silüetinden yönlenen geçiş/süzülüş, ölümde gergin/kopma vuruşu, kfnCut/KiteDrift/Swing yeniden seslendirildi. Kapılar: typecheck temiz; vitest yalnız bilinen; monster-gates `--class small --ref none` 0 FAIL; filmdiff v1 17/17 + a6v1 26/26 IDENTICAL (main2 tabanı); camera gate 0 FAIL; palcheck referans saWyrmAtk ile aynı (pist renkleri) | — |
| reed_heron | **BİTTİ** (2026-11-05). 3 eleştiri turu + r3 düzeltmeleri: temas ışığı zeminde damga bırakmıyor, üçüncü TAK'ta yanan yıldız, mesafeyle büyüyen süzülme süresi, öne eğik kanat-yelpaze kükremesi (MOT crag_axeman 0.835→0.31). Kapılar: typecheck temiz; vitest yalnız bilinen; monster-gates `--class medium --ref none` 0 FAIL; filmdiff v1 17/17 + a6v1 26/26 IDENTICAL; camera gate 0 FAIL | — |
| crag_axeman | sunum tam; r1 eleştirisi yapıldı; ses testi düzeltildi (8177bcf). **Devam ediyor** (workflow kart-c-finish-2): r1 düzeltmesi → r2, r3 eleştiri+düzeltme → kapılar | — |
| steppe_spiralhorn | sunum tam; r1 eleştirisi yapıldı. **Devam ediyor** (workflow kart-c-finish-2): r1 düzeltmesi → r2, r3 → kapılar | — |

## Devam talimatı (haftalık sıfırlamadan sonra)
1. Taze bir oturumda `claude/kart-c`'yi çek. `npm ci`. Tarayıcı: playwright-core 1.56.1 revizyon 1194 ister; ortamda yoksa
   `/opt/pw-browsers/chromium-1194/chrome-linux -> ../chromium-1243/chrome-linux64` ve
   `/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux -> ../chromium_headless_shell-1243/chrome-headless-shell-linux64`
   symlink'leri + `.../chrome-headless-shell-linux64/headless_shell -> chrome-headless-shell` + her iki 1194 dizinine `INSTALLATION_COMPLETE`.
2. Kapı taban çizgileri `shots/` altında git'e girmez: 684e290'dan yeniden üret (temiz bir worktree'de):
   `node tools/filmdiff.mjs --set v1 --base shots/v3/a3/baseline/v1films --write --jobs 3`,
   `node tools/filmdiff.mjs --set a6v1 --base shots/v3/a56/baseline/a6v1films --write --jobs 3`,
   `node tools/measure.mjs --scenarios baseline --look v3 --jobs 3 --norender --out shots/v3/kartc/camera-base.json`.
3. Öncelik sırası: kite_fencer → reed_heron (her biri: bulgu dosyasını uygula, film-bak doğrula, kapılar, "finished" commit + push) →
   crag_axeman → steppe_spiralhorn (r2 ve r3 bağımsız eleştiri + düzeltme, sonra kapılar).
4. Komutlar: `docs/v3/oturum-c-mimari.md` §8 (gates), tasarım: `docs/v3/oturum-c-tasarim.md`. Kart başına senaryo önekleri:
   thp (Zıpkıncı), rhr (Balıkçıl), cax (Baltacı), kfn (Eskrimci), ssh (Boynuzlu). monster-gates'e `--class` ver (as: ace, 64: medium, 48: small).
5. `tests/presentation/outcomes.test.ts` recipe sayısı artık alt sınır (≥3); her yeni recipe ekler.
