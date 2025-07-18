// Simple debug to test parsing
import { EnhancedMTMParser } from './packages/core/dist/parser/enhanced-mtm-parser.js';

const parser = new EnhancedMTMParser();

// Test simple boolean
console.log('Testing: $test = true');
try {
  const ast = parser.parseModern('$test = true');
  console.log('AST body:', JSON.stringify(ast.body[0], null, 2));
  console.log('Initializer:', ast.body[0].initializer);
  console.log('Initializer value:', ast.body[0].initializer.value);
  console.log('Initializer type:', typeof ast.body[0].initializer.value);
} catch (error) {
  console.error('Error:', error.message);
}