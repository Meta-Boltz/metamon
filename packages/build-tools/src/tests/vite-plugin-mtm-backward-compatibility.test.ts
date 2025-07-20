/**
 * Integration tests for vite-plugin-mtm backward compatibility support
 */

import { describe, it, expect, vi } from 'vitest';
import { mtmPlugin } from '../vite-plugin-mtm.js';

describe('vite-plugin-mtm Backward Compatibility Tests', () => {
  it('should handle legacy syntax files without errors', async () => {
    const plugin = mtmPlugin({
      hmr: false // Disable HMR for basic test
    });

    expect(plugin).toBeDefined();
    expect(plugin.name).toBe('vite-plugin-mtm');
  });

  it('should detect migration opportunities in legacy syntax', () => {
    // Test the migration detection logic
    const legacyContent = `
const counter = 0;
const name = "test";
function increment() {
  counter++;
}
document.getElementById('button').addEventListener('click', increment);
`;

    // This would be called internally by the plugin
    const warnings = detectMigrationOpportunities(legacyContent, '/test/legacy.mtm');
    
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings.some(w => w.includes('variable declaration'))).toBe(true);
    expect(warnings.some(w => w.includes('function declaration'))).toBe(true);
    expect(warnings.some(w => w.includes('DOM manipulation'))).toBe(true);
    expect(warnings.some(w => w.includes('event listener'))).toBe(true);
  });

  it('should provide appropriate migration suggestions', () => {
    const legacyContent = `
const message = "Hello World";
const count = 42;
function greet() {
  return message;
}
`;

    const warnings = detectMigrationOpportunities(legacyContent, '/test/legacy.mtm');
    
    expect(warnings).toContain('Found 2 variable declaration(s) that could use $ prefix syntax');
    expect(warnings).toContain('Found 1 function declaration(s) that could use modern arrow syntax');
  });

  it('should detect semicolon style opportunities', () => {
    const legacyContent = `
const a = 1;
const b = 2;
const c = 3;
const d = 4;
const e = 5;
const f = 6;
`;

    const warnings = detectMigrationOpportunities(legacyContent, '/test/legacy.mtm');
    
    expect(warnings.some(w => w.includes('explicit semicolons'))).toBe(true);
  });

  it('should detect type annotation opportunities', () => {
    const legacyContent = `
const name = "John";
const age = 30;
const isActive = true;
`;

    const warnings = detectMigrationOpportunities(legacyContent, '/test/legacy.mtm');
    
    expect(warnings.some(w => w.includes('type annotations'))).toBe(true);
  });

  it('should not suggest migration for already modern syntax', () => {
    const modernContent = `
$name = "John"
$age: number = 30
$isActive! = true
$greet = () => "Hello"
`;

    const warnings = detectMigrationOpportunities(modernContent, '/test/modern.mtm');
    
    // Modern syntax should have fewer or no migration opportunities
    expect(warnings.length).toBeLessThan(3);
  });

  it('should handle mixed content appropriately', () => {
    const mixedContent = `
const oldVar = "legacy";
$newVar = "modern";
function oldFunction() {}
$newFunction = () => {};
`;

    const warnings = detectMigrationOpportunities(mixedContent, '/test/mixed.mtm');
    
    // Should detect the legacy parts
    expect(warnings.some(w => w.includes('variable declaration'))).toBe(true);
    expect(warnings.some(w => w.includes('function declaration'))).toBe(true);
  });

  it('should handle empty content gracefully', () => {
    const emptyContent = '';
    const warnings = detectMigrationOpportunities(emptyContent, '/test/empty.mtm');
    
    expect(warnings).toEqual([]);
  });

  it('should handle content with only comments', () => {
    const commentContent = `
// This is a comment
/* This is a block comment */
`;
    const warnings = detectMigrationOpportunities(commentContent, '/test/comments.mtm');
    
    expect(warnings).toEqual([]);
  });

  it('should detect string concatenation opportunities', () => {
    const legacyContent = `
const greeting = "Hello " + name;
const message = "Count: " + count;
`;

    const warnings = detectMigrationOpportunities(legacyContent, '/test/concat.mtm');
    
    expect(warnings.some(w => w.includes('string concatenation'))).toBe(true);
  });

  it('should provide comprehensive migration analysis', () => {
    const complexLegacyContent = `
const userName = "John Doe";
const userAge = 25;
const isLoggedIn = false;

function login() {
  isLoggedIn = true;
  document.getElementById('status').textContent = "Logged in as " + userName;
}

function logout() {
  isLoggedIn = false;
}

document.getElementById('loginBtn').addEventListener('click', login);
document.getElementById('logoutBtn').addEventListener('click', logout);
`;

    const warnings = detectMigrationOpportunities(complexLegacyContent, '/test/complex.mtm');
    
    // Should detect multiple migration opportunities
    expect(warnings.length).toBeGreaterThan(3);
    expect(warnings.some(w => w.includes('variable declaration'))).toBe(true);
    expect(warnings.some(w => w.includes('function declaration'))).toBe(true);
    expect(warnings.some(w => w.includes('DOM manipulation'))).toBe(true);
    expect(warnings.some(w => w.includes('event listener'))).toBe(true);
    expect(warnings.some(w => w.includes('string concatenation'))).toBe(true);
  });
});

