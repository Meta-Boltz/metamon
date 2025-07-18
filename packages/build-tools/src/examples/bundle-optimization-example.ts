/**
 * Bundle Optimization Example
 * 
 * Demonstrates the comprehensive bundle optimization system including:
 * - Intelligent bundling with shared dependency extraction
 * - Framework-specific chunk splitting for optimal caching
 * - Bundle analysis and size optimization for HTTP/2 multiplexing
 * - Cache strategy optimization for maximum hit rates
 */

import { 
  BundleOptimizationOrchestrator,
  createBundleOptimizer,
  optimizeBundle
} from '../bundle-optimization/index.js';

/**
 * Example: Basic Bundle Optimization
 */
export async function basicBundleOptimizationExample() {
  console.log('🚀 Basic Bundle Optimization Example');
  
  // Mock bundle data representing a multi-framework application
  const mockBundle = {
    'main-react.js': {
      type: 'chunk',
      code: 'import React from "react"; import { render } from "react-dom"; import axios from "axios"; console.log("React app");',
      imports: ['react', 'react-dom', 'axios'],
      dynamicImports: [],
      size: 85000
    },
    'main-vue.js': {
      type: 'chunk',
      code: 'import Vue from "vue"; import axios from "axios"; import lodash from "lodash"; console.log("Vue app");',
      imports: ['vue', 'axios', 'lodash'],
      dynamicImports: [],
      size: 65000
    },
    'utils-shared.js': {
      type: 'chunk',
      code: 'import lodash from "lodash"; import axios from "axios"; export const utils = {};',
      imports: ['lodash', 'axios'],
      dynamicImports: [],
      size: 25000
    },
    'svelte-component.js': {
      type: 'chunk',
      code: 'import { onMount } from "svelte"; import axios from "axios"; console.log("Svelte component");',
      imports: ['svelte', 'axios'],
      dynamicImports: [],
      size: 18000
    }
  };

  // Use the convenience function for quick optimization
  const result = await optimizeBundle(mockBundle);

  console.log('📊 Optimization Results:');
  console.log(`- Total size reduction: ${Math.floor(result.overallMetrics.totalSizeReduction / 1024)}KB`);
  console.log(`- Load time improvement: ${Math.floor(result.overallMetrics.estimatedLoadTimeImprovement * 100)}%`);
  console.log(`- Cache efficiency: ${Math.floor(result.overallMetrics.cacheEfficiencyImprovement * 100)}%`);
  console.log(`- Parallel loading efficiency: ${Math.floor(result.overallMetrics.parallelLoadingImprovement * 100)}%`);

  console.log('\n📦 Final Bundle Manifest:');
  console.log(`- Optimized bundles: ${result.finalBundleManifest.bundles.length}`);
  console.log(`- Shared chunks: ${result.finalBundleManifest.sharedChunks.length}`);
  console.log(`- Loading phases: ${result.finalBundleManifest.loadingSequences.length}`);

  console.log('\n💡 Top Recommendations:');
  result.recommendations.critical.slice(0, 3).forEach((rec, i) => {
    console.log(`${i + 1}. ${rec}`);
  });

  return result;
}

/**
 * Example: Advanced Bundle Optimization with Custom Configuration
 */
