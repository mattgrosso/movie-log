import { getRating } from './GetRating.js';

// The header banner is normally resolved by Home when the library arrives
// (see Home.resolveBanner, which also honours store.bannerRequest). But on a
// cold boot straight into a deep route — /awards, /watchlist, a game — Home
// never mounts, nothing ever set bannerUrl, and the header rendered as a bare
// strip: half of the "site is pretty broken after refreshing on a non-home
// page" report. This is the route-independent fallback App.vue applies once
// the library loads if nothing else has picked a banner: the same
// rated-over-6 random pick as Home's own no-context branch.
export function pickFallbackBanner (entries, random = Math.random) {
  if (!entries || !entries.length) return null;

  const overSix = entries.filter((entry) => (getRating(entry)?.calculatedTotal ?? 0) > 6);
  const pool = overSix.length ? overSix : entries;
  const media = pool[Math.floor(random() * pool.length)];
  if (!media || !media.movie) return null;

  const backdrop = media.customBackdropPath || media.movie.backdrop_path;
  return backdrop ? `https://image.tmdb.org/t/p/w500${backdrop}` : null;
}
