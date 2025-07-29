#!/usr/bin/env node

// MTM CLI - Command line interface for MTM compiler
const fs = require('fs');
const path = require('path');
const { MTMParser } = require('./parser');
const { HTMLGenerator } = require('./html-generator');

class MTMCLI {
  constructor() {
    this.parser = new MTMParser();
    this.generators = {
      html: new HTMLGenerator(),
      // TODO: Add other generators
      // react: new ReactGenerator(),
      // vue: new VueGenerator(),
      // solid: new SolidJSGenerator(),
      // svelte: new SvelteGenerator()
    };
  }

  async compile(inputFile, outputDir = './compiled') {
    try {
      console.log(`🔮 Compiling ${inputFile}...`);

      // Read MTM source file
      const source = fs.readFileSync(inputFile, 'utf8');
      const filename = path.basename(inputFile);

      // Parse MTM to AST
      const ast = this.parser.parse(source, filename);
      console.log(`📝 Parsed ${ast.name} component for ${ast.framework} framework`);

      // Generate code for target framework
      const generator = this.generators[ast.framework];
      if (!generator) {
        throw new Error(`Generator for ${ast.framework} not implemented yet`);
      }

      const compiledCode = generator.generate(ast);

      // Ensure output directory exists
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Write compiled output
      const outputFile = path.join(outputDir, `${ast.name.toLowerCase()}.html`);
      fs.writeFileSync(outputFile, compiledCode);

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
🔮 MTM Framework Compiler

Usage:
  mtm compile <file>              Compile single MTM file
  mtm compile-all <directory>     Compile all MTM files in directory
  mtm help                        Show this help message

Examples:
  mtm compile counter.mtm
  mtm compile counter.react.mtm
  mtm compile-all ./components

Supported frameworks:
  - Pure HTML/JS (.mtm)
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
  const cli = new MTMCLI();
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

module.exports = { MTMCLI };