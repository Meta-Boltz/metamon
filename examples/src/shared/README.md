# Enhanced Code Splitter with Safe Property Assignment

This module provides an enhanced code splitting and chunk loading mechanism for the Metamon framework, with special handling for property descriptor conflicts.

## Background

The Metamon framework was experiencing a critical issue with chunk loading in the browser. When attempting to load dynamic chunks from .mtm files, users encountered the error: "Failed to load chunk: TypeError: Cannot set property data of #<Object> which has only a getter".

This error occurs because:

1. The MTM transformer creates objects with getter-only properties
2. The chunk loader tries to set values on these properties
3. In strict mode, this throws a TypeError

## Features

- **Safe Property Assignment**: Uses the `safeAssign` utility to handle getter-only properties
- **Enhanced Error Handling**: Categorizes errors and provides detailed diagnostic information
- **Recovery Mechanisms**: Attempts to recover from property descriptor errors in tolerant mode
- **Configurable Behavior**: Supports strict or tolerant error handling modes

## Usage

```javascript
import { createCodeSplitter, lazy, preload, prefetch } from "./code-splitter";

// Create a code splitter with safe property assignment
const codeSplitter = createCodeSplitter({
  safeAssignment: true,
  errorHandling: "tolerant", // 'strict' or 'tolerant'
  defaultTransforms: {
    // Default properties to apply to all loaded modules
    __loadedAt: new Date().toISOString(),
  },
});

// Create a lazy-loaded component
const LazyComponent = lazy(() => import("./components/MyComponent.mtm"));

// Preload a chunk
preload(() => import("./data/large-dataset.js"));

// Prefetch a chunk
prefetch(() => import("./pages/about.mtm"));
```

## Configuration Options

| Option               | Type    | Default         | Description                                        |
| -------------------- | ------- | --------------- | -------------------------------------------------- |
| `safeAssignment`     | boolean | `true`          | Use safe property assignment for chunk loading     |
| `errorHandling`      | string  | `'strict'`      | How to handle errors: 'strict' or 'tolerant'       |
| `chunkTimeout`       | number  | `10000`         | Timeout for chunk loading in milliseconds          |
| `maxConcurrentLoads` | number  | `3`             | Maximum number of concurrent chunk loads           |
| `enablePreloading`   | boolean | `true`          | Enable intelligent preloading                      |
| `enablePrefetching`  | boolean | `true`          | Enable link prefetching                            |
| `defaultTransforms`  | object  | `null`          | Default transformations to apply to all modules    |
| `retryStrategy`      | string  | `'exponential'` | Retry strategy: 'exponential', 'linear', or 'none' |

## Error Handling

The code splitter categorizes errors for better debugging:

- **property-descriptor**: Issues with getter-only properties
- **timeout**: Chunk loading timeout
- **network**: Network-related errors
- **invalid-module**: Invalid module structure

In tolerant mode, the code splitter attempts to recover from property descriptor errors by:

1. Using the safe assignment utility
2. Creating a proxy around the module
3. Providing a fallback module if recovery fails

## Diagnostic Information

When errors occur, detailed diagnostic information is collected:

```javascript
try {
  const module = await codeSplitter.loadChunk(() => import("./component.mtm"));
} catch (error) {
  if (error instanceof ChunkLoadError) {
    console.log(error.getDiagnosticReport());
  }
}
```
