import { describe, it, expect, beforeEach } from 'vitest';
import { VueAdapter } from './vue-adapter.js';
import type { MTMFile, Channel } from '@metamon/core';

describe('VueAdapter', () => {
  let adapter: VueAdapter;

  beforeEach(() => {
    adapter = new VueAdapter();
  });

  describe('basic properties', () => {
    it('should have correct name and file extension', () => {
      expect(adapter.name).toBe('vue');
      expect(adapter.fileExtension).toBe('.vue');
    });
  });

  describe('compile method', () => {
    it('should compile a basic Vue component', () => {
      const mtmFile: MTMFile = {
        frontmatter: {
          target: 'vue'
        },
        content: `import { defineComponent } from 'vue';

export default defineComponent({
  name: 'TestComponent',
  setup() {
    return {
      message: 'Hello Vue!'
    };
  },
  template: '<div>{{ message }}</div>'
});`,
        filePath: 'test.mtm'
      };

      const result = adapter.compile(mtmFile);

      expect(result.code).toContain('import { defineComponent } from \'vue\';');
      expect(result.code).toContain('import { ref, onMounted, onUnmounted, computed } from \'vue\';');
      expect(result.code).toContain('import { signalManager, pubSubSystem } from \'@metamon/core\';');
      expect(result.code).toContain('export default defineComponent');
      expect(result.dependencies).toContain('vue');
      expect(result.exports).toEqual(['default']);
    });

    it('should compile Vue component with channels', () => {
      const channels: Channel[] = [
        { event: 'userLogin', emit: 'onUserLogin' },
        { event: 'dataUpdate', emit: 'onDataUpdate' }
      ];

      const mtmFile: MTMFile = {
        frontmatter: {
          target: 'vue',
          channels
        },
        content: `import { defineComponent } from 'vue';

export default defineComponent({
  name: 'TestComponent',
  setup() {
    return {
      message: 'Hello Vue with events!'
    };
  },
  template: '<div>{{ message }}</div>'
});`,
        filePath: 'test.mtm'
      };

      const result = adapter.compile(mtmFile);

      expect(result.code).toContain('const onUserLogin = (payload) => {');
      expect(result.code).toContain('pubSubSystem.emit(\'userLogin\', payload);');
      expect(result.code).toContain('const onDataUpdate = (payload) => {');
      expect(result.code).toContain('pubSubSystem.emit(\'dataUpdate\', payload);');
      expect(result.code).toContain('pubSubSystem.subscribe(\'userLogin\'');
      expect(result.code).toContain('pubSubSystem.subscribe(\'dataUpdate\'');
    });

    it('should throw error for invalid target framework', () => {
      const mtmFile: MTMFile = {
        frontmatter: {
          target: 'react'
        },
        content: 'export default function() { return <div>Test</div>; }',
        filePath: 'test.mtm'
      };

      expect(() => adapter.compile(mtmFile)).toThrow('Invalid target framework: react. Expected \'vue\'');
    });

    it('should handle compilation errors gracefully', () => {
      const mtmFile: MTMFile = {
        frontmatter: {
          target: 'vue'
        },
        content: 'invalid javascript code {{{',
        filePath: 'test.mtm'
      };

      // This should not throw but should handle the error gracefully
      const result = adapter.compile(mtmFile);
      expect(result).toBeDefined();
      expect(result.code).toContain('invalid javascript code');
    });
  });

  describe('generateImports method', () => {
    it('should generate basic Vue imports', () => {
      const dependencies = ['vue', './components/Button'];
      const imports = adapter.generateImports(dependencies);

      expect(imports).toContain('import { defineComponent } from \'vue\';');
      expect(imports).toContain('import Button from \'./components/Button\';');
    });

    it('should handle external dependencies', () => {
      const dependencies = ['lodash', 'axios'];
      const imports = adapter.generateImports(dependencies);

      expect(imports).toContain('import lodash from \'lodash\';');
      expect(imports).toContain('import axios from \'axios\';');
    });
  });

  describe('wrapWithRuntime method', () => {
    it('should wrap component with signal integration', () => {
      const component = 'export default defineComponent({ name: "Test" });';
      const result = adapter.wrapWithRuntime(component, []);

      expect(result).toContain('useSignal');
      expect(result).toContain('useMetamonSignal');
      expect(result).toContain(component);
    });

    it('should wrap component with pub/sub integration when channels provided', () => {
      const component = 'export default defineComponent({ name: "Test" });';
      const channels: Channel[] = [{ event: 'test', emit: 'onTest' }];
      const result = adapter.wrapWithRuntime(component, channels);

      expect(result).toContain('const onTest = (payload) => {');
      expect(result).toContain('pubSubSystem.emit(\'test\', payload);');
      expect(result).toContain('pubSubSystem.subscribe(\'test\'');
      expect(result).toContain(component);
    });
  });

  describe('injectRuntime method', () => {
    it('should inject Vue lifecycle hooks and pubsub imports', () => {
      const component = 'export default defineComponent({ name: "Test" });';
      const result = adapter.injectRuntime(component);

      expect(result).toContain('import { onMounted, onUnmounted } from \'vue\';');
      expect(result).toContain('import { pubSubSystem } from \'@metamon/core\';');
      expect(result).toContain(component);
    });
  });

  describe('setupSignalIntegration method', () => {
    it('should setup Vue signal composables', () => {
      const result = adapter.setupSignalIntegration();

      expect(result).toContain('export function useSignal(initialValue, key)');
      expect(result).toContain('export function useMetamonSignal(key, initialValue)');
      expect(result).toContain('import { ref, onMounted, onUnmounted, computed } from \'vue\';');
      expect(result).toContain('import { signalManager } from \'@metamon/core\';');
    });
  });

  describe('setupPubSubIntegration method', () => {
    it('should return empty string when no channels provided', () => {
      const result = adapter.setupPubSubIntegration([]);
      expect(result).toBe('');
    });

    it('should setup pub/sub integration for provided channels', () => {
      const channels: Channel[] = [
        { event: 'userAction', emit: 'onUserAction' },
        { event: 'dataChange', emit: 'onDataChange' }
      ];

      const result = adapter.setupPubSubIntegration(channels);

      expect(result).toContain('const onUserAction = (payload) => {');
      expect(result).toContain('pubSubSystem.emit(\'userAction\', payload);');
      expect(result).toContain('const onDataChange = (payload) => {');
      expect(result).toContain('pubSubSystem.emit(\'dataChange\', payload);');
      expect(result).toContain('pubSubSystem.subscribe(\'userAction\'');
      expect(result).toContain('pubSubSystem.subscribe(\'dataChange\'');
    });
  });

  describe('content parsing', () => {
    it('should correctly separate imports from component code', () => {
      const mtmFile: MTMFile = {
        frontmatter: {
          target: 'vue'
        },
        content: `import { defineComponent } from 'vue';
import { ref } from 'vue';

export default defineComponent({
  name: 'TestComponent',
  setup() {
    const count = ref(0);
    return { count };
  }
});`,
        filePath: 'test.mtm'
      };

      const result = adapter.compile(mtmFile);

      // Should contain both original imports and generated ones
      expect(result.code).toContain('import { defineComponent } from \'vue\';');
      expect(result.code).toContain('import { ref, onMounted, onUnmounted, computed } from \'vue\';');
      expect(result.code).toContain('export default defineComponent');
    });
  });

  describe('dependency extraction', () => {
    it('should extract dependencies from import statements', () => {
      const mtmFile: MTMFile = {
        frontmatter: {
          target: 'vue'
        },
        content: `import { defineComponent } from 'vue';
import Button from './components/Button';
import { api } from '../services/api';

export default defineComponent({
  name: 'TestComponent'
});`,
        filePath: 'test.mtm'
      };

      const result = adapter.compile(mtmFile);

      expect(result.dependencies).toContain('./components/Button');
      expect(result.dependencies).toContain('../services/api');
    });
  });
});