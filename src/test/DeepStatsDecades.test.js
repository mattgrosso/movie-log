import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import DeepStats from '@/components/DeepStats.vue'
import { lookupPerson } from '@/utils/personLookup.js'

// Bug report 2026-09-02: a decade-by-decade championship in Deep Stats.
// Driven through the DOM: the pills, the podiums, the async Actor/Actress
// split, the offline fallback, and what a tap does.

// The real getRating needs the store's weights; the fixtures carry plain
// calculatedTotals, exactly as TrophyCase.test.js does.
vi.mock('@/assets/javascript/GetRating.js', () => ({
  getRating: vi.fn((entry) => ({ calculatedTotal: entry.ratings?.[0]?.calculatedTotal }))
}))

// TMDB's gender enum: 1 female, 2 male. Anyone not listed is "not found".
const GENDERS = { 'Tom Hanks': 2, 'Meg Ryan': 1, 'Tilda Swinton': 1 }
vi.mock('@/utils/personLookup.js', () => ({
  lookupPerson: vi.fn(async (name) => (GENDERS[name] ? { id: name.length, name, gender: GENDERS[name], profile_path: null } : null))
}))

function film (id, { rating = 8, release = '1994-06-15', cast = [], crew = [], genres = [] } = {}) {
  return {
    dbKey: `k${id}`,
    movie: {
      id,
      title: `Film ${id}`,
      release_date: release,
      poster_path: `/p${id}.jpg`,
      cast: cast.map((name) => ({ name, character: 'Self' })),
      crew: crew.map(([job, name]) => ({ job, name })),
      genres: genres.map((name, i) => ({ id: i + 1, name })),
      production_companies: []
    },
    ratings: [{ date: '2024-01-01', calculatedTotal: rating }]
  }
}

// Five films from the 1990s and three from the 2000s, so the 1990s is the
// default and the 2000s has its own, different, director.
function library () {
  return [
    film(1, { rating: 9, cast: ['Tom Hanks', 'Meg Ryan'], crew: [['Director', 'Nora Ephron']], genres: ['Romance'] }),
    film(2, { rating: 8.5, cast: ['Tom Hanks', 'Meg Ryan'], crew: [['Director', 'Nora Ephron']], genres: ['Romance'] }),
    film(3, { rating: 8, cast: ['Tom Hanks', 'Nobody Known'], crew: [['Director', 'Nora Ephron']], genres: ['Romance'] }),
    film(4, { rating: 7, cast: ['Nobody Known'], crew: [['Director', 'One Off']] }),
    film(5, { rating: 6, cast: ['Tilda Swinton'] }),
    film(6, { rating: 9, release: '2004-01-01', crew: [['Director', 'Wes Anderson']] }),
    film(7, { rating: 8, release: '2007-01-01', crew: [['Director', 'Wes Anderson']] }),
    film(8, { rating: 7, release: '2009-01-01', cast: ['Tilda Swinton'] })
  ]
}

function mountDeepStats ({ isOnline = true } = {}) {
  const pushSpy = vi.fn()
  const wrapper = mount(DeepStats, {
    global: {
      stubs: { BackLink: true },
      mocks: {
        $store: {
          state: { settings: {}, isOnline },
          getters: { allMoviesAsArray: library() }
        },
        $router: { push: pushSpy }
      }
    }
  })
  return { wrapper, pushSpy }
}

const section = (wrapper) => wrapper.find('.decade-championship')
const category = (wrapper, key) => section(wrapper).find(`[data-category="${key}"]`)
const podiumNames = (wrapper, key) => category(wrapper, key).findAll('.champion-name').map((n) => n.text())

