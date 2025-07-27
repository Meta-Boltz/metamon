#!/usr/bin/env node

// Simple test runner for unit tests
const { CompilationModeHandler } = require('./compilation-mode-handler.js');
const { EnhancedMTMCompilerWithModes } = require('./enhanced-compiler-with-modes.js');

function runCompilationModeHandlerTests() {
  console.log('🧪 Testing CompilationModeHandler\n');

  const handler = new CompilationModeHandler();
  let passed = 0;
  let failed = 0;

  const test = (name, fn) => {
    try {
      fn();
      console.log(`✅ ${name}`);
      passed++;
    } catch (error) {
      console.log(`❌ ${name}: ${error.message}`);
      failed++;
    }
  };

  const expect = (actual) => ({
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
    toThrow: (expectedMessage) => {
      try {
        actual();
        throw new Error('Expected function to throw');
      } catch (error) {
        if (expectedMessage && !error.message.includes(expectedMessage)) {
          throw new Error(`Expected error to contain "${expectedMessage}", got "${error.message}"`);
        }
      }
    }
  });

  // Mode resolution tests
  console.log('📋 Mode Resolution Tests:');

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

  // Mode validation tests
  console.log('\n📋 Mode Validation Tests:');

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

  // JavaScript generation tests
  console.log('\n📋 JavaScript Generation Tests:');

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

  // Variable generation tests
  console.log('\n📋 Variable Generation Tests:');

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

  // Function generation tests
  console.log('\n📋 Function Generation Tests:');

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

  // Utility function tests
  console.log('\n📋 Utility Function Tests:');

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

  console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed`);
  return { passed, failed };
}

function runEnhancedCompilerTests() {
  console.log('\n🧪 Testing EnhancedMTMCompilerWithModes\n');

  let passed = 0;
  let failed = 0;

  const test = (name, fn) => {
    try {
      fn();
      console.log(`✅ ${name}`);
      passed++;
    } catch (error) {
      console.log(`❌ ${name}: ${error.message}`);
      failed++;
    }
  };

  const expect = (actual) => ({
    toBe: (expected) => {
      if (actual !== expected) {
        throw new Error(`Expected ${expected}, got ${actual}`);
      }
    },
    toContain: (expected) => {
      if (!actual.includes(expected)) {
        throw new Error(`Expected "${actual}" to contain "${expected}"`);
      }
    },
    toBeDefined: () => {
      if (actual === undefined) {
        throw new Error('Expected value to be defined');
      }
    }
  });

  // Basic functionality tests
  console.log('📋 Basic Functionality Tests:');

  test('should create compiler instance', () => {
    const compiler = new EnhancedMTMCompilerWithModes();
    expect(compiler).toBeDefined();
    expect(compiler.parser).toBeDefined();
    expect(compiler.compilationHandler).toBeDefined();
  });

  test('should generate proper output filenames', () => {
    const compiler = new EnhancedMTMCompilerWithModes();
    expect(compiler.getOutputFilename({ route: '/home' }, 'html')).toBe('home.html');
    expect(compiler.getOutputFilename({ route: '/user/profile' }, 'html')).toBe('user-profile.html');
    expect(compiler.getOutputFilename({ route: '/' }, 'html')).toBe('index.html');
    expect(compiler.getOutputFilename({}, 'html')).toBe('index.html');
  });

  test('should provide compilation statistics', () => {
    const compiler = new EnhancedMTMCompilerWithModes();
    const stats = compiler.getStats();
    expect(stats).toBeDefined();
    expect(stats.routesCount).toBe(0);
    expect(stats.componentsCount).toBe(0);
  });

  console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed`);
  return { passed, failed };
}

async function runAllTests() {
  console.log('🚀 Running MTM Compilation Mode Unit Tests\n');

  const results = {
    compilationModeHandler: runCompilationModeHandlerTests(),
    enhancedCompiler: runEnhancedCompilerTests()
  };

  const totalPassed = results.compilationModeHandler.passed + results.enhancedCompiler.passed;
  const totalFailed = results.compilationModeHandler.failed + results.enhancedCompiler.failed;

  console.log('\n🎯 Overall Test Results:');
  console.log(`✅ Total Passed: ${totalPassed}`);
  console.log(`❌ Total Failed: ${totalFailed}`);
  console.log(`📊 Success Rate: ${Math.round((totalPassed / (totalPassed + totalFailed)) * 100)}%`);

  if (totalFailed === 0) {
    console.log('\n🎉 All tests passed!');
  } else {
    console.log('\n⚠️  Some tests failed. Please review the output above.');
  }

  return totalFailed === 0;
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = { runAllTests };