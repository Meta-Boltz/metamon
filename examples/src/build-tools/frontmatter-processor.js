/**
 * Integrated frontmatter processor that combines parsing and validation
 * Provides a unified interface for processing MTM file frontmatter
 */

import { FrontmatterParser, FrontmatterParseError } from './frontmatter-parser.js';
import { FrontmatterValidator, FrontmatterValidationError } from './frontmatter-validator.js';

/**
 * Combined processing result
 */
export class FrontmatterProcessingResult {
  constructor(frontmatter = {}, content = '', parseErrors = [], validationErrors = [], warnings = []) {
    this.frontmatter = frontmatter;
    this.content = content;
    this.parseErrors = parseErrors;
    this.validationErrors = validationErrors;
    this.warnings = warnings;
  }

  get isValid() {
    return this.parseErrors.length === 0 && this.validationErrors.length === 0;
  }

  get hasWarnings() {
    return this.warnings.length > 0;
  }

  get allErrors() {
    return [...this.parseErrors, ...this.validationErrors];
  }

  /**
   * Get formatted error report
   */
  getErrorReport(filePath = 'unknown') {
    const lines = [];

    if (this.parseErrors.length > 0) {
      lines.push(`Parse Errors in ${filePath}:`);
      for (const error of this.parseErrors) {
        lines.push(`  - ${error.message}`);
        if (error.line) {
          lines.push(`    Line ${error.line}${error.column ? `, Column ${error.column}` : ''}`);
        }
        if (error.suggestions.length > 0) {
          lines.push(`    Suggestions:`);
          for (const suggestion of error.suggestions) {
            lines.push(`      • ${suggestion}`);
          }
        }
      }
      lines.push('');
    }

    if (this.validationErrors.length > 0) {
      lines.push(`Validation Errors in ${filePath}:`);
      for (const error of this.validationErrors) {
        lines.push(`  - ${error.message}`);
        if (error.field) {
          lines.push(`    Field: ${error.field}`);
        }
        if (error.suggestions.length > 0) {
          lines.push(`    Suggestions:`);
          for (const suggestion of error.suggestions) {
            lines.push(`      • ${suggestion}`);
          }
        }
      }
      lines.push('');
    }

    if (this.warnings.length > 0) {
      lines.push(`Warnings in ${filePath}:`);
      for (const warning of this.warnings) {
        lines.push(`  - ${warning.message}`);
        if (warning.field) {
          lines.push(`    Field: ${warning.field}`);
        }
        if (warning.suggestions.length > 0) {
          lines.push(`    Suggestions:`);
          for (const suggestion of warning.suggestions) {
            lines.push(`      • ${suggestion}`);
          }
        }
      }
    }

    return lines.join('\n');
  }
}

/**
 * Integrated frontmatter processor
 */
export class FrontmatterProcessor {
  constructor(parserOptions = {}, validatorOptions = {}) {
    this.parser = new FrontmatterParser(parserOptions);
    this.validator = new FrontmatterValidator(undefined, validatorOptions);
  }

  /**
   * Process frontmatter from MTM file content
   * @param {string} content - The full file content
   * @param {string} filePath - File path for context in error messages
   * @returns {FrontmatterProcessingResult} - Combined processing result
   */
  process(content, filePath = 'unknown') {
    // First, parse the frontmatter
    const parseResult = this.parser.parse(content);

    if (!parseResult.isValid) {
      return new FrontmatterProcessingResult(
        {},
        parseResult.content,
        parseResult.errors,
        [],
        []
      );
    }

    // If parsing succeeded, validate the frontmatter
    const validationResult = this.validator.validate(parseResult.frontmatter, filePath);

    return new FrontmatterProcessingResult(
      parseResult.frontmatter,
      parseResult.content,
      [],
      validationResult.errors,
      validationResult.warnings
    );
  }

