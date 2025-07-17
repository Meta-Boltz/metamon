import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MTMFileParser } from '../mtm-parser';
import { MTMValidator } from '../mtm-validator';
import { MTMCompletionProvider } from '../completion-provider';
import { ErrorReporter } from '../error-reporter';

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

describe('Integration Tests', () => {
  let parser: MTMFileParser;
  let validator: MTMValidator;
  let completionProvider: MTMCompletionProvider;
  let errorReporter: ErrorReporter;

  beforeEach(() => {
    parser = new MTMFileParser();
    validator = new MTMValidator();
    completionProvider = new MTMCompletionProvider();
    errorReporter = new ErrorReporter({ debounceMs: 10 });
  });

  afterEach(() => {
    errorReporter.dispose();
  });

  describe('Complete workflow for React component', () => {
    const reactContent = `---
target: reactjs
channels:
  - event: userLogin
    emit: onUserLogin
route: /dashboard
---

import React, { useState } from 'react';

export default function Dashboard() {
  const [user, setUser] = useState(null);

  const onUserLogin = (userData) => {
    setUser(userData);
  };

  return (
    <div>
      <h1>Dashboard</h1>
      <p>User: {user?.name}</p>
    </div>
  );
}`;

    it('should parse, validate, and provide completions for valid React component', () => {
      // Parse
      const parsed = parser.parse(reactContent, 'dashboard.mtm');
      expect(parsed.frontmatter.target).toBe('reactjs');
      expect(parsed.frontmatter.channels).toHaveLength(1);
      expect(parsed.frontmatter.route).toBe('/dashboard');

      // Validate
      const errors = validator.validate(parsed);
      expect(errors).toHaveLength(0);

      // Provide completions in frontmatter
      const document = createDocument(reactContent);
      const frontmatterPosition = createPosition(1, 8); // After "target: "
      const frontmatterCompletions = completionProvider.provideCompletions(document as any, frontmatterPosition as any);
      expect(Array.isArray(frontmatterCompletions)).toBe(true);

      // Provide completions in content
      const contentPosition = createPosition(12, 10); // In the component body
      const contentCompletions = completionProvider.provideCompletions(document as any, contentPosition as any);
      expect(Array.isArray(contentCompletions)).toBe(true);
    });
  });

  describe('Complete workflow for Vue component', () => {
    const vueContent = `---
target: vue
channels:
  - event: dataUpdate
    emit: onDataUpdate
---

<template>
  <div>
    <h1>Vue Component</h1>
    <p>Data: {{ data }}</p>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const data = ref(null);

const onDataUpdate = (newData) => {
  data.value = newData;
};
</script>`;

    it('should parse, validate, and provide completions for valid Vue component', () => {
      // Parse
      const parsed = parser.parse(vueContent, 'component.mtm');
      expect(parsed.frontmatter.target).toBe('vue');
      expect(parsed.frontmatter.channels).toHaveLength(1);

      // Validate
      const errors = validator.validate(parsed);
      expect(errors).toHaveLength(0);

      // Provide completions
      const document = createDocument(vueContent);
      const position = createPosition(17, 5); // In script setup
      const completions = completionProvider.provideCompletions(document as any, position as any);
      expect(Array.isArray(completions)).toBe(true);
    });
  });

  describe('Error reporting workflow', () => {
    it('should report and clear errors through complete workflow', async () => {
      let lastError: any = null;
      let clearedFile: string | null = null;

      const reporter = new ErrorReporter({
        onError: (report) => { lastError = report; },
        onClear: (file) => { clearedFile = file; },
        debounceMs: 10
      });

      // Report invalid file
      const invalidContent = `---
target: invalid-framework
channels: not-an-array
---
content without imports`;

      reporter.reportFile('test.mtm', invalidContent);
      await new Promise(resolve => setTimeout(resolve, 20));

      expect(lastError).toBeDefined();
      expect(lastError.errors.length).toBeGreaterThan(0);
      expect(lastError.file).toBe('test.mtm');

      // Fix the file
      const validContent = `---
target: reactjs
channels:
  - event: test
    emit: onTest
---

import React from 'react';
export default function Component() {
  return <div>Test</div>;
}`;

      reporter.reportFile('test.mtm', validContent);
      await new Promise(resolve => setTimeout(resolve, 20));

      expect(clearedFile).toBe('test.mtm');

      reporter.dispose();
    });
  });

  describe('Cross-framework validation', () => {
    const frameworks = [
      {
        name: 'reactjs',
        validContent: `import React from 'react';\nexport default function Component() { return <div />; }`,
        invalidContent: `function Component() { return <div />; }` // Missing React import
      },
      {
        name: 'vue',
        validContent: `<template><div /></template>\n<script setup>\n</script>`,
        invalidContent: `const component = {};` // Invalid Vue structure
      },
      {
        name: 'solid',
        validContent: `import { createSignal } from 'solid-js';\nexport default function Component() { return <div />; }`,
        invalidContent: `export default function Component() { return <div />; }` // Missing Solid import
      },
      {
        name: 'svelte',
        validContent: `<script>\nlet value = 0;\n</script>\n<div>{value}</div>`,
        invalidContent: `export default function Component() { return ""; }` // Invalid Svelte structure
      }
    ];

    frameworks.forEach(framework => {
      it(`should validate ${framework.name} components correctly`, () => {
        // Test valid content
        const validMtm = parser.parse(`---\ntarget: ${framework.name}\n---\n\n${framework.validContent}`, 'test.mtm');
        const validErrors = validator.validate(validMtm);
        expect(validErrors.filter(e => e.message.includes('should import') || e.message.includes('should use') || e.message.includes('should not use'))).toHaveLength(0);

        // Test invalid content
        const invalidMtm = parser.parse(`---\ntarget: ${framework.name}\n---\n\n${framework.invalidContent}`, 'test.mtm');
        const invalidErrors = validator.validate(invalidMtm);
        expect(invalidErrors.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Language server simulation', () => {
    it('should simulate complete language server workflow', async () => {
      const content = `---
target: reactjs
channels:
  - event: userAction
    emit: onUserAction
---

import React, { useState } from 'react';

export default function Component() {
  const [state, setState] = useState(null);
  
  const onUserAction = (data) => {
    setState(data);
  };

  return <div>State: {JSON.stringify(state)}</div>;
}`;

      // 1. Parse the file (like language server would on file open)
      const parsed = parser.parse(content, 'component.mtm');
      expect(parsed.frontmatter.target).toBe('reactjs');

      // 2. Validate and get diagnostics
      const errors = validator.validate(parsed);
      expect(errors).toHaveLength(0); // Should be valid

      // 3. Provide completions at various positions
      const document = createDocument(content);
      
      // Completion in frontmatter
      const frontmatterCompletions = completionProvider.provideCompletions(
        document as any, 
        createPosition(1, 8) as any // After "target: "
      );
      expect(Array.isArray(frontmatterCompletions)).toBe(true);

      // Completion in content
      const contentCompletions = completionProvider.provideCompletions(
        document as any,
        createPosition(10, 15) as any // In component body
      );
      expect(Array.isArray(contentCompletions)).toBe(true);

      // 4. Error reporting
      let reportReceived = false;
      const reporter = new ErrorReporter({
        onError: () => { reportReceived = true; },
        debounceMs: 10
      });

      reporter.reportFile('component.mtm', content);
      await new Promise(resolve => setTimeout(resolve, 20));

      // Should not report errors for valid content
      expect(reportReceived).toBe(false);

      reporter.dispose();
    });
  });
});