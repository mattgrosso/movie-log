// Pure logic for the library poster (bug-report request: "produce some kind
// of actual like printable artifact... when you reach 100 movies you can
// make a poster of all your little posters"). Selection + grid math live
// here; the canvas drawing itself is DOM work and stays in
// LibraryPoster.vue.

// Which movies go on the poster, in which order. Modes:
//   'top'  — the best `cap` by rating, best first (the "first 100" feel).
//   'all'  — everything with a poster, chronological by first watch, so the
//            artifact reads as a viewing autobiography.
//   'year' — this calendar year's watches, chronological.
export function pickPosterEntries (entries, mode, getRatingFn, now = new Date(), { cap = 100 } = {}) {
  const withPosters = (entries || []).filter((entry) => entry?.movie?.poster_path);

  const firstWatched = (entry) => {
    const times = (entry.ratings || [])
      .map((rating) => new Date(rating?.date ?? NaN).getTime())
      .filter(Number.isFinite);
    return times.length ? Math.min(...times) : Infinity;
  };

  if (mode === 'top') {
    return withPosters
      .map((entry) => ({ entry, rating: getRatingFn(entry)?.calculatedTotal ?? 0 }))
      .sort((a, b) => b.rating - a.rating)
      .slice(0, cap)
      .map(({ entry }) => entry);
  }

  const chronological = withPosters
    .map((entry) => ({ entry, at: firstWatched(entry) }))
    .sort((a, b) => a.at - b.at);

  if (mode === 'year') {
    const yearStart = new Date(now.getFullYear(), 0, 1).getTime();
    return chronological.filter(({ at }) => Number.isFinite(at) && at >= yearStart).map(({ entry }) => entry);
  }

  return chronological.map(({ entry }) => entry);
}

// Grid dimensions whose overall shape lands as close as possible to a movie
// poster's own 2:3, given N tiles of tileW×tileH. Returns cols/rows plus
// pixel dimensions including margins.
export function gridLayout (count, { tileW = 92, tileH = 138, gap = 4, margin = 60, footer = 90, targetAspect = 2 / 3 } = {}) {
  if (!count) return null;

  let best = null;
  for (let cols = 1; cols <= count; cols++) {
    const rows = Math.ceil(count / cols);
    const width = cols * tileW + (cols - 1) * gap + margin * 2;
    const height = rows * tileH + (rows - 1) * gap + margin * 2 + footer;
    const aspect = width / height;
    const badness = Math.abs(Math.log(aspect / targetAspect));
    if (!best || badness < best.badness) {
      best = { cols, rows, width, height, badness };
    }
  }

  const { cols, rows, width, height } = best;
  return { cols, rows, width, height, tileW, tileH, gap, margin, footer };
}

// Where tile i sits on the canvas.
export function tilePosition (index, layout) {
  const col = index % layout.cols;
  const row = Math.floor(index / layout.cols);
  return {
    x: layout.margin + col * (layout.tileW + layout.gap),
    y: layout.margin + row * (layout.tileH + layout.gap)
  };
}

export function posterCaption (mode, count, now = new Date()) {
  const year = now.getFullYear();
  if (mode === 'top') return `My top ${count} · Cinema Roll`;
  if (mode === 'year') return `${year} in movies · ${count} watched · Cinema Roll`;
  return `${count} movies and counting · Cinema Roll`;
}

// Highlight matching (feedback 2026-08-15: "select a genre or an actor or
// any specific data point and then get a poster where only the ones...
// that match are filled in, and everything else is... faded out"). Matches
// against genre names, cast, crew, and keywords — the data points, not the
// title (highlighting by title would just be search).
export function entryMatchesHighlight (entry, query) {
  const needle = (query || '').trim().toLowerCase();
  if (!needle) return true;
  const movie = entry?.movie || {};
  const haystacks = [
    ...(movie.genres || []).map((g) => g?.name),
    ...(movie.cast || []).map((p) => p?.name),
    ...(movie.crew || []).map((p) => p?.name),
    ...(movie.flatKeywords || []),
    ...(movie.keywords || []).map((k) => k?.name)
  ];
  return haystacks.some((h) => typeof h === 'string' && h.toLowerCase().includes(needle));
}

