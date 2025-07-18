/**
 * Enhanced Vite Plugin for Metamon Performance Optimization
 * 
 * This plugin integrates all performance optimization features:
 * - Framework lazy loading with service workers
 * - Bundle optimization and code splitting
 * - Layout stability and CLS prevention
 * - Performance monitoring and debugging
 * - Network adaptation and progressive enhancement
 */

import { Plugin, ViteDevServer, ResolvedConfig } from 'vite';
import { OutputBundle } from 'rollup';
import { resolve, join, relative } from 'path';
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';

// Import performance optimization components
import { serviceWorkerPlugin, ServiceWorkerPluginOptions } from './service-worker/vite-plugin-service-worker.js';
import { FrameworkLoaderService } from './framework-loader/framework-loader-service.js';
import { PerformanceMonitor } from './performance-monitoring/performance-monitor.js';
import { LayoutStabilityController } from './layout-stability/layout-stability-controller.js';
import { IntelligentPreloader } from './intelligent-preloader/intelligent-preloader.js';
import { BundleOptimizationOrchestrator } from './bundle-optimization/bundle-optimization-orchestrator.js';
import { ProgressiveEnhancementCoordinator } from './progressive-enhancement/progressive-enhancement-coordinator.js';
import { NetworkAdaptationCoordinator } from './network-adaptation/network-adaptation-coordinator.js';
import { SSROptimizationManager } from './ssr-optimization/ssr-optimization-manager.js';

export interface MetamonPerformanceOptions {
  /**
   * Framework lazy loading configuration
   */
  lazyLoading?: {
    enabled?: boolean;
    strategy?: 'viewport' | 'interaction' | 'idle' | 'immediate';
    intelligentPreload?: boolean;
    targetLoadTime?: number;
  };

  /**
   * Service worker configuration
   */
  serviceWorker?: {
    enabled?: boolean;
    scope?: string;
    cacheStrategy?: 'cache-first' | 'network-first' | 'stale-while-revalidate';
    backgroundExecution?: boolean;
  };

  /**
   * Layout stability configuration
   */
  layoutStability?: {
    enabled?: boolean;
    targetCLS?: number;
    placeholderStrategy?: 'dimensions' | 'skeleton' | 'spinner';
  };

  /**
   * SSR optimization configuration
   */
  ssr?: {
    selectiveHydration?: boolean;
    hydrationStrategy?: 'immediate' | 'viewport' | 'interaction';
    progressiveEnhancement?: boolean;
  };

  /**
   * Network adaptation configuration
   */
  networkAdaptation?: {
    enabled?: boolean;
    bandwidthAware?: boolean;
    intermittentConnectivity?: boolean;
  };

  /**
   * Performance monitoring configuration
   */
  monitoring?: {
    enabled?: boolean;
    webVitals?: boolean;
    frameworkMetrics?: boolean;
    serviceWorkerDebug?: boolean;
  };

  /**
   * Bundle optimization configuration
   */
  bundleOptimization?: {
    enabled?: boolean;
    frameworkSplitting?: boolean;
    sharedDependencyExtraction?: boolean;
    http2Optimization?: boolean;
    cacheStrategyOptimization?: boolean;
  };

  /**
   * Development mode configuration
   */
  development?: {
    enableInDev?: boolean;
    hotReloadCompatibility?: boolean;
    debugMode?: boolean;
  };
}

/**
 * Enhanced Vite plugin for Metamon performance optimization
 */
