/**
 * Build-Time Page Scanner for Ultra-Modern MTM
 * Discovers .mtm files in pages directory and extracts metadata
 */

import { readFileSync, statSync, readdirSync } from 'fs';
import { join, relative, basename, dirname, extname } from 'path';
import { glob } from 'glob';

export class PageScanner {
  constructor(options = {}) {
    this.options = {
      pagesDir: 'src/pages',
      include: ['**/*.mtm'],
      exclude: ['node_modules/**', '**/*.test.*', '**/*.spec.*'],
      watchMode: false,
      ...options
    };

    this.cache = new Map();
    this.watchers = new Set();
    this.routeRegistry = new Map();
  }

  /**
   * Scan pages directory for .mtm files
   * @param {string} pagesDir - Directory to scan
   * @returns {Promise<PageInfo[]>} Array of page information objects
   */
  async scanPages(pagesDir = this.options.pagesDir) {
    console.log(`🔍 Scanning pages directory: ${pagesDir}`);

    try {
      // Use glob to find all .mtm files
      const pattern = pagesDir.replace(/\\/g, '/') + '/**/*.mtm';
      const files = await glob(pattern, {
        ignore: this.options.exclude,
        absolute: true
      });

      console.log(`📄 Found ${files.length} .mtm files`);

      const pages = [];
      const routeConflicts = new Map();

      for (const filePath of files) {
        try {
          const pageInfo = await this.processPageFile(filePath, pagesDir);

          if (pageInfo) {
            // Check for route conflicts
            if (routeConflicts.has(pageInfo.route)) {
              const existingFile = routeConflicts.get(pageInfo.route);
              throw new Error(
                `Route conflict detected: "${pageInfo.route}" is defined in both:\n` +
                `  - ${relative(process.cwd(), existingFile)}\n` +
                `  - ${relative(process.cwd(), filePath)}`
              );
            }

            routeConflicts.set(pageInfo.route, filePath);
            pages.push(pageInfo);
          }
        } catch (error) {
          console.error(`❌ Error processing ${relative(process.cwd(), filePath)}:`, error.message);

          // Create error page info for build-time error handling
          pages.push(this.createErrorPageInfo(filePath, error));
        }
      }

      // Sort pages by route for consistent ordering
      pages.sort((a, b) => a.route.localeCompare(b.route));

      console.log(`✅ Successfully processed ${pages.length} pages`);
      return pages;

    } catch (error) {
      console.error('❌ Failed to scan pages directory:', error);
      throw error;
    }
  }

  /**
   * Process individual .mtm file and extract page information
   * @param {string} filePath - Path to .mtm file
   * @param {string} pagesDir - Base pages directory
   * @returns {Promise<PageInfo>} Page information object
   */
  async processPageFile(filePath, pagesDir) {
    const stats = statSync(filePath);
    const cacheKey = `${filePath}:${stats.mtime.getTime()}`;

    // Check cache first
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const content = readFileSync(filePath, 'utf-8');
    const parsed = this.parseFrontmatter(content, filePath);

    if (parsed.errors.length > 0) {
      console.warn(`⚠️ Frontmatter parsing warnings in ${basename(filePath)}:`);
      parsed.errors.forEach(error => {
        console.warn(`  - ${error.message}`);
        if (error.suggestion) {
          console.warn(`    💡 ${error.suggestion}`);
        }
      });
    }

    // Generate route from file path if not specified in frontmatter
    const fileRoute = this.generateRouteFromPath(filePath, pagesDir);
    const route = parsed.frontmatter.route || fileRoute;

    // Validate route format
    this.validateRoute(route, filePath);

    // Detect if route is dynamic
    const isDynamic = this.isDynamicRoute(route);
    const parameters = this.extractRouteParameters(route);

    // Extract locales from frontmatter
    const locales = this.extractLocales(parsed.frontmatter);

    // Create comprehensive page info
    const pageInfo = {
      filePath: relative(process.cwd(), filePath),
      absolutePath: filePath,
      route,
      title: parsed.frontmatter.title || this.generateTitleFromRoute(route),
      description: parsed.frontmatter.description || `Page for ${route}`,
      keywords: Array.isArray(parsed.frontmatter.keywords)
        ? parsed.frontmatter.keywords
        : (parsed.frontmatter.keywords ? [parsed.frontmatter.keywords] : []),
      layout: parsed.frontmatter.layout || 'default',
      status: parsed.frontmatter.status || 200,
      isDynamic,
      parameters,
      locales,
      metadata: parsed.frontmatter,
      content: parsed.content,
      errors: parsed.errors,
      lastModified: stats.mtime,
      size: stats.size
    };

    // Cache the result
    this.cache.set(cacheKey, pageInfo);

    return pageInfo;
  }

