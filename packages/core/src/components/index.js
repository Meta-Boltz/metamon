/**
 * Error Handling Components
 * 
 * This module exports components for handling chunk loading errors
 * across different frameworks.
 */

// React components
export {
  ChunkErrorBoundary,
  DefaultChunkErrorFallback,
  withChunkErrorBoundary,
  lazyWithErrorBoundary
} from './ChunkErrorBoundary.jsx';

// Vue components are imported directly from the .vue file

// Vanilla JS components
export {
  createChunkErrorFallback,
  createChunkErrorHandler,
  createLazyLoader
} from './ChunkErrorFallback.js';

/**
 * Framework detection utility
 */
export function detectFramework() {
  if (typeof window === 'undefined') return 'unknown';

  // Check for React
  if (window.React) return 'react';

  // Check for Vue
  if (window.Vue) return 'vue';

  // Check for Angular
  if (window.ng || window.angular) return 'angular';

  // Check for Svelte
  if (document.body.hasAttribute('data-svelte')) return 'svelte';

  return 'unknown';
}

/**
 * Get the appropriate error boundary component for the detected framework
 */
export function getErrorBoundaryForFramework(framework = null) {
  const detectedFramework = framework || detectFramework();

  switch (detectedFramework) {
    case 'react':
      return { component: 'ChunkErrorBoundary', import: './ChunkErrorBoundary.jsx' };
    case 'vue':
      return { component: 'ChunkErrorBoundary', import: './ChunkErrorBoundary.vue' };
    case 'angular':
      // Angular error handling would be implemented differently
      console.warn('Angular error boundary not implemented yet');
      return { component: null, import: null };
    case 'svelte':
      // Svelte error handling would be implemented differently
      console.warn('Svelte error boundary not implemented yet');
      return { component: null, import: null };
    default:
      return { component: 'createChunkErrorFallback', import: './ChunkErrorFallback.js' };
  }
}

/**
 * Create a framework-specific lazy component with error handling
 */
export async function createFrameworkLazyComponent(importFn, options = {}) {
  const { framework = null, ...restOptions } = options;
  const detectedFramework = framework || detectFramework();

  switch (detectedFramework) {
    case 'react': {
      const { lazyWithErrorBoundary } = await import('./ChunkErrorBoundary.jsx');
      return lazyWithErrorBoundary(importFn, restOptions);
    }
    case 'vue': {
      const { defineAsyncComponent } = await import('./ChunkErrorBoundary.vue');
      return defineAsyncComponent(importFn, restOptions);
    }
    default: {
      const { createLazyLoader } = await import('./ChunkErrorFallback.js');
      return createLazyLoader(importFn, restOptions);
    }
  }
}