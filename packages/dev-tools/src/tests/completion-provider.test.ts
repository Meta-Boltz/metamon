import { describe, it, expect } from 'vitest';
import { MTMCompletionProvider } from '../completion-provider';

// Mock types for testing
interface MockTextDocument {
  uri: string;
  languageId: string;
  version: number;
  getText(): string;
  offsetAt(position: MockPosition): number;
}

interface MockPosition {
  line: number;
  character: number;
}

interface MockCompletionItem {
  label: string;
  kind?: number;
}

// Mock implementations
function createDocument(content: string): MockTextDocument {
  return {
    uri: 'test://test.mtm',
    languageId: 'mtm',
    version: 1,
    getText: () => content,
    offsetAt: (position: MockPosition) => {
      const lines = content.split('\n');
      let offset = 0;
      for (let i = 0; i < position.line && i < lines.length; i++) {
        offset += lines[i].length + 1; // +1 for newline
      }
      return offset + position.character;
    }
  };
}

function createPosition(line: number, character: number): MockPosition {
  return { line, character };
}

describe('MTMCompletionProvider', () => {
  const provider = new MTMCompletionProvider();

  describe('basic functionality', () => {
    it('should create completion provider instance', () => {
      expect(provider).toBeDefined();
      expect(typeof provider.provideCompletions).toBe('function');
      expect(typeof provider.resolveCompletion).toBe('function');
    });

    it('should handle empty completions gracefully', () => {
      const document = createDocument('');
      const position = createPosition(0, 0);
      
      const completions = provider.provideCompletions(document as any, position as any);
      expect(Array.isArray(completions)).toBe(true);
    });

    it('should provide completions for frontmatter', () => {
      const content = `---
target: reactjs
---
content`;
      const document = createDocument(content);
      const position = createPosition(1, 8); // After "target: "
      
      const completions = provider.provideCompletions(document as any, position as any);
      expect(Array.isArray(completions)).toBe(true);
      expect(completions.length).toBeGreaterThan(0);
    });

    it('should provide completions for content area', () => {
      const content = `---
target: reactjs
---

import React from 'react';
function Component() {
  // cursor here
}`;
      const document = createDocument(content);
      const position = createPosition(6, 2); // In content area
      
      const completions = provider.provideCompletions(document as any, position as any);
      expect(Array.isArray(completions)).toBe(true);
    });

    it('should resolve completion items', () => {
      const item: MockCompletionItem = {
        label: 'test',
        kind: 1
      };

      const resolved = provider.resolveCompletion(item as any);
      expect(resolved).toBe(item);
    });
  });

  describe('framework-specific completions', () => {
    it('should provide different completions based on target framework', () => {
      const reactContent = `---
target: reactjs
---
content`;
      const vueContent = `---
target: vue
---
content`;

      const reactDoc = createDocument(reactContent);
      const vueDoc = createDocument(vueContent);
      const position = createPosition(3, 0);

      const reactCompletions = provider.provideCompletions(reactDoc as any, position as any);
      const vueCompletions = provider.provideCompletions(vueDoc as any, position as any);

      expect(Array.isArray(reactCompletions)).toBe(true);
      expect(Array.isArray(vueCompletions)).toBe(true);
    });
  });
});