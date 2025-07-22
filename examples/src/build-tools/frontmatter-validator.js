/**
 * Frontmatter validation and schema checking for MTM files
 * Validates required fields, route patterns, and provides helpful suggestions
 */

/**
 * Validation error class for detailed error reporting
 */
export class FrontmatterValidationError extends Error {
  constructor(message, field = null, value = null, suggestions = []) {
    super(message);
    this.name = 'FrontmatterValidationError';
    this.field = field;
    this.value = value;
    this.suggestions = suggestions;
  }
}

/**
 * Validation result class
 */
export class ValidationResult {
  constructor(isValid = true, errors = [], warnings = []) {
    this.isValid = isValid;
    this.errors = errors;
    this.warnings = warnings;
  }

  addError(error) {
    this.errors.push(error);
    this.isValid = false;
  }

  addWarning(warning) {
    this.warnings.push(warning);
  }
}

/**
 * Schema definition for MTM frontmatter
 */
export const MTM_SCHEMA = {
  required: ['route', 'title', 'description'],
  optional: [
    'keywords',
    'layout',
    'status',
    'locales',
    'metadata',
    'noIndex',
    'lastModified',
    'author',
    'version',
    'draft',
    'published',
    'tags',
    'category',
    'priority',
    'canonical',
    'redirect'
  ],
  types: {
    route: 'string',
    title: 'string',
    description: 'string',
    keywords: 'array',
    layout: 'string',
    status: 'number',
    locales: 'object',
    metadata: 'object',
    noIndex: 'boolean',
    lastModified: ['string', 'date'],
    author: 'string',
    version: ['string', 'number'],
    draft: 'boolean',
    published: 'boolean',
    tags: 'array',
    category: 'string',
    priority: 'number',
    canonical: 'string',
    redirect: 'string'
  },
  constraints: {
    route: {
      pattern: /^\/[a-zA-Z0-9\-_\/\[\]\.]*$/,
      maxLength: 200
    },
    title: {
      minLength: 1,
      maxLength: 100
    },
    description: {
      minLength: 10,
      maxLength: 300
    },
    status: {
      allowedValues: [200, 301, 302, 404, 500]
    },
    priority: {
      min: 0,
      max: 10
    }
  }
};

/**
 * Frontmatter validator with comprehensive schema checking
 */
export class FrontmatterValidator {
  constructor(schema = MTM_SCHEMA, options = {}) {
    this.schema = schema;
    this.options = {
      strictMode: false,
      allowUnknownFields: true,
      validateRouteUniqueness: true,
      ...options
    };
    this.knownRoutes = new Set();
  }

  /**
   * Validate frontmatter against schema
   * @param {Object} frontmatter - Parsed frontmatter object
   * @param {string} filePath - File path for context in error messages
   * @returns {ValidationResult} - Validation result with errors and warnings
   */
  validate(frontmatter, filePath = 'unknown') {
    const result = new ValidationResult();

    if (!frontmatter || typeof frontmatter !== 'object') {
      result.addError(new FrontmatterValidationError(
        'Frontmatter must be an object',
        null,
        frontmatter,
        ['Ensure frontmatter is properly formatted as YAML object']
      ));
      return result;
    }

    // Check required fields
    this._validateRequiredFields(frontmatter, result, filePath);

    // Check field types
    this._validateFieldTypes(frontmatter, result, filePath);

    // Check field constraints
    this._validateFieldConstraints(frontmatter, result, filePath);

    // Check for unknown fields
    this._validateUnknownFields(frontmatter, result, filePath);

    // Validate route uniqueness
    if (this.options.validateRouteUniqueness) {
      this._validateRouteUniqueness(frontmatter, result, filePath);
    }

    // Additional semantic validations
    this._validateSemanticRules(frontmatter, result, filePath);

    return result;
  }

