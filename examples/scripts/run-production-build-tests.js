#!/usr/bin/env node

/**
 * Production Build Test Runner
 * 
 * This script runs comprehensive production build tests with various
 * configurations to ensure chunk loading works correctly with:
 * - Minification enabled
 * - Different code splitting strategies
 * - Various build optimizations
 */

import { execSync, spawn } from 'child_process';
import { writeFileSync, unlinkSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const TEST_CONFIGS = [
  {
    name: 'default-minified',
    description: 'Default production build with minification',
    config: `
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
      hmr: false, // Disable HMR for production
      sourceMaps: false, // Disable source maps for production
      ssr: true,
      safePropertyAssignment: true,
      chunkCompatMode: 'safe'
    }),
    react(), vue(), solid(), svelte()
  ],
  build: {
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
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
});`
  },
  {
    name: 'manual-chunks',
    description: 'Production build with manual chunk splitting',
    config: `
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
      hmr: false,
      sourceMaps: false,
      ssr: true,
      safePropertyAssignment: true,
      chunkCompatMode: 'safe'
    }),
    react(), vue(), solid(), svelte()
  ],
  build: {
    minify: 'terser',
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
});`
  },
  {
    name: 'size-optimized',
    description: 'Production build optimized for size',
    config: `
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
      hmr: false,
      sourceMaps: false,
      ssr: true,
      safePropertyAssignment: true,
      chunkCompatMode: 'safe'
    }),
    react(), vue(), solid(), svelte()
  ],
  build: {
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug']
      },
      mangle: {
        properties: {
          regex: /^_/
        }
      }
    },
    rollupOptions: {
      output: {
        chunkFileNames: 'c/[hash].js',
        entryFileNames: 'e/[hash].js',
        assetFileNames: 'a/[hash].[ext]',
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react')) return 'react';
            if (id.includes('vue')) return 'vue';
            if (id.includes('solid')) return 'solid';
            return 'vendor';
          }
          if (id.includes('components')) {
            return 'components';
          }
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
});`
  },
  {
    name: 'legacy-support',
    description: 'Production build with legacy browser support',
    config: `
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import vue from '@vitejs/plugin-vue';
import solid from 'vite-plugin-solid';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { mtmPluginFixed } from './src/mtm-plugin-fixed.js';
import legacy from '@vitejs/plugin-legacy';

export default defineConfig({
  plugins: [
    mtmPluginFixed({
      include: ['**/*.mtm'],
      hmr: false,
      sourceMaps: false,
      ssr: true,
      safePropertyAssignment: true,
      chunkCompatMode: 'legacy' // Use legacy compatibility mode
    }),
    react(), vue(), solid(), svelte(),
    legacy({
      targets: ['defaults', 'not IE 11']
    })
  ],
  build: {
    minify: 'terser',
    target: 'es2015'
  },
  resolve: {
    alias: {
      '@': '/src',
      '@components': '/src/components',
      '@pages': '/src/pages'
    }
  }
});`
  }
];

class ProductionBuildTester {
  constructor() {
    this.results = [];
    this.currentConfig = null;
    this.previewServer = null;
  }

  async runAllTests() {
    console.log('🚀 Starting Production Build Tests');
    console.log('=====================================');

    // Ensure test results directory exists
    if (!existsSync('test-results')) {
      mkdirSync('test-results', { recursive: true });
    }

    for (const config of TEST_CONFIGS) {
      console.log(`\\n📦 Testing configuration: ${config.name}`);
      console.log(`📝 Description: ${config.description}`);

      try {
        await this.testConfiguration(config);
        console.log(`✅ Configuration ${config.name} passed`);
      } catch (error) {
        console.error(`❌ Configuration ${config.name} failed:`, error.message);
        this.results.push({
          config: config.name,
          success: false,
          error: error.message
        });
      }
    }

    this.generateReport();
  }

  async testConfiguration(config) {
    const configPath = `vite.config.${config.name}.js`;

    try {
      // Write temporary config file
      writeFileSync(configPath, config.config);
      this.currentConfig = configPath;

      // Clean previous build
      console.log('🧹 Cleaning previous build...');
      try {
        execSync('rm -rf dist', { stdio: 'inherit' });
      } catch (e) {
        // Ignore cleanup errors
      }

      // Build with this configuration
      console.log('🔨 Building with configuration...');
      const buildStart = Date.now();

      execSync(`npx vite build --config ${configPath}`, {
        stdio: 'inherit',
        timeout: 180000 // 3 minutes timeout
      });

      const buildTime = Date.now() - buildStart;
      console.log(`⏱️  Build completed in ${buildTime}ms`);

      // Run tests against this build
      console.log('🧪 Running tests...');
      const testStart = Date.now();

      execSync(`npx playwright test --config=tests/production-build.config.js`, {
        stdio: 'inherit',
        timeout: 300000 // 5 minutes timeout
      });

      const testTime = Date.now() - testStart;
      console.log(`⏱️  Tests completed in ${testTime}ms`);

      this.results.push({
        config: config.name,
        success: true,
        buildTime,
        testTime,
        totalTime: buildTime + testTime
      });

    } finally {
      // Clean up config file
      if (this.currentConfig && existsSync(this.currentConfig)) {
        unlinkSync(this.currentConfig);
      }
    }
  }

  generateReport() {
    console.log('\\n📊 Production Build Test Results');
    console.log('==================================');

    const successful = this.results.filter(r => r.success);
    const failed = this.results.filter(r => !r.success);

    console.log(`✅ Successful configurations: ${successful.length}`);
    console.log(`❌ Failed configurations: ${failed.length}`);

    if (successful.length > 0) {
      console.log('\\n🎉 Successful Configurations:');
      successful.forEach(result => {
        console.log(`  • ${result.config}: Build ${result.buildTime}ms, Test ${result.testTime}ms`);
      });
    }

    if (failed.length > 0) {
      console.log('\\n💥 Failed Configurations:');
      failed.forEach(result => {
        console.log(`  • ${result.config}: ${result.error}`);
      });
    }

    // Write detailed report
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total: this.results.length,
        successful: successful.length,
        failed: failed.length
      },
      results: this.results,
      configurations: TEST_CONFIGS.map(c => ({
        name: c.name,
        description: c.description
      }))
    };

    writeFileSync('test-results/production-build-report.json', JSON.stringify(report, null, 2));
    console.log('\\n📄 Detailed report saved to test-results/production-build-report.json');

    // Exit with error code if any tests failed
    if (failed.length > 0) {
      process.exit(1);
    }
  }
}

// Handle cleanup on exit
process.on('SIGINT', () => {
  console.log('\\n🛑 Test interrupted, cleaning up...');
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('\\n🛑 Test terminated, cleaning up...');
  process.exit(1);
});

// Run tests if this script is executed directly
const isMainModule = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'));
if (isMainModule || process.argv[1]?.includes('run-production-build-tests.js')) {
  console.log('🚀 Starting Production Build Test Runner...');
  const tester = new ProductionBuildTester();
  tester.runAllTests().catch(error => {
    console.error('💥 Test runner failed:', error);
    process.exit(1);
  });
}