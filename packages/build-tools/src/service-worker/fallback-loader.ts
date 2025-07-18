/**
 * Fallback Framework Loader
 * 
 * Provides framework loading functionality when service workers are not available
 */

export interface FallbackLoaderConfig {
  // Loading configuration
  maxConcurrentLoads: number;
  loadTimeout: number;
  retryAttempts: number;
  retryDelay: number;
  
  // Caching configuration
  enableMemoryCache: boolean;
  maxCacheSize: number;
  cacheExpiration: number;
  
  // Network configuration
  enableNetworkDetection: boolean;
  slowNetworkThreshold: number;
  
  // Error handling
  enableGracefulDegradation: boolean;
  fallbackStrategy: 'minimal' | 'cached' | 'direct';
  
  // Logging
  enableLogging: boolean;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
}

export interface FrameworkLoadRequest {
  name: string;
  version?: string;
  priority: 'critical' | 'high' | 'normal' | 'low';
  timeout?: number;
  retries?: number;
}

export interface FrameworkLoadResult {
  success: boolean;
  framework: string;
  version: string;
  loadTime: number;
  fromCache: boolean;
  error?: Error;
}

export interface CachedFramework {
  name: string;
  version: string;
  content: string;
  size: number;
  timestamp: number;
  accessCount: number;
  lastAccessed: number;
}

/**
 * Fallback framework loader for environments without service worker support
 */
export class FallbackFrameworkLoader {
  private config: FallbackLoaderConfig;
  private cache: Map<string, CachedFramework> = new Map();
  private loadingQueue: Map<string, Promise<FrameworkLoadResult>> = new Map();
  private loadedFrameworks: Set<string> = new Set();
  private networkInfo: { isSlowNetwork: boolean; effectiveType: string } = {
    isSlowNetwork: false,
    effectiveType: '4g'
  };

  constructor(config: Partial<FallbackLoaderConfig> = {}) {
    this.config = {
      maxConcurrentLoads: 3,
      loadTimeout: 10000,
      retryAttempts: 3,
      retryDelay: 1000,
      enableMemoryCache: true,
      maxCacheSize: 10 * 1024 * 1024, // 10MB
      cacheExpiration: 30 * 60 * 1000, // 30 minutes
      enableNetworkDetection: true,
      slowNetworkThreshold: 1000, // 1 second
      enableGracefulDegradation: true,
      fallbackStrategy: 'cached',
      enableLogging: true,
      logLevel: 'info',
      ...config
    };

    this.initializeNetworkDetection();
    this.setupCacheCleanup();
  }

  /**
   * Load a framework with fallback strategies
   */
  async loadFramework(request: FrameworkLoadRequest): Promise<FrameworkLoadResult> {
    const cacheKey = `${request.name}@${request.version || 'latest'}`;
    
    // Check if already loaded
    if (this.loadedFrameworks.has(cacheKey)) {
      return {
        success: true,
        framework: request.name,
        version: request.version || 'latest',
        loadTime: 0,
        fromCache: true
      };
    }

    // Check if already loading
    if (this.loadingQueue.has(cacheKey)) {
      return await this.loadingQueue.get(cacheKey)!;
    }

    // Start loading process
    const loadPromise = this.performFrameworkLoad(request);
    this.loadingQueue.set(cacheKey, loadPromise);

    try {
      const result = await loadPromise;
      if (result.success) {
        this.loadedFrameworks.add(cacheKey);
      }
      return result;
    } finally {
      this.loadingQueue.delete(cacheKey);
    }
  }

