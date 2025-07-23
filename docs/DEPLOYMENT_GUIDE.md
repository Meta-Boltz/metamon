# Ultra-Modern MTM Deployment Guide

This guide provides comprehensive instructions for deploying Ultra-Modern MTM applications in various environments. It covers static hosting, server-side rendering, containerization, and serverless deployments.

## Table of Contents

- [Deployment Prerequisites](#deployment-prerequisites)
- [Static Hosting Deployment](#static-hosting-deployment)
  - [Netlify Deployment](#netlify-deployment)
  - [Vercel Deployment](#vercel-deployment)
  - [GitHub Pages Deployment](#github-pages-deployment)
- [Server-Side Rendering Deployment](#server-side-rendering-deployment)
  - [Node.js Server Deployment](#nodejs-server-deployment)
  - [Docker Deployment](#docker-deployment)
- [CDN and Edge Deployment](#cdn-and-edge-deployment)
  - [CDN Configuration](#cdn-configuration)
  - [Edge Functions](#edge-functions)
- [Environment Configuration](#environment-configuration)
- [Performance Optimization](#performance-optimization)
- [Monitoring and Health Checks](#monitoring-and-health-checks)
- [Security Best Practices](#security-best-practices)
- [Troubleshooting](#troubleshooting)

## Deployment Prerequisites

Before deploying your Ultra-Modern MTM application, ensure you have:

1. A production-ready build of your application
2. Node.js 18.x or later installed
3. Proper environment configuration files
4. Required API keys and secrets

To create a production build:

```bash
# Install dependencies
npm install

# Build for production
npm run build
```

This will generate optimized assets in the `dist` directory.

## Static Hosting Deployment

### Netlify Deployment

1. Create a `netlify.toml` file in your project root:

```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

2. Deploy using Netlify CLI:

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Deploy to Netlify
netlify deploy --prod
```

3. Alternatively, connect your repository to Netlify for automatic deployments.

### Vercel Deployment

1. Create a `vercel.json` file in your project root:

```json
{
  "version": 2,
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/static-build"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/index.html"
    }
  ]
}
```

2. Deploy using Vercel CLI:

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy to Vercel
vercel --prod
```

3. Alternatively, connect your repository to Vercel for automatic deployments.

### GitHub Pages Deployment

1. Create a GitHub Actions workflow file at `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2

      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: "18"

      - name: Install dependencies
        run: npm install

      - name: Build
        run: npm run build

      - name: Deploy
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

2. Configure your repository settings to enable GitHub Pages from the `gh-pages` branch.

3. Push to your main branch to trigger the deployment workflow.

## Server-Side Rendering Deployment

### Node.js Server Deployment

1. Create a `server.js` file in your project root:

```javascript
const express = require("express");
const { renderToString } = require("./dist/server");

const app = express();
const port = process.env.PORT || 3000;

// Serve static assets
app.use(express.static("dist"));

// Handle all routes with SSR
app.get("*", async (req, res) => {
  try {
    const html = await renderToString(req.url);
    res.send(html);
  } catch (error) {
    console.error("SSR Error:", error);
    res.status(500).send("Server Error");
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
```

2. Update your `package.json` to include a start script:

```json
{
  "scripts": {
    "start": "node server.js"
  }
}
```

3. Deploy to your Node.js hosting provider:

```bash
# Example for Heroku
heroku create
git push heroku main
```

### Docker Deployment

1. Create a `Dockerfile` in your project root:

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["node", "server.js"]
```

2. Create a `.dockerignore` file:

```
node_modules
npm-debug.log
.git
.gitignore
README.md
.env
.nyc_output
coverage
.vscode
```

3. Create a `docker-compose.yml` file for local testing:

```yaml
version: "3.8"

services:
  mtm-app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    restart: unless-stopped
```

4. Build and run your Docker container:

```bash
# Build the Docker image
docker build -t mtm-app .

# Run the container
docker run -p 3000:3000 mtm-app

# Alternatively, use docker-compose
docker-compose up
```

5. Deploy to container orchestration platforms like Kubernetes, AWS ECS, or Google Cloud Run.

## CDN and Edge Deployment

### CDN Configuration

1. Configure your build for CDN deployment in `vite.config.js`:

```javascript
export default {
  build: {
    assetsDir: "assets",
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom"],
          router: ["react-router-dom"],
        },
      },
    },
  },
  base: "https://cdn.example.com/mtm-app/",
};
```

2. Set up proper cache headers for different asset types:

```
# Example Nginx configuration
location /assets/ {
  expires 1y;
  add_header Cache-Control "public, max-age=31536000, immutable";
}

location / {
  expires 1h;
  add_header Cache-Control "public, max-age=3600";
}
```

### Edge Functions

1. For Cloudflare Workers, create a `worker.js` file:

```javascript
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Handle static assets
    if (url.pathname.startsWith("/assets/")) {
      return env.ASSETS.fetch(request);
    }

    // Handle dynamic routes
    const html = await renderPage(url.pathname);

    return new Response(html, {
      headers: {
        "Content-Type": "text/html",
        "Cache-Control": "public, max-age=3600",
      },
    });
  },
};

async function renderPage(pathname) {
  // Implement page rendering logic
  return `<!DOCTYPE html>
<html>
<head>
  <title>MTM Edge App</title>
</head>
<body>
  <div id="app">
    <h1>Page: ${pathname}</h1>
  </div>
</body>
</html>`;
}
```

2. Create a `wrangler.toml` configuration file:

```toml
name = "mtm-edge-app"
main = "worker.js"
compatibility_date = "2023-05-18"

[site]
bucket = "./dist"

[[kv_namespaces]]
binding = "CACHE"
id = "your-kv-namespace-id"
```

3. Deploy to Cloudflare Workers:

```bash
# Install Wrangler CLI
npm install -g wrangler

# Deploy to Cloudflare Workers
wrangler publish
```

## Environment Configuration

1. Create environment-specific configuration files:

```
.env.development
.env.staging
.env.production
```

2. Example environment file structure:

```
NODE_ENV=production
API_URL=https://api.example.com
CDN_URL=https://cdn.example.com
ENABLE_ANALYTICS=true
```

3. Create an environment loader utility:

```javascript
const dotenv = require("dotenv");

function loadEnvironment(env = "development") {
  dotenv.config({ path: `.env.${env}` });

  return {
    NODE_ENV: process.env.NODE_ENV,
    API_URL: process.env.API_URL,
    CDN_URL: process.env.CDN_URL,
    ENABLE_ANALYTICS: process.env.ENABLE_ANALYTICS === "true",
  };
}

module.exports = { loadEnvironment };
```

4. Use environment variables in your application:

```javascript
const env = loadEnvironment(process.env.NODE_ENV);
console.log(`API URL: ${env.API_URL}`);
```

## Performance Optimization

1. Implement code splitting and lazy loading:

```javascript
// In your route configuration
const routes = [
  {
    path: "/",
    component: () => import("./pages/Home.js"),
  },
  {
    path: "/about",
    component: () => import("./pages/About.js"),
  },
];
```

2. Optimize images and assets:

```javascript
// In vite.config.js
export default {
  build: {
    assetsInlineLimit: 4096, // Inline assets smaller than 4KB
    chunkSizeWarningLimit: 500, // Warn when chunks exceed 500KB
  },
};
```

3. Implement intelligent preloading:

```javascript
// Preload likely next routes
function preloadNextRoutes(currentRoute) {
  if (currentRoute === "/") {
    import("./pages/About.js");
  } else if (currentRoute === "/about") {
    import("./pages/Contact.js");
  }
}
```

4. Optimize CSS delivery:

```javascript
// Extract critical CSS
const criticalCSS = extractCriticalCSS(html);
return `
<!DOCTYPE html>
<html>
<head>
  <style>${criticalCSS}</style>
  <link rel="preload" href="/assets/styles.css" as="style" onload="this.onload=null;this.rel='stylesheet'">
</head>
<body>
  ${html}
</body>
</html>
`;
```

## Monitoring and Health Checks

1. Implement health check endpoints:

```javascript
app.get("/health", (req, res) => {
  const health = {
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.env.npm_package_version || "1.0.0",
  };

  res.json(health);
});

app.get("/ready", (req, res) => {
  // Check if app is ready to serve traffic
  const ready = {
    status: "READY",
    checks: {
      database: "OK",
      cache: "OK",
      external_api: "OK",
    },
  };

  res.json(ready);
});
```

2. Configure error reporting:

```javascript
function setupErrorReporting(app) {
  // Global error handler
  app.use((err, req, res, next) => {
    const error = {
      message: err.message,
      stack: err.stack,
      url: req.url,
      method: req.method,
      timestamp: new Date().toISOString(),
      userAgent: req.get("User-Agent"),
    };

    // Log error (in production, send to monitoring service)
    console.error("Application Error:", error);

    res.status(500).json({
      error: "Internal Server Error",
      requestId: req.id || "unknown",
    });
  });

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({
      error: "Not Found",
      path: req.path,
    });
  });
}
```

3. Implement performance monitoring:

```javascript
class PerformanceMonitor {
  constructor() {
    this.metrics = {
      buildTime: 0,
      firstContentfulPaint: 0,
      timeToInteractive: 0,
      totalBlockingTime: 0,
      largestContentfulPaint: 0,
    };
  }

  recordBuildMetrics(buildStats) {
    this.metrics.buildTime = buildStats.time;
    this.metrics.bundleSize = buildStats.size;
  }

  recordRuntimeMetrics() {
    // Record Web Vitals metrics
    if (typeof window !== "undefined") {
      // Implement Web Vitals recording
    }
  }

  generateReport() {
    return {
      timestamp: new Date().toISOString(),
      metrics: this.metrics,
      assessment: this.assessPerformance(),
    };
  }
}
```

## Security Best Practices

1. Implement input validation:

```javascript
function validateInput(input, schema) {
  const errors = [];

  Object.entries(schema).forEach(([field, rules]) => {
    const value = input[field];

    // Required check
    if (
      rules.required &&
      (value === undefined || value === null || value === "")
    ) {
      errors.push(`${field} is required`);
    }

    // Type check
    if (value !== undefined && value !== null) {
      if (rules.type === "string" && typeof value !== "string") {
        errors.push(`${field} must be a string`);
      }
    }

    // Pattern check
    if (
      rules.pattern &&
      typeof value === "string" &&
      !rules.pattern.test(value)
    ) {
      errors.push(`${field} does not match required pattern`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}
```

2. Implement output sanitization:

```javascript
function sanitizeHTML(input) {
  if (!input) return "";

  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
```

3. Set secure HTTP headers:

```javascript
app.use((req, res, next) => {
  // Security headers
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains"
  );
  res.setHeader("Content-Security-Policy", "default-src 'self'");
  next();
});
```

4. Implement CSRF protection:

```javascript
const csrf = require("csurf");
const csrfProtection = csrf({ cookie: true });

app.use(csrfProtection);

app.get("/form", (req, res) => {
  res.send(`
    <form action="/submit" method="post">
      <input type="hidden" name="_csrf" value="${req.csrfToken()}">
      <button type="submit">Submit</button>
    </form>
  `);
});
```

## Troubleshooting

### Common Deployment Issues

1. **404 errors on page refresh**

   Solution: Configure server to redirect all requests to index.html for SPA routing:

   ```
   # Nginx
   location / {
     try_files $uri $uri/ /index.html;
   }

   # Apache (.htaccess)
   RewriteEngine On
   RewriteBase /
   RewriteRule ^index\.html$ - [L]
   RewriteCond %{REQUEST_FILENAME} !-f
   RewriteCond %{REQUEST_FILENAME} !-d
   RewriteRule . /index.html [L]
   ```

2. **Environment variables not available in client code**

   Solution: Prefix client-side environment variables with `VITE_` and access them via `import.meta.env`:

   ```javascript
   // .env.production
   VITE_API_URL=https://api.example.com

   // In client code
   const apiUrl = import.meta.env.VITE_API_URL;
   ```

3. **SSR hydration mismatch errors**

   Solution: Ensure server and client render the same content:

   ```javascript
   // Use the same data on server and client
   export async function getServerData(url) {
     const data = await fetchData(url);
     return data;
   }

   // In SSR
   const data = await getServerData(url);
   const html = renderComponent(data);

   // In client
   const data = window.__INITIAL_DATA__;
   hydrate(data);
   ```

4. **Performance issues in production**

   Solution: Implement performance monitoring and optimization:

   ```javascript
   // Monitor Web Vitals
   import { getCLS, getFID, getLCP } from "web-vitals";

   function sendToAnalytics({ name, delta, id }) {
     console.log(`Metric: ${name} ${delta}`);
     // Send to analytics service
   }

   getCLS(sendToAnalytics);
   getFID(sendToAnalytics);
   getLCP(sendToAnalytics);
   ```

For more troubleshooting information, refer to the [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) document.