  /**
   * Validate multiple frontmatter objects and check for conflicts
   * @param {Array<{frontmatter: Object, filePath: string}>} items - Array of frontmatter objects
   * @returns {ValidationResult} - Combined validation result
   */
  validateMultiple(items) {
    const result = new ValidationResult();
    const routeMap = new Map();

    // First pass: validate individual items
    for (const item of items) {
      const itemResult = this.validate(item.frontmatter, item.filePath);
      result.errors.push(...itemResult.errors);
      result.warnings.push(...itemResult.warnings);

      if (!itemResult.isValid) {
        result.isValid = false;
      }

      // Collect routes for duplicate checking
      if (item.frontmatter.route) {
        if (!routeMap.has(item.frontmatter.route)) {
          routeMap.set(item.frontmatter.route, []);
        }
        routeMap.get(item.frontmatter.route).push(item.filePath);
      }
    }

    // Second pass: check for route conflicts
    for (const [route, files] of routeMap) {
      if (files.length > 1) {
        result.addError(new FrontmatterValidationError(
          `Duplicate route "${route}" found in multiple files: ${files.join(', ')}`,
          'route',
          route,
          [
            'Ensure each route is unique across all pages',
            'Consider using different route patterns',
            'Check for typos in route definitions'
          ]
        ));
      }
    }

    return result;
  }

  /**
   * Validate required fields
   * @private
   */
  _validateRequiredFields(frontmatter, result, filePath) {
    for (const field of this.schema.required) {
      if (!(field in frontmatter) || frontmatter[field] === null || frontmatter[field] === undefined) {
        result.addError(new FrontmatterValidationError(
          `Required field "${field}" is missing`,
          field,
          undefined,
          this._getFieldSuggestions(field)
        ));
      } else if (typeof frontmatter[field] === 'string' && frontmatter[field].trim() === '') {
        result.addError(new FrontmatterValidationError(
          `Required field "${field}" cannot be empty`,
          field,
          frontmatter[field],
          this._getFieldSuggestions(field)
        ));
      }
    }
  }

  /**
   * Validate field types
   * @private
   */
  _validateFieldTypes(frontmatter, result, filePath) {
    for (const [field, value] of Object.entries(frontmatter)) {
      if (!(field in this.schema.types)) {
        continue; // Skip unknown fields for now
      }

      const expectedTypes = Array.isArray(this.schema.types[field])
        ? this.schema.types[field]
        : [this.schema.types[field]];

      const actualType = this._getValueType(value);

      if (!expectedTypes.includes(actualType)) {
        result.addError(new FrontmatterValidationError(
          `Field "${field}" has invalid type. Expected: ${expectedTypes.join(' or ')}, got: ${actualType}`,
          field,
          value,
          [
            `Convert "${field}" to ${expectedTypes[0]} type`,
            ...this._getTypeConversionSuggestions(field, actualType, expectedTypes[0])
          ]
        ));
      }
    }
  }

  /**
   * Validate field constraints
   * @private
   */
  _validateFieldConstraints(frontmatter, result, filePath) {
    for (const [field, value] of Object.entries(frontmatter)) {
      if (!(field in this.schema.constraints)) {
        continue;
      }

      const constraints = this.schema.constraints[field];

      // Pattern validation
      if (constraints.pattern && typeof value === 'string') {
        if (!constraints.pattern.test(value)) {
          result.addError(new FrontmatterValidationError(
            `Field "${field}" does not match required pattern`,
            field,
            value,
            this._getPatternSuggestions(field, value)
          ));
        }
      }

      // Length validation
      if (typeof value === 'string') {
        if (constraints.minLength && value.length < constraints.minLength) {
          result.addError(new FrontmatterValidationError(
            `Field "${field}" is too short. Minimum length: ${constraints.minLength}`,
            field,
            value,
            [`Add more content to "${field}" field`]
          ));
        }
        if (constraints.maxLength && value.length > constraints.maxLength) {
          result.addError(new FrontmatterValidationError(
            `Field "${field}" is too long. Maximum length: ${constraints.maxLength}`,
            field,
            value,
            [`Shorten the "${field}" field to ${constraints.maxLength} characters or less`]
          ));
        }
      }

      // Numeric constraints
      if (typeof value === 'number') {
        if (constraints.min !== undefined && value < constraints.min) {
          result.addError(new FrontmatterValidationError(
            `Field "${field}" is below minimum value. Minimum: ${constraints.min}`,
            field,
            value,
            [`Set "${field}" to ${constraints.min} or higher`]
          ));
        }
        if (constraints.max !== undefined && value > constraints.max) {
          result.addError(new FrontmatterValidationError(
            `Field "${field}" exceeds maximum value. Maximum: ${constraints.max}`,
            field,
            value,
            [`Set "${field}" to ${constraints.max} or lower`]
          ));
        }
      }

      // Allowed values validation
      if (constraints.allowedValues && !constraints.allowedValues.includes(value)) {
        result.addError(new FrontmatterValidationError(
          `Field "${field}" has invalid value. Allowed values: ${constraints.allowedValues.join(', ')}`,
          field,
          value,
          [`Use one of: ${constraints.allowedValues.join(', ')}`]
        ));
      }
    }
  }

