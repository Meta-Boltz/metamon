# MTM Build Tools & Migration Utilities

Comprehensive migration tools and build utilities for Ultra-Modern MTM projects. This package provides everything you need to migrate existing MTM files to the new ultra-modern format, maintain backward compatibility, and generate detailed migration reports.

## 🚀 Quick Start

### Installation

```bash
npm install @mtm/build-tools
```

### Basic Usage

```bash
# Migrate all MTM files in a directory
npx mtm-migrate migrate src/pages/

# Check compatibility of existing files
npx mtm-migrate check src/

# Analyze project structure
npx mtm-migrate analyze src/ --verbose

# Validate MTM files
npx mtm-migrate validate src/ --warnings
```

## 📋 Table of Contents

- [Migration Guide](#migration-guide)
- [CLI Commands](#cli-commands)
- [API Reference](#api-reference)
- [File Format Changes](#file-format-changes)
- [Backward Compatibility](#backward-compatibility)
- [Troubleshooting](#troubleshooting)
- [Examples](#examples)

## 🔄 Migration Guide

### From Legacy to Modern Format

The Ultra-Modern MTM format introduces several improvements over the legacy format:

#### Frontmatter Changes

**Legacy Format:**

```yaml
---
page_title: My Page
page_description: Page description
meta_keywords: keyword1, keyword2, keyword3
template: main
http_status: 200
route: en:/home, fr:/accueil
---
```

**Modern Format:**

```yaml
---
title: My Page
description: Page description
keywords: [keyword1, keyword2, keyword3]
layout: main
status: 200
route:
  en: /home
  fr: /accueil
locales: [en, fr]
---
```

#### Signal Syntax Changes

**Legacy Format:**

```javascript
$count = createSignal(0);
$message = createSignal("Hello");
```

**Modern Format:**

```javascript
$count! = signal('counter', 0)
$message! = signal('message', 'Hello')
```

#### Event Syntax Changes

**Legacy Format:**

```html
<button onClick="{handleClick}">Click</button>
```

**Modern Format:**

```html
<button click="{handleClick}">Click</button>
```

#### Template Structure

**Legacy Format:**

```html
<div class="page">
  <h1>Content</h1>
</div>
```

**Modern Format:**

```html
<template>
  <div class="page">
    <h1>Content</h1>
  </div>
</template>
```

### Migration Process

1. **Backup Your Files** (recommended)

   ```bash
   cp -r src/ src-backup/
   ```

2. **Run Compatibility Check**

   ```bash
   npx mtm-migrate check src/ --detailed
   ```

3. **Preview Migration Changes**

   ```bash
   npx mtm-migrate migrate src/ --dry-run
   ```

4. **Perform Migration**

   ```bash
   npx mtm-migrate migrate src/
   ```

5. **Validate Results**
   ```bash
   npx mtm-migrate validate src/ --warnings
   ```

## 🖥️ CLI Commands

### `migrate` - Migrate MTM Files

Converts existing MTM files to the new ultra-modern format.

```bash
npx mtm-migrate migrate [options] <paths...>
```

**Options:**

- `--dry-run` - Preview changes without modifying files
- `--no-backup` - Don't create backup files (default: creates .backup files)
- `--no-validation` - Skip validation after migration
- `--no-report` - Don't generate migration report
- `--verbose, -v` - Show detailed output

**Examples:**

```bash
# Migrate all files in pages directory
npx mtm-migrate migrate src/pages/

# Dry run to preview changes
npx mtm-migrate migrate --dry-run src/

# Migrate specific files without backup
npx mtm-migrate migrate --no-backup src/pages/index.mtm src/pages/about.mtm

# Verbose migration with full reporting
npx mtm-migrate migrate --verbose src/
```

### `check` - Compatibility Check

Analyzes existing MTM files for compatibility issues and migration needs.

```bash
npx mtm-migrate check [options] <paths...>
```

**Options:**

- `--detailed, -d` - Show detailed file analysis
- `--verbose, -v` - Show warnings for each file

**Examples:**

```bash
# Basic compatibility check
npx mtm-migrate check src/

# Detailed analysis with warnings
npx mtm-migrate check --detailed --verbose src/
```

### `analyze` - Project Analysis

Provides comprehensive analysis of your MTM project structure.

```bash
npx mtm-migrate analyze [options] <paths...>
```

**Options:**

- `--verbose, -v` - Show detailed analysis
- `--export, -e` - Export analysis to JSON file

**Examples:**

```bash
# Basic project analysis
npx mtm-migrate analyze src/

# Detailed analysis with export
npx mtm-migrate analyze --verbose --export src/
```

### `validate` - File Validation

Validates MTM files for syntax and structure correctness.

```bash
npx mtm-migrate validate [options] <paths...>
```

**Options:**

- `--warnings, -w` - Show compatibility warnings
- `--strict, -s` - Use strict validation mode

**Examples:**

```bash
# Basic validation
npx mtm-migrate validate src/

# Strict validation with warnings
npx mtm-migrate validate --strict --warnings src/
```

## 📚 API Reference

### MTMMigrator

Main migration class for converting MTM files.

```javascript
import { MTMMigrator } from "@mtm/build-tools";

const migrator = new MTMMigrator({
  backupOriginals: true,
  validateAfterMigration: true,
  generateReport: true,
  dryRun: false,
});

// Migrate a single file
const result = await migrator.migrateFile("src/pages/index.mtm");

// Migrate multiple paths
const report = await migrator.migrate(["src/pages/", "src/components/"]);
```

#### Options

- `backupOriginals` (boolean) - Create backup files before migration
- `validateAfterMigration` (boolean) - Validate files after migration
- `generateReport` (boolean) - Generate detailed migration report
- `dryRun` (boolean) - Preview changes without modifying files

#### Methods

##### `migrateFile(filePath: string): Promise<MigrationResult>`

Migrates a single MTM file.

**Returns:**

```javascript
{
  success: boolean,
  filePath: string,
  errors: Array<Error>,
  warnings: Array<Warning>,
  changes: Array<Change>,
  skipped?: boolean,
  reason?: string
}
```

##### `migrate(paths: string[]): Promise<MigrationReport>`

Migrates multiple files or directories.

**Returns:**

```javascript
{
  totalFiles: number,
  migratedFiles: number,
  skippedFiles: number,
  errors: Array<Error>,
  warnings: Array<Warning>,
  changes: Array<Change>
}
```

### BackwardCompatibilityLayer

Provides backward compatibility support for legacy MTM files.

```javascript
import { BackwardCompatibilityLayer } from "@mtm/build-tools";

const compatibility = new BackwardCompatibilityLayer({
  enableLegacySupport: true,
  warnOnDeprecated: true,
  strictMode: false,
});

// Process file with compatibility layer
const result = compatibility.process(content, filePath);

// Check if file needs migration
const needsMigration = compatibility.needsMigration(content);

// Get compatibility summary for multiple files
const summary = await compatibility.getCompatibilitySummary(filePaths);
```

### MigrationReportGenerator

Generates comprehensive migration reports in various formats.

```javascript
import { MigrationReportGenerator } from "@mtm/build-tools";

const generator = new MigrationReportGenerator({
  format: "html", // 'json', 'html', 'markdown'
  includeDetails: true,
  includeRecommendations: true,
});

// Generate report
const reportPath = await generator.generateReport(migrationData, "report.html");
```

### Convenience Functions

```javascript
import {
  migrateFile,
  migratePath,
  checkCompatibility,
  generateMigrationReport,
} from "@mtm/build-tools";

// Quick file migration
const result = await migrateFile("src/pages/index.mtm");

// Quick path migration
const report = await migratePath("src/pages/");

// Quick compatibility check
const compatibility = await checkCompatibility("src/pages/index.mtm");

// Quick report generation
const reportPath = await generateMigrationReport(migrationData, "report.html");
```

## 📝 File Format Changes

### Frontmatter Field Mappings

| Legacy Field       | Modern Field  | Notes                     |
| ------------------ | ------------- | ------------------------- |
| `page_title`       | `title`       | Direct mapping            |
| `page_description` | `description` | Direct mapping            |
| `meta_keywords`    | `keywords`    | String → Array conversion |
| `template`         | `layout`      | Direct mapping            |
| `http_status`      | `status`      | Direct mapping            |

### Route Format Evolution

#### Single Route

**Legacy:** `route: /path`
**Modern:** `route: /path` (unchanged)

#### Multi-language Routes

**Legacy:** `route: en:/home, fr:/accueil`
**Modern:**

```yaml
route:
  en: /home
  fr: /accueil
locales: [en, fr]
```

#### Array Routes

**Legacy:** `route: [en:/home, fr:/accueil]`
**Modern:**

```yaml
route:
  en: /home
  fr: /accueil
locales: [en, fr]
```

### Signal Syntax Evolution

#### Basic Signals

**Legacy:** `$var = createSignal(value)`
**Modern:** `$var! = signal('key', value)`

#### Signal Operations

**Legacy:**

```javascript
const [count, setCount] = createSignal(0);
setCount(count() + 1);
```

**Modern:**

```javascript
$count! = signal('counter', 0);
$count++;
```

### Event Syntax Changes

| Legacy     | Modern   | Notes                 |
| ---------- | -------- | --------------------- |
| `onClick`  | `click`  | Lowercase event names |
| `onSubmit` | `submit` | Lowercase event names |
| `onChange` | `change` | Lowercase event names |
| `onInput`  | `input`  | Lowercase event names |

### Lifecycle Method Updates

| Legacy     | Modern       | Notes                     |
| ---------- | ------------ | ------------------------- |
| `$mount`   | `$onMount`   | Explicit lifecycle naming |
| `$destroy` | `$onDestroy` | Explicit lifecycle naming |
| `$update`  | `$onUpdate`  | Explicit lifecycle naming |

## 🔄 Backward Compatibility

The migration tools provide several levels of backward compatibility:

### Compatibility Levels

1. **Modern** - Uses latest ultra-modern format
2. **Transitional** - Mix of old and new syntax
3. **Legacy** - Uses deprecated format

### Gradual Migration Strategy

1. **Phase 1: Compatibility Layer**

   - Enable backward compatibility in build tools
   - Files work with both old and new syntax
   - Deprecation warnings for old patterns

2. **Phase 2: Selective Migration**

   - Migrate critical files first
   - Test thoroughly after each migration
   - Keep non-critical files in legacy format temporarily

3. **Phase 3: Complete Migration**
   - Migrate remaining files
   - Disable backward compatibility
   - Clean up deprecated code

### Configuration

```javascript
// Enable backward compatibility
const compatibility = new BackwardCompatibilityLayer({
  enableLegacySupport: true,
  warnOnDeprecated: true,
  strictMode: false,
});

// Gradual migration mode
const migrator = new MTMMigrator({
  backupOriginals: true,
  validateAfterMigration: true,
  generateReport: true,
});
```

## 🔧 Troubleshooting

### Common Issues

#### 1. YAML Parsing Errors

**Problem:** Frontmatter contains invalid YAML syntax

**Solution:**

```bash
# Check specific file
npx mtm-migrate validate src/pages/problematic.mtm

# Common fixes:
# - Quote strings with special characters
# - Fix indentation (use spaces, not tabs)
# - Escape colons in values
```

**Example Fix:**

```yaml
# ❌ Problematic
title: My Page: A Guide
description: |
  This is a description
    with bad indentation

# ✅ Fixed
title: "My Page: A Guide"
description: |
  This is a description
  with proper indentation
```

#### 2. Route Migration Issues

**Problem:** Complex route patterns not migrating correctly

**Solution:**

```bash
# Analyze route patterns
npx mtm-migrate analyze src/ --verbose

# Manual route format:
route:
  en: /english-path
  fr: /french-path
  es: /spanish-path
locales: [en, fr, es]
```

#### 3. Signal Syntax Conflicts

**Problem:** Mixed signal syntax causing errors

**Solution:**

```bash
# Check compatibility
npx mtm-migrate check src/ --detailed

# Ensure consistent syntax:
$count! = signal('counter', 0)  # ✅ Modern
$count = createSignal(0)        # ❌ Legacy
```

#### 4. Template Wrapper Issues

**Problem:** Content not properly wrapped in template tags

**Solution:**

```html
<!-- ❌ Legacy -->
<div class="page">
  <h1>Content</h1>
</div>

<!-- ✅ Modern -->
<template>
  <div class="page">
    <h1>Content</h1>
  </div>
</template>
```

### Debug Mode

Enable verbose logging for detailed troubleshooting:

```bash
# Verbose migration
npx mtm-migrate migrate --verbose src/

# Detailed compatibility check
npx mtm-migrate check --detailed --verbose src/

# Export analysis for review
npx mtm-migrate analyze --export src/
```

### Getting Help

1. **Check Migration Report** - Review generated reports for detailed error information
2. **Use Dry Run** - Preview changes before applying them
3. **Validate Incrementally** - Migrate and validate small batches of files
4. **Backup Everything** - Always backup before migration

## 📖 Examples

### Example 1: Basic Page Migration

**Before (Legacy):**

```mtm
---
page_title: Home Page
page_description: Welcome to our website
meta_keywords: home, welcome, website
template: main
route: en:/home, fr:/accueil
---

$userCount = createSignal(0)
$message = createSignal('Welcome!')

$mount = () => {
  console.log('Page loaded')
}

$increment = () => {
  $userCount = $userCount() + 1
}

<div class="home-page">
  <h1>{$message()}</h1>
  <p>Users online: {$userCount()}</p>
  <button onClick={$increment}>Increment</button>
</div>
```

**After (Modern):**

```mtm
---
title: Home Page
description: Welcome to our website
keywords: [home, welcome, website]
layout: main
route:
  en: /home
  fr: /accueil
locales: [en, fr]
---

$userCount! = signal('userCount', 0)
$message! = signal('message', 'Welcome!')

$onMount = () => {
  console.log('Page loaded')
  signal.emit('page-loaded', { page: 'home' })
}

$increment = () => {
  $userCount++
  signal.emit('user-count-changed', { count: $userCount })
}

<template>
  <div class="home-page">
    <h1>{$message}</h1>
    <p>Users online: {$userCount}</p>
    <button click={$increment}>Increment</button>
  </div>
</template>
```

### Example 2: Component Migration

**Before (Legacy):**

```mtm
---
page_title: User Profile Component
template: component
---

$user = createSignal(null)
$loading = createSignal(true)

$mount = async () => {
  const userData = await fetchUser()
  $user = userData
  $loading = false
}

<div class="user-profile">
  {$loading() ? (
    <div>Loading...</div>
  ) : (
    <div>
      <h2>{$user()?.name}</h2>
      <p>{$user()?.email}</p>
    </div>
  )}
</div>
```

**After (Modern):**

```mtm
---
title: User Profile Component
description: Displays user profile information
keywords: [user, profile, component]
layout: component
---

$user! = signal('user', null)
$loading! = signal('loading', true)

$onMount = async () => {
  const userData = await fetchUser()
  $user = userData
  $loading = false
  signal.emit('user-loaded', { user: userData })
}

<template>
  <div class="user-profile">
    {#if $loading}
      <div>Loading...</div>
    {:else}
      <div>
        <h2>{$user?.name}</h2>
        <p>{$user?.email}</p>
      </div>
    {/if}
  </div>
</template>
```

### Example 3: Complex Multi-language Page

**Before (Legacy):**

```mtm
---
page_title: Product Catalog
page_description: Browse our product catalog
meta_keywords: products, catalog, shop
template: catalog
route: en:/products, fr:/produits, es:/productos, de:/produkte
---

$products = createSignal([])
$selectedCategory = createSignal('all')
$searchQuery = createSignal('')

$mount = async () => {
  const data = await fetchProducts()
  $products = data
}

$filterProducts = () => {
  return $products().filter(product => {
    const matchesCategory = $selectedCategory() === 'all' ||
                           product.category === $selectedCategory()
    const matchesSearch = product.name.toLowerCase()
                           .includes($searchQuery().toLowerCase())
    return matchesCategory && matchesSearch
  })
}

<div class="product-catalog">
  <div class="filters">
    <input
      type="text"
      placeholder="Search products..."
      onInput={(e) => $searchQuery = e.target.value}
    />
    <select onChange={(e) => $selectedCategory = e.target.value}>
      <option value="all">All Categories</option>
      <option value="electronics">Electronics</option>
      <option value="clothing">Clothing</option>
    </select>
  </div>

  <div class="products">
    {$filterProducts().map(product => (
      <div key={product.id} class="product-card">
        <h3>{product.name}</h3>
        <p>{product.description}</p>
        <span class="price">${product.price}</span>
      </div>
    ))}
  </div>
</div>
```

**After (Modern):**

```mtm
---
title: Product Catalog
description: Browse our product catalog
keywords: [products, catalog, shop, ecommerce]
layout: catalog
route:
  en: /products
  fr: /produits
  es: /productos
  de: /produkte
locales: [en, fr, es, de]
---

$products! = signal('products', [])
$selectedCategory! = signal('selectedCategory', 'all')
$searchQuery! = signal('searchQuery', '')

$onMount = async () => {
  const data = await fetchProducts()
  $products = data
  signal.emit('products-loaded', { count: data.length })
}

$filterProducts = () => {
  return $products.filter(product => {
    const matchesCategory = $selectedCategory === 'all' ||
                           product.category === $selectedCategory
    const matchesSearch = product.name.toLowerCase()
                           .includes($searchQuery.toLowerCase())
    return matchesCategory && matchesSearch
  })
}

$updateSearch = (query) => {
  $searchQuery = query
  signal.emit('search-updated', { query })
}

$updateCategory = (category) => {
  $selectedCategory = category
  signal.emit('category-changed', { category })
}

<template>
  <div class="product-catalog">
    <div class="filters">
      <input
        type="text"
        placeholder="Search products..."
        value={$searchQuery}
        input={(e) => $updateSearch(e.target.value)}
      />
      <select value={$selectedCategory} change={(e) => $updateCategory(e.target.value)}>
        <option value="all">All Categories</option>
        <option value="electronics">Electronics</option>
        <option value="clothing">Clothing</option>
      </select>
    </div>

    <div class="products">
      {#each $filterProducts() as product}
        <div class="product-card" key={product.id}>
          <h3>{product.name}</h3>
          <p>{product.description}</p>
          <span class="price">${product.price}</span>
        </div>
      {/each}
    </div>
  </div>
</template>
```

### Example 4: Migration Script Usage

```javascript
// migration-script.js
import { MTMMigrator, BackwardCompatibilityLayer } from "@mtm/build-tools";

async function migrateProject() {
  // Step 1: Analyze current state
  const compatibility = new BackwardCompatibilityLayer();
  const files = ["src/pages/", "src/components/"];
  const summary = await compatibility.getCompatibilitySummary(files);

  console.log("Compatibility Summary:", summary);

  // Step 2: Migrate with custom options
  const migrator = new MTMMigrator({
    backupOriginals: true,
    validateAfterMigration: true,
    generateReport: true,
    dryRun: false,
  });

  const report = await migrator.migrate(files);

  console.log("Migration completed:", report);

  // Step 3: Generate HTML report
  const reportGenerator = new MigrationReportGenerator({
    format: "html",
    includeDetails: true,
  });

  const reportPath = await reportGenerator.generateReport(report);
  console.log("Report generated:", reportPath);
}

migrateProject().catch(console.error);
```

## 🤝 Contributing

We welcome contributions to improve the migration tools! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🔗 Related Documentation

- [Ultra-Modern MTM Syntax Guide](../docs/SYNTAX.md)
- [Routing System Documentation](../docs/ROUTING.md)
- [Signal System Guide](../docs/SIGNALS.md)
- [Build System Configuration](../docs/BUILD.md)

---

For more information and support, visit our [GitHub repository](https://github.com/metamon/mtm) or join our [Discord community](https://discord.gg/mtm).
