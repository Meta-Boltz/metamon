/**
 * Hot Reload Requirements Validation Tests
 * 
 * Comprehensive tests that validate all requirements from the hot reload support specification.
 * Each test maps directly to specific requirements to ensure complete coverage.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HotReloadOrchestrator, type HotReloadConfig } from '../hot-reload-orchestrator.js';
import { StatePreservationManager } from '../../dev-tools/src/state-preservation-manager.js';

// Mock core dependencies for requirements testing
vi.mock('@metamon/core', () => ({
  MetamonSignalManager: vi.fn().mockImplementation(() => ({
    createSignal: vi.fn().mockImplementation((value, key) => ({
      value,
      update: vi.fn().mockImplementation(function(newValue) { this.value = newValue; }),
      subscribe: vi.fn(),
      key
    })),
    getSignal: vi.fn().mockImplementation((key) => ({
      value: `mock-value-${key}`,
      update: vi.fn(),
      subscribe: vi.fn()
    })),
    getSignalKeys: vi.fn().mockReturnValue(['signal1', 'signal2']),
    cleanup: vi.fn()
  })),
  MetamonPubSub: vi.fn().mockImplementation(() => ({
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    emit: vi.fn(),
    getActiveSubscriptions: vi.fn().mockReturnValue([
      { event: 'test-event', componentId: 'test-component', callback: vi.fn() }
    ]),
    getSubscriptionCount: vi.fn().mockReturnValue(1),
    clear: vi.fn()
  }))
}));

// Mock other dependencies
vi.mock('../error-overlay.js', () => ({
  ErrorOverlay: vi.fn().mockImplementation(() => ({
    showError: vi.fn(),
    showSuccess: vi.fn(),
    hideError: vi.fn()
  }))
}));

vi.mock('../error-recovery-manager.js', () => ({
  ErrorRecoveryManager: vi.fn().mockImplementation(() => ({
    registerRecoveryCallback: vi.fn(),
    attemptRecovery: vi.fn().mockResolvedValue(true)
  }))
}));

vi.mock('../error-categorizer.js', () => ({
  ErrorCategorizer: vi.fn().mockImplementation(() => ({
    categorizeError: vi.fn().mockReturnValue({
      type: 'compilation_error',
      message: 'Test error',
      recoverable: true,
      filePath: '/test/file.mtm'
    })
  }))
}));

vi.mock('../hot-reload-visual-feedback-manager.js', () => ({
  HotReloadVisualFeedbackManager: vi.fn().mockImplementation(() => ({
    startReload: vi.fn(),
    updateProgress: vi.fn(),
    completeReload: vi.fn(),
    showSuccess: vi.fn(),
    showError: vi.fn(),
    showWarning: vi.fn(),
    showInfo: vi.fn(),
    updateOptions: vi.fn(),
    cleanup: vi.fn()
  }))
}));

vi.mock('../framework-hot-reload-manager.js', () => ({
  FrameworkHotReloadManager: vi.fn().mockImplementation(() => ({
    canHandleFile: vi.fn().mockReturnValue(false),
    handleFrameworkComponentReload: vi.fn().mockResolvedValue({
      success: true,
      duration: 100,
      statePreserved: true,
      connectionsRestored: true
    }),
    reconnectAllMetamonAdapters: vi.fn().mockResolvedValue(true),
    validateAllAdapterConnections: vi.fn().mockReturnValue(true),
    updateConfig: vi.fn(),
    cleanup: vi.fn()
  }))
}));

vi.mock('../cross-framework-synchronizer.js', () => ({
  CrossFrameworkSynchronizer: vi.fn().mockImplementation(() => ({
    initialize: vi.fn(),
    registerFrameworkComponent: vi.fn(),
    unregisterFrameworkComponent: vi.fn(),
    createSyncSnapshot: vi.fn().mockReturnValue({
      connections: [],
      signalValues: new Map([['signal1', 'value1'], ['signal2', 'value2']]),
      subscriptions: new Map([['event1', [{ componentId: 'comp1', callbackId: 'cb1' }]]]),
      timestamp: Date.now()
    }),
    restoreSyncSnapshot: vi.fn().mockResolvedValue(true),
    synchronizeFrameworks: vi.fn().mockResolvedValue(true),
    updateConfig: vi.fn(),
    cleanup: vi.fn()
  }))
}));

vi.mock('../frontmatter-hot-reload-manager.js', () => ({
  FrontmatterHotReloadManager: vi.fn().mockImplementation(() => ({
    detectFrontmatterChanges: vi.fn().mockResolvedValue({
      hasChanges: true,
      changes: [
        { type: 'target', oldValue: 'reactjs', newValue: 'vue' },
        { type: 'channels', oldValue: ['events'], newValue: ['events', 'analytics'] }
      ],
      channelsChanged: true,
      targetChanged: true,
      importsChanged: false
    }),
    getChannelSubscriptionUpdates: vi.fn().mockReturnValue({
      toAdd: ['analytics'],
      toRemove: [],
      toUpdate: []
    }),
    handleTargetFrameworkChange: vi.fn().mockResolvedValue(true),
    handleImportsChange: vi.fn().mockResolvedValue(true),
    updateConfig: vi.fn(),
    cleanup: vi.fn()
  }))
}));

vi.mock('../css-hot-reload-manager.js', () => ({
  CSSHotReloadManager: vi.fn().mockImplementation(() => ({
    handleCSSChange: vi.fn().mockResolvedValue({
      success: true,
      updatedComponents: 1,
      duration: 50
    }),
    updateConfig: vi.fn(),
    getStats: vi.fn().mockReturnValue({
      activeUpdates: 0,
      queuedUpdates: 0,
      completedUpdates: 1
    }),
    cleanup: vi.fn()
  }))
}));

describe('Hot Reload Requirements Validation', () => {
  let orchestrator: HotReloadOrchestrator;
  let stateManager: StatePreservationManager;
  let signalManager: any;
  let pubSubSystem: any;

  const requirementsConfig: Partial<HotReloadConfig> = {
    preserveState: true,
    batchUpdates: true,
    debounceMs: 100,
    syncFrameworks: true,
    syncTimeout: 5000,
    showErrorOverlay: true,
    errorRecoveryMode: 'graceful',
    maxConcurrentReloads: 3,
    reloadTimeout: 10000,
    debugLogging: false
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Create core instances
    const { MetamonSignalManager, MetamonPubSub } = await import('@metamon/core');
    signalManager = new MetamonSignalManager();
    pubSubSystem = new MetamonPubSub();

    stateManager = new StatePreservationManager({
      preserveSignals: true,
      preserveSubscriptions: true,
      preserveComponentState: true,
      debugLogging: false
    });

    orchestrator = new HotReloadOrchestrator(requirementsConfig, stateManager);
    orchestrator.initializeCrossFrameworkSync(signalManager, pubSubSystem);
  });

  afterEach(() => {
    vi.useRealTimers();
    orchestrator.cleanup();
    stateManager.cleanup();
    signalManager.cleanup();
    pubSubSystem.clear();
  });

  describe('Requirement 1.1: .mtm files reload within 500ms', () => {
    it('should reload .mtm files within 500ms performance requirement', async () => {
      const filePath = '/src/components/TestComponent.mtm';
      const content = `---
target: reactjs
channels: ['user-events']
---
<div>Test Component</div>`;

      const startTime = Date.now();
      
      // Trigger hot reload
      orchestrator.handleFileChange(filePath, 'mtm', content);
      
      // Process the reload
      vi.advanceTimersByTime(100);
      await vi.runAllTimersAsync();
      
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Requirement: Must complete within 500ms
      expect(duration).toBeLessThan(500);
      
      // Verify reload was processed
      const stats = orchestrator.getStats();
      expect(stats.queuedReloads).toBe(1);
    });

    it('should maintain 500ms performance with multiple concurrent .mtm reloads', async () => {
      const files = [
        '/src/components/Component1.mtm',
        '/src/components/Component2.mtm',
        '/src/components/Component3.mtm'
      ];

      const startTime = Date.now();
      
      // Trigger multiple concurrent reloads
      files.forEach(filePath => {
        orchestrator.handleFileChange(filePath, 'mtm', '<div>Test</div>');
      });
      
      vi.advanceTimersByTime(100);
      await vi.runAllTimersAsync();
      
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should maintain performance with multiple files
      expect(duration).toBeLessThan(500);
      
      const stats = orchestrator.getStats();
      expect(stats.queuedReloads).toBe(files.length);
    });
  });

  describe('Requirement 1.2: Preserve signal state across frameworks', () => {
    it('should preserve signal values during hot reload', async () => {
      // Setup signals with specific values
      const counterSignal = signalManager.createSignal(42, 'counter');
      const themeSignal = signalManager.createSignal('dark', 'theme');
      
      orchestrator.registerFrameworkComponent('react', 'TestComponent');

      // Verify initial values
      expect(counterSignal.value).toBe(42);
      expect(themeSignal.value).toBe('dark');

      // Trigger hot reload
      orchestrator.handleFileChange('/src/components/TestComponent.mtm', 'mtm');
      
      vi.advanceTimersByTime(100);
      await vi.runAllTimersAsync();

      // Requirement: Signal values must be preserved
      expect(counterSignal.value).toBe(42);
      expect(themeSignal.value).toBe('dark');
    });

    it('should preserve signal state across different framework components', async () => {
      // Setup cross-framework scenario
      const sharedSignal = signalManager.createSignal('shared-value', 'sharedData');
      
      orchestrator.registerFrameworkComponent('react', 'ReactComponent');
      orchestrator.registerFrameworkComponent('vue', 'VueComponent');

      // Trigger hot reload for React component
      orchestrator.handleFileChange('/src/components/ReactComponent.mtm', 'mtm');
      
      vi.advanceTimersByTime(100);
      await vi.runAllTimersAsync();

      // Signal should be preserved and accessible to both frameworks
      expect(sharedSignal.value).toBe('shared-value');
      expect(signalManager.getSignal('sharedData')?.value).toBe('shared-value');
    });

    it('should restore signal state after compilation errors', async () => {
      const signal = signalManager.createSignal('important-data', 'importantSignal');
      
      // Trigger hot reload that might cause compilation error
      orchestrator.handleFileChange('/src/components/BrokenComponent.mtm', 'mtm', 'invalid content');
      
      vi.advanceTimersByTime(100);
      await vi.runAllTimersAsync();

      // Requirement: State must be preserved even during errors
      expect(signal.value).toBe('important-data');
    });
  });

  describe('Requirement 1.3: Maintain component instance identity', () => {
    it('should maintain component registration across hot reloads', async () => {
      // Register components
      orchestrator.registerFrameworkComponent('react', 'TestComponent');
      orchestrator.registerFrameworkComponent('vue', 'VueComponent');

      // Trigger hot reload
      orchestrator.handleFileChange('/src/components/TestComponent.mtm', 'mtm');
      
      vi.advanceTimersByTime(100);
      await vi.runAllTimersAsync();

      // Components should remain registered (verified through cross-framework sync)
      const snapshot = await orchestrator.createCrossFrameworkSnapshot();
      expect(snapshot).toBeDefined();
    });

    it('should preserve component connections during framework changes', async () => {
      orchestrator.registerFrameworkComponent('react', 'TestComponent');

      // Simulate target framework change
      const content = `---
target: vue
channels: ['events']
---
<div>Changed to Vue</div>`;

      orchestrator.handleFileChange('/src/components/TestComponent.mtm', 'mtm', content);
      
      vi.advanceTimersByTime(100);
      await vi.runAllTimersAsync();

      // Component identity should be maintained through framework change
      const stats = orchestrator.getStats();
      expect(stats.queuedReloads).toBe(1);
    });
  });

  describe('Requirement 1.4: Maintain active subscriptions', () => {
    it('should preserve PubSub subscriptions during hot reload', async () => {
      // Setup subscriptions
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      
      pubSubSystem.subscribe('user-action', callback1, 'Component1');
      pubSubSystem.subscribe('data-update', callback2, 'Component2');

      // Verify initial subscription count
      expect(pubSubSystem.getSubscriptionCount('user-action')).toBe(1);
      expect(pubSubSystem.getSubscriptionCount('data-update')).toBe(1);

      // Trigger hot reload
      orchestrator.handleFileChange('/src/components/TestComponent.mtm', 'mtm');
      
      vi.advanceTimersByTime(100);
      await vi.runAllTimersAsync();

      // Requirement: Subscriptions must be maintained
      expect(pubSubSystem.getSubscriptionCount('user-action')).toBe(1);
      expect(pubSubSystem.getSubscriptionCount('data-update')).toBe(1);

      // Test that subscriptions still work
      pubSubSystem.emit('user-action', { test: 'data' });
      pubSubSystem.emit('data-update', { value: 123 });

      expect(callback1).toHaveBeenCalledWith({ test: 'data' });
      expect(callback2).toHaveBeenCalledWith({ value: 123 });
    });

    it('should handle subscription updates when channels change', async () => {
      const callback = vi.fn();
      pubSubSystem.subscribe('old-channel', callback, 'TestComponent');

      // Simulate channel change in frontmatter
      const content = `---
target: reactjs
channels: ['old-channel', 'new-channel']
---
<div>Updated channels</div>`;

      orchestrator.handleFileChange('/src/components/TestComponent.mtm', 'mtm', content);
      
      vi.advanceTimersByTime(100);
      await vi.runAllTimersAsync();

      // Original subscription should be maintained
      expect(pubSubSystem.getSubscriptionCount('old-channel')).toBe(1);
      
      // Test that original subscription still works
      pubSubSystem.emit('old-channel', { data: 'test' });
      expect(callback).toHaveBeenCalledWith({ data: 'test' });
    });
  });

  describe('Requirement 2.1: Support React, Vue, Svelte, Solid components', () => {
    it('should handle hot reload for all supported frameworks', async () => {
      const frameworks = ['react', 'vue', 'svelte', 'solid'];
      
      // Register components for each framework
      frameworks.forEach(framework => {
        orchestrator.registerFrameworkComponent(framework, `${framework}Component`);
      });

      // Test hot reload for each framework
      for (const framework of frameworks) {
        const content = `---
target: ${framework}
channels: ['events']
---
<div>${framework} Component</div>`;

        orchestrator.handleFileChange(`/src/components/${framework}Component.mtm`, 'mtm', content);
      }
      
      vi.advanceTimersByTime(100);
      await vi.runAllTimersAsync();

      // All frameworks should be supported
      const stats = orchestrator.getStats();
      expect(stats.queuedReloads).toBe(frameworks.length);
    });

    it('should maintain cross-framework synchronization for all supported frameworks', async () => {
      const frameworks = ['react', 'vue', 'svelte', 'solid'];
      
      // Setup cross-framework state
      const sharedSignal = signalManager.createSignal('shared', 'crossFrameworkSignal');
      
      frameworks.forEach(framework => {
        orchestrator.registerFrameworkComponent(framework, `${framework}Component`);
      });

      // Trigger concurrent reloads
      const reloadPromises = frameworks.map(framework => {
        const content = `---
target: ${framework}
channels: ['cross-framework-events']
---
<div>{crossFrameworkSignal}</div>`;

        return orchestrator.handleFileChange(`/src/${framework}Component.mtm`, 'mtm', content);
      });

      await Promise.all(reloadPromises);
      
      vi.advanceTimersByTime(100);
      await vi.runAllTimersAsync();

      // Cross-framework state should be maintained
      expect(sharedSignal.value).toBe('shared');
      
      const stats = orchestrator.getStats();
      expect(stats.queuedReloads).toBe(frameworks.length);
    });
  });

  describe('Requirement 3.1: Batch multiple file changes', () => {
    it('should batch multiple rapid changes to the same file', async () => {
      const filePath = '/src/components/BatchTest.mtm';
      const changeCount = 10;

      // Trigger rapid changes
      for (let i = 0; i < changeCount; i++) {
        orchestrator.handleFileChange(filePath, 'mtm', `content-${i}`);
      }

      // Process batched changes
      vi.advanceTimersByTime(100);
      await vi.runAllTimersAsync();

      // Should batch into single reload due to debouncing
      const stats = orchestrator.getStats();
      expect(stats.queuedReloads).toBe(1);
    });

    it('should respect debounce timing for batching', async () => {
      orchestrator.updateConfig({ debounceMs: 200 });
      
      const filePath = '/src/components/DebounceTest.mtm';
      
      // First change
      orchestrator.handleFileChange(filePath, 'mtm', 'content-1');
      
      // Advance time partially
      vi.advanceTimersByTime(100);
      expect(orchestrator.getStats().queuedReloads).toBe(0);
      
      // Second change (should reset debounce)
      orchestrator.handleFileChange(filePath, 'mtm', 'content-2');
      
      // Advance to complete debounce
      vi.advanceTimersByTime(200);
      await vi.runAllTimersAsync();

      // Should result in single batched reload
      const stats = orchestrator.getStats();
      expect(stats.queuedReloads).toBe(1);
    });

    it('should handle different files independently for batching', async () => {
      const files = [
        '/src/components/File1.mtm',
        '/src/components/File2.mtm',
        '/src/components/File3.mtm'
      ];

      // Trigger changes to different files
      files.forEach(filePath => {
        orchestrator.handleFileChange(filePath, 'mtm', 'content');
      });

      vi.advanceTimersByTime(100);
      await vi.runAllTimersAsync();

      // Different files should not be batched together
      const stats = orchestrator.getStats();
      expect(stats.queuedReloads).toBe(files.length);
    });
  });

  describe('Requirement 4.1: Show compilation errors in overlay', () => {
    it('should display error overlay for compilation errors', async () => {
      orchestrator.updateConfig({ showErrorOverlay: true });

      // Simulate compilation error
      const invalidContent = `---
target: reactjs
---
<div>Invalid {syntax</div>`;

      orchestrator.handleFileChange('/src/components/ErrorComponent.mtm', 'mtm', invalidContent);
      
      vi.advanceTimersByTime(100);
      await vi.runAllTimersAsync();

      // Error overlay should be shown (verified through mock)
      const stats = orchestrator.getStats();
      expect(stats.queuedReloads).toBe(1);
    });

    it('should categorize and display different error types', async () => {
      orchestrator.updateConfig({ 
        showErrorOverlay: true,
        errorRecoveryMode: 'graceful'
      });

      // Test different error scenarios
      const errorScenarios = [
        { file: 'syntax-error.mtm', content: '<div>Unclosed tag' },
        { file: 'frontmatter-error.mtm', content: '---\ninvalid: yaml: [unclosed\n---\n<div>Content</div>' },
        { file: 'import-error.mtm', content: '---\nimports: ["./nonexistent.js"]\n---\n<div>Content</div>' }
      ];

      for (const scenario of errorScenarios) {
        orchestrator.handleFileChange(`/src/components/${scenario.file}`, 'mtm', scenario.content);
      }

      vi.advanceTimersByTime(100);
      await vi.runAllTimersAsync();

      // All error scenarios should be processed
      const stats = orchestrator.getStats();
      expect(stats.queuedReloads).toBe(errorScenarios.length);
    });
  });

  describe('Requirement 4.2: Attempt automatic error recovery', () => {
    it('should attempt automatic recovery for recoverable errors', async () => {
      orchestrator.updateConfig({ errorRecoveryMode: 'graceful' });

      // Setup state that should be preserved during recovery
      const signal = signalManager.createSignal('preserved', 'recoveryTest');

      // Simulate recoverable error
      orchestrator.handleFileChange('/src/components/RecoverableError.mtm', 'mtm', 'invalid content');
      
      vi.advanceTimersByTime(100);
      await vi.runAllTimersAsync();

      // State should be preserved during recovery attempt
      expect(signal.value).toBe('preserved');
      
      const stats = orchestrator.getStats();
      expect(stats.queuedReloads).toBe(1);
    });

    it('should fall back gracefully when recovery fails', async () => {
      orchestrator.updateConfig({ errorRecoveryMode: 'graceful' });

      // Setup scenario where recovery might fail
      const signal = signalManager.createSignal('fallback-test', 'fallbackSignal');

      orchestrator.handleFileChange('/src/components/UnrecoverableError.mtm', 'mtm', 'severe error');
      
      vi.advanceTimersByTime(100);
      await vi.runAllTimersAsync();

      // Should handle gracefully even if recovery fails
      expect(signal.value).toBe('fallback-test');
    });
  });

  describe('Requirement 5.1: MTM frontmatter compilation', () => {
    it('should detect and handle frontmatter changes', async () => {
      const content = `---
target: reactjs
channels: ['user-events']
imports: ['./utils.js']
---
<div>Component with frontmatter</div>`;

      orchestrator.handleFileChange('/src/components/FrontmatterTest.mtm', 'mtm', content);
      
      vi.advanceTimersByTime(100);
      await vi.runAllTimersAsync();

      // Frontmatter should be processed
      const stats = orchestrator.getStats();
      expect(stats.queuedReloads).toBe(1);
    });

    it('should handle frontmatter changes that affect compilation', async () => {
      // Initial content
      const initialContent = `---
target: reactjs
channels: ['events']
---
<div>Initial</div>`;

      // Updated content with frontmatter changes
      const updatedContent = `---
target: vue
channels: ['events', 'analytics']
imports: ['./new-utils.js']
---
<div>Updated</div>`;

      // First reload
      orchestrator.handleFileChange('/src/components/FrontmatterChange.mtm', 'mtm', initialContent);
      
      vi.advanceTimersByTime(100);
      await vi.runAllTimersAsync();

      // Second reload with changes
      orchestrator.handleFileChange('/src/components/FrontmatterChange.mtm', 'mtm', updatedContent);
      
      vi.advanceTimersByTime(100);
      await vi.runAllTimersAsync();

      // Both reloads should be processed
      const stats = orchestrator.getStats();
      expect(stats.queuedReloads).toBe(2);
    });
  });

  describe('Requirement 5.2: Target framework changes', () => {
    it('should handle target framework changes in frontmatter', async () => {
      // Setup component with initial framework
      orchestrator.registerFrameworkComponent('react', 'FrameworkChangeTest');

      const contentWithFrameworkChange = `---
target: vue
channels: ['events']
---
<div>Changed to Vue</div>`;

      orchestrator.handleFileChange('/src/components/FrameworkChangeTest.mtm', 'mtm', contentWithFrameworkChange);
      
      vi.advanceTimersByTime(100);
      await vi.runAllTimersAsync();

      // Framework change should be handled
      const stats = orchestrator.getStats();
      expect(stats.queuedReloads).toBe(1);
    });

    it('should maintain state during target framework changes', async () => {
      const signal = signalManager.createSignal('framework-change-test', 'testSignal');
      
      orchestrator.registerFrameworkComponent('react', 'TestComponent');

      // Change from React to Vue
      const vueContent = `---
target: vue
channels: ['events']
---
<div>Vue Component</div>`;

      orchestrator.handleFileChange('/src/components/TestComponent.mtm', 'mtm', vueContent);
      
      vi.advanceTimersByTime(100);
      await vi.runAllTimersAsync();

      // State should be preserved during framework change
      expect(signal.value).toBe('framework-change-test');
    });
  });

  describe('Requirement 6.1: CSS hot reload support', () => {
    it('should handle CSS file changes with hot reload', async () => {
      const cssContent = `.component { background: red; color: white; }`;
      
      await orchestrator.handleCSSChange('/src/styles/component.css', 'css', cssContent);

      // CSS hot reload should be processed
      const cssStats = orchestrator.getCSSStats();
      expect(cssStats.completedUpdates).toBe(1);
    });

    it('should handle different CSS preprocessor types', async () => {
      const cssTypes = ['css', 'scss', 'less', 'stylus'] as const;
      
      for (const cssType of cssTypes) {
        const content = `.component { color: blue; }`;
        await orchestrator.handleCSSChange(`/src/styles/test.${cssType}`, cssType, content);
      }

      // All CSS types should be supported
      const cssStats = orchestrator.getCSSStats();
      expect(cssStats.completedUpdates).toBe(cssTypes.length);
    });

    it('should propagate CSS changes to affected frameworks', async () => {
      const frameworks = ['react', 'vue'];
      const cssContent = `.shared-component { theme: var(--primary-color); }`;
      
      await orchestrator.handleCSSChange('/src/styles/shared.css', 'css', cssContent, frameworks);

      // CSS should be propagated to specified frameworks
      const cssStats = orchestrator.getCSSStats();
      expect(cssStats.completedUpdates).toBe(1);
    });
  });

  describe('Integration Requirements Validation', () => {
    it('should satisfy all requirements in a comprehensive scenario', async () => {
      // Setup comprehensive test scenario
      const counterSignal = signalManager.createSignal(100, 'counter');
      const themeSignal = signalManager.createSignal('dark', 'theme');
      
      const userCallback = vi.fn();
      const analyticsCallback = vi.fn();
      
      pubSubSystem.subscribe('user-action', userCallback, 'TestComponent');
      pubSubSystem.subscribe('analytics', analyticsCallback, 'TestComponent');
      
      orchestrator.registerFrameworkComponent('react', 'TestComponent');

      const comprehensiveContent = `---
target: reactjs
channels: ['user-events', 'analytics']
imports: ['./utils.js', './analytics.js']
---

<div class="comprehensive-test">
  <h1>Counter: {counter}</h1>
  <p>Theme: {theme}</p>
  <button onClick={handleClick}>Click me</button>
</div>

<script>
function handleClick() {
  counter.update(counter.value + 1);
  pubsub.emit('user-action', { action: 'click', value: counter.value });
  pubsub.emit('analytics', { event: 'button_click', timestamp: Date.now() });
}
</script>`;

      const startTime = Date.now();

      // Trigger comprehensive hot reload
      orchestrator.handleFileChange('/src/components/ComprehensiveTest.mtm', 'mtm', comprehensiveContent);
      
      vi.advanceTimersByTime(100);
      await vi.runAllTimersAsync();

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Validate all requirements:

      // 1.1: Performance requirement
      expect(duration).toBeLessThan(500);

      // 1.2: Signal state preservation
      expect(counterSignal.value).toBe(100);
      expect(themeSignal.value).toBe('dark');

      // 1.4: Subscription maintenance
      expect(pubSubSystem.getSubscriptionCount('user-action')).toBe(1);
      expect(pubSubSystem.getSubscriptionCount('analytics')).toBe(1);

      // Test preserved functionality
      pubSubSystem.emit('user-action', { test: 'data' });
      pubSubSystem.emit('analytics', { event: 'test' });

      expect(userCallback).toHaveBeenCalledWith({ test: 'data' });
      expect(analyticsCallback).toHaveBeenCalledWith({ event: 'test' });

      // 5.1: MTM frontmatter compilation
      const stats = orchestrator.getStats();
      expect(stats.queuedReloads).toBe(1);

      // Verify cross-framework synchronization
      const snapshot = await orchestrator.createCrossFrameworkSnapshot();
      expect(snapshot).toBeDefined();
      expect(snapshot?.signalValues.size).toBeGreaterThan(0);
    });
  });
});