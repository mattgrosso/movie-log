const { defineConfig } = require('@vue/cli-service');
const webpack = require('webpack');

// The house build stamp (see `src/assets/javascript/buildStamp.js`).
//
// This file is evaluated once per build, after vue-cli has loaded `.env`, so
// assigning here stamps the moment THIS bundle was built — not the moment the
// page was loaded, which is the whole point: a tab left open for a week keeps
// showing the build it is still running. The `VUE_APP_` prefix is what gets it
// into the client bundle; vue-cli's DefinePlugin picks up every such variable
// present in `process.env` when it builds the webpack config, which happens
// after this module runs. `VUE_APP_VERSION` comes from `.env` and is bumped by
// `yarn deploy` — untouched here.
process.env.VUE_APP_BUILD_TIME = new Date().toISOString();

module.exports = defineConfig({
  transpileDependencies: true,
  configureWebpack: {
    plugins: [
      new webpack.BannerPlugin({
        banner: `Current version: ${process.env.VUE_APP_VERSION}`,
        raw: true,
        entryOnly: true,
        include: /service-worker\.js$/,
      }),
    ],
  },
  pwa: {
    name: 'Cinema Roll',
    themeColor: '#ffffff',
    msTileColor: '#ffffff',
    appleMobileWebAppCapable: 'yes',
    appleMobileWebAppStatusBarStyle: 'black',
    manifestOptions: {
      display: 'standalone',
      background_color: '#ffffff',
      icons: [
        {
          src: './img/icons/android-chrome-192x192.png',
          sizes: '192x192',
          type: 'image/png',
        },
        {
          src: './img/icons/android-chrome-512x512.png',
          sizes: '512x512',
          type: 'image/png',
        },
        {
          src: './img/icons/android-chrome-maskable-192x192.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'maskable',
        },
        {
          src: './img/icons/android-chrome-maskable-512x512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        },
      ],
    },
    workboxOptions: {
      skipWaiting: true,
      clientsClaim: true,
      // Push notification handlers (public/push-sw.js) — GenerateSW mode has
      // no hand-written worker to edit, so extra behaviour rides in via
      // importScripts. The file is copied from public/ as-is, so the name
      // here must match its real path in dist/.
      importScripts: ['push-sw.js'],
      // Posters/backdrops: keep whatever's been seen (or proactively warmed
      // via the Settings "Download for offline" action) available without a
      // network round-trip. CacheFirst since a given TMDB image path never
      // changes content. 3000 entries covers the full library (~1,300
      // movies) plus headroom for larger posters/backdrops shown on
      // MovieDetail; 90 days keeps storage bounded without evicting mid-use.
      runtimeCaching: [
        {
          urlPattern: /^https:\/\/image\.tmdb\.org\/t\/p\//,
          handler: 'CacheFirst',
          options: {
            cacheName: 'tmdb-images',
            expiration: {
              maxEntries: 3000,
              maxAgeSeconds: 60 * 60 * 24 * 90,
            },
            cacheableResponse: {
              statuses: [0, 200],
            },
          },
        },
        {
          urlPattern: /^https:\/\/fonts\.googleapis\.com\//,
          handler: 'StaleWhileRevalidate',
          options: {
            cacheName: 'google-fonts-stylesheets',
          },
        },
        {
          urlPattern: /^https:\/\/fonts\.gstatic\.com\//,
          handler: 'CacheFirst',
          options: {
            cacheName: 'google-fonts-webfonts',
            expiration: {
              maxEntries: 30,
              maxAgeSeconds: 60 * 60 * 24 * 365,
            },
            cacheableResponse: {
              statuses: [0, 200],
            },
          },
        },
      ],
    },
  },
  css: {
    loaderOptions: {
      sass: {
        // Use the new API
        implementation: require('sass'),
      },
    },
  },
  lintOnSave: false, // Disable linting on save
})