# Ultra-Modern MTM Deployment Troubleshooting Guide

This guide provides solutions for common issues encountered when deploying Ultra-Modern MTM applications.

## Table of Contents

- [Build Issues](#build-issues)
- [Static Hosting Issues](#static-hosting-issues)
- [Server-Side Rendering Issues](#server-side-rendering-issues)
- [Routing Issues](#routing-issues)
- [Performance Issues](#performance-issues)
- [Environment Configuration Issues](#environment-configuration-issues)
- [Docker Deployment Issues](#docker-deployment-issues)
- [CDN and Edge Issues](#cdn-and-edge-issues)
- [Monitoring and Logging Issues](#monitoring-and-logging-issues)
- [Security Issues](#security-issues)

## Build Issues

### Error: Cannot find module 'vite'

**Problem**: The build fails with an error indicating that Vite cannot be found.

**Solution**: Install Vite as a dependency:

```bash
npm install vite --save-dev
```

### Error: Failed to resolve import

**Problem**: The build fails with an error about unresolved imports.

**Solution**: Check that all imports are correctly specified and that the referenced modules are installed:

```bash
# Check for missing dependencies
npm ls

# Install any missing dependencies
npm install <missing-dependency>
```

### Error: Out of memory

**Problem**: The build process runs out of memory, especially with large projects.

**Solution**: Increase the Node.js memory limit:

```bash
# For npm scripts
NODE_OPTIONS=--max_old_space_size=4096 npm run build

# For direct Node.js execution
node --max_old_space_size=4096 ./node_modules/.bin/vite build
```

### Error: TypeScript errors in build

**Problem**: The build fails due to TypeScript type errors.

**Solution**: Fix the type errors or temporarily disable type checking during build:

```javascript
// In vite.config.js
export default {
  esbuild: {
    logOverride: { "this-is-undefined-in-esm": "silent" },
  },
};
```

## Static Hosting Issues

### 404 errors on page refresh

**Problem**: When refreshing the page on a route like `/about`, the server returns a 404 error.

**Solution**: Configure your static hosting provider to redirect all requests to `index.html`:

For Netlify, add to `netlify.toml`:

```toml
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

For Vercel, add to `vercel.json`:

```json
{
  "routes": [{ "src": "/(.*)", "dest": "/index.html" }]
}
```

For Apache (.htaccess):

```apache
RewriteEngine On
RewriteBase /
RewriteRule ^index\.html$ - [L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.html [L]
```

For Nginx:

```nginx
location / {
  try_files $uri $uri/ /index.html;
}
```

### Assets not loading

**Problem**: CSS, JavaScript, or image assets fail to load in production.

**Solution**: Check that the asset paths are correct and that the base URL is properly configured:

```javascript
// In vite.config.js
export default {
  base: "/", // Change this if your app is not hosted at the root
};
```

If your app is hosted in a subdirectory, update the base path:

```javascript
export default {
  base: "/my-app/", // For apps hosted at example.com/my-app/
};
```

### CORS errors

**Problem**: API requests fail due to Cross-Origin Resource Sharing (CORS) errors.

**Solution**: Configure your API server to allow requests from your frontend domain:

```javascript
// Example for Express.js API server
const cors = require("cors");
app.use(
  cors({
    origin: "https://your-frontend-domain.com",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
```

## Server-Side Rendering Issues

### Hydration mismatch errors

**Problem**: React/Vue warns about hydration mismatches between server and client rendering.

**Solution**: Ensure that server and client render the same content:

1. Make sure any dynamic content (like dates or random values) is consistent between server and client.
2. Use the same data on both sides:

```javascript
// Server-side
const data = await fetchData();
const html = renderApp(data);
const serializedData = JSON.stringify(data);

// Include the data in the HTML
const fullHtml = `
  <html>
    <body>
      <div id="app">${html}</div>
      <script>window.__INITIAL_DATA__ = ${serializedData};</script>
      <script src="/assets/main.js"></script>
    </body>
  </html>
`;

// Client-side
const data = window.__INITIAL_DATA__;
hydrate(App, { data }, document.getElementById("app"));
```

### Memory leaks in SSR

**Problem**: The server-side rendering process consumes increasing amounts of memory over time.

**Solution**: Implement proper cleanup and garbage collection:

```javascript
// Use a render cache with TTL
const renderCache = new Map();

async function renderWithCache(url) {
  if (renderCache.has(url)) {
    return renderCache.get(url);
  }

  const result = await renderToString(url);

  // Cache with 5-minute TTL
  renderCache.set(url, result);
  setTimeout(() => renderCache.delete(url), 5 * 60 * 1000);

  return result;
}

// Periodically force garbage collection if using --expose-gc
setInterval(() => {
  if (global.gc) {
    global.gc();
  }
}, 30 * 60 * 1000); // Every 30 minutes
```

### SSR performance issues

**Problem**: Server-side rendering is slow, especially under load.

**Solution**: Implement SSR optimization techniques:

1. Use streaming SSR where supported:

```javascript
app.get("*", (req, res) => {
  const stream = renderToNodeStream(req.url);

  res.write(
    '<!DOCTYPE html><html><head><title>My App</title></head><body><div id="app">'
  );

  stream.pipe(res, { end: false });

  stream.on("end", () => {
    res.write('</div><script src="/assets/main.js"></script></body></html>');
    res.end();
  });
});
```

2. Implement component-level caching:

```javascript
const componentCache = new Map();

function CachedComponent({ cacheKey, ttl = 60000, ...props }) {
  if (componentCache.has(cacheKey)) {
    return componentCache.get(cacheKey);
  }

  const rendered = <ActualComponent {...props} />;
  componentCache.set(cacheKey, rendered);

  setTimeout(() => componentCache.delete(cacheKey), ttl);

  return rendered;
}
```

3. Use worker threads for CPU-intensive rendering:

```javascript
const { Worker } = require("worker_threads");

function renderInWorker(url) {
  return new Promise((resolve, reject) => {
    const worker = new Worker("./render-worker.js");

    worker.on("message", resolve);
    worker.on("error", reject);
    worker.on("exit", (code) => {
      if (code !== 0) {
        reject(new Error(`Worker stopped with exit code ${code}`));
      }
    });

    worker.postMessage({ url });
  });
}
```

## Routing Issues

### Dynamic routes not working

**Problem**: Dynamic routes like `/products/:id` don't work correctly.

**Solution**: Ensure your route configuration correctly handles dynamic parameters:

```javascript
// Check your route definitions
const routes = [
  {
    path: "/products/:id",
    component: ProductDetail,
  },
];

// Make sure your server configuration handles these routes
app.get("*", (req, res) => {
  // All routes should be handled by the SPA
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});
```

### Nested routes not working

**Problem**: Nested routes don't render correctly.

**Solution**: Verify your route configuration and component structure:

```javascript
// Route configuration
const routes = [
  {
    path: "/dashboard",
    component: Dashboard,
    children: [
      {
        path: "profile",
        component: Profile,
      },
      {
        path: "settings",
        component: Settings,
      },
    ],
  },
];

// Dashboard component should include an outlet/router-view
function Dashboard() {
  return (
    <div>
      <h1>Dashboard</h1>
      <nav>
        <Link to="/dashboard/profile">Profile</Link>
        <Link to="/dashboard/settings">Settings</Link>
      </nav>
      <Outlet /> {/* This is where child routes render */}
    </div>
  );
}
```

### Internationalized routes not working

**Problem**: Routes with language prefixes like `/en/about` or `/fr/about` don't work correctly.

**Solution**: Configure your routing to handle language prefixes:

```javascript
// Route configuration with i18n
const routes = [
  {
    path: "/:lang",
    children: [
      {
        path: "",
        component: Home,
      },
      {
        path: "about",
        component: About,
      },
    ],
  },
  // Fallback route
  {
    path: "/",
    redirect: "/en",
  },
];

// Access the language parameter in components
function About() {
  const params = useParams();
  const lang = params.lang || "en";

  // Use the language parameter to load translations
  const translations = useTranslations(lang);

  return (
    <div>
      <h1>{translations.about.title}</h1>
      <p>{translations.about.content}</p>
    </div>
  );
}
```

## Performance Issues

### Slow initial load

**Problem**: The application takes too long to load initially.

**Solution**: Implement performance optimizations:

1. Code splitting:

```javascript
// Use dynamic imports for route components
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

2. Optimize bundle size:

```javascript
// In vite.config.js
export default {
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom"],
          utils: ["lodash", "date-fns"],
        },
      },
    },
  },
};
```

3. Implement critical CSS extraction:

```javascript
// Extract critical CSS during SSR
const criticalCSS = extractCriticalCSS(html);

// Include it inline in the head
const fullHtml = `
  <html>
    <head>
      <style>${criticalCSS}</style>
      <link rel="preload" href="/assets/styles.css" as="style" onload="this.onload=null;this.rel='stylesheet'">
    </head>
    <body>
      <div id="app">${html}</div>
    </body>
  </html>
`;
```

### Poor runtime performance

**Problem**: The application is sluggish during use, with slow interactions and animations.

**Solution**: Optimize runtime performance:

1. Implement memoization for expensive computations:

```javascript
import { useMemo } from "react";

function MyComponent({ data }) {
  const processedData = useMemo(() => {
    return expensiveDataProcessing(data);
  }, [data]);

  return <div>{processedData}</div>;
}
```

2. Use virtualization for long lists:

```javascript
import { FixedSizeList } from "react-window";

function MyList({ items }) {
  return (
    <FixedSizeList
      height={500}
      width={300}
      itemCount={items.length}
      itemSize={50}
    >
      {({ index, style }) => <div style={style}>{items[index].name}</div>}
    </FixedSizeList>
  );
}
```

3. Optimize re-renders:

```javascript
import { memo } from "react";

const MemoizedComponent = memo(function Component(props) {
  return <div>{props.value}</div>;
});
```

### Large bundle sizes

**Problem**: JavaScript bundles are too large, causing slow downloads.

**Solution**: Analyze and optimize bundle sizes:

1. Use bundle analyzer to identify large dependencies:

```bash
npm install rollup-plugin-visualizer --save-dev
```

```javascript
// In vite.config.js
import { visualizer } from "rollup-plugin-visualizer";

export default {
  plugins: [
    visualizer({
      open: true,
      gzipSize: true,
      brotliSize: true,
    }),
  ],
};
```

2. Replace large dependencies with smaller alternatives:

```javascript
// Instead of moment.js
import { format } from "date-fns";

// Instead of lodash
import debounce from "lodash/debounce";
```

3. Implement tree-shaking optimization:

```javascript
// In vite.config.js
export default {
  build: {
    minify: "terser",
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
  },
};
```

## Environment Configuration Issues

### Environment variables not available

**Problem**: Environment variables are not accessible in the application.

**Solution**: Ensure environment variables are properly configured:

1. For client-side code, prefix variables with `VITE_`:

```
# .env.production
VITE_API_URL=https://api.example.com
```

```javascript
// In client code
const apiUrl = import.meta.env.VITE_API_URL;
```

2. For server-side code, use dotenv:

```javascript
// In server.js
require("dotenv").config({ path: `.env.${process.env.NODE_ENV}` });

const apiUrl = process.env.API_URL;
```

### Different configurations for environments

**Problem**: Need different configurations for development, staging, and production.

**Solution**: Use environment-specific configuration files:

```
.env.development
.env.staging
.env.production
```

Load the appropriate file based on the environment:

```javascript
// In server.js
const env = process.env.NODE_ENV || "development";
require("dotenv").config({ path: `.env.${env}` });
```

For client-side code with Vite:

```bash
# Development
npm run dev

# Staging
npm run build -- --mode staging

# Production
npm run build
```

### Secrets exposed in client code

**Problem**: Sensitive information like API keys is exposed in client-side code.

**Solution**: Keep secrets on the server side:

1. Create a proxy API endpoint:

```javascript
// In server.js
app.get("/api/data", (req, res) => {
  const apiKey = process.env.API_KEY; // Keep secret on server

  fetch(`https://external-api.com/data?key=${apiKey}`)
    .then((response) => response.json())
    .then((data) => res.json(data))
    .catch((error) => res.status(500).json({ error: error.message }));
});
```

2. Use environment variables only on the server:

```javascript
// Only expose safe variables to the client
const clientEnv = {
  API_URL: process.env.PUBLIC_API_URL,
  APP_VERSION: process.env.APP_VERSION,
};

// Don't include sensitive variables like API_KEY
```

## Docker Deployment Issues

### Container build failures

**Problem**: Docker container build fails with errors.

**Solution**: Debug and fix Docker build issues:

1. Check for Node.js version compatibility:

```dockerfile
# Use a specific Node.js version
FROM node:18-alpine
```

2. Ensure all dependencies are installed:

```dockerfile
COPY package*.json ./
RUN npm ci --only=production
```

3. Use multi-stage builds for smaller images:

```dockerfile
# Build stage
FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM node:18-alpine
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/package*.json ./
RUN npm ci --only=production
EXPOSE 3000
CMD ["node", "server.js"]
```

### Container runtime issues

**Problem**: Application doesn't run correctly inside Docker container.

**Solution**: Debug container runtime issues:

1. Check for proper port exposure:

```dockerfile
EXPOSE 3000
```

```bash
docker run -p 3000:3000 my-app
```

2. Ensure environment variables are set:

```bash
docker run -p 3000:3000 -e NODE_ENV=production -e API_URL=https://api.example.com my-app
```

3. Check for file permission issues:

```dockerfile
# Set proper permissions
RUN chown -R node:node /app
USER node
```

4. Check container logs:

```bash
docker logs <container-id>
```

### Docker Compose networking issues

**Problem**: Services in Docker Compose can't communicate with each other.

**Solution**: Configure Docker Compose networking:

```yaml
# docker-compose.yml
version: "3.8"

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - API_URL=http://api:4000
    depends_on:
      - api

  api:
    build: ./api
    ports:
      - "4000:4000"
    environment:
      - NODE_ENV=production
      - DB_HOST=db
    depends_on:
      - db

  db:
    image: postgres:14
    volumes:
      - db-data:/var/lib/postgresql/data
    environment:
      - POSTGRES_PASSWORD=secret
      - POSTGRES_USER=myuser
      - POSTGRES_DB=mydb

volumes:
  db-data:
```

## CDN and Edge Issues

### Assets not being served from CDN

**Problem**: Assets are not being served from the CDN.

**Solution**: Configure CDN integration:

1. Set the correct base URL:

```javascript
// In vite.config.js
export default {
  base: "https://cdn.example.com/my-app/",
};
```

2. Configure cache headers:

```
# For Netlify (_headers file)
/assets/*
  Cache-Control: public, max-age=31536000, immutable

/*
  Cache-Control: public, max-age=3600
```

3. Verify CDN configuration:

```bash
# Check if assets are being served from CDN
curl -I https://cdn.example.com/my-app/assets/main.js
```

### Edge function deployment issues

**Problem**: Edge functions fail to deploy or run correctly.

**Solution**: Debug edge function issues:

1. Check for supported JavaScript features:

```javascript
// Use features supported by your edge runtime
// Avoid Node.js-specific APIs in edge functions

// Instead of fs
const data = await fetch("/api/data").then((res) => res.json());

// Instead of process.env
const env = context.env;
```

2. Optimize for edge runtime limits:

```javascript
// Keep functions small and focused
export default {
  async fetch(request, env, ctx) {
    // Simple routing
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      return handleApi(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};
```

3. Check logs and debugging tools:

```bash
# For Cloudflare Workers
wrangler tail
```

## Monitoring and Logging Issues

### Missing logs in production

**Problem**: Application logs are not available or incomplete in production.

**Solution**: Implement proper logging:

1. Configure a production-ready logger:

```javascript
const winston = require("winston");

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: "error.log", level: "error" }),
    new winston.transports.File({ filename: "combined.log" }),
  ],
});

// In production, add remote logging
if (process.env.NODE_ENV === "production") {
  logger.add(
    new winston.transports.Http({
      host: "logs-api.example.com",
      path: "/logs",
      ssl: true,
    })
  );
}
```

2. Use structured logging:

```javascript
logger.info("User action", {
  userId: "123",
  action: "login",
  timestamp: new Date().toISOString(),
  metadata: {
    ip: req.ip,
    userAgent: req.headers["user-agent"],
  },
});
```

3. Implement log rotation:

```javascript
const { createLogger, format, transports } = require("winston");
require("winston-daily-rotate-file");

const fileRotateTransport = new transports.DailyRotateFile({
  filename: "application-%DATE%.log",
  datePattern: "YYYY-MM-DD",
  maxSize: "20m",
  maxFiles: "14d",
});

const logger = createLogger({
  transports: [fileRotateTransport, new transports.Console()],
});
```

### Performance metrics not available

**Problem**: Unable to monitor application performance in production.

**Solution**: Implement performance monitoring:

1. Collect Web Vitals metrics:

```javascript
import { getCLS, getFID, getLCP, getTTFB, getFCP } from "web-vitals";

function sendToAnalytics(metric) {
  const body = JSON.stringify({
    name: metric.name,
    value: metric.value,
    id: metric.id,
    page: window.location.pathname,
  });

  navigator.sendBeacon("/analytics", body);
}

getCLS(sendToAnalytics);
getFID(sendToAnalytics);
getLCP(sendToAnalytics);
getTTFB(sendToAnalytics);
getFCP(sendToAnalytics);
```

2. Implement server-side metrics:

```javascript
const promClient = require("prom-client");

// Create a Registry to register metrics
const register = new promClient.Registry();

// Create metrics
const httpRequestDurationMicroseconds = new promClient.Histogram({
  name: "http_request_duration_seconds",
  help: "Duration of HTTP requests in seconds",
  labelNames: ["method", "route", "status"],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
});

// Register metrics
register.registerMetric(httpRequestDurationMicroseconds);

// Middleware to collect metrics
app.use((req, res, next) => {
  const end = httpRequestDurationMicroseconds.startTimer();

  res.on("finish", () => {
    end({
      method: req.method,
      route: req.route?.path || req.path,
      status: res.statusCode,
    });
  });

  next();
});

// Expose metrics endpoint
app.get("/metrics", async (req, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});
```

3. Set up health check endpoints:

```javascript
app.get("/health", (req, res) => {
  res.json({
    status: "UP",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.get("/ready", (req, res) => {
  // Check dependencies
  const dbStatus = checkDatabaseConnection();
  const cacheStatus = checkCacheConnection();

  if (dbStatus && cacheStatus) {
    res.json({ status: "READY" });
  } else {
    res.status(503).json({
      status: "NOT_READY",
      details: {
        database: dbStatus ? "UP" : "DOWN",
        cache: cacheStatus ? "UP" : "DOWN",
      },
    });
  }
});
```

## Security Issues

### Content Security Policy (CSP) violations

**Problem**: Browser console shows CSP violations, blocking scripts or styles.

**Solution**: Configure proper Content Security Policy:

1. Set up CSP headers:

```javascript
app.use((req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    `
    default-src 'self';
    script-src 'self' https://trusted-cdn.example.com;
    style-src 'self' https://trusted-cdn.example.com;
    img-src 'self' https://trusted-cdn.example.com data:;
    font-src 'self' https://trusted-cdn.example.com;
    connect-src 'self' https://api.example.com;
  `
      .replace(/\s+/g, " ")
      .trim()
  );

  next();
});
```

2. For inline scripts, use nonces:

```javascript
app.use((req, res, next) => {
  // Generate a new nonce for each request
  const nonce = crypto.randomBytes(16).toString("base64");
  res.locals.nonce = nonce;

  res.setHeader(
    "Content-Security-Policy",
    `
    script-src 'self' 'nonce-${nonce}';
  `
  );

  next();
});
```

```html
<script nonce="<%= nonce %>">
  // Inline script
</script>
```

### CORS issues with API requests

**Problem**: API requests fail due to CORS errors.

**Solution**: Configure CORS properly:

1. Server-side CORS configuration:

```javascript
const cors = require("cors");

// Basic CORS
app.use(cors());

// Configured CORS
app.use(
  cors({
    origin: ["https://example.com", "https://www.example.com"],
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
    maxAge: 86400, // 24 hours
  })
);

// Per-route CORS
app.get("/api/public", cors(), (req, res) => {
  res.json({ message: "Public API" });
});

app.get(
  "/api/restricted",
  cors({ origin: "https://admin.example.com" }),
  (req, res) => {
    res.json({ message: "Restricted API" });
  }
);
```

2. Handle preflight requests:

```javascript
app.options("*", cors()); // Enable preflight for all routes
```

### Authentication token issues

**Problem**: Authentication tokens are not working correctly in production.

**Solution**: Debug and fix authentication issues:

1. Check token storage:

```javascript
// Use HttpOnly cookies for better security
app.post("/api/login", (req, res) => {
  // Authenticate user
  const token = generateToken(user);

  res.cookie("auth_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  res.json({ success: true });
});
```

2. Verify token configuration:

```javascript
// Verify tokens properly
app.use((req, res, next) => {
  const token = req.cookies.auth_token;

  if (!token) {
    return next();
  }

  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    // Token invalid or expired
    res.clearCookie("auth_token");
    next();
  }
});
```

3. Handle token refresh:

```javascript
app.post("/api/refresh-token", (req, res) => {
  const refreshToken = req.cookies.refresh_token;

  if (!refreshToken) {
    return res.status(401).json({ error: "Refresh token required" });
  }

  try {
    const decoded = verifyRefreshToken(refreshToken);
    const newAccessToken = generateAccessToken(decoded.userId);

    res.json({ accessToken: newAccessToken });
  } catch (error) {
    res.status(401).json({ error: "Invalid refresh token" });
  }
});
```

For more detailed troubleshooting information, refer to the [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) document.
