/**
 * Backward Compatibility Layer for MTM
 * Provides gradual migration support and legacy format handling
 */

import { FrontmatterParser } from '../../../examples/src/build-tools/frontmatter-parser.js';

export class BackwardCompatibilityLayer {
  constructor(options = {}) {
    this.options = {
      enableLegacySupport: true,
      warnOnDeprecated: true,
      strictMode: false,
      ...options
    };

    this.parser = new FrontmatterParser();
    this.deprecationWarnings = new Set();
  }

  /**
   * Process MTM file with backward compatibility
   * @param {string} content - File content
   * @param {string} filePath - File path for context
   * @returns {ProcessResult}
   */
  process(content, filePath) {
    const result = {
      frontmatter: {},
      content: '',
      warnings: [],
      errors: [],
      needsMigration: false,
      compatibilityLevel: 'modern'
    };

    try {
      // Parse frontmatter
      const parseResult = this.parser.parse(content);

      if (!parseResult.isValid) {
        result.errors = parseResult.errors;
        return result;
      }

      // Detect format version
      const formatInfo = this.detectFormatVersion(parseResult.frontmatter, parseResult.content);
      result.compatibilityLevel = formatInfo.level;
      result.needsMigration = formatInfo.needsMigration;

      // Apply compatibility transformations
      const compatResult = this.applyCompatibilityTransforms(
        parseResult.frontmatter,
        parseResult.content,
        formatInfo,
        filePath
      );

      result.frontmatter = compatResult.frontmatter;
      result.content = compatResult.content;
      result.warnings = compatResult.warnings;

      return result;

    } catch (error) {
      result.errors.push({
        type: 'compatibility_error',
        message: `Compatibility processing failed: ${error.message}`,
        suggestion: 'Check file format and consider migration'
      });
      return result;
    }
  }

  /**
   * Detect format version and compatibility level
   * @private
   */
  detectFormatVersion(frontmatter, content) {
    const indicators = {
      legacy: 0,
      transitional: 0,
      modern: 0
    };

    // Check frontmatter indicators
    const legacyFields = ['page_title', 'page_description', 'meta_keywords', 'template', 'http_status'];
    const modernFields = ['title', 'description', 'keywords', 'layout', 'status'];

    legacyFields.forEach(field => {
      if (frontmatter[field]) indicators.legacy++;
    });

    modernFields.forEach(field => {
      if (frontmatter[field]) indicators.modern++;
    });

    // Check route format
    if (frontmatter.route) {
      if (typeof frontmatter.route === 'string' && frontmatter.route.includes(',')) {
        indicators.legacy++;
      } else if (typeof frontmatter.route === 'object' || Array.isArray(frontmatter.route)) {
        indicators.modern++;
      } else {
        indicators.transitional++;
      }
    }

    // Check content syntax
    const contentIndicators = this.analyzeContentSyntax(content);
    indicators.legacy += contentIndicators.legacy;
    indicators.transitional += contentIndicators.transitional;
    indicators.modern += contentIndicators.modern;

    // Determine level
    let level = 'modern';
    let needsMigration = false;

    if (indicators.legacy > indicators.modern) {
      level = 'legacy';
      needsMigration = true;
    } else if (indicators.legacy > 0 || indicators.transitional > indicators.modern) {
      level = 'transitional';
      needsMigration = true;
    }

    return { level, needsMigration, indicators };
  }

