// You vs. the Academy — pure comparison of the user's personal-award
// winners against the real Academy Awards (user request: "find some
// categories where I differ from the Academy Awards").
//
// Inputs: the personal WINS from awardStats.collectAwardEntries, and the
// full film-awards-api dataset (state.allAcademyAwards). That dataset's
// `year` is the FILM year (Titanic → 1997), which matches personal award
// years directly — verified against the live API, no ceremony-year
// off-by-one to correct.

// Personal category -> the Academy categories it should be judged against.
// Some personal categories deliberately span several Academy ones (the
// modal's own names say so: "Screenplay or Writing", "Score or Music",
// "Visual Effects or Production Design").
export const ACADEMY_CATEGORY_MAPPING = {
  bestPicture: ['Best Picture'],
  bestDirector: ['Best Director'],
  bestActor: ['Best Actor'],
  bestActress: ['Best Actress'],
  bestSupportingActor: ['Best Supporting Actor'],
  bestSupportingActress: ['Best Supporting Actress'],
  bestScreenplay: ['Best Original Screenplay', 'Best Adapted Screenplay', 'Best Screenplay', 'Best Title Writing'],
  bestCinematography: ['Best Cinematography'],
  bestEditing: ['Best Editing'],
  bestScore: ['Best Original Score', 'Best Adapted Score'],
  bestVisualEffects: ['Best Visual Effects', 'Best Production Design'],
  bestAnimatedFeature: ['Best Animated Feature'],
  bestDocumentaryFeature: ['Best Documentary']
};

// Tolerates both the store's normalized booleans and the API's raw strings.
const isWinnerRecord = (record) => [true, 1, '1', 'TRUE'].includes(record?.isWinner);

const recordNames = (record) => (record?.names || []).map((person) => person?.name).filter(Boolean);

function matchesPick (record, pick) {
  const movieId = pick.movie?.id;
  if (movieId != null && Number(record.tmdb) === Number(movieId)) return true;
  if (pick.name) {
    const target = pick.name.toLowerCase();
    return recordNames(record).some((name) => name.toLowerCase() === target);
  }
  return false;
}

function academyWinnerLabel (winners, personCategory) {
  const labels = winners.map((record) => {
    if (personCategory) {
      const names = recordNames(record).join(' & ');
      return names ? `${names} (${record.title})` : record.title;
    }
    return record.title;
  }).filter(Boolean);
  return [...new Set(labels)].join(' / ');
}

/**
 * One contest per personal WIN that the Academy also held that year.
 * Outcomes:
 *   'agreed'  — your winner also won the Academy category.
 *   'lost'    — your winner was Academy-NOMINATED but lost; the real
 *               winner's label is attached.
 *   'snubbed' — the Academy didn't even nominate your pick.
 * Years/categories the Academy didn't hold (your 1981 Animated Feature,
 * say) are skipped entirely rather than counted against agreement.
 */
export function compareWithAcademy (personalWins, academyRecords) {
  const contests = [];

  (personalWins || []).forEach((win) => {
    const academyCategories = ACADEMY_CATEGORY_MAPPING[win.categoryKey];
    if (!academyCategories) return;

    const pool = (academyRecords || []).filter(
      (record) => Number(record.year) === Number(win.year) && academyCategories.includes(record.category)
    );
    if (!pool.length) return;

    const winners = pool.filter(isWinnerRecord);
    const pick = win.expanded || {};
    const personCategory = Boolean(pick.name);

    let outcome = 'snubbed';
    if (winners.some((record) => matchesPick(record, pick))) {
      outcome = 'agreed';
    } else if (pool.some((record) => matchesPick(record, pick))) {
      outcome = 'lost';
    }

    contests.push({
      year: win.year,
      categoryKey: win.categoryKey,
      outcome,
      yoursLabel: pick.name ? `${pick.name} (${pick.movie?.title || '?'})` : (pick.movie?.title || '?'),
      academyLabel: academyWinnerLabel(winners, personCategory) || null,
      // Poster paths for the versus-card rendering ("wherever possible, I
      // prefer posters over text") — yours from the library, the Academy's
      // from the dataset's own img field.
      yoursPosterPath: pick.movie?.poster_path || null,
      academyPosterPath: winners.find((record) => record.img)?.img || null
    });
  });

  return contests;
}

// Per-category scorecard, most contrarian first (lowest agreement), with a
// minimum number of contests so a single-year category can't claim 0% or
// 100%. Ties by more contests first (a 10% over 20 years beats 10% over 3).
export function categoryScorecard (contests, { minContests = 3 } = {}) {
  const byCategory = new Map();
  (contests || []).forEach((contest) => {
    if (!byCategory.has(contest.categoryKey)) {
      byCategory.set(contest.categoryKey, { categoryKey: contest.categoryKey, contests: 0, agreements: 0 });
    }
    const record = byCategory.get(contest.categoryKey);
    record.contests += 1;
    if (contest.outcome === 'agreed') record.agreements += 1;
  });

  return [...byCategory.values()]
    .filter((record) => record.contests >= minContests)
    .map((record) => ({ ...record, rate: record.agreements / record.contests }))
    .sort((a, b) => a.rate - b.rate || b.contests - a.contests || a.categoryKey.localeCompare(b.categoryKey));
}

export function overallAgreement (contests) {
  const total = (contests || []).length;
  const agreements = (contests || []).filter((contest) => contest.outcome === 'agreed').length;
  return { contests: total, agreements, rate: total ? agreements / total : null };
}

// The juicy rows: where you and the Academy actively disagreed, newest
// first. 'lost' rows (your pick was nominated and beaten) lead over
// 'snubbed' within a year — a real head-to-head is a sharper story.
export function biggestDisagreements (contests, { limit = 8 } = {}) {
  const rank = { lost: 0, snubbed: 1 };
  return (contests || [])
    .filter((contest) => contest.outcome !== 'agreed' && contest.academyLabel)
    .sort((a, b) => b.year - a.year || rank[a.outcome] - rank[b.outcome])
    .slice(0, limit);
}
