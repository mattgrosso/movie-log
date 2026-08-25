import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import FriendsWhoSaw from '@/components/FriendsWhoSaw.vue'

// "It would be cool if I could see which of my friends had seen a movie on its
// detail page" (2026-08-25).

const storeWith = (friends) => ({ getters: { filmClubFriends: friends } })

const mountSection = (friends, props = {}) => mount(FriendsWhoSaw, {
  props: { tmdbId: 42, ...props },
  global: { mocks: { $store: storeWith(friends) } }
})

const rated = (name, score) => ({
  key: name.toLowerCase(),
  name,
  profile: { name, ratings: { 42: { r: score } } }
})
const sharesButHasntSeen = (name) => ({
  key: name.toLowerCase(),
  name,
  profile: { name, ratings: { 99: { r: 5 } } }
})
const shelfOnly = (name) => ({ key: name.toLowerCase(), name, profile: { name, topShelf: [] } })

describe('FriendsWhoSaw', () => {
  it('lists the friends who have seen it, best score first', () => {
    const wrapper = mountSection([rated('Sarah', 8.5), rated('Ben', 9.2)])
    const names = wrapper.findAll('.friend-name').map((n) => n.text())
    expect(names).toEqual(['Ben', 'Sarah'])
  })

  it('shows their scores at the app-wide two decimals', () => {
    const wrapper = mountSection([rated('Ben', 9.2384)])
    expect(wrapper.find('.friend-score').text()).toBe('9.24')
  })

  it('renders nothing at all when there is no club', () => {
    expect(mountSection([]).find('.friends-who-saw').exists()).toBe(false)
  })

  it('says so plainly when the club exists but nobody has rated it', () => {
    const wrapper = mountSection([sharesButHasntSeen('Chris')])
    expect(wrapper.find('.none-seen').text()).toContain('Nobody in your club has rated this')
  })

  // The point of the whole three-way split. A shelf-only sharer must never be
  // described as not having seen a film -- the app would be inventing that
  // from a privacy setting.
  it('never says a non-sharing friend has missed the film', () => {
    const wrapper = mountSection([shelfOnly('Evan'), sharesButHasntSeen('Chris')])
    const notSeen = wrapper.findAll('.club-note').map((n) => n.text())
    expect(notSeen.find((line) => line.startsWith('Not seen by'))).toContain('Chris')
    expect(notSeen.find((line) => line.startsWith('Not seen by'))).not.toContain('Evan')
  })

  it('names the people it cannot speak for, rather than leaving them out', () => {
    // Silence would let the eye read everyone missing from "not seen by" as
    // having seen it.
    const wrapper = mountSection([shelfOnly('Evan')])
    const lines = wrapper.findAll('.club-note').map((n) => n.text())
    expect(lines.some((line) => line.includes('No ratings shared by') && line.includes('Evan'))).toBe(true)
  })

  it('compares the club average with your own score', () => {
    const wrapper = mountSection([rated('Ben', 9), rated('Sarah', 8)], { yourScore: 7.5 })
    expect(wrapper.find('.club-average').text()).toBe('Club average 8.50 · you 7.50')
  })

  it('leaves your half out when you have not rated it', () => {
    const wrapper = mountSection([rated('Ben', 9), rated('Sarah', 8)])
    expect(wrapper.find('.club-average').text()).toBe('Club average 8.50')
  })

  it('does not average a single person against themselves', () => {
    const wrapper = mountSection([rated('Ben', 9)], { yourScore: 7.5 })
    expect(wrapper.find('.club-average').exists()).toBe(false)
  })

  it('shows where they watched it when that is shared', () => {
    const withMedium = {
      key: 'sarah',
      name: 'Sarah',
      profile: { name: 'Sarah', ratings: { 42: { r: 8, v: [{ at: 5, m: 'Theatre' }] } } }
    }
    expect(mountSection([withMedium]).find('.friend-medium').text()).toBe('Theatre')
  })

  it('renders nothing at all until a movie id arrives', () => {
    // MovieDetail loads asynchronously and `movie` is null on first render.
    // Without a guard every friend is unanswerable at that moment, so the
    // section would flash "No ratings shared by" the whole club and then
    // settle -- asserting something about people purely because the page
    // hadn't loaded yet.
    expect(mountSection([rated('Ben', 9)], { tmdbId: null }).find('.friends-who-saw').exists()).toBe(false)
    expect(mountSection([rated('Ben', 9)], { tmdbId: '' }).find('.friends-who-saw').exists()).toBe(false)
    // and it appears the moment the id does
    expect(mountSection([rated('Ben', 9)], { tmdbId: 42 }).find('.friends-who-saw').exists()).toBe(true)
  })
})
