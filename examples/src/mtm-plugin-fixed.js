/**
 * Fixed MTM Plugin
 * 
 * This plugin uses the fixed MTM transformer to ensure compatibility with the chunk loader.
 * It addresses the TypeError: Cannot set property data of #<Object> which has only a getter
 * by ensuring that the transformed code uses writable properties.
 */

import { readFileSync, statSync, existsSync } from 'fs';
import { resolve, dirname, basename } from 'path';
import MTMTransformer from './build-tools/mtm-transformer-fixed.js';

export function mtmPluginFixed(options = {}) {
  const defaultOptions = {
    include: ['**/*.mtm'],
    exclude: ['node_modules/**'],
    hmr: true,
    sourceMaps: true,
    ssr: true,
    safePropertyAssignment: true, // Enable safe property assignment by default
    chunkCompatMode: 'safe' // Use safe mode for chunk compatibility
  };

  const pluginOptions = { ...defaultOptions, ...options };
  const compilationCache = new Map();
  const transformer = new MTMTransformer();

  // Plugin state
  let isDev = false;
  let isProduction = false;
  let server = null;

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

  const resolveId = (id, importer) => {
    if (importer) {
      return resolve(dirname(importer), id);
    }
    return id;
  };

  // Detect target framework
  const detectFramework = (filePath) => {
    if (filePath.includes('.react.mtm')) return 'react';
    if (filePath.includes('.vue.mtm')) return 'vue';
    if (filePath.includes('.svelte.mtm')) return 'svelte';
    if (filePath.includes('.solid.mtm')) return 'solid';
    return 'react'; // Default to React
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

    console.error(`🚨 MTM Compilation Error in ${fileName}:`, errorMessage);

    return {
      code: `
// MTM Compilation Error Component
import React from 'react';
import { safeAssign } from '../../../packages/core/src/utils/safe-assign.js';

export default function MTMError() {
  React.useEffect(() => {
    console.error('MTM Compilation Error:', {
      file: '${fileName}',
      error: '${errorMessage.replace(/'/g, "\\'")}',
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
      React.createElement('span', { key: 'text', style: { color: '#004499' } }, 'Check your .mtm file syntax and ensure it follows the correct format.')
    ])
  ]);
}

// Add metadata for chunk loader compatibility
export const __mtmMetadata = {
  isError: true,
  errorType: 'compilation_error',
  timestamp: new Date().toISOString()
};

// Ensure exports are writable
const safeExports = {};
Object.keys(module.exports).forEach(key => {
  safeExports[key] = module.exports[key];
});
module.exports = safeExports;
`,
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

      // Detect framework
      const framework = detectFramework(filePath);

      // Transform using the fixed transformer
      const transformResult = transformer.transform(code, framework, {
        generateSourceMap: pluginOptions.sourceMaps,
        safePropertyAssignment: pluginOptions.safePropertyAssignment,
        chunkCompatMode: pluginOptions.chunkCompatMode
      });

      // Cache the result
      const result = {
        code: transformResult.code,
        map: transformResult.map
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
    name: 'vite-plugin-mtm-fixed',
    enforce: 'pre',

    configResolved(config) {
      isDev = config.command === 'serve';
      isProduction = config.command === 'build';

      if (isDev) {
        console.log('🔥 Fixed MTM Plugin initialized in development mode');
      }
    },

    buildStart() {
      compilationCache.clear();
      console.log('🚀 MTM Plugin: Build started, cache cleared');
    },

    resolveId(id, importer) {
      if (id.endsWith('.mtm')) {
        const resolvedPath = resolveId(id, importer);
        if (resolvedPath) {
          return resolvedPath + '?mtm-transformed';
        }
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

    configureServer(serverInstance) {
      if (pluginOptions.hmr) {
        console.log('🔥 MTM Plugin: HMR enabled for development server');
        server = serverInstance;
      }
    },

    handleHotUpdate(ctx) {
      if (!pluginOptions.hmr) return;

      const { file, server } = ctx;

      if (file.endsWith('.mtm')) {
        console.log(`🔥 HMR: Processing ${getFileName(file)}`);

        try {
          // Clear cache for the updated file
          const cacheKeys = Array.from(compilationCache.keys()).filter(key => key.startsWith(file));
          cacheKeys.forEach(key => compilationCache.delete(key));

          // Find all modules that depend on this .mtm file
          const modules = Array.from(server.moduleGraph.getModulesByFile(file) || []);

          if (modules.length > 0) {
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
              plugin: 'vite-plugin-mtm-fixed',
              loc: undefined
            }
          });

          return [];
        }
      }
    }
  };
}

export default mtmPluginFixed;