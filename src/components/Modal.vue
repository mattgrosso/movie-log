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
  unmounted () {
    document.body.style.overflow = '';
  },
  methods: {
    close () {
      this.$emit('close');
      document.body.style.overflow = '';
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
    max-height: 75vh;
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
</style>