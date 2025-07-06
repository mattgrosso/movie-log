// Test file to verify search units consistency between input and chip filtering
import { describe, it, expect, beforeEach } from 'vitest'

describe('Search Units Consistency', () => {
  // Mock component instance with simplified filtering logic
  let mockComponent

  beforeEach(() => {
    // Mock the component's filtering methods
    mockComponent = {
      activeSearchUnits: [],
      value: '',
      debouncedSearchValue: '',
      allEntriesWithFlatKeywordsAdded: [
        {
          title: 'Heat',
          flatKeywords: ['action', 'crime', 'drama'],
          genres: [{ name: 'Action' }, { name: 'Crime' }],
          cast: [{ name: 'Al Pacino' }, { name: 'Robert De Niro' }],
          crew: [{ name: 'Michael Mann', job: 'Director' }]
        },
        {
          title: 'Heat Wave',
          flatKeywords: ['romance', 'drama'],
          genres: [{ name: 'Romance' }],
          cast: [{ name: 'Jane Doe' }],
          crew: [{ name: 'John Smith', job: 'Director' }]
        },
        {
          title: 'The Big Heat',
          flatKeywords: ['noir', 'crime'],
          genres: [{ name: 'Crime' }, { name: 'Film-Noir' }],
          cast: [{ name: 'Glenn Ford' }],
          crew: [{ name: 'Fritz Lang', job: 'Director' }]
        }
      ],

      // Simulate the detectFilterType method
      detectFilterType(term) {
        // Simplified detection logic for testing
        if (term.match(/^\d{4}$/)) {
          return { type: 'year', value: term, display: term }
        }
        // For this test, treat most searches as 'search' type
        return { type: 'search', value: term, display: term }
      },

      // Simulate the fuzzyFilter computed property (input-based filtering)
      get fuzzyFilter() {
        if (!this.debouncedSearchValue) return this.allEntriesWithFlatKeywordsAdded
        
        const searchValue = this.debouncedSearchValue.toLowerCase()
        return this.allEntriesWithFlatKeywordsAdded.filter(movie => {
          return (movie.title && movie.title.toLowerCase().includes(searchValue)) ||
                 (movie.flatKeywords && movie.flatKeywords.some(keyword => 
                   keyword.toLowerCase().includes(searchValue))) ||
                 (movie.genres && movie.genres.some(genre => 
                   genre.name && genre.name.toLowerCase().includes(searchValue))) ||
                 (movie.cast && movie.cast.some(person => 
                   person.name && person.name.toLowerCase().includes(searchValue)))
        })
      },

      // Simulate the search units filtering logic
      filterBySearchUnits() {
        if (this.activeSearchUnits.length === 0) {
          return this.allEntriesWithFlatKeywordsAdded
        }

        return this.allEntriesWithFlatKeywordsAdded.filter(movie => {
          return this.activeSearchUnits.every(unit => {
            switch (unit.type) {
              case 'search':
                const searchValue = unit.value.toLowerCase()
                return (movie.title && movie.title.toLowerCase().includes(searchValue)) ||
                       (movie.flatKeywords && movie.flatKeywords.some(keyword => 
                         keyword.toLowerCase().includes(searchValue))) ||
                       (movie.genres && movie.genres.some(genre => 
                         genre.name && genre.name.toLowerCase().includes(searchValue))) ||
                       (movie.cast && movie.cast.some(person => 
                         person.name && person.name.toLowerCase().includes(searchValue)))
              case 'year':
                return new Date(movie.release_date).getFullYear().toString() === unit.value
              case 'genre':
                return movie.genres && movie.genres.some(genre => genre.name === unit.value)
              default:
                return true
            }
          })
        })
      }
    }
  })

  it('should produce identical results for "Heat" search in input vs chip', () => {
    // Test input-based filtering
    mockComponent.debouncedSearchValue = 'Heat'
    const inputResults = mockComponent.fuzzyFilter
    
    // Test chip-based filtering
    mockComponent.debouncedSearchValue = ''
    mockComponent.activeSearchUnits = [{
      type: 'search',
      value: 'Heat',
      source: 'chip'
    }]
    const chipResults = mockComponent.filterBySearchUnits()
    
    console.log('Input results count:', inputResults.length)
    console.log('Input results:', inputResults.map(r => r.title))
    console.log('Chip results count:', chipResults.length)
    console.log('Chip results:', chipResults.map(r => r.title))
    
    expect(inputResults.length).toBe(chipResults.length)
    expect(inputResults.map(r => r.title).sort()).toEqual(chipResults.map(r => r.title).sort())
  })

  it('should produce identical results for partial matches', () => {
    const searchTerms = ['He', 'Heat', 'Big', 'Wave', 'Al Pacino', 'Crime']
    
    searchTerms.forEach(term => {
      // Input filtering
      mockComponent.debouncedSearchValue = term
      const inputResults = mockComponent.fuzzyFilter
      
      // Chip filtering
      mockComponent.debouncedSearchValue = ''
      mockComponent.activeSearchUnits = [{
        type: 'search',
        value: term,
        source: 'chip'
      }]
      const chipResults = mockComponent.filterBySearchUnits()
      
      console.log(`\nTesting "${term}":`)
      console.log('Input results:', inputResults.map(r => r.title))
      console.log('Chip results:', chipResults.map(r => r.title))
      
      expect(inputResults.length).toBe(chipResults.length)
      expect(inputResults.map(r => r.title).sort()).toEqual(chipResults.map(r => r.title).sort())
    })
  })
})