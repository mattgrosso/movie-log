<template>
  <div class="header col-12 d-flex justify-content-center align-items-center">
    <div class="settings" @click="openSettings">
      <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" class="bi bi-gear-wide-connected" viewBox="0 0 16 16">
        <path d="M7.068.727c.243-.97 1.62-.97 1.864 0l.071.286a.96.96 0 0 0 1.622.434l.205-.211c.695-.719 1.888-.03 1.613.931l-.08.284a.96.96 0 0 0 1.187 1.187l.283-.081c.96-.275 1.65.918.931 1.613l-.211.205a.96.96 0 0 0 .434 1.622l.286.071c.97.243.97 1.62 0 1.864l-.286.071a.96.96 0 0 0-.434 1.622l.211.205c.719.695.03 1.888-.931 1.613l-.284-.08a.96.96 0 0 0-1.187 1.187l.081.283c.275.96-.918 1.65-1.613.931l-.205-.211a.96.96 0 0 0-1.622.434l-.071.286c-.243.97-1.62.97-1.864 0l-.071-.286a.96.96 0 0 0-1.622-.434l-.205.211c-.695.719-1.888.03-1.613-.931l.08-.284a.96.96 0 0 0-1.186-1.187l-.284.081c-.96.275-1.65-.918-.931-1.613l.211-.205a.96.96 0 0 0-.434-1.622l-.286-.071c-.97-.243-.97-1.62 0-1.864l.286-.071a.96.96 0 0 0 .434-1.622l-.211-.205c-.719-.695-.03-1.888.931-1.613l.284.08a.96.96 0 0 0 1.187-1.186l-.081-.284c-.275-.96.918-1.65 1.613-.931l.205.211a.96.96 0 0 0 1.622-.434l.071-.286zM12.973 8.5H8.25l-2.834 3.779A4.998 4.998 0 0 0 12.973 8.5zm0-1a4.998 4.998 0 0 0-7.557-3.779l2.834 3.78h4.723zM5.048 3.967c-.03.021-.058.043-.087.065l.087-.065zm-.431.355A4.984 4.984 0 0 0 3.002 8c0 1.455.622 2.765 1.615 3.678L7.375 8 4.617 4.322zm.344 7.646.087.065-.087-.065z"/>
      </svg>
    </div>
    <a href="/" target="_top">
      Movie Log
    </a>
  </div>
</template>

<script>
export default {
  methods: {
    openSettings () {
      this.$emit('openSettings');
    }
  },
}
</script>

<style lang="scss">
  .header {
    background-image: url('https://live.staticflickr.com/65535/47980547206_7a02cb7f3f_h.jpg');
    background-size: contain;
    overflow: hidden;
    position: relative;

    .settings {
      align-items: center;
      background: black;
      bottom: -7px;
      display: flex;
      justify-content: center;
      padding: 6px 50px 12px;
      position: absolute;
      right: -47px;
      transform: rotate(-45deg);

      svg {
        color: white;
        height: 24px;
        width: 24px;
      }
    }

    a {
      background-color: black;
      border-radius: 100px;
      border: 3px solid white;
      color: white;
      font-family: 'Anton', sans-serif;
      font-size: 2rem;
      margin: 48px 0;
      padding: 12px 48px;
      text-decoration: none;
    }
  }
</style>
