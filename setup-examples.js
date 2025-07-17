#!/usr/bin/env node

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';

console.log('🚀 Setting up Metamon Examples...\n');

// Check Node.js version
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);

if (majorVersion < 18) {
  console.error('❌ Node.js 18+ is required. Current version:', nodeVersion);
  process.exit(1);
}

console.log('✅ Node.js version check passed:', nodeVersion);

// Function to run commands with proper error handling
function runCommand(command, description, cwd = process.cwd()) {
  console.log(`\n📦 ${description}...`);
  try {
    execSync(command, { 
      stdio: 'inherit', 
      cwd,
      env: { ...process.env, FORCE_COLOR: '1' }
    });
    console.log(`✅ ${description} completed`);
  } catch (error) {
    console.error(`❌ ${description} failed:`, error.message);
    process.exit(1);
  }
}

// Check if we're in the right directory
if (!existsSync('package.json') || !existsSync('packages')) {
  console.error('❌ Please run this script from the root of the Metamon project');
  process.exit(1);
}

// Step 1: Install root dependencies
runCommand('npm install', 'Installing root dependencies');

// Step 2: Build packages
runCommand('npm run build', 'Building Metamon packages');

// Step 3: Install example dependencies
const examplesPath = path.join(process.cwd(), 'examples');
if (existsSync(examplesPath)) {
  runCommand('npm install', 'Installing example dependencies', examplesPath);
} else {
  console.log('⚠️  Examples directory not found, skipping example setup');
}

console.log('\n🎉 Setup completed successfully!');
console.log('\n📋 Next steps:');
console.log('   cd examples');
console.log('   npm run dev');
console.log('\n🌐 Then open http://localhost:3000 in your browser');
console.log('\n📚 Available commands in examples/:');
console.log('   npm run dev        - Start development server');
console.log('   npm test           - Run unit tests');
console.log('   npm run test:e2e   - Run end-to-end tests (requires: npx playwright install)');
console.log('   npm run benchmark  - Run performance benchmarks');