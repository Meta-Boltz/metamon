# Chunk Loading Examples

This directory contains comprehensive examples demonstrating safe chunk loading patterns in the Metamon framework across different JavaScript frameworks.

## 📁 Files Overview

### Core Examples

- **`chunk-loading-react.jsx`** - React-specific chunk loading examples with Suspense and error boundaries
- **`chunk-loading-vue.js`** - Vue.js examples using defineAsyncComponent and error handling
- **`chunk-loading-svelte.js`** - Svelte examples with custom component loading patterns
- **`chunk-loading-vanilla.js`** - Vanilla JavaScript examples with manual chunk management
- **`chunk-loading-comprehensive.js`** - Framework selector and comprehensive demonstration

### Legacy Examples

- **`chunk-error-handling.js`** - Original error handling examples (maintained for compatibility)

### Demo Page

- **`../chunk-loading-examples.html`** - Interactive HTML page showcasing all examples

## 🚀 Quick Start

### View Examples in Browser

1. **Open the demo page:**

   ```bash
   # From the examples directory
   open chunk-loading-examples.html
   # or
   python -m http.server 8000  # Then visit http://localhost:8000/chunk-loading-examples.html
   ```

2. **Or run individual examples:**
   ```javascript
   // Import and run specific framework examples
   import { initReactChunkLoadingExamples } from "./src/examples/chunk-loading-react.jsx";
   initReactChunkLoadingExamples();
   ```

### Integration in Your Project

```javascript
// Import the safe assignment utility
import { safeAssign } from "@mtm/core";

// Use in your chunk loader
const loadChunkSafely = async (chunkId, importFn) => {
  try {
    const module = await importFn();

    // Apply safe property assignment
    const processedModule = safeAssign(module, "chunkData", {
      id: chunkId,
      loaded: true,
      timestamp: Date.now(),
    });

    return processedModule;
  } catch (error) {
    console.error(`Failed to load chunk ${chunkId}:`, error);
    throw new Error(`Chunk loading failed: ${error.message}`);
  }
};
```

## 🎯 What's Demonstrated

### 1. Safe Property Assignment

- **Problem**: `TypeError: Cannot set property data of #<Object> which has only a getter`
- **Solution**: Multi-strategy safe assignment that handles getter-only properties
- **Strategies**: Setter addition, property redefinition, object recreation, proxy wrapping

### 2. Error Handling Patterns

- **Error Boundaries**: Framework-specific error boundary implementations
- **Error Classification**: Network, parse, execution, and property errors
- **Retry Mechanisms**: Configurable retry strategies with exponential backoff
- **Fallback Components**: User-friendly error displays with recovery options

### 3. Performance Optimization

- **Preloading**: Strategic component preloading for instant rendering
- **Lazy Loading**: On-demand component loading with loading states
- **Caching**: Intelligent module caching to prevent duplicate loads
- **Code Splitting**: Optimal chunk size and dependency management

### 4. Framework Integration

- **React**: Suspense, lazy(), error boundaries, and hooks integration
- **Vue**: defineAsyncComponent, error components, and composition API
- **Svelte**: Custom component factories and lifecycle management
- **Vanilla JS**: Manual DOM management and event handling

## 🔧 Technical Implementation

### The Original Problem

```javascript
// This fails in the Metamon framework
const module = {
  get data() {
    return this._data;
  },
  // No setter defined - causes TypeError when chunk loader tries to assign
};

module.data = { loaded: true }; // ❌ TypeError: Cannot set property data
```

### The Solution

```javascript
function safeAssign(obj, prop, value) {
  const descriptor = Object.getOwnPropertyDescriptor(obj, prop);

  if (descriptor && descriptor.get && !descriptor.set) {
    // Strategy 1: Try to add a setter
    try {
      Object.defineProperty(obj, prop, {
        ...descriptor,
        set(newValue) {
          Object.defineProperty(this, "_" + prop, {
            value: newValue,
            writable: true,
          });
        },
      });
      obj[prop] = value;
      return obj;
    } catch (e) {
      // Strategy 2: Create new object with desired property
      return createNewObjectWithProperty(obj, prop, value);
    }
  } else {
    // Standard assignment for normal properties
    obj[prop] = value;
    return obj;
  }
}
```

### Error Handling Architecture

```javascript
// Error classification system
class ChunkError extends Error {
  constructor(message, context = {}) {
    super(message);
    this.chunkId = context.chunkId;
    this.phase = context.phase;
    this.type = context.type || "unknown";
    this.originalError = context.originalError;
  }
}

// Retry mechanism with exponential backoff
const withRetry = (loader, options = {}) => {
  const { maxRetries = 3, baseDelay = 1000, backoffFactor = 2 } = options;

  return async (chunkId, ...args) => {
    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await loader(chunkId, ...args);
      } catch (error) {
        lastError = error;

        if (attempt === maxRetries) break;

        const delay = baseDelay * Math.pow(backoffFactor, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  };
};
```

## 📊 Example Scenarios

### 1. Basic Lazy Loading

```javascript
// React example
const LazyComponent = React.lazy(() =>
  loadChunkSafely("my-component", () => import("./MyComponent"))
);

// Vue example
const AsyncComponent = defineAsyncComponent(() =>
  loadChunkSafely("my-component", () => import("./MyComponent.vue"))
);
```