  /**
   * Validate unknown fields
   * @private
   */
  _validateUnknownFields(frontmatter, result, filePath) {
    if (this.options.allowUnknownFields) {
      return; // Skip validation if unknown fields are allowed
    }

    const knownFields = [...this.schema.required, ...this.schema.optional];

    for (const field of Object.keys(frontmatter)) {
      if (!knownFields.includes(field)) {
        if (this.options.strictMode) {
          result.addError(new FrontmatterValidationError(
            `Unknown field "${field}" is not allowed in strict mode`,
            field,
            frontmatter[field],
            [
              'Remove the unknown field',
              'Check for typos in field name',
              `Did you mean: ${this._findSimilarField(field, knownFields)}`
            ]
          ));
        } else {
          result.addWarning(new FrontmatterValidationError(
            `Unknown field "${field}" found`,
            field,
            frontmatter[field],
            [
              'Consider removing if not needed',
              'Check for typos in field name',
              `Did you mean: ${this._findSimilarField(field, knownFields)}`
            ]
          ));
        }
      }
    }
  }

  /**
   * Validate route uniqueness
   * @private
   */
  _validateRouteUniqueness(frontmatter, result, filePath) {
    if (!frontmatter.route) {
      return;
    }

    if (this.knownRoutes.has(frontmatter.route)) {
      result.addError(new FrontmatterValidationError(
        `Duplicate route "${frontmatter.route}" detected`,
        'route',
        frontmatter.route,
        [
          'Use a unique route for each page',
          'Check for duplicate route definitions',
          'Consider using dynamic routes with parameters'
        ]
      ));
    } else {
      this.knownRoutes.add(frontmatter.route);
    }
  }

  /**
   * Validate semantic rules
   * @private
   */
  _validateSemanticRules(frontmatter, result, filePath) {
    // Check if draft pages have appropriate status
    if (frontmatter.draft === true && frontmatter.status === 200) {
      result.addWarning(new FrontmatterValidationError(
        'Draft pages should not have status 200',
        'status',
        frontmatter.status,
        ['Set status to 404 or remove draft flag']
      ));
    }

    // Check if 404 pages have appropriate route
    if (frontmatter.status === 404 && !frontmatter.route.includes('404')) {
      result.addWarning(new FrontmatterValidationError(
        '404 pages should have "404" in their route',
        'route',
        frontmatter.route,
        ['Consider using route like "/404" or "/not-found"']
      ));
    }

    // Check if redirect pages have redirect field
    if (frontmatter.status === 301 || frontmatter.status === 302) {
      if (!frontmatter.redirect) {
        result.addError(new FrontmatterValidationError(
          'Redirect pages must have a redirect field',
          'redirect',
          undefined,
          ['Add redirect field with target URL']
        ));
      }
    }

    // Check keywords array length
    if (frontmatter.keywords && Array.isArray(frontmatter.keywords)) {
      if (frontmatter.keywords.length === 0) {
        result.addWarning(new FrontmatterValidationError(
          'Keywords array is empty',
          'keywords',
          frontmatter.keywords,
          ['Add relevant keywords for SEO', 'Remove keywords field if not needed']
        ));
      } else if (frontmatter.keywords.length > 10) {
        result.addWarning(new FrontmatterValidationError(
          'Too many keywords (recommended: 3-7)',
          'keywords',
          frontmatter.keywords,
          ['Reduce to 3-7 most relevant keywords']
        ));
      }
    }
  }

