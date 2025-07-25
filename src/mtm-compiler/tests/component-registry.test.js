// Component Registry Tests
const { ComponentRegistry } = require('../component-registry.js');
const {
  ComponentAdapter,
  ReactComponentAdapter,
  VueComponentAdapter
} = require('../component-adapter.js');

describe('ComponentRegistry', () => {
  let registry;

  beforeEach(() => {
    registry = new ComponentRegistry();
  });

  describe('Initialization', () => {
    test('should initialize with default adapters', () => {
      expect(registry.getAdapter('react')).toBeInstanceOf(ReactComponentAdapter);
      expect(registry.getAdapter('vue')).toBeInstanceOf(VueComponentAdapter);
      expect(registry.getAdapter('solid')).toBeDefined();
      expect(registry.getAdapter('svelte')).toBeDefined();
    });

    test('should initialize with default path mappings', () => {
      const resolved = registry.resolvePath('@components/Button.tsx');
      expect(resolved).toMatch(/src[\/\\]components[\/\\]Button\.tsx$/);
    });

    test('should start with empty component registry', () => {
      expect(registry.size()).toBe(0);
      expect(registry.getAll().size).toBe(0);
    });
  });

  describe('Component Registration', () => {
    test('should register a component definition', () => {
      const componentDefinition = {
        name: 'TestComponent',
        framework: 'react',
        path: '/test/path.tsx',
        source: 'test source',
        props: [],
        dependencies: []
      };

      registry.register(componentDefinition);
      expect(registry.has('TestComponent')).toBe(true);
      expect(registry.size()).toBe(1);
    });

    test('should throw error for component without name', () => {
      const componentDefinition = {
        framework: 'react',
        path: '/test/path.tsx'
      };

      expect(() => registry.register(componentDefinition)).toThrow('Component definition must have a name');
    });

    test('should warn when overwriting existing component', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const componentDefinition = {
        name: 'TestComponent',
        framework: 'react',
        path: '/test/path.tsx'
      };

      registry.register(componentDefinition);
      registry.register(componentDefinition);

      expect(consoleSpy).toHaveBeenCalledWith('Component TestComponent is already registered. Overwriting.');
      consoleSpy.mockRestore();
    });

    test('should register component from import', () => {
      const componentImport = {
        name: 'TestComponent',
        path: 'Component.tsx',
        framework: 'react'
      };

      const definition = registry.registerFromImport(componentImport);
      expect(definition.name).toBe('TestComponent');
      expect(definition.framework).toBe('react');
      expect(registry.has('TestComponent')).toBe(true);
    });

    test('should throw error for import without suitable adapter', () => {
      // Remove all adapters to simulate no suitable adapter
      registry.adapters.clear();

      const componentImport = {
        name: 'TestComponent',
        path: 'Component.unknown',
        framework: 'unknown'
      };

      expect(() => registry.registerFromImport(componentImport)).toThrow('No adapter found for component');
    });
  });

  describe('Component Resolution', () => {
    beforeEach(() => {
      const componentDefinition = {
        name: 'TestComponent',
        framework: 'react',
        path: '/test/path.tsx'
      };
      registry.register(componentDefinition);
    });

    test('should resolve existing component', () => {
      const component = registry.resolve('TestComponent');
      expect(component).toBeDefined();
      expect(component.name).toBe('TestComponent');
    });

    test('should return null for non-existing component', () => {
      const component = registry.resolve('NonExistentComponent');
      expect(component).toBeNull();
    });

    test('should check if component exists', () => {
      expect(registry.has('TestComponent')).toBe(true);
      expect(registry.has('NonExistentComponent')).toBe(false);
    });
  });

  describe('Adapter Management', () => {
    test('should get adapter by framework', () => {
      const reactAdapter = registry.getAdapter('react');
      expect(reactAdapter).toBeInstanceOf(ReactComponentAdapter);
    });

    test('should return null for unknown framework', () => {
      const adapter = registry.getAdapter('unknown');
      expect(adapter).toBeNull();
    });

    test('should register custom adapter', () => {
      class CustomAdapter extends ComponentAdapter {
        constructor() {
          super('custom');
        }
        canHandle() { return true; }
        transform() { return {}; }
        generateWrapper() { return ''; }
      }

      const customAdapter = new CustomAdapter();
      registry.registerAdapter('custom', customAdapter);

      expect(registry.getAdapter('custom')).toBe(customAdapter);
    });

    test('should throw error for invalid adapter', () => {
      expect(() => registry.registerAdapter('invalid', {})).toThrow('Adapter must be an instance of ComponentAdapter');
    });

    test('should get adapter for import', () => {
      const componentImport = {
        name: 'TestComponent',
        path: 'Component.tsx',
        framework: 'react'
      };

      const adapter = registry.getAdapterForImport(componentImport);
      expect(adapter).toBeInstanceOf(ReactComponentAdapter);
    });

    test('should find adapter by path when framework not specified', () => {
      const componentImport = {
        name: 'TestComponent',
        path: 'Component.vue'
      };

      const adapter = registry.getAdapterForImport(componentImport);
      expect(adapter).toBeInstanceOf(VueComponentAdapter);
    });
  });

  describe('Path Resolution', () => {
    test('should resolve @components/ paths', () => {
      const resolved = registry.resolvePath('@components/Button.tsx');
      expect(resolved).toMatch(/src[\/\\]components[\/\\]Button\.tsx$/);
    });

    test('should resolve @/ paths', () => {
      const resolved = registry.resolvePath('@/utils/helper.js');
      expect(resolved).toMatch(/src[\/\\]utils[\/\\]helper\.js$/);
    });

    test('should resolve relative paths', () => {
      const resolved = registry.resolvePath('./Button.tsx', '/test/path');
      expect(resolved).toMatch(/Button\.tsx$/);
    });

    test('should add custom path mapping', () => {
      registry.addPathMapping('@lib/', 'src/lib/');
      const resolved = registry.resolvePath('@lib/utils.js');
      expect(resolved).toMatch(/src[\/\\]lib[\/\\]utils\.js$/);
    });
  });

  describe('Component Management', () => {
    beforeEach(() => {
      const componentDefinition = {
        name: 'TestComponent',
        framework: 'react',
        path: '/test/path.tsx'
      };
      registry.register(componentDefinition);
    });

    test('should remove component', () => {
      expect(registry.has('TestComponent')).toBe(true);
      const removed = registry.remove('TestComponent');
      expect(removed).toBe(true);
      expect(registry.has('TestComponent')).toBe(false);
    });

    test('should return false when removing non-existent component', () => {
      const removed = registry.remove('NonExistentComponent');
      expect(removed).toBe(false);
    });

    test('should clear all components', () => {
      expect(registry.size()).toBe(1);
      registry.clear();
      expect(registry.size()).toBe(0);
    });

    test('should get all components', () => {
      const all = registry.getAll();
      expect(all.size).toBe(1);
      expect(all.has('TestComponent')).toBe(true);
    });
  });

  describe('Component Validation', () => {
    test('should validate valid component', () => {
      const componentDefinition = {
        name: 'TestComponent',
        framework: 'react',
        path: '/test/path.tsx'
      };

      const errors = registry.validateComponent(componentDefinition);
      expect(errors).toHaveLength(0);
    });

    test('should detect missing name', () => {
      const componentDefinition = {
        framework: 'react',
        path: '/test/path.tsx'
      };

      const errors = registry.validateComponent(componentDefinition);
      expect(errors).toHaveLength(1);
      expect(errors[0].field).toBe('name');
    });

    test('should detect missing framework', () => {
      const componentDefinition = {
        name: 'TestComponent',
        path: '/test/path.tsx'
      };

      const errors = registry.validateComponent(componentDefinition);
      expect(errors).toHaveLength(1);
      expect(errors[0].field).toBe('framework');
    });

    test('should detect unsupported framework', () => {
      const componentDefinition = {
        name: 'TestComponent',
        framework: 'unknown',
        path: '/test/path.tsx'
      };

      const errors = registry.validateComponent(componentDefinition);
      expect(errors).toHaveLength(1);
      expect(errors[0].field).toBe('framework');
      expect(errors[0].value).toBe('unknown');
    });

    test('should detect missing path and source', () => {
      const componentDefinition = {
        name: 'TestComponent',
        framework: 'react'
      };

      const errors = registry.validateComponent(componentDefinition);
      expect(errors).toHaveLength(1);
      expect(errors[0].field).toBe('path');
    });
  });

  describe('Wrapper Generation', () => {
    test('should generate wrapper for registered component', () => {
      const componentDefinition = {
        name: 'TestComponent',
        framework: 'react',
        path: '/test/path.tsx'
      };
      registry.register(componentDefinition);

      const wrapper = registry.generateWrapper('TestComponent');
      expect(wrapper).toContain('TestComponent');
      expect(wrapper).toContain('React.createElement');
    });

    test('should return null for non-existent component', () => {
      const wrapper = registry.generateWrapper('NonExistentComponent');
      expect(wrapper).toBeNull();
    });
  });

  describe('Statistics', () => {
    test('should provide registry statistics', () => {
      registry.register({
        name: 'ReactComponent',
        framework: 'react',
        path: '/test/react.tsx'
      });
      registry.register({
        name: 'VueComponent',
        framework: 'vue',
        path: '/test/vue.vue'
      });

      const stats = registry.getStats();
      expect(stats.totalComponents).toBe(2);
      expect(stats.totalAdapters).toBe(4); // react, vue, solid, svelte
      expect(stats.totalPathMappings).toBe(3); // @components/, @/, ~/
      expect(stats.frameworkCounts.react).toBe(1);
      expect(stats.frameworkCounts.vue).toBe(1);
    });
  });
});