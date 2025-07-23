# Ultra-Modern MTM Troubleshooting Guide

Comprehensive troubleshooting guide for Ultra-Modern MTM development, migration, and deployment issues.

## 📋 Table of Contents

- [Build Issues](#build-issues)
- [Migration Problems](#migration-problems)
- [Runtime Errors](#runtime-errors)
- [Development Issues](#development-issues)
- [Performance Problems](#performance-problems)
- [Deployment Issues](#deployment-issues)
- [Debug Tools](#debug-tools)

## 🔨 Build Issues

### Vite Plugin Integration Problems

#### Issue: MTM files not being processed

```
Error: Failed to resolve import "*.mtm"
```

**Cause:** MTM plugin not properly configured or not running before import analysis

**Solution:**

```javascript
// vite.config.js
import { defineConfig } from "vite";
import { mtmPlugin } from "@mtm/build-tools";

export default defineConfig({
  plugins: [
    mtmPlugin({
      enforce: "pre", // Critical: Run before import analysis
      include: ["**/*.mtm"],
      ssr: true,
    }),
  ],
});
```

#### Issue: Hot reload not working for MTM files

```
[vite] hot updated: (no modules updated)
```

**Cause:** File watcher not configured for .mtm files

**Solution:**

```javascript
// vite.config.js
export default defineConfig({
  plugins: [mtmPlugin()],
  server: {
    watch: {
      include: ["**/*.mtm"],
    },
  },
});
```

### Frontmatter Parsing Errors

#### Issue: YAML syntax errors

```
FrontmatterParseError: YAML parsing error: bad indentation
```

**Common Causes & Solutions:**

1. **Mixed tabs and spaces**

   ```yaml
   # ❌ Mixed indentation
   keywords:
   	- keyword1  # Tab
     - keyword2  # Spaces

   # ✅ Consistent spaces
   keywords:
     - keyword1
     - keyword2
   ```

2. **Unquoted special characters**

   ```yaml
   # ❌ Unquoted colon
   title: My Page: A Guide

   # ✅ Quoted string
   title: "My Page: A Guide"
   ```

3. **Invalid array syntax**

   ```yaml
   # ❌ Invalid array
   keywords: [keyword1, keyword2,]

   # ✅ Valid array
   keywords: [keyword1, keyword2]
   # or
   keywords:
     - keyword1
     - keyword2
   ```

#### Issue: Route parsing errors

```
Invalid route definition: must be string or object with path property
```

**Solution:**

```yaml
# ❌ Invalid route format
route: en:/home, fr:/accueil

# ✅ Modern route format
route:
  en: /home
  fr: /accueil
locales: [en, fr]
```

### Template Transformation Errors

#### Issue: Template syntax not recognized

```
Transform error: Unexpected token in template
```

**Cause:** Template not properly wrapped or invalid syntax

**Solution:**

```html
<!-- ❌ Missing template wrapper -->
<div class="page">
  <h1>{$title}</h1>
</div>

<!-- ✅ Properly wrapped -->
<template>
  <div class="page">
    <h1>{$title}</h1>
  </div>
</template>
```

## 🔄 Migration Problems

### Automated Migration Issues

#### Issue: Migration tool fails with permission errors

```
Error: EACCES: permission denied, open 'file.mtm'
```

**Solution:**

```bash
# Fix file permissions
chmod 644 src/**/*.mtm

# Or run with appropriate permissions
sudo npx mtm-migrate migrate src/
```

#### Issue: Backup files not created

```
Warning: Backup creation failed
```

**Solution:**

```bash
# Manually create backup before migration
cp -r src/ src-backup/

# Or disable backup and use git
npx mtm-migrate migrate --no-backup src/
git commit -am "Before MTM migration"
```

### Signal Migration Issues

#### Issue: Signal syntax partially migrated

```
TypeError: $count is not a function
```

**Cause:** Mixed old and new signal syntax

**Solution:**

```javascript
// ❌ Partially migrated
$count! = signal('counter', 0)
console.log($count()) // Old syntax

// ✅ Fully migrated
$count! = signal('counter', 0)
console.log($count) // New syntax
```

#### Issue: Signal key conflicts

```
Warning: Signal key 'data' already exists
```

**Solution:**

```javascript
// ❌ Generic keys causing conflicts
$userData! = signal('data', null)
$productData! = signal('data', null)

// ✅ Unique descriptive keys
$userData! = signal('userData', null)
$productData! = signal('productData', null)
```

### Route Migration Issues

#### Issue: Complex route patterns not migrating

```
Error: Cannot parse route pattern: /users/[id]/posts/[...slug]
```

**Solution:** Manual migration required

```yaml
# Complex dynamic routes need manual attention
route:
  en: /users/[id]/posts/[...slug]
  fr: /utilisateurs/[id]/articles/[...slug]
locales: [en, fr]
```

## ⚠️ Runtime Errors

### Signal System Errors

#### Issue: Signal not updating UI

```
Signal value changed but UI not re-rendering
```

**Debugging Steps:**

1. Check signal declaration:

   ```javascript
   // ✅ Correct reactive signal
   $count! = signal('counter', 0)

   // ❌ Non-reactive variable
   $count = 0
   ```

2. Verify signal usage in template:

   ```html
   <!-- ✅ Correct binding -->
   <div>{$count}</div>

   <!-- ❌ Function call (legacy) -->
   <div>{$count()}</div>
   ```

3. Check for signal key conflicts:
   ```javascript
   // Use unique keys
   $userCount! = signal('userCount', 0)
   $postCount! = signal('postCount', 0)
   ```

#### Issue: Signal memory leaks

```
Warning: Signal listeners not cleaned up
```

**Solution:**

```javascript
$onMount = () => {
  const unsubscribe = signal.on("data-updated", handleUpdate);

  // Clean up on unmount
  return () => {
    unsubscribe();
  };
};

// Or use automatic cleanup
$onDestroy = () => {
  signal.off("data-updated", handleUpdate);
};
```

### Event Handling Errors

#### Issue: Event handlers not working

```
TypeError: Cannot read property 'target' of undefined
```

**Common Causes:**

1. **Legacy event names**

   ```html
   <!-- ❌ Legacy event name -->
   <button onClick="{handleClick}">Click</button>

   <!-- ✅ Modern event name -->
   <button click="{handleClick}">Click</button>
   ```

2. **Incorrect event binding**

   ```html
   <!-- ❌ Missing function reference -->
   <button click="handleClick">Click</button>

   <!-- ✅ Proper function binding -->
   <button click="{handleClick}">Click</button>
   ```

### Routing Errors

#### Issue: 404 errors for valid routes

```
404 - Page not found for /valid-route
```

**Debugging Steps:**

1. Check route manifest generation:

   ```bash
   npx mtm-migrate analyze src/ --verbose
   ```

2. Verify route definition:

   ```yaml
   # Ensure route starts with /
   route: /valid-route  # ✅
   route: valid-route   # ❌
   ```

3. Check for route conflicts:
   ```bash
   # Look for duplicate routes
   grep -r "route:" src/ | grep "/same-path"
   ```

#### Issue: Dynamic route parameters not working

```
Error: Cannot read parameter 'id' from undefined
```

**Solution:**

```javascript
// ✅ Proper parameter access
$userId = params.id || "default";

// ❌ Assuming parameter exists
$userId = params.id.toString();
```

## 🛠️ Development Issues

### Hot Reload Problems

#### Issue: Changes not reflected in browser

```
[vite] hmr update (no modules updated)
```

**Solutions:**

1. **Clear Vite cache**

   ```bash
   rm -rf node_modules/.vite
   npm run dev
   ```

2. **Check file watching**

   ```javascript
   // vite.config.js
   export default defineConfig({
     server: {
       watch: {
         include: ["**/*.mtm", "**/*.js", "**/*.css"],
       },
     },
   });
   ```

3. **Restart dev server**
   ```bash
   # Kill and restart
   pkill -f "vite"
   npm run dev
   ```

### IDE Integration Issues

#### Issue: Syntax highlighting not working

**Solution:** Install MTM language extension or configure as HTML

#### Issue: IntelliSense not working for signals

**Solution:** Add type definitions

```typescript
// types/mtm.d.ts
declare global {
  function signal<T>(key: string, initialValue: T): T;
  const params: Record<string, string>;
}
```

### Import/Export Issues

#### Issue: Cannot import MTM components

```
Error: Failed to resolve import "./component.mtm"
```

**Solution:**

```javascript
// ✅ Proper MTM import
import MyComponent from "./component.mtm";

// ❌ Incorrect extension
import MyComponent from "./component.js";
```

## 🐌 Performance Problems

### Build Performance

#### Issue: Slow build times

**Optimization strategies:**

1. **Enable parallel processing**

   ```javascript
   // vite.config.js
   export default defineConfig({
     build: {
       rollupOptions: {
         output: {
           manualChunks: {
             vendor: ["react", "vue", "svelte"],
           },
         },
       },
     },
   });
   ```

2. **Optimize MTM plugin**
   ```javascript
   mtmPlugin({
     include: ["src/**/*.mtm"], // Specific paths only
     exclude: ["node_modules/**"],
     cache: true,
   });
   ```

### Runtime Performance

#### Issue: Slow signal updates

**Optimization:**

1. **Batch signal updates**

   ```javascript
   // ✅ Batched updates
   signal.batch(() => {
     $loading = false;
     $data = newData;
     $error = null;
   });

   // ❌ Individual updates
   $loading = false;
   $data = newData;
   $error = null;
   ```

2. **Use computed signals for derived state**

   ```javascript
   // ✅ Computed signal
   $filteredItems = computed(() => $items.filter((item) => item.active));

   // ❌ Filtering in template
   // {$items.filter(item => item.active)}
   ```

#### Issue: Memory leaks in long-running apps

**Solution:**

1. **Clean up event listeners**

   ```javascript
   $onDestroy = () => {
     signal.off("global-event", handler);
     clearInterval(intervalId);
   };
   ```

2. **Avoid circular references**

   ```javascript
   // ❌ Circular reference
   $parent.child = $child;
   $child.parent = $parent;

   // ✅ Use IDs or weak references
   $child.parentId = $parent.id;
   ```

## 🚀 Deployment Issues

### SSR Problems

#### Issue: Hydration mismatches

```
Warning: Text content did not match. Server: "0" Client: "1"
```

**Cause:** Server and client rendering different content

**Solution:**

```javascript
// ✅ Consistent server/client rendering
$onMount = () => {
  // Client-only code here
  if (typeof window !== "undefined") {
    $clientOnlyData = getClientData();
  }
};

// ❌ Different server/client values
$randomValue = Math.random(); // Different on server/client
```

#### Issue: Server-side signal errors

```
ReferenceError: window is not defined
```

**Solution:**

```javascript
// ✅ Check for browser environment
$initializeClient = () => {
  if (typeof window !== "undefined") {
    // Browser-only code
    window.addEventListener("resize", handleResize);
  }
};
```

### Production Build Issues

#### Issue: Missing dependencies in production

```
Error: Cannot resolve module '@mtm/core'
```

**Solution:**

```json
// package.json
{
  "dependencies": {
    "@mtm/core": "^1.0.0",
    "@mtm/build-tools": "^1.0.0"
  }
}
```

#### Issue: Environment variable problems

```
Error: process.env.API_URL is undefined
```

**Solution:**

```javascript
// vite.config.js
export default defineConfig({
  define: {
    "process.env.API_URL": JSON.stringify(process.env.API_URL),
  },
});
```

## 🔍 Debug Tools

### Built-in Debugging

#### Enable verbose logging

```javascript
// Enable debug mode
localStorage.setItem("mtm:debug", "true");

// Or in code
signal.debug = true;
```

#### Signal inspection

```javascript
// List all signals
console.log(signal.getAll());

// Watch signal changes
signal.on("*", (key, value) => {
  console.log(`Signal ${key} changed to:`, value);
});
```

### Browser DevTools

#### Signal DevTools Extension

1. Install MTM DevTools browser extension
2. Open DevTools → MTM tab
3. Inspect signal state and events

#### Console Debugging

```javascript
// Global debug helpers (development only)
window.mtmDebug = {
  signals: () => signal.getAll(),
  emit: (event, data) => signal.emit(event, data),
  routes: () => router.getRoutes(),
};
```

### CLI Debugging Tools

#### Analyze project structure

```bash
npx mtm-migrate analyze src/ --verbose --export
```

#### Validate all files

```bash
npx mtm-migrate validate src/ --strict --warnings
```

#### Check compatibility

```bash
npx mtm-migrate check src/ --detailed
```

### Custom Debug Utilities

#### Signal Logger

```javascript
// utils/debug.js
export const signalLogger = {
  start() {
    signal.on("*", (key, value, oldValue) => {
      console.group(`🔄 Signal: ${key}`);
      console.log("Old:", oldValue);
      console.log("New:", value);
      console.trace("Changed from:");
      console.groupEnd();
    });
  },

  stop() {
    signal.off("*");
  },
};
```

#### Performance Monitor

```javascript
// utils/performance.js
export const perfMonitor = {
  measureSignalUpdates() {
    const times = new Map();

    signal.on("*", (key) => {
      const now = performance.now();
      const last = times.get(key) || now;

      if (now - last < 16) {
        // < 60fps
        console.warn(`Signal ${key} updating too frequently`);
      }

      times.set(key, now);
    });
  },
};
```

## 🆘 Getting Help

### Self-Help Checklist

Before seeking help, try these steps:

1. **Check the error message carefully**
2. **Search existing issues on GitHub**
3. **Try the solution in a minimal reproduction**
4. **Check if it works in a fresh project**
5. **Review recent changes in your code**

### Community Support

1. **GitHub Issues** - Bug reports and feature requests

   - Include minimal reproduction case
   - Provide error messages and stack traces
   - Mention your environment (OS, Node version, etc.)

2. **Discord Community** - Real-time help

   - Share code snippets
   - Ask for clarification
   - Help others with similar issues

3. **Stack Overflow** - Detailed technical questions
   - Tag with `ultra-modern-mtm`
   - Include complete code examples
   - Explain what you've already tried

### Creating Good Bug Reports

Include this information:

```markdown
## Environment

- OS: macOS 12.0
- Node: 18.0.0
- MTM Version: 1.0.0
- Browser: Chrome 100.0

## Steps to Reproduce

1. Create new MTM file with...
2. Run migration command...
3. Error occurs when...

## Expected Behavior

The migration should...

## Actual Behavior

Instead, it throws...

## Error Message
```

[Paste full error message here]

```

## Minimal Reproduction
[Link to CodeSandbox or GitHub repo]
```

---

**Remember:** Most issues have simple solutions. Take your time to read error messages carefully and check the basics first! 🔍
