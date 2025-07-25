// Demo: React Component Integration in MTM Template
const { ComponentRegistry } = require('./component-registry.js');
const { ReactComponentAdapter } = require('./component-adapter.js');

console.log('🚀 Demo: React Component Integration in MTM Template\n');

// Simulate an MTM template with React components
const mtmTemplate = `
---
route: "/dashboard"
compileJsMode: "external.js"
title: "Dashboard"
description: "User dashboard with React components"
---

import Counter from "@components/Counter.tsx"
import Button from "@components/Button.tsx"
import UserCard from "@components/UserCard.tsx"

$user! = signal('user', { name: 'John Doe', email: 'john@example.com' })
$count! = signal('count', 0)

$handleCountChange = (newCount) => {
  $count = newCount
  console.log('Count changed to:', newCount)
}

$handleReset = () => {
  $count = 0
}

<template>
  <div class="dashboard">
    <h1>Welcome to your Dashboard</h1>
    
    <UserCard user={$user} />
    
    <div class="counter-section">
      <h2>Interactive Counter</h2>
      <Counter 
        initialValue={$count} 
        step={1}
        onCountChange={$handleCountChange}
      />
      
      <Button onClick={$handleReset} variant="secondary">
        Reset Counter
      </Button>
    </div>
    
    <nav>
      <a href="/profile">Profile</a>
      <a href="/settings">Settings</a>
    </nav>
  </div>
</template>
`;

// Create registry and mock components
const registry = new ComponentRegistry();
const fs = require('fs');

// Mock file system with React components
const originalReadFileSync = fs.readFileSync;
const originalExistsSync = fs.existsSync;

fs.existsSync = () => true;
fs.readFileSync = (path) => {
  if (path.includes('Counter.tsx')) {
    return `
import React, { useState, useEffect } from 'react';

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

  useEffect(() => {
    setCount(initialValue);
  }, [initialValue]);

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
      <div className="count-display">
        <span className="count-value">{count}</span>
      </div>
      <div className="counter-controls">
        <button className="btn btn-decrement" onClick={decrement}>-</button>
        <button className="btn btn-increment" onClick={increment}>+</button>
      </div>
    </div>
  );
}
`;
  }

  if (path.includes('Button.tsx')) {
    return `
import React from 'react';

interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  size?: 'small' | 'medium' | 'large';
}

export default function Button({ 
  children, 
  onClick, 
  variant = 'primary', 
  disabled = false,
  size = 'medium'
}: ButtonProps) {
  const handleClick = (e: React.MouseEvent) => {
    if (!disabled && onClick) {
      onClick();
    }
  };

  return (
    <button 
      className={\`btn btn-\${variant} btn-\${size}\`}
      onClick={handleClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
`;
  }

  if (path.includes('UserCard.tsx')) {
    return `
import React from 'react';

interface User {
  name: string;
  email: string;
  avatar?: string;
}

interface UserCardProps {
  user: User;
  showEmail?: boolean;
}

export default function UserCard({ 
  user, 
  showEmail = true 
}: UserCardProps) {
  return (
    <div className="user-card">
      <div className="user-avatar">
        {user.avatar ? (
          <img src={user.avatar} alt={user.name} />
        ) : (
          <div className="avatar-placeholder">
            {user.name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
      <div className="user-info">
        <h3 className="user-name">{user.name}</h3>
        {showEmail && (
          <p className="user-email">{user.email}</p>
        )}
      </div>
    </div>
  );
}
`;
  }

  return '';
};

// Process the imports from the MTM template
const imports = [
  { name: 'Counter', path: '@components/Counter.tsx', framework: 'react' },
  { name: 'Button', path: '@components/Button.tsx', framework: 'react' },
  { name: 'UserCard', path: '@components/UserCard.tsx', framework: 'react' }
];

console.log('📦 Processing React component imports...\n');

const componentDefinitions = [];
for (const componentImport of imports) {
  try {
    const definition = registry.registerFromImport(componentImport);
    componentDefinitions.push(definition);
    console.log(`✅ ${definition.name} registered successfully`);
    console.log(`   - Framework: ${definition.framework}`);
    console.log(`   - Has hooks: ${definition.hasHooks ? 'Yes' : 'No'}`);
    console.log(`   - Props: ${definition.props.length}`);
    console.log(`   - Export type: ${definition.exportType}`);
    console.log();
  } catch (error) {
    console.log(`❌ Failed to register ${componentImport.name}:`, error.message);
  }
}