  /**
   * Parse YAML-style frontmatter from .mtm file content
   * @param {string} content - File content
   * @param {string} filePath - File path for error reporting
   * @returns {Object} Parsed frontmatter and content
   */
  parseFrontmatter(content, filePath) {
    const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/;
    const match = content.match(frontmatterRegex);

    if (!match) {
      return {
        frontmatter: {},
        content: content,
        errors: []
      };
    }

    const [, frontmatterStr, bodyContent] = match;
    const errors = [];
    let frontmatter = {};

    try {
      frontmatter = this.parseYAMLStyle(frontmatterStr);
    } catch (error) {
      errors.push({
        type: 'frontmatter_parse_error',
        message: `Failed to parse frontmatter: ${error.message}`,
        file: filePath,
        suggestion: 'Check YAML syntax - ensure proper indentation and colons'
      });

      // Fallback to simple key-value parsing
      try {
        frontmatter = this.parseSimpleKeyValue(frontmatterStr);
      } catch (fallbackError) {
        errors.push({
          type: 'frontmatter_fallback_error',
          message: `Fallback parsing also failed: ${fallbackError.message}`,
          file: filePath,
          suggestion: 'Use simple key: value format'
        });
      }
    }

    return { frontmatter, content: bodyContent, errors };
  }

  /**
   * Parse YAML-style frontmatter
   * @param {string} yamlStr - YAML string to parse
   * @returns {Object} Parsed object
   */
  parseYAMLStyle(yamlStr) {
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
          result[currentKey] = this.parseValue(currentValue.trim());
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
        result[key] = this.parseValue(value);
      }
    }

    // Handle final multiline value
    if (isMultiline && currentKey) {
      result[currentKey] = this.parseValue(currentValue.trim());
    }

    return result;
  }

  /**
   * Parse simple key: value format as fallback
   * @param {string} str - String to parse
   * @returns {Object} Parsed object
   */
  parseSimpleKeyValue(str) {
    const result = {};
    const lines = str.split('\n');

    lines.forEach((line) => {
      const trimmedLine = line.trim();
      if (!trimmedLine || trimmedLine.startsWith('#')) return;

      const colonIndex = trimmedLine.indexOf(':');
      if (colonIndex === -1) return;

      const key = trimmedLine.substring(0, colonIndex).trim();
      const value = trimmedLine.substring(colonIndex + 1).trim();

      if (key && value) {
        result[key] = this.parseValue(value);
      }
    });

    return result;
  }

  /**
   * Parse individual values with type detection
   * @param {string} value - Value to parse
   * @returns {any} Parsed value
   */
  parseValue(value) {
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
        return content.split(',').map(item => this.parseValue(item));
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
  }

  /**
   * Generate route from file path
   * @param {string} filePath - File path
   * @param {string} pagesDir - Base pages directory
   * @returns {string} Generated route
   */
  generateRouteFromPath(filePath, pagesDir) {
    const relativePath = relative(pagesDir, filePath);
    const pathWithoutExt = relativePath.replace(/\.mtm$/, '').replace(/\\/g, '/');

    // Handle index files
    if (pathWithoutExt === 'index') {
      return '/';
    }
    if (pathWithoutExt.endsWith('/index')) {
      return '/' + pathWithoutExt.replace('/index', '');
    }

    // Convert file path to route
    let route = '/' + pathWithoutExt;

    // Ensure route starts with /
    if (!route.startsWith('/')) {
      route = '/' + route;
    }

    return route;
  }

  /**
   * Generate title from route
   * @param {string} route - Route path
   * @returns {string} Generated title
   */
  generateTitleFromRoute(route) {
    if (route === '/') return 'Home';

    return route
      .split('/')
      .filter(Boolean)
      .map(segment => {
        // Handle dynamic segments
        if (segment.startsWith('[') && segment.endsWith(']')) {
          return segment.slice(1, -1).replace(/\.\.\./g, '').replace(/_/g, ' ');
        }
        return segment.replace(/-/g, ' ').replace(/_/g, ' ');
      })
      .join(' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Validate route format
   * @param {string} route - Route to validate
   * @param {string} filePath - File path for error reporting
   */
  validateRoute(route, filePath) {
    if (!route || typeof route !== 'string') {
      throw new Error(`Invalid route: must be a non-empty string`);
    }

    if (!route.startsWith('/')) {
      throw new Error(`Invalid route "${route}": must start with /`);
    }

    // Check for invalid characters
    const invalidChars = /[<>:"\\|?*]/;
    if (invalidChars.test(route)) {
      throw new Error(`Invalid route "${route}": contains invalid characters`);
    }

    // Check for double slashes
    if (route.includes('//')) {
      throw new Error(`Invalid route "${route}": contains double slashes`);
    }
  }

  /**
   * Check if route is dynamic (contains parameters)
   * @param {string} route - Route to check
   * @returns {boolean} True if dynamic
   */
  isDynamicRoute(route) {
    return /\[.*\]/.test(route);
  }

  /**
   * Extract route parameters from dynamic route
   * @param {string} route - Route to analyze
   * @returns {string[]} Array of parameter names
   */
  extractRouteParameters(route) {
    const params = [];
    const matches = route.match(/\[([^\]]+)\]/g);

    if (matches) {
      matches.forEach(match => {
        const param = match.slice(1, -1); // Remove brackets
        if (param.startsWith('...')) {
          params.push(param.slice(3)); // Remove ... for catch-all
        } else {
          params.push(param);
        }
      });
    }

    return params;
  }

  /**
   * Extract locales from frontmatter using enhanced parser
   * @param {Object} frontmatter - Frontmatter object
   * @returns {string[]} Array of locale codes
   */
  extractLocales(frontmatter) {
    const locales = [];

    // Check for explicit locales field
    if (frontmatter.locales) {
      if (Array.isArray(frontmatter.locales)) {
        locales.push(...frontmatter.locales);
      } else {
        locales.push(frontmatter.locales);
      }
    }

    // Check for multiple route definitions (i18n pattern)
    if (frontmatter.route) {
      if (Array.isArray(frontmatter.route)) {
        // Multiple routes might indicate different locales
        frontmatter.route.forEach(route => {
          if (typeof route === 'string') {
            const detectedLocale = this._detectLocaleFromRoute(route);
            locales.push(detectedLocale);
          } else if (typeof route === 'object' && route.locale) {
            locales.push(route.locale);
          }
        });
      } else if (typeof frontmatter.route === 'object') {
        // Locale-keyed routes
        locales.push(...Object.keys(frontmatter.route));
      }
    }

    // Check for locale-specific metadata (title, description, etc.)
    ['title', 'description', 'keywords'].forEach(field => {
      if (frontmatter[field] && typeof frontmatter[field] === 'object' && !Array.isArray(frontmatter[field])) {
        locales.push(...Object.keys(frontmatter[field]));
      }
    });

    // Default to 'en' if no locales detected
    if (locales.length === 0) {
      locales.push('en');
    }

    return [...new Set(locales)]; // Remove duplicates
  }

  /**
   * Detect locale from route path
   * @private
   */
  _detectLocaleFromRoute(route) {
    const segments = route.split('/').filter(Boolean);

    // Check if first segment looks like a locale code
    if (segments.length > 0 && segments[0].length === 2 && /^[a-z]{2}$/.test(segments[0])) {
      return segments[0];
    }

    // Default to 'en' if no locale detected
    return 'en';
  }

  /**
   * Extract i18n route information from frontmatter
   * @param {Object} frontmatter - Frontmatter object
   * @returns {Object} I18n route information
   */
  extractI18nRoutes(frontmatter) {
    const i18nInfo = {
      routes: {},
      defaultLocale: 'en',
      strategy: 'prefix',
      hasMultipleRoutes: false
    };

    // Extract default locale
    if (frontmatter.defaultLocale) {
      i18nInfo.defaultLocale = frontmatter.defaultLocale;
    }

    // Extract i18n strategy
    if (frontmatter.i18n && frontmatter.i18n.strategy) {
      i18nInfo.strategy = frontmatter.i18n.strategy;
    }

    // Process route definitions
    if (frontmatter.route) {
      if (Array.isArray(frontmatter.route)) {
        i18nInfo.hasMultipleRoutes = frontmatter.route.length > 1;

        frontmatter.route.forEach(route => {
          if (typeof route === 'string') {
            const locale = this._detectLocaleFromRoute(route);
            if (!i18nInfo.routes[locale]) {
              i18nInfo.routes[locale] = [];
            }
            i18nInfo.routes[locale].push(route);
          } else if (typeof route === 'object' && route.path && route.locale) {
            if (!i18nInfo.routes[route.locale]) {
              i18nInfo.routes[route.locale] = [];
            }
            i18nInfo.routes[route.locale].push(route.path);
          }
        });
      } else if (typeof frontmatter.route === 'object') {
        i18nInfo.hasMultipleRoutes = Object.keys(frontmatter.route).length > 1;
        i18nInfo.routes = { ...frontmatter.route };
      } else if (typeof frontmatter.route === 'string') {
        i18nInfo.routes[i18nInfo.defaultLocale] = [frontmatter.route];
      }
    }

    return i18nInfo;
  }

  /**
   * Create error page info for files that failed to process
   * @param {string} filePath - File path
   * @param {Error} error - Error that occurred
   * @returns {PageInfo} Error page info
   */
  createErrorPageInfo(filePath, error) {
    return {
      filePath: relative(process.cwd(), filePath),
      absolutePath: filePath,
      route: '/error/' + basename(filePath, '.mtm'),
      title: 'Error - ' + basename(filePath),
      description: 'This page failed to compile',
      keywords: ['error', 'compilation'],
      layout: 'error',
      status: 500,
      isDynamic: false,
      parameters: [],
      locales: ['en'],
      metadata: {},
      content: '',
      errors: [{
        type: 'compilation_error',
        message: error.message,
        file: filePath
      }],
      lastModified: new Date(),
      size: 0,
      isError: true
    };
  }

  /**
   * Watch pages directory for changes
   * @param {string} pagesDir - Directory to watch
   * @param {Function} callback - Callback function for changes
   */
  watchPages(pagesDir, callback) {
    if (!this.options.watchMode) {
      console.warn('Watch mode is disabled');
      return;
    }

    console.log(`👀 Watching pages directory: ${pagesDir}`);

    // Implementation would use fs.watch or chokidar for file watching
    // For now, this is a placeholder
    const watcher = {
      close: () => console.log('Watcher closed')
    };

    this.watchers.add(watcher);
    return watcher;
  }

  /**
   * Clear all caches
   */
  clearCache() {
    this.cache.clear();
    this.routeRegistry.clear();
    console.log('🧹 Page scanner cache cleared');
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache stats
   */
  getCacheStats() {
    return {
      cacheSize: this.cache.size,
      routeRegistrySize: this.routeRegistry.size,
      watchersCount: this.watchers.size
    };
  }

  /**
   * Close all watchers and cleanup
   */
  close() {
    this.watchers.forEach(watcher => {
      if (watcher.close) {
        watcher.close();
      }
    });
    this.watchers.clear();
    this.clearCache();
    console.log('🔒 Page scanner closed');
  }
}

/**
 * Create a new page scanner instance
 * @param {Object} options - Scanner options
 * @returns {PageScanner} Scanner instance
 */
export function createPageScanner(options = {}) {
  return new PageScanner(options);
}

// Export types for TypeScript users
export const PageScannerTypes = {
  PageInfo: {
    filePath: 'string',
    absolutePath: 'string',
    route: 'string',
    title: 'string',
    description: 'string',
    keywords: 'string[]',
    layout: 'string',
    status: 'number',
    isDynamic: 'boolean',
    parameters: 'string[]',
    locales: 'string[]',
    metadata: 'object',
    content: 'string',
    errors: 'object[]',
    lastModified: 'Date',
    size: 'number'
  }
};