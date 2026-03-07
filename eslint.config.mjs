import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default [
  {
    ignores: ['dist/', 'assets/', '.claude/', 'docs/.vitepress/'],
  },
  js.configs.recommended,
  prettier,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // Root config files run in Node.js
    files: ['*.config.mjs'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  {
    // Test files run in Node.js via Vitest (some use jsdom for browser globals)
    files: ['tests/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
  },
  {
    // Build/generation scripts run in Node.js
    files: ['scripts/**/*.js', 'scripts/**/*.mjs'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  {
    // Client code runs in the browser
    files: ['client/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.browser,
        // Vite build-time constants (injected via `define` in vite.config.mjs)
        __APP_VERSION__: 'readonly',
        __GIT_COMMIT__: 'readonly',
        __BUILD_TIME__: 'readonly',
        __BE_API_KEY__: 'readonly',
        __BE_PROJECT_ID__: 'readonly',
      },
    },
  },
  {
    // Server-side scripts run in Node.js
    files: ['server/**/*.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
      },
    },
  },
  {
    // n8n Code nodes have implicit globals ($input, $env, etc.)
    files: ['server/src/code/**/*.js'],
    rules: {
      'no-undef': 'off',
    },
  },
];
