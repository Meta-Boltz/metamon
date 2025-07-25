#!/usr/bin/env node

/**
 * Multi-Framework Examples Launcher
 * 
 * Simple script to launch the multi-framework chunk loading examples
 */

const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const mainHtmlPath = path.join(__dirname, 'index.html');

// Check if the main file exists
if (!fs.existsSync(mainHtmlPath)) {
  console.error('❌ Main examples file not found:', mainHtmlPath);
  process.exit(1);
}

console.log('🚀 Launching Multi-Framework Chunk Loading Examples...');
console.log('📁 Main file:', mainHtmlPath);

// Determine the command based on the platform
let openCommand;
switch (process.platform) {
  case 'darwin': // macOS
    openCommand = 'open';
    break;
  case 'win32': // Windows
    openCommand = 'start';
    break;
  default: // Linux and others
    openCommand = 'xdg-open';
    break;
}

// Open the file
exec(`${openCommand} "${mainHtmlPath}"`, (error, stdout, stderr) => {
  if (error) {
    console.error('❌ Failed to open examples:', error.message);
    console.log('\n📖 Manual instructions:');
    console.log('1. Open your web browser');
    console.log('2. Navigate to:', mainHtmlPath);
    console.log('3. Or serve with a local server:');
    console.log('   npx serve . -p 3000');
    console.log('   Then visit: http://localhost:3000/');
    return;
  }

  console.log('✅ Multi-framework examples opened in your default browser!');
  console.log('\n🎯 What you can explore:');
  console.log('• 🏠 Main Navigation - Overview and framework selection');
  console.log('• ⚛️ React Examples - React.lazy() and Suspense');
  console.log('• 💚 Vue Examples - defineAsyncComponent and Composition API');
  console.log('• 🧡 Svelte Examples - Dynamic component factories');
  console.log('• 🅰️ Angular Examples - Dependency injection and services');
  console.log('• 🟨 Vanilla JS Examples - Pure JavaScript implementations');
  console.log('• 🔮 MTM Framework Examples - Our custom framework');

  console.log('\n📊 Features to test:');
  console.log('• ✅ Safe property assignment (no more TypeError!)');
  console.log('• ⚡ Performance monitoring across frameworks');
  console.log('• 🔄 Interactive components with real functionality');
  console.log('• 📝 Source code viewing with syntax highlighting');
  console.log('• 🧭 Unified navigation between frameworks');

  if (stderr) {
    console.log('\nℹ️ Additional info:', stderr);
  }
});

console.log('\n🧪 Testing Options:');
console.log('1. Direct file: Open index.html in your browser');
console.log('2. Local server: npx serve . -p 3000');
console.log('3. Python server: python -m http.server 3000');

console.log('\n📚 Navigation Guide:');
console.log('• Start at the main page (index.html)');
console.log('• Click any framework button to see specific examples');
console.log('• Use the navigation bar to switch between frameworks');
console.log('• Try the interactive components in each framework');
console.log('• Check the performance metrics and source code sections');