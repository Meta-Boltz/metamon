/**
 * Tests for Framework Requirement Analyzer
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { FrameworkRequirementAnalyzer } from '../ssr-optimization/framework-requirement-analyzer.js';
import { ComponentDefinition, LoadPriority } from '../types/ssr-optimization.js';

describe('FrameworkRequirementAnalyzer', () => {
  let analyzer: FrameworkRequirementAnalyzer;
  let mockComponents: ComponentDefinition[];

  beforeEach(() => {
    analyzer = new FrameworkRequirementAnalyzer();
    
    mockComponents = [
      {
        id: 'header-1',
        framework: 'react',
        component: 'Header',
        props: { title: 'Test' },
        isInteractive: true,
        priority: LoadPriority.CRITICAL
      },
      {
        id: 'nav-1',
        framework: 'react',
        component: 'Navigation',
        props: {},
        isInteractive: true,
        priority: LoadPriority.HIGH
      },
      {
        id: 'content-1',
        framework: 'vue',
        component: 'Content',
        props: { text: 'Hello' },
        isInteractive: false,
        priority: LoadPriority.NORMAL
      },
      {
        id: 'sidebar-1',
        framework: 'svelte',
        component: 'Sidebar',
        props: {},
        isInteractive: true,
        priority: LoadPriority.LOW
      },
      {
        id: 'footer-1',
        framework: 'solid',
        component: 'Footer',
        props: {},
        isInteractive: false,
        priority: LoadPriority.LOW
      }
    ];
  });

  describe('analyzeRequirements', () => {
    it('should analyze framework requirements correctly', () => {
      const result = analyzer.analyzeRequirements(mockComponents);
      
      expect(result.requirements).toHaveLength(4); // 4 different frameworks
      expect(result.criticalFrameworks).toContain('react');
      expect(result.deferredFrameworks).toContain('svelte');
      expect(result.deferredFrameworks).toContain('solid');
      expect(result.totalEstimatedSize).toBeGreaterThan(0);
    });

    it('should group components by framework', () => {
      const result = analyzer.analyzeRequirements(mockComponents);
      
      const reactReq = result.requirements.find(r => r.framework === 'react');
      expect(reactReq).toBeDefined();
      expect(reactReq?.components).toHaveLength(2); // header-1 and nav-1
      expect(reactReq?.components).toContain('header-1');
      expect(reactReq?.components).toContain('nav-1');
    });

    it('should prioritize frameworks based on highest component priority', () => {
      const result = analyzer.analyzeRequirements(mockComponents);
      
      const reactReq = result.requirements.find(r => r.framework === 'react');
      expect(reactReq?.priority).toBe(LoadPriority.CRITICAL); // Highest priority from components
      
      const vueReq = result.requirements.find(r => r.framework === 'vue');
      expect(vueReq?.priority).toBe(LoadPriority.NORMAL);
      
      const svelteReq = result.requirements.find(r => r.framework === 'svelte');
      expect(svelteReq?.priority).toBe(LoadPriority.LOW);
    });

    it('should calculate estimated sizes correctly', () => {
      const result = analyzer.analyzeRequirements(mockComponents);
      
      const reactReq = result.requirements.find(r => r.framework === 'react');
      expect(reactReq?.estimatedSize).toBeGreaterThan(45000); // Base size + interactive overhead
      
      const vueReq = result.requirements.find(r => r.framework === 'vue');
      expect(vueReq?.estimatedSize).toBe(35000); // Base size, no interactive components
    });

    it('should identify shared dependencies', () => {
      const result = analyzer.analyzeRequirements(mockComponents);
      
      // Based on the framework metadata, there should be some shared dependencies
      expect(result.sharedDependencies).toBeDefined();
      expect(Array.isArray(result.sharedDependencies)).toBe(true);
    });

    it('should sort requirements by priority', () => {
      const result = analyzer.analyzeRequirements(mockComponents);
      
      // Requirements should be sorted with critical first
      expect(result.requirements[0].priority).toBe(LoadPriority.CRITICAL);
      
      // Verify sorting order
      for (let i = 1; i < result.requirements.length; i++) {
        const current = result.requirements[i];
        const previous = result.requirements[i - 1];
        
        const priorityOrder = {
          [LoadPriority.CRITICAL]: 0,
          [LoadPriority.HIGH]: 1,
          [LoadPriority.NORMAL]: 2,
          [LoadPriority.LOW]: 3
        };
        
        expect(priorityOrder[current.priority]).toBeGreaterThanOrEqual(priorityOrder[previous.priority]);
      }
    });
  });

  describe('optimizeLoadingOrder', () => {
    it('should optimize loading order based on dependencies', () => {
      const requirements = analyzer.analyzeRequirements(mockComponents).requirements;
      const optimized = analyzer.optimizeLoadingOrder(requirements);
      
      expect(optimized).toHaveLength(requirements.length);
      
      // Critical frameworks should come first
      const criticalFrameworks = optimized.filter(r => r.priority === LoadPriority.CRITICAL);
      expect(criticalFrameworks.length).toBeGreaterThan(0);
    });

    it('should handle circular dependencies', () => {
      const requirements = analyzer.analyzeRequirements(mockComponents).requirements;
      
      // This should not throw an error even if there were circular dependencies
      expect(() => analyzer.optimizeLoadingOrder(requirements)).not.toThrow();
    });

    it('should maintain all requirements in optimized order', () => {
      const requirements = analyzer.analyzeRequirements(mockComponents).requirements;
      const optimized = analyzer.optimizeLoadingOrder(requirements);
      
      expect(optimized).toHaveLength(requirements.length);
      
      // All original frameworks should be present
      const originalFrameworks = requirements.map(r => r.framework).sort();
      const optimizedFrameworks = optimized.map(r => r.framework).sort();
      
      expect(optimizedFrameworks).toEqual(originalFrameworks);
    });
  });

  describe('calculateBundleSplitting', () => {
    it('should calculate bundle splitting strategy', () => {
      const requirements = analyzer.analyzeRequirements(mockComponents).requirements;
      const bundles = analyzer.calculateBundleSplitting(requirements);
      
      expect(bundles.size).toBeGreaterThan(0);
      
      // Should have framework-specific bundles
      expect(bundles.has('react-bundle')).toBe(true);
      expect(bundles.has('vue-bundle')).toBe(true);
      expect(bundles.has('svelte-bundle')).toBe(true);
      expect(bundles.has('solid-bundle')).toBe(true);
    });

    it('should create shared bundle for common dependencies', () => {
      const requirements = analyzer.analyzeRequirements(mockComponents).requirements;
      const bundles = analyzer.calculateBundleSplitting(requirements);
      
      // Check if shared bundle exists (depends on whether there are shared dependencies)
      const hasSharedBundle = bundles.has('shared');
      if (hasSharedBundle) {
        const sharedBundle = bundles.get('shared');
        expect(Array.isArray(sharedBundle)).toBe(true);
        expect(sharedBundle!.length).toBeGreaterThan(0);
      }
    });

    it('should exclude shared dependencies from framework bundles', () => {
      const requirements = analyzer.analyzeRequirements(mockComponents).requirements;
      const bundles = analyzer.calculateBundleSplitting(requirements);
      
      const sharedBundle = bundles.get('shared') || [];
      
      // Framework bundles should not contain shared dependencies
      for (const [bundleName, bundleContents] of bundles) {
        if (bundleName !== 'shared') {
          for (const sharedDep of sharedBundle) {
            expect(bundleContents).not.toContain(sharedDep);
          }
        }
      }
    });
  });

  describe('estimatePerformanceImpact', () => {
    it('should estimate performance impact correctly', () => {
      const requirements = analyzer.analyzeRequirements(mockComponents).requirements;
      const impact = analyzer.estimatePerformanceImpact(requirements);
      
      expect(impact).toHaveProperty('initialLoadTime');
      expect(impact).toHaveProperty('interactiveTime');
      expect(impact).toHaveProperty('totalTransferSize');
      expect(impact).toHaveProperty('cacheEfficiency');
      
      expect(impact.initialLoadTime).toBeGreaterThan(0);
      expect(impact.interactiveTime).toBeGreaterThanOrEqual(impact.initialLoadTime);
      expect(impact.totalTransferSize).toBeGreaterThan(0);
      expect(impact.cacheEfficiency).toBeGreaterThanOrEqual(0);
      expect(impact.cacheEfficiency).toBeLessThanOrEqual(1);
    });

    it('should calculate initial load time for critical frameworks only', () => {
      const requirements = analyzer.analyzeRequirements(mockComponents).requirements;
      const impact = analyzer.estimatePerformanceImpact(requirements);
      
      // Initial load time should be less than interactive time
      expect(impact.initialLoadTime).toBeLessThanOrEqual(impact.interactiveTime);
    });

    it('should include all frameworks in total transfer size', () => {
      const requirements = analyzer.analyzeRequirements(mockComponents).requirements;
      const impact = analyzer.estimatePerformanceImpact(requirements);
      
      const totalEstimatedSize = requirements.reduce((sum, req) => sum + req.estimatedSize, 0);
      expect(impact.totalTransferSize).toBe(totalEstimatedSize);
    });
  });

  describe('framework metadata', () => {
    it('should have correct framework sizes', () => {
      const reactComponents = mockComponents.filter(c => c.framework === 'react');
      const result = analyzer.analyzeRequirements(reactComponents);
      
      const reactReq = result.requirements[0];
      expect(reactReq.estimatedSize).toBeGreaterThan(45000); // React base size
    });

    it('should include framework dependencies', () => {
      const result = analyzer.analyzeRequirements(mockComponents);
      
      const reactReq = result.requirements.find(r => r.framework === 'react');
      expect(reactReq?.dependencies).toContain('react-dom');
      expect(reactReq?.dependencies).toContain('scheduler');
      
      const vueReq = result.requirements.find(r => r.framework === 'vue');
      expect(vueReq?.dependencies).toContain('@vue/runtime-dom');
      expect(vueReq?.dependencies).toContain('@vue/shared');
    });

    it('should handle unknown frameworks gracefully', () => {
      const unknownComponent: ComponentDefinition = {
        id: 'unknown-1',
        framework: 'unknown' as any,
        component: 'Unknown',
        props: {},
        isInteractive: false,
        priority: LoadPriority.NORMAL
      };
      
      expect(() => analyzer.analyzeRequirements([unknownComponent])).toThrow('Unknown framework: unknown');
    });
  });

  describe('interactive component overhead', () => {
    it('should add overhead for interactive components', () => {
      const nonInteractiveComponent: ComponentDefinition = {
        id: 'static-1',
        framework: 'react',
        component: 'Static',
        props: {},
        isInteractive: false,
        priority: LoadPriority.NORMAL
      };
      
      const interactiveComponent: ComponentDefinition = {
        id: 'interactive-1',
        framework: 'react',
        component: 'Interactive',
        props: {},
        isInteractive: true,
        priority: LoadPriority.NORMAL
      };
      
      const nonInteractiveResult = analyzer.analyzeRequirements([nonInteractiveComponent]);
      const interactiveResult = analyzer.analyzeRequirements([interactiveComponent]);
      
      const nonInteractiveSize = nonInteractiveResult.requirements[0].estimatedSize;
      const interactiveSize = interactiveResult.requirements[0].estimatedSize;
      
      expect(interactiveSize).toBeGreaterThan(nonInteractiveSize);
    });
  });
});