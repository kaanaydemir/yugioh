# Yeni kartlar v3 — 27 yeni kart + 3 yeniden tasarım (tasarım belgesi, rev. 2)

> Durum: **tasarım** (kod yok). Kaynak: sahibin 18 maddelik listesi (`docs/YOL_HARITASI.md`, madde 5–16).
> Bu belge, başka bir yapay zekâ ya da geliştirici işi kaldığı yerden sürdürebilsin diye yazıldı.
> **Altın kural (CLAUDE.md):** her çağırma, saldırı, ölüm ve özel yetenek kart başına UNIQUE, çarpıcı, akıcı ve akılda kalıcıdır;
> SFX en az VFX kadar iyidir. Ortak sunum yalnızca iskelettir (kart açılışı, hasar sayısı); her kartın imza anı kendinedir.
> **Özgünlük:** Yu-Gi-Oh kartları yalnızca *rol* referansıdır. Ad, resim, metin, stat satırı ve tasarımın ana öğesi bizimdir:
> hiçbir ad orijinal adın çevirisi değildir, hiçbir stat satırı birebir değildir, her kartta referansın en tanınır öğesi kırılmıştır.
> Kimlikler İngilizce `snake_case` (kart); etki kimlikleri mevcut kurala uyar: `camelCase` (`src/data/cards.ts`).
> Süreler **1x** içindir ve 3. madde ("animasyonlar çok hızlı") gereği bugünkü v3 bütçelerinden ~%25 uzundur; genel tempo çarpanı gelirse onunla ölçeklenir.
> Renkler yalnız `src/art/palette.ts` rampalarından: `night cyan crim gold mag teal fire water earth leaf void stone skin` + `PAL.steel/mist/white/ink`.
> `cyan`/`crim` oyuncu rengi, `teal` büyü, `mag` tuzak dilidir: canavar gövdelerinde kullanılmaz (yalnız vurgu).
> **Yazım (UI):** "rüzgar" / "RÜZGAR" şapkasız yazılır (öznitelik etiketiyle aynı). Saha büyüsü için terim her yerde **"alan büyüsü"**.

**Rev. 2 değişiklikleri (inceleme bulguları):** S1, S3, S5, S7, S9, S11, C4, C6, C8, C9, C11, C12–C14 yeniden adlandırıldı / yeniden tasarlandı;
tüm referans stat satırları kaydırıldı; Zıpkıncı kilidi, Eskrimci tek-tur öldürmesi, Soytarı sınırı, Korkuluk kendini kilitleme, Balta ve çekme motorları dengelendi;
ölüm "son malzemeleri", girişler, ses kimlikleri ayrıştırıldı; motor kenar durumları (hızlı büyü zinciri, birleşme, jeton kimliği, diriliş) yazıldı.

---

## 0. Özet tablolar

### 0.1 Yeni canavarlar (15)

| # | id | Türkçe ad | English | Element / Tür | Sv | ATK/DEF | Etki kimliği | Boy | As | Rol referansı |
|---|---|---|---|---|---|---|---|---|---|---|
| C1 | `tide_harpooner` | Kabuk Zıpkıncı | Conch Harpooner | SU / Su | 5 | 1700/1500 | `tidalBayShroud` | 80 | ★ | The Legendary Fisherman |
| C2 | `dial_jester` | Kadran Soytarısı | Dial Jester | IŞIK / Büyücü | 2 | 700/300 | `coinWipe` | 48 | | Time Wizard |
| C3 | `cloud_hatchling` | Bulut Yavrusu | Cloud Hatchling | RÜZGAR / Ejderha | 3 | 1100/900 | `jesterAging` | 48 | | Baby Dragon |
| C4 | `reflection_archer` | Yansıyan Okçu | Reflected Archer | IŞIK / Büyücü | 4 | 1800/1000 | `none` | 64 | | Gemini Elf |
| C5 | `scrap_raiders` | Hurda Akıncıları | Scrap Raiders | ATEŞ / Savaşçı | 4 | 2000/0 | `attackThenDefense` | 64 | | Goblin Attack Force |
| C6 | `hollow_ogre` | Kovuk Devi | Hollow Ogre | TOPRAK / Canavar-Savaşçı | 4 | 1400/900 | `banishGraveBoost400` | 64 | | Bazoo the Soul-Eater |
| C7 | `crag_axeman` | Kaya Baltacı | Crag Axeman | TOPRAK / Savaşçı | 4 | 1600/1300 | `none` | 64 | | Axe Raider |
| C8 | `reed_heron` | Sazlık Balıkçılı | Reedwater Heron | SU / Kanatlı Canavar | 4 | 1400/1500 | `none` | 64 | | Alligator's Sword |
| C9 | `kite_fencer` | Uçurtma Eskrimci | Kite Fencer | RÜZGAR / Savaşçı | 3 | 900/600 | `doubleAttackMonster` | 48 | | Hayabusa Knight |
| C10 | `mudgrasp_spirit` | Çamur Pençe Ruhu | Mudgrasp Spirit | TOPRAK / Şeytan | 4 | 700/1800 | `defenseAttackedPin` | 64 | | Earthbound Spirit |
| C11 | `steppe_spiralhorn` | Bozkır Boynuzlusu | Steppe Spiralhorn | RÜZGAR / Canavar | 4 | 1500/1400 | `none` | 64 | | Gazelle the King of Mythical Beasts |
| C12 | `polar_needle` | Kutup İğnesi | Pole Needle | TOPRAK / Kaya | 4 | 1500/1100 | `magnetPiece` | 64 | | Alpha the Magnet Warrior |
| C13 | `polar_anvil` | Kutup Örsü | Pole Anvil | TOPRAK / Kaya | 4 | 1100/1700 | `magnetPiece` | 64 | | Beta the Magnet Warrior |
| C14 | `polar_coil` | Kutup Bobini | Pole Coil | TOPRAK / Kaya | 4 | 1300/1400 | `magnetPiece` | 64 | | Gamma the Magnet Warrior |
| C15 | `polar_sovereign` | Kutup Hükümdarı | Pole Sovereign | TOPRAK / Kaya | 8 | 3000/2800 | `magnetFusion` | 96 | ★ | Valkyrion (birleşik) |

**Sv4 vanilla dengesi (hiçbiri bir başkasına baskın değil — Pareto sınırı):** Gölge Suikastçı 1900/400 · Yansıyan Okçu 1800/1000 · Kaya Baltacı 1600/1300 ·
Bozkır Boynuzlusu 1500/1400 · Sazlık Balıkçılı 1400/1500 · Taş Muhafız 500/2100. Kutup parçaları bilerek bunların altındadır (bedel = birleşme potansiyeli).
Hurda Akıncıları 2000 ile Sv4 tavanını (1900) yalnız 100 aşar; DEF 0 + saldırı sonrası savunma kilidi bedelidir (Volkan altında 2500).

### 0.2 Yeni büyüler (12)

| # | id | Türkçe ad | English | Tür | Etki kimliği | Kopya | Rol referansı | Mevcut benzer kart |
|---|---|---|---|---|---|---|---|---|
| S1 | `well_pail` | Kuyu Kovası | Well Pail | Normal | `draw2` | **1** | Pot of Greed | `fate_trade` |
| S2 | `puppet_string` | Kukla İpi | Puppet String | Normal | `controlUntilEnd` | 3 | Change of Heart | — |
| S3 | `void_eye` | Boşluk Gözü | Void Eye | Normal | `destroyAllMonsters` | **1** | Dark Hole | `mirror_barrier` |
| S4 | `sweeping_gale` | Süpürge Rüzgarı | Sweeping Gale | Normal | `destroyAllOppSpellTrap` | **1** | Harpie's Feather Duster | `purging_wave` |
| S5 | `winnow_sieve` | Harman Eleği | Winnowing Sieve | Normal | `draw3Discard2` | **1** | Graceful Charity | `fate_trade` |
| S6 | `gilded_cage` | Yaldızlı Kafes | Gilded Cage | Devamlı | `cageMonster3` | 3 | Swords of Revealing Light (bkz. not) | `dawn_swords` |
| S7 | `auger_lance` | Burgu Mızrağı | Auger Lance | **Hızlı** (yeni) | `destroySpellTrapQuick` | 3 | Mystical Space Typhoon | `purging_wave` |
| S8 | `soul_leash` | Ruh Tasması | Soul Leash | Ekipman | `equipControl` | 3 | Snatch Steal | — |
| S9 | `straw_decoys` | Saman Korkuluklar | Straw Decoys | **Hızlı** (yeni) | `strawTokens` | 3 | Scapegoat | `magic_hat` |
| S10 | `spite_axe` | Hınç Baltası | Spite Axe | Ekipman | `equipAtk800Return` | 3 | Axe of Despair | `dragon_blade` (+700) |
| S11 | `page_turner` | Sayfa Çeviren | Page Turner | Normal | `handRefreshBoth` | 3 | Card Destruction | — |
| S12 | `lucky_die` | Talih Zarı | Lucky Die | Normal | `diceBoost100` | 3 | Graceful Dice | — |

**Tek kopya kuralı:** S1, S3, S4, S5 (ve C2 için bkz. kart) destede en çok **1** kopya. `decks.ts` `maxCopies(id)` bir `SINGLE_COPY_IDS` kümesiyle genişler
(mühürlerin `SEAL_COPIES` deseni). Gerekçe: bedava çekme + el yenileme Beş Mühür anında kazanmayı hızlandırır; Kuyu Kovası 3 kopyada Kader Takası'na baskındır.
Test: `validateDeck` ve `autoFillDeck` çekme motoru + mühür destesiyle (tek kopya ihlali → `copies` hatası; otomatik doldurma ikinci kopya eklemez).

**SoRL notu (soru, sahibe):** Swords of Revealing Light rolü **zaten var**: `dawn_swords` (Şafak Kılıçları). İki seçenek:
**(A)** yeni kart yok, enerji `dawn_swords` imza sinematiğine (havuz tam **80** = `YOL_HARITASI` "60–80 hedef");
**(B)** tek hedefli farklı bir kilit: **Yaldızlı Kafes** (havuz 81, hedefi 1 aşar). Varsayılan B (sahip 16. maddede bu rolü istedi); sahip A derse S6 düşer.

### 0.3 Yeniden tasarımlar (3, aynı id)

| id | Türkçe ad | English | Kural | Değişiklik |
|---|---|---|---|---|
| `ashen_drake` | Kül Ejderi | Ashen Drake | KARANLIK / Ejderha Sv7 2400/2000 | **Kural ayarı:** vanilla → `ashRebirth` (küllerinden 1 kez doğar). Sanat + tüm animasyonlar yeni. |
| `grim_warden` | Hortlak Muhafız | Grim Warden | KARANLIK / Şeytan Sv6 2500/1200, `declareAtkDebuff400` | Kural aynı. Sanat + animasyonlar yeni ("fener bekçisi"); etki görünür "ruh ışığı emme". |
| `wisp_imp` | Tüy Hayalet | Down Wisp | KARANLIK / Şeytan Sv1 300/200, `noBattleDamageOnDestroy` | Kural aynı. Sanat + animasyonlar yeni ("tüyden hayalet"); etki görünür "tüy yastık". |

Kül Ejderi kural ayarı: Sv7 için 2 kurban gerekir; 2400 ATK'lı vanilla, 2800'lük Kristal Ejder'in yanında ölü karttır. Kül teması doğal bir "küllerinden doğma" ister.

---

## 1. Sayım ve deste etkisi

| | Canavar | Büyü | Tuzak | Jeton | Toplam (havuz) |
|---|---|---|---|---|---|
| Bugün | 27 | 17 | 11 | | **55** |
| 4. madde: `dusk_sorcerer` emekli | −1 | | | | 54 |
| Bu belge | +15 | +12 | 0 | +1 (havuz dışı) | **81** (A seçeneğiyle 80) |

- `DECK_MAX = 80` *deste* sınırıdır, havuz sınırı değildir. Kurucu kart sayısını çalışma anında okur (`docs/DESTE_KURMA.md`).
- **Jeton** `straw_decoy_token` ayrı bir `CardId`'dir (cards.ts'e eklemeli, `token: true` bayrağı); `ALL_CARDS`, deste kurucu, `autoFillDeck`, hazır desteler ve kart sayımının **dışında** tutulur.
- Element dağılımı (41 canavar): IŞIK 6 · KARANLIK 12 · ATEŞ 3 · SU 4 · TOPRAK 11 · RÜZGAR 5 (ATEŞ zayıf: sonraki partide öncelik).
- **Sv7+:** Kristal Ejder, Kül Ejderi, Fırtına Şövalyesi + Kutup Hükümdarı = 4. `maxHigh` (%20) aynı kalır.
- `DEFAULT_DECK` (özgün 20) değişmez. Yeni kartlar `MONSTERS_B2` / `SPELLS_B2` olarak `ALL_CARDS` sonuna **eklenir**.
- Önerilen pinler (`src/data/decks.ts` `PRESET_DEFS`): Ateş Saldırı → `scrap_raiders`, `spite_axe`; Su Kontrol → `tide_harpooner`, `reed_heron`, `tidal_bay`, `auger_lance`;
  Işık Destek → `well_pail`, `winnow_sieve`, `reflection_archer`; Toprak Savunma → `mudgrasp_spirit`, `gilded_cage`, `straw_decoys`; Dengeli → `void_eye`, `puppet_string`.
  **Yeni hazır deste:** "Mıknatıs" (4 Kutup kartı ×1–2 + `soul_recall`).
- 3 Kutup parçasında küçük **mıknatıs simgesi**; ipucu: "Kutup parçası: üçü sahandayken Kutup Hükümdarı'nı çağırabilirsin".
- `tests/deck/rules.test.ts`: yeni pinler, Kutup Hükümdarı Sv8, tek kopya kümesi, jetonun havuz dışında olması.

---

## 2. Gereken yeni motor mekanikleri

