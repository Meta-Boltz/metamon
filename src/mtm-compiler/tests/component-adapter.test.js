// Component Adapter System Tests
const {
  ComponentAdapter,
  BaseComponentAdapter,
  ReactComponentAdapter,
  VueComponentAdapter,
  SolidComponentAdapter,
  SvelteComponentAdapter
} = require('../component-adapter.js');

describe('ComponentAdapter', () => {
  describe('Base ComponentAdapter', () => {
    test('should throw error for unimplemented methods', () => {
      const adapter = new ComponentAdapter('test');

      expect(() => adapter.canHandle('test.js')).toThrow('canHandle method must be implemented by subclasses');
      expect(() => adapter.transform({})).toThrow('transform method must be implemented by subclasses');
      expect(() => adapter.generateWrapper({})).toThrow('generateWrapper method must be implemented by subclasses');
    });

    test('should have correct framework property', () => {
      const adapter = new ComponentAdapter('react');
      expect(adapter.framework).toBe('react');
    });
  });

  describe('BaseComponentAdapter', () => {
    let adapter;

    beforeEach(() => {
      adapter = new BaseComponentAdapter('test');
    });

    test('should extract props from source code', () => {
      const source = `
        interface TestProps {
          name: string;
          age?: number;
          active: boolean;
        }
      `;

      const props = adapter.extractProps(source);
      expect(props).toHaveLength(3);
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
        default: null
      });
    });

    test('should extract dependencies from source code', () => {
      const source = `
        import React from 'react';
        import { useState } from 'react';
        import Button from './Button';
      `;

      const dependencies = adapter.extractDependencies(source);
      expect(dependencies).toEqual(['react', 'react', './Button']);
    });

    test('should resolve @components/ paths', () => {
      const resolved = adapter.resolvePath('@components/Button.tsx');
      expect(resolved).toMatch(/src[\/\\]components[\/\\]Button\.tsx$/);
    });

    test('should resolve relative paths', () => {
      const resolved = adapter.resolvePath('./Button.tsx', '/test/path');
      expect(resolved).toMatch(/Button\.tsx$/);
    });

    test('should transform component import', () => {
      const componentImport = {
        name: 'TestComponent',
        path: '@components/Test.tsx',
        framework: 'test'
      };

      const definition = adapter.transform(componentImport);
      expect(definition.name).toBe('TestComponent');
      expect(definition.framework).toBe('test');
      expect(definition.originalPath).toBe('@components/Test.tsx');
    });

    test('should generate basic wrapper code', () => {
      const componentDefinition = {
        name: 'TestComponent',
        framework: 'test'
      };

      const wrapper = adapter.generateWrapper(componentDefinition);
      expect(wrapper).toContain('TestComponent');
      expect(wrapper).toContain('Wrapper');
    });
  });

  describe('ReactComponentAdapter', () => {
    let adapter;

    beforeEach(() => {
      adapter = new ReactComponentAdapter();
    });

    test('should have correct framework', () => {
      expect(adapter.framework).toBe('react');
    });

    test('should handle React file extensions', () => {
      expect(adapter.canHandle('Component.tsx')).toBe(true);
      expect(adapter.canHandle('Component.jsx')).toBe(true);
      expect(adapter.canHandle('react-component.js')).toBe(true);
      expect(adapter.canHandle('Component.vue')).toBe(false);
      expect(adapter.canHandle('Component.svelte')).toBe(false);
    });

    test('should extract TypeScript interface props', () => {
      const source = `
        interface TestComponentProps {
          title: string;
          count?: number;
          isActive: boolean;
          onClick: (id: string) => void;
        }
      `;

      const props = adapter.extractProps(source);
      expect(props).toHaveLength(4);
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
        default: null
      });
      expect(props[2]).toEqual({
        name: 'isActive',
        type: 'boolean',
        required: true,
        default: null
      });
      expect(props[3]).toEqual({
        name: 'onClick',
        type: '(id: string) => void',
        required: true,
        default: null
      });
    });

    test('should extract PropTypes props', () => {
      const source = `
        Component.propTypes = {
          title: PropTypes.string.isRequired,
          count: PropTypes.number,
          isActive: PropTypes.bool.isRequired,
          onClick: PropTypes.func
        };
      `;

      const props = adapter.extractProps(source);
      expect(props).toHaveLength(4);
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
        default: null
      });
    });

    test('should detect React hooks usage', () => {
      const sourceWithHooks = `
        import React, { useState, useEffect } from 'react';
        function Component() {
          const [count, setCount] = useState(0);
          useEffect(() => {}, []);
          return <div>{count}</div>;
        }
      `;

      const sourceWithoutHooks = `
        import React from 'react';
        function Component(props) {
          return <div>{props.title}</div>;
        }
      `;

      expect(adapter.detectHooks(sourceWithHooks)).toBe(true);
      expect(adapter.detectHooks(sourceWithoutHooks)).toBe(false);
    });

    test('should detect React context usage', () => {
      const sourceWithContext = `
        import React, { useContext, createContext } from 'react';
        const ThemeContext = createContext();
        function Component() {
          const theme = useContext(ThemeContext);
          return <div>{theme}</div>;
        }
      `;

      const sourceWithoutContext = `
        import React from 'react';
        function Component(props) {
          return <div>{props.title}</div>;
        }
      `;

      expect(adapter.detectContext(sourceWithContext)).toBe(true);
      expect(adapter.detectContext(sourceWithoutContext)).toBe(false);
    });

    test('should detect export type', () => {
      const defaultExport = 'export default function Component() {}';
      const namedExport = 'export const Component = () => {}';
      const bothExports = `
        export const utils = {};
        export default function Component() {}
      `;

      expect(adapter.detectExportType(defaultExport)).toBe('default');
      expect(adapter.detectExportType(namedExport)).toBe('named');
      expect(adapter.detectExportType(bothExports)).toBe('both');
    });

    test('should transform component import with React metadata', () => {
      const componentImport = {
        name: 'TestComponent',
        path: '@components/Test.tsx',
        framework: 'react'
      };

      // Mock fs.readFileSync to return source with hooks
      const originalReadFileSync = require('fs').readFileSync;
      require('fs').readFileSync = jest.fn().mockReturnValue(`
        import React, { useState } from 'react';
        interface Props { title: string; }
        export default function TestComponent({ title }: Props) {
          const [count, setCount] = useState(0);
          return <div>{title}: {count}</div>;
        }
      `);

      const definition = adapter.transform(componentImport);

      expect(definition.name).toBe('TestComponent');
      expect(definition.framework).toBe('react');
      expect(definition.isReactComponent).toBe(true);
      expect(definition.hasHooks).toBe(true);
      expect(definition.hasContext).toBe(false);
      expect(definition.exportType).toBe('default');

      // Restore original function
      require('fs').readFileSync = originalReadFileSync;
    });

    test('should generate enhanced React wrapper code', () => {
      const componentDefinition = {
        name: 'TestComponent',
        framework: 'react',
        hasHooks: true,
        hasContext: false,
        props: [
          { name: 'title', type: 'string', required: true },
          { name: 'count', type: 'number', required: false, default: '0' }
        ]
      };

      const wrapper = adapter.generateWrapper(componentDefinition);

      // Check props interface
      expect(wrapper).toContain('interface TestComponentProps');
      expect(wrapper).toContain('title: string;');
      expect(wrapper).toContain('count?: number; // default: 0');

      // Check wrapper component
      expect(wrapper).toContain('function TestComponentWrapper');
      expect(wrapper).toContain('React.createElement(TestComponent, props)');
      expect(wrapper).toContain('Component uses React Hooks');

      // Check error handling
      expect(wrapper).toContain('try {');
      expect(wrapper).toContain('catch (error)');
      expect(wrapper).toContain('Error loading TestComponent');

      // Check mounting utilities
      expect(wrapper).toContain('TestComponentUtils');
      expect(wrapper).toContain('mount: function');
      expect(wrapper).toContain('createComponent: function');
      expect(wrapper).toContain('ReactDOM.createRoot');
      expect(wrapper).toContain('window.TestComponentUtils');
    });

    test('should generate props interface correctly', () => {
      const props = [
        { name: 'title', type: 'string', required: true },
        { name: 'count', type: 'number', required: false, default: '0' },
        { name: 'onClick', type: '() => void', required: true }
      ];

      const propsInterface = adapter.generatePropsInterface('TestComponent', props);

      expect(propsInterface).toContain('interface TestComponentProps {');
      expect(propsInterface).toContain('title: string;');
      expect(propsInterface).toContain('count?: number; // default: 0');
      expect(propsInterface).toContain('onClick: () => void;');
      expect(propsInterface).toContain('}');
    });

    test('should generate empty props interface for no props', () => {
      const propsInterface = adapter.generatePropsInterface('TestComponent', []);
      expect(propsInterface).toBe('interface TestComponentProps {}');
    });

    test('should generate wrapper component with error handling', () => {
      const componentDefinition = {
        name: 'TestComponent',
        hasHooks: true,
        hasContext: true
      };

      const wrapper = adapter.generateWrapperComponent(componentDefinition);

      expect(wrapper).toContain('function TestComponentWrapper');
      expect(wrapper).toContain('typeof React === \'undefined\'');
      expect(wrapper).toContain('Component uses React Context');
      expect(wrapper).toContain('Component uses React Hooks');
      expect(wrapper).toContain('React.createElement(TestComponent, props)');
      expect(wrapper).toContain('Error rendering TestComponent');
    });

    test('should generate mounting utilities with React 18 support', () => {
      const utils = adapter.generateMountingUtils('TestComponent');

      expect(utils).toContain('TestComponentUtils');
      expect(utils).toContain('mount: function(container: HTMLElement');
      expect(utils).toContain('ReactDOM.createRoot');
      expect(utils).toContain('ReactDOM.render');
      expect(utils).toContain('unmount:');
      expect(utils).toContain('update:');
      expect(utils).toContain('createComponent:');
      expect(utils).toContain('window.TestComponentUtils');
    });

    test('should map PropTypes to TypeScript types correctly', () => {
      expect(adapter.mapPropTypeToTypeScript('string')).toBe('string');
      expect(adapter.mapPropTypeToTypeScript('number')).toBe('number');
      expect(adapter.mapPropTypeToTypeScript('bool')).toBe('boolean');
      expect(adapter.mapPropTypeToTypeScript('array')).toBe('any[]');
      expect(adapter.mapPropTypeToTypeScript('object')).toBe('object');
      expect(adapter.mapPropTypeToTypeScript('func')).toBe('Function');
      expect(adapter.mapPropTypeToTypeScript('node')).toBe('React.ReactNode');
      expect(adapter.mapPropTypeToTypeScript('element')).toBe('React.ReactElement');
      expect(adapter.mapPropTypeToTypeScript('unknown')).toBe('any');
    });
  });

  describe('VueComponentAdapter', () => {
    let adapter;

    beforeEach(() => {
      adapter = new VueComponentAdapter();
    });

    test('should have correct framework', () => {
      expect(adapter.framework).toBe('vue');
    });

    test('should handle Vue file extensions', () => {
      expect(adapter.canHandle('Component.vue')).toBe(true);
      expect(adapter.canHandle('vue-component.js')).toBe(true);
      expect(adapter.canHandle('vue-component.ts')).toBe(true);
      expect(adapter.canHandle('Component.tsx')).toBe(false);
      expect(adapter.canHandle('Component.svelte')).toBe(false);
    });

    test('should extract Vue array-style props', () => {
      const source = `
        export default {
          props: ['title', 'count', 'isActive']
        }
      `;

      const props = adapter.extractProps(source);
      expect(props).toHaveLength(3);
      expect(props[0]).toEqual({
        name: 'title',
        type: 'any',
        required: false,
        default: null
      });
      expect(props[1]).toEqual({
        name: 'count',
        type: 'any',
        required: false,
        default: null
      });
    });

    test('should extract Vue object-style props', () => {
      const source = `
        export default {
          props: {
            title: String,
            count: Number,
            isActive: Boolean,
            items: Array,
            config: Object,
            callback: Function
          }
        }
      `;

      const props = adapter.extractProps(source);
      expect(props).toHaveLength(6);
      expect(props[0]).toEqual({
        name: 'title',
        type: 'string',
        required: false,
        default: null
      });
      expect(props[1]).toEqual({
        name: 'count',
        type: 'number',
        required: false,
        default: null
      });
      expect(props[2]).toEqual({
        name: 'isActive',
        type: 'boolean',
        required: false,
        default: null
      });
    });

    test('should extract Vue complex prop definitions', () => {
      const source = `
        export default {
          props: {
            title: {
              type: String,
              required: true
            },
            count: {
              type: Number,
              default: 0
            },
            isActive: {
              type: Boolean,
              required: false,
              default: false
            }
          }
        }
      `;

      const props = adapter.extractProps(source);
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
        name: 'isActive',
        type: 'boolean',
        required: false,
        default: 'false'
      });
    });

    test('should extract Vue Composition API props', () => {
      const source = `
        <script setup lang="ts">
        interface Props {
          title: string;
          count?: number;
          isActive: boolean;
          onClick: (id: string) => void;
        }
        
        const props = defineProps<Props>();
        </script>
      `;

      const props = adapter.extractProps(source);
      expect(props).toHaveLength(4);
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
        default: null
      });
      expect(props[3]).toEqual({
        name: 'onClick',
        type: '(id: string)',
        required: true,
        default: '> void;'
      });
    });

    test('should extract Vue Composition API object props', () => {
      const source = `
        <script setup>
        const props = defineProps({
          title: String,
          count: {
            type: Number,
            default: 0
          },
          isActive: Boolean
        });
        </script>
      `;

      const props = adapter.extractProps(source);
      expect(props).toHaveLength(3);
      expect(props[0]).toEqual({
        name: 'title',
        type: 'string',
        required: false,
        default: null
      });
      expect(props[1]).toEqual({
        name: 'count',
        type: 'number',
        required: false,
        default: '0'
      });
    });

    test('should detect Vue Composition API usage', () => {
      const compositionSource = `
        <script setup>
        import { ref, reactive, computed, watch, onMounted } from 'vue';
        
        const count = ref(0);
        const state = reactive({ name: 'test' });
        const doubled = computed(() => count.value * 2);
        
        watch(count, (newVal) => console.log(newVal));
        onMounted(() => console.log('mounted'));
        </script>
      `;

      const optionsSource = `
        export default {
          data() {
            return { count: 0 };
          },
          methods: {
            increment() { this.count++; }
          }
        }
      `;

      expect(adapter.detectCompositionAPI(compositionSource)).toBe(true);
      expect(adapter.detectCompositionAPI(optionsSource)).toBe(false);
    });

    test('should detect Vue Options API usage', () => {
      const optionsSource = `
        export default {
          data() {
            return { count: 0 };
          },
          computed: {
            doubled() { return this.count * 2; }
          },
          methods: {
            increment() { this.count++; }
          },
          mounted() {
            console.log('Component mounted');
          }
        }
      `;

      const compositionSource = `
        <script setup>
        import { ref } from 'vue';
        const count = ref(0);
        </script>
      `;

      expect(adapter.detectOptionsAPI(optionsSource)).toBe(true);
      expect(adapter.detectOptionsAPI(compositionSource)).toBe(false);
    });

    test('should detect slots usage', () => {
      const sourceWithSlots = `
        <template>
          <div>
            <slot name="header"></slot>
            <slot></slot>
            <slot name="footer"></slot>
          </div>
        </template>
        
        <script>
        export default {
          mounted() {
            console.log(this.$slots);
          }
        }
        </script>
      `;

      const sourceWithoutSlots = `
        <template>
          <div>No slots here</div>
        </template>
      `;

      expect(adapter.detectSlots(sourceWithSlots)).toBe(true);
      expect(adapter.detectSlots(sourceWithoutSlots)).toBe(false);
    });

    test('should detect emits usage', () => {
      const sourceWithEmits = `
        <script setup>
        const emit = defineEmits(['update', 'change']);
        
        function handleClick() {
          emit('update', 'new value');
        }
        </script>
      `;

      const sourceWithOptionsEmits = `
        export default {
          emits: ['update', 'change'],
          methods: {
            handleClick() {
              this.$emit('update', 'new value');
            }
          }
        }
      `;

      const sourceWithoutEmits = `
        <template>
          <div>No emits here</div>
        </template>
      `;

      expect(adapter.detectEmits(sourceWithEmits)).toBe(true);
      expect(adapter.detectEmits(sourceWithOptionsEmits)).toBe(true);
      expect(adapter.detectEmits(sourceWithoutEmits)).toBe(false);
    });

    test('should detect export type', () => {
      const defaultExport = 'export default { name: "Component" }';
      const namedExport = 'export const Component = {}';
      const bothExports = `
        export const utils = {};
        export default { name: "Component" }
      `;

      expect(adapter.detectExportType(defaultExport)).toBe('default');
      expect(adapter.detectExportType(namedExport)).toBe('named');
      expect(adapter.detectExportType(bothExports)).toBe('both');
    });

    test('should map Vue types to TypeScript types correctly', () => {
      expect(adapter.mapVueTypeToTypeScript('String')).toBe('string');
      expect(adapter.mapVueTypeToTypeScript('Number')).toBe('number');
      expect(adapter.mapVueTypeToTypeScript('Boolean')).toBe('boolean');
      expect(adapter.mapVueTypeToTypeScript('Array')).toBe('any[]');
      expect(adapter.mapVueTypeToTypeScript('Object')).toBe('object');
      expect(adapter.mapVueTypeToTypeScript('Function')).toBe('Function');
      expect(adapter.mapVueTypeToTypeScript('Date')).toBe('Date');
      expect(adapter.mapVueTypeToTypeScript('Symbol')).toBe('symbol');
      expect(adapter.mapVueTypeToTypeScript('Unknown')).toBe('any');
    });

    test('should transform component import with Vue metadata', () => {
      const componentImport = {
        name: 'TestComponent',
        path: '@components/Test.vue',
        framework: 'vue'
      };

      const vueSource = `
        <template>
          <div>
            <slot name="header"></slot>
            {{ title }}
          </div>
        </template>
        
        <script setup lang="ts">
        interface Props {
          title: string;
        }
        
        const props = defineProps<Props>();
        const emit = defineEmits(['update']);
        
        import { ref, onMounted } from 'vue';
        const count = ref(0);
        
        onMounted(() => {
          console.log('Component mounted');
        });
        </script>
      `;

      // Mock fs functions to return Vue source with Composition API
      const fs = require('fs');
      const originalReadFileSync = fs.readFileSync;
      const originalExistsSync = fs.existsSync;
      fs.readFileSync = jest.fn().mockReturnValue(vueSource);
      fs.existsSync = jest.fn().mockReturnValue(true);

      const definition = adapter.transform(componentImport);

      expect(definition.name).toBe('TestComponent');
      expect(definition.framework).toBe('vue');
      expect(definition.isVueComponent).toBe(true);
      expect(definition.usesCompositionAPI).toBe(true);
      expect(definition.usesOptionsAPI).toBe(false);
      expect(definition.hasSlots).toBe(true);
      expect(definition.hasEmits).toBe(true);
      expect(definition.exportType).toBe('default');

      // Restore original functions
      fs.readFileSync = originalReadFileSync;
      fs.existsSync = originalExistsSync;
    });

    test('should generate enhanced Vue wrapper code', () => {
      const componentDefinition = {
        name: 'TestComponent',
        framework: 'vue',
        usesCompositionAPI: true,
        usesOptionsAPI: false,
        hasSlots: true,
        hasEmits: true,
        props: [
          { name: 'title', type: 'string', required: true },
          { name: 'count', type: 'number', required: false, default: '0' }
        ]
      };

      const wrapper = adapter.generateWrapper(componentDefinition);

      // Check props interface
      expect(wrapper).toContain('interface TestComponentProps');
      expect(wrapper).toContain('title: string;');
      expect(wrapper).toContain('count?: number; // default: 0');

      // Check wrapper component
      expect(wrapper).toContain('function TestComponentWrapper');
      expect(wrapper).toContain('Vue.h(TestComponent, props');
      expect(wrapper).toContain('Component uses Vue Composition API');
      expect(wrapper).toContain('Component supports slots');
      expect(wrapper).toContain('Component defines custom events');

      // Check error handling
      expect(wrapper).toContain('try {');
      expect(wrapper).toContain('catch (error)');
      expect(wrapper).toContain('Error loading TestComponent');

      // Check mounting utilities
      expect(wrapper).toContain('TestComponentUtils');
      expect(wrapper).toContain('mount: function');
      expect(wrapper).toContain('createComponent: function');
      expect(wrapper).toContain('createReactiveProps: function');
      expect(wrapper).toContain('createRef: function');
      expect(wrapper).toContain('Vue.createApp');
      expect(wrapper).toContain('window.TestComponentUtils');
    });

    test('should generate props interface correctly', () => {
      const props = [
        { name: 'title', type: 'string', required: true },
        { name: 'count', type: 'number', required: false, default: '0' },
        { name: 'onClick', type: '() => void', required: true }
      ];

      const propsInterface = adapter.generatePropsInterface('TestComponent', props);

      expect(propsInterface).toContain('interface TestComponentProps {');
      expect(propsInterface).toContain('title: string;');
      expect(propsInterface).toContain('count?: number; // default: 0');
      expect(propsInterface).toContain('onClick: () => void;');
      expect(propsInterface).toContain('}');
    });

    test('should generate empty props interface for no props', () => {
      const propsInterface = adapter.generatePropsInterface('TestComponent', []);
      expect(propsInterface).toBe('interface TestComponentProps {}');
    });

    test('should generate wrapper component with error handling', () => {
      const componentDefinition = {
        name: 'TestComponent',
        usesCompositionAPI: true,
        usesOptionsAPI: false,
        hasSlots: true,
        hasEmits: true
      };

      const wrapper = adapter.generateWrapperComponent(componentDefinition);

      expect(wrapper).toContain('function TestComponentWrapper');
      expect(wrapper).toContain('typeof Vue === \'undefined\'');
      expect(wrapper).toContain('Component uses Vue Composition API');
      expect(wrapper).toContain('Component supports slots');
      expect(wrapper).toContain('Component defines custom events');
      expect(wrapper).toContain('Vue.h(TestComponent, props');
      expect(wrapper).toContain('Error rendering TestComponent');
    });

    test('should generate mounting utilities with Vue 3 support', () => {
      const utils = adapter.generateMountingUtils('TestComponent');

      expect(utils).toContain('TestComponentUtils');
      expect(utils).toContain('mount: function(container: HTMLElement');
      expect(utils).toContain('Vue.createApp');
      expect(utils).toContain('app.mount(container)');
      expect(utils).toContain('unmount:');
      expect(utils).toContain('update:');
      expect(utils).toContain('createComponent:');
      expect(utils).toContain('createReactiveProps:');
      expect(utils).toContain('createRef:');
      expect(utils).toContain('Vue.reactive');
      expect(utils).toContain('Vue.ref');
      expect(utils).toContain('window.TestComponentUtils');
    });

    test('should parse Vue prop config correctly', () => {
      const config = 'type: String, required: true, default: "hello"';
      const parsed = adapter.parseVuePropConfig(config);

      expect(parsed).toEqual({
        type: 'string',
        required: true,
        default: '"hello"'
      });
    });

    test('should split props content while respecting nested objects', () => {
      const content = 'name: String, config: { type: Object, default: () => ({}) }, active: Boolean';
      const lines = adapter.splitPropsContent(content);

      expect(lines).toHaveLength(3);
      expect(lines[0]).toBe('name: String');
      expect(lines[1]).toBe('config: { type: Object, default: () => ({}) }');
      expect(lines[2]).toBe('active: Boolean');
    });
  });

  describe('SolidComponentAdapter', () => {
    let adapter;

    beforeEach(() => {
      adapter = new SolidComponentAdapter();
    });

    test('should have correct framework', () => {
      expect(adapter.framework).toBe('solid');
    });

    test('should handle Solid file extensions', () => {
      expect(adapter.canHandle('Component.solid.tsx')).toBe(true);
      expect(adapter.canHandle('Component.solid.jsx')).toBe(true);
      expect(adapter.canHandle('solid-component.tsx')).toBe(true);
      expect(adapter.canHandle('Component.tsx')).toBe(true); // Generic TSX without react/vue
      expect(adapter.canHandle('Component.vue')).toBe(false);
      expect(adapter.canHandle('Component.svelte')).toBe(false);
      expect(adapter.canHandle('react-component.tsx')).toBe(false);
      expect(adapter.canHandle('vue-component.tsx')).toBe(false);
    });

    test('should extract TypeScript interface props', () => {
      const source = `
        interface TestComponentProps {
          title: string;
          count?: number;
          isActive: boolean;
          onClick: (id: string) => void;
        }
      `;

      const props = adapter.extractProps(source);
      expect(props).toHaveLength(4);
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
        default: null
      });
      expect(props[2]).toEqual({
        name: 'isActive',
        type: 'boolean',
        required: true,
        default: null
      });
      expect(props[3]).toEqual({
        name: 'onClick',
        type: '(id: string) => void',
        required: true,
        default: null
      });
    });

    test('should extract TypeScript type props', () => {
      const source = `
        type ComponentProps = {
          name: string;
          age?: number;
          callback: () => void;
        };
      `;

      const props = adapter.extractProps(source);
      expect(props).toHaveLength(3);
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
        default: null
      });
      expect(props[2]).toEqual({
        name: 'callback',
        type: '() => void',
        required: true,
        default: null
      });
    });

    test('should extract function component destructured props', () => {
      const source = `
        function TestComponent({ title, count = 0, isActive }: Props) {
          return <div>{title}</div>;
        }
      `;

      const props = adapter.extractProps(source);
      expect(props).toHaveLength(3);
      expect(props[0]).toEqual({
        name: 'title',
        type: 'any',
        required: true,
        default: null
      });
      expect(props[1]).toEqual({
        name: 'count',
        type: 'any',
        required: false,
        default: '0'
      });
      expect(props[2]).toEqual({
        name: 'isActive',
        type: 'any',
        required: true,
        default: null
      });
    });

    test('should extract arrow function component props', () => {
      const source = `
        const TestComponent = ({ name, active = false }: Props) => {
          return <div>{name}</div>;
        };
      `;

      const props = adapter.extractProps(source);
      expect(props).toHaveLength(2);
      expect(props[0]).toEqual({
        name: 'name',
        type: 'any',
        required: true,
        default: null
      });
      expect(props[1]).toEqual({
        name: 'active',
        type: 'any',
        required: false,
        default: 'false'
      });
    });

    test('should detect Solid signals usage', () => {
      const sourceWithSignals = `
        import { createSignal } from 'solid-js';
        function Component() {
          const [count, setCount] = createSignal(0);
          return <div>{count()}</div>;
        }
      `;

      const sourceWithoutSignals = `
        function Component(props) {
          return <div>{props.title}</div>;
        }
      `;

      expect(adapter.detectSignals(sourceWithSignals)).toBe(true);
      expect(adapter.detectSignals(sourceWithoutSignals)).toBe(false);
    });

    test('should detect Solid stores usage', () => {
      const sourceWithStores = `
        import { createStore, produce } from 'solid-js/store';
        function Component() {
          const [store, setStore] = createStore({ count: 0 });
          const updateStore = produce((s) => s.count++);
          return <div>{store.count}</div>;
        }
      `;

      const sourceWithoutStores = `
        function Component(props) {
          return <div>{props.title}</div>;
        }
      `;

      expect(adapter.detectStores(sourceWithStores)).toBe(true);
      expect(adapter.detectStores(sourceWithoutStores)).toBe(false);
    });

    test('should detect Solid effects usage', () => {
      const sourceWithEffects = `
        import { createEffect, createMemo, onMount, onCleanup } from 'solid-js';
        function Component() {
          const [count, setCount] = createSignal(0);
          const doubled = createMemo(() => count() * 2);
          
          createEffect(() => {
            console.log('Count changed:', count());
          });
          
          onMount(() => {
            console.log('Component mounted');
          });
          
          onCleanup(() => {
            console.log('Component cleanup');
          });
          
          return <div>{doubled()}</div>;
        }
      `;

      const sourceWithoutEffects = `
        function Component(props) {
          return <div>{props.title}</div>;
        }
      `;

      expect(adapter.detectEffects(sourceWithEffects)).toBe(true);
      expect(adapter.detectEffects(sourceWithoutEffects)).toBe(false);
    });

    test('should detect Solid resources usage', () => {
      const sourceWithResources = `
        import { createResource, Suspense, ErrorBoundary, lazy } from 'solid-js';
        
        const LazyComponent = lazy(() => import('./LazyComponent'));
        
        function Component() {
          const [data] = createResource(fetchData);
          
          return (
            <ErrorBoundary fallback={<div>Error</div>}>
              <Suspense fallback={<div>Loading...</div>}>
                <LazyComponent data={data()} />
              </Suspense>
            </ErrorBoundary>
          );
        }
      `;

      const sourceWithoutResources = `
        function Component(props) {
          return <div>{props.title}</div>;
        }
      `;

      expect(adapter.detectResources(sourceWithResources)).toBe(true);
      expect(adapter.detectResources(sourceWithoutResources)).toBe(false);
    });

    test('should detect export type', () => {
      const defaultExport = 'export default function Component() {}';
      const namedExport = 'export const Component = () => {}';
      const bothExports = `
        export const utils = {};
        export default function Component() {}
      `;

      expect(adapter.detectExportType(defaultExport)).toBe('default');
      expect(adapter.detectExportType(namedExport)).toBe('named');
      expect(adapter.detectExportType(bothExports)).toBe('both');
    });

    test('should transform component import with Solid metadata', () => {
      const componentImport = {
        name: 'TestComponent',
        path: '@components/Test.solid.tsx',
        framework: 'solid'
      };

      const solidSource = `
        import { createSignal, createEffect, createStore } from 'solid-js';
        
        interface Props {
          title: string;
          count?: number;
        }
        
        export default function TestComponent({ title, count = 0 }: Props) {
          const [localCount, setLocalCount] = createSignal(count);
          const [store, setStore] = createStore({ data: [] });
          
          createEffect(() => {
            console.log('Count changed:', localCount());
          });
          
          return <div>{title}: {localCount()}</div>;
        }
      `;

      // Mock fs functions to return Solid source
      const fs = require('fs');
      const originalReadFileSync = fs.readFileSync;
      const originalExistsSync = fs.existsSync;
      fs.readFileSync = jest.fn().mockReturnValue(solidSource);
      fs.existsSync = jest.fn().mockReturnValue(true);

      const definition = adapter.transform(componentImport);

      expect(definition.name).toBe('TestComponent');
      expect(definition.framework).toBe('solid');
      expect(definition.isSolidComponent).toBe(true);
      expect(definition.usesSignals).toBe(true);
      expect(definition.usesStores).toBe(true);
      expect(definition.usesEffects).toBe(true);
      expect(definition.usesResources).toBe(false);
      expect(definition.exportType).toBe('default');

      // Restore original functions
      fs.readFileSync = originalReadFileSync;
      fs.existsSync = originalExistsSync;
    });

    test('should generate enhanced Solid wrapper code', () => {
      const componentDefinition = {
        name: 'TestComponent',
        framework: 'solid',
        usesSignals: true,
        usesStores: true,
        usesEffects: true,
        usesResources: false,
        props: [
          { name: 'title', type: 'string', required: true },
          { name: 'count', type: 'number', required: false, default: '0' }
        ]
      };

      const wrapper = adapter.generateWrapper(componentDefinition);

      // Check props interface
      expect(wrapper).toContain('interface TestComponentProps');
      expect(wrapper).toContain('title: string;');
      expect(wrapper).toContain('count?: number; // default: 0');

      // Check wrapper component
      expect(wrapper).toContain('function TestComponentWrapper');
      expect(wrapper).toContain('typeof Solid === \'undefined\'');
      expect(wrapper).toContain('Component uses Solid signals');
      expect(wrapper).toContain('Component uses Solid stores');
      expect(wrapper).toContain('Component uses Solid effects');
      expect(wrapper).toContain('Solid.createMemo(() => props)');
      expect(wrapper).toContain('TestComponent(reactiveProps())');

      // Check error handling
      expect(wrapper).toContain('try {');
      expect(wrapper).toContain('catch (error)');
      expect(wrapper).toContain('Error loading TestComponent');

      // Check mounting utilities
      expect(wrapper).toContain('TestComponentUtils');
      expect(wrapper).toContain('mount: function');
      expect(wrapper).toContain('createComponent: function');
      expect(wrapper).toContain('createSignal: function');
      expect(wrapper).toContain('createStore: function');
      expect(wrapper).toContain('createMemo: function');
      expect(wrapper).toContain('createEffect: function');
      expect(wrapper).toContain('Solid.render');
      expect(wrapper).toContain('window.TestComponentUtils');
    });

    test('should generate props interface correctly', () => {
      const props = [
        { name: 'title', type: 'string', required: true },
        { name: 'count', type: 'number', required: false, default: '0' },
        { name: 'onClick', type: '() => void', required: true }
      ];

      const propsInterface = adapter.generatePropsInterface('TestComponent', props);

      expect(propsInterface).toContain('interface TestComponentProps {');
      expect(propsInterface).toContain('title: string;');
      expect(propsInterface).toContain('count?: number; // default: 0');
      expect(propsInterface).toContain('onClick: () => void;');
      expect(propsInterface).toContain('}');
    });

    test('should generate empty props interface for no props', () => {
      const propsInterface = adapter.generatePropsInterface('TestComponent', []);
      expect(propsInterface).toBe('interface TestComponentProps {}');
    });

    test('should generate wrapper component with signal integration', () => {
      const componentDefinition = {
        name: 'TestComponent',
        usesSignals: true,
        usesStores: true,
        usesEffects: true,
        usesResources: true
      };

      const wrapper = adapter.generateWrapperComponent(componentDefinition);

      expect(wrapper).toContain('function TestComponentWrapper');
      expect(wrapper).toContain('typeof Solid === \'undefined\'');
      expect(wrapper).toContain('Component uses Solid signals');
      expect(wrapper).toContain('Component uses Solid stores');
      expect(wrapper).toContain('Component uses Solid effects');
      expect(wrapper).toContain('Component uses Solid resources');
      expect(wrapper).toContain('Solid.createMemo(() => props)');
      expect(wrapper).toContain('TestComponent(reactiveProps())');
      expect(wrapper).toContain('Error rendering TestComponent');
    });

    test('should generate mounting utilities with Solid render integration', () => {
      const utils = adapter.generateMountingUtils('TestComponent');

      expect(utils).toContain('TestComponentUtils');
      expect(utils).toContain('mount: function(container: HTMLElement');
      expect(utils).toContain('Solid.createSignal(props)');
      expect(utils).toContain('Solid.render(component, container)');
      expect(utils).toContain('unmount:');
      expect(utils).toContain('update:');
      expect(utils).toContain('getProps:');
      expect(utils).toContain('setProps:');
      expect(utils).toContain('createComponent:');
      expect(utils).toContain('createSignal:');
      expect(utils).toContain('createStore:');
      expect(utils).toContain('createMemo:');
      expect(utils).toContain('createEffect:');
      expect(utils).toContain('window.TestComponentUtils');
    });

    test('should parse TypeScript props correctly', () => {
      const propsContent = `
        title: string;
        count?: number;
        isActive: boolean;
        onClick: (id: string) => void;
        config?: { theme: string; size: number };
      `;

      const props = [];
      adapter.parseTypeScriptProps(propsContent, props);

      expect(props).toHaveLength(5);
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
        default: null
      });
      expect(props[4]).toEqual({
        name: 'config',
        type: '{ theme: string; size: number }',
        required: false,
        default: null
      });
    });

    test('should parse destructured props correctly', () => {
      const propsContent = 'title, count = 0, isActive, callback = () => {}';
      const props = [];
      adapter.parseDestructuredProps(propsContent, props);

      expect(props).toHaveLength(4);
      expect(props[0]).toEqual({
        name: 'title',
        type: 'any',
        required: true,
        default: null
      });
      expect(props[1]).toEqual({
        name: 'count',
        type: 'any',
        required: false,
        default: '0'
      });
      expect(props[2]).toEqual({
        name: 'isActive',
        type: 'any',
        required: true,
        default: null
      });
      expect(props[3]).toEqual({
        name: 'callback',
        type: 'any',
        required: false,
        default: '() => {}'
      });
    });
  });

  describe('SvelteComponentAdapter', () => {
    let adapter;

    beforeEach(() => {
      adapter = new SvelteComponentAdapter();
    });

    test('should have correct framework', () => {
      expect(adapter.framework).toBe('svelte');
    });

    test('should handle Svelte file extensions', () => {
      expect(adapter.canHandle('Component.svelte')).toBe(true);
      expect(adapter.canHandle('svelte-component.js')).toBe(true);
      expect(adapter.canHandle('Component.vue')).toBe(false);
      expect(adapter.canHandle('Component.tsx')).toBe(false);
    });

    test('should generate Svelte wrapper code', () => {
      const componentDefinition = {
        name: 'TestComponent',
        framework: 'svelte'
      };

      const wrapper = adapter.generateWrapper(componentDefinition);
      expect(wrapper).toContain('new TestComponent');
      expect(wrapper).toContain('target: document.body');
      expect(wrapper).toContain('props: props');
    });
  });
});