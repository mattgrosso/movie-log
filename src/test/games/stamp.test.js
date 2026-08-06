import { describe, it, expect } from 'vitest';
import {
  collectPlayableTags,
  entryHasTag,
  traitsOf,
  affinityScore,
  buildStampRound,
  resolveSwipe,
  ratingsWithTag,
  MIN_TAGGED_TO_PLAY
} from '../../assets/javascript/games/stamp.js';

let nextId = 1;
const movie = ({ tags = [], keywords = [], directors = [], cast = [], genres = ['Drama'], year = 2015, ratings } = {}) => {
  const id = nextId++;
  return {
    dbKey: `key-${id}`,
    movie: {
      id,
      title: `Movie ${id}`,
      poster_path: `/p${id}.jpg`,
      release_date: `${year}-06-15`,
      genres: genres.map((name) => ({ name })),
      keywords: keywords.map((name) => ({ name })),
      crew: directors.map((name) => ({ name, job: 'Director' })),
      cast: cast.map((name) => ({ name, character: 'Someone' }))
    },
    ratings: ratings || [{ calculatedTotal: 7, date: Date.now(), tags: tags.map((title) => ({ title })) }]
  };
};

// Deterministic "shuffle" so round composition is testable.
const noShuffle = () => 0;

describe('entryHasTag', () => {
  it('matches case-insensitively', () => {
    const entry = movie({ tags: ['Watched With Carrie'] });
    expect(entryHasTag(entry, 'watched with carrie')).toBe(true);
    expect(entryHasTag(entry, 'Something Else')).toBe(false);
  });

  it('finds a tag on ANY viewing, not just the latest', () => {
    const entry = movie({ ratings: [
      { calculatedTotal: 7, tags: [{ title: 'Rewatch' }] },
      { calculatedTotal: 8, tags: [] }
    ] });
    expect(entryHasTag(entry, 'Rewatch')).toBe(true);
  });
});

describe('collectPlayableTags', () => {
  it('only offers tags with enough examples to learn from', () => {
    const entries = [
      movie({ tags: ['Popular'] }), movie({ tags: ['Popular'] }), movie({ tags: ['Popular'] }),
      movie({ tags: ['Rare'] })
    ];

    const titles = collectPlayableTags(entries).map((t) => t.title);
    expect(titles).toContain('Popular');
    expect(titles).not.toContain('Rare');
  });

  it('counts movies, not viewings — a tag on two viewings of one film is one movie', () => {
    const entries = [movie({ ratings: [
      { tags: [{ title: 'Repeat' }] },
      { tags: [{ title: 'Repeat' }] }
    ] })];

    expect(collectPlayableTags(entries, 1)[0].count).toBe(1);
  });

  it('sorts commonest first and keeps display casing', () => {
    const entries = [
      ...Array.from({ length: 5 }, () => movie({ tags: ['Seth Recommended'] })),
      ...Array.from({ length: 3 }, () => movie({ tags: ['Came Out Of Hat'] }))
    ];

    const tags = collectPlayableTags(entries);
    expect(tags[0]).toMatchObject({ title: 'Seth Recommended', count: 5 });
    expect(tags[1].title).toBe('Came Out Of Hat');
  });

  it('tolerates an empty or tagless library', () => {
    expect(collectPlayableTags([])).toEqual([]);
    expect(collectPlayableTags(null)).toEqual([]);
    expect(collectPlayableTags([movie()], MIN_TAGGED_TO_PLAY)).toEqual([]);
  });
});

describe('affinityScore', () => {
  // The whole point: "what movies might fit the tag but don't have it yet?"
  // The already-tagged movies define the tag; everything else is scored by how
  // much it resembles them.
  const taggedTraits = [traitsOf(movie({ directors: ['Agnes Varda'], keywords: ['heist', 'paris'], genres: ['Crime'], year: 1975 }))];

  it('scores a shared director above a shared genre', () => {
    const sameDirector = affinityScore(traitsOf(movie({ directors: ['Agnes Varda'], genres: ['Comedy'], year: 2020 })), taggedTraits);
    const sameGenre = affinityScore(traitsOf(movie({ directors: ['Someone Else'], genres: ['Crime'], year: 2020 })), taggedTraits);

    expect(sameDirector).toBeGreaterThan(sameGenre);
  });

  it('scores shared keywords above a shared genre', () => {
    const sharedKeywords = affinityScore(traitsOf(movie({ keywords: ['heist', 'paris'], genres: ['Comedy'], year: 2020 })), taggedTraits);
    const sharedGenre = affinityScore(traitsOf(movie({ genres: ['Crime'], year: 2020 })), taggedTraits);

    expect(sharedKeywords).toBeGreaterThan(sharedGenre);
  });

  it('gives nothing to a movie with nothing in common', () => {
    expect(affinityScore(traitsOf(movie({ directors: ['Nobody'], genres: ['Horror'], year: 2020 })), taggedTraits)).toBe(0);
  });

  it('counts evidence across MULTIPLE tagged movies, not just the best single match', () => {
    const oneMatch = [traitsOf(movie({ directors: ['Agnes Varda'] }))];
    const threeMatches = Array.from({ length: 3 }, () => traitsOf(movie({ directors: ['Agnes Varda'] })));
    const candidate = traitsOf(movie({ directors: ['Agnes Varda'], genres: ['Nothing'] }));

    expect(affinityScore(candidate, threeMatches)).toBeGreaterThan(affinityScore(candidate, oneMatch));
  });

  it('caps how much one very keyword-heavy movie can contribute', () => {
    // Without a cap, a film sharing 30 keywords with one tagged movie would
    // outrank a director shared across the whole tagged set.
    const many = traitsOf(movie({ keywords: Array.from({ length: 30 }, (_, i) => `kw${i}`) }));
    const tagged = [traitsOf(movie({ keywords: Array.from({ length: 30 }, (_, i) => `kw${i}`), genres: ['Nothing'] }))];

    expect(affinityScore(many, tagged)).toBeLessThanOrEqual(3 * 3 + 2 * 1 + 1);
  });
});

