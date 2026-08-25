import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import FriendsWhoSaw from '@/components/FriendsWhoSaw.vue'

// "I just need little pills that show the name and rating for any friends who
// have seen and rated the movie" (2026-08-25), then: "let's use the normalized
// ratings... It would be best if we could show star ratings for these."

const rated = (name, score, stars) => ({
  key: name.toLowerCase(),
  name,
  profile: { name, ratings: { 42: { r: score, ...(stars === undefined ? {} : { s: stars }) } } }
})

const mountPills = (friends, props = {}) => mount(FriendsWhoSaw, {
  props: { tmdbId: 42, ...props },
  global: { mocks: { $store: { getters: { filmClubFriends: friends } } } }
})

describe('FriendsWhoSaw', () => {
  it('shows one pill per friend who rated it, with their stars', () => {
    const wrapper = mountPills([rated('Ben', 9.2, 4.5)])
    expect(wrapper.findAll('.friend-pill')).toHaveLength(1)
    expect(wrapper.find('.friend-name').text()).toBe('Ben')
    expect(wrapper.findAll('.bi-star-fill')).toHaveLength(4)
    expect(wrapper.find('.bi-star-half').exists()).toBe(true)
  })

  it('draws whole stars with no half', () => {
    const wrapper = mountPills([rated('Ben', 9.2, 4)])
    expect(wrapper.findAll('.bi-star-fill')).toHaveLength(4)
    expect(wrapper.find('.bi-star-half').exists()).toBe(false)
  })

  it('shows the stars rather than the raw composite', () => {
    // The composite is on each person's own scale; two friends' 8.7s are not
    // the same opinion. Stars present the normalized value, which is.
    const wrapper = mountPills([rated('Ben', 9.2384, 4.5)])
    expect(wrapper.text()).not.toContain('9.24')
    expect(wrapper.find('.friend-score').exists()).toBe(false)
  })

  it('falls back to the score for a profile published before stars existed', () => {
    // Profiles only gain stars when their owner's app next republishes, and a
    // raw Movie Log feed carries none at all. A blank pill would be worse.
    const wrapper = mountPills([rated('Ben', 9.2384, undefined)])
    expect(wrapper.find('.friend-score').text()).toBe('9.24')
    expect(wrapper.find('.friend-stars').exists()).toBe(false)
  })

  it('orders the pills by score, highest first', () => {
    const wrapper = mountPills([rated('Sarah', 8.5, 4), rated('Ben', 9.2, 4.5)])
    expect(wrapper.findAll('.friend-name').map((n) => n.text())).toEqual(['Ben', 'Sarah'])
  })

  it('renders nothing at all when nobody in the club has rated it', () => {
    const chris = { key: 'chris', name: 'Chris', profile: { ratings: { 99: { r: 5 } } } }
    expect(mountPills([chris]).find('.friends-who-saw').exists()).toBe(false)
    expect(mountPills([]).find('.friends-who-saw').exists()).toBe(false)
  })

  it('says nothing about the friends it leaves out', () => {
    const chris = { key: 'chris', name: 'Chris', profile: { ratings: { 99: { r: 5 } } } }
    expect(mountPills([rated('Ben', 9, 4), chris]).text()).not.toContain('Chris')
  })

  it('renders nothing until a movie id arrives', () => {
    expect(mountPills([rated('Ben', 9, 4)], { tmdbId: null }).find('.friends-who-saw').exists()).toBe(false)
  })
})
