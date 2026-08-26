// One person, one film, one credit.
//
// Every Favorite section gathers the same way: walk each film's cast or crew
// and push an appearance for every match. That pushes the SAME film twice
// whenever one person holds two qualifying credits on it — a writer credited
// both "Screenplay" and "Novel" (Michael Crichton on Jurassic Park), a
// producer with two producing credits, an actor cast in two roles (Terry
// Jones in Monty Python and the Holy Grail).
//
// Measured against a real 1,385-film library: 264 doubled writer credits
// across 234 people, 55 producer credits, 31 cast. Composers, directors,
// cinematographers and editors happen to have none today, but the code path
// is identical, so it is latent there rather than absent.
//
// This was never only cosmetic. A duplicate inflates the person's film COUNT
// (so they clear `minEntries` on fewer real films) and feeds the same rating
// into `personLogScore` twice, which moves where they rank. Bug report
// 2026-08-25: "do a better job of de-duping the list of credits."

/**
 * Collapse a person's appearances to one per film, keeping the appearance
 * with the BEST billing — a lead credited a second time further down the cast
 * list must not be demoted to that second position.
 *
 * Order is preserved for the survivors, so the callers' own deterministic
 * sorts still see what they expect. An appearance with no identifiable film
 * is kept rather than dropped: losing a credit is worse than keeping a
 * possible duplicate, and it can't be merged with anything anyway.
 */
export const dedupeAppearancesByFilm = (appearances) => {
  const best = new Map();

  (appearances || []).forEach((appearance, index) => {
    const movieId = appearance?.entry?.movie?.id;
    const key = movieId !== undefined && movieId !== null
      ? `id:${movieId}`
      : (appearance?.entry?.dbKey ? `key:${appearance.entry.dbKey}` : `unkeyed:${index}`);

    const existing = best.get(key);
    if (!existing) {
      best.set(key, appearance);
      return;
    }
    // Lower billing is better; a missing billing sorts last.
    const incoming = Number.isFinite(appearance?.billing) ? appearance.billing : Infinity;
    const current = Number.isFinite(existing?.billing) ? existing.billing : Infinity;
    if (incoming < current) best.set(key, appearance);
  });

  return [...best.values()];
};
