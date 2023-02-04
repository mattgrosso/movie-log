<template>
  <div class="settings p-3 bg-secondary text-light">
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
    <div class="weights col-12 p-3">
      <ul>
        <li v-for="(weight, index) in settings.weights" :key="index">
          <p class="mb-1">{{weight.name}}</p>
        </li>
      </ul>
    </div>
  </div>
</template>

<script>
export default {
  props: {
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
  methods: {
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
    }
  },
}
</script>

<style lang="scss">
  .settings {
    display: flex;
    flex-wrap: wrap;
    overflow: hidden;
    
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
              top: 50%;
              right: 0;
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