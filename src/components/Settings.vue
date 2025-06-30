<template>
  <div class="settings mt-2">
    <div class="accordion" id="settingsAccordion">
      <div class="accordion-item">
        <h2 class="accordion-header" id="panelsStayOpen-headingSettings">
          <button class="accordion-button" :class="darkOrLight" type="button" data-bs-toggle="collapse" data-bs-target="#panelsStayOpen-collapseSettings" aria-expanded="true" aria-controls="panelsStayOpen-collapseSettings">
            Settings
          </button>
        </h2>
        <div id="panelsStayOpen-collapseSettings" class="accordion-collapse collapse" aria-labelledby="panelsStayOpen-headingSettings">
          <div class="accordion-body" :class="darkOrLight">
            <div class="mb-4">
              <h6>Normalization Tweak</h6>
              <p>This number tweaks the normalized ratings according to your preference.<br>I suggest finding the lowest rated movie you have that you think is a ten out of ten and then adjust this number until the ratings match your expectations.</p>
              <div class="input-group mb-3">
                <input type="number" class="form-control" v-model="normalizationTweak" />
                <button class="btn btn-primary" @click="updateNormalizationTweak">Update</button>
              </div>
            </div>
            
            <div class="mb-4">
              <h6>Letterboxd Integration</h6>
              <p>Connect your Letterboxd account to see which movies you've logged.</p>
              <div class="form-check form-switch">
                <input class="form-check-input" type="checkbox" id="letterboxdToggle" v-model="letterboxdConnected" @change="updateLetterboxdConnection">
                <label class="form-check-label" for="letterboxdToggle">
                  Enable Letterboxd integration (Demo)
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { getDatabase, ref, get } from "firebase/database";

export default {
  data() {
    return {
      normalizationTweak: null,
      letterboxdConnected: false
    };
  },
  computed: {
    darkOrLight () {
      const inDarkMode = document.querySelector("body").classList.contains('bg-dark');
      return { 'text-bg-dark': inDarkMode, 'text-bg-light': !inDarkMode };
    },
    databaseTopKey() {
      return this.$store.getters.databaseTopKey;
    }
  },
  methods: {
    updateNormalizationTweak() {
      // Update the value in the database using the store's method
      this.$store.dispatch('setDBValue', {
        path: `settings/normalizationTweak`,
        value: this.normalizationTweak || 0.25
      });
    },
    updateLetterboxdConnection() {
      // Update the Letterboxd connection status in the database
      this.$store.dispatch('setDBValue', {
        path: `settings/letterboxdConnected`,
        value: this.letterboxdConnected
      });
    },
    fetchNormalizationTweak() {
      const db = getDatabase();
      const dbRef = ref(db, `${this.databaseTopKey}/settings/normalizationTweak`);
      get(dbRef).then((snapshot) => {
        if (snapshot.exists()) {
          this.normalizationTweak = snapshot.val();
        } else {
          // Set the default value in the database if it doesn't exist
          this.updateNormalizationTweak();
        }
      }).catch((error) => {
        console.error(error);
      });
    },
    fetchLetterboxdConnection() {
      const db = getDatabase();
      const dbRef = ref(db, `${this.databaseTopKey}/settings/letterboxdConnected`);
      get(dbRef).then((snapshot) => {
        if (snapshot.exists()) {
          this.letterboxdConnected = snapshot.val();
        }
      }).catch((error) => {
        console.error(error);
      });
    }
  },
  mounted() {
    this.fetchNormalizationTweak();
    this.fetchLetterboxdConnection();
  }
};
</script>

<style lang="scss">
.settings {
  .accordion {
    .accordion-button {
      &:focus {
        border: none;
        box-shadow: none;
      }

      &.text-bg-dark::after {
        background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='white' viewBox='0 0 16 16'%3e%3cpath d='M4.646 7.646a.5.5 0 0 1 .708 0L8 10.293l2.646-2.647a.5.5 0 0 1 .708.708l-3 3a.5.5 0 0 1-.708 0l-3-3a.5.5 0 0 1 0-.708z'/%3e%3c/svg%3e");
      }

      &.text-bg-light::after {
        background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='black' viewBox='0 0 16 16'%3e%3cpath d='M4.646 7.646a.5.5 0 0 1 .708 0L8 10.293l2.646-2.647a.5.5 0 0 1 .708.708l-3 3a.5.5 0 0 1-.708 0l-3-3a.5.5 0 0 1 0-.708z'/%3e%3c/svg%3e");
      }
    }

    #panelsStayOpen-settings {
      table {
        td {
          white-space: nowrap;

          ul {
            list-style: none;
            margin: 0;
            padding: 0;

            li {
              margin-bottom: 5px;

              &.watched {
                text-decoration: line-through;
              }
            }
          }
        }
      }
    }
  }
}
</style>