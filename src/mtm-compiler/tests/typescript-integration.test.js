// Unit Tests for TypeScript Integration
const { TypeScriptPathResolver } = require('../typescript-path-resolver.js');
const { TypeScriptIntegration } = require('../typescript-integration.js');
const { EnhancedMTMParser } = require('../enhanced-parser.js');
const fs = require('fs');
const path = require('path');

// Mock file system for testing
const mockFiles = new Map();

// Override fs.existsSync and fs.readFileSync for testing
const originalExistsSync = fs.existsSync;
const originalReadFileSync = fs.readFileSync;
const originalStatSync = fs.statSync;

function setupMockFileSystem() {
  fs.existsSync = (filePath) => {
    const resolvedPath = path.resolve(filePath);
    return mockFiles.has(resolvedPath) ||
      mockFiles.has(resolvedPath.replace(/\\/g, '/')) ||
      originalExistsSync(filePath);
  };

  fs.readFileSync = (filePath, encoding) => {
    const resolvedPath = path.resolve(filePath);
    if (mockFiles.has(resolvedPath)) {
      return mockFiles.get(resolvedPath);
    }
    if (mockFiles.has(resolvedPath.replace(/\\/g, '/'))) {
      return mockFiles.get(resolvedPath.replace(/\\/g, '/'));
    }
    return originalReadFileSync(filePath, encoding);
  };

  fs.statSync = (filePath) => {
    const resolvedPath = path.resolve(filePath);
    if (mockFiles.has(resolvedPath) || mockFiles.has(resolvedPath.replace(/\\/g, '/'))) {
      return { isFile: () => true };
    }
    return originalStatSync(filePath);
  };
}

function teardownMockFileSystem() {
  fs.existsSync = originalExistsSync;
  fs.readFileSync = originalReadFileSync;
  fs.statSync = originalStatSync;
  mockFiles.clear();
}

function addMockFile(filePath, content) {
  const resolvedPath = path.resolve(filePath);
  mockFiles.set(resolvedPath, content);
  // Also add with forward slashes for cross-platform compatibility
  mockFiles.set(resolvedPath.replace(/\\/g, '/'), content);
}

