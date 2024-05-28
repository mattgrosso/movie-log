<template>
  <div v-if="show" class="cinemaroll-modal">
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
    }
  },
  watch: {
    show (value) {
      document.body.style.overflow = value ? 'hidden' : '';
    }
  },
  methods: {
    close () {
      this.$emit('close');
    },
  }
};
</script>

<style lang="scss" scoped>
.cinemaroll-modal {
  $modal-footer-height: 60px;

  position: fixed;
  z-index: 5;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  overflow: auto;
  background-color: rgba(0, 0, 0, 0.4);

  .cinemaroll-modal-content {
    background-color: black;
    margin: 3%;
    width: 94%;
    max-height: 97vh;
    overflow: auto;
    display: flex;
    flex-direction: column;

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
      }
    }

    .cinemaroll-modal-body {
      padding: 1rem;
      flex: 1;
      overflow: auto;
    }

    .cinemaroll-modal-footer {
      height: $modal-footer-height;
    }
  }
}
</style>