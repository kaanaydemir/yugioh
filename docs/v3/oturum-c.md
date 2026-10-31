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

## Kart durumu
| Kart | Durum | Kanıt | Açık konular |
|---|---|---|---|
| tide_harpooner | başladı | — | — |
| reed_heron | başladı | — | — |
| crag_axeman | başladı | — | — |
| kite_fencer | başladı | — | — |
| steppe_spiralhorn | başladı | — | — |
