<template>
  <div v-if="show" class="insetBrowserModal">
    <div class="modal-content">
      <span class="close" @click="close">&times;</span>
      <iframe :src="url" width="100%" height="100%"/>
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
    url: {
      type: String,
      required: true,
    },
  },
  methods: {
    close() {
      this.$emit('close');
    },
  },
};
</script>

<style lang="scss" scoped>
.insetBrowserModal {
  background-color: rgba(0,0,0,0.4);
  height: 100%;
  left: 0;
  overflow: auto;
  position: fixed;
  top: 0;
  width: 100%;
  z-index: 5;

  .modal-content {
    background-color: #fefefe;
    height: 95%;
    margin: 2.5% auto;
    padding: 12px;
    width: 95%;
    
    .close {
      align-items: center;
      background: white;
      border-radius: 50%;
      border: 1px solid black;
      color: black;
      cursor: pointer;
      display: flex;
      font-size: 12px;
      height: 24px;
      justify-content: center;
      position: absolute;
      right: 13px;
      top: 13px;
      width: 24px;

      &:hover,
      &:focus {
        font-weight: bold;
      }
    }

    iframe {
      margin-top: 36px;
    }
  }
}
</style>