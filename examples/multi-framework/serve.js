#!/usr/bin/env node

/**
 * Simple HTTP Server for Multi-Framework Examples
 * 
 * Serves the examples with proper MIME types and CORS headers
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';

// MIME types
const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url);
  let pathname = parsedUrl.pathname;

  // Default to index.html
  if (pathname === '/') {
    pathname = '/index.html';
  }

  const filePath = path.join(__dirname, pathname);
  const ext = path.extname(filePath).toLowerCase();
  const mimeType = mimeTypes[ext] || 'application/octet-stream';

  // Security check - prevent directory traversal
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>404 - Not Found</title>
            <style>
              body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
              h1 { color: #e74c3c; }
              a { color: #3498db; text-decoration: none; }
              a:hover { text-decoration: underline; }
            </style>
          </head>
          <body>
            <h1>404 - Page Not Found</h1>
            <p>The requested file <code>${pathname}</code> was not found.</p>
            <p><a href="/">← Back to Multi-Framework Examples</a></p>
          </body>
          </html>
        `);
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('500 Internal Server Error');
      }
      return;
    }

    // Set headers
    res.writeHead(200, {
      'Content-Type': mimeType,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Cache-Control': 'no-cache'
    });

    res.end(data);
  });
});

server.listen(PORT, HOST, () => {
  console.log('🚀 Multi-Framework Examples Server Started!');
  console.log(`📡 Server running at http://${HOST}:${PORT}/`);
  console.log('');
  console.log('🎯 Available Examples:');
  console.log(`• 🏠 Main Navigation: http://${HOST}:${PORT}/`);
  console.log(`• ⚛️ React Examples: http://${HOST}:${PORT}/react/`);
  console.log(`• 💚 Vue Examples: http://${HOST}:${PORT}/vue/`);
  console.log(`• 🧡 Svelte Examples: http://${HOST}:${PORT}/svelte/`);
  console.log(`• 🅰️ Angular Examples: http://${HOST}:${PORT}/angular/`);
  console.log(`• 🟨 Vanilla JS Examples: http://${HOST}:${PORT}/vanilla/`);
  console.log(`• 🔮 MTM Framework Examples: http://${HOST}:${PORT}/mtm/`);
  console.log('');
  console.log('✨ Features to explore:');
  console.log('• Safe property assignment preventing TypeError');
  console.log('• Interactive components with real functionality');
  console.log('• Performance monitoring across frameworks');
  console.log('• Source code viewing with syntax highlighting');
  console.log('• Unified navigation between frameworks');
  console.log('');
  console.log('🛑 Press Ctrl+C to stop the server');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  server.close(() => {
    console.log('✅ Server stopped successfully');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down...');
  server.close(() => {
    console.log('✅ Server stopped successfully');
    process.exit(0);
  });
});