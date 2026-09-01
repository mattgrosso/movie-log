import { describe, it, expect } from 'vitest';
import { personCandidates, filmographyFrom, filmographyProgress } from '@/assets/javascript/personFilmography.js';

// Bug report, 2026-09-01: "type into the input a person like a director or an
// actor and get the full list their entire filmography... then I could go
// through and add them all to hat easily."

describe('personCandidates', () => {
  const results = [
    { id: 1, name: 'Michael Jordan', known_for_department: 'Acting', profile_path: '/mj.jpg', known_for: [{ title: 'Space Jam' }] },
    { id: 2, name: 'Michael B. Jordan', known_for_department: 'Acting', profile_path: null, known_for: [{ title: 'Creed' }, { name: 'Fruitvale Station' }] },
    { name: 'No Id Person' },
    { id: 4 }
  ];

  it('keeps what tells two same-named people apart', () => {
    const [first, second] = personCandidates(results);

    expect(first).toEqual({
      id: 1, name: 'Michael Jordan', department: 'Acting', profilePath: '/mj.jpg', knownFor: ['Space Jam']
    });
    // `name` covers TV titles, which come back under a different key.
    expect(second.knownFor).toEqual(['Creed', 'Fruitvale Station']);
  });

  it('drops anything with no id and caps the list', () => {
    expect(personCandidates(results).map((p) => p.id)).toEqual([1, 2]);
    expect(personCandidates(results, 1)).toHaveLength(1);
    expect(personCandidates(null)).toEqual([]);
  });
});

describe('filmographyFrom', () => {
  const credits = {
    cast: [
      { id: 10, title: 'Newest', release_date: '2024-01-01', poster_path: '/10.jpg' },
      { id: 11, title: 'Oldest', release_date: '1999-05-05', poster_path: '/11.jpg' },
      { id: 12, title: 'Announced', poster_path: null },
      { id: 13, title: 'Both Jobs', release_date: '2010-03-03' }
    ],
    crew: [
      { id: 13, title: 'Both Jobs', release_date: '2010-03-03', job: 'Director' },
      { id: 14, title: 'Directed Only', release_date: '2015-07-07', job: 'Director' },
      { id: 15, title: 'Produced Only', release_date: '2016-07-07', job: 'Executive Producer' }
    ]
  };

  it('returns the whole filmography newest first', () => {
    const films = filmographyFrom(credits);
    expect(films.map((f) => f.title)).toEqual(['Newest', 'Directed Only', 'Both Jobs', 'Oldest']);
  });

  // The point of the request: this is NOT the recommendation treatment.
  it('keeps films already rated, marked rather than removed', () => {
    const films = filmographyFrom(credits, { ratedIds: new Set([11]) });
    const oldest = films.find((f) => f.id === 11);

    expect(oldest).toBeDefined();
    expect(oldest.rated).toBe(true);
    expect(oldest.note).toContain('Rated');
    expect(films.find((f) => f.id === 10).rated).toBe(false);
  });

  it('shows your own score on films you have rated, when one is available', () => {
    const films = filmographyFrom(credits, { ratedIds: new Set([11]), scoreFor: () => '8.50' });
    expect(films.find((f) => f.id === 11).note).toContain('You: 8.50');
  });

  it('merges a directed-and-starred credit into one card', () => {
    const films = filmographyFrom(credits);
    const both = films.filter((f) => f.id === 13);

    expect(both).toHaveLength(1);
    expect(both[0].roles).toEqual(['Actor', 'Director']);
    expect(both[0].note).toContain('Actor, Director');
  });

  it('drops undated credits — an announced film cannot be watched', () => {
    expect(filmographyFrom(credits).some((f) => f.title === 'Announced')).toBe(false);
  });

  // Producer credits run to hundreds for anyone established and bury the
  // films the person is actually known for.
  it('counts authorship jobs but not producer credits', () => {
    const films = filmographyFrom(credits).map((f) => f.title);
    expect(films).toContain('Directed Only');
    expect(films).not.toContain('Produced Only');
  });

  it('says the year and the role in the note', () => {
    expect(filmographyFrom(credits).find((f) => f.id === 14).note).toBe('2015 · Director');
  });

  it('survives an empty or malformed payload', () => {
    expect(filmographyFrom(null)).toEqual([]);
    expect(filmographyFrom({ cast: null, crew: undefined })).toEqual([]);
  });
});

describe('filmographyProgress', () => {
  it('counts how much of the filmography is already in the library', () => {
    const films = [{ rated: true }, { rated: false }, { rated: false }];
    expect(filmographyProgress(films)).toEqual({ total: 3, seen: 1, unseen: 2 });
    expect(filmographyProgress([])).toEqual({ total: 0, seen: 0, unseen: 0 });
  });
});
