import { Plugin, ViteDevServer, HmrContext } from 'vite';
import { readFileSync, existsSync, statSync } from 'fs';
import { resolve, extname, relative } from 'path';
import { MTMParser, MTMImportResolver } from '@metamon/core';
import { 
  ReactAdapter, 
  VueAdapter, 
  SolidAdapter, 
  SvelteAdapter,
  FrameworkAdapter 
} from '@metamon/adapters';
import { IncrementalCompiler } from './incremental-compiler.js';
import { MetamonFileWatcher } from './file-watcher.js';
import { DependencyTracker } from './dependency-tracker.js';
import { MTMModuleBundler } from './module-bundler.js';

import { MetamonViteOptions } from './types/build-options.js';
import { TreeShaker, TreeShakingConfig } from './tree-shaker.js';
import { BundleAnalyzer, BundleAnalysisConfig } from './bundle-analyzer.js';
import { ProductionOptimizer, ProductionOptimizationConfig } from './production-optimizer.js';

// Performance optimization imports
import { serviceWorkerPlugin, ServiceWorkerPluginOptions } from './service-worker/vite-plugin-service-worker.js';
import { FrameworkLoaderService } from './framework-loader/framework-loader-service.js';
import { PerformanceMonitor } from './performance-monitoring/performance-monitor.js';
import { LayoutStabilityController } from './layout-stability/layout-stability-controller.js';
import { IntelligentPreloader } from './intelligent-preloader/intelligent-preloader.js';
import { BundleOptimizationOrchestrator } from './bundle-optimization/bundle-optimization-orchestrator.js';
import { ProgressiveEnhancementCoordinator } from './progressive-enhancement/progressive-enhancement-coordinator.js';
import { NetworkAdaptationCoordinator } from './network-adaptation/network-adaptation-coordinator.js';

// Re-export for convenience
export type MetamonOptions = MetamonViteOptions;

/**
 * Cache for compiled .mtm files
 */
interface CompilationCache {
  [filePath: string]: {
    code: string;
    dependencies: string[];
    lastModified: number;
  };
}

/**
 * Vite plugin for processing .mtm files with performance optimization
 */
