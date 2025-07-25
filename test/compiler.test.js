// Basic tests for MTM compiler
const { FinalMTMCompiler } = require('../src/mtm-compiler/final-compiler');
const fs = require('fs');
const path = require('path');

describe('MTM Compiler', () => {
  const compiler = new FinalMTMCompiler();

  test('should extract component name correctly', () => {
    const source = 'export default function TestComponent() {}';
    const name = compiler.extractComponentName(source);
    expect(name).toBe('TestComponent');
  });

  test('should parse reactive variables', () => {
    const source = `
      export default function Test() {
        $count! = 0
        $message! = "hello"
      }
    `;
    const parsed = compiler.parseSource(source);
    expect(parsed.variables).toHaveLength(2);
    expect(parsed.variables[0]).toEqual({
      name: 'count',
      value: '0',
      type: 'reactive'
    });
    expect(parsed.variables[1]).toEqual({
      name: 'message',
      value: '"hello"',
      type: 'reactive'
    });
  });

  test('should parse functions', () => {
    const source = `
      export default function Test() {
        $increment = () => {
          $count++
        }
      }
    `;
    const parsed = compiler.parseSource(source);
    expect(parsed.functions).toHaveLength(1);
    expect(parsed.functions[0].name).toBe('increment');
    expect(parsed.functions[0].body).toContain('$count++');
  });

  test('should parse template', () => {
    const source = `
      export default function Test() {
        <template>
          <div>{$count}</div>
        </template>
      }
    `;
    const parsed = compiler.parseSource(source);
    expect(parsed.template).toContain('<div>{$count}</div>');
  });

  test('should compile simple counter', () => {
    const inputFile = path.join(__dirname, '../examples/mtm-components/simple-counter.mtm');
    if (fs.existsSync(inputFile)) {
      const result = compiler.compile(inputFile);
      expect(result).toContain('<!DOCTYPE html>');
      expect(result).toContain('SimpleCounter');
      expect(result).toContain('reactive(0)');
      expect(result).toContain('$count.value++');
    }
  });
});

// Simple test runner if Jest is not available
if (require.main === module) {
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

  // Test 2: Simple compilation
  try {
    const inputFile = path.join(__dirname, '../examples/mtm-components/simple-counter.mtm');
    if (fs.existsSync(inputFile)) {
      const result = compiler.compile(inputFile);
      if (result.includes('<!DOCTYPE html>') && result.includes('SimpleCounter')) {
        console.log('✅ Simple compilation test passed');
        passed++;
      } else {
        console.log('❌ Simple compilation test failed');
        failed++;
      }
    } else {
      console.log('⚠️  Simple compilation test skipped (file not found)');
    }
  } catch (error) {
    console.log('❌ Simple compilation test failed:', error.message);
    failed++;
  }

  console.log(`\n📊 Test Results:`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);

  if (failed === 0) {
    console.log('\n🎉 All tests passed!');
  }
}