Hepsi **eklemeli** (types.ts'e isteğe bağlı alanlar / yeni birleşim üyeleri; hiçbir ad silinmez). Her mekanikle `bot.ts`, `describe.ts`, `legal.ts`, `query.ts` güncellenir.

| Kod | Mekanik | Kartlar | Motor değişikliği (öz) | Zorluk |
|---|---|---|---|---|
| M1 | **Canavar ateşleme etkisi** (Ana Aşamada elle) | C2, C6 | `Action {type:'activateMonster'; player; zone}`; slotta `effectUsedTurn?`; `activate kind:'monsterEffect'` | Orta |
| M2 | **Yazı-tura** | C2 (C3) | `PendingDecision {kind:'coinCall'}` + `Action {type:'callCoin'; call:'heads'\|'tails'}`; olay `{type:'coinToss'; …; result; win}`; `state.rng` | Küçük |
| M3 | **Zar** | S12 | olay `{type:'diceRoll'; player; sourceUid; value}`; `state.rng` | Küçük |
| M4 | **Kontrol değişimi** | S2, S8 | slot `borrowed?: {owner; until:'endPhase'\|'equip'; byUid}`; slot diğer oyuncunun `monsters` dizisine taşınır (`CardInstance.owner` sabit); olay `controlChange`; dönüşte sahibinde boş alan yoksa yok edilir (`reason:'rule'`). Ödünç canavar kurban edilir / yok olursa **sahibinin** mezarlığına gider | Büyük |
| M5 | **Toplu yok etme** | S3, S4, C2 | `destroyAll(refs, reason, src)`: tek geçiş; `guardian_charm` her biri için ayrı; şapka/jeton söner; ön olay `{type:'massDestroy'; sourceUid; refs}`. Yok olma sonrası görevler (Kül dirilişi kaydı, Hükümdar ayrılması) geçiş bittikten **sonra** sırayla | Küçük |
| M6 | **Jeton** | S9 | `CardId` `straw_decoy_token` (`token: true`); slot `token?: true`; mezarlığa gitmez (`tokenVanish`); kurban olamaz; **S2/S8 hedefi olamaz**; `summon from:'token'` | Orta |
| M7 | **Çok turlu kilit** | S6 | `dawn_swords` sayacı; B/T slotunda `equippedTo` = kafesteki uid | Küçük |
| M8 | **El yenileme** | S11 | her el kartı `discard` → mezarlık; sonra aynı sayıda `draw` (önce aktive eden); boş destede çekebildiği kadar | Küçük |
| M9 | **Ekipman türevleri** | S8, S10 | rakip canavara kuşanma (S8); "mezarlık yerine **sahibinin** deste üstü" (S10): `toDeck from:'spellTrap', position:'top'` + `damage 500` | Orta |
| M10 | **Kurbanla Özel Çağırma (birleşme)** | C15 | `Action {type:'specialSummon'; player; uid; zone; tributes}`; Normal Çağırma hakkını harcamaz. `legal.ts`: `normalSummon`/`setMonster` üretiminde `magnetFusion` kartları **hariç** (yoksa `tributeNeed(8)=2`, `double_offering` ile 1 kurbanla çağrılırdı) | Orta |
| M11 | **Hızlı Büyü** (`SpellType` += `'quick'`) | S7, S9 | bkz. §2.1 | Büyük |
| M12 | **Oyundan çıkarma** | C6 | `PlayerState.banished?: Uid[]`; olay `banish`; `soul_recall` görmez | Küçük |
| M13 | **Gecikmeli diriliş** | R1 | `internal.rebirth: {uid, owner, turn}[]`; sahibin `beginTurn`'ünde çekmeden sonra; bkz. R1 | Küçük |
| M14 | **Kalıcı stat** | C3 | slot `permAtk?`, `permDef?` (slot sahadan ayrılınca biter) | Küçük |
| M15 | **Saldırı sonrası savunma kilidi** | C5, C10 | `lockPositionTurn`; savaş görevinden sonra `positionChange` | Küçük |
| M16 | **Çift saldırı (2.si yalnız canavara)** | C9 | `legal.ts`: `attacksThisTurn < 2`; ikinci saldırının `direct` seçeneği üretilmez | Küçük |
| M17 | **Koşullu saldırılamazlık / hedeflenemezlik** | C1 | `legal.ts`: `oppHasMonsters` → `oppHasAttackable` (yalnız saldırılabilir canavarları sayar); saldırılabilir yoksa doğrudan saldırı yasal | Küçük |
| M18 | **Yok olunca parçalara ayrılma** | C15 | bkz. C15 kenar durumları | Orta |
| M19 | **Rakibin Çekme Aşamasında LP** | S8 | `beginTurn`: tasmayla tutulan canavarın sahibi `lpGain 1000` | Küçük |
| M20 | **Sayı seçimi kararı** | C6 | `PendingDecision {kind:'chooseCount'; min; max}` + `Action {type:'chooseCount'; n}` | Küçük |
| M21 | **Düelloda 1 kez (uid başına)** | C2, R1 | `internal.oncePerDuel: Record<Uid, string[]>` | Küçük |
| M22 | **Tek kopya** | S1, S3, S4, S5 | `decks.ts` `SINGLE_COPY_IDS` → `maxCopies` 1; DESTE_KURMA metni | Küçük |

### 2.1 Hızlı Büyü (M11) — zincir kuralları
- **Elden:** yalnız kendi Ana Aşamanda (normal büyü gibi).
- **Kapalıdan:** koyulduğu turdan **sonra**; kendi Ana Aşamanda ya da rakibin `attackDeclared` / `summoned` pencerelerinde. Koyulduğu turda kendi Ana Aşamanda **da açılamaz**
  (`legal.ts` bugün kapalı büyüleri aynı tur açtırıyor: hızlı büyü için `setTurn < turn` denetimi eklenir).
- `respondableTraps` → `respondableCards` (tuzaklar + hazır hızlı büyüler). Pencere başına **tek** yanıt (sade zincir korunur).
- **İç içe pencere:** hızlı büyü bir yanıt penceresinde açılınca, `spellActivated` penceresi **aktive eden oyuncuya göre** açılır (aktive eden sıra oyuncusu olmayabilir:
  types.ts'teki yorum eklemeli olarak "activator" diye genişler). Bu iç pencerede yalnız `spell_seal` yanıt verebilir; derinlik en çok 2. Çözülme sırası LIFO:
  Mühür → hızlı büyü (geçersizse hiç) → asıl tetik (saldırı/çağırma) sürer. Bot: önce iç pencereyi, sonra dış pencereyi karar verir.
- `steel_silencer` ("tuzaklar aktive edilemez") hızlı büyüleri **engellemez** — kasıtlı: hızlı büyü Susturucu'nun karşı oyunudur; Susturucu metni değişmez.

Eski kartlarla test edilecek etkileşimler: `guardian_charm` her toplu yok etmede tek tek; `toppling_tower` Kutup Hükümdarı ve Kül Ejderi dirilişine cevap verebilir
(Özel Çağırma, ATK ≥ 1800); `magic_hat` şapkaları toplu yok etmede `decoyPopped` ile söner; `dawn_swords` ile `gilded_cage` birlikte durabilir;
Kadran "bildi" → rakipteki Kül Ejderi diriliş kaydı ve Kutup Hükümdarı ayrılması (kombo testleri).

---

## 3. Yapım sırası

| Dalga | İş | Neden önce |
|---|---|---|
| 0 | Motor ortak: M5, M12, M14, M15, M16, M17, M20, M21, M22 + `cards.ts` B2 verileri + yer tutucu görseller + `describe.ts` + testler | Küçük, kartların yarısı bunlara bağlı |
| 1 | **Yeniden tasarımlar** R1 (M13), R2, R3 | Sahibin 5/6/8. maddeleri; destelerde zaten oynanıyorlar |
| 2 | S1 Kuyu Kovası, C7, C8, C11, C4 (vanilla), C5, C9, C10 | Motor yok/az; sanat hattını ısıtır |
| 3 | M3 → S12; M8 → S11; M5 → S3, S4; S5; M9 → S10 | Tek kartlık mekanikler |
| 4 | M1 + M2 → C2 → C3; M1 + M20 → C6 | Ateşleme altyapısı bir kez |
| 5 | M4 → S2 → S8 (M9 + M19); M7 → S6 | Kontrol değişimi en riskli iş; kendi test paketi |
| 6 | M11 → S7 → M6 → S9 | Hızlı büyü + jeton |
| 7 | C12, C13, C14 → M10 + M18 → C15 (dev birleşme sinematiği) | Parçalar hazır olmadan birleşme filme alınamaz |
| 8 | C1 (`tidal_bay` ile filme alınır), bot, hazır desteler, tam oyun demo + ses mix turu | Kapanış |

---

## 4. Süre tahmini (kart başına, ajan-saat; eleştiri turları dahil, ±%30)

Sütunlar: **Motor** (kural + test + bot), **Sanat** (v3 rig, 5 temel + ekstra animasyon, P1/P2), **Sine+SFX**, **Kart** (88×68 + 44×34 resim).

| Kart | Motor | Sanat | Sine+SFX | Kart | Toplam |
|---|---|---|---|---|---|
| C1 Kabuk Zıpkıncı (★) | 2.5 | 9 | 8 | 1.5 | 21 |
| C2 Kadran Soytarısı | 5.5 | 6 | 7 | 1.5 | 20 |
| C3 Bulut Yavrusu | 1.5 | 9 | 5 | 1.5 | 17 |
| C4 Yansıyan Okçu | 0.3 | 8 | 5 | 1.5 | 14.8 |
| C5 Hurda Akıncıları | 1 | 9 | 5 | 1.5 | 16.5 |
| C6 Kovuk Devi | 4 | 7.5 | 6 | 1.5 | 19 |
| C7 Kaya Baltacı | 0.3 | 6 | 4 | 1.5 | 11.8 |
| C8 Sazlık Balıkçılı | 0.3 | 6.5 | 4.5 | 1.5 | 12.8 |
| C9 Uçurtma Eskrimci | 1 | 6.5 | 5 | 1.5 | 14 |
| C10 Çamur Pençe Ruhu | 1.5 | 6 | 5 | 1.5 | 14 |
| C11 Bozkır Boynuzlusu | 0.3 | 7 | 4 | 1.5 | 12.8 |
| C12–C14 Kutup parçaları (her biri) | 0.5 | 6 | 4 | 1.5 | 12 ×3 = 36 |
| C15 Kutup Hükümdarı (★) | 7 | 14 | 12 | 2 | 35 |
| S1 Kuyu Kovası | 0.5 | — | 5 | 1.5 | 7 |
| S2 Kukla İpi | 6 | — | 6 | 1.5 | 13.5 |
| S3 Boşluk Gözü | 1.5 | — | 6.5 | 1.5 | 9.5 |
| S4 Süpürge Rüzgarı | 1.5 | — | 5.5 | 1.5 | 8.5 |
| S5 Harman Eleği | 0.5 | — | 5 | 1.5 | 7 |
| S6 Yaldızlı Kafes | 3 | — | 6 | 1.5 | 10.5 |
| S7 Burgu Mızrağı | 7 | — | 4.5 | 1.5 | 13 |
| S8 Ruh Tasması | 3 | — | 6 | 1.5 | 10.5 |
| S9 Saman Korkuluklar | 5.5 | 2.5 (jeton) | 4 | 1.5 | 13.5 |
| S10 Hınç Baltası | 1.5 | — | 5.5 | 1.5 | 8.5 |
| S11 Sayfa Çeviren | 2 | — | 6 | 1.5 | 9.5 |
| S12 Talih Zarı | 2 | — | 5.5 | 1.5 | 9 |
| R1 Kül Ejderi (★) | 3 | 16 | 9 | 2 | 30 |
| R2 Hortlak Muhafız (★) | 0.5 | 14 | 7 | 2 | 23.5 |
| R3 Tüy Hayalet | 0.5 | 8 | 5 | 1.5 | 15 |
| Ortak: UI kararları (yazı-tura, sayı, hızlı büyü, kontrol görünümü), bot, desteler, tek kopya testleri, demo, ses mix | | | | | 36 |
| **Toplam** | | | | | **≈ 470 ajan-saat** |

Takvim: tek ajanla ≈ 470 saat; 4 paralel ajanla (dalga sırasına uyarak) ≈ 5–6 gün kesintisiz çalışma + sahibin film inceleme turları.

---

## 5. Ortak sunum kuralları

- **Çağırma iskeleti** (`GAME_DESIGN.md` §6) yalnızca kart uçuşu ve karo çarpmasıdır; hologram belirme anı her kartta özel girişle değiştirilir.
- **Darbe kutsaldır:** hit-stop (kartta yazan ms), 1–2 kare beyaz silüet flaşı, malzemeye özgü kıvılcım, hasarla orantılı sarsıntı (1–5 px), zıplayan sayı.
- **Ses:** vurulan gövde çalar (`src/audio/v3/materials.ts`); imza sesler `src/audio/v3/kit.ts` yapı taşlarıyla (`thump crack puff sweep clank link glassBell glassRain glassReverse drone growl`).
  İki kart aynı imza sesini paylaşmaz (§5.1). `glassReverse` yalnız R2'nin tanımlayıcı katmanıdır; başka kartta en çok gizli dolgu olur.
- **Ölüm:** v3 ölüm kiti tabanı kalır ama her kartın **son malzemesi** kendinedir (§5.2). Genel "piksellere ayrılma" yalnız son 150 ms.
- **Girişler:** "yerden tırmanma" yalnız iki kartta: R2 (mezar tümseği) ve C10 (karo kenarını kavrayan eller). Gökten dalış yalnız `storm_hawk`'ın.
- **P2:** sprite'lar sağa bakar, P2 `flipX` + `p2: 'relight'`. **Kart resmi:** 88×68 + elle ayarlanmış 44×34 (`docs/v3/KART_RESIMLERI.md`), bir "en parlak nokta" + yön boşluğu.

### 5.1 Ses kimliği tablosu (çakışma denetimi)

| Kart | Ana perde / renk | İmza malzeme | Ayırıcı katman |
|---|---|---|---|
| C1 Zıpkıncı | 220 Hz ip gerilimi | ıslak ip + deniz kabuğu | kabuk borusu "uuu" (konik nefes) |
| C2 Soytarı | 3.2 kHz tik-tak | pirinç para + yay | dişli cırcırı, geri sarılan saat |
| C3 Yavru | 1.2 kHz cıvıltı → 150 Hz kükreme | yumurta kabuğu | rüzgar halkası ıslığı (yükselen tiz) |
| C4 Okçu | 660 Hz + ters fazlı 660 Hz | ışık teli + cam yüzey | yansıma: aynı nota 80 ms gecikmeli, alt oktav |
| C5 Akıncılar | 70 Hz motor | hurda teneke | üç ağızdan söylenme |
| C6 Kovuk Devi | 180 Hz ahşap gıcırtısı | kovuk kütük + kök | budak "tok" (içi boş ahşap rezonansı) |
| C7 Baltacı | 90 Hz çakıl ezilmesi | taş + kürk | yarık "çıtırtı koşusu" |
| C8 Balıkçıl | 2.4 kHz gaga "tak" | saz + sis | kanat "fuff" + kurbağa korosu altlığı |
| C9 Eskrimci | 4 kHz ince "tsst" | çelik iğne + uçurtma bezi | ip vızıltısı (gergin tel) |
| C10 Çamur Ruhu | 600 Hz vantuz | çamur | inilti (`growl` yavaş) |
| C11 Boynuzlu | 3 kHz çimen hışırtısı | boynuz + toynak | sarmal boynuz flütü (rüzgar notası) |
| C12–C15 Kutup | 110/111 Hz vuruşan uğultu | manyetit metal | demir tozu şıngırtısı; perdeler İğne 220 / Örs 82 / Bobin 147 Hz; Hükümdar akoru + 35 Hz demir gongu |
| S1 Kova | 330 Hz çıkrık cırcırı | ahşap çıkrık + su | kova kenarından dökülen su |
| S2 Kukla | 5 ip "tsing" | ahşap + ip | eklem tıkırtısı |
| S3 Boşluk Gözü | 28 Hz şişme (tremolo yok) | boşluk + cam yüzey | göz kapağı "şıııp" + göz bebeği büzülme tıkı |
| S4 Süpürge | L→R geniş gürültü | kâğıt + yaprak | platformdan düşen kartlar: uzaklaşan ıslık |
| S5 Elek | 6 Hz ritmik sallama | hasır elek + tane | saman savrulması (hp hışırtı) |
| S6 Kafes | zincir + çan | yaldızlı demir | asma kilit tıkırtısı |
| S7 Burgu | 1→8 kHz ıslık | çelik burgu | 120 Hz rotor vızıltısı (testere dişi) |
| S8 Tasma | zincir halkaları | ruh tasması + deri | deri gıcırtısı + gölge adımları |
| S9 Korkuluk | saman hışırtısı | saman + ahşap kazık | kazık "tok" + uzak karga "gak" |
| S10 Balta | düşük vuruşan drone | kara demir + zincir | yere saplanma + söküş gıcırtısı |
| S11 Sayfa | kâğıt fırfırı | kitap + mürekkep | kitap kapanması "PAT" |
| S12 Zar | ahşap tak-tak | ahşap zar | pentatonik nokta notaları |
| R1 Kül Ejderi | 50 Hz çift kor kalp atışı | kül + kor | gecikmeli tutuşma "VUF" |
| R2 Hortlak | sarkaç zincir | cam fener + ruh ateşi | emme (`glassReverse` iner) |
| R3 Tüy Hayalet | 5 kHz tüy | tüy | yastık "pof" (tek "pof" sahibi) |

### 5.2 Son malzeme tablosu (ölüm sonu, çakışma denetimi)

| Kart | Son | | Kart | Son |
|---|---|---|---|---|
| C1 | kabuğa çekilir, kabuk kuma gömülür | | C9 | uçurtma ipi kopar, pelerin ekran dışına uçar |
| C2 (kendi ölümü) | yaylar fırlar, dişliler yuvarlanır | | C10 | sıvı olup karoya geri akar |
| C2 bildi/bilemedi | hedefler kartlarına **geri sarılır** | | C11 | tohum/çimen bulutu rüzgarla |
| C3 | yumurtaya geri örülür, bulutla süzülür | | C12 | kuvvet iğneyi söker, levhalar düşer |
| C4 | yansıma kırılır, okçu cam kırıklarına | | C13 | kutup titreşimi, parçalar dışa iter |
| C5 | araba çöker, goblinler kaçar | | C14 | tel çözülür, makara boş döner |
| C6 | kökler çözülüp karoya çekilir, tek filiz solar | | C15 | manyetik itme ile üç parçaya ayrılır |
| C7 | kendi yarığı boyunca **ikiye ayrılır** | | R1 | kül yığını (taş/kül sonu yalnız onun ve `stone_sentinel`'in) |
| C8 | sise geri adım atar, yalnız sazlar kalır | | R2 | boş kefen çöker |
| R3 | tüy yastığı / rüzgar | | S9 jeton | saman bağı çözülür, kazık devrilir |

---

## 6. Canavarlar — kart kart

> Şablon: **Kural** · **Motor** · **Kimlik** · **Idle** · **Çağırma** · **Saldırı** · **Ölüm** · **İmza an** · **Kart resmi** · **SFX** · **En yakın kart**.

### C1 · `tide_harpooner` — Kabuk Zıpkıncı / Conch Harpooner
SU / Su · Sv5 · 1700/1500 · 80 · ★ As · `tidalBayShroud`

**Kural:** "Gelgit Körfezi alan büyüsü sahadayken: rakip bu karta saldıramaz ve rakibin Büyü kartları bu kartı hedef alamaz. Rakibin saldırabileceği başka canavarın yoksa rakip doğrudan saldırabilir."
**Motor:** M17. Koşul: iki oyuncudan birinin `fieldSpell` slotunda açık `tidal_bay`. Rakip büyülerinin hedef adaylarından (`judgment_bolt`, `kneel_down`, `puppet_string`, `soul_leash`, `gilded_cage`, `battle_cry` …) düşer.
Tuzaklar ve hedefsiz etkiler (`void_eye`, `mirror_barrier`, Kadran) etkiler. `oppHasAttackable` yalnız saldırılabilir canavarları sayar → tek canavar Zıpkıncıysa doğrudan saldırı yasal (kilit yok). Körfez +400 → 2100.
**CPU:** Zıpkıncı + Körfez eldeyse önce Körfez. Rakipken: `purging_wave` / `sweeping_gale` / `auger_lance` önce Körfez'e.

**Kimlik:** Dev bir **sarmal deniz kabuğunu** sırtında ev gibi taşıyan, iki ayağı üstünde duran yaşlı bir **keşiş yengeç**; bir kıskacı zıpkın tutar, öbürü ip halkası; kabuğun ağzından mercan dalları, kabukta yaşayan midyeler. Binek yok, şapka yok.
Silüet: arkada büyük spiral (kabuk) + öne uzanan uzun zıpkın. Rampalar: `water` (kabuk iç sedef), `earth` (kabuk dış, zıpkın sapı), `fire` soluk ton (yengeç kabuğu kızılı — vurgu), `stone` (uç), `PAL.white` (köpük).
**Idle (16 f):** Göz sapları ayrı ayrı döner; kabuğun ağzından köpük kabarcıkları çıkar ve her biri zeminde 1 px ışık halkası açar; ip halkası sallanır; midyeler arada açılıp kapanır.
**Çağırma (2.4 s):** Karo kumsal gibi ıslanır → kabuk tepesi kumdan yükselir, yan döner → yengeç bacakları dışarı çıkar, kabuğu sırtına oturtup doğrulur → zıpkını çevirip yere saplar. Cut-in: kabuk ağzının karanlığında parlayan iki göz sapı.
**Saldırı "Zıpkın Atışı" (2.6 s):** *Hazırlık* 700 ms: ip başının üstünde 1.5 tur döner (köpük boncuklar). *Yol* 350 ms: zıpkın uçar, ip gerilir. *Temas:* delip geçer, su fıskiyesi, **hit-stop 90 ms**.
*Takip* — imza (oyundaki tek "çekiş"): yengeç ipi kıskacıyla **çeker**, hedef 3 px yengece sarsılır, ip gevşer, zıpkın geri sarılır. Doğrudan saldırıda ip LP paneline saplanır.
**Ölüm:** Gövde kabuğa çekilir, kabuk yuvarlanır ve ıslak kuma gömülür; zıpkın 0.5 s saplı kalır, kıymık olur.
**İmza an — Körfez kalkanı:** Körfez açılınca karonun çevresinde dönen bir su halkası; rakip hedeflemeye çalışınca nişangâh dalga duvarına çarpıp kayar, "KORUNUYOR" damgası.
**Kart resmi:** Ay ışığında kabuğun ağzından çıkan yengeç, zıpkın sağ üste uzanıp kareden taşar, su tacı. En parlak nokta: zıpkın ucu.
**SFX:** idle — kabarcık şıpırtısı; çağırma — kum kayması + kabuk "tok" + kabuk borusu "uuu" (konik nefes, 220 Hz); saldırı — ip dönüşü (`sweep` 3 nabız), bırakış tel tıngırtısı, temas ıslak "tok" + fıskiye, çekiş ip gıcırtısı;
ölüm — kabuğa çekilme kayıtı + kum "şşş"; imza — dönen su (`drone` lp dalgalı) + nişangâh kayışında yağlı "şlup".
**En yakın kart:** `coral_serpent` (su ışını) — fark: ipli mermi + çekiş; `tide_golem` (dalga) — fark: tek nokta zıpkın, kabuk.

### C2 · `dial_jester` — Kadran Soytarısı / Dial Jester
IŞIK / Büyücü · Sv2 · 700/300 · 48 · `coinWipe` · destede en çok 2

**Kural:** "Düelloda 1 kez (her Kadran Soytarısı için), Ana Aşamanda, rakibin sahasında canavar varken: Yazı ya da Tura seç ve para at. Bilirsen: rakibin sahasındaki tüm canavarları yok et. Bilemezsen: kendi sahandaki tüm canavarları yok et (bu kart dahil) ve yok olan canavarların toplam ATK'sinin yarısı kadar hasar al."
**Motor:** M1 + M2 + M5 + M21. Yasal: açık, kontrol edilen, bu uid için `oncePerDuel` kullanılmamış, rakipte ≥1 canavar. Akış: `activate` → `coinCall` → `callCoin` → `coinToss` → `destroyAll`.
Hasar = `floor(Σ currentAtk(yok olanlar)/2)` (yok olmadan hemen önce; `guardian_charm` ile kurtulan sayılmaz; jeton 0; kendisi dahil). Bildi + sahanda açık `cloud_hatchling` → C3. `maxCopies` 2.
Kombo testleri: bildi → rakibin Kül Ejderi diriliş kaydı; bildi → rakibin Kutup Hükümdarı ayrılması (rakip alanları boşaldığı için ayrılma çoğu zaman tutar).
**CPU:** yalnız (rakip saha değeri − kendi) ≥ 1500 ya da rakipte as varsa, ve kayıp hasarı < kendi LP ise.

**Kimlik:** Kafası kocaman yuvarlak bir **saat kadranı** olan minik soytarı (yelkovan/akrep kaş gibi), iki sivri şapka ucu (uçlarında dişli), gövdesi kadar altın para, kıvrık ayakkabılar.
Rampalar: `gold`, `PAL.mist/white` (kadran), `night` + `gold` damalı desen. Kum yok (kum `hourglass_imp`'in).
**Idle (16 f):** Akrep her 4 karede bir çentik ilerler; parayı elden ele atar; şapka dişlileri döner; kafayı tik-tak yatırır.
**Çağırma (2.2 s):** Karoya dev kadran yansır, kollar hızla geriye döner → gece yarısı çanı → soytarı kadranın ortasından guguk kuşu gibi yaylı çıkar (3 sönümlü sekme), selam.
**Saldırı "Kurmalı Takla" (2.3 s):** *Hazırlık* 600 ms: sırttaki kurma anahtarını 3 tur çevirir. *Yol:* yaylı takla. *Temas:* para kenarıyla vurur, **hit-stop 70 ms** — o an ekrandaki tüm saat kolları donar. *Takip:* geri seker.
**Ölüm:** Kadrandan yaylar fırlar, dişliler dökülüp yuvarlanır, cam çatlar, son "tik".
**İmza an — Yazı-Tura (3.2–3.8 s):**
1. Karar kutusu: **YAZI** / **TURA**; seçilen yüz parlar.
2. Dünya 0.3×; arena kenarına dev kadran halkası soluk biner; para başparmakla fırlar, 8 karelik dönüş, kollar yarışır.
3. Para sahaya düşer, iki kez seker (tın tın), yatarak titreşir → yüz görünür.
4. **Bildi:** kollar rakip tarafında "12"yi vurur; rakip canavarlar **zamanda geri sarılır**: kendi çağırma animasyonları hızla ters oynar, gövde kart dikdörtgenine katlanır, kart dönerek mezarlığa uçar (aşınma/toz yok).
5. **Bilemedi:** kollar kendi tarafında çılgınca geri döner; kendi canavarları aynı geri sarılmayla kartlarına katlanır, kartlar akrep-yelkovan gibi dönen bir çizgide kendi LP paneline çarpar, hasar sayısı oradan dökülür.
**Kart resmi:** Takla atan soytarı parayı kaldırmış, arkada kareyi dolduran kadran.
**SFX:** idle — tik-tak (3.2k/2.6k); çağırma — cırcır + çan (`glassBell` 880+1320) + yay "boing"; saldırı — kurma "cırt" ×3, para "çın", donmada tik-takların susması;
yazı-tura — başparmak "ping", dönüş vızıltısı, iki iniş "tın" (3.1k, 2.9k); bildi — majör çan arpeji + **ters oynayan teyp sesi** (hızlanan geri sarma cıvıltısı); bilemedi — tritonlu inen çanlar + geri sarma + LP darbesi; ölüm — "boing" + dişli `clank`lar + son tik.
**En yakın kart:** `hourglass_imp` (kum, dondurma) — fark: saat mekanizması, para, tüm tarafın geri sarılması.

### C3 · `cloud_hatchling` — Bulut Yavrusu / Cloud Hatchling
RÜZGAR / Ejderha · Sv3 · 1100/900 · 48 (büyümüş biçim 64'e taşar) · `jesterAging`

**Kural:** "Kadran Soytarısı'nın yazı-turası bilindiğinde bu kart sahanda açıksa: büyür ve kalıcı olarak ATK +1200, DEF +800 kazanır (her Bulut Yavrusu için 1 kez)."
**Motor:** M14. C2'nin `win` dalında, kontrol edenin sahasındaki açık, `permAtk` almamış her yavru → 2300/1700. Bilemezse yavru da yok olur. **CPU:** Yavru sahadayken Soytarı değerine +1200.
**Kimlik:** Tombul, kafası gövdesinden büyük yavru ejder; güdük kanatlar, göğüste bulut tüyü, kuyruk ucunda yumurta kabuğu. Büyümüş biçim aynı rigde `aged`: uzun boyun, kıvrık boynuzlar, bulut yelesi.
Rampalar: `leaf`, `PAL.mist/white`, `gold`, `earth`.
**Idle (18 f):** Yalpalar, kabuk yere tık tık vurur, kanat çırpmayı dener; ~3 s'de bir hıçkırır, ağzından minik bir **rüzgar halkası** (simit) çıkar.
**Çağırma (2.3 s):** Küçük bir buluttan yumurta düşer → 3 kez sallanır, çatlak büyür → patlar; yavru takla atarak çıkar, üst kabuk başında kalıp kuyruğuna kayar.
**Saldırı "Hıçkırık Halkası" (2.2 s):** *Hazırlık* 600 ms: yanaklarını şişirir. *Yol:* iki hoplama, sonra **hapşırır**: genişleyerek uçan, ıslık çalan saydam bir **rüzgar halkası** (içi boş simit; geçtiği çimleri halka biçiminde yatırır).
*Temas:* halka hedefin gövdesine geçer, sıkıştırır ve "tıng" diye kırılır, **hit-stop 60 ms**. *Takip:* geri teper, kuyruğunun üstüne oturur.
**Ölüm:** Top olur, çevresinde kabuk geri örülür, yumurta bir bulutla yukarı süzülüp söner.
**İmza an — Büyüme (2.8 s):** Yavrunun üstüne kadran yansır, kollar ileri döner; 6 karelik büyüme; kükreme bebek cıyaklamasından iki oktav aşağı kırılır; kalıcı bulut halkası aurası.
**Kart resmi:** Çatlak yumurtada bulutun üstünde oturan yavru minik bir halka hapşırıyor.
**SFX:** idle — hıçkırık "hık" + minik ıslık; çağırma — kabuk çatlağı ×3 + cıyak (FM 1.2k); saldırı — nefes çekme, "hapşu", **yükselen halka ıslığı** (bant geçiren gürültü 2→5 kHz) + kırılma "tıng" (`glassBell` kısa); ölüm — müzik kutusu ninnisi (1568/1319/1175); büyüme — ileri cırcır + 2 oktav inen kükreme.
**En yakın kart:** ejderler — fark: bebek, komedi, kabuk; `storm_hawk` — fark: hapşırık halkası.

### C4 · `reflection_archer` — Yansıyan Okçu / Reflected Archer
IŞIK / Büyücü · Sv4 · 1800/1000 · 64 · Normal canavar
**Tat metni:** "Gölü olmayan yerde de bir yansıması vardır. Okunu ilk o atar."
**Motor:** yok. **CPU:** vanilla.

**Kimlik:** **Tek** bir okçu (insan değil: ışıktan örülmüş, cam gibi saydam kenarlı bir ay büyücüsü), ayakları altındaki ışık birikintisinde **ters, koyu mavi yansıması**. Yansıma ayrı bir yaşam sürer: bir kare geç hareket eder, bazen aynı anda değil.
Silüet: dik figür + altında baş aşağı figür = dikey bir "kum saati" biçimi. Rampalar: `gold` (ışık yay), `PAL.mist/white` (gövde), `night` + `water` koyu tonları (yansıma), `teal` yok.
**Idle (20 f):** Okçu ağırlık aktarır; yansıma 2 kare gecikmeyle izler; döngüde bir kez yansıma **farklı** bir şey yapar (başını çevirip izleyiciye bakar) ve okçu fark etmeden eski hâline döner.
**Çağırma (2.2 s):** Karoya tek bir ışık damlası düşer, ayna gibi düzleşen bir birikinti olur → önce yansıma birikintinin içinde belirir → okçu yansımanın "üstünden" ters dönerek yukarı doğrulur (ayna simetrisi).
**Saldırı "Ayna Atışı" (2.5 s):** *Hazırlık:* okçu yayı gerer; yansıma da gerer. *Yol:* okçunun oku düz uçar; yansımanın oku **zeminin altından** (birikintiden çıkıp yere paralel) aynı hızda ilerler. *Temas:* iki ok hedefte üstten ve alttan buluşur, dikey ışık çizgisi + yatay ayna parlaması, **hit-stop 90 ms**. *Takip:* yansıma okçudan önce yayını indirir.
**Ölüm:** Birikinti çatlar, yansıma kırılır; okçu kendi yansıması olmadan bir an "düz" durur, sonra cam kırıklarına dağılır.
**İmza an (etkisiz kart):** "Yansıma her zaman bir adım önde": her hareket ikili; çağırma sesi ayna gecikmeli tek nota.
**Kart resmi:** Gece gölünde ok atan okçu, alt yarıda ters yansıma ve yansımanın farklı yöne bakan gözleri.
**SFX:** idle — tek tel "ting" + 80 ms sonra alt oktav yankısı; çağırma — damla "tıp" + cam düzleşme + ters kurulma vınlaması; saldırı — yay tıngırtısı, üstten ok ıslığı + alttan boğuk ok ıslığı, temas iki notalı çan; ölüm — cam çatlağı + kırılma.
**En yakın kart:** `shade_assassin` (aynı ATK sınıfı) ve `lumen_sprite` — fark: yansıma ve alttan ok.

### C5 · `scrap_raiders` — Hurda Akıncıları / Scrap Raiders
ATEŞ / Savaşçı · Sv4 · 2000/0 · 64 (geniş) · `attackThenDefense`

**Kural:** "Bu kart saldırı ilan ettikten sonra, savaş aşaması bittiğinde hâlâ sahadaysa savunma pozisyonuna geçer ve senin bir sonraki turunda pozisyon değiştiremez."
**Motor:** M15. Saldırı **ilan edildiyse** ve kart hâlâ sahadaysa her durumda: `chains_of_light`, `sandstorm`, `mirror_barrier` (yaşadıysa), `magic_hat` / `decoy_target` / jeton yönlendirmesi dahil. Tek istisna: sahadan ayrıldıysa (`homecoming`, yok olma). `lockPositionTurn = turn + 2`. Volkan +500 → 2500.
**CPU:** yalnız öldürücü ya da canavar yok eden saldırılarda.
**Kimlik:** Hurda el arabası-tanka tıkışmış üç goblin (pedalcı, anahtarlı, sapanlı); dikenli tampon koçbaşı, kömür sobası egzozu, bayrak. Rampalar: `stone`, `earth`, `leaf`, `fire`.
**Idle (16 f):** Atışırlar, araba takırdar, egzoz puf puf, düşen cıvatayı sapanlı yerine fırlatır.
**Çağırma (2.4 s):** Yukarıdan hurda yığını düşer → goblinler fırlar → 3 çekiçle arabayı çatar → soba "vuf", tezahürat.
**Saldırı "Hurda Hücumu" (2.6 s):** *Hazırlık* 700 ms: geri pedal, tekerlek kıvılcımı. *Yol:* zıplayarak hücum; bir goblin düşer, arkadan koşar. *Temas:* koçbaşı, **hit-stop 110 ms**, cıvata ve dişliler. *Takip* — imza: tekerlek çıkar, **yorgun savunma pozu** (ter, duman); kilit boyunca bu guard oynar.
**Ölüm:** Araba hurdaya çöker, goblinler üç yöne kaçar.
**İmza an:** Görünür kilit: tekerleği tamir eden goblin; sonraki turun sonunda tekerlek takılır = kilit bitti.
**Kart resmi:** Üç çeyrek açıdan hücum eden araba, bağıran goblinler, kıvılcım, alev.
**SFX:** idle — formant cıvıltı atışma + `clank` takırtı; çağırma — hurda tangırtısı + 3 çekiç + soba "vuf" + tezahürat; saldırı — pedal devri, tekerlek cıyaklaması, metal çarpışma (`clank` 1.41 + `thump` 70 Hz + `crack`); yorgunluk — hırıltılı nefes; ölüm — inen `clank`lar + L/C/R cıyaklar.
**En yakın kart:** `windmane_knight` — fark: araç, üçlü kadro, yorgunluk.

### C6 · `hollow_ogre` — Kovuk Devi / Hollow Ogre
TOPRAK / Canavar-Savaşçı · Sv4 · 1400/900 · 64 · `banishGraveBoost400`

**Kural:** "Turda 1 kez, Ana Aşamanda: mezarlığından en çok 2 canavarı oyundan çıkar. Bu kart bu tur, çıkarılan her canavar için +400 ATK kazanır."
**Motor:** M1 + M12 + M20. Yasal: açık, kullanılmamış, kendi mezarlığında ≥1 canavar. `chooseCount` (1..min(2, n)) → kendi mezarlığının en **eski** canavarları (son ölen korunur). Her biri `banish`; sonra `addBoost(400·k, 0)`. En çok 2200.
**CPU:** yalnız bonus bir yok etmeye ya da öldürücü hasara yetiyorsa; en az sayı.
**Kimlik:** Yıldırım çarpmış **içi boş bir kütükten** oluşmuş kambur dev: göğsü bir **kovuk** (içinde karanlık ve iki kor göz), kolları kalın kök demetleri, bir eli budaklı bir kütük-sopa; omuzlarda mantar ve yosun, sırtta kırık dallardan yele. Primat değil; ağaç gövdesi.
Rampalar: `earth` (kabuk), `leaf` koyu (yosun), `void` (kovuk içi, çıkarılan ruhlar), `gold` soluk (kovuk gözleri).
**Idle (16 f):** Gövde ağaç gibi rüzgarda gıcırdar; kovuktaki gözler kırpışır; köklerin uçları zemini yoklar; arada kovuktan bir ateşböceği çıkıp geri girer.
**Çağırma (2.2 s):** Ekranın üstünden dev bir kütük **dikine düşer**, karoya saplanır, toz → kabuk bir kapı gibi içeriden yarılır → dev omuzlarını çıkarıp adım atar ve sopayı yere **çakar** (zemin sekmesi).
**İmza an — Kovuğa ekim (0.8 s + k × 0.7 s):** Dev sopasını mezarlığına uzatır; mezarlıktaki **gerçek kartların** canavarları %50 boyda mor ışık tohumuna büzülür; her tohum havada yay çizip **kökünün ucuna** konar ve kök onu sarıp gövdeye çeker →
tohum kovukta bir **budak ışığı** olarak yanar (ağız/yutkunma yok), sopanın üstünde bir yeni dal filizlenir (+400 tık). Sonunda kovuk iki budak ışığıyla parlar.
**Saldırı "Kütük Ezmesi" (2.5 s):** *Hazırlık:* sopayı kökleriyle kaldırır; güçlendiyse sopada 1–2 parlayan filiz. *Yol:* iki ağır adım (kökler her adımda yere tutunur). *Temas:* tepeden ezme, **hit-stop 100 ms**, kıymıklar + yaprak; güçlendiyse filizlerden mor polen patlar. *Takip:* sopayı omzuna atar.
**Ölüm:** Kökler çözülüp yılan gibi karoya geri çekilir, gövde içe çöker; geride tek bir filiz kalır ve solar.
**Kart resmi:** Gece ormanında kovuğunda iki göz parlayan dev, sopası mor tohumlarla tutuşmuş.
**SFX:** idle — ahşap gıcırtısı (180 Hz yavaş perde kayması) + ateşböceği tıkı; çağırma — düşen kütük ıslığı + saplanma (`thump` + kıymık `crack`) + kabuk yarılması + sopa çakma;
ekim — tohum ıslığı (yükselen sinüs) + kökün sarma hışırtısı + **budak "tok"** (içi boş ahşap rezonansı, bant 300–600 Hz; ıslak yutkunma yok); saldırı — ağır adımlar, ezme (ahşap `thump` + kıymık); ölüm — kökler kayarken toprak hışırtısı + son tek yaprak.
**En yakın kart:** `thorn_lurker` (bitki) — fark: dev, mezarlıkla beslenir; S3 Boşluk Gözü — fark: tek tek yutma yok, ekim.

### C7 · `crag_axeman` — Kaya Baltacı / Crag Axeman
TOPRAK / Savaşçı · Sv4 · 1600/1300 · 64 · Normal canavar
**Tat metni:** "Dağı ikiye yarmak için tek bir savuruş yeter derler. O hiç ikinciye gerek duymadı."
**Kimlik:** Geniş göğüslü dağ savaşçısı; baltası **tek ağızlı ve bir kayadan yontulmuş, sapı sarmaşıkla sarılı**; kaba kürk, taş örgülü sakal, miğfer yerine alnında boya şeritleri. Silüet: omuzdaki balta başı ikinci kütle. Rampalar: `stone`, `earth`, `skin`.
**Idle (16 f):** Baltayı omzunda dinlendirir, boynunu çevirir, balta başını yere vurur, sakal taşları sallanır.
**Çağırma (2.2 s):** Bir kaya yuvarlanıp durur → içeriden balta kayayı deler → kaya yarılır, baltacı adım atar, nara.
**Saldırı "Dağ Yaran" (2.6 s):** *Hazırlık:* 360° dönüş. *Yol:* 3 ağır adım. *Temas:* tepeden yarma, çatlak hedefe koşar, **hit-stop 110 ms**. *Takip:* baltayı söküp omzuna atar.
**Ölüm:** Balta yere saplanır; kendi bıraktığı parlak yarık gövdesinden yukarı tırmanır ve baltacı **o çizgi boyunca ikiye ayrılır**, iki yarı zıt yöne devrilir (taşa dönme yok).
**İmza an:** "Yarık": her vuruş zeminde 1.5 s kalan parlak çatlak bırakır; ölüm de bu çatlakla gelir.
**Kart resmi:** Savuruşun tepesinde baltacı, balta başı doğan güneş gibi silüet.
**SFX:** idle — balta tıkırtısı; çağırma — kaya yuvarlanması + yarılma + nara; saldırı — dönme vınlaması, adımlar (**90 Hz çakıl ezilmesi**: kısa `thump` + taneli gürültü), yarma (`thump` 40 Hz + `crack`) + çatlak "çıtırtı koşusu" (L→R); ölüm — tek uzun yırtılma `crack` + iki ayrı devrilme.
**En yakın kart:** `windmane_knight`, `stone_sentinel` — fark: barbar, dönme + yarık, ikiye ayrılma.

### C8 · `reed_heron` — Sazlık Balıkçılı / Reedwater Heron
SU / Kanatlı Canavar · Sv4 · 1400/1500 · 64 · Normal canavar
**Tat metni:** "Sisin içinde tek ayak üstünde bekler. Gagası suyu bozmadan iner."
**Motor:** yok. Körfez +400 → 1800.
**Kimlik:** Uzun bacaklı, insan boyunda bir **balıkçıl kılıç ustası**: gagası ince, uzun bir kılıç gibi çelik kaplı; kanat uçları hasır pelerin; koyu saz suyunda tek ayak üstünde durur, çevresinde alçak sis. Sürüngen yok, çamur yok.
Rampalar: `PAL.mist/white` (tüyler, sis), `night` + `water` (koyu su), `leaf` koyu (sazlar), `stone` (gaga kılıç).
**Idle (16 f):** Tek ayak üstünde mutlak dinginlik; yalnız sis akar ve sazlar sallanır; döngüde bir kez boyun yavaşça "S" kurar; ara sıra suya bir damla düşer.
**Çağırma (2.3 s):** Karonun üstüne sis yuvarlanır, koyu su ve sazlar belirir → sisin içinde önce bir göz parıltısı → sis ikiye açılır, balıkçıl zaten oradadır (hareketsiz) → kanatlarını bir kez açıp kapar.
**Saldırı "Gaga Hamlesi" (2.4 s):** *Hazırlık:* boyun tamamen geri kıvrılır (yay). *Yol:* sisli bir süzülüşle iki uzun adım. *Temas:* boyun bir anda açılır, **üç ışık hızında gaga dürtüşü** (mikro hit-stop 40/40/**80 ms**), su damlaları; *Takip:* tek ayağa geri döner, sis kapanır.
**Ölüm:** Kanatlarını kapar, geri adım atarak sisin içine çekilir; sis incelir, geride yalnız sazlar ve suda dalga halkası kalır.
**Kart resmi:** Sisli sazlıkta tek ayak üstünde balıkçıl, gagası ay ışığında tek çizgi parlıyor.
**SFX:** idle — kurbağa korosu altlığı (çok sessiz) + saz hışırtısı; çağırma — sis "fşş" + kanat "fuff"; saldırı — boyun gerilmesi (gıcırtısız yay), üç gaga "tak" (2.4 kHz) + çelik çınlaması; ölüm — kanat kapanması + suyun tek halka sesi.
**En yakın kart:** `storm_hawk` (kuş) — fark: dalış yok, yerde sis ve gaga; `shade_assassin` — fark: birikintiden kayma yok.

### C9 · `kite_fencer` — Uçurtma Eskrimci / Kite Fencer
RÜZGAR / Savaşçı · Sv3 · 900/600 · 48 · `doubleAttackMonster`

**Kural:** "Bu kart her Savaş Aşamasında iki kez saldırabilir. İkinci saldırı yalnızca bir canavara yapılabilir."
**Motor:** M16. Doğrudan saldırı yalnız ilk saldırıda. `wing_lady` ile 1200; `battle_cry` ile tek doğrudan 1900 + bir canavar saldırısı (tek tur öldürme yok). `chains_of_light` savaşı bitirir.
**CPU:** önce zayıf canavar hedefi, ikinci saldırıyı ancak güvenliyse.
**Kimlik:** İnce eskrimci; sırtına bağlı **uçurtma bezinden** (bambu çıtalı, renkli paneller) bir pelerin, pelerinden yere sarkan uzun uçurtma ipi; tek ince meç; yüzü bez maskeli. Kuş yok, tüy yok.
Rampalar: `fire` ve `gold` açık tonları (uçurtma panelleri), `earth` (bambu), `stone` + `PAL.mist` (meç).
**Idle (16 f):** Eskrim duruşunda mikro sekmeler; pelerin rüzgarla şişip söner, ip kuyruğu yerde kıvrılır; maske kurdeleleri dalgalanır.
**Çağırma (2.2 s):** Ekranın üstünden kopmuş bir uçurtma **yaprak gibi sallanarak** karoya düşer, yere serilir → bezin altından bir kabarıklık kalkar → eskrimci bezin altından doğrulur, uçurtma pelerin olarak sırtına oturur, meçi selam için kaldırır.
**Saldırı "Çift Pike" (1. saldırı 1.8 s, 2. saldırı 2.2 s — bilerek farklı):**
*1.* düz hamle: iğne inceliğinde iz, **hit-stop 60 ms**; dönüşte pelerinin bir paneli parlar (kalan saldırı işareti).
*2.* (yalnız canavara) pelerin rüzgarla açılır, eskrimci uçurtma gibi **yerden yükselir**, ipin ucundan sarkaç yayıyla süzülüp hedefi yandan keser, **hit-stop 80 ms**; panel söner.
**Ölüm:** Uçurtma ipi koparcasına gerilir ve kopar; pelerin rüzgarla ekran dışına uçar, geride kalan eskrimci incelip bez parçasına dönüşür, meç tangırdar.
**Kart resmi:** Gün batımında ipinden yükselen eskrimci, açık uçurtma pelerini, meç önde.
**SFX:** idle — bez çırpınması + ip vızıltısı (gergin tel, düşük kazanç); çağırma — sallanan bez hışırtısı + yere serilme + kalkış; saldırı 1 — "fsst" + 4k metal çın; saldırı 2 — rüzgarla şişen bez "vump" + ip gerginliği yükselen tel + kesik; ölüm — ip kopması "tın" + uzaklaşan bez hışırtısı.
**En yakın kart:** `storm_hawk` — fark: dalış yok, uçurtma sarkacı; R3 — fark: tüy yok.

### C10 · `mudgrasp_spirit` — Çamur Pençe Ruhu / Mudgrasp Spirit
TOPRAK / Şeytan · Sv4 · 700/1800 · 64 · `defenseAttackedPin`

**Kural:** "Savunma pozisyonundayken saldırıya uğrarsa: savaştan sonra saldıran canavar savunma pozisyonuna geçer ve sahibinin bir sonraki turunda pozisyon değiştiremez."
**Motor:** M15. Savaş sonrası görevlerde `tideBurn`'den sonra. Saldıran hâlâ sahadaysa: `defense`, `lockPositionTurn = turn + 2`. Bu kart yok olsa bile çözülür. **CPU:** kapalı duvar; saldırıyı kilit maliyetiyle puanla.
**Kimlik:** Yere yarı gömülü kambur kil ruhu: çamur tümsek, çatlak kil maske, çok sayıda uzun çamur kol; mor gözler. Rampalar: `earth`, `stone`, `void`.
**Idle (16 f):** Sırtta kabarcıklar patlar, parmaklar yere trampet çalar, gözler maskenin ardından bakınır.
**Çağırma (2.2 s):** Zemin çamur girdabına yumuşar → iki el fırlayıp karonun kenarlarını kavrar → gövdeyi çeker → maske yerine oturur.
**Saldırı "Çamur Atışı" (2.3 s):** avuç dolusu çamur → yapışkan topak yay çizer → "şlap", **hit-stop 60 ms** → eller yere gömülür.
**Ölüm:** Maske kayar; gövde **sıvılaşıp** karonun çatlaklarından yere geri akar (girdap tersine döner), maske en son batar; kuruma/ufalanma yok.
**İmza an — Pençe kilidi (1.6 s):** Savaştan sonra saldıranın altından çamur eller fışkırır, ayaklarını kavrar, 6 px çamur halkasına çeker, guard pozuna zorlar; kilit boyunca karoda kımıldayan ellerle bir çamur halkası **durum aurası** kalır.
**Kart resmi:** Ortada maske, izleyiciye uzanan çamur eller.
**SFX:** idle — glub + parmak trampeti; çağırma — vantuz "şlop" (600 Hz) + el şaplağı; saldırı — "şlap"; imza — gürleme + kavrayan vantuz + inilti; ölüm — giderden akan su gibi yükselen-inen glub + son "glk".
**En yakın kart:** `thorn_lurker`, `chasm_trap` — fark: kilitler, yok etmez.

### C11 · `steppe_spiralhorn` — Bozkır Boynuzlusu / Steppe Spiralhorn
RÜZGAR / Canavar · Sv4 · 1500/1400 · 64 · Normal canavar
**Tat metni:** "Bozkırın rüzgarı onun izinden eser. Sarmal boynuzlarından geçerken ıslık çalar."
**Motor:** yok. `wing_lady` ile 1800.
**Kimlik:** Uzun bacaklı, boynu kalın bir bozkır antilobu (saiga benzeri iri, sarkık burun), iki çok uzun **sarmal boynuz**; boynuzlardan rüzgar geçince ıslık; çimen yele, beyaz karın. Taç yok.
Rampalar: `earth`, `gold` (boynuz uçları), `leaf`, `PAL.white`.
**Idle (18 f):** Kulak seğirmesi, iri burun koklar, yele dalgalanır; esinti olunca boynuzlar ıslık çalar (görsel: boynuz uçlarında minik rüzgar kıvrımı).
**Çağırma (2.3 s):** Esinti çimeni dalga gibi büyütür → antilop ekran dışından uzun yaylı sıçrayışla girer → toynak uçlarına konar.
**Saldırı "Bozkır Sıçrayışı" (2.5 s):** şahlanma → üç sekme, her kalkışta çimen izi ve rüzgar halkası → boynuz darbesi, **hit-stop 80 ms**, tohum patlaması → geri seker.
**Ölüm:** Zarifçe çöker, gövde tohum/çimen bulutuna dönüşüp rüzgarla savrulur.
**Kart resmi:** Batan güneşin önünde havada antilop, sarmal boynuzlar silüet.
**SFX:** idle — çimen hışırtısı + boynuz flüt notası (nefesli sinüs, nadiren); çağırma — esinti + toynaklar ×4; saldırı — burun soluğu, toynak + esinti ×3, temas boynuz `crack` + `thump`; ölüm — uzayan son flüt notası + tohumlar.
**En yakın kart:** `ember_wolf` — fark: sekme, rüzgar, zarafet.

### C12–C15 · Kutup ailesi (Mıknatıs üçlüsü + birleşik)

**Aile dili:** cilalı manyetit taş-metal zırh; **K kutbu `fire`**, **G kutbu `water`**, bağlayıcı **`gold`**; zırh `stone` + `PAL.steel`. Parçalar *alet* temalıdır (örs, bobin, pusula iğnesi) — kılıç / U-mıknatıs / top yok.
Idle'larda demir tozu alan çizgileri boyunca döner. Aile sesi: 110/111 Hz vuruşan iki sinüs + metalik `glassRain`; perdeler İğne 220, Örs 82, Bobin 147 Hz.
**Metinler** (her parça diğer ikisini adlandırır):
- İğne: "Kutup parçası. Kutup Örsü ve Kutup Bobini ile birlikte Kutup Hükümdarı'nı çağırmak için kurban edilebilir."
- Örs: "Kutup parçası. Kutup İğnesi ve Kutup Bobini ile birlikte Kutup Hükümdarı'nı çağırmak için kurban edilebilir."
- Bobin: "Kutup parçası. Kutup İğnesi ve Kutup Örsü ile birlikte Kutup Hükümdarı'nı çağırmak için kurban edilebilir."

#### C12 · `polar_needle` — Kutup İğnesi / Pole Needle · TOPRAK / Kaya · Sv4 · 1500/1100 · 64 · `magnetPiece`
**Kimlik:** İnce, uzun bacaklı bir dansçı-savaşçı; gövdesi dikine bir **pusula iğnesi** (üst ucu K turuncusu, alt ucu G mavisi), elinde aynı iğneden kısa bir mızrak; başında dönen küçük pusula gülü. **Idle:** tüm gövde pusula gibi hafifçe titreyip rakip tarafa döner.
**Çağırma (2.1 s):** İğne havadan dikine iner, karonun ortasında ucunun üstünde **pusula gibi 2 tur döner**, sallanarak rakibe kilitlenir; kollar ve bacaklar açılır.
**Saldırı "Kıskaç Hamlesi" (2.4 s):** *Hazırlık:* mızrağı uzatır. *Yol:* hedefin iki yanında turuncu ve mavi iki **alan çizgisi parantezi** "( )" belirir ve kapanır — hedef yerinde **kilitlenir** (çekme yok). *Temas:* iğne parantezlerin arasından geçen tek hamle, **hit-stop 80 ms**, parantezler kırılır.
**Ölüm:** Görünmez bir kuvvet iğneyi gövdeden söker, iğne çılgınca dönerek ekran dışına uçar; levhalar düşer.
**Kart resmi:** Dönen pusula gülü üstünde ucunda duran iğne-savaşçı, turuncu uç en parlak.
**SFX:** idle 220 Hz uğultu; çağırma — dönen pusula tıkırtısı (yavaşlayan) + kilit "tik"; saldırı — iki parantez kapanması (L/R zıt pan "tşk") + delme çınlaması; ölüm — sökülme "şvuup" + levhalar.

#### C13 · `polar_anvil` — Kutup Örsü / Pole Anvil · TOPRAK / Kaya · Sv4 · 1100/1700 · 64 · `magnetPiece`
**Kimlik:** Bodur, geniş; gövdesi kara demir bir **örs** (üst yüz düz, boynuz ucu öne), iki kalın çekiç-kol, alt tabanında G mavisi alan halkası. **Idle:** örs yüzeyinde mavi kıvılcım çizgileri nabız atar, çekiç-kollar örse tık tık vurur.
**Çağırma (2.1 s):** İki yarım örs iki yandan kayar, aralarında mavi ark, **"KLAK"** diye birleşir, kıvılcım fıskiyesi, kollar açılır.
**Saldırı "İtme Dalgası" (2.4 s):** *Hazırlık:* iki çekiç-kolu örse vurur. *Yol:* örsten genişleyen mavi alan halkaları. *Temas:* hedef **geri itilir** (4 px), **hit-stop 90 ms**.
**Ölüm:** Kutuplar çılgınca yer değiştirir (turuncu/mavi), örs parçaları birbirini iterek dışa patlar.
**Kart resmi:** Ön cepheden örs gövde, havada asılı kıvılcımlar, mavi halkalar.
**SFX:** idle 82 Hz + örs tıkırtısı; çağırma — "klak" (`clank` + kısa `thump`) + kıvılcım; saldırı — çekiç "dang" + inen FM itme dalgası; ölüm — perde titreşimi + patlama.

#### C14 · `polar_coil` — Kutup Bobini / Pole Coil · TOPRAK / Kaya · Sv4 · 1300/1400 · 64 · `magnetPiece`
**Kimlik:** Gövdesi bakır tel sarılı kalın bir **bobin silindiri**; omuzlarda iki küçük makara; tel uçları kollardan kırbaç gibi sarkar; ortada iki renkli çekirdek ışığı tellerin arasından sızar. **Idle:** teller boyunca ışık halkaları yukarı tırmanır, makaralar döner.
**Çağırma (2.1 s):** Karoda boş bir mil dikilir → havadan gelen bakır tel milin çevresine hızla **sarılır** (sarım sayısı arttıkça ışık parlar) → kollar ve bacaklar telden açılır.
**Saldırı "Tel Yörüngesi" (2.5 s):** *Hazırlık:* demir tozu 3 sivri dikene toplanır. *Yol:* dikenler hedefin çevresinde yörüngeye girer. *Temas:* üçü içe çakışır, **hit-stop 90 ms**.
**Ölüm:** Tel çözülür (makara tersine boş döner), gövde ip yumağı gibi incelir, sonunda boş mil devrilir.
**Kart resmi:** Işıklı sarımlar, iki renkli çekirdek, yörüngede dikenler.
**SFX:** idle 147 Hz + makara tıkırtısı; çağırma — hızlanan sarım vızıltısı (perdesi yükselen); saldırı — dairesel pan yörünge + üçlü "tşak"; ölüm — çözülen tel (perdesi düşen vızıltı) + mil "tok".

#### C15 · `polar_sovereign` — Kutup Hükümdarı / Pole Sovereign
TOPRAK / Kaya · Sv8 · 3000/2800 · 96 · ★ As · `magnetFusion`

**Kural:** "Normal Çağrılamaz ve kapalı konamaz. Sahandaki Kutup İğnesi, Kutup Örsü ve Kutup Bobini'ni kurban ederek elinden Özel Çağrılır. Bu kart yok edildiğinde: mezarlığında Kutup İğnesi, Kutup Örsü ve Kutup Bobini varsa ve sahanda 3 boş canavar alanı varsa, üçünü savunma pozisyonunda Özel Çağır."
**Motor:** M10 + M18. `specialSummon` yasal: elde, Ana Aşama, sahada (kontrolünde) her üç parçadan biri (açık ya da kapalı; jeton değil); Normal Çağırma hakkı harcanmaz; alan: kurbanlardan birinin alanı (ortadaki).
Olaylar: 3 × `tribute` + `toGraveyard`, `summon method:'special' from:'hand'`, `summonWindow('special')`. Ayrılma: yok olma (savaş ya da etki) sonrası görev; her parçanın en son kopyası; 3 boş alan; kısmi ayrılma yok. Kurban edilirse ya da elde/destede değilse tetiklenmez.
**Kenar durumları:**
(a) `legal.ts` `normalSummon`/`setMonster` üretiminden hariç (M10); `double_offering` onu açmaz.
(b) `gilded_cage`'deki parça **kurban edilemez** → birleşme yasal değil. Rakipten ödünç (S2/S8) bir parça kurban edilebilir; **sahibinin** mezarlığına gider.
(c) Hükümdar ödünçken yok olursa: kart **sahibinin** mezarlığına gider; ayrılma **sahibinin** mezarlığını ve **sahibinin** boş alanlarını denetler, parçalar sahibinin sahasına gelir.
(d) Ayrılmanın sayı sınırı yok: `soul_recall` ile dirilen Hükümdar yeniden yok olunca yeniden ayrılabilir (test). Kadran "bildi" ile yok olursa da ayrılır (test).
**CPU:** üç parça + Hükümdar varsa birleştir; parçaları elde biriktirmeye 2 puan; rakibin `void_eye`'ına karşı ayrılmayı hesaba kat.

**Kimlik:** Birleşim okunur kalmalı: **Örs** kalça ve geniş ayaklar (örs tabanı = kaide), **Bobin** göğüs (ışıklı sarımlar), **İğne** omuzlardan yükselen kollar + dev **pusula mızrağı**; başında havada dönen pusula gülü tacı. Sol yarı turuncu (K), sağ yarı mavi (G) parıltı.
Rampalar: `stone`, `PAL.steel`, `fire`, `water`, `gold`.
**Idle (20 f):** Sarımlarda ışık tırmanır; taç döner; mızrağın iki ucunda zıt nabız; ağır nefes (omuzlar 1 px).
**Çağırma — İMZA BİRLEŞME (6.0–6.5 s, cut-in dahil):**
1. (0.0) Üç parça kutup renklerinde parlar; zeminde üç alanı birleştiren dev bir **pusula gülü** demir tozundan çizilir; kamera merkeze çekilir, müzik düşer.
2. (0.8) Parçalar yükselir, kendi perdelerinde uğuldar; Örs ters dönüp kaide olur, Bobin üstüne oturur, İğne kol ve mızrağa ayrışır.
3. (2.0) **Üç KLAK**: her kenetlenmede **hit-stop 120 ms**, beyaz flaş, sarsıntı 3 / 4 / 5 px; her klak bir öncekinden bir ton aşağı.
4. (3.4) As cut-in: turuncu-mavi bölünmüş arka plan, hız çizgileri, "KUTUP HÜKÜMDARI!".
5. (4.6) İniş; demir tozu şok halkası, taç oluşur, mızrak yere vurulur, ATK 3000 rozeti.
**Saldırı "Pusula Fırtınası" (3.0 s):** *Hazırlık* 900 ms: mızrak elinde pusula gibi 3 tur döner ve hedefe **kilitlenir**. *Yol:* iki renkli alan çizgileri hedefin çevresinde kapanan bir pusula gülü çizer. *Temas:* mızrak gülün ortasına saplanır, kutup patlaması, **hit-stop 140 ms**, 5 px sarsıntı, demir tozu yağmuru. *Takip:* mızrak omza, taç yavaşlar.
**Ölüm / Ayrılma (2.4 s):** Birleşim çizgilerinden çatlar → **manyetik itme**: üç parça üç alana fırlar ve savunma pozunda iner (koşul tutarsa); tutmazsa üçü yere düşer ve kendi ölümleriyle söner.
**Kart resmi:** Alçak açıdan Hükümdar, mızrak kalkık, arkada pusula gülü biçimli alan çizgileri.
**SFX:** idle — 82/147/220 Hz akoru; birleşme — tozun çizimi (metalik `glassRain` süpürme), yükselme uğultuları, üç klak (`clank` ağır + **35 Hz demir gongu** + `crack`, her biri bir ton aşağı), cut-in vınlaması, iniş gongu;
saldırı — dönen pusula tıkırtısı hızlanır, kilit "TIK", gül çizimi (iki zıt perdeli FM), saplanma patlaması; ayrılma — çatlama + üç perdeye ayrılan akor + üç iniş.
**En yakın kart:** `seal_*` (birleşme teması), `crystal_wyrm` (as) — fark: fiziksel kenetlenme, üç klak, ayrılma.

---

## 7. Büyüler — kart kart

> Her büyü v3 **ortak açılış**la başlar (kart yükselir, turkuaz aura, rün halkası; ≤ 0.7 s); ardından imza (2.4–3.4 s, 1x).

### S1 · `well_pail` — Kuyu Kovası / Well Pail · Normal · `draw2` · tek kopya
**Kural:** "2 kart çek." (Destende en az 2 kart olmalı.)
**Motor:** `drawCard` ×2 (her çekişte mühür kontrolü; ilk çekiş kazandırırsa ikincisi yok). **CPU:** Ana Aşamada önce oyna (deste ≥ 5).
**İmza (2.6 s):** Oyuncunun tarafında (zemin açılmadan, karonun üstüne) taştan küçük bir **kuyu bileziği** ve ahşap **çıkrık** belirir → çıkrık kolu kendiliğinden döner, ip sarılır (cırcır) → ağzına kadar ışıklı su dolu bir kova yükselir, kenarından su taşar →
kova eğilir, sudan iki kart balık gibi sıçrayıp ele uçar (ikincisi suyu silkeler) → kova geri iner, çıkrık son bir tur atar, kuyu turkuaz zerrelere çözülür. Yüz, testi, çömlek yok.
**Kart resmi:** Çıkrıklı taş kuyu, yükselen kovada parlayan su ve iki kart silueti, ay ışığı.
**SFX:** çıkrık cırcırı (330 Hz ahşap tıklar, hızlanan), ip gerilmesi, su dolu kovanın "çalkala"sı, taşma şırıltısı, iki kart "şlap-fwip" (su sıçraması + kâğıt), iniş + son çıkrık tıkı.
**En yakın:** `fate_trade` (altın kitap, 2 çek 1 at) — fark: kuyu, su, atma yok.

### S2 · `puppet_string` — Kukla İpi / Puppet String · Normal · `controlUntilEnd`
**Kural:** "Rakibin sahasındaki 1 canavarı hedef al (jeton hariç): Bitiş Aşamasına kadar onun kontrolünü al." (Sahanda boş canavar alanı olmalı.)
**Motor:** M4. Kapalı da olabilir (kapalı gelir). Bu tur saldırabilir, kurban edilebilir (sahibinin mezarlığına). Bitiş Aşamasında (el sınırından önce) döner; sahibinde boş alan yoksa yok edilir. Ekipmanlar onunla gider. Şapka ve jeton hedeflenemez; Zıpkıncı Körfez altında hedeflenemez.
Kafesteki (S6) bir canavar alınırsa kilit **canavarla birlikte** sürer (kafes kart sahibinin B/T alanında kalır, sayaç değişmez).
**CPU:** en yüksek ATK'li rakip canavar; saldır ya da Sv7+ için kurban et.
**İmza (3.0 s):** Hedefin üstünde koyu altın bir **kuklacı haçı** → beş parlak ip iner, yıldız kancalarla uzuvlara takılır → gözlerine sarmal parıltı → **sarsak kukla adımlarıyla** (3 hop) senin alanına geçer, çevrilir. Tur boyunca ince bir ışık ipi kalır.
Dönüş (1.4 s): ipler beş "ping"le kopar, canavar sendeleyerek döner.
**Kart resmi:** Kuklacı haçı, iplerden sarkan canavar silüeti, kalp biçimli düğüm.
**SFX:** haç ahşap tok, ip "tsing" ×5 (stereo), takılma tıkları, sarsak ahşap adımlar + gıcırtı; dönüş: inen beş "ping" + sendeleme.
**En yakın:** `homecoming` — fark: alır, yukarıdan iplerle.

### S3 · `void_eye` — Boşluk Gözü / Void Eye · Normal · `destroyAllMonsters` · tek kopya
**Kural:** "Sahadaki tüm canavarları yok et."
**Motor:** M5, iki taraf, `guardian_charm` tek tek, şapka/jeton söner. Kül Ejderi dirilişi ve Hükümdar ayrılması tetiklenir. **CPU:** (rakip saha değeri − kendi) ≥ 2000.
**İmza (3.2 s):** Arena ışıkları kısılır → sahanın **üstünde, gökyüzünde** dikey bir yarık belirir ve dev bir **göz** gibi açılır (mor-siyah iris, yıldızlı göz bebeği); zemin hiç açılmaz →
göz bakışını sahaya indirir: tüm canavarlar **aynı anda** yerden kopar, yavaşça dönerek yukarı süzülür (tek tek yutma yok; tek kolektif yükseliş) → göz bebeği büzülür ve hepsini bir anda içine alır → göz kapanır (kapak iki kez kırpar), sahaya tek bir mor gözyaşı damlası düşer, 3 px sarsıntı.
**Kart resmi:** Bulutların arasından aşağı bakan dev göz, göz bebeğine doğru süzülen minik canavar silüetleri.
**SFX:** gökyüzü yarığı (yüksek cam gerilmesi), göz kapağı açılışı "şııııp" (yavaş açılan bant geçiren gürültü), yükseliş: 28 Hz yavaş şişme + yukarı süzülen koro (tremolo yok), göz bebeği büzülme tıkı (kuru, yakın), kırpışlar, damla "tıp".
**En yakın:** `mirror_barrier`, `chasm_trap` (zemin yarığı, tek canavar) — fark: gökyüzü, kolektif yükseliş, zemin açılmaz. C6 — fark: tek tek ekim yok.

### S4 · `sweeping_gale` — Süpürge Rüzgarı / Sweeping Gale · Normal · `destroyAllOppSpellTrap` · tek kopya
**Kural:** "Rakibin sahasındaki tüm Büyü ve Tuzak kartlarını (alan büyüsü dahil) yok et."
**Motor:** M5 (B/T). Kapalı kartlar açılmadan yok olur (`destroy` cardId taşır, animasyon bir kare yüzünü gösterir). Bu kartın aktivasyonuna yalnız `spell_seal` cevap verebilir (her Büyü aktivasyonundaki mevcut pencere); yok edilen kapalı tuzaklar açılamaz.
Tek geçişte: önce tüm kartlar yok edilir, sonra yan etkiler sırayla çözülür — `soul_leash` → canavar sahibine döner (boş alan yoksa yok); `gilded_cage` → canavar serbest; `spite_axe` → sahibinin deste üstüne + 500 hasar.
**CPU:** rakipte ≥ 2 B/T ya da tehlikeli alan büyüsü varsa.
**İmza (2.8 s):** Yeşil-beyaz dev bir **süpürge darbesi** rüzgarı rakibin arka sırasını uçtan uca süpürür → kartlar havalanır, döner → **platform kenarından boşluğa** düşer → alan büyüsü ortamı mum gibi söner.
**Kart resmi:** Geniş yaylı rüzgar süpürmesi, uçuşan kartlar, platform kenarı.
**SFX:** L→R geniş gürültü `sweep`, her kart: kâğıt şaklaması + uzaklaşan ıslık, alan sönmesi "vump", kuyruk ıslığı.
**En yakın:** `purging_wave` — fark: toplu, süpürge yayı, platformdan düşüş.

### S5 · `winnow_sieve` — Harman Eleği / Winnowing Sieve · Normal · `draw3Discard2` · tek kopya
**Kural:** "3 kart çek, sonra elinden 2 kart at. (Destende en az 3 kart olmalı.)"
**Motor:** `draw2Discard1` deseni: 3 × `drawCard`, sonra `discard` kararı `count: 2, cost: true`. **CPU:** en düşük değerli 2 kart (mühür parçası atma).
**İmza (3.0 s + seçim):** Oyuncunun tarafında hasırdan dev, yuvarlak bir **harman eleği** belirir, yatay ritimle sallanır (tane hışırtısı) → elekten üç kart altın buğday taneleri arasında yukarı zıplar ve ele düşer →
seçim sırasında elek alçakta bekler, taneler hafifçe kayar → seçilen 2 kart elekte **samana dönüşür** ve bir rüzgar onları sap saman hâlinde mezarlığa savurur.
**Kart resmi:** Gün ışığında sallanan elek, havada asılı taneler ve üç kart, savrulan saman.
**SFX:** elek sallaması (6 Hz ritmik tane hışırtısı, L/R), üç kart zıplaması (ahşap çerçeve "tok" + kâğıt), bekleme: sessiz tane kayması; savurma: hp saman hışırtısı + kısa rüzgar.
**En yakın:** `fate_trade` — fark: elek, tane, saman savrulması. S9 — fark: saman burada atılan kartların izidir, jeton yok (saman sesi kısa ve hafif; S9'unki kazık + karga).

### S6 · `gilded_cage` — Yaldızlı Kafes / Gilded Cage · Devamlı · `cageMonster3`
**Kural:** "Rakibin 1 canavarını hedef al ve açık hâle getir (ÇEVİR etkileri tetiklenmez). Bu kart sahadayken o canavar saldıramaz, pozisyon değiştiremez ve kurban edilemez. Rakibin 3. turunun sonunda bu kart yok olur. O canavar sahadan ayrılırsa bu kart da yok olur."
**Motor:** M7. `counter = 3`, `equippedTo = uid`. Kapalıysa `flip cause:'reveal'`. `legal.ts`: kafesli canavar saldıramaz, pozisyon değiştiremez, kurban (ve birleşme) listesinden düşer. Sayaç kafes sahibinin rakibinin her turunun sonunda azalır.
Kafesli canavarın kontrolü değişirse (S2/S8) kilit canavarı izler, sayaç aynı kalır. Kafes yok edilirse (`purging_wave`, `auger_lance`, `sweeping_gale`) canavar serbest. **CPU:** rakibin en yüksek ATK'li saldırganı.
**İmza (3.0 s):** Zincirle yaldızlı **kuş kafesi** iner, kapı çarpar → asma kilit 3 dili gösterir; içerideki canavar soğuk tona kayar, parmaklıklara yaslanır. Her sayaç: bir dil döner + çan. 0'da kilit düşer, kafes yukarı çekilir.
**Kart resmi:** Yaldızlı kafes, gölge canavar, parlayan asma kilit.
**SFX:** zincir (`link`), kafes gongu (`clank` 2.3), kapı + kilit tıkı; sayaç: dil tıkı + çan; serbest: kilit yayı + zincir geri sarılması.
**En yakın:** `dawn_swords` — fark: tek hedef, kafes ve kilit sayacı.

### S7 · `auger_lance` — Burgu Mızrağı / Auger Lance · **Hızlı** · `destroySpellTrapQuick`
**Kural:** "Hızlı Büyü. Sahadaki 1 Büyü/Tuzak kartını hedef al ve yok et. (Kapalı koyduğun turdan sonra, rakibin saldırı ilanında ya da canavar çağırmasında da aktive edebilirsin.)"
**Motor:** M11 (§2.1). Hedef: iki taraftaki herhangi bir B/T (kendisi hariç; alan büyüsü dahil). Saldırı penceresinde ekipman yok edilirse ATK savaştan önce yeniden hesaplanır.
**CPU:** kapalı tut; ekipmanlı saldırıda ekipmana ya da alan büyüsüne.
**İmza (1.8 s — bilerek kısa ve keskin):** Rakibin turunda açılırsa kapalı kart turkuaz zikzak çakmayla dikilir. Gökten çelik, sarmal oluklu bir **burgu mızrak** döne döne iner → hedef kartı köşesinin üstünde topaç gibi döndürür → oluklardan talaş gibi kıvrılan kırıklar fışkırır → kart delinir, mızrak yukarı geri çekilir.
**Kart resmi:** Bir kartı delen sarmal oluklu burgu, talaş kıvrımları.
**SFX:** 1k→8k ıslık, **120 Hz testere dişi rotor vızıltısı** (40 Hz AM yok), delme `crack`, talaş kıvrımları (perdesi yükselen kuru tıklar), geri çekilme "vuuş".
**En yakın:** `purging_wave`, S4 — fark: dikey burgu, tek hedef, hızlı zamanlama.

### S8 · `soul_leash` — Ruh Tasması / Soul Leash · Ekipman · `equipControl`
**Kural:** "Rakibin açık 1 canavarına kuşan (jeton hariç): bu kart sahadayken onun kontrolü sende. Rakibin her Çekme Aşamasında rakip 1000 LP kazanır."
**Motor:** M4 + M9 + M19. Gerekir: boş B/T + boş canavar alanı. Tasma yok olursa canavar sahibine döner (boş alan yoksa yok olur); canavar ayrılırsa tasma mezarlığa. **CPU:** rakibin en güçlü açık canavarı; rakip LP'si düşükse daha az.
**İmza (3.0 s):** Hedefin boynuna mor-altın deri bir **tasma** örülür → canavarın **gölgesi** gövdesinden ayrılır ve tasmadan tutulmuş gibi önden yürüyerek senin alanına geçer → gövde, gölgesine bağlı olduğu için kendi isteği dışında, sakin ama donuk adımlarla onu izler (çekiştirme / sürüklenme yok; kukla hopları yok) → gölge ve gövde senin alanında birleşir, tasma kilitlenir.
Kalıcı: canavardan tasma kartına ince ışık bağı. Rakibin her Çekme Aşamasında bağ nabız atar, yeşil ışık rakibin LP paneline akar (+1000).
**Kart resmi:** Parlayan tasma, gövdesinden ayrılmış gölgesi önde yürüyen bir canavar silüeti.
**SFX:** tasma örülmesi (deri gıcırtısı + zincir halkası `link`), gölgenin ayrılması (yumuşak yırtılma), gölge adımları (sessiz, boğuk "pat"lar) + gövdenin ağır adımları 1 vuruş geriden, kilit "klak"; LP nabzı (yumuşak çan).
**En yakın:** S2 — fark: ip ve hop yok; gölge önden yürür, kalıcı bağ. C1 — fark: çekiş yok.

### S9 · `straw_decoys` — Saman Korkuluklar / Straw Decoys · **Hızlı** · `strawTokens`
**Kural:** "Hızlı Büyü. Boş canavar alanı sayısının 1 eksiği kadar (en az 1) 'Saman Korkuluk' jetonunu (Sv1, 0/0) savunma pozisyonunda Özel Çağır. Jetonlar kurban edilemez. Bu kartı kendi turunda aktive ettiysen o tur başka canavar çağıramazsın."
**Motor:** M6 + M11. Jeton `CardId` `straw_decoy_token` (havuz dışı; sanat, inceleme, `describe.ts`, mezarlık paneli, ışık profili ve kart hash'i bu id'yi anahtar alır). 3 alanlı tahta, 3 boş → 2 jeton; 5 alanlı, 5 boş → 4.
Her zaman en az 1 alan boş kalır → kendi Normal Çağırman kilitlenmez. Doğrudan saldırı ilanına yanıt olarak açılırsa saldıran bir jetonu yeni hedef seçer (`magic_hat` `chooseTarget` deseni); canavara saldırıysa saldırı sürer.
Jeton yok olunca mezarlığa gitmez (`tokenVanish`). S2/S8 jetonu hedefleyemez. `toppling_tower` 0 ATK'ye cevap vermez. **CPU:** kapalı tut; ölümcül doğrudan saldırıda aç.
**İmza (2.6 s):** Boş alanlara yukarıdan ahşap **kazıklar** saplanır (tok) → saman demetleri rüzgarla kazığa sarılır, eski bir ceket ve çuval kafa takılır, kollar yana açılır → korkulukların düğme gözleri bir kez yanar; uzaktan bir karga gaklar.
Jeton idle: kollar rüzgarda sallanır, şapka kayar, omzuna konan bir karga silüeti arada uçar. Jeton yok olunca: saman bağı çözülür, demetler yere dökülür, kazık devrilir.
**Kart resmi:** Akşam tarlasında kolları açık üç korkuluk, uzaktan bakan bir karga, rüzgarda saman.
**SFX:** kazık "tok" (kuru ahşap, 3 farklı perde), saman sarılması (hışırtı), ceket şaklaması, düğme göz "tik", uzak karga "gak" (FM formant); yok olma: ip çözülmesi + saman dökülmesi + kazık devrilmesi. Hiçbir "pof" yok.
**En yakın:** `magic_hat` — fark: görünür jetonlar, karıştırma yok.

### S10 · `spite_axe` — Hınç Baltası / Spite Axe · Ekipman · `equipAtk800Return`
**Kural:** "Sahandaki 1 açık canavara kuşan: +800 ATK. Bu kart sahadan mezarlığa gönderilecek olursa, bunun yerine sahibinin destesinin en üstüne konur ve sahibi 500 hasar alır."
**Motor:** M9. `dropEquips` / `destroySpellTrap` içinde → `toDeck {from:'spellTrap', position:'top'}` sahibinin destesine + `damage 500` sahibine. Ödünç canavara kuşanmışsa da **sahibinin** destesine döner. Ejder Kılıcı (+700, bedelsiz kayıp) ile takas: +100 ve geri dönüş ↔ 500 LP ve ölü çekiş.
**CPU:** en yüksek ATK'li canavara; LP ≤ 500 iken oynama.
**İmza (2.8 s):** Yüz, kafatası yok. Kara demir, kor çatlaklı, **zincirle sarılı** ve sapı canlı damarlar gibi atan bir balta gökten iner ve canavarın **yanına zemine saplanır** (çatlak, kor kıvılcımı) → canavar eğilip sapı kavrar; damarlar koluna doğru tırmanır →
canavar baltayı yerden **söker** (zincirler gerilip şaklar), gözleri kor rengine yanar, ATK +800 yuvarlanır.
Dönüş (1.4 s): balta canavarın elinden kendiliğinden kayar, zincirlerini şaklatarak sahibinin deste yığınının üstüne çakılır; zincirlerden biri LP paneline kırbaç gibi vurur (−500).
**Kart resmi:** Kor çatlaklı, zincirli kara balta, sapında atan damarlar, yere saplı, çevresinde kıvılcımlar.
**SFX:** iniş ıslığı + yere saplanma (`thump` + ağır `crack`), damar nabzı (düşük vuruşan `drone`), söküş: uzun metal-toprak gıcırtısı + zincir şaklaması (`link` sert), dönüş: zincir uçuşu + desteye "güm" + kırbaç şaklaması.
**En yakın:** `dragon_blade` (rün kılıcı: yükselir, asılır, saplanır, rün halkası) — fark: rün halkası yok, balta yere saplanır ve canavar onu söker; dönüş + bedel.

### S11 · `page_turner` — Sayfa Çeviren / Page Turner · Normal · `handRefreshBoth`
**Kural:** "Her iki oyuncu elindeki tüm kartları mezarlığa gönderir, sonra gönderdiği kadar kart çeker."
**Motor:** M8. Sıra: aktive edenin eli → rakibin eli (`discard`), sonra aktive eden çeker, sonra rakip. Deste yetmezse çekebildiği kadar. Çekişler mühür setini tamamlarsa önce aktive eden kazanır. Mühür parçaları atılır (riskli).
**CPU:** kendi elinde ≤ 2 ve rakipte ≥ 4 kart varsa ya da kendi eli zayıfsa.
**İmza (3.4 s):** Sahanın ortasında havada dev, kapağı deri, sayfaları boş bir **kitap** açılır → iki oyuncunun elindeki kartlar sayfa gibi düzleşip kitaba uçar ve ciltlenir → kitap **"PAT"** diye kapanır, kendi kendine hızla sayfa çevirir (rüzgar) →
eski sayfalar kurutulmuş yaprak gibi basılı hâlde kayarak iki mezarlığa süzülür → kitap yeniden açılır, yeni sayfalar katlanıp kart olur ve ellere uçar → kitap kapanır ve rünlere ayrılır. Ateş, kül yok.
**Kart resmi:** Havada açık dev kitap, sayfaları kart olarak uçuşuyor, mürekkep yıldızları.
**SFX:** kitap açılışı (deri gıcırtısı + sayfa hışırtısı), kartların sayfaya ciltlenmesi (kâğıt şapırtısı ×n), kapanma "PAT" (sert, kuru, oda yankılı), hızlı sayfa fırfırı, mezarlığa süzülen yapraklar (yumuşak), yeni sayfaların katlanması (origami tıkları).
**En yakın:** v3 `discard` — fark: kitap ritüeli, iki el birden.

### S12 · `lucky_die` — Talih Zarı / Lucky Die · Normal · `diceBoost100`
**Kural:** "Bir zar at: sahandaki tüm açık canavarların ATK ve DEF'i bu tur, gelen sayı × 100 artar."
**Motor:** M3. `value = 1 + floor(nextRandom(s) * 6)`; her açık kendi canavarına `addBoost(100v, 100v)`. Açık canavar yoksa aktive edilemez. **CPU:** bonus yok etmeyi ya da öldürücüyü mümkün kılıyorsa.
**İmza (2.8 s):** Altın, koyu noktalı büyük piksel **zar** atılır, izometrik dönüşle 3 kez seker, toz → yuvarlanır, N'de durur → her noktadan bir altın kıvılcım canavarlara uçar, rozetler +N00. 6'da havai fişek ve akor; 1'de tek donuk "tok".
**Kart resmi:** Havada 6'yı gösteren zar, hareket yayları.
**SFX:** çıngırak sallama, atış, sekmeler (ahşap "tak" ×3), yavaşlayan yuvarlanma, durma; nokta başına pentatonik nota; 6'da çan akoru, 1'de düşük "tok".
**En yakın:** C2 — fark: havadaki para ve saat yerine seken ahşap zar.

---

## 8. Yeniden tasarımlar

### R1 · `ashen_drake` — Kül Ejderi / Ashen Drake (komple yeni)
KARANLIK / Ejderha · Sv7 · 2400/2000 · 96 · ★ As · **`ashRebirth`** (yeni)

**Kural (yeni):** "Bu kart yok edilip mezarlığa gönderildiğinde (savaş ya da etki): senin bir sonraki turunun başında (Çekme Aşamasından sonra) mezarlığından saldırı pozisyonunda Özel Çağrılır. Sahanda boş alan yoksa diriliş bir sonraki turuna ertelenir. Bu etki her Kül Ejderi için düelloda 1 kez kullanılır."
**Motor:** M13 + M21. Yok olma sonrası `internal.rebirth.push({uid, owner})`; sahibin her `beginTurn`'ünde çekmeden sonra: kart hâlâ mezarlıktaysa (diriltilmemiş, çıkarılmamış, desteye dönmemiş) ve boş alan varsa → `rebirth` + `summon special from:'graveyard'` + `summonWindow('special')`, sonra `oncePerDuel` işaretlenir.
Boş alan yoksa kayıt kalır ve sonraki turda yeniden dener (hak yalnız başarılı dirilişte harcanır). Kurban edilmek, ele dönmek, el yenilemede atılmak tetiklemez. Kovuk Devi onu çıkarırsa kayıt silinir.
**CPU:** Kül Ejderi'ni takasta rahat kullan (ilk yok oluşu "bedava" say). Rakipken: rakibin mezarlığına dokunan kart yok, kül yığını bozulamaz. Bunun yerine yok etmeden saf dışı bırak (`homecoming`, `puppet_string` + kurban, `soul_leash`), dirilişe `toppling_tower` ile cevap ver ya da dirilen Ejder'i ikinci kez yok etmeyi planla.

**Kimlik:** Sıkıştırılmış kül ve kömürden sıska-iskeletimsi bir ejder; kaburga çatlaklarından kor çekirdek; dumanımsı dikenlerden ibik. **Kanatlar zar değildir:** sürekli pul pul dökülüp yeniden oluşan kül tabakaları (kenarları kor ışıklı).
Duruş: **akbaba gibi tüneme** — kambur, kanatlar omuzlarda pelerin gibi, uzun boyun aşağı-öne "S"; kuyruk ucu için için yanan bir mangal. Rampalar: `void`, `stone`, `fire`.
**Idle (20 f):** Kanat kenarlarından kül pulları kopup süzülür ve yeniden katılır; göğüs koru 2 s'lik **çift vuruşlu kalp atışı**; baş tarar gibi sallanır; burundan duman.
**Çağırma (as, 4.4 s):** Karo kül yığınıyla örtülür → tepeden tek kor kıvılcımı düşer → kül halka hâlinde tutuşur → yığın kül hortumu olarak yükselir ve ejderi aşağıdan yukarı kurar (pençeler → göğüs koru "güm" → kanatlar kül fırtınasından açılır) → cut-in: savrulan kül pulları, kor gözler → iniş: kül şok halkası 1 s gri toz katmanı.
**Saldırı "Kül Fırtınası Nefesi" (3.0 s):** *Hazırlık* 900 ms: kanatlar açılır, kor alt yüzler, göğüs beyaz-sıcak. *Yol* 600 ms: içinde korlar gömülü gri **kül konisi** zeminde yuvarlanarak hedefe ilerler.
*Temas* — imza: bulut hedefi yutar, kısa sessizlik, sonra **tüm korlar aynı anda tutuşur**, **hit-stop 120 ms**, hedef turuncu içinde kara silüet. *Takip:* bulut incelir, kanatlar örtülür.
**Ölüm:** Gövde yukarıdan aşağı kül yığınına ufalanır, kor çekirdek yığına düşer. Diriliş hakkı varsa yığın mezarlık yığınına taşınır ve orada **tüten kül simgesi** kalır; yoksa soğuyup savrulur. (Kül/ufalanma sonu yalnız bu kartındır, §5.2.)
**İmza an — Küllerinden doğuş (2.6 s):** Mezarlıktaki tüten yığından bir kor ıslıkla boş alana fırlar → kül hortumu *ters* (önce kanatlar, sonra gövde), kor kalp iki kez atar → anka çığlığına benzeyen tiz-boğuk kükreme → kanat kenarları kalıcı olarak daha parlak kor (ikinci yaşam).
**Kart resmi:** Uçurumda kül yığınına tünemiş ejder, kanatlardan sağa savrulan kül akıntıları, kor göğüs, koyu mor gök. En parlak nokta: göğüs koru.
**SFX:** idle — **50 Hz çift kor kalp atışı** (yalnız bu kartın; başka kartta çift düşük vuruş yok) + seyrek kül çıtırtısı + duman soluğu;
çağırma — kıvılcım ping, tutuşma "vuf", kül hortumu (yükselen `sweep` + taneli brown), çekirdek "güm", hırıltılı-oyuk kükreme (Kristal'in parlak kükremesinden ayrı);
saldırı — nefes çekme, kül üfleme (lp 800→2.5k pink bant), sürünen gürleme, **gecikmeli tutuşma "VUF"** (ağır `crack` + ateş + cızırtı); ölüm — kül trickle, çekirdek düşüşü, tütme tıslaması döngüsü; diriliş — kor ıslığı + anka çığlığı + ters hortum.
**En yakın kart:** `crystal_wyrm` — fark: koni bulut ve gecikmeli tutuşma; `venom_drake` — fark: kül/kor, akbaba duruşu; `magma_titan` — fark: lav değil kül.

### R2 · `grim_warden` — Hortlak Muhafız / Grim Warden (yeniden tasarım)
KARANLIK / Şeytan · Sv6 · 2500/1200 · 80 · ★ As · `declareAtkDebuff400` (kural aynı)

**Kural:** "Saldırı ilan ettiğinde hedef canavarın ATK'si bu savaş boyunca 400 azalır." (değişmedi.)
**Motor:** değişiklik yok. **Sunum kancası:** motor −400'ü hasar hesabında, tuzak pencerelerinden **sonra** `activate kind:'monsterEffect'` (uid = muhafız) ile duyurur. "Emme" anı bu olaya bağlanır, `attackDeclare`'e değil:
saldırı geçersiz kılınırsa (zincirler, `homecoming`, `sandstorm`, `magic_hat`) emme hiç oynamaz. Kapalı savunma hedefinde olay gelmez → emme yok (doğru).
**Kimlik — "Fener Bekçisi":** Yırtık kukuletalı kefen içinde uzun, sıska bir mezar bekçisi hortlak; kafatasına geçirilmiş demir **kafes-miğfer** (içinde tek göz ışığı); bir elinde zincirde sallanan **ruh feneri**, öbüründe mezarcı kürek-teberi. Silüet: dikey gövde + yatay fener = "L".
Rampalar: `void`, `stone` + `PAL.steel`, `leaf3/leaf4` (soluk yeşil ruh ateşi), `earth`.
**Idle (20 f):** Fener 2 s'lik sarkaç; ruh ateşi zemine sallanan yeşil ışık havuzu düşürür; kefen şeritleri dalgalanır; göz ışığı tarar.
**Çağırma (as, kurban 1, 3.8 s):** Karoda mezar tümseği kabarır, mezar taşı fırlar → fener ışığı toprak çatlaklarından sızar → muhafız mezar taşını iterek yükselir, feneri kaldırır → cut-in: kafes-miğfer, göz ışığı.
**İmza an — Ruh ışığı emme (1.4 s, `monsterEffect` olayında):** Fener hedefe uzatılır; hedeften kendi element renginde bir **ruh ışığı ipliği** fenere akar (fener o renge döner), hedef %30 solar, ATK rozeti −400. Saldırının görsel hamlesi emme bitince başlar (ilan → kısa bekleme → emme → çarpma).
Hedef yaşarsa ışık geri döner; yok olursa fener tur sonuna dek o renkte kalır.
**Saldırı "Fener Tırpanı" (2.8 s):** fener başın üstünde tam daire → kefen dalgalanarak süzülür → fener çarpar (yeşil patlama) + teber süpürmesi, **hit-stop 100 ms** → fener sarkaca döner.
**Ölüm:** Fener düşüp kırılır, ruh ateşi kafatası biçimli sis olarak kaçar, miğfer düşer, kefen **boş** çöker ve solar.
**Kart resmi:** Mezarlık sisinde muhafız, feneri izleyiciye uzatmış (en parlak nokta), kafeste göz ışığı.
**SFX:** idle — sarkaç zincir gıcırtısı (`link`) + ruh ateşi `drone`; çağırma — toprak çatlağı + mezar taşı sürtünmesi + fener tutuşması + tritonlu koro;
emme — **`glassReverse` sifon** (bu katmanın tek sahibi) + hedefin perdesinden inen sinüs + "−400"de düşük çan; saldırı — zincir dönüşü, fener cam kırılması + hayalet vınlaması, teber; ölüm — fener kırılması, feryat, kumaş çöküşü, boş miğfer `clank`.
**En yakın kart:** `abyss_magus` — fark: fener emmesi ve zincir; `steel_silencer` — fark: makine değil hortlak.

### R3 · `wisp_imp` — Tüy Hayalet / Down Wisp (yeniden tasarım)
KARANLIK / Şeytan · Sv1 · 300/200 · 48 · `noBattleDamageOnDestroy` (kural aynı)

**Kural:** "Savaşta yok olursa sahibi o savaştan hasar almaz." (değişmedi.)
**Motor:** değişiklik yok. **Sunum kancası:** motor, hasar > 0 olup engellendiğinde `activate kind:'monsterEffect'` (impUid) yayar; "yastık" yalnız bu olaya bağlanır ve olayın taşıdığı (ya da hemen önceki `battle` olayındaki) engellenen miktarı gösterir.
Director hasarı kendisi yeniden hesaplamaz: savunmada hasarsız yok olan hayalette olay gelmez → yastık yok, tüyler rüzgarla savrulur.
**Kimlik:** Üst üste binmiş beyaz-leylak **kuş tüylerinden** gözyaşı biçimli çarşaf-hayalet; soru işareti gibi kıvrık tüy kuyruk; koyu yüz boşluğunda iki nokta göz; minik tüy eller. Rampalar: `PAL.mist/white`, `void`, `gold`.
**Idle (20 f):** Tembel bir sekiz çizerek süzülür; kenar tüyleri dalga dalga kalkar; bir tüy kopar, salınarak düşer, geri süzülüp yerine takılır.
**Çağırma (2.2 s):** Tek bir tüy sarkaç gibi salınarak düşer → karoya değer → tüy fıskiyesi girdapla hayaleti kurar → "bö!".
**Saldırı "Tüy Oku Sağanağı" (2.2 s):** kabarır (%130) → güdümlü tüy okları → 6 mikro dürtme, **hit-stop 60 ms**, tüyler yapışıp dökülür → söner.
**Ölüm + İmza an — Tüy yastık (2.0 s, olay geldiğinde):** Hayalet tüy bulutuna patlar, bulut sahibinin LP paneline uçup **yastık** olur → engellenen hasar sayısı yastığa çarpar, ezilir, "0 · KORUNDU" → tüyler pof diye dağılır. Olay yoksa: tüyler rüzgarla savrulur.
**Kart resmi:** Ay ışığında tüy yığınından bakan hayalet, havada tek tüy.
**SFX:** idle — filtreli 5k tüy hışırtısı + minik "hu"; çağırma — sarkaç vınlaması, tüy fıskiyesi, "bö" (formant "uu" 300 Hz); saldırı — kabarma, 6 minik "tsk", kumaş `thump`;
ölüm — **yastık "pof"** (oyundaki tek "pof" kimliği) + tüy bulutu, yastık yakalaması (lp `thump` + sekme), "KORUNDU" çanı.
**En yakın kart:** `lumen_sprite` — fark: tüy, karanlık katmanlar, yastık anı.

---

## 9. Açık sorular (sahibe)

1. **Yaldızlı Kafes mi (havuz 81), Şafak Kılıçları'na imza yenileme mi (havuz 80)?** (§0.2 — varsayılan: Kafes.)
2. **Kül Ejderi kural ayarı** (vanilla → küllerinden 1 kez doğar) onaylanıyor mu? Hayır derseniz yalnız sanat/animasyon yenilenir.
3. **Hızlı Büyü (M11)** yeni kart türü; Burgu Mızrağı ve Saman Korkuluklar'ın ruhu budur. Onay? (Hayırsa ikisi normal büyü olur.)
4. Kutup Hükümdarı ATK 3000 uygun mu?
5. **Kadran Soytarısı sınırı:** düelloda 1 kez (her kopya) + destede en çok 2. Alternatif: tek kopya ve turda 1 kez. Hangisi?
6. **Tek kopya kuralı** (Kuyu Kovası, Harman Eleği, Boşluk Gözü, Süpürge Rüzgarı) onaylanıyor mu?

## Sahip kararları (2026-10-31)
1. Yaldızlı Kafes: Şafak Kılıçları zaten aynı rolü yapıyor (Swords of Revealing Light) — sahibe soruldu; öneri: Kafes EKLENMEZ, Şafak Kılıçları'na yeni imza animasyon + ses yapılır (havuz 80).
2. Kül Ejderi "küllerinden doğar" kuralı: EKLENMEZ. Yalnız görünüm + tüm animasyonlar + sesler yeniden.
3. Hızlı Büyü: sahibe açıklandı, karar bekliyor.
4. Kutup Hükümdarı ATK 3000: ONAY.
5. Kadran Soytarısı: destede EN ÇOK 1 kopya, etkisi turda EN ÇOK 1 kez.
6. Kuyu Kovası, Boşluk Gözü, Süpürge Rüzgarı, Harman Eleği: destede TEK KOPYA — ONAY.
