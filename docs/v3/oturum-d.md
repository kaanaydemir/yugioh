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
| polar_needle | bekliyor | | |
| polar_anvil | bekliyor | | |
| polar_coil | bekliyor | | |
| polar_sovereign | bekliyor | | |
| dial_jester | bekliyor | | |
| reflection_archer | bekliyor | | |
| scrap_raiders | bekliyor | | |
| straw_decoy_token | bekliyor | | |

## Günlük
