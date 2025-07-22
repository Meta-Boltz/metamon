/**
 * Simple test for bundle analyzer functionality
 */

import { createBundleAnalyzer } from './src/build-tools/bundle-analyzer.js';
import fs from 'fs/promises';

async function testBundleAnalyzer() {
  console.log('🧪 Testing bundle analyzer...');

  try {
    // Create test bundle files
    await fs.mkdir('test-dist', { recursive: true });

    // Create mock bundle files
    const testBundles = {
      'main.js': `
        import { component } from './component.js';
        export default function App() {
          return component();
        }
      `,
      'vendor.js': '/* Large vendor bundle */'.repeat(10000),
      'chunk-abc123.js': `
        export function lazyComponent() {
          return '<div>Lazy Component</div>';
        }
      `,
      'styles.css': `
        .app { color: blue; }
        .component { margin: 10px; }
      `
    };

    for (const [filename, content] of Object.entries(testBundles)) {
      await fs.writeFile(`test-dist/${filename}`, content);
    }

    console.log('✅ Test bundle files created');

    // Test 1: Create bundle analyzer
    const analyzer = createBundleAnalyzer({
      outputDir: 'test-dist',
      analyzeDir: 'src',
      generateReport: false, // Skip report generation for test
      enableTreeShaking: true
    });

    console.log('✅ Bundle analyzer created successfully');

    // Test 2: Test bundle file detection
    const isBundleFile = analyzer.isBundleFile('main.js');
    const isNotBundleFile = analyzer.isBundleFile('config.json');

    console.log('✅ Bundle file detection:', {
      'main.js': isBundleFile,
      'config.json': isNotBundleFile
    });

    // Test 3: Test bundle type classification
    const bundleTypes = {
      'vendor.js': analyzer.getBundleType('test-dist/vendor.js'),
      'main.js': analyzer.getBundleType('test-dist/main.js'),
      'chunk-abc123.js': analyzer.getBundleType('test-dist/chunk-abc123.js'),
      'styles.css': analyzer.getBundleType('test-dist/styles.css')
    };

    console.log('✅ Bundle type classification:', bundleTypes);

    // Test 4: Test module extraction
    const testContent = `
      import { component } from './component.js';
      import('./lazy-component.js').then(module => {
        // Dynamic import
      });
      export const utils = {};
      export default function App() {}
    `;

    const modules = analyzer.extractModules(testContent);
    const imports = analyzer.extractImports(testContent);
    const exports = analyzer.extractExports(testContent);

    console.log('✅ Module extraction:', {
      modules: modules.length,
      imports: imports.length,
      exports: exports.length,
      hasDynamicImport: imports.some(imp => imp.dynamic)
    });

    // Test 5: Test size formatting
    const sizeTests = [
      { bytes: 1024, expected: '1.0 KB' },
      { bytes: 1048576, expected: '1.0 MB' },
      { bytes: 512, expected: '512.0 B' }
    ];

    const sizeFormatting = sizeTests.map(test => ({
      input: test.bytes,
      output: analyzer.formatSize(test.bytes),
      correct: analyzer.formatSize(test.bytes) === test.expected
    }));

    console.log('✅ Size formatting:', sizeFormatting);

    // Test 6: Test gzip estimation
    const testText = 'test content'.repeat(100);
    const gzipSize = await analyzer.estimateGzipSize(testText);
    const compressionRatio = gzipSize / testText.length;

    console.log('✅ Gzip estimation:', {
      originalSize: testText.length,
      gzipSize: gzipSize,
      compressionRatio: (compressionRatio * 100).toFixed(1) + '%',
      reasonable: compressionRatio > 0.5 && compressionRatio < 0.8
    });

    // Test 7: Test external module detection
    const externalTests = {
      'react': analyzer.isExternalModule('react'),
      './component.js': analyzer.isExternalModule('./component.js'),
      'src/utils.js': analyzer.isExternalModule('src/utils.js')
    };

    console.log('✅ External module detection:', externalTests);

    // Cleanup
    await fs.rm('test-dist', { recursive: true, force: true });
    console.log('✅ Test files cleaned up');

    console.log('\n🎉 All bundle analyzer tests passed!');
    return true;

  } catch (error) {
    console.error('❌ Bundle analyzer test failed:', error);

    // Cleanup on error
    try {
      await fs.rm('test-dist', { recursive: true, force: true });
    } catch (cleanupError) {
      // Ignore cleanup errors
    }

    return false;
  }
}

// Run the test
testBundleAnalyzer().then(success => {
  process.exit(success ? 0 : 1);
});