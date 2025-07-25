import { defineConfig, devices } from '@playwright/test';

/**
 * Browser Compatibility Test Configuration
 * 
 * This configuration is specifically designed for comprehensive browser
 * compatibility testing of the chunk loading mechanism.
 */

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/chunk-loading-browser-compatibility.spec.js',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 3 : 1, // More retries for browser compatibility tests
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: 'test-results/browser-compatibility' }],
    ['json', { outputFile: 'test-results/browser-compatibility-results.json' }],
    ['list']
  ],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // Increase timeout for browser compatibility tests
    actionTimeout: 10000,
    navigationTimeout: 30000
  },

  projects: [
    // Desktop Chrome - Latest
    {
      name: 'chrome-latest',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome'
      },
    },

    // Desktop Chrome - Stable
    {
      name: 'chrome-stable',
      use: {
        ...devices['Desktop Chrome']
      },
    },

    // Desktop Firefox - Latest
    {
      name: 'firefox-latest',
      use: {
        ...devices['Desktop Firefox']
      },
    },

    // Desktop Safari - WebKit
    {
      name: 'safari-webkit',
      use: {
        ...devices['Desktop Safari']
      },
    },

    // Mobile Chrome
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 5']
      },
    },

    // Mobile Safari
    {
      name: 'mobile-safari',
      use: {
        ...devices['iPhone 12']
      },
    },

    // Edge (Chromium-based)
    {
      name: 'edge',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'msedge'
      },
    },

    // Older browser simulation (Chrome 90)
    {
      name: 'chrome-legacy',
      use: {
        ...devices['Desktop Chrome'],
        // Simulate older Chrome version behavior
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36'
      },
    }
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000 // 2 minutes for server startup
  },

  // Global test timeout
  timeout: 60000,

  // Expect timeout for assertions
  expect: {
    timeout: 10000
  }
});