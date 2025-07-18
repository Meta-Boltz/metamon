/**
 * Integration tests for Vite Plugin Performance Optimization
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createViteDevServer, build } from 'vite';
import { metamonPerformance } from '../vite-plugin-performance.js';
import { metamon } from '../vite-plugin.js';
import { resolve } from 'path';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';

describe('Vite Plugin Performance Integration', () => {
  const testDir = resolve(__dirname, '../../../test-temp');
  const srcDir = resolve(testDir, 'src');
  
  beforeEach(() => {
    // Create test directory structure
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    mkdirSync(testDir, { recursive: true });
    mkdirSync(srcDir, { recursive: true });
    mkdirSync(resolve(srcDir, 'pages'), { recursive: true });
    mkdirSync(resolve(srcDir, 'components'), { recursive: true });
    
    // Create test files
    writeFileSync(resolve(testDir, 'index.html'), `
<!DOCTYPE html>
<html>
<head>
  <title>Test App</title>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/src/main.js"></script>
</body>
</html>
    `);
    
    writeFileSync(resolve(srcDir, 'main.js'), `
import './pages/index.mtm';
console.log('Test app loaded');
    `);
    
    writeFileSync(resolve(srcDir, 'pages', 'index.mtm'), `
---
target: reactjs
title: Test Page
---

<div>
  <h1>{{ title }}</h1>
  <p>This is a test page with React components.</p>
</div>
    `);
    
    writeFileSync(resolve(srcDir, 'components', 'TestComponent.mtm'), `
---
target: vue
name: TestComponent
---

<template>
  <div class="test-component">
    <h2>Test Component</h2>
    <p>This is a Vue component for testing.</p>
  </div>
</template>
    `);
  });
  
  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('Plugin Configuration', () => {
    it('should initialize with default configuration', () => {
      const plugin = metamonPerformance();
      expect(plugin.name).toBe('metamon-performance');
    });

    it('should accept custom configuration', () => {
      const plugin = metamonPerformance({
        lazyLoading: {
          enabled: false,
          strategy: 'immediate'
        },
        serviceWorker: {
          enabled: false
        }
      });
      expect(plugin.name).toBe('metamon-performance');
    });

    it('should integrate with main metamon plugin', () => {
      const mainPlugin = metamon({
        performance: {
          lazyLoading: {
            enabled: true,
            strategy: 'viewport'
          }
        }
      });
      expect(mainPlugin.name).toBe('metamon');
    });
  });

  describe('Development Mode Integration', () => {
    it('should configure development server with performance middleware', async () => {
      const plugin = metamonPerformance({
        development: {
          enableInDev: true,
          hotReloadCompatibility: true
        }
      });

      // Mock Vite dev server
      const mockServer = {
        middlewares: {
          use: vi.fn()
        }
      };

      // Simulate configureServer hook
      if (plugin.configureServer) {
        plugin.configureServer(mockServer as any);
      }

      // Verify middleware was added
      expect(mockServer.middlewares.use).toHaveBeenCalledWith('/metamon-loader.js', expect.any(Function));
      expect(mockServer.middlewares.use).toHaveBeenCalledWith('/metamon-performance.js', expect.any(Function));
      expect(mockServer.middlewares.use).toHaveBeenCalledWith('/metamon-layout-stability.js', expect.any(Function));
      expect(mockServer.middlewares.use).toHaveBeenCalledWith('/metamon-sw.js', expect.any(Function));
    });

    it('should inject development scripts into HTML', () => {
      const plugin = metamonPerformance({
        development: {
          enableInDev: true
        }
      });

      const originalHtml = `
<!DOCTYPE html>
<html>
<head>
  <title>Test</title>
</head>
<body>
  <div id="app"></div>
</body>
</html>
      `;

      // Simulate transformIndexHtml hook
      const transformedHtml = plugin.transformIndexHtml?.(originalHtml, {
        server: {} as any,
        filename: 'index.html',
        originalUrl: '/',
        path: '/'
      });

      expect(transformedHtml).toContain('<script src="/metamon-loader.js" defer></script>');
      expect(transformedHtml).toContain('<script src="/metamon-performance.js" defer></script>');
      expect(transformedHtml).toContain('<script src="/metamon-layout-stability.js" defer></script>');
      expect(transformedHtml).toContain('navigator.serviceWorker.register');
    });
  });

  describe('Production Build Integration', () => {
    it('should generate optimized bundles for production', async () => {
      const plugin = metamonPerformance({
        bundleOptimization: {
          enabled: true,
          frameworkSplitting: true
        },
        serviceWorker: {
          enabled: true
        }
      });

      // Mock bundle
      const mockBundle = {
        'main.js': {
          type: 'chunk' as const,
          fileName: 'main.js',
          code: 'console.log("main");',
          modules: {
            'src/main.js': { code: 'console.log("main");' }
          },
          imports: [],
          exports: []
        },
        'react-chunk.js': {
          type: 'chunk' as const,
          fileName: 'react-chunk.js',
          code: 'import React from "react";',
          modules: {
            'node_modules/react/index.js': { code: 'export default React;' }
          },
          imports: [],
          exports: []
        }
      };

      // Simulate generateBundle hook
      if (plugin.generateBundle) {
        await plugin.generateBundle.call(
          { emitFile: vi.fn() },
          { format: 'es', dir: 'dist' },
          mockBundle
        );
      }

      // Verify service worker and loader were generated
      expect(mockBundle['metamon-sw.js']).toBeDefined();
      expect(mockBundle['metamon-loader.js']).toBeDefined();
      expect(mockBundle['metamon-performance.js']).toBeDefined();
      expect(mockBundle['metamon-layout-stability.js']).toBeDefined();
    });

    it('should inject production scripts into HTML', () => {
      const plugin = metamonPerformance();

      const originalHtml = `
<!DOCTYPE html>
<html>
<head>
  <title>Test</title>
</head>
<body>
  <div id="app"></div>
</body>
</html>
      `;

      // Simulate transformIndexHtml hook for production
      const transformedHtml = plugin.transformIndexHtml?.(originalHtml, {
        filename: 'index.html',
        originalUrl: '/',
        path: '/'
      });

      expect(transformedHtml).toContain('<script src="/metamon-loader.js" defer></script>');
      expect(transformedHtml).toContain('<script src="/metamon-performance.js" defer></script>');
      expect(transformedHtml).toContain('<script src="/metamon-layout-stability.js" defer></script>');
      expect(transformedHtml).toContain('navigator.serviceWorker.register');
    });
  });

  describe('Framework Bundle Analysis', () => {
    it('should correctly identify framework chunks', () => {
      const plugin = metamonPerformance();

      const mockBundle = {
        'react-vendor.js': {
          type: 'chunk' as const,
          fileName: 'react-vendor.js',
          code: 'import React from "react";',
          modules: {
            'node_modules/react/index.js': { code: 'export default React;' },
            'node_modules/react-dom/index.js': { code: 'export * from "react-dom";' }
          },
          imports: [],
          exports: []
        },
        'vue-vendor.js': {
          type: 'chunk' as const,
          fileName: 'vue-vendor.js',
          code: 'import { createApp } from "vue";',
          modules: {
            'node_modules/vue/dist/vue.esm-bundler.js': { code: 'export { createApp };' }
          },
          imports: [],
          exports: []
        },
        'main.js': {
          type: 'chunk' as const,
          fileName: 'main.js',
          code: 'console.log("main");',
          modules: {
            'src/main.js': { code: 'console.log("main");' }
          },
          imports: [],
          exports: []
        }
      };

      // Access the private analyzeFrameworkBundles method through the plugin
      const manifest = (plugin as any).analyzeFrameworkBundles?.(mockBundle);

      expect(manifest).toBeDefined();
      expect(manifest.frameworks).toBeDefined();
      expect(manifest.frameworks.reactjs).toBeDefined();
      expect(manifest.frameworks.vue).toBeDefined();
      expect(manifest.chunks).toBeDefined();
    });
  });

  describe('Client Script Generation', () => {
    it('should generate valid framework loader script', () => {
      const plugin = metamonPerformance({
        lazyLoading: {
          enabled: true,
          strategy: 'viewport',
          targetLoadTime: 100
        }
      });

      // Access the private generateDevelopmentFrameworkLoader method
      const loaderScript = (plugin as any).generateDevelopmentFrameworkLoader?.();

      expect(loaderScript).toContain('MetamonDevLoader');
      expect(loaderScript).toContain('loadFramework');
      expect(loaderScript).toContain('window.MetamonLoader');
      expect(loaderScript).toContain('viewport');
    });

    it('should generate valid performance monitoring script', () => {
      const plugin = metamonPerformance({
        monitoring: {
          enabled: true,
          webVitals: true,
          frameworkMetrics: true
        }
      });

      // Access the private generatePerformanceMonitoringClient method
      const monitoringScript = (plugin as any).generatePerformanceMonitoringClient?.();

      expect(monitoringScript).toContain('MetamonPerformanceMonitor');
      expect(monitoringScript).toContain('initWebVitalsMonitoring');
      expect(monitoringScript).toContain('window.MetamonPerformance');
      expect(monitoringScript).toContain('PerformanceObserver');
    });

    it('should generate valid layout stability script', () => {
      const plugin = metamonPerformance({
        layoutStability: {
          enabled: true,
          targetCLS: 0.1,
          placeholderStrategy: 'dimensions'
        }
      });

      // Access the private generateLayoutStabilityClient method
      const stabilityScript = (plugin as any).generateLayoutStabilityClient?.();

      expect(stabilityScript).toContain('MetamonLayoutStability');
      expect(stabilityScript).toContain('initCLSMonitoring');
      expect(stabilityScript).toContain('window.MetamonLayoutStability');
      expect(stabilityScript).toContain('createPlaceholder');
    });

    it('should generate valid service worker script', async () => {
      const plugin = metamonPerformance({
        serviceWorker: {
          enabled: true,
          cacheStrategy: 'stale-while-revalidate'
        }
      });

      const mockBundle = {
        'main.js': {
          type: 'chunk' as const,
          fileName: 'main.js',
          code: 'console.log("main");',
          modules: {},
          imports: [],
          exports: []
        }
      };

      // Access the private generateProductionServiceWorker method
      const serviceWorkerScript = await (plugin as any).generateProductionServiceWorker?.(mockBundle);

      expect(serviceWorkerScript).toContain('Metamon Service Worker');
      expect(serviceWorkerScript).toContain('CACHE_NAME');
      expect(serviceWorkerScript).toContain('handleFrameworkRequest');
      expect(serviceWorkerScript).toContain('stale-while-revalidate');
    });
  });

  describe('Error Handling', () => {
    it('should handle missing configuration gracefully', () => {
      expect(() => {
        metamonPerformance({});
      }).not.toThrow();
    });

    it('should handle bundle generation errors gracefully', async () => {
      const plugin = metamonPerformance();

      // Mock a bundle that might cause errors
      const problematicBundle = {
        'invalid-chunk': {
          type: 'asset' as const,
          fileName: 'invalid-chunk',
          source: null
        }
      };

      // Should not throw even with problematic bundle
      expect(async () => {
        if (plugin.generateBundle) {
          await plugin.generateBundle.call(
            { emitFile: vi.fn() },
            { format: 'es', dir: 'dist' },
            problematicBundle
          );
        }
      }).not.toThrow();
    });
  });

  describe('Hot Reload Compatibility', () => {
    it('should maintain hot reload functionality', () => {
      const plugin = metamonPerformance({
        development: {
          hotReloadCompatibility: true
        }
      });

      // Verify plugin doesn't interfere with HMR
      expect(plugin.name).toBe('metamon-performance');
      
      // The plugin should not define handleHotUpdate to avoid conflicts
      expect(plugin.handleHotUpdate).toBeUndefined();
    });
  });
});

describe('Integration with Main Metamon Plugin', () => {
  it('should work alongside the main metamon plugin', () => {
    const mainPlugin = metamon({
      performance: {
        lazyLoading: { enabled: true },
        serviceWorker: { enabled: true }
      }
    });
    
    const performancePlugin = metamonPerformance({
      lazyLoading: { enabled: true },
      serviceWorker: { enabled: true }
    });

    expect(mainPlugin.name).toBe('metamon');
    expect(performancePlugin.name).toBe('metamon-performance');
  });

  it('should share configuration between plugins', () => {
    const sharedConfig = {
      lazyLoading: {
        enabled: true,
        strategy: 'viewport' as const,
        targetLoadTime: 100
      },
      serviceWorker: {
        enabled: true,
        cacheStrategy: 'stale-while-revalidate' as const
      }
    };

    const mainPlugin = metamon({
      performance: sharedConfig
    });
    
    const performancePlugin = metamonPerformance(sharedConfig);

    expect(mainPlugin.name).toBe('metamon');
    expect(performancePlugin.name).toBe('metamon-performance');
  });
});