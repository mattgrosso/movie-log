import { describe, it, expect } from 'vitest';
import { generateQuizQuestions } from '@/assets/javascript/games/quizGenerator.js';
import { makeSeededRng } from '@/assets/javascript/games/gameUtils.js';

function entry ({ id, title, director, genre, cast, year, rating }) {
  return {
    dbKey: `key-${id}`,
    ratings: [{ calculatedTotal: rating }],
    movie: {
      id,
      title,
      release_date: `${year}-01-01`,
      poster_path: '/p.jpg',
      crew: [{ name: director, job: 'Director' }],
      genres: [{ name: genre }],
      cast: cast.map((name) => ({ name }))
    }
  };
}

// A library with a clear #1 in every dimension so the "unambiguous winner"
// generators all succeed, plus enough movies for the highest-rated filler.
function buildLibrary () {
  const entries = [];
  // Director A directs 4 movies (clear top director), rest have unique directors.
  for (let i = 0; i < 4; i++) {
    entries.push(entry({ id: i, title: `A Film ${i}`, director: 'Director A', genre: 'Drama', cast: ['Star One'], year: 2000 + i, rating: 5 + i }));
  }
  for (let i = 4; i < 10; i++) {
    entries.push(entry({ id: i, title: `Other Film ${i}`, director: `Director ${i}`, genre: `Genre ${i}`, cast: [`Actor ${i}`], year: 1990 + i, rating: i }));
  }
  return entries;
}

const ratingForFn = (e) => e.ratings[0].calculatedTotal;

describe('generateQuizQuestions', () => {
  it('generates the requested number of questions when the library supports it', () => {
    const library = buildLibrary();
    const questions = generateQuizQuestions(library, ratingForFn, makeSeededRng(1), 6);
    expect(questions.length).toBe(6);
    questions.forEach((q) => {
      expect(q.options.length).toBe(4);
      expect(q.options.filter((o) => o.isCorrect).length).toBe(1);
    });
  });

  it('every question has a unique prompt+options each with exactly one correct answer', () => {
    const library = buildLibrary();
    const questions = generateQuizQuestions(library, ratingForFn, makeSeededRng(5), 8);
    questions.forEach((q) => {
      const correctCount = q.options.filter((o) => o.isCorrect).length;
      expect(correctCount).toBe(1);
      const labels = q.options.map((o) => o.label);
      expect(new Set(labels).size).toBe(labels.length); // no duplicate options
    });
  });

  it('is deterministic for a fixed rng', () => {
    const library = buildLibrary();
    const a = generateQuizQuestions(library, ratingForFn, makeSeededRng(99), 5);
    const b = generateQuizQuestions(library, ratingForFn, makeSeededRng(99), 5);
    expect(a).toEqual(b);
  });

  it('falls back to highest-rated-only questions when the library is small', () => {
    const small = buildLibrary().slice(0, 4); // no category has 4 distinct values
    const questions = generateQuizQuestions(small, ratingForFn, makeSeededRng(3), 4);
    expect(questions.length).toBeGreaterThan(0);
    questions.forEach((q) => {
      expect(q.prompt).toBe('Which of these did you rate highest?');
    });
  });

  it('returns an empty array when there are not even 4 eligible movies', () => {
    const tiny = buildLibrary().slice(0, 2);
    const questions = generateQuizQuestions(tiny, ratingForFn, makeSeededRng(3), 4);
    expect(questions).toEqual([]);
  });
});
