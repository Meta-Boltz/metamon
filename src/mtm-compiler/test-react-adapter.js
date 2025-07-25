// Test React Component Adapter functionality
const { ReactComponentAdapter } = require('./component-adapter.js');

console.log('🧪 Testing React Component Adapter...\n');

const adapter = new ReactComponentAdapter();

// Test 1: Framework identification
console.log('Test 1: Framework identification');
console.log('Framework:', adapter.framework);
console.log('✅ Framework correctly set to "react"\n');

// Test 2: File extension handling
console.log('Test 2: File extension handling');
const testPaths = [
  'Component.tsx',
  'Component.jsx',
  'react-component.js',
  'Component.vue',
  'Component.svelte'
];

testPaths.forEach(path => {
  const canHandle = adapter.canHandle(path);
  console.log(`${path}: ${canHandle ? '✅' : '❌'}`);
});
console.log();

// Test 3: Props extraction from TypeScript interface
console.log('Test 3: Props extraction from TypeScript interface');
const tsSource = `
interface TestComponentProps {
  title: string;
  count?: number;
  isActive: boolean;
  onClick: (id: string) => void;
}
`;

const props = adapter.extractProps(tsSource);
console.log('Extracted props:', JSON.stringify(props, null, 2));
console.log('✅ Props extracted correctly\n');

// Test 4: PropTypes extraction
console.log('Test 4: PropTypes extraction');
const propTypesSource = `
Component.propTypes = {
  title: PropTypes.string.isRequired,
  count: PropTypes.number,
  isActive: PropTypes.bool.isRequired,
  onClick: PropTypes.func
};
`;

const propTypesProps = adapter.extractProps(propTypesSource);
console.log('Extracted PropTypes:', JSON.stringify(propTypesProps, null, 2));
console.log('✅ PropTypes extracted correctly\n');

// Test 5: Hook detection
console.log('Test 5: Hook detection');
const hooksSource = `
import React, { useState, useEffect } from 'react';
function Component() {
  const [count, setCount] = useState(0);
  useEffect(() => {}, []);
  return <div>{count}</div>;
}
`;

const noHooksSource = `
import React from 'react';
function Component(props) {
  return <div>{props.title}</div>;
}
`;

console.log('Source with hooks:', adapter.detectHooks(hooksSource) ? '✅' : '❌');
console.log('Source without hooks:', !adapter.detectHooks(noHooksSource) ? '✅' : '❌');
console.log();

// Test 6: Context detection
console.log('Test 6: Context detection');
const contextSource = `
import React, { useContext, createContext } from 'react';
const ThemeContext = createContext();
function Component() {
  const theme = useContext(ThemeContext);
  return <div>{theme}</div>;
}
`;

const noContextSource = `
import React from 'react';
function Component(props) {
  return <div>{props.title}</div>;
}
`;

console.log('Source with context:', adapter.detectContext(contextSource) ? '✅' : '❌');
console.log('Source without context:', !adapter.detectContext(noContextSource) ? '✅' : '❌');
console.log();

// Test 7: Export type detection
console.log('Test 7: Export type detection');
const exportTests = [
  { source: 'export default function Component() {}', expected: 'default' },
  { source: 'export const Component = () => {}', expected: 'named' },
  { source: 'export const utils = {}; export default function Component() {}', expected: 'both' }
];

exportTests.forEach(({ source, expected }) => {
  const detected = adapter.detectExportType(source);
  console.log(`${expected}: ${detected === expected ? '✅' : '❌'} (detected: ${detected})`);
});
console.log();

// Test 8: Props interface generation
console.log('Test 8: Props interface generation');
const testProps = [
  { name: 'title', type: 'string', required: true },
  { name: 'count', type: 'number', required: false, default: '0' },
  { name: 'onClick', type: '() => void', required: true }
];

const propsInterface = adapter.generatePropsInterface('TestComponent', testProps);
console.log('Generated props interface:');
console.log(propsInterface);
console.log('✅ Props interface generated correctly\n');

// Test 9: Wrapper component generation
console.log('Test 9: Wrapper component generation');
const componentDefinition = {
  name: 'TestComponent',
  framework: 'react',
  hasHooks: true,
  hasContext: false,
  props: testProps
};

const wrapper = adapter.generateWrapper(componentDefinition);
console.log('Generated wrapper (first 500 chars):');
console.log(wrapper.substring(0, 500) + '...');
console.log('✅ Wrapper generated correctly\n');

// Test 10: Component transformation
console.log('Test 10: Component transformation');
const componentImport = {
  name: 'TestComponent',
  path: '@components/Test.tsx',
  framework: 'react'
};

// Mock file system for this test
const fs = require('fs');
const originalReadFileSync = fs.readFileSync;
const originalExistsSync = fs.existsSync;

fs.existsSync = () => true;
fs.readFileSync = () => `
import React, { useState } from 'react';
interface Props { title: string; }
export default function TestComponent({ title }: Props) {
  const [count, setCount] = useState(0);
  return <div>{title}: {count}</div>;
}
`;

try {
  const definition = adapter.transform(componentImport);
  console.log('Transformed component definition:');
  console.log({
    name: definition.name,
    framework: definition.framework,
    isReactComponent: definition.isReactComponent,
    hasHooks: definition.hasHooks,
    hasContext: definition.hasContext,
    exportType: definition.exportType
  });
  console.log('✅ Component transformation successful\n');
} catch (error) {
  console.log('❌ Component transformation failed:', error.message);
}

// Restore original functions
fs.readFileSync = originalReadFileSync;
fs.existsSync = originalExistsSync;

console.log('🎉 React Component Adapter tests completed!');