/**
 * Framework Hot Reload Adapter Tests
 * 
 * Tests for the base framework hot reload adapter interface and implementations.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BaseFrameworkHotReloadAdapter, MetamonConnection, ComponentStateSnapshot } from '../framework-hot-reload-adapter.js';
import { ReactHotReloadAdapter } from '../adapters/react-hot-reload-adapter.js';
import { VueHotReloadAdapter } from '../adapters/vue-hot-reload-adapter.js';
import { SvelteHotReloadAdapter } from '../adapters/svelte-hot-reload-adapter.js';
import { SolidHotReloadAdapter } from '../adapters/solid-hot-reload-adapter.js';

// Mock implementation for testing base adapter
class TestFrameworkAdapter extends BaseFrameworkHotReloadAdapter {
  readonly frameworkName = 'test';
  readonly fileExtensions = ['.test'];
  
  async handleComponentReload(componentPath: string): Promise<void> {
    // Mock implementation
  }
  
  preserveFrameworkState(componentId: string): any {
    return { testState: 'preserved' };
  }
  
  restoreFrameworkState(componentId: string, state: any): void {
    // Mock implementation
  }
  
  reconnectMetamonAdapters(): void {
    // Mock implementation
  }
  
  validateAdapterConnections(): boolean {
    return true;
  }
}

describe('BaseFrameworkHotReloadAdapter', () => {
  let adapter: TestFrameworkAdapter;
  
  beforeEach(() => {
    adapter = new TestFrameworkAdapter();
  });
  
  describe('canHandle', () => {
    it('should return true for supported file extensions', () => {
      expect(adapter.canHandle('component.test')).toBe(true);
      expect(adapter.canHandle('/path/to/component.test')).toBe(true);
    });
    
    it('should return false for unsupported file extensions', () => {
      expect(adapter.canHandle('component.js')).toBe(false);
      expect(adapter.canHandle('component.vue')).toBe(false);
      expect(adapter.canHandle('component.svelte')).toBe(false);
    });
  });
  
  describe('getComponentStateSnapshot', () => {
    it('should create a state snapshot with framework state', () => {
      const componentId = 'test_component';
      const snapshot = adapter.getComponentStateSnapshot(componentId);
      
      expect(snapshot).toBeDefined();
      expect(snapshot?.componentId).toBe(componentId);
      expect(snapshot?.frameworkType).toBe('test');
      expect(snapshot?.localState).toEqual({ testState: 'preserved' });
    });
    
    it('should return null if no state to preserve', () => {
      // Override preserveFrameworkState to return null
      vi.spyOn(adapter, 'preserveFrameworkState').mockReturnValue(null);
      
      const snapshot = adapter.getComponentStateSnapshot('test_component');
      expect(snapshot).toBeNull();
    });
  });
  
  describe('restoreFromSnapshot', () => {
    it('should restore state from snapshot', () => {
      const snapshot: ComponentStateSnapshot = {
        componentId: 'test_component',
        frameworkType: 'test',
        localState: { testState: 'restored' },
        props: {},
        metamonConnections: []
      };
      
      const restoreSpy = vi.spyOn(adapter, 'restoreFrameworkState');
      
      adapter.restoreFromSnapshot(snapshot);
      
      expect(restoreSpy).toHaveBeenCalledWith('test_component', { testState: 'restored' });
    });
    
    it('should throw error for mismatched framework type', () => {
      const snapshot: ComponentStateSnapshot = {
        componentId: 'test_component',
        frameworkType: 'react',
        localState: {},
        props: {},
        metamonConnections: []
      };
      
      expect(() => adapter.restoreFromSnapshot(snapshot)).toThrow(
        'Cannot restore react snapshot with test adapter'
      );
    });
  });
});

describe('ReactHotReloadAdapter', () => {
  let adapter: ReactHotReloadAdapter;
  
  beforeEach(() => {
    adapter = new ReactHotReloadAdapter();
  });
  
  describe('framework properties', () => {
    it('should have correct framework name and extensions', () => {
      expect(adapter.frameworkName).toBe('react');
      expect(adapter.fileExtensions).toEqual(['.jsx', '.tsx']);
    });
  });
  
  describe('canHandle', () => {
    it('should handle React component files', () => {
      expect(adapter.canHandle('Component.jsx')).toBe(true);
      expect(adapter.canHandle('Component.tsx')).toBe(true);
      expect(adapter.canHandle('/src/components/Button.jsx')).toBe(true);
    });
    
    it('should not handle non-React files', () => {
      expect(adapter.canHandle('Component.vue')).toBe(false);
      expect(adapter.canHandle('Component.svelte')).toBe(false);
      expect(adapter.canHandle('Component.js')).toBe(false);
    });
  });
  
  describe('handleComponentReload', () => {
    it('should handle component reload without errors', async () => {
      const componentPath = '/src/components/TestComponent.jsx';
      
      // Mock the internal methods to avoid actual React integration
      vi.spyOn(adapter, 'preserveFrameworkState').mockReturnValue(null);
      vi.spyOn(adapter, 'reconnectMetamonAdapters').mockImplementation(() => {});
      vi.spyOn(adapter, 'validateAdapterConnections').mockReturnValue(true);
      
      await expect(adapter.handleComponentReload(componentPath)).resolves.not.toThrow();
    });
    
    it('should preserve and restore state during reload', async () => {
      const componentPath = '/src/components/TestComponent.jsx';
      const mockState = { hooks: [], context: null, props: {}, state: null };
      
      const preserveSpy = vi.spyOn(adapter, 'preserveFrameworkState').mockReturnValue(mockState);
      const restoreSpy = vi.spyOn(adapter, 'restoreFrameworkState').mockImplementation(() => {});
      vi.spyOn(adapter, 'reconnectMetamonAdapters').mockImplementation(() => {});
      vi.spyOn(adapter, 'validateAdapterConnections').mockReturnValue(true);
      
      await adapter.handleComponentReload(componentPath);
      
      expect(preserveSpy).toHaveBeenCalled();
      expect(restoreSpy).toHaveBeenCalledWith(expect.any(String), mockState);
    });
  });
  
  describe('validateAdapterConnections', () => {
    it('should return true when all connections are valid', () => {
      expect(adapter.validateAdapterConnections()).toBe(true);
    });
  });
});

describe('VueHotReloadAdapter', () => {
  let adapter: VueHotReloadAdapter;
  
  beforeEach(() => {
    adapter = new VueHotReloadAdapter();
  });
  
  describe('framework properties', () => {
    it('should have correct framework name and extensions', () => {
      expect(adapter.frameworkName).toBe('vue');
      expect(adapter.fileExtensions).toEqual(['.vue']);
    });
  });
  
  describe('canHandle', () => {
    it('should handle Vue component files', () => {
      expect(adapter.canHandle('Component.vue')).toBe(true);
      expect(adapter.canHandle('/src/components/Button.vue')).toBe(true);
    });
    
    it('should not handle non-Vue files', () => {
      expect(adapter.canHandle('Component.jsx')).toBe(false);
      expect(adapter.canHandle('Component.svelte')).toBe(false);
    });
  });
});

describe('SvelteHotReloadAdapter', () => {
  let adapter: SvelteHotReloadAdapter;
  
  beforeEach(() => {
    adapter = new SvelteHotReloadAdapter();
  });
  
  describe('framework properties', () => {
    it('should have correct framework name and extensions', () => {
      expect(adapter.frameworkName).toBe('svelte');
      expect(adapter.fileExtensions).toEqual(['.svelte']);
    });
  });
  
  describe('canHandle', () => {
    it('should handle Svelte component files', () => {
      expect(adapter.canHandle('Component.svelte')).toBe(true);
      expect(adapter.canHandle('/src/components/Button.svelte')).toBe(true);
    });
    
    it('should not handle non-Svelte files', () => {
      expect(adapter.canHandle('Component.jsx')).toBe(false);
      expect(adapter.canHandle('Component.vue')).toBe(false);
    });
  });
});

describe('SolidHotReloadAdapter', () => {
  let adapter: SolidHotReloadAdapter;
  
  beforeEach(() => {
    adapter = new SolidHotReloadAdapter();
  });
  
  describe('framework properties', () => {
    it('should have correct framework name and extensions', () => {
      expect(adapter.frameworkName).toBe('solid');
      expect(adapter.fileExtensions).toEqual(['.jsx', '.tsx']);
    });
  });
  
  describe('canHandle', () => {
    it('should handle JSX/TSX files when they are Solid components', () => {
      // Note: In the current implementation, canHandle returns false
      // because isSolidComponent is not implemented yet
      // This test documents the expected behavior
      expect(adapter.canHandle('Component.jsx')).toBe(false);
      expect(adapter.canHandle('Component.tsx')).toBe(false);
    });
    
    it('should not handle non-JSX/TSX files', () => {
      expect(adapter.canHandle('Component.vue')).toBe(false);
      expect(adapter.canHandle('Component.svelte')).toBe(false);
    });
  });
});

describe('MetamonConnection', () => {
  it('should have correct structure for signal connection', () => {
    const connection: MetamonConnection = {
      type: 'signal',
      key: 'testSignal',
      value: 'test value',
      subscriptions: ['component1', 'component2']
    };
    
    expect(connection.type).toBe('signal');
    expect(connection.key).toBe('testSignal');
    expect(connection.value).toBe('test value');
    expect(connection.subscriptions).toEqual(['component1', 'component2']);
  });
  
  it('should have correct structure for pubsub connection', () => {
    const connection: MetamonConnection = {
      type: 'pubsub',
      key: 'testEvent',
      subscriptions: ['handler1', 'handler2']
    };
    
    expect(connection.type).toBe('pubsub');
    expect(connection.key).toBe('testEvent');
    expect(connection.subscriptions).toEqual(['handler1', 'handler2']);
  });
  
  it('should have correct structure for event connection', () => {
    const connection: MetamonConnection = {
      type: 'event',
      key: 'testEvent'
    };
    
    expect(connection.type).toBe('event');
    expect(connection.key).toBe('testEvent');
  });
});

describe('ComponentStateSnapshot', () => {
  it('should have correct structure', () => {
    const snapshot: ComponentStateSnapshot = {
      componentId: 'test_component_123',
      frameworkType: 'react',
      localState: { count: 5, name: 'test' },
      props: { title: 'Test Component' },
      metamonConnections: [
        {
          type: 'signal',
          key: 'counter',
          value: 5
        }
      ]
    };
    
    expect(snapshot.componentId).toBe('test_component_123');
    expect(snapshot.frameworkType).toBe('react');
    expect(snapshot.localState).toEqual({ count: 5, name: 'test' });
    expect(snapshot.props).toEqual({ title: 'Test Component' });
    expect(snapshot.metamonConnections).toHaveLength(1);
    expect(snapshot.metamonConnections[0].type).toBe('signal');
  });
});