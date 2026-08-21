// Club Venn — pure logic. From Matt's report (2026-08-21): "there's gotta be
// some kind of cool Venn diagram that we could build around friends in my
// film club... I don't know exactly what the Venn diagram would be of."
// What it became: pick any 2-3 club members (you included), pick a lens
// (everything rated / loved / this year), and the circles are those people's
// libraries under that lens. Every region is a real list of films, tappable.
//
// Same data reality as clubCharts.js: a friend's published profile carries
// `ratings: { [tmdbId]: {r, at, t, p} }` — so membership, score, when, and a
// poster exist for everyone, and that's exactly enough for a Venn.

export const LOVE_THRESHOLD = 8; // matches sharedLoves in social.js

export const LENSES = [
  { key: 'all', label: 'Everything' },
  { key: 'loved', label: 'Loved' },
  { key: 'year', label: 'This year' }
];

// ---------------------------------------------------------------------------
// People: who can be a circle. You (from your own library) plus every friend
// whose profile publishes a ratings map — shelf-only sharers have no set to
// draw. Each person's `movies` is Map<tmdbId, {id, t, p, r, at}>.
export function vennPeople (myEntries, getRatingFn, profiles) {
  const mine = new Map();
  (myEntries || []).forEach((entry) => {
    const rating = getRatingFn(entry)?.calculatedTotal;
    const id = entry?.movie?.id;
    if (!Number.isFinite(rating) || id == null) return;
    const times = (entry.ratings || [])
      .map((r) => new Date(r?.date ?? NaN).getTime())
      .filter(Number.isFinite);
    mine.set(id, {
      id,
      t: entry.movie.title || '',
      p: entry.movie.poster_path || null,
      r: Math.round(rating * 100) / 100,
      at: times.length ? Math.max(...times) : null
    });
  });

  const people = [{ key: 'you', name: 'You', movies: mine }];
  Object.entries(profiles || {}).forEach(([key, profile]) => {
    if (!profile?.ratings) return;
    const movies = new Map();
    Object.entries(profile.ratings).forEach(([id, rating]) => {
      if (!Number.isFinite(rating?.r)) return;
      const numericId = Number(id);
      movies.set(numericId, {
        id: numericId,
        t: rating.t || '',
        p: rating.p || null,
        r: rating.r,
        at: Number.isFinite(rating.at) ? rating.at : null
      });
    });
    people.push({ key, name: profile.name || 'A Cinema Roll user', movies });
  });
  return people;
}

function passesLens (movie, lens, now) {
  if (lens === 'loved') return movie.r >= LOVE_THRESHOLD;
  if (lens === 'year') {
    return movie.at != null && new Date(movie.at).getFullYear() === new Date(now).getFullYear();
  }
  return true;
}

// ---------------------------------------------------------------------------
// The partition. For 2-3 selected people, every non-empty subset of them is a
// region holding the films in exactly those libraries (under the lens).
// Regions come back in canonical order — singles, pairs, then the triple —
// each with the films sorted best-first by the average of the scores of the
// people who have it.
export function vennRegions (people, lens = 'all', now = Date.now()) {
  const lensed = (people || []).map((person) => {
    const movies = new Map();
    person.movies.forEach((movie, id) => {
      if (passesLens(movie, lens, now)) movies.set(id, movie);
    });
    return { key: person.key, name: person.name, movies };
  });

  const byId = new Map(); // id -> { keys: [], movie fields per person }
  lensed.forEach((person) => {
    person.movies.forEach((movie, id) => {
      let slot = byId.get(id);
      if (!slot) {
        slot = { id, t: movie.t, p: movie.p, keys: [], scores: {} };
        byId.set(id, slot);
      }
      // Prefer your own library's title/poster when both exist.
      if (person.key === 'you' || !slot.t) slot.t = movie.t || slot.t;
      if (person.key === 'you' || !slot.p) slot.p = movie.p || slot.p;
      slot.keys.push(person.key);
      slot.scores[person.key] = movie.r;
    });
  });

  const subsets = [];
  const keys = lensed.map((person) => person.key);
  // Singles, then pairs, then the triple — subset size ascending, and within
  // a size, selection order.
  for (let size = 1; size <= keys.length; size++) {
    const pick = (start, chosen) => {
      if (chosen.length === size) { subsets.push([...chosen]); return; }
      for (let i = start; i < keys.length; i++) pick(i + 1, [...chosen, keys[i]]);
    };
    pick(0, []);
  }

  const regions = subsets.map((subset) => {
    const signature = subset.join('|');
    const movies = [...byId.values()]
      .filter((slot) => [...slot.keys].sort().join('|') === [...subset].sort().join('|'))
      .sort((a, b) => average(Object.values(b.scores)) - average(Object.values(a.scores)));
    return { keys: subset, signature, count: movies.length, movies };
  });

  return {
    people: lensed.map((person) => ({ key: person.key, name: person.name, count: person.movies.size })),
    regions
  };
}