  /**
   * Get value type including special cases
   * @private
   */
  _getValueType(value) {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    if (value instanceof Date) return 'date';
    return typeof value;
  }

  /**
   * Get field-specific suggestions
   * @private
   */
  _getFieldSuggestions(field) {
    const suggestions = {
      route: [
        'Add route field, e.g., route: /example',
        'Route should start with / and use lowercase',
        'Use hyphens for multi-word routes: /my-page'
      ],
      title: [
        'Add title field, e.g., title: "Page Title"',
        'Keep title concise and descriptive',
        'Use title case for better readability'
      ],
      description: [
        'Add description field for SEO',
        'Keep description between 10-300 characters',
        'Make it compelling and informative'
      ]
    };

    return suggestions[field] || [`Add ${field} field with appropriate value`];
  }

  /**
   * Get type conversion suggestions
   * @private
   */
  _getTypeConversionSuggestions(field, actualType, expectedType) {
    const conversions = {
      'string->number': ['Remove quotes around numeric value', 'Use numeric value: 42 instead of "42"'],
      'string->boolean': ['Use boolean value: true/false instead of "true"/"false"'],
      'number->string': ['Add quotes around value', 'Use string value: "42" instead of 42'],
      'string->array': ['Use YAML array syntax: [item1, item2] or\\n  - item1\\n  - item2'],
      'string->object': ['Use YAML object syntax: {key: value} or\\n  key: value']
    };

    const key = `${actualType}->${expectedType}`;
    return conversions[key] || [`Convert to ${expectedType} type`];
  }

  /**
   * Get pattern-specific suggestions
   * @private
   */
  _getPatternSuggestions(field, value) {
    if (field === 'route') {
      return [
        'Route must start with /',
        'Use only letters, numbers, hyphens, underscores, and slashes',
        'Examples: /, /about, /blog/[slug], /users/[id]',
        'Avoid spaces and special characters'
      ];
    }
    return ['Check field format and fix any invalid characters'];
  }

  /**
   * Find similar field name for typo suggestions
   * @private
   */
  _findSimilarField(field, knownFields) {
    const similarities = knownFields.map(known => ({
      field: known,
      score: this._calculateSimilarity(field, known)
    }));

    similarities.sort((a, b) => b.score - a.score);
    return similarities[0]?.field || 'none';
  }

  /**
   * Calculate string similarity (simple Levenshtein-based)
   * @private
   */
  _calculateSimilarity(str1, str2) {
    const len1 = str1.length;
    const len2 = str2.length;

    if (len1 === 0) return len2;
    if (len2 === 0) return len1;

    const matrix = Array(len2 + 1).fill().map(() => Array(len1 + 1).fill(0));

    for (let i = 0; i <= len1; i++) matrix[0][i] = i;
    for (let j = 0; j <= len2; j++) matrix[j][0] = j;

    for (let j = 1; j <= len2; j++) {
      for (let i = 1; i <= len1; i++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j - 1][i] + 1,
          matrix[j][i - 1] + 1,
          matrix[j - 1][i - 1] + cost
        );
      }
    }

    const distance = matrix[len2][len1];
    return 1 - distance / Math.max(len1, len2);
  }

  /**
   * Reset known routes (useful for testing)
   */
  resetKnownRoutes() {
    this.knownRoutes.clear();
  }
}

/**
 * Default validator instance
 */
export const defaultValidator = new FrontmatterValidator();

/**
 * Convenience function for validating frontmatter
 * @param {Object} frontmatter - Frontmatter object to validate
 * @param {string} filePath - File path for context
 * @param {Object} options - Validator options
 * @returns {ValidationResult} - Validation result
 */
export function validateFrontmatter(frontmatter, filePath = 'unknown', options = {}) {
  const validator = new FrontmatterValidator(MTM_SCHEMA, options);
  return validator.validate(frontmatter, filePath);
}