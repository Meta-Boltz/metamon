// Test the compilation modes demo
const { EnhancedMTMCompilerWithModes } = require('./src/mtm-compiler/enhanced-compiler-with-modes.js');
const fs = require('fs');
const path = require('path');

async function testCompilationDemo() {
  console.log('🔮 Testing Compilation Modes Demo\n');

  const compiler = new EnhancedMTMCompilerWithModes();
  const inputFile = 'examples/compilation-modes-demo.mtm';
  const outputDir = 'compiled';

  try {
    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    console.log(`📄 Compiling ${inputFile}...`);

    // Compile the demo file
    const result = compiler.compile(inputFile);

    console.log('✅ Compilation successful!');
    console.log(`📍 Route: ${result.route}`);
    console.log(`🔧 Mode: ${result.compilationMode}`);
    console.log(`📏 JS Size: ${result.javascript.content.length} characters`);

    if (result.javascript.externalFile) {
      console.log(`📦 External file: ${result.javascript.externalFile.filename}`);
    }

    // Write the result to disk
    compiler.writeResult(result, outputDir);

    const htmlFile = path.join(outputDir, compiler.getOutputFilename(result.metadata, 'html'));
    console.log(`📝 HTML written to: ${htmlFile}`);

    if (result.javascript.externalFile) {
      const jsFile = path.join(outputDir, result.javascript.externalFile.filename);
      console.log(`📦 JS written to: ${jsFile}`);
    }

    // Show some content from the generated files
    console.log('\n📋 Generated HTML (first 500 chars):');
    console.log(result.html.substring(0, 500) + '...');

    console.log('\n📋 Generated JavaScript (first 500 chars):');
    console.log(result.javascript.content.substring(0, 500) + '...');

    // Test different compilation modes
    console.log('\n🔄 Testing different compilation modes...');

    // Test inline mode
    const inlineResult = compiler.compile(inputFile, { development: true });
    console.log(`📝 Inline mode: ${inlineResult.compilationMode}`);
    console.log(`📏 Inline JS size: ${inlineResult.javascript.content.length} chars`);

    // Test production mode
    const prodResult = compiler.compile(inputFile, { production: true });
    console.log(`🏭 Production mode: ${prodResult.compilationMode}`);
    console.log(`📏 Production JS size: ${prodResult.javascript.content.length} chars`);

    console.log('\n🎉 Demo compilation completed successfully!');

  } catch (error) {
    console.error('❌ Compilation failed:', error.message);
    console.error(error.stack);
  }
}

// Run the test
testCompilationDemo().catch(console.error);