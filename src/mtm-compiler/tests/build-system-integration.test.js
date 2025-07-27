// Integration tests for Enhanced Build System Integration
const fs = require('fs');
const path = require('path');
const { BuildSystemIntegration } = require('../build-system-integration.js');

describe('Enhanced Build System Integration', () => {
  let buildSystem;
  let tempDir;

  beforeEach(() => {
    // Create temporary directory for tests
    tempDir = path.join(__dirname, 'temp-build-test');
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    fs.mkdirSync(tempDir, { recursive: true });

    buildSystem = new BuildSystemIntegration({
      inputDir: path.join(tempDir, 'src'),
      outputDir: path.join(tempDir, 'dist')
    });
  });

  afterEach(() => {
    // Clean up temporary directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('Framework Analysis', () => {
    test('should analyze framework usage across MTM files', async () => {
      // Create test MTM files
      const srcDir = path.join(tempDir, 'src');
      fs.mkdirSync(srcDir, { recursive: true });

      const reactFile = `---
route: "/react-page"
title: "React Page"
---
import Counter from "@components/Counter.tsx"

<template>
  <div>
    <h1>React Page</h1>
    <Counter initialValue={0} />
  </div>
</template>`;

      const vueFile = `---
route: "/vue-page"
title: "Vue Page"
---
import TodoList from "@components/TodoList.vue"

<template>
  <div>
    <h1>Vue Page</h1>
    <TodoList items={[]} />
  </div>
</template>`;

      fs.writeFileSync(path.join(srcDir, 'react-page.mtm'), reactFile);
      fs.writeFileSync(path.join(srcDir, 'vue-page.mtm'), vueFile);

      const mtmFiles = buildSystem.findMTMFiles(srcDir);
      const analysis = await buildSystem.analyzeFrameworkUsage(mtmFiles);

      expect(analysis.react.files).toHaveLength(1);
      expect(analysis.vue.files).toHaveLength(1);
      expect(analysis.totalComponents).toBe(2);
    });

    test('should identify shared components', async () => {
      const srcDir = path.join(tempDir, 'src');
      fs.mkdirSync(srcDir, { recursive: true });

      const file1 = `---
route: "/page1"
---
import Modal from "@components/Modal.tsx"

<template><Modal /></template>`;

      const file2 = `---
route: "/page2"
---
import Modal from "@components/Modal.tsx"

<template><Modal /></template>`;

      fs.writeFileSync(path.join(srcDir, 'page1.mtm'), file1);
      fs.writeFileSync(path.join(srcDir, 'page2.mtm'), file2);

      const mtmFiles = buildSystem.findMTMFiles(srcDir);
      const analysis = await buildSystem.analyzeFrameworkUsage(mtmFiles);

      expect(analysis.sharedComponents).toHaveLength(1);
      expect(analysis.sharedComponents[0].name).toBe('Modal');
      expect(analysis.sharedComponents[0].usedInFiles).toHaveLength(2);
    });
  });

  describe('Build Process', () => {
    test('should build with framework optimizations', async () => {
      const srcDir = path.join(tempDir, 'src');
      fs.mkdirSync(srcDir, { recursive: true });

      const mtmFile = `---
route: "/"
title: "Home"
compileJsMode: "external.js"
---
import Counter from "@components/Counter.tsx"

<template>
  <div>
    <h1>Home</h1>
    <Counter />
  </div>
</template>`;

      fs.writeFileSync(path.join(srcDir, 'index.mtm'), mtmFile);

      const result = await buildSystem.build({
        production: true,
        frameworkOptimizations: true,
        treeshaking: true,
        codeSplitting: true
      });

      expect(result.success).toBe(true);
      expect(result.buildStats.frameworkUsage.react.files).toHaveLength(1);
      expect(result.buildStats.optimizations.length).toBeGreaterThan(0);
    });

    test('should generate enhanced build manifest', async () => {
      const srcDir = path.join(tempDir, 'src');
      const distDir = path.join(tempDir, 'dist');
      fs.mkdirSync(srcDir, { recursive: true });

      const mtmFile = `---
route: "/"
title: "Home"
---
<template><h1>Home</h1></template>`;

      fs.writeFileSync(path.join(srcDir, 'index.mtm'), mtmFile);

      await buildSystem.build();

      const manifestPath = path.join(distDir, 'build-manifest.json');
      expect(fs.existsSync(manifestPath)).toBe(true);

      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      expect(manifest.frameworks).toBeDefined();
      expect(manifest.optimizations).toBeDefined();
      expect(manifest.buildDuration).toBeDefined();
    });
  });

  describe('Development Server', () => {
    test('should start development server with HMR', async () => {
      const srcDir = path.join(tempDir, 'src');
      fs.mkdirSync(srcDir, { recursive: true });

      const mtmFile = `---
route: "/"
title: "Home"
---
<template><h1>Home</h1></template>`;

      fs.writeFileSync(path.join(srcDir, 'index.mtm'), mtmFile);

      const server = await buildSystem.startDevServer({
        port: 0, // Use random port
        hmrPort: 0, // Use random port
        watch: false // Disable watching for test
      });

      expect(server).toBeDefined();
      expect(typeof server.stop).toBe('function');
      expect(typeof server.rebuild).toBe('function');

      await server.stop();
    });

    test('should generate HMR client script', () => {
      const script = buildSystem.generateHMRClientScript({ hmrPort: 24678 });

      expect(script).toContain('WebSocket');
      expect(script).toContain('24678');
      expect(script).toContain('handleHMRUpdate');
    });
  });

  describe('Bundle Analysis', () => {
    test('should generate bundle analysis report', async () => {
      const distDir = path.join(tempDir, 'dist');
      fs.mkdirSync(distDir, { recursive: true });

      // Mock some bundle sizes
      buildSystem.buildStats.bundleSizes = {
        'index.js': 50000,
        'react-bundle.js': 150000,
        'vue-bundle.js': 80000,
        'assets/logo.png': 25000
      };

      await buildSystem.generateBundleAnalysis([], distDir);

      const reportPath = path.join(distDir, 'bundle-analysis.json');
      const htmlReportPath = path.join(distDir, 'bundle-analysis.html');

      expect(fs.existsSync(reportPath)).toBe(true);
      expect(fs.existsSync(htmlReportPath)).toBe(true);

      const analysis = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
      expect(analysis.totalBundles).toBe(4);
      expect(analysis.totalSize).toBe(305000);
      expect(analysis.bundles).toHaveLength(4);
      expect(analysis.recommendations).toBeDefined();
    });

    test('should format bytes correctly', () => {
      expect(buildSystem.formatBytes(0)).toBe('0 Bytes');
      expect(buildSystem.formatBytes(1024)).toBe('1 KB');
      expect(buildSystem.formatBytes(1048576)).toBe('1 MB');
      expect(buildSystem.formatBytes(1500)).toBe('1.46 KB');
    });

    test('should detect bundle types and frameworks', () => {
      expect(buildSystem.getBundleType('app.js')).toBe('javascript');
      expect(buildSystem.getBundleType('styles.css')).toBe('stylesheet');
      expect(buildSystem.getBundleType('index.html')).toBe('page');
      expect(buildSystem.getBundleType('assets/logo.png')).toBe('asset');

      expect(buildSystem.getBundleFramework('react-bundle.js')).toBe('react');
      expect(buildSystem.getBundleFramework('vue-components.js')).toBe('vue');
      expect(buildSystem.getBundleFramework('solid-app.js')).toBe('solid');
      expect(buildSystem.getBundleFramework('svelte-bundle.js')).toBe('svelte');
      expect(buildSystem.getBundleFramework('main.js')).toBeNull();
    });
  });

  describe('Optimization Features', () => {
    test('should optimize HTML content', () => {
      const html = `
        <div>
          <!-- This is a comment -->
          <p>   Hello   World   </p>
          <style>
            body { margin: 0 ; padding: 10px ; }
          </style>
        </div>
      `;

      const optimized = buildSystem.optimizeHTML(html);

      expect(optimized).not.toContain('<!-- This is a comment -->');
      expect(optimized).toContain('><');
      expect(optimized).toContain('margin:0;padding:10px}');
    });

    test('should optimize JavaScript content', async () => {
      const js = `
        // This is a comment
        function test() {
          /* Block comment */
          console.log('Hello World');
        }
        
        function unused() {
          return 'never called';
        }
      `;

      const optimized = await buildSystem.optimizeJavaScript(js, { minify: true });

      expect(optimized).not.toContain('// This is a comment');
      expect(optimized).not.toContain('/* Block comment */');
      expect(optimized.length).toBeLessThan(js.length);
    });

    test('should sort files by dependencies', async () => {
      const srcDir = path.join(tempDir, 'src');
      fs.mkdirSync(srcDir, { recursive: true });

      // File A depends on B
      const fileA = `---
route: "/a"
---
import ComponentB from "./b.mtm"
<template><ComponentB /></template>`;

      const fileB = `---
route: "/b"
---
<template><div>B</div></template>`;

      fs.writeFileSync(path.join(srcDir, 'a.mtm'), fileA);
      fs.writeFileSync(path.join(srcDir, 'b.mtm'), fileB);

      const files = [
        path.join(srcDir, 'a.mtm'),
        path.join(srcDir, 'b.mtm')
      ];

      const sorted = await buildSystem.sortFilesByDependencies(files);

      // B should come before A since A depends on B
      expect(sorted.indexOf(path.join(srcDir, 'b.mtm'))).toBeLessThan(
        sorted.indexOf(path.join(srcDir, 'a.mtm'))
      );
    });
  });

  describe('Error Handling', () => {
    test('should handle compilation errors gracefully', async () => {
      const srcDir = path.join(tempDir, 'src');
      fs.mkdirSync(srcDir, { recursive: true });

      // Create invalid MTM file
      const invalidFile = `---
invalid yaml: [unclosed
---
<template>Invalid</template>`;

      fs.writeFileSync(path.join(srcDir, 'invalid.mtm'), invalidFile);

      const result = await buildSystem.build();

      expect(result.success).toBe(false);
      expect(result.stats.failed).toBe(1);
      expect(result.stats.errors).toHaveLength(1);
      expect(buildSystem.buildStats.errors).toHaveLength(1);
    });

    test('should track build statistics', async () => {
      const srcDir = path.join(tempDir, 'src');
      fs.mkdirSync(srcDir, { recursive: true });

      const mtmFile = `---
route: "/"
title: "Home"
---
<template><h1>Home</h1></template>`;

      fs.writeFileSync(path.join(srcDir, 'index.mtm'), mtmFile);

      await buildSystem.build();

      expect(buildSystem.buildStats.startTime).toBeDefined();
      expect(buildSystem.buildStats.endTime).toBeDefined();
      expect(buildSystem.buildStats.totalFiles).toBe(1);
      expect(buildSystem.buildStats.processedFiles).toBe(1);
    });
  });
});

// Helper function to run tests
if (require.main === module) {
  console.log('🧪 Running Build System Integration Tests...');

  // Simple test runner
  const runTests = async () => {
    const testSuite = new (require('./build-system-integration.test.js'))();

    try {
      console.log('✅ All tests would run here with a proper test framework');
      console.log('💡 To run these tests, use: npm test or jest');
    } catch (error) {
      console.error('❌ Tests failed:', error);
      process.exit(1);
    }
  };

  runTests();
}

module.exports = {
  // Export test utilities if needed
  createTempBuildSystem: (options = {}) => {
    const tempDir = path.join(__dirname, 'temp-test-' + Date.now());
    return new BuildSystemIntegration({
      inputDir: path.join(tempDir, 'src'),
      outputDir: path.join(tempDir, 'dist'),
      ...options
    });
  }
};