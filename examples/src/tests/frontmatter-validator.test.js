/**
 * Comprehensive tests for the frontmatter validator
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  FrontmatterValidator,
  FrontmatterValidationError,
  ValidationResult,
  MTM_SCHEMA,
  validateFrontmatter,
  defaultValidator
} from '../build-tools/frontmatter-validator.js';

describe('FrontmatterValidator', () => {
  let validator;

  beforeEach(() => {
    validator = new FrontmatterValidator();
    validator.resetKnownRoutes();
  });

  describe('Basic validation', () => {
    it('should validate valid frontmatter', () => {
      const frontmatter = {
        route: '/test',
        title: 'Test Page',
        description: 'This is a test page for validation'
      };

      const result = validator.validate(frontmatter, 'test.mtm');

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should reject non-object frontmatter', () => {
      const result = validator.validate('not an object', 'test.mtm');

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('must be an object');
    });

    it('should reject null frontmatter', () => {
      const result = validator.validate(null, 'test.mtm');

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('must be an object');
    });
  });

  describe('Required fields validation', () => {
    it('should require route field', () => {
      const frontmatter = {
        title: 'Test Page',
        description: 'This is a test page'
      };

      const result = validator.validate(frontmatter, 'test.mtm');

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'route')).toBe(true);
      expect(result.errors.find(e => e.field === 'route').message).toContain('Required field "route" is missing');
    });

    it('should require title field', () => {
      const frontmatter = {
        route: '/test',
        description: 'This is a test page'
      };

      const result = validator.validate(frontmatter, 'test.mtm');

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'title')).toBe(true);
    });

    it('should require description field', () => {
      const frontmatter = {
        route: '/test',
        title: 'Test Page'
      };

      const result = validator.validate(frontmatter, 'test.mtm');

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'description')).toBe(true);
    });

    it('should reject empty required fields', () => {
      const frontmatter = {
        route: '/test',
        title: '',
        description: '   '
      };

      const result = validator.validate(frontmatter, 'test.mtm');

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.message.includes('cannot be empty'))).toBe(true);
    });
  });

  describe('Type validation', () => {
    it('should validate string fields', () => {
      const frontmatter = {
        route: 123, // Should be string
        title: 'Test Page',
        description: 'This is a test page'
      };

      const result = validator.validate(frontmatter, 'test.mtm');

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'route' && e.message.includes('invalid type'))).toBe(true);
    });

    it('should validate number fields', () => {
      const frontmatter = {
        route: '/test',
        title: 'Test Page',
        description: 'This is a test page',
        status: '404' // Should be number
      };

      const result = validator.validate(frontmatter, 'test.mtm');

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'status' && e.message.includes('invalid type'))).toBe(true);
    });

    it('should validate boolean fields', () => {
      const frontmatter = {
        route: '/test',
        title: 'Test Page',
        description: 'This is a test page',
        draft: 'true' // Should be boolean
      };

      const result = validator.validate(frontmatter, 'test.mtm');

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'draft' && e.message.includes('invalid type'))).toBe(true);
    });

    it('should validate array fields', () => {
      const frontmatter = {
        route: '/test',
        title: 'Test Page',
        description: 'This is a test page',
        keywords: 'keyword1, keyword2' // Should be array
      };

      const result = validator.validate(frontmatter, 'test.mtm');

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'keywords' && e.message.includes('invalid type'))).toBe(true);
    });

    it('should validate object fields', () => {
      const frontmatter = {
        route: '/test',
        title: 'Test Page',
        description: 'This is a test page',
        metadata: 'not an object' // Should be object
      };

      const result = validator.validate(frontmatter, 'test.mtm');

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'metadata' && e.message.includes('invalid type'))).toBe(true);
    });
  });

  describe('Route pattern validation', () => {
    it('should validate correct route patterns', () => {
      const validRoutes = [
        '/',
        '/about',
        '/blog/post',
        '/users/[id]',
        '/blog/[...slug]',
        '/api/v1/users',
        '/my-page',
        '/page_with_underscores'
      ];

      for (const route of validRoutes) {
        const frontmatter = {
          route,
          title: 'Test Page',
          description: 'This is a test page'
        };

        const result = validator.validate(frontmatter, 'test.mtm');
        expect(result.errors.filter(e => e.field === 'route')).toHaveLength(0);
      }
    });

    it('should reject invalid route patterns', () => {
      const invalidRoutes = [
        'no-leading-slash',
        '/spaces in route',
        '/special@chars',
        '/route#with#hash',
        '/route?with=query'
      ];

      for (const route of invalidRoutes) {
        const frontmatter = {
          route,
          title: 'Test Page',
          description: 'This is a test page'
        };

        const result = validator.validate(frontmatter, 'test.mtm');
        expect(result.errors.some(e => e.field === 'route' && e.message.includes('does not match required pattern'))).toBe(true);
      }
    });
  });

  describe('Field constraints validation', () => {
    it('should validate title length constraints', () => {
      const frontmatter = {
        route: '/test',
        title: 'x'.repeat(150), // Too long
        description: 'This is a test page'
      };

      const result = validator.validate(frontmatter, 'test.mtm');

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'title' && e.message.includes('too long'))).toBe(true);
    });

    it('should validate description length constraints', () => {
      const frontmatter = {
        route: '/test',
        title: 'Test Page',
        description: 'Short' // Too short
      };

      const result = validator.validate(frontmatter, 'test.mtm');

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'description' && e.message.includes('too short'))).toBe(true);
    });

    it('should validate status allowed values', () => {
      const frontmatter = {
        route: '/test',
        title: 'Test Page',
        description: 'This is a test page',
        status: 999 // Invalid status
      };

      const result = validator.validate(frontmatter, 'test.mtm');

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'status' && e.message.includes('invalid value'))).toBe(true);
    });

    it('should validate priority range', () => {
      const frontmatter = {
        route: '/test',
        title: 'Test Page',
        description: 'This is a test page',
        priority: 15 // Above max
      };

      const result = validator.validate(frontmatter, 'test.mtm');

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'priority' && e.message.includes('exceeds maximum'))).toBe(true);
    });
  });

  describe('Route uniqueness validation', () => {
    it('should detect duplicate routes', () => {
      const frontmatter1 = {
        route: '/test',
        title: 'Test Page 1',
        description: 'This is test page 1'
      };

      const frontmatter2 = {
        route: '/test', // Duplicate route
        title: 'Test Page 2',
        description: 'This is test page 2'
      };

      validator.validate(frontmatter1, 'test1.mtm');
      const result = validator.validate(frontmatter2, 'test2.mtm');

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.message.includes('Duplicate route'))).toBe(true);
    });

    it('should allow unique routes', () => {
      const frontmatter1 = {
        route: '/test1',
        title: 'Test Page 1',
        description: 'This is test page 1'
      };

      const frontmatter2 = {
        route: '/test2',
        title: 'Test Page 2',
        description: 'This is test page 2'
      };

      const result1 = validator.validate(frontmatter1, 'test1.mtm');
      const result2 = validator.validate(frontmatter2, 'test2.mtm');

      expect(result1.isValid).toBe(true);
      expect(result2.isValid).toBe(true);
    });
  });

  describe('Multiple file validation', () => {
    it('should validate multiple files and detect conflicts', () => {
      const items = [
        {
          frontmatter: {
            route: '/page1',
            title: 'Page 1',
            description: 'This is page 1'
          },
          filePath: 'page1.mtm'
        },
        {
          frontmatter: {
            route: '/page1', // Duplicate route
            title: 'Page 1 Duplicate',
            description: 'This is a duplicate page'
          },
          filePath: 'page1-duplicate.mtm'
        },
        {
          frontmatter: {
            route: '/page2',
            title: 'Page 2',
            description: 'This is page 2'
          },
          filePath: 'page2.mtm'
        }
      ];

      const result = validator.validateMultiple(items);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.message.includes('Duplicate route "/page1"'))).toBe(true);
      expect(result.errors.some(e => e.message.includes('page1.mtm, page1-duplicate.mtm'))).toBe(true);
    });
  });

  describe('Semantic validation', () => {
    it('should warn about draft pages with status 200', () => {
      const frontmatter = {
        route: '/test',
        title: 'Test Page',
        description: 'This is a test page',
        draft: true,
        status: 200
      };

      const result = validator.validate(frontmatter, 'test.mtm');

      expect(result.warnings.some(w => w.message.includes('Draft pages should not have status 200'))).toBe(true);
    });

    it('should warn about 404 pages without 404 in route', () => {
      const frontmatter = {
        route: '/some-page',
        title: 'Not Found',
        description: 'Page not found',
        status: 404
      };

      const result = validator.validate(frontmatter, 'test.mtm');

      expect(result.warnings.some(w => w.message.includes('404 pages should have "404" in their route'))).toBe(true);
    });

    it('should require redirect field for redirect status codes', () => {
      const frontmatter = {
        route: '/old-page',
        title: 'Redirected Page',
        description: 'This page redirects',
        status: 301
        // Missing redirect field
      };

      const result = validator.validate(frontmatter, 'test.mtm');

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.message.includes('Redirect pages must have a redirect field'))).toBe(true);
    });

    it('should warn about empty keywords array', () => {
      const frontmatter = {
        route: '/test',
        title: 'Test Page',
        description: 'This is a test page',
        keywords: []
      };

      const result = validator.validate(frontmatter, 'test.mtm');

      expect(result.warnings.some(w => w.message.includes('Keywords array is empty'))).toBe(true);
    });

    it('should warn about too many keywords', () => {
      const frontmatter = {
        route: '/test',
        title: 'Test Page',
        description: 'This is a test page',
        keywords: Array(15).fill('keyword') // Too many keywords
      };

      const result = validator.validate(frontmatter, 'test.mtm');

      expect(result.warnings.some(w => w.message.includes('Too many keywords'))).toBe(true);
    });
  });

  describe('Unknown fields validation', () => {
    it('should allow unknown fields by default', () => {
      const frontmatter = {
        route: '/test',
        title: 'Test Page',
        description: 'This is a test page',
        unknownField: 'some value'
      };

      const result = validator.validate(frontmatter, 'test.mtm');

      expect(result.isValid).toBe(true);
    });

    it('should warn about unknown fields when allowUnknownFields is false', () => {
      const validator = new FrontmatterValidator(MTM_SCHEMA, { allowUnknownFields: false });

      const frontmatter = {
        route: '/test',
        title: 'Test Page',
        description: 'This is a test page',
        unknownField: 'some value'
      };

      const result = validator.validate(frontmatter, 'test.mtm');

      expect(result.warnings.some(w => w.message.includes('Unknown field "unknownField"'))).toBe(true);
    });

    it('should error on unknown fields in strict mode', () => {
      const validator = new FrontmatterValidator(MTM_SCHEMA, {
        allowUnknownFields: false,
        strictMode: true
      });

      const frontmatter = {
        route: '/test',
        title: 'Test Page',
        description: 'This is a test page',
        unknownField: 'some value'
      };

      const result = validator.validate(frontmatter, 'test.mtm');

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.message.includes('Unknown field "unknownField" is not allowed in strict mode'))).toBe(true);
    });
  });

  describe('Field suggestions', () => {
    it('should provide helpful suggestions for missing required fields', () => {
      const frontmatter = {
        title: 'Test Page',
        description: 'This is a test page'
        // Missing route
      };

      const result = validator.validate(frontmatter, 'test.mtm');

      const routeError = result.errors.find(e => e.field === 'route');
      expect(routeError.suggestions).toContain('Add route field, e.g., route: /example');
    });

    it('should provide type conversion suggestions', () => {
      const frontmatter = {
        route: '/test',
        title: 'Test Page',
        description: 'This is a test page',
        status: '404' // Should be number
      };

      const result = validator.validate(frontmatter, 'test.mtm');

      const statusError = result.errors.find(e => e.field === 'status');
      expect(statusError.suggestions.some(s => s.includes('Remove quotes'))).toBe(true);
    });

    it('should suggest similar field names for typos', () => {
      const validator = new FrontmatterValidator(MTM_SCHEMA, {
        allowUnknownFields: false
      });

      const frontmatter = {
        route: '/test',
        title: 'Test Page',
        description: 'This is a test page',
        titel: 'Typo in field name' // Should be 'title'
      };

      const result = validator.validate(frontmatter, 'test.mtm');

      const typoWarning = result.warnings.find(w => w.field === 'titel');
      expect(typoWarning.suggestions.some(s => s.includes('Did you mean: title'))).toBe(true);
    });
  });

  describe('Real-world examples', () => {
    it('should validate typical homepage frontmatter', () => {
      const frontmatter = {
        route: '/',
        title: 'Ultra-Modern MTM Framework',
        description: 'Server-side rendered pages with reactive components',
        keywords: ['MTM', 'SSR', 'reactive', 'framework'],
        layout: 'default',
        status: 200,
        locales: {
          en: '/',
          es: '/es',
          fr: '/fr'
        },
        metadata: {
          author: 'MTM Team',
          version: '1.0.0',
          lastModified: '2023-12-01'
        }
      };

      const result = validator.validate(frontmatter, 'index.mtm');

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate 404 page frontmatter', () => {
      const frontmatter = {
        route: '/404',
        title: '404 - Page Not Found',
        description: 'The requested page could not be found',
        keywords: [404, 'not found', 'error'],
        layout: 'default',
        status: 404,
        noIndex: true
      };

      const result = validator.validate(frontmatter, '404.mtm');

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate blog post frontmatter', () => {
      const frontmatter = {
        route: '/blog/my-first-post',
        title: 'My First Blog Post',
        description: 'This is my first blog post about MTM framework',
        keywords: ['blog', 'MTM', 'first post'],
        author: 'John Doe',
        category: 'tutorial',
        tags: ['beginner', 'tutorial', 'mtm'],
        published: true,
        lastModified: '2023-12-01'
      };

      const result = validator.validate(frontmatter, 'blog/my-first-post.mtm');

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});

describe('ValidationResult', () => {
  it('should track validity based on errors', () => {
    const result = new ValidationResult();
    expect(result.isValid).toBe(true);

    result.addError(new FrontmatterValidationError('Test error'));
    expect(result.isValid).toBe(false);
  });

  it('should collect errors and warnings', () => {
    const result = new ValidationResult();

    result.addError(new FrontmatterValidationError('Error 1'));
    result.addError(new FrontmatterValidationError('Error 2'));
    result.addWarning(new FrontmatterValidationError('Warning 1'));

    expect(result.errors).toHaveLength(2);
    expect(result.warnings).toHaveLength(1);
    expect(result.isValid).toBe(false);
  });
});

describe('FrontmatterValidationError', () => {
  it('should create error with all properties', () => {
    const error = new FrontmatterValidationError(
      'Test error',
      'testField',
      'testValue',
      ['Suggestion 1', 'Suggestion 2']
    );

    expect(error.message).toBe('Test error');
    expect(error.name).toBe('FrontmatterValidationError');
    expect(error.field).toBe('testField');
    expect(error.value).toBe('testValue');
    expect(error.suggestions).toEqual(['Suggestion 1', 'Suggestion 2']);
  });
});

describe('Convenience functions', () => {
  it('should work with validateFrontmatter function', () => {
    const frontmatter = {
      route: '/test',
      title: 'Test Page',
      description: 'This is a test page'
    };

    const result = validateFrontmatter(frontmatter, 'test.mtm');

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});