/**
 * Integration test for Page Scanner with real .mtm files
 */

import { createPageScanner } from './src/build-tools/page-scanner.js';
import { join } from 'path';

async function testPageScanner() {
  console.log('🔍 Testing Page Scanner with real .mtm files...\n');

  const scanner = createPageScanner({
    pagesDir: join(process.cwd(), 'src/pages'),
    watchMode: false
  });

  try {
    // Scan the actual pages directory
    const pages = await scanner.scanPages();

    console.log(`📄 Found ${pages.length} pages:\n`);

    pages.forEach((page, index) => {
      console.log(`${index + 1}. ${page.title}`);
      console.log(`   Route: ${page.route}`);
      console.log(`   File: ${page.filePath}`);
      console.log(`   Status: ${page.status}`);
      console.log(`   Dynamic: ${page.isDynamic}`);
      if (page.parameters.length > 0) {
        console.log(`   Parameters: [${page.parameters.join(', ')}]`);
      }
      console.log(`   Keywords: [${page.keywords.join(', ')}]`);
      console.log(`   Locales: [${page.locales.join(', ')}]`);
      if (page.errors.length > 0) {
        console.log(`   ⚠️ Errors: ${page.errors.length}`);
        page.errors.forEach(error => {
          console.log(`      - ${error.message}`);
        });
      }
      console.log('');
    });

    // Test route conflict detection
    console.log('🔍 Testing route conflict detection...');
    const routes = new Set();
    let conflicts = 0;

    pages.forEach(page => {
      if (routes.has(page.route)) {
        console.log(`❌ Route conflict detected: ${page.route}`);
        conflicts++;
      } else {
        routes.add(page.route);
      }
    });

    if (conflicts === 0) {
      console.log('✅ No route conflicts detected');
    }

    // Test dynamic route detection
    console.log('\n🔍 Testing dynamic route detection...');
    const dynamicPages = pages.filter(page => page.isDynamic);
    const staticPages = pages.filter(page => !page.isDynamic);

    console.log(`📊 Static pages: ${staticPages.length}`);
    console.log(`📊 Dynamic pages: ${dynamicPages.length}`);

    if (dynamicPages.length > 0) {
      console.log('\nDynamic pages:');
      dynamicPages.forEach(page => {
        console.log(`  - ${page.route} (${page.parameters.join(', ')})`);
      });
    }

    // Test cache functionality
    console.log('\n🔍 Testing cache functionality...');
    const cacheStats = scanner.getCacheStats();
    console.log(`Cache size: ${cacheStats.cacheSize}`);
    console.log(`Route registry size: ${cacheStats.routeRegistrySize}`);

    // Test scanning the same directory again (should use cache)
    console.log('\n🔍 Testing cache usage...');
    const startTime = Date.now();
    const cachedPages = await scanner.scanPages();
    const endTime = Date.now();

    console.log(`Second scan completed in ${endTime - startTime}ms`);
    console.log(`Pages found: ${cachedPages.length} (should be same as first scan)`);

    // Clean up
    scanner.close();

    console.log('\n✅ Page Scanner integration test completed successfully!');
    return true;

  } catch (error) {
    console.error('❌ Page Scanner integration test failed:', error);
    scanner.close();
    return false;
  }
}

// Run the test
testPageScanner()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
  });