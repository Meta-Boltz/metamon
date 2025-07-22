/**
 * Robust YAML-style frontmatter parser for MTM files
 * Handles parsing between --- delimiters with comprehensive error handling
 */

import yaml from 'js-yaml';

/**
 * Parse error class for detailed error reporting
 */
export class FrontmatterParseError extends Error {
  constructor(message, line = null, column = null, suggestions = []) {
    super(message);
    this.name = 'FrontmatterParseError';
    this.line = line;
    this.column = column;
    this.suggestions = suggestions;
  }
}

/**
 * Frontmatter parser result
 */
export class FrontmatterResult {
  constructor(frontmatter = {}, content = '', errors = []) {
    this.frontmatter = frontmatter;
    this.content = content;
    this.errors = errors;
  }

  get isValid() {
    return this.errors.length === 0;
  }
}

/**
 * Enhanced frontmatter parser with YAML support
 */
export class FrontmatterParser {
  constructor(options = {}) {
    this.options = {
      allowEmptyFrontmatter: true,
      strictMode: false,
      maxFrontmatterSize: 10000, // 10KB limit
      ...options
    };
  }

  /**
   * Parse frontmatter from MTM file content
   * @param {string} content - The full file content
   * @returns {FrontmatterResult} - Parsed result with frontmatter, content, and errors
   */
  parse(content) {
    if (typeof content !== 'string') {
      return new FrontmatterResult({}, '', [
        new FrontmatterParseError('Content must be a string', null, null, ['Ensure file content is properly read as text'])
      ]);
    }

    const result = this._extractFrontmatter(content);
    if (!result.isValid) {
      return result;
    }

    const { frontmatterText, bodyContent } = result;

    if (!frontmatterText && !this.options.allowEmptyFrontmatter) {
      return new FrontmatterResult({}, bodyContent, [
        new FrontmatterParseError('Frontmatter is required but not found', 1, 1, [
          'Add frontmatter between --- delimiters at the top of the file',
          'Example: ---\\nroute: /example\\ntitle: Example Page\\n---'
        ])
      ]);
    }

    if (!frontmatterText) {
      return new FrontmatterResult({}, bodyContent, []);
    }

    return this._parseYaml(frontmatterText, bodyContent);
  }

