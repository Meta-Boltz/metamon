// Unit tests for Enhanced MTM Compiler with Modes
const fs = require('fs');
const path = require('path');
const { EnhancedMTMCompilerWithModes } = require('../enhanced-compiler-with-modes.js');

// Mock fs for testing
const mockFS = {
  files: new Map(),
  readFileSync: (filePath, encoding) => {
    if (mockFS.files.has(filePath)) {
      return mockFS.files.get(filePath);
    }
    throw new Error(`File not found: ${filePath}`);
  },
  writeFileSync: (filePath, content, encoding) => {
    mockFS.files.set(filePath, content);
  },
  existsSync: (filePath) => {
    return mockFS.files.has(filePath) || filePath.includes('js');
  },
  mkdirSync: (dirPath, options) => {
    // Mock directory creation
  }
};

// Replace fs methods for testing
const originalReadFileSync = fs.readFileSync;
const originalWriteFileSync = fs.writeFileSync;
const originalExistsSync = fs.existsSync;
const originalMkdirSync = fs.mkdirSync;

describe('EnhancedMTMCompilerWithModes', () => {
  let compiler;

  beforeEach(() => {
    compiler = new EnhancedMTMCompilerWithModes();
    mockFS.files.clear();

    // Mock fs methods
    fs.readFileSync = mockFS.readFileSync;
    fs.writeFileSync = mockFS.writeFileSync;
    fs.existsSync = mockFS.existsSync;
    fs.mkdirSync = mockFS.mkdirSync;
  });

  afterEach(() => {
    // Restore original fs methods
    fs.readFileSync = originalReadFileSync;
    fs.writeFileSync = originalWriteFileSync;
    fs.existsSync = originalExistsSync;
    fs.mkdirSync = originalMkdirSync;
  });

  describe('Inline compilation mode', () => {
    test('should compile with inline JavaScript mode', () => {
      const mtmSource = `---
route: "/inline-test"
title: "Inline Test"
compileJsMode: "inline"
---

$count! = signal('count', 0)

$increment = () => {
  $count = $count + 1
}

<template>
  <div>
    <h1>Count: {$count}</h1>
    <button click={$increment}>Increment</button>
  </div>
</template>`;

      mockFS.files.set('test.mtm', mtmSource);

      const result = compiler.compile('test.mtm');

      expect(result.compilationMode).toBe('inline');
      expect(result.javascript.mode).toBe('inline');
      expect(result.javascript.externalFile).toBeNull();
      expect(result.html).toContain('<script>');
      expect(result.html).toContain('function TestPage()');
      expect(result.html).toContain('MTMRouter.create');
      expect(result.route).toBe('/inline-test');
    });

    test('should handle inline mode with imports', () => {
      const mtmSource = `---
route: "/inline-with-imports"
compileJsMode: "inline"
---

import Counter from "@components/Counter.tsx"
import VueButton from "@components/VueButton.vue"

$message = "Hello World"

<template>
  <div>
    <p>{$message}</p>
    <Counter />
    <VueButton />
  </div>
</template>`;

      mockFS.files.set('with-imports.mtm', mtmSource);

      const result = compiler.compile('with-imports.mtm');

      expect(result.compilationMode).toBe('inline');
      expect(result.html).toContain('data-component="Counter"');
      expect(result.html).toContain('data-component="VueButton"');
      expect(result.html).toContain('data-type="react"');
      expect(result.html).toContain('data-type="vue"');
      expect(result.javascript.content).toContain('MTMComponents.register(\'Counter\', \'react\'');
      expect(result.javascript.content).toContain('MTMComponents.register(\'VueButton\', \'vue\'');
    });
  });

  describe('External compilation mode', () => {
    test('should compile with external.js mode', () => {
      const mtmSource = `---
route: "/external-test"
title: "External Test"
compileJsMode: "external.js"
---

$count! = signal('count', 0)

$increment = () => {
  $count = $count + 1
}

<template>
  <div>
    <h1>Count: {$count}</h1>
    <button click={$increment}>Increment</button>
  </div>
</template>`;

      mockFS.files.set('external.mtm', mtmSource);

      const result = compiler.compile('external.mtm');

      expect(result.compilationMode).toBe('external.js');
      expect(result.javascript.mode).toBe('external');
      expect(result.javascript.externalFile).toBeDefined();
      expect(result.javascript.externalFile.filename).toBe('js/external.js');
      expect(result.html).toContain('<script src="js/external.js"></script>');
      expect(result.html).not.toContain('function ExternalPage()');
      expect(result.javascript.content).toContain('function ExternalPage()');
    });

    test('should compile with custom external filename', () => {
      const mtmSource = `---
route: "/custom-external"
compileJsMode: "custom-app.js"
---

$message = "Custom external"

<template>
  <div>{$message}</div>
</template>`;

      mockFS.files.set('custom.mtm', mtmSource);

      const result = compiler.compile('custom.mtm');

      expect(result.compilationMode).toBe('custom-app.js');
      expect(result.javascript.externalFile.filename).toBe('custom-app.js');
      expect(result.html).toContain('<script src="custom-app.js"></script>');
    });
  });

  describe('Default compilation mode', () => {
    test('should use inline as default mode', () => {
      const mtmSource = `---
route: "/default-test"
title: "Default Test"
---

$message = "Default mode"

<template>
  <div>{$message}</div>
</template>`;

      mockFS.files.set('default.mtm', mtmSource);

      const result = compiler.compile('default.mtm');

      expect(result.compilationMode).toBe('inline');
      expect(result.javascript.mode).toBe('inline');
    });

    test('should use inline for development', () => {
      const mtmSource = `---
route: "/dev-test"
---

$message = "Development mode"

<template>
  <div>{$message}</div>
</template>`;

      mockFS.files.set('dev.mtm', mtmSource);

      const result = compiler.compile('dev.mtm', { development: true });

      expect(result.compilationMode).toBe('inline');
    });

    test('should use external.js for production', () => {
      const mtmSource = `---
route: "/prod-test"
---

$message = "Production mode"

<template>
  <div>{$message}</div>
</template>`;

      mockFS.files.set('prod.mtm', mtmSource);

      const result = compiler.compile('prod.mtm', { production: true });

      expect(result.compilationMode).toBe('external.js');
      expect(result.javascript.externalFile).toBeDefined();
    });
  });

  describe('Error handling', () => {
    test('should throw error for invalid compilation mode', () => {
      const mtmSource = `---
route: "/invalid-mode"
compileJsMode: "invalid-mode"
---

$message = "Invalid"

<template>
  <div>{$message}</div>
</template>`;

      mockFS.files.set('invalid.mtm', mtmSource);

      expect(() => {
        compiler.compile('invalid.mtm');
      }).toThrow('Invalid compileJsMode');
    });

    test('should handle file not found error', () => {
      expect(() => {
        compiler.compile('nonexistent.mtm');
      }).toThrow('File not found');
    });

    test('should validate frontmatter and throw errors', () => {
      const mtmSource = `---
route: "invalid-route"
compileJsMode: "inline"
---

<template>
  <div>Invalid route</div>
</template>`;

      mockFS.files.set('invalid-route.mtm', mtmSource);

      expect(() => {
        compiler.compile('invalid-route.mtm');
      }).toThrow('Frontmatter validation failed');
    });
  });

  describe('Multiple file compilation', () => {
    test('should compile multiple files successfully', () => {
      const file1 = `---
route: "/page1"
compileJsMode: "inline"
---
<template><div>Page 1</div></template>`;

      const file2 = `---
route: "/page2"
compileJsMode: "external.js"
---
<template><div>Page 2</div></template>`;

      mockFS.files.set('page1.mtm', file1);
      mockFS.files.set('page2.mtm', file2);

      const results = compiler.compileMultiple(['page1.mtm', 'page2.mtm']);

      expect(results).toHaveLength(2);
      expect(results[0].compilationMode).toBe('inline');
      expect(results[1].compilationMode).toBe('external.js');
      expect(results[0].route).toBe('/page1');
      expect(results[1].route).toBe('/page2');
    });

    test('should handle errors in multiple file compilation', () => {
      const validFile = `---
route: "/valid"
---
<template><div>Valid</div></template>`;

      const invalidFile = `---
route: "invalid"
compileJsMode: "bad-mode"
---
<template><div>Invalid</div></template>`;

      mockFS.files.set('valid.mtm', validFile);
      mockFS.files.set('invalid.mtm', invalidFile);

      const results = compiler.compileMultiple(['valid.mtm', 'invalid.mtm']);

      expect(results).toHaveLength(2);
      expect(results[0].route).toBe('/valid');
      expect(results[1].success).toBe(false);
      expect(results[1].error).toContain('Invalid compileJsMode');
    });
  });

  describe('HTML generation', () => {
    test('should generate HTML with proper meta tags', () => {
      const mtmSource = `---
route: "/meta-test"
title: "Meta Test Page"
description: "A page with meta tags"
keywords: "test, meta, tags"
author: "Test Author"
compileJsMode: "inline"
---

<template>
  <div>Meta test content</div>
</template>`;

      mockFS.files.set('meta.mtm', mtmSource);

      const result = compiler.compile('meta.mtm');

      expect(result.html).toContain('<title>Meta Test Page</title>');
      expect(result.html).toContain('<meta name="description" content="A page with meta tags">');
      expect(result.html).toContain('<meta name="keywords" content="test, meta, tags">');
      expect(result.html).toContain('<meta name="author" content="Test Author">');
      expect(result.html).toContain('<meta name="route" content="/meta-test">');
    });

    test('should process template with Link components', () => {
      const mtmSource = `---
route: "/link-test"
compileJsMode: "inline"
---

<template>
  <div>
    <Link href="/home">Home</Link>
    <Link href="/about" class="nav-link">About</Link>
  </div>
</template>`;

      mockFS.files.set('link.mtm', mtmSource);

      const result = compiler.compile('link.mtm');

      expect(result.html).toContain('<a href="/home" data-link="true">Home</a>');
      expect(result.html).toContain('<a href="/about" data-link="true" class="nav-link">About</a>');
    });

    test('should process template with variable interpolation', () => {
      const mtmSource = `---
route: "/var-test"
compileJsMode: "inline"
---

$message = "Hello World"
$count! = signal('count', 42)

<template>
  <div>
    <p>{$message}</p>
    <span>{$count}</span>
  </div>
</template>`;

      mockFS.files.set('var.mtm', mtmSource);

      const result = compiler.compile('var.mtm');

      expect(result.html).toContain('<span data-bind="$message">Loading...</span>');
      expect(result.html).toContain('<span data-bind="$count">Loading...</span>');
    });

    test('should process template with conditional rendering', () => {
      const mtmSource = `---
route: "/conditional-test"
compileJsMode: "inline"
---

$showMessage! = signal('show', true)

<template>
  <div>
    {#if $showMessage}
      <p>Message is visible</p>
    {/if}
  </div>
</template>`;

      mockFS.files.set('conditional.mtm', mtmSource);

      const result = compiler.compile('conditional.mtm');

      expect(result.html).toContain('<div data-if="$showMessage" style="display: none;">');
      expect(result.html).toContain('<p>Message is visible</p>');
    });
  });

  describe('File writing', () => {
    test('should write HTML and external JS files', () => {
      const mtmSource = `---
route: "/write-test"
title: "Write Test"
compileJsMode: "external.js"
---

$message = "Write test"

<template>
  <div>{$message}</div>
</template>`;

      mockFS.files.set('write.mtm', mtmSource);

      const result = compiler.compile('write.mtm');
      compiler.writeResult(result, 'output');

      expect(mockFS.files.has('output/write-test.html')).toBe(true);
      expect(mockFS.files.has('output/js/write.js')).toBe(true);

      const htmlContent = mockFS.files.get('output/write-test.html');
      const jsContent = mockFS.files.get('output/js/write.js');

      expect(htmlContent).toContain('<title>Write Test</title>');
      expect(htmlContent).toContain('<script src="js/write.js"></script>');
      expect(jsContent).toContain('function WritePage()');
    });

    test('should write only HTML for inline mode', () => {
      const mtmSource = `---
route: "/inline-write"
compileJsMode: "inline"
---

<template>
  <div>Inline write test</div>
</template>`;

      mockFS.files.set('inline-write.mtm', mtmSource);

      const result = compiler.compile('inline-write.mtm');
      compiler.writeResult(result, 'output');

      expect(mockFS.files.has('output/inline-write.html')).toBe(true);
      expect(mockFS.files.has('output/js/inline-write.js')).toBe(false);
    });

    test('should generate proper output filenames', () => {
      expect(compiler.getOutputFilename({ route: '/home' }, 'html')).toBe('home.html');
      expect(compiler.getOutputFilename({ route: '/user/profile' }, 'html')).toBe('user-profile.html');
      expect(compiler.getOutputFilename({ route: '/' }, 'html')).toBe('index.html');
      expect(compiler.getOutputFilename({}, 'html')).toBe('index.html');
    });
  });

  describe('Route management', () => {
    test('should register routes during compilation', () => {
      const mtmSource = `---
route: "/route-test"
title: "Route Test"
compileJsMode: "inline"
---

<template>
  <div>Route test</div>
</template>`;

      mockFS.files.set('route.mtm', mtmSource);

      compiler.compile('route.mtm');

      const routes = compiler.getRoutes();
      expect(routes.has('/route-test')).toBe(true);

      const routeInfo = routes.get('/route-test');
      expect(routeInfo.file).toBe('route.mtm');
      expect(routeInfo.metadata.title).toBe('Route Test');
      expect(routeInfo.compilationMode).toBe('inline');
    });

    test('should provide compilation statistics', () => {
      const file1 = `---
route: "/stats1"
---
<template><div>Stats 1</div></template>`;

      const file2 = `---
route: "/stats2"
---
<template><div>Stats 2</div></template>`;

      mockFS.files.set('stats1.mtm', file1);
      mockFS.files.set('stats2.mtm', file2);

      compiler.compile('stats1.mtm');
      compiler.compile('stats2.mtm');

      const stats = compiler.getStats();
      expect(stats.routesCount).toBe(2);
      expect(stats.routes).toContain('/stats1');
      expect(stats.routes).toContain('/stats2');
    });
  });
});

