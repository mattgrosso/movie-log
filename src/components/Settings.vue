<template>
  <div
    class="settings bg-secondary text-light"
    :class="{open: showSettings, closed: !showSettings}"
  >
    <div class="p-3">
      <div class="p-1 border-white border">
        <p class="m-0 text-center fs-5">:: {{$store.state.databaseTopKey}} ::</p>
      </div>
      <div class="tags p-3 border border-white mt-3">
        <ul class="col-12">
          <li class="tag mb-2 dflex align-items-center" v-for="(tag, index) in tags" :key="index">
            <span class="badge col-12 rounded-pill text-bg-light" @click="showRemoveButton($event)">
              {{ tag.title }}
              <span class="remove-button" @click.prevent="removeTag(index)">
                <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" class="bi bi-x-circle-fill text-light" viewBox="0 0 16 16">
                  <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zM5.354 4.646a.5.5 0 1 0-.708.708L7.293 8l-2.647 2.646a.5.5 0 0 0 .708.708L8 8.707l2.646 2.647a.5.5 0 0 0 .708-.708L8.707 8l2.647-2.646a.5.5 0 0 0-.708-.708L8 7.293 5.354 4.646z"/>
                </svg>
              </span>
            </span>
          </li>
        </ul>
        <div class="new-tag col-6 mt-4">
          <div class="input-group">
            <input type="text" class="form-control" placeholder="new tag" v-model="newTagTitle">
            <button class="btn btn-dark" type="button" @click="addTag">
              add
            </button>
          </div>
        </div>
      </div>
      <div class="weights col-12 p-3 border-white border mt-3">
        <table class="table text-light">
          <thead>
            <tr>
              <th>Category</th>
              <th>Weight</th>
              <th>Share</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(weight, index) in weights" :key="index">
              <td>{{weight.name}}</td>
              <td class="d-flex align-items-center">
                <span>
                  {{weight.weight}}
                </span>
                <div class="input-group">
                  <input type="text" class="form-control" :value="weight.weight" @keyup.enter="clickSave(index)">
                  <button :ref="`save${index}`" class="btn btn-dark" type="button" @click="updateWeight($event, index, weight)">
                    save
                  </button>
                </div>
                <svg @click="toggleEdit($event)" xmlns="http://www.w3.org/2000/svg" fill="currentColor" class="bi bi-pencil" viewBox="0 0 16 16">
                  <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z"/>
                </svg>
              </td>
              <td>
                {{calculateShare(weight.weight)}}%
              </td>
            </tr>
            <tr>
              <td>Total</td>
              <td>
                <span>
                  {{totalWeight}}
                </span>
              </td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="mt-3 p-3 border border-white">
        <label class="form-label" for="routeAfterRating">After rating where would you like to go?</label>
        <select class="form-select" name="routeAfterRating" id="routeAfterRating" v-model="routeAfterRating">
          <option value="recentlyViewed">Recently viewed</option>
          <option value="allRatings">All ratings</option>
          <option value="home">Home screen</option>
          <option value="sameYear">Ratings from the same year</option>
        </select>
      </div>
      <div class="uploader mt-3 p-3 border border-white">
        <ImportCsv
          :uploadPercentage="uploadPercentage"
          @uploadRatings="uploadRatings"
        />
      </div>
      <div class="dev-mode mt-3 p-3 border border-white">
        <div class="form-check form-switch m-0 d-flex justify-content-center">
          <input class="form-check-input" type="checkbox" role="switch" id="devMode" v-model="devMode">
          <label class="form-check-label ml-3" for="devMode">Dev Mode</label>
        </div>
        <div v-if="devMode" class="dev-mode-flag">
          Dev Mode!
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { getDatabase, ref, set } from "firebase/database";
import ImportCsv from "./ImportCsv.vue";

