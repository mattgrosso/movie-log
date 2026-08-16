// Shared logic for reading back personal-awards data stored via
// PersonalAwardsModal.vue's convertNomineeToMinimal — used by
// PersonalAwardsModal.vue, Insights.vue, and TrophyCase.vue, all of which
// previously carried their own near-identical copy of this function.
//
// Converts a "minimal" stored nominee/winner (just movieId + a few role
// fields — see convertNomineeToMinimal in PersonalAwardsModal.vue for why
// it's stored this way, not as a full TMDB object) back into a displayable
// object by looking up the movie in the given entries library. Callers pass
// their own choice of library subset (e.g. Insights.vue's shorts-filtered
// list vs PersonalAwardsModal's full list) since that's a per-caller
// decision, not something this function should make.
export function expandNomineeFromMinimal (minimalNominee, entriesLibrary) {
  if (!minimalNominee) return null;

  // Handle legacy data - if it already has a movie object, it's not minimal
  if (minimalNominee.movie) {
    return minimalNominee; // Already expanded/legacy format
  }

  if (minimalNominee.type === 'person') {
    const movieEntry = entriesLibrary.find(entry => entry.movie.id === minimalNominee.movieId);

    if (!movieEntry) {
      console.warn('⚠️ Could not find movie for person nominee:', minimalNominee);
      return null;
    }

    const expanded = {
      id: minimalNominee.id,
      name: minimalNominee.name,
      movieId: minimalNominee.movieId,
      movie: movieEntry.movie
    };

    if (minimalNominee.character) {
      expanded.character = minimalNominee.character;
    }
    if (minimalNominee.directors) {
      expanded.directors = minimalNominee.directors;
    }
    if (minimalNominee.profilePath) {
      expanded.details = { profile_path: minimalNominee.profilePath };
    }

    return expanded;
  } else if (minimalNominee.type === 'movie') {
    const movieEntry = entriesLibrary.find(entry => entry.movie.id === minimalNominee.movieId);

    if (!movieEntry) {
      console.warn('⚠️ Could not find movie entry:', minimalNominee);
      return null;
    }

    return movieEntry;
  }

  // Fallback for unknown types or legacy data
  return minimalNominee;
}

// Grammar helpers for the user-configurable personal award name
// (settings.personalAwardName, e.g. "The Groskers" — see Home.vue's
// settings panel). Shared so MovieDetail.vue's "My Awards" heading agrees
// with Home.vue/PersonalAwardsModal.vue rather than hardcoding "Oscar".
export function awardNameWithThe (personalAwardName) {
  const name = personalAwardName || 'Oscar';
  return name.toLowerCase().startsWith('the ') ? name : `The ${name}`;
}

export function awardNameWithoutThe (personalAwardName) {
  const name = personalAwardName || 'Oscar';
  return name.toLowerCase().startsWith('the ') ? name.substring(4) : name;
}

export function awardNameSingular (personalAwardName) {
  const name = awardNameWithoutThe(personalAwardName);
  if (name.toLowerCase().endsWith('ies')) {
    return name.slice(0, -3) + 'y'; // e.g., "Smithies" -> "Smithy"
  } else if (name.toLowerCase().endsWith('s')) {
    return name.slice(0, -1); // e.g., "Oscars" -> "Oscar"
  }
  return name; // Already singular
}

// Lead <-> supporting sibling categories. The same person for the same
// movie/role must not be nominated in both (user feedback: "I've in a few
// places nominated somebody for both best actor and best supporting actor
// for the same role in the same movie. And I really shouldn't do that.").
// Cross-MOVIE double nominations stay legal — a busy year is a real thing.
export const ACTING_SIBLING_CATEGORIES = {
  bestActor: 'bestSupportingActor',
  bestSupportingActor: 'bestActor',
  bestActress: 'bestSupportingActress',
  bestSupportingActress: 'bestActress'
};

/**
 * The sibling category key that already holds this person for this movie,
 * or null. `person` needs { name?, id?, movieId }; nominees are the modal's
 * minimal shapes. Matched on movieId plus name (primary — ids can be
 * name-fallbacks on cast entries) or id.
 */
export function actingSiblingConflict (categoryKey, person, awardsData) {
  const sibling = ACTING_SIBLING_CATEGORIES[categoryKey];
  if (!sibling || !person || person.movieId == null) return null;

  const nominees = awardsData?.[sibling]?.nominees || [];
  const samePerson = (nominee) => {
    if (!nominee || nominee.movieId !== person.movieId) return false;
    if (nominee.name && person.name) return nominee.name === person.name;
    if (nominee.id != null && person.id != null) return String(nominee.id) === String(person.id);
    return false;
  };

  return nominees.some(samePerson) ? sibling : null;
}

// The minimum rated movies a year needs before the awards flow offers it.
// Was a hardcoded 10 — "an arbitrary number that I came up with for me"
// (bug report 2026-08-15); now a per-user setting with 10 as the default.
export function awardsYearThreshold (settings) {
  const value = Number(settings?.awardsYearThreshold);
  return Number.isFinite(value) && value >= 1 ? Math.floor(value) : 10;
}

// Every year the awards flow will offer, oldest first, each with how far
// through its categories you are.
//
// Deliberately NOT the same list as the modal's `yearsEligibleForAwards`,
// which drops finished years because it answers "what should I work on next".
// This answers "which years can I look at", so a completed year stays in it —
// that's the whole point of browsing back to one (Matt, 2026-08-16: "I'm not
// sure how to get to my awards view. If I wanna just look at a single year's
// awards").
//
// Ascending, matching the year scroller on the home screen.
export function awardsYearsWithProgress (entries, settings, totalCategories) {
  const threshold = awardsYearThreshold(settings);
  const personalAwards = settings?.personalAwards || {};
  const counts = {};

  (entries || []).forEach((entry) => {
    const releaseDate = entry?.movie?.release_date;
    if (!releaseDate) return;
    // Shorts don't compete, the same exclusion the modal applies.
    if (entry.movie.runtime && entry.movie.runtime <= 40) return;

    const year = new Date(releaseDate).getFullYear();
    if (!Number.isFinite(year)) return;
    counts[year] = (counts[year] || 0) + 1;
  });

  return Object.keys(counts)
    .map(Number)
    .filter((year) => Number.isFinite(year) && counts[year] >= threshold)
    .sort((a, b) => a - b)
    .map((year) => {
      const awardData = personalAwards[year];
      const categories = awardData?.categories ? Object.values(awardData.categories) : [];
      // A category counts as done when it has a winner, or when it was
      // explicitly marked as having no nominees.
      const completedCategories = categories.filter(
        (category) => (category?.nominees?.length > 0 && category.winner) || category?.noNominees === true
      ).length;

      return {
        year,
        movieCount: counts[year],
        completedCategories,
        totalCategories,
        started: completedCategories > 0,
        completed: completedCategories === totalCategories || awardData?.completed === true
      };
    });
}
