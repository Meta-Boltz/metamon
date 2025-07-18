import type { StateSnapshot, StatePreservationConfig, StatePreservationResult, StateRestorationResult } from './types/state-preservation.js';
import type { MetamonSignalManager } from '@metamon/core';
import type { MetamonPubSub } from '@metamon/core';
/**
 * StatePreservationManager - Handles backup and restoration of Metamon state during hot reload
 *
 * This class provides the core infrastructure for preserving cross-framework state
 * including signals, PubSub subscriptions, and component-specific state during
 * hot module replacement operations.
 */
export declare class StatePreservationManager {
    private config;
    private currentSnapshot;
    private callbackRegistry;
    private callbackIdCounter;
    constructor(config?: Partial<StatePreservationConfig>);
    /**
     * Create a complete state snapshot for preservation
     */
    preserveState(signalManager: MetamonSignalManager, pubSubSystem: MetamonPubSub): Promise<StatePreservationResult>;
    /**
     * Restore state from a snapshot
     */
    restoreState(signalManager: MetamonSignalManager, pubSubSystem: MetamonPubSub, snapshot?: StateSnapshot): Promise<StateRestorationResult>;
    /**
     * Backup signal state from the signal manager
     */
    private backupSignalState;
    /**
     * Restore signal state to the signal manager
     */
    private restoreSignalState;
    /**
     * Backup PubSub subscriptions
     */
    private backupSubscriptions;
    /**
     * Restore PubSub subscriptions
     */
    private restoreSubscriptions;
    /**
     * Backup component-specific state (placeholder implementation)
     */
    private backupComponentState;
    /**
     * Restore component-specific state (placeholder implementation)
     */
    private restoreComponentState;
    /**
     * Create empty signal snapshot
     */
    private createEmptySignalSnapshot;
    /**
     * Create empty subscription snapshot
     */
    private createEmptySubscriptionSnapshot;
    /**
     * Generate unique callback ID
     */
    private generateCallbackId;
    /**
     * Clear current snapshot and callback registry
     */
    cleanup(): void;
    /**
     * Get current snapshot (for debugging)
     */
    getCurrentSnapshot(): StateSnapshot | null;
    /**
     * Update configuration
     */
    updateConfig(newConfig: Partial<StatePreservationConfig>): void;
}
