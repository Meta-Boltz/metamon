/**
 * Framework Hot Reload Manager
 * 
 * Coordinates framework-specific hot reload adapters and integrates them with
 * the main hot reload orchestrator. Handles native framework component hot reload
 * with Metamon adapter preservation.
 */

import { FrameworkHotReloadAdapter, ComponentStateSnapshot } from './framework-hot-reload-adapter.js';
import { ReactHotReloadAdapter } from './adapters/react-hot-reload-adapter.js';
import { VueHotReloadAdapter } from './adapters/vue-hot-reload-adapter.js';
import { SvelteHotReloadAdapter } from './adapters/svelte-hot-reload-adapter.js';
import { SolidHotReloadAdapter } from './adapters/solid-hot-reload-adapter.js';

export interface FrameworkHotReloadConfig {
  /** Enable React component hot reload */
  enableReact: boolean;
  /** Enable Vue component hot reload */
  enableVue: boolean;
  /** Enable Svelte component hot reload */
  enableSvelte: boolean;
  /** Enable Solid component hot reload */
  enableSolid: boolean;
  /** Preserve framework-specific state during reload */
  preserveFrameworkState: boolean;
  /** Preserve Metamon adapter connections */
  preserveMetamonConnections: boolean;
  /** Debug logging for framework hot reload */
  debugLogging: boolean;
}

export interface FrameworkReloadResult {
  success: boolean;
  frameworkName: string;
  filePath: string;
  duration: number;
  error?: string;
  statePreserved: boolean;
  connectionsRestored: boolean;
}

/**
 * Framework Hot Reload Manager
 */
export class FrameworkHotReloadManager {
  private adapters: Map<string, FrameworkHotReloadAdapter> = new Map();
  private config: FrameworkHotReloadConfig;
  private componentSnapshots = new Map<string, ComponentStateSnapshot>();
  
  constructor(config: Partial<FrameworkHotReloadConfig> = {}) {
    this.config = {
      enableReact: true,
      enableVue: true,
      enableSvelte: true,
      enableSolid: true,
      preserveFrameworkState: true,
      preserveMetamonConnections: true,
      debugLogging: false,
      ...config
    };
    
    this.initializeAdapters();
  }
  
  /**
   * Initialize framework adapters based on configuration
   */
  private initializeAdapters(): void {
    if (this.config.enableReact) {
      this.adapters.set('react', new ReactHotReloadAdapter());
    }
    
    if (this.config.enableVue) {
      this.adapters.set('vue', new VueHotReloadAdapter());
    }
    
    if (this.config.enableSvelte) {
      this.adapters.set('svelte', new SvelteHotReloadAdapter());
    }
    
    if (this.config.enableSolid) {
      this.adapters.set('solid', new SolidHotReloadAdapter());
    }
    
    if (this.config.debugLogging) {
      console.log('[FrameworkHotReload] Initialized adapters:', Array.from(this.adapters.keys()));
    }
  }
  
  /**
   * Handle hot reload for a native framework component
   */
  async handleFrameworkComponentReload(filePath: string): Promise<FrameworkReloadResult> {
    const startTime = Date.now();
    
    try {
      // Find the appropriate adapter for this file
      const adapter = this.findAdapterForFile(filePath);
      if (!adapter) {
        return {
          success: false,
          frameworkName: 'unknown',
          filePath,
          duration: Date.now() - startTime,
          error: 'No adapter found for file type',
          statePreserved: false,
          connectionsRestored: false
        };
      }
      
      if (this.config.debugLogging) {
        console.log(`[FrameworkHotReload] Handling ${adapter.frameworkName} component reload: ${filePath}`);
      }
      
      let statePreserved = false;
      let connectionsRestored = false;
      
      // Step 1: Create component state snapshot if preservation is enabled
      if (this.config.preserveFrameworkState || this.config.preserveMetamonConnections) {
        const componentId = this.getComponentId(filePath);
        const snapshot = adapter.getComponentStateSnapshot(componentId);
        
        if (snapshot) {
          this.componentSnapshots.set(componentId, snapshot);
          statePreserved = true;
          
          if (this.config.debugLogging) {
            console.log(`[FrameworkHotReload] Created state snapshot for ${componentId}`);
          }
        }
      }
      
      // Step 2: Perform the framework-specific hot reload
      await adapter.handleComponentReload(filePath);
      
      // Step 3: Restore state from snapshot if available
      if (statePreserved) {
        const componentId = this.getComponentId(filePath);
        const snapshot = this.componentSnapshots.get(componentId);
        
        if (snapshot) {
          adapter.restoreFromSnapshot(snapshot);
          connectionsRestored = adapter.validateAdapterConnections();
          
          if (this.config.debugLogging) {
            console.log(`[FrameworkHotReload] Restored state for ${componentId}, connections valid: ${connectionsRestored}`);
          }
        }
      }
      
      const duration = Date.now() - startTime;
      
      if (this.config.debugLogging) {
        console.log(`[FrameworkHotReload] Successfully reloaded ${adapter.frameworkName} component in ${duration}ms`);
      }
      
      return {
        success: true,
        frameworkName: adapter.frameworkName,
        filePath,
        duration,
        statePreserved,
        connectionsRestored
      };
      
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown framework reload error';
      
      if (this.config.debugLogging) {
        console.error(`[FrameworkHotReload] Failed to reload framework component ${filePath}:`, error);
      }
      
      return {
        success: false,
        frameworkName: 'unknown',
        filePath,
        duration,
        error: errorMessage,
        statePreserved: false,
        connectionsRestored: false
      };
    }
  }
  