  /**
   * Perform the actual framework loading
   */
  private async performFrameworkLoad(request: FrameworkLoadRequest): Promise<FrameworkLoadResult> {
    const startTime = Date.now();
    const cacheKey = `${request.name}@${request.version || 'latest'}`;

    try {
      // Try cache first if enabled
      if (this.config.enableMemoryCache) {
        const cached = this.getCachedFramework(cacheKey);
        if (cached && !this.isCacheExpired(cached)) {
          this.log('debug', `Loading ${request.name} from memory cache`);
          await this.injectFrameworkScript(cached.content);
          
          // Update cache statistics
          cached.accessCount++;
          cached.lastAccessed = Date.now();
          
          return {
            success: true,
            framework: request.name,
            version: cached.version,
            loadTime: Date.now() - startTime,
            fromCache: true
          };
        }
      }

      // Load from network with retries
      const content = await this.loadFromNetwork(request);
      
      // Cache the loaded content
      if (this.config.enableMemoryCache && content) {
        this.cacheFramework({
          name: request.name,
          version: request.version || 'latest',
          content,
          size: content.length,
          timestamp: Date.now(),
          accessCount: 1,
          lastAccessed: Date.now()
        });
      }

      // Inject the framework script
      if (content) {
        await this.injectFrameworkScript(content);
      }

      return {
        success: true,
        framework: request.name,
        version: request.version || 'latest',
        loadTime: Date.now() - startTime,
        fromCache: false
      };

    } catch (error) {
      this.log('error', `Failed to load framework ${request.name}:`, error);

      // Try fallback strategies
      if (this.config.enableGracefulDegradation) {
        const fallbackResult = await this.tryFallbackStrategies(request, error as Error);
        if (fallbackResult) {
          return fallbackResult;
        }
      }

      return {
        success: false,
        framework: request.name,
        version: request.version || 'latest',
        loadTime: Date.now() - startTime,
        fromCache: false,
        error: error as Error
      };
    }
  }

