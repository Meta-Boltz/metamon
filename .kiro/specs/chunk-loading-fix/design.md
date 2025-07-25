# Design Document: Chunk Loading Fix

## Overview

This design document outlines the approach to fix the chunk loading issue in the Metamon framework. The issue manifests as: "Failed to load chunk \_src_pages_index_mtm_import_mtm_transformed: TypeError: Cannot set property data of #<Object> which has only a getter at index.mtm:1:1". This error occurs during dynamic loading of chunks generated from .mtm files, preventing proper component rendering.

The solution will focus on identifying and fixing the root cause in the chunk loading mechanism, ensuring proper property assignment, and implementing robust error handling to prevent similar issues in the future.

## Architecture

The Metamon framework uses a modular architecture with several key components involved in the chunk loading process:

1. **MTM Transformer**: Converts .mtm files into framework-specific JavaScript code
2. **Code Splitter**: Handles dynamic imports and chunk generation
3. **Chunk Loader**: Responsible for loading chunks at runtime
4. **HMR System**: Handles hot module replacement for development

The issue occurs at the intersection of these components, specifically when the Chunk Loader attempts to set properties on objects that have been defined with only getters.

## Components and Interfaces

### 1. MTM Transformer

The transformer needs modification to ensure generated code is compatible with the chunk loading mechanism:

```typescript
interface TransformerOptions {
  target: "react" | "vue" | "svelte" | "solid" | "vanilla";
  hmr?: boolean;
  chunkCompatMode?: "legacy" | "modern"; // New option to control chunk compatibility
}

interface TransformResult {
  code: string;
  map: SourceMap | null;
  errors: TransformError[];
  metadata: {
    exports: string[];
    imports: string[];
    hasDefaultExport: boolean;
    chunkType: "module" | "commonjs"; // Explicitly track module type
  };
}
```

### 2. Code Splitter

The code splitter needs to be updated to handle property descriptors correctly:

```typescript
interface ChunkOptions {
  preserveGetters: boolean; // Whether to preserve getters during serialization
  useDefineProperty: boolean; // Whether to use Object.defineProperty for assignments
}

interface ChunkMetadata {
  id: string;
  url: string;
  type: "module" | "commonjs";
  hasGetterProperties: boolean; // Flag to indicate if chunk has getter properties
}
```

### 3. Chunk Loader

The chunk loader needs to be modified to handle property assignment correctly:

```typescript
interface ChunkLoaderOptions {
  safeAssignment: boolean; // Use safe property assignment method
  errorHandling: "strict" | "tolerant"; // How to handle loading errors
}

interface LoadResult<T> {
  module: T;
  success: boolean;
  error?: Error;
}
```

### 4. Error Handler

A new error handler component will be added to provide better diagnostics:

```typescript
interface ChunkError extends Error {
  chunkId: string;
  url: string;
  phase: "load" | "parse" | "execute";
  originalError: Error;
}

interface ErrorHandlerOptions {
  detailedErrors: boolean;
  retryStrategy?: "immediate" | "backoff" | "none";
  maxRetries?: number;
}
```

## Data Models

### Chunk Model

```typescript
interface Chunk {
  id: string;
  url: string;
  code: string;
  type: "module" | "commonjs";
  metadata: {
    framework: "react" | "vue" | "svelte" | "solid" | "vanilla";
    hasHMR: boolean;
    exports: string[];
    properties: {
      name: string;
      hasGetter: boolean;
      hasSetter: boolean;
    }[];
  };
}
```

### Module Registry

```typescript
interface ModuleRegistry {
  modules: Map<string, any>;
  chunks: Map<string, Chunk>;
  pending: Map<string, Promise<any>>;
  failed: Set<string>;

  // Methods
  register(id: string, module: any): void;
  get(id: string): any;
  has(id: string): boolean;
  load(id: string): Promise<any>;
  unregister(id: string): void;
}
```

## Error Handling

The error handling strategy will be improved to provide better diagnostics and recovery options:

