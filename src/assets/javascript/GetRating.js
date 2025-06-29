import store from '../../store/index';

let allRatings = store.getters.allMediaRatingsArray;


const calculatePostStickyRatingFor = (rating) => {
  if (!rating) {
    return {
      calculatedTotal: 0
    };
  }

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
  const calculatedTotal = parseFloat((total / 10).toFixed(2));

  if (!allRatings.length) {
    allRatings = store.getters.allMediaRatingsArray;
  }

  let normalizedRating;

  if (allRatings.length) {
    const minRating = Math.min(...allRatings);
    const maxRating = Math.max(...allRatings);

    // Fetch the normalization tweak value from the store
    const adjustmentFactor = store.state.settings.normalizationTweak || 0.25;

    if (maxRating !== minRating) {
      normalizedRating = ((calculatedTotal - minRating) / (maxRating - minRating)) * 10;

      // Apply the adjustment factor
      normalizedRating += adjustmentFactor;

      // Ensure the normalized rating is an integer
      normalizedRating = Math.round(normalizedRating);
    } else {
      // If maxRating and minRating are equal, set normalizedRating to a default value
      normalizedRating = 10; // or any other default value you prefer
    }
  }

  // Clamp the normalized rating between 0 and 10
  normalizedRating = Math.max(0, Math.min(10, normalizedRating));

  return {
    ...rating,
    calculatedTotal: calculatedTotal,
    normalizedRating: normalizedRating
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