  /**
   * Load framework from network with retries
   */
  private async loadFromNetwork(request: FrameworkLoadRequest): Promise<string> {
    const maxRetries = request.retries ?? this.config.retryAttempts;
    const timeout = request.timeout ?? this.config.loadTimeout;
    
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        this.log('debug', `Loading ${request.name} from network (attempt ${attempt + 1}/${maxRetries + 1})`);
        
        const url = this.buildFrameworkUrl(request);
        const content = await this.fetchWithTimeout(url, timeout);
        
        this.log('info', `Successfully loaded ${request.name} from network`);
        return content;
        
      } catch (error) {
        lastError = error as Error;
        this.log('warn', `Network load attempt ${attempt + 1} failed for ${request.name}:`, error);
        
        if (attempt < maxRetries) {
          // Wait before retrying, with exponential backoff
          const delay = this.config.retryDelay * Math.pow(2, attempt);
          await this.sleep(delay);
        }
      }
    }

    throw lastError || new Error(`Failed to load ${request.name} after ${maxRetries + 1} attempts`);
  }

  /**
   * Build framework URL
   */
  private buildFrameworkUrl(request: FrameworkLoadRequest): string {
    const baseUrl = '/metamon-framework';
    const version = request.version || 'latest';
    return `${baseUrl}/${request.name}?version=${version}&priority=${request.priority}`;
  }

  /**
   * Fetch with timeout
   */
  private async fetchWithTimeout(url: string, timeout: number): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        cache: 'no-cache' // Force fresh fetch for fallback
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.text();
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Inject framework script into the page
   */
  private async injectFrameworkScript(content: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Create script element
        const script = document.createElement('script');
        script.type = 'text/javascript';
        script.textContent = content;
        
        // Add load handlers
        script.onload = () => resolve();
        script.onerror = (error) => reject(new Error('Script injection failed'));
        
        // Inject into document
        document.head.appendChild(script);
        
        // For inline scripts, onload might not fire, so resolve immediately
        setTimeout(resolve, 0);
        
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Try fallback strategies when primary loading fails
   */
  private async tryFallbackStrategies(request: FrameworkLoadRequest, error: Error): Promise<FrameworkLoadResult | null> {
    const startTime = Date.now();

    switch (this.config.fallbackStrategy) {
      case 'cached':
        return await this.tryLoadFromExpiredCache(request, startTime);
        
      case 'minimal':
        return await this.tryLoadMinimalFallback(request, startTime);
        
      case 'direct':
        return await this.tryDirectLoad(request, startTime);
        
      default:
        return null;
    }
  }

  /**
   * Try loading from expired cache as fallback
   */
  private async tryLoadFromExpiredCache(request: FrameworkLoadRequest, startTime: number): Promise<FrameworkLoadResult | null> {
    const cacheKey = `${request.name}@${request.version || 'latest'}`;
    const cached = this.getCachedFramework(cacheKey);
    
    if (cached) {
      this.log('warn', `Using expired cache for ${request.name} as fallback`);
      
      try {
        await this.injectFrameworkScript(cached.content);
        return {
          success: true,
          framework: request.name,
          version: cached.version,
          loadTime: Date.now() - startTime,
          fromCache: true
        };
      } catch (error) {
        this.log('error', `Failed to inject cached framework ${request.name}:`, error);
      }
    }
    
    return null;
  }

  /**
   * Try loading minimal fallback
   */
  private async tryLoadMinimalFallback(request: FrameworkLoadRequest, startTime: number): Promise<FrameworkLoadResult | null> {
    this.log('warn', `Loading minimal fallback for ${request.name}`);
    
    try {
      const minimalContent = this.generateMinimalFallback(request.name);
      await this.injectFrameworkScript(minimalContent);
      
      return {
        success: true,
        framework: request.name,
        version: 'minimal-fallback',
        loadTime: Date.now() - startTime,
        fromCache: false
      };
    } catch (error) {
      this.log('error', `Failed to load minimal fallback for ${request.name}:`, error);
      return null;
    }
  }

  /**
   * Try direct load from CDN or alternative source
   */
  private async tryDirectLoad(request: FrameworkLoadRequest, startTime: number): Promise<FrameworkLoadResult | null> {
    const cdnUrl = this.getCdnUrl(request.name, request.version);
    if (!cdnUrl) return null;

    this.log('warn', `Trying direct CDN load for ${request.name}`);
    
    try {
      const content = await this.fetchWithTimeout(cdnUrl, this.config.loadTimeout);
      await this.injectFrameworkScript(content);
      
      return {
        success: true,
        framework: request.name,
        version: request.version || 'latest',
        loadTime: Date.now() - startTime,
        fromCache: false
      };
    } catch (error) {
      this.log('error', `Failed to load from CDN for ${request.name}:`, error);
      return null;
    }
  }

  /**
   * Generate minimal fallback content
   */
  private generateMinimalFallback(frameworkName: string): string {
    const fallbacks = {
      reactjs: `
        window.React = window.React || {
          createElement: function() { return { type: 'div', props: {}, children: [] }; },
          Component: function() {},
          Fragment: function() {}
        };
        window.ReactDOM = window.ReactDOM || {
          render: function() { console.warn('React fallback: render not implemented'); }
        };
      `,
      vue: `
        window.Vue = window.Vue || {
          createApp: function() { 
            return { 
              mount: function() { console.warn('Vue fallback: mount not implemented'); }
            }; 
          }
        };
      `,
      solid: `
        window.SolidJS = window.SolidJS || {
          createSignal: function() { return [function() {}, function() {}]; },
          createEffect: function() {}
        };
      `,
      svelte: `
        window.Svelte = window.Svelte || {
          SvelteComponent: function() {}
        };
      `
    };

    return fallbacks[frameworkName as keyof typeof fallbacks] || 
           `console.warn('No fallback available for framework: ${frameworkName}');`;
  }

  /**
   * Get CDN URL for framework
   */
  private getCdnUrl(frameworkName: string, version?: string): string | null {
    const cdnUrls = {
      reactjs: `https://unpkg.com/react@${version || 'latest'}/umd/react.production.min.js`,
      vue: `https://unpkg.com/vue@${version || 'latest'}/dist/vue.global.prod.js`,
      solid: `https://unpkg.com/solid-js@${version || 'latest'}/dist/solid.js`,
      svelte: null // Svelte doesn't have a simple CDN build
    };

    return cdnUrls[frameworkName as keyof typeof cdnUrls] || null;
  }

  /**
   * Cache framework content
   */
  private cacheFramework(framework: CachedFramework): void {
    // Check cache size limit
    if (this.getCurrentCacheSize() + framework.size > this.config.maxCacheSize) {
      this.evictLeastRecentlyUsed();
    }

    const cacheKey = `${framework.name}@${framework.version}`;
    this.cache.set(cacheKey, framework);
    
    this.log('debug', `Cached framework: ${cacheKey} (${Math.floor(framework.size / 1024)}KB)`);
  }

  /**
   * Get cached framework
   */
  private getCachedFramework(cacheKey: string): CachedFramework | null {
    return this.cache.get(cacheKey) || null;
  }

  /**
   * Check if cache entry is expired
   */
  private isCacheExpired(cached: CachedFramework): boolean {
    return Date.now() - cached.timestamp > this.config.cacheExpiration;
  }

  /**
   * Get current cache size
   */
  private getCurrentCacheSize(): number {
    let totalSize = 0;
    for (const cached of this.cache.values()) {
      totalSize += cached.size;
    }
    return totalSize;
  }

  /**
   * Evict least recently used cache entries
   */
  private evictLeastRecentlyUsed(): void {
    const entries = Array.from(this.cache.entries());
    entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
    
    // Remove oldest 25% of entries
    const toRemove = Math.ceil(entries.length * 0.25);
    for (let i = 0; i < toRemove; i++) {
      this.cache.delete(entries[i][0]);
    }
    
    this.log('debug', `Evicted ${toRemove} cache entries`);
  }

  /**
   * Initialize network detection
   */
  private initializeNetworkDetection(): void {
    if (!this.config.enableNetworkDetection) return;

    // Use Network Information API if available
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      this.networkInfo.effectiveType = connection.effectiveType || '4g';
      this.networkInfo.isSlowNetwork = ['slow-2g', '2g', '3g'].includes(connection.effectiveType);
      
      connection.addEventListener('change', () => {
        this.networkInfo.effectiveType = connection.effectiveType || '4g';
        this.networkInfo.isSlowNetwork = ['slow-2g', '2g', '3g'].includes(connection.effectiveType);
        this.log('debug', 'Network conditions changed:', this.networkInfo);
      });
    }
  }

  /**
   * Setup cache cleanup interval
   */
  private setupCacheCleanup(): void {
    // Clean up expired cache entries every 5 minutes
    setInterval(() => {
      const now = Date.now();
      const expiredKeys: string[] = [];
      
      for (const [key, cached] of this.cache.entries()) {
        if (now - cached.timestamp > this.config.cacheExpiration) {
          expiredKeys.push(key);
        }
      }
      
      expiredKeys.forEach(key => this.cache.delete(key));
      
      if (expiredKeys.length > 0) {
        this.log('debug', `Cleaned up ${expiredKeys.length} expired cache entries`);
      }
    }, 5 * 60 * 1000);
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Log messages based on configuration
   */
  private log(level: 'error' | 'warn' | 'info' | 'debug', message: string, data?: any): void {
    if (!this.config.enableLogging) return;

    const levels = { error: 0, warn: 1, info: 2, debug: 3 };
    const configLevel = levels[this.config.logLevel];
    const messageLevel = levels[level];

    if (messageLevel <= configLevel) {
      const prefix = '[Metamon Fallback]';
      if (data) {
        console[level](`${prefix} ${message}`, data);
      } else {
        console[level](`${prefix} ${message}`);
      }
    }
  }

  /**
   * Get loader statistics
   */
  getStats(): {
    loadedFrameworks: string[];
    cacheSize: number;
    cacheEntries: number;
    networkInfo: typeof this.networkInfo;
  } {
    return {
      loadedFrameworks: Array.from(this.loadedFrameworks),
      cacheSize: this.getCurrentCacheSize(),
      cacheEntries: this.cache.size,
      networkInfo: { ...this.networkInfo }
    };
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.cache.clear();
    this.log('info', 'Cache cleared');
  }

  /**
   * Check if framework is loaded
   */
  isFrameworkLoaded(name: string, version?: string): boolean {
    const cacheKey = `${name}@${version || 'latest'}`;
    return this.loadedFrameworks.has(cacheKey);
  }
}

/**
 * Default fallback loader configuration
 */
export const defaultFallbackLoaderConfig: FallbackLoaderConfig = {
  maxConcurrentLoads: 3,
  loadTimeout: 10000,
  retryAttempts: 3,
  retryDelay: 1000,
  enableMemoryCache: true,
  maxCacheSize: 10 * 1024 * 1024,
  cacheExpiration: 30 * 60 * 1000,
  enableNetworkDetection: true,
  slowNetworkThreshold: 1000,
  enableGracefulDegradation: true,
  fallbackStrategy: 'cached',
  enableLogging: true,
  logLevel: 'info'
};