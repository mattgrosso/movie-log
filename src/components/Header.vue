<template>
  <div class="header col-12 d-flex justify-content-center align-items-center">
    <a href="/" target="_top">
      Movie Log
    </a>
  </div>
</template>

<script>
export default {

}
</script>

<style lang="scss">
  .header {
    background-image: url('https://live.staticflickr.com/65535/47980547206_7a02cb7f3f_h.jpg');
    background-size: contain;

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
