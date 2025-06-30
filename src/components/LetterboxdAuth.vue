<template>
  <div class="letterboxd-auth">
    <div v-if="!isConnected" class="not-connected">
      <h6>Connect to Letterboxd</h6>
      <p>Connect your Letterboxd account to see which movies you've logged.</p>
      
      <div v-if="authError" class="alert alert-danger" role="alert">
        <strong>Connection Error:</strong> {{ authError }}
      </div>
      
      <button 
        class="btn btn-success" 
        @click="startAuthFlow"
        :disabled="authInProgress"
      >
        <i v-if="authInProgress" class="bi bi-hourglass-split me-2"></i>
        <i v-else class="bi bi-box-arrow-in-right me-2"></i>
        {{ authInProgress ? 'Connecting...' : 'Connect Letterboxd Account' }}
      </button>
      
      <div class="mt-2">
        <small class="text-muted">
          You'll be redirected to Letterboxd to authorize access to your account.
        </small>
      </div>
    </div>
    
    <div v-else class="connected">
      <div class="alert alert-success" role="alert">
        <i class="bi bi-check-circle me-2"></i>
        <strong>Connected to Letterboxd</strong>
        <div v-if="userInfo">
          Logged in as: <strong>{{ userInfo.displayName || userInfo.username }}</strong>
        </div>
      </div>
      
      <button class="btn btn-outline-danger btn-sm" @click="disconnect">
        <i class="bi bi-x-circle me-1"></i>
        Disconnect
      </button>
    </div>
  </div>
</template>

<script>
import LetterboxdService from '../services/LetterboxdService.js';

export default {
  name: 'LetterboxdAuth',
  data() {
    return {
      authInProgress: false,
      authError: null,
      userInfo: null
    };
  },
  computed: {
    isConnected() {
      return this.$store.state.settings.letterboxdCredentials?.accessToken && 
             this.$store.state.settings.letterboxdCredentials?.memberId;
    },
    letterboxdCredentials() {
      return this.$store.state.settings.letterboxdCredentials;
    }
  },
  watch: {
    letterboxdCredentials: {
      handler(newCredentials) {
        if (newCredentials?.accessToken && newCredentials?.memberId) {
          LetterboxdService.init(newCredentials.accessToken, newCredentials.memberId);
          this.userInfo = newCredentials.user;
        }
      },
      immediate: true
    }
  },
  async mounted() {
    // Check if we're returning from OAuth redirect
    await this.handleOAuthCallback();
  },
  methods: {
    async startAuthFlow() {
      this.authInProgress = true;
      this.authError = null;
      
      try {
        // Generate a random state for security
        const state = Math.random().toString(36).substring(7);
        localStorage.setItem('letterboxd_oauth_state', state);
        
        // Build redirect URI (current page)
        const redirectUri = `${window.location.origin}${window.location.pathname}`;
        
        // Get authorization URL
        const authUrl = LetterboxdService.getAuthorizationUrl(redirectUri, state);
        
        // Redirect to Letterboxd for authorization
        window.location.href = authUrl;
      } catch (error) {
        console.error('Error starting auth flow:', error);
        this.authError = 'Failed to start authentication process';
        this.authInProgress = false;
      }
    },
    
    async handleOAuthCallback() {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const state = urlParams.get('state');
      const error = urlParams.get('error');
      
      if (error) {
        this.authError = `OAuth Error: ${error}`;
        return;
      }
      
      if (code && state) {
        // Verify state matches what we stored
        const storedState = localStorage.getItem('letterboxd_oauth_state');
        if (state !== storedState) {
          this.authError = 'Invalid OAuth state - possible security issue';
          return;
        }
        
        this.authInProgress = true;
        
        try {
          const redirectUri = `${window.location.origin}${window.location.pathname}`;
          const tokenData = await LetterboxdService.exchangeCodeForToken(code, redirectUri);
          
          // Store credentials in database
          await this.$store.dispatch('setDBValue', {
            path: 'settings/letterboxdCredentials',
            value: {
              accessToken: tokenData.accessToken,
              memberId: tokenData.memberId,
              user: tokenData.user,
              connectedAt: new Date().toISOString()
            }
          });
          
          // Also enable the letterboxd integration
          await this.$store.dispatch('setDBValue', {
            path: 'settings/letterboxdConnected',
            value: true
          });
          
          this.userInfo = tokenData.user;
          
          // Clean up URL parameters
          window.history.replaceState({}, document.title, window.location.pathname);
          
          // Clean up localStorage
          localStorage.removeItem('letterboxd_oauth_state');
          
        } catch (error) {
          console.error('Error exchanging code for token:', error);
          this.authError = 'Failed to complete authentication';
        } finally {
          this.authInProgress = false;
        }
      }
    },
    
    async disconnect() {
      try {
        // Clear from database
        await this.$store.dispatch('setDBValue', {
          path: 'settings/letterboxdCredentials',
          value: null
        });
        
        // Disable integration
        await this.$store.dispatch('setDBValue', {
          path: 'settings/letterboxdConnected',
          value: false
        });
        
        // Clear service
        LetterboxdService.logout();
        this.userInfo = null;
        
      } catch (error) {
        console.error('Error disconnecting:', error);
        this.authError = 'Failed to disconnect';
      }
    }
  }
};
</script>

<style lang="scss">
.letterboxd-auth {
  .btn {
    i {
      font-size: 0.9rem;
    }
  }
  
  .alert {
    font-size: 0.85rem;
    padding: 0.5rem 0.75rem;
    margin-bottom: 0.5rem;
  }
}
</style>