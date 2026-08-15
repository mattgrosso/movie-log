<template>
  <div v-if="show" class="cinemaroll-modal" :class="{ 'page-mode': page }">
    <div class="cinemaroll-modal-content">
      <div class="cinemaroll-modal-header">
        <span class="close" @click="close">&times;</span>
        <slot name="header"></slot>
      </div>
      <div class="cinemaroll-modal-body">
        <slot name="body"></slot>
      </div>
      <div class="cinemaroll-modal-footer">
        <slot name="footer"></slot>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    show: {
      type: Boolean,
      required: true,
    },
    // Renders the same header/body/footer slots as a normal in-flow page
    // surface instead of a fixed overlay — no backdrop, no body scroll
    // lock. The awards flow uses this to live at /awards as a real screen
    // (feedback: the modal "always feels a little bit janky").
    page: {
      type: Boolean,
      default: false
    }
  },
  watch: {
    show (value) {
      if (this.page) return; // a page scrolls like a page
      if (value) {
        document.body.classList.add('no-scroll');
      } else {
        document.body.classList.remove('no-scroll');
      }
    }
  },
  unmounted () {
    document.body.classList.remove('no-scroll');
  },
  methods: {
    close () {
      this.$emit('close');
      document.body.classList.remove('no-scroll');
    },
  }
};
</script>

<style lang="scss" scoped>
.cinemaroll-modal {
  position: fixed;
  z-index: 5;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  overflow: auto;
  background-color: rgba(0, 0, 0, 0.4);
  display: flex;
  justify-content: center;

  .cinemaroll-modal-content {
    background-color: black;
    display: flex;
    flex-direction: column;
    margin: 3%;
    max-height: calc(100vh);
    overflow: auto;
    width: 94%;

    @media screen and (min-width: 832px) {
      height: 600px;
      max-height: 80vh;
      max-width: 400px;
    }

    .cinemaroll-modal-header {
      position: relative;

      .close {
        color: white;
        font-size: 1.5rem;
        position: absolute;
        right: 0;
        top: 0;
        cursor: pointer;
        height: 40px;
        width: 40px;
        display: flex;
        justify-content: center;
        align-items: center;
        transition: background-color 0.1s, transform 0.1s;
        border-radius: 4px;

        // Mobile touch feedback
        -webkit-tap-highlight-color: rgba(255, 255, 255, 0.3);
        touch-action: manipulation;

        &:hover {
          background-color: rgba(255, 255, 255, 0.1);
        }

        &:active {
          background-color: rgba(255, 255, 255, 0.2);
          transform: scale(0.95);
        }

        // Additional mobile touch states
        @media (hover: none) and (pointer: coarse) {
          &:active {
            background-color: rgba(255, 255, 255, 0.3);
            transform: scale(0.92);
          }
        }
      }
    }

    .cinemaroll-modal-body {
      padding: 1rem;
      flex: 1;
      overflow: auto;
    }

    .cinemaroll-modal-footer {
      padding: 0 1rem 1rem;
    }
  }
}

/* Page mode: identical slots, but a real page — no floating card, no inner
   scroll cage, no ×. Declared AFTER the base styles so these override the
   boxed-modal look (feedback: "it just sort of looks like we stuck a modal
   on a page"). */
.cinemaroll-modal.page-mode {
  background: none;
  display: block;
  height: auto;
  overflow: visible;
  position: static;

  .cinemaroll-modal-content {
    background: none;
    height: auto;
    margin: 0;
    max-height: none;
    max-width: none;
    overflow: visible;
    width: 100%;

    @media screen and (min-width: 832px) {
      height: auto;
      margin: 0 auto;
      max-height: none;
      /* Wide enough to breathe as a page, still readable line lengths. */
      max-width: 640px;
    }

    .cinemaroll-modal-header .close {
      /* The page has a BackLink; the modal × would be a second, redundant
         escape hatch. */
      display: none;
    }

    .cinemaroll-modal-header {
      /* The base modal's 1rem header padding stacked with the page's own
         top spacing — most of the "way too much space below the header"
         gap (feedback, twice). 4px horizontal so header cards line up
         exactly with the body's category buttons (screen 1rem + 4px),
         per feedback; the centered title text doesn't care. */
      padding: 0 4px;
    }

    .cinemaroll-modal-body {
      overflow: visible;
      /* No top padding: the page's own header spacing is enough, and the
         double gap read as dead space (feedback). */
      padding: 0 0 1rem;
    }
  }
}

/* Add this to the global styles (e.g., in App.vue or a global stylesheet) */
.no-scroll {
  overflow: hidden;
}
</style>