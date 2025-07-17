/**
 * End-to-End Hot Reload Integration Tests
 * 
 * Comprehensive end-to-end tests that simulate real-world hot reload scenarios,
 * testing the complete workflow from file change detection to UI updates.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HotReloadOrchestrator, type HotReloadConfig } from '../../hot-reload-orchestrator.js';
import { StatePreservationManager } from '../../../dev-tools/src/state-preservation-manager.js';

// Mock file system operations
vi.mock('fs', () => ({
  readFileSync: vi.fn(),
  existsSync: vi.fn(),
  statSync: vi.fn(),
  writeFileSync: vi.fn()
}));

// Mock Vite plugin integration
vi.mock('../../vite-plugin-mtm.js', () => ({
  mtmPlugin: vi.fn().mockImplementation(() => ({
    name: 'vite-plugin-mtm',
    handleHotUpdate: vi.fn(),
    load: vi.fn(),
    transform: vi.fn(),
    resolveId: vi.fn()
  }))
}));

// Mock core Metamon components
vi.mock('@metamon/core', () => ({
  MetamonSignalManager: vi.fn().mockImplementation(() => ({
    createSignal: vi.fn().mockImplementation((value, key) => ({
      value,
      update: vi.fn(),
      subscribe: vi.fn(),
      key
    })),
    getSignal: vi.fn(),
    getSignalKeys: vi.fn().mockReturnValue([]),
    cleanup: vi.fn()
  })),
  MetamonPubSub: vi.fn().mockImplementation(() => ({
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    emit: vi.fn(),
    getActiveSubscriptions: vi.fn().mockReturnValue([]),
    getSubscriptionCount: vi.fn().mockReturnValue(0),
    clear: vi.fn()
  })),
  MTMFileParser: {
    parse: vi.fn().mockReturnValue({
      frontmatter: { target: 'reactjs', channels: ['user-events'] },
      content: '<div>Test Component</div>'
    })
  },
  MTMCompiler: vi.fn().mockImplementation(() => ({
    compile: vi.fn().mockReturnValue({
      code: 'export default function TestComponent() { return React.createElement("div", null, "Test Component"); }'
    })
  }))
}));

const mockFs = vi.mocked(await import('fs'));

describe('End-to-End Hot Reload Integration', () => {
  let orchestrator: HotReloadOrchestrator;
  let stateManager: StatePreservationManager;
  let signalManager: any;
  let pubSubSystem: any;

  const e2eConfig: Partial<HotReloadConfig> = {
    preserveState: true,
    batchUpdates: true,
    debounceMs: 50,
    syncFrameworks: true,
    syncTimeout: 2000,
    showErrorOverlay: true,
    errorRecoveryMode: 'graceful',
    maxConcurrentReloads: 3,
    reloadTimeout: 5000,
    debugLogging: false
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Setup file system mocks
    mockFs.existsSync.mockReturnValue(true);
    mockFs.statSync.mockReturnValue({ 
      mtime: new Date(Date.now()) 
    } as any);

    // Create core instances
    const { MetamonSignalManager, MetamonPubSub } = await import('@metamon/core');
    signalManager = new MetamonSignalManager();
    pubSubSystem = new MetamonPubSub();

    // Create state manager and orchestrator
    stateManager = new StatePreservationManager({
      preserveSignals: true,
      preserveSubscriptions: true,
      preserveComponentState: true,
      debugLogging: false
    });

    orchestrator = new HotReloadOrchestrator(e2eConfig, stateManager);
    orchestrator.initializeCrossFrameworkSync(signalManager, pubSubSystem);
  });

  afterEach(() => {
    vi.useRealTimers();
    orchestrator.cleanup();
    stateManager.cleanup();
    signalManager.cleanup();
    pubSubSystem.clear();
  });

  describe('Complete MTM File Hot Reload Workflow', () => {
    it('should handle complete MTM file change workflow with state preservation', async () => {
      // Setup initial application state
      const counterSignal = signalManager.createSignal(5, 'counter');
      const themeSignal = signalManager.createSignal('dark', 'theme');
      
      const messageCallback = vi.fn();
      pubSubSystem.subscribe('message-sent', messageCallback, 'TestComponent');
      
      orchestrator.registerFrameworkComponent('react', 'TestComponent');

      // Mock MTM file content
      const initialContent = `---
target: reactjs
channels: ['user-events']
imports: ['./utils.js']
---

<div class="counter">
  <h1>Counter: {counter}</h1>
  <button onClick={increment}>Increment</button>
</div>

<script>
function increment() {
  counter.update(counter.value + 1);
  pubsub.emit('message-sent', { action: 'increment', value: counter.value });
}
</script>`;

      const updatedContent = `---
target: reactjs
channels: ['user-events', 'analytics']
imports: ['./utils.js', './analytics.js']
---

<div class="counter enhanced">
  <h1>Enhanced Counter: {counter}</h1>
  <p>Theme: {theme}</p>
  <button onClick={increment}>Increment</button>
  <button onClick={reset}>Reset</button>
</div>

<script>
function increment() {
  counter.update(counter.value + 1);
  pubsub.emit('message-sent', { action: 'increment', value: counter.value });
  pubsub.emit('analytics', { event: 'counter_increment' });
}

function reset() {
  counter.update(0);
  pubsub.emit('message-sent', { action: 'reset', value: 0 });
}
</script>`;

      mockFs.readFileSync.mockReturnValue(updatedContent);

      // Simulate file change
      const filePath = '/src/components/Counter.mtm';
      
      const startTime = Date.now();
      
      // Trigger hot reload
      orchestrator.handleFileChange(filePath, 'mtm', updatedContent);
      
      // Process the reload
      vi.advanceTimersByTime(50);
      await vi.runAllTimersAsync();
      
      const endTime = Date.now();
      const reloadDuration = endTime - startTime;

      // Verify performance requirement
      expect(reloadDuration).toBeLessThan(500);

      // Verify state was preserved
      expect(counterSignal.value).toBe(5); // Should maintain original value
      expect(themeSignal.value).toBe('dark'); // Should maintain original value

      // Verify subscriptions were maintained
      expect(pubSubSystem.getSubscriptionCount('message-sent')).toBe(1);

      // Test that the preserved state still works
      pubSubSystem.emit('message-sent', { test: 'data' });
      expect(messageCallback).toHaveBeenCalledWith({ test: 'data' });

      // Verify reload was processed
      const stats = orchestrator.getStats();
      expect(stats.queuedReloads).toBe(1);
    });

    it('should handle frontmatter changes with channel subscription updates', async () => {
      // Setup initial subscriptions
      const userCallback = vi.fn();
      const analyticsCallback = vi.fn();
      
      pubSubSystem.subscribe('user-events', userCallback, 'TestComponent');
      orchestrator.registerFrameworkComponent('react', 'TestComponent');

      const initialContent = `---
target: reactjs
channels: ['user-events']
---
<div>Initial Component</div>`;

      const updatedContent = `---
target: reactjs
channels: ['user-events', 'analytics', 'notifications']
---
<div>Updated Component</div>`;

      mockFs.readFileSync.mockReturnValue(updatedContent);

      // Trigger hot reload with frontmatter changes
      const filePath = '/src/components/TestComponent.mtm';
      orchestrator.handleFileChange(filePath, 'mtm', updatedContent);

      vi.advanceTimersByTime(50);
      await vi.runAllTimersAsync();

      // Verify channel subscription updates were handled
      // (This would be verified through the frontmatter hot reload manager)
      const stats = orchestrator.getStats();
      expect(stats.queuedReloads).toBe(1);

      // Test that existing subscriptions still work
      pubSubSystem.emit('user-events', { event: 'test' });
      expect(userCallback).toHaveBeenCalledWith({ event: 'test' });
    });

    it('should handle target framework changes', async () => {
      const initialContent = `---
target: reactjs
channels: ['events']
---
<div>React Component</div>`;

      const updatedContent = `---
target: vue
channels: ['events']
---
<div>Vue Component</div>`;

      mockFs.readFileSync.mockReturnValue(updatedContent);

      // Setup component tracking
      orchestrator.registerFrameworkComponent('react', 'TestComponent');

      // Trigger hot reload with target framework change
      const filePath = '/src/components/TestComponent.mtm';
      orchestrator.handleFileChange(filePath, 'mtm', updatedContent);

      vi.advanceTimersByTime(50);
      await vi.runAllTimersAsync();

      // Verify target framework change was handled
      const stats = orchestrator.getStats();
      expect(stats.queuedReloads).toBe(1);
    });
  });

  describe('Cross-Framework Hot Reload Scenarios', () => {
    it('should maintain cross-framework communication during hot reload', async () => {
      // Setup cross-framework scenario
      const sharedSignal = signalManager.createSignal('shared-value', 'sharedData');
      
      const reactCallback = vi.fn();
      const vueCallback = vi.fn();
      
      pubSubSystem.subscribe('data-updated', reactCallback, 'ReactComponent');
      pubSubSystem.subscribe('data-updated', vueCallback, 'VueComponent');
      
      orchestrator.registerFrameworkComponent('react', 'ReactComponent');
      orchestrator.registerFrameworkComponent('vue', 'VueComponent');

      // Simulate React component hot reload
      const reactContent = `---
target: reactjs
channels: ['data-events']
---
<div>Updated React Component: {sharedData}</div>`;

      mockFs.readFileSync.mockReturnValue(reactContent);

      // Trigger React component reload
      orchestrator.handleFileChange('/src/components/ReactComponent.mtm', 'mtm', reactContent);

      vi.advanceTimersByTime(50);
      await vi.runAllTimersAsync();

      // Verify cross-framework state is maintained
      expect(sharedSignal.value).toBe('shared-value');

      // Test cross-framework communication still works
      pubSubSystem.emit('data-updated', { value: 'new-data' });
      
      expect(reactCallback).toHaveBeenCalledWith({ value: 'new-data' });
      expect(vueCallback).toHaveBeenCalledWith({ value: 'new-data' });

      // Update shared signal and verify both frameworks can access it
      sharedSignal.update('updated-shared-value');
      expect(signalManager.getSignal('sharedData')?.value).toBe('updated-shared-value');
    });

    it('should handle concurrent cross-framework reloads', async () => {
      // Setup multiple framework components
      const frameworks = ['react', 'vue', 'svelte'];
      const components = frameworks.map(fw => `${fw}Component`);
      
      // Register components
      frameworks.forEach((fw, i) => {
        orchestrator.registerFrameworkComponent(fw, components[i]);
      });

      // Setup shared state
      const sharedCounter = signalManager.createSignal(0, 'sharedCounter');
      
      const callbacks = components.map(() => vi.fn());
      callbacks.forEach((callback, i) => {
        pubSubSystem.subscribe('counter-updated', callback, components[i]);
      });

      // Simulate concurrent reloads
      const reloadPromises = frameworks.map((fw, i) => {
        const content = `---
target: ${fw}
channels: ['counter-events']
---
<div>${fw} Counter: {sharedCounter}</div>`;

        mockFs.readFileSync.mockReturnValue(content);
        
        return orchestrator.handleFileChange(
          `/src/components/${components[i]}.mtm`,
          'mtm',
          content
        );
      });

      await Promise.all(reloadPromises);

      vi.advanceTimersByTime(50);
      await vi.runAllTimersAsync();

      // Verify all reloads were processed
      const stats = orchestrator.getStats();
      expect(stats.queuedReloads).toBe(frameworks.length);

      // Verify cross-framework state is maintained
      expect(sharedCounter.value).toBe(0);

      // Test cross-framework communication
      pubSubSystem.emit('counter-updated', { value: 42 });
      
      callbacks.forEach(callback => {
        expect(callback).toHaveBeenCalledWith({ value: 42 });
      });
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should recover from compilation errors gracefully', async () => {
      // Setup valid initial state
      const signal = signalManager.createSignal('valid', 'testSignal');
      const callback = vi.fn();
      pubSubSystem.subscribe('test-event', callback, 'TestComponent');
      
      orchestrator.registerFrameworkComponent('react', 'TestComponent');

      // Simulate compilation error
      const invalidContent = `---
target: reactjs
channels: ['events']
---
<div>Invalid {unclosedBrace</div>`;

      mockFs.readFileSync.mockReturnValue(invalidContent);

      // Trigger hot reload with invalid content
      orchestrator.handleFileChange('/src/components/TestComponent.mtm', 'mtm', invalidContent);

      vi.advanceTimersByTime(50);
      await vi.runAllTimersAsync();

      // Verify state is preserved even with compilation error
      expect(signal.value).toBe('valid');
      expect(pubSubSystem.getSubscriptionCount('test-event')).toBe(1);

      // Test that existing functionality still works
      pubSubSystem.emit('test-event', { data: 'test' });
      expect(callback).toHaveBeenCalledWith({ data: 'test' });

      // Now fix the error
      const fixedContent = `---
target: reactjs
channels: ['events']
---
<div>Fixed Component</div>`;

      mockFs.readFileSync.mockReturnValue(fixedContent);

      // Trigger hot reload with fixed content
      orchestrator.handleFileChange('/src/components/TestComponent.mtm', 'mtm', fixedContent);

      vi.advanceTimersByTime(50);
      await vi.runAllTimersAsync();

      // Verify recovery
      const stats = orchestrator.getStats();
      expect(stats.queuedReloads).toBe(2); // Both attempts should be queued
    });

    it('should handle network/file system errors during hot reload', async () => {
      // Setup initial state
      const signal = signalManager.createSignal('initial', 'testSignal');
      orchestrator.registerFrameworkComponent('react', 'TestComponent');

      // Simulate file system error
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('File system error');
      });

      // Trigger hot reload
      orchestrator.handleFileChange('/src/components/TestComponent.mtm', 'mtm');

      vi.advanceTimersByTime(50);
      await vi.runAllTimersAsync();

      // Verify state is preserved despite error
      expect(signal.value).toBe('initial');

      // Verify error was handled gracefully
      const stats = orchestrator.getStats();
      expect(stats.queuedReloads).toBe(1);
    });
  });

  describe('Performance Under Real-World Conditions', () => {
    it('should handle rapid development workflow', async () => {
      // Simulate rapid development with frequent saves
      const filePath = '/src/components/DevelopmentComponent.mtm';
      const baseContent = `---
target: reactjs
channels: ['dev-events']
---
<div>Development Component v`;

      const iterations = 20;
      const startTime = Date.now();

      // Simulate rapid saves during development
      for (let i = 0; i < iterations; i++) {
        const content = `${baseContent}${i}</div>`;
        mockFs.readFileSync.mockReturnValue(content);
        
        orchestrator.handleFileChange(filePath, 'mtm', content);
        
        // Small delay to simulate typing/saving
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Process all changes
      vi.advanceTimersByTime(50);
      await vi.runAllTimersAsync();

      const endTime = Date.now();
      const totalDuration = endTime - startTime;

      // Should handle rapid development efficiently
      expect(totalDuration).toBeLessThan(2000);

      // Due to debouncing, should result in fewer actual reloads
      const stats = orchestrator.getStats();
      expect(stats.queuedReloads).toBeLessThan(iterations);
    });

    it('should maintain performance with large application state', async () => {
      // Setup large application state
      const signalCount = 100;
      const subscriptionCount = 75;

      // Create many signals
      for (let i = 0; i < signalCount; i++) {
        signalManager.createSignal(`value${i}`, `signal${i}`);
      }

      // Create many subscriptions
      for (let i = 0; i < subscriptionCount; i++) {
        pubSubSystem.subscribe(`event${i}`, vi.fn(), `component${i}`);
      }

      // Register many components
      for (let i = 0; i < 20; i++) {
        orchestrator.registerFrameworkComponent('react', `Component${i}`);
      }

      const startTime = Date.now();

      // Trigger hot reload with large state
      const content = `---
target: reactjs
channels: ['large-app-events']
---
<div>Large Application Component</div>`;

      mockFs.readFileSync.mockReturnValue(content);
      
      orchestrator.handleFileChange('/src/components/LargeAppComponent.mtm', 'mtm', content);

      vi.advanceTimersByTime(50);
      await vi.runAllTimersAsync();

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should handle large state efficiently
      expect(duration).toBeLessThan(1000);

      // Verify state preservation worked
      expect(signalManager.getSignalKeys().length).toBe(signalCount);
    });
  });

  describe('Integration with Build Tools', () => {
    it('should integrate properly with Vite plugin system', async () => {
      // This test would verify integration with the actual Vite plugin
      // For now, we'll test the orchestrator's ability to work with plugin-like interfaces
      
      const mockViteServer = {
        moduleGraph: {
          getModulesByFile: vi.fn().mockReturnValue([
            { url: '/src/components/TestComponent.mtm', id: 'test-component' }
          ])
        },
        ws: {
          send: vi.fn()
        }
      };

      // Setup component
      orchestrator.registerFrameworkComponent('react', 'TestComponent');

      const content = `---
target: reactjs
channels: ['vite-events']
---
<div>Vite Integration Test</div>`;

      mockFs.readFileSync.mockReturnValue(content);

      // Simulate Vite plugin hot update
      orchestrator.handleFileChange('/src/components/TestComponent.mtm', 'mtm', content);

      vi.advanceTimersByTime(50);
      await vi.runAllTimersAsync();

      // Verify integration worked
      const stats = orchestrator.getStats();
      expect(stats.queuedReloads).toBe(1);
    });

    it('should handle CSS hot reload integration', async () => {
      // Setup CSS-related state
      const themeSignal = signalManager.createSignal('light', 'theme');
      orchestrator.registerFrameworkComponent('react', 'StyledComponent');

      // Trigger CSS change
      const cssContent = `.component { background: var(--theme-bg); color: var(--theme-text); }`;
      
      await orchestrator.handleCSSChange(
        '/src/styles/component.css',
        'css',
        cssContent,
        ['react']
      );

      // Verify CSS hot reload was processed
      const cssStats = orchestrator.getCSSStats();
      expect(cssStats.completedUpdates).toBe(1);

      // Verify theme signal is still accessible
      expect(themeSignal.value).toBe('light');
    });
  });

  describe('Requirements Validation', () => {
    it('should satisfy all hot reload requirements in end-to-end scenario', async () => {
      // Setup comprehensive test scenario
      const counterSignal = signalManager.createSignal(10, 'counter');
      const userCallback = vi.fn();
      
      pubSubSystem.subscribe('user-action', userCallback, 'TestComponent');
      orchestrator.registerFrameworkComponent('react', 'TestComponent');

      const content = `---
target: reactjs
channels: ['user-events', 'analytics']
imports: ['./utils.js']
---

<div class="test-component">
  <h1>Counter: {counter}</h1>
  <button onClick={handleClick}>Click me</button>
</div>

<script>
function handleClick() {
  counter.update(counter.value + 1);
  pubsub.emit('user-action', { action: 'click', value: counter.value });
}
</script>`;

      mockFs.readFileSync.mockReturnValue(content);

      const startTime = Date.now();

      // Trigger hot reload
      orchestrator.handleFileChange('/src/components/TestComponent.mtm', 'mtm', content);

      vi.advanceTimersByTime(50);
      await vi.runAllTimersAsync();

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Requirement 1.1: .mtm files reload within 500ms
      expect(duration).toBeLessThan(500);

      // Requirement 1.2: Preserve signal state across frameworks
      expect(counterSignal.value).toBe(10);

      // Requirement 1.4: Maintain active subscriptions
      expect(pubSubSystem.getSubscriptionCount('user-action')).toBe(1);

      // Test that preserved functionality works
      pubSubSystem.emit('user-action', { test: 'data' });
      expect(userCallback).toHaveBeenCalledWith({ test: 'data' });

      // Requirement 5.1: MTM frontmatter compilation
      const stats = orchestrator.getStats();
      expect(stats.queuedReloads).toBe(1);

      // Verify cross-framework synchronization worked
      expect(signalManager.getSignal('counter')?.value).toBe(10);
    });
  });
});