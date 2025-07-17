/**
 * Integration tests for frontmatter hot reload functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FrontmatterHotReloadManager } from '../../frontmatter-hot-reload-manager.js';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Mock fs module
vi.mock('fs', () => ({
  readFileSync: vi.fn(),
  existsSync: vi.fn()
}));

describe('Frontmatter Hot Reload Integration', () => {
  let manager: FrontmatterHotReloadManager;
  let testFilePath: string;

  beforeEach(() => {
    manager = new FrontmatterHotReloadManager({
      enableFrontmatterDetection: true,
      enableChannelUpdates: true,
      enableDependencyResolution: true,
      enableTargetFrameworkChanges: true,
      debugLogging: false
    });
    
    testFilePath = join(tmpdir(), 'test-integration.mtm');
    vi.clearAllMocks();
  });

  afterEach(() => {
    manager.cleanup();
  });

  describe('MTM file frontmatter changes', () => {
    it('should handle target framework change through manager', async () => {
      const initialContent = `---
target: reactjs
channels:
  - event: test-event
    emit: onTestEvent
---

import React from 'react';

export default function TestComponent() {
  return <div>Test</div>;
}`;

      const changedContent = `---
target: vue
channels:
  - event: test-event
    emit: onTestEvent
---

import React from 'react';

export default function TestComponent() {
  return <div>Test</div>;
}`;

      vi.mocked(existsSync).mockReturnValue(true);
      
      // First call to establish baseline
      vi.mocked(readFileSync).mockReturnValue(initialContent);
      await manager.detectFrontmatterChanges(testFilePath, initialContent);

      // Second call with target framework change
      vi.mocked(readFileSync).mockReturnValue(changedContent);
      const result = await manager.detectFrontmatterChanges(testFilePath, changedContent);

      // Verify the manager detected the target framework change
      expect(result.hasChanges).toBe(true);
      expect(result.targetChanged).toBe(true);
      expect(result.changes).toHaveLength(1);
      expect(result.changes[0].type).toBe('target');
      expect(result.changes[0].oldValue).toBe('reactjs');
      expect(result.changes[0].newValue).toBe('vue');
    });

    it('should handle channels configuration change through manager', async () => {
      const initialContent = `---
target: reactjs
channels:
  - event: test-event
    emit: onTestEvent
---

import React from 'react';

export default function TestComponent() {
  return <div>Test</div>;
}`;

      const changedContent = `---
target: reactjs
channels:
  - event: test-event
    emit: onTestEvent
  - event: new-event
    emit: onNewEvent
---

import React from 'react';

export default function TestComponent() {
  return <div>Test</div>;
}`;

      vi.mocked(existsSync).mockReturnValue(true);
      
      // First call to establish baseline
      vi.mocked(readFileSync).mockReturnValue(initialContent);
      await manager.detectFrontmatterChanges(testFilePath, initialContent);

      // Second call with channels change
      vi.mocked(readFileSync).mockReturnValue(changedContent);
      const result = await manager.detectFrontmatterChanges(testFilePath, changedContent);

      // Verify the manager detected the channels change
      expect(result.hasChanges).toBe(true);
      expect(result.channelsChanged).toBe(true);
      expect(result.changes).toHaveLength(1);
      expect(result.changes[0].type).toBe('channels');
      expect(result.changes[0].requiresSubscriptionUpdate).toBe(true);
    });

    it('should handle import changes through manager', async () => {
      const initialContent = `---
target: reactjs
---

import React from 'react';

export default function TestComponent() {
  return <div>Test</div>;
}`;

      const changedContent = `---
target: reactjs
---

import React from 'react';
import { useState, useEffect } from 'react';

export default function TestComponent() {
  return <div>Test</div>;
}`;

      vi.mocked(existsSync).mockReturnValue(true);
      
      // First call to establish baseline
      vi.mocked(readFileSync).mockReturnValue(initialContent);
      await manager.detectFrontmatterChanges(testFilePath, initialContent);

      // Second call with import changes
      vi.mocked(readFileSync).mockReturnValue(changedContent);
      const result = await manager.detectFrontmatterChanges(testFilePath, changedContent);

      // Verify the manager detected the import changes
      expect(result.hasChanges).toBe(true);
      expect(result.importsChanged).toBe(true);
      expect(result.changes).toHaveLength(1);
      expect(result.changes[0].type).toBe('imports');
      expect(result.changes[0].requiresDependencyResolution).toBe(true);
    });

    it('should handle multiple simultaneous frontmatter changes', async () => {
      const initialContent = `---
target: reactjs
route: /test
channels:
  - event: test-event
    emit: onTestEvent
---

import React from 'react';

export default function TestComponent() {
  return <div>Test</div>;
}`;

      const changedContent = `---
target: vue
route: /new-test
channels:
  - event: different-event
    emit: onDifferentEvent
  - event: another-event
    emit: onAnotherEvent
---

import React from 'react';
import { useState } from 'react';

export default function TestComponent() {
  return <div>Test</div>;
}`;

      vi.mocked(existsSync).mockReturnValue(true);
      
      // First call to establish baseline
      vi.mocked(readFileSync).mockReturnValue(initialContent);
      await manager.detectFrontmatterChanges(testFilePath, initialContent);

      // Second call with multiple changes
      vi.mocked(readFileSync).mockReturnValue(changedContent);
      const result = await manager.detectFrontmatterChanges(testFilePath, changedContent);

      // Verify the manager detected all changes
      expect(result.hasChanges).toBe(true);
      expect(result.targetChanged).toBe(true);
      expect(result.routeChanged).toBe(true);
      expect(result.channelsChanged).toBe(true);
      expect(result.importsChanged).toBe(true);
      expect(result.changes.length).toBeGreaterThan(1);
    });

    it('should handle invalid MTM file gracefully', async () => {
      const invalidContent = `
// This is not a valid MTM file
export default function TestComponent() {
  return <div>Test</div>;
}`;

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(invalidContent);

      // Should not throw an error even with invalid content
      const result = await manager.detectFrontmatterChanges(testFilePath, invalidContent);
      expect(result.hasChanges).toBe(false);
    });
  });

  describe('Configuration integration', () => {
    it('should respect frontmatter hot reload configuration', async () => {
      // Create manager with frontmatter detection disabled
      const disabledManager = new FrontmatterHotReloadManager({
        enableFrontmatterDetection: false,
        enableChannelUpdates: false,
        enableDependencyResolution: false,
        enableTargetFrameworkChanges: false,
        debugLogging: false
      });

      const content = `---
target: reactjs
channels:
  - event: test-event
    emit: onTestEvent
---

import React from 'react';

export default function TestComponent() {
  return <div>Test</div>;
}`;

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(content);

      // Should still handle the file change even with frontmatter detection disabled
      const result = await disabledManager.detectFrontmatterChanges(testFilePath, content);
      expect(result.hasChanges).toBe(false);

      disabledManager.cleanup();
    });

    it('should update frontmatter configuration dynamically', () => {
      const newConfig = {
        enableFrontmatterDetection: false,
        debugLogging: true
      };

      manager.updateConfig(newConfig);
      const config = manager.getConfig();

      expect(config.enableFrontmatterDetection).toBe(false);
      expect(config.debugLogging).toBe(true);
    });
  });

  describe('Error handling', () => {
    it('should handle file read errors gracefully', async () => {
      vi.mocked(existsSync).mockReturnValue(false);

      // Should not throw an error even when file doesn't exist
      const result = await manager.detectFrontmatterChanges(testFilePath);
      expect(result.hasChanges).toBe(false);
    });

    it('should handle YAML parsing errors gracefully', async () => {
      const invalidYamlContent = `---
target: reactjs
channels:
  - event: test-event
    emit: onTestEvent
  - invalid yaml structure
---

import React from 'react';

export default function TestComponent() {
  return <div>Test</div>;
}`;

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(invalidYamlContent);

      // Should handle invalid YAML gracefully
      const result = await manager.detectFrontmatterChanges(testFilePath, invalidYamlContent);
      expect(result.hasChanges).toBe(false);
    });
  });

  describe('Performance', () => {
    it('should handle rapid successive changes efficiently', async () => {
      const baseContent = `---
target: reactjs
channels:
  - event: test-event
    emit: onTestEvent
---

import React from 'react';

export default function TestComponent() {
  return <div>Test</div>;
}`;

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(baseContent);

      // First establish baseline
      await manager.detectFrontmatterChanges(testFilePath, baseContent);

      // Simulate rapid successive changes
      const promises = [];
      for (let i = 0; i < 10; i++) {
        const modifiedContent = baseContent.replace('test-event', `test-event-${i}`);
        promises.push(manager.detectFrontmatterChanges(testFilePath, modifiedContent));
      }

      // All changes should be handled without errors
      const results = await Promise.all(promises);
      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result.hasChanges).toBe(true);
        expect(result.channelsChanged).toBe(true);
      });
    });
  });
});