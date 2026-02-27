import { defineConfig } from 'vite';

export default defineConfig({
  root: 'client',
  // AGENT: BASE_PATH is set by GitHub Actions for Pages deployment.
  // Local dev uses '/' so assets resolve correctly on localhost.
  base: process.env.BASE_PATH || '/',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  server: {
    port: 8080,
  },
});
