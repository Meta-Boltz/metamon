/**
 * Integration test for Route Manifest Generator with real .mtm files
 */

import { createRouteManifestGenerator } from './src/build-tools/route-manifest-generator.js';
import { join } from 'path';

async function testRouteManifestGenerator() {
  console.log('🚀 Testing Route Manifest Generator with real .mtm files...\n');

  const generator = createRouteManifestGenerator({
    pagesDir: join(process.cwd(), 'src/pages'),
    outputFormat: 'json',
    optimizeForProduction: false,
    i18nSupport: true
  });

  try {
    // Generate route manifest from actual pages
    const manifest = await generator.generateRouteManifest();

    console.log(`📊 Generated manifest with ${manifest.totalRoutes} routes:\n`);

    // Display static routes
    console.log('📄 Static Routes:');
    Object.entries(manifest.staticRoutes).forEach(([route, info]) => {
      console.log(`  ${route} -> ${info.component}`);
      console.log(`    Title: ${info.title}`);
      console.log(`    Status: ${info.status}`);
      console.log(`    Preload: ${info.preload}`);
      console.log('');
    });

    // Display dynamic routes
    if (manifest.dynamicRoutes.length > 0) {
      console.log('🔄 Dynamic Routes:');
      manifest.dynamicRoutes.forEach(route => {
        console.log(`  ${route.template} -> ${route.component}`);
        console.log(`    Parameters: [${route.parameters.join(', ')}]`);
        console.log(`    Pattern: ${route.pattern}`);
        console.log('');
      });
    }

    // Display fallback routes
    if (manifest.fallbackRoutes.length > 0) {
      console.log('🚫 Fallback Routes:');
      manifest.fallbackRoutes.forEach(route => {
        console.log(`  Status ${route.status}: ${route.title}`);
        console.log(`    Component: ${route.component}`);
        console.log(`    Pattern: ${route.pattern}`);
        console.log('');
      });
    }

    // Display i18n routes
    if (Object.keys(manifest.i18nRoutes).length > 0) {
      console.log('🌍 I18n Routes:');
      Object.entries(manifest.i18nRoutes).forEach(([locale, routes]) => {
        console.log(`  ${locale}: ${routes.routes.length} routes`);
        console.log(`    Default: ${routes.defaultRoute.route}`);
      });
      console.log('');
    }

    // Display metadata
    console.log('📋 Manifest Metadata:');
    console.log(`  Keywords: [${manifest.metadata.keywords.join(', ')}]`);
    console.log(`  Layouts: [${manifest.metadata.layouts.join(', ')}]`);
    console.log(`  Locales: [${manifest.metadata.locales.join(', ')}]`);
    console.log(`  Total Size: ${manifest.metadata.totalSize} bytes`);
    console.log(`  Generated: ${manifest.generatedAt}`);
    console.log('');

    // Test export formats
    console.log('📤 Testing export formats...');

    const jsonExport = generator.exportManifest(manifest, 'json');
    console.log(`JSON export: ${jsonExport.length} characters`);

    const jsExport = generator.exportManifest(manifest, 'js');
    console.log(`JS export: ${jsExport.length} characters`);

    const tsExport = generator.exportManifest(manifest, 'ts');
    console.log(`TS export: ${tsExport.length} characters`);

    // Test TypeScript definitions
    const typeDefs = generator.generateTypeDefinitions(manifest);
    console.log(`TypeScript definitions: ${typeDefs.length} characters`);
    console.log('');

    // Test production optimization
    console.log('⚡ Testing production optimization...');
    const prodManifest = JSON.parse(JSON.stringify(manifest)); // Deep clone
    generator.optimizeManifest(prodManifest);

    const originalSize = JSON.stringify(manifest).length;
    const optimizedSize = JSON.stringify(prodManifest).length;
    const savings = originalSize - optimizedSize;

    console.log(`Original size: ${originalSize} characters`);
    console.log(`Optimized size: ${optimizedSize} characters`);
    console.log(`Savings: ${savings} characters (${((savings / originalSize) * 100).toFixed(1)}%)`);
    console.log('');

    // Clean up
    generator.close();

    console.log('✅ Route Manifest Generator integration test completed successfully!');
    return true;

  } catch (error) {
    console.error('❌ Route Manifest Generator integration test failed:', error);
    generator.close();
    return false;
  }
}

// Run the test
testRouteManifestGenerator()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
  });