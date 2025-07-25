// Simple test runner for Enhanced MTM Parser
const { EnhancedMTMParser } = require('../enhanced-parser.js');

function runTests() {
  console.log('🧪 Testing Enhanced MTM Parser\n');

  const parser = new EnhancedMTMParser();
  let passed = 0;
  let failed = 0;

  function test(name, testFn) {
    try {
      testFn();
      console.log(`✓ ${name}`);
      passed++;
    } catch (error) {
      console.log(`✗ ${name}: ${error.message}`);
      failed++;
    }
  }

  function expect(actual) {
    return {
      toEqual: (expected) => {
        if (JSON.stringify(actual) !== JSON.stringify(expected)) {
          throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
        }
      },
      toBe: (expected) => {
        if (actual !== expected) {
          throw new Error(`Expected ${expected}, got ${actual}`);
        }
      },
      toHaveLength: (expected) => {
        if (actual.length !== expected) {
          throw new Error(`Expected length ${expected}, got ${actual.length}`);
        }
      },
      toBeDefined: () => {
        if (actual === undefined) {
          throw new Error('Expected value to be defined');
        }
      },
      toContain: (expected) => {
        if (!actual.includes(expected)) {
          throw new Error(`Expected "${actual}" to contain "${expected}"`);
        }
      }
    };
  }

  // Test frontmatter parsing
  console.log('=== Frontmatter Parsing ===');

  test('should parse basic frontmatter', () => {
    const source = `---
route: "/home"
title: "Home Page"
compileJsMode: "inline"
---

$message! = "Hello World"

<template>
  <h1>{$message}</h1>
</template>`;

    const ast = parser.parse(source, 'home.mtm');

    expect(ast.frontmatter).toEqual({
      route: '/home',
      title: 'Home Page',
      compileJsMode: 'inline'
    });
  });

  test('should handle files without frontmatter', () => {
    const source = `$message! = "Hello World"

<template>
  <h1>{$message}</h1>
</template>`;

    const ast = parser.parse(source, 'simple.mtm');
    expect(ast.frontmatter).toEqual({});
  });

  // Test import parsing
  console.log('\n=== Import Parsing ===');

  test('should parse React component imports', () => {
    const source = `---
route: "/react-page"
---

import Counter from "@components/Counter.tsx"
import Button from "./Button.jsx"

<template>
  <Counter />
  <Button />
</template>`;

    const ast = parser.parse(source, 'react-page.mtm');

    expect(ast.imports).toHaveLength(2);
    expect(ast.imports[0].name).toBe('Counter');
    expect(ast.imports[0].framework).toBe('react');
    expect(ast.imports[1].name).toBe('Button');
    expect(ast.imports[1].framework).toBe('react');
  });

  test('should parse Vue component imports', () => {
    const source = `import VueComponent from "@components/VueComponent.vue"

<template>
  <VueComponent />
</template>`;

    const ast = parser.parse(source, 'vue-page.mtm');

    expect(ast.imports).toHaveLength(1);
    expect(ast.imports[0].name).toBe('VueComponent');
    expect(ast.imports[0].framework).toBe('vue');
  });

  // Test component type detection
  console.log('\n=== Component Type Detection ===');

  test('should detect React components', () => {
    expect(parser.detectComponentType('Component.tsx')).toBe('react');
    expect(parser.detectComponentType('Component.jsx')).toBe('react');
  });

  test('should detect Vue components', () => {
    expect(parser.detectComponentType('Component.vue')).toBe('vue');
  });

  test('should detect Svelte components', () => {
    expect(parser.detectComponentType('Component.svelte')).toBe('svelte');
  });

  test('should detect Solid components', () => {
    expect(parser.detectComponentType('Component.solid.tsx')).toBe('solid');
  });

  // Test path resolution
  console.log('\n=== Path Resolution ===');

  test('should resolve @components/ paths', () => {
    const resolved = parser.resolveComponentPath('@components/Counter.tsx');
    expect(resolved).toBe('src/components/Counter.tsx');
  });

  test('should handle relative paths', () => {
    const resolved = parser.resolveComponentPath('./Counter.tsx');
    expect(resolved).toBe('./Counter.tsx');
  });

  // Test frontmatter validation
  console.log('\n=== Frontmatter Validation ===');

  test('should validate route format', () => {
    const errors1 = parser.validateFrontmatter({ route: '/valid-route' });
    expect(errors1).toHaveLength(0);

    const errors2 = parser.validateFrontmatter({ route: 'invalid-route' });
    expect(errors2).toHaveLength(1);
  });

  test('should validate compileJsMode', () => {
    const errors1 = parser.validateFrontmatter({ compileJsMode: 'inline' });
    expect(errors1).toHaveLength(0);

    const errors2 = parser.validateFrontmatter({ compileJsMode: 'external.js' });
    expect(errors2).toHaveLength(0);

    const errors3 = parser.validateFrontmatter({ compileJsMode: 'invalid' });
    expect(errors3).toHaveLength(1);
  });

  // Test complete parsing
  console.log('\n=== Complete Parsing ===');

  test('should parse a complete MTM file', () => {
    const source = `---
route: "/complete-example"
title: "Complete Example"
compileJsMode: "external.js"
---

import Counter from "@components/Counter.tsx"

$count! = signal('count', 0)

$increment = () => {
  $count = $count + 1
}

<template>
  <div>
    <h1>{title}</h1>
    <Counter count={$count} />
  </div>
</template>`;

    const ast = parser.parse(source, 'complete.mtm');



    expect(ast.frontmatter.route).toBe('/complete-example');
    expect(ast.imports).toHaveLength(1);
    expect(ast.variables).toHaveLength(1);
    expect(ast.functions).toHaveLength(1);
    expect(ast.template).toBeDefined();
  });

  // Summary
  console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed`);

  if (failed === 0) {
    console.log('🎉 All tests passed!');
  } else {
    console.log('❌ Some tests failed');
    process.exit(1);
  }
}

runTests();