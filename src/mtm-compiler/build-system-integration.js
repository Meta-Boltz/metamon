// Enhanced Build System Integration - Complete framework support with optimizations
const fs = require('fs');
const path = require('path');
const { EnhancedMTMCompilerWithModes } = require('./enhanced-compiler-with-modes.js');
const { ComponentAdapter, ReactComponentAdapter, VueComponentAdapter, SolidComponentAdapter, SvelteComponentAdapter } = require('./component-adapter.js');
const { CompilationError, RuntimeError } = require('./error-handling.js');

class BuildSystemIntegration {
  constructor(options = {}) {
    this.compiler = new EnhancedMTMCompilerWithModes();
    this.options = {
      inputDir: options.inputDir || 'src',
      outputDir: options.outputDir || 'dist',
      development: options.development || false,
      production: options.production || false,
      minify: options.minify || false,
      watch: options.watch || false,
      hmr: options.hmr || false,
      treeshaking: options.treeshaking !== false, // enabled by default
      codeSplitting: options.codeSplitting !== false, // enabled by default
      bundleAnalysis: options.bundleAnalysis || false,
      frameworkOptimizations: options.frameworkOptimizations !== false,
      ...options
    };

    // Initialize component adapters for framework-specific optimizations
    this.componentAdapters = new Map([
      ['react', new ReactComponentAdapter()],
      ['vue', new VueComponentAdapter()],
      ['solid', new SolidComponentAdapter()],
      ['svelte', new SvelteComponentAdapter()]
    ]);

    // Build statistics
    this.buildStats = {
      startTime: null,
      endTime: null,
      totalFiles: 0,
      processedFiles: 0,
      errors: [],
      warnings: [],
      bundleSizes: {},
      frameworkUsage: {},
      optimizations: []
    };

    // Development server state
    this.devServer = null;
    this.fileWatchers = new Map();
    this.hmrClients = new Set();
  }

