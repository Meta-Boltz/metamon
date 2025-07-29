// Unit tests for Compilation Mode Handler
const { CompilationModeHandler } = require('../compilation-mode-handler.js');

describe('CompilationModeHandler', () => {
  let handler;

  beforeEach(() => {
    handler = new CompilationModeHandler();
  });

  describe('Mode resolution', () => {
    test('should resolve inline mode from frontmatter', () => {
      const frontmatter = { compileJsMode: 'inline' };
      const mode = handler.resolveCompilationMode(frontmatter);
      expect(mode).toBe('inline');
    });

    test('should resolve external.js mode from frontmatter', () => {
      const frontmatter = { compileJsMode: 'external.js' };
      const mode = handler.resolveCompilationMode(frontmatter);
      expect(mode).toBe('external.js');
    });

    test('should resolve custom .js mode from frontmatter', () => {
      const frontmatter = { compileJsMode: 'custom-script.js' };
      const mode = handler.resolveCompilationMode(frontmatter);
      expect(mode).toBe('custom-script.js');
    });

    test('should throw error for invalid mode', () => {
      const frontmatter = { compileJsMode: 'invalid-mode' };
      expect(() => {
        handler.resolveCompilationMode(frontmatter);
      }).toThrow('Invalid compileJsMode');
    });

    test('should use default mode when not specified', () => {
      const frontmatter = {};
      const mode = handler.resolveCompilationMode(frontmatter);
      expect(mode).toBe('inline');
    });

    test('should use inline for development', () => {
      const frontmatter = {};
      const options = { development: true };
      const mode = handler.resolveCompilationMode(frontmatter, options);
      expect(mode).toBe('inline');
    });

    test('should use external.js for production', () => {
      const frontmatter = {};
      const options = { production: true };
      const mode = handler.resolveCompilationMode(frontmatter, options);
      expect(mode).toBe('external.js');
    });
  });

  describe('Mode validation', () => {
    test('should validate inline mode', () => {
      expect(handler.isValidMode('inline')).toBe(true);
    });

    test('should validate external.js mode', () => {
      expect(handler.isValidMode('external.js')).toBe(true);
    });

    test('should validate custom .js files', () => {
      expect(handler.isValidMode('custom.js')).toBe(true);
      expect(handler.isValidMode('app-bundle.js')).toBe(true);
    });

    test('should reject invalid modes', () => {
      expect(handler.isValidMode('invalid')).toBe(false);
      expect(handler.isValidMode('script.css')).toBe(false);
      expect(handler.isValidMode('')).toBe(false);
    });
  });

  describe('JavaScript generation', () => {
    const mockAST = {
      name: 'TestComponent',
      frontmatter: {
        route: '/test',
        title: 'Test Page',
        compileJsMode: 'inline'
      },
      variables: [
        {
          name: 'count',
          type: 'reactive',
          value: 'signal("count", 0)'
        },
        {
          name: 'message',
          type: 'computed',
          value: '"Hello World"'
        }
      ],
      functions: [
        {
          name: 'increment',
          params: '',
          body: '$count = $count + 1'
        }
      ],
      imports: [
        {
          name: 'Counter',
          path: '@components/Counter.tsx',
          framework: 'react'
        }
      ]
    };

    test('should generate inline JavaScript', () => {
      const result = handler.generateJavaScript(mockAST, 'inline');

      expect(result.mode).toBe('inline');
      expect(result.content).toContain('function TestComponentPage()');
      expect(result.content).toContain('MTMRouter.create');
      expect(result.content).toContain('const count = MTMRouter.create');
      expect(result.content).toContain('const increment =');
      expect(result.scriptTag).toContain('<script>');
      expect(result.scriptTag).toContain('</script>');
      expect(result.externalFile).toBeNull();
    });

    test('should generate external JavaScript', () => {
      const result = handler.generateJavaScript(mockAST, 'external.js');

      expect(result.mode).toBe('external');
      expect(result.content).toContain('function TestComponentPage()');
      expect(result.scriptTag).toContain('<script src="js/testcomponent.js"></script>');
      expect(result.externalFile).toBeDefined();
      expect(result.externalFile.filename).toBe('js/testcomponent.js');
      expect(result.externalFile.content).toBe(result.content);
    });

    test('should generate custom external JavaScript', () => {
      const result = handler.generateJavaScript(mockAST, 'custom-app.js');

      expect(result.mode).toBe('external');
      expect(result.scriptTag).toContain('<script src="custom-app.js"></script>');
      expect(result.externalFile.filename).toBe('custom-app.js');
    });

    test('should include MTM runtime in generated JavaScript', () => {
      const result = handler.generateJavaScript(mockAST, 'inline');

      expect(result.content).toContain('const MTMRouter = {');
      expect(result.content).toContain('const MTMComponents = {');
      expect(result.content).toContain('_signals: new Map()');
      expect(result.content).toContain('setupLinkInterception');
    });

    test('should skip runtime when requested', () => {
      const result = handler.generateJavaScript(mockAST, 'inline', { skipRuntime: true });

      expect(result.content).not.toContain('const MTMRouter = {');
      expect(result.content).toContain('function TestComponentPage()');
    });

    test('should handle AST without variables', () => {
      const simpleAST = {
        name: 'SimpleComponent',
        frontmatter: { route: '/simple' },
        variables: [],
        functions: [],
        imports: []
      };

      const result = handler.generateJavaScript(simpleAST, 'inline');

      expect(result.content).toContain('function SimpleComponentPage()');
      expect(result.content).not.toContain('// Variables');
      expect(result.content).not.toContain('// Functions');
    });

    test('should handle AST without functions', () => {
      const noFuncAST = {
        name: 'NoFuncComponent',
        frontmatter: { route: '/nofunc' },
        variables: [{ name: 'test', type: 'reactive', value: '42' }],
        functions: [],
        imports: []
      };

      const result = handler.generateJavaScript(noFuncAST, 'inline');

      expect(result.content).toContain('const test = MTMRouter.create');
      expect(result.content).not.toContain('// Functions');
    });
  });

  describe('Variable generation', () => {
    test('should generate reactive variable with signal', () => {
      const variable = {
        name: 'count',
        type: 'reactive',
        value: 'signal("count", 0)'
      };

      const result = handler.generateVariable(variable);
      expect(result).toBe('const count = MTMRouter.create(\'count\', 0);');
    });

    test('should generate reactive variable without signal', () => {
      const variable = {
        name: 'message',
        type: 'reactive',
        value: '"Hello"'
      };

      const result = handler.generateVariable(variable);
      expect(result).toBe('const message = MTMRouter.create(\'message\', "Hello");');
    });

    test('should generate computed variable', () => {
      const variable = {
        name: 'computed',
        type: 'computed',
        value: '42'
      };

      const result = handler.generateVariable(variable);
      expect(result).toBe('const computed = MTMRouter.create(\'computed\', 42);');
    });
  });

  describe('Function generation', () => {
    test('should generate function with variable replacement', () => {
      const func = {
        name: 'increment',
        params: '',
        body: '$count = $count + 1'
      };

      const variables = [{ name: 'count', type: 'reactive' }];

      const result = handler.generateFunction(func, variables);
      expect(result).toContain('const increment = () => {');
      expect(result).toContain('count.value = count.value + 1');
    });

    test('should generate function with parameters', () => {
      const func = {
        name: 'add',
        params: 'a, b',
        body: 'return a + b'
      };

      const result = handler.generateFunction(func, []);
      expect(result).toContain('const add = (a, b) => {');
      expect(result).toContain('return a + b');
    });

    test('should not replace variables that are not in scope', () => {
      const func = {
        name: 'test',
        params: '',
        body: '$unknown = 42'
      };

      const variables = [{ name: 'count', type: 'reactive' }];

      const result = handler.generateFunction(func, variables);
      expect(result).toContain('$unknown = 42');
    });
  });

  describe('Component import generation', () => {
    test('should generate React component import', () => {
      const component = {
        name: 'Counter',
        path: '@components/Counter.tsx',
        framework: 'react'
      };

      const result = handler.generateComponentImport(component);
      expect(result).toContain('// react component: Counter');
      expect(result).toContain('MTMComponents.register(\'Counter\', \'react\'');
      expect(result).toContain('react-component');
    });

    test('should generate Vue component import', () => {
      const component = {
        name: 'VueButton',
        path: '@components/VueButton.vue',
        framework: 'vue'
      };

      const result = handler.generateComponentImport(component);
      expect(result).toContain('// vue component: VueButton');
      expect(result).toContain('MTMComponents.register(\'VueButton\', \'vue\'');
      expect(result).toContain('vue-component');
    });
  });

  describe('Utility functions', () => {
    test('should generate component name from string', () => {
      expect(handler.generateComponentName('test')).toBe('TestPage');
      expect(handler.generateComponentName('my-component')).toBe('MycomponentPage');
      expect(handler.generateComponentName('Component123')).toBe('Component123Page');
    });

    test('should generate external filename', () => {
      const ast = { name: 'TestComponent' };
      const filename = handler.generateExternalFilename(ast);
      expect(filename).toBe('js/testcomponent.js');
    });

    test('should generate external filename with fallback', () => {
      const ast = {};
      const filename = handler.generateExternalFilename(ast);
      expect(filename).toBe('js/component.js');
    });

    test('should generate binding update', () => {
      const variable = { name: 'count' };
      const result = handler.generateBindingUpdate(variable);
      expect(result).toContain('querySelectorAll(\'[data-bind="count"]\')');
      expect(result).toContain('el.textContent = count.value');
    });

    test('should generate event binding', () => {
      const func = { name: 'handleClick' };
      const result = handler.generateEventBinding(func);
      expect(result).toContain('querySelectorAll(\'[data-event-click="handleClick"]\')');
      expect(result).toContain('handleClick()');
    });
  });

  describe('JavaScript optimization', () => {
    test('should return unoptimized content when minify is false', () => {
      const content = `
        // This is a comment
        function test() {
          console.log('hello');
        }
      `;

      const result = handler.optimizeJavaScript(content, { minify: false });
      expect(result).toBe(content);
    });

    test('should minify JavaScript when requested', () => {
      const content = `
        // This is a comment
        function test() {
          console.log('hello');
        }
      `;

      const result = handler.optimizeJavaScript(content, { minify: true });
      expect(result).not.toContain('// This is a comment');
      expect(result.length).toBeLessThan(content.length);
      expect(result).toContain('function test()');
    });
  });
});

