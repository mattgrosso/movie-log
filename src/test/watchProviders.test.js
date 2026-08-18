import { describe, it, expect } from 'vitest';
import {
  normalizeWatchProviders,
  providerCount,
  providerLogo,
  PROVIDER_REGION
} from '../assets/javascript/watchProviders.js';

const entry = (id, name, priority, logo = `/${name}.jpg`) => ({
  provider_id: id,
  provider_name: name,
  logo_path: logo,
  display_priority: priority
});

const payload = (regionData, region = PROVIDER_REGION) => ({
  id: 550,
  results: { [region]: regionData }
});

describe('normalizeWatchProviders', () => {
  it('orders the groups free first and buy last, skipping empty ones', () => {
    const result = normalizeWatchProviders(payload({
      link: 'https://www.themoviedb.org/movie/550/watch?locale=US',
      buy: [entry(2, 'Apple TV', 1)],
      flatrate: [entry(8, 'Netflix', 0)],
      rent: [entry(2, 'Apple TV', 1)]
    }));

    // free and ads were absent, so they don't appear at all.
    expect(result.groups.map((g) => g.key)).toEqual(['stream', 'rent', 'buy']);
    expect(result.groups.map((g) => g.label)).toEqual(['Streaming', 'Rent', 'Buy']);
    expect(result.link).toBe('https://www.themoviedb.org/movie/550/watch?locale=US');
  });

  it('sorts providers within a group by TMDB display_priority', () => {
    const result = normalizeWatchProviders(payload({
      flatrate: [entry(3, 'Third', 9), entry(1, 'First', 0), entry(2, 'Second', 4)]
    }));

    expect(result.groups[0].providers.map((p) => p.name)).toEqual(['First', 'Second', 'Third']);
  });

  it('sorts a provider with no display_priority last, not first', () => {
    // A plain `|| 0` fallback would rank the missing one ahead of everything.
    const result = normalizeWatchProviders(payload({
      flatrate: [{ provider_id: 7, provider_name: 'Unranked', logo_path: '/u.jpg' }, entry(1, 'Ranked', 5)]
    }));

    expect(result.groups[0].providers.map((p) => p.name)).toEqual(['Ranked', 'Unranked']);
  });

  it('dedupes within a group but keeps the same service across groups', () => {
    const result = normalizeWatchProviders(payload({
      rent: [entry(2, 'Apple TV', 1), entry(2, 'Apple TV', 1)],
      buy: [entry(2, 'Apple TV', 1)]
    }));

    const rent = result.groups.find((g) => g.key === 'rent');
    const buy = result.groups.find((g) => g.key === 'buy');
    // Renting and buying on the same service are two real answers.
    expect(rent.providers).toHaveLength(1);
    expect(buy.providers).toHaveLength(1);
  });

  it('keeps a provider whose id is 0', () => {
    // id: 0 is a legal value; a falsiness guard would drop it.
    const result = normalizeWatchProviders(payload({ flatrate: [entry(0, 'Zeroth', 1)] }));

    expect(result.groups[0].providers.map((p) => p.id)).toEqual([0]);
  });

  it('returns an empty result for a region nobody carries it in', () => {
    const result = normalizeWatchProviders(payload({ flatrate: [entry(8, 'Netflix', 0)] }, 'GB'));

    expect(result).toEqual({ link: null, groups: [] });
  });

  it('survives a missing, empty, or malformed payload', () => {
    expect(normalizeWatchProviders(undefined).groups).toEqual([]);
    expect(normalizeWatchProviders({}).groups).toEqual([]);
    expect(normalizeWatchProviders({ results: {} }).groups).toEqual([]);
    expect(normalizeWatchProviders(payload({ flatrate: [null, undefined] })).groups).toEqual([]);
  });

  it('builds a logo URL, and yields null when there is no logo', () => {
    const result = normalizeWatchProviders(payload({ flatrate: [entry(8, 'Netflix', 0, '/n.jpg')] }));

    expect(result.groups[0].providers[0].logo).toBe('https://image.tmdb.org/t/p/w92/n.jpg');
    expect(providerLogo(null)).toBe(null);
  });
});

describe('providerCount', () => {
  it('counts each service once even when it spans groups', () => {
    const result = normalizeWatchProviders(payload({
      flatrate: [entry(8, 'Netflix', 0)],
      rent: [entry(2, 'Apple TV', 1)],
      buy: [entry(2, 'Apple TV', 1)]
    }));

    expect(providerCount(result)).toBe(2);
  });

  it('is zero for nothing at all', () => {
    expect(providerCount(normalizeWatchProviders(undefined))).toBe(0);
    expect(providerCount(null)).toBe(0);
  });
});
