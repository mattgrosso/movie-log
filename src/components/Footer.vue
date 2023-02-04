<template>
  <footer class="col-12 d-flex justify-content-center align-items-center">
    &copy; {{new Date().getFullYear()}} - Brian Goegan Incorporated
  </footer>
</template>

<script>
export default {

}
</script>

<style lang="scss">
  footer {
    background: #0d6efd;
    bottom: 0;
    color: white;
    font-size: 0.6rem;
    padding: 3px 12px;
    position: fixed;
  }
</style>