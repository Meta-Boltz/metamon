// Component Registry - Manages imported components and their adapters
const {
  ComponentAdapter,
  BaseComponentAdapter,
  ReactComponentAdapter,
  VueComponentAdapter,
  SolidComponentAdapter,
  SvelteComponentAdapter
} = require('./component-adapter.js');

/**
 * Component Registry manages component definitions and their adapters
 */
class ComponentRegistry {
  constructor() {
    this.components = new Map();
    this.adapters = new Map();
    this.pathMappings = new Map();

    // Initialize default adapters
    this.initializeDefaultAdapters();

    // Initialize default path mappings
    this.initializePathMappings();
  }

  /**
   * Initialize default framework adapters
   */
  initializeDefaultAdapters() {
    const reactAdapter = new ReactComponentAdapter();
    const vueAdapter = new VueComponentAdapter();
    const solidAdapter = new SolidComponentAdapter();
    const svelteAdapter = new SvelteComponentAdapter();

    this.adapters.set('react', reactAdapter);
    this.adapters.set('vue', vueAdapter);
    this.adapters.set('solid', solidAdapter);
    this.adapters.set('svelte', svelteAdapter);
  }

  /**
   * Initialize default path mappings
   */
  initializePathMappings() {
    this.pathMappings.set('@components/', 'src/components/');
    this.pathMappings.set('@/', 'src/');
    this.pathMappings.set('~/', './');
  }

  /**
   * Register a component definition
   * @param {Object} componentDefinition - The component definition to register
   */
  register(componentDefinition) {
    if (!componentDefinition.name) {
      throw new Error('Component definition must have a name');
    }

    if (this.components.has(componentDefinition.name)) {
      console.warn(`Component ${componentDefinition.name} is already registered. Overwriting.`);
    }

    this.components.set(componentDefinition.name, componentDefinition);
  }

  /**
   * Register a component from an import statement
   * @param {Object} componentImport - The component import object
   * @returns {Object} - The registered component definition
   */
  registerFromImport(componentImport) {
    const adapter = this.getAdapterForImport(componentImport);

    if (!adapter) {
      throw new Error(`No adapter found for component: ${componentImport.path}`);
    }

    const componentDefinition = adapter.transform(componentImport);
    this.register(componentDefinition);

    return componentDefinition;
  }

  /**
   * Resolve a component by name
   * @param {string} name - The component name to resolve
   * @returns {Object|null} - The component definition or null if not found
   */
  resolve(name) {
    return this.components.get(name) || null;
  }

  /**
   * Get all registered components
   * @returns {Map} - Map of all registered components
   */
  getAll() {
    return new Map(this.components);
  }

  /**
   * Get adapter for a specific framework
   * @param {string} framework - The framework name
   * @returns {ComponentAdapter|null} - The adapter or null if not found
   */
  getAdapter(framework) {
    return this.adapters.get(framework) || null;
  }

  /**
   * Get the appropriate adapter for a component import
   * @param {Object} componentImport - The component import object
   * @returns {ComponentAdapter|null} - The appropriate adapter or null
   */
  getAdapterForImport(componentImport) {
    // First try to use the framework specified in the import
    if (componentImport.framework && this.adapters.has(componentImport.framework)) {
      return this.adapters.get(componentImport.framework);
    }

    // Otherwise, find an adapter that can handle this import path
    for (const [framework, adapter] of this.adapters) {
      if (adapter.canHandle(componentImport.path)) {
        return adapter;
      }
    }

    return null;
  }

  /**
   * Register a custom adapter
   * @param {string} framework - The framework name
   * @param {ComponentAdapter} adapter - The adapter instance
   */
  registerAdapter(framework, adapter) {
    if (!(adapter instanceof ComponentAdapter)) {
      throw new Error('Adapter must be an instance of ComponentAdapter');
    }

    this.adapters.set(framework, adapter);
  }

  /**
   * Add a path mapping for component resolution
   * @param {string} alias - The path alias (e.g., '@components/')
   * @param {string} actualPath - The actual path (e.g., 'src/components/')
   */
  addPathMapping(alias, actualPath) {
    this.pathMappings.set(alias, actualPath);
  }

  /**
   * Resolve a component path using registered path mappings
   * @param {string} importPath - The import path to resolve
   * @param {string} basePath - The base path for resolution
   * @returns {string} - The resolved path
   */
  resolvePath(importPath, basePath = process.cwd()) {
    const path = require('path');

    // Check for path mappings
    for (const [alias, actualPath] of this.pathMappings) {
      if (importPath.startsWith(alias)) {
        const resolvedPath = importPath.replace(alias, actualPath);
        return path.resolve(basePath, resolvedPath);
      }
    }

    // Handle relative imports
    if (importPath.startsWith('./') || importPath.startsWith('../')) {
      return path.resolve(basePath, importPath);
    }

    // Handle absolute imports from project root
    return path.resolve(basePath, importPath);
  }

  /**
   * Clear all registered components
   */
  clear() {
    this.components.clear();
  }

  /**
   * Remove a specific component
   * @param {string} name - The component name to remove
   * @returns {boolean} - True if component was removed, false if not found
   */
  remove(name) {
    return this.components.delete(name);
  }

  /**
   * Check if a component is registered
   * @param {string} name - The component name to check
   * @returns {boolean} - True if component is registered
   */
  has(name) {
    return this.components.has(name);
  }

  /**
   * Get component count
   * @returns {number} - Number of registered components
   */
  size() {
    return this.components.size;
  }

  /**
   * Validate component definition
   * @param {Object} componentDefinition - The component definition to validate
   * @returns {Array} - Array of validation errors
   */
  validateComponent(componentDefinition) {
    const errors = [];

    if (!componentDefinition.name) {
      errors.push({
        type: 'component-validation',
        message: 'Component definition must have a name',
        field: 'name'
      });
    }

    if (!componentDefinition.framework) {
      errors.push({
        type: 'component-validation',
        message: 'Component definition must specify a framework',
        field: 'framework'
      });
    }

    if (componentDefinition.framework && !this.adapters.has(componentDefinition.framework)) {
      errors.push({
        type: 'component-validation',
        message: `Unsupported framework: ${componentDefinition.framework}`,
        field: 'framework',
        value: componentDefinition.framework
      });
    }

    if (!componentDefinition.path && !componentDefinition.source) {
      errors.push({
        type: 'component-validation',
        message: 'Component definition must have either a path or source',
        field: 'path'
      });
    }

    return errors;
  }

  /**
   * Generate wrapper code for a component
   * @param {string} componentName - The component name
   * @returns {string|null} - The wrapper code or null if component not found
   */
  generateWrapper(componentName) {
    const component = this.resolve(componentName);
    if (!component) {
      return null;
    }

    const adapter = this.getAdapter(component.framework);
    if (!adapter) {
      return null;
    }

    return adapter.generateWrapper(component);
  }

  /**
   * Get registry statistics
   * @returns {Object} - Registry statistics
   */
  getStats() {
    const frameworkCounts = {};

    for (const component of this.components.values()) {
      const framework = component.framework || 'unknown';
      frameworkCounts[framework] = (frameworkCounts[framework] || 0) + 1;
    }

    return {
      totalComponents: this.components.size,
      totalAdapters: this.adapters.size,
      totalPathMappings: this.pathMappings.size,
      frameworkCounts
    };
  }
}

module.exports = { ComponentRegistry };