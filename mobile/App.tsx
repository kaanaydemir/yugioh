// Prism Duel — the iOS / Android shell.
//
// The whole game is one self-contained HTML file (assets/game/game.html, built from the web game by
// `npm run build:game`). This app shows it full screen in a WebView, loaded from a local file: no
// server, works offline. Everything game-related (art, sound, rules) lives in the web game; this
// file only hosts it.
//
// Saves: the game keeps decks, settings and mute in localStorage. A WebView's localStorage for a
// local file is not guaranteed to survive app updates or OS cache clean-ups, so every write is
// mirrored to AsyncStorage (the app's own storage) and restored into the page before the game boots.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Asset } from 'expo-asset';
import { useKeepAwake } from 'expo-keep-awake';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

const BG = '#05060f';
const STORE_KEY = 'prism-duel/web-storage';

type Saved = Record<string, string>;

/** Runs in the page before the game's own scripts: restore the saves, mirror every later change. */
function bridgeScript(saved: Saved): string {
  return `(function () {
  var saved = ${JSON.stringify(saved)};
  var ls = null;
  try { ls = window.localStorage; ls.setItem('__probe', '1'); ls.removeItem('__probe'); } catch (e) { ls = null; }
  if (!ls) {
    // No usable localStorage for this page: an in-memory one (still mirrored to the app below).
    var mem = {};
    ls = {
      get length() { return Object.keys(mem).length; },
      key: function (i) { return Object.keys(mem)[i] || null; },
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; },
      setItem: function (k, v) { mem[k] = String(v); schedule(); },
      removeItem: function (k) { delete mem[k]; schedule(); },
      clear: function () { mem = {}; schedule(); }
    };
    try { Object.defineProperty(window, 'localStorage', { value: ls, configurable: true }); } catch (e) {}
  }
  for (var k in saved) { try { ls.setItem(k, saved[k]); } catch (e) {} }
  var timer = null;
  function flush() {
    timer = null;
    try {
      var all = {};
      for (var i = 0; i < ls.length; i++) { var key = ls.key(i); all[key] = ls.getItem(key); }
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'storage', data: all }));
    } catch (e) {}
  }
  function schedule() { if (!timer) timer = setTimeout(flush, 250); }
  if (typeof Storage !== 'undefined') {
    ['setItem', 'removeItem', 'clear'].forEach(function (name) {
      var orig = Storage.prototype[name];
      Storage.prototype[name] = function () { var r = orig.apply(this, arguments); schedule(); return r; };
    });
  }
  document.addEventListener('visibilitychange', function () { if (document.hidden) flush(); });
})();
true;`;
}

export default function App() {
  useKeepAwake();
  const [gameUri, setGameUri] = useState<string | null>(null);
  const [saved, setSaved] = useState<Saved | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [asset] = await Asset.loadAsync(require('./assets/game/game.html'));
        if (!asset.localUri) throw new Error('game file missing');
        setGameUri(asset.localUri);
      } catch (e) {
        setError(String(e));
      }
    })();
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORE_KEY);
        setSaved(raw ? (JSON.parse(raw) as Saved) : {});
      } catch {
        setSaved({});
      }
    })();
  }, []);

  const injected = useMemo(() => (saved ? bridgeScript(saved) : ''), [saved]);

  const onMessage = (e: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data) as { type?: string; data?: Saved };
      if (msg.type === 'storage' && msg.data) void AsyncStorage.setItem(STORE_KEY, JSON.stringify(msg.data));
    } catch {
      // not ours
    }
  };

  const gameDir = gameUri ? gameUri.slice(0, gameUri.lastIndexOf('/') + 1) : undefined;

  return (
    <View style={styles.root}>
      <StatusBar hidden />
      {error ? (
        <Text style={styles.error}>Prism Duel could not start: {error}</Text>
      ) : gameUri && saved ? (
        <WebView
          style={styles.web}
          source={{ uri: gameUri }}
          originWhitelist={['*']}
          // local file access (the game is one local HTML file)
          allowFileAccess
          allowFileAccessFromFileURLs
          allowUniversalAccessFromFileURLs
          allowingReadAccessToURL={gameDir}
          injectedJavaScriptBeforeContentLoaded={injected}
          onMessage={onMessage}
          // game feel: no page scrolling, bouncing, zooming or text selection
          scrollEnabled={false}
          bounces={false}
          overScrollMode="never"
          setBuiltInZoomControls={false}
          textInteractionEnabled={false}
          contentInsetAdjustmentBehavior="never"
          automaticallyAdjustContentInsets={false}
          // sound
          mediaPlaybackRequiresUserAction={false}
          allowsInlineMediaPlayback
          // rendering
          androidLayerType="hardware"
          webviewDebuggingEnabled={__DEV__}
          backgroundColor={BG}
          {...(Platform.OS === 'ios' ? { decelerationRate: 'normal' as const } : {})}
        />
      ) : (
        <View style={styles.loading}>
          <ActivityIndicator color="#5ff2ff" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  web: { flex: 1, backgroundColor: BG },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  error: { color: '#ff6b81', padding: 24 },
});
