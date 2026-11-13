// Phone / touch build switches (the Expo app in mobile/ sets window.__PRISM_MOBILE before boot;
// `?mobile=1` forces it in a browser for QA). Everything here is read once at module init.
//
// The desktop game never changes: every mobile-only path checks MOBILE first.

function detect(): boolean {
  try {
    const g = (globalThis as { __PRISM_MOBILE?: unknown }).__PRISM_MOBILE;
    if (g === true) return true;
    if (typeof location !== 'undefined' && typeof URLSearchParams !== 'undefined') {
      return new URLSearchParams(location.search).get('mobile') === '1';
    }
  } catch {
    /* no globals (tests, workers) */
  }
  return false;
}

/** True in the phone app (or with ?mobile=1). */
export const MOBILE: boolean = detect();

/**
 * Whole-number scale for small pop-up UI (context menus, tips) on a phone: the game's 640×360 canvas
 * is shown at roughly 1× CSS px there, so a 14-px menu row would be a ~5-mm target. 2× keeps the
 * pixels crisp and makes each row a comfortable finger target.
 */
export const TOUCH_UI_SCALE: number = MOBILE ? 2 : 1;

function detectOx(): number {
  if (!MOBILE || typeof window === 'undefined') return 0;
  const aspect = window.innerWidth / Math.max(1, window.innerHeight);
  const w = Math.round((360 * aspect) / 2) * 2;
  return Math.max(0, Math.min(80, Math.floor((w - 640) / 2)));
}

/**
 * Widescreen (src/view/wide.ts): extra canvas width on each side of the 640 frame on a wide phone
 * (0 everywhere else). Here, without Phaser, so art modules can widen their backdrops by it.
 */
export const WIDE_OX: number = detectOx();
