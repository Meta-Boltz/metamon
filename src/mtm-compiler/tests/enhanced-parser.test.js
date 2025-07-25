// Unit tests for Enhanced MTM Parser
const { EnhancedMTMParser } = require('../enhanced-parser.js');

describe('EnhancedMTMParser', () => {
  let parser;

  beforeEach(() => {
    parser = new EnhancedMTMParser();
  });

  describe('Frontmatter parsing', () => {
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

    test('should handle frontmatter with quotes', () => {
      const source = `---
route: "/about"
title: "About Us"
description: 'This is the about page'
---

<template>
  <h1>About</h1>
</template>`;

      const ast = parser.parse(source, 'about.mtm');

      expect(ast.frontmatter).toEqual({
        route: '/about',
        title: 'About Us',
        description: 'This is the about page'
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

    test('should ignore comments in frontmatter', () => {
      const source = `---
# This is a comment
route: "/test"
# Another comment
title: "Test Page"
---

<template>
  <h1>Test</h1>
</template>`;

      const ast = parser.parse(source, 'test.mtm');

      expect(ast.frontmatter).toEqual({
        route: '/test',
        title: 'Test Page'
      });
    });
  });

  describe('Import parsing', () => {
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
      expect(ast.imports[0]).toEqual({
        type: 'IMPORT',
        name: 'Counter',
        path: '@components/Counter.tsx',
        framework: 'react',
        line: 5
      });
      expect(ast.imports[1]).toEqual({
        type: 'IMPORT',
        name: 'Button',
        path: './Button.jsx',
        framework: 'react',
        line: 6
      });
    });

    test('should parse Vue component imports', () => {
      const source = `import VueComponent from "@components/VueComponent.vue"

<template>
  <VueComponent />
</template>`;

      const ast = parser.parse(source, 'vue-page.mtm');

      expect(ast.imports).toHaveLength(1);
      expect(ast.imports[0]).toEqual({
        type: 'IMPORT',
        name: 'VueComponent',
        path: '@components/VueComponent.vue',
        framework: 'vue',
        line: 1
      });
    });

    test('should parse Svelte component imports', () => {
      const source = `import SvelteComponent from "@components/SvelteComponent.svelte"

<template>
  <SvelteComponent />
</template>`;

      const ast = parser.parse(source, 'svelte-page.mtm');

      expect(ast.imports).toHaveLength(1);
      expect(ast.imports[0]).toEqual({
        type: 'IMPORT',
        name: 'SvelteComponent',
        path: '@components/SvelteComponent.svelte',
        framework: 'svelte',
        line: 1
      });
    });

    test('should parse Solid component imports', () => {
      const source = `import SolidComponent from "@components/SolidComponent.solid.tsx"

<template>
  <SolidComponent />
</template>`;

      const ast = parser.parse(source, 'solid-page.mtm');

      expect(ast.imports).toHaveLength(1);
      expect(ast.imports[0]).toEqual({
        type: 'IMPORT',
        name: 'SolidComponent',
        path: '@components/SolidComponent.solid.tsx',
        framework: 'solid',
        line: 1
      });
    });
  });

  describe('Component type detection', () => {
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
      expect(parser.detectComponentType('solid/Component.tsx')).toBe('solid');
    });

    test('should return unknown for unrecognized types', () => {
      expect(parser.detectComponentType('Component.js')).toBe('unknown');
      expect(parser.detectComponentType('Component.ts')).toBe('unknown');
    });
  });

  describe('Path resolution', () => {
    test('should resolve @components/ paths', () => {
      const resolved = parser.resolveComponentPath('@components/Counter.tsx');
      expect(resolved).toBe('src/components/Counter.tsx');
    });

    test('should handle relative paths', () => {
      const resolved1 = parser.resolveComponentPath('./Counter.tsx');
      const resolved2 = parser.resolveComponentPath('../shared/Button.tsx');

      expect(resolved1).toBe('./Counter.tsx');
      expect(resolved2).toBe('../shared/Button.tsx');
    });

    test('should handle absolute paths', () => {
      const resolved = parser.resolveComponentPath('components/Counter.tsx');
      expect(resolved).toBe('components/Counter.tsx');
    });
  });

  describe('Frontmatter validation', () => {
    test('should validate route format', () => {
      const errors1 = parser.validateFrontmatter({ route: '/valid-route' });
      expect(errors1).toHaveLength(0);

      const errors2 = parser.validateFrontmatter({ route: 'invalid-route' });
      expect(errors2).toHaveLength(1);
      expect(errors2[0].type).toBe('frontmatter-validation');
      expect(errors2[0].field).toBe('route');
    });

    test('should validate compileJsMode', () => {
      const errors1 = parser.validateFrontmatter({ compileJsMode: 'inline' });
      expect(errors1).toHaveLength(0);

      const errors2 = parser.validateFrontmatter({ compileJsMode: 'external.js' });
      expect(errors2).toHaveLength(0);

      const errors3 = parser.validateFrontmatter({ compileJsMode: 'custom.js' });
      expect(errors3).toHaveLength(0);

      const errors4 = parser.validateFrontmatter({ compileJsMode: 'invalid' });
      expect(errors4).toHaveLength(1);
      expect(errors4[0].type).toBe('frontmatter-validation');
      expect(errors4[0].field).toBe('compileJsMode');
    });
  });

  describe('Complete parsing', () => {
    test('should parse a complete MTM file with all features', () => {
      const source = `---
route: "/complete-example"
title: "Complete Example"
compileJsMode: "external.js"
description: "A complete example with all features"
---

import Counter from "@components/Counter.tsx"
import VueButton from "@components/VueButton.vue"

$count! = signal('count', 0)
$message = "Current count: " + $count

$increment = () => {
  $count = $count + 1
}

<template>
  <div class="complete-example">
    <h1>{title}</h1>
    <p>{$message}</p>
    <Counter count={$count} onIncrement={$increment} />
    <VueButton onClick={$increment} />
    <nav>
      <a href="/home">Home</a>
      <a href="/about">About</a>
    </nav>
  </div>
</template>`;

      const ast = parser.parse(source, 'complete.mtm');

      // Check frontmatter
      expect(ast.frontmatter).toEqual({
        route: '/complete-example',
        title: 'Complete Example',
        compileJsMode: 'external.js',
        description: 'A complete example with all features'
      });

      // Check imports
      expect(ast.imports).toHaveLength(2);
      expect(ast.imports[0].name).toBe('Counter');
      expect(ast.imports[0].framework).toBe('react');
      expect(ast.imports[1].name).toBe('VueButton');
      expect(ast.imports[1].framework).toBe('vue');

      // Check variables
      expect(ast.variables).toHaveLength(2);
      expect(ast.variables[0].type).toBe('reactive');
      expect(ast.variables[0].name).toBe('count');
      expect(ast.variables[1].type).toBe('computed');
      expect(ast.variables[1].name).toBe('message');

      // Check functions
      expect(ast.functions).toHaveLength(1);
      expect(ast.functions[0].name).toBe('increment');

      // Check template
      expect(ast.template).toBeDefined();
      expect(ast.template.content).toContain('<div class="complete-example">');
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
  });
}

module.exports = { EnhancedMTMParser };