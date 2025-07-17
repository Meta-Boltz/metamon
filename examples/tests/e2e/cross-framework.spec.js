import { test, expect } from '@playwright/test';

test.describe('Cross-Framework Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should load all framework components', async ({ page }) => {
    // Check that all framework components are present
    await expect(page.locator('.react-badge')).toBeVisible();
    await expect(page.locator('.vue-badge')).toBeVisible();
    await expect(page.locator('.solid-badge')).toBeVisible();
    await expect(page.locator('.svelte-badge')).toBeVisible();

    // Verify component content is loaded
    await expect(page.locator('text=Counter Component')).toBeVisible();
    await expect(page.locator('text=Message Board')).toBeVisible();
    await expect(page.locator('text=Theme Toggle')).toBeVisible();
    await expect(page.locator('text=User Management')).toBeVisible();
  });

  test('should share state via signals across frameworks', async ({ page }) => {
    // Get initial global count
    const initialCount = await page.locator('.shared-state-display .metric-value').first().textContent();
    
    // Click React counter increment button
    await page.locator('.framework-card:has(.react-badge) button:has-text("+1 Global")').click();
    
    // Verify global count updated in shared state display
    await expect(page.locator('.shared-state-display .metric-value').first()).not.toHaveText(initialCount);
    
    // Verify Svelte component shows updated count
    const svelteGlobalCount = await page.locator('.framework-card:has(.svelte-badge) .counter:has-text("Total Users") .counter-value').textContent();
    expect(parseInt(svelteGlobalCount)).toBeGreaterThan(parseInt(initialCount));
  });

  test('should communicate via pub/sub events', async ({ page }) => {
    // Add a user in Svelte component
    await page.locator('.framework-card:has(.svelte-badge) input').fill('Test User');
    await page.locator('.framework-card:has(.svelte-badge) button:has-text("Add User")').click();
    
    // Check that Vue message board received the event
    await expect(page.locator('.framework-card:has(.vue-badge) .message-item')).toBeVisible();
    await expect(page.locator('text=Svelte performed: add_user')).toBeVisible();
  });

  test('should handle theme changes across frameworks', async ({ page }) => {
    // Click theme toggle in Solid component
    await page.locator('.framework-card:has(.solid-badge) button:has-text("Switch to Dark")').click();
    
    // Verify theme updated in shared state
    await expect(page.locator('.shared-state-display .state-item:has-text("Theme") .metric-value')).toHaveText('dark');
    
    // Verify visual theme change applied
    const bodyFilter = await page.evaluate(() => document.body.style.filter);
    expect(bodyFilter).toContain('invert');
  });

  test('should handle routing between pages', async ({ page }) => {
    // Navigate to performance page
    await page.goto('/performance');
    await expect(page.locator('h1:has-text("Performance Benchmarks")')).toBeVisible();
    
    // Navigate to documentation page
    await page.goto('/docs');
    await expect(page.locator('h1:has-text("Documentation & Examples")')).toBeVisible();
    
    // Navigate back to home
    await page.goto('/');
    await expect(page.locator('h1:has-text("Metamon Framework Demo")')).toBeVisible();
  });

  test('should run performance benchmarks', async ({ page }) => {
    await page.goto('/performance');
    
    // Run benchmarks
    await page.locator('button:has-text("Run Benchmarks")').click();
    
    // Wait for benchmarks to complete
    await page.waitForSelector('.metric-card', { timeout: 10000 });
    
    // Verify benchmark results are displayed
    await expect(page.locator('.metric-card')).toHaveCount(4);
    await expect(page.locator('text=Signal Updates')).toBeVisible();
    await expect(page.locator('text=PubSub Events')).toBeVisible();
    await expect(page.locator('text=Component Renders')).toBeVisible();
    await expect(page.locator('text=Cross-Framework Communication')).toBeVisible();
  });

  test('should handle complex cross-framework interactions', async ({ page }) => {
    // Perform multiple actions across different frameworks
    
    // 1. Increment React counter
    await page.locator('.framework-card:has(.react-badge) button:has-text("+1 Global")').click();
    
    // 2. Add user in Svelte
    await page.locator('.framework-card:has(.svelte-badge) input').fill('Integration Test User');
    await page.locator('.framework-card:has(.svelte-badge) button:has-text("Add User")').click();
    
    // 3. Send message in Vue
    await page.locator('.framework-card:has(.vue-badge) input').fill('Hello from Vue!');
    await page.locator('.framework-card:has(.vue-badge) button:has-text("Send Message")').click();
    
    // 4. Toggle theme in Solid
    await page.locator('.framework-card:has(.solid-badge) button:has-text("Switch to Dark")').click();
    
    // Verify all changes are reflected
    await expect(page.locator('.shared-state-display .state-item:has-text("Active Users") .metric-value')).not.toHaveText('0');
    await expect(page.locator('.shared-state-display .state-item:has-text("Messages") .metric-value')).not.toHaveText('0');
    await expect(page.locator('.shared-state-display .state-item:has-text("Theme") .metric-value')).toHaveText('dark');
    
    // Verify Vue message board shows all events
    const messageItems = await page.locator('.framework-card:has(.vue-badge) .message-item').count();
    expect(messageItems).toBeGreaterThan(3); // Should have multiple system messages + user message
  });

  test('should handle component cleanup properly', async ({ page }) => {
    // Navigate away and back to test cleanup
    await page.goto('/performance');
    await page.goto('/docs');
    await page.goto('/');
    
    // Verify components still work after navigation
    await page.locator('.framework-card:has(.react-badge) button:has-text("+1 Global")').click();
    
    // Should not have memory leaks or duplicate event listeners
    const globalCount = await page.locator('.shared-state-display .metric-value').first().textContent();
    expect(parseInt(globalCount)).toBeGreaterThan(0);
  });
});

test.describe('Documentation Page', () => {
  test('should display all framework examples', async ({ page }) => {
    await page.goto('/docs');
    
    // Test navigation between sections
    await page.locator('button:has-text("React")').click();
    await expect(page.locator('h2:has-text("React Examples")')).toBeVisible();
    
    await page.locator('button:has-text("Vue")').click();
    await expect(page.locator('h2:has-text("Vue Examples")')).toBeVisible();
    
    await page.locator('button:has-text("Solid")').click();
    await expect(page.locator('h2:has-text("Solid Examples")')).toBeVisible();
    
    await page.locator('button:has-text("Svelte")').click();
    await expect(page.locator('h2:has-text("Svelte Examples")')).toBeVisible();
    
    await page.locator('button:has-text("Best Practices")').click();
    await expect(page.locator('h2:has-text("Best Practices")')).toBeVisible();
  });
});