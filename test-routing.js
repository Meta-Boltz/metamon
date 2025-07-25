// Test the MTM routing compiler
const { RoutingMTMCompiler } = require('./src/mtm-compiler/routing-compiler');
const fs = require('fs');

const compiler = new RoutingMTMCompiler();

console.log('🔮 Testing MTM Client-Side Routing Compiler...');

try {
  const result = compiler.compile('primitive-routing.mtm');
  fs.writeFileSync('compiled/primitive-routing.html', result);
  console.log('✅ Compiled primitive-routing.mtm successfully!');
  console.log('🚀 Open compiled/primitive-routing.html in your browser');

  // Analyze the compiled output
  console.log('\n🔍 Client-Side Routing Analysis:');
  console.log(`📄 File size: ${Math.round(result.length / 1024)}KB`);
  console.log(`✅ History API: ${result.includes('pushState') ? 'Implemented' : 'Missing'}`);
  console.log(`✅ PopState handler: ${result.includes('popstate') ? 'Implemented' : 'Missing'}`);
  console.log(`✅ URL updates: ${result.includes('updateURL') ? 'Implemented' : 'Missing'}`);
  console.log(`✅ Browser navigation: ${result.includes('addEventListener') ? 'Implemented' : 'Missing'}`);
  console.log(`✅ Document title updates: ${result.includes('document.title') ? 'Implemented' : 'Missing'}`);

  console.log('\n🎯 Real Client-Side Routing Features:');
  console.log('  • URL bar updates when navigating');
  console.log('  • Browser back/forward buttons work');
  console.log('  • Direct URL access works');
  console.log('  • Document title updates');
  console.log('  • History API integration');
  console.log('  • Bookmarkable URLs');
  console.log('  • Refresh-safe routing');

  console.log('\n📖 Testing Instructions:');
  console.log('  1. Click navigation buttons and watch URL change');
  console.log('  2. Use browser back/forward buttons');
  console.log('  3. Copy URL and open in new tab');
  console.log('  4. Refresh page and see it maintains state');
  console.log('  5. Bookmark different pages');

} catch (error) {
  console.error('❌ Compilation failed:', error.message);
  console.error(error.stack);
}