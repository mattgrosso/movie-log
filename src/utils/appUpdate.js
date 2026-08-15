// Shared machinery for applying a detected app update.
//
// Bug report (Matt, 2026-08-15): "why show that to them at all... just
// refresh the app automatically when the banner would be presented. The
// banner could still be a fallback." History matters here: an unconditional
// reload-on-update was removed in July for yanking the page out from under
// a long-running backfill — so automatic now means "only at a provably
// quiet moment", and the banner remains for the cases that never get one.

// Waits until no service worker install is in flight, so a reload lands on
// the NEW app instead of a mixed old/new state (the blank-screen bug the
// banner's Refresh already guards against). Capped; failures never block.
export async function waitForNewWorker (timeoutMs = 15000) {
  try {
    const registration = await navigator.serviceWorker?.getRegistration?.();
    if (!registration) return;
    await registration.update().catch(() => {});
    const deadline = Date.now() + timeoutMs;
    while ((registration.installing || registration.waiting) && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  } catch {
    // Any surprise here must never eat the reload itself.
  }
}

export async function reloadForUpdate () {
  await waitForNewWorker();
  window.location.reload();
}

// Is RIGHT NOW a safe moment to reload out from under the user?
// Pure-ish and injectable for tests. Unsafe whenever:
//  - a text input is focused (they're typing),
//  - a modal has the body scroll-locked (mid-flow),
//  - they're on a game screen (an in-memory round would be lost).
export function isSafeMomentForReload ({
  activeElement = document.activeElement,
  bodyClassList = document.body.classList,
  routePath = ''
} = {}) {
  const tag = activeElement?.tagName || '';
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag)) return false;
  if (bodyClassList.contains('no-scroll')) return false;
  if (routePath.startsWith('/games/')) return false;
  return true;
}

// One auto-attempt per detected target bundle, ever — if the reload doesn't
// actually get us onto the new version (stuck worker, cache oddity), the
// banner takes over rather than reloading in a loop.
const ATTEMPT_KEY = 'auto-update-attempted-for';

export function shouldAutoAttempt (targetBundle, storage = window.sessionStorage) {
  try {
    if (storage.getItem(ATTEMPT_KEY) === targetBundle) return false;
    storage.setItem(ATTEMPT_KEY, targetBundle);
    return true;
  } catch {
    return true; // storage unavailable: still better to try once than never
  }
}
