<template>
  <form class="my-5 mx-3" @submit.prevent="onSubmit">
    <div class="mb-3">
      <label for="term" class="form-label">Search Database</label>
      <input type="text" class="form-control" name="term" id="term" v-model="value">
    </div>
    <div class="col-12 d-flex justify-content-end">
      <button type="submit" value="Search" class="shadow-lg btn btn-primary col-4">
        <span>Search</span>
      </button>
    </div>
  </form>
</template>

<script>
export default {
  data () {
    return {
      value: ""
    }
  },
  methods: {
    onSubmit () {
      this.$emit('dBSearch', this.value);
    }
  },
}
</script>

<style>

</style>