  /**
   * Process multiple files and check for cross-file conflicts
   * @param {Array<{content: string, filePath: string}>} files - Array of file objects
   * @returns {Array<{filePath: string, result: FrontmatterProcessingResult}>} - Array of processing results
   */
  processMultiple(files) {
    const results = [];
    const validationItems = [];

    // First pass: parse all files
    for (const file of files) {
      const parseResult = this.parser.parse(file.content);

      if (parseResult.isValid) {
        validationItems.push({
          frontmatter: parseResult.frontmatter,
          filePath: file.filePath
        });

        results.push({
          filePath: file.filePath,
          result: new FrontmatterProcessingResult(
            parseResult.frontmatter,
            parseResult.content,
            [],
            [],
            []
          )
        });
      } else {
        results.push({
          filePath: file.filePath,
          result: new FrontmatterProcessingResult(
            {},
            parseResult.content,
            parseResult.errors,
            [],
            []
          )
        });
      }
    }

    // Second pass: validate all parsed frontmatter together
    if (validationItems.length > 0) {
      const multiValidationResult = this.validator.validateMultiple(validationItems);

      // Distribute validation errors back to individual results
      for (const error of multiValidationResult.errors) {
        // Find which file this error belongs to
        const targetFile = this._findErrorTargetFile(error, validationItems);
        if (targetFile) {
          const resultItem = results.find(r => r.filePath === targetFile);
          if (resultItem) {
            resultItem.result.validationErrors.push(error);
          }
        }
      }

      // Distribute warnings back to individual results
      for (const warning of multiValidationResult.warnings) {
        const targetFile = this._findErrorTargetFile(warning, validationItems);
        if (targetFile) {
          const resultItem = results.find(r => r.filePath === targetFile);
          if (resultItem) {
            resultItem.result.warnings.push(warning);
          }
        }
      }
    }

    return results;
  }

  /**
   * Find which file a validation error belongs to
   * @private
   */
  _findErrorTargetFile(error, validationItems) {
    // For route conflicts, the error message contains file names
    if (error.message.includes('Duplicate route') && error.message.includes('found in multiple files:')) {
      // This is a cross-file error, we'll add it to all affected files
      const fileMatches = error.message.match(/found in multiple files: (.+)$/);
      if (fileMatches) {
        const fileList = fileMatches[1].split(', ');
        return fileList[0]; // Return first file for now
      }
    }

    // For other errors, try to match by field value
    if (error.field && error.value) {
      for (const item of validationItems) {
        if (item.frontmatter[error.field] === error.value) {
          return item.filePath;
        }
      }
    }

    // Default to first file if we can't determine
    return validationItems[0]?.filePath;
  }

  /**
   * Reset validator state (useful for testing)
   */
  reset() {
    this.validator.resetKnownRoutes();
  }

  /**
   * Get processing statistics
   * @param {Array<{filePath: string, result: FrontmatterProcessingResult}>} results - Processing results
   * @returns {Object} - Statistics object
   */
  getStatistics(results) {
    const stats = {
      totalFiles: results.length,
      validFiles: 0,
      filesWithErrors: 0,
      filesWithWarnings: 0,
      totalParseErrors: 0,
      totalValidationErrors: 0,
      totalWarnings: 0,
      commonErrors: new Map(),
      commonWarnings: new Map()
    };

    for (const { result } of results) {
      if (result.isValid) {
        stats.validFiles++;
      } else {
        stats.filesWithErrors++;
      }

      if (result.hasWarnings) {
        stats.filesWithWarnings++;
      }

      stats.totalParseErrors += result.parseErrors.length;
      stats.totalValidationErrors += result.validationErrors.length;
      stats.totalWarnings += result.warnings.length;

      // Count common error types
      for (const error of result.allErrors) {
        const errorType = this._getErrorType(error);
        stats.commonErrors.set(errorType, (stats.commonErrors.get(errorType) || 0) + 1);
      }

      for (const warning of result.warnings) {
        const warningType = this._getErrorType(warning);
        stats.commonWarnings.set(warningType, (stats.commonWarnings.get(warningType) || 0) + 1);
      }
    }

    return stats;
  }

  /**
   * Get error type for statistics
   * @private
   */
  _getErrorType(error) {
    if (error instanceof FrontmatterParseError) {
      if (error.message.includes('YAML parsing error')) return 'yaml_syntax';
      if (error.message.includes('no closing delimiter')) return 'missing_delimiter';
      if (error.message.includes('must be an object')) return 'invalid_structure';
      return 'parse_error';
    }

    if (error instanceof FrontmatterValidationError) {
      if (error.message.includes('Required field')) return 'missing_required_field';
      if (error.message.includes('invalid type')) return 'invalid_type';
      if (error.message.includes('does not match required pattern')) return 'invalid_pattern';
      if (error.message.includes('Duplicate route')) return 'duplicate_route';
      return 'validation_error';
    }

    return 'unknown_error';
  }
}

/**
 * Default processor instance
 */
export const defaultProcessor = new FrontmatterProcessor();

/**
 * Convenience function for processing frontmatter
 * @param {string} content - File content to process
 * @param {string} filePath - File path for context
 * @param {Object} options - Processing options
 * @returns {FrontmatterProcessingResult} - Processing result
 */
export function processFrontmatter(content, filePath = 'unknown', options = {}) {
  const processor = new FrontmatterProcessor(options.parser, options.validator);
  return processor.process(content, filePath);
}