export async function advancedBundleOptimizationExample() {
  console.log('\n🔧 Advanced Bundle Optimization Example');

  // Custom configuration for specific optimization goals
  const customConfig = {
    bundleOptimization: {
      sharedDependencies: {
        enabled: true,
        minSharedCount: 2,
        maxSharedChunkSize: 150 * 1024, // 150KB max shared chunks
        priorityDependencies: ['react', 'vue', 'axios', 'lodash']
      },
      frameworkOptimization: {
        enabled: true,
        chunkSizeTargets: {
          react: { core: 80 * 1024, adapter: 40 * 1024, utility: 25 * 1024 },
          vue: { core: 70 * 1024, adapter: 35 * 1024, utility: 20 * 1024 },
          svelte: { core: 50 * 1024, adapter: 25 * 1024, utility: 15 * 1024 }
        },
        preloadStrategies: {
          react: 'aggressive',
          vue: 'conservative',
          svelte: 'lazy'
        }
      },
      http2Optimization: {
        enabled: true,
        maxConcurrentRequests: 8,
        optimalChunkSize: 80 * 1024,
        enableServerPush: true,
        pushPriorityMap: {
          core: 'high',
          adapter: 'medium',
          utility: 'low',
          shared: 'high'
        }
      },
      cacheOptimization: {
        enabled: true,
        strategies: {
          '*.core.*': {
            strategy: 'cache-first',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
            updateStrategy: 'background'
          },
          '*.shared.*': {
            strategy: 'cache-first',
            maxAge: 14 * 24 * 60 * 60 * 1000, // 14 days
            updateStrategy: 'background'
          },
          '*.utility.*': {
            strategy: 'stale-while-revalidate',
            maxAge: 60 * 60 * 1000, // 1 hour
            updateStrategy: 'immediate'
          }
        },
        versioningStrategy: 'hash',
        cacheInvalidationRules: {
          '*.core.*': ['framework-version-change'],
          '*.shared.*': ['dependency-version-change'],
          '*.utility.*': ['content-change']
        }
      }
    },
    performanceTargets: {
      maxInitialBundleSize: 200 * 1024, // 200KB
      targetCacheHitRate: 0.85,
      maxLoadTime: 1500, // 1.5 seconds
      minCompressionRatio: 0.25
    }
  };

  // Create orchestrator with custom configuration
  const orchestrator = new BundleOptimizationOrchestrator(customConfig);

  // Larger mock bundle for more complex optimization
  const complexBundle = {
    'app-main.js': {
      type: 'chunk',
      code: 'import React from "react"; import ReactDOM from "react-dom"; import { BrowserRouter } from "react-router-dom"; import axios from "axios";',
      imports: ['react', 'react-dom', 'react-router-dom', 'axios'],
      size: 120000
    },
    'vue-admin.js': {
      type: 'chunk',
      code: 'import Vue from "vue"; import VueRouter from "vue-router"; import Vuex from "vuex"; import axios from "axios"; import lodash from "lodash";',
      imports: ['vue', 'vue-router', 'vuex', 'axios', 'lodash'],
      size: 95000
    },
    'svelte-widgets.js': {
      type: 'chunk',
      code: 'import { onMount, createEventDispatcher } from "svelte"; import axios from "axios"; import lodash from "lodash";',
      imports: ['svelte', 'axios', 'lodash'],
      size: 45000
    },
    'solid-components.js': {
      type: 'chunk',
      code: 'import { createSignal, createEffect } from "solid-js"; import axios from "axios";',
      imports: ['solid-js', 'axios'],
      size: 35000
    },
    'shared-utilities.js': {
      type: 'chunk',
      code: 'import lodash from "lodash"; import moment from "moment"; import axios from "axios";',
      imports: ['lodash', 'moment', 'axios'],
      size: 40000
    },
    'vendor-libs.js': {
      type: 'chunk',
      code: 'import "react"; import "vue"; import "lodash"; import "axios"; import "moment";',
      imports: ['react', 'vue', 'lodash', 'axios', 'moment'],
      size: 250000
    }
  };

  const result = await orchestrator.optimize(complexBundle);

  console.log('📈 Advanced Optimization Results:');
  console.log(`- Original total size: ${Math.floor(result.performanceReport.beforeOptimization.totalSize / 1024)}KB`);
  console.log(`- Optimized total size: ${Math.floor(result.performanceReport.afterOptimization.totalSize / 1024)}KB`);
  console.log(`- Size reduction: ${Math.floor(result.performanceReport.improvements.sizeReduction * 100)}%`);
  console.log(`- Load time reduction: ${Math.floor(result.performanceReport.improvements.loadTimeReduction * 100)}%`);
  console.log(`- Cache hit rate improvement: ${Math.floor(result.performanceReport.improvements.cacheImprovement * 100)}%`);

  console.log('\n🔗 Shared Dependencies:');
  result.finalBundleManifest.sharedChunks.forEach(chunk => {
    console.log(`- ${chunk.name}: ${Math.floor(chunk.size / 1024)}KB (${chunk.frameworks.join(', ')})`);
  });

  console.log('\n🌐 HTTP/2 Optimization:');
  result.finalBundleManifest.loadingSequences.forEach(sequence => {
    console.log(`- ${sequence.phase}: ${sequence.bundles.length} bundles, ${sequence.maxParallel} parallel`);
  });

  console.log('\n💾 Cache Strategies:');
  const strategies = result.cacheOptimization.strategies.slice(0, 5);
  strategies.forEach(strategy => {
    console.log(`- ${strategy.bundleName}: ${strategy.strategy} (${Math.floor(strategy.maxAge / (60 * 60 * 1000))}h)`);
  });

  console.log('\n⚠️ Critical Recommendations:');
  result.recommendations.critical.forEach((rec, i) => {
    console.log(`${i + 1}. ${rec}`);
  });

  return result;
}

