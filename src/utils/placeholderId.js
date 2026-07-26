// TMDB movie ids are always numeric, so a non-numeric-prefixed string id is a
// clean, collision-free discriminator for "this is a placeholder rating made
// offline, not yet matched to a real TMDB movie" — no separate boolean flag
// needs to be threaded through every call site that already compares ids.
const PLACEHOLDER_PREFIX = 'offline-';

export function makePlaceholderId () {
  return `${PLACEHOLDER_PREFIX}${crypto.randomUUID()}`;
}

export function isPlaceholderId (id) {
  return typeof id === 'string' && id.startsWith(PLACEHOLDER_PREFIX);
}