export function metamonPerformance(options: MetamonPerformanceOptions = {}): Plugin {
  // Default configuration
  const config: Required<MetamonPerformanceOptions> = {
    lazyLoading: {
      enabled: true,
      strategy: 'viewport',
      intelligentPreload: true,
      targetLoadTime: 100,
      ...options.lazyLoading
    },
    serviceWorker: {
      enabled: true,
      scope: '/',
      cacheStrategy: 'stale-while-revalidate',
      backgroundExecution: true,
      ...options.serviceWorker
    },
    layoutStability: {
      enabled: true,
      targetCLS: 0.1,
      placeholderStrategy: 'dimensions',
      ...options.layoutStability
    },
    ssr: {
      selectiveHydration: true,
      hydrationStrategy: 'viewport',
      progressiveEnhancement: true,
      ...options.ssr
    },
    networkAdaptation: {
      enabled: true,
      bandwidthAware: true,
      intermittentConnectivity: true,
      ...options.networkAdaptation
    },
    monitoring: {
      enabled: true,
      webVitals: true,
      frameworkMetrics: true,
      serviceWorkerDebug: false,
      ...options.monitoring
    },
    bundleOptimization: {
      enabled: true,
      frameworkSplitting: true,
      sharedDependencyExtraction: true,
      http2Optimization: true,
      cacheStrategyOptimization: true,
      ...options.bundleOptimization
    },
    development: {
      enableInDev: true,
      hotReloadCompatibility: true,
      debugMode: false,
      ...options.development
    }
  };

  let viteConfig: ResolvedConfig;
  let isDevelopment = false;
  let server: ViteDevServer | undefined;

  // Performance optimization components
  let frameworkLoader: FrameworkLoaderService;
  let performanceMonitor: PerformanceMonitor;
  let layoutStabilityController: LayoutStabilityController;
  let intelligentPreloader: IntelligentPreloader;
  let bundleOptimizer: BundleOptimizationOrchestrator;
  let progressiveEnhancement: ProgressiveEnhancementCoordinator;
  let networkAdaptation: NetworkAdaptationCoordinator;
  let ssrOptimizer: SSROptimizationManager;

  return {
    name: 'metamon-performance',
    
    configResolved(resolvedConfig) {
      viteConfig = resolvedConfig;
      isDevelopment = resolvedConfig.command === 'serve';
      
      // Initialize performance optimization components
      initializePerformanceComponents();
      
      log('info', 'Performance optimization plugin initialized', {
        isDevelopment,
        lazyLoading: config.lazyLoading.enabled,
        serviceWorker: config.serviceWorker.enabled,
        monitoring: config.monitoring.enabled
      });
    },

    configureServer(devServer) {
      if (!isDevelopment || !config.development.enableInDev) {
        return;
      }

      server = devServer;
      
      // Initialize development mode for performance components
      initializeDevelopmentMode();
      
      // Add middleware for performance optimization scripts
      addDevelopmentMiddleware(devServer);
      
      log('info', 'Development server configured with performance optimization');
    },

    async generateBundle(options, bundle) {
      if (isDevelopment && !config.development.enableInDev) {
        return;
      }

      try {
        log('info', 'Starting performance optimization bundle generation...');
        
        // Apply bundle optimization
        if (config.bundleOptimization.enabled && bundleOptimizer) {
          const optimizationResult = await bundleOptimizer.optimizeBundle(bundle);
          log('info', 'Bundle optimization complete', {
            originalSize: Math.floor(optimizationResult.stats.originalSize / 1024) + 'KB',
            optimizedSize: Math.floor(optimizationResult.stats.optimizedSize / 1024) + 'KB',
            compressionRatio: (optimizationResult.stats.compressionRatio * 100).toFixed(1) + '%'
          });
        }

        // Generate service worker if enabled
        if (config.serviceWorker.enabled) {
          await generateServiceWorkerBundle(bundle);
        }

        // Generate framework loader
        if (config.lazyLoading.enabled) {
          await generateFrameworkLoaderBundle(bundle);
        }

        // Generate performance monitoring scripts
        if (config.monitoring.enabled) {
          await generatePerformanceMonitoringBundle(bundle);
        }

        // Generate layout stability scripts
        if (config.layoutStability.enabled) {
          await generateLayoutStabilityBundle(bundle);
        }

        log('info', 'Performance optimization bundle generation complete');

      } catch (error) {
        log('error', 'Error during performance optimization bundle generation:', error);
        throw error;
      }
    },

    transformIndexHtml(html, ctx) {
      if (isDevelopment && config.development.enableInDev) {
        return injectDevelopmentScripts(html);
      } else if (!isDevelopment) {
        return injectProductionScripts(html);
      }
      
      return html;
    }
  };

  /**
   * Initialize performance optimization components
   */
  function initializePerformanceComponents(): void {
    // Framework loader service
    if (config.lazyLoading.enabled) {
      frameworkLoader = new FrameworkLoaderService({
        targetLoadTime: config.lazyLoading.targetLoadTime,
        strategy: config.lazyLoading.strategy,
        intelligentPreload: config.lazyLoading.intelligentPreload
      });
    }

    // Performance monitor
    if (config.monitoring.enabled) {
      performanceMonitor = new PerformanceMonitor({
        webVitals: config.monitoring.webVitals,
        frameworkMetrics: config.monitoring.frameworkMetrics,
        serviceWorkerDebug: config.monitoring.serviceWorkerDebug
      });
    }

    // Layout stability controller
    if (config.layoutStability.enabled) {
      layoutStabilityController = new LayoutStabilityController({
        targetCLS: config.layoutStability.targetCLS,
        placeholderStrategy: config.layoutStability.placeholderStrategy
      });
    }

    // Intelligent preloader
    if (config.lazyLoading.intelligentPreload) {
      intelligentPreloader = new IntelligentPreloader({
        strategy: config.lazyLoading.strategy,
        networkAware: config.networkAdaptation.enabled
      });
    }

    // Bundle optimization orchestrator
    if (config.bundleOptimization.enabled) {
      bundleOptimizer = new BundleOptimizationOrchestrator({
        frameworkSplitting: config.bundleOptimization.frameworkSplitting,
        sharedDependencyExtraction: config.bundleOptimization.sharedDependencyExtraction,
        http2Optimization: config.bundleOptimization.http2Optimization,
        cacheStrategyOptimization: config.bundleOptimization.cacheStrategyOptimization
      });
    }

    // Progressive enhancement coordinator
    progressiveEnhancement = new ProgressiveEnhancementCoordinator({
      serviceWorkerFallback: config.serviceWorker.enabled,
      offlineFunctionality: true,
      errorRecovery: true
    });

    // Network adaptation coordinator
    if (config.networkAdaptation.enabled) {
      networkAdaptation = new NetworkAdaptationCoordinator({
        bandwidthAware: config.networkAdaptation.bandwidthAware,
        intermittentConnectivity: config.networkAdaptation.intermittentConnectivity
      });
    }

    // SSR optimization manager
    if (config.ssr.selectiveHydration) {
      ssrOptimizer = new SSROptimizationManager({
        selectiveHydration: config.ssr.selectiveHydration,
        hydrationStrategy: config.ssr.hydrationStrategy,
        progressiveEnhancement: config.ssr.progressiveEnhancement
      });
    }
  }

  /**
   * Initialize development mode for performance components
   */
  function initializeDevelopmentMode(): void {
    if (performanceMonitor) {
      performanceMonitor.startDevelopmentMonitoring();
      log('info', 'Performance monitoring enabled in development mode');
    }

    if (layoutStabilityController) {
      layoutStabilityController.enableDevelopmentMode();
      log('info', 'Layout stability monitoring enabled');
    }

    if (intelligentPreloader) {
      intelligentPreloader.enableDevelopmentMode();
      log('info', 'Intelligent preloader enabled with development insights');
    }

    if (networkAdaptation) {
      networkAdaptation.enableDevelopmentMode();
      log('info', 'Network adaptation enabled with development simulation');
    }
  }

  /**
   * Add development middleware for performance optimization
   */
  function addDevelopmentMiddleware(devServer: ViteDevServer): void {
    // Serve framework loader client script
    devServer.middlewares.use('/metamon-loader.js', (req, res, next) => {
      res.setHeader('Content-Type', 'application/javascript');
      res.setHeader('Cache-Control', 'no-cache');
      res.end(generateDevelopmentFrameworkLoader());
    });

    // Serve performance monitoring client script
    if (config.monitoring.enabled) {
      devServer.middlewares.use('/metamon-performance.js', (req, res, next) => {
        res.setHeader('Content-Type', 'application/javascript');
        res.setHeader('Cache-Control', 'no-cache');
        res.end(generatePerformanceMonitoringClient());
      });
    }

    // Serve layout stability client script
    if (config.layoutStability.enabled) {
      devServer.middlewares.use('/metamon-layout-stability.js', (req, res, next) => {
        res.setHeader('Content-Type', 'application/javascript');
        res.setHeader('Cache-Control', 'no-cache');
        res.end(generateLayoutStabilityClient());
      });
    }

    // Serve mock service worker in development
    if (config.serviceWorker.enabled) {
      devServer.middlewares.use('/metamon-sw.js', (req, res, next) => {
        res.setHeader('Content-Type', 'application/javascript');
        res.setHeader('Service-Worker-Allowed', '/');
        res.setHeader('Cache-Control', 'no-cache');
        res.end(generateMockServiceWorker());
      });
    }
  }

  /**
   * Generate service worker bundle for production
   */
  async function generateServiceWorkerBundle(bundle: OutputBundle): Promise<void> {
    const swContent = await generateProductionServiceWorker(bundle);
    
    // Add service worker to bundle
    bundle['metamon-sw.js'] = {
      type: 'asset',
      fileName: 'metamon-sw.js',
      source: swContent
    } as any;
    
    log('info', 'Service worker generated for production');
  }

  /**
   * Generate framework loader bundle
   */
  async function generateFrameworkLoaderBundle(bundle: OutputBundle): Promise<void> {
    const loaderContent = generateProductionFrameworkLoader(bundle);
    
    // Add framework loader to bundle
    bundle['metamon-loader.js'] = {
      type: 'asset',
      fileName: 'metamon-loader.js',
      source: loaderContent
    } as any;
    
    log('info', 'Framework loader generated for production');
  }

  /**
   * Generate performance monitoring bundle
   */
  async function generatePerformanceMonitoringBundle(bundle: OutputBundle): Promise<void> {
    const monitoringContent = generatePerformanceMonitoringClient();
    
    // Add performance monitoring to bundle
    bundle['metamon-performance.js'] = {
      type: 'asset',
      fileName: 'metamon-performance.js',
      source: monitoringContent
    } as any;
    
    log('info', 'Performance monitoring script generated for production');
  }

  /**
   * Generate layout stability bundle
   */
  async function generateLayoutStabilityBundle(bundle: OutputBundle): Promise<void> {
    const stabilityContent = generateLayoutStabilityClient();
    
    // Add layout stability to bundle
    bundle['metamon-layout-stability.js'] = {
      type: 'asset',
      fileName: 'metamon-layout-stability.js',
      source: stabilityContent
    } as any;
    
    log('info', 'Layout stability script generated for production');
  }

  /**
   * Inject development scripts into HTML
   */
  function injectDevelopmentScripts(html: string): string {
    let injectedScripts = '';

    // Inject framework loader script
    if (config.lazyLoading.enabled) {
      injectedScripts += `<script src="/metamon-loader.js" defer></script>\n`;
    }

    // Inject performance monitoring script
    if (config.monitoring.enabled) {
      injectedScripts += `<script src="/metamon-performance.js" defer></script>\n`;
    }

    // Inject layout stability script
    if (config.layoutStability.enabled) {
      injectedScripts += `<script src="/metamon-layout-stability.js" defer></script>\n`;
    }

    // Inject service worker registration
    if (config.serviceWorker.enabled) {
      injectedScripts += `
<script>
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/metamon-sw.js', {
      scope: '${config.serviceWorker.scope}'
    }).then(registration => {
      console.log('[Metamon] Development service worker registered:', registration.scope);
    }).catch(error => {
      console.warn('[Metamon] Service worker registration failed:', error);
    });
  });
}
</script>\n`;
    }

    return html.replace('</head>', `${injectedScripts}</head>`);
  }

  /**
   * Inject production scripts into HTML
   */
  function injectProductionScripts(html: string): string {
    let injectedScripts = '';

    // Inject framework loader script
    if (config.lazyLoading.enabled) {
      injectedScripts += `<script src="/metamon-loader.js" defer></script>\n`;
    }

    // Inject performance monitoring script
    if (config.monitoring.enabled) {
      injectedScripts += `<script src="/metamon-performance.js" defer></script>\n`;
    }

    // Inject layout stability script
    if (config.layoutStability.enabled) {
      injectedScripts += `<script src="/metamon-layout-stability.js" defer></script>\n`;
    }

    // Inject service worker registration
    if (config.serviceWorker.enabled) {
      injectedScripts += `
<script>
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/metamon-sw.js', {
      scope: '${config.serviceWorker.scope}'
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

  /**
   * Generate development framework loader
   */
  function generateDevelopmentFrameworkLoader(): string {
    return `
// Metamon Development Framework Loader
(function() {
  'use strict';
  
  console.log('[Metamon] Development framework loader initialized');
  
  const config = ${JSON.stringify(config.lazyLoading, null, 2)};
  
  class MetamonDevLoader {
    constructor() {
      this.loadedFrameworks = new Set();
      this.loadingPromises = new Map();
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
   * Generate production framework loader
   */
  function generateProductionFrameworkLoader(bundle: OutputBundle): string {
    // Analyze bundle to create framework manifest
    const frameworkManifest = analyzeFrameworkBundles(bundle);
    
    return `
// Metamon Production Framework Loader
(function() {
  'use strict';
  
  const MANIFEST = ${JSON.stringify(frameworkManifest, null, 2)};
  const config = ${JSON.stringify(config.lazyLoading, null, 2)};
  
  class MetamonFrameworkLoader {
    constructor() {
      this.loadedFrameworks = new Set();
      this.loadingPromises = new Map();
      this.serviceWorkerReady = this.initServiceWorker();
    }
    
    async initServiceWorker() {
      if ('serviceWorker' in navigator && ${config.serviceWorker.enabled}) {
        try {
          const registration = await navigator.serviceWorker.register('/metamon-sw.js');
          return registration;
        } catch (error) {
          console.warn('[Metamon] Service worker registration failed:', error);
          return null;
        }
      }
      return null;
    }
    
    async loadFramework(frameworkName, priority = 'normal') {
      if (this.loadedFrameworks.has(frameworkName)) {
        return Promise.resolve();
      }
      
      if (this.loadingPromises.has(frameworkName)) {
        return this.loadingPromises.get(frameworkName);
      }
      
      const loadPromise = this._loadFrameworkChunks(frameworkName, priority);
      this.loadingPromises.set(frameworkName, loadPromise);
      
      try {
        await loadPromise;
        this.loadedFrameworks.add(frameworkName);
        this.loadingPromises.delete(frameworkName);
      } catch (error) {
        this.loadingPromises.delete(frameworkName);
        throw error;
      }
    }
    
    async _loadFrameworkChunks(frameworkName, priority) {
      const frameworkInfo = MANIFEST.frameworks[frameworkName];
      if (!frameworkInfo) {
        throw new Error(\`Framework \${frameworkName} not found in manifest\`);
      }
      
      const chunks = frameworkInfo.chunks;
      const loadPromises = chunks.map(chunkName => {
        const chunkInfo = MANIFEST.chunks[chunkName];
        return this._loadChunk(chunkInfo.path, priority);
      });
      
      await Promise.all(loadPromises);
    }
    
    async _loadChunk(chunkPath, priority) {
      return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = chunkPath;
        script.async = true;
        
        if (priority === 'critical') {
          script.setAttribute('fetchpriority', 'high');
        }
        
        script.onload = resolve;
        script.onerror = () => reject(new Error(\`Failed to load chunk: \${chunkPath}\`));
        
        document.head.appendChild(script);
      });
    }
    
    isFrameworkLoaded(frameworkName) {
      return this.loadedFrameworks.has(frameworkName);
    }
    
    getLoadedFrameworks() {
      return Array.from(this.loadedFrameworks);
    }
  }
  
  // Create global instance
  window.MetamonLoader = new MetamonFrameworkLoader();
  
  // Auto-load critical frameworks
  Object.entries(MANIFEST.frameworks).forEach(([name, info]) => {
    if (info.priority === 'critical' || info.preload) {
      window.MetamonLoader.loadFramework(name, info.priority);
    }
  });
  
})();
`;
  }

  /**
   * Generate performance monitoring client
   */
  function generatePerformanceMonitoringClient(): string {
    return `
// Metamon Performance Monitoring Client
(function() {
  'use strict';
  
  const config = ${JSON.stringify(config.monitoring, null, 2)};
  
  class MetamonPerformanceMonitor {
    constructor() {
      this.metrics = {
        frameworkLoading: new Map(),
        webVitals: {},
        cachePerformance: {}
      };
      
      if (config.webVitals) this.initWebVitalsMonitoring();
      if (config.frameworkMetrics) this.initFrameworkMetrics();
    }
    
    initWebVitalsMonitoring() {
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
    
    initFrameworkMetrics() {
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
  
  // Report metrics periodically
  setInterval(() => {
    window.MetamonPerformance.reportMetrics();
  }, ${isDevelopment ? 10000 : 30000});
  
})();
`;
  }

  /**
   * Generate layout stability client
   */
  function generateLayoutStabilityClient(): string {
    return `
// Metamon Layout Stability Client
(function() {
  'use strict';
  
  const config = ${JSON.stringify(config.layoutStability, null, 2)};
  
  class MetamonLayoutStability {
    constructor() {
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
            
            if (this.clsScore > config.targetCLS) {
              console.warn(\`[Metamon] CLS threshold exceeded: \${this.clsScore.toFixed(4)} > \${config.targetCLS}\`);
            }
          }
        });
      }).observe({ entryTypes: ['layout-shift'] });
    }
    
    initPlaceholderSystem() {
      this.createPlaceholders();
      
      // Monitor for new components
      const observer = new MutationObserver((mutations) => {
        mutations.forEach(mutation => {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const components = node.querySelectorAll ? 
                node.querySelectorAll('[data-metamon-component]') : [];
              components.forEach(component => {
                if (!component.hasAttribute('data-metamon-loaded')) {
                  this.createPlaceholder(component);
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
      
      const strategy = config.placeholderStrategy;
      if (strategy === 'dimensions') {
        placeholder.style.cssText = \`
          width: \${element.offsetWidth || 200}px;
          height: \${element.offsetHeight || 100}px;
          background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
          background-size: 200% 100%;
          animation: metamon-loading 1.5s infinite;
          border-radius: 4px;
        \`;
      } else if (strategy === 'skeleton') {
        placeholder.innerHTML = \`
          <div style="background: #f0f0f0; height: 20px; margin-bottom: 10px; border-radius: 4px; animation: metamon-loading 1.5s infinite;"></div>
          <div style="background: #f0f0f0; height: 16px; width: 80%; margin-bottom: 8px; border-radius: 4px; animation: metamon-loading 1.5s infinite;"></div>
          <div style="background: #f0f0f0; height: 16px; width: 60%; border-radius: 4px; animation: metamon-loading 1.5s infinite;"></div>
        \`;
      } else {
        placeholder.innerHTML = \`
          <div style="display: flex; align-items: center; justify-content: center; height: 100px;">
            <div style="width: 40px; height: 40px; border: 4px solid #f0f0f0; border-top: 4px solid #007bff; border-radius: 50%; animation: metamon-spin 1s linear infinite;"></div>
          </div>
        \`;
      }
      
      // Add loading animation styles if not already present
      if (!document.getElementById('metamon-loading-styles')) {
        const style = document.createElement('style');
        style.id = 'metamon-loading-styles';
        style.textContent = \`
          @keyframes metamon-loading {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }
          @keyframes metamon-spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
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
  
})();
`;
  }

  /**
   * Generate mock service worker for development
   */
  function generateMockServiceWorker(): string {
    return `
// Mock Service Worker for Development
console.log('[Metamon SW] Mock service worker loaded');

self.addEventListener('install', () => {
  console.log('[Metamon SW] Mock service worker installed');
  self.skipWaiting();
});

self.addEventListener('activate', () => {
  console.log('[Metamon SW] Mock service worker activated');
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Pass through all requests in development
  console.log('[Metamon SW] Mock fetch:', event.request.url);
});
`;
  }

  /**
   * Generate production service worker
   */
  async function generateProductionServiceWorker(bundle: OutputBundle): Promise<string> {
    const frameworkManifest = analyzeFrameworkBundles(bundle);
    
    return `
// Metamon Service Worker - Generated at ${new Date().toISOString()}
const CACHE_NAME = 'metamon-frameworks-v${Date.now()}';
const MANIFEST = ${JSON.stringify(frameworkManifest, null, 2)};
const CONFIG = ${JSON.stringify(config.serviceWorker, null, 2)};

self.addEventListener('install', (event) => {
  console.log('[Metamon SW] Installing service worker');
  event.waitUntil(
    caches.open(CACHE_NAME).then(() => {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', (event) => {
  console.log('[Metamon SW] Activating service worker');
  event.waitUntil(
    Promise.all([
      cleanupOldCaches(),
      self.clients.claim()
    ])
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  if (url.pathname.includes('/metamon-framework/') || 
      url.pathname.includes('/metamon-loader.js') ||
      url.pathname.includes('/metamon-performance.js') ||
      url.pathname.includes('/metamon-layout-stability.js')) {
    event.respondWith(handleFrameworkRequest(event.request));
  }
});

async function handleFrameworkRequest(request) {
  try {
    const cache = await caches.open(CACHE_NAME);
    
    if (CONFIG.cacheStrategy === 'cache-first') {
      const cachedResponse = await cache.match(request);
      if (cachedResponse) {
        return cachedResponse;
      }
    }
    
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.error('[Metamon SW] Framework request failed:', error);
    
    // Try cache as fallback
    const cachedResponse = await caches.open(CACHE_NAME).then(cache => cache.match(request));
    if (cachedResponse) {
      return cachedResponse;
    }
    
    return new Response('Framework loading failed', { status: 500 });
  }
}

async function cleanupOldCaches() {
  const cacheNames = await caches.keys();
  const oldCaches = cacheNames.filter(name => 
    name.startsWith('metamon-frameworks-') && name !== CACHE_NAME
  );
  
  return Promise.all(oldCaches.map(name => caches.delete(name)));
}
`;
  }

  /**
   * Analyze framework bundles to create manifest
   */
  function analyzeFrameworkBundles(bundle: OutputBundle): any {
    const frameworks: any = {};
    const chunks: any = {};
    
    // Analyze bundle chunks to identify framework-specific code
    Object.entries(bundle).forEach(([fileName, chunk]) => {
      if (chunk.type === 'chunk') {
        // Identify framework chunks based on imports or file names
        const isReactChunk = fileName.includes('react') || 
          Object.keys(chunk.modules || {}).some(mod => mod.includes('react'));
        const isVueChunk = fileName.includes('vue') || 
          Object.keys(chunk.modules || {}).some(mod => mod.includes('vue'));
        const isSolidChunk = fileName.includes('solid') || 
          Object.keys(chunk.modules || {}).some(mod => mod.includes('solid'));
        const isSvelteChunk = fileName.includes('svelte') || 
          Object.keys(chunk.modules || {}).some(mod => mod.includes('svelte'));
        
        chunks[fileName] = {
          path: `/${fileName}`,
          size: chunk.code?.length || 0,
          hash: fileName.split('.')[1] || 'unknown',
          dependencies: chunk.imports || [],
          type: 'core'
        };
        
        if (isReactChunk) {
          frameworks.reactjs = frameworks.reactjs || { chunks: [], dependencies: ['react', 'react-dom'], size: 0, priority: 'high', preload: true };
          frameworks.reactjs.chunks.push(fileName);
          frameworks.reactjs.size += chunks[fileName].size;
        }
        
        if (isVueChunk) {
          frameworks.vue = frameworks.vue || { chunks: [], dependencies: ['vue'], size: 0, priority: 'high', preload: true };
          frameworks.vue.chunks.push(fileName);
          frameworks.vue.size += chunks[fileName].size;
        }
        
        if (isSolidChunk) {
          frameworks.solid = frameworks.solid || { chunks: [], dependencies: ['solid-js'], size: 0, priority: 'normal', preload: false };
          frameworks.solid.chunks.push(fileName);
          frameworks.solid.size += chunks[fileName].size;
        }
        
        if (isSvelteChunk) {
          frameworks.svelte = frameworks.svelte || { chunks: [], dependencies: ['svelte'], size: 0, priority: 'normal', preload: false };
          frameworks.svelte.chunks.push(fileName);
          frameworks.svelte.size += chunks[fileName].size;
        }
      }
    });
    
    return {
      version: Date.now().toString(),
      timestamp: Date.now(),
      frameworks,
      chunks,
      cacheStrategy: Object.keys(chunks).reduce((acc, chunkName) => {
        acc[chunkName] = {
          maxAge: 24 * 60 * 60 * 1000, // 24 hours
          strategy: config.serviceWorker.cacheStrategy
        };
        return acc;
      }, {} as any)
    };
  }

  /**
   * Log messages based on configuration
   */
  function log(level: 'error' | 'warn' | 'info' | 'debug', message: string, data?: any): void {
    const prefix = `[Metamon Performance]`;
    if (data) {
      console[level](`${prefix} ${message}`, data);
    } else {
      console[level](`${prefix} ${message}`);
    }
  }
}

/**
 * Default export for convenience
 */
export default metamonPerformance;