#!/usr/bin/env node

// Test script for compilation modes
const fs = require('fs');
const path = require('path');
const { EnhancedMTMCompilerWithModes } = require('./enhanced-compiler-with-modes.js');
const { BuildSystemIntegration } = require('./build-system-integration.js');

// Test MTM files with different compilation modes
const testFiles = {
  'inline-test.mtm': `---
route: "/inline-test"
title: "Inline Mode Test"
description: "Testing inline JavaScript compilation"
compileJsMode: "inline"
---

import Counter from "@components/Counter.tsx"

$count! = signal('count', 0)
$message = "Inline compilation test"

$increment = () => {
  $count = $count + 1
  console.log('Count incremented to:', $count)
}

$reset = () => {
  $count = 0
  console.log('Count reset')
}

<template>
  <div class="inline-test">
    <h1>{title}</h1>
    <p>{description}</p>
    <p>{$message}</p>
    
    <div class="counter-display">
      <button click={$increment}>+</button>
      <span class="counter-value">{$count}</span>
      <button click={$reset}>Reset</button>
    </div>
    
    <Counter count={$count} onIncrement={$increment} />
    
    <nav class="navigation">
      <a href="/external-test">External Test</a>
      <a href="/custom-test">Custom Test</a>
    </nav>
  </div>
</template>`,

  'external-test.mtm': `---
route: "/external-test"
title: "External Mode Test"
description: "Testing external JavaScript compilation"
compileJsMode: "external.js"
---

import VueButton from "@components/VueButton.vue"
import SolidCounter from "@components/SolidCounter.tsx"

$items! = signal('items', ['Item 1', 'Item 2', 'Item 3'])
$newItem = ""

$addItem = () => {
  if ($newItem.trim()) {
    $items = [...$items, $newItem.trim()]
    $newItem = ""
  }
}

$removeItem = (index) => {
  $items = $items.filter((_, i) => i !== index)
}

<template>
  <div class="external-test">
    <h1>{title}</h1>
    <p>{description}</p>
    
    <div class="item-manager">
      <input type="text" value={$newItem} placeholder="Add new item" />
      <button click={$addItem}>Add Item</button>
    </div>
    
    <ul class="item-list">
      {#each $items as item, index}
        <li>
          {item}
          <button click={() => $removeItem(index)}>Remove</button>
        </li>
      {/each}
    </ul>
    
    <VueButton onClick={$addItem} text="Add via Vue" />
    <SolidCounter initialCount={$items.length} />
    
    <nav class="navigation">
      <a href="/inline-test">Inline Test</a>
      <a href="/custom-test">Custom Test</a>
    </nav>
  </div>
</template>`,

  'custom-test.mtm': `---
route: "/custom-test"
title: "Custom Mode Test"
description: "Testing custom JavaScript file compilation"
compileJsMode: "custom-app-bundle.js"
---

import ReactForm from "@components/ReactForm.tsx"
import SvelteWidget from "@components/SvelteWidget.svelte"

$formData! = signal('formData', {
  name: '',
  email: '',
  message: ''
})

$isValid = $formData.name && $formData.email && $formData.message

$submitForm = () => {
  if ($isValid) {
    console.log('Form submitted:', $formData)
    alert('Form submitted successfully!')
    $formData = { name: '', email: '', message: '' }
  } else {
    alert('Please fill in all fields')
  }
}

$updateField = (field, value) => {
  $formData = { ...$formData, [field]: value }
}

<template>
  <div class="custom-test">
    <h1>{title}</h1>
    <p>{description}</p>
    
    <div class="form-container">
      <h2>Contact Form</h2>
      
      <div class="form-group">
        <label>Name:</label>
        <input 
          type="text" 
          value={$formData.name}
          change={(e) => $updateField('name', e.target.value)}
        />
      </div>
      
      <div class="form-group">
        <label>Email:</label>
        <input 
          type="email" 
          value={$formData.email}
          change={(e) => $updateField('email', e.target.value)}
        />
      </div>
      
      <div class="form-group">
        <label>Message:</label>
        <textarea 
          value={$formData.message}
          change={(e) => $updateField('message', e.target.value)}
        ></textarea>
      </div>
      
      <button 
        click={$submitForm}
        class:disabled={!$isValid}
      >
        Submit Form
      </button>
      
      {#if $isValid}
        <p class="success">Form is ready to submit!</p>
      {/if}
    </div>
    
    <ReactForm data={$formData} onSubmit={$submitForm} />
    <SvelteWidget title="Custom Widget" />
    
    <nav class="navigation">
      <a href="/inline-test">Inline Test</a>
      <a href="/external-test">External Test</a>
    </nav>
  </div>
</template>`,

  'default-test.mtm': `---
route: "/default-test"
title: "Default Mode Test"
description: "Testing default compilation mode (no compileJsMode specified)"
---

$greeting = "Hello from default mode!"
$timestamp! = signal('timestamp', new Date().toLocaleString())

$updateTime = () => {
  $timestamp = new Date().toLocaleString()
}

<template>
  <div class="default-test">
    <h1>{title}</h1>
    <p>{description}</p>
    <p>{$greeting}</p>
    <p>Current time: {$timestamp}</p>
    
    <button click={$updateTime}>Update Time</button>
    
    <nav class="navigation">
      <a href="/inline-test">Inline Test</a>
      <a href="/external-test">External Test</a>
      <a href="/custom-test">Custom Test</a>
    </nav>
  </div>
</template>`
};

