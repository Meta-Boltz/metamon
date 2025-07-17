/**
 * Cross-Framework Synchronizer
 * 
 * Handles synchronization of cross-framework communication during hot reload.
 * Ensures that signal connections and pub/sub subscriptions are maintained
 * across framework boundaries when components are reloaded.
 */

import type { MetamonSignalManager, MetamonPubSub } from '@metamon/core';
import type { Signal } from '@metamon/core';

export interface CrossFrameworkConnection {
  type: 'signal' | 'pubsub';
  key: string;
  sourceFramework: string;
  targetFramework: string;
  componentId: string;
  subscriptionData?: any;
}

export interface FrameworkSyncSnapshot {
  connections: CrossFrameworkConnection[];
  signalValues: Map<string, any>;
  subscriptions: Map<string, SubscriptionInfo[]>;
  timestamp: number;
}

export interface SubscriptionInfo {
  event: string;
  componentId: string;
  framework: string;
  callback: Function;
}

export interface CrossFrameworkSyncConfig {
  /** Enable signal connection validation */
  validateSignalConnections: boolean;
  /** Enable pub/sub subscription restoration */
  restoreSubscriptions: boolean;
  /** Timeout for sync operations in milliseconds */
  syncTimeout: number;
  /** Enable debug logging */
  debugLogging: boolean;
  /** Maximum retry attempts for failed connections */
  maxRetryAttempts: number;
  /** Delay between retry attempts in milliseconds */
  retryDelay: number;
}

/**
 * Cross-Framework Synchronizer implementation
 */
export class CrossFrameworkSynchronizer {
  private config: CrossFrameworkSyncConfig;
  private activeConnections = new Map<string, CrossFrameworkConnection>();
  private frameworkComponents = new Map<string, Set<string>>(); // framework -> component IDs
  private signalManager?: MetamonSignalManager;
  private pubSubSystem?: MetamonPubSub;

  constructor(config: Partial<CrossFrameworkSyncConfig> = {}) {
    this.config = {
      validateSignalConnections: true,
      restoreSubscriptions: true,
      syncTimeout: 5000,
      debugLogging: false,
      maxRetryAttempts: 3,
      retryDelay: 1000,
      ...config
    };
  }

  /**
   * Initialize with signal manager and pub/sub system
   */
  initialize(signalManager: MetamonSignalManager, pubSubSystem: MetamonPubSub): void {
    this.signalManager = signalManager;
    this.pubSubSystem = pubSubSystem;

    if (this.config.debugLogging) {
      console.log('[CrossFrameworkSync] Initialized with signal manager and pub/sub system');
    }
  }

  /**
   * Register a framework component for tracking
   */
  registerFrameworkComponent(framework: string, componentId: string): void {
    if (!this.frameworkComponents.has(framework)) {
      this.frameworkComponents.set(framework, new Set());
    }
    
    this.frameworkComponents.get(framework)!.add(componentId);

    if (this.config.debugLogging) {
      console.log(`[CrossFrameworkSync] Registered ${framework} component: ${componentId}`);
    }
  }

  /**
   * Unregister a framework component
   */
  unregisterFrameworkComponent(framework: string, componentId: string): void {
    const components = this.frameworkComponents.get(framework);
    if (components) {
      components.delete(componentId);
      
      if (components.size === 0) {
        this.frameworkComponents.delete(framework);
      }
    }

    // Clean up connections for this component
    this.cleanupComponentConnections(componentId);

    if (this.config.debugLogging) {
      console.log(`[CrossFrameworkSync] Unregistered ${framework} component: ${componentId}`);
    }
  }

  /**
   * Track a cross-framework connection
   */
  trackConnection(connection: CrossFrameworkConnection): void {
    const connectionKey = `${connection.type}:${connection.key}:${connection.componentId}`;
    this.activeConnections.set(connectionKey, connection);

    if (this.config.debugLogging) {
      console.log(`[CrossFrameworkSync] Tracking connection: ${connectionKey}`, connection);
    }
  }

