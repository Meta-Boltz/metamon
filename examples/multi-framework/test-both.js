#!/usr/bin/env node

/**
 * Test Both Approaches Script
 * 
 * Demonstrates the difference between standalone and modular versions
 */

const { exec } = require('child_process');
const path = require('path');

console.log('🔮 MTM Framework - Testing Both Approaches\n');

console.log('📋 Approach Comparison:');
console.log('');
console.log('1. 🏠 STANDALONE VERSION (No Server Required)');
console.log('   • File: standalone.html');
console.log('   • Method: Open directly in browser');
console.log('   • Pros: No server needed, works immediately');
console.log('   • Cons: All code in one file, harder to maintain');
console.log('');
console.log('2. 🏗️ MODULAR VERSION (HTTP Server Required)');
console.log('   • Files: Multiple organized files');
console.log('   • Method: Serve over HTTP');
console.log('   • Pros: Clean architecture, ES6 modules');
console.log('   • Cons: Needs server due to browser CORS policy');
console.log('');

// Determine platform command
let openCommand;
switch (process.platform) {
  case 'darwin': openCommand = 'open'; break;
  case 'win32': openCommand = 'start'; break;
  default: openCommand = 'xdg-open'; break;
}

console.log('🚀 Testing Standalone Version...');
const standalonePath = path.join(__dirname, 'standalone.html');

exec(`${openCommand} "${standalonePath}"`, (error) => {
  if (error) {
    console.log('❌ Could not open standalone version automatically');
    console.log('📖 Manual: Open standalone.html in your browser');
  } else {
    console.log('✅ Standalone version opened in browser');
  }

  console.log('');
  console.log('🏗️ For Modular Version, run:');
  console.log('   npm start    # Start HTTP server');
  console.log('   # Then visit http://localhost:3000');
  console.log('');
  console.log('🎯 Key Takeaway:');
  console.log('   Our MTM Framework is PURE CLIENT-SIDE JavaScript!');
  console.log('   The server is only needed for ES6 module loading during development.');
  console.log('   In production, you can bundle everything into a single file.');
});

console.log('');
console.log('🔍 What to Look For:');
console.log('• ✅ Safe assignment preventing TypeError');
console.log('• ⚡ Dynamic component loading');
console.log('• 🎛️ Interactive components with state');
console.log('• 📊 Performance metrics');
console.log('• 🔮 All running in browser without server!');