import { readFileSync } from 'fs';
import { parse as parseYaml } from 'yaml';
import type { MTMFile, ValidationResult, FileParser } from '../types/mtm-file.js';

/**
 * Parser for .mtm files that extracts YAML frontmatter and component content
 */
export class MTMParser implements FileParser {
  private static readonly FRONTMATTER_DELIMITER = '---';
  private static readonly SUPPORTED_TARGETS = ['reactjs', 'vue', 'solid', 'svelte'] as const;

  /**
   * Parse a .mtm file and extract frontmatter and content
   */
  parse(filePath: string): MTMFile {
    try {
      const fileContent = readFileSync(filePath, 'utf-8');
      const { frontmatter, content } = this.extractFrontmatter(fileContent);
      
      const validationResult = this.validate(frontmatter);
      if (!validationResult.isValid) {
        throw new Error(`Invalid frontmatter in ${filePath}: ${validationResult.errors.join(', ')}`);
      }

      return {
        frontmatter,
        content: content.trim(),
        filePath
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to parse MTM file ${filePath}: ${error.message}`);
      }
      throw new Error(`Failed to parse MTM file ${filePath}: Unknown error`);
    }
  }

  /**
   * Validate frontmatter configuration
   */
  validate(frontmatter: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if frontmatter is an object
    if (!frontmatter || typeof frontmatter !== 'object') {
      errors.push('Frontmatter must be a valid YAML object');
      return { isValid: false, errors, warnings };
    }

    // Validate required 'target' field
    if (!frontmatter.target) {
      errors.push('Missing required field: target');
    } else if (!MTMParser.SUPPORTED_TARGETS.includes(frontmatter.target)) {
      errors.push(`Invalid target '${frontmatter.target}'. Supported targets: ${MTMParser.SUPPORTED_TARGETS.join(', ')}`);
    }

    // Validate optional 'channels' field
    if (frontmatter.channels !== undefined) {
      if (!Array.isArray(frontmatter.channels)) {
        errors.push('Field "channels" must be an array');
      } else {
        frontmatter.channels.forEach((channel: any, index: number) => {
          if (!channel || typeof channel !== 'object') {
            errors.push(`Channel at index ${index} must be an object`);
            return;
          }
          
          if (!channel.event || typeof channel.event !== 'string') {
            errors.push(`Channel at index ${index} missing required string field: event`);
          }
          
          if (!channel.emit || typeof channel.emit !== 'string') {
            errors.push(`Channel at index ${index} missing required string field: emit`);
          }

          // Validate event name format (alphanumeric, underscore, dash)
          if (channel.event && !/^[a-zA-Z0-9_-]+$/.test(channel.event)) {
            errors.push(`Channel at index ${index}: event name '${channel.event}' contains invalid characters. Use only letters, numbers, underscores, and dashes`);
          }

          // Validate emit function name format (valid JavaScript identifier)
          if (channel.emit && !/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(channel.emit)) {
            errors.push(`Channel at index ${index}: emit function name '${channel.emit}' is not a valid JavaScript identifier`);
          }
        });
      }
    }

    // Validate optional 'route' field
    if (frontmatter.route !== undefined) {
      if (typeof frontmatter.route !== 'string') {
        errors.push('Field "route" must be a string');
      } else if (!frontmatter.route.startsWith('/')) {
        errors.push('Field "route" must start with "/"');
      }
    }

    // Validate optional 'layout' field
    if (frontmatter.layout !== undefined) {
      if (typeof frontmatter.layout !== 'string') {
        errors.push('Field "layout" must be a string');
      } else if (frontmatter.layout.trim().length === 0) {
        errors.push('Field "layout" cannot be empty');
      }
    }

    // Check for unknown fields and warn
    const knownFields = ['target', 'channels', 'route', 'layout'];
    const unknownFields = Object.keys(frontmatter).filter(key => !knownFields.includes(key));
    if (unknownFields.length > 0) {
      warnings.push(`Unknown fields in frontmatter: ${unknownFields.join(', ')}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Extract frontmatter and content from file content
   */
  private extractFrontmatter(fileContent: string): { frontmatter: any; content: string } {
    const lines = fileContent.split('\n');
    
    // Check if file starts with frontmatter delimiter
    if (lines[0]?.trim() !== MTMParser.FRONTMATTER_DELIMITER) {
      throw new Error('MTM file must start with YAML frontmatter delimited by "---"');
    }

    // Find the closing delimiter
    let closingDelimiterIndex = -1;
    for (let i = 1; i < lines.length; i++) {
      if (lines[i]?.trim() === MTMParser.FRONTMATTER_DELIMITER) {
        closingDelimiterIndex = i;
        break;
      }
    }

    if (closingDelimiterIndex === -1) {
      throw new Error('MTM file frontmatter must be closed with "---"');
    }

    // Extract frontmatter YAML
    const frontmatterLines = lines.slice(1, closingDelimiterIndex);
    const frontmatterYaml = frontmatterLines.join('\n');
    
    // Extract content after frontmatter
    const contentLines = lines.slice(closingDelimiterIndex + 1);
    const content = contentLines.join('\n');

    try {
      const frontmatter = parseYaml(frontmatterYaml);
      return { frontmatter, content };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Invalid YAML in frontmatter: ${error.message}`);
      }
      throw new Error('Invalid YAML in frontmatter');
    }
  }
}