/**
 * Service Worker Manager for Metamon Framework Loading
 * 
 * Manages service worker registration, lifecycle, and framework caching
 */

export interface ServiceWorkerConfig {
  // Service worker file configuration
  swPath: string;
  scope: string;
  
  // Framework loading configuration
  frameworkCachePrefix: string;
  maxCacheAge: number;
  
  // Fallback configuration
  enableFallback: boolean;
  fallbackTimeout: number;
  
  // Development configuration
  isDevelopment: boolean;
  enableLogging: boolean;
}

export interface FrameworkCacheEntry {
  name: string;
  version: string;
  bundle: ArrayBuffer;
  dependencies: string[];
  size: number;
  timestamp: number;
  checksum: string;
}

export interface ServiceWorkerStatus {
  isSupported: boolean;
  isRegistered: boolean;
  isActive: boolean;
  registration: ServiceWorkerRegistration | null;
  error: Error | null;
}

/**
 * Service Worker Manager for framework loading optimization
 */
export class ServiceWorkerManager {
  private config: ServiceWorkerConfig;
  private registration: ServiceWorkerRegistration | null = null;
  private status: ServiceWorkerStatus;
  private messageChannel: MessageChannel | null = null;
  private pendingMessages: Map<string, { resolve: Function; reject: Function; timeout: NodeJS.Timeout }> = new Map();

  constructor(config: ServiceWorkerConfig) {
    this.config = config;
    this.status = {
      isSupported: 'serviceWorker' in navigator,
      isRegistered: false,
      isActive: false,
      registration: null,
      error: null
    };
  }

  /**
   * Initialize service worker registration
   */
  async initialize(): Promise<ServiceWorkerStatus> {
    if (!this.status.isSupported) {
      const error = new Error('Service Workers are not supported in this browser');
      this.status.error = error;
      this.log('Service Workers not supported, falling back to direct loading');
      return this.status;
    }

    try {
      // Register service worker
      this.registration = await navigator.serviceWorker.register(this.config.swPath, {
        scope: this.config.scope
      });

      this.status.registration = this.registration;
      this.status.isRegistered = true;

      // Set up message channel for communication
      this.setupMessageChannel();

      // Wait for service worker to be active
      await this.waitForServiceWorkerActive();

      this.status.isActive = true;
      this.log('Service Worker registered and active');

      // Set up update handling
      this.setupUpdateHandling();

      return this.status;
    } catch (error) {
      this.status.error = error as Error;
      this.log('Service Worker registration failed:', error);
      return this.status;
    }
  }

  /**
   * Check if service worker is ready for framework loading
   */
  isReady(): boolean {
    return this.status.isSupported && this.status.isRegistered && this.status.isActive;
  }

  /**
   * Cache a framework bundle in the service worker
   */
  async cacheFramework(framework: FrameworkCacheEntry): Promise<void> {
    if (!this.isReady()) {
      throw new Error('Service Worker not ready for caching');
    }

    const message = {
      type: 'CACHE_FRAMEWORK',
      payload: {
        name: framework.name,
        version: framework.version,
        bundle: framework.bundle,
        dependencies: framework.dependencies,
        size: framework.size,
        timestamp: framework.timestamp,
        checksum: framework.checksum
      }
    };

    await this.sendMessage(message);
    this.log(`Cached framework: ${framework.name}@${framework.version} (${Math.floor(framework.size / 1024)}KB)`);
  }

  /**
   * Get cached framework from service worker
   */
  async getCachedFramework(name: string, version?: string): Promise<FrameworkCacheEntry | null> {
    if (!this.isReady()) {
      return null;
    }

    const message = {
      type: 'GET_CACHED_FRAMEWORK',
      payload: { name, version }
    };

    try {
      const response = await this.sendMessage(message);
      return response.framework || null;
    } catch (error) {
      this.log(`Failed to get cached framework ${name}:`, error);
      return null;
    }
  }

  /**
   * Invalidate framework cache
   */
  async invalidateFrameworkCache(name?: string): Promise<void> {
    if (!this.isReady()) {
      return;
    }

    const message = {
      type: 'INVALIDATE_CACHE',
      payload: { name }
    };

    await this.sendMessage(message);
    this.log(`Invalidated cache${name ? ` for ${name}` : ''}`);
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    totalSize: number;
    entryCount: number;
    frameworks: Array<{ name: string; version: string; size: number; timestamp: number }>;
  }> {
    if (!this.isReady()) {
      return { totalSize: 0, entryCount: 0, frameworks: [] };
    }

    const message = { type: 'GET_CACHE_STATS' };
    const response = await this.sendMessage(message);
    return response.stats;
  }

