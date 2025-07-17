import { describe, it, expect } from 'vitest';
import {
  serializeStateSnapshot,
  deserializeStateSnapshot,
  validateStateSnapshot,
  cloneStateSnapshot,
  mergeStateSnapshots,
  getSnapshotStats,
  isSnapshotStale,
  compressStateSnapshot
} from '../state-serialization.js';
import type { StateSnapshot } from '../types/state-preservation.js';

describe('State Serialization', () => {
  let testSnapshot: StateSnapshot;

  beforeEach(() => {
    testSnapshot = {
      signals: {
        globalSignals: new Map([
          ['signal1', 'value1'],
          ['signal2', { nested: 'object', count: 42 }],
          ['signal3', null]
        ]),
        signalSubscriptions: new Map([
          ['signal1', ['comp1', 'comp2']],
          ['signal2', ['comp3']]
        ]),
        timestamp: 1234567890
      },
      subscriptions: {
        eventSubscriptions: new Map([
          ['event1', [
            { event: 'event1', componentId: 'comp1', callbackId: 'callback_1' },
            { event: 'event1', componentId: 'comp2', callbackId: 'callback_2' }
          ]],
          ['event2', [
            { event: 'event2', componentId: 'comp3', callbackId: 'callback_3' }
          ]]
        ]),
        componentEventMap: new Map([
          ['comp1', ['event1']],
          ['comp2', ['event1']],
          ['comp3', ['event2']]
        ]),
        timestamp: 1234567890
      },
      components: new Map([
        ['comp1', {
          componentId: 'comp1',
          frameworkType: 'react',
          localState: { count: 1 },
          props: { title: 'Test' },
          metamonConnections: [
            { type: 'signal', key: 'signal1', direction: 'subscribe' }
          ],
          timestamp: 1234567890
        }]
      ]),
      timestamp: 1234567890
    };
  });

  describe('serializeStateSnapshot', () => {
    it('should serialize a complete state snapshot to JSON', () => {
      const serialized = serializeStateSnapshot(testSnapshot);
      
      expect(typeof serialized).toBe('string');
      expect(() => JSON.parse(serialized)).not.toThrow();
      
      const parsed = JSON.parse(serialized);
      expect(parsed.timestamp).toBe(1234567890);
      expect(Array.isArray(parsed.signals.globalSignals)).toBe(true);
      expect(Array.isArray(parsed.subscriptions.eventSubscriptions)).toBe(true);
    });

    it('should handle empty snapshots', () => {
      const emptySnapshot: StateSnapshot = {
        signals: {
          globalSignals: new Map(),
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

      const serialized = serializeStateSnapshot(emptySnapshot);
      expect(typeof serialized).toBe('string');
      
      const parsed = JSON.parse(serialized);
      expect(parsed.signals.globalSignals).toEqual([]);
      expect(parsed.subscriptions.eventSubscriptions).toEqual([]);
    });

    it('should handle complex nested objects in signal values', () => {
      const complexSnapshot: StateSnapshot = {
        ...testSnapshot,
        signals: {
          ...testSnapshot.signals,
          globalSignals: new Map([
            ['complex', {
              nested: {
                deeply: {
                  value: [1, 2, 3],
                  map: { a: 1, b: 2 }
                }
              }
            }]
          ])
        }
      };

      const serialized = serializeStateSnapshot(complexSnapshot);
      expect(() => JSON.parse(serialized)).not.toThrow();
    });

    it('should handle non-serializable values by omitting them', () => {
      const snapshotWithFunction: StateSnapshot = {
        ...testSnapshot,
        signals: {
          ...testSnapshot.signals,
          globalSignals: new Map([
            ['valid', 'string-value'],
            ['invalid', () => {}] // Functions are not serializable but won't throw
          ])
        }
      };

      const serialized = serializeStateSnapshot(snapshotWithFunction);
      const parsed = JSON.parse(serialized);
      
      // The function should be omitted from serialization
      const signalEntries = parsed.signals.globalSignals;
      const validEntry = signalEntries.find((entry: any) => entry[0] === 'valid');
      const invalidEntry = signalEntries.find((entry: any) => entry[0] === 'invalid');
      
      expect(validEntry).toBeDefined();
      expect(validEntry[1]).toBe('string-value');
      expect(invalidEntry[1]).toBeNull(); // Function becomes null in JSON
    });
  });

  describe('deserializeStateSnapshot', () => {
    it('should deserialize a JSON string back to StateSnapshot', () => {
      const serialized = serializeStateSnapshot(testSnapshot);
      const deserialized = deserializeStateSnapshot(serialized);

      expect(deserialized.timestamp).toBe(testSnapshot.timestamp);
      expect(deserialized.signals.globalSignals.get('signal1')).toBe('value1');
      expect(deserialized.signals.globalSignals.get('signal2')).toEqual({ nested: 'object', count: 42 });
      expect(deserialized.subscriptions.eventSubscriptions.has('event1')).toBe(true);
      expect(deserialized.components.has('comp1')).toBe(true);
    });

    it('should preserve Map structures', () => {
      const serialized = serializeStateSnapshot(testSnapshot);
      const deserialized = deserializeStateSnapshot(serialized);

      expect(deserialized.signals.globalSignals instanceof Map).toBe(true);
      expect(deserialized.signals.signalSubscriptions instanceof Map).toBe(true);
      expect(deserialized.subscriptions.eventSubscriptions instanceof Map).toBe(true);
      expect(deserialized.subscriptions.componentEventMap instanceof Map).toBe(true);
      expect(deserialized.components instanceof Map).toBe(true);
    });

    it('should throw error for invalid JSON', () => {
      expect(() => deserializeStateSnapshot('invalid json')).toThrow();
    });

    it('should throw error for malformed snapshot structure', () => {
      const invalidJson = JSON.stringify({ invalid: 'structure' });
      expect(() => deserializeStateSnapshot(invalidJson)).toThrow();
    });
  });

  describe('validateStateSnapshot', () => {
    it('should validate a correct state snapshot', () => {
      expect(validateStateSnapshot(testSnapshot)).toBe(true);
    });

    it('should reject null or undefined', () => {
      expect(validateStateSnapshot(null)).toBe(false);
      expect(validateStateSnapshot(undefined)).toBe(false);
    });

    it('should reject objects missing required properties', () => {
      const incomplete = { timestamp: Date.now() };
      expect(validateStateSnapshot(incomplete)).toBe(false);
    });

    it('should reject objects with wrong property types', () => {
      const wrongTypes = {
        ...testSnapshot,
        signals: 'not an object'
      };
      expect(validateStateSnapshot(wrongTypes)).toBe(false);
    });

    it('should reject objects with non-Map properties', () => {
      const wrongMaps = {
        ...testSnapshot,
        signals: {
          ...testSnapshot.signals,
          globalSignals: [] // Should be Map, not array
        }
      };
      expect(validateStateSnapshot(wrongMaps)).toBe(false);
    });
  });

  describe('cloneStateSnapshot', () => {
    it('should create a deep clone of the snapshot', () => {
      const cloned = cloneStateSnapshot(testSnapshot);

      expect(cloned).not.toBe(testSnapshot);
      expect(cloned.signals).not.toBe(testSnapshot.signals);
      expect(cloned.signals.globalSignals).not.toBe(testSnapshot.signals.globalSignals);
      
      // But values should be equal
      expect(cloned.timestamp).toBe(testSnapshot.timestamp);
      expect(cloned.signals.globalSignals.get('signal1')).toBe(testSnapshot.signals.globalSignals.get('signal1'));
    });

    it('should handle modifications to cloned snapshot without affecting original', () => {
      const cloned = cloneStateSnapshot(testSnapshot);
      
      cloned.signals.globalSignals.set('new-signal', 'new-value');
      
      expect(testSnapshot.signals.globalSignals.has('new-signal')).toBe(false);
      expect(cloned.signals.globalSignals.has('new-signal')).toBe(true);
    });
  });

  describe('mergeStateSnapshots', () => {
    it('should merge two snapshots with overlay taking precedence', () => {
      const baseSnapshot: StateSnapshot = {
        signals: {
          globalSignals: new Map([['signal1', 'base-value']]),
          signalSubscriptions: new Map([['signal1', ['comp1']]]),
          timestamp: 1000
        },
        subscriptions: {
          eventSubscriptions: new Map([['event1', []]]),
          componentEventMap: new Map([['comp1', ['event1']]]),
          timestamp: 1000
        },
        components: new Map(),
        timestamp: 1000
      };

      const overlaySnapshot: StateSnapshot = {
        signals: {
          globalSignals: new Map([['signal1', 'overlay-value'], ['signal2', 'new-value']]),
          signalSubscriptions: new Map([['signal2', ['comp2']]]),
          timestamp: 2000
        },
        subscriptions: {
          eventSubscriptions: new Map([['event2', []]]),
          componentEventMap: new Map([['comp2', ['event2']]]),
          timestamp: 2000
        },
        components: new Map(),
        timestamp: 2000
      };

      const merged = mergeStateSnapshots(baseSnapshot, overlaySnapshot);

      expect(merged.signals.globalSignals.get('signal1')).toBe('overlay-value');
      expect(merged.signals.globalSignals.get('signal2')).toBe('new-value');
      expect(merged.signals.signalSubscriptions.has('signal1')).toBe(true);
      expect(merged.signals.signalSubscriptions.has('signal2')).toBe(true);
      expect(merged.timestamp).toBe(2000); // Should use the later timestamp
    });
  });

  describe('getSnapshotStats', () => {
    it('should return correct statistics', () => {
      const stats = getSnapshotStats(testSnapshot);

      expect(stats.signalCount).toBe(3);
      expect(stats.subscriptionCount).toBe(3); // 2 for event1 + 1 for event2
      expect(stats.componentCount).toBe(1);
      expect(typeof stats.totalSize).toBe('number');
      expect(stats.totalSize).toBeGreaterThan(0);
      expect(typeof stats.age).toBe('number');
    });

    it('should handle empty snapshots', () => {
      const emptySnapshot: StateSnapshot = {
        signals: {
          globalSignals: new Map(),
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

      const stats = getSnapshotStats(emptySnapshot);

      expect(stats.signalCount).toBe(0);
      expect(stats.subscriptionCount).toBe(0);
      expect(stats.componentCount).toBe(0);
    });
  });

  describe('isSnapshotStale', () => {
    it('should identify fresh snapshots as not stale', () => {
      const freshSnapshot: StateSnapshot = {
        ...testSnapshot,
        timestamp: Date.now()
      };

      expect(isSnapshotStale(freshSnapshot, 30000)).toBe(false);
    });

    it('should identify old snapshots as stale', () => {
      const staleSnapshot: StateSnapshot = {
        ...testSnapshot,
        timestamp: Date.now() - 60000 // 1 minute ago
      };

      expect(isSnapshotStale(staleSnapshot, 30000)).toBe(true);
    });
  });

  describe('compressStateSnapshot', () => {
    it('should remove empty or null values', () => {
      const snapshotWithEmpties: StateSnapshot = {
        signals: {
          globalSignals: new Map([
            ['signal1', 'value1'],
            ['signal2', null],
            ['signal3', undefined],
            ['signal4', '']
          ]),
          signalSubscriptions: new Map([
            ['signal1', ['comp1']],
            ['signal2', []]
          ]),
          timestamp: Date.now()
        },
        subscriptions: {
          eventSubscriptions: new Map([
            ['event1', [{ event: 'event1', componentId: 'comp1', callbackId: 'cb1' }]],
            ['event2', []]
          ]),
          componentEventMap: new Map([
            ['comp1', ['event1']],
            ['comp2', []]
          ]),
          timestamp: Date.now()
        },
        components: new Map(),
        timestamp: Date.now()
      };

      const compressed = compressStateSnapshot(snapshotWithEmpties);

      expect(compressed.signals.globalSignals.has('signal1')).toBe(true);
      expect(compressed.signals.globalSignals.has('signal2')).toBe(false); // null removed
      expect(compressed.signals.globalSignals.has('signal3')).toBe(false); // undefined removed
      expect(compressed.signals.globalSignals.has('signal4')).toBe(true); // empty string kept
      
      expect(compressed.signals.signalSubscriptions.has('signal1')).toBe(true);
      expect(compressed.signals.signalSubscriptions.has('signal2')).toBe(false); // empty array removed
      
      expect(compressed.subscriptions.eventSubscriptions.has('event1')).toBe(true);
      expect(compressed.subscriptions.eventSubscriptions.has('event2')).toBe(false); // empty array removed
      
      expect(compressed.subscriptions.componentEventMap.has('comp1')).toBe(true);
      expect(compressed.subscriptions.componentEventMap.has('comp2')).toBe(false); // empty array removed
    });

    it('should preserve all components even if they appear empty', () => {
      const snapshotWithComponents: StateSnapshot = {
        ...testSnapshot,
        components: new Map([
          ['comp1', {
            componentId: 'comp1',
            frameworkType: 'react',
            localState: {},
            props: {},
            metamonConnections: [],
            timestamp: Date.now()
          }]
        ])
      };

      const compressed = compressStateSnapshot(snapshotWithComponents);

      expect(compressed.components.has('comp1')).toBe(true);
    });
  });

  describe('round-trip serialization', () => {
    it('should maintain data integrity through serialize/deserialize cycle', () => {
      const serialized = serializeStateSnapshot(testSnapshot);
      const deserialized = deserializeStateSnapshot(serialized);

      expect(validateStateSnapshot(deserialized)).toBe(true);
      
      // Check specific values
      expect(deserialized.signals.globalSignals.get('signal1')).toBe(testSnapshot.signals.globalSignals.get('signal1'));
      expect(deserialized.signals.globalSignals.get('signal2')).toEqual(testSnapshot.signals.globalSignals.get('signal2'));
      expect(deserialized.subscriptions.eventSubscriptions.get('event1')).toEqual(testSnapshot.subscriptions.eventSubscriptions.get('event1'));
      
      // Check Map sizes
      expect(deserialized.signals.globalSignals.size).toBe(testSnapshot.signals.globalSignals.size);
      expect(deserialized.subscriptions.eventSubscriptions.size).toBe(testSnapshot.subscriptions.eventSubscriptions.size);
      expect(deserialized.components.size).toBe(testSnapshot.components.size);
    });
  });
});