/**
 * Vite Plugin for Service Worker Integration
 * 
 * Integrates service worker functionality with the Metamon build process
 */

import { Plugin, ResolvedConfig } from 'vite';
import { OutputBundle } from 'rollup';
import { resolve, join } from 'path';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { 
  FrameworkBundleSplitter, 
  FrameworkBundleConfig, 
  defaultFrameworkBundleConfig,
  FrameworkManifest 
} from './framework-bundle-splitter.js';

export interface ServiceWorkerPluginOptions {
  // Service worker configuration
  serviceWorker: {
    enabled: boolean;
    swPath: string;
    scope: string;
    generateSW: boolean;
    swTemplate?: string;
  };
  
  // Framework bundle splitting
  bundleSplitting: Partial<FrameworkBundleConfig>;
  
  // Development configuration
  development: {
    enableInDev: boolean;
    mockServiceWorker: boolean;
    logLevel: 'error' | 'warn' | 'info' | 'debug';
  };
  
  // Build configuration
  build: {
    generateManifest: boolean;
    manifestPath: string;
    outputDir: string;
    enableCompression: boolean;
  };
}

/**
 * Vite plugin for service worker integration
 */
export function serviceWorkerPlugin(options: Partial<ServiceWorkerPluginOptions> = {}): Plugin {
  const config: ServiceWorkerPluginOptions = {
    serviceWorker: {
      enabled: true,
      swPath: '/metamon-sw.js',
      scope: '/',
      generateSW: true,
      ...options.serviceWorker
    },
    bundleSplitting: {
      ...defaultFrameworkBundleConfig,
      ...options.bundleSplitting
    },
    development: {
      enableInDev: false,
      mockServiceWorker: false,
      logLevel: 'info',
      ...options.development
    },
    build: {
      generateManifest: true,
      manifestPath: '/metamon-manifest.json',
      outputDir: 'dist',
      enableCompression: false,
      ...options.build
    }
  };

  let viteConfig: ResolvedConfig;
  let bundleSplitter: FrameworkBundleSplitter;
  let isDevelopment = false;

  return {
    name: 'metamon-service-worker',
    
    configResolved(resolvedConfig) {
      viteConfig = resolvedConfig;
      isDevelopment = resolvedConfig.command === 'serve';
      
      // Initialize bundle splitter
      bundleSplitter = new FrameworkBundleSplitter(config.bundleSplitting as FrameworkBundleConfig);
      
      log('info', 'Service worker plugin initialized', {
        isDevelopment,
        enabled: config.serviceWorker.enabled,
        generateSW: config.serviceWorker.generateSW
      });
    },

    configureServer(server) {
      if (!isDevelopment || !config.development.enableInDev) {
        return;
      }

      // Serve service worker in development
      server.middlewares.use(config.serviceWorker.swPath, (req, res, next) => {
        if (config.development.mockServiceWorker) {
          // Serve mock service worker for development
          res.setHeader('Content-Type', 'application/javascript');
          res.setHeader('Service-Worker-Allowed', '/');
          res.end(generateMockServiceWorker());
        } else {
          next();
        }
      });

      // Serve manifest in development
      server.middlewares.use(config.build.manifestPath, (req, res, next) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(generateDevelopmentManifest(), null, 2));
      });

      log('info', 'Development service worker middleware configured');
    },

    async generateBundle(options, bundle) {
      if (!config.serviceWorker.enabled || isDevelopment) {
        return;
      }

      try {
        log('info', 'Analyzing bundle for framework splitting...');
        
        // Analyze and split framework bundles
        const splitResult = await bundleSplitter.analyzeBundles(bundle);
        
        log('info', 'Bundle analysis complete', {
          originalSize: Math.floor(splitResult.stats.originalSize / 1024) + 'KB',
          optimizedSize: Math.floor(splitResult.stats.optimizedSize / 1024) + 'KB',
          compressionRatio: (splitResult.stats.compressionRatio * 100).toFixed(1) + '%',
          chunkCount: splitResult.stats.chunkCount,
          sharedChunks: splitResult.stats.sharedChunks
        });

        // Generate service worker if enabled
        if (config.serviceWorker.generateSW) {
          const swContent = await generateServiceWorker(splitResult.manifest);
          
          // Add service worker to bundle
          this.emitFile({
            type: 'asset',
            fileName: config.serviceWorker.swPath.replace(/^\//, ''),
            source: swContent
          });
          
          log('info', 'Service worker generated');
        }

        // Generate manifest if enabled
        if (config.build.generateManifest) {
          const manifestContent = JSON.stringify(splitResult.manifest, null, 2);
          
          // Add manifest to bundle
          this.emitFile({
            type: 'asset',
            fileName: config.build.manifestPath.replace(/^\//, ''),
            source: manifestContent
          });
          
          log('info', 'Framework manifest generated');
        }

        // Generate client-side loader
        const loaderContent = generateFrameworkLoader(splitResult.manifest);
        this.emitFile({
          type: 'asset',
          fileName: 'metamon-loader.js',
          source: loaderContent
        });

        log('info', 'Framework loader generated');

      } catch (error) {
        log('error', 'Error during service worker generation:', error);
        throw error;
      }
    },

    writeBundle(options, bundle) {
      if (!config.serviceWorker.enabled || isDevelopment) {
        return;
      }

      // Write additional files if needed
      const outputDir = options.dir || config.build.outputDir;
      
      // Ensure output directory exists
      if (!existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true });
      }

      log('info', 'Service worker bundle written to:', outputDir);
    }
  };

  /**
   * Log messages based on configured log level
   */
  function log(level: 'error' | 'warn' | 'info' | 'debug', message: string, data?: any): void {
    const levels = { error: 0, warn: 1, info: 2, debug: 3 };
    const configLevel = levels[config.development.logLevel];
    const messageLevel = levels[level];

    if (messageLevel <= configLevel) {
      const prefix = `[Metamon SW]`;
      if (data) {
        console[level](`${prefix} ${message}`, data);
      } else {
        console[level](`${prefix} ${message}`);
      }
    }
  }
}

