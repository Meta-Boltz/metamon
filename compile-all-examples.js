// Compile all MTM examples
const { FinalMTMCompiler } = require('./src/mtm-compiler/final-compiler');
const fs = require('fs');
const path = require('path');

const compiler = new FinalMTMCompiler();

console.log('🔮 Compiling all MTM examples...\n');

// Ensure compiled directory exists
if (!fs.existsSync('compiled')) {
  fs.mkdirSync('compiled');
}

// List of MTM files to compile
const mtmFiles = [
  'examples/mtm-components/simple-counter.mtm',
  // Add more as we create them
];

let successful = 0;
let failed = 0;

for (const file of mtmFiles) {
  try {
    if (fs.existsSync(file)) {
      console.log(`📝 Compiling ${file}...`);
      const result = compiler.compile(file);
      const outputName = path.basename(file, '.mtm') + '.html';
      const outputPath = path.join('compiled', outputName);
      fs.writeFileSync(outputPath, result);
      console.log(`✅ Successfully compiled to ${outputPath}`);
      successful++;
    } else {
      console.log(`⚠️  File not found: ${file}`);
    }
  } catch (error) {
    console.error(`❌ Failed to compile ${file}: ${error.message}`);
    failed++;
  }
  console.log('');
}

console.log(`📊 Compilation Summary:`);
console.log(`✅ Successful: ${successful}`);
console.log(`❌ Failed: ${failed}`);

if (successful > 0) {
  console.log(`\n🚀 Open the compiled HTML files in your browser to see the results!`);
  console.log(`📁 Files are in the 'compiled' directory`);
  console.log(`\n💡 These work like PHP + Next.js - pure HTML/JS with no framework dependencies!`);
}