<template>
  <div v-if="show" class="movie-log-modal">
    <div class="modal-content">
      <div class="modal-header">
        <span class="close" @click="close">&times;</span>
        <slot name="header"></slot>
      </div>
      <div class="modal-body">
        <slot name="body"></slot>
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
.movie-log-modal {
  position: fixed;
  z-index: 5;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  overflow: auto;
  background-color: rgba(0, 0, 0, 0.4);

  .modal-content {
    background-color: white;
    margin: 3%;
    width: 94%;
    height: 97vh;

    .modal-header {
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

    .modal-body {
      padding: 1rem;
      display: flex;
      height: 100%;
      margin-bottom: 36px;
      overflow: auto;
    }
  }
}
</style>