  /**
   * Create a snapshot of current cross-framework state
   */
  createSyncSnapshot(): FrameworkSyncSnapshot {
    const connections = Array.from(this.activeConnections.values());
    const signalValues = new Map<string, any>();
    const subscriptions = new Map<string, SubscriptionInfo[]>();

    // Capture signal values
    if (this.signalManager) {
      const signalKeys = this.signalManager.getSignalKeys();
      for (const key of signalKeys) {
        const signal = this.signalManager.getSignal(key);
        if (signal) {
          signalValues.set(key, signal.value);
        }
      }
    }

    // Capture subscription information
    if (this.pubSubSystem) {
      const activeSubscriptions = this.pubSubSystem.getActiveSubscriptions();
      for (const sub of activeSubscriptions) {
        if (!subscriptions.has(sub.event)) {
          subscriptions.set(sub.event, []);
        }
        
        subscriptions.get(sub.event)!.push({
          event: sub.event,
          componentId: sub.componentId,
          framework: this.getFrameworkForComponent(sub.componentId),
          callback: sub.callback
        });
      }
    }

    const snapshot: FrameworkSyncSnapshot = {
      connections,
      signalValues,
      subscriptions,
      timestamp: Date.now()
    };

    if (this.config.debugLogging) {
      console.log('[CrossFrameworkSync] Created sync snapshot:', {
        connectionsCount: connections.length,
        signalCount: signalValues.size,
        subscriptionEvents: subscriptions.size
      });
    }

    return snapshot;
  }

  /**
   * Restore cross-framework state from snapshot
   */
  async restoreSyncSnapshot(snapshot: FrameworkSyncSnapshot): Promise<boolean> {
    if (!this.signalManager || !this.pubSubSystem) {
      console.error('[CrossFrameworkSync] Cannot restore snapshot: managers not initialized');
      return false;
    }

    try {
      let success = true;

      // Restore signal values
      if (this.config.validateSignalConnections) {
        const signalRestoreSuccess = await this.restoreSignalValues(snapshot.signalValues);
        success = success && signalRestoreSuccess;
      }

      // Restore subscriptions
      if (this.config.restoreSubscriptions) {
        const subscriptionRestoreSuccess = await this.restoreSubscriptions(snapshot.subscriptions);
        success = success && subscriptionRestoreSuccess;
      }

      // Restore connections
      const connectionRestoreSuccess = await this.restoreConnections(snapshot.connections);
      success = success && connectionRestoreSuccess;

      if (this.config.debugLogging) {
        console.log(`[CrossFrameworkSync] Snapshot restoration ${success ? 'successful' : 'failed'}`);
      }

      return success;

    } catch (error) {
      console.error('[CrossFrameworkSync] Error restoring sync snapshot:', error);
      return false;
    }
  }

  /**
   * Validate all signal connections
   */
  async validateSignalConnections(): Promise<boolean> {
    if (!this.signalManager) {
      return false;
    }

    try {
      const signalKeys = this.signalManager.getSignalKeys();
      let allValid = true;

      for (const key of signalKeys) {
        const signal = this.signalManager.getSignal(key);
        if (!signal) {
          console.warn(`[CrossFrameworkSync] Signal validation failed: signal "${key}" not found`);
          allValid = false;
          continue;
        }

        // Check if signal has active subscribers
        const hasSubscribers = this.hasActiveSignalSubscribers(key);
        if (!hasSubscribers) {
          if (this.config.debugLogging) {
            console.log(`[CrossFrameworkSync] Signal "${key}" has no active subscribers`);
          }
        }
      }

      if (this.config.debugLogging) {
        console.log(`[CrossFrameworkSync] Signal validation ${allValid ? 'passed' : 'failed'}`);
      }

      return allValid;

    } catch (error) {
      console.error('[CrossFrameworkSync] Error validating signal connections:', error);
      return false;
    }
  }

  /**
   * Reconnect all cross-framework connections
   */
  async reconnectAllConnections(): Promise<boolean> {
    try {
      const connections = Array.from(this.activeConnections.values());
      let successCount = 0;

      for (const connection of connections) {
        const success = await this.reconnectConnection(connection);
        if (success) {
          successCount++;
        }
      }

      const allSuccessful = successCount === connections.length;

      if (this.config.debugLogging) {
        console.log(`[CrossFrameworkSync] Reconnected ${successCount}/${connections.length} connections`);
      }

      return allSuccessful;

    } catch (error) {
      console.error('[CrossFrameworkSync] Error reconnecting connections:', error);
      return false;
    }
  }

