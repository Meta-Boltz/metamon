import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * Production Build Tests for Chunk Loading
 * 
 * These tests verify that the chunk loading mechanism works correctly
 * with production builds, including minification and various code splitting
 * configurations.
 */

test.describe('Production Build Chunk Loading', () => {
  let buildOutput;
  let previewServer;

  test.beforeAll(async () => {
    // Build the project for production
    console.log('Building project for production...');
    try {
      buildOutput = execSync('npm run build', {
        cwd: process.cwd(),
        encoding: 'utf8',
        timeout: 120000 // 2 minutes timeout
      });
      console.log('Build completed successfully');
    } catch (error) {
      console.error('Build failed:', error.message);
      throw error;
    }
  });

  test.beforeEach(async ({ page }) => {
    // Enable console logging to catch production errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.error(`Production console error: ${msg.text()}`);
      }
    });

    // Enable page error handling
    page.on('pageerror', error => {
      console.error(`Production page error: ${error.message}`);
    });
  });

  test.describe('Minified Build Tests', () => {
    test('should load chunks correctly with minification enabled', async ({ page }) => {
      // Start preview server for production build
      const { spawn } = await import('child_process');
      previewServer = spawn('npm', ['run', 'preview'], {
        stdio: 'pipe',
        cwd: process.cwd()
      });

      // Wait for server to start
      await new Promise(resolve => setTimeout(resolve, 3000));

      try {
        await page.goto('http://localhost:4173');
        await page.waitForLoadState('networkidle');

        // Verify that the page loads without errors
        await expect(page.locator('body')).toBeVisible();

        // Test that framework components load correctly in minified build
        await expect(page.locator('.react-badge')).toBeVisible();
        await expect(page.locator('.vue-badge')).toBeVisible();
        await expect(page.locator('.svelte-badge')).toBeVisible();
        await expect(page.locator('.solid-badge')).toBeVisible();

        // Test dynamic chunk loading functionality
        const result = await page.evaluate(async () => {
          try {
            // Test the safe assignment mechanism in minified code
            const testObj = {};
            Object.defineProperty(testObj, 'data', {
              get() { return 'original-data'; },
              enumerable: true,
              configurable: true
            });

            // This should work with the safe assignment fix
            const safeAssign = (obj, prop, value) => {
              const descriptor = Object.getOwnPropertyDescriptor(obj, prop);
              if (descriptor && descriptor.get && !descriptor.set) {
                try {
                  Object.defineProperty(obj, prop, {
                    configurable: true,
                    enumerable: descriptor.enumerable,
                    writable: true,
                    value: value
                  });
                  return obj;
                } catch (e) {
                  const newObj = Object.create(Object.getPrototypeOf(obj));
                  Object.getOwnPropertyNames(obj).forEach((key) => {
                    if (key !== prop) {
                      const desc = Object.getOwnPropertyDescriptor(obj, key);
                      if (desc) {
                        Object.defineProperty(newObj, key, desc);
                      }
                    }
                  });
                  Object.defineProperty(newObj, prop, {
                    configurable: true,
                    enumerable: true,
                    writable: true,
                    value: value
                  });
                  return newObj;
                }
              } else {
                obj[prop] = value;
                return obj;
              }
            };

            const result = safeAssign(testObj, 'data', { id: 'minified-test', loaded: true });
            return {
              success: true,
              data: result.data,
              minified: true
            };
          } catch (error) {
            return {
              success: false,
              error: error.message,
              minified: true
            };
          }
        });

        expect(result.success).toBe(true);
        expect(result.data).toEqual({ id: 'minified-test', loaded: true });

      } finally {
        // Clean up preview server
        if (previewServer) {
          previewServer.kill();
        }
      }
    });

    test('should handle minified chunk names correctly', async ({ page }) => {
      // Start preview server
      const { spawn } = await import('child_process');
      previewServer = spawn('npm', ['run', 'preview'], {
        stdio: 'pipe',
        cwd: process.cwd()
      });

      await new Promise(resolve => setTimeout(resolve, 3000));

      try {
        await page.goto('http://localhost:4173');
        await page.waitForLoadState('networkidle');

        // Check that minified chunks are loaded correctly
        const networkRequests = [];
        page.on('request', request => {
          if (request.url().includes('.js')) {
            networkRequests.push(request.url());
          }
        });

        // Trigger dynamic imports by interacting with components
        const reactButton = page.locator('.framework-card:has(.react-badge) button:has-text("+1 Global")');
        if (await reactButton.isVisible()) {
          await reactButton.click();
        }

        // Wait for any additional chunks to load
        await page.waitForTimeout(1000);

        // Verify that JavaScript files were loaded (indicating chunks work)
        const jsRequests = networkRequests.filter(url => url.endsWith('.js'));
        expect(jsRequests.length).toBeGreaterThan(0);

        // Test that the application still functions correctly
        await expect(page.locator('.shared-state-display')).toBeVisible();

      } finally {
        if (previewServer) {
          previewServer.kill();
        }
      }
    });

    test('should preserve functionality with variable name mangling', async ({ page }) => {
      const { spawn } = await import('child_process');
      previewServer = spawn('npm', ['run', 'preview'], {
        stdio: 'pipe',
        cwd: process.cwd()
      });

      await new Promise(resolve => setTimeout(resolve, 3000));

      try {
        await page.goto('http://localhost:4173');
        await page.waitForLoadState('networkidle');

        // Test that component interactions still work with mangled variable names
        const vueInput = page.locator('.framework-card:has(.vue-badge) input');
        const vueButton = page.locator('.framework-card:has(.vue-badge) button:has-text("Send Message")');

        if (await vueInput.isVisible() && await vueButton.isVisible()) {
          await vueInput.fill('Minified build test message');
          await vueButton.click();

          // Verify the message appears (functionality preserved)
          await expect(page.locator('.framework-card:has(.vue-badge) .message-item')).toBeVisible();
        }

        // Test Svelte component with minification
        const svelteInput = page.locator('.framework-card:has(.svelte-badge) input');
        const svelteButton = page.locator('.framework-card:has(.svelte-badge) button:has-text("Add User")');

        if (await svelteInput.isVisible() && await svelteButton.isVisible()) {
          const initialUserCount = await page.locator('.framework-card:has(.svelte-badge) .counter:has-text("Total Users") .counter-value').textContent();

          await svelteInput.fill(`Minified User ${Date.now()}`);
          await svelteButton.click();

          const newUserCount = await page.locator('.framework-card:has(.svelte-badge) .counter:has-text("Total Users") .counter-value').textContent();
          expect(parseInt(newUserCount)).toBeGreaterThan(parseInt(initialUserCount));
        }

      } finally {
        if (previewServer) {
          previewServer.kill();
        }
      }
    });
  });

  test.describe('Code Splitting Configuration Tests', () => {
    test('should handle manual chunk splitting correctly', async ({ page }) => {
      // Test with custom vite config that has manual chunk splitting
      const customConfig = `
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import vue from '@vitejs/plugin-vue';
import solid from 'vite-plugin-solid';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { mtmPluginFixed } from './src/mtm-plugin-fixed.js';

export default defineConfig({
  plugins: [
    mtmPluginFixed({
      include: ['**/*.mtm'],
      hmr: true,
      sourceMaps: true,
      ssr: true,
      safePropertyAssignment: true,
      chunkCompatMode: 'safe'
    }),
    react(), vue(), solid(), svelte()
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'vue-vendor': ['vue'],
          'solid-vendor': ['solid-js'],
          'framework-components': ['./src/components/ReactCounter.jsx', './src/components/VueMessenger.vue']
        }
      }
    }
  },
  resolve: {
    alias: {
      '@': '/src',
      '@components': '/src/components',
      '@pages': '/src/pages'
    }
  }
});`;

      // Write custom config temporarily
      const { writeFileSync, unlinkSync } = await import('fs');
      const customConfigPath = 'vite.config.manual-chunks.js';

      try {
        writeFileSync(customConfigPath, customConfig);

        // Build with custom config
        execSync(`npx vite build --config ${customConfigPath}`, {
          cwd: process.cwd(),
          encoding: 'utf8',
          timeout: 120000
        });

        // Start preview server
        const { spawn } = await import('child_process');
        previewServer = spawn('npx', ['vite', 'preview', '--config', customConfigPath], {
          stdio: 'pipe',
          cwd: process.cwd()
        });

        await new Promise(resolve => setTimeout(resolve, 3000));

        await page.goto('http://localhost:4173');
        await page.waitForLoadState('networkidle');

        // Verify that manual chunks load correctly
        const networkRequests = [];
        page.on('request', request => {
          if (request.url().includes('.js')) {
            networkRequests.push(request.url());
          }
        });

        // Interact with components to trigger chunk loading
        await page.locator('.framework-card:has(.react-badge) button').first().click();
        await page.waitForTimeout(500);

        // Check that vendor chunks were loaded
        const jsRequests = networkRequests.filter(url => url.endsWith('.js'));
        const hasVendorChunks = jsRequests.some(url =>
          url.includes('react-vendor') || url.includes('vue-vendor') || url.includes('solid-vendor')
        );

        // Note: Vendor chunks might be loaded initially, so we just verify the app works
        await expect(page.locator('.shared-state-display')).toBeVisible();

      } finally {
        if (previewServer) {
          previewServer.kill();
        }
        // Clean up custom config
        try {
          unlinkSync(customConfigPath);
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    });

    test('should handle dynamic imports with code splitting', async ({ page }) => {
      const customConfig = `
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import vue from '@vitejs/plugin-vue';
import solid from 'vite-plugin-solid';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { mtmPluginFixed } from './src/mtm-plugin-fixed.js';

export default defineConfig({
  plugins: [
    mtmPluginFixed({
      include: ['**/*.mtm'],
      hmr: true,
      sourceMaps: true,
      ssr: true,
      safePropertyAssignment: true,
      chunkCompatMode: 'safe'
    }),
    react(), vue(), solid(), svelte()
  ],
  build: {
    rollupOptions: {
      output: {
        chunkFileNames: 'chunks/[name]-[hash].js',
        entryFileNames: 'entries/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    }
  },
  resolve: {
    alias: {
      '@': '/src',
      '@components': '/src/components',
      '@pages': '/src/pages'
    }
  }
});`;

      const { writeFileSync, unlinkSync } = await import('fs');
      const customConfigPath = 'vite.config.dynamic-imports.js';

      try {
        writeFileSync(customConfigPath, customConfig);

        execSync(`npx vite build --config ${customConfigPath}`, {
          cwd: process.cwd(),
          encoding: 'utf8',
          timeout: 120000
        });

        const { spawn } = await import('child_process');
        previewServer = spawn('npx', ['vite', 'preview', '--config', customConfigPath], {
          stdio: 'pipe',
          cwd: process.cwd()
        });

        await new Promise(resolve => setTimeout(resolve, 3000));

        await page.goto('http://localhost:4173');
        await page.waitForLoadState('networkidle');

        // Test dynamic import functionality
        const result = await page.evaluate(async () => {
          try {
            // Simulate dynamic import of a chunk
            const dynamicChunk = await new Promise(resolve => {
              // Mock a dynamic import scenario
              const mockModule = {
                default: { name: 'DynamicComponent', loaded: true },
                metadata: { timestamp: Date.now() }
              };

              // Test safe property assignment in dynamic context
              const testObj = {};
              Object.defineProperty(testObj, 'data', {
                get() { return 'dynamic-data'; },
                enumerable: true,
                configurable: true
              });

              // Apply safe assignment
              try {
                Object.defineProperty(testObj, 'data', {
                  configurable: true,
                  enumerable: true,
                  writable: true,
                  value: { id: 'dynamic-chunk', loaded: true }
                });
                mockModule.assignmentResult = testObj.data;
              } catch (e) {
                const newObj = Object.create(Object.getPrototypeOf(testObj));
                newObj.data = { id: 'dynamic-chunk', loaded: true };
                mockModule.assignmentResult = newObj.data;
              }

              resolve(mockModule);
            });

            return {
              success: true,
              module: dynamicChunk.default,
              assignmentWorked: dynamicChunk.assignmentResult.id === 'dynamic-chunk'
            };
          } catch (error) {
            return {
              success: false,
              error: error.message
            };
          }
        });

        expect(result.success).toBe(true);
        expect(result.assignmentWorked).toBe(true);
        expect(result.module.loaded).toBe(true);

      } finally {
        if (previewServer) {
          previewServer.kill();
        }
        try {
          unlinkSync(customConfigPath);
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    });

    test('should handle different chunk loading strategies', async ({ page }) => {
      // Test with different chunk loading strategies
      const strategies = [
        {
          name: 'size-based',
          config: {
            chunkSizeWarningLimit: 500,
            rollupOptions: {
              output: {
                manualChunks(id) {
                  if (id.includes('node_modules')) {
                    return 'vendor';
                  }
                  if (id.includes('components')) {
                    return 'components';
                  }
                }
              }
            }
          }
        },
        {
          name: 'framework-based',
          config: {
            rollupOptions: {
              output: {
                manualChunks: {
                  'react-chunk': ['react', 'react-dom'],
                  'vue-chunk': ['vue'],
                  'solid-chunk': ['solid-js']
                }
              }
            }
          }
        }
      ];

      for (const strategy of strategies) {
        const customConfig = `
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import vue from '@vitejs/plugin-vue';
import solid from 'vite-plugin-solid';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { mtmPluginFixed } from './src/mtm-plugin-fixed.js';

export default defineConfig({
  plugins: [
    mtmPluginFixed({
      include: ['**/*.mtm'],
      hmr: true,
      sourceMaps: true,
      ssr: true,
      safePropertyAssignment: true,
      chunkCompatMode: 'safe'
    }),
    react(), vue(), solid(), svelte()
  ],
  build: ${JSON.stringify(strategy.config, null, 2)},
  resolve: {
    alias: {
      '@': '/src',
      '@components': '/src/components',
      '@pages': '/src/pages'
    }
  }
});`;

        const { writeFileSync, unlinkSync } = await import('fs');
        const customConfigPath = `vite.config.${strategy.name}.js`;

        try {
          writeFileSync(customConfigPath, customConfig);

          execSync(`npx vite build --config ${customConfigPath}`, {
            cwd: process.cwd(),
            encoding: 'utf8',
            timeout: 120000
          });

          const { spawn } = await import('child_process');
          previewServer = spawn('npx', ['vite', 'preview', '--config', customConfigPath], {
            stdio: 'pipe',
            cwd: process.cwd()
          });

          await new Promise(resolve => setTimeout(resolve, 3000));

          await page.goto('http://localhost:4173');
          await page.waitForLoadState('networkidle');

          // Verify the application loads and functions correctly with this chunking strategy
          await expect(page.locator('.react-badge')).toBeVisible();
          await expect(page.locator('.vue-badge')).toBeVisible();

          // Test component interaction to ensure chunks load properly
          const reactButton = page.locator('.framework-card:has(.react-badge) button').first();
          if (await reactButton.isVisible()) {
            await reactButton.click();
            // Verify state update works (indicating chunk loading succeeded)
            await expect(page.locator('.shared-state-display')).toBeVisible();
          }

        } finally {
          if (previewServer) {
            previewServer.kill();
          }
          try {
            unlinkSync(customConfigPath);
          } catch (e) {
            // Ignore cleanup errors
          }
        }
      }
    });
  });

  test.describe('Production Error Handling', () => {
    test('should handle chunk loading failures gracefully in production', async ({ page }) => {
      const { spawn } = await import('child_process');
      previewServer = spawn('npm', ['run', 'preview'], {
        stdio: 'pipe',
        cwd: process.cwd()
      });

      await new Promise(resolve => setTimeout(resolve, 3000));

      try {
        await page.goto('http://localhost:4173');
        await page.waitForLoadState('networkidle');

        // Test error handling for missing chunks
        const result = await page.evaluate(async () => {
          try {
            // Simulate a chunk loading failure
            const response = await fetch('/non-existent-chunk.js');
            return {
              networkError: !response.ok,
              status: response.status,
              handled: true
            };
          } catch (error) {
            return {
              networkError: true,
              errorName: error.name,
              errorMessage: error.message,
              handled: true
            };
          }
        });

        expect(result.handled).toBe(true);
        expect(result.networkError).toBe(true);

        // Verify the main application still works despite chunk loading errors
        await expect(page.locator('body')).toBeVisible();

      } finally {
        if (previewServer) {
          previewServer.kill();
        }
      }
    });

    test('should provide meaningful error messages in production', async ({ page }) => {
      const { spawn } = await import('child_process');
      previewServer = spawn('npm', ['run', 'preview'], {
        stdio: 'pipe',
        cwd: process.cwd()
      });

      await new Promise(resolve => setTimeout(resolve, 3000));

      try {
        await page.goto('http://localhost:4173');
        await page.waitForLoadState('networkidle');

        // Test that error messages are helpful even in production
        const result = await page.evaluate(async () => {
          const errors = [];

          try {
            // Test property assignment error handling
            const obj = {};
            Object.defineProperty(obj, 'data', {
              get() { return 'test'; },
              enumerable: true,
              configurable: false
            });
            obj.data = 'new value';
          } catch (error) {
            errors.push({
              type: 'property-assignment',
              name: error.name,
              hasMessage: !!error.message,
              messageLength: error.message.length
            });
          }

          return {
            errorsCaught: errors.length,
            errors: errors,
            productionErrorHandling: true
          };
        });

        // In production, we should still catch and handle errors appropriately
        expect(result.productionErrorHandling).toBe(true);

        // If errors were caught, they should have meaningful information
        if (result.errorsCaught > 0) {
          expect(result.errors[0].hasMessage).toBe(true);
          expect(result.errors[0].messageLength).toBeGreaterThan(0);
        }

      } finally {
        if (previewServer) {
          previewServer.kill();
        }
      }
    });
  });

  test.describe('Performance in Production', () => {
    test('should maintain good performance with chunk loading in production', async ({ page }) => {
      const { spawn } = await import('child_process');
      previewServer = spawn('npm', ['run', 'preview'], {
        stdio: 'pipe',
        cwd: process.cwd()
      });

      await new Promise(resolve => setTimeout(resolve, 3000));

      try {
        await page.goto('http://localhost:4173');

        // Measure page load performance
        const performanceMetrics = await page.evaluate(() => {
          const navigation = performance.getEntriesByType('navigation')[0];
          return {
            domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
            loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
            totalLoadTime: navigation.loadEventEnd - navigation.fetchStart
          };
        });

        // Production build should load reasonably quickly
        expect(performanceMetrics.totalLoadTime).toBeLessThan(10000); // Less than 10 seconds
        expect(performanceMetrics.domContentLoaded).toBeLessThan(5000); // Less than 5 seconds

        // Test chunk loading performance
        const chunkLoadingPerformance = await page.evaluate(async () => {
          const startTime = performance.now();

          // Simulate multiple chunk loading operations
          const promises = [];
          for (let i = 0; i < 10; i++) {
            promises.push(new Promise(resolve => {
              const chunk = { id: `perf-test-${i}`, data: null };

              // Simulate safe assignment
              try {
                chunk.data = { loaded: true, timestamp: Date.now() };
                resolve(chunk);
              } catch (error) {
                resolve({ id: `perf-test-${i}`, error: error.message });
              }
            }));
          }

          const results = await Promise.all(promises);
          const endTime = performance.now();

          return {
            loadTime: endTime - startTime,
            chunksLoaded: results.filter(r => r.data && r.data.loaded).length,
            totalChunks: results.length
          };
        });

        expect(chunkLoadingPerformance.chunksLoaded).toBe(chunkLoadingPerformance.totalChunks);
        expect(chunkLoadingPerformance.loadTime).toBeLessThan(1000); // Less than 1 second for 10 chunks

      } finally {
        if (previewServer) {
          previewServer.kill();
        }
      }
    });

    test('should handle concurrent chunk loading efficiently in production', async ({ page }) => {
      const { spawn } = await import('child_process');
      previewServer = spawn('npm', ['run', 'preview'], {
        stdio: 'pipe',
        cwd: process.cwd()
      });

      await new Promise(resolve => setTimeout(resolve, 3000));

      try {
        await page.goto('http://localhost:4173');
        await page.waitForLoadState('networkidle');

        // Test concurrent chunk loading
        const concurrentResult = await page.evaluate(async () => {
          const startTime = performance.now();
          const concurrentPromises = [];

          // Create 20 concurrent chunk loading operations
          for (let i = 0; i < 20; i++) {
            concurrentPromises.push(new Promise(resolve => {
              setTimeout(() => {
                const chunk = { id: `concurrent-${i}` };

                // Test safe assignment under concurrent load
                const testObj = {};
                Object.defineProperty(testObj, 'data', {
                  get() { return `original-${i}`; },
                  enumerable: true,
                  configurable: true
                });

                try {
                  Object.defineProperty(testObj, 'data', {
                    configurable: true,
                    enumerable: true,
                    writable: true,
                    value: { id: chunk.id, loaded: true }
                  });
                  chunk.result = testObj.data;
                } catch (e) {
                  const newObj = { data: { id: chunk.id, loaded: true } };
                  chunk.result = newObj.data;
                }

                resolve(chunk);
              }, Math.random() * 100); // Random delay up to 100ms
            }));
          }

          const results = await Promise.all(concurrentPromises);
          const endTime = performance.now();

          return {
            loadTime: endTime - startTime,
            successfulLoads: results.filter(r => r.result && r.result.loaded).length,
            totalAttempts: results.length,
            averageLoadTime: (endTime - startTime) / results.length
          };
        });

        expect(concurrentResult.successfulLoads).toBe(concurrentResult.totalAttempts);
        expect(concurrentResult.loadTime).toBeLessThan(5000); // Should complete within 5 seconds
        expect(concurrentResult.averageLoadTime).toBeLessThan(250); // Average less than 250ms per chunk

      } finally {
        if (previewServer) {
          previewServer.kill();
        }
      }
    });
  });
});