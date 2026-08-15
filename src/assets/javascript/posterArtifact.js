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
