import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import PersonModal from '@/components/PersonModal.vue'

// Bug report 2026-08-25: "When I click on one of my favorite people in the
// people section of deep data, it opens up this modal that I made a long time
// ago. That really doesn't look nice. We should take a swing at that. Make it
// look a lot nicer and do a better job of de-duping the list of credits and
// making sure they [line up] and just generally rework this whole modal."
// Plus, from the design pass: "even better if you can get bio info from
// somewhere."

vi.mock('@/assets/javascript/GetRating.js', () => ({
  getRating: vi.fn((entry) => ({ calculatedTotal: entry?.score ?? NaN }))
}))

vi.mock('@/services/ErrorLogService.js', () => ({
  default: { error: vi.fn() }
}))

const film = (id, title, score) => ({
  dbKey: `key-${id}`,
  score,
  movie: { id, title, poster_path: `/p${id}.jpg` }
})

// Alphabetical on purpose — the old modal rendered them in this order, which
// buries the reason the person is on the list at all.
const FILMS = [
  film(3, 'Alpha', 6.11),
  film(1, 'Zulu', 9.12),
  film(2, 'Mike', 8.4)
]

let personCounter = 0
const mountModal = (overrides = {}) => mount(PersonModal, {
  props: {
    // A fresh name each time: the biography cache is module-level on purpose
    // (one person appears in more than one list) and would leak between tests.
    person: {
      name: `Person ${personCounter++}`,
      entries: FILMS,
      details: { id: 500, profile_path: '/face.jpg' }
    },
    roleLabel: 'Composer',
    rank: 3,
    libraryAverage: 7,
    ...overrides
  }
})

const tmdbPerson = (extra = {}) => ({
  ok: true,
  json: async () => ({
    biography: 'A composer of some renown.',
    birthday: '1967-10-10',
    place_of_birth: 'Riverside, New Jersey, USA',
    ...extra
  })
})

beforeEach(() => {
  global.fetch = vi.fn(() => Promise.resolve(tmdbPerson()))
})

afterEach(() => {
  document.body.classList.remove('no-scroll')
})

describe('PersonModal — the films', () => {
  it('lists them best first, not alphabetically', async () => {
    const wrapper = mountModal()
    await flushPromises()
    expect(wrapper.findAll('.person-film-title').map((n) => n.text()))
      .toEqual(['Zulu', 'Mike', 'Alpha'])
  })

  it('shows every score at the same precision, so the column lines up', async () => {
    const wrapper = mountModal()
    await flushPromises()
    expect(wrapper.findAll('.person-film-score').map((n) => n.text()))
      .toEqual(['9.12', '8.40', '6.11'])
  })

  it('hands the whole entry back when a film is tapped', async () => {
    const wrapper = mountModal()
    await flushPromises()
    await wrapper.findAll('.person-poster-card')[0].trigger('click')
    expect(wrapper.emitted('select-film')[0][0].movie.title).toBe('Zulu')
  })

  it('falls back to the title when a film has no poster', async () => {
    const wrapper = mountModal({
      person: { name: 'No Poster Person', entries: [{ dbKey: 'k', score: 8, movie: { id: 9, title: 'Unposted' } }], details: null }
    })
    await flushPromises()
    expect(wrapper.find('.person-poster-fallback').text()).toBe('Unposted')
  })
})

