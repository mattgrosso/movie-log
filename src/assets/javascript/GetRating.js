import store from '../../store/index';
import { baseNormalized, applyNormalization } from './normalizationPicker.js';

let allRatings = store.getters.allMediaRatingsArray;

// The raw weighted score alone — shared by the display path below and by
// anchor resolution (which must NOT recurse into normalization).
const rawCalculatedTotal = (rating) => {
  const tweakValue = parseFloat(rating.tweakValue || 0);

  const direction = store.getters.weight("direction") * parseFloat(rating.direction);
  const imagery = store.getters.weight("imagery") * parseFloat(rating.imagery);
  const love = store.getters.weight("love") * parseFloat(rating.love);
  const overall = store.getters.weight("overall") * (parseFloat(rating.overall) + tweakValue);
  const performance = store.getters.weight("performance") * parseFloat(rating.performance);
  const soundtrack = store.getters.weight("soundtrack") * parseFloat(rating.soundtrack);
  const story = store.getters.weight("story") * parseFloat(rating.story);

  let cleanStickiness = rating.stickiness;

  if ((!cleanStickiness || cleanStickiness > 5) && cleanStickiness !== 0) {
    cleanStickiness = parseFloat(rating.impression) || 1;
  }

  const stickiness = store.getters.weight("stickiness") * parseFloat(cleanStickiness);

  const total = direction + imagery + story + performance + soundtrack + love + overall + stickiness;
  return parseFloat((total / 10).toFixed(2));
};

// Rating-curve anchors (settings.normalizationAnchors = { ten, five } as
// dbKeys) resolved to 0-10 base positions. Memoized on the identity of the
// anchors object + movieLog + the score range — getRating runs per-movie in
// grids, so this must not re-resolve every call.
let anchorMemo = { anchors: undefined, movieLog: undefined, min: undefined, max: undefined, result: null };

const resolveAnchorBases = (minRating, maxRating) => {
  const anchors = store.state.settings.normalizationAnchors;
  const movieLog = store.state.movieLog;
  if (
    anchorMemo.anchors === anchors && anchorMemo.movieLog === movieLog &&
    anchorMemo.min === minRating && anchorMemo.max === maxRating
  ) {
    return anchorMemo.result;
  }

  const baseFor = (dbKey) => {
    if (!dbKey) return null;
    const entry = movieLog?.[dbKey];
    const recent = mostRecentRating(entry);
    if (!recent) return null;
    return baseNormalized(rawCalculatedTotal(recent), minRating, maxRating);
  };

  const result = anchors?.ten
    ? { tenBase: baseFor(anchors.ten), fiveBase: baseFor(anchors.five) }
    : null;
  anchorMemo = { anchors, movieLog, min: minRating, max: maxRating, result };
  return result;
};

const calculatePostStickyRatingFor = (rating) => {
  if (!rating) {
    return {
      calculatedTotal: 0
    };
  }

  const calculatedTotal = rawCalculatedTotal(rating);

  if (!allRatings.length) {
    allRatings = store.getters.allMediaRatingsArray;
  }

  let normalizedRating;

  if (allRatings.length) {
    const minRating = Math.min(...allRatings);
    const maxRating = Math.max(...allRatings);

    if (maxRating !== minRating) {
      const base = baseNormalized(calculatedTotal, minRating, maxRating);
      const anchorBases = resolveAnchorBases(minRating, maxRating);
      normalizedRating = applyNormalization(base, {
        tweak: store.state.settings.normalizationTweak || 0.25,
        tenBase: anchorBases?.tenBase ?? null,
        fiveBase: anchorBases?.fiveBase ?? null
      });
    } else {
      // If maxRating and minRating are equal, set normalizedRating to a default value
      normalizedRating = 10; // or any other default value you prefer
    }
  }

  // Clamp the normalized rating between 0 and 10
  normalizedRating = Math.max(0, Math.min(10, normalizedRating));

  return {
    ...rating,
    calculatedTotal,
    normalizedRating
  };
}

const mostRecentRating = (media) => {
  if (!media?.ratings?.length) {
    return null;
  }

  let mostRecentRating = media.ratings[0];

  media.ratings.forEach((rating) => {
    if (!mostRecentRating?.date) {
      mostRecentRating = rating;
    } else if (rating.date && new Date(rating.date).getTime() > new Date(mostRecentRating.date).getTime()) {
      mostRecentRating = rating;
    }
  })

  return mostRecentRating;
}

export const getAllRatings = (dbEntry) => {
  if (!dbEntry || !dbEntry.ratings) {
    return null;
  }

  const ratings = dbEntry.ratings;

  if (!Array.isArray(ratings) || ratings.length === 0) {
    return null;
  }

  return ratings.map(calculatePostStickyRatingFor);
}

export const getRating = (dbEntry) => {
  const mostRecent = mostRecentRating(dbEntry);
  return calculatePostStickyRatingFor(mostRecent);
}