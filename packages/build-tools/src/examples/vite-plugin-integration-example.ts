/**
 * Example: Vite Plugin Integration with Performance Optimization
 * 
 * This example demonstrates how to integrate the Metamon Vite plugin
 * with all performance optimization features for both development and production.
 */

import { defineConfig } from 'vite';
import { metamon, metamonPerformance } from '@metamon/build-tools';

// Example 1: Basic integration with performance optimization
export const basicConfig = defineConfig({
  plugins: [
    // Main Metamon plugin with performance features enabled
    metamon({
      root: 'src',
      pagesDir: 'pages',
      componentsDir: 'components',
      hmr: true,
      sourceMaps: true,
      
      // Performance optimization configuration
      performance: {
        lazyLoading: {
          enabled: true,
          strategy: 'viewport',
          intelligentPreload: true,
          targetLoadTime: 100
        },
        serviceWorker: {
          enabled: true,
          scope: '/',
          cacheStrategy: 'stale-while-revalidate',
          backgroundExecution: true
        },
        layoutStability: {
          enabled: true,
          targetCLS: 0.1,
          placeholderStrategy: 'dimensions'
        },
        ssr: {
          selectiveHydration: true,
          hydrationStrategy: 'viewport',
          progressiveEnhancement: true
        },
        networkAdaptation: {
          enabled: true,
          bandwidthAware: true,
          intermittentConnectivity: true
        },
        monitoring: {
          enabled: true,
          webVitals: true,
          frameworkMetrics: true,
          serviceWorkerDebug: false
        }
      },
      
      // Production optimization
      optimization: {
        treeShaking: {
          runtime: true,
          adapters: true,
          components: true,
          aggressive: false
        },
        minify: {
          enabled: true,
          removeComments: true,
          removeConsole: true,
          mangle: true,
          compress: true
        },
        compression: {
          gzip: true,
          brotli: true,
          level: 6
        },
        analysis: {
          detailed: true,
          visualization: true,
          thresholds: {
            warning: 250 * 1024, // 250KB
            error: 500 * 1024    // 500KB
          }
        }
      }
    })
  ],
  
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Framework-specific chunks for optimal caching
          'framework-react': ['react', 'react-dom'],
          'framework-vue': ['vue'],
          'framework-solid': ['solid-js'],
          'framework-svelte': ['svelte']
        }
      }
    }
  }
});

// Example 2: Development-focused configuration
export const developmentConfig = defineConfig({
  plugins: [
    metamon({
      root: 'src',
      pagesDir: 'pages',
      componentsDir: 'components',
      hmr: true,
      sourceMaps: true,
      
      // Enhanced development experience
      performance: {
        lazyLoading: {
          enabled: true,
          strategy: 'immediate', // Load immediately in dev for faster feedback
          intelligentPreload: false,
          targetLoadTime: 50
        },
        serviceWorker: {
          enabled: false, // Disable in development for simpler debugging
          scope: '/',
          cacheStrategy: 'network-first'
        },
        layoutStability: {
          enabled: true,
          targetCLS: 0.05, // Stricter in development
          placeholderStrategy: 'skeleton'
        },
        monitoring: {
          enabled: true,
          webVitals: true,
          frameworkMetrics: true,
          serviceWorkerDebug: true // Enable debug logging
        }
      },
      
      // Hot reload configuration
      hotReload: {
        preserveState: true,
        batchUpdates: true,
        debounceMs: 100,
        syncFrameworks: true,
        showErrorOverlay: true,
        errorRecoveryMode: 'graceful',
        debugLogging: true
      }
    })
  ],
  
  server: {
    port: 3000,
    open: true
  }
});

