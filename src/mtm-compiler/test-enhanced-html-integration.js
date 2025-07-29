// Integration test for Enhanced HTML Generator with full compilation
const { EnhancedMTMCompilerWithModes } = require('./enhanced-compiler-with-modes.js');
const fs = require('fs');
const path = require('path');

function runIntegrationTests() {
  console.log('Running Enhanced HTML Generator Integration Tests...\n');

  const compiler = new EnhancedMTMCompilerWithModes();
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
          throw new Error(`Expected content to contain "${expected}"`);
        }
      },
      not: {
        toContain: (expected) => {
          if (actual.includes(expected)) {
            throw new Error(`Expected content not to contain "${expected}"`);
          }
        }
      }
    };
  }

  // Create test MTM files
  const testDir = 'temp-test-enhanced-html';
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }

  // Test 1: Basic routing with Link components
  test('should compile MTM with Link components and routing', () => {
    const mtmContent = `---
route: "/home"
title: "Home Page"
description: "Welcome to our home page"
compileJsMode: "inline"
---

<template>
  <div class="page">
    <h1>Welcome Home</h1>
    <nav class="navigation">
      <Link href="/about">About Us</Link>
      <Link href="/contact" class="btn-primary">Contact</Link>
      <Link href="/services" />
    </nav>
    <p>This is the home page content.</p>
  </div>
</template>`;

    const testFile = path.join(testDir, 'home.mtm');
    fs.writeFileSync(testFile, mtmContent, 'utf8');

    const result = compiler.compile(testFile);

    expect(result.html).toContain('<title>Home Page</title>');
    expect(result.html).toContain('<meta name="route" content="/home">');
    expect(result.html).toContain('<a href="/about" data-link="true">About Us</a>');
    expect(result.html).toContain('<a href="/contact" data-link="true" class="btn-primary">Contact</a>');
    expect(result.html).toContain('<a href="/services" data-link="true"></a>');
    expect(result.html).toContain('class MTMRouter');
    expect(result.html).toContain('window.mtmRouter');
  });

  // Test 2: Framework components integration
  test('should compile MTM with framework components', () => {
    const mtmContent = `---
route: "/components"
title: "Component Demo"
compileJsMode: "external.js"
---

import ReactCounter from "@components/Counter.tsx"
import VueButton from "@components/Button.vue"
import SolidSignal from "@components/solid/Signal.tsx"
import SvelteStore from "@components/Store.svelte"

$count! = signal('count', 0)
$handleClick = () => {
  $count = $count + 1
}

<template>
  <div class="component-demo">
    <h1>Multi-Framework Components</h1>
    
    <ReactCounter initialValue={5} onIncrement={$handleClick} />
    <VueButton label="Vue Button" disabled />
    <SolidSignal value={$count} />
    <SvelteStore data={$count} readonly />
    
    <nav>
      <Link href="/home">Back to Home</Link>
    </nav>
  </div>
</template>`;

    const testFile = path.join(testDir, 'components.mtm');
    fs.writeFileSync(testFile, mtmContent, 'utf8');

    const result = compiler.compile(testFile);

    // Check HTML structure
    expect(result.html).toContain('<title>Component Demo</title>');
    expect(result.html).toContain('<meta name="route" content="/components">');

    // Check React component
    expect(result.html).toContain('data-component="ReactCounter"');
    expect(result.html).toContain('data-framework="react"');
    expect(result.html).toContain('data-prop-initialValue="5"');
    expect(result.html).toContain('data-prop-initialValue-type="literal"');
    expect(result.html).toContain('data-prop-onIncrement="$handleClick"');
    expect(result.html).toContain('data-prop-onIncrement-type="variable"');

    // Check Vue component
    expect(result.html).toContain('data-component="VueButton"');
    expect(result.html).toContain('data-framework="vue"');
    expect(result.html).toContain('data-prop-label="Vue Button"');
    expect(result.html).toContain('data-prop-label-type="string"');
    expect(result.html).toContain('data-prop-disabled="true"');
    expect(result.html).toContain('data-prop-disabled-type="boolean"');

    // Check Solid component
    expect(result.html).toContain('data-component="SolidSignal"');
    expect(result.html).toContain('data-framework="solid"');
    expect(result.html).toContain('data-prop-value="$count"');
    expect(result.html).toContain('data-prop-value-type="variable"');

    // Check Svelte component
    expect(result.html).toContain('data-component="SvelteStore"');
    expect(result.html).toContain('data-framework="svelte"');
    expect(result.html).toContain('data-prop-data="$count"');
    expect(result.html).toContain('data-prop-data-type="variable"');
    expect(result.html).toContain('data-prop-readonly="true"');
    expect(result.html).toContain('data-prop-readonly-type="boolean"');

    // Check Link component
    expect(result.html).toContain('<a href="/home" data-link="true">Back to Home</a>');

    // Check component system
    expect(result.html).toContain('class MTMComponentSystem');
    expect(result.html).toContain('window.mtmComponentSystem');

    // Check compilation mode
    expect(result.compilationMode).toBe('external.js');
  });

  // Test 3: Meta tags and SEO
  test('should generate proper meta tags and SEO elements', () => {
    const mtmContent = `---
route: "/seo-test"
title: "SEO Test Page"
description: "This page tests SEO features"
keywords: "mtm, seo, meta, tags"
author: "MTM Framework"
ogTitle: "MTM SEO Test"
ogDescription: "Testing Open Graph tags"
ogImage: "/images/og-image.jpg"
---

<template>
  <div class="seo-page">
    <h1>SEO Test Page</h1>
    <p>This page demonstrates SEO capabilities.</p>
  </div>
</template>`;

    const testFile = path.join(testDir, 'seo.mtm');
    fs.writeFileSync(testFile, mtmContent, 'utf8');

    const result = compiler.compile(testFile);

    expect(result.html).toContain('<title>SEO Test Page</title>');
    expect(result.html).toContain('<meta name="description" content="This page tests SEO features">');
    expect(result.html).toContain('<meta name="keywords" content="mtm, seo, meta, tags">');
    expect(result.html).toContain('<meta name="author" content="MTM Framework">');
    expect(result.html).toContain('<meta property="og:title" content="MTM SEO Test">');
    expect(result.html).toContain('<meta property="og:description" content="Testing Open Graph tags">');
    expect(result.html).toContain('<meta property="og:image" content="/images/og-image.jpg">');
  });

  // Test 4: Script tag generation based on compilation mode
  test('should generate correct script tags for inline mode', () => {
    const mtmContent = `---
route: "/inline-test"
title: "Inline Script Test"
compileJsMode: "inline"
---

$message! = signal('message', 'Hello World')

<template>
  <div>
    <h1>{$message}</h1>
  </div>
</template>`;

    const testFile = path.join(testDir, 'inline.mtm');
    fs.writeFileSync(testFile, mtmContent, 'utf8');

    const result = compiler.compile(testFile);

    expect(result.html).toContain('class MTMRouter');
    expect(result.html).toContain('class MTMComponentSystem');
    expect(result.compilationMode).toBe('inline');
  });

  // Test 5: Disable routing and components
  test('should allow disabling router and component system', () => {
    const mtmContent = `---
route: "/minimal"
title: "Minimal Page"
---

<template>
  <div>
    <h1>Minimal Page</h1>
  </div>
</template>`;

    const testFile = path.join(testDir, 'minimal.mtm');
    fs.writeFileSync(testFile, mtmContent, 'utf8');

    const options = {
      enableRouting: false,
      enableComponents: false
    };

    const result = compiler.compile(testFile, options);

    expect(result.html).not.toContain('class MTMRouter');
    expect(result.html).not.toContain('class MTMComponentSystem');
    expect(result.html).toContain('<title>Minimal Page</title>');
  });

  // Test 6: Complex component with content
  test('should handle components with content', () => {
    const mtmContent = `---
route: "/modal-test"
title: "Modal Test"
---

import Modal from "@components/Modal.tsx"

<template>
  <div>
    <Modal title="Confirmation" size="large">
      <p>Are you sure you want to delete this item?</p>
      <div class="buttons">
        <button>Cancel</button>
        <button>Delete</button>
      </div>
    </Modal>
  </div>
</template>`;

    const testFile = path.join(testDir, 'modal.mtm');
    fs.writeFileSync(testFile, mtmContent, 'utf8');

    const result = compiler.compile(testFile);

    expect(result.html).toContain('data-component="Modal"');
    expect(result.html).toContain('data-framework="react"');
    expect(result.html).toContain('data-prop-title="Confirmation"');
    expect(result.html).toContain('data-prop-size="large"');
    expect(result.html).toContain('data-content="');
    expect(result.html).toContain('Are you sure you want to delete');
  });

  // Cleanup
  try {
    fs.rmSync(testDir, { recursive: true, force: true });
  } catch (error) {
    console.log('Warning: Could not clean up test directory');
  }

  // Summary
  console.log(`\n=== Integration Test Results ===`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total: ${passed + failed}`);

  if (failed === 0) {
    console.log('\n🎉 All integration tests passed!');
  } else {
    console.log(`\n❌ ${failed} integration test(s) failed.`);
  }

  return failed === 0;
}

// Run the tests
if (require.main === module) {
  runIntegrationTests();
}

module.exports = { runIntegrationTests };