  /**
   * Perform full cross-framework synchronization
   */
  async synchronizeFrameworks(): Promise<boolean> {
    if (this.config.debugLogging) {
      console.log('[CrossFrameworkSync] Starting cross-framework synchronization');
    }

    try {
      let success = true;

      // Step 1: Validate signal connections
      if (this.config.validateSignalConnections) {
        const signalValidation = await this.validateSignalConnections();
        success = success && signalValidation;
      }

      // Step 2: Reconnect all connections
      const reconnectionSuccess = await this.reconnectAllConnections();
      success = success && reconnectionSuccess;

      // Step 3: Validate pub/sub subscriptions
      if (this.config.restoreSubscriptions) {
        const subscriptionValidation = await this.validateSubscriptions();
        success = success && subscriptionValidation;
      }

      if (this.config.debugLogging) {
        console.log(`[CrossFrameworkSync] Synchronization ${success ? 'completed successfully' : 'completed with errors'}`);
      }

      return success;

    } catch (error) {
      console.error('[CrossFrameworkSync] Error during framework synchronization:', error);
      return false;
    }
  }

  /**
   * Restore signal values from snapshot
   */
  private async restoreSignalValues(signalValues: Map<string, any>): Promise<boolean> {
    if (!this.signalManager) {
      return false;
    }

    try {
      let successCount = 0;

      for (const [key, value] of signalValues) {
        try {
          let signal = this.signalManager.getSignal(key);
          
          // Create signal if it doesn't exist
          if (!signal) {
            signal = this.signalManager.createSignal(value, key);
          } else {
            // Update existing signal
            signal.update(value);
          }
          
          successCount++;

        } catch (error) {
          console.error(`[CrossFrameworkSync] Failed to restore signal "${key}":`, error);
        }
      }

      const success = successCount === signalValues.size;

      if (this.config.debugLogging) {
        console.log(`[CrossFrameworkSync] Restored ${successCount}/${signalValues.size} signal values`);
      }

      return success;

    } catch (error) {
      console.error('[CrossFrameworkSync] Error restoring signal values:', error);
      return false;
    }
  }

  /**
   * Restore subscriptions from snapshot
   */
  private async restoreSubscriptions(subscriptions: Map<string, SubscriptionInfo[]>): Promise<boolean> {
    if (!this.pubSubSystem) {
      return false;
    }

    try {
      let successCount = 0;
      let totalSubscriptions = 0;

      for (const [event, subs] of subscriptions) {
        for (const sub of subs) {
          totalSubscriptions++;
          
          try {
            // Re-subscribe the component to the event
            this.pubSubSystem.subscribe(event, sub.callback, sub.componentId);
            successCount++;

          } catch (error) {
            console.error(`[CrossFrameworkSync] Failed to restore subscription for event "${event}":`, error);
          }
        }
      }

      const success = successCount === totalSubscriptions;

      if (this.config.debugLogging) {
        console.log(`[CrossFrameworkSync] Restored ${successCount}/${totalSubscriptions} subscriptions`);
      }

      return success;

    } catch (error) {
      console.error('[CrossFrameworkSync] Error restoring subscriptions:', error);
      return false;
    }
  }

  /**
   * Restore connections from snapshot
   */
  private async restoreConnections(connections: CrossFrameworkConnection[]): Promise<boolean> {
    try {
      let successCount = 0;

      for (const connection of connections) {
        const success = await this.reconnectConnection(connection);
        if (success) {
          successCount++;
          this.trackConnection(connection);
        }
      }

      const allSuccessful = successCount === connections.length;

      if (this.config.debugLogging) {
        console.log(`[CrossFrameworkSync] Restored ${successCount}/${connections.length} connections`);
      }

      return allSuccessful;

    } catch (error) {
      console.error('[CrossFrameworkSync] Error restoring connections:', error);
      return false;
    }
  }

