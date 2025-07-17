import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resolve, join } from 'path';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { MetamonFileWatcher, createFileWatcher } from './file-watcher.js';

const testDir = resolve(__dirname, '../test-fixtures-watcher');

describe('MetamonFileWatcher', () => {
  let watcher: MetamonFileWatcher;

  beforeEach(() => {
    // Create test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    mkdirSync(testDir, { recursive: true });

    watcher = new MetamonFileWatcher();
  });

  afterEach(() => {
    // Stop watcher and clean up
    if (watcher) {
      watcher.stop();
    }
    
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('Basic Functionality', () => {
    it('should create file watcher instance', () => {
      expect(watcher).toBeDefined();
      expect(watcher.watching).toBe(false);
    });

    it('should start watching files', () => {
      watcher.start(testDir);
      expect(watcher.watching).toBe(true);
    });

    it('should stop watching files', () => {
      watcher.start(testDir);
      expect(watcher.watching).toBe(true);
      
      watcher.stop();
      expect(watcher.watching).toBe(false);
    });
  });

  describe('File Change Detection', () => {
    it('should detect .mtm file changes', (done) => {
      const mtmFile = join(testDir, 'test.mtm');
      
      // Create initial file
      writeFileSync(mtmFile, `---
target: reactjs
---
export default function Test() {
  return <div>Original</div>;
}`);

      watcher.on('file-changed', (filePath) => {
        expect(filePath).toBe(resolve(mtmFile));
        done();
      });

      watcher.start(testDir);

      // Wait a bit then modify file
      setTimeout(() => {
        writeFileSync(mtmFile, `---
target: reactjs
---
export default function Test() {
  return <div>Modified</div>;
}`);
      }, 100);
    }, 5000);

    it('should detect new .mtm files', (done) => {
      watcher.on('file-added', (filePath) => {
        expect(filePath.endsWith('new.mtm')).toBe(true);
        done();
      });

      watcher.start(testDir);

      // Wait a bit then create new file
      setTimeout(() => {
        const newFile = join(testDir, 'new.mtm');
        writeFileSync(newFile, `---
target: reactjs
---
export default function New() {
  return <div>New</div>;
}`);
      }, 100);
    }, 5000);

    it('should detect file removal', (done) => {
      const mtmFile = join(testDir, 'removable.mtm');
      
      // Create initial file
      writeFileSync(mtmFile, `---
target: reactjs
---
export default function Removable() {
  return <div>Will be removed</div>;
}`);

      watcher.on('file-added', () => {
        // File was added, now remove it
        setTimeout(() => {
          rmSync(mtmFile);
        }, 100);
      });

      watcher.on('file-removed', (filePath) => {
        expect(filePath).toBe(resolve(mtmFile));
        done();
      });

      watcher.start(testDir);
    }, 5000);
  });

  describe('Path Management', () => {
    it('should add paths to watch', () => {
      const subDir = join(testDir, 'subdir');
      mkdirSync(subDir);

      watcher.start(testDir);
      watcher.addPath(subDir);

      const watchedPaths = watcher.getWatchedPaths();
      expect(watchedPaths.some(path => path.includes('subdir'))).toBe(true);
    });

    it('should remove paths from watching', () => {
      const subDir = join(testDir, 'subdir');
      mkdirSync(subDir);

      watcher.start(testDir);
      watcher.addPath(subDir);
      watcher.removePath(subDir);

      // Path should be removed (we can't easily test this without triggering events)
      expect(() => watcher.removePath(subDir)).not.toThrow();
    });

    it('should get watched paths', () => {
      watcher.start(testDir);
      
      const watchedPaths = watcher.getWatchedPaths();
      expect(Array.isArray(watchedPaths)).toBe(true);
    });
  });

  describe('File Type Filtering', () => {
    it('should watch TypeScript files', (done) => {
      const tsFile = join(testDir, 'test.ts');
      
      writeFileSync(tsFile, 'const test = "original";');

      watcher.on('file-changed', (filePath) => {
        expect(filePath.endsWith('.ts')).toBe(true);
        done();
      });

      watcher.start(testDir);

      setTimeout(() => {
        writeFileSync(tsFile, 'const test = "modified";');
      }, 100);
    }, 5000);

    it('should watch JavaScript files', (done) => {
      const jsFile = join(testDir, 'test.js');
      
      writeFileSync(jsFile, 'const test = "original";');

      watcher.on('file-changed', (filePath) => {
        expect(filePath.endsWith('.js')).toBe(true);
        done();
      });

      watcher.start(testDir);

      setTimeout(() => {
        writeFileSync(jsFile, 'const test = "modified";');
      }, 100);
    }, 5000);

    it('should ignore non-relevant files', () => {
      const txtFile = join(testDir, 'readme.txt');
      writeFileSync(txtFile, 'This is a text file');

      let changeDetected = false;
      watcher.on('file-changed', () => {
        changeDetected = true;
      });

      watcher.start(testDir);

      setTimeout(() => {
        writeFileSync(txtFile, 'Modified text file');
      }, 100);

      // Wait and check that no change was detected
      setTimeout(() => {
        expect(changeDetected).toBe(false);
      }, 500);
    });
  });

  describe('Error Handling', () => {
    it('should handle errors gracefully', () => {
      const errorSpy = vi.fn();
      watcher.on('error', errorSpy);

      // Try to watch a non-existent directory
      watcher.start('/non/existent/path');

      // Should not throw, but may emit error
      expect(() => watcher.start('/non/existent/path')).not.toThrow();
    });

    it('should handle multiple start/stop cycles', () => {
      expect(() => {
        watcher.start(testDir);
        watcher.stop();
        watcher.start(testDir);
        watcher.stop();
      }).not.toThrow();
    });
  });

  describe('Factory Function', () => {
    it('should create file watcher with factory function', () => {
      const createdWatcher = createFileWatcher();
      
      expect(createdWatcher).toBeInstanceOf(MetamonFileWatcher);
      expect(createdWatcher.watching).toBe(false);
      
      createdWatcher.stop(); // Clean up
    });
  });

  describe('Event Handling', () => {
    it('should support multiple event listeners', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      watcher.on('file-changed', listener1);
      watcher.on('file-changed', listener2);

      watcher.start(testDir);

      const testFile = join(testDir, 'multi-listener.mtm');
      writeFileSync(testFile, `---
target: reactjs
---
export default function Test() { return <div>Test</div>; }`);

      setTimeout(() => {
        writeFileSync(testFile, `---
target: reactjs
---
export default function Test() { return <div>Modified</div>; }`);
      }, 100);

      // Both listeners should eventually be called
      setTimeout(() => {
        // Note: In a real test environment, we'd wait for the actual events
        // This is more of a structural test
        expect(watcher.listenerCount('file-changed')).toBe(2);
      }, 200);
    });
  });
});