import { defineConfig, devices } from '@playwright/test';

// Locally a pre-installed Chromium can be used with PW_CHROMIUM_PATH=/path/to/chrome.
const executablePath = process.env.PW_CHROMIUM_PATH;

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    ...devices['Pixel 7'],
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
