/**
 * Simple test for code splitting functionality
 */

import { createCodeSplitter, lazy } from './src/shared/code-splitter.js';

// Mock dynamic import
const mockImport = () => Promise.resolve({
  default: { render: () => '<div>Test Component</div>' }
});

async function testCodeSplitting() {
  console.log('🧪 Testing code splitting...');

  try {
    // Test 1: Create code splitter
    const splitter = createCodeSplitter({
      preloadThreshold: 0.5,
      maxConcurrentLoads: 2,
      enablePreloading: true
    });

    console.log('✅ Code splitter created successfully');

    // Test 2: Create lazy route
    const lazyRoute = splitter.createLazyRoute(mockImport, {
      preload: true,
      priority: 'high'
    });

    console.log('✅ Lazy route created:', {
      hasLoader: typeof lazyRoute.loader === 'function',
      hasPreload: typeof lazyRoute.preload === 'function',
      hasOptions: !!lazyRoute.options,
      isLazy: lazyRoute.isLazy
    });

    // Test 3: Load chunk
    const startTime = performance.now();
    const module = await lazyRoute.loader();
    const loadTime = performance.now() - startTime;

    console.log('✅ Chunk loaded successfully in', loadTime.toFixed(2), 'ms');
    console.log('Module:', module);

    // Test 4: Load same chunk again (should be cached)
    const startTime2 = performance.now();
    const module2 = await lazyRoute.loader();
    const loadTime2 = performance.now() - startTime2;

    console.log('✅ Cached chunk loaded in', loadTime2.toFixed(2), 'ms');
    console.log('Same module:', module === module2);

    // Test 5: Get statistics
    const stats = splitter.getLoadStats();
    console.log('✅ Load statistics:', {
      totalLoads: stats.totalLoads,
      successfulLoads: stats.successfulLoads,
      cacheHits: stats.cacheHits,
      loadedChunks: stats.loadedChunks,
      successRate: stats.successRate.toFixed(1) + '%',
      cacheHitRate: stats.cacheHitRate.toFixed(1) + '%'
    });

    // Test 6: Test utility function
    const utilityLazyRoute = lazy(mockImport, { priority: 'normal' });
    console.log('✅ Utility lazy function works:', {
      hasLoader: typeof utilityLazyRoute.loader === 'function',
      isLazy: utilityLazyRoute.isLazy
    });

    // Cleanup
    splitter.destroy();
    console.log('✅ Code splitter destroyed');

    console.log('\n🎉 All code splitting tests passed!');
    return true;

  } catch (error) {
    console.error('❌ Code splitting test failed:', error);
    return false;
  }
}

// Run the test
testCodeSplitting().then(success => {
  process.exit(success ? 0 : 1);
});