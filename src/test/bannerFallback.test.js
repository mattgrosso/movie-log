import { describe, it, expect } from 'vitest';
import { pickFallbackBanner } from '@/assets/javascript/bannerFallback.js';

// Cold boot on a non-home route left the header as a bare strip forever:
// only Home ever resolved bannerUrl. pickFallbackBanner is the
// route-independent fallback App.vue applies when the library arrives.

const entry = (id, backdrop, total, extra = {}) => ({
  dbKey: `k${id}`,
  movie: { id, title: `M${id}`, backdrop_path: backdrop },
  // getRating reads the most recent rating's criteria; calculatedTotal is
  // derived, so hand it pre-weighted criteria that land where we need:
  // all-10s ≈ 10, all-1s ≈ 1.
  ratings: [{
    date: 1700000000000,
    love: total, overall: total, story: total, direction: total,
    imagery: total, stickiness: total, performance: total, soundtrack: total
  }],
  ...extra
});

describe('pickFallbackBanner', () => {
  it('returns null with no data (caller retries when the library arrives)', () => {
    expect(pickFallbackBanner(null)).toBeNull();
    expect(pickFallbackBanner([])).toBeNull();
  });

  it('picks a well-rated movie backdrop as a w500 TMDB url', () => {
    const url = pickFallbackBanner([entry(1, '/great.jpg', 10), entry(2, '/meh.jpg', 1)], () => 0);
    expect(url).toBe('https://image.tmdb.org/t/p/w500/great.jpg');
  });

  it('falls back to the whole library when nothing clears the ratings bar', () => {
    const url = pickFallbackBanner([entry(1, '/only.jpg', 1)], () => 0);
    expect(url).toBe('https://image.tmdb.org/t/p/w500/only.jpg');
  });

  it('prefers a custom backdrop stored at the entry level, like Home does', () => {
    const url = pickFallbackBanner([entry(1, '/std.jpg', 10, { customBackdropPath: '/custom.jpg' })], () => 0);
    expect(url).toBe('https://image.tmdb.org/t/p/w500/custom.jpg');
  });

  it('returns null rather than a broken img for a movie with no backdrop', () => {
    expect(pickFallbackBanner([entry(1, null, 10)], () => 0)).toBeNull();
  });
});
