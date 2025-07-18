/**
 * Types for Performance Monitoring and Debugging Tools
 */

import { FrameworkType, LoadPriority } from './framework-loader.js';

// Core Web Vitals Types
export interface CoreWebVitals {
  lcp: number;  // Largest Contentful Paint
  fid: number;  // First Input Delay
  cls: number;  // Cumulative Layout Shift
  fcp: number;  // First Contentful Paint
  ttfb: number; // Time to First Byte
  inp?: number; // Interaction to Next Paint (new metric)
}

export interface WebVitalEntry {
  name: string;
  value: number;
  delta: number;
  id: string;
  timestamp: number;
  rating: 'good' | 'needs-improvement' | 'poor';
}

// Framework Loading Performance
export interface FrameworkLoadingPerformance {
  framework: FrameworkType;
  loadStartTime: number;
  loadEndTime: number;
  loadDuration: number;
  cacheHit: boolean;
  bundleSize: number;
  priority: LoadPriority;
  networkLatency?: number;
  parseTime?: number;
  executionTime?: number;
}

// Service Worker Performance
export interface ServiceWorkerPerformance {
  registrationTime: number;
  activationTime: number;
  cacheOperations: CacheOperationMetrics[];
  backgroundTasks: BackgroundTaskMetrics[];
  messageLatency: number[];
  errorCount: number;
  uptime: number;
}

export interface CacheOperationMetrics {
  operation: 'get' | 'put' | 'delete' | 'match';
  key: string;
  duration: number;
  success: boolean;
  cacheSize?: number;
  timestamp: number;
}

export interface BackgroundTaskMetrics {
  taskType: string;
  duration: number;
  success: boolean;
  memoryUsage?: number;
  timestamp: number;
}

// Network Performance
export interface NetworkPerformance {
  requestCount: number;
  totalBytesTransferred: number;
  averageLatency: number;
  cacheHitRate: number;
  compressionRatio: number;
  failureRate: number;
  connectionType: string;
  effectiveBandwidth: number;
}

// Bundle Performance
export interface BundlePerformance {
  initialBundleSize: number;
  frameworkBundleSizes: Map<FrameworkType, number>;
  sharedDependencySize: number;
  compressionRatio: number;
  loadTime: number;
  parseTime: number;
  cacheEfficiency: number;
}

// Performance Budget
export interface PerformanceBudget {
  maxInitialBundleSize: number;
  maxFrameworkLoadTime: number;
  maxCLS: number;
  maxLCP: number;
  maxFID: number;
  maxCacheSize: number;
  maxNetworkRequests: number;
}

// Performance Alert
export interface PerformanceAlert {
  id: string;
  type: 'budget-exceeded' | 'performance-degradation' | 'error-threshold' | 'cache-inefficiency';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  metric: string;
  currentValue: number;
  threshold: number;
  timestamp: number;
  suggestions: string[];
}

// Comprehensive Performance Metrics
export interface PerformanceMetrics {
  timestamp: number;
  sessionId: string;
  
  // Core metrics
  webVitals: CoreWebVitals;
  frameworkLoading: FrameworkLoadingPerformance[];
  serviceWorker: ServiceWorkerPerformance;
  network: NetworkPerformance;
  bundle: BundlePerformance;
  
  // System info
  userAgent: string;
  connectionType: string;
  deviceMemory?: number;
  hardwareConcurrency?: number;
  
  // Custom metrics
  customMetrics: Record<string, number>;
}

// Performance Timeline Entry
export interface PerformanceTimelineEntry {
  timestamp: number;
  type: 'framework-load' | 'cache-operation' | 'web-vital' | 'error' | 'user-interaction';
  data: any;
  duration?: number;
}

// Debug Information
export interface DebugInfo {
  serviceWorkerState: 'installing' | 'installed' | 'activating' | 'activated' | 'redundant' | 'none';
  cacheStatus: CacheDebugInfo;
  frameworkStates: Map<FrameworkType, FrameworkDebugInfo>;
  networkConditions: NetworkDebugInfo;
  errors: ErrorDebugInfo[];
  warnings: WarningDebugInfo[];
}

export interface CacheDebugInfo {
  totalSize: number;
  entryCount: number;
  hitRate: number;
  oldestEntry: number;
  newestEntry: number;
  corruptedEntries: number;
}

export interface FrameworkDebugInfo {
  framework: FrameworkType;
  status: 'not-loaded' | 'loading' | 'loaded' | 'failed';
  version: string;
  loadTime?: number;
  cacheHit: boolean;
  bundleSize: number;
  dependencies: string[];
  errors: string[];
}

export interface NetworkDebugInfo {
  online: boolean;
  effectiveType: string;
  downlink: number;
  rtt: number;
  saveData: boolean;
  requestsInFlight: number;
}

export interface ErrorDebugInfo {
  id: string;
  type: string;
  message: string;
  stack?: string;
  timestamp: number;
  context: Record<string, any>;
}

export interface WarningDebugInfo {
  id: string;
  type: string;
  message: string;
  timestamp: number;
  context: Record<string, any>;
}

// Performance Monitoring Configuration
export interface PerformanceMonitoringConfig {
  enabled: boolean;
  collectWebVitals: boolean;
  collectFrameworkMetrics: boolean;
  collectServiceWorkerMetrics: boolean;
  collectNetworkMetrics: boolean;
  
  // Sampling configuration
  sampleRate: number;
  maxEntriesPerType: number;
  
  // Budget configuration
  performanceBudget: PerformanceBudget;
  
  // Alert configuration
  alertThresholds: {
    errorRate: number;
    performanceDegradation: number;
    budgetExceeded: boolean;
  };
  
  // Debug configuration
  enableDebugMode: boolean;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
  persistMetrics: boolean;
  
  // Reporting configuration
  reportingEndpoint?: string;
  reportingInterval: number;
  batchSize: number;
}

// Performance Report
export interface PerformanceReport {
  id: string;
  timestamp: number;
  timeRange: {
    start: number;
    end: number;
  };
  
  summary: {
    totalPageLoads: number;
    averageLoadTime: number;
    errorRate: number;
    cacheHitRate: number;
    webVitalsScore: number;
  };
  
  metrics: PerformanceMetrics[];
  alerts: PerformanceAlert[];
  recommendations: string[];
}

// Visualization Data
export interface VisualizationData {
  timeline: PerformanceTimelineEntry[];
  charts: {
    loadTimes: ChartData;
    webVitals: ChartData;
    cachePerformance: ChartData;
    networkUtilization: ChartData;
  };
}

export interface ChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    color: string;
  }[];
}