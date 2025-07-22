/**
 * Tests for the integrated frontmatter processor
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  FrontmatterProcessor,
  FrontmatterProcessingResult,
  processFrontmatter,
  defaultProcessor
} from '../build-tools/frontmatter-processor.js';

describe('FrontmatterProcessor', () => {
  let processor;

  beforeEach(() => {
    processor = new FrontmatterProcessor();
    processor.reset();
  });

  describe('Basic processing', () => {
    it('should process valid frontmatter successfully', () => {
      const content = `---
route: /test
title: Test Page
description: This is a test page for processing
---

# Test Content
This is the body content.`;

      const result = processor.process(content, 'test.mtm');

      expect(result.isValid).toBe(true);
      expect(result.parseErrors).toHaveLength(0);
      expect(result.validationErrors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
      expect(result.frontmatter.route).toBe('/test');
      expect(result.content.trim()).toBe('# Test Content\nThis is the body content.');
    });

    it('should handle parse errors', () => {
      const content = `---
route: /test
title: "Unclosed quote
description: Valid description
---

Content`;

      const result = processor.process(content, 'test.mtm');

      expect(result.isValid).toBe(false);
      expect(result.parseErrors.length).toBeGreaterThan(0);
      expect(result.validationErrors).toHaveLength(0);
      expect(result.frontmatter).toEqual({});
    });

    it('should handle validation errors', () => {
      const content = `---
route: invalid-route-without-slash
title: Test Page
description: This is a test page
---

Content`;

      const result = processor.process(content, 'test.mtm');

      expect(result.isValid).toBe(false);
      expect(result.parseErrors).toHaveLength(0);
      expect(result.validationErrors.length).toBeGreaterThan(0);
      expect(result.validationErrors.some(e => e.field === 'route')).toBe(true);
    });

    it('should handle missing required fields', () => {
      const content = `---
title: Test Page
# Missing route and description
---

Content`;

      const result = processor.process(content, 'test.mtm');

      expect(result.isValid).toBe(false);
      expect(result.validationErrors.some(e => e.field === 'route')).toBe(true);
      expect(result.validationErrors.some(e => e.field === 'description')).toBe(true);
    });

    it('should collect warnings', () => {
      const content = `---
route: /test
title: Test Page
description: This is a test page
draft: true
status: 200
---

Content`;

      const result = processor.process(content, 'test.mtm');

      expect(result.isValid).toBe(true);
      expect(result.hasWarnings).toBe(true);
      expect(result.warnings.some(w => w.message.includes('Draft pages should not have status 200'))).toBe(true);
    });
  });

  describe('Multiple file processing', () => {
    it('should process multiple valid files', () => {
      const files = [
        {
          content: `---
route: /page1
title: Page 1
description: This is page 1
---
Content 1`,
          filePath: 'page1.mtm'
        },
        {
          content: `---
route: /page2
title: Page 2
description: This is page 2
---
Content 2`,
          filePath: 'page2.mtm'
        }
      ];

      const results = processor.processMultiple(files);

      expect(results).toHaveLength(2);
      expect(results[0].result.isValid).toBe(true);
      expect(results[1].result.isValid).toBe(true);
      expect(results[0].result.frontmatter.route).toBe('/page1');
      expect(results[1].result.frontmatter.route).toBe('/page2');
    });

    it('should detect route conflicts across files', () => {
      const files = [
        {
          content: `---
route: /same-route
title: Page 1
description: This is page 1
---
Content 1`,
          filePath: 'page1.mtm'
        },
        {
          content: `---
route: /same-route
title: Page 2
description: This is page 2
---
Content 2`,
          filePath: 'page2.mtm'
        }
      ];

      const results = processor.processMultiple(files);

      expect(results).toHaveLength(2);
      expect(results.some(r => !r.result.isValid)).toBe(true);
      expect(results.some(r =>
        r.result.validationErrors.some(e => e.message.includes('Duplicate route'))
      )).toBe(true);
    });

    it('should handle mixed valid and invalid files', () => {
      const files = [
        {
          content: `---
route: /valid
title: Valid Page
description: This is a valid page
---
Content`,
          filePath: 'valid.mtm'
        },
        {
          content: `---
route: invalid-route-no-slash
title: ""
description: Short
---
Content`,
          filePath: 'invalid.mtm'
        }
      ];

      const results = processor.processMultiple(files);

      expect(results).toHaveLength(2);
      // At least one should be invalid due to validation errors
      expect(results.some(r => !r.result.isValid)).toBe(true);
    });
  });

  describe('Error reporting', () => {
    it('should generate comprehensive error reports', () => {
      const content = `---
route: invalid-route
title: ""
description: Short
---

Content`;

      const result = processor.process(content, 'test.mtm');
      const report = result.getErrorReport('test.mtm');

      expect(report).toContain('Validation Errors in test.mtm:');
      expect(report).toContain('Field: route');
      expect(report).toContain('Field: title');
      expect(report).toContain('Field: description');
      expect(report).toContain('Suggestions:');
    });

    it('should generate parse error reports with line numbers', () => {
      const content = `---
route: /test
title: "Unclosed quote
---

Content`;

      const result = processor.process(content, 'test.mtm');
      const report = result.getErrorReport('test.mtm');

      expect(report).toContain('Parse Errors in test.mtm:');
      expect(report).toContain('Line');
      expect(report).toContain('Suggestions:');
    });

    it('should include warnings in reports', () => {
      const content = `---
route: /test
title: Test Page
description: This is a test page
keywords: []
---

Content`;

      const result = processor.process(content, 'test.mtm');
      const report = result.getErrorReport('test.mtm');

      expect(report).toContain('Warnings in test.mtm:');
      expect(report).toContain('Keywords array is empty');
    });
  });

  describe('Statistics', () => {
    it('should generate processing statistics', () => {
      const files = [
        {
          content: `---
route: /valid
title: Valid Page
description: This is a valid page
---
Content`,
          filePath: 'valid.mtm'
        },
        {
          content: `---
route: invalid-route
title: Invalid Page
description: This is invalid
---
Content`,
          filePath: 'invalid.mtm'
        },
        {
          content: `---
route: /warning
title: Warning Page
description: This page has warnings
keywords: []
---
Content`,
          filePath: 'warning.mtm'
        }
      ];

      const results = processor.processMultiple(files);
      const stats = processor.getStatistics(results);

      expect(stats.totalFiles).toBe(3);
      expect(stats.validFiles).toBe(2); // valid.mtm and warning.mtm are valid
      expect(stats.filesWithErrors).toBe(1); // invalid.mtm has errors
      expect(stats.filesWithWarnings).toBe(1); // warning.mtm has warnings
      expect(stats.commonErrors.has('invalid_pattern')).toBe(true);
      expect(stats.commonWarnings.size).toBeGreaterThan(0);
    });

    it('should categorize error types correctly', () => {
      const files = [
        {
          content: `---
title: Missing Route
description: This page is missing route
---
Content`,
          filePath: 'missing-route.mtm'
        },
        {
          content: `---
route: /test
title: ""
description: Empty title
---
Content`,
          filePath: 'empty-title.mtm'
        }
      ];

      const results = processor.processMultiple(files);
      const stats = processor.getStatistics(results);

      expect(stats.commonErrors.has('missing_required_field')).toBe(true);
      expect(stats.commonErrors.get('missing_required_field')).toBeGreaterThan(0);
    });
  });

  describe('Real-world scenarios', () => {
    it('should process typical MTM project structure', () => {
      const files = [
        {
          content: `---
route: /
title: Homepage
description: Welcome to our MTM application
keywords: [home, welcome, mtm]
layout: default
---
Homepage content`,
          filePath: 'pages/index.mtm'
        },
        {
          content: `---
route: /about
title: About Us
description: Learn more about our company
keywords: [about, company, team]
layout: default
---
About content`,
          filePath: 'pages/about.mtm'
        },
        {
          content: `---
route: /404
title: Page Not Found
description: The requested page could not be found
keywords: [404, error, not found]
layout: error
status: 404
---
404 content`,
          filePath: 'pages/404.mtm'
        }
      ];

      const results = processor.processMultiple(files);

      expect(results).toHaveLength(3);
      expect(results.every(r => r.result.isValid)).toBe(true);

      const stats = processor.getStatistics(results);
      expect(stats.validFiles).toBe(3);
      expect(stats.filesWithErrors).toBe(0);
    });

    it('should handle blog post structure with dynamic routes', () => {
      const files = [
        {
          content: `---
route: /blog
title: Blog
description: Our latest blog posts
keywords: [blog, posts, articles]
---
Blog index`,
          filePath: 'pages/blog/index.mtm'
        },
        {
          content: `---
route: /blog/[slug]
title: Blog Post
description: Individual blog post page
keywords: [blog, post, article]
---
Blog post template`,
          filePath: 'pages/blog/[slug].mtm'
        },
        {
          content: `---
route: /blog/category/[category]
title: Blog Category
description: Posts in a specific category
keywords: [blog, category, posts]
---
Category template`,
          filePath: 'pages/blog/category/[category].mtm'
        }
      ];

      const results = processor.processMultiple(files);

      expect(results).toHaveLength(3);
      expect(results.every(r => r.result.isValid)).toBe(true);

      // Check that dynamic routes are properly handled
      expect(results[1].result.frontmatter.route).toBe('/blog/[slug]');
      expect(results[2].result.frontmatter.route).toBe('/blog/category/[category]');
    });
  });
});

describe('FrontmatterProcessingResult', () => {
  it('should track validity correctly', () => {
    const validResult = new FrontmatterProcessingResult(
      { route: '/test' },
      'content',
      [],
      [],
      []
    );

    const invalidResult = new FrontmatterProcessingResult(
      {},
      'content',
      [new Error('Parse error')],
      [],
      []
    );

    expect(validResult.isValid).toBe(true);
    expect(invalidResult.isValid).toBe(false);
  });

  it('should detect warnings', () => {
    const resultWithWarnings = new FrontmatterProcessingResult(
      { route: '/test' },
      'content',
      [],
      [],
      [new Error('Warning')]
    );

    expect(resultWithWarnings.hasWarnings).toBe(true);
  });

  it('should combine all errors', () => {
    const parseError = new Error('Parse error');
    const validationError = new Error('Validation error');

    const result = new FrontmatterProcessingResult(
      {},
      'content',
      [parseError],
      [validationError],
      []
    );

    expect(result.allErrors).toHaveLength(2);
    expect(result.allErrors).toContain(parseError);
    expect(result.allErrors).toContain(validationError);
  });
});

describe('Convenience functions', () => {
  it('should work with processFrontmatter function', () => {
    const content = `---
route: /test
title: Test Page
description: This is a test page
---

Content`;

    const result = processFrontmatter(content, 'test.mtm');

    expect(result.isValid).toBe(true);
    expect(result.frontmatter.route).toBe('/test');
  });

  it('should accept processing options', () => {
    const content = `---
route: /test
title: Test Page
description: This is a test page
unknownField: value
---

Content`;

    const result = processFrontmatter(content, 'test.mtm', {
      validator: { allowUnknownFields: false }
    });

    expect(result.hasWarnings).toBe(true);
  });
});