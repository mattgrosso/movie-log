// Caching the "More from…" candidates. The rule that makes a six-hour TTL
// safe: only the RAW TMDB list is cached, never the finished row — so
// exclusions and ranking still run every time and a film you just rated
// leaves the suggestions at once.
import { describe, it, expect } from 'vitest';
import { createCache, keyFor, TTL_MS } from '../assets/javascript/moreFromCache.js';

const films = (n = 1) => Array.from({ length: n }, (_, i) => ({ id: i + 1 }));

describe('keyFor', () => {
  it('separates one filter from another', () => {
    expect(keyFor({ type: 'genre', value: 'Horror', genreId: 27 }))
      .not.toBe(keyFor({ type: 'genre', value: 'Comedy', genreId: 35 }));
  });

  it('treats the same filter as the same however it was typed', () => {
    expect(keyFor({ type: 'general', value: 'Spiderman' }))
      .toBe(keyFor({ type: 'general', value: ' spiderman ' }));
  });

  it('keeps a genre apart from a plain search for the same word', () => {
    // "horror" the genre fetches by id; "horror" the search hits TMDB's
    // title search. Same word, entirely different results.
    expect(keyFor({ type: 'genre', value: 'Horror', genreId: 27 }))
      .not.toBe(keyFor({ type: 'general', value: 'Horror' }));
  });

  it('distinguishes year ranges by both ends', () => {
    expect(keyFor({ type: 'yearRange', value: { startYear: 1990, endYear: 1999 } }))
      .not.toBe(keyFor({ type: 'yearRange', value: { startYear: 2000, endYear: 2009 } }));
  });

  it('refuses to key a filter with no type', () => {
    expect(keyFor(null)).toBeNull();
    expect(keyFor({})).toBeNull();
  });
});

describe('the cache itself', () => {
  it('returns what it was given, so the requests are skipped', () => {
    const cache = createCache();
    cache.set('horror', films(3));

    expect(cache.get('horror')).toHaveLength(3);
  });

  it('misses for a filter it has never seen', () => {
    expect(createCache().get('comedy')).toBeNull();
  });

  it('forgets an entry once it is older than the TTL', () => {
    const cache = createCache();
    const now = 1_000_000;
    cache.set('horror', films(3), now);

    // Within the window: still there, no requests needed.
    expect(cache.get('horror', now + TTL_MS - 1000)).toHaveLength(3);
    // Past it: gone, so new releases get picked up.
    expect(cache.get('horror', now + TTL_MS + 1000)).toBeNull();
  });

  it('never caches an empty result, so a failed fetch is retried', () => {
    const cache = createCache();
    cache.set('horror', []);
    cache.set('comedy', null);

    expect(cache.get('horror')).toBeNull();
    expect(cache.get('comedy')).toBeNull();
  });

  it('drops the least recently used once it is full', () => {
    const cache = createCache({ maxEntries: 2 });
    cache.set('a', films());
    cache.set('b', films());
    cache.get('a'); // 'a' is used again, so 'b' is now the stale one
    cache.set('c', films());

    expect(cache.get('a')).not.toBeNull();
    expect(cache.get('b')).toBeNull();
    expect(cache.get('c')).not.toBeNull();
    expect(cache.size).toBe(2);
  });

  it('can be emptied outright', () => {
    const cache = createCache();
    cache.set('horror', films());
    cache.clear();

    expect(cache.get('horror')).toBeNull();
    expect(cache.size).toBe(0);
  });
});
