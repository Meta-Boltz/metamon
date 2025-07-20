import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ReactiveTemplateUpdater, type ReactiveUpdateConfig, type TemplateChangeDetection } from './reactive-template-updater.js';
import type { TemplateNode, DataBindingNode } from '../types/unified-ast.js';

describe('ReactiveTemplateUpdater', () => {
  let updater: ReactiveTemplateUpdater;
  let mockTemplate: TemplateNode;

  beforeEach(() => {
    updater = new ReactiveTemplateUpdater();
    
    mockTemplate = {
      type: 'Template',
      content: '<div>{{$name}} <button click="$handleClick()">Click</button></div>',
      bindings: [
        {
          type: 'DataBinding',
          bindingType: 'variable',
          source: '$name',
          target: 'dom-element',
          isReactive: true,
          updateStrategy: 'batched',
          location: { line: 1, column: 6, index: 5 }
        },
        {
          type: 'DataBinding',
          bindingType: 'event',
          source: '$handleClick()',
          target: 'click',
          isReactive: false,
          updateStrategy: 'immediate',
          location: { line: 1, column: 20, index: 19 }
        }
      ],
      expressions: [],
      location: { line: 1, column: 1, index: 0 }
    };
  });

  afterEach(() => {
    vi.clearAllTimers();
    updater.reset();
  });

  describe('constructor', () => {
    it('should initialize with default config', () => {
      const config = updater.getConfig();
      
      expect(config.strategy).toBe('batched');
      expect(config.batchSize).toBe(10);
      expect(config.debounceDelay).toBe(16);
      expect(config.enableOptimization).toBe(true);
      expect(config.trackDependencies).toBe(true);
    });

    it('should accept custom config', () => {
      const customConfig: Partial<ReactiveUpdateConfig> = {
        strategy: 'immediate',
        batchSize: 5,
        debounceDelay: 100
      };
      
      const customUpdater = new ReactiveTemplateUpdater(customConfig);
      const config = customUpdater.getConfig();
      
      expect(config.strategy).toBe('immediate');
      expect(config.batchSize).toBe(5);
      expect(config.debounceDelay).toBe(100);
    });
  });

  describe('analyzeTemplate', () => {
    it('should build dependency graph from template', () => {
      const graph = updater.analyzeTemplate(mockTemplate);
      
      expect(graph.variables.has('$name')).toBe(true);
      expect(graph.variables.has('$handleClick')).toBe(true);
      expect(graph.bindings.has('$name')).toBe(true);
      expect(graph.bindings.has('$handleClick')).toBe(true);
    });

    it('should map variables to elements', () => {
      const graph = updater.analyzeTemplate(mockTemplate);
      
      const nameElements = graph.variables.get('$name');
      expect(nameElements).toBeDefined();
      expect(nameElements!.size).toBe(1);
      
      const clickElements = graph.variables.get('$handleClick');
      expect(clickElements).toBeDefined();
      expect(clickElements!.size).toBe(1);
    });

    it('should map elements to variables', () => {
      const graph = updater.analyzeTemplate(mockTemplate);
      
      expect(graph.elements.size).toBe(2); // Two different elements
      
      for (const [elementId, variables] of graph.elements) {
        expect(variables.size).toBeGreaterThan(0);
      }
    });

    it('should handle template with no bindings', () => {
      const emptyTemplate: TemplateNode = {
        type: 'Template',
        content: '<div>Static content</div>',
        bindings: [],
        expressions: [],
        location: { line: 1, column: 1, index: 0 }
      };

      const graph = updater.analyzeTemplate(emptyTemplate);
      
      expect(graph.variables.size).toBe(0);
      expect(graph.elements.size).toBe(0);
      expect(graph.bindings.size).toBe(0);
    });
  });

  describe('detectTemplateChanges', () => {
    beforeEach(() => {
      updater.analyzeTemplate(mockTemplate);
    });

    it('should detect changes for reactive variables', () => {
      const changes = updater.detectTemplateChanges(mockTemplate, ['$name']);
      
      expect(changes.hasChanges).toBe(true);
      expect(changes.changedBindings).toHaveLength(1);
      expect(changes.affectedElements).toHaveLength(1);
      expect(changes.updateOperations).toHaveLength(1);
    });

    it('should detect multiple variable changes', () => {
      const changes = updater.detectTemplateChanges(mockTemplate, ['$name', '$handleClick']);
      
      expect(changes.hasChanges).toBe(true);
      expect(changes.changedBindings).toHaveLength(2);
      expect(changes.affectedElements).toHaveLength(2);
      expect(changes.updateOperations).toHaveLength(2);
    });

    it('should return no changes for unknown variables', () => {
      const changes = updater.detectTemplateChanges(mockTemplate, ['$unknown']);
      
      expect(changes.hasChanges).toBe(false);
      expect(changes.changedBindings).toHaveLength(0);
      expect(changes.affectedElements).toHaveLength(0);
      expect(changes.updateOperations).toHaveLength(0);
    });

    it('should optimize update operations', () => {
      // Create template with duplicate bindings
      const templateWithDuplicates: TemplateNode = {
        ...mockTemplate,
        bindings: [
          ...mockTemplate.bindings,
          {
            type: 'DataBinding',
            bindingType: 'variable',
            source: '$name',
            target: 'dom-element',
            isReactive: true,
            updateStrategy: 'batched',
            location: { line: 1, column: 30, index: 29 }
          }
        ]
      };

      updater.analyzeTemplate(templateWithDuplicates);
      const changes = updater.detectTemplateChanges(templateWithDuplicates, ['$name']);
      
      // Should optimize duplicate operations
      expect(changes.updateOperations.length).toBeLessThanOrEqual(2);
    });
  });

  describe('scheduleTemplateUpdate', () => {
    beforeEach(() => {
      updater.analyzeTemplate(mockTemplate);
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should execute immediate updates', async () => {
      const immediateUpdater = new ReactiveTemplateUpdater({ strategy: 'immediate' });
      immediateUpdater.analyzeTemplate(mockTemplate);
      
      const consoleSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
      
      await immediateUpdater.scheduleTemplateUpdate(mockTemplate, ['$name']);
      
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should batch updates', async () => {
      const batchedUpdater = new ReactiveTemplateUpdater({ 
        strategy: 'batched', 
        batchSize: 2 
      });
      batchedUpdater.analyzeTemplate(mockTemplate);
      
      const consoleSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
      
      // First update should be queued
      const promise1 = batchedUpdater.scheduleTemplateUpdate(mockTemplate, ['$name']);
      expect(consoleSpy).not.toHaveBeenCalled();
      
      // Second update should trigger batch execution
      const promise2 = batchedUpdater.scheduleTemplateUpdate(mockTemplate, ['$handleClick']);
      
      await Promise.all([promise1, promise2]);
      
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should debounce updates', async () => {
      const debouncedUpdater = new ReactiveTemplateUpdater({ 
        strategy: 'debounced',
        debounceDelay: 100
      });
      debouncedUpdater.analyzeTemplate(mockTemplate);
      
      const consoleSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
      
      // Schedule multiple updates
      const promise1 = debouncedUpdater.scheduleTemplateUpdate(mockTemplate, ['$name']);
      const promise2 = debouncedUpdater.scheduleTemplateUpdate(mockTemplate, ['$handleClick']);
      
      // Should not execute immediately
      expect(consoleSpy).not.toHaveBeenCalled();
      
      // Fast-forward time
      vi.advanceTimersByTime(100);
      
      await Promise.all([promise1, promise2]);
      
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should handle selective updates', async () => {
      const selectiveUpdater = new ReactiveTemplateUpdater({ strategy: 'selective' });
      selectiveUpdater.analyzeTemplate(mockTemplate);
      
      const consoleSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
      
      await selectiveUpdater.scheduleTemplateUpdate(mockTemplate, ['$name']);
      
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('generateFrameworkUpdateCode', () => {
    let changes: TemplateChangeDetection;

    beforeEach(() => {
      updater.analyzeTemplate(mockTemplate);
      changes = updater.detectTemplateChanges(mockTemplate, ['$name']);
    });

    it('should generate React update code', () => {
      const code = updater.generateFrameworkUpdateCode(changes, 'react');
      
      expect(code).toContain('React update code');
      expect(code).toContain('Update');
    });

    it('should generate Vue update code', () => {
      const code = updater.generateFrameworkUpdateCode(changes, 'vue');
      
      expect(code).toContain('Vue update code');
      expect(code).toContain('Update');
    });

    it('should generate Svelte update code', () => {
      const code = updater.generateFrameworkUpdateCode(changes, 'svelte');
      
      expect(code).toContain('Svelte update code');
      expect(code).toContain('Update');
    });

    it('should throw error for unsupported framework', () => {
      expect(() => {
        updater.generateFrameworkUpdateCode(changes, 'angular' as any);
      }).toThrow('Unsupported framework: angular');
    });
  });

  describe('configuration management', () => {
    it('should update configuration', () => {
      const newConfig: Partial<ReactiveUpdateConfig> = {
        strategy: 'immediate',
        batchSize: 20
      };
      
      updater.updateConfig(newConfig);
      const config = updater.getConfig();
      
      expect(config.strategy).toBe('immediate');
      expect(config.batchSize).toBe(20);
      expect(config.debounceDelay).toBe(16); // Should keep original value
    });

    it('should preserve existing config values', () => {
      const originalConfig = updater.getConfig();
      
      updater.updateConfig({ batchSize: 5 });
      const newConfig = updater.getConfig();
      
      expect(newConfig.batchSize).toBe(5);
      expect(newConfig.strategy).toBe(originalConfig.strategy);
      expect(newConfig.debounceDelay).toBe(originalConfig.debounceDelay);
    });
  });

  describe('reset', () => {
    it('should clear all state', () => {
      updater.analyzeTemplate(mockTemplate);
      
      const graph = updater.getDependencyGraph();
      expect(graph.variables.size).toBeGreaterThan(0);
      
      updater.reset();
      
      const clearedGraph = updater.getDependencyGraph();
      expect(clearedGraph.variables.size).toBe(0);
      expect(clearedGraph.elements.size).toBe(0);
      expect(clearedGraph.bindings.size).toBe(0);
    });
  });

  describe('complex scenarios', () => {
    it('should handle template with multiple variable references', () => {
      const complexTemplate: TemplateNode = {
        type: 'Template',
        content: '<div>{{$user.name}} - {{$user.email}} ({{$user.age}})</div>',
        bindings: [
          {
            type: 'DataBinding',
            bindingType: 'expression',
            source: '$user.name',
            target: 'dom-element',
            isReactive: true,
            updateStrategy: 'batched',
            location: { line: 1, column: 6, index: 5 }
          },
          {
            type: 'DataBinding',
            bindingType: 'expression',
            source: '$user.email',
            target: 'dom-element',
            isReactive: true,
            updateStrategy: 'batched',
            location: { line: 1, column: 20, index: 19 }
          },
          {
            type: 'DataBinding',
            bindingType: 'expression',
            source: '$user.age',
            target: 'dom-element',
            isReactive: true,
            updateStrategy: 'batched',
            location: { line: 1, column: 35, index: 34 }
          }
        ],
        expressions: [],
        location: { line: 1, column: 1, index: 0 }
      };

      const graph = updater.analyzeTemplate(complexTemplate);
      
      expect(graph.variables.has('$user')).toBe(true);
      expect(graph.bindings.has('$user')).toBe(true);
      
      const changes = updater.detectTemplateChanges(complexTemplate, ['$user']);
      expect(changes.hasChanges).toBe(true);
      expect(changes.changedBindings.length).toBeGreaterThan(0);
    });

    it('should handle nested expressions', () => {
      const nestedTemplate: TemplateNode = {
        type: 'Template',
        content: '<div>{{$formatName($user.firstName, $user.lastName)}}</div>',
        bindings: [
          {
            type: 'DataBinding',
            bindingType: 'expression',
            source: '$formatName($user.firstName, $user.lastName)',
            target: 'dom-element',
            isReactive: true,
            updateStrategy: 'batched',
            location: { line: 1, column: 6, index: 5 }
          }
        ],
        expressions: [],
        location: { line: 1, column: 1, index: 0 }
      };

      const graph = updater.analyzeTemplate(nestedTemplate);
      
      expect(graph.variables.has('$formatName')).toBe(true);
      expect(graph.variables.has('$user')).toBe(true);
    });
  });
});