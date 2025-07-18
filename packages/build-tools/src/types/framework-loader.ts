/**
 * Types for Framework Loader Service
 */

export enum FrameworkType {
  REACT = 'react',
  VUE = 'vue',
  SVELTE = 'svelte',
  SOLID = 'solid'
}

export enum LoadPriority {
  CRITICAL = 'critical',    // Visible components
  HIGH = 'high',           // Above fold
  NORMAL = 'normal',       // Below fold
  LOW = 'low'              // Preload
}

export interface FrameworkCore {
  name: FrameworkType;
  version: string;
  bundle: ArrayBuffer;
  dependencies: string[];
  size: number;
  checksum: string;
  timestamp: number;
}

export interface FrameworkRequest {
  framework: FrameworkType;
  version?: string;
  priority: LoadPriority;
  timeout?: number;
  clientId?: string;
}

export interface FrameworkLoadingMetrics {
  totalRequests: number;
  cacheHits: number;
  cacheMisses: number;
  averageLoadTime: number;
  loadTimesByFramework: Map<FrameworkType, number[]>;
  failureRate: number;
  networkRequests: number;
}

export interface NetworkConditions {
  effectiveType: '2g' | '3g' | '4g' | 'slow-2g';
  downlink: number;
  rtt: number;
  saveData: boolean;
}

export interface LoadingStrategy {
  maxConcurrentLoads: number;
  timeoutMs: number;
  retryAttempts: number;
  retryDelayMs: number;
  priorityWeights: Record<LoadPriority, number>;
  networkAdaptation: {
    enabled: boolean;
    slowNetworkThreshold: number;
    adaptiveTimeout: boolean;
  };
}

export interface CacheConfig {
  maxAge: number;
  maxSize: number;
  compressionEnabled: boolean;
  invalidationStrategy: 'version' | 'checksum' | 'timestamp';
}

export interface FrameworkLoaderConfig {
  serviceWorkerEnabled: boolean;
  fallbackEnabled: boolean;
  loadingStrategy: LoadingStrategy;
  cacheConfig: CacheConfig;
  enableMetrics: boolean;
  enableLogging: boolean;
}

export interface PriorityQueueItem {
  request: FrameworkRequest;
  timestamp: number;
  resolve: (framework: FrameworkCore) => void;
  reject: (error: Error) => void;
  timeoutHandle?: NodeJS.Timeout;
}

export interface LoadingState {
  framework: FrameworkType;
  status: 'queued' | 'loading' | 'loaded' | 'failed';
  startTime: number;
  endTime?: number;
  error?: Error;
  priority: LoadPriority;
}