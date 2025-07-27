// Simple test runner for Enhanced HTML Generator
const { EnhancedHTMLGenerator } = require('./enhanced-html-generator.js');

// Simple test framework
function runTests() {
  console.log('Running Enhanced HTML Generator Tests...\n');

  const generator = new EnhancedHTMLGenerator();
  let passed = 0;
  let failed = 0;

  function test(name, testFn) {
    try {
      testFn();
      console.log(`✓ ${name}`);
      passed++;
    } catch (error) {
      console.log(`✗ ${name}: ${error.message}`);
      failed++;
    }
  }

  function expect(actual) {
    return {
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
    };
  }

  // Test basic HTML generation
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

  // Test Link component processing
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

  // Test framework component processing
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

  // Test attribute processing
  test('should convert string attributes', () => {
    const attrs = 'label="Click me" title="Button title"';
    const result = generator.processComponentAttributes(attrs);

    expect(result).toContain('data-prop-label="Click me"');
    expect(result).toContain('data-prop-label-type="string"');
    expect(result).toContain('data-prop-title="Button title"');
    expect(result).toContain('data-prop-title-type="string"');
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

  // Test meta tag generation
  test('should generate keywords meta tag', () => {
    const frontmatter = { keywords: 'react, vue, mtm' };
    const result = generator.generateMetaTags(frontmatter);

    expect(result).toContain('<meta name="keywords" content="react, vue, mtm">');
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

  // Test script tag generation
  test('should include router and component system scripts by default', () => {
    const jsResult = { scriptTag: '<script></script>' };
    const result = generator.generateScriptTags(jsResult);

    expect(result).toContain('class MTMRouter');
    expect(result).toContain('class MTMComponentSystem');
    expect(result).toContain('window.mtmRouter');
    expect(result).toContain('window.mtmComponentSystem');
  });

  test('should exclude router when disabled', () => {
    const jsResult = { scriptTag: '<script>app();</script>' };
    const options = { enableRouting: false };
    const result = generator.generateScriptTags(jsResult, options);

    expect(result).not.toContain('class MTMRouter');
    expect(result).not.toContain('window.mtmRouter');
  });

  test('should handle external script file', () => {
    const jsResult = { externalFile: { filename: 'app.js' } };
    const result = generator.generateScriptTags(jsResult);

    expect(result).toContain('<script src="app.js"></script>');
  });

  // Test HTML escaping
  test('should escape HTML entities', () => {
    const value = '<div>Hello & "World"</div>';
    const result = generator.escapeAttribute(value);

    expect(result).toBe('&lt;div&gt;Hello &amp; &quot;World&quot;&lt;/div&gt;');
  });

  // Test component registration
  test('should register and retrieve component adapters', () => {
    const adapter = { mount: () => { }, unmount: () => { } };
    generator.registerComponentAdapter('test-framework', adapter);

    const retrieved = generator.getComponentAdapter('test-framework');
    expect(retrieved).toBe(adapter);
  });

  test('should return null for unknown adapter', () => {
    const adapter = generator.getComponentAdapter('unknown-framework');
    expect(adapter).toBe(null);
  });

  // Summary
  console.log(`\n=== Test Results ===`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total: ${passed + failed}`);

  if (failed === 0) {
    console.log('\n🎉 All tests passed!');
  } else {
    console.log(`\n❌ ${failed} test(s) failed.`);
  }

  return failed === 0;
}

// Run the tests
if (require.main === module) {
  runTests();
}

module.exports = { runTests };