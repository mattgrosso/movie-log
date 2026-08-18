// Report -P-H-twP5kUjwuEanKMm: "I appear to have doubled the amount of
// Brian's feed that I'm receiving... I see all of his movies twice." One
// feed URL, subscribed twice under two ids twelve hours apart, because
// accepting a request and accepting an invite each minted a fresh id.
import { describe, it, expect } from 'vitest';
import { sameFeedUrl, findSubscription, dedupeExternalFriends } from '../assets/javascript/interchange.js';

const BRIAN = 'https://movie-log-ae673-default-rtdb.firebaseio.com/clubFeed/gMYtWT6vB5g47u2A3AAsoJcx6tr2/edc853845880064e57706ad9f025a0bb.json';

describe('sameFeedUrl', () => {
  it('matches the identical URL', () => {
    expect(sameFeedUrl(BRIAN, BRIAN)).toBe(true);
  });

  it('sees through a trailing slash, host case, and surrounding space', () => {
    expect(sameFeedUrl('https://example.com/feed.json', ' https://EXAMPLE.com/feed.json ')).toBe(true);
    expect(sameFeedUrl('https://example.com/feed/', 'https://example.com/feed')).toBe(true);
  });

  it('ignores a cache-busting query, which does not change whose feed it is', () => {
    expect(sameFeedUrl('https://example.com/feed.json?t=1', 'https://example.com/feed.json')).toBe(true);
  });

  it('keeps genuinely different feeds apart', () => {
    expect(sameFeedUrl(BRIAN, 'https://example.com/other.json')).toBe(false);
    expect(sameFeedUrl('https://example.com/a.json', 'https://example.com/b.json')).toBe(false);
  });

  it('treats a missing URL as matching nothing, including another missing one', () => {
    expect(sameFeedUrl('', '')).toBe(false);
    expect(sameFeedUrl(null, undefined)).toBe(false);
    expect(sameFeedUrl(null, BRIAN)).toBe(false);
  });
});

describe('findSubscription', () => {
  const friends = {
    'ext-msx4vqxj': { name: 'Brian Goegan', feedUrl: BRIAN, addedAt: 1786965099031 }
  };

  it('finds the friend already subscribed to that feed', () => {
    expect(findSubscription(friends, BRIAN)).toBe('ext-msx4vqxj');
  });

  it('returns null for a feed nobody is subscribed to', () => {
    expect(findSubscription(friends, 'https://example.com/new.json')).toBeNull();
  });

  it('copes with no friends at all', () => {
    expect(findSubscription(undefined, BRIAN)).toBeNull();
  });
});

describe('dedupeExternalFriends', () => {
  it("collapses Matt's real doubled subscription, keeping the original", () => {
    const doubled = {
      'ext-msx4vqxj': { name: 'Brian Goegan', feedUrl: BRIAN, addedAt: 1786965099031 },
      'ext-msxurv7d': { name: 'Brian Goegan', feedUrl: BRIAN, addedAt: 1787008587961 }
    };

    const deduped = dedupeExternalFriends(doubled);

    expect(Object.keys(deduped)).toEqual(['ext-msx4vqxj']);
  });

  it('leaves distinct friends alone', () => {
    const friends = {
      a: { name: 'Brian', feedUrl: BRIAN, addedAt: 1 },
      b: { name: 'Someone', feedUrl: 'https://example.com/other.json', addedAt: 2 }
    };

    expect(Object.keys(dedupeExternalFriends(friends)).sort()).toEqual(['a', 'b']);
  });

  it('keeps entries that have no feed URL rather than merging them together', () => {
    const friends = { a: { name: 'One' }, b: { name: 'Two' } };
    expect(Object.keys(dedupeExternalFriends(friends)).sort()).toEqual(['a', 'b']);
  });

  it('returns an empty map for nothing', () => {
    expect(dedupeExternalFriends(null)).toEqual({});
  });
});