  /**
   * Execute background task in service worker
   */
  async executeBackgroundTask(task: {
    type: string;
    payload: any;
    timeout?: number;
  }): Promise<any> {
    if (!this.isReady()) {
      throw new Error('Service Worker not ready for background tasks');
    }

    const message = {
      type: 'BACKGROUND_TASK',
      payload: task
    };

    return await this.sendMessage(message, task.timeout);
  }

  /**
   * Set up message channel for service worker communication
   */
  private setupMessageChannel(): void {
    this.messageChannel = new MessageChannel();
    
    // Listen for messages from service worker
    this.messageChannel.port1.onmessage = (event) => {
      const { id, type, payload, error } = event.data;
      
      if (id && this.pendingMessages.has(id)) {
        const { resolve, reject, timeout } = this.pendingMessages.get(id)!;
        clearTimeout(timeout);
        this.pendingMessages.delete(id);
        
        if (error) {
          reject(new Error(error));
        } else {
          resolve(payload);
        }
      }
    };

    // Send port to service worker
    if (this.registration?.active) {
      this.registration.active.postMessage({
        type: 'INIT_PORT'
      }, [this.messageChannel.port2]);
    }
  }

  /**
   * Send message to service worker and wait for response
   */
  private async sendMessage(message: any, timeoutMs: number = 5000): Promise<any> {
    if (!this.messageChannel || !this.registration?.active) {
      throw new Error('Service Worker communication not available');
    }

    const id = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingMessages.delete(id);
        reject(new Error(`Service Worker message timeout: ${message.type}`));
      }, timeoutMs);

      this.pendingMessages.set(id, { resolve, reject, timeout });

      this.registration!.active!.postMessage({
        ...message,
        id
      });
    });
  }

  /**
   * Wait for service worker to become active
   */
  private async waitForServiceWorkerActive(): Promise<void> {
    if (!this.registration) {
      throw new Error('No service worker registration');
    }

    if (this.registration.active) {
      return;
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Service Worker activation timeout'));
      }, 10000);

      const checkState = () => {
        if (this.registration!.active) {
          clearTimeout(timeout);
          resolve();
        }
      };

      if (this.registration.installing) {
        this.registration.installing.addEventListener('statechange', checkState);
      } else if (this.registration.waiting) {
        this.registration.waiting.addEventListener('statechange', checkState);
      }
    });
  }

  /**
   * Set up service worker update handling
   */
  private setupUpdateHandling(): void {
    if (!this.registration) return;

    this.registration.addEventListener('updatefound', () => {
      const newWorker = this.registration!.installing;
      if (!newWorker) return;

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // New service worker is available
          this.log('New service worker available, will update on next page load');
          
          // Optionally notify the application about the update
          if (typeof window !== 'undefined' && window.dispatchEvent) {
            window.dispatchEvent(new CustomEvent('sw-update-available', {
              detail: { registration: this.registration }
            }));
          }
        }
      });
    });
  }

  /**
   * Update service worker to latest version
   */
  async update(): Promise<void> {
    if (!this.registration) {
      throw new Error('No service worker registration to update');
    }

    await this.registration.update();
    this.log('Service Worker update initiated');
  }

  /**
   * Unregister service worker
   */
  async unregister(): Promise<boolean> {
    if (!this.registration) {
      return false;
    }

    const result = await this.registration.unregister();
    if (result) {
      this.status.isRegistered = false;
      this.status.isActive = false;
      this.registration = null;
      this.log('Service Worker unregistered');
    }
    
    return result;
  }

  /**
   * Get current service worker status
   */
  getStatus(): ServiceWorkerStatus {
    return { ...this.status };
  }

  /**
   * Log messages if logging is enabled
   */
  private log(message: string, ...args: any[]): void {
    if (this.config.enableLogging) {
      console.log(`[ServiceWorkerManager] ${message}`, ...args);
    }
  }
}

/**
 * Default service worker configuration
 */
export const defaultServiceWorkerConfig: ServiceWorkerConfig = {
  swPath: '/metamon-sw.js',
  scope: '/',
  frameworkCachePrefix: 'metamon-framework-',
  maxCacheAge: 24 * 60 * 60 * 1000, // 24 hours
  enableFallback: true,
  fallbackTimeout: 5000,
  isDevelopment: process.env.NODE_ENV === 'development',
  enableLogging: process.env.NODE_ENV === 'development'
};

/**
 * Create service worker manager with default configuration
 */
export function createServiceWorkerManager(config?: Partial<ServiceWorkerConfig>): ServiceWorkerManager {
  const finalConfig = { ...defaultServiceWorkerConfig, ...config };
  return new ServiceWorkerManager(finalConfig);
}