/**
 * Solid Hot Reload Adapter
 * 
 * Handles hot reload for Solid components (.jsx, .tsx with Solid) with Metamon adapter preservation.
 * Integrates with Solid's built-in hot reload capabilities while preserving cross-framework state.
 */

import { BaseFrameworkHotReloadAdapter, MetamonConnection } from '../framework-hot-reload-adapter.js';

interface SolidComponentState {
  signals: Record<string, any>;
  stores: Record<string, any>;
  effects: any[];
  memos: Record<string, any>;
  resources: Record<string, any>;
  context: any;
}

interface SolidSignalState {
  type: 'signal' | 'store' | 'resource' | 'memo';
  key: string;
  value: any;
  dependencies?: string[];
}

/**
 * Solid-specific hot reload adapter
 */
export class SolidHotReloadAdapter extends BaseFrameworkHotReloadAdapter {
  readonly frameworkName = 'solid';
  readonly fileExtensions = ['.jsx', '.tsx']; // Note: Solid uses JSX/TSX files
  
  private solidComponentStates = new Map<string, SolidComponentState>();
  private solidSignalStates = new Map<string, SolidSignalState[]>();
  
  /**
   * Handle Solid component reload
   */
  async handleComponentReload(componentPath: string): Promise<void> {
    const componentId = this.getComponentId(componentPath);
    
    try {
      // Step 1: Preserve Solid component state
      const solidState = this.preserveFrameworkState(componentId);
      
      // Step 2: Preserve Metamon connections
      const metamonConnections = this.extractMetamonConnections(componentId);
      this.storeMetamonConnections(componentId, metamonConnections);
      
      // Step 3: Trigger Solid's hot reload mechanism
      await this.triggerSolidHotReload(componentPath);
      
      // Step 4: Restore Solid component state
      if (solidState) {
        this.restoreFrameworkState(componentId, solidState);
      }
      
      // Step 5: Reconnect Metamon adapters
      this.reconnectMetamonAdapters();
      
      // Step 6: Validate connections
      const isValid = this.validateAdapterConnections();
      if (!isValid) {
        console.warn(`[SolidHotReload] Some adapter connections may not have been restored properly for ${componentPath}`);
      }
      
    } catch (error) {
      console.error(`[SolidHotReload] Failed to reload Solid component ${componentPath}:`, error);
      throw error;
    }
  }
  
  /**
   * Preserve Solid-specific state
   */
  preserveFrameworkState(componentId: string): SolidComponentState | null {
    try {
      // In a real implementation, this would access Solid's internal reactive system
      // to extract signals, stores, effects, etc.
      
      const existingState = this.getStoredComponentState(componentId);
      if (existingState) {
        return existingState;
      }
      
      // Simulate extracting Solid component state
      const solidState: SolidComponentState = {
        signals: this.extractSolidSignals(componentId),
        stores: this.extractSolidStores(componentId),
        effects: this.extractSolidEffects(componentId),
        memos: this.extractSolidMemos(componentId),
        resources: this.extractSolidResources(componentId),
        context: this.extractSolidContext(componentId)
      };
      
      // Store for later restoration
      this.storeComponentState(componentId, solidState);
      this.solidComponentStates.set(componentId, solidState);
      
      return solidState;
      
    } catch (error) {
      console.error(`[SolidHotReload] Failed to preserve Solid state for ${componentId}:`, error);
      return null;
    }
  }
  
  /**
   * Restore Solid-specific state
   */
  restoreFrameworkState(componentId: string, state: SolidComponentState): void {
    try {
      if (!state) return;
      
      // In a real implementation, this would restore state to Solid's reactive system
      this.solidComponentStates.set(componentId, state);
      
      // Restore signals
      if (state.signals) {
        this.restoreSolidSignals(componentId, state.signals);
      }
      
      // Restore stores
      if (state.stores) {
        this.restoreSolidStores(componentId, state.stores);
      }
      
      // Restore effects
      if (state.effects && state.effects.length > 0) {
        this.restoreSolidEffects(componentId, state.effects);
      }
      
      // Restore memos
      if (state.memos) {
        this.restoreSolidMemos(componentId, state.memos);
      }
      
      // Restore resources
      if (state.resources) {
        this.restoreSolidResources(componentId, state.resources);
      }
      
      // Restore context
      if (state.context) {
        this.restoreSolidContext(componentId, state.context);
      }
      
    } catch (error) {
      console.error(`[SolidHotReload] Failed to restore Solid state for ${componentId}:`, error);
    }
  }
  
  /**
   * Reconnect Metamon adapters after Solid component reload
   */
  reconnectMetamonAdapters(): void {
    try {
      // Get all stored Metamon connections
      for (const [componentId, connections] of this.metamonConnections.entries()) {
        this.restoreMetamonConnections(componentId, connections);
      }
      
      // Trigger re-subscription for Solid signals that use Metamon signals
      this.resubscribeMetamonSignals();
      
    } catch (error) {
      console.error('[SolidHotReload] Failed to reconnect Metamon adapters:', error);
    }
  }
  
  /**
   * Validate that adapter connections are working
   */
  validateAdapterConnections(): boolean {
    try {
      let allValid = true;
      
      // Check each component's Metamon connections
      for (const [componentId, connections] of this.metamonConnections.entries()) {
        for (const connection of connections) {
          if (!this.validateConnection(connection)) {
            console.warn(`[SolidHotReload] Invalid connection for ${componentId}:`, connection);
            allValid = false;
          }
        }
      }
      
      return allValid;
      
    } catch (error) {
      console.error('[SolidHotReload] Error validating adapter connections:', error);
      return false;
    }
  }
  
