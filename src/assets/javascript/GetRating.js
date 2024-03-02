import store from '../../store/index';

const calculatePreStickyRatingFor = (rating) => {
  const direction = store.getters.preStickinessWeight("direction") * parseFloat(rating.direction);
  const imagery = store.getters.preStickinessWeight("imagery") * parseFloat(rating.imagery);
  const impression = store.getters.preStickinessWeight("impression") * parseFloat(rating.impression);
  const love = store.getters.preStickinessWeight("love") * parseFloat(rating.love);
  const overall = store.getters.preStickinessWeight("overall") * parseFloat(rating.overall);
  const performance = store.getters.preStickinessWeight("performance") * parseFloat(rating.performance);
  const soundtrack = store.getters.preStickinessWeight("soundtrack") * parseFloat(rating.soundtrack);
  const story = store.getters.preStickinessWeight("story") * parseFloat(rating.story);

  const total = direction + imagery + story + performance + soundtrack + impression + love + overall;

  return {
    ...rating,
    calculatedTotal: parseFloat(total / 10).toFixed(2)
  }
}

const calculatePostStickyRatingFor = (rating) => {
  const direction = store.getters.weight("direction") * parseFloat(rating.direction);
  const imagery = store.getters.weight("imagery") * parseFloat(rating.imagery);
  const impression = store.getters.weight("impression") * parseFloat(rating.impression);
  const love = store.getters.weight("love") * parseFloat(rating.love);
  const overall = store.getters.weight("overall") * parseFloat(rating.overall);
  const performance = store.getters.weight("performance") * parseFloat(rating.performance);
  const soundtrack = store.getters.weight("soundtrack") * parseFloat(rating.soundtrack);
  const story = store.getters.weight("story") * parseFloat(rating.story);
  const stickiness = store.getters.weight("stickiness") * parseFloat(rating.stickiness);

  const total = direction + imagery + story + performance + soundtrack + impression + love + overall + stickiness;

  return {
    ...rating,
    calculatedTotal: parseFloat(total / 10).toFixed(2)
  }
}

const mostRecentRating = (media) => {
  let mostRecentRating = media.ratings[0];

  media.ratings.forEach((rating) => {
    if (!mostRecentRating.date) {
      mostRecentRating = rating;
    } else if (rating.date && rating.date > mostRecentRating.date) {
      mostRecentRating = rating;
    }
  })

  return mostRecentRating;
}

export const getRating = (dbEntry) => {
  if (!dbEntry?.ratings.length) {
    return null;
  }

  const mostRecent = mostRecentRating(dbEntry);

  if (mostRecent.stickiness) {
    return calculatePostStickyRatingFor(mostRecent);
  } else {
    return calculatePreStickyRatingFor(mostRecent);
  }
}

export const getAllRatings = (dbEntry) => {
  if (!dbEntry?.ratings.length) {
    return null;
  }

  return dbEntry.ratings.map((rating) => {
    if (rating.stickiness) {
      return calculatePostStickyRatingFor(rating);
    } else {
      return calculatePreStickyRatingFor(rating);
    }
  })
}
