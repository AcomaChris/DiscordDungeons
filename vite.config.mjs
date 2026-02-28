import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: 'client',
  // AGENT: BASE_PATH is set by GitHub Actions for Pages deployment.
  // Local dev uses '/' so assets resolve correctly on localhost.
  base: process.env.BASE_PATH || '/',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'client/index.html'),
        devlog: resolve(__dirname, 'client/devlog.html'),
      },
    },
  },
  server: {
    port: 8080,
  },
});
