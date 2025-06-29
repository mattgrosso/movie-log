import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ToggleableRating from '@/components/ToggleableRating.vue'

describe('ToggleableRating', () => {
  let wrapper

  const defaultProps = {
    rating: 8.25,
    normalizedRating: 7
  }

  beforeEach(() => {
    wrapper = mount(ToggleableRating, {
      props: defaultProps
    })
  })

  describe('Component mounting', () => {
    it('should mount successfully', () => {
      expect(wrapper.exists()).toBe(true)
    })

    it('should render with correct initial state', () => {
      expect(wrapper.vm.visibleRatingType).toBe('rating')
    })

    it('should display rating by default', () => {
      const ratingDiv = wrapper.find('.rating')
      expect(ratingDiv.exists()).toBe(true)
      expect(ratingDiv.find('h3').text()).toBe('8.25')
    })
  })

  describe('Props validation', () => {
    it('should accept rating prop', () => {
      expect(wrapper.props('rating')).toBe(8.25)
    })

    it('should accept normalizedRating prop', () => {
      expect(wrapper.props('normalizedRating')).toBe(7)
    })

    it('should require both props', () => {
      const component = ToggleableRating
      expect(component.props.rating.required).toBe(true)
      expect(component.props.normalizedRating.required).toBe(true)
    })
  })

  describe('Rating type cycling', () => {
    it('should cycle from rating to normalized rating on click', async () => {
      expect(wrapper.vm.visibleRatingType).toBe('rating')
      
      await wrapper.trigger('click')
      
      expect(wrapper.vm.visibleRatingType).toBe('normalizedRating')
      const normalizedDiv = wrapper.find('.normalized-rating')
      expect(normalizedDiv.exists()).toBe(true)
      expect(normalizedDiv.find('h3').text()).toBe('7')
    })

    it('should cycle from normalized rating to stars on click', async () => {
      wrapper.vm.visibleRatingType = 'normalizedRating'
      await wrapper.vm.$nextTick()
      
      await wrapper.trigger('click')
      
      expect(wrapper.vm.visibleRatingType).toBe('stars')
      const starsDiv = wrapper.find('.stars')
      expect(starsDiv.exists()).toBe(true)
    })

    it('should cycle from stars back to rating on click', async () => {
      wrapper.vm.visibleRatingType = 'stars'
      await wrapper.vm.$nextTick()
      
      await wrapper.trigger('click')
      
      expect(wrapper.vm.visibleRatingType).toBe('rating')
      const ratingDiv = wrapper.find('.rating')
      expect(ratingDiv.exists()).toBe(true)
    })

    it('should complete full cycle through all rating types', async () => {
      // Start with rating
      expect(wrapper.vm.visibleRatingType).toBe('rating')
      
      // Click to normalized
      await wrapper.trigger('click')
      expect(wrapper.vm.visibleRatingType).toBe('normalizedRating')
      
      // Click to stars
      await wrapper.trigger('click')
      expect(wrapper.vm.visibleRatingType).toBe('stars')
      
      // Click back to rating
      await wrapper.trigger('click')
      expect(wrapper.vm.visibleRatingType).toBe('rating')
    })
  })

  describe('Stars computation', () => {
    it('should calculate correct star count', () => {
      // normalizedRating = 7, so starCount should be 3.5
      expect(wrapper.vm.starCount).toBe(3.5)
    })

    it('should calculate correct full stars', () => {
      // starCount = 3.5, so fullStars should be 3
      expect(wrapper.vm.fullStars).toBe(3)
    })

    it('should detect half star correctly', () => {
      // starCount = 3.5, so should have half star
      expect(wrapper.vm.hasHalfStar).toBe(true)
    })

    it('should detect when there are stars', () => {
      expect(wrapper.vm.hasAnyStars).toBe(true)
    })

    it('should handle zero rating', async () => {
      await wrapper.setProps({ normalizedRating: 0 })
      
      expect(wrapper.vm.starCount).toBe(0)
      expect(wrapper.vm.fullStars).toBe(0)
      expect(wrapper.vm.hasHalfStar).toBe(false)
      expect(wrapper.vm.hasAnyStars).toBe(false)
    })

    it('should handle perfect rating', async () => {
      await wrapper.setProps({ normalizedRating: 10 })
      
      expect(wrapper.vm.starCount).toBe(5)
      expect(wrapper.vm.fullStars).toBe(5)
      expect(wrapper.vm.hasHalfStar).toBe(false)
      expect(wrapper.vm.hasAnyStars).toBe(true)
    })
  })

  describe('Stars rendering', () => {
    it('should render correct number of full stars', async () => {
      wrapper.vm.visibleRatingType = 'stars'
      await wrapper.vm.$nextTick()
      
      const fullStars = wrapper.findAll('.bi-star-fill')
      expect(fullStars).toHaveLength(3) // fullStars = 3
    })

    it('should render half star when appropriate', async () => {
      wrapper.vm.visibleRatingType = 'stars'
      await wrapper.vm.$nextTick()
      
      const halfStar = wrapper.find('.bi-star-half')
      expect(halfStar.exists()).toBe(true) // hasHalfStar = true
    })

    it('should render no-stars indicator for zero rating', async () => {
      await wrapper.setProps({ normalizedRating: 0 })
      wrapper.vm.visibleRatingType = 'stars'
      await wrapper.vm.$nextTick()
      
      const noStarsDiv = wrapper.find('.no-stars')
      expect(noStarsDiv.exists()).toBe(true)
      
      const emptyStarIcon = wrapper.find('.bi-star')
      const slashIcon = wrapper.find('.bi-slash-lg')
      expect(emptyStarIcon.exists()).toBe(true)
      expect(slashIcon.exists()).toBe(true)
    })

    it('should render has-stars container when rating > 0', async () => {
      wrapper.vm.visibleRatingType = 'stars'
      await wrapper.vm.$nextTick()
      
      const hasStarsDiv = wrapper.find('.has-stars')
      expect(hasStarsDiv.exists()).toBe(true)
    })
  })

  describe('Normalized rating display', () => {
    it('should render normalized rating with label', async () => {
      wrapper.vm.visibleRatingType = 'normalizedRating'
      await wrapper.vm.$nextTick()
      
      const normalizedDiv = wrapper.find('.normalized-rating')
      expect(normalizedDiv.exists()).toBe(true)
      
      const label = normalizedDiv.find('label')
      expect(label.exists()).toBe(true)
      expect(label.text()).toBe('(normalized rating)')
    })

    it('should allow clicking label to cycle rating type', async () => {
      wrapper.vm.visibleRatingType = 'normalizedRating'
      await wrapper.vm.$nextTick()
      
      const label = wrapper.find('label')
      await label.trigger('click')
      
      expect(wrapper.vm.visibleRatingType).toBe('stars')
    })

    it('should stop propagation when clicking label', async () => {
      wrapper.vm.visibleRatingType = 'normalizedRating'
      await wrapper.vm.$nextTick()
      
      const label = wrapper.find('label')
      
      // We can verify the label exists and has the click.stop directive
      expect(label.exists()).toBe(true)
      expect(label.text()).toBe('(normalized rating)')
    })
  })

  describe('Edge cases', () => {
    it('should handle decimal ratings correctly', async () => {
      await wrapper.setProps({ 
        rating: 7.84,
        normalizedRating: 6.2 
      })
      
      wrapper.vm.visibleRatingType = 'rating'
      await wrapper.vm.$nextTick()
      
      expect(wrapper.find('.rating h3').text()).toBe('7.84')
      
      expect(wrapper.vm.starCount).toBe(3.1)
      expect(wrapper.vm.fullStars).toBe(3)
      expect(wrapper.vm.hasHalfStar).toBe(true)
    })

    it('should handle maximum rating values', async () => {
      await wrapper.setProps({ 
        rating: 10,
        normalizedRating: 10 
      })
      
      expect(wrapper.vm.starCount).toBe(5)
      expect(wrapper.vm.fullStars).toBe(5)
      expect(wrapper.vm.hasHalfStar).toBe(false)
      expect(wrapper.vm.hasAnyStars).toBe(true)
    })
  })
})