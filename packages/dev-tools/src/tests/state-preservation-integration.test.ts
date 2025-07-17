import { describe, it, expect, beforeEach } from 'vitest';
import { StatePreservationManager } from '../state-preservation-manager.js';
import { MetamonSignalManager } from '@metamon/core';
import { MetamonPubSub } from '@metamon/core';

describe('State Preservation Integration', () => {
  let stateManager: StatePreservationManager;
  let signalManager: MetamonSignalManager;
  let pubSubSystem: MetamonPubSub;

  beforeEach(() => {
    stateManager = new StatePreservationManager({
      preserveSignals: true,
      preserveSubscriptions: true,
      preserveComponentState: true,
      maxSnapshotAge: 30000,
      debugLogging: false
    });
    
    signalManager = new MetamonSignalManager();
    pubSubSystem = new MetamonPubSub();
  });

  it('should preserve and restore signal state during hot reload simulation', async () => {
    // Setup initial state
    const counterSignal = signalManager.createSignal(0, 'counter');
    const nameSignal = signalManager.createSignal('John', 'userName');
    
    // Update signal values
    counterSignal.update(42);
    nameSignal.update('Jane');

    // Preserve state
    const preserveResult = await stateManager.preserveState(signalManager, pubSubSystem);
    
    expect(preserveResult.success).toBe(true);
    expect(preserveResult.preservedSignals).toBe(2);
    expect(preserveResult.snapshot).toBeDefined();

    // Simulate hot reload by creating new signal manager
    const newSignalManager = new MetamonSignalManager();
    
    // Restore state
    const restoreResult = await stateManager.restoreState(newSignalManager, pubSubSystem);
    
    expect(restoreResult.success).toBe(true);
    expect(restoreResult.restoredSignals).toBe(2);

    // Verify restored values
    const restoredCounter = newSignalManager.getSignal('counter');
    const restoredName = newSignalManager.getSignal('userName');
    
    expect(restoredCounter?.value).toBe(42);
    expect(restoredName?.value).toBe('Jane');
  });

  it('should preserve and restore PubSub subscriptions during hot reload simulation', async () => {
    // Setup subscriptions
    const eventCallback1 = (data: any) => console.log('Event 1:', data);
    const eventCallback2 = (data: any) => console.log('Event 2:', data);
    
    pubSubSystem.subscribe('user-action', eventCallback1, 'component1');
    pubSubSystem.subscribe('data-update', eventCallback2, 'component2');
    pubSubSystem.subscribe('user-action', eventCallback2, 'component2'); // Same event, different component

    // Verify initial subscriptions
    expect(pubSubSystem.getSubscriptionCount('user-action')).toBe(2);
    expect(pubSubSystem.getSubscriptionCount('data-update')).toBe(1);

    // Preserve state
    const preserveResult = await stateManager.preserveState(signalManager, pubSubSystem);
    
    expect(preserveResult.success).toBe(true);
    expect(preserveResult.preservedSubscriptions).toBe(3);

    // Simulate hot reload by creating new PubSub system
    const newPubSubSystem = new MetamonPubSub();
    
    // Restore state
    const restoreResult = await stateManager.restoreState(signalManager, newPubSubSystem);
    
    expect(restoreResult.success).toBe(true);
    expect(restoreResult.restoredSubscriptions).toBe(3);

    // Verify restored subscriptions
    expect(newPubSubSystem.getSubscriptionCount('user-action')).toBe(2);
    expect(newPubSubSystem.getSubscriptionCount('data-update')).toBe(1);
    
    // Verify component event mappings
    expect(newPubSubSystem.getComponentEvents('component1')).toContain('user-action');
    expect(newPubSubSystem.getComponentEvents('component2')).toContain('data-update');
    expect(newPubSubSystem.getComponentEvents('component2')).toContain('user-action');
  });

  it('should handle complex cross-framework state preservation scenario', async () => {
    // Setup complex state scenario
    const userSignal = signalManager.createSignal({ id: 1, name: 'Alice', role: 'admin' }, 'currentUser');
    const themeSignal = signalManager.createSignal('dark', 'appTheme');
    const settingsSignal = signalManager.createSignal({ notifications: true, autoSave: false }, 'userSettings');

    // Setup cross-component subscriptions
    const reactCallback = (data: any) => console.log('React component:', data);
    const vueCallback = (data: any) => console.log('Vue component:', data);
    const svelteCallback = (data: any) => console.log('Svelte component:', data);

    pubSubSystem.subscribe('theme-changed', reactCallback, 'react-header');
    pubSubSystem.subscribe('theme-changed', vueCallback, 'vue-sidebar');
    pubSubSystem.subscribe('user-updated', svelteCallback, 'svelte-profile');
    pubSubSystem.subscribe('settings-changed', reactCallback, 'react-header');

    // Update state
    userSignal.update({ id: 1, name: 'Alice Cooper', role: 'admin' });
    themeSignal.update('light');
    settingsSignal.update({ notifications: false, autoSave: true });

    // Preserve complete state
    const preserveResult = await stateManager.preserveState(signalManager, pubSubSystem);
    
    expect(preserveResult.success).toBe(true);
    expect(preserveResult.preservedSignals).toBe(3);
    expect(preserveResult.preservedSubscriptions).toBe(4);

    // Simulate complete hot reload
    const newSignalManager = new MetamonSignalManager();
    const newPubSubSystem = new MetamonPubSub();

    // Restore complete state
    const restoreResult = await stateManager.restoreState(newSignalManager, newPubSubSystem);
    
    expect(restoreResult.success).toBe(true);
    expect(restoreResult.restoredSignals).toBe(3);
    expect(restoreResult.restoredSubscriptions).toBe(4);

    // Verify complex state restoration
    const restoredUser = newSignalManager.getSignal('currentUser');
    const restoredTheme = newSignalManager.getSignal('appTheme');
    const restoredSettings = newSignalManager.getSignal('userSettings');

    expect(restoredUser?.value).toEqual({ id: 1, name: 'Alice Cooper', role: 'admin' });
    expect(restoredTheme?.value).toBe('light');
    expect(restoredSettings?.value).toEqual({ notifications: false, autoSave: true });

    // Verify cross-framework subscriptions
    expect(newPubSubSystem.getComponentEvents('react-header')).toEqual(['theme-changed', 'settings-changed']);
    expect(newPubSubSystem.getComponentEvents('vue-sidebar')).toEqual(['theme-changed']);
    expect(newPubSubSystem.getComponentEvents('svelte-profile')).toEqual(['user-updated']);
  });

  it('should handle partial failures gracefully', async () => {
    // Setup state with some valid and some problematic data
    const validSignal = signalManager.createSignal('valid-data', 'validSignal');
    const complexSignal = signalManager.createSignal({ nested: { data: [1, 2, 3] } }, 'complexSignal');

    // Setup subscriptions
    const callback = (data: any) => console.log(data);
    pubSubSystem.subscribe('valid-event', callback, 'component1');

    // Preserve state
    const preserveResult = await stateManager.preserveState(signalManager, pubSubSystem);
    expect(preserveResult.success).toBe(true);

    // Create new managers for restoration
    const newSignalManager = new MetamonSignalManager();
    const newPubSubSystem = new MetamonPubSub();

    // Restore state
    const restoreResult = await stateManager.restoreState(newSignalManager, newPubSubSystem);
    
    expect(restoreResult.success).toBe(true);
    expect(restoreResult.restoredSignals).toBe(2);
    expect(restoreResult.restoredSubscriptions).toBe(1);

    // Verify that valid data was restored correctly
    expect(newSignalManager.getSignal('validSignal')?.value).toBe('valid-data');
    expect(newSignalManager.getSignal('complexSignal')?.value).toEqual({ nested: { data: [1, 2, 3] } });
    expect(newPubSubSystem.getSubscriptionCount('valid-event')).toBe(1);
  });

  it('should handle cleanup correctly', async () => {
    // Setup state
    const signal = signalManager.createSignal('test', 'testSignal');
    pubSubSystem.subscribe('test-event', () => {}, 'test-component');

    // Preserve state
    await stateManager.preserveState(signalManager, pubSubSystem);
    expect(stateManager.getCurrentSnapshot()).not.toBeNull();

    // Cleanup
    stateManager.cleanup();
    expect(stateManager.getCurrentSnapshot()).toBeNull();

    // Verify that restoration fails after cleanup
    const restoreResult = await stateManager.restoreState(signalManager, pubSubSystem);
    expect(restoreResult.success).toBe(false);
    expect(restoreResult.error).toContain('No snapshot available');
  });
});