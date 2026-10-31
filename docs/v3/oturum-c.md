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

## Kart durumu (WIP checkpoint, 2026-10-31 ~20:00 UTC)
Tüm kartların worktree'lerde commit'lenmiş hâli `claude/kart-c`'ye birleştirildi (typecheck temiz). Eleştiri turları henüz başlamadı.

| Kart | Durum | Sonraki adım |
|---|---|---|
| tide_harpooner | rig, anim, kart resmi, cut-in, sesler, recipe, saldırı/çağırma/ölüm/Körfez kalkanı sinematikleri, senaryolar (sunum checkpoint) | sunum builder'ı bitirmek → ≥3 eleştiri turu → kapılar |
| reed_heron | rig + kart resmi + sunum (sis çağırma, üçlü gaga 40/40/80, sis ölümü, sesler, rhr senaryoları) | ≥3 eleştiri turu → kapılar |
| crag_axeman | rig + anim + kart resmi (sunum yok) | sunum (yarık, dönüş+yarma, ikiye ayrılma, SFX) → turlar → kapılar |
| kite_fencer | rig + kart resmi + sunum (pike, uçurtma uçuşu 2. saldırı, yaprak çağırma, ölüm uçuşu, panel, sesler) | ≥3 eleştiri turu → kapılar |
| steppe_spiralhorn | rig + anim + ölüm finali + kart resmi (sunum yok) | sunum (sekmeler, tohum patlaması, flüt sesi) → turlar → kapılar |

Süreç: Workflow `kart-c-lane` (run wf_c8c99914-3bc) her kartı worktree'de sürdürüyor; her kart bitince birleştirme + kapılar + push.
