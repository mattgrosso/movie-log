import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { distinctNomineeCount } from '../assets/javascript/personalAwards.js';

// Bug report (2026-08-21): "somebody who was nominated for a specific role,
// but has appeared in more than one movie... they get counted twice so even
// though it's only five people it says there are six nominees." Nominations
// stay per person-per-movie — picking the same actor in two films is how a
// great year gets acknowledged — but the category row's count reads as
// people, which is what "five nominees" means at a ceremony.

const person = (id, name, movieId) => ({ type: 'person', id, name, movieId });
const movie = (movieId, title) => ({ type: 'movie', id: movieId, title });

describe('distinctNomineeCount', () => {
  it('counts a person once however many films they were nominated for', () => {
    // The reported case: five people, one of them nominated in two movies.
    const nominees = [
      person(1, 'A', 101),
      person(2, 'B', 102),
      person(3, 'C', 103),
      person(4, 'D', 104),
      person(5, 'E', 105),
      person(5, 'E', 106), // same person, second film - the sixth ENTRY
    ];
    expect(nominees.length).toBe(6); // what the row used to show
    expect(distinctNomineeCount(nominees)).toBe(5); // what it shows now
  });

  it('does not merge different people who share a movie', () => {
    expect(distinctNomineeCount([person(1, 'A', 101), person(2, 'B', 101)])).toBe(2);
  });

  // convertNomineeToMinimal falls back to the name when TMDB has no id, so
  // identity has to follow the same rule or the fallback pair would count as
  // one person with an id and another without.
  it('falls back to the name when a person has no id', () => {
    expect(distinctNomineeCount([
      { type: 'person', name: 'No Id', movieId: 101 },
      { type: 'person', name: 'No Id', movieId: 102 },
    ])).toBe(1);
  });

  it('counts movie nominees individually', () => {
    expect(distinctNomineeCount([movie(1, 'A'), movie(2, 'B'), movie(3, 'C')])).toBe(3);
  });

  it('handles empty, null and junk without throwing', () => {
    expect(distinctNomineeCount([])).toBe(0);
    expect(distinctNomineeCount(null)).toBe(0);
    expect(distinctNomineeCount([null, undefined])).toBe(0);
  });

  // Old stored nominees may predate the `type` field; a name+movieId pair is
  // a person regardless.
  it('recognises a person by shape when type is missing', () => {
    expect(distinctNomineeCount([
      { id: 9, name: 'Old Shape', movieId: 101 },
      { id: 9, name: 'Old Shape', movieId: 102 },
    ])).toBe(1);
  });
});

describe('the category row consumes the distinct count', () => {
  // jsdom can't exercise the modal's full data flow economically; what must
  // not regress is the wiring — getCategoryNomineeCount going back to
  // `.length` restores the overcount with every other test green.
  it('getCategoryNomineeCount goes through distinctNomineeCount', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/components/PersonalAwardsModal.vue'), 'utf8',
    );
    const method = source.slice(
      source.indexOf('getCategoryNomineeCount ('),
      source.indexOf('getCategoryWinner ('),
    );
    expect(method).toContain('distinctNomineeCount(categoryData.nominees)');
    expect(method).not.toMatch(/nominees \|\| \[\]\)\.length/);
  });
});