function average (values) {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

// ---------------------------------------------------------------------------
// Geometry. Circle areas are proportional to library size under the lens
// (1 film = 1 area unit, radius = sqrt(count/pi)), and each PAIR's distance
// is solved so the drawn lens area equals their true shared count. With
// three circles the triple region is whatever falls out of the pairwise
// solution — an exact three-way area-proportional Venn doesn't exist in
// general, and pairwise-true is the standard approximation.

// Area of the lens where two circles of radius r1, r2 at distance d overlap.
export function lensArea (r1, r2, d) {
  if (d <= Math.abs(r1 - r2)) return Math.PI * Math.min(r1, r2) ** 2;
  if (d >= r1 + r2) return 0;
  const a1 = r1 * r1 * Math.acos((d * d + r1 * r1 - r2 * r2) / (2 * d * r1));
  const a2 = r2 * r2 * Math.acos((d * d + r2 * r2 - r1 * r1) / (2 * d * r2));
  const t = 0.5 * Math.sqrt(Math.max(0,
    (-d + r1 + r2) * (d + r1 - r2) * (d - r1 + r2) * (d + r1 + r2)));
  return a1 + a2 - t;
}

// The distance between two circle centres that makes their lens area hit the
// target. Monotonic in d, so plain bisection.
export function distanceForOverlap (r1, r2, target) {
  const full = Math.PI * Math.min(r1, r2) ** 2;
  if (target <= 0) return (r1 + r2) * 1.08; // a visible gap, not a kiss
  if (target >= full) return Math.max(Math.abs(r1 - r2) * 0.6, Math.max(r1, r2) * 0.15);
  let lo = Math.abs(r1 - r2);
  let hi = r1 + r2;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (lensArea(r1, r2, mid) > target) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

// Which selected circles contain the point — the subset IS the region, which
// makes tap handling exact with no path geometry at all.
export function subsetAt (x, y, circles) {
  return circles
    .filter((circle) => (x - circle.x) ** 2 + (y - circle.y) ** 2 <= circle.r ** 2)
    .map((circle) => circle.key);
}

/**
 * Lay the circles out and normalise into a viewBox `0 0 100 H`.
 * `regions` must be the full vennRegions() result for the same people.
 * Returns { width, height, circles: [{key,x,y,r}], anchors: {signature: {x,y}} }.
 */
export function vennLayout (regionData) {
  const people = regionData.people;
  const radius = {};
  people.forEach((person) => {
    // sqrt-area scaling; a floor keeps an empty circle visible as a dot.
    radius[person.key] = Math.sqrt(Math.max(person.count, 1) / Math.PI);
  });

  const sharedBetween = (a, b) => regionData.regions
    .filter((region) => region.keys.includes(a) && region.keys.includes(b))
    .reduce((sum, region) => sum + region.count, 0);

  const keys = people.map((person) => person.key);
  let circles;
  if (keys.length === 2) {
    const d = distanceForOverlap(radius[keys[0]], radius[keys[1]], sharedBetween(keys[0], keys[1]));
    circles = [
      { key: keys[0], x: 0, y: 0, r: radius[keys[0]] },
      { key: keys[1], x: d, y: 0, r: radius[keys[1]] }
    ];
  } else {
    const d12 = distanceForOverlap(radius[keys[0]], radius[keys[1]], sharedBetween(keys[0], keys[1]));
    const d13 = distanceForOverlap(radius[keys[0]], radius[keys[2]], sharedBetween(keys[0], keys[2]));
    const d23 = distanceForOverlap(radius[keys[1]], radius[keys[2]], sharedBetween(keys[1], keys[2]));
    // Trilaterate the third centre below the first two. A collinear or
    // impossible triangle clamps to y=0; nudge it down so the circle still
    // reads as its own region.
    const x3 = (d13 * d13 - d23 * d23 + d12 * d12) / (2 * d12);
    const y3 = Math.max(Math.sqrt(Math.max(0, d13 * d13 - x3 * x3)), radius[keys[2]] * 0.35);
    circles = [
      { key: keys[0], x: 0, y: 0, r: radius[keys[0]] },
      { key: keys[1], x: d12, y: 0, r: radius[keys[1]] },
      { key: keys[2], x: x3, y: y3, r: radius[keys[2]] }
    ];
  }

  // Normalise into 0 0 100 H with padding.
  const minX = Math.min(...circles.map((c) => c.x - c.r));
  const maxX = Math.max(...circles.map((c) => c.x + c.r));
  const minY = Math.min(...circles.map((c) => c.y - c.r));
  const maxY = Math.max(...circles.map((c) => c.y + c.r));
  const pad = (maxX - minX) * 0.04;
  const scale = 100 / (maxX - minX + pad * 2);
  circles = circles.map((circle) => ({
    key: circle.key,
    x: (circle.x - minX + pad) * scale,
    y: (circle.y - minY + pad) * scale,
    r: circle.r * scale
  }));
  const height = (maxY - minY + pad * 2) * scale;

  return { width: 100, height, circles, anchors: regionAnchors(circles, regionData.regions, height) };
}

// A label point inside each non-empty region: coarse grid over the drawing,
// keep the points whose containing-subset matches the region, and pick the
// one deepest inside (max of min signed distance to every boundary). A
// region the grid can't find (sliver or fully swallowed) gets no anchor and
// lives in the legend only.
function regionAnchors (circles, regions, height) {
  const anchors = {};
  const step = Math.max(100, height) / 48;
  regions.forEach((region) => {
    if (!region.count) return;
    const want = [...region.keys].sort().join('|');
    let best = null;
    for (let x = 0; x <= 100; x += step) {
      for (let y = 0; y <= height; y += step) {
        if (subsetAt(x, y, circles).sort().join('|') !== want) continue;
        const depth = Math.min(...circles.map((circle) => {
          const dist = Math.hypot(x - circle.x, y - circle.y);
          return region.keys.includes(circle.key) ? circle.r - dist : dist - circle.r;
        }));
        if (!best || depth > best.depth) best = { x, y, depth };
      }
    }
    if (best) anchors[region.signature] = { x: best.x, y: best.y };
  });
  return anchors;
}

// "Only Seth", "You & Seth", "You, Seth & Nat".
export function regionLabel (region, people, selectedCount) {
  const names = region.keys.map((key) => people.find((person) => person.key === key)?.name || key);
  if (names.length === 1) return selectedCount > 1 ? `Only ${names[0]}` : names[0];
  if (names.length === 2) return `${names[0]} & ${names[1]}`;
  return `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`;
}
