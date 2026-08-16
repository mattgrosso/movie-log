<template>
  <div class="insights-pane" ref="root">
    <slot v-if="isVisible" />
    <div v-else class="loading-spinner text-center py-5">
      <span class="spinner-border" role="status" aria-hidden="true"></span>
    </div>
  </div>
</template>

<script>
export default {
  name: "InsightsPane",
  data () {
    return {
      isVisible: false,
      observer: null
    };
  },
  mounted () {
    this.observer = new window.IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          this.isVisible = true;
          this.observer.disconnect();
        }
      },
      { rootMargin: "200px" }
    );
    this.observer.observe(this.$refs.root);
  },
  beforeUnmount () {
    if (this.observer) {
      this.observer.disconnect();
    }
  }
};
</script>

<style lang="scss">
.insights-pane {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  /* The old horizontal-rule-with-floating-title chrome is retired
     (2026-08-15 tab rework follow-up) — tabs and content identify the
     sections now. */
  padding: 0 0 32px;

  .insights-pane-item-wrapper {
    padding: 0 5px 10px;

    .insights-pane-item {
      text-align: center;
      border: 1px solid white;
      border-radius: 3px;
      color: white;

      p {
        margin: 0;
      }

      .insights-pane-item-header {
        border-bottom: 1px solid white;
        background: var(--accent, #3b5aaa);
        color: var(--accent-text, white);
        font-size: 0.7rem;
        border-top-left-radius: 3px;
        border-top-right-radius: 3px;
      }

      .insights-pane-item-value {
        font-size: 1.3rem;
      }
    }
  }
}

.loading-spinner {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100px;
}
</style>