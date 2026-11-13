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
