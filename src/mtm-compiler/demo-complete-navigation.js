/**
 * Complete navigation system demonstration
 * Shows the full integration working with all example pages
 */

const { NavigationIntegration } = require('./navigation-integration.js');
const path = require('path');
const fs = require('fs');

async function runCompleteNavigationDemo() {
  console.log('🚀 Starting Complete MTM Navigation System Demo...\n');

  try {
    // Initialize navigation integration with real example pages
    const navigation = new NavigationIntegration();
    await navigation.initialize('examples/enhanced-mtm/pages');

    console.log('\n📊 Navigation System Summary:');
    console.log('='.repeat(50));

    // Display discovered pages
    console.log(`📄 Discovered Pages: ${navigation.examplePages.length}`);
    for (const page of navigation.examplePages) {
      console.log(`  • ${page.route} - ${page.title} (${page.framework})`);
    }

    // Display registered routes
    const routes = navigation.routeRegistry.getAll();
    console.log(`\n🔗 Registered Routes: ${routes.size}`);
    for (const [route, config] of routes) {
      console.log(`  • ${route} → ${config.component}`);
    }

    // Generate and save all navigation files
    console.log('\n📝 Generating Navigation Files...');

    const outputDir = 'examples/enhanced-mtm';

    // Generate router configuration
    const routerConfigPath = path.join(outputDir, 'mtm-enhanced-router.js');
    navigation.writeRouterConfig(routerConfigPath);

    // Generate navigation tests
    const testsPath = path.join(outputDir, 'mtm-navigation-tests.js');
    navigation.writeNavigationTests(testsPath);

    // Create a comprehensive demo page
    console.log('\n🌐 Creating Complete Demo Page...');
    createCompleteDemoPage(navigation, outputDir);

    // Create a simple server script for testing
    console.log('\n🖥️  Creating Development Server...');
    createDevServer(outputDir);

    console.log('\n✅ Complete Navigation System Demo Finished!');
    console.log('\n📋 Generated Files:');
    console.log(`  - ${routerConfigPath}`);
    console.log(`  - ${testsPath}`);
    console.log(`  - ${path.join(outputDir, 'complete-navigation-demo.html')}`);
    console.log(`  - ${path.join(outputDir, 'dev-server.js')}`);

    console.log('\n🔗 To test the complete navigation system:');
    console.log('  1. cd examples/enhanced-mtm');
    console.log('  2. node dev-server.js');
    console.log('  3. Open http://localhost:3000 in your browser');
    console.log('  4. Test all navigation features:');
    console.log('     • Click navigation links for client-side routing');
    console.log('     • Use browser back/forward buttons');
    console.log('     • Bookmark pages and test URL sharing');
    console.log('     • Check console for test results');

    // Run validation tests
    console.log('\n🧪 Running Navigation Validation...');
    await runNavigationValidation(navigation);

  } catch (error) {
    console.error('❌ Complete navigation demo failed:', error);
    process.exit(1);
  }
}

/**
 * Create a comprehensive demo page showcasing all navigation features
 */
