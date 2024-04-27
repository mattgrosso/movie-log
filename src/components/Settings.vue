<template>
  <div
    class="settings bg-secondary text-light"
  >
    <div class="p-3">
      <div class="p-1 border-white border">
        <p class="m-0 text-center fs-5">:: {{$store.state.databaseTopKey}} ::</p>
      </div>
      <div class="tv-log-switch mt-3 p-3 border border-white">
        <button class="btn btn-primary col-12" @click="toggleMovieTV">Switch to
          <span v-if="currentLog === 'tvLog'">Movie Log</span>
          <span v-if="currentLog === 'movieLog'">TV Log</span>
        </button>
      </div>
      <div class="tags viewing-tags p-3 border border-white mt-3">
        <p class="col-12">Viewing Specific Tags</p>
        <ul class="col-12">
          <li class="tag mb-2 col-6 dflex align-items-center" v-for="(tag, index) in viewingTags" :key="index">
            <span class="badge col-12 rounded-pill text-bg-light" @click="showRemoveButton($event)">
              {{ tag.title }}
              <span class="remove-button" @click.prevent="removeViewingTag(index)">
                <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" class="bi bi-x-circle-fill text-light" viewBox="0 0 16 16">
                  <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zM5.354 4.646a.5.5 0 1 0-.708.708L7.293 8l-2.647 2.646a.5.5 0 0 0 .708.708L8 8.707l2.646 2.647a.5.5 0 0 0 .708-.708L8.707 8l2.647-2.646a.5.5 0 0 0-.708-.708L8 7.293 5.354 4.646z"/>
                </svg>
              </span>
            </span>
          </li>
        </ul>
        <div class="new-tag col-6 mt-4">
          <div class="input-group">
            <input type="text" class="form-control" placeholder="new tag" v-model="newViewingTagTitle" @keyup.enter="addViewingTag">
            <button class="btn btn-dark" type="button" @click="addViewingTag">
              add
            </button>
          </div>
        </div>
      </div>
      <div class="tags movie-tags p-3 border border-white mt-3">
        <p class="col-12">Movie Specific Tags</p>
        <ul class="col-12">
          <li class="tag mb-2 col-6 dflex align-items-center" v-for="(tag, index) in movieTags" :key="index">
            <span class="badge col-12 rounded-pill text-bg-light" @click="showRemoveButton($event)">
              {{ tag.title }}
              <span class="remove-button" @click.prevent="removeMovieTag(index)">
                <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" class="bi bi-x-circle-fill text-light" viewBox="0 0 16 16">
                  <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zM5.354 4.646a.5.5 0 1 0-.708.708L7.293 8l-2.647 2.646a.5.5 0 0 0 .708.708L8 8.707l2.646 2.647a.5.5 0 0 0 .708-.708L8.707 8l2.647-2.646a.5.5 0 0 0-.708-.708L8 7.293 5.354 4.646z"/>
                </svg>
              </span>
            </span>
          </li>
        </ul>
        <div class="new-tag col-6 mt-4">
          <div class="input-group">
            <input type="text" class="form-control" placeholder="new tag" v-model="newMovieTagTitle" @keyup.enter="addMovieTag">
            <button class="btn btn-dark" type="button" @click="addMovieTag">
              add
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    showSettings: {
      type: Boolean,
      required: false,
      default: false
    }
  },
  data () {
    return {
      newViewingTagTitle: null,
      newMovieTagTitle: null,
    }
  },
  computed: {
    currentLog () {
      return this.$store.state.currentLog;
    },
    settings () {
      return this.$store.state.settings;
    },
    databaseTopKey () {
      return this.$store.state.databaseTopKey;
    },
    viewingTags () {
      if (!this.settings || !this.settings.tags) {
        return [];
      }

      return this.settings.tags["viewing-tags"];
    },
    movieTags () {
      if (!this.settings || !this.settings.tags) {
        return [];
      }

      return this.settings.tags["movie-tags"];
    }
  },
  methods: {
    async addViewingTag () {
      if (!this.settings.tags || !this.settings.tags["viewing-tags"]) {
        return;
      }

      const viewingTagsArray = Object.keys(this.settings.tags["viewing-tags"]).map((key) => this.settings.tags["viewing-tags"][key]);

      if (!viewingTagsArray.find((tag) => tag.title === this.newViewingTagTitle)) {
        const dbKey = `${new Date().getTime()}-${crypto.randomUUID()}`;

        const dbEntry = {
          path: `settings/tags/viewing-tags/${dbKey}`,
          value: { title: this.newViewingTagTitle }
        }

        this.$store.dispatch('setDBValue', dbEntry);
      }

      this.newViewingTagTitle = null;
    },
    async addMovieTag () {
      if (!this.settings.tags || !this.settings.tags["movie-tags"]) {
        return;
      }

      const movieTagsArray = Object.keys(this.settings.tags["movie-tags"]).map((key) => this.settings.tags["movie-tags"][key]);

      if (!movieTagsArray.find((tag) => tag.title === this.newMovieTagTitle)) {
        const dbKey = `${new Date().getTime()}-${crypto.randomUUID()}`;

        const dbEntry = {
          path: `settings/tags/movie-tags/${dbKey}`,
          value: { title: this.newMovieTagTitle }
        }

        this.$store.dispatch('setDBValue', dbEntry);
      }

      this.newMovieTagTitle = null;
    },
    showRemoveButton (event) {
      const all = Array.from(this.$el.querySelectorAll('.show-remove-button'));
      const notTarget = all.filter((el) => el !== event.target);

      notTarget.forEach((el) => el.classList.remove("show-remove-button"));

      event.target.classList.toggle('show-remove-button');
    },
    async removeViewingTag (tagIndex) {
      const dbEntry = {
        path: `settings/tags/viewing-tags/${tagIndex}`,
        value: null
      }

      this.$store.dispatch('setDBValue', dbEntry);
    },
    async removeMovieTag (tagIndex) {
      const dbEntry = {
        path: `settings/tags/movie-tags/${tagIndex}`,
        value: null
      }

      this.$store.dispatch('setDBValue', dbEntry);
    },
    toggleMovieTV () {
      this.$store.dispatch('toggleCurrentLog');
      this.$router.push("/");
    }
  },
}
</script>

<style lang="scss">
  .settings {
    display: flex;
    flex-wrap: wrap;
    padding-bottom: 50px;

    &>div {
      max-width: 100%;
    }

    ul {
      list-style: none;
      margin: 0;
      padding: 0;
    }

    .tags {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;

      ul {
        column-count: 2;
        display: flex;
        flex-wrap: wrap;
        overflow: scroll;

        .tag {
          cursor: pointer;
          position: relative;

          .badge {
            font-size: 0.75rem;
            max-width: 85%;
            position: relative;
            white-space: normal;

            &.show-remove-button {
              .remove-button {
                transform: translate(150%, -50%);
                z-index: 1;
              }
            }

            .remove-button {
              display: flex;
              position: absolute;
              right: 0;
              top: 50%;
              transform: translateY(-50%) rotate(-90deg);
              transition: all 0.25s ease-out;
              z-index: -1;

              svg {
                height: 18px;
                width: 18px;
              }
            }
          }
        }
      }
    }
  }
</style>