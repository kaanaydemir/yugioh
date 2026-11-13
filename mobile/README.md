# Prism Duel — iOS / Android app (Expo)

The mobile app is a thin Expo shell around the web game. The whole game is built into one
self-contained page, `assets/game/game.html`, and shown full screen in a WebView from a local file
(no server, works offline). Art, sound and rules all live in the web game (`../src`).

## Update the game inside the app

From the repository root:

```bash
npm install                    # once, for the web game
node tools/build-mobile.mjs    # → mobile/assets/game/game.html
```

Commit the new `game.html`: EAS builds from the git repository.

## Try it on a phone without a Mac or an Apple account (Expo Go)

1. Install **Expo Go** from the App Store / Play Store.
2. On a computer (Windows is fine) with Node.js 20+:
   ```bash
   cd mobile
   npm install
   npx expo start --tunnel
   ```
3. Scan the QR code with the iPhone camera (Android: from Expo Go).

## Build for iPhone in the cloud (EAS, no Mac needed)

Needs a free Expo account and a paid Apple Developer account (99 USD / year).

```bash
cd mobile
npm install
npx eas-cli@latest login
npx eas-cli@latest build:configure          # once: links the project to your Expo account
npx eas-cli@latest build -p ios --profile production
npx eas-cli@latest submit -p ios            # uploads to App Store Connect → TestFlight
```

EAS creates and stores the signing certificates for you (answer "yes" when it asks to log in to
your Apple account). The build appears in TestFlight; install TestFlight on the iPhone to play it.

Android: `npx eas-cli@latest build -p android --profile preview` gives an installable APK.

## Settings worth knowing

- `app.json`: name, bundle id (`com.prismduel.game` — change before the first App Store upload if
  you want another one; it cannot change later), version, landscape lock, icon, splash.
- Saves (decks, settings, mute) are mirrored from the page's localStorage to the app's own storage
  (AsyncStorage) and restored on start, see `App.tsx`.
- The page sets `window.__PRISM_MOBILE = true`; the game then fills the phone screen instead of using
  whole-number zoom (`src/main.ts`, `fitZoom`).
