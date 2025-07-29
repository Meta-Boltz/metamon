// Integration test for React Component with Component Registry
const { ComponentRegistry } = require('./component-registry.js');
const { ReactComponentAdapter } = require('./component-adapter.js');

console.log('🧪 Testing React Component Integration...\n');

// Create a component registry
const registry = new ComponentRegistry();

// Test 1: Registry has React adapter
console.log('Test 1: Registry has React adapter');
const reactAdapter = registry.getAdapter('react');
console.log('React adapter found:', reactAdapter ? '✅' : '❌');
console.log('Adapter framework:', reactAdapter.framework);
console.log();

// Test 2: Register React component from import
console.log('Test 2: Register React component from import');

// Mock a React component import
const componentImport = {
  name: 'Counter',
  path: '@components/Counter.tsx',
  framework: 'react'
};

// Mock file system
const fs = require('fs');
const originalReadFileSync = fs.readFileSync;
const originalExistsSync = fs.existsSync;

fs.existsSync = () => true;
fs.readFileSync = () => `
import React, { useState } from 'react';

interface CounterProps {
  initialValue?: number;
  step?: number;
  onCountChange?: (count: number) => void;
}

export default function Counter({ 
  initialValue = 0, 
  step = 1, 
  onCountChange 
}: CounterProps) {
  const [count, setCount] = useState(initialValue);

  const increment = () => {
    const newCount = count + step;
    setCount(newCount);
    onCountChange?.(newCount);
  };

  const decrement = () => {
    const newCount = count - step;
    setCount(newCount);
    onCountChange?.(newCount);
  };

  return (
    <div className="counter">
      <h2>Count: {count}</h2>
      <button onClick={decrement}>-</button>
      <button onClick={increment}>+</button>
    </div>
  );
}
`;

try {
  const componentDefinition = registry.registerFromImport(componentImport);
  console.log('✅ Component registered successfully');
  console.log('Component details:');
  console.log({
    name: componentDefinition.name,
    framework: componentDefinition.framework,
    isReactComponent: componentDefinition.isReactComponent,
    hasHooks: componentDefinition.hasHooks,
    hasContext: componentDefinition.hasContext,
    exportType: componentDefinition.exportType,
    propsCount: componentDefinition.props.length
  });
  console.log();

  // Test 3: Resolve registered component
  console.log('Test 3: Resolve registered component');
  const resolvedComponent = registry.resolve('Counter');
  console.log('Component resolved:', resolvedComponent ? '✅' : '❌');
  console.log('Resolved component name:', resolvedComponent?.name);
  console.log();

  // Test 4: Generate wrapper code
  console.log('Test 4: Generate wrapper code');
  const wrapperCode = registry.generateWrapper('Counter');
  console.log('Wrapper generated:', wrapperCode ? '✅' : '❌');
  console.log('Wrapper includes props interface:', wrapperCode.includes('interface CounterProps') ? '✅' : '❌');
  console.log('Wrapper includes React.createElement:', wrapperCode.includes('React.createElement') ? '✅' : '❌');
  console.log('Wrapper includes mounting utils:', wrapperCode.includes('CounterUtils') ? '✅' : '❌');
  console.log('Wrapper includes error handling:', wrapperCode.includes('try {') ? '✅' : '❌');
  console.log();

  // Test 5: Registry statistics
  console.log('Test 5: Registry statistics');
  const stats = registry.getStats();
  console.log('Registry stats:', JSON.stringify(stats, null, 2));
  console.log('Has React components:', stats.frameworkCounts.react > 0 ? '✅' : '❌');
  console.log();

  // Test 6: Component validation
  console.log('Test 6: Component validation');
  const validationErrors = registry.validateComponent(componentDefinition);
  console.log('Validation errors:', validationErrors.length);
  console.log('Component is valid:', validationErrors.length === 0 ? '✅' : '❌');
  console.log();

  // Test 7: Multiple React components
  console.log('Test 7: Multiple React components');

  const buttonImport = {
    name: 'Button',
    path: '@components/Button.tsx',
    framework: 'react'
  };

  // Mock Button component
  const originalReadFileSync2 = fs.readFileSync;
  fs.readFileSync = (path) => {
    if (path.includes('Button')) {
      return `
import React from 'react';

interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
}

export default function Button({ 
  children, 
  onClick, 
  variant = 'primary', 
  disabled = false 
}: ButtonProps) {
  return (
    <button 
      className={\`btn btn-\${variant}\`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
`;
    }
    return originalReadFileSync2(path);
  };

  const buttonDefinition = registry.registerFromImport(buttonImport);
  console.log('✅ Second React component registered');
  console.log('Button component has hooks:', buttonDefinition.hasHooks ? '❌' : '✅');
  console.log('Button component props count:', buttonDefinition.props.length);

  const finalStats = registry.getStats();
  console.log('Final component count:', finalStats.totalComponents);
  console.log('React components count:', finalStats.frameworkCounts.react);
  console.log();

  // Test 8: Path resolution
  console.log('Test 8: Path resolution');
  const resolvedPath = registry.resolvePath('@components/Counter.tsx');
  console.log('Path resolved:', resolvedPath.includes('components') ? '✅' : '❌');
  console.log('Resolved path ends with Counter.tsx:', resolvedPath.endsWith('Counter.tsx') ? '✅' : '❌');
  console.log();

  console.log('🎉 React Component Integration tests completed successfully!');

} catch (error) {
  console.log('❌ Integration test failed:', error.message);
  console.log('Stack:', error.stack);
}

// Restore original functions
fs.readFileSync = originalReadFileSync;
fs.existsSync = originalExistsSync;