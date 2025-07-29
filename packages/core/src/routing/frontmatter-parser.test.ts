/**
 * Unit Tests for Frontmatter Parser
 * Tests frontmatter parsing with various input formats
 */

import { describe, it, expect, beforeEach } from 'vitest';

// Mock the PageScanner class for testing frontmatter parsing
class FrontmatterParser {
  parseYAMLStyle(yamlStr: string) {
    const result: Record<string, any> = {};
    const lines = yamlStr.split('\n');
    let currentKey: string | null = null;
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
          result[currentKey!] = this.parseValue(currentValue.trim());
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

  parseValue(value: string): any {
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

  parseFrontmatter(content: string, filePath: string) {
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
    const errors: any[] = [];
    let frontmatter = {};

    try {
      frontmatter = this.parseYAMLStyle(frontmatterStr);
    } catch (error: any) {
      errors.push({
        type: 'frontmatter_parse_error',
        message: `Failed to parse frontmatter: ${error.message}`,
        file: filePath,
        suggestion: 'Check YAML syntax - ensure proper indentation and colons'
      });

      // Fallback to simple key-value parsing
      try {
        frontmatter = this.parseSimpleKeyValue(frontmatterStr);
      } catch (fallbackError: any) {
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

  parseSimpleKeyValue(str: string) {
    const result: Record<string, any> = {};
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
}

describe('Frontmatter Parser', () => {
  let parser: FrontmatterParser;

  beforeEach(() => {
    parser = new FrontmatterParser();
  });

  describe('parseYAMLStyle', () => {
    it('should parse simple key-value pairs', () => {
      const yaml = `route: /test
title: Test Page
status: 200`;

      const result = parser.parseYAMLStyle(yaml);

      expect(result.route).toBe('/test');
      expect(result.title).toBe('Test Page');
      expect(result.status).toBe(200);
    });

    it('should parse arrays', () => {
      const yaml = `keywords: ["test", "page", "example"]
locales: [en, fr, es]`;

      const result = parser.parseYAMLStyle(yaml);

      expect(result.keywords).toEqual(['test', 'page', 'example']);
      expect(result.locales).toEqual(['en', 'fr', 'es']);
    });

    it('should parse objects', () => {
      const yaml = `metadata: {"author": "John Doe", "version": "1.0"}`;

      const result = parser.parseYAMLStyle(yaml);

      expect(result.metadata).toEqual({ author: 'John Doe', version: '1.0' });
    });

    it('should parse boolean values', () => {
      const yaml = `published: true
draft: false`;

      const result = parser.parseYAMLStyle(yaml);

      expect(result.published).toBe(true);
      expect(result.draft).toBe(false);
    });

    it('should parse null values', () => {
      const yaml = `value1: null
value2: ~`;

      const result = parser.parseYAMLStyle(yaml);

      expect(result.value1).toBe(null);
      expect(result.value2).toBe(null);
    });

    it('should parse numbers', () => {
      const yaml = `integer: 42
float: 3.14
negative: -10`;

      const result = parser.parseYAMLStyle(yaml);

      expect(result.integer).toBe(42);
      expect(result.float).toBe(3.14);
      expect(result.negative).toBe(-10);
    });

    it('should handle quoted strings', () => {
      const yaml = `title: "Quoted Title"
description: 'Single quoted'`;

      const result = parser.parseYAMLStyle(yaml);

      expect(result.title).toBe('Quoted Title');
      expect(result.description).toBe('Single quoted');
    });

    it('should skip comments and empty lines', () => {
      const yaml = `# This is a comment
route: /test

# Another comment
title: Test Page`;

      const result = parser.parseYAMLStyle(yaml);

      expect(result.route).toBe('/test');
      expect(result.title).toBe('Test Page');
      expect(Object.keys(result)).toHaveLength(2);
    });

    it('should throw error for invalid syntax', () => {
      const yaml = `invalid line without colon
route: /test`;

      expect(() => parser.parseYAMLStyle(yaml)).toThrow('Invalid syntax on line 1: missing colon');
    });

    it('should throw error for empty key', () => {
      const yaml = `: empty key`;

      expect(() => parser.parseYAMLStyle(yaml)).toThrow('Invalid syntax on line 1: empty key');
    });
  });

  describe('parseValue', () => {
    it('should parse string values', () => {
      expect(parser.parseValue('hello')).toBe('hello');
      expect(parser.parseValue('"quoted"')).toBe('quoted');
      expect(parser.parseValue("'single quoted'")).toBe('single quoted');
    });

    it('should parse array values', () => {
      expect(parser.parseValue('["a", "b", "c"]')).toEqual(['a', 'b', 'c']);
      expect(parser.parseValue('[1, 2, 3]')).toEqual([1, 2, 3]);
    });

    it('should parse object values', () => {
      expect(parser.parseValue('{"key": "value"}')).toEqual({ key: 'value' });
    });

    it('should parse boolean values', () => {
      expect(parser.parseValue('true')).toBe(true);
      expect(parser.parseValue('false')).toBe(false);
    });

    it('should parse null values', () => {
      expect(parser.parseValue('null')).toBe(null);
      expect(parser.parseValue('~')).toBe(null);
      expect(parser.parseValue('undefined')).toBe(undefined);
    });

    it('should parse number values', () => {
      expect(parser.parseValue('42')).toBe(42);
      expect(parser.parseValue('-10')).toBe(-10);
      expect(parser.parseValue('3.14')).toBe(3.14);
      expect(parser.parseValue('-2.5')).toBe(-2.5);
    });

    it('should handle malformed JSON gracefully', () => {
      expect(parser.parseValue('[invalid json')).toBe('[invalid json');
      expect(parser.parseValue('{malformed')).toBe('{malformed');
    });
  });

  describe('parseFrontmatter', () => {
    it('should parse valid frontmatter', () => {
      const content = `---
route: /test
title: Test Page
keywords: ["test", "page"]
status: 200
---
This is the content`;

      const result = parser.parseFrontmatter(content, 'test.mtm');

      expect(result.frontmatter.route).toBe('/test');
      expect(result.frontmatter.title).toBe('Test Page');
      expect(result.frontmatter.keywords).toEqual(['test', 'page']);
      expect(result.frontmatter.status).toBe(200);
      expect(result.content).toBe('This is the content');
      expect(result.errors).toHaveLength(0);
    });

    it('should handle content without frontmatter', () => {
      const content = 'Just plain content';
      const result = parser.parseFrontmatter(content, 'test.mtm');

      expect(result.frontmatter).toEqual({});
      expect(result.content).toBe('Just plain content');
      expect(result.errors).toHaveLength(0);
    });

    it('should handle malformed frontmatter gracefully', () => {
      const content = `---
route /test
invalid: line
---
Content`;

      const result = parser.parseFrontmatter(content, 'test.mtm');

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].type).toBe('frontmatter_parse_error');
      expect(result.errors[0].file).toBe('test.mtm');
      expect(result.errors[0].suggestion).toContain('YAML syntax');
    });

    it('should fallback to simple parsing when YAML fails', () => {
      const content = `---
route: /test
title: Test Page
---
Content`;

      // Mock parseYAMLStyle to throw error
      const originalParseYAML = parser.parseYAMLStyle;
      parser.parseYAMLStyle = () => { throw new Error('YAML parse error'); };

      const result = parser.parseFrontmatter(content, 'test.mtm');

      expect(result.frontmatter.route).toBe('/test');
      expect(result.frontmatter.title).toBe('Test Page');
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].type).toBe('frontmatter_parse_error');

      // Restore original method
      parser.parseYAMLStyle = originalParseYAML;
    });

    it('should handle empty frontmatter', () => {
      const content = `---
---
Content only`;

      const result = parser.parseFrontmatter(content, 'test.mtm');

      expect(result.frontmatter).toEqual({});
      expect(result.content).toBe('Content only');
      expect(result.errors).toHaveLength(0);
    });

    it('should handle frontmatter with no content', () => {
      const content = `---
route: /test
title: Test Page
---`;

      const result = parser.parseFrontmatter(content, 'test.mtm');

      expect(result.frontmatter.route).toBe('/test');
      expect(result.frontmatter.title).toBe('Test Page');
      expect(result.content).toBe('');
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('parseSimpleKeyValue', () => {
    it('should parse simple key-value pairs', () => {
      const str = `route: /test
title: Test Page
status: 200`;

      const result = parser.parseSimpleKeyValue(str);

      expect(result.route).toBe('/test');
      expect(result.title).toBe('Test Page');
      expect(result.status).toBe(200);
    });

    it('should skip invalid lines', () => {
      const str = `route: /test
invalid line
title: Test Page`;

      const result = parser.parseSimpleKeyValue(str);

      expect(result.route).toBe('/test');
      expect(result.title).toBe('Test Page');
      expect(Object.keys(result)).toHaveLength(2);
    });

    it('should skip comments and empty lines', () => {
      const str = `# Comment
route: /test

title: Test Page`;

      const result = parser.parseSimpleKeyValue(str);

      expect(result.route).toBe('/test');
      expect(result.title).toBe('Test Page');
      expect(Object.keys(result)).toHaveLength(2);
    });

    it('should handle empty values', () => {
      const str = `route: /test
empty:
title: Test Page`;

      const result = parser.parseSimpleKeyValue(str);

      expect(result.route).toBe('/test');
      expect(result.title).toBe('Test Page');
      expect(Object.keys(result)).toHaveLength(2); // empty key should be skipped
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle complex nested structures', () => {
      const yaml = `route: /test
metadata:
  author: John Doe
  tags: ["web", "development"]
  config:
    enabled: true
    timeout: 5000`;

      // This would be complex to parse with our simple parser
      // but should not crash
      expect(() => parser.parseYAMLStyle(yaml)).not.toThrow();
    });

    it('should handle special characters in values', () => {
      const yaml = `title: "Title with: colon"
description: "Multi-line
description with special chars !@#$%"`;

      const result = parser.parseYAMLStyle(yaml);

      expect(result.title).toBe('Title with: colon');
      expect(result.description).toBe('Multi-line\ndescription with special chars !@#$%');
    });

    it('should handle very long values', () => {
      const longValue = 'a'.repeat(10000);
      const yaml = `longValue: "${longValue}"`;

      const result = parser.parseYAMLStyle(yaml);

      expect(result.longValue).toBe(longValue);
    });

    it('should handle unicode characters', () => {
      const yaml = `title: "测试页面"
description: "Página de prueba"
emoji: "🚀"`;

      const result = parser.parseYAMLStyle(yaml);

      expect(result.title).toBe('测试页面');
      expect(result.description).toBe('Página de prueba');
      expect(result.emoji).toBe('🚀');
    });
  });
});