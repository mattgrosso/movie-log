import { describe, it, expect } from 'vitest';
import {
  buildWeb,
  focusWeb,
  neighboursOf,
  resolveFocus,
  scoreColor,
  layoutSignature,
  topByDegree,
  webEntries,
  movieNodeId,
  personNodeId,
  UNSCORED_COLOR
} from '@/assets/javascript/web.js';

// Matt, 2026-09-08: "one giant web of connections between like this person
// was in this and also was in this." These pin what a thread is, who gets
// to be a node, and how a neighbourhood is cut.

const entry = (id, title, { cast = [], directors = [], score = 8, runtime = 100, release = '2000-05-05' } = {}) => ({
  dbKey: `m${id}`,
  movie: {
    id,
    title,
    runtime,
    release_date: release,
    poster_path: `/${id}.jpg`,
    cast: cast.map((name) => ({ name, character: '' })),
    crew: directors.map((name) => ({ name, job: 'Director' }))
  },
  ratings: [{ calculatedTotal: score }]
});
const scoreFor = (e) => e.ratings[0].calculatedTotal;

const library = () => [
  entry(1, 'Jaws', { cast: ['Roy Scheider', 'Robert Shaw'], directors: ['Steven Spielberg'], score: 9.4 }),
  entry(2, 'Jurassic Park', { cast: ['Sam Neill', 'Laura Dern'], directors: ['Steven Spielberg'], score: 9.1 }),
  entry(3, 'The Sting', { cast: ['Paul Newman', 'Robert Shaw'], directors: ['George Roy Hill'], score: 8.2 }),
  entry(4, 'Lonely Film', { cast: ['Nobody Known'], directors: ['One Timer'], score: 6.0 })
];

describe('buildWeb', () => {
  it('makes a node per film and a node per person who appears in more than one', () => {
    const web = buildWeb(library(), { scoreFor });
    const movies = web.nodes.filter((n) => n.kind === 'movie').map((n) => n.title);
    const people = web.nodes.filter((n) => n.kind === 'person').map((n) => n.name).sort();
    expect(movies).toEqual(['Jaws', 'Jurassic Park', 'The Sting', 'Lonely Film']);
    // Scheider, Neill, Dern, Newman, Hill, Nobody Known and One Timer each
    // appear once: they join nothing to anything and are not nodes.
    expect(people).toEqual(['Robert Shaw', 'Steven Spielberg']);
  });

  it('links film to person, one thread per credit, with the role', () => {
    const web = buildWeb(library(), { scoreFor });
    const threads = web.links.map((l) => `${l.source} -> ${l.target} (${l.role})`).sort();
    expect(threads).toEqual([
      'p:Robert Shaw -> m:m1 (cast)',
      'p:Robert Shaw -> m:m3 (cast)',
      'p:Steven Spielberg -> m:m1 (director)',
      'p:Steven Spielberg -> m:m2 (director)'
    ]);
  });

  it('counts degree on both ends', () => {
    const web = buildWeb(library(), { scoreFor });
    expect(web.byId.get(movieNodeId('m1')).degree).toBe(2);   // Shaw + Spielberg
    expect(web.byId.get(movieNodeId('m4')).degree).toBe(0);   // nobody recurring
    expect(web.byId.get(personNodeId('Steven Spielberg')).count).toBe(2);
    expect(web.byId.get(personNodeId('Steven Spielberg')).directed).toBe(2);
  });

  it('caps cast per film but never directors, so a director past the cap still threads', () => {
    const bigCast = Array.from({ length: 30 }, (_, i) => `Extra ${i}`);
    const lib = [
      entry(1, 'A', { cast: bigCast, directors: ['Auteur'] }),
      entry(2, 'B', { cast: bigCast, directors: ['Auteur'] })
    ];
    const web = buildWeb(lib, { scoreFor, castLimit: 10 });
    const names = web.nodes.filter((n) => n.kind === 'person').map((n) => n.name);
    expect(names).toContain('Auteur');
    expect(names).toContain('Extra 9');
    expect(names).not.toContain('Extra 10');
  });

  it('records a director who also acts in the same film as its director, once', () => {
    const lib = [
      entry(1, 'A', { cast: ['Clint Eastwood'], directors: ['Clint Eastwood'] }),
      entry(2, 'B', { cast: ['Clint Eastwood'] })
    ];
    const web = buildWeb(lib, { scoreFor });
    const links = web.links.filter((l) => l.source === personNodeId('Clint Eastwood'));
    expect(links).toHaveLength(2);
    expect(links.find((l) => l.target === movieNodeId('m1')).role).toBe('director');
  });

  it('carries each film\'s score, and null rather than NaN when it has none', () => {
    const web = buildWeb(library(), { scoreFor: (e) => (e.movie.id === 1 ? NaN : scoreFor(e)) });
    expect(web.byId.get(movieNodeId('m1')).score).toBeNull();
    expect(web.byId.get(movieNodeId('m2')).score).toBe(9.1);
  });

  it('skips entries with no movie record and tolerates missing cast and crew', () => {
    const web = buildWeb([{ dbKey: 'x' }, { dbKey: 'y', movie: { id: 9, title: 'Bare' } }], { scoreFor: () => 7 });
    expect(web.nodes.map((n) => n.label)).toEqual(['Bare']);
    expect(web.links).toEqual([]);
  });
});

