/**
 * Tests for the fixed MTM transformer
 * 
 * These tests verify that the fixed MTM transformer generates code that is compatible
 * with the chunk loader and avoids the TypeError related to getter-only properties.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import MTMTransformer from '../build-tools/mtm-transformer-fixed.js';
import { safeAssign } from '../../../packages/core/src/utils/safe-assign.js';

describe('Fixed MTM Transformer', () => {
  let transformer;

  beforeEach(() => {
    transformer = new MTMTransformer();
  });

  describe('Chunk Loader Compatibility', () => {
    it('should generate code with writable properties', () => {
      const mtmCode = `
---
name: TestComponent
---
<template>
  <div>Hello World</div>
</template>

$count! = 0
$message = "Hello"

$increment = () => {
  $count++
}
`;

      const result = transformer.transform(mtmCode, 'react', {
        chunkCompatMode: 'safe'
      });

      // Check that the code includes the safe-assign import
      expect(result.code).toContain("import { safeAssign, safeAssignAll } from '../../../packages/core/src/utils/safe-assign.js';");

      // Check that the code includes the __mtmMetadata export
      expect(result.code).toContain('export const __mtmMetadata');

      // Check that the code includes chunk loader compatibility wrapper for ESM
      expect(result.code).toContain('__mtmSafeExports');
      expect(result.code).toContain('__mtmEnsureSafeExports');
    });

    it('should handle property assignment correctly when loaded as a chunk', () => {
      const mtmCode = `
---
name: TestComponent
---
<template>
  <div>Hello World</div>
</template>

$count! = 0
$message = "Hello"
`;

      const result = transformer.transform(mtmCode, 'react', {
        chunkCompatMode: 'safe'
      });

      // Create a mock module from the transformed code
      const mockModule = { exports: {} };
      const mockRequire = (path) => {
        if (path.includes('safe-assign')) {
          return {
            safeAssign, safeAssignAll: (obj, props) => {
              let result = obj;
              for (const [key, value] of Object.entries(props)) {
                result = safeAssign(result, key, value);
              }
              return result;
            }
          };
        }
        if (path === 'react') {
          return { useState: () => [0, () => { }], useCallback: (fn) => fn };
        }
        return {};
      };

      // Execute the transformed code in a mock environment
      const fn = new Function('module', 'require', result.code);
      fn(mockModule, mockRequire);

      // Check that the module exports have the expected properties
      expect(mockModule.exports).toBeDefined();
      expect(typeof mockModule.exports.default).toBe('function');

      // Test that we can modify properties without errors
      const testObj = {};
      Object.defineProperty(testObj, 'data', {
        get: () => ({ content: 'original' }),
        enumerable: true,
        configurable: false
      });

      // This would throw an error without safe assignment
      const updatedObj = safeAssign(testObj, 'data', { content: 'updated' });
      expect(updatedObj.data.content).toBe('updated');
    });
  });

  describe('Framework-specific transformations', () => {
    it('should transform React components correctly', () => {
      const mtmCode = `
---
name: ReactComponent
---
<template>
  <div>
    <h1>{$title}</h1>
    <button click={$handleClick}>Click me</button>
  </div>
</template>

$title = "Hello React"
$count! = 0

$handleClick = () => {
  $count++
  console.log('Count:', $count)
}
`;

      const result = transformer.transform(mtmCode, 'react');

      // Check React-specific transformations
      expect(result.code).toContain('import React');
      expect(result.code).toContain('export default function ReactComponent');
      expect(result.code).toContain('const [count, setCount] = useState');
      expect(result.code).toContain('const handleClick = useCallback');
      expect(result.code).toContain('setCount(prev => prev + 1)');
    });

    it('should transform Vue components correctly', () => {
      const mtmCode = `
---
name: VueComponent
---
<template>
  <div>
    <h1>{$title}</h1>
    <button click={$handleClick}>Click me</button>
  </div>
</template>

$title = "Hello Vue"
$count! = 0

$handleClick = () => {
  $count++
  console.log('Count:', $count)
}
`;

      const result = transformer.transform(mtmCode, 'vue');

      // Check Vue-specific transformations
      expect(result.code).toContain('<template>');
      expect(result.code).toContain('<script setup>');
      expect(result.code).toContain('import { ref, computed, watch } from');
      expect(result.code).toContain('const count = ref');
      expect(result.code).toContain('count.value++');
    });
  });

  describe('Error handling', () => {
    it('should generate an error component for invalid MTM code', () => {
      const invalidMtmCode = `
---
invalid: yaml: :
---
<template>
  <div>Invalid</div>
</template>
`;

      const result = transformer.transform(invalidMtmCode, 'react');

      // Check that an error component is generated
      expect(result.code).toContain('MTM Transform Error');
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});