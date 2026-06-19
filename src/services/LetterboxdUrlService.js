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
   * Today's date as a local YYYY-MM-DD string (Letterboxd's `date` param format).
   * Built from local date components — NOT toISOString(), which is UTC and would
   * log the wrong day for late-evening viewings in western timezones.
   */
  static todayLocalISODate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Letterboxd's `rating` deep-link param is a 0.5–5 star value in 0.5 steps.
   * Cinema Roll's normalized rating is 0–10, and the app shows stars as
   * normalizedRating / 2 (see ToggleableRating.vue), so that same /2 value maps
   * directly onto Letterboxd's scale. Returns null for anything that isn't a
   * loggable star rating (0 / missing / non-numeric) so we simply omit the param.
   */
  static normalizedRatingToStars(normalizedRating) {
    const stars = parseFloat(normalizedRating) / 2;
    if (!isFinite(stars) || stars < 0.5) return null;
    const clamped = Math.min(5, stars);
    // Snap to the nearest valid 0.5 increment Letterboxd accepts.
    return Math.round(clamped * 2) / 2;
  }

  /**
   * Generate full Letterboxd URLs.
   * options.normalizedRating (0–10) is forwarded to the log link as a star rating.
   */
  static generateUrls(title, year, options = {}) {
    const slug = this.generateMovieSlug(title, year);
    if (!slug || !title) return null;

    // URL encode the title for the app URL
    const encodedTitle = encodeURIComponent(title);

    // Letterboxd's log deep link no longer defaults the viewing date to today
    // (an app update changed this), so we pass today's date explicitly. Without
    // it, logs follow-through from Cinema Roll on mobile land with no date.
    const today = this.todayLocalISODate();

    // Pre-fill the star rating from Cinema Roll when we have one.
    const stars = this.normalizedRatingToStars(options.normalizedRating);
    const ratingParam = stars !== null ? `&rating=${stars}` : '';

    return {
      slug: slug,
      webUrl: `https://letterboxd.com/film/${slug}/`,
      appUrl: `letterboxd://x-callback-url/search?query=${encodedTitle}&type=film`,
      appLogUrl: `letterboxd://x-callback-url/log?name=${encodedTitle}&date=${today}${ratingParam}`,
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

    // Try to open the app first with x-callback-url search
    try {
      window.location.href = urls.appUrl;

      // Fallback to web after delay if app doesn't open
      const fallbackDelay = options.fallbackDelay || 1500;
      setTimeout(() => {
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
    const urls = this.generateUrls(title, year, options);
    if (!urls) {
      console.error('Could not generate Letterboxd URLs for:', title, year);
      return false;
    }

    // Try to open the app first with x-callback-url log
    try {
      window.location.href = urls.appLogUrl;

      // Fallback to web after delay if app doesn't open
      const fallbackDelay = options.fallbackDelay || 1500;
      setTimeout(() => {
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
    // Note: we can't detect a 404 in the browser; the user can fall back to
    // Letterboxd's own search if the direct film URL misses.
  }

  /**
   * Open movie reviews page
   */
  static openMovieReviews(title, year) {
    const urls = this.generateUrls(title, year);
    if (!urls) return false;

    window.open(urls.reviewsUrl, '_blank');
    return true;
  }

  /**
   * Open user's profile
   */
  static openUserProfile(username) {
    if (!username) return false;
    
    const profileUrl = `https://letterboxd.com/${username}/`;
    window.open(profileUrl, '_blank');
    return true;
  }
}

export default LetterboxdUrlService;