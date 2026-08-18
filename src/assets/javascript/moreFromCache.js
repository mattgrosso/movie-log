// A short memory for the "More from…" fetches.
//
// Each filter change costs up to ~7 sequential TMDB requests, and nothing
// remembered them — going back to a chip you used a minute ago refetched
// the lot. That is the latency you feel when flicking between chips, and
// it is also what made results overlap badly enough to need a sequence
// guard.
//
// What is cached is the RAW candidate list from TMDB, never the finished
// row. Ranking and exclusions are recomputed on every use, so a film you
// just rated — or sent to a hat — drops out of the suggestions at once
// however old the cached pool is. The cache only ever saves a network
// trip.
//
// Six hours (Matt, 2026-08-18: "I'm not gonna return to specific searches
// that frequently. Maybe it should be a little bit longer, but not so long
// that we miss out on new release movies"): new titles can only appear
// daily, and several of these paths deliberately exclude recent films
// anyway — genre skips anything under two years old, keyword under six
// months. So an evening's browsing never refetches, and anything genuinely
// new is picked up by the next day.
//
// In memory only. A reload starts fresh, which is a feature: it puts a
// natural ceiling on staleness without any storage to manage or grow.

export const TTL_MS = 6 * 60 * 60 * 1000;

// Enough for a long session of chip-flicking; old entries fall off oldest
// first rather than growing without limit.
export const MAX_ENTRIES = 40;

/**
 * A stable key for a filter. Everything that changes WHAT is fetched has to
 * be in here — a year range is two numbers, and a genre is fetched by id,
 * so "genre:Horror" and "genre:27" must not be allowed to collide.
 */
export function keyFor (filter) {
  if (!filter?.type) return null;

  const value = filter.value;
  const detail = value && typeof value === 'object'
    ? `${value.startYear ?? ''}-${value.endYear ?? ''}`
    : String(value ?? '').trim().toLowerCase();

  return [filter.type, detail, filter.genreId ?? ''].join('|');
}

export function createCache ({ ttl = TTL_MS, maxEntries = MAX_ENTRIES } = {}) {
  const entries = new Map();

  return {
    get (key, now = Date.now()) {
      if (!key) return null;
      const entry = entries.get(key);
      if (!entry) return null;

      if (now - entry.storedAt > ttl) {
        entries.delete(key);
        return null;
      }

      // Touch, so the things you actually return to are the last to go.
      entries.delete(key);
      entries.set(key, entry);
      return entry.value;
    },

    set (key, value, now = Date.now()) {
      if (!key || !Array.isArray(value) || !value.length) return;

      entries.delete(key);
      entries.set(key, { value, storedAt: now });

      while (entries.size > maxEntries) {
        entries.delete(entries.keys().next().value);
      }
    },

    clear () {
      entries.clear();
    },

    get size () {
      return entries.size;
    }
  };
}
