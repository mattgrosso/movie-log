// ESLint 9 flat config.
//
// Replaces the old eslintrc (`eslintConfig` in package.json) which ran through
// @vue/cli-plugin-eslint — that plugin is ESLint-8-only and crashed on ESLint 9.
// Lint now runs eslint directly (see `lint`/`lint:fix` scripts). The previous
// `@vue/eslint-config-standard` (standard + eslint-plugin-n/import) is dropped:
// it's unmaintained and eslintrc-only. The codebase was already auto-fixed under
// standard, so the few correctness rules worth keeping are re-declared below.

const js = require('@eslint/js');
const vue = require('eslint-plugin-vue');
const promise = require('eslint-plugin-promise');
const globals = require('globals');

module.exports = [
  {
    // Replaces .eslintignore. Build output, vendored snapshots, coverage, and
    // the generated service worker are not linted.
    ignores: [
      'dist/**',
      'node_modules/**',
      '.history/**',
      'coverage/**',
      'public/**',
      'aws-lambda/**', // separate AWS Lambda deployable, own style — not linted (matches prior vue-cli scope)
      'src/registerServiceWorker.js',
    ],
  },

  js.configs.recommended,
  ...vue.configs['flat/essential'], // flat configs default to Vue 3
  promise.configs['flat/recommended'], // a single config object, not an array

  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      // --- carried over verbatim from the old eslintrc ---
      'vue/no-unused-components': 'off',
      'vue/multi-word-component-names': 'off',
      'vue/no-deprecated-slot-scope-attribute': 'warn',
      'no-trailing-spaces': 'warn',
      'eol-last': 'off',
      quotes: ['off', 'double'],
      semi: 'off',
      'comma-dangle': 'off',
      'space-before-function-paren': 'warn',
      indent: ['warn', 2, { SwitchCase: 1 }], // match the codebase's 2-space style (standard's old setting)
      'no-undef': 'warn',
      'padded-blocks': ['warn', 'never'], // standard style: no blank line padding inside blocks
      'object-curly-spacing': ['warn', 'always'], // standard style: { foo } not {foo}
      'array-bracket-spacing': ['warn', 'never'],
      'no-unused-vars': 'warn',
      'no-empty': 'warn',
      'prefer-const': 'warn',
      'no-multiple-empty-lines': 'warn',
      'no-useless-return': 'off',
      'no-debugger': 'warn',
      'space-infix-ops': 'warn',
      'space-before-blocks': 'warn',
      'no-unreachable': 'warn',
      'no-constant-condition': 'warn',

      // --- high-value correctness rules preserved from `standard` ---
      // (codebase already complies, so these add safety without churn)
      eqeqeq: ['warn', 'smart'],
      'no-var': 'warn',
      'brace-style': ['warn', '1tbs', { allowSingleLine: true }], // standard allows single-line blocks
    },
  },

  {
    // Vitest test files: allow the globals exposed by `globals: true` in
    // vitest.config.js (most tests import them, but not all).
    files: ['src/test/**/*.{js,vue}'],
    languageOptions: {
      globals: {
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        vi: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        test: 'readonly',
      },
    },
  },
];
