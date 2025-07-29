// Simple tests for MTM compiler (no Jest required)
const { FinalMTMCompiler } = require('../src/mtm-compiler/final-compiler');
const fs = require('fs');
const path = require('path');

console.log('🧪 Running MTM Compiler Tests...\n');

const compiler = new FinalMTMCompiler();
let passed = 0;
let failed = 0;

// Test 1: Component name extraction
try {
  const source = 'export default function TestComponent() {}';
  const name = compiler.extractComponentName(source);
  if (name === 'TestComponent') {
    console.log('✅ Component name extraction test passed');
    passed++;
  } else {
    console.log('❌ Component name extraction test failed');
    failed++;
  }
} catch (error) {
  console.log('❌ Component name extraction test failed:', error.message);
  failed++;
}

// Test 2: Variable parsing
try {
  const source = `
    export default function Test() {
      $count! = 0
      $message! = "hello"
    }
  `;
  const parsed = compiler.parseSource(source);
  if (parsed.variables.length === 2 &&
    parsed.variables[0].name === 'count' &&
    parsed.variables[1].name === 'message') {
    console.log('✅ Variable parsing test passed');
    passed++;
  } else {
    console.log('❌ Variable parsing test failed');
    failed++;
  }
} catch (error) {
  console.log('❌ Variable parsing test failed:', error.message);
  failed++;
}

// Test 3: Function parsing
try {
  const source = `
    export default function Test() {
      $increment = () => {
        $count++
      }
    }
  `;
  const parsed = compiler.parseSource(source);
  if (parsed.functions.length === 1 &&
    parsed.functions[0].name === 'increment' &&
    parsed.functions[0].body.includes('$count++')) {
    console.log('✅ Function parsing test passed');
    passed++;
  } else {
    console.log('❌ Function parsing test failed');
    failed++;
  }
} catch (error) {
  console.log('❌ Function parsing test failed:', error.message);
  failed++;
}

// Test 4: Template parsing
try {
  const source = `
    export default function Test() {
      <template>
        <div>{$count}</div>
      </template>
    }
  `;
  const parsed = compiler.parseSource(source);
  if (parsed.template.includes('<div>{$count}</div>')) {
    console.log('✅ Template parsing test passed');
    passed++;
  } else {
    console.log('❌ Template parsing test failed');
    failed++;
  }
} catch (error) {
  console.log('❌ Template parsing test failed:', error.message);
  failed++;
}

// Test 5: Full compilation
try {
  const inputFile = path.join(__dirname, '../examples/mtm-components/simple-counter.mtm');
  if (fs.existsSync(inputFile)) {
    const result = compiler.compile(inputFile);
    if (result.includes('<!DOCTYPE html>') &&
      result.includes('SimpleCounter') &&
      result.includes('reactive(0)') &&
      result.includes('$count.value++')) {
      console.log('✅ Full compilation test passed');
      passed++;
    } else {
      console.log('❌ Full compilation test failed');
      failed++;
    }
  } else {
    console.log('⚠️  Full compilation test skipped (file not found)');
  }
} catch (error) {
  console.log('❌ Full compilation test failed:', error.message);
  failed++;
}

console.log(`\n📊 Test Results:`);
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);

if (failed === 0) {
  console.log('\n🎉 All tests passed! MTM compiler is working correctly.');
} else {
  console.log('\n⚠️  Some tests failed. Please check the implementation.');
}