  /**
   * Extract Metamon connections from Solid component
   */
  protected extractMetamonConnections(componentId: string): MetamonConnection[] {
    const connections: MetamonConnection[] = [];
    
    try {
      // In a real implementation, this would scan the component for:
      // - useSignal calls
      // - useMetamonSignal calls
      // - createMetamonSignal calls
      // - usePubSub calls
      // - useEmitter calls
      
      // For now, return a simulated set of connections
      // This would be replaced with actual Solid component inspection
      
      return connections;
      
    } catch (error) {
      console.error(`[SolidHotReload] Failed to extract Metamon connections for ${componentId}:`, error);
      return [];
    }
  }
  
  /**
   * Trigger Solid's hot reload mechanism
   */
  private async triggerSolidHotReload(componentPath: string): Promise<void> {
    // In a real implementation, this would integrate with Solid's HMR system
    // (solid-refresh or similar)
    
    console.log(`[SolidHotReload] Triggering Solid hot reload for ${componentPath}`);
  }
  
  /**
   * Extract Solid signals
   */
  private extractSolidSignals(componentId: string): Record<string, any> {
    // In a real implementation, this would access Solid signals
    // For now, return empty object as placeholder
    return {};
  }
  
  /**
   * Extract Solid stores
   */
  private extractSolidStores(componentId: string): Record<string, any> {
    // In a real implementation, this would access Solid stores
    // For now, return empty object as placeholder
    return {};
  }
  
  /**
   * Extract Solid effects
   */
  private extractSolidEffects(componentId: string): any[] {
    // In a real implementation, this would access Solid effects
    // For now, return empty array as placeholder
    return [];
  }
  
  /**
   * Extract Solid memos
   */
  private extractSolidMemos(componentId: string): Record<string, any> {
    // In a real implementation, this would access Solid memos
    // For now, return empty object as placeholder
    return {};
  }
  
  /**
   * Extract Solid resources
   */
  private extractSolidResources(componentId: string): Record<string, any> {
    // In a real implementation, this would access Solid resources
    // For now, return empty object as placeholder
    return {};
  }
  
  /**
   * Extract Solid context
   */
  private extractSolidContext(componentId: string): any {
    // In a real implementation, this would access Solid context
    // For now, return null as placeholder
    return null;
  }
  
  /**
   * Restore Solid signals
   */
  private restoreSolidSignals(componentId: string, signals: Record<string, any>): void {
    // In a real implementation, this would restore Solid signals
    // For now, this is a placeholder
  }
  
  /**
   * Restore Solid stores
   */
  private restoreSolidStores(componentId: string, stores: Record<string, any>): void {
    // In a real implementation, this would restore Solid stores
    // For now, this is a placeholder
  }
  
  /**
   * Restore Solid effects
   */
  private restoreSolidEffects(componentId: string, effects: any[]): void {
    // In a real implementation, this would restore Solid effects
    // For now, this is a placeholder
  }
  
  /**
   * Restore Solid memos
   */
  private restoreSolidMemos(componentId: string, memos: Record<string, any>): void {
    // In a real implementation, this would restore Solid memos
    // For now, this is a placeholder
  }
  
  /**
   * Restore Solid resources
   */
  private restoreSolidResources(componentId: string, resources: Record<string, any>): void {
    // In a real implementation, this would restore Solid resources
    // For now, this is a placeholder
  }
  
  /**
   * Restore Solid context
   */
  private restoreSolidContext(componentId: string, context: any): void {
    // In a real implementation, this would restore Solid context
    // For now, this is a placeholder
  }
  
  /**
   * Re-subscribe Metamon signals after hot reload
   */
  private resubscribeMetamonSignals(): void {
    // In a real implementation, this would trigger re-subscription
    // for useSignal, usePubSub, and other Metamon signals
    // For now, this is a placeholder
  }
  
  /**
   * Validate a single Metamon connection
   */
  private validateConnection(connection: MetamonConnection): boolean {
    // In a real implementation, this would check if the connection is still active
    // For now, return true as placeholder
    return true;
  }
  
  /**
   * Check if this is a Solid component (vs React)
   * Since both use .jsx/.tsx, we need to distinguish them
   */
  canHandle(filePath: string): boolean {
    // In a real implementation, this would check for Solid-specific imports
    // or configuration to distinguish from React components
    // For now, we'll use a simple heuristic
    
    if (!super.canHandle(filePath)) {
      return false;
    }
    
    // This would be enhanced to actually detect Solid vs React
    // by checking imports, configuration, or file content
    return this.isSolidComponent(filePath);
  }
  
  /**
   * Determine if a file is a Solid component
   */
  private isSolidComponent(filePath: string): boolean {
    // In a real implementation, this would:
    // 1. Check for solid-js imports
    // 2. Check build configuration
    // 3. Check file content for Solid-specific patterns
    
    // For now, return false as placeholder - this would be implemented
    // when integrating with the actual build system
    return false;
  }
  
  /**
   * Get Solid component state for external access
   */
  getSolidComponentState(componentId: string): SolidComponentState | undefined {
    return this.solidComponentStates.get(componentId);
  }
  
  /**
   * Get Solid signal states for external access
   */
  getSolidSignalStates(componentId: string): SolidSignalState[] {
    return this.solidSignalStates.get(componentId) || [];
  }
}