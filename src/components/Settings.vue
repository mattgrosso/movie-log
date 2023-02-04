<template>
  <div 
    class="settings bg-secondary text-light"
    :class="{open: showSettings, closed: !showSettings}"
  >
    <div class="p-3">
      <div class="tags p-3 border border-white">
        <ul class="col-12">
          <li class="tag mb-2 dflex align-items-center" v-for="(tag, index) in settings.tags" :key="index">
            <span class="badge rounded-pill text-bg-light fs-6" @click="showRemoveButton($event)">
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
            <tr v-for="(weight, index) in settings.weights" :key="index">
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
    },
    settings: {
      type: Object,
      required: true
    }
  },
  data() {
    return {
      newTagTitle: null
    }
  },
  computed: {
    totalWeight () {
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
    addTag () {
      this.$emit("addNewTag", { title: this.newTagTitle });
      this.newTagTitle = null;
    },
    showRemoveButton (event) {
      const all = Array.from(this.$el.querySelectorAll('.show-remove-button'));
      const notTarget = all.filter((el) => el !== event.target);
      
      notTarget.forEach((el) => el.classList.remove("show-remove-button"));

      event.target.classList.toggle('show-remove-button');
    },
    removeTag (tagIndex) {
      this.$emit("removeTag", tagIndex);
    },
    toggleEdit (event) {
      this.calculateShare();
      this.$el.querySelectorAll('td.editing').forEach((el) => el.classList.remove("editing"));

      event.target.parentElement.classList.add('editing');
    },
    clickSave (index) {
      this.$refs[`save${index}`][0].click();
    },
    updateWeight (event, index, weight) {
      const value = event.target.previousElementSibling.value;
      const payload = {
        index: index, 
        weight: {
          ...weight,
          weight: parseFloat(value)
        }
      };

      this.$emit('updateWeight', payload);
      this.$el.querySelectorAll('td.editing').forEach((el) => el.classList.remove("editing"));
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
    transition: all 0.5s ease;

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
          position: relative;

          .badge {
            position: relative;

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
              padding: 0 6px;
              font-size: 0.85rem;
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
  }
</style>