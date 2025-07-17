/**
 * Types for state preservation during hot reload
 */

/**
 * Snapshot of signal state for preservation during hot reload
 */
export interface SignalStateSnapshot {
  /** Map of signal keys to their current values */
  globalSignals: Map<string, any>;
  /** Map of signal keys to their subscriber component IDs */
  signalSubscriptions: Map<string, string[]>;
  /** Timestamp when snapshot was taken */
  timestamp: number;
}

/**
 * Snapshot of PubSub subscriptions for preservation during hot reload
 */
export interface SubscriptionSnapshot {
  /** Map of event names to their subscriptions */
  eventSubscriptions: Map<string, EventSubscriptionData[]>;
  /** Map of component IDs to their subscribed events */
  componentEventMap: Map<string, string[]>;
  /** Timestamp when snapshot was taken */
  timestamp: number;
}

/**
 * Event subscription data for serialization
 */
export interface EventSubscriptionData {
  event: string;
  componentId: string;
  /** Serialized callback function (for restoration) */
  callbackId: string;
}

/**
 * Component-specific state snapshot
 */
export interface ComponentStateSnapshot {
  componentId: string;
  frameworkType: string;
  localState: any;
  props: any;
  metamonConnections: MetamonConnection[];
  timestamp: number;
}

/**
 * Metamon connection information for cross-framework communication
 */
export interface MetamonConnection {
  type: 'signal' | 'pubsub';
  key: string;
  direction: 'subscribe' | 'publish' | 'both';
}

/**
 * Complete state snapshot for hot reload preservation
 */
export interface StateSnapshot {
  signals: SignalStateSnapshot;
  subscriptions: SubscriptionSnapshot;
  components: Map<string, ComponentStateSnapshot>;
  timestamp: number;
}

/**
 * Configuration for state preservation behavior
 */
export interface StatePreservationConfig {
  /** Whether to preserve signal state during hot reload */
  preserveSignals: boolean;
  /** Whether to preserve PubSub subscriptions during hot reload */
  preserveSubscriptions: boolean;
  /** Whether to preserve component-specific state */
  preserveComponentState: boolean;
  /** Maximum age of snapshots in milliseconds before they're considered stale */
  maxSnapshotAge: number;
  /** Whether to enable debug logging for state preservation */
  debugLogging: boolean;
}

/**
 * Result of state preservation operation
 */
export interface StatePreservationResult {
  success: boolean;
  snapshot?: StateSnapshot;
  error?: string;
  preservedSignals: number;
  preservedSubscriptions: number;
  preservedComponents: number;
}

/**
 * Result of state restoration operation
 */
export interface StateRestorationResult {
  success: boolean;
  error?: string;
  restoredSignals: number;
  restoredSubscriptions: number;
  restoredComponents: number;
  failedRestorations: string[];
}