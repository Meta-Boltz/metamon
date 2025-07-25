# Safe Property Assignment Utilities

This module provides utilities for safely assigning properties to objects, particularly when dealing with getter-only properties or immutable objects.

## Background

The Metamon framework was experiencing a critical issue with chunk loading in the browser. When attempting to load dynamic chunks from .mtm files, users encountered the error: "Failed to load chunk \_src_pages_index_mtm_import_mtm_transformed: TypeError: Cannot set property data of #<Object> which has only a getter at index.mtm:1:1".

This error occurs because:

1. The MTM transformer creates objects with getter-only properties
2. The chunk loader tries to set values on these properties
3. In strict mode, this throws a TypeError

## API

### safeAssign(obj, prop, value)

Safely assigns a value to an object property, handling getter-only properties and immutable objects.

```javascript
import { safeAssign } from "@metamon/core/utils";

// Example with getter-only property
const obj = {};
Object.defineProperty(obj, "data", {
  get: () => ({ content: "original" }),
  enumerable: true,
  configurable: false,
});

// This would throw: TypeError: Cannot set property data of #<Object> which has only a getter
// obj.data = { content: 'updated' };

// Instead, use safeAssign
const result = safeAssign(obj, "data", { content: "updated" });
console.log(result.data); // { content: 'updated' }
```

### safeAssignAll(obj, props)

Safely assigns multiple properties to an object.

```javascript
import { safeAssignAll } from "@metamon/core/utils";

const obj = { name: "test" };
const result = safeAssignAll(obj, {
  name: "updated",
  newProp: "added",
});
```

### createSafeDescriptor(obj, prop)

Creates a safe property descriptor that ensures the property can be written to.

```javascript
import { createSafeDescriptor } from "@metamon/core/utils";

const obj = {};
Object.defineProperty(obj, "data", {
  get: () => ({ content: "original" }),
  enumerable: true,
  configurable: true,
});

const descriptor = createSafeDescriptor(obj, "data");
// Use the descriptor with Object.defineProperty
Object.defineProperty(newObj, "data", descriptor);
```

## Usage in Chunk Loading

This utility is designed to be used in the chunk loader to safely assign properties to loaded modules:

```javascript
import { safeAssign } from "@metamon/core/utils";

// In the chunk loader
function loadChunk(importFn) {
  return importFn().then((module) => {
    // Instead of directly assigning properties
    // module.data = newData; // This might fail

    // Use safeAssign
    return safeAssign(module, "data", newData);
  });
}
```
