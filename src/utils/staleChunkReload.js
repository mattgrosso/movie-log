// Self-heal for the mixed-version window around a deploy.
//
// Every route in this app is a lazy webpack chunk. When a new service worker
// activates (skipWaiting + clientsClaim) it purges the old precache — so a
// page still running the OLD app bundle can no longer load any chunk it
// hasn't already fetched: the old chunk files are gone from cache and from
// the server. Navigation then fails and the router renders nothing below the
// header ("the site is pretty broken"). A reload gets the new index.html and
// a self-consistent set of chunks, so that's the recovery — guarded to fire
// once per route per session so a genuinely-missing chunk can't reload-loop.

export function isStaleChunkError (error) {
  if (!error) return false;
  if (error.name === 'ChunkLoadError') return true;
  // Webpack: "Loading chunk N failed" / "Loading CSS chunk N failed".
  // Safari/Firefox dynamic-import wording differs, hence the alternates.
  return /Loading (CSS )?chunk .* failed|error loading dynamically imported module|Importing a module script failed/i
    .test(error.message || '');
}

export function handleRouterChunkError (
  error,
  to,
  storage = window.sessionStorage,
  reload = () => window.location.reload()
) {
  if (!isStaleChunkError(error)) return false;

  const key = `stale-chunk-reload:${(to && to.fullPath) || ''}`;
  let alreadyTried = false;
  try {
    alreadyTried = Boolean(storage.getItem(key));
    if (!alreadyTried) storage.setItem(key, '1');
  } catch {
    // Storage unavailable (private mode quirks): still reload, just without
    // loop protection — a reload is strictly better than a dead screen.
  }
  if (alreadyTried) return false;

  reload();
  return true;
}
