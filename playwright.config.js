import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 45000,
  workers: 2,
  globalSetup: './e2e/global-setup.js',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  projects: [
    { name: 'mobile-360', testIgnore: 'browser-smoke.spec.js', use: { ...devices['Pixel 5'], viewport: { width: 360, height: 800 } } },
    { name: 'mobile-390', testIgnore: 'browser-smoke.spec.js', use: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true } },
    { name: 'mobile-430', testIgnore: 'browser-smoke.spec.js', use: { viewport: { width: 430, height: 932 }, hasTouch: true, isMobile: true } },
    { name: 'desktop-1280', testIgnore: 'browser-smoke.spec.js', use: { viewport: { width: 1280, height: 800 } } },
    { name: 'firefox-smoke', testMatch: ['browser-smoke.spec.js', 'projects-*.spec.js'], use: { browserName: 'firefox', viewport: { width: 1280, height: 800 } } },
    { name: 'webkit-smoke', testMatch: ['browser-smoke.spec.js', 'projects-*.spec.js'], use: { browserName: 'webkit', viewport: { width: 1280, height: 800 } } }
  ]
});
