#!/usr/bin/env node

/**
 * Demonstration of MTM Error Handling System
 * Shows how errors are caught, formatted, and provide helpful suggestions
 */

const {
  CompilationError,
  RuntimeError,
  ErrorHandler,
  ComponentErrorBoundary
} = require('./error-handling.js');

const { EnhancedMTMParser } = require('./enhanced-parser.js');
const { RouteRegistry } = require('./route-registry.js');

console.log('🎭 MTM Error Handling System Demo');
console.log('==================================\n');

// Create a global error handler
const errorHandler = new ErrorHandler();

// Register custom error handlers
errorHandler.registerHandler('compilation-route-conflict', (error) => {
  console.log('🚨 Route Conflict Handler: Detected conflicting routes!');
});

errorHandler.registerHandler('compilation-import-resolution', (error) => {
  console.log('🔍 Import Resolution Handler: Component not found!');
});

console.log('1. 📝 Demonstrating Route Conflicts\n');

try {
  const registry = new RouteRegistry();

  // Register first route
  registry.register('/home', { file: 'pages/home.mtm' });
  console.log('✓ Registered route: /home -> pages/home.mtm');

  // Try to register conflicting route
  registry.register('/home', { file: 'pages/another-home.mtm' });

} catch (error) {
  console.log('\n❌ Route Conflict Detected:');
  console.log(error.getFormattedMessage());
  errorHandler.handleError(error);
}

console.log('\n2. 🔗 Demonstrating Import Resolution Errors\n');

try {
  const parser = new EnhancedMTMParser();

  // Try to resolve a non-existent component
  parser.resolveAndValidateComponentPath(
    '@components/NonExistentComponent.tsx',
    process.cwd(),
    'pages/test.mtm',
    15
  );

} catch (error) {
  console.log('❌ Import Resolution Error:');
  console.log(error.getFormattedMessage());
  errorHandler.handleError(error);
}

console.log('\n3. ⚙️ Demonstrating Frontmatter Validation\n');

try {
  const parser = new EnhancedMTMParser();

  const invalidFrontmatter = {
    route: 'missing-leading-slash',
    compileJsMode: 'invalid-mode',
    title: 'Test Page'
  };

  const errors = parser.validateFrontmatter(invalidFrontmatter, 'pages/invalid.mtm');

  if (errors.length > 0) {
    console.log('❌ Frontmatter Validation Errors:');
    errors.forEach((error, index) => {
      console.log(`\n${index + 1}. ${error.getFormattedMessage()}`);
      errorHandler.handleError(error);
    });
  }

} catch (error) {
  console.log('❌ Validation Error:', error.message);
}

console.log('\n4. 🎯 Demonstrating Runtime Errors\n');

// Component mounting error
const mountError = RuntimeError.componentMount(
  'UserProfile',
  'React is not defined',
  {
    props: { userId: 123 },
    framework: 'react'
  }
);

console.log('❌ Component Mount Error:');
console.log(mountError.getFormattedMessage());
errorHandler.handleError(mountError);

// Navigation error
const navError = RuntimeError.navigation(
  '/non-existent-page',
  'Route not registered',
  {
    currentPath: '/home',
    attemptedNavigation: 'programmatic'
  }
);

console.log('\n❌ Navigation Error:');
console.log(navError.getFormattedMessage());
errorHandler.handleError(navError);

console.log('\n5. 🛡️ Demonstrating Component Error Boundary\n');

// Create error boundary with custom fallback
const customFallback = (error, props) => {
  return `
    <div class="custom-error-fallback">
      <h3>Oops! Something went wrong with the component</h3>
      <p>Error: ${error.message}</p>
      <p>Props: ${JSON.stringify(props)}</p>
      <button onclick="location.reload()">Reload Page</button>
    </div>
  `;
};

const boundary = new ComponentErrorBoundary('UserDashboard', customFallback);

// Simulate successful render
console.log('✓ Successful component render:');
const successResult = boundary.tryRender(
  (props) => `<div>Welcome, ${props.username}!</div>`,
  { username: 'John Doe' }
);
console.log(successResult);

// Simulate failed render
console.log('\n❌ Failed component render:');
const failResult = boundary.tryRender(
  (props) => {
    throw new Error('Component crashed due to invalid props');
  },
  { invalidProp: null }
);
console.log(failResult);

console.log('\n6. 📊 Error Handler Summary\n');

const summary = errorHandler.getSummary();
console.log(`Total Errors: ${summary.errorCount}`);
console.log(`Total Warnings: ${summary.warningCount}`);

