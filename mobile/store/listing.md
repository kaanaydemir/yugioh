# Prism Duel — App Store listing (draft)

The source of truth is `mobile/store.config.json` — push it with `npx eas-cli@latest metadata:push`
(texts, categories, age rating, URLs, review notes and screenshots in one go). This file is a readable copy.
Screenshots: `store/screenshots/` (iPhone 6.7"/6.9" slot, 2796 × 1290, landscape, five in order).

## App Information
- **Name** (30 max): Prism Duel
- **Subtitle** (30 max): Pixel-Art Hologram Card Duels
- **Primary category**: Games → Card. **Secondary**: Games → Strategy
- **Bundle ID**: com.kaanaydemir.prismduel · **SKU**: prismduel-ios-1
- **Content rights**: does not contain, show or access third-party content
- **Age rating questionnaire**: Cartoon or Fantasy Violence → Infrequent/Mild; everything else → None.
  (Monsters fight with pixel-art attacks; no blood, no gambling with real money, no user content, no web access.)

## Version 0.1.0
**Promotional text** (170 max)
Summon holographic monsters onto a neon arena and battle a friend or the CPU. Every card has its own hand-crafted pixel-art summon, attack and finale.

**Description**
Prism Duel is a fast, tactical card duel in a glowing isometric arena.

Build a deck from 80 original cards — dragons, golems, knights, spells and traps — then summon them as living holograms and battle for the last Life Point.

• Every monster has its own summon, attack and defeat animation, and its own sound
• Duel the CPU, or pass the phone and play a friend on the same screen
• Deck builder with presets, auto-fill and a level curve — drag cards in, drag them out
• Spells, traps, tributes, direct attacks and comebacks in short, readable turns
• Hand-drawn pixel art with soft real-time lighting; fills the whole screen on modern iPhones
• Plays fully offline. No ads, no accounts, no data collected

**Keywords** (100 max)
deck,builder,tcg,ccg,monster,summon,dragon,spell,trap,offline,2 player,tactics,battle,arena,strategy

**Support URL**: https://kaanaydemir.github.io/prism-duel/support/
**Marketing URL**: optional
**Copyright**: 2026 Kaan Aydemir
**Review notes**: No login needed. Tap the screen on the title, pick VERSUS CPU, choose a deck and play.

## App Privacy
- Data collection: **Data Not Collected** (the game keeps decks and settings on the device only;
  it makes no network requests, has no analytics, ads or accounts).
- **Privacy Policy URL**: https://kaanaydemir.github.io/prism-duel/privacy/ (pages in `privacy/` and `support/` at the repo root)

### Privacy policy text
> Prism Duel does not collect, store or share any personal information. The game runs entirely on
> your device: your decks and settings are saved locally and never leave it. The app has no ads,
> no analytics, no accounts and makes no network connections. Contact: <your support email>.

## Export compliance
`ITSAppUsesNonExemptEncryption = false` is already set in app.json (no encryption beyond the OS).
