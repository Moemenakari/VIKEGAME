import { execSync } from 'node:child_process';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/** Which update this is (shown in Settings): the commit on Vercel, else the local git head. */
function buildId(): string {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA;
  if (sha) return sha.slice(0, 7);
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    return 'dev';
  }
}

// BASE_PATH is set by the GitHub Pages workflow (the site lives under /VIKEGAME/).
export default defineConfig({
  base: process.env.BASE_PATH ?? './',
  plugins: [react()],
  define: {
    __BUILD_ID__: JSON.stringify(buildId()),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 16).replace('T', ' ')),
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    // Three.js alone is ~700 KB minified (≈180 KB gzip); the real budget is enforced by scripts/check-size.mjs.
    chunkSizeWarningLimit: 1000,
  },
});
