/**
 * Vite Performance Monitoring Plugin
 * Integrates performance monitoring into the Vite build pipeline
 */

import type { Plugin, ViteDevServer } from 'vite';
import { performanceMonitor } from './performance-monitor.js';
import { buildPerformanceTracker } from './build-performance-tracker.js';
import { bundleAnalyzer } from './bundle-analyzer.js';
import { runtimePerformanceTracker } from './runtime-performance-tracker.js';

/**
 * Plugin configuration options
 */
export interface VitePerformancePluginOptions {
  enabled?: boolean;
  trackBuildTime?: boolean;
  trackBundleSize?: boolean;
  trackRouteLoading?: boolean;
  generateReports?: boolean;
  outputDirectory?: string;
  verboseLogging?: boolean;
  thresholds?: {
    buildTime?: { warning: number; critical: number };
    bundleSize?: { warning: number; critical: number };
    fileProcessing?: { warning: number; critical: number };
  };
}

/**
 * Create Vite performance monitoring plugin
 */
export function createVitePerformancePlugin(options: VitePerformancePluginOptions = {}): Plugin {
  const config = {
    enabled: true,
    trackBuildTime: true,
    trackBundleSize: true,
    trackRouteLoading: true,
    generateReports: true,
    outputDirectory: './performance-reports',
    verboseLogging: false,
    thresholds: {
      buildTime: { warning: 5000, critical: 15000 },
      bundleSize: { warning: 250000, critical: 500000 },
      fileProcessing: { warning: 1000, critical: 3000 }
    },
    ...options
  };

  let isDev = false;
  let isProduction = false;
  let server: ViteDevServer | null = null;
  let buildStartTime = 0;
  let filesProcessed = 0;
  let cacheHits = 0;

  const log = (message: string, ...args: any[]) => {
    if (config.verboseLogging || isDev) {
      console.log(`[Performance] ${message}`, ...args);
    }
  };

  return {
    name: 'vite-performance-monitor',
    enforce: 'pre',

    configResolved(resolvedConfig) {
      isDev = resolvedConfig.command === 'serve';
      isProduction = resolvedConfig.command === 'build';
      
      if (config.enabled) {
        log(`Performance monitoring ${isDev ? 'development' : 'production'} mode enabled`);
      }
    },

    buildStart() {
      if (!config.enabled) return;

      buildStartTime = Date.now();
      filesProcessed = 0;
      cacheHits = 0;

      // Initialize performance monitoring
      performanceMonitor.startBuildTracking();
      buildPerformanceTracker.startBuild();

      log('Build performance tracking started');
    },

    resolveId(id, importer) {
      if (!config.enabled || !config.trackBuildTime) return null;

      // Track file resolution performance
      if (id.endsWith('.mtm') || id.endsWith('.js') || id.endsWith('.ts')) {
        performanceMonitor.trackFileProcessing(id, 0, false);
      }

      return null;
    },

    load(id) {
      if (!config.enabled || !config.trackBuildTime) return null;

      // Track file loading performance
      if (id.endsWith('.mtm') || id.endsWith('.js') || id.endsWith('.ts')) {
        const startTime = performance.now();
        
        // Simulate file size calculation (in real implementation, get actual size)
        const estimatedSize = id.length * 10; // Rough estimate
        
        performanceMonitor.trackFileProcessing(id, estimatedSize, false);
        
        // Track in build performance tracker
        buildPerformanceTracker.trackFileProcessing(
          id,
          estimatedSize,
          performance.now() - startTime,
          false, // fromCache - would need actual cache detection
          [], // transformations
          [] // dependencies
        );

        filesProcessed++;
      }

      return null;
    },

    transform(code, id) {
      if (!config.enabled || !config.trackBuildTime) return null;

      const startTime = performance.now();

      // Track transformation performance
      if (id.endsWith('.mtm')) {
        performanceMonitor.trackBuildPhase('mtm-transformation');
        
        // End file processing tracking
        performanceMonitor.endFileProcessing(id);
        
        const transformTime = performance.now() - startTime;
        
        if (transformTime > config.thresholds.fileProcessing.warning) {
          log(`Slow MTM transformation: ${id} (${transformTime.toFixed(2)}ms)`);
        }
        
        performanceMonitor.endBuildPhase('mtm-transformation');
      }

      return null;
    },

    generateBundle(options, bundle) {
      if (!config.enabled || !config.trackBundleSize) return;

      performanceMonitor.trackBuildPhase('bundle-generation');
      buildPerformanceTracker.startBundleGenerationTracking();

      // Analyze bundle sizes
      Object.entries(bundle).forEach(([fileName, chunk]) => {
        if (chunk.type === 'chunk') {
          const originalSize = chunk.code.length;
          const compressedSize = Math.floor(originalSize * 0.7); // Estimate compression
          const dependencies = chunk.imports || [];

          // Track bundle metrics
          performanceMonitor.trackBundleSize(
            fileName,
            originalSize,
            compressedSize,
            1, // chunk count
            dependencies
          );

          // Track in build performance tracker
          buildPerformanceTracker.trackBundleGeneration(
            fileName,
            originalSize,
            compressedSize,
            1,
            dependencies
          );

          // Analyze bundle if enabled
          if (config.generateReports) {
            // Note: In real implementation, would pass actual bundle file path
            // bundleAnalyzer.analyzeBundle(fileName, bundlePath);
          }

          log(`Bundle analyzed: ${fileName} (${(originalSize / 1024).toFixed(1)}KB)`);
        }
      });

      buildPerformanceTracker.endBundleGenerationTracking();
      performanceMonitor.endBuildPhase('bundle-generation');
    },

    buildEnd() {
      if (!config.enabled) return;

      const buildTime = Date.now() - buildStartTime;
      const cacheHitRate = filesProcessed > 0 ? cacheHits / filesProcessed : 0;

      // End performance tracking
      performanceMonitor.endBuildTracking(filesProcessed, cacheHitRate);
      const buildStats = buildPerformanceTracker.endBuild();

      // Generate performance reports
      if (config.generateReports) {
        performanceMonitor.saveReport();
        log('Performance reports generated');
      }

      // Print performance summary
      performanceMonitor.printSummary();

      log(`Build completed in ${buildTime}ms (${filesProcessed} files processed)`);
    },

    configureServer(serverInstance) {
      if (!config.enabled || !isDev) return;

      server = serverInstance;
      
      // Set up development server performance monitoring
      server.middlewares.use('/api/performance', (req, res, next) => {
        if (req.url === '/metrics') {
          const metrics = {
            build: performanceMonitor.getBuildPerformanceMetrics(),
            runtime: runtimePerformanceTracker.getRouteLoadingStats(),
            navigation: runtimePerformanceTracker.getNavigationStats(),
            client: runtimePerformanceTracker.getClientMetrics()
          };

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(metrics, null, 2));
        } else {
          next();
        }
      });

      // Send performance data to client
      server.ws.on('connection', (socket) => {
        socket.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString());
            
            if (message.type === 'performance:request-metrics') {
              const metrics = performanceMonitor.getMetrics();
              socket.send(JSON.stringify({
                type: 'performance:metrics',
                data: metrics
              }));
            }
          } catch (error) {
            // Ignore invalid messages
          }
        });
      });

      log('Development server performance monitoring configured');
    },

    handleHotUpdate(ctx) {
      if (!config.enabled || !isDev) return;

      const { file, timestamp } = ctx;
      
      // Track HMR performance
      runtimePerformanceTracker.trackCustomMetric(
        'hmr-update',
        timestamp,
        'ms'
      );

      log(`HMR update: ${file}`);
    }
  };
}

/**
 * Default Vite performance plugin with standard configuration
 */
export const vitePerformancePlugin = createVitePerformancePlugin();

/**
 * Development-focused performance plugin with verbose logging
 */
export const vitePerformancePluginDev = createVitePerformancePlugin({
  verboseLogging: true,
  generateReports: true,
  thresholds: {
    buildTime: { warning: 3000, critical: 10000 },
    bundleSize: { warning: 100000, critical: 250000 },
    fileProcessing: { warning: 500, critical: 1500 }
  }
});

/**
 * Production-focused performance plugin with strict thresholds
 */
export const vitePerformancePluginProd = createVitePerformancePlugin({
  verboseLogging: false,
  generateReports: true,
  thresholds: {
    buildTime: { warning: 10000, critical: 30000 },
    bundleSize: { warning: 500000, critical: 1000000 },
    fileProcessing: { warning: 2000, critical: 5000 }
  }
});