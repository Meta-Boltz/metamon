import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, unlinkSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { MTMParser } from './mtm-parser.js';

describe('MTMParser', () => {
  let parser: MTMParser;
  const testDir = join(process.cwd(), 'test-files');
  
  beforeEach(() => {
    parser = new MTMParser();
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  describe('parse', () => {
    it('should parse a valid MTM file with minimal frontmatter', () => {
      const filePath = join(testDir, 'test.mtm');
      const content = `---
target: reactjs
---

import React from 'react';

export default function Component() {
  return <div>Hello World</div>;
}`;
      
      writeFileSync(filePath, content);
      
      const result = parser.parse(filePath);
      
      expect(result.frontmatter.target).toBe('reactjs');
      expect(result.content).toBe(`import React from 'react';

export default function Component() {
  return <div>Hello World</div>;
}`);
      expect(result.filePath).toBe(filePath);
    });

    it('should parse a valid MTM file with all frontmatter fields', () => {
      const filePath = join(testDir, 'test.mtm');
      const content = `---
target: vue
channels:
  - event: userLogin
    emit: onUserLogin
  - event: dataUpdate
    emit: onDataUpdate
route: /dashboard
layout: main
---

<template>
  <div>Vue Component</div>
</template>`;
      
      writeFileSync(filePath, content);
      
      const result = parser.parse(filePath);
      
      expect(result.frontmatter.target).toBe('vue');
      expect(result.frontmatter.channels).toHaveLength(2);
      expect(result.frontmatter.channels![0]).toEqual({
        event: 'userLogin',
        emit: 'onUserLogin'
      });
      expect(result.frontmatter.route).toBe('/dashboard');
      expect(result.frontmatter.layout).toBe('main');
    });

    it('should throw error for file without frontmatter delimiter', () => {
      const filePath = join(testDir, 'test.mtm');
      const content = `target: reactjs

export default function Component() {
  return <div>Hello</div>;
}`;
      
      writeFileSync(filePath, content);
      
      expect(() => parser.parse(filePath)).toThrow('MTM file must start with YAML frontmatter delimited by "---"');
    });

    it('should throw error for file without closing frontmatter delimiter', () => {
      const filePath = join(testDir, 'test.mtm');
      const content = `---
target: reactjs

export default function Component() {
  return <div>Hello</div>;
}`;
      
      writeFileSync(filePath, content);
      
      expect(() => parser.parse(filePath)).toThrow('MTM file frontmatter must be closed with "---"');
    });

    it('should throw error for invalid YAML in frontmatter', () => {
      const filePath = join(testDir, 'test.mtm');
      const content = `---
target: reactjs
channels: [
  - event: test
---

export default function Component() {
  return <div>Hello</div>;
}`;
      
      writeFileSync(filePath, content);
      
      expect(() => parser.parse(filePath)).toThrow('Invalid YAML in frontmatter');
    });

    it('should throw error for invalid frontmatter validation', () => {
      const filePath = join(testDir, 'test.mtm');
      const content = `---
target: invalid-framework
---

export default function Component() {
  return <div>Hello</div>;
}`;
      
      writeFileSync(filePath, content);
      
      expect(() => parser.parse(filePath)).toThrow('Invalid frontmatter');
    });

    it('should throw error for non-existent file', () => {
      const filePath = join(testDir, 'non-existent.mtm');
      
      expect(() => parser.parse(filePath)).toThrow('Failed to parse MTM file');
    });
  });

  describe('validate', () => {
    describe('target field validation', () => {
      it('should validate supported targets', () => {
        const validTargets = ['reactjs', 'vue', 'solid', 'svelte'];
        
        validTargets.forEach(target => {
          const result = parser.validate({ target });
          expect(result.isValid).toBe(true);
          expect(result.errors).toHaveLength(0);
        });
      });

      it('should reject missing target', () => {
        const result = parser.validate({});
        
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Missing required field: target');
      });

      it('should reject invalid target', () => {
        const result = parser.validate({ target: 'angular' });
        
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Invalid target \'angular\'. Supported targets: reactjs, vue, solid, svelte');
      });
    });

    describe('channels field validation', () => {
      it('should validate valid channels array', () => {
        const frontmatter = {
          target: 'reactjs',
          channels: [
            { event: 'userLogin', emit: 'onUserLogin' },
            { event: 'data-update', emit: 'onDataUpdate' }
          ]
        };
        
        const result = parser.validate(frontmatter);
        
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should reject non-array channels', () => {
        const frontmatter = {
          target: 'reactjs',
          channels: 'invalid'
        };
        
        const result = parser.validate(frontmatter);
        
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Field "channels" must be an array');
      });

      it('should reject channels with missing event field', () => {
        const frontmatter = {
          target: 'reactjs',
          channels: [{ emit: 'onTest' }]
        };
        
        const result = parser.validate(frontmatter);
        
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Channel at index 0 missing required string field: event');
      });

      it('should reject channels with missing emit field', () => {
        const frontmatter = {
          target: 'reactjs',
          channels: [{ event: 'test' }]
        };
        
        const result = parser.validate(frontmatter);
        
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Channel at index 0 missing required string field: emit');
      });

      it('should reject channels with invalid event name format', () => {
        const frontmatter = {
          target: 'reactjs',
          channels: [{ event: 'test@event', emit: 'onTest' }]
        };
        
        const result = parser.validate(frontmatter);
        
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Channel at index 0: event name \'test@event\' contains invalid characters. Use only letters, numbers, underscores, and dashes');
      });

      it('should reject channels with invalid emit function name', () => {
        const frontmatter = {
          target: 'reactjs',
          channels: [{ event: 'test', emit: '123invalid' }]
        };
        
        const result = parser.validate(frontmatter);
        
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Channel at index 0: emit function name \'123invalid\' is not a valid JavaScript identifier');
      });

      it('should reject non-object channel items', () => {
        const frontmatter = {
          target: 'reactjs',
          channels: ['invalid']
        };
        
        const result = parser.validate(frontmatter);
        
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Channel at index 0 must be an object');
      });
    });

    describe('route field validation', () => {
      it('should validate valid route', () => {
        const frontmatter = {
          target: 'reactjs',
          route: '/dashboard'
        };
        
        const result = parser.validate(frontmatter);
        
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should reject non-string route', () => {
        const frontmatter = {
          target: 'reactjs',
          route: 123
        };
        
        const result = parser.validate(frontmatter);
        
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Field "route" must be a string');
      });

      it('should reject route not starting with /', () => {
        const frontmatter = {
          target: 'reactjs',
          route: 'dashboard'
        };
        
        const result = parser.validate(frontmatter);
        
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Field "route" must start with "/"');
      });
    });

    describe('layout field validation', () => {
      it('should validate valid layout', () => {
        const frontmatter = {
          target: 'reactjs',
          layout: 'main'
        };
        
        const result = parser.validate(frontmatter);
        
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should reject non-string layout', () => {
        const frontmatter = {
          target: 'reactjs',
          layout: 123
        };
        
        const result = parser.validate(frontmatter);
        
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Field "layout" must be a string');
      });

      it('should reject empty layout', () => {
        const frontmatter = {
          target: 'reactjs',
          layout: '   '
        };
        
        const result = parser.validate(frontmatter);
        
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Field "layout" cannot be empty');
      });
    });

    describe('unknown fields handling', () => {
      it('should warn about unknown fields', () => {
        const frontmatter = {
          target: 'reactjs',
          unknownField: 'value',
          anotherUnknown: 123
        };
        
        const result = parser.validate(frontmatter);
        
        expect(result.isValid).toBe(true);
        expect(result.warnings).toContain('Unknown fields in frontmatter: unknownField, anotherUnknown');
      });
    });

    describe('edge cases', () => {
      it('should reject null frontmatter', () => {
        const result = parser.validate(null);
        
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Frontmatter must be a valid YAML object');
      });

      it('should reject non-object frontmatter', () => {
        const result = parser.validate('string');
        
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Frontmatter must be a valid YAML object');
      });

      it('should handle complex valid frontmatter', () => {
        const frontmatter = {
          target: 'solid',
          channels: [
            { event: 'user_login', emit: 'handleUserLogin' },
            { event: 'data-fetch', emit: 'onDataFetch' }
          ],
          route: '/complex/route/path',
          layout: 'dashboard-layout'
        };
        
        const result = parser.validate(frontmatter);
        
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });
  });
});