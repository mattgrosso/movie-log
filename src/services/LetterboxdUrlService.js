class LetterboxdUrlService {
  /**
   * Convert movie title to Letterboxd URL slug (without year)
   * Examples:
   * "Fight Club" → "fight-club"
   * "The Dark Knight" → "dark-knight"  
   * "Pulp Fiction" → "pulp-fiction"
   */
  static generateMovieSlug(title, year) {
    if (!title) return null;
    
    // Convert to lowercase and replace spaces with hyphens
    let slug = title.toLowerCase()
      // Keep articles like "The" - Letterboxd usually keeps them
      // .replace(/^(the|a|an)\s+/i, '') // Removed this line
      // Replace special characters and spaces with hyphens
      .replace(/[^a-z0-9\s]/g, '')
      // Replace multiple spaces with single space
      .replace(/\s+/g, ' ')
      // Trim and replace spaces with hyphens
      .trim()
      .replace(/\s/g, '-')
      // Remove multiple consecutive hyphens
      .replace(/-+/g, '-')
      // Remove leading/trailing hyphens
      .replace(/^-+|-+$/g, '');
    
    // Note: Letterboxd doesn't use years in URLs for most movies
    // Only add year for disambiguation when absolutely necessary
    
    return slug;
  }

  /**
   * Generate full Letterboxd URLs
   */
  static generateUrls(title, year) {
    const slug = this.generateMovieSlug(title, year);
    if (!slug || !title) return null;
    
    // URL encode the title for the app URL
    const encodedTitle = encodeURIComponent(title);
    
    return {
      slug: slug,
      webUrl: `https://letterboxd.com/film/${slug}/`,
      appUrl: `letterboxd://x-callback-url/search?query=${encodedTitle}&type=film`,
      appLogUrl: `letterboxd://x-callback-url/log?name=${encodedTitle}`,
      reviewsUrl: `https://letterboxd.com/film/${slug}/reviews/`
    };
  }

  /**
   * Generate user-specific URLs
   */
  static generateUserUrls(username, title, year) {
    const slug = this.generateMovieSlug(title, year);
    if (!slug || !username) return null;
    
    return {
      userProfile: `https://letterboxd.com/${username}/`,
      userFilms: `https://letterboxd.com/${username}/films/`,
      userReviews: `https://letterboxd.com/${username}/films/reviews/`,
      userFilmPage: `https://letterboxd.com/${username}/film/${slug}/`
    };
  }

  /**
   * Smart deep link to movie with app/web fallback
   * Opens search in app, with web fallback
   */
  static openMovie(title, year, options = {}) {
    const urls = this.generateUrls(title, year);
    if (!urls) {
      console.error('Could not generate Letterboxd URLs for:', title, year);
      return false;
    }

    console.log('Opening Letterboxd movie:', {
      title,
      year,
      slug: urls.slug,
      appUrl: urls.appUrl,
      webUrl: urls.webUrl
    });

    // Try to open the app first with x-callback-url search
    try {
      console.log('Attempting to open Letterboxd app with search...');
      window.location.href = urls.appUrl;
      
      // Fallback to web after delay if app doesn't open
      const fallbackDelay = options.fallbackDelay || 1500;
      setTimeout(() => {
        console.log('App did not open, falling back to web browser...');
        this.tryWebUrlWithFallback(title, urls.webUrl);
      }, fallbackDelay);
      
      return true;
    } catch (error) {
      console.error('Error opening Letterboxd app, opening web instead:', error);
      this.tryWebUrlWithFallback(title, urls.webUrl);
      return true;
    }
  }

  /**
   * Deep link to log/rate a movie in the Letterboxd app
   */
  static logMovie(title, year, options = {}) {
    const urls = this.generateUrls(title, year);
    if (!urls) {
      console.error('Could not generate Letterboxd URLs for:', title, year);
      return false;
    }

    console.log('Opening Letterboxd movie for logging:', {
      title,
      year,
      appLogUrl: urls.appLogUrl,
      webUrl: urls.webUrl
    });

    // Try to open the app first with x-callback-url log
    try {
      console.log('Attempting to open Letterboxd app for logging...');
      window.location.href = urls.appLogUrl;
      
      // Fallback to web after delay if app doesn't open
      const fallbackDelay = options.fallbackDelay || 1500;
      setTimeout(() => {
        console.log('App did not open, falling back to web browser...');
        this.tryWebUrlWithFallback(title, urls.webUrl);
      }, fallbackDelay);
      
      return true;
    } catch (error) {
      console.error('Error opening Letterboxd app for logging, opening web instead:', error);
      this.tryWebUrlWithFallback(title, urls.webUrl);
      return true;
    }
  }

  /**
   * Try web URL, with fallback to search if the direct link fails
   */
  static tryWebUrlWithFallback(title, primaryUrl) {
    // Try the primary URL first
    const testLink = document.createElement('a');
    testLink.href = primaryUrl;
    testLink.target = '_blank';
    testLink.style.display = 'none';
    document.body.appendChild(testLink);
    testLink.click();
    document.body.removeChild(testLink);
    
    // Note: We can't easily detect if the URL was a 404 in the browser
    // The user will see the page and can use Letterboxd's search if needed
    console.log(`Opened: ${primaryUrl}`);
    console.log(`If that was a 404, search for "${title}" on Letterboxd`);
  }

  /**
   * Open movie reviews page
   */
  static openMovieReviews(title, year) {
    const urls = this.generateUrls(title, year);
    if (!urls) return false;
    
    console.log('Opening Letterboxd reviews for:', title);
    window.open(urls.reviewsUrl, '_blank');
    return true;
  }

  /**
   * Open user's profile
   */
  static openUserProfile(username) {
    if (!username) return false;
    
    const profileUrl = `https://letterboxd.com/${username}/`;
    console.log('Opening Letterboxd profile:', profileUrl);
    window.open(profileUrl, '_blank');
    return true;
  }

  /**
   * Test slug generation with known movies
   */
  static testSlugGeneration() {
    const testMovies = [
      { title: "Fight Club", year: 1999, expected: "fight-club" },
      { title: "The Dark Knight", year: 2008, expected: "the-dark-knight" },
      { title: "Pulp Fiction", year: 1994, expected: "pulp-fiction" },
      { title: "The Shawshank Redemption", year: 1994, expected: "the-shawshank-redemption" },
      { title: "Inception", year: 2010, expected: "inception" },
      { title: "The Matrix", year: 1999, expected: "the-matrix" },
      { title: "Goodfellas", year: 1990, expected: "goodfellas" },
      { title: "The Godfather", year: 1972, expected: "the-godfather" }
    ];

    console.log('Testing Letterboxd slug generation:');
    testMovies.forEach(movie => {
      const generated = this.generateMovieSlug(movie.title, movie.year);
      const match = generated === movie.expected;
      console.log(`${match ? '✅' : '❌'} "${movie.title}" → "${generated}" ${match ? '' : `(expected: "${movie.expected}")`}`);
      
      // Also show the full URLs
      const urls = this.generateUrls(movie.title, movie.year);
      console.log(`   Web URL: ${urls.webUrl}`);
      console.log(`   App URL: ${urls.appUrl}`);
    });
  }
}

export default LetterboxdUrlService;