// Mock Jest functions if not in Jest environment
if (typeof describe === 'undefined') {
  global.describe = (name, fn) => {
    console.log(`\n=== ${name} ===`);
    fn();
  };

  global.test = (name, fn) => {
    try {
      fn();
      console.log(`✓ ${name}`);
    } catch (error) {
      console.log(`✗ ${name}: ${error.message}`);
    }
  };

  global.beforeEach = (fn) => fn();
  global.afterEach = (fn) => fn();

  global.expect = (actual) => ({
    toBe: (expected) => {
      if (actual !== expected) {
        throw new Error(`Expected ${expected}, got ${actual}`);
      }
    },
    toEqual: (expected) => {
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
      }
    },
    toContain: (expected) => {
      if (!actual.includes(expected)) {
        throw new Error(`Expected "${actual}" to contain "${expected}"`);
      }
    },
    not: {
      toContain: (expected) => {
        if (actual.includes(expected)) {
          throw new Error(`Expected "${actual}" not to contain "${expected}"`);
        }
      }
    },
    toBeDefined: () => {
      if (actual === undefined) {
        throw new Error('Expected value to be defined');
      }
    },
    toBeNull: () => {
      if (actual !== null) {
        throw new Error(`Expected null, got ${actual}`);
      }
    },
    toHaveLength: (expected) => {
      if (actual.length !== expected) {
        throw new Error(`Expected length ${expected}, got ${actual.length}`);
      }
    },
    toThrow: (expected) => {
      try {
        actual();
        throw new Error('Expected function to throw');
      } catch (error) {
        if (expected && !error.message.includes(expected)) {
          throw new Error(`Expected error to contain "${expected}", got "${error.message}"`);
        }
      }
    }
  });
}

module.exports = { EnhancedMTMCompilerWithModes };