/**
 * Hot Reload Orchestrator - Central coordinator for all hot reload operations
 * 
 * This class manages the hot reload process for .mtm files and native framework components,
 * coordinating state preservation, cross-framework synchronization, and error handling.
 */

import type { StateSnapshot } from '../../dev-tools/src/types/state-preservation.js';
import { StatePreservationManager } from '../../dev-tools/src/state-preservation-manager.js';
import type { MetamonSignalManager, MetamonPubSub } from '@metamon/core';
import { ErrorOverlay } from './error-overlay.js';
import { ErrorRecoveryManager } from './error-recovery-manager.js';
import { ErrorCategorizer } from './error-categorizer.js';
import { HotReloadVisualFeedbackManager, type VisualFeedbackOptions } from './hot-reload-visual-feedback-manager.js';
import type { ReloadError, ErrorDisplayOptions, ErrorRecoveryOptions } from './types/error-handling.js';
import { FrameworkHotReloadManager, type FrameworkHotReloadConfig, type FrameworkReloadResult } from './framework-hot-reload-manager.js';
import { CrossFrameworkSynchronizer, type CrossFrameworkSyncConfig, type FrameworkSyncSnapshot } from './cross-framework-synchronizer.js';
import { FrontmatterHotReloadManager, type FrontmatterHotReloadConfig, type FrontmatterChangeResult, type ChannelSubscriptionUpdate } from './frontmatter-hot-reload-manager.js';
import { CSSHotReloadManager, type CSSHotReloadConfig, type CSSUpdateResult } from './css-hot-reload-manager.js';

export interface HotReloadConfig {
  /** Enable state preservation during hot reload */
  preserveState: boolean;
  /** Batch multiple file changes together */
  batchUpdates: boolean;
  /** Debounce time in milliseconds for batching updates */
  debounceMs: number;
  /** Enable cross-framework synchronization */
  syncFrameworks: boolean;
  /** Timeout for cross-framework sync operations */
  syncTimeout: number;
  /** Show error overlay for compilation errors */
  showErrorOverlay: boolean;
  /** Error recovery mode */
  errorRecoveryMode: 'graceful' | 'strict';
  /** Maximum number of concurrent reloads */
  maxConcurrentReloads: number;
  /** Timeout for reload operations */
  reloadTimeout: number;
  /** Enable debug logging */
  debugLogging: boolean;
  /** Error display options */
  errorDisplay?: Partial<ErrorDisplayOptions>;
  /** Error recovery options */
  errorRecovery?: Partial<ErrorRecoveryOptions>;
  /** Framework hot reload configuration */
  frameworkHotReload?: Partial<FrameworkHotReloadConfig>;
  /** Cross-framework synchronization configuration */
  crossFrameworkSync?: Partial<CrossFrameworkSyncConfig>;
  /** Visual feedback options */
  visualFeedback?: Partial<VisualFeedbackOptions>;
  /** Frontmatter hot reload configuration */
  frontmatterHotReload?: Partial<FrontmatterHotReloadConfig>;
  /** CSS hot reload configuration */
  cssHotReload?: Partial<CSSHotReloadConfig>;
}

export interface ReloadContext {
  filePath: string;
  changeType: 'mtm' | 'native' | 'dependency';
  timestamp: number;
  content?: string;
}

export interface ReloadResult {
  success: boolean;
  filePath: string;
  duration: number;
  error?: string;
  statePreserved: boolean;
  frameworksSynced: boolean;
}

/**
 * Hot Reload Orchestrator implementation
 */
