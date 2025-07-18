import { FrameworkAdapter } from '@metamon/adapters';
import { HotReloadConfig } from '../hot-reload-config.js';

/**
 * Options for Metamon build tools
 */
export interface MetamonBuildOptions {
  /** Root directory for .mtm files */
  root?: string;
  /** Pages directory relative to root */
  pagesDir?: string;
  /** Components directory relative to root */
  componentsDir?: string;
  /** Enable development mode features */
  dev?: boolean;
  /** Framework-specific build options */
  frameworks?: {
    react?: boolean;
    vue?: boolean;
    solid?: boolean;
    svelte?: boolean;
  };
}

/**
 * Options for the Metamon Vite plugin
 */
export interface MetamonViteOptions {
  /**
   * Root directory for .mtm files (default: 'src')
   */
  root?: string;
  
  /**
   * Directory for page files (default: 'pages')
   */
  pagesDir?: string;
  
  /**
   * Directory for component files (default: 'components')
   */
  componentsDir?: string;
  
  /**
   * Enable hot module replacement (default: true)
   */
  hmr?: boolean;
  
  /**
   * Enable source maps (default: true in dev, false in prod)
   */
  sourceMaps?: boolean;
  
  /**
   * Custom framework adapters
   */
  adapters?: Record<string, FrameworkAdapter>;

  /**
   * Hot reload configuration
   */
  hotReload?: Partial<HotReloadConfig>;

  /**
   * Performance optimization configuration
   */
  performance?: {
    /**
     * Framework lazy loading configuration
     */
    lazyLoading?: {
      /** Enable framework lazy loading */
      enabled?: boolean;
      /** Loading priority strategy */
      strategy?: 'viewport' | 'interaction' | 'idle' | 'immediate';
      /** Preload frameworks based on user behavior */
      intelligentPreload?: boolean;
      /** Target loading time in milliseconds */
      targetLoadTime?: number;
    };

    /**
     * Service worker configuration
     */
    serviceWorker?: {
      /** Enable service worker for framework caching */
      enabled?: boolean;
      /** Service worker scope */
      scope?: string;
      /** Cache strategy */
      cacheStrategy?: 'cache-first' | 'network-first' | 'stale-while-revalidate';
      /** Background execution for heavy tasks */
      backgroundExecution?: boolean;
    };

    /**
     * Layout stability configuration
     */
    layoutStability?: {
      /** Enable CLS prevention */
      enabled?: boolean;
      /** Target CLS score */
      targetCLS?: number;
      /** Placeholder strategy */
      placeholderStrategy?: 'dimensions' | 'skeleton' | 'spinner';
    };

    /**
     * SSR optimization configuration
     */
    ssr?: {
      /** Enable selective hydration */
      selectiveHydration?: boolean;
      /** Hydration strategy */
      hydrationStrategy?: 'immediate' | 'viewport' | 'interaction';
      /** Progressive enhancement fallback */
      progressiveEnhancement?: boolean;
    };

    /**
     * Network adaptation configuration
     */
    networkAdaptation?: {
      /** Enable network-aware loading */
      enabled?: boolean;
      /** Bandwidth-aware preloading */
      bandwidthAware?: boolean;
      /** Intermittent connectivity handling */
      intermittentConnectivity?: boolean;
    };

    /**
     * Performance monitoring configuration
     */
    monitoring?: {
      /** Enable performance metrics collection */
      enabled?: boolean;
      /** Track Core Web Vitals */
      webVitals?: boolean;
      /** Framework loading metrics */
      frameworkMetrics?: boolean;
      /** Service worker debugging */
      serviceWorkerDebug?: boolean;
    };
  };

  /**
   * Production optimization settings
   */
  optimization?: {
    /**
     * Enable tree-shaking for unused code
     */
    treeShaking?: {
      /** Enable tree-shaking for runtime features */
      runtime?: boolean;
      /** Enable tree-shaking for framework adapters */
      adapters?: boolean;
      /** Enable tree-shaking for unused components */
      components?: boolean;
      /** Preserve specific exports even if unused */
      preserve?: string[];
      /** Enable aggressive tree-shaking */
      aggressive?: boolean;
    };
    
    /**
     * Enable minification and compression
     */
    minify?: {
      /** Enable minification */
      enabled?: boolean;
      /** Remove comments */
      removeComments?: boolean;
      /** Remove console statements */
      removeConsole?: boolean;
      /** Remove debugger statements */
      removeDebugger?: boolean;
      /** Mangle variable names */
      mangle?: boolean;
      /** Compress expressions */
      compress?: boolean;
    };
    
    /**
     * Enable compression
     */
    compression?: {
      /** Enable gzip compression */
      gzip?: boolean;
      /** Enable brotli compression */
      brotli?: boolean;
      /** Compression level (1-9) */
      level?: number;
    };
    
    /**
     * Code splitting configuration
     */
    splitting?: {
      /** Enable code splitting */
      enabled?: boolean;
      /** Chunk size threshold for splitting */
      chunkSizeThreshold?: number;
      /** Shared dependencies threshold */
      sharedDepsThreshold?: number;
    };
    
    /**
     * Bundle analysis configuration
     */
    analysis?: {
      /** Generate detailed size breakdown */
      detailed?: boolean;
      /** Include source map analysis */
      sourceMaps?: boolean;
      /** Generate visualization data */
      visualization?: boolean;
      /** Size thresholds for warnings */
      thresholds?: {
        warning?: number;
        error?: number;
      };
    };
    
    /**
     * Target environment
     */
    target?: 'es5' | 'es2015' | 'es2017' | 'es2020' | 'esnext';
    
    /**
     * Enable polyfills for older browsers
     */
    polyfills?: boolean;
  };
}