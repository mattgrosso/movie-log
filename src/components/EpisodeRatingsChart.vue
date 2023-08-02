<template>
  <LineChart class="chart my-5" :chartData="episodeRatingsData" :options="episodeRatingsOptions"/>
</template>

<script>
import { LineChart } from "vue-chart-3";
import { Chart, registerables } from "chart.js";
import randomColor from 'randomcolor';
import axios from 'axios';

Chart.register(...registerables);

export default {
  props: {
    tvShow: {
      type: Object,
      required: true,
    },
  },
  data () {
    return {
      loading: true,
      seasonsAndEpisodes: [],
    }
  },
  components: {
    LineChart
  },
  async mounted () {
    this.seasonsAndEpisodes = await this.getSeasonsAndEpisodes();

    this.loading = false;
  },
  computed: {
    ratings () {
      return this.tvShow.ratings.episodes;
    },
    labels () {
      const labels = [];

      this.seasonsAndEpisodes.forEach((season) => {
        if (season.seasonNumber === 0) {
          return;
        }

        for (let i = 1; i <= season.episodeCount; i++) {
          labels.push(`${season.seasonNumber}x${i}`);
        }
      });

      return labels;
    },
    data () {
      const data = [];

      this.labels.forEach((label) => {
        const rating = this.ratings.find((rating) => {
          const ratingKey = `${rating.episode.season_number}x${rating.episode.episode_number}`;
          return label === ratingKey;
        });

        if (rating) {
          data.push(parseFloat(rating.rating));
        } else {
          data.push(0);
        }
      });

      return data;
    },
    episodeRatingsData () {
      const color = randomColor();

      return {
        labels: this.labels,
        datasets: [
          {
            data: this.data,
            backgroundColor: color,
            borderColor: color,
            tension: 0,
            radius: 0,
            fill: 'origin'
          }
        ]
      }
    },
    episodeRatingsOptions () {
      return {
        plugins: {
          legend: {
            display: false
          },
          title: {
            display: true,
            text: "Ratings Distribution",
          },
        },
        backgroundColor: 'rgba(100, 100, 0, 1)',
        scales: {
          x: {
            display: true
          }
        }
      }
    },
  },
  methods: {
    async getSeasonsAndEpisodes () {
      const seasons = await axios.get(`https://api.themoviedb.org/3/tv/${this.tvShow.tvShow.id}?api_key=${process.env.VUE_APP_TMDB_API_KEY}&language=en-US`);

      return seasons.data.seasons.map((season) => {
        return {
          seasonName: season.name,
          seasonId: season.id,
          seasonNumber: season.season_number,
          episodeCount: season.episode_count
        }
      });
    }
  },
};
</script>

<style lang="scss">

</style>