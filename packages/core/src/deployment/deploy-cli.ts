#!/usr/bin/env node

/**
 * Ultra-Modern MTM Deployment CLI
 * 
 * This CLI tool helps users deploy their MTM applications to various hosting providers.
 * It generates the necessary configuration files and provides deployment instructions.
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { 
  generateHostingConfig, 
  getSupportedProviders,
  DeploymentOptions
} from './hosting-configs';

// Parse command line arguments
const args = process.argv.slice(2);
const options: {
  provider?: string;
  projectName?: string;
  buildCommand?: string;
  outputDir?: string;
  apiUrl?: string;
  basePath?: string;
  nodeVersion?: string;
  withSSR?: boolean;
  help?: boolean;
  list?: boolean;
} = {
  nodeVersion: '18',
  outputDir: 'dist',
  buildCommand: 'npm run build',
  basePath: '/',
  withSSR: false
};

// Parse arguments
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  
  if (arg === '--provider' || arg === '-p') {
    options.provider = args[++i];
  } else if (arg === '--name' || arg === '-n') {
    options.projectName = args[++i];
  } else if (arg === '--build-command' || arg === '-b') {
    options.buildCommand = args[++i];
  } else if (arg === '--output-dir' || arg === '-o') {
    options.outputDir = args[++i];
  } else if (arg === '--api-url' || arg === '-a') {
    options.apiUrl = args[++i];
  } else if (arg === '--base-path') {
    options.basePath = args[++i];
  } else if (arg === '--node-version') {
    options.nodeVersion = args[++i];
  } else if (arg === '--ssr') {
    options.withSSR = true;
  } else if (arg === '--no-ssr') {
    options.withSSR = false;
  } else if (arg === '--help' || arg === '-h') {
    options.help = true;
  } else if (arg === '--list' || arg === '-l') {
    options.list = true;
  }
}

// Show help
if (options.help) {
  console.log(`
Ultra-Modern MTM Deployment CLI

Usage: mtm-deploy [options]

Options:
  --provider, -p <provider>       Hosting provider (netlify, vercel, github-pages, docker, aws-amplify, firebase, cloudflare)
  --name, -n <name>               Project name
  --build-command, -b <command>   Build command (default: "npm run build")
  --output-dir, -o <dir>          Output directory (default: "dist")
  --api-url, -a <url>             API URL for environment configuration
  --base-path <path>              Base path for the application (default: "/")
  --node-version <version>        Node.js version (default: "18")
  --ssr                           Enable server-side rendering
  --no-ssr                        Disable server-side rendering
  --list, -l                      List supported hosting providers
  --help, -h                      Show this help message

Examples:
  mtm-deploy --provider netlify --name my-app
  mtm-deploy --provider vercel --name my-app --ssr
  mtm-deploy --provider docker --name my-app --api-url https://api.example.com
  `);
  process.exit(0);
}

// List supported providers
if (options.list) {
  console.log('Supported hosting providers:');
  getSupportedProviders().forEach(provider => {
    console.log(`- ${provider}`);
  });
  process.exit(0);
}

// Validate required options
if (!options.provider) {
  console.error('Error: Provider is required. Use --provider <provider> or --help for more information.');
  process.exit(1);
}

if (!options.projectName) {
  console.error('Error: Project name is required. Use --name <name> or --help for more information.');
  process.exit(1);
}

// Generate deployment configuration
try {
  console.log(`Generating deployment configuration for ${options.provider}...`);
  
  const deploymentOptions: DeploymentOptions = {
    projectName: options.projectName,
    buildCommand: options.buildCommand,
    outputDir: options.outputDir,
    apiUrl: options.apiUrl,
    basePath: options.basePath,
    nodeVersion: options.nodeVersion,
    withSSR: options.withSSR
  };
  
  const config = generateHostingConfig(options.provider, deploymentOptions);
  
  // Create output directory
  const outputDir = join(process.cwd(), '.deployment', options.provider);
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }
  
  // Write configuration files
  config.files.forEach(file => {
    const filePath = join(outputDir, file.path);
    const fileDir = dirname(filePath);
    
    if (!existsSync(fileDir)) {
      mkdirSync(fileDir, { recursive: true });
    }
    
    writeFileSync(filePath, file.content);
    console.log(`Created: ${file.path}`);
  });
  
  console.log('\nDeployment configuration generated successfully!');
  console.log(`Files are available in: ${outputDir}`);
  
  console.log('\nDeployment Instructions:');
  config.instructions.forEach((instruction, index) => {
    console.log(`${index + 1}. ${instruction}`);
  });
  
  console.log('\nFor more information, refer to the deployment guide:');
  console.log('https://github.com/your-org/ultra-modern-mtm/blob/main/docs/DEPLOYMENT_GUIDE.md');
  
} catch (error) {
  console.error('Error generating deployment configuration:', error.message);
  process.exit(1);
}