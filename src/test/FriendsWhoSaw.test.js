import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import FriendsWhoSaw from '@/components/FriendsWhoSaw.vue'

// "I just need little pills that show the name and rating for any friends who
// have seen and rated the movie" (2026-08-25).

const rated = (name, score) => ({
  key: name.toLowerCase(),
  name,
  profile: { name, ratings: { 42: { r: score } } }
})

const mountPills = (friends, props = {}) => mount(FriendsWhoSaw, {
  props: { tmdbId: 42, ...props },
  global: { mocks: { $store: { getters: { filmClubFriends: friends } } } }
})

describe('FriendsWhoSaw', () => {
  it('shows one pill per friend who rated it, name and score', () => {
    const wrapper = mountPills([rated('Ben', 9.2)])
    expect(wrapper.findAll('.friend-pill')).toHaveLength(1)
    expect(wrapper.find('.friend-name').text()).toBe('Ben')
    expect(wrapper.find('.friend-score').text()).toBe('9.20')
  })

  it('shows the score at the app-wide two decimals, trailing zeros and all', () => {
    expect(mountPills([rated('Ben', 9.2384)]).find('.friend-score').text()).toBe('9.24')
    expect(mountPills([rated('Ben', 9)]).find('.friend-score').text()).toBe('9.00')
  })

  it('orders the pills by score, highest first', () => {
    const wrapper = mountPills([rated('Sarah', 8.5), rated('Ben', 9.2)])
    expect(wrapper.findAll('.friend-name').map((n) => n.text())).toEqual(['Ben', 'Sarah'])
  })

  it('renders nothing at all when nobody in the club has rated it', () => {
    const chris = { key: 'chris', name: 'Chris', profile: { ratings: { 99: { r: 5 } } } }
    expect(mountPills([chris]).find('.friends-who-saw').exists()).toBe(false)
    expect(mountPills([]).find('.friends-who-saw').exists()).toBe(false)
  })

  it('says nothing about the friends it leaves out', () => {
    // No "hasn't seen it" line, no counts -- the pills are the whole feature.
    const chris = { key: 'chris', name: 'Chris', profile: { ratings: { 99: { r: 5 } } } }
    expect(mountPills([rated('Ben', 9), chris]).text()).not.toContain('Chris')
  })

  it('renders nothing until a movie id arrives', () => {
    expect(mountPills([rated('Ben', 9)], { tmdbId: null }).find('.friends-who-saw').exists()).toBe(false)
  })
})
