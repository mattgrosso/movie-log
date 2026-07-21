import { entryKey, compareNumber, movieYear, movieDecade, movieDirectors, movieGenreNames } from './gameUtils.js';

// Compares a guessed library entry against the day's target entry and
// returns a Wordle-style clue breakdown. Pure — ratingForFn is passed in
// (rather than importing GetRating.js directly) so this stays unit-testable
// without touching the real Vuex store.
export function compareGuessToTarget (guessEntry, targetEntry, ratingForFn) {
  const isCorrect = entryKey(guessEntry) === entryKey(targetEntry);

  const guessDirectors = movieDirectors(guessEntry);
  const targetDirectors = movieDirectors(targetEntry);
  const guessGenres = movieGenreNames(guessEntry);
  const targetGenres = movieGenreNames(targetEntry);

  return {
    isCorrect,
    title: guessEntry?.movie?.title || '',
    poster: guessEntry?.movie?.poster_path || null,
    year: compareNumber(movieYear(guessEntry), movieYear(targetEntry)),
    decade: {
      value: movieDecade(guessEntry),
      match: movieDecade(guessEntry) != null && movieDecade(guessEntry) === movieDecade(targetEntry)
    },
    director: {
      value: guessDirectors,
      match: guessDirectors.length > 0 && guessDirectors.some((name) => targetDirectors.includes(name))
    },
    genres: {
      value: guessGenres,
      shared: guessGenres.filter((name) => targetGenres.includes(name)),
      allMatch: guessGenres.length > 0 &&
        guessGenres.length === targetGenres.length &&
        guessGenres.every((name) => targetGenres.includes(name))
    },
    runtime: compareNumber(guessEntry?.movie?.runtime ?? null, targetEntry?.movie?.runtime ?? null),
    yourRating: compareNumber(ratingForFn(guessEntry), ratingForFn(targetEntry))
  };
}
