// Bug report (2026-08-18): "When looking at all the hats in my watchlist
// screen, it'd be nice if I could click on a poster in one of those lists and
// it would pop up a list of where I can watch that movie."
//
// TMDB's /movie/{id}/watch/providers is the source. Its payload is keyed by
// region and splits availability across five arrays that mean quite different
// things to a viewer, so this module turns it into the one flat, ordered shape
// the sheet renders. Pure and network-free, per the repo's preference for
// extracting logic out of components (CLAUDE.md).
//
// Attribution: TMDB sources this data from JustWatch and requires them to be
// credited wherever it is shown — see WhereToWatch.vue's footer.

export const PROVIDER_REGION = 'US';

// Provider logos are small square marks; w92 is TMDB's smallest logo size and
// is already twice the 32px they render at.
export const providerLogo = (logoPath) =>
  (logoPath ? `https://image.tmdb.org/t/p/w92${logoPath}` : null);

// Order matters — it is the order a viewer cares about. Free before paid,
// and "already included in something you probably pay for" before renting.
const GROUPS = [
  { key: 'free', tmdbKey: 'free', label: 'Free' },
  { key: 'stream', tmdbKey: 'flatrate', label: 'Streaming' },
  { key: 'ads', tmdbKey: 'ads', label: 'Free with ads' },
  { key: 'rent', tmdbKey: 'rent', label: 'Rent' },
  { key: 'buy', tmdbKey: 'buy', label: 'Buy' },
];

// TMDB's display_priority is per-provider-per-region and is the order it
// intends them to be listed in; entries missing it sort last rather than
// jumping to the front, which is what a plain `|| 0` would do.
const byDisplayPriority = (a, b) =>
  (a?.display_priority ?? Number.MAX_SAFE_INTEGER) - (b?.display_priority ?? Number.MAX_SAFE_INTEGER);

const toProvider = (entry) => ({
  id: entry.provider_id,
  name: entry.provider_name,
  logo: providerLogo(entry.logo_path),
});

// A provider can legitimately appear in several arrays at once (Apple TV both
// rents and sells; Peacock streams and also lists an ad tier). Deduping is per
// group, not across groups — "rent" and "buy" on the same service are two real,
// separately useful answers.
const groupProviders = (entries) => {
  const seen = new Set();
  const unique = [];

  for (const entry of entries || []) {
    // provider_id 0 would be a legal id — guard on null, not falsiness
    // (.claude/rules/testing.md: this exact typo has been caught twice here).
    if (!entry || entry.provider_id == null || seen.has(entry.provider_id)) continue;
    seen.add(entry.provider_id);
    unique.push(entry);
  }

  return unique.sort(byDisplayPriority).map(toProvider);
};

/**
 * TMDB's watch/providers payload -> { link, groups } for one region.
 *
 * `link` is TMDB's own region-specific page for the title. It is the only
 * outbound link offered: TMDB's terms don't allow deep-linking into the
 * individual providers from this endpoint, and the per-provider URLs aren't
 * in the payload anyway.
 *
 * Returns `groups: []` for a title nobody carries — an empty result and a
 * failed request are different states, and the caller distinguishes them.
 */
export const normalizeWatchProviders = (payload, region = PROVIDER_REGION) => {
  const forRegion = payload?.results?.[region];
  if (!forRegion) return { link: null, groups: [] };

  const groups = GROUPS
    .map(({ key, tmdbKey, label }) => ({ key, label, providers: groupProviders(forRegion[tmdbKey]) }))
    .filter((group) => group.providers.length);

  return { link: forRegion.link || null, groups };
};

/** Every distinct provider across every group — for a one-line summary. */
export const providerCount = (normalized) => {
  const ids = new Set();
  (normalized?.groups || []).forEach((group) => group.providers.forEach((provider) => ids.add(provider.id)));
  return ids.size;
};
