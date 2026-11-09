import { test as base, expect } from '@playwright/test';
import { installStoryDiagnostics } from '../scripts/story-diagnostics.js';

export const test = base.extend({
  storyDiagnostics: [true, { option: true }],
  diagnostics: [async ({ page, storyDiagnostics }, use, testInfo) => {
    if (storyDiagnostics) await page.addInitScript(installStoryDiagnostics);
    const events = [];
    page.on('requestfailed', request => events.push({
      type: 'request', url: request.url(), method: request.method(), error: request.failure()?.errorText
    }));
    page.on('console', message => {
      if (message.type() === 'error') events.push({ type: 'console', text: message.text(), location: message.location() });
    });
    page.on('pageerror', error => events.push({ type: 'exception', text: error.message, stack: error.stack }));
    await use();
    if (testInfo.status !== testInfo.expectedStatus) {
      await testInfo.attach('browser-errors', { body: JSON.stringify(events, null, 2), contentType: 'application/json' });
    }
  }, { auto: true }]
});

export { expect };
