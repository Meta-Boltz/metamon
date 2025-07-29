/**
 * Demo script for testing navigation integration
 */

const { NavigationIntegration } = require('./navigation-integration.js');
const path = require('path');
const fs = require('fs');

async function runNavigationDemo() {
  console.log('🚀 Starting MTM Navigation Integration Demo...\n');

  try {
    // Initialize navigation integration
    const navigation = new NavigationIntegration();

    // Initialize with example pages
    await navigation.initialize('examples/enhanced-mtm/pages');

    // Generate router configuration
    console.log('\n📝 Generating router configuration...');
    const routerConfigPath = path.join('examples/enhanced-mtm', 'mtm-router-config.js');
    navigation.writeRouterConfig(routerConfigPath);

    // Generate navigation tests
    console.log('\n🧪 Generating navigation tests...');
    const testsPath = path.join('examples/enhanced-mtm', 'mtm-navigation-tests.js');
    navigation.writeNavigationTests(testsPath);

    // Create a complete HTML page with navigation
    console.log('\n🌐 Creating navigation demo page...');
    createNavigationDemoPage(navigation);

    console.log('\n✅ Navigation integration demo completed successfully!');
    console.log('\n📋 Generated files:');
    console.log(`  - ${routerConfigPath}`);
    console.log(`  - ${testsPath}`);
    console.log(`  - examples/enhanced-mtm/navigation-demo.html`);

    console.log('\n🔗 To test the navigation:');
    console.log('  1. Open examples/enhanced-mtm/navigation-demo.html in a browser');
    console.log('  2. Click on the navigation links to test client-side routing');
    console.log('  3. Use browser back/forward buttons to test history integration');
    console.log('  4. Check the browser console for test results');

  } catch (error) {
    console.error('❌ Navigation demo failed:', error);
    process.exit(1);
  }
}

/**
 * Create a complete HTML demo page with navigation
 * @param {NavigationIntegration} navigation - Navigation integration instance
 */
function createNavigationDemoPage(navigation) {
  const demoHTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MTM Navigation Integration Demo</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 1200px;
            margin: 0 auto;
            padding: 2rem;
            background: #f8f9fa;
        }
        
        .demo-header {
            text-align: center;
            margin-bottom: 3rem;
            padding: 2rem;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border-radius: 12px;
        }
        
        .demo-header h1 {
            margin: 0 0 1rem;
            font-size: 2.5rem;
        }
        
        .demo-header p {
            margin: 0;
            font-size: 1.2rem;
            opacity: 0.9;
        }
        
        .navigation-demo {
            background: white;
            border-radius: 8px;
            padding: 2rem;
            margin-bottom: 2rem;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }
        
        .navigation-demo h2 {
            margin: 0 0 1.5rem;
            color: #2c3e50;
        }
        
        .nav-links {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 1rem;
            margin-bottom: 2rem;
        }
        
        .nav-link {
            display: block;
            padding: 1.5rem;
            background: #667eea;
            color: white;
            text-decoration: none;
            border-radius: 8px;
            text-align: center;
            transition: all 0.2s;
            font-weight: 600;
        }
        
        .nav-link:hover {
            background: #5a6fd8;
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }
        
        .nav-link.active {
            background: #27ae60;
        }
        
        .nav-link .framework {
            display: block;
            font-size: 0.9rem;
            opacity: 0.8;
            margin-top: 0.5rem;
        }
        
        .current-route {
            padding: 1rem;
            background: #e3f2fd;
            border-radius: 6px;
            margin-bottom: 1.5rem;
            border-left: 4px solid #2196f3;
        }
        
        .current-route strong {
            color: #1976d2;
        }
        
        .browser-controls {
            display: flex;
            gap: 1rem;
            margin-bottom: 1.5rem;
        }
        
        .browser-btn {
            padding: 0.75rem 1.5rem;
            background: #34495e;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 600;
            transition: background 0.2s;
        }
        
        .browser-btn:hover {
            background: #2c3e50;
        }
        
        .browser-btn:disabled {
            background: #95a5a6;
            cursor: not-allowed;
        }
        
        .test-results {
            background: white;
            border-radius: 8px;
            padding: 2rem;
            margin-bottom: 2rem;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }
        
        .test-results h2 {
            margin: 0 0 1.5rem;
            color: #2c3e50;
        }
        
        .test-output {
            background: #2c3e50;
            color: #ecf0f1;
            padding: 1rem;
            border-radius: 6px;
            font-family: 'Monaco', 'Consolas', monospace;
            font-size: 0.9rem;
            line-height: 1.4;
            max-height: 300px;
            overflow-y: auto;
        }
        
        .features-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 1.5rem;
            margin-top: 2rem;
        }
        
        .feature-card {
            background: white;
            border-radius: 8px;
            padding: 1.5rem;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            border-top: 4px solid #667eea;
        }
        
        .feature-card h3 {
            margin: 0 0 1rem;
            color: #2c3e50;
        }
        
        .feature-card ul {
            margin: 0;
            padding-left: 1.5rem;
        }
        
        .feature-card li {
            margin-bottom: 0.5rem;
        }
        
        .status-indicator {
            display: inline-block;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            margin-right: 0.5rem;
        }
        
        .status-indicator.connected {
            background: #27ae60;
        }
        
        .status-indicator.disconnected {
            background: #e74c3c;
        }
    </style>