/**
 * Example: Performance Target Validation
 */
export async function performanceTargetValidationExample() {
  console.log('\n🎯 Performance Target Validation Example');

  // Strict performance targets
  const strictConfig = {
    performanceTargets: {
      maxInitialBundleSize: 100 * 1024, // 100KB - very strict
      targetCacheHitRate: 0.9, // 90% cache hit rate
      maxLoadTime: 1000, // 1 second max load time
      minCompressionRatio: 0.2 // 80% compression minimum
    }
  };

  const bundle = {
    'large-app.js': {
      type: 'chunk',
      code: 'import React from "react"; import Vue from "vue"; import lodash from "lodash";',
      imports: ['react', 'vue', 'lodash'],
      size: 180000 // Exceeds target
    }
  };

  const result = await optimizeBundle(bundle, strictConfig);

  console.log('🎯 Performance Target Analysis:');
  console.log(`- Target bundle size: ${strictConfig.performanceTargets.maxInitialBundleSize / 1024}KB`);
  console.log(`- Actual bundle size: ${Math.floor(result.performanceReport.afterOptimization.totalSize / 1024)}KB`);
  
  const meetsTarget = result.performanceReport.afterOptimization.totalSize <= strictConfig.performanceTargets.maxInitialBundleSize;
  console.log(`- Meets size target: ${meetsTarget ? '✅' : '❌'}`);

  console.log('\n📋 Target-Based Recommendations:');
  const targetRecommendations = result.recommendations.critical.filter(rec => 
    rec.toLowerCase().includes('size') || 
    rec.toLowerCase().includes('split') ||
    rec.toLowerCase().includes('target')
  );
  
  targetRecommendations.forEach((rec, i) => {
    console.log(`${i + 1}. ${rec}`);
  });

  return result;
}

/**
 * Run all bundle optimization examples
 */
export async function runBundleOptimizationExamples() {
  console.log('🎉 Bundle Optimization System Examples\n');
  console.log('=' .repeat(60));

  try {
    await basicBundleOptimizationExample();
    console.log('\n' + '=' .repeat(60));
    
    await advancedBundleOptimizationExample();
    console.log('\n' + '=' .repeat(60));
    
    await performanceTargetValidationExample();
    console.log('\n' + '=' .repeat(60));

    console.log('\n✅ All bundle optimization examples completed successfully!');
    console.log('\n📚 Key Features Demonstrated:');
    console.log('- Intelligent bundling with shared dependency extraction');
    console.log('- Framework-specific chunk splitting for optimal caching');
    console.log('- HTTP/2 multiplexing optimization with server push');
    console.log('- Cache strategy optimization for maximum hit rates');
    console.log('- Performance target validation and recommendations');
    console.log('- Comprehensive metrics and reporting');

  } catch (error) {
    console.error('❌ Error running bundle optimization examples:', error);
    throw error;
  }
}

// Export for use in other examples or tests
export {
  BundleOptimizationOrchestrator,
  createBundleOptimizer,
  optimizeBundle
};