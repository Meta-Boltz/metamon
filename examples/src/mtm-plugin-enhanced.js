/**
 * Enhanced Ultra-Modern MTM Plugin with Complete HMR Support
 * Robust implementation with proper Vite integration, frontmatter parsing, and comprehensive HMR
 */

import { readFileSync, statSync, existsSync, watch } from 'fs';
import { resolve, dirname, basename, join } from 'path';
import { createRouteManifestGenerator } from './build-tools/route-manifest-generator.js';

export function mtmPluginEnhanced(options = {}) {
  const defaultOptions = {
    include: ['**/*.mtm'],
    exclude: ['node_modules/**'],
    hmr: true,
    sourceMaps: true,
    ssr: true,
    preserveState: true,
    verboseLogging: false
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
  let hmrUpdateQueue = new Set(); // Queue for batching HMR updates

  // Utility functions
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

  const log = (message, ...args) => {
    if (pluginOptions.verboseLogging || isDev) {
      console.log(message, ...args);
    }
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
        const content = trimmed.slice(1, -1);
        return content.split(',').map(item => parseValue(item));
      }
    }

    // Handle objects
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        return JSON.parse(trimmed);
      } catch {
        return trimmed;
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

    return trimmed;
  };

  // Parse YAML-style frontmatter
  const parseYAMLStyle = (yamlStr) => {
    const result = {};
    const lines = yamlStr.split('\n');
    let currentKey = null;
    let currentValue = '';
    let isMultiline = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();

      if (!trimmedLine || trimmedLine.startsWith('#')) {
        continue;
      }

      if (isMultiline) {
        if (line.startsWith('  ') || line.startsWith('\t')) {
          currentValue += '\n' + line.substring(2);
          continue;
        } else {
          result[currentKey] = parseValue(currentValue.trim());
          isMultiline = false;
          currentKey = null;
          currentValue = '';
        }
      }

      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) {
        throw new Error(`Invalid syntax on line ${i + 1}: missing colon`);
      }

      const key = line.substring(0, colonIndex).trim();
      const value = line.substring(colonIndex + 1).trim();

      if (!key) {
        throw new Error(`Invalid syntax on line ${i + 1}: empty key`);
      }

      if (!value || value === '|' || value === '>') {
        isMultiline = true;
        currentKey = key;
        currentValue = '';
      } else {
        result[key] = parseValue(value);
      }
    }

    if (isMultiline && currentKey) {
      result[currentKey] = parseValue(currentValue.trim());
    }

    return result;
  };

  // Parse frontmatter with error handling
  const parseFrontmatter = (code, filePath) => {
    const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/;
    const match = code.match(frontmatterRegex);

    if (!match) {
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
      frontmatter = parseYAMLStyle(frontmatterStr);
    } catch (error) {
      errors.push({
        type: 'frontmatter_parse_error',
        message: `Failed to parse frontmatter: ${error.message}`,
        suggestion: 'Check YAML syntax - ensure proper indentation and colons'
      });
    }

    return { frontmatter, content, errors };
  };

  // Determine if file is a page
  const isPageFile = (frontmatter, filePath) => {
    return !!(frontmatter.route || filePath.includes('/pages/') || frontmatter.page === true);
  };

  // Transform MTM file
  const transformMTMFile = (filePath, code) => {
    try {
      const stats = getFileStats(filePath);
      const cacheKey = `${filePath}:${stats?.mtime || Date.now()}`;

      if (compilationCache.has(cacheKey)) {
        const cached = compilationCache.get(cacheKey);
        log(`📋 Using cached transformation for ${getFileName(filePath)}`);
        return cached;
      }

      if (!code) {
        code = readFile(filePath);
      }

      log(`🔥 Transforming MTM file: ${getFileName(filePath)}`);

      const parsed = parseFrontmatter(code, filePath);
      const isPage = isPageFile(parsed.frontmatter, filePath);

      // Check for parsing errors and send to client
      if (parsed.errors.length > 0 && server) {
        sendCompilationError(filePath, parsed.errors);
      }

      // Simple transformation for demo
      const transformedCode = isPage ? transformPageToSSR(parsed, filePath) : transformComponent(parsed, filePath);

      const result = {
        code: transformedCode,
        map: pluginOptions.sourceMaps ? generateSourceMap(filePath, code, transformedCode) : null
      };

      compilationCache.set(cacheKey, result);
      log(`✅ Successfully transformed ${getFileName(filePath)}`);
      return result;

    } catch (error) {
      console.error(`❌ Error transforming ${getFileName(filePath)}:`, error);

      // Send compilation error to client
      if (server) {
        sendCompilationError(filePath, [{
          type: 'transformation_error',
          message: error.message,
          stack: error.stack,
          suggestion: 'Check your .mtm file syntax and frontmatter format'
        }]);
      }

      return generateErrorComponent(filePath, error);
    }
  };

  // Send compilation error to client
  const sendCompilationError = (filePath, errors) => {
    if (!server || !isDev) return;

    errors.forEach(error => {
      server.ws.send({
        type: 'custom',
        event: 'mtm:compilation-error',
        data: {
          file: filePath,
          message: error.message,
          type: error.type,
          line: error.line,
          column: error.column,
          suggestion: error.suggestion,
          timestamp: Date.now()
        }
      });
    });

    log(`🚨 Sent ${errors.length} compilation error(s) to client for ${getFileName(filePath)}`);
  };

  // Transform page to SSR
  const transformPageToSSR = (parsed, filePath) => {
    const { frontmatter, content, errors } = parsed;

    const pageInfo = {
      route: frontmatter.route || '/',
      title: frontmatter.title || 'Page',
      description: frontmatter.description || 'A page',
      ...frontmatter
    };

    return `
// SSR Page: ${pageInfo.route} (HMR Enhanced)
import { initializeErrorOverlay } from '../shared/error-overlay.js';

export const pageInfo = ${JSON.stringify(pageInfo, null, 2)};
export const route = '${pageInfo.route}';

// Initialize error overlay for development
if (import.meta.env?.DEV) {
  initializeErrorOverlay({
    enableVerboseLogging: true,
    showSourceMap: true
  });
}

// HMR State Management
if (import.meta.hot) {
  import.meta.hot.accept();
  
  // Preserve page state during HMR
  import.meta.hot.data = import.meta.hot.data || {};
  
  // Listen for MTM-specific HMR events
  import.meta.hot.on('mtm:hot-reload', (data) => {
    console.log('🔥 MTM HMR: Page hot reload', data);
    
    // Preserve form data, scroll position, etc.
    if (data.preservedState && typeof window !== 'undefined') {
      const state = {
        scrollY: window.scrollY,
        formData: extractFormData(),
        timestamp: Date.now()
      };
      import.meta.hot.data.preservedState = state;
    }
  });
  
  import.meta.hot.on('mtm:route-manifest-updated', (data) => {
    console.log('📋 MTM HMR: Route manifest updated', data);
    // Update client-side router if available
    if (window.mtmRouter) {
      window.mtmRouter.updateManifest(data.manifest);
    }
  });
}

function extractFormData() {
  if (typeof window === 'undefined') return {};
  
  const forms = document.querySelectorAll('form');
  const formData = {};
  
  forms.forEach((form, index) => {
    const data = new FormData(form);
    formData[\`form_\${index}\`] = Object.fromEntries(data.entries());
  });
  
  return formData;
}

function restoreFormData(formData) {
  if (typeof window === 'undefined' || !formData) return;
  
  Object.keys(formData).forEach(formKey => {
    const formIndex = parseInt(formKey.split('_')[1]);
    const form = document.querySelectorAll('form')[formIndex];
    
    if (form) {
      Object.entries(formData[formKey]).forEach(([name, value]) => {
        const input = form.querySelector(\`[name="\${name}"]\`);
        if (input) {
          input.value = value;
        }
      });
    }
  });
}

export function renderPage(context = {}) {
  console.log('🚀 Rendering SSR page:', '${pageInfo.route}');
  
  // Restore preserved state after HMR
  if (import.meta.hot && import.meta.hot.data.preservedState && typeof window !== 'undefined') {
    setTimeout(() => {
      const state = import.meta.hot.data.preservedState;
      window.scrollTo(0, state.scrollY || 0);
      restoreFormData(state.formData);
      console.log('💾 MTM HMR: State restored', state);
    }, 100);
  }
  
  const html = \`
    <div class="app-container" data-hmr-enabled="true">
      <header class="header">
        <h1>\${pageInfo.title}</h1>
        <p>\${pageInfo.description}</p>
      </header>
      <main>
        <p>This is the \${pageInfo.route} page with HMR support.</p>
        <div class="page-content">
          ${content.replace(/`/g, '\\`')}
        </div>
        <div class="hmr-status" style="position: fixed; bottom: 10px; right: 10px; background: #28a745; color: white; padding: 5px 10px; border-radius: 4px; font-size: 12px;">
          🔥 HMR Active
        </div>
      </main>
    </div>
  \`;
  
  return {
    html,
    route: '${pageInfo.route}',
    pageInfo: pageInfo,
    data: {
      timestamp: Date.now(),
      errors: ${JSON.stringify(errors)},
      hmrEnabled: true
    }
  };
}

export default renderPage;
`;
  };

  // Transform component
  const transformComponent = (parsed, filePath) => {
    const { frontmatter, content } = parsed;
    const componentName = frontmatter.name || 'Component';

    return `
// Component: ${componentName} (HMR Enhanced)
import React from 'react';

export const componentInfo = ${JSON.stringify(frontmatter, null, 2)};

// HMR State Management
if (import.meta.hot) {
  import.meta.hot.accept();
  
  import.meta.hot.on('mtm:hot-reload', (data) => {
    console.log('🔥 MTM HMR: Component hot reload', data);
  });
}

export default function ${componentName}(props = {}) {
  console.log('React component loaded with HMR:', '${componentName}');
  
  return React.createElement('div', {
    className: 'mtm-component',
    'data-component': '${componentName}',
    'data-hmr-enabled': 'true'
  }, [
    '${content.replace(/'/g, "\\'")}',
    React.createElement('div', {
      key: 'hmr-indicator',
      style: { fontSize: '10px', color: '#28a745', marginTop: '5px' }
    }, '🔥 HMR')
  ]);
}
`;
  };

  // Generate source map
  const generateSourceMap = (filePath, originalCode, transformedCode) => {
    return {
      version: 3,
      file: filePath,
      sources: [filePath],
      sourcesContent: [originalCode],
      mappings: 'AAAA',
      names: []
    };
  };

  // Generate error component
  const generateErrorComponent = (filePath, error) => {
    const fileName = getFileName(filePath);
    const errorMessage = error.message || 'Unknown compilation error';

    return {
      code: `
// MTM Compilation Error Component
import React from 'react';

export default function MTMError() {
  return React.createElement('div', {
    style: { 
      color: '#dc3545', 
      padding: '20px', 
      border: '2px solid #dc3545',
      borderRadius: '8px',
      margin: '10px',
      backgroundColor: '#fff5f5'
    }
  }, [
    React.createElement('h3', { key: 'title' }, '🚨 MTM Compilation Error'),
    React.createElement('p', { key: 'file' }, 'File: ${fileName}'),
    React.createElement('pre', { key: 'error' }, '${errorMessage.replace(/'/g, "\\'")}')
  ]);
}
`,
      map: null
    };
  };

  // Initialize HMR system
  const initializeHMR = async () => {
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

    // Set up file watchers
    await setupFileWatchers();

    console.log('✅ MTM HMR system initialized');
  };

  // Set up file watchers for .mtm files
  const setupFileWatchers = async () => {
    const pagesDir = join(process.cwd(), 'src/pages');

    if (!existsSync(pagesDir)) {
      console.warn(`⚠️ Pages directory not found: ${pagesDir}`);
      return;
    }

    console.log(`👀 Setting up file watchers for: ${pagesDir}`);

    try {
      const watcher = watch(pagesDir, { recursive: true }, async (eventType, filename) => {
        if (!filename || !filename.endsWith('.mtm')) return;

        const filePath = join(pagesDir, filename);
        console.log(`📁 File ${eventType}: ${filename}`);

        try {
          if (eventType === 'rename') {
            if (existsSync(filePath)) {
              console.log(`➕ New .mtm file detected: ${filename}`);
              await handleFileAdded(filePath);
            } else {
              console.log(`➖ .mtm file removed: ${filename}`);
              await handleFileRemoved(filePath);
            }
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
  };

  // Handle new file added
  const handleFileAdded = async (filePath) => {
    console.log(`🆕 Processing new file: ${getFileName(filePath)}`);

    try {
      await updateRouteManifest(filePath);

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
  };

  // Handle file removed
  const handleFileRemoved = async (filePath) => {
    console.log(`🗑️ Processing removed file: ${getFileName(filePath)}`);

    try {
      const cacheKeys = Array.from(compilationCache.keys()).filter(key => key.startsWith(filePath));
      cacheKeys.forEach(key => compilationCache.delete(key));

      hmrState.delete(filePath);
      await updateRouteManifest();

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
  };

  // Update route manifest
  const updateRouteManifest = async (changedFile = null, parsed = null) => {
    if (!routeManifestGenerator) return false;

    try {
      const previousRoutes = routeManifest ? routeManifest.totalRoutes : 0;
      routeManifest = await routeManifestGenerator.generateRouteManifest();
      const currentRoutes = routeManifest.totalRoutes;

      const routesChanged = previousRoutes !== currentRoutes;

      if (routesChanged) {
        console.log(`📋 Route manifest updated: ${previousRoutes} → ${currentRoutes} routes`);
      }

      return routesChanged;
    } catch (error) {
      console.error('❌ Failed to update route manifest:', error);
      return false;
    }
  };

  // Preserve component state during HMR
  const preserveComponentState = async (filePath, modules) => {
    if (!server) return;

    try {
      server.ws.send({
        type: 'custom',
        event: 'mtm:preserve-state',
        data: {
          file: filePath,
          modules: modules.map(mod => mod.id || mod.url),
          timestamp: Date.now()
        }
      });

      hmrState.set(filePath, {
        timestamp: Date.now(),
        modules: modules.length,
        preserved: true
      });

      console.log(`💾 State preservation requested for ${getFileName(filePath)}`);
    } catch (error) {
      console.error(`❌ Error preserving state for ${getFileName(filePath)}:`, error);
    }
  };

  // Cleanup HMR resources
  const cleanupHMR = () => {
    console.log('🧹 Cleaning up MTM HMR resources...');

    fileWatchers.forEach((watcher, path) => {
      try {
        watcher.close();
        console.log(`🔒 Closed file watcher for ${path}`);
      } catch (error) {
        console.error(`❌ Error closing file watcher for ${path}:`, error);
      }
    });
    fileWatchers.clear();

    if (routeManifestGenerator) {
      routeManifestGenerator.close();
      routeManifestGenerator = null;
    }

    hmrState.clear();
    routeManifest = null;

    console.log('✅ MTM HMR cleanup completed');
  };

  return {
    name: 'vite-plugin-mtm-ultra-modern-enhanced',
    enforce: 'pre',

    configResolved(config) {
      isDev = config.command === 'serve';
      isProduction = config.command === 'build';

      if (isDev) {
        console.log('🔥 Enhanced MTM Plugin with HMR initialized');
      }
    },

    buildStart() {
      compilationCache.clear();
      console.log('🚀 MTM Plugin: Build started, cache cleared');
    },

    resolveId(id, importer) {
      if (id.endsWith('.mtm')) {
        const resolvedPath = resolve(dirname(importer || ''), id);
        return resolvedPath + '?mtm-transformed';
      }
      return null;
    },

    load(id) {
      if (id.includes('?mtm-transformed')) {
        const filePath = id.replace('?mtm-transformed', '');
        return transformMTMFile(filePath);
      }
      return null;
    },

    transform(code, id) {
      if (id.endsWith('.mtm')) {
        return transformMTMFile(id, code);
      }
      return null;
    },

    async configureServer(serverInstance) {
      if (pluginOptions.hmr) {
        console.log('🔥 MTM Plugin: HMR enabled for development server');
        server = serverInstance;
        await initializeHMR();
      }
    },



    // Handle hot updates
    async handleHotUpdate(ctx) {
      if (!pluginOptions.hmr) return;

      const { file, server } = ctx;

      if (file.endsWith('.mtm')) {
        console.log(`🔥 HMR: Processing ${getFileName(file)}`);

        try {
          // Clear cache for updated file
          const cacheKeys = Array.from(compilationCache.keys()).filter(key => key.startsWith(file));
          cacheKeys.forEach(key => compilationCache.delete(key));

          // Parse updated file
          const code = readFile(file);
          const parsed = parseFrontmatter(code, file);
          const isPage = isPageFile(parsed.frontmatter, file);

          let routeChanged = false;
          if (isPage) {
            routeChanged = await updateRouteManifest(file, parsed);
          }

          // Find dependent modules
          const modules = Array.from(server.moduleGraph.getModulesByFile(file) || []);

          if (modules.length > 0) {
            // Preserve component state
            if (pluginOptions.preserveState) {
              await preserveComponentState(file, modules);
            }

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

            // Send custom MTM hot reload event
            server.ws.send({
              type: 'custom',
              event: 'mtm:hot-reload',
              data: {
                file,
                timestamp: Date.now(),
                modules: modules.length,
                changeType: isPage ? 'page' : 'component',
                routeChanged,
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

          server.ws.send({
            type: 'error',
            err: {
              message: `Hot reload failed for ${getFileName(file)}: ${error.message}`,
              stack: error.stack,
              id: file,
              frame: '',
              plugin: 'vite-plugin-mtm-ultra-modern-enhanced',
              loc: undefined
            }
          });

          return [];
        }
      }
    },



    buildEnd() {
      if (isDev) {
        cleanupHMR();
      }
    }
  };
}