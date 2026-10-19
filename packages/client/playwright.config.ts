import { defineConfig, devices } from '@playwright/test';

// Locally a pre-installed Chromium can be used with PW_CHROMIUM_PATH=/path/to/chrome.
const executablePath = process.env.PW_CHROMIUM_PATH;

// GitHub's runners draw the 3D map in software, several times slower than a phone: give them time.
const slow = process.env.CI ? 3 : 1;

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000 * slow,
  expect: { timeout: 5_000 * slow },
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    ...devices['Pixel 7'],
    locale: 'en-US',
    launchOptions: {
      ...(executablePath ? { executablePath } : {}),
      // Software WebGL so the test also runs on CI machines without a GPU.
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
    },
  },
  webServer: {
    command: 'npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
