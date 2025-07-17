import { describe, it, expect } from 'vitest';
import { MTMFileParser } from '../mtm-parser';

describe('MTMFileParser', () => {
  const parser = new MTMFileParser();

  describe('parse', () => {
    it('should parse file with frontmatter and content', () => {
      const content = `---
target: reactjs
channels:
  - event: userLogin
    emit: onUserLogin
route: /dashboard
---

import React from 'react';

export default function Dashboard() {
  return <div>Dashboard</div>;
}`;

      const result = parser.parse(content, 'test.mtm');

      expect(result.frontmatter.target).toBe('reactjs');
      expect(result.frontmatter.channels).toHaveLength(1);
      expect(result.frontmatter.channels![0].event).toBe('userLogin');
      expect(result.frontmatter.channels![0].emit).toBe('onUserLogin');
      expect(result.frontmatter.route).toBe('/dashboard');
      expect(result.content).toContain('import React from \'react\'');
      expect(result.filePath).toBe('test.mtm');
    });

    it('should parse file without frontmatter', () => {
      const content = `import React from 'react';

export default function Component() {
  return <div>Component</div>;
}`;

      const result = parser.parse(content, 'test.mtm');

      expect(result.frontmatter).toEqual({});
      expect(result.content).toBe(content);
      expect(result.frontmatterRange).toBeUndefined();
      expect(result.contentRange).toBeDefined();
    });

    it('should handle empty frontmatter', () => {
      const content = `---
---

import React from 'react';`;

      const result = parser.parse(content, 'test.mtm');

      expect(result.frontmatter).toEqual({});
      expect(result.content).toContain('import React');
    });

    it('should throw error for invalid YAML', () => {
      const content = `---
target: reactjs
invalid: [unclosed array
---

content`;

      expect(() => parser.parse(content, 'test.mtm')).toThrow('Invalid YAML in frontmatter');
    });
  });

  describe('getFrontmatterPosition', () => {
    const content = `---
target: reactjs
channels:
  - event: test
---

import React from 'react';`;

    it('should return true for positions within frontmatter', () => {
      expect(parser.getFrontmatterPosition(content, 1, 0)).toBe(true);
      expect(parser.getFrontmatterPosition(content, 2, 5)).toBe(true);
      expect(parser.getFrontmatterPosition(content, 3, 10)).toBe(true);
    });

    it('should return false for positions outside frontmatter', () => {
      expect(parser.getFrontmatterPosition(content, 0, 0)).toBe(false);
      expect(parser.getFrontmatterPosition(content, 6, 0)).toBe(false);
      expect(parser.getFrontmatterPosition(content, 7, 10)).toBe(false);
    });
  });

  describe('getYamlPath', () => {
    const content = `---
target: reactjs
channels:
  - event: userLogin
    emit: onUserLogin
  - event: dataUpdate
    emit: onDataUpdate
route: /dashboard
---`;

    it('should return correct path for root level keys', () => {
      expect(parser.getYamlPath(content, 1, 0)).toEqual(['target']);
      expect(parser.getYamlPath(content, 7, 0)).toEqual(['route']);
    });

    it('should return correct path for nested keys', () => {
      expect(parser.getYamlPath(content, 3, 4)).toEqual(['channels']);
      expect(parser.getYamlPath(content, 4, 8)).toEqual(['channels']);
    });

    it('should return empty array for positions outside frontmatter', () => {
      expect(parser.getYamlPath(content, 0, 0)).toEqual([]);
      expect(parser.getYamlPath(content, 10, 0)).toEqual([]);
    });
  });
});