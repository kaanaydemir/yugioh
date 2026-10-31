# Oturum D (lane D) — durum

Dal: `claude/kart-d` (başlangıç 6178b55 + 684e290). Brif: `docs/v3/PARALEL_OTURUMLAR.md`.
Kartlar: `dial_jester` (C2 + yazı-tura + bildi/bilemedi silme), `reflection_archer` (C4), `scrap_raiders` (C5),
`polar_needle` / `polar_anvil` / `polar_coil` (C12–C14), `polar_sovereign` (C15 + birleşme + ayrılma),
`straw_decoy_token` (jeton sprite + yok oluş).

Yapım el kitabı (bu hattın ajanları için): `docs/v3/oturum-d-rehber.md`.
Kanıtlar: `shots/v3/d/<kart>/`.

## Ortam notu
- Bu konteynerde Playwright Chromium `chrome-linux64` altında; araçların `chromePath()` `chrome-linux` arıyor.
  Çözüm (repo dışı): `ln -s /opt/pw-browsers/chromium-1243/chrome-linux64 /opt/pw-browsers/chromium-1243/chrome-linux`.
- Başlangıç kapıları: `npm run typecheck` temiz; `npm test` 4 bilinen hata (dusk_ashen, hourglass_imp, shield_titan,
  cardface-v3 G1 = scrap_raiders).

## Kart durumu
| Kart | Durum | Kanıt | Açık konular |
|---|---|---|---|
| polar_needle | yapım + eleştiri turları sürüyor (WIP) | shots/v3/d/polar_needle/ (git dışı) | kapılar henüz koşmadı |
| polar_anvil | yapım + eleştiri turları sürüyor (WIP) | shots/v3/d/polar_anvil/ (git dışı) | kapılar henüz koşmadı |
| polar_coil | yapım + eleştiri turları sürüyor (WIP) | shots/v3/d/polar_coil/ (git dışı) | kapılar henüz koşmadı |
| polar_sovereign | bekliyor (üç parça bitince başlar) | | |
| dial_jester | yapım sürüyor (WIP: rig + kart görseli var) | shots/v3/d/dial_jester/ (git dışı) | sinematik/SFX tamamlanmadı |
| reflection_archer | yapım sürüyor (WIP: rig + kart görseli var) | shots/v3/d/reflection_archer/ (git dışı) | sinematik/SFX tamamlanmadı |
| scrap_raiders | yapım sürüyor (WIP: rig + kart görseli var) | shots/v3/d/scrap_raiders/ (git dışı) | sinematik/SFX tamamlanmadı |
| straw_decoy_token | yapım sürüyor (WIP: rig + kart görseli var) | shots/v3/d/straw_decoy_token/ (git dışı) | sinematik/SFX tamamlanmadı |

## Günlük

- 2026-10-31 WIP kontrol noktası (orkestratör isteği: kullanım limiti yaklaşıyor). Workflow `wf_ec97f149-c20` sürüyor:
  el kitabı `docs/v3/oturum-d-rehber.md` yazıldı; yedi kartın rig + kart görseli + art testleri, polar parçalarının ve
  dial_jester'ın sinematik/SFX'i kısmen hazır. `npm run typecheck` temiz. Kapılar (filmdiff, camera-gate, palcheck) bu
  noktada koşulmadı — WIP.
  Sırada: kalan kartların sinematik + SFX yapımı, her kart için 3 eleştiri/düzeltme turu, adversarial kapı doğrulaması,
  kart başı commit; ardından polar_sovereign (birleşme + ayrılma). Duraklarsa: workflow aynı scriptPath ile
  `resumeFromRunId: wf_ec97f149-c20` ile sürdürülür.
  Bilinen konu (coil ajanı): kill senaryolarında ölüm kitinin ilk sesi atlanıyor (tepki ölüm animasyonunu önce başlatıyor);
  coil kendi ölüm kancasından çalarak aştı; anvil/needle için de bakılacak.
