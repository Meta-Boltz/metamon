/**
 * Example demonstrating how to use the State Preservation Infrastructure
 * for hot reload support in Metamon applications.
 */
import { StatePreservationManager } from '../state-preservation-manager.js';
import { MetamonSignalManager, MetamonPubSub } from '@metamon/core';
/**
 * Example: Basic Hot Reload State Preservation
 */
export async function basicHotReloadExample() {
    console.log('🔄 Basic Hot Reload State Preservation Example');
    // Initialize systems
    const signalManager = new MetamonSignalManager();
    const pubSubSystem = new MetamonPubSub();
    const stateManager = new StatePreservationManager({
        preserveSignals: true,
        preserveSubscriptions: true,
        debugLogging: true
    });
    // Setup application state
    const userSignal = signalManager.createSignal({ name: 'John', age: 30 }, 'currentUser');
    const themeSignal = signalManager.createSignal('dark', 'appTheme');
    // Setup event subscriptions
    pubSubSystem.subscribe('user-updated', (user) => {
        console.log('User updated:', user);
    }, 'header-component');
    pubSubSystem.subscribe('theme-changed', (theme) => {
        console.log('Theme changed to:', theme);
    }, 'app-component');
    // Simulate user interactions
    userSignal.update({ name: 'Jane', age: 25 });
    themeSignal.update('light');
    console.log('📸 Preserving state before hot reload...');
    // Preserve state before hot reload
    const preserveResult = await stateManager.preserveState(signalManager, pubSubSystem);
    if (preserveResult.success) {
        console.log(`✅ Preserved ${preserveResult.preservedSignals} signals and ${preserveResult.preservedSubscriptions} subscriptions`);
    }
    // Simulate hot reload by creating new instances
    const newSignalManager = new MetamonSignalManager();
    const newPubSubSystem = new MetamonPubSub();
    console.log('🔄 Simulating hot reload...');
    // Restore state after hot reload
    const restoreResult = await stateManager.restoreState(newSignalManager, newPubSubSystem);
    if (restoreResult.success) {
        console.log(`✅ Restored ${restoreResult.restoredSignals} signals and ${restoreResult.restoredSubscriptions} subscriptions`);
        // Verify state was preserved
        const restoredUser = newSignalManager.getSignal('currentUser');
        const restoredTheme = newSignalManager.getSignal('appTheme');
        console.log('👤 Restored user:', restoredUser?.value);
        console.log('🎨 Restored theme:', restoredTheme?.value);
        console.log('📡 Active subscriptions:', newPubSubSystem.getActiveSubscriptions().length);
    }
}
/**
 * Example: Cross-Framework State Preservation
 */
export async function crossFrameworkExample() {
    console.log('🌐 Cross-Framework State Preservation Example');
    const signalManager = new MetamonSignalManager();
    const pubSubSystem = new MetamonPubSub();
    const stateManager = new StatePreservationManager();
    // Setup cross-framework state
    const sharedCounter = signalManager.createSignal(0, 'sharedCounter');
    const sharedData = signalManager.createSignal({ items: [], loading: false }, 'sharedData');
    // Setup cross-framework event subscriptions
    pubSubSystem.subscribe('counter-increment', (value) => {
        sharedCounter.update(sharedCounter.value + 1);
    }, 'react-counter-component');
    pubSubSystem.subscribe('data-fetch-start', () => {
        sharedData.update({ ...sharedData.value, loading: true });
    }, 'vue-data-component');
    pubSubSystem.subscribe('data-fetch-complete', (items) => {
        sharedData.update({ items, loading: false });
    }, 'svelte-list-component');
    // Simulate cross-framework interactions
    pubSubSystem.emit('counter-increment', null);
    pubSubSystem.emit('counter-increment', null);
    pubSubSystem.emit('data-fetch-start', null);
    pubSubSystem.emit('data-fetch-complete', ['item1', 'item2', 'item3']);
    console.log('📊 Before hot reload:');
    console.log('  Counter:', sharedCounter.value);
    console.log('  Data:', sharedData.value);
    console.log('  Subscriptions:', pubSubSystem.getActiveSubscriptions().length);
    // Preserve and restore state
    const preserveResult = await stateManager.preserveState(signalManager, pubSubSystem);
    const newSignalManager = new MetamonSignalManager();
    const newPubSubSystem = new MetamonPubSub();
    const restoreResult = await stateManager.restoreState(newSignalManager, newPubSubSystem);
    console.log('📊 After hot reload:');
    console.log('  Counter:', newSignalManager.getSignal('sharedCounter')?.value);
    console.log('  Data:', newSignalManager.getSignal('sharedData')?.value);
    console.log('  Subscriptions:', newPubSubSystem.getActiveSubscriptions().length);
}
/**
 * Example: Error Handling and Recovery
 */
