import type { 
  StateSnapshot, 
  SignalStateSnapshot, 
  SubscriptionSnapshot, 
  ComponentStateSnapshot,
  StatePreservationConfig,
  StatePreservationResult,
  StateRestorationResult,
  EventSubscriptionData
} from './types/state-preservation.js';
import type { MetamonSignalManager } from '@metamon/core';
import type { MetamonPubSub } from '@metamon/core';

/**
 * StatePreservationManager - Handles backup and restoration of Metamon state during hot reload
 * 
 * This class provides the core infrastructure for preserving cross-framework state
 * including signals, PubSub subscriptions, and component-specific state during
 * hot module replacement operations.
 */
export class StatePreservationManager {
  private config: StatePreservationConfig;
  private currentSnapshot: StateSnapshot | null = null;
  private callbackRegistry: Map<string, Function> = new Map();
  private callbackIdCounter = 0;

  constructor(config: Partial<StatePreservationConfig> = {}) {
    this.config = {
      preserveSignals: true,
      preserveSubscriptions: true,
      preserveComponentState: true,
      maxSnapshotAge: 30000, // 30 seconds
      debugLogging: false,
      ...config
    };
  }

  /**
   * Create a complete state snapshot for preservation
   */
  async preserveState(
    signalManager: MetamonSignalManager,
    pubSubSystem: MetamonPubSub
  ): Promise<StatePreservationResult> {
    try {
      const timestamp = Date.now();
      let preservedSignals = 0;
      let preservedSubscriptions = 0;
      let preservedComponents = 0;

      // Create signal state snapshot
      const signalSnapshot = this.config.preserveSignals 
        ? await this.backupSignalState(signalManager)
        : this.createEmptySignalSnapshot();
      
      if (signalSnapshot.globalSignals.size > 0) {
        preservedSignals = signalSnapshot.globalSignals.size;
      }

      // Create subscription snapshot
      const subscriptionSnapshot = this.config.preserveSubscriptions
        ? await this.backupSubscriptions(pubSubSystem)
        : this.createEmptySubscriptionSnapshot();
      
      if (subscriptionSnapshot.eventSubscriptions.size > 0) {
        preservedSubscriptions = Array.from(subscriptionSnapshot.eventSubscriptions.values())
          .reduce((total, subs) => total + subs.length, 0);
      }

      // Create component state snapshot (placeholder for now)
      const componentSnapshots = this.config.preserveComponentState
        ? await this.backupComponentState()
        : new Map<string, ComponentStateSnapshot>();
      
      preservedComponents = componentSnapshots.size;

      // Create complete snapshot
      const snapshot: StateSnapshot = {
        signals: signalSnapshot,
        subscriptions: subscriptionSnapshot,
        components: componentSnapshots,
        timestamp
      };

      this.currentSnapshot = snapshot;

      if (this.config.debugLogging) {
        console.log(`[StatePreservation] Preserved state: ${preservedSignals} signals, ${preservedSubscriptions} subscriptions, ${preservedComponents} components`);
      }

      return {
        success: true,
        snapshot,
        preservedSignals,
        preservedSubscriptions,
        preservedComponents
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during state preservation';
      
      if (this.config.debugLogging) {
        console.error('[StatePreservation] Failed to preserve state:', error);
      }

      return {
        success: false,
        error: errorMessage,
        preservedSignals: 0,
        preservedSubscriptions: 0,
        preservedComponents: 0
      };
    }
  }

  /**
   * Restore state from a snapshot
   */
  async restoreState(
    signalManager: MetamonSignalManager,
    pubSubSystem: MetamonPubSub,
    snapshot?: StateSnapshot
  ): Promise<StateRestorationResult> {
    const targetSnapshot = snapshot || this.currentSnapshot;
    
    if (!targetSnapshot) {
      return {
        success: false,
        error: 'No snapshot available for restoration',
        restoredSignals: 0,
        restoredSubscriptions: 0,
        restoredComponents: 0,
        failedRestorations: []
      };
    }

    // Check if snapshot is too old
    if (Date.now() - targetSnapshot.timestamp > this.config.maxSnapshotAge) {
      if (this.config.debugLogging) {
        console.warn('[StatePreservation] Snapshot is stale, skipping restoration');
      }
      return {
        success: false,
        error: 'Snapshot is too old',
        restoredSignals: 0,
        restoredSubscriptions: 0,
        restoredComponents: 0,
        failedRestorations: []
      };
    }

    const failedRestorations: string[] = [];
    let restoredSignals = 0;
    let restoredSubscriptions = 0;
    let restoredComponents = 0;

    try {
      // Restore signal state
      if (this.config.preserveSignals) {
        const signalResult = await this.restoreSignalState(signalManager, targetSnapshot.signals);
        restoredSignals = signalResult.restored;
        failedRestorations.push(...signalResult.failed);
      }

      // Restore subscriptions
      if (this.config.preserveSubscriptions) {
        const subscriptionResult = await this.restoreSubscriptions(pubSubSystem, targetSnapshot.subscriptions);
        restoredSubscriptions = subscriptionResult.restored;
        failedRestorations.push(...subscriptionResult.failed);
      }

      // Restore component state
      if (this.config.preserveComponentState) {
        const componentResult = await this.restoreComponentState(targetSnapshot.components);
        restoredComponents = componentResult.restored;
        failedRestorations.push(...componentResult.failed);
      }

      if (this.config.debugLogging) {
        console.log(`[StatePreservation] Restored state: ${restoredSignals} signals, ${restoredSubscriptions} subscriptions, ${restoredComponents} components`);
        if (failedRestorations.length > 0) {
          console.warn('[StatePreservation] Failed restorations:', failedRestorations);
        }
      }

      return {
        success: true,
        restoredSignals,
        restoredSubscriptions,
        restoredComponents,
        failedRestorations
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during state restoration';
      
      if (this.config.debugLogging) {
        console.error('[StatePreservation] Failed to restore state:', error);
      }

      return {
        success: false,
        error: errorMessage,
        restoredSignals,
        restoredSubscriptions,
        restoredComponents,
        failedRestorations
      };
    }
  }

  /**
   * Backup signal state from the signal manager
   */
  private async backupSignalState(signalManager: MetamonSignalManager): Promise<SignalStateSnapshot> {
    const globalSignals = new Map<string, any>();
    const signalSubscriptions = new Map<string, string[]>();

    try {
      // Get all signal keys
      const signalKeys = signalManager.getSignalKeys();
      
      for (const key of signalKeys) {
        const signal = signalManager.getSignal(key);
        if (signal) {
          // Store signal value
          globalSignals.set(key, signal.value);
          
          // Note: We can't easily extract subscriber information from the current signal implementation
          // This would require extending the signal interface to expose subscribers
          // For now, we'll store an empty array and rely on components to re-subscribe
          signalSubscriptions.set(key, []);
        }
      }
    } catch (error) {
      if (this.config.debugLogging) {
        console.error('[StatePreservation] Error backing up signal state:', error);
      }
      // Re-throw the error so it can be caught by the main preserveState method
      throw error;
    }

    return {
      globalSignals,
      signalSubscriptions,
      timestamp: Date.now()
    };
  }

  /**
   * Restore signal state to the signal manager
   */
  private async restoreSignalState(
    signalManager: MetamonSignalManager, 
    snapshot: SignalStateSnapshot
  ): Promise<{ restored: number; failed: string[] }> {
    let restored = 0;
    const failed: string[] = [];

    try {
      for (const [key, value] of snapshot.globalSignals) {
        try {
          // Get existing signal or create new one
          let signal = signalManager.getSignal(key);
          if (!signal) {
            signal = signalManager.createSignal(value, key);
          } else {
            // Update existing signal value
            signal.update(value);
          }
          restored++;
        } catch (error) {
          failed.push(`Signal ${key}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    } catch (error) {
      failed.push(`Signal restoration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return { restored, failed };
  }

  /**
   * Backup PubSub subscriptions
   */
  private async backupSubscriptions(pubSubSystem: MetamonPubSub): Promise<SubscriptionSnapshot> {
    const eventSubscriptions = new Map<string, EventSubscriptionData[]>();
    const componentEventMap = new Map<string, string[]>();

    try {
      // Get active subscriptions from the PubSub system
      const activeSubscriptions = pubSubSystem.getActiveSubscriptions();
      
      for (const subscription of activeSubscriptions) {
        const { event, componentId, callback } = subscription;
        
        // Generate callback ID for restoration
        const callbackId = this.generateCallbackId();
        this.callbackRegistry.set(callbackId, callback);
        
        // Store subscription data
        if (!eventSubscriptions.has(event)) {
          eventSubscriptions.set(event, []);
        }
        eventSubscriptions.get(event)!.push({
          event,
          componentId,
          callbackId
        });
        
        // Update component event map
        if (!componentEventMap.has(componentId)) {
          componentEventMap.set(componentId, []);
        }
        if (!componentEventMap.get(componentId)!.includes(event)) {
          componentEventMap.get(componentId)!.push(event);
        }
      }
    } catch (error) {
      if (this.config.debugLogging) {
        console.error('[StatePreservation] Error backing up subscriptions:', error);
      }
      // Re-throw the error so it can be caught by the main preserveState method
      throw error;
    }

    return {
      eventSubscriptions,
      componentEventMap,
      timestamp: Date.now()
    };
  }

  /**
   * Restore PubSub subscriptions
   */
  private async restoreSubscriptions(
    pubSubSystem: MetamonPubSub,
    snapshot: SubscriptionSnapshot
  ): Promise<{ restored: number; failed: string[] }> {
    let restored = 0;
    const failed: string[] = [];

    try {
      for (const [event, subscriptions] of snapshot.eventSubscriptions) {
        for (const subscriptionData of subscriptions) {
          try {
            const { componentId, callbackId } = subscriptionData;
            const callback = this.callbackRegistry.get(callbackId);
            
            if (callback) {
              pubSubSystem.subscribe(event, callback, componentId);
              restored++;
            } else {
              failed.push(`Subscription ${event}:${componentId} - callback not found`);
            }
          } catch (error) {
            failed.push(`Subscription ${event}:${subscriptionData.componentId} - ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      }
    } catch (error) {
      failed.push(`Subscription restoration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return { restored, failed };
  }

  /**
   * Backup component-specific state (placeholder implementation)
   */
  private async backupComponentState(): Promise<Map<string, ComponentStateSnapshot>> {
    // This is a placeholder implementation
    // In a real implementation, this would integrate with framework-specific state extraction
    return new Map<string, ComponentStateSnapshot>();
  }

  /**
   * Restore component-specific state (placeholder implementation)
   */
  private async restoreComponentState(
    snapshots: Map<string, ComponentStateSnapshot>
  ): Promise<{ restored: number; failed: string[] }> {
    // This is a placeholder implementation
    // In a real implementation, this would integrate with framework-specific state restoration
    return { restored: 0, failed: [] };
  }

  /**
   * Create empty signal snapshot
   */
  private createEmptySignalSnapshot(): SignalStateSnapshot {
    return {
      globalSignals: new Map(),
      signalSubscriptions: new Map(),
      timestamp: Date.now()
    };
  }

  /**
   * Create empty subscription snapshot
   */
  private createEmptySubscriptionSnapshot(): SubscriptionSnapshot {
    return {
      eventSubscriptions: new Map(),
      componentEventMap: new Map(),
      timestamp: Date.now()
    };
  }

  /**
   * Generate unique callback ID
   */
  private generateCallbackId(): string {
    return `callback_${++this.callbackIdCounter}_${Date.now()}`;
  }

  /**
   * Clear current snapshot and callback registry
   */
  cleanup(): void {
    this.currentSnapshot = null;
    this.callbackRegistry.clear();
    this.callbackIdCounter = 0;
  }

  /**
   * Get current snapshot (for debugging)
   */
  getCurrentSnapshot(): StateSnapshot | null {
    return this.currentSnapshot;
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<StatePreservationConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}