  /**
   * Extract frontmatter section from content
   * @private
   */
  _extractFrontmatter(content) {
    const lines = content.split('\n');

    // Check if file starts with frontmatter delimiter
    if (!lines[0] || lines[0].trim() !== '---') {
      return { frontmatterText: '', bodyContent: content, isValid: true };
    }

    // Find closing delimiter
    let endIndex = -1;
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === '---') {
        endIndex = i;
        break;
      }
    }

    if (endIndex === -1) {
      return new FrontmatterResult({}, '', [
        new FrontmatterParseError(
          'Frontmatter opening delimiter found but no closing delimiter',
          1,
          1,
          [
            'Add closing --- delimiter after frontmatter',
            'Ensure frontmatter is properly formatted between --- delimiters'
          ]
        )
      ]);
    }

    const frontmatterLines = lines.slice(1, endIndex);
    const frontmatterText = frontmatterLines.join('\n');
    const bodyContent = lines.slice(endIndex + 1).join('\n');

    // Check frontmatter size limit
    if (frontmatterText.length > this.options.maxFrontmatterSize) {
      return new FrontmatterResult({}, '', [
        new FrontmatterParseError(
          `Frontmatter exceeds maximum size limit of ${this.options.maxFrontmatterSize} characters`,
          null,
          null,
          ['Reduce frontmatter content', 'Move large data structures to separate files']
        )
      ]);
    }

    return { frontmatterText, bodyContent, isValid: true };
  }

  /**
   * Parse YAML frontmatter text
   * @private
   */
  _parseYaml(frontmatterText, bodyContent) {
    if (!frontmatterText.trim()) {
      return new FrontmatterResult({}, bodyContent, []);
    }

    try {
      const frontmatter = yaml.load(frontmatterText, {
        onWarning: (warning) => {
          console.warn('YAML parsing warning:', warning);
        }
      });

      // Handle null result (empty YAML)
      if (frontmatter === null) {
        return new FrontmatterResult({}, bodyContent, []);
      }

      // Ensure frontmatter is an object
      if (typeof frontmatter !== 'object' || Array.isArray(frontmatter)) {
        return new FrontmatterResult({}, bodyContent, [
          new FrontmatterParseError(
            'Frontmatter must be a YAML object, not an array or primitive value',
            null,
            null,
            [
              'Ensure frontmatter contains key-value pairs',
              'Example: route: /example\\ntitle: Example Page'
            ]
          )
        ]);
      }

      return new FrontmatterResult(frontmatter, bodyContent, []);

    } catch (error) {
      return this._handleYamlError(error, bodyContent);
    }
  }

  /**
   * Handle YAML parsing errors with detailed messages
   * @private
   */
  _handleYamlError(error, bodyContent) {
    let line = null;
    let column = null;
    let suggestions = [];

    // Extract line and column from YAML error
    if (error.mark) {
      line = error.mark.line + 2; // +2 because we skip the opening --- and YAML is 0-indexed
      column = error.mark.column + 1; // +1 because columns are 0-indexed
    }

    // Provide specific suggestions based on error type
    if (error.message.includes('duplicated mapping key')) {
      suggestions = [
        'Remove duplicate keys in frontmatter',
        'Each key should appear only once'
      ];
    } else if (error.message.includes('bad indentation')) {
      suggestions = [
        'Check YAML indentation - use spaces, not tabs',
        'Ensure consistent indentation levels',
        'YAML requires proper indentation for nested structures'
      ];
    } else if (error.message.includes('unexpected end of the stream')) {
      suggestions = [
        'Check for unclosed quotes or brackets',
        'Ensure all YAML structures are properly closed'
      ];
    } else if (error.message.includes('found character that cannot start any token')) {
      suggestions = [
        'Check for invalid characters in YAML',
        'Ensure proper quoting of special characters',
        'Use quotes around values containing special characters'
      ];
    } else {
      suggestions = [
        'Check YAML syntax - ensure proper formatting',
        'Use online YAML validator to check syntax',
        'Ensure proper spacing around colons and dashes'
      ];
    }

    const message = `YAML parsing error: ${error.message}`;

    return new FrontmatterResult({}, bodyContent, [
      new FrontmatterParseError(message, line, column, suggestions)
    ]);
  }

  /**
   * Parse multiple files and return results
   * @param {Array<{path: string, content: string}>} files - Array of file objects
   * @returns {Array<{path: string, result: FrontmatterResult}>} - Array of parse results
   */
  parseMultiple(files) {
    return files.map(file => ({
      path: file.path,
      result: this.parse(file.content)
    }));
  }

  /**
   * Validate that frontmatter contains required data types
   * @param {Object} frontmatter - Parsed frontmatter object
   * @returns {Array<FrontmatterParseError>} - Array of validation errors
   */
  validateDataTypes(frontmatter) {
    const errors = [];

    for (const [key, value] of Object.entries(frontmatter)) {
      if (!this._isValidDataType(value)) {
        errors.push(new FrontmatterParseError(
          `Invalid data type for key "${key}": ${typeof value}`,
          null,
          null,
          [
            'Supported types: string, number, boolean, array, object',
            'Use quotes for string values',
            'Use proper YAML syntax for arrays and objects'
          ]
        ));
      }
    }

    return errors;
  }

  /**
   * Validate i18n route configuration
   * @param {Object} frontmatter - Parsed frontmatter object
   * @returns {Array<FrontmatterParseError>} - Array of validation errors
   */
  validateI18nRoutes(frontmatter) {
    const errors = [];

    if (!frontmatter.route) {
      return errors;
    }

    // Handle multiple route definitions
    if (Array.isArray(frontmatter.route)) {
      frontmatter.route.forEach((route, index) => {
        if (typeof route === 'string') {
          const routeErrors = this._validateSingleRoute(route, `route[${index}]`);
          errors.push(...routeErrors);
        } else if (typeof route === 'object' && route.path) {
          const routeErrors = this._validateSingleRoute(route.path, `route[${index}].path`);
          errors.push(...routeErrors);
        } else {
          errors.push(new FrontmatterParseError(
            `Invalid route definition at index ${index}: must be string or object with path property`,
            null,
            null,
            [
              'Use string format: "/path"',
              'Or object format: { path: "/path", locale: "en" }'
            ]
          ));
        }
      });
    } else if (typeof frontmatter.route === 'object') {
      // Handle locale-keyed routes
      for (const [locale, route] of Object.entries(frontmatter.route)) {
        if (typeof route === 'string') {
          const routeErrors = this._validateSingleRoute(route, `route.${locale}`);
          errors.push(...routeErrors);
        } else {
          errors.push(new FrontmatterParseError(
            `Invalid route for locale "${locale}": must be a string`,
            null,
            null,
            [`Use format: ${locale}: "/path"`]
          ));
        }
      }
    } else if (typeof frontmatter.route === 'string') {
      const routeErrors = this._validateSingleRoute(frontmatter.route, 'route');
      errors.push(...routeErrors);
    }

    // Validate locales array
    if (frontmatter.locales && !Array.isArray(frontmatter.locales)) {
      errors.push(new FrontmatterParseError(
        'locales must be an array of locale codes',
        null,
        null,
        ['Use format: locales: [en, fr, es]']
      ));
    }

    return errors;
  }

  /**
   * Validate a single route path
   * @private
   */
  _validateSingleRoute(route, context) {
    const errors = [];

    if (!route || typeof route !== 'string') {
      errors.push(new FrontmatterParseError(
        `Invalid route in ${context}: must be a non-empty string`,
        null,
        null,
        ['Routes must start with / and contain valid URL characters']
      ));
      return errors;
    }

    if (!route.startsWith('/')) {
      errors.push(new FrontmatterParseError(
        `Invalid route in ${context}: "${route}" must start with /`,
        null,
        null,
        [`Change to: /${route}`]
      ));
    }

    // Check for invalid characters
    const invalidChars = /[<>:"\\|?*\s]/;
    if (invalidChars.test(route)) {
      errors.push(new FrontmatterParseError(
        `Invalid route in ${context}: "${route}" contains invalid characters`,
        null,
        null,
        [
          'Routes cannot contain spaces or special characters: < > : " \\ | ? *',
          'Use hyphens instead of spaces: /my-page'
        ]
      ));
    }

    // Check for double slashes
    if (route.includes('//')) {
      errors.push(new FrontmatterParseError(
        `Invalid route in ${context}: "${route}" contains double slashes`,
        null,
        null,
        ['Remove extra slashes from the route path']
      ));
    }

    return errors;
  }

  /**
   * Extract locale information from frontmatter
   * @param {Object} frontmatter - Parsed frontmatter object
   * @returns {Object} Locale information
   */
  extractLocaleInfo(frontmatter) {
    const localeInfo = {
      locales: ['en'], // default
      defaultLocale: 'en',
      routes: {},
      strategy: 'prefix'
    };

    // Extract explicit locales
    if (Array.isArray(frontmatter.locales)) {
      localeInfo.locales = frontmatter.locales;
    }

    // Extract default locale
    if (frontmatter.defaultLocale) {
      localeInfo.defaultLocale = frontmatter.defaultLocale;
    }

    // Extract i18n strategy
    if (frontmatter.i18n && frontmatter.i18n.strategy) {
      localeInfo.strategy = frontmatter.i18n.strategy;
    }

    // Process route definitions
    if (frontmatter.route) {
      if (Array.isArray(frontmatter.route)) {
        // Array of routes - try to detect locales
        frontmatter.route.forEach(route => {
          if (typeof route === 'string') {
            const detectedLocale = this._detectLocaleFromRoute(route);
            if (!localeInfo.routes[detectedLocale]) {
              localeInfo.routes[detectedLocale] = [];
            }
            localeInfo.routes[detectedLocale].push(route);
          } else if (typeof route === 'object' && route.path && route.locale) {
            if (!localeInfo.routes[route.locale]) {
              localeInfo.routes[route.locale] = [];
            }
            localeInfo.routes[route.locale].push(route.path);
          }
        });
      } else if (typeof frontmatter.route === 'object') {
        // Locale-keyed routes
        localeInfo.routes = { ...frontmatter.route };
        localeInfo.locales = Object.keys(frontmatter.route);
      } else if (typeof frontmatter.route === 'string') {
        // Single route - assign to default locale
        localeInfo.routes[localeInfo.defaultLocale] = [frontmatter.route];
      }
    }

    return localeInfo;
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
   * Check if value is a valid YAML data type
   * @private
   */
  _isValidDataType(value) {
    const validTypes = ['string', 'number', 'boolean', 'object'];
    const type = typeof value;

    if (validTypes.includes(type)) {
      return true;
    }

    // Arrays are objects in JavaScript
    if (Array.isArray(value)) {
      return true;
    }

    // null is valid
    if (value === null) {
      return true;
    }

    return false;
  }
}

/**
 * Default parser instance
 */
export const defaultParser = new FrontmatterParser();

/**
 * Convenience function for parsing frontmatter
 * @param {string} content - File content to parse
 * @param {Object} options - Parser options
 * @returns {FrontmatterResult} - Parse result
 */
export function parseFrontmatter(content, options = {}) {
  const parser = new FrontmatterParser(options);
  return parser.parse(content);
}