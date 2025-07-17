/**
 * Framework Hot Reload Adapter Interface
 * 
 * This interface defines the contract for framework-specific hot reload adapters
 * that handle native framework component hot reload with Metamon adapter preservation.
 */

export interface MetamonConnection {
  type: 'signal' | 'pubsub' | 'event';
  key: string;
  value?: any;
  subscriptions?: string[];
}

export interface ComponentStateSnapshot {
  componentId: string;
  frameworkType: string;
  localState: any;
  props: any;
  metamonConnections: MetamonConnection[];
}

/**
 * Framework Hot Reload Adapter interface
 */
export interface FrameworkHotReloadAdapter {
  /** Framework name (react, vue, svelte, solid) */
  readonly frameworkName: string;
  
  /** File extensions this adapter handles */
  readonly fileExtensions: string[];
  
  /**
   * Handle component reload for this framework
   * @param componentPath - Path to the component file
   * @returns Promise that resolves when reload is complete
   */
  handleComponentReload(componentPath: string): Promise<void>;
  
  /**
   * Preserve framework-specific state before reload
   * @param componentId - Unique identifier for the component
   * @returns Framework-specific state data
   */
  preserveFrameworkState(componentId: string): any;
  
  /**
   * Restore framework-specific state after reload
   * @param componentId - Unique identifier for the component
   * @param state - Previously preserved state data
   */
  restoreFrameworkState(componentId: string, state: any): void;
  
  /**
   * Reconnect Metamon adapters after component reload
   * Ensures signal and pub/sub connections are maintained
   */
  reconnectMetamonAdapters(): void;
  
  /**
   * Validate that adapter connections are working correctly
   * @returns true if all connections are valid, false otherwise
   */
  validateAdapterConnections(): boolean;
  
  /**
   * Get component state snapshot for preservation
   * @param componentId - Unique identifier for the component
   * @returns Complete state snapshot including Metamon connections
   */
  getComponentStateSnapshot(componentId: string): ComponentStateSnapshot | null;
  
  /**
   * Restore component from state snapshot
   * @param snapshot - Previously captured state snapshot
   */
  restoreFromSnapshot(snapshot: ComponentStateSnapshot): void;
  
  /**
   * Check if a file path is handled by this adapter
   * @param filePath - Path to check
   * @returns true if this adapter handles the file type
   */
  canHandle(filePath: string): boolean;
}

/**
 * Base implementation with common functionality
 */
export abstract class BaseFrameworkHotReloadAdapter implements FrameworkHotReloadAdapter {
  abstract readonly frameworkName: string;
  abstract readonly fileExtensions: string[];
  
  protected componentStates = new Map<string, any>();
  protected metamonConnections = new Map<string, MetamonConnection[]>();
  
  /**
   * Check if a file path is handled by this adapter
   */
  canHandle(filePath: string): boolean {
    return this.fileExtensions.some(ext => filePath.endsWith(ext));
  }
  
  /**
   * Get component ID from file path
   */
  protected getComponentId(filePath: string): string {
    return filePath.replace(/[^a-zA-Z0-9]/g, '_');
  }
  
  /**
   * Store component state for later restoration
   */
  protected storeComponentState(componentId: string, state: any): void {
    this.componentStates.set(componentId, state);
  }
  
  /**
   * Retrieve stored component state
   */
  protected getStoredComponentState(componentId: string): any {
    return this.componentStates.get(componentId);
  }
  
  /**
   * Store Metamon connections for a component
   */
  protected storeMetamonConnections(componentId: string, connections: MetamonConnection[]): void {
    this.metamonConnections.set(componentId, connections);
  }
  
  /**
   * Get stored Metamon connections for a component
   */
  protected getStoredMetamonConnections(componentId: string): MetamonConnection[] {
    return this.metamonConnections.get(componentId) || [];
  }
  
