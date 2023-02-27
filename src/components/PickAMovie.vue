<template>
  <div class="pick-a-movie mx-auto">
    <ul class="p-0 d-flex justify-content-around flex-wrap">
      <li class="card shadow border" v-for="movie in searchResults" :key="movie.id" @click="rateMovie(movie)">
        <img
          v-if="movie.poster_path"
          class="card-img-top"
          :src="`https://image.tmdb.org/t/p/original${movie.poster_path}`"
          align="center"
        >
        <img
          v-else
          class="card-img-top not-found"
          src="../assets/images/Image_not_available.png"
          align="center"
        >
        <p class="my-3 mx-1 card-text text-center" :title="movie.title">
          {{truncate(movie.title)}}
          <br>
          {{movie.release_date}}
        </p>
      </li>
    </ul>
  </div>
</template>

<script>
export default {
  computed: {
    searchResults () {
      return this.$store.state.newEntrySearchResults;
    }
  },
  methods: {
    rateMovie (movie) {
      this.$store.commit('setMovieToRate', movie);
      this.$router.push('/rate-movie');
    },
    truncate (string) {
      if (string.length > 15) {
        return `${string.substr(0, 13)}...`;
      } else {
        return string;
      }
    }
  },
}
</script>

<style lang="scss">
  .pick-a-movie {
    max-width: 832px;

    ul {
      column-gap: 1rem;
      list-style: none;
      margin: 1rem 1rem 5rem;
      row-gap: 1rem;

      .card {
        border-radius: 4px;
        cursor: pointer;
        width: calc((100% - 2rem) / 3);

        .not-found {
          padding: 48px 0;
        }

        p {
          font-size: .75rem;
        }
      }
    }
  }
</style>