export class HotReloadOrchestrator {
  private config: HotReloadConfig;
  private stateManager: StatePreservationManager;
  private frameworkHotReloadManager: FrameworkHotReloadManager;
  private crossFrameworkSynchronizer: CrossFrameworkSynchronizer;
  private errorOverlay: ErrorOverlay;
  private errorRecoveryManager: ErrorRecoveryManager;
  private errorCategorizer: ErrorCategorizer;
  private visualFeedbackManager: HotReloadVisualFeedbackManager;
  private frontmatterHotReloadManager: FrontmatterHotReloadManager;
  private cssHotReloadManager: CSSHotReloadManager;
  private pendingReloads: Map<string, NodeJS.Timeout> = new Map();
  private activeReloads: Set<string> = new Set();
  private reloadQueue: ReloadContext[] = [];
  private isProcessingQueue = false;
  private frameworkSyncSnapshot: FrameworkSyncSnapshot | null = null;

  constructor(
    config: Partial<HotReloadConfig> = {},
    stateManager?: StatePreservationManager
  ) {
    this.config = {
      preserveState: true,
      batchUpdates: true,
      debounceMs: 100,
      syncFrameworks: true,
      syncTimeout: 5000,
      showErrorOverlay: true,
      errorRecoveryMode: 'graceful',
      maxConcurrentReloads: 3,
      reloadTimeout: 10000,
      debugLogging: false,
      ...config
    };

    this.stateManager = stateManager || new StatePreservationManager({
      preserveSignals: this.config.preserveState,
      preserveSubscriptions: this.config.preserveState,
      preserveComponentState: this.config.preserveState,
      debugLogging: this.config.debugLogging
    });

    // Initialize framework hot reload manager
    this.frameworkHotReloadManager = new FrameworkHotReloadManager({
      preserveFrameworkState: this.config.preserveState,
      preserveMetamonConnections: this.config.preserveState,
      debugLogging: this.config.debugLogging,
      ...this.config.frameworkHotReload
    });

    // Initialize cross-framework synchronizer
    this.crossFrameworkSynchronizer = new CrossFrameworkSynchronizer({
      validateSignalConnections: this.config.syncFrameworks,
      restoreSubscriptions: this.config.syncFrameworks,
      syncTimeout: this.config.syncTimeout,
      debugLogging: this.config.debugLogging,
      maxRetryAttempts: 3,
      retryDelay: 1000,
      ...this.config.crossFrameworkSync
    });

    // Initialize error handling components
    this.errorOverlay = new ErrorOverlay({
      showOverlay: this.config.showErrorOverlay,
      showNotifications: true,
      autoHide: this.config.errorRecoveryMode === 'graceful',
      hideDelay: 5000,
      showStackTrace: this.config.debugLogging,
      showSuggestions: true,
      ...this.config.errorDisplay
    });

    this.errorRecoveryManager = new ErrorRecoveryManager({
      enableStateRollback: this.config.preserveState,
      maxRetryAttempts: 3,
      retryDelay: 1000,
      fallbackToLastGoodState: this.config.errorRecoveryMode === 'graceful',
      ...this.config.errorRecovery
    });

    this.errorCategorizer = new ErrorCategorizer();

    // Initialize visual feedback manager
    this.visualFeedbackManager = new HotReloadVisualFeedbackManager({
      showProgressIndicator: true,
      showNotifications: true,
      debugLogging: this.config.debugLogging,
      coordinatePositioning: true,
      ...this.config.visualFeedback
    });

    // Initialize frontmatter hot reload manager
    this.frontmatterHotReloadManager = new FrontmatterHotReloadManager({
      enableFrontmatterDetection: true,
      enableChannelUpdates: this.config.syncFrameworks,
      enableDependencyResolution: true,
      enableTargetFrameworkChanges: true,
      debugLogging: this.config.debugLogging,
      ...this.config.frontmatterHotReload
    });

    // Initialize CSS hot reload manager
    this.cssHotReloadManager = new CSSHotReloadManager({
      enableCSSHotReload: true,
      enableThemePropagation: true,
      enableFrameworkSpecificUpdates: true,
      injectionMethod: 'style-tag',
      themeVariablePrefix: '--',
      debugLogging: this.config.debugLogging,
      debounceMs: this.config.debounceMs,
      maxConcurrentUpdates: this.config.maxConcurrentReloads,
      ...this.config.cssHotReload
    });

    // Register recovery callbacks
    this.setupRecoveryCallbacks();
  }

