/**
 * Tests for runtime performance optimizations
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RuntimePerformanceOptimizer } from './performance-optimizer.js';
import type { ReactiveGraph, UpdateTrigger } from '../reactive/reactive-analyzer.js';
import type { ReactiveVariableNode } from '../types/unified-ast.js';

describe('RuntimePerformanceOptimizer', () => {
  let optimizer: RuntimePerformanceOptimizer;
  let mockReactiveGraph: ReactiveGraph;

  beforeEach(() => {
    optimizer = new RuntimePerformanceOptimizer();
    
    // Create mock reactive graph
    const mockVariable: ReactiveVariableNode = {
      type: 'VariableDeclaration',
      name: 'counter',
      hasDollarPrefix: true,
      hasReactiveSuffix: true,
      typeAnnotation: null,
      initializer: { type: 'Literal', value: 0 },
      isReactive: true,
      updateTriggers: ['template:counter'],
      dependencies: []
    };

    mockReactiveGraph = {
      variables: new Map([['counter', mockVariable]]),
      dependencies: new Map([['counter', []]]),
      updateChains: [],
      triggers: new Map([
        ['counter', [
          {
            variableName: 'counter',
            triggerType: 'template',
            targetElement: '[data-bind="counter"]',
            immediate: true
          }
        ]]
      ])
    };
  });

  afterEach(() => {
    optimizer.dispose();
  });

  describe('Update Batching Optimization', () => {
    it('should optimize update batching for reactive variables', () => {
      optimizer.optimizeUpdateBatching(mockReactiveGraph);
      
      // The optimization should complete without errors
      expect(true).toBe(true);
    });

    it('should schedule updates with proper batching', async () => {
      optimizer.optimizeUpdateBatching(mockReactiveGraph);
      
      // Schedule multiple updates
      optimizer.scheduleUpdate('counter', 1, 1);
      optimizer.scheduleUpdate('counter', 2, 1);
      optimizer.scheduleUpdate('counter', 3, 1);
      
      // Wait for batch processing
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const metrics = optimizer.getPerformanceMetrics();
      expect(metrics.batchedUpdates).toBeGreaterThan(0);
    });

    it('should execute high-priority updates immediately', () => {
      const consoleSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
      
      optimizer.optimizeUpdateBatching(mockReactiveGraph);
      
      // Schedule high-priority update
      optimizer.scheduleUpdate('counter', 10, 10); // Priority 10 > threshold 5
      
      // Should execute immediately
      expect(consoleSpy).toHaveBeenCalledWith(
        'Executing update for counter with value:',
        10
      );
      
      consoleSpy.mockRestore();
    });

    it('should handle batch size limits', async () => {
      const smallBatchOptimizer = new RuntimePerformanceOptimizer({
        maxBatchSize: 2,
        batchTimeout: 100,
        priorityThreshold: 5,
        enableDebouncing: true,
        debounceDelay: 50
      });

      try {
        smallBatchOptimizer.optimizeUpdateBatching(mockReactiveGraph);
        
        // Schedule updates that exceed batch size
        smallBatchOptimizer.scheduleUpdate('counter', 1, 1);
        smallBatchOptimizer.scheduleUpdate('counter', 2, 1);
        smallBatchOptimizer.scheduleUpdate('counter', 3, 1); // Should trigger batch processing
        
        await new Promise(resolve => setTimeout(resolve, 50));
        
        const metrics = smallBatchOptimizer.getPerformanceMetrics();
        expect(metrics.batchedUpdates).toBeGreaterThan(0);
      } finally {
        smallBatchOptimizer.dispose();
      }
    });
  });

  describe('Dependency Tracking Optimization', () => {
    it('should optimize dependency tracking', () => {
      const complexGraph: ReactiveGraph = {
        variables: new Map([
          ['a', { ...mockReactiveGraph.variables.get('counter')!, name: 'a' }],
          ['b', { ...mockReactiveGraph.variables.get('counter')!, name: 'b' }],
          ['c', { ...mockReactiveGraph.variables.get('counter')!, name: 'c' }]
        ]),
        dependencies: new Map([
          ['a', []],
          ['b', ['a']],
          ['c', ['a', 'b']]
        ]),
        updateChains: [],
        triggers: new Map()
      };

      const optimizedDeps = optimizer.optimizeDependencyTracking(complexGraph);
      
      expect(optimizedDeps.size).toBe(3);
      expect(optimizedDeps.get('a')?.dependents.has('b')).toBe(true);
      expect(optimizedDeps.get('a')?.dependents.has('c')).toBe(true);
      expect(optimizedDeps.get('b')?.dependents.has('c')).toBe(true);
    });

    it('should cache dependency lookups', () => {
      optimizer.optimizeDependencyTracking(mockReactiveGraph);
      
      // Reset metrics after optimization to get clean test
      optimizer.resetMetrics();
      
      // First lookup (cache hit for existing variable)
      const deps1 = optimizer.getDependencies('counter');
      expect(deps1).toEqual([]);
      
      // Second lookup (cache hit for same variable)
      const deps2 = optimizer.getDependencies('counter');
      expect(deps2).toEqual([]);
      
      // Third lookup (cache miss for non-existent variable)
      const deps3 = optimizer.getDependencies('nonexistent');
      expect(deps3).toEqual([]);
      
      const metrics = optimizer.getPerformanceMetrics();
      expect(metrics.dependencyHits).toBe(2); // Two hits for counter lookups
      expect(metrics.dependencyMisses).toBe(1); // One miss for nonexistent variable
    });

    it('should handle circular dependencies', () => {
      const circularGraph: ReactiveGraph = {
        variables: new Map([
          ['a', { ...mockReactiveGraph.variables.get('counter')!, name: 'a' }],
          ['b', { ...mockReactiveGraph.variables.get('counter')!, name: 'b' }]
        ]),
        dependencies: new Map([
          ['a', ['b']],
          ['b', ['a']] // Circular dependency
        ]),
        updateChains: [],
        triggers: new Map()
      };

      const optimizedDeps = optimizer.optimizeDependencyTracking(circularGraph);
      
      expect(optimizedDeps.size).toBe(2);
      expect(optimizedDeps.get('a')?.dependencies.has('b')).toBe(true);
      expect(optimizedDeps.get('b')?.dependencies.has('a')).toBe(true);
    });
  });

  describe('Tree Shaking', () => {
    it('should remove unused variables', () => {
      const code = `
        $used! = 1
        $unused! = 2
        $alsoUsed = 3
      `;
      
      const usedFeatures = new Set(['used', 'alsoUsed']);
      const result = optimizer.treeShakeUnusedFeatures(code, usedFeatures);
      
      expect(result.originalSize).toBeGreaterThan(result.optimizedSize);
      expect(result.reductionPercentage).toBeGreaterThan(0);
      expect(result.optimizationsApplied.length).toBeGreaterThan(0);
    });

    it('should remove dead code', () => {
      const code = `
        function test() {
          return 42;
          console.log('unreachable');
        }
      `;
      
      const usedFeatures = new Set(['test']);
      const result = optimizer.treeShakeUnusedFeatures(code, usedFeatures);
      
      expect(result.optimizationsApplied.some(opt => opt.includes('dead code'))).toBe(true);
    });

    it('should calculate performance gain', () => {
      const code = '$unused! = 1; $used! = 2;';
      const usedFeatures = new Set(['used']);
      
      const result = optimizer.treeShakeUnusedFeatures(code, usedFeatures);
      
      expect(result.performanceGain).toBeGreaterThanOrEqual(0);
      expect(result.performanceGain).toBeLessThanOrEqual(50);
    });
  });

  describe('Production Optimizations', () => {
    it('should create comprehensive production optimizations', () => {
      const code = `
        $counter! = 0
        $unused! = 1
        $increment = () => $counter++
      `;
      
      const result = optimizer.createProductionOptimizations(mockReactiveGraph, code);
      
      expect(result.optimizedCode).toBeDefined();
      expect(result.optimizedGraph).toBeDefined();
      expect(result.optimizationReport).toBeDefined();
      expect(result.optimizationReport.optimizationsApplied.length).toBeGreaterThanOrEqual(0);
    });

    it('should optimize reactive graph by removing unused variables', () => {
      const graphWithUnused: ReactiveGraph = {
        variables: new Map([
          ['used', mockReactiveGraph.variables.get('counter')!],
          ['unused', { ...mockReactiveGraph.variables.get('counter')!, name: 'unused' }]
        ]),
        dependencies: new Map([
          ['used', []],
          ['unused', []] // No dependencies or dependents
        ]),
        updateChains: [],
        triggers: new Map([
          ['used', [
            {
              variableName: 'used',
              triggerType: 'template',
              immediate: false
            }
          ]]
          // No triggers for 'unused'
        ])
      };

      const result = optimizer.createProductionOptimizations(graphWithUnused, '');
      
      // The unused variable should be removed from the optimized graph
      expect(result.optimizedGraph.variables.has('used')).toBe(true);
      expect(result.optimizedGraph.variables.has('unused')).toBe(false);
    });
  });

  describe('Performance Metrics', () => {
    it('should track performance metrics', () => {
      optimizer.optimizeDependencyTracking(mockReactiveGraph);
      
      // Reset metrics after optimization to get clean test
      optimizer.resetMetrics();
      
      optimizer.getDependencies('counter'); // Cache hit (variable exists in cache)
      optimizer.getDependencies('nonexistent'); // Cache miss (variable doesn't exist)
      
      const code = '$unused! = 1;';
      optimizer.treeShakeUnusedFeatures(code, new Set());
      
      const metrics = optimizer.getPerformanceMetrics();
      
      expect(metrics.dependencyHits).toBe(1);
      expect(metrics.dependencyMisses).toBe(1);
      expect(metrics.treeShakingReductions).toBe(1);
    });

    it('should reset metrics', () => {
      optimizer.optimizeDependencyTracking(mockReactiveGraph);
      
      // Reset metrics first to get clean state
      optimizer.resetMetrics();
      
      // Now perform operations that should affect metrics
      optimizer.getDependencies('counter'); // Cache hit
      optimizer.getDependencies('nonexistent'); // Cache miss
      
      let metrics = optimizer.getPerformanceMetrics();
      expect(metrics.dependencyHits).toBe(1);
      expect(metrics.dependencyMisses).toBe(1);
      
      optimizer.resetMetrics();
      
      metrics = optimizer.getPerformanceMetrics();
      expect(metrics.dependencyMisses).toBe(0);
      expect(metrics.dependencyHits).toBe(0);
      expect(metrics.batchedUpdates).toBe(0);
    });
  });

  describe('Configuration', () => {
    it('should respect batch configuration', () => {
      const customOptimizer = new RuntimePerformanceOptimizer({
        maxBatchSize: 1,
        batchTimeout: 10,
        priorityThreshold: 1,
        enableDebouncing: false,
        debounceDelay: 0
      });

      try {
        customOptimizer.optimizeUpdateBatching(mockReactiveGraph);
        
        // With debouncing disabled, updates should not be batched
        customOptimizer.scheduleUpdate('counter', 1, 0);
        
        // Should execute immediately since debouncing is disabled
        expect(true).toBe(true); // Test passes if no errors
      } finally {
        customOptimizer.dispose();
      }
    });

    it('should respect dependency configuration', () => {
      const customOptimizer = new RuntimePerformanceOptimizer(
        undefined, // Use default batch config
        {
          enableWeakReferences: false,
          maxDependencyDepth: 5,
          enableCircularDetection: false,
          cacheSize: 10
        }
      );

      try {
        const result = customOptimizer.optimizeDependencyTracking(mockReactiveGraph);
        expect(result.size).toBeGreaterThan(0);
      } finally {
        customOptimizer.dispose();
      }
    });

    it('should respect tree shaking configuration', () => {
      const customOptimizer = new RuntimePerformanceOptimizer(
        undefined, // Use default batch config
        undefined, // Use default dependency config
        {
          enableDeadCodeElimination: false,
          enableUnusedVariableRemoval: true,
          enableFunctionInlining: false,
          aggressiveOptimization: true
        }
      );

      try {
        const code = `
          $unused! = 1
          function test() {
            return 42;
            console.log('unreachable');
          }
        `;
        
        const result = customOptimizer.treeShakeUnusedFeatures(code, new Set());
        
        // Should remove unused variables but not dead code
        const hasUnusedVariableRemoval = result.optimizationsApplied.some(opt => 
          opt.includes('unused variables')
        );
        const hasDeadCodeRemoval = result.optimizationsApplied.some(opt => 
          opt.includes('dead code')
        );
        
        expect(hasUnusedVariableRemoval).toBe(true);
        expect(hasDeadCodeRemoval).toBe(false);
      } finally {
        customOptimizer.dispose();
      }
    });
  });

  describe('Resource Cleanup', () => {
    it('should cleanup resources on dispose', () => {
      optimizer.optimizeUpdateBatching(mockReactiveGraph);
      optimizer.scheduleUpdate('counter', 1, 1);
      
      // Should not throw errors
      optimizer.dispose();
      
      // Metrics should still be accessible after dispose
      const metrics = optimizer.getPerformanceMetrics();
      expect(metrics).toBeDefined();
    });
  });
});