describe('PersonModal — the numbers', () => {
  it('counts the films and averages your own ratings', async () => {
    const wrapper = mountModal()
    await flushPromises()
    const stats = wrapper.findAll('.person-stat-value').map((n) => n.text())
    expect(stats[0]).toBe('3')
    expect(stats[1]).toBe('7.88') // (9.12 + 8.40 + 6.11) / 3
  })

  // "0.88 above" and "0.88 below" are opposite facts about a person, so the
  // sign has to survive.
  it('signs the comparison against your library average', async () => {
    const wrapper = mountModal()
    await flushPromises()
    expect(wrapper.findAll('.person-stat-value')[2].text()).toBe('+0.88')

    const below = mountModal({ libraryAverage: 9 })
    await flushPromises()
    expect(below.findAll('.person-stat-value')[2].text()).toBe('−1.12')
  })

  it('leaves the comparison out when there is nothing to compare against', async () => {
    const wrapper = mountModal({ libraryAverage: null })
    await flushPromises()
    expect(wrapper.findAll('.person-stat')).toHaveLength(2)
  })

  it('shows the role and rank', async () => {
    const wrapper = mountModal()
    await flushPromises()
    expect(wrapper.find('.person-role').text()).toBe('Composer · #3')
  })
})

describe('PersonModal — the biography', () => {
  it('fetches the full person record, which the search endpoint does not carry', async () => {
    const wrapper = mountModal()
    await flushPromises()
    expect(global.fetch).toHaveBeenCalledTimes(1)
    expect(global.fetch.mock.calls[0][0]).toContain('/person/500')
    expect(wrapper.find('.person-bio').text()).toContain('A composer of some renown')
  })

  it('gives the years and the birthplace as one quiet line', async () => {
    const wrapper = mountModal()
    await flushPromises()
    expect(wrapper.find('.person-life').text()).toBe('b. 1967 · Riverside, New Jersey, USA')
  })

  it('shows a lifespan when they have died', async () => {
    global.fetch = vi.fn(() => Promise.resolve(tmdbPerson({ deathday: '2020-03-02' })))
    const wrapper = mountModal()
    await flushPromises()
    expect(wrapper.find('.person-life').text()).toContain('1967–2020')
  })

  // The films are the reason the modal exists; a biography is a nicety and
  // must never take them down with it.
  it('stays silent and still shows the films when the lookup fails', async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error('rate limited')))
    const wrapper = mountModal()
    await flushPromises()
    expect(wrapper.find('.person-bio').exists()).toBe(false)
    expect(wrapper.findAll('.person-poster-card')).toHaveLength(3)
  })

  it('does not look anyone up twice', async () => {
    const person = {
      name: 'Repeatedly Opened',
      entries: FILMS,
      details: { id: 777, profile_path: '/f.jpg' }
    }
    const first = mountModal({ person })
    await flushPromises()
    first.unmount()

    mountModal({ person })
    await flushPromises()
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('does not retry a lookup that already failed', async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error('nope')))
    const person = { name: 'Never Found', entries: FILMS, details: { id: 888 } }
    const first = mountModal({ person })
    await flushPromises()
    first.unmount()

    mountModal({ person })
    await flushPromises()
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('asks for nobody when there is no TMDB id to ask about', async () => {
    mountModal({ person: { name: 'Unknown To TMDB', entries: FILMS, details: null } })
    await flushPromises()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('only offers a More button when the biography is actually long', async () => {
    const short = mountModal()
    await flushPromises()
    expect(short.find('.bio-toggle').exists()).toBe(false)

    global.fetch = vi.fn(() => Promise.resolve(tmdbPerson({ biography: 'x'.repeat(400) })))
    const long = mountModal()
    await flushPromises()
    expect(long.find('.bio-toggle').text()).toBe('More')
    await long.find('.bio-toggle').trigger('click')
    expect(long.find('.bio-toggle').text()).toBe('Less')
    expect(long.find('.person-bio p').classes()).not.toContain('clamped')
  })
})

describe('PersonModal — the frame', () => {
  it('locks the page behind it and lets go on the way out', async () => {
    const wrapper = mountModal()
    await flushPromises()
    expect(document.body.classList.contains('no-scroll')).toBe(true)
    wrapper.unmount()
    expect(document.body.classList.contains('no-scroll')).toBe(false)
  })

  it('closes from the button and from the backdrop', async () => {
    const wrapper = mountModal()
    await flushPromises()
    await wrapper.find('.close-btn').trigger('click')
    await wrapper.find('.person-modal-overlay').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(2)
  })
})