// Test Suite
function runTypeScriptIntegrationTests() {
  console.log('🧪 Running TypeScript Integration Tests...\n');

  let passedTests = 0;
  let totalTests = 0;

  function test(name, testFn) {
    totalTests++;
    try {
      console.log(`  Testing: ${name}`);
      testFn();
      console.log(`  ✅ ${name} - PASSED\n`);
      passedTests++;
    } catch (error) {
      console.log(`  ❌ ${name} - FAILED`);
      console.log(`     Error: ${error.message}\n`);
    }
  }

  function assert(condition, message) {
    if (!condition) {
      throw new Error(message || 'Assertion failed');
    }
  }

  function assertEqual(actual, expected, message) {
    if (actual !== expected) {
      throw new Error(message || `Expected ${expected}, got ${actual}`);
    }
  }

  function assertArrayEqual(actual, expected, message) {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
  }

  // Setup mock file system
  setupMockFileSystem();

  // Test TypeScript Path Resolver
  test('TypeScript Path Resolver - Basic Resolution', () => {
    const resolver = new TypeScriptPathResolver({
      baseUrl: '/project',
      paths: {
        '@components/*': ['src/components/*']
      }
    });

    addMockFile('/project/src/components/Button.tsx', 'export default Button;');

    const result = resolver.resolve('@components/Button', '/project/pages/index.mtm');

    assert(result.found, 'Should resolve @components/Button');
    assertEqual(result.framework, 'react', 'Should detect React framework');
    assert(result.isTypeScript, 'Should detect TypeScript file');
  });

  test('TypeScript Path Resolver - Relative Imports', () => {
    const resolver = new TypeScriptPathResolver();

    addMockFile('/project/components/Modal.tsx', 'export default Modal;');

    const result = resolver.resolve('./Modal', '/project/components/Button.tsx');

    assert(result.found, 'Should resolve relative import');
    assertEqual(result.framework, 'react', 'Should detect React framework');
  });

  test('TypeScript Path Resolver - Extension Resolution', () => {
    const resolver = new TypeScriptPathResolver();

    addMockFile('/project/src/utils/helper.ts', 'export const helper = () => {};');

    const result = resolver.resolve('./utils/helper', '/project/src/index.ts');

    assert(result.found, 'Should resolve without extension');
    assert(result.isTypeScript, 'Should detect TypeScript file');
  });

  test('TypeScript Path Resolver - Index File Resolution', () => {
    const resolver = new TypeScriptPathResolver();

    addMockFile('/project/src/components/index.tsx', 'export { default as Button } from "./Button";');

    const result = resolver.resolve('./components', '/project/src/index.ts');

    assert(result.found, 'Should resolve to index file');
    assertEqual(result.framework, 'react', 'Should detect React framework');
  });

  test('TypeScript Path Resolver - Node Module Resolution', () => {
    const resolver = new TypeScriptPathResolver();

    const result = resolver.resolve('react', '/project/src/index.ts');

    assert(result.found, 'Should resolve node module');
    assert(result.isNodeModule, 'Should mark as node module');
    assertEqual(result.metadata.packageName, 'react', 'Should extract package name');
  });

  test('TypeScript Integration - Component Analysis', () => {
    const integration = new TypeScriptIntegration();

    const reactComponent = `
      import React from 'react';
      
      interface ButtonProps {
        label: string;
        onClick?: () => void;
        disabled?: boolean;
      }
      
      const Button: React.FC<ButtonProps> = ({ label, onClick, disabled = false }) => {
        return <button onClick={onClick} disabled={disabled}>{label}</button>;
      };
      
      export default Button;
    `;

    addMockFile('/project/components/Button.tsx', reactComponent);

    const metadata = integration.analyzeComponentTypes('/project/components/Button.tsx', 'react');

    assertEqual(metadata.framework, 'react', 'Should detect React framework');
    assert(metadata.hasTypeScript, 'Should detect TypeScript');
    assertEqual(metadata.props.length, 3, 'Should extract 3 props');

    const labelProp = metadata.props.find(p => p.name === 'label');
    assert(labelProp, 'Should find label prop');
    assertEqual(labelProp.type, 'string', 'Label should be string type');
    assert(labelProp.required, 'Label should be required');

    const disabledProp = metadata.props.find(p => p.name === 'disabled');
    assert(disabledProp, 'Should find disabled prop');
    assert(!disabledProp.required, 'Disabled should be optional');
  });

  test('TypeScript Integration - Vue Component Analysis', () => {
    const integration = new TypeScriptIntegration();

    const vueComponent = `
      <script setup lang="ts">
      interface Props {
        title: string;
        count?: number;
      }
      
      const props = defineProps<Props>();
      const emit = defineEmits<{
        increment: [value: number];
        decrement: [value: number];
      }>();
      </script>
    `;

    addMockFile('/project/components/Counter.vue', vueComponent);

    const metadata = integration.analyzeComponentTypes('/project/components/Counter.vue', 'vue');

    assertEqual(metadata.framework, 'vue', 'Should detect Vue framework');
    assertEqual(metadata.props.length, 2, 'Should extract 2 props');
    assertEqual(metadata.emits.length, 2, 'Should extract 2 emits');

    const titleProp = metadata.props.find(p => p.name === 'title');
    assert(titleProp, 'Should find title prop');
    assertEqual(titleProp.type, 'string', 'Title should be string type');
    assert(titleProp.required, 'Title should be required');
  });

  test('TypeScript Integration - Solid Component Analysis', () => {
    const integration = new TypeScriptIntegration();

    const solidComponent = `
      import { createSignal, createEffect } from 'solid-js';
      
      interface ChartProps {
        data: number[];
        title?: string;
      }
      
      const Chart = (props: ChartProps) => {
        const [selected, setSelected] = createSignal(null);
        
        createEffect(() => {
          console.log('Data changed:', props.data);
        });
        
        return <div>{props.title}</div>;
      };
      
      export default Chart;
    `;

    addMockFile('/project/components/Chart.tsx', solidComponent);

    const metadata = integration.analyzeComponentTypes('/project/components/Chart.tsx', 'solid');

    assertEqual(metadata.framework, 'solid', 'Should detect Solid framework');

    // Debug output
    if (metadata.props.length !== 2) {
      console.log('Expected 2 props, got:', metadata.props.length);
      console.log('Props found:', metadata.props);
    }

    assertEqual(metadata.props.length, 2, 'Should extract 2 props');
    assert(metadata.signals.length > 0, 'Should detect signals');
    assert(metadata.effects.length > 0, 'Should detect effects');
  });

  test('TypeScript Integration - Svelte Component Analysis', () => {
    const integration = new TypeScriptIntegration();

    const svelteComponent = `
      <script lang="ts">
        import { createEventDispatcher } from 'svelte';
        
        export let name: string;
        export let age: number = 0;
        export let active: boolean = false;
        
        const dispatch = createEventDispatcher<{
          select: { name: string; age: number };
          delete: null;
        }>();
        
        let count = 0;
        $: doubled = count * 2;
      </script>
    `;

    addMockFile('/project/components/Person.svelte', svelteComponent);

    const metadata = integration.analyzeComponentTypes('/project/components/Person.svelte', 'svelte');

    assertEqual(metadata.framework, 'svelte', 'Should detect Svelte framework');
    assertEqual(metadata.props.length, 3, 'Should extract 3 props');
    assertEqual(metadata.events.length, 2, 'Should extract 2 events');

    const nameProp = metadata.props.find(p => p.name === 'name');
    assert(nameProp, 'Should find name prop');
    assertEqual(nameProp.type, 'string', 'Name should be string type');
    assert(!nameProp.optional, 'Name should be required');

    const ageProp = metadata.props.find(p => p.name === 'age');
    assert(ageProp, 'Should find age prop');
    assert(ageProp.optional, 'Age should be optional');
    assertEqual(ageProp.default, '0', 'Age should have default value');
  });

  test('Enhanced Parser - TypeScript Integration', () => {
    const resolver = new TypeScriptPathResolver({
      baseUrl: '/project',
      paths: {
        '@components/*': ['src/components/*']
      }
    });

    const parser = new EnhancedMTMParser({
      enableTypeScript: true,
      typeScriptResolver: resolver
    });

    const mtmSource = `
---
route: "/test"
compileJsMode: "external.js"
---

import Button from "@components/Button.tsx"
import Counter from "@components/Counter.vue"

$count! = signal('count', 0)

$handleClick = () => {
  $count++
}

<template>
  <div>
    <h1>Test Page</h1>
    <Button label="Click me" onClick={$handleClick} />
    <Counter title="My Counter" count={$count} />
  </div>
</template>
    `;

    // Setup mock components
    addMockFile('/project/src/components/Button.tsx', `
      interface ButtonProps {
        label: string;
        onClick?: () => void;
      }
      const Button: React.FC<ButtonProps> = ({ label, onClick }) => <button onClick={onClick}>{label}</button>;
      export default Button;
    `);

    addMockFile('/project/src/components/Counter.vue', `
      <script setup lang="ts">
      interface Props {
        title: string;
        count: number;
      }
      defineProps<Props>();
      </script>
    `);

    const ast = parser.parse(mtmSource, '/project/pages/test.mtm');

    assert(ast.enhancedImports, 'Should have enhanced imports');
    assertEqual(ast.enhancedImports.length, 2, 'Should have 2 enhanced imports');

    const buttonImport = ast.enhancedImports.find(imp => imp.name === 'Button');
    assert(buttonImport, 'Should find Button import');
    assert(!buttonImport.error, 'Button import should not have errors');
    assert(buttonImport.hasTypeScript, 'Button should be TypeScript');
    assertEqual(buttonImport.componentMetadata.framework, 'react', 'Button should be React');

    const counterImport = ast.enhancedImports.find(imp => imp.name === 'Counter');
    assert(counterImport, 'Should find Counter import');
    assert(!counterImport.error, 'Counter import should not have errors');
    assertEqual(counterImport.componentMetadata.framework, 'vue', 'Counter should be Vue');
  });

  test('Enhanced Parser - IntelliSense Generation', () => {
    const resolver = new TypeScriptPathResolver({
      baseUrl: '/project',
      paths: {
        '@components/*': ['src/components/*']
      }
    });

    const parser = new EnhancedMTMParser({
      enableTypeScript: true,
      typeScriptResolver: resolver
    });

    const mtmSource = `
---
route: "/intellisense-test"
---

import TestComponent from "@components/TestComponent.tsx"

$testVar! = signal('test', 'hello')
$computedVar = $testVar + ' world'

$testFunction = () => {
  console.log('test');
}

<template>
  <TestComponent prop1="value" />
</template>
    `;

    addMockFile('/project/src/components/TestComponent.tsx', `
      interface TestComponentProps {
        prop1: string;
        prop2?: number;
      }
      const TestComponent: React.FC<TestComponentProps> = (props) => <div>{props.prop1}</div>;
      export default TestComponent;
    `);

    const ast = parser.parse(mtmSource, '/project/pages/intellisense.mtm');
    const intelliSense = parser.generateIntelliSenseInfo(ast, '/project/pages/intellisense.mtm');

    assert(intelliSense.components.length > 0, 'Should have component information');
    assert(intelliSense.variables.length > 0, 'Should have variable information');
    assert(intelliSense.functions.length > 0, 'Should have function information');
    assert(intelliSense.completions.length > 0, 'Should have completions');

    const testComponent = intelliSense.components.find(c => c.name === 'TestComponent');
    assert(testComponent, 'Should find TestComponent');
    assertEqual(testComponent.props.length, 2, 'Should have 2 props');

    const prop1Completion = intelliSense.completions.find(c => c.label === 'prop1' && c.component === 'TestComponent');
    assert(prop1Completion, 'Should have prop1 completion');
    assertEqual(prop1Completion.kind, 'Property', 'Should be property completion');
  });

  test('TypeScript Integration - Error Handling', () => {
    const integration = new TypeScriptIntegration();

    const imports = [
      {
        name: 'NonExistentComponent',
        path: '@components/NonExistent.tsx',
        framework: 'react',
        line: 5
      }
    ];

    const enhancedImports = integration.analyzeComponentImports(imports, '/project/test.mtm');
    const errors = integration.validateImports(enhancedImports, '/project/test.mtm');

    assert(enhancedImports.length === 1, 'Should have 1 enhanced import');
    assert(enhancedImports[0].error, 'Should have import error');
    assert(errors.length > 0, 'Should have validation errors');
  });

  test('TypeScript Integration - Declaration Generation', () => {
    const integration = new TypeScriptIntegration({
      generateDeclarations: true
    });

    const componentInfo = {
      name: 'TestPage',
      framework: 'react'
    };

    const enhancedImports = [
      {
        name: 'Button',
        hasTypeDefinitions: true,
        componentMetadata: {
          props: [
            { name: 'label', type: 'string', optional: false },
            { name: 'onClick', type: '() => void', optional: true }
          ]
        },
        resolved: { resolvedPath: '/components/Button.tsx' }
      }
    ];

    const declaration = integration.generateDeclarationFile(componentInfo, enhancedImports);

    assert(declaration.includes('interface TestPageProps'), 'Should include props interface');
    assert(declaration.includes('label: string'), 'Should include required prop');
    assert(declaration.includes('onClick?: () => void'), 'Should include optional prop');
    assert(declaration.includes('declare const TestPage'), 'Should include component declaration');
  });

  // Cleanup
  teardownMockFileSystem();

  // Results
  console.log(`\n📊 TypeScript Integration Test Results:`);
  console.log(`   Passed: ${passedTests}/${totalTests}`);
  console.log(`   Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

  if (passedTests === totalTests) {
    console.log(`   🎉 All tests passed!\n`);
  } else {
    console.log(`   ⚠️  ${totalTests - passedTests} test(s) failed.\n`);
  }

  return passedTests === totalTests;
}

// Export for use in other test files
module.exports = { runTypeScriptIntegrationTests };

// Run tests if this file is executed directly
if (require.main === module) {
  runTypeScriptIntegrationTests();
}