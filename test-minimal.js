// Test the ultra-minimal MTM compiler
const { MinimalMTMCompiler } = require('./src/mtm-compiler/minimal-compiler');
const fs = require('fs');

const compiler = new MinimalMTMCompiler();

console.log('🔮 Testing Ultra-Minimal MTM Compiler...');

try {
  const result = compiler.compile('primitive-minimal.mtm');
  fs.writeFileSync('compiled/primitive-minimal.html', result);
  console.log('✅ Compiled primitive-minimal.mtm successfully!');
  console.log('🚀 Open compiled/primitive-minimal.html in your browser');

  // Analyze the compiled output
  console.log('\n🔍 Ultra-Minimal Compilation Analysis:');
  console.log(`📄 File size: ${Math.round(result.length / 1024)}KB`);
  console.log(`✅ No function wrapper: ${!result.includes('export default function') ? 'Success' : 'Still present'}`);
  console.log(`✅ Page metadata: ${result.includes('pageMetadata') ? 'Present' : 'Missing'}`);
  console.log(`✅ Route info: ${result.includes('Route:') ? 'Present' : 'Missing'}`);
  console.log(`✅ Title in HTML: ${result.includes('<title>') ? 'Present' : 'Missing'}`);
  console.log(`✅ Description meta: ${result.includes('meta name="description"') ? 'Present' : 'Missing'}`);
  console.log(`✅ Signal system: ${result.includes('MTMSignal') ? 'Present' : 'Missing'}`);
  console.log(`✅ Event handlers: ${result.includes('addEventListener') ? 'Present' : 'Missing'}`);

  console.log('\n🎯 Ultra-Minimal Features:');
  console.log('  • No export default function wrapper needed');
  console.log('  • Page metadata (route, title, description) supported');
  console.log('  • Direct reactive variable declarations');
  console.log('  • Clean function definitions');
  console.log('  • Template-first architecture');
  console.log('  • Automatic component name generation from filename');

} catch (error) {
  console.error('❌ Compilation failed:', error.message);
  console.error(error.stack);
}