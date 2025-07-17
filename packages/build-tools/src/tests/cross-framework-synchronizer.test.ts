/**
 * Cross-Framework Synchronizer Tests
 * 
 * Tests for cross-framework synchronization during hot reload,
 * including signal connection validation and pub/sub subscription restoration.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CrossFrameworkSynchronizer, type CrossFrameworkConnection, type FrameworkSyncSnapshot } from '../cross-framework-synchronizer.js';
import { MetamonSignalManager, MetamonPubSub } from '@metamon/core';

describe('CrossFrameworkSynchronizer', () => {
  let synchronizer: CrossFrameworkSynchronizer;
  let signalManager: MetamonSignalManager;
  let pubSubSystem: MetamonPubSub;

  beforeEach(() => {
    synchronizer = new CrossFrameworkSynchronizer({
      validateSignalConnections: true,
      restoreSubscriptions: true,
      syncTimeout: 1000,
      debugLogging: false,
      maxRetryAttempts: 2,
      retryDelay: 100
    });

    signalManager = new MetamonSignalManager();
    pubSubSystem = new MetamonPubSub();
    
    synchronizer.initialize(signalManager, pubSubSystem);
  });

  afterEach(() => {
    synchronizer.cleanup();
    signalManager.cleanup();
    pubSubSystem.clear();
  });

  describe('Framework Component Registration', () => {
    it('should register framework components', () => {
      synchronizer.registerFrameworkComponent('react', 'component1');
      synchronizer.registerFrameworkComponent('vue', 'component2');
      
      const stats = synchronizer.getStats();
      expect(stats.registeredFrameworks).toBe(2);
      expect(stats.totalComponents).toBe(2);
    });

    it('should unregister framework components', () => {
      synchronizer.registerFrameworkComponent('react', 'component1');
      synchronizer.registerFrameworkComponent('react', 'component2');
      
      synchronizer.unregisterFrameworkComponent('react', 'component1');
      
      const stats = synchronizer.getStats();
      expect(stats.totalComponents).toBe(1);
    });

    it('should clean up framework when no components remain', () => {
      synchronizer.registerFrameworkComponent('react', 'component1');
      synchronizer.unregisterFrameworkComponent('react', 'component1');
      
      const stats = synchronizer.getStats();
      expect(stats.registeredFrameworks).toBe(0);
      expect(stats.totalComponents).toBe(0);
    });
  });

  describe('Connection Tracking', () => {
    it('should track cross-framework connections', () => {
      const connection: CrossFrameworkConnection = {
        type: 'signal',
        key: 'testSignal',
        sourceFramework: 'react',
        targetFramework: 'vue',
        componentId: 'component1'
      };

      synchronizer.trackConnection(connection);
      
      const stats = synchronizer.getStats();
      expect(stats.activeConnections).toBe(1);
    });

    it('should clean up connections when component is unregistered', () => {
      const connection: CrossFrameworkConnection = {
        type: 'signal',
        key: 'testSignal',
        sourceFramework: 'react',
        targetFramework: 'vue',
        componentId: 'component1'
      };

      synchronizer.registerFrameworkComponent('react', 'component1');
      synchronizer.trackConnection(connection);
      
      expect(synchronizer.getStats().activeConnections).toBe(1);
      
      synchronizer.unregisterFrameworkComponent('react', 'component1');
      
      expect(synchronizer.getStats().activeConnections).toBe(0);
    });
  });

  describe('Sync Snapshot Creation and Restoration', () => {
    it('should create sync snapshot with signal values', () => {
      // Create signals
      const signal1 = signalManager.createSignal('value1', 'signal1');
      const signal2 = signalManager.createSignal(42, 'signal2');

      const snapshot = synchronizer.createSyncSnapshot();

      expect(snapshot.signalValues.size).toBe(2);
      expect(snapshot.signalValues.get('signal1')).toBe('value1');
      expect(snapshot.signalValues.get('signal2')).toBe(42);
      expect(snapshot.timestamp).toBeGreaterThan(0);
    });

    it('should create sync snapshot with subscriptions', () => {
      // Create subscriptions
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      
      pubSubSystem.subscribe('event1', callback1, 'component1');
      pubSubSystem.subscribe('event2', callback2, 'component2');

      synchronizer.registerFrameworkComponent('react', 'component1');
      synchronizer.registerFrameworkComponent('vue', 'component2');

      const snapshot = synchronizer.createSyncSnapshot();

      expect(snapshot.subscriptions.size).toBe(2);
      expect(snapshot.subscriptions.has('event1')).toBe(true);
      expect(snapshot.subscriptions.has('event2')).toBe(true);
    });

    it('should restore signal values from snapshot', async () => {
      // Create initial signals
      signalManager.createSignal('initial1', 'signal1');
      signalManager.createSignal('initial2', 'signal2');

      // Create snapshot
      const snapshot = synchronizer.createSyncSnapshot();

      // Modify signals
      const signal1 = signalManager.getSignal('signal1');
      const signal2 = signalManager.getSignal('signal2');
      signal1?.update('modified1');
      signal2?.update('modified2');

      // Restore from snapshot
      const success = await synchronizer.restoreSyncSnapshot(snapshot);

      expect(success).toBe(true);
      expect(signalManager.getSignal('signal1')?.value).toBe('initial1');
      expect(signalManager.getSignal('signal2')?.value).toBe('initial2');
    });

    it('should restore subscriptions from snapshot', async () => {
      // Create initial subscriptions
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      
      pubSubSystem.subscribe('event1', callback1, 'component1');
      pubSubSystem.subscribe('event2', callback2, 'component2');

      synchronizer.registerFrameworkComponent('react', 'component1');
      synchronizer.registerFrameworkComponent('vue', 'component2');

      // Create snapshot
      const snapshot = synchronizer.createSyncSnapshot();

      // Clear subscriptions
      pubSubSystem.clear();

      // Restore from snapshot
      const success = await synchronizer.restoreSyncSnapshot(snapshot);

      expect(success).toBe(true);
      
      // Verify subscriptions are restored
      expect(pubSubSystem.getSubscriptionCount('event1')).toBe(1);
      expect(pubSubSystem.getSubscriptionCount('event2')).toBe(1);
    });
  });

  describe('Signal Connection Validation', () => {
    it('should validate signal connections successfully', async () => {
      // Create signals
      signalManager.createSignal('value1', 'signal1');
      signalManager.createSignal('value2', 'signal2');

      const isValid = await synchronizer.validateSignalConnections();

      expect(isValid).toBe(true);
    });

    it('should handle missing signals during validation', async () => {
      // Create a signal then destroy it to simulate missing signal
      signalManager.createSignal('value1', 'signal1');
      signalManager.destroySignal('signal1');

      const isValid = await synchronizer.validateSignalConnections();

      // Should still be valid since no signals exist
      expect(isValid).toBe(true);
    });
  });

  describe('Connection Reconnection', () => {
    it('should reconnect signal connections', async () => {
      const connection: CrossFrameworkConnection = {
        type: 'signal',
        key: 'testSignal',
        sourceFramework: 'react',
        targetFramework: 'vue',
        componentId: 'component1'
      };

      synchronizer.trackConnection(connection);

      const success = await synchronizer.reconnectAllConnections();

      expect(success).toBe(true);
      
      // Verify signal was created
      const signal = signalManager.getSignal('testSignal');
      expect(signal).toBeDefined();
    });

    it('should reconnect pub/sub connections', async () => {
      const mockCallback = vi.fn();
      const connection: CrossFrameworkConnection = {
        type: 'pubsub',
        key: 'testEvent',
        sourceFramework: 'react',
        targetFramework: 'vue',
        componentId: 'component1',
        subscriptionData: {
          callback: mockCallback
        }
      };

      synchronizer.trackConnection(connection);

      const success = await synchronizer.reconnectAllConnections();

      expect(success).toBe(true);
      
      // Verify subscription was created
      expect(pubSubSystem.getSubscriptionCount('testEvent')).toBe(1);
    });

    it('should handle connection reconnection failures gracefully', async () => {
      const connection: CrossFrameworkConnection = {
        type: 'pubsub',
        key: 'testEvent',
        sourceFramework: 'react',
        targetFramework: 'vue',
        componentId: 'component1'
        // Missing subscriptionData to cause failure
      };

      synchronizer.trackConnection(connection);

      const success = await synchronizer.reconnectAllConnections();

      expect(success).toBe(false);
    });
  });

  describe('Full Framework Synchronization', () => {
    it('should perform complete framework synchronization', async () => {
      // Set up test scenario
      signalManager.createSignal('value1', 'signal1');
      
      const callback = vi.fn();
      pubSubSystem.subscribe('event1', callback, 'component1');
      
      synchronizer.registerFrameworkComponent('react', 'component1');

      const connection: CrossFrameworkConnection = {
        type: 'signal',
        key: 'signal1',
        sourceFramework: 'react',
        targetFramework: 'vue',
        componentId: 'component1'
      };
      synchronizer.trackConnection(connection);

      const success = await synchronizer.synchronizeFrameworks();

      expect(success).toBe(true);
    });

    it('should handle synchronization errors gracefully', async () => {
      // Create a scenario that will cause validation to fail
      const connection: CrossFrameworkConnection = {
        type: 'pubsub',
        key: 'invalidEvent',
        sourceFramework: 'react',
        targetFramework: 'vue',
        componentId: 'nonexistentComponent'
      };
      synchronizer.trackConnection(connection);

      const success = await synchronizer.synchronizeFrameworks();

      // Should still complete but may not be fully successful
      expect(typeof success).toBe('boolean');
    });
  });

  describe('Configuration Management', () => {
    it('should update configuration', () => {
      const newConfig = {
        validateSignalConnections: false,
        restoreSubscriptions: false,
        syncTimeout: 2000,
        debugLogging: true
      };

      synchronizer.updateConfig(newConfig);

      const config = synchronizer.getConfig();
      expect(config.validateSignalConnections).toBe(false);
      expect(config.restoreSubscriptions).toBe(false);
      expect(config.syncTimeout).toBe(2000);
      expect(config.debugLogging).toBe(true);
    });

    it('should provide current configuration', () => {
      const config = synchronizer.getConfig();

      expect(config).toHaveProperty('validateSignalConnections');
      expect(config).toHaveProperty('restoreSubscriptions');
      expect(config).toHaveProperty('syncTimeout');
      expect(config).toHaveProperty('debugLogging');
      expect(config).toHaveProperty('maxRetryAttempts');
      expect(config).toHaveProperty('retryDelay');
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should provide accurate statistics', () => {
      synchronizer.registerFrameworkComponent('react', 'component1');
      synchronizer.registerFrameworkComponent('vue', 'component2');
      synchronizer.registerFrameworkComponent('vue', 'component3');

      const connection: CrossFrameworkConnection = {
        type: 'signal',
        key: 'testSignal',
        sourceFramework: 'react',
        targetFramework: 'vue',
        componentId: 'component1'
      };
      synchronizer.trackConnection(connection);

      const stats = synchronizer.getStats();

      expect(stats.activeConnections).toBe(1);
      expect(stats.registeredFrameworks).toBe(2);
      expect(stats.totalComponents).toBe(3);
    });
  });

  describe('Cleanup', () => {
    it('should clean up all resources', () => {
      synchronizer.registerFrameworkComponent('react', 'component1');
      
      const connection: CrossFrameworkConnection = {
        type: 'signal',
        key: 'testSignal',
        sourceFramework: 'react',
        targetFramework: 'vue',
        componentId: 'component1'
      };
      synchronizer.trackConnection(connection);

      synchronizer.cleanup();

      const stats = synchronizer.getStats();
      expect(stats.activeConnections).toBe(0);
      expect(stats.registeredFrameworks).toBe(0);
      expect(stats.totalComponents).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle initialization without signal manager gracefully', async () => {
      const newSynchronizer = new CrossFrameworkSynchronizer();
      
      const snapshot: FrameworkSyncSnapshot = {
        connections: [],
        signalValues: new Map([['test', 'value']]),
        subscriptions: new Map(),
        timestamp: Date.now()
      };

      const success = await newSynchronizer.restoreSyncSnapshot(snapshot);
      expect(success).toBe(false);
    });

    it('should handle validation without managers gracefully', async () => {
      const newSynchronizer = new CrossFrameworkSynchronizer();
      
      const isValid = await newSynchronizer.validateSignalConnections();
      expect(isValid).toBe(false);
    });

    it('should handle synchronization without managers gracefully', async () => {
      const newSynchronizer = new CrossFrameworkSynchronizer();
      
      const success = await newSynchronizer.synchronizeFrameworks();
      expect(success).toBe(false); // Should return false when managers are not initialized
    });
  });
});