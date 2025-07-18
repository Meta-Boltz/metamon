/**
 * Tests for Fallback Framework Loader
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { 
  FallbackFrameworkLoader, 
  FallbackLoaderConfig, 
  FrameworkLoadRequest 
} from '../service-worker/fallback-loader.js';

// Mock DOM APIs
const mockDocument = {
  createElement: vi.fn(),
  head: {
    appendChild: vi.fn()
  }
};

const mockFetch = vi.fn();

Object.defineProperty(global, 'document', {
  value: mockDocument,
  writable: true
});
global.fetch = mockFetch;

// Mock script element
const createMockScript = () => ({
  src: '',
  async: false,
  onload: null as any,
  onerror: null as any,
  setAttribute: vi.fn(),
  textContent: ''
});

describe('FallbackFrameworkLoader', () => {
  let loader: FallbackFrameworkLoader;
  let config: FallbackLoaderConfig;

  beforeEach(() => {
    config = {
      maxConcurrentLoads: 2,
      loadTimeout: 5000,
      retryAttempts: 2,
      retryDelay: 100,
      enableMemoryCache: true,
      maxCacheSize: 1024 * 1024,
      cacheExpiration: 60000,
      enableNetworkDetection: false,
      slowNetworkThreshold: 1000,
      enableGracefulDegradation: true,
      fallbackStrategy: 'cached',
      enableLogging: false,
      logLevel: 'error'
    };

    loader = new FallbackFrameworkLoader(config);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('framework loading', () => {
    it('should load framework successfully from network', async () => {
      const mockScript = createMockScript();
      mockDocument.createElement.mockReturnValue(mockScript);
      
      const mockResponse = {
        ok: true,
        text: vi.fn().mockResolvedValue('console.log("React loaded");')
      };
      mockFetch.mockResolvedValue(mockResponse);

      const request: FrameworkLoadRequest = {
        name: 'reactjs',
        priority: 'high'
      };

      // Simulate successful script loading
      setTimeout(() => {
        if (mockScript.onload) mockScript.onload();
      }, 0);

      const result = await loader.loadFramework(request);

      expect(result.success).toBe(true);
      expect(result.framework).toBe('reactjs');
      expect(result.fromCache).toBe(false);
      expect(mockFetch).toHaveBeenCalledWith(
        '/metamon-framework/reactjs?version=latest&priority=high',
        expect.any(Object)
      );
    });

    it('should load framework from cache when available', async () => {
      // First load to populate cache
      const mockScript1 = createMockScript();
      mockDocument.createElement.mockReturnValueOnce(mockScript1);
      
      const mockResponse = {
        ok: true,
        text: vi.fn().mockResolvedValue('console.log("Vue loaded");')
      };
      mockFetch.mockResolvedValue(mockResponse);

      const request: FrameworkLoadRequest = {
        name: 'vue',
        version: '3.0.0',
        priority: 'normal'
      };

      // First load
      setTimeout(() => {
        if (mockScript1.onload) mockScript1.onload();
      }, 0);

      await loader.loadFramework(request);

      // Second load should use cache
      const mockScript2 = createMockScript();
      mockDocument.createElement.mockReturnValueOnce(mockScript2);

      setTimeout(() => {
        if (mockScript2.onload) mockScript2.onload();
      }, 0);

      const result = await loader.loadFramework(request);

      expect(result.success).toBe(true);
      expect(result.fromCache).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1); // Only called once
    });

    it('should handle network failures with retries', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          text: vi.fn().mockResolvedValue('console.log("Solid loaded");')
        });

      const mockScript = createMockScript();
      mockDocument.createElement.mockReturnValue(mockScript);

      const request: FrameworkLoadRequest = {
        name: 'solid',
        priority: 'low'
      };

      setTimeout(() => {
        if (mockScript.onload) mockScript.onload();
      }, 0);

      const result = await loader.loadFramework(request);

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(3); // 2 retries + 1 success
    });

    it('should handle script injection failures', async () => {
      const mockScript = createMockScript();
      mockDocument.createElement.mockReturnValue(mockScript);
      
      const mockResponse = {
        ok: true,
        text: vi.fn().mockResolvedValue('invalid javascript syntax {')
      };
      mockFetch.mockResolvedValue(mockResponse);

      const request: FrameworkLoadRequest = {
        name: 'broken',
        priority: 'normal'
      };

      // Simulate script error
      setTimeout(() => {
        if (mockScript.onerror) mockScript.onerror(new Error('Script error'));
      }, 0);

      const result = await loader.loadFramework(request);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('caching', () => {
    it('should respect cache size limits', async () => {
      // Set very small cache size
      const smallCacheLoader = new FallbackFrameworkLoader({
        ...config,
        maxCacheSize: 100 // Very small
      });

      const mockScript = createMockScript();
      mockDocument.createElement.mockReturnValue(mockScript);
      
      const mockResponse = {
        ok: true,
        text: vi.fn().mockResolvedValue('a'.repeat(200)) // Larger than cache
      };
      mockFetch.mockResolvedValue(mockResponse);

      setTimeout(() => {
        if (mockScript.onload) mockScript.onload();
      }, 0);

      // Load multiple frameworks to exceed cache size
      await smallCacheLoader.loadFramework({ name: 'framework1', priority: 'normal' });
      
      const stats = smallCacheLoader.getStats();
      expect(stats.cacheSize).toBeLessThanOrEqual(100);
    });

    it('should handle cache expiration', async () => {
      // Set very short expiration
      const shortExpirationLoader = new FallbackFrameworkLoader({
        ...config,
        cacheExpiration: 1 // 1ms
      });

      const mockScript = createMockScript();
      mockDocument.createElement.mockReturnValue(mockScript);
      
      const mockResponse = {
        ok: true,
        text: vi.fn().mockResolvedValue('console.log("Expired framework");')
      };
      mockFetch.mockResolvedValue(mockResponse);

      const request: FrameworkLoadRequest = {
        name: 'expiring',
        priority: 'normal'
      };

      // First load
      setTimeout(() => {
        if (mockScript.onload) mockScript.onload();
      }, 0);

      await shortExpirationLoader.loadFramework(request);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 10));

      // Second load should fetch from network again
      setTimeout(() => {
        if (mockScript.onload) mockScript.onload();
      }, 0);

      const result = await shortExpirationLoader.loadFramework(request);

      expect(result.fromCache).toBe(false);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should clear cache when requested', () => {
      loader.clearCache();
      const stats = loader.getStats();
      expect(stats.cacheEntries).toBe(0);
      expect(stats.cacheSize).toBe(0);
    });
  });

  describe('fallback strategies', () => {
    it('should use cached fallback strategy', async () => {
      const cachedFallbackLoader = new FallbackFrameworkLoader({
        ...config,
        fallbackStrategy: 'cached'
      });

      // First, populate cache
      const mockScript1 = createMockScript();
      mockDocument.createElement.mockReturnValueOnce(mockScript1);
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: vi.fn().mockResolvedValue('console.log("Cached content");')
      });

      setTimeout(() => {
        if (mockScript1.onload) mockScript1.onload();
      }, 0);

      await cachedFallbackLoader.loadFramework({ name: 'cached-test', priority: 'normal' });

      // Now simulate network failure
      mockFetch.mockRejectedValue(new Error('Network down'));

      const mockScript2 = createMockScript();
      mockDocument.createElement.mockReturnValueOnce(mockScript2);

      setTimeout(() => {
        if (mockScript2.onload) mockScript2.onload();
      }, 0);

      // Should use cached version as fallback
      const result = await cachedFallbackLoader.loadFramework({ 
        name: 'cached-test', 
        version: 'different-version', // Different version to force network attempt
        priority: 'normal' 
      });

      expect(result.success).toBe(true);
      expect(result.fromCache).toBe(true);
    });

    it('should use minimal fallback strategy', async () => {
      const minimalFallbackLoader = new FallbackFrameworkLoader({
        ...config,
        fallbackStrategy: 'minimal'
      });

      mockFetch.mockRejectedValue(new Error('Network failure'));

      const mockScript = createMockScript();
      mockDocument.createElement.mockReturnValue(mockScript);

      setTimeout(() => {
        if (mockScript.onload) mockScript.onload();
      }, 0);

      const result = await minimalFallbackLoader.loadFramework({ 
        name: 'reactjs', 
        priority: 'normal' 
      });

      expect(result.success).toBe(true);
      expect(result.version).toBe('minimal-fallback');
      expect(mockScript.textContent).toContain('window.React');
    });

    it('should use direct CDN fallback strategy', async () => {
      const directFallbackLoader = new FallbackFrameworkLoader({
        ...config,
        fallbackStrategy: 'direct'
      });

      // First call fails (primary source)
      mockFetch
        .mockRejectedValueOnce(new Error('Primary source failed'))
        .mockResolvedValueOnce({
          ok: true,
          text: vi.fn().mockResolvedValue('console.log("CDN content");')
        });

      const mockScript = createMockScript();
      mockDocument.createElement.mockReturnValue(mockScript);

      setTimeout(() => {
        if (mockScript.onload) mockScript.onload();
      }, 0);

      const result = await directFallbackLoader.loadFramework({ 
        name: 'reactjs', 
        priority: 'normal' 
      });

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);
      // Second call should be to CDN
      expect(mockFetch).toHaveBeenLastCalledWith(
        expect.stringContaining('unpkg.com'),
        expect.any(Object)
      );
    });
  });

  describe('concurrent loading', () => {
    it('should handle concurrent requests for same framework', async () => {
      const mockScript = createMockScript();
      mockDocument.createElement.mockReturnValue(mockScript);
      
      const mockResponse = {
        ok: true,
        text: vi.fn().mockResolvedValue('console.log("Concurrent test");')
      };
      mockFetch.mockResolvedValue(mockResponse);

      const request: FrameworkLoadRequest = {
        name: 'concurrent-test',
        priority: 'normal'
      };

      setTimeout(() => {
        if (mockScript.onload) mockScript.onload();
      }, 0);

      // Start multiple concurrent requests
      const promises = [
        loader.loadFramework(request),
        loader.loadFramework(request),
        loader.loadFramework(request)
      ];

      const results = await Promise.all(promises);

      // All should succeed
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      // But only one network request should be made
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should respect concurrent load limits', async () => {
      const limitedLoader = new FallbackFrameworkLoader({
        ...config,
        maxConcurrentLoads: 1
      });

      const mockScript = createMockScript();
      mockDocument.createElement.mockReturnValue(mockScript);
      
      const mockResponse = {
        ok: true,
        text: vi.fn().mockResolvedValue('console.log("Limited concurrent");')
      };
      mockFetch.mockResolvedValue(mockResponse);

      setTimeout(() => {
        if (mockScript.onload) mockScript.onload();
      }, 100); // Delay to test concurrency

      // Start multiple requests for different frameworks
      const promises = [
        limitedLoader.loadFramework({ name: 'framework1', priority: 'normal' }),
        limitedLoader.loadFramework({ name: 'framework2', priority: 'normal' })
      ];

      const results = await Promise.all(promises);

      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    });
  });

  describe('utility methods', () => {
    it('should check if framework is loaded', async () => {
      expect(loader.isFrameworkLoaded('test-framework')).toBe(false);

      const mockScript = createMockScript();
      mockDocument.createElement.mockReturnValue(mockScript);
      
      const mockResponse = {
        ok: true,
        text: vi.fn().mockResolvedValue('console.log("Test framework");')
      };
      mockFetch.mockResolvedValue(mockResponse);

      setTimeout(() => {
        if (mockScript.onload) mockScript.onload();
      }, 0);

      await loader.loadFramework({ name: 'test-framework', priority: 'normal' });

      expect(loader.isFrameworkLoaded('test-framework')).toBe(true);
    });

    it('should provide accurate statistics', async () => {
      const initialStats = loader.getStats();
      expect(initialStats.loadedFrameworks).toHaveLength(0);
      expect(initialStats.cacheEntries).toBe(0);

      const mockScript = createMockScript();
      mockDocument.createElement.mockReturnValue(mockScript);
      
      const mockResponse = {
        ok: true,
        text: vi.fn().mockResolvedValue('console.log("Stats test");')
      };
      mockFetch.mockResolvedValue(mockResponse);

      setTimeout(() => {
        if (mockScript.onload) mockScript.onload();
      }, 0);

      await loader.loadFramework({ name: 'stats-test', priority: 'normal' });

      const finalStats = loader.getStats();
      expect(finalStats.loadedFrameworks).toContain('stats-test@latest');
      expect(finalStats.cacheEntries).toBe(1);
      expect(finalStats.cacheSize).toBeGreaterThan(0);
    });
  });
});