// Photomosaic assignment (feedback: "use a bunch of small images to
// generate the impression of a larger image" + round two: "finer tuned
// imagery... more pixels working"). Each cell and tile is a 2x2 QUADRANT
// color signature (12 numbers) rather than a single average — so matching
// captures gradients and structure, not just overall tint. maxUse caps
// repetition loosely (reuse WAS the fidelity lever Matt asked about);
// pass Infinity for pure fidelity.
export function signatureDistance (a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return sum;
}

export function assignMosaicCells (cellSignatures, tileSignatures, { maxUse = null, cols = 0, rng = Math.random } = {}) {
  if (!tileSignatures.length) return [];
  const cap = maxUse || Math.max(2, Math.ceil(cellSignatures.length / tileSignatures.length) * 3);
  const used = new Array(tileSignatures.length).fill(0);
  const assigned = new Array(cellSignatures.length).fill(-1);

  for (let cellIndex = 0; cellIndex < cellSignatures.length; cellIndex++) {
    const cell = cellSignatures[cellIndex];

    // No poster directly beside itself (feedback: "ten or twelve all
    // grouped together... breaks the sort of magic") — flat regions used
    // to fill with contiguous slabs of one tile. Neighbors already
    // assigned in reading order: left, up-left, up, up-right.
    const forbidden = new Set();
    if (cols > 0) {
      const col = cellIndex % cols;
      if (col > 0) forbidden.add(assigned[cellIndex - 1]);
      if (cellIndex >= cols) {
        forbidden.add(assigned[cellIndex - cols]);
        if (col > 0) forbidden.add(assigned[cellIndex - cols - 1]);
        if (col < cols - 1) forbidden.add(assigned[cellIndex - cols + 1]);
      }
    }

    // Collect the few best candidates, then pick randomly among those
    // within ~15% of the best distance — in flat regions many tiles are
    // near-equal matches, and scattering them is what keeps the texture
    // varied instead of banded.
    let candidates = [];
    const consider = (respectRules) => {
      candidates = [];
      for (let i = 0; i < tileSignatures.length; i++) {
        if (respectRules && (used[i] >= cap || forbidden.has(i))) continue;
        const dist = signatureDistance(cell, tileSignatures[i]);
        if (candidates.length < 4) {
          candidates.push({ i, dist });
          candidates.sort((a, b) => a.dist - b.dist);
        } else if (dist < candidates[3].dist) {
          candidates[3] = { i, dist };
          candidates.sort((a, b) => a.dist - b.dist);
        }
      }
    };
    consider(true);
    if (!candidates.length) consider(false); // tiny libraries: rules yield

    const bestDist = candidates[0].dist;
    const nearBest = candidates.filter((c) => c.dist <= bestDist * 1.15 + 300);
    const pick = nearBest[Math.floor(rng() * nearBest.length)] || candidates[0];

    used[pick.i] += 1;
    assigned[cellIndex] = pick.i;
  }

  return assigned;
}

// Typeahead options for the highlight input (feedback: "start to type
// something and then choose from a list"). Every distinct data point in
// the library, tagged by kind so the list can say what a match IS.
export function collectHighlightOptions (entries) {
  const seen = new Map(); // lowercase -> { label, kind }
  const add = (label, kind) => {
    if (typeof label !== 'string' || label.length < 2) return;
    const key = label.toLowerCase();
    if (!seen.has(key)) seen.set(key, { label, kind });
  };
  (entries || []).forEach((entry) => {
    const movie = entry?.movie || {};
    (movie.genres || []).forEach((g) => add(g?.name, 'genre'));
    (movie.cast || []).forEach((p) => add(p?.name, 'cast'));
    (movie.crew || []).forEach((p) => add(p?.name, 'crew'));
    (movie.flatKeywords || []).forEach((k) => add(k, 'keyword'));
    (movie.keywords || []).forEach((k) => add(k?.name, 'keyword'));
  });
  return [...seen.values()];
}

// Prefix matches first, then substring matches, capped.
export function suggestHighlights (options, query, cap = 12) {
  const needle = (query || '').trim().toLowerCase();
  if (needle.length < 2) return [];
  const starts = [];
  const contains = [];
  for (const option of options) {
    const lower = option.label.toLowerCase();
    if (lower === needle) continue; // already typed exactly
    if (lower.startsWith(needle)) starts.push(option);
    else if (lower.includes(needle)) contains.push(option);
    if (starts.length >= cap) break;
  }
  return [...starts, ...contains].slice(0, cap);
}
