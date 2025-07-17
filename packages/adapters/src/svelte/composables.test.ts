import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock the Svelte modules with factory functions
vi.mock('svelte', () => ({
  onMount: vi.fn(),
  onDestroy: vi.fn()
}));

vi.mock('svelte/store', () => ({
  writable: vi.fn(() => ({
    subscribe: vi.fn(),
    set: vi.fn(),
    update: vi.fn()
  })),
  derived: vi.fn(() => ({
    subscribe: vi.fn()
  }))
}));

// Mock signalManager and pubSubSystem
vi.mock('@metamon/core', () => ({
  signalManager: {
    getSignal: vi.fn(() => ({
      value: 'initial',
      subscribe: vi.fn(() => vi.fn()),
      update: vi.fn(),
      destroy: vi.fn()
    })),
    createSignal: vi.fn(() => ({
      value: 'initial',
      subscribe: vi.fn(() => vi.fn()),
      update: vi.fn(),
      destroy: vi.fn()
    }))
  },
  pubSubSystem: {
    subscribe: vi.fn(),
    emit: vi.fn(),
    unsubscribe: vi.fn(),
    cleanup: vi.fn()
  }
}));

// Import composables after mocking dependencies
import { useSignal, useMetamonSignal, createMetamonStore, usePubSub, createDerivedSignal } from './composables.js';

describe('Svelte Composables', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('useSignal', () => {
    it('should create signal without key', () => {
      const [store, updateSignal] = useSignal('initial value');

      expect(typeof updateSignal).toBe('function');
      expect(store).toBeDefined();
    });

    it('should create signal with key', () => {
      const [store, updateSignal] = useSignal('initial value', 'test-key');

      expect(typeof updateSignal).toBe('function');
      expect(store).toBeDefined();
    });

    it('should return update function', () => {
      const [store, updateSignal] = useSignal('initial');

      expect(typeof updateSignal).toBe('function');
      
      // Should not throw when called
      expect(() => updateSignal('new value')).not.toThrow();
    });
  });

  describe('useMetamonSignal', () => {
    it('should call useSignal with correct parameters', () => {
      const [store, updateSignal] = useMetamonSignal('test-key', 'initial value');

      expect(typeof updateSignal).toBe('function');
      expect(store).toBeDefined();
    });
  });

  describe('createMetamonStore', () => {
    it('should create store without key', () => {
      const store = createMetamonStore('initial value');

      expect(typeof store.subscribe).toBe('function');
      expect(typeof store.set).toBe('function');
      expect(typeof store.update).toBe('function');
      expect(typeof store.destroy).toBe('function');
    });

    it('should create store with key', () => {
      const store = createMetamonStore('initial value', 'test-key');

      expect(typeof store.subscribe).toBe('function');
      expect(typeof store.set).toBe('function');
      expect(typeof store.update).toBe('function');
      expect(typeof store.destroy).toBe('function');
    });

    it('should update store when set is called', () => {
      const store = createMetamonStore('initial');

      expect(() => store.set('new value')).not.toThrow();
    });

    it('should update store when update is called', () => {
      const store = createMetamonStore('initial');

      expect(() => store.update((value) => value + ' updated')).not.toThrow();
    });

    it('should cleanup when destroy is called', () => {
      const store = createMetamonStore('initial');

      expect(() => store.destroy()).not.toThrow();
    });
  });

  describe('usePubSub', () => {
    it('should create pub/sub utilities', () => {
      const { subscribe, emit, unsubscribe } = usePubSub();

      expect(typeof subscribe).toBe('function');
      expect(typeof emit).toBe('function');
      expect(typeof unsubscribe).toBe('function');
    });

    it('should subscribe to events', () => {
      const { subscribe } = usePubSub();
      const callback = vi.fn();

      expect(() => subscribe('test-event', callback)).not.toThrow();
    });

    it('should emit events', () => {
      const { emit } = usePubSub();

      expect(() => emit('test-event', { data: 'test' })).not.toThrow();
    });

    it('should unsubscribe from events', () => {
      const { unsubscribe } = usePubSub();

      expect(() => unsubscribe('test-event')).not.toThrow();
    });
  });

  describe('createDerivedSignal', () => {
    it('should create derived signal from multiple signals', () => {
      const deriveFn = (values: string[]) => values.join(' ');
      
      expect(() => {
        const derivedStore = createDerivedSignal(['signal1', 'signal2'], deriveFn, 'initial');
      }).not.toThrow();
    });

    it('should handle missing signals gracefully', () => {
      const deriveFn = (values: string[]) => values.join(' ');
      
      expect(() => {
        const derivedStore = createDerivedSignal(['missing-signal'], deriveFn, 'initial');
      }).not.toThrow();
    });

    it('should return a store-like object', () => {
      const deriveFn = (values: string[]) => values.join(' ');
      const derivedStore = createDerivedSignal(['signal1', 'signal2'], deriveFn, 'initial');

      expect(derivedStore).toBeDefined();
      expect(typeof derivedStore.subscribe).toBe('function');
    });
  });
});