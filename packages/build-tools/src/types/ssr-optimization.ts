/**
 * Types for SSR optimization and selective hydration
 */

export type FrameworkType = 'react' | 'vue' | 'svelte' | 'solid';

export enum LoadPriority {
  CRITICAL = 'critical',    // Visible components
  HIGH = 'high',           // Above fold
  NORMAL = 'normal',       // Below fold
  LOW = 'low'              // Preload
}

export enum FallbackStrategy {
  DIRECT_LOAD = 'direct_load',
  CACHED_VERSION = 'cached_version',
  MINIMAL_FALLBACK = 'minimal_fallback',
  GRACEFUL_DEGRADATION = 'graceful_degradation'
}

export interface ComponentDefinition {
  id: string;
  framework: FrameworkType;
  component: string;
  props: Record<string, any>;
  isInteractive: boolean;
  priority: LoadPriority;
  boundingRect?: DOMRect;
}

export interface SSRResult {
  html: string;
  criticalCSS: string;
  hydrationData: HydrationData;
  frameworkRequirements: FrameworkRequirement[];
}

export interface HydrationData {
  components: HydrationTarget[];
  state: Record<string, any>;
  metadata: {
    timestamp: number;
    version: string;
    checksum: string;
  };
}

export interface HydrationTarget {
  componentId: string;
  framework: FrameworkType;
  isInteractive: boolean;
  priority: LoadPriority;
  boundingRect?: DOMRect;
  selector: string;
  props: Record<string, any>;
  state?: Record<string, any>;
}

export interface FrameworkRequirement {
  framework: FrameworkType;
  components: string[];
  priority: LoadPriority;
  estimatedSize: number;
  dependencies: string[];
}

export interface SSROptimizationConfig {
  enableSelectiveHydration: boolean;
  hydrateOnlyInteractive: boolean;
  enableProgressiveEnhancement: boolean;
  fallbackStrategy: FallbackStrategy;
  performanceThresholds: {
    maxHydrationTime: number;
    maxFrameworkLoadTime: number;
    maxLayoutShift: number;
  };
}

export interface SSROptimizationManager {
  // SSR content management
  renderServerContent(components: ComponentDefinition[]): Promise<SSRResult>;
  
  // Selective hydration
  identifyHydrationTargets(ssrContent: string): HydrationTarget[];
  hydrateComponent(target: HydrationTarget): Promise<void>;
  
  // Framework requirement analysis
  analyzeFrameworkRequirements(components: ComponentDefinition[]): FrameworkRequirement[];
  
  // Progressive enhancement
  enableProgressiveEnhancement(fallbackStrategy: FallbackStrategy): void;
  
  // Configuration
  configure(config: SSROptimizationConfig): void;
}

export interface SSRMetrics {
  renderTime: number;
  hydrationTime: number;
  frameworkLoadTime: Map<FrameworkType, number>;
  layoutShiftScore: number;
  interactiveComponents: number;
  totalComponents: number;
  cacheHitRate: number;
}