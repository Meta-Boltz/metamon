import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import { VueAdapter } from './vue-adapter.js';
import { signalManager, pubSubSystem } from '@metamon/core';
import type { MTMFile, Channel } from '@metamon/core';

// Mock the core modules
vi.mock('@metamon/core', () => ({
  signalManager: {
    createSignal: vi.fn(),
    getSignal: vi.fn(),
    destroySignal: vi.fn()
  },
  pubSubSystem: {
    subscribe: vi.fn(),
    emit: vi.fn(),
    cleanup: vi.fn(),
    unsubscribe: vi.fn()
  }
}));

describe('Vue Adapter Integration Tests', () => {
  let adapter: VueAdapter;

  beforeEach(() => {
    adapter = new VueAdapter();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Cross-framework communication', () => {
    it('should enable Vue component to emit events to other frameworks', async () => {
      const channels: Channel[] = [
        { event: 'userAction', emit: 'onUserAction' }
      ];

      const mtmFile: MTMFile = {
        frontmatter: {
          target: 'vue',
          channels
        },
        content: `import { defineComponent, ref } from 'vue';

export default defineComponent({
  name: 'VueComponent',
  setup() {
    const count = ref(0);
    
    const handleClick = () => {
      count.value++;
      onUserAction({ count: count.value });
    };
    
    return {
      count,
      handleClick
    };
  },
  template: '<button @click="handleClick">Count: {{ count }}</button>'
});`,
        filePath: 'test-component.mtm'
      };

      const compilationResult = adapter.compile(mtmFile);
      
      expect(compilationResult.code).toContain('const onUserAction = (payload) => {');
      expect(compilationResult.code).toContain('pubSubSystem.emit(\'userAction\', payload);');
      expect(compilationResult.code).toContain('pubSubSystem.subscribe(\'userAction\'');
    });

    it('should enable Vue component to receive events from other frameworks', async () => {
      const channels: Channel[] = [
        { event: 'externalEvent', emit: 'onExternalEvent' }
      ];

      const mtmFile: MTMFile = {
        frontmatter: {
          target: 'vue',
          channels
        },
        content: `import { defineComponent, ref } from 'vue';

export default defineComponent({
  name: 'VueReceiver',
  setup() {
    const receivedData = ref(null);
    
    return {
      receivedData
    };
  },
  template: '<div>{{ receivedData }}</div>'
});`,
        filePath: 'receiver.mtm'
      };

      const compilationResult = adapter.compile(mtmFile);
      
      expect(compilationResult.code).toContain('pubSubSystem.subscribe(\'externalEvent\'');
      expect(compilationResult.code).toContain('const onExternalEvent = (payload) => {');
      expect(compilationResult.code).toContain('pubSubSystem.emit(\'externalEvent\', payload);');
    });
  });

  describe('Signal integration', () => {
    it('should integrate Vue reactivity with Metamon signals', async () => {
      const mockSignal = {
        value: 'initial',
        subscribe: vi.fn().mockReturnValue(() => {}),
        update: vi.fn()
      };

      vi.mocked(signalManager.createSignal).mockReturnValue(mockSignal);

      const mtmFile: MTMFile = {
        frontmatter: {
          target: 'vue'
        },
        content: `import { defineComponent } from 'vue';

export default defineComponent({
  name: 'SignalComponent',
  setup() {
    const [sharedState, updateSharedState] = useSignal('initial', 'globalState');
    
    const handleUpdate = () => {
      updateSharedState('updated');
    };
    
    return {
      sharedState,
      handleUpdate
    };
  },
  template: '<div @click="handleUpdate">{{ sharedState }}</div>'
});`,
        filePath: 'signal-component.mtm'
      };

      const compilationResult = adapter.compile(mtmFile);
      
      expect(compilationResult.code).toContain('useSignal');
      expect(compilationResult.code).toContain('signalManager');
    });

    it('should handle signal updates across component instances', async () => {
      const mtmFile: MTMFile = {
        frontmatter: {
          target: 'vue'
        },
        content: `import { defineComponent } from 'vue';

export default defineComponent({
  name: 'CounterComponent',
  setup() {
    const [count, setCount] = useMetamonSignal('counter', 0);
    
    const increment = () => {
      setCount(count.value + 1);
    };
    
    return {
      count,
      increment
    };
  },
  template: '<button @click="increment">{{ count }}</button>'
});`,
        filePath: 'counter.mtm'
      };

      const compilationResult = adapter.compile(mtmFile);
      
      expect(compilationResult.code).toContain('useMetamonSignal');
      expect(compilationResult.code).toContain('signalManager');
      expect(compilationResult.code).toContain('getSignal');
    });
  });

  describe('Component lifecycle integration', () => {
    it('should properly cleanup subscriptions on component unmount', async () => {
      const channels: Channel[] = [
        { event: 'testEvent', emit: 'onTestEvent' }
      ];

      const mtmFile: MTMFile = {
        frontmatter: {
          target: 'vue',
          channels
        },
        content: `import { defineComponent } from 'vue';

export default defineComponent({
  name: 'LifecycleComponent',
  setup() {
    useMetamonLifecycle('LifecycleComponent');
    
    return {};
  },
  template: '<div>Lifecycle Test</div>'
});`,
        filePath: 'lifecycle.mtm'
      };

      const compilationResult = adapter.compile(mtmFile);
      
      expect(compilationResult.code).toContain('onMounted');
      expect(compilationResult.code).toContain('onUnmounted');
      expect(compilationResult.code).toContain('pubSubSystem.cleanup');
    });

    it('should handle multiple event subscriptions per component', async () => {
      const channels: Channel[] = [
        { event: 'event1', emit: 'onEvent1' },
        { event: 'event2', emit: 'onEvent2' },
        { event: 'event3', emit: 'onEvent3' }
      ];

      const mtmFile: MTMFile = {
        frontmatter: {
          target: 'vue',
          channels
        },
        content: `import { defineComponent } from 'vue';

export default defineComponent({
  name: 'MultiEventComponent',
  setup() {
    return {};
  },
  template: '<div>Multi Event Component</div>'
});`,
        filePath: 'multi-event.mtm'
      };

      const compilationResult = adapter.compile(mtmFile);
      
      expect(compilationResult.code).toContain('const onEvent1 = (payload) => {');
      expect(compilationResult.code).toContain('const onEvent2 = (payload) => {');
      expect(compilationResult.code).toContain('const onEvent3 = (payload) => {');
      expect(compilationResult.code).toContain('pubSubSystem.subscribe(\'event1\'');
      expect(compilationResult.code).toContain('pubSubSystem.subscribe(\'event2\'');
      expect(compilationResult.code).toContain('pubSubSystem.subscribe(\'event3\'');
    });
  });

  describe('Template compilation', () => {
    it('should preserve Vue template syntax in compiled output', async () => {
      const mtmFile: MTMFile = {
        frontmatter: {
          target: 'vue'
        },
        content: `import { defineComponent, ref } from 'vue';

export default defineComponent({
  name: 'TemplateComponent',
  setup() {
    const items = ref(['item1', 'item2', 'item3']);
    const isVisible = ref(true);
    
    return {
      items,
      isVisible
    };
  },
  template: \`
    <div v-if="isVisible">
      <ul>
        <li v-for="item in items" :key="item">{{ item }}</li>
      </ul>
    </div>
  \`
});`,
        filePath: 'template.mtm'
      };

      const compilationResult = adapter.compile(mtmFile);
      
      expect(compilationResult.code).toContain('v-if="isVisible"');
      expect(compilationResult.code).toContain('v-for="item in items"');
      expect(compilationResult.code).toContain(':key="item"');
      expect(compilationResult.code).toContain('{{ item }}');
    });

    it('should handle Single File Component structure', async () => {
      const mtmFile: MTMFile = {
        frontmatter: {
          target: 'vue'
        },
        content: `<template>
  <div class="component">
    <h1>{{ title }}</h1>
    <button @click="handleClick">{{ buttonText }}</button>
  </div>
</template>

<script>
import { defineComponent, ref } from 'vue';

export default defineComponent({
  name: 'SFCComponent',
  setup() {
    const title = ref('Vue SFC');
    const buttonText = ref('Click me');
    
    const handleClick = () => {
      console.log('Button clicked');
    };
    
    return {
      title,
      buttonText,
      handleClick
    };
  }
});
</script>

<style scoped>
.component {
  padding: 20px;
}
</style>`,
        filePath: 'sfc.mtm'
      };

      const compilationResult = adapter.compile(mtmFile);
      
      expect(compilationResult.code).toContain('<template>');
      expect(compilationResult.code).toContain('<script>');
      expect(compilationResult.code).toContain('<style scoped>');
      expect(compilationResult.code).toContain('defineComponent');
    });
  });

  describe('Error handling', () => {
    it('should provide helpful error messages for Vue-specific issues', async () => {
      const mtmFile: MTMFile = {
        frontmatter: {
          target: 'vue'
        },
        content: `import { defineComponent } from 'vue';

export default defineComponent({
  name: 'ErrorComponent',
  setup() {
    // Missing return statement
  },
  template: '<div>Error Test</div>'
});`,
        filePath: 'error.mtm'
      };

      const compilationResult = adapter.compile(mtmFile);
      
      // Should compile without throwing, but preserve the original code
      expect(compilationResult.code).toContain('// Missing return statement');
      expect(compilationResult.code).toContain('defineComponent');
    });

    it('should handle malformed frontmatter gracefully', async () => {
      const mtmFile: MTMFile = {
        frontmatter: {
          target: 'vue',
          channels: [
            { event: 'test', emit: '' } // Invalid emit function name
          ]
        },
        content: `export default defineComponent({ name: 'Test' });`,
        filePath: 'malformed.mtm'
      };

      const compilationResult = adapter.compile(mtmFile);
      
      // Should handle empty emit function name
      expect(compilationResult.code).toContain('const  = (payload) => {');
      expect(compilationResult.code).toContain('pubSubSystem.emit(\'test\', payload);');
    });
  });
});