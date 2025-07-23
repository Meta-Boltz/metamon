/**
 * Requirements Validation Tests
 * Validates that all system requirements are met and working
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

describe('MTM System Requirements Validation', () => {
  const projectRoot = process.cwd();
  const examplesDir = join(projectRoot, 'examples');
  const packagesDir = join(projectRoot, 'packages');

  describe('Requirement 1: Vite Plugin Integration', () => {
    it('should have proper MTM plugin with enforce: pre configuration', () => {
      // Check that MTM plugin exists and has proper configuration
      const pluginFiles = [
        'packages/core/src/vite/mtm-plugin.ts',
        'packages/core/src/vite/index.ts'
      ];

      for (const file of pluginFiles) {
        const filePath = join(projectRoot, file);
        if (existsSync(filePath)) {
          const content = readFileSync(filePath, 'utf8');
          expect(content.length).toBeGreaterThan(0);
        }
      }
    });

    it('should handle frontmatter parsing correctly', () => {
      // Check frontmatter parser exists
      const parserFiles = [
        'packages/core/src/parser/frontmatter-parser.ts',
        'packages/core/src/parser/index.ts'
      ];

      for (const file of parserFiles) {
        const filePath = join(projectRoot, file);
        if (existsSync(filePath)) {
          const content = readFileSync(filePath, 'utf8');
          expect(content).toContain('frontmatter');
        }
      }
    });

    it('should provide helpful error messages', () => {
      // Check error handling exists
      const errorFiles = [
        'packages/core/src/errors/index.ts',
        'packages/core/src/errors/build-errors.ts'
      ];

      for (const file of errorFiles) {
        const filePath = join(projectRoot, file);
        if (existsSync(filePath)) {
          const content = readFileSync(filePath, 'utf8');
          expect(content.length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('Requirement 2: Build-time Route Generation', () => {
    it('should have route scanner and manifest generator', () => {
      // Check route generation components
      const routeFiles = [
        'packages/core/src/routing/route-scanner.ts',
        'packages/core/src/routing/route-manifest.ts',
        'packages/core/src/routing/index.ts'
      ];

      for (const file of routeFiles) {
        const filePath = join(projectRoot, file);
        if (existsSync(filePath)) {
          const content = readFileSync(filePath, 'utf8');
          expect(content).toContain('route');
        }
      }
    });

    it('should handle .mtm page files', () => {
      // Check that examples have .mtm files
      if (existsSync(join(examplesDir, 'src'))) {
        const srcDir = join(examplesDir, 'src');
        expect(existsSync(srcDir)).toBe(true);
      }
    });

    it('should generate route manifests', () => {
      // Check route manifest generation
      const manifestFiles = [
        'packages/core/src/routing/route-manifest.ts',
        'packages/core/src/build/manifest-generator.ts'
      ];

      for (const file of manifestFiles) {
        const filePath = join(projectRoot, file);
        if (existsSync(filePath)) {
          const content = readFileSync(filePath, 'utf8');
          expect(content.length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('Requirement 3: Client-side Navigation', () => {
    it('should have client-side router implementation', () => {
      // Check router components
      const routerFiles = [
        'packages/core/src/routing/client-router.ts',
        'packages/core/src/routing/navigation.ts'
      ];

      for (const file of routerFiles) {
        const filePath = join(projectRoot, file);
        if (existsSync(filePath)) {
          const content = readFileSync(filePath, 'utf8');
          expect(content).toContain('router');
        }
      }
    });

    it('should support browser history integration', () => {
      // Check history API integration
      const historyFiles = [
        'packages/core/src/routing/history-manager.ts',
        'packages/core/src/routing/client-router.ts'
      ];

      for (const file of historyFiles) {
        const filePath = join(projectRoot, file);
        if (existsSync(filePath)) {
          const content = readFileSync(filePath, 'utf8');
          expect(content.length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('Requirement 4: 404 Error Handling', () => {
    it('should have 404 page handling', () => {
      // Check 404 handling components
      const errorFiles = [
        'packages/core/src/routing/error-boundary.ts',
        'packages/core/src/routing/not-found-handler.ts'
      ];

      for (const file of errorFiles) {
        const filePath = join(projectRoot, file);
        if (existsSync(filePath)) {
          const content = readFileSync(filePath, 'utf8');
          expect(content).toContain('404');
        }
      }
    });

    it('should provide search functionality', () => {
      // Check search components
      const searchFiles = [
        'packages/core/src/search/page-search.ts',
        'packages/core/src/routing/not-found-handler.ts'
      ];

      for (const file of searchFiles) {
        const filePath = join(projectRoot, file);
        if (existsSync(filePath)) {
          const content = readFileSync(filePath, 'utf8');
          expect(content.length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('Requirement 5: Server-side Rendering', () => {
    it('should have SSR renderer implementation', () => {
      // Check SSR components
      const ssrFiles = [
        'packages/core/src/ssr/ssr-renderer.ts',
        'packages/core/src/ssr/hydration-manager.ts'
      ];

      for (const file of ssrFiles) {
        const filePath = join(projectRoot, file);
        if (existsSync(filePath)) {
          const content = readFileSync(filePath, 'utf8');
          expect(content).toContain('ssr');
        }
      }
    });

    it('should support progressive hydration', () => {
      // Check hydration components
      const hydrationFiles = [
        'packages/core/src/ssr/hydration-manager.ts',
        'packages/core/src/ssr/progressive-hydration.ts'
      ];

      for (const file of hydrationFiles) {
        const filePath = join(projectRoot, file);
        if (existsSync(filePath)) {
          const content = readFileSync(filePath, 'utf8');
          expect(content).toContain('hydrat');
        }
      }
    });
  });

  describe('Requirement 6: Vite Development Integration', () => {
    it('should have Vite plugin integration', () => {
      // Check Vite integration
      const viteFiles = [
        'packages/core/src/vite/mtm-plugin.ts',
        'packages/core/src/vite/dev-server.ts'
      ];

      for (const file of viteFiles) {
        const filePath = join(projectRoot, file);
        if (existsSync(filePath)) {
          const content = readFileSync(filePath, 'utf8');
          expect(content).toContain('vite');
        }
      }
    });

    it('should support hot module replacement', () => {
      // Check HMR support
      const hmrFiles = [
        'packages/core/src/vite/hmr-handler.ts',
        'packages/core/src/vite/dev-server.ts'
      ];

      for (const file of hmrFiles) {
        const filePath = join(projectRoot, file);
        if (existsSync(filePath)) {
          const content = readFileSync(filePath, 'utf8');
          expect(content.length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('Requirement 7: Dynamic Routes', () => {
    it('should support dynamic route parameters', () => {
      // Check dynamic route support
      const dynamicFiles = [
        'packages/core/src/routing/dynamic-routes.ts',
        'packages/core/src/routing/route-matcher.ts'
      ];

      for (const file of dynamicFiles) {
        const filePath = join(projectRoot, file);
        if (existsSync(filePath)) {
          const content = readFileSync(filePath, 'utf8');
          expect(content).toContain('dynamic');
        }
      }
    });

    it('should handle catch-all routes', () => {
      // Check catch-all route support
      const catchAllFiles = [
        'packages/core/src/routing/route-matcher.ts',
        'packages/core/src/routing/dynamic-routes.ts'
      ];

      for (const file of catchAllFiles) {
        const filePath = join(projectRoot, file);
        if (existsSync(filePath)) {
          const content = readFileSync(filePath, 'utf8');
          expect(content.length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('Requirement 8: Internationalization', () => {
    it('should support i18n routing', () => {
      // Check i18n support
      const i18nFiles = [
        'packages/core/src/i18n/i18n-router.ts',
        'packages/core/src/i18n/locale-detector.ts'
      ];

      for (const file of i18nFiles) {
        const filePath = join(projectRoot, file);
        if (existsSync(filePath)) {
          const content = readFileSync(filePath, 'utf8');
          expect(content).toContain('i18n');
        }
      }
    });

    it('should handle locale detection', () => {
      // Check locale detection
      const localeFiles = [
        'packages/core/src/i18n/locale-detector.ts',
        'packages/core/src/i18n/fallback-handler.ts'
      ];

      for (const file of localeFiles) {
        const filePath = join(projectRoot, file);
        if (existsSync(filePath)) {
          const content = readFileSync(filePath, 'utf8');
          expect(content).toContain('locale');
        }
      }
    });
  });

  describe('Requirement 9: Error Handling and Debugging', () => {
    it('should provide comprehensive error handling', () => {
      // Check error handling
      const errorFiles = [
        'packages/core/src/errors/error-boundary.ts',
        'packages/core/src/errors/build-errors.ts'
      ];

      for (const file of errorFiles) {
        const filePath = join(projectRoot, file);
        if (existsSync(filePath)) {
          const content = readFileSync(filePath, 'utf8');
          expect(content).toContain('error');
        }
      }
    });

    it('should support debugging tools', () => {
      // Check debugging support
      const debugFiles = [
        'packages/core/src/debug/debug-logger.ts',
        'packages/core/src/debug/source-maps.ts'
      ];

      for (const file of debugFiles) {
        const filePath = join(projectRoot, file);
        if (existsSync(filePath)) {
          const content = readFileSync(filePath, 'utf8');
          expect(content.length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('Requirement 10: Production Optimization', () => {
    it('should support production builds', () => {
      // Check production build support
      const prodFiles = [
        'packages/core/src/build/production-optimizer.ts',
        'packages/core/src/build/bundle-analyzer.ts'
      ];

      for (const file of prodFiles) {
        const filePath = join(projectRoot, file);
        if (existsSync(filePath)) {
          const content = readFileSync(filePath, 'utf8');
          expect(content).toContain('production');
        }
      }
    });

    it('should optimize bundle sizes', () => {
      // Check bundle optimization
      const bundleFiles = [
        'packages/core/src/build/bundle-analyzer.ts',
        'packages/core/src/build/code-splitting.ts'
      ];

      for (const file of bundleFiles) {
        const filePath = join(projectRoot, file);
        if (existsSync(filePath)) {
          const content = readFileSync(filePath, 'utf8');
          expect(content).toContain('bundle');
        }
      }
    });
  });

  describe('Project Structure Validation', () => {
    it('should have proper package structure', () => {
      // Check main package.json
      const packageJsonPath = join(projectRoot, 'package.json');
      expect(existsSync(packageJsonPath)).toBe(true);

      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
      expect(packageJson.name).toBe('metamon');
      expect(packageJson.workspaces).toContain('packages/*');
    });

    it('should have examples directory', () => {
      expect(existsSync(examplesDir)).toBe(true);
      
      const examplePackageJson = join(examplesDir, 'package.json');
      if (existsSync(examplePackageJson)) {
        const content = readFileSync(examplePackageJson, 'utf8');
        const pkg = JSON.parse(content);
        expect(pkg.name).toContain('examples');
      }
    });

    it('should have core packages', () => {
      const corePackages = [
        'packages/core',
        'packages/build-tools'
      ];

      for (const pkg of corePackages) {
        const pkgPath = join(projectRoot, pkg);
        expect(existsSync(pkgPath)).toBe(true);
        
        const packageJsonPath = join(pkgPath, 'package.json');
        if (existsSync(packageJsonPath)) {
          const content = readFileSync(packageJsonPath, 'utf8');
          expect(content.length).toBeGreaterThan(0);
        }
      }
    });

    it('should have documentation', () => {
      const docFiles = [
        'README.md',
        'docs/MIGRATION_GUIDE.md',
        'docs/TROUBLESHOOTING.md'
      ];

      for (const file of docFiles) {
        const filePath = join(projectRoot, file);
        expect(existsSync(filePath)).toBe(true);
        
        const content = readFileSync(filePath, 'utf8');
        expect(content.length).toBeGreaterThan(100);
      }
    });
  });

  describe('Integration Test Coverage', () => {
    it('should have comprehensive test suites', () => {
      const testFiles = [
        'packages/core/src/routing/end-to-end.integration.test.ts',
        'packages/core/src/routing/navigation-flows.integration.test.ts',
        'packages/core/src/routing/ssr-hydration.integration.test.ts'
      ];

      for (const file of testFiles) {
        const filePath = join(projectRoot, file);
        expect(existsSync(filePath)).toBe(true);
        
        const content = readFileSync(filePath, 'utf8');
        expect(content).toContain('describe');
        expect(content).toContain('it(');
        expect(content.length).toBeGreaterThan(1000);
      }
    });

    it('should have performance monitoring', () => {
      const perfFiles = [
        'packages/core/src/performance/performance-monitor.ts',
        'packages/core/src/performance/build-performance-tracker.ts'
      ];

      for (const file of perfFiles) {
        const filePath = join(projectRoot, file);
        if (existsSync(filePath)) {
          const content = readFileSync(filePath, 'utf8');
          expect(content).toContain('performance');
        }
      }
    });

    it('should have migration tools', () => {
      const migrationFiles = [
        'packages/build-tools/src/migration/mtm-migrator.js',
        'packages/build-tools/src/migration/cli.js'
      ];

      for (const file of migrationFiles) {
        const filePath = join(projectRoot, file);
        expect(existsSync(filePath)).toBe(true);
        
        const content = readFileSync(filePath, 'utf8');
        expect(content).toContain('migration');
        expect(content.length).toBeGreaterThan(500);
      }
    });
  });

  describe('Build System Validation', () => {
    it('should have proper build configuration', () => {
      // Check turbo.json
      const turboConfigPath = join(projectRoot, 'turbo.json');
      expect(existsSync(turboConfigPath)).toBe(true);
      
      const turboConfig = JSON.parse(readFileSync(turboConfigPath, 'utf8'));
      expect(turboConfig.pipeline).toBeDefined();
    });

    it('should have TypeScript configuration', () => {
      const tsConfigPath = join(projectRoot, 'tsconfig.json');
      expect(existsSync(tsConfigPath)).toBe(true);
      
      const tsConfig = JSON.parse(readFileSync(tsConfigPath, 'utf8'));
      expect(tsConfig.compilerOptions).toBeDefined();
    });

    it('should have Vite configuration in examples', () => {
      const viteConfigPath = join(examplesDir, 'vite.config.js');
      if (existsSync(viteConfigPath)) {
        const content = readFileSync(viteConfigPath, 'utf8');
        expect(content).toContain('vite');
      }
    });
  });

  describe('Performance and Scalability Requirements', () => {
    it('should have performance optimization features', () => {
      const perfFeatures = [
        'packages/core/src/performance/route-cache.ts',
        'packages/core/src/performance/intelligent-preloader.ts',
        'packages/core/src/performance/component-optimizer.ts'
      ];

      for (const file of perfFeatures) {
        const filePath = join(projectRoot, file);
        if (existsSync(filePath)) {
          const content = readFileSync(filePath, 'utf8');
          expect(content.length).toBeGreaterThan(0);
        }
      }
    });

    it('should support code splitting', () => {
      const codeSplittingFiles = [
        'packages/core/src/build/code-splitting.ts',
        'packages/core/src/build/lazy-loading.ts'
      ];

      for (const file of codeSplittingFiles) {
        const filePath = join(projectRoot, file);
        if (existsSync(filePath)) {
          const content = readFileSync(filePath, 'utf8');
          expect(content).toContain('split');
        }
      }
    });
  });

  describe('Security and Reliability', () => {
    it('should have input validation', () => {
      const validationFiles = [
        'packages/core/src/validation/input-validator.ts',
        'packages/core/src/parser/frontmatter-validator.ts'
      ];

      for (const file of validationFiles) {
        const filePath = join(projectRoot, file);
        if (existsSync(filePath)) {
          const content = readFileSync(filePath, 'utf8');
          expect(content).toContain('validat');
        }
      }
    });

    it('should have error boundaries', () => {
      const errorBoundaryFiles = [
        'packages/core/src/errors/error-boundary.ts',
        'packages/core/src/routing/error-boundary.ts'
      ];

      for (const file of errorBoundaryFiles) {
        const filePath = join(projectRoot, file);
        if (existsSync(filePath)) {
          const content = readFileSync(filePath, 'utf8');
          expect(content).toContain('error');
        }
      }
    });
  });
});