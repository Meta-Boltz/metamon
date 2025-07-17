import { describe, it, expect } from 'vitest';
import { MTMValidator } from '../mtm-validator';
import { MTMFile } from '../mtm-parser';

describe('MTMValidator', () => {
  const validator = new MTMValidator();

  describe('validate', () => {
    it('should validate correct frontmatter without errors', () => {
      const mtmFile: MTMFile = {
        frontmatter: {
          target: 'reactjs',
          channels: [
            { event: 'userLogin', emit: 'onUserLogin' }
          ],
          route: '/dashboard'
        },
        content: 'import React from "react"; export default function Component() { return <div />; }',
        filePath: 'test.mtm'
      };

      const errors = validator.validate(mtmFile);
      expect(errors).toHaveLength(0);
    });

    it('should report error for unsupported target framework', () => {
      const mtmFile: MTMFile = {
        frontmatter: {
          target: 'angular' as any
        },
        content: '',
        filePath: 'test.mtm'
      };

      const errors = validator.validate(mtmFile);
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('Unsupported target framework: angular');
      expect(errors[0].suggestions).toBeDefined();
    });

    it('should report error for invalid channels format', () => {
      const mtmFile: MTMFile = {
        frontmatter: {
          target: 'reactjs',
          channels: 'invalid' as any
        },
        content: 'import React from "react"; export default function Component() { return <div />; }',
        filePath: 'test.mtm'
      };

      const errors = validator.validate(mtmFile);
      expect(errors.some(e => e.message === 'Channels must be an array')).toBe(true);
    });

    it('should report error for missing channel fields', () => {
      const mtmFile: MTMFile = {
        frontmatter: {
          target: 'reactjs',
          channels: [
            { event: 'test' } as any
          ]
        },
        content: 'import React from "react"; export default function Component() { return <div />; }',
        filePath: 'test.mtm'
      };

      const errors = validator.validate(mtmFile);
      expect(errors.some(e => e.message.includes('missing required field: emit'))).toBe(true);
    });

    it('should report error for invalid event name format', () => {
      const mtmFile: MTMFile = {
        frontmatter: {
          target: 'reactjs',
          channels: [
            { event: '123invalid', emit: 'onEvent' }
          ]
        },
        content: 'import React from "react"; export default function Component() { return <div />; }',
        filePath: 'test.mtm'
      };

      const errors = validator.validate(mtmFile);
      expect(errors.some(e => e.message.includes('event name "123invalid" is invalid'))).toBe(true);
    });

    it('should report error for invalid route format', () => {
      const mtmFile: MTMFile = {
        frontmatter: {
          target: 'reactjs',
          route: 'invalid-route'
        },
        content: 'import React from "react"; export default function Component() { return <div />; }',
        filePath: 'test.mtm'
      };

      const errors = validator.validate(mtmFile);
      expect(errors.some(e => e.message === 'Route must start with "/"')).toBe(true);
    });

    it('should validate React content and suggest imports', () => {
      const mtmFile: MTMFile = {
        frontmatter: {
          target: 'reactjs'
        },
        content: 'function Component() { return <div />; }',
        filePath: 'test.mtm'
      };

      const errors = validator.validate(mtmFile);
      expect(errors.some(e => e.message.includes('React components should import React'))).toBe(true);
      expect(errors.some(e => e.message.includes('should have a default export'))).toBe(true);
    });

    it('should validate Vue content structure', () => {
      const mtmFile: MTMFile = {
        frontmatter: {
          target: 'vue'
        },
        content: 'const component = {};',
        filePath: 'test.mtm'
      };

      const errors = validator.validate(mtmFile);
      expect(errors.some(e => e.message.includes('Vue components should use either Composition API or Options API'))).toBe(true);
    });

    it('should validate Solid content imports', () => {
      const mtmFile: MTMFile = {
        frontmatter: {
          target: 'solid'
        },
        content: 'function Component() { return <div />; }',
        filePath: 'test.mtm'
      };

      const errors = validator.validate(mtmFile);
      expect(errors.some(e => e.message.includes('Solid components should import from solid-js'))).toBe(true);
    });

    it('should validate Svelte content structure', () => {
      const mtmFile: MTMFile = {
        frontmatter: {
          target: 'svelte'
        },
        content: 'export default function Component() { return ""; }',
        filePath: 'test.mtm'
      };

      const errors = validator.validate(mtmFile);
      expect(errors.some(e => e.message.includes('Svelte components should not use export default'))).toBe(true);
    });
  });
});