  /**
   * Analyze content syntax for version indicators
   * @private
   */
  analyzeContentSyntax(content) {
    const indicators = { legacy: 0, transitional: 0, modern: 0 };

    // Legacy patterns
    const legacyPatterns = [
      /\$\w+\s*=\s*createSignal\(/,
      /on[A-Z]\w*=\{/,
      /<div[^>]*class=/,
      /\$mount\s*=/,
      /\$destroy\s*=/
    ];

    // Modern patterns
    const modernPatterns = [
      /\$\w+!\s*=\s*signal\(/,
      /\w+={[^}]+}/,
      /<template>/,
      /\$onMount\s*=/,
      /\$onDestroy\s*=/
    ];

    // Transitional patterns
    const transitionalPatterns = [
      /\$\w+\s*=\s*signal\(/,
      /className=/,
      /{#if/,
      /{#each/
    ];

    legacyPatterns.forEach(pattern => {
      if (pattern.test(content)) indicators.legacy++;
    });

    modernPatterns.forEach(pattern => {
      if (pattern.test(content)) indicators.modern++;
    });

    transitionalPatterns.forEach(pattern => {
      if (pattern.test(content)) indicators.transitional++;
    });

    return indicators;
  }

  /**
   * Apply compatibility transformations
   * @private
   */
  applyCompatibilityTransforms(frontmatter, content, formatInfo, filePath) {
    const result = {
      frontmatter: { ...frontmatter },
      content,
      warnings: []
    };

    // Transform frontmatter
    const frontmatterResult = this.transformFrontmatter(result.frontmatter, formatInfo, filePath);
    result.frontmatter = frontmatterResult.frontmatter;
    result.warnings.push(...frontmatterResult.warnings);

    // Transform content
    const contentResult = this.transformContent(result.content, formatInfo, filePath);
    result.content = contentResult.content;
    result.warnings.push(...contentResult.warnings);

    return result;
  }

  /**
   * Transform frontmatter for compatibility
   * @private
   */
  transformFrontmatter(frontmatter, formatInfo, filePath) {
    const warnings = [];
    const transformed = { ...frontmatter };

    // Handle legacy field mappings
    const legacyMappings = {
      'page_title': 'title',
      'page_description': 'description',
      'meta_keywords': 'keywords',
      'template': 'layout',
      'http_status': 'status'
    };

    Object.entries(legacyMappings).forEach(([oldField, newField]) => {
      if (transformed[oldField]) {
        if (!transformed[newField]) {
          transformed[newField] = transformed[oldField];
        }

        if (this.options.warnOnDeprecated) {
          warnings.push({
            type: 'deprecated_field',
            message: `Field '${oldField}' is deprecated, use '${newField}' instead`,
            file: filePath,
            suggestion: `Replace '${oldField}: ${transformed[oldField]}' with '${newField}: ${transformed[oldField]}'`
          });
        }

        // Keep legacy field for backward compatibility unless in strict mode
        if (this.options.strictMode) {
          delete transformed[oldField];
        }
      }
    });

    // Handle legacy route format
    if (transformed.route && typeof transformed.route === 'string' && transformed.route.includes(',')) {
      const legacyRoute = transformed.route;
      const migratedRoute = this.migrateLegacyRoute(legacyRoute);

      transformed.route = migratedRoute.route;
      if (migratedRoute.locales) {
        transformed.locales = migratedRoute.locales;
      }

      warnings.push({
        type: 'legacy_route_format',
        message: 'Legacy route format detected and converted',
        file: filePath,
        before: legacyRoute,
        after: transformed.route,
        suggestion: 'Update to use modern route format'
      });
    }

    // Normalize keywords
    if (transformed.keywords && typeof transformed.keywords === 'string') {
      transformed.keywords = transformed.keywords.split(',').map(k => k.trim());

      warnings.push({
        type: 'keywords_format',
        message: 'Keywords converted from string to array format',
        file: filePath,
        suggestion: 'Use array format for keywords: [keyword1, keyword2]'
      });
    }

    return { frontmatter: transformed, warnings };
  }

  /**
   * Transform content for compatibility
   * @private
   */
  transformContent(content, formatInfo, filePath) {
    const warnings = [];
    let transformed = content;

    // Handle legacy signal syntax
    const legacySignalPattern = /\$(\w+)\s*=\s*createSignal\(([^)]+)\)/g;
    let match;
    while ((match = legacySignalPattern.exec(content)) !== null) {
      const [fullMatch, varName, initialValue] = match;
      const modernSyntax = `$${varName}! = signal('${varName}', ${initialValue})`;

      transformed = transformed.replace(fullMatch, modernSyntax);

      warnings.push({
        type: 'legacy_signal_syntax',
        message: `Legacy signal syntax converted for ${varName}`,
        file: filePath,
        before: fullMatch,
        after: modernSyntax,
        suggestion: 'Use modern signal syntax: $var! = signal(key, value)'
      });
    }

    // Handle legacy event syntax
    const legacyEventPattern = /on([A-Z]\w*)=\{([^}]+)\}/g;
    transformed = transformed.replace(legacyEventPattern, (match, eventName, handler) => {
      const modernEvent = eventName.toLowerCase();
      const modernSyntax = `${modernEvent}={${handler}}`;

      warnings.push({
        type: 'legacy_event_syntax',
        message: `Legacy event syntax converted for ${eventName}`,
        file: filePath,
        before: match,
        after: modernSyntax,
        suggestion: 'Use lowercase event names: click={handler}'
      });

      return modernSyntax;
    });

    // Handle deprecated lifecycle methods
    const lifecycleMappings = {
      '$mount': '$onMount',
      '$destroy': '$onDestroy',
      '$update': '$onUpdate'
    };

    Object.entries(lifecycleMappings).forEach(([oldMethod, newMethod]) => {
      const pattern = new RegExp(`\\${oldMethod.replace('$', '\\$')}\\s*=`, 'g');
      if (pattern.test(transformed)) {
        transformed = transformed.replace(pattern, `${newMethod} =`);

        warnings.push({
          type: 'deprecated_lifecycle',
          message: `Deprecated lifecycle method ${oldMethod} converted to ${newMethod}`,
          file: filePath,
          suggestion: `Use ${newMethod} instead of ${oldMethod}`
        });
      }
    });

    // Wrap content in template if needed
    if (!transformed.includes('<template>') && transformed.includes('<div')) {
      const divMatch = transformed.match(/<div[\s\S]*$/);
      if (divMatch) {
        const wrappedContent = transformed.replace(divMatch[0], `<template>\n${divMatch[0]}\n</template>`);

        if (this.options.warnOnDeprecated) {
          warnings.push({
            type: 'missing_template_wrapper',
            message: 'Content should be wrapped in <template> tags',
            file: filePath,
            suggestion: 'Wrap your HTML content in <template></template> tags'
          });
        }

        // Auto-wrap in compatibility mode
        if (!this.options.strictMode) {
          transformed = wrappedContent;
        }
      }
    }

    return { content: transformed, warnings };
  }

  /**
   * Migrate legacy route format
   * @private
   */
  migrateLegacyRoute(legacyRoute) {
    const routes = {};
    const locales = [];

    // Handle "en:/path, fr:/chemin" format
    legacyRoute.split(',').forEach(routePart => {
      const trimmed = routePart.trim();
      const colonIndex = trimmed.indexOf(':');

      if (colonIndex > 0) {
        const locale = trimmed.substring(0, colonIndex);
        const path = trimmed.substring(colonIndex + 1);

        if (locale && path) {
          routes[locale] = path;
          locales.push(locale);
        }
      }
    });

    return { route: routes, locales };
  }

  /**
   * Check if file needs migration
   * @param {string} content - File content
   * @returns {boolean}
   */
  needsMigration(content) {
    const result = this.process(content, 'temp.mtm');
    return result.needsMigration;
  }

  /**
   * Get compatibility warnings for a file
   * @param {string} content - File content
   * @param {string} filePath - File path
   * @returns {Array} Warnings array
   */
  getCompatibilityWarnings(content, filePath) {
    const result = this.process(content, filePath);
    return result.warnings;
  }

  /**
   * Enable/disable strict mode
   * @param {boolean} enabled - Whether to enable strict mode
   */
  setStrictMode(enabled) {
    this.options.strictMode = enabled;
  }

  /**
   * Enable/disable deprecation warnings
   * @param {boolean} enabled - Whether to show deprecation warnings
   */
  setDeprecationWarnings(enabled) {
    this.options.warnOnDeprecated = enabled;
  }

  /**
   * Get summary of compatibility issues
   * @param {string[]} filePaths - Array of file paths to analyze
   * @returns {Promise<CompatibilitySummary>}
   */
  async getCompatibilitySummary(filePaths) {
    const summary = {
      totalFiles: filePaths.length,
      modernFiles: 0,
      transitionalFiles: 0,
      legacyFiles: 0,
      needsMigration: 0,
      commonIssues: {},
      recommendations: []
    };

    const fs = await import('fs/promises');

    for (const filePath of filePaths) {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const result = this.process(content, filePath);

        switch (result.compatibilityLevel) {
          case 'modern':
            summary.modernFiles++;
            break;
          case 'transitional':
            summary.transitionalFiles++;
            break;
          case 'legacy':
            summary.legacyFiles++;
            break;
        }

        if (result.needsMigration) {
          summary.needsMigration++;
        }

        // Collect common issues
        result.warnings.forEach(warning => {
          const key = warning.type;
          summary.commonIssues[key] = (summary.commonIssues[key] || 0) + 1;
        });

      } catch (error) {
        console.warn(`Failed to analyze ${filePath}: ${error.message}`);
      }
    }

    // Generate recommendations
    summary.recommendations = this.generateCompatibilityRecommendations(summary);

    return summary;
  }

  /**
   * Generate compatibility recommendations
   * @private
   */
  generateCompatibilityRecommendations(summary) {
    const recommendations = [];

    if (summary.legacyFiles > 0) {
      recommendations.push({
        type: 'migration_needed',
        priority: 'high',
        message: `${summary.legacyFiles} files use legacy format and should be migrated`,
        action: 'Run migration tool on legacy files'
      });
    }

    if (summary.transitionalFiles > 0) {
      recommendations.push({
        type: 'partial_migration',
        priority: 'medium',
        message: `${summary.transitionalFiles} files are partially migrated`,
        action: 'Complete migration for consistency'
      });
    }

    const topIssues = Object.entries(summary.commonIssues)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3);

    topIssues.forEach(([issue, count]) => {
      recommendations.push({
        type: 'common_issue',
        priority: 'medium',
        message: `${count} files have ${issue.replace(/_/g, ' ')} issues`,
        action: `Address ${issue} across affected files`
      });
    });

    return recommendations;
  }
}

export default BackwardCompatibilityLayer;