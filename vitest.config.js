import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.test.js',
        '**/*.spec.js',
        'dist/',
        'coverage/',
        '*.config.js'
      ]
    },
    // Suppress console warnings in tests
    silent: false,
    onConsoleLog: (log, type) => {
      // Suppress Sass deprecation warnings
      if (log.includes('DEPRECATION WARNING: The legacy JS API is deprecated')) {
        return false
      }
      return true
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src')
    }
  }
})