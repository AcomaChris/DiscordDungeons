import { defineConfig } from 'vitest/config';

// Strip shebang lines (#!...) so Vite can parse Node CLI scripts imported by tests
const stripShebang = {
  name: 'strip-shebang',
  transform(code) {
    if (code.startsWith('#!')) return code.replace(/^#![^\n]*\n?/, '');
  },
};

export default defineConfig({
  plugins: [stripShebang],
  test: {
    include: ['tests/**/*.test.js'],
    testTimeout: 30000,
    pool: 'forks',
  },
});
