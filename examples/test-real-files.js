/**
 * Test script to verify the enhanced MTM plugin with real project files
 */

import { mtmPlugin } from './src/mtm-plugin.js';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

// Create plugin instance
const plugin = mtmPlugin({
  include: ['**/*.mtm'],
  hmr: true,
  sourceMaps: true
});

console.log('🧪 Testing Enhanced MTM Plugin with Real Files');
console.log('===============================================');

// Find all .mtm files in the project
const findMTMFiles = (dir) => {
  const files = [];
  try {
    const items = readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
      const fullPath = join(dir, item.name);
      if (item.isDirectory() && !item.name.startsWith('.') && item.name !== 'node_modules') {
        files.push(...findMTMFiles(fullPath));
      } else if (item.isFile() && item.name.endsWith('.mtm')) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    // Ignore errors for directories we can't read
  }
  return files;
};

const mtmFiles = findMTMFiles('./src');
console.log(`\nFound ${mtmFiles.length} .mtm files:`);
mtmFiles.forEach(file => console.log(`  - ${file}`));

// Test each .mtm file
for (const filePath of mtmFiles) {
  console.log(`\n📄 Testing: ${filePath}`);
  console.log('─'.repeat(50));

  try {
    // Read the file
    const code = readFileSync(filePath, 'utf-8');
    console.log(`   File size: ${code.length} characters`);

    // Parse frontmatter
    const parsed = plugin.parseFrontmatter(code, filePath);
    console.log(`   Frontmatter keys: ${Object.keys(parsed.frontmatter).join(', ')}`);
    console.log(`   Content length: ${parsed.content.length} characters`);
    console.log(`   Parse errors: ${parsed.errors.length}`);

    if (parsed.errors.length > 0) {
      parsed.errors.forEach(error => {
        console.log(`     ⚠️  ${error.message}`);
        if (error.suggestion) {
          console.log(`        💡 ${error.suggestion}`);
        }
      });
    }

    // Determine file type and framework
    const isPage = plugin.isPageFile(parsed.frontmatter, filePath);
    const framework = plugin.detectFramework(parsed.frontmatter, filePath);
    console.log(`   Type: ${isPage ? 'Page' : 'Component'}`);
    console.log(`   Framework: ${framework}`);

    // Transform the file
    let transformed;
    if (isPage) {
      transformed = plugin.transformPageToSSR(parsed, filePath);
      console.log(`   ✅ Page transformation successful`);
      console.log(`   Route: ${parsed.frontmatter.route || 'Not specified'}`);
      console.log(`   Title: ${parsed.frontmatter.title || 'Not specified'}`);
    } else {
      transformed = plugin.transformComponent(parsed, framework, filePath);
      console.log(`   ✅ Component transformation successful`);
      console.log(`   Component name: ${parsed.frontmatter.name || 'Component'}`);
    }

    console.log(`   Output size: ${transformed.length} characters`);

    // Validate the output contains expected elements
    const hasImports = transformed.includes('import');
    const hasExports = transformed.includes('export');
    const hasSignalImport = transformed.includes('import { signal }');

    console.log(`   Contains imports: ${hasImports ? '✅' : '❌'}`);
    console.log(`   Contains exports: ${hasExports ? '✅' : '❌'}`);
    console.log(`   Contains signal import: ${hasSignalImport ? '✅' : '❌'}`);

  } catch (error) {
    console.log(`   ❌ Error processing file: ${error.message}`);

    // Test error component generation
    try {
      const errorComponent = plugin.generateErrorComponent(filePath, error);
      console.log(`   ✅ Error component generated (${errorComponent.code.length} chars)`);
      console.log(`   Error type: ${plugin.categorizeError(error)}`);
      console.log(`   Suggestion: ${plugin.getErrorSuggestion(plugin.categorizeError(error))}`);
    } catch (errorGenError) {
      console.log(`   ❌ Error component generation failed: ${errorGenError.message}`);
    }
  }
}

console.log('\n🎉 Real file testing completed!');
console.log('===============================================');