// Test the final compiler
const { FinalMTMCompiler } = require('./src/mtm-compiler/final-compiler');
const fs = require('fs');

const compiler = new FinalMTMCompiler();

console.log('🔮 Testing MTM Compiler...');

try {
  const result = compiler.compile('primitive-simple.mtm');
  fs.writeFileSync('compiled/primitive-simple.html', result);
  console.log('✅ Compiled primitive-simple.mtm successfully!');
  console.log('🚀 Open compiled/primitive-simple.html in your browser');
} catch (error) {
  console.error('❌ Compilation failed:', error.message);
}