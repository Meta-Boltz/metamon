/**
 * Vite Plugin for processing .mtm files
 */

import { Plugin } from 'vite';
import { readFileSync, existsSync } from 'fs';
import { resolve, extname, dirname, basename } from 'path';
import { MTMFileParser as MTMParser, MTMCompiler } from '@metamon/core';

export interface MTMPluginOptions {
  /**
   * Include patterns for .mtm files
   */
  include?: string | string[];
  
  /**
   * Exclude patterns for .mtm files
   */
  exclude?: string | string[];
  
  /**
   * Enable source maps
   */
  sourceMaps?: boolean;
  
  /**
   * Enable hot module replacement
   */
  hmr?: boolean;
}

/**
 * Vite plugin for processing .mtm files
 */
export function mtmPlugin(options: MTMPluginOptions = {}): Plugin {
  const {
    include = ['**/*.mtm'],
    exclude = ['node_modules/**'],
    sourceMaps = true,
    hmr = true
  } = options;

  const compiler = new MTMCompiler();
  const compilationCache = new Map<string, { code: string; timestamp: number }>();

  /**
   * Compile .mtm file to framework-specific code
   */
  function compileMTMFile(filePath: string): string {
    try {
      // Check cache
      const stats = require('fs').statSync(filePath);
      const timestamp = stats.mtime.getTime();
      const cached = compilationCache.get(filePath);
      
      if (cached && cached.timestamp >= timestamp) {
        return cached.code;
      }

      // Read and parse .mtm file
      const content = readFileSync(filePath, 'utf-8');
      const mtmFile = MTMParser.parse(content, filePath);
      
      // Compile to target framework
      const result = compiler.compile(mtmFile);
      
      // Cache result
      compilationCache.set(filePath, {
        code: result.code,
        timestamp
      });

      // Add file extension based on target framework
      const extension = getFileExtension(mtmFile.frontmatter.target);
      
      // Log compilation
      console.log(`📝 Compiled ${basename(filePath)} → ${mtmFile.frontmatter.target}${extension}`);
      
      return result.code;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown compilation error';
      
      // Return error component for development
      return generateErrorComponent(filePath, errorMessage, getTargetFromPath(filePath));
    }
  }

  /**
   * Get file extension for target framework
   */
  function getFileExtension(target: string): string {
    switch (target) {
      case 'reactjs':
      case 'solid':
        return '.jsx';
      case 'vue':
        return '.vue';
      case 'svelte':
        return '.svelte';
      default:
        return '.js';
    }
  }

  /**
   * Try to determine target framework from file path or content
   */
  function getTargetFromPath(filePath: string): string {
    try {
      const content = readFileSync(filePath, 'utf-8');
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
      if (frontmatterMatch) {
        const yaml = require('yaml');
        const frontmatter = yaml.parse(frontmatterMatch[1]);
        return frontmatter.target || 'reactjs';
      }
    } catch (error) {
      // Ignore errors, fallback to react
    }
    return 'reactjs';
  }

  /**
   * Generate error component for development
   */
  function generateErrorComponent(filePath: string, errorMessage: string, target: string): string {
    const fileName = basename(filePath);
    
    switch (target) {
      case 'reactjs':
      case 'solid':
        return `
import React from 'react';

export default function MTMError() {
  return React.createElement('div', {
    style: { 
      color: 'red', 
      padding: '20px', 
      border: '2px solid red',
      borderRadius: '8px',
      margin: '10px',
      fontFamily: 'monospace',
      backgroundColor: '#fff5f5'
    }
  }, [
    React.createElement('h3', { key: 'title' }, '🚨 MTM Compilation Error'),
    React.createElement('p', { key: 'file' }, 'File: ${fileName}'),
    React.createElement('p', { key: 'error' }, 'Error: ${errorMessage}'),
    React.createElement('p', { key: 'help' }, 'Check your .mtm file syntax and frontmatter configuration.')
  ]);
}`;

      case 'vue':
        return `
<template>
  <div class="mtm-error">
    <h3>🚨 MTM Compilation Error</h3>
    <p><strong>File:</strong> ${fileName}</p>
    <p><strong>Error:</strong> ${errorMessage}</p>
    <p>Check your .mtm file syntax and frontmatter configuration.</p>
  </div>
</template>

<style scoped>
.mtm-error {
  color: red;
  padding: 20px;
  border: 2px solid red;
  border-radius: 8px;
  margin: 10px;
  font-family: monospace;
  background-color: #fff5f5;
}
</style>`;

      case 'svelte':
        return `
<div class="mtm-error">
  <h3>🚨 MTM Compilation Error</h3>
  <p><strong>File:</strong> ${fileName}</p>
  <p><strong>Error:</strong> ${errorMessage}</p>
  <p>Check your .mtm file syntax and frontmatter configuration.</p>
</div>

<style>
.mtm-error {
  color: red;
  padding: 20px;
  border: 2px solid red;
  border-radius: 8px;
  margin: 10px;
  font-family: monospace;
  background-color: #fff5f5;
}
</style>`;

      default:
        return `console.error('MTM Compilation Error in ${fileName}: ${errorMessage}');`;
    }
  }

  return {
    name: 'vite-plugin-mtm',
    
    /**
     * Resolve .mtm files to their compiled equivalents
     */
    resolveId(id, importer) {
      if (id.endsWith('.mtm')) {
        const resolvedPath = resolve(dirname(importer || ''), id);
        if (existsSync(resolvedPath)) {
          return resolvedPath + '?mtm-compiled';
        }
      }
      return null;
    },

    /**
     * Load and compile .mtm files
     */
    load(id) {
      if (id.includes('?mtm-compiled')) {
        const filePath = id.replace('?mtm-compiled', '');
        return compileMTMFile(filePath);
      }
      return null;
    },

    /**
     * Transform .mtm files during build
     */
    transform(code, id) {
      if (id.endsWith('.mtm')) {
        return compileMTMFile(id);
      }
      return null;
    },

    /**
     * Handle hot module replacement for .mtm files
     */
    handleHotUpdate(ctx) {
      if (!hmr) return;

      const { file, server } = ctx;
      
      if (file.endsWith('.mtm')) {
        // Clear cache for the updated file
        compilationCache.delete(file);
        
        // Find all modules that depend on this .mtm file
        const modules = Array.from(server.moduleGraph.getModulesByFile(file) || []);
        
        if (modules.length > 0) {
          // Trigger HMR update
          server.ws.send({
            type: 'update',
            updates: modules.map(mod => ({
              type: 'js-update',
              path: mod.url || mod.id || file,
              acceptedPath: mod.url || mod.id || file,
              timestamp: Date.now()
            }))
          });
        }
        
        return modules;
      }
    }
  };
}