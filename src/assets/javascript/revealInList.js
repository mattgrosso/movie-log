// Jumping from a movie to its place in the Home list.
//
// Bug report (2026-08-20): "I can look up a movie and I can see that it's 134th
// movie but it'd be cool if there was a quick way for me to then essentially
// scroll down until I'm looking at it so I can see what movies are right around
// it in my ratings."
//
// Deliberately NOT a new display — Matt, 2026-08-21: "I don't want like a new
// display like we have on the rate movie page. I just want a way for me to jump
// to the home screen, scroll to the position of that movie, so we use the
// existing sorting and sort order. I just wanna see where that movie lives and
// who its neighbors are on the home screen."
//
// So: same list, same sort, same order. All this does is find the row and put
// it on screen.

/**
 * The DOM id DBGridLayoutSearchResult puts on each result's <li>.
 *
 * Duplicated from that component's own `sanitizeId` on purpose — it is a
 * private method on a component with multiple root nodes, so there is nothing
 * to import and nothing to read it off the outside of. A test pins the two
 * together.
 */
export const resultElementId = (dbKey) =>
  `movie-${String(dbKey).replace(/[^a-z0-9\-_:.]/gi, '_')}`;

/** Where a movie sits in an already-sorted result list, or -1. */
export const indexOfMovie = (sortedResults, dbKey) => {
  if (!dbKey || !Array.isArray(sortedResults)) return -1;
  return sortedResults.findIndex((result) => result?.dbKey === dbKey);
};

/**
 * How many results have to be rendered for `index` to exist in the DOM.
 *
 * Home renders `sortedResults.slice(0, numberOfResultsToShow)` and grows that
 * on scroll, so a film at #134 simply isn't in the document until enough of
 * the list is. The extra rows are the point of the whole feature: they are the
 * neighbours below it.
 */
export const resultsNeededToReveal = (index, currentlyShown, neighbourMargin = 12) => {
  if (index < 0) return currentlyShown;
  return Math.max(currentlyShown, index + 1 + neighbourMargin);
};

/**
 * Document offset that puts an element around a third of the way down the
 * viewport, so its neighbours above AND below are both visible — centring it
 * exactly wastes the taller half of a phone screen on what is above.
 */
export const scrollOffsetFor = (elementTop, viewportHeight) =>
  Math.max(0, Math.round(elementTop - viewportHeight / 3));
