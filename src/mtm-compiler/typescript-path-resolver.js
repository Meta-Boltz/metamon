// TypeScript Path Resolver - Enhanced path resolution with TypeScript support
const path = require('path');
const fs = require('fs');
const { CompilationError } = require('./error-handling.js');

/**
 * TypeScript Path Resolver - Handles path resolution with TypeScript support
 */
class TypeScriptPathResolver {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || process.cwd();
    this.paths = options.paths || {};
    this.extensions = options.extensions || ['.tsx', '.ts', '.jsx', '.js', '.vue', '.svelte'];
    this.moduleResolution = options.moduleResolution || 'node';
    this.allowJs = options.allowJs !== false;
    this.strict = options.strict || false;

    // Default path mappings
    this.defaultPaths = {
      '@components/*': ['src/components/*', 'components/*'],
      '@pages/*': ['src/pages/*', 'pages/*'],
      '@utils/*': ['src/utils/*', 'utils/*'],
      '@types/*': ['src/types/*', 'types/*', '@types/*'],
      '@/*': ['src/*']
    };

    // Merge with provided paths
    this.resolvedPaths = { ...this.defaultPaths, ...this.paths };
  }

  /**
   * Resolve a module path with TypeScript support
   * @param {string} importPath - The import path to resolve
   * @param {string} fromFile - The file making the import
   * @param {Object} options - Resolution options
   * @returns {Object} Resolution result with path and metadata
   */
  resolve(importPath, fromFile = '', options = {}) {
    const context = {
      importPath,
      fromFile,
      baseUrl: this.baseUrl,
      extensions: this.extensions,
      strict: this.strict,
      ...options
    };

    // Handle different types of imports
    let result;

    if (this.isRelativeImport(importPath)) {
      result = this.resolveRelativeImport(context);
    } else if (this.isPathMappedImport(importPath)) {
      result = this.resolvePathMappedImport(context);
    } else if (this.isNodeModuleImport(importPath)) {
      result = this.resolveNodeModuleImport(context);
    } else {
      // Fallback to absolute resolution
      result = this.resolveAbsoluteImport(context);
    }

    // If result has an error but we're not in strict mode, return the result
    // If in strict mode or result is found, return as is
    if (result.found || !this.strict) {
      return result;
    }

    // In strict mode with not found result, throw error
    throw CompilationError.importResolution(
      importPath,
      fromFile,
      0,
      result.searchPaths || this.generateSearchPaths(importPath, fromFile)
    );
  }

  /**
   * Check if import is relative (./ or ../)
   * @param {string} importPath - The import path
   * @returns {boolean} True if relative
   */
  isRelativeImport(importPath) {
    return importPath.startsWith('./') || importPath.startsWith('../');
  }

  /**
   * Check if import uses path mapping (@components/, etc.)
   * @param {string} importPath - The import path
   * @returns {boolean} True if path mapped
   */
  isPathMappedImport(importPath) {
    return Object.keys(this.resolvedPaths).some(pattern => {
      const regex = this.pathPatternToRegex(pattern);
      return regex.test(importPath);
    });
  }

  /**
   * Check if import is from node_modules
   * @param {string} importPath - The import path
   * @returns {boolean} True if node module
   */
  isNodeModuleImport(importPath) {
    return !importPath.startsWith('.') && !importPath.startsWith('/') && !this.isPathMappedImport(importPath);
  }

  /**
   * Resolve relative imports (./Component, ../utils/helper)
   * @param {Object} context - Resolution context
   * @returns {Object} Resolution result
   */
  resolveRelativeImport(context) {
    const { importPath, fromFile } = context;
    const fromDir = path.dirname(fromFile);
    const basePath = path.resolve(fromDir, importPath);

    return this.resolveWithExtensions(basePath, context);
  }

  /**
   * Resolve path-mapped imports (@components/Button)
   * @param {Object} context - Resolution context
   * @returns {Object} Resolution result
   */
  resolvePathMappedImport(context) {
    const { importPath } = context;

    for (const [pattern, mappings] of Object.entries(this.resolvedPaths)) {
      const regex = this.pathPatternToRegex(pattern);
      const match = importPath.match(regex);

      if (match) {
        const captured = match[1] || '';

        for (const mapping of mappings) {
          const resolvedMapping = mapping.replace('*', captured);
          const fullPath = path.resolve(this.baseUrl, resolvedMapping);

          const result = this.resolveWithExtensions(fullPath, context);
          if (result.found) {
            return result;
          }
        }
      }
    }

    // Return not found result instead of throwing
    return {
      found: false,
      resolvedPath: null,
      originalPath: importPath,
      searchPaths: this.generatePathMappingSearchPaths(importPath),
      error: `Could not resolve path-mapped import '${importPath}' from '${context.fromFile}'`
    };
  }

  /**
   * Resolve node module imports (react, vue, etc.)
   * @param {Object} context - Resolution context
   * @returns {Object} Resolution result
   */
  resolveNodeModuleImport(context) {
    const { importPath, fromFile } = context;

    // For node modules, we'll return a virtual resolution
    // The actual resolution will be handled by the build system
    return {
      found: true,
      resolvedPath: importPath,
      originalPath: importPath,
      isNodeModule: true,
      framework: this.detectFrameworkFromPath(importPath),
      hasTypeDefinitions: this.hasTypeDefinitions(importPath),
      metadata: {
        type: 'node_module',
        packageName: this.extractPackageName(importPath),
        subPath: this.extractSubPath(importPath)
      }
    };
  }

  /**
   * Resolve absolute imports from project root
   * @param {Object} context - Resolution context
   * @returns {Object} Resolution result
   */
  resolveAbsoluteImport(context) {
    const { importPath } = context;
    const fullPath = path.resolve(this.baseUrl, importPath);

    return this.resolveWithExtensions(fullPath, context);
  }

  /**
   * Try to resolve a path with different extensions
   * @param {string} basePath - Base path without extension
   * @param {Object} context - Resolution context
   * @returns {Object} Resolution result
   */
  resolveWithExtensions(basePath, context) {
    const searchPaths = [];

    // Try exact path first
    searchPaths.push(basePath);
    if (this.fileExists(basePath)) {
      return this.createResolutionResult(basePath, context);
    }

    // Try with extensions
    for (const ext of this.extensions) {
      const pathWithExt = basePath + ext;
      searchPaths.push(pathWithExt);

      if (this.fileExists(pathWithExt)) {
        return this.createResolutionResult(pathWithExt, context);
      }
    }

    // Try index files
    for (const ext of this.extensions) {
      const indexPath = path.join(basePath, `index${ext}`);
      searchPaths.push(indexPath);

      if (this.fileExists(indexPath)) {
        return this.createResolutionResult(indexPath, context);
      }
    }

    // Not found
    return {
      found: false,
      resolvedPath: null,
      originalPath: context.importPath,
      searchPaths,
      error: `Could not resolve '${context.importPath}' from '${context.fromFile}'`
    };
  }

  /**
   * Create a successful resolution result
   * @param {string} resolvedPath - The resolved file path
   * @param {Object} context - Resolution context
   * @returns {Object} Resolution result
   */
  createResolutionResult(resolvedPath, context) {
    const framework = this.detectFrameworkFromPath(resolvedPath);
    const hasTypes = this.hasTypeDefinitions(resolvedPath);
    const isTypeScript = this.isTypeScriptFile(resolvedPath);

    return {
      found: true,
      resolvedPath,
      originalPath: context.importPath,
      framework,
      hasTypeDefinitions: hasTypes,
      isTypeScript,
      isNodeModule: false,
      metadata: {
        type: 'local_file',
        extension: path.extname(resolvedPath),
        directory: path.dirname(resolvedPath),
        basename: path.basename(resolvedPath, path.extname(resolvedPath))
      }
    };
  }

  /**
   * Detect framework from file path
   * @param {string} filePath - The file path
   * @returns {string} Detected framework
   */
  detectFrameworkFromPath(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const basename = path.basename(filePath).toLowerCase();

    if (ext === '.vue') return 'vue';
    if (ext === '.svelte') return 'svelte';

    if (basename.includes('solid') || filePath.includes('/solid/')) return 'solid';
    if (basename.includes('react') || filePath.includes('/react/')) return 'react';
    if (basename.includes('vue') || filePath.includes('/vue/')) return 'vue';
    if (basename.includes('svelte') || filePath.includes('/svelte/')) return 'svelte';

    // Default based on extension
    if (ext === '.tsx' || ext === '.jsx') return 'react';
    if (ext === '.ts' || ext === '.js') return 'unknown';

    return 'unknown';
  }

  /**
   * Check if file has TypeScript definitions
   * @param {string} filePath - The file path
   * @returns {boolean} True if has type definitions
   */
  hasTypeDefinitions(filePath) {
    if (this.isTypeScriptFile(filePath)) return true;

    // Check for corresponding .d.ts file
    const basePath = filePath.replace(/\.(js|jsx)$/, '');
    const dtsPath = basePath + '.d.ts';

    return this.fileExists(dtsPath);
  }

  /**
   * Check if file is TypeScript
   * @param {string} filePath - The file path
   * @returns {boolean} True if TypeScript file
   */
  isTypeScriptFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return ext === '.ts' || ext === '.tsx';
  }

  /**
   * Convert path pattern to regex
   * @param {string} pattern - Path pattern with wildcards
   * @returns {RegExp} Regex pattern
   */
  pathPatternToRegex(pattern) {
    const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const withWildcard = escaped.replace('\\*', '(.*)');
    return new RegExp(`^${withWildcard}$`);
  }

  /**
   * Generate search paths for path mapping
   * @param {string} importPath - The import path
   * @returns {Array} Array of search paths
   */
  generatePathMappingSearchPaths(importPath) {
    const searchPaths = [];

    for (const [pattern, mappings] of Object.entries(this.resolvedPaths)) {
      const regex = this.pathPatternToRegex(pattern);
      const match = importPath.match(regex);

      if (match) {
        const captured = match[1] || '';

        for (const mapping of mappings) {
          const resolvedMapping = mapping.replace('*', captured);
          const fullPath = path.resolve(this.baseUrl, resolvedMapping);

          searchPaths.push(fullPath);
          for (const ext of this.extensions) {
            searchPaths.push(fullPath + ext);
            searchPaths.push(path.join(fullPath, `index${ext}`));
          }
        }
      }
    }

    return searchPaths;
  }

  /**
   * Generate all possible search paths for an import
   * @param {string} importPath - The import path
   * @param {string} fromFile - The file making the import
   * @returns {Array} Array of search paths
   */
  generateSearchPaths(importPath, fromFile) {
    const searchPaths = [];

    if (this.isRelativeImport(importPath)) {
      const fromDir = path.dirname(fromFile);
      const basePath = path.resolve(fromDir, importPath);

      searchPaths.push(basePath);
      for (const ext of this.extensions) {
        searchPaths.push(basePath + ext);
        searchPaths.push(path.join(basePath, `index${ext}`));
      }
    } else if (this.isPathMappedImport(importPath)) {
      searchPaths.push(...this.generatePathMappingSearchPaths(importPath));
    } else {
      // Absolute or node module
      const basePath = path.resolve(this.baseUrl, importPath);
      searchPaths.push(basePath);
      for (const ext of this.extensions) {
        searchPaths.push(basePath + ext);
      }
    }

    return searchPaths;
  }

  /**
   * Extract package name from node module import
   * @param {string} importPath - The import path
   * @returns {string} Package name
   */
  extractPackageName(importPath) {
    const parts = importPath.split('/');
    if (importPath.startsWith('@')) {
      return parts.slice(0, 2).join('/'); // @scope/package
    }
    return parts[0];
  }

  /**
   * Extract sub-path from node module import
   * @param {string} importPath - The import path
   * @returns {string} Sub-path
   */
  extractSubPath(importPath) {
    const packageName = this.extractPackageName(importPath);
    return importPath.substring(packageName.length + 1);
  }

  /**
   * Check if file exists
   * @param {string} filePath - The file path to check
   * @returns {boolean} True if file exists
   */
  fileExists(filePath) {
    try {
      return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
    } catch (error) {
      return false;
    }
  }

  /**
   * Get TypeScript configuration from tsconfig.json
   * @param {string} configPath - Path to tsconfig.json
   * @returns {Object} TypeScript configuration
   */
  static loadTypeScriptConfig(configPath = 'tsconfig.json') {
    try {
      const fullPath = path.resolve(configPath);
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, 'utf8');
        const config = JSON.parse(content);

        return {
          baseUrl: config.compilerOptions?.baseUrl || '.',
          paths: config.compilerOptions?.paths || {},
          extensions: ['.tsx', '.ts', '.jsx', '.js'],
          moduleResolution: config.compilerOptions?.moduleResolution || 'node',
          allowJs: config.compilerOptions?.allowJs !== false,
          strict: config.compilerOptions?.strict || false
        };
      }
    } catch (error) {
      console.warn('Could not load TypeScript config:', error.message);
    }

    return {
      baseUrl: '.',
      paths: {},
      extensions: ['.tsx', '.ts', '.jsx', '.js'],
      moduleResolution: 'node',
      allowJs: true,
      strict: false
    };
  }

  /**
   * Create resolver from TypeScript config
   * @param {string} configPath - Path to tsconfig.json
   * @returns {TypeScriptPathResolver} New resolver instance
   */
  static fromTypeScriptConfig(configPath = 'tsconfig.json') {
    const config = TypeScriptPathResolver.loadTypeScriptConfig(configPath);
    return new TypeScriptPathResolver(config);
  }
}

module.exports = { TypeScriptPathResolver };