  /**
   * Extract Metamon connections from component
   * This is a base implementation that can be overridden by specific adapters
   */
  protected extractMetamonConnections(componentId: string): MetamonConnection[] {
    const connections: MetamonConnection[] = [];
    
    // Extract signal connections
    const signalConnections = this.extractSignalConnections(componentId);
    connections.push(...signalConnections);
    
    // Extract pub/sub connections
    const pubSubConnections = this.extractPubSubConnections(componentId);
    connections.push(...pubSubConnections);
    
    return connections;
  }

  /**
   * Extract signal connections for a component
   */
  protected extractSignalConnections(componentId: string): MetamonConnection[] {
    const connections: MetamonConnection[] = [];
    
    // This would be implemented by accessing the actual signal manager
    // For now, we'll create placeholder connections based on common patterns
    
    // Check if component has signal subscriptions (this would be framework-specific)
    const signalKeys = this.getComponentSignalKeys(componentId);
    
    for (const key of signalKeys) {
      connections.push({
        type: 'signal',
        key,
        value: undefined, // Would be populated from actual signal
        subscriptions: [componentId]
      });
    }
    
    return connections;
  }

  /**
   * Extract pub/sub connections for a component
   */
  protected extractPubSubConnections(componentId: string): MetamonConnection[] {
    const connections: MetamonConnection[] = [];
    
    // This would be implemented by accessing the actual pub/sub system
    // For now, we'll create placeholder connections based on common patterns
    
    // Check if component has event subscriptions (this would be framework-specific)
    const eventKeys = this.getComponentEventKeys(componentId);
    
    for (const key of eventKeys) {
      connections.push({
        type: 'pubsub',
        key,
        subscriptions: [componentId]
      });
    }
    
    return connections;
  }

  /**
   * Get signal keys that a component is subscribed to
   * This should be overridden by specific framework adapters
   */
  protected getComponentSignalKeys(componentId: string): string[] {
    // Default implementation - would be overridden by specific adapters
    return [];
  }

  /**
   * Get event keys that a component is subscribed to
   * This should be overridden by specific framework adapters
   */
  protected getComponentEventKeys(componentId: string): string[] {
    // Default implementation - would be overridden by specific adapters
    return [];
  }
  
  /**
   * Restore Metamon connections for a component
   */
  protected restoreMetamonConnections(componentId: string, connections: MetamonConnection[]): void {
    // This would be implemented by accessing the actual signal manager and pub/sub system
    // For now, this is a placeholder
    
    connections.forEach(connection => {
      switch (connection.type) {
        case 'signal':
          // Restore signal connection
          break;
        case 'pubsub':
          // Restore pub/sub subscription
          break;
        case 'event':
          // Restore event listener
          break;
      }
    });
  }
  
  // Abstract methods that must be implemented by specific adapters
  abstract handleComponentReload(componentPath: string): Promise<void>;
  abstract preserveFrameworkState(componentId: string): any;
  abstract restoreFrameworkState(componentId: string, state: any): void;
  abstract reconnectMetamonAdapters(): void;
  abstract validateAdapterConnections(): boolean;
  
  /**
   * Default implementation of getComponentStateSnapshot
   */
  getComponentStateSnapshot(componentId: string): ComponentStateSnapshot | null {
    const localState = this.preserveFrameworkState(componentId);
    const metamonConnections = this.extractMetamonConnections(componentId);
    
    if (!localState && metamonConnections.length === 0) {
      return null;
    }
    
    return {
      componentId,
      frameworkType: this.frameworkName,
      localState,
      props: {}, // This would be extracted from the actual component
      metamonConnections
    };
  }
  
  /**
   * Default implementation of restoreFromSnapshot
   */
  restoreFromSnapshot(snapshot: ComponentStateSnapshot): void {
    if (snapshot.frameworkType !== this.frameworkName) {
      throw new Error(`Cannot restore ${snapshot.frameworkType} snapshot with ${this.frameworkName} adapter`);
    }
    
    // Restore framework-specific state
    if (snapshot.localState) {
      this.restoreFrameworkState(snapshot.componentId, snapshot.localState);
    }
    
    // Restore Metamon connections
    if (snapshot.metamonConnections.length > 0) {
      this.restoreMetamonConnections(snapshot.componentId, snapshot.metamonConnections);
    }
  }
}