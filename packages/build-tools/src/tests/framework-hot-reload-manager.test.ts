/**
 * Framework Hot Reload Manager Tests
 * 
 * Tests for the framework hot reload manager that coordinates all framework adapters.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FrameworkHotReloadManager, FrameworkHotReloadConfig } from '../framework-hot-reload-manager.js';
import { ReactHotReloadAdapter } from '../adapters/react-hot-reload-adapter.js';
import { VueHotReloadAdapter } from '../adapters/vue-hot-reload-adapter.js';
import { SvelteHotReloadAdapter } from '../adapters/svelte-hot-reload-adapter.js';
import { SolidHotReloadAdapter } from '../adapters/solid-hot-reload-adapter.js';

describe('FrameworkHotReloadManager', () => {
  let manager: FrameworkHotReloadManager;
  let config: FrameworkHotReloadConfig;
  
  beforeEach(() => {
    config = {
      enableReact: true,
      enableVue: true,
      enableSvelte: true,
      enableSolid: true,
      preserveFrameworkState: true,
      preserveMetamonConnections: true,
      debugLogging: false
    };
    
    manager = new FrameworkHotReloadManager(config);
  });
  
  describe('initialization', () => {
    it('should initialize with all adapters enabled by default', () => {
      const stats = manager.getStats();
      
      expect(stats.enabledFrameworks).toContain('react');
      expect(stats.enabledFrameworks).toContain('vue');
      expect(stats.enabledFrameworks).toContain('svelte');
      expect(stats.enabledFrameworks).toContain('solid');
      expect(stats.adapterCount).toBe(4);
    });
    
    it('should initialize with selective adapters when configured', () => {
      const selectiveConfig = {
        enableReact: true,
        enableVue: false,
        enableSvelte: true,
        enableSolid: false,
        preserveFrameworkState: true,
        preserveMetamonConnections: true,
        debugLogging: false
      };
      
      const selectiveManager = new FrameworkHotReloadManager(selectiveConfig);
      const stats = selectiveManager.getStats();
      
      expect(stats.enabledFrameworks).toContain('react');
      expect(stats.enabledFrameworks).toContain('svelte');
      expect(stats.enabledFrameworks).not.toContain('vue');
      expect(stats.enabledFrameworks).not.toContain('solid');
      expect(stats.adapterCount).toBe(2);
    });
  });
  
  describe('canHandleFile', () => {
    it('should return true for React component files', () => {
      expect(manager.canHandleFile('Component.jsx')).toBe(true);
      expect(manager.canHandleFile('Component.tsx')).toBe(true);
    });
    
    it('should return true for Vue component files', () => {
      expect(manager.canHandleFile('Component.vue')).toBe(true);
    });
    
    it('should return true for Svelte component files', () => {
      expect(manager.canHandleFile('Component.svelte')).toBe(true);
    });
    
    it('should return false for unsupported file types', () => {
      expect(manager.canHandleFile('Component.js')).toBe(false);
      expect(manager.canHandleFile('Component.ts')).toBe(false);
      expect(manager.canHandleFile('styles.css')).toBe(false);
      expect(manager.canHandleFile('config.json')).toBe(false);
    });
  });
  
  describe('getFrameworkForFile', () => {
    it('should return correct framework for React files', () => {
      expect(manager.getFrameworkForFile('Component.jsx')).toBe('react');
      expect(manager.getFrameworkForFile('Component.tsx')).toBe('react');
    });
    
    it('should return correct framework for Vue files', () => {
      expect(manager.getFrameworkForFile('Component.vue')).toBe('vue');
    });
    
    it('should return correct framework for Svelte files', () => {
      expect(manager.getFrameworkForFile('Component.svelte')).toBe('svelte');
    });
    
    it('should return null for unsupported files', () => {
      expect(manager.getFrameworkForFile('Component.js')).toBeNull();
      expect(manager.getFrameworkForFile('styles.css')).toBeNull();
    });
  });
  
  describe('handleFrameworkComponentReload', () => {
    it('should handle React component reload successfully', async () => {
      const filePath = '/src/components/TestComponent.jsx';
      
      // Mock the React adapter methods
      const reactAdapter = manager.getAdapter('react') as ReactHotReloadAdapter;
      vi.spyOn(reactAdapter, 'handleComponentReload').mockResolvedValue();
      vi.spyOn(reactAdapter, 'getComponentStateSnapshot').mockReturnValue({
        componentId: 'test_component',
        frameworkType: 'react',
        localState: { count: 5 },
        props: {},
        metamonConnections: []
      });
      vi.spyOn(reactAdapter, 'restoreFromSnapshot').mockImplementation(() => {});
      vi.spyOn(reactAdapter, 'validateAdapterConnections').mockReturnValue(true);
      
      const result = await manager.handleFrameworkComponentReload(filePath);
      
      expect(result.success).toBe(true);
      expect(result.frameworkName).toBe('react');
      expect(result.filePath).toBe(filePath);
      expect(result.statePreserved).toBe(true);
      expect(result.connectionsRestored).toBe(true);
    });
    
    it('should handle Vue component reload successfully', async () => {
      const filePath = '/src/components/TestComponent.vue';
      
      // Mock the Vue adapter methods
      const vueAdapter = manager.getAdapter('vue') as VueHotReloadAdapter;
      vi.spyOn(vueAdapter, 'handleComponentReload').mockResolvedValue();
      vi.spyOn(vueAdapter, 'getComponentStateSnapshot').mockReturnValue(null);
      vi.spyOn(vueAdapter, 'validateAdapterConnections').mockReturnValue(true);
      
      const result = await manager.handleFrameworkComponentReload(filePath);
      
      expect(result.success).toBe(true);
      expect(result.frameworkName).toBe('vue');
      expect(result.filePath).toBe(filePath);
      expect(result.statePreserved).toBe(false);
      expect(result.connectionsRestored).toBe(false); // Should be false when no snapshot is created
    });
    
    it('should return error for unsupported file types', async () => {
      const filePath = '/src/styles/main.css';
      
      const result = await manager.handleFrameworkComponentReload(filePath);
      
      expect(result.success).toBe(false);
      expect(result.frameworkName).toBe('unknown');
      expect(result.error).toBe('No adapter found for file type');
    });
    
    it('should handle adapter errors gracefully', async () => {
      const filePath = '/src/components/ErrorComponent.jsx';
      
      // Mock the React adapter to throw an error
      const reactAdapter = manager.getAdapter('react') as ReactHotReloadAdapter;
      vi.spyOn(reactAdapter, 'handleComponentReload').mockRejectedValue(new Error('Reload failed'));
      
      const result = await manager.handleFrameworkComponentReload(filePath);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Reload failed');
    });
  });
  
  describe('reconnectAllMetamonAdapters', () => {
    it('should reconnect adapters for all frameworks', async () => {
      const reactAdapter = manager.getAdapter('react') as ReactHotReloadAdapter;
      const vueAdapter = manager.getAdapter('vue') as VueHotReloadAdapter;
      const svelteAdapter = manager.getAdapter('svelte') as SvelteHotReloadAdapter;
      const solidAdapter = manager.getAdapter('solid') as SolidHotReloadAdapter;
      
      const reactSpy = vi.spyOn(reactAdapter, 'reconnectMetamonAdapters').mockImplementation(() => {});
      const vueSpy = vi.spyOn(vueAdapter, 'reconnectMetamonAdapters').mockImplementation(() => {});
      const svelteSpy = vi.spyOn(svelteAdapter, 'reconnectMetamonAdapters').mockImplementation(() => {});
      const solidSpy = vi.spyOn(solidAdapter, 'reconnectMetamonAdapters').mockImplementation(() => {});
      
      await manager.reconnectAllMetamonAdapters();
      
      expect(reactSpy).toHaveBeenCalled();
      expect(vueSpy).toHaveBeenCalled();
      expect(svelteSpy).toHaveBeenCalled();
      expect(solidSpy).toHaveBeenCalled();
    });
    
    it('should continue even if one adapter fails', async () => {
      const reactAdapter = manager.getAdapter('react') as ReactHotReloadAdapter;
      const vueAdapter = manager.getAdapter('vue') as VueHotReloadAdapter;
      
      // Make React adapter throw an error
      vi.spyOn(reactAdapter, 'reconnectMetamonAdapters').mockImplementation(() => {
        throw new Error('React reconnection failed');
      });
      
      const vueSpy = vi.spyOn(vueAdapter, 'reconnectMetamonAdapters').mockImplementation(() => {});
      
      // Should not throw
      await expect(manager.reconnectAllMetamonAdapters()).resolves.not.toThrow();
      
      // Vue adapter should still be called
      expect(vueSpy).toHaveBeenCalled();
    });
  });
  
  describe('validateAllAdapterConnections', () => {
    it('should return true when all adapters have valid connections', () => {
      const reactAdapter = manager.getAdapter('react') as ReactHotReloadAdapter;
      const vueAdapter = manager.getAdapter('vue') as VueHotReloadAdapter;
      
      vi.spyOn(reactAdapter, 'validateAdapterConnections').mockReturnValue(true);
      vi.spyOn(vueAdapter, 'validateAdapterConnections').mockReturnValue(true);
      
      expect(manager.validateAllAdapterConnections()).toBe(true);
    });
    
    it('should return false when any adapter has invalid connections', () => {
      const reactAdapter = manager.getAdapter('react') as ReactHotReloadAdapter;
      const vueAdapter = manager.getAdapter('vue') as VueHotReloadAdapter;
      
      vi.spyOn(reactAdapter, 'validateAdapterConnections').mockReturnValue(true);
      vi.spyOn(vueAdapter, 'validateAdapterConnections').mockReturnValue(false);
      
      expect(manager.validateAllAdapterConnections()).toBe(false);
    });
  });
  
  describe('updateConfig', () => {
    it('should update configuration and reinitialize adapters when framework settings change', () => {
      const initialStats = manager.getStats();
      expect(initialStats.enabledFrameworks).toContain('vue');
      
      manager.updateConfig({ enableVue: false });
      
      const updatedStats = manager.getStats();
      expect(updatedStats.enabledFrameworks).not.toContain('vue');
      expect(updatedStats.adapterCount).toBe(3);
    });
    
    it('should not reinitialize adapters when non-framework settings change', () => {
      const initialStats = manager.getStats();
      const initialAdapterCount = initialStats.adapterCount;
      
      manager.updateConfig({ debugLogging: true });
      
      const updatedStats = manager.getStats();
      expect(updatedStats.adapterCount).toBe(initialAdapterCount);
    });
  });
  
  describe('getAdapter', () => {
    it('should return the correct adapter for each framework', () => {
      expect(manager.getAdapter('react')).toBeInstanceOf(ReactHotReloadAdapter);
      expect(manager.getAdapter('vue')).toBeInstanceOf(VueHotReloadAdapter);
      expect(manager.getAdapter('svelte')).toBeInstanceOf(SvelteHotReloadAdapter);
      expect(manager.getAdapter('solid')).toBeInstanceOf(SolidHotReloadAdapter);
    });
    
    it('should return undefined for non-existent adapters', () => {
      expect(manager.getAdapter('angular')).toBeUndefined();
      expect(manager.getAdapter('nonexistent')).toBeUndefined();
    });
  });
  
  describe('getAllAdapters', () => {
    it('should return all enabled adapters', () => {
      const adapters = manager.getAllAdapters();
      
      expect(adapters).toHaveLength(4);
      expect(adapters.some(a => a.frameworkName === 'react')).toBe(true);
      expect(adapters.some(a => a.frameworkName === 'vue')).toBe(true);
      expect(adapters.some(a => a.frameworkName === 'svelte')).toBe(true);
      expect(adapters.some(a => a.frameworkName === 'solid')).toBe(true);
    });
  });
  
  describe('clearSnapshots', () => {
    it('should clear all component snapshots', () => {
      // First create some snapshots by handling reloads
      const reactAdapter = manager.getAdapter('react') as ReactHotReloadAdapter;
      vi.spyOn(reactAdapter, 'getComponentStateSnapshot').mockReturnValue({
        componentId: 'test_component',
        frameworkType: 'react',
        localState: {},
        props: {},
        metamonConnections: []
      });
      
      // This would create snapshots internally
      manager.handleFrameworkComponentReload('/src/Component.jsx');
      
      // Clear snapshots
      manager.clearSnapshots();
      
      // Verify snapshots are cleared (this is tested indirectly through stats)
      const stats = manager.getStats();
      expect(stats.totalSnapshots).toBe(0);
    });
  });
  
  describe('cleanup', () => {
    it('should cleanup all resources', () => {
      manager.cleanup();
      
      const stats = manager.getStats();
      expect(stats.totalSnapshots).toBe(0);
      expect(stats.adapterCount).toBe(0);
      expect(stats.enabledFrameworks).toHaveLength(0);
    });
  });
});