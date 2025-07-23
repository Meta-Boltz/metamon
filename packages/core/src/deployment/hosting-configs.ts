/**
 * Hosting Configuration Generator
 * 
 * This module provides configuration generators for deploying Ultra-Modern MTM applications
 * to various hosting environments.
 */

interface HostingConfig {
  name: string;
  files: Array<{
    path: string;
    content: string;
  }>;
  instructions: string[];
}

interface DeploymentOptions {
  projectName: string;
  buildCommand?: string;
  outputDir?: string;
  apiUrl?: string;
  basePath?: string;
  nodeVersion?: string;
  withSSR?: boolean;
}

/**
 * Generate Netlify configuration
 */
export function generateNetlifyConfig(options: DeploymentOptions): HostingConfig {
  const {
    projectName,
    buildCommand = 'npm run build',
    outputDir = 'dist',
    basePath = '/',
    withSSR = false
  } = options;

  const netlifyToml = `[build]
  command = "${buildCommand}"
  publish = "${outputDir}"
  ${withSSR ? 'functions = "functions"' : ''}

${withSSR ? `[functions]
  node_bundler = "esbuild"
  external_node_modules = ["express"]` : ''}

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[build.environment]
  NODE_VERSION = "${options.nodeVersion || '18'}"
  ${options.apiUrl ? `API_URL = "${options.apiUrl}"` : ''}`;

  const files = [
    {
      path: 'netlify.toml',
      content: netlifyToml
    }
  ];

  // Add _redirects file for more complex routing
  if (basePath !== '/') {
    files.push({
      path: '_redirects',
      content: `# Redirect default Netlify subdomain to primary domain
https://${projectName}.netlify.app/* https://www.example.com${basePath}/:splat 301!

# Handle SPA routing
/* /index.html 200`
    });
  }

  // Add Netlify function for SSR if needed
  if (withSSR) {
    files.push({
      path: 'functions/ssr.js',
      content: `const { renderToString } = require('../${outputDir}/server');

exports.handler = async (event, context) => {
  try {
    const path = event.path.replace('/.netlify/functions/ssr', '');
    const html = await renderToString(path);
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/html'
      },
      body: html
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};`
    });
  }

  const instructions = [
    'Install the Netlify CLI: `npm install -g netlify-cli`',
    'Login to Netlify: `netlify login`',
    'Initialize your site: `netlify init`',
    'Deploy your site: `netlify deploy --prod`'
  ];

  if (withSSR) {
    instructions.push(
      'For SSR, make sure to build your server bundle before deploying',
      'Configure your application to use the Netlify Function for server rendering'
    );
  }

  return {
    name: 'Netlify',
    files,
    instructions
  };
}

/**
 * Generate Vercel configuration
 */
export function generateVercelConfig(options: DeploymentOptions): HostingConfig {
  const {
    projectName,
    outputDir = 'dist',
    withSSR = false
  } = options;

  const vercelJson = {
    version: 2,
    builds: [
      {
        src: 'package.json',
        use: withSSR ? '@vercel/node' : '@vercel/static-build'
      }
    ],
    routes: [
      {
        src: '/(.*)',
        dest: withSSR ? '/api/ssr.js' : '/index.html'
      }
    ],
    env: {
      NODE_ENV: 'production'
    }
  };

  if (options.apiUrl) {
    vercelJson.env.API_URL = options.apiUrl;
  }

  const files = [
    {
      path: 'vercel.json',
      content: JSON.stringify(vercelJson, null, 2)
    }
  ];

  // Add SSR handler if needed
  if (withSSR) {
    files.push({
      path: 'api/ssr.js',
      content: `const { renderToString } = require('../${outputDir}/server');

module.exports = async (req, res) => {
  try {
    const path = req.url;
    const html = await renderToString(path);
    
    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(html);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};`
    });
  }

  const instructions = [
    'Install the Vercel CLI: `npm install -g vercel`',
    'Login to Vercel: `vercel login`',
    'Deploy your site: `vercel --prod`'
  ];

  if (withSSR) {
    instructions.push(
      'For SSR, make sure to build your server bundle before deploying',
      'Vercel will automatically use the API handler for server rendering'
    );
  }

  return {
    name: 'Vercel',
    files,
    instructions
  };
}

/**
 * Generate GitHub Pages configuration
 */
