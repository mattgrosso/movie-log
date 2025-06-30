import axios from 'axios';

class LetterboxdService {
  constructor() {
    this.baseURL = 'https://api.letterboxd.com/api/v0';
    this.clientId = process.env.VUE_APP_LETTERBOXD_CLIENT_ID;
    this.clientSecret = process.env.VUE_APP_LETTERBOXD_CLIENT_SECRET;
    this.accessToken = null;
    this.memberId = null;
  }

  /**
   * Initialize the service with stored credentials
   */
  init(accessToken, memberId) {
    this.accessToken = accessToken;
    this.memberId = memberId;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    return !!this.accessToken && !!this.memberId;
  }

  /**
   * Get headers for authenticated requests
   */
  getAuthHeaders() {
    return {
      'Authorization': `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json'
    };
  }

  /**
   * Search for a film by TMDB ID
   * Returns Letterboxd film ID if found
   */
  async findFilmByTMDBId(tmdbId) {
    try {
      const response = await axios.get(`${this.baseURL}/films`, {
        params: {
          filmId: `tmdb:${tmdbId}`,  // Use TMDB external ID
          perPage: 1
        }
      });

      if (response.data.items && response.data.items.length > 0) {
        return response.data.items[0].id;
      }
      
      return null;
    } catch (error) {
      console.error('Error finding film by TMDB ID:', error);
      return null;
    }
  }

  /**
   * Check if user has logged/watched a specific film
   * Uses the /film/{id}/member/{member} endpoint
   */
  async checkFilmStatus(letterboxdFilmId) {
    if (!this.isAuthenticated()) {
      throw new Error('User not authenticated with Letterboxd');
    }

    try {
      const response = await axios.get(
        `${this.baseURL}/film/${letterboxdFilmId}/member/${this.memberId}`,
        {
          headers: this.getAuthHeaders(),
          params: {
            // Get the user's relationship with this film
            include: 'relationship'
          }
        }
      );

      // Check if the film has been watched
      const relationship = response.data.relationship;
      return {
        watched: relationship?.watched || false,
        liked: relationship?.liked || false,
        inWatchlist: relationship?.inWatchlist || false,
        rating: relationship?.rating || null
      };
    } catch (error) {
      console.error('Error checking film status:', error);
      
      // Handle specific HTTP errors
      if (error.response?.status === 404) {
        // Film not found or user hasn't interacted with it
        return {
          watched: false,
          liked: false,
          inWatchlist: false,
          rating: null
        };
      }
      
      throw error;
    }
  }

  /**
   * Main method to check if a TMDB movie has been logged by the user
   */
  async checkMovieLoggedStatus(tmdbId) {
    try {
      // Step 1: Find the Letterboxd film ID using TMDB ID
      const letterboxdFilmId = await this.findFilmByTMDBId(tmdbId);
      
      if (!letterboxdFilmId) {
        // Film not found on Letterboxd
        return {
          watched: false,
          error: false,
          message: 'Film not found on Letterboxd'
        };
      }

      // Step 2: Check user's relationship with the film
      const status = await this.checkFilmStatus(letterboxdFilmId);
      
      return {
        watched: status.watched,
        liked: status.liked,
        inWatchlist: status.inWatchlist,
        rating: status.rating,
        error: false,
        letterboxdFilmId
      };
    } catch (error) {
      console.error('Error checking movie logged status:', error);
      
      return {
        watched: false,
        error: true,
        message: error.message || 'Failed to check Letterboxd status'
      };
    }
  }

  /**
   * OAuth2 Authorization URL generation
   * This would redirect user to Letterboxd for authentication
   */
  getAuthorizationUrl(redirectUri, state) {
    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      scope: 'user', // Basic user scope to read watched films
      state: state || Math.random().toString(36).substring(7)
    });

    return `${this.baseURL}/auth/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code, redirectUri) {
    try {
      const response = await axios.post(`${this.baseURL}/auth/token`, {
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri
      });

      this.accessToken = response.data.access_token;
      
      // Get user information to get member ID
      const userInfo = await this.getCurrentUser();
      this.memberId = userInfo.id;

      return {
        accessToken: this.accessToken,
        memberId: this.memberId,
        user: userInfo
      };
    } catch (error) {
      console.error('Error exchanging code for token:', error);
      throw error;
    }
  }

  /**
   * Get current authenticated user information
   */
  async getCurrentUser() {
    if (!this.accessToken) {
      throw new Error('No access token available');
    }

    try {
      const response = await axios.get(`${this.baseURL}/me`, {
        headers: this.getAuthHeaders()
      });

      return response.data;
    } catch (error) {
      console.error('Error getting current user:', error);
      throw error;
    }
  }

  /**
   * Clear authentication
   */
  logout() {
    this.accessToken = null;
    this.memberId = null;
  }
}

export default new LetterboxdService();