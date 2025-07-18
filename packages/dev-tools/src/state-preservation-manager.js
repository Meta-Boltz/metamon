/**
 * StatePreservationManager - Handles backup and restoration of Metamon state during hot reload
 *
 * This class provides the core infrastructure for preserving cross-framework state
 * including signals, PubSub subscriptions, and component-specific state during
 * hot module replacement operations.
 */
export class StatePreservationManager {
    constructor(config = {}) {
        this.currentSnapshot = null;
        this.callbackRegistry = new Map();
        this.callbackIdCounter = 0;
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
    async preserveState(signalManager, pubSubSystem) {
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
                : new Map();
            preservedComponents = componentSnapshots.size;
            // Create complete snapshot
            const snapshot = {
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
        }
        catch (error) {
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
    async restoreState(signalManager, pubSubSystem, snapshot) {
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
        const failedRestorations = [];
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
        }
        catch (error) {
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
    async backupSignalState(signalManager) {
        const globalSignals = new Map();
        const signalSubscriptions = new Map();
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
        }
        catch (error) {
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
    async restoreSignalState(signalManager, snapshot) {
        let restored = 0;
        const failed = [];
        try {
            for (const [key, value] of snapshot.globalSignals) {
                try {
                    // Get existing signal or create new one
                    let signal = signalManager.getSignal(key);
                    if (!signal) {
                        signal = signalManager.createSignal(value, key);
                    }
                    else {
                        // Update existing signal value
                        signal.update(value);
                    }
                    restored++;
                }
                catch (error) {
                    failed.push(`Signal ${key}: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
            }
        }
        catch (error) {
            failed.push(`Signal restoration: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        return { restored, failed };
    }
    /**
     * Backup PubSub subscriptions
     */
    async backupSubscriptions(pubSubSystem) {
        const eventSubscriptions = new Map();
        const componentEventMap = new Map();
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
                eventSubscriptions.get(event).push({
                    event,
                    componentId,
                    callbackId
                });
                // Update component event map
                if (!componentEventMap.has(componentId)) {
                    componentEventMap.set(componentId, []);
                }
                if (!componentEventMap.get(componentId).includes(event)) {
                    componentEventMap.get(componentId).push(event);
                }
            }
        }
        catch (error) {
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
    async restoreSubscriptions(pubSubSystem, snapshot) {
        let restored = 0;
        const failed = [];
        try {
            for (const [event, subscriptions] of snapshot.eventSubscriptions) {
                for (const subscriptionData of subscriptions) {
                    try {
                        const { componentId, callbackId } = subscriptionData;
                        const callback = this.callbackRegistry.get(callbackId);
                        if (callback) {
                            pubSubSystem.subscribe(event, callback, componentId);
                            restored++;
                        }
                        else {
                            failed.push(`Subscription ${event}:${componentId} - callback not found`);
                        }
                    }
                    catch (error) {
                        failed.push(`Subscription ${event}:${subscriptionData.componentId} - ${error instanceof Error ? error.message : 'Unknown error'}`);
                    }
                }
            }
        }
        catch (error) {
            failed.push(`Subscription restoration: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        return { restored, failed };
    }
    /**
     * Backup component-specific state (placeholder implementation)
     */
    async backupComponentState() {
        // This is a placeholder implementation
        // In a real implementation, this would integrate with framework-specific state extraction
        return new Map();
    }
    /**
     * Restore component-specific state (placeholder implementation)
     */
    async restoreComponentState(snapshots) {
        // This is a placeholder implementation
        // In a real implementation, this would integrate with framework-specific state restoration
        return { restored: 0, failed: [] };
    }
    /**
     * Create empty signal snapshot
     */
    createEmptySignalSnapshot() {
        return {
            globalSignals: new Map(),
            signalSubscriptions: new Map(),
            timestamp: Date.now()
        };
    }
    /**
     * Create empty subscription snapshot
     */
    createEmptySubscriptionSnapshot() {
        return {
            eventSubscriptions: new Map(),
            componentEventMap: new Map(),
            timestamp: Date.now()
        };
    }
    /**
     * Generate unique callback ID
     */
    generateCallbackId() {
        return `callback_${++this.callbackIdCounter}_${Date.now()}`;
    }
    /**
     * Clear current snapshot and callback registry
     */
    cleanup() {
        this.currentSnapshot = null;
        this.callbackRegistry.clear();
        this.callbackIdCounter = 0;
    }
    /**
     * Get current snapshot (for debugging)
     */
    getCurrentSnapshot() {
        return this.currentSnapshot;
    }
    /**
     * Update configuration
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
    }
}
