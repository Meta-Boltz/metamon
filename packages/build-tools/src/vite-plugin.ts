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
 * Vite plugin for processing .mtm files
 */
export function metamon(options: MetamonOptions = {}): Plugin {
  const {
    root = 'src',
    pagesDir = 'pages',
    componentsDir = 'components',
    hmr = true,
    sourceMaps,
    adapters: customAdapters = {},
    optimization = {}
  } = options;

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

  return {
    name: 'metamon',
    
    async configureServer(devServer) {
      server = devServer;
      
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


  };
}

/**
 * Default export for convenience
 */
export default metamon;