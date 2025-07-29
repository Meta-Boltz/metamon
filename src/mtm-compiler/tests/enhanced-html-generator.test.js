// Unit tests for Enhanced HTML Generator
const { EnhancedHTMLGenerator } = require('../enhanced-html-generator.js');

describe('EnhancedHTMLGenerator', () => {
  let generator;

  beforeEach(() => {
    generator = new EnhancedHTMLGenerator();
  });

  describe('generateHTML', () => {
    test('should generate basic HTML structure', () => {
      const ast = {
        frontmatter: {
          title: 'Test Page',
          description: 'Test Description',
          route: '/test'
        },
        template: {
          content: '<div>Hello World</div>'
        }
      };

      const jsResult = {
        scriptTag: '<script>console.log("test");</script>'
      };

      const html = generator.generateHTML(ast, jsResult);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<title>Test Page</title>');
      expect(html).toContain('<meta name="description" content="Test Description">');
      expect(html).toContain('<meta name="route" content="/test">');
      expect(html).toContain('<div>Hello World</div>');
      expect(html).toContain('<script>console.log("test");</script>');
    });

    test('should use default values when frontmatter is missing', () => {
      const ast = {
        frontmatter: {},
        template: {
          content: '<div>Content</div>'
        }
      };

      const jsResult = {
        scriptTag: '<script></script>'
      };

      const html = generator.generateHTML(ast, jsResult);

      expect(html).toContain('<title>MTM App</title>');
      expect(html).toContain('<meta name="description" content="Enhanced MTM Application">');
      expect(html).toContain('<meta name="route" content="/">');
    });

    test('should include router and component system scripts by default', () => {
      const ast = {
        frontmatter: {},
        template: { content: '<div>Test</div>' }
      };

      const jsResult = { scriptTag: '<script></script>' };

      const html = generator.generateHTML(ast, jsResult);

      expect(html).toContain('class MTMRouter');
      expect(html).toContain('class MTMComponentSystem');
      expect(html).toContain('window.mtmRouter');
      expect(html).toContain('window.mtmComponentSystem');
    });

    test('should disable router when option is set', () => {
      const ast = {
        frontmatter: {},
        template: { content: '<div>Test</div>' }
      };

      const jsResult = { scriptTag: '<script></script>' };
      const options = { enableRouting: false };

      const html = generator.generateHTML(ast, jsResult, options);

      expect(html).not.toContain('class MTMRouter');
      expect(html).not.toContain('window.mtmRouter');
    });

    test('should disable component system when option is set', () => {
      const ast = {
        frontmatter: {},
        template: { content: '<div>Test</div>' }
      };

      const jsResult = { scriptTag: '<script></script>' };
      const options = { enableComponents: false };

      const html = generator.generateHTML(ast, jsResult, options);

      expect(html).not.toContain('class MTMComponentSystem');
      expect(html).not.toContain('window.mtmComponentSystem');
    });
  });

  describe('processLinkComponents', () => {
    test('should convert self-closing Link components to anchor tags', () => {
      const template = '<Link href="/about" class="nav-link" />';
      const result = generator.processLinkComponents(template);

      expect(result).toBe('<a href="/about" data-link="true" class="nav-link"></a>');
    });

    test('should convert Link components with content to anchor tags', () => {
      const template = '<Link href="/contact" class="btn">Contact Us</Link>';
      const result = generator.processLinkComponents(template);

      expect(result).toBe('<a href="/contact" data-link="true" class="btn">Contact Us</a>');
    });

    test('should handle Link components without additional attributes', () => {
      const template = '<Link href="/home">Home</Link>';
      const result = generator.processLinkComponents(template);

      expect(result).toBe('<a href="/home" data-link="true">Home</a>');
    });

    test('should handle multiple Link components', () => {
      const template = `
        <Link href="/home">Home</Link>
        <Link href="/about" class="nav-link" />
        <Link href="/contact">Contact</Link>
      `;
      const result = generator.processLinkComponents(template);

      expect(result).toContain('<a href="/home" data-link="true">Home</a>');
      expect(result).toContain('<a href="/about" data-link="true" class="nav-link"></a>');
      expect(result).toContain('<a href="/contact" data-link="true">Contact</a>');
    });
  });

  describe('processFrameworkComponents', () => {
    test('should convert React component tags to div elements', () => {
      const template = '<Counter initialValue={0} />';
      const ast = {
        imports: [
          { name: 'Counter', framework: 'react', path: '@components/Counter.tsx' }
        ]
      };

      const result = generator.processFrameworkComponents(template, ast);

      expect(result).toContain('data-component="Counter"');
      expect(result).toContain('data-framework="react"');
      expect(result).toContain('data-type="component"');
      expect(result).toContain('data-prop-initialValue="0"');
      expect(result).toContain('data-prop-initialValue-type="literal"');
    });

    test('should convert Vue component tags to div elements', () => {
      const template = '<VueButton label="Click me" disabled />';
      const ast = {
        imports: [
          { name: 'VueButton', framework: 'vue', path: '@components/VueButton.vue' }
        ]
      };

      const result = generator.processFrameworkComponents(template, ast);

      expect(result).toContain('data-component="VueButton"');
      expect(result).toContain('data-framework="vue"');
      expect(result).toContain('data-prop-label="Click me"');
      expect(result).toContain('data-prop-label-type="string"');
      expect(result).toContain('data-prop-disabled="true"');
      expect(result).toContain('data-prop-disabled-type="boolean"');
    });

    test('should handle component tags with variable props', () => {
      const template = '<UserCard user={$currentUser} onEdit={$handleEdit} />';
      const ast = {
        imports: [
          { name: 'UserCard', framework: 'react', path: '@components/UserCard.tsx' }
        ]
      };

      const result = generator.processFrameworkComponents(template, ast);

      expect(result).toContain('data-prop-user="$currentUser"');
      expect(result).toContain('data-prop-user-type="variable"');
      expect(result).toContain('data-prop-onEdit="$handleEdit"');
      expect(result).toContain('data-prop-onEdit-type="variable"');
    });

    test('should handle component tags with content', () => {
      const template = '<Modal title="Confirm">Are you sure?</Modal>';
      const ast = {
        imports: [
          { name: 'Modal', framework: 'react', path: '@components/Modal.tsx' }
        ]
      };

      const result = generator.processFrameworkComponents(template, ast);

      expect(result).toContain('data-component="Modal"');
      expect(result).toContain('data-content="Are you sure?"');
      expect(result).toContain('data-prop-title="Confirm"');
    });

    test('should handle multiple framework components', () => {
      const template = `
        <ReactCounter value={5} />
        <VueButton label="Vue Button" />
        <SolidSignal initial="test" />
        <SvelteStore data={$store} />
      `;
      const ast = {
        imports: [
          { name: 'ReactCounter', framework: 'react', path: '@components/ReactCounter.tsx' },
          { name: 'VueButton', framework: 'vue', path: '@components/VueButton.vue' },
          { name: 'SolidSignal', framework: 'solid', path: '@components/SolidSignal.tsx' },
          { name: 'SvelteStore', framework: 'svelte', path: '@components/SvelteStore.svelte' }
        ]
      };

      const result = generator.processFrameworkComponents(template, ast);

      expect(result).toContain('data-component="ReactCounter"');
      expect(result).toContain('data-framework="react"');
      expect(result).toContain('data-component="VueButton"');
      expect(result).toContain('data-framework="vue"');
      expect(result).toContain('data-component="SolidSignal"');
      expect(result).toContain('data-framework="solid"');
      expect(result).toContain('data-component="SvelteStore"');
      expect(result).toContain('data-framework="svelte"');
    });
  });

  describe('processComponentAttributes', () => {
    test('should convert string attributes', () => {
      const attrs = 'label="Click me" title="Button title"';
      const result = generator.processComponentAttributes(attrs);

      expect(result).toContain('data-prop-label="Click me"');
      expect(result).toContain('data-prop-label-type="string"');
      expect(result).toContain('data-prop-title="Button title"');
      expect(result).toContain('data-prop-title-type="string"');
    });

    test('should convert variable attributes', () => {
      const attrs = 'user={$currentUser} onClick={$handleClick}';
      const result = generator.processComponentAttributes(attrs);

      expect(result).toContain('data-prop-user="$currentUser"');
      expect(result).toContain('data-prop-user-type="variable"');
      expect(result).toContain('data-prop-onClick="$handleClick"');
      expect(result).toContain('data-prop-onClick-type="variable"');
    });

    test('should convert boolean attributes', () => {
      const attrs = 'disabled checked readonly';
      const result = generator.processComponentAttributes(attrs);

      expect(result).toContain('data-prop-disabled="true"');
      expect(result).toContain('data-prop-disabled-type="boolean"');
      expect(result).toContain('data-prop-checked="true"');
      expect(result).toContain('data-prop-checked-type="boolean"');
      expect(result).toContain('data-prop-readonly="true"');
      expect(result).toContain('data-prop-readonly-type="boolean"');
    });

    test('should handle mixed attribute types', () => {
      const attrs = 'label="Submit" disabled value={$formValue} class="btn-primary"';
      const result = generator.processComponentAttributes(attrs);

      expect(result).toContain('data-prop-label="Submit"');
      expect(result).toContain('data-prop-label-type="string"');
      expect(result).toContain('data-prop-disabled="true"');
      expect(result).toContain('data-prop-disabled-type="boolean"');
      expect(result).toContain('data-prop-value="$formValue"');
      expect(result).toContain('data-prop-value-type="variable"');
      expect(result).toContain('data-prop-class="btn-primary"');
      expect(result).toContain('data-prop-class-type="string"');
    });

    test('should return empty string for empty attributes', () => {
      expect(generator.processComponentAttributes('')).toBe('');
      expect(generator.processComponentAttributes('   ')).toBe('');
      expect(generator.processComponentAttributes(null)).toBe('');
      expect(generator.processComponentAttributes(undefined)).toBe('');
    });
  });

  describe('escapeAttribute', () => {
    test('should escape HTML entities', () => {
      const value = '<div>Hello & "World"</div>';
      const result = generator.escapeAttribute(value);

      expect(result).toBe('&lt;div&gt;Hello &amp; &quot;World&quot;&lt;/div&gt;');
    });

    test('should escape newlines and carriage returns', () => {
      const value = 'Line 1\nLine 2\rLine 3';
      const result = generator.escapeAttribute(value);

      expect(result).toBe('Line 1\\nLine 2\\rLine 3');
    });

    test('should escape single quotes', () => {
      const value = "It's a test";
      const result = generator.escapeAttribute(value);

      expect(result).toBe('It&#39;s a test');
    });
  });

  describe('generateMetaTags', () => {
    test('should generate keywords meta tag', () => {
      const frontmatter = { keywords: 'react, vue, mtm' };
      const result = generator.generateMetaTags(frontmatter);

      expect(result).toContain('<meta name="keywords" content="react, vue, mtm">');
    });

    test('should generate author meta tag', () => {
      const frontmatter = { author: 'John Doe' };
      const result = generator.generateMetaTags(frontmatter);

      expect(result).toContain('<meta name="author" content="John Doe">');
    });

    test('should generate Open Graph meta tags', () => {
      const frontmatter = {
        ogTitle: 'My Page',
        ogDescription: 'Page description',
        ogImage: '/image.jpg'
      };
      const result = generator.generateMetaTags(frontmatter);

      expect(result).toContain('<meta property="og:title" content="My Page">');
      expect(result).toContain('<meta property="og:description" content="Page description">');
      expect(result).toContain('<meta property="og:image" content="/image.jpg">');
    });

    test('should generate multiple meta tags', () => {
      const frontmatter = {
        keywords: 'test, mtm',
        author: 'Jane Doe',
        ogTitle: 'Test Page'
      };
      const result = generator.generateMetaTags(frontmatter);

      expect(result).toContain('<meta name="keywords" content="test, mtm">');
      expect(result).toContain('<meta name="author" content="Jane Doe">');
      expect(result).toContain('<meta property="og:title" content="Test Page">');
    });

    test('should return empty string for empty frontmatter', () => {
      const result = generator.generateMetaTags({});
      expect(result).toBe('');
    });
  });

  describe('generateScriptTags', () => {
    test('should include router script by default', () => {
      const jsResult = { scriptTag: '<script>app();</script>' };
      const result = generator.generateScriptTags(jsResult);

      expect(result).toContain('class MTMRouter');
      expect(result).toContain('window.mtmRouter');
    });

    test('should include component system script by default', () => {
      const jsResult = { scriptTag: '<script>app();</script>' };
      const result = generator.generateScriptTags(jsResult);

      expect(result).toContain('class MTMComponentSystem');
      expect(result).toContain('window.mtmComponentSystem');
    });

    test('should include main application script', () => {
      const jsResult = { scriptTag: '<script>console.log("app");</script>' };
      const result = generator.generateScriptTags(jsResult);

      expect(result).toContain('<script>console.log("app");</script>');
    });

    test('should handle inline script', () => {
      const jsResult = { inlineScript: 'console.log("inline");' };
      const result = generator.generateScriptTags(jsResult);

      expect(result).toContain('<script>\nconsole.log("inline");\n    </script>');
    });

    test('should handle external script file', () => {
      const jsResult = { externalFile: { filename: 'app.js' } };
      const result = generator.generateScriptTags(jsResult);

      expect(result).toContain('<script src="app.js"></script>');
    });

    test('should exclude router when disabled', () => {
      const jsResult = { scriptTag: '<script>app();</script>' };
      const options = { enableRouting: false };
      const result = generator.generateScriptTags(jsResult, options);

      expect(result).not.toContain('class MTMRouter');
      expect(result).not.toContain('window.mtmRouter');
    });

    test('should exclude component system when disabled', () => {
      const jsResult = { scriptTag: '<script>app();</script>' };
      const options = { enableComponents: false };
      const result = generator.generateScriptTags(jsResult, options);

      expect(result).not.toContain('class MTMComponentSystem');
      expect(result).not.toContain('window.mtmComponentSystem');
    });
  });

  describe('component registration', () => {
    test('should register and retrieve component adapters', () => {
      const adapter = { mount: jest.fn(), unmount: jest.fn() };
      generator.registerComponentAdapter('test-framework', adapter);

      const retrieved = generator.getComponentAdapter('test-framework');
      expect(retrieved).toBe(adapter);
    });

    test('should return null for unknown adapter', () => {
      const adapter = generator.getComponentAdapter('unknown-framework');
      expect(adapter).toBeNull();
    });

    test('should register and retrieve components', () => {
      const component = { name: 'TestComponent', framework: 'react' };
      generator.registerComponent('TestComponent', component);

      const retrieved = generator.getComponent('TestComponent');
      expect(retrieved).toBe(component);
    });

    test('should return null for unknown component', () => {
      const component = generator.getComponent('UnknownComponent');
      expect(component).toBeNull();
    });
  });
});

// Mock Jest functions if not available
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

  global.beforeEach = (fn) => {
    // Simple beforeEach implementation
    fn();
  };

  global.expect = (actual) => ({
    toBe: (expected) => {
      if (actual !== expected) {
        throw new Error(`Expected ${actual} to be ${expected}`);
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
    }
  });

  global.jest = {
    fn: () => ({ calls: [] })
  };
}