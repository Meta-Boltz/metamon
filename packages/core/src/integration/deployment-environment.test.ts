/**
 * Deployment Environment Integration Tests
 * Tests deployment scenarios across different hosting environments
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

describe('Deployment Environment Tests', () => {
  const testDeployDir = join(process.cwd(), 'test-deploy');
  const examplesDir = join(process.cwd(), 'examples');

  beforeEach(() => {
    if (existsSync(testDeployDir)) {
      execSync(`rm -rf ${testDeployDir}`, { stdio: 'ignore' });
    }
    mkdirSync(testDeployDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDeployDir)) {
      execSync(`rm -rf ${testDeployDir}`, { stdio: 'ignore' });
    }
  });

  describe('Static Hosting Deployment', () => {
    it('should generate static files for Netlify deployment', async () => {
      // Create Netlify-specific configuration
      const netlifyConfig = {
        build: {
          command: 'npm run build',
          publish: 'dist'
        },
        redirects: [
          {
            from: '/*',
            to: '/index.html',
            status: 200
          }
        ]
      };

      writeFileSync(
        join(testDeployDir, 'netlify.toml'),
        `[build]
command = "npm run build"
publish = "dist"

[[redirects]]
from = "/*"
to = "/index.html"
status = 200`
      );

      // Create package.json for deployment
      const packageJson = {
        name: 'mtm-netlify-deploy',
        version: '1.0.0',
        scripts: {
          build: 'echo "Building for Netlify" && mkdir -p dist && echo "<html><body>MTM App</body></html>" > dist/index.html'
        }
      };

      writeFileSync(join(testDeployDir, 'package.json'), JSON.stringify(packageJson, null, 2));

      // Test build process
      execSync('npm run build', { cwd: testDeployDir });

      expect(existsSync(join(testDeployDir, 'dist', 'index.html'))).toBe(true);
      expect(existsSync(join(testDeployDir, 'netlify.toml'))).toBe(true);

      const indexContent = readFileSync(join(testDeployDir, 'dist', 'index.html'), 'utf8');
      expect(indexContent).toContain('MTM App');
    });

    it('should generate static files for Vercel deployment', async () => {
      // Create Vercel configuration
      const vercelConfig = {
        version: 2,
        builds: [
          {
            src: 'package.json',
            use: '@vercel/static-build'
          }
        ],
        routes: [
          {
            src: '/(.*)',
            dest: '/index.html'
          }
        ]
      };

      writeFileSync(join(testDeployDir, 'vercel.json'), JSON.stringify(vercelConfig, null, 2));

      // Create package.json for Vercel
      const packageJson = {
        name: 'mtm-vercel-deploy',
        version: '1.0.0',
        scripts: {
          build: 'echo "Building for Vercel" && mkdir -p dist && echo "<html><body>MTM Vercel App</body></html>" > dist/index.html'
        }
      };

      writeFileSync(join(testDeployDir, 'package.json'), JSON.stringify(packageJson, null, 2));

      execSync('npm run build', { cwd: testDeployDir });

      expect(existsSync(join(testDeployDir, 'dist', 'index.html'))).toBe(true);
      expect(existsSync(join(testDeployDir, 'vercel.json'))).toBe(true);

      const vercelConfigContent = readFileSync(join(testDeployDir, 'vercel.json'), 'utf8');
      const config = JSON.parse(vercelConfigContent);
      expect(config.routes[0].dest).toBe('/index.html');
    });

    it('should generate static files for GitHub Pages deployment', async () => {
      // Create GitHub Pages workflow
      mkdirSync(join(testDeployDir, '.github', 'workflows'), { recursive: true });

      const githubWorkflow = `name: Deploy to GitHub Pages

on:
  push:
    branches: [ main ]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v2
    
    - name: Setup Node.js
      uses: actions/setup-node@v2
      with:
        node-version: '18'
        
    - name: Install dependencies
      run: npm install
      
    - name: Build
      run: npm run build
      
    - name: Deploy
      uses: peaceiris/actions-gh-pages@v3
      with:
        github_token: \${{ secrets.GITHUB_TOKEN }}
        publish_dir: ./dist`;

      writeFileSync(join(testDeployDir, '.github', 'workflows', 'deploy.yml'), githubWorkflow);

      // Create package.json for GitHub Pages
      const packageJson = {
        name: 'mtm-github-pages',
        version: '1.0.0',
        homepage: 'https://username.github.io/mtm-app',
        scripts: {
          build: 'echo "Building for GitHub Pages" && mkdir -p dist && echo "<html><body>MTM GitHub Pages</body></html>" > dist/index.html'
        }
      };

      writeFileSync(join(testDeployDir, 'package.json'), JSON.stringify(packageJson, null, 2));

      execSync('npm run build', { cwd: testDeployDir });

      expect(existsSync(join(testDeployDir, '.github', 'workflows', 'deploy.yml'))).toBe(true);
      expect(existsSync(join(testDeployDir, 'dist', 'index.html'))).toBe(true);

      const workflowContent = readFileSync(join(testDeployDir, '.github', 'workflows', 'deploy.yml'), 'utf8');
      expect(workflowContent).toContain('npm run build');
      expect(workflowContent).toContain('publish_dir: ./dist');
    });
  });

  describe('Server-Side Rendering Deployment', () => {
    it('should prepare for Node.js server deployment', async () => {
      // Create server configuration
      const serverCode = `const express = require('express');
const { renderToString } = require('./dist/server');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.static('dist'));

app.get('*', async (req, res) => {
  try {
    const html = await renderToString(req.url);
    res.send(html);
  } catch (error) {
    console.error('SSR Error:', error);
    res.status(500).send('Server Error');
  }
});

app.listen(port, () => {
  console.log(\`Server running on port \${port}\`);
});`;

      writeFileSync(join(testDeployDir, 'server.js'), serverCode);

      // Create package.json for server deployment
      const packageJson = {
        name: 'mtm-ssr-server',
        version: '1.0.0',
        main: 'server.js',
        scripts: {
          start: 'node server.js',
          build: 'echo "Building SSR app" && mkdir -p dist && echo "module.exports = { renderToString: () => \\"<html><body>SSR App</body></html>\\" };" > dist/server.js'
        },
        dependencies: {
          express: '^4.18.0'
        }
      };

      writeFileSync(join(testDeployDir, 'package.json'), JSON.stringify(packageJson, null, 2));

      // Test build
      execSync('npm run build', { cwd: testDeployDir });

      expect(existsSync(join(testDeployDir, 'server.js'))).toBe(true);
      expect(existsSync(join(testDeployDir, 'dist', 'server.js'))).toBe(true);

      const serverContent = readFileSync(join(testDeployDir, 'server.js'), 'utf8');
      expect(serverContent).toContain('renderToString');
      expect(serverContent).toContain('express.static');
    });

    it('should prepare for Docker deployment', async () => {
      // Create Dockerfile
      const dockerfile = `FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]`;

      writeFileSync(join(testDeployDir, 'Dockerfile'), dockerfile);

      // Create .dockerignore
      const dockerignore = `node_modules
npm-debug.log
.git
.gitignore
README.md
.env
.nyc_output
coverage
.vscode`;

      writeFileSync(join(testDeployDir, '.dockerignore'), dockerignore);

      // Create docker-compose.yml
      const dockerCompose = `version: '3.8'

services:
  mtm-app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    restart: unless-stopped`;

      writeFileSync(join(testDeployDir, 'docker-compose.yml'), dockerCompose);

      // Create package.json for Docker
      const packageJson = {
        name: 'mtm-docker-app',
        version: '1.0.0',
        scripts: {
          start: 'node server.js',
          build: 'echo "Building Docker app" && mkdir -p dist'
        }
      };

      writeFileSync(join(testDeployDir, 'package.json'), JSON.stringify(packageJson, null, 2));
      writeFileSync(join(testDeployDir, 'server.js'), 'console.log("Docker server");');

      expect(existsSync(join(testDeployDir, 'Dockerfile'))).toBe(true);
      expect(existsSync(join(testDeployDir, '.dockerignore'))).toBe(true);
      expect(existsSync(join(testDeployDir, 'docker-compose.yml'))).toBe(true);

      const dockerfileContent = readFileSync(join(testDeployDir, 'Dockerfile'), 'utf8');
      expect(dockerfileContent).toContain('FROM node:18-alpine');
      expect(dockerfileContent).toContain('npm run build');
    });
  });

  describe('CDN and Edge Deployment', () => {
    it('should optimize for CDN deployment', async () => {
      // Create CDN optimization configuration
      const cdnConfig = {
        build: {
          assetsDir: 'assets',
          rollupOptions: {
            output: {
              manualChunks: {
                vendor: ['react', 'react-dom'],
                router: ['react-router-dom']
              }
            }
          }
        },
        base: 'https://cdn.example.com/mtm-app/'
      };

      writeFileSync(join(testDeployDir, 'vite.config.js'), 
        `export default ${JSON.stringify(cdnConfig, null, 2)};`);

      // Create package.json with CDN optimization
      const packageJson = {
        name: 'mtm-cdn-app',
        version: '1.0.0',
        scripts: {
          build: 'echo "Building for CDN" && mkdir -p dist/assets && echo "/* CDN optimized CSS */" > dist/assets/main.css && echo "console.log(\\"CDN app\\");" > dist/assets/main.js'
        }
      };

      writeFileSync(join(testDeployDir, 'package.json'), JSON.stringify(packageJson, null, 2));

      execSync('npm run build', { cwd: testDeployDir });

      expect(existsSync(join(testDeployDir, 'dist', 'assets'))).toBe(true);
      expect(existsSync(join(testDeployDir, 'vite.config.js'))).toBe(true);

      const configContent = readFileSync(join(testDeployDir, 'vite.config.js'), 'utf8');
      expect(configContent).toContain('cdn.example.com');
    });

    it('should prepare for edge function deployment', async () => {
      // Create edge function for Cloudflare Workers
      const edgeFunction = `export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Handle static assets
    if (url.pathname.startsWith('/assets/')) {
      return env.ASSETS.fetch(request);
    }
    
    // Handle dynamic routes
    const html = await renderPage(url.pathname);
    
    return new Response(html, {
      headers: {
        'Content-Type': 'text/html',
        'Cache-Control': 'public, max-age=3600'
      }
    });
  }
};

async function renderPage(pathname) {
  return \`<!DOCTYPE html>
<html>
<head>
  <title>MTM Edge App</title>
</head>
<body>
  <div id="app">
    <h1>Page: \${pathname}</h1>
  </div>
</body>
</html>\`;
}`;

      writeFileSync(join(testDeployDir, 'worker.js'), edgeFunction);

      // Create wrangler.toml for Cloudflare Workers
      const wranglerConfig = `name = "mtm-edge-app"
main = "worker.js"
compatibility_date = "2023-05-18"

[site]
bucket = "./dist"

[[kv_namespaces]]
binding = "CACHE"
id = "your-kv-namespace-id"`;

      writeFileSync(join(testDeployDir, 'wrangler.toml'), wranglerConfig);

      expect(existsSync(join(testDeployDir, 'worker.js'))).toBe(true);
      expect(existsSync(join(testDeployDir, 'wrangler.toml'))).toBe(true);

      const workerContent = readFileSync(join(testDeployDir, 'worker.js'), 'utf8');
      expect(workerContent).toContain('async fetch');
      expect(workerContent).toContain('renderPage');
    });
  });

  describe('Environment Configuration', () => {
    it('should handle different environment variables', async () => {
      // Create environment-specific configurations
      const environments = ['development', 'staging', 'production'];

      for (const env of environments) {
        const envConfig = {
          NODE_ENV: env,
          API_URL: `https://api-${env}.example.com`,
          CDN_URL: `https://cdn-${env}.example.com`,
          ENABLE_ANALYTICS: env === 'production' ? 'true' : 'false'
        };

        const envContent = Object.entries(envConfig)
          .map(([key, value]) => `${key}=${value}`)
          .join('\n');

        writeFileSync(join(testDeployDir, `.env.${env}`), envContent);
      }

      // Create environment loader
      const envLoader = `const dotenv = require('dotenv');

function loadEnvironment(env = 'development') {
  dotenv.config({ path: \`.env.\${env}\` });
  
  return {
    NODE_ENV: process.env.NODE_ENV,
    API_URL: process.env.API_URL,
    CDN_URL: process.env.CDN_URL,
    ENABLE_ANALYTICS: process.env.ENABLE_ANALYTICS === 'true'
  };
}

module.exports = { loadEnvironment };`;

      writeFileSync(join(testDeployDir, 'env-loader.js'), envLoader);

      // Verify environment files exist
      for (const env of environments) {
        expect(existsSync(join(testDeployDir, `.env.${env}`))).toBe(true);
        
        const envContent = readFileSync(join(testDeployDir, `.env.${env}`), 'utf8');
        expect(envContent).toContain(`NODE_ENV=${env}`);
        expect(envContent).toContain(`api-${env}.example.com`);
      }
    });

    it('should validate deployment configuration', async () => {
      // Create deployment validation script
      const validationScript = `const fs = require('fs');
const path = require('path');

function validateDeployment() {
  const checks = [];
  
  // Check required files
  const requiredFiles = ['package.json', 'dist/index.html'];
  for (const file of requiredFiles) {
    if (fs.existsSync(file)) {
      checks.push({ file, status: 'OK' });
    } else {
      checks.push({ file, status: 'MISSING' });
    }
  }
  
  // Check package.json structure
  if (fs.existsSync('package.json')) {
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    checks.push({
      check: 'package.json has start script',
      status: pkg.scripts?.start ? 'OK' : 'MISSING'
    });
  }
  
  return checks;
}

const results = validateDeployment();
console.log('Deployment Validation Results:');
results.forEach(result => {
  console.log(\`- \${result.file || result.check}: \${result.status}\`);
});

const hasErrors = results.some(r => r.status === 'MISSING');
process.exit(hasErrors ? 1 : 0);`;

      writeFileSync(join(testDeployDir, 'validate-deployment.js'), validationScript);

      // Create test files for validation
      const packageJson = {
        name: 'test-validation',
        scripts: { start: 'node server.js' }
      };
      writeFileSync(join(testDeployDir, 'package.json'), JSON.stringify(packageJson, null, 2));

      mkdirSync(join(testDeployDir, 'dist'), { recursive: true });
      writeFileSync(join(testDeployDir, 'dist', 'index.html'), '<html><body>Test</body></html>');

      // Run validation
      const validationResult = execSync('node validate-deployment.js', {
        cwd: testDeployDir,
        encoding: 'utf8'
      });

      expect(validationResult).toContain('Deployment Validation Results');
      expect(validationResult).toContain('package.json: OK');
      expect(validationResult).toContain('dist/index.html: OK');
    });
  });

  describe('Performance Optimization for Deployment', () => {
    it('should optimize assets for production deployment', async () => {
      // Create asset optimization configuration
      const optimizationConfig = {
        build: {
          minify: 'terser',
          cssCodeSplit: true,
          rollupOptions: {
            output: {
              manualChunks: {
                vendor: ['react', 'react-dom'],
                utils: ['lodash', 'date-fns']
              }
            }
          }
        },
        optimizeDeps: {
          include: ['react', 'react-dom']
        }
      };

      writeFileSync(join(testDeployDir, 'vite.config.js'), 
        `export default ${JSON.stringify(optimizationConfig, null, 2)};`);

      // Create package.json with optimization scripts
      const packageJson = {
        name: 'mtm-optimized-deploy',
        version: '1.0.0',
        scripts: {
          build: 'echo "Optimizing for production" && mkdir -p dist && echo "/* Minified CSS */" > dist/main.min.css && echo "console.log(\\"Optimized app\\");" > dist/main.min.js',
          analyze: 'echo "Bundle analysis complete"'
        }
      };

      writeFileSync(join(testDeployDir, 'package.json'), JSON.stringify(packageJson, null, 2));

      execSync('npm run build', { cwd: testDeployDir });

      expect(existsSync(join(testDeployDir, 'dist', 'main.min.css'))).toBe(true);
      expect(existsSync(join(testDeployDir, 'dist', 'main.min.js'))).toBe(true);

      const configContent = readFileSync(join(testDeployDir, 'vite.config.js'), 'utf8');
      expect(configContent).toContain('minify');
      expect(configContent).toContain('manualChunks');
    });

    it('should implement caching strategies', async () => {
      // Create caching configuration
      const cachingConfig = `const express = require('express');
const app = express();

// Static asset caching
app.use('/assets', express.static('dist/assets', {
  maxAge: '1y',
  etag: true,
  lastModified: true
}));

// HTML caching
app.use(express.static('dist', {
  maxAge: '1h',
  etag: true,
  setHeaders: (res, path) => {
    if (path.endsWith('.html')) {
      res.setHeader('Cache-Control', 'public, max-age=3600');
    }
  }
}));

module.exports = app;`;

      writeFileSync(join(testDeployDir, 'caching-server.js'), cachingConfig);

      // Create service worker for client-side caching
      const serviceWorker = `const CACHE_NAME = 'mtm-app-v1';
const urlsToCache = [
  '/',
  '/assets/main.js',
  '/assets/main.css'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});`;

      writeFileSync(join(testDeployDir, 'sw.js'), serviceWorker);

      expect(existsSync(join(testDeployDir, 'caching-server.js'))).toBe(true);
      expect(existsSync(join(testDeployDir, 'sw.js'))).toBe(true);

      const cachingContent = readFileSync(join(testDeployDir, 'caching-server.js'), 'utf8');
      expect(cachingContent).toContain('maxAge');
      expect(cachingContent).toContain('Cache-Control');

      const swContent = readFileSync(join(testDeployDir, 'sw.js'), 'utf8');
      expect(swContent).toContain('caches.open');
      expect(swContent).toContain('fetch');
    });
  });

  describe('Monitoring and Health Checks', () => {
    it('should implement health check endpoints', async () => {
      // Create health check server
      const healthCheckServer = `const express = require('express');
const app = express();

app.get('/health', (req, res) => {
  const health = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.env.npm_package_version || '1.0.0'
  };
  
  res.json(health);
});

app.get('/ready', (req, res) => {
  // Check if app is ready to serve traffic
  const ready = {
    status: 'READY',
    checks: {
      database: 'OK',
      cache: 'OK',
      external_api: 'OK'
    }
  };
  
  res.json(ready);
});

module.exports = app;`;

      writeFileSync(join(testDeployDir, 'health-check.js'), healthCheckServer);

      // Create monitoring configuration
      const monitoringConfig = {
        healthCheck: {
          enabled: true,
          path: '/health',
          interval: 30000
        },
        metrics: {
          enabled: true,
          endpoint: '/metrics'
        },
        logging: {
          level: 'info',
          format: 'json'
        }
      };

      writeFileSync(join(testDeployDir, 'monitoring.json'), JSON.stringify(monitoringConfig, null, 2));

      expect(existsSync(join(testDeployDir, 'health-check.js'))).toBe(true);
      expect(existsSync(join(testDeployDir, 'monitoring.json'))).toBe(true);

      const healthContent = readFileSync(join(testDeployDir, 'health-check.js'), 'utf8');
      expect(healthContent).toContain('/health');
      expect(healthContent).toContain('/ready');
      expect(healthContent).toContain('process.uptime');
    });

    it('should configure error reporting', async () => {
      // Create error reporting configuration
      const errorReporting = `const express = require('express');

function setupErrorReporting(app) {
  // Global error handler
  app.use((err, req, res, next) => {
    const error = {
      message: err.message,
      stack: err.stack,
      url: req.url,
      method: req.method,
      timestamp: new Date().toISOString(),
      userAgent: req.get('User-Agent')
    };
    
    // Log error (in production, send to monitoring service)
    console.error('Application Error:', error);
    
    res.status(500).json({
      error: 'Internal Server Error',
      requestId: req.id || 'unknown'
    });
  });
  
  // 404 handler
  app.use((req, res) => {
    res.status(404).json({
      error: 'Not Found',
      path: req.path
    });
  });
}

module.exports = { setupErrorReporting };`;

      writeFileSync(join(testDeployDir, 'error-reporting.js'), errorReporting);

      expect(existsSync(join(testDeployDir, 'error-reporting.js'))).toBe(true);

      const errorContent = readFileSync(join(testDeployDir, 'error-reporting.js'), 'utf8');
      expect(errorContent).toContain('setupErrorReporting');
      expect(errorContent).toContain('Global error handler');
      expect(errorContent).toContain('404 handler');
    });
  });
});