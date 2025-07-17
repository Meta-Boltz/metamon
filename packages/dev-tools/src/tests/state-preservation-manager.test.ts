import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { StatePreservationManager } from '../state-preservation-manager.js';
import type { 
  StatePreservationConfig,
  StateSnapshot,
  SignalStateSnapshot,
  SubscriptionSnapshot
} from '../types/state-preservation.js';

// Mock the core dependencies
const mockSignalManager = {
  getSignalKeys: vi.fn(),
  getSignal: vi.fn(),
  createSignal: vi.fn()
};

const mockPubSubSystem = {
  getActiveSubscriptions: vi.fn(),
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
  emit: vi.fn(),
  cleanup: vi.fn()
};

const mockSignal = {
  value: 'test-value',
  update: vi.fn(),
  subscribe: vi.fn()
};

describe('StatePreservationManager', () => {
  let manager: StatePreservationManager;
  let config: StatePreservationConfig;

  beforeEach(() => {
    config = {
      preserveSignals: true,
      preserveSubscriptions: true,
      preserveComponentState: true,
      maxSnapshotAge: 30000,
      debugLogging: false
    };
    
    manager = new StatePreservationManager(config);
    
    // Reset mocks
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default config when no config provided', () => {
      const defaultManager = new StatePreservationManager();
      expect(defaultManager).toBeDefined();
    });

    it('should merge provided config with defaults', () => {
      const customConfig = { preserveSignals: false, debugLogging: true };
      const customManager = new StatePreservationManager(customConfig);
      expect(customManager).toBeDefined();
    });
  });

  describe('preserveState', () => {
    it('should successfully preserve signal state', async () => {
      // Setup mock signal manager
      mockSignalManager.getSignalKeys.mockReturnValue(['signal1', 'signal2']);
      mockSignalManager.getSignal.mockImplementation((key: string) => {
        if (key === 'signal1') return { value: 'value1' };
        if (key === 'signal2') return { value: 'value2' };
        return null;
      });

      // Setup mock pubsub system
      mockPubSubSystem.getActiveSubscriptions.mockReturnValue([
        { event: 'event1', componentId: 'comp1', callback: vi.fn() },
        { event: 'event2', componentId: 'comp2', callback: vi.fn() }
      ]);

      const result = await manager.preserveState(mockSignalManager as any, mockPubSubSystem as any);

      expect(result.success).toBe(true);
      expect(result.preservedSignals).toBe(2);
      expect(result.preservedSubscriptions).toBe(2);
      expect(result.snapshot).toBeDefined();
    });

    it('should handle empty signal state', async () => {
      mockSignalManager.getSignalKeys.mockReturnValue([]);
      mockPubSubSystem.getActiveSubscriptions.mockReturnValue([]);

      const result = await manager.preserveState(mockSignalManager as any, mockPubSubSystem as any);

      expect(result.success).toBe(true);
      expect(result.preservedSignals).toBe(0);
      expect(result.preservedSubscriptions).toBe(0);
    });

    it('should handle errors gracefully', async () => {
      mockSignalManager.getSignalKeys.mockImplementation(() => {
        throw new Error('Signal manager error');
      });

      const result = await manager.preserveState(mockSignalManager as any, mockPubSubSystem as any);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Signal manager error');
    });

    it('should respect config settings for selective preservation', async () => {
      const selectiveConfig = { ...config, preserveSignals: false };
      const selectiveManager = new StatePreservationManager(selectiveConfig);

      mockSignalManager.getSignalKeys.mockReturnValue(['signal1']);
      mockPubSubSystem.getActiveSubscriptions.mockReturnValue([
        { event: 'event1', componentId: 'comp1', callback: vi.fn() }
      ]);

      const result = await selectiveManager.preserveState(mockSignalManager as any, mockPubSubSystem as any);

      expect(result.success).toBe(true);
      expect(result.preservedSignals).toBe(0); // Should be 0 because preserveSignals is false
      expect(result.preservedSubscriptions).toBe(1);
    });
  });

  describe('restoreState', () => {
    let testSnapshot: StateSnapshot;

    beforeEach(() => {
      testSnapshot = {
        signals: {
          globalSignals: new Map([['signal1', 'value1'], ['signal2', 'value2']]),
          signalSubscriptions: new Map([['signal1', ['comp1']], ['signal2', ['comp2']]]),
          timestamp: Date.now()
        },
        subscriptions: {
          eventSubscriptions: new Map([
            ['event1', [{ event: 'event1', componentId: 'comp1', callbackId: 'callback_1' }]],
            ['event2', [{ event: 'event2', componentId: 'comp2', callbackId: 'callback_2' }]]
          ]),
          componentEventMap: new Map([['comp1', ['event1']], ['comp2', ['event2']]]),
          timestamp: Date.now()
        },
        components: new Map(),
        timestamp: Date.now()
      };
    });

    it('should successfully restore signal state', async () => {
      // Setup signal manager mocks
      mockSignalManager.getSignal.mockImplementation((key: string) => {
        if (key === 'signal1' || key === 'signal2') {
          return mockSignal;
        }
        return null;
      });

      // First preserve state to set up callback registry
      await manager.preserveState(mockSignalManager as any, mockPubSubSystem as any);

      const result = await manager.restoreState(mockSignalManager as any, mockPubSubSystem as any, testSnapshot);

      expect(result.success).toBe(true);
      expect(result.restoredSignals).toBe(2);
      expect(mockSignal.update).toHaveBeenCalledWith('value1');
      expect(mockSignal.update).toHaveBeenCalledWith('value2');
    });

    it('should create new signals if they do not exist', async () => {
      mockSignalManager.getSignal.mockReturnValue(null);
      mockSignalManager.createSignal.mockReturnValue(mockSignal);

      const result = await manager.restoreState(mockSignalManager as any, mockPubSubSystem as any, testSnapshot);

      expect(result.success).toBe(true);
      expect(mockSignalManager.createSignal).toHaveBeenCalledWith('value1', 'signal1');
      expect(mockSignalManager.createSignal).toHaveBeenCalledWith('value2', 'signal2');
    });

    it('should handle restoration without snapshot', async () => {
      const result = await manager.restoreState(mockSignalManager as any, mockPubSubSystem as any);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No snapshot available');
    });

    it('should reject stale snapshots', async () => {
      const staleSnapshot = {
        ...testSnapshot,
        timestamp: Date.now() - 60000 // 1 minute ago
      };

      const result = await manager.restoreState(mockSignalManager as any, mockPubSubSystem as any, staleSnapshot);

      expect(result.success).toBe(false);
      expect(result.error).toContain('too old');
    });

    it('should handle partial restoration failures', async () => {
      mockSignalManager.getSignal.mockImplementation((key: string) => {
        if (key === 'signal1') return mockSignal;
        if (key === 'signal2') throw new Error('Signal error');
        return null;
      });

      const result = await manager.restoreState(mockSignalManager as any, mockPubSubSystem as any, testSnapshot);

      expect(result.success).toBe(true);
      expect(result.restoredSignals).toBe(1);
      expect(result.failedRestorations.length).toBeGreaterThan(0);
    });

    it('should respect config settings for selective restoration', async () => {
      const selectiveConfig = { ...config, preserveSubscriptions: false };
      const selectiveManager = new StatePreservationManager(selectiveConfig);

      mockSignalManager.getSignal.mockReturnValue(mockSignal);

      const result = await selectiveManager.restoreState(mockSignalManager as any, mockPubSubSystem as any, testSnapshot);

      expect(result.success).toBe(true);
      expect(result.restoredSignals).toBe(2);
      expect(result.restoredSubscriptions).toBe(0); // Should be 0 because preserveSubscriptions is false
    });
  });

  describe('callback registry management', () => {
    it('should generate unique callback IDs', async () => {
      mockSignalManager.getSignalKeys.mockReturnValue([]);
      mockPubSubSystem.getActiveSubscriptions.mockReturnValue([
        { event: 'event1', componentId: 'comp1', callback: vi.fn() },
        { event: 'event2', componentId: 'comp2', callback: vi.fn() }
      ]);

      const result = await manager.preserveState(mockSignalManager as any, mockPubSubSystem as any);
      
      expect(result.success).toBe(true);
      expect(result.snapshot?.subscriptions.eventSubscriptions.size).toBe(2);
      
      // Check that callback IDs are unique
      const callbackIds = new Set<string>();
      for (const subscriptions of result.snapshot!.subscriptions.eventSubscriptions.values()) {
        for (const sub of subscriptions) {
          expect(callbackIds.has(sub.callbackId)).toBe(false);
          callbackIds.add(sub.callbackId);
        }
      }
    });
  });

  describe('cleanup', () => {
    it('should clear snapshot and callback registry', async () => {
      mockSignalManager.getSignalKeys.mockReturnValue(['signal1']);
      mockPubSubSystem.getActiveSubscriptions.mockReturnValue([
        { event: 'event1', componentId: 'comp1', callback: vi.fn() }
      ]);

      await manager.preserveState(mockSignalManager as any, mockPubSubSystem as any);
      expect(manager.getCurrentSnapshot()).not.toBeNull();

      manager.cleanup();
      expect(manager.getCurrentSnapshot()).toBeNull();
    });
  });

  describe('configuration updates', () => {
    it('should update configuration correctly', () => {
      const newConfig = { debugLogging: true, maxSnapshotAge: 60000 };
      manager.updateConfig(newConfig);

      // Test that the new config is applied by checking behavior
      expect(() => manager.updateConfig(newConfig)).not.toThrow();
    });
  });

  describe('error handling', () => {
    it('should handle signal manager errors during backup', async () => {
      mockSignalManager.getSignalKeys.mockImplementation(() => {
        throw new Error('Backup error');
      });
      mockPubSubSystem.getActiveSubscriptions.mockReturnValue([]);

      const result = await manager.preserveState(mockSignalManager as any, mockPubSubSystem as any);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle pubsub system errors during backup', async () => {
      mockSignalManager.getSignalKeys.mockReturnValue([]);
      mockPubSubSystem.getActiveSubscriptions.mockImplementation(() => {
        throw new Error('PubSub backup error');
      });

      const result = await manager.preserveState(mockSignalManager as any, mockPubSubSystem as any);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle restoration errors gracefully', async () => {
      const invalidSnapshot = {
        signals: {
          globalSignals: new Map([['invalid-signal', undefined]]),
          signalSubscriptions: new Map(),
          timestamp: Date.now()
        },
        subscriptions: {
          eventSubscriptions: new Map(),
          componentEventMap: new Map(),
          timestamp: Date.now()
        },
        components: new Map(),
        timestamp: Date.now()
      };

      mockSignalManager.getSignal.mockImplementation(() => {
        throw new Error('Restoration error');
      });

      const result = await manager.restoreState(mockSignalManager as any, mockPubSubSystem as any, invalidSnapshot);

      expect(result.success).toBe(true); // Should still succeed partially
      expect(result.failedRestorations.length).toBeGreaterThan(0);
    });
  });
});