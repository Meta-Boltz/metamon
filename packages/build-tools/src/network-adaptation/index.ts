/**
 * Network Adaptation Module
 * Provides comprehensive network condition adaptation and reliability features
 */

export { NetworkConditionMonitor } from './network-condition-monitor.js';
export type { 
  NetworkQualityMetrics, 
  ConnectionEvent, 
  AdaptationStrategy 
} from './network-condition-monitor.js';

export { BandwidthAwarePreloader } from './bandwidth-aware-preloader.js';
export type { 
  PreloadRequest, 
  BandwidthBudget, 
  PreloadingStrategy 
} from './bandwidth-aware-preloader.js';

export { IntermittentConnectivityHandler } from './intermittent-connectivity-handler.js';
export type { 
  CachedResource, 
  ConnectivityState, 
  OfflineStrategy 
} from './intermittent-connectivity-handler.js';

export { NetworkAdaptationCoordinator } from './network-adaptation-coordinator.js';
export type { 
  NetworkAdaptationConfig, 
  LoadingRecommendation, 
  NetworkAdaptationMetrics 
} from './network-adaptation-coordinator.js';