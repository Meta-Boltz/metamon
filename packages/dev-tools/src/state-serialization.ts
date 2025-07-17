import type { 
  StateSnapshot, 
  SignalStateSnapshot, 
  SubscriptionSnapshot, 
  ComponentStateSnapshot 
} from './types/state-preservation.js';

/**
 * Serialization utilities for state snapshots
 * 
 * These utilities handle the conversion of state snapshots to/from JSON
 * for persistence or transmission during hot reload operations.
 */

/**
 * Serializable version of StateSnapshot for JSON conversion
 */
interface SerializableStateSnapshot {
  signals: SerializableSignalStateSnapshot;
  subscriptions: SerializableSubscriptionSnapshot;
  components: Array<[string, ComponentStateSnapshot]>;
  timestamp: number;
}

/**
 * Serializable version of SignalStateSnapshot
 */
interface SerializableSignalStateSnapshot {
  globalSignals: Array<[string, any]>;
  signalSubscriptions: Array<[string, string[]]>;
  timestamp: number;
}

/**
 * Serializable version of SubscriptionSnapshot
 */
interface SerializableSubscriptionSnapshot {
  eventSubscriptions: Array<[string, any[]]>;
  componentEventMap: Array<[string, string[]]>;
  timestamp: number;
}

/**
 * Serialize a StateSnapshot to JSON string
 */
