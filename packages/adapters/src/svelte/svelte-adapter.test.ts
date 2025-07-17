import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SvelteAdapter } from './svelte-adapter.js';
import type { MTMFile, Channel } from '@metamon/core';

describe('SvelteAdapter', () => {
  let adapter: SvelteAdapter;

  beforeEach(() => {
    adapter = new SvelteAdapter();
  });

  describe('basic properties', () => {
    it('should have correct name and file extension', () => {
      expect(adapter.name).toBe('svelte');
      expect(adapter.fileExtension).toBe('.svelte');
    });
  });

  describe('compile method', () => {
    it('should compile basic Svelte component', () => {
      const mtmFile: MTMFile = {
        frontmatter: {
          target: 'svelte'
        },
        content: `import { onMount } from 'svelte';

<script>
  let count = 0;
  
  function increment() {
    count += 1;
  }
</script>

<button on:click={increment}>
  Count: {count}
</button>`,
        filePath: '/test/component.mtm'
      };

      const result = adapter.compile(mtmFile);

      expect(result.code).toContain('import { onMount, onDestroy } from \'svelte\';');
      expect(result.code).toContain('import { writable, derived } from \'svelte/store\';');
      expect(result.code).toContain('import { signalManager, pubSubSystem } from \'@metamon/core\';');
      expect(result.code).toContain('let count = 0;');
      expect(result.code).toContain('function increment()');
      expect(result.dependencies).toEqual(['svelte']);
      expect(result.exports).toEqual(['default']);
    });

    it('should compile Svelte component with channels', () => {
      const channels: Channel[] = [
        { event: 'userLogin', emit: 'onUserLogin' },
        { event: 'dataUpdate', emit: 'onDataUpdate' }
      ];

      const mtmFile: MTMFile = {
        frontmatter: {
          target: 'svelte',
          channels
        },
        content: `<script>
  let user = null;
</script>

<div>User: {user?.name || 'Not logged in'}</div>`,
        filePath: '/test/user-component.mtm'
      };

      const result = adapter.compile(mtmFile);

      expect(result.code).toContain('const onUserLogin = (payload) => {');
      expect(result.code).toContain('pubSubSystem.emit(\'userLogin\', payload);');
      expect(result.code).toContain('const onDataUpdate = (payload) => {');
      expect(result.code).toContain('pubSubSystem.emit(\'dataUpdate\', payload);');
      expect(result.code).toContain('pubSubSystem.subscribe(\'userLogin\'');
      expect(result.code).toContain('pubSubSystem.subscribe(\'dataUpdate\'');
    });

    it('should handle imports correctly', () => {
      const mtmFile: MTMFile = {
        frontmatter: {
          target: 'svelte'
        },
        content: `import { fade } from 'svelte/transition';
import Button from './Button.svelte';

<script>
  let visible = true;
</script>

{#if visible}
  <div transition:fade>
    <Button>Click me</Button>
  </div>
{/if}`,
        filePath: '/test/component.mtm'
      };

      const result = adapter.compile(mtmFile);

      expect(result.code).toContain('import { fade } from \'svelte/transition\';');
      expect(result.code).toContain('import Button from \'./Button.svelte\';');
      expect(result.dependencies).toContain('svelte/transition');
      expect(result.dependencies).toContain('./Button.svelte');
    });

    it('should throw error for wrong target framework', () => {
      const mtmFile: MTMFile = {
        frontmatter: {
          target: 'react'
        },
        content: 'export default function Component() { return <div>Hello</div>; }',
        filePath: '/test/component.mtm'
      };

      expect(() => adapter.compile(mtmFile)).toThrow('Invalid target framework: react. Expected \'svelte\'');
    });

    it('should handle compilation errors gracefully', () => {
      const mtmFile: MTMFile = {
        frontmatter: {
          target: 'svelte'
        },
        content: 'invalid content that will cause parsing to fail',
        filePath: '/test/component.mtm'
      };

      // Mock a parsing error
      const originalParseContent = adapter['parseContent'];
      adapter['parseContent'] = vi.fn().mockImplementation(() => {
        throw new Error('Parsing failed');
      });

      expect(() => adapter.compile(mtmFile)).toThrow();
      
      // Restore original method
      adapter['parseContent'] = originalParseContent;
    });
  });

  describe('generateImports method', () => {
    it('should generate basic Svelte imports', () => {
      const dependencies = ['svelte/store', './utils'];
      const result = adapter.generateImports(dependencies);

      expect(result).toContain('import { onMount, onDestroy } from \'svelte\';');
      expect(result).toContain('import svelte/store from \'svelte/store\';');
      expect(result).toContain('import Utils from \'./utils\';');
    });

    it('should handle empty dependencies', () => {
      const result = adapter.generateImports([]);
      expect(result).toContain('import { onMount, onDestroy } from \'svelte\';');
    });
  });

  describe('wrapWithRuntime method', () => {
    it('should wrap component with signal integration', () => {
      const component = '<div>Test component</div>';
      const channels: Channel[] = [];

      const result = adapter.wrapWithRuntime(component, channels);

      expect(result).toContain('useSignal');
      expect(result).toContain('useMetamonSignal');
      expect(result).toContain('createMetamonStore');
      expect(result).toContain('<div>Test component</div>');
    });

    it('should wrap component with pub/sub integration', () => {
      const component = '<div>Test component</div>';
      const channels: Channel[] = [
        { event: 'test', emit: 'onTest' }
      ];

      const result = adapter.wrapWithRuntime(component, channels);

      expect(result).toContain('const onTest = (payload) => {');
      expect(result).toContain('pubSubSystem.emit(\'test\', payload);');
      expect(result).toContain('pubSubSystem.subscribe(\'test\'');
    });
  });

  describe('injectRuntime method', () => {
    it('should inject runtime imports', () => {
      const component = '<div>Test</div>';
      const result = adapter.injectRuntime(component);

      expect(result).toContain('import { onMount, onDestroy } from \'svelte\';');
      expect(result).toContain('import { pubSubSystem } from \'@metamon/core\';');
      expect(result).toContain('<div>Test</div>');
    });
  });

  describe('setupSignalIntegration method', () => {
    it('should setup signal integration functions', () => {
      const result = adapter.setupSignalIntegration();

      expect(result).toContain('export function useSignal(initialValue, key)');
      expect(result).toContain('export function useMetamonSignal(key, initialValue)');
      expect(result).toContain('export function createMetamonStore(initialValue, key)');
      expect(result).toContain('import { writable, derived } from \'svelte/store\';');
      expect(result).toContain('import { signalManager } from \'@metamon/core\';');
    });
  });

  describe('setupPubSubIntegration method', () => {
    it('should return empty string for no channels', () => {
      const result = adapter.setupPubSubIntegration([]);
      expect(result).toBe('');
    });

    it('should setup pub/sub integration for channels', () => {
      const channels: Channel[] = [
        { event: 'userLogin', emit: 'onUserLogin' },
        { event: 'dataUpdate', emit: 'onDataUpdate' }
      ];

      const result = adapter.setupPubSubIntegration(channels);

      expect(result).toContain('const onUserLogin = (payload) => {');
      expect(result).toContain('pubSubSystem.emit(\'userLogin\', payload);');
      expect(result).toContain('const onDataUpdate = (payload) => {');
      expect(result).toContain('pubSubSystem.emit(\'dataUpdate\', payload);');
      expect(result).toContain('pubSubSystem.subscribe(\'userLogin\'');
      expect(result).toContain('pubSubSystem.subscribe(\'dataUpdate\'');
      expect(result).toContain('onMount(() => {');
      expect(result).toContain('onDestroy(() => {');
    });
  });

  describe('private methods', () => {
    it('should parse content correctly', () => {
      const content = `import { fade } from 'svelte/transition';
import Button from './Button.svelte';

<script>
  let count = 0;
</script>

<button>Count: {count}</button>`;

      const result = adapter['parseContent'](content);

      expect(result.imports).toEqual([
        'import { fade } from \'svelte/transition\';',
        'import Button from \'./Button.svelte\';'
      ]);
      expect(result.componentCode).toContain('<script>');
      expect(result.componentCode).toContain('let count = 0;');
      expect(result.componentCode).toContain('<button>Count: {count}</button>');
    });

    it('should extract dependencies from imports', () => {
      const imports = [
        'import { fade } from \'svelte/transition\';',
        'import Button from \'./Button.svelte\';',
        'import utils from \'../utils\';'
      ];

      const result = adapter['extractDependencies'](imports);

      expect(result).toEqual([
        'svelte/transition',
        './Button.svelte',
        '../utils'
      ]);
    });

    it('should get import name from file path', () => {
      expect(adapter['getImportName']('./button.svelte')).toBe('Button');
      expect(adapter['getImportName']('../components/modal.svelte')).toBe('Modal');
      expect(adapter['getImportName']('./utils')).toBe('Utils');
    });

    it('should generate Svelte-specific imports', () => {
      const userImports = ['import Button from \'./Button.svelte\';'];
      const channels: Channel[] = [{ event: 'test', emit: 'onTest' }];

      const result = adapter['generateSvelteImports'](userImports, channels);

      expect(result).toContain('import { onMount, onDestroy } from \'svelte\';');
      expect(result).toContain('import { writable, derived } from \'svelte/store\';');
      expect(result).toContain('import { signalManager, pubSubSystem } from \'@metamon/core\';');
      expect(result).toContain('import Button from \'./Button.svelte\';');
    });
  });
});