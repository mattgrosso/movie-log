import store from '../../store/index';

const currentLogIsTVLog = () => {
  return store.state.currentLog === "tvLog";
}

const calculatePostStickyRatingFor = (rating) => {
  const direction = store.getters.weight("direction") * parseFloat(rating.direction);
  const imagery = store.getters.weight("imagery") * parseFloat(rating.imagery);
  const love = store.getters.weight("love") * parseFloat(rating.love);
  const overall = store.getters.weight("overall") * parseFloat(rating.overall);
  const performance = store.getters.weight("performance") * parseFloat(rating.performance);
  const soundtrack = store.getters.weight("soundtrack") * parseFloat(rating.soundtrack);
  const story = store.getters.weight("story") * parseFloat(rating.story);

  let cleanStickiness = rating.stickiness;

  if ((!cleanStickiness || cleanStickiness > 5) && cleanStickiness !== 0) {
    cleanStickiness = parseFloat(rating.impression) || 1;
  }

  const stickiness = store.getters.weight("stickiness") * parseFloat(cleanStickiness);

  const total = direction + imagery + story + performance + soundtrack + love + overall + stickiness;
  return {
    ...rating,
    calculatedTotal: parseFloat((total / 10).toFixed(2))
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
      if (!mostRecentRating.date) {
        mostRecentRating = rating;
      } else if (rating.date && rating.date > mostRecentRating.date) {
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