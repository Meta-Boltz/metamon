/**
 * Test script to verify the enhanced MTM plugin functionality
 */

import { mtmPlugin } from './src/mtm-plugin.js';
import { readFileSync } from 'fs';

// Create plugin instance
const plugin = mtmPlugin({
  include: ['**/*.mtm'],
  hmr: true,
  sourceMaps: true
});

console.log('🧪 Testing Enhanced MTM Plugin');
console.log('================================');

// Test 1: Basic frontmatter parsing
console.log('\n1. Testing frontmatter parsing...');
const basicCode = `---
route: /test
title: Test Page
description: A test page
keywords: [test, page]
status: 200
---

<div class="test-page">
  <h1>Test Content</h1>
  <p>This is a test page.</p>
</div>`;

try {
  const parsed = plugin.parseFrontmatter(basicCode, '/test.mtm');
  console.log('✅ Frontmatter parsed successfully:');
  console.log('   Route:', parsed.frontmatter.route);
  console.log('   Title:', parsed.frontmatter.title);
  console.log('   Keywords:', parsed.frontmatter.keywords);
  console.log('   Errors:', parsed.errors.length);
} catch (error) {
  console.log('❌ Frontmatter parsing failed:', error.message);
}

// Test 2: Page transformation
console.log('\n2. Testing page transformation...');
try {
  const parsed = plugin.parseFrontmatter(basicCode, '/pages/test.mtm');
  const transformed = plugin.transformPageToSSR(parsed, '/pages/test.mtm');
  console.log('✅ Page transformation successful');
  console.log('   Contains route export:', transformed.includes('export const route'));
  console.log('   Contains renderPage function:', transformed.includes('export function renderPage'));
  console.log('   Contains signal import:', transformed.includes('import { signal }'));
} catch (error) {
  console.log('❌ Page transformation failed:', error.message);
}

// Test 3: Component transformation
console.log('\n3. Testing component transformation...');
const componentCode = `---
name: TestComponent
target: react
description: A test React component
---

<div className="test-component">
  <h2>Component Content</h2>
</div>`;

try {
  const parsed = plugin.parseFrontmatter(componentCode, '/components/test.mtm');
  const transformed = plugin.transformComponent(parsed, 'react', '/components/test.mtm');
  console.log('✅ Component transformation successful');
  console.log('   Contains React import:', transformed.includes('import React'));
  console.log('   Contains component function:', transformed.includes('export default function'));
  console.log('   Contains component name:', transformed.includes('TestComponent'));
} catch (error) {
  console.log('❌ Component transformation failed:', error.message);
}

// Test 4: Error handling
console.log('\n4. Testing error handling...');
const malformedCode = `---
route: /malformed
invalid line without colon
: empty key
---
Content`;

try {
  const parsed = plugin.parseFrontmatter(malformedCode, '/test.mtm');
  console.log('✅ Error handling working:');
  console.log('   Errors found:', parsed.errors.length);
  console.log('   Route still parsed:', parsed.frontmatter.route);
  if (parsed.errors.length > 0) {
    console.log('   First error:', parsed.errors[0].message);
    console.log('   Suggestion:', parsed.errors[0].suggestion);
  }
} catch (error) {
  console.log('❌ Error handling failed:', error.message);
}

// Test 5: Value parsing
console.log('\n5. Testing value parsing...');
try {
  console.log('✅ Value parsing tests:');
  console.log('   String:', plugin.parseValue('"hello world"'));
  console.log('   Number:', plugin.parseValue('42'));
  console.log('   Boolean:', plugin.parseValue('true'));
  console.log('   Array:', plugin.parseValue('[1, 2, 3]'));
  console.log('   Object:', plugin.parseValue('{"key": "value"}'));
} catch (error) {
  console.log('❌ Value parsing failed:', error.message);
}

// Test 6: Framework detection
console.log('\n6. Testing framework detection...');
try {
  console.log('✅ Framework detection tests:');
  console.log('   React file:', plugin.detectFramework({}, '/components/test.react.mtm'));
  console.log('   Vue file:', plugin.detectFramework({}, '/components/test.vue.mtm'));
  console.log('   Page file:', plugin.detectFramework({}, '/pages/test.mtm'));
  console.log('   Target override:', plugin.detectFramework({ target: 'svelte' }, '/test.mtm'));
} catch (error) {
  console.log('❌ Framework detection failed:', error.message);
}

console.log('\n🎉 Enhanced MTM Plugin testing completed!');
console.log('================================');