  /**
   * Handle CSS file change
   */
  async handleCSSChange(
    filePath: string,
    changeType: 'css' | 'scss' | 'less' | 'stylus' | 'theme',
    content: string,
    affectedFrameworks: string[] = []
  ): Promise<void> {
    if (this.config.debugLogging) {
      console.log(`[HotReload] CSS change detected: ${filePath} (${changeType})`);
    }

    await this.cssHotReloadManager.handleCSSChange(filePath, changeType, content, affectedFrameworks);
  }

  /**
   * Handle file change with debouncing and batching
   */
  async handleFileChange(
    filePath: string, 
    changeType: 'mtm' | 'native' | 'dependency' | 'css',
    content?: string
  ): Promise<void> {
    const reloadContext: ReloadContext = {
      filePath,
      changeType,
      timestamp: Date.now(),
      content
    };

    if (this.config.debugLogging) {
      console.log(`[HotReload] File change detected: ${filePath} (${changeType})`);
    }

    if (this.config.batchUpdates && this.config.debounceMs > 0) {
      // Cancel existing debounced reload for this file
      const existingTimeout = this.pendingReloads.get(filePath);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }

      // Schedule new debounced reload
      const timeout = setTimeout(() => {
        this.pendingReloads.delete(filePath);
        this.queueReload(reloadContext);
      }, this.config.debounceMs);

      this.pendingReloads.set(filePath, timeout);
    } else {
      // Immediate reload
      this.queueReload(reloadContext);
    }
  }

  /**
   * Queue reload for processing
   */
  private queueReload(context: ReloadContext): void {
    this.reloadQueue.push(context);
    
    if (!this.isProcessingQueue) {
      setTimeout(() => this.processReloadQueue(), 0);
    }
  }

  /**
   * Process the reload queue with concurrency control
   */
  private async processReloadQueue(): Promise<void> {
    if (this.isProcessingQueue) return;
    
    this.isProcessingQueue = true;

    try {
      while (this.reloadQueue.length > 0) {
        // Process up to maxConcurrentReloads at once
        const batch = this.reloadQueue.splice(0, this.config.maxConcurrentReloads);
        
        // Execute reloads in parallel
        const reloadPromises = batch.map(context => this.executeReload(context));
        await Promise.allSettled(reloadPromises);
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  /**
   * Execute a single reload operation
   */
  private async executeReload(context: ReloadContext): Promise<ReloadResult> {
    const startTime = Date.now();
    const { filePath, changeType } = context;

    // Check if already reloading this file
    if (this.activeReloads.has(filePath)) {
      if (this.config.debugLogging) {
        console.log(`[HotReload] Skipping reload for ${filePath} - already in progress`);
      }
      return {
        success: false,
        filePath,
        duration: 0,
        error: 'Reload already in progress',
        statePreserved: false,
        frameworksSynced: false
      };
    }

    this.activeReloads.add(filePath);

    // Start visual feedback
    this.visualFeedbackManager.startReload(filePath, changeType);

    try {
      let stateSnapshot: StateSnapshot | null = null;
      let statePreserved = false;
      let frameworksSynced = false;

      // Handle native framework components with framework-specific hot reload
      if (changeType === 'native' && this.frameworkHotReloadManager.canHandleFile(filePath)) {
        // Update progress for framework-specific reload
        this.visualFeedbackManager.updateProgress(filePath, 25, 'Processing framework component...');
        
        const frameworkResult = await this.frameworkHotReloadManager.handleFrameworkComponentReload(filePath);
        
        if (this.config.debugLogging) {
          console.log(`[HotReload] Framework reload result for ${filePath}:`, frameworkResult);
        }
        
        const result = {
          success: frameworkResult.success,
          filePath,
          duration: frameworkResult.duration,
          error: frameworkResult.error,
          statePreserved: frameworkResult.statePreserved,
          frameworksSynced: frameworkResult.connectionsRestored
        };

        // Complete visual feedback
        this.visualFeedbackManager.completeReload(filePath, result);
        
        return result;
      }

      // Handle MTM files and other file types with standard hot reload process
      
      // Step 0: Handle MTM frontmatter changes if this is an MTM file
      let frontmatterChanges: FrontmatterChangeResult | null = null;
      let channelSubscriptionUpdates: ChannelSubscriptionUpdate | null = null;
      
      if (changeType === 'mtm' && filePath.endsWith('.mtm')) {
        this.visualFeedbackManager.updateProgress(filePath, 5, 'Detecting frontmatter changes...');
        
        frontmatterChanges = await this.frontmatterHotReloadManager.detectFrontmatterChanges(filePath, context.content);
        
        if (frontmatterChanges.hasChanges) {
          if (this.config.debugLogging) {
            console.log(`[HotReload] Frontmatter changes detected in ${filePath}:`, frontmatterChanges);
          }
          
          // Handle channel subscription updates
          if (frontmatterChanges.channelsChanged) {
            const oldChannels = frontmatterChanges.changes
              .find(c => c.type === 'channels')?.oldValue;
            const newChannels = frontmatterChanges.changes
              .find(c => c.type === 'channels')?.newValue;
            
            channelSubscriptionUpdates = this.frontmatterHotReloadManager.getChannelSubscriptionUpdates(oldChannels, newChannels);
            
            if (this.config.debugLogging) {
              console.log(`[HotReload] Channel subscription updates for ${filePath}:`, channelSubscriptionUpdates);
            }
          }
          
          // Handle target framework changes
          if (frontmatterChanges.targetChanged) {
            const targetChange = frontmatterChanges.changes.find(c => c.type === 'target');
            if (targetChange) {
              await this.frontmatterHotReloadManager.handleTargetFrameworkChange(
                filePath, 
                targetChange.oldValue, 
                targetChange.newValue
              );
            }
          }
          
          // Handle imports changes for dependency resolution
          if (frontmatterChanges.importsChanged) {
            const importsChange = frontmatterChanges.changes.find(c => c.type === 'imports');
            if (importsChange) {
              await this.frontmatterHotReloadManager.handleImportsChange(
                filePath, 
                importsChange.oldValue, 
                importsChange.newValue
              );
            }
          }
        }
      }
      
      // Step 1: Create cross-framework synchronization snapshot if enabled
      this.visualFeedbackManager.updateProgress(filePath, 10, 'Creating synchronization snapshot...');
      let crossFrameworkSnapshot: FrameworkSyncSnapshot | null = null;
      if (this.config.syncFrameworks) {
        crossFrameworkSnapshot = await this.createCrossFrameworkSnapshot();
      }
      
      // Step 2: Preserve state if enabled
      this.visualFeedbackManager.updateProgress(filePath, 25, 'Preserving component state...');
      if (this.config.preserveState) {
        stateSnapshot = await this.preserveState();
        statePreserved = stateSnapshot !== null;
      }

      // Step 3: Perform the actual reload (this will be handled by the Vite plugin)
      // The orchestrator coordinates but doesn't directly perform the compilation
      this.visualFeedbackManager.updateProgress(filePath, 50, 'Compiling and reloading...');
      
      // Step 4: Restore state if preserved
      this.visualFeedbackManager.updateProgress(filePath, 75, 'Restoring component state...');
      if (stateSnapshot && this.config.preserveState) {
        await this.restoreState(stateSnapshot);
      }

      // Step 5: Restore cross-framework synchronization if enabled
      this.visualFeedbackManager.updateProgress(filePath, 90, 'Synchronizing frameworks...');
      if (this.config.syncFrameworks && crossFrameworkSnapshot) {
        const crossFrameworkRestored = await this.restoreCrossFrameworkSnapshot(crossFrameworkSnapshot);
        
        if (crossFrameworkRestored) {
          // Perform full framework synchronization
          frameworksSynced = await this.syncFrameworks();
          
          // Also reconnect framework adapters to ensure cross-framework communication
          await this.frameworkHotReloadManager.reconnectAllMetamonAdapters();
        } else {
          // Fallback to basic framework sync if snapshot restoration failed
          frameworksSynced = await this.syncFrameworks();
        }
      } else if (this.config.syncFrameworks) {
        // Basic framework sync without snapshot
        frameworksSynced = await this.syncFrameworks();
        
        // Also reconnect framework adapters to ensure cross-framework communication
        await this.frameworkHotReloadManager.reconnectAllMetamonAdapters();
      }

      const duration = Date.now() - startTime;

      if (this.config.debugLogging) {
        console.log(`[HotReload] Successfully reloaded ${filePath} in ${duration}ms`);
      }

      const result = {
        success: true,
        filePath,
        duration,
        statePreserved,
        frameworksSynced
      };

      // Complete visual feedback
      this.visualFeedbackManager.completeReload(filePath, result);

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown reload error';

      if (this.config.debugLogging) {
        console.error(`[HotReload] Failed to reload ${filePath}:`, error);
      }

      const result = {
        success: false,
        filePath,
        duration,
        error: errorMessage,
        statePreserved: false,
        frameworksSynced: false
      };

      // Complete visual feedback with error
      this.visualFeedbackManager.completeReload(filePath, result);

      // Handle error based on recovery mode
      if (this.config.errorRecoveryMode === 'graceful') {
        await this.handleReloadError(filePath, errorMessage, error instanceof Error ? error : undefined);
      }

      return result;

    } finally {
      this.activeReloads.delete(filePath);
    }
  }

  /**
   * Preserve current state before reload
   */
  async preserveState(): Promise<StateSnapshot | null> {
    try {
      // Note: In a real implementation, these would be injected or obtained from a registry
      // For now, we'll return null and let the actual implementation handle this
      // when integrated with the Vite plugin
      
      if (this.config.debugLogging) {
        console.log('[HotReload] State preservation requested but signal/pubsub managers not available');
      }
      
      return null;
    } catch (error) {
      if (this.config.debugLogging) {
        console.error('[HotReload] Failed to preserve state:', error);
      }
      return null;
    }
  }

  /**
   * Restore state after reload
   */
  async restoreState(snapshot: StateSnapshot): Promise<void> {
    try {
      // Note: In a real implementation, these would be injected or obtained from a registry
      // For now, this is a placeholder that will be implemented when integrated with the Vite plugin
      
      if (this.config.debugLogging) {
        console.log('[HotReload] State restoration requested but signal/pubsub managers not available');
      }
    } catch (error) {
      if (this.config.debugLogging) {
        console.error('[HotReload] Failed to restore state:', error);
      }
      throw error;
    }
  }

  /**
   * Synchronize frameworks after reload
   */
  async syncFrameworks(): Promise<boolean> {
    try {
      if (this.config.debugLogging) {
        console.log('[HotReload] Starting framework synchronization');
      }

      // Perform cross-framework synchronization
      const syncSuccess = await this.crossFrameworkSynchronizer.synchronizeFrameworks();

      if (syncSuccess) {
        // Validate that all framework adapters are properly connected
        const adapterValidation = this.frameworkHotReloadManager.validateAllAdapterConnections();
        
        if (!adapterValidation && this.config.debugLogging) {
          console.warn('[HotReload] Some framework adapter connections are invalid after sync');
        }

        if (this.config.debugLogging) {
          console.log('[HotReload] Framework synchronization completed successfully');
        }
        
        return adapterValidation;
      } else {
        if (this.config.debugLogging) {
          console.warn('[HotReload] Cross-framework synchronization failed');
        }
        return false;
      }
      
    } catch (error) {
      if (this.config.debugLogging) {
        console.error('[HotReload] Framework synchronization failed:', error);
      }
      return false;
    }
  }

  /**
   * Setup recovery callbacks for the error recovery manager
   */
  private setupRecoveryCallbacks(): void {
    // Register state restoration callback
    this.errorRecoveryManager.registerRecoveryCallback('restoreState', async () => {
      const currentSnapshot = this.stateManager.getCurrentSnapshot();
      if (currentSnapshot) {
        await this.restoreState(currentSnapshot);
      }
    });

    // Register state reinitialization callback
    this.errorRecoveryManager.registerRecoveryCallback('reinitializeState', async () => {
      // This would reinitialize the state management system
      // Implementation depends on the actual state management setup
      if (this.config.debugLogging) {
        console.log('[HotReload] Reinitializing state management system');
      }
    });

    // Register framework synchronization callback
    this.errorRecoveryManager.registerRecoveryCallback('syncFrameworks', async () => {
      await this.syncFrameworks();
    });

    // Register generic retry callback
    this.errorRecoveryManager.registerRecoveryCallback('retryOperation', async () => {
      // This would retry the last failed operation
      if (this.config.debugLogging) {
        console.log('[HotReload] Retrying last failed operation');
      }
    });

    // Register dependency resolution callback
    this.errorRecoveryManager.registerRecoveryCallback('resolveDependencies', async () => {
      // This would attempt to resolve import/dependency issues
      if (this.config.debugLogging) {
        console.log('[HotReload] Attempting to resolve dependencies');
      }
    });

    // Register generic retry callback
    this.errorRecoveryManager.registerRecoveryCallback('genericRetry', async () => {
      // Generic retry mechanism
      if (this.config.debugLogging) {
        console.log('[HotReload] Performing generic retry');
      }
    });
  }

  /**
   * Handle reload errors with enhanced error handling and recovery
   */
  async handleReloadError(filePath: string, errorMessage: string, originalError?: Error): Promise<void> {
    // Categorize the error for better user experience
    const categorizedError = this.errorCategorizer.categorizeError(
      originalError || errorMessage,
      filePath
    );

    if (this.config.debugLogging) {
      console.error(`[HotReload] Categorized error in ${filePath}:`, categorizedError);
    }

    // Show error overlay with enhanced information
    if (this.config.showErrorOverlay) {
      this.errorOverlay.showError(categorizedError);
    }

    // Attempt recovery if the error is recoverable
    if (this.config.errorRecoveryMode === 'graceful' && categorizedError.recoverable) {
      const recoverySuccessful = await this.errorRecoveryManager.attemptRecovery(categorizedError);
      
      if (recoverySuccessful) {
        // Show success notification if recovery worked
        this.errorOverlay.showSuccess(
          'Error recovered successfully',
          filePath
        );
        
        // Hide error overlay since recovery was successful
        this.errorOverlay.hideError();
      } else {
        // Recovery failed, update error message
        categorizedError.message += '\n\nAutomatic recovery failed. Please fix the error manually.';
        this.errorOverlay.showError(categorizedError);
      }
    }
  }

  /**
   * Initialize cross-framework synchronizer with signal manager and pub/sub system
   */
  initializeCrossFrameworkSync(signalManager: MetamonSignalManager, pubSubSystem: MetamonPubSub): void {
    this.crossFrameworkSynchronizer.initialize(signalManager, pubSubSystem);
    
    if (this.config.debugLogging) {
      console.log('[HotReload] Cross-framework synchronizer initialized with signal manager and pub/sub system');
    }
  }

  /**
   * Register a framework component for cross-framework tracking
   */
  registerFrameworkComponent(framework: string, componentId: string): void {
    this.crossFrameworkSynchronizer.registerFrameworkComponent(framework, componentId);
  }

  /**
   * Unregister a framework component from cross-framework tracking
   */
  unregisterFrameworkComponent(framework: string, componentId: string): void {
    this.crossFrameworkSynchronizer.unregisterFrameworkComponent(framework, componentId);
  }

  /**
   * Create a cross-framework synchronization snapshot before reload
   */
  async createCrossFrameworkSnapshot(): Promise<FrameworkSyncSnapshot | null> {
    try {
      this.frameworkSyncSnapshot = this.crossFrameworkSynchronizer.createSyncSnapshot();
      
      if (this.config.debugLogging) {
        console.log('[HotReload] Created cross-framework synchronization snapshot');
      }
      
      return this.frameworkSyncSnapshot;
    } catch (error) {
      if (this.config.debugLogging) {
        console.error('[HotReload] Failed to create cross-framework snapshot:', error);
      }
      return null;
    }
  }

  /**
   * Restore cross-framework synchronization from snapshot
   */
  async restoreCrossFrameworkSnapshot(snapshot?: FrameworkSyncSnapshot): Promise<boolean> {
    try {
      const snapshotToRestore = snapshot || this.frameworkSyncSnapshot;
      
      if (!snapshotToRestore) {
        if (this.config.debugLogging) {
          console.log('[HotReload] No cross-framework snapshot available for restoration');
        }
        return false;
      }

      const success = await this.crossFrameworkSynchronizer.restoreSyncSnapshot(snapshotToRestore);
      
      if (this.config.debugLogging) {
        console.log(`[HotReload] Cross-framework snapshot restoration ${success ? 'successful' : 'failed'}`);
      }
      
      return success;
    } catch (error) {
      if (this.config.debugLogging) {
        console.error('[HotReload] Failed to restore cross-framework snapshot:', error);
      }
      return false;
    }
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<HotReloadConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Update state manager config if needed
    this.stateManager.updateConfig({
      preserveSignals: this.config.preserveState,
      preserveSubscriptions: this.config.preserveState,
      preserveComponentState: this.config.preserveState,
      debugLogging: this.config.debugLogging
    });
    
    // Update framework hot reload manager config if needed
    this.frameworkHotReloadManager.updateConfig({
      preserveFrameworkState: this.config.preserveState,
      preserveMetamonConnections: this.config.preserveState,
      debugLogging: this.config.debugLogging,
      ...this.config.frameworkHotReload
    });

    // Update cross-framework synchronizer config if needed
    this.crossFrameworkSynchronizer.updateConfig({
      validateSignalConnections: this.config.syncFrameworks,
      restoreSubscriptions: this.config.syncFrameworks,
      syncTimeout: this.config.syncTimeout,
      debugLogging: this.config.debugLogging,
      ...this.config.crossFrameworkSync
    });

    // Update visual feedback manager config if needed
    if (newConfig.visualFeedback) {
      this.visualFeedbackManager.updateOptions({
        debugLogging: this.config.debugLogging,
        ...newConfig.visualFeedback
      });
    }

    // Update frontmatter hot reload manager config if needed
    this.frontmatterHotReloadManager.updateConfig({
      enableChannelUpdates: this.config.syncFrameworks,
      debugLogging: this.config.debugLogging,
      ...this.config.frontmatterHotReload
    });

    // Update CSS hot reload manager config if needed
    if (newConfig.cssHotReload) {
      this.cssHotReloadManager.updateConfig({
        debugLogging: this.config.debugLogging,
        debounceMs: this.config.debounceMs,
        maxConcurrentUpdates: this.config.maxConcurrentReloads,
        ...newConfig.cssHotReload
      });
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): HotReloadConfig {
    return { ...this.config };
  }

  /**
   * Show success notification through visual feedback manager
   */
  showSuccessNotification(message: string, filePath?: string, duration?: number): string {
    return this.visualFeedbackManager.showSuccess(message, filePath, duration);
  }

  /**
   * Show error notification through visual feedback manager
   */
  showErrorNotification(message: string, details?: string, filePath?: string): string {
    return this.visualFeedbackManager.showError(message, details, filePath);
  }

  /**
   * Show warning notification through visual feedback manager
   */
  showWarningNotification(message: string, details?: string, filePath?: string, duration?: number): string {
    return this.visualFeedbackManager.showWarning(message, details, filePath, duration);
  }

  /**
   * Show info notification through visual feedback manager
   */
  showInfoNotification(message: string, details?: string, filePath?: string, duration?: number): string {
    return this.visualFeedbackManager.showInfo(message, details, filePath, duration);
  }

  /**
   * Show batch reload completion summary
   */
  showBatchSummary(results: ReloadResult[]): void {
    const summaryResults = results.map(r => ({
      filePath: r.filePath,
      success: r.success,
      duration: r.duration
    }));
    
    this.visualFeedbackManager.showBatchSummary(summaryResults);
  }

  /**
   * Register a framework CSS handler
   */
  registerFrameworkCSSHandler(handler: import('./css-hot-reload-manager.js').FrameworkStyleHandler): void {
    this.cssHotReloadManager.registerFrameworkHandler(handler);
    
    if (this.config.debugLogging) {
      console.log(`[HotReload] Registered CSS handler for ${handler.frameworkName}`);
    }
  }

  /**
   * Unregister a framework CSS handler
   */
  unregisterFrameworkCSSHandler(frameworkName: string): void {
    this.cssHotReloadManager.unregisterFrameworkHandler(frameworkName);
    
    if (this.config.debugLogging) {
      console.log(`[HotReload] Unregistered CSS handler for ${frameworkName}`);
    }
  }

  /**
   * Register a component for CSS tracking
   */
  registerComponentForCSS(componentId: string, initialStyles?: string): void {
    this.cssHotReloadManager.registerComponent(componentId, initialStyles);
  }

  /**
   * Unregister a component from CSS tracking
   */
  unregisterComponentFromCSS(componentId: string): void {
    this.cssHotReloadManager.unregisterComponent(componentId);
  }

  /**
   * Get CSS hot reload manager statistics
   */
  getCSSStats(): ReturnType<typeof this.cssHotReloadManager.getStats> {
    return this.cssHotReloadManager.getStats();
  }

  /**
   * Clear all visual feedback
   */
  clearVisualFeedback(): void {
    this.visualFeedbackManager.clearAll();
  }

  /**
   * Get visual feedback state
   */
  getVisualFeedbackState(): ReturnType<HotReloadVisualFeedbackManager['getFeedbackState']> {
    return this.visualFeedbackManager.getFeedbackState();
  }

  /**
   * Get reload statistics
   */
  getStats(): {
    activeReloads: number;
    queuedReloads: number;
    pendingReloads: number;
  } {
    return {
      activeReloads: this.activeReloads.size,
      queuedReloads: this.reloadQueue.length,
      pendingReloads: this.pendingReloads.size
    };
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.pendingReloads.clear();
    
    // Clear queues
    this.reloadQueue.length = 0;
    this.activeReloads.clear();
    
    // Cleanup state manager
    this.stateManager.cleanup();
    
    // Cleanup framework hot reload manager
    this.frameworkHotReloadManager.cleanup();
    
    // Cleanup cross-framework synchronizer
    this.crossFrameworkSynchronizer.cleanup();
    
    // Cleanup visual feedback manager
    this.visualFeedbackManager.cleanup();
    
    // Cleanup frontmatter hot reload manager
    this.frontmatterHotReloadManager.cleanup();
    
    // Cleanup CSS hot reload manager
    this.cssHotReloadManager.cleanup();
    
    // Clear framework sync snapshot
    this.frameworkSyncSnapshot = null;
    
    this.isProcessingQueue = false;
  }
}