#!/usr/bin/env node

// Simple MTM CLI - Working version
const fs = require('fs');
const path = require('path');
const { SimpleMTMCompiler } = require('./simple-compiler');

class SimpleMTMCLI {
  constructor() {
    this.compiler = new SimpleMTMCompiler();
  }

  async compile(inputFile, outputDir = './compiled') {
    try {
      console.log(`🔮 Compiling ${inputFile}...`);

      // Compile MTM to HTML
      const compiledHTML = this.compiler.compile(inputFile);

      // Ensure output directory exists
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Generate output filename
      const baseName = path.basename(inputFile, '.mtm').replace(/\.(react|vue|svelte|solid)$/, '');
      const outputFile = path.join(outputDir, `${baseName}.html`);

      // Write compiled output
      fs.writeFileSync(outputFile, compiledHTML);

      console.log(`✅ Compiled successfully to ${outputFile}`);
      console.log(`🚀 Open ${outputFile} in your browser to see the result!`);

      return outputFile;
    } catch (error) {
      console.error(`❌ Compilation failed: ${error.message}`);
      throw error;
    }
  }

  async compileAll(inputDir, outputDir = './compiled') {
    const mtmFiles = this.findMTMFiles(inputDir);
    console.log(`🔍 Found ${mtmFiles.length} MTM files to compile`);

    const results = [];
    for (const file of mtmFiles) {
      try {
        const outputFile = await this.compile(file, outputDir);
        results.push({ input: file, output: outputFile, success: true });
      } catch (error) {
        results.push({ input: file, error: error.message, success: false });
      }
    }

    // Print summary
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log(`\n📊 Compilation Summary:`);
    console.log(`✅ Successful: ${successful}`);
    console.log(`❌ Failed: ${failed}`);

    if (failed > 0) {
      console.log(`\n❌ Failed files:`);
      results.filter(r => !r.success).forEach(r => {
        console.log(`  ${r.input}: ${r.error}`);
      });
    }

    return results;
  }

  findMTMFiles(dir) {
    const files = [];

    function scanDir(currentDir) {
      const items = fs.readdirSync(currentDir);

      for (const item of items) {
        const fullPath = path.join(currentDir, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          scanDir(fullPath);
        } else if (item.endsWith('.mtm')) {
          files.push(fullPath);
        }
      }
    }

    scanDir(dir);
    return files;
  }

  showHelp() {
    console.log(`
🔮 MTM Framework Compiler (Simple Version)

Usage:
  node src/mtm-compiler/simple-cli.js compile <file>              Compile single MTM file
  node src/mtm-compiler/simple-cli.js compile-all <directory>     Compile all MTM files in directory
  node src/mtm-compiler/simple-cli.js help                       Show this help message

Examples:
  node src/mtm-compiler/simple-cli.js compile examples/mtm-components/counter.mtm
  node src/mtm-compiler/simple-cli.js compile examples/mtm-components/counter.react.mtm
  node src/mtm-compiler/simple-cli.js compile-all examples/mtm-components

Supported frameworks:
  - Pure HTML/JS (.mtm) ✅ Working
  - React (.react.mtm) [Coming soon]
  - Vue (.vue.mtm) [Coming soon]
  - Svelte (.svelte.mtm) [Coming soon]
  - SolidJS (.solid.mtm) [Coming soon]

The MTM framework allows you to write components once and compile them
to multiple target frameworks. Pure HTML/JS compilation works like a
merge between PHP and Next.js - no framework dependencies needed!
`);
  }
}

// CLI Entry Point
async function main() {
  const cli = new SimpleMTMCLI();
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === 'help') {
    cli.showHelp();
    return;
  }

  const command = args[0];

  try {
    switch (command) {
      case 'compile':
        if (!args[1]) {
          console.error('❌ Please specify a file to compile');
          process.exit(1);
        }
        await cli.compile(args[1], args[2]);
        break;

      case 'compile-all':
        if (!args[1]) {
          console.error('❌ Please specify a directory to compile');
          process.exit(1);
        }
        await cli.compileAll(args[1], args[2]);
        break;

      default:
        console.error(`❌ Unknown command: ${command}`);
        cli.showHelp();
        process.exit(1);
    }
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { SimpleMTMCLI };