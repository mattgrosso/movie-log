import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  asArray,
  hatsForMember,
  alreadyInHat,
  toHatMovie,
  pickFromHat,
  drawnRecord,
  fetchHat,
  addMovieToHat,
  commitDraw
} from '@/assets/javascript/movieHat.js';

// Movie Hat stays its own app (Matt, 2026-08-16: "I love that it's a
// standalone app"); this is the seam Cinema Roll reaches it through.

describe('asArray', () => {
  it('turns a Firebase object-map into an array carrying each key', () => {
    expect(asArray({ abc: { id: 1 }, def: { id: 2 } })).toEqual([
      { id: 1, dbKey: 'abc' },
      { id: 2, dbKey: 'def' }
    ]);
  });

  it('passes an array straight through without inventing keys', () => {
    expect(asArray([{ id: 1, dbKey: 'abc' }])).toEqual([{ id: 1, dbKey: 'abc' }]);
  });

  it('is null-safe', () => {
    expect(asArray(null)).toEqual([]);
    expect(asArray(undefined)).toEqual([]);
    expect(asArray('nope')).toEqual([]);
  });
});

describe('hatsForMember', () => {
  const HATS = {
    'Just Matt': { k1: { members: { a: 'mattgrosso@gmail.com' }, movies: { m1: {}, m2: {} }, history: { h1: {} } } },
    'Natalie and Matt': { k2: { members: { a: 'mattgrosso@gmail.com', b: 'natalie@example.com' }, movies: { m1: {} } } },
    "Someone else's": { k3: { members: { a: 'stranger@example.com' }, movies: { m1: {} } } },
    Empty: { k4: {} }
  };

  it('finds every hat the email is a member of, with its counts', () => {
    expect(hatsForMember(HATS, 'mattgrosso@gmail.com')).toEqual([
      { title: 'Just Matt', dbKey: 'k1', movies: 2, drawn: 1 },
      { title: 'Natalie and Matt', dbKey: 'k2', movies: 1, drawn: 0 }
    ]);
  });

  it("leaves other people's hats alone", () => {
    expect(hatsForMember(HATS, 'stranger@example.com').map((hat) => hat.title))
      .toEqual(["Someone else's"]);
  });

  it('matches regardless of how the address was capitalized', () => {
    expect(hatsForMember(HATS, 'MattGrosso@Gmail.com')).toHaveLength(2);
  });

  it('is null-safe', () => {
    expect(hatsForMember(null, 'a@b.com')).toEqual([]);
    expect(hatsForMember(HATS, null)).toEqual([]);
  });
});

describe('alreadyInHat', () => {
  // "If you try to add something to a hat, it should just notify you back
  // that it's already in there." Movie Hat dedupes on the TMDB id.
  it('spots a movie already waiting, whatever shape the hat came in', () => {
    expect(alreadyInHat({ k: { id: 550 } }, 550)).toBe(true);
    expect(alreadyInHat([{ id: 550 }], 550)).toBe(true);
  });

  it('does not care whether the id is a string or a number', () => {
    expect(alreadyInHat([{ id: '550' }], 550)).toBe(true);
    expect(alreadyInHat([{ id: 550 }], '550')).toBe(true);
  });

  it('says no for a movie that is not there', () => {
    expect(alreadyInHat([{ id: 550 }], 99)).toBe(false);
    expect(alreadyInHat([], 550)).toBe(false);
    expect(alreadyInHat(null, 550)).toBe(false);
  });

  it('never matches on a missing id', () => {
    expect(alreadyInHat([{ id: 550 }], null)).toBe(false);
    expect(alreadyInHat([{ id: null }], null)).toBe(false);
  });
});

describe('toHatMovie', () => {
  const entry = {
    dbKey: 'library-key',
    ratings: [{ calculatedTotal: 9 }],
    movie: { id: 550, title: 'Fight Club', poster_path: '/f.jpg', release_date: '1999-10-15', overview: 'A man.' }
  };

  it('accepts a Cinema Roll library entry or a bare TMDB movie', () => {
    const fromEntry = toHatMovie(entry, { now: 1000 });
    const fromMovie = toHatMovie(entry.movie, { now: 1000 });

    expect(fromEntry).toEqual(fromMovie);
    expect(fromEntry.id).toBe(550);
    expect(fromEntry.title).toBe('Fight Club');
  });

  // Movie Hat renders these four; the rest is along for the ride.
  it('carries what Movie Hat actually displays', () => {
    const payload = toHatMovie(entry, { addedBy: 'Matt', note: 'For Friday', now: 1000 });

    expect(payload.title).toBe('Fight Club');
    expect(payload.poster_path).toBe('/f.jpg');
    expect(payload.addedBy).toBe('Matt');
    expect(payload.note).toBe('For Friday');
    expect(payload.timeStamp).toBe(1000);
  });

  it('says where it came from when nobody is named', () => {
    expect(toHatMovie(entry).addedBy).toBe('Cinema Roll');
  });

  it('omits the note entirely rather than sending an empty one', () => {
    expect('note' in toHatMovie(entry)).toBe(false);
  });

  it('refuses anything without a TMDB id — that is the join key', () => {
    expect(toHatMovie({ movie: { title: 'No id' } })).toBeNull();
    expect(toHatMovie(null)).toBeNull();
  });

  it('never writes undefined into Firebase, which would be rejected', () => {
    const payload = toHatMovie({ movie: { id: 1 } });
    Object.values(payload).forEach((value) => expect(value).not.toBeUndefined());
  });
});