### 2. Error Recovery

```javascript
// Component that retries on failure
const RetryableComponent = React.lazy(() => {
  return loadChunkSafely("retryable", () => {
    if (Math.random() < 0.5) {
      throw new Error("Simulated failure");
    }
    return import("./Component");
  });
});
```

### 3. Preloading Strategy

```javascript
// Preload critical components
const preloadCriticalChunks = async () => {
  const criticalChunks = ["header", "navigation", "footer"];

  await Promise.all(
    criticalChunks.map((chunkId) =>
      loadChunkSafely(chunkId, () => import(`./components/${chunkId}`)).catch(
        (error) => console.warn(`Failed to preload ${chunkId}:`, error)
      )
    )
  );
};
```

### 4. Manual Chunk Management

```javascript
// Fine-grained control over chunk loading
class ChunkManager {
  constructor() {
    this.cache = new Map();
    this.pending = new Map();
  }

  async load(chunkId, importFn) {
    if (this.cache.has(chunkId)) {
      return this.cache.get(chunkId);
    }

    if (this.pending.has(chunkId)) {
      return this.pending.get(chunkId);
    }

    const promise = loadChunkSafely(chunkId, importFn);
    this.pending.set(chunkId, promise);

    try {
      const module = await promise;
      this.cache.set(chunkId, module);
      return module;
    } finally {
      this.pending.delete(chunkId);
    }
  }
}
```

## 🧪 Testing the Examples

### Browser Testing

1. Open `chunk-loading-examples.html` in different browsers
2. Test framework switching functionality
3. Verify error handling by simulating network failures
4. Check retry mechanisms and fallback components

### Integration Testing

```javascript
// Test safe assignment with various property descriptors
describe("Safe Assignment", () => {
  it("should handle getter-only properties", () => {
    const obj = {};
    Object.defineProperty(obj, "data", {
      get() {
        return this._data;
      },
      configurable: true,
    });

    const result = safeAssign(obj, "data", "test");
    expect(result.data).toBe("test");
  });
});
```

### Performance Testing

```javascript
// Measure chunk loading performance
const measureChunkLoad = async (chunkId, importFn) => {
  const start = performance.now();

  try {
    const module = await loadChunkSafely(chunkId, importFn);
    const end = performance.now();

    console.log(`Chunk ${chunkId} loaded in ${end - start}ms`);
    return module;
  } catch (error) {
    const end = performance.now();
    console.error(`Chunk ${chunkId} failed after ${end - start}ms:`, error);
    throw error;
  }
};
```

## 🔍 Debugging

### Enable Debug Mode

```javascript
// Enable detailed logging
localStorage.setItem("mtm:chunk-debug", "true");

// Or programmatically
window.mtmChunkDebug = true;
```

### Monitor Chunk Loading

```javascript
// Listen to chunk loading events
chunkLoader.on("load-start", (chunkId) => {
  console.log(`🔄 Loading chunk: ${chunkId}`);
});

chunkLoader.on("load-success", (chunkId, module) => {
  console.log(`✅ Loaded chunk: ${chunkId}`, module);
});

chunkLoader.on("load-error", (chunkId, error) => {
  console.error(`❌ Failed to load chunk: ${chunkId}`, error);
});
```

### Performance Monitoring

```javascript
// Track chunk loading metrics
const perfMonitor = {
  start(chunkId) {
    performance.mark(`chunk-load-start-${chunkId}`);
  },

  end(chunkId) {
    performance.mark(`chunk-load-end-${chunkId}`);
    performance.measure(
      `chunk-load-${chunkId}`,
      `chunk-load-start-${chunkId}`,
      `chunk-load-end-${chunkId}`
    );
  },

  getMetrics() {
    return performance
      .getEntriesByType("measure")
      .filter((entry) => entry.name.startsWith("chunk-load-"));
  },
};
```

## 📚 Related Documentation

- **[Chunk Loading Technical Documentation](../../docs/CHUNK_LOADING.md)** - Detailed technical implementation
- **[Troubleshooting Guide](../../docs/TROUBLESHOOTING.md)** - Common issues and solutions
- **[Migration Guide](../../docs/MIGRATION_GUIDE.md)** - Upgrading existing implementations
- **[API Reference](../../packages/core/README.md)** - Core API documentation

## 🤝 Contributing

To add new examples or improve existing ones:

1. **Follow the established patterns** in existing example files
2. **Include comprehensive error handling** for all scenarios
3. **Add detailed comments** explaining the implementation
4. **Test across all supported frameworks** when applicable
5. **Update this README** with new examples or changes

### Example Template

```javascript
/**
 * [Framework] [Feature] Example
 *
 * This example demonstrates [specific functionality] with [specific approach].
 */

// Import required utilities
import { safeAssign, loadChunkSafely } from "@mtm/core";

// Example implementation
const ExampleComponent = () => {
  // Implementation with error handling
  // ...
};

// Export for use in other examples
export { ExampleComponent };
```

## 📄 License

These examples are part of the Metamon framework and are subject to the same license terms as the main project.
