/**
 * Integration test for frontmatter processing with real MTM files
 */

import { readFileSync } from 'fs';
import { processFrontmatter } from './src/build-tools/frontmatter-processor.js';

console.log('🧪 Testing frontmatter processing with real MTM files...\n');

// Test with existing MTM files
const testFiles = [
  'src/pages/index.mtm',
  'src/pages/404.mtm',
  'src/pages/documentation.mtm'
];

for (const filePath of testFiles) {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const result = processFrontmatter(content, filePath);

    console.log(`📄 ${filePath}:`);
    console.log(`  ✅ Valid: ${result.isValid}`);
    console.log(`  📝 Route: ${result.frontmatter.route}`);
    console.log(`  📖 Title: ${result.frontmatter.title}`);
    console.log(`  📄 Description: ${result.frontmatter.description?.substring(0, 50)}...`);

    if (result.validationErrors.length > 0) {
      console.log(`  ❌ Validation Errors: ${result.validationErrors.length}`);
      for (const error of result.validationErrors) {
        console.log(`    - ${error.message}`);
      }
    }

    if (result.warnings.length > 0) {
      console.log(`  ⚠️  Warnings: ${result.warnings.length}`);
      for (const warning of result.warnings) {
        console.log(`    - ${warning.message}`);
      }
    }

    console.log('');
  } catch (error) {
    console.log(`❌ Error processing ${filePath}: ${error.message}\n`);
  }
}

console.log('✅ Frontmatter integration test completed!');