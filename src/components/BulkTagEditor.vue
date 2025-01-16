<template>
  <div class="bulk-tag-editor">
    <button class="btn btn-primary col-12 mt-2" @click="toggleBulkTagEditor">
      <span v-if="bulkTagEditorVisible">Hide Bulk Tag Editor</span>
      <span v-else>Bulk Tag Editor</span>
    </button>
    <Modal :show="bulkTagEditorVisible" @close="toggleBulkTagEditor">
      <template v-slot:header>
        <h3 class="p-3 m-0 text-center">Bulk Tag Editor</h3>
      </template>
      <template v-slot:body>
        <div class="tags mb-3">
          <div class="tag-list">
            <div v-for="(tag, index) in viewingTags" :key="index" class='form-check mx-2'>
              <input class='form-check-input' type='checkbox' :id="`tag-${index}`" @click="toggleViewingTag(tag)">
              <label class="form-check-label" :for="`tag-${index}`">
                {{tag.title}}
              </label>
            </div>
          </div>
          <div class="input-group input-group-sm my-3">
            <input type="text" class="form-control" placeholder="new tag" v-model="newViewingTagTitle" @keyup.enter.prevent>
            <button class="btn btn-dark" type="button" @click.prevent="addViewingTag">
              add
            </button>
          </div>
        </div>
        <div class="movies">
          <div
            v-for="(entry, index) in sortedViewingTags"
            class="movie col-3" 
            :class="{selected: tagAddListIncludes(entry)}"
            :key="index"
            @click="toggleMovieInTagAddList(entry)"
          >
            <img
              class="poster"
              v-lazy="{
                src: `https://image.tmdb.org/t/p/w200${entry.movie.poster_path}`,
                loading: placeholderImage
              }"
            >
          </div>
        </div>
        <div class="fixed-button">
          <button class="btn btn-primary col-12" @click="addViewingTagsToSelectedMovies">
            Add Tags to Selected Movies
          </button>
        </div>
      </template>
    </Modal>
  </div>
</template>

<script>
import Modal from './Modal.vue';
import { getRating } from "../assets/javascript/GetRating.js";

export default {
  name: 'BulkTagEditor',
  components: {
    Modal
  },
  props: {
    allEntriesWithFlatKeywordsAdded: {
      type: Array,
      required: true
    }
  },
  data () {
    return {
      bulkTagEditorVisible: false,
      activeTags: [],
      newViewingTagTitle: null,
      tagAddList: []
    }
  },
  computed: {
    settings() {
      return this.$store.state.settings;
    },
    viewingTags() {
      return this.settings?.tags?.["viewing-tags"];
    },
    sortedViewingTags() {
      return this.allEntriesWithFlatKeywordsAdded.sort((a, b) => {
        if (a.movie.title < b.movie.title) {
          return -1;
        }
        if (a.movie.title > b.movie.title) {
          return 1;
        }
        return 0;
      });
    }
  },
  methods: {
    toggleBulkTagEditor() {
      this.bulkTagEditorVisible = !this.bulkTagEditorVisible;
    },
    toggleViewingTag(tag) {
      if (this.activeTags.includes(tag)) {
        this.activeTags = this.activeTags.filter(activeTag => activeTag !== tag);
      } else {
        this.activeTags.push(tag);
      }
    },
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
    tagAddListIncludes(entry) {
      return this.tagAddList.find((tag) => tag.dbKey === entry.dbKey);
    },
    toggleMovieInTagAddList(entry) {
      if (this.tagAddListIncludes(entry)) {
        this.tagAddList = this.tagAddList.filter((tag) => tag.dbKey !== entry.dbKey);
      } else {
        this.tagAddList.push(entry);
      }
    },
    addViewingTagsToSelectedMovies() {
      this.tagAddList.forEach((entry) => {
        const mostRecentRating = getRating(entry);
        const ratingIndex = entry.ratings.findIndex((rating) => rating.date === mostRecentRating.date);

        if (mostRecentRating.tags) {
          mostRecentRating.tags = mostRecentRating.tags.concat(this.activeTags);
        } else {
          mostRecentRating.tags = this.activeTags;
        }

        const scratch = {
          ...entry,
          ratings: [
            ...entry.ratings.slice(0, ratingIndex),
            mostRecentRating,
            ...entry.ratings.slice(ratingIndex + 1)
          ]
        }

        const dbEntry = {
          path: `movieLog/${entry.dbKey}`,
          value: scratch
        }

        this.$store.dispatch('setDBValue', dbEntry);
      })

      this.resetModal();
    },
    resetModal() {
      this.activeTags = [];
      this.newViewingTagTitle = null;
      this.tagAddList = [];
    }
  },
};
</script>

<style lang="scss">
  .bulk-tag-editor {
    .tags {
      .tag-list {
        cursor: pointer;
        display: flex;
        flex-wrap: wrap;
        font-size: 0.75rem;
        max-height: 12vh;
        overflow: scroll;
      }
    }

    .movies {
      cursor: pointer;
      display: flex;
      flex-wrap: wrap;
      margin-bottom: 60px;
  
      .movie {
        border-radius: 0.25rem;
        box-shadow: 0 0 0.5rem rgba(0, 0, 0, 0.1);
        overflow: hidden;
        padding: 6px;
        position: relative;
        
        &.selected {
          border: 2px solid #007bff;
        }

        .poster {
          border-radius: 0.25rem;
          height: auto;
          width: 100%;
        }
      }
    }

    .fixed-button {
      bottom: 15px;
      left: 0;
      padding: 32px 48px;
      position: fixed;
      width: 100%;
    }
  }
</style>