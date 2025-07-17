import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolve, join } from 'path';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { IncrementalCompiler } from './incremental-compiler.js';
import { ReactAdapter, VueAdapter } from '@metamon/adapters';

const testDir = resolve(__dirname, '../test-fixtures-incremental');

describe('IncrementalCompiler', () => {
  let compiler: IncrementalCompiler;

  beforeEach(() => {
    // Create test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    mkdirSync(testDir, { recursive: true });

    // Initialize compiler with adapters
    compiler = new IncrementalCompiler({
      reactjs: new ReactAdapter(),
      vue: new VueAdapter()
    });
  });

  afterEach(() => {
    // Clean up test files
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('Basic Compilation', () => {
    it('should compile a simple .mtm file', async () => {
      const mtmFile = join(testDir, 'simple.mtm');
      writeFileSync(mtmFile, `---
target: reactjs
---
import React from 'react';

export default function Simple() {
  return <div>Simple Component</div>;
}`);

      const result = await compiler.compile(mtmFile);
      
      expect(result).toBeDefined();
      expect(result.code).toContain('Simple Component');
      expect(result.dependencies).toBeDefined();
    });

    it('should throw error for unsupported framework', async () => {
      const mtmFile = join(testDir, 'unsupported.mtm');
      writeFileSync(mtmFile, `---
target: angular
---
export default function Unsupported() {
  return <div>Unsupported</div>;
}`);

      await expect(compiler.compile(mtmFile)).rejects.toThrow('Invalid target \'angular\'');
    });
  });

  describe('Caching', () => {
    it('should cache compilation results', async () => {
      const mtmFile = join(testDir, 'cached.mtm');
      writeFileSync(mtmFile, `---
target: reactjs
---
export default function Cached() {
  return <div>Cached Component</div>;
}`);

      // First compilation
      const result1 = await compiler.compile(mtmFile);
      
      // Second compilation should use cache
      const result2 = await compiler.compile(mtmFile);
      
      expect(result1.code).toBe(result2.code);
    });

    it('should invalidate cache when file changes', async () => {
      const mtmFile = join(testDir, 'changing.mtm');
      writeFileSync(mtmFile, `---
target: reactjs
---
export default function Changing() {
  return <div>Version 1</div>;
}`);

      // First compilation
      const result1 = await compiler.compile(mtmFile);
      expect(result1.code).toContain('Version 1');

      // Wait a bit to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 10));

      // Change file
      writeFileSync(mtmFile, `---
target: reactjs
---
export default function Changing() {
  return <div>Version 2</div>;
}`);

      // Second compilation should recompile
      const result2 = await compiler.compile(mtmFile);
      expect(result2.code).toContain('Version 2');
    });
  });

  describe('Dependency Tracking', () => {
    it('should track file dependencies', async () => {
      // Create a dependency file
      const depFile = join(testDir, 'dependency.js');
      writeFileSync(depFile, 'export const value = "dependency";');

      const mtmFile = join(testDir, 'with-deps.mtm');
      writeFileSync(mtmFile, `---
target: reactjs
---
import React from 'react';
import { value } from './dependency.js';

export default function WithDeps() {
  return <div>{value}</div>;
}`);

      const result = await compiler.compile(mtmFile);
      expect(result.dependencies).toContain('./dependency.js');
    });

    it('should find files that need recompilation', async () => {
      // Create dependency
      const depFile = join(testDir, 'shared-dep.js');
      writeFileSync(depFile, 'export const shared = "original";');

      // Create two files that depend on it
      const mtmFile1 = join(testDir, 'dependent1.mtm');
      writeFileSync(mtmFile1, `---
target: reactjs
---
import { shared } from './shared-dep.js';
export default function Dependent1() {
  return <div>{shared}</div>;
}`);

      const mtmFile2 = join(testDir, 'dependent2.mtm');
      writeFileSync(mtmFile2, `---
target: reactjs
---
import { shared } from './shared-dep.js';
export default function Dependent2() {
  return <div>{shared}</div>;
}`);

      // Compile both files
      await compiler.compile(mtmFile1);
      await compiler.compile(mtmFile2);

      // Get files that need recompilation when dependency changes
      const filesToRecompile = compiler.getFilesToRecompile(depFile);
      
      expect(filesToRecompile).toContain(mtmFile1);
      expect(filesToRecompile).toContain(mtmFile2);
    });
  });

  describe('Cache Management', () => {
    it('should clear cache for specific file', async () => {
      const mtmFile = join(testDir, 'clearable.mtm');
      writeFileSync(mtmFile, `---
target: reactjs
---
export default function Clearable() {
  return <div>Clearable</div>;
}`);

      // Compile and cache
      await compiler.compile(mtmFile);
      
      // Clear cache
      compiler.clearCache(mtmFile);
      
      // Should recompile (we can't directly test cache miss, but this shouldn't throw)
      const result = await compiler.compile(mtmFile);
      expect(result).toBeDefined();
    });

    it('should clear all caches', async () => {
      const mtmFile1 = join(testDir, 'clearable1.mtm');
      const mtmFile2 = join(testDir, 'clearable2.mtm');
      
      writeFileSync(mtmFile1, `---
target: reactjs
---
export default function Clearable1() { return <div>1</div>; }`);
      
      writeFileSync(mtmFile2, `---
target: vue
---
<template><div>2</div></template>`);

      // Compile both
      await compiler.compile(mtmFile1);
      await compiler.compile(mtmFile2);
      
      // Clear all caches
      compiler.clearAllCaches();
      
      // Should still work
      const result1 = await compiler.compile(mtmFile1);
      const result2 = await compiler.compile(mtmFile2);
      
      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
    });
  });

  describe('Statistics', () => {
    it('should provide compilation statistics', async () => {
      const mtmFile1 = join(testDir, 'stats1.mtm');
      const mtmFile2 = join(testDir, 'stats2.mtm');
      
      writeFileSync(mtmFile1, `---
target: reactjs
---
export default function Stats1() { return <div>1</div>; }`);
      
      writeFileSync(mtmFile2, `---
target: vue
---
<template><div>2</div></template>`);

      // Compile files
      await compiler.compile(mtmFile1);
      await compiler.compile(mtmFile2);
      
      const stats = compiler.getStats();
      
      expect(stats.cachedFiles).toBe(2);
      expect(stats.totalDependencies).toBeGreaterThanOrEqual(0);
      expect(stats.averageDependencies).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing files', async () => {
      const nonExistentFile = join(testDir, 'non-existent.mtm');
      
      await expect(compiler.compile(nonExistentFile)).rejects.toThrow();
    });

    it('should handle invalid .mtm files', async () => {
      const invalidFile = join(testDir, 'invalid.mtm');
      writeFileSync(invalidFile, 'not a valid mtm file');
      
      await expect(compiler.compile(invalidFile)).rejects.toThrow();
    });
  });
});