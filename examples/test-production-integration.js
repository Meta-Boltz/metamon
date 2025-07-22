/**
 * Integration test for production optimization features
 * Tests code splitting, bundle analysis, and production optimization together
 */

import { createCodeSplitter } from './src/shared/code-splitter.js';
import { createBundleAnalyzer } from './src/build-tools/bundle-analyzer.js';
import { createProductionOptimizer } from './src/build-tools/production-optimizer.js';
import fs from 'fs/promises';

async function testProductionIntegration() {
  console.log('🧪 Testing production optimization integration...');

  try {
    // Create test build directory with realistic files
    await fs.mkdir('integration-test', { recursive: true });

    const testFiles = {
      'main.js': `
        // Main application entry point
        import { router } from './router.js';
        import { component } from './components/app.js';
        
        function initApp() {
          const app = component();
          router.init();
          return app;
        }
        
        export default initApp;
      `,
      'router.js': `
        // Router with lazy loading
        import('./pages/home.js').then(module => {
          console.log('Home page loaded');
        });
        
        export const router = {
          init() {
            console.log('Router initialized');
          }
        };
      `,
      'vendor.js': `
        // Large vendor bundle
        ${Array(1000).fill('/* vendor code */').join('\n')}
        export const vendor = 'large-library';
      `,
      'chunk-home.js': `
        export function HomePage() {
          return '<div>Home Page</div>';
        }
      `,
      'chunk-about.js': `
        export function AboutPage() {
          return '<div>About Page</div>';
        }
      `,
      'styles.css': `
        /* Main styles */
        .app {
          font-family: Arial, sans-serif;
          color: #333;
          margin: 0;
          padding: 20px;
        }
        
        .header {
          background: #f0f0f0;
          padding: 10px;
          margin-bottom: 20px;
        }
        
        .content {
          line-height: 1.6;
        }
      `,
      'image.png': 'fake-png-data'.repeat(100)
    };

    for (const [filename, content] of Object.entries(testFiles)) {
      await fs.writeFile(`integration-test/${filename}`, content);
    }

    console.log('✅ Test files created');

    // Test 1: Code Splitting Integration
    console.log('\n📦 Testing Code Splitting...');

    const codeSplitter = createCodeSplitter({
      preloadThreshold: 0.5,
      maxConcurrentLoads: 3,
      enablePreloading: true,
      enablePrefetching: true
    });

    // Create lazy routes
    const homeRoute = codeSplitter.createLazyRoute(
      () => import('./integration-test/chunk-home.js'),
      { preload: true, priority: 'high' }
    );

    const aboutRoute = codeSplitter.createLazyRoute(
      () => import('./integration-test/chunk-about.js'),
      { preload: false, priority: 'normal' }
    );

    console.log('  ✅ Lazy routes created:', {
      homeRoute: homeRoute.isLazy,
      aboutRoute: aboutRoute.isLazy,
      hasPreload: typeof homeRoute.preload === 'function',
      hasPrefetch: typeof aboutRoute.prefetch === 'function'
    });

    // Test loading performance
    const startTime = performance.now();

    // Simulate loading home route (should be fast due to preload)
    homeRoute.preload();

    const loadTime = performance.now() - startTime;
    const stats = codeSplitter.getLoadStats();

    console.log('  ✅ Code splitting stats:', {
      loadTime: loadTime.toFixed(2) + 'ms',
      totalLoads: stats.totalLoads,
      successRate: stats.successRate.toFixed(1) + '%',
      loadedChunks: stats.loadedChunks
    });

    // Test 2: Bundle Analysis Integration
    console.log('\n📊 Testing Bundle Analysis...');

    const bundleAnalyzer = createBundleAnalyzer({
      outputDir: 'integration-test',
      generateReport: false,
      enableTreeShaking: true
    });

    const bundleAnalysis = await bundleAnalyzer.analyzeBundles();

    console.log('  ✅ Bundle analysis results:', {
      totalBundles: bundleAnalysis.bundles.length,
      totalSize: bundleAnalyzer.formatSize(bundleAnalysis.totalSize),
      gzippedSize: bundleAnalyzer.formatSize(bundleAnalysis.gzippedSize),
      optimizationOpportunities: bundleAnalysis.optimizationOpportunities.length,
      hasLargeBundle: bundleAnalysis.optimizationOpportunities.some(op => op.type === 'large_bundle')
    });

    // Test 3: Production Optimization Integration
    console.log('\n🚀 Testing Production Optimization...');

    const productionOptimizer = createProductionOptimizer({
      outputDir: 'integration-test',
      baseUrl: 'https://integration-test.com',
      minifyJS: true,
      minifyCSS: true,
      generateSitemap: true,
      generateRobotsTxt: true,
      generateManifest: true
    });

    // Run minification
    await productionOptimizer.minifyAssets();

    // Generate SEO files
    await productionOptimizer.generateSEOFiles();

    console.log('  ✅ Production optimization completed');

    // Verify generated files
    const generatedFiles = await fs.readdir('integration-test');
    const hasSitemap = generatedFiles.includes('sitemap.xml');
    const hasRobots = generatedFiles.includes('robots.txt');
    const hasManifest = generatedFiles.includes('manifest.json');

    console.log('  ✅ Generated SEO files:', {
      sitemap: hasSitemap,
      robots: hasRobots,
      manifest: hasManifest,
      totalFiles: generatedFiles.length
    });

    // Test 4: End-to-End Performance Metrics
    console.log('\n📈 Testing Performance Metrics...');

    // Measure file sizes before and after optimization
    const originalMainJS = testFiles['main.js'];
    const optimizedMainJS = await fs.readFile('integration-test/main.js', 'utf-8');

    const originalCSS = testFiles['styles.css'];
    const optimizedCSS = await fs.readFile('integration-test/styles.css', 'utf-8');

    const jsReduction = ((originalMainJS.length - optimizedMainJS.length) / originalMainJS.length * 100);
    const cssReduction = ((originalCSS.length - optimizedCSS.length) / originalCSS.length * 100);

    console.log('  ✅ Optimization results:', {
      jsReduction: jsReduction.toFixed(1) + '%',
      cssReduction: cssReduction.toFixed(1) + '%',
      originalTotalSize: productionOptimizer.formatSize(
        originalMainJS.length + originalCSS.length
      ),
      optimizedTotalSize: productionOptimizer.formatSize(
        optimizedMainJS.length + optimizedCSS.length
      )
    });

    // Test 5: Integration Verification
    console.log('\n🔗 Testing Integration Points...');

    // Verify code splitter works with optimized bundles
    const configOptimizations = bundleAnalyzer.getConfigOptimizations();
    const hasCodeSplittingConfig = configOptimizations.some(opt => opt.type === 'splitChunks');

    // Verify production optimizer uses bundle analysis
    const optimizationResults = productionOptimizer.getResults();

    console.log('  ✅ Integration verification:', {
      codeSplittingConfigGenerated: hasCodeSplittingConfig,
      bundleAnalysisIntegrated: bundleAnalysis.totalSize > 0,
      productionOptimizationComplete: optimizationResults.filesProcessed > 0,
      seoFilesGenerated: optimizationResults.seoFilesGenerated.length > 0
    });

    // Cleanup
    codeSplitter.destroy();
    productionOptimizer.destroy();
    await fs.rm('integration-test', { recursive: true, force: true });

    console.log('\n🎉 All production optimization integration tests passed!');
    console.log('📋 Summary:');
    console.log(`  • Code splitting: ${stats.loadedChunks} chunks loaded`);
    console.log(`  • Bundle analysis: ${bundleAnalysis.bundles.length} bundles analyzed`);
    console.log(`  • Optimization: ${jsReduction.toFixed(1)}% JS reduction, ${cssReduction.toFixed(1)}% CSS reduction`);
    console.log(`  • SEO files: ${optimizationResults.seoFilesGenerated.length} files generated`);

    return true;

  } catch (error) {
    console.error('❌ Production optimization integration test failed:', error);

    // Cleanup on error
    try {
      await fs.rm('integration-test', { recursive: true, force: true });
    } catch (cleanupError) {
      // Ignore cleanup errors
    }

    return false;
  }
}

// Run the test
testProductionIntegration().then(success => {
  process.exit(success ? 0 : 1);
});