console.log('\nError Breakdown:');
const errorTypes = {};
summary.errors.forEach(error => {
  errorTypes[error.type] = (errorTypes[error.type] || 0) + 1;
});

Object.entries(errorTypes).forEach(([type, count]) => {
  console.log(`  ${type}: ${count}`);
});

console.log('\n7. 🔧 Demonstrating Error Recovery\n');

// Show how errors can be used for recovery
console.log('Attempting to recover from import resolution error...');

try {
  const parser = new EnhancedMTMParser();
  parser.resolveAndValidateComponentPath('@components/Button.tsx', process.cwd(), 'test.mtm', 5);
} catch (error) {
  if (error.type === 'compilation-import-resolution') {
    console.log('🔄 Recovery Strategy:');
    console.log('  1. Checking alternative paths...');

    // Try alternative paths based on suggestions
    const alternativePaths = [
      'src/components/Button.jsx',
      'src/components/Button/index.tsx',
      'src/ui/Button.tsx'
    ];

    console.log('  2. Alternative paths to try:');
    alternativePaths.forEach(path => {
      console.log(`     - ${path}`);
    });

    console.log('  3. Fallback: Use default button component');
  }
}

console.log('\n8. 🎨 Demonstrating Error Formatting\n');

// Show different error formatting options
const complexError = CompilationError.importResolution(
  '@components/ComplexComponent.tsx',
  'pages/dashboard.mtm',
  25,
  [
    'src/components/ComplexComponent.tsx',
    'src/components/ComplexComponent/index.tsx',
    'src/components/Complex/Component.tsx'
  ]
);

console.log('Standard formatting:');
console.log(complexError.getFormattedMessage());

console.log('\nJSON formatting:');
console.log(JSON.stringify(complexError.toJSON(), null, 2));

console.log('\n9. 🌐 Real-World Scenario Simulation\n');

// Simulate a complete compilation process with multiple errors
console.log('Simulating compilation of a complex MTM file...');

const mtmSource = `---
route: "invalid-route-format"
compileJsMode: "unknown-mode"
title: "Dashboard"
---

import UserCard from "@components/UserCard.tsx"
import NonExistent from "@components/DoesNotExist.vue"
import AnotherMissing from "./relative/Missing.svelte"

$user! = signal('user', { name: 'John' })
$invalid syntax here

<template>
  <div class="dashboard">
    <h1>{title}</h1>
    <UserCard user={$user} />
    <NonExistent />
    <AnotherMissing />
  </div>
</template>`;

try {
  const parser = new EnhancedMTMParser();
  const ast = parser.parse(mtmSource, 'pages/dashboard.mtm');

  // Validate frontmatter
  const frontmatterErrors = parser.validateFrontmatter(ast.frontmatter, 'pages/dashboard.mtm');
  frontmatterErrors.forEach(error => errorHandler.handleError(error));

  // Validate imports
  ast.imports.forEach(importInfo => {
    try {
      parser.resolveAndValidateComponentPath(
        importInfo.path,
        process.cwd(),
        'pages/dashboard.mtm',
        importInfo.line
      );
    } catch (error) {
      errorHandler.handleError(error);
    }
  });

} catch (error) {
  console.log('❌ Parse Error:', error.message);
}

console.log('\n📈 Final Error Report\n');

const finalSummary = errorHandler.getSummary();
console.log(`Total Issues Found: ${finalSummary.errorCount + finalSummary.warningCount}`);
console.log(`Errors: ${finalSummary.errorCount}`);
console.log(`Warnings: ${finalSummary.warningCount}`);

if (finalSummary.errorCount > 0) {
  console.log('\n🚨 Critical Issues (must be fixed):');
  finalSummary.errors.forEach((error, index) => {
    console.log(`${index + 1}. [${error.type}] ${error.message}`);
    if (error.context.file) {
      console.log(`   File: ${error.context.file}`);
    }
    if (error.context.line) {
      console.log(`   Line: ${error.context.line}`);
    }
  });
}

if (finalSummary.warningCount > 0) {
  console.log('\n⚠️ Warnings (should be addressed):');
  finalSummary.warnings.forEach((warning, index) => {
    console.log(`${index + 1}. [${warning.type}] ${warning.message}`);
  });
}

console.log('\n✨ Demo Complete!');
console.log('\nThe MTM Error Handling System provides:');
console.log('  ✓ Detailed error messages with context');
console.log('  ✓ Helpful suggestions for fixing issues');
console.log('  ✓ Recovery actions for runtime errors');
console.log('  ✓ Component error boundaries for graceful degradation');
console.log('  ✓ Comprehensive error tracking and reporting');
console.log('  ✓ Integration with all MTM compiler components');

process.exit(0);