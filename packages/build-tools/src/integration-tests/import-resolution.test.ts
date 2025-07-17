import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { MTMImportResolver } from '@metamon/core';
import { DependencyTracker } from '../dependency-tracker.js';
import { MTMModuleBundler } from '../module-bundler.js';

describe('Import Resolution Integration Tests', () => {
  const testDir = path.join(__dirname, 'test-fixtures');
  const pagesDir = 'pages';
  const componentsDir = 'components';

  beforeEach(async () => {
    // Create test directory structure
    await fs.mkdir(testDir, { recursive: true });
    await fs.mkdir(path.join(testDir, pagesDir), { recursive: true });
    await fs.mkdir(path.join(testDir, componentsDir), { recursive: true });
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('MTMImportResolver', () => {
    it('should resolve relative imports correctly', async () => {
      // Create test files
      const buttonComponent = `---
target: reactjs
---
export default function Button() {
  return <button>Click me</button>;
}`;

      const pageFile = `---
target: reactjs
---
import Button from '../components/Button.mtm';

export default function HomePage() {
  return <div><Button /></div>;
}`;

      await fs.writeFile(path.join(testDir, componentsDir, 'Button.mtm'), buttonComponent);
      await fs.writeFile(path.join(testDir, pagesDir, 'home.mtm'), pageFile);

      const resolver = new MTMImportResolver({
        root: testDir,
        pagesDir,
        componentsDir,
        extensions: ['.mtm']
      });

      const homePath = path.join(testDir, pagesDir, 'home.mtm');
      const resolvedPath = resolver.resolve('../components/Button.mtm', homePath);

      expect(resolvedPath).toBe(path.join(testDir, componentsDir, 'Button.mtm'));
    });

    it('should resolve alias imports correctly', async () => {
      const buttonComponent = `---
target: reactjs
---
export default function Button() {
  return <button>Click me</button>;
}`;

      const pageFile = `---
target: reactjs
---
import Button from '@components/Button.mtm';

export default function HomePage() {
  return <div><Button /></div>;
}`;

      await fs.writeFile(path.join(testDir, componentsDir, 'Button.mtm'), buttonComponent);
      await fs.writeFile(path.join(testDir, pagesDir, 'home.mtm'), pageFile);

      const resolver = new MTMImportResolver({
        root: testDir,
        pagesDir,
        componentsDir,
        extensions: ['.mtm'],
        alias: {
          '@components': path.join(testDir, componentsDir)
        }
      });

      const homePath = path.join(testDir, pagesDir, 'home.mtm');
      const resolvedPath = resolver.resolve('@components/Button.mtm', homePath);

      expect(resolvedPath).toBe(path.join(testDir, componentsDir, 'Button.mtm'));
    });

    it('should determine file type correctly', async () => {
      const resolver = new MTMImportResolver({
        root: testDir,
        pagesDir,
        componentsDir,
        extensions: ['.mtm']
      });

      const pagePath = path.join(testDir, pagesDir, 'home.mtm');
      const componentPath = path.join(testDir, componentsDir, 'Button.mtm');

      expect(resolver.getFileType(pagePath)).toBe('page');
      expect(resolver.getFileType(componentPath)).toBe('component');
    });

    it('should extract dependencies correctly', async () => {
      const content = `---
target: reactjs
---
import Button from '../components/Button.mtm';
import Modal from './Modal.mtm';
import { useState } from 'react';

export default function HomePage() {
  return <div><Button /><Modal /></div>;
}`;

      await fs.writeFile(path.join(testDir, pagesDir, 'home.mtm'), content);
      await fs.writeFile(path.join(testDir, componentsDir, 'Button.mtm'), '---\ntarget: reactjs\n---\nexport default function Button() { return <button />; }');
      await fs.writeFile(path.join(testDir, pagesDir, 'Modal.mtm'), '---\ntarget: reactjs\n---\nexport default function Modal() { return <div />; }');

      const resolver = new MTMImportResolver({
        root: testDir,
        pagesDir,
        componentsDir,
        extensions: ['.mtm']
      });

      const homePath = path.join(testDir, pagesDir, 'home.mtm');
      const dependencies = resolver.extractDependencies(homePath, content);

      expect(dependencies).toHaveLength(2);
      expect(dependencies[0].specifier).toBe('../components/Button.mtm');
      expect(dependencies[1].specifier).toBe('./Modal.mtm');
    });
  });

  describe('DependencyTracker', () => {
    it('should build dependency graph correctly', async () => {
      // Create a complex dependency structure
      const buttonComponent = `---
target: reactjs
---
export default function Button() {
  return <button>Click me</button>;
}`;

      const modalComponent = `---
target: reactjs
---
import Button from './Button.mtm';

export default function Modal() {
  return <div><Button /></div>;
}`;

      const homePage = `---
target: reactjs
---
import Modal from '../components/Modal.mtm';

export default function HomePage() {
  return <div><Modal /></div>;
}`;

      await fs.writeFile(path.join(testDir, componentsDir, 'Button.mtm'), buttonComponent);
      await fs.writeFile(path.join(testDir, componentsDir, 'Modal.mtm'), modalComponent);
      await fs.writeFile(path.join(testDir, pagesDir, 'home.mtm'), homePage);

      const tracker = new DependencyTracker({
        root: testDir,
        pagesDir,
        componentsDir
      });

      const graph = await tracker.buildDependencyGraph();

      expect(graph.files.size).toBe(3);
      expect(graph.buildOrder).toHaveLength(3);
      
      // Button should be built first (no dependencies)
      expect(graph.buildOrder[0]).toContain('Button.mtm');
      // Modal should be built second (depends on Button)
      expect(graph.buildOrder[1]).toContain('Modal.mtm');
      // Home should be built last (depends on Modal)
      expect(graph.buildOrder[2]).toContain('home.mtm');
    });

    it('should detect circular dependencies', async () => {
      const componentA = `---
target: reactjs
---
import ComponentB from './ComponentB.mtm';

export default function ComponentA() {
  return <div><ComponentB /></div>;
}`;

      const componentB = `---
target: reactjs
---
import ComponentA from './ComponentA.mtm';

export default function ComponentB() {
  return <div><ComponentA /></div>;
}`;

      await fs.writeFile(path.join(testDir, componentsDir, 'ComponentA.mtm'), componentA);
      await fs.writeFile(path.join(testDir, componentsDir, 'ComponentB.mtm'), componentB);

      const tracker = new DependencyTracker({
        root: testDir,
        pagesDir,
        componentsDir
      });

      const graph = await tracker.buildDependencyGraph();
      const circularDeps = tracker.getCircularDependencies();

      expect(circularDeps.length).toBeGreaterThan(0);
      expect(circularDeps[0].some(path => path.includes('ComponentA.mtm'))).toBe(true);
      expect(circularDeps[0].some(path => path.includes('ComponentB.mtm'))).toBe(true);
    });

    it('should get files to rebuild correctly', async () => {
      const buttonComponent = `---
target: reactjs
---
export default function Button() {
  return <button>Click me</button>;
}`;

      const modalComponent = `---
target: reactjs
---
import Button from './Button.mtm';

export default function Modal() {
  return <div><Button /></div>;
}`;

      const homePage = `---
target: reactjs
---
import Modal from '../components/Modal.mtm';

export default function HomePage() {
  return <div><Modal /></div>;
}`;

      await fs.writeFile(path.join(testDir, componentsDir, 'Button.mtm'), buttonComponent);
      await fs.writeFile(path.join(testDir, componentsDir, 'Modal.mtm'), modalComponent);
      await fs.writeFile(path.join(testDir, pagesDir, 'home.mtm'), homePage);

      const tracker = new DependencyTracker({
        root: testDir,
        pagesDir,
        componentsDir
      });

      await tracker.buildDependencyGraph();

      const buttonPath = path.join(testDir, componentsDir, 'Button.mtm');
      const filesToRebuild = await tracker.getFilesToRebuild([buttonPath]);

      // Should include Button and Modal (which depends on Button)
      expect(filesToRebuild.length).toBeGreaterThanOrEqual(2);
      expect(filesToRebuild).toContain(buttonPath);
      expect(filesToRebuild.some(f => f.includes('Modal.mtm'))).toBe(true);
    });

    it('should provide project statistics', async () => {
      const reactComponent = `---
target: reactjs
---
export default function ReactComponent() {
  return <div>React</div>;
}`;

      const vueComponent = `---
target: vue
---
<template><div>Vue</div></template>`;

      const reactPage = `---
target: reactjs
---
import ReactComponent from '../components/ReactComponent.mtm';

export default function ReactPage() {
  return <div><ReactComponent /></div>;
}`;

      await fs.writeFile(path.join(testDir, componentsDir, 'ReactComponent.mtm'), reactComponent);
      await fs.writeFile(path.join(testDir, componentsDir, 'VueComponent.mtm'), vueComponent);
      await fs.writeFile(path.join(testDir, pagesDir, 'react-page.mtm'), reactPage);

      const tracker = new DependencyTracker({
        root: testDir,
        pagesDir,
        componentsDir
      });

      await tracker.buildDependencyGraph();
      const stats = tracker.getProjectStats();

      expect(stats.totalFiles).toBe(3);
      expect(stats.pageCount).toBe(1);
      expect(stats.componentCount).toBe(2);
      expect(stats.frameworkBreakdown.reactjs).toBe(2);
      expect(stats.frameworkBreakdown.vue).toBe(1);
    });
  });

  describe('MTMModuleBundler', () => {
    it('should bundle components by framework and type', async () => {
      const reactComponent = `---
target: reactjs
---
export default function ReactComponent() {
  return React.createElement('div', null, 'React Component');
}`;

      const vueComponent = `---
target: vue
---
export default {
  template: '<div>Vue Component</div>'
};`;

      await fs.writeFile(path.join(testDir, componentsDir, 'ReactComponent.mtm'), reactComponent);
      await fs.writeFile(path.join(testDir, componentsDir, 'VueComponent.mtm'), vueComponent);

      const tracker = new DependencyTracker({
        root: testDir,
        pagesDir,
        componentsDir
      });

      const graph = await tracker.buildDependencyGraph();
      const bundler = new MTMModuleBundler();

      const outDir = path.join(testDir, 'dist');
      await fs.mkdir(outDir, { recursive: true });

      const result = await bundler.bundle(graph, {
        outDir,
        sourceMaps: false,
        minify: false,
        target: 'es2020',
        external: []
      });

      expect(result.bundles.length).toBeGreaterThan(0);
      expect(result.bundles.some(b => b.framework === 'reactjs')).toBe(true);
      expect(result.bundles.some(b => b.framework === 'vue')).toBe(true);
    });

    it('should optimize bundle splitting', async () => {
      const sharedComponent = `---
target: reactjs
---
export default function SharedComponent() {
  return React.createElement('div', null, 'Shared');
}`;

      const componentA = `---
target: reactjs
---
import SharedComponent from './SharedComponent.mtm';

export default function ComponentA() {
  return React.createElement('div', null, React.createElement(SharedComponent));
}`;

      const componentB = `---
target: reactjs
---
import SharedComponent from './SharedComponent.mtm';

export default function ComponentB() {
  return React.createElement('div', null, React.createElement(SharedComponent));
}`;

      await fs.writeFile(path.join(testDir, componentsDir, 'SharedComponent.mtm'), sharedComponent);
      await fs.writeFile(path.join(testDir, componentsDir, 'ComponentA.mtm'), componentA);
      await fs.writeFile(path.join(testDir, componentsDir, 'ComponentB.mtm'), componentB);

      const tracker = new DependencyTracker({
        root: testDir,
        pagesDir,
        componentsDir
      });

      const graph = await tracker.buildDependencyGraph();
      const bundler = new MTMModuleBundler();

      const chunks = bundler.optimizeSplitting(graph);
      
      expect(chunks.has('shared')).toBe(true);
      expect(chunks.get('shared')).toContain(path.join(testDir, componentsDir, 'SharedComponent.mtm'));
    });

    it('should analyze bundles for optimization opportunities', async () => {
      const bundler = new MTMModuleBundler();
      
      const bundles = [
        {
          filePath: '/test/bundle1.js',
          sources: ['/test/comp1.mtm'],
          size: 1000,
          dependencies: ['react', 'lodash'],
          framework: 'reactjs',
          type: 'component' as const
        },
        {
          filePath: '/test/bundle2.js',
          sources: ['/test/comp2.mtm'],
          size: 1000,
          dependencies: ['react', 'axios'],
          framework: 'reactjs',
          type: 'component' as const
        }
      ];

      const analysis = bundler.analyzeBundles(bundles);
      
      expect(analysis.duplicateDependencies).toContain('react');
      expect(analysis.optimizationSuggestions.length).toBeGreaterThan(0);
    });
  });

  describe('Cross-framework Integration', () => {
    it('should handle mixed framework dependencies correctly', async () => {
      const reactComponent = `---
target: reactjs
---
export default function ReactComponent() {
  return React.createElement('div', null, 'React');
}`;

      const vueComponent = `---
target: vue
---
export default {
  template: '<div>Vue</div>'
};`;

      const mixedPage = `---
target: reactjs
---
import ReactComponent from '../components/ReactComponent.mtm';
// Note: This would normally be a warning as Vue components can't be directly imported into React

export default function MixedPage() {
  return React.createElement('div', null, React.createElement(ReactComponent));
}`;

      await fs.writeFile(path.join(testDir, componentsDir, 'ReactComponent.mtm'), reactComponent);
      await fs.writeFile(path.join(testDir, componentsDir, 'VueComponent.mtm'), vueComponent);
      await fs.writeFile(path.join(testDir, pagesDir, 'mixed.mtm'), mixedPage);

      const tracker = new DependencyTracker({
        root: testDir,
        pagesDir,
        componentsDir
      });

      const graph = await tracker.buildDependencyGraph();
      const stats = tracker.getProjectStats();

      expect(stats.frameworkBreakdown.reactjs).toBe(2);
      expect(stats.frameworkBreakdown.vue).toBe(1);
      
      // The dependency tracker should handle mixed frameworks gracefully
      expect(graph.files.size).toBe(3);
    });
  });
});