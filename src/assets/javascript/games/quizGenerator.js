import { pickRandomDistinct, shuffle, movieDirectors, movieGenreNames, movieCastNames, movieYear } from './gameUtils.js';

function countBy (entries, extractFn) {
  const counts = new Map();
  entries.forEach((entry) => {
    (extractFn(entry) || []).forEach((value) => {
      if (!value) return;
      counts.set(value, (counts.get(value) || 0) + 1);
    });
  });
  return counts;
}

// Builds a "which of these is #1" multiple-choice question from a value ->
// count map. Bails (returns null) when the data can't support an
// unambiguous question: fewer than 4 distinct values, or a tie for first
// place (no single correct answer).
function topCountQuestion ({ countsMap, prompt, rng }) {
  const sorted = [...countsMap.entries()].sort((a, b) => b[1] - a[1]);
  if (sorted.length < 4) return null;
  const [correctValue, correctCount] = sorted[0];
  if (sorted[1] && sorted[1][1] === correctCount) return null;

  const distractorPool = sorted.slice(1).filter(([, count]) => count < correctCount);
  if (distractorPool.length < 3) return null;

  const distractors = pickRandomDistinct(distractorPool, 3, rng).map(([value]) => value);
  const options = shuffle([correctValue, ...distractors], rng).map((value) => ({
    label: value,
    isCorrect: value === correctValue
  }));

  return { prompt, options };
}

function highestRatedQuestion ({ eligibleEntries, ratingForFn, rng }) {
  if (eligibleEntries.length < 4) return null;
  const sample = pickRandomDistinct(eligibleEntries, 4, rng);
  const rated = sample.map((entry) => ({ title: entry.movie.title, rating: ratingForFn(entry) }));
  const maxRating = Math.max(...rated.map((r) => r.rating));
  const winners = rated.filter((r) => r.rating === maxRating);
  if (winners.length !== 1) return null;

  const options = shuffle(rated, rng).map((r) => ({ label: r.title, isCorrect: r.rating === maxRating }));
  return { prompt: 'Which of these did you rate highest?', options };
}

const QUESTION_TYPES = [
  ({ eligibleEntries, rng }) => topCountQuestion({
    countsMap: countBy(eligibleEntries, movieDirectors),
    prompt: 'Which director appears most often in your rated library?',
    rng
  }),
  ({ eligibleEntries, rng }) => topCountQuestion({
    countsMap: countBy(eligibleEntries, movieGenreNames),
    prompt: 'Which genre shows up most often in your rated library?',
    rng
  }),
  ({ eligibleEntries, rng }) => topCountQuestion({
    countsMap: countBy(eligibleEntries, (entry) => movieCastNames(entry, 6)),
    prompt: 'Which actor appears in the most movies you\'ve rated?',
    rng
  }),
  ({ eligibleEntries, rng }) => topCountQuestion({
    countsMap: countBy(eligibleEntries, (entry) => {
      const year = movieYear(entry);
      return year ? [String(year)] : [];
    }),
    prompt: 'Which release year is best represented in your rated library?',
    rng
  })
];

// Generates a fresh multiple-choice quiz about the user's own library.
// Tries each of the distinct question types once (some may be skipped if the
// library can't support an unambiguous answer — see topCountQuestion), then
// pads out to `count` with fresh "highest rated" questions, which only need
// 4 movies and near-never tie in practice.
export function generateQuizQuestions (eligibleEntries, ratingForFn, rng = Math.random, count = 6) {
  const questions = [];

  const shuffledTypes = shuffle(QUESTION_TYPES, rng);
  shuffledTypes.forEach((generator) => {
    if (questions.length >= count) return;
    const question = generator({ eligibleEntries, ratingForFn, rng });
    if (question) questions.push(question);
  });

  let attempts = 0;
  while (questions.length < count && attempts < 30) {
    attempts += 1;
    const question = highestRatedQuestion({ eligibleEntries, ratingForFn, rng });
    if (question) questions.push(question);
  }

  return questions;
}
