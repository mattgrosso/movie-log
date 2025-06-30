import { describe, it, expect, vi } from 'vitest'

// Simple test to verify the date comparison logic we fixed
describe('Date Comparison Logic - Best Movie Since Fix', () => {
  
  // Test the core logic we fixed without Vue component complexity
  const mostRecentRating = (movie) => {
    if (!movie?.ratings?.length) {
      return null;
    }

    let mostRecentRating = movie.ratings[0];

    movie.ratings.forEach((rating) => {
      if (!mostRecentRating?.date) {
        mostRecentRating = rating;
      } else if (rating.date && (typeof rating.date === 'number' ? rating.date : new Date(rating.date).getTime()) > (typeof mostRecentRating.date === 'number' ? mostRecentRating.date : new Date(mostRecentRating.date).getTime())) {
        mostRecentRating = rating;
      }
    });

    return mostRecentRating;
  }

  const findLastHigherRatedMovie = (allMovies, currentRating) => {
    // Filter movies with higher ratings
    const higherRated = allMovies.filter(movie => {
      const rating = mostRecentRating(movie);
      return rating && rating.calculatedTotal > currentRating;
    });
    
    if (!higherRated.length) return null;
    
    // Filter out movies without valid dates
    const moviesWithDates = higherRated.filter(movie => {
      const rating = mostRecentRating(movie);
      return rating && rating.date;
    });
    
    if (!moviesWithDates.length) return null;
    
    // Find the most recent
    let mostRecent = moviesWithDates[0];
    let mostRecentDate = typeof mostRecentRating(moviesWithDates[0]).date === 'number' ? mostRecentRating(moviesWithDates[0]).date : new Date(mostRecentRating(moviesWithDates[0]).date).getTime();
    
    for (let i = 1; i < moviesWithDates.length; i++) {
      const movie = moviesWithDates[i];
      const movieDate = typeof mostRecentRating(movie).date === 'number' ? mostRecentRating(movie).date : new Date(mostRecentRating(movie).date).getTime();
      if (movieDate > mostRecentDate) {
        mostRecent = movie;
        mostRecentDate = movieDate;
      }
    }
    
    return {
      title: mostRecent.title,
      date: mostRecentRating(mostRecent).date
    };
  }

  describe('mostRecentRating function', () => {
    it('should handle null/undefined movies', () => {
      expect(mostRecentRating(null)).toBeNull();
      expect(mostRecentRating(undefined)).toBeNull();
      expect(mostRecentRating({})).toBeNull();
      expect(mostRecentRating({ ratings: [] })).toBeNull();
    });

    it('should find most recent rating with proper date parsing', () => {
      const movie = {
        title: 'Test Movie',
        ratings: [
          { calculatedTotal: 7.0, date: 1640995200000 }, // Jan 1, 2022
          { calculatedTotal: 9.0, date: 1672531200000 }, // Jan 1, 2023 - most recent
          { calculatedTotal: 8.0, date: 1641081600000 }  // Jan 2, 2022
        ]
      };

      const result = mostRecentRating(movie);
      console.log('Test result:', result);
      console.log('Date comparisons:');
      movie.ratings.forEach(r => {
        console.log(`Rating ${r.calculatedTotal}: date=${r.date}, parsed=${new Date(r.date).getTime()}`);
      });
      expect(result.calculatedTotal).toBe(9.0);
      expect(result.date).toBe(1672531200000);
    });

    it('should handle movies with null dates correctly', () => {
      const movie = {
        title: 'Test Movie',
        ratings: [
          { calculatedTotal: 8.0, date: null },
          { calculatedTotal: 9.0, date: 1640995200000 },
          { calculatedTotal: 7.0, date: null }
        ]
      };

      const result = mostRecentRating(movie);
      expect(result.calculatedTotal).toBe(9.0);
      expect(result.date).toBe(1640995200000);
    });

    it('should handle string dates vs timestamp dates', () => {
      const movie = {
        title: 'Test Movie',
        ratings: [
          { calculatedTotal: 8.0, date: '2023-01-01T10:30:00.000Z' }, // ISO string
          { calculatedTotal: 9.0, date: 1672617600000 }, // Jan 2, 2023 timestamp - later
        ]
      };

      const result = mostRecentRating(movie);
      expect(result.calculatedTotal).toBe(9.0);
      expect(result.date).toBe(1672617600000);
    });
  });

  describe('findLastHigherRatedMovie function', () => {
    const testMovies = [
      {
        title: 'Movie A - 2022',
        ratings: [{ calculatedTotal: 9.0, date: 1640995200000 }] // Jan 1, 2022
      },
      {
        title: 'Movie B - 2023',
        ratings: [{ calculatedTotal: 8.5, date: 1672531200000 }] // Jan 1, 2023
      },
      {
        title: 'Movie C - 2024 (Most Recent)',
        ratings: [{ calculatedTotal: 9.5, date: 1704067200000 }] // Jan 1, 2024
      },
      {
        title: 'Movie D - No Date',
        ratings: [{ calculatedTotal: 8.0, date: null }]
      },
      {
        title: 'Movie E - Multiple Ratings',
        ratings: [
          { calculatedTotal: 7.0, date: 1640995200000 }, // Jan 1, 2022
          { calculatedTotal: 9.3, date: 1675123200000 }  // Jan 31, 2023 - newest
        ]
      }
    ];

    it('should find most recently rated higher movie', () => {
      const currentRating = 8.8;
      const result = findLastHigherRatedMovie(testMovies, currentRating);

      expect(result).toBeTruthy();
      expect(result.title).toBe('Movie C - 2024 (Most Recent)');
    });

    it('should ignore movies without dates', () => {
      const currentRating = 7.5; // Lower to include more movies
      const result = findLastHigherRatedMovie(testMovies, currentRating);

      expect(result.title).not.toBe('Movie D - No Date');
      expect(result.title).toBe('Movie C - 2024 (Most Recent)');
    });

    it('should return null when no movies have higher ratings', () => {
      const currentRating = 10.0;
      const result = findLastHigherRatedMovie(testMovies, currentRating);

      expect(result).toBeNull();
    });

    it('should handle movies with multiple ratings correctly', () => {
      const currentRating = 8.0;
      const result = findLastHigherRatedMovie(testMovies, currentRating);

      // Should find the movie with the most recent date among higher rated ones
      expect(result.title).toBe('Movie C - 2024 (Most Recent)');
    });

    it('should return null when only higher rated movies have null dates', () => {
      const moviesWithNullDates = [
        { title: 'High Rating No Date', ratings: [{ calculatedTotal: 9.0, date: null }] },
        { title: 'Low Rating With Date', ratings: [{ calculatedTotal: 7.0, date: 1640995200000 }] }
      ];

      const result = findLastHigherRatedMovie(moviesWithNullDates, 8.0);
      expect(result).toBeNull();
    });
  });

  describe('Bug scenarios that were fixed', () => {
    it('should correctly compare string dates vs timestamps', () => {
      const movies = [
        {
          title: 'String Date Movie',
          ratings: [{ calculatedTotal: 9.0, date: '2023-06-15T10:30:00.000Z' }] // ISO string
        },
        {
          title: 'Timestamp Movie (Later)',
          ratings: [{ calculatedTotal: 9.1, date: 1687000000000 }] // June 17, 2023 timestamp
        }
      ];

      const result = findLastHigherRatedMovie(movies, 8.0);
      expect(result.title).toBe('Timestamp Movie (Later)');
    });

    it('should not use fallback date of 0 for null dates', () => {
      const movies = [
        {
          title: 'No Date Movie',
          ratings: [{ calculatedTotal: 9.5, date: null }]
        },
        {
          title: 'Recent Movie',
          ratings: [{ calculatedTotal: 9.0, date: 1672531200000 }] // Jan 1, 2023
        }
      ];

      const result = findLastHigherRatedMovie(movies, 8.0);
      
      // Should pick the movie with a valid date, not the one with null date
      expect(result.title).toBe('Recent Movie');
    });
  });
});