async function runTests() {
  console.log('🧪 Testing MTM Compilation Modes\n');

  // Create test directory
  const testDir = 'temp-compilation-test';
  const outputDir = path.join(testDir, 'output');

  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }

  // Write test files
  console.log('📝 Creating test files...');
  for (const [filename, content] of Object.entries(testFiles)) {
    const filePath = path.join(testDir, filename);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`  ✓ ${filename}`);
  }

  try {
    // Test individual compilation
    console.log('\n🔧 Testing individual file compilation...');
    const compiler = new EnhancedMTMCompilerWithModes();

    for (const filename of Object.keys(testFiles)) {
      const filePath = path.join(testDir, filename);
      console.log(`\n📄 Compiling ${filename}:`);

      try {
        const result = compiler.compile(filePath);

        console.log(`  ✅ Success`);
        console.log(`  📍 Route: ${result.route}`);
        console.log(`  🔧 Mode: ${result.compilationMode}`);
        console.log(`  📏 JS Size: ${result.javascript.content.length} chars`);

        if (result.javascript.externalFile) {
          console.log(`  📦 External file: ${result.javascript.externalFile.filename}`);
        }

        // Validate the generated content
        if (result.compilationMode === 'inline') {
          if (!result.html.includes('<script>')) {
            console.log(`  ⚠️  Warning: Inline mode should include <script> tag`);
          }
          if (result.javascript.externalFile) {
            console.log(`  ⚠️  Warning: Inline mode should not have external file`);
          }
        } else {
          if (!result.javascript.externalFile) {
            console.log(`  ⚠️  Warning: External mode should have external file`);
          }
          if (result.html.includes('function ')) {
            console.log(`  ⚠️  Warning: External mode should not include JS in HTML`);
          }
        }

      } catch (error) {
        console.log(`  ❌ Error: ${error.message}`);
      }
    }

    // Test build system integration
    console.log('\n🏗️  Testing build system integration...');

    const buildSystem = new BuildSystemIntegration({
      inputDir: testDir,
      outputDir: outputDir,
      development: false
    });

    const buildResult = await buildSystem.build();

    if (buildResult.success) {
      console.log('  ✅ Build completed successfully');
      console.log(`  📊 Stats: ${buildResult.stats.successful} successful, ${buildResult.stats.failed} failed`);
      console.log(`  📝 Inline: ${buildResult.stats.inlineMode}, External: ${buildResult.stats.externalMode}`);

      // Analyze build
      const analysis = buildSystem.analyzeBuild(buildResult);
      console.log('\n📈 Build Analysis:');
      console.log(`  📄 Total pages: ${analysis.totalPages}`);
      console.log(`  📦 External JS files: ${analysis.totalJSFiles}`);
      console.log(`  📏 Average JS size: ${Math.round(analysis.averageJSSize)} chars`);

      if (analysis.recommendations.length > 0) {
        console.log('  💡 Recommendations:');
        analysis.recommendations.forEach(rec => {
          console.log(`    • ${rec}`);
        });
      }

    } else {
      console.log('  ❌ Build failed');
      buildResult.stats.errors.forEach(error => {
        console.log(`    ${error.file}: ${error.error}`);
      });
    }

    // Test production build
    console.log('\n🏭 Testing production build...');

    const prodBuildSystem = new BuildSystemIntegration({
      inputDir: testDir,
      outputDir: path.join(outputDir, 'prod'),
      production: true
    });

    const prodResult = await prodBuildSystem.buildProduction();

    if (prodResult.success) {
      console.log('  ✅ Production build completed');

      // Check if files were created
      const prodOutputDir = path.join(outputDir, 'prod');
      const files = fs.readdirSync(prodOutputDir, { recursive: true });
      console.log(`  📁 Generated ${files.length} files`);

      // Check for manifest and router config
      const manifestPath = path.join(prodOutputDir, 'build-manifest.json');
      const routerConfigPath = path.join(prodOutputDir, 'js', 'mtm-router-config.js');

      if (fs.existsSync(manifestPath)) {
        console.log('  ✅ Build manifest generated');
      }

      if (fs.existsSync(routerConfigPath)) {
        console.log('  ✅ Router configuration generated');
      }
    }

    // Test error handling
    console.log('\n🚨 Testing error handling...');

    const invalidMTM = `---
route: "invalid-route"
compileJsMode: "invalid-mode"
---
<template><div>Invalid</div></template>`;

    const invalidPath = path.join(testDir, 'invalid.mtm');
    fs.writeFileSync(invalidPath, invalidMTM, 'utf8');

    try {
      compiler.compile(invalidPath);
      console.log('  ⚠️  Expected error was not thrown');
    } catch (error) {
      console.log('  ✅ Error handling works:', error.message);
    }

    console.log('\n🎉 All tests completed!');

  } catch (error) {
    console.error('💥 Test failed:', error.message);
    console.error(error.stack);
  } finally {
    // Cleanup
    console.log('\n🧹 Cleaning up test files...');

    const cleanup = (dir) => {
      if (fs.existsSync(dir)) {
        const items = fs.readdirSync(dir);
        for (const item of items) {
          const itemPath = path.join(dir, item);
          const stat = fs.statSync(itemPath);
          if (stat.isDirectory()) {
            cleanup(itemPath);
            fs.rmdirSync(itemPath);
          } else {
            fs.unlinkSync(itemPath);
          }
        }
        fs.rmdirSync(dir);
      }
    };

    cleanup(testDir);
    console.log('  ✅ Cleanup completed');
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { runTests, testFiles };