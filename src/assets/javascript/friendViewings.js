// Which of your film club has seen and rated the film you're looking at.
//
// Bug report, 2026-08-25: "I just need little pills that show the name and
// rating for any friends who have seen and rated the movie."
//
// A lookup, not a fetch: a profile's `ratings` map is keyed by TMDB id (see
// social.js) and Home loads friend profiles on mount, so by the time a detail
// page renders the answer is already in memory.
//
// Only people who HAVE rated it appear. That's the whole scope, and it also
// sidesteps the one trap here: sharing ratings is its own opt-in tier, so a
// "shelf only" sharer publishes no `ratings` map at all (clubVenn.js skips
// those profiles for the same reason). Anyone absent from this list is either
// someone who hasn't seen it or someone who doesn't share — and since the
// screen makes no claim about the people it leaves out, it can't get that
// distinction wrong.

/**
 * Friends with a published rating for `tmdbId`, as
 * `[{ key, name, score, stars }]`.
 *
 * Highest score first — the interesting question on a detail page is who
 * loved it. Ties fall back to name so the order is stable between renders
 * rather than depending on object order.
 */
export function friendsWhoRated (friends, tmdbId) {
  // Published maps come back from Firebase as objects, so their keys are
  // always strings; a movie's id arrives as a number. Comparing the two
  // directly finds nobody.
  const id = tmdbId == null || tmdbId === '' ? null : String(tmdbId);
  if (!id) return [];

  return (friends || [])
    .map((friend) => {
      const rating = friend?.profile?.ratings?.[id];
      if (!rating || !Number.isFinite(rating.r)) return null;
      return {
        key: friend.key ?? friend.name,
        name: friend.name || 'A friend',
        score: rating.r,
        // Stars are the comparable number. `r` is a composite on each
        // person's own scale, so one friend's 8.7 and another's 8.7 are not
        // the same opinion; the normalized value behind the stars is
        // library-relative and curve-adjusted, which is exactly what makes it
        // mean the same thing across people.
        //
        // Null when their app hasn't published stars yet -- profiles only
        // gain them when their owner's app next republishes, and a raw Movie
        // Log feed carries none at all. Callers fall back to the score.
        stars: Number.isFinite(rating.s) ? rating.s : null
      };
    })
    .filter(Boolean)
    .sort((a, b) => (b.score - a.score) || a.name.localeCompare(b.name));
}
