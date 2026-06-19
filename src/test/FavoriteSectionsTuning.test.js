import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'

import FavoriteDirectors from '@/components/FavoriteDirectors.vue'
import FavoriteWriters from '@/components/FavoriteWriters.vue'
import FavoriteComposers from '@/components/FavoriteComposers.vue'
import FavoriteCinematographers from '@/components/FavoriteCinematographers.vue'
import FavoriteEditors from '@/components/FavoriteEditors.vue'
import FavoriteProducers from '@/components/FavoriteProducers.vue'
import FavoriteActors from '@/components/FavoriteActors.vue'
import FavoriteActresses from '@/components/FavoriteActresses.vue'

vi.mock('@/assets/javascript/GetRating.js', () => ({
  getRating: vi.fn(() => ({ calculatedTotal: 8, normalizedRating: 8 }))
}))

// Every section now shares the favoriteTuning mixin. This verifies, for each,
// that it: builds, exposes the right tuner levers, persists to its OWN settings
// key, re-tunes live (minEntries), and reuses cached TMDB lookups (no re-fetch).
const CREW = [
  { name: 'Directors', comp: FavoriteDirectors, key: 'director', job: 'Director' },
  { name: 'Writers', comp: FavoriteWriters, key: 'writer', job: 'Writer' },
  { name: 'Composers', comp: FavoriteComposers, key: 'composer', job: 'Original Music Composer' },
  { name: 'Cinematographers', comp: FavoriteCinematographers, key: 'cinematographer', job: 'Cinematographer' },
  { name: 'Editors', comp: FavoriteEditors, key: 'editor', job: 'Editor' },
  { name: 'Producers', comp: FavoriteProducers, key: 'producer', job: 'Producer' }
]
const CAST = [
  { name: 'Actors', comp: FavoriteActors, key: 'actor', gender: 2 },
  { name: 'Actresses', comp: FavoriteActresses, key: 'actress', gender: 1 }
]

const RATING = { calculatedTotal: 8, direction: 8, story: 8, soundtrack: 8, imagery: 8, performance: 8 }

function crewLibrary(job) {
  // "Star" appears in 2 films (below every crew default minEntries), so they
  // only surface after we tune minEntries down — a clean live-retune assertion.
  return Array.from({ length: 2 }, (_, i) => ({
    movie: { id: i + 1, title: `Film ${i}`, crew: [{ job, name: 'Star Person' }] },
    ratings: [RATING]
  }))
}

function castLibrary() {
  return Array.from({ length: 2 }, (_, i) => ({
    movie: { id: i + 1, title: `Film ${i}`, cast: [{ name: 'Star Person' }] },
    ratings: [RATING]
  }))
}

function mountSection(comp, library, dispatch, fetchImpl) {
  global.fetch = fetchImpl
  return mount(comp, {
    props: { allEntriesWithFlatKeywordsAdded: library },
    global: {
      mocks: { $store: { state: { settings: {} }, commit: vi.fn(), dispatch } },
      stubs: { FavoriteTuner: true }
    }
  })
}

afterEach(() => vi.restoreAllMocks())

describe('Favorite sections — shared tuning mixin', () => {
  describe.each(CREW)('$name (crew)', ({ comp, key }) => {
    let wrapper, dispatch, fetchSpy

    beforeEach(async () => {
      dispatch = vi.fn()
      fetchSpy = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ results: [] }) })
      wrapper = mountSection(comp, crewLibrary(CREW.find(c => c.key === key).job), dispatch, fetchSpy)
      await wrapper.vm.buildTopTwelveList()
    })

    it('exposes tuner levers and starts excluding the 2-film person (default minEntries)', () => {
      expect(wrapper.vm.tunerLevers.length).toBeGreaterThanOrEqual(4)
      expect(wrapper.vm.topTenList.map(d => d.name)).not.toContain('Star Person')
    })

    it(`re-tunes live and persists to settings/favoriteTuning/${key}`, async () => {
      await wrapper.vm.onTunerUpdate({ key: 'minEntries', value: 1 })
      expect(wrapper.vm.topTenList.map(d => d.name)).toContain('Star Person')
      expect(dispatch).toHaveBeenCalledWith('setDBValue', expect.objectContaining({
        path: `settings/favoriteTuning/${key}`,
        value: expect.objectContaining({ minEntries: 1 })
      }))
    })

    it('does not re-hit TMDB when changing a pure-scoring lever', async () => {
      await wrapper.vm.onTunerUpdate({ key: 'minEntries', value: 1 }) // fetches Star once
      const calls = fetchSpy.mock.calls.length
      await wrapper.vm.onTunerUpdate({ key: 'countWeight', value: 1 })
      expect(fetchSpy.mock.calls.length).toBe(calls)
    })

    it('resetTuner restores defaults', async () => {
      await wrapper.vm.onTunerUpdate({ key: 'minEntries', value: 1 })
      await wrapper.vm.resetTuner()
      expect(wrapper.vm.minEntries).toBe(wrapper.vm.tuningDefaults.minEntries)
    })
  })

  describe.each(CAST)('$name (cast)', ({ comp, key, gender }) => {
    let wrapper, dispatch, fetchSpy

    beforeEach(async () => {
      dispatch = vi.fn()
      // TMDB returns a person of the matching gender so the gender gate passes.
      fetchSpy = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ results: [{ gender, known_for: [] }] }) })
      wrapper = mountSection(comp, castLibrary(), dispatch, fetchSpy)
      await wrapper.vm.buildTopTwelveList()
    })

    it('has billingLimit + billingExponent levers and excludes the 2-film person by default', () => {
      const keys = wrapper.vm.tunerLevers.map(l => l.key)
      expect(keys).toContain('billingLimit')
      expect(keys).toContain('billingExponent')
      expect(wrapper.vm.topTenList.map(d => d.name)).not.toContain('Star Person')
    })

    it(`re-tunes live (gender-gated) and persists to settings/favoriteTuning/${key}`, async () => {
      await wrapper.vm.onTunerUpdate({ key: 'minEntries', value: 1 })
      expect(wrapper.vm.topTenList.map(d => d.name)).toContain('Star Person')
      expect(dispatch).toHaveBeenCalledWith('setDBValue', expect.objectContaining({
        path: `settings/favoriteTuning/${key}`,
        value: expect.objectContaining({ minEntries: 1 })
      }))
    })

    it('excludes people of the other gender', async () => {
      // Re-mount with the opposite gender from TMDB → Star should be filtered out.
      const otherGender = gender === 2 ? 1 : 2
      const otherFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ results: [{ gender: otherGender, known_for: [] }] }) })
      const w = mountSection(comp, castLibrary(), vi.fn(), otherFetch)
      await w.vm.buildTopTwelveList()
      await w.vm.onTunerUpdate({ key: 'minEntries', value: 1 })
      expect(w.vm.topTenList.map(d => d.name)).not.toContain('Star Person')
    })
  })
})
