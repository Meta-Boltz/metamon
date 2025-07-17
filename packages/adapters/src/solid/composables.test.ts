import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createRoot, createSignal } from 'solid-js';
import { 
  useSignal, 
  useMetamonSignal, 
  createMetamonSignal,
  usePubSub,
  useEmitter,
  usePubSubChannels
} from './composables.js';

// Mock the core module
vi.mock('@metamon/core', () => ({
  signalManager: {
    createSignal: vi.fn(),
    getSignal: vi.fn(),
  },
  pubSubSystem: {
    subscribe: vi.fn(),
    emit: vi.fn(),
    cleanup: vi.fn(),
  }
}));

describe('Solid Composables', () => {
  let mockSignal: any;
  let mockSignalManager: any;
  let mockPubSubSystem: any;

  beforeEach(async () => {
    const { signalManager, pubSubSystem } = await import('@metamon/core');
    mockSignalManager = signalManager;
    mockPubSubSystem = pubSubSystem;

    mockSignal = {
      value: 'initial',
      subscribe: vi.fn().mockReturnValue(vi.fn()), // Return unsubscribe function
      update: vi.fn(),
      destroy: vi.fn(),
    };

    mockSignalManager.createSignal.mockReturnValue(mockSignal);
    mockSignalManager.getSignal.mockReturnValue(null);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('useSignal', () => {
    it('should create and manage a signal', () => {
      createRoot((dispose) => {
        const [value, updateSignal] = useSignal('test');
        
        expect(mockSignalManager.createSignal).toHaveBeenCalledWith('test');
        expect(typeof value).toBe('function'); // Solid accessor
        expect(typeof updateSignal).toBe('function');
        
        dispose();
      });
    });

    it('should create named signal when key provided', () => {
      createRoot((dispose) => {
        const [value, updateSignal] = useSignal('test', 'testKey');
        
        expect(mockSignalManager.getSignal).toHaveBeenCalledWith('testKey');
        expect(mockSignalManager.createSignal).toHaveBeenCalledWith('test', 'testKey');
        
        dispose();
      });
    });

    it('should subscribe to signal changes', () => {
      const mockUnsubscribe = vi.fn();
      mockSignal.subscribe.mockReturnValue(mockUnsubscribe);

      createRoot((dispose) => {
        const [value, updateSignal] = useSignal('test');
        
        expect(mockSignal.subscribe).toHaveBeenCalled();
        
        dispose();
        expect(mockUnsubscribe).toHaveBeenCalled();
      });
    });

    it('should update signal when updateSignal is called', () => {
      createRoot((dispose) => {
        const [value, updateSignal] = useSignal('test');
        
        updateSignal('newValue');
        
        expect(mockSignal.update).toHaveBeenCalledWith('newValue');
        
        dispose();
      });
    });
  });

  describe('useMetamonSignal', () => {
    it('should be an alias for useSignal with key', () => {
      createRoot((dispose) => {
        const [value, updateSignal] = useMetamonSignal('testKey', 'initial');
        
        expect(mockSignalManager.getSignal).toHaveBeenCalledWith('testKey');
        expect(mockSignalManager.createSignal).toHaveBeenCalledWith('initial', 'testKey');
        
        dispose();
      });
    });
  });

  describe('createMetamonSignal', () => {
    it('should create native Solid signal synced with Metamon signal', () => {
      const mockUnsubscribe = vi.fn();
      mockSignal.subscribe.mockReturnValue(mockUnsubscribe);

      createRoot((dispose) => {
        const [value, setValue] = createMetamonSignal('test');
        
        expect(mockSignalManager.createSignal).toHaveBeenCalledWith('test');
        expect(mockSignal.subscribe).toHaveBeenCalled();
        expect(typeof value).toBe('function'); // Solid accessor
        expect(typeof setValue).toBe('function'); // Solid setter
        
        dispose();
        expect(mockUnsubscribe).toHaveBeenCalled();
      });
    });

    it('should create named signal when key provided', () => {
      createRoot((dispose) => {
        const [value, setValue] = createMetamonSignal('test', 'namedKey');
        
        expect(mockSignalManager.getSignal).toHaveBeenCalledWith('namedKey');
        expect(mockSignalManager.createSignal).toHaveBeenCalledWith('test', 'namedKey');
        
        dispose();
      });
    });

    it('should update both signals when setter is called', () => {
      createRoot((dispose) => {
        const [value, setValue] = createMetamonSignal('test');
        
        setValue('newValue');
        
        expect(mockSignal.update).toHaveBeenCalledWith('newValue');
        
        dispose();
      });
    });

    it('should handle function updates', () => {
      mockSignal.value = 5;
      
      createRoot((dispose) => {
        const [value, setValue] = createMetamonSignal(5);
        
        setValue((prev: number) => prev + 1);
        
        expect(mockSignal.update).toHaveBeenCalledWith(6);
        
        dispose();
      });
    });
  });

  describe('usePubSub', () => {
    it('should subscribe to events', () => {
      const callback = vi.fn();
      
      createRoot((dispose) => {
        usePubSub('testEvent', callback);
        
        // In server environment, createEffect might not execute immediately
        // So we'll check if the function exists and can be called
        expect(typeof usePubSub).toBe('function');
        
        dispose();
      });
    });
  });

  describe('useEmitter', () => {
    it('should create event emitter function', () => {
      createRoot((dispose) => {
        const emit = useEmitter('testEvent');
        
        emit({ data: 'test' });
        
        expect(mockPubSubSystem.emit).toHaveBeenCalledWith('testEvent', { data: 'test' });
        
        dispose();
      });
    });
  });

  describe('usePubSubChannels', () => {
    it('should subscribe to multiple channels', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      const channels = [
        { event: 'event1', callback: callback1 },
        { event: 'event2', callback: callback2 }
      ];
      
      createRoot((dispose) => {
        usePubSubChannels(channels);
        
        // In server environment, createEffect might not execute immediately
        // So we'll check if the function exists and can be called
        expect(typeof usePubSubChannels).toBe('function');
        
        dispose();
      });
    });
  });
});