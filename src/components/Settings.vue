<template>
  <div class="settings p-3 bg-secondary text-light">
    <div class="tags p-3">
      <ul class="col-12">
        <li v-for="(tag, index) in settings.tags" :key="index">
          <span class="mb-2 badge rounded-pill text-bg-light fs-6">{{ tag.title }}</span>
        </li>
      </ul>
      <div class="new-tag col-6">
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
      }
    }
  }
</style>