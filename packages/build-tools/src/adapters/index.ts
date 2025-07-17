/**
 * Framework Hot Reload Adapters
 * 
 * Exports all framework-specific hot reload adapters and related types.
 */

// Base adapter interface and implementation
export {
  FrameworkHotReloadAdapter,
  BaseFrameworkHotReloadAdapter,
  MetamonConnection,
  ComponentStateSnapshot
} from '../framework-hot-reload-adapter.js';

// Framework-specific adapters
export { ReactHotReloadAdapter } from './react-hot-reload-adapter.js';
export { VueHotReloadAdapter } from './vue-hot-reload-adapter.js';
export { SvelteHotReloadAdapter } from './svelte-hot-reload-adapter.js';
export { SolidHotReloadAdapter } from './solid-hot-reload-adapter.js';

// Framework hot reload manager
export {
  FrameworkHotReloadManager,
  FrameworkHotReloadConfig,
  FrameworkReloadResult
} from '../framework-hot-reload-manager.js';