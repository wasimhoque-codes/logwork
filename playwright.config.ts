import { defineConfig, devices } from '@playwright/test';
const externalPreview = process.env.PW_BASE_URL;
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  workers: 2,
  use: { baseURL: externalPreview ?? 'http://127.0.0.1:4174', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
  ],
  // An external preview can serve an exact build copy outside cloud-backed folders.
  webServer: externalPreview ? undefined : { command: 'npm run preview -- --port 4174', url: 'http://127.0.0.1:4174', reuseExistingServer: !process.env.CI },
});
