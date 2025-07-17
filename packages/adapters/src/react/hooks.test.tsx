import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the core dependencies
vi.mock('@metamon/core', () => ({
  signalManager: {
    createSignal: vi.fn(),
    getSignal: vi.fn(),
    destroySignal: vi.fn()
  },
  pubSubSystem: {
    subscribe: vi.fn(),
    emit: vi.fn(),
    cleanup: vi.fn()
  }
}));

// Mock React hooks
let mockSetState = vi.fn();
let mockUseEffectCleanup = vi.fn();

vi.mock('react', () => ({
  useState: vi.fn((initial) => [initial, mockSetState]),
  useEffect: vi.fn((effect, deps) => {
    const cleanup = effect();
    if (cleanup) mockUseEffectCleanup = cleanup;
  }),
  useCallback: vi.fn((fn) => fn),
  useRef: vi.fn((initial) => ({ current: initial }))
}));

describe('React Hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSetState = vi.fn();
    mockUseEffectCleanup = vi.fn();
  });

  describe('useSignal hook implementation', () => {
    it('should call signalManager.createSignal for anonymous signals', async () => {
      const mockSignal = {
        value: 'initial',
        subscribe: vi.fn(() => vi.fn()),
        update: vi.fn()
      };

      const { signalManager } = await import('@metamon/core');
      signalManager.createSignal.mockReturnValue(mockSignal);

      // Import and test the hook
      const { useSignal } = await import('./hooks.js');
      
      // This simulates calling the hook
      useSignal('initial');

      expect(signalManager.createSignal).toHaveBeenCalledWith('initial');
    });

    it('should call signalManager.getSignal for named signals', async () => {
      const mockSignal = {
        value: 'initial',
        subscribe: vi.fn(() => vi.fn()),
        update: vi.fn()
      };

      const { signalManager } = await import('@metamon/core');
      signalManager.getSignal.mockReturnValue(null);
      signalManager.createSignal.mockReturnValue(mockSignal);

      const { useSignal } = await import('./hooks.js');
      
      useSignal('initial', 'testSignal');

      expect(signalManager.getSignal).toHaveBeenCalledWith('testSignal');
      expect(signalManager.createSignal).toHaveBeenCalledWith('initial', 'testSignal');
    });

    it('should use existing named signal when available', async () => {
      const mockSignal = {
        value: 'existing',
        subscribe: vi.fn(() => vi.fn()),
        update: vi.fn()
      };

      const { signalManager } = await import('@metamon/core');
      signalManager.getSignal.mockReturnValue(mockSignal);

      const { useSignal } = await import('./hooks.js');
      
      useSignal('initial', 'testSignal');

      expect(signalManager.getSignal).toHaveBeenCalledWith('testSignal');
      expect(signalManager.createSignal).not.toHaveBeenCalled();
    });
  });

  describe('useMetamonSignal hook implementation', () => {
    it('should be an alias for useSignal with key', async () => {
      const mockSignal = {
        value: 'test',
        subscribe: vi.fn(() => vi.fn()),
        update: vi.fn()
      };

      const { signalManager } = await import('@metamon/core');
      signalManager.getSignal.mockReturnValue(null);
      signalManager.createSignal.mockReturnValue(mockSignal);

      const { useMetamonSignal } = await import('./hooks.js');
      
      useMetamonSignal('namedSignal', 'test');

      expect(signalManager.createSignal).toHaveBeenCalledWith('test', 'namedSignal');
    });
  });

  describe('usePubSub hook implementation', () => {
    it('should subscribe to events', async () => {
      const mockHandler = vi.fn();
      const { pubSubSystem } = await import('@metamon/core');

      const { usePubSub } = await import('./hooks.js');
      
      usePubSub('testEvent', mockHandler);

      expect(pubSubSystem.subscribe).toHaveBeenCalledWith(
        'testEvent',
        mockHandler,
        expect.any(String)
      );
    });

    it('should return emit function', async () => {
      const mockHandler = vi.fn();
      const { pubSubSystem } = await import('@metamon/core');

      const { usePubSub } = await import('./hooks.js');
      
      const emit = usePubSub('testEvent', mockHandler);
      
      expect(typeof emit).toBe('function');
      
      // Test the emit function
      emit({ data: 'test' });
      expect(pubSubSystem.emit).toHaveBeenCalledWith('testEvent', { data: 'test' });
    });
  });

  describe('useEmit hook implementation', () => {
    it('should return emit function for specific event', async () => {
      const { pubSubSystem } = await import('@metamon/core');

      const { useEmit } = await import('./hooks.js');
      
      const emit = useEmit('testEvent');
      
      expect(typeof emit).toBe('function');
      
      emit({ data: 'test' });
      expect(pubSubSystem.emit).toHaveBeenCalledWith('testEvent', { data: 'test' });
    });
  });

  describe('useMetamonLifecycle hook implementation', () => {
    it('should generate component ID', async () => {
      const { useMetamonLifecycle } = await import('./hooks.js');
      
      const componentId = useMetamonLifecycle();
      
      expect(typeof componentId).toBe('string');
      expect(componentId.length).toBeGreaterThan(0);
    });

    it('should use provided component name', async () => {
      const { useMetamonLifecycle } = await import('./hooks.js');
      
      const componentId = useMetamonLifecycle('TestComponent');
      
      expect(componentId).toBe('TestComponent');
    });

    it('should setup cleanup on unmount', async () => {
      const { pubSubSystem } = await import('@metamon/core');
      const { useMetamonLifecycle } = await import('./hooks.js');
      
      const componentId = useMetamonLifecycle();
      
      // Simulate component unmount by calling the cleanup function
      if (mockUseEffectCleanup) {
        mockUseEffectCleanup();
        expect(pubSubSystem.cleanup).toHaveBeenCalledWith(componentId);
      }
    });
  });
});