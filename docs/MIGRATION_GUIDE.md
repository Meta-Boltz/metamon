# Ultra-Modern MTM Migration Guide

Complete guide for migrating from legacy MTM format to the new ultra-modern format. This guide covers everything from understanding the changes to executing a successful migration.

## 📋 Table of Contents

- [Overview](#overview)
- [What's Changed](#whats-changed)
- [Pre-Migration Checklist](#pre-migration-checklist)
- [Migration Process](#migration-process)
- [Post-Migration Validation](#post-migration-validation)
- [Common Migration Scenarios](#common-migration-scenarios)
- [Troubleshooting](#troubleshooting)
- [Best Practices](#best-practices)

## 🎯 Overview

The Ultra-Modern MTM format introduces significant improvements in:

- **Frontmatter Structure** - More consistent and extensible metadata format
- **Signal System** - Unified reactive state management across frameworks
- **Template Syntax** - Cleaner, more intuitive template expressions
- **Routing System** - Enhanced multi-language and dynamic routing support
- **Build Integration** - Better Vite plugin integration and hot reload

### Migration Benefits

✅ **Improved Developer Experience** - Cleaner syntax and better tooling
✅ **Better Performance** - Optimized signal system and build process
✅ **Enhanced I18n Support** - First-class internationalization
✅ **Framework Consistency** - Unified API across React, Vue, Svelte, and Solid
✅ **Future-Proof** - Designed for long-term maintainability

## 🔄 What's Changed

### 1. Frontmatter Format

#### Field Name Changes

```yaml
# ❌ Legacy Format
---
page_title: My Page
page_description: Page description
meta_keywords: keyword1, keyword2
template: main
http_status: 200
---
# ✅ Modern Format
---
title: My Page
description: Page description
keywords: [keyword1, keyword2]
layout: main
status: 200
---
```

#### Route Definition Evolution

```yaml
# ❌ Legacy: Comma-separated
route: en:/home, fr:/accueil, es:/inicio

# ✅ Modern: Structured object
route:
  en: /home
  fr: /accueil
  es: /inicio
locales: [en, fr, es]
```

### 2. Signal System Overhaul

#### Signal Declaration

```javascript
// ❌ Legacy
$count = createSignal(0)
$message = createSignal('Hello')

// ✅ Modern
$count! = signal('counter', 0)
$message! = signal('message', 'Hello')
```

#### Signal Usage

```javascript
// ❌ Legacy
$count = $count() + 1;
console.log($message());

// ✅ Modern
$count++;
console.log($message);
```

### 3. Event Handling

#### Event Names

```html
<!-- ❌ Legacy -->
<button onClick="{handleClick}">Click</button>
<form onSubmit="{handleSubmit}">
  <input onChange="{handleChange}" />

  <!-- ✅ Modern -->
  <button click="{handleClick}">Click</button>
  <form submit="{handleSubmit}">
    <input change="{handleChange}" />
  </form>
</form>
```

### 4. Lifecycle Methods

```javascript
// ❌ Legacy
$mount = () => {
  console.log("Component mounted");
};

$destroy = () => {
  console.log("Component destroyed");
};

// ✅ Modern
$onMount = () => {
  console.log("Component mounted");
  signal.emit("component-mounted", { component: "MyComponent" });
};

$onDestroy = () => {
  console.log("Component destroyed");
  signal.emit("component-destroyed", { component: "MyComponent" });
};
```

### 5. Template Structure

```html
<!-- ❌ Legacy -->
<div class="page">
  <h1>Content</h1>
  {$loading() ?
  <div>Loading...</div>
  :
  <div>Content</div>
  }
</div>

<!-- ✅ Modern -->
<template>
  <div class="page">
    <h1>Content</h1>
    {#if $loading}
    <div>Loading...</div>
    {:else}
    <div>Content</div>
    {/if}
  </div>
</template>
```

## ✅ Pre-Migration Checklist

### 1. Environment Setup

- [ ] **Backup your project**

  ```bash
  cp -r src/ src-backup/
  git commit -am "Backup before MTM migration"
  ```

- [ ] **Install migration tools**

  ```bash
  npm install @mtm/build-tools
  ```

- [ ] **Update build configuration**

  ```javascript
  // vite.config.js
  import { mtmPlugin } from "@mtm/build-tools";

  export default defineConfig({
    plugins: [
      mtmPlugin({
        enforce: "pre",
        include: ["**/*.mtm"],
        ssr: true,
      }),
    ],
  });
  ```

### 2. Project Analysis

- [ ] **Run compatibility check**

  ```bash
  npx mtm-migrate check src/ --detailed
  ```

- [ ] **Analyze project structure**

  ```bash
  npx mtm-migrate analyze src/ --verbose --export
  ```

- [ ] **Identify high-risk files**
  - Files with complex frontmatter
  - Files with custom signal patterns
  - Files with extensive event handling

### 3. Testing Preparation

- [ ] **Set up test environment**
- [ ] **Document current functionality**
- [ ] **Prepare test cases for critical features**

## 🚀 Migration Process

### Phase 1: Automated Migration

#### Step 1: Dry Run Migration

```bash
# Preview changes without modifying files
npx mtm-migrate migrate src/ --dry-run --verbose
```

Review the output carefully and note any warnings or potential issues.

#### Step 2: Migrate Non-Critical Files First

```bash
# Start with components or less critical pages
npx mtm-migrate migrate src/components/ --verbose
```

#### Step 3: Test Migrated Files

```bash
# Validate migrated files
npx mtm-migrate validate src/components/ --warnings

# Run your test suite
npm test
```

#### Step 4: Migrate Remaining Files

```bash
# Migrate pages and other critical files
npx mtm-migrate migrate src/pages/ --verbose
npx mtm-migrate migrate src/layouts/ --verbose
```

### Phase 2: Manual Review and Fixes

#### Common Manual Fixes

1. **Complex Signal Logic**

   ```javascript
   // May need manual adjustment
   // ❌ Complex legacy pattern
   const [items, setItems] = createSignal([])
   const [filteredItems, setFilteredItems] = createSignal([])

   createEffect(() => {
     setFilteredItems(items().filter(item => item.active))
   })

   // ✅ Modern equivalent
   $items! = signal('items', [])
   $filteredItems = computed(() => $items.filter(item => item.active))
   ```

2. **Custom Event Patterns**

   ```javascript
   // ❌ Legacy custom events
   element.addEventListener("customEvent", handler);

   // ✅ Modern signal-based events
   signal.on("custom-event", handler);
   signal.emit("custom-event", data);
   ```

3. **Complex Route Patterns**
   ```yaml
   # May need manual adjustment for complex patterns
   route:
     en: /users/[id]/profile
     fr: /utilisateurs/[id]/profil
     es: /usuarios/[id]/perfil
   locales: [en, fr, es]
   ```

### Phase 3: Integration Testing

#### Test Checklist

- [ ] **Page Navigation** - All routes work correctly
- [ ] **Signal Reactivity** - State updates propagate properly
- [ ] **Event Handling** - User interactions work as expected
- [ ] **SSR Functionality** - Server-side rendering works
- [ ] **Hot Reload** - Development experience is smooth
- [ ] **Build Process** - Production builds succeed
- [ ] **I18n Features** - Multi-language support works

## ✅ Post-Migration Validation

### 1. Automated Validation

```bash
# Comprehensive validation
npx mtm-migrate validate src/ --strict --warnings

# Performance check
npm run build
npm run test:e2e
```

### 2. Manual Testing

#### Critical Path Testing

- [ ] Homepage loads correctly
- [ ] Navigation between pages works
- [ ] Forms submit properly
- [ ] Dynamic content updates
- [ ] Error pages display correctly

#### Cross-Browser Testing

- [ ] Chrome/Chromium
- [ ] Firefox
- [ ] Safari
- [ ] Edge

#### Performance Testing

- [ ] Page load times
- [ ] Bundle size analysis
- [ ] Memory usage
- [ ] Hot reload speed

### 3. Generate Migration Report

```bash
# Generate comprehensive HTML report
npx mtm-migrate analyze src/ --export
```

Review the report for:

- Migration success rate
- Remaining compatibility issues
- Performance recommendations
- Code quality suggestions

## 📚 Common Migration Scenarios

### Scenario 1: Simple Static Page

**Before:**

```mtm
---
page_title: About Us
page_description: Learn about our company
meta_keywords: about, company, team
template: default
route: /about
---

<div class="about-page">
  <h1>About Us</h1>
  <p>We are a great company!</p>
</div>
```

**After:**

```mtm
---
title: About Us
description: Learn about our company
keywords: [about, company, team]
layout: default
route: /about
---

<template>
  <div class="about-page">
    <h1>About Us</h1>
    <p>We are a great company!</p>
  </div>
</template>
```

**Migration Command:**

```bash
npx mtm-migrate migrate src/pages/about.mtm
```

### Scenario 2: Interactive Component

**Before:**

```mtm
---
page_title: Counter Component
template: component
---

$count = createSignal(0)
$step = createSignal(1)

$increment = () => {
  $count = $count() + $step()
}

$decrement = () => {
  $count = $count() - $step()
}

$reset = () => {
  $count = 0
}

<div class="counter">
  <h2>Count: {$count()}</h2>
  <div class="controls">
    <button onClick={$decrement}>-</button>
    <button onClick={$reset}>Reset</button>
    <button onClick={$increment}>+</button>
  </div>
  <div class="step-control">
    <label>Step:
      <input
        type="number"
        value={$step()}
        onInput={(e) => $step = parseInt(e.target.value)}
      />
    </label>
  </div>
</div>
```

**After:**

```mtm
---
title: Counter Component
description: Interactive counter with configurable step
keywords: [counter, component, interactive]
layout: component
---

$count! = signal('counter', 0)
$step! = signal('step', 1)

$increment = () => {
  $count = $count + $step
  signal.emit('counter-changed', { value: $count, action: 'increment' })
}

$decrement = () => {
  $count = $count - $step
  signal.emit('counter-changed', { value: $count, action: 'decrement' })
}

$reset = () => {
  $count = 0
  signal.emit('counter-changed', { value: $count, action: 'reset' })
}

$updateStep = (newStep) => {
  $step = parseInt(newStep) || 1
  signal.emit('step-changed', { step: $step })
}

<template>
  <div class="counter">
    <h2>Count: {$count}</h2>
    <div class="controls">
      <button click={$decrement}>-</button>
      <button click={$reset}>Reset</button>
      <button click={$increment}>+</button>
    </div>
    <div class="step-control">
      <label>Step:
        <input
          type="number"
          value={$step}
          input={(e) => $updateStep(e.target.value)}
        />
      </label>
    </div>
  </div>
</template>
```

### Scenario 3: Multi-language Page

**Before:**

```mtm
---
page_title: Products
page_description: Browse our products
template: catalog
route: en:/products, fr:/produits, es:/productos
---

$products = createSignal([])
$loading = createSignal(true)

$mount = async () => {
  try {
    const data = await fetch('/api/products').then(r => r.json())
    $products = data
  } finally {
    $loading = false
  }
}

<div class="products-page">
  {$loading() ? (
    <div>Loading products...</div>
  ) : (
    <div class="products-grid">
      {$products().map(product => (
        <div key={product.id} class="product-card">
          <h3>{product.name}</h3>
          <p>{product.description}</p>
          <span class="price">${product.price}</span>
        </div>
      ))}
    </div>
  )}
</div>
```

**After:**

```mtm
---
title: Products
description: Browse our products
keywords: [products, catalog, shop]
layout: catalog
route:
  en: /products
  fr: /produits
  es: /productos
locales: [en, fr, es]
---

$products! = signal('products', [])
$loading! = signal('loading', true)

$onMount = async () => {
  try {
    const data = await fetch('/api/products').then(r => r.json())
    $products = data
    signal.emit('products-loaded', { count: data.length })
  } catch (error) {
    signal.emit('products-error', { error: error.message })
  } finally {
    $loading = false
  }
}

<template>
  <div class="products-page">
    {#if $loading}
      <div>Loading products...</div>
    {:else}
      <div class="products-grid">
        {#each $products as product}
          <div class="product-card" key={product.id}>
            <h3>{product.name}</h3>
            <p>{product.description}</p>
            <span class="price">${product.price}</span>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</template>
```

## 🔧 Troubleshooting

### Common Issues and Solutions

#### 1. YAML Parsing Errors

**Error:** `YAML parsing error: bad indentation`

**Solution:**

```yaml
# ❌ Bad indentation (tabs or inconsistent spaces)
keywords:
	- keyword1
  - keyword2

# ✅ Consistent indentation (2 spaces)
keywords:
  - keyword1
  - keyword2
```

#### 2. Signal Migration Issues

**Error:** `Cannot read property of undefined`

**Cause:** Signal syntax not properly migrated

**Solution:**

```javascript
// ❌ Partially migrated
$count! = signal('counter', 0)
console.log($count()) // Still using old syntax

// ✅ Fully migrated
$count! = signal('counter', 0)
console.log($count) // Modern syntax
```

#### 3. Route Format Problems

**Error:** `Invalid route definition`

**Solution:**

```yaml
# ❌ Malformed route object
route:
  en /home
  fr: /accueil

# ✅ Proper YAML object
route:
  en: /home
  fr: /accueil
```

#### 4. Template Wrapper Issues

**Error:** `Template content not properly wrapped`

**Solution:**

```html
<!-- ❌ Missing template wrapper -->
<div class="page">
  <h1>Content</h1>
</div>

<!-- ✅ Properly wrapped -->
<template>
  <div class="page">
    <h1>Content</h1>
  </div>
</template>
```

#### 5. Event Handler Migration

**Error:** `Event handler not working`

**Solution:**

```html
<!-- ❌ Legacy event name -->
<button onClick="{handleClick}">Click</button>

<!-- ✅ Modern event name -->
<button click="{handleClick}">Click</button>
```

### Debug Strategies

#### 1. Use Verbose Mode

```bash
npx mtm-migrate migrate src/ --verbose --dry-run
```

#### 2. Migrate Incrementally

```bash
# Migrate one file at a time for complex cases
npx mtm-migrate migrate src/pages/complex-page.mtm --verbose
```

#### 3. Check Compatibility Layer

```javascript
import { BackwardCompatibilityLayer } from "@mtm/build-tools";

const compatibility = new BackwardCompatibilityLayer();
const result = compatibility.process(fileContent, filePath);
console.log("Compatibility issues:", result.warnings);
```

#### 4. Validate After Each Step

```bash
npx mtm-migrate validate src/ --warnings
```

## 💡 Best Practices

### 1. Migration Strategy

#### Recommended Order

1. **Static pages** (no interactivity)
2. **Simple components** (basic signals and events)
3. **Complex components** (multiple signals, computed values)
4. **Layout files** (shared across pages)
5. **Critical pages** (homepage, main navigation)

#### Batch Size

- Migrate 5-10 files at a time
- Test thoroughly after each batch
- Commit changes after successful migration

### 2. Testing Approach

#### Automated Testing

```bash
# Run tests after each migration batch
npm test

# Validate MTM syntax
npx mtm-migrate validate src/ --strict
```

#### Manual Testing

- Test all interactive features
- Verify routing works correctly
- Check responsive design
- Test in multiple browsers

### 3. Code Quality

#### Signal Naming

```javascript
// ✅ Descriptive signal names
$userProfile! = signal('userProfile', null)
$isLoading! = signal('isLoading', false)
$searchResults! = signal('searchResults', [])

// ❌ Generic names
$data! = signal('data', null)
$flag! = signal('flag', false)
$items! = signal('items', [])
```

#### Event Handling

```javascript
// ✅ Emit meaningful events
$updateUser = (userData) => {
  $userProfile = userData;
  signal.emit("user-updated", { user: userData, timestamp: Date.now() });
};

// ❌ No event communication
$updateUser = (userData) => {
  $userProfile = userData;
};
```

#### Error Handling

```javascript
// ✅ Proper error handling
$loadData = async () => {
  try {
    $loading = true;
    const data = await fetchData();
    $data = data;
    signal.emit("data-loaded", { data });
  } catch (error) {
    $error = error.message;
    signal.emit("data-error", { error: error.message });
  } finally {
    $loading = false;
  }
};
```

### 4. Performance Optimization

#### Signal Usage

```javascript
// ✅ Use computed signals for derived state
$filteredItems = computed(() =>
  $items.filter((item) => item.category === $selectedCategory)
);

// ❌ Manual filtering in template
// {$items.filter(item => item.category === $selectedCategory)}
```

#### Event Batching

```javascript
// ✅ Batch related updates
signal.batch(() => {
  $loading = false;
  $data = newData;
  $lastUpdated = Date.now();
});
```

### 5. Documentation

#### Update Comments

```javascript
// ✅ Document signal purpose and usage
/**
 * User authentication state
 * Emits 'auth-changed' when user logs in/out
 */
$currentUser! = signal('currentUser', null)
```

#### Update README

- Document migration changes
- Update setup instructions
- Add troubleshooting section

## 📞 Getting Help

### Resources

- [MTM Documentation](https://github.com/metamon/mtm/docs)
- [Migration Tools API](../packages/build-tools/README.md)
- [Community Discord](https://discord.gg/mtm)

### Support Channels

1. **GitHub Issues** - Bug reports and feature requests
2. **Discord Community** - Real-time help and discussion
3. **Stack Overflow** - Tag questions with `ultra-modern-mtm`

### Professional Support

For enterprise migrations or complex projects, consider:

- Migration consulting services
- Custom migration tool development
- Training and workshops

---

**Happy migrating! 🚀**

The Ultra-Modern MTM format will provide a much better development experience and set your project up for long-term success.
