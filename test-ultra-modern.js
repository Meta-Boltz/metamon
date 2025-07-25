// Test the ultra-modern MTM compiler
const { WorkingUltraModernCompiler } = require('./src/mtm-compiler/working-ultra-modern');
const fs = require('fs');

const compiler = new WorkingUltraModernCompiler();

console.log('🔮 Testing Ultra-Modern MTM Compiler...');

try {
  const result = compiler.compile('primitive-correct.mtm');
  fs.writeFileSync('compiled/primitive-correct.html', result);
  console.log('✅ Compiled primitive-correct.mtm successfully!');
  console.log('🚀 Open compiled/primitive-correct.html in your browser');

  // Analyze the compiled output
  console.log('\n🔍 Compilation Analysis:');
  console.log(`📄 File size: ${Math.round(result.length / 1024)}KB`);
  console.log(`✅ Signal system: ${result.includes('signal.create') ? 'Present' : 'Missing'}`);
  console.log(`✅ Event handlers: ${result.includes('addEventListener') ? 'Present' : 'Missing'}`);
  console.log(`✅ Conditional rendering: ${result.includes('data-if') ? 'Present' : 'Missing'}`);
  console.log(`✅ Variable binding: ${result.includes('data-bind') ? 'Present' : 'Missing'}`);
  console.log(`✅ Template processing: ${result.includes('updateBindings') ? 'Present' : 'Missing'}`);

} catch (error) {
  console.error('❌ Compilation failed:', error.message);
  console.error(error.stack);
}