// Debug tokenizer
import { EnhancedMTMParser } from './packages/core/dist/parser/enhanced-mtm-parser.js';

const parser = new EnhancedMTMParser();

// Test tokenizing boolean
const content = '$test = true';
console.log('Testing:', content);

try {
  // Access the private tokenize method through reflection
  const tokens = parser.tokenize(content);
  console.log('Tokens:', tokens.map(t => ({ type: t.type, value: t.value })));
} catch (error) {
  console.error('Error:', error.message);
}