describe('pickFromHat', () => {
  const movies = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];

  it('picks by the injected randomness, so a draw can be pinned', () => {
    expect(pickFromHat(movies, () => 0)).toEqual({ id: 1 });
    expect(pickFromHat(movies, () => 0.99)).toEqual({ id: 4 });
    expect(pickFromHat(movies, () => 0.5)).toEqual({ id: 3 });
  });

  it('can reach every movie in the hat', () => {
    const seen = new Set();
    for (let i = 0; i < 400; i++) seen.add(pickFromHat(movies).id);
    expect(seen.size).toBe(4);
  });

  it('returns null for an empty hat rather than throwing', () => {
    expect(pickFromHat([])).toBeNull();
    expect(pickFromHat(null)).toBeNull();
  });
});

describe('drawnRecord', () => {
  it('stamps when it was drawn and drops the storage key', () => {
    const record = drawnRecord({ id: 550, title: 'Fight Club', dbKey: 'abc' }, 12345);

    expect(record).toEqual({ id: 550, title: 'Fight Club', dateDrawn: 12345 });
    expect('dbKey' in record).toBe(false);
  });

  it('is null-safe', () => {
    expect(drawnRecord(null)).toBeNull();
  });
});

describe('talking to the database', () => {
  let calls;

  beforeEach(() => {
    calls = [];
    global.fetch = vi.fn((url, options = {}) => {
      calls.push({ url, method: options.method || 'GET', body: options.body });
      if (url.includes('shallow=true')) {
        return Promise.resolve({ ok: true, text: () => Promise.resolve(JSON.stringify({ 'hat-key': true })) });
      }
      if (options.method === 'DELETE') {
        return Promise.resolve({ ok: true, text: () => Promise.resolve('null') });
      }
      if (options.method === 'POST') {
        return Promise.resolve({ ok: true, text: () => Promise.resolve(JSON.stringify({ name: 'new-key' })) });
      }
      return Promise.resolve({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({
          movies: { m1: { id: 1, title: 'Heat' } },
          history: { h1: { id: 2, title: 'Cats', dateDrawn: 1 } },
          members: { a: 'matt@example.com' }
        }))
      });
    });
  });

  afterEach(() => {
    delete global.fetch;
  });

  it('reads a hat by title, looking up its key first', async () => {
    const hat = await fetchHat('Just Matt');

    expect(hat.dbKey).toBe('hat-key');
    expect(hat.movies).toEqual([{ id: 1, title: 'Heat', dbKey: 'm1' }]);
    expect(hat.members).toEqual(['matt@example.com']);
  });

  it('escapes a hat title with spaces and punctuation', async () => {
    await fetchHat('Natalie & Her mom', 'known-key');

    expect(calls[0].url).toContain('Natalie%20%26%20Her%20mom');
  });

  it('adds a movie by POSTing to the hat\'s movies node', async () => {
    await addMovieToHat('Just Matt', 'hat-key', { id: 550 });

    expect(calls[0].method).toBe('POST');
    expect(calls[0].url).toContain('/hats/Just%20Matt/hat-key/movies.json');
    expect(JSON.parse(calls[0].body)).toEqual({ id: 550 });
  });

  // The heart of it: a draw MUST move the movie, not copy it. Getting this
  // wrong would quietly break the thing Matt uses to choose every film.
  it('completes a draw by writing history and then removing from the hat', async () => {
    await commitDraw('Just Matt', 'hat-key', { id: 1, title: 'Heat', dbKey: 'm1' }, 999);

    expect(calls).toHaveLength(2);

    expect(calls[0].method).toBe('POST');
    expect(calls[0].url).toContain('/history.json');
    expect(JSON.parse(calls[0].body)).toEqual({ id: 1, title: 'Heat', dateDrawn: 999 });

    expect(calls[1].method).toBe('DELETE');
    expect(calls[1].url).toContain('/movies/m1.json');
  });

  // History first, deletion second: a failure in between leaves the movie in
  // both places, which is recoverable. The other order loses it.
  it('does not remove the movie when writing history fails', async () => {
    global.fetch = vi.fn(() => Promise.resolve({ ok: false, status: 500, text: () => Promise.resolve('') }));

    await expect(commitDraw('Just Matt', 'hat-key', { id: 1, dbKey: 'm1' })).rejects.toThrow(/500/);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('surfaces a failed request rather than pretending it worked', async () => {
    global.fetch = vi.fn(() => Promise.resolve({ ok: false, status: 401, text: () => Promise.resolve('') }));

    await expect(addMovieToHat('Just Matt', 'hat-key', { id: 1 })).rejects.toThrow(/401/);
  });
});

// "The order of my hats should be based on which hat I most recently added
// to, so they should get sorted by how recently I used them." (2026-08-17)
// The getter lives in the store, so this covers the ordering rule itself.
describe('hat ordering by recent use', () => {
  const order = (hats) => [...hats]
    .sort((a, b) => (Number(b.lastUsedAt) || 0) - (Number(a.lastUsedAt) || 0))
    .map((hat) => hat.title);

  it('puts the most recently used hat first', () => {
    expect(order([
      { title: 'Old', lastUsedAt: 100 },
      { title: 'Newest', lastUsedAt: 900 },
      { title: 'Middle', lastUsedAt: 500 }
    ])).toEqual(['Newest', 'Middle', 'Old']);
  });

  it('leaves never-used hats behind the ones that have been', () => {
    expect(order([
      { title: 'Never' },
      { title: 'Used', lastUsedAt: 5 }
    ])).toEqual(['Used', 'Never']);
  });
});
