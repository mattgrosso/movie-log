<template>
  <ul class="pick-a-movie p-0 d-flex justify-content-around flex-wrap">
    <!-- todo: When no results are found, we need to tell the user -->
    <li class="card shadow border" v-for="movie in firstNineResults" :key="movie.id" @click="rateMovie(movie)">
      <img class="card-img-top" :src="`https://image.tmdb.org/t/p/original${movie.poster_path}`" align="center">
      <p class="m-2 mb-1 card-text text-center">
        <a class="link-success" target="_blank" @click.stop :href="`https://www.themoviedb.org/movie/${movie.id}`">
          TMDB#{{movie.id}}
        </a>
      </p>
      <p class="m-2 mt-1 card-text text-center">
        {{movie.title}}
        <br>
        {{movie.release_date}}
      </p>
    </li>
  </ul>
</template>

<script>
export default {
  props: {
    newEntrySearchResults: {
      type: Array,
      required: true
    }
  },
  computed: {
    firstNineResults () {
      const results = [...this.newEntrySearchResults];

      if (results.length > 9) {
        results.length = 9;
      }

      return results;
    }
  },
  methods: {
    rateMovie (movie) {
      this.$emit("rateMovie", { ...movie });
    }
  },
}
</script>

<style lang="scss">
  .pick-a-movie {
    ul {
      column-gap: 1rem;
      list-style: none;
      margin: 1rem;
      row-gap: 1rem;
  
      .card {
        border-radius: 4px;
        cursor: pointer;
        width: calc((100% - 2rem) / 3);
  
        p {
          font-size: .75rem;
        }
      }
    }
  }
</style>