export async function errorHandlingExample() {
    console.log('⚠️ Error Handling and Recovery Example');
    const signalManager = new MetamonSignalManager();
    const pubSubSystem = new MetamonPubSub();
    const stateManager = new StatePreservationManager({
        debugLogging: true,
        maxSnapshotAge: 5000 // 5 seconds for demo
    });
    // Setup some state
    const validSignal = signalManager.createSignal('valid-data', 'validSignal');
    pubSubSystem.subscribe('test-event', () => { }, 'test-component');
    // Preserve state
    const preserveResult = await stateManager.preserveState(signalManager, pubSubSystem);
    console.log('✅ State preserved successfully');
    // Wait to make snapshot stale
    console.log('⏳ Waiting for snapshot to become stale...');
    await new Promise(resolve => setTimeout(resolve, 6000));
    // Try to restore stale snapshot
    const newSignalManager = new MetamonSignalManager();
    const newPubSubSystem = new MetamonPubSub();
    const restoreResult = await stateManager.restoreState(newSignalManager, newPubSubSystem);
    if (!restoreResult.success) {
        console.log('❌ Restoration failed as expected:', restoreResult.error);
    }
    // Demonstrate partial failure handling
    console.log('🔧 Testing partial failure recovery...');
    // Create fresh snapshot
    await stateManager.preserveState(signalManager, pubSubSystem);
    // Restore with some expected failures
    const partialRestoreResult = await stateManager.restoreState(newSignalManager, newPubSubSystem);
    if (partialRestoreResult.success) {
        console.log(`✅ Partial restoration: ${partialRestoreResult.restoredSignals} signals, ${partialRestoreResult.restoredSubscriptions} subscriptions`);
        if (partialRestoreResult.failedRestorations.length > 0) {
            console.log('⚠️ Some restorations failed:', partialRestoreResult.failedRestorations);
        }
    }
}
/**
 * Example: State Serialization and Persistence
 */
export async function serializationExample() {
    console.log('💾 State Serialization and Persistence Example');
    const signalManager = new MetamonSignalManager();
    const pubSubSystem = new MetamonPubSub();
    const stateManager = new StatePreservationManager();
    // Setup complex state
    const complexSignal = signalManager.createSignal({
        user: { id: 1, profile: { name: 'Alice', preferences: { theme: 'dark', lang: 'en' } } },
        data: [1, 2, 3, { nested: true }],
        timestamp: Date.now()
    }, 'complexState');
    pubSubSystem.subscribe('complex-event', (data) => console.log(data), 'complex-component');
    // Preserve state
    const preserveResult = await stateManager.preserveState(signalManager, pubSubSystem);
    if (preserveResult.success && preserveResult.snapshot) {
        // Import serialization utilities
        const { serializeStateSnapshot, deserializeStateSnapshot, getSnapshotStats } = await import('../state-serialization.js');
        // Serialize snapshot
        const serialized = serializeStateSnapshot(preserveResult.snapshot);
        console.log('📄 Serialized snapshot size:', serialized.length, 'characters');
        // Get snapshot statistics
        const stats = getSnapshotStats(preserveResult.snapshot);
        console.log('📊 Snapshot stats:', stats);
        // Deserialize and restore
        const deserialized = deserializeStateSnapshot(serialized);
        const newSignalManager = new MetamonSignalManager();
        const newPubSubSystem = new MetamonPubSub();
        const restoreResult = await stateManager.restoreState(newSignalManager, newPubSubSystem, deserialized);
        if (restoreResult.success) {
            console.log('✅ Successfully restored from serialized snapshot');
            const restoredComplex = newSignalManager.getSignal('complexState');
            console.log('🔍 Restored complex state:', JSON.stringify(restoredComplex?.value, null, 2));
        }
    }
}
/**
 * Run all examples
 */
export async function runAllExamples() {
    console.log('🚀 Running State Preservation Examples\n');
    try {
        await basicHotReloadExample();
        console.log('\n' + '='.repeat(50) + '\n');
        await crossFrameworkExample();
        console.log('\n' + '='.repeat(50) + '\n');
        await errorHandlingExample();
        console.log('\n' + '='.repeat(50) + '\n');
        await serializationExample();
        console.log('\n✅ All examples completed successfully!');
    }
    catch (error) {
        console.error('❌ Example failed:', error);
    }
}
// Run examples if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runAllExamples();
}
