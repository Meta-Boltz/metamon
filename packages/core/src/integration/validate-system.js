#!/usr/bin/env node

/**
 * System Validation CLI
 * 
 * This script provides a command-line interface for running comprehensive
 * system validation tests and generating reports.
 */

const { execSync } = require('child_process');
const { join } = require('path');
const { existsSync, mkdirSync } = require('fs');

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  environment: 'production',
  reportDir: join(process.cwd(), 'reports'),
  verbose: false,
  help: false
};

// Parse arguments
for (let i = 0; i < args.length; i++) {
  const arg = args[i];

  if (arg === '--env' || arg === '-e') {
    options.environment = args[++i] || 'production';
  } else if (arg === '--report-dir' || arg === '-r') {
    options.reportDir = args[++i] || options.reportDir;
  } else if (arg === '--verbose' || arg === '-v') {
    options.verbose = true;
  } else if (arg === '--help' || arg === '-h') {
    options.help = true;
  }
}

// Show help
if (options.help) {
  console.log(`
System Validation CLI

Usage: node validate-system.js [options]

Options:
  --env, -e <environment>    Specify environment (development, staging, production)
  --report-dir, -r <path>    Specify report directory
  --verbose, -v              Enable verbose output
  --help, -h                 Show this help message

Examples:
  node validate-system.js
  node validate-system.js --env staging
  node validate-system.js --report-dir ./validation-reports
  `);
  process.exit(0);
}

// Create report directory if it doesn't exist
if (!existsSync(options.reportDir)) {
  mkdirSync(options.reportDir, { recursive: true });
}

console.log(`
🚀 Ultra-Modern MTM System Validation
=====================================
Environment: ${options.environment}
Report Directory: ${options.reportDir}
Verbose: ${options.verbose ? 'Yes' : 'No'}
`);

// Run validation
try {
  console.log('📋 Running system validation tests...');

  // Set environment variables
  process.env.NODE_ENV = options.environment;
  process.env.REPORT_DIR = options.reportDir;
  process.env.VERBOSE = options.verbose ? 'true' : 'false';

  // Run TypeScript validation script
  const command = `npx ts-node ${join(__dirname, 'run-system-validation.ts')}`;

  if (options.verbose) {
    console.log(`Executing: ${command}`);
  }

  execSync(command, {
    stdio: 'inherit',
    env: process.env
  });

  console.log('\n✅ Validation completed successfully!');
  console.log(`Reports are available in: ${options.reportDir}`);

  process.exit(0);
} catch (error) {
  console.error('\n❌ Validation failed!');

  if (options.verbose) {
    console.error(error);
  } else {
    console.error(error.message);
  }

  process.exit(1);
}