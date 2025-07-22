/**
 * Comprehensive tests for the frontmatter parser
 */

import { describe, it, expect } from 'vitest';
import {
  FrontmatterParser,
  FrontmatterParseError,
  FrontmatterResult,
  parseFrontmatter,
  defaultParser
} from '../build-tools/frontmatter-parser.js';

describe('FrontmatterParser', () => {
  describe('Basic parsing', () => {
    it('should parse simple frontmatter', () => {
      const content = `---
route: /test
title: Test Page
description: A test page
---

# Test Content
This is the body content.`;

      const result = parseFrontmatter(content);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.frontmatter).toEqual({
        route: '/test',
        title: 'Test Page',
        description: 'A test page'
      });
      expect(result.content.trim()).toBe('# Test Content\nThis is the body content.');
    });

    it('should handle content without frontmatter', () => {
      const content = `# Just Content
No frontmatter here.`;

      const result = parseFrontmatter(content);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.frontmatter).toEqual({});
      expect(result.content).toBe(content);
    });

    it('should handle empty frontmatter', () => {
      const content = `---
---

# Content after empty frontmatter`;

      const result = parseFrontmatter(content);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.frontmatter).toEqual({});
      expect(result.content.trim()).toBe('# Content after empty frontmatter');
    });
  });

  describe('Data type handling', () => {
    it('should parse various data types correctly', () => {
      const content = `---
# String values
title: "Test Page"
route: /test
unquoted: simple string

# Number values
port: 3000
version: 1.5
negative: -42

# Boolean values
published: true
draft: false

# Array values
keywords:
  - test
  - page
  - example
tags: ["tag1", "tag2", "tag3"]

# Object values
metadata:
  author: John Doe
  created: "2023-01-01"
  nested:
    deep: value

# Null value
optional: null
---

Content here`;

      const result = parseFrontmatter(content);

      expect(result.isValid).toBe(true);
      expect(result.frontmatter.title).toBe('Test Page');
      expect(result.frontmatter.route).toBe('/test');
      expect(result.frontmatter.unquoted).toBe('simple string');
      expect(result.frontmatter.port).toBe(3000);
      expect(result.frontmatter.version).toBe(1.5);
      expect(result.frontmatter.negative).toBe(-42);
      expect(result.frontmatter.published).toBe(true);
      expect(result.frontmatter.draft).toBe(false);
      expect(result.frontmatter.keywords).toEqual(['test', 'page', 'example']);
      expect(result.frontmatter.tags).toEqual(['tag1', 'tag2', 'tag3']);
      expect(result.frontmatter.metadata).toEqual({
        author: 'John Doe',
        created: '2023-01-01',
        nested: { deep: 'value' }
      });
      expect(result.frontmatter.optional).toBe(null);
    });

    it('should handle multi-line values', () => {
      const content = `---
description: |
  This is a multi-line
  description that spans
  multiple lines.

folded: >
  This is a folded
  string that will be
  joined with spaces.

literal: |2
    Indented literal
    block with custom
    indentation.
---

Content`;

      const result = parseFrontmatter(content);

      expect(result.isValid).toBe(true);
      expect(result.frontmatter.description).toBe('This is a multi-line\ndescription that spans\nmultiple lines.\n');
      expect(result.frontmatter.folded).toBe('This is a folded string that will be joined with spaces.\n');
      expect(result.frontmatter.literal).toBe('  Indented literal\n  block with custom\n  indentation.\n');
    });

    it('should handle complex nested structures', () => {
      const content = `---
config:
  database:
    host: localhost
    port: 5432
    credentials:
      username: admin
      password: secret
  features:
    - authentication
    - authorization
    - logging
  settings:
    debug: true
    timeout: 30000
    retries: 3
---

Content`;

      const result = parseFrontmatter(content);

      expect(result.isValid).toBe(true);
      expect(result.frontmatter.config.database.host).toBe('localhost');
      expect(result.frontmatter.config.database.port).toBe(5432);
      expect(result.frontmatter.config.database.credentials.username).toBe('admin');
      expect(result.frontmatter.config.features).toEqual(['authentication', 'authorization', 'logging']);
      expect(result.frontmatter.config.settings.debug).toBe(true);
    });
  });

  describe('Error handling', () => {
    it('should handle missing closing delimiter', () => {
      const content = `---
route: /test
title: Test Page
# Missing closing delimiter

Content here`;

      const result = parseFrontmatter(content);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toBeInstanceOf(FrontmatterParseError);
      expect(result.errors[0].message).toContain('no closing delimiter');
      expect(result.errors[0].line).toBe(1);
      expect(result.errors[0].suggestions).toContain('Add closing --- delimiter after frontmatter');
    });

    it('should handle YAML syntax errors', () => {
      const content = `---
route: /test
title: "Unclosed quote
description: Valid description
---

Content`;

      const result = parseFrontmatter(content);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toBeInstanceOf(FrontmatterParseError);
      expect(result.errors[0].message).toContain('YAML parsing error');
      expect(result.errors[0].line).toBe(5); // Line with the error (adjusted for frontmatter offset)
    });

    it('should handle duplicate keys', () => {
      const content = `---
route: /test
title: First Title
title: Second Title
---

Content`;

      const result = parseFrontmatter(content);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('duplicated mapping key');
      expect(result.errors[0].suggestions).toContain('Remove duplicate keys in frontmatter');
    });

    it('should handle bad indentation', () => {
      const content = `---
metadata:
  author: John
    invalid: indentation
---

Content`;

      const result = parseFrontmatter(content);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('bad indentation');
      expect(result.errors[0].suggestions).toContain('Check YAML indentation - use spaces, not tabs');
    });

    it('should handle non-string input', () => {
      const result = parseFrontmatter(null);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe('Content must be a string');
      expect(result.errors[0].suggestions).toContain('Ensure file content is properly read as text');
    });

    it('should handle non-object frontmatter', () => {
      const content = `---
- this
- is
- an
- array
---

Content`;

      const result = parseFrontmatter(content);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('must be a YAML object');
      expect(result.errors[0].suggestions).toContain('Ensure frontmatter contains key-value pairs');
    });
  });

  describe('Parser options', () => {
    it('should respect allowEmptyFrontmatter option', () => {
      const content = `---
---

Content`;

      const parser = new FrontmatterParser({ allowEmptyFrontmatter: false });
      const result = parser.parse(content);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('Frontmatter is required but not found');
    });

    it('should respect maxFrontmatterSize option', () => {
      const longValue = 'x'.repeat(1000);
      const content = `---
longField: "${longValue}"
---

Content`;

      const parser = new FrontmatterParser({ maxFrontmatterSize: 500 });
      const result = parser.parse(content);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('exceeds maximum size limit');
      expect(result.errors[0].suggestions).toContain('Reduce frontmatter content');
    });
  });

  describe('Multiple file parsing', () => {
    it('should parse multiple files', () => {
      const files = [
        {
          path: 'page1.mtm',
          content: `---
route: /page1
title: Page 1
---
Content 1`
        },
        {
          path: 'page2.mtm',
          content: `---
route: /page2
title: Page 2
---
Content 2`
        }
      ];

      const parser = new FrontmatterParser();
      const results = parser.parseMultiple(files);

      expect(results).toHaveLength(2);
      expect(results[0].path).toBe('page1.mtm');
      expect(results[0].result.isValid).toBe(true);
      expect(results[0].result.frontmatter.route).toBe('/page1');
      expect(results[1].path).toBe('page2.mtm');
      expect(results[1].result.isValid).toBe(true);
      expect(results[1].result.frontmatter.route).toBe('/page2');
    });
  });

  describe('Data type validation', () => {
    it('should validate supported data types', () => {
      const frontmatter = {
        string: 'test',
        number: 42,
        boolean: true,
        array: [1, 2, 3],
        object: { key: 'value' },
        nullValue: null
      };

      const parser = new FrontmatterParser();
      const errors = parser.validateDataTypes(frontmatter);

      expect(errors).toHaveLength(0);
    });

    it('should reject unsupported data types', () => {
      const frontmatter = {
        func: () => { },
        symbol: Symbol('test'),
        undefined: undefined
      };

      const parser = new FrontmatterParser();
      const errors = parser.validateDataTypes(frontmatter);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toBeInstanceOf(FrontmatterParseError);
      expect(errors[0].message).toContain('Invalid data type');
    });
  });

  describe('Real-world examples', () => {
    it('should parse typical MTM page frontmatter', () => {
      const content = `---
route: /
title: Ultra-Modern MTM Framework
description: Server-side rendered pages with reactive components
keywords: 
  - MTM
  - SSR
  - reactive
  - framework
layout: default
status: 200
locales:
  en: /
  es: /es
  fr: /fr
metadata:
  author: MTM Team
  version: 1.0.0
  lastModified: 2023-12-01
features:
  ssr: true
  hydration: true
  routing: true
---

// Server-side data fetching
$userCount! = signal('userCount', 0)`;

      const result = parseFrontmatter(content);

      expect(result.isValid).toBe(true);
      expect(result.frontmatter.route).toBe('/');
      expect(result.frontmatter.title).toBe('Ultra-Modern MTM Framework');
      expect(result.frontmatter.keywords).toEqual(['MTM', 'SSR', 'reactive', 'framework']);
      expect(result.frontmatter.locales.en).toBe('/');
      expect(result.frontmatter.metadata.author).toBe('MTM Team');
      expect(result.frontmatter.features.ssr).toBe(true);
      expect(result.content).toContain('$userCount! = signal');
    });

    it('should handle 404 page frontmatter', () => {
      const content = `---
route: /404
title: 404 - Page Not Found
description: The requested page could not be found
keywords: 
  - 404
  - not found
  - error
layout: default
status: 404
noIndex: true
---

// Page state
$searchQuery! = signal('searchQuery', '')`;

      const result = parseFrontmatter(content);

      expect(result.isValid).toBe(true);
      expect(result.frontmatter.status).toBe(404);
      expect(result.frontmatter.noIndex).toBe(true);
      expect(result.frontmatter.keywords).toContain(404);
    });
  });

  describe('Edge cases', () => {
    it('should handle frontmatter with only comments', () => {
      const content = `---
# This is just a comment
# Another comment
---

Content`;

      const result = parseFrontmatter(content);

      expect(result.isValid).toBe(true);
      expect(result.frontmatter).toEqual({});
    });

    it('should handle frontmatter with special characters', () => {
      const content = `---
title: "Page with special chars: @#$%^&*()"
route: "/special-chars"
description: 'Single quotes work too'
unicode: "Unicode: 🚀 ✨ 🎉"
---

Content`;

      const result = parseFrontmatter(content);

      expect(result.isValid).toBe(true);
      expect(result.frontmatter.title).toBe('Page with special chars: @#$%^&*()');
      expect(result.frontmatter.unicode).toBe('Unicode: 🚀 ✨ 🎉');
    });

    it('should handle Windows line endings', () => {
      const content = `---\r\nroute: /test\r\ntitle: Test Page\r\n---\r\n\r\nContent with Windows line endings`;

      const result = parseFrontmatter(content);

      expect(result.isValid).toBe(true);
      expect(result.frontmatter.route).toBe('/test');
      expect(result.frontmatter.title).toBe('Test Page');
    });
  });
});

describe('FrontmatterParseError', () => {
  it('should create error with all properties', () => {
    const error = new FrontmatterParseError(
      'Test error',
      5,
      10,
      ['Suggestion 1', 'Suggestion 2']
    );

    expect(error.message).toBe('Test error');
    expect(error.name).toBe('FrontmatterParseError');
    expect(error.line).toBe(5);
    expect(error.column).toBe(10);
    expect(error.suggestions).toEqual(['Suggestion 1', 'Suggestion 2']);
  });
});

describe('FrontmatterResult', () => {
  it('should indicate validity based on errors', () => {
    const validResult = new FrontmatterResult({ route: '/test' }, 'content', []);
    const invalidResult = new FrontmatterResult({}, '', [new FrontmatterParseError('Error')]);

    expect(validResult.isValid).toBe(true);
    expect(invalidResult.isValid).toBe(false);
  });
});