export function metamon(options: MetamonOptions = {}): Plugin {
  const {
    root = 'src',
    pagesDir = 'pages',
    componentsDir = 'components',
    hmr = true,
    sourceMaps,
    adapters: customAdapters = {},
    optimization = {},
    performance = {}
  } = options;

  // Performance optimization defaults
  const performanceConfig = {
    lazyLoading: {
      enabled: true,
      strategy: 'viewport' as const,
      intelligentPreload: true,
      targetLoadTime: 100,
      ...performance.lazyLoading
    },
    serviceWorker: {
      enabled: true,
      scope: '/',
      cacheStrategy: 'stale-while-revalidate' as const,
      backgroundExecution: true,
      ...performance.serviceWorker
    },
    layoutStability: {
      enabled: true,
      targetCLS: 0.1,
      placeholderStrategy: 'dimensions' as const,
      ...performance.layoutStability
    },
    ssr: {
      selectiveHydration: true,
      hydrationStrategy: 'viewport' as const,
      progressiveEnhancement: true,
      ...performance.ssr
    },
    networkAdaptation: {
      enabled: true,
      bandwidthAware: true,
      intermittentConnectivity: true,
      ...performance.networkAdaptation
    },
    monitoring: {
      enabled: true,
      webVitals: true,
      frameworkMetrics: true,
      serviceWorkerDebug: false,
      ...performance.monitoring
    }
  };

  // Initialize framework adapters
  const adapters: Record<string, FrameworkAdapter> = {
    reactjs: new ReactAdapter(),
    vue: new VueAdapter(),
    solid: new SolidAdapter(),
    svelte: new SvelteAdapter(),
    ...customAdapters
  };

  const parser = new MTMParser();
  const compilationCache: CompilationCache = {};
  const incrementalCompiler = new IncrementalCompiler(adapters);
  const fileWatcher = new MetamonFileWatcher();
  const dependencyTracker = new DependencyTracker({
    root: resolve(process.cwd(), root),
    pagesDir,
    componentsDir
  });
  const moduleBundler = new MTMModuleBundler();
  let server: ViteDevServer | undefined;

  // Initialize optimization tools for production builds
  let productionOptimizer: ProductionOptimizer | undefined;
  let bundleAnalyzer: BundleAnalyzer | undefined;

  // Initialize performance optimization components
  let frameworkLoader: FrameworkLoaderService | undefined;
  let performanceMonitor: PerformanceMonitor | undefined;
  let layoutStabilityController: LayoutStabilityController | undefined;
  let intelligentPreloader: IntelligentPreloader | undefined;
  let bundleOptimizer: BundleOptimizationOrchestrator | undefined;
  let progressiveEnhancement: ProgressiveEnhancementCoordinator | undefined;
  let networkAdaptation: NetworkAdaptationCoordinator | undefined;

  // Initialize performance components if enabled
  if (performanceConfig.lazyLoading.enabled) {
    frameworkLoader = new FrameworkLoaderService({
      serviceWorkerEnabled: performanceConfig.serviceWorker.enabled,
      fallbackEnabled: true,
      loadingStrategy: {
        maxConcurrentLoads: 3,
        timeoutMs: performanceConfig.lazyLoading.targetLoadTime * 10,
        retryAttempts: 2,
        retryDelayMs: 1000,
        priorityWeights: {
          critical: 1.0,
          high: 0.8,
          normal: 0.6,
          low: 0.4
        },
        networkAdaptation: {
          enabled: performanceConfig.networkAdaptation.enabled,
          slowNetworkThreshold: 1000,
          adaptiveTimeout: true
        }
      },
      cacheConfig: {
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        maxSize: 50 * 1024 * 1024, // 50MB
        compressionEnabled: true,
        invalidationStrategy: 'version'
      },
      enableMetrics: performanceConfig.monitoring.frameworkMetrics,
      enableLogging: performanceConfig.monitoring.serviceWorkerDebug
    });
  }

  if (performanceConfig.monitoring.enabled) {
    performanceMonitor = new PerformanceMonitor({
      webVitals: performanceConfig.monitoring.webVitals,
      frameworkMetrics: performanceConfig.monitoring.frameworkMetrics,
      serviceWorkerDebug: performanceConfig.monitoring.serviceWorkerDebug
    });
  }

  if (performanceConfig.layoutStability.enabled) {
    layoutStabilityController = new LayoutStabilityController({
      targetCLS: performanceConfig.layoutStability.targetCLS,
      placeholderStrategy: performanceConfig.layoutStability.placeholderStrategy
    });
  }

  if (performanceConfig.lazyLoading.intelligentPreload) {
    intelligentPreloader = new IntelligentPreloader({
      strategy: performanceConfig.lazyLoading.strategy,
      networkAware: performanceConfig.networkAdaptation.enabled
    });
  }

  if (performanceConfig.networkAdaptation.enabled) {
    networkAdaptation = new NetworkAdaptationCoordinator({
      bandwidthAware: performanceConfig.networkAdaptation.bandwidthAware,
      intermittentConnectivity: performanceConfig.networkAdaptation.intermittentConnectivity
    });
  }

  // Initialize bundle optimization orchestrator
  bundleOptimizer = new BundleOptimizationOrchestrator({
    frameworkSplitting: true,
    sharedDependencyExtraction: true,
    http2Optimization: true,
    cacheStrategyOptimization: true
  });

  // Initialize progressive enhancement coordinator
  progressiveEnhancement = new ProgressiveEnhancementCoordinator({
    serviceWorkerFallback: true,
    offlineFunctionality: true,
    errorRecovery: true
  });

  /**
   * Compile a .mtm file to framework-specific code
   */
  async function compileMTMFile(filePath: string): Promise<string> {
    try {
      // Use incremental compiler for better performance
      const result = await incrementalCompiler.compile(filePath);
      
      // Add file watching for dependencies in development
      if (server && result.dependencies.length > 0) {
        result.dependencies.forEach(dep => {
          if (dep.startsWith('./') || dep.startsWith('../')) {
            const depPath = resolve(filePath, '..', dep);
            if (existsSync(depPath)) {
              fileWatcher.addPath(depPath);
            }
          }
        });
      }

      return result.code;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown compilation error';
      
      // In development, return a module that shows the error
      if (server) {
        return `
          console.error('Metamon compilation error in ${filePath}:', '${errorMessage}');
          export default function ErrorComponent() {
            return React.createElement('div', {
              style: { 
                color: 'red', 
                padding: '20px', 
                border: '1px solid red',
                borderRadius: '4px',
                margin: '10px',
                fontFamily: 'monospace'
              }
            }, [
              React.createElement('h3', { key: 'title' }, 'Metamon Compilation Error'),
              React.createElement('p', { key: 'file' }, 'File: ${filePath}'),
              React.createElement('p', { key: 'error' }, 'Error: ${errorMessage}'),
              React.createElement('p', { key: 'help' }, 'Check your .mtm file syntax and frontmatter configuration.')
            ]);
          }
        `;
      }
      
      // In production, throw the error
      throw new Error(`Failed to compile ${filePath}: ${errorMessage}`);
    }
  }

  /**
   * Check if a file is a .mtm page file
   */
  function isPageFile(filePath: string): boolean {
    const relativePath = relative(process.cwd(), filePath);
    return relativePath.includes(pagesDir) && filePath.endsWith('.mtm');
  }

  /**
   * Check if a file is a .mtm component file
   */
  function isComponentFile(filePath: string): boolean {
    const relativePath = relative(process.cwd(), filePath);
    return relativePath.includes(componentsDir) && filePath.endsWith('.mtm');
  }

  /**
   * Get the route path for a page file
   */
  function getRoutePath(filePath: string): string {
    const relativePath = relative(process.cwd(), filePath);
    const pathWithoutExt = relativePath.replace(/\.mtm$/, '');
    const routePath = pathWithoutExt
      .replace(new RegExp(`^${root}/${pagesDir}`), '')
      .replace(/\/index$/, '')
      .replace(/\\/g, '/');
    
    return routePath || '/';
  }

  // Create service worker plugin configuration
  const serviceWorkerConfig: Partial<ServiceWorkerPluginOptions> = {
    serviceWorker: {
      enabled: performanceConfig.serviceWorker.enabled,
      swPath: '/metamon-sw.js',
      scope: performanceConfig.serviceWorker.scope,
      generateSW: true
    },
    bundleSplitting: {
      enableFrameworkSplitting: true,
      sharedDependencyThreshold: 2,
      chunkSizeThreshold: 50 * 1024, // 50KB
      compressionEnabled: true,
      cacheStrategy: {
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        strategy: performanceConfig.serviceWorker.cacheStrategy
      }
    },
    development: {
      enableInDev: server !== undefined,
      mockServiceWorker: true,
      logLevel: performanceConfig.monitoring.serviceWorkerDebug ? 'debug' : 'info'
    },
    build: {
      generateManifest: true,
      manifestPath: '/metamon-manifest.json',
      outputDir: 'dist',
      enableCompression: true
    }
  };

  return {
    name: 'metamon',
    
    async configureServer(devServer) {
      server = devServer;
      
      // Initialize performance monitoring in development
      if (performanceMonitor && server) {
        performanceMonitor.startDevelopmentMonitoring();
        console.log('Metamon: Performance monitoring enabled in development mode');
      }

      // Initialize layout stability controller in development
      if (layoutStabilityController && server) {
        layoutStabilityController.enableDevelopmentMode();
        console.log('Metamon: Layout stability monitoring enabled');
      }

      // Setup intelligent preloader in development
      if (intelligentPreloader && server) {
        intelligentPreloader.enableDevelopmentMode();
        console.log('Metamon: Intelligent preloader enabled with development insights');
      }

      // Setup network adaptation in development
      if (networkAdaptation && server) {
        networkAdaptation.enableDevelopmentMode();
        console.log('Metamon: Network adaptation enabled with development simulation');
      }

      // Add development middleware for performance optimization features
      if (server && performanceConfig.lazyLoading.enabled) {
        // Serve framework loader client script
        server.middlewares.use('/metamon-loader.js', (req, res, next) => {
          res.setHeader('Content-Type', 'application/javascript');
          res.end(generateDevelopmentFrameworkLoader());
        });

        // Serve performance monitoring client script
        if (performanceConfig.monitoring.enabled) {
          server.middlewares.use('/metamon-performance.js', (req, res, next) => {
            res.setHeader('Content-Type', 'application/javascript');
            res.end(generatePerformanceMonitoringClient());
          });
        }

        // Serve layout stability client script
        if (performanceConfig.layoutStability.enabled) {
          server.middlewares.use('/metamon-layout-stability.js', (req, res, next) => {
            res.setHeader('Content-Type', 'application/javascript');
            res.end(generateLayoutStabilityClient());
          });
        }
      }
      
      // Build initial dependency graph
      try {
        await dependencyTracker.buildDependencyGraph();
        const stats = dependencyTracker.getProjectStats();
        console.log(`Metamon: Found ${stats.totalFiles} .mtm files (${stats.pageCount} pages, ${stats.componentCount} components)`);
        
        if (stats.circularDependencies > 0) {
          console.warn(`Metamon: Warning - ${stats.circularDependencies} circular dependencies detected`);
        }
      } catch (error) {
        console.error('Metamon: Failed to build dependency graph:', error);
      }
      
      // Set up file watching for development
      if (hmr) {
        const watchPaths = [
          resolve(process.cwd(), root, pagesDir),
          resolve(process.cwd(), root, componentsDir)
        ].filter(path => existsSync(path));
        
        if (watchPaths.length > 0) {
          fileWatcher.start(watchPaths);
          
          // Handle file changes with dependency tracking
          fileWatcher.on('file-changed', async (filePath) => {
            try {
              // Get files that need rebuilding based on dependencies
              const filesToRebuild = await dependencyTracker.getFilesToRebuild([filePath]);
              
              // Clear cache for all affected files
              filesToRebuild.forEach(file => {
                incrementalCompiler.clearCache(file);
                delete compilationCache[file];
              });
              
              // Rebuild dependency graph if needed
              if (filesToRebuild.length > 1) {
                await dependencyTracker.buildDependencyGraph();
              }
              
              console.log(`Metamon: Rebuilding ${filesToRebuild.length} files due to changes in ${relative(process.cwd(), filePath)}`);
            } catch (error) {
              console.error('Metamon: Error handling file change:', error);
            }
          });
          
          fileWatcher.on('error', (error) => {
            console.error('Metamon file watcher error:', error);
          });
        }
      }
    },

    /**
     * Resolve .mtm files to their compiled equivalents
     */
    resolveId(id, importer) {
      if (id.endsWith('.mtm') || (importer && importer.endsWith('.mtm'))) {
        // Use the import resolver for proper .mtm file resolution
        const importResolver = new MTMImportResolver({
          root: resolve(process.cwd(), root),
          pagesDir,
          componentsDir,
          extensions: ['.mtm'],
          alias: {
            '@': resolve(process.cwd(), root),
            '@components': resolve(process.cwd(), root, componentsDir),
            '@pages': resolve(process.cwd(), root, pagesDir)
          }
        });

        const resolvedPath = importResolver.resolve(id, importer || '');
        if (resolvedPath && existsSync(resolvedPath)) {
          return resolvedPath + '?mtm-compiled';
        }
      }
      return null;
    },

    /**
     * Load and compile .mtm files
     */
    async load(id) {
      if (id.includes('?mtm-compiled')) {
        const filePath = id.replace('?mtm-compiled', '');
        return await compileMTMFile(filePath);
      }
      return null;
    },

    /**
     * Transform .mtm files during build
     */
    async transform(code, id) {
      if (id.endsWith('.mtm')) {
        return await compileMTMFile(id);
      }
      return null;
    },

    /**
     * Handle hot module replacement for .mtm files
     */
    async handleHotUpdate(ctx: HmrContext) {
      if (!hmr || !server) return;

      const { file, server: devServer } = ctx;
      
      if (file.endsWith('.mtm')) {
        // Clear cache for the updated file
        delete compilationCache[file];
        
        // Find all modules that depend on this .mtm file
        const modules = Array.from(devServer.moduleGraph.getModulesByFile(file) || []);
        
        if (modules.length > 0) {
          // Trigger HMR update
          devServer.ws.send({
            type: 'update',
            updates: modules.map(mod => ({
              type: 'js-update',
              path: mod.url || mod.id || file,
              acceptedPath: mod.url || mod.id || file,
              timestamp: Date.now()
            }))
          });
        }
        
        return modules;
      }
    },

    /**
     * Generate bundle for production build
     */
    async generateBundle(options, bundle) {
      // Initialize optimization tools for production builds
      if (!server && optimization) {
        // Create production optimizer configuration
        const prodOptConfig: ProductionOptimizationConfig = {
          minify: {
            enabled: optimization.minify?.enabled ?? true,
            removeComments: optimization.minify?.removeComments ?? true,
            removeConsole: optimization.minify?.removeConsole ?? true,
            removeDebugger: optimization.minify?.removeDebugger ?? true,
            mangle: optimization.minify?.mangle ?? true,
            compress: optimization.minify?.compress ?? true
          },
          compression: {
            gzip: optimization.compression?.gzip ?? true,
            brotli: optimization.compression?.brotli ?? true,
            level: optimization.compression?.level ?? 6
          },
          treeShaking: {
            runtime: optimization.treeShaking?.runtime ?? true,
            adapters: optimization.treeShaking?.adapters ?? true,
            components: optimization.treeShaking?.components ?? true,
            preserve: optimization.treeShaking?.preserve ?? [],
            aggressive: optimization.treeShaking?.aggressive ?? false
          },
          sourceMaps: sourceMaps ?? false,
          target: optimization.target ?? 'es2015',
          polyfills: optimization.polyfills ?? false
        };

        productionOptimizer = new ProductionOptimizer(prodOptConfig);

        // Create bundle analyzer configuration
        const analysisConfig: BundleAnalysisConfig = {
          detailed: optimization.analysis?.detailed ?? true,
          sourceMaps: optimization.analysis?.sourceMaps ?? false,
          visualization: optimization.analysis?.visualization ?? true,
          thresholds: {
            warning: optimization.analysis?.thresholds?.warning ?? 250 * 1024, // 250KB
            error: optimization.analysis?.thresholds?.error ?? 500 * 1024 // 500KB
          }
        };

        bundleAnalyzer = new BundleAnalyzer(analysisConfig);
      }

      // Process all .mtm files in the bundle
      const mtmChunks: string[] = [];
      Object.keys(bundle).forEach(fileName => {
        const chunk = bundle[fileName];
        if (chunk.type === 'chunk' && fileName.includes('.mtm')) {
          mtmChunks.push(fileName);
        }
      });

      if (mtmChunks.length > 0 && !server) {
        console.log(`Metamon: Applying production optimizations to ${mtmChunks.length} bundles...`);
        
        try {
          // Build dependency graph for optimization
          const dependencyGraph = await dependencyTracker.buildDependencyGraph();

          // Create bundle info for optimization
          const bundleInfos = await Promise.all(
            mtmChunks.map(async (fileName) => {
              const chunk = bundle[fileName];
              if (chunk.type === 'chunk') {
                return {
                  filePath: fileName,
                  sources: Object.keys(chunk.modules || {}),
                  size: chunk.code?.length || 0,
                  dependencies: [], // Will be populated by bundler
                  framework: 'mixed', // Will be determined by bundler
                  type: 'component' as const
                };
              }
              return null;
            })
          );

          const validBundleInfos = bundleInfos.filter(Boolean) as any[];

          if (validBundleInfos.length > 0) {
            const bundleResult = {
              bundles: validBundleInfos,
              buildTime: 0,
              warnings: [],
              analysis: {
                totalSize: validBundleInfos.reduce((sum, b) => sum + b.size, 0),
                largestBundle: validBundleInfos[0],
                duplicateDependencies: []
              }
            };

            // Apply production optimizations
            if (productionOptimizer) {
              const optimizationResult = await productionOptimizer.optimize(bundleResult);
              
              console.log(`Metamon: Optimization complete - ${optimizationResult.stats.reductionPercentage.toFixed(1)}% size reduction`);
              console.log(`Metamon: Applied optimizations: ${optimizationResult.stats.appliedOptimizations.join(', ')}`);
              
              if (optimizationResult.compressed) {
                if (optimizationResult.compressed.gzip) {
                  console.log(`Metamon: Gzip compression: ${(optimizationResult.compressed.gzip.ratio * 100).toFixed(1)}% reduction`);
                }
                if (optimizationResult.compressed.brotli) {
                  console.log(`Metamon: Brotli compression: ${(optimizationResult.compressed.brotli.ratio * 100).toFixed(1)}% reduction`);
                }
              }
            }

            // Generate bundle analysis
            if (bundleAnalyzer) {
              const analysis = await bundleAnalyzer.analyze(bundleResult);
              
              console.log(`Metamon: Bundle Analysis Summary:`);
              console.log(`  - Total bundles: ${analysis.overview.totalBundles}`);
              console.log(`  - Total size: ${Math.floor(analysis.overview.totalSize / 1024)}KB`);
              console.log(`  - Largest bundle: ${analysis.overview.largestBundle}`);
              
              if (analysis.crossBundle.optimizationOpportunities.length > 0) {
                console.log(`Metamon: Optimization opportunities:`);
                analysis.crossBundle.optimizationOpportunities.forEach(opp => {
                  console.log(`  - ${opp}`);
                });
              }

              // Generate warnings for large bundles
              analysis.bundles.forEach(bundleAnalysis => {
                if (bundleAnalysis.warnings.length > 0) {
                  console.warn(`Metamon: ${bundleAnalysis.bundle.filePath}:`);
                  bundleAnalysis.warnings.forEach(warning => {
                    console.warn(`  - ${warning}`);
                  });
                }
              });
            }
          }
        } catch (error) {
          console.error('Metamon: Error during production optimization:', error);
        }
      }
    },

    /**
     * Transform index.html to inject performance optimization scripts
     */
    transformIndexHtml(html, ctx) {
      if (ctx.server && performanceConfig.lazyLoading.enabled) {
        let injectedScripts = '';

        // Inject framework loader script
        injectedScripts += `<script src="/metamon-loader.js" defer></script>\n`;

        // Inject performance monitoring script if enabled
        if (performanceConfig.monitoring.enabled) {
          injectedScripts += `<script src="/metamon-performance.js" defer></script>\n`;
        }

        // Inject layout stability script if enabled
        if (performanceConfig.layoutStability.enabled) {
          injectedScripts += `<script src="/metamon-layout-stability.js" defer></script>\n`;
        }

        // Inject service worker registration if enabled
        if (performanceConfig.serviceWorker.enabled) {
          injectedScripts += `
<script>
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/metamon-sw.js', {
      scope: '${performanceConfig.serviceWorker.scope}'
    }).then(registration => {
      console.log('[Metamon] Service worker registered:', registration.scope);
    }).catch(error => {
      console.warn('[Metamon] Service worker registration failed:', error);
    });
  });
}
</script>\n`;
        }

        return html.replace('</head>', `${injectedScripts}</head>`);
      }
      
      return html;
    }

  };

  /**
   * Generate development framework loader client script
   */
  function generateDevelopmentFrameworkLoader(): string {
    return `
// Metamon Development Framework Loader
(function() {
  'use strict';
  
  console.log('[Metamon] Development framework loader initialized');
  
  class MetamonDevLoader {
    constructor() {
      this.loadedFrameworks = new Set();
      this.loadingPromises = new Map();
      this.config = ${JSON.stringify(performanceConfig.lazyLoading, null, 2)};
    }
    
    async loadFramework(frameworkName, priority = 'normal') {
      if (this.loadedFrameworks.has(frameworkName)) {
        return Promise.resolve();
      }
      
      if (this.loadingPromises.has(frameworkName)) {
        return this.loadingPromises.get(frameworkName);
      }
      
      console.log(\`[Metamon] Loading framework: \${frameworkName} (priority: \${priority})\`);
      
      const loadPromise = this._simulateFrameworkLoad(frameworkName, priority);
      this.loadingPromises.set(frameworkName, loadPromise);
      
      try {
        await loadPromise;
        this.loadedFrameworks.add(frameworkName);
        this.loadingPromises.delete(frameworkName);
        console.log(\`[Metamon] Framework loaded: \${frameworkName}\`);
      } catch (error) {
        this.loadingPromises.delete(frameworkName);
        console.error(\`[Metamon] Framework load failed: \${frameworkName}\`, error);
        throw error;
      }
    }
    
    async _simulateFrameworkLoad(frameworkName, priority) {
      // Simulate network delay based on priority
      const delay = priority === 'critical' ? 50 : 
                   priority === 'high' ? 100 : 
                   priority === 'normal' ? 200 : 300;
      
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // In development, frameworks are already loaded by Vite
      return Promise.resolve();
    }
    
    isFrameworkLoaded(frameworkName) {
      return this.loadedFrameworks.has(frameworkName);
    }
    
    getLoadedFrameworks() {
      return Array.from(this.loadedFrameworks);
    }
  }
  
  // Create global instance
  window.MetamonLoader = new MetamonDevLoader();
  
  // Auto-load common frameworks in development
  const commonFrameworks = ['reactjs', 'vue', 'solid', 'svelte'];
  commonFrameworks.forEach(framework => {
    window.MetamonLoader.loadFramework(framework, 'high');
  });
  
})();
`;
  }

  /**
   * Generate performance monitoring client script
   */
  function generatePerformanceMonitoringClient(): string {
    return `
// Metamon Performance Monitoring Client
(function() {
  'use strict';
  
  console.log('[Metamon] Performance monitoring initialized');
  
  class MetamonPerformanceMonitor {
    constructor() {
      this.config = ${JSON.stringify(performanceConfig.monitoring, null, 2)};
      this.metrics = {
        frameworkLoading: new Map(),
        webVitals: {},
        cachePerformance: {}
      };
      
      this.initWebVitalsMonitoring();
      this.initFrameworkMetrics();
    }
    
    initWebVitalsMonitoring() {
      if (!this.config.webVitals) return;
      
      // Monitor Core Web Vitals
      this.observeWebVitals();
    }
    
    initFrameworkMetrics() {
      if (!this.config.frameworkMetrics) return;
      
      // Monitor framework loading times
      this.observeFrameworkLoading();
    }
    
    observeWebVitals() {
      // LCP (Largest Contentful Paint)
      new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        const lastEntry = entries[entries.length - 1];
        this.metrics.webVitals.lcp = lastEntry.startTime;
        console.log(\`[Metamon] LCP: \${lastEntry.startTime.toFixed(2)}ms\`);
      }).observe({ entryTypes: ['largest-contentful-paint'] });
      
      // FID (First Input Delay)
      new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        entries.forEach(entry => {
          this.metrics.webVitals.fid = entry.processingStart - entry.startTime;
          console.log(\`[Metamon] FID: \${this.metrics.webVitals.fid.toFixed(2)}ms\`);
        });
      }).observe({ entryTypes: ['first-input'] });
      
      // CLS (Cumulative Layout Shift)
      let clsValue = 0;
      new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        entries.forEach(entry => {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
          }
        });
        this.metrics.webVitals.cls = clsValue;
        console.log(\`[Metamon] CLS: \${clsValue.toFixed(4)}\`);
      }).observe({ entryTypes: ['layout-shift'] });
    }
    
    observeFrameworkLoading() {
      // Monitor resource loading
      new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        entries.forEach(entry => {
          if (entry.name.includes('framework') || entry.name.includes('metamon')) {
            const loadTime = entry.responseEnd - entry.startTime;
            console.log(\`[Metamon] Resource loaded: \${entry.name} (\${loadTime.toFixed(2)}ms)\`);
          }
        });
      }).observe({ entryTypes: ['resource'] });
    }
    
    getMetrics() {
      return this.metrics;
    }
    
    reportMetrics() {
      console.group('[Metamon] Performance Metrics');
      console.log('Web Vitals:', this.metrics.webVitals);
      console.log('Framework Loading:', Object.fromEntries(this.metrics.frameworkLoading));
      console.log('Cache Performance:', this.metrics.cachePerformance);
      console.groupEnd();
    }
  }
  
  // Create global instance
  window.MetamonPerformance = new MetamonPerformanceMonitor();
  
  // Report metrics periodically in development
  setInterval(() => {
    window.MetamonPerformance.reportMetrics();
  }, 10000); // Every 10 seconds
  
})();
`;
  }

  /**
   * Generate layout stability client script
   */
  function generateLayoutStabilityClient(): string {
    return `
// Metamon Layout Stability Client
(function() {
  'use strict';
  
  console.log('[Metamon] Layout stability monitoring initialized');
  
  class MetamonLayoutStability {
    constructor() {
      this.config = ${JSON.stringify(performanceConfig.layoutStability, null, 2)};
      this.clsScore = 0;
      this.placeholders = new Map();
      
      this.initCLSMonitoring();
      this.initPlaceholderSystem();
    }
    
    initCLSMonitoring() {
      new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        entries.forEach(entry => {
          if (!entry.hadRecentInput) {
            this.clsScore += entry.value;
            
            if (this.clsScore > this.config.targetCLS) {
              console.warn(\`[Metamon] CLS threshold exceeded: \${this.clsScore.toFixed(4)} > \${this.config.targetCLS}\`);
            }
          }
        });
      }).observe({ entryTypes: ['layout-shift'] });
    }
    
    initPlaceholderSystem() {
      // Create placeholder elements for components that haven't loaded yet
      this.createPlaceholders();
    }
    
    createPlaceholders() {
      const components = document.querySelectorAll('[data-metamon-component]');
      components.forEach(component => {
        if (!component.hasAttribute('data-metamon-loaded')) {
          this.createPlaceholder(component);
        }
      });
    }
    
    createPlaceholder(element) {
      const placeholder = document.createElement('div');
      placeholder.className = 'metamon-placeholder';
      placeholder.style.cssText = \`
        width: \${element.offsetWidth || 200}px;
        height: \${element.offsetHeight || 100}px;
        background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
        background-size: 200% 100%;
        animation: metamon-loading 1.5s infinite;
        border-radius: 4px;
      \`;
      
      // Add loading animation styles if not already present
      if (!document.getElementById('metamon-loading-styles')) {
        const style = document.createElement('style');
        style.id = 'metamon-loading-styles';
        style.textContent = \`
          @keyframes metamon-loading {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }
        \`;
        document.head.appendChild(style);
      }
      
      element.parentNode.insertBefore(placeholder, element);
      element.style.display = 'none';
      
      this.placeholders.set(element, placeholder);
    }
    
    removePlaceholder(element) {
      const placeholder = this.placeholders.get(element);
      if (placeholder) {
        placeholder.remove();
        element.style.display = '';
        element.setAttribute('data-metamon-loaded', 'true');
        this.placeholders.delete(element);
      }
    }
    
    getCLSScore() {
      return this.clsScore;
    }
  }
  
  // Create global instance
  window.MetamonLayoutStability = new MetamonLayoutStability();
  
  // Monitor for new components
  const observer = new MutationObserver((mutations) => {
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const components = node.querySelectorAll ? 
            node.querySelectorAll('[data-metamon-component]') : [];
          components.forEach(component => {
            if (!component.hasAttribute('data-metamon-loaded')) {
              window.MetamonLayoutStability.createPlaceholder(component);
            }
          });
        }
      });
    });
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
})();
`;
  }
}

/**
 * Default export for convenience
 */
export default metamon;