1. **Detailed Error Messages**: Include chunk ID, source file, and specific error location
2. **Retry Mechanism**: Implement configurable retry strategies for transient failures
3. **Fallback Components**: Provide fallback UI when chunks fail to load
4. **Error Boundaries**: Integrate with framework-specific error boundaries
5. **Telemetry**: Collect error information for debugging (opt-in)

### Error Classification

Errors will be classified into categories to enable appropriate handling:

1. **Network Errors**: Failed to fetch the chunk
2. **Parse Errors**: Failed to parse the chunk code
3. **Execution Errors**: Runtime errors during chunk execution
4. **Property Errors**: Issues with property assignment (current issue)
5. **Module Resolution Errors**: Failed to resolve dependencies

## Testing Strategy

The testing strategy will focus on comprehensive validation of the chunk loading mechanism:

### Unit Tests

1. **Transformer Tests**: Verify the transformer generates compatible code
2. **Chunk Loader Tests**: Test property assignment with various object types
3. **Error Handler Tests**: Verify error classification and handling

### Integration Tests

1. **Cross-Framework Tests**: Test chunk loading across different frameworks
2. **Build Pipeline Tests**: Verify chunks work through the entire build process

### End-to-End Tests

1. **Browser Tests**: Verify chunk loading in different browsers
2. **Production Build Tests**: Test with minification and code splitting enabled

### Specific Test Cases

1. Test loading chunks with getter-only properties
2. Test loading chunks with circular dependencies
3. Test loading chunks with various export patterns
4. Test HMR with dynamically loaded chunks
5. Test error recovery and retry mechanisms

## Implementation Approach

The implementation will follow these steps:

1. **Root Cause Analysis**: Identify exactly where and why the TypeError occurs
2. **Safe Property Assignment**: Implement a safe property assignment mechanism that checks for getters
3. **Transformer Update**: Modify the MTM transformer to generate compatible code
4. **Error Handling**: Enhance error reporting and recovery mechanisms
5. **Testing**: Implement comprehensive tests for the chunk loading system

### Safe Property Assignment

The core of the fix will be a safe property assignment mechanism:

```javascript
function safeAssign(obj, prop, value) {
  // Check if property exists and has a getter but no setter
  const descriptor = Object.getOwnPropertyDescriptor(obj, prop);

  if (descriptor && descriptor.get && !descriptor.set) {
    // Property has getter but no setter, use alternative approach
    try {
      // Try to use Object.defineProperty to override
      Object.defineProperty(obj, prop, {
        configurable: true,
        enumerable: descriptor.enumerable,
        get: () => value,
        set: (newValue) => {
          value = newValue;
        },
      });
    } catch (e) {
      // If that fails, create a new object with the desired properties
      const newObj = Object.create(Object.getPrototypeOf(obj));
      Object.getOwnPropertyNames(obj).forEach((key) => {
        if (key !== prop) {
          Object.defineProperty(
            newObj,
            key,
            Object.getOwnPropertyDescriptor(obj, key)
          );
        }
      });
      Object.defineProperty(newObj, prop, {
        configurable: true,
        enumerable: true,
        writable: true,
        value,
      });
      return newObj; // Return new object to replace the original
    }
    return obj;
  } else {
    // Normal property assignment
    obj[prop] = value;
    return obj;
  }
}
```

## Migration and Backward Compatibility

The fix will maintain backward compatibility with existing .mtm files:

1. **Default Safe Mode**: Enable safe property assignment by default
2. **Feature Flag**: Allow disabling the fix for debugging purposes
3. **Compatibility Layer**: Handle both old and new chunk formats

## Performance Considerations

The fix should have minimal performance impact:

1. **Lazy Checking**: Only perform descriptor checks when necessary
2. **Caching**: Cache property descriptor information
3. **Optimized Paths**: Fast path for common cases without getter/setter issues

## Security Considerations

The implementation will consider security aspects:

1. **Safe Eval**: Ensure no unsafe eval is used in the chunk loading process
2. **Property Access**: Respect property access restrictions
3. **Error Information**: Limit sensitive information in error messages