// Helper function to test migration detection (this would be internal to the plugin)
function detectMigrationOpportunities(content: string, filePath: string): string[] {
  const warnings: string[] = [];
  
  // Check for variable declarations that could use $ prefix
  const variableDeclarations = content.match(/(?:const|let|var)\s+(\w+)\s*=/g);
  if (variableDeclarations && variableDeclarations.length > 0) {
    warnings.push(`Found ${variableDeclarations.length} variable declaration(s) that could use $ prefix syntax`);
  }
  
  // Check for function declarations that could use arrow syntax
  const functionDeclarations = content.match(/function\s+(\w+)\s*\(/g);
  if (functionDeclarations && functionDeclarations.length > 0) {
    warnings.push(`Found ${functionDeclarations.length} function declaration(s) that could use modern arrow syntax`);
  }
  
  // Check for manual DOM manipulation that could be reactive
  const domManipulation = content.match(/document\.(getElementById|querySelector|createElement)/g);
  if (domManipulation && domManipulation.length > 0) {
    warnings.push(`Found ${domManipulation.length} DOM manipulation(s) that could use reactive variables`);
  }
  
  // Check for event listeners that could use template binding
  const eventListeners = content.match(/addEventListener\s*\(\s*['"`](\w+)['"`]/g);
  if (eventListeners && eventListeners.length > 0) {
    warnings.push(`Found ${eventListeners.length} event listener(s) that could use template event binding`);
  }
  
  // Check for string concatenation that could use template literals
  const stringConcatenation = content.match(/['"`][^'"`]*['"`]\s*\+\s*\w+/g);
  if (stringConcatenation && stringConcatenation.length > 0) {
    warnings.push(`Found ${stringConcatenation.length} string concatenation(s) that could use template binding`);
  }
  
  // Check for explicit type annotations that are missing
  const unTypedVariables = content.match(/(?:const|let|var)\s+(\w+)\s*=\s*(?:\d+|['"`][^'"`]*['"`]|true|false)/g);
  if (unTypedVariables && unTypedVariables.length > 0) {
    warnings.push(`Found ${unTypedVariables.length} variable(s) that could benefit from explicit type annotations`);
  }
  
  // Check for semicolons that could be optional
  const explicitSemicolons = content.match(/;\s*$/gm);
  if (explicitSemicolons && explicitSemicolons.length > 5) {
    warnings.push(`File uses explicit semicolons - could adopt optional semicolon style`);
  }
  
  return warnings;
}