// Mock Jest functions if not in Jest environment
if (typeof describe === 'undefined') {
  global.describe = (name, fn) => {
    console.log(`\n=== ${name} ===`);
    fn();
  };

  global.test = (name, fn) => {
    try {
      fn();
      console.log(`✓ ${name}`);
    } catch (error) {
      console.log(`✗ ${name}: ${error.message}`);
    }
  };

  global.beforeEach = (fn) => fn();

  global.expect = (actual) => ({
    toBe: (expected) => {
      if (actual !== expected) {
        throw new Error(`Expected ${expected}, got ${actual}`);
      }
    },
    toEqual: (expected) => {
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
      }
    },
    toContain: (expected) => {
      if (!actual.includes(expected)) {
        throw new Error(`Expected "${actual}" to contain "${expected}"`);
      }
    },
    not: {
      toContain: (expected) => {
        if (actual.includes(expected)) {
          throw new Error(`Expected "${actual}" not to contain "${expected}"`);
        }
      }
    },
    toBeDefined: () => {
      if (actual === undefined) {
        throw new Error('Expected value to be defined');
      }
    },
    toBeNull: () => {
      if (actual !== null) {
        throw new Error(`Expected null, got ${actual}`);
      }
    },
    toBeLessThan: (expected) => {
      if (actual >= expected) {
        throw new Error(`Expected ${actual} to be less than ${expected}`);
      }
    }
  });

  global.expect.any = (constructor) => ({
    asymmetricMatch: (actual) => actual instanceof constructor
  });
}

module.exports = { CompilationModeHandler };