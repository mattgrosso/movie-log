import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import MediaResultGrid from '@/components/MediaResultGrid.vue'
import PickMedia from '@/components/PickMedia.vue'

describe('MediaResultGrid', () => {
  const movies = [
    { id: 1, title: 'Fight Club', release_date: '1999-10-15', poster_path: '/fc.jpg' },
    { id: 2, title: 'A Movie With No Poster At All', release_date: '2020-01-01', poster_path: null }
  ]

  it('renders one card per item, with a title/date and the TMDb poster when available', () => {
    const wrapper = mount(MediaResultGrid, { props: { mediaList: movies } })
    const cards = wrapper.findAll('li.card')

    expect(cards).toHaveLength(2)
    expect(cards[0].find('img').attributes('src')).toContain('/fc.jpg')
    expect(cards[0].text()).toContain('1999-10-15')
  })

  it('falls back to the not-found image when a result has no poster_path', () => {
    const wrapper = mount(MediaResultGrid, { props: { mediaList: movies } })
    const secondCardImg = wrapper.findAll('li.card')[1].find('img')

    expect(secondCardImg.attributes('src')).not.toContain('image.tmdb.org')
    expect(secondCardImg.classes()).toContain('not-found')
  })

  it('emits "select" with the clicked media object', async () => {
    const wrapper = mount(MediaResultGrid, { props: { mediaList: movies } })

    await wrapper.findAll('li.card')[0].trigger('click')

    expect(wrapper.emitted('select')).toBeTruthy()
    expect(wrapper.emitted('select')[0]).toEqual([movies[0]])
  })

  it('reads name/first_air_date instead of title/release_date when isTVShow is set', () => {
    const shows = [{ id: 9, name: 'Some Show', first_air_date: '2015-05-05', poster_path: null }]
    const wrapper = mount(MediaResultGrid, { props: { mediaList: shows, isTVShow: true } })

    expect(wrapper.text()).toContain('Some Show')
    expect(wrapper.text()).toContain('2015-05-05')
  })

  it('truncates long titles', () => {
    const wrapper = mount(MediaResultGrid, {
      props: { mediaList: [{ id: 1, title: 'A Title That Is Definitely Too Long To Fit', release_date: '2020', poster_path: null }] }
    })

    expect(wrapper.find('.card-text').attributes('title')).toBe('A Title That Is Definitely Too Long To Fit')
    expect(wrapper.find('.card-text').text()).toContain('...')
  })
})

describe('PickMedia - still behaves the same after delegating its markup to MediaResultGrid', () => {
  function factory (overrides = {}) {
    return mount(PickMedia, {
      global: {
        mocks: {
          $store: {
            state: { currentLog: 'movieLog', newEntrySearchResults: [{ id: 5, title: 'Some Movie', release_date: '2010-01-01', poster_path: null }] },
            commit: vi.fn()
          },
          $router: { push: vi.fn() },
          ...overrides.mocks
        }
      }
    })
  }

  it('renders results from the store when no mediaList prop is given', () => {
    const wrapper = factory()
    expect(wrapper.text()).toContain('Some Movie')
  })

  it('commits setMovieToRate and navigates to /rate-movie on click', async () => {
    const wrapper = factory()
    await wrapper.find('li.card').trigger('click')

    expect(wrapper.vm.$store.commit).toHaveBeenCalledWith('setMovieToRate', expect.objectContaining({ id: 5 }))
    expect(wrapper.vm.$router.push).toHaveBeenCalledWith('/rate-movie')
  })
})
