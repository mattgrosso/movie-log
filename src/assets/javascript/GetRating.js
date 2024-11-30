import store from '../../store/index';

let allRatings = store.getters.allMediaRatingsArray;

const currentLogIsTVLog = () => {
  return store.state.currentLog === "tvLog";
}

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

    // Adjustment factor to tweak the normalization
    // This adjustment factor can be modified to tweak the normalization to match the desired distribution
    // To begin with I've tweaked it to draw the line between which movies my gut says are 10s and which are not.
    const adjustmentFactor = 0.25;

    normalizedRating = ((calculatedTotal - minRating) / (maxRating - minRating)) * 10;

    // Apply the adjustment factor
    normalizedRating += adjustmentFactor;

    // Ensure the normalized rating is an integer
    const normalizedRatingInt = Math.round(normalizedRating);
    normalizedRating = normalizedRatingInt;
  }

  return {
    ...rating,
    calculatedTotal: calculatedTotal,
    normalizedRating: normalizedRating
  }
}

const mostRecentRating = (media) => {
  let mostRecentRating;

  if (currentLogIsTVLog()) {
    if (!media?.ratings?.tvShow && !media.ratings?.length) {
      return null;
    }
    mostRecentRating = media.ratings.tvShow || media.ratings[0];
  } else {
    if (!media?.ratings?.length) {
      return null;
    }

    mostRecentRating = media.ratings[0];

    media.ratings.forEach((rating) => {
      if (!mostRecentRating?.date) {
        mostRecentRating = rating;
      } else if (rating.date && new Date(rating.date).getTime() > new Date(mostRecentRating.date).getTime()) {
        mostRecentRating = rating;
      }
    })
  }

  return mostRecentRating;
}

export const getAllRatings = (dbEntry) => {
  if (!dbEntry || !dbEntry.ratings) {
    return null;
  }

  const ratings = dbEntry.ratings.tvShow ? [dbEntry.ratings.tvShow] : dbEntry.ratings;

  if (!Array.isArray(ratings) || ratings.length === 0) {
    return null;
  }

  return ratings.map(calculatePostStickyRatingFor);
}

export const getRating = (dbEntry) => {
  const mostRecent = mostRecentRating(dbEntry);
  return calculatePostStickyRatingFor(mostRecent);
}