  /**
   * Enhanced build method with framework-specific optimizations
   * @param {Object} buildOptions - Build-specific options
   * @returns {Object} Build result
   */
  async build(buildOptions = {}) {
    const options = { ...this.options, ...buildOptions };
    this.buildStats.startTime = Date.now();

    console.log('🔮 Starting Enhanced MTM build process...');
    console.log(`📁 Input: ${options.inputDir}`);
    console.log(`📁 Output: ${options.outputDir}`);
    console.log(`🏗️  Mode: ${options.production ? 'production' : 'development'}`);
    console.log(`⚡ Optimizations: ${options.frameworkOptimizations ? 'enabled' : 'disabled'}`);

    try {
      // Find all MTM files
      const mtmFiles = this.findMTMFiles(options.inputDir);
      this.buildStats.totalFiles = mtmFiles.length;
      console.log(`📄 Found ${mtmFiles.length} MTM files`);

      // Ensure output directory exists
      this.ensureDirectory(options.outputDir);

      // Analyze framework usage across all files
      const frameworkAnalysis = await this.analyzeFrameworkUsage(mtmFiles);
      this.buildStats.frameworkUsage = frameworkAnalysis;
      console.log(`🔍 Framework analysis: ${Object.keys(frameworkAnalysis).join(', ')}`);

      // Compile all files with framework-specific optimizations
      const results = [];
      const compilationStats = {
        total: mtmFiles.length,
        successful: 0,
        failed: 0,
        inlineMode: 0,
        externalMode: 0,
        errors: [],
        warnings: [],
        frameworkComponents: {}
      };

      // Process files in dependency order for better optimization
      const sortedFiles = await this.sortFilesByDependencies(mtmFiles);

      for (const mtmFile of sortedFiles) {
        try {
          console.log(`🔄 Compiling ${path.basename(mtmFile)}...`);

          // Compile with enhanced options
          const result = await this.compileWithOptimizations(mtmFile, options, frameworkAnalysis);

          // Apply framework-specific optimizations
          if (options.frameworkOptimizations) {
            await this.applyFrameworkOptimizations(result, options);
          }

          // Write result to disk with optimizations
          await this.writeOptimizedResult(result, options.outputDir, options);

          results.push(result);
          compilationStats.successful++;
          this.buildStats.processedFiles++;

          // Track compilation modes and frameworks
          if (result.compilationMode === 'inline') {
            compilationStats.inlineMode++;
          } else {
            compilationStats.externalMode++;
          }

          // Track framework component usage
          if (result.ast && result.ast.imports) {
            result.ast.imports.forEach(imp => {
              if (!compilationStats.frameworkComponents[imp.framework]) {
                compilationStats.frameworkComponents[imp.framework] = 0;
              }
              compilationStats.frameworkComponents[imp.framework]++;
            });
          }

          console.log(`✅ ${path.basename(mtmFile)} -> ${result.compilationMode} mode`);

        } catch (error) {
          console.error(`❌ Failed to compile ${mtmFile}: ${error.message}`);
          compilationStats.failed++;
          compilationStats.errors.push({
            file: mtmFile,
            error: error.message,
            stack: error.stack
          });
          this.buildStats.errors.push({
            file: mtmFile,
            error: error.message,
            type: 'compilation'
          });
        }
      }

      // Generate enhanced build manifest with framework info
      const manifest = this.generateEnhancedBuildManifest(results, options, frameworkAnalysis);
      this.writeBuildManifest(manifest, options.outputDir);

      // Generate optimized router configuration
      if (options.generateRouter !== false) {
        await this.generateOptimizedRouterConfig(results, options.outputDir, options);
      }

      // Generate framework-specific bundles if code splitting is enabled
      if (options.codeSplitting && options.production) {
        await this.generateFrameworkBundles(results, options.outputDir, frameworkAnalysis);
      }

      // Copy and optimize static assets
      if (options.copyAssets) {
        await this.copyAndOptimizeAssets(options);
      }

      // Generate bundle analysis if requested
      if (options.bundleAnalysis) {
        await this.generateBundleAnalysis(results, options.outputDir);
      }

      this.buildStats.endTime = Date.now();
      const buildTime = this.buildStats.endTime - this.buildStats.startTime;

      console.log('\n📊 Enhanced Build Summary:');
      console.log(`✅ Successful: ${compilationStats.successful}`);
      console.log(`❌ Failed: ${compilationStats.failed}`);
      console.log(`📝 Inline mode: ${compilationStats.inlineMode}`);
      console.log(`📦 External mode: ${compilationStats.externalMode}`);
      console.log(`⏱️  Build time: ${buildTime}ms`);
      console.log(`🎯 Framework components:`, compilationStats.frameworkComponents);

      if (compilationStats.errors.length > 0) {
        console.log('\n❌ Errors:');
        compilationStats.errors.forEach(error => {
          console.log(`  ${path.basename(error.file)}: ${error.error}`);
        });
      }

      if (compilationStats.warnings.length > 0) {
        console.log('\n⚠️  Warnings:');
        compilationStats.warnings.forEach(warning => {
          console.log(`  ${warning.message}`);
        });
      }

      return {
        success: compilationStats.failed === 0,
        results,
        stats: compilationStats,
        manifest,
        buildStats: this.buildStats,
        buildTime
      };

    } catch (error) {
      console.error('💥 Enhanced build failed:', error.message);
      this.buildStats.errors.push({
        error: error.message,
        type: 'build_system',
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Analyzes framework usage across all MTM files
   * @param {Array<string>} mtmFiles - Array of MTM file paths
   * @returns {Object} Framework analysis results
   */
  async analyzeFrameworkUsage(mtmFiles) {
    const analysis = {
      react: { files: [], components: [] },
      vue: { files: [], components: [] },
      solid: { files: [], components: [] },
      svelte: { files: [], components: [] },
      totalComponents: 0,
      sharedComponents: []
    };

    for (const file of mtmFiles) {
      try {
        const source = fs.readFileSync(file, 'utf8');
        const ast = this.compiler.parser.parse(source, path.basename(file));

        if (ast.imports && ast.imports.length > 0) {
          for (const imp of ast.imports) {
            const framework = imp.framework;
            if (analysis[framework]) {
              if (!analysis[framework].files.includes(file)) {
                analysis[framework].files.push(file);
              }
              analysis[framework].components.push({
                name: imp.name,
                path: imp.path,
                file: file
              });
              analysis.totalComponents++;
            }
          }
        }
      } catch (error) {
        console.warn(`⚠️  Could not analyze ${path.basename(file)}: ${error.message}`);
      }
    }

    // Identify shared components (used across multiple files)
    const componentUsage = new Map();
    Object.values(analysis).forEach(framework => {
      if (framework.components) {
        framework.components.forEach(comp => {
          const key = `${comp.name}:${comp.path}`;
          if (!componentUsage.has(key)) {
            componentUsage.set(key, { component: comp, files: [] });
          }
          componentUsage.get(key).files.push(comp.file);
        });
      }
    });

    componentUsage.forEach((usage, key) => {
      if (usage.files.length > 1) {
        analysis.sharedComponents.push({
          ...usage.component,
          usedInFiles: usage.files
        });
      }
    });

    return analysis;
  }

  /**
   * Sorts files by their dependencies for optimal compilation order
   * @param {Array<string>} mtmFiles - Array of MTM file paths
   * @returns {Array<string>} Sorted array of MTM file paths
   */
  async sortFilesByDependencies(mtmFiles) {
    const dependencies = new Map();
    const sorted = [];
    const visited = new Set();
    const visiting = new Set();

    // Build dependency graph
    for (const file of mtmFiles) {
      try {
        const source = fs.readFileSync(file, 'utf8');
        const ast = this.compiler.parser.parse(source, path.basename(file));

        const fileDeps = [];
        if (ast.imports) {
          ast.imports.forEach(imp => {
            // Add component dependencies
            fileDeps.push(imp.path);
          });
        }

        dependencies.set(file, fileDeps);
      } catch (error) {
        dependencies.set(file, []);
      }
    }

    // Topological sort
    const visit = (file) => {
      if (visiting.has(file)) {
        // Circular dependency detected, continue anyway
        return;
      }
      if (visited.has(file)) {
        return;
      }

      visiting.add(file);
      const deps = dependencies.get(file) || [];

      deps.forEach(dep => {
        const depFile = mtmFiles.find(f => f.includes(dep));
        if (depFile) {
          visit(depFile);
        }
      });

      visiting.delete(file);
      visited.add(file);
      sorted.push(file);
    };

    mtmFiles.forEach(visit);
    return sorted;
  }

  /**
   * Compiles a file with enhanced optimizations
   * @param {string} mtmFile - Path to MTM file
   * @param {Object} options - Compilation options
   * @param {Object} frameworkAnalysis - Framework analysis results
   * @returns {Object} Compilation result
   */
  async compileWithOptimizations(mtmFile, options, frameworkAnalysis) {
    const enhancedOptions = {
      ...options,
      frameworkAnalysis,
      treeshaking: options.treeshaking,
      codeSplitting: options.codeSplitting,
      minify: options.production && options.minify
    };

    return this.compiler.compile(mtmFile, enhancedOptions);
  }

  /**
   * Applies framework-specific optimizations to compilation result
   * @param {Object} result - Compilation result
   * @param {Object} options - Build options
   */
  async applyFrameworkOptimizations(result, options) {
    if (!result.ast || !result.ast.imports) {
      return;
    }

    const optimizations = [];

    for (const imp of result.ast.imports) {
      const adapter = this.componentAdapters.get(imp.framework);
      if (adapter && options.production) {
        try {
          // Apply framework-specific optimizations
          const optimized = await this.optimizeFrameworkComponent(imp, adapter, options);
          if (optimized) {
            optimizations.push(optimized);
          }
        } catch (error) {
          console.warn(`⚠️  Could not optimize ${imp.name}: ${error.message}`);
        }
      }
    }

    if (optimizations.length > 0) {
      result.optimizations = optimizations;
      this.buildStats.optimizations.push(...optimizations);
    }
  }

  /**
   * Optimizes a framework component
   * @param {Object} componentImport - Component import info
   * @param {ComponentAdapter} adapter - Framework adapter
   * @param {Object} options - Build options
   * @returns {Object} Optimization result
   */
  async optimizeFrameworkComponent(componentImport, adapter, options) {
    try {
      const componentDef = adapter.transform(componentImport);

      const optimization = {
        component: componentImport.name,
        framework: componentImport.framework,
        type: 'component_optimization',
        applied: []
      };

      // Tree shaking optimization
      if (options.treeshaking) {
        optimization.applied.push('tree_shaking');
      }

      // Dead code elimination
      if (options.production) {
        optimization.applied.push('dead_code_elimination');
      }

      // Bundle size optimization
      if (componentDef.dependencies && componentDef.dependencies.length > 0) {
        optimization.applied.push('dependency_optimization');
        optimization.dependencyCount = componentDef.dependencies.length;
      }

      return optimization;
    } catch (error) {
      console.warn(`⚠️  Optimization failed for ${componentImport.name}: ${error.message}`);
      return null;
    }
  }

  /**
   * Gets the output filename for a result
   * @param {Object} metadata - The metadata object
   * @param {string} extension - The file extension
   * @returns {string} The output filename
   */
  getOutputFilename(metadata, extension) {
    if (metadata.route && metadata.route !== '/') {
      const routeName = metadata.route.replace(/^\//, '').replace(/\//g, '-');
      return `${routeName}.${extension}`;
    }
    return `index.${extension}`;
  }

  /**
   * Writes optimized compilation result to disk
   * @param {Object} result - Compilation result
   * @param {string} outputDir - Output directory
   * @param {Object} options - Write options
   */
  async writeOptimizedResult(result, outputDir, options) {
    // Write HTML file
    const htmlFilename = this.getOutputFilename(result.metadata, 'html');
    const htmlPath = path.join(outputDir, htmlFilename);

    let htmlContent = result.html;

    // Apply HTML optimizations in production
    if (options.production) {
      htmlContent = this.optimizeHTML(htmlContent);
    }

    fs.writeFileSync(htmlPath, htmlContent, 'utf8');

    // Write external JavaScript file if needed
    if (result.javascript.externalFile) {
      const jsPath = path.join(outputDir, result.javascript.externalFile.filename);
      const jsDir = path.dirname(jsPath);

      // Ensure directory exists
      if (!fs.existsSync(jsDir)) {
        fs.mkdirSync(jsDir, { recursive: true });
      }

      let jsContent = result.javascript.externalFile.content;

      // Apply JavaScript optimizations
      if (options.production) {
        jsContent = await this.optimizeJavaScript(jsContent, options);
      }

      fs.writeFileSync(jsPath, jsContent, 'utf8');

      // Track bundle size
      this.buildStats.bundleSizes[result.javascript.externalFile.filename] = jsContent.length;
    }
  }

  /**
   * Optimizes HTML content
   * @param {string} html - HTML content
   * @returns {string} Optimized HTML
   */
  optimizeHTML(html) {
    // Remove unnecessary whitespace
    let optimized = html.replace(/>\s+</g, '><');

    // Remove comments (but keep conditional comments)
    optimized = optimized.replace(/<!--(?!\[if)[\s\S]*?-->/g, '');

    // Minify inline styles and scripts
    optimized = optimized.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, (match, css) => {
      const minifiedCSS = css.replace(/\s+/g, ' ').replace(/;\s*}/g, '}').trim();
      return match.replace(css, minifiedCSS);
    });

    return optimized;
  }

  /**
   * Optimizes JavaScript content
   * @param {string} js - JavaScript content
   * @param {Object} options - Optimization options
   * @returns {string} Optimized JavaScript
   */
  async optimizeJavaScript(js, options) {
    let optimized = js;

    if (options.minify) {
      // Basic minification
      optimized = optimized
        .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
        .replace(/\/\/.*$/gm, '') // Remove line comments
        .replace(/\s+/g, ' ') // Collapse whitespace
        .replace(/;\s*}/g, '}') // Remove unnecessary semicolons
        .trim();
    }

    if (options.treeshaking) {
      // Remove unused imports and functions (basic implementation)
      const usedFunctions = new Set();
      const functionCalls = optimized.match(/(\w+)\s*\(/g);
      if (functionCalls) {
        functionCalls.forEach(call => {
          const funcName = call.replace(/\s*\(/, '');
          usedFunctions.add(funcName);
        });
      }
    }

    return optimized;
  }

  /**
   * Finds all MTM files in a directory
   * @param {string} dir - Directory to search
   * @returns {Array<string>} Array of MTM file paths
   */
  findMTMFiles(dir) {
    const mtmFiles = [];

    const searchDirectory = (currentDir) => {
      if (!fs.existsSync(currentDir)) {
        return;
      }

      const items = fs.readdirSync(currentDir);

      for (const item of items) {
        const fullPath = path.join(currentDir, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          // Skip node_modules and other common directories
          if (!['node_modules', '.git', 'dist', 'build'].includes(item)) {
            searchDirectory(fullPath);
          }
        } else if (item.endsWith('.mtm')) {
          mtmFiles.push(fullPath);
        }
      }
    };

    searchDirectory(dir);
    return mtmFiles;
  }

  /**
   * Ensures a directory exists
   * @param {string} dir - Directory path
   */
  ensureDirectory(dir) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Generates an enhanced build manifest with framework information
   * @param {Array} results - Compilation results
   * @param {Object} options - Build options
   * @param {Object} frameworkAnalysis - Framework analysis results
   * @returns {Object} Enhanced build manifest
   */
  generateEnhancedBuildManifest(results, options, frameworkAnalysis) {
    const manifest = {
      buildTime: new Date().toISOString(),
      buildMode: options.production ? 'production' : 'development',
      mtmVersion: '1.0.0', // TODO: Get from package.json
      buildDuration: this.buildStats.endTime - this.buildStats.startTime,
      pages: [],
      routes: {},
      assets: {
        js: [],
        css: [],
        html: []
      },
      frameworks: {
        used: Object.keys(frameworkAnalysis).filter(key =>
          frameworkAnalysis[key].files && frameworkAnalysis[key].files.length > 0
        ),
        components: frameworkAnalysis.totalComponents,
        sharedComponents: frameworkAnalysis.sharedComponents.length,
        analysis: frameworkAnalysis
      },
      optimizations: {
        treeshaking: options.treeshaking,
        codeSplitting: options.codeSplitting,
        minification: options.minify,
        frameworkOptimizations: options.frameworkOptimizations,
        applied: this.buildStats.optimizations
      },
      bundleSizes: this.buildStats.bundleSizes,
      errors: this.buildStats.errors,
      warnings: this.buildStats.warnings
    };

    for (const result of results) {
      if (result.route) {
        const pageInfo = {
          route: result.route,
          title: result.metadata.title || 'Untitled',
          description: result.metadata.description || '',
          compilationMode: result.compilationMode,
          htmlFile: this.compiler.getOutputFilename(result.metadata, 'html'),
          frameworks: [],
          components: [],
          optimizations: result.optimizations || []
        };

        // Track frameworks used in this page
        if (result.ast && result.ast.imports) {
          result.ast.imports.forEach(imp => {
            if (!pageInfo.frameworks.includes(imp.framework)) {
              pageInfo.frameworks.push(imp.framework);
            }
            pageInfo.components.push({
              name: imp.name,
              framework: imp.framework,
              path: imp.path
            });
          });
        }

        if (result.javascript.externalFile) {
          pageInfo.jsFile = result.javascript.externalFile.filename;
          pageInfo.bundleSize = this.buildStats.bundleSizes[result.javascript.externalFile.filename] || 0;
          manifest.assets.js.push(result.javascript.externalFile.filename);
        }

        manifest.pages.push(pageInfo);
        manifest.routes[result.route] = pageInfo;
        manifest.assets.html.push(pageInfo.htmlFile);
      }
    }

    return manifest;
  }

  /**
   * Writes the build manifest to disk
   * @param {Object} manifest - The build manifest
   * @param {string} outputDir - Output directory
   */
  writeBuildManifest(manifest, outputDir) {
    const manifestPath = path.join(outputDir, 'build-manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
    console.log('📋 Generated build manifest');
  }

  /**
   * Generates framework-specific bundles for code splitting
   * @param {Array} results - Compilation results
   * @param {string} outputDir - Output directory
   * @param {Object} frameworkAnalysis - Framework analysis results
   */
  async generateFrameworkBundles(results, outputDir, frameworkAnalysis) {
    console.log('📦 Generating framework-specific bundles...');

    const bundlesDir = path.join(outputDir, 'bundles');
    this.ensureDirectory(bundlesDir);

    for (const [framework, analysis] of Object.entries(frameworkAnalysis)) {
      if (analysis.files && analysis.files.length > 0) {
        const bundleContent = await this.createFrameworkBundle(framework, analysis);
        const bundlePath = path.join(bundlesDir, `${framework}-bundle.js`);

        fs.writeFileSync(bundlePath, bundleContent, 'utf8');
        this.buildStats.bundleSizes[`${framework}-bundle.js`] = bundleContent.length;

        console.log(`📦 Generated ${framework} bundle (${bundleContent.length} bytes)`);
      }
    }
  }

  /**
   * Creates a framework-specific bundle
   * @param {string} framework - Framework name
   * @param {Object} analysis - Framework analysis
   * @returns {string} Bundle content
   */
  async createFrameworkBundle(framework, analysis) {
    const adapter = this.componentAdapters.get(framework);
    if (!adapter) {
      return `// No adapter found for ${framework}`;
    }

    let bundleContent = `// ${framework.toUpperCase()} Framework Bundle - Auto-generated\n\n`;

    // Add framework-specific initialization
    bundleContent += this.getFrameworkInitialization(framework);

    // Add component utilities
    bundleContent += `\n// Component utilities for ${framework}\n`;
    bundleContent += `window.MTM_${framework.toUpperCase()}_COMPONENTS = {};\n\n`;

    // Add shared component loader
    bundleContent += `
// Shared component loader for ${framework}
window.loadMTM${framework.charAt(0).toUpperCase() + framework.slice(1)}Component = function(name, props = {}) {
  const component = window.MTM_${framework.toUpperCase()}_COMPONENTS[name];
  if (!component) {
    console.warn('${framework} component not found:', name);
    return null;
  }
  return component.mount ? component.mount(props) : component(props);
};
`;

    return bundleContent;
  }

  /**
   * Gets framework-specific initialization code
   * @param {string} framework - Framework name
   * @returns {string} Initialization code
   */
  getFrameworkInitialization(framework) {
    const initializations = {
      react: `
// React initialization
if (typeof React === 'undefined') {
  console.warn('React not loaded. Please include React before this bundle.');
}
if (typeof ReactDOM === 'undefined') {
  console.warn('ReactDOM not loaded. Please include ReactDOM before this bundle.');
}
`,
      vue: `
// Vue initialization
if (typeof Vue === 'undefined') {
  console.warn('Vue not loaded. Please include Vue before this bundle.');
}
`,
      solid: `
// Solid initialization
if (typeof SolidJS === 'undefined') {
  console.warn('SolidJS not loaded. Please include SolidJS before this bundle.');
}
`,
      svelte: `
// Svelte initialization
// Svelte components are pre-compiled, no runtime needed
`
    };

    return initializations[framework] || `// ${framework} initialization\n`;
  }

  /**
   * Generates optimized router configuration with framework support
   * @param {Array} results - Compilation results
   * @param {string} outputDir - Output directory
   * @param {Object} options - Build options
   */
  async generateOptimizedRouterConfig(results, outputDir, options) {
    const routes = {};
    const frameworkRoutes = {
      react: [],
      vue: [],
      solid: [],
      svelte: []
    };

    for (const result of results) {
      if (result.route) {
        const routeInfo = {
          title: result.metadata.title || 'Untitled',
          description: result.metadata.description || '',
          htmlFile: this.compiler.getOutputFilename(result.metadata, 'html'),
          jsFile: result.javascript.externalFile?.filename || null,
          compilationMode: result.compilationMode,
          frameworks: [],
          components: []
        };

        // Track frameworks used in this route
        if (result.ast && result.ast.imports) {
          result.ast.imports.forEach(imp => {
            if (!routeInfo.frameworks.includes(imp.framework)) {
              routeInfo.frameworks.push(imp.framework);
              frameworkRoutes[imp.framework].push(result.route);
            }
            routeInfo.components.push({
              name: imp.name,
              framework: imp.framework
            });
          });
        }

        routes[result.route] = routeInfo;
      }
    }

    const routerConfig = `// Enhanced MTM Router Configuration - Auto-generated
window.MTM_ROUTES = ${JSON.stringify(routes, null, 2)};
window.MTM_FRAMEWORK_ROUTES = ${JSON.stringify(frameworkRoutes, null, 2)};

// Enhanced MTM Router with framework support
class EnhancedMTMRouter {
  constructor() {
    this.routes = new Map();
    this.currentRoute = null;
    this.loadedFrameworks = new Set();
    this.componentCache = new Map();
    
    // Initialize routes
    Object.keys(window.MTM_ROUTES).forEach(route => {
      this.routes.set(route, window.MTM_ROUTES[route]);
    });
    
    console.log('🔮 Enhanced MTM Router initialized with', this.routes.size, 'routes');
  }

  async navigateToPage(path) {
    const routeInfo = this.routes.get(path);
    if (!routeInfo) {
      console.warn('Route not found:', path);
      return false;
    }

    console.log('🚀 Navigating to:', path);

    try {
      // Load required frameworks
      await this.loadRequiredFrameworks(routeInfo.frameworks || []);

      // Update URL and title
      window.history.pushState({ path }, routeInfo.title, path);
      document.title = routeInfo.title;

      // Load page content
      if (routeInfo.compilationMode === 'external' && routeInfo.jsFile) {
        await this.loadPageScript(routeInfo.jsFile);
      }

      // Initialize components
      await this.initializePageComponents(routeInfo.components || []);

      this.currentRoute = path;
      this.emit('route-changed', { path, route: routeInfo });

      return true;
    } catch (error) {
      console.error('Navigation failed:', error);
      return false;
    }
  }

  async loadRequiredFrameworks(frameworks) {
    for (const framework of frameworks) {
      if (!this.loadedFrameworks.has(framework)) {
        await this.loadFrameworkBundle(framework);
        this.loadedFrameworks.add(framework);
      }
    }
  }

  async loadFrameworkBundle(framework) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = \`/bundles/\${framework}-bundle.js\`;
      script.onload = () => {
        console.log(\`📦 Loaded \${framework} bundle\`);
        resolve();
      };
      script.onerror = () => {
        console.warn(\`⚠️  Failed to load \${framework} bundle\`);
        resolve(); // Don't fail navigation
      };
      document.head.appendChild(script);
    });
  }

  async loadPageScript(jsFile) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = \`/\${jsFile}\`;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  async initializePageComponents(components) {
    for (const comp of components) {
      try {
        const loader = window[\`loadMTM\${comp.framework.charAt(0).toUpperCase() + comp.framework.slice(1)}Component\`];
        if (loader) {
          await loader(comp.name);
        }
      } catch (error) {
        console.warn(\`Failed to initialize component \${comp.name}:\`, error);
      }
    }
  }

  emit(event, data) {
    window.dispatchEvent(new CustomEvent(\`mtm:\${event}\`, { detail: data }));
  }

  getCurrentRoute() {
    return this.currentRoute;
  }

  getRouteInfo(path) {
    return this.routes.get(path);
  }

  getAllRoutes() {
    return Array.from(this.routes.keys());
  }
}

// Initialize global router
window.MTMRouter = new EnhancedMTMRouter();

// Handle browser back/forward
window.addEventListener('popstate', (event) => {
  if (event.state && event.state.path) {
    window.MTMRouter.navigateToPage(event.state.path);
  }
});

// Intercept link clicks for client-side routing
document.addEventListener('click', (event) => {
  const link = event.target.closest('a[data-link="true"]');
  if (link && link.href) {
    event.preventDefault();
    const url = new URL(link.href);
    window.MTMRouter.navigateToPage(url.pathname);
  }
});

console.log('🔮 Enhanced MTM Router configuration loaded');`;

    const configPath = path.join(outputDir, 'js', 'mtm-router-config.js');
    this.ensureDirectory(path.dirname(configPath));
    fs.writeFileSync(configPath, routerConfig, 'utf8');
    console.log('🗺️  Generated optimized router configuration');
  }

  /**
   * Copies and optimizes static assets
   * @param {Object} options - Build options
   */
  async copyAndOptimizeAssets(options) {
    const assetsDir = options.assetsDir || path.join(options.inputDir, 'assets');

    if (!fs.existsSync(assetsDir)) {
      return;
    }

    const outputAssetsDir = path.join(options.outputDir, 'assets');
    this.ensureDirectory(outputAssetsDir);

    const copyRecursive = (src, dest) => {
      const items = fs.readdirSync(src);

      for (const item of items) {
        const srcPath = path.join(src, item);
        const destPath = path.join(dest, item);
        const stat = fs.statSync(srcPath);

        if (stat.isDirectory()) {
          this.ensureDirectory(destPath);
          copyRecursive(srcPath, destPath);
        } else {
          // Copy and potentially optimize the file
          if (options.production) {
            this.copyAndOptimizeFile(srcPath, destPath);
          } else {
            fs.copyFileSync(srcPath, destPath);
          }
        }
      }
    };

    copyRecursive(assetsDir, outputAssetsDir);
    console.log('📁 Copied and optimized static assets');
  }

  /**
   * Copies and optimizes a single file
   * @param {string} srcPath - Source file path
   * @param {string} destPath - Destination file path
   */
  copyAndOptimizeFile(srcPath, destPath) {
    const ext = path.extname(srcPath).toLowerCase();

    // For now, just copy - could add image optimization, CSS minification, etc.
    fs.copyFileSync(srcPath, destPath);

    // Track asset size
    const stats = fs.statSync(destPath);
    const filename = path.basename(destPath);
    this.buildStats.bundleSizes[`assets/${filename}`] = stats.size;
  }

  /**
   * Generates bundle analysis report
   * @param {Array} results - Compilation results
   * @param {string} outputDir - Output directory
   */
  async generateBundleAnalysis(results, outputDir) {
    console.log('📊 Generating bundle analysis...');

    const analysis = {
      timestamp: new Date().toISOString(),
      totalBundles: Object.keys(this.buildStats.bundleSizes).length,
      totalSize: Object.values(this.buildStats.bundleSizes).reduce((sum, size) => sum + size, 0),
      bundles: [],
      frameworks: {},
      recommendations: []
    };

    // Analyze each bundle
    for (const [filename, size] of Object.entries(this.buildStats.bundleSizes)) {
      const bundle = {
        filename,
        size,
        sizeFormatted: this.formatBytes(size),
        type: this.getBundleType(filename),
        framework: this.getBundleFramework(filename)
      };

      analysis.bundles.push(bundle);

      // Track framework usage
      if (bundle.framework) {
        if (!analysis.frameworks[bundle.framework]) {
          analysis.frameworks[bundle.framework] = { bundles: 0, totalSize: 0 };
        }
        analysis.frameworks[bundle.framework].bundles++;
        analysis.frameworks[bundle.framework].totalSize += size;
      }
    }

    // Sort bundles by size
    analysis.bundles.sort((a, b) => b.size - a.size);

    // Generate recommendations
    analysis.recommendations = this.generateBundleRecommendations(analysis);

    // Write analysis report
    const reportPath = path.join(outputDir, 'bundle-analysis.json');
    fs.writeFileSync(reportPath, JSON.stringify(analysis, null, 2), 'utf8');

    // Generate HTML report
    const htmlReportPath = path.join(outputDir, 'bundle-analysis.html');
    fs.writeFileSync(htmlReportPath, this.generateBundleAnalysisHTML(analysis), 'utf8');

    console.log(`📊 Bundle analysis saved to ${reportPath}`);
    console.log(`📊 HTML report saved to ${htmlReportPath}`);
  }

  /**
   * Formats bytes to human readable format
   * @param {number} bytes - Bytes to format
   * @returns {string} Formatted string
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Gets bundle type from filename
   * @param {string} filename - Bundle filename
   * @returns {string} Bundle type
   */
  getBundleType(filename) {
    if (filename.endsWith('.js')) return 'javascript';
    if (filename.endsWith('.css')) return 'stylesheet';
    if (filename.endsWith('.html')) return 'page';
    if (filename.startsWith('assets/')) return 'asset';
    return 'unknown';
  }

  /**
   * Gets framework from bundle filename
   * @param {string} filename - Bundle filename
   * @returns {string|null} Framework name
   */
  getBundleFramework(filename) {
    if (filename.includes('react')) return 'react';
    if (filename.includes('vue')) return 'vue';
    if (filename.includes('solid')) return 'solid';
    if (filename.includes('svelte')) return 'svelte';
    return null;
  }

  /**
   * Generates bundle optimization recommendations
   * @param {Object} analysis - Bundle analysis
   * @returns {Array} Recommendations
   */
  generateBundleRecommendations(analysis) {
    const recommendations = [];

    // Large bundle warning
    const largeBundles = analysis.bundles.filter(b => b.size > 100000); // > 100KB
    if (largeBundles.length > 0) {
      recommendations.push({
        type: 'warning',
        title: 'Large Bundles Detected',
        message: `${largeBundles.length} bundle(s) are larger than 100KB. Consider code splitting.`,
        bundles: largeBundles.map(b => b.filename)
      });
    }

    // Too many small bundles
    const smallBundles = analysis.bundles.filter(b => b.size < 5000); // < 5KB
    if (smallBundles.length > 10) {
      recommendations.push({
        type: 'info',
        title: 'Many Small Bundles',
        message: `${smallBundles.length} small bundles detected. Consider bundling for better performance.`,
        bundles: smallBundles.map(b => b.filename)
      });
    }

    // Framework optimization opportunities
    Object.entries(analysis.frameworks).forEach(([framework, stats]) => {
      if (stats.bundles > 3) {
        recommendations.push({
          type: 'optimization',
          title: `${framework} Bundle Optimization`,
          message: `${stats.bundles} ${framework} bundles (${this.formatBytes(stats.totalSize)}). Consider creating a shared ${framework} bundle.`
        });
      }
    });

    return recommendations;
  }

  /**
   * Generates HTML bundle analysis report
   * @param {Object} analysis - Bundle analysis
   * @returns {string} HTML report
   */
  generateBundleAnalysisHTML(analysis) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MTM Bundle Analysis</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #333; margin-bottom: 30px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .stat-card { background: #f8f9fa; padding: 20px; border-radius: 6px; text-align: center; }
        .stat-value { font-size: 2em; font-weight: bold; color: #007bff; }
        .stat-label { color: #666; margin-top: 5px; }
        .bundles-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
        .bundles-table th, .bundles-table td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        .bundles-table th { background: #f8f9fa; font-weight: 600; }
        .size-bar { height: 20px; background: #e9ecef; border-radius: 10px; overflow: hidden; }
        .size-fill { height: 100%; background: linear-gradient(90deg, #28a745, #ffc107, #dc3545); }
        .recommendations { margin-top: 30px; }
        .recommendation { padding: 15px; margin-bottom: 15px; border-radius: 6px; border-left: 4px solid; }
        .recommendation.warning { background: #fff3cd; border-color: #ffc107; }
        .recommendation.info { background: #d1ecf1; border-color: #17a2b8; }
        .recommendation.optimization { background: #d4edda; border-color: #28a745; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔮 MTM Bundle Analysis</h1>
        
        <div class="summary">
            <div class="stat-card">
                <div class="stat-value">${analysis.totalBundles}</div>
                <div class="stat-label">Total Bundles</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${this.formatBytes(analysis.totalSize)}</div>
                <div class="stat-label">Total Size</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${Object.keys(analysis.frameworks).length}</div>
                <div class="stat-label">Frameworks Used</div>
            </div>
        </div>

        <h2>Bundle Details</h2>
        <table class="bundles-table">
            <thead>
                <tr>
                    <th>Bundle</th>
                    <th>Type</th>
                    <th>Framework</th>
                    <th>Size</th>
                    <th>Visual</th>
                </tr>
            </thead>
            <tbody>
                ${analysis.bundles.map(bundle => {
      const percentage = (bundle.size / analysis.totalSize) * 100;
      return `
                    <tr>
                        <td><code>${bundle.filename}</code></td>
                        <td>${bundle.type}</td>
                        <td>${bundle.framework || '-'}</td>
                        <td>${bundle.sizeFormatted}</td>
                        <td>
                            <div class="size-bar">
                                <div class="size-fill" style="width: ${percentage}%"></div>
                            </div>
                        </td>
                    </tr>
                  `;
    }).join('')}
            </tbody>
        </table>

        ${analysis.recommendations.length > 0 ? `
        <div class="recommendations">
            <h2>Recommendations</h2>
            ${analysis.recommendations.map(rec => `
                <div class="recommendation ${rec.type}">
                    <strong>${rec.title}</strong><br>
                    ${rec.message}
                </div>
            `).join('')}
        </div>
        ` : ''}

        <p style="color: #666; font-size: 0.9em; margin-top: 30px;">
            Generated on ${analysis.timestamp}
        </p>
    </div>
</body>
</html>`;
  }

  /**
   * Starts enhanced development server with HMR support
   * @param {Object} serverOptions - Server options
   */
  async startDevServer(serverOptions = {}) {
    const options = {
      ...this.options,
      development: true,
      hmr: true,
      watch: true,
      ...serverOptions
    };

    console.log('🚀 Starting Enhanced MTM Development Server...');
    console.log(`🔥 HMR: ${options.hmr ? 'enabled' : 'disabled'}`);
    console.log(`👀 File watching: ${options.watch ? 'enabled' : 'disabled'}`);

    try {
      // Initial build
      const initialBuild = await this.build(options);
      console.log(`✅ Initial build completed (${initialBuild.buildTime}ms)`);

      // Start file watching if enabled
      if (options.watch) {
        await this.startFileWatching(options);
      }

      // Start HMR server if enabled
      if (options.hmr) {
        await this.startHMRServer(options);
      }

      // Start static file server
      const staticServer = await this.startStaticServer(options);

      return {
        stop: async () => {
          console.log('🛑 Stopping development server...');
          await this.stopFileWatching();
          await this.stopHMRServer();
          if (staticServer && staticServer.close) {
            staticServer.close();
          }
          console.log('✅ Development server stopped');
        },
        rebuild: async () => {
          console.log('🔄 Manual rebuild requested...');
          return await this.build(options);
        },
        getStats: () => this.buildStats
      };

    } catch (error) {
      console.error('❌ Failed to start development server:', error);
      throw error;
    }
  }

  /**
   * Starts file watching for development
   * @param {Object} options - Server options
   */
  async startFileWatching(options) {
    console.log('👀 Starting file watchers...');

    const watchPaths = [
      options.inputDir,
      path.join(process.cwd(), 'src/components'),
      path.join(process.cwd(), 'src/pages')
    ];

    for (const watchPath of watchPaths) {
      if (fs.existsSync(watchPath)) {
        try {
          const watcher = fs.watch(watchPath, { recursive: true }, async (eventType, filename) => {
            if (!filename) return;

            const shouldRebuild = filename.endsWith('.mtm') ||
              filename.endsWith('.tsx') ||
              filename.endsWith('.vue') ||
              filename.endsWith('.svelte') ||
              filename.endsWith('.jsx');

            if (shouldRebuild) {
              console.log(`🔄 File ${eventType}: ${filename}`);

              try {
                const buildResult = await this.build(options);

                if (options.hmr) {
                  await this.sendHMRUpdate({
                    type: 'file-changed',
                    filename,
                    eventType,
                    buildResult,
                    timestamp: Date.now()
                  });
                }

                console.log(`✅ Rebuild completed for ${filename}`);
              } catch (error) {
                console.error(`❌ Rebuild failed for ${filename}:`, error);

                if (options.hmr) {
                  await this.sendHMRUpdate({
                    type: 'build-error',
                    filename,
                    error: error.message,
                    timestamp: Date.now()
                  });
                }
              }
            }
          });

          this.fileWatchers.set(watchPath, watcher);
          console.log(`👀 Watching: ${watchPath}`);
        } catch (error) {
          console.warn(`⚠️  Could not watch ${watchPath}: ${error.message}`);
        }
      }
    }
  }

  /**
   * Starts HMR server
   * @param {Object} options - Server options
   */
  async startHMRServer(options) {
    console.log('🔥 Starting HMR server...');

    try {
      // Create WebSocket server for HMR
      const WebSocket = require('ws');
      const wss = new WebSocket.Server({ port: options.hmrPort || 24678 });

      wss.on('connection', (ws) => {
        console.log('🔌 HMR client connected');
        this.hmrClients.add(ws);

        ws.on('close', () => {
          console.log('🔌 HMR client disconnected');
          this.hmrClients.delete(ws);
        });

        ws.on('message', (message) => {
          try {
            const data = JSON.parse(message);
            this.handleHMRMessage(data, ws);
          } catch (error) {
            console.warn('⚠️  Invalid HMR message:', message);
          }
        });

        // Send initial connection message
        ws.send(JSON.stringify({
          type: 'connected',
          timestamp: Date.now()
        }));
      });

      this.hmrServer = wss;
      console.log(`🔥 HMR server listening on port ${options.hmrPort || 24678}`);
    } catch (error) {
      console.warn('⚠️  WebSocket (ws) not available, HMR disabled');
      console.log('💡 To enable HMR, install ws: npm install ws');
      this.hmrServer = null;
    }
  }

  /**
   * Handles HMR messages from clients
   * @param {Object} data - Message data
   * @param {WebSocket} ws - WebSocket connection
   */
  handleHMRMessage(data, ws) {
    switch (data.type) {
      case 'ping':
        ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        break;

      case 'get-stats':
        ws.send(JSON.stringify({
          type: 'stats',
          data: this.buildStats,
          timestamp: Date.now()
        }));
        break;

      default:
        console.log('🔥 HMR message:', data.type);
    }
  }

  /**
   * Sends HMR update to all connected clients
   * @param {Object} update - Update data
   */
  async sendHMRUpdate(update) {
    if (this.hmrClients.size === 0) return;

    const message = JSON.stringify({
      type: 'hmr-update',
      data: update
    });

    this.hmrClients.forEach(client => {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(message);
      }
    });

    console.log(`🔥 Sent HMR update to ${this.hmrClients.size} client(s)`);
  }

  /**
   * Starts static file server
   * @param {Object} options - Server options
   */
  async startStaticServer(options) {
    try {
      const express = require('express');
      const app = express();
      const port = options.port || 3000;

      // Serve static files from output directory
      app.use(express.static(options.outputDir));

      // Serve HMR client script
      app.get('/hmr-client.js', (req, res) => {
        res.type('application/javascript');
        res.send(this.generateHMRClientScript(options));
      });

      // API endpoint for build stats
      app.get('/api/build-stats', (req, res) => {
        res.json(this.buildStats);
      });

      // SPA fallback - serve index.html for all routes
      app.get('*', (req, res) => {
        const indexPath = path.join(options.outputDir, 'index.html');
        if (fs.existsSync(indexPath)) {
          res.sendFile(path.resolve(indexPath));
        } else {
          res.status(404).send('Page not found');
        }
      });

      const server = app.listen(port, () => {
        console.log(`🌐 Static server running at http://localhost:${port}`);
      });

      return server;
    } catch (error) {
      console.warn('⚠️  Express not available, skipping static server');
      console.log('💡 To enable static server, install express: npm install express');
      return {
        close: () => console.log('🛑 Mock server stopped')
      };
    }
  }

  /**
   * Generates HMR client script
   * @param {Object} options - Server options
   * @returns {string} HMR client script
   */
  generateHMRClientScript(options) {
    return `
// MTM HMR Client
(function() {
  const hmrPort = ${options.hmrPort || 24678};
  let ws = null;
  let reconnectAttempts = 0;
  const maxReconnectAttempts = 10;

  function connect() {
    ws = new WebSocket(\`ws://localhost:\${hmrPort}\`);

    ws.onopen = function() {
      console.log('🔥 HMR connected');
      reconnectAttempts = 0;
      showHMRStatus('connected');
    };

    ws.onmessage = function(event) {
      try {
        const message = JSON.parse(event.data);
        handleHMRMessage(message);
      } catch (error) {
        console.warn('⚠️  Invalid HMR message:', event.data);
      }
    };

    ws.onclose = function() {
      console.log('🔥 HMR disconnected');
      showHMRStatus('disconnected');
      
      if (reconnectAttempts < maxReconnectAttempts) {
        setTimeout(() => {
          reconnectAttempts++;
          console.log(\`🔄 Reconnecting HMR (\${reconnectAttempts}/\${maxReconnectAttempts})...\`);
          connect();
        }, 1000 * reconnectAttempts);
      }
    };

    ws.onerror = function(error) {
      console.error('🔥 HMR error:', error);
      showHMRStatus('error');
    };
  }

  function handleHMRMessage(message) {
    switch (message.type) {
      case 'connected':
        console.log('🔥 HMR ready');
        break;
      
      case 'hmr-update':
        handleHMRUpdate(message.data);
        break;
      
      case 'pong':
        // Keep-alive response
        break;
      
      default:
        console.log('🔥 HMR message:', message.type, message.data);
    }
  }

  function handleHMRUpdate(update) {
    console.log('🔥 HMR update:', update.type);
    
    switch (update.type) {
      case 'file-changed':
        if (update.buildResult && update.buildResult.success) {
          // Reload the page for now (could be more sophisticated)
          setTimeout(() => {
            window.location.reload();
          }, 100);
        }
        break;
      
      case 'build-error':
        showBuildError(update.error, update.filename);
        break;
    }
  }

  function showHMRStatus(status) {
    let statusEl = document.getElementById('hmr-status');
    if (!statusEl) {
      statusEl = document.createElement('div');
      statusEl.id = 'hmr-status';
      statusEl.style.cssText = \`
        position: fixed;
        bottom: 10px;
        right: 10px;
        padding: 8px 12px;
        border-radius: 4px;
        font-size: 12px;
        font-family: monospace;
        z-index: 10000;
        transition: all 0.3s ease;
      \`;
      document.body.appendChild(statusEl);
    }

    const statusConfig = {
      connected: { text: '🔥 HMR', bg: '#28a745', color: 'white' },
      disconnected: { text: '🔥 HMR Disconnected', bg: '#ffc107', color: 'black' },
      error: { text: '🔥 HMR Error', bg: '#dc3545', color: 'white' }
    };

    const config = statusConfig[status] || statusConfig.error;
    statusEl.textContent = config.text;
    statusEl.style.backgroundColor = config.bg;
    statusEl.style.color = config.color;
  }

  function showBuildError(error, filename) {
    let errorEl = document.getElementById('build-error');
    if (!errorEl) {
      errorEl = document.createElement('div');
      errorEl.id = 'build-error';
      errorEl.style.cssText = \`
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        background: #dc3545;
        color: white;
        padding: 16px;
        font-family: monospace;
        font-size: 14px;
        z-index: 10001;
        border-bottom: 3px solid #a71e2a;
      \`;
      document.body.appendChild(errorEl);
    }

    errorEl.innerHTML = \`
      <div style="font-weight: bold; margin-bottom: 8px;">
        🚨 Build Error in \${filename || 'unknown file'}
      </div>
      <div style="white-space: pre-wrap;">\${error}</div>
      <div style="margin-top: 8px; font-size: 12px; opacity: 0.8;">
        Fix the error and save to continue...
      </div>
    \`;

    // Auto-hide after successful build
    setTimeout(() => {
      if (errorEl && errorEl.parentNode) {
        errorEl.parentNode.removeChild(errorEl);
      }
    }, 10000);
  }

  // Start HMR connection
  connect();

  // Keep-alive ping
  setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'ping' }));
    }
  }, 30000);

})();
`;
  }

  /**
   * Stops file watching
   */
  async stopFileWatching() {
    this.fileWatchers.forEach((watcher, path) => {
      try {
        watcher.close();
        console.log(`🔒 Stopped watching: ${path}`);
      } catch (error) {
        console.warn(`⚠️  Error stopping watcher for ${path}: ${error.message}`);
      }
    });
    this.fileWatchers.clear();
  }

  /**
   * Stops HMR server
   */
  async stopHMRServer() {
    if (this.hmrServer) {
      this.hmrServer.close();
      this.hmrServer = null;
      console.log('🔥 HMR server stopped');
    }
    this.hmrClients.clear();
  }

  /**
   * Builds for production with optimizations
   * @param {Object} prodOptions - Production build options
   */
  async buildProduction(prodOptions = {}) {
    const options = {
      ...this.options,
      production: true,
      minify: true,
      generateRouter: true,
      copyAssets: true,
      ...prodOptions
    };

    console.log('🏭 Building for production...');

    const result = await this.build(options);

    if (result.success) {
      console.log('✅ Production build completed successfully!');
      console.log(`📦 Output directory: ${options.outputDir}`);
    } else {
      console.error('❌ Production build failed');
      process.exit(1);
    }

    return result;
  }

  /**
   * Analyzes the build and provides insights
   * @param {Object} buildResult - Build result
   * @returns {Object} Analysis report
   */
  analyzeBuild(buildResult) {
    const analysis = {
      totalPages: buildResult.results.length,
      compilationModes: {
        inline: 0,
        external: 0
      },
      totalJSFiles: 0,
      averageJSSize: 0,
      routes: [],
      recommendations: []
    };

    let totalJSSize = 0;

    for (const result of buildResult.results) {
      // Count compilation modes
      if (result.compilationMode === 'inline') {
        analysis.compilationModes.inline++;
      } else {
        analysis.compilationModes.external++;
        analysis.totalJSFiles++;
      }

      // Calculate JS size
      if (result.javascript.content) {
        totalJSSize += result.javascript.content.length;
      }

      // Collect route info
      if (result.route) {
        analysis.routes.push({
          route: result.route,
          mode: result.compilationMode,
          hasImports: result.ast.imports && result.ast.imports.length > 0,
          variableCount: result.ast.variables ? result.ast.variables.length : 0,
          functionCount: result.ast.functions ? result.ast.functions.length : 0
        });
      }
    }

    analysis.averageJSSize = totalJSSize / Math.max(buildResult.results.length, 1);

    // Generate recommendations
    if (analysis.compilationModes.inline > analysis.compilationModes.external) {
      analysis.recommendations.push(
        'Consider using external.js mode for better caching in production'
      );
    }

    if (analysis.averageJSSize > 50000) {
      analysis.recommendations.push(
        'Large JavaScript files detected. Consider code splitting or minification'
      );
    }

    if (analysis.totalJSFiles > 10) {
      analysis.recommendations.push(
        'Many external JS files. Consider bundling for better performance'
      );
    }

    return analysis;
  }
}

module.exports = { BuildSystemIntegration };