describe('neighboursOf', () => {
  it('is the ids on the other end of every thread, and empty for the unconnected', () => {
    const web = buildWeb(library(), { scoreFor });
    expect([...neighboursOf(web, movieNodeId('m1'))].sort()).toEqual(['p:Robert Shaw', 'p:Steven Spielberg']);
    expect([...neighboursOf(web, personNodeId('Robert Shaw'))].sort()).toEqual(['m:m1', 'm:m3']);
    expect(neighboursOf(web, movieNodeId('m4')).size).toBe(0);
    expect(neighboursOf(web, 'nope').size).toBe(0);
  });
});

describe('focusWeb', () => {
  it('from a film: its people and their other films, two hops, nothing further', () => {
    const web = buildWeb(library(), { scoreFor });
    const cut = focusWeb(web, movieNodeId('m2'));            // Jurassic Park
    const ids = cut.nodes.map((n) => n.id).sort();
    // Spielberg (hop 1) -> Jaws (hop 2). Jaws's Robert Shaw is hop 3: out.
    expect(ids).toEqual(['m:m1', 'm:m2', 'p:Steven Spielberg']);
    expect(cut.focus).toBe('m:m2');
  });

  it('from a person: their films and everyone else in them', () => {
    const web = buildWeb(library(), { scoreFor });
    const cut = focusWeb(web, personNodeId('Steven Spielberg'));
    const ids = cut.nodes.map((n) => n.id).sort();
    expect(ids).toEqual(['m:m1', 'm:m2', 'p:Robert Shaw', 'p:Steven Spielberg']);
    // Shaw's other film, The Sting, is three hops away and stays out — and
    // so does the thread to it.
    expect(cut.links.some((l) => l.target === 'm:m3')).toBe(false);
    expect(cut.links).toHaveLength(3);
  });

  it('hands back copies, so a layout can move them without touching the whole web', () => {
    const web = buildWeb(library(), { scoreFor });
    const cut = focusWeb(web, movieNodeId('m1'));
    cut.nodes[0].x = 999;
    expect(web.byId.get(cut.nodes[0].id).x).toBeUndefined();
  });

  it('is null for an id that is not in the web', () => {
    expect(focusWeb(buildWeb(library(), { scoreFor }), 'm:none')).toBeNull();
  });
});

describe('resolveFocus', () => {
  const web = buildWeb(library(), { scoreFor });

  it('finds a film by tmdbId whether the query is a string or a number', () => {
    expect(resolveFocus(web, { movie: '3' })).toBe('m:m3');
    expect(resolveFocus(web, { movie: 3 })).toBe('m:m3');
  });

  it('finds a person by exact name', () => {
    expect(resolveFocus(web, { person: 'Robert Shaw' })).toBe('p:Robert Shaw');
  });

  it('is null — the whole web — for nothing, an unknown film, or a one-film person', () => {
    expect(resolveFocus(web, {})).toBeNull();
    expect(resolveFocus(web, { movie: '404' })).toBeNull();
    expect(resolveFocus(web, { person: 'Sam Neill' })).toBeNull();
    expect(resolveFocus(null, { person: 'Robert Shaw' })).toBeNull();
  });
});

describe('scoreColor', () => {
  it('runs cool-and-dim to warm-and-bright across 5..10 and clamps outside it', () => {
    expect(scoreColor(5)).toBe(scoreColor(2));
    expect(scoreColor(10)).toBe(scoreColor(11));
    expect(scoreColor(5)).not.toBe(scoreColor(10));
    // Hue falls as the score rises (blue -> gold).
    const hue = (css) => Number(css.match(/hsl\((\d+)/)[1]);
    expect(hue(scoreColor(6))).toBeGreaterThan(hue(scoreColor(9)));
  });

  it('has one colour for an unscored film', () => {
    expect(scoreColor(null)).toBe(UNSCORED_COLOR);
    expect(scoreColor(NaN)).toBe(UNSCORED_COLOR);
    expect(scoreColor('8')).toBe(UNSCORED_COLOR);
  });
});

describe('layoutSignature', () => {
  it('is the same for the same library in any order, and different once a credit changes', () => {
    const a = layoutSignature(buildWeb(library(), { scoreFor }));
    const b = layoutSignature(buildWeb(library().reverse(), { scoreFor }));
    expect(a).toBe(b);
    const changed = library();
    changed[3].movie.cast.push({ name: 'Robert Shaw' });   // Lonely Film gains a thread
    expect(layoutSignature(buildWeb(changed, { scoreFor }))).not.toBe(a);
  });
});

describe('topByDegree', () => {
  it('ranks by connections, ties by name, optionally one kind only', () => {
    const web = buildWeb(library(), { scoreFor });
    expect(topByDegree(web.nodes, 2, 'movie').map((n) => n.title)).toEqual(['Jaws', 'Jurassic Park']);
    expect(topByDegree(web.nodes, 1, 'person').map((n) => n.name)).toEqual(['Robert Shaw']);
  });
});

describe('webEntries', () => {
  it('drops shorts unless asked, and anything without a movie record', () => {
    const all = [entry(1, 'Feature'), entry(2, 'Short', { runtime: 12 }), { dbKey: 'ghost' }];
    expect(webEntries(all).map((e) => e.movie.title)).toEqual(['Feature']);
    expect(webEntries(all, true).map((e) => e.movie.title)).toEqual(['Feature', 'Short']);
  });
});
