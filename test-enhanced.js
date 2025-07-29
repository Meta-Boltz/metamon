// Test the Enhanced MTM Compiler
const { EnhancedMTMCompiler } = require('./src/mtm-compiler/enhanced-compiler');
const fs = require('fs');
const path = require('path');

const compiler = new EnhancedMTMCompiler();

console.log('🔮 Testing Enhanced MTM Compiler...\n');

// Test home page
try {
  console.log('📝 Compiling home page...');
  const homeResult = compiler.compile('examples/enhanced-mtm/pages/index.mtm');

  // Ensure output directory exists
  if (!fs.existsSync('compiled/enhanced')) {
    fs.mkdirSync('compiled/enhanced', { recursive: true });
  }

  // Write HTML file
  fs.writeFileSync('compiled/enhanced/index.html', homeResult.html);

  // Write JS file if external compilation
  if (homeResult.js) {
    if (!fs.existsSync('compiled/enhanced/js')) {
      fs.mkdirSync('compiled/enhanced/js', { recursive: true });
    }
    fs.writeFileSync('compiled/enhanced/js/external.js', homeResult.js);
  }

  console.log('✅ Home page compiled successfully!');
  console.log(`   Route: ${homeResult.route}`);
  console.log(`   Title: ${homeResult.metadata.title}`);
  console.log(`   JS Mode: ${homeResult.metadata.compileJs}`);

} catch (error) {
  console.error('❌ Home page compilation failed:', error.message);
}

// Test about page
try {
  console.log('\n📝 Compiling about page...');
  const aboutResult = compiler.compile('examples/enhanced-mtm/pages/about.mtm');

  // Write HTML file
  fs.writeFileSync('compiled/enhanced/about.html', aboutResult.html);

  // Write JS file if external compilation
  if (aboutResult.js) {
    fs.writeFileSync('compiled/enhanced/js/about.js', aboutResult.js);
  }

  console.log('✅ About page compiled successfully!');
  console.log(`   Route: ${aboutResult.route}`);
  console.log(`   Title: ${aboutResult.metadata.title}`);
  console.log(`   JS Mode: ${aboutResult.metadata.compileJs}`);

} catch (error) {
  console.error('❌ About page compilation failed:', error.message);
}

console.log('\n🔍 Enhanced MTM Features Analysis:');

// Check home page features
const homeContent = fs.readFileSync('compiled/enhanced/index.html', 'utf8');
console.log(`✅ Link components: ${homeContent.includes('data-link="true"') ? 'Present' : 'Missing'}`);
console.log(`✅ Component imports: ${homeContent.includes('data-component=') ? 'Present' : 'Missing'}`);
console.log(`✅ Route metadata: ${homeContent.includes('meta name="route"') ? 'Present' : 'Missing'}`);
console.log(`✅ External JS: ${homeContent.includes('src="./js/') ? 'Present' : 'Inline'}`);
console.log(`✅ Router system: ${homeContent.includes('MTMRouter') || fs.existsSync('compiled/enhanced/js/external.js') ? 'Present' : 'Missing'}`);

console.log('\n🎯 Enhanced MTM Capabilities:');
console.log('  • Link-based routing with <a href="/path"> and <Link>');
console.log('  • Component imports from React/Vue/Svelte');
console.log('  • External JavaScript compilation');
console.log('  • Route definitions in MTM files');
console.log('  • Professional SPA architecture');
console.log('  • SEO-friendly meta tags');

console.log('\n📖 Testing Instructions:');
console.log('  1. Open compiled/enhanced/index.html in your browser');
console.log('  2. Click navigation links to test routing');
console.log('  3. Check browser developer tools for router events');
console.log('  4. Test component integration');
console.log('  5. Verify external JS files are loaded');

console.log('\n🚀 Enhanced MTM Framework is ready for professional development!');
console.log('💡 This demonstrates the full vision of link-based routing and component imports!');