// Unit tests for Svelte Component Adapter
const { SvelteComponentAdapter } = require('../component-adapter.js');

describe('SvelteComponentAdapter', () => {
  let adapter;

  beforeEach(() => {
    adapter = new SvelteComponentAdapter();
  });

  describe('constructor', () => {
    test('should initialize with svelte framework', () => {
      expect(adapter.framework).toBe('svelte');
    });
  });

  describe('canHandle', () => {
    test('should handle .svelte files', () => {
      expect(adapter.canHandle('Component.svelte')).toBe(true);
      expect(adapter.canHandle('path/to/Component.svelte')).toBe(true);
    });

    test('should handle files with svelte in path', () => {
      expect(adapter.canHandle('svelte/Component.js')).toBe(true);
      expect(adapter.canHandle('components/svelte-component.ts')).toBe(true);
    });

    test('should not handle non-svelte files', () => {
      expect(adapter.canHandle('Component.vue')).toBe(false);
      expect(adapter.canHandle('Component.tsx')).toBe(false);
      expect(adapter.canHandle('Component.jsx')).toBe(false);
    });
  });

  describe('extractProps', () => {
    test('should extract export let props', () => {
      const source = `
        <script>
          export let name;
          export let age = 25;
          export let isActive = false;
        </script>
      `;

      const props = adapter.extractProps(source);

      expect(props).toHaveLength(3);
      expect(props[0]).toEqual({
        name: 'name',
        type: 'any',
        required: true,
        default: null
      });
      expect(props[1]).toEqual({
        name: 'age',
        type: 'any',
        required: false,
        default: '25'
      });
      expect(props[2]).toEqual({
        name: 'isActive',
        type: 'any',
        required: false,
        default: 'false'
      });
    });

    test('should extract TypeScript props', () => {
      const source = `
        <script lang="ts">
          export let name: string;
          export let age: number = 25;
          export let callback: (value: string) => void;
          export let optional?: boolean;
        </script>
      `;

      const props = adapter.extractProps(source);

      expect(props).toHaveLength(4);
      expect(props[0]).toEqual({
        name: 'name',
        type: 'string',
        required: true,
        default: null
      });
      expect(props[1]).toEqual({
        name: 'age',
        type: 'number',
        required: false,
        default: '25'
      });
      expect(props[2]).toEqual({
        name: 'callback',
        type: '(value: string) => void',
        required: true,
        default: null
      });
      expect(props[3]).toEqual({
        name: 'optional',
        type: 'boolean',
        required: false,
        default: null
      });
    });

    test('should extract props from TypeScript interface', () => {
      const source = `
        <script lang="ts">
          interface Props {
            title: string;
            count?: number;
            items: string[];
            onClick: (id: string) => void;
          }
          
          export let title: Props['title'];
          export let count: Props['count'] = 0;
        </script>
      `;

      const props = adapter.extractProps(source);

      expect(props).toContainEqual({
        name: 'title',
        type: "Props['title']",
        required: true,
        default: null
      });
      expect(props).toContainEqual({
        name: 'count',
        type: "Props['count']",
        required: false,
        default: '0'
      });
    });

    test('should handle complex prop types', () => {
      const source = `
        <script lang="ts">
          export let user: { name: string; age: number };
          export let items: Array<{ id: string; value: number }>;
          export let callback: (data: { success: boolean; message: string }) => Promise<void>;
        </script>
      `;

      const props = adapter.extractProps(source);

      expect(props[0]).toEqual({
        name: 'user',
        type: '{ name: string; age: number }',
        required: true,
        default: null
      });
      expect(props[1]).toEqual({
        name: 'items',
        type: 'Array<{ id: string; value: number }>',
        required: true,
        default: null
      });
      expect(props[2]).toEqual({
        name: 'callback',
        type: '(data: { success: boolean; message: string }) => Promise<void>',
        required: true,
        default: null
      });
    });
  });

  describe('parseExportLetStatements', () => {
    test('should parse simple export let statements', () => {
      const props = [];
      const scriptContent = `
        export let name;
        export let age = 30;
        let internal = 'not exported';
        export let active = true;
      `;

      adapter.parseExportLetStatements(scriptContent, props);

      expect(props).toHaveLength(3);
      expect(props[0]).toEqual({
        name: 'name',
        type: 'any',
        required: true,
        default: null
      });
      expect(props[1]).toEqual({
        name: 'age',
        type: 'any',
        required: false,
        default: '30'
      });
      expect(props[2]).toEqual({
        name: 'active',
        type: 'any',
        required: false,
        default: 'true'
      });
    });

    test('should parse typed export let statements', () => {
      const props = [];
      const scriptContent = `
        export let title: string;
        export let count: number = 0;
        export let callback: () => void;
      `;

      adapter.parseExportLetStatements(scriptContent, props);

      expect(props).toHaveLength(3);
      expect(props[0]).toEqual({
        name: 'title',
        type: 'string',
        required: true,
        default: null
      });
      expect(props[1]).toEqual({
        name: 'count',
        type: 'number',
        required: false,
        default: '0'
      });
      expect(props[2]).toEqual({
        name: 'callback',
        type: '() => void',
        required: true,
        default: null
      });
    });
  });

  describe('transform', () => {
    test('should transform component import with Svelte metadata', () => {
      const componentImport = {
        name: 'TestComponent',
        path: './TestComponent.svelte',
        framework: 'svelte'
      };

      const source = `
        <script>
          export let name;
          export let items = [];
          
          $: filteredItems = items.filter(item => item.active);
          
          import { writable } from 'svelte/store';
          const count = writable(0);
          
          import { createEventDispatcher } from 'svelte';
          const dispatch = createEventDispatcher();
        </script>
        
        <div transition:fade>
          <slot name="header"></slot>
          <button on:click={() => dispatch('click')}>Click me</button>
        </div>
      `;

      // Mock fs.readFileSync to return our test source
      const fs = require('fs');
      jest.spyOn(fs, 'readFileSync').mockReturnValue(source);
      jest.spyOn(fs, 'existsSync').mockReturnValue(true);

      const result = adapter.transform(componentImport);

      expect(result.framework).toBe('svelte');
      expect(result.isSvelteComponent).toBe(true);
      expect(result.hasReactiveStatements).toBe(true);
      expect(result.hasStores).toBe(true);
      expect(result.hasSlots).toBe(true);
      expect(result.hasEvents).toBe(true);
      expect(result.hasTransitions).toBe(true);
      expect(result.hasActions).toBe(false);

      // Restore mocks
      fs.readFileSync.mockRestore();
      fs.existsSync.mockRestore();
    });
  });

  describe('detectReactiveStatements', () => {
    test('should detect reactive statements', () => {
      const source = `
        $: doubled = count * 2;
        $: if (count > 10) console.log('High count');
        $: {
          console.log('Count changed:', count);
        }
      `;

      expect(adapter.detectReactiveStatements(source)).toBe(true);
    });

    test('should not detect reactive statements when none exist', () => {
      const source = `
        let count = 0;
        function increment() {
          count += 1;
        }
      `;

      expect(adapter.detectReactiveStatements(source)).toBe(false);
    });
  });

  describe('detectStores', () => {
    test('should detect Svelte stores', () => {
      const source = `
        import { writable, readable, derived } from 'svelte/store';
        const count = writable(0);
        $: doubled = $count * 2;
        count.subscribe(value => console.log(value));
      `;

      expect(adapter.detectStores(source)).toBe(true);
    });

    test('should not detect stores when none exist', () => {
      const source = `
        let count = 0;
        function increment() {
          count += 1;
        }
      `;

      expect(adapter.detectStores(source)).toBe(false);
    });
  });

  describe('detectSlots', () => {
    test('should detect slots', () => {
      const source = `
        <div>
          <slot></slot>
          <slot name="header"></slot>
        </div>
      `;

      expect(adapter.detectSlots(source)).toBe(true);
    });

    test('should not detect slots when none exist', () => {
      const source = `
        <div>
          <p>No slots here</p>
        </div>
      `;

      expect(adapter.detectSlots(source)).toBe(false);
    });
  });

  describe('detectEvents', () => {
    test('should detect event dispatchers and handlers', () => {
      const source = `
        import { createEventDispatcher } from 'svelte';
        const dispatch = createEventDispatcher();
        
        <button on:click={() => dispatch('click')}>Click</button>
      `;

      expect(adapter.detectEvents(source)).toBe(true);
    });

    test('should not detect events when none exist', () => {
      const source = `
        <button>Static button</button>
      `;

      expect(adapter.detectEvents(source)).toBe(false);
    });
  });

  describe('detectTransitions', () => {
    test('should detect transitions and animations', () => {
      const source = `
        import { fade, slide } from 'svelte/transition';
        
        <div transition:fade>
          <p in:slide out:fade>Animated content</p>
        </div>
      `;

      expect(adapter.detectTransitions(source)).toBe(true);
    });

    test('should not detect transitions when none exist', () => {
      const source = `
        <div>
          <p>Static content</p>
        </div>
      `;

      expect(adapter.detectTransitions(source)).toBe(false);
    });
  });

  describe('detectActions', () => {
    test('should detect actions', () => {
      const source = `
        function myAction(node) {
          return {
            destroy() {}
          };
        }
        
        <div use:myAction>Content</div>
      `;

      expect(adapter.detectActions(source)).toBe(true);
    });

    test('should not detect actions when none exist', () => {
      const source = `
        <div>No actions here</div>
      `;

      expect(adapter.detectActions(source)).toBe(false);
    });
  });

  describe('generateWrapper', () => {
    test('should generate complete wrapper code', () => {
      const componentDefinition = {
        name: 'TestComponent',
        framework: 'svelte',
        props: [
          { name: 'title', type: 'string', required: true, default: null },
          { name: 'count', type: 'number', required: false, default: '0' }
        ],
        hasReactiveStatements: true,
        hasStores: true,
        hasSlots: false,
        hasEvents: true,
        hasTransitions: false,
        hasActions: false
      };

      const wrapper = adapter.generateWrapper(componentDefinition);

      expect(wrapper).toContain('interface TestComponentProps');
      expect(wrapper).toContain('title: string;');
      expect(wrapper).toContain('count?: number; // default: 0');
      expect(wrapper).toContain('function TestComponentWrapper');
      expect(wrapper).toContain('// Component uses reactive statements');
      expect(wrapper).toContain('// Component uses Svelte stores');
      expect(wrapper).toContain('// Component dispatches events');
      expect(wrapper).toContain('TestComponentUtils');
      expect(wrapper).toContain('mount: function');
      expect(wrapper).toContain('createComponent: function');
      expect(wrapper).toContain('createWritable: function');
      expect(wrapper).toContain('createEventDispatcher: function');
    });

    test('should generate wrapper for component without props', () => {
      const componentDefinition = {
        name: 'SimpleComponent',
        framework: 'svelte',
        props: [],
        hasReactiveStatements: false,
        hasStores: false,
        hasSlots: false,
        hasEvents: false,
        hasTransitions: false,
        hasActions: false
      };

      const wrapper = adapter.generateWrapper(componentDefinition);

      expect(wrapper).toContain('interface SimpleComponentProps {}');
      expect(wrapper).toContain('function SimpleComponentWrapper');
      expect(wrapper).toContain('SimpleComponentUtils');
    });
  });

  describe('generatePropsInterface', () => {
    test('should generate TypeScript interface for props', () => {
      const props = [
        { name: 'title', type: 'string', required: true, default: null },
        { name: 'count', type: 'number', required: false, default: '0' },
        { name: 'callback', type: '() => void', required: true, default: null }
      ];

      const interfaceCode = adapter.generatePropsInterface('TestComponent', props);

      expect(interfaceCode).toContain('interface TestComponentProps {');
      expect(interfaceCode).toContain('title: string;');
      expect(interfaceCode).toContain('count?: number; // default: 0');
      expect(interfaceCode).toContain('callback: () => void;');
      expect(interfaceCode).toContain('}');
    });

    test('should generate empty interface for no props', () => {
      const interfaceCode = adapter.generatePropsInterface('TestComponent', []);
      expect(interfaceCode).toBe('interface TestComponentProps {}');
    });
  });

  describe('generateMountingUtils', () => {
    test('should generate mounting utilities', () => {
      const utils = adapter.generateMountingUtils('TestComponent');

      expect(utils).toContain('const TestComponentUtils = {');
      expect(utils).toContain('mount: function(container: HTMLElement, props: TestComponentProps = {}, options: any = {})');
      expect(utils).toContain('new TestComponent({');
      expect(utils).toContain('target: container,');
      expect(utils).toContain('props: props,');
      expect(utils).toContain('unmount: () => {');
      expect(utils).toContain('instance.$destroy()');
      expect(utils).toContain('update: (newProps: TestComponentProps) => {');
      expect(utils).toContain('instance.$set(newProps)');
      expect(utils).toContain('on: (eventName: string, handler: Function) => {');
      expect(utils).toContain('instance.$on(eventName, handler)');
      expect(utils).toContain('createWritable: function');
      expect(utils).toContain('createReadable: function');
      expect(utils).toContain('createDerived: function');
      expect(utils).toContain('createEventDispatcher: function');
      expect(utils).toContain('window.TestComponentUtils = TestComponentUtils;');
    });
  });
});