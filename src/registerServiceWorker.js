/* eslint-disable no-console */

import { register } from 'register-service-worker';
import ErrorLogService from './services/ErrorLogService';
import store from './store/index';

if (process.env.NODE_ENV === 'production') {
  register(`${process.env.BASE_URL}service-worker.js`, {
    ready () {
      console.log('App is being served from cache by a service worker.');
    },
    registered () {
      console.log('Service worker has been registered.');
    },
    cached () {
      console.log('Content has been cached for offline use.');
    },
    updatefound () {
      console.log('New content is downloading.');
    },
    updated () {
      // Bug report (Jul 2026): this used to call window.location.reload()
      // unconditionally - the moment a new version finished installing in
      // the background (which App.vue actively checks for from several
      // triggers), it force-reloaded the page out from under whatever the
      // user was doing, mid-task, with no warning. Most visibly broke the
      // box office backfill button (a long-running operation gives a
      // background update check plenty of time to land mid-run) but could
      // have hit anything - typing a rating, browsing, anything. Now just
      // flags it; UpdateAvailableBanner.vue shows a small prompt so the
      // user reloads on their own terms instead.
      console.log('New content is available.');
      store.commit('setUpdateAvailable', true);
    },
    offline () {
      console.log('No internet connection found. App is running in offline mode.');
    },
    error (error) {
      console.error('Error during service worker registration:', error);
      ErrorLogService.error('Error during service worker registration:', error);
    }
  });
}