</head>
<body>
    <div class="demo-header">
        <h1>🔗 MTM Navigation Integration Demo</h1>
        <p>Complete client-side routing with history management and URL updating</p>
    </div>
    
    <div class="navigation-demo">
        <h2>Interactive Navigation</h2>
        
        <div class="current-route">
            <strong>Current Route:</strong> <span id="current-route-display">/</span>
            <span class="status-indicator connected" id="router-status"></span>
            <span id="router-status-text">Router Connected</span>
        </div>
        
        <div class="browser-controls">
            <button class="browser-btn" onclick="goBack()" id="back-btn">← Back</button>
            <button class="browser-btn" onclick="goForward()" id="forward-btn">Forward →</button>
            <button class="browser-btn" onclick="refreshPage()">🔄 Refresh</button>
        </div>
        
        <div class="nav-links">
            <a href="/" class="nav-link" data-route="/">
                🏠 Home Page
                <span class="framework">Pure MTM</span>
            </a>
            <a href="/about" class="nav-link" data-route="/about">
                📖 About Page
                <span class="framework">MTM + Components</span>
            </a>
            <a href="/react-example" class="nav-link" data-route="/react-example">
                ⚛️ React Example
                <span class="framework">React Integration</span>
            </a>
            <a href="/vue-example" class="nav-link" data-route="/vue-example">
                💚 Vue Example
                <span class="framework">Vue Integration</span>
            </a>
            <a href="/solid-example" class="nav-link" data-route="/solid-example">
                🔷 Solid Example
                <span class="framework">Solid.js Integration</span>
            </a>
            <a href="/svelte-example" class="nav-link" data-route="/svelte-example">
                🧡 Svelte Example
                <span class="framework">Svelte Integration</span>
            </a>
        </div>
    </div>
    
    <div class="test-results">
        <h2>🧪 Navigation Test Results</h2>
        <div class="test-output" id="test-output">
            <div>Initializing navigation tests...</div>
        </div>
    </div>
    
    <div class="features-grid">
        <div class="feature-card">
            <h3>✅ Implemented Features</h3>
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
            <h3>🔧 Technical Details</h3>
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
    </div>
    
    <!-- Load router configuration -->
    <script src="mtm-router-config.js"></script>
    
    <!-- Load navigation tests -->
    <script src="mtm-navigation-tests.js"></script>
    
    <script>
        // Demo page functionality
        let testOutput = [];
        
        function updateCurrentRoute() {
            const currentRoute = window.location.pathname;
            document.getElementById('current-route-display').textContent = currentRoute;
            
            // Update active nav link
            document.querySelectorAll('.nav-link').forEach(link => {
                link.classList.remove('active');
                if (link.getAttribute('data-route') === currentRoute) {
                    link.classList.add('active');
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
        
        function addTestOutput(message) {
            testOutput.push(message);
            const outputElement = document.getElementById('test-output');
            outputElement.innerHTML = testOutput.join('<br>');
            outputElement.scrollTop = outputElement.scrollHeight;
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
        
        // Update route display on page load
        document.addEventListener('DOMContentLoaded', () => {
            updateCurrentRoute();
            
            // Check router status
            setTimeout(() => {
                const statusIndicator = document.getElementById('router-status');
                const statusText = document.getElementById('router-status-text');
                
                if (window.mtmRouter) {
                    statusIndicator.className = 'status-indicator connected';
                    statusText.textContent = 'Router Connected';
                    addTestOutput('✅ MTM Router successfully connected');
                } else {
                    statusIndicator.className = 'status-indicator disconnected';
                    statusText.textContent = 'Router Disconnected';
                    addTestOutput('❌ MTM Router not found');
                }
            }, 500);
        });
        
        // Handle popstate for route display updates
        window.addEventListener('popstate', () => {
            setTimeout(updateCurrentRoute, 10);
        });
    </script>
</body>
</html>`;

  const demoPath = path.join('examples/enhanced-mtm', 'navigation-demo.html');

  // Ensure directory exists
  const demoDir = path.dirname(demoPath);
  if (!fs.existsSync(demoDir)) {
    fs.mkdirSync(demoDir, { recursive: true });
  }

  fs.writeFileSync(demoPath, demoHTML, 'utf8');
  console.log(`🌐 Navigation demo page created: ${demoPath}`);
}

// Run the demo
if (require.main === module) {
  runNavigationDemo().catch(console.error);
}

module.exports = { runNavigationDemo };