export default {
  components: {
    ImportCsv
  },
  props: {
    showSettings: {
      type: Boolean,
      required: false,
      default: false
    }
  },
  async mounted () {
    this.devMode = JSON.parse(window.localStorage.getItem('devMode'));

    const route = this.$store.state.settings?.routeAfterRating?.value;
    if (route) {
      this.routeAfterRating = route;
    } else {
      this.routeAfterRating = "recentlyViewed";
    }
  },
  data () {
    return {
      newTagTitle: null,
      devMode: false,
      uploadPercentage: 0,
      routeAfterRating: ""
    }
  },
  watch: {
    devMode (newVal) {
      window.localStorage.setItem('devMode', newVal);
      this.devModeSwitched(newVal);
    },
    routeAfterRating (newVal) {
      this.setRouteAfterRating(newVal);
    },
    settingsRouteAfterRating (newVal) {
      this.routeAfterRating = newVal;
    }
  },
  computed: {
    settings () {
      return this.$store.state.settings;
    },
    settingsRouteAfterRating () {
      return this.$store.state.settings?.routeAfterRating?.value;
    },
    databaseTopKey () {
      return this.$store.state.databaseTopKey;
    },
    tags () {
      if (!this.settings) {
        return [];
      }

      return this.settings.tags;
    },
    weights () {
      if (!this.settings) {
        return [];
      }

      return this.settings.weights;
    },
    totalWeight () {
      if (!this.settings?.weights) {
        return 0;
      }

      const weights = this.settings.weights.map((weight) => {
        if (weight.name === "Impression") {
          return weight.weight / 2;
        } else {
          return weight.weight;
        }
      });

      let totalWeight = 0;

      weights.forEach((weight) => {
        totalWeight = totalWeight + weight;
      })

      return totalWeight.toPrecision(4);
    }
  },
  methods: {
    calculateShare (weight) {
      const share = (weight / this.totalWeight) * 100;
      return share.toPrecision(4);
    },
    async setRouteAfterRating (value) {
      if (this.databaseTopKey) {
        await set(ref(getDatabase(), `${this.databaseTopKey}/settings/routeAfterRating`), { value: value });
      }
    },
    async addTag () {
      await set(ref(
        getDatabase(),
        `${this.databaseTopKey}/settings/tags/${crypto.randomUUID()}`),
      { title: this.newTagTitle }
      );

      this.newTagTitle = null;
    },
    showRemoveButton (event) {
      const all = Array.from(this.$el.querySelectorAll('.show-remove-button'));
      const notTarget = all.filter((el) => el !== event.target);

      notTarget.forEach((el) => el.classList.remove("show-remove-button"));

      event.target.classList.toggle('show-remove-button');
    },
    async removeTag (tagIndex) {
      await set(ref(
        getDatabase(),
        `${this.databaseTopKey}/settings/tags/${tagIndex}`),
      null
      );
    },
    toggleEdit (event) {
      this.calculateShare();
      this.$el.querySelectorAll('td.editing').forEach((el) => el.classList.remove("editing"));

      event.target.parentElement.classList.add('editing');
    },
    clickSave (index) {
      this.$refs[`save${index}`][0].click();
    },
    async updateWeight (event, index, weight) {
      const value = event.target.previousElementSibling.value;
      const payload = {
        index: index,
        weight: {
          ...weight,
          weight: parseFloat(value)
        }
      };

      await set(ref(
        getDatabase(),
        `${this.databaseTopKey}/settings/weights/${payload.index}`),
      payload.weight
      );

      this.$el.querySelectorAll('td.editing').forEach((el) => el.classList.remove("editing"));
    },
    async devModeSwitched (devMode) {
      if (!this.$route.meta.requiresLogin) {
        return;
      }

      if (devMode) {
        this.$store.commit('setDatabaseTopKey', "testing-database");
      } else if (this.$store.state.googleLogin) {
        this.$store.commit('setDatabaseTopKey', this.$store.state.googleLogin);
      } else {
        window.localStorage.removeItem('databaseTopKey');
        this.$router.push('/login')
      }

      await this.$store.dispatch('getDatabase');
    },
    async uploadRatings (ratings) {
      const total = ratings.length;
      let count = 0;

      for (const rating of ratings) {
        await this.addRating(rating, true);
        count = count + 1;
        this.uploadPercentage = count / total;
      }

      this.$store.dispatch('getDatabase');
      this.$emit('hideSettings');
      this.$router.push('/');
    }
  },
}
</script>

<style lang="scss">
  .settings {
    box-sizing: border-box;
    display: flex;
    flex-wrap: wrap;
    overflow: hidden;
    position: relative;
    transition: all 0.5s ease;
    z-index: 1;

    &>div {
      max-width: 100%;
    }

    &.closed {
      max-height: 0;
    }

    &.open {
      max-height: 1000px;
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

    .weights {
      th {
        font-size: 1.25rem;
      }

      td {
        font-size: 0.85rem;

        &.editing {
          span {
            display: none;
          }

          .input-group {
            display: flex;
            width: 75%;

            input {
              font-size: 0.85rem;
              padding: 0 12px;
            }

            button {
              font-size: 0.85rem;
              padding: 0 6px;
            }
          }
        }

        .input-group {
          display: none;
        }

        svg {
          height: 0.6rem;
          margin-left: 8px;
          width: 0.6rem;
        }
      }
    }

    .uploader {
      display: none;
    }

    .header-settings {
      .switch {
        left: -20px;
        position: relative;
      }
    }

    .dev-mode {
      .form-check {
        .form-check-input {
          cursor: pointer;

          &:checked {
            background-color: #198754;
            border-color: #198754;
          }
        }

        .form-check-label {
          margin: 0 12px;
        }
      }

      .dev-mode-flag {
        background-color: #dc3545;
        border: 2px solid white;
        box-shadow: 0px 0px 9px 0px #424242;
        font-size: 1rem;
        left: 0;
        padding: 6px 64px;
        pointer-events: none;
        position: fixed;
        top: 0;
        transform: rotate(-45deg) translate(-55px, -33px);
      }
    }
  }
</style>