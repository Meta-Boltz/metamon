/**
 * Metamon Service Worker for Framework Loading Optimization
 * 
 * This service worker handles:
 * - Framework bundle caching and delivery
 * - Background task execution
 * - Cache management and invalidation
 */

import { ServiceWorkerFrameworkManager } from './service-worker-framework-manager.js';
import type { FrameworkRequest, BackgroundTask } from './service-worker-framework-manager.js';

// Service worker types
declare const self: ServiceWorkerGlobalScope;

// Initialize the ServiceWorkerFrameworkManager
const frameworkManager = new ServiceWorkerFrameworkManager('metamon-frameworks-v2', {
  maxSize: 100 * 1024 * 1024, // 100MB
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  evictionPolicy: 'priority-based',
  compressionEnabled: true,
  preloadThreshold: 0.8
});

// Initialize the manager
frameworkManager.initialize().catch(error => {
  console.error('[Metamon SW] Failed to initialize framework manager:', error);
});

/**
 * Service Worker Installation
 */
self.addEventListener('install', (event) => {
  console.log('[Metamon SW] Installing service worker with framework manager');
  
  event.waitUntil(
    frameworkManager.initialize().then(() => {
      console.log('[Metamon SW] Framework manager initialized');
      // Skip waiting to activate immediately
      return self.skipWaiting();
    })
  );
});

/**
 * Service Worker Activation
 */
self.addEventListener('activate', (event) => {
  console.log('[Metamon SW] Activating service worker');
  
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      cleanupOldCaches(),
      // Claim all clients
      self.clients.claim()
    ]).then(() => {
      console.log('[Metamon SW] Service worker activated');
    })
  );
});

/**
 * Handle fetch requests
 */
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Handle framework requests
  if (url.pathname.includes('/metamon-framework/')) {
    event.respondWith(handleFrameworkRequest(event.request));
    return;
  }
  
  // Let other requests pass through
});

/**
 * Handle messages from main thread
 */
self.addEventListener('message', (event) => {
  const { type, payload, id } = event.data;
  
  if (type === 'INIT_PORT') {
    frameworkManager.setMessagePort(event.ports[0]);
    console.log('[Metamon SW] Message port initialized');
    return;
  }
  
  // Handle other message types
  handleMessage(type, payload, id);
});

/**
 * Handle framework fetch requests using the framework manager
 */
async function handleFrameworkRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/');
  const frameworkName = pathParts[pathParts.indexOf('metamon-framework') + 1] as any;
  const version = url.searchParams.get('version') || 'latest';
  const priority = (url.searchParams.get('priority') || 'normal') as any;
  const clientId = request.headers.get('X-Metamon-Client-Id') || 'unknown';
  
  const frameworkRequest: FrameworkRequest = {
    framework: frameworkName,
    version: version,
    priority: priority,
    clientId: clientId,
    timestamp: Date.now()
  };
  
  return await frameworkManager.handleFrameworkRequest(frameworkRequest);
}

/**
 * Handle messages from main thread using the framework manager
 */
async function handleMessage(type: string, payload: any, id: string): Promise<void> {
  try {
    let response: any = {};
    
    switch (type) {
      case 'CACHE_FRAMEWORK':
        await frameworkManager.cacheFrameworkWithStrategy(payload);
        response = { success: true };
        break;
        
      case 'GET_CACHED_FRAMEWORK':
        const framework = await frameworkManager.getCachedFramework(payload.name, payload.version);
        response = { framework };
        break;
        
      case 'INVALIDATE_CACHE':
        await frameworkManager.invalidateCache(payload.name || '*');
        response = { success: true };
        break;
        
      case 'GET_CACHE_STATS':
        const stats = frameworkManager.getMetrics();
        response = { stats };
        break;
        
      case 'BACKGROUND_TASK':
        const backgroundTask: BackgroundTask = {
          type: payload.type,
          payload: payload.payload,
          timeout: payload.timeout || 5000,
          priority: payload.priority || 'normal',
          id: payload.id || `task_${Date.now()}`
        };
        const result = await frameworkManager.executeInBackground(backgroundTask);
        response = { result };
        break;
        
      case 'UPDATE_FRAMEWORK_CACHE':
        await frameworkManager.updateFrameworkCache(payload.updates);
        response = { success: true };
        break;
        
      default:
        throw new Error(`Unknown message type: ${type}`);
    }
    
    // Send response back to main thread via framework manager's message port
    // The framework manager handles the message port communication
    
  } catch (error) {
    console.error(`[Metamon SW] Error handling message ${type}:`, error);
    // Error handling is managed by the framework manager
  }
}



/**
 * Clean up old caches
 */
async function cleanupOldCaches(): Promise<void> {
  const cacheNames = await caches.keys();
  const oldCaches = cacheNames.filter(name => 
    name.startsWith('metamon-frameworks-') && name !== 'metamon-frameworks-v2'
  );
  
  await Promise.all(oldCaches.map(name => caches.delete(name)));
  
  if (oldCaches.length > 0) {
    console.log(`[Metamon SW] Cleaned up ${oldCaches.length} old caches`);
  }
}