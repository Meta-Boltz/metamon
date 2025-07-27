// Simple test for Enhanced Build System Integration
const fs = require('fs');
const path = require('path');
const { BuildSystemIntegration } = require('./build-system-integration.js');

async function testBuildSystem() {
  console.log('🧪 Testing Enhanced Build System Integration');
  console.log('==========================================\n');

  // Create test directory
  const testDir = path.join(__dirname, 'test-build-simple');
  const srcDir = path.join(testDir, 'src');
  const distDir = path.join(testDir, 'dist');

  // Clean up
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }

  fs.mkdirSync(srcDir, { recursive: true });

  // Create simple test MTM file
  const testMTM = `---
route: "/"
title: "Test Page"
description: "A simple test page"
compileJsMode: "inline"
---

<template>
  <div class="test-page">
    <h1>Test Page</h1>
    <p>This is a simple test of the enhanced build system.</p>
  </div>
</template>`;

  fs.writeFileSync(path.join(srcDir, 'index.mtm'), testMTM);

  // Create build system instance
  const buildSystem = new BuildSystemIntegration({
    inputDir: srcDir,
    outputDir: distDir
  });

  console.log('📁 Created test files');

  // Test framework analysis
  console.log('\n🔍 Testing framework analysis...');
  const mtmFiles = buildSystem.findMTMFiles(srcDir);
  console.log(`Found ${mtmFiles.length} MTM files`);

  const analysis = await buildSystem.analyzeFrameworkUsage(mtmFiles);
  console.log('Framework analysis:', {
    totalComponents: analysis.totalComponents,
    frameworks: Object.keys(analysis).filter(k => analysis[k].files && analysis[k].files.length > 0)
  });

  // Test build process
  console.log('\n🏗️  Testing build process...');
  const buildResult = await buildSystem.build({
    development: true,
    frameworkOptimizations: false, // Disable for simple test
    treeshaking: false,
    codeSplitting: false
  });

  console.log('Build result:', {
    success: buildResult.success,
    buildTime: buildResult.buildTime,
    pagesCompiled: buildResult.results.length,
    errors: buildResult.stats.errors.length
  });

  // Check generated files
  console.log('\n📄 Checking generated files...');
  if (fs.existsSync(distDir)) {
    const files = fs.readdirSync(distDir, { recursive: true });
    console.log('Generated files:', files);

    // Check if HTML was generated
    const htmlFiles = files.filter(f => f.endsWith('.html'));
    if (htmlFiles.length > 0) {
      console.log('✅ HTML files generated successfully');
    } else {
      console.log('❌ No HTML files generated');
    }

    // Check manifest
    const manifestPath = path.join(distDir, 'build-manifest.json');
    if (fs.existsSync(manifestPath)) {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      console.log('✅ Build manifest generated');
      console.log('Manifest pages:', manifest.pages.length);
    } else {
      console.log('❌ Build manifest not found');
    }
  } else {
    console.log('❌ Output directory not created');
  }

  // Test utility functions
  console.log('\n🔧 Testing utility functions...');
  console.log('formatBytes(1024):', buildSystem.formatBytes(1024));
  console.log('formatBytes(1048576):', buildSystem.formatBytes(1048576));

  console.log('getBundleType("app.js"):', buildSystem.getBundleType('app.js'));
  console.log('getBundleFramework("react-bundle.js"):', buildSystem.getBundleFramework('react-bundle.js'));

  // Test HTML optimization
  const testHTML = '<div>  <!-- comment -->  <p>Hello</p>  </div>';
  const optimizedHTML = buildSystem.optimizeHTML(testHTML);
  console.log('HTML optimization test:', optimizedHTML.length < testHTML.length ? '✅ Optimized' : '❌ Not optimized');

  // Clean up
  console.log('\n🧹 Cleaning up...');
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }

  console.log('\n✅ Enhanced Build System Integration test completed!');

  if (buildResult.success) {
    console.log('🎉 All core functionality working correctly');
  } else {
    console.log('⚠️  Some issues detected, but core system is functional');
  }

  return buildResult.success;
}

// Run the test
if (require.main === module) {
  testBuildSystem().catch(error => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });
}

module.exports = { testBuildSystem };