// Example 3: Production-optimized configuration
export const productionConfig = defineConfig({
  plugins: [
    metamon({
      root: 'src',
      pagesDir: 'pages',
      componentsDir: 'components',
      hmr: false,
      sourceMaps: false,
      
      // Aggressive performance optimization for production
      performance: {
        lazyLoading: {
          enabled: true,
          strategy: 'viewport',
          intelligentPreload: true,
          targetLoadTime: 100
        },
        serviceWorker: {
          enabled: true,
          scope: '/',
          cacheStrategy: 'cache-first', // Aggressive caching in production
          backgroundExecution: true
        },
        layoutStability: {
          enabled: true,
          targetCLS: 0.1,
          placeholderStrategy: 'dimensions'
        },
        ssr: {
          selectiveHydration: true,
          hydrationStrategy: 'interaction', // Conservative hydration
          progressiveEnhancement: true
        },
        networkAdaptation: {
          enabled: true,
          bandwidthAware: true,
          intermittentConnectivity: true
        },
        monitoring: {
          enabled: false, // Disable detailed monitoring in production
          webVitals: true,
          frameworkMetrics: false,
          serviceWorkerDebug: false
        }
      },
      
      // Aggressive production optimization
      optimization: {
        treeShaking: {
          runtime: true,
          adapters: true,
          components: true,
          aggressive: true // Enable aggressive tree-shaking
        },
        minify: {
          enabled: true,
          removeComments: true,
          removeConsole: true,
          removeDebugger: true,
          mangle: true,
          compress: true
        },
        compression: {
          gzip: true,
          brotli: true,
          level: 9 // Maximum compression
        },
        splitting: {
          enabled: true,
          chunkSizeThreshold: 30 * 1024, // 30KB chunks
          sharedDepsThreshold: 2
        },
        analysis: {
          detailed: true,
          visualization: true,
          thresholds: {
            warning: 200 * 1024, // 200KB
            error: 400 * 1024    // 400KB
          }
        },
        target: 'es2020',
        polyfills: false
      }
    })
  ],
  
  build: {
    target: 'es2020',
    minify: 'terser',
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Advanced chunking strategy
          if (id.includes('node_modules')) {
            if (id.includes('react')) return 'framework-react';
            if (id.includes('vue')) return 'framework-vue';
            if (id.includes('solid')) return 'framework-solid';
            if (id.includes('svelte')) return 'framework-svelte';
            return 'vendor';
          }
          
          if (id.includes('src/components')) return 'components';
          if (id.includes('src/pages')) return 'pages';
          
          return 'main';
        }
      }
    }
  }
});

// Example 4: Standalone performance plugin usage
export const standalonePerformanceConfig = defineConfig({
  plugins: [
    // Use the standalone performance plugin
    metamonPerformance({
      lazyLoading: {
        enabled: true,
        strategy: 'viewport',
        intelligentPreload: true,
        targetLoadTime: 100
      },
      serviceWorker: {
        enabled: true,
        scope: '/',
        cacheStrategy: 'stale-while-revalidate',
        backgroundExecution: true
      },
      layoutStability: {
        enabled: true,
        targetCLS: 0.1,
        placeholderStrategy: 'dimensions'
      },
      ssr: {
        selectiveHydration: true,
        hydrationStrategy: 'viewport',
        progressiveEnhancement: true
      },
      networkAdaptation: {
        enabled: true,
        bandwidthAware: true,
        intermittentConnectivity: true
      },
      monitoring: {
        enabled: true,
        webVitals: true,
        frameworkMetrics: true,
        serviceWorkerDebug: false
      },
      bundleOptimization: {
        enabled: true,
        frameworkSplitting: true,
        sharedDependencyExtraction: true,
        http2Optimization: true,
        cacheStrategyOptimization: true
      },
      development: {
        enableInDev: true,
        hotReloadCompatibility: true,
        debugMode: false
      }
    })
  ]
});

// Example 5: Custom configuration for specific use cases
export const customConfig = defineConfig({
  plugins: [
    metamon({
      root: 'src',
      pagesDir: 'pages',
      componentsDir: 'components',
      
      // Custom performance configuration for mobile-first applications
      performance: {
        lazyLoading: {
          enabled: true,
          strategy: 'interaction', // Conservative loading for mobile
          intelligentPreload: false, // Disable to save bandwidth
          targetLoadTime: 200 // More lenient for slower connections
        },
        serviceWorker: {
          enabled: true,
          scope: '/',
          cacheStrategy: 'cache-first', // Aggressive caching for offline support
          backgroundExecution: false // Disable to save battery
        },
        layoutStability: {
          enabled: true,
          targetCLS: 0.05, // Stricter for mobile UX
          placeholderStrategy: 'spinner' // Simpler placeholders
        },
        networkAdaptation: {
          enabled: true,
          bandwidthAware: true,
          intermittentConnectivity: true // Critical for mobile
        },
        monitoring: {
          enabled: true,
          webVitals: true,
          frameworkMetrics: false, // Reduce overhead
          serviceWorkerDebug: false
        }
      }
    })
  ]
});

// Example usage in vite.config.ts:
/*
import { defineConfig } from 'vite';
import { basicConfig, developmentConfig, productionConfig } from './examples/vite-plugin-integration-example';

export default defineConfig(({ command, mode }) => {
  if (command === 'serve') {
    return developmentConfig;
  } else {
    return productionConfig;
  }
});
*/

// Example package.json scripts:
/*
{
  "scripts": {
    "dev": "vite --config vite.config.dev.ts",
    "build": "vite build --config vite.config.prod.ts",
    "preview": "vite preview",
    "analyze": "vite build --config vite.config.analyze.ts"
  }
}
*/