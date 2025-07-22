/**
 * Enhanced Ultra-Modern MTM Plugin
 * Robust implementation with proper Vite integration, frontmatter parsing, and HMR
 */

import { readFileSync, statSync, existsSync } from 'fs';
import { resolve, dirname, basename } from 'path';

export function mtmPlugin(options = {}) {
  const defaultOptions = {
    include: ['**/*.mtm'],
    exclude: ['node_modules/**'],
    hmr: true,
    sourceMaps: true,
    ssr: true
  };

  const pluginOptions = { ...defaultOptions, ...options };
  const compilationCache = new Map();

  // Plugin state
  let isDev = false;
  let isProduction = false;
  let server = null;
  let routeManifestGenerator = null;
  let fileWatchers = new Map();
  let routeManifest = null;
  let hmrState = new Map(); // Store component state during HMR

  // Utility functions using imported Node.js modules
  const getFileStats = (filePath) => {
    try {
      return statSync(filePath);
    } catch {
      return null;
    }
  };

  const readFile = (filePath) => {
    try {
      return readFileSync(filePath, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to read file ${filePath}: ${error.message}`);
    }
  };

  const getFileName = (filePath) => {
    return basename(filePath);
  };

  const resolveId = (id, importer) => {
    // Use proper path resolution
    if (importer) {
      return resolve(dirname(importer), id);
    }
    return id;
  };

  // Parse individual values with type detection
  const parseValue = (value) => {
    const trimmed = value.trim();

    // Handle quoted strings
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
      return trimmed.slice(1, -1);
    }

    // Handle arrays
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        return JSON.parse(trimmed);
      } catch {
        // Fallback to simple comma-separated parsing
        const content = trimmed.slice(1, -1);
        return content.split(',').map(item => parseValue(item));
      }
    }

    // Handle objects
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        return JSON.parse(trimmed);
      } catch {
        return trimmed; // Return as string if JSON parsing fails
      }
    }

    // Handle booleans
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;

    // Handle null/undefined
    if (trimmed === 'null' || trimmed === '~') return null;
    if (trimmed === 'undefined') return undefined;

    // Handle numbers
    if (/^-?\d+$/.test(trimmed)) {
      return parseInt(trimmed, 10);
    }
    if (/^-?\d*\.\d+$/.test(trimmed)) {
      return parseFloat(trimmed);
    }

    // Return as string
    return trimmed;
  };

  // Parse simple key: value format as fallback
  const parseSimpleKeyValue = (str) => {
    const result = {};
    const lines = str.split('\n');

    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      if (!trimmedLine || trimmedLine.startsWith('#')) return;

      const colonIndex = trimmedLine.indexOf(':');
      if (colonIndex === -1) return;

      const key = trimmedLine.substring(0, colonIndex).trim();
      const value = trimmedLine.substring(colonIndex + 1).trim();

      if (key && value) {
        result[key] = parseValue(value);
      }
    });

    return result;
  };

  // Get error line number for better error reporting
  const getErrorLine = (yamlStr, error) => {
    if (error.mark && error.mark.line !== undefined) {
      return error.mark.line + 1;
    }
    return null;
  };

  // Parse YAML-style frontmatter with comprehensive error handling
  const parseYAMLStyle = (yamlStr, filePath) => {
    const result = {};
    const lines = yamlStr.split('\n');
    let currentKey = null;
    let currentValue = '';
    let isMultiline = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();

      // Skip empty lines and comments
      if (!trimmedLine || trimmedLine.startsWith('#')) {
        continue;
      }

      // Handle multiline values
      if (isMultiline) {
        if (line.startsWith('  ') || line.startsWith('\t')) {
          currentValue += '\n' + line.substring(2);
          continue;
        } else {
          // End of multiline value
          result[currentKey] = parseValue(currentValue.trim());
          isMultiline = false;
          currentKey = null;
          currentValue = '';
        }
      }

      // Parse key-value pairs
      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) {
        throw new Error(`Invalid syntax on line ${i + 1}: missing colon`);
      }

      const key = line.substring(0, colonIndex).trim();
      const value = line.substring(colonIndex + 1).trim();

      if (!key) {
        throw new Error(`Invalid syntax on line ${i + 1}: empty key`);
      }

      // Handle different value types
      if (!value) {
        // Possible multiline value
        isMultiline = true;
        currentKey = key;
        currentValue = '';
      } else if (value === '|' || value === '>') {
        // YAML multiline indicators
        isMultiline = true;
        currentKey = key;
        currentValue = '';
      } else {
        result[key] = parseValue(value);
      }
    }

    // Handle final multiline value
    if (isMultiline && currentKey) {
      result[currentKey] = parseValue(currentValue.trim());
    }

    return result;
  };

  // Robust YAML-style frontmatter parsing
  const parseFrontmatter = (code, filePath) => {
    const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/;
    const match = code.match(frontmatterRegex);

    if (!match) {
      // No frontmatter found
      return {
        frontmatter: {},
        content: code,
        errors: []
      };
    }

    const [, frontmatterStr, content] = match;
    const errors = [];
    let frontmatter = {};

    try {
      // Parse YAML-style frontmatter
      frontmatter = parseYAMLStyle(frontmatterStr, filePath);
    } catch (error) {
      errors.push({
        type: 'frontmatter_parse_error',
        message: `Failed to parse frontmatter: ${error.message}`,
        line: getErrorLine(frontmatterStr, error),
        suggestion: 'Check YAML syntax - ensure proper indentation and colons'
      });

      // Fallback to simple key-value parsing
      try {
        frontmatter = parseSimpleKeyValue(frontmatterStr);
      } catch (fallbackError) {
        errors.push({
          type: 'frontmatter_fallback_error',
          message: `Fallback parsing also failed: ${fallbackError.message}`,
          suggestion: 'Use simple key: value format'
        });
      }
    }

    return { frontmatter, content, errors };
  };

  // Determine if file is a page or component
  const isPageFile = (frontmatter, filePath) => {
    return !!(frontmatter.route || filePath.includes('/pages/') || frontmatter.page === true);
  };

  // Detect target framework
  const detectFramework = (frontmatter, filePath) => {
    // Check frontmatter first
    if (frontmatter.target) {
      return frontmatter.target;
    }
    if (frontmatter.framework) {
      return frontmatter.framework;
    }

    // Check filename patterns
    if (filePath.includes('.react.mtm')) return 'react';
    if (filePath.includes('.vue.mtm')) return 'vue';
    if (filePath.includes('.svelte.mtm')) return 'svelte';
    if (filePath.includes('.solid.mtm')) return 'solid';
    if (filePath.includes('/pages/')) return 'ssr';

    // Default to React
    return 'react';
  };

  // Transform content with basic template processing
  const transformContent = (content) => {
    if (!content || !content.trim()) {
      return "'No content'";
    }

    // Basic content transformation - escape for JavaScript string
    const escaped = content
      .replace(/\\/g, '\\\\')
      .replace(/`/g, '\\`')
      .replace(/\${/g, '\\${')
      .trim();

    return `'${escaped}'`;
  };

  // Transform page to SSR with enhanced parsing
  const transformPageToSSR = (parsed, filePath) => {
    const { frontmatter, content, errors } = parsed;

    // Handle parsing errors
    if (errors.length > 0) {
      console.warn(`⚠️ Frontmatter parsing errors in ${getFileName(filePath)}:`);
      errors.forEach(error => {
        console.warn(`  - ${error.message}`);
        if (error.suggestion) {
          console.warn(`    💡 ${error.suggestion}`);
        }
      });
    }

    // Set default page info
    const pageInfo = {
      route: frontmatter.route || '/',
      title: frontmatter.title || 'Page',
      description: frontmatter.description || 'A page',
      keywords: frontmatter.keywords || [],
      layout: frontmatter.layout || 'default',
      status: frontmatter.status || 200,
      ...frontmatter
    };

    // Validate required fields
    if (!pageInfo.route) {
      throw new Error('Page must have a route defined in frontmatter');
    }

    return `
// SSR Page: ${pageInfo.route}
import { signal } from '../shared/signal-system.js';

export const pageInfo = ${JSON.stringify(pageInfo, null, 2)};
export const route = '${pageInfo.route}';

export function renderPage(context = {}) {
  console.log('🚀 Rendering SSR page:', '${pageInfo.route}');
  
  // Enhanced page content with frontmatter data
  const html = \`
    <div class="app-container">
      <header class="header">
        <h1>\${pageInfo.title}</h1>
        <p>\${pageInfo.description}</p>
        \${pageInfo.keywords.length > 0 ? \`<meta name="keywords" content="\${pageInfo.keywords.join(', ')}">\` : ''}
      </header>
      <main>
        <p>This is the \${pageInfo.route} page rendered with Ultra-Modern MTM.</p>
        <div class="page-content">
          ${transformContent(content)}
        </div>
        <nav>
          <a href="/">Home</a> | 
          <a href="/docs">Documentation</a> | 
          <a href="/performance">Performance</a>
        </nav>
      </main>
    </div>
  \`;
  
  return {
    html,
    route: '${pageInfo.route}',
    pageInfo: pageInfo,
    data: {
      timestamp: Date.now(),
      errors: ${JSON.stringify(errors)}
    }
  };
}

export default renderPage;
`;
  };

  // Transform component with enhanced parsing
  const transformComponent = (parsed, framework, filePath) => {
    const { frontmatter, content, errors } = parsed;

    // Handle parsing errors
    if (errors.length > 0) {
      console.warn(`⚠️ Frontmatter parsing errors in ${getFileName(filePath)}:`);
      errors.forEach(error => {
        console.warn(`  - ${error.message}`);
      });
    }

    const componentName = frontmatter.name || 'Component';
    const transformedContent = transformContent(content);

    switch (framework) {
      case 'react':
        return `
import React from 'react';
import { signal } from '../shared/signal-system.js';

export const componentInfo = ${JSON.stringify(frontmatter, null, 2)};

export default function ${componentName}(props = {}) {
  console.log('React component loaded:', '${componentName}');
  
  return React.createElement('div', {
    className: 'mtm-component',
    'data-component': '${componentName}'
  }, [
    ${transformedContent}
  ]);
}
`;

      case 'vue':
        return `
<template>
  <div class="mtm-component" :data-component="componentName">
    ${transformedContent}
  </div>
</template>

<script setup>
import { signal } from '../shared/signal-system.js';

const componentInfo = ${JSON.stringify(frontmatter, null, 2)};
const componentName = '${componentName}';

console.log('Vue component loaded:', componentName);
</script>
`;

      case 'svelte':
        return `
<script>
import { signal } from '../shared/signal-system.js';

export const componentInfo = ${JSON.stringify(frontmatter, null, 2)};
const componentName = '${componentName}';

console.log('Svelte component loaded:', componentName);
</script>

<div class="mtm-component" data-component="{componentName}">
  ${transformedContent}
</div>
`;

      case 'solid':
        return `
import { signal } from '../shared/signal-system.js';

export const componentInfo = ${JSON.stringify(frontmatter, null, 2)};

export default function ${componentName}(props = {}) {
  console.log('Solid component loaded:', '${componentName}');
  
  return (
    <div class="mtm-component" data-component="${componentName}">
      ${transformedContent}
    </div>
  );
}
`;

      default:
        return `
import { signal } from '../shared/signal-system.js';

export const componentInfo = ${JSON.stringify(frontmatter, null, 2)};

export default function ${componentName}() {
  console.log('JS component loaded:', '${componentName}');
  
  const element = document.createElement('div');
  element.className = 'mtm-component';
  element.setAttribute('data-component', '${componentName}');
  element.innerHTML = \`${transformedContent}\`;
  
  return element;
}
`;
    }
  };

  // Generate source map for debugging
  const generateSourceMap = (filePath, originalCode, transformedCode) => {
    // Basic source map - in production would use proper source map library
    return {
      version: 3,
      file: filePath,
      sources: [filePath],
      sourcesContent: [originalCode],
      mappings: 'AAAA', // Basic mapping
      names: []
    };
  };

  // Categorize errors for better handling
  const categorizeError = (error) => {
    const message = error.message || '';

    if (message.includes('frontmatter')) return 'frontmatter_error';
    if (message.includes('syntax')) return 'syntax_error';
    if (message.includes('import')) return 'import_error';
    if (message.includes('route')) return 'route_error';

    return 'compilation_error';
  };

  // Get error suggestions based on error type
  const getErrorSuggestion = (errorType) => {
    switch (errorType) {
      case 'frontmatter_error':
        return 'Check your frontmatter syntax. Ensure proper YAML format with colons and correct indentation.';
      case 'syntax_error':
        return 'Check your MTM syntax. Ensure proper template structure and valid JavaScript expressions.';
      case 'import_error':
        return 'Check your import statements. Ensure all imported files exist and have correct paths.';
      case 'route_error':
        return 'Check your route definition. Ensure the route field is properly defined in frontmatter.';
      default:
        return 'Check your .mtm file syntax and frontmatter configuration. Refer to the documentation for proper format.';
    }
  };

  // Generate error component with comprehensive error handling
  const generateErrorComponent = (filePath, error) => {
    const fileName = getFileName(filePath);
    const errorMessage = error.message || 'Unknown compilation error';
    const errorType = categorizeError(error);

    console.error(`🚨 MTM Compilation Error in ${fileName}:`, errorMessage);

    const errorComponent = `
// MTM Compilation Error Component
import React from 'react';

export default function MTMError() {
  React.useEffect(() => {
    console.error('MTM Compilation Error:', {
      file: '${fileName}',
      error: '${errorMessage.replace(/'/g, "\\'")}',
      type: '${errorType}',
      timestamp: new Date().toISOString()
    });
  }, []);

  return React.createElement('div', {
    style: { 
      color: '#dc3545', 
      padding: '20px', 
      border: '2px solid #dc3545',
      borderRadius: '8px',
      margin: '10px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      backgroundColor: '#fff5f5',
      maxWidth: '600px'
    }
  }, [
    React.createElement('div', { 
      key: 'header',
      style: { display: 'flex', alignItems: 'center', marginBottom: '16px' }
    }, [
      React.createElement('span', { key: 'icon', style: { fontSize: '24px', marginRight: '8px' } }, '🚨'),
      React.createElement('h3', { key: 'title', style: { margin: 0, color: '#dc3545' } }, 'MTM Compilation Error')
    ]),
    React.createElement('div', { key: 'file', style: { marginBottom: '12px' } }, [
      React.createElement('strong', { key: 'label' }, 'File: '),
      React.createElement('code', { key: 'name', style: { fontFamily: 'Monaco, Menlo, monospace' } }, '${fileName}')
    ]),
    React.createElement('div', { key: 'error', style: { marginBottom: '16px' } }, [
      React.createElement('strong', { key: 'label' }, 'Error: '),
      React.createElement('pre', { 
        key: 'message', 
        style: { 
          whiteSpace: 'pre-wrap', 
          fontFamily: 'Monaco, Menlo, monospace',
          fontSize: '13px',
          margin: '8px 0',
          padding: '8px',
          backgroundColor: '#f8f9fa',
          border: '1px solid #e9ecef',
          borderRadius: '4px'
        } 
      }, '${errorMessage.replace(/'/g, "\\'")}')
    ]),
    React.createElement('div', { 
      key: 'suggestion',
      style: { 
        backgroundColor: '#e7f3ff',
        border: '1px solid #b3d9ff',
        borderRadius: '4px',
        padding: '12px'
      }
    }, [
      React.createElement('strong', { key: 'label', style: { color: '#0066cc' } }, '💡 Suggestion: '),
      React.createElement('span', { key: 'text', style: { color: '#004499' } }, '${getErrorSuggestion(errorType)}')
    ])
  ]);
}

export const pageInfo = {
  route: '/error',
  title: 'Compilation Error',
  description: 'MTM file compilation failed'
};
`;

    return {
      code: errorComponent,
      map: null
    };
  };

  // Main transformation function
  const transformMTMFile = (filePath, code) => {
    try {
      // Check cache first
      const stats = getFileStats(filePath);
      const cacheKey = `${filePath}:${stats?.mtime || Date.now()}`;

      if (compilationCache.has(cacheKey)) {
        const cached = compilationCache.get(cacheKey);
        console.log(`📋 Using cached transformation for ${getFileName(filePath)}`);
        return cached;
      }

      // Read file if code not provided
      if (!code) {
        code = readFile(filePath);
      }

      console.log(`🔥 Transforming MTM file: ${getFileName(filePath)}`);

      // Parse frontmatter with robust YAML-style parsing
      const parsed = parseFrontmatter(code, filePath);

      // Determine file type and framework
      const isPage = isPageFile(parsed.frontmatter, filePath);
      const framework = detectFramework(parsed.frontmatter, filePath);

      console.log(`📦 Type: ${isPage ? 'Page' : 'Component'}, Framework: ${framework}`);

      // Transform based on type
      const transformedCode = isPage
        ? transformPageToSSR(parsed, filePath)
        : transformComponent(parsed, framework, filePath);

      // Cache the result
      const result = {
        code: transformedCode,
        map: pluginOptions.sourceMaps ? generateSourceMap(filePath, code, transformedCode) : null
      };

      compilationCache.set(cacheKey, result);

      console.log(`✅ Successfully transformed ${getFileName(filePath)}`);
      return result;

    } catch (error) {
      console.error(`❌ Error transforming ${getFileName(filePath)}:`, error);
      return generateErrorComponent(filePath, error);
    }
  };

  return {
    name: 'vite-plugin-mtm-ultra-modern',
    enforce: 'pre', // Critical: Run before Vite's import analysis

    configResolved(config) {
      // Store config for development mode detection
      isDev = config.command === 'serve';
      isProduction = config.command === 'build';

      if (isDev) {
        console.log('🔥 Enhanced MTM Plugin initialized in development mode');
      }
    },

    buildStart() {
      // Clear cache on build start
      compilationCache.clear();
      console.log('🚀 MTM Plugin: Build started, cache cleared');
    },

    resolveId(id, importer) {
      // Handle .mtm file resolution before Vite's import analysis
      if (id.endsWith('.mtm')) {
        const resolvedPath = resolveId(id, importer);
        if (resolvedPath) {
          return resolvedPath + '?mtm-transformed';
        }
      }
      return null;
    },

    load(id) {
      // Load and transform .mtm files
      if (id.includes('?mtm-transformed')) {
        const filePath = id.replace('?mtm-transformed', '');
        return transformMTMFile(filePath);
      }
      return null;
    },

    transform(code, id) {
      // Transform .mtm files during build
      if (id.endsWith('.mtm')) {
        return transformMTMFile(id, code);
      }
      return null;
    },

    async configureServer(serverInstance) {
      // Configure development server for enhanced HMR
      if (pluginOptions.hmr) {
        console.log('🔥 MTM Plugin: HMR enabled for development server');
        server = serverInstance;

        // Initialize HMR system after server is configured
        await this.initializeHMR();
      }
    },

    async handleHotUpdate(ctx) {
      // Handle hot module replacement for .mtm files
      if (!pluginOptions.hmr) return;

      const { file, server } = ctx;

      if (file.endsWith('.mtm')) {
        console.log(`🔥 HMR: Processing ${getFileName(file)}`);

        try {
          // Clear cache for the updated file
          const cacheKeys = Array.from(compilationCache.keys()).filter(key => key.startsWith(file));
          cacheKeys.forEach(key => compilationCache.delete(key));

          // Read and parse the updated file
          const code = readFile(file);
          const parsed = parseFrontmatter(code, file);

          // Check if this is a page file that affects routing
          const isPage = isPageFile(parsed.frontmatter, file);
          let routeChanged = false;

          if (isPage) {
            // Update route manifest if this is a page
            routeChanged = await updateRouteManifest(file, parsed);
          }

          // Find all modules that depend on this .mtm file
          const modules = Array.from(server.moduleGraph.getModulesByFile(file) || []);

          if (modules.length > 0) {
            // Preserve component state before update
            await preserveComponentState(file, modules);

            // Send HMR update
            server.ws.send({
              type: 'update',
              updates: modules.map(mod => ({
                type: 'js-update',
                path: mod.url || mod.id || file,
                acceptedPath: mod.url || mod.id || file,
                timestamp: Date.now()
              }))
            });

            // Send custom MTM hot reload event with enhanced info
            server.ws.send({
              type: 'custom',
              event: 'mtm:hot-reload',
              data: {
                file,
                timestamp: Date.now(),
                modules: modules.length,
                changeType: isPage ? 'page' : 'component',
                routeChanged,
                frontmatterSupported: true,
                hasErrors: parsed.errors.length > 0,
                errors: parsed.errors,
                pageInfo: parsed.frontmatter,
                preservedState: hmrState.get(file) || null
              }
            });

            // Send route manifest update if routes changed
            if (routeChanged && routeManifest) {
              server.ws.send({
                type: 'custom',
                event: 'mtm:route-manifest-updated',
                data: {
                  manifest: routeManifest,
                  timestamp: Date.now(),
                  changedFile: file
                }
              });
            }

            console.log(`✅ HMR: Updated ${modules.length} module(s) for ${getFileName(file)}`);
          }

          return modules;
        } catch (error) {
          console.error(`❌ HMR Error for ${getFileName(file)}:`, error);

          // Send error to client
          server.ws.send({
            type: 'error',
            err: {
              message: `Hot reload failed for ${getFileName(file)}: ${error.message}`,
              stack: error.stack,
              id: file,
              frame: '',
              plugin: 'vite-plugin-mtm-ultra-modern',
              loc: undefined
            }
          });

          return [];
        }
      }
    },

    // Initialize HMR system
    async initializeHMR() {
      if (!isDev || !pluginOptions.hmr) return;

      console.log('🔥 Initializing MTM HMR system...');

      // Initialize route manifest generator
      routeManifestGenerator = createRouteManifestGenerator({
        pagesDir: join(process.cwd(), 'src/pages'),
        watchMode: true
      });

      // Generate initial route manifest
      try {
        routeManifest = await routeManifestGenerator.generateRouteManifest();
        console.log(`📋 Initial route manifest generated with ${routeManifest.totalRoutes} routes`);
      } catch (error) {
        console.warn('⚠️ Failed to generate initial route manifest:', error.message);
        routeManifest = routeManifestGenerator.createEmptyManifest();
      }

      // Set up file watchers for pages directory
      await setupFileWatchers();

      console.log('✅ MTM HMR system initialized');
    },

    // Set up file watchers for .mtm files
    async setupFileWatchers() {
      const pagesDir = join(process.cwd(), 'src/pages');

      if (!existsSync(pagesDir)) {
        console.warn(`⚠️ Pages directory not found: ${pagesDir}`);
        return;
      }

      console.log(`👀 Setting up file watchers for: ${pagesDir}`);

      try {
        // Watch the pages directory recursively
        const watcher = watch(pagesDir, { recursive: true }, async (eventType, filename) => {
          if (!filename || !filename.endsWith('.mtm')) return;

          const filePath = join(pagesDir, filename);
          console.log(`📁 File ${eventType}: ${filename}`);

          try {
            if (eventType === 'rename') {
              // Handle file addition/deletion
              if (existsSync(filePath)) {
                console.log(`➕ New .mtm file detected: ${filename}`);
                await handleFileAdded(filePath);
              } else {
                console.log(`➖ .mtm file removed: ${filename}`);
                await handleFileRemoved(filePath);
              }
            } else if (eventType === 'change') {
              // Handle file modification (already handled by handleHotUpdate)
              console.log(`📝 .mtm file modified: ${filename}`);
            }
          } catch (error) {
            console.error(`❌ Error handling file ${eventType} for ${filename}:`, error);
          }
        });

        fileWatchers.set(pagesDir, watcher);
        console.log(`✅ File watcher set up for ${pagesDir}`);

      } catch (error) {
        console.error('❌ Failed to set up file watchers:', error);
      }
    },

    // Handle new .mtm file added
    async handleFileAdded(filePath) {
      console.log(`🆕 Processing new file: ${getFileName(filePath)}`);

      try {
        // Update route manifest
        await updateRouteManifest(filePath);

        // Notify client about new route
        if (server && routeManifest) {
          server.ws.send({
            type: 'custom',
            event: 'mtm:route-added',
            data: {
              file: filePath,
              manifest: routeManifest,
              timestamp: Date.now()
            }
          });
        }

        console.log(`✅ New file processed: ${getFileName(filePath)}`);
      } catch (error) {
        console.error(`❌ Error processing new file ${getFileName(filePath)}:`, error);
      }
    },

    // Handle .mtm file removed
    async handleFileRemoved(filePath) {
      console.log(`🗑️ Processing removed file: ${getFileName(filePath)}`);

      try {
        // Clear cache for removed file
        const cacheKeys = Array.from(compilationCache.keys()).filter(key => key.startsWith(filePath));
        cacheKeys.forEach(key => compilationCache.delete(key));

        // Clear HMR state for removed file
        hmrState.delete(filePath);

        // Update route manifest
        await updateRouteManifest();

        // Notify client about removed route
        if (server && routeManifest) {
          server.ws.send({
            type: 'custom',
            event: 'mtm:route-removed',
            data: {
              file: filePath,
              manifest: routeManifest,
              timestamp: Date.now()
            }
          });
        }

        console.log(`✅ Removed file processed: ${getFileName(filePath)}`);
      } catch (error) {
        console.error(`❌ Error processing removed file ${getFileName(filePath)}:`, error);
      }
    },

    // Update route manifest when pages change
    async updateRouteManifest(changedFile = null, parsed = null) {
      if (!routeManifestGenerator) return false;

      try {
        const previousRoutes = routeManifest ? routeManifest.totalRoutes : 0;
        const previousStaticRoutes = routeManifest ? Object.keys(routeManifest.staticRoutes) : [];

        // Regenerate route manifest
        routeManifest = await routeManifestGenerator.generateRouteManifest();

        const currentRoutes = routeManifest.totalRoutes;
        const currentStaticRoutes = Object.keys(routeManifest.staticRoutes);

        // Check if routes actually changed
        const routesChanged = previousRoutes !== currentRoutes ||
          JSON.stringify(previousStaticRoutes.sort()) !== JSON.stringify(currentStaticRoutes.sort());

        if (routesChanged) {
          console.log(`📋 Route manifest updated: ${previousRoutes} → ${currentRoutes} routes`);

          // Log specific changes if we have a changed file
          if (changedFile && parsed) {
            const route = parsed.frontmatter.route || 'unknown';
            console.log(`  📍 Changed route: ${route} (${getFileName(changedFile)})`);
          }
        }

        return routesChanged;
      } catch (error) {
        console.error('❌ Failed to update route manifest:', error);
        return false;
      }
    },

    // Preserve component state during HMR
    async preserveComponentState(filePath, modules) {
      if (!server) return;

      try {
        // Send request to client to preserve state
        server.ws.send({
          type: 'custom',
          event: 'mtm:preserve-state',
          data: {
            file: filePath,
            modules: modules.map(mod => mod.id || mod.url),
            timestamp: Date.now()
          }
        });

        // Store placeholder state (in real implementation, this would be more sophisticated)
        hmrState.set(filePath, {
          timestamp: Date.now(),
          modules: modules.length,
          preserved: true
        });

        console.log(`💾 State preservation requested for ${getFileName(filePath)}`);
      } catch (error) {
        console.error(`❌ Error preserving state for ${getFileName(filePath)}:`, error);
      }
    },

    // Cleanup HMR resources
    cleanupHMR() {
      console.log('🧹 Cleaning up MTM HMR resources...');

      // Close file watchers
      fileWatchers.forEach((watcher, path) => {
        try {
          watcher.close();
          console.log(`🔒 Closed file watcher for ${path}`);
        } catch (error) {
          console.error(`❌ Error closing file watcher for ${path}:`, error);
        }
      });
      fileWatchers.clear();

      // Close route manifest generator
      if (routeManifestGenerator) {
        routeManifestGenerator.close();
        routeManifestGenerator = null;
      }

      // Clear HMR state
      hmrState.clear();
      routeManifest = null;

      console.log('✅ MTM HMR cleanup completed');
    },

    // Plugin cleanup on build end
    buildEnd() {
      if (isDev) {
        this.cleanupHMR();
      }
    },

    // Check if routes actually changed
    const routesChanged = previousRoutes !== currentRoutes ||
      JSON.stringify(previousStaticRoutes.sort()) !== JSON.stringify(currentStaticRoutes.sort());

    if(routesChanged) {
      console.log(`📋 Route manifest updated: ${previousRoutes} → ${currentRoutes} routes`);

      // Log specific changes if we have a changed file
      if (changedFile && parsed) {
        const route = parsed.frontmatter.route || 'unknown';
        console.log(`  📍 Changed route: ${route} (${getFileName(changedFile)})`);
      }
    }

        return routesChanged;
  } catch (error) {
    console.error('❌ Failed to update route manifest:', error);
    return false;
  }
},

    // Preserve component state during HMR
    async preserveComponentState(filePath, modules) {
  if (!server) return;

  try {
    // Send request to client to preserve state
    server.ws.send({
      type: 'custom',
      event: 'mtm:preserve-state',
      data: {
        file: filePath,
        modules: modules.map(mod => mod.id || mod.url),
        timestamp: Date.now()
      }
    });

    // Store placeholder state (in real implementation, this would be more sophisticated)
    hmrState.set(filePath, {
      timestamp: Date.now(),
      modules: modules.length,
      preserved: true
    });

    console.log(`💾 State preservation requested for ${getFileName(filePath)}`);
  } catch (error) {
    console.error(`❌ Error preserving state for ${getFileName(filePath)}:`, error);
  }
},

// Cleanup HMR resources
cleanupHMR() {
  console.log('🧹 Cleaning up MTM HMR resources...');

  // Close file watchers
  fileWatchers.forEach((watcher, path) => {
    try {
      watcher.close();
      console.log(`🔒 Closed file watcher for ${path}`);
    } catch (error) {
      console.error(`❌ Error closing file watcher for ${path}:`, error);
    }
  });
  fileWatchers.clear();

  // Close route manifest generator
  if (routeManifestGenerator) {
    routeManifestGenerator.close();
    routeManifestGenerator = null;
  }

  // Clear HMR state
  hmrState.clear();
  routeManifest = null;

  console.log('✅ MTM HMR cleanup completed');
},

// Plugin cleanup on build end
buildEnd() {
  if (isDev) {
    this.cleanupHMR();
  }
} erateRouteManifest();

const currentRoutes = routeManifest.totalRoutes;
const currentStaticRoutes = Object.keys(routeManifest.staticRoutes);

// Check if routes actually changed
const routesChanged = previousRoutes !== currentRoutes ||
  JSON.stringify(previousStaticRoutes.sort()) !== JSON.stringify(currentStaticRoutes.sort());

if (routesChanged) {
  console.log(`📋 Route manifest updated: ${previousRoutes} → ${currentRoutes} routes`);

  // Log specific changes if we have a changed file
  if (changedFile && parsed) {
    const route = parsed.frontmatter.route || 'unknown';
    console.log(`  📍 Changed route: ${route} (${getFileName(changedFile)})`);
  }
}

return routesChanged;
  } catch (error) {
  console.error('❌ Failed to update route manifest:', error);
  return false;
}
},

    // Preserve component state during HMR
    async preserveComponentState(filePath, modules) {
  if (!server) return;

  try {
    // Send request to client to preserve state
    server.ws.send({
      type: 'custom',
      event: 'mtm:preserve-state',
      data: {
        file: filePath,
        modules: modules.map(mod => mod.id || mod.url),
        timestamp: Date.now()
      }
    });

    // Store placeholder state (in real implementation, this would be more sophisticated)
    hmrState.set(filePath, {
      timestamp: Date.now(),
      modules: modules.length,
      preserved: true
    });

    console.log(`💾 State preservation requested for ${getFileName(filePath)}`);
  } catch (error) {
    console.error(`❌ Error preserving state for ${getFileName(filePath)}:`, error);
  }
},

// Cleanup HMR resources
cleanupHMR() {
  console.log('🧹 Cleaning up MTM HMR resources...');

  // Close file watchers
  fileWatchers.forEach((watcher, path) => {
    try {
      watcher.close();
      console.log(`🔒 Closed file watcher for ${path}`);
    } catch (error) {
      console.error(`❌ Error closing file watcher for ${path}:`, error);
    }
  });
  fileWatchers.clear();

  // Close route manifest generator
  if (routeManifestGenerator) {
    routeManifestGenerator.close();
    routeManifestGenerator = null;
  }

  // Clear HMR state
  hmrState.clear();
  routeManifest = null;

  console.log('✅ MTM HMR cleanup completed');
},

// Expose utility functions for testing
parseFrontmatter,
  isPageFile,
  detectFramework,
  transformPageToSSR,
  transformComponent,
  transformContent,
  parseValue,
  categorizeError,
  getErrorSuggestion,
  generateErrorComponent
  };
}