describe('buildStampRound', () => {
  const taggedSet = (count, extra = {}) =>
    Array.from({ length: count }, () => movie({ tags: ['Cosy'], ...extra }));

  it('returns nothing when the tag has no examples to learn from', () => {
    expect(buildStampRound([movie()], 'Nonexistent').cards).toEqual([]);
  });

  it('builds a round of the requested size', () => {
    const entries = [...taggedSet(8), ...Array.from({ length: 40 }, () => movie())];
    expect(buildStampRound(entries, 'Cosy', { rng: noShuffle }).cards).toHaveLength(20);
  });

  it('flags each card with whether the movie currently carries the tag', () => {
    const entries = [...taggedSet(8), ...Array.from({ length: 40 }, () => movie())];
    const { cards } = buildStampRound(entries, 'Cosy', { rng: noShuffle });

    cards.forEach((card) => {
      expect(card.hasTag).toBe(entryHasTag(card.entry, 'Cosy'));
    });
  });

  it('mixes already-tagged movies in for verification', () => {
    const entries = [...taggedSet(8), ...Array.from({ length: 40 }, () => movie())];
    const { cards } = buildStampRound(entries, 'Cosy', { rng: noShuffle });

    expect(cards.filter((c) => c.hasTag).length).toBeGreaterThan(0);
    // ...but not ONLY tagged ones, or it's a re-confirmation chore.
    expect(cards.filter((c) => !c.hasTag).length).toBeGreaterThan(0);
  });

  it('prefers untagged movies that resemble the tagged ones', () => {
    const entries = [
      ...taggedSet(5, { directors: ['Agnes Varda'], keywords: ['cosy'] }),
      // A strong candidate: same director, currently untagged.
      movie({ directors: ['Agnes Varda'], keywords: ['cosy'] }),
      ...Array.from({ length: 40 }, () => movie({ directors: ['Nobody At All'], genres: ['Horror'], year: 1930 }))
    ];

    const { cards } = buildStampRound(entries, 'Cosy', { rng: noShuffle });
    const suggested = cards.find((c) => !c.hasTag && c.entry.movie.crew.some((p) => p.name === 'Agnes Varda'));

    expect(suggested).toBeTruthy();
  });

  it('never puts the same movie in a round twice', () => {
    const entries = [...taggedSet(8, { directors: ['Shared'] }), ...Array.from({ length: 40 }, () => movie({ directors: ['Shared'] }))];
    const { cards } = buildStampRound(entries, 'Cosy', { rng: noShuffle });

    const keys = cards.map((c) => c.entry.dbKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('still builds a (shorter) round in a small library', () => {
    const entries = [...taggedSet(3), movie(), movie()];
    const { cards } = buildStampRound(entries, 'Cosy', { rng: noShuffle });

    expect(cards.length).toBeGreaterThan(0);
    expect(cards.length).toBeLessThanOrEqual(5);
  });
});

describe('resolveSwipe', () => {
  it('names each of the four outcomes', () => {
    expect(resolveSwipe({ hasTag: false, keep: true })).toBe('added');
    expect(resolveSwipe({ hasTag: true, keep: false })).toBe('removed');
    expect(resolveSwipe({ hasTag: true, keep: true })).toBe('confirmed');
    expect(resolveSwipe({ hasTag: false, keep: false })).toBe('skipped');
  });
});

describe('ratingsWithTag', () => {
  const ratings = [
    { calculatedTotal: 6, tags: [{ title: 'Old' }] },
    { calculatedTotal: 8, tags: [] }
  ];

  it('adds to the most recent viewing only', () => {
    const next = ratingsWithTag(ratings, 'Cosy', true);
    expect(next[0].tags).toEqual([{ title: 'Old' }]);
    expect(next[1].tags).toEqual([{ title: 'Cosy' }]);
  });

  it('does not duplicate a tag already there', () => {
    const next = ratingsWithTag(ratingsWithTag(ratings, 'Cosy', true), 'Cosy', true);
    expect(next[1].tags).toHaveLength(1);
  });

  it('removes from EVERY viewing, not just the latest', () => {
    // Leaving it on an older viewing would keep the movie counting as tagged.
    const spread = [{ tags: [{ title: 'Cosy' }] }, { tags: [{ title: 'Cosy' }] }];
    const next = ratingsWithTag(spread, 'Cosy', false);

    expect(next.every((r) => r.tags.length === 0)).toBe(true);
  });

  it('does not mutate the input', () => {
    const original = JSON.parse(JSON.stringify(ratings));
    ratingsWithTag(ratings, 'Cosy', true);
    expect(ratings).toEqual(original);
  });

  it('tolerates missing or empty ratings and blank titles', () => {
    expect(ratingsWithTag(null, 'Cosy', true)).toEqual([]);
    expect(ratingsWithTag([], 'Cosy', true)).toEqual([]);
    expect(ratingsWithTag(ratings, '   ', true)).toBe(ratings);
  });
});
