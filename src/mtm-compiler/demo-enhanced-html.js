// Demo script for Enhanced HTML Generator
const { EnhancedMTMCompilerWithModes } = require('./enhanced-compiler-with-modes.js');
const fs = require('fs');
const path = require('path');

function runDemo() {
  console.log('Enhanced HTML Generator Demo\n');

  const compiler = new EnhancedMTMCompilerWithModes();
  const inputFile = 'examples/enhanced-routing-demo.mtm';
  const outputDir = 'compiled';

  try {
    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    console.log(`Compiling: ${inputFile}`);

    // Compile the demo file
    const result = compiler.compile(inputFile);

    console.log('\n=== Compilation Results ===');
    console.log(`Route: ${result.route}`);
    console.log(`Title: ${result.metadata.title}`);
    console.log(`Compilation Mode: ${result.compilationMode}`);
    console.log(`Components Found: ${result.ast.imports ? result.ast.imports.length : 0}`);

    if (result.ast.imports) {
      console.log('\nImported Components:');
      result.ast.imports.forEach(imp => {
        console.log(`  - ${imp.name} (${imp.framework}) from ${imp.path}`);
      });
    }

    // Write the result
    const outputFile = path.join(outputDir, 'enhanced-routing-demo.html');
    fs.writeFileSync(outputFile, result.html, 'utf8');

    console.log(`\nOutput written to: ${outputFile}`);
    console.log(`File size: ${(result.html.length / 1024).toFixed(2)} KB`);

    // Show key features in the generated HTML
    console.log('\n=== Generated HTML Features ===');

    // Check for Link components
    const linkMatches = result.html.match(/<a[^>]*data-link="true"[^>]*>/g);
    console.log(`Link components converted: ${linkMatches ? linkMatches.length : 0}`);

    // Check for framework components
    const componentMatches = result.html.match(/data-component="[^"]+"/g);
    console.log(`Framework components processed: ${componentMatches ? componentMatches.length : 0}`);

    // Check for meta tags
    const metaMatches = result.html.match(/<meta[^>]*>/g);
    console.log(`Meta tags generated: ${metaMatches ? metaMatches.length : 0}`);

    // Check for router and component system
    const hasRouter = result.html.includes('class MTMRouter');
    const hasComponentSystem = result.html.includes('class MTMComponentSystem');
    console.log(`Client-side router included: ${hasRouter ? 'Yes' : 'No'}`);
    console.log(`Component system included: ${hasComponentSystem ? 'Yes' : 'No'}`);

    console.log('\n=== Sample Generated Code ===');

    // Show a sample Link component conversion
    const linkSample = result.html.match(/<a[^>]*data-link="true"[^>]*>.*?<\/a>/);
    if (linkSample) {
      console.log('\nLink Component Example:');
      console.log(linkSample[0]);
    }

    // Show a sample framework component conversion
    const componentSample = result.html.match(/<div[^>]*data-component="[^"]+"[^>]*>/);
    if (componentSample) {
      console.log('\nFramework Component Example:');
      console.log(componentSample[0]);
    }

    console.log('\n✅ Demo completed successfully!');
    console.log(`Open ${outputFile} in a browser to see the result.`);

  } catch (error) {
    console.error('❌ Demo failed:', error.message);
    console.error(error.stack);
  }
}

// Run the demo
if (require.main === module) {
  runDemo();
}

module.exports = { runDemo };