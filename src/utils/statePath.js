// Pure, store-free immutable nested-set helper. Given a slash-delimited path
// (e.g. "personalAwards/2024" or "tieBreakTournament") and a value, returns a
// NEW object with that value set at the given path — cloning only the
// objects actually along the path, leaving every sibling reference untouched.
//
// Backs applyDbPathLocally (store/index.js), the general-purpose counterpart
// to setMovieLogEntry for arbitrary settings/* (and deeper movieLog/*) paths
// — see that mutation's own comment for why a generic version was needed.
export function setValueAtPath (obj, segments, value) {
  if (!segments.length) return value;
  const [head, ...rest] = segments;
  const base = (obj && typeof obj === 'object') ? obj : {};
  return { ...base, [head]: rest.length ? setValueAtPath(base[head], rest, value) : value };
}