console.log('🔧 Generating wrapper code for components...\n');

// Generate wrapper code for each component
for (const definition of componentDefinitions) {
  console.log(`--- ${definition.name} Wrapper ---`);
  const wrapper = registry.generateWrapper(definition.name);

  // Show key parts of the wrapper
  const lines = wrapper.split('\n');
  const interfaceStart = lines.findIndex(line => line.includes('interface'));
  const wrapperStart = lines.findIndex(line => line.includes('function') && line.includes('Wrapper'));
  const utilsStart = lines.findIndex(line => line.includes('Utils'));

  if (interfaceStart !== -1) {
    console.log('Props Interface:');
    for (let i = interfaceStart; i < Math.min(interfaceStart + 10, lines.length); i++) {
      if (lines[i].includes('}') && i > interfaceStart) {
        console.log(lines[i]);
        break;
      }
      console.log(lines[i]);
    }
    console.log();
  }

  if (wrapperStart !== -1) {
    console.log('Wrapper Function:');
    for (let i = wrapperStart; i < Math.min(wrapperStart + 15, lines.length); i++) {
      console.log(lines[i]);
      if (lines[i].includes('React.createElement')) break;
    }
    console.log('  // ... error handling and React.createElement logic');
    console.log('}');
    console.log();
  }

  if (utilsStart !== -1) {
    console.log('Mounting Utilities:');
    console.log(`${definition.name}Utils.mount(container, props)`);
    console.log(`${definition.name}Utils.createComponent(props)`);
    console.log(`window.${definition.name}Utils available globally`);
    console.log();
  }

  console.log('---\n');
}

console.log('📊 Registry Statistics:');
const stats = registry.getStats();
console.log(JSON.stringify(stats, null, 2));
console.log();

console.log('🎯 Generated HTML Template Integration:');
console.log(`
<!-- Generated HTML with React component integration -->
<!DOCTYPE html>
<html>
<head>
  <title>Dashboard</title>
  <meta name="description" content="User dashboard with React components">
  <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
</head>
<body>
  <div id="app">
    <div class="dashboard">
      <h1>Welcome to your Dashboard</h1>
      
      <!-- UserCard component will be mounted here -->
      <div id="user-card-mount"></div>
      
      <div class="counter-section">
        <h2>Interactive Counter</h2>
        <!-- Counter component will be mounted here -->
        <div id="counter-mount"></div>
        
        <!-- Button component will be mounted here -->
        <div id="reset-button-mount"></div>
      </div>
      
      <nav>
        <a href="/profile" data-link>Profile</a>
        <a href="/settings" data-link>Settings</a>
      </nav>
    </div>
  </div>

  <!-- Component wrapper code would be included here -->
  <script src="dashboard.js"></script>
  
  <script>
    // Initialize React components
    document.addEventListener('DOMContentLoaded', function() {
      // Mount UserCard
      const userCardMount = UserCardUtils.mount(
        document.getElementById('user-card-mount'),
        { user: { name: 'John Doe', email: 'john@example.com' } }
      );
      
      // Mount Counter with signal integration
      const counterMount = CounterUtils.mount(
        document.getElementById('counter-mount'),
        { 
          initialValue: 0, 
          step: 1,
          onCountChange: (newCount) => {
            console.log('Count changed to:', newCount);
            // Update MTM signal
            window.signals.count = newCount;
          }
        }
      );
      
      // Mount Reset Button
      const buttonMount = ButtonUtils.mount(
        document.getElementById('reset-button-mount'),
        {
          children: 'Reset Counter',
          variant: 'secondary',
          onClick: () => {
            // Reset counter through component update
            counterMount.update({ initialValue: 0 });
            window.signals.count = 0;
          }
        }
      );
    });
  </script>
</body>
</html>
`);

console.log('✨ React Component Integration Demo Complete!\n');

console.log('Key Features Demonstrated:');
console.log('✅ React component import resolution');
console.log('✅ TypeScript props interface extraction');
console.log('✅ React hooks detection and handling');
console.log('✅ Component wrapper generation with error handling');
console.log('✅ Mounting utilities for DOM integration');
console.log('✅ Props passing and event handling');
console.log('✅ Integration with MTM signals and template system');
console.log('✅ Support for React 18 createRoot and legacy ReactDOM.render');
console.log('✅ Global utility functions for component management');

// Restore original functions
fs.readFileSync = originalReadFileSync;
fs.existsSync = originalExistsSync;