export function generateGitHubPagesConfig(options: DeploymentOptions): HostingConfig {
  const {
    projectName,
    buildCommand = 'npm run build',
    outputDir = 'dist',
    basePath = '/'
  } = options;

  const workflowYaml = `name: Deploy to GitHub Pages

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
        node-version: '${options.nodeVersion || '18'}'
        
    - name: Install dependencies
      run: npm install
      
    - name: Build
      run: ${buildCommand}
      env:
        NODE_ENV: production
        ${options.apiUrl ? `API_URL: ${options.apiUrl}` : ''}
      
    - name: Deploy
      uses: peaceiris/actions-gh-pages@v3
      with:
        github_token: \${{ secrets.GITHUB_TOKEN }}
        publish_dir: ./${outputDir}`;

  // Create a 404.html that redirects to index.html for SPA routing
  const notFoundHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Redirecting...</title>
  <script>
    // Single Page Apps for GitHub Pages
    // https://github.com/rafgraph/spa-github-pages
    (function(l) {
      if (l.search[1] === '/' ) {
        var decoded = l.search.slice(1).split('&').map(function(s) { 
          return s.replace(/~and~/g, '&')
        }).join('?');
        window.history.replaceState(null, null,
            l.pathname.slice(0, -1) + decoded + l.hash
        );
      }
    }(window.location))
  </script>
  <meta http-equiv="refresh" content="0;url=${basePath}">
</head>
<body>
  Redirecting to <a href="${basePath}">${basePath}</a>...
</body>
</html>`;

  const files = [
    {
      path: '.github/workflows/deploy.yml',
      content: workflowYaml
    },
    {
      path: 'public/404.html',
      content: notFoundHtml
    }
  ];

  // Add CNAME file if needed
  if (options.basePath && options.basePath !== '/') {
    files.push({
      path: 'public/CNAME',
      content: options.basePath.replace(/^https?:\/\//, '').replace(/\/.*$/, '')
    });
  }

  const instructions = [
    'Enable GitHub Pages in your repository settings',
    'Set the source to the gh-pages branch',
    'Push to the main branch to trigger deployment'
  ];

  return {
    name: 'GitHub Pages',
    files,
    instructions
  };
}

/**
 * Generate Docker configuration
 */
export function generateDockerConfig(options: DeploymentOptions): HostingConfig {
  const {
    projectName,
    withSSR = true,
    nodeVersion = '18'
  } = options;

  const dockerfile = `FROM node:${nodeVersion}-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

${withSSR ? `FROM node:${nodeVersion}-alpine

WORKDIR /app

COPY --from=builder /app/package*.json ./
RUN npm ci --only=production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.js ./

EXPOSE 3000

CMD ["node", "server.js"]` : `FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]`}`;

  const dockerCompose = `version: '3.8'

services:
  ${projectName}:
    build: .
    ports:
      - "${withSSR ? '3000:3000' : '80:80'}"
    environment:
      - NODE_ENV=production
      ${options.apiUrl ? `- API_URL=${options.apiUrl}` : ''}
    restart: unless-stopped`;

  const nginxConf = `server {
    listen 80;
    server_name localhost;

    root /usr/share/nginx/html;
    index index.html;

    # SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }
}`;

  const serverJs = `const express = require('express');
const path = require('path');
const { renderToString } = require('./dist/server');

const app = express();
const port = process.env.PORT || 3000;

// Serve static assets
app.use(express.static('dist'));

// Handle all routes with SSR
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

  const dockerignore = `node_modules
npm-debug.log
.git
.gitignore
README.md
.env
.nyc_output
coverage
.vscode`;

  const files = [
    {
      path: 'Dockerfile',
      content: dockerfile
    },
    {
      path: 'docker-compose.yml',
      content: dockerCompose
    },
    {
      path: '.dockerignore',
      content: dockerignore
    }
  ];

  if (withSSR) {
    files.push({
      path: 'server.js',
      content: serverJs
    });
  } else {
    files.push({
      path: 'nginx.conf',
      content: nginxConf
    });
  }

  const instructions = [
    'Build the Docker image: `docker build -t ${projectName} .`',
    'Run the container: `docker run -p ${withSSR ? '3000:3000' : '80:80'} ${projectName}`',
    'Or use Docker Compose: `docker-compose up -d`'
  ];

  return {
    name: 'Docker',
    files,
    instructions
  };
}

/**
 * Generate AWS Amplify configuration
 */
export function generateAwsAmplifyConfig(options: DeploymentOptions): HostingConfig {
  const {
    projectName,
    buildCommand = 'npm run build',
    outputDir = 'dist'
  } = options;

  const amplifyYml = `version: 1
frontend:
  phases:
    preBuild:
      commands:
        - npm ci
    build:
      commands:
        - ${buildCommand}
  artifacts:
    baseDirectory: ${outputDir}
    files:
      - '**/*'
  cache:
    paths:
      - node_modules/**/*`;

  const redirectsJson = `[
  {
    "source": "/<*>",
    "target": "/index.html",
    "status": "200",
    "condition": null
  }
]`;

  const files = [
    {
      path: 'amplify.yml',
      content: amplifyYml
    },
    {
      path: 'redirects.json',
      content: redirectsJson
    }
  ];

  const instructions = [
    'Install the AWS Amplify CLI: `npm install -g @aws-amplify/cli`',
    'Configure Amplify: `amplify configure`',
    'Initialize Amplify in your project: `amplify init`',
    'Add hosting: `amplify add hosting`',
    'Deploy: `amplify publish`'
  ];

  return {
    name: 'AWS Amplify',
    files,
    instructions
  };
}

