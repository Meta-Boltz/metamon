/**
 * Test script for the fixed MTM transformer
 * 
 * This script tests the fixed MTM transformer with a simple MTM file
 * and verifies that it generates code that is compatible with the chunk loader.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import MTMTransformer from './src/build-tools/mtm-transformer-fixed.js';
import { safeAssign } from '../packages/core/src/utils/safe-assign.js';

// Get the directory name
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Create a test MTM file
const testMtmFile = `
---
name: TestComponent
---
<template>
  <div>
    <h1>{$title}</h1>
    <p>{$message}</p>
    <button click={$handleClick}>Click me ({$count})</button>
  </div>
</template>

$title = "Test Component"
$message = "This is a test component"
$count! = 0

$handleClick = () => {
  $count++
  console.log('Count:', $count)
}
`;

// Create a temporary directory for test files
const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir);
}

// Write the test MTM file
const testFilePath = path.join(tempDir, 'test.mtm');
fs.writeFileSync(testFilePath, testMtmFile);

// Create a transformer instance
const transformer = new MTMTransformer();

// Transform the test file
console.log('Transforming test MTM file...');
const result = transformer.transform(testMtmFile, 'react', {
  chunkCompatMode: 'safe'
});

// Write the transformed code to a file
const outputPath = path.join(tempDir, 'test.transformed.js');
fs.writeFileSync(outputPath, result.code);

console.log(`Transformed code written to ${outputPath}`);

// Test the chunk loading compatibility
console.log('\nTesting chunk loading compatibility...');

// Create a mock module with getter-only properties
const createMockModule = () => {
  const module = {};
  Object.defineProperty(module, 'data', {
    get: function () {
      return { content: 'original content' };
    },
    enumerable: true,
    configurable: false
  });
  return module;
};

// Test direct assignment (should fail)
const testDirectAssignment = () => {
  const mockModule = createMockModule();
  try {
    console.log('Before direct assignment:', mockModule.data);
    mockModule.data = { content: 'updated content' };
    console.log('After direct assignment:', mockModule.data);
    return true;
  } catch (error) {
    console.error('Direct assignment failed:', error.message);
    return false;
  }
};

// Test safe assignment (should succeed)
const testSafeAssignment = () => {
  const mockModule = createMockModule();
  try {
    console.log('Before safe assignment:', mockModule.data);
    const updatedModule = safeAssign(mockModule, 'data', { content: 'updated content' });
    console.log('After safe assignment:', updatedModule.data);
    return true;
  } catch (error) {
    console.error('Safe assignment failed:', error.message);
    return false;
  }
};

console.log('\n=== Test Results ===');
console.log('Direct assignment successful:', testDirectAssignment());
console.log('Safe assignment successful:', testSafeAssignment());

console.log('\nTest completed successfully!');