  /**
   * Reconnect a single connection with retry logic
   */
  private async reconnectConnection(connection: CrossFrameworkConnection): Promise<boolean> {
    let attempts = 0;
    
    while (attempts < this.config.maxRetryAttempts) {
      try {
        switch (connection.type) {
          case 'signal':
            return await this.reconnectSignalConnection(connection);
          case 'pubsub':
            return await this.reconnectPubSubConnection(connection);
          default:
            console.warn(`[CrossFrameworkSync] Unknown connection type: ${connection.type}`);
            return false;
        }

      } catch (error) {
        attempts++;
        
        if (attempts >= this.config.maxRetryAttempts) {
          console.error(`[CrossFrameworkSync] Failed to reconnect connection after ${attempts} attempts:`, error);
          return false;
        }

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));
      }
    }

    return false;
  }

  /**
   * Reconnect a signal connection
   */
  private async reconnectSignalConnection(connection: CrossFrameworkConnection): Promise<boolean> {
    if (!this.signalManager) {
      return false;
    }

    try {
      // Ensure signal exists
      let signal = this.signalManager.getSignal(connection.key);
      if (!signal) {
        // Create signal if it doesn't exist
        signal = this.signalManager.createSignal(null, connection.key);
      }

      // Connection is considered successful if signal exists
      return signal !== undefined;

    } catch (error) {
      console.error(`[CrossFrameworkSync] Error reconnecting signal connection "${connection.key}":`, error);
      return false;
    }
  }

  /**
   * Reconnect a pub/sub connection
   */
  private async reconnectPubSubConnection(connection: CrossFrameworkConnection): Promise<boolean> {
    if (!this.pubSubSystem || !connection.subscriptionData) {
      return false;
    }

    try {
      // Re-establish subscription
      this.pubSubSystem.subscribe(
        connection.key,
        connection.subscriptionData.callback,
        connection.componentId
      );

      return true;

    } catch (error) {
      console.error(`[CrossFrameworkSync] Error reconnecting pub/sub connection "${connection.key}":`, error);
      return false;
    }
  }

  /**
   * Validate pub/sub subscriptions
   */
  private async validateSubscriptions(): Promise<boolean> {
    if (!this.pubSubSystem) {
      return false;
    }

    try {
      const activeSubscriptions = this.pubSubSystem.getActiveSubscriptions();
      let validCount = 0;

      for (const sub of activeSubscriptions) {
        // Check if component is still registered
        const framework = this.getFrameworkForComponent(sub.componentId);
        if (framework && this.frameworkComponents.get(framework)?.has(sub.componentId)) {
          validCount++;
        } else {
          if (this.config.debugLogging) {
            console.log(`[CrossFrameworkSync] Invalid subscription found for component: ${sub.componentId}`);
          }
        }
      }

      const allValid = validCount === activeSubscriptions.length;

      if (this.config.debugLogging) {
        console.log(`[CrossFrameworkSync] Subscription validation: ${validCount}/${activeSubscriptions.length} valid`);
      }

      return allValid;

    } catch (error) {
      console.error('[CrossFrameworkSync] Error validating subscriptions:', error);
      return false;
    }
  }

  /**
   * Check if a signal has active subscribers
   */
  private hasActiveSignalSubscribers(signalKey: string): boolean {
    // This would need to be implemented based on the actual signal implementation
    // For now, we'll assume signals with connections are active
    const connections = Array.from(this.activeConnections.values());
    return connections.some(conn => conn.type === 'signal' && conn.key === signalKey);
  }

  /**
   * Get framework for a component ID
   */
  private getFrameworkForComponent(componentId: string): string {
    for (const [framework, components] of this.frameworkComponents) {
      if (components.has(componentId)) {
        return framework;
      }
    }
    return 'unknown';
  }

  /**
   * Clean up connections for a component
   */
  private cleanupComponentConnections(componentId: string): void {
    const connectionsToRemove: string[] = [];

    for (const [key, connection] of this.activeConnections) {
      if (connection.componentId === componentId) {
        connectionsToRemove.push(key);
      }
    }

    for (const key of connectionsToRemove) {
      this.activeConnections.delete(key);
    }

    if (this.config.debugLogging && connectionsToRemove.length > 0) {
      console.log(`[CrossFrameworkSync] Cleaned up ${connectionsToRemove.length} connections for component: ${componentId}`);
    }
  }

  /**
   * Get synchronization statistics
   */
  getStats(): {
    activeConnections: number;
    registeredFrameworks: number;
    totalComponents: number;
  } {
    let totalComponents = 0;
    for (const components of this.frameworkComponents.values()) {
      totalComponents += components.size;
    }

    return {
      activeConnections: this.activeConnections.size,
      registeredFrameworks: this.frameworkComponents.size,
      totalComponents
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<CrossFrameworkSyncConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): CrossFrameworkSyncConfig {
    return { ...this.config };
  }

  /**
   * Cleanup all resources
   */
  cleanup(): void {
    this.activeConnections.clear();
    this.frameworkComponents.clear();
    this.signalManager = undefined;
    this.pubSubSystem = undefined;

    if (this.config.debugLogging) {
      console.log('[CrossFrameworkSync] Cleaned up all resources');
    }
  }
}