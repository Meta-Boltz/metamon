/**
 * Types for Intelligent Preloader
 */

import { FrameworkType, LoadPriority, NetworkConditions } from './framework-loader.js';

export interface ComponentDefinition {
  id: string;
  framework: FrameworkType;
  element?: HTMLElement;
  isInteractive: boolean;
  boundingRect?: DOMRect;
  route?: string;
}

export interface UserInteraction {
  type: 'click' | 'hover' | 'scroll' | 'focus' | 'touch';
  target: HTMLElement;
  timestamp: number;
  coordinates?: { x: number; y: number };
  duration?: number;
}

export interface PreloadPrediction {
  framework: FrameworkType;
  confidence: number;
  reason: 'viewport' | 'interaction' | 'navigation' | 'pattern';
  priority: LoadPriority;
  estimatedLoadTime?: number;
}

export interface PreloadTrigger {
  type: 'viewport' | 'interaction' | 'idle' | 'navigation';
  threshold: number;
  delay: number;
  condition?: () => boolean;
}

export interface ViewportConfig {
  rootMargin: string;
  threshold: number[];
  preloadDistance: number; // pixels before entering viewport
}

export interface InteractionPredictionConfig {
  hoverDelay: number;
  scrollVelocityThreshold: number;
  clickPatternWindow: number;
  confidenceThreshold: number;
}

export interface NavigationPredictionConfig {
  routePatterns: string[];
  preloadDepth: number;
  cacheSize: number;
  prefetchDelay: number;
}

export interface NetworkAdaptationConfig {
  slowNetworkThreshold: number;
  saveDataRespect: boolean;
  adaptivePreloading: boolean;
  bandwidthThresholds: {
    disable: number;
    reduce: number;
    normal: number;
  };
}

export interface IntelligentPreloaderConfig {
  viewport: ViewportConfig;
  interaction: InteractionPredictionConfig;
  navigation: NavigationPredictionConfig;
  network: NetworkAdaptationConfig;
  enableLogging: boolean;
  enableMetrics: boolean;
}

export interface PreloadMetrics {
  totalPredictions: number;
  accuratePredictions: number;
  falsePositives: number;
  preloadHitRate: number;
  averageConfidence: number;
  networkSavings: number;
  predictionsByReason: Record<string, number>;
}

export interface PreloadSchedule {
  framework: FrameworkType;
  priority: LoadPriority;
  scheduledAt: number;
  reason: string;
  confidence: number;
  cancelled?: boolean;
}

export interface IntelligentPreloader {
  // Viewport-based preloading
  observeViewport(components: ComponentDefinition[]): void;
  unobserveViewport(components: ComponentDefinition[]): void;
  
  // Interaction-based preloading
  startInteractionTracking(): void;
  stopInteractionTracking(): void;
  predictUserIntent(interactions: UserInteraction[]): PreloadPrediction[];
  
  // Navigation-based preloading
  preloadForNavigation(route: string): Promise<void>;
  preloadForRoutePattern(pattern: string): Promise<void>;
  
  // Network-aware preloading
  adaptPreloadingStrategy(networkConditions: NetworkConditions): void;
  
  // Preload management
  schedulePreload(framework: FrameworkType, priority: LoadPriority, reason: string): void;
  cancelPreload(framework: FrameworkType): void;
  cancelAllPreloads(): void;
  
  // Configuration and metrics
  updateConfig(config: Partial<IntelligentPreloaderConfig>): void;
  getMetrics(): PreloadMetrics;
  getScheduledPreloads(): PreloadSchedule[];
  
  // Lifecycle
  start(): void;
  stop(): void;
  destroy(): void;
}