/**
 * Generate Firebase configuration
 */
export function generateFirebaseConfig(options: DeploymentOptions): HostingConfig {
  const {
    projectName,
    outputDir = 'dist'
  } = options;

  const firebaseJson = {
    hosting: {
      public: outputDir,
      ignore: [
        "firebase.json",
        "**/.*",
        "**/node_modules/**"
      ],
      rewrites: [
        {
          source: "**",
          destination: "/index.html"
        }
      ],
      headers: [
        {
          source: "/assets/**",
          headers: [
            {
              key: "Cache-Control",
              value: "public, max-age=31536000, immutable"
            }
          ]
        }
      ]
    }
  };

  const files = [
    {
      path: 'firebase.json',
      content: JSON.stringify(firebaseJson, null, 2)
    },
    {
      path: '.firebaserc',
      content: `{
  "projects": {
    "default": "${projectName}"
  }
}`
    }
  ];

  const instructions = [
    'Install the Firebase CLI: `npm install -g firebase-tools`',
    'Login to Firebase: `firebase login`',
    'Initialize Firebase: `firebase init hosting`',
    'Deploy to Firebase: `firebase deploy --only hosting`'
  ];

  return {
    name: 'Firebase',
    files,
    instructions
  };
}

/**
 * Generate Cloudflare Pages configuration
 */
export function generateCloudflareConfig(options: DeploymentOptions): HostingConfig {
  const {
    projectName,
    buildCommand = 'npm run build',
    outputDir = 'dist',
    withSSR = false
  } = options;

  const files = [];

  // Add _routes.json for SPA routing
  files.push({
    path: '_routes.json',
    content: JSON.stringify({
      version: 1,
      include: ["/*"],
      exclude: ["/assets/*"]
    }, null, 2)
  });

  // Add Cloudflare Worker for SSR if needed
  if (withSSR) {
    files.push({
      path: 'functions/_worker.js',
      content: `import { renderToString } from '../${outputDir}/server';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Handle static assets
    if (url.pathname.startsWith('/assets/')) {
      return env.ASSETS.fetch(request);
    }
    
    try {
      // Render the page
      const html = await renderToString(url.pathname);
      
      return new Response(html, {
        headers: {
          'Content-Type': 'text/html',
          'Cache-Control': 'public, max-age=3600'
        }
      });
    } catch (error) {
      return new Response('Server Error', {
        status: 500,
        headers: {
          'Content-Type': 'text/plain'
        }
      });
    }
  }
};`
    });
  }

  const instructions = [
    'Install Wrangler: `npm install -g wrangler`',
    'Login to Cloudflare: `wrangler login`',
    'Create a new Pages project in the Cloudflare dashboard',
    'Connect your GitHub repository',
    `Set the build command to: \`${buildCommand}\``,
    `Set the build output directory to: \`${outputDir}\``
  ];

  if (withSSR) {
    instructions.push(
      'Enable Functions in your Pages project settings',
      'Deploy with: `wrangler pages publish dist`'
    );
  }

  return {
    name: 'Cloudflare Pages',
    files,
    instructions
  };
}

/**
 * Generate configuration for the specified hosting provider
 */
export function generateHostingConfig(provider: string, options: DeploymentOptions): HostingConfig {
  switch (provider.toLowerCase()) {
    case 'netlify':
      return generateNetlifyConfig(options);
    case 'vercel':
      return generateVercelConfig(options);
    case 'github':
    case 'github-pages':
      return generateGitHubPagesConfig(options);
    case 'docker':
      return generateDockerConfig(options);
    case 'aws':
    case 'amplify':
      return generateAwsAmplifyConfig(options);
    case 'firebase':
      return generateFirebaseConfig(options);
    case 'cloudflare':
      return generateCloudflareConfig(options);
    default:
      throw new Error(`Unsupported hosting provider: ${provider}`);
  }
}

/**
 * Get a list of supported hosting providers
 */
export function getSupportedProviders(): string[] {
  return [
    'Netlify',
    'Vercel',
    'GitHub Pages',
    'Docker',
    'AWS Amplify',
    'Firebase',
    'Cloudflare Pages'
  ];
}

/**
 * Generate configurations for all supported hosting providers
 */
export function generateAllConfigs(options: DeploymentOptions): HostingConfig[] {
  return [
    generateNetlifyConfig(options),
    generateVercelConfig(options),
    generateGitHubPagesConfig(options),
    generateDockerConfig(options),
    generateAwsAmplifyConfig(options),
    generateFirebaseConfig(options),
    generateCloudflareConfig(options)
  ];
}