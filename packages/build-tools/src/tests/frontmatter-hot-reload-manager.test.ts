/**
 * Tests for FrontmatterHotReloadManager
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FrontmatterHotReloadManager } from '../frontmatter-hot-reload-manager.js';
import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Mock fs module
vi.mock('fs', () => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  unlinkSync: vi.fn(),
  existsSync: vi.fn()
}));

describe('FrontmatterHotReloadManager', () => {
  let manager: FrontmatterHotReloadManager;
  let testFilePath: string;

  beforeEach(() => {
    manager = new FrontmatterHotReloadManager({
      debugLogging: false
    });
    testFilePath = join(tmpdir(), 'test-component.mtm');
    vi.clearAllMocks();
  });

  afterEach(() => {
    manager.cleanup();
  });

  describe('detectFrontmatterChanges', () => {
    it('should detect no changes on first run', async () => {
      const content = `---
target: reactjs
channels:
  - event: test-event
    emit: onTestEvent
---

export default function TestComponent() {
  return <div>Test</div>;
}`;

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(content);

      const result = await manager.detectFrontmatterChanges(testFilePath);

      expect(result.hasChanges).toBe(false);
      expect(result.targetChanged).toBe(false);
      expect(result.channelsChanged).toBe(false);
      expect(result.importsChanged).toBe(false);
    });

    it('should detect target framework changes', async () => {
      // First call to cache initial state
      const initialContent = `---
target: reactjs
channels:
  - event: test-event
    emit: onTestEvent
---

export default function TestComponent() {
  return <div>Test</div>;
}`;

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(initialContent);
      await manager.detectFrontmatterChanges(testFilePath);

      // Second call with changed target
      const changedContent = `---
target: vue
channels:
  - event: test-event
    emit: onTestEvent
---

export default function TestComponent() {
  return <div>Test</div>;
}`;

      vi.mocked(readFileSync).mockReturnValue(changedContent);
      const result = await manager.detectFrontmatterChanges(testFilePath, changedContent);

      expect(result.hasChanges).toBe(true);
      expect(result.targetChanged).toBe(true);
      expect(result.channelsChanged).toBe(false);
      expect(result.changes).toHaveLength(1);
      expect(result.changes[0].type).toBe('target');
      expect(result.changes[0].oldValue).toBe('reactjs');
      expect(result.changes[0].newValue).toBe('vue');
      expect(result.changes[0].requiresRecompilation).toBe(true);
    });

    it('should detect channels configuration changes', async () => {
      // First call to cache initial state
      const initialContent = `---
target: reactjs
channels:
  - event: test-event
    emit: onTestEvent
---

export default function TestComponent() {
  return <div>Test</div>;
}`;

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(initialContent);
      await manager.detectFrontmatterChanges(testFilePath);

      // Second call with changed channels
      const changedContent = `---
target: reactjs
channels:
  - event: test-event
    emit: onTestEvent
  - event: new-event
    emit: onNewEvent
---

export default function TestComponent() {
  return <div>Test</div>;
}`;

      vi.mocked(readFileSync).mockReturnValue(changedContent);
      const result = await manager.detectFrontmatterChanges(testFilePath, changedContent);

      expect(result.hasChanges).toBe(true);
      expect(result.channelsChanged).toBe(true);
      expect(result.targetChanged).toBe(false);
      expect(result.changes).toHaveLength(1);
      expect(result.changes[0].type).toBe('channels');
      expect(result.changes[0].requiresSubscriptionUpdate).toBe(true);
    });

    it('should detect import changes', async () => {
      // First call to cache initial state
      const initialContent = `---
target: reactjs
---

import React from 'react';

export default function TestComponent() {
  return <div>Test</div>;
}`;

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(initialContent);
      await manager.detectFrontmatterChanges(testFilePath);

      // Second call with new import
      const changedContent = `---
target: reactjs
---

import React from 'react';
import { useState } from 'react';

export default function TestComponent() {
  return <div>Test</div>;
}`;

      vi.mocked(readFileSync).mockReturnValue(changedContent);
      const result = await manager.detectFrontmatterChanges(testFilePath, changedContent);

      expect(result.hasChanges).toBe(true);
      expect(result.importsChanged).toBe(true);
      expect(result.changes).toHaveLength(1);
      expect(result.changes[0].type).toBe('imports');
      expect(result.changes[0].requiresDependencyResolution).toBe(true);
    });

    it('should detect route changes', async () => {
      // First call to cache initial state
      const initialContent = `---
target: reactjs
route: /test
---

export default function TestComponent() {
  return <div>Test</div>;
}`;

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(initialContent);
      await manager.detectFrontmatterChanges(testFilePath);

      // Second call with changed route
      const changedContent = `---
target: reactjs
route: /new-test
---

export default function TestComponent() {
  return <div>Test</div>;
}`;

      vi.mocked(readFileSync).mockReturnValue(changedContent);
      const result = await manager.detectFrontmatterChanges(testFilePath, changedContent);

      expect(result.hasChanges).toBe(true);
      expect(result.routeChanged).toBe(true);
      expect(result.changes).toHaveLength(1);
      expect(result.changes[0].type).toBe('route');
      expect(result.changes[0].oldValue).toBe('/test');
      expect(result.changes[0].newValue).toBe('/new-test');
    });

    it('should handle multiple simultaneous changes', async () => {
      // First call to cache initial state
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

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(initialContent);
      await manager.detectFrontmatterChanges(testFilePath);

      // Second call with multiple changes
      const changedContent = `---
target: vue
route: /new-test
channels:
  - event: different-event
    emit: onDifferentEvent
---

import React from 'react';
import { useState } from 'react';

export default function TestComponent() {
  return <div>Test</div>;
}`;

      vi.mocked(readFileSync).mockReturnValue(changedContent);
      const result = await manager.detectFrontmatterChanges(testFilePath, changedContent);

      expect(result.hasChanges).toBe(true);
      expect(result.targetChanged).toBe(true);
      expect(result.routeChanged).toBe(true);
      expect(result.channelsChanged).toBe(true);
      expect(result.importsChanged).toBe(true);
      expect(result.changes).toHaveLength(4);
    });

    it('should handle invalid MTM file format gracefully', async () => {
      const invalidContent = `
// This is not a valid MTM file
export default function TestComponent() {
  return <div>Test</div>;
}`;

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(invalidContent);

      const result = await manager.detectFrontmatterChanges(testFilePath, invalidContent);

      expect(result.hasChanges).toBe(false);
      expect(result.changes).toHaveLength(0);
    });
  });

  describe('getChannelSubscriptionUpdates', () => {
    it('should detect added channels', () => {
      const oldChannels = [
        { event: 'test-event', emit: 'onTestEvent' }
      ];
      const newChannels = [
        { event: 'test-event', emit: 'onTestEvent' },
        { event: 'new-event', emit: 'onNewEvent' }
      ];

      const updates = manager.getChannelSubscriptionUpdates(oldChannels, newChannels);

      expect(updates.added).toHaveLength(1);
      expect(updates.added[0]).toEqual({ event: 'new-event', emit: 'onNewEvent' });
      expect(updates.removed).toHaveLength(0);
    });

    it('should detect removed channels', () => {
      const oldChannels = [
        { event: 'test-event', emit: 'onTestEvent' },
        { event: 'old-event', emit: 'onOldEvent' }
      ];
      const newChannels = [
        { event: 'test-event', emit: 'onTestEvent' }
      ];

      const updates = manager.getChannelSubscriptionUpdates(oldChannels, newChannels);

      expect(updates.removed).toHaveLength(1);
      expect(updates.removed[0]).toEqual({ event: 'old-event', emit: 'onOldEvent' });
      expect(updates.added).toHaveLength(0);
    });

    it('should handle undefined channels', () => {
      const updates = manager.getChannelSubscriptionUpdates(undefined, undefined);

      expect(updates.added).toHaveLength(0);
      expect(updates.removed).toHaveLength(0);
      expect(updates.modified).toHaveLength(0);
    });

    it('should handle transition from undefined to defined channels', () => {
      const newChannels = [
        { event: 'new-event', emit: 'onNewEvent' }
      ];

      const updates = manager.getChannelSubscriptionUpdates(undefined, newChannels);

      expect(updates.added).toHaveLength(1);
      expect(updates.added[0]).toEqual({ event: 'new-event', emit: 'onNewEvent' });
      expect(updates.removed).toHaveLength(0);
    });
  });

  describe('handleTargetFrameworkChange', () => {
    it('should handle target framework change successfully', async () => {
      const result = await manager.handleTargetFrameworkChange(testFilePath, 'reactjs', 'vue');

      expect(result).toBe(true);
    });

    it('should return false when target framework changes are disabled', async () => {
      const disabledManager = new FrontmatterHotReloadManager({
        enableTargetFrameworkChanges: false
      });

      const result = await disabledManager.handleTargetFrameworkChange(testFilePath, 'reactjs', 'vue');

      expect(result).toBe(false);
      disabledManager.cleanup();
    });
  });

  describe('handleChannelsChange', () => {
    it('should handle channels change successfully', async () => {
      const subscriptionUpdates = {
        added: [{ event: 'new-event', emit: 'onNewEvent' }],
        removed: [],
        modified: []
      };

      const result = await manager.handleChannelsChange(testFilePath, subscriptionUpdates);

      expect(result).toBe(true);
    });

    it('should return false when channel updates are disabled', async () => {
      const disabledManager = new FrontmatterHotReloadManager({
        enableChannelUpdates: false
      });

      const subscriptionUpdates = {
        added: [{ event: 'new-event', emit: 'onNewEvent' }],
        removed: [],
        modified: []
      };

      const result = await disabledManager.handleChannelsChange(testFilePath, subscriptionUpdates);

      expect(result).toBe(false);
      disabledManager.cleanup();
    });
  });

  describe('handleImportsChange', () => {
    it('should handle imports change successfully', async () => {
      const oldImports = ["import React from 'react';"];
      const newImports = ["import React from 'react';", "import { useState } from 'react';"];

      const result = await manager.handleImportsChange(testFilePath, oldImports, newImports);

      expect(result).toBe(true);
    });

    it('should return false when dependency resolution is disabled', async () => {
      const disabledManager = new FrontmatterHotReloadManager({
        enableDependencyResolution: false
      });

      const oldImports = ["import React from 'react';"];
      const newImports = ["import React from 'react';", "import { useState } from 'react';"];

      const result = await disabledManager.handleImportsChange(testFilePath, oldImports, newImports);

      expect(result).toBe(false);
      disabledManager.cleanup();
    });
  });

  describe('cache management', () => {
    it('should cache frontmatter and imports', async () => {
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

      await manager.detectFrontmatterChanges(testFilePath);

      const cachedFrontmatter = manager.getCachedFrontmatter(testFilePath);
      const cachedImports = manager.getCachedImports(testFilePath);

      expect(cachedFrontmatter).toBeDefined();
      expect(cachedFrontmatter?.target).toBe('reactjs');
      expect(cachedImports).toBeDefined();
      expect(cachedImports).toContain("import React from 'react';");
    });

    it('should clear file cache', async () => {
      const content = `---
target: reactjs
---

import React from 'react';

export default function TestComponent() {
  return <div>Test</div>;
}`;

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(content);

      await manager.detectFrontmatterChanges(testFilePath);
      
      expect(manager.getCachedFrontmatter(testFilePath)).toBeDefined();
      
      manager.clearFileCache(testFilePath);
      
      expect(manager.getCachedFrontmatter(testFilePath)).toBeUndefined();
      expect(manager.getCachedImports(testFilePath)).toBeUndefined();
    });

    it('should clear all caches', async () => {
      const content = `---
target: reactjs
---

import React from 'react';

export default function TestComponent() {
  return <div>Test</div>;
}`;

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(content);

      await manager.detectFrontmatterChanges(testFilePath);
      await manager.detectFrontmatterChanges('another-file.mtm');
      
      manager.clearAllCaches();
      
      expect(manager.getCachedFrontmatter(testFilePath)).toBeUndefined();
      expect(manager.getCachedFrontmatter('another-file.mtm')).toBeUndefined();
    });
  });

  describe('configuration', () => {
    it('should update configuration', () => {
      const newConfig = {
        enableFrontmatterDetection: false,
        debugLogging: true
      };

      manager.updateConfig(newConfig);
      const config = manager.getConfig();

      expect(config.enableFrontmatterDetection).toBe(false);
      expect(config.debugLogging).toBe(true);
    });

    it('should return current configuration', () => {
      const config = manager.getConfig();

      expect(config).toBeDefined();
      expect(config.enableFrontmatterDetection).toBe(true);
      expect(config.enableChannelUpdates).toBe(true);
      expect(config.enableDependencyResolution).toBe(true);
      expect(config.enableTargetFrameworkChanges).toBe(true);
    });
  });
});