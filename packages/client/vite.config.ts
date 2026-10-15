import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// BASE_PATH is set by the GitHub Pages workflow (the site lives under /VIKEGAME/).
export default defineConfig({
  base: process.env.BASE_PATH ?? './',
  plugins: [react()],
  build: {
    target: 'es2022',
    sourcemap: false,
    // Three.js alone is ~700 KB minified (≈180 KB gzip); the real budget is enforced by scripts/check-size.mjs.
    chunkSizeWarningLimit: 1000,
  },
});