describe('DeepStats — Decade Championship', () => {
  beforeEach(() => {
    lookupPerson.mockClear()
    // PersonModal looks up a biography on open.
    global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }))
  })

  it('offers every decade as a pill, newest first, with the biggest decade selected', async () => {
    const { wrapper } = mountDeepStats()
    await flushPromises()

    const pills = section(wrapper).findAll('.ds-decade-pill')
    expect(pills.map((p) => p.text())).toEqual(['2000s', '1990s'])
    expect(pills[1].classes()).toContain('selected')
    expect(pills[0].classes()).not.toContain('selected')
    expect(section(wrapper).text()).toContain('5 films rated from the 1990s')
  })

  it('crowns the decade’s film and director, winner first with a trophy', async () => {
    const { wrapper } = mountDeepStats()
    await flushPromises()

    expect(podiumNames(wrapper, 'film')).toEqual(['Film 1', 'Film 2', 'Film 3'])
    // One Off has a single film and does not qualify.
    expect(podiumNames(wrapper, 'director')).toEqual(['Nora Ephron'])
    const winner = category(wrapper, 'director').find('.champion-card')
    expect(winner.classes()).toContain('winner')
    expect(winner.find('.bi-trophy-fill').exists()).toBe(true)
    expect(winner.find('img').attributes('src')).toContain('/p1.jpg')
  })

  it('splits the cast into Actor and Actress by TMDB gender, skipping anyone TMDB cannot find', async () => {
    const { wrapper } = mountDeepStats()
    await flushPromises()

    expect(podiumNames(wrapper, 'actor')).toEqual(['Tom Hanks'])
    expect(podiumNames(wrapper, 'actress')).toEqual(['Meg Ryan'])
    // Nobody Known has two films and would qualify, but a wrong crown is
    // worse than a missing one.
    expect(section(wrapper).text()).not.toContain('Nobody Known')
    expect(category(wrapper, 'performer').exists()).toBe(false)
  })

  it('switching decade re-crowns everything', async () => {
    const { wrapper } = mountDeepStats()
    await flushPromises()

    await section(wrapper).findAll('.ds-decade-pill')[0].trigger('click')
    await flushPromises()

    expect(section(wrapper).text()).toContain('3 films rated from the 2000s')
    expect(podiumNames(wrapper, 'director')).toEqual(['Wes Anderson'])
    expect(podiumNames(wrapper, 'film')).toEqual(['Film 6', 'Film 7', 'Film 8'])
    // Tilda Swinton has one 2000s film: no actress podium at all this decade.
    expect(category(wrapper, 'actress').exists()).toBe(false)
    expect(category(wrapper, 'actor').exists()).toBe(false)
  })

  it('offline, actors and actresses share one Performer podium and nothing is looked up', async () => {
    const { wrapper } = mountDeepStats({ isOnline: false })
    await flushPromises()

    expect(lookupPerson).not.toHaveBeenCalled()
    expect(category(wrapper, 'actor').exists()).toBe(false)
    expect(category(wrapper, 'actress').exists()).toBe(false)
    expect(podiumNames(wrapper, 'performer')).toEqual(['Tom Hanks', 'Meg Ryan', 'Nobody Known'])
    expect(category(wrapper, 'performer').text()).toContain('offline')
  })

  it('tapping a person opens the shared PersonModal with their decade credits', async () => {
    const { wrapper } = mountDeepStats()
    await flushPromises()

    await category(wrapper, 'director').find('.champion-card').trigger('click')
    await flushPromises()

    const modal = wrapper.find('.person-modal')
    expect(modal.exists()).toBe(true)
    expect(modal.text()).toContain('Nora Ephron')
    expect(modal.text()).toContain('Director of the 1990s')
    expect(modal.text()).toContain('#1 of 1')
    expect(modal.findAll('.person-poster-card')).toHaveLength(3)
  })

  it('tapping a film goes to the movie', async () => {
    const { wrapper, pushSpy } = mountDeepStats()
    await flushPromises()

    await category(wrapper, 'film').find('.champion-card').trigger('click')
    expect(pushSpy).toHaveBeenCalledWith('/movie/1')
  })

  it('a genre card is not a button', async () => {
    const { wrapper, pushSpy } = mountDeepStats()
    await flushPromises()

    const genre = category(wrapper, 'genre').find('.champion-card')
    expect(genre.attributes('role')).toBeUndefined()
    await genre.trigger('click')
    expect(pushSpy).not.toHaveBeenCalled()
    expect(wrapper.find('.person-modal').exists()).toBe(false)
  })
})