function createCompleteDemoPage(navigation, outputDir) {
  const demoHTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Complete MTM Navigation System Demo</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 2rem;
        }
        
        .demo-header {
            text-align: center;
            margin-bottom: 3rem;
            padding: 3rem 2rem;
            background: rgba(255, 255, 255, 0.95);
            border-radius: 20px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
        }
        
        .demo-header h1 {
            font-size: 3rem;
            margin-bottom: 1rem;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        
        .demo-header p {
            font-size: 1.3rem;
            color: #666;
            margin-bottom: 2rem;
        }
        
        .status-bar {
            display: flex;
            justify-content: center;
            gap: 2rem;
            flex-wrap: wrap;
        }
        
        .status-item {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.75rem 1.5rem;
            background: #f8f9fa;
            border-radius: 25px;
            font-weight: 600;
        }
        
        .status-indicator {
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: #27ae60;
        }
        
        .navigation-section {
            background: rgba(255, 255, 255, 0.95);
            border-radius: 20px;
            padding: 2rem;
            margin-bottom: 2rem;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
        }
        
        .navigation-section h2 {
            margin-bottom: 1.5rem;
            color: #2c3e50;
            font-size: 1.8rem;
        }
        
        .current-route {
            padding: 1rem;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border-radius: 10px;
            margin-bottom: 2rem;
            text-align: center;
            font-size: 1.1rem;
            font-weight: 600;
        }
        
        .browser-controls {
            display: flex;
            justify-content: center;
            gap: 1rem;
            margin-bottom: 2rem;
            flex-wrap: wrap;
        }
        
        .browser-btn {
            padding: 0.75rem 1.5rem;
            background: #34495e;
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 600;
            transition: all 0.3s ease;
            font-size: 1rem;
        }
        
        .browser-btn:hover {
            background: #2c3e50;
            transform: translateY(-2px);
        }
        
        .browser-btn:disabled {
            background: #95a5a6;
            cursor: not-allowed;
            transform: none;
        }
        
        .nav-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 1.5rem;
            margin-bottom: 2rem;
        }
        
        .nav-card {
            display: block;
            padding: 2rem;
            background: white;
            border-radius: 15px;
            text-decoration: none;
            color: inherit;
            transition: all 0.3s ease;
            border: 2px solid transparent;
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.08);
        }
        
        .nav-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 15px 35px rgba(0, 0, 0, 0.15);
            border-color: #667eea;
        }
        
        .nav-card.active {
            border-color: #27ae60;
            background: linear-gradient(135deg, #27ae60 0%, #2ecc71 100%);
            color: white;
        }
        
        .nav-card-icon {
            font-size: 3rem;
            margin-bottom: 1rem;
            display: block;
            text-align: center;
        }
        
        .nav-card-title {
            font-size: 1.3rem;
            font-weight: 700;
            margin-bottom: 0.5rem;
            text-align: center;
        }
        
        .nav-card-desc {
            font-size: 0.95rem;
            opacity: 0.8;
            text-align: center;
            margin-bottom: 1rem;
        }
        
        .nav-card-framework {
            display: inline-block;
            padding: 0.25rem 0.75rem;
            background: rgba(102, 126, 234, 0.1);
            color: #667eea;
            border-radius: 15px;
            font-size: 0.8rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        .nav-card.active .nav-card-framework {
            background: rgba(255, 255, 255, 0.2);
            color: white;
        }
        
        .test-section {
            background: rgba(255, 255, 255, 0.95);
            border-radius: 20px;
            padding: 2rem;
            margin-bottom: 2rem;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
        }
        
        .test-output {
            background: #2c3e50;
            color: #ecf0f1;
            padding: 1.5rem;
            border-radius: 10px;
            font-family: 'Monaco', 'Consolas', monospace;
            font-size: 0.9rem;
            line-height: 1.5;
            max-height: 400px;
            overflow-y: auto;
            white-space: pre-wrap;
        }
        
        .features-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
            gap: 2rem;
            margin-top: 2rem;
        }
        
        .feature-card {
            background: rgba(255, 255, 255, 0.95);
            border-radius: 15px;
            padding: 2rem;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
            border-top: 4px solid #667eea;
        }
        
        .feature-card h3 {
            margin-bottom: 1rem;
            color: #2c3e50;
            font-size: 1.3rem;
        }
        
        .feature-card ul {
            list-style: none;
            padding: 0;
        }
        
        .feature-card li {
            padding: 0.5rem 0;
            border-bottom: 1px solid #eee;
            position: relative;
            padding-left: 1.5rem;
        }
        
        .feature-card li:before {
            content: '✅';
            position: absolute;
            left: 0;
        }
        
        .feature-card li:last-child {
            border-bottom: none;
        }
        
        .footer {
            text-align: center;
            padding: 2rem;
            background: rgba(255, 255, 255, 0.95);
            border-radius: 20px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
            margin-top: 2rem;
        }
        
        .footer p {
            color: #666;
            font-size: 1.1rem;
        }
        
        @media (max-width: 768px) {
            .demo-header h1 {
                font-size: 2rem;
            }
            
            .nav-grid {
                grid-template-columns: 1fr;
            }
            
            .browser-controls {
                flex-direction: column;
                align-items: center;
            }
            
            .status-bar {
                flex-direction: column;
                align-items: center;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="demo-header">
            <h1>🔗 Complete MTM Navigation System</h1>
            <p>Full-featured client-side routing with multi-framework support</p>
            
            <div class="status-bar">
                <div class="status-item">
                    <div class="status-indicator" id="router-status"></div>
                    <span id="router-status-text">Router Status</span>
                </div>
                <div class="status-item">
                    <div class="status-indicator" id="routes-status"></div>
                    <span id="routes-status-text">Routes Loaded</span>
                </div>
                <div class="status-item">
                    <div class="status-indicator" id="tests-status"></div>
                    <span id="tests-status-text">Tests Status</span>
                </div>
            </div>
        </div>
        
        <div class="navigation-section">
            <h2>🧭 Interactive Navigation</h2>
            
            <div class="current-route">
                <strong>Current Route:</strong> <span id="current-route-display">/</span>
            </div>
            
            <div class="browser-controls">
                <button class="browser-btn" onclick="goBack()" id="back-btn">← Back</button>
                <button class="browser-btn" onclick="goForward()" id="forward-btn">Forward →</button>
                <button class="browser-btn" onclick="refreshPage()">🔄 Refresh</button>
                <button class="browser-btn" onclick="testNavigation()">🧪 Run Tests</button>
            </div>
            
            <div class="nav-grid">
                ${navigation.examplePages.map(page => `
                <a href="${page.route}" class="nav-card" data-route="${page.route}">
                    <div class="nav-card-icon">${getFrameworkIcon(page.framework)}</div>
                    <div class="nav-card-title">${page.title}</div>
                    <div class="nav-card-desc">${page.description}</div>
                    <div class="nav-card-framework">${page.framework}</div>
                </a>
                `).join('')}
            </div>
        </div>
        
        <div class="test-section">
            <h2>🧪 Navigation Test Results</h2>
            <div class="test-output" id="test-output">
                <div>🔄 Initializing navigation tests...</div>
            </div>
        </div>
        
        <div class="features-grid">
            <div class="feature-card">
                <h3>🚀 Core Features</h3>
                <ul>
                    <li>Client-side routing with anchor tag interception</li>
                    <li>Browser history integration (back/forward buttons)</li>
                    <li>URL updating and bookmarking support</li>
                    <li>Route change event system</li>
                    <li>External link handling</li>
                    <li>Route validation and conflict detection</li>
                </ul>
            </div>
            
            <div class="feature-card">
                <h3>🔧 Technical Implementation</h3>
                <ul>
                    <li>RouteRegistry for route management</li>
                    <li>ClientRouter for navigation handling</li>
                    <li>Automatic route discovery from MTM files</li>
                    <li>Frontmatter-based route configuration</li>
                    <li>Multi-framework component support</li>
                    <li>Comprehensive integration testing</li>
                </ul>
            </div>
            
            <div class="feature-card">
                <h3>🎯 User Experience</h3>
                <ul>
                    <li>Fast client-side navigation</li>
                    <li>Seamless page transitions</li>
                    <li>Bookmarkable URLs</li>
                    <li>Browser back/forward support</li>
                    <li>Keyboard navigation support</li>
                    <li>Right-click context menu support</li>
                </ul>
            </div>
            
            <div class="feature-card">
                <h3>🌐 Framework Support</h3>
                <ul>
                    <li>Pure MTM syntax with signals</li>
                    <li>React components with hooks</li>
                    <li>Vue components with Composition API</li>
                    <li>Solid.js with fine-grained reactivity</li>
                    <li>Svelte components with stores</li>
                    <li>Mixed framework pages</li>
                </ul>
            </div>
        </div>
        
        <div class="footer">
            <p>🎉 Complete MTM Navigation System - Ready for Production!</p>
        </div>
    </div>
    
    <!-- Load router configuration -->
    <script src="mtm-enhanced-router.js"></script>
    
    <!-- Load navigation tests -->
    <script src="mtm-navigation-tests.js"></script>
    
    <script>
        // Demo page functionality
        let testOutput = [];
        
        function getFrameworkIcon(framework) {
            const icons = {
                'mtm': '🔮',
                'react': '⚛️',
                'vue': '💚',
                'solid': '🔷',
                'svelte': '🧡'
            };
            return icons[framework] || '📄';
        }
        
        function updateCurrentRoute() {
            const currentRoute = window.location.pathname;
            document.getElementById('current-route-display').textContent = currentRoute;
            
            // Update active nav card
            document.querySelectorAll('.nav-card').forEach(card => {
                card.classList.remove('active');
                if (card.getAttribute('data-route') === currentRoute) {
                    card.classList.add('active');
                }
            });
        }
        
        function goBack() {
            if (window.mtmRouter) {
                window.mtmRouter.back();
            } else {
                window.history.back();
            }
        }
        
        function goForward() {
            if (window.mtmRouter) {
                window.mtmRouter.forward();
            } else {
                window.history.forward();
            }
        }
        
        function refreshPage() {
            window.location.reload();
        }
        
        function testNavigation() {
            if (window.MTMNavigationTests) {
                const tests = new window.MTMNavigationTests();
                tests.runAllTests();
            } else {
                addTestOutput('❌ Navigation tests not available');
            }
        }
        
        function addTestOutput(message) {
            testOutput.push(message);
            const outputElement = document.getElementById('test-output');
            outputElement.textContent = testOutput.join('\\n');
            outputElement.scrollTop = outputElement.scrollHeight;
        }
        
        function updateStatus(elementId, textId, status, text) {
            const indicator = document.getElementById(elementId);
            const textElement = document.getElementById(textId);
            
            if (status) {
                indicator.style.background = '#27ae60';
                textElement.textContent = text || 'Connected';
            } else {
                indicator.style.background = '#e74c3c';
                textElement.textContent = text || 'Disconnected';
            }
        }
        
        // Override console.log to capture test output
        const originalConsoleLog = console.log;
        console.log = function(...args) {
            originalConsoleLog.apply(console, args);
            addTestOutput(args.join(' '));
        };
        
        // Listen for route changes
        document.addEventListener('mtm:route-change', (event) => {
            updateCurrentRoute();
            addTestOutput(\`🔗 Route changed to: \${event.detail.path}\`);
        });
        
        // Initialize on page load
        document.addEventListener('DOMContentLoaded', () => {
            updateCurrentRoute();
            
            // Check system status
            setTimeout(() => {
                // Router status
                if (window.mtmRouter) {
                    updateStatus('router-status', 'router-status-text', true, 'Router Active');
                    addTestOutput('✅ MTM Enhanced Router connected');
                } else {
                    updateStatus('router-status', 'router-status-text', false, 'Router Failed');
                    addTestOutput('❌ MTM Enhanced Router not found');
                }
                
                // Routes status
                if (window.MTM_ROUTES && Object.keys(window.MTM_ROUTES).length > 0) {
                    updateStatus('routes-status', 'routes-status-text', true, \`\${Object.keys(window.MTM_ROUTES).length} Routes\`);
                    addTestOutput(\`✅ \${Object.keys(window.MTM_ROUTES).length} routes loaded\`);
                } else {
                    updateStatus('routes-status', 'routes-status-text', false, 'No Routes');
                    addTestOutput('❌ No routes found');
                }
                
                // Tests status
                if (window.MTMNavigationTests) {
                    updateStatus('tests-status', 'tests-status-text', true, 'Tests Ready');
                    addTestOutput('✅ Navigation tests available');
                } else {
                    updateStatus('tests-status', 'tests-status-text', false, 'Tests Failed');
                    addTestOutput('❌ Navigation tests not available');
                }
                
                // Auto-run tests after a delay
                setTimeout(() => {
                    addTestOutput('\\n🚀 Auto-running navigation tests...');
                    testNavigation();
                }, 2000);
                
            }, 1000);
        });
        
        // Handle popstate for route display updates
        window.addEventListener('popstate', () => {
            setTimeout(updateCurrentRoute, 10);
        });
    </script>
</body>
</html>`;

  const demoPath = path.join(outputDir, 'complete-navigation-demo.html');
  fs.writeFileSync(demoPath, demoHTML, 'utf8');
  console.log(`🌐 Complete demo page created: ${demoPath}`);
}

/**
 * Get framework icon for display
 */
function getFrameworkIcon(framework) {
  const icons = {
    'mtm': '🔮',
    'react': '⚛️',
    'vue': '💚',
    'solid': '🔷',
    'svelte': '🧡'
  };
  return icons[framework] || '📄';
}

/**
 * Create a simple development server for testing
 */
function createDevServer(outputDir) {
  const serverScript = `/**
 * Simple development server for testing MTM navigation
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 3000;

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
  
  // Handle root path
  if (pathname === '/') {
    pathname = '/complete-navigation-demo.html';
  }
  
  // Remove leading slash
  const filePath = path.join(__dirname, pathname.substring(1));
  
  // Check if file exists
  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      // File not found - serve the demo page for client-side routing
      const demoPath = path.join(__dirname, 'complete-navigation-demo.html');
      fs.readFile(demoPath, (err, data) => {
        if (err) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('404 Not Found');
          return;
        }
        
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(data);
      });
      return;
    }
    
    // File exists - serve it
    const ext = path.extname(filePath);
    const contentType = mimeTypes[ext] || 'text/plain';
    
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('500 Internal Server Error');
        return;
      }
      
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    });
  });
});

server.listen(PORT, () => {
  console.log(\`🖥️  MTM Navigation Demo Server running at http://localhost:\${PORT}\`);
  console.log('📄 Serving complete-navigation-demo.html');
  console.log('🔗 All routes will be handled by client-side router');
  console.log('\\nPress Ctrl+C to stop the server');
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\\n👋 Shutting down server...');
  server.close(() => {
    console.log('✅ Server stopped');
    process.exit(0);
  });
});`;

  const serverPath = path.join(outputDir, 'dev-server.js');
  fs.writeFileSync(serverPath, serverScript, 'utf8');
  console.log(`🖥️  Development server created: ${serverPath}`);
}

/**
 * Run navigation validation tests
 */
async function runNavigationValidation(navigation) {
  console.log('🔍 Validating navigation system...');

  const validationResults = [];

  // Test 1: Route registry validation
  try {
    const routes = navigation.routeRegistry.getAll();
    const validationErrors = navigation.routeRegistry.validateRoutes();

    if (validationErrors.length === 0) {
      validationResults.push({ test: 'Route Registry', status: 'PASS', message: `${routes.size} routes registered successfully` });
    } else {
      validationResults.push({ test: 'Route Registry', status: 'FAIL', message: `${validationErrors.length} validation errors` });
    }
  } catch (error) {
    validationResults.push({ test: 'Route Registry', status: 'FAIL', message: error.message });
  }

  // Test 2: Page discovery validation
  try {
    const expectedPages = ['/', '/about', '/react-example', '/vue-example', '/solid-example', '/svelte-example'];
    const discoveredRoutes = navigation.examplePages.map(p => p.route);

    const missingPages = expectedPages.filter(route => !discoveredRoutes.includes(route));

    if (missingPages.length === 0) {
      validationResults.push({ test: 'Page Discovery', status: 'PASS', message: 'All expected pages discovered' });
    } else {
      validationResults.push({ test: 'Page Discovery', status: 'FAIL', message: `Missing pages: ${missingPages.join(', ')}` });
    }
  } catch (error) {
    validationResults.push({ test: 'Page Discovery', status: 'FAIL', message: error.message });
  }

  // Test 3: Configuration generation validation
  try {
    const config = navigation.generateRouterConfig();

    if (config.includes('window.MTM_ROUTES') && config.includes('class MTMEnhancedRouter')) {
      validationResults.push({ test: 'Configuration Generation', status: 'PASS', message: 'Router configuration generated successfully' });
    } else {
      validationResults.push({ test: 'Configuration Generation', status: 'FAIL', message: 'Invalid router configuration' });
    }
  } catch (error) {
    validationResults.push({ test: 'Configuration Generation', status: 'FAIL', message: error.message });
  }

  // Test 4: Framework support validation
  try {
    const frameworks = [...new Set(navigation.examplePages.map(p => p.framework))];
    const expectedFrameworks = ['mtm', 'react', 'vue', 'solid', 'svelte'];

    const supportedFrameworks = expectedFrameworks.filter(fw => frameworks.includes(fw));

    if (supportedFrameworks.length >= 4) {
      validationResults.push({ test: 'Framework Support', status: 'PASS', message: `${supportedFrameworks.length} frameworks supported` });
    } else {
      validationResults.push({ test: 'Framework Support', status: 'FAIL', message: `Only ${supportedFrameworks.length} frameworks supported` });
    }
  } catch (error) {
    validationResults.push({ test: 'Framework Support', status: 'FAIL', message: error.message });
  }

  // Report validation results
  console.log('\\n📊 Navigation Validation Results:');
  console.log('='.repeat(50));

  let passed = 0;
  let failed = 0;

  for (const result of validationResults) {
    const status = result.status === 'PASS' ? '✅' : '❌';
    console.log(`${status} ${result.test}: ${result.message}`);

    if (result.status === 'PASS') {
      passed++;
    } else {
      failed++;
    }
  }

  console.log('='.repeat(50));
  console.log(`Total: ${validationResults.length} | Passed: ${passed} | Failed: ${failed}`);

  if (failed === 0) {
    console.log('🎉 All navigation validation tests passed!');
  } else {
    console.log(`⚠️  ${failed} validation test(s) failed.`);
  }
}

// Run the complete demo
if (require.main === module) {
  runCompleteNavigationDemo().catch(console.error);
}

module.exports = { runCompleteNavigationDemo };