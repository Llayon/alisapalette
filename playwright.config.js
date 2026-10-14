import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 45000,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'off'
  },
  webServer: {
    command: 'node node_modules/vite/bin/vite.js preview --port 4173 --strictPort --host 127.0.0.1',
    url: 'http://127.0.0.1:4173/',
    reuseExistingServer: false,
    timeout: 60000
  },
  projects: [
    { name: 'mobile-360', use: { ...devices['Pixel 5'], viewport: { width: 360, height: 800 } } },
    { name: 'mobile-390', use: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true } },
    { name: 'mobile-430', use: { viewport: { width: 430, height: 932 }, hasTouch: true, isMobile: true } },
    { name: 'desktop-1280', use: { viewport: { width: 1280, height: 800 } } }
  ]
});