  /**
   * Check if a file can be handled by any framework adapter
   */
  canHandleFile(filePath: string): boolean {
    return Array.from(this.adapters.values()).some(adapter => adapter.canHandle(filePath));
  }
  
  /**
   * Get the framework name for a file
   */
  getFrameworkForFile(filePath: string): string | null {
    const adapter = this.findAdapterForFile(filePath);
    return adapter ? adapter.frameworkName : null;
  }
  
  /**
   * Find the appropriate adapter for a file
   */
  private findAdapterForFile(filePath: string): FrameworkHotReloadAdapter | null {
    for (const adapter of this.adapters.values()) {
      if (adapter.canHandle(filePath)) {
        return adapter;
      }
    }
    return null;
  }
  
  /**
   * Get component ID from file path
   */
  private getComponentId(filePath: string): string {
    return filePath.replace(/[^a-zA-Z0-9]/g, '_');
  }
  
  /**
   * Reconnect all Metamon adapters across all frameworks
   */
  async reconnectAllMetamonAdapters(): Promise<void> {
    try {
      const reconnectPromises = Array.from(this.adapters.values()).map(adapter => {
        return new Promise<void>((resolve) => {
          try {
            adapter.reconnectMetamonAdapters();
            resolve();
          } catch (error) {
            if (this.config.debugLogging) {
              console.error(`[FrameworkHotReload] Failed to reconnect ${adapter.frameworkName} adapters:`, error);
            }
            resolve(); // Don't fail the entire operation
          }
        });
      });
      
      await Promise.all(reconnectPromises);
      
      if (this.config.debugLogging) {
        console.log('[FrameworkHotReload] Reconnected all Metamon adapters');
      }
      
    } catch (error) {
      console.error('[FrameworkHotReload] Error during adapter reconnection:', error);
    }
  }
  
  /**
   * Validate all adapter connections across all frameworks
   */
  validateAllAdapterConnections(): boolean {
    try {
      let allValid = true;
      
      for (const adapter of this.adapters.values()) {
        const isValid = adapter.validateAdapterConnections();
        if (!isValid) {
          allValid = false;
          if (this.config.debugLogging) {
            console.warn(`[FrameworkHotReload] Invalid connections detected in ${adapter.frameworkName} adapter`);
          }
        }
      }
      
      return allValid;
      
    } catch (error) {
      console.error('[FrameworkHotReload] Error validating adapter connections:', error);
      return false;
    }
  }
  
  /**
   * Get statistics about framework hot reload operations
   */
  getStats(): {
    enabledFrameworks: string[];
    totalSnapshots: number;
    adapterCount: number;
  } {
    return {
      enabledFrameworks: Array.from(this.adapters.keys()),
      totalSnapshots: this.componentSnapshots.size,
      adapterCount: this.adapters.size
    };
  }
  
  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<FrameworkHotReloadConfig>): void {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...newConfig };
    
    // Reinitialize adapters if framework enablement changed
    const frameworksChanged = (
      oldConfig.enableReact !== this.config.enableReact ||
      oldConfig.enableVue !== this.config.enableVue ||
      oldConfig.enableSvelte !== this.config.enableSvelte ||
      oldConfig.enableSolid !== this.config.enableSolid
    );
    
    if (frameworksChanged) {
      this.adapters.clear();
      this.initializeAdapters();
    }
  }
  
  /**
   * Get current configuration
   */
  getConfig(): FrameworkHotReloadConfig {
    return { ...this.config };
  }
  
  /**
   * Get a specific framework adapter
   */
  getAdapter(frameworkName: string): FrameworkHotReloadAdapter | undefined {
    return this.adapters.get(frameworkName);
  }
  
  /**
   * Get all available adapters
   */
  getAllAdapters(): FrameworkHotReloadAdapter[] {
    return Array.from(this.adapters.values());
  }
  
  /**
   * Clear all component snapshots
   */
  clearSnapshots(): void {
    this.componentSnapshots.clear();
    
    if (this.config.debugLogging) {
      console.log('[FrameworkHotReload] Cleared all component snapshots');
    }
  }
  
  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.componentSnapshots.clear();
    this.adapters.clear();
    
    if (this.config.debugLogging) {
      console.log('[FrameworkHotReload] Cleaned up framework hot reload manager');
    }
  }
}