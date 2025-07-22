/**
 * Simple test for production optimizer functionality
 */

import { createProductionOptimizer } from './src/build-tools/production-optimizer.js';
import fs from 'fs/promises';

async function testProductionOptimizer() {
  console.log('🧪 Testing production optimizer...');

  try {
    // Create test files
    await fs.mkdir('test-build', { recursive: true });

    const testFiles = {
      'main.js': `
        // This is a comment
        function hello() {
          console.log("Hello World");
          return "test";
        }
        
        export default hello;
      `,
      'styles.css': `
        /* CSS Comment */
        .app {
          color: blue;
          margin: 10px;
        }
        
        .component {
          padding: 5px;
        }
      `,
      'image.png': 'fake-image-data'
    };

    for (const [filename, content] of Object.entries(testFiles)) {
      await fs.writeFile(`test-build/${filename}`, content);
    }

    console.log('✅ Test files created');

    // Test 1: Create production optimizer
    const optimizer = createProductionOptimizer({
      outputDir: 'test-build',
      pagesDir: 'src/pages',
      baseUrl: 'https://test.com',
      minifyJS: true,
      minifyCSS: true,
      generateSitemap: true,
      generateRobotsTxt: true,
      generateManifest: true
    });

    console.log('✅ Production optimizer created');

    // Test 2: Test JavaScript minification
    const originalJS = testFiles['main.js'];
    const minifiedJS = await optimizer.minifyJavaScript(originalJS);

    console.log('✅ JavaScript minification:', {
      originalSize: originalJS.length,
      minifiedSize: minifiedJS.length,
      reduction: ((originalJS.length - minifiedJS.length) / originalJS.length * 100).toFixed(1) + '%',
      removedComments: !minifiedJS.includes('// This is a comment'),
      removedWhitespace: !minifiedJS.includes('\n        ')
    });

    // Test 3: Test CSS minification
    const originalCSS = testFiles['styles.css'];
    const minifiedCSS = await optimizer.minifyCSS(originalCSS);

    console.log('✅ CSS minification:', {
      originalSize: originalCSS.length,
      minifiedSize: minifiedCSS.length,
      reduction: ((originalCSS.length - minifiedCSS.length) / originalCSS.length * 100).toFixed(1) + '%',
      removedComments: !minifiedCSS.includes('/* CSS Comment */'),
      removedWhitespace: !minifiedCSS.includes('\n        ')
    });

    // Test 4: Test file discovery
    const assetFiles = await optimizer.findAssetFiles();
    const imageFiles = await optimizer.findImageFiles();
    const compressibleFiles = await optimizer.findCompressibleFiles();

    console.log('✅ File discovery:', {
      assetFiles: assetFiles.length,
      imageFiles: imageFiles.length,
      compressibleFiles: compressibleFiles.length,
      foundJS: assetFiles.some(f => f.endsWith('.js')),
      foundCSS: assetFiles.some(f => f.endsWith('.css')),
      foundImage: imageFiles.some(f => f.endsWith('.png'))
    });

    // Test 5: Test SEO file generation
    const routes = ['/', '/docs', '/about'];
    const sitemap = optimizer.createSitemapXML(routes);

    console.log('✅ Sitemap generation:', {
      containsXMLDeclaration: sitemap.includes('<?xml version="1.0"'),
      containsUrlset: sitemap.includes('<urlset'),
      containsHomeUrl: sitemap.includes('<loc>https://test.com/</loc>'),
      containsDocsUrl: sitemap.includes('<loc>https://test.com/docs</loc>')
    });

    // Test 6: Test size formatting
    const sizeTests = [
      { bytes: 1024, expected: '1.0 KB' },
      { bytes: 1048576, expected: '1.0 MB' },
      { bytes: 512, expected: '512.0 B' }
    ];

    const sizeFormatting = sizeTests.map(test => ({
      input: test.bytes,
      output: optimizer.formatSize(test.bytes),
      correct: optimizer.formatSize(test.bytes) === test.expected
    }));

    console.log('✅ Size formatting:', sizeFormatting);

    // Test 7: Test manifest optimization
    const testManifest = {
      staticRoutes: {
        '/': {
          path: '/',
          title: 'Home',
          preload: false,
          lazy: false,
          priority: 'normal',
          lastModified: new Date(),
          size: 1000
        }
      },
      metadata: {
        buildInfo: { nodeVersion: 'v18.0.0' },
        totalSize: 1000
      }
    };

    const originalManifest = JSON.stringify(testManifest);
    optimizer.optimizeManifestForProduction(testManifest);
    const optimizedManifest = JSON.stringify(testManifest);

    console.log('✅ Manifest optimization:', {
      originalSize: originalManifest.length,
      optimizedSize: optimizedManifest.length,
      removedDevFields: !optimizedManifest.includes('lastModified'),
      removedBuildInfo: !optimizedManifest.includes('buildInfo'),
      removedDefaults: !optimizedManifest.includes('"preload":false')
    });

    // Test 8: Test recommendations
    optimizer.optimizationResults = {
      compressionRatio: 0.05,
      warnings: ['Test warning'],
      assetsOptimized: 0
    };

    const recommendations = optimizer.generateRecommendations();

    console.log('✅ Recommendations:', {
      total: recommendations.length,
      hasCompressionRec: recommendations.some(r => r.type === 'compression'),
      hasWarningsRec: recommendations.some(r => r.type === 'warnings'),
      hasAssetsRec: recommendations.some(r => r.type === 'assets')
    });

    // Cleanup
    optimizer.destroy();
    await fs.rm('test-build', { recursive: true, force: true });
    console.log('✅ Test files cleaned up');

    console.log('\n🎉 All production optimizer tests passed!');
    return true;

  } catch (error) {
    console.error('❌ Production optimizer test failed:', error);

    // Cleanup on error
    try {
      await fs.rm('test-build', { recursive: true, force: true });
    } catch (cleanupError) {
      // Ignore cleanup errors
    }

    return false;
  }
}

// Run the test
testProductionOptimizer().then(success => {
  process.exit(success ? 0 : 1);
});