export function serializeStateSnapshot(snapshot: StateSnapshot): string {
  try {
    const serializable: SerializableStateSnapshot = {
      signals: {
        globalSignals: Array.from(snapshot.signals.globalSignals.entries()),
        signalSubscriptions: Array.from(snapshot.signals.signalSubscriptions.entries()),
        timestamp: snapshot.signals.timestamp
      },
      subscriptions: {
        eventSubscriptions: Array.from(snapshot.subscriptions.eventSubscriptions.entries()),
        componentEventMap: Array.from(snapshot.subscriptions.componentEventMap.entries()),
        timestamp: snapshot.subscriptions.timestamp
      },
      components: Array.from(snapshot.components.entries()),
      timestamp: snapshot.timestamp
    };

    return JSON.stringify(serializable, null, 2);
  } catch (error) {
    throw new Error(`Failed to serialize state snapshot: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Deserialize a JSON string to StateSnapshot
 */
export function deserializeStateSnapshot(jsonString: string): StateSnapshot {
  try {
    const serializable: SerializableStateSnapshot = JSON.parse(jsonString);

    const snapshot: StateSnapshot = {
      signals: {
        globalSignals: new Map(serializable.signals.globalSignals),
        signalSubscriptions: new Map(serializable.signals.signalSubscriptions),
        timestamp: serializable.signals.timestamp
      },
      subscriptions: {
        eventSubscriptions: new Map(serializable.subscriptions.eventSubscriptions),
        componentEventMap: new Map(serializable.subscriptions.componentEventMap),
        timestamp: serializable.subscriptions.timestamp
      },
      components: new Map(serializable.components),
      timestamp: serializable.timestamp
    };

    return snapshot;
  } catch (error) {
    throw new Error(`Failed to deserialize state snapshot: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Validate that a deserialized snapshot has the correct structure
 */
export function validateStateSnapshot(snapshot: any): snapshot is StateSnapshot {
  try {
    return (
      typeof snapshot === 'object' &&
      snapshot !== null &&
      typeof snapshot.timestamp === 'number' &&
      
      // Validate signals
      typeof snapshot.signals === 'object' &&
      snapshot.signals !== null &&
      snapshot.signals.globalSignals instanceof Map &&
      snapshot.signals.signalSubscriptions instanceof Map &&
      typeof snapshot.signals.timestamp === 'number' &&
      
      // Validate subscriptions
      typeof snapshot.subscriptions === 'object' &&
      snapshot.subscriptions !== null &&
      snapshot.subscriptions.eventSubscriptions instanceof Map &&
      snapshot.subscriptions.componentEventMap instanceof Map &&
      typeof snapshot.subscriptions.timestamp === 'number' &&
      
      // Validate components
      snapshot.components instanceof Map
    );
  } catch (error) {
    return false;
  }
}

/**
 * Create a deep clone of a state snapshot
 */
export function cloneStateSnapshot(snapshot: StateSnapshot): StateSnapshot {
  try {
    // Use serialization/deserialization for deep cloning
    const serialized = serializeStateSnapshot(snapshot);
    return deserializeStateSnapshot(serialized);
  } catch (error) {
    throw new Error(`Failed to clone state snapshot: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Merge two state snapshots, with the second snapshot taking precedence
 */
export function mergeStateSnapshots(base: StateSnapshot, overlay: StateSnapshot): StateSnapshot {
  const merged: StateSnapshot = {
    signals: {
      globalSignals: new Map([...base.signals.globalSignals, ...overlay.signals.globalSignals]),
      signalSubscriptions: new Map([...base.signals.signalSubscriptions, ...overlay.signals.signalSubscriptions]),
      timestamp: Math.max(base.signals.timestamp, overlay.signals.timestamp)
    },
    subscriptions: {
      eventSubscriptions: new Map([...base.subscriptions.eventSubscriptions, ...overlay.subscriptions.eventSubscriptions]),
      componentEventMap: new Map([...base.subscriptions.componentEventMap, ...overlay.subscriptions.componentEventMap]),
      timestamp: Math.max(base.subscriptions.timestamp, overlay.subscriptions.timestamp)
    },
    components: new Map([...base.components, ...overlay.components]),
    timestamp: Math.max(base.timestamp, overlay.timestamp)
  };

  return merged;
}

/**
 * Get snapshot statistics for debugging
 */
export function getSnapshotStats(snapshot: StateSnapshot): {
  signalCount: number;
  subscriptionCount: number;
  componentCount: number;
  totalSize: number;
  age: number;
} {
  const serialized = serializeStateSnapshot(snapshot);
  
  return {
    signalCount: snapshot.signals.globalSignals.size,
    subscriptionCount: Array.from(snapshot.subscriptions.eventSubscriptions.values())
      .reduce((total, subs) => total + subs.length, 0),
    componentCount: snapshot.components.size,
    totalSize: new Blob([serialized]).size,
    age: Date.now() - snapshot.timestamp
  };
}

/**
 * Check if a snapshot is stale based on age
 */
export function isSnapshotStale(snapshot: StateSnapshot, maxAge: number): boolean {
  return (Date.now() - snapshot.timestamp) > maxAge;
}

/**
 * Compress a state snapshot by removing empty or redundant data
 */
export function compressStateSnapshot(snapshot: StateSnapshot): StateSnapshot {
  const compressed: StateSnapshot = {
    signals: {
      globalSignals: new Map(),
      signalSubscriptions: new Map(),
      timestamp: snapshot.signals.timestamp
    },
    subscriptions: {
      eventSubscriptions: new Map(),
      componentEventMap: new Map(),
      timestamp: snapshot.subscriptions.timestamp
    },
    components: new Map(),
    timestamp: snapshot.timestamp
  };

  // Only include signals with actual values
  for (const [key, value] of snapshot.signals.globalSignals) {
    if (value !== undefined && value !== null) {
      compressed.signals.globalSignals.set(key, value);
    }
  }

  // Only include subscriptions with actual subscribers
  for (const [key, subs] of snapshot.signals.signalSubscriptions) {
    if (subs.length > 0) {
      compressed.signals.signalSubscriptions.set(key, subs);
    }
  }

  // Only include events with actual subscriptions
  for (const [event, subscriptions] of snapshot.subscriptions.eventSubscriptions) {
    if (subscriptions.length > 0) {
      compressed.subscriptions.eventSubscriptions.set(event, subscriptions);
    }
  }

  // Only include components with actual event mappings
  for (const [componentId, events] of snapshot.subscriptions.componentEventMap) {
    if (events.length > 0) {
      compressed.subscriptions.componentEventMap.set(componentId, events);
    }
  }

  // Include all components (they might have important state even if empty)
  for (const [componentId, componentSnapshot] of snapshot.components) {
    compressed.components.set(componentId, componentSnapshot);
  }

  return compressed;
}