/**
 * Generate service worker content
 */
async function generateServiceWorker(manifest: FrameworkManifest): Promise<string> {
  // Read the service worker template
  const swTemplate = `
// Metamon Service Worker - Generated at ${new Date().toISOString()}
const CACHE_NAME = 'metamon-frameworks-v${manifest.version}';
const MANIFEST_VERSION = '${manifest.version}';
const FRAMEWORK_MANIFEST = ${JSON.stringify(manifest, null, 2)};

${getServiceWorkerCore()}
`;

  return swTemplate;
}

/**
 * Get core service worker functionality
 */
function getServiceWorkerCore(): string {
  // This would include the core service worker code from metamon-service-worker.ts
  // For now, we'll include a simplified version
  return `
// Service Worker Core Implementation
self.addEventListener('install', (event) => {
  console.log('[Metamon SW] Installing version:', MANIFEST_VERSION);
  event.waitUntil(
    caches.open(CACHE_NAME).then(() => {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', (event) => {
  console.log('[Metamon SW] Activating version:', MANIFEST_VERSION);
  event.waitUntil(
    Promise.all([
      cleanupOldCaches(),
      self.clients.claim()
    ])
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  if (url.pathname.includes('/metamon-framework/')) {
    event.respondWith(handleFrameworkRequest(event.request));
  }
});

async function handleFrameworkRequest(request) {
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/');
  const frameworkName = pathParts[pathParts.indexOf('metamon-framework') + 1];
  
  try {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.error('[Metamon SW] Framework request failed:', error);
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
 * Generate framework loader for client-side
 */
function generateFrameworkLoader(manifest: FrameworkManifest): string {
  return `
// Metamon Framework Loader - Generated at ${new Date().toISOString()}
(function() {
  'use strict';
  
  const MANIFEST = ${JSON.stringify(manifest, null, 2)};
  const loadedFrameworks = new Set();
  const loadingPromises = new Map();
  
  // Framework loader class
  class MetamonFrameworkLoader {
    constructor() {
      this.serviceWorkerReady = this.initServiceWorker();
    }
    
    async initServiceWorker() {
      if ('serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.register('/metamon-sw.js');
          console.log('[Metamon] Service worker registered');
          return registration;
        } catch (error) {
          console.warn('[Metamon] Service worker registration failed:', error);
          return null;
        }
      }
      return null;
    }
    
    async loadFramework(frameworkName, priority = 'normal') {
      if (loadedFrameworks.has(frameworkName)) {
        return Promise.resolve();
      }
      
      if (loadingPromises.has(frameworkName)) {
        return loadingPromises.get(frameworkName);
      }
      
      const loadPromise = this._loadFrameworkChunks(frameworkName, priority);
      loadingPromises.set(frameworkName, loadPromise);
      
      try {
        await loadPromise;
        loadedFrameworks.add(frameworkName);
        loadingPromises.delete(frameworkName);
      } catch (error) {
        loadingPromises.delete(frameworkName);
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
      return loadedFrameworks.has(frameworkName);
    }
    
    getLoadedFrameworks() {
      return Array.from(loadedFrameworks);
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
});
`;
}

/**
 * Generate development manifest
 */
function generateDevelopmentManifest(): FrameworkManifest {
  return {
    version: 'dev-' + Date.now(),
    timestamp: Date.now(),
    frameworks: {
      reactjs: {
        chunks: ['react-dev'],
        dependencies: ['react', 'react-dom'],
        size: 1000,
        priority: 'high',
        preload: true
      },
      vue: {
        chunks: ['vue-dev'],
        dependencies: ['vue'],
        size: 800,
        priority: 'high',
        preload: true
      }
    },
    chunks: {
      'react-dev': {
        path: '/node_modules/react/index.js',
        size: 500,
        hash: 'dev-hash',
        dependencies: ['react'],
        type: 'core'
      },
      'vue-dev': {
        path: '/node_modules/vue/dist/vue.esm-browser.js',
        size: 400,
        hash: 'dev-hash',
        dependencies: ['vue'],
        type: 'core'
      }
    },
    cacheStrategy: {
      'react-dev': {
        maxAge: 0,
        strategy: 'network-first'
      },
      'vue-dev': {
        maxAge: 0,
        strategy: 'network-first'
      }
    }
  };
}

/**
 * Default service worker plugin options
 */
export const defaultServiceWorkerPluginOptions: ServiceWorkerPluginOptions = {
  serviceWorker: {
    enabled: true,
    swPath: '/metamon-sw.js',
    scope: '/',
    generateSW: true
  },
  bundleSplitting: defaultFrameworkBundleConfig,
  development: {
    enableInDev: false,
    mockServiceWorker: true,
    logLevel: 'info'
  },
  build: {
    generateManifest: true,
    manifestPath: '/metamon-manifest.json',
    outputDir: 'dist',
    enableCompression: false
  }
};