// Cineplexity — pure round logic (Brian-survey F5, his 'trait challenge':
// "draw a pair of movie traits and uncover every title in your log that
// matches them both"). Store-free, injected rng, like every game module.

const DECADE = (entry) => {
  const year = new Date(entry?.movie?.release_date ?? NaN).getFullYear();
  return Number.isFinite(year) ? `${Math.floor(year / 10) * 10}s` : null;
};

// Trait extractors: each returns the entry's values for that trait kind.
const TRAIT_KINDS = [
  { kind: 'genre', label: (v) => v, values: (e) => (e?.movie?.genres || []).map((g) => g?.name).filter(Boolean) },
  { kind: 'decade', label: (v) => `the ${v}`, values: (e) => (DECADE(e) ? [DECADE(e)] : []) },
  {
    kind: 'actor',
    label: (v) => v,
    // Top billing only — deep-cast cameos would make traits unguessable.
    values: (e) => (e?.movie?.cast || []).slice(0, 5).map((p) => p?.name).filter(Boolean)
  },
  { kind: 'director', label: (v) => v, values: (e) => (e?.movie?.crew || []).filter((p) => p?.job === 'Director').map((p) => p.name).filter(Boolean) }
];

function entryMatchesTrait (entry, trait) {
  const kind = TRAIT_KINDS.find((t) => t.kind === trait.kind);
  return kind ? kind.values(entry).includes(trait.value) : false;
}

// Builds a solvable round: two traits of DIFFERENT kinds whose intersection
// has minMatches..maxMatches movies. Tries random pairs; null when the
// library can't produce one (tiny libraries).
export function buildCineplexityRound (entries, rng = Math.random, { minMatches = 3, maxMatches = 20, attempts = 200 } = {}) {
  const rated = (entries || []).filter((e) => e?.movie?.title);
  if (rated.length < minMatches) return null;

  // Candidate trait values with enough presence on their own.
  const pools = TRAIT_KINDS.map(({ kind, label, values }) => {
    const counts = new Map();
    rated.forEach((entry) => values(entry).forEach((value) => counts.set(value, (counts.get(value) || 0) + 1)));
    return {
      kind,
      options: [...counts.entries()]
        .filter(([, count]) => count >= minMatches)
        .map(([value]) => ({ kind, value, label: label(value) }))
    };
  }).filter((pool) => pool.options.length);

  if (pools.length < 2) return null;

  for (let attempt = 0; attempt < attempts; attempt++) {
    const [poolA, poolB] = pickTwo(pools, rng);
    const traitA = poolA.options[Math.floor(rng() * poolA.options.length)];
    const traitB = poolB.options[Math.floor(rng() * poolB.options.length)];
    const matches = rated
      .filter((entry) => entryMatchesTrait(entry, traitA) && entryMatchesTrait(entry, traitB))
      // Chronological by release (QA): the slot row reads as a timeline,
      // and "what is the early one I am missing?" becomes a real deduction.
      .sort((a, b) => new Date(a.movie.release_date ?? 0) - new Date(b.movie.release_date ?? 0));
    if (matches.length >= minMatches && matches.length <= maxMatches) {
      return { traitA, traitB, matches };
    }
  }
  return null;
}

function pickTwo (pools, rng) {
  const first = Math.floor(rng() * pools.length);
  let second = Math.floor(rng() * (pools.length - 1));
  if (second >= first) second += 1;
  return [pools[first], pools[second]];
}

// Guess matching: case/punctuation-insensitive; exact normalized title, or
// an unambiguous prefix (>= 4 chars matching exactly one remaining title).
export function normalizeTitle (title) {
  return String(title || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function matchGuess (guess, remaining) {
  const needle = normalizeTitle(guess);
  if (needle.length < 2) return null;
  const exact = remaining.find((entry) => normalizeTitle(entry.movie.title) === needle);
  if (exact) return exact;
  if (needle.length >= 4) {
    const prefixed = remaining.filter((entry) => normalizeTitle(entry.movie.title).startsWith(needle));
    if (prefixed.length === 1) return prefixed[0];
  }
  return null;
}
