import { expandNomineeFromMinimal } from './personalAwards.js';

// Leaderboards over the user's personal awards, for the Trophy Case.
//
// The stored shape is settings.personalAwards[year].categories[key] =
// { nominees: [minimal], winner: minimal|null, noNominees: bool } — see
// PersonalAwardsModal.convertNomineeToMinimal. Everything here is derived;
// nothing is persisted.
//
// A WINNER IS ALSO A NOMINEE: the modal only lets you pick a winner from
// the nominees you already selected, so `nominees` contains the winner too.
// Nomination counts therefore include wins, which is what people expect
// ("Titanic: 14 nominations, 11 wins") — this is deliberate, not
// double-counting.
//
// A PERSON'S AWARD ALSO COUNTS FOR THEIR MOVIE, matching how real ceremony
// tallies work ("Titanic won 11 Oscars" includes its acting and directing
// wins, not just Best Picture). Every expanded nominee carries `.movie`,
// whether it's a movie-type entry or a person expanded with the film they
// were nominated for, so both roll up the same way.

const DEFAULT_LIMIT = 10;
// A leaderboard of people/films with exactly one award each is just a list
// of every award, which isn't a "record" — only repeats are interesting.
const DEFAULT_MIN_COUNT = 2;

// `expanded.name` is the person/movie discriminator used throughout the
// Trophy Case (winnerTitle, the trophy-subtitle v-if, winnerImage).
function isPerson (expanded) {
  return Boolean(expanded?.name);
}

// Walks every year/category once and expands both the winner and each
// nominee. Returns { wins, nominations }, each a flat list of
// { year, categoryKey, expanded }. Tolerates missing/partial years, absent
// nominee lists, and nominees whose movie has since left the library
// (expandNomineeFromMinimal returns null for those, and they're skipped).
export function collectAwardEntries (personalAwards, library) {
  const wins = [];
  const nominations = [];

  Object.keys(personalAwards || {}).forEach((yearKey) => {
    const year = Number(yearKey);
    const categories = personalAwards[yearKey]?.categories || {};

    Object.keys(categories).forEach((categoryKey) => {
      const category = categories[categoryKey] || {};

      const winner = category.winner ? expandNomineeFromMinimal(category.winner, library) : null;
      if (winner) wins.push({ year, categoryKey, expanded: winner });

      (category.nominees || []).forEach((nominee) => {
        const expanded = expandNomineeFromMinimal(nominee, library);
        if (expanded) nominations.push({ year, categoryKey, expanded });
      });
    });
  });

  return { wins, nominations };
}

// Ranks people by how many of the given entries they appear in. Ties break
// alphabetically so the order is stable rather than dependent on whatever
// order the years happened to be walked in.
export function rankPeople (entries, { limit = DEFAULT_LIMIT, minCount = DEFAULT_MIN_COUNT } = {}) {
  const byName = new Map();

  (entries || []).forEach((entry) => {
    if (!isPerson(entry.expanded)) return;
    const name = entry.expanded.name;
    if (!byName.has(name)) byName.set(name, { name, count: 0, entries: [] });
    const record = byName.get(name);
    record.count += 1;
    record.entries.push(entry);
  });

  return [...byName.values()]
    .filter((person) => person.count >= minCount)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, limit);
}

// The "always the bridesmaid" shelf (user request: "the ability to see who
// has the most nominations without a win"): people ranked by nomination
// count, EXCLUDING anyone who has ever won — in any category, any year. A
// single win anywhere disqualifies; this is a list of the perpetually
// passed-over, not of win-to-nomination ratios.
export function rankPeopleWithoutWins (nominations, wins, options) {
  const winnerNames = new Set(
    (wins || []).filter((entry) => isPerson(entry.expanded)).map((entry) => entry.expanded.name)
  );
  const neverWon = (nominations || []).filter(
    (entry) => isPerson(entry.expanded) && !winnerNames.has(entry.expanded.name)
  );
  return rankPeople(neverWon, options);
}

// Ranks MOVIES by how many of the given entries point at them - including
// entries for people, which count for the film they were nominated for (see
// the note at the top). Keyed by TMDB movie id so two films sharing a title
// (a remake) stay separate.
export function rankMovies (entries, { limit = DEFAULT_LIMIT, minCount = DEFAULT_MIN_COUNT } = {}) {
  const byId = new Map();

  (entries || []).forEach((entry) => {
    const movie = entry.expanded?.movie;
    if (!movie || movie.id == null) return;
    if (!byId.has(movie.id)) byId.set(movie.id, { movieId: movie.id, movie, count: 0, entries: [] });
    const record = byId.get(movie.id);
    record.count += 1;
    record.entries.push(entry);
  });

  return [...byId.values()]
    .filter((film) => film.count >= minCount)
    .sort((a, b) => b.count - a.count || (a.movie.title || '').localeCompare(b.movie.title || ''))
    .slice(0, limit);
}
